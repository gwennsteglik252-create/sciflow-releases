/**
 * DifferenceSpectrumPanel.tsx
 * 差谱分析子面板
 */
import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    Legend, ReferenceLine, Area, ComposedChart, ReferenceArea
} from 'recharts';
import {
    computeDifferenceSpectrum, computeAllDifferenceSpectra, extractVoltageKeys,
    voltageKeyToLabel, DifferenceSpectrumResult, SpectrumDataPoint
} from './spectroscopyAnalysis';

interface Props {
    dataset: SpectrumDataPoint[];
}

const DIFF_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

const DifferenceSpectrumPanel: React.FC<Props> = ({ dataset }) => {
    const voltageKeys = useMemo(() => extractVoltageKeys(dataset), [dataset]);
    const [refKey, setRefKey] = useState<string>(voltageKeys[0] || '');
    const [showAll, setShowAll] = useState(true);
    const [selectedTarget, setSelectedTarget] = useState<string>('');

    const allDiffSpectra = useMemo(() => {
        if (!refKey || voltageKeys.length < 2) return [];
        return computeAllDifferenceSpectra(dataset, refKey, voltageKeys);
    }, [dataset, refKey, voltageKeys]);

    const singleDiffSpectrum = useMemo(() => {
        if (!refKey || !selectedTarget) return null;
        return computeDifferenceSpectrum(dataset, refKey, selectedTarget);
    }, [dataset, refKey, selectedTarget]);

    // 合并数据用于叠加渲染
    const mergedChartData = useMemo(() => {
        if (allDiffSpectra.length === 0) return [];
        const wavenumbers = dataset.map(d => d.wavenumber);
        return wavenumbers.map((wn, idx) => {
            const entry: any = { wavenumber: wn };
            allDiffSpectra.forEach((ds, i) => {
                entry[`diff_${ds.targetKey}`] = ds.data[idx]?.diff || 0;
            });
            return entry;
        });
    }, [dataset, allDiffSpectra]);

    if (dataset.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-wave-square text-4xl"></i>
                <p className="text-[10px] font-black uppercase">请先加载原位光谱数据</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4">
            {/* 控制栏 */}
            <div className="flex items-center gap-4 px-2 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">参考电位</span>
                    <select
                        value={refKey}
                        onChange={e => setRefKey(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                    >
                        {voltageKeys.map(k => (
                            <option key={k} value={k}>{voltageKeyToLabel(k)} (参考)</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAll(true)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${showAll ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        全部叠加
                    </button>
                    <button
                        onClick={() => { setShowAll(false); setSelectedTarget(voltageKeys.find(k => k !== refKey) || ''); }}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!showAll ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        单条对比
                    </button>
                </div>

                {!showAll && (
                    <select
                        value={selectedTarget}
                        onChange={e => setSelectedTarget(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                    >
                        {voltageKeys.filter(k => k !== refKey).map(k => (
                            <option key={k} value={k}>{voltageKeyToLabel(k)}</option>
                        ))}
                    </select>
                )}

                <div className="ml-auto px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-[9px] font-black text-emerald-600 uppercase">
                        <i className="fa-solid fa-info-circle mr-1"></i>
                        差谱 = I(V<sub>target</sub>) − I(V<sub>ref</sub>)
                    </span>
                </div>
            </div>

            {/* 差谱图 */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={showAll ? mergedChartData : (singleDiffSpectrum ? singleDiffSpectrum.data : [])} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="wavenumber"
                            label={{ value: 'Wavenumber (cm⁻¹)', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 'bold' }}
                            fontSize={10}
                            tick={{ fill: '#64748b' }}
                        />
                        <YAxis
                            label={{ value: 'ΔIntensity (a.u.)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' }}
                            fontSize={10}
                            tick={{ fill: '#64748b' }}
                        />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3" />

                        {showAll ? (
                            allDiffSpectra.map((ds, i) => (
                                <Line
                                    key={ds.targetKey}
                                    type="monotone"
                                    dataKey={`diff_${ds.targetKey}`}
                                    stroke={DIFF_COLORS[i % DIFF_COLORS.length]}
                                    strokeWidth={1.5}
                                    dot={false}
                                    name={`Δ(${voltageKeyToLabel(ds.targetKey)} − ${voltageKeyToLabel(refKey)})`}
                                />
                            ))
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="diff"
                                stroke="#6366f1"
                                strokeWidth={2}
                                dot={false}
                                name={singleDiffSpectrum ? `Δ(${voltageKeyToLabel(singleDiffSpectrum.targetKey)} − ${voltageKeyToLabel(singleDiffSpectrum.refKey)})` : 'Diff'}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* 区域统计 */}
            {singleDiffSpectrum && !showAll && (
                <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                        <span className="text-[8px] font-black text-rose-400 uppercase">正增长区域</span>
                        <p className="text-xs font-black text-rose-600 mt-1">
                            {singleDiffSpectrum.positiveRegions.length} 个
                            {singleDiffSpectrum.positiveRegions.length > 0 && (
                                <span className="text-[9px] font-bold text-rose-400 ml-2">
                                    ({singleDiffSpectrum.positiveRegions.map(r => `${r.start}–${r.end}`).join(', ')} cm⁻¹)
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <span className="text-[8px] font-black text-blue-400 uppercase">负减少区域</span>
                        <p className="text-xs font-black text-blue-600 mt-1">
                            {singleDiffSpectrum.negativeRegions.length} 个
                            {singleDiffSpectrum.negativeRegions.length > 0 && (
                                <span className="text-[9px] font-bold text-blue-400 ml-2">
                                    ({singleDiffSpectrum.negativeRegions.slice(0, 3).map(r => `${r.start}–${r.end}`).join(', ')} cm⁻¹)
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DifferenceSpectrumPanel;
