import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import * as dp from '../../utils/dataProcessing';

interface DataProcessingToolbarProps {
  seriesList: DataSeries[];
  /** 添加处理后的曲线到 seriesList (保留原数据) */
  onAddProcessedSeries: (series: DataSeries) => void;
}

type ProcessCategory = 'smooth' | 'baseline' | 'normalize' | 'interpolate' | 'calculus';

interface ProcessOption {
  id: string;
  label: string;
  category: ProcessCategory;
  params?: { key: string; label: string; default: number; min?: number; max?: number; step?: number }[];
  fn: (data: dp.DataPoint[], params: Record<string, number>) => dp.DataPoint[];
}

const PROCESS_OPTIONS: ProcessOption[] = [
  // ── 平滑 ──
  {
    id: 'moving_avg',
    label: '移动平均',
    category: 'smooth',
    params: [{ key: 'window', label: '窗口大小', default: 5, min: 3, max: 51, step: 2 }],
    fn: (data, p) => dp.movingAverage(data, p.window),
  },
  {
    id: 'sg',
    label: 'Savitzky-Golay',
    category: 'smooth',
    params: [{ key: 'window', label: '窗口大小', default: 7, min: 5, max: 51, step: 2 }],
    fn: (data, p) => dp.savitzkyGolay(data, p.window),
  },
  // ── 基线 ──
  {
    id: 'poly_baseline',
    label: '多项式基线',
    category: 'baseline',
    params: [{ key: 'degree', label: '阶数', default: 3, min: 1, max: 10, step: 1 }],
    fn: (data, p) => dp.polynomialBaseline(data, p.degree),
  },
  {
    id: 'als_baseline',
    label: 'ALS 基线',
    category: 'baseline',
    params: [
      { key: 'lambda', label: 'λ (平滑因子)', default: 100000, min: 100, max: 10000000, step: 10000 },
      { key: 'p', label: 'p (不对称系数)', default: 0.01, min: 0.001, max: 0.5, step: 0.005 },
    ],
    fn: (data, p) => dp.alsBaseline(data, p.lambda, p.p),
  },
  // ── 归一化 ──
  {
    id: 'norm_minmax',
    label: 'Min-Max [0,1]',
    category: 'normalize',
    fn: (data) => dp.normalizeMinMax(data),
  },
  {
    id: 'norm_zscore',
    label: 'Z-Score',
    category: 'normalize',
    fn: (data) => dp.normalizeZScore(data),
  },
  {
    id: 'norm_area',
    label: '面积归一化',
    category: 'normalize',
    fn: (data) => dp.normalizeArea(data),
  },
  // ── 微积分 ──
  {
    id: 'derivative',
    label: '数值微分 (dy/dx)',
    category: 'calculus',
    fn: (data) => dp.numericalDerivative(data),
  },
  {
    id: 'integral',
    label: '累积积分 (∫)',
    category: 'calculus',
    fn: (data) => dp.cumulativeIntegral(data),
  },
  // ── 插值 ──
  {
    id: 'linear_interp',
    label: '线性插值',
    category: 'interpolate',
    params: [{ key: 'points', label: '插值点数', default: 200, min: 50, max: 2000, step: 50 }],
    fn: (data, p) => {
      const sorted = [...data].sort((a, b) => a.x - b.x);
      const xMin = sorted[0].x;
      const xMax = sorted[sorted.length - 1].x;
      const newX = Array.from({ length: p.points }, (_, i) => xMin + (i / (p.points - 1)) * (xMax - xMin));
      return dp.linearInterpolate(sorted, newX);
    },
  },
  {
    id: 'spline_interp',
    label: '三次样条插值',
    category: 'interpolate',
    params: [{ key: 'points', label: '插值点数', default: 200, min: 50, max: 2000, step: 50 }],
    fn: (data, p) => {
      const sorted = [...data].sort((a, b) => a.x - b.x);
      const xMin = sorted[0].x;
      const xMax = sorted[sorted.length - 1].x;
      const newX = Array.from({ length: p.points }, (_, i) => xMin + (i / (p.points - 1)) * (xMax - xMin));
      return dp.splineInterpolate(sorted, newX);
    },
  },
];

