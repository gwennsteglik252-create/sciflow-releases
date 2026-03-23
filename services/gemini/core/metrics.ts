// ═══ SciFlow Pro — AI 指标系统 ═══

const AI_METRICS_STORAGE_KEY = 'sciflow_ai_metrics_v1';

export type AIMetricsBucket = {
    requests: number;
    cacheHits: number;
    dedupHits: number;
    networkRequests: number;
    successResponses: number;
    failedResponses: number;
    totalLatencyMs: number;
    latencySamples: number;
};

export type AIMetricsSnapshot = AIMetricsBucket & {
    byTaskType: Record<string, AIMetricsBucket>;
    byProvider: Record<string, AIMetricsBucket>;
    recentRequests: Array<{
        id: string;
        at: number;
        taskType: string;
        provider?: string;
        source: 'cache' | 'dedup' | 'network';
        result: 'success' | 'failure';
        durationMs?: number;
    }>;
    updatedAt: number;
};

const createMetricsBucket = (): AIMetricsBucket => ({
    requests: 0,
    cacheHits: 0,
    dedupHits: 0,
    networkRequests: 0,
    successResponses: 0,
    failedResponses: 0,
    totalLatencyMs: 0,
    latencySamples: 0
});

const createEmptyMetrics = (): AIMetricsSnapshot => ({
    ...createMetricsBucket(),
    byTaskType: {},
    byProvider: {},
    recentRequests: [],
    updatedAt: Date.now()
});

let aiMetricsState: AIMetricsSnapshot | null = null;

const readAiMetricsState = (): AIMetricsSnapshot => {
    if (aiMetricsState) return aiMetricsState as AIMetricsSnapshot;
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AI_METRICS_STORAGE_KEY) : null;
        if (!raw) {
            aiMetricsState = createEmptyMetrics();
            return aiMetricsState as AIMetricsSnapshot;
        }
        const parsed = JSON.parse(raw);
        aiMetricsState = {
            ...createEmptyMetrics(),
            ...parsed,
            byTaskType: parsed?.byTaskType || {},
            byProvider: parsed?.byProvider || {},
            recentRequests: Array.isArray(parsed?.recentRequests) ? parsed.recentRequests : []
        };
        return aiMetricsState as AIMetricsSnapshot;
    } catch {
        aiMetricsState = createEmptyMetrics();
        return aiMetricsState as AIMetricsSnapshot;
    }
};

const getBucket = (store: Record<string, AIMetricsBucket>, key: string): AIMetricsBucket => {
    if (!store[key]) store[key] = createMetricsBucket();
    return store[key];
};

const applyMetricDelta = (bucket: AIMetricsBucket, delta: Partial<AIMetricsBucket>) => {
    bucket.requests += delta.requests || 0;
    bucket.cacheHits += delta.cacheHits || 0;
    bucket.dedupHits += delta.dedupHits || 0;
    bucket.networkRequests += delta.networkRequests || 0;
    bucket.successResponses += delta.successResponses || 0;
    bucket.failedResponses += delta.failedResponses || 0;
    bucket.totalLatencyMs += delta.totalLatencyMs || 0;
    bucket.latencySamples += delta.latencySamples || 0;
};

const publishAiMetrics = (metrics: AIMetricsSnapshot) => {
    metrics.updatedAt = Date.now();
    if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem(AI_METRICS_STORAGE_KEY, JSON.stringify(metrics)); } catch { }
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sciflow_ai_metrics_event', { detail: metrics }));
    }
};

export const recordAiMetric = (args: {
    taskType: string;
    provider?: string;
    cacheHit?: boolean;
    dedupHit?: boolean;
    network?: boolean;
    success?: boolean;
    failure?: boolean;
    durationMs?: number;
    countRequest?: boolean;
    source?: 'cache' | 'dedup' | 'network';
}) => {
    const metrics = readAiMetricsState();
    const delta: Partial<AIMetricsBucket> = {
        requests: args.countRequest === false ? 0 : 1,
        cacheHits: args.cacheHit ? 1 : 0,
        dedupHits: args.dedupHit ? 1 : 0,
        networkRequests: args.network ? 1 : 0,
        successResponses: args.success ? 1 : 0,
        failedResponses: args.failure ? 1 : 0,
        totalLatencyMs: typeof args.durationMs === 'number' ? args.durationMs : 0,
        latencySamples: typeof args.durationMs === 'number' ? 1 : 0
    };

    applyMetricDelta(metrics, delta);
    applyMetricDelta(getBucket(metrics.byTaskType, args.taskType || 'unknown'), delta);
    if (args.provider) {
        applyMetricDelta(getBucket(metrics.byProvider, args.provider), delta);
    }
    if (args.source && (args.success || args.failure)) {
        const entry = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            at: Date.now(),
            taskType: args.taskType || 'unknown',
            provider: args.provider,
            source: args.source,
            result: args.failure ? 'failure' as const : 'success' as const,
            durationMs: typeof args.durationMs === 'number' ? args.durationMs : undefined
        };
        metrics.recentRequests = [entry, ...(metrics.recentRequests || [])].slice(0, 20);
    }
    publishAiMetrics(metrics);
};
