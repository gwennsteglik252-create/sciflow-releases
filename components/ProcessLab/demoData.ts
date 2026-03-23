/**
 * demoData.ts — 工艺实验室示例数据
 * 涵盖配方、批次、工艺流程、物料价格、放大模拟
 * 以 NiFe-LDH/CeO₂ 催化剂制备为蓝本
 */

import { Formulation, ProcessBatch, ProcessFlow } from '../../types';

// ═══ 配方示例数据 ═══
export const DEMO_FORMULATIONS: Formulation[] = [
  {
    id: 'f-demo-001',
    name: 'NiFe-LDH/CeO₂ 复合催化剂',
    version: 'v2.1',
    parentId: 'f-demo-002',
    status: 'validated',
    scaleLevel: 'pilot',
    components: [
      { id: 'c1', role: '前驱体', materialName: '六水合硝酸镍', percentage: 32, amount: 16, unit: 'g' },
      { id: 'c2', role: '前驱体', materialName: '九水合硝酸铁', percentage: 18, amount: 9, unit: 'g' },
      { id: 'c3', role: '添加剂', materialName: '纳米CeO₂', percentage: 12, amount: 6, unit: 'g' },
      { id: 'c4', role: '溶剂', materialName: '去离子水', percentage: 28, amount: 14, unit: 'mL' },
      { id: 'c5', role: '添加剂', materialName: '尿素', percentage: 10, amount: 5, unit: 'g' },
    ],
    targetProperties: [
      { key: '比表面积', target: 120, tolerance: 15, unit: 'm²/g' },
      { key: '孔径', target: 8.5, tolerance: 1.5, unit: 'nm' },
      { key: '过电位@10mA', target: 270, tolerance: 20, unit: 'mV' },
    ],
    totalWeight: 50,
    totalWeightUnit: 'g',
    tags: ['OER', '水电解', 'LDH'],
    createdAt: '2026-03-01',
    updatedAt: '2026-03-14',
  },
  {
    id: 'f-demo-002',
    name: 'NiFe-LDH/CeO₂ 复合催化剂',
    version: 'v1.0',
    status: 'archived',
    scaleLevel: 'lab',
    components: [
      { id: 'c6', role: '前驱体', materialName: '六水合硝酸镍', percentage: 35, amount: 3.5, unit: 'g' },
      { id: 'c7', role: '前驱体', materialName: '九水合硝酸铁', percentage: 20, amount: 2, unit: 'g' },
      { id: 'c8', role: '添加剂', materialName: '纳米CeO₂', percentage: 8, amount: 0.8, unit: 'g' },
      { id: 'c9', role: '溶剂', materialName: '去离子水', percentage: 30, amount: 3, unit: 'mL' },
      { id: 'c10', role: '添加剂', materialName: '尿素', percentage: 7, amount: 0.7, unit: 'g' },
    ],
    targetProperties: [
      { key: '比表面积', target: 95, tolerance: 20, unit: 'm²/g' },
      { key: '过电位@10mA', target: 310, tolerance: 30, unit: 'mV' },
    ],
    totalWeight: 10,
    totalWeightUnit: 'g',
    tags: ['OER', 'LDH'],
    createdAt: '2026-02-10',
    updatedAt: '2026-02-28',
  },
  {
    id: 'f-demo-003',
    name: 'CoFe₂O₄ 尖晶石催化剂',
    version: 'v1.2',
    status: 'testing',
    scaleLevel: 'lab',
    components: [
      { id: 'c11', role: '前驱体', materialName: '四水合醋酸钴', percentage: 40, amount: 4, unit: 'g' },
      { id: 'c12', role: '前驱体', materialName: '九水合硝酸铁', percentage: 25, amount: 2.5, unit: 'g' },
      { id: 'c13', role: '溶剂', materialName: '乙二醇', percentage: 30, amount: 3, unit: 'mL' },
      { id: 'c14', role: '催化剂', materialName: '氢氧化钠', percentage: 5, amount: 0.5, unit: 'g' },
    ],
    targetProperties: [
      { key: '晶粒尺寸', target: 25, tolerance: 5, unit: 'nm' },
      { key: '磁饱和强度', target: 45, tolerance: 8, unit: 'emu/g' },
    ],
    totalWeight: 10,
    totalWeightUnit: 'g',
    tags: ['OER', '尖晶石', '磁性'],
    createdAt: '2026-03-05',
    updatedAt: '2026-03-12',
  },
  {
    id: 'f-demo-004',
    name: 'MoS₂/石墨烯 复合电极',
    version: 'v1.0',
    status: 'draft',
    scaleLevel: 'lab',
    components: [
      { id: 'c15', role: '前驱体', materialName: '钼酸钠', percentage: 22, amount: 2.2, unit: 'g' },
      { id: 'c16', role: '前驱体', materialName: '硫脲', percentage: 18, amount: 1.8, unit: 'g' },
      { id: 'c17', role: '基底', materialName: '氧化石墨烯', percentage: 15, amount: 1.5, unit: 'g' },
      { id: 'c18', role: '溶剂', materialName: '去离子水', percentage: 40, amount: 4, unit: 'mL' },
      { id: 'c19', role: '添加剂', materialName: '柠檬酸', percentage: 5, amount: 0.5, unit: 'g' },
    ],
    targetProperties: [
      { key: '层间距', target: 0.62, tolerance: 0.02, unit: 'nm' },
      { key: '电容', target: 350, tolerance: 50, unit: 'F/g' },
    ],
    totalWeight: 10,
    totalWeightUnit: 'g',
    tags: ['HER', '二维材料', '储能'],
    createdAt: '2026-03-10',
    updatedAt: '2026-03-10',
  },
];

