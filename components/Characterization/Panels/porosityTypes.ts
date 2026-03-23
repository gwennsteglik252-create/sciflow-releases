// ═══ SciFlow Pro — Porosity Analysis 类型与算法 ═══

import * as XLSX from 'xlsx';

// ── 基础类型 ──
export type BranchType = 'ads' | 'des';

export interface IsothermPoint {
    x: number; // P/P0
    y: number; // Adsorbed quantity (cm3 STP/g, assumed)
    type: BranchType;
}

export interface FitRange {
    min: number;
    max: number;
}
export type FitMode = 'auto' | 'manual';
export type BjhYAxisMode = 'deltaV' | 'dVdLogD';
export type ThicknessModel = 'halsey' | 'harkins-jura';
export type BjhBranchMode = 'des' | 'ads';

export interface PorosityQcReport {
    total: number;
    adsCount: number;
    desCount: number;
    duplicateMerged: number;
    outOfRangeRemoved: number;
    nonMonotonicAdsSegments: number;
    warnings: string[];
}

export interface PorosityResult {
    ssa: number;
    poreVolume: number;
    avgPoreSize: number;
    type: string;
    insight: string;
    betRange: FitRange;
    r2: number;
    cConstant: number;
    vm: number;
    slope: number;
    intercept: number;
    microporeRatio: number;
    psdPeakNm: number | null;
    hysteresisType: string;
    classificationEvidence: {
        lowPressureSlope: number;
        lowPressureWindow: [number, number];
        hysteresisMidGap: number;
        hysteresisHighGap: number;
        rationale: string;
    };
}

export interface PoreDistributionBin {
    diameterNm: number;
    deltaVolume: number;
    cumulativeVolume: number;
    thicknessNm: number;
    kelvinRadiusNm: number;
}

export interface BetLinearPoint {
    x: number;
    y: number;
    inFit: boolean;
}

export interface BetLinearLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface BetLinearPlot {
    points: BetLinearPoint[];
    line: BetLinearLine | null;
}

export interface BjhParams {
    thicknessModel: ThicknessModel;
    branchMode: BjhBranchMode;
}

export interface SensitivityCell {
    min: number;
    max: number;
    ssa: number;
    r2: number;
}

export interface LinkedExperimentRef {
    projectId: string;
    milestoneId: string;
    logId: string;
}

export interface PorosityContextInsight {
    summary: string;
    keyFindings: string[];
    mechanismHints: string[];
    riskFlags: string[];
    nextActions: string[];
    publicationSentence: string;
}

export interface CompareSampleItem {
    id: string;
    title: string;
    result: PorosityResult;
    betPlot: BetLinearPlot;
    psdBins: PoreDistributionBin[];
    linkedContext?: LinkedExperimentRef | null;
    recordId?: string;
    bjhParams?: BjhParams;
}

export const DEFAULT_FIT_RANGE: FitRange = { min: 0.05, max: 0.30 };

// ── 工具函数 ──

