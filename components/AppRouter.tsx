
import React, { useState, useEffect, useMemo } from 'react';
import { useProjectContext } from '../context/ProjectContextCore';
import { AppView, PaperSectionId, Milestone, ResearchProject, AppTheme } from '../types';
import ProjectDetail from './ProjectDetail';
import LiteratureView from './Literature';
import DataAnalysis from './DataAnalysis';
import Dashboard from './Dashboard';
import AIAssistant from './AIAssistant';
import DOEAssistant from './DOEAssistant';
import { FlowchartGenerator } from './FlowchartGenerator';
import WritingModule from './WritingModule';
import Sparkline from './Layout/Sparkline';
import KnowledgeGraph from './KnowledgeGraph';
import TrendsRadar from './Industry/TrendsRadar';
import MarketAnalysisView from './MarketAnalysis/MarketAnalysisView';
import MechanismWorkshop from './Mechanism/MechanismWorkshop';
import FigureCenter from './FigureCenter/FigureCenter';
import InventoryView from './Inventory/InventoryView';
import VideoLab from './VideoLab/VideoLab';
import InceptionView from './Inception/InceptionView';
import TeamHub from './Team/TeamHub';
import CharacterizationHub from './Characterization/CharacterizationHub';
import ResearchBrain from './ResearchBrain/ResearchBrain';
import ResearchFarm from './ResearchFarm/ResearchFarm';
import ProcessLabView from './ProcessLab/ProcessLabView';
import ResearchNotebook from './Notebook/ResearchNotebook';
import MobileQuickView from './Mobile/MobileQuickView';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from '../locales/useTranslation';

interface AppRouterProps {
  route: { view: AppView; projectId: string | null; subView: string | null };
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
  openAddProject: () => void;
  confirmDelete: (id: string) => void;
}

