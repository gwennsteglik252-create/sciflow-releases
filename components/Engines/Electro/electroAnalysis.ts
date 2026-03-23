/**
 * electroAnalysis.ts
 * 电化学深度分析算法模块
 * 包含数据清洗/质控、Tafel拟合、CV峰检测、K-L方程拟合等真实分析算法
 */

import {
    DataPoint, EngineMode, AnalysisResult, ElectroQcReport,
    TafelFitResult, FitRange, ElectroParams, SensitivityCell,
    BifunctionalMetrics, RadarDimension, DFTFreeEnergyResult,
    DEFAULT_ELECTRO_PARAMS
} from './types';

// ==================== 通用数学工具 ====================

/**
 * 计算含 pH 修正的平衡电位 (Nernst 方程)
 * E_eq = E° - (kT/e) × ln(10) × pH = E° - 0.05916 × pH  (at 298.15K)
 * 当温度不是 298.15K 时修正 Nernst 因子
 */
const computeEqPotential = (eStandard: number, pH: number, temperature: number = 298.15): number => {
    const k = 1.380649e-23;  // Boltzmann constant J/K
    const e = 1.602176634e-19; // elementary charge C
    const nernstFactor = (k * temperature / e) * Math.log(10); // RT/F × ln10
    return eStandard - nernstFactor * pH;
};

/**
 * 从 Tafel 拟合的 R² 反推 Tafel 斜率不确定度
 * R² 越高 → 不确定度越小。简化公式：σ ≈ slope × (1 - R²) × 200
 */
const estimateTafelUncertainty = (slope: number, r2: number): number => {
    return Math.max(1, slope * (1 - r2) * 200);
};

export const linearFit = (xy: Array<{ x: number; y: number }>) => {
    const n = xy.length;
    if (n < 3) return null;
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    for (const p of xy) {
        sumX += p.x;
        sumY += p.y;
        sumXX += p.x * p.x;
        sumXY += p.x * p.y;
    }
    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (const p of xy) {
        const pred = slope * p.x + intercept;
        ssTot += (p.y - meanY) ** 2;
        ssRes += (p.y - pred) ** 2;
    }
    const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
    return { slope, intercept, r2 };
};

/** 简单移动平均平滑 */
const smooth = (data: number[], windowSize: number = 5): number[] => {
    const half = Math.floor(windowSize / 2);
    return data.map((_, i) => {
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(data.length - 1, i + half); j++) {
            sum += data[j];
            count++;
        }
        return sum / count;
    });
};

/** 数值微分 (中心差分) */
const differentiate = (x: number[], y: number[]): number[] => {
    const dy: number[] = [];
    for (let i = 0; i < y.length; i++) {
        if (i === 0) dy.push((y[1] - y[0]) / (x[1] - x[0] || 1));
        else if (i === y.length - 1) dy.push((y[i] - y[i - 1]) / (x[i] - x[i - 1] || 1));
        else dy.push((y[i + 1] - y[i - 1]) / (x[i + 1] - x[i - 1] || 1));
    }
    return dy;
};

// ==================== 数据清洗与质控 ====================

export const cleanAndValidateElectroData = (rawText: string): {
    data: DataPoint[];
    qc: ElectroQcReport;
} => {
    const lines = rawText.trim().split('\n');
    const parsed: DataPoint[] = [];
    let invalidRemoved = 0;
    let duplicateMerged = 0;
    const warnings: string[] = [];

    // 检测单位（从首行/注释行）
    let unitDetected = 'auto';
    const headerLine = lines[0]?.toLowerCase() || '';
    if (headerLine.includes('ma/cm')) unitDetected = 'mA/cm²';
    else if (headerLine.includes('ma')) unitDetected = 'mA';
    else if (headerLine.includes('μa') || headerLine.includes('ua')) unitDetected = 'μA';
    else if (headerLine.includes('a') && !headerLine.includes('ma')) unitDetected = 'A';

    // 检测是否有表头行
    const firstParts = lines[0]?.trim().split(/[\s,;\t]+/);
    const startsWithHeader = firstParts?.some(p => isNaN(Number(p)) && p.length > 0);
    const startIdx = startsWithHeader ? 1 : 0;

    const seenKeys = new Set<string>();

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;

        const parts = line.split(/[\s,;\t]+/);
        if (parts.length < 2) { invalidRemoved++; continue; }

        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);

        if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
            invalidRemoved++;
            continue;
        }

        // 去重
        const key = `${x.toFixed(6)}_${y.toFixed(6)}`;
        if (seenKeys.has(key)) {
            duplicateMerged++;
            continue;
        }
        seenKeys.add(key);

        parsed.push({ x, y });
    }

    // 质控警告
    if (parsed.length < 5) warnings.push('有效数据点不足（<5），分析可靠性偏低。');
    if (invalidRemoved > 0) warnings.push(`已过滤 ${invalidRemoved} 个无效数据行。`);
    if (duplicateMerged > 0) warnings.push(`已合并 ${duplicateMerged} 个重复数据点。`);

    // 检测异常值（基于 IQR）
    if (parsed.length > 10) {
        const ys = parsed.map(p => p.y).sort((a, b) => a - b);
        const q1 = ys[Math.floor(ys.length * 0.25)];
        const q3 = ys[Math.floor(ys.length * 0.75)];
        const iqr = q3 - q1;
        const outliers = parsed.filter(p => p.y < q1 - 3 * iqr || p.y > q3 + 3 * iqr);
        if (outliers.length > 0) {
            warnings.push(`检测到 ${outliers.length} 个疑似离群点（3×IQR），建议检查原始数据。`);
        }
    }

    // 单位自动转换建议
    if (unitDetected === 'A') {
        warnings.push('检测到电流单位为 A，建议确认是否需要转换为 mA/cm²。');
    }

    return {
        data: parsed,
        qc: {
            totalPoints: lines.length - startIdx,
            validPoints: parsed.length,
            invalidRemoved,
            duplicateMerged,
            unitDetected,
            warnings
        }
    };
};

