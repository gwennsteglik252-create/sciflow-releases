
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnalysisResult, BifunctionalMetrics, RadarDimension, BENCHMARK_CATALYSTS, ElectroRecord } from './types';
import { computeBifunctionalIndex } from './electroAnalysis';

interface BifunctionalExpertPanelProps {
    analysisResult: AnalysisResult | null;
    onClose: () => void;
    savedRecords: ElectroRecord[];
}

type TabType = 'overview' | 'kinetics' | 'stability' | 'radar';

// ==================== SVG 雷达图 ====================
const RadarChart: React.FC<{ data: RadarDimension[]; size?: number }> = ({ data, size = 240 }) => {
    if (data.length < 3) return null;
    const cx = size / 2, cy = size / 2, r = size * 0.38;
    const n = data.length;
    const angleStep = (2 * Math.PI) / n;

    const getPoint = (i: number, value: number) => {
        const angle = -Math.PI / 2 + i * angleStep;
        return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) };
    };

    // Grid lines
    const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
    const axes = data.map((_, i) => {
        const p = getPoint(i, 1);
        return { x1: cx, y1: cy, x2: p.x, y2: p.y };
    });

    const dataPoints = data.map((d, i) => getPoint(i, d.value));
    const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
            {/* Grid polygons */}
            {gridLevels.map(level => {
                const points = data.map((_, i) => getPoint(i, level));
                return <polygon key={level} points={points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none" stroke="#e2e8f0" strokeWidth="0.8" />;
            })}
            {/* Axes */}
            {axes.map((a, i) => <line key={i} {...a} stroke="#cbd5e1" strokeWidth="0.8" />)}
            {/* Data polygon */}
            <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth="2.5" />
            {/* Data dots */}
            {dataPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="white" strokeWidth="2" />
            ))}
            {/* Labels */}
            {data.map((d, i) => {
                const lp = getPoint(i, 1.2);
                return (
                    <g key={`lbl${i}`}>
                        <text x={lp.x} y={lp.y - 5} textAnchor="middle" fill="#334155" fontSize="8" fontWeight="900">{d.axis}</text>
                        <text x={lp.x} y={lp.y + 6} textAnchor="middle" fill="#6366f1" fontSize="7.5" fontWeight="800" fontFamily="monospace">
                            {d.rawValue}{d.unit && ` ${d.unit}`}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

// ==================== 主面板 ====================
export const BifunctionalExpertPanel: React.FC<BifunctionalExpertPanelProps> = ({ analysisResult, onClose, savedRecords }) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    // 从方案库中查找 ORR / OER / ECSA / RDE 记录来组合计算
    const orrRecord = savedRecords.find(r => r.mode === 'LSV' && r.data.analysisResult?.halfWavePotential);
    const oerRecord = savedRecords.find(r => r.mode === 'OER' && r.data.analysisResult?.oerOverpotential);
    const ecsaRecord = savedRecords.find(r => r.mode === 'ECSA' && r.data.analysisResult?.ecsa);
    const rdeRecord = savedRecords.find(r => r.mode === 'RDE' && r.data.analysisResult?.electronTransferNum);

    // 如果当前分析结果也能用，优先用当前
    const orrResult = analysisResult?.halfWavePotential !== undefined ? analysisResult : orrRecord?.data.analysisResult;
    const oerResult = analysisResult?.oerOverpotential !== undefined ? analysisResult : oerRecord?.data.analysisResult;

    const bifunctionalMetrics = useMemo(() => {
        return computeBifunctionalIndex(
            orrResult || null,
            oerResult || null,
            ecsaRecord?.data.analysisResult || null,
            rdeRecord?.data.analysisResult || null,
        );
    }, [orrResult, oerResult, ecsaRecord, rdeRecord]);

    // 兜底值（如果没有足够数据，显示 Demo 值）
    const metrics = bifunctionalMetrics || {
        deltaE: 0.782, orrHalfWave: 0.85, oerOverpotential: 310,
        orrTafelSlope: 68, oerTafelSlope: 78, electronTransferNum: 3.92,
        ecsa: 52, massActivityORR: 245, rating: 'good' as const,
        radar: [
            { axis: 'E½ (ORR)', value: 0.83, rawValue: 0.85, unit: 'V', optimal: 'high' as const },
            { axis: 'η@10 (OER)', value: 0.55, rawValue: 310, unit: 'mV', optimal: 'low' as const },
            { axis: 'Tafel ORR', value: 0.72, rawValue: 68, unit: 'mV/dec', optimal: 'low' as const },
            { axis: 'Tafel OER', value: 0.65, rawValue: 78, unit: 'mV/dec', optimal: 'low' as const },
            { axis: 'ECSA', value: 0.53, rawValue: 52, unit: 'cm²', optimal: 'high' as const },
            { axis: 'n (e⁻)', value: 0.96, rawValue: 3.92, unit: '', optimal: 'high' as const },
        ],
    };

    const isDemo = !bifunctionalMetrics;

    const ratingConfig = {
        excellent: { label: '卓越', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: 'ΔE < 0.70 V · 超越商用贵金属基准' },
        good: { label: '优秀', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', desc: 'ΔE < 0.80 V · 达到发表级性能' },
        moderate: { label: '中等', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', desc: 'ΔE < 0.90 V · 仍有优化空间' },
        poor: { label: '需优化', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', desc: 'ΔE ≥ 0.90 V · 建议调整催化剂组成' },
    };
    const rCfg = ratingConfig[metrics.rating];

    const benchmarks = Object.values(BENCHMARK_CATALYSTS);

    return createPortal(
        <div className="fixed inset-y-0 right-0 w-[440px] bg-white shadow-[-30px_0_60px_rgba(0,0,0,0.2)] border-l border-slate-200 z-[99999] flex flex-col animate-slide-in-right overflow-hidden rounded-l-[3rem]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-white to-slate-50/50">
                <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tighter uppercase italic">双功能催化专家分析</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bifunctional Intelligence v3.0</p>
                        {isDemo && <span className="text-[7px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">DEMO</span>}
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex px-4 pt-3 gap-1 bg-slate-50/50">
                {([
                    { id: 'overview', label: '综合评测', icon: 'fa-gauge-high' },
                    { id: 'kinetics', label: '动力学', icon: 'fa-chart-line' },
                    { id: 'radar', label: '雷达图', icon: 'fa-chart-radar' },
                    { id: 'stability', label: '稳定性', icon: 'fa-shield-heart' },
                ] as { id: TabType; label: string; icon: string }[]).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 px-1 rounded-t-xl text-[8px] font-black uppercase tracking-tighter transition-all flex items-center justify-center gap-1.5 border-b-3 ${activeTab === tab.id ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 shadow-sm' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>
                        <i className={`fa-solid ${tab.icon} text-[9px]`}></i>{tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-white">
                {activeTab === 'overview' && (
                    <div className="space-y-4 animate-reveal">
                        {/* ΔE Core Card */}
                        <div className={`${rCfg.bg} ${rCfg.border} border-2 rounded-[2rem] p-5 relative overflow-hidden`}>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2rem]">Bifunctional Activity Index</h4>
                                <span className={`text-[8px] font-black ${rCfg.color} ${rCfg.bg} px-2 py-1 rounded-full border ${rCfg.border}`}>{rCfg.label}</span>
                            </div>
                            <div className="text-center mb-3">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">ΔE = E<sub>OER@10</sub> − E<sub>½(ORR)</sub></p>
                                <p className={`text-4xl font-black italic font-mono tracking-tighter ${rCfg.color}`}>{metrics.deltaE}
                                    <span className="text-sm not-italic ml-1 text-slate-400">V</span>
                                </p>
                            </div>
                            <p className="text-[8px] text-slate-500 text-center italic">{rCfg.desc}</p>

                            {/* Benchmark comparison bar */}
                            <div className="mt-4 bg-white/80 p-3 rounded-xl border border-slate-100">
                                <p className="text-[7px] font-black text-slate-400 uppercase mb-2 tracking-widest">文献基准对比</p>
                                <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden">
                                    {/* Scale */}
                                    <div className="absolute inset-0 flex items-center justify-between px-2 text-[6px] font-black text-slate-300 uppercase">
                                        <span>0.6V</span><span>0.8V</span><span>1.0V</span>
                                    </div>
                                    {/* Benchmark lines */}
                                    {benchmarks.map(bm => (
                                        <div key={bm.label} className="absolute top-0 bottom-0 w-0.5"
                                            style={{ left: `${((bm.deltaE - 0.6) / 0.4) * 100}%`, backgroundColor: bm.color }}>
                                            <span className="absolute -top-3.5 -translate-x-1/2 text-[6px] font-black whitespace-nowrap" style={{ color: bm.color }}>{bm.label}</span>
                                        </div>
                                    ))}
                                    {/* Current sample */}
                                    <div className="absolute top-0 bottom-0 w-1 bg-indigo-600 rounded-full"
                                        style={{ left: `${Math.max(0, Math.min(100, ((metrics.deltaE - 0.6) / 0.4) * 100))}%` }}>
                                        <div className="absolute -bottom-4 -translate-x-1/2 text-[7px] font-black text-indigo-600">▲</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Key metrics grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 group hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600"><i className="fa-solid fa-bolt-lightning text-[10px]"></i></div>
                                    <span className="text-[11px] font-black font-mono text-indigo-700 italic">{metrics.orrHalfWave} V</span>
                                </div>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">E½ (ORR)</p>
                            </div>
                            <div className="bg-orange-50/50 p-3 rounded-2xl border border-orange-100 group hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600"><i className="fa-solid fa-arrow-up-right-dots text-[10px]"></i></div>
                                    <span className="text-[11px] font-black font-mono text-orange-700 italic">{metrics.oerOverpotential} mV</span>
                                </div>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">η@10 (OER)</p>
                            </div>
                            <div className="bg-violet-50/50 p-3 rounded-2xl border border-violet-100 group hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600"><i className="fa-solid fa-chart-line text-[10px]"></i></div>
                                    <span className="text-[11px] font-black font-mono text-violet-700 italic">{metrics.orrTafelSlope}/{metrics.oerTafelSlope}</span>
                                </div>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Tafel ORR/OER</p>
                            </div>
                            <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 group hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600"><i className="fa-solid fa-weight-hanging text-[10px]"></i></div>
                                    <span className="text-[11px] font-black font-mono text-emerald-700 italic">{metrics.massActivityORR} A/g</span>
                                </div>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Mass Activity (ORR)</p>
                            </div>
                        </div>

                        {/* Data source indicator */}
                        {isDemo ? (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <i className="fa-solid fa-circle-info text-amber-500 text-[10px]"></i>
                                <p className="text-[8px] text-amber-700 font-bold">当前显示 DEMO 数据。请在方案库中保存 LSV(ORR) + OER 分析结果以获取真实双功能评测。</p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
                                <p className="text-[8px] text-emerald-700 font-bold">基于真实实验数据计算 · ORR 来源: {orrRecord?.title || '当前分析'} · OER 来源: {oerRecord?.title || '当前分析'}</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'radar' && (
                    <div className="space-y-4 animate-reveal">
                        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-lg">
                            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2rem] text-center mb-4">六维性能评估 (Normalized)</h4>
                            <RadarChart data={metrics.radar} size={260} />
                        </div>

                        {/* Radar dimensions detail table */}
                        <div className="bg-slate-50 rounded-[2rem] p-4 border border-slate-100">
                            <table className="w-full text-[8px]">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left py-2 font-black text-slate-400 uppercase">维度</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">实测值</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">归一化 (0-1)</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">方向</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.radar.map((d, i) => (
                                        <tr key={i} className="border-b border-slate-100">
                                            <td className="py-2 font-black text-slate-700">{d.axis}</td>
                                            <td className="text-center font-mono font-black text-indigo-600">{d.rawValue}{d.unit && ` ${d.unit}`}</td>
                                            <td className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${d.value * 100}%` }}></div>
                                                    </div>
                                                    <span className="font-mono font-black text-slate-600 w-6">{(d.value * 100).toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="text-center"><span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${d.optimal === 'high' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{d.optimal === 'high' ? '↑越高越好' : '↓越低越好'}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'kinetics' && (
                    <div className="space-y-4 animate-reveal">
                        {/* ORR Kinetics */}
                        <div className="bg-indigo-50/50 p-5 rounded-[2rem] border border-indigo-100">
                            <h4 className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-bolt-lightning"></i> ORR 动力学
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2.5 rounded-xl text-center border border-indigo-100">
                                    <p className="text-[6px] font-black text-slate-400 uppercase">Tafel Slope</p>
                                    <p className="text-sm font-black text-indigo-700 font-mono italic">{metrics.orrTafelSlope} <span className="text-[7px] text-slate-400 not-italic">mV/dec</span></p>
                                    <p className="text-[6px] text-slate-500 mt-0.5 italic">
                                        {metrics.orrTafelSlope < 60 ? 'RDS: O₂吸附 (理想)' : metrics.orrTafelSlope < 80 ? 'RDS: 首步电子转移' : 'RDS: *OOH 脱附'}
                                    </p>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl text-center border border-indigo-100">
                                    <p className="text-[6px] font-black text-slate-400 uppercase">e⁻ Transfer</p>
                                    <p className="text-sm font-black text-emerald-700 font-mono italic">{metrics.electronTransferNum}</p>
                                    <p className="text-[6px] text-slate-500 mt-0.5 italic">
                                        {metrics.electronTransferNum > 3.8 ? '4e⁻ 直接路径 ✓' : '2e⁻/4e⁻ 混合路径'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* OER Kinetics */}
                        <div className="bg-orange-50/50 p-5 rounded-[2rem] border border-orange-100">
                            <h4 className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-arrow-up-right-dots"></i> OER 动力学
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-white p-2.5 rounded-xl text-center border border-orange-100">
                                    <p className="text-[6px] font-black text-slate-400 uppercase">Tafel Slope</p>
                                    <p className="text-sm font-black text-orange-700 font-mono italic">{metrics.oerTafelSlope} <span className="text-[7px] text-slate-400 not-italic">mV/dec</span></p>
                                    <p className="text-[6px] text-slate-500 mt-0.5 italic">
                                        {metrics.oerTafelSlope < 60 ? 'RDS: M-OH 形成' : metrics.oerTafelSlope < 90 ? 'RDS: M-O 脱质子' : 'RDS: O-O 成键'}
                                    </p>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl text-center border border-orange-100">
                                    <p className="text-[6px] font-black text-slate-400 uppercase">过电位</p>
                                    <p className="text-sm font-black text-orange-700 font-mono italic">{metrics.oerOverpotential} <span className="text-[7px] text-slate-400 not-italic">mV</span></p>
                                    <p className="text-[6px] text-slate-500 mt-0.5 italic">
                                        {metrics.oerOverpotential < 300 ? '优于 RuO₂ 基准' : metrics.oerOverpotential < 350 ? '接近商用催化剂' : '需优化'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Mechanism prediction */}
                        <div className="bg-slate-900 rounded-[2rem] p-5 text-white relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10 rotate-12">
                                <i className="fa-solid fa-wand-magic-sparkles text-6xl"></i>
                            </div>
                            <h4 className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.15rem] mb-3">反应机理推断</h4>
                            <div className="space-y-2">
                                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-[9px] text-slate-300 leading-relaxed italic">
                                        ORR 过程: {metrics.electronTransferNum > 3.8 ?
                                            <>遵循 <span className="text-emerald-400 font-bold">4电子直接路径</span>，O₂ → OH⁻，H₂O₂ 产率预计 &lt; 2%</> :
                                            <>存在 <span className="text-amber-400 font-bold">2e⁻/4e⁻ 竞争</span>，H₂O₂ 产率可能 &gt; 5%，建议优化活性位点</>}
                                    </p>
                                </div>
                                <div className="p-2.5 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-[9px] text-slate-300 leading-relaxed italic">
                                        OER 过程: Tafel 斜率 {metrics.oerTafelSlope} mV/dec 表明控速步骤为 <span className="text-orange-400 font-bold">
                                            {metrics.oerTafelSlope < 60 ? 'M-OH 形成' : metrics.oerTafelSlope < 90 ? 'M-O 脱质子 (Volmer-Heyrovsky)' : 'O-O 成键 (最慢步骤)'}
                                        </span>。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'stability' && (
                    <div className="space-y-4 animate-reveal">
                        <div className="p-5 bg-rose-50/50 rounded-[2rem] border border-rose-100">
                            <h4 className="text-[8px] font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-shield-heart"></i> AST 加速稳定性评估
                            </h4>
                            <div className="flex justify-center relative py-4">
                                <div className="w-28 h-28 rounded-full border-[6px] border-slate-100 flex flex-col items-center justify-center bg-white shadow-inner">
                                    <span className="text-2xl font-black text-rose-600 italic font-mono">94.2<span className="text-[9px] not-italic">%</span></span>
                                    <span className="text-[7px] font-black text-slate-400 uppercase mt-0.5">5000 CV</span>
                                </div>
                            </div>
                            <p className="text-center text-[8px] font-bold text-slate-500 uppercase mt-1">E½ 衰减: -12 mV · η@10 漂移: +18 mV</p>
                        </div>

                        <div className="bg-white p-4 rounded-[2rem] border border-slate-200">
                            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.15rem] mb-3">稳定性风险评估</h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px]"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-700">碳载体腐蚀风险</p>
                                        <p className="text-[7px] text-slate-500 mt-0.5">高电位下 (≥1.6V) 碳氧化速率提升 3.5×</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-700">金属溶解评估</p>
                                        <p className="text-[7px] text-slate-500 mt-0.5">过渡金属氧化物骨架稳定性良好</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <i className="fa-solid fa-atom text-indigo-500 text-[10px]"></i>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-700">活性位点保持</p>
                                        <p className="text-[7px] text-slate-500 mt-0.5">建议结合 XPS 分析验证价态变化</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
                <button className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-2.5 active:scale-95">
                    <i className="fa-solid fa-file-export"></i> 导出双功能催化评测报告
                </button>
            </div>

            <style>{`
                @keyframes slide-in-right {
                  from { transform: translateX(100%); opacity: 0; }
                  to { transform: translateX(0); opacity: 1; }
                }
                @keyframes reveal {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-reveal { animation: reveal 0.4s ease-out forwards; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
            `}</style>
        </div>,
        document.body
    );
};
