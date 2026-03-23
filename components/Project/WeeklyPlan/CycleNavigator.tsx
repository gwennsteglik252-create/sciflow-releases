import React from 'react';
import { ProjectPlan } from '../../../types';

interface CycleNavigatorProps {
  filteredTypePlans: ProjectPlan[];
  activePlanId: string;
  onViewWeek: (id: string | null) => void;
  onDeletePlan?: (id: string) => void;
  onStartNextCycle?: (currentPlan: ProjectPlan) => void;
  activePlan: ProjectPlan;
}

export const CycleNavigator: React.FC<CycleNavigatorProps> = ({
  filteredTypePlans, activePlanId, onViewWeek, onDeletePlan, onStartNextCycle, activePlan
}) => {
  // 确保按时间降序排列 (W3 -> W2 -> W1)，让最新的排在最左边
  const displayPlans = [...filteredTypePlans].sort((a, b) => 
    new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <div className="w-full bg-white/60 backdrop-blur-md border-b border-slate-100 px-6 py-5 mb-6 shrink-0 z-30 flex items-center justify-between gap-4">
      <div className="flex items-center gap-0 overflow-x-auto no-scrollbar py-2 flex-1 relative">
        {/* Title and Icon */}
        <div className="flex flex-col items-center gap-2 pr-6 mr-6 border-r border-slate-200 shrink-0 relative z-20">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
            <i className="fa-solid fa-clock-rotate-left text-xs"></i>
          </div>
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">周期演进</span>
        </div>
        
        {/* Timeline Path Layer */}
        {displayPlans.length > 1 && (
            <div className="absolute top-[34px] left-[110px] right-[40px] h-[2px] bg-slate-100 z-0">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-slate-100 to-slate-100"></div>
            </div>
        )}

        <div className="flex items-center gap-8 z-10">
            {displayPlans.length > 0 ? (
              displayPlans.map((p, idx) => {
                const isActive = activePlanId === p.id;
                const isCompleted = p.status === 'completed';
                const seqNum = displayPlans.length - idx;
                
                return (
                  <div key={p.id} className="flex flex-col items-center gap-2 shrink-0 group relative">
                    {/* Connection Line segment for better visual continuity */}
                    {idx < displayPlans.length - 1 && (
                        <div className="absolute top-[18px] left-[calc(100%+8px)] w-8 h-[2px] border-t-2 border-dashed border-slate-200 pointer-events-none group-hover:border-indigo-200 transition-colors"></div>
                    )}

                    <div className="relative">
                        <button 
                            onClick={() => onViewWeek(p.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 transition-all duration-500 ${
                                isActive 
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)] scale-110 z-20 ring-4 ring-indigo-50' 
                                : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50 z-10'
                            }`}
                        >
                            {isCompleted ? (
                                <i className={`fa-solid fa-circle-check text-[10px] ${isActive ? 'text-white' : 'text-emerald-500'}`}></i>
                            ) : (
                                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse shadow-[0_0_8px_#fff]' : 'bg-indigo-400 opacity-60'}`}></div>
                            )}
                            <span className="text-[11px] font-black uppercase tracking-widest font-mono">
                                {p.type === 'weekly' ? `W${seqNum}` : p.type === 'monthly' ? `M${seqNum}` : `Y${seqNum}`}
                            </span>
                            
                            {isActive && !p.id.startsWith('draft_') && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeletePlan?.(p.id); }} 
                                    className="ml-1 opacity-60 hover:opacity-100 hover:text-rose-200 transition-colors"
                                    title="删除此周期"
                                >
                                    <i className="fa-solid fa-trash-can text-[9px]"></i>
                                </button>
                            )}
                        </button>
                    </div>

                    {/* Meta info below the node */}
                    <div className={`flex flex-col items-center gap-0.5 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}>
                        <span className={`text-[8px] font-black font-mono tracking-tighter ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {p.startDate.substring(5)} — {p.endDate.substring(5)}
                        </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <span className="text-[10px] text-slate-300 italic px-4">建立第一个研究周期以开启时间轴追踪</span>
            )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 relative z-20">
        <div className="h-10 w-[1.5px] bg-slate-100 hidden lg:block"></div>
        <button 
          onClick={() => onStartNextCycle?.(activePlan)}
          className="px-6 py-3 bg-emerald-600 text-white border-2 border-white/20 rounded-2xl text-[10px] font-black uppercase shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] hover:bg-black hover:shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 group"
        >
          <i className="fa-solid fa-calendar-plus text-xs group-hover:rotate-12 transition-transform"></i>
          开启下个周期
        </button>
      </div>
    </div>
  );
};
