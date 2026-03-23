
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { AppView } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface SidebarProps {
  activeView: AppView;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
  isLightMode: boolean;
  isCollapsed: boolean;
  doeBadge?: number;
  mechanismBadge?: number;
  hasProjects: boolean;
  firstProjectId?: string;
  isVoiceMode: boolean;
  setIsVoiceMode: (val: boolean) => void;
  hiddenNavModules?: string[];
  navModuleOrder?: string[];
}

const Sidebar: React.FC<SidebarProps> = React.memo(({ activeView, navigate, isLightMode, isCollapsed, doeBadge, mechanismBadge, hasProjects, firstProjectId, isVoiceMode, setIsVoiceMode, hiddenNavModules = [], navModuleOrder }) => {
  const { t } = useTranslation();

  // ═══ 拖拽弹出状态 ═══
  const [draggingItem, setDraggingItem] = useState<{ id: string; label: string } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { dragCleanupRef.current?.(); };
  }, []);

  const navGroups = [
    [
      { id: 'dashboard', label: t('sidebar.dashboard'), icon: 'fa-house-chimney', color: 'text-blue-400' },
      { id: 'projects', label: t('sidebar.projects'), icon: 'fa-vials', color: 'text-indigo-400' },
      { id: 'team', label: t('sidebar.team'), icon: 'fa-id-card-clip', color: 'text-emerald-400' },
      { id: 'notebook', label: t('sidebar.notebook'), icon: 'fa-book-open', color: 'text-amber-400' }
    ],
    [
      { id: 'research_brain', label: t('sidebar.researchBrain'), icon: 'fa-brain', color: 'text-purple-400' },
      { id: 'literature', label: t('sidebar.literature'), icon: 'fa-book-atlas', color: 'text-emerald-400' },
      { id: 'mechanism', label: t('sidebar.mechanism'), icon: 'fa-atom', badge: mechanismBadge, color: 'text-amber-400' },
      { id: 'characterization_hub', label: t('sidebar.characterizationHub'), icon: 'fa-microscope', color: 'text-rose-400' }
    ],
    [
      { id: 'inventory', label: t('sidebar.inventory'), icon: 'fa-box-archive', color: 'text-emerald-500' },
      { id: 'doe', label: t('sidebar.doe'), icon: 'fa-puzzle-piece', badge: doeBadge, color: 'text-amber-400' },
      { id: 'flowchart', label: t('sidebar.flowchart'), icon: 'fa-bezier-curve', color: 'text-cyan-400' },
      { id: 'data', label: t('sidebar.data'), icon: 'fa-chart-line', color: 'text-violet-400' },
      { id: 'process_lab', label: t('sidebar.processLab'), icon: 'fa-industry', color: 'text-amber-500' }
    ],
    [
      { id: 'figure_center', label: t('sidebar.figureCenter'), icon: 'fa-palette', color: 'text-orange-400' },
      { id: 'video_lab', label: t('sidebar.videoLab'), icon: 'fa-film', color: 'text-rose-400' },
      { id: 'writing', label: t('sidebar.writing'), icon: 'fa-pen-nib', color: 'text-rose-400' }
    ]
  ];

  // ═══ 独立按钮列表（分组外） ═══
  const standaloneItems = [
    { id: 'inception', label: t('sidebar.inception'), icon: 'fa-compass', color: 'text-emerald-400' },
    { id: 'industry_trends', label: t('sidebar.industryTrends'), icon: 'fa-tower-broadcast', color: 'text-rose-400' },
    { id: 'market_analysis', label: t('sidebar.marketAnalysis'), icon: 'fa-chart-pie', color: 'text-teal-400' },
  ];

  const isHidden = (id: string) => hiddenNavModules.includes(id);

  const getActiveStyle = (isActive: boolean) => {
    if (!isActive) return isLightMode
      ? 'text-slate-900 hover:text-indigo-600 hover:bg-indigo-50'
      : 'text-slate-100 hover:text-white hover:bg-white/5';

    return 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_10px_20px_-5px_rgba(99,102,241,0.5)] opacity-100 scale-105';
  };

  const handleNavClick = (id: string) => {
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
    } else if (id === 'graph') {
      navigate('research_brain');
    } else {
      navigate(id as AppView);
    }
  };

  // ═══ 拖拽处理 ═══
  const handleDragStart = useCallback((e: React.DragEvent, item: { id: string; label: string }) => {
    setDraggingItem(item);
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';

    // 创建自定义拖拽图标
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-999px;left:-999px;padding:8px 16px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;box-shadow:0 10px 25px rgba(79,70,229,0.5);white-space:nowrap;z-index:99999;pointer-events:none;';
    ghost.textContent = t('sidebar.popoutGhost', { label: item.label });
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
    requestAnimationFrame(() => document.body.removeChild(ghost));

    // 创建拖拽释放区域提示遮罩
    const overlay = document.createElement('div');
    overlay.id = 'popout-drag-overlay';
    overlay.style.cssText = `
      position:fixed;top:0;right:0;bottom:0;width:calc(100vw - ${isCollapsed ? '80px' : '224px'});
      z-index:9998;display:flex;align-items:center;justify-content:center;
      pointer-events:none;transition:all 0.3s ease;
    `;
    overlay.innerHTML = `
      <div style="
        padding:20px 40px;border-radius:24px;
        background:rgba(79,70,229,0.08);backdrop-filter:blur(4px);
        border:2px dashed rgba(79,70,229,0.3);
        color:rgba(79,70,229,0.7);font-size:13px;font-weight:900;
        text-transform:uppercase;letter-spacing:0.1em;
        display:flex;align-items:center;gap:12px;
        opacity:0;transition:opacity 0.3s ease;
      " id="popout-drag-hint">
        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:18px;"></i>
        ${t('sidebar.dragPopoutHint')}
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      const hint = document.getElementById('popout-drag-hint');
      if (hint) hint.style.opacity = '1';
    });

    dragCleanupRef.current = () => {
      const el = document.getElementById('popout-drag-overlay');
      if (el) el.parentNode?.removeChild(el);
    };
  }, [isCollapsed]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;

    if (!draggingItem) { setDraggingItem(null); return; }

    // 判断鼠标是否在侧边栏外部释放（向右拖出）
    const sidebarWidth = isCollapsed ? 80 : 224;
    const releasedOutside = e.clientX > sidebarWidth + 40;

    if (releasedOutside) {
      (window as any).electron?.openPopoutWindow?.(draggingItem.id, draggingItem.label);
    }

    setDraggingItem(null);
  }, [draggingItem, isCollapsed]);

  // 渲染单个可拖拽导航按钮的通用函数
  const renderNavButton = (id: string, label: string, icon: string, color: string, isActive: boolean, badge?: number) => (
    <button
      key={id}
      draggable
      onDragStart={(e) => handleDragStart(e, { id, label })}
      onDragEnd={handleDragEnd}
      onClick={() => handleNavClick(id)}
      className={`w-full flex items-center justify-center gap-2 px-2 lg:px-3 py-2.5 rounded-2xl transition-all duration-200 font-black text-[11px] uppercase group relative ${isCollapsed ? '' : 'lg:justify-start'} ${getActiveStyle(isActive)} ${draggingItem?.id === id ? 'opacity-40 scale-95' : ''}`}
    >
      <div className="relative">
        <i className={`fa-solid ${icon} text-sm w-5 text-center ${isActive ? 'text-white' : color}`}></i>
        {badge !== undefined && (
          <span className={`absolute -top-1.5 -right-2 bg-indigo-600 text-white text-[8px] min-w-[14px] h-3.5 flex items-center justify-center rounded-full shadow-sm border-2 border-white px-0.5 leading-none font-black ${badge > 0 ? 'animate-pulse' : 'opacity-40'}`}>
            {badge}
          </span>
        )}
      </div>
      {!isCollapsed && <span className={`hidden lg:block truncate font-black flex-1 text-left ${isActive ? 'text-white' : isLightMode ? 'text-slate-900' : 'text-white'}`}> {label}</span>}
    </button>
  );

  // Build a flat item lookup (all modules)
  const allItemsFlat = [...standaloneItems, ...navGroups.flat()];
  const itemById: Record<string, typeof allItemsFlat[0]> = {};
  allItemsFlat.forEach(it => { itemById[it.id] = it; });

  // If custom order exists, render using it; otherwise use default groups
  const hasCustomOrder = navModuleOrder && navModuleOrder.length > 0;

  return (
    <nav ref={navRef} className="flex-1 px-2 lg:px-3 space-y-1 overflow-y-auto custom-scrollbar pt-2">

      {hasCustomOrder ? (() => {
        // Custom-ordered rendering — also collect missing modules
        const rendered = navModuleOrder!.map((entry) => {
          if (entry.startsWith('__sep__')) {
            return <div key={entry} className={`my-2 border-t mx-2 h-[1px] ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}></div>;
          }
          const item = itemById[entry];
          if (!item || isHidden(entry)) return null;
          const isActive = activeView === item.id ||
            (item.id === 'projects' && activeView === 'project_detail') ||
            (item.id === 'literature' && activeView === 'literature' && window.location.hash.includes('/')) ||
            (item.id === 'research_brain' && activeView === 'graph');
          return renderNavButton(item.id, item.label, item.icon, item.color, isActive, (item as any).badge);
        });
        // Append any modules that exist in sidebar but are missing from navModuleOrder
        const orderedIds = new Set(navModuleOrder!.filter(e => !e.startsWith('__sep__')));
        const missing = allItemsFlat.filter(it => !orderedIds.has(it.id) && !isHidden(it.id));
        if (missing.length > 0) {
          rendered.push(<div key="__sep_missing__" className={`my-2 border-t mx-2 h-[1px] ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}></div>);
          missing.forEach(item => {
            const isActive = activeView === item.id ||
              (item.id === 'projects' && activeView === 'project_detail') ||
              (item.id === 'literature' && activeView === 'literature' && window.location.hash.includes('/')) ||
              (item.id === 'research_brain' && activeView === 'graph');
            rendered.push(renderNavButton(item.id, item.label, item.icon, item.color, isActive, (item as any).badge));
          });
        }
        return rendered;
      })() : (
        // Default rendering
        <>
          {standaloneItems.filter(item => !isHidden(item.id)).map(item =>
            renderNavButton(item.id, item.label, item.icon, item.color, activeView === item.id)
          )}

          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.filter(item => !isHidden(item.id));
            if (visibleItems.length === 0) return null;
            return (
              <React.Fragment key={groupIdx}>
                <div className={`my-2 border-t mx-2 h-[1px] ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}></div>
                {visibleItems.map(item => {
                  const isActive = activeView === item.id ||
                    (item.id === 'projects' && activeView === 'project_detail') ||
                    (item.id === 'literature' && activeView === 'literature' && window.location.hash.includes('/')) ||
                    (item.id === 'research_brain' && activeView === 'graph');

                  return renderNavButton(item.id, item.label, item.icon, item.color, isActive, item.badge);
                })}
              </React.Fragment>
            );
          })}
        </>
      )}

      <div className={`my-2 border-t mx-2 h-[1px] ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}></div>

      <button
        onClick={() => setIsVoiceMode(!isVoiceMode)}
        className={`w-full flex items-center justify-center gap-2 px-2 lg:px-3 py-2.5 rounded-2xl transition-all duration-200 font-black text-[11px] uppercase group relative ${isCollapsed ? '' : 'lg:justify-start'} ${isVoiceMode ? 'bg-rose-600 text-white shadow-lg animate-pulse' : getActiveStyle(false)}`}
      >
        <div className="relative">
          <i className={`fa-solid fa-microphone text-sm w-5 text-center ${isVoiceMode ? 'text-white' : 'text-slate-400'}`}></i>
        </div>
        {!isCollapsed && <span className={`hidden lg:block truncate font-black ${isVoiceMode ? 'text-white' : isLightMode ? 'text-slate-900' : 'text-white'}`}>{t('sidebar.voiceCompanion')}</span>}
      </button>

    </nav>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
