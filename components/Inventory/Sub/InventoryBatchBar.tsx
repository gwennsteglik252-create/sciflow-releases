import React, { useState, useCallback } from 'react';
import { InventoryCategory } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';

interface InventoryBatchBarProps {
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onBatchChangeLocation: (newLocation: string) => void;
    onBatchChangeCategory: (newCategory: InventoryCategory) => void;
    onBatchDelete: () => void;
}

export const InventoryBatchBar: React.FC<InventoryBatchBarProps> = React.memo(({
    selectedCount, totalCount, onSelectAll, onDeselectAll,
    onBatchChangeLocation, onBatchChangeCategory, onBatchDelete
}) => {
    const { t } = useTranslation();
    const [showLocationInput, setShowLocationInput] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [locationValue, setLocationValue] = useState('');

    const handleApplyLocation = useCallback(() => {
        if (locationValue.trim()) {
            onBatchChangeLocation(locationValue.trim());
            setLocationValue('');
            setShowLocationInput(false);
        }
    }, [locationValue, onBatchChangeLocation]);

    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[900] animate-reveal">
            <div className="bg-slate-900 text-white rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xl border border-slate-700">
                {/* Selection Count */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-sm font-black">
                        {selectedCount}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                        {t('inventory.batch.selected', { count: selectedCount })}
                    </span>
                </div>

                <div className="w-px h-7 bg-slate-700" />

                {/* Select/Deselect All */}
                <button
                    onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase transition-all"
                >
                    {selectedCount === totalCount ? t('inventory.batch.deselectAll') : t('inventory.batch.selectAll')}
                </button>

                <div className="w-px h-7 bg-slate-700" />

                {/* Change Location */}
                <div className="relative">
                    <button
                        onClick={() => { setShowLocationInput(!showLocationInput); setShowCategoryPicker(false); }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[9px] font-black uppercase transition-all flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-location-dot text-[8px]" />
                        {t('inventory.batch.changeLocation')}
                    </button>
                    {showLocationInput && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-2xl p-3 flex items-center gap-2 min-w-[280px] border border-slate-200">
                            <input
                                type="text"
                                className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none border border-transparent focus:border-indigo-300"
                                placeholder={t('inventory.batch.newLocation')}
                                value={locationValue}
                                onChange={e => setLocationValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleApplyLocation()}
                                autoFocus
                            />
                            <button
                                onClick={handleApplyLocation}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-black transition-all"
                            >
                                {t('inventory.batch.applyLocation')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Change Category */}
                <div className="relative">
                    <button
                        onClick={() => { setShowCategoryPicker(!showCategoryPicker); setShowLocationInput(false); }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-[9px] font-black uppercase transition-all flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-tags text-[8px]" />
                        {t('inventory.batch.changeCategory')}
                    </button>
                    {showCategoryPicker && (
                        <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-2xl p-2 min-w-[180px] border border-slate-200 space-y-1">
                            {(['Chemical', 'Precursor', 'Hardware', 'Consumable'] as InventoryCategory[]).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { onBatchChangeCategory(cat); setShowCategoryPicker(false); }}
                                    className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                >
                                    {t(`inventory.categories.${cat}` as any)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-7 bg-slate-700" />

                {/* Batch Delete */}
                <button
                    onClick={onBatchDelete}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-[9px] font-black uppercase transition-all flex items-center gap-1.5"
                >
                    <i className="fa-solid fa-trash-can text-[8px]" />
                    {t('inventory.batch.batchDelete')}
                </button>

                {/* Close */}
                <button
                    onClick={onDeselectAll}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-all"
                >
                    <i className="fa-solid fa-times text-xs text-slate-400" />
                </button>
            </div>
        </div>
    );
});

InventoryBatchBar.displayName = 'InventoryBatchBar';
