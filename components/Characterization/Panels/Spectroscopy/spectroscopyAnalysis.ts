/**
 * spectroscopyAnalysis.ts
 * 原位光谱深度分析算法模块
 * 差谱分析、峰拟合、峰面积追踪、峰位移追踪
 */

// ==================== 类型定义 ====================

export interface SpectrumDataPoint {
    wavenumber: number;
    [key: string]: number; // v_1.2, v_1.4, etc.
}

export interface PeakFitResult {
    center: number;      // 峰位 (cm⁻¹)
    height: number;      // 峰高 (a.u.)
    fwhm: number;        // 半峰宽 (cm⁻¹)
    area: number;        // 峰面积
    r2: number;          // 拟合优度
    type: 'gaussian' | 'lorentzian' | 'voigt';
}

export interface DifferenceSpectrumResult {
    data: { wavenumber: number; diff: number }[];
    refKey: string;
    targetKey: string;
    positiveRegions: { start: number; end: number }[];
    negativeRegions: { start: number; end: number }[];
}

export interface PeakRatioPoint {
    voltage: number;
    ratio: number;
    peak1Area: number;
    peak2Area: number;
    peak1Intensity: number;
    peak2Intensity: number;
}

export interface PeakShiftPoint {
    voltage: number;
    peakPosition: number;
    shift: number; // relative to first voltage
    intensity: number;
}

export interface IntermediateAssignment {
    peakCenter: number;
    assignedSpecies: string;
    formula: string;
    vibrationMode: string;
    confidence: number;
    refRange: [number, number];
}

// ==================== 差谱计算 ====================

/**
 * 计算差谱 (目标电位 - 参考电位)
 */
export function computeDifferenceSpectrum(
    data: SpectrumDataPoint[],
    refKey: string,
    targetKey: string
): DifferenceSpectrumResult {
    const diffData = data.map(d => ({
        wavenumber: d.wavenumber,
        diff: (d[targetKey] as number || 0) - (d[refKey] as number || 0),
    }));

    // 识别正/负区域
    const positiveRegions: { start: number; end: number }[] = [];
    const negativeRegions: { start: number; end: number }[] = [];
    let currentRegion: { start: number; end: number; isPositive: boolean } | null = null;

    for (const pt of diffData) {
        const isPositive = pt.diff >= 0;
        if (!currentRegion || currentRegion.isPositive !== isPositive) {
            if (currentRegion) {
                (currentRegion.isPositive ? positiveRegions : negativeRegions).push({
                    start: currentRegion.start,
                    end: currentRegion.end,
                });
            }
            currentRegion = { start: pt.wavenumber, end: pt.wavenumber, isPositive };
        } else {
            currentRegion.end = pt.wavenumber;
        }
    }
    if (currentRegion) {
        (currentRegion.isPositive ? positiveRegions : negativeRegions).push({
            start: currentRegion.start,
            end: currentRegion.end,
        });
    }

    return { data: diffData, refKey, targetKey, positiveRegions, negativeRegions };
}

/**
 * 批量差谱：所有电位相对参考电位的差谱
 */
export function computeAllDifferenceSpectra(
    data: SpectrumDataPoint[],
    refKey: string,
    allKeys: string[]
): DifferenceSpectrumResult[] {
    return allKeys
        .filter(k => k !== refKey)
        .map(k => computeDifferenceSpectrum(data, refKey, k));
}

// ==================== 峰拟合 ====================

/**
 * 高斯函数
 */
function gaussian(x: number, center: number, height: number, sigma: number): number {
    return height * Math.exp(-Math.pow(x - center, 2) / (2 * sigma * sigma));
}

/**
 * 洛伦兹函数
 */
function lorentzian(x: number, center: number, height: number, gamma: number): number {
    return height / (1 + Math.pow((x - center) / gamma, 2));
}

/**
 * 简单最小二乘高斯峰拟合
 * 在指定区间内拟合一个高斯峰
 */
