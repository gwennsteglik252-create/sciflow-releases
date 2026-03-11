export interface DataPoint {
    x: number;
    y: number;
    z?: number; // 新增：支持第三列数据提取
}

export interface XrdPeak {
    id: number;
    twoTheta: number; // degrees
    intensity: number;
    fwhm: number; // degrees
    dSpacing: number; // nm
    grainSize: number; // nm
    label?: string; // hkl index or other label
}

export type PeakDetectMode = 'balanced' | 'recall' | 'precision';

export interface PeakDetectConfig {
    mode?: PeakDetectMode;
    maxPeaks?: number | 'auto';
    minPeakDistanceDeg?: number;
    minProminencePercent?: number;
    minWidthDeg?: number;
    smoothingPasses?: number;
}

export interface PeakDetectStats {
    candidateCount: number;
    mergedCount: number;
    finalCount: number;
}

export interface PeakDetectResult {
    peaks: XrdPeak[];
    stats: PeakDetectStats;
}

// Standard wavelengths (nm)
export const XRD_SOURCES = {
    'Cu Ka': 0.15406,
    'Co Ka': 0.17890,
    'Mo Ka': 0.07107
};

export const PDF_CARDS = [
    { name: 'ZnO (Zinc Oxide)', card: 'PDF#36-1451', peaks: [{ twoTheta: 31.77, intensity: 57 }, { twoTheta: 34.42, intensity: 41 }, { twoTheta: 36.25, intensity: 100 }, { twoTheta: 47.54, intensity: 21 }, { twoTheta: 56.60, intensity: 28 }, { twoTheta: 62.86, intensity: 24 }, { twoTheta: 67.96, intensity: 21 }] },
    { name: 'Ag (Silver)', card: 'PDF#04-0783', peaks: [{ twoTheta: 38.12, intensity: 100 }, { twoTheta: 44.28, intensity: 40 }, { twoTheta: 64.43, intensity: 25 }, { twoTheta: 77.47, intensity: 25 }] },
    { name: 'Au (Gold)', card: 'PDF#04-0784', peaks: [{ twoTheta: 38.19, intensity: 100 }, { twoTheta: 44.39, intensity: 52 }, { twoTheta: 64.58, intensity: 32 }] }
];

export const parseXrdData = (text: string): DataPoint[] => {
    const lines = text.split('\n');
    const data: DataPoint[] = [];

    /**
     * 增强型正则：
     * 捕获 1: X
     * 捕获 2: Y
     * 捕获 3: 可选的 Error/Z
     */
    const rowRegex = /^\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)[,\t\s]+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)(?:[,\t\s]+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?))?\s*$/;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // 跳过元数据行
        if (/^[a-zA-Z#]/.test(trimmed)) continue;

        const match = trimmed.match(rowRegex);
        if (match) {
            data.push({
                x: parseFloat(match[1]),
                y: parseFloat(match[2]),
                z: match[3] ? parseFloat(match[3]) : undefined
            });
        } else {
            const parts = trimmed.split(/[,\t\s]+/).filter(p => p);
            if (parts.length >= 2) {
                const x = parseFloat(parts[0]);
                const y = parseFloat(parts[1]);
                const z = parts[2] ? parseFloat(parts[2]) : undefined;
                if (!isNaN(x) && !isNaN(y)) {
                    data.push({ x, y, z });
                }
            }
        }
    }
    return data;
};

