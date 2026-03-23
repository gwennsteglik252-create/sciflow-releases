import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../locales/useTranslation';

interface QuickNavigationProps {
    history: { path: string; label: string; count: number; isPinned: boolean }[];
    isLightMode: boolean;
    dwellProgress: number;
    togglePin: (path: string) => void;
}

const QuickNavigation: React.FC<QuickNavigationProps> = ({ history, isLightMode, dwellProgress, togglePin }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const progressCircleRef = useRef<SVGCircleElement>(null);

    useEffect(() => {
        const handleToggle = () => setIsOpen(prev => !prev);
        window.addEventListener('toggle-quick-nav', handleToggle);
        return () => window.removeEventListener('toggle-quick-nav', handleToggle);
    }, []);

    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const isCompleted = dwellProgress >= 100;

    useEffect(() => {
        let rafId: number;
        let startTime: number | null = null;
        const duration = 10000; 

        const onHashChange = () => {
            startTime = Date.now();
        };

        const animate = () => {
            const circle = progressCircleRef.current;
            if (circle && startTime !== null) {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / duration) * 100, 100);
                const offset = circumference - (progress / 100) * circumference;
                circle.style.strokeDashoffset = `${offset}`;
                const svg = circle.closest('svg');
                if (svg) {
                    svg.style.display = progress > 0 && progress < 100 ? '' : 'none';
                }
            }
            rafId = requestAnimationFrame(animate);
        };

        window.addEventListener('hashchange', onHashChange);
        startTime = Date.now();
        rafId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('hashchange', onHashChange);
        };
    }, [circumference]);

    const recentHistory = [...(history.length > 1 ? history.slice(1, 10) : [])]
        .sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return 0;
        })
        .slice(0, 6);

    const allPastHistory = history.length > 1 ? history.slice(1) : [];
    const sortedByCount = [...allPastHistory].sort((a, b) => (b.count || 0) - (a.count || 0));
    const trendingPaths = sortedByCount.slice(0, 2).filter(h => (h.count || 0) > 1).map(h => h.path);

    const getPageContext = (path: string) => {
        const p = path.replace('#', '');
        const segments = p.split('/');
        if (segments[0] === 'dashboard') return { icon: 'fa-table-columns', color: 'indigo' };
        if (segments[0] === 'projects') return { icon: 'fa-folder-tree', color: 'purple' };
        if (segments[0] === 'project') return { icon: 'fa-microscope', color: 'rose' };
        if (segments[0] === 'literature') return { icon: 'fa-book-open-reader', color: 'blue' };
        if (segments[0] === 'mechanism') return { icon: 'fa-gears', color: 'emerald' };
        if (segments[0] === 'writing') return { icon: 'fa-pen-nib', color: 'amber' };
        if (segments[0] === 'team') return { icon: 'fa-users-viewfinder', color: 'cyan' };
        if (segments[0] === 'data') return { icon: 'fa-chart-pie', color: 'teal' };
        if (segments[0] === 'figure_center') {
            const sub = segments[1];
            if (sub === 'sankey') return { icon: 'fa-bars-staggered', color: 'cyan' };
            if (sub === 'structural') return { icon: 'fa-diagram-project', color: 'purple' };
            if (sub === 'timeline') return { icon: 'fa-timeline', color: 'amber' };
            if (sub === 'tree') return { icon: 'fa-sitemap', color: 'teal' };
            if (sub === 'summary') return { icon: 'fa-newspaper', color: 'rose' };
            if (sub === 'audit') return { icon: 'fa-clipboard-check', color: 'rose' };
            if (sub === 'assembly') return { icon: 'fa-layer-group', color: 'indigo' };
            return { icon: 'fa-palette', color: 'amber' };
        }
        if (segments[0] === 'flowchart') return { icon: 'fa-bezier-curve', color: 'cyan' };
        if (segments[0] === 'doe') return { icon: 'fa-puzzle-piece', color: 'amber' };
        if (segments[0] === 'inventory') return { icon: 'fa-box-archive', color: 'emerald' };
        if (segments[0] === 'video_lab') return { icon: 'fa-film', color: 'rose' };
        if (segments[0] === 'inception') return { icon: 'fa-compass', color: 'emerald' };
        if (segments[0] === 'industry_trends') return { icon: 'fa-tower-broadcast', color: 'rose' };
        if (segments[0] === 'market_analysis') return { icon: 'fa-chart-pie', color: 'teal' };
        if (segments[0] === 'characterization_hub') return { icon: 'fa-microscope', color: 'rose' };
        if (segments[0] === 'research_brain') return { icon: 'fa-brain', color: 'purple' };
        return { icon: 'fa-arrow-turn-up', color: 'slate' };
    };

    const colorClasses: Record<string, string> = {
        indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
        purple: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
        rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
        teal: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
        slate: 'text-slate-500 bg-slate-500/10 border-slate-500/20',
    };

    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 300); 
    };

    return (
        <div className="relative flex flex-col items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {isOpen && (
                <div className="absolute bottom-full left-1 pb-3 z-[9999]">
                    <div className={`p-2 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/20 animate-reveal min-w-[180px] flex flex-col gap-1 ${isLightMode ? 'bg-white/90 shadow-indigo-500/10' : 'bg-slate-800/90 border-slate-700 shadow-black/50'}`}>
                        <div className="px-3 py-1.5 flex items-center justify-between border-b border-indigo-500/10 mb-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-indigo-600' : 'text-indigo-400'}`}>
                                <i className="fa-solid fa-clock-rotate-left mr-1"></i> {t('quickNav.title')}
                            </span>
                        </div>
                        {recentHistory.length > 0 ? (
                            recentHistory.map((item, idx) => {
                                const ctx = getPageContext(item.path);
                                const isTrending = trendingPaths.includes(item.path);

                                return (
                                    <a
                                        key={`${item.path}-${idx}`}
                                        href={item.path}
                                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all group ${isLightMode ? 'hover:bg-indigo-50 text-slate-700' : 'hover:bg-slate-700 text-slate-300'}`}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all group-hover:scale-110 shadow-sm ${colorClasses[ctx.color]} ${!isLightMode && 'bg-opacity-20'} ${isTrending ? 'ring-1 ring-amber-400/50' : ''}`}>
                                            <i className={`fa-solid ${ctx.icon} ${ctx.icon === 'fa-arrow-turn-up' ? '-scale-x-100' : ''} text-[9px]`}></i>
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-bold truncate group-hover:text-indigo-500 transition-colors">
                                                    {item.label.includes(' · ') ? item.label.split(' · ')[0] : item.label}
                                                </span>
                                                {isTrending && (
                                                    <i className="fa-solid fa-sparkles text-[8px] text-amber-500 animate-pulse"></i>
                                                )}
                                            </div>
                                            {item.label.includes(' · ') && (
                                                <span className={`text-[9px] font-bold truncate leading-tight ${isLightMode ? 'text-indigo-400' : 'text-indigo-300'}`}>
                                                    {item.label.split(' · ')[1]}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                togglePin(item.path);
                                            }}
                                            className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-90 ${item.isPinned
                                                ? 'text-amber-500 opacity-100'
                                                : 'text-slate-400 opacity-0 group-hover:opacity-40 hover:text-indigo-400'
                                                }`}
                                            title={item.isPinned ? t('quickNav.unpin') : t('quickNav.pin')}
                                        >
                                            <i className={`fa-solid fa-thumbtack text-[10px] transition-transform ${item.isPinned ? 'rotate-45' : ''}`}></i>
                                        </button>
                                    </a>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-center">
                                <i className="fa-solid fa-hourglass-empty text-slate-400 text-xs mb-2 block opacity-50"></i>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{t('quickNav.noRecords')}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-95 group ${recentHistory.length === 0 && !isCompleted ? 'opacity-20' : 'opacity-40 hover:opacity-100'
                    }`}
                onClick={() => setIsOpen(!isOpen)}
                title={t('quickNav.title')}
            >
                <div className={`flex items-center justify-center w-full h-full rounded-lg border backdrop-blur-md transition-all shadow-lg ${isLightMode
                    ? 'bg-amber-50 border-amber-200 text-amber-600 hover:text-white hover:bg-amber-500'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:text-white hover:bg-amber-600'
                    } ${isCompleted && (isLightMode ? 'text-amber-600 border-amber-500' : 'text-amber-400 border-amber-500/50')}`}>
                    <i className={`fa-solid fa-clock-rotate-left text-xs transition-transform duration-300 ${isOpen ? '-rotate-90 text-amber-600' : 'group-hover:-rotate-90'}`}></i>
                </div>

                {!isCompleted && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10" style={{ display: 'none' }}>
                        <circle
                            cx="18"
                            cy="18"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={isLightMode ? 'text-amber-500/10' : 'text-amber-400/5'}
                        />
                        <circle
                            ref={progressCircleRef}
                            cx="18"
                            cy="18"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference}
                            strokeLinecap="round"
                            className={isLightMode ? 'text-amber-500' : 'text-amber-400'}
                        />
                    </svg>
                )}

                {isCompleted && (
                    <div className="absolute inset-0 rounded-lg animate-pulse ring-2 ring-amber-500/50 pointer-events-none z-10"></div>
                )}
            </button>
        </div>
    );
};

export default QuickNavigation;
