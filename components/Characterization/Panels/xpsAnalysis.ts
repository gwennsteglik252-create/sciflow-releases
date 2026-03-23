/**
 * xpsAnalysis.ts
 * XPS 表面化学分析算法模块
 * 包含 Shirley 背景扣除、Voigt 峰拟合、自动峰检测、化学态标准库、原子百分比定量
 */

// ==================== 类型定义 ====================

export interface XpsDataPoint {
    be: number;        // Binding Energy (eV)
    intensity: number; // Intensity (cps)
}

export interface XpsQcReport {
    totalPoints: number;
    validPoints: number;
    invalidRemoved: number;
    snr: number;        // 信噪比
    noiseLevel: number;
    beRange: [number, number];
    warnings: string[];
}

export interface XpsPeakParams {
    id: string;
    center: number;       // BE (eV)
    fwhm: number;         // Full Width at Half Maximum
    area: number;         // 积分面积
    height: number;       // 峰高
    mixRatio: number;     // 0=纯高斯, 1=纯洛伦兹
    chemicalState: string; // 化学态归属
    color: string;
}

export interface XpsFitResult {
    peaks: XpsPeakParams[];
    background: number[];     // 背景数据（与原始数据等长）
    envelope: number[];       // 包络线（所有峰之和 + 背景）
    residual: number[];       // 残差
    rSquared: number;         // 拟合优度
    chiSquared: number;
}

export interface XpsQuantResult {
    element: string;
    orbital: string;
    peakArea: number;
    sensitivityFactor: number;
    atomicPercent: number;
    peaks: Array<{
        chemicalState: string;
        be: number;
        area: number;
        areaPercent: number; // 该峰占该元素总面积的百分比（价态比）
        fwhm: number;
    }>;
}

export interface XpsRecord {
    id: string;
    title: string;
    timestamp: string;
    linkedContext?: {
        projectId: string;
        milestoneId: string;
        logId: string;
    } | null;
    folder?: {
        projectId?: string;
        projectTitle?: string;
        milestoneId?: string;
        milestoneTitle?: string;
        logId?: string;
        logTitle?: string;
        path?: string;
    };
    data: {
        element: string;
        rawData: string;
        parsedData: XpsDataPoint[];
        fitResult: XpsFitResult | null;
        quantResult: XpsQuantResult | null;
        bgType: BackgroundType;
        aiConclusion: string | null;
    };
}

export type BackgroundType = 'shirley' | 'linear' | 'none';

export interface CompareSample {
    id: string;
    title: string;
    element: string;
    data: XpsDataPoint[];
    fitResult: XpsFitResult | null;
    color: string;
}

export const COMPARE_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'];

// ==================== 化学态标准库 ====================

export interface ChemicalStateRef {
    state: string;        // 化学态名
    be: number;           // 标准 BE (eV)
    tolerance: number;    // 匹配容差
}

export const XPS_STANDARD_LIBRARY: Record<string, ChemicalStateRef[]> = {
    'Co 2p': [
        { state: 'Co⁰ (金属)', be: 778.3, tolerance: 0.5 },
        { state: 'CoO (Co²⁺)', be: 780.2, tolerance: 0.6 },
        { state: 'Co₃O₄ (Co²⁺/³⁺)', be: 779.8, tolerance: 0.5 },
        { state: 'Co₂O₃ (Co³⁺)', be: 780.8, tolerance: 0.6 },
        { state: 'Co(OH)₂', be: 781.1, tolerance: 0.5 },
        { state: 'CoOOH', be: 780.5, tolerance: 0.5 },
        { state: 'Satellite', be: 786.0, tolerance: 1.5 },
    ],
    'Ni 2p': [
        { state: 'Ni⁰ (金属)', be: 852.7, tolerance: 0.5 },
        { state: 'NiO (Ni²⁺)', be: 854.0, tolerance: 0.6 },
        { state: 'Ni₂O₃ (Ni³⁺)', be: 855.8, tolerance: 0.6 },
        { state: 'Ni(OH)₂', be: 855.5, tolerance: 0.5 },
        { state: 'NiOOH', be: 856.2, tolerance: 0.6 },
        { state: 'Satellite', be: 861.0, tolerance: 1.5 },
    ],
    'Fe 2p': [
        { state: 'Fe⁰ (金属)', be: 706.8, tolerance: 0.5 },
        { state: 'FeO (Fe²⁺)', be: 709.5, tolerance: 0.6 },
        { state: 'Fe₂O₃ (Fe³⁺)', be: 711.2, tolerance: 0.6 },
        { state: 'Fe₃O₄ (Fe²⁺/³⁺)', be: 710.6, tolerance: 0.5 },
        { state: 'FeOOH', be: 711.8, tolerance: 0.6 },
        { state: 'Satellite', be: 719.0, tolerance: 1.5 },
    ],
    'O 1s': [
        { state: '晶格氧 (M-O)', be: 529.8, tolerance: 0.5 },
        { state: '表面羟基 (M-OH)', be: 531.3, tolerance: 0.6 },
        { state: '吸附水/碳酸', be: 532.5, tolerance: 0.7 },
        { state: '有机 C-O', be: 533.2, tolerance: 0.5 },
    ],
    'N 1s': [
        { state: '吡啶氮', be: 398.5, tolerance: 0.5 },
        { state: '吡咯氮', be: 400.0, tolerance: 0.5 },
        { state: '石墨氮', be: 401.2, tolerance: 0.5 },
        { state: '氧化氮', be: 402.5, tolerance: 0.6 },
        { state: 'M-N 配位', be: 399.2, tolerance: 0.5 },
    ],
    'Pt 4f': [
        { state: 'Pt⁰ (金属)', be: 71.2, tolerance: 0.4 },
        { state: 'PtO (Pt²⁺)', be: 72.4, tolerance: 0.5 },
        { state: 'PtO₂ (Pt⁴⁺)', be: 74.5, tolerance: 0.5 },
        { state: 'Pt(OH)₂', be: 73.1, tolerance: 0.5 },
    ],
    'C 1s': [
        { state: 'C-C/C=C', be: 284.8, tolerance: 0.4 },
        { state: 'C-N', be: 285.8, tolerance: 0.5 },
        { state: 'C-O', be: 286.5, tolerance: 0.5 },
        { state: 'C=O', be: 288.0, tolerance: 0.5 },
        { state: 'O-C=O', be: 289.0, tolerance: 0.5 },
    ],
};

