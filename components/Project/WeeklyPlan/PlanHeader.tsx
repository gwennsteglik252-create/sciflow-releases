import React from 'react';
import { ProjectPlan, PlanType } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';

interface PlanHeaderProps {
  activePlanType: PlanType;
  setActivePlanType: (type: PlanType) => void;
  activePlan: ProjectPlan;
  dynamicTitle: string;
  isArchived: boolean;
  isAiLoading?: boolean;
  onGenerateWeeklyPlan?: (weekId: string, type: PlanType) => void;
  onUpdateDayStatus: (nextStatus: ('exp' | 'ana' | 'blocked' | 'idle')[]) => void;
  onUpdateDailyLog?: (dayIndex: number, content: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onToggleFocus?: () => void;
  onAddTask?: () => void;
  onBack?: () => void;
  onShowAlmanac?: () => void;
}

export const PlanHeader: React.FC<PlanHeaderProps> = ({
  activePlanType, setActivePlanType, activePlan, dynamicTitle, isArchived, isAiLoading,
  onGenerateWeeklyPlan, onUpdateDayStatus, onUpdateDailyLog, onPrev, onNext, hasPrev, hasNext,
  onToggleFocus, onAddTask, onBack, onShowAlmanac
}) => {
  const { returnPath } = useProjectContext();

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'exp': return { color: 'bg-emerald-500 border-emerald-600', label: 'Done', full: '已完成 (Completed)' };
      case 'ana': return { color: 'bg-indigo-500 border-indigo-600', label: 'Active', full: '进行中 (Active)' };
      case 'blocked': return { color: 'bg-rose-500 border-rose-600', label: 'Block', full: '阻塞 (Blocked)' };
      default: return { color: 'bg-slate-100 border-slate-200', label: 'Idle', full: '待定 (Idle)' };
    }
  };

  const planTypeStyles = {
    weekly: { bg: 'bg-indigo-600', text: 'text-indigo-600' },
    monthly: { bg: 'bg-violet-600', text: 'text-violet-600' },
    annual: { bg: 'bg-amber-600', text: 'text-amber-600' }
  };

  const periods = React.useMemo(() => {
    if (activePlanType === 'weekly') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else if (activePlanType === 'monthly') {
      return ['W1', 'W2', 'W3', 'W4'];
    } else {
      return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    }
  }, [activePlanType]);

  // Progress Ring Calculation
  const radius = 18;
  const stroke = 3;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, activePlan.completionRate)) / 100) * circumference;

  const isFromVirtualLab = returnPath?.includes('simulation');

  return (
    <header className="flex flex-col mb-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm shrink-0 items-center gap-6">
      {/* Row 1: Centered Title Cluster with absolute back button to preserve center */}
      <div className="flex items-center justify-center w-full relative min-h-[56px]">
        {isFromVirtualLab && onBack && (
          <div className="absolute left-0">
            <button
              onClick={onBack}
              className="bg-amber-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 border-2 border-white/20 animate-bounce-subtle shrink-0"
            >
              <i className="fa-solid fa-arrow-left-long"></i> 返回虚拟室
            </button>
          </div>
        )}

        <div className="flex items-center gap-5 shrink-0 min-w-0">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl transition-colors shrink-0 ${planTypeStyles[activePlanType].bg}`}>
            <i className={`fa-solid text-xl ${activePlanType === 'weekly' ? 'fa-calendar-week' : activePlanType === 'monthly' ? 'fa-calendar-days' : 'fa-calendar-check'}`}></i>
          </div>
          <div className="flex flex-col gap-1 min-w-0 items-center">
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                {(['weekly', 'monthly', 'annual'] as PlanType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setActivePlanType(t)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activePlanType === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t === 'weekly' ? '周' : t === 'monthly' ? '月' : '年'}
                  </button>
                ))}
              </div>
              <h3 className={`text-lg font-black uppercase italic leading-none truncate ${planTypeStyles[activePlanType].text}`}>
                {dynamicTitle}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20 transition-all active:scale-90 border border-slate-100"
                title="上一个周期"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic font-mono bg-slate-50 px-3 py-1 rounded-full border border-slate-100 shadow-inner">
                {activePlan.startDate} — {activePlan.endDate}
              </p>
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20 transition-all active:scale-90 border border-slate-100"
                title="下一个周期"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Dynamic Period Status bar - Centered */}
      <div className="flex flex-col lg:flex-row items-center justify-center w-full gap-8 pt-3 border-t border-slate-50/50">
        <div className="flex items-center gap-2.5 px-5 py-2.5 bg-slate-50 rounded-[2rem] border border-slate-100 relative shadow-inner z-10 overflow-visible shrink min-w-0">
          {periods.map((label, i) => {
            const currentStatus = activePlan.periodStatus?.[i] || 'idle';
            const info = getStatusInfo(currentStatus);
            const hasLog = activePlan.dailyLogs && activePlan.dailyLogs[i];

            return (
              <div key={`${i}-${currentStatus}`} className="relative group shrink-0">
                <button
                  disabled={isArchived}
                  onClick={() => {
                    const next = [...(activePlan.periodStatus || Array(periods.length).fill('idle'))];
                    const map: ('exp' | 'ana' | 'blocked' | 'idle')[] = ['exp', 'ana', 'blocked', 'idle'];
                    next[i] = map[(map.indexOf(next[i] as any) + 1) % 4];
                    onUpdateDayStatus(next as any);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isArchived || !onUpdateDailyLog) return;
                    const currentLog = activePlan.dailyLogs?.[i] || '';
                    const newLog = window.prompt(`编辑 ${label} 的日志/备注:`, currentLog);
                    if (newLog !== null) onUpdateDailyLog(i, newLog);
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 flex flex-col items-center justify-center transition-all active:scale-90 shadow-sm relative z-20 ${info.color} ${currentStatus !== 'idle' ? 'text-white' : 'text-slate-400'} ${isArchived ? 'cursor-default opacity-80' : 'hover:scale-110'}`}
                >
                  <span className="text-[8px] font-black uppercase leading-none pointer-events-none">{label}</span>
                  <span className="text-[7px] font-bold opacity-90 pointer-events-none">{info.label}</span>

                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-2xl z-[100] border border-white/10">
                    {info.full}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900"></div>
                  </div>
                </button>
                {hasLog && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white z-30 flex items-center justify-center pointer-events-none shadow-sm">
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-6 shrink-0">
          {/* Progress Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center group cursor-default" title={`完成率: ${activePlan.completionRate}%`}>
            <svg
              height={radius * 2}
              width={radius * 2}
              className="rotate-[-90deg] transform"
            >
              <circle
                stroke="#f1f5f9"
                strokeWidth={stroke}
                fill="transparent"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                className={`${planTypeStyles[activePlanType].text} transition-all duration-1000 ease-out`}
                stroke="currentColor"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset }}
                strokeLinecap="round"
                fill="transparent"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[9px] font-black ${planTypeStyles[activePlanType].text}`}>{activePlan.completionRate}%</span>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-100 hidden sm:block"></div>

          <button
            onClick={() => onGenerateWeeklyPlan?.(activePlan.id, activePlanType)}
            disabled={isAiLoading || isArchived}
            className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-40 flex items-center justify-center hover:bg-black transition-all`}
          >
            {isAiLoading ? <i className="fa-solid fa-spinner animate-spin mr-2"></i> : <i className="fa-solid fa-wand-magic-sparkles mr-2 text-[9px]"></i>}
            生成计划
          </button>

          {/* 黄历玄学按钮 - 仅周计划显示 */}
          {activePlanType === 'weekly' && (
            <button
              onClick={onShowAlmanac}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-red-700 text-white rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 flex items-center justify-center gap-1.5 hover:from-red-700 hover:to-amber-600 transition-all border border-amber-400/30"
              title="查看今日科研黄历"
            >
              <span className="text-[11px] leading-none">☯</span>
              今日黄历
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
