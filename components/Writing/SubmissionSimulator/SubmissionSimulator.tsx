import React, { useState, useMemo, useCallback } from 'react';
import { useProjectContext } from '../../../context/ProjectContext';
import { ManuscriptMeta, SubmissionSimulation, SubmissionRound, SubmissionTracker, JournalMatch, ResearchProject } from '../../../types';
import { generateCoverLetter, analyzeManuscriptConflicts, generateManuscriptHighlights } from '../../../services/gemini/writing';
import { useTranslation } from '../../../locales/useTranslation';
import JournalRecommendPanel from './JournalRecommendPanel';
import SubmissionTimelinePanel from './SubmissionTimelinePanel';
import ResponseLetterPanel from './ResponseLetterPanel';

interface SubmissionSimulatorProps {
    project: ResearchProject | undefined;
    meta: ManuscriptMeta;
    sections: any[];
    media: any[];
    tables: any[];
    onClose: () => void;
    language: 'zh' | 'en';
    onUpdateProject?: (project: ResearchProject) => void;
}

type TabId = 'journals' | 'tracking' | 'response' | 'conflicts' | 'letter' | 'highlights';

const SubmissionSimulator: React.FC<SubmissionSimulatorProps> = ({
    project, meta, sections, media, tables, onClose, language, onUpdateProject
}) => {
    const { showToast, startGlobalTask } = useProjectContext();
    const { t } = useTranslation();
    const [simData, setSimData] = useState<Partial<SubmissionSimulation>>({});
    const [isSimulating, setIsSimulating] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('journals');
    const [selectedJournal, setSelectedJournal] = useState<JournalMatch | null>(null);

    // ═══ 投稿跟踪数据 ═══
    const tracker: SubmissionTracker = useMemo(() => project?.submissionTracker || {
        targetJournals: [],
        rounds: [],
    }, [project?.submissionTracker]);

    const updateTracker = useCallback((updates: Partial<SubmissionTracker>) => {
        if (!project || !onUpdateProject) return;
        onUpdateProject({
            ...project,
            submissionTracker: { ...tracker, ...updates }
        });
    }, [project, onUpdateProject, tracker]);

    // 当前活跃的投稿轮次（支持手动切换）
    const [manualRoundId, setManualRoundId] = useState<string | null>(null);
    const currentRound = useMemo(() => {
        if (manualRoundId) {
            return tracker.rounds.find(r => r.id === manualRoundId);
        }
        if (tracker.currentRoundId) {
            return tracker.rounds.find(r => r.id === tracker.currentRoundId);
        }
        return tracker.rounds[tracker.rounds.length - 1];
    }, [tracker, manualRoundId]);

    // 论文内容摘要
    const sectionsContent = useMemo(() =>
        sections.map(s => `[${s.title}]\n${(s.content || '').substring(0, 500)}`).join('\n\n'),
        [sections]
    );

    // #1 从期刊推荐一键创建投稿轮次
    const handleSelectJournal = useCallback((journal: JournalMatch) => {
        setSelectedJournal(journal);
    }, []);

    const handleCreateRoundFromJournal = useCallback((journal: JournalMatch) => {
        const newRound: SubmissionRound = {
            id: `round_${Date.now()}`,
            roundNumber: tracker.rounds.length + 1,
            journal: journal.name,
            status: 'draft',
            reviewerComments: []
        };
        updateTracker({
            rounds: [...tracker.rounds, newRound],
            currentRoundId: newRound.id
        });
        setActiveTab('tracking');
        showToast({ message: `已为 ${journal.name} 创建投稿轮次`, type: 'success' });
    }, [tracker, updateTracker, showToast]);

    // ═══ 投稿前审计（原有逻辑），#6 联动选中期刊 ═══
    const runSimulation = async () => {
        setIsSimulating(true);
        const targetJournalName = selectedJournal?.name || meta.title || "Target Journal";
        await startGlobalTask({ id: 'sub_sim', type: 'diagnose', status: 'running', title: t('writing.submissionSim.taskTitle') }, async () => {
            try {
                const innovations = project?.keywords || [];
                const [letter, conflicts, highlights] = await Promise.all([
                    generateCoverLetter(targetJournalName, meta, sections, innovations, language),
                    analyzeManuscriptConflicts(sections, media, tables),
                    generateManuscriptHighlights(sections, language)
                ]);
                setSimData({
                    coverLetter: letter,
                    figureConflicts: conflicts,
                    highlights: highlights,
                    lastCheckTimestamp: new Date().toLocaleString()
                });
                showToast({ message: t('writing.submissionSim.auditDone'), type: 'success' });
            } catch {
                showToast({ message: t('writing.submissionSim.auditFailed'), type: 'error' });
            } finally {
                setIsSimulating(false);
            }
        });
    };

    // ═══ Tab 定义 ═══
    const tabs: { id: TabId; label: string; icon: string; color: string }[] = [
        { id: 'journals', label: '期刊推荐', icon: 'fa-compass', color: 'text-sky-500' },
        { id: 'tracking', label: '投稿跟踪', icon: 'fa-timeline', color: 'text-violet-500' },
        { id: 'response', label: '回复信', icon: 'fa-reply-all', color: 'text-teal-500' },
        { id: 'conflicts', label: t('writing.submissionSim.tabConflicts'), icon: 'fa-triangle-exclamation', color: 'text-rose-500' },
        { id: 'letter', label: 'Cover Letter', icon: 'fa-envelope-open-text', color: 'text-indigo-500' },
        { id: 'highlights', label: 'Highlights', icon: 'fa-list-check', color: 'text-emerald-500' }
    ];

    const showAuditButton = ['conflicts', 'letter', 'highlights'].includes(activeTab);

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[6000] flex items-center justify-center p-4 lg:p-12">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border-4 border-white/20 animate-reveal">
                {/* ═══ Header ═══ */}
                <header className="px-10 py-7 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl ring-4 ring-indigo-500/20">
                            <i className="fa-solid fa-rocket text-2xl" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">投稿管理中心</h3>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3rem] mt-1">Submission Manager & Journal Matching</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* #6 如果选中了推荐期刊，显示在 Header */}
                        {selectedJournal && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-xl">
                                <i className="fa-solid fa-bullseye text-amber-400 text-[10px]" />
                                <span className="text-[9px] font-black text-white/80 uppercase truncate max-w-40">{selectedJournal.name}</span>
                            </div>
                        )}
                        {showAuditButton && (
                            <button
                                onClick={runSimulation}
                                disabled={isSimulating}
                                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                {isSimulating ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-bolt-lightning text-amber-300" />}
                                {t('writing.submissionSim.startAudit')}
                            </button>
                        )}
                        <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center">
                            <i className="fa-solid fa-times text-xl" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* ═══ Sidebar Tabs ═══ */}
                    <div className="w-56 bg-slate-50 border-r border-slate-100 p-5 flex flex-col gap-2 shrink-0">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 p-3.5 rounded-2xl transition-all text-left group ${activeTab === tab.id ? 'bg-white shadow-lg border border-slate-200' : 'hover:bg-white/50 grayscale opacity-60'}`}
                            >
                                <i className={`fa-solid ${tab.icon} ${tab.color} text-sm`} />
                                <span className={`text-[10px] font-black uppercase tracking-tight ${activeTab === tab.id ? 'text-slate-800' : 'text-slate-400'}`}>{tab.label}</span>
                                {tab.id === 'tracking' && tracker.rounds.length > 0 && (
                                    <span className="ml-auto w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[9px] font-black flex items-center justify-center">{tracker.rounds.length}</span>
                                )}
                                {tab.id === 'response' && currentRound?.reviewerComments.length ? (
                                    <span className="ml-auto w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-[9px] font-black flex items-center justify-center">
                                        {currentRound.reviewerComments.filter(c => c.status === 'pending').length || '✓'}
                                    </span>
                                ) : null}
                            </button>
                        ))}

                        <div className="mt-auto pt-4 border-t border-slate-200 opacity-40">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Audit</p>
                            <p className="text-[9px] font-mono font-bold text-slate-500 mt-1">{simData.lastCheckTimestamp || 'N/A'}</p>
                        </div>
                    </div>

                    {/* ═══ Main Workspace ═══ */}
                    <div className="flex-1 bg-white overflow-y-auto custom-scrollbar p-8">
                        {/* 期刊推荐 + #1 一键创建轮次 */}
                        {activeTab === 'journals' && (
                            <JournalRecommendPanel
                                title={meta.title || ''}
                                abstract={sections.find(s => s.id === 'abstract')?.content || ''}
                                keywords={project?.keywords || []}
                                language={language}
                                targetJournals={tracker.targetJournals}
                                onUpdateJournals={journals => updateTracker({ targetJournals: journals, lastRecommendedAt: new Date().toISOString() })}
                                onSelectJournal={handleSelectJournal}
                                onCreateRound={handleCreateRoundFromJournal}
                            />
                        )}

                        {/* 投稿跟踪 */}
                        {activeTab === 'tracking' && (
                            <SubmissionTimelinePanel
                                rounds={tracker.rounds}
                                targetJournals={tracker.targetJournals}
                                onUpdateRounds={rounds => updateTracker({ rounds, currentRoundId: rounds[rounds.length - 1]?.id })}
                            />
                        )}

                        {/* Response Letter + #2 轮次切换 */}
                        {activeTab === 'response' && (
                            <ResponseLetterPanel
                                currentRound={currentRound}
                                allRounds={tracker.rounds}
                                onSelectRound={id => setManualRoundId(id)}
                                paperTitle={meta.title || ''}
                                sectionsContent={sectionsContent}
                                language={language}
                                onUpdateRound={updatedRound => {
                                    updateTracker({
                                        rounds: tracker.rounds.map(r => r.id === updatedRound.id ? updatedRound : r),
                                        currentRoundId: updatedRound.id
                                    });
                                }}
                            />
                        )}

                        {/* 图表冲突审计 */}
                        {activeTab === 'conflicts' && (
                            <>
                                {!simData.lastCheckTimestamp && !isSimulating ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                                        <i className="fa-solid fa-shield-virus text-7xl" />
                                        <p className="text-sm font-black uppercase tracking-[0.4rem]">{t('writing.submissionSim.clickToStart')}</p>
                                    </div>
                                ) : isSimulating ? (
                                    <div className="h-full flex flex-col items-center justify-center gap-8 animate-pulse">
                                        <div className="relative">
                                            <div className="w-24 h-24 rounded-[2rem] border-4 border-indigo-600 border-t-transparent animate-spin" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <i className="fa-solid fa-microchip text-indigo-500 text-3xl animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="text-center space-y-2">
                                            <h4 className="text-xl font-black text-slate-800 uppercase italic tracking-widest">{t('writing.submissionSim.simulating')}</h4>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Scanning Sections, Figures, and Semantic Consistency</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
                                        <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-rose-500 pl-4 mb-8">{t('writing.submissionSim.conflictTitle')}</h4>
                                        {simData.figureConflicts && simData.figureConflicts.length > 0 ? (
                                            <div className="space-y-4">
                                                {simData.figureConflicts.map((c, i) => (
                                                    <div key={i} className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-start gap-6 ${c.severity === 'critical' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-100'}`}>
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${c.severity === 'critical' ? 'bg-rose-600' : 'bg-amber-500'}`}>
                                                            <i className={`fa-solid ${c.severity === 'critical' ? 'fa-radiation' : 'fa-triangle-exclamation'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.type.replace('_', ' ')}</span>
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${c.severity === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>{c.severity}</span>
                                                            </div>
                                                            <h5 className="text-base font-black text-slate-800 mb-2 uppercase">{c.label}</h5>
                                                            <p className="text-[12px] font-medium text-slate-600 leading-relaxed italic mb-4">{c.description}</p>
                                                            <div className="bg-white/60 p-4 rounded-2xl border border-white shadow-inner">
                                                                <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">{t('writing.submissionSim.aiSuggestion')}</p>
                                                                <p className="text-[11px] font-bold text-slate-700">{c.suggestion}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50 border-2 border-emerald-200 p-12 rounded-[4rem] text-center">
                                                <i className="fa-solid fa-circle-check text-emerald-500 text-6xl mb-6" />
                                                <h5 className="text-xl font-black text-emerald-800 uppercase italic mb-2">{t('writing.submissionSim.noConflicts')}</h5>
                                                <p className="text-sm text-emerald-600/80 font-medium">{t('writing.submissionSim.noConflictsDesc')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Cover Letter + #6 联动推荐期刊 */}
                        {activeTab === 'letter' && (
                            <>
                                {!simData.coverLetter && !isSimulating ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                                        <i className="fa-solid fa-envelope text-7xl" />
                                        <p className="text-sm font-black uppercase tracking-[0.4rem]">{t('writing.submissionSim.clickToStart')}</p>
                                        {selectedJournal && (
                                            <p className="text-xs font-bold text-indigo-500 -mt-2">
                                                <i className="fa-solid fa-bullseye mr-1" />目标期刊: {selectedJournal.name}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-6 h-full flex flex-col max-w-4xl mx-auto">
                                        <div className="flex justify-between items-center mb-4 shrink-0">
                                            <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-indigo-500 pl-4">{t('writing.submissionSim.coverLetterTitle')}</h4>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(simData.coverLetter || '')}
                                                className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <i className="fa-solid fa-copy mr-1.5" /> {t('writing.submissionSim.copyContent')}
                                            </button>
                                        </div>
                                        <div className="flex-1 bg-slate-50 rounded-[3rem] p-12 shadow-inner border border-slate-100 overflow-y-auto custom-scrollbar">
                                            <div className="bg-white p-12 rounded-xl shadow-xl min-h-full font-serif text-[14px] leading-relaxed text-slate-800 border border-slate-200 whitespace-pre-wrap italic">
                                                {simData.coverLetter}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Highlights */}
                        {activeTab === 'highlights' && (
                            <>
                                {!simData.highlights && !isSimulating ? (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                                        <i className="fa-solid fa-star text-7xl" />
                                        <p className="text-sm font-black uppercase tracking-[0.4rem]">{t('writing.submissionSim.clickToStart')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6 h-full flex flex-col max-w-4xl mx-auto">
                                        <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-emerald-500 pl-4 mb-8">{t('writing.submissionSim.highlightsTitle')}</h4>
                                        <div className="space-y-4">
                                            {simData.highlights?.map((h, i) => (
                                                <div key={i} className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-200 group hover:border-emerald-400 transition-all items-center">
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 font-black text-sm shrink-0 shadow-sm">{i + 1}</div>
                                                    <p className="text-[13px] font-bold text-slate-700 italic group-hover:text-slate-900 transition-colors leading-relaxed">"{h}"</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-8 p-6 bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-[2.5rem]">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <i className="fa-solid fa-circle-info" /> {t('writing.submissionSim.submissionTip')}
                                            </p>
                                            <p className="text-[11px] font-medium text-emerald-800 leading-relaxed italic">{t('writing.submissionSim.submissionTipDesc')}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <footer className="p-7 bg-white border-t border-slate-100 shrink-0 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">
                        <i className="fa-solid fa-shield-halved mr-2 text-indigo-400" /> {t('writing.submissionSim.disclaimer')}
                    </p>
                    <button onClick={onClose} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all hover:bg-indigo-600">{t('writing.submissionSim.done')}</button>
                </footer>
            </div>
        </div>
    );
};

export default SubmissionSimulator;