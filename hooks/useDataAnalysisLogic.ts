
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChartDataPoint, ResearchProject, ExperimentLog, Milestone, SampleEntry, AppView, DataSeries, ChartAnnotation, ExperimentFile, AnnotationType } from '../types';
import { SCIENTIFIC_THEMES, ScientificTheme } from '../ScientificThemes';
import { parseXrdData, detectPeaks, calculateScherrer, calculateBraggD, XrdPeak } from '../components/DataAnalysis/xrdUtils';
import { detectMetadata, extractChartStyleFromImage } from '../services/gemini/analysis';
import { useProjectContext } from '../context/ProjectContext';
import * as XLSX from 'xlsx';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';
import { printElement } from '../utils/printUtility';

export interface ChartTemplate {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'scatter' | 'area';
  color: string;
  colors?: string[]; // Provides distinct colors for multiple series mapping
  stroke: number;
  font: number;
  axisLabelFontSize?: number;
  chartTitle?: string;
  xLabel: string;
  yLabel: string;
  legendPos?: { x: number, y: number };
  description: string;
  pointShape?: 'circle' | 'sphere' | 'square' | 'diamond' | 'triangleUp' | 'triangleDown' | 'cross' | 'star' | 'none';
  pointSize?: number;
  aspectRatio?: number;
  gridX?: boolean;
  gridY?: boolean;
  gridLineWidth?: number;
  axisLineWidth?: number;
  axisColor?: string;
  axisBox?: boolean;
  tickFontSize?: number;
  tickSize?: number;
  tickWidth?: number;
  xTickCount?: number;
  yTickCount?: number;
  showXTicks?: boolean;
  showYTicks?: boolean;
  showMirroredTicks?: boolean;
  xScale?: 'auto' | 'log';
  yScale?: 'auto' | 'log';
  xAxisDivision?: number;
  yAxisDivision?: number;
  titleFontFamily?: string;
  titleFontWeight?: string;
  titleFontStyle?: string;
  labelFontFamily?: string;
  labelFontWeight?: string;
  labelFontStyle?: string;
  tickFontFamily?: string;
  tickFontWeight?: string;
  tickFontStyle?: string;
  legendFontFamily?: string;
  legendFontWeight?: string;
  legendFontStyle?: string;
  legendFontSize?: number;
  legendBorderVisible?: boolean;
  legendBorderColor?: string;
  legendBorderWidth?: number;
  showErrorBar?: boolean;
  errorBarType?: 'both' | 'plus';
  errorBarWidth?: number;
  errorBarStrokeWidth?: number;
  errorBarColor?: string;
  annotations?: ChartAnnotation[];
  dataType?: string;
  dataRequirement?: string;
  typicalExperiment?: string;
  isStandard?: boolean;
  thumbnailUrl?: string;
  // 每个系列独立的形态/几何/误差棒样式快照
  seriesStyles?: Array<{
    pointShape?: 'circle' | 'sphere' | 'square' | 'diamond' | 'triangleUp' | 'triangleDown' | 'cross' | 'star' | 'none';
    pointSize?: number;
    strokeWidth?: number;
    color?: string;
    pointColor?: string;
    showErrorBar?: boolean;
    errorBarType?: 'both' | 'plus';
    errorBarWidth?: number;
    errorBarStrokeWidth?: number;
    errorBarColor?: string;
  }>;
}

