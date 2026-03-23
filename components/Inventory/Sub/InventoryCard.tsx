import React, { useMemo } from 'react';
import { InventoryItem, SafetyLevel } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { useTranslation } from '../../../locales/useTranslation';
import LaTeXText from '../../Common/LaTeXText';

// ── Expiry countdown helper ──
const getExpiryBadge = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const now = new Date();
    const exp = new Date(expiryDate);
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'EXPIRED', color: 'bg-rose-500 text-white', ring: 'ring-rose-200', pulse: true, days: diffDays };
    if (diffDays === 0) return { label: 'TODAY', color: 'bg-orange-500 text-white', ring: 'ring-orange-200', pulse: true, days: 0 };
    if (diffDays <= 30) return { label: `${diffDays}d`, color: 'bg-orange-100 text-orange-700', ring: 'ring-orange-100', pulse: false, days: diffDays };
    if (diffDays <= 90) return { label: `${diffDays}d`, color: 'bg-amber-50 text-amber-600', ring: 'ring-amber-50', pulse: false, days: diffDays };
    return null; // >90 days = no badge
};

// ── Mini Sparkline SVG ──
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color?: string }> = React.memo(({ data, width = 60, height = 18, color = '#6366f1' }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = width / (data.length - 1);

    const points = data.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 2) - 1;
        return `${x},${y}`;
    }).join(' ');

    // Gradient area fill
    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <svg width={width} height={height} className="shrink-0">
            <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#sparkGrad)" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
});
Sparkline.displayName = 'Sparkline';

interface InventoryCardProps {
    item: InventoryItem;
    onEdit: (item: InventoryItem) => void;
    onDelete: (id: string) => void;
    onProcure: (item: InventoryItem) => void;
    onConvertToStock: (item: InventoryItem) => void;
    onGenerateMSDS: (item: InventoryItem) => void;
}

// Maps will be populated inside the component using t()

