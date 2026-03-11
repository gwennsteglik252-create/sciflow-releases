
import React from 'react';
import { AnalysisResult, EngineMode, ElectroRecord, CompareSample, SensitivityCell, COMPARE_COLORS } from './types';
import { ResearchProject } from '../../../types';
import FolderLibraryView from '../../Characterization/FolderLibraryView';

interface ElectroResultPanelProps {
    activeMode: EngineMode;
    analysisResult: AnalysisResult | null;
    aiConclusion: string | null;
    aiDeepAnalysis: string | null;
    isDeepAnalysing: boolean;
    setSaveStep: (step: 'selecting') => void;
    handleExport: (fmt: 'csv' | 'json') => void;
    onExportPDF: () => void;
    saveStep: 'idle' | 'selecting';
    // --- 新增 ---
    sensitivityGrid: SensitivityCell[];
    savedRecords: ElectroRecord[];
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    showSaveModal: boolean;
    setShowSaveModal: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    currentRecordId: string | null;
    handleSaveRecord: () => void;
    handleLoadRecord: (record: ElectroRecord) => void;
    handleDeleteRecord: (id: string) => void;
    compareSampleIds: string[];
    toggleCompareSample: (id: string) => void;
    compareSamples: CompareSample[];
    // --- 归档位置 ---
    saveMilestoneId: string;
    setSaveMilestoneId: (v: string) => void;
    saveLogId: string;
    setSaveLogId: (v: string) => void;
    projects: ResearchProject[];
    selectedProjectId: string;
}

const MetricCard: React.FC<{
    label: string; value: string | number; unit?: string;
    highlight?: boolean; color?: string;
}> = ({ label, value, unit, highlight, color }) => (
    <div className={`p-3 rounded-[1.2rem] border text-center shadow-sm hover:shadow-md transition-all ${highlight
        ? `bg-${color || 'indigo'}-50/50 border-${color || 'indigo'}-100`
        : 'bg-slate-50 border-slate-100'
        }`}>
        <p className={`text-[7px] uppercase font-black mb-0.5 tracking-widest ${highlight ? `text-${color || 'indigo'}-400` : 'text-slate-400'
            }`}>{label}</p>
        <p className={`text-base font-black italic font-mono tracking-tighter ${highlight ? `text-${color || 'indigo'}-700` : 'text-slate-700'
            }`}>
            {value}
            {unit && <span className="text-[8px] text-slate-300 not-italic uppercase ml-0.5">{unit}</span>}
        </p>
    </div>
);


