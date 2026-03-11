
import React, { useMemo } from 'react';
import { DOEFactor, ResearchProject } from '../../types';

interface SuggestionPanelProps {
  suggestion: any | null;
  factors: DOEFactor[];
  setSuggestion: (val: any) => void;
  setLoadedArchiveId: (val: string | null) => void;
  setShowSaveModal: (show: boolean) => void;
  setShowSyncModal: (show: boolean) => void;
  setIsBatchSync: (val: boolean) => void;
  loadedArchiveId: string | null;
  selectedIdx: number;
  onSelectRecommendation: (idx: number) => void;
  projects?: ResearchProject[];
  onTracePlan?: (projectId: string, subView: string) => void; 
}

const SuggestionPanel: React.FC<SuggestionPanelProps> = ({
  suggestion, factors, setSuggestion, setLoadedArchiveId, setShowSaveModal, setShowSyncModal, setIsBatchSync, loadedArchiveId,
  selectedIdx, onSelectRecommendation, projects = [], onTracePlan
}) => {
  
  // --- 性能优化：引入索引式溯源检索 ---
  const traceManifest = useMemo(() => {
    const result = { 
        globalSubView: null as string | null, 
        globalProjectId: null as string | null, 
        individualSubViews: new Map<string, {subView: string, projectId: string}>() 
    };
    
    // 快速拦截：无数据或无存档 ID 时跳过扫描
    if (!suggestion || !loadedArchiveId || !projects || projects.length === 0) return result;
    
    // 采用项目级预过滤，减少不必要的里程碑深度遍历
    for (const p of projects) {
        // 如果项目标题或描述与当前 DOE 无关，且项目未标注有来自此存档的内容，可跳过
        // 此处通过匹配 sourceProposalId 建立快速查找
        let matchedInProject = false;

        // 1. 扫描里程碑中的实验矩阵
        for (const ms of p.milestones) {
            if (!ms.experimentalPlan) continue;
            for (const plan of ms.experimentalPlan) {
                if (plan.sourceProposalId === loadedArchiveId) {
                    matchedInProject = true;
                    // 标记全局同步视图
                    if (plan.title.includes('联合对标') || plan.runs?.length === 3) {
                        result.globalSubView = `plan:${plan.id}`;
                        result.globalProjectId = p.id;
                    }
                    // 标记单项方案视图
                    const titleL = plan.title.toLowerCase();
                    if (titleL.includes('aggressive') || titleL.includes('激进')) result.individualSubViews.set('aggressive', { subView: `plan:${plan.id}`, projectId: p.id });
                    if (titleL.includes('explorer') || titleL.includes('探索')) result.individualSubViews.set('explorer', { subView: `plan:${plan.id}`, projectId: p.id });
                    if (titleL.includes('robust') || titleL.includes('稳健')) result.individualSubViews.set('robust', { subView: `plan:${plan.id}`, projectId: p.id });
                }
            }
        }

        // 2. 扫描周计划任务 (仅当里程碑未完全覆盖时)
        if (!matchedInProject && p.weeklyPlans) {
            for (const wp of p.weeklyPlans) {
                for (const t of wp.tasks) {
                    if (t.sourceProposalId === loadedArchiveId) {
                        if (!result.globalSubView && t.linkedPlanId) {
                            result.globalSubView = `plan:${t.linkedPlanId}`;
                            result.globalProjectId = p.id;
                        }
                    }
                }
            }
        }
    }
    return result;
  }, [projects, loadedArchiveId, suggestion]);

  if (!suggestion) {
    return (
      <div className="flex-1 bg-white rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-12 text-center animate-in backdrop-blur-sm relative group">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl mb-12 text-slate-200 group-hover:scale-105 transition-transform duration-700 border border-slate-50">
          <i className="fa-solid fa-compass text-6xl"></i>
        </div>
        <h4 className="text-3xl font-black text-slate-400 uppercase tracking-[0.8rem] italic mb-6">等待推演启动</h4>
        <p className="text-[13px] font-black text-slate-300 uppercase tracking-widest max-w-sm leading-relaxed">请在左侧录入至少 2 组现有数据<br/>AI 将自动探测工艺敏感性并生成优化矩阵</p>
        <div className="mt-14 flex gap-4 opacity-30">
          {[0, 0.2, 0.4].map(delay => <div key={delay} className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${delay}s` }}></div>)}
        </div>
      </div>
    );
  }

  const recommendations = suggestion.recommendations || [];

  return (
    <div className="flex-1 flex flex-col gap-4 animate-reveal overflow-y-auto pr-3 custom-scrollbar pb-10">
      <div className="flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-end px-1 mb-2">
             <div className="flex flex-col gap-1">
                <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3rem] italic border-l-4 border-indigo-600 pl-4 leading-none">多维优化方案矩阵 (RECOMMENDATIONS)</h5>
                <p className="text-[8px] text-slate-400 font-bold uppercase ml-4">针对当前工艺空间提出的差异化候选方案</p>
             </div>
             <div className="flex items-center gap-2">
                {traceManifest.globalSubView && (
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if (traceManifest.globalProjectId && traceManifest.globalSubView) {
                                onTracePlan?.(traceManifest.globalProjectId, traceManifest.globalSubView); 
                            }
                        }}
                        className="px-5 py-2 bg-emerald-600 text-white border-2 border-emerald-500 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-100/50 hover:bg-black transition-all flex items-center gap-2 active:scale-95 animate-reveal"
                    >
                        <i className="fa-solid fa-arrow-right-long"></i> 溯源同步矩阵
                    </button>
                )}

                <button 
                    onClick={() => { setIsBatchSync(true); setShowSyncModal(true); }} 
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:brightness-110 transition-all flex items-center gap-2 border border-white/20 active:scale-95"
                >
                    <i className="fa-solid fa-layer-group"></i> 一键同步全量
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                {!loadedArchiveId && <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all border border-slate-200 shadow-sm">存入推演库</button>}
                <button onClick={() => { setSuggestion(null); setLoadedArchiveId(null); }} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90" title="关闭结果"><i className="fa-solid fa-xmark text-base"></i></button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec: any, idx: number) => {
                  const isActive = selectedIdx === idx;
                  const labelStr = rec.label.toLowerCase();
                  const typeKey = labelStr.includes('aggressive') || rec.label.includes('激进') ? 'aggressive' : 
                                 labelStr.includes('explorer') || rec.label.includes('探索') ? 'explorer' : 'robust';
                  
                  const isAggressive = typeKey === 'aggressive';
                  const isExplorer = typeKey === 'explorer';
                  const hasCI = typeof rec.predictedValue === 'number';
                  const individualMeta = traceManifest.individualSubViews.get(typeKey);

                  return (
                      <div 
                        key={idx} 
                        onClick={() => onSelectRecommendation(idx)}
                        className={`bg-white p-5 rounded-[2rem] border-2 transition-all cursor-pointer flex flex-col relative overflow-hidden group ${isActive ? 'border-indigo-600 shadow-xl ring-4 ring-indigo-50' : 'border-slate-100 shadow-sm hover:border-indigo-200 hover:bg-slate-50/30'}`}
                      >
                          <div className={`absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none transition-transform group-hover:scale-110 ${isActive ? 'opacity-[0.1]' : ''}`}>
                              <i className={`fa-solid ${isAggressive ? 'fa-bolt-lightning' : isExplorer ? 'fa-satellite-dish' : 'fa-check-double'} text-6xl`}></i>
                          </div>

                          <div className="flex justify-between items-start mb-4 relative z-10">
                              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{rec.label}</span>
                              <div className="flex flex-col items-end">
                                  <span className={`text-[10px] font-black italic ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{rec.confidenceScore}%</span>
                                  <span className="text-[6px] font-bold text-slate-300 uppercase leading-none">Conf.</span>
                              </div>
                          </div>

                          <div className="space-y-2 flex-1 relative z-10">
                              {Object.entries(rec.params as Record<string, any>).map(([k, v]) => (
                                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase truncate pr-2">{k}</span>
                                      <span className={`text-sm font-black font-mono italic ${isActive ? 'text-indigo-600' : 'text-slate-700'}`}>{String(v)}</span>
                                  </div>
                              ))}
                          </div>

                          {hasCI && (
                              <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 relative z-10 animate-reveal">
                                  <div className="flex justify-between items-end mb-2">
                                      <span className="text-[7px] font-black text-slate-400 uppercase">预测响应强度 (95% CI)</span>
                                      <span className="text-sm font-black text-indigo-700 font-mono italic">
                                          {rec.predictedValue.toFixed(1)} <span className="text-[7px] opacity-40">± {(rec.ciUpper - rec.predictedValue).toFixed(1)}</span>
                                      </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-200 rounded-full relative overflow-hidden shadow-inner">
                                      <div className={`absolute top-0 h-full opacity-30 ${isActive ? 'bg-indigo-400' : 'bg-slate-400'}`} style={{ left: '15%', right: '15%' }}></div>
                                      <div className={`absolute top-0 h-full w-1 shadow-lg ${isActive ? 'bg-indigo-600' : 'bg-slate-700'}`} style={{ left: '50%', transform: 'translateX(-50%)' }}></div>
                                  </div>
                              </div>
                          )}

                          <div className={`mt-4 pt-3 border-t border-slate-50 relative z-10 ${isActive ? 'border-indigo-100' : ''}`}>
                              <p className={`text-[9px] font-medium leading-relaxed italic ${isActive ? 'text-indigo-900' : 'text-slate-500'}`}>“ {rec.expectedOutcome} ”</p>
                          </div>

                          <div className="mt-4 flex gap-2 relative z-10">
                            {individualMeta && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if(individualMeta) onTracePlan?.(individualMeta.projectId, individualMeta.subView); }}
                                    className="flex-1 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                                >
                                    <i className="fa-solid fa-magnifying-glass-chart"></i> 回溯
                                </button>
                            )}
                            {isActive && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsBatchSync(false); setShowSyncModal(true); }}
                                    className={`flex-[2] py-2.5 rounded-xl text-[9px] font-black uppercase shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${individualMeta ? 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-black'}`}
                                >
                                    <i className="fa-solid fa-calendar-plus"></i> 同步方案
                                </button>
                            )}
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
    </div>
  );
};

export default SuggestionPanel;
