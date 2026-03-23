
export type AppView = 'dashboard' | 'projects' | 'project_detail' | 'graph' | 'literature' | 'inventory' | 'data' | 'doe' | 'flowchart' | 'writing' | 'figure_center' | 'mechanism' | 'industry_trends' | 'market_analysis' | 'assistant' | 'video_lab' | 'inception' | 'team' | 'characterization_hub' | 'research_brain' | 'research_farm' | 'process_lab' | 'notebook' | 'companion';

export interface PerformanceMetric {
  label: string;
  value: string;
  unit?: string;              // e.g. "V vs RHE", "mW cm⁻²", "mAh g⁻¹"
  condition?: string;         // e.g. "0.1 M KOH", "N₂-saturated"
  normalizedLabel?: string;   // AI-standardized metric name for cross-literature pairing
  sourceSection?: string;     // Source paragraph / table ID in the PDF
  confidence?: number;        // AI extraction confidence 0-1
}

export interface ExpertiseScore {
  subject: string;
  A: number;
  fullMark: number;
}

export interface MasteryItem {
  name: string;
  level: number; // 1-10
  experience?: number; // 0-100, 达到100则 level+1
}

// 科研性格类型
export type ScientificTemperament = 'Explorer' | 'Optimizer' | 'Skeptic';

// 人员可用性状态
export type AvailabilityStatus = 'Available' | 'On Leave' | 'Busy';

export interface UserProfile {
  name: string;
  role: string;
  id: string;
  education?: string;
  department: string;
  projectGroup: string;
  securityLevel: '公开' | '内部' | '秘密' | '机密' | '绝密';
  institution: string;
  researchArea: string;
  avatar: string;
  gender?: 'Male' | 'Female'; // 新增性别属性
  expertise?: string[];
  expertiseMetrics?: ExpertiseScore[];
  mastery?: MasteryItem[];

  availabilityStatus?: AvailabilityStatus;
  leaveDays?: number[]; // 新增：记录本周请假的日期索引 (0-6)
  scientificTemperament?: ScientificTemperament;
  resilienceIndex?: number;
  synergyIndex?: number;
  qcConsistency?: number;

  activeProjectsCount?: number;
  workload?: number;
  matchScore?: number;
  matchReason?: string;
}

export interface AppTheme {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: {
    background: string;
    sidebar: string;
    sidebarBorder: string;
    text: string;
  };
}

export type AIProvider = 'auto' | 'gemini' | 'openai' | 'anthropic' | 'doubao' | 'custom';

export interface AIModelConfig {
  apiKey: string;
  baseUrl?: string;
  modelName: string;
}

export interface AppSettings {
  aiAutoDiagnose: boolean;
  aiRealtimePolish: boolean;
  localLibraryPath: string;
  latexStyle: 'serif' | 'sans';
  sidebarMode: 'expanded' | 'collapsed';

  // AI Engine Configuration
  activeModelProvider: AIProvider;
  autoRoutingPreference?: 'cost' | 'quality';
  geminiConfig?: AIModelConfig;
  openaiConfig?: AIModelConfig;
  anthropicConfig?: AIModelConfig;
  doubaoConfig?: AIModelConfig;

  // 原生图像生成专用模型（带 imageConfig 的任务自动路由到此模型）
  imageModelName?: string;

  openaiApiKey?: string;

  // Scientific Standards
  defaultCitationStyle?: 'Nature' | 'Science' | 'IEEE' | 'APA' | 'JACS';
  // System Behavior
  enableNotifications?: boolean;
  autoSaveInterval?: number; // in minutes
  aiSpeedMode?: 'fast' | 'balanced' | 'quality';

  // Appearance & Theme
  themeMode?: 'light' | 'dark' | 'system';
  uiScale?: 80 | 90 | 100 | 110 | 120;
  editorFontSize?: number; // 12-24

  // Data & Visualization Defaults
  defaultExportFormat?: 'SVG' | 'PNG' | 'PDF';
  defaultExportDPI?: 300 | 600 | 1200;
  defaultChartFont?: string;
  defaultColorPalette?: string;

  // Network & Proxy
  proxyEnabled?: boolean;
  proxyUrl?: string;
  aiRequestTimeout?: number; // seconds

  // Privacy & Security
  confirmBeforeAISend?: boolean;

  // Language & Locale
  uiLanguage?: 'zh' | 'en';
  dateFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  aiOutputLanguage?: 'zh' | 'en' | 'auto';

