
import { UserProfile } from './base';
import { Literature } from './resources';
import { FigureText, FigureShape, ProjectTable, ProjectLatexSnippet } from './visuals';
import { PaperSection, WritingSnapshot, CircularSummaryData } from './manuscript';
import { KnowledgePool } from './knowledge';

// Define core project status types
export type ProjectStatus = 'Planning' | 'In Progress' | 'Peer Review' | 'Completed' | 'Archived';
export type MilestoneStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'branched';
export type LogStatus = 'Pending' | 'Verified' | 'Anomaly';
export type ProposalStatus = 'main' | 'sub';

export interface Publication {
  id: string;
  title: string;
  journal: 'Nature' | 'Science' | 'JACS' | 'Angewandte' | 'Other';
  status: 'Submitted' | 'Accepted' | 'Published';
  timestamp: string;
}

// Define file attachment structure for experiments
export interface ExperimentFile {
  name: string;
  url: string;
  localPath?: string;
  description?: string;
  lastModified?: number;
  refId?: string;
  fileId?: string;
  subFigures?: { label: string; desc: string }[];
}

// Define reagent consumption for audit logs
export interface ConsumedReagent {
  inventoryId: string;
  name: string;
  amount: number;
  unit: string;
}

// Main experiment log structure
export interface ExperimentLog {
  id: string;
  timestamp: string;
  content: string;
  description: string;
  parameters: string;
  parameterList?: { key: string; value: string; unit: string }[];
  scientificData?: Record<string, number>;
  // 主雷达图专用指标键（避免 scientificData 全量挤入主雷达）
  mainRadarMetricKeys?: string[];
  files?: ExperimentFile[];
  result: 'success' | 'neutral' | 'failure' | 'observation';
  status: LogStatus;
  aiInsight?: string;
  auditInsight?: string;
  mechanismInsight?: string;
  summaryInsight?: string;
  complianceInsight?: string;
  complianceScore?: number;
  deepAnalysis?: any;
  consumedReagents?: ConsumedReagent[];
  linkedPlanId?: string;
  linkedRunIdx?: number;
  planSnapshot?: Record<string, string>;
  outlierAudit?: {
    deviationPercent: number;
    diagnosis: 'Synergy' | 'OperatorError' | 'Unknown';
    confidence: number;
    explanation: string;
  };
  // New: Traceability link to Characterization Hub
  linkedAnalysis?: {
    id: string;
    type: 'microscopy' | 'xrd' | 'surface' | 'porosity' | 'kinetics' | 'spectroscopy' | 'contact_resistance';
    title: string;
  };
  samplePhoto?: ExperimentFile;
  sampleAppearanceInsight?: string;
  chatHistory?: { role: string; text: string; timestamp: string; images?: string[] }[];
  // 样品标识（如 NiFe-Ce3%、LDH-S01）
  sampleId?: string;
  // 实验组分组（控制变量实验场景）
  groupId?: string;      // 实验组 UUID，相同 groupId 的记录归为同一组
  groupLabel?: string;   // 实验组名称，例如 "碱液浓度梯度"
  groupAnalysisInsight?: string; // AI 对照组对比分析结论
}

// DOE Matrix Parameter definition
export interface MatrixParameter {
  name: string;
  target: string;
  range: string;
}

// DOE specific run instance
export interface MatrixRun {
  idx: number;
  label?: string;
  params: Record<string, string>;
  status: 'pending' | 'executing' | 'executed';
  logId?: string;
  prediction?: {
    value: number;
    lower: number;
    upper: number;
    confidence: number;
  };
}

// Experimental plan container
export interface PlannedExperiment {
  id: string;
  title: string;
  status: 'planned' | 'executing' | 'completed';
  notes: string;
  parameters: Record<string, string>;
  matrix: MatrixParameter[];
  runs?: MatrixRun[];
  sourceType?: 'doe_ai' | 'proposal' | 'manual';
  sourceProposalId?: string;
  sourceLiteratureId?: string;
  sourceLiteratureTitle?: string;
}

// Research node (Milestone) structure
export interface Milestone {
  id: string;
  title: string;
  hypothesis: string;
  status: MilestoneStatus;
  dueDate: string;
  parentId?: string;
  logs: ExperimentLog[];
  chatHistory: any[];
  experimentalPlan?: PlannedExperiment[];
  savedDocuments?: any[];
  fontSize?: number;
  sectionType?: string;
  fontFamilyEn?: string;
  fontFamilyZh?: string;
}

// Industrial Cost Assessment types
export interface CostMaterialItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  inventoryId?: string;
  category?: 'chemical' | 'consumable' | 'equipment';
}

export interface CostEstimation {
  batchCount: number;
  materials: CostMaterialItem[];
  materialTotal: number;
  operationalCost: number;
  operationalModel: 'linear' | 'fixed';
  totalCost: number;
  unitCost: number;
  volumeDiscountRules?: { minBatch: number; discountPercent: number }[];
  lastUpdated: string;
}

