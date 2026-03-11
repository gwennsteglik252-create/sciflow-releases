import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export type ModelResponse = {
    text: string;
    raw?: GenerateContentResponse;
};

// ── 模型常量 ──
// 注意：googleSearch 工具 与 responseSchema/responseMimeType:"application/json" 吲互斥，必须分两次独立调用
export const PRO_MODEL = 'gemini-3.1-pro';       // 2026 flagship reasoning model
export const FAST_MODEL = 'gemini-1.5-flash';     // 极速模型，用于元数据提取、快速总结等非推理任务
export const GROUNDING_MODEL = 'gemini-1.5-flash';
export const IMAGE_MODEL = 'gemini-3.1-pro';

export const SPEED_CONFIG = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
};

type AISpeedMode = 'fast' | 'balanced' | 'quality';

const getAISpeedMode = (): AISpeedMode => {
    try {
        const settings = getAppSettings();
        const mode = settings?.aiSpeedMode;
        if (mode === 'balanced' || mode === 'quality' || mode === 'fast') return mode;
        return 'balanced';
    } catch {
        return 'balanced';
    }
};

const getRetryProfile = (mode: AISpeedMode) => {
    if (mode === 'quality') return { retries: 5, rateLimitBaseDelayMs: 4000, networkBaseDelayMs: 1000 };
    if (mode === 'balanced') return { retries: 3, rateLimitBaseDelayMs: 2200, networkBaseDelayMs: 800 };
    return { retries: 2, rateLimitBaseDelayMs: 1400, networkBaseDelayMs: 600 };
};

const AI_RESPONSE_CACHE_TTL_MS = 90_000;
const AI_RESPONSE_CACHE_MAX = 120;
const aiResponseCache = new Map<string, { expiresAt: number; value: any }>();
const aiInflightRequests = new Map<string, Promise<any>>();
const AI_METRICS_STORAGE_KEY = 'sciflow_ai_metrics_v1';

type AIMetricsBucket = {
    requests: number;
    cacheHits: number;
    dedupHits: number;
    networkRequests: number;
    successResponses: number;
    failedResponses: number;
    totalLatencyMs: number;
    latencySamples: number;
};

