import React, { RefObject } from 'react';
import { ResearchProject } from '../../../types';
import { EngineMode, ElectroQcReport, ElectroParams, FitRange, FitMode } from './types';
import LaTeXText from '../../Common/LaTeXText';

interface ElectroInputPanelProps {
    saveStep: 'idle' | 'selecting';
    setSaveStep: (step: 'idle' | 'selecting') => void;
    activeMode: EngineMode;
    rawData: string;
    setRawData: (data: string) => void;
    isAnalysing: boolean;
    handleRunAnalysis: () => void;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleExport: (fmt: 'csv' | 'json') => void;
    handleSaveToLog: () => void | Promise<void>;
    fileInputRef: RefObject<HTMLInputElement>;
    projects: ResearchProject[];
    targetProjectId: string;
    setTargetProjectId: (id: string) => void;
    targetMilestoneId: string;
    setTargetMilestoneId: (id: string) => void;
    targetLogId: string;
    setTargetLogId: (id: string) => void;
    pushToMatrix: boolean;
    setPushToMatrix: (val: boolean) => void;
    selectedMatrixId: string;
    setSelectedMatrixId: (id: string) => void;
    matrixSampleId: string;
    setMatrixSampleId: (id: string) => void;
    matrixNote: string;
    setMatrixNote: (note: string) => void;
    matrixParams: { key: string, value: string }[];
    setMatrixParams: (p: { key: string, value: string }[]) => void;
    matrixResults: { key: string, value: string }[];
    setMatrixResults: (p: { key: string, value: string }[]) => void;
    selectedProject?: ResearchProject;
    selectedMilestone?: any;
    // --- 新增 ---
    qcReport: ElectroQcReport | null;
    electroParams: ElectroParams;
    setElectroParams: (p: ElectroParams) => void;
    tafelFitRange: FitRange;
    setTafelFitRange: (r: FitRange) => void;
    tafelFitMode: FitMode;
    setTafelFitMode: (m: FitMode) => void;
    handleLoadFullFeatureDemo: () => void;
}