// Route category for grouping proposals
export interface RouteCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// Process route proposal based on intelligence
export interface TransformationProposal {
  id: string;
  literatureId: string;
  literatureTitle: string;
  timestamp: string;
  title: string;
  status: ProposalStatus;
  processChanges: string;
  newFlowchart: { step: string; action: string }[];
  optimizedParameters: { key: string; value: string; reason: string }[];
  controlParameters: { key: string; value: string; reason: string }[];
  scientificHypothesis: string;
  category?: string;  // Route category id for grouping
  parentId?: string;
  resourceAudit?: ResourceAuditData;
  costEstimation?: CostEstimation;
  debateData?: {
    entries: { expertId: string; content: string; round: number }[];
    conclusion: string | null;
    round: number;
  };
}

export interface ResourceAuditData {
  timestamp: string;
  reagents: any[];
  equipment: any[];
}

// Academic report and diagnostic document structure
export interface MatrixReport {
  id: string;
  timestamp: string;
  title: string;
  content: string;
  type: string;
  reportType: 'Weekly' | 'Monthly' | 'Annual' | 'Diagnostic' | 'Manual';
  comparisonTable: { headers: string[]; rows: string[][] };
  insights: string[];
  sourceLogIds?: string[];
  pinned?: boolean;
}

// Task management types for project board
export interface WeeklyTask {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
  assignedDay?: number;
  assignedTo?: string[];
  assignmentReason?: string;
  linkedPlanId?: string;
  logId?: string;
  sourceType?: string;
  sourceProposalId?: string;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  completed: boolean;
}

export type PlanType = 'weekly' | 'monthly' | 'annual';

export interface ProjectPlan {
  id: string;
  type: PlanType;
  startDate: string;
  endDate: string;
  status: 'in-progress' | 'completed';
  completionRate: number;
  goals: WeeklyGoal[];
  tasks: WeeklyTask[];
  periodStatus: ('exp' | 'ana' | 'blocked' | 'idle')[];
  dailyLogs: string[];
  weeklyBreakdown?: WeeklyBreakdownItem[];
  annualBreakdown?: AnnualBreakdownItem[];
}

export interface WeeklyBreakdownItem {
  week: number;
  focus: string;
  status: 'pending' | 'in-progress' | 'completed';
  tasks: BreakdownTask[];
}

export interface AnnualBreakdownItem {
  month: number;
  focus: string;
  status: 'pending' | 'in-progress' | 'completed';
  keyResults: BreakdownTask[];
}

export interface BreakdownTask {
  id: string;
  content: string;
  done: boolean;
}

// Final aggregated project object
export interface ResearchProject {
  id: string;
  title: string;
  category: string;
  description: string;
  status: ProjectStatus;
  deadline: string;
  startDate?: string;
  progress: number;
  trl: number;
  members: string[];
  keywords: string[];
  milestones: Milestone[];
  proposals?: TransformationProposal[];
  routeCategories?: RouteCategory[];
  matrices?: MatrixDataset[];
  weeklyPlans?: ProjectPlan[];
  weeklyReports?: MatrixReport[];
  paperSections?: PaperSection[];
  citedLiteratureIds?: string[];
  media?: ExperimentFile[];
  latexSnippets?: ProjectLatexSnippet[];
  tables?: ProjectTable[];
  circularSummary?: CircularSummaryData;
  proposalDoc?: any;
  proposalText?: string;
  targetMetrics?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
  requiredMaterials?: { name: string; estimatedAmount?: string }[];
  writingSnapshots?: WritingSnapshot[];
  targetPerformance?: string;
  matrixTitle?: string;
  sampleMatrix?: any[];
  savedReports?: any[];
  publications?: Publication[];
  frameworkRationale?: string; // AI 生成的研究框架解读
  personnel?: any[];
  customCategories?: string[];
  // 最近一次实验计划（持久化，跨会话可查看）
  lastExperimentPlan?: any[];
  // 项目知识沉淀池
  knowledgePool?: KnowledgePool;

  // RSS Subscription Feed
  subscriptionRules?: import('./resources').SubscriptionRule[];
  feedItems?: import('./resources').FeedItem[];

  // AI Digest Reports
  digestReports?: import('./resources').DigestReport[];

  // Recommendation History (dismissed DOIs for negative feedback)
  recommendationDismissedDois?: string[];

  // Literature Collections
  collections?: import('./resources').LiteratureCollection[];

  // AI Experiment Advisor Sessions
  advisorSessions?: AdvisorSession[];

  // 投稿管理与期刊匹配系统
  submissionTracker?: import('./manuscript').SubmissionTracker;
}

/** AI 实验顾问存档会话 */
export interface AdvisorSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  proposalText: string;
  selectedLitIds: string[];
  iterationCount: number;
  lastResult: any | null;      // AdvisorResult
  iterationHistory: { result: any; feedback?: string }[];
}

export interface MatrixDataset {
  id: string;
  title: string;
  data: SampleEntry[];
}

export interface SampleEntry {
  id: string;
  sampleId: string;
  timestamp: string;
  processParams: Record<string, string | number>;
  results: Record<string, string | number>;
  note?: string;
  source: 'manual' | 'workflow' | 'imported';
  linkedLogId?: string;
  tags?: string[];
  group?: string;
}