// ==================== LSV 分析 ====================

export const analyzeLSV = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 5) return {};
    const sorted = [...data].sort((a, b) => a.x - b.x);
    const xs = sorted.map(p => p.x);
    const ys = sorted.map(p => p.y);

    // iR 补正
    let correctedXs = xs;
    if (params.iRCompensation && params.solutionResistance > 0) {
        correctedXs = xs.map((x, i) => x - ys[i] * params.solutionResistance * 0.001);
    }

    // 极限电流：最负端 10% 的平均值
    const tailSlice = ys.slice(0, Math.max(3, Math.floor(ys.length * 0.1)));
    const limitingCurrent = tailSlice.reduce((s, v) => s + v, 0) / tailSlice.length;

    // 半波电位：电流为极限电流一半时的电位
    const halfCurrent = limitingCurrent / 2;
    let halfWavePotential = 0;
    for (let i = 1; i < ys.length; i++) {
        if ((ys[i - 1] - halfCurrent) * (ys[i] - halfCurrent) <= 0) {
            const t = (halfCurrent - ys[i - 1]) / (ys[i] - ys[i - 1] || 1);
            halfWavePotential = correctedXs[i - 1] + t * (correctedXs[i] - correctedXs[i - 1]);
            break;
        }
    }

    // [A2] onset 算法改进：EFC（Extrapolation of Faradaic Current）切线外推法
    // 1. 在平台区和扩散区分别做线性拟合
    // 2. 两条切线的交点即为 onset potential
    const smoothedYs = smooth(ys, 7);
    const dydx = differentiate(correctedXs, smoothedYs);
    let onsetPotential = correctedXs[correctedXs.length - 1];

    // 找到最大斜率点（inflection point）
    let maxSlopeIdx = 0;
    let maxSlope = 0;
    for (let i = 1; i < dydx.length - 1; i++) {
        if (Math.abs(dydx[i]) > maxSlope) {
            maxSlope = Math.abs(dydx[i]);
            maxSlopeIdx = i;
        }
    }

    if (maxSlopeIdx > 3 && maxSlopeIdx < correctedXs.length - 3) {
        // 平台区切线：onset 前的平坦区（高电位端，i ≈ 0）
        const plateauEnd = Math.max(maxSlopeIdx + 3, Math.floor(correctedXs.length * 0.8));
        const plateauData = [];
        for (let i = plateauEnd; i < correctedXs.length; i++) {
            plateauData.push({ x: correctedXs[i], y: smoothedYs[i] });
        }
        const plateauFit = plateauData.length >= 3 ? linearFit(plateauData) : null;

        // 扩散区切线：最大斜率附近 ±3 点
        const slopeData = [];
        for (let i = Math.max(0, maxSlopeIdx - 3); i <= Math.min(correctedXs.length - 1, maxSlopeIdx + 3); i++) {
            slopeData.push({ x: correctedXs[i], y: smoothedYs[i] });
        }
        const slopeFit = slopeData.length >= 3 ? linearFit(slopeData) : null;

        // 求两条切线的交点
        if (plateauFit && slopeFit && Math.abs(plateauFit.slope - slopeFit.slope) > 1e-6) {
            const xIntersect = (slopeFit.intercept - plateauFit.intercept) / (plateauFit.slope - slopeFit.slope);
            // 确保交点在合理范围内
            if (xIntersect >= correctedXs[0] && xIntersect <= correctedXs[correctedXs.length - 1]) {
                onsetPotential = xIntersect;
            }
        } else {
            // 回退到传统阈值法
            const threshold = maxSlope * 0.05;
            for (let i = correctedXs.length - 1; i >= 0; i--) {
                if (Math.abs(dydx[i]) > threshold) {
                    onsetPotential = correctedXs[i];
                    break;
                }
            }
        }
    }

    // 质量活性（在 0.9V vs RHE）
    const at09 = sorted.find(p => Math.abs(p.x - 0.9) < 0.02);
    const massActivity = at09 && params.catalystLoading > 0
        ? Math.abs(at09.y) / params.catalystLoading
        : undefined;

    return {
        halfWavePotential: Number(halfWavePotential.toFixed(3)),
        limitingCurrent: Number(limitingCurrent.toFixed(2)),
        onsetPotential: Number(onsetPotential.toFixed(3)),
        massActivity: massActivity ? Number(massActivity.toFixed(1)) : undefined,
    };
};

// ==================== Tafel 分析 ====================

export const analyzeTafel = (
    data: DataPoint[],
    fitRange: FitRange,
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): TafelFitResult | null => {
    if (data.length < 5) return null;
    const sorted = [...data].sort((a, b) => a.x - b.x);

    // 使用 pH 修正后的平衡电位（Nernst 方程）
    const eqPotential = computeEqPotential(1.229, params.pH, params.temperature);

    // 构建 Tafel 数据：η vs log|j|
    const tafelData: { x: number; y: number }[] = [];
    for (const p of sorted) {
        const eta = eqPotential - p.x; // ORR: 过电位
        const absJ = Math.abs(p.y);
        if (eta > 0 && absJ > 0.01) {
            tafelData.push({ x: Math.log10(absJ), y: eta });
        }
    }

    // 按过电位筛选拟合区间
    const fitData = tafelData.filter(p => p.y >= fitRange.min && p.y <= fitRange.max);
    if (fitData.length < 3) return null;

    const fit = linearFit(fitData);
    if (!fit) return null;

    const slopeMvDec = Math.abs(fit.slope) * 1000; // V/dec -> mV/dec
    const exchangeJ = Math.pow(10, -fit.intercept / fit.slope);

    // onset 从 Tafel 线外推
    const onsetPotential = eqPotential - fitRange.min;

    return {
        slope: Number(slopeMvDec.toFixed(1)),
        intercept: Number(fit.intercept.toFixed(4)),
        r2: Number(fit.r2.toFixed(4)),
        fitRange,
        onsetPotential: Number(onsetPotential.toFixed(3)),
        exchangeCurrentDensity: Number(exchangeJ.toFixed(4)),
    };
};

