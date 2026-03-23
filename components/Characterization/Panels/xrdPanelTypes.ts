// ═══ xrdPanelTypes.ts — XrdPhasePanel 的类型定义、常量和工具函数 ═══

import { DataPoint } from '../../DataAnalysis/xrdUtils';

// 专业 XRD 调色板
export const XRD_COLOR_PALETTE = [
    '#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2',
    '#e11d48', '#4f46e5', '#059669', '#ea580c', '#7c3aed', '#0d9488',
    '#be123c', '#1d4ed8', '#15803d', '#c2410c', '#6d28d9', '#0e7490',
];

// 增强型数据集接口
export interface XrdDataset {
    id: string;
    name: string;
    rawPoints: DataPoint[];
    originalPoints?: DataPoint[];
    peaks: any[];
    matchedPhases: any[];
    color: string;
    offsetY?: number;
    linkedProjectId?: string;
    linkedMilestoneId?: string;
    linkedLogId?: string;
    linkedLogTitle?: string;
}

export interface PanelPeak {
    id: number;
    twoTheta: string;
    intensity: string;
    fwhm: number;
    d: string;
    size: string;
    label?: string;
    manual?: boolean;
}

export interface ContextualXrdResult {
    summary: string;
    keyFindings: string[];
    suggestedPhaseQueries: string[];
    cardAdjustmentAdvice: string[];
    riskFlags: string[];
    nextActions: string[];
    anomalousPeaks?: Array<{ twoTheta: number; diagnosis: string; explanation: string }>;
}

export interface PhaseEvolutionResult {
    evolutionSummary: string;
    phaseTransitions: Array<{ fromPhase: string; toPhase: string; condition: string; evidence: string }>;
    trendAnalysis: Array<{ phaseName: string; trend: string; notes: string }>;
    criticalPoints: Array<{ condition: string; event: string; significance: string }>;
    recommendations: string[];
}

export interface MultiDatasetXrdResult {
    comparativeSummary: string;
    parameterEffects: Array<{ parameter: string; valueRange: string; observedEffect: string; confidence: string }>;
    keyDifferences: string[];
    processingInsights: string[];
    recommendations: string[];
}

export interface XrdWorkspaceSnapshot {
    datasets: XrdDataset[];
    activeDatasetIndex?: number;
    waterfallMode?: boolean;
    waterfallGap?: number;
    showSticks?: boolean;
    showOnlyMatchedSticks?: boolean;
    activeReferenceGroups?: any[];
    contextualAnalysis?: ContextualXrdResult | null;
    selectedContextProjectId?: string;
    selectedContextMilestoneId?: string;
    selectedContextLogId?: string;
    peakDetectSettings?: PeakDetectSettings;
    waterfallSectionExpanded?: boolean;
    preprocessSectionExpanded?: boolean;
    datasetSectionExpanded?: boolean;
    currentRecordId?: string | null;
    postMatchAnalysis?: any;
    matchRationale?: any;
    phaseEvolution?: PhaseEvolutionResult | null;
    multiDatasetAnalysis?: MultiDatasetXrdResult | null;
}

export const XRD_GLOBAL_CARD_LIBRARY_KEY = 'sciflow_xrd_global_card_library';

export interface PeakDetectSettings {
    mode: 'balanced' | 'recall' | 'precision';
    maxPeaksMode: 'auto' | 'fixed';
    maxPeaks: number;
    minPeakDistanceDeg: number;
    minProminencePercent: number;
    minWidthDeg: number;
    smoothingPasses: number;
    showAdvanced: boolean;
}

export const DEFAULT_PEAK_SETTINGS: PeakDetectSettings = {
    mode: 'balanced',
    maxPeaksMode: 'auto',
    maxPeaks: 8,
    minPeakDistanceDeg: 0.22,
    minProminencePercent: 4.5,
    minWidthDeg: 0.10,
    smoothingPasses: 2,
    showAdvanced: false
};

export const normalizeAndSortPeaks = (peaks: any[]): PanelPeak[] => {
    return [...(peaks || [])]
        .sort((a, b) => (parseFloat(String(a.twoTheta)) || 0) - (parseFloat(String(b.twoTheta)) || 0))
        .map((p, idx) => ({ ...p, id: idx + 1 }));
};

export const toArray = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return [];
};

export const toStringArray = (value: any): string[] => {
    if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    return [];
};

export const toOptionalNumber = (value: any): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

export const formatFixed = (value: any, digits: number, fallback = '--'): string => {
    const n = toOptionalNumber(value);
    return n === null ? fallback : n.toFixed(digits);
};

export const localizePhaseConfidence = (confidence: string): string => {
    if (!confidence) return '';
    const normalized = confidence.trim();
    const map: Record<string, string> = {
        'Major': '主要', 'Moderate': '中等', 'Minor/Trace': '次要/痕量',
        'High': '高', 'Medium': '中', 'Low': '低',
    };
    return normalized.split(/\s+/).map(part => map[part] || part).join(' ');
};

