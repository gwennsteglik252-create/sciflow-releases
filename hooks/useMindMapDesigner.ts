import { useState, useCallback, useMemo, useRef } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { MindMapData, MindMapNode, MindMapLayer, MindMapConnection, SavedMindMap } from '../components/FigureCenter/MindMap/types';
import { DEFAULT_GLOBAL_CONFIG, LAYER_COLORS, MINDMAP_TEMPLATES } from '../components/FigureCenter/MindMap/constants';
import { generateMindMapAI, generateFigureTitleAI, iterateMindMapAI } from '../services/gemini/flowchart';
import { applyElkLayout, applySimpleLayout } from '../utils/elkLayout';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';
import React from 'react';

const MAX_HISTORY = 50;
const CURRENT_KEY = 'sciflow_mindmap_current';
const LIBRARY_KEY = 'sciflow_mindmap_library';

export const useMindMapDesigner = () => {
  const { startGlobalTask, showToast, activeTasks } = useProjectContext();

  // === Core State ===
  const [data, setDataRaw] = useState<MindMapData | null>(() => {
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const [userPrompt, setUserPrompt] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');
  const containerRef = useRef<HTMLDivElement>(null!);

  // === Library State ===
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

  // === Undo/Redo ===
  const undoStackRef = useRef<(MindMapData | null)[]>([]);
  const redoStackRef = useRef<(MindMapData | null)[]>([]);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });

  const syncHistorySize = useCallback(() => {
    setHistorySize({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, []);

  const setData = useCallback((newData: MindMapData | null) => {
    setDataRaw(prev => {
      undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
      redoStackRef.current = [];
      return newData;
    });
    syncHistorySize();
    try {
      if (newData) localStorage.setItem(CURRENT_KEY, JSON.stringify(newData));
      else localStorage.removeItem(CURRENT_KEY);
    } catch { }
  }, [syncHistorySize]);

  /** 静默更新节点（不压栈、不写 localStorage），仅用于拖拽过程 */
  const updateNodeSilent = useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
    setDataRaw(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        layers: prev.layers.map(l => ({
          ...l,
          nodes: l.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
        })),
      };
    });
  }, []);

  /** 拖拽结束后提交一次完整快照到撤销栈 */
  const commitNodeDrag = useCallback(() => {
    setDataRaw(prev => {
      if (!prev) return prev;
      undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
      redoStackRef.current = [];
      try { localStorage.setItem(CURRENT_KEY, JSON.stringify(prev)); } catch { }
      return prev;
    });
    syncHistorySize();
  }, [syncHistorySize]);

  const canUndo = historySize.undo > 0;
  const canRedo = historySize.redo > 0;

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    setDataRaw(prev => {
      const [top, ...rest] = undoStackRef.current;
      undoStackRef.current = rest;
      redoStackRef.current = [prev, ...redoStackRef.current].slice(0, MAX_HISTORY);
      return top;
    });
    setTimeout(syncHistorySize, 0);
  }, [syncHistorySize]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    setDataRaw(prev => {
      const [top, ...rest] = redoStackRef.current;
      redoStackRef.current = rest;
      undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
      return top;
    });
    setTimeout(syncHistorySize, 0);
  }, [syncHistorySize]);

  // === Saved Library ===
  const [savedList, setSavedList] = useState<SavedMindMap[]>(() => {
    try {
      const s = localStorage.getItem(LIBRARY_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  React.useEffect(() => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(savedList));
  }, [savedList]);

  const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'mindmap_gen'), [activeTasks]);

  // === Create Empty / From Template ===
  const handleCreateEmpty = useCallback(() => {
    const tpl = JSON.parse(JSON.stringify(MINDMAP_TEMPLATES[2].data)) as MindMapData;
    // Fresh IDs
    const ts = Date.now();
    tpl.layers.forEach((l, li) => {
      l.id = `layer_${ts}_${li}`;
      l.nodes.forEach((n, ni) => { n.id = `n_${ts}_${li}_${ni}`; });
    });
    setData(tpl);
    showToast({ message: '空白框架思维图已就绪', type: 'info' });
  }, [setData, showToast]);

  const handleLoadTemplate = useCallback((templateIdx: number) => {
    const tpl = JSON.parse(JSON.stringify(MINDMAP_TEMPLATES[templateIdx]?.data || MINDMAP_TEMPLATES[0].data)) as MindMapData;
    setData(tpl);
    showToast({ message: `已加载模板: ${MINDMAP_TEMPLATES[templateIdx]?.name}`, type: 'success' });
  }, [setData, showToast]);

  // === AI Generate ===
  const handleGenerate = useCallback(async () => {
    if (!userPrompt.trim()) return;
    await startGlobalTask({ id: 'mindmap_gen', type: 'transformation', status: 'running', title: '正在构建框架思维图...' }, async () => {
      const result = await generateMindMapAI(userPrompt, aiLanguage);
      if (result?.layers) {
        let mindmapData: MindMapData = {
          title: result.title || '框架思维图',
          layers: result.layers,
          connections: result.connections || [],
          globalConfig: result.globalConfig || { ...DEFAULT_GLOBAL_CONFIG },
          timeline: result.timeline,
          caption: result.caption,
        };
        // 用 elk 布局引擎精确计算坐标
        try {
          mindmapData = await applyElkLayout(mindmapData);
        } catch {
          mindmapData = applySimpleLayout(mindmapData);
        }
        setData(mindmapData);
        showToast({ message: 'AI 框架思维图构建完成', type: 'success' });
      }
    });
  }, [userPrompt, aiLanguage, startGlobalTask, setData, showToast]);

  // === AI Iterate (迭代优化) ===
  const handleIterate = useCallback(async () => {
    if (!userPrompt.trim() || !data) return;
    await startGlobalTask({ id: 'mindmap_gen', type: 'transformation', status: 'running', title: '正在 AI 迭代优化...' }, async () => {
      const result = await iterateMindMapAI(data, userPrompt, aiLanguage);
      if (result?.layers) {
        let mindmapData: MindMapData = {
          title: result.title || data.title,
          layers: result.layers,
          connections: result.connections || [],
          globalConfig: result.globalConfig || data.globalConfig,
        };
        try {
          mindmapData = await applyElkLayout(mindmapData);
        } catch {
          mindmapData = applySimpleLayout(mindmapData);
        }
        setData(mindmapData);
        showToast({ message: 'AI 迭代优化完成', type: 'success' });
      }
    });
  }, [userPrompt, aiLanguage, data, startGlobalTask, setData, showToast]);

  // === Auto Layout ===
  const autoLayout = useCallback(async () => {
    if (!data) return;
    try {
      const layouted = await applyElkLayout(data);
      setData(layouted);
      showToast({ message: '自动布局已应用（elk 引擎）', type: 'success' });
    } catch {
      const layouted = applySimpleLayout(data);
      setData(layouted);
      showToast({ message: '自动布局已应用', type: 'success' });
    }
  }, [data, setData, showToast]);

  // === Layer Operations ===
  const addLayer = useCallback(() => {
    if (!data) return;
    const ts = Date.now();
    const idx = data.layers.length;
    const newLayer: MindMapLayer = {
      id: `layer_${ts}`,
      title: `第${idx + 1}阶段`,
      backgroundColor: LAYER_COLORS[idx % LAYER_COLORS.length],
      borderStyle: 'dashed',
      height: 160,
      separatorStyle: 'line',
      nodes: [],
    };
    setData({ ...data, layers: [...data.layers, newLayer] });
  }, [data, setData]);

  const updateLayer = useCallback((layerId: string, updates: Partial<MindMapLayer>) => {
    if (!data) return;
    setData({
      ...data,
      layers: data.layers.map(l => l.id === layerId ? { ...l, ...updates } : l),
    });
  }, [data, setData]);

  const deleteLayer = useCallback((layerId: string) => {
    if (!data) return;
    const layerNodeIds = new Set(data.layers.find(l => l.id === layerId)?.nodes.map(n => n.id) || []);
    setData({
      ...data,
      layers: data.layers.filter(l => l.id !== layerId),
      connections: data.connections.filter(c => !layerNodeIds.has(c.from) && !layerNodeIds.has(c.to)),
    });
    if (selectedLayerId === layerId) setSelectedLayerId(null);
  }, [data, setData, selectedLayerId]);

  const moveLayer = useCallback((layerId: string, direction: 'up' | 'down') => {
    if (!data) return;
    const idx = data.layers.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= data.layers.length) return;
    const layers = [...data.layers];
    [layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
    setData({ ...data, layers });
  }, [data, setData]);

  // === Node Operations ===
  const addNode = useCallback((layerId: string) => {
    if (!data) return;
    const ts = Date.now();
    const layer = data.layers.find(l => l.id === layerId);
    if (!layer) return;
    const existingNodes = layer.nodes.length;
    const newNode: MindMapNode = {
      id: `n_${ts}_${Math.random().toString(36).slice(2, 6)}`,
      text: '新节点',
      x: 60 + existingNodes * 200,
      y: 40,
      width: 160,
      height: 50,
      backgroundColor: '#4A90D9',
      textColor: '#ffffff',
      fontSize: 14,
    };
    setData({
      ...data,
      layers: data.layers.map(l => l.id === layerId ? { ...l, nodes: [...l.nodes, newNode] } : l),
    });
    setSelectedNodeId(newNode.id);
  }, [data, setData]);

  const updateNode = useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
    if (!data) return;
    setData({
      ...data,
      layers: data.layers.map(l => ({
        ...l,
        nodes: l.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
      })),
    });
  }, [data, setData]);

  const deleteNode = useCallback((nodeId: string) => {
    if (!data) return;
    setData({
      ...data,
      layers: data.layers.map(l => ({
        ...l,
        nodes: l.nodes.filter(n => n.id !== nodeId),
      })),
      connections: data.connections.filter(c => c.from !== nodeId && c.to !== nodeId),
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [data, setData, selectedNodeId]);

  // === Connection Operations ===
  const addConnection = useCallback((from: string, to: string) => {
    if (!data) return;
    const ts = Date.now();
    const newConn: MindMapConnection = {
      id: `conn_${ts}`,
      from, to,
      style: 'solid',
      color: '#90A4AE',
      arrowType: 'forward',
    };
    setData({ ...data, connections: [...data.connections, newConn] });
  }, [data, setData]);

  const updateConnection = useCallback((connId: string, updates: Partial<MindMapConnection>) => {
    if (!data) return;
    setData({
      ...data,
      connections: data.connections.map(c => c.id === connId ? { ...c, ...updates } : c),
    });
  }, [data, setData]);

  const deleteConnection = useCallback((connId: string) => {
    if (!data) return;
    setData({ ...data, connections: data.connections.filter(c => c.id !== connId) });
  }, [data, setData]);

  // === Global Config ===
  const updateGlobalConfig = useCallback((updates: Partial<MindMapData['globalConfig']>) => {
    if (!data) return;
    setData({ ...data, globalConfig: { ...data.globalConfig, ...updates } });
  }, [data, setData]);

  // === Timeline Operations ===
  const addTimeline = useCallback((phase?: Partial<import('../components/FigureCenter/MindMap/types').TimelinePhase>) => {
    if (!data) return;
    const newPhase: import('../components/FigureCenter/MindMap/types').TimelinePhase = {
      label: phase?.label || '新阶段',
      fromLayer: phase?.fromLayer ?? (data.timeline?.length ? (data.timeline[data.timeline.length - 1].toLayer + 1) : 0),
      toLayer: phase?.toLayer ?? Math.max(0, data.layers.length - 1),
      color: phase?.color || '#475569',
    };
    setData({ ...data, timeline: [...(data.timeline || []), newPhase] });
  }, [data, setData]);

  const updateTimeline = useCallback((index: number, updates: Partial<import('../components/FigureCenter/MindMap/types').TimelinePhase>) => {
    if (!data || !data.timeline || index < 0 || index >= data.timeline.length) return;
    const timeline = [...data.timeline];
    timeline[index] = { ...timeline[index], ...updates };
    setData({ ...data, timeline });
  }, [data, setData]);

  const deleteTimeline = useCallback((index: number) => {
    if (!data || !data.timeline || index < 0 || index >= data.timeline.length) return;
    const timeline = [...data.timeline];
    timeline.splice(index, 1);
    setData({ ...data, timeline: timeline.length > 0 ? timeline : undefined });
  }, [data, setData]);

  const moveTimeline = useCallback((index: number, direction: 'up' | 'down') => {
    if (!data || !data.timeline) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= data.timeline.length) return;
    const timeline = [...data.timeline];
    [timeline[index], timeline[newIdx]] = [timeline[newIdx], timeline[index]];
    setData({ ...data, timeline });
  }, [data, setData]);

  // === Save / Load / Export ===
  const handleSaveToLibrary = useCallback(async () => {
    if (!data) {
      showToast({ message: '画布为空，无法保存', type: 'info' });
      return;
    }
    setShowSaveModal(true);
    setSaveTitle('正在 AI 智能命名...');
    try {
      const nodeTexts = data.layers.flatMap(l => l.nodes.map(n => n.text)).join(', ');
      const aiTitle = await generateFigureTitleAI(nodeTexts, '框架思维图');
      setSaveTitle(aiTitle);
    } catch {
      setSaveTitle(data.title || `框架思维图_${new Date().toLocaleDateString()}`);
    }
  }, [data, showToast]);

  const handleConfirmSave = useCallback((asNew?: boolean) => {
    if (!data || !saveTitle.trim()) return;
    const now = new Date().toLocaleString();
    if (!asNew && currentSavedId) {
      setSavedList(prev => prev.map(s =>
        s.id === currentSavedId ? { ...s, title: saveTitle, timestamp: now, data: JSON.parse(JSON.stringify(data)) } : s
      ));
    } else {
      const newId = Date.now().toString();
      setSavedList(prev => [{
        id: newId,
        title: saveTitle,
        timestamp: now,
        data: JSON.parse(JSON.stringify(data)),
      }, ...prev]);
      setCurrentSavedId(newId);
    }
    setShowSaveModal(false);
    setSaveTitle('');
    showToast({ message: '框架思维图已存入库', type: 'success' });
  }, [data, saveTitle, currentSavedId, showToast]);

  const handleLoadFromLibrary = useCallback((item: SavedMindMap) => {
    setData(JSON.parse(JSON.stringify(item.data)));
    setCurrentSavedId(item.id);
    setShowLibrary(false);
    showToast({ message: `已加载: ${item.title}`, type: 'info' });
  }, [setData, showToast]);

  const handleDeleteFromLibrary = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedList(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleRenameInLibrary = useCallback((id: string, newTitle: string) => {
    setSavedList(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  }, []);

  const handleCategoryChange = useCallback((id: string, newCategory: string) => {
    setSavedList(prev => prev.map(s => s.id === id ? { ...s, category: newCategory } : s));
  }, []);

  const handleQuickSave = useCallback(async () => {
    if (!data) {
      showToast({ message: '画布为空，无法保存', type: 'info' });
      return;
    }
    if (currentSavedId) {
      const now = new Date().toLocaleString();
      const existing = savedList.find(s => s.id === currentSavedId);
      setSavedList(prev => prev.map(s =>
        s.id === currentSavedId ? { ...s, timestamp: now, data: JSON.parse(JSON.stringify(data)) } : s
      ));
      showToast({ message: `已覆盖保存「${existing?.title || '当前方案'}」`, type: 'success' });
    } else {
      await handleSaveToLibrary();
    }
  }, [data, currentSavedId, savedList, handleSaveToLibrary, showToast]);

  const handleSaveAs = useCallback(async () => {
    if (!data) {
      showToast({ message: '画布为空，无法保存', type: 'info' });
      return;
    }
    setCurrentSavedId(null);
    await handleSaveToLibrary();
  }, [data, handleSaveToLibrary, showToast]);

  // === Export ===
  const handleExport = useCallback(async () => {
    if (!containerRef.current || !data) return;
    showToast({ message: '正在生成高精度 PNG...', type: 'info' });
    try {
      const blob = await htmlToImage.toBlob(containerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        cacheBust: true,
      });
      if (blob) {
        saveAs(blob, `MindMap_${data.title.replace(/\s+/g, '_')}_${Date.now()}.png`);
        showToast({ message: '导出成功', type: 'success' });
      }
    } catch (e) {
      console.error('Export Error:', e);
      showToast({ message: '导出失败', type: 'error' });
    }
  }, [data, showToast]);

  return {
    // Core
    data, setData, userPrompt, setUserPrompt,
    selectedNodeId, setSelectedNodeId,
    selectedLayerId, setSelectedLayerId,
    zoom, setZoom, pan, setPan,
    aiLanguage, setAiLanguage,
    isGenerating, containerRef,
    // Actions
    handleCreateEmpty, handleLoadTemplate, handleGenerate, handleIterate,
    addLayer, updateLayer, deleteLayer, moveLayer,
    addNode, updateNode, deleteNode,
    updateNodeSilent, commitNodeDrag,
    addConnection, updateConnection, deleteConnection,
    updateGlobalConfig, autoLayout,
    addTimeline, updateTimeline, deleteTimeline, moveTimeline,
    // Library
    savedList, showLibrary, setShowLibrary,
    showSaveModal, setShowSaveModal, saveTitle, setSaveTitle,
    handleSaveToLibrary, handleConfirmSave, handleLoadFromLibrary,
    handleDeleteFromLibrary, handleRenameInLibrary, handleCategoryChange,
    handleQuickSave, handleSaveAs, currentSavedId,
    // Export
    handleExport,
    // Undo/Redo
    undo, redo, canUndo, canRedo,
  };
};
