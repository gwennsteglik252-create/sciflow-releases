/**
 * freeEnergyDiagram.ts
 * OER/ORR 四步自由能台阶计算
 * 基于实验光谱证据估算 ΔG
 */

import { SpectrumDataPoint, extractVoltageKeys, computePeakArea } from './spectroscopyAnalysis';

// ==================== 类型定义 ====================

export interface FreeEnergyStep {
    step: number;
    label: string;
    species: string;
    deltaG: number;       // ΔG (eV)
    cumulativeG: number;  // 累积 ΔG
    isPDS: boolean;       // 是否为过电位决定步
}

export interface FreeEnergyResult {
    mode: 'OER' | 'ORR';
    steps: FreeEnergyStep[];
    theoreticalOverpotential: number; // η_theory (V)
    pdsStep: number;                   // PDS 步骤编号
    idealSteps: FreeEnergyStep[];      // 理想催化剂参考
    appliedPotential: number;          // 施加电位 U (V)
}

// ==================== 标准热力学数据 ====================

// OER 标准自由能变化 (eV)，理想催化剂每步 1.23 eV
const OER_STANDARD = {
    idealPerStep: 1.23,  // 4.92 / 4 = 1.23 eV
    totalEnergy: 4.92,   // 2H₂O → O₂ + 4H⁺ + 4e⁻
};

// 典型金属氧化物催化剂的 OER ΔG 参考值 (eV)
const TYPICAL_OER_DG: Record<string, number[]> = {
    'CoFe₂O₄': [0.85, 1.45, 1.72, 0.90],
    'Co₃O₄': [0.95, 1.55, 1.80, 0.62],
    'NiFe-LDH': [0.70, 1.30, 1.90, 1.02],
    'IrO₂': [0.90, 1.20, 1.50, 1.32],
    'default': [0.90, 1.40, 1.70, 0.92],
};

// ORR 标准自由能变化
const TYPICAL_ORR_DG: Record<string, number[]> = {
    'Pt/C': [-0.45, -0.68, -1.30, -0.90],
    'Fe-N-C': [-0.55, -0.72, -1.25, -0.85],
    'default': [-0.50, -0.70, -1.20, -0.88],
};

// ==================== 核心计算 ====================

/**
 * 计算 OER 自由能台阶图
 * @param appliedPotential 施加电位 U (V vs RHE)
 * @param catalystType 催化剂类型
 * @param spectralModulation 基于光谱证据的调制因子 (可选)
 */
export function computeOERFreeEnergy(
    appliedPotential: number = 0,
    catalystType: string = 'default',
    spectralModulation?: number[]
): FreeEnergyResult {
    const baseDG = TYPICAL_OER_DG[catalystType] || TYPICAL_OER_DG['default'];
    const labels = [
        { label: '羟基吸附', species: '*OH' },
        { label: '脱氢氧化', species: '*O' },
        { label: '过氧化', species: '*OOH' },
        { label: '析氧', species: 'O₂' },
    ];

    // 应用光谱调制（如果有中间体强度数据）
    const adjustedDG = baseDG.map((dg, i) => {
        const mod = spectralModulation?.[i] ?? 1;
        // 电位修正: ΔG(U) = ΔG(0) - eU
        return dg * mod - appliedPotential;
    });

    let cumulativeG = 0;
    let maxDG = -Infinity;
    let pdsStep = 1;

    const steps: FreeEnergyStep[] = adjustedDG.map((dg, i) => {
        cumulativeG += dg;
        if (dg > maxDG) { maxDG = dg; pdsStep = i + 1; }
        return {
            step: i + 1,
            label: labels[i].label,
            species: labels[i].species,
            deltaG: dg,
            cumulativeG,
            isPDS: false,
        };
    });

    steps[pdsStep - 1].isPDS = true;

    // 理论过电位: η = max(ΔG_i) / e - 1.23
    const theoreticalOverpotential = Math.max(0, maxDG);

    // 理想催化剂
    const idealSteps = labels.map((l, i) => ({
        step: i + 1,
        label: l.label,
        species: l.species,
        deltaG: OER_STANDARD.idealPerStep - appliedPotential,
        cumulativeG: (i + 1) * (OER_STANDARD.idealPerStep - appliedPotential),
        isPDS: false,
    }));

    return { mode: 'OER', steps, theoreticalOverpotential, pdsStep, idealSteps, appliedPotential };
}

/**
 * 计算 ORR 自由能台阶图
 */
export function computeORRFreeEnergy(
    appliedPotential: number = 1.23,
    catalystType: string = 'default',
    spectralModulation?: number[]
): FreeEnergyResult {
    const baseDG = TYPICAL_ORR_DG[catalystType] || TYPICAL_ORR_DG['default'];
    const labels = [
        { label: 'O₂ 吸附', species: '*O₂' },
        { label: '第一步还原', species: '*OOH' },
        { label: '第二步还原', species: '*O' },
        { label: '第三步还原', species: '*OH' },
    ];

    const adjustedDG = baseDG.map((dg, i) => {
        const mod = spectralModulation?.[i] ?? 1;
        return dg * mod + (1.23 - appliedPotential);
    });

    let cumulativeG = 0;
    let maxDG = -Infinity;
    let pdsStep = 1;

    const steps: FreeEnergyStep[] = adjustedDG.map((dg, i) => {
        cumulativeG += dg;
        // ORR 中 PDS 是最"不下坡"的那步（即 ΔG 最大/最不负的）
        if (dg > maxDG) { maxDG = dg; pdsStep = i + 1; }
        return {
            step: i + 1,
            label: labels[i].label,
            species: labels[i].species,
            deltaG: dg,
            cumulativeG,
            isPDS: false,
        };
    });

    steps[pdsStep - 1].isPDS = true;
    const theoreticalOverpotential = Math.max(0, maxDG);

    const idealPerStep = -OER_STANDARD.totalEnergy / 4 + (1.23 - appliedPotential);
    const idealSteps = labels.map((l, i) => ({
        step: i + 1,
        label: l.label,
        species: l.species,
        deltaG: idealPerStep,
        cumulativeG: (i + 1) * idealPerStep,
        isPDS: false,
    }));

    return { mode: 'ORR', steps, theoreticalOverpotential, pdsStep, idealSteps, appliedPotential };
}

/**
 * 基于原位光谱数据估算光谱调制因子
 * 使用最高电位下各中间体的相对面积比来调制 ΔG
 */
export function estimateSpectralModulation(
    data: SpectrumDataPoint[],
    peakCenters: number[] = [580, 650, 820, 1100] // *OH, *O, *OOH, O-O
): number[] {
    const voltageKeys = extractVoltageKeys(data);
    if (voltageKeys.length === 0) return [1, 1, 1, 1];

    const lastKey = voltageKeys[voltageKeys.length - 1];
    const areas = peakCenters.map(center => computePeakArea(data, lastKey, center));
    const maxArea = Math.max(...areas, 1);

    // 归一化并映射到 0.8-1.2 的调制范围
    return areas.map(a => {
        const norm = a / maxArea;
        return 0.8 + norm * 0.4;
    });
}
