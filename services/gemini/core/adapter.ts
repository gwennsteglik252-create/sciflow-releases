// ═══ SciFlow Pro — UniversalAIAdapter 智能路由与容错适配器 ═══

import { GoogleGenAI } from "@google/genai";
import { PRO_MODEL, FAST_MODEL, getAppSettings, getAISpeedMode } from './constants';
import { recordAiMetric } from './metrics';
import { stableStringify, hashString } from './utils';

// ── 缓存与去重 ──
const AI_RESPONSE_CACHE_TTL_MS = 90_000;
const AI_RESPONSE_CACHE_MAX = 120;
const aiResponseCache = new Map<string, { expiresAt: number; value: any }>();
const aiInflightRequests = new Map<string, Promise<any>>();

/**
 * 智能路由与容错适配器 v5.2
 * 针对 429 错误执行深度优化：
 * 1. 动态检测并发冲突
 * 2. 增加针对 429 的指数退避时长
 */
export class UniversalAIAdapter {
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
        // ⚠️ googleSearch grounding 的响应包含 groundingMetadata（在 candidates 里），
        //    Stream 模式会丢失该元数据，必须走普通 generateContent
        const hasGoogleSearch = Array.isArray(params?.config?.tools) &&
            params.config.tools.some((t: any) => t && ('googleSearch' in t || 'google_search' in t));
        if (hasGoogleSearch) return false;
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

            // 安全校验
            const GEMINI_SAFE_FALLBACK = 'gemini-3.1-pro';
            const KNOWN_GOOGLE_MODELS_PREFIXES = [
                'gemini-1.0', 'gemini-1.5', 'gemini-2.0', 'gemini-2.5',
                'gemini-3.0', 'gemini-3.1', 'gemini-exp', 'learnlm', 'gemini-3'
            ];
            const isValidGoogleModelName = (name: string) =>
                KNOWN_GOOGLE_MODELS_PREFIXES.some(prefix => name.startsWith(prefix));

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
                        // 透传 candidates 以保留 groundingMetadata 等原始结构
                        return { text: extractedText || "", candidates: data.candidates, raw: data };
                    } else {
                        const errText = await fetchResponse.text();
                        console.error(`[AI Router] Gemini Proxy returned ${fetchResponse.status}: ${errText}`);
                        throw { status: fetchResponse.status, message: `Proxy Error (${fetchResponse.status}): ${errText}` };
                    }
                } catch (e: any) {
                    console.error("[AI Router] Gemini Proxy Request Failed", e);
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
                if (typeof response.text === 'string') {
                    extractedText = response.text;
                } else if (response.candidates?.[0]?.content?.parts) {
                    extractedText = response.candidates[0].content.parts.map((p: any) => p.text || '').join('');
                } else {
                    extractedText = String(response.text || "");
                }
            } catch (e) {
                console.error("[UniversalAIAdapter] Text extraction failed", e);
            }

            // 透传 candidates 以保留 groundingMetadata（googleSearch grounding 必需）
            return {
                text: extractedText || "",
                candidates: response.candidates,
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

        // 直连 Google API：用当前有效 key 重新实例化客户端
        const freshClient = new GoogleGenAI({ apiKey: geminiApiKey });
        return freshClient.models.embedContent(params);
    }

    private async executeGenerateImages(params: any) {
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
                        model: "dall-e-3",
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

        // 兼容部分代理的异常解析
        if (!responseOk && /field\s+messages\s+is\s+required/i.test(responseBody || '')) {
            requestBody = buildRequestBody([{ role: 'user', content: String(fallbackUserText) }]);
            requestResult = await sendRequest(requestBody);
            responseOk = requestResult.ok;
            responseStatus = requestResult.status;
            responseBody = requestResult.body;
            contentType = requestResult.contentType;
        }

        // 检查响应类型
        const isHtml = contentType.includes('text/html') || contentType.includes('text/plain');
        if (!responseOk || isHtml) {
            if (responseStatus === 524) {
                const msg = `上游网关超时 (524)，请求未在时限内完成：${directUrl}。这通常是代理链路抖动或上游拥塞，不一定是 BaseUrl 配置错误。`;
                console.error(`[OpenAI Style Error] ${msg}`);
                throw { status: responseStatus, message: msg };
            }
            if (isHtml || responseBody.trim().startsWith('<')) {
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

        // 2. Normalize contents
        let normalizedContents: any[] = [];
        const rawContents = params.contents;

        if (!rawContents) {
            return messages;
        } else if (Array.isArray(rawContents)) {
            const isListOfContents = rawContents.length > 0 &&
                (typeof rawContents[0] === 'object' && (rawContents[0].parts || rawContents[0].role));

            if (isListOfContents) {
                normalizedContents = rawContents;
            } else {
                normalizedContents = [{ role: 'user', parts: rawContents }];
            }
        } else if (typeof rawContents === 'object') {
            if (rawContents.parts) {
                normalizedContents = [rawContents];
            } else {
                normalizedContents = [{ role: 'user', parts: [rawContents] }];
            }
        } else if (typeof rawContents === 'string') {
            normalizedContents = [{ role: 'user', parts: [{ text: rawContents }] }];
        }

        // 3. Convert to OpenAI messages
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