const MicroGantt = ({ milestones, theme, isLightMode }: { milestones: Milestone[], theme: any, isLightMode: boolean }) => {
  const sorted = [...milestones].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const displayItems = sorted.slice(0, 5);

  const now = new Date().getTime();
  const dates = displayItems.map(m => new Date(m.dueDate).getTime());
  if (dates.length === 0) return null;

  const minDate = Math.min(...dates, now - 30 * 24 * 3600 * 1000);
  const maxDate = Math.max(...dates, now + 30 * 24 * 3600 * 1000);
  const totalRange = maxDate - minDate || 1;

  return (
    <div className="w-full mb-3 px-1 mt-3">
      <div className="flex justify-between items-end mb-2">
        <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${isLightMode ? 'text-slate-400' : 'text-slate-50'}`}>
          <i className="fa-solid fa-timeline"></i> GANTT
        </span>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            <span className="text-[6px] uppercase font-bold opacity-60">Done</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${theme.bar}`}></div>
            <span className="text-[6px] uppercase font-bold opacity-60">Active</span>
          </div>
        </div>
      </div>

      <div className={`relative w-full h-20 rounded-xl border flex flex-col justify-evenly px-2 py-1 overflow-hidden ${isLightMode ? 'bg-slate-50/50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
        <div className="absolute inset-0 flex w-full h-full px-2 pointer-events-none z-0">
          {[0.25, 0.5, 0.75].map(p => (
            <div key={p} className={`h-full border-r border-dashed absolute top-0 bottom-0 ${isLightMode ? 'border-slate-200' : 'border-white/5'}`} style={{ left: `${p * 100}%` }}></div>
          ))}
          <div className="absolute top-0 bottom-0 border-l-2 border-rose-400/30 z-0" style={{ left: `${Math.max(0, Math.min(100, ((now - minDate) / totalRange) * 100))}%` }}></div>
        </div>

        {displayItems.map((m, i) => {
          const due = new Date(m.dueDate).getTime();
          const start = due - (14 * 24 * 3600 * 1000);

          let left = ((start - minDate) / totalRange) * 100;
          let width = ((due - start) / totalRange) * 100;

          left = Math.max(0, Math.min(95, left));
          width = Math.max(5, Math.min(100 - left, width));

          let colorClass = isLightMode ? 'bg-slate-300' : 'bg-slate-600';
          if (m.status === 'completed') colorClass = 'bg-emerald-400';
          else if (m.status === 'in-progress') colorClass = theme.bar;
          else if (m.status === 'failed') colorClass = 'bg-rose-400';

          return (
            <div key={m.id} className="relative w-full h-2 rounded-full z-10 group/gantt flex items-center">
              <div
                className={`absolute h-1.5 rounded-full ${colorClass} shadow-sm transition-all duration-500`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                {m.status === 'in-progress' && <div className={`absolute inset-0 rounded-full animate-pulse opacity-50 ${colorClass}`}></div>}
              </div>
              <div className="absolute left-0 top-0 w-full h-full opacity-0 group-hover/gantt:opacity-100 transition-opacity z-20 pointer-events-none flex items-center" style={{ paddingLeft: `${left + width + 2}%` }}>
                <span className={`text-[8px] font-black truncate whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-800 text-white shadow-lg`}>
                  {m.title}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

interface ProjectCardProps {
  project: ResearchProject;
  activeTheme: AppTheme;
  onNavigate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (dragId: string, dropId: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  activeTheme,
  onNavigate,
  onDelete,
  onReorder
}) => {
  const [deleteStage, setDeleteStage] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (deleteStage > 0) {
      const timer = setTimeout(() => setDeleteStage(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [deleteStage]);

  const getCategoryTheme = (category: string) => {
    const themeMap: Record<string, { badge: string; bar: string; border: string }> = {
      [t('projects.category.newEnergy')]: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', border: 'border-l-emerald-500' },
      [t('projects.category.biomedicine')]: { badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', border: 'border-l-rose-500' },
      [t('projects.category.ai')]: { badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', border: 'border-l-violet-500' },
      [t('projects.category.materialScience')]: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', border: 'border-l-amber-500' },
      // Fallback for stored Chinese values
      '新能源': { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', border: 'border-l-emerald-500' },
      '生物医药': { badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', border: 'border-l-rose-500' },
      '人工智能': { badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', border: 'border-l-violet-500' },
      '材料科学': { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', border: 'border-l-amber-500' },
    };
    return themeMap[category] || { badge: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-600', border: 'border-l-indigo-600' };
  };

  const theme = getCategoryTheme(project.category);
  const activeMilestone = project.milestones.find(m => m.status === 'in-progress') || project.milestones.find(m => m.status === 'pending');
  const activeWeekPlan = project.weeklyPlans?.find(wp => wp.status === 'in-progress');

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteStage === 0) {
      setDeleteStage(1);
    } else if (deleteStage === 1) {
      setDeleteStage(2);
    } else {
      onDelete(project.id);
      setDeleteStage(0);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('projectId', project.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dragId = e.dataTransfer.getData('projectId');
    if (dragId && dragId !== project.id) {
      onReorder(dragId, project.id);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onNavigate(project.id)}
      className={`p-5 rounded-3xl border-2 border-l-[10px] cursor-grab active:cursor-grabbing transition-all group flex flex-col h-[380px] relative shadow-lg overflow-hidden ${isDragOver ? 'border-indigo-400 bg-indigo-50/10 scale-[1.02] shadow-2xl' : ''
        } ${activeTheme.type === 'light' ? `bg-white border-slate-100 ${theme.border} hover:border-indigo-500/50` : `bg-slate-800/80 backdrop-blur-md border-white/10 ${theme.border} hover:border-indigo-500/50`}`}
    >
      <div className="absolute top-3 right-3 z-30 flex items-center justify-end">
        <AnimatePresence mode="wait">
          {deleteStage === 0 ? (
            <motion.button
              key="delete-icon"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleDeleteClick}
              className="w-8 h-8 bg-rose-600/10 text-rose-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-600 hover:text-white transition-all shadow-md"
            >
              <i className="fa-solid fa-trash-can text-xs"></i>
            </motion.button>
          ) : deleteStage === 1 ? (
            <motion.button
              key="confirm-btn-1"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              onClick={handleDeleteClick}
              className="px-4 h-8 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase shadow-lg border border-amber-400 whitespace-nowrap flex items-center gap-2"
            >
              <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
              {t('projects.confirmDelete')}
            </motion.button>
          ) : (
            <motion.button
              key="confirm-btn-2"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={handleDeleteClick}
              className="px-4 h-8 bg-rose-600 text-white rounded-xl text-[8px] font-black uppercase shadow-lg border border-rose-400 whitespace-nowrap flex items-center gap-2 animate-pulse"
            >
              <i className="fa-solid fa-radiation text-[10px]"></i>
              {t('projects.irreversible')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1">
        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-2 inline-block ${theme.badge}`}>{project.category}</span>
        <h3 className={`text-lg font-black leading-tight group-hover:text-indigo-600 line-clamp-2 uppercase mb-3 h-12 ${activeTheme.type === 'light' ? 'text-slate-800' : 'text-white'}`}>{project.title}</h3>

        <div className={`mb-2 p-3 rounded-2xl border shadow-inner ${activeTheme.type === 'light' ? 'bg-slate-50 border-slate-100' : 'bg-slate-900/50 border-white/5'}`}>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('projects.activeNode')}</p>
          <p className={`text-[10px] font-black uppercase truncate italic leading-none ${activeMilestone ? (activeTheme.type === 'light' ? 'text-indigo-600' : 'text-indigo-300') : 'text-slate-500'}`}>
            {activeMilestone ? activeMilestone.title : t('projects.noActive')}
          </p>
        </div>

        <MicroGantt milestones={project.milestones} theme={theme} isLightMode={activeTheme.type === 'light'} />

        {activeWeekPlan && (
          <div className={`mt-2 p-2 rounded-xl border ${activeTheme.type === 'light' ? 'bg-indigo-50/50 border-indigo-100' : 'bg-indigo-900/10 border-indigo-500/20'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">{t('projects.weeklyProgress')}</span>
              <span className="text-[9px] font-black text-indigo-500 italic">{activeWeekPlan.completionRate}%</span>
            </div>
            <div className={`h-1 w-full rounded-full overflow-hidden ${activeTheme.type === 'light' ? 'bg-indigo-100' : 'bg-white/10'}`}>
              <div className={`h-full transition-all duration-1000 ${theme.bar}`} style={{ width: `${activeWeekPlan.completionRate}%` }}></div>
            </div>
          </div>
        )}
      </div>
      <div className={`mt-4 shrink-0 pt-3 border-t ${activeTheme.type === 'light' ? 'border-slate-50' : 'border-white/5'}`}>
        <div className="flex justify-between items-end mb-1.5">
          <span className={`text-[10px] font-black ${activeTheme.type === 'light' ? 'text-slate-800' : 'text-white'}`}>{t('projects.totalProgress')}: {project.progress}%</span>
          <div className="flex gap-2">
            <span className="text-[8px] font-bold text-slate-400 uppercase">{t('projects.literature')}: {project.citedLiteratureIds?.length || 0}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase">{t('projects.reports')}: {project.weeklyReports?.length || 0}</span>
          </div>
        </div>
        <div className={`h-2 w-full rounded-full overflow-hidden shadow-inner ${activeTheme.type === 'light' ? 'bg-slate-100' : 'bg-white/10'}`}>
          <div className={`h-full transition-all duration-1000 ${theme.bar}`} style={{ width: `${project.progress}%` }}></div>
        </div>
      </div>
    </div>
  );
};

/** ── 课题列表视图（含搜索 / 筛选 / 排序 / 归档折叠） ── */
type SortKey = 'progress' | 'deadline' | 'recent';
type FilterStatus = 'all' | 'In Progress' | 'Planning' | 'Peer Review' | 'Completed';

const ProjectsListView: React.FC<{
  projects: ResearchProject[];
  activeTheme: AppTheme;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
  openAddProject: () => void;
  confirmDelete: (id: string) => void;
  onReorder: (dragId: string, dropId: string) => void;
  t: (key: string) => string;
}> = ({ projects, activeTheme, navigate, openAddProject, confirmDelete, onReorder, t }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [showArchived, setShowArchived] = useState(false);

  const isLight = activeTheme.type === 'light';

  const { activeProjects, archivedProjects } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const filtered = projects.filter(p => {
      // Search
      if (q && !p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      return true;
    });

    // Separate archived
    const archived = filtered.filter(p => p.status === 'Archived');
    let active = filtered.filter(p => p.status !== 'Archived');

    // Status filter (only for non-archived)
    if (filterStatus !== 'all') {
      active = active.filter(p => p.status === filterStatus);
    }

    // Sort
    active.sort((a, b) => {
      switch (sortBy) {
        case 'progress': return b.progress - a.progress;
        case 'deadline': {
          const da = new Date(a.deadline || '2099-01-01').getTime();
          const db = new Date(b.deadline || '2099-01-01').getTime();
          return da - db;
        }
        case 'recent':
        default: {
          const latestLogTs = (p: ResearchProject) => {
            const allLogs = p.milestones?.flatMap(m => m.logs || []) || [];
            if (allLogs.length === 0) return 0;
            return Math.max(...allLogs.map(l => new Date(l.timestamp).getTime() || 0));
          };
          return latestLogTs(b) - latestLogTs(a);
        }
      }
    });

    return { activeProjects: active, archivedProjects: archived };
  }, [projects, searchQuery, filterStatus, sortBy]);

  const statusFilters: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: '全部', color: 'bg-slate-600' },
    { key: 'In Progress', label: t('projects.status.inProgress'), color: 'bg-blue-600' },
    { key: 'Planning', label: t('projects.status.planning'), color: 'bg-slate-500' },
    { key: 'Peer Review', label: t('projects.status.peerReview'), color: 'bg-amber-600' },
    { key: 'Completed', label: t('projects.status.completed'), color: 'bg-emerald-600' },
  ];

  const sortOptions: { key: SortKey; label: string; icon: string }[] = [
    { key: 'recent', label: '最近活跃', icon: 'fa-clock' },
    { key: 'progress', label: '按进度', icon: 'fa-bars-progress' },
    { key: 'deadline', label: '按截止日期', icon: 'fa-calendar' },
  ];

  return (
    <div className="space-y-4 animate-reveal h-full flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-4 shrink-0">
        <h2 className={`text-xl font-black uppercase tracking-tighter ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('projects.title')}</h2>
        <button onClick={openAddProject} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all active:scale-95">{t('projects.newProject')}</button>
      </header>

      {/* ── 工具栏 ── */}
      <div className={`flex flex-wrap items-center gap-3 px-4 py-3 mx-4 rounded-2xl border shrink-0 ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/60 border-white/10'}`}>
        {/* 搜索框 */}
        <div className={`flex items-center gap-2 flex-1 min-w-[180px] max-w-xs px-3 py-2 rounded-xl border transition-all ${isLight ? 'bg-slate-50 border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100' : 'bg-white/5 border-white/10 focus-within:border-indigo-500'}`}>
          <i className="fa-solid fa-magnifying-glass text-[10px] text-slate-400"></i>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索课题名称、描述..."
            className={`bg-transparent text-[11px] font-bold outline-none w-full placeholder:text-slate-400 ${isLight ? 'text-slate-800' : 'text-white'}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 transition-colors">
              <i className="fa-solid fa-xmark text-[10px]"></i>
            </button>
          )}
        </div>

        {/* 状态筛选 */}
        <div className="flex items-center gap-1.5">
          {statusFilters.map(sf => (
            <button
              key={sf.key}
              onClick={() => setFilterStatus(sf.key)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                filterStatus === sf.key
                  ? `${sf.color} text-white shadow-md`
                  : isLight
                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div className={`w-px h-6 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}></div>

        {/* 排序 */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>排序</span>
          {sortOptions.map(so => (
            <button
              key={so.key}
              onClick={() => setSortBy(so.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all flex items-center gap-1 active:scale-95 ${
                sortBy === so.key
                  ? isLight ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300'
                  : isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-white/5'
              }`}
            >
              <i className={`fa-solid ${so.icon} text-[8px]`}></i>
              {so.label}
            </button>
          ))}
        </div>

        {/* 结果计数 */}
        <div className="ml-auto shrink-0">
          <span className={`text-[9px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {activeProjects.length} 个课题
            {archivedProjects.length > 0 && ` · ${archivedProjects.length} 已归档`}
          </span>
        </div>
      </div>

      {/* ── 卡片网格 ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-6 pb-4">
        {activeProjects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeProjects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                activeTheme={activeTheme}
                onNavigate={(id) => navigate('project_detail', id)}
                onDelete={confirmDelete}
                onReorder={onReorder}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <i className="fa-solid fa-flask-vial text-5xl text-slate-300 mb-4"></i>
            <p className={`text-sm font-black uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {searchQuery || filterStatus !== 'all' ? '没有符合条件的课题' : '暂无课题，点击上方按钮创建'}
            </p>
          </div>
        )}

        {/* ── 归档课题折叠区 ── */}
        {archivedProjects.length > 0 && (
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-white/5 border-white/5'}`}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`w-full flex items-center justify-between px-5 py-3 transition-all ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-2">
                <i className={`fa-solid fa-archive text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}></i>
                <span className={`text-[10px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  已归档课题 ({archivedProjects.length})
                </span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showArchived ? 'rotate-180' : ''} ${isLight ? 'text-slate-400' : 'text-slate-500'}`}></i>
            </button>
            {showArchived && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 pt-0">
                {archivedProjects.map(p => (
                  <div key={p.id} className="relative opacity-70 hover:opacity-100 transition-opacity">
                    <ProjectCard
                      project={p}
                      activeTheme={activeTheme}
                      onNavigate={(id) => navigate('project_detail', id)}
                      onDelete={confirmDelete}
                      onReorder={onReorder}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AppRouter: React.FC<AppRouterProps> = ({ route, navigate, openAddProject, confirmDelete }) => {
  const {
    projects, resources, activeTasks, setProjects, setResources,
    handleStartTransformation, handleRunWeeklyReportTask, setAiStatus, activeTheme
  } = useProjectContext();
  const { t } = useTranslation();
  const { isMobileView } = useMobileLayout();

  const activeProject = projects.find(p => p.id === route.projectId);

  // 记住最后一个活跃的 project，即使导航离开也保持 ProjectDetail 挂载
  const lastActiveProjectRef = React.useRef<typeof activeProject>(activeProject);
  if (activeProject) {
    lastActiveProjectRef.current = activeProject;
  }
  // 实时同步：即使导航离开，也用最新的 project 数据（可能被其他地方更新）
  const mountedProject = activeProject || (lastActiveProjectRef.current
    ? projects.find(p => p.id === lastActiveProjectRef.current!.id)
    : undefined) || lastActiveProjectRef.current;

  const handleReorderProjects = (dragId: string, dropId: string) => {
    const next = [...projects];
    const dragIdx = next.findIndex(p => p.id === dragId);
    const dropIdx = next.findIndex(p => p.id === dropId);
    if (dragIdx > -1 && dropIdx > -1) {
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      setProjects(next);
    }
  };

  const renderRoute = () => {
    // ProjectDetail 已移至始终挂载区域（与 WritingModule 类似），此处不再条件渲染
    if (route.view === 'project_detail') {
      return null;
    }

    switch (route.view) {
      case 'dashboard':
        // 移动端使用 MobileQuickView 替代桌面 Dashboard
        if (isMobileView) {
          return <MobileQuickView
            project={projects[0] || null}
            literatures={resources}
            isLightMode={activeTheme.type === 'light'}
            onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))}
          />;
        }
        return <Dashboard projects={projects} resources={resources} navigate={navigate} />;
      case 'projects': {
        return <ProjectsListView projects={projects} activeTheme={activeTheme} navigate={navigate} openAddProject={openAddProject} confirmDelete={confirmDelete} onReorder={handleReorderProjects} t={t} />;
      }
      case 'inception': return <InceptionView />;
      case 'graph': return <ResearchBrain />; // 重定向图谱到整合后的 ResearchBrain
      case 'literature': return (
        <LiteratureView
          resources={resources}
          projects={projects}
          onAddResources={added => setResources(prev => [...prev, ...added])}
          onDeleteResource={id => setResources(prev => prev.filter(r => r.id !== id))}
          onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))}
          onUpdateResource={updated => setResources(prev => prev.map(r => r.id === updated.id ? updated : r))}
          activeTasks={activeTasks}
          onStartTransformation={handleStartTransformation}
          initialProjectId={route.projectId || undefined}
          initialResourceId={(route.subView as string) || undefined}
          Maps={navigate}
          onSetAiStatus={setAiStatus}
        />
      );
      case 'research_brain': return <ResearchBrain />;
      case 'team': return <TeamHub />;
      case 'inventory': return <InventoryView />;
      case 'data': return <DataAnalysis projects={projects} onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))} navigate={navigate} />;
      case 'doe': return <DOEAssistant projects={projects} onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))} navigate={navigate} initialArchiveId={route.subView} />;
      case 'flowchart': return <FlowchartGenerator projects={projects} onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))} navigate={navigate} />;
      case 'writing': return null; // WritingModule 始终挂载，不在 switch 中渲染
      case 'figure_center': return <FigureCenter />;
      case 'mechanism': return <MechanismWorkshop />;
      case 'industry_trends': return null; // TrendsRadar 始终挂载，不在 switch 中渲染
      case 'market_analysis': return null; // MarketAnalysisView 始终挂载
      case 'characterization_hub': return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <CharacterizationHub initialMode={route.projectId as any} initialRecordId={route.subView} />
        </div>
      );
      case 'assistant': return null; // AIAssistant 始终挂载，不在 switch 中渲染
      case 'video_lab': return <VideoLab />;
      case 'research_farm': return <ResearchFarm />;
      case 'process_lab': return <ProcessLabView />;
      case 'notebook': return <ResearchNotebook />;
      case 'companion': return <MobileQuickView
        project={projects[0] || null}
        literatures={resources}
        isLightMode={activeTheme.type === 'light'}
        onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))}
      />;
      default: return <Dashboard projects={projects} resources={resources} navigate={navigate} />;
    }
  };

  return (
    <>
      {renderRoute()}
      {/* WritingModule 始终挂载，切换页面时仅隐藏，不卸载，以保持后台 AI 生成任务（子图识别、图注生成等）继续运行 */}
      <div style={{ display: route.view === 'writing' ? 'block' : 'none' }} className="h-full">
        <WritingModule
          projects={projects} resources={resources} activeTasks={activeTasks} navigate={navigate}
          onUpdateProject={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))}
          initialProjectId={route.projectId || undefined}
          initialSubView={(route.subView as string) || undefined}
          onSetAiStatus={setAiStatus}
        />
      </div>
      {/* AIAssistant 始终挂载，切换页面时仅隐藏，不卸载，以保持后台 AI 生成任务继续运行 */}
      <div style={{ display: route.view === 'assistant' ? 'block' : 'none' }} className="h-full">
        <AIAssistant />
      </div>
      {/* ProjectDetail 始终挂载，切换页面时仅隐藏，不卸载，以保持后台 AI 实验流生成等异步任务继续运行 */}
      {mountedProject && (
        <div style={{ display: route.view === 'project_detail' ? 'flex' : 'none' }} className="h-full flex-col">
          <ProjectDetail
            project={mountedProject}
            onBack={() => navigate('projects')}
            onUpdate={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))}
            activeTasks={activeTasks}
            onStartWeeklyReport={(type) => {
              if (type && type !== 'manual') {
                handleRunWeeklyReportTask(mountedProject, type).then(() => {
                  navigate('project_detail', mountedProject.id, 'reports');
                });
              }
            }}
            Maps={navigate}
            initialView={(route.subView as any) || 'logs'}
            onSetAiStatus={setAiStatus}
          />
        </div>
      )}
      {/* TrendsRadar 始终挂载，切换页面时仅隐藏，不卸载，以保持后台搜索/报告生成任务继续运行 */}
      <div style={{ display: route.view === 'industry_trends' ? 'block' : 'none' }} className="h-full">
        <TrendsRadar />
      </div>
      {/* MarketAnalysisView 始终挂载，保持后台竞品搜索/报告生成任务继续运行 */}
      <div style={{ display: route.view === 'market_analysis' ? 'block' : 'none' }} className="h-full">
        <MarketAnalysisView />
      </div>
    </>
  );
};

export default AppRouter;
