import { PerformanceMetric, KnowledgeQuadruple } from './base';

export type ResourceType = '文献' | '专利' | '商业竞品';

export interface SynthesisStep {
  step: number;
  title: string;
  content: string;
}

export interface ExtractedTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
}

export interface Literature {
  id: string;
  projectId: string;
  type: ResourceType;
  category?: string;
  categories?: string[];
  title: string;
  englishTitle?: string;
  authors?: string[];
  year: number;
  source: string;
  url?: string;
  abstract: string;
  tags?: string[];
  performance?: PerformanceMetric[];
  synthesisSteps?: SynthesisStep[];
  localPath?: string;

  // NEW: Scientific Reference Engine Extensions
  bibtex?: string;
  extractedTables?: ExtractedTable[];
  knowledgeSinked?: boolean; // Whether AI has performed deep extraction
  syncSource?: 'Zotero' | 'EndNote' | 'Mendeley' | 'Manual';
  doi?: string;
  volume?: string;   // 卷号
  issue?: string;    // 期号
  pages?: string;    // 页码范围，如 "123-145"

  // Pin to top
  pinned?: boolean;

  // Reading Status Workflow
  readingStatus?: 'unread' | 'to_read' | 'reading' | 'read' | 'reviewed';

  // PDF Auto-Download Status
  pdfStatus?: 'none' | 'searching' | 'downloaded' | 'failed';

  // Full-Text PDF Parsing (Review Workshop)
  oaUrl?: string;              // OpenAlex 开放获取 PDF 链接
  fullText?: string;           // 已解析的全文内容
  fullTextSource?: 'oa_download' | 'user_upload' | 'local_pdf';  // 全文来源标记

  // Collection Membership
  collectionIds?: string[];

  // Deep Reading Session Persistence
  deepReadChatHistory?: { role: 'user' | 'model'; text: string; quote?: string }[];
  deepReadAnalysis?: {
    executiveSummary: string;
    glossary: { term: string; definition: string }[];
    keyQuestions: string[];
    conceptTree?: { label: string; icon: string; children: { label: string; detail: string }[] }[];
  };
  deepReadPinnedNotes?: { id: string; text: string; context?: string; timestamp: string }[];

  // PDF Annotation System
  pdfAnnotations?: {
    id: string;
    page: number;
    text: string;
    rects: { x: number; y: number; w: number; h: number }[];
    color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
    note?: string;
    timestamp: string;
  }[];

  // Citation Relationship Graph
  citationLinks?: {
    type: 'cites' | 'cited_by';
    targetId?: string; // ID of another Literature item in the same project
    targetTitle: string;
    targetDoi?: string;
    confidence: number; // 0-1, AI-inferred confidence
  }[];

  // AI Expert Debate
  debateData?: {
    entries: { expertId: string; content: string; round: number }[];
    conclusion: string | null;
    round: number;
  };

  // 结构化知识四元组
  knowledgeQuadruples?: KnowledgeQuadruple[];
}

// ─── Literature Collections (Tree Structure) ───────────────
export interface LiteratureCollection {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string;
  order?: number;
}

// ─── Subscription / RSS Feed Types ──────────────────────────────
export type SubscriptionRuleType = 'keyword' | 'author' | 'journal' | 'arxiv_category' | 'rss_url' | 'doi_alert';

export interface SubscriptionRule {
  id: string;
  type: SubscriptionRuleType;
  value: string;
  enabled: boolean;
  lastChecked?: string;
  newCount?: number;
}

export interface FeedItem {
  id: string;
  ruleId: string;
  title: string;
  englishTitle?: string;
  authors: string[];
  year: number;
  source: string;
  doi?: string;
  url?: string;
  abstract: string;
  discoveredAt: string;
  isRead: boolean;
  imported: boolean;
  relevanceScore?: number;   // 0-100 AI 相关度评分
  starred?: boolean;         // 用户星标收藏
  sourceApi?: string;        // 来源 API 标识 (openalex / arxiv / rss / semantic_scholar)
}

// ─── AI 聚合摘要 (Digest) ────────────────────────────────────────
export interface DigestTopicCluster {
  topic: string;
  paperIds: string[];
  aiSummary: string;
  trendInsight: string;
}

export interface DigestReport {
  id: string;
  period: 'daily' | 'weekly';
  generatedAt: string;
  topicClusters: DigestTopicCluster[];
  overallInsight: string;
  feedItemCount: number;
}

// ─── 智能推荐论文 ─────────────────────────────────────────────────
export interface RecommendedPaper {
  id: string;
  title: string;
  englishTitle?: string;
  authors: string[];
  year: number;
  source: string;
  doi?: string;
  url?: string;
  abstract: string;
  citationCount?: number;
  recommendReason?: string;
  dismissed?: boolean;
}

