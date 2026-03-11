import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ResearchProject, Milestone, DataSeries, ChartAnnotation, AnnotationType } from '../../../types';
import {
  EngineMode, DataPoint, AnalysisResult, FitRange, FitMode,
  ElectroQcReport, ElectroParams, ElectroRecord, CompareSample, SensitivityCell,
  DEFAULT_ELECTRO_PARAMS, DEFAULT_TAFEL_FIT_RANGE, COMPARE_COLORS
} from './types';
import {
  cleanAndValidateElectroData, runElectroAnalysis, recommendTafelFitRange,
  computeElectroSensitivityGrid, generateElectroMockData
} from './electroAnalysis';
import saveAs from 'file-saver';
import { buildArchiveFolderMeta } from '../../../utils/archiveFolder';
import { resolveContextForAnalysis, buildContextSummary } from '../../../utils/experimentContext';
import { generateContextualKineticsReport } from '../../../services/gemini/analysis';

// Fix: Defining FontTabType locally to match useDataAnalysisLogic's definition and satisfy TS in this scope
export type FontTabType = 'title' | 'label' | 'tick' | 'legend';

interface UseElectroLogicProps {
  projects: ResearchProject[];
  onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
  defaultProjectId?: string;
  defaultMilestoneId?: string;
  traceRecordId?: string | null;
  show: boolean;
}

