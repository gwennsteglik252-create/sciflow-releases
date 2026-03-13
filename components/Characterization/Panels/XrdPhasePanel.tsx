
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import * as htmlToImage from 'html-to-image';
import { ResearchProject, ExperimentLog } from '../../../types';
import LaTeXText from '../../Common/LaTeXText';
import { useProjectContext } from '../../../context/ProjectContext';
import { parseXrdData, DataPoint, applySGSmoothing, removeBackground, removeBackgroundPoly, normalizeData, PDF_CARDS, detectPeaksDetailed, PeakDetectConfig, calculateBraggD, calculateScherrer, refinePeakPosition, scorePhaseMatch, autoTunePeakParams } from '../../DataAnalysis/xrdUtils';
import { fitPseudoVoigt, fitAllPeaks, calculateFullSpectrumResidual, PseudoVoigtResult } from '../../DataAnalysis/xrdFitting';
import { williamsonHall, WHResult } from '../../DataAnalysis/xrdStrain';
import { estimatePhaseContent, QuantitativeResult } from '../../DataAnalysis/xrdQuantitative';
import { searchXrdPhases, generateContextualXrdAnalysis, generatePostMatchXrdAnalysis, generatePublicationCaption, analyzePhaseEvolution, analyzeMultiDatasetXrd } from '../../../services/gemini/analysis';
import AnalysisSyncModal, { flattenMilestonesTree, getAutoSelections } from '../AnalysisSyncModal';
import { printElement } from '../../../utils/printUtility';
import { buildArchiveFolderMeta } from '../../../utils/archiveFolder';
import FolderLibraryView from '../FolderLibraryView';
import {
    XRD_COLOR_PALETTE, XRD_GLOBAL_CARD_LIBRARY_KEY, DEFAULT_PEAK_SETTINGS,
    normalizeAndSortPeaks, toArray, toStringArray, toOptionalNumber, formatFixed,
    localizePhaseConfidence, normalizePhaseKey, collectPhaseKeysFromGroups,
    buildXrdPostMatchDeepReport, normalizePostMatchAnalysis, generateXrdDemoData,
    type XrdDataset, type PanelPeak, type ContextualXrdResult,
    type PhaseEvolutionResult, type MultiDatasetXrdResult,
    type XrdWorkspaceSnapshot, type PeakDetectSettings,
} from './xrdTypes';

