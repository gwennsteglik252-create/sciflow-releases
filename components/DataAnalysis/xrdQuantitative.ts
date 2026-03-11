/**
 * xrdQuantitative.ts
 * 
 * Reference Intensity Ratio (RIR) 多相含量估算
 */

export interface PhaseQuantResult {
    /** 物相名称 */
    name: string;
    /** 估算重量百分比 */
    weightPercent: number;
    /** 参与估算的最强峰强度 */
    strongestPeakIntensity: number;
    /** RIR 值 */
    rir: number;
}

export interface QuantitativeResult {
    /** 各物相含量 */
    phases: PhaseQuantResult[];
    /** 是否有有效结果 */
    isValid: boolean;
    /** 方法说明 */
    method: string;
}

/**
 * 基于 RIR (Reference Intensity Ratio) 方法估算多相含量
 * 
 * 原理：Wi/Wj = (Ii/Ij) × (RIRj/RIRi)
 * 简化版：当 RIR 未知时，假设所有物相 RIR ≈ 1（半定量）
 * 
 * @param matchedPhases 匹配到的物相列表
 * @param experimentalPeaks 实验峰列表
 * @param lambda 波长 (nm)
 */
export const estimatePhaseContent = (
    matchedPhases: Array<{
        name: string;
        peaks: Array<{ twoTheta: number; intensity: number }>;
        rir?: number; // Reference Intensity Ratio, 默认 1.0
    }>,
    experimentalPeaks: Array<{ twoTheta: number; intensity: number }>,
    lambda: number = 0.15406
): QuantitativeResult => {
    if (matchedPhases.length < 2) {
        return {
            phases: matchedPhases.map(p => ({
                name: p.name,
                weightPercent: 100,
                strongestPeakIntensity: 0,
                rir: p.rir || 1.0,
            })),
            isValid: false,
            method: 'RIR (需 ≥2 个物相)',
        };
    }

    // 为每个匹配物相找最强对应实验峰
    const phaseIntensities = matchedPhases.map(phase => {
        const rir = phase.rir || 1.0;

        // 找到该物相理论上最强峰（intensity 最大）
        const sortedRefPeaks = [...phase.peaks].sort((a, b) => b.intensity - a.intensity);
        const strongestRef = sortedRefPeaks[0];
        if (!strongestRef) return { name: phase.name, intensity: 0, rir };

        // 在实验谱中找到最接近该峰位的实验峰
        let bestMatch: { twoTheta: number; intensity: number } | null = null;
        let bestDist = Infinity;
        for (const ep of experimentalPeaks) {
            const dist = Math.abs(ep.twoTheta - strongestRef.twoTheta);
            if (dist < bestDist && dist < 0.5) { // 0.5° 容差
                bestDist = dist;
                bestMatch = ep;
            }
        }

        return {
            name: phase.name,
            intensity: bestMatch ? bestMatch.intensity : 0,
            rir,
        };
    });

    // RIR 归一化：Wi = (Ii/RIRi) / Σ(Ij/RIRj)
    const corrected = phaseIntensities.map(p => ({
        ...p,
        correctedI: p.intensity / p.rir,
    }));

    const totalCorrected = corrected.reduce((sum, p) => sum + p.correctedI, 0);

    const phases: PhaseQuantResult[] = corrected.map(p => ({
        name: p.name,
        weightPercent: totalCorrected > 0
            ? parseFloat(((p.correctedI / totalCorrected) * 100).toFixed(1))
            : 0,
        strongestPeakIntensity: p.intensity,
        rir: p.rir,
    }));

    return {
        phases,
        isValid: totalCorrected > 0 && phases.length >= 2,
        method: 'RIR (Semi-Quantitative)',
    };
};
