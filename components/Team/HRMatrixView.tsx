
import React, { useState, useMemo } from 'react';
import { UserProfile, ResearchProject, ExpertiseScore } from '../../types';
import { useTranslation } from '../../locales/useTranslation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from 'recharts';

interface HRMatrixViewProps {
    members: UserProfile[];
    projects: ResearchProject[];
}

type TabId = 'raci' | 'heatmap' | 'workload' | 'gantt' | 'compare' | 'health';

// RACI 角色类型
type RaciRole = 'R' | 'A' | 'C' | 'I' | '';

const RACI_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    R: { label: 'Responsible', color: '#4f46e5', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    A: { label: 'Accountable', color: '#dc2626', bg: 'bg-rose-50', border: 'border-rose-200' },
    C: { label: 'Consulted', color: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200' },
    I: { label: 'Informed', color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

// 热力图色阶
const getHeatColor = (val: number): string => {
    if (val >= 85) return '#4f46e5'; // indigo-600
    if (val >= 70) return '#6366f1'; // indigo-500
    if (val >= 55) return '#818cf8'; // indigo-400
    if (val >= 40) return '#a5b4fc'; // indigo-300
    if (val >= 25) return '#c7d2fe'; // indigo-200
    return '#e0e7ff'; // indigo-100
};

const getHeatTextColor = (val: number): string => {
    return val >= 55 ? '#ffffff' : '#4338ca';
};

const HRMatrixView: React.FC<HRMatrixViewProps> = ({ members, projects }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabId>('raci');
    const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
    const [compareIds, setCompareIds] = useState<string[]>([]);

    // ── RACI 矩阵数据 ──
    const raciData = useMemo(() => {
        const matrix: { member: UserProfile; roles: Record<string, RaciRole> }[] = [];
        members.forEach(member => {
            const roles: Record<string, RaciRole> = {};
            projects.forEach(project => {
                if (project.members.includes(member.name)) {
                    // 简单推导: PI/导师 = A, 其他参与成员 = R
                    const isSenior = member.role?.includes('PI') ||
                        member.role?.includes('导师') ||
                        member.role?.includes('教授') ||
                        member.role?.includes('Professor') ||
                        member.role?.includes('主任') ||
                        member.education === 'Postdoc';
                    roles[project.id] = isSenior ? 'A' : 'R';
                } else {
                    // 同部门但未参与 = I; 同研究方向 = C
                    const hasSimilarArea = member.researchArea &&
                        project.members.some(pm => {
                            const projMember = members.find(m => m.name === pm);
                            return projMember?.department === member.department;
                        });
                    roles[project.id] = hasSimilarArea ? 'C' : '';
                }
            });
            matrix.push({ member, roles });
        });
        return matrix;
    }, [members, projects]);

    // ── 技能热力图数据 ──
    const skillDimensions = useMemo(() => {
        if (!members.length || !members[0].expertiseMetrics?.length) {
            return ['合成制备', '性能表征', '理论计算', '工程放大', '数据挖掘'];
        }
        return members[0].expertiseMetrics.map(m => m.subject);
    }, [members]);

    const skillAverage = useMemo(() => {
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        skillDimensions.forEach(d => { sums[d] = 0; counts[d] = 0; });
        members.forEach(m => {
            m.expertiseMetrics?.forEach(metric => {
                if (sums[metric.subject] !== undefined) {
                    sums[metric.subject] += metric.A;
                    counts[metric.subject]++;
                }
            });
        });
        return skillDimensions.map(d => ({
            subject: d,
            avg: counts[d] > 0 ? Math.round(sums[d] / counts[d]) : 0,
        }));
    }, [members, skillDimensions]);

    const weakestSkill = useMemo(() => {
        if (!skillAverage.length) return null;
        return skillAverage.reduce((min, cur) => cur.avg < min.avg ? cur : min, skillAverage[0]);
    }, [skillAverage]);

    // ── 负载均衡数据 ──
    const workloadData = useMemo(() => {
        return members.map(m => ({
            name: m.name,
            workload: m.workload || 0,
            avatar: m.avatar,
            role: m.role,
        })).sort((a, b) => b.workload - a.workload);
    }, [members]);

    const avgWorkload = useMemo(() => {
        const sum = workloadData.reduce((acc, m) => acc + m.workload, 0);
        return members.length > 0 ? Math.round(sum / members.length) : 0;
    }, [workloadData, members]);

    const overloadedCount = useMemo(() =>
        workloadData.filter(m => m.workload > 80).length,
        [workloadData]
    );

    const idleCount = useMemo(() =>
        workloadData.filter(m => m.workload < 20).length,
        [workloadData]
    );

    // ── 甘特图数据（基于 RACI 推导 + 负载模拟） ──
    const ganttData = useMemo(() => {
        return members.map(m => {
            // 从 RACI 矩阵获取该成员有角色的项目
            const raciRow = raciData.find(r => r.member.id === m.id);
            const assignedProjects: { project: ResearchProject; role: RaciRole }[] = [];
            if (raciRow) {
                projects.forEach(p => {
                    const role = raciRow.roles[p.id];
                    if (role) assignedProjects.push({ project: p, role });
                });
            }
            // 如果 RACI 没匹配到任何项目，基于工作负载给一些模拟分配
            if (assignedProjects.length === 0 && projects.length > 0) {
                const workloadRatio = (m.workload || 30) / 100;
                const projCount = Math.max(1, Math.round(projects.length * workloadRatio));
                projects.slice(0, projCount).forEach(p => {
                    assignedProjects.push({ project: p, role: 'R' });
                });
            }
            // 按天分配：根据项目数和请假日分散
            const leaveSet = new Set(m.leaveDays || []);
            const weekDays = [0, 1, 2, 3, 4, 5, 6];
            const workDays = weekDays.filter(d => !leaveSet.has(d) && d < 5); // 工作日
            const schedule: Record<number, { title: string; role: RaciRole; color: string }[]> = {};
            weekDays.forEach(d => { schedule[d] = []; });

            assignedProjects.forEach((ap, idx) => {
                // 每个项目分配到 2-3 个工作日
                const startDay = idx % workDays.length;
                const daysForProject = Math.min(3, workDays.length);
                for (let i = 0; i < daysForProject; i++) {
                    const dayIdx = workDays[(startDay + i) % workDays.length];
                    const roleColor = ap.role === 'A' ? '#dc2626' : ap.role === 'C' ? '#d97706' : '#4f46e5';
                    if (schedule[dayIdx].length < 2) { // 每天最多显示 2 个项目
                        schedule[dayIdx].push({ title: ap.project.title, role: ap.role, color: roleColor });
                    }
                }
            });

            return { member: m, schedule, leaveSet };
        });
    }, [members, projects, raciData]);

    // ── 对比数据 ──
    const compareMembers = useMemo(() => {
        return members.filter(m => compareIds.includes(m.id));
    }, [members, compareIds]);

    const toggleCompare = (id: string) => {
        setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev);
    };

    // ── 团队健康指标 ──
    const healthMetrics = useMemo(() => {
        const skillCoverage = skillDimensions.length > 0
            ? Math.round(skillAverage.filter(s => s.avg >= 40).length / skillDimensions.length * 100)
            : 0;
        const avgResilience = members.length > 0
            ? Math.round(members.reduce((sum, m) => sum + (m.resilienceIndex || 50), 0) / members.length)
            : 0;
        const avgSynergy = members.length > 0
            ? Math.round(members.reduce((sum, m) => sum + (m.synergyIndex || 50), 0) / members.length)
            : 0;
        const projectsPerMember = members.length > 0
            ? +(members.reduce((sum, m) => sum + (projects.filter(p => p.members.includes(m.name)).length), 0) / members.length).toFixed(1)
            : 0;
        return { skillCoverage, avgResilience, avgSynergy, projectsPerMember };
    }, [members, projects, skillDimensions, skillAverage]);

    // ── Tab 配置 ──
    const tabs: { id: TabId; icon: string; label: string }[] = [
        { id: 'raci', icon: 'fa-solid fa-table-cells', label: t('team.hrMatrix.tabs.raci') },
        { id: 'heatmap', icon: 'fa-solid fa-fire', label: t('team.hrMatrix.tabs.heatmap') },
        { id: 'workload', icon: 'fa-solid fa-gauge-high', label: t('team.hrMatrix.tabs.workload') },
        { id: 'gantt', icon: 'fa-solid fa-timeline', label: t('team.hrMatrix.tabs.gantt') },
        { id: 'compare', icon: 'fa-solid fa-code-compare', label: t('team.hrMatrix.tabs.compare') },
        { id: 'health', icon: 'fa-solid fa-heart-pulse', label: t('team.hrMatrix.tabs.health') },
    ];

    // ── 团队雷达综合数据 (用于热力图的团队概览) ──
    const teamRadarData = useMemo(() => {
        return skillAverage.map(s => ({
            subject: s.subject,
            A: s.avg,
            fullMark: 100,
        }));
    }, [skillAverage]);

    return (
        <div className="h-full flex flex-col gap-5 animate-reveal overflow-hidden">
            {/* Tab 栏 */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <i className={tab.icon}></i> {tab.label}
                        </button>
                    ))}
                </div>

                {/* 统计概览 */}
                <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <i className="fa-solid fa-users text-indigo-500 text-xs"></i>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">{t('team.hrMatrix.stats.totalMembers')}</p>
                            <p className="text-lg font-black text-slate-800 leading-none">{members.length}</p>
                        </div>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <i className="fa-solid fa-diagram-project text-emerald-500 text-xs"></i>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">{t('team.hrMatrix.stats.activeProjects')}</p>
                            <p className="text-lg font-black text-slate-800 leading-none">{projects.length}</p>
                        </div>
                    </div>
                    <div className={`bg-white px-4 py-2 rounded-2xl border shadow-sm flex items-center gap-3 ${overloadedCount > 0 ? 'border-rose-200' : 'border-slate-200'}`}>
                        <i className={`fa-solid fa-triangle-exclamation text-xs ${overloadedCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-300'}`}></i>
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">{t('team.hrMatrix.stats.overloaded')}</p>
                            <p className={`text-lg font-black leading-none ${overloadedCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{overloadedCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-hidden rounded-[2.5rem] bg-white border border-slate-200 shadow-xl">
                {activeTab === 'raci' && (
                    <div className="h-full flex flex-col">
                        {/* RACI 图例 */}
                        <div className="flex items-center gap-6 px-8 pt-6 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-table-cells text-indigo-500"></i>
                                {t('team.hrMatrix.raci.title')}
                            </h3>
                            <div className="flex gap-4 ml-auto">
                                {Object.entries(RACI_CONFIG).map(([key, config]) => (
                                    <div key={key} className="flex items-center gap-1.5">
                                        <div className={`w-6 h-6 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center`}>
                                            <span className="text-[10px] font-black" style={{ color: config.color }}>{key}</span>
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-400 uppercase">{config.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RACI 表格 */}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="sticky top-0 z-10">
                                        <th className="bg-slate-50 px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky left-0 z-20 min-w-[200px]">
                                            {t('team.hrMatrix.raci.member')}
                                        </th>
                                        {projects.map(p => (
                                            <th key={p.id} className="bg-slate-50 px-4 py-4 text-center text-[8px] font-black text-slate-500 uppercase tracking-wide border-b border-slate-100 min-w-[120px]">
                                                <div className="truncate max-w-[120px]" title={p.title}>{p.title}</div>
                                            </th>
                                        ))}
                                        <th className="bg-slate-50/80 px-4 py-4 text-center text-[8px] font-black text-indigo-500 uppercase tracking-wide border-b border-indigo-100 min-w-[80px]">
                                            {t('team.hrMatrix.raci.load')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {raciData.map((row, rowIdx) => (
                                        <tr key={row.member.id} className="group hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-6 py-3 border-b border-slate-50 sticky left-0 bg-white group-hover:bg-indigo-50/30 transition-colors z-10">
                                                <div className="flex items-center gap-3">
                                                    <img src={row.member.avatar} alt="" className="w-8 h-8 rounded-xl border-2 border-white shadow-sm" />
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-black text-slate-800 truncate leading-none">{row.member.name}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 truncate">{row.member.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {projects.map((p, colIdx) => {
                                                const role = row.roles[p.id];
                                                const config = role ? RACI_CONFIG[role] : null;
                                                const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                                                return (
                                                    <td
                                                        key={p.id}
                                                        className="px-4 py-3 text-center border-b border-slate-50"
                                                        onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                                                        onMouseLeave={() => setHoveredCell(null)}
                                                    >
                                                        {config ? (
                                                            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${config.bg} border ${config.border} transition-all ${isHovered ? 'scale-110 shadow-md' : ''}`}>
                                                                <span className="text-sm font-black" style={{ color: config.color }}>{role}</span>
                                                            </div>
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-xl bg-slate-50/50 border border-slate-100/50 inline-flex items-center justify-center">
                                                                <span className="text-[8px] text-slate-200">—</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 text-center border-b border-slate-50">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`text-[11px] font-black font-mono ${(row.member.workload || 0) > 80 ? 'text-rose-500' : 'text-indigo-600'}`}>
                                                        {row.member.workload || 0}%
                                                    </span>
                                                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${(row.member.workload || 0) > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                            style={{ width: `${row.member.workload || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'heatmap' && (
                    <div className="h-full flex flex-col">
                        {/* 热力图标题栏 */}
                        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-fire text-orange-500"></i>
                                {t('team.hrMatrix.heatmap.title')}
                            </h3>
                            {weakestSkill && (
                                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
                                    <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px]"></i>
                                    <span className="text-[9px] font-black text-amber-700 uppercase">
                                        {t('team.hrMatrix.heatmap.weakest')}: {weakestSkill.subject} ({weakestSkill.avg}%)
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 热力图内容 */}
                        <div className="flex-1 overflow-auto custom-scrollbar flex">
                            {/* 左侧: 热力图表格 */}
                            <div className="flex-1 overflow-auto">
                                <table className="w-full border-collapse min-w-[500px]">
                                    <thead>
                                        <tr className="sticky top-0 z-10">
                                            <th className="bg-white px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky left-0 z-20 min-w-[180px]">
                                                {t('team.hrMatrix.heatmap.member')}
                                            </th>
                                            {skillDimensions.map(dim => (
                                                <th key={dim} className="bg-white px-4 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-wide border-b border-slate-100 min-w-[100px]">
                                                    {dim}
                                                </th>
                                            ))}
                                            <th className="bg-white px-4 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-wide border-b border-slate-100 min-w-[80px]">
                                                {t('team.hrMatrix.heatmap.avg')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {members.map((member) => {
                                            const metricsMap: Record<string, number> = {};
                                            member.expertiseMetrics?.forEach(m => { metricsMap[m.subject] = m.A; });
                                            const memberAvg = skillDimensions.length > 0
                                                ? Math.round(skillDimensions.reduce((sum, d) => sum + (metricsMap[d] || 0), 0) / skillDimensions.length)
                                                : 0;

                                            return (
                                                <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-3 border-b border-slate-50 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors z-10">
                                                        <div className="flex items-center gap-3">
                                                            <img src={member.avatar} alt="" className="w-7 h-7 rounded-lg border border-white shadow-sm" />
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black text-slate-800 truncate leading-none">{member.name}</p>
                                                                <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">{member.role}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {skillDimensions.map(dim => {
                                                        const val = metricsMap[dim] || 0;
                                                        return (
                                                            <td key={dim} className="px-2 py-2 text-center border-b border-slate-50">
                                                                <div
                                                                    className="mx-auto w-16 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg cursor-default"
                                                                    style={{ backgroundColor: getHeatColor(val) }}
                                                                >
                                                                    <span
                                                                        className="text-[11px] font-black font-mono"
                                                                        style={{ color: getHeatTextColor(val) }}
                                                                    >
                                                                        {val}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-3 text-center border-b border-slate-50">
                                                        <span className="text-[11px] font-black text-slate-700 font-mono bg-slate-100 px-2 py-1 rounded-lg">{memberAvg}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {/* 团队平均行 */}
                                        <tr className="bg-indigo-50/30">
                                            <td className="px-6 py-3 sticky left-0 bg-indigo-50/30 z-10">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                                                        <i className="fa-solid fa-chart-line text-white text-[10px]"></i>
                                                    </div>
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase">{t('team.hrMatrix.heatmap.teamAvg')}</span>
                                                </div>
                                            </td>
                                            {skillAverage.map(s => (
                                                <td key={s.subject} className="px-2 py-2 text-center">
                                                    <div
                                                        className="mx-auto w-16 h-10 rounded-xl flex items-center justify-center border-2 border-indigo-300"
                                                        style={{ backgroundColor: getHeatColor(s.avg) }}
                                                    >
                                                        <span
                                                            className="text-[11px] font-black font-mono"
                                                            style={{ color: getHeatTextColor(s.avg) }}
                                                        >
                                                            {s.avg}
                                                        </span>
                                                    </div>
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-[11px] font-black text-indigo-600 font-mono">
                                                    {skillAverage.length > 0 ? Math.round(skillAverage.reduce((sum, s) => sum + s.avg, 0) / skillAverage.length) : 0}
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* 右侧: 团队综合雷达图 */}
                            <div className="w-96 border-l border-slate-100 p-6 flex flex-col items-center justify-center shrink-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-dna text-indigo-400"></i>
                                    {t('team.hrMatrix.heatmap.teamRadar')}
                                </p>
                                <div className="w-full aspect-square">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="55%" data={teamRadarData}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: '800' }} />
                                            <Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} strokeWidth={2} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* 色阶图例 */}
                                <div className="mt-4 flex items-center gap-1 w-full justify-center">
                                    <span className="text-[7px] font-black text-slate-400 mr-1">0</span>
                                    {[10, 25, 40, 55, 70, 85].map(v => (
                                        <div
                                            key={v}
                                            className="w-6 h-3 rounded-sm"
                                            style={{ backgroundColor: getHeatColor(v) }}
                                        />
                                    ))}
                                    <span className="text-[7px] font-black text-slate-400 ml-1">100</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'workload' && (
                    <div className="h-full flex flex-col">
                        {/* 负载标题栏 */}
                        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-gauge-high text-violet-500"></i>
                                {t('team.hrMatrix.workload.title')}
                            </h3>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                                    <span className="text-[8px] font-black text-slate-400 uppercase">{t('team.hrMatrix.workload.avgLoad')}</span>
                                    <span className={`text-sm font-black font-mono ${avgWorkload > 70 ? 'text-rose-500' : 'text-indigo-600'}`}>{avgWorkload}%</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                                    <span className="text-[8px] font-black text-emerald-600 uppercase">{t('team.hrMatrix.workload.idle')}</span>
                                    <span className="text-sm font-black text-emerald-600 font-mono">{idleCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* 负载图表 */}
                        <div className="flex-1 flex flex-col overflow-auto">
                            {/* 柱状图 */}
                            <div className="flex-1 min-h-[250px] px-6 pt-4 pb-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={workloadData}
                                        layout="vertical"
                                        margin={{ top: 25, right: 30, left: 10, bottom: 5 }}
                                        barSize={18}
                                    >
                                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            tick={{ fontSize: 11, fontWeight: 800, fill: '#1e293b' }}
                                            tickLine={false}
                                            axisLine={false}
                                            width={90}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'rgba(255,255,255,0.95)',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '16px',
                                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                                                padding: '12px 16px',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                            }}
                                            formatter={(value: number) => [`${value}%`, t('team.hrMatrix.workload.loadLabel')]}
                                        />
                                        <ReferenceLine x={80} stroke="#f43f5e" strokeWidth={2} strokeDasharray="6 3" label={{ value: '80%', fill: '#f43f5e', fontSize: 10, fontWeight: 900, position: 'insideTopRight' }} />
                                        <Bar dataKey="workload" radius={[0, 8, 8, 0]}>
                                            {workloadData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.workload > 80 ? '#f43f5e' : entry.workload > 50 ? '#6366f1' : '#10b981'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* 底部: 负载分析面板 */}
                            <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex gap-4 overflow-x-auto custom-scrollbar">
                                {/* 负载分布卡片 */}
                                {[
                                    { label: t('team.hrMatrix.workload.critical'), range: '> 80%', count: overloadedCount, color: 'bg-rose-500', textColor: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
                                    { label: t('team.hrMatrix.workload.normal'), range: '20-80%', count: workloadData.filter(m => m.workload >= 20 && m.workload <= 80).length, color: 'bg-indigo-500', textColor: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
                                    { label: t('team.hrMatrix.workload.underutilized'), range: '< 20%', count: idleCount, color: 'bg-emerald-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
                                ].map(band => (
                                    <div key={band.label} className={`shrink-0 min-w-[140px] p-3 rounded-xl ${band.bgColor} border ${band.borderColor} flex items-center gap-3`}>
                                        <div className={`w-2.5 h-2.5 rounded-full ${band.color}`}></div>
                                        <div>
                                            <p className={`text-[9px] font-black uppercase ${band.textColor}`}>{band.label}</p>
                                            <p className="text-[7px] font-bold text-slate-400">{band.range}</p>
                                        </div>
                                        <span className={`text-lg font-black font-mono ${band.textColor} ml-auto`}>{band.count}</span>
                                    </div>
                                ))}

                                {/* 过载人员头像 */}
                                {overloadedCount > 0 && (
                                    <div className="shrink-0 flex items-center gap-2 pl-3 border-l border-slate-200">
                                        <i className="fa-solid fa-fire text-rose-400 text-[10px] animate-pulse"></i>
                                        {workloadData.filter(m => m.workload > 80).map(m => (
                                            <div key={m.name} className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-rose-100 shadow-sm shrink-0">
                                                <img src={m.avatar} alt="" className="w-5 h-5 rounded-md" />
                                                <span className="text-[8px] font-black text-rose-600">{m.name} {m.workload}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 闲置人员头像 */}
                                {idleCount > 0 && (
                                    <div className="shrink-0 flex items-center gap-2 pl-3 border-l border-slate-200">
                                        <i className="fa-solid fa-battery-empty text-emerald-400 text-[10px]"></i>
                                        {workloadData.filter(m => m.workload < 20).map(m => (
                                            <div key={m.name} className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-emerald-100 shadow-sm shrink-0">
                                                <img src={m.avatar} alt="" className="w-5 h-5 rounded-md" />
                                                <span className="text-[8px] font-black text-emerald-600">{m.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'gantt' && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-timeline text-cyan-500"></i>
                                {t('team.hrMatrix.gantt.title')}
                            </h3>
                            <div className="flex gap-2">
                                {['R', 'A', 'C'].map((role, i) => {
                                    const colors = ['#4f46e5', '#dc2626', '#d97706'];
                                    return (<div key={role} className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{backgroundColor: colors[i]}}></div><span className="text-[7px] font-black text-slate-400 uppercase">{RACI_CONFIG[role]?.label}</span></div>);
                                })}
                                <div className="flex items-center gap-1 ml-2"><div className="w-3 h-3 rounded bg-rose-300 border border-rose-400" style={{backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,.4) 2px,rgba(255,255,255,.4) 4px)'}}></div><span className="text-[7px] font-black text-slate-400 uppercase">{t('team.hrMatrix.gantt.leave')}</span></div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse min-w-[700px]">
                                <thead><tr className="sticky top-0 z-10">
                                    <th className="bg-slate-50 px-6 py-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 sticky left-0 z-20 min-w-[180px]">{t('team.hrMatrix.gantt.member')}</th>
                                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i) => (
                                        <th key={d} className="bg-slate-50 px-2 py-3 text-center text-[8px] font-black text-slate-500 uppercase border-b border-slate-100 min-w-[100px]">{d}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {ganttData.map(row => {
                                        return (
                                            <tr key={row.member.id} className="group hover:bg-cyan-50/20 transition-colors">
                                                <td className="px-6 py-3 border-b border-slate-50 sticky left-0 bg-white group-hover:bg-cyan-50/20 z-10">
                                                    <div className="flex items-center gap-2">
                                                        <img src={row.member.avatar} alt="" className="w-7 h-7 rounded-lg border border-white shadow-sm" />
                                                        <div className="min-w-0"><p className="text-[10px] font-black text-slate-800 truncate">{row.member.name}</p><p className="text-[7px] font-bold text-slate-400 uppercase">{row.member.role}</p></div>
                                                    </div>
                                                </td>
                                                {[0,1,2,3,4,5,6].map(day => {
                                                    const isLeave = row.leaveSet.has(day);
                                                    const dayTasks = row.schedule[day] || [];
                                                    return (
                                                        <td key={day} className={`px-1 py-2 text-center border-b border-slate-50 ${isLeave ? 'bg-rose-50/50' : ''}`}>
                                                            {isLeave ? (
                                                                <div className="h-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center" style={{backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(244,63,94,.1) 3px,rgba(244,63,94,.1) 6px)'}}>
                                                                    <span className="text-[7px] font-black text-rose-400">{t('team.hrMatrix.gantt.off')}</span>
                                                                </div>
                                                            ) : dayTasks.length > 0 ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    {dayTasks.map((task: { title: string; role: RaciRole; color: string }, ti: number) => (
                                                                        <div key={ti} className="h-3.5 rounded" style={{backgroundColor: task.color + '20', borderLeft: `3px solid ${task.color}`}}>
                                                                            <span className="text-[6px] font-bold px-1" style={{color: task.color}} title={task.title}>{task.title.slice(0,8)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : day >= 5 ? (
                                                                <div className="h-8 rounded-lg bg-slate-50/30 flex items-center justify-center">
                                                                    <span className="text-[7px] text-slate-200">—</span>
                                                                </div>
                                                            ) : (
                                                                <div className="h-8 rounded-lg bg-emerald-50/30 border border-emerald-100/50 flex items-center justify-center">
                                                                    <span className="text-[6px] font-bold text-emerald-300">Free</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'compare' && (
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-code-compare text-violet-500"></i>
                                {t('team.hrMatrix.compare.title')}
                            </h3>
                            <span className="text-[8px] font-bold text-slate-400">{t('team.hrMatrix.compare.hint')}</span>
                        </div>
                        <div className="flex-1 flex overflow-hidden">
                            {/* 左侧选择列表 */}
                            <div className="w-56 border-r border-slate-100 p-4 overflow-y-auto custom-scrollbar shrink-0">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('team.hrMatrix.compare.selectMembers')}</p>
                                <div className="space-y-1.5">
                                    {members.map(m => (
                                        <button key={m.id} onClick={() => toggleCompare(m.id)} className={`w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all ${compareIds.includes(m.id) ? 'bg-violet-50 border border-violet-200 ring-1 ring-violet-300' : 'bg-white border border-slate-100 hover:bg-slate-50'}`}>
                                            <img src={m.avatar} alt="" className="w-6 h-6 rounded-lg" />
                                            <div className="flex-1 min-w-0"><p className="text-[9px] font-black text-slate-700 truncate">{m.name}</p><p className="text-[6px] font-bold text-slate-400 uppercase">{m.role}</p></div>
                                            {compareIds.includes(m.id) && <i className="fa-solid fa-check text-violet-500 text-[8px]"></i>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* 右侧对比 */}
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                                {compareMembers.length < 2 ? (
                                    <div className="h-full flex items-center justify-center"><div className="text-center"><i className="fa-solid fa-users text-slate-200 text-4xl mb-3"></i><p className="text-[10px] font-black text-slate-300 uppercase">{t('team.hrMatrix.compare.selectAtLeast2')}</p></div></div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* 雷达图对比 */}
                                        <div className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">{t('team.hrMatrix.compare.radarTitle')}</p>
                                            <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={skillDimensions.map(d => ({ subject: d, fullMark: 100, ...Object.fromEntries(compareMembers.map(m => [m.name, m.expertiseMetrics?.find(e => e.subject === d)?.A || 0])) }))}>
                                                        <PolarGrid stroke="#e2e8f0" />
                                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 9, fontWeight: '800' }} />
                                                        {compareMembers.map((m, i) => {
                                                            const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'];
                                                            return <Radar key={m.id} dataKey={m.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.15} strokeWidth={2} />;
                                                        })}
                                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 10, fontWeight: 800 }} />
                                                    </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        {/* 指标对比表 */}
                                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                            <table className="w-full">
                                                <thead><tr className="bg-slate-50">
                                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-500 uppercase">{t('team.hrMatrix.compare.metric')}</th>
                                                    {compareMembers.map((m, i) => {
                                                        const colors = ['text-indigo-600', 'text-rose-600', 'text-emerald-600', 'text-amber-600'];
                                                        return <th key={m.id} className={`px-4 py-3 text-center text-[9px] font-black ${colors[i]} uppercase`}>{m.name}</th>;
                                                    })}
                                                </tr></thead>
                                                <tbody>
                                                    {[{k: 'workload', l: t('team.hrMatrix.compare.workload'), fn: (m: UserProfile) => `${m.workload || 0}%`},
                                                      {k: 'resilience', l: t('team.hrMatrix.compare.resilience'), fn: (m: UserProfile) => `${m.resilienceIndex || 0}`},
                                                      {k: 'synergy', l: t('team.hrMatrix.compare.synergy'), fn: (m: UserProfile) => `${m.synergyIndex || 0}`},
                                                      {k: 'projects', l: t('team.hrMatrix.compare.projects'), fn: (m: UserProfile) => `${projects.filter(p => p.members.includes(m.name)).length}`},
                                                    ].map(row => (
                                                        <tr key={row.k} className="border-t border-slate-50 hover:bg-slate-50/50">
                                                            <td className="px-4 py-2.5 text-[9px] font-bold text-slate-500">{row.l}</td>
                                                            {compareMembers.map(m => <td key={m.id} className="px-4 py-2.5 text-center text-[11px] font-black text-slate-800 font-mono">{row.fn(m)}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'health' && (
                    <div className="h-full flex flex-col">
                        <div className="px-8 pt-6 pb-4 border-b border-slate-100 shrink-0">
                            <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <i className="fa-solid fa-heart-pulse text-pink-500"></i>
                                {t('team.hrMatrix.health.title')}
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                            {/* 核心指标卡片 */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                {[{icon: 'fa-solid fa-shield-check', color: 'indigo', label: t('team.hrMatrix.health.skillCoverage'), value: `${healthMetrics.skillCoverage}%`, desc: t('team.hrMatrix.health.skillCoverageDesc')},
                                  {icon: 'fa-solid fa-gauge-high', color: 'amber', label: t('team.hrMatrix.health.avgLoad'), value: `${avgWorkload}%`, desc: avgWorkload > 70 ? t('team.hrMatrix.health.loadHigh') : t('team.hrMatrix.health.loadOk')},
                                  {icon: 'fa-solid fa-heart', color: 'rose', label: t('team.hrMatrix.health.resilience'), value: `${healthMetrics.avgResilience}`, desc: t('team.hrMatrix.health.resilienceDesc')},
                                  {icon: 'fa-solid fa-handshake', color: 'emerald', label: t('team.hrMatrix.health.synergy'), value: `${healthMetrics.avgSynergy}`, desc: t('team.hrMatrix.health.synergyDesc')},
                                ].map(card => (
                                    <div key={card.label} className={`bg-${card.color}-50 border border-${card.color}-200 rounded-2xl p-5 flex flex-col gap-2`}>
                                        <div className="flex items-center gap-2"><i className={`${card.icon} text-${card.color}-500 text-xs`}></i><span className={`text-[8px] font-black text-${card.color}-600 uppercase tracking-wider`}>{card.label}</span></div>
                                        <p className={`text-3xl font-black text-${card.color}-600 font-mono leading-none`}>{card.value}</p>
                                        <p className="text-[8px] font-bold text-slate-400">{card.desc}</p>
                                    </div>
                                ))}
                            </div>
                            {/* 综合雷达 + 人均项目 */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-white border border-slate-100 rounded-2xl p-6">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">{t('team.hrMatrix.health.teamProfile')}</p>
                                    <div className="h-56"><ResponsiveContainer width="100%" height="100%"><RadarChart cx="50%" cy="50%" outerRadius="65%" data={teamRadarData}><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 9, fontWeight: '800' }} /><Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} strokeWidth={2} /></RadarChart></ResponsiveContainer></div>
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl p-6">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">{t('team.hrMatrix.health.summary')}</p>
                                    <div className="space-y-4">
                                        {[{l: t('team.hrMatrix.health.totalMembers'), v: members.length, icon: 'fa-users', c: 'indigo'},
                                          {l: t('team.hrMatrix.health.activeProjects'), v: projects.length, icon: 'fa-diagram-project', c: 'emerald'},
                                          {l: t('team.hrMatrix.health.avgProjectsPerMember'), v: healthMetrics.projectsPerMember, icon: 'fa-chart-simple', c: 'violet'},
                                          {l: t('team.hrMatrix.health.overloadedMembers'), v: overloadedCount, icon: 'fa-triangle-exclamation', c: overloadedCount > 0 ? 'rose' : 'emerald'},
                                          {l: t('team.hrMatrix.health.idleMembers'), v: idleCount, icon: 'fa-battery-empty', c: idleCount > 0 ? 'amber' : 'emerald'},
                                        ].map(item => (
                                            <div key={item.l} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                                                <div className="flex items-center gap-2"><i className={`fa-solid ${item.icon} text-${item.c}-400 text-[10px]`}></i><span className="text-[9px] font-bold text-slate-500">{item.l}</span></div>
                                                <span className={`text-sm font-black font-mono text-${item.c}-600`}>{item.v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HRMatrixView;