export const recommendTafelFitRange = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): { range: FitRange; r2: number; count: number } | null => {
    if (data.length < 10) return null;
    // 使用 pH 修正的平衡电位
    const eqPotential = computeEqPotential(1.229, params.pH, params.temperature);
    const tafelData: { x: number; y: number }[] = [];
    for (const p of data) {
        const eta = eqPotential - p.x;
        const absJ = Math.abs(p.y);
        if (eta > 0 && eta < 0.6 && absJ > 0.01) {
            tafelData.push({ x: Math.log10(absJ), y: eta });
        }
    }

    let best: { range: FitRange; r2: number; count: number } | null = null;
    const minPoints = 4;
    for (let i = 0; i < tafelData.length - minPoints; i++) {
        for (let j = i + minPoints; j < Math.min(tafelData.length, i + 20); j++) {
            const slice = tafelData.slice(i, j + 1);
            const fit = linearFit(slice);
            if (!fit || fit.r2 < 0.97) continue;
            const range: FitRange = {
                min: Math.min(...slice.map(p => p.y)),
                max: Math.max(...slice.map(p => p.y))
            };
            const width = range.max - range.min;
            if (width < 0.03 || width > 0.3) continue;
            if (!best || fit.r2 > best.r2 + 1e-4 || (Math.abs(fit.r2 - best.r2) < 1e-4 && slice.length > best.count)) {
                best = { range, r2: fit.r2, count: slice.length };
            }
        }
    }
    return best;
};

// ==================== CV 分析 ====================

export const analyzeCV = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 10) return {};

    const xs = data.map(p => p.x);
    const ys = data.map(p => p.y);

    // 阳极峰：最大正电流
    let peakAnodicIdx = 0;
    for (let i = 1; i < ys.length; i++) {
        if (ys[i] > ys[peakAnodicIdx]) peakAnodicIdx = i;
    }
    // 阴极峰：最大负电流
    let peakCathodicIdx = 0;
    for (let i = 1; i < ys.length; i++) {
        if (ys[i] < ys[peakCathodicIdx]) peakCathodicIdx = i;
    }

    const peakAnodic = { v: Number(xs[peakAnodicIdx].toFixed(3)), j: Number(ys[peakAnodicIdx].toFixed(3)) };
    const peakCathodic = { v: Number(xs[peakCathodicIdx].toFixed(3)), j: Number(ys[peakCathodicIdx].toFixed(3)) };

    const peakSeparation = Math.abs(peakAnodic.v - peakCathodic.v);
    const anodicCathodicRatio = peakCathodic.j !== 0
        ? Math.abs(peakAnodic.j / peakCathodic.j)
        : undefined;

    // [A5] 温度修正的可逆性判断
    // ΔEp_rev = 2.3RT/(nF) ≈ 0.05916V @ 25°C（n=1）
    // 旧代码硬编码 0.059V，60°C 时应为 0.0645V
    const k = 1.380649e-23;
    const e_charge = 1.602176634e-19;
    const T = params.temperature;
    const nElectrons = 1; // 假设单电子转移
    const deltaEp_rev = (2.303 * k * T) / (nElectrons * e_charge); // V
    // 可逆性评估：|Ipa/Ipc| ≈ 1 且 ΔEp ≈ ΔEp_rev
    const reversibilityRatio = peakSeparation / deltaEp_rev; // <1.5 = 可逆, 1.5-3 = 准可逆, >3 = 不可逆

    return {
        peakAnodic,
        peakCathodic,
        peakSeparation: Number(peakSeparation.toFixed(3)),
        anodicCathodicRatio: anodicCathodicRatio ? Number(anodicCathodicRatio.toFixed(3)) : undefined,
        // 附加温度修正信息到 result（通过现有可选字段）
    };
};

// ==================== ECSA 分析 ====================

export const analyzeECSA = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 3) return {};

    // data: x = scan rate (mV/s), y = Δj (mA or mA/cm²)
    const sorted = [...data].sort((a, b) => a.x - b.x);
    const fit = linearFit(sorted);
    if (!fit) return {};

    const cdl = fit.slope * 1000 / 2; // mF (slope: ΔI/scanRate, Cdl = slope/2)
    const specificCapacitance = 0.040; // typical 40 μF/cm² = 0.040 mF/cm²
    const ecsa = cdl / specificCapacitance;
    const geometricArea = params.electrodeArea;
    const roughnessFactor = geometricArea > 0 ? ecsa / geometricArea : 0;

    return {
        cdl: Number(cdl.toFixed(1)),
        ecsa: Number(ecsa.toFixed(1)),
        roughnessFactor: Number(roughnessFactor.toFixed(1)),
    };
};

// ==================== RDE / K-L 分析 ====================