type InternalCandidate = {
    idx: number;
    twoTheta: number;
    intensity: number;
    prominence: number;
    snr: number;
    width: number;
    score: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const median = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const quantile = (values: number[], q: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = clamp(q, 0, 1) * (sorted.length - 1);
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
};

const movingMinimum = (arr: number[], halfWindow: number): number[] => {
    const out = new Array<number>(arr.length);
    for (let i = 0; i < arr.length; i++) {
        let minVal = arr[i];
        const start = Math.max(0, i - halfWindow);
        const end = Math.min(arr.length - 1, i + halfWindow);
        for (let j = start; j <= end; j++) minVal = Math.min(minVal, arr[j]);
        out[i] = minVal;
    }
    return out;
};

const resolveDefaults = (mode: PeakDetectMode) => {
    if (mode === 'recall') {
        return { minPeakDistanceDeg: 0.16, minProminencePercent: 3.2, minWidthDeg: 0.07, smoothingPasses: 1 };
    }
    if (mode === 'precision') {
        return { minPeakDistanceDeg: 0.30, minProminencePercent: 6.0, minWidthDeg: 0.13, smoothingPasses: 3 };
    }
    return { minPeakDistanceDeg: 0.22, minProminencePercent: 4.5, minWidthDeg: 0.10, smoothingPasses: 2 };
};

const estimateFwhm = (x: number[], y: number[], baseline: number[], centerIdx: number, minWidthDeg: number): number => {
    const peakTop = y[centerIdx];
    const localBase = baseline[centerIdx];
    const halfLevel = localBase + Math.max(0, peakTop - localBase) / 2;
    if (!Number.isFinite(halfLevel) || halfLevel <= localBase) return minWidthDeg;

    let left = centerIdx;
    while (left > 0 && y[left] >= halfLevel) left--;
    let right = centerIdx;
    while (right < y.length - 1 && y[right] >= halfLevel) right++;

    if (left <= 0 || right >= y.length - 1 || right <= left) return minWidthDeg;
    const xLeft = interpolateX({ x: x[left], y: y[left] }, { x: x[left + 1], y: y[left + 1] }, halfLevel);
    const xRight = interpolateX({ x: x[right - 1], y: y[right - 1] }, { x: x[right], y: y[right] }, halfLevel);
    const width = xRight - xLeft;
    return Number.isFinite(width) && width > 0 ? Math.max(width, minWidthDeg) : minWidthDeg;
};

const normalizeBy = (value: number, reference: number) => (reference > 0 ? value / reference : 0);

const dynamicMergeDistance = (a: InternalCandidate, b: InternalCandidate, minPeakDistanceDeg: number) => {
    const adaptive = 0.55 * Math.max(a.width, b.width);
    return Math.max(minPeakDistanceDeg, adaptive);
};

export const detectPeaksDetailed = (data: DataPoint[], config: PeakDetectConfig = {}): PeakDetectResult => {
    if (data.length < 11) return { peaks: [], stats: { candidateCount: 0, mergedCount: 0, finalCount: 0 } };

    const mode = config.mode || 'balanced';
    const defaults = resolveDefaults(mode);
    const smoothingPasses = clamp(config.smoothingPasses ?? defaults.smoothingPasses, 1, 5);
    const minPeakDistanceDeg = Math.max(0.05, config.minPeakDistanceDeg ?? defaults.minPeakDistanceDeg);
    const minProminencePercent = Math.max(0.2, config.minProminencePercent ?? defaults.minProminencePercent);
    const minWidthDeg = Math.max(0.02, config.minWidthDeg ?? defaults.minWidthDeg);

    const sorted = [...data].sort((a, b) => a.x - b.x);
    const x = sorted.map(d => d.x);
    let smoothPoints = sorted.map(d => ({ x: d.x, y: d.y }));
    for (let i = 0; i < smoothingPasses; i++) smoothPoints = applySGSmoothing(smoothPoints);
    const ySmooth = smoothPoints.map(d => d.y);
    const step = Math.max(1e-6, median(x.slice(1).map((v, i) => v - x[i]).filter(v => v > 0)));

    const baselineHalfWin = Math.max(3, Math.round((1.2 / step) / 2));
    const baseline = movingMinimum(ySmooth, baselineHalfWin);
    const residual = ySmooth.map((y, i) => Math.max(0, y - baseline[i]));
    const residualMax = Math.max(...residual, 1e-9);
    const noiseFloor = Math.max(1e-9, quantile(residual, 0.25));
    const prominenceAbs = residualMax * (minProminencePercent / 100);

    const distancePts = Math.max(2, Math.round(minPeakDistanceDeg / step));
    const candidateScanHalfWin = Math.max(1, Math.round(distancePts * 0.35));
    const valleySpan = Math.max(3, Math.round(distancePts * 1.2));

    const candidates: InternalCandidate[] = [];
    for (let i = candidateScanHalfWin; i < residual.length - candidateScanHalfWin; i++) {
        const local = residual.slice(i - candidateScanHalfWin, i + candidateScanHalfWin + 1);
        const localMax = Math.max(...local);
        if (residual[i] < localMax - 1e-9) continue;
        if (residual[i] < prominenceAbs) continue;

        const leftStart = Math.max(0, i - valleySpan);
        const rightEnd = Math.min(residual.length - 1, i + valleySpan);
        const leftMin = Math.min(...residual.slice(leftStart, i + 1));
        const rightMin = Math.min(...residual.slice(i, rightEnd + 1));
        const prominence = residual[i] - Math.max(leftMin, rightMin);
        if (prominence < prominenceAbs) continue;

        const width = estimateFwhm(x, ySmooth, baseline, i, minWidthDeg);
        if (width < minWidthDeg) continue;

        const snr = prominence / noiseFloor;
        const score =
            0.50 * normalizeBy(prominence, residualMax) +
            0.25 * normalizeBy(width, minWidthDeg * 3) +
            0.25 * normalizeBy(snr, 8);

        candidates.push({
            idx: i,
            twoTheta: x[i],
            intensity: ySmooth[i],
            prominence,
            snr,
            width,
            score
        });
    }

    const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
    const merged: InternalCandidate[] = [];
    for (const c of sortedByScore) {
        const nearIdx = merged.findIndex(k => Math.abs(k.twoTheta - c.twoTheta) < dynamicMergeDistance(k, c, minPeakDistanceDeg));
        if (nearIdx === -1) merged.push(c);
        else if (c.score > merged[nearIdx].score) merged[nearIdx] = c;
    }

    const maxPeaks = config.maxPeaks === 'auto' || config.maxPeaks === undefined
        ? clamp(Math.round(6 + Math.min(6, merged.length * 0.35)), 6, 12)
        : clamp(config.maxPeaks, 1, 20);

    const topScore = merged.length > 0 ? Math.max(...merged.map(c => c.score)) : 0;
    const qualityFloor = topScore * 0.18;
    const selected = merged
        .filter(c => c.score >= qualityFloor)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(maxPeaks, merged.length))
        .sort((a, b) => a.twoTheta - b.twoTheta);

    const peaks: XrdPeak[] = selected.map((c, i) => ({
        id: i + 1,
        twoTheta: c.twoTheta,
        intensity: c.intensity,
        fwhm: c.width,
        dSpacing: 0,
        grainSize: 0
    }));

    return {
        peaks,
        stats: {
            candidateCount: candidates.length,
            mergedCount: merged.length,
            finalCount: peaks.length
        }
    };
};

