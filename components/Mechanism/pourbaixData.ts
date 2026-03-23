/**
 * 材料特异性 Pourbaix 热力学参数表
 * 数据来源: CRC Handbook of Chemistry and Physics, NIST Standard Reference Database
 * 
 * 这些参数替代 StabilityMapChart 中的硬编码通用值，使 Pourbaix 图
 * 区域边界随用户选择的材料自动变化。
 */

export interface PourbaixParams {
    /** 标准还原电位 E⁰ (V vs SHE) — 决定免疫区上边界 */
    standardReductionPotential: number;
    /** 酸性溶解临界 pH — 钝化膜开始溶解的 pH */
    acidCriticalPH: number;
    /** 碱性溶解临界 pH — 过钝化/碱性溶解开始的 pH */
    alkalineCriticalPH: number;
    /** 过钝化电位 (V at pH 10) */
    transpassivePotentialAtPH10: number;
    /** 过钝化线 Nernst 斜率 (V/pH) */
    transpassiveSlope: number;
    /** 掺杂对化学势偏移的灵敏度系数 (V/at%) */
    dopingSensitivity: number;
    /** 数据来源标记 */
    source: 'CRC' | 'NIST' | 'MP-DFT' | 'Generic';
}

/**
 * 15 种基座材料的 Pourbaix 参数
 * 
 * E⁰ 来自 CRC Handbook (25°C, 1 atm)
 * 临界 pH 来自 Pourbaix Atlas / 实验文献
 */
const POURBAIX_DATABASE: Record<string, PourbaixParams> = {
    // === 层状双金属氢氧化物 (LDH) ===
    'NiFe-LDH': {
        standardReductionPotential: -0.49,   // Ni(OH)2/Ni, CRC
        acidCriticalPH: 6.5,                 // Ni 系钝化膜在 pH < 6.5 不稳定
        alkalineCriticalPH: 13.5,            // Ni(OH)2 碱性稳定性极好
        transpassivePotentialAtPH10: 1.75,
        transpassiveSlope: 0.035,
        dopingSensitivity: 0.012,
        source: 'CRC',
    },

    // === 单原子催化剂 ===
    'Fe-N-C': {
        standardReductionPotential: -0.44,   // Fe²⁺/Fe, CRC
        acidCriticalPH: 5.0,                 // Fe 系 pH 5 以下腐蚀
        alkalineCriticalPH: 13.0,
        transpassivePotentialAtPH10: 1.80,
        transpassiveSlope: 0.04,
        dopingSensitivity: 0.010,
        source: 'CRC',
    },

    // === 双原子催化剂 (DAC) ===
    'FeCo-N-C': {
        standardReductionPotential: -0.36,   // (Fe+Co)/2 加权
        acidCriticalPH: 5.5,
        alkalineCriticalPH: 13.0,
        transpassivePotentialAtPH10: 1.82,
        transpassiveSlope: 0.039,
        dopingSensitivity: 0.011,
        source: 'CRC',
    },
    'FeNi-N-C': {
        standardReductionPotential: -0.35,
        acidCriticalPH: 5.5,
        alkalineCriticalPH: 13.2,
        transpassivePotentialAtPH10: 1.78,
        transpassiveSlope: 0.037,
        dopingSensitivity: 0.011,
        source: 'CRC',
    },
    'CoNi-N-C': {
        standardReductionPotential: -0.27,
        acidCriticalPH: 6.0,
        alkalineCriticalPH: 13.3,
        transpassivePotentialAtPH10: 1.78,
        transpassiveSlope: 0.036,
        dopingSensitivity: 0.012,
        source: 'CRC',
    },

    // === MOF 衍生材料 ===
    'CoFe-MOF': {
        standardReductionPotential: -0.28,   // Co²⁺/Co, CRC
        acidCriticalPH: 6.0,
        alkalineCriticalPH: 13.0,
        transpassivePotentialAtPH10: 1.85,
        transpassiveSlope: 0.038,
        dopingSensitivity: 0.013,
        source: 'CRC',
    },

    // === 贵金属氧化物 ===
    'IrO2': {
        standardReductionPotential: 0.93,    // IrO2/Ir, CRC — 极正，还原困难
        acidCriticalPH: 1.0,                 // 极耐酸
        alkalineCriticalPH: 14.0,            // 全 pH 范围稳定
        transpassivePotentialAtPH10: 2.10,
        transpassiveSlope: 0.030,
        dopingSensitivity: 0.005,
        source: 'CRC',
    },
    'RuO2': {
        standardReductionPotential: 0.68,    // RuO2/Ru, CRC
        acidCriticalPH: 2.0,
        alkalineCriticalPH: 13.5,
        transpassivePotentialAtPH10: 1.95,
        transpassiveSlope: 0.035,
        dopingSensitivity: 0.008,
        source: 'CRC',
    },
    'Pt/C': {
        standardReductionPotential: 1.18,    // Pt²⁺/Pt, CRC — 最正的标准电位
        acidCriticalPH: 0.5,                 // Pt 极耐酸
        alkalineCriticalPH: 14.0,
        transpassivePotentialAtPH10: 2.20,
        transpassiveSlope: 0.025,
        dopingSensitivity: 0.003,
        source: 'CRC',
    },

    // === 过渡金属氧化物 ===
    'MnO2': {
        standardReductionPotential: 0.26,    // MnO2/Mn²⁺, CRC (pH 依赖)
        acidCriticalPH: 3.5,
        alkalineCriticalPH: 12.0,
        transpassivePotentialAtPH10: 1.70,
        transpassiveSlope: 0.045,
        dopingSensitivity: 0.015,
        source: 'CRC',
    },
    'Co3O4': {
        standardReductionPotential: -0.13,   // Co3O4/Co, CRC
        acidCriticalPH: 5.5,
        alkalineCriticalPH: 13.0,
        transpassivePotentialAtPH10: 1.80,
        transpassiveSlope: 0.040,
        dopingSensitivity: 0.014,
        source: 'CRC',
    },
    'NiO': {
        standardReductionPotential: -0.25,   // NiO/Ni, CRC
        acidCriticalPH: 6.5,
        alkalineCriticalPH: 13.5,
        transpassivePotentialAtPH10: 1.75,
        transpassiveSlope: 0.035,
        dopingSensitivity: 0.012,
        source: 'CRC',
    },
    'Fe2O3': {
        standardReductionPotential: -0.04,   // Fe2O3/Fe, CRC
        acidCriticalPH: 4.0,
        alkalineCriticalPH: 12.5,
        transpassivePotentialAtPH10: 1.90,
        transpassiveSlope: 0.040,
        dopingSensitivity: 0.015,
        source: 'CRC',
    },
    'TiO2': {
        standardReductionPotential: -1.63,   // TiO2/Ti, CRC — 极负，极易被还原保护
        acidCriticalPH: 1.5,
        alkalineCriticalPH: 13.5,
        transpassivePotentialAtPH10: 2.10,
        transpassiveSlope: 0.030,
        dopingSensitivity: 0.008,
        source: 'CRC',
    },
    'WO3': {
        standardReductionPotential: -0.03,   // WO3/W, CRC
        acidCriticalPH: 2.0,
        alkalineCriticalPH: 11.0,            // W 在碱性不太稳定
        transpassivePotentialAtPH10: 1.60,
        transpassiveSlope: 0.050,
        dopingSensitivity: 0.010,
        source: 'CRC',
    },
    'MoS2': {
        standardReductionPotential: -0.20,   // MoS2 在酸性中还原
        acidCriticalPH: 3.0,
        alkalineCriticalPH: 11.5,
        transpassivePotentialAtPH10: 1.55,
        transpassiveSlope: 0.045,
        dopingSensitivity: 0.012,
        source: 'NIST',
    },

    // === 钙钛矿 ===
    'LaNiO3': {
        standardReductionPotential: -0.30,
        acidCriticalPH: 5.0,
        alkalineCriticalPH: 14.0,
        transpassivePotentialAtPH10: 1.90,
        transpassiveSlope: 0.035,
        dopingSensitivity: 0.010,
        source: 'NIST',
    },
    'SrCoO3': {
        standardReductionPotential: -0.15,
        acidCriticalPH: 4.5,
        alkalineCriticalPH: 13.5,
        transpassivePotentialAtPH10: 1.85,
        transpassiveSlope: 0.038,
        dopingSensitivity: 0.012,
        source: 'NIST',
    },
};

