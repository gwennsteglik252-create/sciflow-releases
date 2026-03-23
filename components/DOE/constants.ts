
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
    title: 'Ag-based AEM Catalyst Optimization (Silver AEM)',
    factors: [
      { name: 'Precursor Conc.', unit: 'mM', min: 10, max: 100 },
      { name: 'PVP Ratio', unit: 'wt%', min: 1, max: 5 },
      { name: 'Reaction Temp', unit: '°C', min: 120, max: 180 },
      { name: 'Reaction Time', unit: 'h', min: 4, max: 12 }
    ],
    responses: [
      { name: 'NW Aspect Ratio', unit: 'AR', goal: 'maximize', weight: 8 },
      { name: 'Yield', unit: '%', goal: 'maximize', weight: 5 }
    ],
    processDescription: 'Synthesis of Ag nanowires via polyol reduction method, optimizing morphology to enhance AEM electrolyzer anode catalytic activity.'
  },
  {
    id: 'preset_l9_gen',
    title: 'L9 Standard Orthogonal Template',
    factors: [
      { name: 'Factor A', unit: '-', min: 1, max: 10 },
      { name: 'Factor B', unit: '-', min: 1, max: 10 },
      { name: 'Factor C', unit: '-', min: 1, max: 10 },
      { name: 'Factor D', unit: '-', min: 1, max: 10 }
    ],
    responses: [
      { name: 'Result Y', unit: '-', goal: 'maximize', weight: 1 }
    ],
    processDescription: 'General 4-factor 3-level standard orthogonal experimental design template.'
  }
];
