import { DiagramTemplate, DiagramGroup, Connection, NodePosition } from '../components/FigureCenter/Structure/types';
import { TimelineData } from './visuals';

export interface HotnessPoint {
  id: string;
  topic: string;
  x: number; // 竞争强度 (0-100)
  y: number; // 研究深度 (0-100)
  val: number; // 热度值
  isBlueOcean: boolean;
  competitors: string[];
  trend: number[]; // 过去五年发表量简易趋势
}

export interface LabInfo {
  name: string;
  leader: string;
  contribution: string;
  sourceUrl?: string;
}

export interface PatentRisk {
  description: string;
  sourceUrl?: string;
}

export interface ResearchGap {
  content: string;
  sourceUrl?: string;
  urgency?: 'low' | 'medium' | 'high';
}

export interface Landscape {
  activeLabs: LabInfo[];
  commercialStatus: string | { content: string; sourceUrl?: string };
  patentRisks: PatentRisk[];
  researchGaps: ResearchGap[];
  hotnessData: HotnessPoint[];
  sources?: string[];
  // -- Phase 1 Enhancement --
  keyPublications?: KeyPublication[];
  fundingLandscape?: FundingLandscape;
  trlTimeline?: TrlMilestone[];
  // -- Phase 2 Enhancement --
  geographicDistribution?: GeographicEntry[];
  translationReadiness?: TranslationReadiness;
  methodologyGaps?: MethodologyGap[];
  // -- Phase 3 Enhancement --
  interdisciplinaryLinks?: InterdisciplinaryLink[];
}

/** 关键论文 */
export interface KeyPublication {
  title: string;
  authors: string;
  journal: string;
  year: number;
  citations: number;
  significance: string;
  doi?: string;
  isLandmark: boolean;
}

/** 资助机构 */
export interface FundingAgency {
  name: string;
  country: string;
  recentProjects: number;
  avgGrantSize: string;
  focusAreas: string[];
}

/** 资金版图 */
export interface FundingLandscape {
  totalGlobalFunding: string;
  topAgencies: FundingAgency[];
  fundingTrend: 'increasing' | 'stable' | 'declining';
  sourceUrl?: string;
}

/** TRL 里程碑节点 */
export interface TrlMilestone {
  year: number;
  trlLevel: number;
  milestone: string;
  actor: string;
}

/** 地理竞争分布 */
export interface GeographicEntry {
  country: string;
  labCount: number;
  publishedPapers: number;
  strength: 'dominant' | 'strong' | 'emerging' | 'niche';
  keyInstitutions: string[];
}

/** 产业转化路径 */
export interface TranslationReadiness {
  marketSize: string;
  cagr: string;
  keyPlayers: Array<{
    company: string;
    product: string;
    stage: 'R&D' | 'Pilot' | 'Commercial';
  }>;
  policySupport: string;
  bottleneck: string;
}

/** 方法学缺口 */
export interface MethodologyGap {
  gap: string;
  impact: 'critical' | 'moderate';
  potentialApproach: string;
}

/** 跨学科关联 */
export interface InterdisciplinaryLink {
  field: string;
  connection: string;
  maturity: 'emerging' | 'growing' | 'established';
  representativePaper?: string;
}

export interface InceptionSession {
  stage: 'ideate' | 'research' | 'blueprint' | 'review';
  domain: string;
  suggestions: any[];
  selectedTopic: any | null;
  landscape: Landscape | null;
  blueprint?: any | null;
  hotnessData?: HotnessPoint[];
  review: any | null;
  isThinking: boolean;
}

export interface SavedInception {
  id: string;
  title: string;
  timestamp: string;
  sessionData: Omit<InceptionSession, 'isThinking'>;
}

