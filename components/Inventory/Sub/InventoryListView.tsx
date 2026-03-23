import React from 'react';
import { InventoryItem, SafetyLevel } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';
import LaTeXText from '../../Common/LaTeXText';

interface InventoryListViewProps {
    items: InventoryItem[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
}

const getSafetyColor = (level: SafetyLevel) => {
    switch (level) {
        case 'Safe': return 'bg-emerald-50 text-emerald-600';
        case 'Corrosive': return 'bg-amber-50 text-amber-600';
        case 'Flammable': return 'bg-orange-50 text-orange-600';
        case 'Toxic': return 'bg-rose-50 text-rose-600';
        case 'Explosive': return 'bg-red-50 text-red-600';
        case 'General': return 'bg-slate-50 text-slate-600';
        case 'Precision': return 'bg-indigo-50 text-indigo-600';
        case 'Hazardous': return 'bg-rose-50 text-rose-600';
        case 'Restricted': return 'bg-violet-50 text-violet-600';
        default: return 'bg-slate-50 text-slate-600';
    }
};

const getStatusColor = (status?: string) => {
    switch (status) {
        case 'Ready': return 'text-emerald-600';
        case 'In Use': return 'text-amber-600';
        case 'Maintenance': return 'text-indigo-600';
        case 'Calibration Required': return 'text-rose-600';
        case 'Purchasing': return 'text-amber-500';
        default: return 'text-slate-500';
    }
};

const getExpiryInfo = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const exp = new Date(expiryDate);
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'EXPIRED', color: 'text-white bg-rose-500', days: diffDays };
    if (diffDays === 0) return { label: 'TODAY', color: 'text-white bg-orange-500', days: 0 };
    if (diffDays <= 30) return { label: `${diffDays}d`, color: 'text-orange-700 bg-orange-50', days: diffDays };
    if (diffDays <= 90) return { label: `${diffDays}d`, color: 'text-amber-700 bg-amber-50', days: diffDays };
    return { label: `${diffDays}d`, color: 'text-slate-500 bg-slate-50', days: diffDays };
};