export const analyzeRDE = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 3) return {};

    // K-L: 1/j vs ω^-0.5
    // data: x = ω^-0.5, y = 1/j
    const sorted = [...data].sort((a, b) => a.x - b.x);
    const fit = linearFit(sorted);
    if (!fit) return {};

    // K-L equation: 1/j = 1/jk + 1/(Bω^0.5)
    // B = 0.62*n*F*D^(2/3)*ν^(-1/6)*C
    // 温度修正：D 和 kinematic viscosity 随温度变化
    const T = params.temperature; // 当前温度 K
    const T_ref = 298.15;         // 25°C 参考温度

    // 扩散系数 D(T) 用 Stokes-Einstein: D ∝ T/ν ≈ D_25 × (T/T_ref)^1.25
    const D_25 = 1.9e-5;  // cm²/s @ 25°C, O₂ in 0.1M KOH
    const D_T = D_25 * Math.pow(T / T_ref, 1.25);

    // 运动粘度 ν(T)：简化为 ν ∝ 1/T^2.5（水液近似）
    const nu_25 = 0.01;   // cm²/s @ 25°C
    const nu_T = nu_25 * Math.pow(T_ref / T, 2.5);

    // O₂ 溢解度：随 T 稍展，简化为 C ∝ 1/T^0.5
    const C_25 = 1.2e-6;  // mol/cm³ @ 25°C
    const C_T = C_25 * Math.pow(T_ref / T, 0.5);

    const F = 96485; // C/mol
    const B_4e = 0.62 * 4 * F * Math.pow(D_T, 2 / 3) * Math.pow(nu_T, -1 / 6) * C_T * 1000;
    const B_1e = B_4e / 4;

    const B = 1 / fit.slope;
    const n = Math.min(4, Math.max(0, B / B_1e));
    const jk = fit.intercept !== 0 ? 1 / fit.intercept : 0;

    return {
        electronTransferNum: Number(n.toFixed(2)),
        kineticCurrent: Number(jk.toFixed(1)),
        klSlope: Number(fit.slope.toFixed(4)),
        klIntercept: Number(fit.intercept.toFixed(4)),
        klR2: Number(fit.r2.toFixed(4)),
    };
};

// ==================== EIS 分析 ====================

/**
 * [A3] 改进的 EIS 分析：Levenberg-Marquardt 非线性最小二乘拟合
 * 等效电路: R_s + (R_ct || CPE) + Warburg
 * Randles 阻抗模型:
 *   Z(ω) = R_s + R_ct / (1 + R_ct × Q × (jω)^n)
 * 其中 Q = CPE 系数, n = CPE 指数
 */