export const buildNiceTicks = (minVal: number, maxVal: number, targetCount = 5): number[] => {
    const span = Math.max(1e-9, maxVal - minVal);
    const rawStep = span / Math.max(2, targetCount - 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const step = niceNormalized * magnitude;
    const start = Math.floor(minVal / step) * step;
    const end = Math.ceil(maxVal / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= end + step * 0.5; v += step) {
        if (v >= minVal - step * 0.25 && v <= maxVal + step * 0.25) ticks.push(Number(v.toFixed(6)));
    }
    if (!ticks.length) return [minVal, maxVal];
    return ticks;
};

export const parseNumeric = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v !== 'string') return null;
    const cleaned = v.trim().replace(/,/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeHeader = (header: string) => header.trim().toLowerCase().replace(/\s+/g, '');

const detectColumns = (headers: string[]) => {
    const normalized = headers.map(normalizeHeader);
    const findBy = (patterns: RegExp[]) => normalized.findIndex(h => patterns.some(p => p.test(h)));
    const pp0Index = findBy([/^p\/?p0$/, /^pp0$/, /relativepressure/, /相对压力/, /^pressure$/, /^x$/]);
    const adsIndex = findBy([/^ads/, /吸附/, /^quantityadsorbed$/, /^vads$/, /^y$/]);
    const desIndex = findBy([/^des/, /脱附/, /^vdes$/]);
    const branchIndex = findBy([/^type$/, /^branch$/, /分支/]);
    return { pp0Index, adsIndex, desIndex, branchIndex };
};

export const parseDelimitedText = (content: string): IsothermPoint[] => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const headers = lines[0].split(delimiter).map(h => h.trim());
    const { pp0Index, adsIndex, desIndex, branchIndex } = detectColumns(headers);
    const points: IsothermPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim());
        if (!cols.length) continue;
        const p = parseNumeric(cols[pp0Index >= 0 ? pp0Index : 0]);
        if (p === null) continue;
        if (adsIndex >= 0 && desIndex >= 0) {
            const yAds = parseNumeric(cols[adsIndex]);
            const yDes = parseNumeric(cols[desIndex]);
            if (yAds !== null) points.push({ x: p, y: yAds, type: 'ads' });
            if (yDes !== null) points.push({ x: p, y: yDes, type: 'des' });
            continue;
        }
        if (branchIndex >= 0 && adsIndex >= 0) {
            const y = parseNumeric(cols[adsIndex]);
            const branchRaw = String(cols[branchIndex] || '').toLowerCase();
            const type: BranchType = /des|脱/.test(branchRaw) ? 'des' : 'ads';
            if (y !== null) points.push({ x: p, y, type });
            continue;
        }
        const yFallback = parseNumeric(cols[adsIndex >= 0 ? adsIndex : 1]);
        if (yFallback !== null) points.push({ x: p, y: yFallback, type: 'ads' });
    }
    return points;
};

export const parseXlsxFile = (buffer: ArrayBuffer): IsothermPoint[] => {
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
    if (!rows.length) return [];
    const headers = Object.keys(rows[0] || {});
    const { pp0Index, adsIndex, desIndex, branchIndex } = detectColumns(headers);
    const getByIndex = (row: Record<string, unknown>, idx: number) => {
        if (idx < 0) return '';
        return row[headers[idx]];
    };
    const points: IsothermPoint[] = [];
    for (const row of rows) {
        const p = parseNumeric(getByIndex(row, pp0Index >= 0 ? pp0Index : 0));
        if (p === null) continue;
        if (adsIndex >= 0 && desIndex >= 0) {
            const yAds = parseNumeric(getByIndex(row, adsIndex));
            const yDes = parseNumeric(getByIndex(row, desIndex));
            if (yAds !== null) points.push({ x: p, y: yAds, type: 'ads' });
            if (yDes !== null) points.push({ x: p, y: yDes, type: 'des' });
            continue;
        }
        if (branchIndex >= 0 && adsIndex >= 0) {
            const y = parseNumeric(getByIndex(row, adsIndex));
            const branchRaw = String(getByIndex(row, branchIndex) || '').toLowerCase();
            const type: BranchType = /des|脱/.test(branchRaw) ? 'des' : 'ads';
            if (y !== null) points.push({ x: p, y, type });
            continue;
        }
        const yFallback = parseNumeric(getByIndex(row, adsIndex >= 0 ? adsIndex : 1));
        if (yFallback !== null) points.push({ x: p, y: yFallback, type: 'ads' });
    }
    return points;
};

