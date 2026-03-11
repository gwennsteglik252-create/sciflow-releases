/**
 * 物理审计与标准化工具库 v1.0
 * 旨在统一 AI 输出与本地物理引擎之间的数据标准，确保全量数据的一致性。
 */

export interface PhysicalConstants {
    energySteps: number[];
    tafelSlope: number;
    exchangeCurrentDensity: number;
    eta10: number; // 伏特 (V)
    activationEnergy: number;
    [key: string]: any;
}

/**
 * 核心回归审计：基于能级台阶 (CHE 模型) 重新推算理论过电位
 * @param steps 能级自由能台阶 (eV)
 * @param reactionMode 'OER' | 'HER'
 * @returns 审计后的过电位 (V)
 */
export const calculateAuditEta10 = (steps: number[], reactionMode: 'OER' | 'HER' | 'ORR' | 'BIFUNCTIONAL'): number => {
    if (!steps || !Array.isArray(steps) || steps.length < 2) return 0;

    const isOER = reactionMode === 'OER' || reactionMode === 'ORR';
    const deltas: number[] = [];
    const requiredPoints = isOER ? 5 : 3;
    const actualLength = Math.min(steps.length, requiredPoints);

    // 计算每一步的 Delta G (取绝对值以兼顾还原/氧化反应)
    for (let i = 0; i < actualLength - 1; i++) {
        deltas.push(Math.abs(steps[i + 1] - steps[i]));
    }

    if (deltas.length === 0) return 0;

    const maxDeltaG = Math.max(...deltas);

    // 强制基于物理定义的本地计算结果 (V)
    // OER/ORR: η = max(|ΔG|) - 1.23
    // HER: η = max(|ΔG|)
    return isOER ? Math.max(0, maxDeltaG - 1.23) : Math.max(0, maxDeltaG);
};

/**
 * 数据标准化：对 AI 返回的原始物理常数进行纠偏与单位转换
 * @param constants AI 返回的原始常量对象
 * @param reactionMode 反应模式
 * @returns 纠偏并转换单位后的标准化常量对象
 */
export const normalizePhysicalConstants = (constants: any, reactionMode: 'OER' | 'HER' | 'ORR' | 'BIFUNCTIONAL'): PhysicalConstants => {
    const rawConstants = constants || {};

    // 1. 提取基础数据
    const energySteps = Array.isArray(rawConstants.energySteps) ? rawConstants.energySteps : [];

    // 2. 执行物理审计纠偏 (本地精确推算值)
    const auditedEta = calculateAuditEta10(energySteps, reactionMode);

    // 3. 处理 AI 原始输出的单位风险
    // AI 可能输出 mV (如 250)，也可能输出 V (如 0.25)
    // 根据量级判断：如果原始值 > 10，则高度怀疑是 mV，自动转换为 V
    let rawEta = rawConstants.eta10 || 0;
    if (rawEta > 10) {
        rawEta = rawEta / 1000;
    }

    // 4. 标准化输出：优先使用本地审计结果作为最终物理标准
    // 如果审计值与原始值偏差过大，以审计值为准
    return {
        ...rawConstants,
        energySteps,
        tafelSlope: parseFloat(rawConstants.tafelSlope) || (reactionMode === 'OER' ? 50 : 60),
        exchangeCurrentDensity: parseFloat(rawConstants.exchangeCurrentDensity) || 1e-6,
        eta10: auditedEta || rawEta, // 强制导出伏特 (V) 单位
        activationEnergy: parseFloat(rawConstants.activationEnergy) || 45
    };
};
