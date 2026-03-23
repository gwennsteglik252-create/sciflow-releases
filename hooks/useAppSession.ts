
import { useState, useEffect, useCallback } from 'react';
import { UserProfile, AppTheme, AppSettings, ToastConfig, AiTask, AiCliCommand } from '../types';
import { APP_THEMES } from '../constants';
import { SafeModalConfig } from '../components/SafeModal';

export const useAppSession = () => {
  const [activeTasks, setActiveTasks] = useState<AiTask[]>([]);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [citationBuffer, setCitationBuffer] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastConfig | null>(null);

  // AI Command CLI States
  const [isAiCliOpen, setIsAiCliOpen] = useState(false);
  const [aiCliHistory, setAiCliHistory] = useState<AiCliCommand[]>([]);

  // States for deep linking into inventory editor
  const [pendingEditInventoryId, setPendingEditInventoryId] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string | null>(null);

  const [modals, setModals] = useState({
    addProject: false,
    account: false,
    settings: false,
    confirm: null as SafeModalConfig | null
  });

  const [activeTheme, setActiveTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('sciflow_theme');
    return saved ? JSON.parse(saved) : APP_THEMES[0];
  });

  const [appSettings, setInternalAppSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('sciflow_app_settings');
    const parsed = saved ? JSON.parse(saved) : {};

    // Ensure defaults for new fields
    return {
      aiAutoDiagnose: true,
      aiRealtimePolish: true,
      localLibraryPath: 'C:\\Users\\Scientific\\Documents\\SciFlow_Library',
      latexStyle: 'serif',
      sidebarMode: 'expanded',
      defaultCitationStyle: 'Nature',
      enableNotifications: true,
      autoSaveInterval: 5,
      activeModelProvider: 'gemini',
      openaiConfig: { apiKey: '', baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o' },
      anthropicConfig: { apiKey: '', modelName: 'claude-3-5-sonnet-20240620' },
      doubaoConfig: { apiKey: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', modelName: '' },
      ...parsed
    };
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('sciflow_user_profile_v2');
    return saved ? JSON.parse(saved) : {
      name: 'Dr.Luo',
      role: '高级研究员',
      id: 'SF-2024-8821',
      department: '新能源材料研发部',
      projectGroup: '气相催化组',
      securityLevel: '秘密',
      institution: 'SciFlow 前沿能源实验室',
      researchArea: '电化学催化 / AEM 电解池技术',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Luo`
    };
  });

  const setModalOpen = useCallback((key: string, value: any) => {
    setModals(prev => ({ ...prev, [key]: value }));
  }, []);

  const setAppSettingsWithCallback = useCallback((updates: Partial<AppSettings>) => {
    setInternalAppSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('sciflow_app_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('sciflow_user_profile_v2', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsKeySelected(hasKey);
      } else {
        setIsKeySelected(true);
      }
    };
    checkKey();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return {
    activeTasks, setActiveTasks,
    aiStatus, setAiStatus,
    isOnline, isKeySelected, setIsKeySelected,
    searchQuery, setSearchQuery,
    citationBuffer, setCitationBuffer,
    toast, setToast,
    isAiCliOpen, setIsAiCliOpen,
    aiCliHistory, setAiCliHistory,
    modals, setModalOpen,
    activeTheme, setActiveTheme,
    appSettings, setAppSettingsWithCallback,
    userProfile, setUserProfile,
    // Returned state for context integration
    pendingEditInventoryId, setPendingEditInventoryId,
    returnPath, setReturnPath
  };
};