  // Writing Preferences
  aiPolishIntensity?: 'light' | 'moderate' | 'deep';
  defaultWritingLanguage?: 'zh' | 'en';
  paragraphIndent?: 'indent' | 'no-indent';

  // Experiment Defaults
  defaultXrdRadiation?: 'Cu Kα' | 'Mo Kα' | 'Co Kα' | 'Ag Kα';
  defaultXpsReference?: string; // e.g. "C 1s 284.8 eV"
  defaultSemVoltage?: number;   // kV
  defaultTemVoltage?: number;   // kV

  // AI Conversation Management
  chatHistoryRetentionDays?: number;
  autoClearChat?: boolean;

  // Window Behavior
  restoreWindowPosition?: boolean;
  rememberLastPage?: boolean;

  // Performance
  gpuAcceleration?: boolean;
  cacheMaxSizeMB?: number;

  // AI Engine Extended
  aiTemperature?: number;          // 0-2, default 0.7
  aiMaxTokens?: number;            // 256-8192, default 4096
  aiContextLength?: number;        // 1-20 rounds, default 10

  // Data & Visualization Extended
  defaultChartWidth?: number;      // 400-1600, default 800
  defaultChartHeight?: number;     // 300-1200, default 600
  chartAnimation?: boolean;        // default true

  // Research Extended
  defaultLiteratureSort?: 'year' | 'author' | 'addedDate' | 'citations';
  defaultExperimentTemplate?: 'blank' | 'electrochemistry' | 'catalysis' | 'synthesis' | 'characterization';
  spellCheck?: boolean;            // default true

  // System Extended
  startupPage?: 'dashboard' | 'lastProject' | 'blank';
  soundFeedback?: boolean;         // default false

  // AI Engine Extended (Batch 2)
  aiStreamOutput?: boolean;        // default true, 流式输出
  aiDefaultPersona?: 'rigorous' | 'creative' | 'balanced';  // default 'balanced'
  debateRounds?: number;           // 3/5/7, default 5

  // System Extended (Batch 2)
  autoBackupInterval?: number;     // 0=off, 30/60/120/360 minutes
  defaultTablePageSize?: number;   // 10/25/50/100, default 25
  customShortcuts?: Record<string, string>;  // action -> key combo

  // Navigation Visibility
  hiddenNavModules?: string[];     // 被隐藏的导航模块 id 列表
  navModuleOrder?: string[];       // 用户自定义的导航模块排序
}

export interface ToastConfig {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
}

export interface SearchResult {
  type: 'literature' | 'log' | 'report' | 'inventory';
  id: string;
  title: string;
  content: string;
  projectTitle?: string;
  isFailure?: boolean;
  metadata?: any;
}

// ═══ 综述工坊 (Review Workshop) ═══════════════════════════════════

/** 管线阶段 */
export type ReviewPipelineStage =
  | 'idle'
  | 'topic_decomposition'       // 阶段1: 主题分解
  | 'literature_search'          // 阶段2: 多轮文献检索
  | 'literature_screening'       // 阶段3: 文献筛选分级
  | 'knowledge_extraction'       // 阶段4: 知识沉降
  | 'outline_generation'         // 阶段5: 大纲生成
  | 'section_generation'         // 阶段6: 逐节内容生成
  | 'figure_generation'          // 阶段7: 图表生成
  | 'cross_audit'                // 阶段8: 交叉审计
  | 'polishing'                  // 阶段9: 学术润色
  | 'writing_to_editor'          // 阶段10: 写入编辑器
  | 'completed';

/** 综述配置 */
export interface ReviewConfig {
  topic: string;
  language: 'zh' | 'en';
  scope: string;
  yearRange: [number, number];
  maxPapers: number;
  targetWordCount: number;
  citationStyle: 'numbered' | 'author-year';
  customInstructions?: string;
}

/** 研究子问题 */
export interface ReviewSubQuestion {
  id: string;
  question: string;
  keywords: string[];
  description: string;
}

/** 文献筛选分级 */
export interface ScreenedLiterature {
  literatureId: string;
  tier: 'core' | 'supporting' | 'reference' | 'excluded';
  relevanceScore: number;
  assignedSubtopics: string[];
  reason: string;
  /** 全文 PDF 获取状态（知识沉降阶段使用） */
  fullTextStatus?: 'pending' | 'downloading' | 'ready' | 'failed' | 'needs_upload';
}

