import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useMindMapDesigner } from '../../../hooks/useMindMapDesigner';
import { MindMapNode, MindMapLayer, MindMapConnection, MindMapNodeShape } from './types';
import { applySimpleLayout } from '../../../utils/elkLayout';

interface MindMapCanvasProps {
  logic: ReturnType<typeof useMindMapDesigner>;
}

/** 根据节点形状计算样式 */
function getShapeStyle(shape?: MindMapNodeShape): React.CSSProperties {
  switch (shape) {
    case 'pill': return { borderRadius: 999 };
    case 'circle': return { borderRadius: '50%' };
    case 'diamond': return { borderRadius: 8, transform: 'rotate(45deg)', overflow: 'hidden' };
    case 'rounded': return { borderRadius: 16 };
    case 'rect': return { borderRadius: 4 };
    default: return { borderRadius: 8 };
  }
}

/**
 * 计算节点的绝对 Y 坐标（基于层在画布中的累计偏移）
 */
function getLayerTop(layers: MindMapLayer[], layerIdx: number, layerGap: number): number {
  let top = 0;
  for (let i = 0; i < layerIdx; i++) {
    top += layers[i].height + layerGap;
  }
  return top;
}

/** 查找节点所在层的索引 */
function findNodeLayerIdx(layers: MindMapLayer[], nodeId: string): number {
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].nodes.some(n => n.id === nodeId)) return i;
  }
  return -1;
}

/** 获取节点绝对位置及尺寸 */
// 左侧更宽：容纳时间轴列(0-28px) + 侧边标注列(35-90px)
const LAYER_INSET_LEFT = 95;
const LAYER_INSET_RIGHT = 55;

