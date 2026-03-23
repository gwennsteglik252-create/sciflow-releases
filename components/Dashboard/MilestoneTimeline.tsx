import React, { useMemo, useState } from 'react';
import { ResearchProject, AppView } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

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




const NODE_TONE: Record<string, { fill: string; soft: string; line: string; glow: string }> = {
    completed: { fill: '#10b981', soft: '#6ee7b7', line: 'bg-emerald-300', glow: '0 0 0 6px rgba(16,185,129,0.16)' },
    'in-progress': { fill: '#6366f1', soft: '#a5b4fc', line: 'bg-indigo-300', glow: '0 0 0 8px rgba(99,102,241,0.18)' },
    pending: { fill: '#94a3b8', soft: '#cbd5e1', line: 'bg-slate-200', glow: '0 0 0 6px rgba(148,163,184,0.14)' },
    failed: { fill: '#f43f5e', soft: '#fda4af', line: 'bg-rose-300', glow: '0 0 0 7px rgba(244,63,94,0.18)' },
};

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ projects, isLight, navigate }) => {
    const { t } = useTranslation();
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const STATUS_CONFIG: Record<string, { icon: string; label: string; dotClass: string }> = {
        completed: { icon: 'fa-circle-check', label: t('dashboardWidgets.completed'), dotClass: 'bg-emerald-500' },
        'in-progress': { icon: 'fa-spinner', label: t('dashboardWidgets.inProgressMs'), dotClass: 'bg-indigo-500' },
        pending: { icon: 'fa-circle', label: t('dashboardWidgets.pendingMs'), dotClass: 'bg-slate-300' },
        failed: { icon: 'fa-circle-xmark', label: t('dashboardWidgets.failed'), dotClass: 'bg-rose-500' },
    };

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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dashboardWidgets.noMilestoneData')}</p>
            </div>
        );
    }

    return (
        <div className={`h-full p-2 pb-1 rounded-[2rem] border flex flex-col gap-0.5 overflow-hidden justify-end ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <h4 className={`text-[11px] font-black flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    <i className="fa-solid fa-timeline text-violet-500" />
                    {t('dashboardWidgets.milestoneTimeline')}
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isLight ? 'bg-violet-50 text-violet-500' : 'bg-violet-500/10 text-violet-400'}`}>
                        {allMilestones.length} {t('dashboardWidgets.nodes')}
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

            {/* Timeline Track — 动态冲突避让与自适应高度 */}
            {(() => {
                const containerRef = React.useRef<HTMLDivElement>(null);
                const [containerWidth, setContainerWidth] = React.useState(0);

                React.useEffect(() => {
                    if (containerRef.current) {
                        const resizeObserver = new ResizeObserver((entries) => {
                            for (let entry of entries) {
                                setContainerWidth(entry.contentRect.width);
                            }
                        });
                        resizeObserver.observe(containerRef.current);
                        return () => resizeObserver.disconnect();
                    }
                }, []);

                /* ── 轨道布局常量 ── */
                const TIER_HEIGHT = 28;       // 每层的高度间距（px）
                const DOT_SIZE = 10;          // 圆点直径（px）
                const MIN_X_GAP = 115;        // 标签最小水平像素间距

                // 将里程碑转换为带百分比和预估像素位置的对象
                const nodes = allMilestones.map(ms => {
                    const pct = Math.max(1, Math.min(99, getPct(ms.dueDate)));
                    const x = (pct / 100) * (containerWidth || 1000);
                    return { ms, pct, x };
                }).sort((a, b) => a.x - b.x);

                // tier: 0=轨道下方, 1=轨道上方, 2=轨道下方更远, 3=轨道上方更远...
                const tierMap = new Map<string, number>();
                const tierLastX: number[] = [];

                nodes.forEach(node => {
                    let tier = 0;
                    let assigned = false;
                    
                    // 尝试在现有层级中寻找不冲突的位置
                    while (!assigned) {
                        const lastX = tierLastX[tier] ?? -Infinity;
                        if (node.x - lastX >= MIN_X_GAP) {
                            tierMap.set(node.ms.id, tier);
                            tierLastX[tier] = node.x;
                            assigned = true;
                        } else {
                            tier++;
                            if (tier > 10) break; // 防止死循环
                        }
                    }
                });

                const maxTier = tierLastX.length > 0 ? tierLastX.length - 1 : 1;
                const TRACK_Y_RATIO = 0.5; // 轨道处于中间
                const dynamicHeight = Math.max(100, (maxTier + 2) * TIER_HEIGHT);
                const trackY = dynamicHeight * TRACK_Y_RATIO;

                return (
                    <div 
                        ref={containerRef}
                        className="relative select-none transition-all duration-300" 
                        style={{ height: dynamicHeight }}
                    >
                        {/* 时间轴背景轨道 */}
                        <div className={`absolute left-0 right-0 h-1 rounded-full ${isLight ? 'bg-slate-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]' : 'bg-white/20'}`} style={{ top: trackY }} />
                        <div className="absolute left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 opacity-90 shadow-[0_0_8px_rgba(139,92,246,0.3)]" style={{ top: trackY + 1 }} />

                        {/* 今日竖线 */}
                        {nowPct >= 0 && nowPct <= 100 && (
                            <div
                                className="absolute top-0 bottom-0 flex flex-col items-center z-10"
                                style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}
                            >
                                <div className="w-px h-full bg-rose-400/50 border-l border-dashed border-rose-400/60" />
                                <span className="absolute text-[8px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap bg-rose-50/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-rose-100 shadow-sm"
                                    style={{ top: trackY - 18 }}>
                                    今日
                                </span>
                            </div>
                        )}

                        {/* 月份刻度 */}
                        {(() => {
                            const ticks: { pct: number; label: string }[] = [];
                            const totalMonths = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth());
                            const stepMonths = totalMonths <= 6 ? 1 : totalMonths <= 18 ? 3 : 6;
                            const cur = new Date(minDate);
                            cur.setDate(1); cur.setHours(0, 0, 0, 0);
                            const alignedMonth = Math.ceil((cur.getMonth() + 1) / stepMonths) * stepMonths;
                            cur.setMonth(alignedMonth - 1);
                            while (cur <= maxDate) {
                                const pct = ((cur.getTime() - minDate.getTime()) / rangeMs) * 100;
                                if (pct > 2 && pct < 98) {
                                    const m = cur.getMonth() + 1;
                                    const label = stepMonths >= 6 ? `${cur.getFullYear()}.${m}${t('dashboardWidgets.monthSuffix')}` : `${m}${t('dashboardWidgets.monthSuffix')}`;
                                    ticks.push({ pct, label });
                                }
                                cur.setMonth(cur.getMonth() + stepMonths);
                            }
                            return ticks.map((t, i) => (
                                <div key={i} className="absolute flex flex-col items-center" style={{ left: `${t.pct}%`, transform: 'translateX(-50%)', top: trackY }}>
                                    <div className={`w-[1.5px] h-4 ${isLight ? 'bg-slate-300 shadow-sm' : 'bg-white/30'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isLight ? 'text-slate-400' : 'text-slate-400'}`}>
                                        {t.label}
                                    </span>
                                </div>
                            ));
                        })()}

                        {/* 里程碑节点 */}
                        {nodes.map(({ ms, pct }) => {
                            const sc = STATUS_CONFIG[ms.status] || STATUS_CONFIG['pending'];
                            const past = isPast(ms.dueDate);
                            const isActive = ms.status === 'in-progress';
                            const isHovered = hoveredId === ms.id;
                            const tone = NODE_TONE[ms.status] || NODE_TONE.pending;
                            
                            const tier = tierMap.get(ms.id) ?? 0;
                            const isAbove = tier % 2 === 1;
                            const tierLevel = Math.floor(tier / 2) + 1;
                            
                            // 偏移计算：tier 0 -> 下1, tier 1 -> 上1, tier 2 -> 下2, tier 3 -> 上2
                            const verticalOffset = tierLevel * TIER_HEIGHT;
                            const dotY = isAbove ? trackY - verticalOffset - DOT_SIZE / 2 : trackY + verticalOffset - DOT_SIZE / 2;
                            
                            const labelAnchorStyle: React.CSSProperties =
                                pct < 15 ? { left: 0, transform: 'translateX(0)' } :
                                pct > 85 ? { right: 0, transform: 'translateX(0)' } :
                                { left: '50%', transform: 'translateX(-50%)' };

                            return (
                                <div
                                    key={ms.id}
                                    className="absolute"
                                    style={{ left: `${pct}%`, top: 0, bottom: 0, width: 0 }}
                                    onMouseEnter={() => setHoveredId(ms.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                    onClick={() => navigate?.('project_detail', ms.projectId, 'logs')}
                                >
                                    {/* 连接竖线 */}
                                    <div
                                        className={`absolute left-0 ${tone.line} opacity-60 shadow-sm`}
                                        style={{
                                            top: isAbove ? dotY + DOT_SIZE / 2 : trackY,
                                            height: verticalOffset,
                                            width: 1.5,
                                            transform: 'translateX(-0.75px)',
                                        }}
                                    />

                                    {/* 圆点 */}
                                    <div
                                        className={`absolute rounded-full border-[2px] border-white shadow-md transition-all duration-300 cursor-pointer ${isHovered ? 'scale-[1.5] z-50' : 'scale-100 z-20'} ${isActive ? 'animate-pulse' : ''}`}
                                        style={{
                                            width: DOT_SIZE,
                                            height: DOT_SIZE,
                                            top: dotY,
                                            left: -DOT_SIZE / 2,
                                            backgroundColor: past && ms.status === 'pending' ? '#f59e0b' : tone.fill,
                                            boxShadow: isHovered ? tone.glow : '0 2px 4px rgba(0,0,0,0.1)',
                                        }}
                                    />

                                    {/* 标签卡片 */}
                                    <div
                                        className={`absolute transition-all duration-250 ${isHovered ? 'z-50' : 'z-10'}`}
                                        style={{
                                            ...(isAbove ? { bottom: dynamicHeight - dotY + 4 } : { top: dotY + DOT_SIZE + 4 }),
                                            ...labelAnchorStyle,
                                        }}
                                    >
                                        <div
                                            className={`flex flex-col items-start gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all duration-300 backdrop-blur-md whitespace-nowrap min-w-[100px] ${isHovered
                                                ? (isLight ? 'bg-slate-900 border-slate-700 text-white shadow-2xl translate-y-[-2px]' : 'bg-white border-slate-200 text-slate-800 shadow-2xl translate-y-[-2px]')
                                                : (isLight ? 'bg-white/85 border-slate-100/50 shadow-sm' : 'bg-slate-800/80 border-white/5')
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 w-full">
                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ms.projectColor }} />
                                                <span className={`text-[10px] font-black tracking-tight truncate max-w-[120px] ${isHovered ? '' : (isLight ? 'text-slate-700' : 'text-slate-100')}`}>
                                                    {ms.title}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between w-full gap-3">
                                                <span className={`text-[8.5px] font-bold ${past && ms.status !== 'completed' ? 'text-amber-500' : isHovered ? 'text-slate-400' : (isLight ? 'text-slate-400' : 'text-slate-500')}`}>
                                                    {past && ms.status !== 'completed' && ms.status !== 'failed' ? '⚠ ' : ''}{formatDate(ms.dueDate)}
                                                </span>
                                                {isHovered && (
                                                    <span className="text-[8px] font-black uppercase tracking-wider opacity-80" style={{ color: tone.soft }}>
                                                        {sc.label}
                                                    </span>
                                                )}
                                            </div>
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
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-wide">{t('dashboardWidgets.overdueCount', { count: String(overdueCount) })}</span>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default MilestoneTimeline;