export const ElectroInputPanel: React.FC<ElectroInputPanelProps> = ({
    saveStep, setSaveStep, activeMode, rawData, setRawData, isAnalysing,
    handleRunAnalysis, handleFileUpload, handleExport, handleSaveToLog, fileInputRef,
    projects, targetProjectId, setTargetProjectId, targetMilestoneId, setTargetMilestoneId,
    targetLogId, setTargetLogId, pushToMatrix, setPushToMatrix, selectedMatrixId, setSelectedMatrixId,
    matrixSampleId, setMatrixSampleId, matrixParams, setMatrixParams, matrixResults, setMatrixResults,
    selectedProject, selectedMilestone,
    qcReport, electroParams, setElectroParams, tafelFitRange, setTafelFitRange, tafelFitMode, setTafelFitMode,
    handleLoadFullFeatureDemo
}) => {
    const [showParams, setShowParams] = React.useState(false);
    const [showQcDetails, setShowQcDetails] = React.useState(false);

    return (
        <div className="bg-white border border-slate-200 shadow-xl p-6 rounded-[2.5rem] flex flex-col gap-5 group">
            {/* 数据输入区 */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2rem] flex items-center gap-2">
                        <i className="fa-solid fa-file-import"></i> 原始数据注入
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={handleLoadFullFeatureDemo}
                            className="px-3 py-2 bg-amber-50 text-amber-600 rounded-xl text-[8px] font-black uppercase border border-amber-100 hover:bg-amber-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-flask-vial"></i> DEMO
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[8px] font-black uppercase border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-cloud-arrow-up"></i> CSV/TXT
                        </button>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv,.txt,.dat,.xy" />
                </div>
                <div className="relative group/textarea">
                    <textarea
                        className="w-full h-36 bg-slate-50 rounded-[1.5rem] p-5 text-xs font-mono text-emerald-700 outline-none border border-slate-200 focus:border-indigo-400 focus:bg-white transition-all resize-none shadow-inner custom-scrollbar leading-relaxed"
                        placeholder={`粘贴 ${activeMode} 数据点 (双列 X, Y)...\n支持 A, mA, V, Ohm 自动换算。\n\n例如：\n0.1, 0.005\n0.2, 0.012\n...`}
                        value={rawData}
                        onChange={e => setRawData(e.target.value)}
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                        <button onClick={() => setRawData('')} className="bg-white text-rose-500 p-2 rounded-lg shadow-md border border-rose-100 hover:bg-rose-50"><i className="fa-solid fa-eraser"></i></button>
                    </div>
                </div>
            </section>

            {/* QC 报告徽章区 */}
            {qcReport && (
                <section className="animate-reveal">
                    <div
                        className="flex items-center justify-between cursor-pointer group/qc"
                        onClick={() => setShowQcDetails(!showQcDetails)}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${qcReport.warnings.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">数据质控报告</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                {qcReport.validPoints} 有效点
                            </span>
                            {qcReport.invalidRemoved > 0 && (
                                <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                                    {qcReport.invalidRemoved} 已过滤
                                </span>
                            )}
                            {qcReport.unitDetected !== 'auto' && (
                                <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                    {qcReport.unitDetected}
                                </span>
                            )}
                            <i className={`fa-solid fa-chevron-${showQcDetails ? 'up' : 'down'} text-[8px] text-slate-400`}></i>
                        </div>
                    </div>

                    {showQcDetails && (
                        <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-reveal space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[7px] font-black text-slate-400 uppercase">总行数</p>
                                    <p className="text-sm font-black text-slate-700 font-mono">{qcReport.totalPoints}</p>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[7px] font-black text-slate-400 uppercase">合并重复</p>
                                    <p className="text-sm font-black text-slate-700 font-mono">{qcReport.duplicateMerged}</p>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-100 text-center">
                                    <p className="text-[7px] font-black text-slate-400 uppercase">检测单位</p>
                                    <p className="text-[10px] font-black text-indigo-600">{qcReport.unitDetected}</p>
                                </div>
                            </div>
                            {qcReport.warnings.length > 0 && (
                                <div className="space-y-1.5">
                                    {qcReport.warnings.map((w, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[9px] text-amber-700 bg-amber-50/50 p-2 rounded-xl border border-amber-100">
                                            <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 shrink-0"></i>
                                            <span className="font-bold">{w}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* 参数控制面板 */}
            <section className="border border-slate-100 rounded-2xl overflow-hidden">
                <div
                    className="flex items-center justify-between px-4 py-3 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setShowParams(!showParams)}
                >
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-indigo-400 text-[10px]"></i>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">实验参数</span>
                    </div>
                    <i className={`fa-solid fa-chevron-${showParams ? 'up' : 'down'} text-[8px] text-slate-400`}></i>
                </div>

                {showParams && (
                    <div className="p-4 space-y-3 animate-reveal border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[7px] font-black text-slate-400 uppercase block mb-1">电极面积 (cm²)</label>
                                <input
                                    type="number" step="0.001"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-indigo-400"
                                    value={electroParams.electrodeArea}
                                    onChange={e => setElectroParams({ ...electroParams, electrodeArea: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[7px] font-black text-slate-400 uppercase block mb-1">扫速 (mV/s)</label>
                                <input
                                    type="number" step="1"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-indigo-400"
                                    value={electroParams.scanRate}
                                    onChange={e => setElectroParams({ ...electroParams, scanRate: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[7px] font-black text-slate-400 uppercase block mb-1">催化剂载量 (mg/cm²)</label>
                                <input
                                    type="number" step="0.01"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-indigo-400"
                                    value={electroParams.catalystLoading}
                                    onChange={e => setElectroParams({ ...electroParams, catalystLoading: Number(e.target.value) })}
                                />
                            </div>
                            {activeMode === 'RDE' && (
                                <div>
                                    <label className="text-[7px] font-black text-slate-400 uppercase block mb-1">转速 (rpm)</label>
                                    <input
                                        type="number" step="100"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-indigo-400"
                                        value={electroParams.rotationSpeed}
                                        onChange={e => setElectroParams({ ...electroParams, rotationSpeed: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>

                        {/* iR 补偿 */}
                        <div className={`p-3 rounded-2xl border-2 transition-all ${electroParams.iRCompensation ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                            <div className="flex justify-between items-center cursor-pointer"
                                onClick={() => setElectroParams({ ...electroParams, iRCompensation: !electroParams.iRCompensation })}
                            >
                                <div className="flex items-center gap-2">
                                    <i className={`fa-solid fa-bolt ${electroParams.iRCompensation ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${electroParams.iRCompensation ? 'text-indigo-700' : 'text-slate-500'}`}>iR 补偿</span>
                                </div>
                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${electroParams.iRCompensation ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${electroParams.iRCompensation ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </div>
                            {electroParams.iRCompensation && (
                                <div className="mt-3 pt-3 border-t border-indigo-200 animate-reveal">
                                    <label className="text-[7px] font-black text-indigo-500 uppercase block mb-1">溶液电阻 Rs (Ω)</label>
                                    <input
                                        type="number" step="0.1"
                                        className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-xs font-mono text-indigo-700 outline-none"
                                        value={electroParams.solutionResistance}
                                        onChange={e => setElectroParams({ ...electroParams, solutionResistance: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* Tafel 拟合区间控制（LSV/CV模式） */}
            {(activeMode === 'LSV' || activeMode === 'CV') && (
                <section className="p-4 bg-gradient-to-br from-violet-50/50 to-indigo-50/50 rounded-2xl border border-violet-100 animate-reveal">
                    <div className="flex items-center justify-between mb-3">
                        <h5 className="text-[9px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-chart-line"></i> Tafel 拟合区间
                        </h5>
                        <div className="flex bg-white rounded-lg p-0.5 border border-violet-100 shadow-sm">
                            <button
                                onClick={() => setTafelFitMode('auto')}
                                className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${tafelFitMode === 'auto' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-violet-600'}`}
                            >
                                Auto
                            </button>
                            <button
                                onClick={() => setTafelFitMode('manual')}
                                className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${tafelFitMode === 'manual' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-violet-600'}`}
                            >
                                Manual
                            </button>
                        </div>
                    </div>

                    {tafelFitMode === 'manual' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[7px] font-black text-violet-400 uppercase block mb-1">η min (V)</label>
                                <input
                                    type="number" step="0.01" min="0" max="0.5"
                                    className="w-full bg-white border border-violet-200 rounded-xl px-3 py-2 text-xs font-mono text-violet-700 outline-none focus:border-violet-400"
                                    value={tafelFitRange.min}
                                    onChange={e => setTafelFitRange({ ...tafelFitRange, min: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="text-[7px] font-black text-violet-400 uppercase block mb-1">η max (V)</label>
                                <input
                                    type="number" step="0.01" min="0" max="0.5"
                                    className="w-full bg-white border border-violet-200 rounded-xl px-3 py-2 text-xs font-mono text-violet-700 outline-none focus:border-violet-400"
                                    value={tafelFitRange.max}
                                    onChange={e => setTafelFitRange({ ...tafelFitRange, max: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    ) : (
                        <p className="text-[8px] text-violet-400 italic font-bold text-center">
                            <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>
                            智能扫描最佳线性区间 (R² 优化)
                        </p>
                    )}
                </section>
            )}

            <button
                onClick={handleRunAnalysis}
                disabled={isAnalysing}
                className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2rem] shadow-2xl shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
                {isAnalysing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-brain"></i>}
                启动 {activeMode} 智能拓扑解算
            </button>
        </div>
    );
};
