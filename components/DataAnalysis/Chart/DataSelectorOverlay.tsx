import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DataSeries } from '../../../types';

interface DataSelectorOverlayProps {
  active: boolean;
  seriesList: DataSeries[];
  /** Recharts 绘图区域在容器内的 offset (left, top, width, height) */
  chartOffset: { left: number; top: number; width: number; height: number } | null;
  /** 容器 ref，用于将鼠标坐标求相对位置 */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 当前轴 domain */
  xDomain: [number, number];
  yDomain: [number, number];
  /** 操作回调 */
  onExtractSelection: (xMin: number, xMax: number) => void;
  onClipSelection: (xMin: number, xMax: number) => void;
  onDeleteSelection: (xMin: number, xMax: number) => void;
  onDeactivate: () => void;
}

/** 简单描述统计 */
const quickStats = (values: number[]) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1);
  return {
    count: n,
    mean: mean,
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[n - 1],
  };
};

export const DataSelectorOverlay: React.FC<DataSelectorOverlayProps> = ({
  active, seriesList, chartOffset, containerRef, xDomain, yDomain,
  onExtractSelection, onClipSelection, onDeleteSelection, onDeactivate
}) => {
  // 选区状态（data 坐标）
  const [selection, setSelection] = useState<{ xMin: number; xMax: number } | null>(null);
  // 绘制状态
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(0);
  const [drawEnd, setDrawEnd] = useState(0);
  // 边界拖拽
  const [draggingEdge, setDraggingEdge] = useState<'left' | 'right' | null>(null);

  // 重置
  useEffect(() => {
    if (!active) {
      setSelection(null);
      setDrawing(false);
      setDraggingEdge(null);
    }
  }, [active]);

  // 将像素 X 转为数据 X
  const pxToDataX = useCallback((clientX: number): number => {
    if (!chartOffset || !containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = clientX - rect.left - chartOffset.left;
    const ratio = Math.max(0, Math.min(1, relX / chartOffset.width));
    return xDomain[0] + ratio * (xDomain[1] - xDomain[0]);
  }, [chartOffset, containerRef, xDomain]);

  // 将数据 X 转为像素（相对容器）
  const dataXToPx = useCallback((dataX: number): number => {
    if (!chartOffset) return 0;
    const ratio = (dataX - xDomain[0]) / (xDomain[1] - xDomain[0]);
    return chartOffset.left + ratio * chartOffset.width;
  }, [chartOffset, xDomain]);

  // 框选鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!active || !chartOffset || draggingEdge) return;
    // 检查是否点在边界上
    if (selection) {
      const leftPx = dataXToPx(selection.xMin);
      const rightPx = dataXToPx(selection.xMax);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const relX = e.clientX - rect.left;
        if (Math.abs(relX - leftPx) < 8) {
          setDraggingEdge('left');
          e.preventDefault();
          return;
        }
        if (Math.abs(relX - rightPx) < 8) {
          setDraggingEdge('right');
          e.preventDefault();
          return;
        }
      }
    }
    // 新选区
    const dataX = pxToDataX(e.clientX);
    setDrawing(true);
    setDrawStart(dataX);
    setDrawEnd(dataX);
    setSelection(null);
    e.preventDefault();
  }, [active, chartOffset, selection, draggingEdge, pxToDataX, dataXToPx, containerRef]);

  useEffect(() => {
    if (!drawing && !draggingEdge) return;

    const handleMove = (e: MouseEvent) => {
      const dataX = pxToDataX(e.clientX);
      if (drawing) {
        setDrawEnd(dataX);
      } else if (draggingEdge && selection) {
        if (draggingEdge === 'left') {
          setSelection({ xMin: Math.min(dataX, selection.xMax), xMax: selection.xMax });
        } else {
          setSelection({ xMin: selection.xMin, xMax: Math.max(dataX, selection.xMin) });
        }
      }
    };

    const handleUp = () => {
      if (drawing) {
        const xMin = Math.min(drawStart, drawEnd);
        const xMax = Math.max(drawStart, drawEnd);
        if (xMax - xMin > (xDomain[1] - xDomain[0]) * 0.005) {
          setSelection({ xMin, xMax });
        }
        setDrawing(false);
      }
      setDraggingEdge(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [drawing, draggingEdge, drawStart, drawEnd, pxToDataX, selection, xDomain]);

  // 选区内的数据统计
  const selectionStats = useMemo(() => {
    if (!selection) return null;
    const allValues: number[] = [];
    const visible = seriesList.filter(s => s.visible !== false);
    visible.forEach(s => {
      s.data.forEach(d => {
        const x = parseFloat(d.name);
        if (!isNaN(x) && x >= selection.xMin && x <= selection.xMax) {
          allValues.push(d.value);
        }
      });
    });
    return { stats: quickStats(allValues), xRange: [selection.xMin, selection.xMax] as [number, number] };
  }, [selection, seriesList]);

  // 当前选区的像素位置
  const selRect = useMemo(() => {
    if (!chartOffset) return null;
    const sel = selection || (drawing ? { xMin: Math.min(drawStart, drawEnd), xMax: Math.max(drawStart, drawEnd) } : null);
    if (!sel) return null;
    const leftPx = dataXToPx(sel.xMin);
    const rightPx = dataXToPx(sel.xMax);
    return {
      left: leftPx,
      width: rightPx - leftPx,
      top: chartOffset.top,
      height: chartOffset.height,
    };
  }, [chartOffset, selection, drawing, drawStart, drawEnd, dataXToPx]);

  if (!active) return null;

  const fmtNum = (v: number) => Math.abs(v) < 0.001 || Math.abs(v) > 1e5 ? v.toExponential(3) : v.toFixed(4);

  return (
    <div
      className="absolute inset-0 z-[45]"
      style={{ cursor: drawing || draggingEdge ? 'col-resize' : 'crosshair' }}
      onMouseDown={handleMouseDown}
    >
      {/* 选区矩形 */}
      {selRect && selRect.width > 0 && (
        <>
          {/* 半透明覆盖 */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: selRect.left,
              top: selRect.top,
              width: selRect.width,
              height: selRect.height,
              background: 'linear-gradient(180deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06))',
              borderLeft: '2px solid #6366f1',
              borderRight: '2px solid #6366f1',
              borderTop: '1px dashed rgba(99,102,241,0.3)',
              borderBottom: '1px dashed rgba(99,102,241,0.3)',
              transition: drawing ? 'none' : 'all 0.1s ease',
            }}
          />

          {/* 左边界拖柄 */}
          {selection && (
            <div
              className="absolute w-3 cursor-col-resize hover:bg-indigo-200 transition-colors z-[50]"
              style={{
                left: selRect.left - 6,
                top: selRect.top,
                height: selRect.height,
              }}
              onMouseDown={(e) => { e.stopPropagation(); setDraggingEdge('left'); }}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-full shadow-md" />
            </div>
          )}

          {/* 右边界拖柄 */}
          {selection && (
            <div
              className="absolute w-3 cursor-col-resize hover:bg-indigo-200 transition-colors z-[50]"
              style={{
                left: selRect.left + selRect.width - 6,
                top: selRect.top,
                height: selRect.height,
              }}
              onMouseDown={(e) => { e.stopPropagation(); setDraggingEdge('right'); }}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-full shadow-md" />
            </div>
          )}
        </>
      )}

      {/* 选区统计信息面板 */}
      {selection && selectionStats?.stats && (
        <div
          className="absolute z-[60] bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-xl p-3 animate-reveal pointer-events-auto"
          style={{
            left: Math.min(selRect?.left ?? 0 + (selRect?.width ?? 0) / 2, (chartOffset?.left ?? 0) + (chartOffset?.width ?? 0) - 210),
            top: (chartOffset?.top ?? 0) + 8,
            width: 200,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              <i className="fa-solid fa-crosshairs text-[8px]" /> 选区统计
            </span>
            <button
              onClick={() => { setSelection(null); onDeactivate(); }}
              className="w-5 h-5 rounded-md bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-[8px]"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 mb-2">
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-[7px] font-black text-slate-400">点数</div>
              <div className="text-xs font-black text-indigo-600">{selectionStats.stats.count}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-[7px] font-black text-slate-400">均值</div>
              <div className="text-[10px] font-black text-indigo-600 font-mono">{fmtNum(selectionStats.stats.mean)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-[7px] font-black text-slate-400">标准差</div>
              <div className="text-[10px] font-black text-amber-600 font-mono">{fmtNum(selectionStats.stats.std)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-1.5 text-center">
              <div className="text-[7px] font-black text-slate-400">范围</div>
              <div className="text-[10px] font-black text-emerald-600 font-mono">{fmtNum(selectionStats.stats.min)} ~ {fmtNum(selectionStats.stats.max)}</div>
            </div>
          </div>

          <div className="text-[8px] text-slate-400 font-bold mb-2 px-0.5">
            X: [{fmtNum(selection.xMin)}, {fmtNum(selection.xMax)}]
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => { onExtractSelection(selection.xMin, selection.xMax); }}
              className="flex-1 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1"
              title="提取为新系列"
            >
              <i className="fa-solid fa-copy text-[7px]" /> 提取
            </button>
            <button
              onClick={() => { onClipSelection(selection.xMin, selection.xMax); setSelection(null); }}
              className="flex-1 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase border border-amber-200 hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-1"
              title="裁剪到选区"
            >
              <i className="fa-solid fa-crop text-[7px]" /> 裁剪
            </button>
            <button
              onClick={() => { onDeleteSelection(selection.xMin, selection.xMax); setSelection(null); }}
              className="flex-1 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase border border-rose-200 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-1"
              title="删除选区数据"
            >
              <i className="fa-solid fa-trash text-[7px]" /> 删除
            </button>
          </div>
        </div>
      )}

      {/* 激活提示（无选区时） */}
      {!selection && !drawing && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60] bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-lg flex items-center gap-2 pointer-events-auto animate-reveal">
          <i className="fa-solid fa-crosshairs text-[9px]" />
          拖拽选择数据范围
          <button
            onClick={onDeactivate}
            className="ml-1 w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[8px]"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}
    </div>
  );
};
