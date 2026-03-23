import React, { useRef, useMemo, useState, useEffect } from 'react';
import { WeeklyTask } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';

interface TaskItemProps {
    task: WeeklyTask;
    globalIdx: number;
    isArchived: boolean;
    isBacklogContext?: boolean;
    currentDayIdx?: number;
    todayIdx: number;
    onUpdateTasks: (newTasks: WeeklyTask[]) => void;
    onOpenPicker: (idx: number | null) => void;
    isPickerOpen: boolean;
    pickerRef: React.RefObject<HTMLDivElement | null>;
    onOpenMemberPicker?: (idx: number | null) => void;
    isMemberPickerOpen?: boolean;
    memberPickerRef?: React.RefObject<HTMLDivElement | null>;
    onConfirmDelete: (idx: number | null) => void;
    isConfirmingDelete: boolean;
    deleteConfirmRef: React.RefObject<HTMLDivElement | null>;
    onTracePlan?: (planId: string) => void;
    onTraceLog?: (logId: string) => void;
    /* Fix: Removed duplicate onTraceDog identifier on line 25/27 */
    onTraceDog?: (logId: string) => void;
    onTraceDogInfo?: (logId: string) => void;
    onTraceDoe?: (doeId: string) => void;
    highlightedTaskId?: string | null;
    allTasks: WeeklyTask[];
    isCompact?: boolean;
    onMoveTaskToNextWeek?: () => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const TaskItem: React.FC<TaskItemProps> = ({
    task, globalIdx, isArchived, isBacklogContext = false, currentDayIdx = -1, todayIdx,
    onUpdateTasks, allTasks, onOpenPicker, isPickerOpen, pickerRef,
    onOpenMemberPicker, isMemberPickerOpen, memberPickerRef,
    onConfirmDelete, isConfirmingDelete, deleteConfirmRef,
    onTracePlan, onTraceLog, onTraceDog, onTraceDogInfo, onTraceDoe, highlightedTaskId,
    isCompact = false, onMoveTaskToNextWeek
}) => {
    const { teamMembers, handleProcessMemberGrowth, showToast } = useProjectContext();
    const [isDragOverMember, setIsDragOverMember] = useState(false);
    const [isHoveringReason, setIsHoveringReason] = useState(false);
    const [isHoveringSource, setIsHoveringSource] = useState(false);
    const isCompleted = task.status === 'completed';
    const isOverdueInPast = !isBacklogContext && currentDayIdx !== -1 && todayIdx !== -1 && currentDayIdx < todayIdx && !isCompleted;
    const isRolledOverToday = !isBacklogContext && currentDayIdx === todayIdx && typeof task.assignedDay === 'number' && task.assignedDay < todayIdx;
    const isAssignedElsewhere = isBacklogContext && typeof task.assignedDay === 'number' && !isCompact;

    const isSourceHighlighted = !!highlightedTaskId && (highlightedTaskId === task.id);

    const [isEditing, setIsEditing] = useState(false);
    const [isEditingDesc, setIsEditingDesc] = useState(false); // 新增：详情编辑状态
    const [showSpecs, setShowSpecs] = useState(false);
    const [tempTitle, setTempTitle] = useState(task.title);
    const [tempDesc, setTempDesc] = useState(task.description || ''); // 新增：详情临时存根

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const descTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setTempTitle(task.title);
        setTempDesc(task.description || '');
    }, [task.title, task.description]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
            textareaRef.current.focus();
        }
    }, [isEditing]);

    useEffect(() => {
        if (isEditingDesc && descTextareaRef.current) {
            descTextareaRef.current.style.height = 'auto';
            descTextareaRef.current.style.height = descTextareaRef.current.scrollHeight + 'px';
            descTextareaRef.current.focus();
        }
    }, [isEditingDesc]);

    const handleSaveTitle = () => {
        if (!isArchived && tempTitle.trim() && tempTitle !== task.title) {
            const next = [...allTasks];
            next[globalIdx] = { ...next[globalIdx], title: tempTitle.trim() };
            onUpdateTasks(next);
        }
        setIsEditing(false);
    };

    const handleSaveDesc = () => {
        if (!isArchived && tempDesc !== (task.description || '')) {
            const next = [...allTasks];
            next[globalIdx] = { ...next[globalIdx], description: tempDesc.trim() };
            onUpdateTasks(next);
            showToast({ message: "任务详情已更新", type: 'success' });
        }
        setIsEditingDesc(false);
    };

    const handleToggle = () => {
        if (isArchived) return;
        const next = [...allTasks];
        const willBeCompleted = next[globalIdx].status === 'pending';
        next[globalIdx].status = willBeCompleted ? 'completed' : 'pending';
        if (willBeCompleted) handleProcessMemberGrowth(next[globalIdx]);
        onUpdateTasks(next);
    };

    const handleUpdateDay = (day: number | undefined) => {
        const next = [...allTasks];
        next[globalIdx] = { ...next[globalIdx], assignedDay: day };
        onUpdateTasks(next);
        onOpenPicker(null);
    };

    const handleMemberDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOverMember(false);
        const memberName = e.dataTransfer.getData('memberName');
        if (!memberName || isArchived) return;

        const current = task.assignedTo || [];
        if (current.includes(memberName)) {
            showToast({ message: `${memberName} 已负责该任务`, type: 'info' });
            return;
        }

        const next = [...allTasks];
        next[globalIdx] = { ...next[globalIdx], assignedTo: [...current, memberName] };
        onUpdateTasks(next);
        showToast({ message: `已将 ${memberName} 指派给该任务`, type: 'success' });
    };

    const assignees = (task.assignedTo || []).map(name => ({
        name, profile: teamMembers.find(m => m.name === name)
    }));
    const isAnyAssigneeOverloaded = assignees.some(a => a.profile && (a.profile.workload || 0) * 1.5 > 120); // Minor fix in logic here to align with bandwidth monitoring

    const isAnyPopupOpen = isPickerOpen || isMemberPickerOpen || isConfirmingDelete || isHoveringReason || isHoveringSource;

    const isRightColumn = !isBacklogContext && currentDayIdx >= 4;
    const tooltipAlignClass = isBacklogContext ? 'left-0' : (isRightColumn ? 'right-0' : 'left-0');
    const arrowAlignClass = isBacklogContext ? 'left-3' : (isRightColumn ? 'right-3' : 'left-3');

    const sourceIndicator = useMemo(() => {
        if (['ai', 'weekly_report', 'doe_ai', 'proposal'].includes(task.sourceType || '')) {
            return { icon: 'fa-wand-magic-sparkles', color: 'text-violet-500', bg: 'bg-violet-50', label: 'AI' };
        }
        if (task.sourceType === 'manual') {
            return { icon: 'fa-user-pen', color: 'text-slate-400', bg: 'bg-slate-50', label: 'MANUAL' };
        }
        return null;
    }, [task.sourceType]);

    return (
        <div
            id={task.linkedPlanId ? `task-${task.linkedPlanId}` : undefined}
            draggable={!isArchived}
            onDragStart={(e) => { e.dataTransfer.setData('taskId', globalIdx.toString()); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); if (!isArchived) setIsDragOverMember(true); }}
            onDragLeave={() => setIsDragOverMember(false)}
            onDrop={handleMemberDrop}
            className={`group/item ${isCompact ? 'p-1.5 rounded-lg' : 'p-2.5 rounded-[1.2rem]'} border transition-all duration-300 flex flex-col relative ${isAnyPopupOpen
                ? 'z-[6000] shadow-2xl scale-[1.02] ring-4 ring-indigo-500/20 bg-white'
                : isDragOverMember
                    ? 'bg-indigo-50 border-indigo-400 ring-4 ring-indigo-100 scale-[1.02] z-[150]'
                    : isCompleted
                        ? 'bg-slate-50/50 border-slate-100 opacity-70 shadow-none z-10'
                        : isSourceHighlighted
                            ? 'bg-indigo-50 border-indigo-200 scale-[1.02] z-[400] shadow-lg animate-precision-glow'
                            : isOverdueInPast
                                ? 'bg-rose-50 border-rose-100 ring-1 ring-rose-50 z-20'
                                : isRolledOverToday
                                    ? 'bg-white border-amber-200 shadow-sm border-l-4 border-l-amber-500 z-30'
                                    : isAssignedElsewhere
                                        ? 'bg-slate-50/30 border-slate-100 opacity-50 grayscale z-10'
                                        : 'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 z-20 hover:z-[5000] hover:scale-[1.01]'
                } cursor-grab active:cursor-grabbing`}
        >
            <div className={`flex items-center justify-between ${isCompact ? 'mb-0.5' : 'mb-1'} shrink-0 relative`}>
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={isArchived}
                        onClick={handleToggle}
                        className={`${isCompact ? 'w-4 h-4 rounded-md' : 'w-6 h-6 rounded-xl'} flex items-center justify-center border-2 transition-all shrink-0 ${isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isSourceHighlighted
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-inner'
                                : 'border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/30'
                            } ${isArchived ? 'cursor-default' : 'cursor-pointer active:scale-90'}`}
                    >
                        {isCompleted && <i className={`fa-solid fa-check ${isCompact ? 'text-[7px]' : 'text-[9px]'}`}></i>}
                    </button>

                    <div className="flex items-center gap-1 flex-wrap">
                        {task.linkedPlanId && onTracePlan && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onTracePlan(task.linkedPlanId!); }}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-600 text-white shadow-md hover:bg-black transition-all active:scale-95 group/trace border border-indigo-400/50`}
                                title="溯源至实验矩阵设计"
                            >
                                <i className={`fa-solid fa-table-cells ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}></i>
                                {!isCompact && <span className="text-[8px] font-black uppercase tracking-tighter">矩阵溯源</span>}
                            </button>
                        )}

                        {sourceIndicator && (
                            <div
                                onMouseEnter={() => setIsHoveringSource(true)}
                                onMouseLeave={() => setIsHoveringSource(false)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border ${sourceIndicator.bg} border-transparent group/source relative cursor-help`}
                            >
                                <i className={`fa-solid ${sourceIndicator.icon} ${sourceIndicator.color} ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}></i>
                                {!isCompact && <span className={`text-[5px] font-black uppercase tracking-tighter ${sourceIndicator.color}`}>{sourceIndicator.label}</span>}

                                <div className={`absolute bottom-full mb-2 ${tooltipAlignClass} opacity-0 group-hover/source:opacity-100 transition-all duration-300 pointer-events-none z-[8000] translate-y-1 group-hover/source:translate-y-0 shadow-2xl`}>
                                    <div className="bg-slate-900/95 backdrop-blur-md text-white text-[9px] font-black px-3 py-2 rounded-xl whitespace-nowrap border border-white/20 uppercase tracking-widest">
                                        {sourceIndicator.label === 'AI' ? 'AI 智能建议任务' : '手动录入任务'}
                                    </div>
                                    <div className={`absolute top-full ${arrowAlignClass} border-[5px] border-transparent border-t-slate-900`}></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {assignees.length > 0 && (
                    <div className={`flex items-center gap-1 ${isCompact ? 'bg-transparent' : 'bg-slate-100/40 px-1 py-0.5 rounded-lg border border-slate-200/30'}`}>
                        <div className="flex -space-x-1.5">
                            {assignees.map((a, i) => (
                                <div
                                    key={i}
                                    className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} rounded-full border-2 border-white shadow-sm relative cursor-default group/member ${isAnyAssigneeOverloaded && !isCompleted ? 'ring-1 ring-rose-400' : ''}`}
                                    onMouseEnter={() => setIsHoveringReason(true)}
                                    onMouseLeave={() => setIsHoveringReason(false)}
                                >
                                    {a.profile?.avatar ? <img src={a.profile.avatar} className="w-full h-full object-cover rounded-full" alt={a.name} /> : <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-[6px] font-black text-indigo-600 rounded-full">{a.name[0]}</div>}

                                    {task.assignmentReason && (
                                        <div className={`absolute bottom-full mb-3 ${tooltipAlignClass} pointer-events-none opacity-0 group-hover/member:opacity-100 transition-all duration-300 z-[9000] w-52 translate-y-2 group-hover/member:translate-y-0 shadow-2xl`}>
                                            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl border border-white/20 text-left shadow-2xl">
                                                <div className="flex items-center gap-2 mb-1.5 border-b border-white/10 pb-1.5">
                                                    <i className="fa-solid fa-robot text-indigo-400 text-[10px]"></i>
                                                    <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest leading-none">智能指派依据</p>
                                                </div>
                                                <p className="text-[10px] font-medium leading-relaxed italic text-indigo-50/90 text-justify">“ {task.assignmentReason} ”</p>
                                            </div>
                                            <div className={`w-2.5 h-2.5 bg-slate-900 rotate-45 ${arrowAlignClass} -mt-1.5 border-r border-b border-white/10 shadow-lg`}></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={`flex-1 min-h-[16px] ${isCompact ? 'mb-0.5' : 'mb-1.5'}`}>
                {isEditing && !isArchived ? (
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-indigo-50/30 rounded-xl outline-none border border-indigo-200 text-[11px] font-bold text-slate-800 p-2 resize-none h-auto overflow-hidden leading-relaxed shadow-inner"
                        value={tempTitle}
                        onChange={(e) => {
                            setTempTitle(e.target.value);
                            e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveTitle(); } }}
                        rows={1}
                    />
                ) : (
                    <p
                        onClick={(e) => { if (!isArchived) { e.stopPropagation(); setIsEditing(true); } }}
                        className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} font-bold leading-tight break-words transition-all rounded-md px-1 py-0.5 -ml-1 w-full ${isCompleted
                            ? 'line-through text-slate-400 font-medium'
                            : isSourceHighlighted
                                ? 'text-indigo-900 underline decoration-indigo-300 font-black'
                                : isOverdueInPast ? 'text-rose-700 italic' : 'text-slate-700 hover:bg-slate-50 cursor-text'
                            } whitespace-pre-wrap`}
                    >
                        {task.title}
                    </p>
                )}
            </div>

            <div className={`flex items-center justify-between mt-auto ${isCompact ? 'pt-0.5' : 'pt-1.5'} border-t border-slate-100`}>
                {!isArchived ? (
                    <div className="flex items-center gap-1.5">
                        <div className="relative" ref={isPickerOpen ? (pickerRef as any) : null}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onOpenPicker(isPickerOpen ? null : globalIdx); onOpenMemberPicker?.(null); onConfirmDelete(null); }}
                                className={`${isCompact ? 'w-5 h-5' : 'w-7 h-7'} rounded-xl flex items-center justify-center transition-all border ${isPickerOpen ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-slate-300 border-slate-100 hover:text-indigo-600 hover:border-indigo-200'}`}
                                title="安排日期"
                            >
                                <i className={`fa-regular fa-calendar-plus ${isCompact ? 'text-[6px]' : 'text-[9px]'}`}></i>
                            </button>
                            {isPickerOpen && (
                                <div className={`absolute bottom-full ${tooltipAlignClass} mb-3 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 z-[8000] animate-reveal flex flex-col gap-3 min-w-[200px]`}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex justify-between items-center">
                                        <span>指派周期日期</span>
                                        <i className="fa-solid fa-calendar-day text-indigo-400"></i>
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {DAYS.map((day, idx) => (
                                            <button
                                                key={day}
                                                onClick={() => handleUpdateDay(idx)}
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black uppercase transition-all border-2 ${task.assignedDay === idx
                                                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-100 scale-105'
                                                    : 'bg-slate-50 text-slate-500 border-transparent hover:bg-white hover:border-indigo-200 hover:text-indigo-600'
                                                    }`}
                                            >
                                                {day.substring(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 items-stretch h-9">
                                        <button onClick={() => handleUpdateDay(undefined)} className="flex-1 bg-slate-100 text-slate-400 rounded-xl text-[9px] font-black uppercase hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center">
                                            移出周期
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onMoveTaskToNextWeek?.(); onOpenPicker(null); }}
                                            className="flex-1 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase hover:bg-black hover:text-white transition-all flex items-center justify-center gap-1.5 border border-indigo-100"
                                        >
                                            <i className="fa-solid fa-calendar-arrow-plus text-[8px]"></i>
                                            <span>排到下周</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={isMemberPickerOpen ? (memberPickerRef as any) : null}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onOpenMemberPicker?.(isMemberPickerOpen ? null : globalIdx); onOpenPicker(null); onConfirmDelete(null); }}
                                className={`${isCompact ? 'w-5 h-5' : 'w-7 h-7'} rounded-xl flex items-center justify-center transition-all border ${isMemberPickerOpen ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg' : 'bg-white text-slate-300 border-slate-100 hover:text-indigo-600 hover:border-indigo-100 shadow-sm'}`}
                                title="指派负责人"
                            >
                                <i className={`fa-solid fa-user-plus ${isCompact ? 'text-[6px]' : 'text-[9px]'}`}></i>
                            </button>
                            {isMemberPickerOpen && (
                                <div className={`absolute bottom-full ${tooltipAlignClass} mb-3 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-[8000] animate-reveal flex flex-col gap-1.5 min-w-[160px]`}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 mb-1 flex justify-between items-center">
                                        <span>人员指派矩阵</span>
                                        <i className="fa-solid fa-users text-indigo-400"></i>
                                    </p>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                        {teamMembers.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => {
                                                    const current = task.assignedTo || [];
                                                    const next = current.includes(m.name) ? current.filter(n => n !== m.name) : [...current, m.name];
                                                    const nextTasks = [...allTasks];
                                                    nextTasks[globalIdx] = { ...nextTasks[globalIdx], assignedTo: next };
                                                    onUpdateTasks(nextTasks);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${task.assignedTo?.includes(m.name)
                                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                                    : 'bg-slate-50 border-transparent text-slate-600 hover:bg-white hover:border-indigo-100 hover:text-indigo-600'
                                                    }`}
                                            >
                                                <img src={m.avatar} className="w-5 h-5 rounded-full border-2 border-white shadow-sm" alt="" />
                                                <span className="truncate flex-1 text-left">{m.name}</span>
                                                {task.assignedTo?.includes(m.name) && <i className="fa-solid fa-check-circle text-[10px]"></i>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={isConfirmingDelete ? (deleteConfirmRef as any) : null}>
                            <button
                                onClick={(e) => { e.stopPropagation(); onConfirmDelete(isConfirmingDelete ? null : globalIdx); onOpenPicker(null); onOpenMemberPicker?.(null); }}
                                className={`${isCompact ? 'w-5 h-5' : 'w-7 h-7'} rounded-xl flex items-center justify-center transition-all border ${isConfirmingDelete ? 'bg-rose-600 text-white border-rose-700 shadow-lg' : 'bg-white text-slate-200 border-slate-100 hover:text-rose-500 hover:border-rose-200 shadow-xs'}`}
                                title="删除任务"
                            >
                                <i className={`fa-solid fa-trash-can ${isCompact ? 'text-[6px]' : 'text-[9px]'}`}></i>
                            </button>
                            {isConfirmingDelete && (
                                <div className={`absolute bottom-full ${tooltipAlignClass} mb-3 bg-white rounded-3xl shadow-2xl border border-rose-100 p-4 z-[8000] animate-reveal flex flex-col items-center gap-3 min-w-[140px] text-center`}>
                                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-1 shadow-inner">
                                        <i className="fa-solid fa-trash-can text-lg"></i>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">确认永久删除?</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">此操作不可撤销</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateTasks(allTasks.filter((_, i) => i !== globalIdx));
                                            onConfirmDelete(null);
                                        }}
                                        className="w-full py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-100"
                                    >
                                        确定删除
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); onConfirmDelete(null); }} className="w-full py-1.5 text-[8px] font-black text-slate-400 uppercase hover:bg-slate-50 rounded-lg">取消</button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : <div />}

                <button
                    onClick={() => setShowSpecs(!showSpecs)}
                    className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest transition-colors ${isCompact ? 'px-1 py-0.5' : 'px-2 py-1'} rounded-lg ${showSpecs ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-50 hover:text-indigo-600'}`}
                    title="查看详情 (Specs)"
                >
                    <i className={`fa-solid ${showSpecs ? 'fa-chevron-up' : 'fa-chevron-right'} text-[5px] transition-transform`}></i>
                    {!isCompact && 'Specs'}
                </button>
            </div>

            {showSpecs && (
                <div className={`${isCompact ? 'mt-0.5 p-1 rounded-md' : 'mt-1 p-2 rounded-xl'} border-2 border-dashed animate-reveal bg-slate-50/50 border-slate-100 relative shrink-0 text-left`}>
                    <div className="absolute top-1 right-2 opacity-[0.03] pointer-events-none group-hover:opacity-100 transition-opacity">
                        {isEditingDesc ? (
                            <button
                                onClick={handleSaveDesc}
                                className="text-emerald-500 hover:text-emerald-600 p-1"
                                title="保存详情"
                            >
                                <i className="fa-solid fa-check"></i>
                            </button>
                        ) : (
                            <i className={`fa-solid fa-file-invoice ${isCompact ? 'text-sm' : 'text-xl'}`}></i>
                        )}
                    </div>

                    {isEditingDesc && !isArchived ? (
                        <textarea
                            ref={descTextareaRef}
                            className="w-full bg-white rounded-lg p-2 text-[10px] font-medium leading-relaxed italic text-slate-700 outline-none border border-indigo-200 shadow-inner min-h-[60px]"
                            value={tempDesc}
                            onChange={(e) => {
                                setTempDesc(e.target.value);
                                e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            onBlur={handleSaveDesc}
                            placeholder="输入更详细的任务说明、预期交付物或备注..."
                        />
                    ) : (
                        <p
                            onClick={() => { if (!isArchived) setIsEditingDesc(true); }}
                            className={`${isCompact ? 'text-[7.5px]' : 'text-[9.5px]'} font-medium leading-tight italic text-justify whitespace-pre-wrap cursor-text hover:bg-white/50 rounded p-1 transition-colors ${task.description ? 'text-slate-500' : 'text-slate-300'}`}
                        >
                            {task.description || '暂无详细描述信息，点击可进行编辑。'}
                        </p>
                    )}
                </div>
            )}
            <style>{`
          @keyframes precision-glow {
            0%, 100% { border-color: rgba(99,102,241,0.5); box-shadow: 0 0 12px rgba(99,102,241,0.15); }
            50% { border-color: rgba(99,102,241,1); box-shadow: 0 0 25px rgba(99,102,241,0.35); }
          }
          .animate-precision-glow { animation: precision-glow 2s infinite ease-in-out; }
      `}</style>
        </div>
    );
};
