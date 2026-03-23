
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TheoreticalDescriptors } from '../../services/gemini';
import { useTranslation } from '../../locales/useTranslation';

// ── 可搜索的基座材料 Combobox ──
const SubstrateCombobox: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // 外部点击关闭
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // 多维度模糊搜索
    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q) return Object.entries(TheoreticalDescriptors);
        return Object.entries(TheoreticalDescriptors).filter(([name, desc]) => {
            const d = desc as any;
            return name.toLowerCase().includes(q)
                || (d.category || '').toLowerCase().includes(q)
                || (d.primaryMetal || '').toLowerCase().includes(q);
        });
    }, [query]);

    // 按分类分组
    const grouped = useMemo(() => {
        const map = new Map<string, [string, any][]>();
        for (const entry of filtered) {
            const cat = (entry[1] as any).category || 'Other';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(entry);
        }
        return map;
    }, [filtered]);

    const handleSelect = (name: string) => {
        onChange(name);
        setQuery('');
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && query.trim()) {
            const exact = filtered.find(([n]) => n.toLowerCase() === query.toLowerCase().trim());
            handleSelect(exact ? exact[0] : query.trim());
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
            setQuery('');
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <div
                className="w-full bg-slate-100 rounded-xl px-3 h-10 flex items-center gap-2 border border-slate-100 focus-within:border-indigo-300 transition-colors cursor-pointer"
                onClick={() => setIsOpen(true)}
            >
                <i className="fa-solid fa-magnifying-glass text-[9px] text-slate-400" />
                <input
                    className="flex-1 bg-transparent text-[11px] font-bold outline-none placeholder:text-slate-400 min-w-0"
                    placeholder={value || t('mechanism.params.searchMaterial')}
                    value={isOpen ? query : ''}
                    onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
                {!isOpen && (
                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[60%] text-right">{value}</span>
                )}
                <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-64 overflow-y-auto custom-scrollbar">
                    {filtered.length === 0 && query.trim() ? (
                        <div className="p-2">
                            <button
                                onClick={() => handleSelect(query.trim())}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 text-[10px] font-bold text-indigo-600 flex items-center gap-2"
                            >
                                <i className="fa-solid fa-plus text-[8px]" />
                                {t('mechanism.params.useCustomMaterial')} <span className="font-black">{query.trim()}</span>
                            </button>
                        </div>
                    ) : (
                        Array.from(grouped.entries()).map(([cat, entries]) => (
                            <div key={cat}>
                                <div className="px-3 pt-2 pb-1 text-[7px] font-black text-slate-400 uppercase tracking-widest sticky top-0 bg-white/95 backdrop-blur-sm">{cat}</div>
                                {entries.map(([name]) => (
                                    <button
                                        key={name}
                                        onClick={() => handleSelect(name)}
                                        className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors flex items-center justify-between ${
                                            name === value
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span>{name}</span>
                                        {name === value && <i className="fa-solid fa-check text-[8px] text-indigo-500" />}
                                    </button>
                                ))}
                            </div>
                        ))
                    )}
                    {query.trim() && filtered.length > 0 && (
                        <div className="border-t border-slate-100 p-1.5">
                            <button
                                onClick={() => handleSelect(query.trim())}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-indigo-50 text-[9px] font-bold text-indigo-500 flex items-center gap-2"
                            >
                                <i className="fa-solid fa-plus text-[7px]" />
                                {t('mechanism.params.custom')} {query.trim()}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface MechanismParametersProps {
    pH: number;
    potential: number;
    reactionMode: 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';
    material: string;
    unitCellType: string;
    dopingElement: string;
    dopingConcentration: number;
    coDopingElement?: string;
    coDopingConcentration?: number;
    mechanismSession: any;
    updateMechanismSession: (updates: any) => void;
    measuredPoint: { v: string, j: string };
    setMeasuredPoint: (pt: { v: string, j: string }) => void;
    isOperatingExpanded: boolean;
    setIsOperatingExpanded: (exp: boolean) => void;
    isDopingExpanded: boolean;
    setIsDopingExpanded: (exp: boolean) => void;
    isBenchmarkExpanded: boolean;
    setIsBenchmarkExpanded: (exp: boolean) => void;
    stabilityPrediction: any;
    isStableAnalysis: boolean;
}

const MechanismParameters: React.FC<MechanismParametersProps> = ({
    pH, potential, reactionMode,
    material, unitCellType, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, mechanismSession, updateMechanismSession,
    measuredPoint, setMeasuredPoint,
    isOperatingExpanded, setIsOperatingExpanded,
    isDopingExpanded, setIsDopingExpanded,
    isBenchmarkExpanded, setIsBenchmarkExpanded,
    stabilityPrediction,
    isStableAnalysis
}) => {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 min-h-0">



            {/* Operating Conditions Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0 transition-all duration-300">
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsOperatingExpanded(!isOperatingExpanded)}>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-indigo-500"></i> {t('mechanism.params.operatingTitle')}
                    </h4>
                    <i className={`fa-solid ${isOperatingExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs transition-transform duration-300`}></i>
                </div>
                {isOperatingExpanded && (
                    <div className="space-y-4 animate-reveal">
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">{t('mechanism.params.reactionLabel')}</label>
                            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                                <button onClick={() => updateMechanismSession({ reactionMode: 'OER' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'OER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>OER</button>
                                <button onClick={() => updateMechanismSession({ reactionMode: 'HER' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'HER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>HER</button>
                                <button onClick={() => updateMechanismSession({ reactionMode: 'ORR' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'ORR' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>ORR</button>
                                <button onClick={() => updateMechanismSession({ reactionMode: 'BIFUNCTIONAL' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'BIFUNCTIONAL' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Bi-Fun</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">{t('mechanism.params.phLabel')}</label>
                                <input type="number" step="0.1" value={pH} onChange={e => updateMechanismSession({ pH: parseFloat(e.target.value) })} className="w-full bg-slate-50 rounded-xl p-3 text-[11px] font-bold outline-none border border-slate-100 focus:border-indigo-300 transition-colors h-10" />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">{t('mechanism.params.potentialLabel')}</label>
                                <input type="number" step="0.01" value={potential} onChange={e => updateMechanismSession({ potential: parseFloat(e.target.value) })} className="w-full bg-slate-50 rounded-xl p-3 text-[11px] font-bold outline-none border border-slate-100 focus:border-indigo-300 transition-colors h-10" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Material Engineering Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5 shrink-0 transition-all duration-300">
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsDopingExpanded(!isDopingExpanded)}>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-vial-circle-check text-violet-600"></i> {t('mechanism.params.dopingTitle')}</h4>
                    <i className={`fa-solid ${isDopingExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs transition-transform duration-300`}></i>
                </div>
                {isDopingExpanded && (
                    <div className="space-y-4 animate-reveal">
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">{t('mechanism.params.substrateLabel')}</label>
                            <SubstrateCombobox
                                value={material}
                                onChange={(newMat) => {
                                    const config = (TheoreticalDescriptors as any)[newMat];
                                    const updates: any = { material: newMat };
                                    if (config?.defaultUnitCell) {
                                        updates.unitCellType = config.defaultUnitCell;
                                    }
                                    updateMechanismSession(updates);
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1 flex justify-between">
                                <span>{t('mechanism.params.unitCellLabel')}</span>
                                <span className="text-[6px] text-emerald-500 lowercase italic">{t('mechanism.params.unitCellAutoHint')}</span>
                            </label>
                            <select className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10" value={unitCellType} onChange={e => updateMechanismSession({ unitCellType: e.target.value })}>
                                <option value="Layered (LDH)">{t('mechanism.params.unitCellLDH')}</option>
                                <option value="MOF (Porous Framework)">{t('mechanism.params.unitCellMOF')}</option>
                                <option value="SAC (Carbon Framework)">{t('mechanism.params.unitCellSAC')}</option>
                                <option value="Simple Cubic">Simple Cubic</option>
                                <option value="BCC (体心立方)">{t('mechanism.params.unitCellBCC')}</option>
                                <option value="FCC (面心立方)">{t('mechanism.params.unitCellFCC')}</option>
                                <option value="Rutile">{t('mechanism.params.unitCellRutile')}</option>
                                <option value="Perovskite">{t('mechanism.params.unitCellPerovskite')}</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">{t('mechanism.params.dopingElement1')}</label>
                                <select className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10" value={dopingElement} onChange={e => updateMechanismSession({ dopingElement: e.target.value })}>
                                    {['Ag', 'Pt', 'Pd', 'Cu', 'Au', 'Fe', 'Ni', 'Co', 'V', 'W', 'Mo', 'Ru', 'Ir', 'Ce', 'S', 'P', 'Cr', 'Ti', 'Mn', 'Nb', 'Ta', 'Zr', 'La', 'Sn', 'Bi', 'Zn'].map(el => <option key={el} value={el}>{el}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">{t('mechanism.params.concentration1')}</label>
                                <input type="number" step="0.5" value={dopingConcentration} onChange={e => updateMechanismSession({ dopingConcentration: parseFloat(e.target.value) })} className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none h-10" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">{t('mechanism.params.dopingElement2')}</label>
                                <select className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10" value={coDopingElement || 'None'} onChange={e => updateMechanismSession({ coDopingElement: e.target.value })}>
                                    <option value="None">{t('mechanism.params.noneOption')}</option>
                                    {['Ag', 'Pt', 'Pd', 'Cu', 'Au', 'Fe', 'Ni', 'Co', 'V', 'W', 'Mo', 'Ru', 'Ir', 'Ce', 'S', 'P', 'Cr', 'Ti', 'Mn', 'Nb', 'Ta', 'Zr', 'La', 'Sn', 'Bi', 'Zn'].map(el => <option key={el} value={el}>{el}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">{t('mechanism.params.concentration2')}</label>
                                <input type="number" step="0.5" min="0" disabled={!coDopingElement || coDopingElement === 'None'} value={coDopingConcentration || 0} onChange={e => updateMechanismSession({ coDopingConcentration: parseFloat(e.target.value) })} className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none h-10 disabled:opacity-50" />
                            </div>
                        </div>

                        {/* 额外掺杂元素 (动态) */}
                        {((mechanismSession as any)?.additionalDopants || []).map((dopant: { element: string; concentration: number }, idx: number) => (
                            <div key={`extra-dopant-${idx}`} className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1 flex justify-between items-center">
                                        <span>{t('mechanism.params.dopingElementN', { n: idx + 3 })}</span>
                                        <button
                                            onClick={() => {
                                                const list = [...((mechanismSession as any)?.additionalDopants || [])];
                                                list.splice(idx, 1);
                                                updateMechanismSession({ additionalDopants: list });
                                            }}
                                            className="text-[7px] text-rose-400 hover:text-rose-600 transition-colors"
                                            title={t('mechanism.params.removeDopantTitle')}
                                        >
                                            <i className="fa-solid fa-xmark mr-0.5"></i>{t('mechanism.params.removeDopant')}
                                        </button>
                                    </label>
                                    <select
                                        className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10"
                                        value={dopant.element}
                                        onChange={e => {
                                            const list = [...((mechanismSession as any)?.additionalDopants || [])];
                                            list[idx] = { ...list[idx], element: e.target.value };
                                            updateMechanismSession({ additionalDopants: list });
                                        }}
                                    >
                                        {['Ag', 'Pt', 'Pd', 'Cu', 'Au', 'Fe', 'Ni', 'Co', 'V', 'W', 'Mo', 'Ru', 'Ir', 'Ce', 'S', 'P', 'Cr', 'Ti', 'Mn', 'Nb', 'Ta', 'Zr', 'La', 'Sn', 'Bi', 'Zn'].map(el => <option key={el} value={el}>{el}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">{t('mechanism.params.concentrationN', { n: idx + 3 })}</label>
                                    <input
                                        type="number" step="0.5" min="0"
                                        value={dopant.concentration}
                                        onChange={e => {
                                            const list = [...((mechanismSession as any)?.additionalDopants || [])];
                                            list[idx] = { ...list[idx], concentration: parseFloat(e.target.value) || 0 };
                                            updateMechanismSession({ additionalDopants: list });
                                        }}
                                        className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none h-10"
                                    />
                                </div>
                            </div>
                        ))}

                        {/* 添加掺杂按钮 */}
                        {((mechanismSession as any)?.additionalDopants || []).length < 3 && (
                            <button
                                onClick={() => {
                                    const list = [...((mechanismSession as any)?.additionalDopants || [])];
                                    list.push({ element: 'Fe', concentration: 0 });
                                    updateMechanismSession({ additionalDopants: list });
                                }}
                                className="w-full py-1.5 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 text-[8px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-wider transition-all hover:bg-indigo-50/50 flex items-center justify-center gap-1.5"
                            >
                                <i className="fa-solid fa-plus text-[7px]"></i>
                                {t('mechanism.params.addDopant')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Benchmark Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0 transition-all duration-300 relative">
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsBenchmarkExpanded(!isBenchmarkExpanded)}>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-crosshairs text-rose-500"></i> {t('mechanism.params.benchmarkTitle')}</h4>
                    <i className={`fa-solid ${isBenchmarkExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs transition-transform duration-300`}></i>
                </div>
                {isBenchmarkExpanded && (
                    <div className="animate-reveal space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">{t('mechanism.params.voltageLabel')}</label><input className="w-full bg-slate-100 rounded-xl p-3 text-[11px] font-bold outline-none text-rose-600 h-10" placeholder="e.g. 1.6" value={measuredPoint.v} onChange={e => setMeasuredPoint({ ...measuredPoint, v: e.target.value })} /></div>
                            <div><label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">{t('mechanism.params.measuredCurrentLabel')}</label><input className="w-full bg-slate-100 rounded-xl p-3 text-[11px] font-bold outline-none text-rose-600 h-10" placeholder="e.g. 500" value={measuredPoint.j} onChange={e => setMeasuredPoint({ ...measuredPoint, j: e.target.value })} /></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stability Prediction Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0 mb-4">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-shield-halved text-emerald-600"></i> {t('mechanism.params.stabilityTitle')}</h4>
                {stabilityPrediction ? (
                    <div className="animate-reveal space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className={`text-2xl font-black leading-none ${stabilityPrediction.safetyIndex >= 8 ? 'text-emerald-500' : stabilityPrediction.safetyIndex >= 5 ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {stabilityPrediction.safetyIndex.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">/ 10.0</span>
                                </span>
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">{t('mechanism.params.safetyIndexLabel')}</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50 relative shadow-inner">
                                    <div
                                        className={`h-full transition-all duration-1000 shadow-lg ${stabilityPrediction.safetyIndex >= 8 ? 'bg-emerald-500' : stabilityPrediction.safetyIndex >= 5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        style={{ width: `${(stabilityPrediction.safetyIndex / 10) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className={`text-[8px] font-black uppercase ${stabilityPrediction.status === 'Excellent' ? 'text-emerald-500' : stabilityPrediction.status === 'Good' ? 'text-emerald-400' : stabilityPrediction.status === 'Fair' ? 'text-amber-500' : 'text-rose-500'}`}>{stabilityPrediction.status}</span>
                                    <div className="flex items-center gap-1.5">
                                        {stabilityPrediction.auditSource && (
                                            <span className={`text-[6px] font-black px-1 py-0.5 rounded border ${stabilityPrediction.auditSource === 'local' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : stabilityPrediction.auditSource === 'hybrid' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                {stabilityPrediction.auditSource === 'local' ? t('mechanism.params.auditSourceLocal') : stabilityPrediction.auditSource === 'hybrid' ? t('mechanism.params.auditSourceHybrid') : t('mechanism.params.auditSourceAI')}
                                            </span>
                                        )}
                                        <span className="text-[6px] font-black text-slate-300 uppercase tracking-tighter">{t('mechanism.params.auditLabel')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pourbaix 各维度评分细节 */}
                        {stabilityPrediction.dimensions && (
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2 animate-reveal">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {t('mechanism.params.pourbaixScoreTitle')}
                                    </h5>
                                    {stabilityPrediction.regionId && (
                                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${
                                            stabilityPrediction.regionId === 'immunity' ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800' :
                                            stabilityPrediction.regionId === 'passivation' ? 'bg-indigo-900/50 text-indigo-400 border-indigo-800' :
                                            stabilityPrediction.regionId === 'acidic' ? 'bg-rose-900/50 text-rose-400 border-rose-800' :
                                            'bg-amber-900/50 text-amber-400 border-amber-800'
                                        }`}>
                                            {stabilityPrediction.dimensions.regionBase.label}
                                        </span>
                                    )}
                                </div>
                                {[
                                    { ...stabilityPrediction.dimensions.regionBase, icon: 'fa-map-location-dot', color: 'emerald', key: 'region' },
                                    { ...stabilityPrediction.dimensions.immunityMargin, icon: 'fa-shield', color: 'cyan', key: 'immunity' },
                                    { ...stabilityPrediction.dimensions.pHSafety, icon: 'fa-flask-vial', color: 'blue', key: 'ph' },
                                    { ...stabilityPrediction.dimensions.transpassiveRisk, icon: 'fa-bolt', color: 'rose', key: 'trans' },
                                    { ...stabilityPrediction.dimensions.dopingEffect, icon: 'fa-atom', color: 'violet', key: 'doping' },
                                ].map(dim => {
                                    const isNegative = dim.score < 0;
                                    const absFraction = dim.maxScore > 0 ? Math.min(1, Math.abs(dim.score) / dim.maxScore) : (Math.abs(dim.score) > 0 ? 1 : 0);
                                    return (
                                        <div key={dim.key} className="flex items-center gap-2">
                                            <i className={`fa-solid ${dim.icon} text-[8px] w-3 text-center ${isNegative ? 'text-rose-500' : `text-${dim.color}-400`}`}></i>
                                            <span className="text-[8px] font-bold text-slate-500 w-[60px] truncate">{dim.label}</span>
                                            <div className="flex-1 bg-white/5 h-1.5 rounded-full overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${isNegative ? 'bg-rose-500' : dim.color === 'emerald' ? 'bg-emerald-500' : dim.color === 'cyan' ? 'bg-cyan-500' : dim.color === 'blue' ? 'bg-blue-500' : dim.color === 'violet' ? 'bg-violet-500' : 'bg-slate-500'}`}
                                                    style={{ width: `${absFraction * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className={`text-[9px] font-black font-mono w-10 text-right ${isNegative ? 'text-rose-400' : 'text-slate-300'}`}>
                                                {isNegative ? '' : '+'}{dim.score.toFixed(1)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 热力学风险细分 */}
                        {stabilityPrediction.thermodynamicRisk && (
                            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex gap-2 items-start">
                                <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px] mt-1"></i>
                                <div>
                                    <p className="text-[8px] font-black text-rose-600 uppercase mb-0.5">{t('mechanism.params.pourbaixRiskTitle')}</p>
                                    <p className="text-[10px] font-bold text-rose-800 leading-tight italic">{stabilityPrediction.thermodynamicRisk}</p>
                                </div>
                            </div>
                        )}

                        {/* 结构化稳定性分析渲染 */}
                        {stabilityPrediction.descSections && stabilityPrediction.descSections.length > 0 ? (
                            <div className="space-y-3">
                                {stabilityPrediction.descSections.map((section: any, idx: number) => {
                                    const colorMap: Record<string, { border: string; bg: string; text: string; icon: string; dot: string }> = {
                                        emerald: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/60', text: 'text-emerald-700', icon: 'text-emerald-500', dot: 'bg-emerald-500' },
                                        teal:    { border: 'border-l-teal-500',    bg: 'bg-teal-50/60',    text: 'text-teal-700',    icon: 'text-teal-500',    dot: 'bg-teal-500' },
                                        cyan:    { border: 'border-l-cyan-500',    bg: 'bg-cyan-50/60',    text: 'text-cyan-700',    icon: 'text-cyan-500',    dot: 'bg-cyan-500' },
                                        indigo:  { border: 'border-l-indigo-500',  bg: 'bg-indigo-50/60',  text: 'text-indigo-700',  icon: 'text-indigo-500',  dot: 'bg-indigo-500' },
                                        rose:    { border: 'border-l-rose-500',    bg: 'bg-rose-50/60',    text: 'text-rose-700',    icon: 'text-rose-500',    dot: 'bg-rose-500' },
                                        amber:   { border: 'border-l-amber-500',   bg: 'bg-amber-50/60',   text: 'text-amber-700',   icon: 'text-amber-500',   dot: 'bg-amber-500' },
                                        violet:  { border: 'border-l-violet-500',  bg: 'bg-violet-50/60',  text: 'text-violet-700',  icon: 'text-violet-500',  dot: 'bg-violet-500' },
                                    };
                                    const c = colorMap[section.color] || colorMap.indigo;
                                    return (
                                        <div key={idx} className={`rounded-lg border-l-[3px] ${c.border} ${c.bg} p-3 transition-all`}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <i className={`fa-solid ${section.icon} text-[10px] ${c.icon}`}></i>
                                                <h6 className={`text-[10px] font-black uppercase tracking-wider ${c.text}`}>{section.title}</h6>
                                            </div>
                                            {section.body && (
                                                <p className="text-[11px] leading-[1.7] text-slate-600 font-medium">{section.body}</p>
                                            )}
                                            {section.items && section.items.length > 0 && (
                                                <ul className="mt-2 space-y-1.5">
                                                    {section.items.map((item: string, i: number) => (
                                                        <li key={i} className="flex items-start gap-2 text-[10.5px] text-slate-600 font-medium leading-[1.6]">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-[5px] shrink-0`}></span>
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] leading-relaxed text-slate-600 font-medium shadow-inner whitespace-pre-line">{stabilityPrediction.desc}</div>
                        )}
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">{t('mechanism.params.waitingAudit')}</div>
                )}
            </div>
        </div>
    );
};

export default MechanismParameters;
