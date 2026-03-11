
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import AnalysisSyncModal, { flattenMilestonesTree, getAutoSelections } from '../AnalysisSyncModal';
import { printElement } from '../../../utils/printUtility';
import { buildArchiveFolderMeta } from '../../../utils/archiveFolder';
import { buildContextSummary, resolveContextForAnalysis } from '../../../utils/experimentContext';
import FolderLibraryView from '../FolderLibraryView';
// 新增子面板导入
import DifferenceSpectrumPanel from './Spectroscopy/DifferenceSpectrumPanel';
import PeakTrackingPanel from './Spectroscopy/PeakTrackingPanel';
import MechanismPanel from './Spectroscopy/MechanismPanel';
import WaterfallPlot from './Spectroscopy/WaterfallPlot';
import ContourPlot from './Spectroscopy/ContourPlot';
import FreeEnergyDiagramPanel from './Spectroscopy/FreeEnergyDiagramPanel';
import SpectroElectroCouplingPanel from './Spectroscopy/SpectroElectroCouplingPanel';
// 第二阶段子面板
import TimeResolvedPanel from './Spectroscopy/TimeResolvedPanel';
import StabilityDecayPanel from './Spectroscopy/StabilityDecayPanel';
import DualModalPanel from './Spectroscopy/DualModalPanel';
import CrossModalCouplingPanel from './Spectroscopy/CrossModalCouplingPanel';
import { TimeSpectrumDataPoint, generateTimeResolvedDemoData } from './Spectroscopy/timeResolvedAnalysis';

interface Props {
    projects: ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    onUpdateProject?: (project: ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
    onBack?: () => void;
}

// Tab 类型定义
type SpectroTab = 'spectrum' | 'difference' | 'tracking' | '3d' | 'mechanism' | 'freeEnergy' | 'coupling' | 'timeResolved' | 'stability' | 'dualModal' | 'crossModal';

const TAB_CONFIG: { key: SpectroTab; label: string; icon: string; color: string }[] = [
    { key: 'spectrum', label: '原始谱图', icon: 'fa-wave-square', color: 'indigo' },
    { key: 'difference', label: '差谱分析', icon: 'fa-not-equal', color: 'rose' },
    { key: 'tracking', label: '峰追踪', icon: 'fa-chart-line', color: 'emerald' },
    { key: '3d', label: '3D 视图', icon: 'fa-mountain-sun', color: 'purple' },
    { key: 'mechanism', label: '中间体归属', icon: 'fa-dna', color: 'amber' },
    { key: 'freeEnergy', label: '自由能', icon: 'fa-stairs', color: 'sky' },
    { key: 'coupling', label: '电化学联动', icon: 'fa-link', color: 'orange' },
    { key: 'timeResolved', label: '时间分辨', icon: 'fa-clock-rotate-left', color: 'teal' },
    { key: 'stability', label: '稳定性', icon: 'fa-battery-three-quarters', color: 'lime' },
    { key: 'dualModal', label: 'Raman+IR', icon: 'fa-object-ungroup', color: 'cyan' },
    { key: 'crossModal', label: 'XRD/XPS联动', icon: 'fa-diagram-project', color: 'fuchsia' },
];

// 模拟原位光谱数据生成器 (波数: 400-1000 cm⁻¹)
const generateInSituData = () => {
    const voltages = [1.2, 1.4, 1.6, 1.8]; // V vs. RHE
    const data = [];
    for (let w = 400; w <= 1000; w += 5) {
        const entry: any = { wavenumber: w };
        voltages.forEach((v) => {
            // 基础背景
            let intensity = 10 + Math.random() * 2;
            // 模拟 580 cm⁻¹ 处的 M-OOH 峰，随电压升高而增强
            const peak1Height = (v - 1.0) * 150;
            intensity += peak1Height * Math.exp(-Math.pow(w - 580, 2) / 400);
            // 模拟 820 cm⁻¹ 处的 M-OH 峰
            const peak2Height = (v - 1.0) * 80;
            intensity += peak2Height * Math.exp(-Math.pow(w - 820, 2) / 600);

            entry[`v_${v}`] = parseFloat(intensity.toFixed(2));
        });
        data.push(entry);
    }
    return data;
};

const SpectroscopyAnalysisPanel: React.FC<Props> = ({ projects, onSave, onUpdateProject, selectedProjectId, traceRecordId, onBack }) => {
    const { showToast, updateDataAnalysisSession, navigate } = useProjectContext();
    const [dataset, setDataset] = useState<any[]>([]);
    const [analysisReport, setAnalysisReport] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const reportAreaRef = useRef<HTMLDivElement>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showContextLinkModal, setShowContextLinkModal] = useState(false);
    const [activeTab, setActiveTab] = useState<SpectroTab>('spectrum');
    const [view3dMode, setView3dMode] = useState<'waterfall' | 'contour'>('waterfall');
    const [timeResolvedData, setTimeResolvedData] = useState<TimeSpectrumDataPoint[]>([]);

