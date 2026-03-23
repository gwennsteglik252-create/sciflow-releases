/**
 * AI Provider 注册配置
 * 将各 Provider 的元信息、预设模型、默认值从 SettingsModal 中抽离到独立配置文件
 */

export interface ModelOption {
    label: string;
    value: string;
}

export interface BaseUrlPreset {
    label: string;
    value: string;
    models?: ModelOption[];  // 特定 URL 关联的模型列表
}

export interface ProviderDefinition {
    id: string;
    name: string;
    icon: string;           // FontAwesome icon class
    iconColor: string;      // Tailwind color class
    brandColor: string;     // 品牌主色 (Tailwind bg class)
    description: string;    // 简短描述
    // 配置
    defaultBaseUrl: string;
    baseUrlPresets?: BaseUrlPreset[];   // Base URL 预设列表
    supportsBaseUrl: boolean;           // 是否显示 Base URL 字段
    supportsRefreshModels: boolean;     // 是否支持动态拉取模型
    // 模型
    modelPresets: ModelOption[];
    defaultModel: string;
    modelInputMode: 'select' | 'input'; // doubao 这种纯手动输入用 'input'
    modelFieldLabel?: string;            // 自定义 Model 字段标签, 如 "Endpoint ID"
    // 占位符
    keyPlaceholder: string;
    baseUrlPlaceholder?: string;
    modelPlaceholder?: string;
    // 特殊能力
    isAiStudioSyncable?: boolean;        // 支持 AI Studio 系统授权
}

