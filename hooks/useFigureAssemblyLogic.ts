
import React, { useState, useRef, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';
import { FigurePanel, FigureText, FigureShape, SavedFigureAssembly } from '../types';
// FigureText and FigureShape are used for typed layer updates
import { useProjectContext } from '../context/ProjectContext';
import { generateFigureTitleAI } from '../services/gemini/flowchart';

const canvasWidth = 1600;
const canvasHeight = 1200;

export const useFigureAssemblyLogic = (savedLibrary: any[]) => {
  const { showToast } = useProjectContext();

  // 从 localStorage 恢复核心画布状态，解决切换页面后数据消失的问题
  const [panels, setPanels] = useState<FigurePanel[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_assembly_panels');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // 使用 ref 存储图片 URL 映射，避免在历史记录中重复存储大量 base64 数据
  // 注意：useRef 不支持惰性初始化函数，需在外部先计算初始值
  const initImgUrlMap = (): Map<string, string> => {
    const map = new Map<string, string>();
    try {
      const saved = localStorage.getItem('sciflow_assembly_panels');
      if (saved) {
        const savedPanels = JSON.parse(saved) as FigurePanel[];
        savedPanels.forEach(p => {
          if (p.imgUrl && p.imgUrl.startsWith('data:')) {
            map.set(p.id, p.imgUrl);
          }
        });
      }
    } catch { /* 忽略 */ }
    return map;
  };
  const imgUrlMapRef = useRef<Map<string, string>>(initImgUrlMap());
  const [layoutConfig, setLayoutConfig] = useState<{ rows: number; cols: number }>(() => {
    try {
      const saved = localStorage.getItem('sciflow_assembly_layout');
      return saved ? JSON.parse(saved) : { rows: 2, cols: 3 };
    } catch { return { rows: 2, cols: 3 }; }
  });
  const [cellAspectRatio, setCellAspectRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sciflow_assembly_ratio');
      return saved ? parseFloat(saved) : 0.75;
    } catch { return 0.75; }
  });
  const [imageFit, setImageFit] = useState<'contain' | 'cover'>('contain');
  const [localAssets, setLocalAssets] = useState<{ id: string, url: string }[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_assembly_assets');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [canvasScale, setCanvasScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // --- New states required by FigureAssembly.tsx ---
  const [showGrid, setShowGrid] = useState(true);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [defaultTextStyle, setDefaultTextStyle] = useState({ fontSize: 16, color: '#000000', fontWeight: 'bold', fontFamily: 'Arial, sans-serif' });
  const [defaultLabelStyle, setDefaultLabelStyle] = useState({ labelFontSize: 40, labelFontFamily: 'Arial, sans-serif', labelFontWeight: 'bold', labelFontStyle: 'normal', labelPadding: 0 });
  const [clipboard, setClipboard] = useState<{ type: 'panel' | 'text' | 'shape', data: any } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [savedAssemblies, setSavedAssemblies] = useState<SavedFigureAssembly[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_figure_assemblies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [isNamingAI, setIsNamingAI] = useState(false);
  const [editingText, setEditingText] = useState<{ panelId: string, textId: string } | null>(null);
  const [selectedText, setSelectedText] = useState<{ panelId: string, textId: string } | null>(null);
  const [selectedShape, setSelectedShape] = useState<{ panelId: string, shapeId: string } | null>(null);
  const [textDragState, setTextDragState] = useState<any>(null);
  const [shapeDragState, setShapeDragState] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 持久化核心画布状态到 localStorage（防抖 1s 避免频繁写入）
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('sciflow_assembly_panels', JSON.stringify(panels));
      } catch { /* 图片数据较大时可能超出 quota，静默忽略 */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [panels]);

  useEffect(() => {
    localStorage.setItem('sciflow_assembly_layout', JSON.stringify(layoutConfig));
  }, [layoutConfig]);

  useEffect(() => {
    localStorage.setItem('sciflow_assembly_ratio', String(cellAspectRatio));
  }, [cellAspectRatio]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('sciflow_assembly_assets', JSON.stringify(localAssets));
      } catch { /* 静默忽略 */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [localAssets]);

  // Sync library to localStorage
  useEffect(() => {
    localStorage.setItem('sciflow_figure_assemblies', JSON.stringify(savedAssemblies));
  }, [savedAssemblies]);

  // 性能优化核心：历史记录存储完整状态，但使用 useRef 维护图片 URL 映射表
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const recordState = useCallback((newPanels: FigurePanel[], newLayout?: { rows: number, cols: number }, newRatio?: number) => {
    if (newLayout) setLayoutConfig(newLayout);
    if (newRatio !== undefined) setCellAspectRatio(newRatio);

    // 更新图片 URL 映射表
    newPanels.forEach(p => {
      if (p.imgUrl && p.imgUrl.startsWith('data:')) {
        imgUrlMapRef.current.set(p.id, p.imgUrl);
      }
    });

    // 优化：移除图片 base64 数据以减少历史记录体积
    const panelsForHistory = newPanels.map(p => ({
      ...p,
      imgUrl: p.imgUrl.startsWith('data:') ? '[base64-data]' : p.imgUrl
    }));

    const snapshot = JSON.stringify({ panels: panelsForHistory, layout: newLayout || layoutConfig, ratio: newRatio ?? cellAspectRatio });
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      // 去重检查：避免连续相同操作重复记录
      if (next.length > 0 && next[next.length - 1] === snapshot) return prev;
      next.push(snapshot);
      return next.slice(-30);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 29));
    setPanels(newPanels);
  }, [historyIndex, layoutConfig, cellAspectRatio]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const { panels: p, layout: l, ratio: r } = JSON.parse(history[historyIndex - 1]);
      // 恢复图片 URL：从映射表中找回真实的 imgUrl
      const restoredPanels = p.map((hp: FigurePanel) => ({
        ...hp,
        imgUrl: hp.imgUrl === '[base64-data]' ? (imgUrlMapRef.current.get(hp.id) || hp.imgUrl) : hp.imgUrl
      }));
      setPanels(restoredPanels);
      setLayoutConfig(l);
      setCellAspectRatio(r);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const { panels: p, layout: l, ratio: r } = JSON.parse(history[historyIndex + 1]);
      // 恢复图片 URL：从映射表中找回真实的 imgUrl
      const restoredPanels = p.map((hp: FigurePanel) => ({
        ...hp,
        imgUrl: hp.imgUrl === '[base64-data]' ? (imgUrlMapRef.current.get(hp.id) || hp.imgUrl) : hp.imgUrl
      }));
      setPanels(restoredPanels);
      setLayoutConfig(l);
      setCellAspectRatio(r);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  const calculateLayout = useCallback((currentPanels: FigurePanel[], cols: number, ratio: number, rows: number) => {
    const margin = 40, gap = 50, usableWidth = canvasWidth - (2 * margin);
    const colWidth = (usableWidth - (cols - 1) * gap) / cols, rowHeight = colWidth * ratio;
    const occupied = new Set<string>();

    return currentPanels.map((panel) => {
      const spanC = Math.min(panel.spanCols || 1, cols);
      const spanR = panel.spanRows || 1;

      let r = 0;
      let c = 0;
      let found = false;

      while (!found) {
        if (c + spanC > cols) {
          r++;
          c = 0;
          continue;
        }
        let isFree = true;
        for (let i = 0; i < spanR; i++) {
          for (let j = 0; j < spanC; j++) {
            if (occupied.has(`${r + i},${c + j}`)) {
              isFree = false;
              break;
            }
          }
          if (!isFree) break;
        }
        if (isFree) {
          found = true;
          for (let i = 0; i < spanR; i++) {
            for (let j = 0; j < spanC; j++) {
              occupied.add(`${r + i},${c + j}`);
            }
          }
        } else {
          c++;
        }
      }

      return {
        ...panel,
        x: margin + c * (colWidth + gap),
        y: margin + r * (rowHeight + gap),
        w: spanC * colWidth + (spanC - 1) * gap,
        h: spanR * rowHeight + (spanR - 1) * gap
      };
    });
  }, []);

  const compressImage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);
          const maxDim = 1200;
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h *= maxDim / w; w = maxDim; }
          else if (h > maxDim) { w *= maxDim / h; h = maxDim; }
          canvas.width = w; canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleBatchUpdate = useCallback((currentPanels: FigurePanel[], pId: string, id: string, updates: any, type: 'text' | 'shape', isBatch: boolean = false) => {
    return currentPanels.map(p => {
      if (!isBatch && p.id !== pId) return p;
      if (type === 'text') {
        return { ...p, texts: p.texts?.map(t => (isBatch || t.id === id) ? { ...t, ...updates } : t) };
      } else {
        return { ...p, shapes: p.shapes?.map(s => (isBatch || s.id === id) ? { ...s, ...updates } : s) };
      }
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = 0.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      setCanvasScale(prev => Math.min(Math.max(prev + direction * zoomFactor, 0.2), 3));
    } else {
      setPan(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  }, []);

  const handleLoadSaved = useCallback((item: SavedFigureAssembly) => {
    setPanels(item.panels);
    setLayoutConfig(item.layoutConfig);
    setShowLibrary(false);
    showToast({ message: `已加载: ${item.title}`, type: 'info' });
  }, [showToast]);

  const handleDeleteSaved = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedAssemblies(prev => prev.filter(s => s.id !== id));
  }, []);

  const handleRenameSaved = useCallback((id: string, newTitle: string) => {
    setSavedAssemblies(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  }, []);

  const handleSaveConfirm = useCallback(() => {
    if (!saveTitle.trim()) return;
    const newSave: SavedFigureAssembly = {
      id: Date.now().toString(),
      title: saveTitle,
      timestamp: new Date().toLocaleString(),
      panels: JSON.parse(JSON.stringify(panels)),
      layoutConfig: { ...layoutConfig }
    };
    setSavedAssemblies(prev => [newSave, ...prev]);
    setShowSaveModal(false);
    setSaveTitle('');
    showToast({ message: "拼版方案已存入库", type: 'success' });
  }, [panels, layoutConfig, saveTitle, showToast]);

  const handleDeleteLocalAsset = useCallback((id: string) => {
    setLocalAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  // ─── Layer Management Functions ───────────────────────────────────────────
  const [showLayerPanel, setShowLayerPanel] = useState(true);

  /** Update panel-level layer properties (visible, locked, opacity, name, zIndex) */
  const handleUpdatePanelLayer = useCallback((panelId: string, updates: Partial<FigurePanel>) => {
    setPanels(prev => prev.map(p => p.id === panelId ? { ...p, ...updates } : p));
  }, []);

  /** Update text layer properties within a panel */
  const handleUpdateTextLayer = useCallback((panelId: string, textId: string, updates: Partial<FigureText>) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, texts: p.texts.map(t => t.id === textId ? { ...t, ...updates } : t) }
        : p
    ));
  }, []);

  /** Update shape layer properties within a panel */
  const handleUpdateShapeLayer = useCallback((panelId: string, shapeId: string, updates: Partial<FigureShape>) => {
    setPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, shapes: p.shapes.map(s => s.id === shapeId ? { ...s, ...updates } : s) }
        : p
    ));
  }, []);

  /** Reorder panels by dragging in the layer panel — receives the fully reordered array */
  const handleReorderPanelsByZIndex = useCallback((reorderedPanels: FigurePanel[]) => {
    recordState(reorderedPanels);
  }, [recordState]);

  /** Assign initial zIndex to newly added panels */
  const getNextZIndex = useCallback(() => {
    if (panels.length === 0) return 1;
    return Math.max(...panels.map(p => p.zIndex ?? 0)) + 1;
  }, [panels]);

  const handleSaveToLibrary = useCallback(async () => {
    if (panels.length === 0) {
      showToast({ message: "拼版画布为空，无法保存", type: 'info' });
      return;
    }
    setShowSaveModal(true);
    setSaveTitle('正在 AI 智能命名...');
    setIsNamingAI(true);

    try {
      // 提取面板中的文字作为命名的上下文
      const panelContext = panels.map(p => {
        const texts = p.texts?.map(t => t.content).join(' ') || '';
        return `Panel: ${texts}`;
      }).join('; ');
      const aiTitle = await generateFigureTitleAI(panelContext || "空白科研拼版", '科研成果拼版');
      setSaveTitle(aiTitle);
    } catch (e) {
      setSaveTitle(`拼版方案_${new Date().toLocaleDateString()}`);
    } finally {
      setIsNamingAI(false);
    }
  }, [panels, showToast]);

  return {
    panels, setPanels, layoutConfig, setLayoutConfig, cellAspectRatio, setCellAspectRatio, imageFit, setImageFit,
    localAssets, setLocalAssets, canvasScale, setCanvasScale, pan, setPan, historyIndex, canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1,
    undo, redo, recordState, calculateLayout,
    showGrid, setShowGrid, activePanelId, setActivePanelId, showReorderModal, setShowReorderModal,
    isProcessingUpload, setIsProcessingUpload, defaultTextStyle, setDefaultTextStyle,
    defaultLabelStyle, setDefaultLabelStyle, clipboard, setClipboard,
    handleBatchUpdate, isDragging, setIsDragging, dragOffset, setDragOffset,
    isPanning, setIsPanning, panStart, setPanStart, containerRef, canvasRef,
    savedAssemblies, setSavedAssemblies, showLibrary, setShowLibrary,
    showSaveModal, setShowSaveModal, saveTitle, setSaveTitle,
    editingText, setEditingText, selectedText, setSelectedText, selectedShape, setSelectedShape,
    textDragState, setTextDragState, shapeDragState, setShapeDragState, compressImage,
    handleWheel, handleLoadSaved, handleDeleteSaved, handleRenameSaved, handleSaveConfirm, handleDeleteLocalAsset, handleSaveToLibrary,
    // Layer system
    showLayerPanel, setShowLayerPanel,
    handleUpdatePanelLayer, handleUpdateTextLayer, handleUpdateShapeLayer,
    handleReorderPanelsByZIndex, getNextZIndex,
  };

};
