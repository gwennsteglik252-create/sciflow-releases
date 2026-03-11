/**
 * MechanismPanel.tsx
 * 反应中间体归属 + AEM/LOM 机理路径判别面板
 */
import React, { useState, useMemo } from 'react';
import {
    INTERMEDIATE_DATABASE, matchPeaksToIntermediates, IntermediateEntry, PeakAssignment,
} from './intermediateFingerprints';
import { determinePathway, PathwayResult, PathwayStep } from './mechanismPathway';
import { autoDetectPeaks, extractVoltageKeys, SpectrumDataPoint } from './spectroscopyAnalysis';

interface Props {
    dataset: SpectrumDataPoint[];
}

// ==================== 路径示意图 SVG ====================
const PathwayDiagram: React.FC<{ steps: PathwayStep[]; pathway: string }> = ({ steps, pathway }) => {
    const w = 600, h = 100;
    const stepW = w / steps.length;

    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
            {steps.map((step, i) => {
                const x = i * stepW + stepW / 2;
                const y = 50;
                return (
                    <g key={i}>
                        {/* 连接线 */}
                        {i < steps.length - 1 && (
                            <line x1={x + 40} y1={y} x2={(i + 1) * stepW + stepW / 2 - 40} y2={y} stroke="#cbd5e1" strokeWidth={2} markerEnd="url(#arrow)" />
                        )}
                        {/* 步骤圆圈 */}
                        <circle cx={x} cy={y} r={28} fill={step.isActive ? '#6366f1' : '#f1f5f9'} stroke={step.isActive ? '#4338ca' : '#e2e8f0'} strokeWidth={2} />
                        <text x={x} y={y - 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={step.isActive ? '#fff' : '#94a3b8'}>
                            Step {step.step}
                        </text>
                        <text x={x} y={y + 10} textAnchor="middle" fontSize={7} fill={step.isActive ? '#e0e7ff' : '#cbd5e1'}>
                            {step.label}
                        </text>
                        {/* 活性标记 */}
                        {step.isActive && (
                            <circle cx={x + 22} cy={y - 22} r={6} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
                        )}
                    </g>
                );
            })}
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth={6} markerHeight={6} orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
                </marker>
            </defs>
        </svg>
    );
};