export function fitGaussianPeak(
    data: SpectrumDataPoint[],
    voltageKey: string,
    centerGuess: number,
    halfRange: number = 60
): PeakFitResult | null {
    const region = data.filter(
        d => d.wavenumber >= centerGuess - halfRange && d.wavenumber <= centerGuess + halfRange
    );
    if (region.length < 5) return null;

    const xs = region.map(d => d.wavenumber);
    const ys = region.map(d => d[voltageKey] as number || 0);

    // 估算初始参数
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    const peakHeight = maxY - minY;
    const peakIdx = ys.indexOf(maxY);
    const peakCenter = xs[peakIdx];

    // 估算 FWHM（半峰宽）
    const halfMax = minY + peakHeight / 2;
    let leftIdx = peakIdx;
    while (leftIdx > 0 && ys[leftIdx] > halfMax) leftIdx--;
    let rightIdx = peakIdx;
    while (rightIdx < ys.length - 1 && ys[rightIdx] > halfMax) rightIdx++;
    const fwhm = xs[rightIdx] - xs[leftIdx];
    const sigma = fwhm / (2 * Math.sqrt(2 * Math.log(2)));

    // 使用估算参数进行迭代优化（简化版 Levenberg-Marquardt）
    let bestCenter = peakCenter;
    let bestHeight = peakHeight;
    let bestSigma = Math.max(sigma, 3);
    let bestBaseline = minY;
    let bestSSR = Infinity;

    // 多次微扰搜索最优参数
    for (let dc = -10; dc <= 10; dc += 2) {
        for (let ds = -5; ds <= 5; ds += 2) {
            const c = peakCenter + dc;
            const s = Math.max(bestSigma + ds, 2);
            let ssr = 0;
            for (let i = 0; i < xs.length; i++) {
                const yPred = minY + peakHeight * Math.exp(-Math.pow(xs[i] - c, 2) / (2 * s * s));
                ssr += Math.pow(ys[i] - yPred, 2);
            }
            if (ssr < bestSSR) {
                bestSSR = ssr;
                bestCenter = c;
                bestSigma = s;
            }
        }
    }

    // 计算 R² 
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sst = ys.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
    const r2 = sst > 0 ? 1 - bestSSR / sst : 0;

    // 高斯峰面积: sqrt(2π) * height * sigma
    const area = Math.sqrt(2 * Math.PI) * bestHeight * bestSigma;
    const finalFwhm = bestSigma * 2 * Math.sqrt(2 * Math.log(2));

    return {
        center: bestCenter,
        height: bestHeight,
        fwhm: finalFwhm,
        area: Math.abs(area),
        r2: Math.max(0, Math.min(1, r2)),
        type: 'gaussian',
    };
}

/**
 * 洛伦兹峰拟合
 */
export function fitLorentzianPeak(
    data: SpectrumDataPoint[],
    voltageKey: string,
    centerGuess: number,
    halfRange: number = 60
): PeakFitResult | null {
    const region = data.filter(
        d => d.wavenumber >= centerGuess - halfRange && d.wavenumber <= centerGuess + halfRange
    );
    if (region.length < 5) return null;

    const xs = region.map(d => d.wavenumber);
    const ys = region.map(d => d[voltageKey] as number || 0);
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    const peakHeight = maxY - minY;
    const peakIdx = ys.indexOf(maxY);
    const peakCenter = xs[peakIdx];

    // FWHM 估算
    const halfMax = minY + peakHeight / 2;
    let leftIdx = peakIdx;
    while (leftIdx > 0 && ys[leftIdx] > halfMax) leftIdx--;
    let rightIdx = peakIdx;
    while (rightIdx < ys.length - 1 && ys[rightIdx] > halfMax) rightIdx++;
    const fwhm = xs[rightIdx] - xs[leftIdx];
    const gamma = Math.max(fwhm / 2, 2);

    // 计算拟合残差
    let ssr = 0;
    for (let i = 0; i < xs.length; i++) {
        const yPred = minY + lorentzian(xs[i], peakCenter, peakHeight, gamma);
        ssr += Math.pow(ys[i] - yPred, 2);
    }
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sst = ys.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0);
    const r2 = sst > 0 ? 1 - ssr / sst : 0;

    // 洛伦兹峰面积: π * height * gamma
    const area = Math.PI * peakHeight * gamma;

    return {
        center: peakCenter,
        height: peakHeight,
        fwhm: 2 * gamma,
        area: Math.abs(area),
        r2: Math.max(0, Math.min(1, r2)),
        type: 'lorentzian',
    };
}

// ==================== 峰面积计算（梯形积分） ====================

/**
 * 在指定波数范围内计算峰面积（梯形积分法）
 */
export function computePeakArea(
    data: SpectrumDataPoint[],
    voltageKey: string,
    centerWavenumber: number,
    halfRange: number = 40
): number {
    const region = data.filter(
        d => d.wavenumber >= centerWavenumber - halfRange && d.wavenumber <= centerWavenumber + halfRange
    );
    if (region.length < 2) return 0;

    // 基线：区间端点连线
    const firstY = region[0][voltageKey] as number || 0;
    const lastY = region[region.length - 1][voltageKey] as number || 0;
    const firstX = region[0].wavenumber;
    const lastX = region[region.length - 1].wavenumber;
    const slope = (lastY - firstY) / (lastX - firstX);

    let area = 0;
    for (let i = 0; i < region.length - 1; i++) {
        const x1 = region[i].wavenumber;
        const x2 = region[i + 1].wavenumber;
        const y1 = (region[i][voltageKey] as number || 0) - (firstY + slope * (x1 - firstX));
        const y2 = (region[i + 1][voltageKey] as number || 0) - (firstY + slope * (x2 - firstX));
        area += (y1 + y2) / 2 * (x2 - x1);
    }
    return Math.abs(area);
}

