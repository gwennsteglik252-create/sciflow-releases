import React, { useMemo, useState } from 'react';
import { ResearchProject, AppView } from '../../types';

interface MilestoneTimelineProps {
    projects: ResearchProject[];
    isLight: boolean;
    navigate?: (view: AppView, projectId?: string, subView?: string) => void;
}

interface FlatMilestone {
    id: string;
    title: string;
    dueDate: Date;
    status: string;
    projectId: string;
    projectTitle: string;
    projectColor: string;
}

const PROJECT_COLORS = [
    { bg: 'bg-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-100', dot: '#6366f1' },
    { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-100', dot: '#10b981' },
    { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-100', dot: '#f59e0b' },
    { bg: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-100', dot: '#f43f5e' },
    { bg: 'bg-violet-500', text: 'text-violet-500', light: 'bg-violet-100', dot: '#8b5cf6' },
    { bg: 'bg-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-100', dot: '#06b6d4' },
];

const STATUS_CONFIG: Record<string, { icon: string; label: string; dotClass: string }> = {
    completed: { icon: 'fa-circle-check', label: '已完成', dotClass: 'bg-emerald-500' },
    'in-progress': { icon: 'fa-spinner', label: '进行中', dotClass: 'bg-indigo-500' },
    pending: { icon: 'fa-circle', label: '待开始', dotClass: 'bg-slate-300' },
    failed: { icon: 'fa-circle-xmark', label: '已失败', dotClass: 'bg-rose-500' },
};

const NODE_TONE: Record<string, { fill: string; soft: string; line: string; glow: string }> = {
    completed: { fill: '#10b981', soft: '#6ee7b7', line: 'bg-emerald-300', glow: '0 0 0 6px rgba(16,185,129,0.16)' },
    'in-progress': { fill: '#6366f1', soft: '#a5b4fc', line: 'bg-indigo-300', glow: '0 0 0 8px rgba(99,102,241,0.18)' },
    pending: { fill: '#94a3b8', soft: '#cbd5e1', line: 'bg-slate-200', glow: '0 0 0 6px rgba(148,163,184,0.14)' },
    failed: { fill: '#f43f5e', soft: '#fda4af', line: 'bg-rose-300', glow: '0 0 0 7px rgba(244,63,94,0.18)' },
};

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ projects, isLight, navigate }) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // 展平所有里程碑并按时间排序
    const allMilestones = useMemo<FlatMilestone[]>(() => {
        const colorMap: Record<string, typeof PROJECT_COLORS[0]> = {};
        let colorIdx = 0;
        const flat: FlatMilestone[] = [];

        (projects || []).forEach(proj => {
            if (!colorMap[proj.id]) {
                colorMap[proj.id] = PROJECT_COLORS[colorIdx % PROJECT_COLORS.length];
                colorIdx++;
            }
            const color = colorMap[proj.id];
            (proj.milestones || []).forEach(ms => {
                flat.push({
                    id: ms.id,
                    title: ms.title,
                    dueDate: new Date(ms.dueDate),
                    status: ms.status,
                    projectId: proj.id,
                    projectTitle: proj.title,
                    projectColor: color.dot,
                });
            });
        });

        return flat.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [projects]);

    // 项目颜色映射（用于图例）
    const projectColorMap = useMemo(() => {
        const map: Record<string, typeof PROJECT_COLORS[0]> = {};
        let colorIdx = 0;
        (projects || []).forEach(proj => {
            map[proj.id] = PROJECT_COLORS[colorIdx % PROJECT_COLORS.length];
            colorIdx++;
        });
        return map;
    }, [projects]);

    // 计算时间轴范围
    const { minDate, maxDate, rangeMs } = useMemo(() => {
        const now = new Date();
        if (allMilestones.length === 0) {
            return { minDate: now, maxDate: now, rangeMs: 1 };
        }
        const dates = allMilestones.map(m => m.dueDate.getTime());
        const minD = Math.min(...dates);
        const maxD = Math.max(...dates);
        // 每侧留 5% padding
        const pad = Math.max((maxD - minD) * 0.1, 7 * 24 * 3600 * 1000); // 至少 7 天 padding
        return {
            minDate: new Date(minD - pad),
            maxDate: new Date(maxD + pad),
            rangeMs: (maxD + pad) - (minD - pad),
        };
    }, [allMilestones]);

    const now = new Date();
    const nowPct = ((now.getTime() - minDate.getTime()) / rangeMs) * 100;

    const getPct = (date: Date) => ((date.getTime() - minDate.getTime()) / rangeMs) * 100;

    const formatDate = (d: Date) => {
        const m = d.getMonth() + 1;
        const day = d.getDate();
        return `${m}/${day}`;
    };

    const formatFull = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const isPast = (d: Date) => d < now;

    if (allMilestones.length === 0) {
        return (
            <div className={`p-6 rounded-[2.5rem] border flex items-center justify-center gap-3 ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
                <i className="fa-solid fa-timeline text-2xl text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">暂无里程碑数据</p>
            </div>
        );
    }

    return (
        <div className={`h-full p-2 pb-1 rounded-[2rem] border flex flex-col gap-0.5 overflow-hidden justify-end ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <h4 className={`text-[11px] font-black flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    <i className="fa-solid fa-timeline text-violet-500" />
                    里程碑时间轴
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isLight ? 'bg-violet-50 text-violet-500' : 'bg-violet-500/10 text-violet-400'}`}>
                        {allMilestones.length} 节点
                    </span>
                </h4>
                {/* 项目图例 */}
                <div className="flex items-center gap-3 flex-wrap">
                    {(projects || []).map(proj => {
                        const c = projectColorMap[proj.id];
                        if (!c) return null;
                        return (
                            <div
                                key={proj.id}
                                className="flex items-center gap-1.5 cursor-pointer group"
                                onClick={() => navigate?.('project_detail', proj.id, 'logs')}
                            >
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                                <span className={`text-[10px] font-black uppercase tracking-wide truncate max-w-[100px] group-hover:underline ${isLight ? 'text-slate-500 group-hover:text-slate-800' : 'text-slate-400 group-hover:text-white'}`}>
                                    {proj.title.substring(0, 12)}{proj.title.length > 12 ? '..' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Timeline Track — 上下交错分布 */}
            {(() => {
                /* ── 轨道布局常量 ── */
                const TRACK_Y = 28;           // 轨道在容器中的 Y 位置（px）
                const TIER_GAP = 22;          // 每层之间的间距（px）
                const DOT_SIZE = 10;          // 圆点直径（px）
                const STEM_LEN = 6;           // 竖线长度（px）
                const CONTAINER_H = 68;       // 容器总高度（px）

                /* ── 碰撞避让：多层分配算法 ── */
                const sorted = allMilestones
                    .map(ms => ({ ms, pct: Math.max(1, Math.min(99, getPct(ms.dueDate))) }))
                    .sort((a, b) => a.pct - b.pct);

                const MIN_GAP = 10; // 10% 以内视为碰撞
                // tier: 0 = 下方第1层（默认）, 1 = 上方第1层, 2 = 下方第2层, 3 = 上方第2层
                const tierMap = new Map<string, number>();

                // 每层追踪最后使用的位置百分比，用于碰撞检测
                const tierLastPct: number[] = [-Infinity, -Infinity, -Infinity, -Infinity];
                // 分配顺序：优先下方1层→上方1层→下方2层→上方2层
                const tierOrder = [0, 1, 2, 3];

                sorted.forEach(({ ms, pct }) => {
                    let assigned = false;
                    for (const tier of tierOrder) {
                        if (pct - tierLastPct[tier] >= MIN_GAP) {
                            tierMap.set(ms.id, tier);
                            tierLastPct[tier] = pct;
                            assigned = true;
                            break;
                        }
                    }
                    if (!assigned) {
                        // 所有层都冲突，选占用最少的一层
                        const leastUsed = tierOrder.reduce((best, t) =>
                            (tierLastPct[t] < tierLastPct[best] ? t : best), 0);
                        tierMap.set(ms.id, leastUsed);
                        tierLastPct[leastUsed] = pct;
                    }
                });

                // tier → 实际像素偏移 (相对于 TRACK_Y)
                const getTierOffset = (tier: number): { dotY: number; labelAbove: boolean } => {
                    switch (tier) {
                        case 0: return { dotY: TRACK_Y + 3, labelAbove: false };           // 下方第1层
                        case 1: return { dotY: TRACK_Y - DOT_SIZE - 3, labelAbove: true }; // 上方第1层
                        case 2: return { dotY: TRACK_Y + 3 + TIER_GAP, labelAbove: false }; // 下方第2层
                        case 3: return { dotY: TRACK_Y - DOT_SIZE - 3 - TIER_GAP, labelAbove: true }; // 上方第2层
                        default: return { dotY: TRACK_Y + 3, labelAbove: false };
                    }
                };

                return (
                    <div className="relative select-none" style={{ minHeight: CONTAINER_H }}>
                        {/* 时间轴背景轨道 */}
                        <div className={`absolute left-0 right-0 h-0.5 rounded-full ${isLight ? 'bg-slate-100' : 'bg-white/10'}`} style={{ top: TRACK_Y }} />
                        <div className="absolute left-0 right-0 h-px rounded-full bg-gradient-to-r from-indigo-200 via-violet-200 to-cyan-200 opacity-60" style={{ top: TRACK_Y }} />

                        {/* 今日竖线 */}
                        {nowPct >= 0 && nowPct <= 100 && (
                            <div
                                className="absolute top-0 bottom-0 flex flex-col items-center z-10"
                                style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}
                            >
                                <div className="w-px h-full bg-rose-400/70 border-l border-dashed border-rose-400" />
                                <span className="absolute text-[8px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100"
                                    style={{ top: TRACK_Y - 18 }}>
                                    今日
                                </span>
                            </div>
                        )}

                        {/* 月份刻度 — 智能间隔 */}
                        {(() => {
                            const ticks: { pct: number; label: string }[] = [];
                            const totalMonths = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth());
                            const stepMonths = totalMonths <= 6 ? 1 : totalMonths <= 18 ? 3 : 6;
                            const cur = new Date(minDate);
                            cur.setDate(1);
                            cur.setHours(0, 0, 0, 0);
                            const alignedMonth = Math.ceil((cur.getMonth() + 1) / stepMonths) * stepMonths;
                            cur.setMonth(alignedMonth);
                            while (cur <= maxDate) {
                                const pct = ((cur.getTime() - minDate.getTime()) / rangeMs) * 100;
                                if (pct > 2 && pct < 98) {
                                    const m = cur.getMonth() + 1;
                                    const label = stepMonths >= 6 ? `${cur.getFullYear()}.${m}月` : `${m}月`;
                                    ticks.push({ pct, label });
                                }
                                cur.setMonth(cur.getMonth() + stepMonths);
                            }
                            return ticks.map((t, i) => (
                                <div
                                    key={i}
                                    className="absolute flex flex-col items-center"
                                    style={{ left: `${t.pct}%`, transform: 'translateX(-50%)', top: TRACK_Y }}
                                >
                                    <div className={`w-px h-3 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />
                                    <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isLight ? 'text-slate-300' : 'text-slate-500'}`}>
                                        {t.label}
                                    </span>
                                </div>
                            ));
                        })()}

                        {/* 里程碑节点 — 多层上下交错分布 */}
                        {allMilestones.map((ms) => {
                            const pct = Math.max(1, Math.min(99, getPct(ms.dueDate)));
                            const sc = STATUS_CONFIG[ms.status] || STATUS_CONFIG['pending'];
                            const past = isPast(ms.dueDate);
                            const isActive = ms.status === 'in-progress';
                            const isHovered = hoveredId === ms.id;
                            const tone = NODE_TONE[ms.status] || NODE_TONE.pending;
                            const labelMax = isHovered ? 150 : 110;
                            const tier = tierMap.get(ms.id) ?? 0;
                            const { dotY, labelAbove } = getTierOffset(tier);

                            // 标签水平对齐方式（防止边缘溢出）
                            const labelAnchorStyle: React.CSSProperties =
                                pct < 12
                                    ? { left: 0, transform: 'translateX(0)' }
                                    : pct > 88
                                        ? { right: 0, transform: 'translateX(0)' }
                                        : { left: '50%', transform: 'translateX(-50%)' };

                            // 竖线从圆点到轨道
                            const stemTop = labelAbove ? dotY + DOT_SIZE : TRACK_Y + 1;
                            const stemBottom = labelAbove ? TRACK_Y : dotY;
                            const stemHeight = Math.abs(stemBottom - stemTop);

                            return (
                                <div
                                    key={ms.id}
                                    className="absolute cursor-pointer"
                                    style={{ left: `${pct}%`, top: 0, bottom: 0, width: 0 }}
                                    onMouseEnter={() => setHoveredId(ms.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    onClick={() => navigate?.('project_detail', ms.projectId, 'logs')}
                                >
                                    {/* 连接竖线（圆点到轨道） */}
                                    <div
                                        className={`absolute left-0 ${tone.line} opacity-60`}
                                        style={{
                                            top: stemTop,
                                            height: stemHeight,
                                            width: 1,
                                            transform: 'translateX(-0.5px)',
                                        }}
                                    />

                                    <div
                                        className={`absolute rounded-full border-[1.5px] border-white shadow-sm transition-all duration-200 ${isHovered ? 'scale-[1.4] z-50' : 'scale-100 z-20'} ${isActive ? 'animate-pulse' : ''}`}
                                        style={{
                                            width: DOT_SIZE,
                                            height: DOT_SIZE,
                                            top: dotY,
                                            left: -DOT_SIZE / 2,
                                            backgroundColor: past && ms.status === 'pending' ? '#f59e0b' : tone.fill,
                                            boxShadow: isHovered ? tone.glow : undefined,
                                        }}
                                    >
                                        {ms.status === 'completed' && (
                                            <i className="fa-solid fa-check text-white text-[4px] absolute inset-0 flex items-center justify-center" />
                                        )}
                                    </div>

                                    {/* 标签卡片 */}
                                    <div
                                        className={`absolute transition-all duration-150 ${isHovered ? 'z-50' : 'z-10'}`}
                                        style={{
                                            ...(labelAbove
                                                ? { bottom: CONTAINER_H - dotY + 2 }
                                                : { top: dotY + DOT_SIZE + STEM_LEN }),
                                            ...labelAnchorStyle,
                                        }}
                                    >
                                        <div
                                            className={`flex flex-col items-center gap-px px-1.5 py-0.5 rounded-lg border transition-all duration-150 backdrop-blur-sm whitespace-nowrap ${isHovered
                                                ? (isLight ? 'bg-slate-900 border-slate-700 text-white shadow-2xl scale-105' : 'bg-white border-slate-200 text-slate-800 shadow-2xl scale-105')
                                                : (isLight ? 'bg-white/90 border-slate-100 shadow-sm' : 'bg-slate-800/85 border-white/10')
                                                }`}
                                            style={{ maxWidth: labelMax }}
                                        >
                                            <div className="flex items-center gap-0.5">
                                                <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: ms.projectColor }} />
                                                <span className={`text-[8px] font-black truncate ${isHovered ? '' : (isLight ? 'text-slate-700' : 'text-slate-200')}`} style={{ maxWidth: isHovered ? 110 : 80 }}>
                                                    {ms.title}
                                                </span>
                                            </div>
                                            <span className={`text-[7px] leading-none font-bold ${past && ms.status !== 'completed' ? 'text-amber-500' :
                                                isHovered ? 'text-slate-400' :
                                                    (isLight ? 'text-slate-400' : 'text-slate-500')
                                                }`}>
                                                {past && ms.status !== 'completed' && ms.status !== 'failed' ? '⚠ ' : ''}{formatDate(ms.dueDate)}
                                            </span>
                                            {isHovered && (
                                                <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: tone.soft }}>
                                                    {sc.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            {/* 底部状态汇总 */}
            <div className="flex items-center gap-4 pt-1 shrink-0 border-t border-dashed border-slate-100/50 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const count = allMilestones.filter(m => m.status === key).length;
                    if (count === 0) return null;
                    return (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                            <span className={`text-[10px] font-black uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                {cfg.label} · {count}
                            </span>
                        </div>
                    );
                })}
                {/* 已逾期 */}
                {(() => {
                    const overdueCount = allMilestones.filter(m => m.dueDate < now && m.status !== 'completed' && m.status !== 'failed').length;
                    if (overdueCount === 0) return null;
                    return (
                        <div className="flex items-center gap-1.5 ml-auto">
                            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px] animate-pulse" />
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-wide">{overdueCount} 项已逾期</span>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default MilestoneTimeline;