interface Props {
    projects: ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    onUpdateProject?: (project: ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
    onBack?: () => void;
}

const XrdPhasePanel: React.FC<Props> = ({ projects, onSave, onUpdateProject, selectedProjectId, traceRecordId, onBack }) => {
    const { showToast, updateDataAnalysisSession, navigate } = useProjectContext();
    const [datasets, setDatasets] = useState<XrdDataset[]>([]);
    const [activeDatasetIndex, setActiveDatasetIndex] = useState(0);
    const [waterfallMode, setWaterfallMode] = useState(true);
    const [waterfallGap, setWaterfallGap] = useState(60); // 垂直间隔
    const [waterfallSectionExpanded, setWaterfallSectionExpanded] = useState(false);
    const [preprocessSectionExpanded, setPreprocessSectionExpanded] = useState(false);
    const [datasetSectionExpanded, setDatasetSectionExpanded] = useState(true);
    const [showSticks, setShowSticks] = useState(true);
    const [showOnlyMatchedSticks, setShowOnlyMatchedSticks] = useState(false);
    const [activeReferenceGroups, setActiveReferenceGroups] = useState<any[]>([]); // Jade 风格：按搜索词/材料分组
    const activeRefGroupsRef = useRef<any[]>([]);
    const [globalCardLibrary, setGlobalCardLibrary] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem(XRD_GLOBAL_CARD_LIBRARY_KEY) || '[]'); } catch { return []; }
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [selectedPhaseQueries, setSelectedPhaseQueries] = useState<Set<string>>(new Set());
    const [isBatchSearching, setIsBatchSearching] = useState(false);
    const [suggestedQueriesExpanded, setSuggestedQueriesExpanded] = useState(false);
    const [batchSearchProgress, setBatchSearchProgress] = useState({ current: 0, total: 0, currentQuery: '' });
    const [postMatchAnalysis, setPostMatchAnalysis] = useState<any>(null);
    const [isPostMatchAnalyzing, setIsPostMatchAnalyzing] = useState(false);
    const [postMatchOpen, setPostMatchOpen] = useState(true);
    const [isAutoComparing, setIsAutoComparing] = useState(false);
    const [autoCompareStep, setAutoCompareStep] = useState('');
    const [matchRationale, setMatchRationale] = useState<Array<{
        groupName: string;
        totalRefPeaks: number;
        matchedCount: number;
        matchRate: number;
        matches: Array<{ expTheta: number; refTheta: number; hkl?: string; delta: number }>;
        unmatchedExp: Array<{ twoTheta: number; intensity: number }>;
        verdict: string;
    }> | null>(null);
    const [matchRationaleOpen, setMatchRationaleOpen] = useState(false);
    const [selectedContextProjectId, setSelectedContextProjectId] = useState('');
    const [selectedContextMilestoneId, setSelectedContextMilestoneId] = useState('');
    const [selectedContextLogId, setSelectedContextLogId] = useState('');
    const [showContextModal, setShowContextModal] = useState(false);
    const [draftContextProjectId, setDraftContextProjectId] = useState('');
    const [draftContextMilestoneId, setDraftContextMilestoneId] = useState('');
    const [draftContextLogId, setDraftContextLogId] = useState('');
    const [contextualAnalysis, setContextualAnalysis] = useState<ContextualXrdResult | null>(null);
    const [isContextAnalyzing, setIsContextAnalyzing] = useState(false);
    const [peakSettings, setPeakSettings] = useState<PeakDetectSettings>(DEFAULT_PEAK_SETTINGS);
    const [lastPeakStats, setLastPeakStats] = useState<{ candidateCount: number; mergedCount: number; finalCount: number } | null>(null);
    const [manualPeakMode, setManualPeakMode] = useState(false);

    // ═══ 新增 State: 峰形拟合 / W-H / 多相含量 / 图注 ═══
    const [peakFitResults, setPeakFitResults] = useState<PseudoVoigtResult[]>([]);
    const [whResult, setWhResult] = useState<WHResult | null>(null);
    const [quantResult, setQuantResult] = useState<QuantitativeResult | null>(null);
    const [showFitCurves, setShowFitCurves] = useState(false);
    const [showResidual, setShowResidual] = useState(false);
    const [diffSpectrumPair, setDiffSpectrumPair] = useState<[number, number] | null>(null);
    const [publicationCaption, setPublicationCaption] = useState<string | null>(null);
    const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
    const [bgRemoveMethod, setBgRemoveMethod] = useState<'snip' | 'polynomial'>('snip');
    const [phaseEvolution, setPhaseEvolution] = useState<PhaseEvolutionResult | null>(null);
    const [isEvolutionAnalyzing, setIsEvolutionAnalyzing] = useState(false);
    const [evolutionExpanded, setEvolutionExpanded] = useState(false);
    const [contextOpen, setContextOpen] = useState(true);
    const [anomalyOpen, setAnomalyOpen] = useState(true);
    const [captionOpen, setCaptionOpen] = useState(true);
    const [evolutionOpen2, setEvolutionOpen2] = useState(true);
    const [peakTableExpanded, setPeakTableExpanded] = useState(true);
    const [linkDatasetModalIdx, setLinkDatasetModalIdx] = useState<number | null>(null);
    const [multiDatasetAnalysis, setMultiDatasetAnalysis] = useState<MultiDatasetXrdResult | null>(null);
    const [isMultiAnalyzing, setIsMultiAnalyzing] = useState(false);
    const [multiAnalysisOpen, setMultiAnalysisOpen] = useState(true);

    const [isMatching, setIsMatching] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const reportAreaRef = useRef<HTMLDivElement>(null);
    const chartSvgRef = useRef<SVGSVGElement>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);

    const [savedRecords, setSavedRecords] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('sciflow_xrd_library') || '[]'); } catch { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const [saveMilestoneId, setSaveMilestoneId] = useState(''); const [saveLogId, setSaveLogId] = useState('');
    const [saveTitle, setSaveTitle] = useState('');
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

    const workspaceDraftKey = useMemo(
        () => `sciflow_xrd_workspace_draft_${selectedProjectId || 'global'}`,
        [selectedProjectId]
    );

    useEffect(() => {
        localStorage.setItem('sciflow_xrd_library', JSON.stringify(savedRecords));
    }, [savedRecords]);

    useEffect(() => {
        activeRefGroupsRef.current = activeReferenceGroups;
    }, [activeReferenceGroups]);

    useEffect(() => {
        localStorage.setItem(XRD_GLOBAL_CARD_LIBRARY_KEY, JSON.stringify(globalCardLibrary));
    }, [globalCardLibrary]);

    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (!hasInitializedRef.current && activeReferenceGroups.length === 0 && globalCardLibrary.length > 0) {
            setActiveReferenceGroups(globalCardLibrary);
            hasInitializedRef.current = true;
        } else if (activeReferenceGroups.length > 0) {
            hasInitializedRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyWorkspaceSnapshot = (snapshot: XrdWorkspaceSnapshot) => {
        setDatasets((snapshot.datasets || []).map(ds => ({
            ...ds,
            peaks: normalizeAndSortPeaks(ds.peaks || [])
        })));
        setActiveDatasetIndex(snapshot.activeDatasetIndex ?? 0);
        setWaterfallMode(snapshot.waterfallMode ?? true);
        setWaterfallGap(snapshot.waterfallGap ?? 60);
        setWaterfallSectionExpanded(snapshot.waterfallSectionExpanded ?? false);
        setPreprocessSectionExpanded(snapshot.preprocessSectionExpanded ?? false);
        setDatasetSectionExpanded(snapshot.datasetSectionExpanded ?? true);
        setShowSticks(snapshot.showSticks ?? true);
        setShowOnlyMatchedSticks((snapshot as any).showOnlyMatchedSticks ?? false);
        if (snapshot.activeReferenceGroups && snapshot.activeReferenceGroups.length > 0) {
            setActiveReferenceGroups(snapshot.activeReferenceGroups);
        } else {
            setActiveReferenceGroups(globalCardLibrary);
        }
        setContextualAnalysis(snapshot.contextualAnalysis || null);
        if (snapshot.selectedContextProjectId) setSelectedContextProjectId(snapshot.selectedContextProjectId);
        if (snapshot.selectedContextMilestoneId) setSelectedContextMilestoneId(snapshot.selectedContextMilestoneId);
        if (snapshot.selectedContextLogId) setSelectedContextLogId(snapshot.selectedContextLogId);
        setPeakSettings({ ...DEFAULT_PEAK_SETTINGS, ...(snapshot.peakDetectSettings || {}) });
        setPostMatchAnalysis(normalizePostMatchAnalysis(snapshot.postMatchAnalysis));
        setMatchRationale(snapshot.matchRationale || null);
        setPhaseEvolution(snapshot.phaseEvolution || null);
        setMultiDatasetAnalysis(snapshot.multiDatasetAnalysis || null);
    };

    useEffect(() => {
        if (traceRecordId) return;
        try {
            const raw = localStorage.getItem(workspaceDraftKey);
            if (!raw) return;
            const snapshot = JSON.parse(raw) as XrdWorkspaceSnapshot;
            if (snapshot?.datasets?.length) {
                applyWorkspaceSnapshot(snapshot);
                if (snapshot.currentRecordId) {
                    setCurrentRecordId(snapshot.currentRecordId);
                }
            }
        } catch {
            // ignore broken draft payload
        }
    }, [workspaceDraftKey, traceRecordId]);

    useEffect(() => {
        if (traceRecordId) return;
        const snapshot: XrdWorkspaceSnapshot = {
            datasets,
            activeDatasetIndex,
            waterfallMode,
            waterfallGap,
            waterfallSectionExpanded,
            preprocessSectionExpanded,
            datasetSectionExpanded,
            showSticks,
            showOnlyMatchedSticks,
            activeReferenceGroups,
            contextualAnalysis,
            selectedContextProjectId,
            selectedContextMilestoneId,
            selectedContextLogId,
            peakDetectSettings: peakSettings,
            currentRecordId,
            postMatchAnalysis,
            matchRationale,
            phaseEvolution,
            multiDatasetAnalysis
        };
        try {
            localStorage.setItem(workspaceDraftKey, JSON.stringify(snapshot));
        } catch {
            // ignore quota failure
        }
    }, [
        traceRecordId,
        workspaceDraftKey,
        datasets,
        activeDatasetIndex,
        waterfallMode,
        waterfallGap,
        waterfallSectionExpanded,
        preprocessSectionExpanded,
        datasetSectionExpanded,
        showSticks,
        showOnlyMatchedSticks,
        activeReferenceGroups,
        contextualAnalysis,
        selectedContextProjectId,
        selectedContextMilestoneId,
        selectedContextLogId,
        peakSettings,
        currentRecordId,
        postMatchAnalysis,
        matchRationale,
        phaseEvolution,
        multiDatasetAnalysis
    ]);

    // 核心溯源加载逻辑
    useEffect(() => {
        if (traceRecordId) {
            const record = savedRecords.find(r => r.id === traceRecordId);
            if (record) {
                if (record.data.datasets) {
                    applyWorkspaceSnapshot(record.data as XrdWorkspaceSnapshot);
                } else {
                    // 兼容旧数据格式
                    applyWorkspaceSnapshot({
                        datasets: [{
                            id: 'ds-0',
                            name: 'Origin Data',
                            rawPoints: record.data.rawPoints || [],
                            peaks: record.data.peaks || [],
                            matchedPhases: record.data.matchedPhases || [],
                            color: '#6366f1'
                        }]
                    });
                }
                setCurrentRecordId(record.id);
                showToast({ message: `已精准溯源至物相记录: ${record.title}`, type: 'success' });
            }
        }
    }, [traceRecordId]);

    const parseLogTime = (log: ExperimentLog) => {
        const t = Date.parse((log.timestamp || '').replace(/\./g, '-').replace(/\//g, '-'));
        if (!Number.isNaN(t)) return t;
        const idNum = Number(log.id);
        return Number.isNaN(idNum) ? 0 : idNum;
    };

    const getLatestLogSelection = (project?: ResearchProject | null) => {
        if (!project) return { milestoneId: '', logId: '' };
        let bestMilestoneId = '';
        let bestLogId = '';
        let bestTime = -1;
        project.milestones.forEach(ms => {
            ms.logs.forEach(log => {
                const t = parseLogTime(log);
                if (t > bestTime) {
                    bestTime = t;
                    bestMilestoneId = ms.id;
                    bestLogId = log.id;
                }
            });
        });
        return { milestoneId: bestMilestoneId, logId: bestLogId };
    };

    useEffect(() => {
        if (!selectedContextProjectId && selectedProjectId) {
            setSelectedContextProjectId(selectedProjectId);
        } else if (!selectedContextProjectId && projects.length > 0) {
            setSelectedContextProjectId(projects[0].id);
        }
    }, [selectedProjectId, selectedContextProjectId, projects]);

    const selectedContextProject = useMemo(
        () => projects.find(p => p.id === selectedContextProjectId) || null,
        [projects, selectedContextProjectId]
    );

    const contextMilestones = useMemo(
        () => selectedContextProject?.milestones || [],
        [selectedContextProject]
    );

    const selectedContextMilestone = useMemo(
        () => contextMilestones.find(m => m.id === selectedContextMilestoneId) || null,
        [contextMilestones, selectedContextMilestoneId]
    );

    const contextLogs = useMemo(() => {
        if (!selectedContextMilestone) return [] as ExperimentLog[];
        return [...selectedContextMilestone.logs].sort((a, b) => parseLogTime(b) - parseLogTime(a));
    }, [selectedContextMilestone]);

    const draftContextProject = useMemo(
        () => projects.find(p => p.id === draftContextProjectId) || null,
        [projects, draftContextProjectId]
    );
    const draftContextMilestones = useMemo(
        () => draftContextProject?.milestones || [],
        [draftContextProject]
    );
    const draftContextTree = useMemo(
        () => flattenMilestonesTree(draftContextMilestones),
        [draftContextMilestones]
    );
    const draftContextMilestone = useMemo(
        () => draftContextMilestones.find(m => m.id === draftContextMilestoneId) || null,
        [draftContextMilestones, draftContextMilestoneId]
    );
    const draftContextLogs = useMemo(() => {
        if (!draftContextMilestone) return [] as ExperimentLog[];
        return [...draftContextMilestone.logs].sort((a, b) => parseLogTime(b) - parseLogTime(a));
    }, [draftContextMilestone]);

    useEffect(() => {
        if (!selectedContextProject) return;
        const milestoneExists = selectedContextProject.milestones.some(m => m.id === selectedContextMilestoneId);
        if (!milestoneExists) {
            const latest = getLatestLogSelection(selectedContextProject);
            setSelectedContextMilestoneId(latest.milestoneId);
            setSelectedContextLogId(latest.logId);
            return;
        }

        const currentMs = selectedContextProject.milestones.find(m => m.id === selectedContextMilestoneId);
        if (!currentMs) return;
        const logExists = currentMs.logs.some(l => l.id === selectedContextLogId);
        if (logExists) return;
        const latestLog = [...currentMs.logs].sort((a, b) => parseLogTime(b) - parseLogTime(a))[0];
        setSelectedContextLogId(latestLog?.id || '');
    }, [selectedContextProject, selectedContextMilestoneId, selectedContextLogId]);

    const openContextModal = () => {
        const projectId = selectedContextProjectId || selectedProjectId || projects[0]?.id || '';
        const project = projects.find(p => p.id === projectId);
        let milestoneId = selectedContextMilestoneId;
        let logId = selectedContextLogId;

        if (!project) {
            setDraftContextProjectId('');
            setDraftContextMilestoneId('');
            setDraftContextLogId('');
            setShowContextModal(true);
            return;
        }

        const hasMilestone = project.milestones.some(m => m.id === milestoneId);
        if (!hasMilestone) {
            const latest = getLatestLogSelection(project);
            milestoneId = latest.milestoneId;
            logId = latest.logId;
        } else {
            const ms = project.milestones.find(m => m.id === milestoneId);
            if (ms && !ms.logs.some(l => l.id === logId)) {
                logId = [...ms.logs].sort((a, b) => parseLogTime(b) - parseLogTime(a))[0]?.id || '';
            }
        }

        setDraftContextProjectId(projectId);
        setDraftContextMilestoneId(milestoneId);
        setDraftContextLogId(logId);
        setShowContextModal(true);
    };

    const confirmContextLink = () => {
        setSelectedContextProjectId(draftContextProjectId);
        setSelectedContextMilestoneId(draftContextMilestoneId);
        setSelectedContextLogId(draftContextLogId);
        setContextualAnalysis(null);
        setShowContextModal(false);
        showToast({ message: draftContextLogId ? '已关联实验记录上下文' : '未选择实验记录', type: draftContextLogId ? 'success' : 'warning' });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            const newDatasets: XrdDataset[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const text = await file.text();
                const points = parseXrdData(text);

                if (points.length > 0) {
                    newDatasets.push({
                        id: `${Date.now()}-${i}`,
                        name: file.name,
                        rawPoints: points,
                        originalPoints: JSON.parse(JSON.stringify(points)),
                        peaks: [],
                        matchedPhases: [],
                        color: XRD_COLOR_PALETTE[(datasets.length + i) % XRD_COLOR_PALETTE.length]
                    });
                }
            }

            if (newDatasets.length > 0) {
                setDatasets(prev => [...prev, ...newDatasets]);
                setActiveDatasetIndex(datasets.length); // 选中新添加的第一组
                setCurrentRecordId(null);
                setLastPeakStats(null);
                showToast({ message: `成功导入 ${newDatasets.length} 组 XRD 数据`, type: 'success' });
            }
        } catch (err) {
            showToast({ message: "解析文件时出错", type: 'error' });
        }
    };

    const handleAutoIndex = () => {
        if (!activeDataset) return;
        setIsMatching(true);
        setTimeout(() => {
            // 检测专用副本：先轻度平滑+背景扣除，不污染原始数据
            const detectSource = removeBackground(applySGSmoothing(activeDataset.rawPoints));
            const detectConfig: PeakDetectConfig = {
                mode: peakSettings.mode,
                maxPeaks: peakSettings.maxPeaksMode === 'auto' ? 'auto' : peakSettings.maxPeaks,
                minPeakDistanceDeg: peakSettings.minPeakDistanceDeg,
                minProminencePercent: peakSettings.minProminencePercent,
                minWidthDeg: peakSettings.minWidthDeg,
                smoothingPasses: peakSettings.smoothingPasses
            };

            const detectResult = detectPeaksDetailed(detectSource, detectConfig);
            setLastPeakStats(detectResult.stats);
            if (detectResult.peaks.length === 0) {
                setIsMatching(false);
                showToast({ message: '未检测到有效峰，请先平滑或检查数据范围', type: 'warning' });
                return;
            }

            // ═══ Phase 1.2: 峰位精修 ═══
            const xArr = detectSource.map(p => p.x);
            const yArr = detectSource.map(p => p.y);
            const refinedPeaks = detectResult.peaks.map(p => {
                const idx = xArr.findIndex(x => Math.abs(x - p.twoTheta) < 0.05);
                const refinedPos = idx >= 0 ? refinePeakPosition(xArr, yArr, idx) : p.twoTheta;
                return { ...p, twoTheta: refinedPos };
            });

            // ═══ Phase 1.1: Pseudo-Voigt 峰形拟合 ═══
            const peakIndices = refinedPeaks.map(p => {
                let bestIdx = 0, bestDist = Infinity;
                xArr.forEach((x, i) => { const d = Math.abs(x - p.twoTheta); if (d < bestDist) { bestDist = d; bestIdx = i; } });
                return bestIdx;
            });
            const fitResults = fitAllPeaks(xArr, yArr, peakIndices);
            setPeakFitResults(fitResults);
            setShowFitCurves(true);

            const maxPeakY = Math.max(...refinedPeaks.map(p => p.intensity), 1);
            const normalizedPeaks = refinedPeaks.map((p, idx) => {
                const fit = fitResults[idx];
                const fwhm = fit && fit.converged ? fit.fwhm : p.fwhm;
                return {
                    id: idx + 1,
                    twoTheta: (fit && fit.converged ? fit.x0 : p.twoTheta).toFixed(2),
                    intensity: ((p.intensity / maxPeakY) * 100).toFixed(1),
                    fwhm: parseFloat(fwhm.toFixed(3)),
                    d: calculateBraggD(fit && fit.converged ? fit.x0 : p.twoTheta, 0.15406).toFixed(4),
                    size: calculateScherrer(fwhm, fit && fit.converged ? fit.x0 : p.twoTheta, 0.15406).toFixed(1),
                    label: p.label || '',
                    eta: fit ? parseFloat(fit.eta.toFixed(2)) : undefined,
                    R2: fit ? parseFloat(fit.R2.toFixed(4)) : undefined,
                };
            });
            const normalizedAndSorted = normalizeAndSortPeaks(normalizedPeaks);

            // ═══ Phase 1.3: W-H 微应变分析 ═══
            const whPeaks = normalizedAndSorted.map(p => ({
                twoTheta: parseFloat(String(p.twoTheta)),
                fwhm: p.fwhm
            }));
            const whRes = williamsonHall(whPeaks);
            setWhResult(whRes);

            // ═══ Phase 2.1: d 值加权匹配 ═══
            const expPeaksForMatch = normalizedAndSorted.map(p => ({
                twoTheta: parseFloat(String(p.twoTheta)),
                intensity: parseFloat(String(p.intensity))
            }));

            const allCards = [
                ...PDF_CARDS,
                ...activeReferenceGroups.flatMap(g => g.phases || [])
            ];
            const matched = allCards
                .map(card => {
                    const result = scorePhaseMatch(expPeaksForMatch, card.peaks || []);
                    return {
                        name: card.name,
                        card: card.card,
                        crystalSystem: card.crystalSystem || 'N/A',
                        spaceGroup: card.spaceGroup || '',
                        latticeParams: card.latticeParams || '',
                        match: result.score,
                        positionScore: result.positionScore,
                        intensityScore: result.intensityScore,
                        matchedCount: result.matchedCount,
                        peaks: card.peaks || []
                    };
                })
                .filter(m => m.match >= 25)
                .sort((a, b) => b.match - a.match)
                .slice(0, 5);

            // ═══ Phase 2.3: 多相含量估算 ═══
            if (matched.length >= 2) {
                const qResult = estimatePhaseContent(
                    matched.map(m => ({ name: m.name, peaks: m.peaks })),
                    expPeaksForMatch
                );
                setQuantResult(qResult);
            } else {
                setQuantResult(null);
            }

            setDatasets(prev => prev.map((ds, idx) =>
                idx === activeDatasetIndex
                    ? { ...ds, peaks: normalizedAndSorted, matchedPhases: matched }
                    : ds
            ));
            setIsMatching(false);

            const avgR2 = fitResults.length > 0 ? (fitResults.reduce((s, f) => s + f.R2, 0) / fitResults.length) : 0;
            showToast({
                message: matched.length > 0
                    ? `寻峰+拟合完成：${normalizedAndSorted.length} 峰 (R²=${avgR2.toFixed(3)})${whRes.isValid ? ` | D=${whRes.grainSize.toFixed(1)}nm ε=${whRes.strain.toExponential(1)}` : ''} → ${matched[0].name} (${matched[0].match.toFixed(0)}%)`
                    : `寻峰+拟合完成：${normalizedAndSorted.length} 峰 (avg R²=${avgR2.toFixed(3)})`,
                type: 'success'
            });
        }, 500);
    };

    const estimateManualPeak = (points: DataPoint[], targetTheta: number) => {
        if (points.length < 7) return null;
        const sorted = [...points].sort((a, b) => a.x - b.x);
        let nearestIdx = 0;
        let minDist = Infinity;
        sorted.forEach((p, i) => {
            const d = Math.abs(p.x - targetTheta);
            if (d < minDist) {
                minDist = d;
                nearestIdx = i;
            }
        });

        const searchHalfWin = 8;
        const s = Math.max(0, nearestIdx - searchHalfWin);
        const e = Math.min(sorted.length - 1, nearestIdx + searchHalfWin);
        let peakIdx = s;
        for (let i = s; i <= e; i++) {
            if (sorted[i].y > sorted[peakIdx].y) peakIdx = i;
        }
        const peak = sorted[peakIdx];
        const localWindow = 30;
        const ls = Math.max(0, peakIdx - localWindow);
        const le = Math.min(sorted.length - 1, peakIdx + localWindow);
        const localMin = Math.min(...sorted.slice(ls, le + 1).map(p => p.y));
        const halfLevel = localMin + (peak.y - localMin) / 2;

        let left = peakIdx;
        while (left > 0 && sorted[left].y >= halfLevel) left--;
        let right = peakIdx;
        while (right < sorted.length - 1 && sorted[right].y >= halfLevel) right++;
        const fwhm = right > left ? Math.max(0.02, sorted[right].x - sorted[left].x) : 0.12;

        return {
            twoTheta: peak.x,
            intensity: peak.y,
            fwhm
        };
    };

    const handleManualPick = (twoTheta: number) => {
        if (!activeDataset) return;
        const estimated = estimateManualPeak(activeDataset.rawPoints, twoTheta);
        if (!estimated) return;
        const maxY = Math.max(...activeDataset.rawPoints.map(p => p.y), 1);
        const newPeak: PanelPeak = {
            id: 0,
            twoTheta: estimated.twoTheta.toFixed(2),
            intensity: ((estimated.intensity / maxY) * 100).toFixed(1),
            fwhm: parseFloat(estimated.fwhm.toFixed(3)),
            d: calculateBraggD(estimated.twoTheta, 0.15406).toFixed(4),
            size: calculateScherrer(estimated.fwhm, estimated.twoTheta, 0.15406).toFixed(1),
            label: '',
            manual: true
        };

        setDatasets(prev => prev.map((ds, idx) => {
            if (idx !== activeDatasetIndex) return ds;
            const deduped = [...(ds.peaks || [])].filter((p: any) => Math.abs((parseFloat(String(p.twoTheta)) || 0) - estimated.twoTheta) > 0.18);
            return { ...ds, peaks: normalizeAndSortPeaks([...deduped, newPeak]) };
        }));
    };

    const handleRemovePeak = (peakId: number) => {
        setDatasets(prev => prev.map((ds, idx) => {
            if (idx !== activeDatasetIndex) return ds;
            return { ...ds, peaks: normalizeAndSortPeaks((ds.peaks || []).filter((p: any) => p.id !== peakId)) };
        }));
    };

    const handleExportPDF = async () => {
        if (!reportAreaRef.current) return;
        showToast({ message: '正在生成高精度物相分析 PDF...', type: 'info' });
        await printElement(reportAreaRef.current, saveTitle || 'XRD_Analysis_Report');
    };

    const handleSaveRecord = () => {
        if (!saveTitle.trim()) return;
        const snapshot: XrdWorkspaceSnapshot = {
            datasets,
            activeDatasetIndex,
            waterfallMode,
            waterfallGap,
            waterfallSectionExpanded,
            preprocessSectionExpanded,
            datasetSectionExpanded,
            showSticks,
            activeReferenceGroups,
            contextualAnalysis,
            selectedContextProjectId,
            selectedContextMilestoneId,
            selectedContextLogId,
            peakDetectSettings: peakSettings,
            postMatchAnalysis,
            matchRationale,
            phaseEvolution,
        };
        const recordId = currentRecordId || Date.now().toString();
        const existing = savedRecords.find(r => r.id === recordId);
        const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
        const record = {
            id: recordId,
            title: saveTitle,
            projectId: selectedProjectId,
            timestamp: new Date().toLocaleString(),
            folder: existing?.folder || fallbackFolder,
            data: snapshot
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
        showToast({ message: currentRecordId ? "XRD 工作区已覆盖更新" : "XRD 工作区已完整保存（含卡片与上下文）", type: 'success' });
    };

    // 快速保存：已有记录直接覆盖，没有则弹窗新建
    const handleQuickSave = () => {
        if (currentRecordId) {
            const existing = savedRecords.find(r => r.id === currentRecordId);
            if (existing) {
                const snapshot: XrdWorkspaceSnapshot = {
                    datasets, activeDatasetIndex, waterfallMode, waterfallGap,
                    waterfallSectionExpanded, preprocessSectionExpanded, datasetSectionExpanded, showSticks,
                    activeReferenceGroups, contextualAnalysis, selectedContextProjectId,
                    selectedContextMilestoneId, selectedContextLogId, peakDetectSettings: peakSettings,
                    postMatchAnalysis, matchRationale, phaseEvolution,
                };
                const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
                const record = {
                    id: currentRecordId,
                    title: existing.title,
                    projectId: selectedProjectId,
                    timestamp: new Date().toLocaleString(),
                    folder: existing?.folder || fallbackFolder,
                    data: snapshot
                };
                setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? record : r));
                showToast({ message: 'XRD 工作区已覆盖更新', type: 'success' });
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
        if (record.data.datasets) {
            applyWorkspaceSnapshot(record.data as XrdWorkspaceSnapshot);
        } else {
            applyWorkspaceSnapshot({
                datasets: [{
                    id: 'ds-0',
                    name: 'Loaded Data',
                    rawPoints: record.data.rawPoints,
                    peaks: record.data.peaks,
                    matchedPhases: record.data.matchedPhases,
                    color: '#6366f1'
                }]
            });
        }
        setCurrentRecordId(record.id);
        setShowLibrary(false);
    };

    const handleSmooth = () => {
        if (!activeDataset) return;
        const smoothedPoints = applySGSmoothing(activeDataset.rawPoints);
        setDatasets(prev => prev.map((ds, idx) =>
            idx === activeDatasetIndex ? { ...ds, rawPoints: smoothedPoints } : ds
        ));
        showToast({ message: `已对 [${activeDataset.name}] 执行 S-G 平滑算法`, type: 'success' });
    };

    const handleRemoveBaseline = () => {
        if (!activeDataset) return;
        if (bgRemoveMethod === 'polynomial') {
            const finalPoints = removeBackgroundPoly(activeDataset.rawPoints, 4);
            setDatasets(prev => prev.map((ds, idx) =>
                idx === activeDatasetIndex ? { ...ds, rawPoints: finalPoints } : ds
            ));
            showToast({ message: `已对 [${activeDataset.name}] 执行多项式背景扣除`, type: 'success' });
        } else {
            // SNIP (原有逻辑)
            const smoothForBaseline = applySGSmoothing(activeDataset.rawPoints);
            const cleanedPoints = removeBackground(smoothForBaseline);
            const finalPoints = activeDataset.rawPoints.map((p, i) => ({
                x: p.x,
                y: Math.max(0, p.y - (smoothForBaseline[i].y - cleanedPoints[i].y))
            }));
            setDatasets(prev => prev.map((ds, idx) =>
                idx === activeDatasetIndex ? { ...ds, rawPoints: finalPoints } : ds
            ));
            showToast({ message: `已对 [${activeDataset.name}] 执行 SNIP 背景扣除`, type: 'success' });
        }
    };

    const handleResetData = () => {
        if (!activeDataset || !activeDataset.originalPoints) return;
        setDatasets(prev => prev.map((ds, idx) =>
            idx === activeDatasetIndex ? { ...ds, rawPoints: JSON.parse(JSON.stringify(ds.originalPoints)) } : ds
        ));
        showToast({ message: `已重置 [${activeDataset.name}] 至原始状态`, type: 'info' });
    };

    const handleClearWorkspace = () => {
        if (datasets.length === 0) return;
        if (!confirm('确定要清空 XRD 工作区吗？未保存的数据集和物相分析将被移除。')) return;
        setDatasets([]);
        setActiveDatasetIndex(0);
        setCurrentRecordId(null);
        setContextualAnalysis(null);
        setLastPeakStats(null);
        setPeakFitResults([]);
        setWhResult(null);
        setQuantResult(null);
        setShowFitCurves(false);
        setShowResidual(false);
        setDiffSpectrumPair(null);
        setPublicationCaption(null);
        setPhaseEvolution(null);
        setMultiDatasetAnalysis(null);
        setMatchRationale(null);
        setPostMatchAnalysis(null);
        setActiveReferenceGroups([]);
        showToast({ message: 'XRD 工作区已清空', type: 'info' });
    };

    const handleNormalize = () => {
        if (!activeDataset) return;
        const normalized = normalizeData(activeDataset.rawPoints);
        setDatasets(prev => prev.map((ds, idx) =>
            idx === activeDatasetIndex ? { ...ds, rawPoints: normalized } : ds
        ));
        showToast({ message: `已对 [${activeDataset.name}] 执行数据归一化`, type: 'success' });
    };

    const handleBatchPreprocess = () => {
        if (datasets.length === 0) {
            showToast({ message: '暂无可处理的数据集', type: 'info' });
            return;
        }
        setDatasets(prev => prev.map(ds => {
            const smoothed = applySGSmoothing(ds.rawPoints);
            const baselineRemoved = bgRemoveMethod === 'polynomial'
                ? removeBackgroundPoly(smoothed, 4)
                : (() => {
                    const cleaned = removeBackground(smoothed);
                    return smoothed.map((p, i) => ({
                        x: p.x,
                        y: Math.max(0, p.y - (smoothed[i].y - cleaned[i].y))
                    }));
                })();
            const normalized = normalizeData(baselineRemoved);
            return { ...ds, rawPoints: normalized };
        }));
        showToast({ message: `已对 ${datasets.length} 组数据执行一键预处理（平滑+去背景+归一化）`, type: 'success' });
    };

    // ═══ Phase 4.2: 发表级图注生成 ═══
    const handleGenerateCaption = async () => {
        if (!activeDataset || activeDataset.peaks.length === 0) {
            showToast({ message: '请先完成寻峰分析', type: 'warning' });
            return;
        }
        setIsGeneratingCaption(true);
        try {
            const caption = await generatePublicationCaption({
                sampleName: activeDataset.name,
                peaks: (activeDataset.peaks || []).map((p: any) => ({
                    twoTheta: parseFloat(String(p.twoTheta)),
                    intensity: parseFloat(String(p.intensity)),
                    hkl: p.label,
                })),
                matchedPhases: (activeDataset.matchedPhases || []).map((m: any) => ({
                    name: m.name,
                    card: m.card,
                    crystalSystem: m.crystalSystem,
                    spaceGroup: m.spaceGroup || '',
                    latticeParams: m.latticeParams || '',
                })),
                grainSize: whResult?.isValid ? whResult.grainSize : undefined,
                strain: whResult?.isValid ? whResult.strain : undefined,
            });
            setPublicationCaption(caption);
            showToast({ message: '发表级图注已生成', type: 'success' });
        } catch {
            showToast({ message: '图注生成失败', type: 'error' });
        } finally {
            setIsGeneratingCaption(false);
        }
    };

    // ═══ 物相演变追踪 ═══
    const handlePhaseEvolution = async () => {
        if (datasets.length < 2) {
            showToast({ message: '需要至少 2 组数据集才能进行演变分析（加载多个样品数据）', type: 'warning' });
            return;
        }
        const datasetsWithPeaks = datasets.filter(ds => ds.peaks && ds.peaks.length > 0);
        if (datasetsWithPeaks.length < 2) {
            showToast({ message: '请先对各数据集执行寻峰，至少 2 组需有峰数据', type: 'warning' });
            return;
        }

        // 检查关联状态
        const unlinked = datasetsWithPeaks.filter(ds => !ds.linkedLogId);
        if (unlinked.length > 0 && unlinked.length < datasetsWithPeaks.length) {
            showToast({ message: `提示：${unlinked.length} 组数据集未关联实验记录，已关联的将提供实验参数上下文`, type: 'info' });
        }

        setIsEvolutionAnalyzing(true);
        try {
            const projectTitle = selectedContextProject?.title || '未命名课题';

            // 从各数据集的关联记录中拉取实验内容（包含结构化参数）
            const dataPoints = datasetsWithPeaks.map(ds => {
                let logContent: string | undefined;
                if (ds.linkedLogId && ds.linkedProjectId) {
                    const proj = projects.find(p => p.id === ds.linkedProjectId);
                    if (proj && ds.linkedMilestoneId) {
                        const ms = proj.milestones.find(m => m.id === ds.linkedMilestoneId);
                        const log = ms?.logs.find(l => l.id === ds.linkedLogId);
                        if (log) {
                            // 拼接实验内容和参数
                            const parts = [log.content || '', log.description || ''];
                            if (log.parameters && typeof log.parameters === 'object') {
                                // 结构化输出参数（键值对形式），让 AI 更易解读
                                const paramStr = Object.entries(log.parameters)
                                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                    .map(([k, v]) => `${k}=${v}`)
                                    .join(', ');
                                if (paramStr) parts.push(`【实验参数】${paramStr}`);
                            } else if (log.parameters) {
                                parts.push(String(log.parameters));
                            }
                            // 追加 scientificData
                            if (log.scientificData && typeof log.scientificData === 'object') {
                                const sciStr = Object.entries(log.scientificData)
                                    .filter(([, v]) => v !== null && v !== undefined)
                                    .map(([k, v]) => `${k}=${v}`)
                                    .join(', ');
                                if (sciStr) parts.push(`【科学数据】${sciStr}`);
                            }
                            logContent = parts.filter(Boolean).join(' | ').slice(0, 600);
                        }
                    }
                }
                return {
                    label: ds.name + (ds.linkedLogTitle ? ` (${ds.linkedLogTitle})` : ''),
                    logContent,
                    peaks: (ds.peaks || []).map((p: any) => ({
                        twoTheta: parseFloat(String(p.twoTheta)) || 0,
                        intensity: parseFloat(String(p.intensity)) || 0,
                        label: p.label,
                    })),
                    matchedPhases: (ds.matchedPhases || []).map((m: any) => m.name),
                };
            });

            const result = await analyzePhaseEvolution({ projectTitle, dataPoints });
            setPhaseEvolution(result);
            showToast({ message: `物相演变分析完成：${result.phaseTransitions?.length || 0} 个转变事件`, type: 'success' });
        } catch {
            showToast({ message: '物相演变分析失败', type: 'error' });
        } finally {
            setIsEvolutionAnalyzing(false);
        }
    };

    // ═══ 多组综合分析：关联实验记录参数差异 ═══
    const handleMultiDatasetAnalysis = async () => {
        if (datasets.length < 2) {
            showToast({ message: '需要至少 2 组数据集才能进行多组综合分析', type: 'warning' });
            return;
        }
        const datasetsWithPeaks = datasets.filter(ds => ds.peaks && ds.peaks.length > 0);
        if (datasetsWithPeaks.length < 2) {
            showToast({ message: '请先对各数据集执行寻峰，至少 2 组需有峰数据', type: 'warning' });
            return;
        }

        const linkedCount = datasetsWithPeaks.filter(ds => ds.linkedLogId).length;
        if (linkedCount === 0) {
            showToast({ message: '建议至少关联 1 组实验记录以获得参数差异分析（将基于纯数据对比）', type: 'info' });
        } else if (linkedCount < datasetsWithPeaks.length) {
            showToast({ message: `${linkedCount}/${datasetsWithPeaks.length} 组已关联实验记录`, type: 'info' });
        }

        setIsMultiAnalyzing(true);
        try {
            const projectTitle = selectedContextProject?.title || '未命名课题';

            const dsInputs = datasetsWithPeaks.map(ds => {
                let rawParameters: Record<string, any> | string | undefined;
                let content: string | undefined;
                let description: string | undefined;
                let linkedLogTitle: string | undefined = ds.linkedLogTitle;

                if (ds.linkedLogId && ds.linkedProjectId && ds.linkedMilestoneId) {
                    const proj = projects.find(p => p.id === ds.linkedProjectId);
                    if (proj) {
                        const ms = proj.milestones.find(m => m.id === ds.linkedMilestoneId);
                        const log = ms?.logs.find(l => l.id === ds.linkedLogId);
                        if (log) {
                            content = log.content || '';
                            description = log.description || '';
                            linkedLogTitle = linkedLogTitle || log.content?.slice(0, 30) || '';

                            // 1. 优先从 parameterList（结构化键值对）提取参数
                            if (Array.isArray((log as any).parameterList) && (log as any).parameterList.length > 0) {
                                const paramObj: Record<string, any> = {};
                                (log as any).parameterList.forEach((p: any) => {
                                    if (p.key && (p.value !== null && p.value !== undefined && p.value !== '')) {
                                        paramObj[p.key] = p.unit ? `${p.value} ${p.unit}` : p.value;
                                    }
                                });
                                if (Object.keys(paramObj).length > 0) {
                                    rawParameters = paramObj;
                                }
                            }

                            // 2. 从 parameters 字符串补充（如果 parameterList 为空）
                            if (!rawParameters && log.parameters && typeof log.parameters === 'string' && log.parameters.trim()) {
                                // 尝试解析 "key=value, key=value" 格式
                                const pairs: Record<string, string> = {};
                                log.parameters.split(/[,;，；]\s*/).forEach((seg: string) => {
                                    const m = seg.match(/^(.+?)\s*[=:：]\s*(.+)$/);
                                    if (m) pairs[m[1].trim()] = m[2].trim();
                                });
                                if (Object.keys(pairs).length > 0) {
                                    rawParameters = pairs;
                                } else {
                                    rawParameters = log.parameters;
                                }
                            } else if (!rawParameters && log.parameters && typeof log.parameters === 'object') {
                                rawParameters = log.parameters;
                            }

                            // 3. 合并 scientificData（产量等数值指标）
                            if (log.scientificData && typeof log.scientificData === 'object') {
                                if (typeof rawParameters === 'object') {
                                    rawParameters = { ...rawParameters, ...log.scientificData };
                                } else {
                                    rawParameters = log.scientificData;
                                }
                            }
                        }
                    }
                }

                // ── Fallback: 未手动关联时，通过数据集名称自动匹配课题内 log ──
                if (!rawParameters && !content && ds.name) {
                    const dsNameNorm = ds.name.toLowerCase().trim();
                    for (const proj of projects) {
                        if (rawParameters) break;
                        for (const ms of proj.milestones) {
                            if (rawParameters) break;
                            for (const log of ms.logs) {
                                const logTitle = (log.content || '').toLowerCase().trim();
                                // 名称包含匹配（数据集名 → log标题 或 反向包含）
                                if (!logTitle) continue;
                                const isMatch = dsNameNorm.length > 3 && (
                                    logTitle.includes(dsNameNorm) ||
                                    dsNameNorm.includes(logTitle.slice(0, Math.max(8, logTitle.length)))
                                );
                                if (!isMatch) continue;
                                content = log.content || '';
                                description = log.description || '';
                                linkedLogTitle = log.content?.slice(0, 30) || ds.name;
                                // 提取 parameterList
                                if (Array.isArray((log as any).parameterList) && (log as any).parameterList.length > 0) {
                                    const paramObj: Record<string, any> = {};
                                    (log as any).parameterList.forEach((p: any) => {
                                        if (p.key && (p.value !== null && p.value !== undefined && p.value !== '')) {
                                            paramObj[p.key] = p.unit ? `${p.value} ${p.unit}` : p.value;
                                        }
                                    });
                                    if (Object.keys(paramObj).length > 0) rawParameters = paramObj;
                                }
                                // 补充 scientificData
                                if (log.scientificData && typeof log.scientificData === 'object') {
                                    if (typeof rawParameters === 'object') {
                                        rawParameters = { ...rawParameters, ...log.scientificData };
                                    } else {
                                        rawParameters = log.scientificData;
                                    }
                                }
                                break;
                            }
                        }
                    }
                }

                return {
                    datasetName: ds.name,
                    linkedLogTitle,
                    rawParameters,
                    content,
                    description,
                    peaks: (ds.peaks || []).slice(0, 10).map((p: any) => ({
                        twoTheta: parseFloat(String(p.twoTheta)) || 0,
                        intensity: parseFloat(String(p.intensity)) || 0,
                        label: p.label,
                    })),
                    matchedPhases: (ds.matchedPhases || []).map((m: any) => m.name),
                };
            });

            // 调试：输出每组提取到的参数
            console.log('[多组分析] 参数提取结果：', dsInputs.map(d => ({
                name: d.datasetName, linked: d.linkedLogTitle,
                params: d.rawParameters, hasContent: !!d.content
            })));

            const result = await analyzeMultiDatasetXrd(projectTitle, dsInputs);
            setMultiDatasetAnalysis(result);
            setMultiAnalysisOpen(true);
            showToast({ message: `多组综合分析完成：${result.parameterEffects?.length || 0} 个参数效应`, type: 'success' });
        } catch {
            showToast({ message: '多组综合分析失败', type: 'error' });
        } finally {
            setIsMultiAnalyzing(false);
        }
    };

    // ═══ Phase 3.2: 差谱计算 ═══
    const diffSpectrumData = useMemo(() => {
        if (!diffSpectrumPair || datasets.length < 2) return null;
        const [idxA, idxB] = diffSpectrumPair;
        const dsA = datasets[idxA];
        const dsB = datasets[idxB];
        if (!dsA || !dsB) return null;

        // 插值到共同 x 网格
        const minX = Math.max(dsA.rawPoints[0]?.x || 0, dsB.rawPoints[0]?.x || 0);
        const maxX = Math.min(
            dsA.rawPoints[dsA.rawPoints.length - 1]?.x || 100,
            dsB.rawPoints[dsB.rawPoints.length - 1]?.x || 100
        );
        const step = 0.05;
        const result: DataPoint[] = [];

        const interpolateY = (points: DataPoint[], targetX: number): number => {
            let lo = 0, hi = points.length - 1;
            while (lo < hi - 1) {
                const mid = Math.floor((lo + hi) / 2);
                if (points[mid].x <= targetX) lo = mid; else hi = mid;
            }
            const x0 = points[lo].x, x1 = points[hi].x;
            const y0 = points[lo].y, y1 = points[hi].y;
            if (Math.abs(x1 - x0) < 1e-10) return y0;
            return y0 + (y1 - y0) * (targetX - x0) / (x1 - x0);
        };

        for (let x = minX; x <= maxX; x += step) {
            const yA = interpolateY(dsA.rawPoints, x);
            const yB = interpolateY(dsB.rawPoints, x);
            result.push({ x: parseFloat(x.toFixed(2)), y: yA - yB });
        }
        return result;
    }, [diffSpectrumPair, datasets]);

    // ═══ 残差数据 ═══
    const residualData = useMemo(() => {
        const ds = datasets[activeDatasetIndex];
        if (!showResidual || !ds || peakFitResults.length === 0) return null;
        const xArr = ds.rawPoints.map(p => p.x);
        const yArr = ds.rawPoints.map(p => p.y);
        return calculateFullSpectrumResidual(xArr, yArr, peakFitResults);
    }, [showResidual, datasets, activeDatasetIndex, peakFitResults]);

    const handleAiSearch = async (queryOverride?: string) => {
        const query = (queryOverride ?? searchQuery).trim();
        if (!query) return;
        // 当从 AI 推荐词点击触发时，自动展开参考物相库区块并显示搜索词
        if (queryOverride) {
            setWaterfallSectionExpanded(true);
            setSearchQuery(queryOverride);
        }
        setIsSearching(true);
        try {
            const result = await searchXrdPhases(query);
            if (result.phases && result.phases.length > 0) {
                // 创建一个文件夹/分组
                const groupId = `group-${Date.now()}`;
                const newGroup = {
                    id: groupId,
                    name: query,
                    isExpanded: true,
                    visible: true,
                    phases: result.phases.map((p: any, i: number) => ({
                        ...p,
                        id: `${p.card}-${groupId}-${i}`,
                        color: XRD_COLOR_PALETTE[(activeReferenceGroups.length) % XRD_COLOR_PALETTE.length],
                        visible: true
                    }))
                };
                const newGroupKey = normalizePhaseKey(newGroup.name);
                setActiveReferenceGroups(prev => {
                    const filtered = prev.filter(g => normalizePhaseKey(g?.name) !== newGroupKey);
                    return [newGroup, ...filtered];
                });
                setGlobalCardLibrary(prev => {
                    const exists = prev.some(g => normalizePhaseKey(g?.name) === newGroupKey);
                    if (exists) {
                        return prev.map(g => normalizePhaseKey(g?.name) === newGroupKey ? newGroup : g);
                    }
                    return [newGroup, ...prev];
                });
                setShowSticks(true);
                if (!queryOverride) setSearchQuery('');
                showToast({ message: `已载入 [${newGroup.name}] 文件夹，包含 ${result.phases.length} 个晶型`, type: 'success' });
            } else {
                showToast({ message: "未找到相关物相数据", type: 'warning' });
            }
        } catch (err) {
            showToast({ message: "AI 检索失败", type: 'error' });
        } finally {
            setIsSearching(false);
        }
    };

    // 批量搜索所选 AI 推荐词（并行）
    const handleBatchPhaseSearch = async (queries: string[]) => {
        if (queries.length === 0) return;
        setWaterfallSectionExpanded(true);
        setIsBatchSearching(true);
        setBatchSearchProgress({ current: 0, total: queries.length, currentQuery: `并行检索 ${queries.length} 个物相...` });
        // 过滤已存在的卡片（ref + localStorage 双重检查，防止任一源不同步）
        let storedGroups: any[] = [];
        try { storedGroups = JSON.parse(localStorage.getItem(XRD_GLOBAL_CARD_LIBRARY_KEY) || '[]'); } catch { }
        const existingPhaseKeys = collectPhaseKeysFromGroups([
            ...activeRefGroupsRef.current,
            ...storedGroups
        ]);
        const newQueries = queries.filter(q => !existingPhaseKeys.has(normalizePhaseKey(q)));
        const skippedCount = queries.length - newQueries.length;
        let successCount = skippedCount;
        if (newQueries.length > 0) {
            const searchResults = await Promise.allSettled(
                newQueries.map(q => searchXrdPhases(q).then(r => ({ query: q, result: r })))
            );
            const newGroups: any[] = [];
            searchResults.forEach((settled, i) => {
                if (settled.status === 'fulfilled' && settled.value.result.phases?.length > 0) {
                    const { query: q, result } = settled.value;
                    const groupId = `group-${Date.now()}-${i}`;
                    newGroups.push({
                        id: groupId,
                        name: q,
                        isExpanded: true,
                        visible: true,
                        phases: result.phases.map((p: any, j: number) => ({
                            ...p,
                            id: `${p.card}-${groupId}-${j}`,
                            color: XRD_COLOR_PALETTE[i % XRD_COLOR_PALETTE.length],
                            visible: true
                        }))
                    });
                    successCount++;
                }
            });
            if (newGroups.length > 0) {
                const newNames = new Set(newGroups.map(g => normalizePhaseKey(g?.name)));
                setActiveReferenceGroups(prev => [
                    ...newGroups,
                    ...prev.filter(g => !newNames.has(normalizePhaseKey(g?.name)))
                ]);
                setGlobalCardLibrary(prev => {
                    const filtered = prev.filter(g => !newNames.has(normalizePhaseKey(g?.name)));
                    return [...newGroups, ...filtered];
                });
                setShowSticks(true);
            }
        }
        setSearchQuery('');
        setIsBatchSearching(false);
        setBatchSearchProgress({ current: 0, total: 0, currentQuery: '' });
        setSelectedPhaseQueries(new Set());
        if (successCount > 0) {
            showToast({ message: `✅ 批量检索完成：成功 ${successCount}/${queries.length} 个物相${skippedCount > 0 ? `（${skippedCount} 个已有跳过）` : ''}`, type: 'success' });
        } else {
            showToast({ message: '批量检索未找到有效物相', type: 'warning' });
        }
    };

    // 基于匹配卡片的二次深度分析
    const handlePostMatchAnalysis = async () => {
        if (!activeDataset || activeReferenceGroups.length === 0) {
            showToast({ message: '请先匹配参考物相卡片', type: 'warning' });
            return;
        }
        setIsPostMatchAnalyzing(true);
        try {
            // 构建实验记录上下文
            let logCtx: any = null;
            if (activeDataset.linkedLogId && activeDataset.linkedProjectId && activeDataset.linkedMilestoneId) {
                const proj = projects.find(p => p.id === activeDataset.linkedProjectId);
                const ms = proj?.milestones.find(m => m.id === activeDataset.linkedMilestoneId);
                const log = ms?.logs.find(l => l.id === activeDataset.linkedLogId);
                if (log) {
                    logCtx = {
                        content: log.content || '',
                        description: log.description || '',
                        parameters: log.parameters || '',
                    };
                }
            }
            // 构建匹配卡片数据
            const matchedCards = activeReferenceGroups.filter(g => g.visible).map(g => ({
                groupName: g.name,
                phases: g.phases.filter((p: any) => p.visible).map((p: any) => ({
                    name: p.name,
                    card: p.card,
                    crystalSystem: p.crystalSystem,
                    spaceGroup: p.spaceGroup,
                    latticeParams: p.latticeParams,
                    peaks: p.peaks,
                }))
            }));
            const linkedProj = projects.find(p => p.id === activeDataset.linkedProjectId);
            const result = await generatePostMatchXrdAnalysis(
                linkedProj?.title || '未命名项目',
                logCtx,
                {
                    datasetName: activeDataset.name,
                    peaks: activeDataset.peaks.map((p: any) => ({
                        twoTheta: parseFloat(p.twoTheta),
                        intensity: parseFloat(p.intensity || '100'),
                        d: p.d,
                        size: p.size,
                        label: p.label,
                    })),
                },
                matchedCards
            );
            setPostMatchAnalysis(normalizePostMatchAnalysis(result));
            setPostMatchOpen(true);
            showToast({ message: '✅ 卡片匹配后深度分析完成', type: 'success' });
        } catch (err) {
            showToast({ message: '深度分析失败', type: 'error' });
        } finally {
            setIsPostMatchAnalyzing(false);
        }
    };

    // 一键智能对标流水线：AI 分析 → 搜索卡片 → 深度对比
    const handleAutoCompare = async () => {
        if (!activeDataset || !activeDataset.peaks?.length) {
            showToast({ message: '请先导入 XRD 数据并执行寻峰', type: 'warning' });
            return;
        }
        setIsAutoComparing(true);
        try {
            // ===== Step 1: AI 初步分析（多组数据时聚合所有数据集信息） =====
            setAutoCompareStep('步骤 1/3：AI 智能物相识别...');
            let linkedLog: any = null;
            let projectTitle = '未命名课题';
            if (activeDataset.linkedLogId && activeDataset.linkedProjectId && activeDataset.linkedMilestoneId) {
                const linkedProj = projects.find(p => p.id === activeDataset.linkedProjectId);
                const linkedMs = linkedProj?.milestones.find(m => m.id === activeDataset.linkedMilestoneId);
                linkedLog = linkedMs?.logs.find(l => l.id === activeDataset.linkedLogId);
                projectTitle = linkedProj?.title || projectTitle;
            }

            // 聚合所有有峰数据集的信息，提供给 AI 更全面的视角
            const allDatasetsWithPeaks = datasets.filter(ds => ds.peaks && ds.peaks.length > 0);
            const multiDatasetContext = allDatasetsWithPeaks.length >= 2
                ? `\n\n【其他数据组信息（共 ${allDatasetsWithPeaks.length} 组）】\n` + allDatasetsWithPeaks.map((ds, i) => {
                    let dsParams = '';
                    if (ds.linkedLogId && ds.linkedProjectId && ds.linkedMilestoneId) {
                        const proj = projects.find(p => p.id === ds.linkedProjectId);
                        const ms = proj?.milestones.find(m => m.id === ds.linkedMilestoneId);
                        const log = ms?.logs.find(l => l.id === ds.linkedLogId);
                        if (log?.parameters && typeof log.parameters === 'object') {
                            dsParams = Object.entries(log.parameters)
                                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                .map(([k, v]) => `${k}=${v}`).join(', ');
                        }
                    }
                    const topPeaks = (ds.peaks || []).slice(0, 5).map((p: any) => parseFloat(String(p.twoTheta)).toFixed(1) + '°').join(', ');
                    return `组${i + 1}: ${ds.name}${ds.linkedLogTitle ? ` (${ds.linkedLogTitle})` : ''}${dsParams ? ` 参数: ${dsParams}` : ''} 主要峰: ${topPeaks}`;
                }).join('\n')
                : '';

            const analysisResult = await generateContextualXrdAnalysis(
                projectTitle,
                linkedLog ? {
                    content: (linkedLog.content || '') + multiDatasetContext,
                    description: linkedLog.description,
                    parameters: linkedLog.parameters,
                    scientificData: linkedLog.scientificData
                } : {
                    content: `XRD 数据集: ${activeDataset.name}，未关联实验记录` + multiDatasetContext,
                    description: '',
                    parameters: '',
                },
                {
                    datasetName: activeDataset.name + (allDatasetsWithPeaks.length >= 2 ? ` (共 ${allDatasetsWithPeaks.length} 组数据)` : ''),
                    peakSummary: (activeDataset.peaks || []).slice(0, 8).map((p: any) => ({
                        twoTheta: parseFloat(String(p.twoTheta)) || 0,
                        intensity: parseFloat(String(p.intensity)) || 0,
                        label: p.label
                    })),
                    matchedPhases: []
                }
            );
            setContextualAnalysis(analysisResult);

            // ===== Step 2: 批量搜索推荐物相（跳过已有卡片） =====
            const allQueries = analysisResult.suggestedPhaseQueries?.slice(0, 4) || [];
            if (allQueries.length === 0) {
                showToast({ message: 'AI 未生成推荐搜索词，无法自动对标', type: 'warning' });
                setIsAutoComparing(false);
                setAutoCompareStep('');
                return;
            }
            setWaterfallSectionExpanded(true);
            // 检查已有卡片（ref + localStorage 双重检查）
            let storedGroups: any[] = [];
            try { storedGroups = JSON.parse(localStorage.getItem(XRD_GLOBAL_CARD_LIBRARY_KEY) || '[]'); } catch { }
            const existingPhaseKeys = collectPhaseKeysFromGroups([
                ...activeRefGroupsRef.current,
                ...storedGroups
            ]);
            const newQueries = allQueries.filter((q: string) => !existingPhaseKeys.has(normalizePhaseKey(q)));
            const skippedCount = allQueries.length - newQueries.length;
            if (skippedCount > 0) {
                setAutoCompareStep(`步骤 2/3：${skippedCount} 个已有卡片跳过，检索 ${newQueries.length} 个新物相...`);
            } else {
                setAutoCompareStep(`步骤 2/3：并行检索 ${newQueries.length} 个推荐物相...`);
            }
            let successCount = skippedCount; // 已有的算成功
            if (newQueries.length > 0) {
                const searchResults = await Promise.allSettled(
                    newQueries.map((q: string) => searchXrdPhases(q).then(r => ({ query: q, result: r })))
                );
                const newGroups: any[] = [];
                searchResults.forEach((settled, i) => {
                    if (settled.status === 'fulfilled' && settled.value.result.phases?.length > 0) {
                        const { query: q, result } = settled.value;
                        const groupId = `group-${Date.now()}-${i}`;
                        newGroups.push({
                            id: groupId,
                            name: q,
                            isExpanded: true,
                            visible: true,
                            phases: result.phases.map((p: any, j: number) => ({
                                ...p,
                                id: `${p.card}-${groupId}-${j}`,
                                color: XRD_COLOR_PALETTE[i % XRD_COLOR_PALETTE.length],
                                visible: true
                            }))
                        });
                        successCount++;
                    }
                });
                if (newGroups.length > 0) {
                    setActiveReferenceGroups(prev => [...newGroups, ...prev]);
                    setGlobalCardLibrary(prev => {
                        const newNames = new Set(newGroups.map(g => normalizePhaseKey(g?.name)));
                        const filtered = prev.filter(g => !newNames.has(normalizePhaseKey(g?.name)));
                        return [...newGroups, ...filtered];
                    });
                    setShowSticks(true);
                }
            }
            setSearchQuery('');

            if (successCount === 0) {
                showToast({ message: '物相检索未找到有效卡片，无法继续对标', type: 'warning' });
                setIsAutoComparing(false);
                setAutoCompareStep('');
                return;
            }

            // ===== 计算对标分析报告 =====
            setAutoCompareStep('计算峰位匹配度...');
            await new Promise(r => setTimeout(r, 100));
            const latestGroups = activeRefGroupsRef.current;
            const expPeaks = (activeDataset.peaks || []).map((p: any) => ({
                twoTheta: parseFloat(String(p.twoTheta)),
                intensity: parseFloat(String(p.intensity || '100'))
            }));
            const TOLERANCE = 0.35; // 匹配容差°
            const rationale = latestGroups.filter((g: any) => g.visible).map((g: any) => {
                // 对每个组内所有可见 phase 的参考峰汇总
                const allRefPeaks: Array<{ twoTheta: number; intensity: number; hkl?: string; phaseName: string }> = [];
                for (const phase of g.phases.filter((p: any) => p.visible)) {
                    for (const pk of (phase.peaks || [])) {
                        allRefPeaks.push({ twoTheta: pk.twoTheta, intensity: pk.intensity, hkl: pk.hkl, phaseName: phase.name });
                    }
                }
                // 匹配：找实验峰中与参考峰最近的
                const usedExp = new Set<number>();
                const matches: Array<{ expTheta: number; refTheta: number; hkl?: string; delta: number }> = [];
                for (const ref of allRefPeaks) {
                    let bestIdx = -1, bestDelta = Infinity;
                    expPeaks.forEach((ep: any, idx: number) => {
                        const d = Math.abs(ep.twoTheta - ref.twoTheta);
                        if (d < TOLERANCE && d < bestDelta && !usedExp.has(idx)) {
                            bestIdx = idx;
                            bestDelta = d;
                        }
                    });
                    if (bestIdx >= 0) {
                        usedExp.add(bestIdx);
                        matches.push({ expTheta: expPeaks[bestIdx].twoTheta, refTheta: ref.twoTheta, hkl: ref.hkl, delta: bestDelta });
                    }
                }
                const unmatchedExp = expPeaks.filter((_: any, i: number) => !usedExp.has(i)).slice(0, 5);
                const matchRate = allRefPeaks.length > 0 ? matches.length / allRefPeaks.length : 0;
                let verdict = '';
                if (matchRate >= 0.7) verdict = '✅ 高度匹配，物相鉴定可信';
                else if (matchRate >= 0.4) verdict = '⚠️ 部分匹配，需确认是否存在其他物相';
                else verdict = '❌ 匹配度低，建议重新检索或调整卡片';
                return {
                    groupName: g.name,
                    totalRefPeaks: allRefPeaks.length,
                    matchedCount: matches.length,
                    matchRate,
                    matches: matches.sort((a, b) => a.refTheta - b.refTheta),
                    unmatchedExp,
                    verdict
                };
            });
            setMatchRationale(rationale);

            showToast({ message: `✅ 智能对标完成！识别 ${allQueries.length} 个物相，${successCount} 个已就绪。请查看对标分析报告`, type: 'success' });
        } catch (err) {
            showToast({ message: '智能对标流程失败', type: 'error' });
        } finally {
            setIsAutoComparing(false);
            setAutoCompareStep('');
        }
    };

    const handleContextualAnalysis = async () => {
        if (!activeDataset) {
            showToast({ message: '请先导入 XRD 数据', type: 'warning' });
            return;
        }
        if (!activeDataset.peaks?.length) {
            showToast({ message: '请先执行寻峰后再进行分析', type: 'warning' });
            return;
        }

        // 多组数据时自动升级为多组综合分析
        const datasetsWithPeaks = datasets.filter(ds => ds.peaks && ds.peaks.length > 0);
        if (datasetsWithPeaks.length >= 2) {
            handleMultiDatasetAnalysis();
            return;
        }

        // 查找关联的实验记录（可选）
        let linkedLog: any = null;
        let projectTitle = '未命名课题';
        if (activeDataset.linkedLogId && activeDataset.linkedProjectId && activeDataset.linkedMilestoneId) {
            const linkedProj = projects.find(p => p.id === activeDataset.linkedProjectId);
            const linkedMs = linkedProj?.milestones.find(m => m.id === activeDataset.linkedMilestoneId);
            linkedLog = linkedMs?.logs.find(l => l.id === activeDataset.linkedLogId);
            projectTitle = linkedProj?.title || projectTitle;
        }

        setIsContextAnalyzing(true);
        try {
            const result = await generateContextualXrdAnalysis(
                projectTitle,
                linkedLog ? {
                    content: linkedLog.content,
                    description: linkedLog.description,
                    parameters: linkedLog.parameters,
                    scientificData: linkedLog.scientificData
                } : {
                    content: `XRD 数据集: ${activeDataset.name}，未关联实验记录，请基于纯 XRD 数据进行分析`,
                    description: '',
                    parameters: '',
                },
                {
                    datasetName: activeDataset.name,
                    peakSummary: (activeDataset.peaks || []).slice(0, 8).map((p: any) => ({
                        twoTheta: parseFloat(String(p.twoTheta)) || 0,
                        intensity: parseFloat(String(p.intensity)) || 0,
                        label: p.label
                    })),
                    matchedPhases: (activeDataset.matchedPhases || []).map((p: any) => p.name)
                }
            );
            setContextualAnalysis(result);
            showToast({ message: linkedLog ? '已完成实验记录上下文驱动的 XRD 解析' : '已完成纯数据 XRD 分析（关联实验记录可获得更深入的解读）', type: 'success' });
        } catch (error) {
            showToast({ message: '上下文分析失败，请稍后重试', type: 'error' });
        } finally {
            setIsContextAnalyzing(false);
        }
    };

    const toggleGroupExpansion = (id: string) => {
        setActiveReferenceGroups(prev => prev.map(g => g.id === id ? { ...g, isExpanded: !g.isExpanded } : g));
    };

    const toggleGroupVisibility = (id: string) => {
        setActiveReferenceGroups(prev => prev.map(g => {
            if (g.id === id) {
                const nextVisible = !g.visible;
                return {
                    ...g,
                    visible: nextVisible,
                    phases: g.phases.map((p: any) => ({ ...p, visible: nextVisible }))
                };
            }
            return g;
        }));
    };

    const togglePhaseVisibility = (groupId: string, phaseId: string) => {
        setActiveReferenceGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                const nextPhases = g.phases.map((p: any) => p.id === phaseId ? { ...p, visible: !p.visible } : p);
                return { ...g, phases: nextPhases, visible: nextPhases.some((p: any) => p.visible) };
            }
            return g;
        }));
    };

    const removeGroup = (id: string) => {
        setActiveReferenceGroups(prev => {
            const removing = prev.find(g => g.id === id);
            if (removing) {
                // 同步从全局库移除，防止去重检查误判
                setGlobalCardLibrary(lib => lib.filter(g => g.name?.toLowerCase?.() !== removing.name?.toLowerCase?.()));
            }
            return prev.filter(g => g.id !== id);
        });
    };

    // 为 SVG 渲染拍平所有可见的卡片
    const allVisibleReferenceCards = useMemo(() => {
        const flattened: any[] = [];
        activeReferenceGroups.forEach(g => {
            g.phases.forEach((p: any) => {
                if (p.visible) flattened.push(p);
            });
        });
        return flattened;
    }, [activeReferenceGroups]);


    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    };

    const handleSyncConfirm = (targetProjectId: string, targetMilestoneId: string, targetLogId: string) => {
        if (!currentRecordId || !onUpdateProject) return;
        const project = projects.find(p => p.id === targetProjectId);
        if (!project) return;

        const currentRecord = savedRecords.find(r => r.id === currentRecordId);
        const title = currentRecord ? currentRecord.title : `XRD Analysis ${new Date().toLocaleDateString()}`;

        const updatedMilestones = project.milestones.map(m => {
            if (m.id === targetMilestoneId) {
                const updatedLogs = m.logs.map(l => {
                    if (l.id === targetLogId) {
                        return {
                            ...l,
                            linkedAnalysis: {
                                id: currentRecordId,
                                type: 'xrd' as const,
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

    const handleSaveToLog = async (projectId: string, milestoneId: string, logId: string) => {
        const peaks = (activeDataset?.peaks || []).map((p: any) => ({
            twoTheta: Number(p.twoTheta || 0),
            intensity: Number(p.intensity || 0),
            size: Number(p.size || 0)
        })).filter((p: any) => Number.isFinite(p.twoTheta));
        const strongest = peaks.reduce((acc: any, cur: any) => (!acc || cur.intensity > acc.intensity ? cur : acc), null);
        const avgSize = peaks.length ? peaks.reduce((s: number, p: any) => s + (Number.isFinite(p.size) ? p.size : 0), 0) / peaks.length : 0;
        const chartData = (activeDataset?.rawPoints || [])
            .map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
            .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
        const matched = (activeDataset?.matchedPhases || []).map((p: any) => p.name).join('、');
        const contextualSummary = (contextualAnalysis as any)?.summary || (contextualAnalysis as any)?.coreFinding || '';
        const deepReport = buildXrdPostMatchDeepReport(postMatchAnalysis, matchRationale);
        let thumbnailUrl: string | undefined = undefined;
        if (chartSvgRef.current) {
            try {
                thumbnailUrl = await htmlToImage.toPng(chartSvgRef.current as unknown as HTMLElement, {
                    cacheBust: true,
                    pixelRatio: 2,
                    backgroundColor: '#f8fafc'
                });
            } catch {
                thumbnailUrl = undefined;
            }
        }
        const folder = buildArchiveFolderMeta(projects, projectId, milestoneId, logId);
        if (currentRecordId) {
            setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? { ...r, folder } : r));
        }
        const linkTitle = savedRecords.find(r => r.id === currentRecordId)?.title || `XRD Analysis ${new Date().toLocaleDateString()}`;

        // 构建 aiConclusion：GROUP 模式下优先使用多组综合分析
        let finalConclusion = contextualSummary || `XRD 分析已同步，匹配物相：${matched || '待进一步匹配'}`;
        if (logId.startsWith('GROUP:') && multiDatasetAnalysis) {
            const parts: string[] = [];
            if (multiDatasetAnalysis.comparativeSummary) parts.push(`【综合对比结论】\n${multiDatasetAnalysis.comparativeSummary}`);
            if (multiDatasetAnalysis.parameterEffects?.length) {
                parts.push(`【参数效应】\n${multiDatasetAnalysis.parameterEffects.map(pe => `• ${pe.parameter}（${pe.valueRange}）→ ${pe.observedEffect}（置信度：${pe.confidence}）`).join('\n')}`);
            }
            if (multiDatasetAnalysis.keyDifferences?.length) {
                const diffs = multiDatasetAnalysis.keyDifferences.map((d, i) => `${i + 1}. ${typeof d === 'string' ? d : (d as any)?.description || (d as any)?.text || (d as any)?.difference || JSON.stringify(d)}`);
                parts.push(`【关键差异】\n${diffs.join('\n')}`);
            }
            if (multiDatasetAnalysis.processingInsights?.length) {
                const insights = multiDatasetAnalysis.processingInsights.map(ins => `• ${typeof ins === 'string' ? ins : (ins as any)?.description || (ins as any)?.text || (ins as any)?.insight || JSON.stringify(ins)}`);
                parts.push(`【工艺洞察】\n${insights.join('\n')}`);
            }
            if (multiDatasetAnalysis.recommendations?.length) {
                const recs = multiDatasetAnalysis.recommendations.map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : (r as any)?.description || (r as any)?.text || (r as any)?.recommendation || JSON.stringify(r)}`);
                parts.push(`【下一步建议】\n${recs.join('\n')}`);
            }
            if (parts.length > 0) finalConclusion = parts.join('\n\n');
        }

        onSave(projectId, milestoneId, logId, {
            mode: 'XRD',
            aiConclusion: finalConclusion,
            chartData,
            peakCount: peaks.length,
            strongestPeak2Theta: strongest?.twoTheta || 0,
            strongestPeakIntensity: strongest?.intensity || 0,
            crystalliteSize: Number(avgSize.toFixed(2)),
            matchedPhaseCount: (activeDataset?.matchedPhases || []).length,
            rawReport: deepReport,
            aiDeepAnalysis: deepReport,
            thumbnailUrl,
            multiDatasetAnalysis: logId.startsWith('GROUP:') ? multiDatasetAnalysis : undefined,
            linkedAnalysisMeta: currentRecordId ? { id: currentRecordId, type: 'xrd', title: linkTitle } : undefined
        });
    };

    const handlePushToDataLab = () => {
        const chartData = (activeDataset?.rawPoints || [])
            .map((p: any) => ({ x: Number(p.x), y: Number(p.y) }))
            .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (chartData.length === 0) {
            showToast({ message: '当前暂无可推送的 XRD 图表数据', type: 'info' });
            return;
        }
        const xValues = chartData.map(p => p.x);
        const yValues = chartData.map(p => p.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const xDomain: [number, number] = minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX];
        const yDomain: [number, number] = minY === maxY ? [minY - 1, maxY + 1] : [minY, maxY];
        updateDataAnalysisSession({
            activeTab: 'chart',
            chartType: 'line',
            chartTitle: `${activeDataset?.name || 'XRD'} 原始衍射谱`,
            xAxisLabel: '2Theta (deg)',
            yAxisLabel: 'Intensity (a.u.)',
            xDomain,
            yDomain,
            seriesList: [{
                id: `xrd_push_${Date.now()}`,
                name: `${activeDataset?.name || 'XRD'} 原始谱线`,
                data: chartData.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                color: '#dc2626',
                pointColor: '#dc2626',
                strokeWidth: 2,
                pointShape: 'circle',
                pointSize: 4,
                visible: true
            }]
        });
        navigate('data');
        showToast({ message: '已推送到实验数据分析室，可直接继续美化', type: 'success' });
    };

    const activeDataset = useMemo(() => datasets[activeDatasetIndex] || null, [datasets, activeDatasetIndex]);

    const filteredRecords = useMemo(() =>
        savedRecords.filter(r => !selectedProjectId || !r.projectId || r.projectId === selectedProjectId),
        [savedRecords, selectedProjectId]);

    const renderedPaths = useMemo(() => {
        if (datasets.length === 0) return [];

        // 计算全局范围
        let globalMinX = Infinity;
        let globalMaxX = -Infinity;
        let globalMaxY = -Infinity;

        datasets.forEach(ds => {
            ds.rawPoints.forEach(p => {
                if (p.x < globalMinX) globalMinX = p.x;
                if (p.x > globalMaxX) globalMaxX = p.x;
                if (p.y > globalMaxY) globalMaxY = p.y;
            });
        });

        // Ensure a minimum range for X and Y to avoid division by zero or very small numbers
        const rangeX = (globalMaxX - globalMinX) || 1;
        const baseMaxY = globalMaxY || 1;

        return datasets.map((ds, dsIdx) => {
            const offset = waterfallMode ? (datasets.length - 1 - dsIdx) * waterfallGap : 0;
            const path = ds.rawPoints.map((p, i) => {
                const x = ((p.x - globalMinX) / rangeX) * 1000;
                // 将峰值高度缩放并向上漂移
                const y = (400 - offset) - (p.y / baseMaxY) * 200;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');

            return {
                id: ds.id,
                path,
                color: ds.color,
                name: ds.name,
                peaks: ds.peaks.map((p: any) => ({
                    ...p,
                    x: ((parseFloat(p.twoTheta) - globalMinX) / rangeX) * 1000,
                    y: (400 - offset) - (parseFloat(p.intensity) / 100) * 200
                }))
            };
        });
    }, [datasets, waterfallMode, waterfallGap]);

    const axisDomain = useMemo(() => {
        if (datasets.length === 0) return { minX: 20, maxX: 80, maxY: 100 };
        let minX = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        datasets.forEach(ds => {
            ds.rawPoints.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            });
        });
        if (!isFinite(minX) || !isFinite(maxX) || minX === maxX) {
            return { minX: 20, maxX: 80, maxY: Math.max(1, maxY || 100) };
        }
        return { minX, maxX, maxY: Math.max(1, maxY || 100) };
    }, [datasets]);

    // 防重叠标签布局：预先计算每张卡片标签的最终 {x, y}
    const labelPositions = useMemo(() => {
        const result = new Map<string, { x: number; y: number; anchor: 'middle' | 'end' | 'start' }>();
        if (allVisibleReferenceCards.length === 0) return result;

        const expPeakAngles = (activeDataset?.peaks || []).map((ep: any) => parseFloat(ep.twoTheta) || 0);
        const MATCH_TOL = 0.5;
        const rangeX = (axisDomain.maxX - axisDomain.minX) || 1;

        // 1. 收集每张卡片的锚点峰信息
        const entries: Array<{ cardId: string; name: string; x: number; baseY: number }> = [];
        allVisibleReferenceCards.forEach((card: any) => {
            const visiblePeaks = (card.peaks || []).filter((p: any) => {
                const px = ((p.twoTheta - axisDomain.minX) / rangeX) * 1000;
                return px >= 0 && px <= 1000;
            });
            const labelPeak = showOnlyMatchedSticks
                ? visiblePeaks
                    .filter((p: any) => expPeakAngles.some(ea => Math.abs(ea - p.twoTheta) <= MATCH_TOL))
                    .reduce((mx: any, p: any) => (!mx || p.intensity > mx.intensity) ? p : mx, null)
                : visiblePeaks.reduce((mx: any, p: any) => (!mx || p.intensity > mx.intensity) ? p : mx, null);
            if (!labelPeak) return;
            const x = ((labelPeak.twoTheta - axisDomain.minX) / rangeX) * 1000;
            const baseY = 440 - (labelPeak.intensity / 100) * 80 - 6;
            const shortName = card.name.split('(')[0].trim() || card.name;
            entries.push({ cardId: card.id, name: shortName, x, baseY });
        });

        // 2. 按 X 位置排序
        entries.sort((a, b) => a.x - b.x);

        // 3. 碰撞检测：X 距离过近且 Y 接近时，向上错开一行
        const placed: Array<{ x: number; y: number }> = [];
        const LINE_H = 14;  // 行高(px)
        const CHAR_W = 6.5; // 估算单字符宽度(px)
        const MIN_Y = 14;   // 标签最高不超过 SVG 顶部 14px

        entries.forEach(entry => {
            let y = entry.baseY;
            const halfW = (entry.name.length * CHAR_W) / 2 + 6;

            for (let iter = 0; iter < 12; iter++) {
                if (y <= MIN_Y) break;  // 已经到顶，不再上移
                const collides = placed.some(p => {
                    const xClose = Math.abs(p.x - entry.x) < halfW + 4;
                    const yClose = Math.abs(p.y - y) < LINE_H;
                    return xClose && yClose;
                });
                if (!collides) break;
                y -= LINE_H;
            }
            y = Math.max(MIN_Y, y); // 保证不超出 viewBox 顶部

            // 靠近右侧/左侧边界时改变文字对齐方向，防止文字溢出
            const anchor = entry.x > 940 ? 'end' as const : entry.x < 60 ? 'start' as const : 'middle' as const;
            placed.push({ x: entry.x, y });
            result.set(entry.cardId, { x: entry.x, y, anchor });
        });

        return result;
    }, [allVisibleReferenceCards, showOnlyMatchedSticks, axisDomain, activeDataset?.peaks]);

    const xTicks = useMemo(() => {
        const tickCount = 7;
        const { minX, maxX } = axisDomain;
        const step = (maxX - minX) / (tickCount - 1);
        return Array.from({ length: tickCount }, (_, i) => {
            const value = minX + i * step;
            const x = ((value - minX) / (maxX - minX || 1)) * 1000;
            return { value, x };
        });
    }, [axisDomain]);


    return (
        <div className="h-full flex flex-col p-6 gap-6 animate-reveal overflow-hidden relative">
            {/* ── 顶栏工具条 ── */}
            <div className="flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {traceRecordId && (
                        <button onClick={onBack} className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-2">
                            <i className="fa-solid fa-arrow-left"></i> 返回
                        </button>
                    )}
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">XRD 物相分析</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">X-Ray Diffraction Phase Identification & Peak Fitting</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 数据操作组 */}
                    <button
                        onClick={() => {
                            const demo = generateXrdDemoData();
                            setDatasets(demo);
                            setActiveDatasetIndex(0);
                            setCurrentRecordId(null);
                            setLastPeakStats(null);

                            // ═══ 自动执行全流程演示 ═══
                            try {
                                const ds = demo[0];
                                const xArr = ds.rawPoints.map(p => p.x);
                                const yArr = ds.rawPoints.map(p => p.y);

                                // 找到峰索引
                                const peakIndices = ds.peaks.map((p: any) => {
                                    const theta = parseFloat(p.twoTheta);
                                    let bestIdx = 0;
                                    let bestDiff = Infinity;
                                    xArr.forEach((x, i) => {
                                        const diff = Math.abs(x - theta);
                                        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
                                    });
                                    return bestIdx;
                                });

                                // Pseudo-Voigt 拟合
                                const fitResults = fitAllPeaks(xArr, yArr, peakIndices);
                                setPeakFitResults(fitResults);

                                // W-H 分析
                                const whData = fitResults
                                    .filter(f => f.converged && f.fwhm > 0)
                                    .map(f => ({ twoTheta: f.x0, fwhm: f.fwhm }));
                                if (whData.length >= 3) {
                                    setWhResult(williamsonHall(whData));
                                }

                                // 开启全部可视化层
                                setShowFitCurves(true);
                                setShowResidual(true);
                                setDiffSpectrumPair([0, 1]);
                                setWaterfallMode(true);
                            } catch (e) {
                                // 即使自动分析失败也不影响数据加载
                                console.warn('Demo auto-analysis error:', e);
                            }

                            showToast({ message: '🔬 全功能演示已加载：拟合曲线 + 残差图 + 差谱 + W-H 散点图', type: 'success' });
                        }}
                        className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-flask-vial mr-1"></i> 加载示例
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 记录管理组 */}
                    <div className="relative">
                        <div className="flex items-stretch">
                            <button
                                onClick={handleQuickSave}
                                disabled={datasets.length === 0}
                                className="px-4 py-2 bg-white border border-r-0 border-slate-200 text-slate-600 rounded-l-xl text-[10px] font-black uppercase hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-40"
                            >
                                <i className="fa-solid fa-floppy-disk mr-1"></i> 保存
                            </button>
                            <button
                                onClick={() => setShowSaveDropdown(!showSaveDropdown)}
                                disabled={datasets.length === 0}
                                className="px-1.5 py-2 bg-white border border-slate-200 text-slate-400 rounded-r-xl text-[10px] hover:text-indigo-600 hover:border-indigo-400 transition-all active:scale-95 disabled:opacity-40"
                            >
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
                    <button
                        onClick={() => setShowLibrary(true)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-box-archive mr-1"></i> 方案库
                    </button>
                    <button
                        onClick={handlePushToDataLab}
                        disabled={(activeDataset?.peaks || []).length === 0}
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

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 清空 */}
                    <button
                        onClick={handleClearWorkspace}
                        disabled={datasets.length === 0}
                        className="px-4 py-2 bg-white border border-slate-200 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-40"
                        title="清空工作间"
                    >
                        <i className="fa-solid fa-trash-can mr-1"></i> 清空
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
                {/* ── 左侧面板 ── */}
                <div className="col-span-12 lg:col-span-3 no-print min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                    <div className="flex flex-col gap-3">
                        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm shrink-0">
                            <button
                                onClick={handleExportPDF}
                                disabled={datasets.length === 0}
                                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 disabled:opacity-40 transition-all active:scale-95"
                            >
                                导出报告 (.PDF)
                            </button>
                        </div>

                        {/* ═══ 区块①：数据集管理 ═══ */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => setDatasetSectionExpanded(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">① 数据集管理</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer"
                                    >
                                        <i className="fa-solid fa-upload mr-1"></i>导入数据
                                    </span>
                                    <i className={`fa-solid fa-chevron-${datasetSectionExpanded ? 'up' : 'down'} text-slate-400 text-[9px]`}></i>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.csv,.xy" multiple onChange={handleFileUpload} />
                            </button>
                            {datasetSectionExpanded && (
                                <div className="p-3 flex flex-col gap-3">
                                    {/* Waterfall 开关 */}
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[9px] font-bold text-slate-500">瀑布叠加模式</span>
                                        <button
                                            onClick={() => setWaterfallMode(!waterfallMode)}
                                            className={`w-9 h-5 rounded-full transition-all relative ${waterfallMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${waterfallMode ? 'left-5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    {waterfallMode && (
                                        <div className="px-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">间距</span>
                                                <span className="text-[8px] font-bold text-indigo-600 font-mono">{waterfallGap}px</span>
                                            </div>
                                            <input type="range" min="0" max="150" value={waterfallGap}
                                                onChange={(e) => setWaterfallGap(parseInt(e.target.value))}
                                                className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    )}
                                    {/* 数据集列表 */}
                                    {datasets.length > 0 ? (
                                        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto custom-scrollbar">
                                            {datasets.map((ds, idx) => (
                                                <div
                                                    key={ds.id}
                                                    onClick={() => { setActiveDatasetIndex(idx); setContextualAnalysis(null); }}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all ${activeDatasetIndex === idx ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                                                >
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ds.color }} />
                                                    <span className="flex-1 text-[9px] font-bold text-slate-700 truncate">{ds.name}</span>
                                                    {ds.matchedPhases.length > 0 && (
                                                        <span className="text-[7px] font-black text-indigo-500 shrink-0">{ds.matchedPhases[0].name.split(' ')[0]}</span>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setLinkDatasetModalIdx(idx); }}
                                                        className={`shrink-0 w-5 h-5 rounded-lg flex items-center justify-center transition-all ${ds.linkedLogId ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-500'}`}
                                                        title={ds.linkedLogId ? `已关联: ${ds.linkedLogTitle}` : '关联实验记录'}
                                                    >
                                                        <i className={`fa-solid ${ds.linkedLogId ? 'fa-link' : 'fa-link-slash'} text-[7px]`}></i>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-4 text-center text-slate-300 text-[9px] font-bold">
                                            <i className="fa-solid fa-wave-square text-2xl mb-2 block"></i>
                                            暂无数据集，请导入或加载示例
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ═══ 区块②：数据处理 ═══ */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <button
                                onClick={() => setPreprocessSectionExpanded(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">② 数据处理</span>
                                </div>
                                <i className={`fa-solid fa-chevron-${preprocessSectionExpanded ? 'up' : 'down'} text-slate-400 text-[9px]`}></i>
                            </button>
                            {preprocessSectionExpanded && (
                                <div className="p-3 flex flex-col gap-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={handleSmooth} disabled={!activeDataset}
                                            className="py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100 disabled:opacity-50">
                                            <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>平滑除噪
                                        </button>
                                        <button onClick={handleRemoveBaseline} disabled={!activeDataset}
                                            className="py-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-100 disabled:opacity-50">
                                            <i className="fa-solid fa-eraser mr-1"></i>背景扣除
                                        </button>
                                        <button onClick={handleNormalize} disabled={!activeDataset}
                                            className="py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-100 disabled:opacity-50">
                                            <i className="fa-solid fa-arrows-up-down mr-1"></i>归一化
                                        </button>
                                        <button onClick={handleResetData} disabled={!activeDataset || !activeDataset.originalPoints}
                                            className="py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 disabled:opacity-50">
                                            <i className="fa-solid fa-rotate-left mr-1"></i>重置数据
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleBatchPreprocess}
                                        disabled={datasets.length === 0}
                                        className="w-full py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 disabled:opacity-50 transition-all"
                                    >
                                        <i className="fa-solid fa-bolt mr-1"></i>一键处理全部数据
                                    </button>
                                    {/* 寻峰操作区 */}
                                    <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                                        <button
                                            onClick={handleAutoIndex}
                                            disabled={datasets.length === 0}
                                            className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            <i className="fa-solid fa-magnifying-glass-chart mr-1.5"></i>智能寻峰鉴别
                                        </button>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                                            <button
                                                onClick={() => setPeakSettings(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                                                className="w-full flex items-center justify-between text-[8px] font-black text-slate-600 uppercase px-1"
                                            >
                                                <span><i className="fa-solid fa-paperclip mr-1"></i>智能寻峰附件（XRD）</span>
                                                <i className={`fa-solid fa-chevron-${peakSettings.showAdvanced ? 'up' : 'down'}`}></i>
                                            </button>
                                            {peakSettings.showAdvanced && (
                                                <div className="mt-2 space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <select value={peakSettings.mode}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, mode: e.target.value as PeakDetectSettings['mode'] }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none">
                                                            <option value="balanced">平衡模式</option>
                                                            <option value="recall">漏峰优先</option>
                                                            <option value="precision">抑制伪峰</option>
                                                        </select>
                                                        <select value={peakSettings.maxPeaksMode}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, maxPeaksMode: e.target.value as 'auto' | 'fixed' }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none">
                                                            <option value="auto">峰数自适应</option>
                                                            <option value="fixed">峰数固定</option>
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <input type="number" step="1" min="1" max="20"
                                                            disabled={peakSettings.maxPeaksMode === 'auto'}
                                                            value={peakSettings.maxPeaks}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, maxPeaks: parseInt(e.target.value || '8', 10) || 8 }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none disabled:opacity-50" placeholder="固定峰数" />
                                                        <input type="number" step="1" min="1" max="5"
                                                            value={peakSettings.smoothingPasses}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, smoothingPasses: parseInt(e.target.value || '2', 10) || 2 }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none" placeholder="平滑次数" />
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        <input type="number" step="0.01" min="0.05" value={peakSettings.minPeakDistanceDeg}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, minPeakDistanceDeg: parseFloat(e.target.value || '0.22') || 0.22 }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none" placeholder="峰距°" />
                                                        <input type="number" step="0.1" min="0.2" value={peakSettings.minProminencePercent}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, minProminencePercent: parseFloat(e.target.value || '4.5') || 4.5 }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none" placeholder="突出%" />
                                                        <input type="number" step="0.01" min="0.02" value={peakSettings.minWidthDeg}
                                                            onChange={(e) => setPeakSettings(prev => ({ ...prev, minWidthDeg: parseFloat(e.target.value || '0.1') || 0.1 }))}
                                                            className="bg-white border border-slate-200 rounded-lg p-1.5 text-[8px] font-bold outline-none" placeholder="峰宽°" />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <button onClick={() => setPeakSettings({ ...DEFAULT_PEAK_SETTINGS, showAdvanced: true })}
                                                            className="py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[8px] font-black hover:bg-slate-200">
                                                            恢复默认
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (!activeDataset) {
                                                                    showToast({ message: '请先导入数据', type: 'warning' });
                                                                    return;
                                                                }
                                                                const result = autoTunePeakParams(activeDataset.rawPoints);
                                                                setPeakSettings(prev => ({
                                                                    ...prev,
                                                                    mode: result.config.mode || 'balanced',
                                                                    maxPeaksMode: 'auto',
                                                                    maxPeaks: 8,
                                                                    minPeakDistanceDeg: result.config.minPeakDistanceDeg ?? prev.minPeakDistanceDeg,
                                                                    minProminencePercent: result.config.minProminencePercent ?? prev.minProminencePercent,
                                                                    minWidthDeg: result.config.minWidthDeg ?? prev.minWidthDeg,
                                                                    smoothingPasses: result.config.smoothingPasses ?? prev.smoothingPasses,
                                                                    showAdvanced: true
                                                                }));
                                                                showToast({ message: `⚡ ${result.summary}`, type: 'success' });
                                                            }}
                                                            disabled={!activeDataset}
                                                            className="py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[8px] font-black hover:bg-amber-100 border border-amber-200 disabled:opacity-50 transition-all"
                                                        >
                                                            ⚡ 自动调参
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setManualPeakMode(v => !v)}
                                            disabled={datasets.length === 0}
                                            className={`w-full py-2 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${manualPeakMode ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'} disabled:opacity-50`}
                                        >
                                            <i className={`fa-solid ${manualPeakMode ? 'fa-crosshairs' : 'fa-hand-pointer'} mr-1`}></i>
                                            {manualPeakMode ? '点击图谱手动加峰' : '手动寻峰模式'}
                                        </button>
                                        {lastPeakStats && (
                                            <div className="px-1 text-[8px] font-bold text-slate-400 text-center">
                                                检出统计：候选 {lastPeakStats.candidateCount} → 去重 {lastPeakStats.mergedCount} → 最终 {lastPeakStats.finalCount} 个峰
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ═══ 区块③：参考物相库 ═══ */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm shrink-0">
                            <button
                                onClick={() => setWaterfallSectionExpanded(v => !v)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">③ 参考物相库</span>
                                    {activeReferenceGroups.length > 0 && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[7px] font-black">{activeReferenceGroups.length}</span>
                                    )}
                                </div>
                                <i className={`fa-solid fa-chevron-${waterfallSectionExpanded ? 'up' : 'down'} text-slate-400 text-[9px]`}></i>
                            </button>
                            {waterfallSectionExpanded && (
                                <div className="p-3 flex flex-col gap-2">
                                    <div className="relative">
                                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-[9px]"></i>
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAiSearch()}
                                            placeholder="AI 搜索物相 (如 TiO2, ZnO)..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-10 text-[9px] font-bold outline-none focus:border-amber-400 focus:bg-white transition-all"
                                        />
                                        <button
                                            onClick={() => handleAiSearch()}
                                            disabled={isSearching || !searchQuery.trim()}
                                            className="absolute right-2 top-1.5 w-6 h-6 flex items-center justify-center text-amber-500 hover:text-amber-700 disabled:opacity-30 rounded-lg hover:bg-amber-50"
                                        >
                                            {isSearching ? <i className="fa-solid fa-spinner fa-spin text-[9px]"></i> : <i className="fa-solid fa-wand-magic-sparkles text-[9px]"></i>}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between px-1 py-1">
                                        <span className="text-[9px] font-bold text-slate-500">在图谱覆盖 Stick 线</span>
                                        <button
                                            onClick={() => setShowSticks(!showSticks)}
                                            className={`w-9 h-5 rounded-full transition-all relative ${showSticks ? 'bg-amber-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showSticks ? 'left-5' : 'left-1'}`} />
                                        </button>
                                    </div>
                                    {showSticks && (
                                        <div className="flex items-center justify-between px-1 py-0.5">
                                            <span className="text-[9px] font-bold text-slate-400">仅显示匹配峰的线</span>
                                            <button
                                                onClick={() => setShowOnlyMatchedSticks(!showOnlyMatchedSticks)}
                                                className={`w-9 h-5 rounded-full transition-all relative ${showOnlyMatchedSticks ? 'bg-sky-500' : 'bg-slate-300'}`}
                                                title="开启后，只显示在实验检出峰 ±0.5° 内有匹配的卡片线条"
                                            >
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${showOnlyMatchedSticks ? 'left-5' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    )}
                                    {activeReferenceGroups.length > 0 ? (
                                        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2">
                                            {activeReferenceGroups.map((group) => (
                                                <div key={group.id} className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                                                    <div className="flex items-center gap-1.5 px-2.5 py-2 bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer" onClick={() => toggleGroupExpansion(group.id)}>
                                                        <i className={`fa-solid fa-chevron-${group.isExpanded ? 'down' : 'right'} text-slate-400 text-[7px]`}></i>
                                                        <i className="fa-solid fa-folder-open text-amber-500 text-[9px]"></i>
                                                        <span className="flex-1 text-[8px] font-black text-slate-700 truncate">{group.name}</span>
                                                        <span className="text-[7px] text-slate-400 font-bold">{group.phases.length}项</span>
                                                        <button onClick={(e) => { e.stopPropagation(); toggleGroupVisibility(group.id); }}
                                                            className={`text-[9px] ${group.visible ? 'text-amber-500' : 'text-slate-300'} hover:opacity-70`}>
                                                            <i className={`fa-solid ${group.visible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); removeGroup(group.id); }}
                                                            className="text-[9px] text-slate-300 hover:text-rose-500">
                                                            <i className="fa-solid fa-xmark"></i>
                                                        </button>
                                                    </div>
                                                    {group.isExpanded && (
                                                        <div className="p-1.5 flex flex-col gap-1 bg-white/70">
                                                            {group.phases.map((card: any) => (
                                                                <div key={card.id}
                                                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${card.visible ? 'bg-white border-slate-100 shadow-sm' : 'bg-transparent border-transparent opacity-40'}`}>
                                                                    <div className="w-1.5 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }}></div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1">
                                                                            <div className="text-[8px] font-black truncate flex-1">{card.name}</div>
                                                                            {card.source === 'COD' ? (
                                                                                <span className="shrink-0 text-[6px] font-black px-1 py-0.5 bg-emerald-100 text-emerald-600 rounded">COD</span>
                                                                            ) : card.source === 'AI' ? (
                                                                                <span className="shrink-0 text-[6px] font-black px-1 py-0.5 bg-amber-100 text-amber-600 rounded">AI</span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div className="text-[7px] text-slate-400 font-bold">{card.card}{card.crystalSystem ? ` · ${card.crystalSystem}` : ''}</div>
                                                                        {card.reference && <div className="text-[6px] text-slate-300 truncate" title={card.reference}>{card.reference}</div>}
                                                                    </div>
                                                                    <button onClick={() => togglePhaseVisibility(group.id, card.id)}
                                                                        className="text-slate-300 hover:text-amber-500">
                                                                        <i className={`fa-solid ${card.visible ? 'fa-eye' : 'fa-eye-slash'} text-[8px]`}></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-3 text-center text-slate-300 text-[8px] font-bold">
                                            <i className="fa-solid fa-database text-lg mb-1 block"></i>
                                            暂无参考卡片，请 AI 搜索添加
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ═══ 区块④：智能分析 ═══ */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm shrink-0">
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-violet-500 rounded-full"></div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">④ 智能分析</span>
                                </div>
                                <span className={`text-[7px] font-black px-2 py-0.5 rounded-full ${activeDataset?.linkedLogId ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {activeDataset?.linkedLogId ? `已关联: ${activeDataset.linkedLogTitle}` : '未关联'}
                                </span>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                                {!activeDataset?.linkedLogId && (
                                    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[8px] text-slate-500 font-bold">
                                        <i className="fa-solid fa-circle-info mr-1"></i>
                                        关联实验记录可获得更深入的解读（点击数据集旁 <i className="fa-solid fa-link text-[7px]"></i>）
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleContextualAnalysis}
                                        disabled={isContextAnalyzing || !activeDataset || !activeDataset?.peaks?.length}
                                        className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-violet-700 disabled:opacity-50 active:scale-95 transition-all"
                                    >
                                        {isContextAnalyzing ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-brain mr-1"></i>}
                                        AI 深度分析
                                    </button>
                                    <button
                                        onClick={handleAutoCompare}
                                        disabled={isAutoComparing || isContextAnalyzing || !activeDataset || !activeDataset?.peaks?.length}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 disabled:opacity-50 active:scale-95 transition-all"
                                    >
                                        {isAutoComparing ? (
                                            <><i className="fa-solid fa-spinner fa-spin mr-1"></i>对标中...</>
                                        ) : (
                                            <><i className="fa-solid fa-wand-magic-sparkles mr-1"></i>对标卡片</>
                                        )}
                                    </button>
                                </div>
                                {datasets.length >= 2 && (
                                    <div className="flex flex-col gap-1.5">
                                        <button
                                            onClick={handleMultiDatasetAnalysis}
                                            disabled={isMultiAnalyzing || datasets.filter(ds => ds.peaks?.length).length < 2}
                                            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            {isMultiAnalyzing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-layer-group"></i>}
                                            {isMultiAnalyzing ? '综合分析中...' : '多组综合分析（关联参数差异）'}
                                        </button>
                                        <div className="text-[7px] font-bold text-slate-400 text-center">
                                            <i className="fa-solid fa-link mr-0.5"></i>
                                            {datasets.filter(ds => ds.linkedLogId).length}/{datasets.length} 组已关联实验记录
                                        </div>
                                    </div>
                                )}
                                {!!contextualAnalysis?.suggestedPhaseQueries?.length && (
                                    <div className="flex flex-col gap-1.5 pt-1">
                                        <button
                                            onClick={() => setSuggestedQueriesExpanded(v => !v)}
                                            className="flex items-center justify-between px-1 hover:opacity-70 transition-opacity"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <i className={`fa-solid fa-chevron-${suggestedQueriesExpanded ? 'down' : 'right'} text-[8px] text-slate-400`}></i>
                                                <span className="text-[9px] font-black text-slate-400 uppercase">AI 推荐搜索词</span>
                                                <span className="px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full text-[8px] font-black">{contextualAnalysis.suggestedPhaseQueries.slice(0, 4).length}</span>
                                            </div>
                                        </button>
                                        {suggestedQueriesExpanded && (
                                            <>
                                                <div className="flex items-center justify-end px-1">
                                                    <button
                                                        onClick={() => {
                                                            const all = contextualAnalysis.suggestedPhaseQueries.slice(0, 4);
                                                            if (selectedPhaseQueries.size === all.length) {
                                                                setSelectedPhaseQueries(new Set());
                                                            } else {
                                                                setSelectedPhaseQueries(new Set(all));
                                                            }
                                                        }}
                                                        className="text-[9px] font-bold text-violet-500 hover:text-violet-700 transition-colors"
                                                    >
                                                        {selectedPhaseQueries.size === contextualAnalysis.suggestedPhaseQueries.slice(0, 4).length ? '取消全选' : '全选'}
                                                    </button>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    {contextualAnalysis.suggestedPhaseQueries.slice(0, 4).map((q, i) => (
                                                        <div key={`${q}-${i}`} className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedPhaseQueries(prev => {
                                                                        const next = new Set(prev);
                                                                        if (next.has(q)) next.delete(q); else next.add(q);
                                                                        return next;
                                                                    });
                                                                }}
                                                                className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${selectedPhaseQueries.has(q)
                                                                    ? 'bg-violet-500 border-violet-500 text-white'
                                                                    : 'border-slate-300 hover:border-violet-400'
                                                                    }`}
                                                            >
                                                                {selectedPhaseQueries.has(q) && <i className="fa-solid fa-check text-[7px]"></i>}
                                                            </button>
                                                            <button
                                                                onClick={() => handleAiSearch(q)}
                                                                disabled={isSearching || isBatchSearching}
                                                                className="flex-1 px-2.5 py-2 bg-violet-50 text-violet-700 rounded-lg text-[10px] font-black hover:bg-violet-100 border border-violet-100 active:scale-95 transition-all text-left disabled:opacity-50"
                                                            >
                                                                <i className="fa-solid fa-plus text-[8px] mr-1"></i>{q}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* 批量操作按钮 */}
                                                <div className="flex gap-1.5 pt-0.5">
                                                    <button
                                                        onClick={() => handleBatchPhaseSearch(Array.from(selectedPhaseQueries))}
                                                        disabled={selectedPhaseQueries.size === 0 || isSearching || isBatchSearching}
                                                        className="flex-1 py-2 bg-violet-100 text-violet-700 rounded-lg text-[9px] font-black hover:bg-violet-200 border border-violet-200 active:scale-95 transition-all disabled:opacity-40"
                                                    >
                                                        {isBatchSearching
                                                            ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>{batchSearchProgress.current}/{batchSearchProgress.total}</>
                                                            : <><i className="fa-solid fa-magnifying-glass mr-0.5"></i>搜索选中 ({selectedPhaseQueries.size})</>
                                                        }
                                                    </button>
                                                    <button
                                                        onClick={() => handleBatchPhaseSearch(contextualAnalysis.suggestedPhaseQueries.slice(0, 4))}
                                                        disabled={isSearching || isBatchSearching}
                                                        className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-[9px] font-black hover:bg-violet-700 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                                                    >
                                                        {isBatchSearching
                                                            ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>{batchSearchProgress.currentQuery}</>
                                                            : <><i className="fa-solid fa-bolt mr-0.5"></i>一键全搜</>
                                                        }
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                {/* ═══ 基于匹配卡片的二次深度分析（AI分析完成后才显示） ═══ */}
                                {contextualAnalysis && (
                                    <div className="pt-1">
                                        <button
                                            onClick={handlePostMatchAnalysis}
                                            disabled={isPostMatchAnalyzing || !activeDataset || activeReferenceGroups.length === 0}
                                            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 active:scale-95 transition-all"
                                        >
                                            {isPostMatchAnalyzing ? <i className="fa-solid fa-spinner fa-spin mr-1.5"></i> : <i className="fa-solid fa-microscope mr-1.5"></i>}
                                            {isPostMatchAnalyzing ? '深度分析中...' : '基于匹配卡片 · 二次深度分析'}
                                        </button>
                                        {activeReferenceGroups.length === 0 && (
                                            <p className="text-[8px] text-slate-400 font-bold text-center mt-1"><i className="fa-solid fa-info-circle mr-1"></i>请先在 ③ 参考物相库 中匹配 PDF 卡片</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── 右侧：图谱 + 峰表 ── */}
                <div ref={reportAreaRef} className="col-span-12 lg:col-span-9 flex flex-col gap-4 overflow-y-auto custom-scrollbar is-printing-target">
                    {/* 图谱区 */}
                    <div className={`flex-shrink-0 rounded-[3rem] border-2 relative flex flex-col shadow-inner transition-all duration-700 ${traceRecordId ? 'border-amber-400 bg-amber-50/5' : 'bg-slate-50 border-slate-200'}`}>
                        {traceRecordId && (
                            <div className="absolute top-4 left-8 px-3 py-1 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg animate-pulse z-10">
                                <i className="fa-solid fa-link"></i> Trace Active
                            </div>
                        )}
                        <div className="relative mt-4 mx-4 mb-2">
                            {datasets.length > 0 ? (
                                <svg
                                    ref={chartSvgRef}
                                    className="w-full"
                                    viewBox="-80 -20 1100 510"
                                    preserveAspectRatio="xMidYMid meet"
                                    style={{ overflow: 'hidden', cursor: manualPeakMode ? 'crosshair' : 'default' }}
                                    onClick={(e) => {
                                        if (!manualPeakMode) return;
                                        const svg = e.currentTarget as SVGSVGElement;
                                        const point = svg.createSVGPoint();
                                        point.x = e.clientX;
                                        point.y = e.clientY;
                                        const ctm = svg.getScreenCTM();
                                        if (!ctm) return;
                                        const svgPoint = point.matrixTransform(ctm.inverse());
                                        // 数据绘图区对应 viewBox 的 x=0..1000，左侧(-80..0)是Y轴标签留白
                                        const xNorm = Math.max(0, Math.min(1, svgPoint.x / 1000));
                                        const theta = axisDomain.minX + xNorm * (axisDomain.maxX - axisDomain.minX);
                                        handleManualPick(theta);
                                    }}
                                >
                                    <line x1="0" y1="0" x2="0" y2="440" stroke="#94a3b8" strokeWidth="1.4" />
                                    <line x1="0" y1="440" x2="1000" y2="440" stroke="#94a3b8" strokeWidth="1.4" />
                                    {[0, 25, 50, 75, 100].map((v) => {
                                        const y = 400 - (v / 100) * 200;
                                        return (
                                            <g key={`y-${v}`}>
                                                <line x1="0" y1={y} x2="1000" y2={y} stroke="#e2e8f0" strokeWidth="0.7" strokeDasharray="4 4" />
                                                <line x1="0" y1={y} x2="-8" y2={y} stroke="#94a3b8" strokeWidth="1" />
                                                <text x="-14" y={y + 4} textAnchor="end" className="text-[11px] fill-slate-500 font-bold">{v}</text>
                                            </g>
                                        );
                                    })}
                                    {xTicks.map((tick, idx) => (
                                        <g key={`x-${idx}`}>
                                            <line x1={tick.x} y1="0" x2={tick.x} y2="440" stroke="#e2e8f0" strokeWidth="0.7" strokeDasharray="4 4" />
                                            <line x1={tick.x} y1="440" x2={tick.x} y2="448" stroke="#94a3b8" strokeWidth="1" />
                                            <text x={tick.x} y="468" textAnchor="middle" className="text-[11px] fill-slate-500 font-bold">{tick.value.toFixed(1)}</text>
                                        </g>
                                    ))}
                                    <text x="500" y="490" textAnchor="middle" className="text-[12px] font-black fill-slate-700">2θ (Degree)</text>
                                    <text x="-62" y="200" textAnchor="middle" transform="rotate(-90 -62 200)" className="text-[12px] font-black fill-slate-700">Relative Intensity (a.u.)</text>
                                    {showSticks && allVisibleReferenceCards.map((card, cIdx: number) => {
                                        const visiblePeaks = (card.peaks || []).filter((p: any) => {
                                            const x = ((p.twoTheta - axisDomain.minX) / (axisDomain.maxX - axisDomain.minX || 1)) * 1000;
                                            return x >= 0 && x <= 1000;
                                        });
                                        const expPeakAngles = (activeDataset?.peaks || []).map((ep: any) => parseFloat(ep.twoTheta) || 0);
                                        const MATCH_TOL = 0.5;
                                        const shortName = card.name.split('(')[0].trim() || card.name;
                                        const labelPos = labelPositions.get(card.id);

                                        return (
                                            <g key={card.id} className="reference-card-group">
                                                {visiblePeaks.map((p: any, pIdx: number) => {
                                                    const x = ((p.twoTheta - axisDomain.minX) / (axisDomain.maxX - axisDomain.minX || 1)) * 1000;
                                                    const isMatched = expPeakAngles.some(ea => Math.abs(ea - p.twoTheta) <= MATCH_TOL);
                                                    if (showOnlyMatchedSticks && !isMatched) return null;
                                                    return (
                                                        <line key={`${card.id}-peak-${pIdx}`}
                                                            x1={x} y1="440" x2={x} y2={440 - (p.intensity / 100) * 80}
                                                            stroke={card.color} strokeWidth="2.5" strokeLinecap="round"
                                                            opacity={isMatched ? 0.9 : 0.3} />
                                                    );
                                                })}
                                                {labelPos && (
                                                    <text x={labelPos.x} y={labelPos.y} textAnchor={labelPos.anchor}
                                                        className="text-[11px] font-black"
                                                        style={{ fill: card.color, textShadow: '0 0 4px white, 0 0 4px white, 0 0 4px white' }}>
                                                        {shortName}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}
                                    {renderedPaths.map((rp, idx: number) => (
                                        <g key={rp.id}>
                                            <path d={rp.path} fill="none" stroke={rp.color} strokeWidth="1.5" className="transition-all duration-500" />
                                            {idx === activeDatasetIndex && rp.peaks.map((p: any) => (
                                                <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
                                                    <line x1="0" y1="0" x2="0" y2={440 - p.y} stroke={rp.color} strokeWidth="0.5" strokeDasharray="2 1" opacity="0.4" />
                                                    {p.label && (
                                                        <text y="-5" textAnchor="middle" className="text-[14px] font-black italic fill-slate-800"
                                                            style={{ textShadow: '0 0 2px white' }}>
                                                            {p.label}
                                                        </text>
                                                    )}
                                                    {/* X 轴角度标注 */}
                                                    <line x1="0" y1={440 - p.y} x2="0" y2={448 - p.y} stroke={rp.color} strokeWidth="2" strokeLinecap="round" />
                                                    <text
                                                        x="0"
                                                        y={448 - p.y}
                                                        textAnchor="end"
                                                        transform={`rotate(-45, 0, ${448 - p.y})`}
                                                        style={{ fontSize: '10px', fontWeight: 800, fill: rp.color, textShadow: '0 0 3px white, 0 0 3px white' }}
                                                    >
                                                        {parseFloat(p.twoTheta).toFixed(2)}°
                                                    </text>
                                                </g>
                                            ))}
                                            <text x="990"
                                                y={renderedPaths[idx].peaks.length > 0 ? renderedPaths[idx].peaks[0].y + 10 : 380 - (waterfallMode ? (datasets.length - 1 - idx) * waterfallGap : 0)}
                                                textAnchor="end" className="text-[10px] font-black uppercase tracking-widest fill-slate-900">
                                                {rp.name}
                                            </text>
                                        </g>
                                    ))}

                                    {/* ═══ 拟合曲线叠加 (Pseudo-Voigt) ═══ */}
                                    {showFitCurves && peakFitResults.length > 0 && (() => {
                                        const rangeX = (axisDomain.maxX - axisDomain.minX) || 1;
                                        const maxY = axisDomain.maxY || 1;
                                        return peakFitResults.map((fit, fIdx) => {
                                            if (!fit.fittedCurve || fit.fittedCurve.length === 0) return null;
                                            const pathD = fit.fittedCurve.map((pt, i) => {
                                                const sx = ((pt.x - axisDomain.minX) / rangeX) * 1000;
                                                const sy = 400 - (pt.y / maxY) * 200;
                                                return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
                                            }).join(' ');
                                            return (
                                                <path key={`fit-${fIdx}`} d={pathD} fill="none" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="4 2" opacity="0.75" />
                                            );
                                        });
                                    })()}

                                    {/* ═══ 残差曲线 (Obs - Calc) ═══ */}
                                    {showResidual && residualData && residualData.length > 0 && (() => {
                                        const rangeX = (axisDomain.maxX - axisDomain.minX) || 1;
                                        // 残差画在 Y=440 下方（440~500 区域），映射残差范围到 ±30px
                                        const maxResAbs = Math.max(...residualData.map(d => Math.abs(d.residual)), 1);
                                        const baseY = 440;
                                        const resHeight = 50;
                                        const pathD = residualData.map((d, i) => {
                                            const sx = ((d.x - axisDomain.minX) / rangeX) * 1000;
                                            const sy = baseY + resHeight * 0.5 - (d.residual / maxResAbs) * resHeight * 0.45;
                                            return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
                                        }).join(' ');
                                        // 零线
                                        const zeroY = baseY + resHeight * 0.5;
                                        return (
                                            <g>
                                                <rect x="0" y={baseY + 2} width="1000" height={resHeight} fill="#fef2f2" opacity="0.3" rx="2" />
                                                <line x1="0" y1={zeroY} x2="1000" y2={zeroY} stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3 3" />
                                                <text x="5" y={baseY + 10} className="text-[7px] fill-rose-400 font-bold uppercase">Residual</text>
                                                <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="0.8" />
                                            </g>
                                        );
                                    })()}

                                    {/* ═══ 差谱曲线 (A - B) ═══ */}
                                    {diffSpectrumData && diffSpectrumData.length > 0 && (() => {
                                        const rangeX = (axisDomain.maxX - axisDomain.minX) || 1;
                                        const maxY = axisDomain.maxY || 1;
                                        // 差谱用虚线绘制在主谱区域
                                        const pathD = diffSpectrumData.map((pt, i) => {
                                            const sx = ((pt.x - axisDomain.minX) / rangeX) * 1000;
                                            const sy = 400 - (pt.y / maxY) * 200;
                                            return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
                                        }).join(' ');
                                        return (
                                            <g>
                                                <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="1.3" strokeDasharray="6 3" opacity="0.8" />
                                                <text x="50" y="25" className="text-[9px] fill-amber-600 font-black uppercase">Diff: {datasets[diffSpectrumPair?.[0] || 0]?.name} − {datasets[diffSpectrumPair?.[1] || 1]?.name}</text>
                                            </g>
                                        );
                                    })()}

                                </svg>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 opacity-40">
                                    <i className="fa-solid fa-wave-square text-6xl mb-4"></i>
                                    <p className="text-[10px] font-black uppercase tracking-[0.4rem]">等待衍射数据载入</p>
                                </div>
                            )}
                        </div>

                        {/* ═══ 可视化层切换按钮栏 ═══ */}
                        {datasets.length > 0 && (
                            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider mr-1">可视化</span>
                                <button
                                    onClick={() => setShowFitCurves(v => !v)}
                                    disabled={peakFitResults.length === 0}
                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-bold border transition-all ${showFitCurves ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-200'} disabled:opacity-30`}
                                >
                                    <i className="fa-solid fa-wave-square mr-0.5 text-[7px]"></i> 拟合曲线
                                </button>
                                <button
                                    onClick={() => setShowResidual(v => !v)}
                                    disabled={peakFitResults.length === 0}
                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-bold border transition-all ${showResidual ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-50 text-slate-400 border-slate-200'} disabled:opacity-30`}
                                >
                                    <i className="fa-solid fa-chart-area mr-0.5 text-[7px]"></i> 残差图
                                </button>
                                {datasets.length >= 2 && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setDiffSpectrumPair(v => v ? null : [0, 1])}
                                            className={`px-2.5 py-1 rounded-lg text-[8px] font-bold border transition-all ${diffSpectrumPair ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                                        >
                                            <i className="fa-solid fa-minus mr-0.5 text-[7px]"></i> 差谱
                                        </button>
                                        {diffSpectrumPair && (
                                            <>
                                                <select
                                                    value={diffSpectrumPair[0]}
                                                    onChange={e => setDiffSpectrumPair([parseInt(e.target.value), diffSpectrumPair[1]])}
                                                    className="bg-slate-50 border border-slate-200 rounded text-[7px] font-bold px-1 py-0.5"
                                                >
                                                    {datasets.map((ds, i) => <option key={i} value={i}>{ds.name}</option>)}
                                                </select>
                                                <span className="text-[7px] text-slate-400">&minus;</span>
                                                <select
                                                    value={diffSpectrumPair[1]}
                                                    onChange={e => setDiffSpectrumPair([diffSpectrumPair[0], parseInt(e.target.value)])}
                                                    className="bg-slate-50 border border-slate-200 rounded text-[7px] font-bold px-1 py-0.5"
                                                >
                                                    {datasets.map((ds, i) => <option key={i} value={i}>{ds.name}</option>)}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ W-H 散点图 ═══ */}
                        {whResult && whResult.isValid && whResult.plotPoints.length >= 3 && (
                            <div className="px-4 pb-3">
                                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <h6 className="text-[8px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                            <i className="fa-solid fa-chart-line text-teal-500"></i> Williamson-Hall Plot
                                        </h6>
                                        <div className="flex items-center gap-3 text-[8px] font-bold">
                                            <span className="text-teal-600">D = {whResult.grainSize.toFixed(1)} nm</span>
                                            <span className="text-violet-600">ε = {(whResult.strain * 100).toFixed(3)}%</span>
                                            <span className="text-slate-400">R² = {whResult.R2.toFixed(3)}</span>
                                        </div>
                                    </div>
                                    <svg viewBox="0 0 300 150" className="w-full" style={{ maxHeight: 120 }}>
                                        {/* 坐标域 */}
                                        {(() => {
                                            const pts = whResult.plotPoints;
                                            const xVals = pts.map(p => p.fourSinTheta);
                                            const yVals = pts.map(p => p.betaCosTheta);
                                            const xMin = Math.min(...xVals) * 0.9;
                                            const xMax = Math.max(...xVals) * 1.1;
                                            const yMin = Math.min(...yVals, whResult.fitLine.intercept) * 0.8;
                                            const yMax = Math.max(...yVals) * 1.2;
                                            const xRange = (xMax - xMin) || 1;
                                            const yRange = (yMax - yMin) || 1;
                                            const toSVG = (x: number, y: number) => ({
                                                sx: 30 + ((x - xMin) / xRange) * 250,
                                                sy: 135 - ((y - yMin) / yRange) * 120,
                                            });

                                            // 拟合线
                                            const lineStart = toSVG(xMin, whResult.fitLine.slope * xMin + whResult.fitLine.intercept);
                                            const lineEnd = toSVG(xMax, whResult.fitLine.slope * xMax + whResult.fitLine.intercept);

                                            return (
                                                <g>
                                                    {/* 坐标轴 */}
                                                    <line x1="30" y1="135" x2="280" y2="135" stroke="#94a3b8" strokeWidth="0.8" />
                                                    <line x1="30" y1="15" x2="30" y2="135" stroke="#94a3b8" strokeWidth="0.8" />
                                                    <text x="155" y="148" textAnchor="middle" className="text-[7px] fill-slate-500 font-bold">4·sin(θ)</text>
                                                    <text x="8" y="75" textAnchor="middle" transform="rotate(-90 8 75)" className="text-[7px] fill-slate-500 font-bold">β·cos(θ)</text>

                                                    {/* 拟合线 */}
                                                    <line x1={lineStart.sx} y1={lineStart.sy} x2={lineEnd.sx} y2={lineEnd.sy}
                                                        stroke="#0d9488" strokeWidth="1.2" strokeDasharray="4 2" />

                                                    {/* 数据点 */}
                                                    {pts.map((p, i) => {
                                                        const { sx, sy } = toSVG(p.fourSinTheta, p.betaCosTheta);
                                                        return (
                                                            <g key={`wh-${i}`}>
                                                                <circle cx={sx} cy={sy} r="3.5" fill="#6366f1" stroke="white" strokeWidth="1" />
                                                                <text x={sx + 5} y={sy - 4} className="text-[6px] fill-slate-500 font-bold">{p.twoTheta.toFixed(1)}°</text>
                                                            </g>
                                                        );
                                                    })}
                                                </g>
                                            );
                                        })()}
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 峰表区 */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm relative flex flex-col">
                        <button
                            onClick={() => setPeakTableExpanded(v => !v)}
                            className="w-full bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between border-b border-slate-800"
                        >
                            <div className="grid grid-cols-5 w-full text-left">
                                <span className="text-[9px] font-black uppercase">峰序 #</span>
                                <span className="text-[9px] font-black uppercase">2θ (Deg)</span>
                                <span className="text-[9px] font-black uppercase">d (nm)</span>
                                <span className="text-[9px] font-black uppercase">Size (nm)</span>
                                <span className="text-[9px] font-black uppercase text-right pr-8">特征标记</span>
                            </div>
                            <i className={`fa-solid fa-chevron-${peakTableExpanded ? 'up' : 'down'} text-[10px] ml-2 shrink-0`}></i>
                        </button>
                        {peakTableExpanded && (
                            <div className="overflow-auto">
                                {(activeDataset?.peaks || []).map(p => (
                                    <div key={p.id} className="grid grid-cols-5 w-full items-center px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <span className="font-black text-indigo-600 text-[11px] italic">{p.id}</span>
                                        <span className="font-bold text-slate-700 text-[12px]">{p.twoTheta}</span>
                                        <span className="font-bold text-emerald-600 font-mono text-[12px]">{p.d}</span>
                                        <span className="font-bold text-rose-500 font-mono text-[12px]">{p.size}</span>
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => handleRemovePeak(p.id)}
                                                className="w-6 h-6 rounded-md bg-rose-50 text-rose-500 hover:bg-rose-100" title="删除峰">
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                            <input value={p.label || ''}
                                                onChange={(e) => {
                                                    const newLabel = e.target.value;
                                                    setDatasets(prev => prev.map((ds, idx) => {
                                                        if (idx !== activeDatasetIndex) return ds;
                                                        return { ...ds, peaks: ds.peaks.map(pk => pk.id === p.id ? { ...pk, label: newLabel } : pk) };
                                                    }));
                                                }}
                                                className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[8px] font-black uppercase text-center focus:border-indigo-400 outline-none w-20"
                                                placeholder="HKL index" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {contextualAnalysis && (
                            <div className="border-t border-slate-100 p-2 bg-violet-50/20">
                                <button
                                    onClick={() => setContextOpen(v => !v)}
                                    className="w-full h-11 flex items-center justify-between text-left px-3 rounded-lg border border-violet-200 bg-white hover:bg-violet-50/40 transition-all"
                                >
                                    <div className="flex items-center gap-2">
                                        <h5 className="text-[12px] font-black uppercase tracking-wide text-violet-700 leading-none">上下文 XRD 分析结论</h5>
                                        {!!contextualAnalysis.suggestedPhaseQueries?.length && (
                                            <span className="text-[10px] font-bold text-violet-500 leading-none">{contextualAnalysis.suggestedPhaseQueries.length} 个卡片建议词</span>
                                        )}
                                    </div>
                                    <i className={`fa-solid fa-chevron-${contextOpen ? 'up' : 'down'} text-violet-400 text-[10px]`}></i>
                                </button>
                                {contextOpen && (
                                    <div className="mt-2.5 space-y-3 px-1.5">
                                        <p className="text-[13px] font-medium text-slate-700 leading-relaxed">{contextualAnalysis.summary}</p>
                                        {!!contextualAnalysis.cardAdjustmentAdvice?.length && (
                                            <div className="space-y-2">
                                                {contextualAnalysis.cardAdjustmentAdvice.slice(0, 4).map((it, idx) => (
                                                    <div key={`${it}-${idx}`} className="p-2.5 bg-white border border-violet-100 rounded-xl text-[12px] font-bold text-slate-600 leading-relaxed">{it}</div>
                                                ))}
                                            </div>
                                        )}
                                        {!!contextualAnalysis.nextActions?.length && (
                                            <div className="flex flex-wrap gap-2">
                                                {contextualAnalysis.nextActions.slice(0, 3).map((it, idx) => (
                                                    <span key={`${it}-${idx}`} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black">{it}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ 异常峰检测 ═══ */}
                        {!!contextualAnalysis?.anomalousPeaks?.length && (
                            <div className="border-t border-rose-200 p-1.5 bg-rose-50/20">
                                <button
                                    onClick={() => setAnomalyOpen(v => !v)}
                                    className="w-full h-10 flex items-center justify-between text-left px-2.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50/40 transition-all"
                                >
                                    <h5 className="text-[10px] font-black uppercase tracking-wide text-rose-700 flex items-center gap-1.5 leading-none">
                                        <i className="fa-solid fa-triangle-exclamation text-rose-500"></i> 异常峰检测
                                        <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-[8px] font-black">
                                            {contextualAnalysis.anomalousPeaks.length} 个可疑峰
                                        </span>
                                    </h5>
                                    <i className={`fa-solid fa-chevron-${anomalyOpen ? 'up' : 'down'} text-rose-400 text-[8px]`}></i>
                                </button>
                                {anomalyOpen && (
                                    <div className="mt-2 space-y-1.5 px-1">
                                        {contextualAnalysis.anomalousPeaks.map((ap, idx) => (
                                            <div key={`anomaly-${idx}`} className="p-2.5 bg-white border border-rose-100 rounded-xl flex items-start gap-2">
                                                <div className="shrink-0 w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
                                                    <span className="text-[9px] font-black text-rose-600">{ap.twoTheta.toFixed(1)}°</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[9px] font-black text-rose-700 mb-0.5">
                                                        {ap.diagnosis === 'possibly_contamination' ? '可能污染峰' :
                                                            ap.diagnosis === 'detector_artifact' ? '探测器伪峰' :
                                                                ap.diagnosis === 'unknown_phase' ? '未知物相' :
                                                                    ap.diagnosis}
                                                    </div>
                                                    <div className="text-[8px] text-slate-600 leading-relaxed">{ap.explanation}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ 发表级图注 ═══ */}
                        <div className="border-t border-slate-100 p-2 no-print bg-slate-50/20">
                            <button
                                onClick={() => setCaptionOpen(v => !v)}
                                className="w-full h-11 flex items-center justify-between text-left px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all"
                            >
                                <h5 className="text-[12px] font-black uppercase tracking-wide text-slate-700 flex items-center gap-1.5 leading-none">
                                    <i className="fa-solid fa-quote-left text-slate-500"></i> 图注与追踪操作
                                </h5>
                                <i className={`fa-solid fa-chevron-${captionOpen ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
                            </button>
                            {captionOpen && (
                                <div className="mt-2 space-y-2 px-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={handleGenerateCaption}
                                            disabled={isGeneratingCaption || !activeDataset?.peaks?.length}
                                            className="px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-xl text-[9px] font-black uppercase shadow-sm hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
                                        >
                                            <i className={`fa-solid ${isGeneratingCaption ? 'fa-spinner fa-spin' : 'fa-quote-left'} text-[8px]`}></i>
                                            {isGeneratingCaption ? '生成中...' : '生成发表级图注'}
                                        </button>
                                        {datasets.length >= 2 && (
                                            <button
                                                onClick={handlePhaseEvolution}
                                                disabled={isEvolutionAnalyzing}
                                                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-[9px] font-black uppercase shadow-sm hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
                                            >
                                                <i className={`fa-solid ${isEvolutionAnalyzing ? 'fa-spinner fa-spin' : 'fa-timeline'} text-[8px]`}></i>
                                                {isEvolutionAnalyzing ? '分析中...' : '物相演变追踪'}
                                            </button>
                                        )}
                                    </div>
                                    {publicationCaption && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl relative group">
                                            <div className="text-[8px] font-black text-amber-700 uppercase mb-1 flex items-center gap-1">
                                                <i className="fa-solid fa-quote-left text-amber-400"></i> Figure Caption
                                            </div>
                                            <p className="text-[10px] text-slate-800 italic leading-relaxed font-serif">{publicationCaption}</p>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(publicationCaption); showToast({ message: '图注已复制到剪贴板', type: 'success' }); }}
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[7px] font-black uppercase hover:bg-amber-200 transition-all"
                                            >
                                                <i className="fa-solid fa-copy mr-0.5"></i> 复制
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ═══ 对标分析报告 ═══ */}
                        {matchRationale && matchRationale.length > 0 && (
                            <div className="border-t border-sky-200 p-2 bg-sky-50/20">
                                <button
                                    onClick={() => setMatchRationaleOpen(v => !v)}
                                    className="w-full h-11 flex items-center justify-between text-left px-3 rounded-lg border border-sky-200 bg-white hover:bg-sky-50/40 transition-all"
                                >
                                    <h5 className="text-[12px] font-black uppercase tracking-wide text-sky-700 leading-none flex items-center gap-2">
                                        <i className="fa-solid fa-chart-column text-sky-500"></i>
                                        对标分析报告
                                        <span className="text-[10px] font-bold text-sky-400 normal-case">({matchRationale.length} 组)</span>
                                    </h5>
                                    <i className={`fa-solid fa-chevron-${matchRationaleOpen ? 'up' : 'down'} text-[10px] text-sky-400`}></i>
                                </button>
                                {matchRationaleOpen && (
                                    <div className="space-y-2.5 px-3 pb-2.5">
                                        {matchRationale.map((mr, idx) => (
                                            <div key={`mr-${idx}`} className="bg-white border border-sky-100 rounded-xl p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[12px] font-black text-slate-800">{mr.groupName}</span>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${mr.matchRate >= 0.7 ? 'bg-emerald-100 text-emerald-700' : mr.matchRate >= 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {Math.round(mr.matchRate * 100)}% 匹配
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full mb-2 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${mr.matchRate >= 0.7 ? 'bg-emerald-500' : mr.matchRate >= 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                        style={{ width: `${Math.round(mr.matchRate * 100)}%` }}
                                                    />
                                                </div>
                                                <p className="text-[11px] font-bold text-slate-600 mb-2">{mr.verdict} · {mr.matchedCount}/{mr.totalRefPeaks} 参考峰匹配</p>
                                                {mr.matches.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                                        {mr.matches.slice(0, 8).map((m, mi) => (
                                                            <span key={`m-${mi}`} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px]">
                                                                <span className="font-black text-emerald-700">{m.expTheta.toFixed(2)}°</span>
                                                                <span className="text-slate-400">↔</span>
                                                                <span className="font-bold text-slate-600">{m.refTheta.toFixed(2)}°{m.hkl ? ` ${m.hkl}` : ''}</span>
                                                                <span className={`text-[8px] font-black ${m.delta > 0.2 ? 'text-amber-500' : 'text-emerald-500'}`}>Δ{m.delta.toFixed(2)}°</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {mr.unmatchedExp.length > 0 && (
                                                    <div className="text-[10px] text-slate-400">
                                                        <span className="font-bold">未归属实验峰：</span>
                                                        {mr.unmatchedExp.map((u, ui) => (
                                                            <span key={`u-${ui}`} className="ml-1 text-rose-400 font-bold">{u.twoTheta.toFixed(1)}°</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ 卡片匹配后深度分析结果 ═══ */}
                        {postMatchAnalysis && (
                            <div className="border-t border-indigo-200 p-2 bg-indigo-50/20">
                                <button
                                    onClick={() => setPostMatchOpen(v => !v)}
                                    className="w-full h-11 flex items-center justify-between text-left px-3 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50/40 transition-all"
                                >
                                    <h5 className="text-[12px] font-black uppercase tracking-wide text-indigo-700 leading-none flex items-center gap-2">
                                        <i className="fa-solid fa-microscope text-indigo-500"></i>
                                        卡片匹配深度分析
                                    </h5>
                                    <i className={`fa-solid fa-chevron-${postMatchOpen ? 'up' : 'down'} text-indigo-400 text-[10px]`}></i>
                                </button>
                                {postMatchOpen && (
                                    <div className="mt-2.5 space-y-3 px-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                                        {/* 匹配质量总评 */}
                                        <p className="text-[13px] font-medium text-slate-700 leading-relaxed">{postMatchAnalysis.matchSummary}</p>

                                        {/* 物相组成分析 */}
                                        {!!postMatchAnalysis.phaseComposition?.length && (
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1"><i className="fa-solid fa-chart-pie text-[9px]"></i>物相组成估算</div>
                                                {postMatchAnalysis.phaseComposition.map((pc: any, idx: number) => (
                                                    <div key={`pc-${idx}`} className="p-2.5 bg-white border border-indigo-100 rounded-xl flex items-center gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[12px] font-black text-slate-800">{pc.phaseName}</div>
                                                            <div className="text-[10px] text-slate-500 mt-0.5">{pc.evidence}</div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-[13px] font-black text-indigo-600">{pc.estimatedFraction}</div>
                                                            <div className="text-[9px] text-slate-400 font-bold">{localizePhaseConfidence(pc.confidence)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 峰位偏移分析 */}
                                        {!!postMatchAnalysis.peakShiftAnalysis?.length && (
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-black text-amber-600 uppercase flex items-center gap-1"><i className="fa-solid fa-arrows-left-right text-[9px]"></i>峰位偏移检测</div>
                                                {postMatchAnalysis.peakShiftAnalysis.map((ps: any, idx: number) => (
                                                    <div key={`ps-${idx}`} className="p-2 bg-amber-50 border border-amber-100 rounded-xl text-[11px]">
                                                        <span className="font-black text-amber-700">{formatFixed(ps.experimentalTheta, 2)}°</span>
                                                        <span className="text-slate-400 mx-1">vs</span>
                                                        <span className="font-bold text-slate-600">{formatFixed(ps.referenceTheta, 2)}° ({ps.referenceName})</span>
                                                        <span className={`ml-2 font-black ${Math.abs(Number(ps.shiftDeg) || 0) > 0.3 ? 'text-rose-600' : 'text-amber-600'}`}>Δ={(Number(ps.shiftDeg) || 0) > 0 ? '+' : ''}{formatFixed(ps.shiftDeg, 3)}°</span>
                                                        <div className="text-[10px] text-slate-500 mt-0.5">{ps.possibleCause}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 未归属峰 */}
                                        {!!postMatchAnalysis.unmatchedPeaks?.length && (
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-black text-rose-600 uppercase flex items-center gap-1"><i className="fa-solid fa-question-circle text-[9px]"></i>未归属实验峰</div>
                                                {postMatchAnalysis.unmatchedPeaks.map((up: any, idx: number) => (
                                                    <div key={`up-${idx}`} className="p-2 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                                                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-lg text-[11px] font-black shrink-0">{formatFixed(up.twoTheta, 2)}°</span>
                                                        <span className="text-[10px] text-slate-600 font-bold">I={up.intensity}</span>
                                                        <span className="text-[10px] text-slate-500 flex-1">{up.possibleOrigin}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 晶体学洞察 */}
                                        {!!postMatchAnalysis.crystallographicInsights?.length && (
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-black text-teal-600 uppercase flex items-center gap-1"><i className="fa-solid fa-gem text-[9px]"></i>晶体学洞察</div>
                                                {postMatchAnalysis.crystallographicInsights.map((ci: string, idx: number) => (
                                                    <div key={`ci-${idx}`} className="p-2.5 bg-teal-50 border border-teal-100 rounded-xl text-[11px] font-bold text-slate-700 leading-relaxed">{ci}</div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 合成评估 */}
                                        {postMatchAnalysis.synthesisAssessment && (
                                            <div className="p-3 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl">
                                                <div className="text-[10px] font-black text-indigo-600 uppercase mb-1.5 flex items-center gap-1"><i className="fa-solid fa-flask text-[9px]"></i>合成质量评估</div>
                                                <p className="text-[12px] font-medium text-slate-700 leading-relaxed">{postMatchAnalysis.synthesisAssessment}</p>
                                            </div>
                                        )}

                                        {/* 论文表述 */}
                                        {postMatchAnalysis.publicationSentence && (
                                            <div className="p-3 bg-slate-900 rounded-xl">
                                                <div className="text-[9px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1"><i className="fa-solid fa-pen-fancy text-[8px]"></i>Publication-ready</div>
                                                <p className="text-[12px] font-medium text-emerald-300 italic leading-relaxed">{postMatchAnalysis.publicationSentence}</p>
                                            </div>
                                        )}

                                        {/* 后续实验建议 */}
                                        {!!postMatchAnalysis.nextExperiments?.length && (
                                            <div className="flex flex-wrap gap-2">
                                                {postMatchAnalysis.nextExperiments.map((ne: string, idx: number) => (
                                                    <span key={`ne-${idx}`} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black border border-emerald-100">{ne}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ 多组综合比较分析结果（可折叠） ═══ */}
                        {multiDatasetAnalysis && (
                            <div className="border-t border-cyan-200 p-1.5 bg-cyan-50/20">
                                <button
                                    onClick={() => setMultiAnalysisOpen(v => !v)}
                                    className="w-full h-10 px-2.5 flex items-center justify-between text-left rounded-lg border border-cyan-200 bg-white hover:bg-cyan-50/40 transition-colors"
                                >
                                    <h5 className="text-[12px] font-black uppercase tracking-wide text-cyan-700 leading-none flex items-center gap-2">
                                        <i className="fa-solid fa-layer-group text-cyan-500"></i>
                                        多组综合比较分析
                                    </h5>
                                    <i className={`fa-solid fa-chevron-${multiAnalysisOpen ? 'up' : 'down'} text-[10px] text-cyan-400`}></i>
                                </button>
                                {multiAnalysisOpen && (
                                    <div className="space-y-3 px-3 pb-3 mt-2">
                                        {/* 综合对比结论 */}
                                        <div className="p-4 bg-white border border-cyan-100 rounded-xl">
                                            <div className="text-[10px] font-black text-cyan-600 uppercase mb-2 flex items-center gap-1.5">
                                                <i className="fa-solid fa-microscope text-cyan-400"></i> 综合对比结论
                                            </div>
                                            <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{multiDatasetAnalysis.comparativeSummary}</p>
                                        </div>

                                        {/* 参数效应表 */}
                                        {!!multiDatasetAnalysis.parameterEffects?.length && (
                                            <div className="p-4 bg-white border border-cyan-100 rounded-xl">
                                                <div className="text-[10px] font-black text-cyan-600 uppercase mb-2 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-sliders text-cyan-400"></i> 参数效应分析
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-[12px]">
                                                        <thead>
                                                            <tr className="border-b border-cyan-100">
                                                                <th className="text-left py-2 px-3 font-black text-slate-500 uppercase text-[10px]">参数</th>
                                                                <th className="text-left py-2 px-3 font-black text-slate-500 uppercase text-[10px]">变化范围</th>
                                                                <th className="text-left py-2 px-3 font-black text-slate-500 uppercase text-[10px]">XRD 影响</th>
                                                                <th className="text-center py-2 px-3 font-black text-slate-500 uppercase text-[10px]">置信度</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {multiDatasetAnalysis.parameterEffects.map((pe, idx) => (
                                                                <tr key={`pe-${idx}`} className="border-b border-slate-50 hover:bg-cyan-50/30 transition-colors">
                                                                    <td className="py-2 px-3 font-bold text-slate-700">{pe.parameter}</td>
                                                                    <td className="py-2 px-3 text-slate-600">{pe.valueRange}</td>
                                                                    <td className="py-2 px-3 text-slate-600">{pe.observedEffect}</td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${pe.confidence === '高' ? 'bg-emerald-100 text-emerald-700' :
                                                                            pe.confidence === '中' ? 'bg-amber-100 text-amber-700' :
                                                                                'bg-slate-100 text-slate-500'
                                                                            }`}>{pe.confidence}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* 关键差异 */}
                                        {!!multiDatasetAnalysis.keyDifferences?.length && (
                                            <div className="p-4 bg-white border border-cyan-100 rounded-xl">
                                                <div className="text-[10px] font-black text-cyan-600 uppercase mb-2 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-code-compare text-cyan-400"></i> 关键差异
                                                </div>
                                                <ul className="space-y-2">
                                                    {multiDatasetAnalysis.keyDifferences.map((diff, idx) => (
                                                        <li key={`kd-${idx}`} className="text-[13px] text-slate-700 flex items-start gap-2 leading-relaxed">
                                                            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                                            {typeof diff === 'string' ? diff : String((diff as any)?.description || (diff as any)?.text || (diff as any)?.difference || Object.values(diff as any).filter(v => typeof v === 'string').join(' ') || JSON.stringify(diff))}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* 工艺洞察 */}
                                        {!!multiDatasetAnalysis.processingInsights?.length && (
                                            <div className="p-4 bg-white border border-cyan-100 rounded-xl">
                                                <div className="text-[10px] font-black text-cyan-600 uppercase mb-2 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-lightbulb text-amber-400"></i> 工艺洞察
                                                </div>
                                                <ul className="space-y-2">
                                                    {multiDatasetAnalysis.processingInsights.map((insight, idx) => (
                                                        <li key={`pi-${idx}`} className="text-[13px] text-slate-700 flex items-start gap-2 leading-relaxed">
                                                            <i className="fa-solid fa-flask shrink-0 mt-1 text-amber-400 text-[10px]"></i>
                                                            {typeof insight === 'string' ? insight : String((insight as any)?.description || (insight as any)?.text || (insight as any)?.insight || Object.values(insight as any).filter(v => typeof v === 'string').join(' ') || JSON.stringify(insight))}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* 建议 */}
                                        {!!multiDatasetAnalysis.recommendations?.length && (
                                            <div className="p-4 bg-white border border-cyan-100 rounded-xl">
                                                <div className="text-[10px] font-black text-cyan-600 uppercase mb-2 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-arrow-right text-cyan-400"></i> 下一步建议
                                                </div>
                                                <ul className="space-y-2">
                                                    {multiDatasetAnalysis.recommendations.map((rec, idx) => (
                                                        <li key={`rec-${idx}`} className="text-[13px] text-slate-700 flex items-start gap-2 leading-relaxed">
                                                            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                                            {typeof rec === 'string' ? rec : String((rec as any)?.recommendation || (rec as any)?.description || (rec as any)?.text || Object.values(rec as any).filter(v => typeof v === 'string').join(' ') || JSON.stringify(rec))}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ 物相演变追踪结果（可折叠） ═══ */}
                        {phaseEvolution && (
                            <div className="border-t border-violet-200 p-1.5 bg-violet-50/20">
                                <button
                                    onClick={() => {
                                        setEvolutionOpen2(v => !v);
                                        setEvolutionExpanded(prev => !prev);
                                    }}
                                    className="w-full h-10 px-2.5 flex items-center justify-between text-left rounded-lg border border-violet-200 bg-white hover:bg-violet-50/40 transition-colors"
                                >
                                    <h5 className="text-[10px] font-black uppercase tracking-wide text-violet-700 flex items-center gap-1.5 leading-none">
                                        <i className="fa-solid fa-timeline text-violet-500"></i> 物相演变追踪
                                        <span className="text-[8px] font-bold text-violet-400 ml-1.5">
                                            {phaseEvolution.phaseTransitions?.length || 0} 个转变事件
                                        </span>
                                    </h5>
                                    <i className={`fa-solid fa-chevron-${evolutionOpen2 ? 'up' : 'down'} text-violet-400 text-[8px]`}></i>
                                </button>
                                {/* 详细内容折叠 */}
                                {evolutionOpen2 && (
                                    <div className="px-4 pb-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{phaseEvolution.evolutionSummary}</p>
                                        {!!phaseEvolution.phaseTransitions?.length && (
                                            <div className="space-y-1.5">
                                                <div className="text-[8px] font-black text-violet-600 uppercase">转变事件</div>
                                                {phaseEvolution.phaseTransitions.map((tr, idx) => (
                                                    <div key={`tr-${idx}`} className="p-2 bg-white border border-violet-100 rounded-xl flex items-center gap-2 text-[9px]">
                                                        <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg font-bold">{tr.fromPhase}</span>
                                                        <i className="fa-solid fa-arrow-right text-violet-400 text-[7px]"></i>
                                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold">{tr.toPhase}</span>
                                                        <span className="text-slate-400 text-[8px] ml-auto">{tr.condition}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!!phaseEvolution.trendAnalysis?.length && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {phaseEvolution.trendAnalysis.map((t, idx) => {
                                                    const trendColors: Record<string, string> = {
                                                        increasing: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                                        decreasing: 'bg-rose-50 text-rose-700 border-rose-200',
                                                        stable: 'bg-slate-50 text-slate-600 border-slate-200',
                                                        appears: 'bg-blue-50 text-blue-700 border-blue-200',
                                                        disappears: 'bg-amber-50 text-amber-700 border-amber-200',
                                                    };
                                                    const trendIcons: Record<string, string> = {
                                                        increasing: 'fa-arrow-trend-up',
                                                        decreasing: 'fa-arrow-trend-down',
                                                        stable: 'fa-minus',
                                                        appears: 'fa-star',
                                                        disappears: 'fa-ghost',
                                                    };
                                                    const color = trendColors[t.trend] || trendColors.stable;
                                                    const icon = trendIcons[t.trend] || 'fa-minus';
                                                    return (
                                                        <span key={`trend-${idx}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-bold ${color}`} title={t.notes}>
                                                            <i className={`fa-solid ${icon} text-[7px]`}></i>
                                                            {t.phaseName}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {!!phaseEvolution.criticalPoints?.length && (
                                            <div className="space-y-1">
                                                <div className="text-[8px] font-black text-amber-600 uppercase">关键转折点</div>
                                                {phaseEvolution.criticalPoints.map((cp, idx) => (
                                                    <div key={`cp-${idx}`} className="p-2 bg-amber-50 border border-amber-100 rounded-xl text-[9px]">
                                                        <span className="font-black text-amber-700">{cp.condition}：</span>
                                                        <span className="text-slate-700">{cp.event}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {!!phaseEvolution.recommendations?.length && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {phaseEvolution.recommendations.slice(0, 4).map((rec, idx) => (
                                                    <span key={`rec-${idx}`} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[8px] font-bold border border-emerald-100">{rec}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── 关联实验记录 Modal ── */}
            {showContextModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[3200] flex items-center justify-center p-4">
                    <div className="w-full max-w-xl bg-white rounded-[2.5rem] border-4 border-white shadow-2xl p-8">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <i className="fa-solid fa-link text-indigo-500"></i>
                                关联实验记录
                            </h3>
                            <button onClick={() => setShowContextModal(false)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="mt-6 space-y-5">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-2 px-1">关联课题项目</div>
                                <select value={draftContextProjectId}
                                    onChange={(e) => {
                                        const nextProjectId = e.target.value;
                                        const nextProject = projects.find(p => p.id === nextProjectId);
                                        const latest = getLatestLogSelection(nextProject || undefined);
                                        setDraftContextProjectId(nextProjectId);
                                        setDraftContextMilestoneId(latest.milestoneId);
                                        setDraftContextLogId(latest.logId);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-300">
                                    <option value="">选择课题...</option>
                                    {projects.map(item => (<option key={item.id} value={item.id}>{item.title}</option>))}
                                </select>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-2 px-1">关联实验节点（阶段）</div>
                                <select value={draftContextMilestoneId}
                                    onChange={(e) => {
                                        const nextMilestoneId = e.target.value;
                                        const milestone = draftContextMilestones.find(m => m.id === nextMilestoneId);
                                        const latestLog = milestone ? [...milestone.logs].sort((a, b) => parseLogTime(b) - parseLogTime(a))[0] : null;
                                        setDraftContextMilestoneId(nextMilestoneId);
                                        setDraftContextLogId(latestLog?.id || '');
                                    }}
                                    disabled={!draftContextProjectId || draftContextMilestones.length === 0}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-300 disabled:opacity-50">
                                    <option value="">{draftContextMilestones.length === 0 ? '该课题暂无节点' : '选择节点...'}</option>
                                    {draftContextTree.map(({ milestone: item, depth, label }) => (<option key={item.id} value={item.id}>{'　'.repeat(depth)}{label}  {item.title}</option>))}
                                </select>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-2 px-1">指定实验记录</div>
                                <select value={draftContextLogId}
                                    onChange={(e) => setDraftContextLogId(e.target.value)}
                                    disabled={!draftContextMilestoneId || draftContextLogs.length === 0}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-300 disabled:opacity-50">
                                    <option value="">{draftContextLogs.length === 0 ? '该节点暂无记录' : '选择记录...'}</option>
                                    {draftContextLogs.map(item => (<option key={item.id} value={item.id}>{`${item.content?.slice(0, 36) || '未命名记录'} · ${item.timestamp}`}</option>))}
                                </select>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-[12px] leading-relaxed text-amber-800 font-medium">
                                关联后，AI 深度分析会自动读取该实验记录上下文；保存分析结果时也会保留该关联设置。
                            </div>
                        </div>
                        <div className="mt-7 flex gap-3">
                            <button onClick={() => { setSelectedContextLogId(''); setContextualAnalysis(null); setShowContextModal(false); }}
                                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-500 text-[12px] font-black hover:bg-slate-200">
                                解除关联
                            </button>
                            <button onClick={confirmContextLink}
                                className="flex-[2] py-3 rounded-2xl bg-indigo-600 text-white text-[12px] font-black hover:bg-indigo-700 shadow-lg">
                                <i className="fa-solid fa-link-slash mr-1"></i> 确认关联
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 数据集级关联实验记录 Modal ── */}
            {linkDatasetModalIdx !== null && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[3200] flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] border-4 border-white shadow-2xl p-8">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <i className="fa-solid fa-link text-indigo-500"></i>
                                关联实验记录
                                <span className="text-[10px] font-bold text-slate-400 ml-1">
                                    {datasets[linkDatasetModalIdx]?.name}
                                </span>
                            </h3>
                            <button onClick={() => setLinkDatasetModalIdx(null)} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="mt-6 space-y-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1.5">课题</div>
                                <select
                                    value={draftContextProjectId}
                                    onChange={(e) => {
                                        const pid = e.target.value;
                                        const proj = projects.find(p => p.id === pid);
                                        const latest = getLatestLogSelection(proj || undefined);
                                        setDraftContextProjectId(pid);
                                        setDraftContextMilestoneId(latest.milestoneId);
                                        setDraftContextLogId(latest.logId);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-300"
                                >
                                    <option value="">选择课题...</option>
                                    {projects.map(item => (<option key={item.id} value={item.id}>{item.title}</option>))}
                                </select>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1.5">实验节点</div>
                                <select
                                    value={draftContextMilestoneId}
                                    onChange={(e) => {
                                        const mid = e.target.value;
                                        const ms = draftContextMilestones.find(m => m.id === mid);
                                        const latestLog = ms ? [...ms.logs].sort((a, b) => parseLogTime(b) - parseLogTime(a))[0] : null;
                                        setDraftContextMilestoneId(mid);
                                        setDraftContextLogId(latestLog?.id || '');
                                    }}
                                    disabled={draftContextMilestones.length === 0}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-300 disabled:opacity-50"
                                >
                                    <option value="">选择节点...</option>
                                    {draftContextTree.map(({ milestone: ms, depth, label }) => (<option key={ms.id} value={ms.id}>{'　'.repeat(depth)}{label}  {ms.title}</option>))}
                                </select>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase mb-1.5">实验记录</div>
                                <select
                                    value={draftContextLogId}
                                    onChange={(e) => setDraftContextLogId(e.target.value)}
                                    disabled={draftContextLogs.length === 0}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-300 disabled:opacity-50"
                                >
                                    <option value="">选择记录...</option>
                                    {draftContextLogs.map(log => { const firstLine = (log.content || '').split('\n')[0].trim() || log.id; return <option key={log.id} value={log.id}>{firstLine.length > 35 ? firstLine.slice(0, 35) + '...' : firstLine}</option>; })}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            {datasets[linkDatasetModalIdx]?.linkedLogId && (
                                <button
                                    onClick={() => {
                                        setDatasets(prev => prev.map((ds, idx) =>
                                            idx === linkDatasetModalIdx
                                                ? { ...ds, linkedProjectId: undefined, linkedMilestoneId: undefined, linkedLogId: undefined, linkedLogTitle: undefined }
                                                : ds
                                        ));
                                        setLinkDatasetModalIdx(null);
                                        showToast({ message: '已解除关联', type: 'info' });
                                    }}
                                    className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase border border-rose-100 hover:bg-rose-100 transition-all"
                                >
                                    解除关联
                                </button>
                            )}
                            <div className="flex-1" />
                            <button onClick={() => setLinkDatasetModalIdx(null)} className="px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    if (!draftContextLogId) { showToast({ message: '请选择一条实验记录', type: 'warning' }); return; }
                                    const selectedLog = draftContextLogs.find(l => l.id === draftContextLogId);
                                    setDatasets(prev => prev.map((ds, idx) =>
                                        idx === linkDatasetModalIdx
                                            ? {
                                                ...ds,
                                                linkedProjectId: draftContextProjectId,
                                                linkedMilestoneId: draftContextMilestoneId,
                                                linkedLogId: draftContextLogId,
                                                linkedLogTitle: (() => { const firstLine = (selectedLog?.content || '').split('\n')[0].trim(); return firstLine.slice(0, 30) || draftContextLogId; })(),
                                            }
                                            : ds
                                    ));
                                    setLinkDatasetModalIdx(null);
                                    showToast({ message: `${datasets[linkDatasetModalIdx]?.name} 已关联实验记录`, type: 'success' });
                                }}
                                disabled={!draftContextLogId}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 disabled:opacity-40 transition-all"
                            >
                                确认关联
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 方案库 Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">XRD 方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <FolderLibraryView
                                records={filteredRecords}
                                onLoad={handleLoadRecord}
                                onDelete={handleDeleteRecord}
                                emptyText="暂无相关存档"
                            />
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* 保存 Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">保存 XRD 分析</h3>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-4 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="方案名称..." autoFocus />
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

            {/* 同步链接 Modal */}
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
                />
            )}
        </div>
    );
};

export default XrdPhasePanel;
