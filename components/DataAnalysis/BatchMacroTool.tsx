import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import {
  movingAverage, savitzkyGolay, polynomialBaseline, alsBaseline,
  normalizeMinMax, normalizeZScore, normalizeArea,
  numericalDerivative, cumulativeIntegral,
} from '../../utils/dataProcessing';

interface BatchMacroToolProps {
  seriesList: DataSeries[];
  onSetSeriesList: (updater: (prev: any[]) => any[]) => void;
}

interface MacroStep {
  id: string;
  type: MacroType;
  label: string;
  params: Record<string, number>;
}

type MacroType =
  | 'movingAvg' | 'savGolay' | 'polyBaseline' | 'alsBaseline'
  | 'normMinMax' | 'normZScore' | 'normArea'
  | 'derivative' | 'integral';

const MACRO_DEFS: { type: MacroType; label: string; defaults: Record<string, number> }[] = [
  { type: 'movingAvg', label: '移动平均', defaults: { window: 5 } },
  { type: 'savGolay', label: 'S-G 平滑', defaults: { window: 7 } },
  { type: 'polyBaseline', label: '多项式基线', defaults: { degree: 3 } },
  { type: 'alsBaseline', label: 'ALS 基线', defaults: {} },
  { type: 'normMinMax', label: 'Min-Max 归一', defaults: {} },
  { type: 'normZScore', label: 'Z-Score 归一', defaults: {} },
  { type: 'normArea', label: '面积归一', defaults: {} },
  { type: 'derivative', label: '一阶导数', defaults: {} },
  { type: 'integral', label: '累积积分', defaults: {} },
];

/**
 * 批处理宏系统 — 用户编排操作序列，一键应用到所有 / 选中的系列
 */
const BatchMacroTool: React.FC<BatchMacroToolProps> = ({ seriesList, onSetSeriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [steps, setSteps] = useState<MacroStep[]>([]);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const addStep = (type: MacroType) => {
    const def = MACRO_DEFS.find(d => d.type === type)!;
    setSteps(prev => [...prev, {
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type, label: def.label, params: { ...def.defaults },
    }]);
  };

  const removeStep = (id: string) => setSteps(prev => prev.filter(s => s.id !== id));

  const moveStep = (id: string, dir: -1 | 1) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const applyProcessing = (data: { x: number; y: number }[], step: MacroStep): { x: number; y: number }[] => {
    const pts = data.map(d => ({ x: d.x, y: d.y }));
    switch (step.type) {
      case 'movingAvg': return movingAverage(pts, step.params.window || 5);
      case 'savGolay': return savitzkyGolay(pts, step.params.window || 7);
      case 'polyBaseline': return polynomialBaseline(pts, step.params.degree || 3);
      case 'alsBaseline': return alsBaseline(pts);
      case 'normMinMax': return normalizeMinMax(pts);
      case 'normZScore': return normalizeZScore(pts);
      case 'normArea': return normalizeArea(pts);
      case 'derivative': return numericalDerivative(pts);
      case 'integral': return cumulativeIntegral(pts);
      default: return pts;
    }
  };

  const executeMacro = useCallback(() => {
    if (steps.length === 0) return;

    const targetIds = applyToAll
      ? seriesList.map(s => s.id)
      : Array.from(selectedIds);

    onSetSeriesList((prev: DataSeries[]) =>
      prev.map(series => {
        if (!targetIds.includes(series.id)) return series;

        let data = series.data
          .map(d => ({ x: parseFloat(d.name), y: d.value }))
          .filter(d => !isNaN(d.x) && !isNaN(d.y))
          .sort((a, b) => a.x - b.x);

        // 依序应用每个步骤
        for (const step of steps) {
          data = applyProcessing(data, step);
        }

        const newData: ChartDataPoint[] = data.map(d => ({
          name: String(d.x), value: d.y,
        }));

        return { ...series, data: newData };
      })
    );

    setIsExpanded(false);
  }, [steps, seriesList, applyToAll, selectedIds, onSetSeriesList]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-teal-600 border-teal-200 hover:bg-teal-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-list-check text-[10px]" /> 批处理
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[380px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-list-check text-teal-500" /> 批处理宏
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* 添加步骤 */}
      <div className="mb-3">
        <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">添加操作</label>
        <div className="flex flex-wrap gap-1">
          {MACRO_DEFS.map(d => (
            <button
              key={d.type}
              onClick={() => addStep(d.type)}
              className="px-2 py-1 rounded-md text-[8px] font-bold border border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-all"
            >
              + {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* 步骤列表 */}
      {steps.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <label className="text-[8px] font-black text-slate-400 uppercase">操作序列 ({steps.length} 步)</label>
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
              <span className="text-[8px] font-black text-teal-500 w-4">{idx + 1}</span>
              <span className="text-[10px] font-bold text-slate-600 flex-1">{step.label}</span>
              {Object.entries(step.params).map(([k, v]) => (
                <input
                  key={k}
                  type="number"
                  value={v}
                  onChange={e => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, params: { ...s.params, [k]: parseFloat(e.target.value) } } : s))}
                  className="w-12 px-1 py-0.5 text-[9px] font-mono text-center border border-slate-200 rounded bg-white outline-none"
                  title={k}
                />
              ))}
              <button onClick={() => moveStep(step.id, -1)} className="text-[9px] text-slate-400 hover:text-teal-600" title="上移"><i className="fa-solid fa-chevron-up" /></button>
              <button onClick={() => moveStep(step.id, 1)} className="text-[9px] text-slate-400 hover:text-teal-600" title="下移"><i className="fa-solid fa-chevron-down" /></button>
              <button onClick={() => removeStep(step.id)} className="text-[9px] text-slate-400 hover:text-red-500" title="删除"><i className="fa-solid fa-trash-can" /></button>
            </div>
          ))}
        </div>
      )}

      {/* 目标选择 */}
      <div className="mb-3">
        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer mb-1.5">
          <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="accent-teal-600" />
          应用到所有系列
        </label>
        {!applyToAll && (
          <div className="max-h-[80px] overflow-y-auto custom-scrollbar space-y-1">
            {seriesList.map(s => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1 text-[9px] font-bold text-slate-500 cursor-pointer">
                <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleId(s.id)} className="accent-teal-600" />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={executeMacro}
        disabled={steps.length === 0}
        className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
      >
        <i className="fa-solid fa-play mr-1.5" /> 执行宏 ({steps.length} 步 × {applyToAll ? seriesList.length : selectedIds.size} 系列)
      </button>
    </div>
    </FixedPortal>
  );
};

export default BatchMacroTool;