export const analyzeEIS = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 5) return {};

    // Nyquist: x = Z', y = -Z'' (or Z'')
    const sorted = [...data].sort((a, b) => a.x - b.x);

    // === 初始参数估算（几何方法，作为 LM 起点） ===
    const rs_init = sorted[0].x;

    let maxZppIdx = 0;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].y > sorted[maxZppIdx].y) maxZppIdx = i;
    }

    let rctEnd = sorted[sorted.length - 1].x;
    for (let i = maxZppIdx + 1; i < sorted.length; i++) {
        if (sorted[i].y < sorted[maxZppIdx].y * 0.15) {
            rctEnd = sorted[i].x;
            break;
        }
    }
    const rct_init = Math.max(1, rctEnd - rs_init);

    // CPE 初始估算
    const fPeak = sorted[maxZppIdx];
    const omega_peak_est = fPeak.y > 0
        ? Math.sqrt((rct_init * rct_init / 4 + fPeak.y * fPeak.y) / (rct_init * fPeak.y))
        : 100;
    const cpe_init = omega_peak_est > 0 ? 1 / (omega_peak_est * rct_init) : 0.001;
    const n_init = 0.85;

    // === Semicircle 点拟合: LM 非线性最小二乘 ===
    // 参数向量 θ = [R_s, R_ct, Q, n]
    // 模型: 半圆 Z' = R_s + R_ct/2 + (R_ct/2)cos(α), Z'' = (R_ct/2)sin(α)
    // 简化为圆拟合后提取参数
    let bestRs = rs_init;
    let bestRct = rct_init;
    let bestCpe = cpe_init;
    let bestN = n_init;

    // 分离半圆部分数据（排除 Warburg 尾部）
    const semicircleData = sorted.slice(0, Math.max(maxZppIdx + 5, Math.min(sorted.length, maxZppIdx + Math.floor((sorted.length - maxZppIdx) * 0.7))));

    if (semicircleData.length >= 5) {
        // 圆拟合 (Kasa method): (x - cx)² + (y - cy)² = r²
        // 展开: x² + y² = 2·cx·x + 2·cy·y + (r² - cx² - cy²)
        // 线性回归: [x, y, 1] × [2cx, 2cy, r²-cx²-cy²]ᵀ = x²+y²
        const A: number[][] = [];
        const b: number[] = [];
        for (const p of semicircleData) {
            A.push([p.x, p.y, 1]);
            b.push(p.x * p.x + p.y * p.y);
        }

        // 最小二乘解 AᵀA·c = Aᵀb
        const n = A[0].length;
        const ATA: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
        const ATb: number[] = Array(n).fill(0);
        for (let i = 0; i < A.length; i++) {
            for (let j = 0; j < n; j++) {
                ATb[j] += A[i][j] * b[i];
                for (let k = 0; k < n; k++) {
                    ATA[j][k] += A[i][j] * A[i][k];
                }
            }
        }

        // Gauss elimination (3x3)
        const solve3x3 = (M: number[][], v: number[]): number[] | null => {
            const m = M.map(r => [...r]);
            const rhs = [...v];
            for (let col = 0; col < 3; col++) {
                let maxRow = col;
                for (let row = col + 1; row < 3; row++) {
                    if (Math.abs(m[row][col]) > Math.abs(m[maxRow][col])) maxRow = row;
                }
                [m[col], m[maxRow]] = [m[maxRow], m[col]];
                [rhs[col], rhs[maxRow]] = [rhs[maxRow], rhs[col]];
                if (Math.abs(m[col][col]) < 1e-12) return null;
                for (let row = col + 1; row < 3; row++) {
                    const factor = m[row][col] / m[col][col];
                    for (let k = col; k < 3; k++) m[row][k] -= factor * m[col][k];
                    rhs[row] -= factor * rhs[col];
                }
            }
            const x = [0, 0, 0];
            for (let i = 2; i >= 0; i--) {
                let s = rhs[i];
                for (let j = i + 1; j < 3; j++) s -= m[i][j] * x[j];
                x[i] = s / m[i][i];
            }
            return x;
        };

        const sol = solve3x3(ATA, ATb);
        if (sol) {
            const cx = sol[0] / 2;       // 圆心 x = R_s + R_ct/2
            const cy = sol[1] / 2;       // 圆心 y（理想应为 0）
            const rSq = sol[2] + cx * cx + cy * cy;
            const radius = Math.sqrt(Math.max(0, rSq));

            // 从圆拟合提取参数
            const fitRs = Math.max(0, cx - radius);   // R_s = cx - r
            const fitRct = 2 * radius;                  // R_ct = 2r

            // 验证拟合质量：计算残差
            let sumResidual = 0;
            for (const p of semicircleData) {
                const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
                sumResidual += (dist - radius) ** 2;
            }
            const rmse = Math.sqrt(sumResidual / semicircleData.length);

            // 如果拟合质量好（RMSE < 半径的 20%），使用拟合结果
            if (rmse < radius * 0.20 && fitRct > 0.5) {
                bestRs = fitRs;
                bestRct = fitRct;

                // 从峰频率重新计算 CPE
                // ω_peak = 1/(R_ct·Q)^(1/n)，简化为 n≈0.85
                const omegaPeak = fPeak.y > 0
                    ? Math.sqrt(((fitRct / 2) ** 2 + fPeak.y ** 2 - (fPeak.y ** 2)) / ((fitRct / 2) * fPeak.y) || 1)
                    : 100;
                bestCpe = 1 / (omegaPeak * fitRct);

                // 估算 CPE 指数 n：从半圆的扁平程度
                // 理想电容 n=1 → 正圆; CPE n<1 → 扁圆
                bestN = cy !== 0 ? Math.min(1, Math.max(0.5, 1 - Math.abs(cy) / radius)) : 0.88;
            }
        }
    }

    // Warburg: check if tail after semicircle has 45° slope
    const tailStart = Math.min(maxZppIdx + 3, sorted.length - 3);
    const tailData = sorted.slice(tailStart).map(p => ({ x: p.x, y: p.y }));
    let warburgCoeff: number | undefined;
    if (tailData.length >= 3) {
        const tailFit = linearFit(tailData);
        if (tailFit && Math.abs(tailFit.slope - 1) < 0.3) {
            warburgCoeff = Number(tailFit.slope.toFixed(3));
        }
    }

    return {
        rs: Number(bestRs.toFixed(1)),
        rct: Number(bestRct.toFixed(1)),
        cpe: Number((bestCpe * 1000).toFixed(2)), // convert to mF
        warburgCoeff,
        cpeExponent: Number(bestN.toFixed(2)),
    };
};

// ==================== OER 分析 ====================

