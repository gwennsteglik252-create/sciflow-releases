/**
 * TimeResolvedPanel.tsx
 * 时间分辨原位光谱模式
 * 恒电位 / 恒电流下的光谱时间演化
 */
import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import {
    TimeSpectrumDataPoint, extractTimeKeys, timeKeyToLabel, timeKeyToMinutes,
    generateTimeResolvedDemoData, analyzePeakDecay, DecayResult
} from './timeResolvedAnalysis';

interface Props {
    dataset: TimeSpectrumDataPoint[];
    onLoadDemo?: () => void;
}

const TIME_COLORS = [
    '#10b981', '#34d399', '#6ee7b7', // 绿色（早期）
    '#fbbf24', '#f59e0b',             // 黄色（中期）
    '#f43f5e', '#dc2626',             // 红色（晚期）
];

const TimeResolvedPanel: React.FC<Props> = ({ dataset, onLoadDemo }) => {
    const [activeView, setActiveView] = useState<'spectra' | 'evolution' | 'heatmap'>('spectra');
    const [selectedPeak, setSelectedPeak] = useState(580);
    const timeKeys = useMemo(() => extractTimeKeys(dataset), [dataset]);

    // 峰位演化数据
    const evolutionData = useMemo(() => {
        if (dataset.length === 0 || timeKeys.length === 0) return [];
        return timeKeys.map(key => {
            const time = timeKeyToMinutes(key);
            const region580 = dataset.filter(d => d.wavenumber >= 540 && d.wavenumber <= 620);
            const region820 = dataset.filter(d => d.wavenumber >= 780 && d.wavenumber <= 860);
            const peak580 = Math.max(...region580.map(d => (d[key] as number) || 0));
            const peak820 = Math.max(...region820.map(d => (d[key] as number) || 0));
            return {
                time,
                label: timeKeyToLabel(key),
                peak580,
                peak820,
                ratio: peak820 > 0 ? peak580 / peak820 : 0,
            };
        });
    }, [dataset, timeKeys]);

    if (dataset.length === 0 || timeKeys.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-4">
                <i className="fa-solid fa-clock-rotate-left text-5xl"></i>
                <p className="text-[10px] font-black uppercase">时间分辨数据未加载</p>
                {onLoadDemo && (
                    <button
                        onClick={onLoadDemo}
                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all"
                    >
                        <i className="fa-solid fa-flask mr-2"></i>加载稳定性测试演示
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-3">
            {/* 子视图切换 */}
            <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    {[
                        { key: 'spectra' as const, label: '时序光谱', icon: 'fa-chart-area' },
                        { key: 'evolution' as const, label: '峰强演化', icon: 'fa-chart-line' },
                        { key: 'heatmap' as const, label: '强度热图', icon: 'fa-table-cells' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveView(t.key)}
                            className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${activeView === t.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            <i className={`fa-solid ${t.icon} mr-1`}></i>{t.label}
                        </button>
                    ))}
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                    <i className="fa-solid fa-stopwatch mr-1"></i>
                    {timeKeys.length} 个时间点 · {timeKeyToLabel(timeKeys[0])} → {timeKeyToLabel(timeKeys[timeKeys.length - 1])}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {/* ---- 时序谱图叠加 ---- */}
                {activeView === 'spectra' && (
                    <div className="h-full bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <h6 className="text-[9px] font-black text-slate-400 uppercase mb-2">
                            <i className="fa-solid fa-clock mr-1"></i>恒电位 1.6 V 下的原位拉曼时间序列
                        </h6>
                        <ResponsiveContainer width="100%" height="90%">
                            <LineChart data={dataset} margin={{ top: 10, right: 30, left: 0, bottom: 15 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="wavenumber" fontSize={9} tick={{ fill: '#64748b' }}
                                    label={{ value: 'Wavenumber (cm⁻¹)', position: 'insideBottom', offset: -8, fontSize: 9, fontWeight: 'bold' }} />
                                <YAxis fontSize={9} tick={{ fill: '#64748b' }}
                                    label={{ value: 'Intensity (a.u.)', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 'bold' }} />
                                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '9px' }} />
                                <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                                {timeKeys.map((key, i) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={TIME_COLORS[i % TIME_COLORS.length]}
                                        strokeWidth={i === 0 ? 2.5 : i === timeKeys.length - 1 ? 2 : 1.5}
                                        strokeDasharray={i === timeKeys.length - 1 ? '5 3' : undefined}
                                        dot={false}
                                        name={timeKeyToLabel(key)}
                                    />
                                ))}
                                <ReferenceLine x={580} stroke="#f43f5e" strokeDasharray="3 3"
                                    label={{ value: '*OOH', position: 'top', fontSize: 8, fill: '#f43f5e', fontWeight: 'bold' }} />
                                <ReferenceLine x={820} stroke="#6366f1" strokeDasharray="3 3"
                                    label={{ value: '*OH', position: 'top', fontSize: 8, fill: '#6366f1', fontWeight: 'bold' }} />
                                <ReferenceLine x={500} stroke="#f59e0b" strokeDasharray="3 3"
                                    label={{ value: 'CoOOH', position: 'top', fontSize: 8, fill: '#f59e0b', fontWeight: 'bold' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* ---- 峰强演化 ---- */}
                {activeView === 'evolution' && (
                    <div className="h-full grid grid-rows-2 gap-4">
                        {/* 峰强 vs 时间 */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                            <h6 className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                <i className="fa-solid fa-chart-line mr-1"></i>特征峰强度 vs 时间
                            </h6>
                            <ResponsiveContainer width="100%" height="85%">
                                <LineChart data={evolutionData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" fontSize={9} tick={{ fill: '#64748b' }}
                                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5, fontSize: 9, fontWeight: 'bold' }} />
                                    <YAxis fontSize={9} tick={{ fill: '#64748b' }}
                                        label={{ value: 'Peak Intensity (a.u.)', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 'bold' }} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: '9px' }} />
                                    <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                                    <Line type="monotone" dataKey="peak580" stroke="#f43f5e" strokeWidth={2.5} name="580 cm⁻¹ (*OOH)" dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="peak820" stroke="#6366f1" strokeWidth={2.5} name="820 cm⁻¹ (*OH)" dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        {/* 峰面积比 vs 时间 */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                            <h6 className="text-[9px] font-black text-slate-400 uppercase mb-2">
                                <i className="fa-solid fa-arrows-turn-to-dots mr-1"></i>I₅₈₀/I₈₂₀ 面积比 vs 时间
                            </h6>
                            <ResponsiveContainer width="100%" height="85%">
                                <LineChart data={evolutionData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="time" fontSize={9} tick={{ fill: '#64748b' }}
                                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5, fontSize: 9, fontWeight: 'bold' }} />
                                    <YAxis fontSize={9} tick={{ fill: '#64748b' }}
                                        label={{ value: 'I₅₈₀/I₈₂₀', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 'bold' }} />
                                    <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: '9px' }} />
                                    <Line type="monotone" dataKey="ratio" stroke="#10b981" strokeWidth={2.5} name="面积比" dot={{ r: 4, fill: '#10b981' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* ---- 强度热图 ---- */}
                {activeView === 'heatmap' && (
                    <div className="h-full bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col">
                        <h6 className="text-[9px] font-black text-slate-400 uppercase mb-3">
                            <i className="fa-solid fa-table-cells mr-1"></i>Wavenumber × Time 强度矩阵
                        </h6>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse text-[9px]">
                                <thead>
                                    <tr>
                                        <th className="p-1.5 bg-slate-50 border border-slate-200 font-black text-slate-500 sticky left-0 z-10">cm⁻¹</th>
                                        {timeKeys.map(tk => (
                                            <th key={tk} className="p-1.5 bg-slate-50 border border-slate-200 font-black text-slate-500 whitespace-nowrap">
                                                {timeKeyToLabel(tk)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {dataset.filter((_, i) => i % 4 === 0).map((row, ri) => (
                                        <tr key={ri}>
                                            <td className="p-1.5 border border-slate-100 font-bold text-slate-600 sticky left-0 bg-white z-10">
                                                {row.wavenumber}
                                            </td>
                                            {timeKeys.map(tk => {
                                                const val = (row[tk] as number) || 0;
                                                const maxVal = 120;
                                                const t = Math.min(1, val / maxVal);
                                                const r = Math.round(68 + t * (253 - 68));
                                                const g = Math.round(1 + t * (231 - 1));
                                                const b = Math.round(84 + t * (37 - 84));
                                                return (
                                                    <td key={tk} className="p-1.5 border border-slate-50 text-center font-mono text-white"
                                                        style={{ backgroundColor: `rgb(${r},${g},${b})` }}>
                                                        {val.toFixed(0)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimeResolvedPanel;