export const ElectroResultPanel: React.FC<ElectroResultPanelProps> = ({
    activeMode, analysisResult, aiConclusion, aiDeepAnalysis, isDeepAnalysing, setSaveStep, handleExport, onExportPDF, saveStep,
    sensitivityGrid, savedRecords, showLibrary, setShowLibrary, showSaveModal, setShowSaveModal,
    saveTitle, setSaveTitle, currentRecordId, handleSaveRecord, handleLoadRecord, handleDeleteRecord,
    compareSampleIds, toggleCompareSample, compareSamples,
    saveMilestoneId, setSaveMilestoneId, saveLogId, setSaveLogId, projects, selectedProjectId
}) => {
    if (!analysisResult) return null;

    return (
        <div className="flex flex-col gap-4">
            {/* 主要指标面板 */}
            <div className="bg-white border-2 border-indigo-500/20 shadow-2xl p-5 lg:p-6 rounded-[2.5rem] animate-reveal border-l-[10px] border-l-indigo-600 flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
                    <i className="fa-solid fa-microscope text-8xl"></i>
                </div>

                <section className="relative z-10">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2rem] italic">分析矩阵 (METRICS)</h4>
                        <span className="text-[7px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">Auto Audit</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        {activeMode === 'ECSA' && (
                            <>
                                <div className="col-span-2 p-3 bg-indigo-50/50 rounded-[1.2rem] border border-indigo-100 flex justify-between items-end shadow-inner group hover:bg-white hover:border-indigo-300 transition-all">
                                    <span className="text-[8px] text-indigo-400 uppercase font-black tracking-widest">Cdl 双层电容</span>
                                    <span className="text-lg font-black text-indigo-900 italic font-mono tracking-tighter">{analysisResult.cdl} <span className="text-[8px] text-indigo-400 not-italic uppercase ml-0.5">mF</span></span>
                                </div>
                                <MetricCard label="ECSA 活性面积" value={analysisResult.ecsa || '-'} unit="cm²" highlight color="emerald" />
                                <MetricCard label="Rf 粗糙度因子" value={analysisResult.roughnessFactor || '-'} highlight color="violet" />
                            </>
                        )}
                        {activeMode === 'RDE' && (
                            <>
                                <div className="col-span-2 p-3 bg-emerald-50/50 rounded-[1.2rem] border border-emerald-100 flex justify-between items-center shadow-inner">
                                    <span className="text-[8px] text-emerald-700 uppercase font-black tracking-widest italic">转移电子数 (n)</span>
                                    <span className="text-xl font-black text-emerald-600 italic font-mono tracking-tighter">{analysisResult.electronTransferNum}</span>
                                </div>
                                <MetricCard label="jk 动力学电流" value={analysisResult.kineticCurrent || '-'} unit="mA" />
                                <MetricCard label="K-L R²" value={analysisResult.klR2 || '-'} highlight color="indigo" />
                                <MetricCard label="K-L 斜率" value={analysisResult.klSlope || '-'} />
                                <MetricCard label="K-L 截距" value={analysisResult.klIntercept || '-'} />
                            </>
                        )}
                        {activeMode === 'EIS' && (
                            <>
                                <MetricCard label="Rs 溶液电阻" value={analysisResult.rs || '-'} unit="Ω" />
                                <MetricCard label="Rct 转移电阻" value={analysisResult.rct || '-'} unit="Ω" highlight color="rose" />
                                <MetricCard label="CPE (mF)" value={analysisResult.cpe || '-'} />
                                {analysisResult.warburgCoeff && (
                                    <MetricCard label="Warburg" value={analysisResult.warburgCoeff} highlight color="amber" />
                                )}
                            </>
                        )}
                        {activeMode === 'OER' && (
                            <>
                                <div className="col-span-2 p-3 bg-orange-50/50 rounded-[1.2rem] border border-orange-100 flex justify-between items-center shadow-inner">
                                    <span className="text-[8px] text-orange-700 uppercase font-black tracking-widest italic">过电位 η@10 mA/cm²</span>
                                    <span className="text-xl font-black text-orange-600 italic font-mono tracking-tighter">{analysisResult.oerOverpotential || '-'} <span className="text-[8px] text-orange-400 not-italic uppercase ml-0.5">mV</span></span>
                                </div>
                                {analysisResult.oerOnsetPotential !== undefined && (
                                    <MetricCard label="OER Onset" value={analysisResult.oerOnsetPotential} unit="V" highlight color="orange" />
                                )}
                                {analysisResult.oerTafelSlope !== undefined && (
                                    <MetricCard label="OER Tafel" value={analysisResult.oerTafelSlope} unit="mV/dec" highlight color="amber" />
                                )}
                                {analysisResult.oerMassActivity !== undefined && (
                                    <MetricCard label="质量活性 @1.6V" value={analysisResult.oerMassActivity} unit="mA/mg" />
                                )}
                                {analysisResult.oerTafelFit && (
                                    <MetricCard label="R²" value={analysisResult.oerTafelFit.r2} highlight color="emerald" />
                                )}
                            </>
                        )}
                        {(activeMode === 'LSV' || activeMode === 'CV') && (
                            <>
                                {analysisResult.halfWavePotential !== undefined && (
                                    <MetricCard label="E₁/₂ 半波电位" value={analysisResult.halfWavePotential} unit="V" highlight color="indigo" />
                                )}
                                {analysisResult.onsetPotential !== undefined && (
                                    <MetricCard label="起始电位" value={analysisResult.onsetPotential} unit="V" highlight color="emerald" />
                                )}
                                {analysisResult.tafelSlope !== undefined && (
                                    <MetricCard label="Tafel 斜率" value={analysisResult.tafelSlope} unit="mV/dec" highlight color="violet" />
                                )}
                                {analysisResult.limitingCurrent !== undefined && (
                                    <div className="col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center shadow-inner">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.1rem] block mb-0.5">Limiting Current Density</span>
                                        <p className="text-[10px] text-slate-600 font-black font-mono italic">{analysisResult.limitingCurrent} mA/cm²</p>
                                    </div>
                                )}
                                {analysisResult.massActivity !== undefined && (
                                    <MetricCard label="质量活性 @0.9V" value={analysisResult.massActivity} unit="mA/mg" />
                                )}
                                {analysisResult.peakAnodic && (
                                    <>
                                        <MetricCard label="阳极峰电位" value={analysisResult.peakAnodic.v} unit="V" />
                                        <MetricCard label="阴极峰电位" value={analysisResult.peakCathodic?.v || '-'} unit="V" />
                                    </>
                                )}
                                {analysisResult.peakSeparation !== undefined && (
                                    <MetricCard label="ΔEp 峰电位差" value={analysisResult.peakSeparation} unit="V" />
                                )}
                                {analysisResult.anodicCathodicRatio !== undefined && (
                                    <MetricCard label="|Ipa/Ipc|" value={analysisResult.anodicCathodicRatio} />
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Tafel 拟合质量卡片 */}
                {analysisResult.tafelFit && (
                    <section className="relative z-10 animate-reveal">
                        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-[1.5rem] p-4 border border-violet-100">
                            <h5 className="text-[8px] font-black text-violet-600 uppercase tracking-[0.2rem] mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-chart-line"></i> Tafel 拟合质量
                            </h5>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white/80 p-2 rounded-xl text-center border border-white shadow-sm">
                                    <p className="text-[7px] font-black text-violet-400 uppercase">斜率</p>
                                    <p className="text-sm font-black text-violet-700 font-mono">{analysisResult.tafelFit.slope} <span className="text-[7px] text-violet-300">mV/dec</span></p>
                                </div>
                                <div className="bg-white/80 p-2 rounded-xl text-center border border-white shadow-sm">
                                    <p className="text-[7px] font-black text-violet-400 uppercase">R²</p>
                                    <p className={`text-sm font-black font-mono ${analysisResult.tafelFit.r2 > 0.99 ? 'text-emerald-600' : analysisResult.tafelFit.r2 > 0.97 ? 'text-violet-700' : 'text-amber-600'}`}>
                                        {analysisResult.tafelFit.r2}
                                    </p>
                                </div>
                                <div className="bg-white/80 p-2 rounded-xl text-center border border-white shadow-sm">
                                    <p className="text-[7px] font-black text-violet-400 uppercase">j₀</p>
                                    <p className="text-sm font-black text-violet-700 font-mono">{analysisResult.tafelFit.exchangeCurrentDensity}</p>
                                </div>
                            </div>
                            <div className="mt-2 flex items-center justify-center gap-2">
                                <span className="text-[7px] font-bold text-violet-400">区间: η = {analysisResult.tafelFit.fitRange.min}~{analysisResult.tafelFit.fitRange.max} V</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* AI 结论 */}
                {aiConclusion && (
                    <section className="relative z-10">
                        <div className="bg-slate-900 rounded-[1.8rem] p-4 text-white shadow-2xl relative overflow-hidden group/insight border border-white/5">
                            <h5 className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2rem] mb-2 flex items-center gap-2">
                                <i className="fa-solid fa-wand-magic-sparkles animate-pulse text-[10px]"></i> 智能机理推演结论
                            </h5>
                            <p className="text-[9.5px] font-medium text-slate-100 leading-relaxed italic text-justify opacity-90 line-clamp-3 group-hover/insight:line-clamp-none transition-all">
                                {aiConclusion}
                            </p>
                        </div>
                    </section>
                )}

                {(isDeepAnalysing || aiDeepAnalysis) && (
                    <section className="relative z-10">
                        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-[1.6rem] p-4 border border-indigo-100 shadow-inner">
                            <h5 className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.18rem] mb-2 flex items-center gap-2">
                                <i className={`fa-solid ${isDeepAnalysing ? 'fa-spinner animate-spin' : 'fa-brain'} text-[10px]`}></i>
                                关联实验上下文 AI 深析
                            </h5>
                            {isDeepAnalysing ? (
                                <p className="text-[9px] font-bold text-indigo-500">正在结合关联实验记录生成深度分析...</p>
                            ) : (
                                <p className="text-[9.5px] leading-relaxed text-slate-700 whitespace-pre-wrap">{aiDeepAnalysis}</p>
                            )}
                        </div>
                    </section>
                )}

                {/* 操作按钮 */}
                {saveStep === 'idle' && (
                    <footer className="relative z-10 flex flex-col gap-2.5 mt-1">
                        <div className="grid grid-cols-2 gap-2.5">
                            <button onClick={() => handleExport('csv')} className="py-2.5 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-white hover:border-slate-300 transition-all border border-slate-100 shadow-sm flex items-center justify-center gap-2">
                                <i className="fa-solid fa-file-csv text-emerald-500"></i> CSV
                            </button>
                            <button
                                onClick={onExportPDF}
                                className="py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-file-pdf text-rose-400"></i> PDF 报告
                            </button>
                        </div>
                    </footer>
                )}
            </div>

            {/* 敏感度分析热图 */}
            {sensitivityGrid.length > 0 && (activeMode === 'LSV' || activeMode === 'CV') && (
                <div className="bg-white border border-slate-200 shadow-xl p-5 rounded-[2.5rem] animate-reveal">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2rem] mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-table-cells-large text-violet-500"></i> Tafel 拟合敏感度分析
                    </h4>
                    <div className="overflow-x-auto">
                        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(8, Math.ceil(Math.sqrt(sensitivityGrid.length)))}, 1fr)` }}>
                            {sensitivityGrid.slice(0, 36).map((cell, i) => {
                                const r2Norm = Math.max(0, Math.min(1, (cell.r2 - 0.9) / 0.1));
                                const bg = r2Norm > 0.8 ? 'bg-emerald-100 border-emerald-200'
                                    : r2Norm > 0.5 ? 'bg-indigo-50 border-indigo-100'
                                        : r2Norm > 0.2 ? 'bg-amber-50 border-amber-100'
                                            : 'bg-slate-50 border-slate-100';
                                return (
                                    <div key={i} className={`p-1.5 rounded-lg border text-center ${bg} hover:scale-110 transition-transform cursor-default`}
                                        title={`η: ${cell.min}–${cell.max} V | Tafel: ${cell.tafelSlope} mV/dec | R²: ${cell.r2}`}
                                    >
                                        <p className="text-[6px] font-black text-slate-400">{cell.min}-{cell.max}</p>
                                        <p className="text-[8px] font-black text-slate-700 font-mono">{cell.tafelSlope}</p>
                                        <p className="text-[6px] font-mono text-slate-400">{cell.r2}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-[7px] text-slate-400 italic mt-2 text-center">η区间 vs Tafel斜率 (mV/dec) vs R² · 绿色=高置信度</p>
                </div>
            )}

            {/* 样品对比叠加区域 */}
            {compareSamples.length > 1 && (
                <div className="bg-white border border-slate-200 shadow-xl p-5 rounded-[2.5rem] animate-reveal">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2rem] mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-layer-group text-indigo-500"></i> 样品对比 ({compareSamples.length}/{6})
                    </h4>

                    {/* 指标对比表格 */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-[8px]">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left font-black text-slate-400 uppercase py-2 px-2">样品</th>
                                    {compareSamples[0]?.result.halfWavePotential !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">E₁/₂</th>}
                                    {compareSamples[0]?.result.tafelSlope !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">Tafel</th>}
                                    {compareSamples[0]?.result.limitingCurrent !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">jL</th>}
                                    {compareSamples[0]?.result.electronTransferNum !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">n</th>}
                                    {compareSamples[0]?.result.cdl !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">Cdl</th>}
                                    {compareSamples[0]?.result.ecsa !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">ECSA</th>}
                                    {compareSamples[0]?.result.rs !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">Rs</th>}
                                    {compareSamples[0]?.result.rct !== undefined && <th className="text-center font-black text-slate-400 uppercase py-2">Rct</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {compareSamples.map((sample) => (
                                    <tr key={sample.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="py-2 px-2">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sample.color }}></div>
                                                <span className="font-black text-slate-700 truncate max-w-[80px]">{sample.title}</span>
                                            </div>
                                        </td>
                                        {sample.result.halfWavePotential !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.halfWavePotential}</td>}
                                        {sample.result.tafelSlope !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.tafelSlope}</td>}
                                        {sample.result.limitingCurrent !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.limitingCurrent}</td>}
                                        {sample.result.electronTransferNum !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.electronTransferNum}</td>}
                                        {sample.result.cdl !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.cdl}</td>}
                                        {sample.result.ecsa !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.ecsa}</td>}
                                        {sample.result.rs !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.rs}</td>}
                                        {sample.result.rct !== undefined && <td className="text-center font-mono font-black text-slate-600">{sample.result.rct}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
