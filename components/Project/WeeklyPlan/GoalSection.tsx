
import React from 'react';
import { WeeklyGoal, PlanType } from '../../../types';

interface GoalSectionProps {
  activePlanType: PlanType;
  goals: (string | WeeklyGoal)[];
  isArchived: boolean;
  editingGoalIdx: number | null;
  setEditingGoalIdx: (idx: number | null) => void;
  goalInput: string;
  setGoalInput: (val: string) => void;
  onUpdateGoals: (newGoals: (string | WeeklyGoal)[]) => void;
}

export const GoalSection: React.FC<GoalSectionProps> = ({
  activePlanType, goals, isArchived, editingGoalIdx, setEditingGoalIdx, goalInput, setGoalInput, onUpdateGoals
}) => {
  const goalLabel = activePlanType === 'annual' ? 'ANNUAL GOAL' : activePlanType === 'monthly' ? 'MONTHLY GOAL' : 'WEEKLY GOAL';
  
  const handleAddGoal = () => {
    const nextId = `g_manual_${Date.now()}`;
    const nextGoals = [...goals, { id: nextId, text: '新研究目标...', completed: false }];
    onUpdateGoals(nextGoals);
    // 自动进入新目标的编辑模式
    setEditingGoalIdx(goals.length);
    setGoalInput('新研究目标...');
  };

  const handleRemoveGoal = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const nextGoals = goals.filter((_, i) => i !== index);
    onUpdateGoals(nextGoals);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      {goals.map((goal, idx) => {
        const goalText = typeof goal === 'string' ? goal : goal.text;
        const isCompleted = typeof goal === 'string' ? false : goal.completed;
        
        return (
          <div key={idx} className={`bg-white px-5 py-4 rounded-2xl border transition-all min-h-[90px] flex flex-col justify-center relative group ${isCompleted ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100 shadow-sm hover:border-indigo-200'}`}>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[7px] font-black uppercase tracking-widest ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                {goalLabel} 0{idx+1}
              </span>
              <div className="flex items-center gap-2">
                {!isArchived && (
                  <>
                    <button 
                      onClick={(e) => handleRemoveGoal(e, idx)}
                      className="w-4 h-4 rounded-full bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      title="删除目标"
                    >
                      <i className="fa-solid fa-times text-[8px]"></i>
                    </button>
                    <input 
                      type="checkbox" 
                      checked={isCompleted} 
                      onChange={() => {
                        const next = [...goals];
                        if (typeof next[idx] === 'string') next[idx] = { id: String(Date.now()), text: next[idx] as string, completed: true };
                        else (next[idx] as WeeklyGoal).completed = !(next[idx] as WeeklyGoal).completed;
                        onUpdateGoals(next);
                      }}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer" 
                    />
                  </>
                )}
              </div>
            </div>
            {editingGoalIdx === idx && !isArchived ? (
              <input 
                autoFocus 
                className="w-full bg-slate-50 rounded-lg p-1.5 text-[11px] font-black outline-none border border-indigo-100" 
                value={goalInput} 
                onChange={e => setGoalInput(e.target.value)} 
                onBlur={() => {
                  const next = [...goals];
                  if (typeof next[idx] === 'string') next[idx] = { id: String(Date.now()), text: goalInput, completed: false };
                  else (next[idx] as WeeklyGoal).text = goalInput;
                  onUpdateGoals(next);
                  setEditingGoalIdx(null);
                }}
                onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} 
              />
            ) : (
              <p 
                onClick={() => { if(!isArchived) { setEditingGoalIdx(idx); setGoalInput(goalText); } }} 
                className={`text-[11px] font-black leading-snug italic line-clamp-2 ${isCompleted ? 'text-emerald-700 line-through opacity-70' : 'text-slate-700'} ${!isArchived ? 'cursor-text' : ''}`}
              >
                {goalText}
              </p>
            )}
          </div>
        );
      })}

      {/* 添加新目标的交互占位卡片 */}
      {!isArchived && (
        <button 
          onClick={handleAddGoal}
          className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center py-4 text-slate-300 hover:border-indigo-300 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all min-h-[90px] group/add"
        >
          <i className="fa-solid fa-plus text-lg mb-1 group-hover/add:scale-110 transition-transform"></i>
          <span className="text-[8px] font-black uppercase tracking-widest">添加研究目标</span>
        </button>
      )}
    </div>
  );
};

export default GoalSection;
