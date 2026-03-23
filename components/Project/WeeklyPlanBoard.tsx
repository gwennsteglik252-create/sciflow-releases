import React, { useEffect, useState, useRef } from 'react';
import { ResearchProject, ProjectPlan, WeeklyGoal, PlanType, WeeklyTask, AppView } from '../../types';
import { PlanHeader } from './WeeklyPlan/PlanHeader';
import { GoalSection } from './WeeklyPlan/GoalSection';
import { TaskSection } from './WeeklyPlan/TaskSection';
import { MonthlyBreakdown } from './WeeklyPlan/MonthlyBreakdown';
import { AnnualBreakdown } from './WeeklyPlan/AnnualBreakdown';
import { PlanTextExportModal } from './WeeklyPlan/PlanTextExportModal';
import { CycleNavigator } from './WeeklyPlan/CycleNavigator';
import { useWeeklyPlanBoardLogic, getMonday, toLocalISOString, parseLocalDate } from '../../hooks/useWeeklyPlanBoardLogic';
import { AnimatePresence, motion } from 'framer-motion';
import { useProjectContext } from '../../context/ProjectContext';
import { TaskItem } from './WeeklyPlan/TaskItem';
import { DailyFocus } from './WeeklyPlan/DailyFocus';
import AlmanacPanel from './WeeklyPlan/AlmanacPanel';

