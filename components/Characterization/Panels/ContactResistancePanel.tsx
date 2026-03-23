import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import AnalysisSyncModal, { flattenMilestonesTree, getAutoSelections } from '../AnalysisSyncModal';
import { printElement } from '../../../utils/printUtility';
import { buildArchiveFolderMeta } from '../../../utils/archiveFolder';
import { buildContextSummary, resolveContextForAnalysis } from '../../../utils/experimentContext';
import FolderLibraryView from '../FolderLibraryView';

interface Props {
    projects: ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    onUpdateProject?: (project: ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
    onBack?: () => void;
}

interface ContactPoint {
    pressure: number;
    contactResistance: number;
}

interface MappingPoint {
    x: number;
    y: number;
    value: number;
}

interface FitResult {
    a: number;
    b: number;
    r2: number;
    predicted: ContactPoint[];
}

const DEFAULT_POINTS: ContactPoint[] = [
    { pressure: 0.2, contactResistance: 22.6 },
    { pressure: 0.4, contactResistance: 18.4 },
    { pressure: 0.6, contactResistance: 15.8 },
    { pressure: 0.8, contactResistance: 14.1 },
    { pressure: 1.0, contactResistance: 13.4 }
];

const DEFAULT_MAP: MappingPoint[] = [
    { x: 0, y: 0, value: 14.0 }, { x: 1, y: 0, value: 14.3 }, { x: 2, y: 0, value: 13.8 },
    { x: 0, y: 1, value: 14.4 }, { x: 1, y: 1, value: 14.1 }, { x: 2, y: 1, value: 13.9 },
    { x: 0, y: 2, value: 14.2 }, { x: 1, y: 2, value: 13.7 }, { x: 2, y: 2, value: 14.0 }
];

const parseNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const n = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
};

const fitLogModel = (points: ContactPoint[]): FitResult | null => {
    const usable = points
        .filter(p => p.pressure > 0 && p.contactResistance > 0)
        .sort((a, b) => a.pressure - b.pressure);
    if (usable.length < 3) return null;

    const x = usable.map(p => Math.log(p.pressure));
    const y = usable.map(p => p.contactResistance);
    const n = usable.length;
    const sx = x.reduce((s, v) => s + v, 0);
    const sy = y.reduce((s, v) => s + v, 0);
    const sxx = x.reduce((s, v) => s + v * v, 0);
    const sxy = x.reduce((s, v, i) => s + v * y[i], 0);
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-10) return null;

    const b = (n * sxy - sx * sy) / denom;
    const a = (sy - b * sx) / n;
    const meanY = sy / n;
    const predicted = usable.map(p => ({ pressure: p.pressure, contactResistance: a + b * Math.log(p.pressure) }));
    const ssTot = y.reduce((s, v) => s + (v - meanY) ** 2, 0);
    const ssRes = predicted.reduce((s, p, i) => s + (y[i] - p.contactResistance) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { a, b, r2, predicted };
};