// ── Gemini ──────────────────────────────────────────────────
const GEMINI_MODELS: ModelOption[] = [
    { label: 'Gemini 2.5 Flash (推荐)', value: 'gemini-2.5-flash-preview-04-17' },
    { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro-preview-03-25' },
    { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
    { label: 'Gemini 2.0 Pro Exp', value: 'gemini-2.0-pro-exp-02-05' },
    { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
    { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
];

// ── OpenAI / Compatible ──────────────────────────────────────
const OPENAI_BASE_URL_PRESETS: BaseUrlPreset[] = [
    {
        label: 'OpenAI Official',
        value: 'https://api.openai.com/v1',
        models: [
            { label: 'GPT-5 (Omni)', value: 'gpt-5' },
            { label: 'GPT-4o (Omni)', value: 'gpt-4o' },
            { label: 'o2 (Reasoning)', value: 'o2' },
            { label: 'o3-mini (Reasoning)', value: 'o3-mini' },
        ],
    },
    {
        label: 'DeepSeek API',
        value: 'https://api.deepseek.com',
        models: [
            { label: 'DeepSeek V3', value: 'deepseek-chat' },
            { label: 'DeepSeek R1 (Reasoner)', value: 'deepseek-reasoner' },
        ],
    },
    {
        label: 'Moonshot (Kimi)',
        value: 'https://api.moonshot.cn/v1',
        models: [
            { label: 'Moonshot V1 8k', value: 'moonshot-v1-8k' },
            { label: 'Moonshot V1 32k', value: 'moonshot-v1-32k' },
            { label: 'Moonshot V1 128k', value: 'moonshot-v1-128k' },
        ],
    },
    {
        label: 'Aliyun DashScope (Qwen)',
        value: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: [
            { label: 'Qwen Max (Tongyi)', value: 'qwen-max' },
            { label: 'Qwen Plus', value: 'qwen-plus' },
            { label: 'Qwen Turbo', value: 'qwen-turbo' },
            { label: 'Qwen Long', value: 'qwen-long' },
        ],
    },
    {
        label: 'SiliconFlow (硅基流动)',
        value: 'https://api.siliconflow.cn/v1',
        models: [
            { label: 'DeepSeek V3', value: 'deepseek-ai/DeepSeek-V3' },
            { label: 'DeepSeek R1', value: 'deepseek-ai/DeepSeek-R1' },
            { label: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
            { label: 'Qwen 2.5 7B', value: 'Qwen/Qwen2.5-7B-Instruct' },
        ],
    },
    {
        label: 'OpenRouter (Aggregator)',
        value: 'https://openrouter.ai/api/v1',
        models: [
            { label: 'Anthropic: Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
            { label: 'Anthropic: Claude 3 Haiku', value: 'anthropic/claude-3-haiku' },
            { label: 'OpenAI: GPT-4o', value: 'openai/gpt-4o' },
            { label: 'Meta: Llama 3.1 70b', value: 'meta-llama/llama-3.1-70b-instruct' },
            { label: 'Google: Gemini Pro 1.5', value: 'google/gemini-pro-1.5' },
        ],
    },
];

const OPENAI_GENERIC_MODELS: ModelOption[] = [
    { label: 'GPT-4o (Omni)', value: 'gpt-4o' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
    { label: 'DeepSeek V3', value: 'deepseek-chat' },
    { label: 'Qwen Max', value: 'qwen-max' },
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620' },
    { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
    { label: 'Llama 3 70B', value: 'llama3-70b' },
];

// ── Anthropic ──────────────────────────────────────────────────
const ANTHROPIC_MODELS: ModelOption[] = [
    { label: 'Claude 4 Opus', value: 'claude-4-opus-20260120' },
    { label: 'Claude 4 Sonnet', value: 'claude-4-sonnet-20251115' },
    { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
    { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620' },
];

// ── Provider 注册表 ──────────────────────────────────────────────
export const PROVIDER_REGISTRY: ProviderDefinition[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        icon: 'fa-wand-magic-sparkles',
        iconColor: 'text-blue-500',
        brandColor: 'bg-blue-500',
        description: '多模态旗舰，擅长视觉理解与长文本',
        defaultBaseUrl: '',
        supportsBaseUrl: true,
        supportsRefreshModels: false,
        modelPresets: GEMINI_MODELS,
        defaultModel: 'gemini-2.0-flash',
        modelInputMode: 'select',
        keyPlaceholder: 'AIzaSy...',
        baseUrlPlaceholder: 'https://your-proxy.com/gemini (可选，留空直连)',
        isAiStudioSyncable: true,
    },
    {
        id: 'openai',
        name: 'OpenAI / 兼容',
        icon: 'fa-bolt',
        iconColor: 'text-emerald-500',
        brandColor: 'bg-emerald-500',
        description: '支持 OpenAI、DeepSeek、Qwen 等兼容 API',
        defaultBaseUrl: 'https://api.openai.com/v1',
        baseUrlPresets: OPENAI_BASE_URL_PRESETS,
        supportsBaseUrl: true,
        supportsRefreshModels: true,
        modelPresets: OPENAI_GENERIC_MODELS,
        defaultModel: 'gpt-4o',
        modelInputMode: 'select',
        keyPlaceholder: 'sk-...',
    },
    {
        id: 'doubao',
        name: 'Doubao (豆包)',
        icon: 'fa-fire',
        iconColor: 'text-orange-500',
        brandColor: 'bg-orange-500',
        description: '字节跳动火山引擎，低成本高并发',
        defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        supportsBaseUrl: false,
        supportsRefreshModels: false,
        modelPresets: [],
        defaultModel: '',
        modelInputMode: 'input',
        modelFieldLabel: 'Endpoint ID',
        keyPlaceholder: 'Ark API Key...',
        modelPlaceholder: 'ep-2024...',
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        icon: 'fa-brain',
        iconColor: 'text-amber-600',
        brandColor: 'bg-amber-600',
        description: '深度推理和复杂任务的顶级引擎',
        defaultBaseUrl: 'https://api.anthropic.com/v1',
        supportsBaseUrl: false,
        supportsRefreshModels: false,
        modelPresets: ANTHROPIC_MODELS,
        defaultModel: 'claude-3-5-sonnet-20240620',
        modelInputMode: 'select',
        keyPlaceholder: 'sk-ant-...',
    },
];

/**
 * 根据 Provider ID 获取定义
 */
export const getProviderById = (id: string): ProviderDefinition | undefined =>
    PROVIDER_REGISTRY.find(p => p.id === id);

/**
 * 根据 OpenAI Base URL 获取关联的模型列表
 */
export const getModelsByBaseUrl = (baseUrl: string): ModelOption[] => {
    const preset = OPENAI_BASE_URL_PRESETS.find(p => p.value === baseUrl);
    return preset?.models || OPENAI_GENERIC_MODELS;
};

/**
 * 获取 OpenAI Base URL 预设列表（仅 label + value, 不含 models）
 */
export const getBaseUrlPresets = (): { label: string; value: string }[] =>
    OPENAI_BASE_URL_PRESETS.map(({ label, value }) => ({ label, value }));
