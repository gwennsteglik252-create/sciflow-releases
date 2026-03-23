import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import { deconvolvePeaks, DeconvResult } from '../../utils/statisticalTests';
import { findPeaks } from '../../utils/dataProcessing';

interface DeconvolutionPanelProps {
  seriesList: DataSeries[];
  onAddSeries: (series: DataSeries) => void;
}

const SHAPE_LABELS = { gaussian: '高斯', lorentzian: '洛伦兹', voigt: 'Voigt' } as const;
const PEAK_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const DeconvolutionPanel: React.FC<DeconvolutionPanelProps> = ({ seriesList, onAddSeries }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [shape, setShape] = useState<'gaussian' | 'lorentzian' | 'voigt'>('gaussian');
  const [autoDetect, setAutoDetect] = useState(true);
  const [manualCenters, setManualCenters] = useState('');
  const [result, setResult] = useState<DeconvResult | null>(null);

  const executeDeconv = useCallback(() => {
    const target = seriesList.find(s => s.id === (targetId || seriesList[0]?.id));
    if (!target) return;

    const data = target.data
      .map(d => ({ x: parseFloat(d.name), y: d.value }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y))
      .sort((a, b) => a.x - b.x);

    let centers: number[];

    if (autoDetect) {
      const peaks = findPeaks(data, { minHeight: 10, relativeHeight: true, minDistance: 3, maxPeaks: 8 });
      centers = peaks.map(p => p.x);
    } else {
      centers = manualCenters.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
    }

    if (centers.length === 0) return;

    const deconvResult = deconvolvePeaks(data, centers, shape, 150);
    setResult(deconvResult);

    // 添加拟合总曲线
    const fittedData: ChartDataPoint[] = deconvResult.fittedCurve.map(p => ({
      name: String(p.x), value: p.y,
    }));
    onAddSeries({
      id: `deconv_fit_${Date.now()}`,
      name: `${target.name} (反卷积拟合)`,
      data: fittedData,
      color: '#dc2626',
      pointColor: '#dc2626',
      strokeWidth: 2,
      visible: true,
      pointShape: 'none',
      pointSize: 0,
    });

    // 添加每个独立峰
    deconvResult.peakCurves.forEach((curve, i) => {
      const peakData: ChartDataPoint[] = curve.map(p => ({ name: String(p.x), value: p.y }));
      onAddSeries({
        id: `deconv_peak_${i}_${Date.now()}`,
        name: `峰 ${i + 1} (${deconvResult.peaks[i].center.toFixed(2)})`,
        data: peakData,
        color: PEAK_COLORS[i % PEAK_COLORS.length],
        pointColor: PEAK_COLORS[i % PEAK_COLORS.length],
        strokeWidth: 1,
        visible: true,
        pointShape: 'none',
        pointSize: 0,
      });
    });
  }, [seriesList, targetId, shape, autoDetect, manualCenters, onAddSeries]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetId && seriesList.length > 0) setTargetId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-chart-column text-[10px]" /> 反卷积
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[400px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-chart-column text-rose-500" /> 多峰反卷积
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <select
        value={targetId || seriesList[0]?.id || ''}
        onChange={e => setTargetId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-rose-400 mb-3"
      >
        {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {/* 峰形选择 */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
        {(['gaussian', 'lorentzian', 'voigt'] as const).map(s => (
          <button
            key={s}
            onClick={() => setShape(s)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${shape === s ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
          >
            {SHAPE_LABELS[s]}
          </button>
        ))}
      </div>

      {/* 峰位检测方式 */}
      <div className="mb-3">
        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-2 cursor-pointer">
          <input type="checkbox" checked={autoDetect} onChange={e => setAutoDetect(e.target.checked)} className="accent-rose-600" />
          自动检测峰位
        </label>
        {!autoDetect && (
          <input
            type="text"
            value={manualCenters}
            onChange={e => setManualCenters(e.target.value)}
            placeholder="输入峰位 x 值，逗号分隔 (如 280, 350, 420)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white outline-none focus:border-rose-400"
          />
        )}
      </div>

      <button
        onClick={executeDeconv}
        className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all mb-3"
      >
        <i className="fa-solid fa-wand-magic-sparkles mr-1.5" /> 执行反卷积
      </button>

      {result && result.peaks.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 animate-reveal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-500">
              R² = <span className="text-rose-600">{result.rSquared.toFixed(6)}</span>
            </span>
            <span className="text-[10px] font-black text-slate-500">{result.peaks.length} 个峰</span>
          </div>

          <div className="space-y-1.5">
            {result.peaks.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100 text-[9px]">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PEAK_COLORS[i % PEAK_COLORS.length] }} />
                <span className="font-black text-slate-600 w-8">#{i + 1}</span>
                <span className="font-mono text-slate-500">
                  x₀={p.center.toFixed(2)}
                </span>
                <span className="font-mono text-rose-600 font-bold">
                  A={p.amplitude.toFixed(2)}
                </span>
                <span className="font-mono text-slate-400">
                  W={p.width.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

export default DeconvolutionPanel;
