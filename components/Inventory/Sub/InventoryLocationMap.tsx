import React, { useMemo, useState } from 'react';
import { InventoryItem } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';
import LaTeXText from '../../Common/LaTeXText';
import { CompatibilityChecker } from './InventoryAIPanel';

interface InventoryLocationMapProps {
    items: InventoryItem[];
    onEdit: (item: InventoryItem) => void;
}

// Location color palette (deterministic based on location string)
const LOCATION_COLORS = [
    { bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-600', text: 'text-indigo-700', icon: 'text-indigo-500' },
    { bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-600', text: 'text-emerald-700', icon: 'text-emerald-500' },
    { bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-600', text: 'text-amber-700', icon: 'text-amber-500' },
    { bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-600', text: 'text-rose-700', icon: 'text-rose-500' },
    { bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-600', text: 'text-violet-700', icon: 'text-violet-500' },
    { bg: 'bg-cyan-50', border: 'border-cyan-200', headerBg: 'bg-cyan-600', text: 'text-cyan-700', icon: 'text-cyan-500' },
    { bg: 'bg-orange-50', border: 'border-orange-200', headerBg: 'bg-orange-600', text: 'text-orange-700', icon: 'text-orange-500' },
    { bg: 'bg-sky-50', border: 'border-sky-200', headerBg: 'bg-sky-600', text: 'text-sky-700', icon: 'text-sky-500' },
];

export const InventoryLocationMap: React.FC<InventoryLocationMapProps> = React.memo(({ items, onEdit }) => {
    const { t } = useTranslation();
    const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
    const [allExpanded, setAllExpanded] = useState(false);

    // Group items by location
    const locationGroups = useMemo(() => {
        const groups = new Map<string, InventoryItem[]>();
        for (const item of items) {
            const loc = (item.location || '').trim() || t('inventory.mapView.unassigned');
            if (!groups.has(loc)) groups.set(loc, []);
            groups.get(loc)!.push(item);
        }
        // Sort by item count descending
        return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
    }, [items, t]);

    const toggleLocation = (loc: string) => {
        setExpandedLocations(prev => {
            const next = new Set(prev);
            if (next.has(loc)) next.delete(loc); else next.add(loc);
            return next;
        });
    };

    const toggleAll = () => {
        if (allExpanded) {
            setExpandedLocations(new Set());
        } else {
            setExpandedLocations(new Set(locationGroups.map(([loc]) => loc)));
        }
        setAllExpanded(!allExpanded);
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'Hardware': return 'fa-microscope';
            case 'Chemical': return 'fa-flask';
            case 'Precursor': return 'fa-flask-vial';
            case 'Consumable': return 'fa-box';
            default: return 'fa-atom';
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                        <i className="fa-solid fa-map-location-dot text-lg" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase italic leading-none">{t('inventory.mapView.title')}</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('inventory.mapView.subtitle')}</p>
                    </div>
                </div>
                <button
                    onClick={toggleAll}
                    className="px-4 py-2 rounded-xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
                >
                    <i className={`fa-solid ${allExpanded ? 'fa-compress' : 'fa-expand'} mr-1.5`} />
                    {allExpanded ? t('inventory.mapView.collapseAll') : t('inventory.mapView.expandAll')}
                </button>
            </div>

            {/* Location Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {locationGroups.map(([location, locationItems], idx) => {
                    const color = LOCATION_COLORS[idx % LOCATION_COLORS.length];
                    const isExpanded = expandedLocations.has(location);
                    const isUnassigned = location === t('inventory.mapView.unassigned');
                    const lowCount = locationItems.filter(i => i.category !== 'Hardware' && i.quantity <= i.threshold && i.status !== 'Purchasing').length;

                    return (
                        <div
                            key={location}
                            className={`rounded-2xl border overflow-hidden transition-all shadow-sm hover:shadow-md ${isUnassigned ? 'border-slate-200 bg-slate-50/50' : `${color.border} ${color.bg}`}`}
                        >
                            {/* Location Header */}
                            <button
                                onClick={() => toggleLocation(location)}
                                className={`w-full flex items-center justify-between px-4 py-3 transition-all ${isExpanded ? `${color.headerBg} text-white` : 'hover:bg-white/50'}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <i className={`fa-solid ${isUnassigned ? 'fa-question-circle' : 'fa-location-dot'} text-sm ${isExpanded ? 'text-white/80' : color.icon}`} />
                                    <span className={`text-[12px] font-black uppercase italic ${isExpanded ? 'text-white' : 'text-slate-700'}`}>
                                        {location}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {lowCount > 0 && (
                                        <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-full">
                                            {lowCount} <i className="fa-solid fa-triangle-exclamation text-[7px]" />
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-black ${isExpanded ? 'text-white/70' : 'text-slate-400'}`}>
                                        {t('inventory.mapView.itemsCount', { count: locationItems.length })}
                                    </span>
                                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[10px] ${isExpanded ? 'text-white/60' : 'text-slate-300'}`} />
                                </div>
                            </button>

                            {/* Expanded Items */}
                            {isExpanded && (
                                <div className="p-3 space-y-1.5 animate-reveal">
                                    {locationItems.map(item => {
                                        const isLow = item.category !== 'Hardware' && item.quantity <= item.threshold && item.status !== 'Purchasing';
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => onEdit(item)}
                                                className="flex items-center gap-2.5 px-3 py-2 bg-white/80 rounded-xl hover:bg-white transition-all cursor-pointer group border border-transparent hover:border-indigo-200 hover:shadow-sm"
                                            >
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] ${item.category === 'Hardware' ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400'}`}>
                                                    <i className={`fa-solid ${getCategoryIcon(item.category)}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[11px] font-black text-slate-700 truncate block leading-none">
                                                        <LaTeXText text={item.name} />
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`text-[12px] font-black ${isLow ? 'text-rose-500' : 'text-slate-700'}`} style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                        {typeof item.quantity === 'number' ? Number(item.quantity.toFixed(4)) : item.quantity}
                                                    </span>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">{item.unit}</span>
                                                    {isLow && <i className="fa-solid fa-triangle-exclamation text-rose-400 text-[8px]" />}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* AI Compatibility Check — only for locations with 2+ chemicals */}
                                    {(() => {
                                        const chemItems = locationItems.filter(i => i.category !== 'Hardware');
                                        if (chemItems.length >= 2) {
                                            return (
                                                <div className="mt-3 pt-3 border-t border-dashed border-slate-200">
                                                    <CompatibilityChecker items={chemItems} location={location} />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {locationGroups.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-3">
                    <i className="fa-solid fa-map text-5xl opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">{t('inventory.messages.noMatches')}</p>
                </div>
            )}
        </div>
    );
});

InventoryLocationMap.displayName = 'InventoryLocationMap';
