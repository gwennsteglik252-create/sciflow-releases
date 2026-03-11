import React, { useState } from 'react';

interface ApiSetupGuideModalProps {
    show: boolean;
    onClose: () => void;
    onGoToSettings: () => void;
}

const PROVIDERS = [
    {
        id: 'deepseek',
        name: 'DeepSeek',
        tag: '🇨🇳 国内推荐 · 最便宜',
        tagColor: 'bg-emerald-100 text-emerald-700',
        url: 'https://platform.deepseek.com/api_keys',
        steps: [
            '访问 platform.deepseek.com → 注册账号',
            '充值 ¥10（可以用几个月）',
            '进入 API Keys 页面 → 创建新 Key',
            '复制 Key → 回到 SciFlow Pro 设置页粘贴',
        ],
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        icon: 'fa-bolt',
        iconColor: 'text-blue-500',
        cost: '¥10 起（按量付费，极低成本）',
    },
    {
        id: 'siliconflow',
        name: '硅基流动 SiliconFlow',
        tag: '🇨🇳 国内 · 模型丰富',
        tagColor: 'bg-violet-100 text-violet-700',
        url: 'https://cloud.siliconflow.cn/account/ak',
        steps: [
            '访问 cloud.siliconflow.cn → 注册账号',
            '新用户有免费额度可体验',
            '进入管理 → API Key → 创建 Key',
            '复制 Key → 回到 SciFlow Pro 设置页粘贴',
        ],
        baseUrl: 'https://api.siliconflow.cn/v1',
        model: 'deepseek-ai/DeepSeek-V3',
        icon: 'fa-microchip',
        iconColor: 'text-violet-500',
        cost: '新用户有免费额度',
    },
    {
        id: 'openai',
        name: 'OpenAI (ChatGPT)',
        tag: '🌍 国际 · 需科学上网',
        tagColor: 'bg-slate-100 text-slate-600',
        url: 'https://platform.openai.com/api-keys',
        steps: [
            '访问 platform.openai.com → 登录账号',
            '进入 API Keys → Create new secret key',
            '复制 Key → 回到 SciFlow Pro 设置页粘贴',
            '注意：需要绑定信用卡并开通付费',
        ],
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        icon: 'fa-robot',
        iconColor: 'text-emerald-500',
        cost: '$5 起（需信用卡）',
    },
];

const ApiSetupGuideModal: React.FC<ApiSetupGuideModalProps> = ({ show, onClose, onGoToSettings }) => {
    const [expandedProvider, setExpandedProvider] = useState<string | null>('deepseek');

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-[560px] max-h-[85vh] bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-500 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8 blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8 blur-xl" />
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight">设置 AI 服务密钥</h2>
                                <p className="text-white/70 text-[11px] font-bold">配置后即可使用全部 AI 分析功能</p>
                            </div>
                        </div>
                        <p className="text-white/80 text-xs leading-relaxed">
                            SciFlow Pro 的 AI 功能（智能分析、文献解读、论文润色等）需要连接 AI 服务。
                            请选择一个供应商，按照指引获取 API 密钥，然后在设置页填入即可。
                        </p>
                    </div>
                </div>

                {/* Providers */}
                <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        <i className="fa-solid fa-list-check mr-1.5"></i>
                        选择 AI 供应商（推荐 DeepSeek，最便宜）
                    </p>

                    {PROVIDERS.map(provider => {
                        const isExpanded = expandedProvider === provider.id;
                        return (
                            <div
                                key={provider.id}
                                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${isExpanded
                                        ? 'border-indigo-200 shadow-lg shadow-indigo-100 bg-gradient-to-br from-indigo-50/50 to-violet-50/50'
                                        : 'border-slate-100 hover:border-slate-200 bg-white hover:shadow-md'
                                    }`}
                            >
                                {/* Provider Header */}
                                <button
                                    onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                                    className="w-full flex items-center gap-3 p-4 text-left"
                                >
                                    <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center ${isExpanded ? 'bg-indigo-100' : ''}`}>
                                        <i className={`fa-solid ${provider.icon} ${provider.iconColor} text-lg`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-black text-slate-800">{provider.name}</p>
                                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${provider.tagColor}`}>
                                                {provider.tag}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{provider.cost}</p>
                                    </div>
                                    <i className={`fa-solid fa-chevron-down text-slate-300 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                                </button>

                                {/* Expanded Steps */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                                        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                                            {provider.steps.map((step, idx) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-[10px] font-black">
                                                        {idx + 1}
                                                    </div>
                                                    <p className="text-xs text-slate-600 font-medium pt-0.5">{step}</p>
                                                </div>
                                            ))}

                                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase w-16">API 地址</span>
                                                    <code className="text-[10px] bg-slate-50 px-2 py-1 rounded-lg text-indigo-600 font-bold flex-1 truncate">
                                                        {provider.baseUrl}
                                                    </code>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase w-16">推荐模型</span>
                                                    <code className="text-[10px] bg-slate-50 px-2 py-1 rounded-lg text-purple-600 font-bold flex-1 truncate">
                                                        {provider.model}
                                                    </code>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => window.open(provider.url, '_blank')}
                                                    className="flex-1 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
                                                >
                                                    <i className="fa-solid fa-arrow-up-right-from-square mr-1.5"></i>
                                                    去获取 API Key
                                                </button>
                                                <button
                                                    onClick={onGoToSettings}
                                                    className="flex-1 py-2.5 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase rounded-xl hover:bg-indigo-50 transition-all active:scale-95"
                                                >
                                                    <i className="fa-solid fa-gear mr-1.5"></i>
                                                    去设置页填入
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 pt-2 flex items-center justify-between">
                    <p className="text-[9px] text-slate-400">
                        <i className="fa-solid fa-lock mr-1"></i>
                        API Key 仅存储在你的本地电脑，不会上传到任何服务器
                    </p>
                    <button
                        onClick={onClose}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        稍后再说
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiSetupGuideModal;