export const cleanAndAssessPoints = (inputPoints: IsothermPoint[]): { cleaned: IsothermPoint[]; qc: PorosityQcReport } => {
    const warnings: string[] = [];
    let outOfRangeRemoved = 0;
    const ranged = inputPoints.filter(p => {
        const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.x < 1 && p.y > 0;
        if (!ok) outOfRangeRemoved += 1;
        return ok;
    });
    const dedupMap = new Map<string, { sum: number; cnt: number; x: number; type: BranchType }>();
    for (const p of ranged) {
        const key = `${p.type}:${p.x.toFixed(5)}`;
        const prev = dedupMap.get(key);
        if (prev) { prev.sum += p.y; prev.cnt += 1; } else { dedupMap.set(key, { sum: p.y, cnt: 1, x: p.x, type: p.type }); }
    }
    const cleaned = Array.from(dedupMap.values()).map(v => ({ x: v.x, y: v.sum / v.cnt, type: v.type })).sort((a, b) => (a.type === b.type ? a.x - b.x : a.type.localeCompare(b.type)));
    const duplicateMerged = ranged.length - cleaned.length;
    const ads = cleaned.filter(p => p.type === 'ads').sort((a, b) => a.x - b.x);
    const des = cleaned.filter(p => p.type === 'des').sort((a, b) => a.x - b.x);
    let nonMonotonicAdsSegments = 0;
    for (let i = 1; i < ads.length; i++) { if (ads[i].y + 1e-6 < ads[i - 1].y) nonMonotonicAdsSegments += 1; }
    if (ads.length < 5) warnings.push('吸附分支点数不足（<5），BET 拟合可靠性偏低。');
    if (des.length === 0) warnings.push('未检测到脱附分支，仅输出 BET 基础指标。');
    if (nonMonotonicAdsSegments > 0) warnings.push(`吸附支路存在 ${nonMonotonicAdsSegments} 处非单调段，建议检查原始数据。`);
    if (outOfRangeRemoved > 0) warnings.push(`已剔除 ${outOfRangeRemoved} 个非法点（P/P0 不在 0-1 或吸附量非正）。`);
    return { cleaned, qc: { total: inputPoints.length, adsCount: ads.length, desCount: des.length, duplicateMerged, outOfRangeRemoved, nonMonotonicAdsSegments, warnings } };
};

export const linearFit = (xy: Array<{ x: number; y: number }>) => {
    const n = xy.length;
    if (n < 3) return null;
    let sumX = 0; let sumY = 0; let sumXX = 0; let sumXY = 0;
    for (const p of xy) { sumX += p.x; sumY += p.y; sumXX += p.x * p.x; sumXY += p.x * p.y; }
    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-12) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const meanY = sumY / n;
    let ssTot = 0; let ssRes = 0;
    for (const p of xy) { const pred = slope * p.x + intercept; ssTot += (p.y - meanY) ** 2; ssRes += (p.y - pred) ** 2; }
    const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
    return { slope, intercept, r2 };
};

export const recommendBetFitRange = (points: IsothermPoint[]): { range: FitRange; r2: number; count: number } | null => {
    const ads = points.filter(p => p.type === 'ads' && p.x >= 0.03 && p.x <= 0.45 && p.y > 0).sort((a, b) => a.x - b.x);
    if (ads.length < 6) return null;
    let best: { range: FitRange; r2: number; count: number } | null = null;
    for (let i = 0; i < ads.length - 4; i++) {
        for (let j = i + 4; j < ads.length; j++) {
            const min = ads[i].x; const max = ads[j].x; const width = max - min;
            if (width < 0.08 || width > 0.35) continue;
            const slice = ads.slice(i, j + 1);
            const transformed = slice.map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)) })).filter(p => Number.isFinite(p.y) && p.y > 0);
            if (transformed.length < 5) continue;
            const fit = linearFit(transformed);
            if (!fit || fit.slope <= 0 || fit.intercept <= 0 || fit.r2 < 0.97) continue;
            const candidate = { range: { min, max }, r2: fit.r2, count: transformed.length };
            if (!best) { best = candidate; continue; }
            if (candidate.r2 > best.r2 + 1e-4 || (Math.abs(candidate.r2 - best.r2) <= 1e-4 && candidate.count > best.count)) best = candidate;
        }
    }
    return best;
};

export const classifyIsothermType = (ads: IsothermPoint[]): string => {
    if (ads.length < 6) return 'Type Unknown';
    const sorted = [...ads].sort((a, b) => a.x - b.x);
    const low = sorted.filter(p => p.x <= 0.1);
    const mid = sorted.filter(p => p.x >= 0.3 && p.x <= 0.6);
    const high = sorted.filter(p => p.x >= 0.8);
    const avg = (arr: IsothermPoint[]) => arr.length ? arr.reduce((s, p) => s + p.y, 0) / arr.length : 0;
    const lowAvg = avg(low); const midAvg = avg(mid); const highAvg = avg(high);
    if (lowAvg > 0 && highAvg / lowAvg > 6 && midAvg / lowAvg < 3) return 'Type I/IV (Micro-Mesoporous)';
    if (highAvg > lowAvg * 3) return 'Type IV (Mesoporous)';
    return 'Type II/III';
};

