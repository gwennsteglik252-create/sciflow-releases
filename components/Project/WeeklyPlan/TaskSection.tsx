
import React, { useRef, useState, useMemo } from 'react';
import { WeeklyTask, PlanType } from '../../../types';
import { TaskBacklog } from './TaskBacklog';
import { TaskItem } from './TaskItem';
import { DailyFocus } from './DailyFocus';
import { TaskSectionHeader } from './TaskSectionHeader';

interface TaskSectionProps {
  activePlanType: PlanType;
  tasks: WeeklyTask[];
  planStartDate: string;
  dailyLogs?: string[];
  isArchived: boolean;
  isAddingTask: boolean;
  setIsAddingTask: (val: boolean) => void;
  newTaskInput: string;
  setNewTaskInput: (val: string) => void;
  onUpdateTasks: (newTasks: WeeklyTask[]) => void;
  onUpdateDailyLog?: (dayIndex: number, content: string) => void;
  onSmartAssign?: (isReschedule?: boolean) => void;
  onClearAssign?: () => void;
  todayIdx?: number;
  isAiLoading?: boolean;
  onToggleFocus?: () => void;
  onViewText?: () => void;
  isFocused?: boolean;
  onTracePlan?: (planId: string) => void;
  onTraceLog?: (logId: string) => void;
  onTraceDoe?: (doeId: string) => void;
  highlightedTaskId?: string | null;
  onExpandPanorama?: () => void;
  onExpandBacklog?: () => void;
  onMoveTaskToNextWeek?: (taskGlobalIdx: number) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const TaskSection: React.FC<TaskSectionProps> = ({
  activePlanType, tasks, planStartDate, dailyLogs, isArchived, isAddingTask, setIsAddingTask, newTaskInput, setNewTaskInput, onUpdateTasks, onUpdateDailyLog, onSmartAssign, onClearAssign, todayIdx = -1, isAiLoading,
  onToggleFocus, onViewText, isFocused, onTracePlan, onTraceLog, onTraceDoe, highlightedTaskId,
  onExpandPanorama, onExpandBacklog, onMoveTaskToNextWeek
}) => {
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
  const [openMemberPickerIdx, setOpenMemberPickerIdx] = useState<number | null>(null);
  const [confirmingDeleteIdx, setConfirmingDeleteIdx] = useState<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const memberPickerRef = useRef<HTMLDivElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);

  const unassignedCount = useMemo(() => tasks.filter(t => typeof t.assignedDay !== 'number' && t.status === 'pending').length, [tasks]);
  const hasAssignedTasks = useMemo(() => tasks.some(t => typeof t.assignedDay === 'number' && t.status === 'pending'), [tasks]);
  const hasOverdueTasks = useMemo(() => todayIdx !== -1 && tasks.some(t => typeof t.assignedDay === 'number' && t.assignedDay < todayIdx && t.status === 'pending'), [tasks, todayIdx]);

  const getCalendarDate = (dayIdx: number) => {
    if (!planStartDate) return "";
    const parts = planStartDate.split('-');
    if (parts.length !== 3) return planStartDate;
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + dayIdx);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const tasksByDayProjection = useMemo(() => {
    return DAYS.map((_, dayIdx) => {
      const directTasks = tasks.map((t, i) => ({ ...t, originalIdx: i })).filter(t => t.assignedDay === dayIdx);
      if (todayIdx === -1 || dayIdx !== todayIdx) return directTasks;
      const rolledOver = tasks.map((t, i) => ({ ...t, originalIdx: i })).filter(t => typeof t.assignedDay === 'number' && t.assignedDay < dayIdx && t.status === 'pending');
      return [...rolledOver, ...directTasks];
    });
  }, [tasks, todayIdx]);