export const detectPeaks = (data: DataPoint[], thresholdOrConfig: number | PeakDetectConfig = 10): XrdPeak[] => {
    if (typeof thresholdOrConfig === 'number') {
        // 旧接口兼容：阈值百分比映射为最小 prominence，峰数保持旧行为（5）
        return detectPeaksDetailed(data, {
            mode: 'balanced',
            maxPeaks: 5,
            minProminencePercent: thresholdOrConfig,
            smoothingPasses: 1
        }).peaks;
    }
    return detectPeaksDetailed(data, thresholdOrConfig).peaks;
};

// ═══════════════════════════════════════════
//  自动参数调优 (Auto-Tune Peak Parameters)
// ═══════════════════════════════════════════

export interface AutoTuneResult {
    config: PeakDetectConfig;
    diagnosis: {
        noiseLevel: 'low' | 'medium' | 'high';
        snr: number;
        estimatedPeakCount: number;
        avgPeakDistance: number;
        medianFwhm: number;
        recommendedMode: PeakDetectMode;
    };
    summary: string;
}

/**
 * 根据数据特征自动推荐最优寻峰参数
 *
 * 算法流程：
 * 1. 噪声评估：SG 平滑残差的标准差
 * 2. 信噪比计算：(max - median) / noiseσ
 * 3. 快速峰检测：用宽松参数估计峰数和平均间距
 * 4. FWHM 中位数估计
 * 5. 综合出参数建议
 */