export const normalizePhaseKey = (value: any): string => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    return raw
        .replace(/[\(\（][^)\）]*[\)\）]/g, ' ')
        .replace(/\bpdf\s*#?\s*/g, ' ')
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
        .trim();
};

export const collectPhaseKeysFromGroups = (groups: any[]): Set<string> => {
    const keys = new Set<string>();
    (groups || []).forEach((group: any) => {
        const groupKey = normalizePhaseKey(group?.name);
        if (groupKey) keys.add(groupKey);
        (group?.phases || []).forEach((phase: any) => {
            const phaseKey = normalizePhaseKey(phase?.name);
            if (phaseKey) keys.add(phaseKey);
        });
    });
    return keys;
};

export const buildXrdPostMatchDeepReport = (postMatchAnalysis: any, matchRationale: any[] | null): string | undefined => {
    if (!postMatchAnalysis && (!matchRationale || matchRationale.length === 0)) return undefined;
    const sections: string[] = [];

    if (postMatchAnalysis?.matchSummary) {
        sections.push(`【卡片匹配深度分析】\n${String(postMatchAnalysis.matchSummary).trim()}`);
    }

    if (Array.isArray(postMatchAnalysis?.phaseComposition) && postMatchAnalysis.phaseComposition.length > 0) {
        const lines = postMatchAnalysis.phaseComposition.map((pc: any) => {
            const phase = String(pc?.phaseName || '未命名物相');
            const frac = String(pc?.estimatedFraction || '--');
            const conf = localizePhaseConfidence(String(pc?.confidence || ''));
            const evidence = String(pc?.evidence || '');
            return `- ${phase}：${frac}${conf ? `（置信度：${conf}）` : ''}${evidence ? `；证据：${evidence}` : ''}`;
        });
        sections.push(`【物相组成估算】\n${lines.join('\n')}`);
    }

    if (Array.isArray(postMatchAnalysis?.peakShiftAnalysis) && postMatchAnalysis.peakShiftAnalysis.length > 0) {
        const lines = postMatchAnalysis.peakShiftAnalysis.map((ps: any) => {
            const exp = formatFixed(ps?.experimentalTheta, 2, '--');
            const ref = formatFixed(ps?.referenceTheta, 2, '--');
            const refName = String(ps?.referenceName || '参考峰');
            const shift = formatFixed(ps?.shiftDeg, 3, '--');
            const cause = String(ps?.possibleCause || '');
            return `- 实验峰 ${exp}° vs 参考峰 ${ref}°（${refName}），Δ=${shift}°${cause ? `；可能原因：${cause}` : ''}`;
        });
        sections.push(`【峰位偏移检测】\n${lines.join('\n')}`);
    }

    if (Array.isArray(postMatchAnalysis?.unmatchedPeaks) && postMatchAnalysis.unmatchedPeaks.length > 0) {
        const lines = postMatchAnalysis.unmatchedPeaks.map((up: any) => {
            const theta = formatFixed(up?.twoTheta, 2, '--');
            const intensity = formatFixed(up?.intensity, 1, '--');
            const origin = String(up?.possibleOrigin || '');
            return `- ${theta}°（I=${intensity}）${origin ? `：${origin}` : ''}`;
        });
        sections.push(`【未归属实验峰】\n${lines.join('\n')}`);
    }

    if (Array.isArray(postMatchAnalysis?.crystallographicInsights) && postMatchAnalysis.crystallographicInsights.length > 0) {
        const lines = postMatchAnalysis.crystallographicInsights.map((it: any) => `- ${String(it)}`);
        sections.push(`【晶体学洞察】\n${lines.join('\n')}`);
    }

    if (postMatchAnalysis?.synthesisAssessment) {
        sections.push(`【合成路径评估】\n${String(postMatchAnalysis.synthesisAssessment).trim()}`);
    }

    if (postMatchAnalysis?.publicationSentence) {
        sections.push(`【论文可用表述】\n${String(postMatchAnalysis.publicationSentence).trim()}`);
    }

    if (Array.isArray(postMatchAnalysis?.nextExperiments) && postMatchAnalysis.nextExperiments.length > 0) {
        const lines = postMatchAnalysis.nextExperiments.map((it: any) => `- ${String(it)}`);
        sections.push(`【下一步实验建议】\n${lines.join('\n')}`);
    }

    if (Array.isArray(matchRationale) && matchRationale.length > 0) {
        const lines = matchRationale.map((mr: any) => {
            const name = String(mr?.groupName || '未命名组');
            const rate = Number(mr?.matchRate);
            const matched = Number(mr?.matchedCount) || 0;
            const total = Number(mr?.totalRefPeaks) || 0;
            const verdict = String(mr?.verdict || '');
            const pct = Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : '--';
            return `- ${name}：${pct}（${matched}/${total}）${verdict ? `；${verdict}` : ''}`;
        });
        sections.push(`【对标分析摘要】\n${lines.join('\n')}`);
    }

    const text = sections.join('\n\n').trim();
    return text || undefined;
};

