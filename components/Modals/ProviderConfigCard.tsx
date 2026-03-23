/**
 * ProviderConfigCard — 统一的 AI Provider 配置卡片组件
 * 
 * 特性：
 * - Accordion 折叠/展开
 * - 连接状态指示器 (🟢🟡🔴⚪)
 * - 统一的 API Key / Base URL / Model 表单
 * - 测试连接按钮
 * - 动态模型刷新 (Refresh Models)
 * - 支持自定义模型输入
 */
import React, { useState } from 'react';
import { ProviderDefinition, ModelOption, getModelsByBaseUrl, getBaseUrlPresets } from '../../config/aiProviders';

export type ConnectionStatus = 'idle' | 'untested' | 'testing' | 'connected' | 'error';

export interface ProviderConfigState {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    connectionStatus: ConnectionStatus;
}

interface ProviderConfigCardProps {
    provider: ProviderDefinition;
    config: ProviderConfigState;
    onConfigChange: (patch: Partial<ProviderConfigState>) => void;
    isActive: boolean;             // 是否当前首选引擎
    isAutoMode: boolean;           // 是否处于 auto 模式
    defaultExpanded?: boolean;     // 默认展开
    dynamicModels?: ModelOption[]; // 动态拉取到的模型
    isRefreshing?: boolean;
    onRefreshModels?: () => void;
    onTestConnection?: () => void;
    // OpenAI 特有：Base URL 切换时的 API Key 缓存恢复
    apiKeyCache?: Record<string, string>;
    onApiKeyCacheUpdate?: (baseUrl: string, key: string) => void;
    // Gemini 特有：AI Studio 同步
    isAiStudioAvailable?: boolean;
    onAiStudioSync?: () => void;
}

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; bg: string; label: string }> = {
    idle: { color: 'bg-slate-300', bg: 'text-slate-400', label: '未配置' },
    untested: { color: 'bg-amber-400', bg: 'text-amber-600', label: '待验证' },
    testing: { color: 'bg-blue-400 animate-pulse', bg: 'text-blue-500', label: '测试中...' },
    connected: { color: 'bg-emerald-500', bg: 'text-emerald-600', label: '已连接' },
    error: { color: 'bg-rose-500', bg: 'text-rose-600', label: '连接失败' },
};

