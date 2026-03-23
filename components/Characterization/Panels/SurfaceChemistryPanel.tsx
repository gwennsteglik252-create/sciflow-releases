
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import LaTeXText from '../../Common/LaTeXText';
import AnalysisSyncModal, { flattenMilestonesTree, getAutoSelections } from '../AnalysisSyncModal';
import { printElement } from '../../../utils/printUtility';
import { buildArchiveFolderMeta } from '../../../utils/archiveFolder';
import { buildContextSummary, resolveContextForAnalysis } from '../../../utils/experimentContext';
import FolderLibraryView from '../FolderLibraryView';
import {
    XpsDataPoint, XpsQcReport, XpsFitResult, XpsPeakParams, XpsQuantResult,
    XpsRecord, BackgroundType, CompareSample, COMPARE_COLORS,
    cleanAndValidateXpsData, computeBackground, runXpsAnalysis, detectPeaks,
    generateXpsMockRawText, generateXpsMockData, voigtPeak,
    matchChemicalState, calculateAtomicPercent, XPS_STANDARD_LIBRARY, SENSITIVITY_FACTORS,
    ELEMENT_DEMO_CONFIGS,
    analyzeValenceRatio, classifyNitrogenSpecies, classifyOxygenSpecies, compareBeforeAfter,
    ValenceRatioResult, NitrogenSpeciesResult, OxygenSpeciesResult, BeforeAfterComparison,
} from './xpsAnalysis';

interface Props {
    projects: ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    onUpdateProject?: (project: ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
    onBack?: () => void;
}

const ELEMENTS = ['Co 2p', 'Ni 2p', 'Fe 2p', 'O 1s', 'N 1s', 'Pt 4f', 'C 1s'];

const SurfaceChemistryPanel: React.FC<Props> = ({ projects, onSave, onUpdateProject, selectedProjectId, traceRecordId, onBack }) => {
    const { showToast, updateDataAnalysisSession, navigate } = useProjectContext();
    const [activeElement, setActiveElement] = useState('Co 2p');
    const [isAnalysing, setIsAnalysing] = useState(false);
    const [rawData, setRawData] = useState('');
    const [parsedData, setParsedData] = useState<XpsDataPoint[]>([]);
    const [qcReport, setQcReport] = useState<XpsQcReport | null>(null);
    const [fitResult, setFitResult] = useState<XpsFitResult | null>(null);
    const [aiConclusion, setAiConclusion] = useState<string | null>(null);
    const [bgType, setBgType] = useState<BackgroundType>('shirley');
    const [numPeaks, setNumPeaks] = useState<number>(0); // 0 = auto
    const [showQcDetails, setShowQcDetails] = useState(false);
    const [showPeakParams, setShowPeakParams] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const reportAreaRef = useRef<HTMLDivElement>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);