interface WeeklyPlanBoardProps {
    project: ResearchProject;
    onUpdate: (updated: ResearchProject) => void;
    onBack: () => void;
    onStartWeeklyReport: () => void;
    onGenerateWeeklyPlan: (planId: string, type: PlanType) => void;
    onSmartAssignTasks: (planId: string, isReschedule?: boolean) => void;
    onClearAssignments: (planId: string) => void;
    onSmartAssignReasonVisible?: boolean;
    onStartNextCycle: (currentPlan: ProjectPlan) => void;
    onDeletePlan: (planId: string) => void;
    onNavigate: (view: AppView, projectId?: string, subView?: string) => void;
    viewedWeekId: string | null;
    setViewedWeekId: (id: string | null) => void;
    editingGoalIdx: number | null;
    setEditingGoalIdx: (idx: number | null) => void;
    goalInput: string;
    setGoalInput: (val: string) => void;
    isAddingTask: boolean;
    setIsAddingTask: (val: boolean) => void;
    newTaskInput: string;
    setNewTaskInput: (val: string) => void;
    isAiLoading: boolean;
    onToggleFocus: () => void;
    isFocused: boolean;
    onTracePlan: (planId: string) => void;
    onTraceLog: (logId: string) => void;
    onTraceDog: (logId: string) => void;
    onTraceDogInfo?: (logId: string) => void;
    /* Fix: Removed duplicate onTraceDog property on line 26/28 */
    onTraceDoe: (doeId: string, planId?: string) => void;
    highlightedTaskId: string | null;
    onClearTaskHighlight: () => void;
    onMoveTaskToNextWeek?: (currentPlanId: string, taskGlobalIdx: number) => void;
    collectedPlanCount?: number;
    onOpenCollector?: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const WeeklyPlanBoard: React.FC<WeeklyPlanBoardProps> = (props) => {
    const {
        project, onUpdate, onBack, onStartWeeklyReport, onGenerateWeeklyPlan, onSmartAssignTasks,
        onClearAssignments, onStartNextCycle, onDeletePlan, onNavigate, viewedWeekId, setViewedWeekId,
        editingGoalIdx, setEditingGoalIdx, goalInput, setGoalInput,
        isAddingTask, setIsAddingTask, newTaskInput, setNewTaskInput, isAiLoading, onToggleFocus, isFocused,
        onTracePlan, onTraceLog, onTraceDoe, highlightedTaskId, onClearTaskHighlight, onMoveTaskToNextWeek,
        collectedPlanCount = 0, onOpenCollector
    } = props;

    const { teamMembers, projects: allProjects, showToast, setReturnPath, returnPath } = useProjectContext();

    const {
        activePlanType, setActivePlanType, activePlan, dynamicTitle, todayIdx, isArchived,
        handlePrev, handleNext, hasPrev, hasNext, savePlanUpdate, showTextModal, setShowTextModal,
        filteredTypePlans, expandedMode, setExpandedMode
    } = useWeeklyPlanBoardLogic({
        project, viewedWeekId, setViewedWeekId, highlightedTaskId, onClearTaskHighlight, onUpdate
    });

    const [isWeekendFolded, setIsWeekendFolded] = React.useState(true);
    const [openPickerIdx, setOpenPickerIdx] = React.useState<number | null>(null);
    const [openMemberPickerIdx, setOpenMemberPickerIdx] = React.useState<number | null>(null);
    const [confirmingDeleteIdx, setConfirmingDeleteIdx] = React.useState<number | null>(null);
    const [dragOverDay, setDragOverDay] = React.useState<number | null>(null);
    const [showAlmanac, setShowAlmanac] = React.useState(false);

    const [localNewTaskTitle, setLocalNewTaskTitle] = useState('');
    const headerInputRef = useRef<HTMLInputElement>(null);

    const pickerRef = React.useRef<HTMLDivElement>(null);
    const memberPickerRef = React.useRef<HTMLDivElement>(null);
    const deleteConfirmRef = React.useRef<HTMLDivElement>(null);

    const wasFocusedBeforePanorama = useRef(isFocused);

    useEffect(() => {
        if (expandedMode === 'panorama' || expandedMode === 'backlog') {
            if (!isFocused) {
                wasFocusedBeforePanorama.current = false;
                onToggleFocus();
            } else {
                wasFocusedBeforePanorama.current = true;
            }
        } else {
            if (isFocused && wasFocusedBeforePanorama.current === false) {
                onToggleFocus();
            }
        }
    }, [expandedMode]);

    const tasksByDayProjection = React.useMemo(() => {
        return DAYS.map((_, dayIdx) => {
            const tasks = activePlan.tasks || [];
            const directTasks = tasks.map((t, i) => ({ ...t, originalIdx: i })).filter(t => t.assignedDay === dayIdx);
            if (todayIdx === -1 || dayIdx !== todayIdx) return directTasks;
            const rolledOver = tasks.map((t, i) => ({ ...t, originalIdx: i })).filter(t => typeof t.assignedDay === 'number' && t.assignedDay < dayIdx && t.status === 'pending');
            return [...rolledOver, ...directTasks];
        });
    }, [activePlan.tasks, todayIdx]);

    const onUpdateTasks = (next: WeeklyTask[]) => {
        savePlanUpdate({ ...activePlan, tasks: next });
    };

    const handleLocalAddTask = () => {
        if (!localNewTaskTitle.trim()) return;
        const newTask: WeeklyTask = {
            id: `task_manual_${Date.now()}`,
            title: localNewTaskTitle.trim(),
            status: 'pending',
            sourceType: 'manual'
        };
        const nextTasks = [newTask, ...(activePlan.tasks || [])];
        savePlanUpdate({ ...activePlan, tasks: nextTasks });
        setLocalNewTaskTitle('');
        headerInputRef.current?.focus();
        showToast({ message: '新任务已存入待办池', type: 'success' });
    };

    const getCalendarDate = (dayIdx: number) => {
        if (!activePlan.startDate) return "";
        const parts = activePlan.startDate.split('-');
        if (parts.length !== 3) return activePlan.startDate;
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + dayIdx);
        return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    };

