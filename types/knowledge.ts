/**
 * Knowledge Pool (项目知识沉淀池) Type Definitions
 * Aggregated Knowledge Benchmarking data structures
 */

// A single benchmark data point from a literature source
export interface BenchmarkDataPoint {
  literatureId: string;
  literatureTitle: string;
  materialSystem: string;      // e.g. "Fe-SA/PNC", "EFE-N3/PCF"
  value: number;               // Parsed numeric value
  rawValue: string;            // Original string, e.g. "0.92 V vs RHE"
  year: number;
  authors?: string[];
  doi?: string;
  sourceTable?: string;        // Which table/section in the paper
  isOurs?: boolean;            // Is this from our own project data
  confidence: number;          // AI extraction confidence 0-1
}

// A benchmark metric that aggregates data from multiple literature
export interface BenchmarkEntry {
  metricId: string;
  normalizedName: string;      // Standardized name, e.g. "half_wave_potential"
  displayName: string;         // Display name, e.g. "半波电位 (E₁/₂)"
  unit: string;                // e.g. "V vs RHE"
  condition?: string;          // Test condition, e.g. "0.1 M KOH"
  category: MetricCategory;
  isHigherBetter: boolean;     // For color-coding in heatmap
  dataPoints: BenchmarkDataPoint[];
}

// Category for metric classification
export type MetricCategory =
  | 'electrochemical'   // 电化学性能
  | 'structural'        // 结构参数
  | 'stability'         // 稳定性
  | 'cost'              // 成本参数
  | 'morphology'        // 形貌特征
  | 'synthesis'         // 合成条件
  | 'other';

// A material system row in the comparison matrix
export interface MaterialSystemRow {
  id: string;
  name: string;                // e.g. "Fe-SA/PNC"
  literatureId?: string;       // Linked literature
  isOurs: boolean;             // Is this our project's material
  year?: number;
  source?: string;             // Journal name
}

// Synthesis route comparison
export interface SynthesisComparison {
  id: string;
  materialSystem: string;
  literatureId: string;
  steps: {
    order: number;
    name: string;
    conditions: string;
    duration?: string;
    keyReagents?: string[];
  }[];
  advantages?: string[];
  disadvantages?: string[];
}

// Gap Analysis result from AI
export interface GapAnalysisItem {
  metricName: string;
  ourValue?: number;
  ourUnit?: string;
  bestValue: number;
  bestMaterial: string;
  bestLiterature: string;
  percentile: number;          // Where we rank (0-100, 100 = best)
  gap: number;                 // Percentage gap to best
  status: 'leading' | 'competitive' | 'lagging' | 'no_data';
  suggestion?: string;         // AI recommendation
}

// The main Knowledge Pool container, stored per project
export interface KnowledgePool {
  projectId: string;
  lastUpdated: string;
  totalLiteratureSources: number;
  benchmarks: BenchmarkEntry[];
  materialSystems: MaterialSystemRow[];
  synthesisComparisons?: SynthesisComparison[];
  gapAnalysis?: GapAnalysisItem[];
  aiSummary?: string;          // AI-generated overview of the benchmarking landscape
}

// Normalization mapping from AI
export interface NormalizationMapping {
  originalLabel: string;       // As extracted from literature
  normalizedLabel: string;     // Standardized key
  displayLabel: string;        // Human-friendly display
  unit: string;
  confidence: number;
}