    // --- Library ---
    const [savedRecords, setSavedRecords] = useState<XpsRecord[]>(() => {
        try { return JSON.parse(localStorage.getItem('sciflow_xps_library') || '[]'); } catch { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const [saveMilestoneId, setSaveMilestoneId] = useState('');
    const [saveLogId, setSaveLogId] = useState('');
    const [saveTitle, setSaveTitle] = useState('');
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

    // --- Compare ---
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [contextLinkTargetRecordId, setContextLinkTargetRecordId] = useState<string | null>(null);

    // --- Catalyst Diagnosis ---
    const [compareBeforeId, setCompareBeforeId] = useState<string>('');
    const [compareAfterId, setCompareAfterId] = useState<string>('');

    // --- Collapse States (all collapsed by default) ---
    const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
        elements: true, data: true, qc: true, fitParams: true,
        peaks: true, conclusion: false, valence: true, nitrogen: true, oxygen: true, compare: true, ratio: true
    });
    const toggleCard = (key: string) => setCollapsedCards(prev => ({ ...prev, [key]: !prev[key] }));

    const valenceResult = useMemo(() => {
        if (!fitResult) return null;
        return analyzeValenceRatio(fitResult, activeElement);
    }, [fitResult, activeElement]);

    const nitrogenResult = useMemo(() => {
        if (!fitResult || activeElement !== 'N 1s') return null;
        return classifyNitrogenSpecies(fitResult);
    }, [fitResult, activeElement]);

    const oxygenResult = useMemo(() => {
        if (!fitResult || activeElement !== 'O 1s') return null;
        return classifyOxygenSpecies(fitResult);
    }, [fitResult, activeElement]);

    const beforeAfterResult = useMemo(() => {
        if (!compareBeforeId || !compareAfterId) return null;
        const before = savedRecords.find(r => r.id === compareBeforeId);
        const after = savedRecords.find(r => r.id === compareAfterId);
        if (!before || !after) return null;
        return compareBeforeAfter(before, after);
    }, [compareBeforeId, compareAfterId, savedRecords]);

    useEffect(() => {
        localStorage.setItem('sciflow_xps_library', JSON.stringify(savedRecords));
    }, [savedRecords]);

    useEffect(() => {
        if (traceRecordId) {
            const record = savedRecords.find(r => r.id === traceRecordId);
            if (record) { handleLoadRecord(record); showToast({ message: `已溯源至: ${record.title}`, type: 'info' }); }
            else { showToast({ message: "未找到关联记录", type: 'error' }); }
        }
    }, [traceRecordId]);

    // --- Data parsing on rawData change ---
    useEffect(() => {
        if (!rawData.trim()) { setParsedData([]); setQcReport(null); return; }
        const { data, qc } = cleanAndValidateXpsData(rawData);
        setParsedData(data);
        setQcReport(qc);
    }, [rawData]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try { const text = await file.text(); setRawData(text); showToast({ message: "能谱数据已加载", type: 'success' }); }
        catch { showToast({ message: "文件读取失败", type: 'error' }); }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRunXpsAudit = () => {
        if (parsedData.length < 5) { showToast({ message: "请先粘贴或上传能谱数据", type: 'info' }); return; }
        setIsAnalysing(true);
        setTimeout(() => {
            const result = runXpsAnalysis(parsedData, activeElement, bgType, numPeaks > 0 ? numPeaks : undefined);
            const context = resolveContextForAnalysis({
                projects,
                selectedProjectId,
                savedRecords,
                currentRecordId
            });
            const contextText = context
                ? `\n\n【实验记录上下文】${buildContextSummary(context)}`
                : '\n\n【实验记录上下文】未关联实验记录，本次结论基于纯 XPS 数据。';
            setFitResult(result);
            if (result && result.peaks.length > 0) {
                const mainPeak = result.peaks.reduce((a, b) => a.area > b.area ? a : b);
                const totalArea = result.peaks.reduce((s, p) => s + p.area, 0);
                const valenceStr = result.peaks.filter(p => !p.chemicalState.includes('Satellite') && !p.chemicalState.includes('Unknown'))
                    .map(p => `${p.chemicalState}: ${(p.area / totalArea * 100).toFixed(0)}%`).join(', ');
                setAiConclusion(
                    `${activeElement} 高分辨谱的 Pseudo-Voigt 分峰拟合（${bgType === 'shirley' ? 'Shirley' : bgType === 'linear' ? 'Linear' : 'No'} 背景扣除，R² = ${result.rSquared}）识别出 ${result.peaks.length} 个组分峰。` +
                    `主峰结合能 ${mainPeak.center} eV，归属为 ${mainPeak.chemicalState}（FWHM = ${mainPeak.fwhm} eV）。` +
                    (valenceStr ? ` 各化学态面积占比：${valenceStr}。` : '') +
                    ` 拟合残差 χ² = ${result.chiSquared}，表明拟合质量${result.rSquared > 0.98 ? '优异' : result.rSquared > 0.95 ? '良好' : '一般'}。` +
                    contextText
                );
            }
            setIsAnalysing(false);
            showToast({ message: "XPS 峰位拟合完成", type: 'success' });
        }, 600);
    };

    const handleDemoLoad = () => {
        const demoText = generateXpsMockRawText(activeElement);
        setRawData(demoText);
        setCurrentRecordId(null);
        setFitResult(null);
        setAiConclusion(null);
        showToast({ message: `${activeElement} 模拟数据已加载`, type: 'success' });
    };

    const handleFullDemo = () => {
        // 生成全部元素的DEMO数据并保存到方案库,方便展示催化剂诊断功能
        const catalystElements = ['Co 2p', 'N 1s', 'O 1s', 'Fe 2p'];
        const demoRecords: XpsRecord[] = catalystElements.map((el, idx) => {
            const mockData = generateXpsMockData(el);
            const mockText = `# ${el} XPS\n` + mockData.map(d => `${d.be}\t${d.intensity}`).join('\n');
            const bgData = computeBackground(mockData, 'shirley');
            const fit = runXpsAnalysis(mockData, el, 'shirley');
            return {
                id: `demo-xps-${Date.now()}-${idx}`,
                title: `DEMO_${el}_Catalyst`,
                timestamp: new Date().toLocaleString(),
                data: {
                    element: el, rawData: mockText, parsedData: mockData,
                    fitResult: fit, quantResult: null, bgType: 'shirley' as BackgroundType,
                    aiConclusion: `${el} 全功能示例分析。`,
                }
            };
        });
        setSavedRecords(prev => [...demoRecords, ...prev]);
        // 加载当前元素
        handleDemoLoad();
        setTimeout(() => handleRunXpsAudit(), 200);
    };

    const handleClearWorkspace = () => {
        if (!rawData && !fitResult) return;
        if (!confirm('确定要清空 XPS 工作区吗？')) return;
        setRawData(''); setParsedData([]); setFitResult(null); setAiConclusion(null);
        setQcReport(null); setCurrentRecordId(null); setCompareIds([]);
        showToast({ message: 'XPS 工作区已清空', type: 'info' });
    };

    const handleExportPDF = async () => {
        if (!reportAreaRef.current) return;
        showToast({ message: '正在生成 XPS 报告...', type: 'info' });
        await printElement(reportAreaRef.current, saveTitle || 'XPS_Report');
    };

    // --- Library ---
    const handleSaveRecord = () => {
        if (!saveTitle.trim()) return;
        const recordId = currentRecordId || Date.now().toString();
        const existing = savedRecords.find(r => r.id === recordId);
        const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
        const record: XpsRecord = {
            id: recordId, title: saveTitle, timestamp: new Date().toLocaleString(),
            folder: (existing as any)?.folder || fallbackFolder,
            linkedContext: (existing as any)?.linkedContext || null,
            data: { element: activeElement, rawData, parsedData, fitResult, quantResult: null, bgType, aiConclusion }
        };
        setSavedRecords(prev => {
            const exists = prev.some(r => r.id === recordId);
            return exists ? prev.map(r => r.id === recordId ? record : r) : [record, ...prev];
        });
        setCurrentRecordId(recordId); setShowSaveModal(false); setSaveTitle('');
        setSaveMilestoneId(''); setSaveLogId('');
        showToast({ message: currentRecordId ? '已覆盖更新' : '已归档', type: 'success' });
    };

    // 快速保存：已有记录直接覆盖，没有则弹窗新建
    const handleQuickSave = () => {
        if (currentRecordId) {
            const existing = savedRecords.find(r => r.id === currentRecordId);
            if (existing) {
                const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
                const record: XpsRecord = {
                    id: currentRecordId, title: existing.title, timestamp: new Date().toLocaleString(),
                    folder: (existing as any)?.folder || fallbackFolder,
                    linkedContext: (existing as any)?.linkedContext || null,
                    data: { element: activeElement, rawData, parsedData, fitResult, quantResult: null, bgType, aiConclusion }
                };
                setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? record : r));
                showToast({ message: '已覆盖更新', type: 'success' });
                return;
            }
        }
        setSaveTitle(`${activeElement} Fit_${new Date().toLocaleDateString()}`);
        { const a = getAutoSelections(projects, selectedProjectId); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveModal(true); }
    };

    // 另存为：始终创建新记录
    const handleSaveAs = () => {
        setCurrentRecordId(null);
        setSaveTitle('');
        { const a = getAutoSelections(projects, selectedProjectId); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveModal(true); }
    };

