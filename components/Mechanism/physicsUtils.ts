/**
 * 物理审计与标准化工具库 v2.0
 * 旨在统一 AI 输出与本地物理引擎之间的数据标准，确保全量数据的一致性。
 * v2.0: 新增基于 Pourbaix 热力学的电化学稳定性审计引擎
 */

import { getPourbaixParams } from './pourbaixData';

export interface PhysicalConstants {
    energySteps: number[];
    tafelSlope: number;
    exchangeCurrentDensity: number;
    eta10: number; // 伏特 (V)
    activationEnergy: number;
    [key: string]: any;
}

export interface StabilityDimensions {
    regionBase: { score: number; maxScore: number; label: string };
    immunityMargin: { score: number; maxScore: number; label: string };
    pHSafety: { score: number; maxScore: number; label: string };
    transpassiveRisk: { score: number; maxScore: number; label: string };
    dopingEffect: { score: number; maxScore: number; label: string };
}

export interface StabilityDescSection {
    title: string;        // 段落标题
    icon: string;         // FontAwesome 图标类名
    color: string;        // 色系 (teal/rose/amber/indigo/emerald/cyan)
    body?: string;        // 正文内容
    items?: string[];     // 建议条目列表
}

export interface StabilityPrediction {
    safetyIndex: number;        // 0-10 safety score
    status: string;             // 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'
    desc: string;               // 描述文本（兼容旧渲染）
    descSections?: StabilityDescSection[]; // 结构化描述段落
    thermodynamicRisk?: string; // Pourbaix 风险提示
    auditSource: 'local' | 'hybrid' | 'ai-only'; // 数据来源标记
    regionId?: string;          // Pourbaix 区域 ID
    dimensions?: StabilityDimensions; // 各维度评分细节
}

/**
 * 核心回归审计：基于能级台阶 (CHE 模型) 重新推算理论过电位
 * 
 * OER: η = max(ΔG₁...₄) - 1.23V  (ΔG 均为正值, max = 最大正值)
 * ORR: η = max(ΔG₁...₄) + 1.23V  (ΔG 均为负值, max = 最正/最弱步骤)
 * HER: η = max(|ΔG₁...₂|)
 */
export const calculateAuditEta10 = (steps: number[], reactionMode: 'OER' | 'HER' | 'ORR' | 'BIFUNCTIONAL'): number => {
    if (!steps || !Array.isArray(steps) || steps.length < 2) return 0;

    const isOER = reactionMode === 'OER' || reactionMode === 'BIFUNCTIONAL';
    const isORR = reactionMode === 'ORR';
    const is4Step = isOER || isORR;
    const deltas: number[] = [];
    const requiredPoints = is4Step ? 5 : 3;
    const actualLength = Math.min(steps.length, requiredPoints);

    for (let i = 0; i < actualLength - 1; i++) {
        deltas.push(steps[i + 1] - steps[i]);
    }

    if (deltas.length === 0) return 0;

    if (isOER) {
        // OER: 正值 deltas, η = max(ΔG) - 1.23
        const maxDeltaG = Math.max(...deltas);
        return Math.max(0, maxDeltaG - 1.23);
    } else if (isORR) {
        // ORR: 负值 deltas, RDS = 最正的那个 (最接近 0)
        // η = max(ΔG) + 1.23  (max(ΔG) 是最不负的步骤)
        const maxDeltaG = Math.max(...deltas);
        return Math.max(0, maxDeltaG + 1.23);
    } else {
        // HER: η = |ΔG(H*)|
        const maxAbsDeltaG = Math.max(...deltas.map(d => Math.abs(d)));
        return Math.max(0, maxAbsDeltaG);
    }
};

/**
 * ═══ 本地 Pourbaix 热力学稳定性计算引擎 ═══
 * 基于确定性物理公式计算 Safety Index，不依赖 AI
 * 
 * 评分维度:
 *   1. Pourbaix 区域基础分 (0.0 ~ 4.0)
 *   2. 免疫线电位余量   (0.0 ~ 2.0)
 *   3. pH 安全裕度       (0.0 ~ 1.5)
 *   4. 过钝化风险惩罚   (0.0 ~ -2.0)
 *   5. 掺杂偏移加成     (-0.5 ~ +0.5)
 * 
 * 总分 clamp 到 [0, 10]
 */