export interface UsageRecord {
  id: string;
  amount: number;
  unit: string;
  userId?: string;
  projectId?: string;
  experimentId?: string;
  purpose?: string;
  timestamp: string;
}

export interface MaintenanceRecord {
  id: string;
  type: 'calibration' | 'repair' | 'routine';
  date: string;
  nextDue?: string;
  performer: string;
  notes?: string;
  cost?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  formula?: string;
  casNo?: string;
  brand?: string;
  model?: string;
  category: InventoryCategory;
  purity?: string;
  quantity: number;
  stockCount?: number;
  totalQuantity?: number;
  unit: string;
  threshold: number;
  location: string;
  safetyLevel: SafetyLevel;
  // Added 'Purchasing' status for tracking procurement workflows
  status?: 'Ready' | 'In Use' | 'Maintenance' | 'Calibration Required' | 'Purchasing';
  lastUpdated: string;
  note?: string;
  molecularWeight?: number;
  urgency?: 'Normal' | 'Urgent' | 'Critical';
  linkedProjectId?: string;
  procurementDeadline?: string;
  pushedToPlan?: boolean;
  pushedTaskId?: string;
  msdsData?: string; // AI generated MSDS content

  // Expiry & batch management
  expiryDate?: string;            // ISO date string
  receivedDate?: string;
  openedDate?: string;
  batchNo?: string;

  // Cost tracking
  unitPrice?: number;
  currency?: 'CNY' | 'USD' | 'EUR';

  // Usage tracking (for sparkline trends)
  usageLog?: UsageRecord[];
  totalConsumed?: number;

  // Hardware maintenance
  serialNumber?: string;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  maintenanceHistory?: MaintenanceRecord[];
}

export type InventoryCategory = 'Chemical' | 'Hardware' | 'Consumable' | 'Precursor';
export type SafetyLevel =
  | 'Safe' | 'Corrosive' | 'Flammable' | 'Toxic' | 'Explosive'
  | 'General' | 'Precision' | 'Hazardous' | 'Restricted';

export type InventoryViewMode = 'grid' | 'list' | 'map' | 'calendar' | 'analytics';

export interface TrendItem {
  id: string;
  title: string;
  category: TrendCategory;
  content: string;
  summary?: string;
  impactScore: number;
  source: string;
  url: string;
  timestamp: string;
  detectedAt?: string;
}

export type TrendCategory = 'Technology' | 'Market' | 'Policy' | 'Competitor';

// ═══ 市场产品分析 ═══
export interface MarketProduct {
  id: string;
  name: string;
  nameEn?: string;
  manufacturer: string;
  country?: string;
  category: string;
  specs: { label: string; value: string; unit?: string }[];
  price?: { value: number; unit: string; note?: string };
  techRoute?: string;
  advantages?: string[];
  disadvantages?: string[];
  marketShare?: number; // 0-100
  maturityLevel?: 'Lab' | 'Pilot' | 'Mass';
  source?: string;
  url?: string;
  detectedAt?: string;
  // ═══ 专利技术档案 ═══
  techProfile?: {
    patents: { id: string; title: string; applicant: string; filingDate: string; status: string; keyTech: string }[];
    processSteps: string[];           // 工艺流程步骤
    keyFormulation?: string;          // 关键配方/组分描述
    precursors?: string[];            // 关键前驱体原料
    sinteringTemp?: string;           // 烧结/反应温度
    techBarrierScore?: number;        // 技术壁垒评分 0-100
    techBarrierNotes?: string;        // 壁垒分析说明
    substitutability?: 'low' | 'medium' | 'high'; // 可替代性
    analyzedAt?: string;
  };
}

export interface MarketComparison {
  id: string;
  title: string;
  products: MarketProduct[];
  dimensions: string[];
  radarData?: { dimension: string; [productName: string]: string | number }[];
  summary?: string;
  timestamp: string;
}

// ═══ 技术路线演化时间线 ═══
export interface TechEvolutionMilestone {
  id: string;
  year: string;            // "2015" 或 "2015Q3"
  title: string;           // 里程碑标题
  description: string;     // 详细描述
  category: 'breakthrough' | 'product' | 'patent' | 'standard' | 'forecast';
  techRoute?: string;      // 相关技术路线
  companies?: string[];    // 涉及企业
  impact: 'high' | 'medium' | 'low';
}

export interface TechEvolutionData {
  query: string;           // 分析对象
  generatedAt: string;
  milestones: TechEvolutionMilestone[];
  generations: { name: string; startYear: string; endYear: string; color: string; description: string }[];
  futureOutlook?: string;  // 未来展望
}