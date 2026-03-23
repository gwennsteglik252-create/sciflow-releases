import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';

interface ErrorBandToolProps {
  seriesList: DataSeries[];
  onAddSeries: (series: DataSeries) => void;
}

/**
 * 误差带工具 — 为选中系列生成上/下界填充区域系列
 * 支持 3 种误差来源：固定值、百分比、标准差
 */
const ErrorBandTool: React.FC<ErrorBandToolProps> = ({ seriesList, onAddSeries }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [mode, setMode] = useState<'fixed' | 'percent' | 'std'>('percent');
  const [fixedError, setFixedError] = useState(0.5);
  const [percentError, setPercentError] = useState(10);
  const [windowSize, setWindowSize] = useState(5);

  const createErrorBand = useCallback(() => {
    const target = seriesList.find(s => s.id === (targetId || seriesList[0]?.id));
    if (!target) return;

    const data = target.data.map(d => ({
      x: parseFloat(d.name),
      y: d.value,
    })).filter(d => !isNaN(d.x) && !isNaN(d.y));

    let upperBand: ChartDataPoint[] = [];
    let lowerBand: ChartDataPoint[] = [];

    if (mode === 'fixed') {
      upperBand = data.map(d => ({ name: String(d.x), value: d.y + fixedError }));
      lowerBand = data.map(d => ({ name: String(d.x), value: d.y - fixedError }));
    } else if (mode === 'percent') {
      upperBand = data.map(d => ({ name: String(d.x), value: d.y * (1 + percentError / 100) }));
      lowerBand = data.map(d => ({ name: String(d.x), value: d.y * (1 - percentError / 100) }));
    } else {
      // 滑动窗口标准差
      const half = Math.floor(windowSize / 2);
      upperBand = data.map((d, i) => {
        const start = Math.max(0, i - half);
        const end = Math.min(data.length, i + half + 1);
        const slice = data.slice(start, end).map(p => p.y);
        const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
        const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
        return { name: String(d.x), value: d.y + std };
      });
      lowerBand = data.map((d, i) => {
        const start = Math.max(0, i - half);
        const end = Math.min(data.length, i + half + 1);
        const slice = data.slice(start, end).map(p => p.y);
        const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
        const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
        return { name: String(d.x), value: d.y - std };
      });
    }

    const baseColor = target.color || '#6366f1';

    // 添加上界线（虚线，半透明）
    onAddSeries({
      id: `band_upper_${Date.now()}`,
      name: `${target.name} (上界)`,
      data: upperBand,
      color: baseColor,
      pointColor: baseColor,
      strokeWidth: 0.8,
      visible: true,
      pointShape: 'none',
      pointSize: 0,
    });

    // 添加下界线
    onAddSeries({
      id: `band_lower_${Date.now()}`,
      name: `${target.name} (下界)`,
      data: lowerBand,
      color: baseColor,
      pointColor: baseColor,
      strokeWidth: 0.8,
      visible: true,
      pointShape: 'none',
      pointSize: 0,
    });

    setIsExpanded(false);
  }, [seriesList, targetId, mode, fixedError, percentError, windowSize, onAddSeries]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetId && seriesList.length > 0) setTargetId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-pink-600 border-pink-200 hover:bg-pink-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-chart-area text-[10px]" /> 误差带
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[300px] p-4 animate-reveal">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-slate-800 uppercase italic flex items-center gap-1.5">
          <i className="fa-solid fa-chart-area text-pink-500" /> 误差带 (Error Band)
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-[10px]" />
        </button>
      </div>

      <select
        value={targetId || seriesList[0]?.id || ''}
        onChange={e => setTargetId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-pink-400 mb-3"
      >
        {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <div className="flex bg-slate-100 p-1 rounded-lg mb-3">
        {([['fixed', '固定值'], ['percent', '百分比'], ['std', '标准差']] as const).map(([m, l]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-400'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === 'fixed' && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">误差值 (±)</label>
            <span className="text-[10px] font-mono font-bold text-pink-600">{fixedError}</span>
          </div>
          <input type="range" min={0.01} max={10} step={0.01} value={fixedError} onChange={e => setFixedError(parseFloat(e.target.value))} className="w-full accent-pink-600" />
        </div>
      )}

      {mode === 'percent' && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">百分比 (±%)</label>
            <span className="text-[10px] font-mono font-bold text-pink-600">{percentError}%</span>
          </div>
          <input type="range" min={1} max={50} step={1} value={percentError} onChange={e => setPercentError(parseInt(e.target.value))} className="w-full accent-pink-600" />
        </div>
      )}

      {mode === 'std' && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">窗口大小</label>
            <span className="text-[10px] font-mono font-bold text-pink-600">{windowSize}</span>
          </div>
          <input type="range" min={3} max={21} step={2} value={windowSize} onChange={e => setWindowSize(parseInt(e.target.value))} className="w-full accent-pink-600" />
        </div>
      )}

      <button
        onClick={createErrorBand}
        className="w-full py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
      >
        <i className="fa-solid fa-check mr-1" /> 生成误差带
      </button>
    </div>
    </FixedPortal>
  );
};

export default ErrorBandTool;