export const calculateLocalStability = (
    material: string,
    pH: number,
    potential: number,
    dopingElement: string,
    totalDopingConcentration: number
): StabilityPrediction => {
    const params = getPourbaixParams(material);

    // ── 掺杂化学势偏移 ──
    const elementalShift = (dopingElement === 'Mo' || dopingElement === 'W' || dopingElement === 'V') ? 0.08
        : (dopingElement === 'S' || dopingElement === 'P') ? -0.05 : 0;
    const chemicalPotentialShift = totalDopingConcentration * params.dopingSensitivity + elementalShift;

    // ── Nernst: 免疫线电位 ──
    const immunityE = params.standardReductionPotential - (0.0591 * pH) - chemicalPotentialShift;

    // ── 过钝化线电位 ──
    const transpassiveE = params.transpassivePotentialAtPH10 - (params.transpassiveSlope * (pH - 10));

    // ── 1. Pourbaix 区域判定 (基础分) ──
    let regionId: string;
    let regionBaseScore: number;
    let regionName: string;

    if (potential < immunityE) {
        regionId = 'immunity';
        regionBaseScore = 4.0;   // 热力学免疫 → 最高基础分
        regionName = '热力学免疫区';
    } else if (pH < params.acidCriticalPH) {
        regionId = 'acidic';
        regionBaseScore = 1.0;   // 酸性腐蚀 → 低分
        regionName = '酸性腐蚀区';
    } else if (pH > params.alkalineCriticalPH || (pH > (params.alkalineCriticalPH - 3) && potential > transpassiveE)) {
        regionId = 'alkaline';
        regionBaseScore = 1.5;   // 碱性/过钝化 → 低分
        regionName = '碱性/过钝化溶解区';
    } else {
        regionId = 'passivation';
        regionBaseScore = 3.5;   // 钝化保护 → 次高分
        regionName = '钝化膜保护区';
    }

    // ── 2. 免疫线余量评分 (ΔE = immunityE - potential) ──
    // 如果处于免疫区，余量为正 → 加分；如果远离免疫区 → 衰减
    const deltaE_immunity = immunityE - potential;
    let immunityMarginScore: number;
    if (deltaE_immunity > 0) {
        // 在免疫线以下，余量越大越安全 (max 2.0)
        immunityMarginScore = Math.min(2.0, deltaE_immunity * 2.0);
    } else {
        // 在免疫线以上，距离越远越不安全
        immunityMarginScore = Math.max(0, 1.0 - Math.abs(deltaE_immunity) * 0.5);
    }

    // ── 3. pH 安全裕度评分 ──
    // 距酸性/碱性临界 pH 的距离越大越安全
    const distToAcid = Math.max(0, pH - params.acidCriticalPH);
    const distToAlkaline = Math.max(0, params.alkalineCriticalPH - pH);
    const minPHMargin = Math.min(distToAcid, distToAlkaline);
    // 裕度 3 个 pH 单位以上 → 满分 1.5
    const pHSafetyScore = Math.min(1.5, minPHMargin * 0.5);

    // ── 4. 过钝化风险惩罚 ──
    let transpassivePenalty = 0;
    if (potential > transpassiveE) {
        // 超过过钝化线 → 惩罚，每超出 0.1V 扣 0.5 分
        transpassivePenalty = Math.min(2.0, (potential - transpassiveE) * 5.0);
    }

    // ── 5. 掺杂偏移加成 ──
    // 正偏移 → 免疫区扩大 → 轻微加分；负偏移 → 轻微扣分
    const dopingBonus = Math.max(-0.5, Math.min(0.5, chemicalPotentialShift * 3));

    // ── 汇总 ──
    const rawScore = regionBaseScore + immunityMarginScore + pHSafetyScore - transpassivePenalty + dopingBonus;
    const safetyIndex = Math.round(Math.max(0, Math.min(10, rawScore)) * 100) / 100;

    // ── 状态映射 ──
    const status = safetyIndex >= 8.5 ? 'Excellent'
        : safetyIndex >= 7.0 ? 'Good'
        : safetyIndex >= 5.0 ? 'Fair'
        : safetyIndex >= 3.0 ? 'Poor'
        : 'Critical';

    // ── 风险提示 ──
    let thermodynamicRisk: string | undefined;
    if (regionId === 'acidic') {
        thermodynamicRisk = `pH ${pH.toFixed(1)} 低于 ${material} 的酸性临界值 (pH ${params.acidCriticalPH})，材料处于阳极溶解状态，催化剂将快速腐蚀流失`;
    } else if (regionId === 'alkaline') {
        if (potential > transpassiveE) {
            thermodynamicRisk = `电位 ${potential.toFixed(2)}V 超过过钝化线 (${transpassiveE.toFixed(2)}V)，钝化膜被击穿，可能形成可溶性含氧酸根`;
        } else {
            thermodynamicRisk = `pH ${pH.toFixed(1)} 超过碱性临界值 (pH ${params.alkalineCriticalPH})，材料可能发生碱性溶解`;
        }
    } else if (transpassivePenalty > 0) {
        thermodynamicRisk = `电位接近过钝化边界 (ΔE = ${(potential - transpassiveE).toFixed(2)}V)，长期运行存在钝化膜失稳风险`;
    }

    // ── 描述生成（结构化：概述 → 机理 → 原因 → 改善建议） ──
    const dopingSection: StabilityDescSection | null = totalDopingConcentration > 0
        ? {
            title: '掺杂影响分析',
            icon: 'fa-atom',
            color: 'violet',
            body: `${dopingElement} 元素的引入改变了基体晶格的电子结构和表面化学势。${chemicalPotentialShift > 0 ? '正向化学势偏移扩展了免疫区范围，有利于抑制阳极溶解过程' : chemicalPotentialShift < 0 ? '负向化学势偏移收缩了热力学稳定窗口，需警惕长期运行中的稳定性退化' : '该掺杂浓度对稳定性边界影响有限'}。`,
            items: ['建议结合 XPS 表面分析确认掺杂元素在表面的实际化学态和富集行为']
        } : null;

    // 保留旧格式 desc 用于兼容（如导出/AI 消费）
    const dopingNote = totalDopingConcentration > 0
        ? `\n\n掺杂影响: ${dopingElement} 元素的引入改变了基体晶格的电子结构和表面化学势。${chemicalPotentialShift > 0 ? '正向化学势偏移扩展了免疫区范围，有利于抑制阳极溶解过程' : chemicalPotentialShift < 0 ? '负向化学势偏移收缩了热力学稳定窗口，需警惕长期运行中的稳定性退化' : '该掺杂浓度对稳定性边界影响有限'}。建议结合 XPS 表面分析确认掺杂元素在表面的实际化学态和富集行为。`
        : '';

    let desc: string;
    let descSections: StabilityDescSection[];

    if (regionId === 'immunity') {
        desc = `${material} 在当前工况下位于 Pourbaix 图的热力学免疫区，这意味着金属基底处于还原态绝对稳定状态。`
            + `\n\n稳定性机理: 在该电位-pH 组合下，金属离子氧化还原电位高于实际施加电位，金属态为热力学最稳定相。表面既不存在自发溶解的驱动力（阳极溶解 M → M^n+ + ne⁻ 不自发），也不需要依赖钝化膜来维持保护。这是催化剂服役条件下最理想的热力学状态。`
            + `\n\n微观机制: 电极/溶液界面处的双电层电位分布使得金属氧化反应的吉布斯自由能变化 ΔG > 0，反应方向不利于金属离子向溶液迁移。载流子（电子/空穴）在界面处的传递不足以突破氧化能垒。`
            + `\n\n运行建议: 当前条件对催化剂寿命最有利。`
            + `若需进一步优化，可关注以下方面：\n• 监测长期运行中 pH 和电位漂移是否仍维持在免疫区内\n• 注意实际操作中局部微环境（如气泡遮蔽、浓差极化）可能导致的 pH 偏移\n• 定期通过电化学阻抗谱 (EIS) 监测界面状态变化`
            + dopingNote;
        descSections = [
            {
                title: '总体评估',
                icon: 'fa-circle-check',
                color: 'emerald',
                body: `${material} 在当前工况下位于 Pourbaix 图的热力学免疫区，这意味着金属基底处于还原态绝对稳定状态。`
            },
            {
                title: '稳定性机理',
                icon: 'fa-microscope',
                color: 'teal',
                body: '在该电位-pH 组合下，金属离子氧化还原电位高于实际施加电位，金属态为热力学最稳定相。表面既不存在自发溶解的驱动力（阳极溶解 M → M^n+ + ne⁻ 不自发），也不需要依赖钝化膜来维持保护。这是催化剂服役条件下最理想的热力学状态。'
            },
            {
                title: '微观机制',
                icon: 'fa-diagram-project',
                color: 'cyan',
                body: '电极/溶液界面处的双电层电位分布使得金属氧化反应的吉布斯自由能变化 ΔG > 0，反应方向不利于金属离子向溶液迁移。载流子（电子/空穴）在界面处的传递不足以突破氧化能垒。'
            },
            {
                title: '运行建议',
                icon: 'fa-lightbulb',
                color: 'amber',
                body: '当前条件对催化剂寿命最有利。若需进一步优化，可关注以下方面：',
                items: [
                    '监测长期运行中 pH 和电位漂移是否仍维持在免疫区内',
                    '注意实际操作中局部微环境（如气泡遮蔽、浓差极化）可能导致的 pH 偏移',
                    '定期通过电化学阻抗谱 (EIS) 监测界面状态变化'
                ]
            }
        ];
    } else if (regionId === 'passivation') {
        desc = `${material} 在当前条件下位于钝化膜保护区，表面可形成致密的氧化物/氢氧化物薄膜有效抑制基体腐蚀。`
            + `\n\n钝化机理: 当电位超过免疫区但 pH 在钝化窗口内时，金属表面发生有限氧化反应，生成热力学稳定的氧化物钝化层（如 NiOOH, Fe₂O₃, CoOOH 等）。该钝化膜具有离子传导阻断作用——膜层内的高电场强度 (10⁶~10⁷ V/m) 阻碍金属阳离子向外扩散，使溶解速率降低数个数量级。`
            + `\n\n稳定性条件: 钝化膜的维持需要 pH 和电位同时处于特定范围内。当前条件距酸性腐蚀边界有 ${distToAcid.toFixed(1)} 个 pH 单位裕度，距碱性溶解边界有 ${distToAlkaline.toFixed(1)} 个 pH 单位裕度。${transpassivePenalty > 0 ? `但电位已接近过钝化线，钝化膜中金属可能被进一步氧化为高价可溶性物种，导致膜层逐渐减薄。` : `电位距过钝化边界尚有充足裕度，钝化膜处于动态稳定状态。`}`
            + `\n\n潜在风险与建议:\n• 长期 OER/ORR 催化操作中，反复的电位循环可引起钝化膜的周期性生长-溶解，导致表面粗化和活性位点重构\n• 溶液中 Cl⁻ 等侵蚀性离子可引发点蚀，破坏钝化膜连续性——建议控制电解质纯度\n• 可通过 CV 循环稳定性测试 (>5000 圈) 评估钝化膜在服役条件下的长期耐久性\n• 适量掺杂高价态金属（如 Cr, Mo）可增强钝化膜致密性和自修复能力`
            + dopingNote;
        descSections = [
            {
                title: '总体评估',
                icon: 'fa-shield-halved',
                color: 'indigo',
                body: `${material} 在当前条件下位于钝化膜保护区，表面可形成致密的氧化物/氢氧化物薄膜有效抑制基体腐蚀。`
            },
            {
                title: '钝化机理',
                icon: 'fa-microscope',
                color: 'teal',
                body: '当电位超过免疫区但 pH 在钝化窗口内时，金属表面发生有限氧化反应，生成热力学稳定的氧化物钝化层（如 NiOOH, Fe₂O₃, CoOOH 等）。该钝化膜具有离子传导阻断作用——膜层内的高电场强度 (10⁶~10⁷ V/m) 阻碍金属阳离子向外扩散，使溶解速率降低数个数量级。'
            },
            {
                title: '稳定性条件',
                icon: 'fa-gauge-high',
                color: 'cyan',
                body: `钝化膜的维持需要 pH 和电位同时处于特定范围内。当前条件距酸性腐蚀边界有 ${distToAcid.toFixed(1)} 个 pH 单位裕度，距碱性溶解边界有 ${distToAlkaline.toFixed(1)} 个 pH 单位裕度。${transpassivePenalty > 0 ? '但电位已接近过钝化线，钝化膜中金属可能被进一步氧化为高价可溶性物种，导致膜层逐渐减薄。' : '电位距过钝化边界尚有充足裕度，钝化膜处于动态稳定状态。'}`
            },
            {
                title: '潜在风险与建议',
                icon: 'fa-lightbulb',
                color: 'amber',
                items: [
                    '长期 OER/ORR 催化操作中，反复的电位循环可引起钝化膜的周期性生长-溶解，导致表面粗化和活性位点重构',
                    '溶液中 Cl⁻ 等侵蚀性离子可引发点蚀，破坏钝化膜连续性——建议控制电解质纯度',
                    '可通过 CV 循环稳定性测试 (>5000 圈) 评估钝化膜在服役条件下的长期耐久性',
                    '适量掺杂高价态金属（如 Cr, Mo）可增强钝化膜致密性和自修复能力'
                ]
            }
        ];
    } else if (regionId === 'acidic') {
        desc = `${material} 在 pH ${pH.toFixed(1)} 条件下位于酸性腐蚀区，表面钝化膜无法稳定存在，催化剂面临持续溶解风险。`
            + `\n\n腐蚀机理: 在低 pH 环境中，溶液中高浓度的 H⁺ 离子与表面氧化物发生质子化反应（如 MO + 2H⁺ → M²⁺ + H₂O），热力学上有利于钝化膜的化学溶解。同时，裸露的金属基底在阳极极化下直接发生电化学溶解（M → M^n+ + ne⁻），溶解速率与电流密度呈 Tafel 关系指数增长。`
            + `\n\n失效原因: ${material} 的钝化膜在 pH < ${params.acidCriticalPH} 时热力学不稳定，无法维持连续覆盖。催化剂活性位点随基体金属离子流失而不可逆损失，表现为活性衰减和过电位持续增大。酸性溶液还可能加速催化剂载体（如碳基底）的氧化腐蚀，进一步恶化结构完整性。`
            + `\n\n改善建议:\n• 将电解液 pH 调高至 ${params.acidCriticalPH} 以上，使材料进入钝化保护区\n• 选用耐酸催化剂体系：IrO₂ (酸性临界 pH ≈ 1.0)、RuO₂ (酸性临界 pH ≈ 2.0) 等贵金属氧化物在酸性 PEM 环境中具有更优稳定性\n• 采用核壳结构设计——以耐酸金属为壳层包覆活性组分，兼顾活性与稳定性\n• 引入 Ti, Nb 等阀金属元素形成混合氧化物，提高钝化膜在酸性条件下的热力学稳定性\n• 通过加速衰减测试 (AST) 量化实际溶解速率，评估是否满足应用寿命要求`
            + dopingNote;
        descSections = [
            {
                title: '总体评估',
                icon: 'fa-triangle-exclamation',
                color: 'rose',
                body: `${material} 在 pH ${pH.toFixed(1)} 条件下位于酸性腐蚀区，表面钝化膜无法稳定存在，催化剂面临持续溶解风险。`
            },
            {
                title: '腐蚀机理',
                icon: 'fa-microscope',
                color: 'teal',
                body: '在低 pH 环境中，溶液中高浓度的 H⁺ 离子与表面氧化物发生质子化反应（如 MO + 2H⁺ → M²⁺ + H₂O），热力学上有利于钝化膜的化学溶解。同时，裸露的金属基底在阳极极化下直接发生电化学溶解（M → M^n+ + ne⁻），溶解速率与电流密度呈 Tafel 关系指数增长。'
            },
            {
                title: '失效根因',
                icon: 'fa-circle-xmark',
                color: 'rose',
                body: `${material} 的钝化膜在 pH < ${params.acidCriticalPH} 时热力学不稳定，无法维持连续覆盖。催化剂活性位点随基体金属离子流失而不可逆损失，表现为活性衰减和过电位持续增大。酸性溶液还可能加速催化剂载体（如碳基底）的氧化腐蚀，进一步恶化结构完整性。`
            },
            {
                title: '改善建议',
                icon: 'fa-lightbulb',
                color: 'amber',
                items: [
                    `将电解液 pH 调高至 ${params.acidCriticalPH} 以上，使材料进入钝化保护区`,
                    '选用耐酸催化剂体系：IrO₂ (酸性临界 pH ≈ 1.0)、RuO₂ (酸性临界 pH ≈ 2.0) 等贵金属氧化物在酸性 PEM 环境中具有更优稳定性',
                    '采用核壳结构设计——以耐酸金属为壳层包覆活性组分，兼顾活性与稳定性',
                    '引入 Ti, Nb 等阀金属元素形成混合氧化物，提高钝化膜在酸性条件下的热力学稳定性',
                    '通过加速衰减测试 (AST) 量化实际溶解速率，评估是否满足应用寿命要求'
                ]
            }
        ];
    } else {
        const isTranspassive = potential > transpassiveE;
        desc = `${material} 在当前条件下处于${isTranspassive ? '过钝化溶解区' : '碱性腐蚀区'}，面临${isTranspassive ? '钝化膜被高电位击穿' : '强碱环境下钝化膜化学溶解'}的稳定性风险。`
            + `\n\n${isTranspassive ? '过钝化机理' : '碱性溶解机理'}: ${isTranspassive
                ? `在极高阳极电位下，钝化膜中的低价态金属离子被进一步氧化至高价态（如 Ni²⁺ → Ni⁴⁺, Fe³⁺ → Fe⁶⁺），形成可溶性含氧酸根离子（如 NiO₄²⁻, FeO₄²⁻, CrO₄²⁻）。这些高价态物种在溶液中热力学稳定，导致钝化膜持续向溶液方向消耗，即"过钝化溶解"。该过程在电催化过程中尤为突出——OER 催化所需的高过电位恰好为过钝化提供了驱动力。`
                : `在 pH > ${params.alkalineCriticalPH} 的强碱条件下，金属氧化物/氢氧化物可与过量 OH⁻ 反应形成可溶性羟基络合物（如 [M(OH)₄]²⁻, [M(OH)₆]³⁻）。该反应中 OH⁻ 既是反应物又是配位体，高 OH⁻ 浓度通过勒夏特列原理推动溶解平衡正向移动。钝化膜被逐层剥蚀直至暴露基底金属。`}`
            + `\n\n失效根因: ${isTranspassive
                ? `当前电位 (${potential.toFixed(2)}V) 已超过该材料的过钝化临界电位，钝化膜与溶液界面处的电场驱动金属离子持续高价化。催化反应与膜层溶解形成竞争——催化活性位点在产生 O₂ 的同时自身被消耗，导致不可逆的性能退化。`
                : `当前 pH (${pH.toFixed(1)}) 超过碱性稳定窗口上限，溶液碱性过强。大量 OH⁻ 离子突破钝化膜/溶液界面的双电层屏障，与膜层发生化学反应导致持续溶解。该过程不依赖外加电位，属于纯化学腐蚀。`}`
            + `\n\n改善建议:\n• ${isTranspassive ? '降低操作电位或采用脉冲式间歇操作，给予钝化膜自修复时间窗口' : `将电解液 pH 控制在 ${params.alkalineCriticalPH} 以下的最优钝化窗口内`}\n• 通过表面合金化或高熵策略引入耐高电位元素（如 Ir, Ru）提高过钝化临界电位\n• 采用原位拉曼/XAS 等谱学手段实时监测钝化膜结构演变，建立服役寿命预测模型\n• 工程层面可考虑牺牲电极设计或定期催化剂再生程序\n• 优化催化剂微结构——增大比表面积以降低单位面积电流密度，延缓局部过钝化`
            + dopingNote;
        descSections = [
            {
                title: '总体评估',
                icon: 'fa-triangle-exclamation',
                color: 'rose',
                body: `${material} 在当前条件下处于${isTranspassive ? '过钝化溶解区' : '碱性腐蚀区'}，面临${isTranspassive ? '钝化膜被高电位击穿' : '强碱环境下钝化膜化学溶解'}的稳定性风险。`
            },
            {
                title: isTranspassive ? '过钝化机理' : '碱性溶解机理',
                icon: 'fa-microscope',
                color: 'teal',
                body: isTranspassive
                    ? '在极高阳极电位下，钝化膜中的低价态金属离子被进一步氧化至高价态（如 Ni²⁺ → Ni⁴⁺, Fe³⁺ → Fe⁶⁺），形成可溶性含氧酸根离子（如 NiO₄²⁻, FeO₄²⁻, CrO₄²⁻）。这些高价态物种在溶液中热力学稳定，导致钝化膜持续向溶液方向消耗，即"过钝化溶解"。该过程在电催化过程中尤为突出——OER 催化所需的高过电位恰好为过钝化提供了驱动力。'
                    : `在 pH > ${params.alkalineCriticalPH} 的强碱条件下，金属氧化物/氢氧化物可与过量 OH⁻ 反应形成可溶性羟基络合物（如 [M(OH)₄]²⁻, [M(OH)₆]³⁻）。该反应中 OH⁻ 既是反应物又是配位体，高 OH⁻ 浓度通过勒夏特列原理推动溶解平衡正向移动。钝化膜被逐层剥蚀直至暴露基底金属。`
            },
            {
                title: '失效根因',
                icon: 'fa-circle-xmark',
                color: 'rose',
                body: isTranspassive
                    ? `当前电位 (${potential.toFixed(2)}V) 已超过该材料的过钝化临界电位，钝化膜与溶液界面处的电场驱动金属离子持续高价化。催化反应与膜层溶解形成竞争——催化活性位点在产生 O₂ 的同时自身被消耗，导致不可逆的性能退化。`
                    : `当前 pH (${pH.toFixed(1)}) 超过碱性稳定窗口上限，溶液碱性过强。大量 OH⁻ 离子突破钝化膜/溶液界面的双电层屏障，与膜层发生化学反应导致持续溶解。该过程不依赖外加电位，属于纯化学腐蚀。`
            },
            {
                title: '改善建议',
                icon: 'fa-lightbulb',
                color: 'amber',
                items: [
                    isTranspassive ? '降低操作电位或采用脉冲式间歇操作，给予钝化膜自修复时间窗口' : `将电解液 pH 控制在 ${params.alkalineCriticalPH} 以下的最优钝化窗口内`,
                    '通过表面合金化或高熵策略引入耐高电位元素（如 Ir, Ru）提高过钝化临界电位',
                    '采用原位拉曼/XAS 等谱学手段实时监测钝化膜结构演变，建立服役寿命预测模型',
                    '工程层面可考虑牺牲电极设计或定期催化剂再生程序',
                    '优化催化剂微结构——增大比表面积以降低单位面积电流密度，延缓局部过钝化'
                ]
            }
        ];
    }
    // 追加掺杂段落
    if (dopingSection) descSections.push(dopingSection);

    console.log(`[Stability Audit] ${material} @ pH=${pH}, E=${potential}V → 区域: ${regionName}, 各维度: base=${regionBaseScore}, immunity=${immunityMarginScore.toFixed(2)}, pH=${pHSafetyScore.toFixed(2)}, transP=-${transpassivePenalty.toFixed(2)}, doping=${dopingBonus.toFixed(2)} → SafetyIndex=${safetyIndex}`);

    return {
        safetyIndex, status, desc, descSections, thermodynamicRisk, auditSource: 'local', regionId,
        dimensions: {
            regionBase: { score: regionBaseScore, maxScore: 4.0, label: regionName },
            immunityMargin: { score: immunityMarginScore, maxScore: 2.0, label: '免疫线余量' },
            pHSafety: { score: pHSafetyScore, maxScore: 1.5, label: 'pH 裕度' },
            transpassiveRisk: { score: -transpassivePenalty, maxScore: 0, label: '过钝化风险' },
            dopingEffect: { score: dopingBonus, maxScore: 0.5, label: '掺杂效应' }
        }
    };
};

/**
 * ═══ 稳定性审计纠偏 ═══
 * 对 AI 返回的 stabilityPrediction 进行物理约束纠偏
 * - AI 有返回 → 混合模式：以本地计算为准，保留 AI 的补充描述
 * - AI 无返回 → 纯本地模式：完全由物理引擎生成
 */
export const auditStabilityPrediction = (
    aiPrediction: any | null | undefined,
    material: string,
    pH: number,
    potential: number,
    dopingElement: string,
    totalDopingConcentration: number
): StabilityPrediction => {
    const local = calculateLocalStability(material, pH, potential, dopingElement, totalDopingConcentration);

    // AI 没有返回 stabilityPrediction → 纯本地模式
    if (!aiPrediction || typeof aiPrediction.safetyIndex !== 'number') {
        console.log(`[Stability Audit] AI 未返回 stabilityPrediction，使用纯本地推算: ${local.safetyIndex}`);
        return local;
    }

    // AI 有返回 → 混合模式
    const aiIndex = aiPrediction.safetyIndex;
    const discrepancy = Math.abs(aiIndex - local.safetyIndex);

    // 如果差异 > 2.0，以本地为准（AI 可能编造了不合理的值）
    // 如果差异 ≤ 2.0，取加权平均（本地 70% + AI 30%）
    let finalIndex: number;
    let auditSource: 'local' | 'hybrid';
    if (discrepancy > 2.0) {
        finalIndex = local.safetyIndex;
        auditSource = 'local';
        console.log(`[Stability Audit] AI 偏差过大 (AI=${aiIndex.toFixed(2)}, Local=${local.safetyIndex.toFixed(2)}, Δ=${discrepancy.toFixed(2)})，以本地为准`);
    } else {
        finalIndex = Math.round((local.safetyIndex * 0.7 + aiIndex * 0.3) * 100) / 100;
        auditSource = 'hybrid';
        console.log(`[Stability Audit] 混合模式: Local=${local.safetyIndex.toFixed(2)} × 0.7 + AI=${aiIndex.toFixed(2)} × 0.3 = ${finalIndex.toFixed(2)}`);
    }

    // 重新映射 status
    const status = finalIndex >= 8.5 ? 'Excellent'
        : finalIndex >= 7.0 ? 'Good'
        : finalIndex >= 5.0 ? 'Fair'
        : finalIndex >= 3.0 ? 'Poor'
        : 'Critical';

    // 合并描述：保留 AI 的补充见解（如果有的话）
    let desc = local.desc;
    let descSections = local.descSections ? [...local.descSections] : undefined;
    if (aiPrediction.desc && auditSource === 'hybrid') {
        desc = local.desc + `\n\n📖 AI 补充: ${aiPrediction.desc}`;
        if (descSections) {
            descSections.push({
                title: 'AI 补充分析',
                icon: 'fa-robot',
                color: 'indigo',
                body: aiPrediction.desc
            });
        }
    }

    return {
        safetyIndex: finalIndex,
        status,
        desc,
        descSections,
        thermodynamicRisk: local.thermodynamicRisk || aiPrediction.thermodynamicRisk,
        auditSource,
        regionId: local.regionId,
        dimensions: local.dimensions
    };
};

