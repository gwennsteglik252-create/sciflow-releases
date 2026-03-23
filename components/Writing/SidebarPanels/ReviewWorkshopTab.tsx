
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useReviewWorkshop } from '../../../hooks/useReviewWorkshop';
import { ReviewSubQuestion, ReviewOutlineNode, ReviewSession, ReviewAgentRole, AgentReport, KnowledgeQuadruple, ReviewKnowledgeGraph, ConsistencyReport, ConsistencyIssue } from '../../../types';
import { queryKnowledgeGraph, QueryDimension } from '../../../services/gemini/knowledgeGraph';

// ═══════════════════════════════════════════════════════════════════
// 步骤定义
// ═══════════════════════════════════════════════════════════════════

const WIZARD_STEPS = [
    { key: 'config', icon: '⚙️', label: '配置' },
    { key: 'topic_decomposition', icon: '🎯', label: '分解' },
    { key: 'literature_search', icon: '🔍', label: '检索' },
    { key: 'literature_screening', icon: '📊', label: '筛选' },
    { key: 'knowledge_extraction', icon: '🧪', label: '沉降' },
    { key: 'outline_generation', icon: '📝', label: '大纲' },
    { key: 'section_generation', icon: '✍️', label: '撰写' },
    { key: 'figure_generation', icon: '📈', label: '图表' },
    { key: 'cross_audit', icon: '🔎', label: '审计' },
    { key: 'polishing', icon: '💎', label: '润色' },
] as const;

type WizardStepKey = typeof WIZARD_STEPS[number]['key'];

// ═══════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════

interface ReviewWorkshopTabProps {
    workshop: ReturnType<typeof useReviewWorkshop>;
    onSwitchTab?: (tab: string) => void;
}