export const InventoryListView: React.FC<InventoryListViewProps> = React.memo(({
    items, selectedIds, onToggleSelect, onEdit, onDelete
}) => {
    const { t } = useTranslation();

    const safetyLabelMap: Record<SafetyLevel, string> = {
        'Safe': t('inventory.safetyLevels.Safe'),
        'Corrosive': t('inventory.safetyLevels.Corrosive'),
        'Flammable': t('inventory.safetyLevels.Flammable'),
        'Toxic': t('inventory.safetyLevels.Toxic'),
        'Explosive': t('inventory.safetyLevels.Explosive'),
        'General': t('inventory.safetyLevels.General'),
        'Precision': t('inventory.safetyLevels.Precision'),
        'Hazardous': t('inventory.safetyLevels.Hazardous'),
        'Restricted': t('inventory.safetyLevels.Restricted'),
    };

    const statusLabelMap: Record<string, string> = {
        'Ready': t('inventory.statuses.Ready'),
        'In Use': t('inventory.statuses.In Use'),
        'Maintenance': t('inventory.statuses.Maintenance'),
        'Calibration Required': t('inventory.statuses.Calibration Required'),
        'Purchasing': t('inventory.statuses.Purchasing'),
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[40px_2fr_1fr_1fr_1.5fr_1fr_1fr_1fr_1fr_80px] gap-2 px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <div className="flex items-center justify-center">
                    <div className="w-4 h-4 rounded border border-slate-200" />
                </div>
                <div>{t('inventory.listView.name')}</div>
                <div>{t('inventory.listView.category')}</div>
                <div className="text-right">{t('inventory.listView.quantity')}</div>
                <div>{t('inventory.listView.location')}</div>
                <div>{t('inventory.listView.safety')}</div>
                <div>{t('inventory.listView.status')}</div>
                <div>{t('inventory.listView.expiry')}</div>
                <div>{t('inventory.listView.updated')}</div>
                <div className="text-center">{t('inventory.listView.actions')}</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-slate-50">
                {items.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    const isLow = item.category !== 'Hardware' && item.quantity <= item.threshold && item.status !== 'Purchasing';
                    const expiryInfo = getExpiryInfo(item.expiryDate);

                    return (
                        <div
                            key={item.id}
                            className={`grid grid-cols-[40px_2fr_1fr_1fr_1.5fr_1fr_1fr_1fr_1fr_80px] gap-2 px-4 py-2.5 items-center hover:bg-indigo-50/30 transition-colors group cursor-pointer ${isSelected ? 'bg-indigo-50/50' : ''}`}
                            onClick={() => onEdit(item)}
                        >
                            {/* Checkbox */}
                            <div className="flex items-center justify-center" onClick={e => { e.stopPropagation(); onToggleSelect(item.id); }}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}`}>
                                    {isSelected && <i className="fa-solid fa-check text-white text-[8px]" />}
                                </div>
                            </div>

                            {/* Name */}
                            <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] shrink-0 ${item.category === 'Hardware' ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400'}`}>
                                    <i className={`fa-solid ${item.category === 'Hardware' ? 'fa-microscope' : item.category === 'Chemical' ? 'fa-flask' : 'fa-atom'}`} />
                                </div>
                                <div className="truncate">
                                    <span className="text-[12px] font-black text-slate-800 leading-none">
                                        <LaTeXText text={item.name} />
                                    </span>
                                    {item.formula && (
                                        <span className="block text-[10px] font-bold text-slate-400 truncate" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            <LaTeXText text={item.formula} />
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <span className="text-[10px] font-black text-slate-500 uppercase">
                                    {t(`inventory.categories.${item.category}` as any)}
                                </span>
                            </div>

                            {/* Quantity */}
                            <div className="text-right">
                                <span className={`text-[13px] font-black ${isLow ? 'text-rose-500' : 'text-slate-800'}`} style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    {typeof item.quantity === 'number' ? Number(item.quantity.toFixed(10)) : item.quantity ?? '0'}
                                </span>
                                <span className={`text-[9px] font-black uppercase ml-1 ${isLow ? 'text-rose-400' : 'text-slate-400'}`}>
                                    {item.unit}
                                </span>
                                {isLow && <i className="fa-solid fa-triangle-exclamation text-rose-400 text-[8px] ml-1" />}
                            </div>

                            {/* Location */}
                            <div className="truncate">
                                <span className="text-[10px] font-bold text-blue-700 italic">
                                    <i className="fa-solid fa-location-dot text-[8px] mr-1" />
                                    {item.location || 'N/A'}
                                </span>
                            </div>

                            {/* Safety */}
                            <div>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getSafetyColor(item.safetyLevel)}`}>
                                    {safetyLabelMap[item.safetyLevel]}
                                </span>
                            </div>

                            {/* Status */}
                            <div>
                                <span className={`text-[10px] font-black uppercase ${getStatusColor(item.status)}`}>
                                    {statusLabelMap[item.status || 'Ready']}
                                </span>
                            </div>

                            {/* Expiry */}
                            <div>
                                {expiryInfo ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${expiryInfo.color}`}>
                                        {expiryInfo.label}
                                    </span>
                                ) : (
                                    <span className="text-[9px] text-slate-300 italic">—</span>
                                )}
                            </div>

                            {/* Updated */}
                            <div>
                                <span className="text-[10px] font-bold text-slate-400">{item.lastUpdated}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={e => { e.stopPropagation(); onEdit(item); }}
                                    className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
                                >
                                    <i className="fa-solid fa-pen text-[9px]" />
                                </button>
                                <button
                                    onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                                    className="w-6 h-6 rounded-md bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                                >
                                    <i className="fa-solid fa-trash-can text-[9px]" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {items.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-3">
                    <i className="fa-solid fa-table text-4xl opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest italic">{t('inventory.messages.noMatches')}</p>
                </div>
            )}
        </div>
    );
});

InventoryListView.displayName = 'InventoryListView';