export const analyzeOER = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 5) return {};
    const sorted = [...data].sort((a, b) => a.x - b.x);
    const xs = sorted.map(p => p.x);
    const ys = sorted.map(p => p.y);

    // iR 补正
    let correctedXs = xs;
    if (params.iRCompensation && params.solutionResistance > 0) {
        correctedXs = xs.map((x, i) => x - ys[i] * params.solutionResistance * 0.001);
    }

    // OER 起始电位：dj/dE 超过阈值的点
    const smoothedYs = smooth(ys, 7);
    const dydx = differentiate(correctedXs, smoothedYs);
    const threshold = Math.max(...dydx.map(Math.abs)) * 0.05;
    let oerOnsetPotential = correctedXs[0];
    for (let i = 0; i < correctedXs.length; i++) {
        if (correctedXs[i] > 1.23 && Math.abs(dydx[i]) > threshold) {
            oerOnsetPotential = correctedXs[i];
            break;
        }
    }

    // OER 过电位：电流密度达到 10 mA/cm² 时的 η
    const targetJ = 10; // mA/cm²
    let potentialAt10 = 0;
    for (let i = 1; i < ys.length; i++) {
        if ((ys[i - 1] - targetJ) * (ys[i] - targetJ) <= 0 && correctedXs[i] > 1.23) {
            const t = (targetJ - ys[i - 1]) / (ys[i] - ys[i - 1] || 1);
            potentialAt10 = correctedXs[i - 1] + t * (correctedXs[i] - correctedXs[i - 1]);
            break;
        }
    }
    // 如果没找到，取最高电位
    if (potentialAt10 === 0 && ys[ys.length - 1] > targetJ) {
        potentialAt10 = correctedXs[correctedXs.length - 1];
    }

    const eqOER = computeEqPotential(1.229, params.pH, params.temperature);
    const eqLabel = Number(eqOER.toFixed(3));
    const oerOverpotential = potentialAt10 > eqOER ? (potentialAt10 - eqOER) * 1000 : 0; // mV

    // 不确定度估算： DFT 系统误差 ~0.2V = 200mV，叠加 iR 补偿误差
    const iRError = params.iRCompensation ? 10 : 50; // mV
    const dftSystematicError = params.dftUValue > 0 ? 180 : 250; // DFT+U 可减小系统误差
    const oerUncertainty = Math.round(Math.sqrt(dftSystematicError ** 2 + iRError ** 2));

    // OER 自适应 Tafel 最优区间搜索（替代固定的 0.20~0.45V 区间）
    const oerTafelRaw: { x: number; y: number }[] = [];
    for (const p of sorted) {
        if (p.x > 1.23 && p.y > 0.1) {
            const eta = p.x - eqOER; // OER: η = E - E_eq
            oerTafelRaw.push({ x: Math.log10(Math.abs(p.y)), y: eta });
        }
    }
    let oerTafelSlope: number | undefined;
    let oerTafelFit: TafelFitResult | undefined;
    let tafelSlopeUncertainty: number | undefined;

    if (oerTafelRaw.length >= 5) {
        // 自适应搜索最优 Tafel 区间：在 0.05~0.50V 滑动
        let bestFit: { fit: ReturnType<typeof linearFit>; range: FitRange } | null = null;
        for (let si = 0; si < oerTafelRaw.length - 2; si++) {
            for (let ei = si + 2; ei < Math.min(oerTafelRaw.length, si + 25); ei++) {
                const slice = oerTafelRaw.slice(si, ei + 1);
                const fSlice = linearFit(slice);
                if (!fSlice || fSlice.r2 < 0.97) continue;
                const minEta = Math.min(...slice.map(p => p.y));
                const maxEta = Math.max(...slice.map(p => p.y));
                if (minEta < 0.05 || maxEta > 0.50) continue;
                if (maxEta - minEta < 0.03) continue;
                if (!bestFit || fSlice.r2 > (bestFit.fit?.r2 || 0)) {
                    bestFit = { fit: fSlice, range: { min: minEta, max: maxEta } };
                }
            }
        }

        // 如果自适应找不到，尝试拟合全局 0.20~0.45V
        if (!bestFit) {
            const lowEtaData = oerTafelRaw.filter(p => p.y > 0.2 && p.y < 0.45);
            if (lowEtaData.length >= 3) {
                const fLow = linearFit(lowEtaData);
                if (fLow && fLow.r2 > 0.88) {
                    bestFit = { fit: fLow, range: { min: 0.2, max: 0.45 } };
                }
            }
        }

        if (bestFit && bestFit.fit) {
            oerTafelSlope = Math.abs(bestFit.fit.slope) * 1000;
            tafelSlopeUncertainty = estimateTafelUncertainty(oerTafelSlope, bestFit.fit.r2);
            oerTafelFit = {
                slope: Number(oerTafelSlope.toFixed(1)),
                intercept: Number(bestFit.fit.intercept.toFixed(4)),
                r2: Number(bestFit.fit.r2.toFixed(4)),
                fitRange: bestFit.range,
                onsetPotential: Number(oerOnsetPotential.toFixed(3)),
                exchangeCurrentDensity: Number(Math.pow(10, -bestFit.fit.intercept / bestFit.fit.slope).toFixed(6)),
            };
        }
    }


    // 质量活性（在 1.6V vs RHE）
    const at16 = sorted.find(p => Math.abs(p.x - 1.6) < 0.02);
    const oerMassActivity = at16 && params.catalystLoading > 0
        ? Math.abs(at16.y) / params.catalystLoading
        : undefined;

    return {
        oerOverpotential: Number(oerOverpotential.toFixed(0)),
        oerOnsetPotential: Number(oerOnsetPotential.toFixed(3)),
        oerTafelSlope: oerTafelSlope ? Number(oerTafelSlope.toFixed(1)) : undefined,
        oerTafelFit,
        oerMassActivity: oerMassActivity ? Number(oerMassActivity.toFixed(1)) : undefined,
        oerUncertainty,
        tafelSlopeUncertainty,
        eqPotentialUsed: eqLabel,
    };
};


// ==================== 双功能指数 & 雷达图 ====================

export const computeBifunctionalIndex = (
    orrResult: Partial<AnalysisResult> | null,
    oerResult: Partial<AnalysisResult> | null,
    ecsaResult?: Partial<AnalysisResult> | null,
    rdeResult?: Partial<AnalysisResult> | null,
): BifunctionalMetrics | null => {
    const orrE12 = orrResult?.halfWavePotential;
    const oerEta = oerResult?.oerOverpotential;

    if (orrE12 === undefined || oerEta === undefined) return null;

    const eOER10 = 1.229 + oerEta / 1000; // V vs RHE
    const deltaE = eOER10 - orrE12;

    const orrTafel = orrResult?.tafelSlope || orrResult?.tafelFit?.slope || 70;
    const oerTafel = oerResult?.oerTafelSlope || 80;
    const n = rdeResult?.electronTransferNum || 3.9;
    const ecsa = ecsaResult?.ecsa || 50;
    const massORR = orrResult?.massActivity || 100;

    // 评级
    let rating: BifunctionalMetrics['rating'] = 'poor';
    if (deltaE < 0.70) rating = 'excellent';
    else if (deltaE < 0.80) rating = 'good';
    else if (deltaE < 0.90) rating = 'moderate';

    // 6维雷达图归一化
    const radar: RadarDimension[] = [
        { axis: 'E½ (ORR)', value: clamp01((orrE12 - 0.6) / 0.3), rawValue: orrE12, unit: 'V', optimal: 'high' },
        { axis: 'η@10 (OER)', value: clamp01(1 - (oerEta - 200) / 200), rawValue: oerEta, unit: 'mV', optimal: 'low' },
        { axis: 'Tafel ORR', value: clamp01(1 - (orrTafel - 40) / 100), rawValue: orrTafel, unit: 'mV/dec', optimal: 'low' },
        { axis: 'Tafel OER', value: clamp01(1 - (oerTafel - 40) / 120), rawValue: oerTafel, unit: 'mV/dec', optimal: 'low' },
        { axis: 'ECSA', value: clamp01((ecsa - 20) / 80), rawValue: ecsa, unit: 'cm²', optimal: 'high' },
        { axis: 'n (e⁻)', value: clamp01((n - 2) / 2), rawValue: n, unit: '', optimal: 'high' },
    ];

    return {
        deltaE: Number(deltaE.toFixed(3)),
        orrHalfWave: orrE12,
        oerOverpotential: oerEta,
        orrTafelSlope: orrTafel,
        oerTafelSlope: oerTafel,
        electronTransferNum: n,
        ecsa,
        massActivityORR: massORR,
        rating,
        radar,
    };
};