export interface MechanismSession {
  pH: number;
  potential: number;
  reactionMode: 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';
  material: string;
  unitCellType: string;
  dopingElement: string;
  dopingConcentration: number;
  coDopingElement?: string;
  coDopingConcentration?: number;
  massLoading: number;
  isProcessing: boolean;
  isStableAnalysis: boolean;
  analysisResult: string | null;
  experimentalPriority: string | null;
  physicalConstants: any;
  stabilityPrediction: any;
  morphologyLink: any;
  measuredPoint?: any;
}

export interface FlowchartSession {
  description: string;
  currentFlowchart: SavedFlowchart | null;
  scaleFactor: number;
  targetTrl: number;
  productionValue: number;
  unitLabel: '克' | '批次';
  includeMaterialCost: boolean;
  includeOperationCost: boolean;
  activeStepId: string | null;
  detailLevel: 'concise' | 'detailed';
  optimizedParameters?: { key: string; value: string; reason: string }[];
  controlParameters?: { key: string; value: string; reason: string }[];
}

export interface SavedFlowchart {
  id: string;
  title: string;
  timestamp: string;
  originalDescription: string;
  steps: FlowchartStep[];
  scaleFactor: number;
  trlLevel: number;
  productionValue: number;
  unitLabel: string;
  includeMaterialCost: boolean;
  includeOperationCost: boolean;
  optimizedParameters?: { key: string; value: string; reason: string }[];
  controlParameters?: { key: string; value: string; reason: string }[];
}

export interface FlowchartStep {
  id: string;
  text: string;
  description: string;
  riskLevel?: 'low' | 'medium' | 'high';
  safetyAlert?: string;
  scalingInsight?: string;
  doeAnchor?: string;
  bomItems?: { name: string; amount: string; unit: string; estimatedCost: number }[];
}

export interface DoeHistoryItem {
  factors: Record<string, number>;
  responses: Record<string, number>;
  outlierAudit?: {
    deviationPercent: number;
    diagnosis: 'Synergy' | 'OperatorError' | 'Unknown';
    confidence: number;
    explanation: string;
    actionPlan: string;
  };
}

export interface DoeSession {
  factors: DOEFactor[];
  responses: DOEResponse[];
  processDescription: string;
  history: DoeHistoryItem[];
  isCalculating: boolean;
  suggestion: any | null;
  loadedArchiveId: string | null;
  // 关联的课题和节点
  linkedProjectId?: string;
  linkedMilestoneId?: string;
}

export interface SavedDOE {
  id: string;
  title: string;
  timestamp: string;
  factors: DOEFactor[];
  responses: DOEResponse[];
  history: DoeHistoryItem[];
  processDescription: string;
  suggestion: any;
  // 归属课题/节点分类
  projectId?: string;
  projectTitle?: string;
  milestoneId?: string;
  milestoneTitle?: string;
}

export interface DOEFactor {
  name: string;
  unit: string;
  min: number;
  max: number;
}

export interface DOEResponse {
  name: string;
  unit: string;
  goal: 'maximize' | 'minimize' | 'target';
  weight: number;
}

export interface ChartFolder {
  id: string;
  name: string;
  timestamp: string;
}

export interface SavedChart {
  id: string;
  name: string;
  timestamp: string;
  thumbnailUrl?: string;
  folderId?: string;
  sessionData: Omit<DataAnalysisSession, 'savedCharts' | 'chartFolders'>;
}

export interface DataAnalysisSession {
  savedCharts?: SavedChart[];
  chartFolders?: ChartFolder[];
  seriesList: any[];
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  chartType: 'line' | 'bar' | 'scatter' | 'area';
  strokeWidth: number;
  mainColor: string;
  fontSize: number;
  pointShape: any;
  pointSize: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xScale: 'auto' | 'log';
  yScale: 'auto' | 'log';
  gridX: boolean;
  gridY: boolean;
  axisBox: boolean;
  legendPos: { x: number; y: number };
  annotations: any[];
  activeTab: 'chart' | 'mimic';
  leftPanelMode: 'basic' | 'axis' | 'series';

