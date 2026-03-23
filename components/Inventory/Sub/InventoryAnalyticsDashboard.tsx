import React, { useMemo } from 'react';
import { InventoryItem, InventoryCategory, SafetyLevel } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';

interface InventoryAnalyticsDashboardProps {
    items: InventoryItem[];
}

const CATEGORY_COLORS: Record<InventoryCategory, { bg: string; ring: string; text: string }> = {
    Chemical: { bg: 'bg-blue-500', ring: 'ring-blue-100', text: 'text-blue-600' },
    Precursor: { bg: 'bg-violet-500', ring: 'ring-violet-100', text: 'text-violet-600' },
    Hardware: { bg: 'bg-indigo-500', ring: 'ring-indigo-100', text: 'text-indigo-600' },
    Consumable: { bg: 'bg-emerald-500', ring: 'ring-emerald-100', text: 'text-emerald-600' },
};

const SAFETY_COLORS: Record<string, string> = {
    Safe: 'bg-emerald-500', Corrosive: 'bg-amber-500', Flammable: 'bg-orange-500',
    Toxic: 'bg-rose-500', Explosive: 'bg-red-600', General: 'bg-slate-400',
    Precision: 'bg-indigo-400', Hazardous: 'bg-rose-400', Restricted: 'bg-violet-500',
};