const CATEGORY_CONFIG: Record<ProcessCategory, { label: string; icon: string; color: string }> = {
  smooth:      { label: '平滑',   icon: 'fa-wave-square', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  baseline:    { label: '基线',   icon: 'fa-ruler-horizontal', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  normalize:   { label: '归一化', icon: 'fa-arrows-up-down', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  interpolate: { label: '插值',   icon: 'fa-bezier-curve', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  calculus:    { label: '微积分', icon: 'fa-square-root-variable', color: 'text-rose-600 bg-rose-50 border-rose-200' },
};

const DataProcessingToolbar: React.FC<DataProcessingToolbarProps> = ({
  seriesList,
  onAddProcessedSeries,
}) => {
  const [expandedCategory, setExpandedCategory] = useState<ProcessCategory | null>(null);
  const [activeOption, setActiveOption] = useState<ProcessOption | null>(null);
  const [targetSeriesId, setTargetSeriesId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});
  const [areaResult, setAreaResult] = useState<number | null>(null);

  const toggleCategory = (cat: ProcessCategory) => {
    setExpandedCategory(prev => prev === cat ? null : cat);
    setActiveOption(null);
    setAreaResult(null);
  };

  const selectOption = (opt: ProcessOption) => {
    setActiveOption(opt);
    const defaultParams: Record<string, number> = {};
    opt.params?.forEach(p => { defaultParams[p.key] = p.default; });
    setParams(defaultParams);
    setAreaResult(null);
    // 自动选中第一个 series
    if (!targetSeriesId && seriesList.length > 0) {
      setTargetSeriesId(seriesList[0].id);
    }
  };

  const executeProcessing = useCallback(() => {
    if (!activeOption || !targetSeriesId) return;
    const targetSeries = seriesList.find(s => s.id === targetSeriesId);
    if (!targetSeries) return;

    const inputData: dp.DataPoint[] = targetSeries.data.map(d => ({
      x: parseFloat(d.name),
      y: d.value,
    })).filter(d => !isNaN(d.x) && !isNaN(d.y));

    if (inputData.length < 2) return;

    const processed = activeOption.fn(inputData, params);

    // 如果是曲线下面积，显示数值
    if (activeOption.id === 'integral') {
      const totalArea = dp.areaUnderCurve(inputData);
      setAreaResult(totalArea);
    }

    const newData: ChartDataPoint[] = processed.map(p => ({
      name: String(p.x),
      value: p.y,
    }));

    const suffix = activeOption.label;
    const newSeries: DataSeries = {
      id: `proc_${Date.now()}`,
      name: `${targetSeries.name} (${suffix})`,
      data: newData,
      color: '#9333ea',
      pointColor: '#9333ea',
      strokeWidth: 1.5,
      visible: true,
      pointShape: 'none',
      pointSize: 0,
    };

    onAddProcessedSeries(newSeries);
    setActiveOption(null);
    setExpandedCategory(null);
  }, [activeOption, targetSeriesId, seriesList, params, onAddProcessedSeries]);

  if (seriesList.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-slate-50/80 border-b border-slate-100 shrink-0">
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mr-2 shrink-0">数据处理</span>

      {(Object.entries(CATEGORY_CONFIG) as [ProcessCategory, typeof CATEGORY_CONFIG[ProcessCategory]][]).map(([cat, cfg]) => (
        <div key={cat} className="relative">
          <button
            onClick={() => toggleCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center gap-1.5 active:scale-95 ${
              expandedCategory === cat
                ? `${cfg.color} ring-2 ring-offset-1 ring-current shadow-md`
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            <i className={`fa-solid ${cfg.icon} text-[10px]`} />
            {cfg.label}
          </button>

          {expandedCategory === cat && (
            <FixedPortal onClose={() => setExpandedCategory(null)}>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 min-w-[220px] p-3 animate-reveal">
              <div className="space-y-1">
                {PROCESS_OPTIONS.filter(o => o.category === cat).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => selectOption(opt)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeOption?.id === opt.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {activeOption && activeOption.category === cat && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  {/* 目标系列选择 */}
                  <div>
                    <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">目标系列</label>
                    <select
                      value={targetSeriesId || ''}
                      onChange={(e) => setTargetSeriesId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-400"
                    >
                      {seriesList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 参数 */}
                  {activeOption.params?.map(p => (
                    <div key={p.key}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[8px] font-black text-slate-400 uppercase">{p.label}</label>
                        <span className="text-[10px] font-mono font-bold text-indigo-600">{params[p.key]}</span>
                      </div>
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={params[p.key] ?? p.default}
                        onChange={(e) => setParams(prev => ({ ...prev, [p.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-indigo-600"
                      />
                    </div>
                  ))}

                  {areaResult !== null && (
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <span className="text-[8px] font-black text-indigo-400 uppercase">总面积</span>
                      <p className="text-sm font-black text-indigo-700 font-mono">{areaResult.toExponential(4)}</p>
                    </div>
                  )}

                  <button
                    onClick={executeProcessing}
                    className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase hover:bg-indigo-500 transition-all active:scale-95 shadow-lg"
                  >
                    <i className="fa-solid fa-play mr-1.5" /> 应用处理
                  </button>
                </div>
              )}
            </div>
            </FixedPortal>
          )}
        </div>
      ))}
    </div>
  );
};

export default DataProcessingToolbar;