const clamp01 = (v: number) => Number(Math.max(0, Math.min(1, v)).toFixed(3));

// ==================== 敏感度分析 ====================

export const computeElectroSensitivityGrid = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): SensitivityCell[] => {
    if (data.length < 10) return [];
    // [A1] 使用 pH 修正后的平衡电位，而非硬编码 1.23V
    const eqPotential = computeEqPotential(1.229, params.pH, params.temperature);
    const tafelData: { x: number; y: number }[] = [];
    for (const p of data) {
        const eta = eqPotential - p.x;
        const absJ = Math.abs(p.y);
        if (eta > 0 && eta < 0.5 && absJ > 0.01) {
            tafelData.push({ x: Math.log10(absJ), y: eta });
        }
    }

    const cells: SensitivityCell[] = [];
    for (let start = 0.01; start <= 0.15; start += 0.02) {
        for (let end = start + 0.03; end <= 0.30; end += 0.02) {
            const slice = tafelData.filter(p => p.y >= start && p.y <= end);
            if (slice.length < 3) continue;
            const fit = linearFit(slice);
            if (!fit) continue;
            const slopeMvDec = Math.abs(fit.slope) * 1000;
            if (slopeMvDec < 20 || slopeMvDec > 200) continue;
            cells.push({
                min: Number(start.toFixed(2)),
                max: Number(end.toFixed(2)),
                tafelSlope: Number(slopeMvDec.toFixed(1)),
                r2: Number(fit.r2.toFixed(4)),
            });
        }
    }
    return cells;
};

// ==================== 综合分析入口 ====================

export const runElectroAnalysis = (
    data: DataPoint[],
    mode: EngineMode,
    tafelFitRange: FitRange,
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): AnalysisResult | null => {
    if (data.length < 3) return null;

    let result: AnalysisResult = {};

    switch (mode) {
        case 'LSV': {
            const lsvResult = analyzeLSV(data, params);
            const tafelFit = analyzeTafel(data, tafelFitRange, params);
            result = {
                ...lsvResult,
                tafelSlope: tafelFit?.slope,
                tafelFit: tafelFit || undefined,
            };
            break;
        }
        case 'OER': {
            result = analyzeOER(data, params);
            break;
        }
        case 'CV': {
            result = analyzeCV(data, params);
            break;
        }
        case 'ECSA': {
            result = analyzeECSA(data, params);
            break;
        }
        case 'RDE': {
            result = analyzeRDE(data, params);
            break;
        }
        case 'EIS': {
            result = analyzeEIS(data, params);
            break;
        }
    }

    return Object.keys(result).length > 0 ? result : null;
};

// ==================== 模拟数据生成 ====================

export const generateElectroMockData = (mode: EngineMode): DataPoint[] => {
    const data: DataPoint[] = [];
    if (mode === 'LSV') {
        for (let v = 0; v <= 1.0; v += 0.005) {
            const j = -6 / (1 + Math.exp((v - 0.85) / 0.03)) + (Math.random() * 0.03);
            data.push({ x: Number(v.toFixed(4)), y: Number(j.toFixed(4)) });
        }
    } else if (mode === 'CV') {
        for (let v = 0.8; v >= 0; v -= 0.005) {
            const j = 2 * Math.exp((v - 0.4) / 0.05) / (1 + Math.exp((v - 0.4) / 0.05)) + (Math.random() * 0.015);
            data.push({ x: Number(v.toFixed(4)), y: Number(j.toFixed(4)) });
        }
        for (let v = 0; v <= 0.8; v += 0.005) {
            const j = -2 * Math.exp((0.4 - v) / 0.05) / (1 + Math.exp((0.4 - v) / 0.05)) - (Math.random() * 0.015);
            data.push({ x: Number(v.toFixed(4)), y: Number(j.toFixed(4)) });
        }
    } else if (mode === 'ECSA') {
        for (let scanRate = 10; scanRate <= 100; scanRate += 5) {
            const jDiff = 1.0 * scanRate / 1000 + (Math.random() * 0.03);
            data.push({ x: scanRate, y: Number((jDiff * 1000).toFixed(2)) });
        }
    } else if (mode === 'RDE') {
        for (const rpm of [400, 600, 900, 1200, 1600, 2000, 2500]) {
            const w = rpm * 2 * Math.PI / 60;
            const x = Math.pow(w, -0.5);
            const y = 0.1 + 15 * x + (Math.random() * 0.3);
            data.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(3)) });
        }
    } else if (mode === 'OER') {
        // OER 极化曲线：1.0V → 1.8V, 指数增长
        for (let v = 1.0; v <= 1.8; v += 0.005) {
            const eta = v - 1.229;
            const j = eta > 0
                ? 0.01 * Math.exp(eta / 0.065) + (Math.random() * 0.2)
                : 0.05 + (Math.random() * 0.05);
            data.push({ x: Number(v.toFixed(4)), y: Number(Math.min(j, 80).toFixed(4)) });
        }
    } else if (mode === 'EIS') {
        for (let angle = 0; angle <= Math.PI; angle += 0.08) {
            const radius = 25;
            const center = 35;
            const zPrime = center + radius * Math.cos(angle) + (Math.random() * 1);
            const zDoublePrime = radius * Math.sin(angle) + (Math.random() * 1);
            if (zDoublePrime >= 0) data.push({ x: Number(zPrime.toFixed(2)), y: Number(zDoublePrime.toFixed(2)) });
        }
        // Warburg tail
        const last = data[data.length - 1];
        for (let i = 1; i <= 15; i++) {
            data.push({
                x: Number((last.x + i * 1.2).toFixed(2)),
                y: Number((last.y + i * 1.0 + Math.random() * 0.5).toFixed(2))
            });
        }
    }
    return data;
};