// 灵敏度因子 (Scofield cross-section, 近似值)
export const SENSITIVITY_FACTORS: Record<string, number> = {
    'C 1s': 1.00, 'N 1s': 1.80, 'O 1s': 2.93, 'Fe 2p': 16.42,
    'Co 2p': 18.00, 'Ni 2p': 22.18, 'Pt 4f': 17.69, 'S 2p': 1.68,
    'Cl 2p': 2.29, 'P 2p': 1.19, 'F 1s': 4.43, 'Si 2p': 0.82,
};

const PEAK_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

// ==================== 数据清洗 ====================

export const cleanAndValidateXpsData = (rawText: string): {
    data: XpsDataPoint[];
    qc: XpsQcReport;
} => {
    const lines = rawText.trim().split('\n');
    const parsed: XpsDataPoint[] = [];
    let invalidRemoved = 0;
    const warnings: string[] = [];

    const firstParts = lines[0]?.trim().split(/[\s,;\t]+/);
    const startsWithHeader = firstParts?.some(p => isNaN(Number(p)) && p.length > 0);
    const startIdx = startsWithHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith('//')) continue;
        const parts = line.split(/[\s,;\t]+/);
        if (parts.length < 2) { invalidRemoved++; continue; }
        const be = parseFloat(parts[0]);
        const intensity = parseFloat(parts[1]);
        if (isNaN(be) || isNaN(intensity) || !isFinite(be) || !isFinite(intensity)) {
            invalidRemoved++;
            continue;
        }
        parsed.push({ be, intensity });
    }

    // 按 BE 排序（降序，XPS惯例）
    parsed.sort((a, b) => b.be - a.be);

    // 信噪比估算
    let noiseLevel = 0;
    if (parsed.length > 10) {
        const tail5 = parsed.slice(-5);
        const head5 = parsed.slice(0, 5);
        const baselineAvg = [...tail5, ...head5].reduce((s, p) => s + p.intensity, 0) / 10;
        const maxI = Math.max(...parsed.map(p => p.intensity));
        const diffs = parsed.slice(0, -1).map((p, i) => Math.abs(parsed[i + 1].intensity - p.intensity));
        noiseLevel = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
        const snr = noiseLevel > 0 ? (maxI - baselineAvg) / noiseLevel : 0;

        if (parsed.length < 10) warnings.push('数据点过少（<10），拟合可靠性偏低。');
        if (snr < 3) warnings.push('信噪比偏低（<3），建议使用更长采集时间。');
        if (invalidRemoved > 0) warnings.push(`已过滤 ${invalidRemoved} 个无效数据行。`);

        const beRange: [number, number] = [
            Math.min(...parsed.map(p => p.be)),
            Math.max(...parsed.map(p => p.be)),
        ];

        return {
            data: parsed,
            qc: {
                totalPoints: lines.length - startIdx,
                validPoints: parsed.length,
                invalidRemoved,
                snr: Number(snr.toFixed(1)),
                noiseLevel: Number(noiseLevel.toFixed(1)),
                beRange,
                warnings,
            }
        };
    }

    if (parsed.length < 5) warnings.push('数据点不足，无法进行有效分析。');

    return {
        data: parsed,
        qc: {
            totalPoints: lines.length - startIdx,
            validPoints: parsed.length,
            invalidRemoved,
            snr: 0,
            noiseLevel: 0,
            beRange: parsed.length > 0
                ? [Math.min(...parsed.map(p => p.be)), Math.max(...parsed.map(p => p.be))]
                : [0, 0],
            warnings,
        }
    };
};

// ==================== 背景扣除 ====================