export const ACADEMIC_PALETTES = [
  { name: 'Nature Standard', colors: ['#e05252', '#4DBBD5', '#00A087', '#3C5488', '#e07a3a', '#7876B1', '#7E6148', '#B09C85', '#FFFFFF'] },
  { name: 'Science Clear', colors: ['#BC3C29', '#0072B5', '#E18727', '#20854E', '#7876B1', '#6F99AD', '#c4982a', '#be3d8a'] },
  { name: 'ACS / JACS', colors: ['#1a6b8a', '#1a8abd', '#2dbcad', '#0f7a6e', '#2a2a2a', '#D32F2F', '#1976D2'] },
  { name: 'Colorblind Friendly', colors: ['#E69F00', '#56B4E9', '#009E73', '#cc9900', '#0072B2', '#D55E00', '#CC79A7'] },
  { name: 'Modern Indigo', colors: ['#5254f0', '#7c3aed', '#d4368c', '#e03050', '#d97706', '#0e9e75'] },
  { name: 'Angew. Chem', colors: ['#E64B35', '#4DBBD5', '#00A087', '#3C5488', '#F39B7F', '#8491B4', '#91D1C2', '#DC0000'] },
  { name: 'Adv. Mater', colors: ['#0073C2', '#EFC000', '#868686', '#CD534C', '#7AA6DC', '#003C67', '#8F7700', '#3B3B3B'] },
  { name: 'Cell', colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#17BECF'] },
  { name: 'Lancet', colors: ['#00468B', '#ED0000', '#42B540', '#0099B4', '#925E9F', '#FDAF91', '#AD002A', '#ADB6B6'] },
  { name: 'PNAS', colors: ['#3182bd', '#e6550d', '#31a354', '#756bb1', '#636363', '#6baed6', '#fd8d3c', '#74c476'] },
  { name: 'Wiley', colors: ['#0C5DA5', '#FF2C00', '#00B945', '#FF9500', '#845B97', '#474747', '#9e9e9e', '#c20078'] },
  { name: 'RSC Royal', colors: ['#E21E26', '#1F407A', '#4CAE4E', '#F7941D', '#5C4A9F', '#F1592C', '#2BACE2', '#8B8C8E'] },
  { name: 'Chem. Rev.', colors: ['#c1272d', '#0071bc', '#f7931e', '#39b54a', '#93278f', '#29abe2', '#f15a24', '#662d91'] },
  { name: 'Energy Env. Sci.', colors: ['#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E', '#E6AB02', '#A6761D', '#666666'] },
  { name: 'Joule', colors: ['#2D3E50', '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22'] },
  { name: 'ACS Nano', colors: ['#005f73', '#0a9396', '#94d2bd', '#ee9b00', '#ca6702', '#bb3e03', '#ae2012', '#9b2226'] },
  { name: 'Matter', colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#606c38', '#283618', '#dda15e'] },
];


export const ACADEMIC_TEMPLATES: ChartTemplate[] = [
  {
    id: 't1',
    name: 'XRD 衍射图谱',
    type: 'line',
    color: '#1e293b',
    colors: ['#E64B35', '#4DBBD5', '#00A087', '#3C5488', '#F39B7F', '#8491B4', '#7E6148', '#B09C85'],
    stroke: 1.2,
    font: 12,
    axisLabelFontSize: 18,
    chartTitle: 'XRD 衍射能量分布图',
    xLabel: '2-Theta (deg)',
    yLabel: 'Intensity (a.u.)',
    legendPos: { x: 480, y: 40 },
    description: '高对比度细线风格，适合表征晶体结构。',
    pointShape: 'none',
    axisBox: true,
    gridX: false,
    gridY: false,
    dataType: '衍射能量分布',
    dataRequirement: '双列结构：X轴(2-Theta), Y轴(强度)',
    typicalExperiment: 'XRD / 高能物理衍射',
    isStandard: true
  }
];

const calculateNiceScale = (min: number, max: number, maxTicks: number): [number, number] => {
  if (min === max) return min === 0 ? [0, 1] : [min * 0.9, min * 1.1];
  const range = max - min;
  const roughStep = range / (maxTicks - 1);
  const exponent = Math.floor(Math.log10(roughStep));
  const fraction = roughStep / Math.pow(10, exponent);
  let niceStep: number;
  if (fraction < 1.5) niceStep = 1;
  else if (fraction < 3) niceStep = 2;
  else if (fraction < 7) niceStep = 5;
  else niceStep = 10;
  const step = niceStep * Math.pow(10, exponent);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  return [parseFloat(niceMin.toPrecision(12)), parseFloat(niceMax.toPrecision(12))];
};

const calculateLogDomain = (min: number, max: number): [number, number] => {
  const safeMin = min <= 0 ? 1e-6 : min;
  const safeMax = max <= safeMin ? safeMin * 10 : max;
  const floorPow = Math.floor(Math.log10(safeMin));
  const ceilPow = Math.ceil(Math.log10(safeMax));
  return [Math.pow(10, floorPow), Math.pow(10, ceilPow)];
};

export type FontTabType = 'title' | 'label' | 'tick' | 'legend';

export const useDataAnalysisLogic = (projects: ResearchProject[], onUpdateProject: (p: ResearchProject) => void, setAiStatus: any) => {
  const { showToast, dataAnalysisSession, updateDataAnalysisSession } = useProjectContext();

  const {
    savedCharts = [], chartFolders = [], seriesList = [], chartTitle = '实验观测曲线', xAxisLabel = 'X 轴', yAxisLabel = 'Y 轴', chartType = 'line', strokeWidth = 2, mainColor = '#4f46e5', fontSize = 14,
    pointShape = 'circle', pointSize = 5, xDomain = ['dataMin', 'dataMax'], yDomain = ['dataMin', 'dataMax'], xScale = 'auto', yScale = 'auto', gridX = false, gridY = false, axisBox = true, legendPos = { x: 0, y: 0 },
    annotations = [], activeTab: rawActiveTab = 'chart', leftPanelMode = 'basic', aspectRatio = 1.33, axisColor = '#334155', axisLineWidth = 1, gridLineWidth = 1,
    tickFontSize = 12, tickSize = 5, tickWidth = 1, axisLabelFontSize = 14, xTickCount = 5, yTickCount = 5, titleFontFamily = 'inherit',
    titleFontWeight = 'bold', titleFontStyle = 'normal', labelFontFamily = 'inherit', labelFontWeight = 'bold', labelFontStyle = 'normal',
    tickFontFamily = 'inherit', tickFontWeight = 'normal', tickFontStyle = 'normal', legendFontFamily = 'inherit', legendFontWeight = 'normal',
    legendFontStyle = 'normal', legendFontSize = 12,
    legendBorderVisible = true, legendBorderColor = '#e2e8f0', legendBorderWidth = 1,
    xLabelPos = { x: 0, y: 0 }, yLabelPos = { x: 0, y: 0 }, titlePos = { x: 0, y: 0 }, showXTicks = true, showYTicks = true, showMirroredTicks = false
  } = (dataAnalysisSession || {}) as Partial<typeof dataAnalysisSession>;

  // Backward compat: old sessions may persist 'vision' which was removed
  const activeTab = ((rawActiveTab as string) === 'vision' ? 'chart' : rawActiveTab) as 'chart' | 'mimic';

  const setSeriesList = (val: any) => {
    if (typeof val === 'function') {
      updateDataAnalysisSession((p: any) => ({ seriesList: val(p.seriesList || []) }));
    } else {
      updateDataAnalysisSession({ seriesList: val });
    }
  };
  const setChartTitle = (val: string) => updateDataAnalysisSession({ chartTitle: val });
  const setXAxisLabel = (val: string) => updateDataAnalysisSession({ xAxisLabel: val });
  const setYAxisLabel = (val: string) => updateDataAnalysisSession({ yAxisLabel: val });
  const setChartType = (val: any) => updateDataAnalysisSession({ chartType: val });
  const setStrokeWidth = (val: number) => updateDataAnalysisSession({ strokeWidth: val });
  const setMainColor = (val: string) => updateDataAnalysisSession({ mainColor: val });
  const setFontSize = (val: number) => updateDataAnalysisSession({ fontSize: val });
  const setPointShape = (val: any) => updateDataAnalysisSession({ pointShape: val });
  const setPointSize = (val: number) => updateDataAnalysisSession({ pointSize: val });
  const setXDomain = (val: any) => updateDataAnalysisSession({ xDomain: val });
  const setYDomain = (val: any) => updateDataAnalysisSession({ yDomain: val });
  const setXScale = (val: any) => updateDataAnalysisSession({ xScale: val });
  const setYScale = (val: any) => updateDataAnalysisSession({ yScale: val });
  const setGridX = (val: boolean) => updateDataAnalysisSession({ gridX: val });
  const setGridY = (val: boolean) => updateDataAnalysisSession({ gridY: val });
  const setAxisBox = (val: boolean) => updateDataAnalysisSession({ axisBox: val });
  const setLegendPos = (val: any) => updateDataAnalysisSession({ legendPos: val });
  const setAnnotations = (val: any) => {
    if (typeof val === 'function') {
      updateDataAnalysisSession((p: any) => ({ annotations: val(p.annotations || []) }));
    } else {
      updateDataAnalysisSession({ annotations: val });
    }
  };
  const setActiveTab = (val: any) => updateDataAnalysisSession({ activeTab: val });
  const setLeftPanelMode = (val: any) => updateDataAnalysisSession({ leftPanelMode: val });
  const setAspectRatio = (val: number) => updateDataAnalysisSession({ aspectRatio: val });
  const setAxisColor = (val: string) => updateDataAnalysisSession({ axisColor: val });
  const setAxisLineWidth = (val: number) => updateDataAnalysisSession({ axisLineWidth: val });
  const setGridLineWidth = (val: number) => updateDataAnalysisSession({ gridLineWidth: val });
  const setTickFontSize = (val: number) => updateDataAnalysisSession({ tickFontSize: val });
  const setTickSize = (val: number) => updateDataAnalysisSession({ tickSize: val });
  const setTickWidth = (val: number) => updateDataAnalysisSession({ tickWidth: val });
  const setAxisLabelFontSize = (val: number) => updateDataAnalysisSession({ axisLabelFontSize: val });
  const setXTickCount = (val: number) => updateDataAnalysisSession({ xTickCount: val });
  const setYTickCount = (val: number) => updateDataAnalysisSession({ yTickCount: val });
  const setTitleFontFamily = (val: string) => updateDataAnalysisSession({ titleFontFamily: val });
  const setTitleFontWeight = (val: string) => updateDataAnalysisSession({ titleFontWeight: val });
  const setTitleFontStyle = (val: string) => updateDataAnalysisSession({ titleFontStyle: val });
  const setLabelFontFamily = (val: string) => updateDataAnalysisSession({ labelFontFamily: val });
  const setLabelFontWeight = (val: string) => updateDataAnalysisSession({ labelFontWeight: val });
  const setLabelFontStyle = (val: string) => updateDataAnalysisSession({ labelFontStyle: val });
  const setTickFontFamily = (val: string) => updateDataAnalysisSession({ tickFontFamily: val });
  const setTickFontWeight = (val: string) => updateDataAnalysisSession({ tickFontWeight: val });
  const setTickFontStyle = (val: string) => updateDataAnalysisSession({ tickFontStyle: val });
  const setLegendFontFamily = (val: string) => updateDataAnalysisSession({ legendFontFamily: val });
  const setLegendFontWeight = (val: string) => updateDataAnalysisSession({ legendFontWeight: val });
  const setLegendFontStyle = (val: string) => updateDataAnalysisSession({ legendFontStyle: val });
  const setLegendFontSize = (val: number) => updateDataAnalysisSession({ legendFontSize: val });
  const setLegendBorderVisible = (val: boolean) => updateDataAnalysisSession({ legendBorderVisible: val });
  const setLegendBorderColor = (val: string) => updateDataAnalysisSession({ legendBorderColor: val });
  const setLegendBorderWidth = (val: number) => updateDataAnalysisSession({ legendBorderWidth: val });
  const setXLabelPos = (val: any) => updateDataAnalysisSession({ xLabelPos: val });
  const setYLabelPos = (val: any) => updateDataAnalysisSession({ yLabelPos: val });
  const setTitlePos = (val: any) => updateDataAnalysisSession({ titlePos: val });
  const setShowXTicks = (val: boolean) => updateDataAnalysisSession({ showXTicks: val });
  const setShowYTicks = (val: boolean) => updateDataAnalysisSession({ showYTicks: val });
  const setShowMirroredTicks = (val: boolean) => updateDataAnalysisSession({ showMirroredTicks: val });

  // Transient state (not in session)
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeScientificTheme, setActiveScientificTheme] = useState<string | null>(null);
  const [activeFontTab, setActiveFontTab] = useState<FontTabType>('label');
  const [yZoom, setYZoom] = useState(1.0);
  const [xAxisDivision, setXAxisDivision] = useState(1);
  const [yAxisDivision, setYAxisDivision] = useState(1);
  const [activeTool, setActiveTool] = useState<AnnotationType | 'select' | 'none'>('none');
  const [seriesSettingsId, setSeriesSettingsIdInternal] = useState<string | null>(null);
  const [showAssociateModal, setShowAssociateModal] = useState(false);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showEcoEngine, setShowEcoEngine] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [showChartLibraryModal, setShowChartLibraryModal] = useState(false);
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [isDiscoveringTemplate, setIsDiscoveringTemplate] = useState(false);

  const [userTemplates, setUserTemplates] = useState<ChartTemplate[]>(() => {
    const saved = localStorage.getItem('sciflow_user_chart_tpls');
    return saved ? JSON.parse(saved) : [];
  });
  const chartContainerRef = useRef<HTMLDivElement>(null!);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const titleInputRef = useRef<HTMLInputElement>(null!);
  const xLabelInputRef = useRef<HTMLInputElement>(null!);
  const yLabelInputRef = useRef<HTMLInputElement>(null!);

  const setSeriesSettingsId = useCallback((id: string | null) => {
    setSeriesSettingsIdInternal(id);
    setLeftPanelMode(id ? 'series' : 'basic');
  }, []);

  const openAxisSettings = useCallback((tab: FontTabType) => {
    setLeftPanelMode('axis');
    setActiveFontTab(tab);
  }, []);

  const computedAutoDomains = useMemo(() => {
    const visibleData = (seriesList || []).filter(s => s.visible).flatMap(s => s.data || []);
    if (visibleData.length === 0) return { x: [0, 100] as [number, number], y: [0, 100] as [number, number] };
    const allX = visibleData.map(d => parseFloat(d.name)).filter(v => !isNaN(v));
    const allY = visibleData.map(d => d.value).filter(v => !isNaN(v));

    let minX = Math.min(...allX);
    let maxX = Math.max(...allX);
    let minY = Math.min(...allY);
    let maxY = Math.max(...allY);

    if (xScale === 'log') {
      const domain = calculateLogDomain(minX, maxX);
      minX = domain[0]; maxX = domain[1];
    }
    if (yScale === 'log') {
      const domain = calculateLogDomain(minY, maxY);
      minY = domain[0]; maxY = domain[1];
    }

    const finalX = xScale === 'log' ? [minX, maxX] : calculateNiceScale(minX, maxX, xTickCount);
    const midY = (minY + maxY) / 2;
    const rawRangeY = maxY - minY || (maxY === 0 ? 1 : Math.abs(maxY) * 0.1);
    const zoomedRangeY = rawRangeY * (2 - yZoom);
    const finalY = yScale === 'log' ? [minY, maxY] : calculateNiceScale(midY - zoomedRangeY / 2, midY + zoomedRangeY / 2, yTickCount);

    return { x: finalX as [number, number], y: finalY as [number, number] };
  }, [seriesList, yZoom, xTickCount, yTickCount, xScale, yScale]);

  const autoFitDomains = useCallback(() => {
    setXDomain(computedAutoDomains.x);
    setYDomain(computedAutoDomains.y);
  }, [computedAutoDomains]);

  const applyTemplate = (tpl: ChartTemplate) => {
    const sessionUpdates: any = {
      chartType: tpl.type,
      mainColor: tpl.color,
      strokeWidth: tpl.stroke,
      fontSize: tpl.font,
    };

    // Map template properties到会话状态（只有模板里有值才覆盖）
    if (tpl.xLabel !== undefined) sessionUpdates.xAxisLabel = tpl.xLabel;
    if (tpl.yLabel !== undefined) sessionUpdates.yAxisLabel = tpl.yLabel;
    if (tpl.chartTitle !== undefined) sessionUpdates.chartTitle = tpl.chartTitle;
    if (tpl.axisLabelFontSize !== undefined) sessionUpdates.axisLabelFontSize = tpl.axisLabelFontSize;
    if (tpl.legendPos !== undefined) sessionUpdates.legendPos = tpl.legendPos;
    if (tpl.pointShape !== undefined) sessionUpdates.pointShape = tpl.pointShape;
    if (tpl.pointSize !== undefined) sessionUpdates.pointSize = tpl.pointSize;
    if (tpl.aspectRatio !== undefined) sessionUpdates.aspectRatio = tpl.aspectRatio;
    if (tpl.gridX !== undefined) sessionUpdates.gridX = tpl.gridX;
    if (tpl.gridY !== undefined) sessionUpdates.gridY = tpl.gridY;
    if (tpl.gridLineWidth !== undefined) sessionUpdates.gridLineWidth = tpl.gridLineWidth;
    if (tpl.axisLineWidth !== undefined) sessionUpdates.axisLineWidth = tpl.axisLineWidth;
    if (tpl.axisColor !== undefined) sessionUpdates.axisColor = tpl.axisColor;
    if (tpl.axisBox !== undefined) sessionUpdates.axisBox = tpl.axisBox;
    if (tpl.tickFontSize !== undefined) sessionUpdates.tickFontSize = tpl.tickFontSize;
    if (tpl.tickSize !== undefined) sessionUpdates.tickSize = tpl.tickSize;
    if (tpl.tickWidth !== undefined) sessionUpdates.tickWidth = tpl.tickWidth;
    if (tpl.xTickCount !== undefined) sessionUpdates.xTickCount = tpl.xTickCount;
    if (tpl.yTickCount !== undefined) sessionUpdates.yTickCount = tpl.yTickCount;
    if (tpl.showXTicks !== undefined) sessionUpdates.showXTicks = tpl.showXTicks;
    if (tpl.showYTicks !== undefined) sessionUpdates.showYTicks = tpl.showYTicks;
    if (tpl.showMirroredTicks !== undefined) sessionUpdates.showMirroredTicks = tpl.showMirroredTicks;
    if (tpl.xScale !== undefined) sessionUpdates.xScale = tpl.xScale;
    if (tpl.yScale !== undefined) sessionUpdates.yScale = tpl.yScale;

    // 这些目前是 hook 内部 useState，需要显式同步
    if (tpl.xAxisDivision !== undefined) {
      sessionUpdates.xAxisDivision = tpl.xAxisDivision;
      setXAxisDivision(tpl.xAxisDivision);
    }
    if (tpl.yAxisDivision !== undefined) {
      sessionUpdates.yAxisDivision = tpl.yAxisDivision;
      setYAxisDivision(tpl.yAxisDivision);
    }

    // 字体相关
    if (tpl.titleFontFamily !== undefined) sessionUpdates.titleFontFamily = tpl.titleFontFamily;
    if (tpl.titleFontWeight !== undefined) sessionUpdates.titleFontWeight = tpl.titleFontWeight;
    if (tpl.titleFontStyle !== undefined) sessionUpdates.titleFontStyle = tpl.titleFontStyle;
    if (tpl.labelFontFamily !== undefined) sessionUpdates.labelFontFamily = tpl.labelFontFamily;
    if (tpl.labelFontWeight !== undefined) sessionUpdates.labelFontWeight = tpl.labelFontWeight;
    if (tpl.labelFontStyle !== undefined) sessionUpdates.labelFontStyle = tpl.labelFontStyle;
    if (tpl.tickFontFamily !== undefined) sessionUpdates.tickFontFamily = tpl.tickFontFamily;
    if (tpl.tickFontWeight !== undefined) sessionUpdates.tickFontWeight = tpl.tickFontWeight;
    if (tpl.tickFontStyle !== undefined) sessionUpdates.tickFontStyle = tpl.tickFontStyle;
    if (tpl.legendFontFamily !== undefined) sessionUpdates.legendFontFamily = tpl.legendFontFamily;
    if (tpl.legendFontWeight !== undefined) sessionUpdates.legendFontWeight = tpl.legendFontWeight;
    if (tpl.legendFontStyle !== undefined) sessionUpdates.legendFontStyle = tpl.legendFontStyle;
    if (tpl.legendFontSize !== undefined) sessionUpdates.legendFontSize = tpl.legendFontSize;
    if (tpl.legendBorderVisible !== undefined) sessionUpdates.legendBorderVisible = tpl.legendBorderVisible;
    if (tpl.legendBorderColor !== undefined) sessionUpdates.legendBorderColor = tpl.legendBorderColor;
    if (tpl.legendBorderWidth !== undefined) sessionUpdates.legendBorderWidth = tpl.legendBorderWidth;

    // 系列样式覆盖：优先使用 seriesStyles 中保存的逐系列快照，回退到全局模板属性
    sessionUpdates.seriesList = seriesList.map((s, index) => {
      const perSeriesStyle = tpl.seriesStyles?.[index];
      const tplColorForSeries =
        perSeriesStyle?.color
        ?? (tpl.colors && tpl.colors.length > 0
          ? tpl.colors[index % tpl.colors.length]
          : tpl.color);

      return {
        ...s,
        color: tplColorForSeries || s.color,
        pointColor: perSeriesStyle?.pointColor ?? tplColorForSeries ?? s.pointColor,
        strokeWidth: perSeriesStyle?.strokeWidth ?? tpl.stroke ?? s.strokeWidth,
        pointShape: perSeriesStyle?.pointShape ?? tpl.pointShape ?? s.pointShape,
        pointSize: perSeriesStyle?.pointSize ?? tpl.pointSize ?? s.pointSize,
        showErrorBar: perSeriesStyle?.showErrorBar ?? tpl.showErrorBar ?? s.showErrorBar,
        errorBarType: perSeriesStyle?.errorBarType ?? tpl.errorBarType ?? s.errorBarType,
        errorBarWidth: perSeriesStyle?.errorBarWidth ?? tpl.errorBarWidth ?? s.errorBarWidth,
        errorBarStrokeWidth: perSeriesStyle?.errorBarStrokeWidth ?? tpl.errorBarStrokeWidth ?? s.errorBarStrokeWidth,
        errorBarColor: perSeriesStyle?.errorBarColor ?? tpl.errorBarColor ?? s.errorBarColor,
      };
    });

    // 注释（如果模板里带有）会直接替换当前注释层
    if (tpl.annotations) {
      sessionUpdates.annotations = tpl.annotations;
    }

    updateDataAnalysisSession(sessionUpdates);
  };

  const handleDiscoverTemplate = useCallback(async () => {
    if (!templateSearchQuery.trim()) return;
    setIsDiscoveringTemplate(true);
    showToast({ message: `AI 正在检索并建模 [${templateSearchQuery}] 的制图规范...`, type: 'info' });

    setTimeout(() => {
      setIsDiscoveringTemplate(false);
      const discoveredTpl: ChartTemplate = {
        id: `discovered_${Date.now()}`,
        name: `${templateSearchQuery} 规范`,
        type: 'line',
        color: '#334155',
        stroke: 1.5,
        font: 14,
        xLabel: 'X-Axis',
        yLabel: 'Y-Axis',
        description: 'AI 自动从学术数据库建模的视觉规范',
        dataType: templateSearchQuery,
        dataRequirement: '标准双列数据',
        typicalExperiment: 'Generic Academic Standard'
      };
      setUserTemplates(prev => [discoveredTpl, ...prev]);
      localStorage.setItem('sciflow_user_chart_tpls', JSON.stringify([discoveredTpl, ...userTemplates]));
      showToast({ message: "规范提取完成，已生成新模板项", type: 'success' });
    }, 2000);
  }, [templateSearchQuery, showToast, userTemplates]);

  const handleDiscoverTemplateFromImage = useCallback(async (file: File) => {
    setIsDiscoveringTemplate(true);
    showToast({ message: "正在深度解构上传图谱的视觉 DNA...", type: 'info' });

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64 = await base64Promise;
      const style = await extractChartStyleFromImage(base64);

      if (style) {
        const discoveredTpl: ChartTemplate = {
          id: `img_dna_${Date.now()}`,
          name: `复刻: ${file.name.replace(/\.[^/.]+$/, "")}`,
          type: (style.chartType as any) || 'line',
          color: style.colors?.[0] || '#4f46e5',
          stroke: style.strokeWidth || 2,
          font: 14,
          xLabel: style.xLabel || 'X-Axis',
          yLabel: style.yLabel || 'Y-Axis',
          description: 'AI 逆向分析图谱得出的视觉模板',
          pointShape: (style.pointShape as any) || 'circle',
          thumbnailUrl: base64, // 保存缩略图
          isStandard: false
        };
        const newList = [discoveredTpl, ...userTemplates];
        setUserTemplates(newList);
        localStorage.setItem('sciflow_user_chart_tpls', JSON.stringify(newList));
        showToast({ message: "视觉风格提取成功，已存入模板库", type: 'success' });
      }
    } catch (e) {
      showToast({ message: "识图失败", type: 'error' });
    } finally {
      setIsDiscoveringTemplate(false);
    }
  }, [userTemplates, showToast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    let newlyAdded = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let dataPoints: ChartDataPoint[] = [];
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.xy')) {
          const text = await file.text();
          const rawParsed = parseXrdData(text);
          dataPoints = rawParsed.map(d => ({ name: String(d.x), value: d.y, error: d.z || 0 }));
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          dataPoints = jsonData
            .filter(row => row.length >= 2 && !isNaN(parseFloat(String(row[0]))) && !isNaN(parseFloat(String(row[1]))))
            .map(row => ({ name: String(row[0]), value: parseFloat(String(row[1])), error: parseFloat(String(row[2])) || 0 }));
        }
        if (dataPoints.length > 0) {
          const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];
          const newColor = colors[seriesList.length % colors.length];
          setSeriesList((prev: any[]) => [...prev, { id: Date.now().toString() + i, name: file.name.replace(/\.[^/.]+$/, ""), data: dataPoints, color: newColor, pointColor: newColor, strokeWidth, visible: true, pointShape, pointSize, showErrorBar: true, errorBarType: 'both' }]);
          newlyAdded = true;
        }
      } catch (err) { console.error(err); }
    }
    if (newlyAdded) setTimeout(autoFitDomains, 50);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportChart = async () => {
    const targetEl = chartContainerRef.current;
    if (!targetEl) return;
    setIsExporting(true);
    showToast({ message: "正在生成高清 PDF 文档...", type: 'info' });
    try {
      await printElement(targetEl, `${chartTitle || 'SciFlow_Analysis'}_Export`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveDeepAnalysis = (projectId: string, milestoneId: string, logId: string, data: any) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const metrics: Record<string, number> = {};
    if (data.halfWavePotential) metrics['Half Wave Potential (V vs. RHE)'] = data.halfWavePotential;
    if (data.tafelSlope) metrics['Tafel Slope (mV/dec)'] = data.tafelSlope;
    if (data.limitingCurrent) metrics['Limiting Current (mA/cm²)'] = data.limitingCurrent;
    if (data.cdl) metrics['Cdl (mF)'] = data.cdl;
    if (data.ecsa) metrics['ECSA (cm²)'] = data.ecsa;
    if (data.roughnessFactor) metrics['Roughness Factor'] = data.roughnessFactor;
    if (data.electronTransferNum) metrics['n (electron transfer)'] = data.electronTransferNum;
    if (data.kineticCurrent) metrics['Kinetic Current (mA/cm²)'] = data.kineticCurrent;
    if (data.rs) metrics['Rs (Ω)'] = data.rs;
    if (data.rct) metrics['Rct (Ω)'] = data.rct;
    const moduleId = `kinetics-${String(data.mode || 'electro').toLowerCase()}`;
    const syncedModuleEntry = {
      moduleId,
      moduleLabel: '动力学解算',
      mode: String(data.mode || 'KINETICS'),
      summary: data.aiConclusion || data.summary || '动力学分析已同步',
      thumbnailUrl: data.thumbnailUrl,
      generatedAt: new Date().toISOString(),
      metrics
    };

    const updatedMilestones = project.milestones.map(m => {
      if (m.id !== milestoneId) return m;

      let nextLogs;
      if (logId === 'NEW_LOG') {
        const newLog: ExperimentLog = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
          content: `[动力学解算] ${data.mode} 深度分析`,
          description: data.aiConclusion || '同步自电化学解析引擎。',
          parameters: `Mode: ${data.mode}`,
          status: 'Verified',
          result: 'success',
          deepAnalysis: {
            ...data,
            syncedModules: [syncedModuleEntry],
            lastSyncedModuleId: moduleId
          },
          scientificData: metrics
        };
        nextLogs = [newLog, ...m.logs];
      } else {
        nextLogs = m.logs.map(l => {
          if (l.id === logId) {
            const prevDeep = l.deepAnalysis || {};
            const prevModules = Array.isArray(prevDeep.syncedModules) ? prevDeep.syncedModules : [];
            return {
              ...l,
              deepAnalysis: {
                ...prevDeep,
                ...data,
                syncedModules: [syncedModuleEntry, ...prevModules.filter((it: any) => String(it?.moduleId) !== moduleId)],
                lastSyncedModuleId: moduleId
              },
              scientificData: { ...l.scientificData, ...metrics }
            };
          }
          return l;
        });
      }
      return { ...m, logs: nextLogs };
    });

    onUpdateProject({ ...project, milestones: updatedMilestones });
    showToast({ message: '分析结论与原子化性能指标已成功同步', type: 'success' });
  };

  const isSeriesValid = seriesSettingsId && seriesList.some(s => s.id === seriesSettingsId);
  const safeLeftPanelMode = (leftPanelMode === 'series' && !isSeriesValid) ? 'basic' : leftPanelMode;

  return {
    state: { savedCharts, chartFolders, showChartLibraryModal, seriesList, aiInsight, isAnalyzing, isExporting, activeTab, chartTitle, xAxisLabel, yAxisLabel, chartType, strokeWidth, mainColor, fontSize, axisLabelFontSize, pointShape, pointSize, activeScientificTheme, xDomain, yDomain, xScale, yScale, yZoom, gridX, gridY, gridLineWidth, axisLineWidth, axisColor, axisBox, tickFontSize, tickSize, tickWidth, xTickCount, yTickCount, xAxisDivision, yAxisDivision, labelFontFamily, labelFontWeight, labelFontStyle, titleFontFamily, titleFontWeight, titleFontStyle, tickFontFamily, tickFontWeight, tickFontStyle, legendFontFamily, legendFontWeight, legendFontStyle, legendFontSize, legendBorderVisible, legendBorderColor, legendBorderWidth, activeFontTab, showXTicks, showYTicks, showMirroredTicks, xLabelPos, yLabelPos, titlePos, annotations, activeTool, legendPos, seriesSettingsId, showAssociateModal, showTemplateList, showSaveTemplateModal, showEcoEngine, userTemplates, leftPanelMode: safeLeftPanelMode, aspectRatio, templateSearchQuery, isDiscoveringTemplate, computedAutoDomains, showGalleryModal },
    refs: { chartContainerRef, fileInputRef, titleInputRef, xLabelInputRef, yLabelInputRef },
    actions: {
      setSeriesList, setAiInsight, setIsAnalyzing, setIsExporting, setActiveTab, setChartTitle, setXAxisLabel, setYAxisLabel, setChartType, setStrokeWidth, setMainColor, setFontSize, setAxisLabelFontSize, setPointShape, setPointSize, setActiveScientificTheme, setXDomain, setYDomain, setXScale, setYScale, setYZoom, setGridX, setGridY, setGridLineWidth, setAxisLineWidth, setAxisColor, setAxisBox, setTickFontSize, setTickSize, setTickWidth, setXTickCount, setYTickCount, setXAxisDivision, setYAxisDivision, setLabelFontFamily, setLabelFontWeight, setLabelFontStyle, setTitleFontFamily, setTitleFontWeight, setTitleFontStyle, setTickFontFamily, setTickFontWeight, setTickFontStyle, setLegendFontFamily, setLegendFontWeight, setLegendFontStyle, setLegendFontSize, setLegendBorderVisible, setLegendBorderColor, setLegendBorderWidth, setActiveFontTab, setShowXTicks, setShowYTicks, setShowMirroredTicks, setXLabelPos, setYLabelPos, setTitlePos, setAnnotations, addAnnotation: (a: any) => setAnnotations((prev: any[]) => [...prev, a]), updateAnnotation: (id: string, u: any) => setAnnotations((prev: any[]) => prev.map((a: any) => a.id === id ? { ...a, ...u } : a)), removeAnnotation: (id: string) => setAnnotations((prev: any[]) => prev.filter((a: any) => a.id !== id)), setActiveTool, setLegendPos, setSeriesSettingsId, setShowAssociateModal, setShowTemplateList, setShowSaveTemplateModal, setShowEcoEngine, handleFileUpload, removeSeries: (id: string) => setSeriesList((prev: any[]) => prev.filter((s: any) => s.id !== id)), updateSeries: (id: string, u: any) => setSeriesList((prev: any[]) => prev.map((s: any) => s.id === id ? { ...s, ...u } : s)), updateAllSeries: (u: any) => setSeriesList((prev: any[]) => prev.map((s: any) => ({ ...s, ...u }))), applyPalette: (c: string[]) => setSeriesList((prev: any[]) => prev.map((s: any, i: number) => ({ ...s, color: c[i % c.length], pointColor: c[i % c.length] }))), applyScientificTheme: (t: any) => { setActiveScientificTheme(t.id); applyTemplate(t.chartConfig); },
      handleSaveCurrentTemplate: async (name: string) => {
        let thumbnailUrl = undefined;
        if (chartContainerRef.current) {
          try {
            // Target the responsive wrapper for better coordinate accuracy, avoid font-fetching layout shifts
            const targetNode = chartContainerRef.current.querySelector('.lab-chart-responsive') as HTMLElement || chartContainerRef.current;
            thumbnailUrl = await htmlToImage.toPng(targetNode, {
              quality: 0.9,
              backgroundColor: '#ffffff',
              pixelRatio: 2,
              skipFonts: true
            });
          } catch (e) {
            console.error('Failed to capture template thumbnail', e);
          }
        }

        // 收集当前图像的“完整样式 DNA”用于模板复用
        const paletteFromSeries = (seriesList || [])
          .map(s => s.color || s.pointColor)
          .filter(Boolean) as string[];

        const baseErrorSeries = (seriesList || []).find(s => s.showErrorBar);

        const nt: ChartTemplate = {
          id: Date.now().toString(),
          name,
          type: chartType,
          color: mainColor,
          colors: paletteFromSeries.length > 0 ? paletteFromSeries : undefined,
          stroke: strokeWidth,
          font: fontSize,
          axisLabelFontSize,
          chartTitle,
          xLabel: xAxisLabel,
          yLabel: yAxisLabel,
          legendPos,
          description: 'User saved style snapshot',
          pointShape,
          pointSize,
          aspectRatio,
          gridX,
          gridY,
          gridLineWidth,
          axisLineWidth,
          axisColor,
          axisBox,
          tickFontSize,
          tickSize,
          tickWidth,
          xTickCount,
          yTickCount,
          showXTicks,
          showYTicks,
          showMirroredTicks,
          xScale,
          yScale,
          xAxisDivision,
          yAxisDivision,
          titleFontFamily,
          titleFontWeight,
          titleFontStyle,
          labelFontFamily,
          labelFontWeight,
          labelFontStyle,
          tickFontFamily,
          tickFontWeight,
          tickFontStyle,
          legendFontFamily,
          legendFontWeight,
          legendFontStyle,
          legendFontSize,
          showErrorBar: baseErrorSeries?.showErrorBar,
          errorBarType: baseErrorSeries?.errorBarType,
          errorBarWidth: (baseErrorSeries as any)?.errorBarWidth,
          errorBarStrokeWidth: (baseErrorSeries as any)?.errorBarStrokeWidth,
          errorBarColor: (baseErrorSeries as any)?.errorBarColor || baseErrorSeries?.color,
          annotations,
          isStandard: false,
          thumbnailUrl,
          // 保存每个系列独立的形态与几何细节快照
          seriesStyles: (seriesList || []).map(s => ({
            pointShape: s.pointShape,
            pointSize: s.pointSize,
            strokeWidth: s.strokeWidth,
            color: s.color,
            pointColor: s.pointColor,
            showErrorBar: s.showErrorBar,
            errorBarType: s.errorBarType,
            errorBarWidth: s.errorBarWidth,
            errorBarStrokeWidth: s.errorBarStrokeWidth,
            errorBarColor: s.errorBarColor,
          }))
        };
        const newList = [nt, ...userTemplates];
        setUserTemplates(newList);
        localStorage.setItem('sciflow_user_chart_tpls', JSON.stringify(newList));
        showToast({ message: `模板 [${name}] 保存成功`, type: 'success' });
      },
      saveChartToLibrary: async (name: string, folderId?: string) => {
        let thumbnailUrl = undefined;
        if (chartContainerRef.current) {
          try {
            const targetNode = chartContainerRef.current.querySelector('.lab-chart-responsive') as HTMLElement || chartContainerRef.current;
            thumbnailUrl = await htmlToImage.toPng(targetNode, {
              quality: 0.9, backgroundColor: '#ffffff', pixelRatio: 2, skipFonts: true
            });
          } catch (e) { console.error('Failed to capture template thumbnail', e); }
        }

        const currentSession = { ...dataAnalysisSession };
        delete currentSession.savedCharts;
        delete currentSession.chartFolders;

        const newChart: any = {
          id: `chart_${Date.now()}`,
          name,
          timestamp: new Date().toLocaleString(),
          thumbnailUrl,
          folderId,
          sessionData: currentSession
        };

        updateDataAnalysisSession({ savedCharts: [newChart, ...(savedCharts || [])] });
        showToast({ message: `记录 [${name}] 已保存至库中`, type: 'success' });
      },
      loadChartFromLibrary: (id: string) => {
        const chart = savedCharts?.find((c: any) => c.id === id);
        if (chart && chart.sessionData) {
          updateDataAnalysisSession({ ...chart.sessionData });
          showToast({ message: `已成功载入表征存档 [${chart.name}]`, type: 'success' });
        }
      },
      deleteChartFromLibrary: (id: string) => {
        updateDataAnalysisSession({ savedCharts: (savedCharts || []).filter((c: any) => c.id !== id) });
      },
      createChartFolder: (name: string) => {
        const newFolder = {
          id: `folder_${Date.now()}`,
          name,
          timestamp: new Date().toLocaleString()
        };
        updateDataAnalysisSession({ chartFolders: [newFolder, ...chartFolders] });
        showToast({ message: `文件夹 [${name}] 创建成功`, type: 'success' });
      },
      deleteChartFolder: (id: string) => {
        const remainingFolders = chartFolders.filter(f => f.id !== id);
        // Move charts in this folder to uncategorized
        const updatedCharts = savedCharts.map(c =>
          c.folderId === id ? { ...c, folderId: undefined } : c
        );
        updateDataAnalysisSession({
          chartFolders: remainingFolders,
          savedCharts: updatedCharts
        });
        showToast({ message: `已删除文件夹，内部图表归为未分类`, type: 'info' });
      },
      moveChartToFolder: (chartId: string, folderId?: string) => {
        const updatedCharts = savedCharts.map(c =>
          c.id === chartId ? { ...c, folderId } : c
        );
        updateDataAnalysisSession({ savedCharts: updatedCharts });
        showToast({ message: `已移动图表`, type: 'success' });
      },
      deleteUserTemplate: (id: string) => {
        const next = userTemplates.filter(t => t.id !== id);
        setUserTemplates(next);
        localStorage.setItem('sciflow_user_chart_tpls', JSON.stringify(next));
      },
      exportChart, autoFitDomains, openAxisSettings, setLeftPanelMode, setAspectRatio, setTemplateSearchQuery, handleDiscoverTemplate, handleDiscoverTemplateFromImage, handleSaveDeepAnalysis, applyTemplate,
      updateUserTemplate: (id: string, updates: Partial<ChartTemplate>) => {
        const next = userTemplates.map(t => t.id === id ? { ...t, ...updates } : t);
        setUserTemplates(next);
        localStorage.setItem('sciflow_user_chart_tpls', JSON.stringify(next));
      },
      setShowGalleryModal,
      setShowChartLibraryModal
    }
  };
};
