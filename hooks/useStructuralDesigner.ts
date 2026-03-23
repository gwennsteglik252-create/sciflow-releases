
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { generateStructuralDiagram, iterateStructuralDiagram, generateFigureTitleAI } from '../services/gemini/flowchart';
import { DiagramTemplate, DiagramGroup, NodePosition, DiagramNode, SavedDiagram, Connection } from '../components/FigureCenter/Structure/types';
import { OMICS_DATA, FRAMEWORK_DATA, ACADEMIC_PALETTES } from '../components/FigureCenter/Structure/constants';
import { calculateInitialPositions, LAYOUT_CONSTANTS, getGroupCenteredX, setLayoutOverrides, getLayoutConstants } from '../components/FigureCenter/Structure/utils';
import { SafeModalConfig } from '../components/SafeModal';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';

export interface GuideLine {
  type: 'horizontal' | 'vertical';
  pos: number;
}

export const useStructuralDesigner = (isActive: boolean) => {
  const { activeTasks, startGlobalTask, showToast, structuralSession, updateStructuralSession } = useProjectContext();
  const [template, setTemplate] = useState<DiagramTemplate>(structuralSession.template);

  const [data, setData] = useState<any>(structuralSession.data || OMICS_DATA);
  const [positions, setPositions] = useState<Record<string, NodePosition>>(structuralSession.positions);

  const [userPrompt, setUserPrompt] = useState(structuralSession.userPrompt);

  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);

  // 间距调整状态 - 从 session 恢复，如无则使用默认值
  const [spacingConfig, setSpacingConfig] = useState(() => {
    const saved = structuralSession.spacingConfig;
    const config = {
      nodeGap: saved?.nodeGap ?? LAYOUT_CONSTANTS.nodeGap,
      groupPaddingX: saved?.groupPaddingX ?? LAYOUT_CONSTANTS.groupPaddingX,
    };
    // 在初始化时立即应用布局覆盖，确保首次渲染使用正确间距
    setLayoutOverrides(config);
    return config;
  });

  // 同步状态到全局 session - 仅在非拖拽时同步以保证流畅度
  useEffect(() => {
    if (!isDragging) {
      updateStructuralSession({ template, data, positions, userPrompt, spacingConfig });
    }
  }, [template, data, positions, userPrompt, spacingConfig, updateStructuralSession, isDragging]);

  const [history, setHistory] = useState<{ data: any, positions: any }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'structural_gen'), [activeTasks]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const recordState = useCallback((newData: any, newPositions: any = positions) => {
    const snapshot = JSON.parse(JSON.stringify({ data: newData, positions: newPositions }));
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(snapshot);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
    setData(newData);
    setPositions(newPositions);
  }, [historyIndex, positions]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const targetState = JSON.parse(JSON.stringify(history[newIndex]));
      setData(targetState.data);
      setPositions(targetState.positions);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const targetState = JSON.parse(JSON.stringify(history[newIndex]));
      setData(targetState.data);
      setPositions(targetState.positions);
    }
  }, [history, historyIndex]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingConnectionIndex, setEditingConnectionIndex] = useState<number | null>(null);

  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  const [scale, setScale] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [guides, setGuides] = useState<GuideLine[]>([]);

  const [isIterationMode, setIsIterationMode] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');

  const [savedDiagrams, setSavedDiagrams] = useState<SavedDiagram[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_structural_library');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [isNamingAI, setIsNamingAI] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<SafeModalConfig | null>(null);

  const containerRef = useRef<HTMLDivElement>(null!);
  const scrollContainerRef = useRef<HTMLDivElement>(null!);


  const [copiedNode, setCopiedNode] = useState<DiagramNode | null>(null);

  const copyNode = useCallback(() => {
    if (!editingId) return;
    let found: DiagramNode | null = null;
    data.groups.forEach((g: DiagramGroup) => {
      const node = g.nodes.find(n => n.id === editingId);
      if (node) found = JSON.parse(JSON.stringify(node));
    });
    if (found) {
      setCopiedNode(found);
      showToast({ message: '节点已复制', type: 'info' });
    }
  }, [editingId, data, showToast]);

  const pasteNode = useCallback(() => {
    if (!copiedNode) return;
    const newNode: DiagramNode = {
      ...JSON.parse(JSON.stringify(copiedNode)),
      id: `n_${Date.now()}`
    };
    const newGroups = [...data.groups];
    if (newGroups.length === 0) {
      newGroups.push({ id: `g_${Date.now()}`, title: '新建分组', type: 'container', nodes: [] });
    }
    // 默认粘贴到第一个分组
    newGroups[0] = { ...newGroups[0], nodes: [...newGroups[0].nodes, newNode] };

    const newPos = { ...positions };
    const basePos = positions[copiedNode.id] || { x: 100, y: 100 };
    newPos[newNode.id] = { x: basePos.x + 40, y: basePos.y + 40 };

    recordState({ ...data, groups: newGroups }, newPos);
    setEditingId(newNode.id);
    showToast({ message: '节点已粘贴', type: 'success' });
  }, [copiedNode, data, positions, recordState, showToast]);



  useEffect(() => {
    localStorage.setItem('sciflow_structural_library', JSON.stringify(savedDiagrams));
  }, [savedDiagrams]);

  const handleSaveToLibrary = useCallback(async () => {
    if (!data) return;
    setShowSaveModal(true);
    setSaveTitle('正在 AI 智能命名...');
    setIsNamingAI(true);

    try {
      // 提取核心逻辑摘要作为 AI 命名的上下文
      const nodeTexts = data.groups.flatMap((g: any) => g.nodes.map((n: any) => n.text)).join(', ');
      const aiTitle = await generateFigureTitleAI(nodeTexts, '结构逻辑图谱');
      setSaveTitle(aiTitle);
    } catch (e) {
      setSaveTitle(`结构图_${new Date().toLocaleDateString()}`);
    } finally {
      setIsNamingAI(false);
    }
  }, [data]);

  const handleConfirmSave = useCallback(() => {
    if (!saveTitle.trim()) return;
    const now = new Date().toLocaleString();
    if (currentSavedId) {
      setSavedDiagrams(prev => prev.map(d =>
        d.id === currentSavedId
          ? { ...d, title: saveTitle, timestamp: now, data: JSON.parse(JSON.stringify(data)), positions: JSON.parse(JSON.stringify(positions)), spacingConfig: { ...spacingConfig } }
          : d
      ));
    } else {
      const newId = Date.now().toString();
      const newSave: SavedDiagram = {
        id: newId,
        title: saveTitle,
        timestamp: now,
        data: JSON.parse(JSON.stringify(data)),
        positions: JSON.parse(JSON.stringify(positions)),
        spacingConfig: { ...spacingConfig }
      };
      setSavedDiagrams(prev => [newSave, ...prev]);
      setCurrentSavedId(newId);
    }
    setShowSaveModal(false);
    showToast({ message: "结构图已存入库", type: 'success' });
  }, [data, positions, spacingConfig, saveTitle, currentSavedId, showToast]);

  const handleLoadFromLibrary = (diagram: SavedDiagram) => {
    setData(diagram.data);
    setPositions(diagram.positions);
    setCurrentSavedId(diagram.id);
    // 恢复间距配置
    if (diagram.spacingConfig) {
      setSpacingConfig(diagram.spacingConfig);
      setLayoutOverrides(diagram.spacingConfig);
    }
    setShowLibrary(false);
    showToast({ message: `已加载: ${diagram.title}`, type: 'info' });
  };

  const handleDeleteFromLibrary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedDiagrams(prev => prev.filter(d => d.id !== id));
  };

  const handleRenameInLibrary = (id: string, newTitle: string) => {
    setSavedDiagrams(prev => prev.map(d => d.id === id ? { ...d, title: newTitle } : d));
  };

  const handleCategoryChange = (id: string, newCategory: string) => {
    setSavedDiagrams(prev => prev.map(d => d.id === id ? { ...d, category: newCategory } : d));
  };

  const handleExport = async () => {
    if (!containerRef.current) return;
    showToast({ message: "正在分析逻辑拓扑边界并生成紧凑 PNG...", type: 'info' });

    try {
      // 1. Calculate the actual bounding box of all nodes
      const nodeElements = Array.from(containerRef.current.querySelectorAll('[data-node-id]')) as HTMLElement[];
      if (nodeElements.length === 0) {
        showToast({ message: "画布为空，无法导出", type: 'info' });
        return;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      nodeElements.forEach(el => {
        const id = el.getAttribute('data-node-id');
        if (!id) return;
        const pos = positions[id];
        if (!pos) return;

        const w = el.offsetWidth || 200;
        const h = el.offsetHeight || 100;

        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + w);
        maxY = Math.max(maxY, pos.y + h);
      });

      // Add padding
      const padding = 80;
      const exportWidth = (maxX - minX) + padding * 2;
      const exportHeight = (maxY - minY) + padding * 2;

      const blob = await htmlToImage.toBlob(containerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 3,
        cacheBust: true,
        width: exportWidth,
        height: exportHeight,
        style: {
          transform: `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`,
          transformOrigin: 'top left',
        }
      });

      if (blob) {
        saveAs(blob, `Structural_Diagram_${Date.now()}.png`);
        showToast({ message: "导出成功(已自动裁剪空隙)", type: 'success' });
      }
    } catch (e) {
      console.error("Export Error:", e);
      showToast({ message: "导出失败", type: 'error' });
    }
  };



  const sanitizeDiagramData = useCallback((diagData: any) => {
    if (!diagData || !diagData.groups) return diagData;

    // 1. Ensure connections is at least an empty array
    const connections = Array.isArray(diagData.connections) ? diagData.connections : [];

    // 2. Map all valid node IDs
    const validNodeIds = new Set<string>();
    diagData.groups.forEach((g: any) => {
      if (g.nodes) {
        g.nodes.forEach((n: any) => {
          if (n.id) validNodeIds.add(n.id);
        });
      }
    });

    // 3. Filter connections to only those connecting existing nodes
    const sanitizedConnections = connections.filter((c: any) =>
      c && c.from && c.to && validNodeIds.has(c.from) && validNodeIds.has(c.to)
    );

    return { ...diagData, connections: sanitizedConnections };
  }, []);

  const handleTemplateChange = (tpl: DiagramTemplate) => {
    setTemplate(tpl);
    let newData = tpl === 'framework' ? FRAMEWORK_DATA : OMICS_DATA;
    newData = sanitizeDiagramData(newData);
    const newPos = calculateInitialPositions(newData);
    recordState(newData, newPos);
  };

  const handleNodeUpdate = (id: string, updates: Partial<DiagramNode>) => {
    const nextGroups = data.groups.map((g: DiagramGroup) => {
      const nodeIndex = g.nodes.findIndex(n => n.id === id);
      if (nodeIndex === -1) return g;
      const newNodes = [...g.nodes];
      newNodes[nodeIndex] = { ...newNodes[nodeIndex], ...updates };
      return { ...g, nodes: newNodes };
    });

    let finalData = { ...data, groups: nextGroups };

    // Find the updated node and its group
    let updatedNode: DiagramNode | undefined;
    let groupId: string | undefined;
    nextGroups.forEach((g: DiagramGroup) => {
      const found = g.nodes.find(n => n.id === id);
      if (found) {
        updatedNode = found;
        groupId = g.id;
      }
    });

    // 排版全局同步：仅同步 textConfig/subTextConfig/paramsConfig 到所有节点，颜色独立
    if (updatedNode?.typographyGlobalSync) {
      const typoUpdates = {
        textConfig: updatedNode.textConfig,
        subTextConfig: updatedNode.subTextConfig,
        paramsConfig: updatedNode.paramsConfig,
        typographyGlobalSync: true,
      };
      finalData.groups = finalData.groups.map((g: any) => ({
        ...g,
        nodes: g.nodes.map((n: any) => ({ ...n, ...typoUpdates }))
      }));
    }

    // 同组同步：仅在同一分组内同步颜色+排版（不跨组）
    if (updatedNode?.autoSync && groupId) {
      const styleUpdates = {
        icon: updatedNode.icon,
        type: updatedNode.type,
        customColor: updatedNode.customColor,
        textConfig: updatedNode.textConfig,
        subTextConfig: updatedNode.subTextConfig,
        paramsConfig: updatedNode.paramsConfig,
        autoSync: true,
      };
      finalData.groups = finalData.groups.map((g: any) => {
        if (g.id !== groupId) return g;
        return { ...g, nodes: g.nodes.map((n: any) => ({ ...n, ...styleUpdates })) };
      });
    }

    recordState(finalData);
  };

  const handleNodeDelete = (id: string) => {
    const newData = {
      ...data,
      groups: data.groups.map((g: DiagramGroup) => ({
        ...g,
        nodes: g.nodes.filter(n => n.id !== id)
      })),
      connections: data.connections.filter((c: any) => c.from !== id && c.to !== id)
    };
    // Recalculate positions after deletion to ensure no gaps
    const newPositions = calculateInitialPositions(newData);
    recordState(newData, newPositions);
    setEditingId(null);
  };

  const handleGroupUpdate = (id: string, updates: Partial<DiagramGroup>) => {
    let nextGroups = data.groups.map((g: DiagramGroup) =>
      g.id === id ? { ...g, ...updates } : g
    );

    let finalData = { ...data, groups: nextGroups };

    // Find the updated group
    const updatedGroup = nextGroups.find((g: DiagramGroup) => g.id === id);

    // Real-time synchronization if autoSync is active for this group
    // Only sync layout & typography properties, NOT color identity (colorTheme, backgroundColor, fillOpacity, titleBgColor, titleTextColor)
    if (updatedGroup?.autoSync) {
      const sourceConfig = updatedGroup.config || {};
      finalData.groups = finalData.groups.map((g: any) => {
        const existingConfig = g.config || {};
        return {
          ...g,
          config: {
            ...existingConfig,
            // Sync layout properties
            padding: sourceConfig.padding,
            gap: sourceConfig.gap,
            borderWidth: sourceConfig.borderWidth,
            fillOpacity: sourceConfig.fillOpacity,
            // Sync typography properties
            titleSize: sourceConfig.titleSize,
            titleFontWeight: sourceConfig.titleFontWeight,
            titleFontStyle: sourceConfig.titleFontStyle,
            titleFontFamily: sourceConfig.titleFontFamily,
            titlePaddingX: sourceConfig.titlePaddingX,
            titlePaddingY: sourceConfig.titlePaddingY,
            // Preserve each group's own color identity
            // backgroundColor, fillOpacity, titleBgColor, titleTextColor are NOT overwritten
          },
          autoSync: true
        };
      });
    }

    recordState(finalData);
  };

  const handleGroupDelete = (id: string) => {
    const groupToDelete = data.groups.find((g: DiagramGroup) => g.id === id);
    if (!groupToDelete) return;
    const nodeIdsToDelete = groupToDelete.nodes.map((n: DiagramNode) => n.id);
    const newData = {
      ...data,
      groups: data.groups.filter((g: DiagramGroup) => g.id !== id),
      connections: data.connections.filter((c: any) =>
        !nodeIdsToDelete.includes(c.from) && !nodeIdsToDelete.includes(c.to)
      )
    };
    // Recalculate positions for remaining groups
    const newPositions = calculateInitialPositions(newData);
    recordState(newData, newPositions);
    setEditingGroupId(null);
  };

  const handleMoveNode = (groupId: string, nodeId: string, direction: 'up' | 'down') => {
    const newGroups = data.groups.map((g: DiagramGroup) => {
      if (g.id !== groupId) return g;
      const idx = g.nodes.findIndex(n => n.id === nodeId);
      if (idx === -1) return g;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= g.nodes.length) return g;
      const newNodes = [...g.nodes];
      [newNodes[idx], newNodes[newIdx]] = [newNodes[newIdx], newNodes[idx]];
      return { ...g, nodes: newNodes };
    });
    const newData = { ...data, groups: newGroups };
    const newPositions = calculateInitialPositions(newData);
    recordState(newData, newPositions);
  };

  const handleMoveGroup = (groupId: string, direction: 'up' | 'down') => {
    const idx = data.groups.findIndex((g: DiagramGroup) => g.id === groupId);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= data.groups.length) return;
    const newGroups = [...data.groups];
    [newGroups[idx], newGroups[newIdx]] = [newGroups[newIdx], newGroups[idx]];
    const newData = { ...data, groups: newGroups };
    const newPositions = calculateInitialPositions(newData);
    recordState(newData, newPositions);
  };

  const handleConnectionUpdate = useCallback((idx: number, updates: Partial<Connection>) => {
    let newConnections = [...data.connections];
    if (newConnections[idx]) {
      newConnections[idx] = { ...newConnections[idx], ...updates };
    }

    let finalData = { ...data, connections: newConnections };

    // Real-time synchronization for connections
    const updatedConn = newConnections[idx];
    if (updatedConn?.autoSync) {
      const styleUpdates: Partial<Connection> = {
        color: updatedConn.color,
        style: updatedConn.style,
        width: updatedConn.width,
        arrowSize: updatedConn.arrowSize,
        arrowType: updatedConn.arrowType,
        arrowShape: updatedConn.arrowShape,
        labelFontSize: updatedConn.labelFontSize,
        labelConfig: updatedConn.labelConfig,
        boxConfig: updatedConn.boxConfig,
        labelPosition: updatedConn.labelPosition,
        autoSync: true // Propagate sync state
      };

      finalData.connections = finalData.connections.map((c: any) => ({
        ...c,
        ...styleUpdates
      }));
    }

    recordState(finalData);
  }, [data, recordState]);

  const handleConnectionLabelUpdate = (idx: number, newLabel: string) => {
    handleConnectionUpdate(idx, { label: newLabel });
  };

  const handleConnectionDelete = (idx: number) => {
    const newData = {
      ...data,
      connections: data.connections.filter((_: any, i: number) => i !== idx)
    };
    recordState(newData);
    setEditingConnectionIndex(null);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in an input or textarea, don't trigger shortcuts
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd+Z
      if (cmdKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((cmdKey && e.shiftKey && e.key.toLowerCase() === 'z') || (cmdKey && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
      }
      // Copy: Cmd+C
      if (cmdKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copyNode();
      }
      // Paste: Cmd+V
      if (cmdKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteNode();
      }
      // Delete: Backspace or Delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (editingId) {
          e.preventDefault();
          handleNodeDelete(editingId);
        } else if (editingGroupId) {
          e.preventDefault();
          handleGroupDelete(editingGroupId);
        } else if (editingConnectionIndex !== null) {
          e.preventDefault();
          handleConnectionDelete(editingConnectionIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, undo, redo, copyNode, pasteNode, editingId, editingGroupId, editingConnectionIndex, handleNodeDelete, handleGroupDelete, handleConnectionDelete]);

  const handleAddGroup = () => {
    const lastGroup = data.groups.length > 0 ? data.groups[data.groups.length - 1] : null;

    // 智能推断下一个颜色
    let nextColor: string | undefined = undefined;
    if (lastGroup?.colorTheme?.startsWith('#')) {
      // 从 ACADEMIC_PALETTES 中找到包含 lastGroup 颜色的那组，选择下一个颜色
      const currentPalette = ACADEMIC_PALETTES.find(p => p.colors.includes(lastGroup.colorTheme!.toUpperCase()) || p.colors.includes(lastGroup.colorTheme!.toLowerCase()));
      if (currentPalette) {
        const currentIndex = currentPalette.colors.findIndex(c => c.toLowerCase() === lastGroup.colorTheme!.toLowerCase());
        nextColor = currentPalette.colors[(currentIndex + 1) % currentPalette.colors.length];
      }
    }

    const newGroup: DiagramGroup = {
      id: `g_${Date.now()}`,
      title: '新建分组',
      type: 'container',
      nodes: [],
      // 继承属性
      autoSync: lastGroup?.autoSync ?? false,
      colorTheme: nextColor || 'indigo',
      config: lastGroup?.config ? JSON.parse(JSON.stringify(lastGroup.config)) : undefined
    };

    recordState({ ...data, groups: [...data.groups, newGroup] });
  };

  const handleAddNode = (targetGroupId?: string) => {
    const newGroups = [...data.groups];
    if (newGroups.length === 0) {
      newGroups.push({ id: `g_${Date.now()}`, title: '新建分组', type: 'container', nodes: [] });
    }
    let groupIndex = targetGroupId ? newGroups.findIndex(g => g.id === targetGroupId) : 0;
    if (groupIndex === -1) groupIndex = 0;

    const targetGroup = newGroups[groupIndex];

    // 从同组最后一个节点继承视觉属性，避免重复设定
    const siblingNode = targetGroup.nodes.length > 0 ? targetGroup.nodes[targetGroup.nodes.length - 1] : null;
    const newNode: DiagramNode = {
      id: `n_${Date.now()}`,
      text: '新节点',
      type: siblingNode?.type || 'process',
      icon: siblingNode?.icon || 'fa-square',
      params: [],
      ...(siblingNode?.customColor && { customColor: siblingNode.customColor }),
      ...(siblingNode?.fontSize && { fontSize: siblingNode.fontSize }),
      ...(siblingNode?.textConfig && { textConfig: { ...siblingNode.textConfig } }),
      ...(siblingNode?.subTextConfig && { subTextConfig: { ...siblingNode.subTextConfig } }),
      ...(siblingNode?.paramsConfig && { paramsConfig: { ...siblingNode.paramsConfig } }),
    };
    // 将新节点追加到组的末尾
    newGroups[groupIndex] = { ...targetGroup, nodes: [...targetGroup.nodes, newNode] };

    const newData = { ...data, groups: newGroups };
    // 使用 calculateInitialPositions 重新计算所有位置，确保新节点在正确的末尾位置
    const newPositions = calculateInitialPositions(newData);
    recordState(newData, newPositions);
    setEditingId(newNode.id);
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (isConnectMode) {
      if (!connectSourceId) setConnectSourceId(nodeId);
      else {
        if (connectSourceId !== nodeId) {
          // 从已有连线继承样式属性，避免重复设定
          const existingConn = data.connections.length > 0 ? data.connections[data.connections.length - 1] : null;
          const newConn: Connection = {
            from: connectSourceId,
            to: nodeId,
            label: '关联',
            ...(existingConn?.color && { color: existingConn.color }),
            ...(existingConn?.style && { style: existingConn.style }),
            ...(existingConn?.width && { width: existingConn.width }),
            ...(existingConn?.arrowSize && { arrowSize: existingConn.arrowSize }),
            ...(existingConn?.arrowType && { arrowType: existingConn.arrowType }),
            ...(existingConn?.arrowShape && { arrowShape: existingConn.arrowShape }),
            ...(existingConn?.labelFontSize && { labelFontSize: existingConn.labelFontSize }),
            ...(existingConn?.labelConfig && { labelConfig: JSON.parse(JSON.stringify(existingConn.labelConfig)) }),
            ...(existingConn?.boxConfig && { boxConfig: JSON.parse(JSON.stringify(existingConn.boxConfig)) }),
            ...(existingConn?.labelPosition && { labelPosition: existingConn.labelPosition }),
          };
          recordState({ ...data, connections: [...data.connections, newConn] });
          setConnectSourceId(null);
          setIsConnectMode(false);
        } else setConnectSourceId(null);
      }
    }
  };

  const handleAutoLayout = () => recordState(data, calculateInitialPositions(data));

  // ========== 智能标签排版算法 ==========
  const handleSmartLabelLayout = useCallback(() => {
    if (!containerRef.current || !data.connections || data.connections.length === 0) {
      showToast({ message: '没有连线需要排版', type: 'info' });
      return;
    }

    // 1. 收集所有节点的几何信息
    const nodeRects: Record<string, { x: number; y: number; w: number; h: number }> = {};
    Object.entries(positions).forEach(([id, pos]) => {
      const el = containerRef.current?.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
      nodeRects[id] = {
        x: pos.x,
        y: pos.y,
        w: el?.offsetWidth || 240,
        h: el?.offsetHeight || 100
      };
    });

    // 2. 计算每条连线的标签中心点和方向
    interface LabelInfo {
      idx: number;
      cx: number;
      cy: number;
      isHorizontal: boolean;
      labelText: string;
      labelW: number;
      labelH: number;
    }

    const labelInfos: LabelInfo[] = data.connections.map((conn: Connection, idx: number) => {
      const src = nodeRects[conn.from];
      const tgt = nodeRects[conn.to];
      if (!src || !tgt) return null;

      const cxSrc = src.x + src.w / 2;
      const cySrc = src.y + src.h / 2;
      const cxTgt = tgt.x + tgt.w / 2;
      const cyTgt = tgt.y + tgt.h / 2;
      const isSameColumn = Math.abs(cxSrc - cxTgt) < 50;
      const isHorizontal = !isSameColumn;

      // 计算标签中心（与 StepEdgeLayer 中的逻辑一致）
      let cx: number, cy: number;
      if (isSameColumn) {
        const goDown = cyTgt - cySrc > 0;
        const startY = goDown ? src.y + src.h : src.y;
        const endY = goDown ? tgt.y : tgt.y + tgt.h;
        cx = (cxSrc + cxTgt) / 2;
        cy = (startY + endY) / 2;
      } else {
        const goRight = cxTgt - cxSrc > 0;
        const startX = goRight ? src.x + src.w : src.x;
        const endX = goRight ? tgt.x : tgt.x + tgt.w;
        cx = (startX + endX) / 2;
        cy = (cySrc + cyTgt) / 2;
      }

      // 加上用户手动偏移
      const ox = conn.offset?.x || 0;
      const oy = conn.offset?.y || 0;

      // 估算标签尺寸
      const text = conn.label || '关联';
      const fontSize = conn.labelConfig?.fontSize || 10;
      const labelW = Math.max(text.length * fontSize * 0.8, 40) + 24; // px + padding
      const labelH = fontSize * 1.6 + 12;

      return {
        idx,
        cx: cx + ox,
        cy: cy + oy,
        isHorizontal,
        labelText: text,
        labelW,
        labelH
      };
    }).filter(Boolean) as LabelInfo[];

    // 3. 精确生成所有线段的正交路由（与 StepEdgeLayer 的路由逻辑完全一致）
    interface Segment { x1: number; y1: number; x2: number; y2: number }
    const allSegments: Segment[] = [];
    const LINE_EXPAND = 10; // 将线段扩展为宽矩形，确保碰撞检测准确

    data.connections.forEach((conn: Connection) => {
      const src = nodeRects[conn.from];
      const tgt = nodeRects[conn.to];
      if (!src || !tgt) return;
      const cxSrc = src.x + src.w / 2;
      const cySrc = src.y + src.h / 2;
      const cxTgt = tgt.x + tgt.w / 2;
      const cyTgt = tgt.y + tgt.h / 2;
      const isSameColumn = Math.abs(cxSrc - cxTgt) < 50;

      if (isSameColumn) {
        // 垂直连线：单段直线 (top/bottom port → top/bottom port)
        const goDown = cyTgt > cySrc;
        const unifiedX = (cxSrc + cxTgt) / 2;
        const startY = goDown ? src.y + src.h : src.y;
        const endY = goDown ? tgt.y : tgt.y + tgt.h;
        allSegments.push({ x1: unifiedX, y1: startY, x2: unifiedX, y2: endY });
      } else {
        // 水平连线：正交 3 段 (→ 水平 ↓ 垂直 → 水平)
        const goRight = cxTgt > cxSrc;
        const startX = goRight ? src.x + src.w : src.x;
        const endX = goRight ? tgt.x : tgt.x + tgt.w;
        const startY = cySrc;
        const endY = cyTgt;
        const midX = (startX + endX) / 2;

        // Segment 1: 起点水平段
        allSegments.push({ x1: startX, y1: startY, x2: midX, y2: startY });
        // Segment 2: 中间垂直段（桥梁）
        allSegments.push({ x1: midX, y1: startY, x2: midX, y2: endY });
        // Segment 3: 终点水平段
        allSegments.push({ x1: midX, y1: endY, x2: endX, y2: endY });
      }
    });

    // 4. 碰撞检测辅助函数
    interface Rect { x: number; y: number; w: number; h: number }

    const rectsOverlap = (a: Rect, b: Rect): boolean => {
      return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    };

    // 将线段膨胀为有宽度的矩形再检测碰撞（解决 0 宽/0 高线段无法碰撞的问题）
    const segmentToFatRect = (seg: Segment): Rect => {
      const minX = Math.min(seg.x1, seg.x2) - LINE_EXPAND;
      const maxX = Math.max(seg.x1, seg.x2) + LINE_EXPAND;
      const minY = Math.min(seg.y1, seg.y2) - LINE_EXPAND;
      const maxY = Math.max(seg.y1, seg.y2) + LINE_EXPAND;
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    };

    // 预计算所有线段的膨胀矩形
    const fatSegmentRects: Rect[] = allSegments.map(segmentToFatRect);

    const getOffsetForPosition = (pos: string, isH: boolean): { dx: number; dy: number } => {
      if (pos === 'on-line') return { dx: 0, dy: 0 };
      // 增大偏移量确保完全脱离线段
      if (pos === 'above') return isH ? { dx: 0, dy: -35 } : { dx: -60, dy: 0 };
      if (pos === 'below') return isH ? { dx: 0, dy: 35 } : { dx: 60, dy: 0 };
      if (pos === 'left') return { dx: -70, dy: 0 };
      if (pos === 'right') return { dx: 70, dy: 0 };
      return { dx: 0, dy: 0 };
    };

    const getLabelRect = (info: LabelInfo, pos: string): Rect => {
      const { dx, dy } = getOffsetForPosition(pos, info.isHorizontal);
      return {
        x: info.cx + dx - info.labelW / 2,
        y: info.cy + dy - info.labelH / 2,
        w: info.labelW,
        h: info.labelH
      };
    };

    // 5. 贪心分配：逐个选择最佳位置
    const candidates: string[] = ['above', 'below', 'left', 'right', 'on-line'];
    const placedRects: Rect[] = [];
    const results: { idx: number; pos: string }[] = [];

    // 收集所有节点矩形作为障碍物（膨胀一点以留出视觉间距）
    const nodeObstacles: Rect[] = Object.values(nodeRects).map(r => ({
      x: r.x - 5, y: r.y - 5, w: r.w + 10, h: r.h + 10
    }));

    for (const info of labelInfos) {
      let bestPos = 'above';
      let bestScore = Infinity;

      for (const pos of candidates) {
        const rect = getLabelRect(info, pos);
        let score = 0;

        // 与膨胀线段矩形碰撞检测（核心修复）
        for (const fatRect of fatSegmentRects) {
          if (rectsOverlap(rect, fatRect)) {
            score += 100;
          }
        }

        // 与已放置标签重叠计分
        for (const pr of placedRects) {
          if (rectsOverlap(rect, pr)) {
            score += 200;
          }
        }

        // 与节点重叠计分
        for (const nr of nodeObstacles) {
          if (rectsOverlap(rect, nr)) {
            score += 150;
          }
        }

        // 偏好顺序：above > below > left > right > on-line
        const prefPenalty = candidates.indexOf(pos) * 0.1;
        score += prefPenalty;

        if (score < bestScore) {
          bestScore = score;
          bestPos = pos;
        }
      }

      results.push({ idx: info.idx, pos: bestPos });
      placedRects.push(getLabelRect(info, bestPos));
    }

    // 6. 批量更新所有连线的 labelPosition
    const newConnections = data.connections.map((c: Connection, i: number) => {
      const result = results.find(r => r.idx === i);
      return result ? { ...c, labelPosition: result.pos } : c;
    });

    recordState({ ...data, connections: newConnections });
    showToast({ message: `✦ 智能排版完成，已优化 ${results.length} 条连线标签位置`, type: 'success' });
  }, [data, positions, containerRef, recordState, showToast]);

  const handleSpacingChange = (key: 'nodeGap' | 'groupPaddingX', value: number) => {
    const newConfig = { ...spacingConfig, [key]: value };
    setSpacingConfig(newConfig);
    setLayoutOverrides(newConfig);
    // 重新计算布局
    const newPositions = calculateInitialPositions(data);
    setPositions(newPositions);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = 0.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(Math.max(scale + direction * zoomFactor, 0.2), 3);
      setScale(newScale);
    } else {
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0 || isConnectMode) return;
    setIsDragging(true);
    setDragNodeId(id);
    const pos = positions[id] || { x: 0, y: 0 };
    setDragOffset({ x: (e.clientX - pan.x) / scale - pos.x, y: (e.clientY - pan.y) / scale - pos.y });
    e.stopPropagation();
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isTargetNode = (e.target as HTMLElement).closest('[data-node-id]');
    const shouldPan = e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey) || (e.button === 0 && !isTargetNode);

    if (shouldPan) {
      setIsCanvasPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleAiGenerate = useCallback(async () => {
    if (!userPrompt.trim() || isGenerating) return;

    await startGlobalTask(
      {
        id: 'structural_gen',
        type: 'transformation',
        status: 'running',
        title: isIterationMode ? '正在迭代结构图...' : '正在智能构建逻辑图谱...'
      },
      async () => {
        try {
          let result;
          if (isIterationMode) {
            result = await iterateStructuralDiagram(data, userPrompt, aiLanguage);
          } else {
            result = await generateStructuralDiagram(userPrompt, template, aiLanguage);
          }

          if (result && result.groups) {
            const sanitizedResult = sanitizeDiagramData(result);

            // === 自动美化：模仿截图中的专业视觉风格 ===
            const academicColors = ['#D35400', '#27AE60', '#8E44AD', '#2980B9', '#C0392B', '#16A085', '#2C3E50', '#F39C12'];

            sanitizedResult.groups.forEach((g: any, gIdx: number) => {
              const groupColor = academicColors[gIdx % academicColors.length];

              // 组分视觉属性
              g.colorTheme = groupColor;
              if (!g.config) g.config = {};
              g.config.titleBgColor = groupColor;
              g.config.titleTextColor = '#ffffff';
              g.config.backgroundColor = groupColor;
              g.config.fillOpacity = 0.06;
              g.config.borderWidth = 2;
              g.config.titleFontWeight = 'bold';
              g.config.titleSize = 13;

              // 节点视觉属性：继承组色调
              g.nodes.forEach((n: any) => {
                n.customColor = groupColor;
                // 确保所有节点都有图标
                if (!n.icon) n.icon = n.type === 'decision' ? 'fa-code-branch' : n.type === 'input' ? 'fa-arrow-right-to-bracket' : n.type === 'output' ? 'fa-arrow-right-from-bracket' : 'fa-gear';
              });
            });

            // 连线标签样式：透明背景 + 无边框 + 粉红色粗体文字
            if (sanitizedResult.connections) {
              sanitizedResult.connections.forEach((c: any) => {
                c.boxConfig = {
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  borderColor: 'transparent'
                };
                c.labelConfig = {
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: '#C0392B',
                  fontStyle: 'normal'
                };
                c.labelPosition = 'on-line';
                if (!c.label) c.label = '关联';
              });
            }

            const newPos = calculateInitialPositions(sanitizedResult);
            recordState(sanitizedResult, newPos);
            setUserPrompt('');
            showToast({ message: isIterationMode ? 'AI 迭代修正完成' : 'AI 逻辑建模完成', type: 'success' });
          }
        } catch (error) {
          console.error("AI Structural Gen Error:", error);
          showToast({ message: '生成失败，请检查提示词或网络连接', type: 'error' });
        }
      }
    );
  }, [userPrompt, isGenerating, isIterationMode, data, template, startGlobalTask, recordState, showToast, setUserPrompt]);

  // Use refs to avoid re-binding event listeners during drag
  const panRef = useRef(pan);
  const scaleRef = useRef(scale);
  const dragInfoRef = useRef({ dragOffset, dragNodeId, isDragging });
  const positionsRef = useRef(positions);

  useEffect(() => {
    panRef.current = pan;
    scaleRef.current = scale;
    dragInfoRef.current = { dragOffset, dragNodeId, isDragging };
    positionsRef.current = positions;
  }, [pan, scale, dragOffset, dragNodeId, isDragging, positions]);

  useEffect(() => {
    let animationFrameId: number;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const { isDragging, dragNodeId, dragOffset } = dragInfoRef.current;
      const pan = panRef.current;
      const scale = scaleRef.current;
      const currentPositions = positionsRef.current;

      if (isDragging && dragNodeId) {
        // 使用 requestAnimationFrame 保证平滑
        if (animationFrameId) cancelAnimationFrame(animationFrameId);

        animationFrameId = requestAnimationFrame(() => {
          let rawX = (e.clientX - pan.x) / scale - dragOffset.x;
          let newY = (e.clientY - pan.y) / scale - dragOffset.y;

          // --- 强制锁死居中逻辑 (科研绘图: 节点强制在组分内居中，禁止左右移动) ---
          const gIdx = data.groups.findIndex((g: any) => g.nodes.some((n: any) => n.id === dragNodeId));
          const finalX = gIdx !== -1 ? getGroupCenteredX(gIdx) : rawX;

          const newGuides: GuideLine[] = [];
          const SNAP_THRESHOLD = 5;
          const NODE_H = 120;

          // 纵轴吸附逻辑 (保留)
          const targetYs: number[] = [];
          Object.entries(currentPositions).forEach(([id, pos]) => {
            if (id === dragNodeId) return;
            targetYs.push(pos.y, pos.y + NODE_H / 2, pos.y + NODE_H);
          });

          const sourceYs = [newY, newY + NODE_H / 2, newY + NODE_H];
          for (const srcY of sourceYs) {
            const hitY = targetYs.find(tgtY => Math.abs(srcY - tgtY) < SNAP_THRESHOLD);
            if (hitY !== undefined) {
              newY += (hitY - srcY);
              newGuides.push({ type: 'horizontal', pos: hitY });
              break;
            }
          }

          setGuides(newGuides);
          setPositions(prev => ({ ...prev, [dragNodeId]: { x: finalX, y: newY } }));
        });
      }

      if (isCanvasPanning) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(() => {
          setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
        });
      }
    };

    const handleGlobalMouseUp = () => {
      if (dragInfoRef.current.isDragging) {
        recordState(data, positionsRef.current);
      }
      setIsDragging(false);
      setDragNodeId(null);
      setGuides([]);
      setIsCanvasPanning(false);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isCanvasPanning, panStart, data, recordState]);

  const handleApplyGlobalPalette = useCallback((palette: string[]) => {
    if (!data || !data.groups) return;

    const newData = JSON.parse(JSON.stringify(data));

    // Helper: 判断颜色是否过浅（不适合作为 header 背景色）
    const isVeryLight = (hex: string): boolean => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      // 使用相对亮度公式
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.75;
    };

    // Helper: 判断是否用深色文字还是浅色文字
    const getContrastText = (hex: string): string => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.55 ? '#1e293b' : '#ffffff';
    };

    // 分离出适合做 header 的深色和适合做 fill 的浅色
    const strongColors = palette.filter(c => !isVeryLight(c));
    const lightColors = palette.filter(c => isVeryLight(c));

    // 分配颜色给每个 group（每个层级分配一个主色调）
    newData.groups.forEach((g: DiagramGroup, groupIdx: number) => {
      // 组分使用顺序的深色，保证层级视觉区分
      const groupColor = strongColors.length > 0
        ? strongColors[groupIdx % strongColors.length]
        : palette[groupIdx % palette.length];

      // 组分容器填充色：如果有浅色就用它，否则用主色的低透明度
      const containerFill = lightColors.length > 0
        ? lightColors[groupIdx % lightColors.length]
        : groupColor;

      g.colorTheme = groupColor;

      if (!g.config) g.config = {};
      g.config.backgroundColor = containerFill;
      g.config.fillOpacity = isVeryLight(containerFill) ? 0.6 : 0.12;

      // 标题栏使用深色，文字自动对比
      g.config.titleBgColor = groupColor;
      g.config.titleTextColor = getContrastText(groupColor);

      // 组内所有节点共享组分的主色调（同一层级视觉统一，不同层级自然区分）
      g.nodes.forEach((n: DiagramNode) => {
        n.customColor = groupColor;
      });
    });

    recordState(newData);
    showToast({ message: "已应用学术配色方案", type: 'success' });
  }, [data, recordState, showToast]);


  // 快速保存：有已保存记录则静默覆盖，无则弹对话框
  const handleQuickSave = useCallback(async () => {
    if (!data) return;
    if (currentSavedId) {
      const now = new Date().toLocaleString();
      const existing = savedDiagrams.find(d => d.id === currentSavedId);
      setSavedDiagrams(prev => prev.map(d =>
        d.id === currentSavedId
          ? { ...d, timestamp: now, data: JSON.parse(JSON.stringify(data)), positions: JSON.parse(JSON.stringify(positions)), spacingConfig: { ...spacingConfig } }
          : d
      ));
      showToast({ message: `已覆盖保存「${existing?.title || '当前方案'}」`, type: 'success' });
    } else {
      await handleSaveToLibrary();
    }
  }, [data, currentSavedId, savedDiagrams, positions, spacingConfig, handleSaveToLibrary, showToast]);

  // 另存为：始终弹对话框保存内帺
  const handleSaveAs = useCallback(async () => {
    if (!data) return;
    setCurrentSavedId(null);
    await handleSaveToLibrary();
  }, [data, handleSaveToLibrary]);

  return {
    template, data, positions, undo, redo, canUndo, canRedo, editingId, setEditingId,
    editingGroupId, setEditingGroupId, editingConnectionIndex, setEditingConnectionIndex,
    isConnectMode, setIsConnectMode, connectSourceId, setConnectSourceId, scale, setScale, pan, setPan,
    dragNodeId, userPrompt, setUserPrompt, isGenerating, isIterationMode, setIsIterationMode,
    aiLanguage, setAiLanguage, spacingConfig, handleSpacingChange,
    savedDiagrams, showLibrary, setShowLibrary, showSaveModal, setShowSaveModal, saveTitle, setSaveTitle,
    containerRef, scrollContainerRef, handleTemplateChange, handleNodeUpdate, handleNodeDelete,
    handleGroupUpdate, handleGroupDelete, handleConnectionUpdate, handleConnectionLabelUpdate, handleConnectionDelete,
    handleAddGroup, handleAddNode, handleNodeClick, handleAutoLayout, handleSaveToLibrary, handleConfirmSave,
    handleLoadFromLibrary, handleDeleteFromLibrary, handleRenameInLibrary, handleCategoryChange, handleWheel, handleAiGenerate, onNodeMouseDown,
    handleCanvasMouseDown, handleBackgroundClick: () => { setEditingId(null); setEditingGroupId(null); setEditingConnectionIndex(null); },
    confirmModal, setConfirmModal, handleExport, handleSvgExport: () => { }, handleApplyGlobalPalette,
    handleMoveNode, handleMoveGroup,
    handleSyncNodeToGroup: useCallback((sourceNode: DiagramNode) => {
      // 同组同步：仅在同一分组内同步所有属性（颜色+排版）
      const updates: Partial<DiagramNode> = {
        icon: sourceNode.icon,
        type: sourceNode.type,
        customColor: sourceNode.customColor,
        textConfig: sourceNode.textConfig,
        subTextConfig: sourceNode.subTextConfig,
        paramsConfig: sourceNode.paramsConfig,
      };

      const newData = {
        ...data,
        groups: data.groups.map((g: any) => {
          const inSameGroup = g.nodes.some((n: any) => n.id === sourceNode.id);
          if (!inSameGroup) return g;
          return { ...g, nodes: g.nodes.map((n: any) => ({ ...n, ...updates })) };
        })
      };

      recordState(newData);
      showToast({ message: "已将当前节点样式同步至同组节点", type: 'success' });
    }, [data, recordState, showToast]),
    handleSyncTypographyGlobal: useCallback((sourceNode: DiagramNode) => {
      // 排版全局同步：仅同步字体/字号/字重，颜色不变
      const typoUpdates: Partial<DiagramNode> = {
        textConfig: sourceNode.textConfig,
        subTextConfig: sourceNode.subTextConfig,
        paramsConfig: sourceNode.paramsConfig,
      };

      const newData = {
        ...data,
        groups: data.groups.map((g: any) => ({
          ...g,
          nodes: g.nodes.map((n: any) => ({ ...n, ...typoUpdates }))
        }))
      };

      recordState(newData);
      showToast({ message: "✦ 排版已全局同步，各节点颜色保持独立", type: 'success' });
    }, [data, recordState, showToast]),
    handleSyncGroupConfig: useCallback((sourceGroup: DiagramGroup) => {
      const newData = {
        ...data,
        groups: data.groups.map((g: any) => ({
          ...g,
          config: JSON.parse(JSON.stringify(sourceGroup.config || {}))
        }))
      };
      recordState(newData);
      showToast({ message: "已将当前高级配置同步至所有层级组", type: 'success' });
    }, [data, recordState, showToast]),
    handleSyncConnection: useCallback((sourceConn: Connection) => {
      const updates: Partial<Connection> = {
        color: sourceConn.color,
        style: sourceConn.style,
        width: sourceConn.width,
        arrowSize: sourceConn.arrowSize,
        arrowType: sourceConn.arrowType,
        arrowShape: sourceConn.arrowShape,
        labelFontSize: sourceConn.labelFontSize,
        labelPosition: sourceConn.labelPosition,
      };

      const newData = {
        ...data,
        connections: data.connections.map((c: any) => ({
          ...c,
          ...updates
        }))
      };

      recordState(newData);
      showToast({ message: "已将当前连线属性同步至所有连线", type: 'success' });
    }, [data, recordState, showToast]),
    handleSmartLabelLayout,
    guides,
    currentSavedId, handleQuickSave, handleSaveAs,
  };
};
