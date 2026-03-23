/**
 * PeakTrackingPanel.tsx
 * 峰面积比追踪 + 峰位移追踪子面板
 */
import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    Legend, ComposedChart, Bar, ReferenceLine, Scatter, ScatterChart, ZAxis
} from 'recharts';
import {
    trackPeakRatioVsVoltage, trackPeakShift, fitGaussianPeak,
    extractVoltageKeys, voltageKeyToLabel, autoDetectPeaks,
    SpectrumDataPoint, PeakFitResult
} from './spectroscopyAnalysis';

interface Props {
    dataset: SpectrumDataPoint[];
}

const DEFAULT_PEAK1 = 580;
const DEFAULT_PEAK2 = 820;

const PeakTrackingPanel: React.FC<Props> = ({ dataset }) => {
    const voltageKeys = useMemo(() => extractVoltageKeys(dataset), [dataset]);
    const [peak1, setPeak1] = useState(DEFAULT_PEAK1);
    const [peak2, setPeak2] = useState(DEFAULT_PEAK2);
    const [activeView, setActiveView] = useState<'ratio' | 'shift' | 'fitting'>('ratio');

    // 自动检测峰位
    const detectedPeaks = useMemo(() => {
        if (voltageKeys.length === 0) return [];
        const lastKey = voltageKeys[voltageKeys.length - 1];
        return autoDetectPeaks(dataset, lastKey);
    }, [dataset, voltageKeys]);

    // 峰面积比追踪
    const ratioData = useMemo(() => {
        if (voltageKeys.length === 0) return [];
        return trackPeakRatioVsVoltage(dataset, voltageKeys, peak1, peak2);
    }, [dataset, voltageKeys, peak1, peak2]);

    // 峰位移追踪
    const shiftData1 = useMemo(() =>
        trackPeakShift(dataset, voltageKeys, peak1),
        [dataset, voltageKeys, peak1]
    );
    const shiftData2 = useMemo(() =>
        trackPeakShift(dataset, voltageKeys, peak2),
        [dataset, voltageKeys, peak2]
    );

    // 多电位峰拟合结果
    const fittingResults = useMemo(() => {
        const results: { voltage: string; peak1Fit: PeakFitResult | null; peak2Fit: PeakFitResult | null }[] = [];
        for (const key of voltageKeys) {
            results.push({
                voltage: voltageKeyToLabel(key),
                peak1Fit: fitGaussianPeak(dataset, key, peak1),
                peak2Fit: fitGaussianPeak(dataset, key, peak2),
            });
        }
        return results;
    }, [dataset, voltageKeys, peak1, peak2]);

    if (dataset.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-chart-line text-4xl"></i>
                <p className="text-[10px] font-black uppercase">请先加载原位光谱数据</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4">
            {/* 顶部控制栏 */}
            <div className="flex items-center gap-4 px-2 shrink-0 flex-wrap">
                {/* 峰位设置 */}
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-rose-500 uppercase">Peak 1</span>
                    <input
                        type="number"
                        value={peak1}
                        onChange={e => setPeak1(Number(e.target.value))}
                        className="w-20 px-2 py-1.5 bg-white border border-rose-200 rounded-lg text-[10px] font-bold text-slate-700 focus:border-rose-400 outline-none text-center"
                    />
                    <span className="text-[9px] text-slate-400">cm⁻¹</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-emerald-500 uppercase">Peak 2</span>
                    <input
                        type="number"
                        value={peak2}
                        onChange={e => setPeak2(Number(e.target.value))}
                        className="w-20 px-2 py-1.5 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-slate-700 focus:border-emerald-400 outline-none text-center"
                    />
                    <span className="text-[9px] text-slate-400">cm⁻¹</span>
                </div>

                {/* 自动检测峰位按钮 */}
                {detectedPeaks.length >= 2 && (
                    <button
                        onClick={() => { setPeak1(detectedPeaks[0]); if (detectedPeaks[1]) setPeak2(detectedPeaks[1]); }}
                        className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[9px] font-black uppercase hover:bg-amber-100 transition-all"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                        自动检测 ({detectedPeaks.length} peaks)
                    </button>
                )}

                {/* 视图切换 */}
                <div className="flex items-center gap-1 ml-auto bg-slate-100 rounded-lg p-0.5">
                    {[
                        { key: 'ratio' as const, label: '面积比', icon: 'fa-chart-pie' },
                        { key: 'shift' as const, label: '峰位移', icon: 'fa-arrows-left-right' },
                        { key: 'fitting' as const, label: '拟合表', icon: 'fa-table' },
                    ].map(v => (
                        <button
                            key={v.key}
                            onClick={() => setActiveView(v.key)}
                            className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${activeView === v.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <i className={`fa-solid ${v.icon} mr-1`}></i>{v.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 图表区域 */}
            <div className="flex-1 min-h-0">
                {activeView === 'ratio' && (
                    <div className="h-full flex flex-col gap-4">
                        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={ratioData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="voltage"
                                        label={{ value: 'Voltage (V vs. RHE)', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 'bold' }}
                                        fontSize={10} tick={{ fill: '#64748b' }}
                                    />
                                    <YAxis
                                        yAxisId="ratio"
                                        label={{ value: `I${peak1}/I${peak2} Ratio`, angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' }}
                                        fontSize={10} tick={{ fill: '#6366f1' }}
                                    />
                                    <YAxis
                                        yAxisId="area"
                                        orientation="right"
                                        label={{ value: 'Peak Area (a.u.)', angle: 90, position: 'insideRight', fontSize: 10, fontWeight: 'bold' }}
                                        fontSize={10} tick={{ fill: '#94a3b8' }}
                                    />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                                    <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                    <Bar yAxisId="area" dataKey="peak1Area" fill="#f43f5e33" stroke="#f43f5e" name={`${peak1} cm⁻¹ Area`} />
                                    <Bar yAxisId="area" dataKey="peak2Area" fill="#10b98133" stroke="#10b981" name={`${peak2} cm⁻¹ Area`} />
                                    <Line yAxisId="ratio" type="monotone" dataKey="ratio" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 4 }} name={`I${peak1}/I${peak2}`} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        {/* 拐点检测提示 */}
                        {ratioData.length >= 3 && (
                            <div className="shrink-0 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                                <span className="text-[9px] font-black text-indigo-600 uppercase">
                                    <i className="fa-solid fa-lightbulb mr-1"></i>
                                    {(() => {
                                        // 检测最大变化率区间
                                        let maxChange = 0, maxIdx = 0;
                                        for (let i = 1; i < ratioData.length; i++) {
                                            const change = Math.abs(ratioData[i].ratio - ratioData[i - 1].ratio);
                                            if (change > maxChange) { maxChange = change; maxIdx = i; }
                                        }
                                        return `最大变化率区间: ${ratioData[maxIdx - 1]?.voltage ?? '?'}V → ${ratioData[maxIdx]?.voltage ?? '?'}V (ΔRatio = ${maxChange.toFixed(2)})，提示 *OOH/*OH 转化关键电位窗口`;
                                    })()}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {activeView === 'shift' && (
                    <div className="h-full bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="voltage"
                                    type="number"
                                    domain={['auto', 'auto']}
                                    label={{ value: 'Voltage (V vs. RHE)', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 'bold' }}
                                    fontSize={10} tick={{ fill: '#64748b' }}
                                />
                                <YAxis
                                    label={{ value: 'Peak Shift Δν (cm⁻¹)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' }}
                                    fontSize={10} tick={{ fill: '#64748b' }}
                                />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }} />
                                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6 3" />
                                <Line data={shiftData1} type="monotone" dataKey="shift" stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', r: 4 }} name={`${peak1} cm⁻¹ shift`} />
                                <Line data={shiftData2} type="monotone" dataKey="shift" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name={`${peak2} cm⁻¹ shift`} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {activeView === 'fitting' && (
                    <div className="h-full overflow-auto custom-scrollbar">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="bg-slate-50 sticky top-0 z-10">
                                    <th className="px-4 py-3 text-left font-black text-slate-500 uppercase">电位</th>
                                    <th className="px-4 py-3 text-center font-black text-rose-500 uppercase">{peak1} cm⁻¹ 峰位</th>
                                    <th className="px-4 py-3 text-center font-black text-rose-500 uppercase">FWHM</th>
                                    <th className="px-4 py-3 text-center font-black text-rose-500 uppercase">面积</th>
                                    <th className="px-4 py-3 text-center font-black text-rose-500 uppercase">R²</th>
                                    <th className="px-4 py-3 text-center font-black text-emerald-500 uppercase">{peak2} cm⁻¹ 峰位</th>
                                    <th className="px-4 py-3 text-center font-black text-emerald-500 uppercase">FWHM</th>
                                    <th className="px-4 py-3 text-center font-black text-emerald-500 uppercase">面积</th>
                                    <th className="px-4 py-3 text-center font-black text-emerald-500 uppercase">R²</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fittingResults.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 font-bold text-slate-700">{row.voltage}</td>
                                        <td className="px-4 py-3 text-center font-mono text-slate-600">{row.peak1Fit?.center.toFixed(1) ?? '—'}</td>
                                        <td className="px-4 py-3 text-center font-mono text-slate-600">{row.peak1Fit?.fwhm.toFixed(1) ?? '—'}</td>
                                        <td className="px-4 py-3 text-center font-mono text-slate-600">{row.peak1Fit?.area.toFixed(1) ?? '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            {row.peak1Fit ? (
                                                <span className={`font-mono font-bold ${row.peak1Fit.r2 > 0.95 ? 'text-emerald-600' : row.peak1Fit.r2 > 0.8 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                    {row.peak1Fit.r2.toFixed(3)}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono text-slate-600">{row.peak2Fit?.center.toFixed(1) ?? '—'}</td>
                                        <td className="px-4 py-3 text-center font-mono text-slate-600">{row.peak2Fit?.fwhm.toFixed(1) ?? '—'}</td>
                                        <td className="px-4 py-3 text-center font-mono text-slate-600">{row.peak2Fit?.area.toFixed(1) ?? '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            {row.peak2Fit ? (
                                                <span className={`font-mono font-bold ${row.peak2Fit.r2 > 0.95 ? 'text-emerald-600' : row.peak2Fit.r2 > 0.8 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                    {row.peak2Fit.r2.toFixed(3)}
                                                </span>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PeakTrackingPanel;