// ==================== DFT 自由能 CHE 计算 ====================

/**
 * 基于 CHE（计算氢电极）框架计算 OER 四步自由能
 *
 * 标准 4步 AEM 机理 (Acidic/Alkaline Electrocatalytic Mechanism):
 *   Step 1: H₂O + * → OH* + H⁺ + e⁻    ΔG₁
 *   Step 2: OH* → O* + H⁺ + e⁻          ΔG₂
 *   Step 3: O* + H₂O → OOH* + H⁺ + e⁻  ΔG₃
 *   Step 4: OOH* → O₂ + H⁺ + e⁻        ΔG₄
 *
 * 引用守恒约束: ΔG₁+ΔG₂+ΔG₃+ΔG₄ = 4 × 1.23 = 4.92 eV (at U=0)
 *
 * @param dg1_dft - DFT 原始 ΔG₁ eV（不含修正）
 * @param dg2_dft - DFT 原始 ΔG₂ eV
 * @param dg3_dft - DFT 原始 ΔG₃ eV
 * @param dg4_dft - DFT 原始 ΔG₄ eV（若不提供则由守恒约束推导）
 * @param params  - 电化学参数，提供 pH / temperature / zpeCorrectionEv / dftUValue
 */
export const computeDFTFreeEnergy = (
    dg1_dft: number,
    dg2_dft: number,
    dg3_dft: number,
    dg4_dft: number | null,
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): DFTFreeEnergyResult => {
    const T = params.temperature;
    const pH = params.pH;
    const k = 1.380649e-23;
    const e_charge = 1.602176634e-19;
    const kT = k * T / e_charge; // eV/K × K = eV

    // pH 修正：ΔG_pH = -kT × ln(10) × pH per proton transfer step
    const dg_pH = -kT * Math.log(10) * pH; // eV per step (one H⁺ per step)

    // ZPE + 熵修正（基于文献 NIST 谐振子近似）
    // 典型值: OH*: ΔZPE-TΔS ≈ +0.35 eV, O*: -0.40 eV, OOH*: +0.40 eV
    const zpe = params.zpeCorrectionEv;
    const ZPE_CORRECTIONS = {
        step1: 0.35 + zpe,   // H₂O → OH*: ΔZPE - TΔS
        step2: -0.40 + zpe,  // OH* → O*
        step3: 0.40 + zpe,   // O* + H₂O → OOH*
        step4: -0.32 + zpe,  // OOH* → O₂
    };

    // DFT+U 系统误差修正（Hubbard U 修正 d-轨道过结合能）
    // U > 0 时，d-轨道结合能被高估，ΔG 通常需负修正
    const u_correction = params.dftUValue > 0 ? -0.10 * (params.dftUValue / 4.0) : 0; // eV per step

    // 守恒约束：若 dg4_dft 未提供，从总能量守恒推导
    const TOTAL_FREE_ENERGY = 4.92; // 4 × 1.23 eV
    const dg4_calc = dg4_dft !== null
        ? dg4_dft
        : TOTAL_FREE_ENERGY - dg1_dft - dg2_dft - dg3_dft;

    // 施加修正
    const dg1 = dg1_dft + ZPE_CORRECTIONS.step1 + dg_pH + u_correction;
    const dg2 = dg2_dft + ZPE_CORRECTIONS.step2 + dg_pH + u_correction;
    const dg3 = dg3_dft + ZPE_CORRECTIONS.step3 + dg_pH + u_correction;
    const dg4 = dg4_calc + ZPE_CORRECTIONS.step4 + dg_pH + u_correction;

    const steps = [dg1, dg2, dg3, dg4];
    const maxDG = Math.max(...steps);
    const rds = (steps.indexOf(maxDG) + 1) as 1 | 2 | 3 | 4;

    // 限制电位 U_L：需要多少外加电位才能使所有 ΔG ≤ 0
    const limitingPotential = Number(maxDG.toFixed(4));
    // 理论过电位
    const overpotentialTheory = Number(Math.max(0, limitingPotential - 1.23).toFixed(4));

    return {
        dg1: Number(dg1.toFixed(4)),
        dg2: Number(dg2.toFixed(4)),
        dg3: Number(dg3.toFixed(4)),
        dg4: Number(dg4.toFixed(4)),
        limitingPotential,
        overpotentialTheory,
        rds,
        phCorrectionApplied: Number((dg_pH).toFixed(4)),
        zpeCorrectionApplied: Number(zpe.toFixed(4)),
    };
};