// ═══ 批次示例数据 ═══
const qc = (id: string, checkName: string, standard: string, result: string, passed: boolean) =>
  ({ id, checkName, standard, result, passed, timestamp: '2026-03-15' });

export const DEMO_BATCHES: ProcessBatch[] = [
  {
    id: 'b-demo-001', batchNumber: 'B-2026-0301',
    formulationId: 'f-demo-001', formulationName: 'NiFe-LDH/CeO₂ 复合催化剂', formulationVersion: 'v2.1',
    status: 'completed', operator: '张明', yield: 97.2, cpk: 1.58,
    startTime: '2026-03-01', endTime: '2026-03-02',
    parameters: [
      { key: '温度', target: 80, actual: 79.5, unit: '°C', isInSpec: true },
      { key: 'pH', target: 10, actual: 10.1, unit: '', isInSpec: true },
      { key: '煅烧温度', target: 400, actual: 398, unit: '°C', isInSpec: true },
    ],
    qualityChecks: [
      qc('qc1', 'XRD 物相纯度', '无杂峰', '纯相 LDH', true),
      qc('qc2', '比表面积', '≥105 m²/g', '118 m²/g', true),
      qc('qc3', '过电位@10mA', '≤290 mV', '265 mV', true),
    ],
    notes: '批次表现优异，参数稳定',
  },
  {
    id: 'b-demo-002', batchNumber: 'B-2026-0305',
    formulationId: 'f-demo-001', formulationName: 'NiFe-LDH/CeO₂ 复合催化剂', formulationVersion: 'v2.1',
    status: 'completed', operator: '李薇', yield: 94.8, cpk: 1.32,
    startTime: '2026-03-05', endTime: '2026-03-06',
    parameters: [
      { key: '温度', target: 80, actual: 83, unit: '°C', isInSpec: false },
      { key: 'pH', target: 10, actual: 9.8, unit: '', isInSpec: true },
    ],
    qualityChecks: [
      qc('qc4', 'XRD 物相纯度', '无杂峰', '纯相 LDH', true),
      qc('qc5', '比表面积', '≥105 m²/g', '108 m²/g', true),
      qc('qc6', '过电位@10mA', '≤290 mV', '295 mV', false),
    ],
    notes: '温度偏高 3°C，过电位略超标',
  },
  {
    id: 'b-demo-003', batchNumber: 'B-2026-0308',
    formulationId: 'f-demo-001', formulationName: 'NiFe-LDH/CeO₂ 复合催化剂', formulationVersion: 'v2.1',
    status: 'completed', operator: '张明', yield: 98.5, cpk: 1.92,
    startTime: '2026-03-08', endTime: '2026-03-09',
    parameters: [
      { key: '温度', target: 80, actual: 80.2, unit: '°C', isInSpec: true },
      { key: '煅烧温度', target: 400, actual: 401, unit: '°C', isInSpec: true },
    ],
    qualityChecks: [
      qc('qc7', 'XRD 物相纯度', '无杂峰', '纯相 LDH', true),
      qc('qc8', '比表面积', '≥105 m²/g', '125 m²/g', true),
      qc('qc9', '过电位@10mA', '≤290 mV', '258 mV', true),
      qc('qc10', '稳定性测试 10h', '≤5%', '衰减 2.1%', true),
    ],
    notes: '最优批次，各指标优异',
  },
  {
    id: 'b-demo-004', batchNumber: 'B-2026-0310',
    formulationId: 'f-demo-001', formulationName: 'NiFe-LDH/CeO₂ 复合催化剂', formulationVersion: 'v2.1',
    status: 'rejected', operator: '王刚', yield: 82.3, cpk: 0.76,
    startTime: '2026-03-10', endTime: '2026-03-11',
    parameters: [
      { key: '温度', target: 80, actual: 72, unit: '°C', isInSpec: false },
      { key: 'pH', target: 10, actual: 8.5, unit: '', isInSpec: false },
    ],
    qualityChecks: [
      qc('qc11', 'XRD 物相纯度', '无杂峰', '含 NiO 杂相', false),
      qc('qc12', '比表面积', '≥105 m²/g', '78 m²/g', false),
      qc('qc13', '过电位@10mA', '≤290 mV', '345 mV', false),
    ],
    notes: '温度和pH严重偏低，产品不合格',
  },
  {
    id: 'b-demo-005', batchNumber: 'B-2026-0312',
    formulationId: 'f-demo-001', formulationName: 'NiFe-LDH/CeO₂ 复合催化剂', formulationVersion: 'v2.1',
    status: 'completed', operator: '李薇', yield: 96.1, cpk: 1.45,
    startTime: '2026-03-12', endTime: '2026-03-13',
    parameters: [],
    qualityChecks: [
      qc('qc14', 'XRD 物相纯度', '无杂峰', '纯相 LDH', true),
      qc('qc15', '比表面积', '≥105 m²/g', '115 m²/g', true),
      qc('qc16', '过电位@10mA', '≤290 mV', '272 mV', true),
    ],
    notes: '',
  },
  {
    id: 'b-demo-006', batchNumber: 'B-2026-0314',
    formulationId: 'f-demo-001', formulationName: 'NiFe-LDH/CeO₂ 复合催化剂', formulationVersion: 'v2.1',
    status: 'in_progress', operator: '张明', yield: 0, cpk: undefined,
    startTime: '2026-03-14',
    parameters: [],
    qualityChecks: [],
    notes: '生产中...',
  },
  {
    id: 'b-demo-007', batchNumber: 'B-2026-0315',
    formulationId: 'f-demo-003', formulationName: 'CoFe₂O₄ 尖晶石催化剂', formulationVersion: 'v1.2',
    status: 'completed', operator: '王刚', yield: 91.5, cpk: 1.15,
    startTime: '2026-03-15', endTime: '2026-03-16',
    parameters: [],
    qualityChecks: [
      qc('qc17', '晶粒尺寸 XRD', '20-30 nm', '27 nm', true),
      qc('qc18', '磁饱和强度', '≥37 emu/g', '42 emu/g', true),
    ],
    notes: '',
  },
  {
    id: 'b-demo-008', batchNumber: 'B-2026-0316',
    formulationId: 'f-demo-003', formulationName: 'CoFe₂O₄ 尖晶石催化剂', formulationVersion: 'v1.2',
    status: 'reworked', operator: '李薇', yield: 88.0, cpk: 0.95,
    startTime: '2026-03-16',
    parameters: [],
    qualityChecks: [
      qc('qc19', '晶粒尺寸 XRD', '20-30 nm', '23 nm', true),
      qc('qc20', '磁饱和强度', '≥37 emu/g', '34 emu/g', false),
    ],
    notes: '磁性偏低，增加煅烧温度返工',
  },
];

