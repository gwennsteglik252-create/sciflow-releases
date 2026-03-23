// ═══ SciFlow Pro — Mechanism Workshop 类型定义 ═══

/** 反应模式 */
export type ReactionMode = 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';

/** 可视化模式 */
export type VisualizationMode = 'volcano_plot' | 'stability_map' | 'energy_barrier' | 'lattice_view' | 'dos_analysis' | 'synergy_coupling';

/** 物理常数 */
export interface PhysicalConstants {
  energySteps: number[];
  tafelSlope: number;
  exchangeCurrentDensity: string | number;
  eta10: number;
  activationEnergy?: number;
  dataSource?: string;
  sourceRef?: string;
  uncertainty?: number;
}

/** 稳定性预测 */
export interface StabilityPrediction {
  safetyIndex: number;
  status: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  desc: string;
  thermodynamicRisk: string | null;
  auditSource?: 'local' | 'hybrid' | 'ai';
  regionId?: string;
  dimensions?: any;
  descSections?: any[];
}

/** 掺杂配置 */
export interface DopingConfig {
  element: string;
  concentration: number;
}

/** 对比矩阵中的模拟方案 */
export interface Simulation {
  id: string;
  name: string;
  timestamp: string;
  material: string;
  doping: DopingConfig;
  loading: number;
  reactionMode: ReactionMode;
  pH: number;
  potential: number;
  physicalConstants: PhysicalConstants | null;
  stabilityPrediction: StabilityPrediction | null;
  analysisResult: string | null;
}

/** 矩阵库条目 */
export interface MatrixLibraryEntry {
  id: string;
  name: string;
  simulations: Simulation[];
  timestamp: string;
  aiInsight?: string;
}

/** 推演模板参数 */
export interface MechanismTemplateParams {
  material: string;
  reactionMode: ReactionMode;
  pH: number;
  potential: number;
  dopingElement: string;
  dopingConcentration: number;
  coDopingElement?: string;
  coDopingConcentration?: number;
  unitCellType: string;
  massLoading?: number;
}

/** 推演模板 */
export interface MechanismTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  category: string;
  params: MechanismTemplateParams;
  isCustom?: boolean;
}

/** AI 辩论专家角色 */
export interface DebateExpert {
  id: string;
  name: string;
  nameEn: string;
  title: string;
  icon: string;
  color: string;
  perspective: string;
}

/** 辩论条目 */
export interface DebateEntry {
  expertId: string;
  content: string;
  round: number;
}

/** 辩论会话 */
export interface DebateSession {
  entries: DebateEntry[];
  conclusion: string | null;
  isDebating: boolean;
  currentRound: number;
}

/** LSV 曲线数据点 */
export interface LsvPoint {
  v: number;
  jDoped: number;
  jBase: number;
  jDecay: number;
}

/** Benchmark 结果 */
export interface BenchmarkResult {
  error: number;
  jSim: number;
  vReal: number;
  jReal: number;
}