function getNodeAbsolutePos(layers: MindMapLayer[], nodeId: string, layerGap: number): { cx: number; cy: number; w: number; h: number } | null {
  const lIdx = findNodeLayerIdx(layers, nodeId);
  if (lIdx < 0) return null;
  const node = layers[lIdx].nodes.find(n => n.id === nodeId);
  if (!node) return null;
  const layerTop = getLayerTop(layers, lIdx, layerGap);
  const w = node.width || 160;
  const h = node.height || 50;
  return {
    cx: LAYER_INSET_LEFT + node.x + w / 2,
    cy: layerTop + node.y + h / 2,
    w, h,
  };
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({ logic }) => {
  const {
    data, zoom, setZoom, pan, setPan, containerRef,
    selectedNodeId, setSelectedNodeId,
    selectedLayerId, setSelectedLayerId,
    updateNode, updateNodeSilent, commitNodeDrag,
    updateConnection, updateLayer, updateTimeline,
    deleteNode, deleteConnection,
    undo, redo, canUndo, canRedo,
    setData, autoLayout,
  } = logic;

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingConnLabelId, setEditingConnLabelId] = useState<string | null>(null);
  const [editingConnLabel, setEditingConnLabel] = useState('');
  // 时间轴标签原地编辑
  const [editingTimelineIdx, setEditingTimelineIdx] = useState<number | null>(null);
  const [editingTimelineLabel, setEditingTimelineLabel] = useState('');
  // 侧边标注原地编辑 (key = "layerId_annIdx")
  const [editingSideAnnKey, setEditingSideAnnKey] = useState<string | null>(null);
  const [editingSideAnnText, setEditingSideAnnText] = useState('');

  // 动态测量容器宽度
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        // 减去 padding (p-6 = 24px * 2 = 48px)
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setMeasuredWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 当测量到容器宽度后，同步到 data 并重新布局
  useEffect(() => {
    if (!data || !measuredWidth || measuredWidth < 200) return;
    if (data.globalConfig.canvasWidth === measuredWidth) return;
    // 直接在同一帧内更新 canvasWidth + 重跑布局，无竞态
    const updated = applySimpleLayout({
      ...data,
      globalConfig: { ...data.globalConfig, canvasWidth: measuredWidth },
    });
    setData(updated);
  }, [measuredWidth, data?.globalConfig?.canvasWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  // === 平移 / 缩放 ===
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // 触控板捏合 / Ctrl+滚轮 → 缩放
      e.preventDefault();
      setZoom(z => Math.max(0.2, Math.min(3, z - e.deltaY * 0.002)));
    } else {
      // 双指滑动 / 普通滚轮 → 平移
      e.preventDefault();
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [setZoom, setPan]);

  const isDraggingRef = React.useRef(false);
  const lastPosRef = React.useRef({ x: 0, y: 0 });

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.altKey || e.button === 1) {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setPan(p => ({
        x: p.x + (e.clientX - lastPosRef.current.x),
        y: p.y + (e.clientY - lastPosRef.current.y),
      }));
      lastPosRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { isDraggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [setPan]);

  // === 节点拖拽 ===
  const dragNodeRef = React.useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.altKey) return;
    const node = data?.layers.flatMap(l => l.nodes).find(n => n.id === nodeId);
    if (!node) return;
    dragNodeRef.current = { nodeId, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragNodeRef.current) return;
      const dx = (ev.clientX - dragNodeRef.current.startX) / zoom;
      const dy = (ev.clientY - dragNodeRef.current.startY) / zoom;
      updateNodeSilent(dragNodeRef.current.nodeId, {
        x: Math.max(0, dragNodeRef.current.origX + dx),
        y: Math.max(0, dragNodeRef.current.origY + dy),
      });
    };
    const onUp = () => {
      if (dragNodeRef.current) {
        commitNodeDrag();
      }
      dragNodeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [data, zoom, updateNodeSilent, commitNodeDrag]);

  // === 双击编辑 ===
  const handleNodeDoubleClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = data?.layers.flatMap(l => l.nodes).find(n => n.id === nodeId);
    if (!node) return;
    setEditingNodeId(nodeId);
    setEditingText(node.text);
  }, [data]);

  const handleEditingBlur = useCallback(() => {
    if (editingNodeId && editingText.trim()) {
      updateNode(editingNodeId, { text: editingText.trim() });
    }
    setEditingNodeId(null);
    setEditingText('');
  }, [editingNodeId, editingText, updateNode]);

  const handleEditingKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditingBlur();
    } else if (e.key === 'Escape') {
      setEditingNodeId(null);
      setEditingText('');
    }
  }, [handleEditingBlur]);

  // === 键盘快捷键 ===
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingNodeId) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (selectedNodeId) { e.preventDefault(); deleteNode(selectedNodeId); }
      }
      // Escape
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedLayerId(null);
        setEditingNodeId(null);
        setEditingTimelineIdx(null);
        setEditingSideAnnKey(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, selectedNodeId, editingNodeId, deleteNode, setSelectedNodeId, setSelectedLayerId]);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center">
            <i className="fa-solid fa-layer-group text-3xl text-indigo-400"></i>
          </div>
          <div>
            <p className="text-lg font-black text-slate-700">框架思维图画布</p>
            <p className="text-xs text-slate-400 mt-1">通过左侧面板使用 AI 生成或选择模板开始</p>
          </div>
        </div>
      </div>
    );
  }

  const { layers, connections, globalConfig } = data;
  const totalHeight = layers.reduce((sum, l) => sum + l.height, 0) + (layers.length - 1) * globalConfig.layerGap + 100;

  return (
    <div className="flex-1 bg-transparent relative flex flex-col overflow-hidden group">
      {/* Floating Undo/Redo */}
      <div className="absolute top-6 left-6 z-[100] flex items-center gap-2 no-print">
        <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
          <button onClick={undo} disabled={!canUndo} className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 transition-colors" title="撤销">
            <i className="fa-solid fa-rotate-left text-xs mb-0.5"></i>
            <span className="text-[7px] font-black uppercase">Undo</span>
          </button>
          <div className="w-px h-6 bg-slate-100 mx-1"></div>
          <button onClick={redo} disabled={!canRedo} className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 transition-colors" title="重做">
            <i className="fa-solid fa-rotate-right text-xs mb-0.5"></i>
            <span className="text-[7px] font-black uppercase">Redo</span>
          </button>
        </div>
      </div>

      {/* Floating Zoom Controls */}
      <div className="absolute top-6 right-6 z-[100] flex items-center gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors" title="缩小">
            <i className="fa-solid fa-minus text-[10px]"></i>
          </button>
          <div className="w-px h-4 bg-slate-100 mx-1"></div>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="flex flex-col items-center justify-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all" title="复位">
            <span className="text-[11px] font-black text-slate-800 font-mono">{Math.round(zoom * 100)}%</span>
            <i className="fa-solid fa-compress text-[8px] text-indigo-400 mt-0.5"></i>
          </button>
          <div className="w-px h-4 bg-slate-100 mx-1"></div>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors" title="放大">
            <i className="fa-solid fa-plus text-[10px]"></i>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={wrapperRef}
        className="flex-1 overflow-hidden p-6 cursor-grab active:cursor-grabbing relative"
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onClick={() => { setSelectedNodeId(null); setSelectedLayerId(null); }}
      >
        <div className="w-full h-full flex items-start justify-center">
          <div
            ref={containerRef}
            className="relative origin-top"
            style={{
              width: measuredWidth || globalConfig.canvasWidth,
              minHeight: totalHeight,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              fontFamily: globalConfig.globalFontFamily || globalConfig.fontFamily,
              willChange: 'transform',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #6366f1 1px, transparent 0)', backgroundSize: '40px 40px' }} />

            {/* 顶部标题 */}
            {data.caption && (
              <div className="text-center pointer-events-none" style={{
                position: 'relative',
                fontSize: 14,
                fontWeight: 600,
                color: '#475569',
                letterSpacing: '0.05em',
                padding: '8px 0 4px',
                marginBottom: -10,
              }}>
                {data.caption}
              </div>
            )}

            {/* Timeline — 左侧时间轴（窄列 0-28px） */}
            {data.timeline && data.timeline.length > 0 && (
              <div className="absolute" style={{ left: 0, top: 0, width: 28, height: totalHeight }}>
                {/* 竖线 */}
                <div className="absolute pointer-events-none" style={{ left: 13, top: 0, width: 2, height: '100%', background: 'linear-gradient(to bottom, #94a3b8, #cbd5e1)', borderRadius: 1 }} />
                {/* 阶段标签 */}
                {data.timeline.map((phase, pIdx) => {
                  const fromTop = getLayerTop(layers, phase.fromLayer, globalConfig.layerGap);
                  const toBottom = getLayerTop(layers, Math.min(phase.toLayer, layers.length - 1), globalConfig.layerGap)
                    + (layers[Math.min(phase.toLayer, layers.length - 1)]?.height || 120);
                  const midY = (fromTop + toBottom) / 2;
                  const isEditingThis = editingTimelineIdx === pIdx;
                  return (
                    <React.Fragment key={pIdx}>
                      <div className="absolute flex items-center justify-center cursor-pointer hover:opacity-100 transition-opacity" style={{
                        left: 0, top: midY, transform: 'translateY(-50%)',
                        writingMode: 'vertical-rl', textOrientation: 'mixed',
                        fontSize: phase.fontSize ?? globalConfig.timelineStyle?.fontSize ?? 11,
                        fontWeight: Number(phase.fontWeight ?? globalConfig.timelineStyle?.fontWeight ?? '800'),
                        fontFamily: phase.fontFamily ?? globalConfig.timelineStyle?.fontFamily ?? 'inherit',
                        fontStyle: phase.fontStyle ?? globalConfig.timelineStyle?.fontStyle ?? 'normal',
                        letterSpacing: globalConfig.timelineStyle?.letterSpacing ?? '0.15em',
                        color: phase.color ?? globalConfig.timelineStyle?.color ?? '#475569',
                        whiteSpace: 'nowrap',
                      }}
                        onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layers[phase.fromLayer]?.id || null); setSelectedNodeId(null); }}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTimelineIdx(pIdx); setEditingTimelineLabel(phase.label); }}
                        title="双击编辑 · 单击选中层"
                      >
                        {phase.label}
                      </div>
                      {/* 弹出式水平编辑框 */}
                      {isEditingThis && (
                        <div
                          className="absolute z-50"
                          style={{ left: 32, top: midY, transform: 'translateY(-50%)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white rounded-xl shadow-2xl border border-indigo-200 p-2 flex items-center gap-2" style={{ minWidth: 160 }}>
                            <input
                              autoFocus
                              value={editingTimelineLabel}
                              onChange={(e) => setEditingTimelineLabel(e.target.value)}
                              onBlur={() => {
                                if (editingTimelineLabel.trim()) updateTimeline(pIdx, { label: editingTimelineLabel.trim() });
                                setEditingTimelineIdx(null);
                              }}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') { e.preventDefault(); if (editingTimelineLabel.trim()) updateTimeline(pIdx, { label: editingTimelineLabel.trim() }); setEditingTimelineIdx(null); }
                                if (e.key === 'Escape') { setEditingTimelineIdx(null); }
                              }}
                              className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                              style={{ color: phase.color || '#475569' }}
                              placeholder="输入标签..."
                            />
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (editingTimelineLabel.trim()) updateTimeline(pIdx, { label: editingTimelineLabel.trim() });
                                setEditingTimelineIdx(null);
                              }}
                              className="w-7 h-7 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
                            >
                              <i className="fa-solid fa-check text-[9px]"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Render Layers */}
            {layers.map((layer, lIdx) => {
              const layerTop = getLayerTop(layers, lIdx, globalConfig.layerGap);
              const isSelected = selectedLayerId === layer.id;

              return (
                <React.Fragment key={layer.id}>
                  {/* Layer Container */}
                  <div
                    className={`absolute rounded-xl transition-all ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
                    style={{
                      left: LAYER_INSET_LEFT,
                      right: LAYER_INSET_RIGHT,
                      top: layerTop,
                      height: layer.height,
                      backgroundColor: layer.backgroundColor || '#f8fafc',
                      borderWidth: layer.borderStyle === 'none' ? 0 : (layer.borderWidth ?? 1.5),
                      borderStyle: layer.borderStyle === 'double' ? 'double' : (layer.borderStyle || 'dashed'),
                      borderColor: layer.borderColor || 'rgba(0,0,0,0.08)',
                      boxShadow: '0 1px 8px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06)',
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); setSelectedNodeId(null); }}
                  >
                    {/* Layer Title */}
                    <div
                      className="absolute -top-3.5 left-6 px-4 py-1 rounded-full shadow-sm"
                      style={{
                        fontSize: layer.titleFontSize || 11,
                        fontWeight: Number(layer.titleFontWeight || 900),
                        color: layer.titleColor || '#475569',
                        fontFamily: layer.titleFontFamily || 'inherit',
                        letterSpacing: '0.08em',
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {layer.title}
                    </div>

                    {/* Nodes inside Layer */}
                    {layer.nodes.map(node => {
                      const isNodeSelected = selectedNodeId === node.id;
                      const isEditing = editingNodeId === node.id;
                      const shapeStyle = getShapeStyle(node.shape);
                      const isDiamond = node.shape === 'diamond';
                      return (
                        <div
                          key={node.id}
                          className={`absolute cursor-move flex items-center justify-center text-center select-none transition-all duration-150 ${isNodeSelected ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                          style={{
                            left: node.x,
                            top: node.y,
                            width: node.width || 160,
                            height: node.height || 55,
                            backgroundColor: node.backgroundColor || '#2980B9',
                            color: node.textColor || '#ffffff',
                            fontSize: node.fontSize || 14,
                            fontWeight: node.fontWeight || '700',
                            fontFamily: node.fontFamily || 'inherit',
                            fontStyle: node.fontStyle || 'normal',
                            textAlign: node.textAlign || 'center',
                            borderWidth: node.borderWidth || 1,
                            borderColor: node.borderColor || 'rgba(255,255,255,0.15)',
                            borderStyle: node.borderStyle || 'solid',
                            opacity: node.opacity ?? 1,
                            boxShadow: isNodeSelected
                              ? '0 8px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)'
                              : '0 3px 12px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
                            ...shapeStyle,
                          }}
                          onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                          onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); setSelectedLayerId(null); }}
                          onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
                        >
                          <div className="px-3 w-full" style={{
                            overflow: 'hidden',
                            ...(isDiamond ? { transform: 'rotate(-45deg)' } : {}),
                          }}>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onBlur={handleEditingBlur}
                                onKeyDown={handleEditingKeyDown}
                                className="bg-transparent border-none outline-none text-center w-full font-bold"
                                style={{ color: 'inherit', fontSize: 'inherit' }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <>
                                {node.icon && (
                                  <div className="mb-0.5" style={{ fontSize: (node.fontSize || 14) * 0.85 }}>
                                    <i className={`fa-solid ${node.icon}`}></i>
                                  </div>
                                )}
                                <div className="leading-tight truncate" style={{ textAlign: node.textAlign || 'center' }}>{node.text}</div>
                                {node.subText && (
                                  <div className="mt-0.5 truncate" style={{
                                    fontSize: node.subTextFontSize || 10,
                                    fontWeight: node.subTextFontWeight || '400',
                                    color: node.subTextColor || 'inherit',
                                    opacity: node.subTextColor ? 1 : 0.7,
                                    letterSpacing: '0.02em',
                                    textAlign: node.textAlign || 'center',
                                  }}>{node.subText}</div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Side Annotations */}
                    {layer.sideAnnotations?.map((ann, aIdx) => {
                      const annKey = `${layer.id}_${aIdx}`;
                      const isEditingAnn = editingSideAnnKey === annKey;
                      return (
                        <React.Fragment key={aIdx}>
                          <div
                            className="absolute flex items-center cursor-pointer hover:opacity-100 transition-opacity"
                            style={{
                              ...(ann.position === 'right'
                                ? { right: -LAYER_INSET_RIGHT + 5, top: '50%', transform: 'translateY(-50%)' }
                                : { left: -65, top: '50%', transform: 'translateY(-50%)' }),
                              writingMode: 'vertical-rl',
                              textOrientation: 'mixed',
                              fontSize: ann.fontSize ?? globalConfig.sideAnnotationStyle?.fontSize ?? 13,
                              fontWeight: ann.fontWeight ?? globalConfig.sideAnnotationStyle?.fontWeight ?? '800',
                              fontFamily: ann.fontFamily ?? globalConfig.sideAnnotationStyle?.fontFamily ?? 'inherit',
                              fontStyle: ann.fontStyle ?? globalConfig.sideAnnotationStyle?.fontStyle ?? 'normal',
                              color: ann.color ?? globalConfig.sideAnnotationStyle?.color ?? '#475569',
                              letterSpacing: globalConfig.sideAnnotationStyle?.letterSpacing ?? '0.15em',
                              padding: '6px 3px',
                              borderRadius: 4,
                              opacity: 0.9,
                            }}
                            onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id); setSelectedNodeId(null); }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingSideAnnKey(annKey);
                              setEditingSideAnnText(ann.text);
                            }}
                            title="双击编辑 · 单击选中层"
                          >
                            {ann.text}
                          </div>
                          {/* 弹出式水平编辑框 */}
                          {isEditingAnn && (
                            <div
                              className="absolute z-50"
                              style={{
                                ...(ann.position === 'right'
                                  ? { right: -LAYER_INSET_RIGHT - 140, top: '50%', transform: 'translateY(-50%)' }
                                  : { left: -60, top: '50%', transform: 'translateY(-50%)' }),
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="bg-white rounded-xl shadow-2xl border border-indigo-200 p-2 flex items-center gap-2" style={{ minWidth: 160 }}>
                                <input
                                  autoFocus
                                  value={editingSideAnnText}
                                  onChange={(e) => setEditingSideAnnText(e.target.value)}
                                  onBlur={() => {
                                    if (editingSideAnnText.trim()) {
                                      const anns = [...(layer.sideAnnotations || [])];
                                      anns[aIdx] = { ...anns[aIdx], text: editingSideAnnText.trim() };
                                      updateLayer(layer.id, { sideAnnotations: anns });
                                    }
                                    setEditingSideAnnKey(null);
                                  }}
                                  onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (editingSideAnnText.trim()) {
                                        const anns = [...(layer.sideAnnotations || [])];
                                        anns[aIdx] = { ...anns[aIdx], text: editingSideAnnText.trim() };
                                        updateLayer(layer.id, { sideAnnotations: anns });
                                      }
                                      setEditingSideAnnKey(null);
                                    }
                                    if (e.key === 'Escape') setEditingSideAnnKey(null);
                                  }}
                                  className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                                  style={{ color: ann.color || '#475569' }}
                                  placeholder="输入标注..."
                                />
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (editingSideAnnText.trim()) {
                                      const anns = [...(layer.sideAnnotations || [])];
                                      anns[aIdx] = { ...anns[aIdx], text: editingSideAnnText.trim() };
                                      updateLayer(layer.id, { sideAnnotations: anns });
                                    }
                                    setEditingSideAnnKey(null);
                                  }}
                                  className="w-7 h-7 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
                                >
                                  <i className="fa-solid fa-check text-[9px]"></i>
                                </button>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Separator between layers */}
                  {lIdx < layers.length - 1 && layer.separatorStyle !== 'none' && globalConfig.showSeparators && (
                    <div
                      className="absolute left-4 right-4 pointer-events-none"
                      style={{ top: layerTop + layer.height + globalConfig.layerGap / 2 - 1 }}
                    >
                      {layer.separatorStyle === 'double-line' ? (
                        <div className="space-y-1">
                          <div style={{ height: 1, backgroundColor: globalConfig.separatorColor, opacity: 0.5 }} />
                          <div style={{ height: 1, backgroundColor: globalConfig.separatorColor, opacity: 0.5 }} />
                        </div>
                      ) : layer.separatorStyle === 'arrow' ? (
                        <div className="flex items-center justify-center">
                          <div className="flex-1" style={{ height: 1, backgroundColor: globalConfig.separatorColor, opacity: 0.4 }} />
                          <i className="fa-solid fa-chevron-down text-[10px] mx-2" style={{ color: globalConfig.separatorColor, opacity: 0.6 }} />
                          <div className="flex-1" style={{ height: 1, backgroundColor: globalConfig.separatorColor, opacity: 0.4 }} />
                        </div>
                      ) : (
                        <div style={{ height: 1, backgroundColor: globalConfig.separatorColor, opacity: 0.4 }} />
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* SVG Connection Lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: globalConfig.canvasWidth, height: totalHeight, overflow: 'visible' }}
            >
              <defs>
                <marker id="mindmap-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill="#90A4AE" />
                </marker>
                {connections.map(conn => (
                  <marker
                    key={`marker-${conn.id}`}
                    id={`mindmap-arrow-${conn.id}`}
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L8,3 L0,6 Z" fill={conn.color || '#90A4AE'} />
                  </marker>
                ))}
              </defs>
              {connections.map(conn => {
                const fromPos = getNodeAbsolutePos(layers, conn.from, globalConfig.layerGap);
                const toPos = getNodeAbsolutePos(layers, conn.to, globalConfig.layerGap);
                if (!fromPos || !toPos) return null;

                const dy = toPos.cy - fromPos.cy;
                const dx = toPos.cx - fromPos.cx;
                let startX: number, startY: number, endX: number, endY: number;

                // 判断连线方向：优先垂直（跨层），否则水平（同层）
                const isCrossLayer = Math.abs(dy) > 20;
                if (isCrossLayer) {
                  // 跨层连接：从底边 → 顶边
                  // 偏移出发点：如果目标在右侧，从右下角出发；在左侧从左下角出发
                  const offsetRatio = Math.min(0.35, Math.abs(dx) / (fromPos.w * 3));
                  const xOffset = dx > 0 ? fromPos.w * offsetRatio : -fromPos.w * offsetRatio;
                  if (dy > 0) {
                    startX = fromPos.cx + xOffset; startY = fromPos.cy + fromPos.h / 2;
                    endX = toPos.cx; endY = toPos.cy - toPos.h / 2;
                  } else {
                    startX = fromPos.cx + xOffset; startY = fromPos.cy - fromPos.h / 2;
                    endX = toPos.cx; endY = toPos.cy + toPos.h / 2;
                  }
                } else {
                  // 同层连接：从右边 → 左边
                  if (dx > 0) {
                    startX = fromPos.cx + fromPos.w / 2; startY = fromPos.cy;
                    endX = toPos.cx - toPos.w / 2; endY = toPos.cy;
                  } else {
                    startX = fromPos.cx - fromPos.w / 2; startY = fromPos.cy;
                    endX = toPos.cx + toPos.w / 2; endY = toPos.cy;
                  }
                }

                // 直线连接
                const path = `M ${startX} ${startY} L ${endX} ${endY}`;

                const labelX = (startX + endX) / 2;
                const labelY = (startY + endY) / 2 - 10;

                const markerEnd = (conn.arrowType === 'forward' || conn.arrowType === 'bidirectional')
                  ? `url(#mindmap-arrow-${conn.id})` : undefined;

                return (
                  <g key={conn.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke={conn.color || '#90A4AE'}
                      strokeWidth={conn.width || 1.5}
                      strokeDasharray={conn.style === 'dashed' ? '8,4' : conn.style === 'dotted' ? '3,3' : undefined}
                      markerEnd={markerEnd}
                      opacity={0.65}
                      strokeLinecap="round"
                    />
                    {conn.label && (
                      <rect
                          x={labelX - conn.label.length * 4 - 6}
                          y={labelY - 9}
                          width={conn.label.length * 8 + 12}
                          height={18}
                          rx={9}
                          fill="rgba(255,255,255,0.88)"
                          stroke="rgba(0,0,0,0.06)"
                          strokeWidth={0.5}
                        />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* 连线标签 HTML 叠加层 —— 可点击编辑 */}
            {connections.map(conn => {
              if (!conn.label && editingConnLabelId !== conn.id) return null;
              const fromPos = getNodeAbsolutePos(layers, conn.from, globalConfig.layerGap);
              const toPos = getNodeAbsolutePos(layers, conn.to, globalConfig.layerGap);
              if (!fromPos || !toPos) return null;

              const dy = toPos.cy - fromPos.cy;
              const dx = toPos.cx - fromPos.cx;
              let startX: number, startY: number, endX: number, endY: number;
              const isCrossLayer = Math.abs(dy) > 20;
              if (isCrossLayer) {
                const offsetRatio = Math.min(0.35, Math.abs(dx) / (fromPos.w * 3));
                const xOffset = dx > 0 ? fromPos.w * offsetRatio : -fromPos.w * offsetRatio;
                if (dy > 0) { startX = fromPos.cx + xOffset; startY = fromPos.cy + fromPos.h / 2; endX = toPos.cx; endY = toPos.cy - toPos.h / 2; }
                else { startX = fromPos.cx + xOffset; startY = fromPos.cy - fromPos.h / 2; endX = toPos.cx; endY = toPos.cy + toPos.h / 2; }
              } else {
                if (dx > 0) { startX = fromPos.cx + fromPos.w / 2; startY = fromPos.cy; endX = toPos.cx - toPos.w / 2; endY = toPos.cy; }
                else { startX = fromPos.cx - fromPos.w / 2; startY = fromPos.cy; endX = toPos.cx + toPos.w / 2; endY = toPos.cy; }
              }
              const labelX = (startX + endX) / 2;
              const posOffset = conn.labelPosition === 'above' ? -18 : conn.labelPosition === 'below' ? 8 : -10;
              const labelY = (startY + endY) / 2 + posOffset;
              const isEditingThis = editingConnLabelId === conn.id;

              return (
                <div
                  key={`conn-label-${conn.id}`}
                  className="absolute"
                  style={{
                    left: labelX,
                    top: labelY,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditingThis ? (
                    <input
                      autoFocus
                      value={editingConnLabel}
                      onChange={(e) => setEditingConnLabel(e.target.value)}
                      onBlur={() => {
                        updateConnection(conn.id, { label: editingConnLabel });
                        setEditingConnLabelId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { updateConnection(conn.id, { label: editingConnLabel }); setEditingConnLabelId(null); }
                        if (e.key === 'Escape') setEditingConnLabelId(null);
                      }}
                      className="px-2 py-0.5 text-[10px] font-semibold text-center bg-white border border-indigo-300 rounded-full outline-none focus:ring-2 focus:ring-indigo-400 shadow-lg"
                      style={{ minWidth: 50, fontSize: conn.labelFontSize || 10 }}
                    />
                  ) : (
                    <div
                      className="px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-white hover:shadow-md transition-all select-none"
                      style={{
                        fontSize: conn.labelFontSize || 10,
                        fontWeight: Number(conn.labelFontWeight || 600),
                        fontFamily: conn.labelFontFamily || 'inherit',
                        color: conn.labelColor || '#64748b',
                        backgroundColor: conn.labelBgColor ? conn.labelBgColor + 'e0' : 'rgba(255,255,255,0.88)',
                        border: '0.5px solid rgba(0,0,0,0.06)',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => {
                        setEditingConnLabelId(conn.id);
                        setEditingConnLabel(conn.label || '');
                      }}
                      title="点击编辑标签"
                    >
                      {conn.label}
                    </div>
                  )}
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* HUD */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 no-print pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md px-6 py-2.5 rounded-full flex items-center gap-3 shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fa-solid fa-mouse-pointer text-indigo-400 text-xs"></i>
          <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest">
            Alt + 左键平移 | Ctrl + 滚轮缩放 | 拖拽节点移动
          </span>
        </div>
      </div>
    </div>
  );
};
