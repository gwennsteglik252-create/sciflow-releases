/**
 * timeResolvedAnalysis.ts
 * 时间分辨光谱分析 + 稳定性衰减分析 + 相变检测算法
 */

import { SpectrumDataPoint } from './spectroscopyAnalysis';

// ==================== 类型定义 ====================

export interface TimeSpectrumDataPoint {
    wavenumber: number;
    [key: string]: number; // t_0, t_10, t_30, t_60, t_120, ... (分钟)
}

export interface DecayResult {
    peakCenter: number;
    halfLife: number;          // 半衰期 (min)
    decayRate: number;         // 衰减速率 (% / h)
    initialIntensity: number;
    finalIntensity: number;
    retentionPercent: number;  // 保持率 %
    fitType: 'exponential' | 'linear' | 'stable';
    fitR2: number;
    timePoints: { time: number; intensity: number; fitted: number }[];
}

export interface PhaseTransition {
    detectedTime: number;      // 检测到相变的时间 (min)
    description: string;
    fromPhase: string;
    toPhase: string;
    evidence: string;
    severity: 'info' | 'warning' | 'critical';
}

export interface StabilityReport {
    overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    overallScore: number;      // 0-100
    peakDecays: DecayResult[];
    phaseTransitions: PhaseTransition[];
    summary: string;
    recommendation: string;
}

// ==================== 时间键提取 ====================

export function extractTimeKeys(data: TimeSpectrumDataPoint[]): string[] {
    if (data.length === 0) return [];
    return Object.keys(data[0])
        .filter(k => k.startsWith('t_'))
        .sort((a, b) => timeKeyToMinutes(a) - timeKeyToMinutes(b));
}

export function timeKeyToMinutes(key: string): number {
    return parseFloat(key.replace('t_', ''));
}

export function timeKeyToLabel(key: string): string {
    const min = timeKeyToMinutes(key);
    if (min < 60) return `${min} min`;
    if (min < 1440) return `${(min / 60).toFixed(1)} h`;
    return `${(min / 1440).toFixed(1)} d`;
}

// ==================== 衰减拟合 ====================

/**
 * 指数衰减拟合: I(t) = I₀ × exp(-kt) + C
 */
export function fitExponentialDecay(
    times: number[],
    intensities: number[]
): { k: number; I0: number; C: number; r2: number; halfLife: number } {
    if (times.length < 3) {
        return { k: 0, I0: intensities[0] || 0, C: 0, r2: 0, halfLife: Infinity };
    }

    const I0 = intensities[0];
    const ILast = intensities[intensities.length - 1];
    const C = Math.min(...intensities) * 0.8;

    // 线性化: ln(I - C) = ln(I₀ - C) - kt
    const validPoints: { t: number; lnI: number }[] = [];
    for (let i = 0; i < times.length; i++) {
        const val = intensities[i] - C;
        if (val > 0) {
            validPoints.push({ t: times[i], lnI: Math.log(val) });
        }
    }

    if (validPoints.length < 2) {
        return { k: 0, I0, C: 0, r2: 0, halfLife: Infinity };
    }

    // 线性回归 ln(I-C) vs t
    const n = validPoints.length;
    const sumT = validPoints.reduce((s, p) => s + p.t, 0);
    const sumLnI = validPoints.reduce((s, p) => s + p.lnI, 0);
    const sumTLnI = validPoints.reduce((s, p) => s + p.t * p.lnI, 0);
    const sumT2 = validPoints.reduce((s, p) => s + p.t * p.t, 0);

    const denom = n * sumT2 - sumT * sumT;
    if (Math.abs(denom) < 1e-10) {
        return { k: 0, I0, C: 0, r2: 0, halfLife: Infinity };
    }

    const slope = (n * sumTLnI - sumT * sumLnI) / denom;
    const intercept = (sumLnI - slope * sumT) / n;

    const k = -slope; // 衰减常数
    const fittedI0 = Math.exp(intercept) + C;

    // R²
    const meanLnI = sumLnI / n;
    const sst = validPoints.reduce((s, p) => s + Math.pow(p.lnI - meanLnI, 2), 0);
    const ssr = validPoints.reduce(
        (s, p) => s + Math.pow(p.lnI - (intercept + slope * p.t), 2), 0
    );
    const r2 = sst > 0 ? 1 - ssr / sst : 0;

    const halfLife = k > 0 ? Math.log(2) / k : Infinity;

    return { k, I0: fittedI0, C, r2: Math.max(0, r2), halfLife };
}