export const shirleyBackground = (data: XpsDataPoint[], maxIter: number = 30): number[] => {
    const n = data.length;
    if (n < 3) return data.map(d => d.intensity * 0.5);

    const intensities = data.map(d => d.intensity);
    const yLeft = intensities[0];                // 高 BE 端
    const yRight = intensities[n - 1];           // 低 BE 端

    let bg = new Array(n).fill((yLeft + yRight) / 2);

    for (let iter = 0; iter < maxIter; iter++) {
        const newBg = new Array(n);
        // 从右端（低BE）到左端（高BE）积分
        const totalIntegral = intensities.reduce((sum, y, i) => sum + Math.max(0, y - bg[i]), 0);

        for (let i = 0; i < n; i++) {
            // 右侧积分（从 i 到末端）
            let rightIntegral = 0;
            for (let j = i; j < n; j++) {
                rightIntegral += Math.max(0, intensities[j] - bg[j]);
            }
            const fraction = totalIntegral > 0 ? rightIntegral / totalIntegral : 0;
            newBg[i] = yRight + (yLeft - yRight) * fraction;
        }
        bg = newBg;
    }

    return bg;
};

export const linearBackground = (data: XpsDataPoint[]): number[] => {
    const n = data.length;
    if (n < 2) return data.map(d => d.intensity);
    const yStart = data[0].intensity;
    const yEnd = data[n - 1].intensity;
    return data.map((_, i) => yStart + (yEnd - yStart) * (i / (n - 1)));
};

export const computeBackground = (data: XpsDataPoint[], type: BackgroundType): number[] => {
    if (type === 'shirley') return shirleyBackground(data);
    if (type === 'linear') return linearBackground(data);
    return new Array(data.length).fill(0);
};

// ==================== 峰函数 ====================

/** Voigt 近似峰函数 (Pseudo-Voigt) */
export const voigtPeak = (
    x: number, center: number, fwhm: number, height: number, mixRatio: number
): number => {
    const sigma = fwhm / (2 * Math.sqrt(2 * Math.LOG2E));
    const gamma = fwhm / 2;

    // 高斯分量
    const gauss = height * Math.exp(-4 * Math.LN2 * ((x - center) / fwhm) ** 2);
    // 洛伦兹分量
    const lorentz = height / (1 + 4 * ((x - center) / fwhm) ** 2);

    return (1 - mixRatio) * gauss + mixRatio * lorentz;
};

/** 计算峰的包络线 */
export const computeEnvelope = (
    data: XpsDataPoint[], peaks: XpsPeakParams[], background: number[]
): number[] => {
    return data.map((d, i) => {
        let sum = background[i];
        for (const peak of peaks) {
            sum += voigtPeak(d.be, peak.center, peak.fwhm, peak.height, peak.mixRatio);
        }
        return sum;
    });
};

// ==================== 自动峰检测 ====================

export const detectPeaks = (data: XpsDataPoint[], background: number[]): Array<{
    center: number; height: number;
}> => {
    if (data.length < 5) return [];

    // 背景扣除后的数据
    const subtracted = data.map((d, i) => d.intensity - background[i]);

    // 平滑
    const smoothed = subtracted.map((_, i) => {
        const win = 2;
        let sum = 0, count = 0;
        for (let j = Math.max(0, i - win); j <= Math.min(subtracted.length - 1, i + win); j++) {
            sum += subtracted[j];
            count++;
        }
        return sum / count;
    });

    // 二阶导数法
    const d2 = new Array(smoothed.length).fill(0);
    for (let i = 1; i < smoothed.length - 1; i++) {
        d2[i] = smoothed[i - 1] - 2 * smoothed[i] + smoothed[i + 1];
    }

    // 寻找二阶导数的局部最小值（凹拐点 → 峰位）
    const candidates: Array<{ idx: number; center: number; height: number; d2val: number }> = [];
    for (let i = 2; i < d2.length - 2; i++) {
        if (d2[i] < d2[i - 1] && d2[i] < d2[i + 1] && d2[i] < 0) {
            // 检查峰高是否显著
            const h = smoothed[i];
            const maxH = Math.max(...smoothed);
            if (h > maxH * 0.05) {
                candidates.push({ idx: i, center: data[i].be, height: h, d2val: d2[i] });
            }
        }
    }

    // 合并相邻峰（间距 < 1.5 eV）
    const merged: typeof candidates = [];
    for (const c of candidates.sort((a, b) => a.center - b.center)) {
        if (merged.length > 0 && Math.abs(c.center - merged[merged.length - 1].center) < 1.5) {
            if (c.height > merged[merged.length - 1].height) {
                merged[merged.length - 1] = c;
            }
        } else {
            merged.push(c);
        }
    }

    return merged.sort((a, b) => b.height - a.height)
        .slice(0, 6) // 最多6个峰
        .map(c => ({ center: c.center, height: c.height }));
};

// ==================== 峰拟合 ====================