const ContactResistancePanel: React.FC<Props> = ({ projects, onSave, onUpdateProject, selectedProjectId, traceRecordId, onBack }) => {
    const { showToast, updateDataAnalysisSession, navigate } = useProjectContext();
    const [sampleName, setSampleName] = useState('NiFe-LDH@CFP');
    const [inPlaneResistance, setInPlaneResistance] = useState(21.8);
    const [throughPlaneResistance, setThroughPlaneResistance] = useState(58.7);
    const [pressureMpa, setPressureMpa] = useState(0.8);
    const [contactResistance, setContactResistance] = useState(14.1);
    const [curveData, setCurveData] = useState<ContactPoint[]>(DEFAULT_POINTS);
    const [mapData, setMapData] = useState<MappingPoint[]>(DEFAULT_MAP);
    const [analysisText, setAnalysisText] = useState('');
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showContextLinkModal, setShowContextLinkModal] = useState(false);
    const [sourceFilename, setSourceFilename] = useState('');
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

    const [savedRecords, setSavedRecords] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('sciflow_contact_resistance_library') || '[]'); } catch { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [saveMilestoneId, setSaveMilestoneId] = useState('');
    const [saveLogId, setSaveLogId] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const reportAreaRef = useRef<HTMLDivElement>(null);
    const draftKey = useMemo(() => `sciflow_contact_resistance_draft_${selectedProjectId || 'global'}`, [selectedProjectId]);

    const anisotropyRatio = useMemo(() => (inPlaneResistance > 0 ? throughPlaneResistance / inPlaneResistance : 0), [inPlaneResistance, throughPlaneResistance]);
    const fitResult = useMemo(() => fitLogModel(curveData), [curveData]);
    const deltaResistance = useMemo(() => {
        if (curveData.length < 2) return 0;
        const sorted = [...curveData].sort((a, b) => a.pressure - b.pressure);
        return sorted[0].contactResistance - sorted[sorted.length - 1].contactResistance;
    }, [curveData]);
    const mapStats = useMemo(() => {
        const values = mapData.map(m => m.value).filter(v => Number.isFinite(v));
        if (!values.length) return { avg: 0, std: 0, cv: 0 };
        const avg = values.reduce((s, v) => s + v, 0) / values.length;
        const std = Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
        return { avg, std, cv: avg > 0 ? (std / avg) * 100 : 0 };
    }, [mapData]);

    useEffect(() => {
        localStorage.setItem('sciflow_contact_resistance_library', JSON.stringify(savedRecords));
    }, [savedRecords]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(draftKey);
            if (!raw) return;
            const draft = JSON.parse(raw);
            if (traceRecordId) return;
            setSampleName(draft.sampleName || 'NiFe-LDH@CFP');
            setInPlaneResistance(draft.inPlaneResistance || 0);
            setThroughPlaneResistance(draft.throughPlaneResistance || 0);
            setPressureMpa(draft.pressureMpa || 0);
            setContactResistance(draft.contactResistance || 0);
            setCurveData(Array.isArray(draft.curveData) ? draft.curveData : DEFAULT_POINTS);
            setMapData(Array.isArray(draft.mapData) ? draft.mapData : DEFAULT_MAP);
            setAnalysisText(draft.analysisText || '');
            setSourceFilename(draft.sourceFilename || '');
        } catch { }
    }, [draftKey, traceRecordId]);

    useEffect(() => {
        const payload = {
            sampleName, inPlaneResistance, throughPlaneResistance, pressureMpa, contactResistance,
            curveData, mapData, analysisText, sourceFilename
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
    }, [sampleName, inPlaneResistance, throughPlaneResistance, pressureMpa, contactResistance, curveData, mapData, analysisText, sourceFilename, draftKey]);

    useEffect(() => {
        if (!traceRecordId) return;
        const record = savedRecords.find(r => r.id === traceRecordId);
        if (!record) return;
        handleLoadRecord(record);
        showToast({ message: `已溯源接触电阻记录: ${record.title}`, type: 'success' });
    }, [traceRecordId, savedRecords]);

    const handleLoadExample = () => {
        setSampleName('CoFeOx/N-C@GDL');
        setInPlaneResistance(19.6);
        setThroughPlaneResistance(54.2);
        setPressureMpa(0.8);
        setContactResistance(13.8);
        setCurveData(DEFAULT_POINTS);
        setMapData(DEFAULT_MAP);
        setAnalysisText('接触电阻随压力上升显著下降，在 0.8 MPa 后进入平台区。建议装配压力控制在 0.8-1.0 MPa，并优先优化催化层-GDL 界面压实均匀性。');
        setSourceFilename('Demo-Contact-Resistance');
        setCurrentRecordId(null);
        showToast({ message: '四探针压力加载示例已加载', type: 'success' });
    };

    const handleGenerateInsight = () => {
        const level = contactResistance <= 15 ? '低接触阻抗' : contactResistance <= 25 ? '中等接触阻抗' : '高接触阻抗';
        const fitSentence = fitResult ? `拟合 R²=${fitResult.r2.toFixed(4)}，压力响应斜率 b=${fitResult.b.toFixed(2)}。` : '当前点数不足，未完成拟合。';
        const context = resolveContextForAnalysis({
            projects,
            selectedProjectId,
            savedRecords,
            currentRecordId
        });
        const contextSentence = context
            ? `关联实验上下文：${buildContextSummary(context)}。`
            : '未关联实验记录，本次结论基于纯电阻测试数据。';
        setAnalysisText(`样品 ${sampleName} 在 ${pressureMpa.toFixed(2)} MPa 下接触电阻为 ${contactResistance.toFixed(2)} mΩ·cm²，判定为${level}。面内/穿透电阻分别为 ${inPlaneResistance.toFixed(2)} 与 ${throughPlaneResistance.toFixed(2)} mΩ，各向异性比 ${anisotropyRatio.toFixed(2)}。压强窗口内电阻下降 ${deltaResistance.toFixed(2)} mΩ·cm²，映射均一性 CV=${mapStats.cv.toFixed(2)}%。${fitSentence} ${contextSentence}`);
        showToast({ message: '接触电阻分析结论已生成', type: 'success' });
    };

    const handleAddCurrentPoint = () => {
        if (pressureMpa <= 0 || contactResistance <= 0) {
            showToast({ message: '压力和接触电阻需为正值', type: 'warning' });
            return;
        }
        const next = [...curveData.filter(p => Math.abs(p.pressure - pressureMpa) > 1e-6), { pressure: pressureMpa, contactResistance }];
        next.sort((a, b) => a.pressure - b.pressure);
        setCurveData(next);
        showToast({ message: '已加入曲线点', type: 'success' });
    };

    const handleImportCurve = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const ext = file.name.split('.').pop()?.toLowerCase();
            let rows: Array<Record<string, unknown>> = [];
            if (ext === 'xlsx' || ext === 'xls') {
                const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            } else {
                const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
                if (lines.length < 2) throw new Error('empty');
                const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
                const headers = lines[0].split(delimiter).map(h => h.trim());
                rows = lines.slice(1).map(line => {
                    const cols = line.split(delimiter);
                    const obj: Record<string, unknown> = {};
                    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
                    return obj;
                });
            }

            const points: ContactPoint[] = [];
            rows.forEach((row) => {
                const keys = Object.keys(row);
                const pKey = keys.find(k => /pressure|压/i.test(k)) || keys[0];
                const rKey = keys.find(k => /resistance|接触电阻|rc/i.test(k)) || keys[1];
                const p = parseNumber(row[pKey]);
                const r = parseNumber(row[rKey]);
                if (p !== null && r !== null && p > 0 && r > 0) points.push({ pressure: p, contactResistance: r });
            });
            if (points.length < 3) {
                showToast({ message: '导入失败：有效点少于 3 个', type: 'error' });
                return;
            }
            points.sort((a, b) => a.pressure - b.pressure);
            setCurveData(points);
            setSourceFilename(file.name);
            showToast({ message: `已导入 ${points.length} 个曲线点`, type: 'success' });
        } catch {
            showToast({ message: '文件读取失败，请检查格式', type: 'error' });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleExportPDF = async () => {
        if (!reportAreaRef.current) return;
        showToast({ message: '正在准备接触电阻报告...', type: 'info' });
        await printElement(reportAreaRef.current, `${sampleName || 'contact'}_report`);
    };

    const handleClearWorkspace = () => {
        if (!confirm('确定清空接触电阻工作区吗？')) return;
        setSampleName('NiFe-LDH@CFP');
        setInPlaneResistance(0);
        setThroughPlaneResistance(0);
        setPressureMpa(0);
        setContactResistance(0);
        setCurveData([]);
        setMapData(DEFAULT_MAP.map(m => ({ ...m, value: 0 })));
        setAnalysisText('');
        setSourceFilename('');
        setCurrentRecordId(null);
        showToast({ message: '工作区已清空', type: 'info' });
    };

    const handleSaveRecord = () => {
        if (!saveTitle.trim()) return;
        const recordId = currentRecordId || Date.now().toString();
        const existing = savedRecords.find(r => r.id === recordId);
        const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
        const record = {
            id: recordId,
            title: saveTitle,
            projectId: selectedProjectId,
            timestamp: new Date().toLocaleString(),
            folder: existing?.folder || fallbackFolder,
            linkedContext: existing?.linkedContext || null,
            data: { sampleName, inPlaneResistance, throughPlaneResistance, pressureMpa, contactResistance, curveData, mapData, analysisText, sourceFilename }
        };
        setSavedRecords(prev => {
            const exists = prev.some(r => r.id === recordId);
            if (exists) return prev.map(r => r.id === recordId ? record : r);
            return [record, ...prev];
        });
        setCurrentRecordId(recordId);
        setShowSaveModal(false);
        setSaveTitle('');
        setSaveMilestoneId('');
        setSaveLogId('');
        showToast({ message: currentRecordId ? '接触电阻方案已覆盖更新' : '接触电阻方案已归档', type: 'success' });
    };

    // 快速保存：已有记录直接覆盖，没有则弹窗新建
    const handleQuickSave = () => {
        if (currentRecordId) {
            const existing = savedRecords.find(r => r.id === currentRecordId);
            if (existing) {
                const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
                const record = {
                    id: currentRecordId,
                    title: existing.title,
                    projectId: selectedProjectId,
                    timestamp: new Date().toLocaleString(),
                    folder: existing?.folder || fallbackFolder,
                    linkedContext: existing?.linkedContext || null,
                    data: { sampleName, inPlaneResistance, throughPlaneResistance, pressureMpa, contactResistance, curveData, mapData, analysisText, sourceFilename }
                };
                setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? record : r));
                showToast({ message: '接触电阻方案已覆盖更新', type: 'success' });
                return;
            }
        }
        { const a = getAutoSelections(projects, selectedProjectId); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveModal(true); }
    };

    // 另存为：始终创建新记录
    const handleSaveAs = () => {
        setCurrentRecordId(null);
        setSaveTitle('');
        { const a = getAutoSelections(projects, selectedProjectId); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveModal(true); }
    };

    const handleLoadRecord = (record: any) => {
        const payload = record.data || {};
        setSampleName(payload.sampleName || '未命名样品');
        setInPlaneResistance(payload.inPlaneResistance || 0);
        setThroughPlaneResistance(payload.throughPlaneResistance || 0);
        setPressureMpa(payload.pressureMpa || 0);
        setContactResistance(payload.contactResistance || 0);
        setCurveData(Array.isArray(payload.curveData) ? payload.curveData : []);
        setMapData(Array.isArray(payload.mapData) ? payload.mapData : DEFAULT_MAP);
        setAnalysisText(payload.analysisText || '');
        setSourceFilename(payload.sourceFilename || '');
        setCurrentRecordId(record.id);
        setShowLibrary(false);
    };

    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    };

    const handleSyncConfirm = (targetProjectId: string, targetMilestoneId: string, targetLogId: string) => {
        if (!currentRecordId || !onUpdateProject) return;
        const project = projects.find(p => p.id === targetProjectId);
        if (!project) return;
        const title = savedRecords.find(r => r.id === currentRecordId)?.title || `Contact Resistance ${new Date().toLocaleDateString()}`;
        const updatedMilestones = project.milestones.map(m => {
            if (m.id !== targetMilestoneId) return m;
            return {
                ...m,
                logs: m.logs.map(l => l.id === targetLogId ? {
                    ...l,
                    linkedAnalysis: { id: currentRecordId, type: 'contact_resistance' as const, title }
                } : l)
            };
        });
        onUpdateProject({ ...project, milestones: updatedMilestones });
        setShowSyncModal(false);
        showToast({ message: '已创建接触电阻溯源链接', type: 'success' });
    };

    const handleSaveToLog = (projectId: string, milestoneId: string, logId: string) => {
        const folder = buildArchiveFolderMeta(projects, projectId, milestoneId, logId);
        const pushChartData = chartData
            .map(p => ({ x: Number(p.pressure || 0), y: Number(p.measured || 0) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (currentRecordId) {
            setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? { ...r, folder } : r));
        }
        const linkTitle = savedRecords.find(r => r.id === currentRecordId)?.title || `Contact Resistance ${new Date().toLocaleDateString()}`;
        onSave(projectId, milestoneId, logId, {
            mode: 'CONTACT_RESISTANCE',
            aiConclusion: analysisText || `接触电阻测试完成：${contactResistance.toFixed(2)} mΩ·cm² @ ${pressureMpa.toFixed(2)} MPa。`,
            chartData: pushChartData,
            inPlaneResistance,
            throughPlaneResistance,
            contactResistance,
            compressionPressure: pressureMpa,
            contactFitR2: fitResult?.r2 ?? 0,
            contactUniformityCv: mapStats.cv,
            linkedAnalysisMeta: currentRecordId ? { id: currentRecordId, type: 'contact_resistance', title: linkTitle } : undefined
        });
    };

    const handlePushToDataLab = () => {
        const pushChartData = chartData
            .map(p => ({ x: Number(p.pressure || 0), y: Number(p.measured || 0) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        const fitCurveData = chartData
            .map(p => ({ x: Number(p.pressure || 0), y: Number(p.fitted) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (pushChartData.length === 0) {
            showToast({ message: '当前暂无可推送的接触电阻图表数据', type: 'info' });
            return;
        }
        const allCurve = [...pushChartData, ...fitCurveData];
        const xValues = allCurve.map(p => p.x);
        const yValues = allCurve.map(p => p.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const xDomain: [number, number] = minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX];
        const yDomain: [number, number] = minY === maxY ? [minY - 1, maxY + 1] : [minY, maxY];
        updateDataAnalysisSession({
            activeTab: 'chart',
            chartType: 'scatter',
            chartTitle: `${sampleName || 'Contact Resistance'} 压力-电阻曲线`,
            xAxisLabel: 'Pressure (MPa)',
            yAxisLabel: 'Contact Resistance (mΩ·cm²)',
            xDomain,
            yDomain,
            seriesList: [
                {
                    id: `contact_push_measured_${Date.now()}`,
                    name: 'Measured',
                    data: pushChartData.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                    color: '#f97316',
                    pointColor: '#f97316',
                    strokeWidth: 2,
                    pointShape: 'circle',
                    pointSize: 4,
                    visible: true
                },
                ...(fitCurveData.length > 0 ? [{
                    id: `contact_push_fit_${Date.now()}`,
                    name: 'Fitted',
                    data: fitCurveData.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                    color: '#2563eb',
                    pointColor: '#2563eb',
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

    const chartData = useMemo(() => {
        const fitMap = new Map<number, number>();
        fitResult?.predicted.forEach(p => fitMap.set(Number(p.pressure.toFixed(6)), p.contactResistance));
        return curveData.map(p => ({
            pressure: p.pressure,
            measured: p.contactResistance,
            fitted: fitMap.get(Number(p.pressure.toFixed(6))) ?? null
        })).sort((a, b) => a.pressure - b.pressure);
    }, [curveData, fitResult]);

    return (
        <div className="h-full flex flex-col p-6 gap-6 animate-reveal overflow-hidden relative bg-white">
            <div className="flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {traceRecordId && <button onClick={onBack} className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> 返回</button>}
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">电极接触电阻表征系统</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Four-Point Probe + Pressure Loading</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 数据操作组 */}
                    <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.txt,.xlsx,.xls" onChange={handleImportCurve} />
                    <button onClick={handleLoadExample} className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95">
                        <i className="fa-solid fa-flask-vial mr-1"></i> 加载示例
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95">
                        <i className="fa-solid fa-upload mr-1"></i> 导入数据
                    </button>
                    <button onClick={handleExportPDF} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95">
                        <i className="fa-solid fa-file-export mr-1"></i> 导出报告
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 记录管理组 */}
                    <div className="relative">
                        <div className="flex items-stretch">
                            <button onClick={handleQuickSave} className="px-4 py-2 bg-white border border-r-0 border-slate-200 text-slate-600 rounded-l-xl text-[10px] font-black uppercase hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-40">
                                <i className="fa-solid fa-floppy-disk mr-1"></i> 保存
                            </button>
                            <button onClick={() => setShowSaveDropdown(!showSaveDropdown)} className="px-1.5 py-2 bg-white border border-slate-200 text-slate-400 rounded-r-xl text-[10px] hover:text-indigo-600 hover:border-indigo-400 transition-all active:scale-95 disabled:opacity-40">
                                <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveDropdown ? 'rotate-180' : ''}`}></i>
                            </button>
                        </div>
                        {showSaveDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 min-w-[120px]">
                                <button onClick={() => { handleQuickSave(); setShowSaveDropdown(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2">
                                    <i className="fa-solid fa-floppy-disk text-[10px]"></i> 保存
                                </button>
                                <button onClick={() => { handleSaveAs(); setShowSaveDropdown(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-600 transition-all flex items-center gap-2">
                                    <i className="fa-solid fa-copy text-[10px]"></i> 另存为
                                </button>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowLibrary(true)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all active:scale-95">
                        <i className="fa-solid fa-box-archive mr-1"></i> 方案库 ({savedRecords.length})
                    </button>
                    <button
                        onClick={handlePushToDataLab}
                        disabled={chartData.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                        title="无需同步，直接推送到实验数据分析室"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 推送数据分析室
                    </button>
                    <button
                        onClick={() => {
                            if (!currentRecordId) {
                                showToast({ message: '请先保存方案，再同步到实验记录', type: 'info' });
                                return;
                            }
                            setShowSyncModal(true);
                        }}
                        disabled={!currentRecordId}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                        title={currentRecordId ? '同步到实验记录' : '先保存方案后可同步'}
                    >
                        <i className="fa-solid fa-link"></i> 同步
                    </button>
                    <button
                        onClick={() => setShowContextLinkModal(true)}
                        className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-paperclip"></i> 关联记录
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 清空 + 主操作 */}
                    <button onClick={handleClearWorkspace} className="px-4 py-2 bg-white border border-slate-200 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-40">
                        <i className="fa-solid fa-trash-can mr-1"></i> 清空
                    </button>
                    <button onClick={handleGenerateInsight} className="px-8 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50">
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> 生成结论
                    </button>
                </div>
            </div>

            <div ref={reportAreaRef} className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                <section className="col-span-12 lg:col-span-4 bg-slate-50 rounded-3xl border border-slate-200 p-5 space-y-4 overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">样品名称</label>
                        <input value={sampleName} onChange={e => setSampleName(e.target.value)} className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none" />
                        {sourceFilename && <p className="text-[9px] text-slate-400 font-bold mt-1.5 truncate">Source: {sourceFilename}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">面内电阻 (mΩ)</label><input type="number" value={inPlaneResistance} onChange={e => setInPlaneResistance(parseFloat(e.target.value || '0'))} className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none" /></div>
                        <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">穿透电阻 (mΩ)</label><input type="number" value={throughPlaneResistance} onChange={e => setThroughPlaneResistance(parseFloat(e.target.value || '0'))} className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none" /></div>
                        <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">加载压力 (MPa)</label><input type="number" step="0.1" value={pressureMpa} onChange={e => setPressureMpa(parseFloat(e.target.value || '0'))} className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none" /></div>
                        <div><label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">接触电阻 (mΩ·cm²)</label><input type="number" step="0.1" value={contactResistance} onChange={e => setContactResistance(parseFloat(e.target.value || '0'))} className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2 text-xs font-bold outline-none" /></div>
                    </div>
                    <button onClick={handleAddCurrentPoint} className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all">
                        添加当前点到曲线
                    </button>
                    <div className="bg-white border border-slate-200 rounded-2xl p-4">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">核心指标</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div><p className="text-[8px] text-slate-400 font-bold uppercase">各向异性比</p><p className="text-lg font-black text-indigo-600">{anisotropyRatio.toFixed(2)}</p></div>
                            <div><p className="text-[8px] text-slate-400 font-bold uppercase">压缩降阻</p><p className="text-lg font-black text-emerald-600">{deltaResistance.toFixed(2)}</p></div>
                            <div><p className="text-[8px] text-slate-400 font-bold uppercase">拟合 R²</p><p className="text-lg font-black text-amber-600">{fitResult ? fitResult.r2.toFixed(4) : 'N/A'}</p></div>
                            <div><p className="text-[8px] text-slate-400 font-bold uppercase">均一性 CV(%)</p><p className="text-lg font-black text-rose-600">{mapStats.cv.toFixed(2)}</p></div>
                        </div>
                    </div>
                </section>

                <section className="col-span-12 lg:col-span-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-inner flex flex-col min-h-0">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">接触电阻-压力曲线</h5>
                    <div className="h-64 rounded-2xl border border-slate-100 p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 16, right: 16, left: 6, bottom: 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="pressure" unit=" MPa" fontSize={10} />
                                <YAxis unit=" mΩ·cm²" fontSize={10} />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="measured" name="实测值" stroke="#4f46e5" strokeWidth={2.5} dot />
                                <Line type="monotone" dataKey="fitted" name="拟合值" stroke="#f97316" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                        <div className="rounded-2xl border border-slate-100 p-3 bg-slate-50/40 min-h-[170px]">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">曲线点表</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                {curveData.map((p, i) => (
                                    <div key={`${p.pressure}-${i}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                        <input type="number" step="0.01" value={p.pressure} onChange={e => setCurveData(prev => prev.map((v, idx) => idx === i ? { ...v, pressure: parseFloat(e.target.value || '0') } : v))} className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold" />
                                        <input type="number" step="0.01" value={p.contactResistance} onChange={e => setCurveData(prev => prev.map((v, idx) => idx === i ? { ...v, contactResistance: parseFloat(e.target.value || '0') } : v))} className="border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold" />
                                        <button onClick={() => setCurveData(prev => prev.filter((_, idx) => idx !== i))} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-100 p-3 bg-slate-50/40 min-h-[170px]">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">接触电阻映射 (3x3)</p>
                            <div className="grid grid-cols-3 gap-2">
                                {mapData.map((cell, idx) => (
                                    <input
                                        key={`${cell.x}-${cell.y}`}
                                        type="number"
                                        step="0.1"
                                        value={cell.value}
                                        onChange={e => setMapData(prev => prev.map((v, i) => i === idx ? { ...v, value: parseFloat(e.target.value || '0') } : v))}
                                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-center"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex-1 min-h-0 rounded-2xl border border-slate-100 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">分析结论</p>
                        <textarea value={analysisText} onChange={e => setAnalysisText(e.target.value)} placeholder="点击“生成结论”自动生成，或手动补充。" className="w-full h-full min-h-[100px] resize-none bg-white rounded-xl border border-slate-200 p-3 text-[12px] font-medium text-slate-700 outline-none" />
                    </div>
                </section>
            </div>

            {showSaveModal && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-6 w-[460px] border border-slate-200 shadow-2xl">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">保存接触电阻方案</h3>
                        <input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="例如：GDL压实梯度-批次A" className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold outline-none mb-4" />
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
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase">取消</button>
                            <button onClick={handleSaveRecord} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {showLibrary && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-6 w-[760px] border border-slate-200 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">接触电阻方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                            <FolderLibraryView
                                records={savedRecords}
                                onLoad={handleLoadRecord}
                                onDelete={handleDeleteRecord}
                                emptyText="暂无归档记录。"
                            />
                        </div>
                        <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between">
                            <button onClick={() => setShowLibrary(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase">关闭</button>
                            <button onClick={() => setShowSyncModal(true)} disabled={!currentRecordId} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase disabled:opacity-50">同步链接</button>
                        </div>
                    </div>
                </div>
            )}

            {showSyncModal && (
                <AnalysisSyncModal
                    onClose={() => setShowSyncModal(false)}
                    projects={projects}
                    initialProjectId={selectedProjectId}
                    onConfirm={(projectId, milestoneId, logId) => {
                        if (!projectId || !milestoneId || !logId) return;
                        handleSaveToLog(projectId, milestoneId, logId);
                    }}
                    onConfirmGroup={(projectId, milestoneId, groupId) => {
                        if (!projectId || !milestoneId || !groupId) return;
                        handleSaveToLog(projectId, milestoneId, `GROUP:${groupId}`);
                        setShowSyncModal(false);
                    }}
                    title="同步接触电阻分析"
                />
            )}
            {showContextLinkModal && (
                <AnalysisSyncModal
                    onClose={() => setShowContextLinkModal(false)}
                    projects={projects}
                    initialProjectId={selectedProjectId}
                    onConfirm={(pId, mId, lId) => {
                        if (!pId || !mId || !lId) return;
                        if (!currentRecordId) {
                            showToast({ message: '请先保存方案后再关联实验记录', type: 'info' });
                            return;
                        }
                        setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? { ...r, linkedContext: { projectId: pId, milestoneId: mId, logId: lId } } : r));
                        setShowContextLinkModal(false);
                        showToast({ message: '已关联实验记录', type: 'success' });
                    }}
                    title="关联实验记录"
                />
            )}
        </div>
    );
};

export default ContactResistancePanel;