/**
 * 分析单个峰的衰减行为
 */
export function analyzePeakDecay(
    data: TimeSpectrumDataPoint[],
    timeKeys: string[],
    peakCenter: number,
    halfRange: number = 40
): DecayResult {
    const times = timeKeys.map(timeKeyToMinutes);
    const intensities = timeKeys.map(key => {
        const region = data.filter(
            d => d.wavenumber >= peakCenter - halfRange && d.wavenumber <= peakCenter + halfRange
        );
        if (region.length === 0) return 0;
        return Math.max(...region.map(d => (d[key] as number) || 0));
    });

    const I0 = intensities[0] || 1;
    const IFinal = intensities[intensities.length - 1] || 0;
    const retentionPercent = (IFinal / I0) * 100;

    // 判断衰减类型
    const relativeDecay = 1 - retentionPercent / 100;

    let fitType: 'exponential' | 'linear' | 'stable' = 'stable';
    if (relativeDecay > 0.1) fitType = 'exponential';
    else if (relativeDecay > 0.03) fitType = 'linear';

    const expFit = fitExponentialDecay(times, intensities);
    const duration = times[times.length - 1] - times[0] || 1;
    const decayRate = ((I0 - IFinal) / I0) * 100 * (60 / duration);

    const timePoints = times.map((t, i) => ({
        time: t,
        intensity: intensities[i],
        fitted: (expFit.I0 - expFit.C) * Math.exp(-expFit.k * t) + expFit.C,
    }));

    return {
        peakCenter,
        halfLife: expFit.halfLife,
        decayRate,
        initialIntensity: I0,
        finalIntensity: IFinal,
        retentionPercent,
        fitType,
        fitR2: expFit.r2,
        timePoints,
    };
}

// ==================== 相变检测 ====================

/**
 * 基于拉曼特征峰演变检测相变
 */
export function detectPhaseTransitions(
    data: TimeSpectrumDataPoint[],
    timeKeys: string[]
): PhaseTransition[] {
    const transitions: PhaseTransition[] = [];
    const times = timeKeys.map(timeKeyToMinutes);

    // 检查 ：尖晶石 Co₃O₄ 特征峰 (~690 cm⁻¹) 变化
    const spinelRegion = { center: 690, range: 30, name: 'Co₃O₄ (尖晶石 A1g)' };
    // 检查：层状 CoOOH 特征峰 (~500 cm⁻¹) 变化
    const layeredRegion = { center: 500, range: 30, name: 'CoOOH (层状)' };

    const checkRegions = [spinelRegion, layeredRegion];

    for (const region of checkRegions) {
        const intensities = timeKeys.map(key => {
            const pts = data.filter(
                d => d.wavenumber >= region.center - region.range && d.wavenumber <= region.center + region.range
            );
            if (pts.length === 0) return 0;
            return Math.max(...pts.map(d => (d[key] as number) || 0));
        });

        // 寻找突变点（相邻两点变化超过 30%）
        for (let i = 1; i < intensities.length; i++) {
            const prev = intensities[i - 1] || 1;
            const change = (intensities[i] - prev) / prev;

            if (Math.abs(change) > 0.3) {
                if (region.center === spinelRegion.center && change < -0.3) {
                    transitions.push({
                        detectedTime: times[i],
                        description: `${region.name} 信号在 ${timeKeyToLabel(timeKeys[i])} 发生显著衰减 (${(change * 100).toFixed(0)}%)`,
                        fromPhase: 'Co₃O₄ 尖晶石相',
                        toPhase: 'CoOOH 层状结构',
                        evidence: `690 cm⁻¹ A1g 模式强度降低 ${Math.abs(change * 100).toFixed(0)}%`,
                        severity: Math.abs(change) > 0.5 ? 'critical' : 'warning',
                    });
                } else if (region.center === layeredRegion.center && change > 0.3) {
                    transitions.push({
                        detectedTime: times[i],
                        description: `${region.name} 信号在 ${timeKeyToLabel(timeKeys[i])} 出现显著增强 (${(change * 100).toFixed(0)}%)`,
                        fromPhase: '初始相',
                        toPhase: 'CoOOH 活性层',
                        evidence: `500 cm⁻¹ 处新峰出现，可能为反应诱导表面重构`,
                        severity: 'info',
                    });
                }
            }
        }
    }

    return transitions;
}

