// ═══ SciFlow Pro — callGeminiWithRetry 核心重试引擎 ═══

import { getAISpeedMode, getRetryProfile, getAppSettings } from './constants';
import { UniversalAIAdapter } from './adapter';

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

    // Web Lock 保活
    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request(lockName, { mode: 'exclusive' }, async () => {
            return runWithAutoFallback();
        });
    }
    return runWithAutoFallback();
};
