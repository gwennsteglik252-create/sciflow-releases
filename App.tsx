
import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView } from './types';
import { APP_THEMES } from './constants';
import { ProjectProvider } from './context/ProjectContext';
import { useProjectContext } from './context/ProjectContextCore';
import { useUIContext } from './context/UIContext';
import AppRouter from './components/AppRouter';
import ModalManager from './components/Modals/ModalManager';
import AiAssistantStatus from './components/Layout/AiAssistantStatus';
import GlobalSearchOverlay from './components/Layout/GlobalSearchOverlay';
import Sidebar from './components/Layout/Sidebar';
import { useAppLogic } from './hooks/useAppLogic';
import { VoiceLabCompanion } from './components/Layout/VoiceLabCompanion';
import QuickNavigation from './components/Layout/QuickNavigation';
import ErrorBoundary from './components/Common/ErrorBoundary';
import AiCommandCli from './components/Layout/AiCommandCli';
import AlmanacPanel from './components/Project/WeeklyPlan/AlmanacPanel';
import { useScreenshot } from './hooks/useScreenshot';
import { useInviteNotifications } from './hooks/useInviteNotifications';
import AuthGate from './components/Auth/AuthGate';
import ApiSetupGuideModal from './components/Modals/ApiSetupGuideModal';
import LicenseGate from './components/Auth/LicenseGate';

