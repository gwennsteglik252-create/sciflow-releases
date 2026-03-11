
export const L9_MATRIX = [
  [1, 1, 1, 1],
  [1, 2, 2, 2],
  [1, 3, 3, 3],
  [2, 1, 2, 3],
  [2, 2, 3, 1],
  [2, 3, 1, 2],
  [3, 1, 3, 2],
  [3, 2, 1, 3],
  [3, 3, 2, 1]
];

export const L4_MATRIX = [
  [1, 1, 1],
  [1, 2, 2],
  [2, 1, 2],
  [2, 2, 1]
];

export const ANCHOR_MATRIX = [
  [1, 1, 1, 1], // All Low
  [2, 2, 2, 2], // All Center
  [3, 3, 3, 3]  // All High
];

export type IntensityMode = 'screening' | 'standard' | 'ai_inspired';

export const DEFAULT_DOE_PRESETS = [
  {
    id: 'preset_aem_std',
    title: '银基 AEM 催化剂优化 (Silver AEM)',
    factors: [
      { name: '前驱体浓度', unit: 'mM', min: 10, max: 100 },
      { name: 'PVP 比例', unit: 'wt%', min: 1, max: 5 },
      { name: '反应温度', unit: '°C', min: 120, max: 180 },
      { name: '反应时间', unit: 'h', min: 4, max: 12 }
    ],
    responses: [
      { name: '纳米线长径比', unit: 'AR', goal: 'maximize', weight: 8 },
      { name: '产率', unit: '%', goal: 'maximize', weight: 5 }
    ],
    processDescription: '通过多元醇还原法制备银纳米线，优化形貌以提升 AEM 电解槽阳极催化活性。'
  },
  {
    id: 'preset_l9_gen',
    title: 'L9 标准正交通用模板',
    factors: [
      { name: 'Factor A', unit: '-', min: 1, max: 10 },
      { name: 'Factor B', unit: '-', min: 1, max: 10 },
      { name: 'Factor C', unit: '-', min: 1, max: 10 },
      { name: 'Factor D', unit: '-', min: 1, max: 10 }
    ],
    responses: [
      { name: 'Result Y', unit: '-', goal: 'maximize', weight: 1 }
    ],
    processDescription: '通用 4 因子 3 水平标准正交实验设计模板。'
  }
];