// ==================== 综合稳定性报告 ====================

export function generateStabilityReport(
    data: TimeSpectrumDataPoint[],
    timeKeys: string[],
    peakCenters: number[] = [580, 820]
): StabilityReport {
    const peakDecays = peakCenters.map(center =>
        analyzePeakDecay(data, timeKeys, center)
    );

    const phaseTransitions = detectPhaseTransitions(data, timeKeys);

    // 综合评分
    const avgRetention = peakDecays.reduce((s, d) => s + d.retentionPercent, 0) / peakDecays.length;
    const hasCriticalTransition = phaseTransitions.some(t => t.severity === 'critical');
    const hasWarningTransition = phaseTransitions.some(t => t.severity === 'warning');

    let score = avgRetention;
    if (hasCriticalTransition) score -= 20;
    if (hasWarningTransition) score -= 10;
    score = Math.max(0, Math.min(100, score));

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 40) grade = 'D';

    const summary = `催化剂平均信号保持率 ${avgRetention.toFixed(1)}%，` +
        `检测到 ${phaseTransitions.length} 个相变/结构变化事件。` +
        `综合稳定性等级: ${grade} (${score.toFixed(0)}分)。`;

    const recommendation = score >= 80
        ? '催化剂在测试时间范围内表现出良好的结构稳定性，可用于长期运行。'
        : score >= 60
            ? '催化剂存在中等程度的活性衰减，建议优化表面防护策略或掺杂稳定元素。'
            : '催化剂存在严重的结构退化，需要重新设计合成策略以提高稳定性。';

    return {
        overallGrade: grade,
        overallScore: score,
        peakDecays,
        phaseTransitions,
        summary,
        recommendation,
    };
}

// ==================== 模拟数据生成 ====================

/**
 * 生成时间分辨原位光谱演示数据
 * 模拟恒电位 1.6 V 下的稳定性测试
 */
export function generateTimeResolvedDemoData(): TimeSpectrumDataPoint[] {
    const timePoints = [0, 10, 30, 60, 120, 240, 480]; // 分钟
    const data: TimeSpectrumDataPoint[] = [];

    for (let w = 400; w <= 1000; w += 5) {
        const entry: TimeSpectrumDataPoint = { wavenumber: w };
        timePoints.forEach(t => {
            let intensity = 10 + Math.random() * 1.5;
            // 580 cm⁻¹ M-OOH 峰：随时间缓慢衰减
            const decayFactor = Math.exp(-t / 600); // 半衰期 ~420 min
            intensity += 100 * decayFactor * Math.exp(-Math.pow(w - 580, 2) / 400);
            // 820 cm⁻¹ M-OH 峰：几乎稳定
            intensity += 65 * (1 - 0.05 * (t / 480)) * Math.exp(-Math.pow(w - 820, 2) / 600);
            // 500 cm⁻¹ 新峰：在 120 min 后逐渐出现（表面重构）
            if (t > 60) {
                const growthFactor = Math.min(1, (t - 60) / 300);
                intensity += 30 * growthFactor * Math.exp(-Math.pow(w - 500, 2) / 300);
            }
            entry[`t_${t}`] = parseFloat(intensity.toFixed(2));
        });
        data.push(entry);
    }
    return data;
}
