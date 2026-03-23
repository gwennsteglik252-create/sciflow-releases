// ═══ useSettingsState.ts — SettingsModal 自定义 Hook ═══
//
// 将 SettingsModal 中 50+ 个 useState 和所有业务逻辑集中到此 Hook，
// 减少组件文件行数并提升可维护性。

import { useState, useEffect, useCallback } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { AIProvider } from '../../types';
import { getLicenseState, activateLicense, LicenseState } from '../../services/licenseService';
import { ProviderConfigState, ConnectionStatus } from './ProviderConfigCard';
import { ModelOption } from '../../config/aiProviders';
import { supabase, isSupabaseConfigured } from '../../services/supabase';

/** 创建响应式设置字段：本地 state + 实时持久化到 appSettings */
function useSettingField<T>(initial: T, persist: (v: T) => void): [T, (v: T) => void] {
    const [value, _setValue] = useState<T>(initial);
    const setValue = (v: T) => { _setValue(v); persist(v); };
    return [value, setValue];
}

export function useSettingsState(show: boolean, onClose: () => void, onOpenConfirm: (config: any) => void) {
    const { appSettings, setAppSettings } = useProjectContext();

    const [localPath, setLocalPath] = useState(appSettings.localLibraryPath);
    const [activeProvider, setActiveProvider] = useState<AIProvider>(appSettings.activeModelProvider || 'auto');
    const [routingPreference, setRoutingPreference] = useState<'cost' | 'quality'>(appSettings.autoRoutingPreference || 'cost');
    const [settingsTab, setSettingsTab] = useState<'ai' | 'appearance' | 'research' | 'data' | 'system'>('ai');

    // ── Provider 配置 ──
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
        setProviderConfigs(prev => ({ ...prev, [providerId]: { ...prev[providerId], ...patch } }));
    }, []);

    const [dynamicModels, setDynamicModels] = useState<Record<string, ModelOption[]>>({});
    const [isRefreshing, setIsRefreshing] = useState<Record<string, boolean>>({});

    // ── 图像生成模型 ──
    const [imageModelName, setImageModelName] = useSettingField(appSettings.imageModelName || 'gemini-2.0-flash-preview-image-generation', v => setAppSettings({ imageModelName: v }));

    // ── UI 交互状态（非持久化） ──
    const [editingShortcut, setEditingShortcut] = useState<string | null>(null);

    // ── 外观设置 ──
    const [themeMode, setThemeMode] = useSettingField<'light' | 'dark' | 'system'>(appSettings.themeMode || 'light', v => setAppSettings({ themeMode: v }));
    const [uiScale, setUiScale] = useSettingField(appSettings.uiScale || 100, v => setAppSettings({ uiScale: v as any }));
    const [editorFontSize, setEditorFontSize] = useSettingField(appSettings.editorFontSize || 14, v => setAppSettings({ editorFontSize: v }));

    // ── 数据/可视化设置 ──
    const [defaultExportFormat, setDefaultExportFormat] = useSettingField<'SVG' | 'PNG' | 'PDF'>(appSettings.defaultExportFormat || 'PNG', v => setAppSettings({ defaultExportFormat: v }));
    const [defaultExportDPI, setDefaultExportDPI] = useSettingField<300 | 600 | 1200>(appSettings.defaultExportDPI || 300, v => setAppSettings({ defaultExportDPI: v }));
    const [defaultChartFont, setDefaultChartFont] = useSettingField(appSettings.defaultChartFont || 'Arial', v => setAppSettings({ defaultChartFont: v }));
    const [defaultColorPalette, setDefaultColorPalette] = useSettingField(appSettings.defaultColorPalette || 'Nature', v => setAppSettings({ defaultColorPalette: v }));

    // ── 网络/AI设置 ──
    const [proxyEnabled, setProxyEnabled] = useSettingField(appSettings.proxyEnabled || false, v => setAppSettings({ proxyEnabled: v }));
    const [proxyUrl, setProxyUrl] = useSettingField(appSettings.proxyUrl || '', v => setAppSettings({ proxyUrl: v }));
    const [aiRequestTimeout, setAiRequestTimeout] = useSettingField(appSettings.aiRequestTimeout || 60, v => setAppSettings({ aiRequestTimeout: v }));
    const [confirmBeforeAISend, setConfirmBeforeAISend] = useSettingField(appSettings.confirmBeforeAISend ?? false, v => setAppSettings({ confirmBeforeAISend: v }));

    // ── 语言/写作设置 ──
    const [uiLanguage, setUiLanguage] = useSettingField<'zh' | 'en'>(appSettings.uiLanguage || 'zh', v => setAppSettings({ uiLanguage: v }));
    const [dateFormat, setDateFormat] = useSettingField(appSettings.dateFormat || 'YYYY-MM-DD', v => setAppSettings({ dateFormat: v as any }));
    const [aiOutputLanguage, setAiOutputLanguage] = useSettingField<'zh' | 'en' | 'auto'>(appSettings.aiOutputLanguage || 'auto', v => setAppSettings({ aiOutputLanguage: v }));
    const [aiPolishIntensity, setAiPolishIntensity] = useSettingField<'light' | 'moderate' | 'deep'>(appSettings.aiPolishIntensity || 'moderate', v => setAppSettings({ aiPolishIntensity: v }));
    const [defaultWritingLanguage, setDefaultWritingLanguage] = useSettingField<'zh' | 'en'>(appSettings.defaultWritingLanguage || 'zh', v => setAppSettings({ defaultWritingLanguage: v }));
    const [paragraphIndent, setParagraphIndent] = useSettingField<'indent' | 'no-indent'>(appSettings.paragraphIndent || 'indent', v => setAppSettings({ paragraphIndent: v }));

    // ── 表征默认参数 ──
    const [defaultXrdRadiation, setDefaultXrdRadiation] = useSettingField(appSettings.defaultXrdRadiation || 'Cu Kα', v => setAppSettings({ defaultXrdRadiation: v as any }));
    const [defaultXpsReference, setDefaultXpsReference] = useSettingField(appSettings.defaultXpsReference || 'C 1s 284.8 eV', v => setAppSettings({ defaultXpsReference: v }));
    const [defaultSemVoltage, setDefaultSemVoltage] = useSettingField(appSettings.defaultSemVoltage || 15, v => setAppSettings({ defaultSemVoltage: v }));
    const [defaultTemVoltage, setDefaultTemVoltage] = useSettingField(appSettings.defaultTemVoltage || 200, v => setAppSettings({ defaultTemVoltage: v }));

    // ── 系统行为设置 ──
    const [chatHistoryRetentionDays, setChatHistoryRetentionDays] = useSettingField(appSettings.chatHistoryRetentionDays || 30, v => setAppSettings({ chatHistoryRetentionDays: v }));
    const [autoClearChat, setAutoClearChat] = useSettingField(appSettings.autoClearChat ?? false, v => setAppSettings({ autoClearChat: v }));
    const [restoreWindowPosition, setRestoreWindowPosition] = useSettingField(appSettings.restoreWindowPosition ?? true, v => setAppSettings({ restoreWindowPosition: v }));
    const [rememberLastPage, setRememberLastPage] = useSettingField(appSettings.rememberLastPage ?? true, v => setAppSettings({ rememberLastPage: v }));
    const [gpuAcceleration, setGpuAcceleration] = useSettingField(appSettings.gpuAcceleration ?? true, v => setAppSettings({ gpuAcceleration: v }));
    const [cacheMaxSizeMB, setCacheMaxSizeMB] = useSettingField(appSettings.cacheMaxSizeMB || 512, v => setAppSettings({ cacheMaxSizeMB: v }));

    // ── AI 引擎扩展 ──
    const [aiTemperature, setAiTemperature] = useSettingField(appSettings.aiTemperature ?? 0.7, v => setAppSettings({ aiTemperature: v }));
    const [aiMaxTokens, setAiMaxTokens] = useSettingField(appSettings.aiMaxTokens || 4096, v => setAppSettings({ aiMaxTokens: v }));
    const [aiContextLength, setAiContextLength] = useSettingField(appSettings.aiContextLength || 10, v => setAppSettings({ aiContextLength: v }));

    // ── 数据图表扩展 ──
    const [defaultChartWidth, setDefaultChartWidth] = useSettingField(appSettings.defaultChartWidth || 800, v => setAppSettings({ defaultChartWidth: v }));
    const [defaultChartHeight, setDefaultChartHeight] = useSettingField(appSettings.defaultChartHeight || 600, v => setAppSettings({ defaultChartHeight: v }));
    const [chartAnimation, setChartAnimation] = useSettingField(appSettings.chartAnimation ?? true, v => setAppSettings({ chartAnimation: v }));

    // ── 科研扩展 ──
    const [defaultLiteratureSort, setDefaultLiteratureSort] = useSettingField<'year' | 'author' | 'addedDate' | 'citations'>(appSettings.defaultLiteratureSort || 'addedDate', v => setAppSettings({ defaultLiteratureSort: v }));
    const [defaultExperimentTemplate, setDefaultExperimentTemplate] = useSettingField<'blank' | 'electrochemistry' | 'catalysis' | 'synthesis' | 'characterization'>(appSettings.defaultExperimentTemplate || 'blank', v => setAppSettings({ defaultExperimentTemplate: v }));
    const [spellCheck, setSpellCheck] = useSettingField(appSettings.spellCheck ?? true, v => setAppSettings({ spellCheck: v }));

    // ── 系统扩展 ──
    const [startupPage, setStartupPage] = useSettingField<'dashboard' | 'lastProject' | 'blank'>(appSettings.startupPage || 'dashboard', v => setAppSettings({ startupPage: v }));
    const [soundFeedback, setSoundFeedback] = useSettingField(appSettings.soundFeedback ?? false, v => setAppSettings({ soundFeedback: v }));

    // ── AI 引擎扩展 (Batch 2) ──
    const [aiStreamOutput, setAiStreamOutput] = useSettingField(appSettings.aiStreamOutput ?? true, v => setAppSettings({ aiStreamOutput: v }));
    const [aiDefaultPersona, setAiDefaultPersona] = useSettingField<'rigorous' | 'creative' | 'balanced'>(appSettings.aiDefaultPersona || 'balanced', v => setAppSettings({ aiDefaultPersona: v }));
    const [debateRounds, setDebateRounds] = useSettingField(appSettings.debateRounds || 5, v => setAppSettings({ debateRounds: v }));
    const [aiSpeedMode, setAiSpeedMode] = useSettingField<'fast' | 'balanced' | 'quality'>(appSettings.aiSpeedMode || 'balanced', v => setAppSettings({ aiSpeedMode: v }));

    // ── 系统扩展 (Batch 2) ──
    const [autoBackupInterval, setAutoBackupInterval] = useSettingField(appSettings.autoBackupInterval || 0, v => setAppSettings({ autoBackupInterval: v }));
    const [defaultTablePageSize, setDefaultTablePageSize] = useSettingField(appSettings.defaultTablePageSize || 25, v => setAppSettings({ defaultTablePageSize: v }));
    const [customShortcuts, setCustomShortcuts] = useSettingField<Record<string, string>>(appSettings.customShortcuts || {}, v => setAppSettings({ customShortcuts: v }));

    // ── 云同步状态 ──
    const [cloudUser, setCloudUser] = useState<{ email: string; id: string } | null>(null);
    const [cloudStatus, setCloudStatus] = useState<'unconfigured' | 'logged-out' | 'logged-in' | 'syncing' | 'error'>('unconfigured');
    const [cloudLoginEmail, setCloudLoginEmail] = useState('');
    const [cloudLoginPassword, setCloudLoginPassword] = useState('');
    const [cloudLoginLoading, setCloudLoginLoading] = useState(false);
    const [cloudLoginError, setCloudLoginError] = useState('');

    // ── 更新状态 ──
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
    const [updateVersion, setUpdateVersion] = useState('');
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateError, setUpdateError] = useState('');
    const [appVersion, setAppVersion] = useState('1.0.0');

    // ── 授权状态 ──
    const [licenseState, setLicenseState] = useState<LicenseState | null>(null);
    const [licenseCode, setLicenseCode] = useState('');
    const [licenseLoading, setLicenseLoading] = useState(false);
    const [licenseError, setLicenseError] = useState('');
    const [licenseSuccess, setLicenseSuccess] = useState(false);

    // ── API Key 缓存 ──
    const [apiKeyCache, setApiKeyCache] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('sciflow_api_key_cache');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });

    // ═══ Effects ═══

    useEffect(() => {
        if (show) { getLicenseState().then(setLicenseState); }
    }, [show]);

    useEffect(() => {
        const electron = (window as any).electron;
        if (!electron?.onUpdateStatus) return;
        if (electron.getAppVersion) {
            electron.getAppVersion().then((v: string) => v && setAppVersion(v));
        }
        const unsubscribe = electron.onUpdateStatus((data: any) => {
            switch (data.status) {
                case 'checking': setUpdateStatus('checking'); break;
                case 'available': setUpdateStatus('available'); setUpdateVersion(data.version || ''); break;
                case 'not-available': setUpdateStatus('not-available'); break;
                case 'downloading': setUpdateStatus('downloading'); setUpdateProgress(Math.round(data.percent || 0)); break;
                case 'downloaded': setUpdateStatus('downloaded'); setUpdateVersion(data.version || ''); break;
                case 'error': setUpdateStatus('error'); setUpdateError(data.message || '未知错误'); break;
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (appSettings.openaiConfig?.baseUrl && appSettings.openaiConfig?.apiKey) {
            setApiKeyCache(prev => {
                const next = { ...prev, [appSettings.openaiConfig!.baseUrl!]: appSettings.openaiConfig!.apiKey };
                localStorage.setItem('sciflow_api_key_cache', JSON.stringify(next));
                return next;
            });
        }
    }, []);

    // ═══ Handlers ═══

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
        if (electron?.downloadUpdate) {
            await electron.downloadUpdate();
        } else {
            window.open('https://github.com/gwennsteglik252-create/sciflow-releases/releases/latest', '_blank');
        }
    };

    const handleInstallUpdate = () => {
        const electron = (window as any).electron;
        if (electron?.installUpdate) {
            electron.installUpdate();
        } else {
            window.open('https://github.com/gwennsteglik252-create/sciflow-releases/releases/latest', '_blank');
        }
    };

    const handleClearCache = () => {
        onOpenConfirm({
            show: true,
            title: '清空所有本地数据？',
            desc: '此操作将抹除所有本地存储的课题、文献、对话历史和配置项。该操作不可逆，请确保已备份重要数据。',
            onConfirm: () => { localStorage.clear(); window.location.reload(); }
        });
    };

    // 修复双重写入：useSettingField 已即时持久化，handleSave 只处理 provider configs
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
            } catch { alert('导入失败：文件格式无效。'); }
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
            const headers: Record<string, string> = { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
            let responseData: any;
            if (window.electron?.httpRequest) {
                const resp = await window.electron.httpRequest({ url, method: 'GET', headers });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                responseData = JSON.parse(resp.body);
            } else {
                const response = await fetch(url, { headers });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                responseData = await response.json();
            }
            const models = responseData.data.filter((m: any) => m.id).map((m: any) => ({ label: m.id, value: m.id }));
            if (models.length > 0) {
                setDynamicModels(prev => ({ ...prev, [cfg.baseUrl]: models }));
                alert(`成功获取 ${models.length} 个模型！`);
            } else { alert("未发现可用模型。"); }
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
            alert("API Key 选择功能仅在 AI Studio 环境中可用。");
        }
    };

    // ═══ 云同步 handlers ═══
    const handleCloudLogin = useCallback(async () => {
        if (!isSupabaseConfigured() || !supabase) return;
        setCloudLoginLoading(true);
        setCloudLoginError('');
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: cloudLoginEmail,
                password: cloudLoginPassword,
            });
            if (error) throw error;
            if (data.user) {
                setCloudUser({ email: data.user.email || '', id: data.user.id });
                setCloudStatus('logged-in');
                setCloudLoginPassword('');
            }
        } catch (err: any) {
            setCloudLoginError(err.message || '登录失败');
        } finally {
            setCloudLoginLoading(false);
        }
    }, [cloudLoginEmail, cloudLoginPassword]);

    const handleCloudLogout = useCallback(async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setCloudUser(null);
        setCloudStatus('logged-out');
    }, []);

    const handleCloudSyncNow = useCallback(async () => {
        if (!supabase || !cloudUser) return;
        setCloudStatus('syncing');
        try {
            // 触发一次全量同步（由外层 ProjectContext 处理）
            // 这里设置状态，实际同步逻辑在 ProjectContext 里
            await new Promise(r => setTimeout(r, 1500));
            setCloudStatus('logged-in');
        } catch {
            setCloudStatus('error');
        }
    }, [cloudUser]);

    // 初始化云同步状态
    useEffect(() => {
        if (!isSupabaseConfigured() || !supabase) {
            setCloudStatus('unconfigured');
            return;
        }
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setCloudUser({ email: session.user.email || '', id: session.user.id });
                setCloudStatus('logged-in');
            } else {
                setCloudStatus('logged-out');
            }
        });
    }, [show]);

    // ═══ 浏览文件夹 ═══
    const handleBrowseLocalPath = useCallback(async () => {
        if (window.electron?.selectDirectory) {
            const dir = await window.electron.selectDirectory();
            if (dir) setLocalPath(dir);
        }
    }, []);

    // ═══ 分组返回 ═══
    return {
        tab: { settingsTab, setSettingsTab },
        context: { appSettings, setAppSettings },
        ai: {
            activeProvider, setActiveProvider, routingPreference, setRoutingPreference,
            imageModelName, setImageModelName,
            aiTemperature, setAiTemperature, aiMaxTokens, setAiMaxTokens, aiContextLength, setAiContextLength,
            aiStreamOutput, setAiStreamOutput, aiDefaultPersona, setAiDefaultPersona, debateRounds, setDebateRounds,
            aiSpeedMode, setAiSpeedMode,
        },
        providers: {
            providerConfigs, updateProviderConfig, dynamicModels, isRefreshing,
            apiKeyCache, handleApiKeyCacheUpdate, handleSelectApiKey, handleRefreshModelsForProvider,
        },
        appearance: {
            themeMode, setThemeMode, uiScale, setUiScale, editorFontSize, setEditorFontSize,
            uiLanguage, setUiLanguage, dateFormat, setDateFormat,
            aiOutputLanguage, setAiOutputLanguage, soundFeedback, setSoundFeedback,
        },
        research: {
            aiPolishIntensity, setAiPolishIntensity,
            defaultWritingLanguage, setDefaultWritingLanguage, paragraphIndent, setParagraphIndent,
            defaultXrdRadiation, setDefaultXrdRadiation, defaultXpsReference, setDefaultXpsReference,
            defaultSemVoltage, setDefaultSemVoltage, defaultTemVoltage, setDefaultTemVoltage,
            defaultLiteratureSort, setDefaultLiteratureSort, defaultExperimentTemplate, setDefaultExperimentTemplate,
            spellCheck, setSpellCheck,
        },
        data: {
            defaultExportFormat, setDefaultExportFormat, defaultExportDPI, setDefaultExportDPI,
            defaultChartFont, setDefaultChartFont, defaultColorPalette, setDefaultColorPalette,
            defaultChartWidth, setDefaultChartWidth, defaultChartHeight, setDefaultChartHeight,
            chartAnimation, setChartAnimation,
        },
        system: {
            localPath, setLocalPath,
            startupPage, setStartupPage,
            chatHistoryRetentionDays, setChatHistoryRetentionDays, autoClearChat, setAutoClearChat,
            restoreWindowPosition, setRestoreWindowPosition, rememberLastPage, setRememberLastPage,
            gpuAcceleration, setGpuAcceleration, cacheMaxSizeMB, setCacheMaxSizeMB,
            autoBackupInterval, setAutoBackupInterval, defaultTablePageSize, setDefaultTablePageSize,
            customShortcuts, setCustomShortcuts, editingShortcut, setEditingShortcut,
        },
        network: {
            proxyEnabled, setProxyEnabled, proxyUrl, setProxyUrl,
            aiRequestTimeout, setAiRequestTimeout, confirmBeforeAISend, setConfirmBeforeAISend,
        },
        license: {
            licenseState, licenseCode, setLicenseCode, licenseLoading,
            licenseError, setLicenseError, licenseSuccess, setLicenseSuccess,
            handleActivateLicense,
        },
        update: {
            updateStatus, updateVersion, updateProgress, updateError, appVersion,
            handleCheckUpdate, handleDownloadUpdate, handleInstallUpdate,
        },
        cloud: {
            cloudUser, cloudStatus, cloudLoginEmail, setCloudLoginEmail,
            cloudLoginPassword, setCloudLoginPassword, cloudLoginLoading, cloudLoginError,
            handleCloudLogin, handleCloudLogout, handleCloudSyncNow,
        },
        actions: { handleSave, handleClearCache, handleExportSettings, handleImportSettings, handleBrowseLocalPath },
    };
}

export type SettingsState = ReturnType<typeof useSettingsState>;
