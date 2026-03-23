import React, { useState, useCallback, useMemo } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartAnnotation } from '../../types';
import { findPeaks, PeakInfo, PeakFindOptions } from '../../utils/dataProcessing';

interface PeakFinderPanelProps {
  seriesList: DataSeries[];
  onAddAnnotations: (annotations: ChartAnnotation[]) => void;
}

const PeakFinderPanel: React.FC<PeakFinderPanelProps> = ({
  seriesList, onAddAnnotations,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetSeriesId, setTargetSeriesId] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<PeakInfo[]>([]);
  const [options, setOptions] = useState<PeakFindOptions>({
    minHeight: 10, relativeHeight: true, minProminence: undefined,
    minDistance: 3, findValleys: false, maxPeaks: 20,
  });

  const executePeakFind = useCallback(() => {
    const target = seriesList.find(s => s.id === (targetSeriesId || seriesList[0]?.id));
    if (!target) return;

    const data = target.data
      .map(d => ({ x: parseFloat(d.name), y: d.value }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y))
      .sort((a, b) => a.x - b.x);

    const found = findPeaks(data, options);
    setPeaks(found);
  }, [seriesList, targetSeriesId, options]);

  const addPeakAnnotations = useCallback(() => {
    if (peaks.length === 0) return;

    const annotations: ChartAnnotation[] = peaks.map((p, i) => ({
      id: `peak_${Date.now()}_${i}`,
      type: 'text' as any,
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      text: `${options.findValleys ? 'V' : 'P'}${i + 1}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
      color: options.findValleys ? '#0891b2' : '#dc2626',
      strokeWidth: 1,
      fontSize: 10,
    }));

    onAddAnnotations(annotations);
    setIsExpanded(false);
  }, [peaks, options.findValleys, onAddAnnotations]);

  const fmt = (v: number) => Math.abs(v) < 0.001 || Math.abs(v) > 1e5 ? v.toExponential(3) : v.toFixed(4);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetSeriesId && seriesList.length > 0) setTargetSeriesId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-orange-600 border-orange-200 hover:bg-orange-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-mountain-sun text-[10px]" /> 峰值查找
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[380px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
          <i className="fa-solid fa-mountain-sun text-orange-500" /> 峰值查找
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* 目标系列 */}
      <div className="mb-3">
        <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">数据系列</label>
        <select
          value={targetSeriesId || seriesList[0]?.id || ''}
          onChange={e => setTargetSeriesId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-orange-400"
        >
          {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* 参数设置 */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={options.findValleys || false}
              onChange={e => setOptions(p => ({ ...p, findValleys: e.target.checked }))}
              className="accent-orange-600"
            />
            查找谷值
          </label>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">最小高度 (%)</label>
            <span className="text-[10px] font-mono font-bold text-orange-600">{options.minHeight}%</span>
          </div>
          <input
            type="range" min={0} max={90} step={5}
            value={options.minHeight || 0}
            onChange={e => setOptions(p => ({ ...p, minHeight: parseInt(e.target.value), relativeHeight: true }))}
            className="w-full accent-orange-600"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">最小间距 (点)</label>
            <span className="text-[10px] font-mono font-bold text-orange-600">{options.minDistance}</span>
          </div>
          <input
            type="range" min={1} max={50} step={1}
            value={options.minDistance || 1}
            onChange={e => setOptions(p => ({ ...p, minDistance: parseInt(e.target.value) }))}
            className="w-full accent-orange-600"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">最大峰数</label>
            <span className="text-[10px] font-mono font-bold text-orange-600">{options.maxPeaks}</span>
          </div>
          <input
            type="range" min={1} max={50} step={1}
            value={options.maxPeaks || 20}
            onChange={e => setOptions(p => ({ ...p, maxPeaks: parseInt(e.target.value) }))}
            className="w-full accent-orange-600"
          />
        </div>
      </div>

      <button
        onClick={executePeakFind}
        className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mb-3"
      >
        <i className="fa-solid fa-magnifying-glass" /> 查找峰值
      </button>

      {/* 结果 */}
      {peaks.length > 0 && (
        <div className="space-y-2 animate-reveal">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500">
              发现 <span className="text-orange-600">{peaks.length}</span> 个{options.findValleys ? '谷' : '峰'}
            </span>
            <button
              onClick={addPeakAnnotations}
              className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-[9px] font-black uppercase hover:bg-orange-500 active:scale-95 transition-all"
            >
              <i className="fa-solid fa-tag mr-1" /> 标注到图表
            </button>
          </div>

          <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1">
            {peaks.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 text-[10px]">
                <span className="font-black text-slate-600">
                  {options.findValleys ? 'V' : 'P'}{i + 1}
                </span>
                <span className="font-mono text-slate-500">
                  x={fmt(p.x)}
                </span>
                <span className="font-mono text-orange-600 font-bold">
                  y={fmt(p.y)}
                </span>
                <span className="font-mono text-slate-400" title="FWHM">
                  W={fmt(p.fwhm)}
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

export default PeakFinderPanel;