const computeHysteresisGaps = (ads: IsothermPoint[], des: IsothermPoint[]) => {
    if (des.length < 4) return 'N/A' as const;
    const adsMap = new Map(ads.map(p => [p.x.toFixed(3), p.y]));
    const shared = des.map(d => { const ay = adsMap.get(d.x.toFixed(3)); return ay ? { x: d.x, gap: Math.abs(ay - d.y) } : null; }).filter((v): v is { x: number; gap: number } => Boolean(v));
    if (shared.length < 4) return 'N/A' as const;
    const high = shared.filter(s => s.x >= 0.6);
    const mid = shared.filter(s => s.x >= 0.4 && s.x < 0.6);
    const low = shared.filter(s => s.x < 0.4);
    const mean = (arr: { gap: number }[]) => arr.length ? arr.reduce((s, p) => s + p.gap, 0) / arr.length : 0;
    return { highGap: mean(high), midGap: mean(mid), lowGap: mean(low) };
};

export const classifyHysteresisType = (ads: IsothermPoint[], des: IsothermPoint[]): string => {
    const gaps = computeHysteresisGaps(ads, des);
    if (gaps === 'N/A') return 'N/A';
    const { highGap, midGap, lowGap } = gaps;
    if (highGap > midGap * 1.4 && lowGap < midGap) return 'H3';
    if (midGap > highGap * 1.2 && midGap > lowGap * 1.2) return 'H2';
    return 'H1/H4';
};

export const halseyThicknessNm = (pp0: number): number => {
    if (pp0 <= 0 || pp0 >= 1) return 0;
    const val = Math.pow(5 / Math.max(1e-8, -Math.log(pp0)), 1 / 3);
    return Number.isFinite(val) ? val : 0;
};

export const harkinsJuraThicknessNm = (pp0: number): number => {
    if (pp0 <= 0 || pp0 >= 1) return 0;
    const logp = Math.log10(pp0);
    const denom = 0.034 - logp;
    if (denom <= 0) return 0;
    const angstrom = Math.sqrt(13.99 / denom);
    return Number.isFinite(angstrom * 0.1) ? angstrom * 0.1 : 0;
};

export const kelvinRadiusNm = (pp0: number): number => {
    if (pp0 <= 0 || pp0 >= 1) return 0;
    const rk = -0.415 / Math.log(pp0);
    return Number.isFinite(rk) ? rk : 0;
};

export const getThickness = (pp0: number, model: ThicknessModel) => (
    model === 'harkins-jura' ? harkinsJuraThicknessNm(pp0) : halseyThicknessNm(pp0)
);

export const calculateBjH = (points: IsothermPoint[], params: BjhParams): PoreDistributionBin[] => {
    if (points.length < 6) return [];
    const desc = [...points].filter(p => p.x > 0.35 && p.x < 0.995).sort((a, b) => b.x - a.x);
    if (desc.length < 6) return [];
    const rawBins: Array<Omit<PoreDistributionBin, 'cumulativeVolume'>> = [];
    const emittedSurfaceAreas: number[] = [];
    const STP_TO_LIQ_N2 = 0.0015468;
    for (let i = 0; i < desc.length - 1; i++) {
        const high = desc[i]; const low = desc[i + 1];
        const tHigh = getThickness(high.x, params.thicknessModel);
        const tLow = getThickness(low.x, params.thicknessModel);
        const rkHigh = kelvinRadiusNm(high.x);
        const rkLow = kelvinRadiusNm(low.x);
        if (rkHigh <= 0 || rkLow <= 0) continue;
        const rpMean = ((rkHigh + tHigh) + (rkLow + tLow)) / 2;
        if (rpMean <= 0) continue;
        const deltaVObserved = Math.max(0, (high.y - low.y) * STP_TO_LIQ_N2);
        const deltaT = Math.max(0, tHigh - tLow);
        const deltaVPore = Math.max(0, deltaVObserved - deltaT * emittedSurfaceAreas.reduce((s, a) => s + a, 0));
        if (deltaVPore <= 0) continue;
        emittedSurfaceAreas.push((2 * deltaVPore) / rpMean);
        rawBins.push({ diameterNm: 2 * rpMean, deltaVolume: deltaVPore, thicknessNm: (tHigh + tLow) / 2, kelvinRadiusNm: (rkHigh + rkLow) / 2 });
    }
    const sorted = rawBins.sort((a, b) => a.diameterNm - b.diameterNm);
    let cumulative = 0;
    return sorted.map(bin => { cumulative += bin.deltaVolume; return { ...bin, cumulativeVolume: cumulative }; });
};

