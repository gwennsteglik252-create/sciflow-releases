/**
 * MobileBottomNav.tsx — 移动端底部导航栏
 *
 * 在移动端替代桌面端的左侧边栏，提供核心模块的快速切换。
 * 采用 5+1 布局：5 个常驻入口 + 1 个"更多"浮层展开全部模块。
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface MobileBottomNavProps {
  activeView: AppView;
  navigate: (view: AppView, projectId?: string) => void;
  isLightMode: boolean;
  hasProjects: boolean;
  firstProjectId?: string;
  doeBadge?: number;
  mechanismBadge?: number;
  notificationBadge?: number;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView, navigate, isLightMode, hasProjects, firstProjectId, doeBadge, mechanismBadge, notificationBadge
}) => {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  // 主导航 — 底部 tab 常驻显示的 5 个核心入口
  const primaryTabs = useMemo(() => [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: 'fa-house-chimney', color: 'from-blue-500 to-indigo-500' },
    { id: 'projects', label: t('sidebar.projects'), icon: 'fa-vials', color: 'from-indigo-500 to-purple-500' },
    { id: 'research_brain', label: t('sidebar.researchBrain'), icon: 'fa-brain', color: 'from-purple-500 to-fuchsia-500' },
    { id: 'companion', label: '伴侣', icon: 'fa-wand-magic-sparkles', color: 'from-violet-500 to-indigo-500' },
    { id: 'more', label: t('sidebar.more'), icon: 'fa-grid-2', color: 'from-slate-400 to-slate-500' }
  ], [t]);

  // "更多"面板中展示的全部模块
  const moreModules = useMemo(() => [
    { id: 'notification_center', label: '通知', icon: 'fa-bell', color: 'text-amber-400', badge: notificationBadge },
    { id: 'inception', label: t('sidebar.inception'), icon: 'fa-compass', color: 'text-emerald-400' },
    { id: 'industry_trends', label: t('sidebar.industryTrends'), icon: 'fa-tower-broadcast', color: 'text-rose-400' },
    { id: 'market_analysis', label: t('sidebar.marketAnalysis'), icon: 'fa-chart-pie', color: 'text-teal-400' },
    { id: 'data', label: t('sidebar.data'), icon: 'fa-chart-line', color: 'text-cyan-400' },
    { id: 'team', label: t('sidebar.team'), icon: 'fa-id-card-clip', color: 'text-emerald-400' },
    { id: 'literature', label: t('sidebar.literature'), icon: 'fa-book-atlas', color: 'text-emerald-400' },
    { id: 'mechanism', label: t('sidebar.mechanism'), icon: 'fa-atom', color: 'text-amber-400', badge: mechanismBadge },
    { id: 'characterization_hub', label: t('sidebar.characterizationHub'), icon: 'fa-microscope', color: 'text-rose-400' },
    { id: 'inventory', label: t('sidebar.inventory'), icon: 'fa-box-archive', color: 'text-emerald-500' },
    { id: 'doe', label: t('sidebar.doe'), icon: 'fa-puzzle-piece', color: 'text-amber-400', badge: doeBadge },
    { id: 'flowchart', label: t('sidebar.flowchart'), icon: 'fa-bezier-curve', color: 'text-cyan-400' },
    { id: 'figure_center', label: t('sidebar.figureCenter'), icon: 'fa-palette', color: 'text-orange-400' },
    { id: 'video_lab', label: t('sidebar.videoLab'), icon: 'fa-film', color: 'text-rose-400' },
    { id: 'writing', label: t('sidebar.writing'), icon: 'fa-pen-nib', color: 'text-rose-400' },
    { id: 'process_lab', label: t('sidebar.processLab'), icon: 'fa-industry', color: 'text-amber-500' },
    { id: 'notebook', label: '笔记本', icon: 'fa-book', color: 'text-indigo-400' },
    { id: 'assistant', label: t('sidebar.assistant'), icon: 'fa-user-tie', color: 'text-purple-400' },
  ], [t, doeBadge, mechanismBadge, notificationBadge]);

  const handleNavClick = (id: string) => {
    if (id === 'more') {
      setShowMore(!showMore);
      return;
    }
    setShowMore(false);

    // 通知中心通过自定义事件触发（不是路由视图）
    if (id === 'notification_center') {
      window.dispatchEvent(new CustomEvent('sciflow_toggle_notifications'));
      return;
    }

    if (id === 'projects') {
      if (hasProjects && firstProjectId) {
        navigate('project_detail', firstProjectId);
      } else {
        navigate('projects');
      }
    } else if (id === 'literature') {
      if (hasProjects && firstProjectId) {
        navigate('literature', firstProjectId);
      } else {
        navigate('literature');
      }
    } else {
      navigate(id as AppView);
    }
  };

  const isActive = (id: string) => {
    if (id === 'projects') return activeView === 'projects' || activeView === 'project_detail';
    if (id === 'research_brain') return activeView === 'research_brain' || activeView === 'graph';
    return activeView === id;
  };

  // 检查当前激活的视图是否在"更多"面板中
  const isMoreActive = moreModules.some(m => isActive(m.id));

  return (
    <>
      {/* "更多"模块浮层 */}
      <AnimatePresence>
        {showMore && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9980]"
              onClick={() => setShowMore(false)}
            />
            {/* 浮层面板 */}
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] left-3 right-3 z-[9985] rounded-3xl border shadow-2xl overflow-hidden ${isLightMode
                ? 'bg-white/95 border-slate-200'
                : 'bg-slate-900/95 border-white/10'
                } backdrop-blur-xl`}
            >
              {/* 面板顶部拖拽指示器 */}
              <div className="flex justify-center pt-3 pb-2">
                <div className={`w-10 h-1 rounded-full ${isLightMode ? 'bg-slate-300' : 'bg-white/20'}`} />
              </div>

              {/* 标题 */}
              <div className="px-5 pb-3">
                <span className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('sidebar.allModules')}
                </span>
              </div>

              {/* 模块网格 */}
              <div className="px-4 pb-5 grid grid-cols-4 gap-3">
                {moreModules.map((item) => {
                  const active = isActive(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all active:scale-90 relative ${active
                        ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                        : isLightMode
                          ? 'hover:bg-slate-100 text-slate-700'
                          : 'hover:bg-white/5 text-slate-300'
                        }`}
                    >
                      <div className="relative">
                        <i className={`fa-solid ${item.icon} text-base ${active ? 'text-white' : item.color}`} />
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[7px] min-w-[12px] h-3 flex items-center justify-center rounded-full px-0.5 font-black animate-pulse">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-bold leading-tight text-center">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 底部导航栏 */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-[9990] border-t backdrop-blur-xl transition-colors duration-300 ${isLightMode
          ? 'bg-white/90 border-slate-200'
          : 'bg-slate-950/90 border-white/10'
          }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around h-14 px-1">
          {primaryTabs.map((tab) => {
            const active = tab.id === 'more' ? (showMore || isMoreActive) : isActive(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleNavClick(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-all duration-200 active:scale-90 ${active
                  ? '' : isLightMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
              >
                {/* 激活指示器 */}
                {active && tab.id !== 'more' && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className={`absolute -top-[1px] w-6 h-[3px] rounded-full bg-gradient-to-r ${tab.color}`}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <i className={`fa-solid ${tab.icon} text-[15px] transition-colors ${active
                  ? isLightMode ? 'text-indigo-600' : 'text-indigo-400'
                  : ''
                  }`}
                />
                <span className={`text-[9px] font-bold transition-colors ${active
                  ? isLightMode ? 'text-indigo-600' : 'text-indigo-400'
                  : ''
                  }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default React.memo(MobileBottomNav);