export const autoTunePeakParams = (data: DataPoint[]): AutoTuneResult => {
    if (data.length < 20) {
        return {
            config: { mode: 'balanced' },
            diagnosis: { noiseLevel: 'medium', snr: 0, estimatedPeakCount: 0, avgPeakDistance: 0, medianFwhm: 0.15, recommendedMode: 'balanced' },
            summary: '数据点太少，使用默认平衡模式'
        };
    }

    const sorted = [...data].sort((a, b) => a.x - b.x);
    const yValues = sorted.map(d => d.y);

    // ── Step 1: 噪声评估 ──
    const smoothed = applySGSmoothing(sorted);
    const residuals = sorted.map((d, i) => d.y - smoothed[i].y);
    const residualMean = residuals.reduce((s, v) => s + v, 0) / residuals.length;
    const noiseSigma = Math.sqrt(residuals.reduce((s, v) => s + (v - residualMean) ** 2, 0) / residuals.length);

    // ── Step 2: 信噪比 ──
    const maxY = Math.max(...yValues);
    const medianY = median(yValues);
    const snr = noiseSigma > 1e-9 ? (maxY - medianY) / noiseSigma : 100;

    // 噪声等级判定
    const noiseLevel: 'low' | 'medium' | 'high' = snr > 15 ? 'low' : snr > 5 ? 'medium' : 'high';

    // ── Step 3: 快速峰检测（宽松参数） ──
    const quickResult = detectPeaksDetailed(removeBackground(applySGSmoothing(sorted)), {
        mode: 'recall',
        maxPeaks: 20,
        minProminencePercent: 2.0,
        minPeakDistanceDeg: 0.10,
        minWidthDeg: 0.05,
        smoothingPasses: 1
    });
    const quickPeaks = quickResult.peaks;
    const estimatedPeakCount = quickPeaks.length;

    // ── Step 4: 峰间距和 FWHM 估计 ──
    let avgPeakDistance = 5.0; // 默认
    if (quickPeaks.length >= 2) {
        const distances: number[] = [];
        for (let i = 1; i < quickPeaks.length; i++) {
            distances.push(quickPeaks[i].twoTheta - quickPeaks[i - 1].twoTheta);
        }
        avgPeakDistance = median(distances);
    }

    const fwhmValues = quickPeaks.filter(p => p.fwhm > 0).map(p => p.fwhm);
    const medianFwhm = fwhmValues.length > 0 ? median(fwhmValues) : 0.15;

    // ── Step 5: 综合推荐参数 ──
    let recommendedMode: PeakDetectMode;
    let smoothingPasses: number;
    let minProminencePercent: number;
    let minPeakDistanceDeg: number;
    let minWidthDeg: number;

    // 模式选择
    if (snr < 5) {
        recommendedMode = 'precision';
    } else if (snr > 15) {
        recommendedMode = 'recall';
    } else {
        recommendedMode = 'balanced';
    }

    // 平滑次数：噪声越大越多
    if (noiseLevel === 'high') {
        smoothingPasses = clamp(Math.round(3 + (5 - snr) * 0.3), 3, 5);
    } else if (noiseLevel === 'low') {
        smoothingPasses = 1;
    } else {
        smoothingPasses = 2;
    }

    // 最小突出度：根据噪声 / 信号比例
    const noiseRatio = noiseSigma / (maxY || 1);
    if (noiseLevel === 'high') {
        minProminencePercent = clamp(noiseRatio * 200, 5.0, 12.0);
    } else if (noiseLevel === 'low') {
        minProminencePercent = clamp(noiseRatio * 100, 2.0, 5.0);
    } else {
        minProminencePercent = clamp(noiseRatio * 150, 3.0, 8.0);
    }

    // 最小峰间距：峰间距中位数的 40%，但不低于 0.1°
    minPeakDistanceDeg = Math.max(0.10, avgPeakDistance * 0.40);
    // 如果峰很密集（间距 < 1°），进一步降低
    if (avgPeakDistance < 1.0) {
        minPeakDistanceDeg = Math.max(0.08, avgPeakDistance * 0.30);
    }
    minPeakDistanceDeg = parseFloat(minPeakDistanceDeg.toFixed(2));

    // 最小峰宽：FWHM 中位数的 50%，不低于 0.05°
    minWidthDeg = Math.max(0.05, medianFwhm * 0.50);
    minWidthDeg = parseFloat(minWidthDeg.toFixed(2));

    // 构建摘要
    const modeLabels = { balanced: '平衡', recall: '漏峰优先', precision: '抑制伪峰' };
    const noiseLevelLabels = { low: '低', medium: '中', high: '高' };
    const summary = `噪声${noiseLevelLabels[noiseLevel]}(SNR=${snr.toFixed(1)}) · 估计${estimatedPeakCount}峰 · 推荐${modeLabels[recommendedMode]}模式`;

    return {
        config: {
            mode: recommendedMode,
            maxPeaks: 'auto',
            minPeakDistanceDeg,
            minProminencePercent: parseFloat(minProminencePercent.toFixed(1)),
            minWidthDeg,
            smoothingPasses
        },
        diagnosis: {
            noiseLevel,
            snr: parseFloat(snr.toFixed(1)),
            estimatedPeakCount,
            avgPeakDistance: parseFloat(avgPeakDistance.toFixed(2)),
            medianFwhm: parseFloat(medianFwhm.toFixed(3)),
            recommendedMode
        },
        summary
    };
};