export const fitPeaks = (
    data: XpsDataPoint[],
    background: number[],
    initialPeaks: Array<{ center: number; height: number }>,
    element: string
): XpsFitResult => {
    // 初始化峰参数
    const peaks: XpsPeakParams[] = initialPeaks.map((p, i) => ({
        id: `peak_${i}`,
        center: p.center,
        fwhm: 1.8,
        area: 0,
        height: p.height,
        mixRatio: 0.3, // 默认 30% 洛伦兹
        chemicalState: '',
        color: PEAK_COLORS[i % PEAK_COLORS.length],
    }));

    // 简化梯度下降拟合
    const subtracted = data.map((d, i) => d.intensity - background[i]);
    const lr = 0.001;
    const iterations = 200;

    for (let iter = 0; iter < iterations; iter++) {
        for (const peak of peaks) {
            // 计算残差方向梯度
            let gradCenter = 0, gradFwhm = 0, gradHeight = 0;
            for (let i = 0; i < data.length; i++) {
                const predicted = peaks.reduce((sum, pk) =>
                    sum + voigtPeak(data[i].be, pk.center, pk.fwhm, pk.height, pk.mixRatio), 0);
                const error = subtracted[i] - predicted;
                const x = data[i].be;

                // Approximate gradients
                const dx = (x - peak.center) / (peak.fwhm || 1);
                const peakVal = voigtPeak(x, peak.center, peak.fwhm, peak.height, peak.mixRatio);
                const ratio = peak.height > 0 ? peakVal / peak.height : 0;

                gradCenter += error * ratio * dx * 2;
                gradHeight += error * ratio / (peak.height || 1);
                gradFwhm += error * ratio * (dx * dx - 0.5) * 0.1;
            }

            peak.center += lr * gradCenter;
            peak.height = Math.max(10, peak.height + lr * peak.height * gradHeight);
            peak.fwhm = Math.max(0.5, Math.min(5.0, peak.fwhm + lr * gradFwhm));
        }
    }

    // 计算面积
    for (const peak of peaks) {
        // Voigt 面积近似：height * fwhm * sqrt(π / (4 * ln2)) * (1 + mixRatio * (sqrt(π*ln2) - 1))
        const gaussArea = peak.height * peak.fwhm * Math.sqrt(Math.PI / (4 * Math.LN2));
        const lorentzArea = peak.height * peak.fwhm * Math.PI / 2;
        peak.area = Number(((1 - peak.mixRatio) * gaussArea + peak.mixRatio * lorentzArea).toFixed(1));
    }

    // 化学态匹配
    const refs = XPS_STANDARD_LIBRARY[element] || [];
    for (const peak of peaks) {
        const match = refs.find(r => Math.abs(peak.center - r.be) <= r.tolerance);
        peak.chemicalState = match ? match.state : `Unknown (${peak.center.toFixed(1)} eV)`;
    }

    // 计算包络线和残差
    const envelope = computeEnvelope(data, peaks, background);
    const residual = data.map((d, i) => d.intensity - envelope[i]);

    // R² 计算
    const meanI = data.reduce((s, d) => s + d.intensity, 0) / data.length;
    const ssTot = data.reduce((s, d) => s + (d.intensity - meanI) ** 2, 0);
    const ssRes = residual.reduce((s, r) => s + r ** 2, 0);
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const chiSquared = data.length > 0 ? ssRes / data.length : 0;

    return {
        peaks: peaks.map(p => ({ ...p, center: Number(p.center.toFixed(2)), fwhm: Number(p.fwhm.toFixed(2)), height: Number(p.height.toFixed(0)) })),
        background,
        envelope,
        residual,
        rSquared: Number(rSquared.toFixed(4)),
        chiSquared: Number(chiSquared.toFixed(1)),
    };
};

// ==================== 化学态匹配 ====================

export const matchChemicalState = (be: number, element: string): string => {
    const refs = XPS_STANDARD_LIBRARY[element] || [];
    const match = refs.find(r => Math.abs(be - r.be) <= r.tolerance);
    return match ? match.state : `Unknown (${be.toFixed(1)} eV)`;
};

// ==================== 元素定量 ====================

export const calculateAtomicPercent = (
    elements: Array<{ element: string; totalArea: number }>
): XpsQuantResult[] => {
    const normalized = elements.map(el => ({
        ...el,
        correctedArea: el.totalArea / (SENSITIVITY_FACTORS[el.element] || 1),
    }));

    const totalCorrected = normalized.reduce((s, el) => s + el.correctedArea, 0);

    return normalized.map(el => ({
        element: el.element.split(' ')[0],
        orbital: el.element,
        peakArea: Number(el.totalArea.toFixed(1)),
        sensitivityFactor: SENSITIVITY_FACTORS[el.element] || 1,
        atomicPercent: totalCorrected > 0
            ? Number((el.correctedArea / totalCorrected * 100).toFixed(1))
            : 0,
        peaks: [], // 由调用方填充
    }));
};

// ==================== DEMO 数据生成 ====================