// ═══ 工艺流程示例数据 ═══
export const DEMO_FLOWS: ProcessFlow[] = [
  {
    id: 'flow-demo-001',
    name: 'NiFe-LDH/CeO₂ 共沉淀法',
    version: 'v2.0',
    formulationId: 'f-demo-001',
    steps: [
      {
        id: 's1', name: '前驱体溶液配制', type: 'mixing',
        parameters: [
          { key: '搅拌速度', target: 300, min: 250, max: 350, unit: 'rpm' },
          { key: '温度', target: 25, min: 20, max: 30, unit: '°C' },
        ],
        isCriticalControlPoint: false, duration: 30, durationUnit: 'min', equipment: '磁力搅拌器',
      },
      {
        id: 's2', name: '共沉淀反应', type: 'heating',
        parameters: [
          { key: '反应温度', target: 80, min: 78, max: 82, unit: '°C' },
          { key: 'pH', target: 10, min: 9.5, max: 10.5, unit: '' },
          { key: '反应时间', target: 120, min: 110, max: 130, unit: 'min' },
        ],
        isCriticalControlPoint: true, duration: 2, durationUnit: 'h', equipment: '恒温水浴', qcCheckpoint: 'pH 实时监控',
      },
      {
        id: 's3', name: '离心洗涤', type: 'filtration',
        parameters: [
          { key: '转速', target: 8000, min: 7000, max: 9000, unit: 'rpm' },
          { key: '洗涤次数', target: 3, min: 3, max: 5, unit: '次' },
        ],
        isCriticalControlPoint: false, duration: 45, durationUnit: 'min', equipment: '高速离心机',
      },
      {
        id: 's4', name: '真空干燥', type: 'drying',
        parameters: [
          { key: '温度', target: 60, min: 55, max: 65, unit: '°C' },
          { key: '真空度', target: -0.08, min: -0.1, max: -0.06, unit: 'MPa' },
        ],
        isCriticalControlPoint: false, duration: 12, durationUnit: 'h', equipment: '真空干燥箱',
      },
      {
        id: 's5', name: '研磨过筛', type: 'milling',
        parameters: [
          { key: '目标粒径', target: 5, min: 3, max: 8, unit: 'μm' },
        ],
        isCriticalControlPoint: false, duration: 20, durationUnit: 'min', equipment: '玛瑙研钵',
      },
      {
        id: 's6', name: '低温煅烧', type: 'calcination',
        parameters: [
          { key: '煅烧温度', target: 400, min: 390, max: 410, unit: '°C' },
          { key: '升温速率', target: 2, min: 1, max: 3, unit: '°C/min' },
          { key: '保温时间', target: 2, min: 1.5, max: 2.5, unit: 'h' },
        ],
        isCriticalControlPoint: true, duration: 5, durationUnit: 'h', equipment: '马弗炉', qcCheckpoint: '温度曲线记录',
      },
      {
        id: 's7', name: '成品检测', type: 'testing',
        parameters: [
          { key: 'BET 表面积', target: 120, min: 105, max: 150, unit: 'm²/g' },
        ],
        isCriticalControlPoint: true, duration: 60, durationUnit: 'min', equipment: 'XRD/BET', qcCheckpoint: '物相/比表面积/电化学',
      },
    ],
    createdAt: '2026-03-01',
    updatedAt: '2026-03-14',
    notes: '标准共沉淀工艺，CeO₂ 在溶液阶段加入',
  },
  {
    id: 'flow-demo-002',
    name: 'CoFe₂O₄ 溶剂热法',
    version: 'v1.0',
    formulationId: 'f-demo-003',
    steps: [
      {
        id: 's8', name: '前驱体溶解', type: 'mixing',
        parameters: [{ key: '温度', target: 50, min: 45, max: 55, unit: '°C' }],
        isCriticalControlPoint: false, duration: 20, durationUnit: 'min',
      },
      {
        id: 's9', name: '碱性沉淀', type: 'mixing',
        parameters: [{ key: 'NaOH 浓度', target: 2, min: 1.5, max: 2.5, unit: 'M' }],
        isCriticalControlPoint: true, duration: 15, durationUnit: 'min',
      },
      {
        id: 's10', name: '水热反应', type: 'heating',
        parameters: [
          { key: '反应温度', target: 180, min: 175, max: 185, unit: '°C' },
          { key: '反应时间', target: 12, min: 10, max: 14, unit: 'h' },
        ],
        isCriticalControlPoint: true, duration: 12, durationUnit: 'h', equipment: '高压反应釜',
      },
      {
        id: 's11', name: '洗涤干燥', type: 'drying',
        parameters: [{ key: '干燥温度', target: 80, min: 75, max: 85, unit: '°C' }],
        isCriticalControlPoint: false, duration: 8, durationUnit: 'h',
      },
      {
        id: 's12', name: '高温煅烧', type: 'calcination',
        parameters: [
          { key: '煅烧温度', target: 600, min: 580, max: 620, unit: '°C' },
          { key: '保温时间', target: 3, min: 2, max: 4, unit: 'h' },
        ],
        isCriticalControlPoint: true, duration: 6, durationUnit: 'h',
      },
    ],
    createdAt: '2026-03-05',
    updatedAt: '2026-03-12',
  },
];