type AIMetricsSnapshot = AIMetricsBucket & {
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

const recordAiMetric = (args: {
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

const stableStringify = (input: any): string => {
    const normalize = (value: any): any => {
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') {
            return Object.keys(value).sort().reduce((acc: any, key) => {
                acc[key] = normalize(value[key]);
                return acc;
            }, {});
        }
        return value;
    };
    return JSON.stringify(normalize(input));
};

const hashString = (str: string): string => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
};

export const extractJson = (text: string) => {
    if (!text) return "{}";
    try {
        let cleanText = text.trim();
        // 1. 清除 BOM 字符和 NUL 控制字符
        cleanText = cleanText.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
        // 2. 清除可能的 <think>...</think> 思考标记
        cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        // 3. 剥除可能的 markdown 代码块标记
        cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        // 4. 清除其他不可见控制字符 (保留换行和tab)
        cleanText = cleanText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // 查找第一个合法的 JSON 起始符
        const startBrace = cleanText.indexOf('{');
        const startBracket = cleanText.indexOf('[');

        let start = -1;
        let isArray = false;

        if (startBrace !== -1 && startBracket !== -1) {
            start = Math.min(startBrace, startBracket);
            isArray = start === startBracket;
        } else if (startBrace !== -1) {
            start = startBrace;
        } else if (startBracket !== -1) {
            start = startBracket;
            isArray = true;
        }

        if (start === -1) return "{}";

        // 从后往前找对应的结束符
        const endChar = isArray ? ']' : '}';
        const end = cleanText.lastIndexOf(endChar);

        if (end === -1 || end < start) return isArray ? "[]" : "{}";

        return cleanText.substring(start, end + 1);
    } catch (e) {
        console.error("JSON Extraction Failed", e);
        return "{}";
    }
};

/**
 * 安全的 JSON 解析：解析失败时返回默认值而不是抛出异常
 */
export const safeJsonParse = <T = any>(text: string, fallback: T): T => {
    try {
        const extracted = extractJson(text);
        return JSON.parse(extracted);
    } catch (e) {
        console.warn('[safeJsonParse] JSON 解析失败，使用默认值。原始文本前200字符:', text?.substring(0, 200));
        return fallback;
    }
};

const getAppSettings = () => {
    try {
        const raw = localStorage.getItem('sciflow_app_settings');
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
};

/**
 * 全局 Gemini API Key 读取入口。
 * 只读取用户在设置页填写的 Key（存入 localStorage）。
 * 不再使用环境变量。
 */
export const getGeminiApiKey = (): string => {
    try {
        const settings = getAppSettings();
        return settings?.geminiConfig?.apiKey?.trim() || '';
    } catch {
        return '';
    }
};


/**
 * 智能路由与容错适配器 v5.2
 * 针对 429 错误执行深度优化：
 * 1. 动态检测并发冲突
 * 2. 增加针对 429 的指数退避时长
 */
class UniversalAIAdapter {
    private googleClient: GoogleGenAI;
    private provider: string;
    private settings: any;
    private onModelSwitch?: (modelInfo: string) => void;

    constructor(onModelSwitch?: (info: string) => void) {
        // 强制避开普通存取缓存，动态全量抓取 LocalStorage 确保设置页修改后立即对全局工具生效
        this.settings = getAppSettings();
        this.provider = this.settings.activeModelProvider || 'auto';
        this.onModelSwitch = onModelSwitch;

        // 读取 Gemini 凭证（仅用于 Gemini 原生路由）
        const { apiKey: initKey, baseUrl: initBaseUrl } = this.getActiveApiKeyAndUrl('gemini');

        // 诊断日志 (脱敏)
        const openaiKey = this.settings.openaiConfig?.apiKey?.trim() || '';
        const openaiBaseUrl = this.settings.openaiConfig?.baseUrl?.trim() || '';
        if (!initKey) {
            if (openaiKey && openaiBaseUrl) {
                // 有 openaiConfig：Gemini 客户端不会被实际调用
                console.log(`[UniversalAIAdapter] 当前供应商: OpenAI 兼容 (${openaiBaseUrl})，Gemini key 未配置小事`);
            } else {
                console.error("[UniversalAIAdapter] CRITICAL: No API Key found in settings. Please configure a key in the Settings page.");
            }
        } else {
            const geminiConfigKey = this.settings.geminiConfig?.apiKey?.trim();
            console.log(`[UniversalAIAdapter] Gemini Key: ${initKey.substring(0, 4)}...${initKey.substring(initKey.length - 4)} (Source: ${geminiConfigKey === initKey ? 'Gemini Settings' : 'Provider Settings'})`);
        }
        if (initBaseUrl) {
            console.log(`[UniversalAIAdapter] Using Gemini Base URL: ${initBaseUrl}`);
        }

        // ⚠️ GoogleGenAI SDK 构造函数要求 apiKey 非空，否则直接抛错。
        // 当 gemini key 为空时（用户只配了 openaiConfig），用占位符初始化以绕过检查。
        // 此客户端在 openai 路由时不会被实际调用。
        this.googleClient = new GoogleGenAI({
            apiKey: initKey || 'not-used-openai-route',
            ...(initBaseUrl ? { baseUrl: initBaseUrl } : {})
        });
    }

    /**
     * 统一的 Gemini apiKey + baseUrl 读取入口（仅返回 Gemini 原生凭证）。
     *
     * ⚠️ 此方法不处理 OpenAI 兼容路由。非 Gemini 供应商的路由在 routeWithFallback 层完成。
     *
     * 优先级（从高到低）：
     *   1. 非 Gemini/auto 路由 → 对应 providerConfig
     *   2. geminiConfig（含自定义代理 baseUrl）
     *   3. 设置为空时返回 ''（不再兜底到环境变量）
     */
    private getActiveApiKeyAndUrl(forceProvider?: string): { apiKey: string; baseUrl: string } {
        const activeProvider = forceProvider || this.provider;
        const geminiConfigKey = this.settings.geminiConfig?.apiKey?.trim();
        const geminiBaseUrl = this.settings.geminiConfig?.baseUrl?.trim() || '';

        // 1. 非 Gemini/auto 路由：优先使用对应供应商的 config
        if (activeProvider && activeProvider !== 'gemini' && activeProvider !== 'auto') {
            const providerConfig = this.settings[`${activeProvider}Config`];
            if (providerConfig?.apiKey?.trim()) {
                return {
                    apiKey: providerConfig.apiKey.trim(),
                    baseUrl: providerConfig.baseUrl?.trim() || ''
                };
            }
        }

        // 2. geminiConfig（含代理场景）。不再兜底到 env。
        return {
            apiKey: geminiConfigKey || '',
            baseUrl: geminiBaseUrl
        };
    }

    get models() {
        return {
            generateContent: async (params: any) => this.routeWithFallback(params),
            generateContentStream: (params: any) => this.googleClient.models.generateContentStream(params),
            generateVideos: async (params: any) => this.googleClient.models.generateVideos(params),
            generateImages: async (params: any) => this.executeGenerateImages(params),
            embedContent: async (params: any) => this.executeEmbedContent(params)
        };
    }

    private async routeWithFallback(params: any) {
        const taskText = this.extractTextFromParams(params);
        const taskType = this.classifyTask(taskText);
        recordAiMetric({ taskType });
        const canUseCache = this.shouldUseRequestCache(params);
        const cacheKey = canUseCache ? this.buildRequestCacheKey(params, taskType) : '';

        if (canUseCache && cacheKey) {
            const cached = aiResponseCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                recordAiMetric({ taskType, cacheHit: true, success: true, countRequest: false, source: 'cache' });
                return cached.value;
            }
            if (cached) aiResponseCache.delete(cacheKey);
            const inflight = aiInflightRequests.get(cacheKey);
            if (inflight) {
                recordAiMetric({ taskType, dedupHit: true, success: true, countRequest: false, source: 'dedup' });
                return inflight;
            }
        }

        const execute = async () => {
            let providers: string[] = [];

            if (this.provider === 'auto') {
                // ── 智能自动模式：用所有配置了 key 的供应商，按优先级尝试 ──
                const hasGeminiKey = !!this.settings.geminiConfig?.apiKey?.trim();
                const hasOpenAIKey = !!(this.settings.openaiConfig?.apiKey?.trim() && this.settings.openaiConfig?.baseUrl?.trim());
                const hasAnthropicKey = !!this.settings.anthropicConfig?.apiKey?.trim();
                const hasDoubaoKey = !!(this.settings.doubaoConfig?.apiKey?.trim() && this.settings.doubaoConfig?.baseUrl?.trim());

                const hasImages = this.checkIfHasImages(params);
                if (hasImages) {
                    // 图像任务只走 gemini（Imagen）
                    providers = ['gemini'];
                } else {
                    // 按优先级把有 key 的供应商加入列表
                    if (hasGeminiKey) providers.push('gemini');
                    if (hasOpenAIKey) providers.push('openai');
                    if (hasAnthropicKey) providers.push('anthropic');
                    if (hasDoubaoKey) providers.push('doubao');
                    // 没有任何 key 时也尝试 gemini（会直接报错，让用户知道需要配置）
                    if (providers.length === 0) providers = ['gemini'];
                }
                console.log(`[AI Router] Auto mode → providers: [${providers.join(', ')}]`);
            } else {
                // ── 明确指定供应商：只用那个供应商的 key，不跨供应商兜底 ──
                providers = [this.provider];
                console.log(`[AI Router] Fixed mode → provider: ${this.provider}`);
            }

            let lastError: any = null;
            for (const p of providers) {
                try {
                    this.notifyModelSwitch(p, taskType);
                    const finalParams = this.applySpeedProfile({ ...params }, taskType);
                    if (p === 'gemini') {
                        const isThinkingModel = String(params.model || "").includes('thinking');
                        if (isThinkingModel) {
                            finalParams.config = {
                                ...finalParams.config,
                                thinkingConfig: { thinkingBudget: taskType === 'reasoning' ? 1024 : 0 }
                            };
                        }
                    }
                    const startedAt = Date.now();
                    const result = await this.executeDirectRoute(p, finalParams, taskType);
                    recordAiMetric({
                        taskType,
                        provider: p,
                        network: true,
                        success: true,
                        durationMs: Date.now() - startedAt,
                        countRequest: false,
                        source: 'network'
                    });
                    return result;
                } catch (e: any) {
                    recordAiMetric({ taskType, provider: p, network: true, failure: true, countRequest: false, source: 'network' });
                    lastError = e;
                    const isRateLimit = e?.status === 429 || e?.message?.includes('429');
                    if (isRateLimit) {
                        console.warn(`[AI Router] ${p} 触发频率限制 (429)${providers.length > 1 ? ', 尝试切换下一个供应商...' : ', 准备进入退避模式...'}`);
                        if (providers.indexOf(p) < providers.length - 1) {
                            continue;
                        }
                        throw e;
                    }
                    // 非限流错误：如果还有其他供应商，继续尝试；否则直接抛出
                    if (providers.indexOf(p) < providers.length - 1) {
                        console.warn(`[AI Router] ${p} 出错，尝试下一个供应商...`, e);
                        continue;
                    }
                    throw e;
                }
            }
            throw lastError || new Error("AI 服务不可用");
        };

        if (!canUseCache || !cacheKey) {
            return execute();
        }

        const requestPromise = execute()
            .then((result) => {
                aiInflightRequests.delete(cacheKey);
                aiResponseCache.set(cacheKey, { expiresAt: Date.now() + AI_RESPONSE_CACHE_TTL_MS, value: result });
                if (aiResponseCache.size > AI_RESPONSE_CACHE_MAX) {
                    const firstKey = aiResponseCache.keys().next().value;
                    if (firstKey) aiResponseCache.delete(firstKey);
                }
                return result;
            })
            .catch((error) => {
                aiInflightRequests.delete(cacheKey);
                throw error;
            });

        aiInflightRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    private applySpeedProfile(params: any, taskType: 'reasoning' | 'polish' | 'general') {
        const mode = getAISpeedMode();
        const config = { ...(params.config || {}) };
        const incomingBudget = Number(config?.thinkingConfig?.thinkingBudget);

        const profile = mode === 'quality'
            ? { reasoningDefault: 1024, reasoningCap: 4096 }
            : mode === 'balanced'
                ? { reasoningDefault: 512, reasoningCap: 1024 }
                : { reasoningDefault: 256, reasoningCap: 512 };

        const targetBudget = taskType === 'reasoning'
            ? (Number.isFinite(incomingBudget) ? Math.min(incomingBudget, profile.reasoningCap) : profile.reasoningDefault)
            : 0;

        config.thinkingConfig = {
            ...(config.thinkingConfig || {}),
            thinkingBudget: Math.max(0, targetBudget)
        };

        return { ...params, config };
    }


    private notifyModelSwitch(p: string, taskType: string) {
        let label = p.toUpperCase();
        if (p === 'gemini') label = taskType === 'reasoning' ? 'GEMINI PRO' : 'GEMINI FLASH';
        this.onModelSwitch?.(label);
        window.dispatchEvent(new CustomEvent('sciflow_ai_router_event', { detail: { provider: p, info: label } }));
    }

    private isConfigured(provider: string): boolean {
        const config = this.settings[`${provider}Config`];
        return !!(config && config.apiKey);
    }

    private classifyTask(prompt: string): 'reasoning' | 'polish' | 'general' {
        const lower = prompt.toLowerCase();
        if (lower.includes('doe') || lower.includes('calculate') || lower.includes('reasoning')) return 'reasoning';
        return 'general';
    }

    private extractTextFromParams(params: any): string {
        if (!params || !params.contents) return "";
        if (typeof params.contents === 'string') return params.contents;

        const extractFromPart = (p: any): string => {
            if (typeof p === 'string') return p;
            if (p.text) return p.text;
            if (p.parts) return p.parts.map(extractFromPart).join('');
            return "";
        };

        if (Array.isArray(params.contents)) {
            return params.contents.map(extractFromPart).join('');
        }

        return extractFromPart(params.contents);
    }

    private checkIfHasImages(params: any): boolean {
        if (!params || !params.contents) return false;

        const findImage = (p: any): boolean => {
            if (p.inlineData) return true;
            if (Array.isArray(p)) return p.some(findImage);
            if (p.parts) return findImage(p.parts);
            return false;
        };

        if (Array.isArray(params.contents)) {
            return params.contents.some(findImage);
        }
        return findImage(params.contents);
    }

    private shouldUseRequestCache(params: any): boolean {
        const isImageTask = this.checkIfHasImages(params) || !!params?.config?.imageConfig;
        const isAudioTask = Array.isArray(params?.config?.responseModalities) &&
            params.config.responseModalities.some((m: string) => m === 'AUDIO' || m === 'audio');
        if (isImageTask || isAudioTask) return false;
        const contentText = this.extractTextFromParams(params);
        return !!contentText && contentText.length > 0;
    }

    private buildRequestCacheKey(params: any, taskType: string): string {
        const routeConfig = {
            provider: this.provider,
            gemini: {
                baseUrl: this.settings?.geminiConfig?.baseUrl || '',
                modelName: this.settings?.geminiConfig?.modelName || '',
            },
            openai: {
                baseUrl: this.settings?.openaiConfig?.baseUrl || '',
                modelName: this.settings?.openaiConfig?.modelName || '',
            },
            anthropic: {
                baseUrl: this.settings?.anthropicConfig?.baseUrl || '',
                modelName: this.settings?.anthropicConfig?.modelName || '',
            },
            doubao: {
                baseUrl: this.settings?.doubaoConfig?.baseUrl || '',
                modelName: this.settings?.doubaoConfig?.modelName || '',
            }
        };
        const payload = {
            v: 1,
            taskType,
            routeConfig,
            params
        };
        return hashString(stableStringify(payload));
    }

    private shouldUseGeminiStream(params: any, isAudioTask: boolean, isImageTask: boolean): boolean {
        if (isAudioTask || isImageTask) return false;
        if (this.checkIfHasImages(params)) return false;
        if (params?.config?.responseMimeType === 'application/json') return false;
        if (params?.config?.responseSchema) return false;
        const contentText = this.extractTextFromParams(params);
        return contentText.length > 120;
    }

    private async generateContentViaStream(params: any) {
        const streamResp: any = await this.googleClient.models.generateContentStream(params);
        let aggregatedText = '';
        let lastChunk: any = null;
        for await (const chunk of streamResp) {
            lastChunk = chunk;
            if (typeof chunk?.text === 'string') aggregatedText += chunk.text;
        }
        if (!aggregatedText && typeof lastChunk?.text === 'string') {
            aggregatedText = lastChunk.text;
        }
        return {
            text: aggregatedText || '',
            raw: lastChunk || streamResp
        };
    }

    private async executeDirectRoute(provider: string, params: any, taskType: string) {
        if (provider === 'gemini') {
            const configuredModel = this.settings?.geminiConfig?.modelName;
            const defaultModelToUse = (params.model === PRO_MODEL || taskType === 'reasoning') ? PRO_MODEL : FAST_MODEL;

            // 检测是否为特殊任务（TTS 或图像生成）
            const isAudioTask = Array.isArray(params.config?.responseModalities) &&
                params.config.responseModalities.some((m: string) => m === 'AUDIO' || m === 'audio');
            const isImageTask = !!(params.config?.imageConfig);

            // 特殊任务：始终使用代码指定的原始模型；普通任务：允许用户配置覆盖
            const rawModelToUse = (isAudioTask || isImageTask)
                ? (params.model || defaultModelToUse)
                : (configuredModel || defaultModelToUse);

            // 安全校验（仅影响直连 Google API 路径）：
            // 代理专属模型名（如 gemini-3.0-flash、gemini-3-pro-preview-h）在 Google 直连 API 不存在。
            // 使用白名单而非正则，确保 gemini-3.0-flash 这类含小数点但不存在的名称也能被过滤。
            const GEMINI_SAFE_FALLBACK = 'gemini-3.1-pro';
            const KNOWN_GOOGLE_MODELS_PREFIXES = [
                'gemini-1.0', 'gemini-1.5', 'gemini-2.0', 'gemini-2.5',
                'gemini-3.0', 'gemini-3.1', 'gemini-exp', 'learnlm', 'gemini-3'
            ];
            const isValidGoogleModelName = (name: string) =>
                KNOWN_GOOGLE_MODELS_PREFIXES.some(prefix => name.startsWith(prefix));

            // --- 修复：始终通过统一入口读取激活供应商的 apiKey 和 baseUrl ---
            const { apiKey: geminiApiKey, baseUrl: geminiBaseUrl } = this.getActiveApiKeyAndUrl('gemini');

            const modelToUse = (isValidGoogleModelName(rawModelToUse) || geminiBaseUrl)
                ? rawModelToUse
                : GEMINI_SAFE_FALLBACK;

            if (rawModelToUse !== modelToUse) {
                console.warn(`[Core] 模型名 "${rawModelToUse}" 在 Google 直连 API 不存在，已降级为 "${GEMINI_SAFE_FALLBACK}"（代理路径仍使用原模型名）`);
            }

            if (geminiBaseUrl) {
                try {
                    console.log(`[AI Router] Using Manual Proxy Fetch for Gemini: ${geminiBaseUrl} with model: ${modelToUse}`);
                    // 构造 Google 风格的 API 地址 (通常代理商会支持 v1beta 路径映射)
                    const url = `${geminiBaseUrl.replace(/\/$/, '')}/v1beta/models/${modelToUse}:generateContent?key=${geminiApiKey}`;

                    const fetchResponse = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(params)
                    });

                    if (fetchResponse.ok) {
                        const data = await fetchResponse.json();
                        let extractedText = "";
                        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                            extractedText = data.candidates[0].content.parts[0].text;
                        } else if (typeof data.text === 'string') {
                            extractedText = data.text;
                        }
                        return { text: extractedText || "", raw: data };
                    } else {
                        const errText = await fetchResponse.text();
                        console.error(`[AI Router] Gemini Proxy returned ${fetchResponse.status}: ${errText}`);
                        throw { status: fetchResponse.status, message: `Proxy Error (${fetchResponse.status}): ${errText}` };
                    }
                } catch (e: any) {
                    console.error("[AI Router] Gemini Proxy Request Failed", e);
                    // 如果有多个 provider，throw 后会被 routeWithFallback 捕获并尝试下一个
                    throw e;
                }
            }

            const directParams = { ...params, model: modelToUse };
            let response: any;
            if (this.shouldUseGeminiStream(params, isAudioTask, isImageTask)) {
                try {
                    response = await this.generateContentViaStream(directParams);
                } catch (streamErr) {
                    console.warn('[AI Router] Stream path failed, fallback to generateContent', streamErr);
                    response = await this.googleClient.models.generateContent(directParams);
                }
            } else {
                response = await this.googleClient.models.generateContent(directParams);
            }

            // 健壮地提取文本内容
            let extractedText = "";
            try {
                // 优先检查 text 属性（在当前 SDK 中它是 getter，直接访问即可）
                if (typeof response.text === 'string') {
                    extractedText = response.text;
                } else if (response.candidates?.[0]?.content?.parts) {
                    // 后备方案：遍历 candidates
                    extractedText = response.candidates[0].content.parts.map((p: any) => p.text || '').join('');
                } else {
                    // 万能后备：强制转字符串，并处理可能的空值
                    extractedText = String(response.text || "");
                }
            } catch (e) {
                console.error("[UniversalAIAdapter] Text extraction failed", e);
            }

            return {
                text: extractedText || "",
                raw: response
            };
        }
        return this.callOpenAIStyle(provider, this.settings[`${provider}Config`], params);
    }

    private async executeEmbedContent(params: any) {
        const { apiKey: geminiApiKey, baseUrl: geminiBaseUrl } = this.getActiveApiKeyAndUrl('gemini');

        // 没有有效的 Gemini Key：Embedding 无法走 OpenAI 兼容路由，给出明确提示
        if (!geminiApiKey || geminiApiKey === 'not-used-openai-route') {
            throw new Error(
                '训练大脑功能需要配置有效的 Gemini API Key（Embedding 接口不支持 OpenAI 兼容路由）。' +
                '请前往设置页，在【Gemini 配置】中填写您的 Google AI Studio API Key。'
            );
        }

        const model = params.model || 'text-embedding-004';

        // 有代理 baseUrl：走代理 fetch
        if (geminiBaseUrl) {
            const url = `${geminiBaseUrl.replace(/\/$/, '')}/v1beta/models/${model}:embedContent?key=${geminiApiKey}`;
            const body: any = { model, content: { parts: [{ text: params.contents }] } };
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Embedding Proxy Error (${res.status}): ${errText}`);
            }
            return res.json();
        }

        // 直连 Google API：用当前有效 key 重新实例化客户端（避免使用构造时的占位符 key）
        const freshClient = new GoogleGenAI({ apiKey: geminiApiKey });
        return freshClient.models.embedContent(params);
    }

    private async executeGenerateImages(params: any) {
        // --- 修复：图像生成也通过统一入口读取激活供应商的 apiKey 和 baseUrl ---
        const { apiKey: geminiApiKey, baseUrl: geminiBaseUrl } = this.getActiveApiKeyAndUrl('gemini');
        const modelToUse = params.model || 'imagen-3.0-generate-002';

        if (geminiBaseUrl) {
            console.log(`[AI Router] Proxy detected, attempting cross-platform Image Gen: ${geminiBaseUrl}`);

            // --- 尝试 1: OpenAI 兼容接口 (多数代理支持) ---
            try {
                const openAIUrl = `${geminiBaseUrl.replace(/\/v1beta$/, '').replace(/\/$/, '')}/v1/images/generations`;
                const aiRes = await fetch(openAIUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${geminiApiKey}`
                    },
                    body: JSON.stringify({
                        model: "dall-e-3", // 代理通常将 dall-e-3 映射到最佳可用模型
                        prompt: params.prompt,
                        n: 1,
                        size: "1024x1024",
                        response_format: "b64_json"
                    })
                });

                if (aiRes.ok) {
                    const data = await aiRes.json();
                    const b64 = data.data?.[0]?.b64_json;
                    if (b64) {
                        console.log("[AI Router] OpenAI-style Image Gen Success");
                        return {
                            generatedImages: [{ image: { imageBytes: b64 } }]
                        };
                    }
                }
            } catch (e) {
                console.warn("[AI Router] OpenAI-style Image Gen fallback failed", e);
            }

            // --- 尝试 2: Google Imagen 3 兼容接口 (通过代理) ---
            try {
                const url = `${geminiBaseUrl.replace(/\/$/, '')}/v1beta/models/${modelToUse}:predict?key=${geminiApiKey}`;
                const fetchResponse = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instances: [{ prompt: params.prompt || params.contents?.[0]?.parts?.[0]?.text }],
                        parameters: params.config
                    })
                });

                if (fetchResponse.ok) {
                    const data = await fetchResponse.json();
                    return {
                        generatedImages: data.predictions?.map((p: any) => ({
                            image: { imageBytes: p.bytesBase64Encoded || p.image?.imageBytes }
                        })) || []
                    };
                } else {
                    const errText = await fetchResponse.text();
                    throw new Error(`Proxy Imagen Error (${fetchResponse.status}): ${errText}`);
                }
            } catch (e: any) {
                console.error("[AI Router] Imagen Proxy Request Failed", e);
                throw new Error(`图像生成失败（代理路径）：${e.message || '未知错误'}。请检查代理是否支持图像模型（dall-e-3 或 imagen）。`);
            }
        }

        // --- 仅在无代理时使用官方 SDK ---
        return this.googleClient.models.generateImages(params);
    }


    private async callOpenAIStyle(provider: string, config: any, params: any) {
        const { apiKey, modelName: configModelName } = config;
        // ⚠️ 优先使用 config 中的模型名（OpenAI 侧模型名）。
        const modelName = configModelName || params.model || 'gpt-4o-mini';
        const baseUrl = config.baseUrl || 'https://api.openai.com/v1';

        // 诊断日志（脱敏）
        if (apiKey) {
            console.log(`[OpenAI Style] provider=${provider} | baseUrl=${baseUrl} | model=${modelName} | key=${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`);
        } else {
            console.error(`[OpenAI Style] ❌ apiKey 为空！provider=${provider} | 请检查设置页是否保存了 Key`);
        }

        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
        const directUrl = `${normalizedBaseUrl}/chat/completions`;
        const isLocalDev = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
        const useDevProxy = isLocalDev && /https?:\/\/new\.12ai\.org(?:\/v1)?$/i.test(normalizedBaseUrl);
        const rendererUrl = useDevProxy ? '/api/openai/v1/chat/completions' : directUrl;
        const fallbackUserText =
            this.extractTextFromParams(params) ||
            params?.prompt ||
            params?.input ||
            params?.text ||
            '请处理用户请求。';
        let openAIMessages = this.convertToOpenAIMessages(params);
        if (!Array.isArray(openAIMessages) || openAIMessages.length === 0) {
            openAIMessages = [{ role: 'user', content: String(fallbackUserText) }];
        }

        const buildRequestBody = (messages: any[]) => JSON.stringify({
            model: modelName,
            messages,
            temperature: params.config?.temperature ?? 0.7
        });
        let requestBody = buildRequestBody(openAIMessages);

        const hasElectronHttpBridge = typeof window !== 'undefined' && !!window.electron?.httpRequest;

        let responseOk = false;
        let responseStatus = 0;
        let responseBody = '';
        let contentType = '';

        const sendRequest = async (body: string) => {
            if (hasElectronHttpBridge) {
                const electronResp = await window.electron!.httpRequest({
                    url: directUrl,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body
                });
                return {
                    ok: !!electronResp.ok,
                    status: Number(electronResp.status) || 0,
                    body: electronResp.body || '',
                    contentType: (electronResp.headers?.['content-type'] || '').toLowerCase(),
                };
            }

            const response = await fetch(rendererUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body
            });
            return {
                ok: response.ok,
                status: response.status,
                body: await response.text(),
                contentType: (response.headers.get('content-type') || '').toLowerCase(),
            };
        };

        let requestResult = await sendRequest(requestBody);
        responseOk = requestResult.ok;
        responseStatus = requestResult.status;
        responseBody = requestResult.body;
        contentType = requestResult.contentType;

        // 兼容部分代理的异常解析：若返回提示缺少 messages，则改用最小纯文本消息重试一次
        if (!responseOk && /field\s+messages\s+is\s+required/i.test(responseBody || '')) {
            requestBody = buildRequestBody([{ role: 'user', content: String(fallbackUserText) }]);
            requestResult = await sendRequest(requestBody);
            responseOk = requestResult.ok;
            responseStatus = requestResult.status;
            responseBody = requestResult.body;
            contentType = requestResult.contentType;
        }

        // 检查响应类型，防止将 HTML 页面作为 JSON 解析
        const isHtml = contentType.includes('text/html') || contentType.includes('text/plain');
        if (!responseOk || isHtml) {
            if (responseStatus === 524) {
                const msg = `上游网关超时 (524)，请求未在时限内完成：${directUrl}。这通常是代理链路抖动或上游拥塞，不一定是 BaseUrl 配置错误。`;
                console.error(`[OpenAI Style Error] ${msg}`);
                throw { status: responseStatus, message: msg };
            }
            if (isHtml || responseBody.trim().startsWith('<')) {
                // 服务器返回了 HTML 页面，通常是 URL 路径不对
                const hint = baseUrl.endsWith('/v1') ? '' : '（提示：BaseUrl 可能需要以 /v1 结尾，如 https://new.12ai.org/v1）';
                const msg = `接口返回了 HTML 页面而非 JSON，请检查 BaseUrl 是否正确 ${hint}: ${directUrl}`;
                console.error(`[OpenAI Style Error] ${msg}`);
                throw { status: responseStatus || 0, message: msg };
            }
            console.error(`[OpenAI Style Error] ${provider} returned ${responseStatus}: ${responseBody}`);
            throw { status: responseStatus, message: `API Error: ${responseStatus} - ${responseBody}` };
        }

        // 安全解析 JSON
        try {
            const data = JSON.parse(responseBody);
            const content = data.choices?.[0]?.message?.content || "";
            return { text: content };
        } catch (e) {
            const hint = baseUrl.endsWith('/v1') ? '' : '（提示：BaseUrl 可能需要以 /v1 结尾）';
            const msg = `接口返回非法 JSON ${hint}。响应内容: ${responseBody.substring(0, 200)}`;
            console.error(`[OpenAI Style Error] ${msg}`);
            throw { status: 0, message: msg };
        }
    }

    private convertToOpenAIMessages(params: any): any[] {
        const messages: any[] = [];

        // 1. Handle system instruction
        if (params.config?.systemInstruction) {
            const si = params.config.systemInstruction;
            let systemContent = "";
            if (typeof si === 'string') {
                systemContent = si;
            } else if (si.parts && Array.isArray(si.parts)) {
                systemContent = si.parts.map((p: any) => p.text || '').join('\n');
            } else if (si.text) {
                systemContent = si.text;
            }
            if (systemContent) {
                messages.push({ role: 'system', content: systemContent });
            }
        }

        // 2. Normalize contents to an array of Content objects
        let normalizedContents: any[] = [];
        const rawContents = params.contents;

        if (!rawContents) {
            return messages;
        } else if (Array.isArray(rawContents)) {
            // Check if it's an array of Content objects (with role/parts) or Part objects
            const isListOfContents = rawContents.length > 0 &&
                (typeof rawContents[0] === 'object' && (rawContents[0].parts || rawContents[0].role));

            if (isListOfContents) {
                normalizedContents = rawContents;
            } else {
                // It's a list of parts for a single user message (one turn shorthand)
                normalizedContents = [{ role: 'user', parts: rawContents }];
            }
        } else if (typeof rawContents === 'object') {
            if (rawContents.parts) {
                normalizedContents = [rawContents];
            } else {
                // Single part shorthand or unknown object
                normalizedContents = [{ role: 'user', parts: [rawContents] }];
            }
        } else if (typeof rawContents === 'string') {
            normalizedContents = [{ role: 'user', parts: [{ text: rawContents }] }];
        }

        // 3. Convert normalized contents to OpenAI messages
        normalizedContents.forEach((c: any) => {
            const role = (c.role === 'model' || c.role === 'assistant') ? 'assistant' : 'user';

            if (Array.isArray(c.parts)) {
                const hasImage = c.parts.some((p: any) => p.inlineData);

                if (hasImage) {
                    const contentArray = c.parts.map((p: any) => {
                        if (p.inlineData) {
                            return {
                                type: "image_url",
                                image_url: {
                                    url: `data:${p.inlineData.mimeType || 'image/jpeg'};base64,${p.inlineData.data}`
                                }
                            };
                        } else if (p.text) {
                            return { type: "text", text: p.text };
                        }
                        return null;
                    }).filter(Boolean);

                    messages.push({ role, content: contentArray });
                } else {
                    const text = c.parts.map((p: any) => p.text || '').join('\n');
                    if (text) messages.push({ role, content: text });
                }
            } else if (typeof c.parts === 'string') {
                messages.push({ role, content: c.parts });
            } else if (c.text) {
                messages.push({ role, content: String(c.text) });
            }
        });

        return messages;
    }
}

