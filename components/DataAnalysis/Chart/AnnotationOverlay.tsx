import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChartAnnotation, AnnotationType, DataSeries } from '../../../types';
import LaTeXText from '../../Common/LaTeXText';
import { ColorPickerWithPresets } from './ColorPickerWithPresets';

interface AnnotationOverlayProps {
  annotations: ChartAnnotation[];
  seriesList: DataSeries[];
  activeTool: AnnotationType | 'select' | 'none';
  onAddAnnotation: (ann: ChartAnnotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<ChartAnnotation>) => void;
  onRemoveAnnotation: (id: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const FONT_FAMILIES = [
  { name: 'Sans', value: 'Arial, sans-serif' },
  { name: 'Serif', value: '"Times New Roman", Times, serif' },
  { name: 'Mono', value: '"Courier New", Courier, monospace' }
];

// Helper Component for inputs (handles decimals, empty states, and scroll wheel)
const BufferedNumberInput = ({ value, onUpdate, className, placeholder }: { value: number; onUpdate: (val: number) => void; className?: string; placeholder?: string }) => {
  const [localVal, setLocalVal] = useState(value === 0 ? '' : value.toString());

  useEffect(() => {
    const numLocal = parseFloat(localVal);
    if (numLocal !== value && !(localVal === '' && value === 0)) {
      setLocalVal(value === 0 ? '' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      onUpdate(parsed);
    } else if (newVal === '') {
      onUpdate(0);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (document.activeElement === e.currentTarget) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      onUpdate(value + delta);
    }
  };

  return (
    <input
      type="number"
      className={className}
      value={localVal}
      onChange={handleChange}
      onWheel={handleWheel}
      placeholder={placeholder}
      step="1"
    />
  );
};

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  annotations, seriesList, activeTool, onAddAnnotation, onUpdateAnnotation, onRemoveAnnotation, containerRef
}) => {
  // Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStart, setCurrentStart] = useState({ x: 0, y: 0 });
  const [currentEnd, setCurrentEnd] = useState({ x: 0, y: 0 });

  // Dragging State
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<'body' | 'p1' | 'p2' | null>(null);
  const [dragOffset, setDragOffset] = useState({ x1: 0, y1: 0, x2: 0, y2: 0 });

  // HUD Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPropertyHud, setShowPropertyHud] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const isToolActive = useMemo(() => activeTool !== 'none' && activeTool !== 'select', [activeTool]);

  const documentColors = useMemo(() => {
    const colors = new Set<string>();
    seriesList.forEach(s => {
      if (s.color) colors.add(s.color.toLowerCase());
      if (s.pointColor) colors.add(s.pointColor.toLowerCase());
      if (s.errorBarColor) colors.add(s.errorBarColor.toLowerCase());
    });
    return Array.from(colors);
  }, [seriesList]);

  const getCoords = (e: React.MouseEvent | MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  /**
   * 修复后的捕捉算法：考虑容器像素比例
   */
  const getSnappedCoords = (start: { x: number, y: number }, current: { x: number, y: number }, tool: string, rect: DOMRect) => {
    const dx = current.x - start.x; // %
    const dy = current.y - start.y; // %

    // 转换为像素空间进行距离计算，确保真正的 1:1
    const pxDx = (dx / 100) * rect.width;
    const pxDy = (dy / 100) * rect.height;
    const absPxDx = Math.abs(pxDx);
    const absPxDy = Math.abs(pxDy);

    if (tool === 'line' || tool === 'arrow') {
      // 直线吸附：判断水平还是垂直
      if (absPxDx > absPxDy) return { x: current.x, y: start.y };
      return { x: start.x, y: current.y };
    } else if (tool === 'rect' || tool === 'circle') {
      // 矩形/圆形吸附：保持像素级的边长一致，再转换回百分比
      const maxPx = Math.max(absPxDx, absPxDy);
      const relX = (maxPx / rect.width) * 100;
      const relY = (maxPx / rect.height) * 100;

      return {
        x: start.x + (dx >= 0 ? relX : -relX),
        y: start.y + (dy >= 0 ? relY : -relY)
      };
    }
    return current;
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragTargetId && !isDrawing) return;

      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;

      let coords = getCoords(e);

      if (isDrawing) {
        if (e.shiftKey) {
          coords = getSnappedCoords(currentStart, coords, activeTool, rect);
        }
        setCurrentEnd(coords);
      } else if (dragTargetId) {
        const target = annotations.find(a => a.id === dragTargetId);
        if (dragMode === 'body') {
          onUpdateAnnotation(dragTargetId, {
            x1: coords.x - dragOffset.x1,
            y1: coords.y - dragOffset.y1,
            x2: coords.x - dragOffset.x2,
            y2: coords.y - dragOffset.y2
          });
        } else if (dragMode === 'p1' && target) {
          if (e.shiftKey) coords = getSnappedCoords({ x: target.x2, y: target.y2 }, coords, target.type, rect);
          onUpdateAnnotation(dragTargetId, { x1: coords.x, y1: coords.y });
        } else if (dragMode === 'p2' && target) {
          if (e.shiftKey) coords = getSnappedCoords({ x: target.x1, y: target.y1 }, coords, target.type, rect);
          onUpdateAnnotation(dragTargetId, { x2: coords.x, y2: coords.y });
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (isDrawing) {
        const rect = svgRef.current?.getBoundingClientRect();
        let coords = getCoords(e);
        if (e.shiftKey && rect) {
          coords = getSnappedCoords(currentStart, coords, activeTool, rect);
        }

        const dist = Math.hypot(coords.x - currentStart.x, coords.y - currentStart.y);
        const isText = activeTool === 'text';

        if (activeTool !== 'none' && activeTool !== 'select' && (isText || dist > 0.5)) {
          const newAnn: ChartAnnotation = {
            id: Date.now().toString(),
            type: activeTool as AnnotationType,
            x1: currentStart.x,
            y1: currentStart.y,
            x2: coords.x,
            y2: isText ? currentStart.y : coords.y,
            color: '#4f46e5',
            strokeWidth: 2,
            fontSize: 14,
            dashStyle: 'solid',
            headStyle: activeTool === 'arrow' ? 'solid' : 'none',
            fontWeight: 'bold',
            fontStyle: 'normal',
            fontFamily: 'Arial, sans-serif',
            text: activeTool === 'text' ? 'New Annotation' : undefined
          };
          onAddAnnotation(newAnn);
          setEditingId(newAnn.id);
          setShowPropertyHud(true);
        }
        setIsDrawing(false);
      }
      setDragTargetId(null);
      setDragMode(null);
    };

    if (dragTargetId || isDrawing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragTargetId, isDrawing, dragMode, dragOffset, currentStart, activeTool, onAddAnnotation, onUpdateAnnotation, annotations]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.property-hud')) return;

    const coords = getCoords(e);

    // 1. Check for Handle Hits
    if (editingId) {
      const selected = annotations.find(a => a.id === editingId);
      if (selected && selected.type !== 'text') {
        const handleThreshold = 3.0;
        const d1 = Math.hypot(coords.x - selected.x1, coords.y - selected.y1);
        const d2 = Math.hypot(coords.x - selected.x2, coords.y - selected.y2);

        if (d1 < handleThreshold) {
          setDragTargetId(selected.id);
          setDragMode('p1');
          setShowPropertyHud(false);
          e.stopPropagation();
          return;
        }
        if (d2 < handleThreshold) {
          setDragTargetId(selected.id);
          setDragMode('p2');
          setShowPropertyHud(false);
          e.stopPropagation();
          return;
        }
      }
    }

    // 2. Check for Body Hits
    const hit = [...annotations].reverse().find(ann => {
      let minX = Math.min(ann.x1, ann.x2);
      let maxX = Math.max(ann.x1, ann.x2);
      let minY = Math.min(ann.y1, ann.y2);
      let maxY = Math.max(ann.y1, ann.y2);

      if (ann.type === 'text') {
        const textLen = (ann.text || '').length || 8;
        const charW = (ann.fontSize || 12) * 0.08;
        const charH = (ann.fontSize || 12) * 0.15;
        maxX = ann.x1 + (textLen * charW);
        minY = ann.y1 - charH;
        maxY = ann.y1 + 1.5;
      }

      const padding = 2.0;
      return coords.x >= minX - padding && coords.x <= maxX + padding && coords.y >= minY - padding && coords.y <= maxY + padding;
    });

    if (hit) {
      setDragTargetId(hit.id);
      setEditingId(hit.id);
      setDragMode('body');
      setDragOffset({
        x1: coords.x - hit.x1,
        y1: coords.y - hit.y1,
        x2: coords.x - hit.x2,
        y2: coords.y - hit.y2
      });
      e.stopPropagation();
      return;
    }

    if (isToolActive) {
      setIsDrawing(true);
      setCurrentStart(coords);
      setCurrentEnd(coords);
      e.stopPropagation();
    } else {
      if (editingId) {
        setEditingId(null);
        setShowPropertyHud(false);
      }
    }
  };

  const handleDoubleClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setShowPropertyHud(true);
  };

  const selectedAnn = useMemo(() => annotations.find(a => a.id === editingId), [annotations, editingId]);

  const hudStyle = useMemo(() => {
    if (!selectedAnn) return {};
    const avgY = (selectedAnn.y1 + selectedAnn.y2) / 2;
    const isTopHalf = avgY < 50;
    const centerX = (selectedAnn.x1 + selectedAnn.x2) / 2;
    const margin = 8;
    if (isTopHalf) {
      const maxY = Math.max(selectedAnn.y1, selectedAnn.y2);
      return { left: `${centerX}%`, top: `${maxY + margin}%`, transform: 'translateX(-50%)' };
    } else {
      const minY = Math.min(selectedAnn.y1, selectedAnn.y2);
      return { left: `${centerX}%`, top: `${minY - margin}%`, transform: 'translate(-50%, -100%)' };
    }
  }, [selectedAnn]);

  const isAnyDragging = !!dragTargetId || isDrawing;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full ${isAnyDragging ? 'cursor-grabbing' : (isToolActive ? 'cursor-crosshair' : 'cursor-default')}`}
        onMouseDown={handleMouseDown}
        style={{ pointerEvents: isToolActive || editingId ? 'auto' : 'none' }}
      >
        <defs>
          {annotations.map(ann => (
            <React.Fragment key={`def-${ann.id}`}>
              <marker id={`arrowhead-${ann.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={ann.color} />
              </marker>
              <marker id={`arrowhead-open-${ann.id}`} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={ann.color} strokeWidth="1.5" />
              </marker>
            </React.Fragment>
          ))}
          <filter id="handle-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {isToolActive && (
          <rect
            width="100%" height="100%"
            fill="white"
            fillOpacity="0"
            className="pointer-events-auto"
          />
        )}

        {annotations.map(ann => {
          const isSelected = editingId === ann.id;
          const strokeDash = ann.dashStyle === 'dashed' ? '5,5' : ann.dashStyle === 'dotted' ? '2,2' : 'none';
          const markerEnd = ann.type === 'arrow' ? (ann.headStyle === 'open' ? `url(#arrowhead-open-${ann.id})` : `url(#arrowhead-${ann.id})`) : 'none';

          return (
            <g
              key={ann.id}
              className="group/ann pointer-events-auto"
              onDoubleClick={(e) => handleDoubleClick(ann.id, e)}
              style={{ cursor: isToolActive ? 'crosshair' : 'move' }}
            >
              {(ann.type === 'line' || ann.type === 'arrow') && (
                <line x1={`${ann.x1}%`} y1={`${ann.y1}%`} x2={`${ann.x2}%`} y2={`${ann.y2}%`} stroke="transparent" strokeWidth="15" />
              )}
              {ann.type === 'text' && (
                <rect
                  x={`${ann.x1}%`} y={`${ann.y1 - 4}%`}
                  width="15%" height="6%"
                  fill="transparent"
                />
              )}

              {ann.type === 'line' && (
                <line x1={`${ann.x1}%`} y1={`${ann.y1}%`} x2={`${ann.x2}%`} y2={`${ann.y2}%`} stroke={ann.color} strokeWidth={ann.strokeWidth} strokeDasharray={strokeDash} />
              )}
              {ann.type === 'arrow' && (
                <line x1={`${ann.x1}%`} y1={`${ann.y1}%`} x2={`${ann.x2}%`} y2={`${ann.y2}%`} stroke={ann.color} strokeWidth={ann.strokeWidth} strokeDasharray={strokeDash} markerEnd={markerEnd} />
              )}
              {ann.type === 'rect' && (
                <rect
                  x={`${Math.min(ann.x1, ann.x2)}%`}
                  y={`${Math.min(ann.y1, ann.y2)}%`}
                  width={`${Math.abs(ann.x2 - ann.x1)}%`}
                  height={`${Math.abs(ann.y2 - ann.y1)}%`}
                  fill="none" stroke={ann.color} strokeWidth={ann.strokeWidth} strokeDasharray={strokeDash}
                />
              )}
              {ann.type === 'circle' && (
                <ellipse
                  cx={`${(ann.x1 + ann.x2) / 2}%`}
                  cy={`${(ann.y1 + ann.y2) / 2}%`}
                  rx={`${Math.abs(ann.x2 - ann.x1) / 2}%`}
                  ry={`${Math.abs(ann.y2 - ann.y1) / 2}%`}
                  fill="none" stroke={ann.color} strokeWidth={ann.strokeWidth} strokeDasharray={strokeDash}
                />
              )}
              {ann.type === 'text' && (
                <foreignObject
                  x={`${ann.x1}%`} y={`${ann.y1 - 5}%`}
                  width="100%" height="40%"
                  style={{ overflow: 'visible', pointerEvents: 'none' }}
                >
                  <div
                    style={{
                      color: ann.color,
                      fontSize: `${ann.fontSize}px`,
                      fontWeight: ann.fontWeight,
                      fontStyle: ann.fontStyle,
                      fontFamily: ann.fontFamily,
                      whiteSpace: 'nowrap',
                      lineHeight: 1
                    }}
                  >
                    <LaTeXText text={ann.text || ''} />
                  </div>
                </foreignObject>
              )}

              {isSelected && (
                <g className="pointer-events-auto">
                  {ann.type !== 'text' && (
                    <>
                      <circle
                        cx={`${ann.x1}%`} cy={`${ann.y1}%`} r="5"
                        fill="white" stroke="#4f46e5" strokeWidth="1.5"
                        className="cursor-nwse-resize hover:scale-125 transition-transform"
                        filter="url(#handle-glow)"
                      />
                      <circle
                        cx={`${ann.x2}%`} cy={`${ann.y2}%`} r="5"
                        fill="white" stroke="#4f46e5" strokeWidth="1.5"
                        className="cursor-nwse-resize hover:scale-125 transition-transform"
                        filter="url(#handle-glow)"
                      />
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {isDrawing && (
          <g opacity="0.5" pointerEvents="none">
            {activeTool === 'line' && <line x1={`${currentStart.x}%`} y1={`${currentStart.y}%`} x2={`${currentEnd.x}%`} y2={`${currentEnd.y}%`} stroke="#4f46e5" strokeWidth="2" />}
            {activeTool === 'arrow' && <line x1={`${currentStart.x}%`} y1={`${currentStart.y}%`} x2={`${currentEnd.x}%`} y2={`${currentEnd.y}%`} stroke="#4f46e5" strokeWidth="2" markerEnd={`url(#arrowhead-open-${Date.now()})`} />}
            {activeTool === 'rect' && <rect x={`${Math.min(currentStart.x, currentEnd.x)}%`} y={`${Math.min(currentStart.y, currentEnd.y)}%`} width={`${Math.abs(currentEnd.x - currentStart.x)}%`} height={`${Math.abs(currentEnd.y - currentStart.y)}%`} fill="none" stroke="#4f46e5" strokeWidth="2" strokeDasharray="4 2" />}
            {activeTool === 'circle' && <ellipse cx={`${(currentStart.x + currentEnd.x) / 2}%`} cy={`${(currentStart.y + currentEnd.y) / 2}%`} rx={`${Math.abs(currentEnd.x - currentStart.x) / 2}%`} ry={`${Math.abs(currentEnd.y - currentStart.y) / 2}%`} fill="none" stroke="#4f46e5" strokeWidth="2" strokeDasharray="4 2" />}
          </g>
        )}
      </svg>

      {/* Property HUD */}
      {showPropertyHud && selectedAnn && !isAnyDragging && (
        <div
          className="property-hud absolute z-[100] bg-white border border-slate-200 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-reveal flex flex-col gap-4 w-64 no-export pointer-events-auto"
          style={hudStyle}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{selectedAnn.type} 控制台</span>
              <span className="text-[7px] text-slate-400 font-bold uppercase">Annotation Properties</span>
            </div>
            <button onClick={() => { onRemoveAnnotation(selectedAnn.id); setEditingId(null); setShowPropertyHud(false); }} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
              <i className="fa-solid fa-trash-can text-[10px]"></i>
            </button>
          </div>

          {selectedAnn.type === 'text' && (
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase px-1">文本内容</label>
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-700 outline-none focus:border-indigo-500 shadow-inner font-bold"
                value={selectedAnn.text || ''}
                onChange={e => onUpdateAnnotation(selectedAnn.id, { text: e.target.value })}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && setShowPropertyHud(false)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <ColorPickerWithPresets label="填充/边框色彩" color={selectedAnn.color} documentColors={documentColors} onChange={(c) => onUpdateAnnotation(selectedAnn.id, { color: c })} />

            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-400 uppercase px-1">
                {selectedAnn.type === 'text' ? '字号 (PT)' : '线宽 (PX)'}
              </label>
              <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2 border border-slate-200 overflow-hidden shadow-inner h-9">
                <i className="fa-solid fa-text-height text-[8px] text-slate-400"></i>
                <BufferedNumberInput
                  className="w-full bg-transparent p-0 text-xs text-slate-800 outline-none font-black text-center"
                  value={selectedAnn.type === 'text' ? (selectedAnn.fontSize || 0) : (selectedAnn.strokeWidth || 0)}
                  onUpdate={val => onUpdateAnnotation(selectedAnn.id, selectedAnn.type === 'text' ? { fontSize: val } : { strokeWidth: val })}
                />
              </div>
            </div>
          </div>

          {selectedAnn.type === 'text' && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                <select
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-[9px] font-bold text-slate-700 outline-none cursor-pointer"
                  value={selectedAnn.fontFamily}
                  onChange={e => onUpdateAnnotation(selectedAnn.id, { fontFamily: e.target.value })}
                >
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
                <button
                  onClick={() => onUpdateAnnotation(selectedAnn.id, { fontWeight: selectedAnn.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  className={`w-8 h-8 rounded-xl text-[10px] font-black border transition-all ${selectedAnn.fontWeight === 'bold' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  B
                </button>
                <button
                  onClick={() => onUpdateAnnotation(selectedAnn.id, { fontStyle: selectedAnn.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  className={`w-8 h-8 rounded-xl text-[10px] font-black border transition-all ${selectedAnn.fontStyle === 'italic' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  I
                </button>
              </div>
            </div>
          )}

          {(selectedAnn.type === 'line' || selectedAnn.type === 'arrow' || selectedAnn.type === 'rect' || selectedAnn.type === 'circle') && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-1">
                {['solid', 'dashed', 'dotted'].map(s => (
                  <button
                    key={s}
                    onClick={() => onUpdateAnnotation(selectedAnn.id, { dashStyle: s as any })}
                    className={`flex-1 py-1.5 rounded-xl text-[8px] font-black border transition-all ${selectedAnn.dashStyle === s ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                  >
                    {s === 'solid' ? '———' : s === 'dashed' ? '- - -' : '· · ·'}
                  </button>
                ))}
              </div>
              {selectedAnn.type === 'arrow' && (
                <div className="flex gap-1">
                  {['solid', 'open', 'none'].map(h => (
                    <button
                      key={h}
                      onClick={() => onUpdateAnnotation(selectedAnn.id, { headStyle: h as any })}
                      className={`flex-1 py-1.5 rounded-xl text-[7px] font-black uppercase border transition-all ${selectedAnn.headStyle === h ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                    >
                      {h === 'solid' ? '实心头' : h === 'open' ? '空心头' : '无头'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowPropertyHud(false)}
            className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-600 active:scale-95 transition-all"
          >
            完成修订
          </button>
        </div>
      )}
    </div>
  );
};
