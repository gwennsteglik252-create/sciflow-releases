
import React, { useState, useEffect } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import VisionAnalysisPanel from '../DataAnalysis/VisionAnalysisPanel';
import ElectrochemicalEngine from '../Engines/ElectrochemicalEngine';
import SurfaceChemistryPanel from './Panels/SurfaceChemistryPanel';
import PorosityAnalysisPanel from './Panels/PorosityAnalysisPanel';
import XrdPhasePanel from './Panels/XrdPhasePanel';
import SpectroscopyAnalysisPanel from './Panels/SpectroscopyAnalysisPanel';
import ContactResistancePanel from './Panels/ContactResistancePanel';
import { ExperimentLog } from '../../types';

type InstrumentMode = 'microscopy' | 'xrd' | 'surface' | 'porosity' | 'kinetics' | 'spectroscopy' | 'contact_resistance';

interface CharacterizationHubProps {
    initialMode?: InstrumentMode;
    initialRecordId?: string | null;
}

type ChartPoint = { x: number; y: number };

const normalizeChartData = (rawData: any): ChartPoint[] => {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const xCandidates = ['x', 'twoTheta', 'wavenumber', 'pressure', 'be', 'index'];
    const yCandidates = ['y', 'intensity', 'measured', 'value', 'deltaVolume', 'area', 'fitted'];

    const toNumber = (v: any): number | null => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    if (rawData.every((it: any) => typeof it === 'number')) {
        return rawData
            .map((y: number, idx: number) => ({ x: idx + 1, y }))
            .filter((p: ChartPoint) => Number.isFinite(p.x) && Number.isFinite(p.y));
    }

    return rawData
        .map((it: any, idx: number) => {
            if (typeof it === 'number') return { x: idx + 1, y: it };
            if (!it || typeof it !== 'object') return null;

            const xKey = xCandidates.find(k => toNumber(it[k]) !== null);
            const yKey = yCandidates.find(k => toNumber(it[k]) !== null);

            const x = xKey ? toNumber(it[xKey]) : idx + 1;
            let y = yKey ? toNumber(it[yKey]) : null;

            if (y === null) {
                const fallbackY = Object.entries(it).find(([k, v]) => k !== xKey && toNumber(v) !== null);
                y = fallbackY ? toNumber(fallbackY[1]) : null;
            }

            if (x === null || y === null) return null;
            return { x, y };
        })
        .filter((p: ChartPoint | null): p is ChartPoint => Boolean(p));
};

const inferChartTypeByMode = (mode: InstrumentMode, pointsLength: number): 'line' | 'bar' | 'scatter' | 'area' => {
    if (mode === 'contact_resistance') return 'scatter';
    if (mode === 'xrd' || mode === 'surface') return 'line';
    if (mode === 'porosity') return 'bar';
    if (mode === 'spectroscopy' || mode === 'kinetics' || mode === 'microscopy') return 'line';
    return pointsLength > 20 ? 'line' : 'scatter';
};

