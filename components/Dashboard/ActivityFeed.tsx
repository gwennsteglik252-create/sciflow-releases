
import React from 'react';
import { AppView } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

export interface ActivityItem {
  user: string;
  action: string;
  text: string;
  color: string;
  icon?: string;
  result?: 'success' | 'neutral' | 'failure' | 'observation' | 'info';
  projectId?: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLight: boolean;
  navigate?: (view: AppView, projectId?: string, subView?: string) => void;
}

const resultConfig: Record<string, { dot: string }> = {
  success: { dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' },
  failure: { dot: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]' },
  observation: { dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]' },
  neutral: { dot: 'bg-slate-400' },
  info: { dot: 'bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]' },
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, isLight, navigate }) => {
  const { t } = useTranslation();
  const handleClick = (activity: ActivityItem) => {
    if (navigate && activity.projectId) {
      navigate('project_detail', activity.projectId, 'logs');
    }
  };

  return (
    <div className={`h-full p-8 rounded-[2.5rem] flex flex-col overflow-hidden border ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
      <h4 className={`text-xs font-black mb-6 flex items-center gap-3 shrink-0 ${isLight ? 'text-slate-800' : 'text-white'}`}>
        <i className="fa-solid fa-satellite-dish text-indigo-600 animate-pulse"></i> {t('dashboard.recentActivity')}
      </h4>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar min-h-0">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40 py-8">
            <i className="fa-solid fa-satellite-dish text-2xl text-slate-400 mb-2"></i>
            <p className="text-[9px] text-slate-400 italic font-medium">{t('common.noData')}</p>
          </div>
        ) : (
          activities.map((activity, i) => {
            const rc = resultConfig[activity.result || 'info'];
            const iconClass = activity.icon || 'fa-flask';
            const isClickable = !!activity.projectId && !!navigate;
            return (
              <div
                key={i}
                onClick={() => handleClick(activity)}
                className={`flex gap-3 group rounded-2xl transition-all duration-150
                  ${isClickable
                    ? `cursor-pointer -mx-2 px-2 py-1.5 hover:${isLight ? 'bg-slate-50' : 'bg-white/5'}`
                    : ''}`}
              >
                {/* 左侧类型图标 */}
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-transform group-hover:scale-110
                  ${activity.result === 'success' ? 'bg-emerald-500/10' : activity.result === 'failure' ? 'bg-rose-500/10' : 'bg-indigo-500/10'}`}>
                  <i className={`fa-solid ${iconClass} text-[10px]
                    ${activity.result === 'success' ? 'text-emerald-500' : activity.result === 'failure' ? 'text-rose-400' : 'text-indigo-400'}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] leading-snug ${isLight ? 'text-slate-600' : 'text-slate-300'} ${isClickable ? 'group-hover:text-indigo-600 transition-colors' : ''}`}>
                    <span className={`font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{activity.user}</span>
                    {' '}{activity.action}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{activity.text}</p>
                    {activity.result && activity.result !== 'info' && (
                      <div className={`w-1.5 h-1.5 rounded-full ${rc.dot}`}></div>
                    )}
                    {isClickable && (
                      <i className="fa-solid fa-arrow-right text-[7px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 duration-150"></i>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;
