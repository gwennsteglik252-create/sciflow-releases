import React, { useMemo } from 'react';
import { TrendItem } from '../../types';
import { getCategoryLabel, getCategoryDotColor } from './trendUtils';

interface RadarDashboardProps {
    trends: TrendItem[];
    lastScanTime?: string;
}

const RadarDashboard: React.FC<RadarDashboardProps> = ({ trends, lastScanTime }) => {
    const stats = useMemo(() => {
        const categoryMap: Record<string, { count: number; cat: string }> = {};
        let totalImpact = 0;
        const categories = ['Technology', 'Market', 'Policy', 'Competitor'];

        categories.forEach(cat => {
            categoryMap[getCategoryLabel(cat)] = { count: 0, cat };
        });

        trends.forEach(t => {
            const label = getCategoryLabel(t.category);
            if (categoryMap[label]) {
                categoryMap[label].count++;
            } else {
                categoryMap[label] = { count: 1, cat: t.category };
            }
            totalImpact += t.impactScore;
        });

        return {
            total: trends.length,
            categories: categoryMap,
            avgImpact: trends.length > 0 ? (totalImpact / trends.length).toFixed(1) : '0.0',
            highImpactCount: trends.filter(t => t.impactScore >= 4).length,
        };
    }, [trends]);

    return (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 flex items-center gap-6 relative overflow-hidden shadow-2xl shrink-0">
            {/* Animated radar pulse rings */}
            <div className="absolute -left-6 -top-6 w-28 h-28 rounded-full border border-indigo-500/10 animate-ping" style={{ animationDuration: '4s' }} />
            <div className="absolute -left-4 -top-4 w-24 h-24 rounded-full border border-indigo-400/15 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.8s' }} />
            <div className="absolute -left-2 -top-2 w-20 h-20 rounded-full border border-indigo-300/20 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '1.5s' }} />

            {/* Subtle grid lines overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }} />

            {/* Radar icon */}
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 relative z-10 backdrop-blur-sm">
                <i className="fa-solid fa-satellite-dish text-indigo-300 text-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
            </div>

            {/* Total count */}
            <div className="shrink-0 relative z-10">
                <div className="text-[8px] font-black text-indigo-300/60 uppercase tracking-[0.2em] mb-1">信号捕获</div>
                <div className="text-3xl font-black text-white tabular-nums leading-none">{stats.total}</div>
                <div className="text-[8px] font-bold text-indigo-400/50 mt-1">
                    {stats.highImpactCount > 0 && <><i className="fa-solid fa-arrow-trend-up text-amber-400 mr-1" />{stats.highImpactCount} 条高影响力</>}
                </div>
            </div>

            <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-600 to-transparent shrink-0" />

            {/* Category breakdown */}
            <div className="flex-1 flex flex-wrap gap-2.5 relative z-10">
                {Object.entries(stats.categories).map(([label, { count, cat }]) => (
                    <div key={label} className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl px-3.5 py-2 transition-all cursor-default group">
                        <div className={`w-2 h-2 rounded-full ${getCategoryDotColor(cat)} group-hover:scale-125 transition-transform`} />
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
                        <span className="text-[12px] font-black text-white tabular-nums">{count}</span>
                    </div>
                ))}
            </div>

            <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-600 to-transparent shrink-0" />

            {/* Impact & scan time */}
            <div className="shrink-0 text-right relative z-10 flex flex-col gap-2">
                <div>
                    <div className="text-[8px] font-black text-amber-300/50 uppercase tracking-[0.15em]">平均影响力</div>
                    <div className="text-xl font-black text-amber-300 flex items-center justify-end gap-1.5 leading-none mt-0.5">
                        <div className="flex items-end gap-[2px]">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-[3px] rounded-full transition-all ${i < Math.round(Number(stats.avgImpact)) ? 'bg-amber-400' : 'bg-slate-700'}`}
                                    style={{ height: `${6 + i * 2.5}px` }}
                                />
                            ))}
                        </div>
                        <span>{stats.avgImpact}</span>
                    </div>
                </div>
                {lastScanTime && (
                    <div className="text-[8px] font-mono text-slate-500">
                        <i className="fa-solid fa-clock text-[7px] mr-1" />
                        {lastScanTime}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RadarDashboard;
