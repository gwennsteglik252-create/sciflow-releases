
import React from 'react';
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
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar shrink-0">
          {(['All', 'Hardware', 'Chemical', 'Precursor', 'Consumable', 'PurchaseList'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab && !showLowStockOnly ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              {tab === 'All' ? '全部资产' :
                tab === 'Hardware' ? '仪器设备' :
                  tab === 'Chemical' ? '通用化学品' :
                    tab === 'Precursor' ? '关键前驱体' :
                      tab === 'PurchaseList' ? '采购清单' : '耗材'}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowInUseOnly(!showInUseOnly)}
          className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all flex items-center gap-2 shadow-sm border active:scale-95 ${showInUseOnly ? 'bg-amber-500 text-white border-amber-400' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
        >
          <i className={`fa-solid ${showInUseOnly ? 'fa-play' : 'fa-play opacity-20'}`}></i> 筛选在用
        </button>

        {/* Search */}
        <div className="relative group min-w-[320px]">
          <i className="fa-solid fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-[13px] group-hover:text-indigo-500 transition-colors"></i>
          <input
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-6 py-3 text-sm font-bold outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all shadow-sm group-hover:border-slate-300"
            placeholder="搜索库库内物资 (名称、CAS、品牌...)"
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