const ReviewWorkshopTab: React.FC<ReviewWorkshopTabProps> = ({ workshop, onSwitchTab }) => {
    const { session, isRunning, currentLog, searchResults } = workshop;

    // 计算总进度
    const overallProgress = useMemo(() => {
        const doneCount = session.stages.filter(s => s.status === 'done' || s.status === 'skipped').length;
        return Math.round((doneCount / session.stages.length) * 100);
    }, [session.stages]);

    const getStageStatus = useCallback((stepKey: WizardStepKey) => {
        if (stepKey === 'config') return session.currentStage !== 'idle' ? 'done' : 'pending';
        const stage = session.stages.find(s => s.stage === stepKey);
        return stage?.status ?? 'pending';
    }, [session]);

    const getStageMessage = useCallback((stepKey: WizardStepKey) => {
        if (stepKey === 'config') return session.config.topic || '未设置主题';
        const stage = session.stages.find(s => s.stage === stepKey);
        return stage?.message || '';
    }, [session]);

    // 找到当前正在运行或下一个待执行的步骤
    const activeStageIdx = useMemo(() => {
        const runningIdx = session.stages.findIndex(s => s.status === 'running');
        if (runningIdx >= 0) return runningIdx + 1; // +1 因为 config 在前
        // 找到最后一个 done 的后面一个
        for (let i = session.stages.length - 1; i >= 0; i--) {
            if (session.stages[i].status === 'done' || session.stages[i].status === 'skipped') {
                return i + 2; // +1 for config offset, +1 for next
            }
        }
        return 0; // config
    }, [session.stages]);

    // 执行当前步骤
    const executeStep = useCallback((key: string) => {
        const actions: Record<string, () => void> = {
            config: workshop.runTopicDecomposition,
            topic_decomposition: workshop.runTopicDecomposition,
            literature_search: workshop.runLiteratureSearch,
            literature_screening: workshop.runLiteratureScreening,
            knowledge_extraction: workshop.runKnowledgeExtraction,
            outline_generation: workshop.runOutlineGeneration,
            section_generation: workshop.runSectionGeneration,
            figure_generation: workshop.runFigureGeneration,
            cross_audit: workshop.runCrossAudit,
            polishing: workshop.runPolishing,
        };
        actions[key]?.();
    }, [workshop]);

    // 步骤状态颜色
    const stepColor = (key: WizardStepKey) => {
        const status = getStageStatus(key);
        if (status === 'done' || status === 'skipped') return 'bg-emerald-500 text-white';
        if (status === 'running') return 'bg-blue-500 text-white animate-pulse';
        if (status === 'error') return 'bg-red-500 text-white';
        return 'bg-slate-100 text-slate-400';
    };

    // 完成数据概要
    const statsSummary = useMemo(() => {
        const litCount = searchResults.length;
        const poolCount = session.literaturePool.length;
        const sectionCount = Object.keys(session.generatedSections).length;
        const outlineCount = session.outline.length;
        return { litCount, poolCount, sectionCount, outlineCount };
    }, [searchResults, session.literaturePool, session.generatedSections, session.outline]);

    return (
        <div className="space-y-4 animate-reveal">
            {/* 标题 + 控制 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <span className="text-white text-base">🧬</span>
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-1.5">
                            综述工坊
                            {overallProgress > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${overallProgress === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {overallProgress}%
                                </span>
                            )}
                        </h4>
                        <p className="text-xs text-slate-400">AI Agent 综述管线</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!isRunning && session.currentStage === 'idle' && (
                        <button
                            onClick={workshop.runAllSteps}
                            disabled={!session.config.topic.trim()}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-40"
                        >
                            🚀 全自动
                        </button>
                    )}
                    {isRunning && (
                        <button onClick={workshop.abort} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">
                            ⏹ 停止
                        </button>
                    )}
                    <button onClick={workshop.resetSession} className="px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
                        🔄
                    </button>
                </div>
            </div>

            {/* 配置区（可折叠） */}
            <ConfigSection config={session.config} onChange={workshop.updateConfig} disabled={isRunning} />

            {/* 综述文献组提示 — 点击跳转到文献 tab 查看「综述工坊」分组 */}
            {statsSummary.poolCount > 0 && (
                <button
                    onClick={() => onSwitchTab?.('literature')}
                    className="w-full flex items-center gap-3 p-3 bg-purple-50/80 border border-purple-100 rounded-xl hover:bg-purple-100/80 transition-colors group"
                >
                    <div className="w-9 h-9 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm">📚</span>
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-xs font-bold text-purple-700">综述文献组 · {statsSummary.poolCount} 篇</p>
                        <p className="text-[11px] text-purple-400">在情报档案「综述工坊」分组中查看和管理</p>
                    </div>
                    <i className="fa-solid fa-arrow-right text-xs text-purple-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all"></i>
                </button>
            )}

            {/* 管线进度 */}
            <div className="bg-white rounded-xl border border-slate-100 p-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">管线进度</p>
                <div className="grid grid-cols-5 gap-2">
                    {WIZARD_STEPS.map((step, idx) => {
                        const status = getStageStatus(step.key);
                        const msg = getStageMessage(step.key);
                        const isActive = idx === activeStageIdx;
                        return (
                            <button
                                key={step.key}
                                onClick={() => {
                                    if (status === 'pending' && !isRunning) executeStep(step.key);
                                    // 点击完成的步骤时跳转到对应 tab
                                    if (status === 'done') {
                                        if (step.key === 'literature_search' || step.key === 'literature_screening') onSwitchTab?.('literature');
                                        else if (step.key === 'outline_generation') onSwitchTab?.('outline');
                                        else if (step.key === 'polishing') onSwitchTab?.('polishing');
                                        else if (step.key === 'cross_audit') onSwitchTab?.('review');
                                    }
                                }}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${isActive ? 'ring-1 ring-indigo-300 bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                title={msg || step.label}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${stepColor(step.key)}`}>
                                    {status === 'done' ? '✓' : step.icon}
                                </div>
                                <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{step.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 数据概要 */}
            {(statsSummary.poolCount > 0 || statsSummary.outlineCount > 0) && (
                <div className="grid grid-cols-3 gap-2.5">
                    <button onClick={() => onSwitchTab?.('literature')} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center hover:shadow-sm transition-all group">
                        <p className="text-xl font-black text-emerald-600">{statsSummary.poolCount}</p>
                        <p className="text-xs font-bold text-emerald-400 group-hover:text-emerald-600">文献 →</p>
                    </button>
                    <button onClick={() => onSwitchTab?.('outline')} className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center hover:shadow-sm transition-all group">
                        <p className="text-xl font-black text-indigo-600">{statsSummary.outlineCount}</p>
                        <p className="text-xs font-bold text-indigo-400 group-hover:text-indigo-600">章节 →</p>
                    </button>
                    <button onClick={() => onSwitchTab?.('review')} className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center hover:shadow-sm transition-all group">
                        <p className="text-xl font-black text-rose-600">{statsSummary.sectionCount}</p>
                        <p className="text-xs font-bold text-rose-400 group-hover:text-rose-600">已撰 →</p>
                    </button>
                </div>
            )}

            {/* ═══ 多 Agent 协作面板 ═══ */}
            <AgentCollaborationPanel session={session} />

            {/* ═══ 知识图谱面板 ═══ */}
            <KnowledgeGraphPanel graph={session.knowledgeGraph} />

            {/* ═══ 核心文献全文状态面板 ═══ */}
            <FullTextStatusPanel
                screenedLiterature={session.screenedLiterature}
                searchResults={searchResults}
                onUploadPdf={workshop.uploadPdfForLiterature}
            />

            {/* ═══ 一致性报告面板 ═══ */}
            <ConsistencyReportPanel report={session.consistencyReport} />

            {/* 子问题预览 */}
            {session.subQuestions.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2.5">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">子研究问题</p>
                        <span className="text-xs font-bold text-indigo-500">{session.subQuestions.length}</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {session.subQuestions.map((sq, i) => (
                            <div key={sq.id} className="flex items-start gap-2.5 text-xs">
                                <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[11px] flex-shrink-0">Q{i + 1}</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-700 truncate">{sq.question}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {sq.keywords.slice(0, 3).map((kw, ki) => (
                                            <span key={ki} className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[11px] font-bold">{kw}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 实时日志 */}
            {currentLog && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-2.5">
                    <p className="text-xs text-slate-500 truncate">💬 {currentLog}</p>
                </div>
            )}

            {/* 当前执行步骤按钮 */}
            {!isRunning && activeStageIdx < WIZARD_STEPS.length && session.config.topic.trim() && (
                <button
                    onClick={() => executeStep(WIZARD_STEPS[Math.min(activeStageIdx, WIZARD_STEPS.length - 1)].key)}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-black uppercase shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                >
                    ▶ 执行: {WIZARD_STEPS[Math.min(activeStageIdx, WIZARD_STEPS.length - 1)].label}
                </button>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// 配置区子组件
// ═══════════════════════════════════════════════════════════════════

const ConfigSection: React.FC<{ config: any; onChange: (p: any) => void; disabled: boolean }> = ({ config, onChange, disabled }) => {
    const [expanded, setExpanded] = useState(!config.topic.trim());

    return (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">⚙️ 配置</span>
                    {config.topic && !expanded && (
                        <span className="text-xs text-slate-600 font-medium truncate max-w-[180px]">{config.topic}</span>
                    )}
                </div>
                <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs text-slate-300`}></i>
            </button>
            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-50 pt-3">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">🎯 综述主题 *</label>
                        <textarea
                            value={config.topic}
                            onChange={e => onChange({ topic: e.target.value })}
                            disabled={disabled}
                            placeholder="如：电催化析氢反应中的单原子催化剂研究进展"
                            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white disabled:opacity-50"
                            rows={2}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block">🌐 语言</label>
                            <select value={config.language} onChange={e => onChange({ language: e.target.value })} disabled={disabled} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">
                                <option value="zh">中文</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 block">📏 字数</label>
                            <select value={config.targetWordCount} onChange={e => onChange({ targetWordCount: parseInt(e.target.value) })} disabled={disabled} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">
                                <option value={3000}>~3,000</option>
                                <option value={5000}>~5,000</option>
                                <option value={8000}>~8,000</option>
                                <option value={12000}>~12,000</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">🔬 研究范围</label>
                        <input
                            value={config.scope}
                            onChange={e => onChange({ scope: e.target.value })}
                            disabled={disabled}
                            placeholder="如：非贵金属催化剂"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-300 transition-all bg-white disabled:opacity-50"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// 多 Agent 协作面板
// ═══════════════════════════════════════════════════════════════════

const AGENT_META: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
    editor:       { icon: '📝', label: 'Editor',       color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-100' },
    critic:       { icon: '🔍', label: 'Critic',       color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100'  },
    fact_checker: { icon: '✅', label: 'Fact-Check',   color: 'text-cyan-600',   bg: 'bg-cyan-50',    border: 'border-cyan-100'   },
};

const scoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500';
    if (score >= 70) return 'text-blue-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-red-500';
};

const AgentCollaborationPanel: React.FC<{ session: ReviewSession }> = ({ session }) => {
    const reports = session.agentReports;
    const history = session.multiAgentHistory;
    const hasData = reports && Object.keys(reports).length > 0;

    // 使用 opacity 占位策略保持布局稳定
    return (
        <div
            className="transition-opacity duration-300"
            style={{
                opacity: hasData ? 1 : 0,
                pointerEvents: hasData ? 'auto' : 'none',
                height: hasData ? 'auto' : 0,
                overflow: 'hidden'
            }}
        >
            <div className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">🤖 Agent 协作审计</p>
                    {history && history.length > 0 && (
                        <span className="text-xs font-bold text-indigo-500">
                            {history.length} 轮 · 共识 {history[history.length - 1]?.consensusScore ?? '-'}分
                        </span>
                    )}
                </div>

                {/* 三列 Agent 评分卡 */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {(['editor', 'critic', 'fact_checker'] as ReviewAgentRole[]).map(role => {
                        const meta = AGENT_META[role];
                        const report = reports?.[role];
                        const criticalCount = report?.issues.filter(i => i.severity === 'critical').length ?? 0;
                        const moderateCount = report?.issues.filter(i => i.severity === 'moderate').length ?? 0;

                        return (
                            <div
                                key={role}
                                className={`p-2.5 rounded-lg border ${meta.border} ${meta.bg} text-center transition-all hover:shadow-sm`}
                            >
                                <span className="text-base">{meta.icon}</span>
                                <p className={`text-xs font-black ${meta.color} mt-0.5`}>{meta.label}</p>
                                <p className={`text-lg font-black ${report ? scoreColor(report.score) : 'text-slate-300'} mt-0.5`}>
                                    {report?.score ?? '—'}
                                </p>
                                {report && (criticalCount > 0 || moderateCount > 0) && (
                                    <div className="flex items-center justify-center gap-1.5 mt-1">
                                        {criticalCount > 0 && (
                                            <span className="text-[11px] font-bold text-red-500">🔴{criticalCount}</span>
                                        )}
                                        {moderateCount > 0 && (
                                            <span className="text-[11px] font-bold text-amber-500">🟡{moderateCount}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 修订轮次时间线 */}
                {history && history.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">修订历程</p>
                        {history.map((round, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-2.5 text-xs"
                            >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px] ${
                                    idx === history.length - 1
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-slate-100 text-slate-400'
                                }`}>
                                    {round.round}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className={`font-bold ${scoreColor(round.consensusScore)}`}>
                                        {round.consensusScore}分
                                    </span>
                                    <span className="text-slate-400 ml-1">
                                        · 修订 {round.revisedSections.length} 节
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    {round.agentReports.map(r => (
                                        <span key={r.role} className="text-[11px]" title={`${AGENT_META[r.role]?.label}: ${r.score}分`}>
                                            {AGENT_META[r.role]?.icon}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


// ═════════════════════════════════════════════════════════════════
// 知识图谱面板
// ═════════════════════════════════════════════════════════════════

const CATEGORY_COLORS: Record<string, string> = {
    electrochemistry: 'bg-blue-100 text-blue-700',
    catalysis: 'bg-emerald-100 text-emerald-700',
    synthesis: 'bg-violet-100 text-violet-700',
    characterization: 'bg-amber-100 text-amber-700',
    computation: 'bg-rose-100 text-rose-700',
    other: 'bg-slate-100 text-slate-600',
};

const KnowledgeGraphPanel: React.FC<{ graph?: ReviewKnowledgeGraph }> = ({ graph }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeDimension, setActiveDimension] = useState<QueryDimension | undefined>(undefined);
    const [expanded, setExpanded] = useState(false);

    const hasData = graph && graph.quadruples.length > 0;

    const queryResult = useMemo(() => {
        if (!graph) return null;
        return queryKnowledgeGraph(graph, searchQuery, activeDimension);
    }, [graph, searchQuery, activeDimension]);

    const stats = useMemo(() => {
        if (!queryResult) return { total: 0, methods: 0, materials: 0, sources: 0 };
        return {
            total: queryResult.matchedQuadruples.length,
            methods: queryResult.uniqueMethods.length,
            materials: queryResult.uniqueMaterials.length,
            sources: graph?.totalSources || 0
        };
    }, [queryResult, graph]);

    // 热门标签（各维度前5高频值）
    const hotTags = useMemo(() => {
        if (!graph) return { methods: [], materials: [] };
        const countMap = (arr: string[]) => {
            const map = new Map<string, number>();
            arr.forEach(v => map.set(v, (map.get(v) || 0) + 1));
            return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        };
        return {
            methods: countMap(graph.quadruples.map(q => q.method)),
            materials: countMap(graph.quadruples.map(q => q.material))
        };
    }, [graph]);

    const displayQuads = useMemo(() => {
        if (!queryResult) return [];
        return expanded ? queryResult.matchedQuadruples : queryResult.matchedQuadruples.slice(0, 5);
    }, [queryResult, expanded]);

    return (
        <div
            className="transition-opacity duration-300"
            style={{
                opacity: hasData ? 1 : 0,
                pointerEvents: hasData ? 'auto' : 'none',
                height: hasData ? 'auto' : 0,
                overflow: 'hidden'
            }}
        >
            <div className="bg-white rounded-xl border border-slate-100 p-4">
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">🧠 知识图谱</p>
                    <span className="text-xs font-bold text-teal-500">
                        {stats.total} 条四元组 · {stats.sources} 篇文献
                    </span>
                </div>

                {/* 统计卡片 */}
                <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-2 text-center">
                        <p className="text-base font-black text-teal-600">{stats.total}</p>
                        <p className="text-[11px] font-bold text-teal-400">四元组</p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center">
                        <p className="text-base font-black text-indigo-600">{stats.methods}</p>
                        <p className="text-[11px] font-bold text-indigo-400">方法</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                        <p className="text-base font-black text-amber-600">{stats.materials}</p>
                        <p className="text-[11px] font-bold text-amber-400">材料</p>
                    </div>
                </div>

                {/* 搜索框 + 维度筛选 */}
                <div className="mb-2.5">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="搜索方法/材料/条件..."
                        className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-teal-300 bg-slate-50"
                    />
                    <div className="flex gap-1.5 mt-1.5">
                        {(['method', 'material', 'condition'] as QueryDimension[]).map(dim => (
                            <button
                                key={dim}
                                onClick={() => setActiveDimension(prev => prev === dim ? undefined : dim)}
                                className={`text-[11px] px-2 py-1 rounded-full font-bold transition-all ${
                                    activeDimension === dim
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                            >
                                {dim === 'method' ? '方法' : dim === 'material' ? '材料' : '条件'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 热门标签云 */}
                {!searchQuery && (
                    <div className="mb-2.5 space-y-1">
                        <div className="flex flex-wrap gap-1">
                            {hotTags.methods.map(([tag, count]) => (
                                <button
                                    key={tag}
                                    onClick={() => { setSearchQuery(tag); setActiveDimension('method'); }}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-all"
                                >
                                    {tag} ({count})
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {hotTags.materials.map(([tag, count]) => (
                                <button
                                    key={tag}
                                    onClick={() => { setSearchQuery(tag); setActiveDimension('material'); }}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 font-medium transition-all"
                                >
                                    {tag} ({count})
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 四元组列表 */}
                <div className="space-y-2">
                    {displayQuads.map((q, idx) => (
                        <div key={q.id || idx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 hover:border-teal-200 transition-all">
                            <div className="flex items-start gap-1.5 mb-1">
                                <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${CATEGORY_COLORS[q.category || 'other'] || CATEGORY_COLORS.other}`}>
                                    {q.category || 'other'}
                                </span>
                                <span className="text-[11px] text-slate-400 ml-auto">
                                    置信 {Math.round(q.confidence * 100)}%
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                <div>
                                    <span className="font-bold text-indigo-500">方法</span>
                                    <span className="text-slate-600 ml-1">{q.method}</span>
                                </div>
                                <div>
                                    <span className="font-bold text-amber-500">材料</span>
                                    <span className="text-slate-600 ml-1">{q.material}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-bold text-emerald-500">结果</span>
                                    <span className="text-slate-600 ml-1">{q.result}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="font-bold text-rose-400">条件</span>
                                    <span className="text-slate-600 ml-1">{q.condition}</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 truncate" title={q.sourceLiteratureTitle}>
                                📄 {q.sourceLiteratureTitle}
                            </p>
                        </div>
                    ))}
                </div>

                {/* 展开/收起 */}
                {queryResult && queryResult.matchedQuadruples.length > 5 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full mt-2 text-xs font-bold text-teal-500 hover:text-teal-700 transition-colors"
                    >
                        {expanded ? '收起 ▲' : `展开全部 ${queryResult.matchedQuadruples.length} 条 ▼`}
                    </button>
                )}
            </div>
        </div>
    );
};


// ═════════════════════════════════════════════════════════════════
// 一致性报告面板
// ═════════════════════════════════════════════════════════════════

const ISSUE_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    terminology: { label: '术语', color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-100' },
    citation: { label: '引用', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-100' },
    redundancy: { label: '冗余', color: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-100' },
};

const ConsistencyReportPanel: React.FC<{ report?: ConsistencyReport }> = ({ report }) => {
    const [expanded, setExpanded] = useState(false);
    const hasData = report && report.issues.length > 0;
    const totalFixed = report?.issues.filter(i => i.severity === 'auto_fixed').length || 0;
    const totalReview = report?.issues.filter(i => i.severity === 'needs_review').length || 0;
    const displayIssues = expanded ? (report?.issues || []) : (report?.issues || []).slice(0, 4);

    return (
        <div
            className="transition-opacity duration-300"
            style={{
                opacity: hasData ? 1 : 0,
                pointerEvents: hasData ? 'auto' : 'none',
                height: hasData ? 'auto' : 0,
                overflow: 'hidden'
            }}
        >
            <div className="bg-white rounded-xl border border-slate-100 p-4">
                {/* 标题 */}
                <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">🔧 一致性引擎</p>
                    <div className="flex gap-1.5">
                        {totalFixed > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-bold">✓ 已修复 {totalFixed}</span>}
                        {totalReview > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold">⚠ 待审 {totalReview}</span>}
                    </div>
                </div>

                {/* 三项统计条 */}
                {report && (
                    <div className="grid grid-cols-3 gap-2 mb-2.5">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center">
                            <p className="text-base font-black text-indigo-600">{report.terminologyFixes}</p>
                            <p className="text-[11px] font-bold text-indigo-400">术语</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                            <p className="text-base font-black text-amber-600">{report.citationFixes}</p>
                            <p className="text-[11px] font-bold text-amber-400">引用</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
                            <p className="text-base font-black text-rose-600">{report.redundancyFlags}</p>
                            <p className="text-[11px] font-bold text-rose-400">冗余</p>
                        </div>
                    </div>
                )}

                {/* 问题列表 */}
                <div className="space-y-2">
                    {displayIssues.map((issue, idx) => {
                        const cfg = ISSUE_TYPE_CONFIG[issue.type] || ISSUE_TYPE_CONFIG.redundancy;
                        return (
                            <div key={idx} className={`rounded-lg p-2.5 border ${cfg.bgColor} transition-all`}>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                                    {issue.severity === 'auto_fixed' ? (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 font-bold ml-auto">✓ 已修复</span>
                                    ) : (
                                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-bold ml-auto">⚠ 待审</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 mb-1">{issue.description}</p>
                                {issue.severity === 'auto_fixed' && issue.original && issue.fixed && (
                                    <div className="text-[11px] mt-1">
                                        <span className="line-through text-red-400 mr-1">{issue.original}</span>
                                        <span className="text-emerald-600 font-bold">→ {issue.fixed}</span>
                                    </div>
                                )}
                                <p className="text-[11px] text-slate-400 mt-1">§ {issue.sectionTitle}</p>
                            </div>
                        );
                    })}
                </div>

                {report && report.issues.length > 4 && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full mt-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                        {expanded ? '收起 ▲' : `展开全部 ${report.issues.length} 条 ▼`}
                    </button>
                )}
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// 核心文献全文状态面板
// ═══════════════════════════════════════════════════════════════════

const FullTextStatusPanel: React.FC<{
    screenedLiterature: ReviewSession['screenedLiterature'];
    searchResults: any[];
    onUploadPdf: (litId: string, base64: string) => Promise<void>;
}> = ({ screenedLiterature, searchResults, onUploadPdf }) => {
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    // 只显示 core 文献
    const coreItems = useMemo(() => {
        return screenedLiterature
            .filter(s => s.tier === 'core')
            .map(s => {
                const lit = searchResults.find((r: any) => r.id === s.literatureId);
                return { ...s, lit };
            })
            .filter(item => item.lit);
    }, [screenedLiterature, searchResults]);

    if (coreItems.length === 0) return null;

    const readyCount = coreItems.filter(c => c.fullTextStatus === 'ready').length;

    const handleUpload = async (litId: string) => {
        if (!window.electron?.selectLocalFile) return;
        try {
            const file = await window.electron.selectLocalFile({ contextKey: 'review_pdf_upload' });
            if (!file || !file.path.endsWith('.pdf')) return;

            setUploadingId(litId);
            const fileData = await window.electron.readFile!(file.path);
            if (fileData?.data) {
                await onUploadPdf(litId, fileData.data);
            }
        } catch (err) {
            console.error('PDF upload failed:', err);
        } finally {
            setUploadingId(null);
        }
    };

    const statusConfig: Record<string, { icon: string; color: string; label: string }> = {
        ready: { icon: 'fa-circle-check', color: 'text-emerald-500', label: '已解析' },
        downloading: { icon: 'fa-spinner animate-spin', color: 'text-blue-500', label: '下载中' },
        needs_upload: { icon: 'fa-cloud-arrow-up', color: 'text-amber-500', label: '需上传' },
        failed: { icon: 'fa-circle-xmark', color: 'text-red-400', label: '失败' },
        pending: { icon: 'fa-circle-dot', color: 'text-slate-300', label: '待处理' },
    };

    return (
        <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">📄 核心文献全文</p>
                <span className="text-xs font-bold text-emerald-500">
                    {readyCount}/{coreItems.length} 已获取
                </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {coreItems.map(item => {
                    const status = item.fullTextStatus || 'pending';
                    const cfg = statusConfig[status] || statusConfig.pending;
                    const isUploading = uploadingId === item.literatureId;

                    return (
                        <div key={item.literatureId} className="flex items-center gap-2.5 group">
                            <i className={`fa-solid ${cfg.icon} ${cfg.color} text-xs flex-shrink-0`} />
                            <span className="text-xs font-medium text-slate-600 truncate flex-1 min-w-0">
                                {item.lit?.title || item.literatureId}
                            </span>

                            {(status === 'needs_upload' || status === 'failed') && (
                                <button
                                    onClick={() => handleUpload(item.literatureId)}
                                    disabled={isUploading}
                                    className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded text-[11px] font-bold hover:bg-indigo-100 transition-colors flex-shrink-0 disabled:opacity-40"
                                >
                                    {isUploading ? (
                                        <><i className="fa-solid fa-spinner animate-spin mr-1" />解析中</>
                                    ) : (
                                        <><i className="fa-solid fa-upload mr-1" />上传 PDF</>
                                    )}
                                </button>
                            )}

                            {status === 'ready' && (
                                <span className="text-[11px] font-bold text-emerald-400 flex-shrink-0">✓ 全文</span>
                            )}
                        </div>
                    );
                })}
            </div>

            {coreItems.some(c => c.fullTextStatus === 'needs_upload' || c.fullTextStatus === 'failed') && (
                <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                    💡 上传核心文献 PDF 可让 AI 基于全文进行深度知识提取，而非仅依赖摘要
                </p>
            )}
        </div>
    );
};


export default ReviewWorkshopTab;