const getSafetyColor = (level: SafetyLevel) => {
    switch (level) {
        case 'Safe': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        case 'Corrosive': return 'bg-amber-50 text-amber-600 border-amber-100';
        case 'Flammable': return 'bg-orange-50 text-orange-600 border-orange-100';
        case 'Toxic': return 'bg-rose-50 text-rose-600 border-rose-100';
        case 'Explosive': return 'bg-red-50 text-red-600 border-red-100';
        case 'General': return 'bg-slate-50 text-slate-600 border-slate-100';
        case 'Precision': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
        case 'Hazardous': return 'bg-rose-50 text-rose-600 border-rose-100';
        case 'Restricted': return 'bg-violet-50 text-violet-600 border-violet-100';
        default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
};

const getStatusDotColor = (status: string | undefined) => {
    switch (status) {
        case 'Ready': return 'bg-emerald-500';
        case 'In Use': return 'bg-amber-500';
        case 'Maintenance': return 'bg-indigo-500';
        case 'Calibration Required': return 'bg-rose-500';
        case 'Purchasing': return 'bg-amber-400';
        default: return 'bg-slate-400';
    }
};

export const InventoryCard: React.FC<InventoryCardProps> = React.memo(({ item, onEdit, onDelete, onProcure, onConvertToStock, onGenerateMSDS }) => {
    const { t } = useTranslation();
    const { setInventory, showToast, addTaskToActivePlan } = useProjectContext();

    const safetyLevelMap: Record<SafetyLevel, string> = {
        'Safe': t('inventory.safetyLevels.Safe'),
        'Corrosive': t('inventory.safetyLevels.Corrosive'),
        'Flammable': t('inventory.safetyLevels.Flammable'),
        'Toxic': t('inventory.safetyLevels.Toxic'),
        'Explosive': t('inventory.safetyLevels.Explosive'),
        'General': t('inventory.safetyLevels.General'),
        'Precision': t('inventory.safetyLevels.Precision'),
        'Hazardous': t('inventory.safetyLevels.Hazardous'),
        'Restricted': t('inventory.safetyLevels.Restricted')
    };

    const statusMap: Record<string, string> = {
        'Ready': t('inventory.statuses.Ready'),
        'In Use': t('inventory.statuses.In Use'),
        'Maintenance': t('inventory.statuses.Maintenance'),
        'Calibration Required': t('inventory.statuses.Calibration Required'),
        'Purchasing': t('inventory.statuses.Purchasing')
    };
    const isHardware = item.category === 'Hardware';
    const isPurchasing = item.status === 'Purchasing';
    const isLow = item.category !== 'Hardware' && item.quantity <= item.threshold && !isPurchasing;
    const isInUse = item.status === 'In Use';

    const handleCycleSafety = (e: React.MouseEvent) => {
        e.stopPropagation();
        const chemicalLevels: SafetyLevel[] = ['Safe', 'Corrosive', 'Flammable', 'Toxic', 'Explosive'];
        const hardwareLevels: SafetyLevel[] = ['General', 'Precision', 'Hazardous', 'Restricted'];

        const isHardware = item.category === 'Hardware';
        const levels = isHardware ? hardwareLevels : chemicalLevels;

        const currentIdx = levels.indexOf(item.safetyLevel);
        const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % levels.length;
        const nextLevel = levels[nextIdx];

        setInventory(prev => prev.map(i => i.id === item.id ? { ...i, safetyLevel: nextLevel } : i));
        showToast({ message: t('inventory.messages.safetyUpdated', { level: safetyLevelMap[nextLevel] }), type: 'success' });
    };

    const handlePushToPlan = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!item.linkedProjectId) {
            showToast({ message: t('inventory.messages.noProjectLink'), type: 'info' });
            return;
        }

        if (item.pushedToPlan) {
            // Jump to Plan and locate task
            window.location.hash = `#project/${item.linkedProjectId}/plan_board${item.pushedTaskId ? `:${item.pushedTaskId}` : ''}`;
            return;
        }

        const taskId = addTaskToActivePlan(
            item.linkedProjectId,
            `跟进采购项目: ${item.name}`,
            {
                deadline: item.procurementDeadline,
                urgency: item.urgency,
                quantity: item.quantity,
                unit: item.unit,
                inventoryId: item.id
            }
        );

        if (taskId) {
            window.location.hash = `#project/${item.linkedProjectId}/plan_board:${taskId}`;
        }
    };

    const handleGenerateMSDS = (e: React.MouseEvent) => {
        e.stopPropagation();
        onGenerateMSDS(item);
    };

    // Sparkline data from usageLog (last 8 entries)
    const sparkData = useMemo(() => {
        if (!item.usageLog || item.usageLog.length < 2) return null;
        return item.usageLog.slice(-8).map(u => u.amount);
    }, [item.usageLog]);

    const expiryBadge = getExpiryBadge(item.expiryDate);

    return (
        <div className={`bg-white rounded-[1.2rem] border transition-all relative overflow-hidden group p-3.5 flex flex-col min-h-[185px] shadow-lg hover:shadow-2xl shadow-slate-200/50 hover:shadow-indigo-200/40 ${isHardware ? 'border-indigo-50' : 'border-slate-50'} ${isInUse ? 'ring-2 ring-amber-500/5' : ''} ${isPurchasing ? 'border-amber-200 bg-amber-50/20 shadow-md' : ''} ${isLow ? 'border-rose-200 ring-2 ring-rose-50' : 'hover:border-indigo-400'}`}>

            {/* ── Expiry Countdown Badge ── */}
            {expiryBadge && (
                <div className={`absolute top-0 right-0 px-2 py-0.5 rounded-bl-xl text-[8px] font-black uppercase shadow-sm z-10 ring-1 ${expiryBadge.color} ${expiryBadge.ring} ${expiryBadge.pulse ? 'animate-pulse' : ''}`}>
                    <i className="fa-solid fa-clock text-[7px] mr-0.5" />
                    {expiryBadge.label}
                </div>
            )}

            {/* Top Header */}
            <div className="flex justify-between items-start mb-2.5 shrink-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm shadow-inner ${isPurchasing ? 'bg-amber-100 text-amber-600' : isHardware ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                    <i className={`fa-solid ${isPurchasing ? 'fa-shopping-cart' : isHardware ? 'fa-microscope' : item.category === 'Chemical' ? 'fa-flask' : 'fa-atom'}`}></i>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[70%]">
                    {isPurchasing && (
                        <span className="text-[10px] font-black text-white bg-amber-500 px-2 py-0.5 rounded uppercase animate-pulse">{t('inventory.card.purchasing')}</span>
                    )}
                    {isInUse && (
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-[10px] font-black text-amber-700 uppercase">{t('inventory.card.inUse')}</span>
                        </div>
                    )}
                    {!isPurchasing && (
                        <span
                            onClick={handleCycleSafety}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border shadow-xs cursor-pointer transition-all hover:scale-105 active:scale-95 ${getSafetyColor(item.safetyLevel)}`}
                        >
                            {safetyLevelMap[item.safetyLevel]}
                        </span>
                    )}
                    {isHardware && !isPurchasing && (
                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(item.status)}`}></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase">{statusMap[item.status || 'Ready']}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Section */}
            <div className="mb-3">
                <h3 className="text-[13px] font-black text-slate-900 tracking-tight italic uppercase leading-none truncate">
                    <LaTeXText text={item.name} />
                </h3>
            </div>

            {/* Stats Grid */}
            <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-2 pt-2.5 border-t border-slate-50">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                        {isHardware ? t('inventory.card.model') : t('inventory.card.casNo')}
                    </span>
                    <span className="text-[10px] font-mono font-black text-slate-700 truncate w-full uppercase">
                        {isHardware ? (item.model || 'N/A') : (item.casNo || 'N/A')}
                    </span>
                </div>
                {!isHardware && (
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            {t('inventory.card.formula')}
                        </span>
                        <div className="flex flex-col truncate w-full">
                            <span
                                className="text-[11px] font-black text-slate-900 truncate"
                                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                            >
                                <LaTeXText text={item.formula || 'N/A'} />
                            </span>
                            {item.molecularWeight && (
                                <span className="text-[9px] font-black text-slate-400 italic">
                                    {t('inventory.card.mw')} {item.molecularWeight}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                        {t('inventory.card.brand')}
                    </span>
                    <span className="text-[10px] font-black text-slate-700 truncate w-full uppercase tracking-tight">
                        {item.brand || 'N/A'}
                    </span>
                </div>

                {!isHardware && (
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            {t('inventory.card.purity')}
                        </span>
                        <span className="text-[10px] font-black text-indigo-600 truncate w-full uppercase tracking-tight">
                            {item.purity || 'AR/N/A'}
                        </span>
                    </div>
                )}

                <div className="flex flex-col col-span-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{t('inventory.card.location')}</span>
                    <div className="flex items-center gap-1.5 text-blue-700 py-1">
                        <i className="fa-solid fa-location-dot text-[8px] shrink-0"></i>
                        <span className="text-[10px] font-black italic break-all leading-tight">{item.location || 'N/A'}</span>
                    </div>
                </div>

                <div className="col-span-2 flex flex-col pt-1.5 border-t border-slate-50/50">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            {isPurchasing ? t('inventory.card.purchaseQuantity') : t('inventory.card.quantity')}
                        </span>
                        {/* ── Sparkline mini chart ── */}
                        {sparkData && (
                            <div className="flex items-center gap-1" title={t('inventory.sparkline.consumed')}>
                                <Sparkline data={sparkData} width={50} height={14} color={isLow ? '#f43f5e' : '#6366f1'} />
                            </div>
                        )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span
                            className={`text-[20px] font-black leading-none ${isLow ? 'text-rose-500' : 'text-slate-900'}`}
                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                        >
                            {typeof item.quantity === 'number' ? Number(item.quantity.toFixed(10)) : (item.quantity ?? '0')}
                        </span>
                        <span
                            className={`text-[10px] font-black uppercase ${isLow ? 'text-rose-600' : 'text-slate-600'}`}
                            style={{ fontFamily: '"Times New Roman", Times, serif' }}
                        >
                            {item.unit}
                        </span>

                        {item.stockCount && (
                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-100">
                                <span className="text-[14px] text-slate-300 font-light">×</span>
                                <span className="text-[16px] font-black text-indigo-600" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    {item.stockCount}
                                </span>
                                <span className="text-[9px] font-black text-indigo-400 uppercase">{t('inventory.card.items')}</span>
                            </div>
                        )}

                        {isLow && (
                            <div className="flex items-center gap-2 ml-auto animate-reveal">
                                <div className="flex items-center gap-1 text-rose-500">
                                    <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                                    <span className="text-[9px] font-black uppercase whitespace-nowrap">{t('inventory.card.lowStock')}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onProcure(item); }}
                                    className="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[8px] font-black uppercase hover:bg-black transition-all shadow-sm flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                    {t('inventory.card.procure')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Alerts & Actions */}
            <div className="mt-2 shrink-0 flex items-center justify-between gap-2 h-7.5">
                <div className="flex-1">
                    {isPurchasing && (
                        <button
                            onClick={handlePushToPlan}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm transition-all active:scale-95 whitespace-nowrap flex items-center gap-2 ${item.pushedToPlan ? 'bg-indigo-600 text-white hover:bg-black' : 'bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                        >
                            <i className={`fa-solid ${item.pushedToPlan ? 'fa-arrow-right-long' : 'fa-calendar-plus'}`}></i> {item.pushedToPlan ? t('inventory.card.viewPlan') : t('inventory.card.addToPlan')}
                        </button>
                    )}
                </div>

                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                    {!isHardware && (
                        <button
                            onClick={handleGenerateMSDS}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-90 ${item.msdsData ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                            title={item.msdsData ? t('inventory.card.viewMSDS') : t('inventory.card.generateMSDS')}
                        >
                            <i className={`fa-solid ${item.msdsData ? 'fa-file-circle-check' : 'fa-file-shield'} text-[10px]`}></i>
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                        className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                        <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                    >
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>

                {isPurchasing && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onConvertToStock(item); }}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95 whitespace-nowrap"
                    >
                        {t('inventory.card.completeArrival')}
                    </button>
                )}
            </div>
        </div>
    );
});

InventoryCard.displayName = 'InventoryCard';
