
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { InventoryItem, ConsumedReagent } from '../../../types';
import LaTeXText from '../../Common/LaTeXText';

interface LogReagentConsumptionProps {
    inventory: InventoryItem[];
    consumedReagents: ConsumedReagent[];
    setConsumedReagents: (reagents: ConsumedReagent[]) => void;
}

const COMMON_UNITS = [
    'mA/cm²', 'Ω·cm', 'cm³', '℃', 'mV/dec', 'mM', 'wt%', 'μV', 'mg/mL', 'nm', 'h', 'min', 's'
];

export const LogReagentConsumption: React.FC<LogReagentConsumptionProps> = ({
    inventory, consumedReagents, setConsumedReagents
}) => {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [useAmount, setUseAmount] = useState('');
    const [activeUnitMenu, setActiveUnitMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setActiveUnitMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const baseCandidates = useMemo(() => inventory, [inventory]);

    const filteredCandidates = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return baseCandidates.slice(0, 12); // 无搜索词时显示前12个

        return baseCandidates.filter(i => {
            const nameMatch = (i?.name || '').toLowerCase().includes(q);
            const formulaMatch = (i?.formula || '').toLowerCase().includes(q);
            const casMatch = (i?.casNo || '').toLowerCase().includes(q);
            return nameMatch || formulaMatch || casMatch;
        });
    }, [baseCandidates, searchTerm]);

    const selectedItem = useMemo(() =>
        inventory.find(c => c.id === selectedId),
        [inventory, selectedId]
    );

    const handleAdd = () => {
        if (!selectedItem || isNaN(parseFloat(useAmount))) return;
        const amount = parseFloat(useAmount);

        const next = [...consumedReagents];
        const existingIdx = next.findIndex(r => r.inventoryId === selectedId);

        if (existingIdx !== -1) {
            next[existingIdx].amount += amount;
        } else {
            next.push({
                inventoryId: selectedItem.id,
                name: selectedItem.name || '未知物资',
                amount,
                unit: selectedItem.unit
            });
        }

        setConsumedReagents(next);
        setUseAmount('');
        setSearchTerm('');
        setSelectedId('');
        setIsSearchOpen(false); // 添加后自动收起
    };

    const handleRemove = (id: string) => {
        setConsumedReagents(consumedReagents.filter(r => r.inventoryId !== id));
    };

    const handleUpdateUnit = (id: string, unit: string) => {
        setConsumedReagents(consumedReagents.map(r => r.inventoryId === id ? { ...r, unit } : r));
        setActiveUnitMenu(null);
    };

    return (
        <div className="space-y-2.5">
            <div className="flex justify-between items-center px-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    药剂/物资消耗审计
                </label>
                <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className={`text-[11px] font-black px-3 py-1.5 rounded-xl transition-all ${isSearchOpen ? 'bg-slate-200 text-slate-600' : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white'}`}
                >
                    {isSearchOpen ? '收起搜索' : '+ 添加物资'}
                </button>
            </div>

            <div className={`bg-slate-50 rounded-[2rem] p-3 border border-slate-100 shadow-inner relative transition-all ${isSearchOpen || activeUnitMenu ? 'z-[500]' : 'z-10'}`}>
                {/* 1. 已选列表 - 增加字号 */}
                <div className="flex flex-wrap gap-2 min-h-[40px] items-center overflow-visible">
                    {consumedReagents.map(r => {
                        const isMenuOpen = activeUnitMenu === r.inventoryId;
                        return (
                            <div key={r.inventoryId} className={`flex items-center gap-2.5 bg-white pl-3 pr-2 py-1.5 rounded-xl border border-slate-200 shadow-sm animate-reveal group relative overflow-visible ${isMenuOpen ? 'z-50' : 'z-10'}`}>
                                <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate">
                                    <LaTeXText text={r.name || '未知物资'} />
                                </span>
                                <div className="relative shrink-0">
                                    <button
                                        onClick={() => setActiveUnitMenu(isMenuOpen ? null : r.inventoryId)}
                                        className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                                    >
                                        {r.amount} {r.unit}
                                        <i className="fa-solid fa-caret-down text-[8px] opacity-40"></i>
                                    </button>

                                    {isMenuOpen && (
                                        <div
                                            ref={menuRef}
                                            className="absolute top-full right-0 mt-1 w-36 bg-slate-900 rounded-2xl shadow-2xl p-1.5 grid grid-cols-2 gap-1 z-[1000] animate-reveal origin-top-right"
                                        >
                                            {COMMON_UNITS.map(u => (
                                                <button
                                                    key={u}
                                                    onClick={() => handleUpdateUnit(r.inventoryId, u)}
                                                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8px] font-black font-mono transition-all text-center border border-white/5"
                                                >
                                                    {u}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => handleRemove(r.inventoryId)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                    <i className="fa-solid fa-circle-xmark text-sm"></i>
                                </button>
                            </div>
                        );
                    })}
                    {consumedReagents.length === 0 && !isSearchOpen && (
                        <p className="text-[11px] text-slate-300 italic py-1 px-2">未添加物资消耗</p>
                    )}
                </div>

                {/* 2. 可折叠的搜索区域 */}
                {isSearchOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-200 animate-reveal">
                        {/* 搜索框 */}
                        <div className="relative mb-3">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 transition-all shadow-sm"
                                placeholder="搜索名称或 CAS 号..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* 搜索结果列表 - 增加字号 */}
                        <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1 mb-3">
                            {filteredCandidates.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between group ${selectedId === item.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-600'}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-[11px] font-black uppercase truncate ${selectedId === item.id ? 'text-white' : 'text-slate-800'}`}>
                                            <LaTeXText text={item.name || '未知物资'} />
                                        </p>
                                        <p className={`text-[9px] font-bold mt-1 ${selectedId === item.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            余: {item.quantity || 0}{item.unit || ''} | {item.location ? item.location.split(',')[0] : '未知位置'}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* 用量确认 */}
                        {selectedId && (
                            <div className="flex gap-2 items-end animate-reveal bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        autoFocus
                                        className="w-full py-2.5 bg-white border border-indigo-200 rounded-xl px-3 text-sm font-black text-indigo-700 outline-none shadow-inner"
                                        placeholder="输入本次用量..."
                                        value={useAmount}
                                        onChange={e => setUseAmount(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                                    />
                                </div>
                                <button
                                    onClick={handleAdd}
                                    disabled={!useAmount || parseFloat(useAmount) <= 0}
                                    className="h-11 px-5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg disabled:opacity-30 active:scale-95 transition-all"
                                >
                                    确认
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
