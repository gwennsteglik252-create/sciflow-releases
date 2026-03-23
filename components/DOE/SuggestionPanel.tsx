
import React, { useMemo, useState } from 'react';
import { DOEFactor, ResearchProject } from '../../types';
import { useTranslation } from '../../locales';

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

// --- 子组件：因子敏感度条 ---
const SensitivityBar: React.FC<{ coverage: number; importance: string }> = ({ coverage, importance }) => {
  const barColor = importance === 'high' ? 'bg-rose-500' : importance === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${coverage}%` }} />
    </div>
  );
};

// --- 子组件：交互作用卡片 ---
const InteractionCard: React.FC<{ interaction: any }> = ({ interaction }) => {
  const { t } = useTranslation();
  const typeLabel = (interaction.type === '协同' || interaction.type === 'Synergy') ? t('doeAssistant.suggestionPanel.interactionType.synergy') : 
                   (interaction.type === '拮抗' || interaction.type === 'Antagonism' || interaction.type === '拮开') ? t('doeAssistant.suggestionPanel.interactionType.antagonism') : 
                   t('doeAssistant.suggestionPanel.interactionType.neutral');
                   
  const typeColor = (interaction.type === '协同' || interaction.type === 'Synergy') ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 
                   (interaction.type === '拮抗' || interaction.type === 'Antagonism' || interaction.type === '拮开') ? 'text-rose-600 bg-rose-50 border-rose-200' : 
                   'text-slate-500 bg-slate-50 border-slate-200';
  const strengthDots = interaction.strength === 'strong' ? 3 : interaction.strength === 'moderate' ? 2 : 1;
  return (
    <div className="p-3.5 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-all group/int">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 uppercase">{interaction.factors.join(' × ')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < strengthDots ? 'bg-indigo-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase border ${typeColor}`}>{typeLabel}</span>
        </div>
      </div>
      <p className="text-[9px] text-slate-500 font-medium leading-relaxed italic">{interaction.description}</p>
    </div>
  );
};

// --- 子组件：风险标签 ---
const RiskBadge: React.FC<{ warning: any }> = ({ warning }) => {
  const { t } = useTranslation();
  const levelConfig = {
    high: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'fa-circle-exclamation', iconColor: 'text-rose-500', label: 'bg-rose-500', text: t('doeAssistant.suggestionPanel.riskLevels.high') },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'fa-triangle-exclamation', iconColor: 'text-amber-500', label: 'bg-amber-500', text: t('doeAssistant.suggestionPanel.riskLevels.medium') },
    low: { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'fa-circle-info', iconColor: 'text-sky-500', label: 'bg-sky-500', text: t('doeAssistant.suggestionPanel.riskLevels.low') }
  };
  const cfg = levelConfig[warning.level as keyof typeof levelConfig] || levelConfig.low;
  return (
    <div className={`p-4 rounded-lg border ${cfg.bg} ${cfg.border} relative overflow-hidden`}>
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-xl ${cfg.label} text-white flex items-center justify-center shrink-0 shadow-sm`}>
          <i className={`fa-solid ${cfg.icon} text-[10px]`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
             <h6 className="text-[10px] font-black text-slate-700 uppercase">{warning.title}</h6>
             <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${cfg.label} text-white`}>{cfg.text}</span>
          </div>
          <p className="text-[9px] text-slate-500 font-medium leading-relaxed">{warning.description}</p>
        </div>
      </div>
    </div>
  );
};

