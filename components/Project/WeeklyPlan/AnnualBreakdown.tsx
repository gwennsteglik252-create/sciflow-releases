
import React, { useState } from 'react';
import { AnnualBreakdownItem, BreakdownTask } from '../../../types';

interface AnnualBreakdownProps {
  breakdown: AnnualBreakdownItem[];
  isArchived: boolean;
  onUpdateBreakdown: (newBreakdown: AnnualBreakdownItem[]) => void;
  onEnterMonth: (month: number) => void;
  onToggleFocus?: () => void;
  isFocused?: boolean;
}

const MONTH_THEMES = [
  // Q1 (Spring)
  { name: 'Jan', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', activeBorder: 'border-indigo-400', shadow: 'shadow-indigo-100', progress: 'bg-indigo-500' },
  { name: 'Feb', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', activeBorder: 'border-indigo-400', shadow: 'shadow-indigo-100', progress: 'bg-indigo-500' },
  { name: 'Mar', bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', activeBorder: 'border-indigo-400', shadow: 'shadow-indigo-100', progress: 'bg-indigo-500' },
  // Q2 (Summer)
  { name: 'Apr', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', activeBorder: 'border-emerald-400', shadow: 'shadow-emerald-100', progress: 'bg-emerald-500' },
  { name: 'May', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', activeBorder: 'border-emerald-400', shadow: 'shadow-emerald-100', progress: 'bg-emerald-500' },
  { name: 'Jun', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', activeBorder: 'border-emerald-400', shadow: 'shadow-emerald-100', progress: 'bg-emerald-500' },
  // Q3 (Autumn)
  { name: 'Jul', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', activeBorder: 'border-amber-400', shadow: 'shadow-amber-100', progress: 'bg-amber-500' },
  { name: 'Aug', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', activeBorder: 'border-amber-400', shadow: 'shadow-amber-100', progress: 'bg-amber-500' },
  { name: 'Sep', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', activeBorder: 'border-amber-400', shadow: 'shadow-amber-100', progress: 'bg-amber-500' },
  // Q4 (Winter)
  { name: 'Oct', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', activeBorder: 'border-rose-400', shadow: 'shadow-rose-100', progress: 'bg-rose-500' },
  { name: 'Nov', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', activeBorder: 'border-rose-400', shadow: 'shadow-rose-100', progress: 'bg-rose-500' },
  { name: 'Dec', bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', activeBorder: 'border-rose-400', shadow: 'shadow-rose-100', progress: 'bg-rose-500' },
];

export const AnnualBreakdown: React.FC<AnnualBreakdownProps> = ({
  breakdown, isArchived, onUpdateBreakdown, onEnterMonth, onToggleFocus, isFocused
}) => {
  const [newKRInput, setNewKRInput] = useState<{ [month: number]: string }>({});

  // Ensure we always have 12 months initialized
  const months = React.useMemo(() => {
      const items = [...(breakdown || [])];
      for (let i = 1; i <= 12; i++) {
          if (!items.find(m => m.month === i)) {
              items.push({ month: i, focus: '', status: 'pending', keyResults: [] });
          }
      }
      return items.sort((a, b) => a.month - b.month);
  }, [breakdown]);

  const updateMonth = (monthNum: number, field: keyof AnnualBreakdownItem, value: any) => {
      if (isArchived) return;
      const next = months.map(m => m.month === monthNum ? { ...m, [field]: value } : m);
      onUpdateBreakdown(next);
  };

  const handleAddKR = (monthNum: number) => {
      const content = newKRInput[monthNum];
      if (!content || !content.trim()) return;
      
      const monthItem = months.find(m => m.month === monthNum);
      if (!monthItem) return;

      const newKR: BreakdownTask = {
          id: `kr_${Date.now()}_${Math.random()}`,
          content: content.trim(),
          done: false
      };
      
      const newKRs = [...(monthItem.keyResults || []), newKR];
      updateMonth(monthNum, 'keyResults', newKRs);
      setNewKRInput(prev => ({ ...prev, [monthNum]: '' }));
  };

  const handleToggleKR = (monthNum: number, krId: string) => {
      const monthItem = months.find(m => m.month === monthNum);
      if (!monthItem || !monthItem.keyResults) return;
      
      const newKRs = monthItem.keyResults.map(t => t.id === krId ? { ...t, done: !t.done } : t);
      updateMonth(monthNum, 'keyResults', newKRs);
  };

  const handleUpdateKR = (monthNum: number, krId: string, newContent: string) => {
      const monthItem = months.find(m => m.month === monthNum);
      if (!monthItem || !monthItem.keyResults) return;
      
      const newKRs = monthItem.keyResults.map(t => t.id === krId ? { ...t, content: newContent } : t);
      updateMonth(monthNum, 'keyResults', newKRs);
  };

  const handleDeleteKR = (monthNum: number, krId: string) => {
      const monthItem = months.find(m => m.month === monthNum);
      if (!monthItem || !monthItem.keyResults) return;
      
      const newKRs = monthItem.keyResults.filter(t => t.id !== krId);
      updateMonth(monthNum, 'keyResults', newKRs);
  };
  
  // Auto-resize helper
  const adjustHeight = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      target.style.height = 'auto';
      target.style.height = `${target.scrollHeight}px`;
  };

  return (
    <div className="mb-8 animate-reveal">
       <div className="flex justify-between items-center mb-6 px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg text-white">
              <i className="fa-solid fa-map-location-dot text-xs"></i>
            </div>
            <div>
                <div className="flex items-center gap-3">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest leading-none">年度战略月度规划 (12-MONTH ROADMAP)</h4>
                    {onToggleFocus && (
                        <button 
                          onClick={onToggleFocus}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-90 border ${isFocused ? 'bg-white text-indigo-600 border-indigo-200' : 'bg-white text-indigo-200 border-slate-100 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200'}`}
                          title={isFocused ? "恢复正常布局 (Restore)" : "扩充至全面板 (Expand)"}
                        >
                          <i className={`fa-solid ${isFocused ? 'fa-minimize' : 'fa-maximize'} text-[10px]`}></i>
                        </button>
                    )}
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Objectives & Key Results (OKR)</p>
            </div>
          </div>
       </div>
       
       <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 pb-10">
          {months.map((m, idx) => {
             const theme = MONTH_THEMES[idx % 12];
             const isCompleted = m.status === 'completed';
             const isInProgress = m.status === 'in-progress';
             const keyResults = m.keyResults || [];
             const progress = keyResults.length > 0 ? Math.round((keyResults.filter(k => k.done).length / keyResults.length) * 100) : 0;
             
             let containerClass = `relative p-6 rounded-[2rem] border-2 transition-all flex flex-col min-h-[300px] group overflow-hidden ${isArchived ? 'opacity-80' : 'hover:-translate-y-1 hover:shadow-xl'}`;
             
             if (isCompleted) {
                 containerClass += ` bg-emerald-500 border-emerald-400 shadow-emerald-200 shadow-lg text-white`;
             } else if (isInProgress) {
                 containerClass += ` bg-white ${theme.activeBorder} ${theme.shadow} shadow-2xl ring-4 ring-white/60`;
             } else {
                 containerClass += ` bg-white border-slate-100 text-slate-500 hover:border-slate-200`;
             }

             return (
             <div 
                key={m.month} 
                className={containerClass}
             >
                {/* Decorative Background Icon */}
                <div className={`absolute -top-4 -right-4 text-7xl opacity-[0.05] pointer-events-none rotate-12 ${isCompleted ? 'text-emerald-900' : theme.text} select-none`}>
                   <span className="font-black">{m.month}</span>
                </div>
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                   <div className="flex flex-col">
                       <span className={`text-xl font-black uppercase tracking-tighter ${isCompleted ? 'text-white' : theme.text}`}>
                           {m.month}月
                       </span>
                       <span className={`text-[8px] font-bold uppercase tracking-widest ${isCompleted ? 'text-emerald-100' : 'text-slate-400'}`}>
                           {theme.name}
                       </span>
                   </div>
                   
                   <div className="flex items-center gap-1">
                       <button 
                         onClick={(e) => { e.stopPropagation(); onEnterMonth(m.month); }}
                         className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 bg-white text-indigo-500 hover:bg-indigo-600 hover:text-white border border-indigo-100`}
                         title="进入月度详情"
                       >
                          <i className="fa-solid fa-arrow-right-to-bracket text-[10px]"></i>
                       </button>

                       <button 
                         disabled={isArchived}
                         onClick={() => {
                            const states: AnnualBreakdownItem['status'][] = ['pending', 'in-progress', 'completed'];
                            const nextState = states[(states.indexOf(m.status) + 1) % 3];
                            updateMonth(m.month, 'status', nextState);
                         }}
                         className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-sm ${
                             isCompleted 
                              ? 'bg-white/20 border-white text-white hover:bg-white hover:text-emerald-600' 
                              : isInProgress
                                  ? `bg-white ${theme.border} ${theme.text} animate-pulse`
                                  : 'bg-slate-50 border-slate-100 text-slate-300 hover:bg-slate-100 hover:text-slate-400'
                         } ${isArchived ? 'cursor-default' : 'cursor-pointer active:scale-90'}`}
                         title={`Status: ${m.status}`}
                       >
                          {isCompleted ? <i className="fa-solid fa-check text-[10px]"></i> : <i className={`fa-solid fa-arrow-right text-[10px] ${isInProgress ? '' : 'opacity-50'}`}></i>}
                       </button>
                   </div>
                </div>
                
                {/* Strategic Focus */}
                <div className={`mb-3 relative z-10 ${isInProgress ? 'bg-slate-50/50 p-2 rounded-xl -mx-2' : ''}`}>
                    <label className={`text-[7px] font-black uppercase mb-1 block ${isCompleted ? 'text-emerald-200' : 'text-slate-300'}`}>Strategic Focus</label>
                    <textarea 
                        className={`w-full bg-transparent resize-none text-[10px] font-black outline-none h-16 leading-relaxed placeholder:text-slate-300 custom-scrollbar ${isCompleted ? 'text-emerald-50 placeholder:text-emerald-200/50' : 'text-slate-700'}`}
                        placeholder="定义月度核心战略目标..."
                        value={m.focus}
                        onChange={(e) => updateMonth(m.month, 'focus', e.target.value)}
                        disabled={isArchived}
                    />
                </div>
                
                {/* Key Results Checklist */}
                <div className="flex-1 flex flex-col min-h-0 relative z-10 bg-white/50 rounded-xl p-2 -mx-2 border border-transparent transition-colors hover:bg-white/80 hover:border-black/5">
                    <label className={`text-[7px] font-black uppercase mb-2 block px-1 ${isCompleted ? 'text-emerald-200' : 'text-slate-300'}`}>Key Results (KR)</label>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2 mb-2">
                        {keyResults.map((kr) => (
                            <div key={kr.id} className="flex items-start gap-2 group/task">
                                <input 
                                  type="checkbox" 
                                  checked={kr.done} 
                                  onChange={() => handleToggleKR(m.month, kr.id)}
                                  disabled={isArchived}
                                  className={`mt-0.5 w-3 h-3 rounded border-2 cursor-pointer shrink-0 ${isCompleted ? 'accent-white' : 'accent-indigo-600'}`}
                                />
                                <div className="flex-1 min-w-0">
                                   <textarea
                                      rows={1}
                                      className={`w-full bg-transparent outline-none resize-none overflow-hidden text-[9px] font-medium leading-snug break-words border-b border-transparent focus:border-indigo-300/50 transition-colors p-0 ${kr.done ? (isCompleted ? 'text-emerald-200 line-through' : 'text-slate-400 line-through') : (isCompleted ? 'text-white' : 'text-slate-600')}`}
                                      value={kr.content}
                                      onChange={(e) => {
                                          handleUpdateKR(m.month, kr.id, e.target.value);
                                          adjustHeight(e);
                                      }}
                                      onFocus={(e) => adjustHeight(e)}
                                      ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                      disabled={isArchived}
                                  />
                                </div>
                                {!isArchived && (
                                  <button onClick={() => handleDeleteKR(m.month, kr.id)} className={`opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0 ${isCompleted ? 'text-emerald-200 hover:text-white' : 'text-rose-300 hover:text-rose-500'}`}>
                                      <i className="fa-solid fa-times text-[8px]"></i>
                                  </button>
                                )}
                            </div>
                        ))}
                        {keyResults.length === 0 && (
                            <div className={`text-[8px] text-center italic mt-2 ${isCompleted ? 'text-emerald-200' : 'text-slate-300'}`}>暂无关键成果</div>
                        )}
                    </div>
                    
                    {/* Add KR Input */}
                    {!isArchived && (
                        <div className={`flex items-center gap-2 mt-auto pt-2 border-t border-dashed ${isCompleted ? 'border-emerald-400/30' : 'border-slate-200'}`}>
                            <input 
                              className={`flex-1 bg-transparent text-[9px] font-bold outline-none ${isCompleted ? 'text-white placeholder:text-emerald-200' : 'text-slate-700 placeholder:text-slate-400'}`}
                              placeholder="+ Add KR..."
                              value={newKRInput[m.month] || ''}
                              onChange={(e) => setNewKRInput({...newKRInput, [m.month]: e.target.value})}
                              onKeyDown={(e) => {
                                  if(e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddKR(m.month);
                                  }
                              }}
                            />
                            <button 
                              onClick={() => handleAddKR(m.month)}
                              disabled={!newKRInput[m.month]}
                              className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all shadow-sm ${!newKRInput[m.month] ? 'opacity-30' : 'opacity-100'} ${isCompleted ? 'bg-white text-emerald-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                            >
                                <i className="fa-solid fa-plus text-[8px]"></i>
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Progress Bar */}
                {keyResults.length > 0 && (
                    <div className={`h-1.5 w-full rounded-full overflow-hidden mt-3 relative z-10 ${isCompleted ? 'bg-emerald-700' : 'bg-slate-100'}`}>
                        <div 
                          className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-white' : theme.progress}`} 
                          style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}
             </div>
          )})}
       </div>
    </div>
  );
};
