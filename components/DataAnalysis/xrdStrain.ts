/**
 * xrdStrain.ts
 * 
 * Williamson-Hall 微应变分析
 * β·cosθ = Kλ/D + 4ε·sinθ
 * 
 * 通过线性回归获取晶粒尺寸 D（截距）和微应变 ε（斜率）
 */

export interface WHDataPoint {
    /** 4·sin(θ)  — x 轴 */
    fourSinTheta: number;
    /** β·cos(θ) — y 轴 (β 为 FWHM in radians) */
    betaCosTheta: number;
    /** 对应峰位 2θ (degrees) */
    twoTheta: number;
    /** 对应 FWHM (degrees) */
    fwhm: number;
}

export interface WHResult {
    /** 晶粒尺寸 D (nm) */
    grainSize: number;
    /** 微应变 ε (无量纲) */
    strain: number;
    /** 线性拟合决定系数 R² */
    R2: number;
    /** W-H 散点数据用于可视化 */
    plotPoints: WHDataPoint[];
    /** 线性拟合参数 y = slope·x + intercept */
    fitLine: { slope: number; intercept: number };
    /** 是否有足够数据 (≥3 个峰) */
    isValid: boolean;
}

/**
 * 执行 Williamson-Hall 分析
 * 
 * @param peaks 各峰信息 [{ twoTheta (degrees), fwhm (degrees) }]
 * @param lambda 波长 (nm)
 * @param K Scherrer 常数 (默认 0.9)
 * @returns WHResult
 */
export const williamsonHall = (
    peaks: Array<{ twoTheta: number; fwhm: number }>,
    lambda: number = 0.15406,
    K: number = 0.9
): WHResult => {
    if (peaks.length < 2) {
        return {
            grainSize: 0,
            strain: 0,
            R2: 0,
            plotPoints: [],
            fitLine: { slope: 0, intercept: 0 },
            isValid: false,
        };
    }

    // 构建 W-H 数据点
    const plotPoints: WHDataPoint[] = peaks
        .filter(p => p.fwhm > 0 && p.twoTheta > 0)
        .map(p => {
            const thetaRad = (p.twoTheta / 2) * (Math.PI / 180);
            const betaRad = p.fwhm * (Math.PI / 180);
            return {
                fourSinTheta: 4 * Math.sin(thetaRad),
                betaCosTheta: betaRad * Math.cos(thetaRad),
                twoTheta: p.twoTheta,
                fwhm: p.fwhm,
            };
        })
        .filter(p => Number.isFinite(p.fourSinTheta) && Number.isFinite(p.betaCosTheta));

    if (plotPoints.length < 2) {
        return {
            grainSize: 0,
            strain: 0,
            R2: 0,
            plotPoints,
            fitLine: { slope: 0, intercept: 0 },
            isValid: false,
        };
    }

    // 线性回归 y = slope·x + intercept
    const n = plotPoints.length;
    const xData = plotPoints.map(p => p.fourSinTheta);
    const yData = plotPoints.map(p => p.betaCosTheta);

    const sumX = xData.reduce((a, b) => a + b, 0);
    const sumY = yData.reduce((a, b) => a + b, 0);
    const sumXY = xData.reduce((s, x, i) => s + x * yData[i], 0);
    const sumX2 = xData.reduce((s, x) => s + x * x, 0);

    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-15) {
        return {
            grainSize: 0,
            strain: 0,
            R2: 0,
            plotPoints,
            fitLine: { slope: 0, intercept: 0 },
            isValid: false,
        };
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY * sumX2 - sumX * sumXY) / denom;

    // 计算 R²
    const yMean = sumY / n;
    const ssTot = yData.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const ssRes = yData.reduce((s, y, i) => s + (y - (slope * xData[i] + intercept)) ** 2, 0);
    const R2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // β·cosθ = Kλ/D + 4ε·sinθ
    // intercept = Kλ/D → D = Kλ/intercept
    // slope = ε (微应变)
    const grainSize = intercept > 0 ? (K * lambda) / intercept : 0;
    const strain = Math.max(0, slope); // 微应变不应为负

    return {
        grainSize,
        strain,
        R2: Math.max(0, R2),
        plotPoints,
        fitLine: { slope, intercept },
        isValid: plotPoints.length >= 3 && intercept > 0,
    };
};
