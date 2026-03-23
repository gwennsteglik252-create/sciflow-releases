import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import { BUILT_IN_MODELS, fitCurve, FitResult } from '../../utils/curveFitting';

interface AIFitAdvisorProps {
  seriesList: DataSeries[];
  onAddSeries: (series: DataSeries) => void;
}

interface ModelScore {
  modelId: string;
  modelName: string;
  formula: string;
  rSquared: number;
  rmse: number;
  aic: number;
  bic: number;
  result: FitResult;
}

/**
 * AI 辅助拟合 — 自动尝试所有内置模型，根据 R² 和 RMSE 推荐最佳拟合
 */
const AIFitAdvisor: React.FC<AIFitAdvisorProps> = ({ seriesList, onAddSeries }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [scores, setScores] = useState<ModelScore[]>([]);

  const runAutoFit = useCallback(async () => {
    const target = seriesList.find(s => s.id === (targetId || seriesList[0]?.id));
    if (!target) return;

    setIsRunning(true);

    const data = target.data
      .map(d => ({ x: parseFloat(d.name), y: d.value }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y))
      .sort((a, b) => a.x - b.x);

    // 逐个尝试所有模型
    const results: ModelScore[] = [];

    for (const model of BUILT_IN_MODELS) {
      try {
        const result = fitCurve(data, model);
        if (result.converged && result.rSquared > 0) {
          results.push({
            modelId: model.id,
            modelName: model.name,
            formula: model.formula,
            rSquared: result.rSquared,
            rmse: result.rmse,
            aic: result.aic,
            bic: result.bic,
            result,
          });
        }
      } catch {
        // 模型拟合失败，跳过
      }
    }

    // 按 AIC 排序（越小越好），AIC 无穷大的放最后
    results.sort((a, b) => {
      const aicA = isFinite(a.aic) ? a.aic : 1e18;
      const aicB = isFinite(b.aic) ? b.aic : 1e18;
      return aicA - aicB;
    });
    setScores(results);
    setIsRunning(false);
  }, [seriesList, targetId]);

  const applyBestFit = useCallback((score: ModelScore) => {
    const fittedData: ChartDataPoint[] = score.result.fittedCurve.map(p => ({
      name: String(p.x), value: p.y,
    }));

    onAddSeries({
      id: `ai_fit_${score.modelId}_${Date.now()}`,
      name: `AI拟合: ${score.modelName}`,
      data: fittedData,
      color: '#dc2626',
      pointColor: '#dc2626',
      strokeWidth: 2,
      visible: true,
      pointShape: 'none',
      pointSize: 0,
    });

    setIsExpanded(false);
  }, [onAddSeries]);

  const getRank = (idx: number) => {
    if (idx === 0) return { emoji: '🥇', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
    if (idx === 1) return { emoji: '🥈', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' };
    if (idx === 2) return { emoji: '🥉', color: 'text-orange-400', bg: 'bg-orange-50 border-orange-200' };
    return { emoji: '', color: 'text-slate-400', bg: 'border-slate-100' };
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetId && seriesList.length > 0) setTargetId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-indigo-300 hover:shadow-lg active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-wand-magic-sparkles text-[10px]" /> AI 拟合
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[400px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-wand-magic-sparkles text-indigo-500" /> AI 智能拟合顾问
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <select
        value={targetId || seriesList[0]?.id || ''}
        onChange={e => setTargetId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-400 mb-3"
      >
        {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <p className="text-[8px] text-slate-400 mb-3">
        自动尝试 {BUILT_IN_MODELS.length} 种内置模型，按拟合度排名推荐
      </p>

      <button
        onClick={runAutoFit}
        disabled={isRunning}
        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-60 mb-3"
      >
        {isRunning ? (
          <><i className="fa-solid fa-spinner fa-spin mr-1.5" /> 分析中...</>
        ) : (
          <><i className="fa-solid fa-robot mr-1.5" /> 启动智能分析</>
        )}
      </button>

      {scores.length > 0 && (
        <div className="space-y-2 animate-reveal">
          <div className="text-[10px] font-black text-slate-500 mb-1">
            <i className="fa-solid fa-trophy text-amber-500 mr-1" />
            模型排名 ({scores.length} 个有效拟合)
          </div>

          {scores.slice(0, 5).map((score, idx) => {
            const rank = getRank(idx);
            return (
              <div key={score.modelId} className={`border rounded-xl p-3 ${rank.bg} transition-all`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-black flex items-center gap-1.5">
                    {rank.emoji && <span>{rank.emoji}</span>}
                    <span className={rank.color}>{score.modelName}</span>
                  </span>
                  <button
                    onClick={() => applyBestFit(score)}
                    className="px-2 py-1 bg-indigo-600 text-white rounded-md text-[8px] font-black uppercase hover:bg-indigo-500 active:scale-95 transition-all"
                  >
                    应用
                  </button>
                </div>
                <div className="text-[9px] font-mono text-slate-500 mb-1.5">{score.formula}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px]">
                  <span className="font-bold">
                    R² = <span className={score.rSquared > 0.95 ? 'text-emerald-600' : score.rSquared > 0.8 ? 'text-amber-600' : 'text-red-500'}>
                      {score.rSquared.toFixed(6)}
                    </span>
                  </span>
                  <span className="text-slate-400">RMSE = {score.rmse.toFixed(4)}</span>
                  <span className="text-teal-600 font-bold">AIC = {isFinite(score.aic) ? score.aic.toFixed(1) : '—'}</span>
                  <span className="text-cyan-600">BIC = {isFinite(score.bic) ? score.bic.toFixed(1) : '—'}</span>
                </div>
                {score.result.params.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {score.result.params.map(p => (
                      <span key={p.name} className="bg-white rounded px-1.5 py-0.5 text-[8px] font-mono border border-slate-100">
                        {p.name}={p.value.toFixed(4)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

export default AIFitAdvisor;