// ==================== 主面板 ====================
const MechanismPanel: React.FC<Props> = ({ dataset }) => {
    const [activeTab, setActiveTab] = useState<'assignment' | 'pathway' | 'library'>('assignment');
    const [searchTerm, setSearchTerm] = useState('');
    const voltageKeys = useMemo(() => extractVoltageKeys(dataset), [dataset]);

    // 自动检测峰位（使用最高电位的谱）
    const detectedPeaks = useMemo(() => {
        if (voltageKeys.length === 0) return [];
        return autoDetectPeaks(dataset, voltageKeys[voltageKeys.length - 1]);
    }, [dataset, voltageKeys]);

    // 峰归属
    const assignments = useMemo(() => matchPeaksToIntermediates(detectedPeaks), [detectedPeaks]);

    // 机理判别
    const pathwayResult = useMemo(() => determinePathway(dataset, detectedPeaks), [dataset, detectedPeaks]);

    // 搜索过滤的指纹库
    const filteredLibrary = useMemo(() => {
        if (!searchTerm.trim()) return INTERMEDIATE_DATABASE;
        const term = searchTerm.toLowerCase();
        return INTERMEDIATE_DATABASE.filter(e =>
            e.species.toLowerCase().includes(term) ||
            e.name.toLowerCase().includes(term) ||
            e.vibrationMode.toLowerCase().includes(term)
        );
    }, [searchTerm]);

    if (dataset.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-dna text-4xl"></i>
                <p className="text-[10px] font-black uppercase">请先加载原位光谱数据</p>
            </div>
        );
    }

    const pathwayColors: Record<string, string> = {
        AEM: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        LOM: 'text-amber-600 bg-amber-50 border-amber-200',
        Mixed: 'text-purple-600 bg-purple-50 border-purple-200',
        Undetermined: 'text-slate-500 bg-slate-50 border-slate-200',
    };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Tab 切换 */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0 self-start">
                {[
                    { key: 'assignment' as const, label: '峰归属', icon: 'fa-tags' },
                    { key: 'pathway' as const, label: 'AEM/LOM 判别', icon: 'fa-route' },
                    { key: 'library' as const, label: '指纹库', icon: 'fa-book' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setActiveTab(t.key)}
                        className={`px-4 py-2 rounded-md text-[9px] font-black uppercase transition-all ${activeTab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <i className={`fa-solid ${t.icon} mr-1`}></i>{t.label}
                    </button>
                ))}
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                {/* ---- 峰归属 ---- */}
                {activeTab === 'assignment' && (
                    <div className="space-y-4">
                        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <span className="text-[9px] font-black text-emerald-600 uppercase">
                                <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                                自动检测到 {detectedPeaks.length} 个特征峰
                            </span>
                        </div>

                        {assignments.map((a, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black">
                                        {a.peakCenter} cm⁻¹
                                    </span>
                                    {a.matchedEntries.length > 0 ? (
                                        <span className="text-[10px] font-black text-emerald-600">
                                            <i className="fa-solid fa-check-circle mr-1"></i>
                                            {a.matchedEntries[0].entry.species} ({a.matchedEntries[0].entry.name})
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-400 italic">未匹配</span>
                                    )}
                                </div>
                                {a.matchedEntries.slice(0, 3).map((m, j) => (
                                    <div key={j} className={`flex items-center gap-4 px-3 py-2 rounded-lg mb-1 ${j === 0 ? 'bg-indigo-50/50' : 'bg-slate-50/50'}`}>
                                        <span className="text-[10px] font-bold text-slate-700 w-24">{m.entry.species}</span>
                                        <span className="text-[9px] text-slate-500 flex-1">{m.entry.vibrationMode}</span>
                                        <span className="text-[9px] text-slate-400">{m.entry.ramanRange[0]}–{m.entry.ramanRange[1]} cm⁻¹</span>
                                        <div className="w-20">
                                            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${m.confidence > 0.7 ? 'bg-emerald-500' : m.confidence > 0.4 ? 'bg-amber-500' : 'bg-rose-400'}`}
                                                    style={{ width: `${m.confidence * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[8px] font-bold text-slate-400 mt-0.5 block text-right">{(m.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* ---- AEM/LOM 判别 ---- */}
                {activeTab === 'pathway' && (
                    <div className="space-y-5">
                        {/* 结论卡片 */}
                        <div className={`p-6 rounded-2xl border-2 ${pathwayColors[pathwayResult.pathway]}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h5 className="text-lg font-black uppercase">{pathwayResult.pathway}</h5>
                                    <p className="text-[10px] font-bold mt-1 opacity-70">
                                        {pathwayResult.pathway === 'AEM' ? 'Adsorbate Evolution Mechanism' :
                                            pathwayResult.pathway === 'LOM' ? 'Lattice Oxygen Mechanism' :
                                                pathwayResult.pathway === 'Mixed' ? 'AEM/LOM 混合路径' : '证据不足'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-black">{pathwayResult.confidence.toFixed(0)}%</span>
                                    <p className="text-[9px] font-bold uppercase opacity-60">置信度</p>
                                </div>
                            </div>

                            {/* 评分对比 */}
                            <div className="flex gap-4 mb-4">
                                <div className="flex-1 bg-white/60 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-black uppercase text-indigo-600">AEM Score</span>
                                        <span className="text-sm font-black text-indigo-600">{pathwayResult.aemScore.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${Math.min(100, pathwayResult.aemScore)}%` }} />
                                    </div>
                                </div>
                                <div className="flex-1 bg-white/60 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-black uppercase text-amber-600">LOM Score</span>
                                        <span className="text-sm font-black text-amber-600">{pathwayResult.lomScore.toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(100, pathwayResult.lomScore)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 路径示意图 */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                            <h6 className="text-[10px] font-black text-slate-500 uppercase mb-4">
                                <i className="fa-solid fa-diagram-project mr-1"></i>
                                {pathwayResult.pathway === 'LOM' ? 'LOM' : 'AEM'} 反应路径步骤
                            </h6>
                            <PathwayDiagram steps={pathwayResult.diagramSteps} pathway={pathwayResult.pathway} />
                            <div className="flex gap-4 mt-4 justify-center">
                                <span className="flex items-center gap-1.5 text-[9px] text-slate-500">
                                    <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block"></span> 有光谱证据
                                </span>
                                <span className="flex items-center gap-1.5 text-[9px] text-slate-500">
                                    <span className="w-3 h-3 rounded-full bg-slate-100 border border-slate-200 inline-block"></span> 待验证
                                </span>
                            </div>
                        </div>

                        {/* 证据列表 */}
                        <div className="space-y-2">
                            <h6 className="text-[10px] font-black text-slate-500 uppercase px-1">
                                <i className="fa-solid fa-list-check mr-1"></i> 光谱证据 ({pathwayResult.evidences.length})
                            </h6>
                            {pathwayResult.evidences.map((ev, i) => (
                                <div key={i} className={`p-4 rounded-xl border text-[10px] font-medium leading-relaxed ${ev.type === 'supports_AEM' ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700' :
                                        ev.type === 'supports_LOM' ? 'bg-amber-50/50 border-amber-100 text-amber-700' :
                                            'bg-slate-50 border-slate-100 text-slate-600'
                                    }`}>
                                    <span className={`text-[8px] font-black uppercase mr-2 px-2 py-0.5 rounded ${ev.type === 'supports_AEM' ? 'bg-indigo-200 text-indigo-700' :
                                            ev.type === 'supports_LOM' ? 'bg-amber-200 text-amber-700' :
                                                'bg-slate-200 text-slate-600'
                                        }`}>
                                        {ev.type === 'supports_AEM' ? 'AEM' : ev.type === 'supports_LOM' ? 'LOM' : '—'}
                                    </span>
                                    {ev.description}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ---- 指纹库 ---- */}
                {activeTab === 'library' && (
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="搜索中间体 (如: *OH, CoOOH, 伸缩振动...)"
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-400"
                        />
                        <div className="space-y-2">
                            {filteredLibrary.map(entry => (
                                <div key={entry.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:border-indigo-200 transition-all">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="px-2 py-1 bg-indigo-600 text-white rounded text-[9px] font-black">{entry.species}</span>
                                        <span className="text-[10px] font-bold text-slate-700">{entry.name}</span>
                                        <span className={`ml-auto px-2 py-0.5 rounded text-[8px] font-black uppercase ${entry.relevance === 'OER' ? 'bg-rose-50 text-rose-500' :
                                                entry.relevance === 'ORR' ? 'bg-blue-50 text-blue-500' :
                                                    'bg-purple-50 text-purple-500'
                                            }`}>{entry.relevance}</span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${entry.category === 'intermediate' ? 'bg-emerald-50 text-emerald-500' :
                                                entry.category === 'oxide' ? 'bg-amber-50 text-amber-500' :
                                                    entry.category === 'hydroxide' ? 'bg-sky-50 text-sky-500' :
                                                        'bg-slate-50 text-slate-400'
                                            }`}>{entry.category}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mb-1">{entry.vibrationMode}</p>
                                    <div className="flex gap-3 text-[9px]">
                                        <span className="text-slate-400">Raman: <strong className="text-slate-600">{entry.ramanRange[0]}–{entry.ramanRange[1]} cm⁻¹</strong></span>
                                        {entry.irRange && <span className="text-slate-400">IR: <strong className="text-slate-600">{entry.irRange[0]}–{entry.irRange[1]} cm⁻¹</strong></span>}
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">{entry.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MechanismPanel;
