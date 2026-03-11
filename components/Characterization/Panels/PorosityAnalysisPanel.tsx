
import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ExperimentLog, ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import AnalysisSyncModal, { flattenMilestonesTree, getAutoSelections } from '../AnalysisSyncModal';
import { printElement } from '../../../utils/printUtility';
import { buildArchiveFolderMeta } from '../../../utils/archiveFolder';
import FolderLibraryView from '../FolderLibraryView';
import { generateContextualPorosityAnalysis } from '../../../services/gemini/analysis';

type BranchType = 'ads' | 'des';

interface IsothermPoint {
    x: number; // P/P0
    y: number; // Adsorbed quantity (cm3 STP/g, assumed)
    type: BranchType;
}

interface FitRange {
    min: number;
    max: number;
}
type FitMode = 'auto' | 'manual';
type BjhYAxisMode = 'deltaV' | 'dVdLogD';
type ThicknessModel = 'halsey' | 'harkins-jura';
type BjhBranchMode = 'des' | 'ads';

interface PorosityQcReport {
    total: number;
    adsCount: number;
    desCount: number;
    duplicateMerged: number;
    outOfRangeRemoved: number;
    nonMonotonicAdsSegments: number;
    warnings: string[];
}

interface PorosityResult {
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

interface PoreDistributionBin {
    diameterNm: number;
    deltaVolume: number;
    cumulativeVolume: number;
    thicknessNm: number;
    kelvinRadiusNm: number;
}

interface BetLinearPoint {
    x: number;
    y: number;
    inFit: boolean;
}

interface BetLinearLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface BetLinearPlot {
    points: BetLinearPoint[];
    line: BetLinearLine | null;
}

interface BjhParams {
    thicknessModel: ThicknessModel;
    branchMode: BjhBranchMode;
}

interface SensitivityCell {
    min: number;
    max: number;
    ssa: number;
    r2: number;
}

interface LinkedExperimentRef {
    projectId: string;
    milestoneId: string;
    logId: string;
}

interface PorosityContextInsight {
    summary: string;
    keyFindings: string[];
    mechanismHints: string[];
    riskFlags: string[];
    nextActions: string[];
    publicationSentence: string;
}

interface CompareSampleItem {
    id: string;
    title: string;
    result: PorosityResult;
    betPlot: BetLinearPlot;
    psdBins: PoreDistributionBin[];
    linkedContext?: LinkedExperimentRef | null;
    recordId?: string;
    bjhParams?: BjhParams;
}

interface Props {
    projects: ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    onUpdateProject?: (project: ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
    onBack?: () => void;
}

const DEFAULT_FIT_RANGE: FitRange = { min: 0.05, max: 0.30 };

const buildNiceTicks = (minVal: number, maxVal: number, targetCount = 5): number[] => {
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

const parseNumeric = (v: unknown): number | null => {
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

const parseDelimitedText = (content: string): IsothermPoint[] => {
    const lines = content
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);
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

const parseXlsxFile = (buffer: ArrayBuffer): IsothermPoint[] => {
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
    if (!rows.length) return [];

    const headers = Object.keys(rows[0] || {});
    const { pp0Index, adsIndex, desIndex, branchIndex } = detectColumns(headers);
    const getByIndex = (row: Record<string, unknown>, idx: number) => {
        if (idx < 0) return '';
        const key = headers[idx];
        return row[key];
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

const cleanAndAssessPoints = (inputPoints: IsothermPoint[]): { cleaned: IsothermPoint[]; qc: PorosityQcReport } => {
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
        if (prev) {
            prev.sum += p.y;
            prev.cnt += 1;
        } else {
            dedupMap.set(key, { sum: p.y, cnt: 1, x: p.x, type: p.type });
        }
    }

    const cleaned = Array.from(dedupMap.values())
        .map(v => ({ x: v.x, y: v.sum / v.cnt, type: v.type }))
        .sort((a, b) => (a.type === b.type ? a.x - b.x : a.type.localeCompare(b.type)));

    const duplicateMerged = ranged.length - cleaned.length;
    const ads = cleaned.filter(p => p.type === 'ads').sort((a, b) => a.x - b.x);
    const des = cleaned.filter(p => p.type === 'des').sort((a, b) => a.x - b.x);

    let nonMonotonicAdsSegments = 0;
    for (let i = 1; i < ads.length; i++) {
        if (ads[i].y + 1e-6 < ads[i - 1].y) nonMonotonicAdsSegments += 1;
    }

    if (ads.length < 5) warnings.push('吸附分支点数不足（<5），BET 拟合可靠性偏低。');
    if (des.length === 0) warnings.push('未检测到脱附分支，仅输出 BET 基础指标。');
    if (nonMonotonicAdsSegments > 0) warnings.push(`吸附支路存在 ${nonMonotonicAdsSegments} 处非单调段，建议检查原始数据。`);
    if (outOfRangeRemoved > 0) warnings.push(`已剔除 ${outOfRangeRemoved} 个非法点（P/P0 不在 0-1 或吸附量非正）。`);

    return {
        cleaned,
        qc: {
            total: inputPoints.length,
            adsCount: ads.length,
            desCount: des.length,
            duplicateMerged,
            outOfRangeRemoved,
            nonMonotonicAdsSegments,
            warnings
        }
    };
};

const linearFit = (xy: Array<{ x: number; y: number }>) => {
    const n = xy.length;
    if (n < 3) return null;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
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
    let ssTot = 0;
    let ssRes = 0;
    for (const p of xy) {
        const pred = slope * p.x + intercept;
        ssTot += (p.y - meanY) ** 2;
        ssRes += (p.y - pred) ** 2;
    }
    const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 0;
    return { slope, intercept, r2 };
};

const recommendBetFitRange = (points: IsothermPoint[]): { range: FitRange; r2: number; count: number } | null => {
    const ads = points
        .filter(p => p.type === 'ads' && p.x >= 0.03 && p.x <= 0.45 && p.y > 0)
        .sort((a, b) => a.x - b.x);
    if (ads.length < 6) return null;

    let best: { range: FitRange; r2: number; count: number } | null = null;
    for (let i = 0; i < ads.length - 4; i++) {
        for (let j = i + 4; j < ads.length; j++) {
            const min = ads[i].x;
            const max = ads[j].x;
            const width = max - min;
            if (width < 0.08 || width > 0.35) continue;

            const slice = ads.slice(i, j + 1);
            const transformed = slice
                .map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)) }))
                .filter(p => Number.isFinite(p.y) && p.y > 0);
            if (transformed.length < 5) continue;

            const fit = linearFit(transformed);
            if (!fit || fit.slope <= 0 || fit.intercept <= 0) continue;
            if (fit.r2 < 0.97) continue;

            const candidate = { range: { min, max }, r2: fit.r2, count: transformed.length };
            if (!best) {
                best = candidate;
                continue;
            }
            const betterR2 = candidate.r2 > best.r2 + 1e-4;
            const equalR2 = Math.abs(candidate.r2 - best.r2) <= 1e-4;
            const betterCoverage = candidate.count > best.count;
            if (betterR2 || (equalR2 && betterCoverage)) best = candidate;
        }
    }
    return best;
};

const classifyIsothermType = (ads: IsothermPoint[]): string => {
    if (ads.length < 6) return 'Type Unknown';
    const sorted = [...ads].sort((a, b) => a.x - b.x);
    const low = sorted.filter(p => p.x <= 0.1);
    const mid = sorted.filter(p => p.x >= 0.3 && p.x <= 0.6);
    const high = sorted.filter(p => p.x >= 0.8);
    const avg = (arr: IsothermPoint[]) => arr.length ? arr.reduce((s, p) => s + p.y, 0) / arr.length : 0;

    const lowAvg = avg(low);
    const midAvg = avg(mid);
    const highAvg = avg(high);
    if (lowAvg > 0 && highAvg / lowAvg > 6 && midAvg / lowAvg < 3) return 'Type I/IV (Micro-Mesoporous)';
    if (highAvg > lowAvg * 3) return 'Type IV (Mesoporous)';
    return 'Type II/III';
};

const computeHysteresisGaps = (ads: IsothermPoint[], des: IsothermPoint[]) => {
    if (des.length < 4) return 'N/A';
    const adsMap = new Map(ads.map(p => [p.x.toFixed(3), p.y]));
    const shared = des
        .map(d => {
            const ay = adsMap.get(d.x.toFixed(3));
            return ay ? { x: d.x, gap: Math.abs(ay - d.y) } : null;
        })
        .filter((v): v is { x: number; gap: number } => Boolean(v));
    if (shared.length < 4) return 'N/A';
    const high = shared.filter(s => s.x >= 0.6);
    const mid = shared.filter(s => s.x >= 0.4 && s.x < 0.6);
    const low = shared.filter(s => s.x < 0.4);
    const mean = (arr: { gap: number }[]) => arr.length ? arr.reduce((s, p) => s + p.gap, 0) / arr.length : 0;
    const highGap = mean(high);
    const midGap = mean(mid);
    const lowGap = mean(low);
    return { highGap, midGap, lowGap };
};

const classifyHysteresisType = (ads: IsothermPoint[], des: IsothermPoint[]): string => {
    const gaps = computeHysteresisGaps(ads, des);
    if (gaps === 'N/A') return 'N/A';
    const { highGap, midGap, lowGap } = gaps;

    if (highGap > midGap * 1.4 && lowGap < midGap) return 'H3';
    if (midGap > highGap * 1.2 && midGap > lowGap * 1.2) return 'H2';
    return 'H1/H4';
};

const halseyThicknessNm = (pp0: number): number => {
    if (pp0 <= 0 || pp0 >= 1) return 0;
    const val = Math.pow(5 / Math.max(1e-8, -Math.log(pp0)), 1 / 3); // nm
    return Number.isFinite(val) ? val : 0;
};

const harkinsJuraThicknessNm = (pp0: number): number => {
    if (pp0 <= 0 || pp0 >= 1) return 0;
    const logp = Math.log10(pp0);
    const denom = 0.034 - logp;
    if (denom <= 0) return 0;
    const angstrom = Math.sqrt(13.99 / denom);
    const nm = angstrom * 0.1;
    return Number.isFinite(nm) ? nm : 0;
};

