
import React, { useState, useEffect, useCallback } from 'react';

interface GeneratedExperiment {
  title: string;
  notes: string;
  matrix: { name: string; target: string; range: string }[];
  runs: { idx: number; label: string; sampleId?: string; params: Record<string, string>; fullParams?: { key: string; value: string; unit: string }[]; description?: string }[];
  sourceTaskIndex: number;
}

interface SkippedTask {
  index: number;
  reason: string;
}

interface ExperimentFlowPreviewModalProps {
  show: boolean;
  experiments: GeneratedExperiment[];
  skippedTasks: SkippedTask[];
  taskTitles: string[];
  onConfirm: (selectedExperiments: GeneratedExperiment[]) => void;
  onClose: () => void;
}

const ExperimentFlowPreviewModal: React.FC<ExperimentFlowPreviewModalProps> = ({
  show, experiments, skippedTasks, taskTitles, onConfirm, onClose
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(experiments.map((_, i) => i))
  );

  // 可编辑的实验数据副本
  const [editableExperiments, setEditableExperiments] = useState<GeneratedExperiment[]>([]);

  // 展开描述编辑的 run key（格式: "expIdx-runIdx"）
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // 重置
  useEffect(() => {
    setSelectedIndices(new Set(experiments.map((_, i) => i)));
    setEditableExperiments(JSON.parse(JSON.stringify(experiments)));
    setExpandedDescriptions(new Set());
  }, [experiments]);

  const toggleSelect = (idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleDescription = useCallback((key: string) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // 更新 run 的 matrix 参数值（同步更新 params 和 fullParams 中对应的值）
  const updateRunParam = useCallback((expIdx: number, runIdx: number, paramKey: string, newValue: string) => {
    setEditableExperiments(prev => {
      const next = [...prev];
      next[expIdx] = {
        ...next[expIdx],
        runs: next[expIdx].runs.map((r, ri) => {
          if (ri !== runIdx) return r;
          const updatedParams = { ...r.params, [paramKey]: newValue };
          // 同步更新 fullParams 中相同 key 的值
          const updatedFullParams = (r.fullParams || []).map(fp =>
            fp.key === paramKey ? { ...fp, value: newValue } : fp
          );
          return { ...r, params: updatedParams, fullParams: updatedFullParams };
        })
      };
      return next;
    });
  }, []);

  // 更新 fullParams 中的值
  const updateFullParam = useCallback((expIdx: number, runIdx: number, paramIdx: number, field: 'key' | 'value' | 'unit', newValue: string) => {
    setEditableExperiments(prev => {
      const next = [...prev];
      next[expIdx] = {
        ...next[expIdx],
        runs: next[expIdx].runs.map((r, ri) => {
          if (ri !== runIdx) return r;
          const updatedFullParams = [...(r.fullParams || [])];
          updatedFullParams[paramIdx] = { ...updatedFullParams[paramIdx], [field]: newValue };
          return { ...r, fullParams: updatedFullParams };
        })
      };
      return next;
    });
  }, []);

  // 更新 run 的 label
  const updateRunLabel = useCallback((expIdx: number, runIdx: number, newLabel: string) => {
    setEditableExperiments(prev => {
      const next = [...prev];
      next[expIdx] = {
        ...next[expIdx],
        runs: next[expIdx].runs.map((r, ri) =>
          ri === runIdx ? { ...r, label: newLabel } : r
        )
      };
      return next;
    });
  }, []);

  // 更新 run 的 description
  const updateRunDescription = useCallback((expIdx: number, runIdx: number, newDesc: string) => {
    setEditableExperiments(prev => {
      const next = [...prev];
      next[expIdx] = {
        ...next[expIdx],
        runs: next[expIdx].runs.map((r, ri) =>
          ri === runIdx ? { ...r, description: newDesc } : r
        )
      };
      return next;
    });
  }, []);

  // 更新 run 的 sampleId
  const updateRunSampleId = useCallback((expIdx: number, runIdx: number, newSampleId: string) => {
    setEditableExperiments(prev => {
      const next = [...prev];
      next[expIdx] = {
        ...next[expIdx],
        runs: next[expIdx].runs.map((r, ri) =>
          ri === runIdx ? { ...r, sampleId: newSampleId } : r
        )
      };
      return next;
    });
  }, []);

  const selectedCount = selectedIndices.size;

  if (!show || experiments.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] animate-reveal shadow-2xl border-4 border-indigo-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner border border-white/20">
              <i className="fa-solid fa-flask-vial"></i>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter">AI 实验流设计预览</h3>
              <p className="text-[9px] font-black text-indigo-200 uppercase tracking-[0.2rem] mt-1">
                识别到 {experiments.length} 个实验任务 · {skippedTasks.length} 个非实验任务已跳过 · 点击参数值可手动调整
              </p>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
          {editableExperiments.map((exp, i) => (
            <div
              key={i}
              className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                selectedIndices.has(i)
                  ? 'border-indigo-300 bg-white shadow-lg'
                  : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              {/* Experiment Header */}
              <div
                className="flex items-start gap-3 p-5 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                onClick={() => toggleSelect(i)}
              >
                <input
                  type="checkbox"
                  checked={selectedIndices.has(i)}
                  onChange={() => toggleSelect(i)}
                  className="mt-1 accent-indigo-600 w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase border border-indigo-100">
                      实验流 #{i + 1}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400">
                      来源: 任务 {exp.sourceTaskIndex + 1} 「{taskTitles[exp.sourceTaskIndex]?.substring(0, 30)}…」
                    </span>
                  </div>
                  <h4 className="text-[15px] font-black text-slate-800 mt-1.5 italic">{exp.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-1">{exp.notes}</p>
                </div>
              </div>

              {/* Matrix & Runs */}
              {selectedIndices.has(i) && (
                <div className="px-5 pb-5 space-y-3">
                  {/* Factors */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <i className="fa-solid fa-sliders text-indigo-400"></i> 实验因子 ({exp.matrix.length})
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left px-3 py-2 font-black text-slate-500 uppercase text-[9px] rounded-tl-lg">因子名</th>
                            <th className="text-left px-3 py-2 font-black text-slate-500 uppercase text-[9px]">单位</th>
                            <th className="text-left px-3 py-2 font-black text-slate-500 uppercase text-[9px] rounded-tr-lg">取值范围</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exp.matrix.map((m, mi) => (
                            <tr key={mi} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-bold text-slate-700">{m.name}</td>
                              <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">{m.target}</td>
                              <td className="px-3 py-2 text-indigo-600 font-bold">{m.range}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Runs - Editable */}
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                      <i className="fa-solid fa-list-ol text-emerald-400"></i> 正交实验组 ({exp.runs.length} 组)
                      <span className="text-[8px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 ml-2">
                        <i className="fa-solid fa-pen text-[7px] mr-1"></i>可编辑
                      </span>
                    </p>
                    <div className="grid gap-2">
                      {exp.runs.map((run, ri) => {
                        const descKey = `${i}-${ri}`;
                        const isDescExpanded = expandedDescriptions.has(descKey);
                        return (
                          <div key={run.idx} className="bg-gradient-to-r from-emerald-50/60 to-teal-50/40 rounded-xl border border-emerald-100 overflow-hidden">
                            <div className="flex items-start gap-3 px-4 py-2.5">
                              <span className="w-6 h-6 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm mt-0.5">
                                {run.idx}
                              </span>
                              <div className="flex-1 min-w-0">
                                {/* SampleId + Label */}
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center bg-amber-50 border border-amber-200 rounded-lg overflow-hidden shrink-0">
                                    <span className="text-[7px] font-black text-amber-600 px-1.5 py-0.5 bg-amber-100 border-r border-amber-200">样品</span>
                                    <input
                                      type="text"
                                      value={run.sampleId || ''}
                                      onChange={(e) => updateRunSampleId(i, ri, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="NiFe-Ce3%"
                                      className="text-[9px] font-black text-amber-700 font-mono px-1.5 py-0.5 w-24 bg-transparent outline-none focus:bg-amber-50 transition-colors"
                                      title="编辑样品标识"
                                    />
                                  </div>
                                  <input
                                    type="text"
                                    value={run.label}
                                    onChange={(e) => updateRunLabel(i, ri, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] font-black text-emerald-700 bg-transparent border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:bg-white focus:px-2 outline-none transition-all flex-1 rounded-md py-0.5"
                                    title="点击编辑方案名称"
                                  />
                                </div>
                                {/* Matrix 变化因子 */}
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {Object.entries(run.params).map(([k, v]) => {
                                    const matrixItem = exp.matrix.find(m => m.name === k);
                                    return (
                                      <div key={k} className="flex items-center bg-white rounded-lg border-2 border-indigo-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <span className="text-[9px] font-black text-white px-2 py-1 bg-indigo-500 border-r border-indigo-300">{k}</span>
                                        <input
                                          type="text"
                                          value={v}
                                          onChange={(e) => updateRunParam(i, ri, k, e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-[10px] font-bold text-indigo-700 font-mono px-2 py-1 w-20 bg-transparent outline-none focus:bg-indigo-50 transition-colors"
                                          title={`变化因子 · 范围: ${matrixItem?.range || '未知'} ${matrixItem?.target || ''}`}
                                        />
                                        {matrixItem?.target && (
                                          <span className="text-[8px] text-slate-400 pr-2 shrink-0">{matrixItem.target}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* fullParams 完整参数列表 */}
                                {run.fullParams && run.fullParams.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
                                      <i className="fa-solid fa-list-check text-[7px] text-violet-400"></i>
                                      完整参数 ({run.fullParams.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {run.fullParams.map((fp, fpi) => {
                                        const isMatrixFactor = Object.keys(run.params).includes(fp.key);
                                        return (
                                          <div key={fpi} className={`flex items-center rounded-lg border overflow-hidden text-[9px] ${
                                            isMatrixFactor
                                              ? 'border-indigo-200 bg-indigo-50/50'
                                              : 'border-slate-200 bg-slate-50/50 hover:border-violet-300'
                                          }`}>
                                            <span className={`px-1.5 py-0.5 font-bold border-r ${
                                              isMatrixFactor ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-slate-600 bg-slate-50 border-slate-100'
                                            }`}>{fp.key}</span>
                                            <input
                                              type="text"
                                              value={fp.value}
                                              onChange={(e) => updateFullParam(i, ri, fpi, 'value', e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                              className={`font-mono px-1.5 py-0.5 w-16 bg-transparent outline-none text-[9px] ${
                                                isMatrixFactor ? 'text-indigo-700 font-bold' : 'text-slate-700 focus:bg-violet-50'
                                              }`}
                                              readOnly={isMatrixFactor}
                                              title={isMatrixFactor ? '变化因子（上方已编辑）' : '点击修改固定参数值'}
                                            />
                                            {fp.unit && <span className="text-[7px] text-slate-400 pr-1.5 shrink-0">{fp.unit}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Description Toggle */}
                                {run.description && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleDescription(descKey); }}
                                    className="mt-2 text-[8px] font-black text-violet-500 uppercase flex items-center gap-1 hover:text-violet-700 transition-colors"
                                  >
                                    <i className={`fa-solid ${isDescExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[7px]`}></i>
                                    {isDescExpanded ? '收起' : '展开'}实验描述 (OBSERVATION)
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Editable Description */}
                            {isDescExpanded && (
                              <div className="px-4 pb-3 pt-1 animate-reveal" onClick={(e) => e.stopPropagation()}>
                                <textarea
                                  value={run.description || ''}
                                  onChange={(e) => updateRunDescription(i, ri, e.target.value)}
                                  className="w-full text-[11px] text-slate-700 leading-relaxed bg-white border border-violet-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-violet-300 transition-all resize-y min-h-[100px] max-h-[300px] custom-scrollbar font-medium"
                                  placeholder="填写详细的实验操作步骤…"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Skipped Tasks */}
          {skippedTasks.length > 0 && (
            <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                <i className="fa-solid fa-forward text-slate-300"></i> 已跳过的非实验任务
              </p>
              <div className="space-y-1">
                {skippedTasks.map((st, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full shrink-0"></span>
                    <span className="font-bold">{taskTitles[st.index]?.substring(0, 40)}</span>
                    <span className="text-slate-300">— {st.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-slate-100 shrink-0 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all active:scale-[0.98]"
          >
            跳过生成
          </button>
          <button
            onClick={() => {
              const selected = editableExperiments.filter((_, i) => selectedIndices.has(i));
              onConfirm(selected);
            }}
            disabled={selectedCount === 0}
            className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-check-circle"></i>
            确认生成 {selectedCount} 个实验流
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExperimentFlowPreviewModal;
