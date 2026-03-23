/**
 * mechanismPathway.ts
 * OER 机理路径判别: AEM vs LOM
 * 基于原位光谱中间体演变序列自动推断
 */

import { SpectrumDataPoint, extractVoltageKeys, trackPeakShift } from './spectroscopyAnalysis';
import { matchPeaksToIntermediates, PeakAssignment, INTERMEDIATE_DATABASE } from './intermediateFingerprints';

// ==================== 类型定义 ====================

export type PathwayType = 'AEM' | 'LOM' | 'Mixed' | 'Undetermined';

export interface PathwayEvidence {
    type: 'supports_AEM' | 'supports_LOM' | 'neutral';
    description: string;
    confidence: number;
    relatedPeak?: number;
}

export interface PathwayResult {
    pathway: PathwayType;
    confidence: number;   // 0-100
    evidences: PathwayEvidence[];
    summary: string;
    aemScore: number;
    lomScore: number;
    diagramSteps: PathwayStep[];
}

export interface PathwayStep {
    step: number;
    label: string;
    formula: string;
    isActive: boolean;    // 是否有光谱证据支持
    freeEnergy?: number;  // ΔG (eV)
}

// ==================== AEM 路径定义 ====================
// M + H₂O → M-OH + H⁺ + e⁻
// M-OH → M-O + H⁺ + e⁻  
// M-O + H₂O → M-OOH + H⁺ + e⁻
// M-OOH → M + O₂ + H⁺ + e⁻

const AEM_STEPS: PathwayStep[] = [
    { step: 1, label: '羟基吸附', formula: 'M + H₂O → M-OH + H⁺ + e⁻', isActive: false },
    { step: 2, label: '脱氢氧化', formula: 'M-OH → M-O + H⁺ + e⁻', isActive: false },
    { step: 3, label: '过氧化', formula: 'M-O + H₂O → M-OOH + H⁺ + e⁻', isActive: false },
    { step: 4, label: '析氧', formula: 'M-OOH → M + O₂ + H⁺ + e⁻', isActive: false },
];

// ==================== LOM 路径定义 ====================
// M-O_lat + H₂O → M-OH + OH⁻ (lattice O leaves)
// Vacancy + H₂O → OH_ads + H⁺ + e⁻
// OH_ads → O_ads + H⁺ + e⁻
// O_ads + O_lat → O₂ + vacancy + e⁻ (O-O coupling from lattice)

const LOM_STEPS: PathwayStep[] = [
    { step: 1, label: '晶格氧活化', formula: 'M-Oₗₐₜ + H₂O → M-OH + OH⁻', isActive: false },
    { step: 2, label: '空位填充', formula: 'V_O + H₂O → OH_ads + H⁺ + e⁻', isActive: false },
    { step: 3, label: '表面氧化', formula: 'OH_ads → O_ads + H⁺ + e⁻', isActive: false },
    { step: 4, label: '晶格氧耦合', formula: 'O_ads + Oₗₐₜ → O₂ + V_O + e⁻', isActive: false },
];

// ==================== 核心判别函数 ====================

/**
 * 基于原位光谱中间体演变推断 OER 机理路径
 */
export function determinePathway(
    data: SpectrumDataPoint[],
    detectedPeaks: number[]
): PathwayResult {
    const voltageKeys = extractVoltageKeys(data);
    const assignments = matchPeaksToIntermediates(detectedPeaks);
    const evidences: PathwayEvidence[] = [];
    let aemScore = 0;
    let lomScore = 0;

    // ---- 证据 1: *OOH 中间体检测 (AEM 核心证据) ----
    const oohAssignment = assignments.find(a =>
        a.matchedEntries.some(m => m.entry.id === 'M-OOH' && m.confidence > 0.3)
    );
    if (oohAssignment) {
        const best = oohAssignment.matchedEntries.find(m => m.entry.id === 'M-OOH')!;
        aemScore += best.confidence * 35;
        evidences.push({
            type: 'supports_AEM',
            description: `在 ${oohAssignment.peakCenter} cm⁻¹ 检测到 *OOH 吸附态中间体信号（置信度 ${(best.confidence * 100).toFixed(0)}%），这是 AEM 路径的核心光谱证据。`,
            confidence: best.confidence,
            relatedPeak: oohAssignment.peakCenter,
        });
    }

    // ---- 证据 2: *OOH 信号随电位的增长趋势 (AEM) ----
    if (voltageKeys.length >= 2) {
        const oohCenter = oohAssignment?.peakCenter || 580;
        const shifts = trackPeakShift(data, voltageKeys, oohCenter);
        if (shifts.length >= 2) {
            const intensityGrowth = shifts[shifts.length - 1].intensity / (shifts[0].intensity || 1);
            if (intensityGrowth > 2) {
                aemScore += 20;
                evidences.push({
                    type: 'supports_AEM',
                    description: `*OOH 峰 (${oohCenter} cm⁻¹) 强度随电位增长 ${intensityGrowth.toFixed(1)}× ,表明 *OOH 在高电位下持续累积，符合 AEM 动力学特征。`,
                    confidence: Math.min(1, intensityGrowth / 5),
                    relatedPeak: oohCenter,
                });
            }
        }
    }

    // ---- 证据 3: M-OH → M-O 转换 (AEM step 2) ----
    const ohAssignment = assignments.find(a =>
        a.matchedEntries.some(m => m.entry.id === 'M-OH' && m.confidence > 0.3)
    );
    const oAssignment = assignments.find(a =>
        a.matchedEntries.some(m => m.entry.id === 'M-O' && m.confidence > 0.3)
    );
    if (ohAssignment && oAssignment) {
        aemScore += 15;
        evidences.push({
            type: 'supports_AEM',
            description: `同时检测到 *OH (${ohAssignment.peakCenter} cm⁻¹) 和 *O (${oAssignment.peakCenter} cm⁻¹) 中间体，支持 AEM 路径中 *OH → *O 的脱氢步骤。`,
            confidence: 0.7,
        });
    }

    // ---- 证据 4: 晶格氧信号变化 (LOM 证据) ----
    const latticeOAssignment = assignments.find(a =>
        a.matchedEntries.some(m => m.entry.id === 'lattice-O' && m.confidence > 0.3)
    );
    if (latticeOAssignment && voltageKeys.length >= 2) {
        const shifts = trackPeakShift(data, voltageKeys, latticeOAssignment.peakCenter);
        if (shifts.length >= 2) {
            const intensityDecay = shifts[0].intensity / (shifts[shifts.length - 1].intensity || 1);
            if (intensityDecay > 1.3) {
                lomScore += 30;
                evidences.push({
                    type: 'supports_LOM',
                    description: `晶格氧信号 (${latticeOAssignment.peakCenter} cm⁻¹) 在高电位下衰减了 ${((1 - 1 / intensityDecay) * 100).toFixed(0)}%，表明晶格氧参与了 OER 反应，支持 LOM 路径。`,
                    confidence: Math.min(1, intensityDecay / 3),
                    relatedPeak: latticeOAssignment.peakCenter,
                });
            }
        }
    }

    // ---- 证据 5: O-O 对称伸缩 (LOM 特征) ----
    const ooAssignment = assignments.find(a =>
        a.matchedEntries.some(m => m.entry.id === 'O-O' && m.confidence > 0.4)
    );
    if (ooAssignment) {
        lomScore += 20;
        evidences.push({
            type: 'supports_LOM',
            description: `在 ${ooAssignment.peakCenter} cm⁻¹ 检测到 O-O 对称伸缩振动，可能源于晶格氧参与的 O-O 耦合步骤，支持 LOM 路径。`,
            confidence: 0.6,
            relatedPeak: ooAssignment.peakCenter,
        });
    }

    // 无足够证据时添加中性证据
    if (evidences.length === 0) {
        evidences.push({
            type: 'neutral',
            description: '当前光谱数据中未检测到明确的 OER 中间体信号，可能需要更高灵敏度的原位测量或更极端的电位条件。',
            confidence: 0,
        });
    }

    // ---- 最终判定 ----
    const totalScore = aemScore + lomScore;
    let pathway: PathwayType = 'Undetermined';
    let confidence = 0;

    if (totalScore < 10) {
        pathway = 'Undetermined';
        confidence = 0;
    } else if (aemScore > lomScore * 2) {
        pathway = 'AEM';
        confidence = Math.min(95, aemScore);
    } else if (lomScore > aemScore * 2) {
        pathway = 'LOM';
        confidence = Math.min(95, lomScore);
    } else {
        pathway = 'Mixed';
        confidence = Math.min(90, totalScore / 2);
    }

    // 构建路径步骤图（标记有证据支持的步骤）
    const steps = pathway === 'LOM' ? [...LOM_STEPS] : [...AEM_STEPS];
    if (ohAssignment) steps[0] = { ...steps[0], isActive: true };
    if (oAssignment) steps[1] = { ...steps[1], isActive: true };
    if (oohAssignment) steps[2] = { ...steps[2], isActive: true };

    const summary = generatePathwaySummary(pathway, confidence, evidences);

    return {
        pathway,
        confidence,
        evidences,
        summary,
        aemScore,
        lomScore,
        diagramSteps: steps,
    };
}

function generatePathwaySummary(
    pathway: PathwayType,
    confidence: number,
    evidences: PathwayEvidence[]
): string {
    const pathwayNames: Record<PathwayType, string> = {
        AEM: 'Adsorbate Evolution Mechanism (吸附态演化机理)',
        LOM: 'Lattice Oxygen Mechanism (晶格氧参与机理)',
        Mixed: 'AEM/LOM 混合机理',
        Undetermined: '待定',
    };

    const lines: string[] = [
        `**OER 反应路径诊断结论：**\n`,
        `综合原位光谱证据分析，该催化剂的 OER 过程主要遵循 **${pathwayNames[pathway]}** 路径（置信度: ${confidence.toFixed(0)}%）。\n`,
    ];

    const aemEvs = evidences.filter(e => e.type === 'supports_AEM');
    const lomEvs = evidences.filter(e => e.type === 'supports_LOM');

    if (aemEvs.length > 0) {
        lines.push(`**AEM 支持证据 (${aemEvs.length} 项)：**`);
        aemEvs.forEach((e, i) => lines.push(`${i + 1}. ${e.description}`));
        lines.push('');
    }
    if (lomEvs.length > 0) {
        lines.push(`**LOM 支持证据 (${lomEvs.length} 项)：**`);
        lomEvs.forEach((e, i) => lines.push(`${i + 1}. ${e.description}`));
    }

    return lines.join('\n');
}