const ProviderConfigCard: React.FC<ProviderConfigCardProps> = ({
    provider,
    config,
    onConfigChange,
    isActive,
    isAutoMode,
    defaultExpanded = false,
    dynamicModels = [],
    isRefreshing = false,
    onRefreshModels,
    onTestConnection,
    apiKeyCache,
    onApiKeyCacheUpdate,
    isAiStudioAvailable,
    onAiStudioSync,
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded || isActive);
    const [speedTestStatus, setSpeedTestStatus] = useState<'idle' | 'testing' | 'done' | 'error'>('idle');
    const [speedTestResult, setSpeedTestResult] = useState<{ latency: number; tokensPerSec?: number; model: string } | null>(null);
    const [speedTestError, setSpeedTestError] = useState('');

    // ── 计算连接状态 ──
    const effectiveStatus: ConnectionStatus = !config.apiKey
        ? 'idle'
        : config.connectionStatus;

    const statusCfg = STATUS_CONFIG[effectiveStatus];

    // ── 模型列表计算 ──
    const availableModels: ModelOption[] = (() => {
        if (provider.modelInputMode === 'input') return [];

        // OpenAI 兼容模式：根据 Base URL 匹配模型
        if (provider.id === 'openai') {
            const preset = getModelsByBaseUrl(config.baseUrl);
            const combined = [...preset, ...dynamicModels];
            const seen = new Set<string>();
            return combined.filter(m => {
                if (seen.has(m.value)) return false;
                seen.add(m.value);
                return true;
            });
        }

        return provider.modelPresets;
    })();

    const isCustomModel = availableModels.length > 0 && !availableModels.some(m => m.value === config.modelName);

    // ── Base URL 预设 ──
    const baseUrlPresets = provider.id === 'openai' ? getBaseUrlPresets() : [];
    const isCustomBaseUrl = baseUrlPresets.length > 0 && !baseUrlPresets.some(u => u.value === config.baseUrl);

    // ── 测试连接（通过 Electron 主进程代理绕过 CORS） ──
    const handleTestConnection = async () => {
        if (!config.apiKey) return;
        onConfigChange({ connectionStatus: 'testing' });

        try {
            let testUrl: string;
            let headers: Record<string, string> = {};

            if (provider.id === 'gemini') {
                const base = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
                testUrl = `${base.replace(/\/$/, '')}/models?key=${config.apiKey}`;
            } else {
                const base = config.baseUrl || provider.defaultBaseUrl;
                testUrl = `${base.replace(/\/$/, '')}/models`;
                headers = {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                };
            }

            // 优先使用 Electron IPC 桥绕过 CORS
            if (window.electron?.httpRequest) {
                const resp = await window.electron.httpRequest({
                    url: testUrl,
                    method: 'GET',
                    headers,
                });
                onConfigChange({ connectionStatus: resp.ok ? 'connected' : 'error' });
            } else {
                // 降级：纯浏览器环境直接 fetch（可能被 CORS 拦截）
                const response = await fetch(testUrl, { headers, signal: AbortSignal.timeout(10000) });
                onConfigChange({ connectionStatus: response.ok ? 'connected' : 'error' });
            }
        } catch {
            onConfigChange({ connectionStatus: 'error' });
        }
    };

    // ── 模型测速 ──
    const handleSpeedTest = async () => {
        if (!config.apiKey || !config.modelName) return;
        setSpeedTestStatus('testing');
        setSpeedTestResult(null);
        setSpeedTestError('');

        const startTime = Date.now();
        try {
            let url: string;
            let headers: Record<string, string> = {};
            let body: string;

            if (provider.id === 'gemini') {
                // Gemini 格式
                const base = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
                url = `${base.replace(/\/$/, '')}/models/${config.modelName}:generateContent?key=${config.apiKey}`;
                headers = { 'Content-Type': 'application/json' };
                body = JSON.stringify({
                    contents: [{ parts: [{ text: '请只回复"OK"两个字母。' }] }],
                    generationConfig: { maxOutputTokens: 10, temperature: 0 }
                });
            } else {
                // OpenAI 兼容格式
                const base = config.baseUrl || provider.defaultBaseUrl;
                url = `${base.replace(/\/$/, '')}/chat/completions`;
                headers = {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                };
                body = JSON.stringify({
                    model: config.modelName,
                    messages: [{ role: 'user', content: '请只回复"OK"两个字母。' }],
                    max_tokens: 10,
                    temperature: 0
                });
            }

            let responseOk = false;
            let responseBody = '';

            if (window.electron?.httpRequest) {
                const resp = await window.electron.httpRequest({ url, method: 'POST', headers, body });
                responseOk = resp.ok;
                responseBody = resp.body;
                if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.body?.slice(0, 200)}`);
            } else {
                const resp = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) });
                responseOk = resp.ok;
                responseBody = await resp.text();
                if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${responseBody?.slice(0, 200)}`);
            }

            const latency = Date.now() - startTime;

            // 尝试估算 tokens/s
            let tokensPerSec: number | undefined;
            try {
                const json = JSON.parse(responseBody);
                const usage = json.usageMetadata || json.usage;
                const totalTokens = usage?.totalTokenCount || usage?.total_tokens;
                if (totalTokens && latency > 0) {
                    tokensPerSec = Math.round((totalTokens / latency) * 1000);
                }
            } catch { /* ignore parse errors */ }

            setSpeedTestResult({ latency, tokensPerSec, model: config.modelName });
            setSpeedTestStatus('done');
        } catch (err: any) {
            setSpeedTestError(err?.message?.slice(0, 100) || '测速失败');
            setSpeedTestStatus('error');
        }
    };

    // ── 延迟评级颜色 ──
    const getLatencyColor = (ms: number) => {
        if (ms < 1000) return 'text-emerald-600';
        if (ms < 3000) return 'text-amber-600';
        return 'text-rose-600';
    };
    const getLatencyLabel = (ms: number) => {
        if (ms < 1000) return '极速';
        if (ms < 2000) return '快速';
        if (ms < 4000) return '正常';
        return '较慢';
    };

    return (
        <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isActive && !isAutoMode
            ? 'border-violet-200 shadow-md shadow-violet-100'
            : 'border-slate-100 hover:border-slate-200'
            }`}>
            {/* ── 折叠头部 ── */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {/* Provider 图标 */}
                    <div className={`w-9 h-9 rounded-xl ${provider.brandColor} flex items-center justify-center shadow-sm`}>
                        <i className={`fa-solid ${provider.icon} text-white text-sm`}></i>
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-black text-slate-800">{provider.name}</span>
                            {isActive && !isAutoMode && (
                                <span className="text-[7px] font-black bg-violet-600 text-white px-1.5 py-0.5 rounded-full uppercase">首选</span>
                            )}
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium">{provider.description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* 连接状态徽章 */}
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${statusCfg.color}`}></span>
                        <span className={`text-[8px] font-bold uppercase ${statusCfg.bg}`}>{statusCfg.label}</span>
                    </div>
                    {/* 展开箭头 */}
                    <i className={`fa-solid fa-chevron-down text-slate-300 text-[10px] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}></i>
                </div>
            </button>

            {/* ── 展开内容 ── */}
            <div className={`transition-all duration-300 ${expanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-50/40">

                    {/* ── Base URL (如果支持且有预设) ── */}
                    {provider.supportsBaseUrl && baseUrlPresets.length > 0 && (
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">
                                API 地址 (Base URL)
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-violet-400 appearance-none cursor-pointer"
                                    value={isCustomBaseUrl ? 'custom' : config.baseUrl}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'custom') {
                                            onConfigChange({ baseUrl: '' });
                                        } else {
                                            onConfigChange({ baseUrl: val });
                                            // 切换 URL 时自动匹配默认模型
                                            const urlModels = getModelsByBaseUrl(val);
                                            if (urlModels.length > 0) {
                                                onConfigChange({ baseUrl: val, modelName: urlModels[0].value });
                                            }
                                            // 恢复缓存的 API Key
                                            if (apiKeyCache?.[val]) {
                                                onConfigChange({ baseUrl: val, modelName: urlModels[0]?.value || config.modelName, apiKey: apiKeyCache[val] });
                                            }
                                        }
                                    }}
                                >
                                    {baseUrlPresets.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                    <option value="custom">自定义 URL (Custom)</option>
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                            {isCustomBaseUrl && (
                                <input
                                    className="mt-2 w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                                    value={config.baseUrl}
                                    onChange={e => onConfigChange({ baseUrl: e.target.value })}
                                    placeholder="输入 API 地址..."
                                />
                            )}
                        </div>
                    )}

                    {/* ── Base URL (仅可选代理, Gemini 风格) ── */}
                    {provider.supportsBaseUrl && baseUrlPresets.length === 0 && (
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">
                                代理 Base URL <span className="text-slate-300 normal-case">(可选，留空则直连)</span>
                            </label>
                            <input
                                type="text"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                                value={config.baseUrl}
                                onChange={e => onConfigChange({ baseUrl: e.target.value })}
                                placeholder={provider.baseUrlPlaceholder || 'https://your-proxy.com'}
                            />
                        </div>
                    )}

                    {/* ── API Key ── */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[9px] font-black text-slate-400 uppercase">API Key</label>
                            {provider.isAiStudioSyncable && isAiStudioAvailable && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span className="text-[7px] font-black uppercase text-emerald-600">Synchronized from System</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400"
                                value={config.apiKey}
                                onChange={e => {
                                    const val = e.target.value;
                                    onConfigChange({ apiKey: val, connectionStatus: val ? 'untested' : 'idle' });
                                    // 更新 Key 缓存
                                    if (config.baseUrl && onApiKeyCacheUpdate) {
                                        onApiKeyCacheUpdate(config.baseUrl, val);
                                    }
                                }}
                                placeholder={provider.keyPlaceholder}
                            />
                            {provider.isAiStudioSyncable && isAiStudioAvailable && onAiStudioSync && (
                                <button
                                    onClick={onAiStudioSync}
                                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-black transition-all whitespace-nowrap shadow-md"
                                >
                                    系统授权
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Model Name (下拉选择模式) ── */}
                    {provider.modelInputMode === 'select' && (
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase">
                                    {provider.modelFieldLabel || 'Model Name'}
                                </label>
                                {provider.supportsRefreshModels && onRefreshModels && (
                                    <button
                                        onClick={onRefreshModels}
                                        disabled={isRefreshing}
                                        className="text-[8px] font-black text-violet-600 uppercase hover:text-black transition-all flex items-center gap-1"
                                    >
                                        <i className={`fa-solid fa-arrows-rotate ${isRefreshing ? 'animate-spin' : ''}`}></i>
                                        {isRefreshing ? '更新中...' : '刷新列表'}
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 appearance-none cursor-pointer"
                                    value={isCustomModel ? 'custom' : config.modelName}
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') onConfigChange({ modelName: '' });
                                        else onConfigChange({ modelName: e.target.value });
                                    }}
                                >
                                    {availableModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    <option value="custom">自定义模型 (Custom)</option>
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                            {isCustomModel && (
                                <input
                                    className="mt-2 w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                                    value={config.modelName}
                                    onChange={e => onConfigChange({ modelName: e.target.value })}
                                    placeholder={provider.modelPlaceholder || '输入模型名称...'}
                                />
                            )}
                        </div>
                    )}

                    {/* ── Model Name (纯手动输入模式, Doubao 风格) ── */}
                    {provider.modelInputMode === 'input' && (
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">
                                {provider.modelFieldLabel || 'Model Name'}
                            </label>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 font-bold text-indigo-700"
                                value={config.modelName}
                                onChange={e => onConfigChange({ modelName: e.target.value })}
                                placeholder={provider.modelPlaceholder || '输入模型名称...'}
                            />
                        </div>
                    )}

                    {/* ── 底部操作栏：测试连接 + 测速 ── */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onTestConnection || handleTestConnection}
                                disabled={!config.apiKey || effectiveStatus === 'testing'}
                                className="flex items-center gap-1.5 text-[9px] font-black text-indigo-600 uppercase hover:text-indigo-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <i className={`fa-solid ${effectiveStatus === 'testing' ? 'fa-spinner fa-spin' : 'fa-flask-vial'}`}></i>
                                测试连接
                            </button>

                            <span className="text-slate-200">|</span>

                            <button
                                onClick={handleSpeedTest}
                                disabled={!config.apiKey || !config.modelName || speedTestStatus === 'testing'}
                                className="flex items-center gap-1.5 text-[9px] font-black text-cyan-600 uppercase hover:text-cyan-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <i className={`fa-solid ${speedTestStatus === 'testing' ? 'fa-spinner fa-spin' : 'fa-gauge-high'}`}></i>
                                {speedTestStatus === 'testing' ? '测速中...' : '测速'}
                            </button>
                        </div>

                        {effectiveStatus === 'connected' && (
                            <span className="text-[8px] font-bold text-emerald-600 flex items-center gap-1">
                                <i className="fa-solid fa-circle-check"></i> API 验证通过
                            </span>
                        )}
                        {effectiveStatus === 'error' && (
                            <span className="text-[8px] font-bold text-rose-600 flex items-center gap-1">
                                <i className="fa-solid fa-circle-xmark"></i> 验证失败，请检查 Key
                            </span>
                        )}
                    </div>

                    {/* ── 测速结果展示 ── */}
                    {speedTestStatus === 'done' && speedTestResult && (
                        <div className="bg-gradient-to-r from-cyan-50 to-sky-50 rounded-xl p-3 border border-cyan-100 animate-reveal">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-gauge-high text-cyan-500 text-sm"></i>
                                    <div>
                                        <span className={`text-lg font-black ${getLatencyColor(speedTestResult.latency)}`}>
                                            {speedTestResult.latency}
                                        </span>
                                        <span className="text-[9px] text-slate-400 ml-1">ms</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        speedTestResult.latency < 1000 ? 'bg-emerald-100 text-emerald-700' :
                                        speedTestResult.latency < 3000 ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                    }`}>
                                        {getLatencyLabel(speedTestResult.latency)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[8px] text-slate-400 font-mono">{speedTestResult.model}</span>
                                {speedTestResult.tokensPerSec && (
                                    <span className="text-[8px] font-bold text-cyan-600">
                                        ~{speedTestResult.tokensPerSec} tokens/s
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                    {speedTestStatus === 'error' && (
                        <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-100">
                            <p className="text-[8px] font-bold text-rose-600 flex items-center gap-1">
                                <i className="fa-solid fa-circle-xmark"></i> {speedTestError}
                            </p>
                        </div>
                    )}

                    {/* ── 提示信息 ── */}
                    {provider.isAiStudioSyncable && (
                        <p className="text-[8px] text-slate-400 italic px-1">
                            <i className="fa-solid fa-circle-info mr-1 text-indigo-500"></i>
                            手动填入即可覆盖系统默认的 API Key 及模型设置。此设定保存在本地缓存中。
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProviderConfigCard;