const kelvinRadiusNm = (pp0: number): number => {
    if (pp0 <= 0 || pp0 >= 1) return 0;
    const rk = -0.415 / Math.log(pp0); // N2@77K
    return Number.isFinite(rk) ? rk : 0;
};

const getThickness = (pp0: number, model: ThicknessModel) => (
    model === 'harkins-jura' ? harkinsJuraThicknessNm(pp0) : halseyThicknessNm(pp0)
);

const calculateBjH = (points: IsothermPoint[], params: BjhParams): PoreDistributionBin[] => {
    if (points.length < 6) return [];
    const desc = [...points]
        .filter(p => p.x > 0.35 && p.x < 0.995)
        .sort((a, b) => b.x - a.x);
    if (desc.length < 6) return [];

    const rawBins: Array<Omit<PoreDistributionBin, 'cumulativeVolume'>> = [];
    const emittedSurfaceAreas: number[] = [];
    const STP_TO_LIQ_N2 = 0.0015468;

    for (let i = 0; i < desc.length - 1; i++) {
        const high = desc[i];
        const low = desc[i + 1];

        const tHigh = getThickness(high.x, params.thicknessModel);
        const tLow = getThickness(low.x, params.thicknessModel);
        const rkHigh = kelvinRadiusNm(high.x);
        const rkLow = kelvinRadiusNm(low.x);
        if (rkHigh <= 0 || rkLow <= 0) continue;

        const rpHigh = rkHigh + tHigh;
        const rpLow = rkLow + tLow;
        const rpMean = (rpHigh + rpLow) / 2;
        if (rpMean <= 0) continue;

        const deltaVObserved = Math.max(0, (high.y - low.y) * STP_TO_LIQ_N2);
        const deltaT = Math.max(0, tHigh - tLow);
        const areaFromLargerPores = emittedSurfaceAreas.reduce((s, a) => s + a, 0);
        const deltaVFilm = deltaT * areaFromLargerPores;
        const deltaVPore = Math.max(0, deltaVObserved - deltaVFilm);
        if (deltaVPore <= 0) continue;

        const deltaArea = (2 * deltaVPore) / rpMean; // cylindrical pores
        emittedSurfaceAreas.push(deltaArea);

        rawBins.push({
            diameterNm: 2 * rpMean,
            deltaVolume: deltaVPore,
            thicknessNm: (tHigh + tLow) / 2,
            kelvinRadiusNm: (rkHigh + rkLow) / 2
        });
    }

    const sorted = rawBins.sort((a, b) => a.diameterNm - b.diameterNm);
    let cumulative = 0;
    return sorted.map(bin => {
        cumulative += bin.deltaVolume;
        return { ...bin, cumulativeVolume: cumulative };
    });
};

const normalizePsdBins = (bins: any[]): PoreDistributionBin[] => {
    if (!Array.isArray(bins)) return [];
    let cumulative = 0;
    return bins
        .filter(b => Number.isFinite(Number(b?.diameterNm)) && Number.isFinite(Number(b?.deltaVolume)))
        .map(b => {
            const deltaVolume = Math.max(0, Number(b.deltaVolume));
            cumulative += deltaVolume;
            return {
                diameterNm: Number(b.diameterNm),
                deltaVolume,
                cumulativeVolume: Number.isFinite(Number(b.cumulativeVolume)) ? Number(b.cumulativeVolume) : cumulative,
                thicknessNm: Number.isFinite(Number(b.thicknessNm)) ? Number(b.thicknessNm) : 0,
                kelvinRadiusNm: Number.isFinite(Number(b.kelvinRadiusNm)) ? Number(b.kelvinRadiusNm) : 0
            };
        });
};

const computeSensitivityGrid = (ads: IsothermPoint[]): SensitivityCell[] => {
    const cells: SensitivityCell[] = [];
    for (let start = 0.03; start <= 0.19; start += 0.02) {
        for (let end = start + 0.10; end <= 0.41; end += 0.02) {
            const fitCandidates = ads.filter(p => p.x >= start && p.x <= end && p.x < 0.95);
            const transformed = fitCandidates
                .map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)) }))
                .filter(p => Number.isFinite(p.y) && p.y > 0);
            const fit = linearFit(transformed);
            if (!fit || fit.intercept <= 0 || fit.slope <= 0) continue;
            const vm = 1 / (fit.slope + fit.intercept);
            const ssa = vm * 4.354;
            cells.push({
                min: Number(start.toFixed(2)),
                max: Number(end.toFixed(2)),
                ssa: Number(ssa.toFixed(1)),
                r2: Number(fit.r2.toFixed(4))
            });
        }
    }
    return cells;
};

const analyzePorosity = (points: IsothermPoint[], fitRange: FitRange, bjhParams: BjhParams) => {
    const ads = points.filter(p => p.type === 'ads').sort((a, b) => a.x - b.x);
    const des = points.filter(p => p.type === 'des').sort((a, b) => a.x - b.x);
    if (ads.length < 5) return null;

    const fitCandidates = ads.filter(p => p.x >= fitRange.min && p.x <= fitRange.max && p.x < 0.95);
    const transformed = fitCandidates
        .map(p => ({ x: p.x, y: p.x / (p.y * (1 - p.x)) }))
        .filter(p => Number.isFinite(p.y) && p.y > 0);

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
        .map(p => {
            const y = p.x / (p.y * (1 - p.x));
            return { x: p.x, y, inFit: p.x >= fitRange.min && p.x <= fitRange.max };
        })
        .filter(p => Number.isFinite(p.y) && p.y > 0);
    const fitLine: BetLinearLine | null = fitCandidates.length >= 2
        ? {
            x1: fitRange.min,
            y1: fit.slope * fitRange.min + fit.intercept,
            x2: fitRange.max,
            y2: fit.slope * fitRange.max + fit.intercept
        }
        : null;

    const insight = `${type}，回滞环判定 ${hysteresisType}。BET 线性区 ${fitRange.min.toFixed(2)}-${fitRange.max.toFixed(2)} 下 R²=${fit.r2.toFixed(4)}，比表面积 ${ssa.toFixed(1)} m²/g。`;

    const result: PorosityResult = {
        ssa: Number(ssa.toFixed(1)),
        poreVolume: Number(poreVolume.toFixed(3)),
        avgPoreSize: Number(avgPoreSize.toFixed(2)),
        type,
        insight,
        betRange: fitRange,
        r2: Number(fit.r2.toFixed(4)),
        cConstant: Number(cConstant.toFixed(2)),
        vm: Number(vm.toFixed(3)),
        slope: Number(fit.slope.toFixed(6)),
        intercept: Number(fit.intercept.toFixed(6)),
        microporeRatio: Number(microporeRatio.toFixed(1)),
        psdPeakNm: psdPeak ? Number(psdPeak.diameterNm.toFixed(2)) : null,
        hysteresisType,
        classificationEvidence: {
            lowPressureSlope: Number((lowFit?.slope || 0).toFixed(3)),
            lowPressureWindow: [0.03, 0.10],
            hysteresisMidGap: Number((gaps === 'N/A' ? 0 : gaps.midGap).toFixed(3)),
            hysteresisHighGap: Number((gaps === 'N/A' ? 0 : gaps.highGap).toFixed(3)),
            rationale
        }
    };

    return { result, psdBins, betPlot: { points: betPlotPoints, line: fitLine } as BetLinearPlot, sensitivity };
};

// 模拟等温线数据生成器 (BET/Isotherm)
const generatePorosityMockData = (profile: 'mof' | 'cof' = 'cof') => {
    const mockPoints: IsothermPoint[] = [];
    const base = profile === 'mof' ? 35 : 50;
    const max = profile === 'mof' ? 780 : 460;
    const adsExponent = profile === 'mof' ? 0.22 : 0.32;
    const desBias = profile === 'mof' ? 32 : 14;

    for (let i = 0; i <= 35; i++) {
        const x = i / 35;
        const y = base + max * Math.pow(x, adsExponent) + Math.random() * 3;
        mockPoints.push({ x, y, type: 'ads' });
    }
    for (let i = 35; i >= 8; i--) {
        const x = i / 35;
        const y = base + desBias + (max * 0.98) * Math.pow(x, adsExponent - 0.03) + Math.random() * 3;
        mockPoints.push({ x, y, type: 'des' });
    }

    return mockPoints;
};

