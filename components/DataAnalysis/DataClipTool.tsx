import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import { clipDataByXRange, removeOutliers, decimateData } from '../../utils/dataProcessing';

interface DataClipToolProps {
  seriesList: DataSeries[];
  onUpdateSeries: (id: string, updates: Partial<DataSeries>) => void;
  onAddSeries: (series: DataSeries) => void;
}

const DataClipTool: React.FC<DataClipToolProps> = ({
  seriesList, onUpdateSeries, onAddSeries,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [mode, setMode] = useState<'range' | 'outlier' | 'decimate'>('range');
  const [xMin, setXMin] = useState('');
  const [xMax, setXMax] = useState('');
  const [iqrFactor, setIqrFactor] = useState(1.5);
  const [decimateStep, setDecimateStep] = useState(2);
  const [replaceOriginal, setReplaceOriginal] = useState(false);

  const target = seriesList.find(s => s.id === (targetId || seriesList[0]?.id));

  const executeClip = useCallback(() => {
    if (!target) return;

    const inputData = target.data
      .map(d => ({ x: parseFloat(d.name), y: d.value }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y));

    let result;
    let suffix = '';

    if (mode === 'range') {
      const min = xMin ? parseFloat(xMin) : -Infinity;
      const max = xMax ? parseFloat(xMax) : Infinity;
      result = clipDataByXRange(inputData, min, max);
      suffix = `裁剪 [${xMin || '−∞'}, ${xMax || '+∞'}]`;
    } else if (mode === 'outlier') {
      result = removeOutliers(inputData, iqrFactor);
      suffix = `去离群 (${iqrFactor}×IQR)`;
    } else {
      result = decimateData(inputData, decimateStep);
      suffix = `抽稀 ×${decimateStep}`;
    }

    const newData: ChartDataPoint[] = result.map(p => ({
      name: String(p.x),
      value: p.y,
    }));

    if (replaceOriginal) {
      onUpdateSeries(target.id, { data: newData });
    } else {
      onAddSeries({
        id: `clip_${Date.now()}`,
        name: `${target.name} (${suffix})`,
        data: newData,
        color: '#7c3aed',
        pointColor: '#7c3aed',
        strokeWidth: target.strokeWidth || 1.5,
        visible: true,
        pointShape: target.pointShape || 'none',
        pointSize: target.pointSize || 0,
      });
    }

    setIsExpanded(false);
  }, [target, mode, xMin, xMax, iqrFactor, decimateStep, replaceOriginal, onUpdateSeries, onAddSeries]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetId && seriesList.length > 0) setTargetId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-violet-600 border-violet-200 hover:bg-violet-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-scissors text-[10px]" /> 数据裁剪
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[340px] p-5 animate-reveal">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
          <i className="fa-solid fa-scissors text-violet-500" /> 数据裁剪
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* 系列 */}
      <select
        value={targetId || seriesList[0]?.id || ''}
        onChange={e => setTargetId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-violet-400 mb-3"
      >
        {seriesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.data.length}点)</option>)}
      </select>

      {/* 模式 */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
        {([['range', '范围裁剪'], ['outlier', '去离群点'], ['decimate', '抽稀']] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 参数 */}
      {mode === 'range' && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">X 最小值</label>
            <input
              type="number"
              value={xMin}
              onChange={e => setXMin(e.target.value)}
              placeholder="−∞"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white outline-none focus:border-violet-400"
            />
          </div>
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">X 最大值</label>
            <input
              type="number"
              value={xMax}
              onChange={e => setXMax(e.target.value)}
              placeholder="+∞"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white outline-none focus:border-violet-400"
            />
          </div>
        </div>
      )}

      {mode === 'outlier' && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">IQR 倍数</label>
            <span className="text-[10px] font-mono font-bold text-violet-600">{iqrFactor}</span>
          </div>
          <input type="range" min={0.5} max={3} step={0.1} value={iqrFactor} onChange={e => setIqrFactor(parseFloat(e.target.value))} className="w-full accent-violet-600" />
          <p className="text-[8px] text-slate-400 mt-1">值越小，去除越多离群点</p>
        </div>
      )}

      {mode === 'decimate' && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-[8px] font-black text-slate-400 uppercase">抽稀步长</label>
            <span className="text-[10px] font-mono font-bold text-violet-600">每 {decimateStep} 取 1</span>
          </div>
          <input type="range" min={2} max={20} step={1} value={decimateStep} onChange={e => setDecimateStep(parseInt(e.target.value))} className="w-full accent-violet-600" />
          <p className="text-[8px] text-slate-400 mt-1">
            {target ? `${target.data.length} → ${Math.ceil(target.data.length / decimateStep)} 点` : ''}
          </p>
        </div>
      )}

      {/* 替换原始数据 */}
      <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-4 cursor-pointer">
        <input type="checkbox" checked={replaceOriginal} onChange={e => setReplaceOriginal(e.target.checked)} className="accent-violet-600" />
        直接替换原数据（不勾选则新建系列）
      </label>

      <button
        onClick={executeClip}
        className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all"
      >
        <i className="fa-solid fa-check mr-1.5" /> 执行裁剪
      </button>
    </div>
    </FixedPortal>
  );
};

export default DataClipTool;