export const normalizePsdBins = (bins: any[]): PoreDistributionBin[] => {
    if (!Array.isArray(bins)) return [];
    let cumulative = 0;
    return bins
        .filter(b => Number.isFinite(Number(b?.diameterNm)) && Number.isFinite(Number(b?.deltaVolume)))
        .map(b => {
            const deltaVolume = Math.max(0, Number(b.deltaVolume));
            cumulative += deltaVolume;
            return {
                diameterNm: Number(b.diameterNm), deltaVolume,
                cumulativeVolume: Number.isFinite(Number(b.cumulativeVolume)) ? Number(b.cumulativeVolume) : cumulative,
                thicknessNm: Number.isFinite(Number(b.thicknessNm)) ? Number(b.thicknessNm) : 0,
                kelvinRadiusNm: Number.isFinite(Number(b.kelvinRadiusNm)) ? Number(b.kelvinRadiusNm) : 0
            };
        });
};

export const computeSensitivityGrid = (ads: IsothermPoint[]): SensitivityCell[] => {
    const cells: SensitivityCell[] = [];
    for (let start = 0.03; start <= 0.19; start += 0.02) {
        for (let end = start + 0.10; end <= 0.41; end += 0.02) {
            const fitCandidates = ads.filter(p => p.x >= start && p.x <= end && p.x < 0.95);
            const transformed = fitCandidates.map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)) })).filter(p => Number.isFinite(p.y) && p.y > 0);
            const fit = linearFit(transformed);
            if (!fit || fit.intercept <= 0 || fit.slope <= 0) continue;
            const vm = 1 / (fit.slope + fit.intercept);
            cells.push({ min: Number(start.toFixed(2)), max: Number(end.toFixed(2)), ssa: Number((vm * 4.354).toFixed(1)), r2: Number(fit.r2.toFixed(4)) });
        }
    }
    return cells;
};