const SuggestionPanel: React.FC<SuggestionPanelProps> = ({
  suggestion, factors, setSuggestion, setLoadedArchiveId, setShowSaveModal, setShowSyncModal, setIsBatchSync, loadedArchiveId,
  selectedIdx, onSelectRecommendation, projects = [], onTracePlan
}) => {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sensitivity: true,
    interactions: false,
    insights: true,
    processWindow: false,
    risks: true,
    nextSteps: true,
    dataQuality: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
        let matchedInProject = false;

        // 1. 扫描里程碑中的实验矩阵
        for (const ms of p.milestones) {
            if (!ms.experimentalPlan) continue;
            for (const plan of ms.experimentalPlan) {
                if (plan.sourceProposalId === loadedArchiveId) {
                    matchedInProject = true;
                    if (plan.title.includes('联合对标') || plan.runs?.length === 3) {
                        result.globalSubView = `plan:${plan.id}`;
                        result.globalProjectId = p.id;
                    }
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
      <div className="flex-1 bg-white rounded-lg border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-12 text-center animate-in backdrop-blur-sm relative group">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl mb-12 text-slate-200 group-hover:scale-105 transition-transform duration-700 border border-slate-50">
          <i className="fa-solid fa-compass text-6xl"></i>
        </div>
        <h4 className="text-3xl font-black text-slate-400 uppercase tracking-[0.8rem] italic mb-6">{t('doeAssistant.suggestionPanel.emptyTitle')}</h4>
        <p className="text-[13px] font-black text-slate-300 uppercase tracking-widest max-w-sm leading-relaxed whitespace-pre-line">{t('doeAssistant.suggestionPanel.emptyDesc')}</p>
        <div className="mt-14 flex gap-4 opacity-30">
          {[0, 0.2, 0.4].map(delay => <div key={delay} className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${delay}s` }}></div>)}
        </div>
      </div>
    );
  }

  const recommendations = suggestion.recommendations || [];
  const report = suggestion.report || null;
  const reasoning = suggestion.reasoning || '';

  // --- 报告分区渲染辅助 ---
  const SectionHeader: React.FC<{ id: string; icon: string; title: string; subtitle?: string; badgeText?: string; badgeColor?: string }> = ({ id, icon, title, subtitle, badgeText, badgeColor }) => (
    <button 
      onClick={() => toggleSection(id)} 
      className="w-full flex items-center justify-between py-3 px-1 group/sec hover:bg-slate-50/50 rounded-lg transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 group-hover/sec:bg-indigo-100 transition-colors">
          <i className={`fa-solid ${icon} text-xs`} />
        </div>
        <div className="text-left">
          <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{title}</h5>
          {subtitle && <p className="text-[8px] text-slate-400 font-medium">{subtitle}</p>}
        </div>
        {badgeText && (
          <span className={`px-2 py-0.5 rounded-full text-[7px] font-black text-white ${badgeColor || 'bg-indigo-500'} ml-2`}>{badgeText}</span>
        )}
      </div>
      <i className={`fa-solid fa-chevron-down text-[9px] text-slate-300 transition-transform duration-300 ${expandedSections[id] ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div className="flex-1 flex flex-col gap-4 animate-reveal overflow-y-auto pr-3 custom-scrollbar pb-10">
      {/* === 推荐方案矩阵 === */}
      <div className="flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-end px-1 mb-2">
             <div className="flex flex-col gap-1">
                <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3rem] italic border-l-4 border-indigo-600 pl-4 leading-none">{t('doeAssistant.suggestionPanel.recommendationsTitle')}</h5>
                <p className="text-[8px] text-slate-400 font-bold uppercase ml-4">{t('doeAssistant.suggestionPanel.recommendationsDesc')}</p>
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
                        className="px-5 py-2 bg-emerald-600 text-white border-2 border-emerald-500 rounded-lg text-[10px] font-black uppercase shadow-lg shadow-emerald-100/50 hover:bg-black transition-all flex items-center gap-2 active:scale-95 animate-reveal"
                    >
                        <i className="fa-solid fa-arrow-right-long"></i> {t('doeAssistant.suggestionPanel.traceSync')}
                    </button>
                )}

                <button 
                    onClick={() => { setIsBatchSync(true); setShowSyncModal(true); }} 
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg hover:brightness-110 transition-all flex items-center gap-2 border border-white/20 active:scale-95"
                >
                    <i className="fa-solid fa-layer-group"></i> {t('doeAssistant.suggestionPanel.batchSync')}
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                {!loadedArchiveId && <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all border border-slate-200 shadow-sm">{t('doeAssistant.suggestionPanel.saveToLibrary')}</button>}
                <button onClick={() => { setSuggestion(null); setLoadedArchiveId(null); }} className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90" title={t('doeAssistant.suggestionPanel.closeResult')}><i className="fa-solid fa-xmark text-base"></i></button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendations.map((rec: any, idx: number) => {
                  const isActive = selectedIdx === idx;
                  const labelStr = rec.label.toLowerCase();
                  const typeKey = labelStr.includes('aggressive') || rec.label.includes('激进') ? 'aggressive' : 
                                 labelStr.includes('explorer') || rec.label.includes('探索') ? 'explorer' : 'robust';
                  
                  const translatedLabel = t(`doeAssistant.suggestionPanel.labels.${typeKey}`);
                  const isAggressive = typeKey === 'aggressive';
                  const isExplorer = typeKey === 'explorer';
                  const hasCI = typeof rec.predictedValue === 'number';
                  const individualMeta = traceManifest.individualSubViews.get(typeKey);

                  return (
                      <div 
                        key={idx} 
                        onClick={() => onSelectRecommendation(idx)}
                        className={`bg-white p-5 rounded-lg border-2 transition-all cursor-pointer flex flex-col relative overflow-hidden group ${isActive ? 'border-indigo-600 shadow-xl ring-4 ring-indigo-50' : 'border-slate-100 shadow-sm hover:border-indigo-200 hover:bg-slate-50/30'}`}
                      >
                          <div className={`absolute top-0 right-0 p-6 opacity-[0.05] pointer-events-none transition-transform group-hover:scale-110 ${isActive ? 'opacity-[0.1]' : ''}`}>
                              <i className={`fa-solid ${isAggressive ? 'fa-bolt-lightning' : isExplorer ? 'fa-satellite-dish' : 'fa-check-double'} text-6xl`}></i>
                          </div>

                          <div className="flex justify-between items-start mb-4 relative z-10">
                              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{translatedLabel}</span>
                              <div className="flex flex-col items-end">
                                  <span className={`text-[10px] font-black italic ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>{rec.confidenceScore}%</span>
                                  <span className="text-[6px] font-bold text-slate-300 uppercase leading-none">{t('doeAssistant.suggestionPanel.confidence')}</span>
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
                              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 relative z-10 animate-reveal">
                                  <div className="flex justify-between items-end mb-2">
                                      <span className="text-[7px] font-black text-slate-400 uppercase">{t('doeAssistant.suggestionPanel.predictedIntensity')}</span>
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
                              <p className={`text-[9px] font-medium leading-relaxed italic ${isActive ? 'text-indigo-900' : 'text-slate-500'}`}>" {rec.expectedOutcome} "</p>
                          </div>

                          <div className="mt-4 flex gap-2 relative z-10">
                            {individualMeta && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if(individualMeta) onTracePlan?.(individualMeta.projectId, individualMeta.subView); }}
                                    className="flex-1 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                                >
                                    <i className="fa-solid fa-magnifying-glass-chart"></i> {t('doeAssistant.suggestionPanel.backtrace')}
                                </button>
                            )}
                            {isActive && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsBatchSync(false); setShowSyncModal(true); }}
                                    className={`flex-[2] py-2.5 rounded-lg text-[9px] font-black uppercase shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${individualMeta ? 'bg-white border border-slate-200 text-slate-400 hover:bg-slate-50' : 'bg-indigo-600 text-white hover:bg-black'}`}
                                >
                                    <i className="fa-solid fa-calendar-plus"></i> {t('doeAssistant.suggestionPanel.syncPlan')}
                                </button>
                            )}
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* === 核心推演逻辑 === */}
      {reasoning && (
        <div className="bg-gradient-to-r from-indigo-50/80 to-violet-50/80 rounded-lg p-6 border border-indigo-100/50 relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full"></div>
          <div className="flex items-center gap-3 mb-3 ml-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-brain text-xs" />
            </div>
            <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3rem]">{t('doeAssistant.suggestionPanel.coreReasoning')}</h5>
          </div>
          <p className="text-[11px] font-medium text-indigo-900/80 leading-relaxed italic ml-3 text-justify">" {reasoning} "</p>
        </div>
      )}

      {/* === 综合分析报告 === */}
      {report && (
        <div className="flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-3 px-1 mt-4 mb-1">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />
            <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.4rem] italic shrink-0 flex items-center gap-2">
              <i className="fa-solid fa-file-lines" /> {t('doeAssistant.suggestionPanel.analysisReport')}
            </h4>
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />
          </div>

          {/* 1. 综合分析摘要 */}
          {report.analysisSummary && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-slate-400 to-slate-600 rounded-full"></div>
              <div className="flex items-center gap-3 mb-4 ml-3">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shadow-lg">
                  <i className="fa-solid fa-scroll text-xs" />
                </div>
                <div>
                  <h5 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{t('doeAssistant.suggestionPanel.summary')}</h5>
                  <p className="text-[7px] text-slate-400 font-bold uppercase">ANALYSIS SUMMARY</p>
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-600 leading-[1.8] ml-3 text-justify">{report.analysisSummary}</p>
            </div>
          )}

          {/* 2. 因子敏感度分析 */}
          {report.factorSensitivity && report.factorSensitivity.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="sensitivity" icon="fa-ranking-star" title={t('doeAssistant.suggestionPanel.sensitivity')} subtitle="FACTOR SENSITIVITY RANKING" badgeText={`${report.factorSensitivity.length} F`} badgeColor="bg-violet-500" />
              {expandedSections.sensitivity && (
                <div className="space-y-4 mt-3 animate-reveal">
                  {report.factorSensitivity.map((fs: any, i: number) => {
                    const importColor = fs.importance === 'high' ? 'bg-rose-500' : fs.importance === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
                    const importanceLabel = fs.importance === 'high' ? t('doeAssistant.suggestionPanel.importance.high') : 
                                           fs.importance === 'medium' ? t('doeAssistant.suggestionPanel.importance.medium') : 
                                           t('doeAssistant.suggestionPanel.importance.low');
                    
                    const effectLabel = (fs.effect === '正向' || fs.effect === 'Positive') ? t('doeAssistant.suggestionPanel.effect.positive') : 
                                       (fs.effect === '负向' || fs.effect === 'Negative') ? t('doeAssistant.suggestionPanel.effect.negative') : 
                                       t('doeAssistant.suggestionPanel.effect.neutral');

                    const effectIcon = (fs.effect === '正向' || fs.effect === 'Positive') ? 'fa-arrow-trend-up text-emerald-500' : (fs.effect === '负向' || fs.effect === 'Negative') ? 'fa-arrow-trend-down text-rose-500' : 'fa-wave-square text-amber-500';
                    return (
                      <div key={i} className="p-4 bg-slate-50/70 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-xl ${importColor} text-white text-[8px] font-black flex items-center justify-center shadow-sm`}>{i + 1}</span>
                            <span className="text-[11px] font-black text-slate-700">{fs.factor}</span>
                            <i className={`fa-solid ${effectIcon} text-xs`} />
                            <span className="text-[8px] font-bold text-slate-400">{effectLabel}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className={`px-2 py-0.5 rounded-full text-[7px] font-black text-white ${importColor}`}>{t('doeAssistant.suggestionPanel.importance.title')} {importanceLabel}</span>
                             {fs.optimalRange && <span className="px-2 py-0.5 rounded-full text-[7px] font-black text-indigo-500 bg-indigo-50 border border-indigo-200">{t('doeAssistant.suggestionPanel.optimal')} {fs.optimalRange}</span>}
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 font-medium leading-relaxed mb-3">{fs.description}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[7px] font-black text-slate-400 uppercase shrink-0">{t('doeAssistant.suggestionPanel.coverage')}</span>
                          <div className="flex-1">
                            <SensitivityBar coverage={fs.currentCoverage || 0} importance={fs.importance} />
                          </div>
                          <span className="text-[9px] font-black text-slate-500 font-mono">{fs.currentCoverage || 0}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. 因子交互作用 */}
          {report.interactions && report.interactions.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="interactions" icon="fa-diagram-project" title={t('doeAssistant.suggestionPanel.interactions')} subtitle="FACTOR INTERACTIONS" badgeText={`${report.interactions.length} P`} badgeColor="bg-teal-500" />
              {expandedSections.interactions && (
                <div className="space-y-3 mt-3 animate-reveal">
                  {report.interactions.map((inter: any, i: number) => (
                    <InteractionCard key={i} interaction={inter} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. 优化趋势洞察 */}
          {report.optimizationInsights && report.optimizationInsights.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="insights" icon="fa-lightbulb" title={t('doeAssistant.suggestionPanel.insights')} subtitle="OPTIMIZATION INSIGHTS" badgeText={`${report.optimizationInsights.length} I`} badgeColor="bg-amber-500" />
              {expandedSections.insights && (
                <div className="space-y-3 mt-3 animate-reveal">
                  {report.optimizationInsights.map((insight: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/30 rounded-lg border border-amber-100/80 hover:border-amber-200 transition-all">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-black shrink-0 shadow-sm mt-0.5">{i + 1}</div>
                      <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{insight}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. 工艺窗口评估 */}
          {report.processWindow && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="processWindow" icon="fa-window-maximize" title={t('doeAssistant.suggestionPanel.processWindow')} subtitle="PROCESS WINDOW ASSESSMENT" badgeText={`${report.processWindow.feasibilityScore}/100`} badgeColor={report.processWindow.feasibilityScore >= 70 ? 'bg-emerald-500' : report.processWindow.feasibilityScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'} />
              {expandedSections.processWindow && (
                <div className="mt-3 animate-reveal space-y-4">
                  {/* 可行性得分仪表 */}
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={report.processWindow.feasibilityScore >= 70 ? '#10b981' : report.processWindow.feasibilityScore >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeDasharray={`${report.processWindow.feasibilityScore}, 100`} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-black text-slate-700 font-mono">{report.processWindow.feasibilityScore}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{report.processWindow.description}</p>
                    </div>
                  </div>
                  {/* 约束条件 */}
                  {report.processWindow.constraints && report.processWindow.constraints.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-slate-400 uppercase px-1">{t('doeAssistant.suggestionPanel.constraints')}</span>
                      {report.processWindow.constraints.map((c: string, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 px-3.5 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                          <i className="fa-solid fa-lock text-[8px] text-slate-400 mt-0.5" />
                          <span className="text-[9px] text-slate-500 font-medium leading-relaxed">{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. 风险预警 */}
          {report.riskWarnings && report.riskWarnings.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="risks" icon="fa-shield-halved" title={t('doeAssistant.suggestionPanel.risks')} subtitle="RISK WARNINGS" badgeText={`${report.riskWarnings.filter((r: any) => r.level === 'high').length} H`} badgeColor="bg-rose-500" />
              {expandedSections.risks && (
                <div className="space-y-3 mt-3 animate-reveal">
                  {report.riskWarnings
                    .sort((a: any, b: any) => { const order = { high: 0, medium: 1, low: 2 }; return (order[a.level as keyof typeof order] ?? 3) - (order[b.level as keyof typeof order] ?? 3); })
                    .map((w: any, i: number) => <RiskBadge key={i} warning={w} />)}
                </div>
              )}
            </div>
          )}

          {/* 7. 下一步建议 */}
          {report.nextSteps && report.nextSteps.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="nextSteps" icon="fa-route" title={t('doeAssistant.suggestionPanel.nextSteps')} subtitle="RECOMMENDED NEXT STEPS" />
              {expandedSections.nextSteps && (
                <div className="space-y-2.5 mt-3 animate-reveal">
                  {report.nextSteps.map((step: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg hover:bg-indigo-50/50 transition-all group/step">
                      <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover/step:bg-indigo-500 group-hover/step:text-white transition-all">
                        <span className="text-[9px] font-black">{i + 1}</span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-600 leading-relaxed pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. 数据质量评估 */}
          {report.dataQuality && (
            <div className="bg-white rounded-lg p-6 border border-slate-100 shadow-sm">
              <SectionHeader id="dataQuality" icon="fa-database" title={t('doeAssistant.suggestionPanel.dataQuality')} subtitle="DATA QUALITY ASSESSMENT" />
              {expandedSections.dataQuality && (
                <div className="mt-3 animate-reveal">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                      <span className="text-2xl font-black text-slate-700 font-mono block">{report.dataQuality.totalExperiments}</span>
                      <span className="text-[7px] font-black text-slate-400 uppercase">{t('doeAssistant.suggestionPanel.metrics.experiments')}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                      <span className="text-2xl font-black text-indigo-600 font-mono block">{report.dataQuality.coverageScore}%</span>
                      <span className="text-[7px] font-black text-slate-400 uppercase">{t('doeAssistant.suggestionPanel.metrics.coverage')}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-center">
                      <span className="text-2xl font-black text-violet-600 font-mono block">{report.dataQuality.balanceScore}%</span>
                      <span className="text-[7px] font-black text-slate-400 uppercase">{t('doeAssistant.suggestionPanel.metrics.balance')}</span>
                    </div>
                  </div>
                  {report.dataQuality.suggestion && (
                    <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100 flex items-start gap-3">
                      <i className="fa-solid fa-lightbulb text-indigo-500 text-xs mt-0.5" />
                      <p className="text-[10px] font-medium text-indigo-700 leading-relaxed">{report.dataQuality.suggestion}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestionPanel;