export const useElectroLogic = ({ projects, onSave, defaultProjectId, defaultMilestoneId, traceRecordId, show }: UseElectroLogicProps) => {
  const stripLatexArtifacts = (text: string): string => {
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
    cleaned = cleaned
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
    return cleaned;
  };

  const [activeMode, setActiveMode] = useState<EngineMode>('LSV');
  const [rawData, setRawData] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [aiConclusion, setAiConclusion] = useState<string | null>(null);
  const [aiDeepAnalysis, setAiDeepAnalysis] = useState<string | null>(null);
  const [isDeepAnalysing, setIsDeepAnalysing] = useState(false);
  const analysisRunIdRef = useRef(0);

  // --- QC & Params ---
  const [qcReport, setQcReport] = useState<ElectroQcReport | null>(null);
  const [electroParams, setElectroParams] = useState<ElectroParams>(DEFAULT_ELECTRO_PARAMS);

  // --- Tafel 拟合区间 ---
  const [tafelFitRange, setTafelFitRange] = useState<FitRange>(DEFAULT_TAFEL_FIT_RANGE);
  const [tafelFitMode, setTafelFitMode] = useState<FitMode>('auto');

  // --- 敏感度分析 ---
  const [sensitivityGrid, setSensitivityGrid] = useState<SensitivityCell[]>([]);

  // --- 方案库 ---
  const [savedRecords, setSavedRecords] = useState<ElectroRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('sciflow_electro_library') || '[]'); } catch { return []; }
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [saveMilestoneId, setSaveMilestoneId] = useState('');
  const [saveLogId, setSaveLogId] = useState('');

  // --- 样品对比 ---
  const [compareSampleIds, setCompareSampleIds] = useState<string[]>([]);
  const traceLoadedRef = useRef<string | null>(null);

  // --- 编辑模式与面板控制 ---
  const [isEditMode, setIsEditMode] = useState(false);
  const [leftPanelMode, setLeftPanelMode] = useState<'basic' | 'axis' | 'series'>('basic');
  const [seriesSettingsId, setSeriesSettingsIdInternal] = useState<string | null>(null);

  const setSeriesSettingsId = useCallback((id: string | null) => {
    setSeriesSettingsIdInternal(id);
    if (id) {
      setLeftPanelMode('series');
    } else {
      setLeftPanelMode('basic');
    }
  }, []);

  // --- 图表全局属性 (轴、标题) ---
  const [chartTitle, setChartTitle] = useState('动力学表征分析图谱');
  const [xAxisLabel, setXAxisLabel] = useState('Potential (V vs. RHE)');
  const [yAxisLabel, setYAxisLabel] = useState('Current Density (mA/cm²)');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'scatter' | 'area'>('line');
  const [aspectRatio, setAspectRatio] = useState(1.5);
  const [fontSize, setFontSize] = useState(16);
  const [axisLabelFontSize, setAxisLabelFontSize] = useState(20);

  // --- 系列样式记录 ---
  const [seriesStyles, setSeriesStyles] = useState<Record<string, any>>({
    'electro_main': {
      color: '#6366f1',
      pointColor: '#6366f1',
      strokeWidth: 3.0,
      pointShape: 'circle',
      pointSize: 4
    }
  });

  const mainStyle = seriesStyles['electro_main'] || {};
  const setMainColor = (color: string) => updateSeriesStyle('electro_main', { color, pointColor: color });
  const setStrokeWidth = (strokeWidth: number) => updateSeriesStyle('electro_main', { strokeWidth });
  const setPointShape = (pointShape: any) => updateSeriesStyle('electro_main', { pointShape });
  const setPointSize = (pointSize: number) => updateSeriesStyle('electro_main', { pointSize });
  const setPointColor = (pointColor: string) => updateSeriesStyle('electro_main', { pointColor });

  const updateSeriesStyle = (id: string, updates: any, applyToAll: boolean = false) => {
    setSeriesStyles(prev => {
      const next = { ...prev };
      if (applyToAll) {
        Object.keys(next).forEach(key => {
          next[key] = { ...next[key], ...updates };
        });
      } else {
        next[id] = { ...(next[id] || {}), ...updates };
      }
      return next;
    });
  };

  const [xDomain, setXDomain] = useState<[any, any]>(['auto', 'auto']);
  const [yDomain, setYDomain] = useState<[any, any]>(['auto', 'auto']);
  const [xScale, setXScale] = useState<'auto' | 'log'>('auto');
  const [yScale, setYScale] = useState<'auto' | 'log'>('auto');
  const [gridX, setGridX] = useState(false);
  const [gridY, setGridY] = useState(true);
  const [gridLineWidth, setGridLineWidth] = useState(1.0);
  const [axisBox, setAxisBox] = useState(true);
  const [axisLineWidth, setAxisLineWidth] = useState(2.0);
  const [axisColor, setAxisColor] = useState('#334155');
  const [tickFontSize, setTickFontSize] = useState(14);
  const [tickSize, setTickSize] = useState(6);
  const [tickWidth, setTickWidth] = useState(1.5);
  const [xTickCount, setXTickCount] = useState(5);
  const [yTickCount, setYTickCount] = useState(5);
  const [xAxisDivision, setXAxisDivision] = useState(1);
  const [yAxisDivision, setYAxisDivision] = useState(1);

  const [labelFontFamily, setLabelFontFamily] = useState('inherit');
  const [labelFontWeight, setLabelFontWeight] = useState('bold');
  const [labelFontStyle, setLabelFontStyle] = useState('normal');
  const [titleFontFamily, setTitleFontFamily] = useState('inherit');
  const [titleFontWeight, setTitleFontWeight] = useState('black');
  const [titleFontStyle, setTitleFontStyle] = useState('italic');
  const [tickFontFamily, setTickFontFamily] = useState('Arial, sans-serif');
  const [tickFontWeight, setTickFontWeight] = useState('bold');
  const [tickFontStyle, setTickFontStyle] = useState('normal');
  const [legendFontFamily, setLegendFontFamily] = useState('inherit');
  const [legendFontWeight, setLegendFontWeight] = useState('bold');
  const [legendFontStyle, setLegendFontStyle] = useState('normal');
  const [legendFontSize, setLegendFontSize] = useState(14);
  const [activeFontTab, setActiveFontTab] = useState<FontTabType>('label');
  const [showXTicks, setShowXTicks] = useState(true);
  const [showYTicks, setShowYTicks] = useState(true);
  const [showMirroredTicks, setShowMirroredTicks] = useState(false);

  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationType | 'select' | 'none'>('none');
  const [legendPos, setLegendPos] = useState({ x: 180, y: 10 });
  const [xLabelPos, setXLabelPos] = useState({ x: 0, y: 0 });
  const [yLabelPos, setYLabelPos] = useState({ x: 0, y: 0 });
  const [titlePos, setTitlePos] = useState({ x: 0, y: 0 });
  const [showTemplateList, setShowTemplateList] = useState(true);
  const [legendBorderVisible, setLegendBorderVisible] = useState(false);
  const [legendBorderColor, setLegendBorderColor] = useState('transparent');
  const [legendBorderWidth, setLegendBorderWidth] = useState(0);

  const [saveStep, setSaveStep] = useState<'idle' | 'selecting'>('idle');
  const [targetProjectId, setTargetProjectId] = useState(defaultProjectId || '');
  const [targetMilestoneId, setTargetMilestoneId] = useState(defaultMilestoneId || '');
  const [targetLogId, setTargetLogId] = useState('NEW_LOG');
  const [pushToMatrix, setPushToMatrix] = useState(false);
  const [selectedMatrixId, setSelectedMatrixId] = useState<string>('');
  const [matrixSampleId, setMatrixSampleId] = useState('');
  const [matrixNote, setMatrixNote] = useState('');
  const [matrixParams, setMatrixParams] = useState<{ key: string, value: string }[]>([]);
  const [matrixResults, setMatrixResults] = useState<{ key: string, value: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null!);

  // === 方案库持久化 ===
  useEffect(() => {
    localStorage.setItem('sciflow_electro_library', JSON.stringify(savedRecords));
  }, [savedRecords]);

  useEffect(() => {
    if (show) {
      if (defaultProjectId) setTargetProjectId(defaultProjectId);
      if (defaultMilestoneId) setTargetMilestoneId(defaultMilestoneId);
      setMatrixSampleId(`S-${Date.now().toString().slice(-6)}`);
      setPushToMatrix(false);
      setSaveStep('idle');
      setIsEditMode(false);
    }
  }, [show, defaultProjectId, defaultMilestoneId]);

  useEffect(() => {
    if (activeMode === 'EIS' || activeMode === 'RDE') {
      setChartType('scatter');
    } else {
      setChartType('line');
    }
  }, [activeMode]);

  const selectedProject = useMemo(() => projects.find(p => p.id === targetProjectId), [projects, targetProjectId]);
  const selectedMilestone = useMemo(() => selectedProject?.milestones.find(m => m.id === targetMilestoneId), [selectedProject, targetMilestoneId]);

  const simulatedData = useMemo(() => generateElectroMockData(activeMode), [activeMode]);

  const displayData = useMemo(() => {
    if (!rawData.trim()) return simulatedData;
    const { data } = cleanAndValidateElectroData(rawData);
    return data.length > 0 ? data : simulatedData;
  }, [rawData, simulatedData]);

  // === Tafel 自动拟合建议 ===
  const autoTafelSuggestion = useMemo(() => {
    if (activeMode !== 'LSV' && activeMode !== 'CV') return null;
    return recommendTafelFitRange(displayData);
  }, [displayData, activeMode]);

  const activeTafelFitRange = useMemo<FitRange>(() => {
    if (tafelFitMode === 'auto') {
      return autoTafelSuggestion?.range || tafelFitRange;
    }
    return tafelFitRange;
  }, [tafelFitMode, autoTafelSuggestion, tafelFitRange]);

  const { processedData, chartConfig, domains } = useMemo(() => {
    let data = [...displayData];
    if (data.length === 0) return {
      processedData: [],
      chartConfig: { xLabel: '', yLabel: '', color: '#ccc' },
      domains: { x: [0, 1], y: [0, 1] }
    };

    let xL = 'Potential (V)', yL = 'Current Density (mA/cm²)', col = '#818cf8';
    if (activeMode === 'EIS') { xL = "Z' (Ω)"; yL = "-Z'' (Ω)"; col = '#f43f5e'; }
    else if (activeMode === 'ECSA') { xL = "Scan Rate (mV/s)"; yL = "Δj (mA)"; col = '#f59e0b'; }
    else if (activeMode === 'RDE') { xL = "ω⁻⁰·⁵ (s⁰·⁵/rad⁰·⁵)"; yL = "1/j (mA⁻¹·cm²)"; col = '#0ea5e9'; }

    const xs = data.map(d => d.x); const ys = data.map(d => d.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1; const rangeY = maxY - minY || 1;

    let yDomainMin = minY - rangeY * 0.1;
    let yDomainMax = maxY + rangeY * 0.1;

    if ((activeMode === 'LSV' || activeMode === 'CV') && minY < 0) {
      yDomainMin = minY - rangeY * 0.15;
    }

    return {
      processedData: data,
      chartConfig: { xLabel: xL, yLabel: yL, color: col },
      domains: { x: [minX - rangeX * 0.1, maxX + rangeX * 0.1], y: [yDomainMin, yDomainMax] }
    };
  }, [displayData, activeMode]);

  useEffect(() => {
    if (isAnalysing || isEditMode) return;
    let xL = 'Potential (V)', yL = 'Current Density (mA/cm²)', col = '#818cf8';
    if (activeMode === 'EIS') { xL = "Z' (Ω)"; yL = "-Z'' (Ω)"; col = '#f43f5e'; }
    else if (activeMode === 'ECSA') { xL = "Scan Rate (mV/s)"; yL = "Δj (mA)"; col = '#f59e0b'; }
    else if (activeMode === 'RDE') { xL = "ω⁻⁰·⁵"; yL = "1/j"; col = '#0ea5e9'; }
    setXAxisLabel(xL);
    setYAxisLabel(yL);
    setMainColor(col);
    setPointColor(col);
  }, [activeMode, isAnalysing, isEditMode]);

  const seriesList: DataSeries[] = useMemo(() => [{
    id: 'electro_main',
    name: `${activeMode} 数据曲线`,
    data: processedData.map(p => ({ name: String(p.x), value: p.y })),
    ...mainStyle,
    visible: true
  }], [processedData, activeMode, mainStyle]);

  // ==================== 核心分析逻辑 ====================

  const handleRunAnalysis = () => {
    const runId = Date.now();
    analysisRunIdRef.current = runId;
    setIsAnalysing(true);
    setAiConclusion(null);
    setAiDeepAnalysis(null);
    setIsDeepAnalysing(false);
    setAnalysisResult(null);

    // QC 报告
    if (rawData.trim()) {
      const { qc } = cleanAndValidateElectroData(rawData);
      setQcReport(qc);
    }

    setTimeout(async () => {
      const result = runElectroAnalysis(displayData, activeMode, activeTafelFitRange, electroParams);
      const fallbackRef = targetProjectId && targetMilestoneId && targetLogId && targetLogId !== 'NEW_LOG'
        ? { projectId: targetProjectId, milestoneId: targetMilestoneId, logId: targetLogId }
        : null;
      const context = resolveContextForAnalysis({
        projects,
        selectedProjectId: targetProjectId,
        savedRecords,
        currentRecordId,
        fallbackRef
      });
      const contextSuffix = context
        ? ` 关联实验上下文：${buildContextSummary(context)}。`
        : ' 未关联实验记录，本次结论基于纯电化学数据。';
      if (result) {
        setAnalysisResult(result);

        // 敏感度分析（LSV/CV 模式）
        if (activeMode === 'LSV' || activeMode === 'CV') {
          const grid = computeElectroSensitivityGrid(displayData);
          setSensitivityGrid(grid);
        }

        // AI 结论生成
        const conclusions: Record<EngineMode, string> = {
          'LSV': `催化剂在 ${electroParams.scanRate} mV/s 扫速下展现出优异的 ORR 活性。半波电位 E₁/₂ = ${result.halfWavePotential || 'N/A'} V vs. RHE，起始电位 ${result.onsetPotential || 'N/A'} V，极限电流密度 ${result.limitingCurrent || 'N/A'} mA/cm²。${result.tafelFit ? `Tafel 斜率 ${result.tafelFit.slope} mV/dec (R² = ${result.tafelFit.r2})，表明反应动力学遵循${result.tafelFit.slope < 80 ? '四电子直接还原' : '两步反应'}机理。` : ''}`,
          'OER': `OER 极化曲线分析：过电位 η@10 mA/cm² = ${result.oerOverpotential || 'N/A'} mV，起始电位 ${result.oerOnsetPotential || 'N/A'} V vs. RHE。${result.oerTafelSlope ? `Tafel 斜率 ${result.oerTafelSlope} mV/dec，控速步骤为${result.oerTafelSlope < 60 ? 'M-OH 形成' : result.oerTafelSlope < 90 ? 'M-O 脱质子 (Volmer-Heyrovsky 机理)' : 'O-O 成键'}。` : ''}${result.oerMassActivity ? `质量活性 @1.6V = ${result.oerMassActivity} A/g。` : ''}`,
          'CV': `循环伏安扫描揭示了明确的氧化还原电对。阳极峰 ${result.peakAnodic?.v} V (${result.peakAnodic?.j} mA/cm²)，阴极峰 ${result.peakCathodic?.v} V (${result.peakCathodic?.j} mA/cm²)。峰电位差 ΔEp = ${result.peakSeparation} V，${(result.peakSeparation || 0) < 0.059 ? '接近可逆过程' : '存在一定的不可逆性'}。阳极阴极电流比 |Ipa/Ipc| = ${result.anodicCathodicRatio}。`,
          'ECSA': `双层电容法测得 Cdl = ${result.cdl} mF，对应电化学活性面积 ECSA = ${result.ecsa} cm²，粗糙度因子 Rf = ${result.roughnessFactor}。较高的 ECSA 表明催化剂具有丰富的活性位点和良好的电极-电解质界面接触。`,
          'RDE': `K-L 方程拟合得到电子转移数 n = ${result.electronTransferNum}，${(result.electronTransferNum || 0) > 3.8 ? '接近四电子直接还原路径' : '存在部分两电子路径'}。动力学电流密度 jk = ${result.kineticCurrent} mA/cm²。K-L 拟合质量 R² = ${result.klR2}。`,
          'EIS': `Nyquist 图拟合结果：溶液电阻 Rs = ${result.rs} Ω，电荷转移电阻 Rct = ${result.rct} Ω。较低的 Rct 表明催化剂具有快速的电荷转移动力学。${result.warburgCoeff ? `检测到 Warburg 扩散尾迹（斜率 ≈ ${result.warburgCoeff}），表明存在扩散控制过程。` : ''}`
        };
        const baseConclusion = stripLatexArtifacts(`${conclusions[activeMode]}${contextSuffix}`);
        if (analysisRunIdRef.current !== runId) return;
        setAiConclusion(baseConclusion);
        setIsAnalysing(false);

        // 基于关联实验记录上下文进行深度 AI 分析（不阻塞主结果）
        const deepMetrics: Record<string, number | string> = {
          ...(result.halfWavePotential !== undefined ? { halfWavePotential: result.halfWavePotential } : {}),
          ...(result.onsetPotential !== undefined ? { onsetPotential: result.onsetPotential } : {}),
          ...(result.tafelSlope !== undefined ? { tafelSlope: result.tafelSlope } : {}),
          ...(result.limitingCurrent !== undefined ? { limitingCurrent: result.limitingCurrent } : {}),
          ...(result.massActivity !== undefined ? { massActivity: result.massActivity } : {}),
          ...(result.oerOverpotential !== undefined ? { oerOverpotential: result.oerOverpotential } : {}),
          ...(result.oerOnsetPotential !== undefined ? { oerOnsetPotential: result.oerOnsetPotential } : {}),
          ...(result.oerTafelSlope !== undefined ? { oerTafelSlope: result.oerTafelSlope } : {}),
          ...(result.oerMassActivity !== undefined ? { oerMassActivity: result.oerMassActivity } : {}),
          ...(result.ecsa !== undefined ? { ecsa: result.ecsa } : {}),
          ...(result.cdl !== undefined ? { cdl: result.cdl } : {}),
          ...(result.electronTransferNum !== undefined ? { electronTransferNum: result.electronTransferNum } : {}),
          ...(result.kineticCurrent !== undefined ? { kineticCurrent: result.kineticCurrent } : {}),
          ...(result.rs !== undefined ? { rs: result.rs } : {}),
          ...(result.rct !== undefined ? { rct: result.rct } : {}),
          ...(result.klR2 !== undefined ? { klR2: result.klR2 } : {}),
          ...(result.warburgCoeff !== undefined ? { warburgCoeff: result.warburgCoeff } : {}),
          ...(result.tafelFit ? { tafelFitR2: result.tafelFit.r2, tafelFitRange: `${result.tafelFit.fitRange.min}~${result.tafelFit.fitRange.max}` } : {})
        };
        setIsDeepAnalysing(true);
        try {
          const deepText = await generateContextualKineticsReport(
            context?.projectTitle || selectedProject?.title || '未命名课题',
            activeMode,
            deepMetrics,
            context ? {
              content: context.log.content,
              description: context.log.description,
              parameters: context.log.parameters,
              scientificData: context.log.scientificData || {},
              timestamp: context.log.timestamp
            } : null
          );
          if (analysisRunIdRef.current !== runId) return;
          setAiDeepAnalysis(stripLatexArtifacts((deepText || '').trim()) || baseConclusion);
        } catch {
          if (analysisRunIdRef.current !== runId) return;
          setAiDeepAnalysis(`### 上下文关联深析\n${baseConclusion}`);
        } finally {
          if (analysisRunIdRef.current === runId) setIsDeepAnalysing(false);
        }
      } else {
        if (analysisRunIdRef.current !== runId) return;
        setAiConclusion(stripLatexArtifacts('分析未能提取有效特征，请检查数据格式是否符合 ' + activeMode + ' 模式要求。' + contextSuffix));
        setAiDeepAnalysis(null);
        setIsAnalysing(false);
      }
    }, 800);
  };

  // ==================== 方案库管理 ====================

  const handleSaveRecord = () => {
    if (!saveTitle.trim()) return;
    const recordId = currentRecordId || Date.now().toString();
    const existing = savedRecords.find(r => r.id === recordId);
    const fallbackFolder = buildArchiveFolderMeta(projects, targetProjectId, saveMilestoneId || undefined, saveLogId || undefined);
    const record: ElectroRecord = {
      id: recordId,
      title: saveTitle,
      mode: activeMode,
      timestamp: new Date().toLocaleString(),
      folder: existing?.folder || fallbackFolder,
        data: {
          rawData,
          processedData,
          analysisResult,
          aiConclusion,
          aiDeepAnalysis,
          tafelFitRange: activeTafelFitRange,
          tafelFitMode,
          params: electroParams,
      }
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
  };

  // 快速保存：已有记录直接覆盖，没有则弹窗新建
  const handleQuickSave = () => {
    if (currentRecordId) {
      const existing = savedRecords.find(r => r.id === currentRecordId);
      if (existing) {
        const fallbackFolder = buildArchiveFolderMeta(projects, targetProjectId, saveMilestoneId || undefined, saveLogId || undefined);
        const record: ElectroRecord = {
          id: currentRecordId,
          title: existing.title,
          mode: activeMode,
          timestamp: new Date().toLocaleString(),
          folder: existing?.folder || fallbackFolder,
        data: {
            rawData, processedData, analysisResult, aiConclusion, aiDeepAnalysis,
            tafelFitRange: activeTafelFitRange, tafelFitMode,
            params: electroParams,
          }
        };
        setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? record : r));
        return;
      }
    }
    setShowSaveModal(true);
  };

  // 另存为：始终创建新记录
  const handleSaveAs = () => {
    setCurrentRecordId(null);
    setSaveTitle('');
    setShowSaveModal(true);
  };

  const handleLoadRecord = (record: ElectroRecord) => {
    setRawData(record.data.rawData || '');
    setAnalysisResult(record.data.analysisResult);
    setAiConclusion(record.data.aiConclusion);
    setAiDeepAnalysis(record.data.aiDeepAnalysis || null);
    setActiveMode(record.mode);
    setTafelFitRange(record.data.tafelFitRange || DEFAULT_TAFEL_FIT_RANGE);
    setTafelFitMode(record.data.tafelFitMode || 'auto');
    setElectroParams(record.data.params || DEFAULT_ELECTRO_PARAMS);
    setCurrentRecordId(record.id);
    setShowLibrary(false);
  };

  const handleDeleteRecord = (id: string) => {
    setSavedRecords(prev => prev.filter(r => r.id !== id));
    if (currentRecordId === id) setCurrentRecordId(null);
  };

  // 溯源进入时自动加载指定动力学记录
  useEffect(() => {
    if (!show || !traceRecordId || !savedRecords.length) return;
    if (traceLoadedRef.current === traceRecordId) return;
    const record = savedRecords.find(r => r.id === traceRecordId);
    if (!record) return;
    setRawData(record.data.rawData || '');
    setAnalysisResult(record.data.analysisResult);
    setAiConclusion(record.data.aiConclusion);
    setAiDeepAnalysis(record.data.aiDeepAnalysis || null);
    setActiveMode(record.mode);
    setTafelFitRange(record.data.tafelFitRange || DEFAULT_TAFEL_FIT_RANGE);
    setTafelFitMode(record.data.tafelFitMode || 'auto');
    setElectroParams(record.data.params || DEFAULT_ELECTRO_PARAMS);
    setCurrentRecordId(record.id);
    traceLoadedRef.current = traceRecordId;
  }, [show, traceRecordId, savedRecords]);

  // ==================== 样品对比 ====================

  const toggleCompareSample = (id: string) => {
    setCompareSampleIds(prev => {
      if (prev.includes(id)) return prev.filter(v => v !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  const compareSamples = useMemo<CompareSample[]>(() => {
    const items: CompareSample[] = [];
    compareSampleIds.forEach((id, idx) => {
      if (id === 'current' && analysisResult && processedData.length > 0) {
        items.push({
          id: 'current',
          title: '当前分析',
          mode: activeMode,
          result: analysisResult,
          data: processedData,
          color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
        });
      } else {
        const record = savedRecords.find(r => r.id === id);
        if (record?.data.analysisResult && record.data.processedData.length > 0) {
          items.push({
            id: record.id,
            title: record.title,
            mode: record.mode,
            result: record.data.analysisResult,
            data: record.data.processedData,
            color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
          });
        }
      }
    });
    return items;
  }, [compareSampleIds, analysisResult, processedData, savedRecords, activeMode]);

  // ==================== 全功能 DEMO ====================

  const handleLoadFullFeatureDemo = () => {
    // 生成全部 6 种模式的 DEMO 数据，以展示所有功能（包括催化专家面板的 ΔE 和雷达图）
    const allModes: EngineMode[] = ['LSV', 'OER', 'CV', 'ECSA', 'RDE', 'EIS'];
    const demoRecords: ElectroRecord[] = allModes.map((mode, idx) => {
      const modeData = generateElectroMockData(mode);
      const result = runElectroAnalysis(modeData, mode, DEFAULT_TAFEL_FIT_RANGE, DEFAULT_ELECTRO_PARAMS);
      return {
        id: `demo-${Date.now()}-${idx}`,
        title: `DEMO_${mode}_Sample`,
        mode,
        timestamp: new Date().toLocaleString(),
        data: {
          rawData: modeData.map(p => `${p.x}\t${p.y}`).join('\n'),
          processedData: modeData,
          analysisResult: result,
          aiConclusion: `${mode} 模式全功能示例分析。`,
          aiDeepAnalysis: null,
          tafelFitRange: DEFAULT_TAFEL_FIT_RANGE,
          tafelFitMode: 'auto' as FitMode,
          params: DEFAULT_ELECTRO_PARAMS,
        }
      };
    });

    setSavedRecords(prev => [...demoRecords, ...prev]);

    // 加载当前模式的数据
    const currentDemo = demoRecords.find(r => r.mode === activeMode) || demoRecords[0];
    const demoText = currentDemo.data.processedData.map(p => `${p.x}\t${p.y}`).join('\n');
    setRawData(demoText);

    // 自动执行分析
    setTimeout(() => {
      handleRunAnalysis();
    }, 100);

    // 自动选择对比（前4条）
    setTimeout(() => {
      const ids = ['current', ...demoRecords.slice(0, 3).map(r => r.id)];
      setCompareSampleIds(ids);
    }, 200);
  };

  // ==================== 文件上传 ====================

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setRawData(text);
      const { qc } = cleanAndValidateElectroData(text);
      setQcReport(qc);
      setAnalysisResult(null);
      setAiConclusion(null);
      setSensitivityGrid([]);
    } catch (err) { alert("读取失败"); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveToLog = (thumbnailUrl?: string) => {
    if (!targetProjectId || !targetMilestoneId) return;
    const folder = buildArchiveFolderMeta(projects, targetProjectId, targetMilestoneId, targetLogId);
    if (currentRecordId) {
      setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? { ...r, folder } : r));
    }
    const linkedRecord = currentRecordId ? savedRecords.find(r => r.id === currentRecordId) : null;
    const deepAnalysisData = {
      mode: activeMode, ...analysisResult, aiConclusion: stripLatexArtifacts(aiConclusion || ''),
      rawReport: stripLatexArtifacts(aiDeepAnalysis || ''),
      aiDeepAnalysis: stripLatexArtifacts(aiDeepAnalysis || ''),
      chartData: processedData.filter((_, i) => i % 5 === 0),
      thumbnailUrl,
      linkedAnalysisMeta: linkedRecord ? {
        id: linkedRecord.id,
        type: 'kinetics',
        title: linkedRecord.title
      } : undefined
    };
    onSave(targetProjectId, targetMilestoneId, targetLogId, deepAnalysisData);
    setSaveStep('idle');
  };

  const autoFitDomains = useCallback(() => {
    setXDomain(domains.x as [any, any]);
    setYDomain(domains.y as [any, any]);
  }, [domains]);

  const handleClearWorkspace = () => {
    if (!rawData && !analysisResult) return;
    if (!confirm('确定要清空动力学工作平台吗？未保存的数据和拟合结果将会丢失。')) return;
    setRawData('');
    setAnalysisResult(null);
    setAiConclusion(null);
    setAiDeepAnalysis(null);
    setIsDeepAnalysing(false);
    setQcReport(null);
    setSensitivityGrid([]);
    setCompareSampleIds([]);
    setCurrentRecordId(null);
    setSaveStep('idle');
    setPushToMatrix(false);
    setSelectedMatrixId('');
    setMatrixSampleId(`S-${Date.now().toString().slice(-6)}`);
    setMatrixNote('');
    setMatrixParams([]);
    setMatrixResults([]);
  };

  return {
    activeMode, setActiveMode, rawData, setRawData, isAnalysing, analysisResult, setAnalysisResult, aiConclusion, setAiConclusion, aiDeepAnalysis, isDeepAnalysing,
    saveStep, setSaveStep, targetProjectId, setTargetProjectId, targetMilestoneId, setTargetMilestoneId, targetLogId, setTargetLogId,
    pushToMatrix, setPushToMatrix, selectedMatrixId, setSelectedMatrixId, matrixSampleId, setMatrixSampleId, matrixNote, setMatrixNote, matrixParams, setMatrixParams, matrixResults, setMatrixResults,
    fileInputRef, selectedProject, selectedMilestone, processedData, chartConfig, domains: { x: xDomain, y: yDomain },
    handleRunAnalysis, handleSaveToLog, handleFileUpload, handleClearWorkspace,
    isEditMode, setIsEditMode, leftPanelMode, setLeftPanelMode, seriesSettingsId, setSeriesSettingsId,
    chartTitle, setChartTitle, xAxisLabel, setXAxisLabel, yAxisLabel, setYAxisLabel, chartType, setChartType, mainColor: mainStyle.color, setMainColor, pointColor: mainStyle.pointColor, setPointColor, strokeWidth: mainStyle.strokeWidth, setStrokeWidth, fontSize, setFontSize,
    axisLabelFontSize, setAxisLabelFontSize,
    pointShape: mainStyle.pointShape, setPointShape, pointSize: mainStyle.pointSize, setPointSize, aspectRatio, setAspectRatio, xDomain, setXDomain, yDomain, setYDomain,
    gridX, setGridX, gridY, setGridY, axisBox, setAxisBox, axisLineWidth, setAxisLineWidth, axisColor, setAxisColor,
    tickFontSize, setTickFontSize, tickSize, setTickSize, tickWidth, setTickWidth, xTickCount, setXTickCount, yTickCount, setYTickCount,
    xAxisDivision, setXAxisDivision, yAxisDivision, setYAxisDivision,
    labelFontFamily, setLabelFontFamily, labelFontWeight, setLabelFontWeight, labelFontStyle, setLabelFontStyle,
    titleFontFamily, setTitleFontFamily, titleFontWeight, setTitleFontWeight, titleFontStyle, setTitleFontStyle,
    tickFontFamily, setTickFontFamily, tickFontWeight, setTickFontWeight, tickFontStyle, setTickFontStyle,
    showXTicks, setShowXTicks, showYTicks, setShowYTicks, showMirroredTicks, setShowMirroredTicks,
    annotations, setAnnotations, activeTool, setActiveTool, legendPos, setLegendPos, xLabelPos, setXLabelPos, yLabelPos, setYLabelPos, titlePos, setTitlePos,
    seriesList, autoFitDomains, updateSeriesStyle,
    activeFontTab, setActiveFontTab,
    legendFontFamily, setLegendFontFamily, legendFontWeight, setLegendFontWeight,
    legendFontStyle, setLegendFontStyle, legendFontSize, setLegendFontSize,
    xScale, setXScale, yScale, setYScale,
    gridLineWidth, setGridLineWidth,
    showTemplateList, setShowTemplateList,
    legendBorderVisible, setLegendBorderVisible,
    legendBorderColor, setLegendBorderColor,
    legendBorderWidth, setLegendBorderWidth,
    // === 新增返回值 ===
    qcReport, electroParams, setElectroParams,
    tafelFitRange, setTafelFitRange, tafelFitMode, setTafelFitMode, activeTafelFitRange,
    sensitivityGrid,
    savedRecords, showLibrary, setShowLibrary, showSaveModal, setShowSaveModal,
    saveTitle, setSaveTitle, currentRecordId, handleSaveRecord, handleQuickSave, handleSaveAs, handleLoadRecord, handleDeleteRecord,
    saveMilestoneId, setSaveMilestoneId, saveLogId, setSaveLogId,
    compareSampleIds, toggleCompareSample, compareSamples,
    handleLoadFullFeatureDemo,
  };
};
