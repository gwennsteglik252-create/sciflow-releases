
import React from 'react';
import { WeeklyTask } from '../../../types';
import { TaskItem } from './TaskItem';

interface TaskBacklogProps {
  tasks: WeeklyTask[];
  onUpdateTasks: (next: WeeklyTask[]) => void;
  isArchived: boolean;
  todayIdx: number;
  openPickerIdx: number | null;
  onOpenPicker: (idx: number | null) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  openMemberPickerIdx: number | null;
  onOpenMemberPicker: (idx: number | null) => void;
  memberPickerRef: React.RefObject<HTMLDivElement | null>;
  confirmingDeleteIdx: number | null;
  onConfirmDelete: (idx: number | null) => void;
  deleteConfirmRef: React.RefObject<HTMLDivElement | null>;
  onSmartAssign?: () => void;
  isAiLoading?: boolean;
  onTracePlan?: (planId: string) => void;
  onTraceLog?: (logId: string) => void;
  onTraceDoe?: (doeId: string) => void;
  highlightedTaskId?: string | null;
  onExpand?: () => void;
  isAddingTask?: boolean;
  setIsAddingTask?: (val: boolean) => void;
  newTaskInput?: string;
  setNewTaskInput?: (val: string) => void;
  onMoveTaskToNextWeek?: (taskGlobalIdx: number) => void;
}

export const TaskBacklog: React.FC<TaskBacklogProps> = ({
  tasks, onUpdateTasks, isArchived, todayIdx,
  openPickerIdx, onOpenPicker, pickerRef,
  openMemberPickerIdx, onOpenMemberPicker, memberPickerRef,
  confirmingDeleteIdx, onConfirmDelete, deleteConfirmRef,
  onSmartAssign, isAiLoading, onTracePlan, onTraceLog, onTraceDoe, highlightedTaskId,
  onExpand,
  isAddingTask, setIsAddingTask, newTaskInput, setNewTaskInput,
  onMoveTaskToNextWeek
}) => {
  const unassignedTasks = tasks
    .map((t, idx) => ({ ...t, globalIdx: idx }))
    .filter(t => typeof t.assignedDay !== 'number');

  const handleAddTask = () => {
    if (!newTaskInput?.trim()) return;
    const newTask: WeeklyTask = {
      id: `task_backlog_${Date.now()}`,
      title: newTaskInput.trim(),
      status: 'pending',
      sourceType: 'manual'
    };
    onUpdateTasks([newTask, ...tasks]);
    setNewTaskInput?.('');
  };

  return (
    <div className="lg:w-1/3 flex flex-col gap-3 shrink-0 h-full min-h-0 transition-all z-10 relative has-[.z-\[6000\]]:z-[150]">
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">待办任务池 (BACKLOG)</span>
          {!isArchived && (
            <button
              onClick={() => setIsAddingTask?.(true)}
              className="w-5 h-5 rounded bg-indigo-600 text-white hover:bg-black transition-all flex items-center justify-center shadow-lg active:scale-90"
              title="新增待办任务"
            >
              <i className="fa-solid fa-plus text-[9px]"></i>
            </button>
          )}
          <button
            onClick={onExpand}
            className="w-5 h-5 rounded bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center shadow-xs"
            title="全景查看"
          >
            <i className="fa-solid fa-maximize text-[9px]"></i>
          </button>
        </div>
        <span className="bg-indigo-50 text-indigo-600 text-[8px] px-1.5 py-0.5 rounded-full font-bold">{unassignedTasks.length}</span>
      </div>

      {/* 关键修复点：增加 has-[.z-\[6000\]]:overflow-visible 确保弹出气泡不被裁剪 */}
      <div className="bg-white/50 rounded-2xl border-2 border-dashed border-indigo-200/50 p-2 flex-1 flex flex-col min-h-0 relative overflow-y-auto overflow-x-visible custom-scrollbar has-[.z-\[6000\]]:overflow-visible has-[.z-\[6000\]]:z-[100]">
        <div className="space-y-2 pb-2">
          {isAddingTask && (
            <div className="p-3 bg-white rounded-2xl border-2 border-indigo-400 shadow-xl animate-reveal mb-2 sticky top-0 z-[100]">
              <textarea
                autoFocus
                className="w-full bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none resize-none h-16 placeholder:text-slate-300"
                placeholder="输入新任务标题，按回车添加..."
                value={newTaskInput}
                onChange={e => setNewTaskInput?.(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTask();
                  }
                  if (e.key === 'Escape') setIsAddingTask?.(false);
                }}
              />
              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-50">
                <button onClick={() => setIsAddingTask?.(false)} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase">取消</button>
                <button onClick={handleAddTask} disabled={!newTaskInput?.trim()} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md disabled:opacity-30">确定添加</button>
              </div>
            </div>
          )}

          {unassignedTasks.map((t) => (
            <TaskItem
              key={t.globalIdx}
              task={t}
              globalIdx={t.globalIdx}
              isArchived={isArchived}
              isBacklogContext={true}
              todayIdx={todayIdx}
              onUpdateTasks={onUpdateTasks}
              allTasks={tasks}
              onOpenPicker={onOpenPicker}
              isPickerOpen={openPickerIdx === t.globalIdx}
              pickerRef={pickerRef}
              onOpenMemberPicker={onOpenMemberPicker}
              isMemberPickerOpen={openMemberPickerIdx === t.globalIdx}
              memberPickerRef={memberPickerRef}
              onConfirmDelete={onConfirmDelete}
              isConfirmingDelete={confirmingDeleteIdx === t.globalIdx}
              deleteConfirmRef={deleteConfirmRef}
              onTracePlan={onTracePlan}
              onTraceLog={onTraceLog}
              onTraceDoe={onTraceDoe}
              highlightedTaskId={highlightedTaskId}
              isCompact={false}
              onMoveTaskToNextWeek={() => onMoveTaskToNextWeek?.(t.globalIdx)}
            />
          ))}

          {unassignedTasks.length === 0 && !isAddingTask && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30 text-center">
              <i className="fa-solid fa-box-open text-2xl mb-2 text-indigo-300"></i>
              <p className="text-[9px] font-black uppercase">任务池已清空</p>
            </div>
          )}
        </div>
      </div>

      {unassignedTasks.length > 0 && !isArchived && !isAddingTask && (
        <div className="mt-2 shrink-0">
          <button
            onClick={onSmartAssign}
            disabled={isAiLoading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            {isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
            智能指派
          </button>
        </div>
      )}
    </div>
  );
};
