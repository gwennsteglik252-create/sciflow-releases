// ═══ SciFlow Pro — 机理推演预设模板库 ═══

import type { MechanismTemplate } from './types';

/**
 * 内置反应类型模板
 * 每个模板包含典型的材料和反应条件，用户可一键加载
 */
export const BUILTIN_TEMPLATES: MechanismTemplate[] = [
  {
    id: 'tpl_oer_nife_ldh',
    name: 'OER 析氧催化',
    icon: 'fa-solid fa-bolt-lightning',
    color: 'indigo',
    description: 'NiFe-LDH 层状双氢氧化物在强碱 (pH=14) 条件下的析氧反应。典型电催化水分解阳极材料。',
    category: '水分解',
    params: {
      material: 'NiFe-LDH',
      reactionMode: 'OER',
      pH: 14,
      potential: 1.5,
      dopingElement: 'Fe',
      dopingConcentration: 25,
      unitCellType: 'Layered (LDH)',
      massLoading: 0.28,
    }
  },
  {
    id: 'tpl_her_mos2',
    name: 'HER 析氢催化',
    icon: 'fa-solid fa-droplet',
    color: 'cyan',
    description: 'MoS₂ 在强酸 (pH=0) 条件下的析氢反应。边缘活性位点是 HER 活性的关键。',
    category: '水分解',
    params: {
      material: 'MoS₂',
      reactionMode: 'HER',
      pH: 0,
      potential: -0.3,
      dopingElement: 'Co',
      dopingConcentration: 5,
      unitCellType: 'Layered (LDH)',
      massLoading: 0.5,
    }
  },
  {
    id: 'tpl_orr_ptc',
    name: 'ORR 氧还原',
    icon: 'fa-solid fa-wind',
    color: 'emerald',
    description: 'Pt/C 催化剂在酸性 (pH=1) 条件下的氧还原反应。燃料电池阴极核心反应。',
    category: '燃料电池',
    params: {
      material: 'Pt/C',
      reactionMode: 'ORR',
      pH: 1,
      potential: 0.9,
      dopingElement: 'Ni',
      dopingConcentration: 10,
      unitCellType: 'FCC (面心立方)',
      massLoading: 0.2,
    }
  },
  {
    id: 'tpl_bifunctional',
    name: 'Bifunctional 双功能',
    icon: 'fa-solid fa-arrows-left-right',
    color: 'violet',
    description: 'CoFe₂O₄ 尖晶石在碱性 (pH=14) 条件下同时催化 OER 和 ORR。锌空气电池核心材料。',
    category: '金属-空气电池',
    params: {
      material: 'CoFe₂O₄',
      reactionMode: 'BIFUNCTIONAL',
      pH: 14,
      potential: 1.5,
      dopingElement: 'Mn',
      dopingConcentration: 8,
      unitCellType: 'Simple Cubic',
      massLoading: 0.35,
    }
  },
  {
    id: 'tpl_co2rr_cu_sac',
    name: 'CO₂RR 二氧化碳还原',
    icon: 'fa-solid fa-cloud',
    color: 'amber',
    description: 'Cu 单原子催化剂在中性 (pH=7) 条件下的 CO₂ 电还原反应。绿色碳循环关键技术。',
    category: '碳循环',
    params: {
      material: 'Cu-SAC',
      reactionMode: 'OER', // CO₂RR 在UI中映射为 OER 的参数化路径
      pH: 7,
      potential: -1.0,
      dopingElement: 'N',
      dopingConcentration: 15,
      unitCellType: 'SAC (Carbon Framework)',
      massLoading: 0.1,
    }
  },
  {
    id: 'tpl_perovskite_oer',
    name: '钙钛矿 OER',
    icon: 'fa-solid fa-cube',
    color: 'rose',
    description: 'Ba₀.₅Sr₀.₅Co₀.₈Fe₀.₂O₃₋δ (BSCF) 钙钛矿氧化物在碱性环境下的高效析氧催化。',
    category: '水分解',
    params: {
      material: 'BSCF-Perovskite',
      reactionMode: 'OER',
      pH: 13,
      potential: 1.55,
      dopingElement: 'Fe',
      dopingConcentration: 20,
      coDopingElement: 'Co',
      coDopingConcentration: 30,
      unitCellType: 'Perovskite',
      massLoading: 0.3,
    }
  },
];

/** localStorage key for custom templates */
export const CUSTOM_TEMPLATES_KEY = 'sciflow_mechanism_templates_v1';

/** 加载自定义模板 */
export const loadCustomTemplates = (): MechanismTemplate[] => {
  try {
    const saved = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};

/** 保存自定义模板 */
export const saveCustomTemplates = (templates: MechanismTemplate[]) => {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
};