// ═══ 物料价格示例数据 ═══
export const DEMO_MATERIAL_PRICES = [
  { materialName: '六水合硝酸镍', unitPrice: 0.85, unit: '/g' },
  { materialName: '九水合硝酸铁', unitPrice: 0.45, unit: '/g' },
  { materialName: '纳米CeO₂', unitPrice: 12.5, unit: '/g' },
  { materialName: '去离子水', unitPrice: 0.002, unit: '/mL' },
  { materialName: '尿素', unitPrice: 0.08, unit: '/g' },
  { materialName: '四水合醋酸钴', unitPrice: 2.8, unit: '/g' },
  { materialName: '乙二醇', unitPrice: 0.15, unit: '/mL' },
  { materialName: '氢氧化钠', unitPrice: 0.05, unit: '/g' },
  { materialName: '钼酸钠', unitPrice: 3.2, unit: '/g' },
  { materialName: '硫脲', unitPrice: 0.35, unit: '/g' },
  { materialName: '氧化石墨烯', unitPrice: 85, unit: '/g' },
  { materialName: '柠檬酸', unitPrice: 0.12, unit: '/g' },
];

// ═══ 中试放大模拟示例数据 ═══
export const DEMO_SCALEUP_RECORDS = [
  {
    id: 'su-demo-001',
    name: 'NiFe-LDH/CeO₂ 共沉淀放大',
    formulationId: 'f-demo-001',
    formulationName: 'NiFe-LDH/CeO₂ 复合催化剂 (v2.1)',
    labBatchSize: '50',
    pilotBatchSize: '2000',
    prodBatchSize: '50000',
    batchUnit: 'g',
    params: [
      { key: '搅拌速度', labValue: '300', pilotValue: '150', prodValue: '80', unit: 'rpm', risk: 'high' as const, notes: '放大后需降速防止涡流' },
      { key: '反应温度', labValue: '80', pilotValue: '80', prodValue: '82', unit: '°C', risk: 'medium' as const, notes: '大罐传热不均需补偿' },
      { key: 'pH 控制', labValue: '10.0', pilotValue: '9.8-10.2', prodValue: '9.5-10.5', unit: '', risk: 'high' as const, notes: '放大后pH均匀性下降' },
      { key: '反应时间', labValue: '120', pilotValue: '150', prodValue: '180', unit: 'min', risk: 'medium' as const, notes: '放大后混合效率降低' },
      { key: '离心转速', labValue: '8000', pilotValue: '4000', prodValue: '—', unit: 'rpm', risk: 'critical' as const, notes: '量产改用板框压滤' },
      { key: '干燥时间', labValue: '12', pilotValue: '24', prodValue: '36', unit: 'h', risk: 'low' as const, notes: '可并行多批干燥' },
      { key: '煅烧均匀性', labValue: '优', pilotValue: '良', prodValue: '需验证', unit: '', risk: 'high' as const, notes: '大马弗炉温场不均' },
    ],
    createdAt: '2026-03-10',
  },
  {
    id: 'su-demo-002',
    name: 'CoFe₂O₄ 溶剂热放大',
    formulationId: 'f-demo-003',
    formulationName: 'CoFe₂O₄ 尖晶石催化剂 (v1.2)',
    labBatchSize: '10',
    pilotBatchSize: '500',
    prodBatchSize: '5000',
    batchUnit: 'g',
    params: [
      { key: '反应温度', labValue: '180', pilotValue: '180', prodValue: '180', unit: '°C', risk: 'low' as const, notes: '高压釜可良好控温' },
      { key: '反应压力', labValue: '自生压', pilotValue: '~1.2 MPa', prodValue: '~1.5 MPa', unit: 'MPa', risk: 'critical' as const, notes: '量产需工业级高压釜' },
      { key: 'NaOH 加料速度', labValue: '滴加', pilotValue: '蠕动泵', prodValue: '计量泵', unit: '', risk: 'medium' as const, notes: '加料均匀性影响粒径' },
      { key: '煅烧温度', labValue: '600', pilotValue: '600', prodValue: '610', unit: '°C', risk: 'medium' as const, notes: '补偿大炉温度梯度' },
    ],
    createdAt: '2026-03-12',
  },
];
