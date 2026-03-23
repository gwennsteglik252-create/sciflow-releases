/**
 * StabilityDecayPanel.tsx
 * 稳定性衰减分析面板
 * 峰衰减拟合 + 半衰期 + 相变检测 + 综合稳定性报告
 */
import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend, Scatter, ComposedChart
} from 'recharts';
import {
    TimeSpectrumDataPoint, extractTimeKeys, timeKeyToLabel,
    generateStabilityReport, StabilityReport
} from './timeResolvedAnalysis';

interface Props {
    dataset: TimeSpectrumDataPoint[];
}

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
    A: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', emoji: '🏆' },
    B: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', emoji: '👍' },
    C: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', emoji: '⚠️' },
    D: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', emoji: '🔶' },
    F: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', emoji: '❌' },
};

const StabilityDecayPanel: React.FC<Props> = ({ dataset }) => {
    const [peakCenters, setPeakCenters] = useState<number[]>([580, 820]);
    const [activeView, setActiveView] = useState<'decay' | 'phase' | 'report'>('report');
    const timeKeys = useMemo(() => extractTimeKeys(dataset), [dataset]);

    const report = useMemo<StabilityReport | null>(() => {
        if (dataset.length === 0 || timeKeys.length < 2) return null;
        return generateStabilityReport(dataset, timeKeys, peakCenters);
    }, [dataset, timeKeys, peakCenters]);

    if (!report || dataset.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-battery-quarter text-4xl"></i>
                <p className="text-[10px] font-black uppercase">需要时间分辨数据进行衰减分析</p>
            </div>
        );
    }

    const gradeStyle = GRADE_STYLES[report.overallGrade] || GRADE_STYLES.F;

    return (
        <div className="h-full flex flex-col gap-4">
            {/* 子视图切换 */}
            <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    {[
                        { key: 'report' as const, label: '综合报告', icon: 'fa-clipboard-check' },
                        { key: 'decay' as const, label: '衰减拟合', icon: 'fa-chart-line' },
                        { key: 'phase' as const, label: '相变检测', icon: 'fa-shuffle' },
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
            </div>

            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                {/* ---- 综合报告 ---- */}
                {activeView === 'report' && (
                    <div className="space-y-4">
                        {/* 评分卡片 */}
                        <div className={`p-6 rounded-2xl border-2 ${gradeStyle.bg} ${gradeStyle.border}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h5 className={`text-2xl font-black ${gradeStyle.text}`}>
                                        {gradeStyle.emoji} 稳定性等级: {report.overallGrade}
                                    </h5>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">
                                        Catalyst Stability Assessment
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-4xl font-black ${gradeStyle.text}`}>{report.overallScore.toFixed(0)}</span>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">综合评分</p>
                                </div>
                            </div>
                            <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{report.summary}</p>
                            <div className="mt-3 p-3 bg-white/60 rounded-xl">
                                <p className="text-[10px] font-medium text-slate-700 leading-relaxed">
                                    <i className="fa-solid fa-lightbulb mr-1"></i>
                                    <strong>建议：</strong> {report.recommendation}
                                </p>
                            </div>
                        </div>

                        {/* 峰衰减摘要卡片 */}
                        <div className="grid grid-cols-2 gap-4">
                            {report.peakDecays.map((decay, i) => (
                                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black">
                                            {decay.peakCenter} cm⁻¹
                                        </span>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${decay.fitType === 'stable' ? 'bg-emerald-50 text-emerald-600' :
                                                decay.fitType === 'linear' ? 'bg-amber-50 text-amber-600' :
                                                    'bg-rose-50 text-rose-600'
                                            }`}>{decay.fitType}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">保持率</span>
                                            <p className={`text-lg font-black ${decay.retentionPercent >= 80 ? 'text-emerald-600' : decay.retentionPercent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                {decay.retentionPercent.toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">半衰期</span>
                                            <p className="text-lg font-black text-indigo-600">
                                                {decay.halfLife === Infinity ? '∞' : decay.halfLife < 60 ? `${decay.halfLife.toFixed(0)} min` : `${(decay.halfLife / 60).toFixed(1)} h`}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">衰减速率</span>
                                            <p className="text-sm font-black text-slate-700">{decay.decayRate.toFixed(1)} %/h</p>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">拟合 R²</span>
                                            <p className="text-sm font-black text-slate-700">{decay.fitR2.toFixed(3)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 相变事件 */}
                        {report.phaseTransitions.length > 0 && (
                            <div className="space-y-2">
                                <h6 className="text-[10px] font-black text-slate-500 uppercase">
                                    <i className="fa-solid fa-shuffle mr-1"></i>
                                    检测到的结构变化事件 ({report.phaseTransitions.length})
                                </h6>
                                {report.phaseTransitions.map((pt, i) => (
                                    <div key={i} className={`p-4 rounded-xl border text-[10px] font-medium ${pt.severity === 'critical' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                            pt.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                'bg-sky-50 border-sky-200 text-sky-700'
                                        }`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${pt.severity === 'critical' ? 'bg-rose-200' : pt.severity === 'warning' ? 'bg-amber-200' : 'bg-sky-200'
                                                }`}>{pt.severity}</span>
                                            <span className="font-black">{pt.fromPhase} → {pt.toPhase}</span>
                                        </div>
                                        <p>{pt.description}</p>
                                        <p className="text-[9px] mt-1 opacity-70">证据: {pt.evidence}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ---- 衰减拟合曲线 ---- */}
                {activeView === 'decay' && (
                    <div className="h-full space-y-4">
                        {report.peakDecays.map((decay, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                <h6 className="text-[10px] font-black text-slate-500 uppercase mb-3">
                                    <i className="fa-solid fa-chart-line mr-1"></i>
                                    {decay.peakCenter} cm⁻¹ 衰减拟合 (I(t) = I₀·exp(-kt) + C)
                                </h6>
                                <ResponsiveContainer width="100%" height={220}>
                                    <ComposedChart data={decay.timePoints} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="time" fontSize={9} tick={{ fill: '#64748b' }}
                                            label={{ value: 'Time (min)', position: 'insideBottom', offset: -5, fontSize: 9, fontWeight: 'bold' }} />
                                        <YAxis fontSize={9} tick={{ fill: '#64748b' }}
                                            label={{ value: 'Intensity (a.u.)', angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 'bold' }} />
                                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', fontSize: '9px' }} />
                                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                                        <Scatter dataKey="intensity" fill="#6366f1" name="实验值" />
                                        <Line type="monotone" dataKey="fitted" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 3" dot={false} name="拟合曲线" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                                <div className="flex gap-4 mt-2 px-2">
                                    <span className="text-[9px] text-slate-500">
                                        半衰期: <strong className="text-indigo-600">{decay.halfLife === Infinity ? '∞' : `${decay.halfLife.toFixed(0)} min`}</strong>
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                        R²: <strong className="text-indigo-600">{decay.fitR2.toFixed(3)}</strong>
                                    </span>
                                    <span className="text-[9px] text-slate-500">
                                        保持率: <strong className={decay.retentionPercent >= 80 ? 'text-emerald-600' : 'text-amber-600'}>{decay.retentionPercent.toFixed(1)}%</strong>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ---- 相变检测详情 ---- */}
                {activeView === 'phase' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <span className="text-[10px] font-black text-indigo-700">
                                <i className="fa-solid fa-info-circle mr-1"></i>
                                相变检测基于拉曼特征峰的突变分析。监测尖晶石 Co₃O₄ (A1g ~690 cm⁻¹) 和层状 CoOOH (~500 cm⁻¹) 的信号演变。
                            </span>
                        </div>
                        {report.phaseTransitions.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <i className="fa-solid fa-circle-check text-4xl text-emerald-300 mb-4 block"></i>
                                <p className="text-[10px] font-black uppercase">未检测到显著相变事件</p>
                                <p className="text-[9px] mt-1">催化剂在测试时间范围内保持了结构完整性</p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* 时间轴 */}
                                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200"></div>
                                {report.phaseTransitions.map((pt, i) => (
                                    <div key={i} className="relative pl-16 pb-6">
                                        <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-black ${pt.severity === 'critical' ? 'bg-rose-500 border-rose-600 text-white' :
                                                pt.severity === 'warning' ? 'bg-amber-400 border-amber-500 text-white' :
                                                    'bg-sky-400 border-sky-500 text-white'
                                            }`}>{i + 1}</div>
                                        <div className={`p-4 rounded-xl border ${pt.severity === 'critical' ? 'bg-rose-50 border-rose-200' :
                                                pt.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                                                    'bg-sky-50 border-sky-200'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[9px] font-black text-slate-500">
                                                    <i className="fa-solid fa-clock mr-1"></i>
                                                    {pt.detectedTime} min
                                                </span>
                                                <span className="text-[10px] font-black text-slate-700">
                                                    {pt.fromPhase} → {pt.toPhase}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-600 font-medium">{pt.description}</p>
                                            <p className="text-[9px] text-slate-400 mt-1 italic">证据: {pt.evidence}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StabilityDecayPanel;
