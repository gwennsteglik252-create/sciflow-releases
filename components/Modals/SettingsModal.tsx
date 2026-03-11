import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { AIProvider } from '../../types';
import { getLicenseState, activateLicense, LicenseState } from '../../services/licenseService';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onOpenConfirm: (config: any) => void;
}

const BASE_URL_PRESETS = [
  { label: 'OpenAI Official', value: 'https://api.openai.com/v1' },
  { label: 'DeepSeek API', value: 'https://api.deepseek.com' },
  { label: 'Moonshot (Kimi)', value: 'https://api.moonshot.cn/v1' },
  { label: 'Aliyun DashScope (Qwen)', value: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { label: 'SiliconFlow (硅基流动)', value: 'https://api.siliconflow.cn/v1' },
  { label: 'OpenRouter (Aggregator)', value: 'https://openrouter.ai/api/v1' },
];

const MODELS_BY_BASE_URL: Record<string, { label: string; value: string }[]> = {
  'https://api.openai.com/v1': [
    { label: 'GPT-5 (Omni)', value: 'gpt-5' },
    { label: 'GPT-4o (Omni)', value: 'gpt-4o' },
    { label: 'o2 (Reasoning)', value: 'o2' },
    { label: 'o3-mini (Reasoning)', value: 'o3-mini' },
  ],
  'https://api.deepseek.com': [
    { label: 'DeepSeek V3', value: 'deepseek-chat' },
    { label: 'DeepSeek R1 (Reasoner)', value: 'deepseek-reasoner' },
  ],
  'https://api.moonshot.cn/v1': [
    { label: 'Moonshot V1 8k', value: 'moonshot-v1-8k' },
    { label: 'Moonshot V1 32k', value: 'moonshot-v1-32k' },
    { label: 'Moonshot V1 128k', value: 'moonshot-v1-128k' },
  ],
  'https://dashscope.aliyuncs.com/compatible-mode/v1': [
    { label: 'Qwen Max (Tongyi)', value: 'qwen-max' },
    { label: 'Qwen Plus', value: 'qwen-plus' },
    { label: 'Qwen Turbo', value: 'qwen-turbo' },
    { label: 'Qwen Long', value: 'qwen-long' },
  ],
  'https://api.siliconflow.cn/v1': [
    { label: 'DeepSeek V3', value: 'deepseek-ai/DeepSeek-V3' },
    { label: 'DeepSeek R1', value: 'deepseek-ai/DeepSeek-R1' },
    { label: 'Qwen 2.5 72B', value: 'Qwen/Qwen2.5-72B-Instruct' },
    { label: 'Qwen 2.5 7B', value: 'Qwen/Qwen2.5-7B-Instruct' },
  ],
  'https://openrouter.ai/api/v1': [
    { label: 'Anthropic: Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
    { label: 'Anthropic: Claude 3 Haiku', value: 'anthropic/claude-3-haiku' },
    { label: 'OpenAI: GPT-4o', value: 'openai/gpt-4o' },
    { label: 'Meta: Llama 3.1 70b', value: 'meta-llama/llama-3.1-70b-instruct' },
    { label: 'Google: Gemini Pro 1.5', value: 'google/gemini-pro-1.5' },
  ]
};

const GENERIC_MODELS = [
  { label: 'GPT-4o (Omni)', value: 'gpt-4o' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'DeepSeek V3', value: 'deepseek-chat' },
  { label: 'Qwen Max', value: 'qwen-max' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620' },
  { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  { label: 'Llama 3 70B', value: 'llama3-70b' },
];

const ANTHROPIC_MODELS = [
  { label: 'Claude 4 Opus', value: 'claude-4-opus-20260120' },
  { label: 'Claude 4 Sonnet', value: 'claude-4-sonnet-20251115' },
  { label: 'Claude 3.7 Sonnet', value: 'claude-3-7-sonnet-20250219' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20240620' },
];

const GEMINI_MODELS = [
  { label: 'Gemini 2.5 Flash (推荐)', value: 'gemini-2.5-flash-preview-04-17' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro-preview-03-25' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemini 2.0 Pro Exp', value: 'gemini-2.0-pro-exp-02-05' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, onOpenConfirm }) => {
  const { appSettings, setAppSettings } = useProjectContext();
  const [localPath, setLocalPath] = useState(appSettings.localLibraryPath);

  const [activeProvider, setActiveProvider] = useState<AIProvider>(appSettings.activeModelProvider || 'auto');
  const [routingPreference, setRoutingPreference] = useState<'cost' | 'quality'>(appSettings.autoRoutingPreference || 'cost');

  const [openaiKey, setOpenaiKey] = useState(appSettings.openaiConfig?.apiKey || '');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(appSettings.openaiConfig?.baseUrl || 'https://api.openai.com/v1');
  const [openaiModel, setOpenaiModel] = useState(appSettings.openaiConfig?.modelName || 'gpt-4o');

  const [anthropicKey, setAnthropicKey] = useState(appSettings.anthropicConfig?.apiKey || '');
  const [anthropicModel, setAnthropicModel] = useState(appSettings.anthropicConfig?.modelName || 'claude-3-5-sonnet-20240620');

  const [doubaoKey, setDoubaoKey] = useState(appSettings.doubaoConfig?.apiKey || '');
  const [doubaoBaseUrl, setDoubaoBaseUrl] = useState(appSettings.doubaoConfig?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3');
  const [doubaoModel, setDoubaoModel] = useState(appSettings.doubaoConfig?.modelName || '');

  const [geminiKey, setGeminiKey] = useState(appSettings.geminiConfig?.apiKey || '');
  const [geminiBaseUrl, setGeminiBaseUrl] = useState(appSettings.geminiConfig?.baseUrl || '');
  const [geminiModel, setGeminiModel] = useState(appSettings.geminiConfig?.modelName || 'gemini-2.0-flash');

  const [dynamicModels, setDynamicModels] = useState<Record<string, { label: string; value: string }[]>>({});
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});
  const [settingsTab, setSettingsTab] = useState<'ai' | 'appearance' | 'research' | 'data' | 'system'>('ai');

  // -- New settings state --
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(appSettings.themeMode || 'light');
  const [uiScale, setUiScale] = useState(appSettings.uiScale || 100);
  const [editorFontSize, setEditorFontSize] = useState(appSettings.editorFontSize || 14);
  const [defaultExportFormat, setDefaultExportFormat] = useState<'SVG' | 'PNG' | 'PDF'>(appSettings.defaultExportFormat || 'PNG');
  const [defaultExportDPI, setDefaultExportDPI] = useState<300 | 600 | 1200>(appSettings.defaultExportDPI || 300);
  const [defaultChartFont, setDefaultChartFont] = useState(appSettings.defaultChartFont || 'Arial');
  const [defaultColorPalette, setDefaultColorPalette] = useState(appSettings.defaultColorPalette || 'Nature');
  const [proxyEnabled, setProxyEnabled] = useState(appSettings.proxyEnabled || false);
  const [proxyUrl, setProxyUrl] = useState(appSettings.proxyUrl || '');
  const [aiRequestTimeout, setAiRequestTimeout] = useState(appSettings.aiRequestTimeout || 60);
  const [confirmBeforeAISend, setConfirmBeforeAISend] = useState(appSettings.confirmBeforeAISend ?? false);

  // -- Round 2 settings state --
  const [uiLanguage, setUiLanguage] = useState<'zh' | 'en'>(appSettings.uiLanguage || 'zh');
  const [dateFormat, setDateFormat] = useState(appSettings.dateFormat || 'YYYY-MM-DD');
  const [aiOutputLanguage, setAiOutputLanguage] = useState<'zh' | 'en' | 'auto'>(appSettings.aiOutputLanguage || 'auto');
  const [aiPolishIntensity, setAiPolishIntensity] = useState<'light' | 'moderate' | 'deep'>(appSettings.aiPolishIntensity || 'moderate');
  const [defaultWritingLanguage, setDefaultWritingLanguage] = useState<'zh' | 'en'>(appSettings.defaultWritingLanguage || 'zh');
  const [paragraphIndent, setParagraphIndent] = useState<'indent' | 'no-indent'>(appSettings.paragraphIndent || 'indent');
  const [defaultXrdRadiation, setDefaultXrdRadiation] = useState(appSettings.defaultXrdRadiation || 'Cu Kα');
  const [defaultXpsReference, setDefaultXpsReference] = useState(appSettings.defaultXpsReference || 'C 1s 284.8 eV');
  const [defaultSemVoltage, setDefaultSemVoltage] = useState(appSettings.defaultSemVoltage || 15);
  const [defaultTemVoltage, setDefaultTemVoltage] = useState(appSettings.defaultTemVoltage || 200);

  // -- Round 3 settings state --
  const [chatHistoryRetentionDays, setChatHistoryRetentionDays] = useState(appSettings.chatHistoryRetentionDays || 30);
  const [autoClearChat, setAutoClearChat] = useState(appSettings.autoClearChat ?? false);
  const [restoreWindowPosition, setRestoreWindowPosition] = useState(appSettings.restoreWindowPosition ?? true);
  const [rememberLastPage, setRememberLastPage] = useState(appSettings.rememberLastPage ?? true);
  const [gpuAcceleration, setGpuAcceleration] = useState(appSettings.gpuAcceleration ?? true);
  const [cacheMaxSizeMB, setCacheMaxSizeMB] = useState(appSettings.cacheMaxSizeMB || 512);

  // -- 自动更新状态 --
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateError, setUpdateError] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');

  // -- 授权状态 --
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
  const [licenseCode, setLicenseCode] = useState('');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [licenseSuccess, setLicenseSuccess] = useState(false);

  useEffect(() => {
    if (show) {
      getLicenseState().then(setLicenseState);
    }
  }, [show]);

  const handleActivateLicense = async () => {
    if (!licenseCode.trim()) return;
    setLicenseLoading(true);
    setLicenseError('');
    const result = await activateLicense(licenseCode);
    if (result.success) {
      setLicenseSuccess(true);
      const newState = await getLicenseState();
      setLicenseState(newState);
    } else {
      setLicenseError(result.error || '激活失败');
    }
    setLicenseLoading(false);
  };

  // 监听主进程发来的更新事件
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron?.onUpdateStatus) return;

    // 获取当前应用版本
    if (electron.getAppVersion) {
      electron.getAppVersion().then((v: string) => v && setAppVersion(v));
    }

    const unsubscribe = electron.onUpdateStatus((data: any) => {
      switch (data.status) {
        case 'checking':
          setUpdateStatus('checking');
          break;
        case 'available':
          setUpdateStatus('available');
          setUpdateVersion(data.version || '');
          break;
        case 'not-available':
          setUpdateStatus('not-available');
          break;
        case 'downloading':
          setUpdateStatus('downloading');
          setUpdateProgress(Math.round(data.percent || 0));
          break;
        case 'downloaded':
          setUpdateStatus('downloaded');
          setUpdateVersion(data.version || '');
          break;
        case 'error':
          setUpdateStatus('error');
          setUpdateError(data.message || '未知错误');
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCheckUpdate = async () => {
    const electron = (window as any).electron;
    if (!electron?.checkForUpdates) {
      setUpdateStatus('error');
      setUpdateError('当前环境不支持自动更新（仅打包版本可用）');
      return;
    }
    setUpdateStatus('checking');
    setUpdateError('');
    await electron.checkForUpdates();
  };

  const handleDownloadUpdate = async () => {
    const electron = (window as any).electron;
    // 强制跳转网页下载，避免签名报错
    if (electron?.downloadUpdate) {
      await electron.downloadUpdate();
    } else {
      window.open('https://github.com/gwennsteglik252-create/sciflow-releases/releases/latest', '_blank');
    }
  };

  const handleInstallUpdate = () => {
    const electron = (window as any).electron;
    // 强制跳转网页，不再调用可能导致崩溃的 Squirrel 安装
    if (electron?.installUpdate) {
      electron.installUpdate();
    } else {
      window.open('https://github.com/gwennsteglik252-create/sciflow-releases/releases/latest', '_blank');
    }
  };




  const [apiKeyCache, setApiKeyCache] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('sciflow_api_key_cache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (appSettings.openaiConfig?.baseUrl && appSettings.openaiConfig?.apiKey) {
      setApiKeyCache(prev => {
        const next = { ...prev, [appSettings.openaiConfig!.baseUrl!]: appSettings.openaiConfig!.apiKey };
        localStorage.setItem('sciflow_api_key_cache', JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const currentOpenAIModels = useMemo(() => {
    const presetModels = MODELS_BY_BASE_URL[openaiBaseUrl] || GENERIC_MODELS;
    const dynamic = dynamicModels[openaiBaseUrl] || [];
    // Merge and deduplicate
    const combined = [...presetModels, ...dynamic];
    const seen = new Set();
    return combined.filter(m => {
      const duplicate = seen.has(m.value);
      seen.add(m.value);
      return !duplicate;
    });
  }, [openaiBaseUrl, dynamicModels]);


  if (!show) return null;

  const isOpenAiCustom = !currentOpenAIModels.some(m => m.value === openaiModel);
  const isAnthropicCustom = !ANTHROPIC_MODELS.some(m => m.value === anthropicModel);
  const isOpenAiUrlCustom = !BASE_URL_PRESETS.some(u => u.value === openaiBaseUrl);

  const handleClearCache = () => {
    onOpenConfirm({
      show: true,
      title: '清空所有本地数据？',
      desc: '此操作将抹除所有本地存储的课题、文献、对话历史和配置项。该操作不可逆，请确保已备份重要数据。',
      onConfirm: () => {
        localStorage.clear();
        window.location.reload();
      }
    });
  };

  const handleSave = () => {
    setAppSettings({
      localLibraryPath: localPath,
      activeModelProvider: activeProvider,
      autoRoutingPreference: routingPreference,
      openaiConfig: { apiKey: openaiKey, baseUrl: openaiBaseUrl, modelName: openaiModel },
      anthropicConfig: { apiKey: anthropicKey, modelName: anthropicModel },
      doubaoConfig: { apiKey: doubaoKey, baseUrl: doubaoBaseUrl, modelName: doubaoModel },
      geminiConfig: { apiKey: geminiKey, baseUrl: geminiBaseUrl, modelName: geminiModel },
      themeMode,
      uiScale: uiScale as any,
      editorFontSize,
      defaultExportFormat,
      defaultExportDPI,
      defaultChartFont,
      defaultColorPalette,
      proxyEnabled,
      proxyUrl,
      aiRequestTimeout,
      confirmBeforeAISend,
      uiLanguage,
      dateFormat,
      aiOutputLanguage,
      aiPolishIntensity,
      defaultWritingLanguage,
      paragraphIndent,
      defaultXrdRadiation,
      defaultXpsReference,
      defaultSemVoltage,
      defaultTemVoltage,
      chatHistoryRetentionDays,
      autoClearChat,
      restoreWindowPosition,
      rememberLastPage,
      gpuAcceleration,
      cacheMaxSizeMB,
    });
    onClose();
  };

  const handleExportSettings = () => {
    const blob = new Blob([JSON.stringify(appSettings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sciflow-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          setAppSettings(parsed);
          alert('设置导入成功！页面将刷新以应用变更。');
          window.location.reload();
        }
      } catch {
        alert('导入失败：文件格式无效。');
      }
    };
    input.click();
  };

  const handleRefreshModels = async (baseUrl: string, apiKey: string, providerKey: string) => {
    if (!baseUrl || !apiKey) {
      alert("请先输入有效的 API 地址和 API Key。");
      return;
    }

    setIsRefreshing(prev => ({ ...prev, [providerKey]: true }));
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const models = data.data
        .filter((m: any) => m.id)
        .map((m: any) => ({ label: m.id, value: m.id }));

      if (models.length > 0) {
        setDynamicModels(prev => ({ ...prev, [baseUrl]: models }));
        alert(`成功获取 ${models.length} 个模型！`);
      } else {
        alert("未发现可用模型。");
      }
    } catch (err) {
      console.error("Refresh models failed:", err);
      alert("模型列表更新失败，请检查网络或 API Key。");
    } finally {
      setIsRefreshing(prev => ({ ...prev, [providerKey]: false }));
    }
  };

  const isGeminiCustom = !GEMINI_MODELS.some(m => m.value === geminiModel);

  const handleSelectApiKey = async () => {

    if (window.aistudio) {
      await window.aistudio.openSelectKey();
    } else {
      alert("API Key 选择功能仅在 AI Studio 环境中可用。在 Electron 中，请直接在环境变量中配置 API_KEY。");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white overflow-hidden h-[85vh] flex flex-col">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all active:scale-90 z-10">
          <i className="fa-solid fa-times text-2xl"></i>
        </button>

        <header className="mb-6 shrink-0">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">系统偏好设置</h3>
        </header>

        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 shrink-0 overflow-x-auto no-scrollbar">
          {([
            { id: 'ai' as const, label: 'AI 引擎', icon: 'fa-microchip' },
            { id: 'appearance' as const, label: '外观语言', icon: 'fa-palette' },
            { id: 'research' as const, label: '科研写作', icon: 'fa-flask-vial' },
            { id: 'data' as const, label: '数据图表', icon: 'fa-chart-pie' },
            { id: 'system' as const, label: '系统管理', icon: 'fa-gear' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setSettingsTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${settingsTab === tab.id
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8 pb-6">

          {settingsTab === 'ai' && (<>
            {/* Hybrid AI Engine Panel */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-microchip text-violet-500"></i> 多模型混合引擎 (HYBRID AI ENGINE)
              </h4>
              <div className="bg-violet-50/50 p-6 rounded-[2rem] border border-violet-100 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[11px] font-black text-slate-800 uppercase">当前首选推理引擎</p>
                    {activeProvider === 'auto' && (
                      <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full animate-pulse">SMART ROUTING ACTIVE</span>
                    )}
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                    {(['auto', 'gemini', 'openai', 'doubao', 'anthropic'] as const).map(provider => (
                      <button
                        key={provider}
                        onClick={() => setActiveProvider(provider)}
                        className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeProvider === provider ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {provider === 'auto' ? '智能自动' : provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : provider === 'doubao' ? 'Doubao' : 'Anthropic'}
                      </button>
                    ))}
                  </div>
                </div>

                {activeProvider === 'auto' && (
                  <div className="animate-reveal space-y-4 bg-indigo-900 text-white p-6 rounded-2xl border border-indigo-400 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fa-solid fa-compass text-6xl"></i></div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">智能调度逻辑说明 (ORCHESTRATION)</h5>
                    <p className="text-[11px] font-medium leading-relaxed italic opacity-90">系统将根据已保存的有效 Key，自动分析任务内容。视觉任务优先分配给 Gemini，简单润色分配给 DeepSeek/豆包以降低成本，复杂推演则分配给顶级旗舰模型。</p>
                    <div className="pt-4 border-t border-white/10 mt-2">
                      <p className="text-[9px] font-black uppercase mb-3">调度优先级偏好</p>
                      <div className="flex bg-white/10 p-1 rounded-xl">
                        <button onClick={() => setRoutingPreference('cost')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${routingPreference === 'cost' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 opacity-60'}`}>成本优先 (Economy)</button>
                        <button onClick={() => setRoutingPreference('quality')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${routingPreference === 'quality' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 opacity-60'}`}>质量优先 (Intelligence)</button>
                      </div>
                    </div>
                  </div>
                )}

                {(activeProvider === 'gemini' || activeProvider === 'auto') && (
                  <div className={`animate-reveal space-y-4 bg-white p-5 rounded-2xl border ${activeProvider === 'auto' ? 'border-dashed border-slate-200' : 'border-violet-100'}`}>
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black text-slate-400 uppercase px-1">Google Gemini API Config</label>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${window.aistudio ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        <span className={`text-[7px] font-black uppercase ${window.aistudio ? 'text-emerald-600' : 'text-amber-600'}`}>{window.aistudio ? 'Synchronized from System' : 'Local Configuration'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="password"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400"
                          value={geminiKey}
                          onChange={e => setGeminiKey(e.target.value)}
                          placeholder="AIzaSy..."
                        />
                      </div>
                      {window.aistudio && (
                        <button
                          onClick={handleSelectApiKey}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-black transition-all whitespace-nowrap shadow-md"
                        >
                          系统授权
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 mt-2">Model Name</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 appearance-none cursor-pointer"
                          value={isGeminiCustom ? 'custom' : geminiModel}
                          onChange={(e) => {
                            if (e.target.value === 'custom') setGeminiModel('');
                            else setGeminiModel(e.target.value);
                          }}
                        >
                          {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          <option value="custom">自定义模型 (Custom)</option>
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                      </div>
                      {isGeminiCustom && (
                        <input
                          className="mt-2 w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                          value={geminiModel}
                          onChange={e => setGeminiModel(e.target.value)}
                          placeholder="输入模型名称 (如 gemini-2.0-flash-exp)..."
                        />
                      )}
                    </div>
                    <p className="text-[8px] text-slate-400 mt-1 italic px-1">
                      <i className="fa-solid fa-circle-info mr-1 text-indigo-500"></i>
                      手动填入即可覆盖系统默认的 API Key 及模型设置。此设定会保存在本地单独的缓存中。
                    </p>
                    {/* Gemini 代理 Base URL（可选） */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 mt-2">Gemini 代理 Base URL <span className="text-slate-300 normal-case">(可选，留空则直连)</span></label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                        value={geminiBaseUrl}
                        onChange={e => setGeminiBaseUrl(e.target.value)}
                        placeholder="https://your-proxy.com/gemini"
                      />
                    </div>
                  </div>
                )}

                {(activeProvider === 'openai' || activeProvider === 'auto') && (
                  <div className={`animate-reveal space-y-4 bg-white p-5 rounded-2xl border ${activeProvider === 'auto' ? 'border-dashed border-slate-200' : 'border-violet-100'}`}>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">OpenAI/DeepSeek Base URL</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-violet-400 appearance-none cursor-pointer"
                          value={isOpenAiUrlCustom ? 'custom' : openaiBaseUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setOpenaiBaseUrl('');
                            } else {
                              setOpenaiBaseUrl(val);
                              const defaults = MODELS_BY_BASE_URL[val];
                              if (defaults && defaults.length > 0) {
                                setOpenaiModel(defaults[0].value);
                              }
                              if (apiKeyCache[val]) setOpenaiKey(apiKeyCache[val]);
                            }
                          }}
                        >
                          {BASE_URL_PRESETS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                          <option value="custom">自定义 URL (Custom)</option>
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                      </div>
                      {isOpenAiUrlCustom && (
                        <input
                          className="mt-2 w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                          value={openaiBaseUrl}
                          onChange={e => setOpenaiBaseUrl(e.target.value)}
                          placeholder="输入 API 地址..."
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">OpenAI/DeepSeek API Key</label>
                      <input
                        type="password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400"
                        value={openaiKey}
                        onChange={e => {
                          const val = e.target.value;
                          setOpenaiKey(val);
                          if (openaiBaseUrl) {
                            setApiKeyCache(prev => {
                              const next = { ...prev, [openaiBaseUrl]: val };
                              localStorage.setItem('sciflow_api_key_cache', JSON.stringify(next));
                              return next;
                            });
                          }
                        }}
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[9px] font-black text-slate-400 uppercase">Model Name</label>
                        <button
                          onClick={() => handleRefreshModels(openaiBaseUrl, openaiKey, 'openai')}
                          disabled={isRefreshing['openai']}
                          className="text-[8px] font-black text-violet-600 uppercase hover:text-black transition-all flex items-center gap-1"
                        >
                          <i className={`fa-solid fa-arrows-rotate ${isRefreshing['openai'] ? 'animate-spin' : ''}`}></i>
                          {isRefreshing['openai'] ? 'Updating...' : 'Refresh List'}
                        </button>
                      </div>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 appearance-none cursor-pointer"
                          value={isOpenAiCustom ? 'custom' : openaiModel}
                          onChange={(e) => {
                            if (e.target.value === 'custom') setOpenaiModel('');
                            else setOpenaiModel(e.target.value);
                          }}
                        >
                          {currentOpenAIModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          <option value="custom">自定义模型 (Custom)</option>
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                      </div>
                      {isOpenAiCustom && (
                        <input
                          className="mt-2 w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700"
                          value={openaiModel}
                          onChange={e => setOpenaiModel(e.target.value)}
                          placeholder="输入模型名称..."
                        />
                      )}
                    </div>
                  </div>
                )}

                {(activeProvider === 'doubao' || activeProvider === 'auto') && (
                  <div className={`animate-reveal space-y-4 bg-white p-5 rounded-2xl border ${activeProvider === 'auto' ? 'border-dashed border-slate-200' : 'border-violet-100'}`}>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Doubao API Key</label>
                      <input type="password" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400" value={doubaoKey} onChange={e => setDoubaoKey(e.target.value)} placeholder="Ark API Key..." />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Doubao Endpoint ID</label>
                      <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 font-bold text-indigo-700" value={doubaoModel} onChange={e => setDoubaoModel(e.target.value)} placeholder="ep-2024..." />
                    </div>
                  </div>
                )}

                {(activeProvider === 'anthropic' || activeProvider === 'auto') && (
                  <div className={`animate-reveal space-y-4 bg-white p-5 rounded-2xl border ${activeProvider === 'auto' ? 'border-dashed border-slate-200' : 'border-violet-100'}`}>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Anthropic API Key</label>
                      <input type="password" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5">Model Name</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-violet-400 appearance-none cursor-pointer"
                          value={isAnthropicCustom ? 'custom' : anthropicModel}
                          onChange={(e) => {
                            if (e.target.value === 'custom') setAnthropicModel('');
                            else setAnthropicModel(e.target.value);
                          }}
                        >
                          {ANTHROPIC_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          <option value="custom">自定义模型 (Custom)</option>
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                      </div>
                      {isAnthropicCustom && (
                        <input className="mt-2 w-full bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700" value={anthropicModel} onChange={e => setAnthropicModel(e.target.value)} placeholder="输入模型名称..." />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* AI 配置面板 */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">AI 自动化策略 (AUTOMATION)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div className="min-w-0 pr-4">
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">自动诊断异常</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Auto-Diagnose Lab Anomalies</p>
                  </div>
                  <button
                    onClick={() => setAppSettings({ aiAutoDiagnose: !appSettings.aiAutoDiagnose })}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${appSettings.aiAutoDiagnose ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.aiAutoDiagnose ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div className="min-w-0 pr-4">
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">实时学术润色</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Real-time Polish Assistant</p>
                  </div>
                  <button
                    onClick={() => setAppSettings({ aiRealtimePolish: !appSettings.aiRealtimePolish })}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${appSettings.aiRealtimePolish ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.aiRealtimePolish ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'research' && (<>
            {/* Scientific Standards */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-medal text-amber-500"></i> 科研标准与排版 (SCIENTIFIC STANDARDS)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">默认文献引用格式</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Global Citation Style</p>
                  </div>
                  <div className="relative group min-w-[160px]">
                    <select
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                      value={appSettings.defaultCitationStyle || 'Nature'}
                      onChange={(e) => setAppSettings({ defaultCitationStyle: e.target.value as any })}
                    >
                      <option value="Nature">Nature (Superscript)</option>
                      <option value="Science">Science (Numbered)</option>
                      <option value="IEEE">IEEE (Bracketed)</option>
                      <option value="APA">APA (Author-Date)</option>
                      <option value="JACS">JACS (Journal of Am. Chem. Soc.)</option>
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">全局 LaTeX 渲染风格</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Formula Font Family</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button
                      onClick={() => setAppSettings({ latexStyle: 'serif' })}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${appSettings.latexStyle === 'serif' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <span className="font-serif italic mr-1">f(x)</span> Serif
                    </button>
                    <button
                      onClick={() => setAppSettings({ latexStyle: 'sans' })}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${appSettings.latexStyle === 'sans' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <span className="font-sans mr-1">f(x)</span> Sans
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'system' && (<>
            {/* License Status */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-emerald-500"></i> 软件授权 (LICENSE)
              </h4>
              <div className={`p-6 rounded-[2rem] border space-y-4 ${licenseState?.status === 'activated'
                ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100'
                : licenseState?.status === 'trial'
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'
                  : 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${licenseState?.status === 'activated'
                      ? 'bg-emerald-500 shadow-emerald-200'
                      : licenseState?.status === 'trial'
                        ? 'bg-amber-500 shadow-amber-200'
                        : 'bg-rose-500 shadow-rose-200'
                      }`}>
                      <i className={`fa-solid ${licenseState?.status === 'activated'
                        ? 'fa-crown'
                        : licenseState?.status === 'trial'
                          ? 'fa-hourglass-half'
                          : 'fa-lock'
                        } text-white`}></i>
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-800 tracking-tight">
                        {licenseState?.status === 'activated' ? '已激活' : licenseState?.status === 'trial' ? '试用中' : '已过期'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        {licenseState?.status === 'activated'
                          ? `永久授权 · 激活于 ${licenseState.activatedAt ? new Date(licenseState.activatedAt).toLocaleDateString('zh-CN') : '—'}`
                          : licenseState?.status === 'trial'
                            ? `剩余 ${licenseState.trialDaysRemaining} 天 · 14天免费试用`
                            : '请输入激活码以继续使用'
                        }
                      </p>
                    </div>
                  </div>
                  {licenseState?.status === 'activated' && (
                    <span className="text-[8px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">PRO</span>
                  )}
                </div>

                {licenseState?.status !== 'activated' && (
                  <div className="bg-white/60 rounded-xl p-4 space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase block">输入激活码</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={licenseCode}
                        onChange={e => { setLicenseCode(e.target.value.toUpperCase()); setLicenseError(''); setLicenseSuccess(false); }}
                        placeholder="SCIFLOW-XXXX-XXXX-XXXX-XXXX"
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center tracking-wider outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        onKeyDown={e => e.key === 'Enter' && handleActivateLicense()}
                      />
                      <button
                        onClick={handleActivateLicense}
                        disabled={licenseLoading || !licenseCode.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95 shadow-md whitespace-nowrap"
                      >
                        {licenseLoading ? <i className="fa-solid fa-spinner fa-spin" /> : '激活'}
                      </button>
                    </div>
                    {licenseError && (
                      <p className="text-[9px] text-rose-600 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-circle-xmark"></i> {licenseError}
                      </p>
                    )}
                    {licenseSuccess && (
                      <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-circle-check"></i> 激活成功！
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => window.open('https://github.com/gwennsteglik252-create/sciflow-releases/issues/new?labels=license&title=申请获取授权码', '_blank')}
                        className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer bg-transparent border-none p-0"
                      >
                        <i className="fa-solid fa-envelope mr-1"></i>
                        获取激活码 →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Interaction & Behavior */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">交互与通知 (INTERACTION)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">启用桌面通知</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Task Completion Alerts</p>
                  </div>
                  {/* Fixed syntax error in template literal on the following line */}
                  <button
                    onClick={() => setAppSettings({ enableNotifications: !appSettings.enableNotifications })}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${appSettings.enableNotifications ? 'bg-emerald-50' : 'bg-slate-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.enableNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">自动保存策略</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Auto-Save Interval</p>
                  </div>
                  <select
                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-1 px-2 rounded-lg outline-none cursor-pointer"
                    value={appSettings.autoSaveInterval || 5}
                    onChange={(e) => setAppSettings({ autoSaveInterval: parseInt(e.target.value) })}
                  >
                    <option value={1}>实时 (1m)</option>
                    <option value={5}>标准 (5m)</option>
                    <option value={15}>低频 (15m)</option>
                    <option value={0}>关闭 (Off)</option>
                  </select>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'appearance' && (<>
            {/* Appearance & Theme */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-palette text-pink-500"></i> 外观与主题 (APPEARANCE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">界面主题模式</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Color Theme Mode</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['light', 'dark', 'system'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setThemeMode(mode)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${themeMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {mode === 'light' ? '☀️ 浅色' : mode === 'dark' ? '🌙 深色' : '💻 跟随系统'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">界面缩放</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">UI Scale: {uiScale}%</p>
                  </div>
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400">80%</span>
                    <input
                      type="range" min={80} max={120} step={10}
                      value={uiScale}
                      onChange={e => setUiScale(Number(e.target.value) as any)}
                      className="flex-1 accent-indigo-600 h-1.5 cursor-pointer"
                    />
                    <span className="text-[9px] font-bold text-slate-400">120%</span>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">编辑器字体大小</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Editor Font Size: {editorFontSize}px</p>
                  </div>
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <span className="text-[9px] font-bold text-slate-400">12</span>
                    <input
                      type="range" min={12} max={24} step={1}
                      value={editorFontSize}
                      onChange={e => setEditorFontSize(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 h-1.5 cursor-pointer"
                    />
                    <span className="text-[9px] font-bold text-slate-400">24</span>
                  </div>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'data' && (<>
            {/* Data & Visualization */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-chart-pie text-cyan-500"></i> 数据与可视化 (DATA & VISUALIZATION)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">默认导出格式</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultExportFormat}
                        onChange={e => setDefaultExportFormat(e.target.value as any)}
                      >
                        <option value="SVG">SVG (矢量)</option>
                        <option value="PNG">PNG (位图)</option>
                        <option value="PDF">PDF (文档)</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">默认导出 DPI</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultExportDPI}
                        onChange={e => setDefaultExportDPI(Number(e.target.value) as any)}
                      >
                        <option value={300}>300 DPI (标准)</option>
                        <option value={600}>600 DPI (高清)</option>
                        <option value={1200}>1200 DPI (出版级)</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">图表默认字体</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultChartFont}
                        onChange={e => setDefaultChartFont(e.target.value)}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Roboto">Roboto</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">默认配色方案</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultColorPalette}
                        onChange={e => setDefaultColorPalette(e.target.value)}
                      >
                        <option value="Nature">Nature 色板</option>
                        <option value="Science">Science 色板</option>
                        <option value="JACS">JACS 色板</option>
                        <option value="ACS Nano">ACS Nano 色板</option>
                        <option value="Pastel">柔和色板</option>
                        <option value="Vibrant">鲜明色板</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'system' && (<>
            {/* Network & Proxy */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-tower-broadcast text-teal-500"></i> 网络与代理 (NETWORK & PROXY)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">启用 HTTP 代理</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Route AI Requests via Proxy</p>
                  </div>
                  <button
                    onClick={() => setProxyEnabled(!proxyEnabled)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${proxyEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${proxyEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                {proxyEnabled && (
                  <div className="animate-reveal">
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">代理地址</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono outline-none focus:border-indigo-400 transition-colors shadow-sm"
                      value={proxyUrl}
                      onChange={e => setProxyUrl(e.target.value)}
                      placeholder="http://127.0.0.1:7890"
                    />
                  </div>
                )}

                <div className="w-full h-px bg-slate-200"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">AI 请求超时</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Request Timeout: {aiRequestTimeout}s</p>
                  </div>
                  <select
                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                    value={aiRequestTimeout}
                    onChange={e => setAiRequestTimeout(Number(e.target.value))}
                  >
                    <option value={30}>30 秒</option>
                    <option value={60}>60 秒 (默认)</option>
                    <option value={120}>120 秒</option>
                    <option value={300}>300 秒</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Privacy & Security */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-emerald-500"></i> 隐私与安全 (PRIVACY & SECURITY)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">AI 数据发送确认</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase leading-relaxed">Confirm Before Sending Data to AI</p>
                    <p className="text-[8px] text-slate-400 italic mt-1">开启后，每次向 AI 发送实验数据前将弹窗二次确认</p>
                  </div>
                  <button
                    onClick={() => setConfirmBeforeAISend(!confirmBeforeAISend)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 shrink-0 ${confirmBeforeAISend ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${confirmBeforeAISend ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Backup & Restore */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-cloud-arrow-down text-blue-500"></i> 备份与恢复 (BACKUP & RESTORE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleExportSettings}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                  >
                    <i className="fa-solid fa-file-export text-indigo-500 group-hover:scale-110 transition-transform"></i>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-800 uppercase">导出设置</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Export as JSON</p>
                    </div>
                  </button>
                  <button
                    onClick={handleImportSettings}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50 transition-all group"
                  >
                    <i className="fa-solid fa-file-import text-amber-500 group-hover:scale-110 transition-transform"></i>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-800 uppercase">导入设置</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Restore from JSON</p>
                    </div>
                  </button>
                </div>
                <p className="text-[7px] text-slate-400 mt-3 font-bold uppercase tracking-widest italic px-1">
                  <i className="fa-solid fa-circle-info mr-1 text-blue-400"></i>
                  导出文件包含所有配置项（含 API Key），请妥善保管
                </p>
              </div>
            </section>

            {/* Keyboard Shortcuts — stays in 'system' */}
            {/* Keyboard Shortcuts */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-keyboard text-orange-500"></i> 快捷键一览 (KEYBOARD SHORTCUTS)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: '全局搜索', keys: '⌘ / Ctrl + K' },
                    { label: 'AI 命令行', keys: '⌘ / Ctrl + J' },
                    { label: '保存文档', keys: '⌘ / Ctrl + S' },
                    { label: '撤销', keys: '⌘ / Ctrl + Z' },
                    { label: '重做', keys: '⌘ / Ctrl + Shift + Z' },
                    { label: '全屏截图', keys: '⌘ / Ctrl + Shift + S' },
                    { label: '对话内搜索', keys: '⌘ / Ctrl + F' },
                    { label: '关闭弹窗', keys: 'Escape' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-600">{s.label}</span>
                      <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{s.keys}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[7px] text-slate-400 mt-3 font-bold uppercase tracking-widest italic px-1">
                  <i className="fa-solid fa-circle-info mr-1 text-orange-400"></i>
                  快捷键暂不支持自定义，后续版本计划开放
                </p>
              </div>
            </section>
          </>)}

          {settingsTab === 'appearance' && (<>
            {/* Language & Locale */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-globe text-sky-500"></i> 语言与区域 (LANGUAGE & LOCALE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">界面语言</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={() => setUiLanguage('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${uiLanguage === 'zh' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>中文</button>
                      <button onClick={() => setUiLanguage('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${uiLanguage === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">日期格式</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={dateFormat}
                        onChange={e => setDateFormat(e.target.value as any)}
                      >
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">AI 输出语言</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">AI Response Language</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['auto', 'zh', 'en'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setAiOutputLanguage(lang)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiOutputLanguage === lang ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {lang === 'auto' ? '🔄 自动' : lang === 'zh' ? '中文' : 'EN'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'research' && (<>
            {/* Writing Preferences */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-pen-nib text-violet-500"></i> 写作偏好 (WRITING PREFERENCES)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">AI 润色强度</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Polish Intensity Level</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['light', 'moderate', 'deep'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setAiPolishIntensity(level)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiPolishIntensity === level ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {level === 'light' ? '轻度 (语法)' : level === 'moderate' ? '中度 (风格)' : '深度 (改写)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">默认写作语言</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={() => setDefaultWritingLanguage('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${defaultWritingLanguage === 'zh' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>中文</button>
                      <button onClick={() => setDefaultWritingLanguage('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${defaultWritingLanguage === 'en' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">段落缩进</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={() => setParagraphIndent('indent')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${paragraphIndent === 'indent' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>首行缩进</button>
                      <button onClick={() => setParagraphIndent('no-indent')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${paragraphIndent === 'no-indent' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>无缩进</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Experiment Defaults */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-flask-vial text-rose-500"></i> 实验参数默认值 (EXPERIMENT DEFAULTS)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">XRD 默认辐射源</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultXrdRadiation}
                        onChange={e => setDefaultXrdRadiation(e.target.value as any)}
                      >
                        <option value="Cu Kα">Cu Kα (λ=1.5406 Å)</option>
                        <option value="Mo Kα">Mo Kα (λ=0.7107 Å)</option>
                        <option value="Co Kα">Co Kα (λ=1.7889 Å)</option>
                        <option value="Ag Kα">Ag Kα (λ=0.5594 Å)</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">XPS 能量参考</label>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors shadow-sm"
                      value={defaultXpsReference}
                      onChange={e => setDefaultXpsReference(e.target.value)}
                      placeholder="C 1s 284.8 eV"
                    />
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">SEM 默认加速电压 (kV)</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultSemVoltage}
                        onChange={e => setDefaultSemVoltage(Number(e.target.value))}
                      >
                        <option value={1}>1 kV</option>
                        <option value={3}>3 kV</option>
                        <option value={5}>5 kV</option>
                        <option value={10}>10 kV</option>
                        <option value={15}>15 kV</option>
                        <option value={20}>20 kV</option>
                        <option value={30}>30 kV</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">TEM 默认加速电压 (kV)</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultTemVoltage}
                        onChange={e => setDefaultTemVoltage(Number(e.target.value))}
                      >
                        <option value={80}>80 kV</option>
                        <option value={100}>100 kV</option>
                        <option value={120}>120 kV</option>
                        <option value={200}>200 kV</option>
                        <option value={300}>300 kV</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>
                <p className="text-[7px] text-slate-400 mt-1 font-bold uppercase tracking-widest italic px-1">
                  <i className="fa-solid fa-circle-info mr-1 text-rose-400"></i>
                  这些默认值将在新建实验表征时自动填充，可在具体模块中覆盖
                </p>
              </div>
            </section>
          </>)}

          {settingsTab === 'system' && (<>
            {/* Storage Management */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">文献存储管理 (STORAGE)</h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <label className="block text-[9px] font-black text-slate-500 uppercase mb-3 px-1">默认本地文献库路径</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                  />
                  <button className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                    浏览...
                  </button>
                </div>
                <p className="text-[7px] text-slate-400 mt-2 font-bold uppercase tracking-widest italic px-1">AI 检索本地档案时将以此目录为根路径</p>
              </div>
            </section>

            {/* AI Conversation Management */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-comments text-purple-500"></i> AI 对话管理 (CHAT MANAGEMENT)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">对话历史保留</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">History Retention Period</p>
                  </div>
                  <select
                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                    value={chatHistoryRetentionDays}
                    onChange={e => setChatHistoryRetentionDays(Number(e.target.value))}
                  >
                    <option value={7}>7 天</option>
                    <option value={30}>30 天 (默认)</option>
                    <option value={90}>90 天</option>
                    <option value={365}>永久保留</option>
                  </select>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">自动清理过期对话</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Auto-Clear Expired Chats</p>
                  </div>
                  <button
                    onClick={() => setAutoClearChat(!autoClearChat)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${autoClearChat ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${autoClearChat ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Window Behavior */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-window-restore text-sky-500"></i> 窗口行为 (WINDOW BEHAVIOR)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">恢复上次窗口位置</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Restore Window Position on Launch</p>
                  </div>
                  <button
                    onClick={() => setRestoreWindowPosition(!restoreWindowPosition)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${restoreWindowPosition ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${restoreWindowPosition ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">记住最后打开的页面</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Remember Last Visited Page</p>
                  </div>
                  <button
                    onClick={() => setRememberLastPage(!rememberLastPage)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${rememberLastPage ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${rememberLastPage ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* Performance */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-bolt text-amber-500"></i> 性能调优 (PERFORMANCE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">GPU 硬件加速</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Hardware Acceleration</p>
                  </div>
                  <button
                    onClick={() => setGpuAcceleration(!gpuAcceleration)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${gpuAcceleration ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${gpuAcceleration ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">缓存大小上限</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">Max Cache: {cacheMaxSizeMB} MB</p>
                  </div>
                  <select
                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                    value={cacheMaxSizeMB}
                    onChange={e => setCacheMaxSizeMB(Number(e.target.value))}
                  >
                    <option value={256}>256 MB</option>
                    <option value={512}>512 MB (默认)</option>
                    <option value={1024}>1 GB</option>
                    <option value={2048}>2 GB</option>
                  </select>
                </div>
              </div>
            </section>

            {/* About & Update */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-circle-info text-indigo-500"></i> 关于与更新 (ABOUT & UPDATE)
              </h4>
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-[2rem] border border-indigo-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-lg font-black text-slate-800 tracking-tight">SciFlow Pro</p>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">v{appVersion}</p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <i className="fa-solid fa-flask text-white"></i>
                  </div>
                </div>

                {/* 更新状态展示 */}
                <div className="bg-white/60 rounded-xl p-3 mb-4">
                  {updateStatus === 'idle' && (
                    <p className="text-[10px] text-slate-500 font-bold">点击下方按钮检查是否有新版本可用</p>
                  )}
                  {updateStatus === 'checking' && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-spinner fa-spin text-indigo-500 text-xs"></i>
                      <p className="text-[10px] text-indigo-600 font-bold">正在检查更新...</p>
                    </div>
                  )}
                  {updateStatus === 'not-available' && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                      <p className="text-[10px] text-emerald-600 font-bold">当前已是最新版本 ✨</p>
                    </div>
                  )}
                  {updateStatus === 'available' && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <i className="fa-solid fa-gift text-amber-500 text-xs"></i>
                        <p className="text-[10px] text-amber-700 font-black">发现新版本 v{updateVersion}！</p>
                      </div>
                      <p className="text-[9px] text-slate-400">点击下方按钮开始下载更新</p>
                    </div>
                  )}
                  {updateStatus === 'downloading' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-cloud-arrow-down text-blue-500 text-xs animate-bounce"></i>
                          <p className="text-[10px] text-blue-600 font-bold">正在下载更新...</p>
                        </div>
                        <span className="text-[10px] font-black text-blue-700">{updateProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
                      </div>
                    </div>
                  )}
                  {updateStatus === 'downloaded' && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-rocket text-violet-500 text-xs"></i>
                      <p className="text-[10px] text-violet-700 font-black">v{updateVersion} 已下载完成，点击下方按钮重启安装！</p>
                    </div>
                  )}
                  {updateStatus === 'error' && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-rose-500 text-xs"></i>
                      <p className="text-[10px] text-rose-600 font-bold">{updateError}</p>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                {updateStatus === 'available' ? (
                  <button
                    onClick={handleDownloadUpdate}
                    className="w-full py-3 bg-amber-500 rounded-xl text-[10px] font-black text-white uppercase hover:bg-amber-600 transition-all active:scale-95 shadow-sm"
                  >
                    <i className="fa-solid fa-cloud-arrow-down mr-1.5"></i> 下载更新 v{updateVersion}
                  </button>
                ) : updateStatus === 'downloaded' ? (
                  <button
                    onClick={handleInstallUpdate}
                    className="w-full py-3 bg-violet-600 rounded-xl text-[10px] font-black text-white uppercase hover:bg-violet-700 transition-all active:scale-95 shadow-sm"
                  >
                    <i className="fa-solid fa-rocket mr-1.5"></i> 立即重启并安装
                  </button>
                ) : updateStatus === 'downloading' ? (
                  <button disabled className="w-full py-3 bg-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase cursor-not-allowed">
                    <i className="fa-solid fa-spinner fa-spin mr-1.5"></i> 下载中 {updateProgress}%...
                  </button>
                ) : (
                  <button
                    onClick={handleCheckUpdate}
                    disabled={updateStatus === 'checking'}
                    className={`w-full py-3 bg-white border border-indigo-200 rounded-xl text-[10px] font-black text-indigo-700 uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm ${updateStatus === 'checking' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <i className={`fa-solid fa-arrows-rotate mr-1.5 ${updateStatus === 'checking' ? 'fa-spin' : ''}`}></i>
                    {updateStatus === 'checking' ? '检查中...' : '检查更新'}
                  </button>
                )}
              </div>
            </section>

            {/* Danger Zone */}
            <section className="pt-6 border-t border-slate-100">
              <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                    <i className="fa-solid fa-trash-can text-xl"></i>
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-rose-900 uppercase">危险区域 (DANGER ZONE)</h5>
                    <p className="text-[10px] text-rose-700 font-medium leading-relaxed italic">移除所有本地存档数据，该操作不可撤销。</p>
                  </div>
                </div>
                <button
                  onClick={handleClearCache}
                  className="px-8 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-200 hover:bg-black transition-all active:scale-95 whitespace-nowrap"
                >
                  清除本地所有缓存
                </button>
              </div>
            </section>
          </>)}
        </div>

        <footer className="mt-8 shrink-0">
          <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95">完成设置并保存</button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;