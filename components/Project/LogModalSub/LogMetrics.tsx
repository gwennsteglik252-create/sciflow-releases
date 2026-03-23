import React, { useState, useRef, useEffect } from 'react';
import { smartConvertChemistry } from '../../../utils/scientificText';
import { getMetricDisplay } from '../../../utils/metricDisplay';
import { useTranslation } from '../../../locales/useTranslation';

interface LogMetricsProps {
    scientificData: Record<string, number>;
    removeMetric: (key: string) => void;
    updateMetric?: (key: string, value: number) => void;
    renameMetric?: (oldKey: string, newKey: string) => void; // 新增：用于更新单位导致的键名变化
    newMetricKey: string;
    setNewMetricKey: (val: string) => void;
    newMetricVal: string;
    setNewMetricVal: (val: string) => void;
    newMetricUnit: string;
    setNewMetricUnit: (val: string) => void;
    addMetric: () => void;
    logResult: 'success' | 'neutral' | 'failure' | 'observation';
    setLogResult: (val: 'success' | 'neutral' | 'failure' | 'observation') => void;
    projectTargets?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
}

const COMMON_UNITS = [
    'mA/cm²', 'Ω·cm', 'cm³', '℃', 'mV/dec', 'mM', 'wt%', 'μV', 'mg/mL', 'nm', 'h', 'min', 's'
];

// 辅助工具：从带括号的键名中提取名称和单位
const splitKeyAndUnit = (key: string) => {
    let name = String(key || '').trim();
    let unit = '';
    while (true) {
        const match = name.match(/\s*\(([^()]+)\)\s*$/);
        if (!match || match.index == null) break;
        if (!unit) unit = match[1].trim();
        name = name.slice(0, match.index).trim();
    }
    return { name: name || String(key || '').trim(), unit };
};