const interpolateX = (p1: DataPoint, p2: DataPoint, targetY: number): number => {
    if (p2.y === p1.y) return p1.x;
    return p1.x + (targetY - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
};

export const calculateScherrer = (fwhmDeg: number, twoThetaDeg: number, lambda: number, K: number = 0.9): number => {
    if (fwhmDeg <= 0) return 0;
    const betaRad = fwhmDeg * (Math.PI / 180);
    const thetaRad = (twoThetaDeg / 2) * (Math.PI / 180);
    const D = (K * lambda) / (betaRad * Math.cos(thetaRad));
    return D;
};

export const calculateBraggD = (twoThetaDeg: number, lambda: number): number => {
    const thetaRad = (twoThetaDeg / 2) * (Math.PI / 180);
    return lambda / (2 * Math.sin(thetaRad));
}

export const applySGSmoothing = (data: DataPoint[]): DataPoint[] => {
    if (data.length < 5) return data;
    const smoothed: DataPoint[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < 2 || i > data.length - 3) {
            smoothed.push({ ...data[i] });
            continue;
        }
        const val = (-3 * data[i - 2].y + 12 * data[i - 1].y + 17 * data[i].y + 12 * data[i + 1].y + -3 * data[i + 2].y) / 35;
        smoothed.push({ x: data[i].x, y: Math.max(0, val) });
    }
    return smoothed;
};

export const removeBackground = (data: DataPoint[], iterations: number = 40): DataPoint[] => {
    if (data.length === 0) return data;

    // SNIP Algorithm (Sensitive Nonlinear Iterative Peak clipping)
    let baseline = data.map(d => Math.log(Math.log(d.y + 1) + 1)); // Log-log transform to suppress peaks
    const n = baseline.length;

    for (let k = 1; k <= iterations; k++) {
        const nextBaseline = [...baseline];
        for (let i = k; i < n - k; i++) {
            const avg = (baseline[i - k] + baseline[i + k]) / 2;
            nextBaseline[i] = Math.min(baseline[i], avg);
        }
        baseline = nextBaseline;
    }

    // Back-transform
    const finalBaseline = baseline.map(b => Math.exp(Math.exp(b) - 1) - 1);

    return data.map((d, i) => ({
        x: d.x,
        y: Math.max(0, d.y - finalBaseline[i])
    }));
};

