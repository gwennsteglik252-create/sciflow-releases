// ═══ SciFlow Pro — AI 核心模块聚合入口 ═══
//
// 此目录从 core.ts 拆分而来，按职责组织：
//   constants.ts   — 模型常量、类型定义、全局配置读取
//   metrics.ts     — AI 调用指标系统（缓存命中率、延迟等）
//   utils.ts       — 工具函数（JSON 提取、哈希、API Key 读取）
//   adapter.ts     — UniversalAIAdapter 智能路由与容错适配器
//   callGemini.ts  — callGeminiWithRetry 核心重试引擎

export { PRO_MODEL, FAST_MODEL, GROUNDING_MODEL, IMAGE_MODEL, SPEED_CONFIG } from './constants';
export type { ModelResponse } from './constants';
export type { AISpeedMode } from './constants';
export { recordAiMetric } from './metrics';
export type { AIMetricsBucket, AIMetricsSnapshot } from './metrics';
export { extractJson, safeJsonParse, getGeminiApiKey } from './utils';
export { UniversalAIAdapter } from './adapter';
export { callGeminiWithRetry, isAnyApiKeyConfigured } from './callGemini';
