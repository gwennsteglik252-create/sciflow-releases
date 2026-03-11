import React, { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { AIProvider } from '../../types';
import { getLicenseState, activateLicense, LicenseState } from '../../services/licenseService';
import { useTranslation } from '../../locales/useTranslation';
import ProviderConfigCard, { ProviderConfigState, ConnectionStatus } from './ProviderConfigCard';
import { PROVIDER_REGISTRY, ModelOption } from '../../config/aiProviders';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onOpenConfirm: (config: any) => void;
}

// 模型列表和 Provider 配置已迁移至 config/aiProviders.ts

const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, onOpenConfirm }) => {
  const { appSettings, setAppSettings } = useProjectContext();
  const { t } = useTranslation();
  const [localPath, setLocalPath] = useState(appSettings.localLibraryPath);

  const [activeProvider, setActiveProvider] = useState<AIProvider>(appSettings.activeModelProvider || 'auto');
  const [routingPreference, setRoutingPreference] = useState<'cost' | 'quality'>(appSettings.autoRoutingPreference || 'cost');

  // ── 结构化的 Provider 配置状态 ──
  const [providerConfigs, setProviderConfigs] = useState<Record<string, ProviderConfigState>>(() => ({
    gemini: {
      apiKey: appSettings.geminiConfig?.apiKey || '',
      baseUrl: appSettings.geminiConfig?.baseUrl || '',
      modelName: appSettings.geminiConfig?.modelName || 'gemini-2.0-flash',
      connectionStatus: 'idle' as ConnectionStatus,
    },
    openai: {
      apiKey: appSettings.openaiConfig?.apiKey || '',
      baseUrl: appSettings.openaiConfig?.baseUrl || 'https://api.openai.com/v1',
      modelName: appSettings.openaiConfig?.modelName || 'gpt-4o',
      connectionStatus: 'idle' as ConnectionStatus,
    },
    doubao: {
      apiKey: appSettings.doubaoConfig?.apiKey || '',
      baseUrl: appSettings.doubaoConfig?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
      modelName: appSettings.doubaoConfig?.modelName || '',
      connectionStatus: 'idle' as ConnectionStatus,
    },
    anthropic: {
      apiKey: appSettings.anthropicConfig?.apiKey || '',
      baseUrl: appSettings.anthropicConfig?.baseUrl || 'https://api.anthropic.com/v1',
      modelName: appSettings.anthropicConfig?.modelName || 'claude-3-5-sonnet-20240620',
      connectionStatus: 'idle' as ConnectionStatus,
    },
  }));

  const updateProviderConfig = useCallback((providerId: string, patch: Partial<ProviderConfigState>) => {
    setProviderConfigs(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], ...patch },
    }));
  }, []);

  const [dynamicModels, setDynamicModels] = useState<Record<string, ModelOption[]>>({});
  const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});
  const [settingsTab, setSettingsTab] = useState<'ai' | 'appearance' | 'research' | 'data' | 'system'>('ai');

  // -- New settings state (each setter also immediately persists to appSettings) --
  const [themeMode, _setThemeMode] = useState<'light' | 'dark' | 'system'>(appSettings.themeMode || 'light');
  const setThemeMode = (v: 'light' | 'dark' | 'system') => { _setThemeMode(v); setAppSettings({ themeMode: v }); };
  const [uiScale, _setUiScale] = useState(appSettings.uiScale || 100);
  const setUiScale = (v: number) => { _setUiScale(v as any); setAppSettings({ uiScale: v as any }); };
  const [editorFontSize, _setEditorFontSize] = useState(appSettings.editorFontSize || 14);
  const setEditorFontSize = (v: number) => { _setEditorFontSize(v); setAppSettings({ editorFontSize: v }); };
  const [defaultExportFormat, _setDefaultExportFormat] = useState<'SVG' | 'PNG' | 'PDF'>(appSettings.defaultExportFormat || 'PNG');
  const setDefaultExportFormat = (v: 'SVG' | 'PNG' | 'PDF') => { _setDefaultExportFormat(v); setAppSettings({ defaultExportFormat: v }); };
  const [defaultExportDPI, _setDefaultExportDPI] = useState<300 | 600 | 1200>(appSettings.defaultExportDPI || 300);
  const setDefaultExportDPI = (v: 300 | 600 | 1200) => { _setDefaultExportDPI(v); setAppSettings({ defaultExportDPI: v }); };
  const [defaultChartFont, _setDefaultChartFont] = useState(appSettings.defaultChartFont || 'Arial');
  const setDefaultChartFont = (v: string) => { _setDefaultChartFont(v); setAppSettings({ defaultChartFont: v }); };
  const [defaultColorPalette, _setDefaultColorPalette] = useState(appSettings.defaultColorPalette || 'Nature');
  const setDefaultColorPalette = (v: string) => { _setDefaultColorPalette(v); setAppSettings({ defaultColorPalette: v }); };
  const [proxyEnabled, _setProxyEnabled] = useState(appSettings.proxyEnabled || false);
  const setProxyEnabled = (v: boolean) => { _setProxyEnabled(v); setAppSettings({ proxyEnabled: v }); };
  const [proxyUrl, _setProxyUrl] = useState(appSettings.proxyUrl || '');
  const setProxyUrl = (v: string) => { _setProxyUrl(v); setAppSettings({ proxyUrl: v }); };
  const [aiRequestTimeout, _setAiRequestTimeout] = useState(appSettings.aiRequestTimeout || 60);
  const setAiRequestTimeout = (v: number) => { _setAiRequestTimeout(v); setAppSettings({ aiRequestTimeout: v }); };
  const [confirmBeforeAISend, _setConfirmBeforeAISend] = useState(appSettings.confirmBeforeAISend ?? false);
  const setConfirmBeforeAISend = (v: boolean) => { _setConfirmBeforeAISend(v); setAppSettings({ confirmBeforeAISend: v }); };

  // -- Round 2 settings state --
  const [uiLanguage, _setUiLanguage] = useState<'zh' | 'en'>(appSettings.uiLanguage || 'zh');
  const setUiLanguage = (v: 'zh' | 'en') => { _setUiLanguage(v); setAppSettings({ uiLanguage: v }); };
  const [dateFormat, _setDateFormat] = useState(appSettings.dateFormat || 'YYYY-MM-DD');
  const setDateFormat = (v: string) => { _setDateFormat(v as any); setAppSettings({ dateFormat: v as any }); };
  const [aiOutputLanguage, _setAiOutputLanguage] = useState<'zh' | 'en' | 'auto'>(appSettings.aiOutputLanguage || 'auto');
  const setAiOutputLanguage = (v: 'zh' | 'en' | 'auto') => { _setAiOutputLanguage(v); setAppSettings({ aiOutputLanguage: v }); };
  const [aiPolishIntensity, _setAiPolishIntensity] = useState<'light' | 'moderate' | 'deep'>(appSettings.aiPolishIntensity || 'moderate');
  const setAiPolishIntensity = (v: 'light' | 'moderate' | 'deep') => { _setAiPolishIntensity(v); setAppSettings({ aiPolishIntensity: v }); };
  const [defaultWritingLanguage, _setDefaultWritingLanguage] = useState<'zh' | 'en'>(appSettings.defaultWritingLanguage || 'zh');
  const setDefaultWritingLanguage = (v: 'zh' | 'en') => { _setDefaultWritingLanguage(v); setAppSettings({ defaultWritingLanguage: v }); };
  const [paragraphIndent, _setParagraphIndent] = useState<'indent' | 'no-indent'>(appSettings.paragraphIndent || 'indent');
  const setParagraphIndent = (v: 'indent' | 'no-indent') => { _setParagraphIndent(v); setAppSettings({ paragraphIndent: v }); };
  const [defaultXrdRadiation, _setDefaultXrdRadiation] = useState(appSettings.defaultXrdRadiation || 'Cu Kα');
  const setDefaultXrdRadiation = (v: string) => { _setDefaultXrdRadiation(v as any); setAppSettings({ defaultXrdRadiation: v as any }); };
  const [defaultXpsReference, _setDefaultXpsReference] = useState(appSettings.defaultXpsReference || 'C 1s 284.8 eV');
  const setDefaultXpsReference = (v: string) => { _setDefaultXpsReference(v); setAppSettings({ defaultXpsReference: v }); };
  const [defaultSemVoltage, _setDefaultSemVoltage] = useState(appSettings.defaultSemVoltage || 15);
  const setDefaultSemVoltage = (v: number) => { _setDefaultSemVoltage(v); setAppSettings({ defaultSemVoltage: v }); };
  const [defaultTemVoltage, _setDefaultTemVoltage] = useState(appSettings.defaultTemVoltage || 200);
  const setDefaultTemVoltage = (v: number) => { _setDefaultTemVoltage(v); setAppSettings({ defaultTemVoltage: v }); };

  // -- Round 3 settings state --
  const [chatHistoryRetentionDays, _setChatHistoryRetentionDays] = useState(appSettings.chatHistoryRetentionDays || 30);
  const setChatHistoryRetentionDays = (v: number) => { _setChatHistoryRetentionDays(v); setAppSettings({ chatHistoryRetentionDays: v }); };
  const [autoClearChat, _setAutoClearChat] = useState(appSettings.autoClearChat ?? false);
  const setAutoClearChat = (v: boolean) => { _setAutoClearChat(v); setAppSettings({ autoClearChat: v }); };
  const [restoreWindowPosition, _setRestoreWindowPosition] = useState(appSettings.restoreWindowPosition ?? true);
  const setRestoreWindowPosition = (v: boolean) => { _setRestoreWindowPosition(v); setAppSettings({ restoreWindowPosition: v }); };
  const [rememberLastPage, _setRememberLastPage] = useState(appSettings.rememberLastPage ?? true);
  const setRememberLastPage = (v: boolean) => { _setRememberLastPage(v); setAppSettings({ rememberLastPage: v }); };
  const [gpuAcceleration, _setGpuAcceleration] = useState(appSettings.gpuAcceleration ?? true);
  const setGpuAcceleration = (v: boolean) => { _setGpuAcceleration(v); setAppSettings({ gpuAcceleration: v }); };
  const [cacheMaxSizeMB, _setCacheMaxSizeMB] = useState(appSettings.cacheMaxSizeMB || 512);
  const setCacheMaxSizeMB = (v: number) => { _setCacheMaxSizeMB(v); setAppSettings({ cacheMaxSizeMB: v }); };

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



  if (!show) return null;

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
    const gc = providerConfigs.gemini;
    const oc = providerConfigs.openai;
    const dc = providerConfigs.doubao;
    const ac = providerConfigs.anthropic;
    setAppSettings({
      localLibraryPath: localPath,
      activeModelProvider: activeProvider,
      autoRoutingPreference: routingPreference,
      openaiConfig: { apiKey: oc.apiKey, baseUrl: oc.baseUrl, modelName: oc.modelName },
      anthropicConfig: { apiKey: ac.apiKey, modelName: ac.modelName },
      doubaoConfig: { apiKey: dc.apiKey, baseUrl: dc.baseUrl, modelName: dc.modelName },
      geminiConfig: { apiKey: gc.apiKey, baseUrl: gc.baseUrl, modelName: gc.modelName },
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

  const handleRefreshModelsForProvider = async (providerId: string) => {
    const cfg = providerConfigs[providerId];
    if (!cfg?.baseUrl || !cfg?.apiKey) {
      alert("请先输入有效的 API 地址和 API Key。");
      return;
    }

    setIsRefreshing(prev => ({ ...prev, [providerId]: true }));
    try {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/models`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      };

      let responseData: any;

      // 优先使用 Electron IPC 桥绕过 CORS
      if (window.electron?.httpRequest) {
        const resp = await window.electron.httpRequest({ url, method: 'GET', headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        responseData = JSON.parse(resp.body);
      } else {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        responseData = await response.json();
      }

      const models = responseData.data
        .filter((m: any) => m.id)
        .map((m: any) => ({ label: m.id, value: m.id }));

      if (models.length > 0) {
        setDynamicModels(prev => ({ ...prev, [cfg.baseUrl]: models }));
        alert(`成功获取 ${models.length} 个模型！`);
      } else {
        alert("未发现可用模型。");
      }
    } catch (err) {
      console.error("Refresh models failed:", err);
      alert("模型列表更新失败，请检查网络或 API Key。");
    } finally {
      setIsRefreshing(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleApiKeyCacheUpdate = (baseUrl: string, key: string) => {
    setApiKeyCache(prev => {
      const next = { ...prev, [baseUrl]: key };
      localStorage.setItem('sciflow_api_key_cache', JSON.stringify(next));
      return next;
    });
  };

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
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">{t('settings.title')}</h3>
        </header>

        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 shrink-0 overflow-x-auto no-scrollbar">
          {([
            { id: 'ai' as const, label: t('settings.tabs.ai'), icon: 'fa-microchip' },
            { id: 'appearance' as const, label: t('settings.tabs.appearance'), icon: 'fa-palette' },
            { id: 'research' as const, label: t('settings.tabs.research'), icon: 'fa-flask-vial' },
            { id: 'data' as const, label: t('settings.tabs.data'), icon: 'fa-chart-pie' },
            { id: 'system' as const, label: t('settings.tabs.system'), icon: 'fa-gear' },
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
            {/* ── 多模型混合引擎 (Hybrid AI Engine) ── */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-microchip text-violet-500"></i> {t('settings.ai.hybridEngine')} (HYBRID AI ENGINE)
              </h4>
              <div className="bg-violet-50/50 p-5 rounded-[2rem] border border-violet-100 space-y-4">
                {/* ── 引擎选择栏 ── */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.ai.preferredEngine')}</p>
                    {activeProvider === 'auto' && (
                      <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full animate-pulse">{t('settings.ai.routingActive')}</span>
                    )}
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
                    {(['auto', 'gemini', 'openai', 'doubao', 'anthropic'] as const).map(provider => (
                      <button
                        key={provider}
                        onClick={() => setActiveProvider(provider)}
                        className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeProvider === provider ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {provider === 'auto' ? t('settings.ai.smartRouting') : provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : provider === 'doubao' ? 'Doubao' : 'Anthropic'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── 智能路由策略面板 ── */}
                {activeProvider === 'auto' && (
                  <div className="animate-reveal space-y-4 bg-indigo-900 text-white p-6 rounded-2xl border border-indigo-400 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fa-solid fa-compass text-6xl"></i></div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">{t('settings.ai.orchestration')} (ORCHESTRATION)</h5>
                    <p className="text-[11px] font-medium leading-relaxed italic opacity-90">{t('settings.ai.orchestrationDesc')}</p>
                    <div className="pt-4 border-t border-white/10 mt-2">
                      <p className="text-[9px] font-black uppercase mb-3">{t('settings.ai.routingPreference')}</p>
                      <div className="flex bg-white/10 p-1 rounded-xl">
                        <button onClick={() => setRoutingPreference('cost')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${routingPreference === 'cost' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 opacity-60'}`}>{t('settings.ai.costFirst')}</button>
                        <button onClick={() => setRoutingPreference('quality')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${routingPreference === 'quality' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 opacity-60'}`}>{t('settings.ai.qualityFirst')}</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Provider 配置卡片 (Accordion) ── */}
                <div className="space-y-2">
                  {PROVIDER_REGISTRY
                    .filter(p => activeProvider === 'auto' || activeProvider === p.id)
                    .map(providerDef => (
                      <ProviderConfigCard
                        key={providerDef.id}
                        provider={providerDef}
                        config={providerConfigs[providerDef.id]}
                        onConfigChange={(patch) => updateProviderConfig(providerDef.id, patch)}
                        isActive={activeProvider === providerDef.id}
                        isAutoMode={activeProvider === 'auto'}
                        defaultExpanded={activeProvider !== 'auto'}
                        dynamicModels={dynamicModels[providerConfigs[providerDef.id]?.baseUrl] || []}
                        isRefreshing={isRefreshing[providerDef.id]}
                        onRefreshModels={providerDef.supportsRefreshModels ? () => handleRefreshModelsForProvider(providerDef.id) : undefined}
                        apiKeyCache={apiKeyCache}
                        onApiKeyCacheUpdate={handleApiKeyCacheUpdate}
                        isAiStudioAvailable={!!window.aistudio}
                        onAiStudioSync={providerDef.isAiStudioSyncable ? handleSelectApiKey : undefined}
                      />
                    ))
                  }
                </div>
              </div>
            </section>

            {/* AI 配置面板 */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.ai.automationStrategy')} (AUTOMATION)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div className="min-w-0 pr-4">
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.autoDiagnose')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.autoDiagnoseDesc')}</p>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.realtimePolish')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.realtimePolishDesc')}</p>
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
                <i className="fa-solid fa-medal text-amber-500"></i> {t('settings.research.scientificStandards')} (SCIENTIFIC STANDARDS)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.defaultCitation')}</p>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.latexStyle')}</p>
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
                <i className="fa-solid fa-shield-halved text-emerald-500"></i> {t('settings.system.license')} (LICENSE)
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
                        {licenseState?.status === 'activated' ? t('settings.system.activated') : licenseState?.status === 'trial' ? t('settings.system.trial') : t('settings.system.expired')}
                      </p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        {licenseState?.status === 'activated'
                          ? `${t('settings.system.permanentLicense')} · ${t('settings.system.activatedAt')} ${licenseState.activatedAt ? new Date(licenseState.activatedAt).toLocaleDateString() : '—'}`
                          : licenseState?.status === 'trial'
                            ? t('settings.system.trialDaysRemaining', { days: licenseState.trialDaysRemaining || 0 })
                            : t('settings.system.enterActivationCode')
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
                    <label className="text-[9px] font-black text-slate-400 uppercase block">{t('settings.system.enterActivationCode')}</label>
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
                        {licenseLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('settings.system.activate')}
                      </button>
                    </div>
                    {licenseError && (
                      <p className="text-[9px] text-rose-600 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-circle-xmark"></i> {licenseError}
                      </p>
                    )}
                    {licenseSuccess && (
                      <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                        <i className="fa-solid fa-circle-check"></i> {t('settings.system.activationSuccess')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => window.open('https://github.com/gwennsteglik252-create/sciflow-releases/issues/new?labels=license&title=申请获取授权码', '_blank')}
                        className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer bg-transparent border-none p-0"
                      >
                        <i className="fa-solid fa-envelope mr-1"></i>
                        {t('settings.system.getActivationCode')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Interaction & Behavior */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.system.interaction')} (INTERACTION)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.enableNotifications')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.notificationsDesc')}</p>
                  </div>
                  {/* Fixed syntax error in template literal on the following line */}
                  <button
                    onClick={() => setAppSettings({ enableNotifications: !appSettings.enableNotifications })}
                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${appSettings.enableNotifications ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.enableNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.autoSave')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.autoSave')}</p>
                  </div>
                  <select
                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-1 px-2 rounded-lg outline-none cursor-pointer"
                    value={appSettings.autoSaveInterval || 5}
                    onChange={(e) => setAppSettings({ autoSaveInterval: parseInt(e.target.value) })}
                  >
                    <option value={1}>{t('settings.system.autoSaveRealtime')}</option>
                    <option value={5}>{t('settings.system.autoSaveStandard')}</option>
                    <option value={15}>{t('settings.system.autoSaveLow')}</option>
                    <option value={0}>{t('settings.system.autoSaveOff')}</option>
                  </select>
                </div>
              </div>
            </section>
          </>)}

          {settingsTab === 'appearance' && (<>
            {/* Appearance & Theme */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-palette text-pink-500"></i> {t('settings.appearance.title')} (APPEARANCE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.themeMode')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.themeMode')}</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['light', 'dark', 'system'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setThemeMode(mode)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${themeMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {mode === 'light' ? t('settings.appearance.light') : mode === 'dark' ? t('settings.appearance.dark') : t('settings.appearance.system')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.uiScale')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.uiScale')}: {uiScale}%</p>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.editorFontSize')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.editorFontSize')}: {editorFontSize}px</p>
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
                <i className="fa-solid fa-chart-pie text-cyan-500"></i> {t('settings.data.title')} (DATA & VISUALIZATION)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.defaultExportFormat')}</label>
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
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.defaultExportDPI')}</label>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm"
                        value={defaultExportDPI}
                        onChange={e => setDefaultExportDPI(Number(e.target.value) as any)}
                      >
                        <option value={300}>300 DPI ({t('settings.data.dpiStandard')})</option>
                        <option value={600}>600 DPI ({t('settings.data.dpiHD')})</option>
                        <option value={1200}>1200 DPI ({t('settings.data.dpiPublication')})</option>
                      </select>
                      <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.chartFont')}</label>
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
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.colorPalette')}</label>
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
                <i className="fa-solid fa-tower-broadcast text-teal-500"></i> {t('settings.system.networkProxy')} (NETWORK & PROXY)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.enableProxy')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.proxyDesc')}</p>
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
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.system.proxyAddress')}</label>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.aiTimeout')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.aiTimeout')}: {aiRequestTimeout}s</p>
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
                <i className="fa-solid fa-shield-halved text-emerald-500"></i> {t('settings.system.privacySecurity')} (PRIVACY & SECURITY)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.confirmBeforeAI')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.confirmBeforeAI')}</p>
                    <p className="text-[8px] text-slate-400 italic mt-1">{t('settings.system.confirmBeforeAIDesc')}</p>
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
                <i className="fa-solid fa-cloud-arrow-down text-blue-500"></i> {t('settings.system.backupRestore')} (BACKUP & RESTORE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleExportSettings}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                  >
                    <i className="fa-solid fa-file-export text-indigo-500 group-hover:scale-110 transition-transform"></i>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.system.exportSettings')}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Export as JSON</p>
                    </div>
                  </button>
                  <button
                    onClick={handleImportSettings}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50 transition-all group"
                  >
                    <i className="fa-solid fa-file-import text-amber-500 group-hover:scale-110 transition-transform"></i>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.system.importSettings')}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">Restore from JSON</p>
                    </div>
                  </button>
                </div>
                <p className="text-[7px] text-slate-400 mt-3 font-bold uppercase tracking-widest italic px-1">
                  <i className="fa-solid fa-circle-info mr-1 text-blue-400"></i>
                  {t('settings.system.exportHint')}
                </p>
              </div>
            </section>

            {/* Keyboard Shortcuts — stays in 'system' */}
            {/* Keyboard Shortcuts */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-keyboard text-orange-500"></i> {t('settings.system.shortcuts')} (KEYBOARD SHORTCUTS)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: t('settings.system.shortcutSearch'), keys: '⌘ / Ctrl + K' },
                    { label: t('settings.system.shortcutAiCli'), keys: '⌘ / Ctrl + J' },
                    { label: t('settings.system.shortcutSave'), keys: '⌘ / Ctrl + S' },
                    { label: t('settings.system.shortcutUndo'), keys: '⌘ / Ctrl + Z' },
                    { label: t('settings.system.shortcutRedo'), keys: '⌘ / Ctrl + Shift + Z' },
                    { label: t('settings.system.shortcutScreenshot'), keys: '⌘ / Ctrl + Shift + S' },
                    { label: t('settings.system.shortcutSearchInChat'), keys: '⌘ / Ctrl + F' },
                    { label: t('settings.system.shortcutCloseModal'), keys: 'Escape' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-600">{s.label}</span>
                      <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{s.keys}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[7px] text-slate-400 mt-3 font-bold uppercase tracking-widest italic px-1">
                  <i className="fa-solid fa-circle-info mr-1 text-orange-400"></i>
                  {t('settings.system.shortcutsHint')}
                </p>
              </div>
            </section>
          </>)}

          {settingsTab === 'appearance' && (<>
            {/* Language & Locale */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-globe text-sky-500"></i> {t('settings.appearance.languageLocale')} (LANGUAGE & LOCALE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.appearance.uiLanguage')}</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={() => setUiLanguage('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${uiLanguage === 'zh' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>中文</button>
                      <button onClick={() => setUiLanguage('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${uiLanguage === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.appearance.dateFormat')}</label>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.aiOutputLanguage')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.aiOutputLanguage')}</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['auto', 'zh', 'en'] as const).map(lang => (
                      <button
                        key={lang}
                        onClick={() => setAiOutputLanguage(lang)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiOutputLanguage === lang ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {lang === 'auto' ? t('settings.appearance.autoLanguage') : lang === 'zh' ? '中文' : 'EN'}
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
                <i className="fa-solid fa-pen-nib text-violet-500"></i> {t('settings.research.writingPreferences')} (WRITING PREFERENCES)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.polishIntensity')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.research.polishIntensity')}</p>
                  </div>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['light', 'moderate', 'deep'] as const).map(level => (
                      <button
                        key={level}
                        onClick={() => setAiPolishIntensity(level)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiPolishIntensity === level ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {level === 'light' ? t('settings.research.polishLight') : level === 'moderate' ? t('settings.research.polishModerate') : t('settings.research.polishDeep')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full h-px bg-slate-200"></div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.defaultWritingLang')}</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={() => setDefaultWritingLanguage('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${defaultWritingLanguage === 'zh' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>中文</button>
                      <button onClick={() => setDefaultWritingLanguage('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${defaultWritingLanguage === 'en' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.paragraphIndent')}</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                      <button onClick={() => setParagraphIndent('indent')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${paragraphIndent === 'indent' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t('settings.research.indentFirst')}</button>
                      <button onClick={() => setParagraphIndent('no-indent')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${paragraphIndent === 'no-indent' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t('settings.research.noIndent')}</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Experiment Defaults */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-flask-vial text-rose-500"></i> {t('settings.research.experimentDefaults')} (EXPERIMENT DEFAULTS)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.xrdRadiation')}</label>
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
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.xpsReference')}</label>
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
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.semVoltage')} (kV)</label>
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
                    <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.temVoltage')} (kV)</label>
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
                  {t('settings.research.experimentDefaultsHint')}
                </p>
              </div>
            </section>
          </>)}

          {settingsTab === 'system' && (<>
            {/* Storage Management */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.system.storage')} (STORAGE)</h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <label className="block text-[9px] font-black text-slate-500 uppercase mb-3 px-1">{t('settings.system.localLibraryPath')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                  />
                  <button className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">
                    {t('common.browse')}
                  </button>
                </div>
                <p className="text-[7px] text-slate-400 mt-2 font-bold uppercase tracking-widest italic px-1">{t('settings.system.storageHint')}</p>
              </div>
            </section>

            {/* AI Conversation Management */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <i className="fa-solid fa-comments text-purple-500"></i> {t('settings.system.chatManagement')} (CHAT MANAGEMENT)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.chatRetention')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.chatRetention')}</p>
                  </div>
                  <select
                    className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors"
                    value={chatHistoryRetentionDays}
                    onChange={e => setChatHistoryRetentionDays(Number(e.target.value))}
                  >
                    <option value={7}>{t('settings.system.chatRetention7')}</option>
                    <option value={30}>{t('settings.system.chatRetention30')}</option>
                    <option value={90}>{t('settings.system.chatRetention90')}</option>
                    <option value={365}>{t('settings.system.chatRetentionForever')}</option>
                  </select>
                </div>
                <div className="w-full h-px bg-slate-200"></div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.autoClearChat')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.autoClearChat')}</p>
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
                <i className="fa-solid fa-window-restore text-sky-500"></i> {t('settings.system.windowBehavior')} (WINDOW BEHAVIOR)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.restorePosition')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.restorePosition')}</p>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.rememberLastPage')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.rememberLastPage')}</p>
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
                <i className="fa-solid fa-bolt text-amber-500"></i> {t('settings.system.performance')} (PERFORMANCE)
              </h4>
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.gpuAcceleration')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.gpuAcceleration')}</p>
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
                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.cacheMaxSize')}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.cacheMaxSize')}: {cacheMaxSizeMB} MB</p>
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
                <i className="fa-solid fa-circle-info text-indigo-500"></i> {t('settings.system.aboutUpdate')} (ABOUT & UPDATE)
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
                    <p className="text-[10px] text-slate-500 font-bold">{t('settings.system.updateNotAvailableHint')}</p>
                  )}
                  {updateStatus === 'checking' && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-spinner fa-spin text-indigo-500 text-xs"></i>
                      <p className="text-[10px] text-indigo-600 font-bold">{t('settings.system.checking')}</p>
                    </div>
                  )}
                  {updateStatus === 'not-available' && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                      <p className="text-[10px] text-emerald-600 font-bold">{t('settings.system.latestVersion')}</p>
                    </div>
                  )}
                  {updateStatus === 'available' && (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <i className="fa-solid fa-gift text-amber-500 text-xs"></i>
                        <p className="text-[10px] text-amber-700 font-black">{t('settings.system.newVersionFound', { version: updateVersion })}</p>
                      </div>
                      <p className="text-[9px] text-slate-400">点击下方按钮开始下载更新</p>
                    </div>
                  )}
                  {updateStatus === 'downloading' && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-cloud-arrow-down text-blue-500 text-xs animate-bounce"></i>
                          <p className="text-[10px] text-blue-600 font-bold">{t('settings.system.downloading')}</p>
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
                      <p className="text-[10px] text-violet-700 font-black">{t('settings.system.downloaded')}</p>
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
                    <i className="fa-solid fa-cloud-arrow-down mr-1.5"></i> {t('settings.system.downloadUpdate')} v{updateVersion}
                  </button>
                ) : updateStatus === 'downloaded' ? (
                  <button
                    onClick={handleInstallUpdate}
                    className="w-full py-3 bg-violet-600 rounded-xl text-[10px] font-black text-white uppercase hover:bg-violet-700 transition-all active:scale-95 shadow-sm"
                  >
                    <i className="fa-solid fa-rocket mr-1.5"></i> {t('settings.system.installRestart')}
                  </button>
                ) : updateStatus === 'downloading' ? (
                  <button disabled className="w-full py-3 bg-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase cursor-not-allowed">
                    <i className="fa-solid fa-spinner fa-spin mr-1.5"></i> {t('settings.system.downloading')} {updateProgress}%
                  </button>
                ) : (
                  <button
                    onClick={handleCheckUpdate}
                    disabled={updateStatus === 'checking'}
                    className={`w-full py-3 bg-white border border-indigo-200 rounded-xl text-[10px] font-black text-indigo-700 uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm ${updateStatus === 'checking' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <i className={`fa-solid fa-arrows-rotate mr-1.5 ${updateStatus === 'checking' ? 'fa-spin' : ''}`}></i>
                    {updateStatus === 'checking' ? t('settings.system.checking') : t('settings.system.checkUpdate')}
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
                    <h5 className="text-xs font-black text-rose-900 uppercase">{t('settings.system.dangerZone')} (DANGER ZONE)</h5>
                    <p className="text-[10px] text-rose-700 font-medium leading-relaxed italic">{t('settings.system.dangerZoneDesc')}</p>
                  </div>
                </div>
                <button
                  onClick={handleClearCache}
                  className="px-8 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-200 hover:bg-black transition-all active:scale-95 whitespace-nowrap"
                >
                  {t('settings.system.clearAllCache')}
                </button>
              </div>
            </section>
          </>)}
        </div>

        <footer className="mt-8 shrink-0">
          <button onClick={handleSave} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95">{t('settings.saveButton')}</button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;