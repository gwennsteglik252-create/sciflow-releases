
import { useEffect, useCallback } from 'react';
import { useAsyncStorage } from './useAsyncStorage';
import {
  MechanismSession, FlowchartSession, DoeSession, InceptionSession,
  DataAnalysisSession, WritingSession, StructuralSession, TimelineSession, VisionSession,
  NotebookSession
} from '../types';
import { OMICS_DATA } from '../components/FigureCenter/Structure/constants';
import { calculateInitialPositions } from '../components/FigureCenter/Structure/utils';

export const useScientificSession = () => {
  // Add missing experimentalPriority: null to satisfy MechanismSession interface
  const [mechanismSession, setMechanismSession, isMechLoaded] = useAsyncStorage<MechanismSession>('mechanism_session', {
    pH: 14.0, potential: 1.23, reactionMode: 'OER', material: 'NiFe-LDH', unitCellType: 'Layered (LDH)', dopingElement: 'Fe', dopingConcentration: 5.0, coDopingElement: 'None', coDopingConcentration: 0, massLoading: 1.0, isProcessing: false, isStableAnalysis: true, analysisResult: null, experimentalPriority: null, physicalConstants: null, stabilityPrediction: null, morphologyLink: null
  }, 'kv');

  const [inceptionSession, setInceptionSession, isInceptionLoaded] = useAsyncStorage<InceptionSession>('inception_session', {
    stage: 'ideate', domain: '', suggestions: [], selectedTopic: null, landscape: null, review: null, isThinking: false
  }, 'kv');

  // 关键修复：选题变更拦截器
  useEffect(() => {
    if (inceptionSession.selectedTopic?.id) {
      // 如果选题 ID 发生变化，原子化重置下游情报数据，强制重新扫射
      setInceptionSession(prev => ({
        ...prev,
        landscape: null,
        hotnessData: undefined,
        review: null
      }));
    }
  }, [inceptionSession.selectedTopic?.id, setInceptionSession]);

  // 物理引擎：自动纠偏旧版单位胞命名
  useEffect(() => {
    if (isMechLoaded && mechanismSession.unitCellType === 'LDH 层状结构') {
      setMechanismSession(prev => ({ ...prev, unitCellType: 'Layered (LDH)' }));
    }
  }, [isMechLoaded, mechanismSession.unitCellType, setMechanismSession]);

  const updateInceptionSession = useCallback((updates: Partial<InceptionSession>) => {
    setInceptionSession(prev => ({ ...prev, ...updates }));
  }, [setInceptionSession]);

  const [flowchartSession, setFlowchartSession, isFlowLoaded] = useAsyncStorage<FlowchartSession>('flowchart_session', {
    description: '', currentFlowchart: null, scaleFactor: 1.0, targetTrl: 3, productionValue: 1, unitLabel: '克', includeMaterialCost: true, includeOperationCost: true, activeStepId: null,
    detailLevel: 'concise',
    optimizedParameters: [], controlParameters: []
  }, 'kv');

  const [doeSession, setDoeSession, isDoeLoaded] = useAsyncStorage<DoeSession>('doe_session', {
    factors: [], responses: [], processDescription: '', history: [], isCalculating: false, suggestion: null, loadedArchiveId: null
  }, 'kv');

  // 启动纠偏：如果 isCalculating 卡在 true（通常因为上次 AI 调用中断），自动重置
  useEffect(() => {
    if (isDoeLoaded && doeSession.isCalculating) {
      console.log('[DOE Session] Reconciling: resetting stuck isCalculating state');
      setDoeSession(prev => ({ ...prev, isCalculating: false }));
    }
  }, [isDoeLoaded]); // 仅在首次加载时执行

  const [dataAnalysisSession, setDataAnalysisSession, isDataLoaded] = useAsyncStorage<DataAnalysisSession>('data_analysis_session', {
    seriesList: [{
      id: 'initial_instance',
      name: '样本观测系列',
      data: [
        { name: '100', value: 22, error: 2 },
        { name: '150', value: 45, error: 3 },
        { name: '200', value: 88, error: 4 },
        { name: '250', value: 72, error: 3 },
        { name: '300', value: 35, error: 2 },
      ],
      color: '#4f46e5',
      pointColor: '#4f46e5',
      strokeWidth: 3.0,
      visible: true,
      pointShape: 'circle',
      pointSize: 5,
      showErrorBar: true,
      errorBarType: 'both'
    }],
    chartTitle: '实验观测曲线',
    xAxisLabel: '合成温度 (°C)',
    yAxisLabel: '催化活性 (UNIT)',
    chartType: 'line',
    strokeWidth: 3.0,
    mainColor: '#4f46e5',
    fontSize: 17,
    pointShape: 'circle',
    pointSize: 5,
    xDomain: [80, 320],
    yDomain: [0, 100],
    xScale: 'auto',
    yScale: 'auto',
    gridX: false,
    gridY: true,
    axisBox: false,
    legendPos: { x: 480, y: 40 },
    annotations: [],
    activeTab: 'chart',
    leftPanelMode: 'basic',
    aspectRatio: 1.33,
    axisColor: '#334155',
    axisLineWidth: 2.0,
    gridLineWidth: 1.5,
    tickFontSize: 14,
    tickSize: 6,
    tickWidth: 1.5,
    axisLabelFontSize: 20,
    xTickCount: 5,
    yTickCount: 5,
    titleFontFamily: 'inherit',
    titleFontWeight: 'black',
    titleFontStyle: 'italic',
    labelFontFamily: 'inherit',
    labelFontWeight: 'bold',
    labelFontStyle: 'normal',
    tickFontFamily: 'Arial, sans-serif',
    tickFontWeight: 'bold',
    tickFontStyle: 'normal',
    legendFontFamily: 'inherit',
    legendFontWeight: 'bold',
    legendFontStyle: 'normal',
    legendFontSize: 14,
    legendBorderVisible: true,
    legendBorderColor: '#e2e8f0',
    legendBorderWidth: 1,
    xLabelPos: { x: 0, y: 0 },
    yLabelPos: { x: 0, y: 0 },
    titlePos: { x: 0, y: 0 },
    showXTicks: true,
    showYTicks: true,
    showMirroredTicks: false,
    savedCharts: []
  }, 'kv');

  const [writingSession, setWritingSession, isWritingLoaded] = useAsyncStorage<WritingSession>('writing_session', {
    activeTab: 'materials',
    activeMediaSubTab: 'images',
    activeSectionId: 'abstract'
  }, 'kv');

  const [structuralSession, setStructuralSession, isStructuralLoaded] = useAsyncStorage<StructuralSession>('structural_session', {
    template: 'omics',
    data: OMICS_DATA,
    positions: calculateInitialPositions(OMICS_DATA),
    userPrompt: ''
  }, 'kv');

  const [timelineSession, setTimelineSession, isTimelineLoaded] = useAsyncStorage<TimelineSession>('timeline_session', {
    data: null,
    userPrompt: ''
  }, 'kv');

  const [visionSession, setVisionSession, isVisionLoaded] = useAsyncStorage<VisionSession>('vision_session', {
    imageSrc: null, mode: 'SEM', semMode: 'particle', temMode: 'lattice',
    scaleRatio: null, realLengthInput: '100', particles: [], xrdPeaks: [],
    sheetStats: null, latticeResult: null, defectStats: null, report: null,
    rawXrdData: [], xrdConfig: { wavelength: 0.15406, shapeFactor: 0.89 },
    savedArchives: [], aiReport: null, selectedXrdPeak: null, showStandardLine: false
  }, 'kv');

  const [notebookSession, setNotebookSession, isNotebookLoaded] = useAsyncStorage<NotebookSession>('notebook_session', {
    notes: [],
    activeTags: [],
    searchQuery: '',
    viewMode: 'grid',
    sortBy: 'updatedAt'
  }, 'kv');

  return {
    mechanismSession, updateMechanismSession: useCallback((u: any) => setMechanismSession(p => ({ ...p, ...u })), [setMechanismSession]),
    flowchartSession, updateFlowchartSession: useCallback((u: any) => setFlowchartSession(p => ({ ...p, ...u })), [setFlowchartSession]),
    doeSession, updateDoeSession: useCallback((u: any) => setDoeSession(p => ({ ...p, ...u })), [setDoeSession]),
    inceptionSession, updateInceptionSession,
    dataAnalysisSession, updateDataAnalysisSession: useCallback((u: any) => {
      if (typeof u === 'function') {
        setDataAnalysisSession((p: any) => ({ ...p, ...u(p) }));
      } else {
        setDataAnalysisSession((p: any) => ({ ...p, ...u }));
      }
    }, [setDataAnalysisSession]),
    writingSession, updateWritingSession: useCallback((u: any) => setWritingSession(p => ({ ...p, ...u })), [setWritingSession]),
    structuralSession, updateStructuralSession: useCallback((u: any) => setStructuralSession(p => ({ ...p, ...u })), [setStructuralSession]),
    timelineSession, updateTimelineSession: useCallback((u: any) => setTimelineSession(p => ({ ...p, ...u })), [setTimelineSession]),
    visionSession, updateVisionSession: useCallback((u: any) => setVisionSession(p => ({ ...p, ...u })), [setVisionSession]),
    notebookSession, updateNotebookSession: useCallback((u: any) => setNotebookSession(p => ({ ...p, ...u })), [setNotebookSession]),
    isSessionsReady: isMechLoaded && isFlowLoaded && isDoeLoaded && isInceptionLoaded && isDataLoaded && isWritingLoaded && isStructuralLoaded && isTimelineLoaded && isVisionLoaded && isNotebookLoaded
  };
};