export const analyzePorosity = (points: IsothermPoint[], fitRange: FitRange, bjhParams: BjhParams) => {
    const ads = points.filter(p => p.type === 'ads').sort((a, b) => a.x - b.x);
    const des = points.filter(p => p.type === 'des').sort((a, b) => a.x - b.x);
    if (ads.length < 5) return null;
    const fitCandidates = ads.filter(p => p.x >= fitRange.min && p.x <= fitRange.max && p.x < 0.95);
    const transformed = fitCandidates.map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)) })).filter(p => Number.isFinite(p.y) && p.y > 0);
    const fit = linearFit(transformed);
    if (!fit || fit.intercept <= 0 || fit.slope <= 0) return null;
    const vm = 1 / (fit.slope + fit.intercept);
    const cConstant = 1 + fit.slope / fit.intercept;
    const ssa = vm * 4.354;
    const nearP99 = [...ads].sort((a, b) => Math.abs(a.x - 0.99) - Math.abs(b.x - 0.99))[0];
    const poreVolume = nearP99 ? nearP99.y * 0.0015468 : 0;
    const avgPoreSize = ssa > 1e-6 ? (4000 * poreVolume) / ssa : 0;
    const lowRangeAds = ads.filter(p => p.x <= 0.1);
    const highRangeAds = ads.filter(p => p.x >= 0.9);
    const lowAvg = lowRangeAds.length ? lowRangeAds.reduce((s, p) => s + p.y, 0) / lowRangeAds.length : 0;
    const highAvg = highRangeAds.length ? highRangeAds.reduce((s, p) => s + p.y, 0) / highRangeAds.length : 1;
    const microporeRatio = highAvg > 0 ? Math.min(100, Math.max(0, (lowAvg / highAvg) * 100)) : 0;
    const type = classifyIsothermType(ads);
    const hysteresisType = classifyHysteresisType(ads, des);
    const bjhSource = bjhParams.branchMode === 'ads' ? ads : des;
    const psdBins = calculateBjH(bjhSource, bjhParams);
    const psdPeak = psdBins.reduce<PoreDistributionBin | null>((acc, cur) => (!acc || cur.deltaVolume > acc.deltaVolume ? cur : acc), null);
    const sensitivity = computeSensitivityGrid(ads);
    const lowWindow = ads.filter(p => p.x >= 0.03 && p.x <= 0.10);
    const lowFit = linearFit(lowWindow.map(p => ({ x: p.x, y: p.y })));
    const gaps = computeHysteresisGaps(ads, des);
    const rationale = gaps === 'N/A'
        ? '脱附分支不足，无法给出回滞宽度证据。'
        : `低压段斜率 ${lowFit ? lowFit.slope.toFixed(2) : 'N/A'}，中压回滞宽度 ${gaps.midGap.toFixed(2)}，高压回滞宽度 ${gaps.highGap.toFixed(2)}。`;
    const betPlotPoints: BetLinearPoint[] = ads
        .filter(p => p.x >= 0.03 && p.x <= 0.45)
        .map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)), inFit: p.x >= fitRange.min && p.x <= fitRange.max }))
        .filter(p => Number.isFinite(p.y) && p.y > 0);
    const fitLine: BetLinearLine | null = fitCandidates.length >= 2
        ? { x1: fitRange.min, y1: fit.slope * fitRange.min + fit.intercept, x2: fitRange.max, y2: fit.slope * fitRange.max + fit.intercept }
        : null;
    const insight = `${type}，回滞环判定 ${hysteresisType}。BET 线性区 ${fitRange.min.toFixed(2)}-${fitRange.max.toFixed(2)} 下 R²=${fit.r2.toFixed(4)}，比表面积 ${ssa.toFixed(1)} m²/g。`;
    const result: PorosityResult = {
        ssa: Number(ssa.toFixed(1)), poreVolume: Number(poreVolume.toFixed(3)), avgPoreSize: Number(avgPoreSize.toFixed(2)),
        type, insight, betRange: fitRange, r2: Number(fit.r2.toFixed(4)), cConstant: Number(cConstant.toFixed(2)),
        vm: Number(vm.toFixed(3)), slope: Number(fit.slope.toFixed(6)), intercept: Number(fit.intercept.toFixed(6)),
        microporeRatio: Number(microporeRatio.toFixed(1)), psdPeakNm: psdPeak ? Number(psdPeak.diameterNm.toFixed(2)) : null,
        hysteresisType,
        classificationEvidence: {
            lowPressureSlope: Number((lowFit?.slope || 0).toFixed(3)), lowPressureWindow: [0.03, 0.10],
            hysteresisMidGap: Number((gaps === 'N/A' ? 0 : gaps.midGap).toFixed(3)),
            hysteresisHighGap: Number((gaps === 'N/A' ? 0 : gaps.highGap).toFixed(3)), rationale
        }
    };
    return { result, psdBins, betPlot: { points: betPlotPoints, line: fitLine } as BetLinearPlot, sensitivity };
};

// 模拟等温线数据生成器 (BET/Isotherm)
export const generatePorosityMockData = (profile: 'mof' | 'cof' = 'cof') => {
    const mockPoints: IsothermPoint[] = [];
    const base = profile === 'mof' ? 35 : 50;
    const max = profile === 'mof' ? 780 : 460;
    const adsExponent = profile === 'mof' ? 0.22 : 0.32;
    const desBias = profile === 'mof' ? 32 : 14;
    for (let i = 0; i <= 35; i++) {
        const x = i / 35;
        mockPoints.push({ x, y: base + max * Math.pow(x, adsExponent) + Math.random() * 3, type: 'ads' });
    }
    for (let i = 35; i >= 8; i--) {
        const x = i / 35;
        mockPoints.push({ x, y: base + desBias + (max * 0.98) * Math.pow(x, adsExponent - 0.03) + Math.random() * 3, type: 'des' });
    }
    return mockPoints;
};