export const normalizeData = (data: DataPoint[]): DataPoint[] => {
    if (data.length === 0) return data;
    const maxY = Math.max(...data.map(d => d.y));
    if (maxY === 0) return data;
    return data.map(d => ({
        x: d.x,
        y: (d.y / maxY) * 100
    }));
};

// ═══════════════════════════════════════════
//  Phase 1.2 峰位精修 (Centroid Refinement)
// ═══════════════════════════════════════════

/**
 * 对峰顶附近 5 点做抛物线拟合精修峰位
 * y = a·x² + b·x + c → 精确峰位 = -b/(2a)
 * 精度从 step-size 级提升至 ~0.001°
 */
export const refinePeakPosition = (xData: number[], yData: number[], peakIdx: number): number => {
    if (peakIdx < 2 || peakIdx >= xData.length - 2) return xData[peakIdx];

    // 取峰顶及两侧各 2 个点
    const xs = [xData[peakIdx - 2], xData[peakIdx - 1], xData[peakIdx], xData[peakIdx + 1], xData[peakIdx + 2]];
    const ys = [yData[peakIdx - 2], yData[peakIdx - 1], yData[peakIdx], yData[peakIdx + 1], yData[peakIdx + 2]];

    // 最小二乘拟合 y = a·x² + b·x + c
    // 正规方程: [Σx⁴ Σx³ Σx²] [a]   [Σx²y]
    //           [Σx³ Σx² Σx ] [b] = [Σxy ]
    //           [Σx² Σx  n  ] [c]   [Σy  ]
    let sx0 = 0, sx1 = 0, sx2 = 0, sx3 = 0, sx4 = 0;
    let sy = 0, sxy = 0, sx2y = 0;
    const n = xs.length;

    for (let i = 0; i < n; i++) {
        const x = xs[i], y = ys[i];
        const x2 = x * x, x3 = x2 * x, x4 = x3 * x;
        sx0 += 1;
        sx1 += x;
        sx2 += x2;
        sx3 += x3;
        sx4 += x4;
        sy += y;
        sxy += x * y;
        sx2y += x2 * y;
    }

    // 求解 3x3 线性方程组（Cramer 法则）
    const D = sx4 * (sx2 * sx0 - sx1 * sx1) - sx3 * (sx3 * sx0 - sx1 * sx2) + sx2 * (sx3 * sx1 - sx2 * sx2);
    if (Math.abs(D) < 1e-20) return xData[peakIdx];

    const Da = sx2y * (sx2 * sx0 - sx1 * sx1) - sx3 * (sxy * sx0 - sx1 * sy) + sx2 * (sxy * sx1 - sx2 * sy);
    const Db = sx4 * (sxy * sx0 - sx1 * sy) - sx2y * (sx3 * sx0 - sx1 * sx2) + sx2 * (sx3 * sy - sxy * sx2);

    const a = Da / D;
    const b = Db / D;

    // 抛物线顶点 x = -b/(2a)
    if (Math.abs(a) < 1e-20 || a > 0) return xData[peakIdx]; // 凹而非凸，返回原始
    const refinedX = -b / (2 * a);

    // 安全边界检查
    if (Math.abs(refinedX - xData[peakIdx]) > 1.0) return xData[peakIdx];
    return refinedX;
};

// ═══════════════════════════════════════════
//  Phase 1.4 多项式背景扣除
// ═══════════════════════════════════════════

/**
 * Chebyshev 多项式背景扣除
 * 选取非峰区域数据点 → 多项式拟合 → 全谱减除
 * 
 * @param data 原始数据
 * @param order 多项式阶数 (2-8, 默认 4)
 * @param peakThresholdPercent 峰区域判定阈值 (默认 30%)
 */
