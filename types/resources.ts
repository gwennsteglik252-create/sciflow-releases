import { PerformanceMetric } from './base';

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

  // Pin to top
  pinned?: boolean;

  // Deep Reading Session Persistence
  deepReadChatHistory?: { role: 'user' | 'model'; text: string; quote?: string }[];
  deepReadAnalysis?: {
    executiveSummary: string;
    glossary: { term: string; definition: string }[];
    keyQuestions: string[];
    conceptTree?: { label: string; icon: string; children: { label: string; detail: string }[] }[];
  };
  deepReadPinnedNotes?: { id: string; text: string; context?: string; timestamp: string }[];
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
}

export type InventoryCategory = 'Chemical' | 'Hardware' | 'Consumable' | 'Precursor';
export type SafetyLevel =
  | 'Safe' | 'Corrosive' | 'Flammable' | 'Toxic' | 'Explosive'
  | 'General' | 'Precision' | 'Hazardous' | 'Restricted';

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
}

export type TrendCategory = 'Technology' | 'Market' | 'Policy' | 'Competitor';