/** 综述大纲节点 */
export interface ReviewOutlineNode {
  id: string;
  title: string;
  description: string;
  level: number;
  literatureIds: string[];
  suggestedFigure?: {
    type: 'comparison_table' | 'trend_chart' | 'mechanism_diagram' | 'distribution' | 'sankey' | 'timeline' | 'summary_infographic';
    description: string;
  };
  targetWords: number;
  status: 'pending' | 'generating' | 'done' | 'error';
  content?: string;
  children?: ReviewOutlineNode[];
}

/** 自动生成的图表数据 */
export type ReviewGeneratedFigure =
  | { figureType: 'comparison_table'; sectionId: string; sectionTitle: string; description: string; headers: string[]; rows: string[][] }
  | { figureType: 'trend_chart'; sectionId: string; sectionTitle: string; description: string; yearDistribution: Record<string, number>; topJournals: { name: string; count: number }[]; summary: string }
  | { figureType: 'description'; sectionId: string; sectionTitle: string; description: string; suggestedType: string; markdownContent: string }
  | { figureType: 'sankey_chart'; sectionId: string; sectionTitle: string; description: string; sankeyData: any }
  | { figureType: 'timeline_chart'; sectionId: string; sectionTitle: string; description: string; timelineData: any }
  | { figureType: 'structural_diagram'; sectionId: string; sectionTitle: string; description: string; structuralData: any }
  | { figureType: 'summary_infographic'; sectionId: string; sectionTitle: string; description: string; infographicData: any }
  | { figureType: 'composite_figure'; sectionId: string; sectionTitle: string; description: string; assemblyId: string; assemblyTitle: string; renderedImage?: string; caption: string }
  | { figureType: 'auto_literature_figure'; sectionId: string; sectionTitle: string; description: string; renderedImage?: string; caption: string; sourceFigures: Array<{ litId: string; litTitle: string; figureLabel: string; pageNum: number }> };