export const normalizePostMatchAnalysis = (value: any) => {
    if (!value || typeof value !== 'object') return null;
    const phaseComposition = toArray(value.phaseComposition).map((pc: any) => ({
        phaseName: typeof pc?.phaseName === 'string' ? pc.phaseName : String(pc?.phaseName || ''),
        estimatedFraction: typeof pc?.estimatedFraction === 'string' ? pc.estimatedFraction : String(pc?.estimatedFraction || ''),
        confidence: typeof pc?.confidence === 'string' ? pc.confidence : String(pc?.confidence || ''),
        evidence: typeof pc?.evidence === 'string' ? pc.evidence : String(pc?.evidence || ''),
    }));
    const peakShiftAnalysis = toArray(value.peakShiftAnalysis).map((ps: any) => ({
        experimentalTheta: toOptionalNumber(ps?.experimentalTheta),
        referenceTheta: toOptionalNumber(ps?.referenceTheta),
        referenceName: typeof ps?.referenceName === 'string' ? ps.referenceName : String(ps?.referenceName || ''),
        shiftDeg: toOptionalNumber(ps?.shiftDeg),
        possibleCause: typeof ps?.possibleCause === 'string' ? ps.possibleCause : String(ps?.possibleCause || ''),
    }));
    const unmatchedPeaks = toArray(value.unmatchedPeaks).map((up: any) => ({
        twoTheta: toOptionalNumber(up?.twoTheta),
        intensity: toOptionalNumber(up?.intensity),
        possibleOrigin: typeof up?.possibleOrigin === 'string' ? up.possibleOrigin : String(up?.possibleOrigin || ''),
    }));
    return {
        ...value,
        matchSummary: typeof value.matchSummary === 'string' ? value.matchSummary : '',
        phaseComposition, peakShiftAnalysis, unmatchedPeaks,
        crystallographicInsights: toStringArray(value.crystallographicInsights),
        synthesisAssessment: typeof value.synthesisAssessment === 'string' ? value.synthesisAssessment : '',
        publicationSentence: typeof value.publicationSentence === 'string' ? value.publicationSentence : '',
        nextExperiments: toStringArray(value.nextExperiments),
    };
};

// 示例数据生成器
export const generateXrdDemoData = (): XrdDataset[] => {
    const concentrations = ['Pure ZnO', '0.2 at% Ce/Zn', '0.5 at% Ce/Zn', '1.2 at% Ce/Zn', '2 at% Ce/Zn'];
    const base_peaks = [
        { center: 31.8, height: 400, fwhm: 0.4, label: '(100)' },
        { center: 34.4, height: 350, fwhm: 0.4, label: '(002)' },
        { center: 36.3, height: 600, fwhm: 0.4, label: '(101)' },
        { center: 47.5, height: 150, fwhm: 0.5, label: '(102)' },
        { center: 56.6, height: 250, fwhm: 0.5, label: '(110)' },
        { center: 62.9, height: 200, fwhm: 0.5, label: '(103)' },
        { center: 66.4, height: 100, fwhm: 0.6, label: '(200)' },
        { center: 67.9, height: 120, fwhm: 0.6, label: '(112)' },
        { center: 69.1, height: 110, fwhm: 0.6, label: '(201)' },
    ];

    return concentrations.map((name, idx) => {
        const rawPoints: DataPoint[] = [];
        const shift = idx * 0.02;
        const heightScale = 1 - idx * 0.05;
        for (let x = 20; x <= 80; x += 0.1) {
            let y = 10 + Math.random() * 5;
            base_peaks.forEach(pk => {
                const center = pk.center - shift;
                const height = pk.height * heightScale;
                y += height * Math.exp(-Math.pow(x - center, 2) / (2 * Math.pow(pk.fwhm / 2.355, 2)));
            });
            rawPoints.push({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(1)) });
        }
        const peaks = base_peaks.map((pk, pIdx) => ({
            id: pIdx + 1,
            twoTheta: (pk.center - shift).toFixed(2),
            intensity: (100 * heightScale).toFixed(1),
            fwhm: pk.fwhm,
            d: (0.15406 / (2 * Math.sin(((pk.center - shift) / 2) * (Math.PI / 180)))).toFixed(4),
            size: (0.9 * 0.15406 / (0.4 * (Math.PI / 180) * Math.cos(((pk.center - shift) / 2) * (Math.PI / 180)))).toFixed(1),
            label: pk.label
        }));
        return {
            id: `ds-${idx}`, name, rawPoints, peaks,
            matchedPhases: idx === 0 ? [{ name: 'Pure ZnO', card: 'PDF#36-1451', match: 99.1, crystalSystem: 'Hexagonal' }] : [],
            color: XRD_COLOR_PALETTE[idx % XRD_COLOR_PALETTE.length]
        };
    });
};

export interface XrdPanelProps {
    projects: import('../../../types').ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    onUpdateProject?: (project: import('../../../types').ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
    onBack?: () => void;
}