/**
 * 数据标准化：对 AI 返回的原始物理常数进行纠偏与单位转换
 * @param constants AI 返回的原始常量对象
 * @param reactionMode 反应模式
 * @returns 纠偏并转换单位后的标准化常量对象
 */
export const normalizePhysicalConstants = (constants: any, reactionMode: 'OER' | 'HER' | 'ORR' | 'BIFUNCTIONAL'): PhysicalConstants => {
    const rawConstants = constants || {};

    // ── 检测数据来源 ──
    const dataSource = rawConstants.dataSource || 'ai-estimated';
    const isLocalCHE = dataSource === 'local-CHE' || dataSource === 'local-CHE-scaling';

    // 1. 提取基础数据
    const energySteps = Array.isArray(rawConstants.energySteps) ? rawConstants.energySteps : [];

    if (isLocalCHE) {
        // ── 本地 CHE 数据：已验证，直接透传 ──
        console.log(`[normalizePhysicalConstants] 数据来源: ${dataSource}，跳过 AI 纠偏`);
        return {
            ...rawConstants,
            energySteps,
            tafelSlope: rawConstants.tafelSlope || 55,
            exchangeCurrentDensity: parseFloat(rawConstants.exchangeCurrentDensity) || 1e-4,
            eta10: rawConstants.eta10 || 0,
            activationEnergy: rawConstants.activationEnergy || 45,
            dataSource,
            sourceRef: rawConstants.sourceRef || 'local-CHE',
            uncertainty: rawConstants.uncertainty || 0.02,
        };
    }

    // ── AI 数据：执行完整纠偏流程 ──

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
        activationEnergy: parseFloat(rawConstants.activationEnergy) || 45,
        dataSource: 'ai-audited',
        sourceRef: rawConstants.sourceRef || 'AI-Gemini-Pro',
        uncertainty: rawConstants.uncertainty || 0.15,
    };
};