export const removeBackgroundPoly = (data: DataPoint[], order: number = 4, peakThresholdPercent: number = 30): DataPoint[] => {
    if (data.length < order + 2) return data;

    // 初步识别非峰区域：低于中位数 + 阈值的点视为背景
    const ys = data.map(d => d.y);
    const sortedY = [...ys].sort((a, b) => a - b);
    const medianY = sortedY[Math.floor(sortedY.length / 2)];
    const maxY = sortedY[sortedY.length - 1];
    const threshold = medianY + (maxY - medianY) * (peakThresholdPercent / 100);

    // 提取背景点
    const bgIndices: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (data[i].y <= threshold) bgIndices.push(i);
    }

    // 如果背景点太少，降低阈值
    if (bgIndices.length < order + 2) {
        return removeBackground(data); // fallback 到 SNIP
    }

    const bgX = bgIndices.map(i => data[i].x);
    const bgY = bgIndices.map(i => data[i].y);

    // 归一化 x 到 [-1, 1] 避免数值不稳定
    const xMin = data[0].x, xMax = data[data.length - 1].x;
    const xRange = xMax - xMin || 1;
    const normalizeX = (x: number) => 2 * (x - xMin) / xRange - 1;

    const normBgX = bgX.map(normalizeX);

    // 构建 Vandermonde 矩阵并求解最小二乘
    const coeffs = fitPolynomial(normBgX, bgY, order);
    if (!coeffs) return removeBackground(data); // fallback

    // 计算全谱基线
    return data.map(d => {
        const nx = normalizeX(d.x);
        let bg = 0;
        for (let k = 0; k <= order; k++) {
            bg += coeffs[k] * Math.pow(nx, k);
        }
        return { x: d.x, y: Math.max(0, d.y - bg) };
    });
};

/** 最小二乘多项式拟合 (正规方程法) */
const fitPolynomial = (x: number[], y: number[], order: number): number[] | null => {
    const n = x.length;
    const p = order + 1;

    // 构建正规方程 (XᵀX)c = Xᵀy
    const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    const Xty: number[] = new Array(p).fill(0);

    for (let i = 0; i < n; i++) {
        const xPow = new Array(2 * order + 1);
        xPow[0] = 1;
        for (let k = 1; k <= 2 * order; k++) xPow[k] = xPow[k - 1] * x[i];

        for (let j = 0; j < p; j++) {
            for (let k = 0; k < p; k++) {
                XtX[j][k] += xPow[j + k];
            }
            Xty[j] += xPow[j] * y[i];
        }
    }

    // 高斯消元
    const aug: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
    for (let col = 0; col < p; col++) {
        let maxRow = col;
        for (let row = col + 1; row < p; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        if (Math.abs(aug[col][col]) < 1e-14) return null;

        for (let row = col + 1; row < p; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= p; j++) aug[row][j] -= factor * aug[col][j];
        }
    }

    const coeffs = new Array(p).fill(0);
    for (let i = p - 1; i >= 0; i--) {
        coeffs[i] = aug[i][p];
        for (let j = i + 1; j < p; j++) coeffs[i] -= aug[i][j] * coeffs[j];
        coeffs[i] /= aug[i][i];
    }
    return coeffs;
};

// ═══════════════════════════════════════════
//  Phase 2.1 d 值 + 强度加权匹配算法
// ═══════════════════════════════════════════

export interface PhaseMatchScore {
    /** 物相名称 */
    name: string;
    /** 卡片号 */
    card: string;
    /** 晶系 */
    crystalSystem: string;
    /** 综合匹配分数 (0-100) */
    score: number;
    /** 峰位匹配分项 (0-100) */
    positionScore: number;
    /** 强度匹配分项 (0-100) */
    intensityScore: number;
    /** 匹配到的峰数 / 参考峰总数 */
    matchedRatio: string;
    /** 详细匹配列表 */
    matchDetails: Array<{
        refTwoTheta: number;
        refIntensity: number;
        expTwoTheta: number | null;
        expIntensity: number | null;
        deltaD: number | null;
        deltaI: number | null;
    }>;
}