const generatePeakData = (
    beCenter: number, fwhm: number, height: number,
    beRange: [number, number], step: number = 0.2
): XpsDataPoint[] => {
    const data: XpsDataPoint[] = [];
    for (let be = beRange[0]; be <= beRange[1]; be += step) {
        const intensity = voigtPeak(be, beCenter, fwhm, height, 0.3);
        data.push({ be: Number(be.toFixed(1)), intensity: Number(intensity.toFixed(0)) });
    }
    return data;
};

export const ELEMENT_DEMO_CONFIGS: Record<string, {
    beRange: [number, number];
    peaks: Array<{ center: number; fwhm: number; height: number }>;
    baseline: number;
}> = {
    'Co 2p': {
        beRange: [770, 800],
        peaks: [
            { center: 780.4, fwhm: 2.0, height: 25000 },
            { center: 782.1, fwhm: 1.8, height: 12000 },
            { center: 786.5, fwhm: 3.0, height: 7000 },
            { center: 796.2, fwhm: 2.2, height: 13000 },
        ],
        baseline: 2000,
    },
    'Ni 2p': {
        beRange: [848, 882],
        peaks: [
            { center: 854.0, fwhm: 1.9, height: 8000 },
            { center: 855.8, fwhm: 2.1, height: 14000 },
            { center: 861.0, fwhm: 3.5, height: 5500 },
            { center: 872.5, fwhm: 2.0, height: 7000 },
            { center: 879.0, fwhm: 3.0, height: 3500 },
        ],
        baseline: 2200,
    },
    'Fe 2p': {
        beRange: [700, 735],
        peaks: [
            { center: 709.5, fwhm: 2.0, height: 9000 },
            { center: 711.2, fwhm: 2.2, height: 18000 },
            { center: 719.5, fwhm: 3.5, height: 6000 },
            { center: 724.0, fwhm: 2.3, height: 10000 },
        ],
        baseline: 1800,
    },
    'O 1s': {
        beRange: [526, 538],
        peaks: [
            { center: 529.8, fwhm: 1.4, height: 22000 },
            { center: 531.3, fwhm: 1.8, height: 15000 },
            { center: 532.5, fwhm: 2.0, height: 8000 },
        ],
        baseline: 1500,
    },
    'N 1s': {
        beRange: [395, 408],
        peaks: [
            { center: 398.5, fwhm: 1.4, height: 6000 },
            { center: 399.2, fwhm: 1.3, height: 7500 },
            { center: 400.0, fwhm: 1.5, height: 9000 },
            { center: 401.2, fwhm: 1.4, height: 4500 },
            { center: 402.5, fwhm: 1.6, height: 2000 },
        ],
        baseline: 1200,
    },
    'Pt 4f': {
        beRange: [68, 82],
        peaks: [
            { center: 71.2, fwhm: 1.3, height: 30000 },
            { center: 72.4, fwhm: 1.5, height: 8000 },
            { center: 74.5, fwhm: 1.3, height: 20000 },
        ],
        baseline: 2500,
    },
};

export const generateXpsMockData = (element: string): XpsDataPoint[] => {
    const config = ELEMENT_DEMO_CONFIGS[element];
    if (!config) {
        // Fallback generic
        return generatePeakData(530, 2.0, 15000, [525, 540]);
    }

    const data: XpsDataPoint[] = [];
    const step = 0.2;
    for (let be = config.beRange[0]; be <= config.beRange[1]; be += step) {
        let intensity = config.baseline;
        for (const peak of config.peaks) {
            intensity += voigtPeak(be, peak.center, peak.fwhm, peak.height, 0.3);
        }
        // 加噪声
        intensity += (Math.random() - 0.5) * config.baseline * 0.15;
        data.push({ be: Number(be.toFixed(1)), intensity: Math.max(0, Math.round(intensity)) });
    }

    // XPS 惯例：按 BE 降序
    data.sort((a, b) => b.be - a.be);
    return data;
};

/** 生成原始文本格式的 DEMO 数据 */
export const generateXpsMockRawText = (element: string): string => {
    const data = generateXpsMockData(element);
    return `# ${element} XPS High-Resolution Spectrum\n# BE (eV)\tIntensity (cps)\n` +
        data.map(d => `${d.be}\t${d.intensity}`).join('\n');
};

// ==================== 综合分析入口 ====================

export const runXpsAnalysis = (
    data: XpsDataPoint[],
    element: string,
    bgType: BackgroundType,
    numPeaks?: number
): XpsFitResult | null => {
    if (data.length < 5) return null;

    const background = computeBackground(data, bgType);
    let detected = detectPeaks(data, background);

    // 如果指定了峰数目，截取
    if (numPeaks !== undefined && numPeaks > 0) {
        detected = detected.slice(0, numPeaks);
    }

    if (detected.length === 0) {
        // 至少找到一个最高点
        const maxIdx = data.reduce((mi, d, i) => d.intensity > data[mi].intensity ? i : mi, 0);
        detected = [{ center: data[maxIdx].be, height: data[maxIdx].intensity - background[maxIdx] }];
    }

    return fitPeaks(data, background, detected, element);
};

// ==================== 催化剂专属分析 ====================

