
import React from 'react';
import { AppView } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface ProjectInsightsProps {
  insight: any;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
}

const ProjectInsights: React.FC<ProjectInsightsProps> = ({ insight, navigate }) => {
  const { t } = useTranslation();
  if (!insight) return null;

  return (
    <div className="flex-[2] border-l border-dashed border-slate-100 pl-6 min-w-0 h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 py-1">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Progress: Spans full width */}
          <div className="col-span-full p-2 mb-2">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{t('dashboardWidgets.weekPlanProgress')}</p>
              <span className="text-xs font-black italic text-slate-800">{insight.weekProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: `${insight.weekProgress}%` }}></div>
            </div>
            <p className="text-[8px] text-slate-500 mt-1.5 font-bold uppercase tracking-widest">TOTAL TASKS: {insight.taskCount}</p>
          </div>

          {/* Today's Tasks */}
          <div className="flex flex-col h-52">
            <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2 px-1">
              <i className="fa-solid fa-calendar-check"></i> {t('dashboardWidgets.todayPlan')}
            </p>
            <div
              onClick={() => navigate('project_detail', insight.projectId, 'plan_board')}
              className="flex-1 p-4 rounded-3xl bg-emerald-50/20 border-2 border-dashed border-emerald-200 h-full flex flex-col justify-center shadow-sm cursor-pointer hover:bg-emerald-50/40 hover:border-emerald-300 transition-all group overflow-hidden"
            >
              {insight.todayTasks.length > 0 ? (
                <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1">
                  {insight.todayTasks.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
                      <p className="text-[9px] font-bold text-slate-700 leading-tight italic">{t.title}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-2 opacity-40">
                  <p className="text-[9px] text-slate-400 italic font-medium">{t('dashboardWidgets.noTodayTasks')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Backlog */}
          <div className="flex flex-col h-52">
            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2 px-1">
              <i className="fa-solid fa-clipboard-list"></i> {t('dashboardWidgets.backlog')}
            </p>
            <div
              onClick={() => navigate('project_detail', insight.projectId, 'plan_board')}
              className="flex-1 p-4 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/20 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-all group h-full flex flex-col justify-center shadow-sm overflow-hidden"
            >
              <div className="space-y-1.5 max-h-full overflow-y-auto custom-scrollbar pr-1">
                {insight.pendingTasks.length > 0 ? (
                  insight.pendingTasks.map((task: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 group/task">
                      <div className="w-1 h-1 rounded-full bg-indigo-300 shrink-0 group-hover/task:bg-indigo-600 transition-colors"></div>
                      <p className="text-[9px] text-slate-700 truncate font-medium italic group-hover:text-indigo-600 transition-colors">{task}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 opacity-40">
                    <p className="text-[9px] text-slate-400 italic font-medium">{t('dashboardWidgets.noBacklog')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Node */}
          <div className="flex flex-col h-52">
            <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2 px-1">
              <i className="fa-solid fa-bullseye"></i> {t('dashboardWidgets.activeNode')}
            </p>
            <div className={`flex-1 p-4 rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/30 group hover:border-amber-300 transition-all cursor-pointer h-full flex flex-col justify-center shadow-sm overflow-hidden`} onClick={() => navigate('project_detail', insight.projectId)}>
              <h5 className="text-[11px] font-black text-slate-800 uppercase mb-1 leading-tight line-clamp-2 italic">{insight.nodeTitle}</h5>
              <p className="text-[9px] text-slate-600 font-medium italic line-clamp-3 leading-relaxed group-hover:text-slate-800 transition-colors">{insight.nodeHypothesis}</p>
            </div>
          </div>

          {/* Latest Log */}
          <div className="flex flex-col h-52">
            <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2 px-1">
              <i className="fa-solid fa-flask-vial"></i> {t('dashboardWidgets.latestLog')}
            </p>
            <div className="flex-1 p-4 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/10 group hover:bg-indigo-50 transition-all cursor-pointer h-full flex flex-col justify-center shadow-sm overflow-hidden" onClick={() => navigate('project_detail', insight.projectId, 'logs')}>
              {insight.latestLog ? (
                <>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[8px] font-black text-indigo-500 uppercase font-mono">{insight.latestLog.timestamp.split(' ')[0]}</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${insight.latestLog.result === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
                  </div>
                  <h6 className="text-[11px] font-black text-slate-800 truncate mb-1 uppercase">{insight.latestLog.content}</h6>
                  <p className="text-[9px] text-slate-600 italic line-clamp-3 leading-relaxed">{insight.latestLog.description}</p>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-2 opacity-40">
                  <p className="text-[9px] text-slate-400 italic font-medium">{t('dashboardWidgets.noExperimentData')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectInsights;
