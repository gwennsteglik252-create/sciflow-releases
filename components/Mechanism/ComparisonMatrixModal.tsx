import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useProjectContext } from '../../context/ProjectContext';
import { calculateAuditEta10 } from './physicsUtils';
import { useTranslation } from '../../locales/useTranslation';

interface ComparisonMatrixModalProps {
    onClose: () => void;
    savedSimulations: any[];
    handleLoadSim: (sim: any) => void;
    onDeleteSim: (id: string) => void;
    onUpdateSim?: (id: string, updates: any) => void;
    onClearSimulations?: () => void;
    // Library Props
    matrixLibrary: { id: string, name: string, simulations: any[], timestamp: string, aiInsight?: string }[];
    onSaveMatrix: (name: string, insight?: string) => void;
    onLoadMatrix: (matrix: { id: string, name: string, simulations: any[], aiInsight?: string }) => void;
    onDeleteMatrix: (id: string) => void;
    // AI Analysis Props (lifted to workshop)
    isAnalyzing: boolean;
    aiAnalysisResult: string | null;
    onRunAiAnalysis: () => void;
}

const ComparisonMatrixModal: React.FC<ComparisonMatrixModalProps> = ({
    onClose,
    savedSimulations,
    handleLoadSim,
    onDeleteSim,
    onUpdateSim,
    onClearSimulations,
    matrixLibrary,
    onSaveMatrix,
    onLoadMatrix,
    onDeleteMatrix,
    isAnalyzing,
    aiAnalysisResult,
    onRunAiAnalysis
}) => {
    const { showToast } = useProjectContext();
    const { t } = useTranslation();
    const [matrixName, setMatrixName] = useState(t('mechanism.comparison.matrixDefaultName'));
    const [isEditingName, setIsEditingName] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isInsightFolded, setIsInsightFolded] = useState(true);

    // Sorting state
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, [isEditingName]);

    const handleSaveToLibrary = () => {
        onSaveMatrix(matrixName, aiAnalysisResult || undefined);
    };

    const handleNewMatrix = () => {
        if (savedSimulations.length > 0) {
            if (!window.confirm(t('mechanism.comparison.clearConfirm'))) return;
        }
        onClearSimulations?.();
        setMatrixName(t('mechanism.comparison.unnamedMatrix'));
    };

    const handleExportAiInsight = () => {
        if (!aiAnalysisResult) return;
        const blob = new Blob([aiAnalysisResult], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${matrixName}_AI_Analysis.txt`;
        link.click();
        URL.revokeObjectURL(url);
        showToast({ message: t('mechanism.workshop.aiInsightExported'), type: 'success' });
    };

    const handleCopyInsight = () => {
        if (!aiAnalysisResult) return;
        navigator.clipboard.writeText(aiAnalysisResult);
        showToast({ message: t('mechanism.workshop.insightCopied'), type: 'success' });
    };

    const getRDSValue = (sim: any) => {
        if (sim.rdsOverride) return parseFloat(sim.rdsOverride);
        if (!sim.physicalConstants?.energySteps || !Array.isArray(sim.physicalConstants.energySteps)) return 0;
        const steps = sim.physicalConstants.energySteps;
        let maxDiff = -Infinity;
        for (let i = 0; i < steps.length - 1; i++) {
            const diff = steps[i + 1] - steps[i];
            if (diff > maxDiff) maxDiff = diff;
        }
        return maxDiff > -Infinity ? maxDiff : 0;
    };

    const sortedSimulations = useMemo(() => {
        if (!sortKey) return savedSimulations;
        return [...savedSimulations].sort((a, b) => {
            let aVal = 0;
            let bVal = 0;
            if (sortKey === 'h10') {
                aVal = a.physicalConstants?.eta10 || 0;
                bVal = b.physicalConstants?.eta10 || 0;
            } else if (sortKey === 'tafel') {
                aVal = parseFloat(a.physicalConstants?.tafelSlope || '0');
                bVal = parseFloat(b.physicalConstants?.tafelSlope || '0');
            } else if (sortKey === 'j0') {
                aVal = parseFloat(a.physicalConstants?.exchangeCurrentDensity || '0');
                bVal = parseFloat(b.physicalConstants?.exchangeCurrentDensity || '0');
            } else if (sortKey === 'rds') {
                aVal = getRDSValue(a);
                bVal = getRDSValue(b);
            } else if (sortKey === 'stability') {
                aVal = a.stabilityPrediction?.safetyIndex || 0;
                bVal = b.stabilityPrediction?.safetyIndex || 0;
            }
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
    }, [savedSimulations, sortKey, sortOrder]);

    const handleSortRequest = (key: string) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('asc');
        }
    };

    const handleExportTable = () => {
        const data = sortedSimulations.map(sim => ({
            Material: `${sim.material}${sim.doping?.element ? `+${sim.doping.element}` : ''}`,
            Mode: sim.reactionMode,
            pH: sim.pH,
            H10: sim.physicalConstants?.eta10,
            Tafel: parseFloat(sim.physicalConstants?.tafelSlope || '0'),
            J0: parseFloat(sim.physicalConstants?.exchangeCurrentDensity || '0'),
            RDS: sim.rdsOverride || (() => {
                if (!sim.physicalConstants?.energySteps) return '';
                const steps = sim.physicalConstants.energySteps;
                let maxDiff = -Infinity;
                for (let i = 0; i < steps.length - 1; i++) {
                    const diff = steps[i + 1] - steps[i];
                    if (diff > maxDiff) maxDiff = diff;
                }
                return maxDiff > -Infinity ? maxDiff.toFixed(2) : '';
            })(),
            Stability: sim.stabilityPrediction?.safetyIndex
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Matrix");
        XLSX.writeFile(wb, `${matrixName}_Export.xlsx`);
    };

    const updateSimValue = (id: string, field: string, value: string) => {
        if (!onUpdateSim) return;
        const updates: any = {};
        if (field === 'eta10') {
            updates.physicalConstants = { ...savedSimulations.find(s => s.id === id).physicalConstants, eta10: parseFloat(value) };
        } else if (field === 'tafelSlope') {
            updates.physicalConstants = { ...savedSimulations.find(s => s.id === id).physicalConstants, tafelSlope: value };
        } else if (field === 'exchangeCurrentDensity') {
            updates.physicalConstants = { ...savedSimulations.find(s => s.id === id).physicalConstants, exchangeCurrentDensity: value };
        } else if (field === 'rds') {
            updates.rdsOverride = value;
        } else if (field === 'safetyIndex') {
            const sim = savedSimulations.find(s => s.id === id);
            updates.stabilityPrediction = { ...sim.stabilityPrediction, safetyIndex: parseFloat(value) || 0 };
        }
        onUpdateSim(id, updates);
    };

    return (
        <div className="absolute inset-0 bg-slate-950/60 z-[100] backdrop-blur-sm flex items-center justify-center p-4 lg:p-8 animate-reveal">
            <div className="bg-white w-full h-full max-h-[850px] rounded-[2.5rem] shadow-2xl border-4 border-white/50 flex flex-col overflow-hidden relative">

                {/* Header Section — flex-wrap 防止英文按钮溢出 */}
                <div className="flex justify-between items-center px-10 py-8 shrink-0 bg-white z-20 flex-wrap gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight leading-none">
                                {t('mechanism.comparison.title')}
                            </h3>
                        </div>

                        <div className="flex items-center gap-4 relative group">
                            {isEditingName ? (
                                <input
                                    ref={nameInputRef}
                                    className="text-lg font-bold text-slate-600 border-b-2 border-indigo-500 outline-none bg-transparent w-64 px-2 py-1"
                                    value={matrixName}
                                    onChange={(e) => setMatrixName(e.target.value)}
                                    onBlur={() => setIsEditingName(false)}
                                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                                />
                            ) : (
                                <div
                                    className="flex items-center gap-2 cursor-pointer px-3 py-1 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200 group/edit"
                                    onClick={() => setIsEditingName(true)}
                                    title={t('mechanism.comparison.renameTitle')}
                                >
                                    <span className="text-lg font-bold text-slate-500">{matrixName}</span>
                                    <i className="fa-solid fa-pen text-slate-300 text-xs opacity-0 group-hover/edit:opacity-100 transition-opacity"></i>
                                </div>
                            )}

                            <button
                                onClick={handleNewMatrix}
                                className="w-10 h-10 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition-all hover:bg-indigo-50 shadow-sm group/new"
                                title={t('mechanism.comparison.newMatrixTitle')}
                            >
                                <i className="fa-solid fa-plus text-xs group-hover/new:scale-110 transition-transform"></i>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* AI Analysis Button */}
                        <button
                            onClick={onRunAiAnalysis}
                            disabled={isAnalyzing}
                            className="h-10 px-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-100 hover:scale-[1.02] transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                        >
                            {isAnalyzing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                            {t('mechanism.comparison.aiAnalyzeMatrix')}
                        </button>

                        <div className="w-px h-6 bg-slate-200 mx-0.5"></div>

                        {/* Action Buttons */}
                        <button onClick={() => setIsEditMode(!isEditMode)} className={`h-10 px-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border whitespace-nowrap ${isEditMode ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-slate-600'}`}>
                            <i className="fa-solid fa-pen-to-square"></i> {t('mechanism.comparison.editMatrix')}
                        </button>
                        <button onClick={handleExportTable} className="h-10 px-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2 whitespace-nowrap">
                            <i className="fa-solid fa-file-export"></i> {t('mechanism.comparison.exportData')}
                        </button>

                        {/* Matrix Library Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLibrary(!showLibrary)}
                                className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-sm whitespace-nowrap ${showLibrary ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                            >
                                <i className="fa-solid fa-layer-group"></i>
                                {t('mechanism.comparison.matrixLibrary')} ({matrixLibrary.length})
                                <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showLibrary ? 'rotate-180' : ''}`}></i>
                            </button>

                            {showLibrary && (
                                <div className="absolute top-full right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-reveal flex flex-col max-h-[300px]">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{t('mechanism.comparison.archivedMatrices')}</p>
                                        <button onClick={() => setShowLibrary(false)} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"><i className="fa-solid fa-times text-[10px]"></i></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                                        {matrixLibrary.map(m => (
                                            <div key={m.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl group transition-all cursor-pointer border border-transparent hover:border-slate-100" onClick={() => { onLoadMatrix(m); setMatrixName(m.name); setShowLibrary(false); }}>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-bold text-slate-700 truncate">{m.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[8px] text-slate-400 font-mono">{m.timestamp.split(' ')[0]}</span>
                                                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[7px] font-black">{m.simulations.length} Items</span>
                                                        {m.aiInsight && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[7px] font-black flex items-center gap-1"><i className="fa-solid fa-robot"></i> Report</span>}
                                                    </div>
                                                </div>

                                                <div onClick={(e) => e.stopPropagation()}>
                                                    {deleteConfirmId === m.id ? (
                                                        <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg animate-reveal">
                                                            <button
                                                                onClick={() => { onDeleteMatrix(m.id); setDeleteConfirmId(null); }}
                                                                className="px-2 py-1 bg-rose-500 text-white rounded-md text-[9px] font-bold hover:bg-rose-600"
                                                            >
                                                                {t('mechanism.comparison.deleteAction')}
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirmId(null)}
                                                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600"
                                                            >
                                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirmId(m.id)}
                                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                                                            title={t('mechanism.comparison.deleteArchiveTitle')}
                                                        >
                                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {matrixLibrary.length === 0 && (
                                            <div className="py-8 text-center flex flex-col items-center opacity-40 gap-2">
                                                <i className="fa-solid fa-folder-open text-2xl text-slate-300"></i>
                                                <p className="text-[9px] text-slate-400 font-medium">{t('mechanism.comparison.noArchives')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSaveToLibrary}
                            className="h-10 px-5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 whitespace-nowrap"
                        >
                            <i className="fa-solid fa-floppy-disk"></i> {t('mechanism.comparison.saveMatrix')}
                        </button>

                        <div className="w-px h-6 bg-slate-200 mx-1"></div>

                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all flex items-center justify-center active:scale-90">
                            <i className="fa-solid fa-times text-sm"></i>
                        </button>
                    </div>
                </div>

                {/* AI Analysis View Integration */}
                {aiAnalysisResult && (
                    <div className="px-10 mb-4 shrink-0">
                        <div className="bg-indigo-50/50 rounded-[1.5rem] border-2 border-dashed border-indigo-200 relative animate-reveal overflow-hidden">
                            <div
                                className="p-5 flex justify-between items-center cursor-pointer hover:bg-indigo-100/50 transition-colors"
                                onClick={() => setIsInsightFolded(!isInsightFolded)}
                            >
                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-robot"></i> {t('mechanism.comparison.aiInsightTitle')}
                                    <i className={`fa-solid ${isInsightFolded ? 'fa-chevron-down' : 'fa-chevron-up'} text-[8px] ml-2 opacity-50`}></i>
                                </h4>

                                {!isInsightFolded && (
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={handleCopyInsight}
                                            className="w-7 h-7 bg-white rounded-lg border border-indigo-200 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                                            title={t('mechanism.comparison.copyInsightTitle')}
                                        >
                                            <i className="fa-solid fa-copy text-[9px]"></i>
                                        </button>
                                        <button
                                            onClick={handleExportAiInsight}
                                            className="w-7 h-7 bg-white rounded-lg border border-indigo-200 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                                            title={t('mechanism.comparison.exportInsightTitle')}
                                        >
                                            <i className="fa-solid fa-download text-[9px]"></i>
                                        </button>
                                        <button onClick={() => { }} className="w-7 h-7 opacity-0 pointer-events-none"></button>
                                    </div>
                                )}
                                <button
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="absolute top-3 right-3 text-indigo-300 hover:text-rose-500 transition-colors pointer-events-none opacity-0"
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>

                            {!isInsightFolded && (
                                <div className="px-5 pb-5 animate-reveal">
                                    <div className="text-[12px] font-medium text-slate-700 italic leading-relaxed max-h-48 overflow-y-auto custom-scrollbar pr-2 border-t border-indigo-100 pt-3">
                                        {aiAnalysisResult}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Table Container */}
                <div className="flex-1 overflow-auto custom-scrollbar px-10 pb-10">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                            <tr>
                                <th className="py-5 pr-4 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-[18%] pl-4">{t('mechanism.comparison.colMaterial')}</th>
                                <th className="py-5 px-2 text-[11px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-100 text-center w-[8%]">{t('mechanism.comparison.colMode')}</th>
                                <th className="py-5 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-[8%]">{t('mechanism.comparison.colPH')}</th>
                                <th className="py-5 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center w-[10%] cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => handleSortRequest('h10')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>H10 (V)</span>
                                        <i className={`fa-solid ${sortKey === 'h10' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} opacity-20 group-hover:opacity-100 transition-opacity`}></i>
                                    </div>
                                </th>
                                <th className="py-5 px-2 text-[11px] font-black text-indigo-700 uppercase tracking-widest border-b border-slate-100 text-center w-[12%] cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => handleSortRequest('tafel')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>TAFEL (mV/dec)</span>
                                        <i className={`fa-solid ${sortKey === 'tafel' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} opacity-20 group-hover:opacity-100 transition-opacity`}></i>
                                    </div>
                                </th>
                                <th className="py-5 px-2 text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 text-center w-[12%] cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => handleSortRequest('j0')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>J₀ (μA/cm²)</span>
                                        <i className={`fa-solid ${sortKey === 'j0' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} opacity-20 group-hover:opacity-100 transition-opacity`}></i>
                                    </div>
                                </th>
                                <th className="py-5 px-2 text-[11px] font-black text-rose-400 uppercase tracking-widest border-b border-slate-100 text-center w-[10%] cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => handleSortRequest('rds')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>RDS (eV)</span>
                                        <i className={`fa-solid ${sortKey === 'rds' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} opacity-20 group-hover:opacity-100 transition-opacity`}></i>
                                    </div>
                                </th>
                                <th className="py-5 px-2 text-[11px] font-black text-emerald-600 uppercase tracking-widest border-b border-slate-100 text-center w-[12%] cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => handleSortRequest('stability')}>
                                    <div className="flex items-center justify-center gap-1">
                                        <span>{t('mechanism.comparison.colStability')}</span>
                                        <i className={`fa-solid ${sortKey === 'stability' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'} opacity-20 group-hover:opacity-100 transition-opacity`}></i>
                                    </div>
                                </th>
                                <th className="py-5 pl-4 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right w-[10%] pr-4">{t('mechanism.comparison.colAction')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {sortedSimulations.map((sim) => (
                                <tr key={sim.id} className="group hover:bg-slate-50/80 transition-colors">
                                    <td className="py-5 pr-4 pl-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px] shadow-sm shrink-0">
                                                {sim.reactionMode && sim.reactionMode[0]}
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-700 tracking-tight">
                                                    {sim.material || 'Unknown Base'}
                                                    {sim.doping?.element && (
                                                        <>
                                                            <span className="mx-1 text-slate-400">+</span>
                                                            <span>{sim.doping.element}</span>
                                                        </>
                                                    )}
                                                    {sim.doping?.concentration ? (
                                                        <span className="ml-2 text-indigo-500 font-black text-xs bg-indigo-50 px-1.5 py-0.5 rounded">
                                                            {sim.doping.concentration}%
                                                        </span>
                                                    ) : null}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        <span className={`text-[11px] font-black px-2.5 py-1 rounded-md uppercase ${sim.reactionMode === 'OER' ? 'bg-orange-50 text-orange-600' : sim.reactionMode === 'ORR' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {sim.reactionMode}
                                        </span>
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        <span className="text-lg font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                            {sim.pH || '--'}
                                        </span>
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        {isEditMode ? (
                                            <input
                                                className="w-20 bg-slate-50 border-b border-indigo-200 text-center text-lg font-bold outline-none"
                                                defaultValue={sim.physicalConstants?.eta10}
                                                onBlur={(e) => updateSimValue(sim.id, 'eta10', e.target.value)}
                                            />
                                        ) : (
                                            <span className="text-lg font-black text-slate-800 italic font-mono tracking-tight">
                                                {(() => {
                                                    const audited = calculateAuditEta10(sim.physicalConstants?.energySteps || [], sim.reactionMode);
                                                    if (audited > 0) return audited.toFixed(3);
                                                    let val = sim.physicalConstants?.eta10 || 0;
                                                    if (val > 10) val = val / 1000;
                                                    return val === 0 ? '--' : val.toFixed(3);
                                                })()}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        {isEditMode ? (
                                            <input
                                                className="w-20 bg-slate-50 border-b border-indigo-200 text-center text-lg font-bold outline-none text-indigo-600"
                                                defaultValue={parseFloat(sim.physicalConstants?.tafelSlope || '0')}
                                                onBlur={(e) => updateSimValue(sim.id, 'tafelSlope', e.target.value)}
                                            />
                                        ) : (
                                            <span className="text-lg font-black text-indigo-600 italic font-mono">
                                                {parseFloat(sim.physicalConstants?.tafelSlope || '0') || '--'}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        {isEditMode ? (
                                            <input
                                                className="w-24 bg-slate-50 border-b border-indigo-200 text-center text-lg font-bold outline-none text-slate-600"
                                                defaultValue={parseFloat(sim.physicalConstants?.exchangeCurrentDensity || '0')}
                                                onBlur={(e) => updateSimValue(sim.id, 'exchangeCurrentDensity', e.target.value)}
                                            />
                                        ) : (
                                            <span className="text-lg font-black text-slate-600 italic font-mono">
                                                {(() => {
                                                    const val = sim.physicalConstants?.exchangeCurrentDensity;
                                                    const j = typeof val === 'string' ? parseFloat(val) : val;
                                                    if (isNaN(j) || j === 0) return '--';
                                                    return (j * 1e6).toFixed(2);
                                                })()}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        {isEditMode ? (
                                            <input
                                                className="w-16 bg-slate-50 border-b border-rose-200 text-center text-lg font-bold outline-none text-rose-500"
                                                defaultValue={sim.rdsOverride || (() => {
                                                    if (!sim.physicalConstants?.energySteps || !Array.isArray(sim.physicalConstants.energySteps)) return '';
                                                    const steps = sim.physicalConstants.energySteps;
                                                    let maxDiff = -Infinity;
                                                    for (let i = 0; i < steps.length - 1; i++) {
                                                        const diff = steps[i + 1] - steps[i];
                                                        if (diff > maxDiff) maxDiff = diff;
                                                    }
                                                    return maxDiff > -Infinity ? maxDiff.toFixed(2) : '';
                                                })()}
                                                onBlur={(e) => updateSimValue(sim.id, 'rds', e.target.value)}
                                            />
                                        ) : (
                                            <span className="text-lg font-black text-rose-500 italic font-mono">
                                                {sim.rdsOverride || (() => {
                                                    if (!sim.physicalConstants?.energySteps || !Array.isArray(sim.physicalConstants.energySteps)) return '--';
                                                    const steps = sim.physicalConstants.energySteps;
                                                    let maxDiff = -Infinity;
                                                    for (let i = 0; i < steps.length - 1; i++) {
                                                        const diff = steps[i + 1] - steps[i];
                                                        if (diff > maxDiff) maxDiff = diff;
                                                    }
                                                    return maxDiff > -Infinity ? maxDiff.toFixed(2) : '--';
                                                })()}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-5 px-2 text-center">
                                        {isEditMode ? (
                                            <input
                                                className="w-16 bg-slate-50 border-b border-emerald-200 text-center text-lg font-bold outline-none text-emerald-600"
                                                defaultValue={sim.stabilityPrediction?.safetyIndex}
                                                onBlur={(e) => updateSimValue(sim.id, 'safetyIndex', e.target.value)}
                                            />
                                        ) : (
                                            <span className={`text-lg font-black italic font-mono ${sim.stabilityPrediction?.safetyIndex >= 8 ? 'text-emerald-500' : sim.stabilityPrediction?.safetyIndex >= 5 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                {sim.stabilityPrediction?.safetyIndex?.toFixed(2) || '--'}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-5 pl-4 text-right pr-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {!isEditMode ? (
                                                <button
                                                    onClick={() => handleLoadSim(sim)}
                                                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:border-indigo-500 hover:text-indigo-600 hover:shadow-md transition-all flex items-center justify-center group/btn"
                                                    title={t('mechanism.comparison.loadSchemeTitle')}
                                                >
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onDeleteSim(sim.id)}
                                                    className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:border-rose-500 hover:text-rose-500 hover:shadow-md transition-all flex items-center justify-center group/btn animate-reveal"
                                                    title={t('mechanism.comparison.removeSchemeTitle')}
                                                >
                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {savedSimulations.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-32 text-center">
                                        <div className="inline-flex flex-col items-center opacity-40 gap-4">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border-2 border-dashed border-slate-200">
                                                <i className="fa-solid fa-box-open text-3xl text-slate-300"></i>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">{t('mechanism.comparison.emptyMatrix')}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">{t('mechanism.comparison.emptyMatrixHint')}</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ComparisonMatrixModal;
