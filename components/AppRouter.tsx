
import React, { useState, useEffect } from 'react';
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
import MechanismWorkshop from './Mechanism/MechanismWorkshop';
import FigureCenter from './FigureCenter/FigureCenter';
import InventoryView from './Inventory/InventoryView';
import VideoLab from './VideoLab/VideoLab';
import InceptionView from './Inception/InceptionView';
import TeamHub from './Team/TeamHub';
import CharacterizationHub from './Characterization/CharacterizationHub';
import ResearchBrain from './ResearchBrain/ResearchBrain';
import ResearchFarm from './ResearchFarm/ResearchFarm';
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
    switch (category) {
      case '新能源': return { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', border: 'border-l-emerald-500' };
      case '生物医药': return { badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500', border: 'border-l-rose-500' };
      case '人工智能': return { badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500', border: 'border-l-violet-500' };
      case '材料科学': return { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', border: 'border-l-amber-500' };
      default: return { badge: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-600', border: 'border-l-indigo-600' };
    }
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

const AppRouter: React.FC<AppRouterProps> = ({ route, navigate, openAddProject, confirmDelete }) => {
  const {
    projects, resources, activeTasks, setProjects, setResources,
    handleStartTransformation, handleRunWeeklyReportTask, setAiStatus, activeTheme
  } = useProjectContext();
  const { t } = useTranslation();

  const activeProject = projects.find(p => p.id === route.projectId);

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
    if (route.view === 'project_detail' && activeProject) {
      // 返回课题中心列表页
      const handleSmartBack = () => {
        navigate('projects');
      };

      return (
        <ProjectDetail
          project={activeProject}
          onBack={handleSmartBack}
          onUpdate={p => setProjects(prev => prev.map(old => old.id === p.id ? p : old))}
          activeTasks={activeTasks}
          onStartWeeklyReport={(type) => {
            if (type && type !== 'manual') {
              handleRunWeeklyReportTask(activeProject, type).then(() => {
                navigate('project_detail', activeProject.id, 'reports');
              });
            }
          }}
          Maps={navigate}
          initialView={(route.subView as any) || 'logs'}
          onSetAiStatus={setAiStatus}
        />
      );
    }

    switch (route.view) {
      case 'dashboard': return <Dashboard projects={projects} resources={resources} navigate={navigate} />;
      case 'projects': return (
        <div className="space-y-4 animate-reveal">
          <header className="flex justify-between items-center px-4">
            <h2 className={`text-xl font-black uppercase tracking-tighter ${activeTheme.type === 'light' ? 'text-slate-800' : 'text-white'}`}>{t('projects.title')}</h2>
            <div className="flex gap-2">
              <button onClick={openAddProject} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition-all active:scale-95">{t('projects.newProject')}</button>
            </div>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4">
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                activeTheme={activeTheme}
                onNavigate={(id) => navigate('project_detail', id)}
                onDelete={confirmDelete}
                onReorder={handleReorderProjects}
              />
            ))}
          </div>
        </div>
      );
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
      case 'industry_trends': return <TrendsRadar />;
      case 'characterization_hub': return (
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <CharacterizationHub initialMode={route.projectId as any} initialRecordId={route.subView} />
        </div>
      );
      case 'assistant': return null; // AIAssistant 始终挂载，不在 switch 中渲染
      case 'video_lab': return <VideoLab />;
      case 'research_farm': return <ResearchFarm />;
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
    </>
  );
};

export default AppRouter;