/**
 * d 值 + 强度加权物相匹配
 * 
 * 使用 d 值（而非 2θ）做位置匹配，对不同波长源鲁棒
 * 权重公式：Score = 0.6 × PositionScore + 0.4 × IntensityScore
 * 
 * @param experimentalPeaks 实验峰列表
 * @param referencePeaks 参考物相峰列表
 * @param lambda 波长 (nm)
 * @param tolerance d 值容差 (nm, 默认 0.005)
 */
export const scorePhaseMatch = (
    experimentalPeaks: Array<{ twoTheta: number; intensity: number }>,
    referencePeaks: Array<{ twoTheta: number; intensity: number; dSpacing?: number }>,
    lambda: number = 0.15406,
    tolerance: number = 0.005
): { score: number; positionScore: number; intensityScore: number; matchedCount: number; matchDetails: PhaseMatchScore['matchDetails'] } => {
    if (referencePeaks.length === 0 || experimentalPeaks.length === 0) {
        return { score: 0, positionScore: 0, intensityScore: 0, matchedCount: 0, matchDetails: [] };
    }

    // 计算 d 值
    const expWithD = experimentalPeaks.map(p => ({
        ...p,
        d: calculateBraggD(p.twoTheta, lambda)
    }));

    const refWithD = referencePeaks.map(p => ({
        ...p,
        d: p.dSpacing || calculateBraggD(p.twoTheta, lambda)
    }));

    // 归一化参考强度 (最大=100)
    const refMaxI = Math.max(...refWithD.map(p => p.intensity), 1);
    const expMaxI = Math.max(...expWithD.map(p => p.intensity), 1);

    let totalPositionW = 0;
    let totalIntensityW = 0;
    let weightSum = 0;
    let matchedCount = 0;

    const matchDetails: PhaseMatchScore['matchDetails'] = [];

    for (const ref of refWithD) {
        const refIRel = ref.intensity / refMaxI;
        const weight = refIRel; // 强峰权重更大

        // 找最近的实验峰（按 d 值）
        let bestExp: typeof expWithD[0] | null = null;
        let bestDelta = Infinity;
        for (const exp of expWithD) {
            const delta = Math.abs(exp.d - ref.d);
            if (delta < bestDelta) {
                bestDelta = delta;
                bestExp = exp;
            }
        }

        if (bestExp && bestDelta < tolerance) {
            matchedCount++;
            // 位置分数：越接近满分越高
            const posScore = 1 - bestDelta / tolerance;
            totalPositionW += posScore * weight;

            // 强度分数：相对强度偏差越小越好
            const expIRel = bestExp.intensity / expMaxI;
            const intScore = 1 - Math.min(1, Math.abs(refIRel - expIRel));
            totalIntensityW += intScore * weight;

            matchDetails.push({
                refTwoTheta: ref.twoTheta,
                refIntensity: ref.intensity,
                expTwoTheta: bestExp.twoTheta,
                expIntensity: bestExp.intensity,
                deltaD: bestDelta,
                deltaI: Math.abs(refIRel - expIRel),
            });
        } else {
            matchDetails.push({
                refTwoTheta: ref.twoTheta,
                refIntensity: ref.intensity,
                expTwoTheta: null,
                expIntensity: null,
                deltaD: null,
                deltaI: null,
            });
        }

        weightSum += weight;
    }

    if (weightSum === 0) {
        return { score: 0, positionScore: 0, intensityScore: 0, matchedCount: 0, matchDetails };
    }

    const positionScore = (totalPositionW / weightSum) * 100;
    const intensityScore = (totalIntensityW / weightSum) * 100;
    const score = 0.6 * positionScore + 0.4 * intensityScore;

    return {
        score: parseFloat(score.toFixed(1)),
        positionScore: parseFloat(positionScore.toFixed(1)),
        intensityScore: parseFloat(intensityScore.toFixed(1)),
        matchedCount,
        matchDetails,
    };
};