export const InventoryAnalyticsDashboard: React.FC<InventoryAnalyticsDashboardProps> = React.memo(({ items }) => {
    const { t } = useTranslation();

    // Remove purchasing items for analytics
    const stockItems = useMemo(() => items.filter(i => i.status !== 'Purchasing'), [items]);

    // Core stats
    const stats = useMemo(() => {
        const totalAssets = stockItems.length;
        const totalValue = stockItems.reduce((sum, i) => sum + (i.unitPrice || 0) * (i.quantity || 0), 0);
        const now = new Date();
        const expiringItems = stockItems.filter(i => {
            if (!i.expiryDate) return false;
            const diff = new Date(i.expiryDate).getTime() - now.getTime();
            return diff > 0 && diff <= 30 * 86400000;
        }).length;
        const lowStockItems = stockItems.filter(i => i.category !== 'Hardware' && i.quantity <= i.threshold).length;
        return { totalAssets, totalValue, expiringItems, lowStockItems };
    }, [stockItems]);

    // Category breakdown
    const categoryBreakdown = useMemo(() => {
        const counts: Record<InventoryCategory, number> = { Chemical: 0, Precursor: 0, Hardware: 0, Consumable: 0 };
        for (const item of stockItems) counts[item.category]++;
        const total = stockItems.length || 1;
        return Object.entries(counts).map(([cat, count]) => ({
            category: cat as InventoryCategory,
            count,
            percentage: Math.round((count / total) * 100),
        }));
    }, [stockItems]);

    // Safety distribution
    const safetyDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of stockItems) {
            counts[item.safetyLevel] = (counts[item.safetyLevel] || 0) + 1;
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [stockItems]);

    // Stock health
    const stockHealth = useMemo(() => {
        let healthy = 0, warning = 0, critical = 0;
        for (const item of stockItems) {
            if (item.category === 'Hardware') { healthy++; continue; }
            const ratio = item.threshold > 0 ? item.quantity / item.threshold : 10;
            if (ratio > 2) healthy++;
            else if (ratio > 1) warning++;
            else critical++;
        }
        const total = healthy + warning + critical || 1;
        return { healthy, warning, critical, total, hPct: (healthy / total) * 100, wPct: (warning / total) * 100, cPct: (critical / total) * 100 };
    }, [stockItems]);

    // Top consumed items (by usageLog length or totalConsumed)
    const topConsumed = useMemo(() => {
        return stockItems
            .filter(i => (i.usageLog && i.usageLog.length > 0) || (i.totalConsumed && i.totalConsumed > 0))
            .sort((a, b) => (b.totalConsumed || 0) - (a.totalConsumed || 0))
            .slice(0, 8);
    }, [stockItems]);

    // Location density
    const locationDensity = useMemo(() => {
        const map = new Map<string, number>();
        for (const item of stockItems) {
            const loc = (item.location || '').trim() || 'N/A';
            map.set(loc, (map.get(loc) || 0) + 1);
        }
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    }, [stockItems]);

    const maxLoc = locationDensity.length > 0 ? locationDensity[0][1] : 1;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg">
                    <i className="fa-solid fa-chart-pie text-lg" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase italic leading-none">{t('inventory.analyticsView.title')}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('inventory.analyticsView.subtitle')}</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: t('inventory.analyticsView.totalAssets'), value: stats.totalAssets, icon: 'fa-box-archive', color: 'from-indigo-500 to-indigo-600', textColor: 'text-indigo-100' },
                    { label: t('inventory.analyticsView.totalValue'), value: stats.totalValue > 0 ? `¥${(stats.totalValue / 1000).toFixed(1)}k` : '—', icon: 'fa-coins', color: 'from-emerald-500 to-emerald-600', textColor: 'text-emerald-100' },
                    { label: t('inventory.analyticsView.expiringItems'), value: stats.expiringItems, icon: 'fa-clock', color: stats.expiringItems > 0 ? 'from-orange-500 to-orange-600' : 'from-slate-400 to-slate-500', textColor: stats.expiringItems > 0 ? 'text-orange-100' : 'text-slate-200' },
                    { label: t('inventory.analyticsView.lowStockItems'), value: stats.lowStockItems, icon: 'fa-triangle-exclamation', color: stats.lowStockItems > 0 ? 'from-rose-500 to-rose-600' : 'from-slate-400 to-slate-500', textColor: stats.lowStockItems > 0 ? 'text-rose-100' : 'text-slate-200' },
                ].map(kpi => (
                    <div key={kpi.label} className={`bg-gradient-to-br ${kpi.color} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden`}>
                        <div className="absolute top-3 right-3 opacity-10">
                            <i className={`fa-solid ${kpi.icon} text-5xl`} />
                        </div>
                        <p className={`text-[9px] font-black uppercase tracking-widest ${kpi.textColor}`}>{kpi.label}</p>
                        <p className="text-3xl font-black mt-2 leading-none" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                            {kpi.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Category Breakdown */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('inventory.analyticsView.categoryBreakdown')}</h4>
                    <div className="space-y-3">
                        {categoryBreakdown.map(({ category, count, percentage }) => {
                            const c = CATEGORY_COLORS[category];
                            return (
                                <div key={category} className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${c.bg}`} />
                                    <span className="text-[11px] font-bold text-slate-600 flex-1">{t(`inventory.categories.${category}` as any)}</span>
                                    <span className="text-[12px] font-black text-slate-800 w-8 text-right">{count}</span>
                                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${c.bg} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 w-10 text-right">{percentage}%</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Safety Distribution */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('inventory.analyticsView.safetyDistribution')}</h4>
                    <div className="space-y-2.5">
                        {safetyDistribution.map(([level, count]) => {
                            const bgColor = SAFETY_COLORS[level] || 'bg-slate-400';
                            const total = stockItems.length || 1;
                            const pct = Math.round((count / total) * 100);
                            return (
                                <div key={level} className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${bgColor}`} />
                                    <span className="text-[10px] font-bold text-slate-600 flex-1">{t(`inventory.safetyLevels.${level}` as any)}</span>
                                    <span className="text-[11px] font-black text-slate-800 w-6 text-right">{count}</span>
                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${bgColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Stock Health */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('inventory.analyticsView.stockHealthOverview')}</h4>

                    {/* Stacked bar */}
                    <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex mb-4">
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${stockHealth.hPct}%` }} />
                        <div className="bg-amber-500 h-full transition-all" style={{ width: `${stockHealth.wPct}%` }} />
                        <div className="bg-rose-500 h-full transition-all" style={{ width: `${stockHealth.cPct}%` }} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: t('inventory.analyticsView.healthy'), count: stockHealth.healthy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: t('inventory.analyticsView.warning'), count: stockHealth.warning, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: t('inventory.analyticsView.critical'), count: stockHealth.critical, color: 'text-rose-600', bg: 'bg-rose-50' },
                        ].map(s => (
                            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                                <p className={`text-lg font-black ${s.color}`}>{s.count}</p>
                                <p className={`text-[8px] font-black uppercase tracking-widest ${s.color} opacity-60`}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Consumed */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('inventory.analyticsView.topConsumed')}</h4>
                    {topConsumed.length > 0 ? (
                        <div className="space-y-2">
                            {topConsumed.map((item, idx) => {
                                const consumed = item.totalConsumed || (item.usageLog?.reduce((s, u) => s + u.amount, 0) || 0);
                                const maxConsumed = topConsumed[0]?.totalConsumed || consumed || 1;
                                const pct = Math.round((consumed / maxConsumed) * 100);
                                return (
                                    <div key={item.id} className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-300 w-4 text-right">#{idx + 1}</span>
                                        <span className="text-[11px] font-bold text-slate-700 flex-1 truncate">{item.name}</span>
                                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[10px] font-black text-indigo-600 w-16 text-right">
                                            {consumed.toFixed(1)} {item.unit}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-8 text-center">
                            <i className="fa-solid fa-chart-simple text-3xl text-slate-200 mb-2" />
                            <p className="text-[10px] font-bold text-slate-300 italic">{t('inventory.analyticsView.noConsumptionData')}</p>
                        </div>
                    )}
                </div>

                {/* Location Density */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('inventory.analyticsView.locationDensity')}</h4>
                    <div className="space-y-2">
                        {locationDensity.map(([loc, count]) => {
                            const pct = Math.round((count / maxLoc) * 100);
                            return (
                                <div key={loc} className="flex items-center gap-3">
                                    <i className="fa-solid fa-location-dot text-[9px] text-blue-400 shrink-0" />
                                    <span className="text-[11px] font-bold text-slate-600 flex-1 truncate">{loc}</span>
                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-700 w-6 text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
});

InventoryAnalyticsDashboard.displayName = 'InventoryAnalyticsDashboard';