export const LogMetrics: React.FC<LogMetricsProps> = ({
    scientificData, removeMetric, updateMetric, renameMetric, newMetricKey, setNewMetricKey, newMetricVal, setNewMetricVal, newMetricUnit, setNewMetricUnit, addMetric, logResult, setLogResult, projectTargets = []
}) => {
    const { t } = useTranslation();
    const [activeUnitMenu, setActiveUnitMenu] = useState<string | 'NEW' | null>(null);
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

    const handleSelectUnit = (key: string, unit: string) => {
        if (key === 'NEW') {
            setNewMetricUnit(unit);
        } else if (renameMetric) {
            const { name } = splitKeyAndUnit(key);
            const newKey = unit ? `${name} (${unit})` : name;
            renameMetric(key, newKey);
        }
        setActiveUnitMenu(null);
    };

    // 从带单位键名中提取名称（用于匹配 projectTargets 的 label）
    const extractName = (key: string) => splitKeyAndUnit(key).name;

    // 解析 projectTargets 的目标数值
    const parseTargetValue = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        const raw = String(val).trim();
        if (!raw) return null;
        const num = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
        return isNaN(num) ? null : num;
    };

    const hasKpi = Object.keys(scientificData).length > 0;

    return (
        <div className="space-y-5">
            <div>
                <label className="text-xs font-black text-slate-950 uppercase mb-2 block px-1 italic">{t('logModal.metrics.title')}</label>
                <div className={`bg-slate-50 rounded-[2.5rem] p-5 border border-slate-200 shadow-inner overflow-visible relative ${activeUnitMenu ? 'z-[500]' : 'z-10'}`}>

                    {/* 显式列头 - 加深颜色以提升可读性 */}
                    <div className="flex gap-1.5 px-1 mb-2 text-[8px] font-black text-slate-600 uppercase tracking-widest">
                        <span className="flex-[1.5]">{t('logModal.metrics.metricName')}</span>
                        <span className="flex-1 text-center">{t('logModal.metrics.value')}</span>
                        <span className="w-16 text-center">{t('logModal.metrics.unit')}</span>
                        <span className="w-6"></span>
                    </div>

                    <div className="space-y-2 mb-6 overflow-visible">
                        {Object.entries(scientificData).map(([k, v]) => {
                            const { name, unit } = splitKeyAndUnit(k);
                            const metricDisplayName = getMetricDisplay(name).label;
                            const isMenuOpen = activeUnitMenu === k;

                            return (
                                <div key={k} className={`flex gap-1.5 items-center group animate-reveal relative overflow-visible ${isMenuOpen ? 'z-50' : 'z-10'}`}>
                                    <div className="flex-[1.5] min-w-0 bg-white rounded-xl px-3 py-2 text-[11px] font-black border border-slate-100 shadow-sm flex items-center h-10">
                                        <span className="truncate flex-1" title={name}>{metricDisplayName}</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="any"
                                        className="flex-1 min-w-0 bg-white rounded-xl px-1 py-2 text-sm font-black text-rose-600 font-mono outline-none border border-indigo-200 focus:ring-2 focus:ring-indigo-100 text-center shadow-sm h-10"
                                        value={v == null || isNaN(v) ? '' : (v === 0 ? '' : v)}
                                        onChange={(e) => updateMetric?.(k, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />

                                    <div className="w-16 shrink-0 relative">
                                        <input
                                            className="w-full bg-white rounded-xl px-1 py-2 text-[10px] font-black text-slate-700 border border-slate-100 text-center shadow-sm truncate h-10 hover:border-indigo-300 transition-all pr-4"
                                            value={unit || ''}
                                            placeholder="--"
                                            onChange={(e) => {
                                                const { name } = splitKeyAndUnit(k);
                                                renameMetric?.(k, e.target.value ? `${name} (${e.target.value})` : name);
                                            }}
                                        />
                                        <button
                                            onClick={() => setActiveUnitMenu(isMenuOpen ? null : k)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-300 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-all shadow-xs"
                                        >
                                            <i className={`fa-solid fa-plus text-[6px] transition-transform ${isMenuOpen ? 'rotate-45' : ''}`}></i>
                                        </button>
                                        {isMenuOpen && (
                                            <div
                                                ref={menuRef}
                                                className="absolute top-full right-0 mt-1 w-36 bg-slate-900 rounded-2xl shadow-2xl p-1.5 grid grid-cols-2 gap-1 z-[1000] animate-reveal origin-top-right"
                                            >
                                                {COMMON_UNITS.map(u => (
                                                    <button
                                                        key={u}
                                                        onClick={() => handleSelectUnit(k, u)}
                                                        className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8px] font-black font-mono transition-all text-center border border-white/5"
                                                    >
                                                        {u}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => handleSelectUnit(k, '')}
                                                    className="col-span-2 px-2 py-1 rounded-lg bg-white/5 text-slate-400 text-[8px] font-black"
                                                >
                                                    {t('logModal.metrics.clearUnit')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => removeMetric(k)}
                                        className="text-rose-300 hover:text-rose-500 transition-all p-0.5 w-6 flex justify-center active:scale-90"
                                    >
                                        <i className="fa-solid fa-circle-minus text-base"></i>
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="pt-4 border-t border-slate-200 overflow-visible">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 italic">{t('logModal.metrics.addMetric')}</p>
                        <div className={`flex gap-1.5 items-center relative overflow-visible ${activeUnitMenu === 'NEW' ? 'z-50' : 'z-10'}`}>
                            <input className="flex-[1.5] min-w-0 bg-white rounded-xl px-3 py-2.5 text-xs font-bold outline-none shadow-sm border border-slate-200 focus:border-indigo-400 h-11 transition-all" placeholder={t('logModal.metrics.metricPlaceholder')} value={newMetricKey} onChange={e => setNewMetricKey(e.target.value)} onBlur={() => setNewMetricKey(smartConvertChemistry(newMetricKey))} />
                            <input className="flex-1 min-w-0 bg-white rounded-xl px-1 py-2.5 text-xs font-black text-rose-600 font-mono outline-none border border-slate-200 focus:border-indigo-400 text-center shadow-sm h-11" placeholder={t('logModal.metrics.valuePlaceholder')} value={newMetricVal} onChange={e => setNewMetricVal(e.target.value)} />

                            <div className="w-16 shrink-0 relative">
                                <input
                                    className="w-full bg-white rounded-xl px-1 py-2.5 text-[10px] font-bold outline-none shadow-sm border border-slate-200 focus:border-indigo-400 text-center h-11 pr-4"
                                    placeholder={t('logModal.metrics.unitPlaceholder')}
                                    value={newMetricUnit}
                                    onChange={e => setNewMetricUnit(e.target.value)}
                                />
                                <button
                                    onClick={() => setActiveUnitMenu(activeUnitMenu === 'NEW' ? null : 'NEW')}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-300 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-all shadow-xs"
                                >
                                    <i className={`fa-solid fa-plus text-[6px] transition-transform ${activeUnitMenu === 'NEW' ? 'rotate-45' : ''}`}></i>
                                </button>
                                {activeUnitMenu === 'NEW' && (
                                    <div
                                        ref={menuRef}
                                        className="absolute top-full right-0 mt-1 w-36 bg-slate-900 rounded-2xl shadow-2xl p-1.5 grid grid-cols-2 gap-1 z-[1000] animate-reveal origin-top-right"
                                    >
                                        {COMMON_UNITS.map(u => (
                                            <button
                                                key={u}
                                                onClick={() => handleSelectUnit('NEW', u)}
                                                className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8px] font-black font-mono transition-all text-center border border-white/5"
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button onClick={addMetric} className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 hover:bg-black transition-all shrink-0"><i className="fa-solid fa-plus text-sm"></i></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 附件2：实测数据 VS 目标 (BENCHMARKING) — 仅当 KPI SNAPSHOT 有内容时展示 */}
            {hasKpi && (
                <div className="animate-reveal">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <label className="text-xs font-black text-slate-950 uppercase italic">{t('logModal.metrics.benchmarking')}</label>
                        {projectTargets.length > 0 && (
                            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                                <i className="fa-solid fa-crosshairs"></i> {t('logModal.metrics.engineOn')}
                            </span>
                        )}
                    </div>
                    <div className="bg-slate-50 rounded-[2.5rem] p-5 border border-slate-200 shadow-inner space-y-3">
                        {projectTargets.length > 0 ? (
                            projectTargets.filter(Boolean).map((target, i) => {
                                const actualEntry = Object.entries(scientificData).find(([k]) => {
                                    const name = extractName(k);
                                    return name === target.label || k === target.label;
                                });
                                const actualVal = actualEntry ? Number(actualEntry[1]) : null;
                                const targetNum = parseTargetValue(target.value);

                                let percent = 0;
                                let statusColor = 'bg-slate-200';
                                let textColor = 'text-slate-400';
                                let badge = t('logModal.metrics.notEntered');
                                let badgeColor = 'bg-slate-100 text-slate-400';

                                if (actualVal !== null && Number.isFinite(actualVal) && targetNum !== null && targetNum !== 0) {
                                    const ratio = actualVal / targetNum;
                                    percent = Math.min(Math.round(ratio * 100), 999);
                                    const isHigherBetter = target.isHigherBetter !== false;
                                    const isExcellent = isHigherBetter ? ratio >= 1.0 : ratio <= 1.0;
                                    const isGood = isHigherBetter ? ratio >= 0.95 : ratio <= 1.05;

                                    if (isExcellent) {
                                        statusColor = 'bg-emerald-500'; textColor = 'text-emerald-600';
                                        badge = t('logModal.metrics.targetMet'); badgeColor = 'bg-emerald-50 text-emerald-600 border border-emerald-200';
                                    } else if (isGood) {
                                        statusColor = 'bg-amber-400'; textColor = 'text-amber-600';
                                        badge = t('logModal.metrics.targetClose'); badgeColor = 'bg-amber-50 text-amber-600 border border-amber-200';
                                    } else {
                                        statusColor = 'bg-rose-400'; textColor = 'text-rose-600';
                                        badge = t('logModal.metrics.targetNotMet'); badgeColor = 'bg-rose-50 text-rose-600 border border-rose-200';
                                    }
                                } else if (actualVal !== null && Number.isFinite(actualVal)) {
                                    statusColor = 'bg-indigo-400'; textColor = 'text-indigo-600';
                                    badge = t('logModal.metrics.entered'); badgeColor = 'bg-indigo-50 text-indigo-600 border border-indigo-200';
                                    percent = 100;
                                }

                                return (
                                    <div key={i} className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-black text-slate-700 truncate flex-1" title={target.label}>
                                                {target.label}{target.unit && <span className="font-normal text-slate-400 ml-1">({target.unit})</span>}
                                            </span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {actualVal !== null
                                                    ? <span className={`text-[11px] font-black font-mono ${textColor}`}>{actualVal}</span>
                                                    : <span className="text-[10px] text-slate-300 font-mono">—</span>
                                                }
                                                <span className="text-[9px] text-slate-300 font-mono">/</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{target.value}</span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${statusColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            Object.entries(scientificData).map(([k, v]) => {
                                const { name, unit } = splitKeyAndUnit(k);
                                return (
                                    <div key={k} className="flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0">
                                        <span className="text-[10px] font-black text-slate-600 truncate flex-1">{name}</span>
                                        <span className="text-[11px] font-black font-mono text-indigo-600">{v} <span className="text-[9px] text-slate-400 font-normal">{unit}</span></span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            <div>
                <label className="text-xs font-black text-slate-950 uppercase mb-3 block px-1 italic">{t('logModal.metrics.outcome')}</label>
                <div className="grid grid-cols-1 gap-2.5">
                    <button onClick={() => setLogResult('success')} className={`py-4 rounded-3xl text-xs font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${logResult === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${logResult === 'success' ? 'bg-emerald-500 shadow-[0_0_12px_#10b981] animate-pulse' : 'bg-slate-300'}`}></span> {t('logModal.metrics.reachedExpectation')}
                    </button>
                    <button onClick={() => setLogResult('observation')} className={`py-4 rounded-3xl text-xs font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${logResult === 'observation' ? 'bg-amber-50 border-amber-600 text-amber-700 shadow-lg scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${logResult === 'observation' ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b] animate-pulse' : 'bg-slate-300'}`}></span> {t('logModal.metrics.observing')}
                    </button>
                    <button onClick={() => setLogResult('failure')} className={`py-4 rounded-3xl text-xs font-black uppercase transition-all flex items-center justify-center gap-3 border-2 ${logResult === 'failure' ? 'bg-rose-50 border-rose-600 text-rose-700 shadow-lg scale-[1.02]' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${logResult === 'failure' ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse' : 'bg-slate-300'}`}></span> {t('logModal.metrics.notReachedExpectation')}
                    </button>
                </div>
            </div>
        </div>
    );
};
