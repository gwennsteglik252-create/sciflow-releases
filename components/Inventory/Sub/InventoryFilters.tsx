
import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import { InventoryCategory } from '../../../types';

interface InventoryFiltersProps {
  activeTab: InventoryCategory | 'All' | 'PurchaseList';
  setActiveTab: (tab: InventoryCategory | 'All' | 'PurchaseList') => void;
  showInUseOnly: boolean;
  setShowInUseOnly: (val: boolean) => void;
  showLowStockOnly: boolean;
  search: string;
  setSearch: (val: string) => void;
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = React.memo(({
  activeTab, setActiveTab, showInUseOnly, setShowInUseOnly, showLowStockOnly, search, setSearch
}) => {
  const { t } = useTranslation();
  
  const categories: { id: InventoryCategory | 'All' | 'PurchaseList'; label: string; icon: string }[] = [
    { id: 'All', label: t('inventory.tabs.all'), icon: 'fa-cubes' },
    { id: 'Hardware', label: t('inventory.tabs.hardware'), icon: 'fa-microscope' },
    { id: 'Chemical', label: t('inventory.tabs.chemical'), icon: 'fa-vial' },
    { id: 'Precursor', label: t('inventory.tabs.precursor'), icon: 'fa-flask-vial' },
    { id: 'Consumable', label: t('inventory.tabs.consumable'), icon: 'fa-box' },
    { id: 'PurchaseList', label: t('inventory.tabs.purchaseList'), icon: 'fa-cart-shopping' },
  ];

  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar shrink-0">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveTab(category.id)}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${activeTab === category.id && !showLowStockOnly ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowInUseOnly(!showInUseOnly)}
          className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center gap-2 shadow-sm border active:scale-95 ${showInUseOnly ? 'bg-amber-500 text-white border-amber-400' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          <i className={`fa-solid ${showInUseOnly ? 'fa-play' : 'fa-play opacity-20'}`}></i> {t('inventory.filters.inUse')}
        </button>

        {/* Search */}
        <div className="relative group min-w-[320px]">
          <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-[13px] group-hover:text-indigo-500 transition-colors"></i>
          <input
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all shadow-sm group-hover:border-slate-300"
            placeholder={t('inventory.filters.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="hidden md:block"></div>
    </div>
  );
});

InventoryFilters.displayName = 'InventoryFilters';
