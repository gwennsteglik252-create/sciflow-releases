import React, { useMemo, useState } from 'react';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import { useProjectContext } from '../../context/ProjectContext';
import { calculateAuditEta10 } from './physicsUtils';
import { useTranslation } from '../../locales/useTranslation';

interface MechanismReportProps {
    analysisResult: string | null;
    isProcessing: boolean;
    physicalConstants?: any;
}

const MechanismReport: React.FC<MechanismReportProps> = ({ analysisResult, isProcessing, physicalConstants }) => {
    const { mechanismSession } = useProjectContext();
    const [showFormulaHelp, setShowFormulaHelp] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const { t } = useTranslation();

    const isOER = mechanismSession.reactionMode === 'OER';
    const isHER = mechanismSession.reactionMode === 'HER';
    const isORR = mechanismSession.reactionMode === 'ORR';
    const isBi = mechanismSession.reactionMode === 'BIFUNCTIONAL';

    // 核心升级：动态物理计算逻辑，正确区分 OER/ORR/HER 步数
    const is4Step = isOER || isORR || isBi;  // OER/ORR/BIFUNCTIONAL 都是 4 步法
    const auditData = useMemo(() => {
        if (!physicalConstants?.energySteps || !Array.isArray(physicalConstants.energySteps)) return null;

        const steps = physicalConstants.energySteps;
        const requiredPoints = is4Step ? 5 : 3;  // OER/ORR/Bi=5点, HER=3点

        if (steps.length < requiredPoints) return null;

        const deltas: number[] = [];
        const numTransitions = requiredPoints - 1;

        for (let i = 0; i < numTransitions; i++) {
            deltas.push(steps[i + 1] - steps[i]);
        }

        const maxDeltaG = Math.max(...deltas);
        const rdsIndex = deltas.indexOf(maxDeltaG) + 1;

        const effectiveMode = isOER ? 'OER' : isORR ? 'ORR' : isBi ? 'OER' : 'HER';
        const localComputedEta = calculateAuditEta10(steps, effectiveMode as any);
        const totalEnergy = steps[numTransitions] - steps[0];

        const targetTotal = isOER ? 4.92 : isORR ? -4.92 : isBi ? 4.92 : 0.00;
        const isSelfConsistent = Math.abs(totalEnergy - targetTotal) < 0.15;

        const cheEta = physicalConstants.eta10 || 0;
        const discrepancy = Math.abs(cheEta - localComputedEta);

        const deltaE = isBi ? (localComputedEta + 0.35 + 1.23) - (1.23 - 0.42) : null;

        return { deltas, maxDeltaG, rdsIndex, localComputedEta, totalEnergy, isSelfConsistent, targetTotal, discrepancy, deltaE };
    }, [physicalConstants, isOER, isORR, isBi, is4Step]);

    return (
        <div className="h-full flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center shrink-0 mb-4">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-file-shield text-indigo-600"></i> {t('mechanism.report.title')}
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowVerification(!showVerification)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${showVerification ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                            title={t('mechanism.report.showAuditTitle')}
                        >
                            <i className="fa-solid fa-calculator text-[10px]"></i>
                        </button>
                        <button
                            onClick={() => setShowFormulaHelp(!showFormulaHelp)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${showFormulaHelp ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                            title={t('mechanism.report.showModelTitle')}
                        >
                            <i className="fa-solid fa-circle-info text-[10px]"></i>
                        </button>
                    </div>
                </div>

                {showFormulaHelp && (
                    <div className="mb-4 p-4 bg-indigo-900 text-indigo-100 rounded-2xl animate-reveal border border-white/10 shadow-inner overflow-y-auto max-h-60 custom-scrollbar shrink-0">
                        <h5 className="text-[9px] font-black uppercase tracking-widest mb-3 border-b border-white/10 pb-1 text-white">{isOER ? 'OER' : 'HER'} {t('mechanism.report.derivationModel')}</h5>
                        <div className="space-y-3 font-mono text-[10px] leading-relaxed">
                            <section>
                                <p className="text-indigo-300 mb-1">{t('mechanism.report.overpotentialLogic')}</p>
                                <p className="bg-black/20 p-2 rounded">
                                    {isOER ? 'η_th = max(ΔG1...4) - 1.23V' : 'η_th = max(ΔG1...2) V'}
                                </p>
                            </section>
                            <section>
                                <p className="text-indigo-300 mb-1">{t('mechanism.report.conservationConstraint')}</p>
                                <p className="bg-black/20 p-2 rounded">
                                    {isOER ? 'ΣΔG = S4 - S0 = 4.92 eV' : 'ΣΔG = S2 - S0 = 0.00 eV'}
                                </p>
                            </section>
                            <section>
                                <p className="text-amber-300 mb-1">{t('mechanism.report.auditGap')}</p>
                                <p className="bg-black/20 p-2 rounded text-slate-300">
                                    {t('mechanism.report.auditGapDesc')}
                                </p>
                            </section>
                        </div>
                    </div>
                )}

                {/* 物理审计面板：显示本地推算结果 */}
                {showVerification && auditData && (
                    <div className="mb-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl animate-reveal shrink-0">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <h5 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic">{t('mechanism.report.selfConsistencyAudit')} ({is4Step ? t('mechanism.report.fourStepMethod') : t('mechanism.report.twoStepMethod')})</h5>
                            </div>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${auditData.isSelfConsistent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                {auditData.isSelfConsistent ? t('mechanism.report.passed') : t('mechanism.report.warning')}: ΣΔG = {auditData.totalEnergy.toFixed(2)} eV
                            </span>
                        </div>

                        <div className={`grid ${is4Step ? 'grid-cols-4' : 'grid-cols-2'} gap-2 mb-3`}>
                            {auditData.deltas.map((dg, i) => (
                                <div key={i} className={`p-2 rounded-xl border flex flex-col items-center transition-all ${auditData.rdsIndex === i + 1 ? 'bg-rose-500/20 border-rose-500/50' : 'bg-white/5 border-white/5'}`}>
                                    <span className="text-[7px] font-black text-slate-500 uppercase mb-1">ΔG{i + 1}</span>
                                    <span className={`text-[11px] font-black ${auditData.rdsIndex === i + 1 ? 'text-rose-400' : 'text-indigo-300'}`}>{dg.toFixed(2)}</span>
                                    {auditData.rdsIndex === i + 1 && <span className="text-[6px] font-black text-rose-500 mt-1">RDS</span>}
                                </div>
                            ))}
                        </div>

                        <div className="bg-black/40 p-3 rounded-xl flex justify-between items-center relative overflow-hidden">
                            {auditData.discrepancy > 0.05 && (
                                <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_#f43f5e]"></div>
                            )}
                            <div>
                                <p className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1 flex items-center gap-1">
                                    {t('mechanism.report.localEngine')}
                                    <span className="text-[6px] bg-emerald-900 text-emerald-400 px-1 rounded border border-emerald-800">{t('mechanism.report.localTag')}</span>
                                </p>
                                <p className="text-[10px] font-black text-white">
                                    {isOER ? `${auditData.maxDeltaG.toFixed(2)} - 1.23 =` : isORR ? `${auditData.maxDeltaG.toFixed(2)} + 1.23 =` : `max(${auditData.deltas.map(d => d.toFixed(1)).join(',')}) =`} <span className="text-emerald-400">{auditData.localComputedEta.toFixed(3)} V</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1 flex items-center gap-1 justify-end">
                                    <span className="text-[6px] bg-indigo-900 text-indigo-400 px-1 rounded border border-indigo-800">{t('mechanism.report.aiModelTag')}</span>
                                    {t('mechanism.report.aiOriginalValue')}
                                </p>
                                <p className="text-[10px] font-black text-slate-400">{physicalConstants.eta10?.toFixed(3) || '--'} V</p>
                            </div>
                        </div>
                    </div>
                )}

                {physicalConstants && (
                    <div className="grid grid-cols-2 gap-2 mb-3 shrink-0 animate-reveal">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('mechanism.report.tafelSlope')}</p>
                            <p className="text-sm font-black text-slate-800 tracking-tight leading-none">{physicalConstants.tafelSlope || '--'} <span className="text-[9px] text-slate-400 font-bold ml-1">mV/dec</span></p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('mechanism.report.exchangeCurrentDensity')}</p>
                            <p className="text-sm font-black text-slate-800 tracking-tight leading-none">
                                {(() => {
                                    const val = physicalConstants.exchangeCurrentDensity;
                                    const j = typeof val === 'string' ? parseFloat(val) : val;
                                    if (isNaN(j) || j === 0) return <span>{val || '--'} <span className="text-[9px] text-slate-400 font-bold ml-1">A/cm²</span></span>;
                                    if (j < 1e-3) return <span>{(j * 1e6).toFixed(2)} <span className="text-[9px] text-slate-400 font-bold ml-1">μA/cm²</span></span>;
                                    if (j < 1) return <span>{(j * 1e3).toFixed(2)} <span className="text-[9px] text-slate-400 font-bold ml-1">mA/cm²</span></span>;
                                    return <span>{j.toFixed(4)} <span className="text-[9px] text-slate-400 font-bold ml-1">A/cm²</span></span>;
                                })()}
                            </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('mechanism.report.h10Overpotential')}</p>
                            <p className="text-sm font-black text-indigo-600 tracking-tight leading-none">
                                {physicalConstants.eta10 ? `${Number(physicalConstants.eta10).toFixed(3)} V` : (auditData ? `${auditData.localComputedEta.toFixed(3)} V` : '--')}
                            </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('mechanism.report.rdsBarrier')}</p>
                            <p className="text-sm font-black text-rose-500 tracking-tight leading-none">
                                {auditData ? `${auditData.maxDeltaG.toFixed(2)} eV` : '--'}
                            </p>
                        </div>
                        {isBi && auditData?.deltaE && (
                            <div className="col-span-2 bg-indigo-600 p-4 rounded-2xl flex justify-between items-center shadow-lg animate-reveal">
                                <div>
                                    <p className="text-[8px] font-black text-indigo-200 uppercase tracking-[0.2rem] mb-1">{t('mechanism.report.bifunctionalVoltageGap')}</p>
                                    <p className="text-xl font-black text-white leading-none">
                                        {auditData.deltaE.toFixed(3)} <span className="text-[10px] opacity-60 ml-1">V (OER@10 - ORR@10)</span>
                                    </p>
                                </div>
                                <i className="fa-solid fa-bolt-lightning text-white/40 text-2xl"></i>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 bg-amber-50/30 rounded-xl border border-amber-100/50 p-4 flex flex-col overflow-hidden relative">
                    <style>{`
                        @font-face {
                            font-family: 'TN-Numbers';
                            src: local('Times New Roman');
                            unicode-range: U+30-39, U+2E, U+2D, U+2B, U+25; /* 0-9, ., -, +, % */
                        }
                        .mechanism-report-content p, 
                        .mechanism-report-content li {
                            font-size: 13px !important;
                            line-height: 1.9 !important;
                            text-align: justify !important;
                            font-family: 'TN-Numbers', 'Plus Jakarta Sans', system-ui, sans-serif !important;
                            margin-bottom: 0.85rem !important;
                        }
                        .mechanism-report-content h1 {
                            font-size: 18px !important;
                            font-weight: 800 !important;
                            margin-top: 0 !important;
                            margin-bottom: 1.2rem !important;
                            border-bottom: 2px solid rgba(99, 102, 241, 0.3) !important;
                            padding-bottom: 12px !important;
                            font-family: 'TN-Numbers', 'Plus Jakarta Sans', system-ui, sans-serif !important;
                            color: #1e293b !important;
                            line-height: 1.4 !important;
                        }
                        .mechanism-report-content h2 {
                            font-size: 15px !important;
                            font-weight: 800 !important;
                            margin-top: 1.8rem !important;
                            margin-bottom: 0.85rem !important;
                            padding-bottom: 8px !important;
                            font-family: 'TN-Numbers', 'Plus Jakarta Sans', system-ui, sans-serif !important;
                            color: #334155 !important;
                            border-left: 3px solid #6366f1 !important;
                            padding-left: 10px !important;
                            border-bottom: none !important;
                        }
                        .mechanism-report-content h3 {
                            font-size: 14px !important;
                            font-weight: 700 !important;
                            margin-top: 1.2rem !important;
                            margin-bottom: 0.6rem !important;
                            font-family: 'TN-Numbers', 'Plus Jakarta Sans', system-ui, sans-serif !important;
                            color: #475569 !important;
                        }
                        .mechanism-report-content ul {
                            margin-bottom: 1rem !important;
                            padding-left: 1.2rem !important;
                            list-style-type: none !important;
                        }
                        .mechanism-report-content ol {
                            margin-bottom: 1rem !important;
                            padding-left: 1.5rem !important;
                        }
                        .mechanism-report-content ul > li {
                            position: relative !important;
                            padding-left: 1rem !important;
                        }
                        .mechanism-report-content ul > li::before {
                            content: '' !important;
                            position: absolute !important;
                            left: 0 !important;
                            top: 8px !important;
                            width: 5px !important;
                            height: 5px !important;
                            border-radius: 50% !important;
                            background: #6366f1 !important;
                        }
                        .mechanism-report-content code {
                            font-family: 'TN-Numbers', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
                            font-size: 12px !important;
                        }
                        .mechanism-report-content strong {
                            color: #1e293b !important;
                            font-weight: 800 !important;
                        }
                        .mechanism-report-content blockquote {
                            border-left: 3px solid #f59e0b !important;
                            background: rgba(245, 158, 11, 0.05) !important;
                            padding: 10px 14px !important;
                            margin: 12px 0 !important;
                            border-radius: 0 8px 8px 0 !important;
                        }
                        .mechanism-report-content blockquote p {
                            margin-bottom: 0 !important;
                            font-style: italic !important;
                            color: #92400e !important;
                        }
                    `}</style>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 relative z-10 flex-1 overflow-y-auto custom-scrollbar animate-reveal flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-400/50 rounded-l-full"></div>
                        <div className="p-6 flex-1 min-h-0">
                            {analysisResult ? (
                                <div className="mechanism-report-content text-slate-700">
                                    <ScientificMarkdown content={analysisResult} />
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-300 italic text-[10px] font-black uppercase tracking-[0.2rem] text-center">
                                    {isProcessing ? (
                                        <span className="animate-pulse flex items-center gap-2"><i className="fa-solid fa-circle-notch animate-spin"></i> {t('mechanism.report.simulationRunning')}</span>
                                    ) : (
                                        t('mechanism.report.waitingSettlement')
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MechanismReport;