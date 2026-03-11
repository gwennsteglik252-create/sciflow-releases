
export type AppView = 'dashboard' | 'projects' | 'project_detail' | 'graph' | 'literature' | 'inventory' | 'data' | 'doe' | 'flowchart' | 'writing' | 'figure_center' | 'mechanism' | 'industry_trends' | 'assistant' | 'video_lab' | 'inception' | 'team' | 'characterization_hub' | 'research_brain' | 'research_farm';

export interface PerformanceMetric {
  label: string;
  value: string;
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