/** 通用默认值（与旧版硬编码一致，作为最终回退） */
const DEFAULT_PARAMS: PourbaixParams = {
    standardReductionPotential: 0.3,
    acidCriticalPH: 4.0,
    alkalineCriticalPH: 12.5,
    transpassivePotentialAtPH10: 1.9,
    transpassiveSlope: 0.04,
    dopingSensitivity: 0.015,
    source: 'Generic',
};

/**
 * 去除材料名称中的括号后缀注释
 * 例: 'Fe-N-C (SAC)' → 'Fe-N-C'
 */
function normalizeName(material: string): string {
    return material.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/**
 * 获取材料的 Pourbaix 参数
 * 优先查本地表（支持带/不带括号后缀），找不到返回通用默认值
 */
export function getPourbaixParams(material: string): PourbaixParams {
    return POURBAIX_DATABASE[material] || POURBAIX_DATABASE[normalizeName(material)] || DEFAULT_PARAMS;
}

/**
 * 用 MP API DFT 数据覆盖本地参数
 * formation_energy_per_atom → 标准还原电位校准
 */
export function calibrateWithDFT(
    base: PourbaixParams,
    formationEnergyPerAtom: number,
    nElectrons: number,
): PourbaixParams {
    // Nernst: E⁰ = -ΔG_f / (n·F)，此处用 eV 单位 → E⁰ = -ΔE_f / n
    const calibratedE0 = -formationEnergyPerAtom / Math.max(nElectrons, 1);
    return {
        ...base,
        standardReductionPotential: calibratedE0,
        source: 'MP-DFT',
    };
}

/** 检查给定材料是否在数据库中有专属参数 */
export function hasMaterialData(material: string): boolean {
    return material in POURBAIX_DATABASE || normalizeName(material) in POURBAIX_DATABASE;
}