/** 过渡金属价态比例定量（如 Co²⁺/Co³⁺） */
export interface ValenceRatioResult {
    element: string;
    valences: Array<{
        state: string;       // e.g. "Co²⁺", "Co³⁺"
        be: number;
        area: number;
        percent: number;     // 面积百分比
        color: string;
    }>;
    mainValence: string;     // 主导价态
    ratio: string;           // e.g. "Co²⁺/Co³⁺ = 1.32"
    catalyticNote: string;   // 催化活性关联
}

const VALENCE_PATTERNS: Record<string, Array<{ pattern: RegExp; valence: string; color: string }>> = {
    'Co 2p': [
        { pattern: /Co⁰|Co.*金属/i, valence: 'Co⁰', color: '#94a3b8' },
        { pattern: /Co²⁺|CoO/i, valence: 'Co²⁺', color: '#6366f1' },
        { pattern: /Co³⁺|Co₂O₃/i, valence: 'Co³⁺', color: '#f43f5e' },
        { pattern: /Co₃O₄|Co²⁺.*³⁺/i, valence: 'Co²⁺/³⁺', color: '#8b5cf6' },
    ],
    'Ni 2p': [
        { pattern: /Ni⁰|Ni.*金属/i, valence: 'Ni⁰', color: '#94a3b8' },
        { pattern: /Ni²⁺|NiO/i, valence: 'Ni²⁺', color: '#10b981' },
        { pattern: /Ni³⁺|Ni₂O₃|NiOOH/i, valence: 'Ni³⁺', color: '#f59e0b' },
    ],
    'Fe 2p': [
        { pattern: /Fe⁰|Fe.*金属/i, valence: 'Fe⁰', color: '#94a3b8' },
        { pattern: /Fe²⁺|FeO/i, valence: 'Fe²⁺', color: '#06b6d4' },
        { pattern: /Fe³⁺|Fe₂O₃|FeOOH/i, valence: 'Fe³⁺', color: '#ec4899' },
    ],
};

export const analyzeValenceRatio = (fitResult: XpsFitResult, element: string): ValenceRatioResult | null => {
    const patterns = VALENCE_PATTERNS[element];
    if (!patterns || fitResult.peaks.length === 0) return null;

    // 过滤掉 Satellite 峰
    const validPeaks = fitResult.peaks.filter(p => !p.chemicalState.includes('Satellite'));
    if (validPeaks.length === 0) return null;

    const totalArea = validPeaks.reduce((sum, p) => sum + p.area, 0);

    const valences = validPeaks.map(peak => {
        const match = patterns.find(pat => pat.pattern.test(peak.chemicalState));
        return {
            state: match?.valence || peak.chemicalState,
            be: peak.center,
            area: peak.area,
            percent: totalArea > 0 ? Number((peak.area / totalArea * 100).toFixed(1)) : 0,
            color: match?.color || '#94a3b8',
        };
    });

    // 聚合相同价态
    const merged: typeof valences = [];
    for (const v of valences) {
        const existing = merged.find(m => m.state === v.state);
        if (existing) { existing.area += v.area; existing.percent += v.percent; }
        else merged.push({ ...v });
    }

    const sorted = merged.sort((a, b) => b.percent - a.percent);
    const mainValence = sorted[0]?.state || '';

    // 生成比值字符串
    let ratio = '';
    if (sorted.length >= 2) {
        ratio = `${sorted[0].state}/${sorted[1].state} = ${(sorted[0].area / sorted[1].area).toFixed(2)}`;
    }

    // 催化活性关联
    const metalBase = element.split(' ')[0];
    let catalyticNote = '';
    if (metalBase === 'Co') {
        const co3Pct = sorted.find(v => v.state.includes('Co³'))?.percent || 0;
        catalyticNote = co3Pct > 40
            ? `高 Co³⁺ 含量 (${co3Pct}%) 有利于 OER，eg 轨道占据优化 O 中间体吸附。`
            : `Co²⁺ 为主，有利于 ORR 四电子路径，建议调控提高 Co³⁺ 比例以增强 OER。`;
    } else if (metalBase === 'Ni') {
        const ni3Pct = sorted.find(v => v.state.includes('Ni³'))?.percent || 0;
        catalyticNote = ni3Pct > 30
            ? `Ni³⁺ 丰富 (${ni3Pct}%)，NiOOH 原位形成能力强，有利于 OER 催化。`
            : `Ni²⁺ 主导，建议通过电化学活化提高 Ni³⁺/NiOOH 含量。`;
    } else if (metalBase === 'Fe') {
        const fe3Pct = sorted.find(v => v.state.includes('Fe³'))?.percent || 0;
        catalyticNote = fe3Pct > 50
            ? `Fe³⁺ 主导 (${fe3Pct}%)，Fe-Nx 位点可提供优异 ORR 活性。`
            : `Fe²⁺/Fe³⁺ 混合价态，自旋交叉效应可调控 d 带中心。`;
    }

    return { element, valences: sorted, mainValence, ratio, catalyticNote };
};

