import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries } from '../../types';

interface DualAxisToolProps {
  seriesList: DataSeries[];
  onSetSeriesList: (updater: (prev: any[]) => any[]) => void;
  rightYAxisLabel?: string;
  onRightYAxisLabelChange?: (label: string) => void;
}

/**
 * 双Y轴工具 — 真独立坐标轴
 * 不修改原始数据，仅标记系列的 yAxisId 属性
 */
const DualAxisTool: React.FC<DualAxisToolProps> = ({
  seriesList,
  onSetSeriesList,
  rightYAxisLabel = '',
  onRightYAxisLabelChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localLabel, setLocalLabel] = useState('右Y轴');

  // 当前是否已启用双轴
  const isDualActive = seriesList.some(s => s.yAxisId === 'right');

  // 打开时，从当前系列状态同步已选中的右轴系列
  const handleOpen = () => {
    const currentRight = new Set(
      seriesList.filter(s => s.yAxisId === 'right').map(s => s.id)
    );
    setSelectedIds(currentRight);
    setLocalLabel(rightYAxisLabel || '右Y轴');
    setIsExpanded(true);
  };

  const toggleSeriesAxis = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyDualAxis = useCallback(() => {
    // 仅标记 yAxisId，不修改数据值
    onSetSeriesList((prev: DataSeries[]) =>
      prev.map(s => ({
        ...s,
        yAxisId: selectedIds.has(s.id) ? 'right' as const : 'left' as const,
      }))
    );
    onRightYAxisLabelChange?.(localLabel);
    setIsExpanded(false);
  }, [selectedIds, onSetSeriesList, onRightYAxisLabelChange, localLabel]);

  const resetDualAxis = useCallback(() => {
    // 所有系列重置为左轴
    onSetSeriesList((prev: DataSeries[]) =>
      prev.map(s => ({
        ...s,
        yAxisId: 'left' as const,
      }))
    );
    onRightYAxisLabelChange?.('');
    setSelectedIds(new Set());
    setIsExpanded(false);
  }, [onSetSeriesList, onRightYAxisLabelChange]);

  if (!isExpanded) {
    return (
      <button
        onClick={handleOpen}
        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center gap-1.5 shadow-sm active:scale-95 ${
          isDualActive
            ? 'bg-indigo-600 text-white border-indigo-400'
            : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white'
        }`}
      >
        <i className="fa-solid fa-arrows-left-right text-[10px]" /> 双Y轴
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[300px] p-4 animate-reveal">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-800 uppercase italic flex items-center gap-1.5">
          <i className="fa-solid fa-arrows-left-right text-indigo-500" /> 双 Y 轴设置
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-[10px]" />
        </button>
      </div>

      <p className="text-[9px] text-slate-400 mb-3">选择要分配到右Y轴的系列（独立坐标轴，不修改数据值）：</p>

      <div className="space-y-1.5 mb-3 max-h-[200px] overflow-y-auto custom-scrollbar">
        {seriesList.map(s => (
          <label
            key={s.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
              selectedIds.has(s.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-100 hover:border-slate-200'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onChange={() => toggleSeriesAxis(s.id)}
              className="accent-indigo-600"
            />
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: s.color || '#6366f1' }}
            />
            <span className="text-[10px] font-bold text-slate-600 truncate flex-1">
              {s.name}
            </span>
            <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">
              {selectedIds.has(s.id) ? '右轴' : '左轴'}
            </span>
          </label>
        ))}
      </div>

      <div className="mb-3">
        <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">右轴标签</label>
        <input
          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-400"
          value={localLabel}
          onChange={e => setLocalLabel(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        {isDualActive && (
          <button
            onClick={resetDualAxis}
            className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-slate-200 transition-all active:scale-95"
          >
            <i className="fa-solid fa-rotate-left mr-1" /> 重置
          </button>
        )}
        <button
          onClick={applyDualAxis}
          disabled={selectedIds.size === 0}
          className="flex-[2] py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          <i className="fa-solid fa-check mr-1" /> 应用双轴
        </button>
      </div>
    </div>
    </FixedPortal>
  );
};

export default DualAxisTool;