  return (
    <div className="space-y-6 pb-20 overflow-visible relative">
      <TaskSectionHeader activePlanType={activePlanType} isArchived={isArchived} unassignedCount={unassignedCount} hasOverdueTasks={hasOverdueTasks} hasAssignedTasks={hasAssignedTasks} isAiLoading={isAiLoading} isFocused={isFocused} onToggleFocus={onToggleFocus} onViewText={onViewText} onSmartAssign={() => onSmartAssign?.(false)} onReschedule={() => onSmartAssign?.(true)} onClearAssign={onClearAssign} onAddTask={() => setIsAddingTask(true)} onExpandAssigned={onExpandPanorama} />

      <div className="flex flex-col lg:flex-row gap-6 min-h-0 overflow-visible relative">
        <TaskBacklog
          tasks={tasks}
          onUpdateTasks={onUpdateTasks}
          isArchived={isArchived}
          todayIdx={todayIdx}
          openPickerIdx={openPickerIdx}
          onOpenPicker={setOpenPickerIdx}
          pickerRef={pickerRef}
          openMemberPickerIdx={openMemberPickerIdx}
          onOpenMemberPicker={setOpenMemberPickerIdx}
          memberPickerRef={memberPickerRef}
          confirmingDeleteIdx={confirmingDeleteIdx}
          onConfirmDelete={setConfirmingDeleteIdx}
          deleteConfirmRef={deleteConfirmRef}
          onSmartAssign={() => onSmartAssign?.(false)}
          isAiLoading={isAiLoading}
          onTracePlan={onTracePlan}
          onTraceLog={onTraceLog}
          onTraceDoe={onTraceDoe}
          highlightedTaskId={highlightedTaskId}
          onExpand={onExpandBacklog}
          isAddingTask={isAddingTask}
          setIsAddingTask={setIsAddingTask}
          newTaskInput={newTaskInput}
          setNewTaskInput={setNewTaskInput}
          onMoveTaskToNextWeek={onMoveTaskToNextWeek}
        />
        <div className="flex-1 border-l border-slate-100 pl-0 lg:pl-6 overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-visible">
            {DAYS.map((day, dayIdx) => {
              const projectedTasks = tasksByDayProjection[dayIdx];
              return (
                <div key={day} className="flex flex-col bg-white rounded-2xl border border-slate-100 transition-all p-3 shadow-sm hover:border-indigo-100 relative h-fit min-h-[100px] overflow-visible hover:z-50">
                  <div className="flex justify-between items-center mb-2 px-1 shrink-0">
                    <div className="flex items-center gap-1.5"><span className={`text-[9px] font-black uppercase ${(dayIdx === 5 || dayIdx === 6) ? 'text-rose-400' : 'text-indigo-900'}`}>{day}</span><span className={`text-[8px] font-mono font-bold ${dayIdx === todayIdx ? 'text-indigo-600' : 'text-slate-400'}`}>({getCalendarDate(dayIdx)})</span></div>
                  </div>
                  <DailyFocus dayLog={dailyLogs?.[dayIdx]} dayIdx={dayIdx} isArchived={isArchived} onUpdateDailyLog={onUpdateDailyLog} />
                  <div className="space-y-2 mt-2 pr-1 flex-1 transition-all overflow-visible">
                    {projectedTasks.map((t) => <TaskItem key={`${t.originalIdx}-${dayIdx}`} task={t} globalIdx={t.originalIdx} isArchived={isArchived} todayIdx={todayIdx} currentDayIdx={dayIdx} onUpdateTasks={onUpdateTasks} allTasks={tasks} onOpenPicker={setOpenPickerIdx} isPickerOpen={openPickerIdx === t.originalIdx} pickerRef={pickerRef} onOpenMemberPicker={setOpenMemberPickerIdx} isMemberPickerOpen={openMemberPickerIdx === t.originalIdx} memberPickerRef={memberPickerRef} onConfirmDelete={setConfirmingDeleteIdx} isConfirmingDelete={confirmingDeleteIdx === t.originalIdx} deleteConfirmRef={deleteConfirmRef} onTracePlan={onTracePlan} onTraceLog={onTraceLog} onTraceDoe={onTraceDoe} highlightedTaskId={highlightedTaskId} onMoveTaskToNextWeek={() => onMoveTaskToNextWeek?.(t.originalIdx)} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