/** N 1s 氮物种分类（M-N-C 催化剂） */
export interface NitrogenSpeciesResult {
    species: Array<{
        type: string;        // 吡啶N / M-Nx / 吡咯N / 石墨N / 氧化N
        be: number;
        area: number;
        percent: number;
        color: string;
        catalyticRole: string; // 催化作用
    }>;
    totalMNx: number;        // M-Nx 百分比
    activeNPercent: number;   // 催化活性氮比例 (吡啶+M-Nx)
    conclusion: string;
}

const N_SPECIES_CONFIG = [
    { pattern: /吡啶/i, type: '吡啶-N', color: '#6366f1', role: 'ORR 活性位：提供孤对电子，促进 O₂ 吸附和四电子还原' },
    { pattern: /M-N|配位/i, type: 'M-Nₓ', color: '#f43f5e', role: '核心活性中心：金属-氮配位为 ORR/OER 双功能催化核心' },
    { pattern: /吡咯/i, type: '吡咯-N', color: '#10b981', role: '辅助位点：提供缺陷位，可间接促进催化反应' },
    { pattern: /石墨/i, type: '石墨-N', color: '#f59e0b', role: '导电增强：提高碳骨架导电性，降低电荷转移电阻' },
    { pattern: /氧化/i, type: '氧化-N', color: '#94a3b8', role: '非活性：通常为副产物，对催化无显著贡献' },
];

export const classifyNitrogenSpecies = (fitResult: XpsFitResult): NitrogenSpeciesResult | null => {
    if (fitResult.peaks.length === 0) return null;
    const totalArea = fitResult.peaks.reduce((sum, p) => sum + p.area, 0);

    const species = fitResult.peaks.map(peak => {
        const match = N_SPECIES_CONFIG.find(cfg => cfg.pattern.test(peak.chemicalState));
        return {
            type: match?.type || peak.chemicalState,
            be: peak.center,
            area: peak.area,
            percent: totalArea > 0 ? Number((peak.area / totalArea * 100).toFixed(1)) : 0,
            color: match?.color || '#94a3b8',
            catalyticRole: match?.role || '未知催化作用',
        };
    }).sort((a, b) => b.percent - a.percent);

    const totalMNx = species.filter(s => s.type === 'M-Nₓ').reduce((sum, s) => sum + s.percent, 0);
    const pyridicPct = species.filter(s => s.type === '吡啶-N').reduce((sum, s) => sum + s.percent, 0);
    const activeNPercent = Number((totalMNx + pyridicPct).toFixed(1));

    let conclusion = '';
    if (totalMNx > 20) {
        conclusion = `M-Nₓ 含量优异 (${totalMNx}%)，表明金属-氮配位位点丰富，是驱动 ORR/OER 双功能催化的核心活性中心。`;
    } else if (activeNPercent > 40) {
        conclusion = `催化活性氮比例较高 (${activeNPercent}%)，吡啶-N 和 M-Nₓ 协同提供 O₂ 吸附和还原活性位。`;
    } else {
        conclusion = `活性氮比例偏低 (${activeNPercent}%)，建议通过配位化学调控增加 M-Nₓ 位点密度。`;
    }

    return { species, totalMNx, activeNPercent, conclusion };
};

/** O 1s 氧物种分类 */
export interface OxygenSpeciesResult {
    species: Array<{
        type: string;
        be: number;
        area: number;
        percent: number;
        color: string;
        significance: string;
    }>;
    oxygenVacancyRatio: number; // 氧空位比例（近似：M-OH / 晶格O 比）
    latticeOxygenPercent: number;
    conclusion: string;
}

const O_SPECIES_CONFIG = [
    { pattern: /晶格|M-O|lattice/i, type: '晶格氧 (O²⁻)', color: '#6366f1', sig: '金属-氧键：主体结构骨架，含量反映氧化物结晶度' },
    { pattern: /羟基|M-OH|hydroxyl/i, type: '表面 -OH', color: '#f43f5e', sig: '活性位标志：与氧空位密切相关，OER 中间体 *OH 的前驱体' },
    { pattern: /吸附水|碳酸|adsorb/i, type: '吸附水/CO₃²⁻', color: '#10b981', sig: '表面吸附物种：可作为 OER 反应的质子源' },
    { pattern: /C-O|有机/i, type: '有机 C-O', color: '#94a3b8', sig: '碳载体官能团：与催化活性无直接关联' },
];