/** 管线步骤状态 */
export interface ReviewStageStatus {
  stage: ReviewPipelineStage;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  progress: number;           // 0-100
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/** 修订迭代记录 */
export interface RevisionRound {
  round: number;
  score: number;
  criticalCount: number;
  moderateCount: number;
  revisedSections: string[];       // 被修订的章节标题
  summary: string;                 // 审计摘要
  timestamp: string;
}

// ═══ 多 Agent 协作架构 ════════════════════════════════════════════

/** Agent 角色枚举 */
export type ReviewAgentRole = 'editor' | 'writer' | 'critic' | 'fact_checker';

/** Agent 发现的问题 */
export interface AgentIssue {
  agentRole: ReviewAgentRole;
  severity: 'critical' | 'moderate' | 'minor';
  category: string;           // editor: 'narrative'|'terminology'|'structure'
                              // critic: 'logic'|'coverage'|'methodology'|'novelty'
                              // fact_checker: 'citation_missing'|'citation_mismatch'|'hallucination'|'uncited_claim'
  sectionTitle: string;
  description: string;
  suggestion: string;
  evidence?: string;          // fact_checker 提供的引文证据
}

/** 单个 Agent 的评审结果 */
export interface AgentReport {
  role: ReviewAgentRole;
  score: number;              // 0-100
  issues: AgentIssue[];
  summary: string;
  timestamp: string;
}

/** 多 Agent 修订轮次记录 */
export interface MultiAgentRevisionRound {
  round: number;
  agentReports: AgentReport[];
  consensusScore: number;     // 加权平均分
  revisedSections: string[];
  timestamp: string;
}

// ═══ 结构化文献知识图谱 ════════════════════════════════════════════

/** 知识四元组: <方法, 材料, 结果, 条件> */
export interface KnowledgeQuadruple {
  id: string;
  method: string;               // 实验方法/技术（如水热法、电沉积）
  material: string;             // 材料体系（如 NiFe-LDH、Pt/C）
  result: string;               // 实验结果/性能指标（如过电位 230mV）
  condition: string;            // 实验条件（如 0.1M KOH, 25°C）
  sourceLiteratureId: string;
  sourceLiteratureTitle: string;
  confidence: number;           // 0-1 AI 提取置信度
  category?: string;            // 'electrochemistry'|'catalysis'|'synthesis' 等
}

/** 综述工坊知识图谱 */
export interface ReviewKnowledgeGraph {
  quadruples: KnowledgeQuadruple[];
  lastUpdated: string;
  totalSources: number;
}

// ═══ 全局一致性引擎 ═══════════════════════════════════════════════

/** 一致性问题项 */
export interface ConsistencyIssue {
  type: 'terminology' | 'citation' | 'redundancy';
  severity: 'auto_fixed' | 'needs_review';
  sectionTitle: string;
  original: string;         // 问题原文
  fixed?: string;           // 修复后文本
  description: string;
}

/** 一致性引擎扫描报告 */
export interface ConsistencyReport {
  terminologyFixes: number;
  citationFixes: number;
  redundancyFlags: number;
  issues: ConsistencyIssue[];
  timestamp: string;
}

/** 管线阶段耗时记录 */
export interface StageTiming {
  stage: string;
  startedAt: string;
  durationMs: number;
}

/** 内容版本快照 */
export interface ContentSnapshot {
  id: string;
  label: string;                    // 如 "修订轮次 1 前", "润色前"
  trigger: 'auto_revision' | 'multi_agent' | 'polishing' | 'consistency' | 'regenerate';
  sections: Record<string, string>; // 快照时刻的 generatedSections 深拷贝
  timestamp: string;
}

/** 综述生成会话 */
export interface ReviewSession {
  id: string;
  config: ReviewConfig;
  currentStage: ReviewPipelineStage;
  stages: ReviewStageStatus[];
  subQuestions: ReviewSubQuestion[];
  /** 综述专属文献池 ID 列表（引用 resources 中的文献） */
  literaturePool: string[];
  screenedLiterature: ScreenedLiterature[];
  outline: ReviewOutlineNode[];
  generatedSections: Record<string, string>;  // outlineNodeId → content
  generatedFigures?: Record<string, ReviewGeneratedFigure>;  // outlineNodeId → figure data
  auditReport?: string;
  revisionHistory?: RevisionRound[];
  /** 多 Agent 协作修订历史 */
  multiAgentHistory?: MultiAgentRevisionRound[];
  /** 各 Agent 最新评审报告 */
  agentReports?: Record<ReviewAgentRole, AgentReport>;
  /** 结构化文献知识图谱 */
  knowledgeGraph?: ReviewKnowledgeGraph;
  /** 全局一致性扫描报告 */
  consistencyReport?: ConsistencyReport;
  abstract?: string;
  keywords?: string[];
  highlights?: string[];
  bibliography?: string;
  /** 用户手动挂载的组图关联 outlineNodeId → assembly info 列表 */
  attachedAssemblies?: Record<string, Array<{ assemblyId: string; caption: string }>>;
  /** 用户手动挂载的表格 outlineNodeId → table info 列表 */
  attachedTables?: Record<string, Array<{ tableId: string; table: { title: string; headers: string[]; rows: string[][]; note?: string } }>>;
  /** 用户手动挂载的公式 outlineNodeId → formula info 列表 */
  attachedFormulas?: Record<string, Array<{ formulaId: string; formula: { title: string; content: string; type: 'math' | 'chem'; isBlock?: boolean } }>>;
  /** 内容版本历史快照 */
  contentHistory?: ContentSnapshot[];
  /** 管线阶段耗时记录 */
  stageTiming?: StageTiming[];
  /** Token 消耗统计 */
  tokenUsage?: { inputTokens: number; outputTokens: number };
  createdAt: string;
  error?: string;
}

declare global {
  interface Window {
    electron?: {
      selectLocalFile: {
        (contextKey?: string): Promise<{ name: string; path: string } | null>;
        (options: { contextKey?: string; multiple?: false }): Promise<{ name: string; path: string } | null>;
        (options: { contextKey?: string; multiple: true }): Promise<Array<{ name: string; path: string }> | null>;
      };
      openPath: (path: string) => Promise<string | undefined>;
      openFile: (path: string) => Promise<string | undefined>;
      saveFile: (opts: { name: string; content: string; defaultPath?: string }) => Promise<{ success: boolean; filePath?: string }>;
      readFile: (path: string) => Promise<{ mimeType: string; data: string } | null>;
      showItemInFolder: (path: string) => Promise<void>;
      selectDirectory: () => Promise<string | null>;
      listDirectory: (path: string) => Promise<any[]>;
      watchDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
      unwatchDirectory: (path: string) => Promise<{ success: boolean; error?: string }>;
      httpRequest: (payload: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: string;
      }>;
      onFileSystemEvent: (callback: (event: any) => void) => () => void;
      // ═══ Word 模式 ═══
      openDocxDialog: () => Promise<{ name: string; path: string; data: string } | null>;
      saveDocx: (opts: { data: string; filePath?: string; defaultName?: string }) =>
        Promise<{ success: boolean; filePath?: string; name?: string; error?: string }>;
    };
    aistudio?: AIStudio;
    // For Web Speech API
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }

  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
