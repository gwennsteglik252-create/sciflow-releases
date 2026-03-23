// ═══ Trend Radar Utility Functions ═══

export const getCategoryColor = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('tech')) return 'bg-indigo-600 text-white border-indigo-400';
    if (c.includes('market')) return 'bg-emerald-600 text-white border-emerald-400';
    if (c.includes('policy')) return 'bg-rose-600 text-white border-rose-400';
    if (c.includes('competitor') || c.includes('comp')) return 'bg-amber-600 text-white border-amber-400';
    return 'bg-slate-600 text-white border-slate-400';
};

export const getCategoryGradient = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('tech')) return 'linear-gradient(135deg, #4f46e5, #7c3aed)';
    if (c.includes('market')) return 'linear-gradient(135deg, #059669, #34d399)';
    if (c.includes('policy')) return 'linear-gradient(135deg, #e11d48, #fb7185)';
    if (c.includes('competitor') || c.includes('comp')) return 'linear-gradient(135deg, #d97706, #fbbf24)';
    return 'linear-gradient(135deg, #475569, #94a3b8)';
};

export const getCategoryDotColor = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('tech')) return 'bg-indigo-400';
    if (c.includes('market')) return 'bg-emerald-400';
    if (c.includes('policy')) return 'bg-rose-400';
    if (c.includes('competitor') || c.includes('comp')) return 'bg-amber-400';
    return 'bg-slate-400';
};

export const getCategoryIcon = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('tech')) return 'fa-microchip';
    if (c.includes('market')) return 'fa-chart-line';
    if (c.includes('policy')) return 'fa-gavel';
    if (c.includes('competitor') || c.includes('comp')) return 'fa-chess';
    return 'fa-globe';
};

export const getCategoryLabel = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c === 'all') return '全部动态';
    if (c.includes('tech')) return '技术前沿';
    if (c.includes('market')) return '市场分析';
    if (c.includes('policy')) return '政策法规';
    if (c.includes('competitor') || c.includes('comp')) return '竞争动态';
    return cat;
};
