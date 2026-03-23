import React, { useMemo, useState } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries } from '../../types';
import { computeDescriptiveStats, DescriptiveStats } from '../../utils/dataProcessing';

interface StatsPanelProps {
  seriesList: DataSeries[];
}

const StatsPanel: React.FC<StatsPanelProps> = ({ seriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const target = seriesList.find(s => s.id === (selectedId || seriesList[0]?.id));
    if (!target || target.data.length === 0) return null;

    const xVals = target.data.map(d => parseFloat(d.name)).filter(v => !isNaN(v));
    const yVals = target.data.map(d => d.value).filter(v => !isNaN(v));

    return {
      x: computeDescriptiveStats(xVals),
      y: computeDescriptiveStats(yVals),
      seriesName: target.name,
    };
  }, [seriesList, selectedId]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!selectedId && seriesList.length > 0) setSelectedId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-teal-600 border-teal-200 hover:bg-teal-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-chart-simple text-[10px]" /> 统计分析
      </button>
    );
  }

  const StatRow = ({ label, xVal, yVal }: { label: string; xVal: string; yVal: string }) => (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
      <td className="px-3 py-1.5 text-[10px] font-bold text-slate-500">{label}</td>
      <td className="px-3 py-1.5 text-[10px] font-mono font-bold text-blue-600 text-right">{xVal}</td>
      <td className="px-3 py-1.5 text-[10px] font-mono font-bold text-emerald-600 text-right">{yVal}</td>
    </tr>
  );

  const fmt = (v: number) => {
    if (Math.abs(v) < 0.001 || Math.abs(v) > 1e5) return v.toExponential(4);
    return v.toFixed(4);
  };

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[360px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
          <i className="fa-solid fa-chart-simple text-teal-500" /> 描述性统计
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <select
        value={selectedId || seriesList[0]?.id || ''}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-teal-400 mb-3"
      >
        {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {stats ? (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-200">
              <th className="px-3 py-2 text-[8px] font-black text-slate-400 uppercase text-left">指标</th>
              <th className="px-3 py-2 text-[8px] font-black text-blue-400 uppercase text-right">X</th>
              <th className="px-3 py-2 text-[8px] font-black text-emerald-400 uppercase text-right">Y</th>
            </tr>
          </thead>
          <tbody>
            <StatRow label="样本数" xVal={String(stats.x.count)} yVal={String(stats.y.count)} />
            <StatRow label="均值 (Mean)" xVal={fmt(stats.x.mean)} yVal={fmt(stats.y.mean)} />
            <StatRow label="中位数 (Median)" xVal={fmt(stats.x.median)} yVal={fmt(stats.y.median)} />
            <StatRow label="标准差 (Std)" xVal={fmt(stats.x.std)} yVal={fmt(stats.y.std)} />
            <StatRow label="方差 (Var)" xVal={fmt(stats.x.variance)} yVal={fmt(stats.y.variance)} />
            <StatRow label="最小值 (Min)" xVal={fmt(stats.x.min)} yVal={fmt(stats.y.min)} />
            <StatRow label="最大值 (Max)" xVal={fmt(stats.x.max)} yVal={fmt(stats.y.max)} />
            <StatRow label="范围 (Range)" xVal={fmt(stats.x.range)} yVal={fmt(stats.y.range)} />
            <StatRow label="Q1 (25%)" xVal={fmt(stats.x.q1)} yVal={fmt(stats.y.q1)} />
            <StatRow label="Q3 (75%)" xVal={fmt(stats.x.q3)} yVal={fmt(stats.y.q3)} />
            <StatRow label="四分位距 (IQR)" xVal={fmt(stats.x.iqr)} yVal={fmt(stats.y.iqr)} />
            <StatRow label="偏度 (Skew)" xVal={fmt(stats.x.skewness)} yVal={fmt(stats.y.skewness)} />
            <StatRow label="峰度 (Kurt)" xVal={fmt(stats.x.kurtosis)} yVal={fmt(stats.y.kurtosis)} />
          </tbody>
        </table>
      ) : (
        <div className="text-center py-8 text-xs text-slate-400">暂无数据</div>
      )}
    </div>
    </FixedPortal>
  );
};

export default StatsPanel;
