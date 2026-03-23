/**
 * ProcessFlowDesigner.tsx — 工艺流程可视化编辑器
 * 可视化展示从原料到成品的每一步工序，支持参数配置和 CCP 标记
 */
import React, { useState, useCallback } from 'react';
import { ProcessFlow, ProcessStep, ProcessStepType, Formulation } from '../../types';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);

const STEP_TYPE_CONFIG: Record<ProcessStepType, { label: string; icon: string; color: string; bg: string }> = {
  mixing:       { label: '混合搅拌', icon: 'fa-blender',        color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  heating:      { label: '加热升温', icon: 'fa-temperature-high',color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  drying:       { label: '干燥脱水', icon: 'fa-wind',           color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  coating:      { label: '涂覆成膜', icon: 'fa-paintbrush',     color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-200' },
  milling:      { label: '球磨研磨', icon: 'fa-mortar-pestle',  color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-200' },
  calcination:  { label: '煅烧退火', icon: 'fa-fire-flame-curved',color: 'text-orange-600',bg: 'bg-orange-50 border-orange-200' },
  filtration:   { label: '过滤分离', icon: 'fa-filter',         color: 'text-cyan-600',    bg: 'bg-cyan-50 border-cyan-200' },
  testing:      { label: '检测分析', icon: 'fa-microscope',     color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  other:        { label: '其他工序', icon: 'fa-ellipsis',       color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200' },
};

interface Props {
  flows: ProcessFlow[];
  setFlows: React.Dispatch<React.SetStateAction<ProcessFlow[]>>;
  formulations: Formulation[];
  showToast: (t: { message: string; type: 'error' | 'success' | 'info' | 'warning' }) => void;
}

const ProcessFlowDesigner: React.FC<Props> = ({ flows, setFlows, formulations, showToast }) => {
  const [editingFlow, setEditingFlow] = useState<ProcessFlow | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);

  const handleNewFlow = useCallback(() => {
    const flow: ProcessFlow = {
      id: genId(), name: '', version: 'v1.0', steps: [], createdAt: today(), updatedAt: today(),
    };
    setEditingFlow(flow);
    setShowModal(true);
  }, []);

  const handleEditFlow = useCallback((f: ProcessFlow) => {
    setEditingFlow({ ...f, steps: f.steps.map(s => ({ ...s, parameters: s.parameters.map(p => ({ ...p })) })) });
    setShowModal(true);
  }, []);

  const handleSaveFlow = useCallback(() => {
    if (!editingFlow) return;
    if (!editingFlow.name.trim()) { showToast({ message: '请输入流程名称', type: 'error' }); return; }
    const updated = { ...editingFlow, updatedAt: today() };
    setFlows(prev => {
      const idx = prev.findIndex(f => f.id === updated.id);
      return idx >= 0 ? prev.map(f => f.id === updated.id ? updated : f) : [updated, ...prev];
    });
    setShowModal(false); setEditingFlow(null); setEditingStepIdx(null);
    showToast({ message: '工艺流程已保存', type: 'success' });
  }, [editingFlow, setFlows, showToast]);

  const handleDeleteFlow = useCallback((id: string) => {
    setFlows(prev => prev.filter(f => f.id !== id));
    showToast({ message: '工艺流程已删除', type: 'info' });
  }, [setFlows, showToast]);

  const addStep = useCallback(() => {
    if (!editingFlow) return;
    const step: ProcessStep = {
      id: genId(), name: '', type: 'other', parameters: [], isCriticalControlPoint: false,
      duration: 0, durationUnit: 'min',
    };
    setEditingFlow(prev => prev ? { ...prev, steps: [...prev.steps, step] } : prev);
    setEditingStepIdx(editingFlow.steps.length);
  }, [editingFlow]);

  const updateStep = useCallback((idx: number, patch: Partial<ProcessStep>) => {
    setEditingFlow(prev => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      steps[idx] = { ...steps[idx], ...patch };
      return { ...prev, steps };
    });
  }, []);

  const removeStep = useCallback((idx: number) => {
    setEditingFlow(prev => prev ? { ...prev, steps: prev.steps.filter((_, i) => i !== idx) } : prev);
    setEditingStepIdx(null);
  }, []);

  const moveStep = useCallback((idx: number, dir: -1 | 1) => {
    setEditingFlow(prev => {
      if (!prev) return prev;
      const steps = [...prev.steps];
      const target = idx + dir;
      if (target < 0 || target >= steps.length) return prev;
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...prev, steps };
    });
    setEditingStepIdx(prev => prev !== null ? prev + dir : null);
  }, []);

  return (
    <div className="space-y-4 pb-12">
      {/* 新建按钮 */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">共 {flows.length} 条工艺流程</p>
        <button onClick={handleNewFlow} className="px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-cyan-700 transition-all active:scale-95 flex items-center gap-2">
          <i className="fa-solid fa-plus"></i>新建工艺流程
        </button>
      </div>

      {/* 流程卡片列表 */}
      {flows.length > 0 ? (
        <div className="space-y-4">
          {flows.map(flow => (
            <div key={flow.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
              {/* 流程头部 */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center"><i className="fa-solid fa-diagram-project text-cyan-600"></i></div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase">{flow.name || '未命名流程'}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md uppercase">{flow.version}</span>
                      <span className="text-[8px] font-bold text-slate-400">{flow.steps.length} 步工序 · {flow.steps.filter(s => s.isCriticalControlPoint).length} CCP</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEditFlow(flow)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 flex items-center justify-center transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
                  <button onClick={() => handleDeleteFlow(flow.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                </div>
              </div>

              {/* 流程步骤可视化 */}
              {flow.steps.length > 0 && (
                <div className="px-6 py-4 overflow-x-auto custom-scrollbar">
                  <div className="flex items-center gap-0 min-w-fit">
                    {flow.steps.map((step, i) => {
                      const cfg = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.other;
                      return (
                        <React.Fragment key={step.id}>
                          {i > 0 && (
                            <div className="flex items-center shrink-0 mx-1">
                              <div className="w-6 h-0.5 bg-slate-300"></div>
                              <i className="fa-solid fa-chevron-right text-[8px] text-slate-300"></i>
                            </div>
                          )}
                          <div className={`shrink-0 rounded-xl border-2 p-3 min-w-[120px] max-w-[160px] relative transition-all ${step.isCriticalControlPoint ? 'border-rose-400 bg-rose-50 shadow-md shadow-rose-100' : cfg.bg}`}>
                            {step.isCriticalControlPoint && (
                              <span className="absolute -top-2 -right-2 text-[7px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded-full shadow-sm uppercase">CCP</span>
                            )}
                            <div className="flex items-center gap-2 mb-1.5">
                              <i className={`fa-solid ${cfg.icon} text-[10px] ${step.isCriticalControlPoint ? 'text-rose-600' : cfg.color}`}></i>
                              <span className="text-[8px] font-black text-slate-400 uppercase">{cfg.label}</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-700 truncate leading-tight">{step.name || '—'}</p>
                            {step.parameters.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {step.parameters.slice(0, 2).map((p, j) => (
                                  <p key={j} className="text-[8px] font-bold text-slate-500">{p.key}: {p.target}{p.unit}</p>
                                ))}
                              </div>
                            )}
                            <p className="text-[8px] font-bold text-slate-400 mt-1.5 flex items-center gap-1"><i className="fa-regular fa-clock text-[7px]"></i>{step.duration}{step.durationUnit === 'h' ? 'h' : 'min'}</p>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-5 opacity-40">
          <div className="w-20 h-20 rounded-full bg-cyan-50 border-2 border-cyan-100 flex items-center justify-center"><i className="fa-solid fa-diagram-project text-cyan-300 text-3xl"></i></div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem]">暂无工艺流程</p>
        </div>
      )}

      {/* ═══ 流程编辑弹窗 ═══ */}
      {showModal && editingFlow && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl animate-reveal flex flex-col max-h-[92vh] overflow-hidden border-2 border-cyan-100">
            <header className="px-8 py-5 bg-gradient-to-r from-cyan-600 to-teal-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-diagram-project text-lg"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">工艺流程编辑器</h3>
                  <p className="text-[9px] font-bold text-cyan-200 uppercase tracking-widest">PROCESS FLOW DESIGNER</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveFlow} className="px-6 py-2.5 bg-white text-cyan-700 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-cyan-50 transition-all active:scale-95 flex items-center gap-2"><i className="fa-solid fa-check"></i>保存流程</button>
                <button onClick={() => { setShowModal(false); setEditingFlow(null); setEditingStepIdx(null); }} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-lg"></i></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">流程名称</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-400 transition-all"
                    placeholder="例：NiFe-LDH 制备流程" value={editingFlow.name} onChange={e => setEditingFlow(p => p ? { ...p, name: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">版本</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-cyan-400 transition-all"
                    value={editingFlow.version} onChange={e => setEditingFlow(p => p ? { ...p, version: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">关联配方</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingFlow.formulationId || ''} onChange={e => setEditingFlow(p => p ? { ...p, formulationId: e.target.value || undefined } : p)}>
                    <option value="">未关联</option>
                    {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}
                  </select>
                </div>
              </div>

              {/* 工序列表 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-list-ol text-cyan-500"></i>工序步骤</h4>
                  <button onClick={addStep} className="text-[9px] font-black text-cyan-600 hover:text-cyan-800 flex items-center gap-1"><i className="fa-solid fa-plus"></i>添加工序</button>
                </div>

                {editingFlow.steps.length > 0 ? (
                  <div className="space-y-2">
                    {editingFlow.steps.map((step, idx) => {
                      const cfg = STEP_TYPE_CONFIG[step.type] || STEP_TYPE_CONFIG.other;
                      const isExpanded = editingStepIdx === idx;
                      return (
                        <div key={step.id} className={`rounded-xl border-2 transition-all ${step.isCriticalControlPoint ? 'border-rose-300 bg-rose-50/50' : isExpanded ? 'border-cyan-300 bg-cyan-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                          {/* 折叠行 */}
                          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setEditingStepIdx(isExpanded ? null : idx)}>
                            <span className="text-[9px] font-black text-slate-400 w-5 text-center">{idx + 1}</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}><i className={`fa-solid ${cfg.icon} text-[10px] ${cfg.color}`}></i></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-slate-700 truncate">{step.name || cfg.label}</p>
                              <p className="text-[8px] font-bold text-slate-400">{cfg.label} · {step.duration}{step.durationUnit === 'h' ? 'h' : 'min'} {step.parameters.length > 0 ? `· ${step.parameters.length}参数` : ''}</p>
                            </div>
                            {step.isCriticalControlPoint && <span className="text-[7px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded-full uppercase">CCP</span>}
                            <div className="flex gap-1">
                              <button onClick={e => { e.stopPropagation(); moveStep(idx, -1); }} disabled={idx === 0} className="w-6 h-6 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 flex items-center justify-center"><i className="fa-solid fa-chevron-up text-[8px]"></i></button>
                              <button onClick={e => { e.stopPropagation(); moveStep(idx, 1); }} disabled={idx === editingFlow.steps.length - 1} className="w-6 h-6 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 flex items-center justify-center"><i className="fa-solid fa-chevron-down text-[8px]"></i></button>
                              <button onClick={e => { e.stopPropagation(); removeStep(idx); }} className="w-6 h-6 rounded text-slate-300 hover:text-rose-500 flex items-center justify-center"><i className="fa-solid fa-xmark text-[9px]"></i></button>
                            </div>
                            <i className={`fa-solid fa-chevron-down text-[8px] text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </div>

                          {/* 展开详情 */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">工序名称</label>
                                  <input className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none"
                                    value={step.name} onChange={e => updateStep(idx, { name: e.target.value })} placeholder="例：球磨混合" />
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">工序类型</label>
                                  <select className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer"
                                    value={step.type} onChange={e => updateStep(idx, { type: e.target.value as ProcessStepType })}>
                                    {Object.entries(STEP_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">时长</label>
                                  <div className="flex gap-1">
                                    <input type="number" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none"
                                      value={step.duration || ''} onChange={e => updateStep(idx, { duration: parseFloat(e.target.value) || 0 })} />
                                    <select className="w-14 bg-white border border-slate-200 rounded-lg px-1 py-2 text-[10px] font-bold outline-none cursor-pointer"
                                      value={step.durationUnit} onChange={e => updateStep(idx, { durationUnit: e.target.value as 'min' | 'h' })}>
                                      <option value="min">min</option><option value="h">h</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex items-end">
                                  <button onClick={() => updateStep(idx, { isCriticalControlPoint: !step.isCriticalControlPoint })}
                                    className={`w-full py-2 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${step.isCriticalControlPoint ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500'}`}>
                                    <i className={`fa-solid ${step.isCriticalControlPoint ? 'fa-shield-halved' : 'fa-shield'} text-[9px]`}></i>
                                    {step.isCriticalControlPoint ? 'CCP 已标记' : '标记为 CCP'}
                                  </button>
                                </div>
                              </div>

                              {/* 参数列表 */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <label className="text-[8px] font-black text-slate-400 uppercase">工艺参数</label>
                                  <button onClick={() => {
                                    const params = [...step.parameters, { key: '', target: 0, min: 0, max: 0, unit: '' }];
                                    updateStep(idx, { parameters: params });
                                  }} className="text-[8px] font-black text-cyan-600 hover:text-cyan-800 flex items-center gap-0.5"><i className="fa-solid fa-plus text-[7px]"></i>添加</button>
                                </div>
                                {step.parameters.map((p, pi) => (
                                  <div key={pi} className="flex items-center gap-1.5 mb-1">
                                    <input className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" placeholder="参数名" value={p.key}
                                      onChange={e => { const params = [...step.parameters]; params[pi] = { ...params[pi], key: e.target.value }; updateStep(idx, { parameters: params }); }} />
                                    <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none text-center" placeholder="目标" value={p.target || ''}
                                      onChange={e => { const params = [...step.parameters]; params[pi] = { ...params[pi], target: parseFloat(e.target.value) || 0 }; updateStep(idx, { parameters: params }); }} />
                                    <span className="text-[8px] text-slate-400">±</span>
                                    <input type="number" className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none text-center" placeholder="min" value={p.min || ''}
                                      onChange={e => { const params = [...step.parameters]; params[pi] = { ...params[pi], min: parseFloat(e.target.value) || 0 }; updateStep(idx, { parameters: params }); }} />
                                    <span className="text-[8px] text-slate-400">~</span>
                                    <input type="number" className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none text-center" placeholder="max" value={p.max || ''}
                                      onChange={e => { const params = [...step.parameters]; params[pi] = { ...params[pi], max: parseFloat(e.target.value) || 0 }; updateStep(idx, { parameters: params }); }} />
                                    <input className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none" placeholder="单位" value={p.unit}
                                      onChange={e => { const params = [...step.parameters]; params[pi] = { ...params[pi], unit: e.target.value }; updateStep(idx, { parameters: params }); }} />
                                    <button onClick={() => { const params = step.parameters.filter((_, j) => j !== pi); updateStep(idx, { parameters: params }); }}
                                      className="w-6 h-6 rounded text-slate-300 hover:text-rose-500 flex items-center justify-center shrink-0"><i className="fa-solid fa-xmark text-[8px]"></i></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <i className="fa-solid fa-arrow-down text-2xl mb-2 opacity-30"></i>
                    <p className="text-[10px] font-black uppercase tracking-wider">点击上方"添加工序"开始设计流程</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessFlowDesigner;