    const handleLoadRecord = (record: XpsRecord) => {
        setActiveElement(record.data.element);
        setRawData(record.data.rawData || '');
        setFitResult(record.data.fitResult);
        setAiConclusion(record.data.aiConclusion);
        setBgType(record.data.bgType || 'shirley');
        setCurrentRecordId(record.id);
        setShowLibrary(false);
    };

    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    };

    const toggleCompare = (id: string) => {
        setCompareIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : prev.length >= 4 ? prev : [...prev, id]);
    };

    const compareSamples = useMemo<CompareSample[]>(() => {
        return compareIds.map((id, idx) => {
            const rec = savedRecords.find(r => r.id === id);
            if (!rec) return null;
            return {
                id: rec.id, title: rec.title, element: rec.data.element,
                data: rec.data.parsedData || [], fitResult: rec.data.fitResult,
                color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
            };
        }).filter(Boolean) as CompareSample[];
    }, [compareIds, savedRecords]);

    // --- Sync ---
    const handleSyncConfirm = (tpId: string, tmId: string, tlId: string) => {
        if (!currentRecordId || !fitResult || !onUpdateProject) return;
        const project = projects.find(p => p.id === tpId);
        if (!project) return;
        const title = savedRecords.find(r => r.id === currentRecordId)?.title || `XPS ${new Date().toLocaleDateString()}`;
        const updatedMilestones = project.milestones.map(m => {
            if (m.id === tmId) {
                const updatedLogs = m.logs.map(l => l.id === tlId ? { ...l, linkedAnalysis: { id: currentRecordId, type: 'surface' as const, title } } : l);
                return { ...m, logs: updatedLogs };
            }
            return m;
        });
        onUpdateProject({ ...project, milestones: updatedMilestones });
        setShowSyncModal(false);
        showToast({ message: '已创建溯源链接', type: 'success' });
    };

    const handleSaveToLog = (pId: string, mId: string, lId: string) => {
        if (!fitResult) return;
        const mainPeak = fitResult.peaks.length > 0 ? fitResult.peaks.reduce((a, b) => a.area > b.area ? a : b) : null;
        const chartData = parsedData
            .map(p => ({ x: Number(p.be || 0), y: Number(p.intensity || 0) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        const folder = buildArchiveFolderMeta(projects, pId, mId, lId);
        if (currentRecordId) {
            setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? ({ ...r, folder } as any) : r));
        }
        const linkTitle = savedRecords.find(r => r.id === currentRecordId)?.title || `XPS ${new Date().toLocaleDateString()}`;
        onSave(pId, mId, lId, {
            mode: 'XPS', aiConclusion: aiConclusion || `${activeElement} 分析已同步。`,
            chartData,
            bindingEnergy: mainPeak?.center || 0, rSquared: fitResult.rSquared,
            peaks: fitResult.peaks.map(p => ({ be: p.center, state: p.chemicalState, fwhm: p.fwhm, area: p.area })),
            linkedAnalysisMeta: currentRecordId ? { id: currentRecordId, type: 'surface', title: linkTitle } : undefined
        });
    };

    const handlePushToDataLab = () => {
        if (!fitResult) {
            showToast({ message: '请先完成 XPS 拟合后再推送', type: 'info' });
            return;
        }
        const rawCurve = parsedData
            .map(p => ({ x: Number(p.be || 0), y: Number(p.intensity || 0) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        const envelopeCurve = fitResult.envelope.map((v, idx) => ({
            x: Number(parsedData[idx]?.be),
            y: Number(v)
        })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

        if (rawCurve.length === 0) {
            showToast({ message: '当前暂无可推送的 XPS 图表数据', type: 'info' });
            return;
        }
        const allCurves = [...rawCurve, ...envelopeCurve];
        const xValues = allCurves.map(p => p.x);
        const yValues = allCurves.map(p => p.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const xDomain: [number, number] = minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX];
        const yDomain: [number, number] = minY === maxY ? [minY - 1, maxY + 1] : [minY, maxY];
        updateDataAnalysisSession({
            activeTab: 'chart',
            chartType: 'line',
            chartTitle: `${activeElement} 原始谱线与拟合包络`,
            xAxisLabel: 'Binding Energy (eV)',
            yAxisLabel: 'Intensity (cps)',
            xDomain,
            yDomain,
            seriesList: [
                {
                    id: `xps_raw_push_${Date.now()}`,
                    name: `${activeElement} 原始谱线`,
                    data: rawCurve.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                    color: '#0891b2',
                    pointColor: '#0891b2',
                    strokeWidth: 2,
                    pointShape: 'circle',
                    pointSize: 2,
                    visible: true
                },
                ...(envelopeCurve.length > 0 ? [{
                    id: `xps_fit_push_${Date.now()}`,
                    name: `${activeElement} 拟合包络`,
                    data: envelopeCurve.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                    color: '#ef4444',
                    pointColor: '#ef4444',
                    strokeWidth: 2,
                    pointShape: 'none',
                    pointSize: 0,
                    visible: true
                }] : [])
            ]
        });
        navigate('data');
        showToast({ message: '已推送到实验数据分析室，可直接继续美化', type: 'success' });
    };

    const filteredRecords = savedRecords.filter(r => !selectedProjectId || !(r as any).projectId || (r as any).projectId === selectedProjectId);

    // ==================== SVG 谱图渲染 ====================
    const svgWidth = 700;
    const svgHeight = 320;
    const margin = { top: 20, right: 30, bottom: 50, left: 65 };
    const plotW = svgWidth - margin.left - margin.right;
    const plotH = svgHeight - margin.top - margin.bottom;

    const { xScale, yScale, xTicks, yTicks } = useMemo(() => {
        if (parsedData.length < 2) return {
            xScale: (v: number) => 0, yScale: (v: number) => plotH,
            xTicks: [] as number[], yTicks: [] as number[]
        };
        const beMin = Math.min(...parsedData.map(d => d.be));
        const beMax = Math.max(...parsedData.map(d => d.be));
        const iMax = Math.max(...parsedData.map(d => d.intensity));

        // XPS惯例：BE从高到低（左高右低）
        const xS = (be: number) => ((beMax - be) / (beMax - beMin || 1)) * plotW;
        const yS = (intensity: number) => plotH - (intensity / (iMax * 1.1 || 1)) * plotH;

        const xT: number[] = [];
        const step = Math.ceil((beMax - beMin) / 6);
        for (let v = Math.ceil(beMin); v <= beMax; v += step) xT.push(v);

        const yT: number[] = [];
        const yStep = Math.ceil(iMax / 5 / 1000) * 1000;
        if (yStep > 0) for (let v = 0; v <= iMax * 1.05; v += yStep) yT.push(v);

        return { xScale: xS, yScale: yS, xTicks: xT, yTicks: yT };
    }, [parsedData, plotW, plotH]);

    const bgData = useMemo(() => {
        if (parsedData.length < 3) return [];
        return computeBackground(parsedData, bgType);
    }, [parsedData, bgType]);

    return (
        <div className="h-full flex flex-col p-6 gap-4 animate-reveal relative">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {traceRecordId && (
                        <button onClick={onBack} className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-2">
                            <i className="fa-solid fa-arrow-left"></i> 返回
                        </button>
                    )}
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">表面化学分析 (XPS)</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">X-ray Photoelectron Spectroscopy Peak Fitting</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 数据操作组 */}
                    <button onClick={handleFullDemo} className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95">
                        <i className="fa-solid fa-flask-vial mr-1"></i> 加载示例
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 记录管理组 */}
                    <div className="relative">
                        <div className="flex items-stretch">
                            <button onClick={handleQuickSave} disabled={!fitResult}
                                className="px-4 py-2 bg-white border border-r-0 border-slate-200 text-slate-600 rounded-l-xl text-[10px] font-black uppercase hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-40">
                                <i className="fa-solid fa-floppy-disk mr-1"></i> 保存
                            </button>
                            <button onClick={() => setShowSaveDropdown(!showSaveDropdown)} disabled={!fitResult}
                                className="px-1.5 py-2 bg-white border border-slate-200 text-slate-400 rounded-r-xl text-[10px] hover:text-indigo-600 hover:border-indigo-400 transition-all active:scale-95 disabled:opacity-40">
                                <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveDropdown ? 'rotate-180' : ''}`}></i>
                            </button>
                        </div>
                        {showSaveDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 min-w-[120px]">
                                <button onClick={() => { handleQuickSave(); setShowSaveDropdown(false); }}
                                    className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2">
                                    <i className="fa-solid fa-floppy-disk text-[10px]"></i> 保存
                                </button>
                                <button onClick={() => { handleSaveAs(); setShowSaveDropdown(false); }}
                                    className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-600 transition-all flex items-center gap-2">
                                    <i className="fa-solid fa-copy text-[10px]"></i> 另存为
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowLibrary(true)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all active:scale-95">
                        <i className="fa-solid fa-box-archive mr-1"></i> 方案库
                        {filteredRecords.length > 0 && <span className="ml-1 bg-indigo-600 text-white text-[7px] px-1.5 py-0.5 rounded-full font-black">{filteredRecords.length}</span>}
                    </button>
                    <button
                        onClick={handlePushToDataLab}
                        disabled={!fitResult}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                        title="无需同步，直接推送到实验数据分析室"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 推送数据分析室
                    </button>
                    <button onClick={() => { if (!currentRecordId || !fitResult) { showToast({ message: '先保存方案再同步', type: 'info' }); return; } setShowSyncModal(true); }} disabled={!currentRecordId || !fitResult}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5">
                        <i className="fa-solid fa-link"></i> 同步
                    </button>
                    <button
                        onClick={() => {
                            if (!currentRecordId) {
                                showToast({ message: '请先保存方案后再关联实验记录', type: 'info' });
                                return;
                            }
                            setContextLinkTargetRecordId(currentRecordId);
                        }}
                        className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-paperclip"></i> 关联记录
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 清空 */}
                    <button onClick={handleClearWorkspace} disabled={!rawData && !fitResult}
                        className="px-4 py-2 bg-white border border-slate-200 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-40">
                        <i className="fa-solid fa-trash-can mr-1"></i> 清空
                    </button>
                </div>
            </div>

            <div ref={reportAreaRef} className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden is-printing-target">
                {/* Left Panel - Input & Controls */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar no-print">
                    {/* Element Selection */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div onClick={() => toggleCard('elements')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 transition-colors rounded-t-2xl select-none">
                            <h4 className="text-xs font-black text-indigo-500 uppercase tracking-wide flex items-center gap-2">
                                <i className="fa-solid fa-atom"></i> 元素轨道
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-full">{activeElement}</span>
                                <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['elements'] ? '-rotate-90' : ''}`}></i>
                            </div>
                        </div>
                        {!collapsedCards['elements'] && (
                            <div className="px-4 pb-4">
                                <div className="grid grid-cols-4 gap-1.5">
                                    {ELEMENTS.map(el => (
                                        <button key={el} onClick={() => setActiveElement(el)}
                                            className={`py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeElement === el ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400 hover:border-indigo-300'}`}>
                                            {el}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Data Input */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
                        <div onClick={() => toggleCard('data')} className="flex justify-between items-center p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wide flex items-center gap-2 cursor-pointer">
                                <i className="fa-solid fa-database text-emerald-500"></i> 能谱数据 (BE, Counts)
                            </label>
                            <div className="flex items-center gap-2">
                                <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.csv,.xy,.dat" onChange={handleFileUpload} />
                                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100">
                                    <i className="fa-solid fa-file-upload mr-1"></i> 导入
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDemoLoad(); }} className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all border border-amber-100">
                                    示例
                                </button>
                                <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['data'] ? '-rotate-90' : ''}`}></i>
                            </div>
                        </div>
                        {!collapsedCards['data'] && (
                            <div className="px-4 pb-4 flex-1 flex flex-col min-h-0">
                                <textarea
                                    className="w-full flex-1 min-h-[100px] bg-slate-50 rounded-xl p-3 text-[10px] font-mono text-emerald-700 outline-none shadow-inner resize-none custom-scrollbar leading-relaxed border border-slate-100 focus:border-indigo-300"
                                    placeholder={`粘贴 ${activeElement} 能谱数据 (BE eV, Intensity cps)...`}
                                    value={rawData} onChange={e => setRawData(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* QC Report */}
                    {qcReport && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-reveal">
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none" onClick={() => setShowQcDetails(!showQcDetails)}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${qcReport.warnings.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">数据质控</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{qcReport.validPoints} pts</span>
                                    {qcReport.snr > 0 && <span className="text-[7px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">SNR {qcReport.snr}</span>}
                                    <i className={`fa-solid fa-chevron-${showQcDetails ? 'up' : 'down'} text-[7px] text-slate-400`}></i>
                                </div>
                            </div>
                            {showQcDetails && (
                                <div className="mt-2 px-4 pb-4 space-y-1.5 animate-reveal">
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="bg-slate-50 p-1.5 rounded-lg text-center"><p className="text-[6px] font-black text-slate-400 uppercase">BE范围</p><p className="text-[9px] font-black text-slate-700 font-mono">{qcReport.beRange[0]}–{qcReport.beRange[1]}</p></div>
                                        <div className="bg-slate-50 p-1.5 rounded-lg text-center"><p className="text-[6px] font-black text-slate-400 uppercase">噪声</p><p className="text-[9px] font-black text-slate-700 font-mono">{qcReport.noiseLevel}</p></div>
                                        <div className="bg-slate-50 p-1.5 rounded-lg text-center"><p className="text-[6px] font-black text-slate-400 uppercase">过滤</p><p className="text-[9px] font-black text-slate-700 font-mono">{qcReport.invalidRemoved}</p></div>
                                    </div>
                                    {qcReport.warnings.map((w, i) => (
                                        <div key={i} className="flex items-start gap-1.5 text-[8px] text-amber-700 bg-amber-50/50 p-1.5 rounded-lg border border-amber-100">
                                            <i className="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 shrink-0"></i><span className="font-bold">{w}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Fit Controls */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                        <div onClick={() => toggleCard('fitParams')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-violet-50/50 transition-colors rounded-t-2xl select-none">
                            <h5 className="text-xs font-black text-violet-600 uppercase tracking-wide flex items-center gap-2">
                                <i className="fa-solid fa-sliders"></i> 拟合参数
                            </h5>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-violet-500 bg-white px-2 py-0.5 rounded-full">{bgType} · {numPeaks === 0 ? '自动' : numPeaks + '峰'}</span>
                                <i className={`fa-solid fa-chevron-down text-[8px] text-violet-400 transition-transform ${collapsedCards['fitParams'] ? '-rotate-90' : ''}`}></i>
                            </div>
                        </div>
                        {!collapsedCards['fitParams'] && (
                            <div className="px-4 pb-4 space-y-3">
                                <div>
                                    <label className="text-[9px] font-black text-violet-400 uppercase mb-1 block">背景扣除</label>
                                    <div className="flex bg-white rounded-lg p-0.5 border border-violet-100">
                                        {(['shirley', 'linear', 'none'] as BackgroundType[]).map(bt => (
                                            <button key={bt} onClick={() => setBgType(bt)}
                                                className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${bgType === bt ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-violet-600'}`}>
                                                {bt === 'shirley' ? 'Shirley' : bt === 'linear' ? 'Linear' : 'None'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-violet-400 uppercase mb-1 block">峰数目（0=自动）</label>
                                    <div className="flex items-center gap-2">
                                        <input type="range" min="0" max="8" value={numPeaks} onChange={e => setNumPeaks(Number(e.target.value))}
                                            className="flex-1 accent-violet-600" />
                                        <span className="text-xs font-black text-violet-700 bg-white px-2 py-0.5 rounded-lg border border-violet-100 w-8 text-center font-mono">
                                            {numPeaks === 0 ? 'A' : numPeaks}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={handleRunXpsAudit} disabled={isAnalysing || parsedData.length < 5}
                        className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] text-[9px] font-black uppercase tracking-[0.15rem] shadow-2xl shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                        {isAnalysing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-atom"></i>}
                        执行 {activeElement} 峰位拟合
                    </button>
                </div>

                {/* Right Panel - Chart & Results */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-3 overflow-y-auto custom-scrollbar print:col-span-12">
                    {/* Interactive SVG Chart */}
                    <div className={`bg-white rounded-[2rem] border shadow-xl p-4 relative transition-all ${traceRecordId ? 'border-amber-400' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{activeElement} High-Resolution XPS</span>
                            {fitResult && <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">R² = {fitResult.rSquared}</span>}
                        </div>

                        <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-slate-50/50 rounded-xl">
                            <g transform={`translate(${margin.left},${margin.top})`}>
                                {/* Grid */}
                                {yTicks.map(t => <line key={`gy${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="3 3" />)}

                                {/* Background curve */}
                                {parsedData.length > 2 && bgType !== 'none' && bgData.length > 0 && (
                                    <path d={parsedData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.be)} ${yScale(bgData[i])}`).join(' ')}
                                        fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
                                )}

                                {/* Fitted peak curves */}
                                {fitResult?.peaks.map((peak, pi) => {
                                    const points = parsedData.map(d => {
                                        const y = voigtPeak(d.be, peak.center, peak.fwhm, peak.height, peak.mixRatio) + (bgData[parsedData.indexOf(d)] || 0);
                                        return `${xScale(d.be)} ${yScale(y)}`;
                                    });
                                    // Fill under peak
                                    const fillPoints = parsedData.map((d, i) => {
                                        const py = voigtPeak(d.be, peak.center, peak.fwhm, peak.height, peak.mixRatio) + (bgData[i] || 0);
                                        return `${xScale(d.be)},${yScale(py)}`;
                                    });
                                    const bgLine = parsedData.map((d, i) => `${xScale(d.be)},${yScale(bgData[i] || 0)}`).reverse();
                                    return (
                                        <g key={pi}>
                                            <polygon points={[...fillPoints, ...bgLine].join(' ')} fill={peak.color} opacity="0.12" />
                                            <path d={parsedData.map((d, i) => {
                                                const py = voigtPeak(d.be, peak.center, peak.fwhm, peak.height, peak.mixRatio) + (bgData[i] || 0);
                                                return `${i === 0 ? 'M' : 'L'} ${xScale(d.be)} ${yScale(py)}`;
                                            }).join(' ')} fill="none" stroke={peak.color} strokeWidth="1.5" opacity="0.8" />
                                        </g>
                                    );
                                })}

                                {/* Envelope */}
                                {fitResult && (
                                    <path d={parsedData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(d.be)} ${yScale(fitResult.envelope[i])}`).join(' ')}
                                        fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="2 1" />
                                )}

                                {/* Raw data points */}
                                {parsedData.map((d, i) => (
                                    <circle key={i} cx={xScale(d.be)} cy={yScale(d.intensity)} r="1.8"
                                        fill={fitResult ? '#334155' : '#6366f1'} opacity="0.7" />
                                ))}

                                {/* Peak labels */}
                                {fitResult?.peaks.map((peak, i) => (
                                    <g key={`lbl${i}`}>
                                        <line x1={xScale(peak.center)} y1={yScale(peak.height + (bgData[0] || 0)) - 5}
                                            x2={xScale(peak.center)} y2={yScale(peak.height + (bgData[0] || 0)) - 25}
                                            stroke={peak.color} strokeWidth="1" />
                                        <text x={xScale(peak.center)} y={yScale(peak.height + (bgData[0] || 0)) - 28}
                                            textAnchor="middle" fill={peak.color} fontSize="8" fontWeight="bold">
                                            {peak.center} eV
                                        </text>
                                        <text x={xScale(peak.center)} y={yScale(peak.height + (bgData[0] || 0)) - 38}
                                            textAnchor="middle" fill="#64748b" fontSize="6.5" fontWeight="bold">
                                            {peak.chemicalState.length > 15 ? peak.chemicalState.slice(0, 15) + '…' : peak.chemicalState}
                                        </text>
                                    </g>
                                ))}

                                {/* Axes */}
                                <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="#334155" strokeWidth="2" />
                                <line x1={0} y1={0} x2={0} y2={plotH} stroke="#334155" strokeWidth="2" />
                                {xTicks.map(t => (
                                    <g key={`xt${t}`}>
                                        <line x1={xScale(t)} y1={plotH} x2={xScale(t)} y2={plotH + 5} stroke="#334155" strokeWidth="1.5" />
                                        <text x={xScale(t)} y={plotH + 16} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="bold">{t}</text>
                                    </g>
                                ))}
                                {yTicks.map(t => (
                                    <g key={`yt${t}`}>
                                        <line x1={-5} y1={yScale(t)} x2={0} y2={yScale(t)} stroke="#334155" strokeWidth="1.5" />
                                        <text x={-10} y={yScale(t) + 3} textAnchor="end" fill="#64748b" fontSize="8" fontWeight="bold">{(t / 1000).toFixed(0)}k</text>
                                    </g>
                                ))}
                                <text x={plotW / 2} y={plotH + 38} textAnchor="middle" fill="#334155" fontSize="10" fontWeight="900" className="uppercase">Binding Energy (eV)</text>
                                <text x={-40} y={plotH / 2} textAnchor="middle" fill="#334155" fontSize="10" fontWeight="900" transform={`rotate(-90, -40, ${plotH / 2})`}>Intensity</text>
                            </g>
                        </svg>
                    </div>

                    {/* Results Area */}
                    {fitResult && (
                        <>
                            {/* Peak Parameters Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-md animate-reveal">
                                <div onClick={() => toggleCard('peaks')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                                    <h5 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                        <i className="fa-solid fa-table-list text-indigo-500"></i> 分峰参数
                                    </h5>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{fitResult.peaks.length} 个组分</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${fitResult.rSquared > 0.98 ? 'text-emerald-600 bg-emerald-50' : fitResult.rSquared > 0.95 ? 'text-indigo-600 bg-indigo-50' : 'text-amber-600 bg-amber-50'}`}>
                                            R² = {fitResult.rSquared}
                                        </span>
                                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['peaks'] ? '-rotate-90' : ''}`}></i>
                                    </div>
                                </div>
                                {!collapsedCards['peaks'] && (
                                    <div className="px-4 pb-4 overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b-2 border-slate-200">
                                                    <th className="text-left font-black text-slate-400 uppercase py-2 px-2">峰</th>
                                                    <th className="text-center font-black text-slate-400 uppercase py-2">BE (eV)</th>
                                                    <th className="text-center font-black text-slate-400 uppercase py-2">FWHM</th>
                                                    <th className="text-center font-black text-slate-400 uppercase py-2">面积</th>
                                                    <th className="text-center font-black text-slate-400 uppercase py-2">面积%</th>
                                                    <th className="text-left font-black text-slate-400 uppercase py-2 px-2">化学态</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fitResult.peaks.map((peak, i) => {
                                                    const totalArea = fitResult.peaks.reduce((s, p) => s + p.area, 0);
                                                    return (
                                                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                            <td className="py-2 px-2"><div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: peak.color }}></div><span className="font-black text-slate-500">#{i + 1}</span></div></td>
                                                            <td className="text-center font-mono font-black text-slate-700">{peak.center}</td>
                                                            <td className="text-center font-mono font-black text-slate-600">{peak.fwhm}</td>
                                                            <td className="text-center font-mono font-black text-slate-600">{peak.area.toFixed(0)}</td>
                                                            <td className="text-center font-mono font-black text-indigo-600">{totalArea > 0 ? (peak.area / totalArea * 100).toFixed(1) : 0}%</td>
                                                            <td className="text-left px-2 font-black text-slate-700">{peak.chemicalState}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* AI Conclusion */}
                            {aiConclusion && (
                                <div className="bg-slate-900 rounded-2xl text-white shadow-2xl relative" style={{ minHeight: '48px' }}>
                                    <div onClick={() => toggleCard('conclusion')} className="flex gap-3 items-center p-4 cursor-pointer hover:bg-white/5 transition-colors select-none rounded-t-2xl">
                                        <i className="fa-solid fa-wand-magic-sparkles text-amber-400 animate-pulse"></i>
                                        <h5 className="text-xs font-black text-indigo-400 uppercase tracking-wide flex-1">智能拟合结论</h5>
                                        <button onClick={(e) => { e.stopPropagation(); handleExportPDF(); }} className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-white hover:text-indigo-600 transition-all no-print shrink-0">
                                            <i className="fa-solid fa-file-pdf mr-1"></i> PDF
                                        </button>
                                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-500 transition-transform ${collapsedCards['conclusion'] ? '-rotate-90' : ''}`}></i>
                                    </div>
                                    {!collapsedCards['conclusion'] && (
                                        <div className="px-4 pb-4">
                                            <p className="text-xs font-medium leading-relaxed italic text-slate-100/90 text-justify">{aiConclusion}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ===== 催化剂诊断面板 ===== */}

                            {/* 价态比例分析 (Co/Ni/Fe) */}
                            {valenceResult && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-md animate-reveal">
                                    <div onClick={() => toggleCard('valence')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                                        <h5 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                            <i className="fa-solid fa-atom text-violet-500"></i> 价态分峰定量
                                        </h5>
                                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['valence'] ? '-rotate-90' : ''}`}></i>
                                    </div>
                                    {!collapsedCards['valence'] && (
                                        <div className="px-4 pb-4">
                                            <div className="flex items-end gap-2 h-24 mb-3">
                                                {valenceResult.valences.map((v, i) => (
                                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                        <span className="text-[10px] font-black font-mono" style={{ color: v.color }}>{v.percent}%</span>
                                                        <div className="w-full rounded-t-xl transition-all hover:scale-105" style={{ backgroundColor: v.color, height: `${Math.max(8, v.percent * 0.8)}px`, opacity: 0.85 }}></div>
                                                        <span className="text-[9px] font-black text-slate-500 text-center leading-tight">{v.state}</span>
                                                        <span className="text-[8px] font-mono text-slate-400">{v.be} eV</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {valenceResult.ratio && (
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">比值</span>
                                                    <span className="text-xs font-black font-mono text-indigo-600">{valenceResult.ratio}</span>
                                                </div>
                                            )}
                                            <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                <p className="text-[10px] text-indigo-700 font-bold leading-relaxed italic">
                                                    <i className="fa-solid fa-flask text-indigo-400 mr-1"></i>{valenceResult.catalyticNote}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* N 1s 氮物种分类 */}
                            {nitrogenResult && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-md animate-reveal">
                                    <div onClick={() => toggleCard('nitrogen')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                                        <h5 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                            <i className="fa-solid fa-diagram-project text-rose-500"></i> N 1s 活性位分类
                                        </h5>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">活性N: {nitrogenResult.activeNPercent}%</span>
                                            <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['nitrogen'] ? '-rotate-90' : ''}`}></i>
                                        </div>
                                    </div>
                                    {!collapsedCards['nitrogen'] && (
                                        <div className="px-4 pb-4">
                                            {/* Mini pie chart via CSS conic-gradient */}
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 h-20 rounded-full border-2 border-slate-100 shadow-inner shrink-0" style={{
                                                    background: `conic-gradient(${nitrogenResult.species.map((s, i, arr) => {
                                                        const start = arr.slice(0, i).reduce((sum, x) => sum + x.percent, 0);
                                                        return `${s.color} ${start}% ${start + s.percent}%`;
                                                    }).join(', ')})`
                                                }}></div>
                                                <div className="flex-1 space-y-1.5">
                                                    {nitrogenResult.species.map((s, i) => (
                                                        <div key={i} className="flex items-center gap-2 group">
                                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }}></div>
                                                            <span className="text-[10px] font-black text-slate-600 w-14">{s.type}</span>
                                                            <span className="text-[10px] font-mono font-black text-slate-500">{s.percent}%</span>
                                                            <span className="text-[8px] text-slate-400 hidden group-hover:inline truncate">{s.catalyticRole.split('：')[0]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {nitrogenResult.totalMNx > 0 && (
                                                <div className="mt-3 p-2.5 bg-rose-50/50 rounded-xl border border-rose-100">
                                                    <p className="text-[10px] text-rose-700 font-bold leading-relaxed italic">
                                                        <i className="fa-solid fa-star text-rose-400 mr-1"></i>
                                                        M-Nₓ 含量 = {nitrogenResult.totalMNx}% — {nitrogenResult.conclusion}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* O 1s 氧物种分析 */}
                            {oxygenResult && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-md animate-reveal">
                                    <div onClick={() => toggleCard('oxygen')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                                        <h5 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                            <i className="fa-solid fa-fire-flame-curved text-orange-500"></i> O 1s 氧物种解析
                                        </h5>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                                Ov比: {oxygenResult.oxygenVacancyRatio}
                                            </span>
                                            <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['oxygen'] ? '-rotate-90' : ''}`}></i>
                                        </div>
                                    </div>
                                    {!collapsedCards['oxygen'] && (
                                        <div className="px-4 pb-4">
                                            <div className="space-y-2">
                                                {oxygenResult.species.map((s, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }}></div>
                                                        <span className="text-[10px] font-black text-slate-600 w-20 shrink-0">{s.type}</span>
                                                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ backgroundColor: s.color, width: `${Math.min(100, s.percent)}%`, opacity: 0.8 }}></div>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-black text-slate-500 w-10 text-right">{s.percent}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-3 p-2.5 bg-orange-50/50 rounded-xl border border-orange-100">
                                                <p className="text-[10px] text-orange-700 font-bold leading-relaxed italic">
                                                    <i className="fa-solid fa-circle-info text-orange-400 mr-1"></i>{oxygenResult.conclusion}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 电化学前后对比 */}
                            {savedRecords.length >= 2 && fitResult && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-md animate-reveal">
                                    <div onClick={() => toggleCard('compare')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                                        <h5 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                            <i className="fa-solid fa-right-left text-sky-500"></i> 电化学前后 XPS 对比
                                        </h5>
                                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['compare'] ? '-rotate-90' : ''}`}></i>
                                    </div>
                                    {!collapsedCards['compare'] && (
                                        <div className="px-4 pb-4">
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div>
                                                    <label className="text-[7px] font-black text-slate-400 uppercase block mb-1">Before (原始)</label>
                                                    <select value={compareBeforeId} onChange={e => setCompareBeforeId(e.target.value)}
                                                        className="w-full text-[8px] p-2 border border-slate-200 rounded-xl bg-slate-50 font-bold">
                                                        <option value="">选择记录...</option>
                                                        {savedRecords.filter(r => r.data.fitResult).map(r => (
                                                            <option key={r.id} value={r.id}>{r.title} ({r.data.element})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[7px] font-black text-slate-400 uppercase block mb-1">After (循环后)</label>
                                                    <select value={compareAfterId} onChange={e => setCompareAfterId(e.target.value)}
                                                        className="w-full text-[8px] p-2 border border-slate-200 rounded-xl bg-slate-50 font-bold">
                                                        <option value="">选择记录...</option>
                                                        {savedRecords.filter(r => r.data.fitResult && r.id !== compareBeforeId).map(r => (
                                                            <option key={r.id} value={r.id}>{r.title} ({r.data.element})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            {beforeAfterResult ? (
                                                <div className="space-y-3">
                                                    {/* Stability score ring */}
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-16 h-16 rounded-full border-4 border-slate-100 flex items-center justify-center shadow-inner bg-white shrink-0">
                                                            <span className={`text-lg font-black italic font-mono ${beforeAfterResult.stabilityScore > 80 ? 'text-emerald-600' :
                                                                beforeAfterResult.stabilityScore > 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                {beforeAfterResult.stabilityScore}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[7px] font-black text-slate-400 uppercase">稳定性评分</p>
                                                            <p className="text-[7px] font-bold text-slate-500 mt-0.5">平均 BE 偏移: {beforeAfterResult.overallShift} eV</p>
                                                        </div>
                                                    </div>
                                                    {/* Comparison table */}
                                                    <table className="w-full text-[7px]">
                                                        <thead><tr className="border-b border-slate-200">
                                                            <th className="text-left py-1.5 font-black text-slate-400 uppercase">化学态</th>
                                                            <th className="text-center py-1.5 font-black text-slate-400 uppercase">Before</th>
                                                            <th className="text-center py-1.5 font-black text-slate-400 uppercase">After</th>
                                                            <th className="text-center py-1.5 font-black text-slate-400 uppercase">ΔBE</th>
                                                            <th className="text-center py-1.5 font-black text-slate-400 uppercase">Δ%</th>
                                                        </tr></thead>
                                                        <tbody>
                                                            {beforeAfterResult.peakComparisons.map((c, i) => (
                                                                <tr key={i} className="border-b border-slate-50">
                                                                    <td className="py-1.5 font-black text-slate-600">{c.chemicalState.split('(')[0].trim()}</td>
                                                                    <td className="text-center font-mono text-slate-500">{c.beforePercent}%</td>
                                                                    <td className="text-center font-mono text-slate-500">{c.afterPercent}%</td>
                                                                    <td className={`text-center font-mono font-black ${Math.abs(c.beShift) > 0.3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                        {c.beShift > 0 ? '+' : ''}{c.beShift}
                                                                    </td>
                                                                    <td className={`text-center font-mono font-black ${Math.abs(c.percentChange) > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                        {c.percentChange > 0 ? '+' : ''}{c.percentChange}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    <div className={`p-2.5 rounded-xl border ${beforeAfterResult.stabilityScore > 80 ? 'bg-emerald-50/50 border-emerald-100' :
                                                        beforeAfterResult.stabilityScore > 50 ? 'bg-amber-50/50 border-amber-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                                        <p className="text-[8px] font-bold leading-relaxed italic" style={{ color: beforeAfterResult.stabilityScore > 80 ? '#059669' : beforeAfterResult.stabilityScore > 50 ? '#d97706' : '#e11d48' }}>
                                                            <i className="fa-solid fa-clipboard-check mr-1"></i>{beforeAfterResult.conclusion}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic text-center py-4">请选择两条同元素的记录进行前后对比</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 元素定量 (if multiple peaks) */}
                            {fitResult.peaks.length > 1 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-md animate-reveal">
                                    <div onClick={() => toggleCard('ratio')} className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/50 transition-colors rounded-t-2xl select-none">
                                        <h5 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                                            <i className="fa-solid fa-chart-pie text-emerald-500"></i> 化学态占比分析
                                        </h5>
                                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${collapsedCards['ratio'] ? '-rotate-90' : ''}`}></i>
                                    </div>
                                    {!collapsedCards['ratio'] && (
                                        <div className="px-4 pb-4">
                                            <div className="flex items-center gap-3">
                                                {/* Mini bar chart */}
                                                <div className="flex-1 flex items-end gap-1 h-20">
                                                    {fitResult.peaks.filter(p => !p.chemicalState.includes('Unknown')).map((peak, i) => {
                                                        const totalArea = fitResult.peaks.reduce((s, p) => s + p.area, 0);
                                                        const pct = totalArea > 0 ? peak.area / totalArea * 100 : 0;
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                                <span className="text-[10px] font-black text-slate-600 font-mono">{pct.toFixed(0)}%</span>
                                                                <div className="w-full rounded-t-lg transition-all hover:opacity-80" style={{ backgroundColor: peak.color, height: `${Math.max(8, pct * 0.7)}px` }}></div>
                                                                <span className="text-[8px] font-black text-slate-400 text-center leading-tight truncate w-full">{peak.chemicalState.split('(')[0].trim()}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">灵敏度因子</p>
                                                    <p className="text-sm font-black text-indigo-600 font-mono">{SENSITIVITY_FACTORS[activeElement] || '—'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Compare Samples */}
                    {compareSamples.length > 1 && (
                        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-5 animate-reveal">
                            <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.15rem] mb-3 flex items-center gap-2">
                                <i className="fa-solid fa-layer-group text-indigo-500"></i> 多元素对比 ({compareSamples.length}/4)
                            </h5>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[8px]">
                                    <thead><tr className="border-b border-slate-200">
                                        <th className="text-left py-2 px-2 font-black text-slate-400 uppercase">样品</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">元素</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">主峰 BE</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">R²</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">峰数</th>
                                        <th className="text-center py-2 font-black text-slate-400 uppercase">关联</th>
                                    </tr></thead>
                                    <tbody>
                                        {compareSamples.map(s => (
                                            <tr key={s.id} className="border-b border-slate-100">
                                                <td className="py-2 px-2"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div><span className="font-black text-slate-700 truncate max-w-[80px]">{s.title}</span></div></td>
                                                <td className="text-center font-black text-slate-600">{s.element}</td>
                                                <td className="text-center font-mono font-black text-slate-700">{s.fitResult?.peaks[0]?.center || '—'}</td>
                                                <td className="text-center font-mono font-black text-indigo-600">{s.fitResult?.rSquared || '—'}</td>
                                                <td className="text-center font-mono font-black text-slate-600">{s.fitResult?.peaks.length || 0}</td>
                                                <td className="text-center"><button onClick={() => setContextLinkTargetRecordId(s.id)} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[7px] font-black hover:bg-indigo-100 transition-all"><i className="fa-solid fa-link mr-0.5"></i>关联</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!fitResult && parsedData.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-slate-200 rounded-[2rem]">
                            <i className="fa-solid fa-chart-area text-5xl mb-3"></i>
                            <p className="text-[10px] font-black uppercase tracking-widest">请导入能谱数据执行拟合</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Library Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 animate-reveal shadow-2xl border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-lg font-black text-slate-800 mb-4 uppercase italic border-l-4 border-indigo-600 pl-4">XPS 拟合方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <FolderLibraryView
                                records={filteredRecords}
                                onLoad={handleLoadRecord}
                                onDelete={handleDeleteRecord}
                                emptyText="暂无相关存档"
                            />
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-4 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 animate-reveal shadow-2xl border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-4 uppercase italic pl-2">保存 XPS 分析</h3>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-4 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="方案名称..." autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveRecord(); }} />
                        {/* 归档位置选择 */}
                        <div className="space-y-3 mb-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase px-1">归档位置（可选）</p>
                            <div className="relative">
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={saveMilestoneId} onChange={e => { setSaveMilestoneId(e.target.value); const ms = projects.find(p => p.id === selectedProjectId)?.milestones.find(m => m.id === e.target.value); setSaveLogId(ms?.logs?.[0]?.id || ''); }}>
                                    <option value="">选择实验节点...</option>
                                    {flattenMilestonesTree(projects.find(p => p.id === selectedProjectId)?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                            {saveMilestoneId && (
                                <div className="relative animate-reveal">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={saveLogId} onChange={e => setSaveLogId(e.target.value)}>
                                        <option value="">关联实验记录...</option>
                                        {(projects.find(p => p.id === selectedProjectId)?.milestones.find(m => m.id === saveMilestoneId)?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 30)}...</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                            <button onClick={handleSaveRecord} disabled={!saveTitle.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl disabled:opacity-30">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {showSyncModal && (
                <AnalysisSyncModal onClose={() => setShowSyncModal(false)} projects={projects}
                    onConfirm={(pId, mId, lId) => { if (!pId || !mId || !lId) return; handleSaveToLog(pId, mId, lId); }}
                    onConfirmGroup={(pId, mId, gId) => { if (!pId || !mId || !gId) return; handleSaveToLog(pId, mId, `GROUP:${gId}`); setShowSyncModal(false); }}
                    initialProjectId={selectedProjectId} />
            )}
            {contextLinkTargetRecordId && (
                <AnalysisSyncModal
                    onClose={() => setContextLinkTargetRecordId(null)}
                    projects={projects}
                    onConfirm={(pId, mId, lId) => {
                        if (!pId || !mId || !lId) return;
                        setSavedRecords(prev => prev.map(r => r.id === contextLinkTargetRecordId ? { ...r, linkedContext: { projectId: pId, milestoneId: mId, logId: lId } } : r));
                        setContextLinkTargetRecordId(null);
                        showToast({ message: '已为该样品关联实验记录', type: 'success' });
                    }}
                    initialProjectId={selectedProjectId}
                    title="为样品关联实验记录"
                />
            )}
        </div>
    );
};

export default SurfaceChemistryPanel;
