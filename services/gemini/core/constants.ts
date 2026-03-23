// ═══ SciFlow Pro — AI 核心常量与类型 ═══

import { GenerateContentResponse } from "@google/genai";

export type ModelResponse = {
    text: string;
    raw?: GenerateContentResponse;
};

// ── 模型常量 ──
// 注意：googleSearch 工具 与 responseSchema/responseMimeType:"application/json" 互斥，必须分两次独立调用
export const PRO_MODEL = 'gemini-3.1-pro';       // 2026 flagship reasoning model
export const FAST_MODEL = 'gemini-1.5-flash';     // 极速模型，用于元数据提取、快速总结等非推理任务
export const GROUNDING_MODEL = 'gemini-1.5-flash';
export const IMAGE_MODEL = 'gemini-3.1-pro';
export const NATIVE_IMAGE_GEN_MODEL = 'gemini-2.0-flash-preview-image-generation'; // 原生图像生成专用模型（支持 imageConfig / responseModalities:IMAGE）

export const SPEED_CONFIG = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
};

export type AISpeedMode = 'fast' | 'balanced' | 'quality';

export const getAppSettings = () => {
    try {
        const raw = localStorage.getItem('sciflow_app_settings');
        if (!raw) return {} as any;
        return JSON.parse(raw);
    } catch {
        return {} as any;
    }
};

export const getAISpeedMode = (): AISpeedMode => {
    try {
        const settings = getAppSettings();
        const mode = settings?.aiSpeedMode;
        if (mode === 'balanced' || mode === 'quality' || mode === 'fast') return mode;
        return 'balanced';
    } catch {
        return 'balanced';
    }
};

export const getRetryProfile = (mode: AISpeedMode) => {
    if (mode === 'quality') return { retries: 5, rateLimitBaseDelayMs: 4000, networkBaseDelayMs: 1000 };
    if (mode === 'balanced') return { retries: 3, rateLimitBaseDelayMs: 2200, networkBaseDelayMs: 800 };
    return { retries: 2, rateLimitBaseDelayMs: 1400, networkBaseDelayMs: 600 };
};
