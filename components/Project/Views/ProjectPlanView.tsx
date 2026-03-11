
import React, { useEffect, useMemo, useState } from 'react';
import { Milestone, PlannedExperiment, ResearchProject } from '../../../types';

interface ProjectPlanViewProps {
    project: ResearchProject;
    selectedMilestone?: Milestone;
    onOpenPlanModal: (plan?: PlannedExperiment) => void;
    onAddTaskToWeeklyPlan: (plan: PlannedExperiment, e: React.MouseEvent) => void;
    onConvertPlanToLogWithActuals: (plan: PlannedExperiment, e: React.MouseEvent, runIdx?: number) => void;
    onTraceProposal: (proposalId: string, e: React.MouseEvent) => void;
    onTraceDoe?: (doeId: string, planId?: string) => void;
    onTraceLog?: (logId: string) => void;
    onDeletePlan?: (id: string) => void;
    highlightedPlanId?: string | null;
    onClearHighlight?: () => void;
    onNavigateToBoard?: (planId: string) => void;
    onTraceLiterature?: (literatureId: string, e: React.MouseEvent) => void;
    onViewDoeArchive?: (doeId: string) => void;
}

const MatrixHeatmap = ({ runs }: { runs?: any[] }) => {
    if (!runs || runs.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5 w-full bg-slate-50/50 rounded-2xl p-4 shadow-inner relative overflow-hidden group/heatmap border border-slate-100">
            <div className="flex justify-between items-center px-1 mb-1 relative z-10">
                <span className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.2rem] italic">空间分布 (SPATIAL DISTRIBUTION)</span>
                <span className="text-[8px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-xs">{runs.length} RUNS</span>
            </div>
            <div className="grid grid-cols-12 gap-1.5 h-8 relative z-10">
                {runs.slice(0, 24).map((run, i) => {
                    const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                    const isExecuted = run.status === 'executed';
                    return (
                        <div
                            key={i}
                            className={`h-full rounded-md transition-all cursor-help relative overflow-hidden group/run ${colors[i % colors.length]} ${isExecuted ? 'opacity-100 ring-2 ring-emerald-400 scale-105' : 'opacity-20 hover:opacity-80 shadow-sm'}`}
                            title={`Run #${run.idx}${isExecuted ? ' (已执行)' : ' (待执行)'}`}
                        >
                            {isExecuted && <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20"><i className="fa-solid fa-check text-[7px] text-white drop-shadow-sm"></i></div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ProjectPlanView: React.FC<ProjectPlanViewProps> = ({
    project,
    selectedMilestone,
    onOpenPlanModal,
    onAddTaskToWeeklyPlan,
    onConvertPlanToLogWithActuals,
    onTraceProposal,
    onTraceDoe,
    onTraceLog,
    onDeletePlan,
    highlightedPlanId,
    onClearHighlight,
    onNavigateToBoard,
    onTraceLiterature,
    onViewDoeArchive
}) => {
    const [expandedRunListId, setExpandedRunListId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (highlightedPlanId && selectedMilestone?.experimentalPlan) {
            const targetPlan = selectedMilestone.experimentalPlan.find(p => p.id === highlightedPlanId);
            if (targetPlan) {
                const scrollTimer = setTimeout(() => {
                    const el = document.getElementById(`plan-card-${highlightedPlanId}`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);

                const clearTimer = setTimeout(() => {
                    onClearHighlight?.();
                }, 8000);

                return () => {
                    clearTimeout(scrollTimer);
                    clearTimeout(clearTimer);
                };
            }
        }
    }, [highlightedPlanId, selectedMilestone, onClearHighlight]);

    const syncedPlanIds = useMemo(() => {
        const ids = new Set<string>();
        project.weeklyPlans?.forEach(plan => {
            plan.tasks.forEach(task => {
                if (task.linkedPlanId) ids.add(task.linkedPlanId);
            });
        });
        return ids;
    }, [project.weeklyPlans]);

    // --- 搜索过滤逻辑 ---
    const filteredPlans = useMemo(() => {
        const plans = selectedMilestone?.experimentalPlan || [];
        if (!searchQuery.trim()) return plans;
        const q = searchQuery.toLowerCase();
        return plans.filter(p =>
            p.title.toLowerCase().includes(q) ||
            (p.notes && p.notes.toLowerCase().includes(q)) ||
            (p.matrix && p.matrix.some(m => m.name.toLowerCase().includes(q)))
        );
    }, [selectedMilestone, searchQuery]);

    return (
        <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-8 overflow-y-auto bg-slate-50/20 custom-scrollbar animate-reveal">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 px-1 gap-4 shrink-0">
                <div className="flex-1 min-w-0">
                    <h3 className="text-xl lg:text-3xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-4 leading-none">
                        <i className="fa-solid fa-table-cells text-indigo-600 text-2xl"></i> 实验设计与矩阵中心
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4rem] mt-2 pl-12 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        EXPERIMENTAL MATRIX ACTIVE
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* 搜索栏组件 */}
                    <div className="relative flex-1 sm:w-64 max-w-sm group">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-[11px] group-focus-within:text-indigo-500 transition-colors"></i>
                        <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all shadow-sm"
                            placeholder="搜索矩阵标题或参数..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                            >
                                <i className="fa-solid fa-times text-[9px]"></i>
                            </button>
                        )}
                    </div>

                    <button onClick={() => onOpenPlanModal()} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-xl shadow-indigo-100/50 hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95 shrink-0 border border-indigo-400/50">
                        <i className="fa-solid fa-plus text-xs"></i> 创建实验矩阵
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-20 items-start">
                {filteredPlans.map(plan => {
                    const isHighlighted = highlightedPlanId === plan.id;
                    const isSynced = syncedPlanIds.has(plan.id);
                    const hasMultipleRuns = plan.runs && plan.runs.length > 0;
                    const isRunListExpanded = expandedRunListId === plan.id;

                    const executedCount = plan.runs?.filter(r => r.status === 'executed').length || 0;
                    const totalCount = plan.runs?.length || 0;
                    const progressPercent = totalCount > 0 ? Math.round((executedCount / totalCount) * 100) : 0;
                    const isFullyExecuted = plan.status === 'completed';

                    const isFromDoe = plan.sourceType === 'doe_ai' && plan.sourceProposalId;
                    const proposalLitId = plan.sourceLiteratureId || (plan.sourceType === 'proposal' ? project.proposals?.find(p => p.id === plan.sourceProposalId)?.literatureId : undefined);
                    const isFromProposal = plan.sourceType === 'proposal' && proposalLitId && !['FLOW_GEN', 'MANUAL'].includes(proposalLitId);
                    const shouldShowTraceBtn = isFromDoe || isFromProposal;

                    return (
                        <div
                            key={plan.id}
                            id={`plan-card-${plan.id}`}
                            className={`bg-white p-6 rounded-[3rem] border transition-all relative overflow-hidden group flex flex-col ${isHighlighted
                                ? 'border-indigo-500 shadow-2xl ring-8 ring-indigo-500/10 scale-[1.02] z-10 animate-precision-glow'
                                : isFullyExecuted
                                    ? 'border-emerald-200 shadow-sm bg-emerald-50/5'
                                    : 'border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200'
                                }`}
                        >
                            <div className={`absolute top-0 left-0 w-2 h-full ${isHighlighted ? 'bg-indigo-600 animate-pulse' :
                                isFullyExecuted ? 'bg-emerald-500' :
                                    isSynced ? 'bg-indigo-400' : 'bg-slate-200 opacity-40 group-hover:opacity-100'
                                } transition-opacity`}></div>

                            <div className="flex-1 flex flex-col">
                                {/* 进度显示 */}
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <span className={`text-[10px] font-black uppercase transition-colors ${progressPercent === 100 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        执行进度: {executedCount}/{totalCount} ({progressPercent}%)
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isSynced) {
                                                    onNavigateToBoard?.(plan.id);
                                                } else {
                                                    onAddTaskToWeeklyPlan(plan, e);
                                                }
                                            }}
                                            className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-lg text-[8px] font-black uppercase transition-all shadow-xs active:scale-95 ${isSynced ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                                            title={isSynced ? '已排期' : '推至计划'}
                                        >
                                            <i className={`fa-solid ${isSynced ? 'fa-calendar-check' : 'fa-calendar-plus'}`}></i>
                                            {isSynced ? '已排期' : '推至计划'}
                                        </button>
                                        {shouldShowTraceBtn && (
                                            <>
                                                {plan.sourceType === 'doe_ai' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onViewDoeArchive?.(plan.sourceProposalId!);
                                                        }}
                                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-xs animate-in slide-in-from-right-3 border bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-600 hover:text-white"
                                                        title="快速查看该矩阵生成的 DOE 详细推演文档快照"
                                                    >
                                                        <i className="fa-solid fa-bolt"></i>
                                                        报告快照
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (plan.sourceType === 'doe_ai') {
                                                            onTraceDoe?.(plan.sourceProposalId!, plan.id);
                                                        } else if (plan.sourceType === 'proposal') {
                                                            if (proposalLitId) onTraceLiterature?.(proposalLitId, e);
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-xs animate-in slide-in-from-right-2 border ${plan.sourceType === 'proposal'
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white'
                                                        : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-600 hover:text-white'
                                                        }`}
                                                    title={plan.sourceType === 'proposal' ? "溯源至情报档案" : "跳转至 DOE 操作界面"}
                                                >
                                                    <i className={`fa-solid ${plan.sourceType === 'proposal' ? 'fa-book-atlas' : 'fa-flask'}`}></i>
                                                    {plan.sourceType === 'proposal' ? '溯源情报' : '溯源 DOE'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 标题栏 */}
                                <div className="flex flex-col mb-6 gap-3">
                                    <div className="flex justify-between items-start">
                                        <h4 className={`text-[17px] font-black uppercase tracking-tight italic leading-tight line-clamp-2 ${isFullyExecuted ? 'text-emerald-700' : 'text-slate-800'}`} title={plan.title}>
                                            {plan.title}
                                        </h4>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[8px] font-black font-mono border border-slate-200 uppercase whitespace-nowrap">
                                            PID: {plan.id.slice(-6)}
                                        </span>

                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border shadow-xs ${isFullyExecuted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : plan.status === 'executing' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                            <div className={`w-2 h-2 rounded-full ${isFullyExecuted ? 'bg-emerald-500' : plan.status === 'executing' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                            {isFullyExecuted ? 'COMPLETED' : plan.status.toUpperCase()}
                                        </div>

                                        <div className="ml-auto flex gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onOpenPlanModal(plan); }}
                                                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-100 transition-all shadow-sm flex items-center justify-center active:scale-90"
                                                title="编辑矩阵"
                                            >
                                                <i className="fa-solid fa-pen-to-square text-[11px]"></i>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeletePlan?.(plan.id); }}
                                                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-white border border-transparent hover:border-rose-100 transition-all shadow-sm flex items-center justify-center active:scale-90"
                                                title="删除矩阵"
                                            >
                                                <i className="fa-solid fa-trash-can text-[11px]"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    {plan.matrix?.slice(0, 4).map((m, i) => (
                                        <div key={i} className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-3xl group-hover:bg-white group-hover:border-indigo-100 transition-all shadow-inner">
                                            <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-2 tracking-widest truncate">{m.name}</span>
                                            <div className="flex items-baseline gap-1.5 truncate">
                                                <span className="text-[13px] font-black text-indigo-700 leading-none font-mono italic">{m.range || '--'}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{m.target}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <MatrixHeatmap runs={plan.runs} />
                            </div>

                            <div className="mt-8 flex flex-col items-center pt-6 border-t border-slate-50 gap-4">
                                {hasMultipleRuns ? (
                                    <div className="w-full space-y-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setExpandedRunListId(isRunListExpanded ? null : plan.id); }}
                                            className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${isRunListExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:shadow-md'}`}
                                        >
                                            <i className={`fa-solid ${isRunListExpanded ? 'fa-chevron-up' : 'fa-chevron-up'} text-base`}></i>
                                            {isRunListExpanded ? '收起实验序列' : `显示实验序列清单`}
                                        </button>

                                        {isRunListExpanded && (
                                            <div className="space-y-4 animate-reveal">
                                                {plan.runs?.map((run, rIdx) => {
                                                    const isExec = run.status === 'executed';
                                                    const paramBrief = Object.entries(run.params).map(([k, v]) => `${k}:${v}`).join(', ');
                                                    const isRobust = run.label?.includes('Robust') || run.label?.includes('稳健');
                                                    const isAggressive = run.label?.includes('Aggressive') || run.label?.includes('激进');
                                                    const isExplorer = run.label?.includes('Explorer') || run.label?.includes('探索');
                                                    const hasPrediction = !!run.prediction;

                                                    const cardBgClass = isExec
                                                        ? 'bg-emerald-50 border-emerald-100'
                                                        : isRobust ? 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100/50'
                                                            : isAggressive ? 'bg-rose-50 border-rose-100 hover:bg-rose-100/50'
                                                                : isExplorer ? 'bg-amber-50 border-amber-100 hover:bg-amber-100/50'
                                                                    : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-xl';

                                                    return (
                                                        <div key={rIdx} className={`flex flex-col p-5 rounded-[2.2rem] border-2 transition-all shadow-sm relative overflow-hidden ${cardBgClass}`}>
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center flex-wrap gap-2 mb-2">
                                                                        <span className="text-[13px] font-black text-indigo-500 italic mr-1">#0{run.idx}</span>
                                                                        {run.label && (
                                                                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${isRobust ? 'bg-indigo-600 text-white' : isAggressive ? 'bg-rose-500 text-white' : isExplorer ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white'
                                                                                }`}>
                                                                                {run.label}
                                                                            </span>
                                                                        )}
                                                                        {hasPrediction && (
                                                                            <span className="bg-indigo-50 text-indigo-700 text-[9px] px-2.5 py-1 rounded-xl font-black uppercase flex items-center gap-1.5 border border-indigo-200/50 shadow-sm">
                                                                                <i className="fa-solid fa-brain text-[10px] animate-pulse"></i> PREDICTED (DOE)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="bg-white/60 p-3 rounded-2xl border border-white/40 shadow-inner group-hover:bg-white transition-colors">
                                                                        <p className={`text-[11px] font-bold leading-relaxed break-words italic ${isExec ? 'text-emerald-800' : 'text-slate-600'}`}>
                                                                            {paramBrief}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col gap-2 shrink-0 ml-3 min-w-[80px]">
                                                                    <button
                                                                        onClick={(e) => onConvertPlanToLogWithActuals(plan, e, rIdx)}
                                                                        className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg active:scale-95 ${isExec ? 'bg-white border-2 border-emerald-500 text-emerald-600' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                                                                    >
                                                                        {isExec ? '更新录入' : '执行录入'}
                                                                    </button>

                                                                    {isExec && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); onTraceLog?.(run.logId!); }}
                                                                            className="w-full py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-90 gap-1.5"
                                                                            title="跳转至对应实验记录卡片"
                                                                        >
                                                                            <i className="fa-solid fa-magnifying-glass-chart text-xs"></i>
                                                                            <span className="text-[9px] font-bold">溯源</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {hasPrediction && run.prediction && (
                                                                <div className="mt-4 pt-4 border-t border-indigo-100/40 flex flex-col gap-3 animate-reveal">
                                                                    <div className="flex justify-between items-center text-[11px] font-black text-slate-500 uppercase tracking-tighter">
                                                                        <span className="flex items-center gap-1.5">
                                                                            <i className="fa-solid fa-chart-line text-indigo-500"></i> 预期性能响应 (95% CI)
                                                                        </span>
                                                                        <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                                                                            <span className="font-black text-base text-indigo-700">
                                                                                {run.prediction.value.toFixed(1)}
                                                                                <span className="text-indigo-400 text-[10px] font-bold ml-1">± {(run.prediction.upper - run.prediction.value).toFixed(1)}</span>
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="h-2.5 w-full bg-slate-100 rounded-full relative overflow-hidden shadow-inner border border-slate-200/50">
                                                                        <div
                                                                            className="absolute top-0 h-full bg-indigo-500/25 transition-all duration-1000"
                                                                            style={{
                                                                                left: `${Math.max(0, (run.prediction.lower / 100) * 100)}%`,
                                                                                width: `${Math.min(100, ((run.prediction.upper - run.prediction.lower) / 100) * 100)}%`
                                                                            }}
                                                                        ></div>
                                                                        <div
                                                                            className="absolute top-0 h-full w-1.5 bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.8)] transition-all duration-1000"
                                                                            style={{ left: `${(run.prediction.value / 100) * 100}%`, transform: 'translateX(-50%)' }}
                                                                        >
                                                                            <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white shadow-md"></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => onConvertPlanToLogWithActuals(plan, e)}
                                        className={`w-full py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 active:scale-95 group/btn ${isFullyExecuted ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                    >
                                        <i className={`fa-solid ${isFullyExecuted ? 'fa-check-double' : 'fa-flask-vial'} text-sm group-hover/btn:rotate-12 transition-transform`}></i>
                                        {isFullyExecuted ? '重新录入/更新数据' : '启动首次执行录入'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {filteredPlans.length === 0 && searchQuery && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40">
                        <i className="fa-solid fa-filter-circle-xmark text-6xl"></i>
                        <p className="text-sm font-black uppercase tracking-[0.2rem]">未找到匹配的实验矩阵</p>
                        <button onClick={() => setSearchQuery('')} className="text-[10px] font-black text-indigo-600 hover:underline uppercase">清除搜索条件</button>
                    </div>
                )}

                <div
                    onClick={() => onOpenPlanModal()}
                    className="border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 hover:text-indigo-600 transition-all cursor-pointer group shadow-inner min-h-[350px]"
                >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm border border-slate-100 group-hover:border-indigo-500">
                        <i className="fa-solid fa-plus text-xl"></i>
                    </div>
                    <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-widest">新增实验设计</p>
                        <p className="text-[8px] font-bold uppercase tracking-widest mt-1 opacity-50">Create New Matrix Template</p>
                    </div>
                </div>
            </div>
            <style>{`
        @keyframes precision-glow {
            0%, 100% { 
                border-color: rgba(99,102,241,0.5); 
                box-shadow: 0 0 20px rgba(99,102,241,0.2); 
            }
            50% { 
                border-color: rgba(99,102,241,1); 
                box-shadow: 0 0 40px rgba(99,102,241,0.5), inset 0 0 10px rgba(99,102,241,0.1); 
            }
        }
        .animate-precision-glow { animation: precision-glow 2s infinite ease-in-out; }
      `}</style>
        </div>
    );
};

export default ProjectPlanView;