  // Additional visual settings
  aspectRatio: number;
  axisColor: string;
  axisLineWidth: number;
  gridLineWidth: number;
  tickFontSize: number;
  tickSize: number;
  tickWidth: number;
  axisLabelFontSize: number;
  xTickCount: number;
  yTickCount: number;

  titleFontFamily: string;
  titleFontWeight: string;
  titleFontStyle: string;
  labelFontFamily: string;
  labelFontWeight: string;
  labelFontStyle: string;
  tickFontFamily: string;
  tickFontWeight: string;
  tickFontStyle: string;
  legendFontFamily: string;
  legendFontWeight: string;
  legendFontStyle: string;
  legendFontSize: number;

  legendBorderVisible: boolean;
  legendBorderColor: string;
  legendBorderWidth: number;

  xLabelPos: { x: number; y: number };
  yLabelPos: { x: number; y: number };
  titlePos: { x: number; y: number };

  showXTicks: boolean;
  showYTicks: boolean;
  showMirroredTicks: boolean;
}

export interface WritingSession {
  activeTab: string;
  activeMediaSubTab: 'images' | 'tables' | 'latex';
  activeSectionId: string;
}

export interface StructuralSession {
  template: DiagramTemplate;
  data: { groups: DiagramGroup[]; connections: Connection[] } | null;
  positions: Record<string, NodePosition>;
  userPrompt: string;
  spacingConfig?: { nodeGap: number; groupPaddingX: number };
}

export interface TimelineSession {
  data: TimelineData | null;
  userPrompt: string;
}

export interface VisionModeSnapshot {
  imageSrc: string | null;
  scaleRatio: number | null;
  report: string | null;
  aiReport: string | null;
  // SEM
  particles: any[];
  sheetStats: { porosity: number; edgeDensity: number } | null;
  // TEM
  latticeResult: any | null;
  defectStats: any | null;
  // XRD
  xrdPeaks: any[];
  rawXrdData: any[];
  xrdConfig: { wavelength: number; shapeFactor: number };
  selectedXrdPeak: any | null;
  showStandardLine: boolean;
  realLengthInput: string;
}

export interface SavedVisionAnalysis {
  id: string;
  title: string;
  timestamp: string;
  imageSrc: string | null;
  mode: 'SEM' | 'TEM' | 'XRD';
  scaleRatio: number | null;
  particles: any[];
  xrdPeaks: any[];
  latticeResult: any | null;
  defectStats: any | null;
  report: string | null;
  aiReport: string | null;
  rawXrdData: any[];
  selectedXrdPeak: any | null;
  showStandardLine?: boolean;
  logId?: string;
  logTitle?: string;
  linkedLogId?: string;
  linkedLogTitle?: string;
  linkedProjectId?: string;
  linkedMilestoneId?: string;
}

export interface VisionSession {
  imageSrc: string | null;
  mode: 'SEM' | 'TEM' | 'XRD';
  semMode: 'particle' | 'sheet';
  temMode: 'lattice' | 'fft' | 'defect' | 'particle' | 'angle' | 'saed' | 'eds';
  scaleRatio: number | null;
  realLengthInput: string;
  particles: any[];
  xrdPeaks: any[];
  sheetStats: { porosity: number; edgeDensity: number } | null;
  latticeResult: any | null;
  defectStats: any | null;
  report: string | null;
  aiReport: string | null;
  rawXrdData: any[];
  xrdConfig: { wavelength: number; shapeFactor: number };
  selectedXrdPeak: any | null;
  showStandardLine: boolean;
  linkedLogId?: string;
  linkedLogTitle?: string;
  linkedProjectId?: string;
  linkedMilestoneId?: string;
  savedArchives?: SavedVisionAnalysis[];
  /** 各模式的独立状态快照，切换模式时自动保存/恢复 */
  modeStates?: Partial<Record<'SEM' | 'TEM' | 'XRD', VisionModeSnapshot>>;
}
