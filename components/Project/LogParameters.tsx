
import React, { useState, useRef, useEffect } from 'react';
import { smartConvertChemistry } from '../../utils/scientificText';

interface LogParametersProps {
    paramList: { key: string, value: string, unit: string }[];
    setParamList: (params: { key: string, value: string, unit: string }[]) => void;
    planSnapshot?: Record<string, string>; // 计划阶段的参数快照，用于对标
}

const QUICK_CONDITIONS = [
    { label: '加热', key: '加热' },
    { label: '搅拌', key: '搅拌' },
    { label: '避光', key: '避光环境' },
    { label: '超声', key: '超声分散' },
    { label: '气氛', key: '气氛保护' },
    { label: '离心', key: '离心分离' },
    { label: '洗涤', key: '产物洗涤' },
];

const COMMON_UNITS = [
    'mA/cm²', 'Ω·cm', 'cm³', '℃', 'mV/dec', 'mM', 'wt%', 'μV', 'mg/mL', 'nm', 'h', 'min', 's'
];

export const LogParameters: React.FC<LogParametersProps> = ({ paramList, setParamList, planSnapshot }) => {
    const [activeUnitMenu, setActiveUnitMenu] = useState<number | null>(null);
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

    // 核心改进：增强型正则，支持 mA/cm²、μV、Ω·cm 等复杂物理单位的提取
    React.useEffect(() => {
        if (!planSnapshot) return;

        let changed = false;
        const newList = paramList.map(p => {
            // 如果当前项没有单位，但参数名在计划中存在
            if (!p.unit && p.key && planSnapshot[p.key]) {
                const targetVal = planSnapshot[p.key];
                // 正则说明：匹配以字母、百分号、度数、常见单位符号开头的末尾字符串
                const unitMatch = targetVal.match(/([a-zA-Z%°℃μΩ/²³·]+)$/);
                if (unitMatch) {
                    changed = true;
                    return { ...p, unit: unitMatch[1] };
                }
            }
            return p;
        });

        if (changed) {
            setParamList(newList);
        }
    }, [planSnapshot, setParamList]);

    const updateParam = (idx: number, field: 'key' | 'value' | 'unit', val: string) => {
        const newList = [...paramList];
        newList[idx][field] = val;
        setParamList(newList);
    };

    const addParamRow = (key = '', value = '', unit = '') => {
        const filtered = paramList.filter(p => p.key.trim() !== '' || p.value.trim() !== '');
        setParamList([...filtered, { key, value, unit }]);
    };

    const removeParamRow = (idx: number) => {
        if (paramList.length > 1) setParamList(paramList.filter((_, i) => i !== idx));
        else setParamList([{ key: '', value: '', unit: '' }]);
    };

    const handleQuickAdd = (key: string) => {
        if (paramList.some(p => p.key === key)) return;
        addParamRow(key, '是');
    };

    const checkDeviation = (key: string, value: string) => {
        if (!planSnapshot) return null;
        const target = planSnapshot[key];
        if (!target) return null;

        const numTarget = parseFloat(target.replace(/[^0-9.]/g, ''));
        const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));

        if (isNaN(numTarget) || isNaN(numValue)) {
            return target.trim() !== value.trim() ? { type: 'diff', target } : null;
        }

        // 偏离 5% 触发警告
        const diffPercent = Math.abs((numValue - numTarget) / numTarget);
        if (diffPercent > 0.05) {
            return {
                type: 'alert',
                target,
                percent: Math.round(diffPercent * 100),
                isHigher: numValue > numTarget
            };
        }
        return { type: 'match', target };
    };

    return (
        <div className="animate-reveal">
            <div className="flex justify-between items-center mb-3 px-1">
                <label className="text-xs font-black text-slate-950 uppercase block italic tracking-tight">关键参数与计划对标 (BENCHMARKING)</label>
                {planSnapshot && (
                    <div className="flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-0.5 rounded-full shadow-lg shadow-indigo-100 border border-indigo-50 animate-pulse">
                        <i className="fa-solid fa-crosshairs text-[8px]"></i>
                        <span className="text-[8px] font-black uppercase">对标引擎开启</span>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4 px-1">
                {QUICK_CONDITIONS.map(cond => (
                    <button key={cond.key} onClick={() => handleQuickAdd(cond.key)} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm active:scale-95">+ {cond.label}</button>
                ))}
            </div>

            <div className={`bg-white rounded-3xl p-5 border-2 border-dashed border-indigo-300 shadow-inner relative transition-all ${activeUnitMenu !== null ? 'z-[500]' : 'z-10'}`}>
                {/* 显式列头 - 使用更深的颜色提升对比度 */}
                <div className="flex gap-2 px-1 mb-2 text-[8px] font-black text-slate-700 uppercase tracking-widest">
                    <span className="flex-[1.5]">参数名</span>
                    <span className="flex-1 text-center">实测值</span>
                    <span className="w-20 text-center">单位</span>
                    <span className="w-6"></span>
                </div>

                <div className="space-y-4">
                    {paramList.map((param, idx) => {
                        const dev = checkDeviation(param.key, param.value);
                        const isAlert = dev?.type === 'alert' || dev?.type === 'diff';
                        const isMenuOpen = activeUnitMenu === idx;

                        return (
                            <div key={idx} className={`flex gap-2 items-start group animate-reveal relative overflow-visible ${isMenuOpen ? 'z-50' : 'z-10'} ${planSnapshot ? 'pb-10' : 'pb-2'}`}>
                                <div className="flex-[1.5] min-w-0">
                                    <input
                                        className="w-full bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none border border-transparent focus:border-indigo-400 focus:bg-white h-11 shadow-sm transition-all"
                                        placeholder="参数名"
                                        value={param.key}
                                        onChange={e => updateParam(idx, 'key', e.target.value)}
                                        onBlur={() => { const converted = smartConvertChemistry(param.key); if (converted !== param.key) updateParam(idx, 'key', converted); }}
                                    />
                                </div>
                                <div className="flex-1 min-w-0 relative">
                                    <input
                                        className={`w-full rounded-xl px-2 py-2.5 text-xs font-black outline-none text-center h-11 shadow-sm transition-all font-mono ${isAlert
                                                ? 'bg-rose-50 border-rose-400 text-rose-700 ring-4 ring-rose-100'
                                                : dev?.type === 'match'
                                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                                                    : 'bg-slate-50 border-transparent text-indigo-700 focus:border-indigo-400 focus:bg-white'
                                            }`}
                                        placeholder="实测值"
                                        value={param.value}
                                        onChange={e => updateParam(idx, 'value', e.target.value)}
                                    />

                                    {dev && (
                                        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-[100] whitespace-nowrap px-3 py-1 rounded-xl text-[8px] font-black uppercase shadow-xl border-2 transition-all scale-90 group-hover:scale-100 ${isAlert
                                                ? 'bg-rose-600 border-rose-500 text-white animate-bounce'
                                                : 'bg-slate-800 border-slate-700 text-white'
                                            }`}>
                                            {dev.type === 'alert'
                                                ? `计划: ${dev.target} (偏差 ${dev.percent}%)`
                                                : dev.type === 'diff'
                                                    ? `计划: ${dev.target} (不一致)`
                                                    : `已对标计划值: ${dev.target}`
                                            }
                                            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 border-[4px] border-transparent ${isAlert ? 'border-b-rose-600' : 'border-b-slate-800'}`}></div>
                                        </div>
                                    )}
                                </div>

                                <div className="w-20 shrink-0 relative">
                                    <input
                                        className="w-full bg-slate-50 rounded-xl px-2 py-2.5 text-[10px] font-black outline-none border border-transparent h-11 text-slate-600 shadow-sm text-center focus:bg-white focus:border-indigo-200 font-mono pr-6"
                                        placeholder="单位"
                                        value={param.unit}
                                        onChange={e => updateParam(idx, 'unit', e.target.value)}
                                    />
                                    <button
                                        onClick={() => setActiveUnitMenu(isMenuOpen ? null : idx)}
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
                                                    onClick={() => { updateParam(idx, 'unit', u); setActiveUnitMenu(null); }}
                                                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[8px] font-black font-mono transition-all text-center border border-white/5"
                                                >
                                                    {u}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => { updateParam(idx, 'unit', ''); setActiveUnitMenu(null); }}
                                                className="col-span-2 px-2 py-1 rounded-lg bg-white/5 text-slate-400 text-[8px] font-black"
                                            >
                                                清除单位
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => removeParamRow(idx)} className="text-rose-300 hover:text-rose-600 transition-colors pt-3 active:scale-90"><i className="fa-solid fa-times-circle text-lg"></i></button>
                            </div>
                        )
                    })}
                </div>
                <button onClick={() => addParamRow()} className="w-full mt-4 py-4 text-[11px] font-black text-indigo-600 border-2 border-dashed border-indigo-200 rounded-3xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group">
                    <i className="fa-solid fa-plus-circle group-hover:scale-110 transition-transform"></i>
                    新增参数行
                </button>
            </div>
        </div>
    );
};
