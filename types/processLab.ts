// ═══ SciFlow Pro — 工业工艺实验室 (ProcessLab) 类型定义 ═══

/** 配方状态 */
export type FormulationStatus = 'draft' | 'testing' | 'validated' | 'production' | 'archived';

/** 配方组分 */
export interface FormulationComponent {
  id: string;
  materialName: string;
  materialId?: string; // 关联库存管理 (Inventory) 的物料 ID
  percentage: number;  // 重量/体积百分比
  amount: number;      // 实际用量
  unit: string;        // g, mL, kg, L ...
  purity?: string;     // 纯度等级
  casNo?: string;
  role: string;        // 前驱体、溶剂、添加剂、基底 ...
  notes?: string;
}

/** 目标性能指标 */
export interface TargetProperty {
  key: string;         // e.g. '电流密度', '比表面积'
  target: number;
  tolerance: number;   // ±
  unit: string;        // mA/cm², m²/g ...
  actual?: number;     // 实测值
}

/** 配方版本 */
export interface Formulation {
  id: string;
  name: string;
  version: string;           // v1.0, v1.1, v2.0 ...
  parentId?: string;         // 版本前驱 (用于版本树)
  status: FormulationStatus;
  components: FormulationComponent[];
  targetProperties: TargetProperty[];
  scaleLevel: 'lab' | 'pilot' | 'production'; // 实验室 / 中试 / 量产
  totalWeight?: number;      // 总配料量
  totalWeightUnit?: string;  // g, kg, ton
  linkedDoeRunId?: string;   // 来源 DOE 实验 ID
  linkedProjectId?: string;  // 关联课题 ID
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  notes?: string;
  tags?: string[];
}

/** 批次状态 */
export type BatchStatus = 'preparing' | 'in_progress' | 'completed' | 'rejected' | 'reworked';

/** 工艺参数记录 */
export interface ProcessParameterRecord {
  key: string;          // e.g. '搅拌速度', '加热温度'
  target: number;
  actual: number;
  unit: string;
  deviation?: number;   // 偏离百分比
  isInSpec: boolean;     // 是否在规格范围内
}

/** 质量检测结果 */
export interface QualityCheckResult {
  id: string;
  checkName: string;     // e.g. 'XRD 物相检测', '粒径 D50'
  standard: string;      // 标准/规格 e.g. 'D50 < 5μm'
  result: string;        // 实际结果
  passed: boolean;
  method?: string;       // 检测方法
  timestamp: string;
}

/** 生产批次 */
export interface ProcessBatch {
  id: string;
  batchNumber: string;            // B-2026-0312
  formulationId: string;          // 关联配方版本
  formulationName?: string;       // 配方名称 (冗余, 方便展示)
  formulationVersion?: string;    // 配方版本 (冗余)
  parameters: ProcessParameterRecord[];
  qualityChecks: QualityCheckResult[];
  yield: number;                  // 良率 %
  outputQuantity?: number;        // 产出量
  outputUnit?: string;            // g, kg ...
  cpk?: number;                   // 过程能力指数
  operator: string;
  equipment?: string;             // 使用设备
  startTime: string;
  endTime?: string;
  status: BatchStatus;
  defectSummary?: string;         // 缺陷归因摘要
  notes?: string;
  linkedProjectId?: string;
  tags?: string[];
}

/** 工艺实验室汇总统计 */
export interface ProcessLabStats {
  totalFormulations: number;
  activeFormulations: number;
  totalBatches: number;
  completedBatches: number;
  avgYield: number;
  avgCpk: number;
  passRate: number;
}

/** 工序类型 */
export type ProcessStepType = 'mixing' | 'heating' | 'drying' | 'coating' | 'milling' | 'calcination' | 'filtration' | 'testing' | 'other';

/** 工艺步骤 */
export interface ProcessStep {
  id: string;
  name: string;
  type: ProcessStepType;
  parameters: {
    key: string;
    target: number;
    min: number;
    max: number;
    unit: string;
  }[];
  isCriticalControlPoint: boolean; // CCP 关键控制点
  duration: number;    // 分钟
  durationUnit: 'min' | 'h';
  equipment?: string;
  qcCheckpoint?: string;
  notes?: string;
}

/** 工艺流程 */
export interface ProcessFlow {
  id: string;
  name: string;
  version: string;
  formulationId?: string;  // 关联配方
  steps: ProcessStep[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}