// ==================== 峰面积比 vs 电位追踪 ====================

/**
 * 追踪双峰面积比随电位的变化
 */
export function trackPeakRatioVsVoltage(
    data: SpectrumDataPoint[],
    voltageKeys: string[],
    peak1Center: number,
    peak2Center: number,
    halfRange: number = 40
): PeakRatioPoint[] {
    return voltageKeys.map(key => {
        const voltage = parseFloat(key.replace('v_', ''));
        const peak1Area = computePeakArea(data, key, peak1Center, halfRange);
        const peak2Area = computePeakArea(data, key, peak2Center, halfRange);
        const peak1Intensity = findPeakIntensity(data, key, peak1Center, halfRange);
        const peak2Intensity = findPeakIntensity(data, key, peak2Center, halfRange);
        return {
            voltage,
            ratio: peak2Area > 0 ? peak1Area / peak2Area : 0,
            peak1Area,
            peak2Area,
            peak1Intensity,
            peak2Intensity,
        };
    });
}

/**
 * 在指定范围内查找峰强度
 */
function findPeakIntensity(
    data: SpectrumDataPoint[],
    key: string,
    center: number,
    halfRange: number
): number {
    const region = data.filter(
        d => d.wavenumber >= center - halfRange && d.wavenumber <= center + halfRange
    );
    if (region.length === 0) return 0;
    return Math.max(...region.map(d => d[key] as number || 0));
}

// ==================== 峰位移追踪 ====================

/**
 * 追踪特征峰峰位随电位的蓝移/红移
 */
export function trackPeakShift(
    data: SpectrumDataPoint[],
    voltageKeys: string[],
    peakCenter: number,
    halfRange: number = 40
): PeakShiftPoint[] {
    const results: PeakShiftPoint[] = [];
    let refPosition: number | null = null;

    for (const key of voltageKeys) {
        const voltage = parseFloat(key.replace('v_', ''));
        const region = data.filter(
            d => d.wavenumber >= peakCenter - halfRange && d.wavenumber <= peakCenter + halfRange
        );
        if (region.length === 0) continue;

        // 查找该电位下的峰位（最大值位置）
        let maxIntensity = -Infinity;
        let maxWavenumber = peakCenter;
        for (const d of region) {
            const val = d[key] as number || 0;
            if (val > maxIntensity) {
                maxIntensity = val;
                maxWavenumber = d.wavenumber;
            }
        }

        if (refPosition === null) refPosition = maxWavenumber;

        results.push({
            voltage,
            peakPosition: maxWavenumber,
            shift: maxWavenumber - refPosition,
            intensity: maxIntensity,
        });
    }

    return results;
}

// ==================== 工具函数 ====================

/**
 * 从数据中提取电压键名列表
 */
export function extractVoltageKeys(data: SpectrumDataPoint[]): string[] {
    if (data.length === 0) return [];
    return Object.keys(data[0])
        .filter(k => k.startsWith('v_'))
        .sort((a, b) => parseFloat(a.replace('v_', '')) - parseFloat(b.replace('v_', '')));
}

/**
 * 电压键名转电压值
 */
export function voltageKeyToValue(key: string): number {
    return parseFloat(key.replace('v_', ''));
}

/**
 * 电压值转显示标签
 */
export function voltageKeyToLabel(key: string): string {
    return `${voltageKeyToValue(key)} V`;
}

/**
 * 自动检测峰位: 在全波数范围内寻找明显的峰
 */
export function autoDetectPeaks(
    data: SpectrumDataPoint[],
    voltageKey: string,
    minProminence: number = 15
): number[] {
    const ys = data.map(d => d[voltageKey] as number || 0);
    const xs = data.map(d => d.wavenumber);
    const peaks: number[] = [];

    for (let i = 2; i < ys.length - 2; i++) {
        // 局部最大值检测
        if (ys[i] > ys[i - 1] && ys[i] > ys[i + 1] && ys[i] > ys[i - 2] && ys[i] > ys[i + 2]) {
            // 计算突出度
            const leftMin = Math.min(...ys.slice(Math.max(0, i - 20), i));
            const rightMin = Math.min(...ys.slice(i + 1, Math.min(ys.length, i + 21)));
            const prominence = ys[i] - Math.max(leftMin, rightMin);
            if (prominence >= minProminence) {
                peaks.push(xs[i]);
            }
        }
    }

    return peaks;
}