const PorosityAnalysisPanel: React.FC<Props> = ({ projects, onSave, onUpdateProject, selectedProjectId, traceRecordId, onBack }) => {
    const { showToast, updateDataAnalysisSession, navigate } = useProjectContext();
    const [result, setResult] = useState<PorosityResult | null>(null);
    const [isAnalysing, setIsAnalysing] = useState(false);
    const [rawPoints, setRawPoints] = useState<IsothermPoint[]>([]);
    const [fitRange, setFitRange] = useState<FitRange>(DEFAULT_FIT_RANGE);
    const [fitMode, setFitMode] = useState<FitMode>('auto');
    const [qcReport, setQcReport] = useState<PorosityQcReport | null>(null);
    const [psdBins, setPsdBins] = useState<PoreDistributionBin[]>([]);
    const [betLinearPlot, setBetLinearPlot] = useState<BetLinearPlot>({ points: [], line: null });
    const [bjhYAxisMode, setBjhYAxisMode] = useState<BjhYAxisMode>('deltaV');
    const [bjhParams, setBjhParams] = useState<BjhParams>({ thicknessModel: 'halsey', branchMode: 'des' });
    const [sensitivityGrid, setSensitivityGrid] = useState<SensitivityCell[]>([]);
    const [compareSampleIds, setCompareSampleIds] = useState<string[]>([]);
    const [comparePanelExpanded, setComparePanelExpanded] = useState(false);
    const [sampleContextLinks, setSampleContextLinks] = useState<Record<string, LinkedExperimentRef>>({});
    const [sampleContextInsights, setSampleContextInsights] = useState<Record<string, PorosityContextInsight>>({});
    const [isSampleAiAnalyzingId, setIsSampleAiAnalyzingId] = useState<string | null>(null);
    const [isBatchAiAnalyzing, setIsBatchAiAnalyzing] = useState(false);
    const [contextLinkTargetSampleId, setContextLinkTargetSampleId] = useState<string | null>(null);
    const [sourceFilename, setSourceFilename] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const reportAreaRef = useRef<HTMLDivElement>(null);
    const [showSyncModal, setShowSyncModal] = useState(false);

    // --- Library State ---
    const [savedRecords, setSavedRecords] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('sciflow_bet_library') || '[]'); } catch { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
    const [saveMilestoneId, setSaveMilestoneId] = useState('');
    const [saveLogId, setSaveLogId] = useState('');

    useEffect(() => {
        localStorage.setItem('sciflow_bet_library', JSON.stringify(savedRecords));
    }, [savedRecords]);

    const autoFitSuggestion = useMemo(() => recommendBetFitRange(rawPoints), [rawPoints]);
    const activeFitRange = useMemo<FitRange>(() => {
        if (fitMode === 'auto') {
            return autoFitSuggestion?.range || fitRange;
        }
        return fitRange;
    }, [fitMode, autoFitSuggestion, fitRange]);

    // Handle Trace Mode
    useEffect(() => {
        if (traceRecordId) {
            const record = savedRecords.find(r => r.id === traceRecordId);
            if (record) {
                handleLoadRecord(record);
                showToast({ message: `已溯源至历史分析: ${record.title}`, type: 'info' });
            } else {
                const mockPoints = generatePorosityMockData('cof');
                const assessed = cleanAndAssessPoints(mockPoints);
                setRawPoints(assessed.cleaned);
                setQcReport(assessed.qc);
                handleRunAnalysis();
                showToast({ message: "正在解构关联实验的孔隙特征与比表面积证据...", type: 'info' });
            }
        }
    }, [traceRecordId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const ext = file.name.split('.').pop()?.toLowerCase();
            const parsedPoints = (ext === 'xlsx' || ext === 'xls')
                ? parseXlsxFile(await file.arrayBuffer())
                : parseDelimitedText(await file.text());

            const assessed = cleanAndAssessPoints(parsedPoints);
            if (assessed.cleaned.length === 0) {
                showToast({ message: "未识别到有效等温线数据，请检查列名/单位", type: 'error' });
                return;
            }

            setRawPoints(assessed.cleaned);
            setQcReport(assessed.qc);
            setSourceFilename(file.name);
            setResult(null);
            setPsdBins([]);
            setBetLinearPlot({ points: [], line: null });
            setSensitivityGrid([]);
            setSampleContextInsights(prev => {
                const next = { ...prev };
                delete next.current;
                return next;
            });
            showToast({ message: `已解析 ${assessed.cleaned.length} 个有效数据点`, type: 'success' });
        } catch (err) {
            showToast({ message: "读取失败，请确认文件编码或格式", type: 'error' });
        }
    };

    const handleRunAnalysis = () => {
        if (rawPoints.length === 0) {
            showToast({ message: "请先上传等温线数据文件", type: 'info' });
            return;
        }
        if (activeFitRange.min >= activeFitRange.max) {
            showToast({ message: "BET 线性区无效：起点需小于终点", type: 'warning' });
            return;
        }
        setIsAnalysing(true);
        setTimeout(() => {
            const analyzed = analyzePorosity(rawPoints, activeFitRange, bjhParams);
            if (!analyzed) {
                setIsAnalysing(false);
                showToast({ message: "BET 拟合失败，请调整线性区或检查吸附支路", type: 'warning' });
                return;
            }

            setResult(analyzed.result);
            setPsdBins(analyzed.psdBins);
            setBetLinearPlot(analyzed.betPlot);
            setSensitivityGrid(analyzed.sensitivity);
            setIsAnalysing(false);
            showToast({ message: "BET/BJH 标准解算完成", type: 'success' });
        }, 600);
    };

    const handleExportPDF = async () => {
        if (!reportAreaRef.current) return;
        showToast({ message: '正在准备矢量级孔隙率分析报告...', type: 'info' });
        await printElement(reportAreaRef.current, saveTitle || 'Porosity_BET_Report');
    };

    const isothermPlot = useMemo(() => {
        const ads = rawPoints.filter(p => p.type === 'ads').sort((a, b) => a.x - b.x);
        const des = rawPoints.filter(p => p.type === 'des').sort((a, b) => a.x - b.x);
        if (!ads.length && !des.length) {
            return {
                adsPath: '',
                desPath: '',
                hysteresisPath: '',
                xTicks: [] as number[],
                yTicks: [] as number[],
                adsCoords: [] as Array<{ x: number; y: number }>,
                desCoords: [] as Array<{ x: number; y: number }>,
                toXY: (x: number, y: number) => ({ x, y }),
                bounds: { left: 10, right: 4, top: 5, bottom: 12, plotW: 86, plotH: 83, xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
            };
        }
        const all = [...ads, ...des];
        const xMin = 0;
        const xMax = 1;
        const yMaxRaw = Math.max(...all.map(p => p.y));
        const left = 10;
        const right = 4;
        const top = 10; // reserve top band for compact legend
        const bottom = 12;
        const plotW = 100 - left - right;
        const plotH = 100 - top - bottom;
        const yMinRaw = Math.min(...all.map(p => p.y));
        const ySpanRaw = Math.max(1e-6, yMaxRaw - yMinRaw);
        const yMin = Math.max(0, yMinRaw - ySpanRaw * 0.08);
        const yMax = yMaxRaw + ySpanRaw * 0.08;
        const toXY = (x: number, y: number) => ({
            x: left + ((x - xMin) / (xMax - xMin)) * plotW,
            y: top + (1 - (y - yMin) / Math.max(1e-9, yMax - yMin)) * plotH
        });
        const toPath = (pts: IsothermPoint[]) => pts.map((p, i) => {
            const xy = toXY(p.x, p.y);
            return `${i === 0 ? 'M' : 'L'} ${xy.x} ${xy.y}`;
        }).join(' ');
        const adsCoords = ads.map(p => toXY(p.x, p.y));
        const desCoords = des.map(p => toXY(p.x, p.y));
        const hysteresisPath = adsCoords.length > 2 && desCoords.length > 2
            ? `${adsCoords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} ${[...desCoords].reverse().map(p => `L ${p.x} ${p.y}`).join(' ')} Z`
            : '';
        const yTicks = buildNiceTicks(yMin, yMax, 5);
        return {
            adsPath: toPath(ads),
            desPath: toPath(des),
            hysteresisPath,
            adsCoords,
            desCoords,
            xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
            yTicks,
            toXY,
            bounds: { left, right, top, bottom, plotW, plotH, xMin, xMax, yMin, yMax }
        };
    }, [rawPoints]);

    const betPlotGeometry = useMemo(() => {
        const points = betLinearPlot.points;
        if (points.length === 0) return { dots: [] as Array<{ cx: number; cy: number; inFit: boolean }>, line: null as { x1: number; y1: number; x2: number; y2: number } | null };
        const xMin = Math.min(...points.map(p => p.x));
        const xMax = Math.max(...points.map(p => p.x));
        const yMin = Math.min(...points.map(p => p.y));
        const yMax = Math.max(...points.map(p => p.y));
        const xSpan = Math.max(1e-9, xMax - xMin);
        const ySpan = Math.max(1e-9, yMax - yMin);
        const toXY = (x: number, y: number) => ({
            x: 8 + ((x - xMin) / xSpan) * 84,
            y: 92 - ((y - yMin) / ySpan) * 84
        });
        const dots = points.map(p => {
            const xy = toXY(p.x, p.y);
            return { cx: xy.x, cy: xy.y, inFit: p.inFit };
        });
        const line = betLinearPlot.line
            ? (() => {
                const p1 = toXY(betLinearPlot.line.x1, betLinearPlot.line.y1);
                const p2 = toXY(betLinearPlot.line.x2, betLinearPlot.line.y2);
                return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
            })()
            : null;
        return { dots, line };
    }, [betLinearPlot]);

    const bjhCumulativePath = useMemo(() => {
        if (psdBins.length < 2) return '';
        const xMin = Math.min(...psdBins.map(b => b.diameterNm));
        const xMax = Math.max(...psdBins.map(b => b.diameterNm));
        const yMax = Math.max(...psdBins.map(b => b.cumulativeVolume));
        const xSpan = Math.max(1e-9, xMax - xMin);
        const ySpan = Math.max(1e-9, yMax);
        return psdBins
            .map((b, i) => {
                const x = 5 + ((b.diameterNm - xMin) / xSpan) * 90;
                const y = 95 - (b.cumulativeVolume / ySpan) * 80;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');
    }, [psdBins]);

    const bjhBars = useMemo(() => {
        if (psdBins.length === 0) return [] as Array<{ diameterNm: number; value: number }>;
        const bins = [...psdBins].sort((a, b) => a.diameterNm - b.diameterNm);
        if (bjhYAxisMode === 'deltaV') {
            return bins.map(b => ({ diameterNm: b.diameterNm, value: b.deltaVolume }));
        }
        return bins.map((b, i) => {
            const curr = Math.max(1e-9, b.diameterNm);
            const prev = i > 0 ? Math.max(1e-9, bins[i - 1].diameterNm) : curr / 1.15;
            const next = i < bins.length - 1 ? Math.max(1e-9, bins[i + 1].diameterNm) : curr * 1.15;
            const lower = Math.sqrt(prev * curr);
            const upper = Math.sqrt(curr * next);
            const dlog = Math.log10(upper) - Math.log10(lower);
            const value = dlog > 1e-12 ? b.deltaVolume / dlog : 0;
            return { diameterNm: b.diameterNm, value: Math.max(0, value) };
        });
    }, [psdBins, bjhYAxisMode]);

    const handleClearWorkspace = () => {
        if (rawPoints.length === 0 && !result) return;
        if (!confirm('确定要清空 BET 工作区吗？未归档的拟合数据将会丢失。')) return;
        setRawPoints([]);
        setQcReport(null);
        setResult(null);
        setPsdBins([]);
        setBetLinearPlot({ points: [], line: null });
        setSensitivityGrid([]);
        setSourceFilename('');
        setFitRange(DEFAULT_FIT_RANGE);
        setFitMode('auto');
        setCompareSampleIds([]);
        setSampleContextLinks(prev => {
            const next = { ...prev };
            delete next.current;
            return next;
        });
        setSampleContextInsights(prev => {
            const next = { ...prev };
            delete next.current;
            return next;
        });
        setCurrentRecordId(null);
        showToast({ message: 'BET 工作区已清空', type: 'info' });
    };

    // --- Library Actions ---
    const handleSaveRecord = () => {
        if (!saveTitle.trim()) return;
        const recordId = currentRecordId || Date.now().toString();
        const existing = savedRecords.find(r => r.id === recordId);
        const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
        const record = {
            id: recordId,
            title: saveTitle,
            projectId: selectedProjectId,
            timestamp: new Date().toLocaleString(),
            folder: existing?.folder || fallbackFolder,
            data: { rawPoints, result, qcReport, fitRange, fitMode, psdBins, betLinearPlot, sensitivityGrid, bjhParams, linkedContext: sampleContextLinks.current || null, sourceFilename }
        };
        setSavedRecords(prev => {
            const exists = prev.some(r => r.id === recordId);
            if (exists) return prev.map(r => r.id === recordId ? record : r);
            return [record, ...prev];
        });
        setCurrentRecordId(recordId);
        setShowSaveModal(false);
        setSaveTitle('');
        setSaveMilestoneId('');
        setSaveLogId('');
        showToast({ message: currentRecordId ? 'BET 分析结果已覆盖更新' : 'BET 分析结果已归档', type: 'success' });
    };

    // 快速保存：已有记录直接覆盖，没有则弹窗新建
    const handleQuickSave = () => {
        if (currentRecordId) {
            const existing = savedRecords.find(r => r.id === currentRecordId);
            if (existing) {
                const fallbackFolder = buildArchiveFolderMeta(projects, selectedProjectId, saveMilestoneId || undefined, saveLogId || undefined);
                const record = {
                    id: currentRecordId,
                    title: existing.title,
                    projectId: selectedProjectId,
                    timestamp: new Date().toLocaleString(),
                    folder: existing?.folder || fallbackFolder,
                    data: { rawPoints, result, qcReport, fitRange, fitMode, psdBins, betLinearPlot, sensitivityGrid, bjhParams, linkedContext: sampleContextLinks.current || null, sourceFilename }
                };
                setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? record : r));
                showToast({ message: 'BET 分析结果已覆盖更新', type: 'success' });
                return;
            }
        }
        setSaveTitle(`Isotherm_${new Date().toLocaleDateString()}`);
        { const a = getAutoSelections(projects, selectedProjectId); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveModal(true); }
    };

    // 另存为：始终创建新记录
    const handleSaveAs = () => {
        setCurrentRecordId(null);
        setSaveTitle('');
        { const a = getAutoSelections(projects, selectedProjectId); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveModal(true); }
    };

    const handleLoadRecord = (record: any) => {
        const loadedPoints = (record?.data?.rawPoints || []) as IsothermPoint[];
        const assessed = cleanAndAssessPoints(loadedPoints);
        setRawPoints(assessed.cleaned);
        setQcReport(record?.data?.qcReport || assessed.qc);
        setResult(record?.data?.result || null);
        setFitRange(record?.data?.fitRange || DEFAULT_FIT_RANGE);
        setFitMode(record?.data?.fitMode || 'auto');
        setPsdBins(normalizePsdBins(record?.data?.psdBins || []));
        setBetLinearPlot(record?.data?.betLinearPlot || { points: [], line: null });
        setSensitivityGrid(Array.isArray(record?.data?.sensitivityGrid) ? record.data.sensitivityGrid : []);
        setBjhParams(record?.data?.bjhParams || { thicknessModel: 'halsey', branchMode: 'des' });
        if (record?.data?.linkedContext) {
            setSampleContextLinks(prev => ({ ...prev, current: record.data.linkedContext }));
        } else {
            setSampleContextLinks(prev => {
                const next = { ...prev };
                delete next.current;
                return next;
            });
        }
        setSourceFilename(record?.data?.sourceFilename || '');
        setCurrentRecordId(record.id);
        setShowLibrary(false);
    };

    const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedRecords(prev => prev.filter(r => r.id !== id));
    };

    const toggleCompareSample = (id: string) => {
        setCompareSampleIds(prev => {
            if (prev.includes(id)) return prev.filter(v => v !== id);
            if (prev.length >= 6) {
                showToast({ message: '同屏对比最多选择 6 组样品', type: 'warning' });
                return prev;
            }
            return [...prev, id];
        });
    };

    const handleLoadFullFeatureDemo = () => {
        const currentPointsRaw = generatePorosityMockData('cof');
        const currentAssessed = cleanAndAssessPoints(currentPointsRaw);
        const currentBjh: BjhParams = { thicknessModel: 'halsey', branchMode: 'des' };
        const currentFit: FitRange = { min: 0.06, max: 0.28 };
        const currentAnalyzed = analyzePorosity(currentAssessed.cleaned, currentFit, currentBjh);
        if (!currentAnalyzed) {
            showToast({ message: '示例生成失败，请重试', type: 'error' });
            return;
        }

        setRawPoints(currentAssessed.cleaned);
        setQcReport(currentAssessed.qc);
        setResult(currentAnalyzed.result);
        setPsdBins(currentAnalyzed.psdBins);
        setBetLinearPlot(currentAnalyzed.betPlot);
        setSensitivityGrid(currentAnalyzed.sensitivity);
        setFitMode('manual');
        setFitRange(currentFit);
        setBjhParams(currentBjh);
        setBjhYAxisMode('dVdLogD');
        setSourceFilename('Demo-Full-Feature');

        const demoCfgs: Array<{ profile: 'mof' | 'cof'; fit: FitRange; bjh: BjhParams; title: string }> = [
            { profile: 'mof', fit: { min: 0.05, max: 0.25 }, bjh: { thicknessModel: 'harkins-jura', branchMode: 'des' }, title: 'DEMO_MOF_HJ_DES' },
            { profile: 'cof', fit: { min: 0.08, max: 0.30 }, bjh: { thicknessModel: 'halsey', branchMode: 'ads' }, title: 'DEMO_COF_HA_ADS' }
        ];

        const demoRecords = demoCfgs.map((cfg, idx) => {
            const pts = cleanAndAssessPoints(generatePorosityMockData(cfg.profile)).cleaned;
            const analyzed = analyzePorosity(pts, cfg.fit, cfg.bjh);
            if (!analyzed) return null;
            return {
                id: `demo-feature-${Date.now()}-${idx}`,
                title: cfg.title,
                projectId: selectedProjectId,
                timestamp: new Date().toLocaleString(),
                data: {
                    rawPoints: pts,
                    result: analyzed.result,
                    qcReport: cleanAndAssessPoints(pts).qc,
                    fitRange: cfg.fit,
                    fitMode: 'manual',
                    psdBins: analyzed.psdBins,
                    betLinearPlot: analyzed.betPlot,
                    sensitivityGrid: analyzed.sensitivity,
                    bjhParams: cfg.bjh,
                    sourceFilename: `Demo-${cfg.profile.toUpperCase()}`
                }
            };
        }).filter(Boolean) as any[];

        setSavedRecords(prev => [...demoRecords, ...prev]);
        setTimeout(() => {
            const ids = ['current', ...demoRecords.map(r => `record:${r.id}`)].slice(0, 6);
            setCompareSampleIds(ids);
        }, 0);

        const allLogs = projects.flatMap(p => p.milestones.flatMap(m => m.logs.map(l => ({ projectId: p.id, milestoneId: m.id, logId: l.id }))));
        if (allLogs.length > 0) {
            const links: Record<string, LinkedExperimentRef> = {};
            links.current = allLogs[0];
            demoRecords.forEach((r, i) => {
                const candidate = allLogs[(i + 1) % allLogs.length];
                links[`record:${r.id}`] = candidate;
            });
            setSampleContextLinks(prev => ({ ...prev, ...links }));
        }

        setSampleContextInsights(prev => ({
            ...prev,
            current: {
                summary: '示例：该样品呈中孔主导结构，BET 拟合质量较高，适合作为对比基准。',
                keyFindings: [
                    'SSA 与孔容处于可比较区间',
                    '回滞环表明毛细凝聚显著'
                ],
                mechanismHints: [],
                riskFlags: [],
                nextActions: [],
                publicationSentence: ''
            }
        }));

        showToast({ message: '全功能示例已加载：对比/敏感性/BJH参数/样品关联已就绪', type: 'success' });
    };

    const resolveExperimentLog = (ref: LinkedExperimentRef): { projectTitle: string; log: ExperimentLog } | null => {
        const project = projects.find(p => p.id === ref.projectId);
        const milestone = project?.milestones.find(m => m.id === ref.milestoneId);
        const log = milestone?.logs.find(l => l.id === ref.logId);
        if (!project || !log) return null;
        return { projectTitle: project.title, log };
    };

    const findLatestExperimentRef = (): LinkedExperimentRef | null => {
        const scopedProjects = selectedProjectId
            ? projects.filter(p => p.id === selectedProjectId)
            : projects;
        let best: { ref: LinkedExperimentRef; score: number } | null = null;
        for (const project of scopedProjects) {
            for (let mi = 0; mi < project.milestones.length; mi++) {
                const milestone = project.milestones[mi];
                for (let li = 0; li < milestone.logs.length; li++) {
                    const log = milestone.logs[li];
                    const parsed = Date.parse(log.timestamp || '');
                    const score = Number.isFinite(parsed) ? parsed : (mi + 1) * 1e6 + li;
                    const ref = { projectId: project.id, milestoneId: milestone.id, logId: log.id };
                    if (!best || score > best.score) best = { ref, score };
                }
            }
        }
        return best ? best.ref : null;
    };

    const linkSampleToRecord = (sampleId: string, ref: LinkedExperimentRef) => {
        setSampleContextLinks(prev => ({ ...prev, [sampleId]: ref }));
        if (sampleId.startsWith('record:')) {
            const recordId = sampleId.replace('record:', '');
            setSavedRecords(prev => prev.map(r => r.id === recordId ? ({ ...r, data: { ...r.data, linkedContext: ref } }) : r));
        }
    };

    const handleSampleLinkConfirm = (projectId: string, milestoneId: string, logId: string) => {
        if (!contextLinkTargetSampleId) return;
        const ref: LinkedExperimentRef = { projectId, milestoneId, logId };
        const sampleId = contextLinkTargetSampleId;
        linkSampleToRecord(sampleId, ref);
        setContextLinkTargetSampleId(null);
        showToast({ message: '已为该样品关联实验记录', type: 'success' });
    };

    const handleAutoLinkLatestRecord = (sampleId: string) => {
        const ref = findLatestExperimentRef();
        if (!ref) {
            showToast({ message: '未找到可关联的实验记录', type: 'warning' });
            return;
        }
        linkSampleToRecord(sampleId, ref);
        showToast({ message: '已自动关联最新实验记录', type: 'success' });
    };

    const handleSampleContextAiAnalysis = async (sample: CompareSampleItem) => {
        const link = sampleContextLinks[sample.id];
        if (!link) {
            showToast({ message: '请先为该样品关联实验记录', type: 'warning' });
            return;
        }
        const resolved = resolveExperimentLog(link);
        if (!resolved) {
            showToast({ message: '关联记录不存在或已被删除', type: 'error' });
            return;
        }
        try {
            setIsSampleAiAnalyzingId(sample.id);
            const ai = await generateContextualPorosityAnalysis(
                resolved.projectTitle,
                {
                    content: resolved.log.content,
                    description: resolved.log.description,
                    parameters: resolved.log.parameters,
                    scientificData: resolved.log.scientificData || {}
                },
                {
                    sampleName: sample.title,
                    ssa: sample.result.ssa,
                    poreVolume: sample.result.poreVolume,
                    avgPoreSize: sample.result.avgPoreSize,
                    cConstant: sample.result.cConstant,
                    r2: sample.result.r2,
                    iupacType: sample.result.type,
                    hysteresisType: sample.result.hysteresisType,
                    psdPeakNm: sample.result.psdPeakNm,
                    fitRange: sample.result.betRange,
                    bjhParams: sample.bjhParams || bjhParams
                }
            );
            setSampleContextInsights(prev => ({ ...prev, [sample.id]: ai }));
            showToast({ message: `已完成样品「${sample.title}」的上下文 AI 分析`, type: 'success' });
        } catch (error) {
            showToast({ message: 'AI 分析失败，请稍后重试', type: 'error' });
        } finally {
            setIsSampleAiAnalyzingId(null);
        }
    };

    const handleBatchContextAiAnalysis = async () => {
        const latestRef = findLatestExperimentRef();
        const preparedSamples = selectedCompareSamples
            .map(sample => {
                const link = sampleContextLinks[sample.id] || latestRef;
                if (!sampleContextLinks[sample.id] && link) {
                    linkSampleToRecord(sample.id, link);
                }
                return link ? { sample, link } : null;
            })
            .filter((v): v is { sample: CompareSampleItem; link: LinkedExperimentRef } => Boolean(v));
        if (preparedSamples.length === 0) {
            showToast({ message: '未找到可用于分析的实验记录', type: 'warning' });
            return;
        }
        try {
            setIsBatchAiAnalyzing(true);
            let successCount = 0;
            for (const { sample, link } of preparedSamples) {
                const resolved = resolveExperimentLog(link);
                if (!resolved) continue;
                try {
                    const ai = await generateContextualPorosityAnalysis(
                        resolved.projectTitle,
                        {
                            content: resolved.log.content,
                            description: resolved.log.description,
                            parameters: resolved.log.parameters,
                            scientificData: resolved.log.scientificData || {}
                        },
                        {
                            sampleName: sample.title,
                            ssa: sample.result.ssa,
                            poreVolume: sample.result.poreVolume,
                            avgPoreSize: sample.result.avgPoreSize,
                            cConstant: sample.result.cConstant,
                            r2: sample.result.r2,
                            iupacType: sample.result.type,
                            hysteresisType: sample.result.hysteresisType,
                            psdPeakNm: sample.result.psdPeakNm,
                            fitRange: sample.result.betRange,
                            bjhParams: sample.bjhParams || bjhParams
                        }
                    );
                    setSampleContextInsights(prev => ({ ...prev, [sample.id]: ai }));
                    successCount += 1;
                } catch {
                    // Skip failed sample and continue batch processing
                }
            }
            showToast({
                message: `批量分析完成：成功 ${successCount} / ${preparedSamples.length}`,
                type: successCount > 0 ? 'success' : 'warning'
            });
        } finally {
            setIsBatchAiAnalyzing(false);
        }
    };

    const handleSyncConfirm = (targetProjectId: string, targetMilestoneId: string, targetLogId: string) => {
        if (!currentRecordId || !onUpdateProject) return;
        const project = projects.find(p => p.id === targetProjectId);
        if (!project) return;

        const currentRecord = savedRecords.find(r => r.id === currentRecordId);
        const title = currentRecord ? currentRecord.title : `BET Analysis ${new Date().toLocaleDateString()}`;

        const updatedMilestones = project.milestones.map(m => {
            if (m.id === targetMilestoneId) {
                const updatedLogs = m.logs.map(l => {
                    if (l.id === targetLogId) {
                        return {
                            ...l,
                            linkedAnalysis: {
                                id: currentRecordId,
                                type: 'porosity' as const,
                                title: title
                            }
                        };
                    }
                    return l;
                });
                return { ...m, logs: updatedLogs };
            }
            return m;
        });

        onUpdateProject({ ...project, milestones: updatedMilestones });
        setShowSyncModal(false);
        showToast({ message: '已创建溯源链接至实验记录', type: 'success' });
    };

    const handleSaveToLog = (projectId: string, milestoneId: string, logId: string) => {
        if (!result) return;
        const chartData = psdBins
            .map((b) => ({ x: Number(b.diameterNm), y: Number(b.deltaVolume) }))
            .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
        const folder = buildArchiveFolderMeta(projects, projectId, milestoneId, logId);
        if (currentRecordId) {
            setSavedRecords(prev => prev.map(r => r.id === currentRecordId ? { ...r, folder } : r));
        }
        const linkTitle = savedRecords.find(r => r.id === currentRecordId)?.title || `BET Analysis ${new Date().toLocaleDateString()}`;
        onSave(projectId, milestoneId, logId, {
            mode: 'POROSITY',
            aiConclusion: sampleContextInsights.current?.summary || result.insight || 'BET/BJH 分析已同步。',
            chartData,
            ssa: result.ssa,
            poreVolume: result.poreVolume,
            avgPoreSize: result.avgPoreSize,
            cConstant: result.cConstant,
            r2: result.r2,
            microporeRatio: result.microporeRatio,
            psdPeakNm: result.psdPeakNm || 0,
            linkedAnalysisMeta: currentRecordId ? { id: currentRecordId, type: 'porosity', title: linkTitle } : undefined
        });
    };

    const handlePushToDataLab = () => {
        const chartData = psdBins.map((b) => ({ x: Number(b.diameterNm), y: Number(b.deltaVolume || 0) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (chartData.length === 0) {
            showToast({ message: '当前暂无可推送的 BET/BJH 图表数据', type: 'info' });
            return;
        }
        const xValues = chartData.map(p => p.x);
        const yValues = chartData.map(p => p.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const xDomain: [number, number] = minX === maxX ? [minX - 1, maxX + 1] : [minX, maxX];
        const yDomain: [number, number] = minY === maxY ? [minY - 1, maxY + 1] : [minY, maxY];
        updateDataAnalysisSession({
            activeTab: 'chart',
            chartType: 'bar',
            chartTitle: `${sourceFilename || 'BET/BJH'} 孔径分布`,
            xAxisLabel: 'Pore Diameter (nm)',
            yAxisLabel: 'Delta Volume',
            xDomain,
            yDomain,
            seriesList: [{
                id: `porosity_push_${Date.now()}`,
                name: 'PSD 原始数据',
                data: chartData.map(p => ({ name: String(p.x), value: p.y, error: 0 })),
                color: '#0ea5e9',
                pointColor: '#0ea5e9',
                strokeWidth: 2,
                pointShape: 'circle',
                pointSize: 4,
                visible: true
            }]
        });
        navigate('data');
        showToast({ message: '已推送到实验数据分析室，可直接继续美化', type: 'success' });
    };

    const filteredRecords = savedRecords.filter(r => !selectedProjectId || !r.projectId || r.projectId === selectedProjectId);
    const compareCandidates = useMemo<CompareSampleItem[]>(() => {
        const fromSaved = filteredRecords
            .filter(r => r?.data?.result)
            .map(r => ({
                id: `record:${r.id}`,
                title: r.title,
                result: r.data.result as PorosityResult,
                betPlot: (r.data.betLinearPlot || { points: [], line: null }) as BetLinearPlot,
                psdBins: normalizePsdBins(r.data.psdBins || []),
                linkedContext: r.data.linkedContext || null,
                recordId: r.id,
                bjhParams: r.data.bjhParams || { thicknessModel: 'halsey', branchMode: 'des' }
            }));
        const current = result ? [{
            id: 'current',
            title: sourceFilename || '当前工作区',
            result,
            betPlot: betLinearPlot,
            psdBins,
            linkedContext: sampleContextLinks.current || null,
            bjhParams
        }] : [];
        return [...current, ...fromSaved].slice(0, 30);
    }, [filteredRecords, result, sourceFilename, betLinearPlot, psdBins, sampleContextLinks.current, bjhParams]);

    useEffect(() => {
        if (!compareCandidates.length) return;
        setSampleContextLinks(prev => {
            let changed = false;
            const next = { ...prev };
            for (const item of compareCandidates) {
                if (!next[item.id] && item.linkedContext) {
                    next[item.id] = item.linkedContext;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compareCandidates.length]);

    const selectedCompareSamples = useMemo(
        () => compareCandidates.filter(c => compareSampleIds.includes(c.id)).slice(0, 6),
        [compareCandidates, compareSampleIds]
    );

    const overlayBetLines = useMemo(() => {
        const lines = selectedCompareSamples
            .map(s => ({ id: s.id, title: s.title, line: s.betPlot.line }))
            .filter(s => Boolean(s.line)) as Array<{ id: string; title: string; line: BetLinearLine }>;
        if (!lines.length) return { lines: [], xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
        const xMin = Math.min(...lines.map(l => Math.min(l.line.x1, l.line.x2)));
        const xMax = Math.max(...lines.map(l => Math.max(l.line.x1, l.line.x2)));
        const yMin = Math.min(...lines.map(l => Math.min(l.line.y1, l.line.y2)));
        const yMax = Math.max(...lines.map(l => Math.max(l.line.y1, l.line.y2)));
        return { lines, xMin, xMax, yMin, yMax };
    }, [selectedCompareSamples]);

    const repeatability = useMemo(() => {
        const metrics = selectedCompareSamples.map(s => ({
            id: s.id,
            title: s.title,
            ssa: s.result.ssa,
            c: s.result.cConstant,
            vt: s.result.poreVolume,
            peak: s.result.psdPeakNm || 0
        }));
        if (metrics.length < 2) return null;
        const stat = (arr: number[]) => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            const sd = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, arr.length - 1));
            const rsd = mean !== 0 ? (sd / mean) * 100 : 0;
            return { mean, sd, rsd };
        };
        const ssaStat = stat(metrics.map(m => m.ssa));
        const cStat = stat(metrics.map(m => m.c));
        const vtStat = stat(metrics.map(m => m.vt));
        const peakStat = stat(metrics.map(m => m.peak));
        const outliers = metrics
            .filter(m => ssaStat.sd > 0 && Math.abs((m.ssa - ssaStat.mean) / ssaStat.sd) > 2)
            .map(m => m.title);
        return { ssaStat, cStat, vtStat, peakStat, outliers };
    }, [selectedCompareSamples]);

    const sensitivityHeatmap = useMemo(() => {
        if (!sensitivityGrid.length) return { cells: [] as Array<SensitivityCell & { color: string }>, r2Min: 0, r2Max: 1 };
        const r2Min = Math.min(...sensitivityGrid.map(c => c.r2));
        const r2Max = Math.max(...sensitivityGrid.map(c => c.r2));
        const span = Math.max(1e-6, r2Max - r2Min);
        const cells = sensitivityGrid.map(c => {
            const t = (c.r2 - r2Min) / span;
            const color = `rgba(15, 23, 42, ${0.2 + 0.75 * t})`;
            return { ...c, color };
        });
        return { cells, r2Min, r2Max };
    }, [sensitivityGrid]);

    return (
        <div className="h-full flex flex-col p-6 gap-6 animate-reveal relative overflow-hidden">
            <div className="flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    {traceRecordId && (
                        <button
                            onClick={onBack}
                            className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-arrow-left"></i> 返回
                        </button>
                    )}
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">BET 比表面积与孔径分析</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">N2 Adsorption-Desorption Isotherm Processor</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {/* 数据操作组 */}
                    <button
                        onClick={handleLoadFullFeatureDemo}
                        className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase hover:bg-amber-100 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-flask-vial mr-1"></i> 加载示例
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.csv,.xlsx" onChange={handleFileUpload} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-upload mr-1"></i> 导入数据
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 记录管理组 */}
                    <div className="relative">
                        <div className="flex items-stretch">
                            <button
                                onClick={handleQuickSave}
                                disabled={rawPoints.length === 0}
                                className="px-4 py-2 bg-white border border-r-0 border-slate-200 text-slate-600 rounded-l-xl text-[10px] font-black uppercase hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95 disabled:opacity-40"
                            >
                                <i className="fa-solid fa-floppy-disk mr-1"></i> 保存
                            </button>
                            <button
                                onClick={() => setShowSaveDropdown(!showSaveDropdown)}
                                disabled={rawPoints.length === 0}
                                className="px-1.5 py-2 bg-white border border-slate-200 text-slate-400 rounded-r-xl text-[10px] hover:text-indigo-600 hover:border-indigo-400 transition-all active:scale-95 disabled:opacity-40"
                            >
                                <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveDropdown ? 'rotate-180' : ''}`}></i>
                            </button>
                        </div>
                        {showSaveDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 min-w-[120px]">
                                <button onClick={() => { handleQuickSave(); setShowSaveDropdown(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2">
                                    <i className="fa-solid fa-floppy-disk text-[10px]"></i> 保存
                                </button>
                                <button onClick={() => { handleSaveAs(); setShowSaveDropdown(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-600 transition-all flex items-center gap-2">
                                    <i className="fa-solid fa-copy text-[10px]"></i> 另存为
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setShowLibrary(true)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all active:scale-95"
                    >
                        <i className="fa-solid fa-box-archive mr-1"></i> 方案库 ({filteredRecords.length})
                    </button>
                    <button
                        onClick={handlePushToDataLab}
                        disabled={!result || psdBins.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                        title="无需同步，直接推送到实验数据分析室"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 推送数据分析室
                    </button>
                    <button
                        onClick={() => {
                            if (!currentRecordId || !result) {
                                showToast({ message: '请先完成分析并保存方案，再同步到实验记录', type: 'info' });
                                return;
                            }
                            setShowSyncModal(true);
                        }}
                        disabled={!currentRecordId || !result}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-700 transition-all shadow-md active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                        title={currentRecordId ? '同步到实验记录' : '先保存方案后可同步'}
                    >
                        <i className="fa-solid fa-link"></i> 同步
                    </button>
                    <button
                        onClick={() => setContextLinkTargetSampleId('current')}
                        className="px-4 py-2 bg-white border border-slate-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-paperclip"></i> 关联记录
                    </button>

                    <div className="w-px h-7 bg-slate-200 mx-1"></div>

                    {/* 清空 + 主操作 */}
                    <button
                        onClick={handleClearWorkspace}
                        disabled={rawPoints.length === 0 && !result}
                        className="px-4 py-2 bg-white border border-slate-200 text-rose-500 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-40"
                        title="清空工作间"
                    >
                        <i className="fa-solid fa-trash-can mr-1"></i> 清空
                    </button>
                    <button
                        onClick={handleRunAnalysis}
                        disabled={isAnalysing || rawPoints.length === 0}
                        className="px-8 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isAnalysing ? <i className="fa-solid fa-circle-notch animate-spin mr-2"></i> : <i className="fa-solid fa-calculator mr-2"></i>}
                        BET/BJH 解算
                    </button>
                </div>
            </div>

            <div ref={reportAreaRef} className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-auto is-printing-target">
                <div className="col-span-12 lg:col-span-7 min-w-0 bg-slate-50 rounded-[2rem] border border-slate-200 p-6 flex flex-col shadow-inner relative group">
                    <div className="bg-white border border-slate-200 rounded-xl relative p-2" style={{ aspectRatio: '4 / 3' }}>
                        {rawPoints.length > 0 ? (
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                {isothermPlot.yTicks.map((v, i) => {
                                    const y = isothermPlot.toXY(0, v).y;
                                    return <line key={`gy-${i}`} x1={10} y1={y} x2={96} y2={y} stroke="#e2e8f0" strokeWidth="0.26" />;
                                })}
                                {isothermPlot.xTicks.map((v, i) => {
                                    const x = isothermPlot.toXY(v, 0).x;
                                    return <line key={`gx-${i}`} x1={x} y1={10} x2={x} y2={88} stroke="#f1f5f9" strokeWidth="0.24" />;
                                })}
                                {isothermPlot.hysteresisPath && (
                                    <path d={isothermPlot.hysteresisPath} fill="#64748b" fillOpacity="0.05" stroke="none" />
                                )}
                                <line x1={10} y1={88} x2={96} y2={88} stroke="#334155" strokeWidth="0.55" />
                                <line x1={10} y1={10} x2={10} y2={88} stroke="#334155" strokeWidth="0.55" />
                                <path d={isothermPlot.adsPath} fill="none" stroke="#0f172a" strokeWidth="0.95" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700" />
                                <path d={isothermPlot.desPath} fill="none" stroke="#475569" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 1.5" className="transition-all duration-700" />
                                {isothermPlot.adsCoords.filter((_, i) => i % 6 === 0).map((p, i) => (
                                    <circle key={`ap-${i}`} cx={p.x} cy={p.y} r="0.3" fill="#0f172a" />
                                ))}
                                {isothermPlot.desCoords.filter((_, i) => i % 6 === 0).map((p, i) => (
                                    <circle key={`dp-${i}`} cx={p.x} cy={p.y} r="0.28" fill="#475569" />
                                ))}
                                {isothermPlot.xTicks.map((v, i) => {
                                    const x = isothermPlot.toXY(v, 0).x;
                                    return <text key={`tx-${i}`} x={x} y={94} textAnchor="middle" fontSize="2.25" fill="#64748b">{v.toFixed(1)}</text>;
                                })}
                                {isothermPlot.yTicks.map((v, i) => {
                                    const y = isothermPlot.toXY(0, v).y;
                                    return <text key={`ty-${i}`} x={8.4} y={y + 0.7} textAnchor="end" fontSize="2.15" fill="#64748b">{v.toFixed(0)}</text>;
                                })}
                                <text x={53} y={98} textAnchor="middle" fontSize="2.4" fill="#475569">Relative Pressure (P/P0)</text>
                                <text x={2.8} y={49} transform="rotate(-90 2.8 49)" textAnchor="middle" fontSize="2.4" fill="#475569">N2 Uptake (cm3 g-1 STP)</text>
                                <rect x={11} y={4.6} width="33.5" height="5.2" rx="0.9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.35" />
                                <line x1={12.6} y1={7.2} x2={16.7} y2={7.2} stroke="#0f172a" strokeWidth="0.95" />
                                <text x={17.8} y={7.9} fontSize="2.1" fill="#475569">Ads</text>
                                <line x1={22.4} y1={7.2} x2={26.5} y2={7.2} stroke="#475569" strokeDasharray="2 1.5" strokeWidth="0.95" />
                                <text x={27.6} y={7.9} fontSize="2.1" fill="#475569">Des</text>
                                <text x={35.8} y={7.9} fontSize="2.05" fill="#64748b">77 K</text>
                            </svg>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                                <i className="fa-solid fa-braille text-6xl mb-4"></i>
                                <p className="text-[10px] font-black uppercase tracking-[0.4rem]">Awaiting Isotherm Data</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
                        <div className="bg-white border border-slate-200 rounded-2xl p-3">
                            <div className="text-[9px] font-black text-slate-500 uppercase mb-2">BET 拟合区间模式</div>
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={() => setFitMode('auto')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${fitMode === 'auto' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    自动推荐
                                </button>
                                <button
                                    onClick={() => setFitMode('manual')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${fitMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    手动微调
                                </button>
                            </div>
                            <div className="text-[10px] text-slate-600 mb-2">
                                当前区间: {activeFitRange.min.toFixed(2)} - {activeFitRange.max.toFixed(2)}
                            </div>
                            {fitMode === 'auto' && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-2 mb-2">
                                    <div className="text-[10px] text-indigo-700">
                                        推荐: {autoFitSuggestion ? `${autoFitSuggestion.range.min.toFixed(2)} - ${autoFitSuggestion.range.max.toFixed(2)}` : '暂无稳定推荐，回退手动区间'}
                                    </div>
                                    {autoFitSuggestion && (
                                        <div className="text-[9px] text-indigo-500 mt-1">R²={autoFitSuggestion.r2.toFixed(4)}，点数={autoFitSuggestion.count}</div>
                                    )}
                                </div>
                            )}
                            {fitMode === 'manual' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0.01"
                                            max="0.95"
                                            step="0.01"
                                            value={fitRange.min}
                                            onChange={(e) => setFitRange(prev => ({ ...prev, min: Math.max(0.01, Math.min(0.9, Number(e.target.value) || prev.min)) }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] font-bold outline-none"
                                        />
                                        <span className="text-[10px] font-black text-slate-400">至</span>
                                        <input
                                            type="number"
                                            min="0.05"
                                            max="0.99"
                                            step="0.01"
                                            value={fitRange.max}
                                            onChange={(e) => setFitRange(prev => ({ ...prev, max: Math.max(0.05, Math.min(0.99, Number(e.target.value) || prev.max)) }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] font-bold outline-none"
                                        />
                                    </div>
                                    {autoFitSuggestion && (
                                        <button
                                            onClick={() => setFitRange(autoFitSuggestion.range)}
                                            className="mt-2 w-full py-1.5 text-[10px] font-black rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        >
                                            用自动推荐值填充
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-3">
                            <div className="text-[9px] font-black text-slate-500 uppercase mb-2">数据状态</div>
                            <div className="text-[11px] font-bold text-slate-700">文件: {sourceFilename || '未导入'}</div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                Ads {qcReport?.adsCount || 0} 点 / Des {qcReport?.desCount || 0} 点
                            </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl p-3">
                            <div className="text-[9px] font-black text-slate-500 uppercase mb-2">BJH 参数面板</div>
                            <div className="text-[9px] text-slate-500 mb-1">厚度模型</div>
                            <div className="flex gap-1 mb-2">
                                <button
                                    onClick={() => setBjhParams(prev => ({ ...prev, thicknessModel: 'halsey' }))}
                                    className={`px-2 py-1 rounded text-[8px] font-black ${bjhParams.thicknessModel === 'halsey' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    Halsey
                                </button>
                                <button
                                    onClick={() => setBjhParams(prev => ({ ...prev, thicknessModel: 'harkins-jura' }))}
                                    className={`px-2 py-1 rounded text-[8px] font-black ${bjhParams.thicknessModel === 'harkins-jura' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    Harkins-Jura
                                </button>
                            </div>
                            <div className="text-[9px] text-slate-500 mb-1">BJH 分支</div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setBjhParams(prev => ({ ...prev, branchMode: 'des' }))}
                                    className={`px-2 py-1 rounded text-[8px] font-black ${bjhParams.branchMode === 'des' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    脱附分支
                                </button>
                                <button
                                    onClick={() => setBjhParams(prev => ({ ...prev, branchMode: 'ads' }))}
                                    className={`px-2 py-1 rounded text-[8px] font-black ${bjhParams.branchMode === 'ads' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    吸附分支
                                </button>
                            </div>
                        </div>
                    </div>
                    {qcReport && qcReport.warnings.length > 0 && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                            <div className="text-[9px] font-black text-amber-700 uppercase mb-1">质控提示</div>
                            {qcReport.warnings.slice(0, 2).map((w, idx) => (
                                <div key={idx} className="text-[10px] text-amber-800">- {w}</div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="col-span-12 lg:col-span-5 min-w-0 flex flex-col gap-3 print:col-span-12 lg:max-h-full lg:overflow-auto pr-1">
                    {result ? (
                        <div className="space-y-2 animate-reveal">
                            <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">SSA</p>
                                        <p className="text-lg font-black text-emerald-600 font-mono">{result.ssa}<span className="text-[10px] ml-1">m²/g</span></p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">SIZE</p>
                                        <p className="text-lg font-black text-indigo-600 font-mono">{result.avgPoreSize}<span className="text-[10px] ml-1">nm</span></p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">PORE VOL</p>
                                        <p className="text-lg font-black text-amber-500 font-mono">{result.poreVolume}<span className="text-[10px] ml-1">cm³/g</span></p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">BET R²</p>
                                        <p className="text-base font-black text-slate-700 font-mono">{result.r2}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">C</p>
                                        <p className="text-base font-black text-slate-700 font-mono">{result.cConstant}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Vm</p>
                                        <p className="text-base font-black text-indigo-600 font-mono">{result.vm}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">微孔占比</p>
                                        <p className="text-base font-black text-indigo-600 font-mono">{result.microporeRatio}%</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-100 p-2 text-center">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">PSD 峰位</p>
                                        <p className="text-base font-black text-indigo-600 font-mono">{result.psdPeakNm ? `${result.psdPeakNm} nm` : '-'}</p>
                                    </div>
                                </div>
                            </div>
                            {psdBins.length > 0 && (
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">BJH 孔径分布（标准脱附法）</p>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setBjhYAxisMode('deltaV')}
                                                className={`px-2 py-1 rounded text-[8px] font-black ${bjhYAxisMode === 'deltaV' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                ΔV
                                            </button>
                                            <button
                                                onClick={() => setBjhYAxisMode('dVdLogD')}
                                                className={`px-2 py-1 rounded text-[8px] font-black ${bjhYAxisMode === 'dVdLogD' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                                            >
                                                dV/dlogD
                                            </button>
                                        </div>
                                    </div>
                                    <div className="h-16 flex items-end gap-1 overflow-hidden">
                                        {(() => {
                                            const bars = bjhBars.slice(0, 24);
                                            const maxValue = Math.max(1e-12, ...bars.map(b => b.value));
                                            return bars.map((bar, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex-1 bg-indigo-400/70 rounded-t"
                                                    style={{ height: `${Math.max(8, Math.min(100, (bar.value / maxValue) * 100))}%` }}
                                                    title={`${bar.diameterNm.toFixed(2)} nm | ${bjhYAxisMode === 'deltaV' ? 'ΔV' : 'dV/dlogD'}=${bar.value.toExponential(2)}`}
                                                />
                                            ));
                                        })()}
                                    </div>
                                    <div className="mt-2 h-16">
                                        <svg viewBox="0 0 100 100" className="w-full h-full">
                                            <path d={bjhCumulativePath} fill="none" stroke="#0f172a" strokeWidth="1.6" />
                                        </svg>
                                    </div>
                                    <div className="text-[9px] text-slate-500">
                                        纵轴: {bjhYAxisMode === 'deltaV' ? 'ΔV (cm³/g)' : 'dV/dlogD (cm³/g)'} | 累计孔容: {psdBins.length ? psdBins[psdBins.length - 1].cumulativeVolume.toFixed(3) : '0.000'} cm³/g
                                    </div>
                                </div>
                            )}
                            {betPlotGeometry.dots.length > 0 && (
                                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-2">BET 线性图 P/[V(P0-P)] - P/P0</p>
                                    <div className="h-24 overflow-hidden">
                                        <svg viewBox="0 0 100 100" className="w-full h-full">
                                            <line x1="8" y1="92" x2="96" y2="92" stroke="#cbd5e1" strokeWidth="0.7" />
                                            <line x1="8" y1="8" x2="8" y2="92" stroke="#cbd5e1" strokeWidth="0.7" />
                                            {betPlotGeometry.dots.map((d, idx) => (
                                                <circle
                                                    key={idx}
                                                    cx={d.cx}
                                                    cy={d.cy}
                                                    r="1.3"
                                                    fill={d.inFit ? '#0f172a' : '#94a3b8'}
                                                />
                                            ))}
                                            {betPlotGeometry.line && (
                                                <line
                                                    x1={betPlotGeometry.line.x1}
                                                    y1={betPlotGeometry.line.y1}
                                                    x2={betPlotGeometry.line.x2}
                                                    y2={betPlotGeometry.line.y2}
                                                    stroke="#ef4444"
                                                    strokeWidth="1"
                                                />
                                            )}
                                        </svg>
                                    </div>
                                    <div className="text-[9px] text-slate-500">
                                        黑点为拟合区间数据，红线为线性回归线
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-900 p-5 rounded-[1.5rem] text-white space-y-3 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-10"><i className="fa-solid fa-microscope text-7xl"></i></div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-3 relative z-10">
                                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">IUPAC 分类</span>
                                    <span className="text-[11px] font-black italic">{result.type}</span>
                                </div>
                                <div className="text-[9px] text-indigo-100/80">
                                    拟合区间 {result.betRange.min.toFixed(2)}-{result.betRange.max.toFixed(2)} | 回滞环 {result.hysteresisType}
                                </div>
                                <p className="text-[12px] leading-relaxed italic text-indigo-50/90 text-justify font-medium relative z-10">“ {result.insight} ”</p>

                                <button
                                    onClick={handleExportPDF}
                                    className="w-full py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-400 hover:text-white transition-all shadow-lg no-print"
                                >
                                    导出报告 (.PDF)
                                </button>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-2">IUPAC / Hysteresis 判型依据</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                    <div className="bg-slate-50 rounded-xl p-2">
                                        低压斜率 ({result.classificationEvidence.lowPressureWindow[0].toFixed(2)}-{result.classificationEvidence.lowPressureWindow[1].toFixed(2)}):
                                        <span className="font-black ml-1">{result.classificationEvidence.lowPressureSlope}</span>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-2">
                                        回滞宽度 中/高压:
                                        <span className="font-black ml-1">{result.classificationEvidence.hysteresisMidGap} / {result.classificationEvidence.hysteresisHighGap}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2">{result.classificationEvidence.rationale}</p>
                            </div>
                            {sensitivityHeatmap.cells.length > 0 && (
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-2">区间敏感性分析 (SSA-R²)</p>
                                    <div className="grid grid-cols-6 gap-1">
                                        {sensitivityHeatmap.cells.slice(0, 36).map((cell, idx) => (
                                            <div
                                                key={idx}
                                                className="rounded-md p-1 text-[8px] text-white font-black"
                                                style={{ backgroundColor: cell.color }}
                                                title={`区间 ${cell.min}-${cell.max} | SSA ${cell.ssa} | R² ${cell.r2}`}
                                            >
                                                {cell.ssa}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[9px] text-slate-500 mt-2">
                                        色深代表 R² 稳健性（{sensitivityHeatmap.r2Min.toFixed(3)} - {sensitivityHeatmap.r2Max.toFixed(3)}），格内数字为 SSA。
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-slate-200 rounded-[3rem] bg-white gap-4">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center shadow-inner">
                                <i className="fa-solid fa-file-waveform text-3xl"></i>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest">请导入 .TXT / .CSV 等温线数据</p>
                            <p className="text-[8px] text-slate-400 max-w-[200px] text-center italic">支持 BET 拟合与 BJH 标准脱附分布解算</p>
                        </div>
                    )}
                </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h5 className="text-[11px] font-black text-slate-700 uppercase">多样品对比模式 (2-6)</h5>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500">已选 {selectedCompareSamples.length}/6</span>
                        <button
                            onClick={handleBatchContextAiAnalysis}
                            disabled={isBatchAiAnalyzing || selectedCompareSamples.length === 0}
                            className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-black hover:bg-emerald-200 disabled:opacity-50"
                        >
                            {isBatchAiAnalyzing ? '批量分析中...' : '一键分析已关联'}
                        </button>
                        <button
                            onClick={() => setComparePanelExpanded(v => !v)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black hover:bg-slate-200"
                        >
                            {comparePanelExpanded ? '收起' : '展开'}
                        </button>
                    </div>
                </div>
                {comparePanelExpanded ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">样品选择</div>
                                <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                                    {compareCandidates.map(c => (
                                        <label key={c.id} className="flex items-center gap-2 text-[10px] text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={compareSampleIds.includes(c.id)}
                                                onChange={() => toggleCompareSample(c.id)}
                                            />
                                            <span className="truncate">{c.title}</span>
                                        </label>
                                    ))}
                                    {compareCandidates.length === 0 && <div className="text-[10px] text-slate-400">暂无可对比样品</div>}
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">BET 线性叠加</div>
                                <svg viewBox="0 0 100 70" className="w-full h-40 bg-white rounded-lg">
                                    <line x1="8" y1="62" x2="96" y2="62" stroke="#cbd5e1" strokeWidth="0.7" />
                                    <line x1="8" y1="6" x2="8" y2="62" stroke="#cbd5e1" strokeWidth="0.7" />
                                    {overlayBetLines.lines.map((item, idx) => {
                                        const xSpan = Math.max(1e-6, overlayBetLines.xMax - overlayBetLines.xMin);
                                        const ySpan = Math.max(1e-6, overlayBetLines.yMax - overlayBetLines.yMin);
                                        const x1 = 8 + ((item.line.x1 - overlayBetLines.xMin) / xSpan) * 88;
                                        const x2 = 8 + ((item.line.x2 - overlayBetLines.xMin) / xSpan) * 88;
                                        const y1 = 62 - ((item.line.y1 - overlayBetLines.yMin) / ySpan) * 56;
                                        const y2 = 62 - ((item.line.y2 - overlayBetLines.yMin) / ySpan) * 56;
                                        const colors = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#a21caf', '#ea580c'];
                                        return <line key={item.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors[idx % colors.length]} strokeWidth="1.4" />;
                                    })}
                                </svg>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">关键指标差值</div>
                                {selectedCompareSamples.length >= 2 ? (
                                    <div className="space-y-1 text-[10px]">
                                        {(() => {
                                            const base = selectedCompareSamples[0].result;
                                            return selectedCompareSamples.slice(1).map(s => (
                                                <div key={s.id} className="bg-white rounded-lg p-2 border border-slate-200">
                                                    <div className="font-black text-slate-700 truncate">{s.title}</div>
                                                    <div>ΔSSA: {(s.result.ssa - base.ssa).toFixed(1)} | ΔC: {(s.result.cConstant - base.cConstant).toFixed(2)}</div>
                                                    <div>ΔVt: {(s.result.poreVolume - base.poreVolume).toFixed(3)} | Δ峰径: {((s.result.psdPeakNm || 0) - (base.psdPeakNm || 0)).toFixed(2)}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-slate-400">至少选择 2 组样品</div>
                                )}
                            </div>
                        </div>
                        {selectedCompareSamples.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedCompareSamples.map(sample => {
                                    const linked = sampleContextLinks[sample.id];
                                    const insight = sampleContextInsights[sample.id];
                                    return (
                                        <div key={`ctx-${sample.id}`} className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-[10px] font-black text-slate-700 truncate">{sample.title}</div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => setContextLinkTargetSampleId(sample.id)}
                                                        className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-[8px] font-black"
                                                    >
                                                        关联实验记录
                                                    </button>
                                                    <button
                                                        onClick={() => handleSampleContextAiAnalysis(sample)}
                                                        disabled={!linked || isSampleAiAnalyzingId === sample.id}
                                                        className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[8px] font-black disabled:opacity-50"
                                                    >
                                                        {isSampleAiAnalyzingId === sample.id ? '分析中...' : 'AI分析'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-slate-500 mt-1">
                                                关联状态: {linked ? `${linked.projectId.slice(0, 6)} / ${linked.logId.slice(0, 6)}` : '未关联'}
                                            </div>
                                            {insight && (
                                                <div className="mt-2 bg-white border border-slate-200 rounded-xl p-2 text-[9px]">
                                                    <div className="font-black text-slate-700 mb-1">AI结论</div>
                                                    <div className="text-slate-600">{insight.summary}</div>
                                                    {insight.keyFindings.slice(0, 2).map((k, idx) => (
                                                        <div key={idx} className="text-slate-500">- {k}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {repeatability && (
                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                                <div className="text-[9px] font-black text-amber-700 uppercase mb-1">误差与重复性统计</div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                    <div>SSA: {repeatability.ssaStat.mean.toFixed(1)}±{repeatability.ssaStat.sd.toFixed(1)} (RSD {repeatability.ssaStat.rsd.toFixed(1)}%)</div>
                                    <div>C: {repeatability.cStat.mean.toFixed(2)}±{repeatability.cStat.sd.toFixed(2)} (RSD {repeatability.cStat.rsd.toFixed(1)}%)</div>
                                    <div>Vt: {repeatability.vtStat.mean.toFixed(3)}±{repeatability.vtStat.sd.toFixed(3)} (RSD {repeatability.vtStat.rsd.toFixed(1)}%)</div>
                                    <div>峰径: {repeatability.peakStat.mean.toFixed(2)}±{repeatability.peakStat.sd.toFixed(2)} (RSD {repeatability.peakStat.rsd.toFixed(1)}%)</div>
                                </div>
                                {repeatability.outliers.length > 0 && (
                                    <div className="text-[10px] text-rose-600 mt-2">异常值提示: {repeatability.outliers.join('，')}</div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        已默认折叠，点击“展开”查看多样品对比、样品关联和重复性统计。
                    </div>
                )}
            </div>

            {/* Library Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">BET 方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <FolderLibraryView
                                records={filteredRecords}
                                onLoad={handleLoadRecord}
                                onDelete={handleDeleteRecord}
                                emptyText="暂无相关存档"
                            />
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">保存 BET 分析</h3>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-4 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="方案名称..." autoFocus />
                        {/* 归档位置选择 */}
                        <div className="space-y-3 mb-6">
                            <p className="text-[9px] font-black text-slate-400 uppercase px-1">归档位置（可选）</p>
                            <div className="relative">
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={saveMilestoneId} onChange={e => { setSaveMilestoneId(e.target.value); const ms = projects.find(p => p.id === selectedProjectId)?.milestones.find(m => m.id === e.target.value); setSaveLogId(ms?.logs?.[0]?.id || ''); }}>
                                    <option value="">选择实验节点...</option>
                                    {flattenMilestonesTree(projects.find(p => p.id === selectedProjectId)?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                            {saveMilestoneId && (
                                <div className="relative animate-reveal">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={saveLogId} onChange={e => setSaveLogId(e.target.value)}>
                                        <option value="">关联实验记录...</option>
                                        {(projects.find(p => p.id === selectedProjectId)?.milestones.find(m => m.id === saveMilestoneId)?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 30)}...</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                            <button onClick={handleSaveRecord} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {showSyncModal && (
                <AnalysisSyncModal
                    onClose={() => setShowSyncModal(false)}
                    projects={projects}
                    onConfirm={(projectId, milestoneId, logId) => {
                        if (!projectId || !milestoneId || !logId) return;
                        handleSaveToLog(projectId, milestoneId, logId);
                    }}
                    onConfirmGroup={(projectId, milestoneId, groupId) => {
                        if (!projectId || !milestoneId || !groupId) return;
                        handleSaveToLog(projectId, milestoneId, `GROUP:${groupId}`);
                        setShowSyncModal(false);
                    }}
                    initialProjectId={selectedProjectId}
                />
            )}
            {contextLinkTargetSampleId && (
                <AnalysisSyncModal
                    onClose={() => setContextLinkTargetSampleId(null)}
                    projects={projects}
                    onConfirm={handleSampleLinkConfirm}
                    initialProjectId={selectedProjectId}
                    title="为样品关联实验记录"
                />
            )}
        </div>
    );
};

export default PorosityAnalysisPanel;