// ═══════════════════════════════════════════════════════════════
// LSV 曲线物理引擎 (Butler-Volmer + Mass Transport)
// ═══════════════════════════════════════════════════════════════

export interface LsvPoint {
    v: number;
    jDoped: number;
    jBase: number;
    jDecay: number;
}

export interface MorphologyLink {
    type: string;
    value?: number;
    defectDensity?: number;
}

export interface LsvParams {
    physicalConstants: PhysicalConstants;
    massLoading: number;
    reactionMode: string;
    stabilityPrediction?: { safetyIndex: number } | null;
    morphologyLink?: MorphologyLink | null;
}

/**
 * 严谨物理引擎：LSV 极化曲线生成
 * 基于 Butler-Volmer 方程 + 传质极限修正
 */
export const computeLsvCurves = (params: LsvParams): LsvPoint[] => {
    const { physicalConstants, massLoading, reactionMode, stabilityPrediction, morphologyLink } = params;

    let j0 = parseFloat(String(physicalConstants.exchangeCurrentDensity)) || 1e-6;
    const bT = parseFloat(String(physicalConstants.tafelSlope)) || 60;

    // 传质极限解算
    let jLim = 5000;
    if (morphologyLink?.type === 'sheet' && (morphologyLink.value ?? 100) < 30) {
        jLim = 100 + ((morphologyLink.value ?? 0) / 30) * 1900;
    } else if (morphologyLink?.type === 'defect' && morphologyLink.defectDensity) {
        const boostFactor = 1 + (morphologyLink.defectDensity / 10) * 2;
        j0 *= boostFactor;
    }

    const points: LsvPoint[] = [];

    if (reactionMode === 'BIFUNCTIONAL') {
        const j0_ORR = j0 * 0.8;
        for (let v = 0.2; v <= 1.83; v += 0.01) {
            const overORR = Math.max(0, 1.23 - v);
            const jKinORR = (j0_ORR * Math.pow(10, (overORR * 1000) / (bT * 1.2))) * massLoading;
            const jORR = -(jKinORR * 50) / (jKinORR + 50);
            const overOER = Math.max(0, v - 1.23);
            const jKinOER = (j0 * Math.pow(10, (overOER * 1000) / bT)) * massLoading;
            const jOER = (jKinOER * jLim) / (jKinOER + jLim);
            points.push({
                v,
                jDoped: jOER + jORR,
                jBase: (jOER + jORR) * 0.4,
                jDecay: (jOER + jORR) * 0.7
            });
        }
    } else {
        const range = 0.6;
        const j0_base = j0 * 0.1;
        const bT_base = bT * 1.5;

        for (let over = 0; over <= range; over += 0.005) {
            const jKin = (j0 * Math.pow(10, (over * 1000) / bT)) * massLoading;
            const jDoped = (jKin * jLim) / (jKin + jLim);
            const jBaseKin = (j0_base * Math.pow(10, (over * 1000) / bT_base)) * massLoading;
            const jBase = (jBaseKin * jLim) / (jBaseKin + jLim);
            const decayFactor = Math.max(0.2, (stabilityPrediction?.safetyIndex || 8) / 10);
            const onset = reactionMode === 'OER' ? 1.23 : reactionMode === 'ORR' ? 1.23 : 0;

            points.push({
                v: reactionMode === 'ORR' ? onset - over : onset + over,
                jDoped: reactionMode === 'ORR' ? -jDoped : jDoped,
                jBase: reactionMode === 'ORR' ? -jBase : jBase,
                jDecay: reactionMode === 'ORR' ? -(jDoped * decayFactor) : (jDoped * decayFactor)
            });
        }
    }
    return points;
};

export interface BenchmarkResult {
    error: number;
    jSim: number;
    vReal: number;
    jReal: number;
}

/**
 * Benchmark 校准：将仿真 LSV 与实测数据点比对
 */
export const computeBenchmark = (
    lsvCurves: LsvPoint[],
    measuredV: number,
    measuredJ: number
): BenchmarkResult | null => {
    if (!lsvCurves.length || isNaN(measuredV) || isNaN(measuredJ)) return null;
    const closest = lsvCurves.reduce((prev, curr) =>
        Math.abs(curr.v - measuredV) < Math.abs(prev.v - measuredV) ? curr : prev
    );
    return {
        error: ((closest.jDoped - measuredJ) / measuredJ) * 100,
        jSim: closest.jDoped,
        vReal: measuredV,
        jReal: measuredJ
    };
};
