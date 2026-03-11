/**
 * electroAnalysis.ts
 * 电化学深度分析算法模块
 * 包含数据清洗/质控、Tafel拟合、CV峰检测、K-L方程拟合等真实分析算法
 */

import {
    DataPoint, EngineMode, AnalysisResult, ElectroQcReport,
    TafelFitResult, FitRange, ElectroParams, SensitivityCell,
    BifunctionalMetrics, RadarDimension,
    DEFAULT_ELECTRO_PARAMS
} from './types';

// ==================== 通用数学工具 ====================

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

    // 起始电位：dj/dE 超过阈值的点
    const smoothedYs = smooth(ys, 7);
    const dydx = differentiate(correctedXs, smoothedYs);
    const threshold = Math.max(...dydx.map(Math.abs)) * 0.05;
    let onsetPotential = correctedXs[correctedXs.length - 1];
    for (let i = correctedXs.length - 1; i >= 0; i--) {
        if (Math.abs(dydx[i]) > threshold) {
            onsetPotential = correctedXs[i];
            break;
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

    // 构建 Tafel 数据：η vs log|j|
    // 对于 ORR LSV：η = E_eq - E，j 取绝对值
    const eqPotential = 1.23; // ORR 平衡电位
    const tafelData: { x: number; y: number }[] = [];
    for (const p of sorted) {
        const eta = eqPotential - p.x; // 过电位
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
    data: DataPoint[]
): { range: FitRange; r2: number; count: number } | null => {
    if (data.length < 10) return null;
    const eqPotential = 1.23;
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

    return {
        peakAnodic,
        peakCathodic,
        peakSeparation: Number(peakSeparation.toFixed(3)),
        anodicCathodicRatio: anodicCathodicRatio ? Number(anodicCathodicRatio.toFixed(3)) : undefined,
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
    // For O2 saturated 0.1M KOH: B_theoretical_4e = 0.0144 mA^-1·s^-0.5
    const B = 1 / fit.slope;
    const B_4e = 0.62 * 4 * 96485 * Math.pow(1.9e-5, 2 / 3) * Math.pow(0.01, -1 / 6) * 1.2e-6 * 1000;
    // Simplified: n = B / B_1e * 1, where B_1e = B_4e/4
    const n = Math.min(4, Math.max(0, B / (B_4e / 4)));
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

export const analyzeEIS = (
    data: DataPoint[],
    params: ElectroParams = DEFAULT_ELECTRO_PARAMS
): Partial<AnalysisResult> => {
    if (data.length < 5) return {};

    // Nyquist: x = Z', y = -Z'' (or Z'')
    const sorted = [...data].sort((a, b) => a.x - b.x);

    // Rs: Z' at highest frequency (first point, smallest Z')
    const rs = sorted[0].x;

    // Rct: find the semicircle diameter
    // The semicircle minimum in -Z'' gives the point where the semicircle crosses Z' axis
    // Find the peak of -Z'' (max y)
    let maxZppIdx = 0;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].y > sorted[maxZppIdx].y) maxZppIdx = i;
    }

    // Find where Z'' crosses zero after the peak (semicircle end)
    let rctEnd = sorted[sorted.length - 1].x;
    for (let i = maxZppIdx + 1; i < sorted.length; i++) {
        if (sorted[i].y < sorted[maxZppIdx].y * 0.15) {
            rctEnd = sorted[i].x;
            break;
        }
    }
    const rct = rctEnd - rs;

    // CPE estimation from semicircle peak
    const fPeak = sorted[maxZppIdx];
    const omegaPeak = fPeak.x > 0 ? 1 / (rct * fPeak.y / (rct * rct / 4 + fPeak.y * fPeak.y) || 1) : 0;
    const cpe = omegaPeak > 0 ? 1 / (omegaPeak * rct) : 0;

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
        rs: Number(rs.toFixed(1)),
        rct: Number(rct.toFixed(1)),
        cpe: Number((cpe * 1000).toFixed(2)), // convert to mF
        warburgCoeff,
        cpeExponent: 0.88, // typical value
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

    const eqOER = 1.229; // OER 平衡电位
    const oerOverpotential = potentialAt10 > eqOER ? (potentialAt10 - eqOER) * 1000 : 0; // mV

    // OER Tafel 分析
    const tafelData: { x: number; y: number }[] = [];
    for (const p of sorted) {
        if (p.x > 1.23 && p.y > 0.1) {
            const eta = p.x - eqOER; // OER: η = E - E_eq
            tafelData.push({ x: Math.log10(Math.abs(p.y)), y: eta });
        }
    }
    let oerTafelSlope: number | undefined;
    let oerTafelFit: TafelFitResult | undefined;
    if (tafelData.length >= 5) {
        // 尝试拟合低过电位区
        const lowEtaData = tafelData.filter(p => p.y > 0.2 && p.y < 0.45);
        if (lowEtaData.length >= 3) {
            const fit = linearFit(lowEtaData);
            if (fit && fit.r2 > 0.9) {
                oerTafelSlope = Math.abs(fit.slope) * 1000;
                oerTafelFit = {
                    slope: Number(oerTafelSlope.toFixed(1)),
                    intercept: Number(fit.intercept.toFixed(4)),
                    r2: Number(fit.r2.toFixed(4)),
                    fitRange: { min: 0.2, max: 0.45 },
                    onsetPotential: Number(oerOnsetPotential.toFixed(3)),
                    exchangeCurrentDensity: Number(Math.pow(10, -fit.intercept / fit.slope).toFixed(6)),
                };
            }
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
    data: DataPoint[]
): SensitivityCell[] => {
    if (data.length < 10) return [];
    const eqPotential = 1.23;
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