    const handleDropTask = (e: React.DragEvent, dayIdx: number) => {
        e.preventDefault();
        setDragOverDay(null);
        const taskIdStr = e.dataTransfer.getData('taskId');
        if (!taskIdStr) return;
        const taskId = parseInt(taskIdStr);
        const nextTasks = [...activePlan.tasks];
        if (nextTasks[taskId]) {
            nextTasks[taskId] = { ...nextTasks[taskId], assignedDay: dayIdx };
            savePlanUpdate({ ...activePlan, tasks: nextTasks });
            showToast({ message: `已将任务针对周${DAYS[dayIdx]}进行排期`, type: 'success' });
        }
    };

    const renderDailyColumn = (day: string, dayIdx: number) => {
        const projectedTasks = tasksByDayProjection[dayIdx];
        const isToday = dayIdx === todayIdx;
        const calDate = getCalendarDate(dayIdx);
        const isWeekend = dayIdx === 5 || dayIdx === 6;
        const isFolded = isWeekend && isWeekendFolded;
        const isOver = dragOverDay === dayIdx;

        if (isFolded && dayIdx === 6) return null;
        if (isFolded && dayIdx === 5) {
            const weekendTasks = [...tasksByDayProjection[5], ...tasksByDayProjection[6]];

            return (
                <div
                    key="weekend-combined"
                    onDragOver={(e) => { e.preventDefault(); setDragOverDay(5); }}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={(e) => handleDropTask(e, 5)}
                    className={`flex flex-col bg-slate-50 rounded-2xl border transition-all p-1.5 shadow-inner min-h-[100px] h-fit relative ${isOver ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : 'border-slate-200 border-dashed'} has-[.z-\[6000\]]:overflow-visible has-[.z-\[6000\]]:z-[100] hover:z-50`}
                >
                    <div className="flex justify-between items-center mb-1.5 px-1 shrink-0">
                        <div className="flex items-center gap-1"><span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter">Weekend</span><span className="text-[7px] font-mono font-bold text-slate-400">({getCalendarDate(5)}-{getCalendarDate(6)})</span></div>
                        <button onClick={() => setIsWeekendFolded(false)} className="text-slate-300 hover:text-indigo-600 transition-colors"><i className="fa-solid fa-angles-right text-[8px]"></i></button>
                    </div>
                    <div className={`space-y-1 pr-0.5 flex-1 transition-all overflow-visible`}>
                        {weekendTasks.map((t) => <TaskItem key={`${t.originalIdx}-weekend`} task={t} globalIdx={t.originalIdx} isArchived={isArchived} todayIdx={todayIdx} currentDayIdx={t.assignedDay} onUpdateTasks={(next) => savePlanUpdate({ ...activePlan, tasks: next })} allTasks={activePlan.tasks} onOpenPicker={setOpenPickerIdx} isPickerOpen={openPickerIdx === t.originalIdx} pickerRef={pickerRef} onOpenMemberPicker={setOpenMemberPickerIdx} isMemberPickerOpen={openMemberPickerIdx === t.originalIdx} memberPickerRef={memberPickerRef} onConfirmDelete={setConfirmingDeleteIdx} isConfirmingDelete={confirmingDeleteIdx === t.originalIdx} deleteConfirmRef={deleteConfirmRef} onTracePlan={onTracePlan} onTraceLog={onTraceLog} onTraceDoe={onTraceDoe} highlightedTaskId={highlightedTaskId} isCompact={true} />)}
                    </div>
                </div>
            );
        }

        return (
            <div
                key={day}
                onDragOver={(e) => { e.preventDefault(); setDragOverDay(dayIdx); }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={(e) => handleDropTask(e, dayIdx)}
                className={`flex flex-col bg-white rounded-2xl border border-slate-100 transition-all p-3 shadow-sm hover:border-indigo-100 min-h-[100px] h-fit relative ${isToday ? 'ring-2 ring-indigo-50/20 border-indigo-200' : 'border-slate-100'} ${isWeekend ? 'bg-slate-50/50 border-dashed opacity-90' : ''} ${isOver ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100 shadow-xl' : ''} has-[.z-\[6000\]]:overflow-visible has-[.z-\[6000\]]:z-[100] hover:z-50`}
            >
                <div className="flex justify-between items-center mb-1.5 px-1 shrink-0">
                    <div className="flex items-center gap-1.5"><span className={`text-[9px] font-black uppercase ${(dayIdx === 5 || dayIdx === 6) ? 'text-rose-400' : 'text-indigo-900'}`}>{day}</span><span className={`text-[8px] font-mono font-bold ${dayIdx === todayIdx ? 'text-indigo-600' : 'text-slate-400'}`}>({calDate})</span></div>
                    {isWeekend && <button onClick={() => setIsWeekendFolded(true)} className="text-slate-300 hover:text-indigo-600 transition-colors"><i className="fa-solid fa-angles-left text-[8px]"></i></button>}
                </div>
                <div className="shrink-0">
                    <DailyFocus dayLog={activePlan.dailyLogs?.[dayIdx]} dayIdx={dayIdx} isArchived={isArchived} onUpdateDailyLog={(idx, val) => { const next = [...activePlan.dailyLogs]; next[idx] = val; savePlanUpdate({ ...activePlan, dailyLogs: next }); }} />
                </div>
                <div className={`space-y-1 mt-1.5 pr-0.5 flex-1 transition-all overflow-visible`}>
                    {projectedTasks.map((t) => <TaskItem key={`${t.originalIdx}-${dayIdx}`} task={t} globalIdx={t.originalIdx} isArchived={isArchived} todayIdx={todayIdx} currentDayIdx={dayIdx} onUpdateTasks={onUpdateTasks} allTasks={activePlan.tasks} onOpenPicker={setOpenPickerIdx} isPickerOpen={openPickerIdx === t.originalIdx} pickerRef={pickerRef} onOpenMemberPicker={setOpenMemberPickerIdx} isMemberPickerOpen={openMemberPickerIdx === t.originalIdx} memberPickerRef={memberPickerRef} onConfirmDelete={setConfirmingDeleteIdx} isConfirmingDelete={confirmingDeleteIdx === t.originalIdx} deleteConfirmRef={deleteConfirmRef} onTracePlan={onTracePlan} onTraceLog={onTraceLog} onTraceDoe={onTraceDoe} highlightedTaskId={highlightedTaskId} />)}
                </div>
            </div>
        );
    };

    const unassignedTasks = (activePlan.tasks || []).map((t, idx) => ({ ...t, globalIdx: idx })).filter(t => typeof t.assignedDay !== 'number');

    const memberDynamicLoads = React.useMemo(() => {
        return teamMembers.map(m => {
            let activeTaskCount = 0;
            allProjects.forEach(p => {
                p.weeklyPlans?.filter(wp => wp.status === 'in-progress').forEach(plan => {
                    plan.tasks.forEach(t => {
                        if (t.status === 'pending' && t.assignedTo?.includes(m.name)) activeTaskCount++;
                    });
                });
            });
            return { name: m.name, avatar: m.avatar, load: Math.min(100, 5 + activeTaskCount * 15) };
        });
    }, [teamMembers, allProjects, activePlan.tasks]);

    const isFromSimulation = returnPath?.includes('simulation');
    const isFromTeam = returnPath === 'team';

    return (
        <div className="flex-1 min-h-0 flex flex-col p-0 bg-slate-50/10 animate-reveal relative">
            <div className="w-full mx-auto flex-1 flex flex-col min-h-0">
                {!isFocused && (
                    <div className="px-4 lg:px-6 pt-4 lg:pt-6 shrink-0">
                        <PlanHeader
                            activePlanType={activePlanType} setActivePlanType={(t) => { setActivePlanType(t); setViewedWeekId(null); }} activePlan={activePlan}
                            dynamicTitle={dynamicTitle} isArchived={isArchived} isAiLoading={isAiLoading} onGenerateWeeklyPlan={onGenerateWeeklyPlan}
                            onUpdateDayStatus={(next) => savePlanUpdate({ ...activePlan, periodStatus: next })}
                            onUpdateDailyLog={(idx, val) => { const next = [...(activePlan.dailyLogs || Array(7).fill(''))]; next[idx] = val; savePlanUpdate({ ...activePlan, dailyLogs: next }); }}
                            onPrev={handlePrev} onNext={handleNext} hasPrev={hasPrev} hasNext={hasNext}
                            onToggleFocus={onToggleFocus}
                            onAddTask={() => setIsAddingTask(true)}
                            onBack={onBack}
                            onShowAlmanac={() => setShowAlmanac(true)}
                        />
                    </div>
                )}

                {!isFocused && (
                    <div className="shrink-0">
                        <CycleNavigator
                            filteredTypePlans={filteredTypePlans}
                            activePlanId={activePlan.id}
                            onViewWeek={setViewedWeekId}
                            onDeletePlan={onDeletePlan}
                            onStartNextCycle={onStartNextCycle}
                            activePlan={activePlan}
                        />
                    </div>
                )}

                <div className="flex-1 w-full overflow-y-auto custom-scrollbar px-4 lg:px-6 pb-6">
                    <div className="max-max-w-7xl mx-auto">
                        <GoalSection
                            activePlanType={activePlanType} goals={activePlan.goals} isArchived={isArchived}
                            editingGoalIdx={editingGoalIdx} setEditingGoalIdx={setEditingGoalIdx} goalInput={goalInput} setGoalInput={setGoalInput}
                            onUpdateGoals={(next) => savePlanUpdate({ ...activePlan, goals: next as WeeklyGoal[] })}
                        />

                        {/* ── 实验计划篮入口 ── */}
                        {onOpenCollector && (
                            <div className="flex items-center justify-end mb-4 px-1">
                                <button
                                    onClick={onOpenCollector}
                                    className={`relative px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-sm transition-all flex items-center gap-2 active:scale-95 border ${
                                        collectedPlanCount > 0
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400/50 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-200/50 shadow-lg'
                                            : 'bg-white text-slate-400 border-slate-200 hover:border-teal-300 hover:text-teal-600'
                                    }`}
                                >
                                    <i className="fa-solid fa-basket-shopping text-xs"></i>
                                    实验计划篮
                                    {collectedPlanCount > 0 && (
                                        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1.5 shadow-lg animate-bounce">
                                            {collectedPlanCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}
                        {activePlanType === 'weekly' ? (
                            <TaskSection
                                activePlanType={activePlanType} tasks={activePlan.tasks} dailyLogs={activePlan.dailyLogs}
                                planStartDate={activePlan.startDate}
                                isArchived={isArchived} isAddingTask={isAddingTask} setIsAddingTask={setIsAddingTask}
                                newTaskInput={newTaskInput} setNewTaskInput={setNewTaskInput}
                                onUpdateTasks={(next) => savePlanUpdate({ ...activePlan, tasks: next })}
                                onSmartAssign={(isReschedule) => onSmartAssignTasks?.(activePlan.id, isReschedule)}
                                onClearAssign={() => onClearAssignments?.(activePlan.id)}
                                todayIdx={todayIdx} isAiLoading={isAiLoading} onToggleFocus={onToggleFocus}
                                onViewText={() => setShowTextModal(true)} isFocused={isFocused}
                                onTracePlan={onTracePlan} onTraceLog={onTraceLog} onTraceDoe={onTraceDoe}
                                highlightedTaskId={highlightedTaskId}
                                onExpandPanorama={() => setExpandedMode('panorama')}
                                onExpandBacklog={() => setExpandedMode('backlog')}
                                onMoveTaskToNextWeek={(idx) => onMoveTaskToNextWeek?.(activePlan.id, idx)}
                            />
                        ) : activePlanType === 'monthly' ? (
                            <MonthlyBreakdown breakdown={activePlan.weeklyBreakdown || []} isArchived={isArchived} onUpdateBreakdown={(breakdown) => savePlanUpdate({ ...activePlan, weeklyBreakdown: breakdown })} onEnterWeek={(week) => { }} onToggleFocus={onToggleFocus} isFocused={isFocused} />
                        ) : (
                            <AnnualBreakdown breakdown={activePlan.annualBreakdown || []} isArchived={isArchived} onUpdateBreakdown={(breakdown) => savePlanUpdate({ ...activePlan, annualBreakdown: breakdown })} onEnterMonth={(month) => { }} onToggleFocus={onToggleFocus} isFocused={isFocused} />
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {expandedMode !== 'none' && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white z-[2500] flex flex-col overflow-hidden"
                    >
                        <div className="flex-1 flex flex-col p-4 lg:p-5 min-h-0 overflow-hidden">
                            <header className="flex justify-between items-center mb-4 shrink-0 px-2">
                                <div className="flex items-center gap-3">
                                    {isFromTeam ? (
                                        <button
                                            onClick={onBack}
                                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 border-2 border-indigo-400 animate-pulse-subtle shrink-0"
                                        >
                                            <i className="fa-solid fa-arrow-left-long"></i> 返回人力矩阵
                                        </button>
                                    ) : isFromSimulation ? (
                                        <button
                                            onClick={onBack}
                                            className="bg-amber-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 border-2 border-white/20 animate-bounce-subtle shrink-0"
                                        >
                                            <i className="fa-solid fa-arrow-left-long"></i> 返回虚拟实验室
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setExpandedMode('none')}
                                            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                            title="返回详情"
                                        >
                                            <i className="fa-solid fa-arrow-left"></i>
                                        </button>
                                    )}
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${expandedMode === 'panorama' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                                        <i className={`fa-solid ${expandedMode === 'panorama' ? 'fa-calendar-week' : 'fa-clipboard-list'} text-xl`}></i>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none truncate">
                                            {expandedMode === 'panorama' ? '全景周期排期表' : '待办任务池 (BACKLOG)'}
                                        </h3>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Weekly Panorama • High Density Mode</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!isArchived && (
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm h-11">
                                            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200 focus-within:border-indigo-400 transition-all h-9">
                                                <input
                                                    ref={headerInputRef}
                                                    className="bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none px-2 w-64 lg:w-80"
                                                    placeholder="快速输入新任务..."
                                                    value={localNewTaskTitle}
                                                    onChange={e => setLocalNewTaskTitle(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleLocalAddTask()}
                                                />
                                                <button
                                                    onClick={handleLocalAddTask}
                                                    disabled={!localNewTaskTitle.trim()}
                                                    className="w-7 h-7 bg-indigo-600 text-white rounded-md flex items-center justify-center transition-all hover:bg-black active:scale-90"
                                                >
                                                    <i className="fa-solid fa-plus text-[10px]"></i>
                                                </button>
                                            </div>

                                            {expandedMode === 'panorama' ? (
                                                <button
                                                    onClick={() => onSmartAssignTasks?.(activePlan.id, false)}
                                                    disabled={isAiLoading || unassignedTasks.length === 0}
                                                    className={`px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95 disabled:opacity-30 flex items-center gap-2 h-9 hover:bg-black transition-all`}
                                                >
                                                    {isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt-lightning text-amber-300"></i>}
                                                    智能分配
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onGenerateWeeklyPlan?.(activePlan.id, activePlanType)}
                                                    disabled={isAiLoading}
                                                    className={`px-4 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 h-9 hover:bg-black transition-all`}
                                                >
                                                    {isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                                                    计划生成
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex items-center shadow-inner h-11">
                                        <button onClick={() => setExpandedMode('panorama')} className={`px-4 h-full rounded-lg text-[11px] font-black uppercase transition-all ${expandedMode === 'panorama' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>全景</button>
                                        <button onClick={() => setExpandedMode('backlog')} className={`px-4 h-full rounded-lg text-[11px] font-black uppercase transition-all ${expandedMode === 'backlog' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>待办</button>
                                    </div>

                                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                                    {expandedMode === 'panorama' && (
                                        <button onClick={() => { if (!isArchived) setViewedWeekId(null); setIsWeekendFolded(!isWeekendFolded); }} className={`px-4 py-1 rounded-xl text-[11px] font-black uppercase border transition-all h-11 shadow-sm ${isWeekendFolded ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'}`}>
                                            {isWeekendFolded ? '展开周末' : '合并周末'}
                                        </button>
                                    )}
                                    <button onClick={() => { setExpandedMode('none'); }} className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-95 shadow-sm border border-slate-200"><i className="fa-solid fa-times text-xl"></i></button>
                                </div>
                            </header>

                            <div className="flex-1 min-0 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-3 shadow-inner flex flex-col gap-4 transition-all overflow-hidden relative has-[.z-\[6000\]]:overflow-visible">
                                <div className="flex-1 overflow-y-auto overflow-x-visible custom-scrollbar has-[.z-\[6000\]]:overflow-visible pr-1">
                                    {expandedMode === 'panorama' ? (
                                        <div className="flex flex-row gap-3 h-fit min-h-full has-[.z-\[6000\]]:overflow-visible">
                                            <div className="w-60 shrink-0 flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 h-[620px] relative transition-all overflow-hidden has-[.z-\[6000\]]:overflow-visible has-[.z-\[6000\]]:z-[500]">
                                                <div className="flex items-center justify-between mb-4 px-1 shrink-0 text-left">
                                                    <h4 className="text-[14px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                                        <i className="fa-solid fa-box-open text-indigo-500"></i> 任务库
                                                    </h4>
                                                    <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-md">{unassignedTasks.length}</span>
                                                </div>

                                                <div className="flex-1 pr-0.5 space-y-2.5 overflow-y-auto overflow-x-visible custom-scrollbar has-[.z-\[6000\]]:overflow-visible">
                                                    {unassignedTasks.map((t) => (
                                                        <TaskItem
                                                            key={t.globalIdx}
                                                            task={t}
                                                            globalIdx={t.globalIdx}
                                                            isArchived={isArchived}
                                                            isBacklogContext={true}
                                                            todayIdx={todayIdx}
                                                            onUpdateTasks={(next) => onUpdateTasks(next)}
                                                            allTasks={activePlan.tasks}
                                                            onOpenPicker={setOpenPickerIdx}
                                                            isPickerOpen={openPickerIdx === t.globalIdx}
                                                            pickerRef={pickerRef}
                                                            onOpenMemberPicker={setOpenMemberPickerIdx}
                                                            isMemberPickerOpen={openMemberPickerIdx === t.globalIdx}
                                                            memberPickerRef={memberPickerRef}
                                                            onConfirmDelete={setConfirmingDeleteIdx}
                                                            isConfirmingDelete={confirmingDeleteIdx === t.globalIdx}
                                                            deleteConfirmRef={deleteConfirmRef}
                                                            onTracePlan={onTracePlan}
                                                            onTraceLog={onTraceLog}
                                                            onTraceDoe={onTraceDoe}
                                                            highlightedTaskId={highlightedTaskId}
                                                            isCompact={false}
                                                        />
                                                    ))}
                                                    {unassignedTasks.length === 0 && (
                                                        <div className="flex-1 flex flex-col items-center justify-center py-8 opacity-20 text-center grayscale">
                                                            <i className="fa-solid fa-box-open text-3xl mb-2"></i>
                                                            <p className="text-[9px] font-black uppercase">空</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`grid gap-2 flex-1 h-fit min-h-full overflow-visible ${isWeekendFolded ? 'grid-cols-6' : 'grid-cols-7'}`}>
                                                {DAYS.map((day, dayIdx) => renderDailyColumn(day, dayIdx))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="overflow-visible grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6 p-2">
                                            {unassignedTasks.map((t) => <TaskItem key={t.globalIdx} task={t} globalIdx={t.globalIdx} isArchived={isArchived} isBacklogContext={true} todayIdx={todayIdx} onUpdateTasks={(next) => onUpdateTasks(next)} allTasks={activePlan.tasks} onOpenPicker={setOpenPickerIdx} isPickerOpen={openPickerIdx === t.globalIdx} pickerRef={pickerRef} onOpenMemberPicker={setOpenMemberPickerIdx} isMemberPickerOpen={openMemberPickerIdx === t.globalIdx} memberPickerRef={memberPickerRef} onConfirmDelete={setConfirmingDeleteIdx} isConfirmingDelete={confirmingDeleteIdx === t.globalIdx} deleteConfirmRef={deleteConfirmRef} onTracePlan={onTracePlan} onTraceLog={onTraceLog} onTraceDoe={onTraceDoe} highlightedTaskId={highlightedTaskId} isCompact={false} />)}
                                        </div>
                                    )}
                                </div>

                                {/* 带宽监测面板 - 固定在 gray card 容器底部 */}
                                <div className="bg-white/95 backdrop-blur-md rounded-3xl p-2 border border-slate-200 shadow-xl shrink-0 flex items-center gap-4 no-print justify-between relative z-[500] mt-2">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 shrink-0">
                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner">
                                                <i className="fa-solid fa-chart-line text-sm"></i>
                                            </div>
                                            <div className="flex flex-col">
                                                <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">团队带宽监测</h5>
                                                <p className="text-[6px] text-slate-400 uppercase mt-0.5 font-bold">Bandwidth</p>
                                            </div>
                                            <div className="h-6 w-px bg-slate-100 ml-1"></div>
                                        </div>
                                        <div className="flex gap-3 overflow-x-auto no-scrollbar py-0.5 flex-1">
                                            {memberDynamicLoads.map(ml => {
                                                const isCritical = ml.load > 85; const isWarning = ml.load > 65;
                                                const barColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                                                return (
                                                    <div
                                                        key={ml.name}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.setData('memberName', ml.name);
                                                            e.dataTransfer.effectAllowed = 'copy';
                                                        }}
                                                        onClick={() => onNavigate('team')}
                                                        className={`flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm min-w-[130px] cursor-pointer transition-all hover:scale-105 active:scale-95`}
                                                    >
                                                        <img src={ml.avatar} className="w-6 h-6 rounded-lg border border-slate-100 shadow-xs" alt="" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-end mb-0.5"><p className="text-[9px] font-black text-slate-700 truncate leading-none">{ml.name}</p><span className={`text-[7px] font-black ${isCritical ? 'text-rose-600' : 'text-slate-400'}`}>{ml.load.toFixed(0)}%</span></div>
                                                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${barColor}`} style={{ width: `${ml.load}%` }}></div></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setReturnPath(`project/${project.id}/plan_board:panorama`);
                                            onNavigate('team');
                                        }}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 active:scale-95 shrink-0 border border-white/20"
                                    >
                                        <i className="fa-solid fa-arrow-left-long"></i>
                                        返回团队矩阵
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <PlanTextExportModal show={showTextModal} onClose={() => setShowTextModal(false)} title={dynamicTitle} plan={activePlan} copyText={activePlan.tasks.map(t => t.title).join('\n')} />

            {/* 科研黄历玄学面板 */}
            {showAlmanac && (
                <AlmanacPanel
                    tasks={activePlan.tasks || []}
                    planStartDate={activePlan.startDate}
                    onClose={() => setShowAlmanac(false)}
                />
            )}
        </div>
    );
};

export default WeeklyPlanBoard;