/**
 * 检查是否有任何 AI 供应商的 API Key 已配置
 */
export const isAnyApiKeyConfigured = (): boolean => {
    const settings = getAppSettings();
    const hasGemini = !!settings?.geminiConfig?.apiKey?.trim();
    const hasOpenAI = !!settings?.openaiConfig?.apiKey?.trim();
    const hasAnthropic = !!settings?.anthropicConfig?.apiKey?.trim();
    const hasDoubao = !!settings?.doubaoConfig?.apiKey?.trim();
    return hasGemini || hasOpenAI || hasAnthropic || hasDoubao;
};

export const callGeminiWithRetry = async <T>(
    operation: (ai: any) => Promise<T>,
    retries?: number
): Promise<T> => {
    // ── 前置检查：如果没有任何 API Key，派发事件通知前端弹出引导 ──
    if (!isAnyApiKeyConfigured()) {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sciflow_no_api_key'));
        }
        throw new Error('尚未配置 AI 服务密钥。请在设置中配置 API Key 后再试。');
    }

    const speedMode = getAISpeedMode();
    const selectedProfile = getRetryProfile(speedMode);

    // 使用 Web Lock API 防止 Chrome 后台标签冻结 JS 执行
    // 当持有 lock 时，Chrome 不会对此标签页执行 Intensive Throttling
    const lockName = `sciflow_ai_task_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const isRetryableError = (error: any): boolean => {
        const status = Number(error?.status || 0);
        const message = String(error?.message || '').toLowerCase();
        return (
            status === 429 ||
            status === 502 ||
            status === 503 ||
            status === 504 ||
            status === 524 ||
            status === 0 ||
            message.includes('429') ||
            message.includes('rate limit') ||
            message.includes('network') ||
            message.includes('fetch') ||
            message.includes('timeout') ||
            message.includes('524') ||
            message.includes('gateway')
        );
    };

    const executeWithRetry = async (profile: ReturnType<typeof getRetryProfile>, maxRetries: number): Promise<T> => {
        let lastError: any;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                const ai = new UniversalAIAdapter();
                return await operation(ai);
            } catch (error: any) {
                lastError = error;
                const errorMessage = error?.message || '';
                const status = error?.status;
                console.error("[Gemini API Error]", error);

                const isQuotaExceeded = errorMessage.includes('exceeded your current quota') || errorMessage.includes('quota');
                const isRateLimit = (status === 429 || status === 503 || status === 502 || errorMessage.includes('429')) && !isQuotaExceeded;
                const retryable = isRetryableError(error);

                if (isQuotaExceeded) {
                    console.warn("[AI Gateway] 硬性额度超限，停止重试");
                    throw new Error("API Key 额度已耗尽 (Quota Exceeded)，请更换 Key 或检查账单。");
                }

                if (!retryable) {
                    window.dispatchEvent(new CustomEvent('sciflow_ai_pacing_event', { detail: { active: false } }));
                    throw error;
                }

                if (i < maxRetries) {
                    const baseDelay = isRateLimit ? profile.rateLimitBaseDelayMs : profile.networkBaseDelayMs;
                    const maxDelay = baseDelay * Math.pow(2, i);
                    const jitter = Math.random() * maxDelay;
                    const delay = (baseDelay / 2) + jitter;

                    console.warn(`[AI Queue] 遭遇 ${status || '网络抖动'} 拦截... 第 ${i + 1} 次重试, 延迟 ${Math.round(delay / 1000)}s 退避`);

                    if (isRateLimit) {
                        window.dispatchEvent(new CustomEvent('sciflow_ai_pacing_event', {
                            detail: { active: true, delay: Math.round(delay / 1000) }
                        }));
                    }

                    await new Promise(res => setTimeout(res, delay));
                    continue;
                }
            }
        }
        window.dispatchEvent(new CustomEvent('sciflow_ai_pacing_event', { detail: { active: false } }));
        throw lastError;
    };

    const runWithAutoFallback = async (): Promise<T> => {
        const selectedRetries = typeof retries === 'number' ? retries : selectedProfile.retries;
        try {
            return await executeWithRetry(selectedProfile, selectedRetries);
        } catch (firstError: any) {
            // 低档位失败时自动升档到 quality，提高完成率
            if (typeof retries !== 'number' && speedMode !== 'quality' && isRetryableError(firstError)) {
                console.warn('[AI Retry] 当前速度档位失败，自动升档 quality 重试一次。');
                const qualityProfile = getRetryProfile('quality');
                return executeWithRetry(qualityProfile, qualityProfile.retries);
            }
            throw firstError;
        }
    };

    // Web Lock 保活：在 AI 任务执行期间持有锁，防止浏览器冻结后台标签
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request(lockName, { mode: 'exclusive' }, async () => {
            return runWithAutoFallback();
        });
    }
    // Fallback: 无 Web Lock API 时直接执行
    return runWithAutoFallback();
};