const CharacterizationHub: React.FC<CharacterizationHubProps> = ({ initialMode, initialRecordId }) => {
    const { projects, setProjects, showToast, navigate, returnPath, setReturnPath, updateDataAnalysisSession } = useProjectContext();
    const [mode, setMode] = useState<InstrumentMode>(initialMode || 'microscopy');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [lastPushedChart, setLastPushedChart] = useState<{
        title: string;
        sourceLabel: string;
        chartType: 'line' | 'bar' | 'scatter' | 'area';
        points: ChartPoint[];
    } | null>(null);
    const [mountedModes, setMountedModes] = useState<Record<InstrumentMode, boolean>>(() => {
        const bootMode = initialMode || 'microscopy';
        return {
            microscopy: bootMode === 'microscopy',
            xrd: bootMode === 'xrd',
            surface: bootMode === 'surface',
            porosity: bootMode === 'porosity',
            kinetics: bootMode === 'kinetics',
            spectroscopy: bootMode === 'spectroscopy',
            contact_resistance: bootMode === 'contact_resistance'
        };
    });
    useEffect(() => {
        if (!selectedProjectId && projects.length > 0) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects]);

    useEffect(() => {
        if (initialMode) {
            setMode(initialMode);
            if (initialRecordId) {
                showToast({ message: "已加载关联的深度表征证据", type: 'success' });
            }
        }
    }, [initialMode, initialRecordId]);

    useEffect(() => {
        setMountedModes(prev => prev[mode] ? prev : { ...prev, [mode]: true });
    }, [mode]);

    const handleUpdateProject = (updated: any) => {
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    };

    /**
     * handleSaveAnalysis - 深度分析同步逻辑
     * 仅同步到 deepAnalysis/syncedModules，KPI 仅在“推入主雷达”后才写入 scientificData
     */
    const handleSaveAnalysis = (projectId: string, milestoneId: string, logId: string, data: any) => {
        console.log('[CharHub:Sync] CALLED', { projectId, milestoneId, logId, hubMode: mode, dataMode: data?.mode });
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            console.error('[CharHub:Sync] PROJECT NOT FOUND', projectId, 'available:', projects.map(p => p.id));
            return;
        }
        // ── 组同步模式：logId === 'GROUP:<groupId>' ──
        if (logId.startsWith('GROUP:')) {
            const groupId = logId.slice(6);
            const analysisText = String((data as any)?.aiConclusion || (data as any)?.summary || '').trim();
            if (!groupId || !analysisText) {
                showToast({ message: '同步内容为空，请先完成AI分析', type: 'warning' });
                return;
            }
            const multiAnalysis = (data as any)?.multiDatasetAnalysis || null;

            // 构建与单记录同步完全一致的 syncedModuleEntry
            const { linkedAnalysisMeta, ...analysisPayload } = (data || {}) as any;
            const moduleKeyByMode: Record<string, string> = {
                microscopy: 'MICROSCOPY', xrd: 'XRD', surface: 'XPS',
                porosity: 'POROSITY', kinetics: 'KINETICS',
                spectroscopy: 'SPECTROSCOPY', contact_resistance: 'CONTACT'
            };
            const moduleLabelByMode: Record<string, string> = {
                microscopy: '显微形貌', xrd: 'XRD物相', surface: 'XPS表面化学',
                porosity: 'BET孔隙分析', kinetics: '动力学解算',
                spectroscopy: '原位光谱', contact_resistance: '电极接触电阻'
            };
            const subMode = String(analysisPayload.mode || '').toUpperCase();
            const moduleId = `${mode}-${(subMode || moduleKeyByMode[mode] || mode).toLowerCase()}`;
            const moduleLabel = moduleLabelByMode[mode] || mode;

            // 提取数值指标
            const metrics: Record<string, number> = {};
            const metricBlacklist = new Set([
                'mode', 'aiConclusion', 'summary', 'rawReport', 'raw', 'chartData', 'thumbnailUrl',
                'generatedAt', 'matrixSync', 'peaks', 'linkedAnalysisMeta', 'multiDatasetAnalysis'
            ]);
            Object.entries(analysisPayload).forEach(([k, v]) => {
                if (metricBlacklist.has(k)) return;
                if (typeof v === 'number' && Number.isFinite(v)) metrics[k] = Number(v);
            });

            const syncedModuleEntry = {
                moduleId,
                moduleLabel,
                mode: String(analysisPayload.mode || moduleKeyByMode[mode] || mode),
                summary: analysisText,
                aiDeepAnalysis: analysisPayload.aiDeepAnalysis || analysisPayload.rawReport || undefined,
                thumbnailUrl: analysisPayload.thumbnailUrl,
                sourceAnalysisId: linkedAnalysisMeta?.id,
                sourceAnalysisType: linkedAnalysisMeta?.type,
                sourceAnalysisTitle: linkedAnalysisMeta?.title,
                generatedAt: new Date().toISOString(),
                metrics
            };

            const updatedMilestones = project.milestones.map(m => {
                if (m.id !== milestoneId) return m;
                const updatedLogs = m.logs.map(l => {
                    if (l.groupId !== groupId) return l;
                    const baseUpdate: any = { groupAnalysisInsight: analysisText };
                    if (multiAnalysis) baseUpdate.groupMultiDatasetAnalysis = multiAnalysis;
                    // 将 syncedModuleEntry 存入组级别字段（非 deepAnalysis，仅组头卡片使用）
                    const prevGroupModules = Array.isArray((l as any).groupSyncedModules) ? (l as any).groupSyncedModules : [];
                    const filteredGroupModules = prevGroupModules.filter((it: any) => {
                        const idNorm = String(it?.moduleId || '').toLowerCase();
                        const modeNorm = String(it?.mode || '').toLowerCase();
                        return idNorm !== moduleId.toLowerCase() && !(modeNorm && modeNorm === syncedModuleEntry.mode.toLowerCase());
                    });
                    baseUpdate.groupSyncedModules = [syncedModuleEntry, ...filteredGroupModules];
                    return { ...l, ...baseUpdate };
                });
                return { ...m, logs: updatedLogs };
            });
            handleUpdateProject({ ...project, milestones: updatedMilestones });
            showToast({ message: '✅ 表征分析结论与模块卡片已同步至实验组', type: 'success' });
            return;
        }
        const { linkedAnalysisMeta, ...analysisPayload } = (data || {}) as any;
        const sanitizeText = (text: string): string => {
            if (!text) return text;
            const cmdMap: Record<string, string> = {
                approx: '≈',
                cdot: '·',
                times: '×',
                mu: 'μ',
                alpha: 'α',
                beta: 'β',
                gamma: 'γ',
                delta: 'δ',
                theta: 'θ',
                lambda: 'λ',
                pm: '±',
                leq: '≤',
                geq: '≥'
            };
            const normalizeMath = (input: string) => {
                let s = input;
                s = s.replace(/\\text\{([^}]*)\}/g, '$1');
                s = s.replace(/\\mathrm\{([^}]*)\}/g, '$1');
                s = s.replace(/_\\?\{([^}]*)\}/g, '$1');
                s = s.replace(/\^\\?\{([^}]*)\}/g, '$1');
                s = s.replace(/_([A-Za-z0-9]+)/g, '$1');
                s = s.replace(/\^([A-Za-z0-9]+)/g, '$1');
                s = s.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? cmd);
                s = s.replace(/[{}]/g, '');
                return s;
            };
            let cleaned = text.replace(/\$([^$]+)\$/g, (_, inner: string) => normalizeMath(inner));
            cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');
            cleaned = cleaned.replace(/\\mathrm\{([^}]*)\}/g, '$1');
            cleaned = cleaned.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? '');
            return cleaned
                .replace(/^\s{0,3}#{1,6}\s*/gm, '')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/__([^_]+)__/g, '$1')
                .replace(/_([^_]+)_/g, '$1')
                .replace(/^\s{0,3}>\s?/gm, '')
                .replace(/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/gm, '')
                .replace(/^\s*[-*+]\s+/gm, '')
                .replace(/^\s*\d+\.\s+/gm, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };
        const normalizedAnalysisPayload = {
            ...analysisPayload,
            aiConclusion: sanitizeText(String(analysisPayload.aiConclusion || '')),
            summary: sanitizeText(String(analysisPayload.summary || '')),
            rawReport: sanitizeText(String(analysisPayload.rawReport || '')),
            aiDeepAnalysis: sanitizeText(String(analysisPayload.aiDeepAnalysis || ''))
        };

        // 通用数值指标提取：覆盖 XRD/XPS/BET/光谱/动力学/接触电阻
        const metrics: Record<string, number> = {};
        const metricBlacklist = new Set([
            'mode', 'aiConclusion', 'summary', 'rawReport', 'raw', 'chartData', 'thumbnailUrl',
            'generatedAt', 'matrixSync', 'peaks', 'linkedAnalysisMeta'
        ]);
        Object.entries(normalizedAnalysisPayload).forEach(([k, v]) => {
            if (metricBlacklist.has(k)) return;
            if (typeof v === 'number' && Number.isFinite(v)) metrics[k] = Number(v);
        });
        const moduleKeyByMode: Record<InstrumentMode, string> = {
            microscopy: 'MICROSCOPY',
            xrd: 'XRD',
            surface: 'XPS',
            porosity: 'POROSITY',
            kinetics: 'KINETICS',
            spectroscopy: 'SPECTROSCOPY',
            contact_resistance: 'CONTACT'
        };
        const moduleId = `${mode}-${String(data.mode || moduleKeyByMode[mode]).toLowerCase()}`;
        const moduleLabelByMode: Record<InstrumentMode, string> = {
            microscopy: '显微形貌',
            xrd: 'XRD物相',
            surface: 'XPS表面化学',
            porosity: 'BET孔隙分析',
            kinetics: '动力学解算',
            spectroscopy: '原位光谱',
            contact_resistance: '电极接触电阻'
        };
        const subMode = String(normalizedAnalysisPayload.mode || '').toUpperCase();
        const moduleLabel = mode === 'kinetics' && subMode
            ? `${moduleLabelByMode[mode]} · ${subMode}`
            : moduleLabelByMode[mode];
        const normalizedPoints = normalizeChartData((data as any)?.chartData);
        if (normalizedPoints.length > 0) {
            setLastPushedChart({
                title: `${moduleLabel} 数据图`,
                sourceLabel: moduleLabel,
                chartType: inferChartTypeByMode(mode, normalizedPoints.length),
                points: normalizedPoints
            });
        }
        const syncedModuleEntry = {
            moduleId,
            moduleLabel,
            mode: String(normalizedAnalysisPayload.mode || moduleKeyByMode[mode]),
            summary: normalizedAnalysisPayload.aiConclusion || normalizedAnalysisPayload.summary || '模块分析已同步',
            aiDeepAnalysis: normalizedAnalysisPayload.aiDeepAnalysis || normalizedAnalysisPayload.rawReport || undefined,
            thumbnailUrl: normalizedAnalysisPayload.thumbnailUrl,
            sourceAnalysisId: linkedAnalysisMeta?.id,
            sourceAnalysisType: linkedAnalysisMeta?.type,
            sourceAnalysisTitle: linkedAnalysisMeta?.title,
            generatedAt: new Date().toISOString(),
            metrics
        };
        const normalizeText = (v: any) => String(v || '').trim().toLowerCase();
        const nextModuleIdNorm = normalizeText(syncedModuleEntry.moduleId);
        const nextModeNorm = normalizeText(syncedModuleEntry.mode);
        const nextLabelNorm = normalizeText(syncedModuleEntry.moduleLabel);
        const isSameModuleSlot = (it: any) => {
            const idNorm = normalizeText(it?.moduleId);
            const modeNorm = normalizeText(it?.mode);
            const labelNorm = normalizeText(it?.moduleLabel);
            const hasNextMode = Boolean(nextModeNorm);
            const hasOldMode = Boolean(modeNorm);
            return (
                idNorm === nextModuleIdNorm ||
                // 当双方都有 mode 时，以 mode 作为“同槽位”判定，避免同标签不同子模式互相覆盖（如 LSV/CV/EIS）
                (hasNextMode && hasOldMode && modeNorm === nextModeNorm) ||
                // 仅为兼容旧数据：双方都缺少 mode 时，才退回到 label 判定
                (!hasNextMode && !hasOldMode && labelNorm && labelNorm === nextLabelNorm)
            );
        };

        const updatedMilestones = project.milestones.map(m => {
            if (m.id === milestoneId) {
                let updatedLogs;
                if (logId === 'NEW_LOG') {
                    const newLog: ExperimentLog = {
                        id: Date.now().toString(),
                        timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
                        content: `[深度分析] ${normalizedAnalysisPayload.mode || mode.toUpperCase()} 解析`,
                        description: normalizedAnalysisPayload.aiConclusion || '同步自表征中心。',
                        parameters: `Mode: ${mode}`,
                        status: 'Verified',
                        result: 'success',
                        linkedAnalysis: linkedAnalysisMeta ? {
                            id: linkedAnalysisMeta.id,
                            type: linkedAnalysisMeta.type,
                            title: linkedAnalysisMeta.title
                        } : undefined,
                        deepAnalysis: {
                            ...normalizedAnalysisPayload,
                            syncedModules: [syncedModuleEntry],
                            lastSyncedModuleId: moduleId
                        }
                    };
                    updatedLogs = [newLog, ...m.logs];
                } else {
                    updatedLogs = m.logs.map(l => {
                        if (l.id === logId) {
                            const prevDeep = l.deepAnalysis || {};
                            const prevModules = Array.isArray(prevDeep.syncedModules) ? prevDeep.syncedModules : [];
                            return {
                                ...l,
                                linkedAnalysis: linkedAnalysisMeta ? {
                                    id: linkedAnalysisMeta.id,
                                    type: linkedAnalysisMeta.type,
                                    title: linkedAnalysisMeta.title
                                } : l.linkedAnalysis,
                                deepAnalysis: {
                                    ...prevDeep,
                                    ...normalizedAnalysisPayload,
                                    // 同模块重复推送时覆盖旧项，不叠加重复模块卡片
                                    syncedModules: [syncedModuleEntry, ...prevModules.filter((it: any) => !isSameModuleSlot(it))],
                                    lastSyncedModuleId: moduleId
                                }
                            };
                        }
                        return l;
                    });
                }
                return { ...m, logs: updatedLogs };
            }
            return m;
        });

        console.log('[CharHub:Sync] WRITING', { milestonesCount: updatedMilestones.length, logId });
        const targetMs = updatedMilestones.find((m: any) => m.id === milestoneId);
        const targetLog = targetMs?.logs?.find((l: any) => l.id === logId);
        console.log('[CharHub:Sync] TARGET LOG syncedModules=', targetLog?.deepAnalysis?.syncedModules?.length, 'logFound=', !!targetLog);
        handleUpdateProject({ ...project, milestones: updatedMilestones });
        showToast({
            message: normalizedPoints.length > 0
                ? '分析已同步，可点击“推送数据分析室”继续美化图表'
                : '分析结论与同步模块已写入实验实录（未写入 KPI 快照）',
            type: 'success'
        });
    };

    const handlePushChartToDataLab = () => {
        if (!lastPushedChart || lastPushedChart.points.length === 0) {
            showToast({ message: '暂无中心缓存图表，可在各分析模块里直接点击“推送数据分析室”', type: 'info' });
            return;
        }
        const xValues = lastPushedChart.points.map(p => p.x);
        const yValues = lastPushedChart.points.map(p => p.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const xDomain: [number, number] = minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX];
        const yDomain: [number, number] = minY === maxY ? [minY - 1, maxY + 1] : [minY, maxY];

        updateDataAnalysisSession({
            activeTab: 'chart',
            chartType: lastPushedChart.chartType,
            chartTitle: lastPushedChart.title,
            xAxisLabel: 'X',
            yAxisLabel: 'Y',
            xDomain,
            yDomain,
            seriesList: [{
                id: `char_series_${Date.now()}`,
                name: `${lastPushedChart.sourceLabel} 原始数据`,
                data: lastPushedChart.points.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                color: '#4f46e5',
                pointColor: '#4f46e5',
                strokeWidth: 2,
                pointShape: 'circle',
                pointSize: 4,
                visible: true
            }]
        });
        navigate('data');
        showToast({ message: `已推送图表到实验数据分析室：${lastPushedChart.title}`, type: 'success' });
    };

    const handleBack = () => {
        if (returnPath) {
            const path = returnPath;
            setReturnPath(null);
            if (path.startsWith('#')) window.location.hash = path;
            else window.location.hash = `#${path}`;
        } else if (selectedProjectId) {
            navigate('project_detail', selectedProjectId, 'logs');
        } else {
            navigate('dashboard');
        }
    };

    return (
        <div className="h-full min-h-0 flex flex-col gap-4 animate-reveal overflow-hidden relative">
            <header className="flex flex-col lg:flex-row justify-between items-center bg-slate-900 px-6 py-4 rounded-2xl border border-white/5 shrink-0 shadow-2xl z-20 gap-4">
                <div className="flex items-center gap-4">
                    {returnPath ? (
                        <button
                            onClick={handleBack}
                            className="bg-amber-50 text-slate-900 px-6 py-3 rounded-2xl text-[11px] font-black uppercase shadow-lg hover:bg-white transition-all flex items-center gap-2 animate-bounce-subtle shrink-0"
                        >
                            <i className="fa-solid fa-arrow-left-long"></i> 返回
                        </button>
                    ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-rose-500 via-indigo-600 to-emerald-500 rounded-xl flex items-center justify-center text-white shadow-xl">
                            <i className="fa-solid fa-microscope text-2xl"></i>
                        </div>
                    )}
                    <div>
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tight leading-none">
                            {initialRecordId ? '深度证据回溯' : '实验表征中心'}
                        </h2>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2rem] mt-1.5">Analytical Workbench v4.0</p>
                    </div>
                </div>

                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner overflow-x-auto no-scrollbar max-w-full">
                    {[
                        { id: 'microscopy', label: '显微形貌', icon: 'fa-eye' },
                        { id: 'xrd', label: '物相 (XRD)', icon: 'fa-chart-line' },
                        { id: 'surface', label: '表面 (XPS)', icon: 'fa-atom' },
                        { id: 'porosity', label: '孔隙 (BET)', icon: 'fa-braille' },
                        { id: 'kinetics', label: '动力学', icon: 'fa-bolt-lightning' },
                        { id: 'spectroscopy', label: '原位光谱', icon: 'fa-wave-square' },
                        { id: 'contact_resistance', label: '接触电阻', icon: 'fa-bolt' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setMode(tab.id as InstrumentMode)}
                            className={`px-6 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2.5 whitespace-nowrap ${mode === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <i className={`fa-solid ${tab.icon} text-sm`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePushChartToDataLab}
                        disabled={!lastPushedChart}
                        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-700"
                        title={lastPushedChart ? `推送：${lastPushedChart.title}` : '可在各模块内直接推送'}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 推送数据分析室
                    </button>
                    <div className="flex items-center gap-2 bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-white/20 transition-all">
                        <i className="fa-solid fa-folder-open text-indigo-400 text-xs"></i>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="bg-transparent text-white text-[10px] font-bold outline-none cursor-pointer w-32 truncate appearance-none"
                        >
                            <option value="" className="bg-slate-900 text-slate-500">选择课题...</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <main className="flex-1 h-0 min-h-0 bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden relative group">
                {mountedModes.microscopy && (
                    <div className={mode === 'microscopy' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <VisionAnalysisPanel
                            projects={projects}
                            onUpdateProject={handleUpdateProject}
                            selectedProjectId={selectedProjectId}
                            traceRecordId={mode === 'microscopy' ? initialRecordId : null}
                        />
                    </div>
                )}

                {mountedModes.kinetics && (
                    <div className={mode === 'kinetics' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <ElectrochemicalEngine
                            show={true}
                            onClose={() => setMode('microscopy')}
                            projects={projects}
                            onSave={handleSaveAnalysis}
                            defaultProjectId={selectedProjectId}
                            traceRecordId={mode === 'kinetics' ? initialRecordId : null}
                            isEmbedded={true}
                        />
                    </div>
                )}

                {mountedModes.xrd && (
                    <div className={mode === 'xrd' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <XrdPhasePanel
                            projects={projects}
                            onSave={handleSaveAnalysis}
                            onUpdateProject={handleUpdateProject}
                            selectedProjectId={selectedProjectId}
                            traceRecordId={mode === 'xrd' ? initialRecordId : null}
                            onBack={handleBack}
                        />
                    </div>
                )}

                {mountedModes.surface && (
                    <div className={mode === 'surface' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <SurfaceChemistryPanel
                            projects={projects}
                            onSave={handleSaveAnalysis}
                            onUpdateProject={handleUpdateProject}
                            selectedProjectId={selectedProjectId}
                            traceRecordId={mode === 'surface' ? initialRecordId : null}
                            onBack={handleBack}
                        />
                    </div>
                )}

                {mountedModes.porosity && (
                    <div className={mode === 'porosity' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <PorosityAnalysisPanel
                            projects={projects}
                            onSave={handleSaveAnalysis}
                            onUpdateProject={handleUpdateProject}
                            selectedProjectId={selectedProjectId}
                            traceRecordId={mode === 'porosity' ? initialRecordId : null}
                            onBack={handleBack}
                        />
                    </div>
                )}

                {mountedModes.spectroscopy && (
                    <div className={mode === 'spectroscopy' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <SpectroscopyAnalysisPanel
                            projects={projects}
                            onSave={handleSaveAnalysis}
                            onUpdateProject={handleUpdateProject}
                            selectedProjectId={selectedProjectId}
                            traceRecordId={mode === 'spectroscopy' ? initialRecordId : null}
                            onBack={handleBack}
                        />
                    </div>
                )}

                {mountedModes.contact_resistance && (
                    <div className={mode === 'contact_resistance' ? 'h-full min-h-0' : 'hidden h-full min-h-0'}>
                        <ContactResistancePanel
                            projects={projects}
                            onSave={handleSaveAnalysis}
                            onUpdateProject={handleUpdateProject}
                            selectedProjectId={selectedProjectId}
                            traceRecordId={mode === 'contact_resistance' ? initialRecordId : null}
                            onBack={handleBack}
                        />
                    </div>
                )}
            </main>
        </div>
    );
};

export default CharacterizationHub;
