import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';

interface WaterfallToolProps {
  seriesList: DataSeries[];
  onSetSeriesList: (updater: (prev: any[]) => any[]) => void;
}

const WaterfallTool: React.FC<WaterfallToolProps> = ({ seriesList, onSetSeriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [offset, setOffset] = useState(1.0);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  const applyWaterfall = useCallback(() => {
    if (seriesList.length < 2) return;

    onSetSeriesList((prev: DataSeries[]) => {
      return prev.map((series, idx) => {
        if (idx === 0) return series; // 第一条不偏移

        const deltaY = direction === 'up'
          ? idx * offset
          : -idx * offset;

        const newData: ChartDataPoint[] = series.data.map(d => ({
          ...d,
          value: d.value + deltaY,
        }));

        return { ...series, data: newData, name: `${series.name} (+${deltaY.toFixed(1)})` };
      });
    });

    setIsExpanded(false);
  }, [seriesList.length, offset, direction, onSetSeriesList]);

  const resetWaterfall = useCallback(() => {
    // 通过 name 去除偏移标记 (简单方案)
    onSetSeriesList((prev: DataSeries[]) =>
      prev.map(s => ({
        ...s,
        name: s.name.replace(/ \(\+[\-\d.]+\)$/, ''),
      }))
    );
    setIsExpanded(false);
  }, [onSetSeriesList]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-layer-group text-[10px]" /> 瀑布图
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[280px] p-4 animate-reveal">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-800 uppercase italic flex items-center gap-1.5">
          <i className="fa-solid fa-layer-group text-cyan-500" /> 瀑布/偏移堆叠
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-[10px]" />
        </button>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <label className="text-[8px] font-black text-slate-400 uppercase">偏移量</label>
          <span className="text-[10px] font-mono font-bold text-cyan-600">{offset.toFixed(1)}</span>
        </div>
        <input
          type="range" min={0.1} max={10} step={0.1}
          value={offset}
          onChange={e => setOffset(parseFloat(e.target.value))}
          className="w-full accent-cyan-600"
        />
      </div>

      <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
        <button
          onClick={() => setDirection('up')}
          className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${direction === 'up' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400'}`}
        >
          <i className="fa-solid fa-arrow-up mr-1" /> 向上偏移
        </button>
        <button
          onClick={() => setDirection('down')}
          className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${direction === 'down' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400'}`}
        >
          <i className="fa-solid fa-arrow-down mr-1" /> 向下偏移
        </button>
      </div>

      <p className="text-[8px] text-slate-400 mb-3">
        将 {seriesList.length} 条曲线按顺序偏移，间距 {offset.toFixed(1)}
      </p>

      <div className="flex gap-2">
        <button
          onClick={applyWaterfall}
          disabled={seriesList.length < 2}
          className="flex-1 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-[10px] font-black uppercase shadow-md active:scale-95 transition-all disabled:opacity-50"
        >
          <i className="fa-solid fa-check mr-1" /> 应用
        </button>
        <button
          onClick={resetWaterfall}
          className="px-3 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase active:scale-95 transition-all"
        >
          重置
        </button>
      </div>
    </div>
    </FixedPortal>
  );
};

export default WaterfallTool;