export const classifyOxygenSpecies = (fitResult: XpsFitResult): OxygenSpeciesResult | null => {
    if (fitResult.peaks.length === 0) return null;
    const totalArea = fitResult.peaks.reduce((sum, p) => sum + p.area, 0);

    const species = fitResult.peaks.map(peak => {
        const match = O_SPECIES_CONFIG.find(cfg => cfg.pattern.test(peak.chemicalState));
        return {
            type: match?.type || peak.chemicalState,
            be: peak.center,
            area: peak.area,
            percent: totalArea > 0 ? Number((peak.area / totalArea * 100).toFixed(1)) : 0,
            color: match?.color || '#94a3b8',
            significance: match?.sig || '',
        };
    }).sort((a, b) => b.percent - a.percent);

    const latticeO = species.find(s => s.type.includes('晶格'))?.percent || 0;
    const surfaceOH = species.find(s => s.type.includes('-OH'))?.percent || 0;
    const oxygenVacancyRatio = latticeO > 0 ? Number((surfaceOH / latticeO).toFixed(2)) : 0;

    let conclusion = '';
    if (oxygenVacancyRatio > 0.6) {
        conclusion = `表面 -OH 占比高 (${surfaceOH}%)，OH/O²⁻ = ${oxygenVacancyRatio}，表明氧空位丰富，可提供额外的 OER 活性位点和加速 O-O 成键。`;
    } else if (latticeO > 50) {
        conclusion = `晶格氧主导 (${latticeO}%)，结晶度高，结构稳定性好但氧空位较少。建议通过还原处理引入氧空位以提升 OER 活性。`;
    } else {
        conclusion = `氧物种分布均衡，晶格氧 ${latticeO}%，表面羟基 ${surfaceOH}%。`;
    }

    return { species, oxygenVacancyRatio, latticeOxygenPercent: latticeO, conclusion };
};

/** 电化学前后 XPS 对比 */
export interface BeforeAfterComparison {
    element: string;
    beforeTitle: string;
    afterTitle: string;
    peakComparisons: Array<{
        chemicalState: string;
        beforeBE: number;
        afterBE: number;
        beShift: number;      // eV
        beforePercent: number;
        afterPercent: number;
        percentChange: number; // 百分点变化
    }>;
    overallShift: number;     // 平均 BE 偏移
    stabilityScore: number;   // 0-100 稳定性评分
    conclusion: string;
}

export const compareBeforeAfter = (
    beforeRecord: XpsRecord,
    afterRecord: XpsRecord
): BeforeAfterComparison | null => {
    if (!beforeRecord.data.fitResult || !afterRecord.data.fitResult) return null;
    if (beforeRecord.data.element !== afterRecord.data.element) return null;

    const beforePeaks = beforeRecord.data.fitResult.peaks.filter(p => !p.chemicalState.includes('Satellite'));
    const afterPeaks = afterRecord.data.fitResult.peaks.filter(p => !p.chemicalState.includes('Satellite'));
    if (beforePeaks.length === 0 || afterPeaks.length === 0) return null;

    const beforeTotal = beforePeaks.reduce((s, p) => s + p.area, 0);
    const afterTotal = afterPeaks.reduce((s, p) => s + p.area, 0);

    const peakComparisons = beforePeaks.map(bp => {
        // 找最近的匹配
        const ap = afterPeaks.reduce((best, p) =>
            Math.abs(p.center - bp.center) < Math.abs(best.center - bp.center) ? p : best, afterPeaks[0]);
        const beforePct = beforeTotal > 0 ? bp.area / beforeTotal * 100 : 0;
        const afterPct = afterTotal > 0 ? ap.area / afterTotal * 100 : 0;
        return {
            chemicalState: bp.chemicalState,
            beforeBE: bp.center,
            afterBE: ap.center,
            beShift: Number((ap.center - bp.center).toFixed(2)),
            beforePercent: Number(beforePct.toFixed(1)),
            afterPercent: Number(afterPct.toFixed(1)),
            percentChange: Number((afterPct - beforePct).toFixed(1)),
        };
    });

    const overallShift = peakComparisons.length > 0
        ? Number((peakComparisons.reduce((s, c) => s + Math.abs(c.beShift), 0) / peakComparisons.length).toFixed(2))
        : 0;

    // 稳定性评分：BE 偏移越小、面积比例变化越小越稳定
    const maxPercentChange = Math.max(...peakComparisons.map(c => Math.abs(c.percentChange)), 0.1);
    const stabilityScore = Math.max(0, Math.min(100,
        Math.round(100 - overallShift * 30 - maxPercentChange * 1.5)));

    let conclusion = '';
    if (stabilityScore > 80) {
        conclusion = `电化学循环后 XPS 几乎无变化（稳定性评分 ${stabilityScore}/100），价态分布保持稳定，表明催化剂具有优异的结构稳定性。`;
    } else if (stabilityScore > 50) {
        conclusion = `检测到一定程度的表面重构（稳定性 ${stabilityScore}/100），平均 BE 偏移 ${overallShift} eV。`;
        const shifted = peakComparisons.filter(c => Math.abs(c.percentChange) > 5);
        if (shifted.length > 0) {
            conclusion += ` ${shifted.map(c => `${c.chemicalState}: ${c.percentChange > 0 ? '+' : ''}${c.percentChange}%`).join(', ')}。`;
        }
    } else {
        conclusion = `表面结构发生显著变化（稳定性 ${stabilityScore}/100），建议检查金属溶解和碳腐蚀风险。`;
    }

    return {
        element: beforeRecord.data.element,
        beforeTitle: beforeRecord.title,
        afterTitle: afterRecord.title,
        peakComparisons,
        overallShift,
        stabilityScore,
        conclusion,
    };
};
