
export type EngineMode = 'CV' | 'LSV' | 'OER' | 'ECSA' | 'RDE' | 'EIS';

export interface DataPoint {
  x: number; // Generic X (Potential, Z', omega^-0.5, Scan Rate)
  y: number; // Generic Y (Current, -Z'', 1/j, Current Diff)
  z?: number; // Optional Z dimension
}

export interface FitRange {
  min: number;
  max: number;
}

export type FitMode = 'auto' | 'manual';

export interface TafelFitResult {
  slope: number;       // mV/dec
  intercept: number;
  r2: number;
  fitRange: FitRange;  // overpotential range used
  onsetPotential: number;
  exchangeCurrentDensity: number;
}

export interface ElectroQcReport {
  totalPoints: number;
  validPoints: number;
  invalidRemoved: number;
  duplicateMerged: number;
  unitDetected: string;   // e.g. 'mA/cm²', 'A', 'mA'
  warnings: string[];
}

export interface AnalysisResult {
  halfWavePotential?: number;
  tafelSlope?: number;
  limitingCurrent?: number;
  peakAnodic?: { v: number, j: number };
  peakCathodic?: { v: number, j: number };
  cdl?: number;
  ecsa?: number;
  roughnessFactor?: number;
  electronTransferNum?: number;
  kineticCurrent?: number;
  rs?: number;
  rct?: number;
  cpe?: number;
  col?: number;
  // --- Enhanced fields ---
  onsetPotential?: number;
  massActivity?: number;
  specificActivity?: number;
  tafelFit?: TafelFitResult;
  peakSeparation?: number;      // CV: ΔEp = Epa - Epc
  anodicCathodicRatio?: number;  // CV: |Ipa/Ipc|
  diffusionCoeff?: number;      // RDE: D from K-L
  klSlope?: number;             // K-L slope
  klIntercept?: number;         // K-L intercept
  klR2?: number;                // K-L R²
  warburgCoeff?: number;        // EIS: Warburg coefficient
  cpeExponent?: number;         // EIS: CPE exponent (n)
  // --- OER fields ---
  oerOverpotential?: number;    // OER: η@10 mA/cm²
  oerOnsetPotential?: number;   // OER: onset potential (V vs RHE)
  oerTafelSlope?: number;       // OER: Tafel slope (mV/dec)
  oerTafelFit?: TafelFitResult;
  oerMassActivity?: number;     // OER: mass activity @1.6V (A/g)
  // --- Stability ---
  stabilityRetention?: number;  // % retention after cycling
  potentialShift?: number;      // mV shift after stability test
  qcReport?: ElectroQcReport;
}

export interface SensitivityCell {
  min: number;
  max: number;
  tafelSlope: number;
  r2: number;
}

export interface ElectroRecord {
  id: string;
  title: string;
  mode: EngineMode;
  timestamp: string;
  folder?: {
    projectId?: string;
    projectTitle?: string;
    milestoneId?: string;
    milestoneTitle?: string;
    logId?: string;
    logTitle?: string;
    path?: string;
  };
  data: {
    rawData: string;
    processedData: DataPoint[];
    analysisResult: AnalysisResult | null;
    aiConclusion: string | null;
    aiDeepAnalysis?: string | null;
    tafelFitRange: FitRange;
    tafelFitMode: FitMode;
    params: ElectroParams;
  };
}

export interface ElectroParams {
  electrodeArea: number;      // cm²
  scanRate: number;           // mV/s
  rotationSpeed: number;      // rpm (RDE)
  iRCompensation: boolean;
  solutionResistance: number; // Ω
  catalystLoading: number;    // mg/cm²
  referencePotential: number; // V vs. RHE offset
}

export interface CompareSample {
  id: string;
  title: string;
  mode: EngineMode;
  result: AnalysisResult;
  data: DataPoint[];
  color: string;
}

export const DEFAULT_ELECTRO_PARAMS: ElectroParams = {
  electrodeArea: 0.196,       // typical RDE area
  scanRate: 10,               // mV/s
  rotationSpeed: 1600,        // rpm
  iRCompensation: false,
  solutionResistance: 0,
  catalystLoading: 0.2,       // mg/cm²
  referencePotential: 0,
};

export const DEFAULT_TAFEL_FIT_RANGE: FitRange = { min: 0.02, max: 0.12 };

export const COMPARE_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'
];

// ==================== 双功能催化剂专用类型 ====================

export interface RadarDimension {
  axis: string;       // 维度名称
  value: number;      // 归一化值 0-1
  rawValue: number;   // 原始值
  unit: string;       // 单位
  optimal: 'high' | 'low';  // 越高越好还是越低越好
}

export interface BifunctionalMetrics {
  deltaE: number;             // ΔE = E_OER@10 - E½_ORR (V)
  orrHalfWave: number;        // E½ ORR (V vs RHE)
  oerOverpotential: number;   // η@10 OER (mV)
  orrTafelSlope: number;      // ORR Tafel slope (mV/dec)
  oerTafelSlope: number;      // OER Tafel slope (mV/dec)
  electronTransferNum: number;// n (from K-L)
  ecsa: number;               // ECSA (cm²)
  massActivityORR: number;    // ORR mass activity @0.9V (A/g)
  rating: 'excellent' | 'good' | 'moderate' | 'poor';
  radar: RadarDimension[];
}

// 文献基准值
export const BENCHMARK_CATALYSTS: Record<string, { label: string; deltaE: number; color: string }> = {
  'Pt/C': { label: '20% Pt/C', deltaE: 0.82, color: '#94a3b8' },
  'RuO2': { label: 'RuO₂', deltaE: 0.78, color: '#f59e0b' },
  'IrO2': { label: 'IrO₂', deltaE: 0.75, color: '#8b5cf6' },
};