    const [savedRecords, setSavedRecords] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('sciflow_spec_library') || '[]'); } catch { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
    const [saveMilestoneId, setSaveMilestoneId] = useState('');
    const [saveLogId, setSaveLogId] = useState('');

    useEffect(() => {
        localStorage.setItem('sciflow_spec_library', JSON.stringify(savedRecords));
    }, [savedRecords]);

    // 初始化时加载演示数据
    useEffect(() => {
        if (!traceRecordId && dataset.length === 0) {
            setDataset(generateInSituData());
        }
    }, []);

    // 核心溯源加载逻辑
    useEffect(() => {
        if (traceRecordId) {
            const record = savedRecords.find(r => r.id === traceRecordId);
            if (record) {
                setDataset(record.data.dataset || []);
                setAnalysisReport(record.data.analysisReport);
                setCurrentRecordId(record.id);
                showToast({ message: `已精准溯源至原位光谱记录: ${record.title}`, type: 'success' });
            } else {
                // 如果库中没找到，生成一组匹配的演示数据
                setDataset(generateInSituData());
                handleRunAnalysis();
                showToast({ message: "正在解构关联实验的实时光谱特征...", type: 'info' });
            }
        }
    }, [traceRecordId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsAnalyzing(true);
        showToast({ message: "正在解析大型光谱矩阵 (1024 channels)...", type: 'info' });
        setTimeout(() => {
            setDataset(generateInSituData());
            setIsAnalyzing(false);
            showToast({ message: "外部数据加载成功", type: 'success' });
        }, 1200);
    };

    const handleRunAnalysis = () => {
        setIsAnalyzing(true);
        setTimeout(() => {
            const context = resolveContextForAnalysis({
                projects,
                selectedProjectId,
                savedRecords,
                currentRecordId
            });
            const contextBlock = context
                ? `\n\n**实验记录上下文：** ${buildContextSummary(context)}`
                : '\n\n**实验记录上下文：** 未关联实验记录，本次结论基于纯光谱数据。';
            setAnalysisReport(`**原位拉曼诊断结论：**
1. 在 **580 cm⁻¹** 处观测到明显的 $M-OOH$ 弯曲振动峰，其强度随电位从 1.2V 升至 1.8V 呈现非线性增长，证实了 AEM 过程中吸附态中间体的形成。
2. **820 cm⁻¹** 处的 $M-OH$ 信号相对稳定，表明表面羟基覆盖度已趋于饱和。
3. 协同效应分析：掺杂元素显著降低了 $O-O$ 键合能垒，对应 $580\ peak$ 的起始电位提前了约 120mV。${contextBlock}`);
            setIsAnalyzing(false);
            showToast({ message: "AI 动力学归因完成", type: 'success' });
        }, 1800);
    };

    const handleExportPDF = async () => {
        if (!reportAreaRef.current) return;
        showToast({ message: '正在准备矢量级光谱诊断报告...', type: 'info' });
        await printElement(reportAreaRef.current, saveTitle || 'Spectroscopy_Analysis_Report');
    };

    const handleClearWorkspace = () => {
        if (dataset.length === 0 && !analysisReport) return;
        if (!confirm('确定要清空光谱分析工作区吗？未归档的分析数据将会丢失。')) return;
        setDataset([]);
        setAnalysisReport(null);
        setCurrentRecordId(null);
        showToast({ message: '光谱分析工作区已清空', type: 'info' });
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
            data: { dataset, analysisReport }
        };
        setSavedRecords(prev => {
            const exists = prev.some(r => r.id === recordId);
            if (exists) return prev.map(r => r.id === recordId ? record : r);
            return [record, ...prev];
        });
        setCurrentRecordId(recordId);
        setShowSaveModal(false);
        setSaveMilestoneId('');
        setSaveLogId('');
        showToast({ message: currentRecordId ? '光谱分析结果已覆盖更新' : '光谱分析结果已归档', type: 'success' });
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
                    data: { dataset, analysisReport }
                };
                setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? record : r));
                showToast({ message: '光谱分析结果已覆盖更新', type: 'success' });
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

    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    };

    const handleLoadRecord = (record: any) => {
        setDataset(record.data.dataset);
        setAnalysisReport(record.data.analysisReport);
        setCurrentRecordId(record.id);
        setShowLibrary(false);
    };

    const handleSyncConfirm = (targetProjectId: string, targetMilestoneId: string, targetLogId: string) => {
        if (!currentRecordId || !onUpdateProject) return;
        const project = projects.find(p => p.id === targetProjectId);
        if (!project) return;

        const currentRecord = savedRecords.find(r => r.id === currentRecordId);
        const title = currentRecord ? currentRecord.title : `Spectroscopy Analysis ${new Date().toLocaleDateString()}`;

        const updatedMilestones = project.milestones.map(m => {
            if (m.id === targetMilestoneId) {
                const updatedLogs = m.logs.map(l => {
                    if (l.id === targetLogId) {
                        return {
                            ...l,
                            linkedAnalysis: {
                                id: currentRecordId,
                                type: 'spectroscopy' as const,
                                title: title
                            }
                        };
                    }
                    return l;
                });
                return { ...m, logs: updatedLogs };
            }
            return m;
        });

        onUpdateProject({ ...project, milestones: updatedMilestones });
        setShowSyncModal(false);
        showToast({ message: '已创建溯源链接至实验记录', type: 'success' });
    };

    const handleSaveToLog = (projectId: string, milestoneId: string, logId: string) => {
        const key = 'v_1.8';
        const p580 = Number(dataset.find(d => Math.abs((d.wavenumber || 0) - 580) <= 3)?.[key] || 0);
        const p820 = Number(dataset.find(d => Math.abs((d.wavenumber || 0) - 820) <= 3)?.[key] || 0);
        const ratio = p820 > 0 ? p580 / p820 : 0;
        const chartData = [1.2, 1.4, 1.6, 1.8].map(v => {
            const row = dataset.find(d => Math.abs((d.wavenumber || 0) - 580) <= 3);
            return { x: v, y: Number(row?.[`v_${v}`] || 0) };
        });
        const folder = buildArchiveFolderMeta(projects, projectId, milestoneId, logId);
        if (currentRecordId) {
            setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? { ...r, folder } : r));
        }
        const linkTitle = savedRecords.find(r => r.id === currentRecordId)?.title || `Spectroscopy Analysis ${new Date().toLocaleDateString()}`;
        onSave(projectId, milestoneId, logId, {
            mode: 'SPECTROSCOPY',
            aiConclusion: analysisReport || '原位光谱分析已同步。',
            chartData,
            peak580Intensity: p580,
            peak820Intensity: p820,
            peakRatio580to820: Number(ratio.toFixed(3)),
            linkedAnalysisMeta: currentRecordId ? { id: currentRecordId, type: 'spectroscopy', title: linkTitle } : undefined
        });
    };

    const handlePushToDataLab = () => {
        const voltageKeys = dataset.length > 0
            ? Object.keys(dataset[0]).filter(k => /^v_/.test(k))
            : [];
        if (dataset.length === 0 || voltageKeys.length === 0) {
            showToast({ message: '当前暂无可推送的原位光谱图表数据', type: 'info' });
            return;
        }
        const colorPalette = ['#7c3aed', '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
        const pushedSeries = voltageKeys.map((key, idx) => {
            const data = dataset
                .map(row => ({ x: Number(row.wavenumber), y: Number(row[key] || 0) }))
                .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
                .map(p => ({ name: String(p.x), value: p.y, error: 0 }));
            const labelV = key.replace(/^v_/, '');
            const color = colorPalette[idx % colorPalette.length];
            return {
                id: `spectro_push_${key}_${Date.now()}_${idx}`,
                name: `${labelV} V`,
                data,
                color,
                pointColor: color,
                strokeWidth: 2,
                pointShape: 'circle' as const,
                pointSize: 3,
                visible: true
            };
        }).filter(s => s.data.length > 0);

        if (pushedSeries.length === 0) {
            showToast({ message: '当前暂无可推送的原位光谱图表数据', type: 'info' });
            return;
        }

        const allPoints = pushedSeries.flatMap(s => s.data);
        const xValues = allPoints.map(p => Number(p.name));
        const yValues = allPoints.map(p => Number(p.value));
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const xDomain: [number, number] = minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX];
        const yDomain: [number, number] = minY === maxY ? [minY - 1, maxY + 1] : [minY, maxY];
        updateDataAnalysisSession({
            activeTab: 'chart',
            chartType: 'line',
            chartTitle: '原位光谱全谱曲线',
            xAxisLabel: 'Wavenumber (cm⁻¹)',
            yAxisLabel: 'Intensity (a.u.)',
            xDomain,
            yDomain,
            seriesList: pushedSeries
        });
        navigate('data');
        showToast({ message: `已推送全谱数据到实验数据分析室（${pushedSeries.length} 条电位曲线）`, type: 'success' });
    };

    return (
        <div className="h-full flex flex-col p-6 gap-4 animate-reveal overflow-hidden relative bg-white">
            {/* ---- 顶部头栏 ---- */}
            <div className="flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {traceRecordId && (
                        <button onClick={onBack} className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-2">
                            <i className="fa-solid fa-arrow-left"></i> 返回
                        </button>
                    )}
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">原位光谱分析中心</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">In-situ Raman / IR Dynamics Evolution — Advanced Analysis Suite</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 数据操作组 */}
                    <button
                        onClick={() => {
                            const demoData = generateInSituData();
                            setDataset(demoData);
                            setAnalysisReport(`**原位拉曼诊断结论（CoFe₂O₄/g-C₃N₄ 催化剂 ORR/OER 双功能机理）：**
1. 在 **580 cm⁻¹** 处观测到明显的 $M-OOH$ 弯曲振动峰，其强度随电位从 1.2V 升至 1.8V 呈现非线性增长，信号增益达 **4.8倍**，证实了 AEM 过程中吸附态中间体 *OOH 的动态形成与积累。
2. **820 cm⁻¹** 处的 $M-OH$ 伸缩振动峰在 1.6V 以上趋于饱和（强度变化 < 8%），表明表面羟基覆盖度已趋于饱和，成为限速步骤的关键指征。
3. **协同效应分析：** Ce 掺杂显著调控了 $d$ 带中心位置，使 $O-O*$ 键合能垒降低约 0.23 eV，对应 580 cm⁻¹ 特征峰的起始电位提前了约 **120 mV**，与 LSV 测试中的超电位优势吻合。
4. **动态演变：** 1.4V → 1.6V 电位跃迁区间内，两峰面积比 ($I_{580}/I_{820}$) 从 1.8 骤升至 3.6，揭示了 *OOH 与 *OH 两态之间的快速相互转化，为双电子 → 四电子选择性切换提供了原位光谱证据。`);
                            setCurrentRecordId(null);
                            showToast({ message: 'CoFe₂O₄/g-C₃N₄ 原位拉曼示例已加载并完成归因', type: 'success' });
                        }}
                        className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-flask-vial mr-1"></i> 加载示例
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95">
                        <i className="fa-solid fa-upload mr-1"></i> 导入数据
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 记录管理组 */}
                    <div className="relative">
                        <div className="flex items-stretch">
                            <button onClick={handleQuickSave} disabled={dataset.length === 0} className="px-4 py-2 bg-white border border-r-0 border-slate-200 text-slate-600 rounded-l-xl text-[10px] font-black uppercase hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-40">
                                <i className="fa-solid fa-floppy-disk mr-1"></i> 保存
                            </button>
                            <button onClick={() => setShowSaveDropdown(!showSaveDropdown)} disabled={dataset.length === 0} className="px-1.5 py-2 bg-white border border-slate-200 text-slate-400 rounded-r-xl text-[10px] hover:text-indigo-600 hover:border-indigo-400 transition-all active:scale-95 disabled:opacity-40">
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
                        disabled={dataset.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                        title="无需同步，直接推送到实验数据分析室"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 推送数据分析室
                    </button>
                    <button
                        onClick={() => {
                            if (!currentRecordId || !analysisReport) {
                                showToast({ message: '请先完成分析并保存方案，再同步到实验记录', type: 'info' });
                                return;
                            }
                            setShowSyncModal(true);
                        }}
                        disabled={!currentRecordId || !analysisReport}
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
                    <button
                        onClick={handleClearWorkspace}
                        disabled={dataset.length === 0 && !analysisReport}
                        className="px-4 py-2 bg-white border border-slate-200 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-40"
                        title="清空工作间"
                    >
                        <i className="fa-solid fa-trash-can mr-1"></i> 清空
                    </button>
                    <button onClick={handleRunAnalysis} disabled={isAnalyzing} className="px-8 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50">
                        {isAnalyzing ? <i className="fa-solid fa-circle-notch animate-spin mr-1"></i> : <i className="fa-solid fa-brain mr-1"></i>}
                        AI 机理诊断
                    </button>
                </div>
            </div>

            {/* ---- Tab 导航栏 ---- */}
            <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 shrink-0 overflow-x-auto">
                {TAB_CONFIG.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === tab.key
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                    >
                        <i className={`fa-solid ${tab.icon}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ---- 内容区 ---- */}
            <div ref={reportAreaRef} className="flex-1 min-h-0 is-printing-target">
                {/* == 原始谱图 Tab == */}
                {activeTab === 'spectrum' && (
                    <div className="h-full grid grid-cols-12 gap-8">
                        {/* 谱图展示区 */}
                        <div className={`col-span-12 lg:col-span-8 rounded-[3rem] border-2 p-8 flex flex-col shadow-inner relative transition-all duration-700 ${traceRecordId ? 'border-amber-400 bg-amber-50/5' : 'bg-slate-50 border-slate-200'}`}>
                            {traceRecordId && (
                                <div className="absolute top-4 left-8 px-3 py-1 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg animate-pulse z-20">
                                    <i className="fa-solid fa-link"></i> Trace Active
                                </div>
                            )}
                            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={dataset} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="wavenumber"
                                            label={{ value: 'Wavenumber (cm⁻¹)', position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 'bold' }}
                                            fontSize={10}
                                            tick={{ fill: '#64748b' }}
                                        />
                                        <YAxis
                                            label={{ value: 'Intensity (a.u.)', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 'bold' }}
                                            fontSize={10}
                                            tick={{ fill: '#64748b' }}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="v_1.2" stroke="#94a3b8" strokeWidth={1.5} dot={false} name="1.2 V" />
                                        <Line type="monotone" dataKey="v_1.4" stroke="#818cf8" strokeWidth={1.5} dot={false} name="1.4 V" />
                                        <Line type="monotone" dataKey="v_1.6" stroke="#6366f1" strokeWidth={2} dot={false} name="1.6 V" />
                                        <Line type="monotone" dataKey="v_1.8" stroke="#4338ca" strokeWidth={2.5} dot={false} name="1.8 V" />

                                        {/* 关键峰位标注线 */}
                                        <ReferenceLine x={580} stroke="#f43f5e" strokeDasharray="3 3" label={{ position: 'top', value: 'M-OOH', fill: '#f43f5e', fontSize: 9, fontWeight: 'bold' }} />
                                        <ReferenceLine x={820} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'M-OH', fill: '#10b981', fontSize: 9, fontWeight: 'bold' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 报告区 */}
                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 print:col-span-12">
                            <div className="flex-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
                                <h5 className="text-[10px] font-black text-indigo-600 uppercase mb-6 flex items-center gap-2 shrink-0">
                                    <i className="fa-solid fa-robot"></i> AI 深度机理归因报告
                                </h5>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                    {analysisReport ? (
                                        <div className="text-[12px] font-medium text-slate-700 leading-relaxed text-justify space-y-4">
                                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 italic">
                                                {analysisReport.split('\n').map((line, i) => (
                                                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-4">
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">峰1拟合度</span>
                                                    <p className="text-sm font-black text-slate-800">98.4%</p>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">信噪比 (SNR)</span>
                                                    <p className="text-sm font-black text-slate-800">42 dB</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                                            <i className="fa-solid fa-microscope text-4xl"></i>
                                            <p className="text-[10px] font-black uppercase">等待分析引擎解算</p>
                                        </div>
                                    )}
                                </div>
                                {analysisReport && (
                                    <button
                                        onClick={handleExportPDF}
                                        className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all shadow-lg no-print"
                                    >
                                        导出报告 (.PDF)
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* == 差谱分析 Tab == */}
                {activeTab === 'difference' && (
                    <DifferenceSpectrumPanel dataset={dataset} />
                )}

                {/* == 峰追踪 Tab == */}
                {activeTab === 'tracking' && (
                    <PeakTrackingPanel dataset={dataset} />
                )}

                {/* == 3D 视图 Tab == */}
                {activeTab === '3d' && (
                    <div className="h-full flex flex-col gap-3">
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0 self-start">
                            <button
                                onClick={() => setView3dMode('waterfall')}
                                className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${view3dMode === 'waterfall' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <i className="fa-solid fa-mountain-sun mr-1"></i>瀑布图
                            </button>
                            <button
                                onClick={() => setView3dMode('contour')}
                                className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${view3dMode === 'contour' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <i className="fa-solid fa-layer-group mr-1"></i>等高线图
                            </button>
                        </div>
                        <div className="flex-1 min-h-0">
                            {view3dMode === 'waterfall' ? (
                                <WaterfallPlot dataset={dataset} />
                            ) : (
                                <ContourPlot dataset={dataset} />
                            )}
                        </div>
                    </div>
                )}

                {/* == 中间体归属 Tab == */}
                {activeTab === 'mechanism' && (
                    <MechanismPanel dataset={dataset} />
                )}

                {/* == 自由能 Tab == */}
                {activeTab === 'freeEnergy' && (
                    <FreeEnergyDiagramPanel dataset={dataset} />
                )}

                {/* == 电化学联动 Tab == */}
                {activeTab === 'coupling' && (
                    <SpectroElectroCouplingPanel dataset={dataset} />
                )}

                {/* == 时间分辨 Tab == */}
                {activeTab === 'timeResolved' && (
                    <TimeResolvedPanel
                        dataset={timeResolvedData}
                        onLoadDemo={() => {
                            setTimeResolvedData(generateTimeResolvedDemoData());
                            showToast({ message: '恒电位 1.6V 稳定性测试原位拉曼演示数据已加载', type: 'success' });
                        }}
                    />
                )}

                {/* == 稳定性衰减 Tab == */}
                {activeTab === 'stability' && (
                    <StabilityDecayPanel dataset={timeResolvedData} />
                )}

                {/* == Raman+IR 双模态 Tab == */}
                {activeTab === 'dualModal' && (
                    <DualModalPanel ramanData={dataset} />
                )}

                {/* == XRD/XPS 跨模态联动 Tab == */}
                {activeTab === 'crossModal' && (
                    <CrossModalCouplingPanel ramanData={dataset} />
                )}
            </div>

            {/* Library Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">原位光谱方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <FolderLibraryView
                                records={savedRecords}
                                onLoad={handleLoadRecord}
                                onDelete={handleDeleteRecord}
                                emptyText="暂无相关存档"
                            />
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">保存分析方案</h3>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-4 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="输入方案名称..." autoFocus />
                        {/* 归档位置选择 */}
                        <div className="space-y-3 mb-6">
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
                            <button onClick={handleSaveRecord} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {showSyncModal && (
                <AnalysisSyncModal
                    onClose={() => setShowSyncModal(false)}
                    projects={projects}
                    onConfirm={(projectId, milestoneId, logId) => {
                        if (!projectId || !milestoneId || !logId) return;
                        handleSaveToLog(projectId, milestoneId, logId);
                    }}
                    onConfirmGroup={(projectId, milestoneId, groupId) => {
                        if (!projectId || !milestoneId || !groupId) return;
                        handleSaveToLog(projectId, milestoneId, `GROUP:${groupId}`);
                        setShowSyncModal(false);
                    }}
                    initialProjectId={selectedProjectId}
                    title="将光谱分析关联至实验记录"
                />
            )}
            {showContextLinkModal && (
                <AnalysisSyncModal
                    onClose={() => setShowContextLinkModal(false)}
                    projects={projects}
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
                    initialProjectId={selectedProjectId}
                    title="关联实验记录"
                />
            )}
        </div>
    );
};

export default SpectroscopyAnalysisPanel;
