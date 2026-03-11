
import React, { useMemo } from 'react';
import { ResearchProject, Literature, AppView } from '../../types';

interface HealthScore {
    projectId: string;
    projectTitle: string;
    total: number;
    taskRate: number;      // 任务完成率得分 0-25
    successRate: number;   // 实验成功率得分 0-25
    metricRate: number;    // 指标达成度得分 0-25
    litSupport: number;    // 文献支撑度得分 0-25
}

interface HealthScoreCardProps {
    projects: ResearchProject[];
    resources: Literature[];
    isLight: boolean;
    navigate: (view: AppView, projectId?: string) => void;
}

function calcHealth(project: ResearchProject, resources: Literature[]): HealthScore {
    // 1. 任务完成率（25分）
    const allTasks = (project.weeklyPlans || []).flatMap(w => w.tasks || []);
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const taskRate = allTasks.length > 0 ? (completedTasks / allTasks.length) * 25 : 12.5;

    // 2. 实验成功率（25分）
    const allLogs = (project.milestones || []).flatMap(m => m.logs || []);
    const successLogs = allLogs.filter(l => l.result === 'success').length;
    const failLogs = allLogs.filter(l => l.result === 'failure').length;
    const scoredLogs = successLogs + failLogs;
    const successRate = scoredLogs > 0 ? (successLogs / scoredLogs) * 25 : (allLogs.length > 0 ? 15 : 12.5);

    // 3. 指标达成度（25分）
    const targets = project.targetMetrics || [];
    let metricRate = 12.5;
    if (targets.length > 0) {
        let latestData: Record<string, number> = {};
        const sortedMs = [...(project.milestones || [])].sort(
            (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
        );
        for (const m of sortedMs) {
            const sorted = [...(m.logs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            for (const l of sorted) {
                if (l.scientificData) latestData = { ...l.scientificData, ...latestData };
            }
        }
        const scores = targets.map(t => {
            const actualVal = latestData[t.label] || 0;
            const targetNum = parseFloat(t.value);
            if (!targetNum || !actualVal) return 0.5;
            const ratio = t.isHigherBetter !== false ? actualVal / targetNum : targetNum / (actualVal || targetNum * 2);
            return Math.min(ratio, 1);
        });
        metricRate = (scores.reduce((a, b) => a + b, 0) / scores.length) * 25;
    }

    // 4. 文献支撑度（25分）— 用项目引用数 or 通用资源数
    const citedCount = (project.citedLiteratureIds || []).length;
    const totalRes = resources.length;
    const refCount = citedCount > 0 ? citedCount : Math.min(totalRes, 10);
    const litSupport = Math.min(refCount / 8, 1) * 25;

    const total = Math.round(taskRate + successRate + metricRate + litSupport);

    return {
        projectId: project.id,
        projectTitle: project.title,
        total,
        taskRate: Math.round(taskRate),
        successRate: Math.round(successRate),
        metricRate: Math.round(metricRate),
        litSupport: Math.round(litSupport),
    };
}

function getScoreStyle(score: number) {
    if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]', label: '健康' };
    if (score >= 60) return { bar: 'bg-amber-400', text: 'text-amber-500', badge: 'bg-amber-400/10 text-amber-600', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.35)]', label: '关注' };
    return { bar: 'bg-rose-500', text: 'text-rose-500', badge: 'bg-rose-500/10 text-rose-600', glow: 'shadow-[0_0_12px_rgba(244,63,94,0.35)]', label: '风险' };
}

const DIM_LABELS = [
    { key: 'taskRate', label: '任务', icon: 'fa-list-check', color: 'bg-indigo-400' },
    { key: 'successRate', label: '实验', icon: 'fa-flask', color: 'bg-emerald-400' },
    { key: 'metricRate', label: '指标', icon: 'fa-chart-line', color: 'bg-amber-400' },
    { key: 'litSupport', label: '文献', icon: 'fa-book-open', color: 'bg-violet-400' },
];

const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ projects, resources, isLight, navigate }) => {
    const scores = useMemo(() =>
        (projects || [])
            .filter(p => p.status === 'In Progress' || p.status === 'Planning')
            .map(p => calcHealth(p, resources))
            .sort((a, b) => b.total - a.total),
        [projects, resources]
    );

    const avgScore = scores.length > 0
        ? Math.round(scores.reduce((s, x) => s + x.total, 0) / scores.length)
        : 0;
    const avgStyle = getScoreStyle(avgScore);

    return (
        <div className={`h-full flex-1 p-6 rounded-[2.5rem] flex flex-col min-h-0 border ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5 shrink-0">
                <h4 className={`text-xs font-black flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    <i className="fa-solid fa-heart-pulse text-rose-500"></i>
                    项目健康度
                </h4>
                {scores.length > 0 && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${avgStyle.badge}`}>
                        <i className={`fa-solid ${avgScore >= 80 ? 'fa-circle-check' : avgScore >= 60 ? 'fa-triangle-exclamation' : 'fa-circle-xmark'} text-[8px]`}></i>
                        团队均分 {avgScore}
                    </div>
                )}
            </div>

            {/* Dimension Legend */}
            <div className="flex items-center gap-3 mb-4 shrink-0">
                {DIM_LABELS.map(d => (
                    <div key={d.key} className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${d.color}`}></div>
                        <span className="text-[8px] text-slate-400 font-black uppercase tracking-wide">{d.label}</span>
                    </div>
                ))}
            </div>

            {/* Project List */}
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-0">
                {scores.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-40">
                        <i className="fa-solid fa-heart-crack text-2xl text-slate-400 mb-2"></i>
                        <p className="text-[9px] text-slate-400 italic">暂无进行中的项目</p>
                    </div>
                ) : (
                    scores.map(sc => {
                        const s = getScoreStyle(sc.total);
                        return (
                            <div
                                key={sc.projectId}
                                onClick={() => navigate('project_detail', sc.projectId)}
                                className={`group p-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:scale-[1.01]
                  ${isLight
                                        ? `bg-slate-50 border-slate-100 hover:border-slate-200 hover:${s.glow}`
                                        : `bg-slate-700/50 border-white/5 hover:border-white/15`}`}
                            >
                                <div className="flex items-center justify-between mb-2.5">
                                    {/* Title */}
                                    <p className={`text-[10px] font-black truncate max-w-[55%] ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                        {sc.projectTitle}
                                    </p>
                                    {/* Score Badge */}
                                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg ${s.badge}`}>
                                        <span className={`text-[13px] font-black tabular-nums ${s.text}`}>{sc.total}</span>
                                        <span className="text-[7px] font-black opacity-70 uppercase">{s.label}</span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className={`w-full h-1.5 rounded-full overflow-hidden mb-2.5 ${isLight ? 'bg-slate-100' : 'bg-slate-600/50'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
                                        style={{ width: `${sc.total}%` }}
                                    ></div>
                                </div>

                                {/* Dimension Mini-Bars */}
                                <div className="grid grid-cols-4 gap-1.5">
                                    {DIM_LABELS.map(d => {
                                        const val = sc[d.key as keyof HealthScore] as number;
                                        const pct = (val / 25) * 100;
                                        return (
                                            <div key={d.key} className="flex flex-col gap-1">
                                                <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-slate-600/50'}`}>
                                                    <div className={`h-full rounded-full ${d.color} opacity-80`} style={{ width: `${pct}%` }}></div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <i className={`fa-solid ${d.icon} text-[7px] text-slate-400`}></i>
                                                    <span className="text-[7px] font-black text-slate-400 tabular-nums">{val}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default HealthScoreCard;
