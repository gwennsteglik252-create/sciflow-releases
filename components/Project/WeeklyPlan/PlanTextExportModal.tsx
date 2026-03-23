
import React from 'react';
import { useProjectContext } from '../../../context/ProjectContext';
import { ProjectPlan, WeeklyGoal } from '../../../types';

interface PlanTextExportModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  plan: ProjectPlan;
  copyText: string;
}

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export const PlanTextExportModal: React.FC<PlanTextExportModalProps> = ({ 
  show, onClose, title, plan, copyText 
}) => {
  const { showToast } = useProjectContext();
  if (!show) return null;

  const renderDay = (dayIndex: number, label: string) => {
    const tasks = plan.tasks.filter(t => t.assignedDay === dayIndex);
    if (tasks.length === 0) return null;
    
    return (
        <div className="mb-6 break-inside-avoid">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-2 pb-1">{label}</h4>
            <ul className="space-y-2">
                {tasks.map((t, i) => {
                    const assignees = t.assignedTo ? ` (@${t.assignedTo.join(', ')})` : '';
                    return (
                        <li key={i} className="flex gap-2 items-start text-[10px] text-slate-700">
                            <div className={`mt-1 w-1.5 h-1.5 rounded-full border border-slate-300 shrink-0 ${t.status === 'completed' ? 'bg-slate-800 border-slate-800' : 'bg-white'}`}></div>
                            <span className={t.status === 'completed' ? 'line-through opacity-50' : ''}>
                                {t.title}<span className="text-[8px] text-indigo-400 font-bold ml-1">{assignees}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl h-[85vh] rounded-[3rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all active:scale-90"
        >
          <i className="fa-solid fa-times text-2xl"></i>
        </button>
        
        <header className="mb-6 shrink-0 border-l-8 border-indigo-600 pl-6">
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">
            计划清单预览
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            PLAN TEXT VIEW • EXPORTABLE FORMAT
          </p>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-[2rem] p-8 border border-slate-100 shadow-inner">
            <div className="max-w-2xl mx-auto bg-white p-8 shadow-sm rounded-xl min-h-full">
                <h1 className="text-2xl font-black text-slate-800 mb-2 text-center uppercase tracking-tighter italic">{title}</h1>
                <p className="text-[10px] text-slate-400 text-center font-mono mb-8 uppercase tracking-widest">{plan.startDate} — {plan.endDate}</p>
                
                {/* Goals */}
                {plan.goals && plan.goals.length > 0 && (
                    <div className="mb-8 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-bullseye"></i> 周期目标 (GOALS)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {plan.goals.map((g, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="text-indigo-300 text-[10px] font-black mt-0.5">•</span>
                                    <span className="text-[10px] font-bold text-slate-700 leading-snug">{typeof g === 'string' ? g : g.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    <div>
                        {DAYS.slice(0, 3).map((d, i) => renderDay(i, d))}
                    </div>
                    <div>
                        {DAYS.slice(3).map((d, i) => renderDay(i + 3, d))}
                    </div>
                </div>
                
                {/* Backlog */}
                {plan.tasks.some(t => t.assignedDay === undefined) && (
                    <div className="mt-8 pt-6 border-t border-dashed border-slate-200">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-box-archive"></i> 待办池 (BACKLOG)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {plan.tasks.filter(t => t.assignedDay === undefined).map((t, i) => (
                                <span key={i} className="px-2.5 py-1 bg-slate-50 rounded-lg text-[9px] font-medium text-slate-600 border border-slate-100">{t.title}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <footer className="mt-6 flex gap-3 shrink-0">
          <button 
            onClick={() => { 
              navigator.clipboard.writeText(copyText); 
              showToast({ message: '纯文本清单已复制', type: 'success' }); 
            }} 
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-copy"></i> 复制文本格式
          </button>
          <button 
            onClick={onClose} 
            className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase active:scale-95"
          >
            关闭
          </button>
        </footer>
      </div>
    </div>
  );
};
