
import React, { useState, useEffect, useRef } from 'react';
import { WeeklyBreakdownItem, BreakdownTask } from '../../../types';

interface MonthlyBreakdownProps {
  breakdown: WeeklyBreakdownItem[];
  isArchived: boolean;
  onUpdateBreakdown: (newBreakdown: WeeklyBreakdownItem[]) => void;
  onEnterWeek: (week: number) => void;
  onToggleFocus?: () => void;
  isFocused?: boolean;
}

const WEEK_THEMES = [
  { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', activeBorder: 'border-blue-400', shadow: 'shadow-blue-100', progress: 'bg-blue-500' },
  { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-600', activeBorder: 'border-violet-400', shadow: 'shadow-violet-100', progress: 'bg-violet-500' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-100', text: 'text-fuchsia-600', activeBorder: 'border-fuchsia-400', shadow: 'shadow-fuchsia-100', progress: 'bg-fuchsia-500' },
  { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', activeBorder: 'border-rose-400', shadow: 'shadow-rose-100', progress: 'bg-rose-500' },
];

export const MonthlyBreakdown: React.FC<MonthlyBreakdownProps> = ({
  breakdown, isArchived, onUpdateBreakdown, onEnterWeek, onToggleFocus, isFocused
}) => {
  const [newTaskInput, setNewTaskInput] = useState<{ [week: number]: string }>({});

  // Ensure we always have 4 weeks initialized
  const weeks = React.useMemo(() => {
      const items = [...(breakdown || [])];
      for (let i = 1; i <= 4; i++) {
          if (!items.find(w => w.week === i)) {
              items.push({ week: i, focus: '', status: 'pending', tasks: [] });
          }
      }
      return items.sort((a, b) => a.week - b.week);
  }, [breakdown]);

  const updateWeek = (weekNum: number, field: keyof WeeklyBreakdownItem, value: any) => {
      if (isArchived) return;
      const next = weeks.map(w => w.week === weekNum ? { ...w, [field]: value } : w);
      onUpdateBreakdown(next);
  };

  const handleAddTask = (weekNum: number) => {
      const content = newTaskInput[weekNum];
      if (!content || !content.trim()) return;
      
      const weekItem = weeks.find(w => w.week === weekNum);
      if (!weekItem) return;

      const newTask: BreakdownTask = {
          id: `task_${Date.now()}_${Math.random()}`,
          content: content.trim(),
          done: false
      };
      
      const newTasks = [...(weekItem.tasks || []), newTask];
      updateWeek(weekNum, 'tasks', newTasks);
      setNewTaskInput(prev => ({ ...prev, [weekNum]: '' }));
  };

  const handleToggleTask = (weekNum: number, taskId: string) => {
      const weekItem = weeks.find(w => w.week === weekNum);
      if (!weekItem || !weekItem.tasks) return;
      
      const newTasks = weekItem.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
      updateWeek(weekNum, 'tasks', newTasks);
  };

  const handleUpdateTask = (weekNum: number, taskId: string, newContent: string) => {
      const weekItem = weeks.find(w => w.week === weekNum);
      if (!weekItem || !weekItem.tasks) return;
      
      const newTasks = weekItem.tasks.map(t => t.id === taskId ? { ...t, content: newContent } : t);
      updateWeek(weekNum, 'tasks', newTasks);
  };

  const handleDeleteTask = (weekNum: number, taskId: string) => {
      const weekItem = weeks.find(w => w.week === weekNum);
      if (!weekItem || !weekItem.tasks) return;
      
      const newTasks = weekItem.tasks.filter(t => t.id !== taskId);
      updateWeek(weekNum, 'tasks', newTasks);
  };

  // Helper for auto-resizing textarea
  const adjustHeight = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight}px`;
  };

  return (
    <div className="mb-8 animate-reveal">
       <div className="flex justify-between items-center mb-4 px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md">
              <i className="fa-solid fa-timeline text-white text-[10px]"></i>
            </div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">月度进程拆解 (WEEKLY BREAKDOWN)</h4>
            {onToggleFocus && (
                <button 
                  onClick={onToggleFocus}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-90 border ml-2 ${isFocused ? 'bg-white text-indigo-600 border-indigo-200' : 'bg-white text-indigo-200 border-slate-100 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200'}`}
                  title={isFocused ? "恢复正常布局 (Restore)" : "扩充至全面板 (Expand)"}
                >
                  <i className={`fa-solid ${isFocused ? 'fa-minimize' : 'fa-maximize'} text-[10px]`}></i>
                </button>
            )}
          </div>
       </div>
       
       <div className="p-1.5 rounded-[2rem] border-2 border-dashed border-slate-200/60 bg-slate-50/50">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-2">
            {weeks.map((week, idx) => {
               const theme = WEEK_THEMES[idx % WEEK_THEMES.length];
               const isCompleted = week.status === 'completed';
               const isInProgress = week.status === 'in-progress';
               const tasks = week.tasks || [];
               const progress = tasks.length > 0 ? Math.round((tasks.filter(t => t.done).length / tasks.length) * 100) : 0;
               
               let containerClass = `relative p-5 rounded-[1.5rem] border-2 transition-all flex flex-col min-h-[240px] group overflow-hidden ${isArchived ? 'opacity-80' : 'hover:-translate-y-1 hover:shadow-lg'}`;
               
               if (isCompleted) {
                   containerClass += ` bg-emerald-500 border-emerald-400 shadow-emerald-200 shadow-md text-white`;
               } else if (isInProgress) {
                   containerClass += ` bg-white ${theme.activeBorder} ${theme.shadow} shadow-lg ring-4 ring-white/50`;
               } else {
                   containerClass += ` bg-white border-slate-100 text-slate-500 hover:border-slate-200`;
               }

               return (
               <div 
                  key={week.week} 
                  className={containerClass}
               >
                  {/* Decorative Background Icon */}
                  {!isCompleted && (
                      <div className={`absolute -bottom-6 -right-4 text-8xl opacity-[0.07] pointer-events-none rotate-12 ${theme.text} select-none`}>
                          <span className="font-black">{week.week}</span>
                      </div>
                  )}
                  {isCompleted && (
                      <div className="absolute -bottom-4 -right-4 text-7xl opacity-20 pointer-events-none rotate-12 text-emerald-900 select-none">
                          <i className="fa-solid fa-check"></i>
                      </div>
                  )}

                  <div className="flex justify-between items-start mb-3 relative z-10">
                     <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm border ${
                         isCompleted 
                            ? 'bg-emerald-600 border-emerald-500 text-white' 
                            : isInProgress
                                ? `${theme.bg} ${theme.border} ${theme.text}`
                                : 'bg-slate-50 border-slate-100 text-slate-400'
                     }`}>
                         Week 0{week.week}
                     </span>
                     
                     <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEnterWeek(week.week); }}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center transition-all shadow-sm bg-white hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ${isCompleted ? 'text-emerald-500 border-emerald-200' : 'text-slate-400 border-slate-200'}`}
                            title="进入周计划详情"
                        >
                            <i className="fa-solid fa-arrow-right-to-bracket text-[10px]"></i>
                        </button>
                         <button 
                           disabled={isArchived}
                           onClick={() => {
                              const states: WeeklyBreakdownItem['status'][] = ['pending', 'in-progress', 'completed'];
                              const nextState = states[(states.indexOf(week.status) + 1) % 3];
                              updateWeek(week.week, 'status', nextState);
                           }}
                           className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
                               isCompleted 
                                ? 'bg-white border-white text-emerald-500' 
                                : isInProgress
                                    ? 'bg-white border-slate-100 text-indigo-500 animate-pulse ring-2 ring-indigo-50'
                                    : 'bg-slate-50 border-slate-200 text-slate-300 hover:bg-white hover:text-slate-400'
                           } ${isArchived ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
                           title={`Status: ${week.status}`}
                         >
                            {isCompleted ? <i className="fa-solid fa-check text-[10px]"></i> : <i className={`fa-solid fa-arrow-right text-[10px] ${isInProgress ? '' : 'opacity-50'}`}></i>}
                         </button>
                     </div>
                  </div>
                  
                  {/* Focus Area */}
                  <textarea 
                      className={`w-full bg-transparent resize-none text-[10px] font-bold outline-none h-12 leading-relaxed placeholder:text-slate-300 relative z-10 custom-scrollbar mb-3 border-b border-dashed ${isCompleted ? 'text-emerald-50 placeholder:text-emerald-200/50 border-emerald-400/50' : 'text-slate-700 border-slate-100'}`}
                      placeholder={isCompleted ? "本周目标已达成" : "本周核心重心 (Key Focus)..."}
                      value={week.focus}
                      onChange={(e) => updateWeek(week.week, 'focus', e.target.value)}
                      disabled={isArchived}
                  />
                  
                  {/* Task List */}
                  <div className="flex-1 flex flex-col min-h-0 relative z-10">
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5 mb-2">
                          {tasks.map((task) => (
                              <div key={task.id} className="flex items-start gap-2 group/task min-h-[20px]">
                                  <input 
                                    type="checkbox" 
                                    checked={task.done} 
                                    onChange={() => handleToggleTask(week.week, task.id)}
                                    disabled={isArchived}
                                    className={`mt-0.5 w-3.5 h-3.5 rounded border-2 cursor-pointer shrink-0 ${isCompleted ? 'accent-white' : 'accent-indigo-500'}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <textarea
                                        rows={1}
                                        className={`w-full bg-transparent outline-none resize-none overflow-hidden text-[9px] leading-snug break-words border-b border-transparent focus:border-indigo-300/50 transition-colors p-0 ${task.done ? (isCompleted ? 'text-emerald-200 line-through' : 'text-slate-400 line-through') : (isCompleted ? 'text-white' : 'text-slate-600')}`}
                                        value={task.content}
                                        onChange={(e) => {
                                            handleUpdateTask(week.week, task.id, e.target.value);
                                            adjustHeight(e);
                                        }}
                                        onFocus={(e) => adjustHeight(e)}
                                        ref={(el) => {
                                            if (el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }
                                        }}
                                        disabled={isArchived}
                                    />
                                  </div>
                                  {!isArchived && (
                                    <button onClick={() => handleDeleteTask(week.week, task.id)} className={`opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0 ${isCompleted ? 'text-emerald-200 hover:text-white' : 'text-rose-300 hover:text-rose-500'}`}>
                                        <i className="fa-solid fa-times text-[8px]"></i>
                                    </button>
                                  )}
                              </div>
                          ))}
                          {tasks.length === 0 && (
                              <div className={`text-[8px] text-center italic mt-2 ${isCompleted ? 'text-emerald-200' : 'text-slate-300'}`}>暂无具体任务</div>
                          )}
                      </div>
                      
                      {/* Add Task Input */}
                      {!isArchived && (
                          <div className="flex items-center gap-1 mt-auto pt-2 border-t border-dashed border-slate-100/50">
                              <input 
                                className={`flex-1 bg-transparent text-[9px] font-bold outline-none ${isCompleted ? 'text-white placeholder:text-emerald-200' : 'text-slate-700 placeholder:text-slate-300'}`}
                                placeholder="+ 添加交付物..."
                                value={newTaskInput[week.week] || ''}
                                onChange={(e) => setNewTaskInput({...newTaskInput, [week.week]: e.target.value})}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddTask(week.week);
                                    }
                                }}
                              />
                              <button 
                                onClick={() => handleAddTask(week.week)}
                                disabled={!newTaskInput[week.week]}
                                className={`w-5 h-5 rounded flex items-center justify-center transition-all ${!newTaskInput[week.week] ? 'opacity-30' : 'opacity-100'} ${isCompleted ? 'bg-white text-emerald-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                              >
                                  <i className="fa-solid fa-plus text-[8px]"></i>
                              </button>
                          </div>
                      )}
                  </div>
                  
                  {/* Progress Bar for Tasks */}
                  {tasks.length > 0 && (
                      <div className={`h-1 w-full rounded-full overflow-hidden mt-2 relative z-10 ${isCompleted ? 'bg-emerald-700' : 'bg-slate-100'}`}>
                          <div 
                            className={`h-full transition-all duration-500 ${isCompleted ? 'bg-white' : theme.progress}`} 
                            style={{ width: `${progress}%` }}
                          ></div>
                      </div>
                  )}

                  {isInProgress && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/50 z-0">
                          <div className={`h-full ${theme.progress} animate-[loading_2s_ease-in-out_infinite] w-1/3`}></div>
                      </div>
                  )}
               </div>
            )})}
         </div>
       </div>
       <style>{`
         @keyframes loading {
           0% { width: 0%; transform: translateX(0); }
           50% { width: 100%; transform: translateX(0); }
           100% { width: 0%; transform: translateX(100%); }
         }
       `}</style>
    </div>
  );
};