const AppContent: React.FC = () => {
  const { isOnline, userProfile, appSettings, setAppSettings, projects, mechanismSession, navigate, cloudSync } = useProjectContext();
  const { aiStatus, toast, hideToast, showToast, setSearchQuery, isAiCliOpen, setIsAiCliOpen, isVoiceMode, setIsVoiceMode } = useUIContext();
  const { route, confirmDelete, modals, setModalOpen, activeTheme, setActiveTheme, history, dwellProgress, togglePin } = useAppLogic();
  const [showGlobalAlmanac, setShowGlobalAlmanac] = React.useState(false);
  const [showInvitePanel, setShowInvitePanel] = React.useState(false);
  const [showApiGuide, setShowApiGuide] = React.useState(false);
  const { flashVisible } = useScreenshot({ showToast });
  const inviteNotifs = useInviteNotifications();

  // 监听 AI 服务「未配置 API Key」事件
  React.useEffect(() => {
    const handler = () => setShowApiGuide(true);
    window.addEventListener('sciflow_no_api_key', handler);
    return () => window.removeEventListener('sciflow_no_api_key', handler);
  }, []);

  // ═══ 弹出窗口模式检测 ═══
  const popoutView = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('popout');
  }, []);

  // 弹出窗口时自动设置 hash 到对应视图
  React.useEffect(() => {
    if (popoutView) {
      window.location.hash = popoutView;
    }
  }, [popoutView]);

  // 模块名称映射
  const moduleLabels: Record<string, string> = {
    dashboard: '研究看板', projects: '课题中心', team: '团队矩阵',
    research_brain: '中心大脑', inception: '战略立项', industry_trends: '行业动态',
    characterization_hub: '实验表征', literature: '情报档案', mechanism: '机理推演',
    inventory: '库存管理', doe: 'DOE 迭代', flowchart: '实验路线',
    data: '数据分析', figure_center: '科研绘图', video_lab: '视频工坊',
    writing: '写作工坊', assistant: '科研助理',
  };

  // ═══ 弹出窗口模式渲染 ═══
  if (popoutView) {
    const isLightMode = activeTheme.type === 'light';
    return (
      <div id="app-root" className={`flex flex-col h-screen overflow-hidden ${isLightMode ? 'theme-light' : 'theme-dark'}`} style={{ backgroundColor: activeTheme.colors.background }}>
        {/* 弹出窗口标题栏 - 可拖拽 */}
        <div
          className={`h-10 flex items-center px-4 shrink-0 border-b select-none ${isLightMode ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-white/10'}`}
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          {/* macOS 窗口控制按钮区域留白 */}
          <div className="w-16 shrink-0" />
          <div className="flex items-center gap-2 flex-1 justify-center">
            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse" />
            <span className={`text-[11px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
              {moduleLabels[popoutView] || popoutView}
            </span>
            <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${isLightMode ? 'bg-indigo-50 text-indigo-500' : 'bg-indigo-500/20 text-indigo-300'}`}>
              独立窗口
            </span>
          </div>
          <div className="w-16 shrink-0" />
        </div>

        {/* 模块内容区 */}
        <main className="flex-1 h-full min-h-0 p-2 md:p-4 transition-colors duration-500 min-w-0 overflow-hidden relative" style={{ backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0, transparent 40%)' }}>
          <div className="h-full min-h-0 flex flex-col overflow-hidden">
            <AppRouter route={route} navigate={navigate} openAddProject={() => setModalOpen('addProject', true)} confirmDelete={confirmDelete} />
          </div>
        </main>

        {/* Toast 通知 */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[9999] animate-reveal">
            <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${toast.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' :
              toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
                'bg-slate-800/90 border-slate-700 text-white'
              }`}>
              <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-xmark' :
                toast.type === 'success' ? 'fa-circle-check' :
                  'fa-circle-info'
                }`}></i>
              <span className="text-xs font-bold">{toast.message}</span>
              <button onClick={hideToast} className="ml-1 opacity-70 hover:opacity-100"><i className="fa-solid fa-xmark"></i></button>
            </div>
          </div>
        )}
        <ModalManager modals={modals} closeModal={(key) => setModalOpen(key, key === 'confirm' ? null : false)} onOpenConfirm={(config) => setModalOpen('confirm', config)} />
      </div>
    );
  }

  // ═══ 正常主窗口渲染（以下为原有代码） ═══
  // 只取本周或当前有效计划（endDate >= 今天）的任务，不依赖 status 字段
  const globalAlmanacTasks = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return projects.flatMap(p =>
      (p.weeklyPlans ?? [])
        .filter(pl => !pl.endDate || pl.endDate >= todayStr)
        .flatMap(pl => pl.tasks ?? [])
    );
  }, [projects]);

  const isCollapsed = appSettings.sidebarMode === 'collapsed';
  const isLightMode = activeTheme.type === 'light';

  useEffect(() => {
    const handleAltQ = (e: KeyboardEvent) => {
      // Alt+Q: 切换快速导航面板
      if (e.altKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-quick-nav'));
      }
      // Alt+Backspace: 快速返回最近访问的第一个历史页面
      if (e.altKey && e.key === 'Backspace') {
        e.preventDefault();
        if (history && history.length > 1) {
          window.location.hash = history[1].path.replace('#', '');
        }
      }
    };
    window.addEventListener('keydown', handleAltQ);
    return () => window.removeEventListener('keydown', handleAltQ);
  }, [history]);

  const activeDoeRuns = useMemo(() => {
    return projects.reduce((acc, p) => {
      return acc + (p.milestones?.reduce((mAcc, m) => {
        return mAcc + (m.experimentalPlan?.filter(plan => plan.status === 'executing').length || 0);
      }, 0) || 0);
    }, 0);
  }, [projects]);

  const toggleTheme = () => {
    if (activeTheme.type === 'dark') {
      setActiveTheme(APP_THEMES.find(t => t.id === 'clean_light') || APP_THEMES[0]);
    } else {
      setActiveTheme(APP_THEMES.find(t => t.id === 'cyber_blue') || APP_THEMES[1]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+J (Mac) or Ctrl+J (Win)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAiCliOpen(!isAiCliOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiCliOpen, setIsAiCliOpen]);

  return (
    <div id="app-root" className={`flex h-screen overflow-hidden relative ${isLightMode ? 'theme-light' : 'theme-dark'}`} style={{ backgroundColor: activeTheme.colors.background }}>
      {/* Screenshot flash overlay */}
      {flashVisible && <div id="screenshot-flash-overlay" className="fixed inset-0 bg-white z-[99999] pointer-events-none animate-[screenshotFlash_0.3s_ease-out_forwards]" />}

      {!isOnline && <div className="absolute top-0 left-0 right-0 h-6 bg-amber-500 text-white text-[9px] font-black uppercase flex items-center justify-center tracking-widest z-[9999]">离线模式：部分功能受限</div>}

      <aside className={`${isCollapsed ? 'w-20' : 'w-20 lg:w-56'} backdrop-blur-3xl border-r flex flex-col z-50 no-print shadow-2xl transition-all duration-300 ${activeTheme.colors.sidebar} ${activeTheme.colors.sidebarBorder}`}>

        {/* --- BRAND HEADER START --- */}
        <div className={`p-4 flex items-center gap-4 shrink-0 ${isCollapsed ? 'justify-center' : ''} transition-all duration-300 relative`}>
          {/* Custom App Icon - "The Quantum Drop" */}
          <div
            className="w-12 h-12 rounded-[14px] shrink-0 shadow-[0_10px_20px_-5px_rgba(79,70,229,0.5)] relative overflow-hidden group cursor-pointer bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#db2777] flex items-center justify-center hover:scale-105 transition-transform duration-300 ring-2 ring-white/20"
            onClick={() => navigate('dashboard')}
            title="SciFlow Pro Home"
          >
            {/* Internal Glass Shine */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/30 to-transparent opacity-100 pointer-events-none z-10"></div>

            {/* Icon Glyph */}
            <svg viewBox="0 0 100 100" className="w-8 h-8 text-white z-20 drop-shadow-md animate-[spin_20s_linear_infinite]" style={{ animationDuration: '20s' }}>
              <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.3" />
              <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="5" transform="rotate(45 50 50)" />
              <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="5" transform="rotate(-45 50 50)" />
              <circle cx="50" cy="50" r="8" fill="currentColor" className="animate-pulse" />
            </svg>
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0 flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight italic leading-none whitespace-nowrap">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-600 to-rose-500 filter drop-shadow-sm select-none">SciFlow</span>
                </h1>
                <button
                  onClick={toggleTheme}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${isLightMode ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-white/10 text-indigo-300 hover:bg-white/20'}`}
                >
                  <i className={`fa-solid ${isLightMode ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-2 pl-0.5 group/brand cursor-default">
                {/* Custom Designed Name Logo: LXJ */}
                <div className="flex items-baseline relative top-[1px]">
                  <span className={`text-sm font-black tracking-tight ${!isLightMode ? 'text-slate-400' : 'text-slate-700'}`}>L</span>
                  <span className="text-lg font-black italic text-transparent bg-clip-text bg-gradient-to-tr from-indigo-600 to-purple-500 -ml-0.5 -mr-0.5 z-10 relative" style={{ fontFamily: 'Georgia, serif' }}>X</span>
                  <span className={`text-sm font-black tracking-tight ${!isLightMode ? 'text-slate-400' : 'text-slate-700'}`}>J</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mb-0.5 ml-0.5 animate-pulse shadow-sm"></div>
                </div>

                {/* 科研农场入口 */}
                <button
                  onClick={() => navigate('research_farm')}
                  className={`group/farm relative w-6 h-6 rounded-full flex items-center justify-center ml-0.5 transition-all active:scale-90 hover:scale-110 ${isLightMode ? 'hover:bg-emerald-50' : 'hover:bg-emerald-500/10'}`}
                  title="科研农场"
                >
                  <svg viewBox="0 0 100 100" className="w-4 h-4 animate-[spin_10s_linear_infinite]">
                    <defs>
                      <linearGradient id="farm-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#farm-grad)" strokeWidth="4" opacity="0.8" />
                    <path d="M50 20 Q70 35 50 55 Q30 35 50 20Z" fill="#22c55e" opacity="0.9" />
                    <path d="M50 55 Q65 50 75 65 Q55 65 50 55Z" fill="#16a34a" opacity="0.8" />
                    <path d="M50 55 Q35 50 25 65 Q45 65 50 55Z" fill="#059669" opacity="0.7" />
                    <line x1="50" y1="55" x2="50" y2="80" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="50" cy="82" r="4" fill="#15803d" className="animate-pulse" />
                  </svg>
                  <div className="absolute inset-[-2px] rounded-full bg-emerald-400/20 blur-[3px] animate-pulse pointer-events-none" />
                </button>

                {/* 科研黄历入口 */}
                <div className="h-4 w-px bg-slate-200 mx-1"></div>
                <button
                  onClick={() => setShowGlobalAlmanac(prev => !prev)}
                  className={`group/almanac relative w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90 hover:scale-110 ${isLightMode ? 'hover:bg-amber-50' : 'hover:bg-amber-500/10'}`}
                  title="今日科研黄历"
                >
                  <svg viewBox="0 0 100 100" className="w-4 h-4 animate-[spin_8s_linear_infinite]">
                    <defs>
                      <linearGradient id="almanac-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#dc2626" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="46" fill="none" stroke="url(#almanac-grad)" strokeWidth="4" opacity="0.8" />
                    <path d="M50 4 A46 46 0 0 1 50 96 A23 23 0 0 1 50 50 A23 23 0 0 0 50 4" fill="#d97706" />
                    <path d="M50 96 A46 46 0 0 1 50 4 A23 23 0 0 0 50 50 A23 23 0 0 1 50 96" fill="#1e293b" />
                    <circle cx="50" cy="27" r="6" fill="#1e293b" />
                    <circle cx="50" cy="73" r="6" fill="#d97706" />
                  </svg>
                  <div className="absolute inset-[-2px] rounded-full bg-amber-400/20 blur-[3px] animate-pulse pointer-events-none" />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* --- BRAND HEADER END --- */}

        {!isCollapsed && (
          <div className="px-3 mb-2 shrink-0 flex flex-col gap-2">
            <div
              onClick={() => { setAppSettings({ sidebarMode: 'expanded' }); setSearchQuery(' '); }}
              className={`flex-1 border rounded-xl p-2 flex items-center gap-3 cursor-pointer transition-all shadow-inner group ${isLightMode ? 'bg-slate-100 border-slate-200 hover:bg-slate-200' : 'bg-black/20 border-white/5 hover:bg-black/30'}`}
            >
              <i className={`fa-solid fa-magnifying-glass text-sm group-hover:text-indigo-400 ${isLightMode ? 'text-slate-400' : 'text-slate-50'}`}></i>
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest hidden lg:block">搜索图谱</span>
            </div>
          </div>
        )}

        <Sidebar
          activeView={route.view}
          navigate={navigate}
          isLightMode={isLightMode}
          isCollapsed={isCollapsed}
          doeBadge={activeDoeRuns}
          mechanismBadge={mechanismSession.isProcessing ? 1 : 0}
          hasProjects={projects && projects.length > 0}
          firstProjectId={projects?.[0]?.id}
          isVoiceMode={isVoiceMode}
          setIsVoiceMode={setIsVoiceMode}
        />

        <div className="px-2 shrink-0 pb-1">
          <div className={`my-2 border-t mx-2 h-[1px] ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}></div>

          <button
            onClick={() => navigate('assistant')}
            className={`w-full flex items-center justify-center gap-2 px-2 lg:px-3 py-2 rounded-2xl transition-all duration-300 font-black text-[12px] uppercase group relative ${isCollapsed ? '' : 'lg:justify-start'}
              ${route.view === 'assistant'
                ? 'bg-indigo-600 text-white shadow-xl opacity-100'
                : isLightMode
                  ? 'text-slate-600 hover:text-slate-800 hover:bg-slate-100 hover:scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 hover:scale-[1.02]'
              }`}
          >
            <i className={`fa-solid fa-user-tie text-base w-6 text-center ${route.view === 'assistant' ? 'text-white' : 'text-purple-400'}`}></i>
            {!isCollapsed && <span className="hidden lg:block truncate">科研助理</span>}
          </button>
        </div>

        <div className={`p-2 lg:p-3 border-t shrink-0 ${activeTheme.colors.sidebarBorder}`}>
          {!isCollapsed && <AiAssistantStatus message={aiStatus} />}
          <div className="flex flex-col gap-2">
            <div
              onClick={() => { setAppSettings({ sidebarMode: 'expanded' }); setModalOpen('account', true); }}
              className={`flex items-center justify-center gap-3 p-2 lg:p-3 rounded-2xl border cursor-pointer active:scale-95 group/avatar relative ${isCollapsed ? '' : 'lg:justify-start'} ${isLightMode ? 'bg-slate-50 border-slate-200 hover:border-indigo-200 shadow-sm' : 'bg-white/5 border-white/10 hover:bg-white/10 shadow-lg'}`}
            >
              <div className="relative shrink-0">
                <img src={userProfile.avatar} className="w-10 h-10 lg:w-11 lg:h-11 rounded-full border-2 border-indigo-500/50" alt="avatar" />
                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-lg ${userProfile.securityLevel === '公开' ? 'bg-slate-400' : 'bg-emerald-500'}`}><i className="fa-solid fa-shield-halved text-[6px] text-white"></i></div>
              </div>
              {!isCollapsed && <div className="hidden lg:block truncate flex-1"><div className={`text-[12px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{userProfile.name}</div><div className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 mt-0.5 ${userProfile.securityLevel === '绝密' ? 'text-rose-400' : 'text-emerald-400'}`}><span className={`w-1 h-1 rounded-full animate-pulse ${userProfile.securityLevel === '绝密' ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>{userProfile.securityLevel}</div></div>}
            </div>
          </div>
        </div>

        <div className={`py-4 border-t flex flex-nowrap items-center justify-center gap-1.5 shrink-0 ${isLightMode ? 'border-slate-200' : 'border-white/10'} ${isCollapsed ? 'px-1' : 'px-2'}`}>
          <button
            onClick={() => { setAppSettings({ sidebarMode: 'expanded' }); setModalOpen('settings', true); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-95 shadow-md shrink-0 ${isLightMode
              ? 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:bg-cyan-600 hover:text-white'
              : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500 hover:text-white'}`}
            title="系统设置"
          >
            <i className="fa-solid fa-cog text-[10px]"></i>
          </button>

          <QuickNavigation
            history={history || []}
            isLightMode={isLightMode}
            dwellProgress={dwellProgress}
            togglePin={togglePin}
          />

          <button
            onClick={() => setIsAiCliOpen(!isAiCliOpen)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-95 group shrink-0 shadow-md ${isAiCliOpen
              ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-500/40'
              : isLightMode
                ? 'bg-indigo-50 border-indigo-200 text-indigo-500 hover:text-white hover:bg-indigo-600 hover:border-indigo-600'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:text-white hover:bg-indigo-600'
              }`}
            title="AI 命令行 (Cmd+J)"
          >
            <i className={`fa-solid fa-terminal text-[9px] transition-transform ${isAiCliOpen ? 'scale-110' : 'group-hover:rotate-12'}`}></i>
          </button>

          <button
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-95 group shrink-0 shadow-md ${isVoiceMode
              ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/40'
              : isLightMode
                ? 'bg-rose-50 border-rose-200 text-rose-500 hover:text-white hover:bg-rose-600 hover:border-rose-600'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:text-white hover:bg-rose-600'
              }`}
            title="湿实验语音伴侣"
          >
            <i className={`fa-solid fa-microphone text-[10px] transition-transform ${isVoiceMode ? 'scale-110' : 'group-hover:rotate-12'}`}></i>
          </button>

          <div className="relative group/theme flex items-center justify-center">
            <div
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0 ${isLightMode
                ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20'
                }`}
            >
              <div className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm ring-1 ring-rose-500/20" style={{ backgroundColor: activeTheme.colors.background }}></div>
            </div>

            {/* Dropdown Menu */}
            <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 invisible group-hover/theme:opacity-100 group-hover/theme:visible transition-all duration-200 transform translate-y-2 group-hover/theme:translate-y-0 rounded-xl border shadow-xl p-2 z-[9900] ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'
              } min-w-[120px]`}>
              <div className="flex flex-wrap gap-2 justify-center">
                {APP_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTheme(t)}
                    className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-125 ${activeTheme.id === t.id ? 'ring-2 ring-indigo-500 ring-offset-1 border-white' : 'border-white/20 opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: t.colors.background }}
                    title={t.name}
                  />
                ))}
              </div>
            </div>
          </div>


          {/* 邀请通知按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowInvitePanel(!showInvitePanel)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-95 shrink-0 shadow-md relative ${isLightMode
                ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-indigo-600 hover:text-white'
                : 'bg-slate-700/30 border-slate-600/30 text-slate-400 hover:bg-indigo-600 hover:text-white'
                }`}
              title="项目邀请"
            >
              <i className="fa-solid fa-bell text-[10px]" />
              {inviteNotifs.hasNew && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-slate-900 rounded-full flex items-center justify-center text-[7px] font-black text-white animate-bounce">
                  {inviteNotifs.newInvites.length}
                </span>
              )}
            </button>

            {showInvitePanel && (
              <div className={`absolute bottom-full left-0 mb-2 w-64 rounded-2xl shadow-2xl border overflow-hidden z-[200] ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                <div className={`px-4 py-3 border-b ${isLightMode ? 'border-slate-100' : 'border-slate-700'} flex items-center justify-between`}>
                  <span className={`text-[10px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>项目邀请</span>
                  {inviteNotifs.hasNew && (
                    <button onClick={() => { inviteNotifs.markAllAsRead(); }} className="text-[8px] font-bold text-indigo-500 hover:underline">全部已读</button>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {inviteNotifs.newInvites.length === 0 ? (
                    <div className={`text-center py-6 ${isLightMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <i className="fa-solid fa-inbox text-lg opacity-40 mb-1"></i>
                      <p className="text-[9px] font-bold">暂无新邀请</p>
                    </div>
                  ) : (
                    inviteNotifs.newInvites.map(inv => (
                      <div key={inv.projectId} className={`px-4 py-3 border-b last:border-0 flex items-center gap-3 ${isLightMode ? 'border-slate-50 hover:bg-slate-50' : 'border-slate-700/50 hover:bg-slate-700/50'} transition-all cursor-pointer`}
                        onClick={() => { inviteNotifs.markAsRead(inv.projectId); setShowInvitePanel(false); }}
                      >
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <i className="fa-solid fa-folder-open text-xs"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-black truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{inv.projectTitle}</p>
                          <p className={`text-[8px] font-bold ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>角色: {inv.role} · {new Date(inv.invitedAt).toLocaleDateString('zh-CN')}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 科研黄历 — 从侧边栏后方平滑滑入 */}
      <AnimatePresence>
        {showGlobalAlmanac && (
          <motion.div
            initial={{ x: '-110%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-110%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`absolute top-0 bottom-0 ${isCollapsed ? 'left-20' : 'left-20 lg:left-56'} w-[380px] bg-white shadow-[20px_0_50px_rgba(0,0,0,0.15)] border-r border-slate-200 z-[45] overflow-hidden rounded-r-2xl`}
          >
            <AlmanacPanel
              tasks={globalAlmanacTasks}
              onClose={() => setShowGlobalAlmanac(false)}
              slideFrom="inline"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 h-full min-h-0 p-2 md:p-4 transition-colors duration-500 min-w-0 overflow-hidden relative" style={{ backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0, transparent 40%)' }}>
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <AppRouter route={route} navigate={navigate} openAddProject={() => setModalOpen('addProject', true)} confirmDelete={confirmDelete} />
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] animate-reveal">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${toast.type === 'error' ? 'bg-rose-500/90 border-rose-400 text-white' :
            toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
              'bg-slate-800/90 border-slate-700 text-white'
            }`}>
            <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-xmark' :
              toast.type === 'success' ? 'fa-circle-check' :
                'fa-circle-info'
              }`}></i>
            <div className="flex flex-col">
              <span className="text-xs font-bold">{toast.message}</span>
            </div>
            {toast.onAction && toast.actionLabel && (
              <button
                onClick={() => { toast.onAction?.(); hideToast(); }}
                className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[9px] font-black uppercase transition-all"
              >
                {toast.actionLabel}
              </button>
            )}
            <button onClick={hideToast} className="ml-1 opacity-70 hover:opacity-100"><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>
      )}

      <GlobalSearchOverlay />
      <VoiceLabCompanion />
      <AiCommandCli />
      <ModalManager modals={modals} closeModal={(key) => setModalOpen(key, key === 'confirm' ? null : false)} onOpenConfirm={(config) => setModalOpen('confirm', config)} cloudSync={cloudSync} />

      {/* AI API 配置引导弹窗 */}
      <ApiSetupGuideModal
        show={showApiGuide}
        onClose={() => setShowApiGuide(false)}
        onGoToSettings={() => {
          setShowApiGuide(false);
          setModalOpen('settings', true);
        }}
      />

    </div >
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary module="SciFlow Pro">
      <AuthGate>
        <LicenseGate>
          <ProjectProvider>
            <AppContent />
          </ProjectProvider>
        </LicenseGate>
      </AuthGate>
    </ErrorBoundary>
  );
};

export default App;
