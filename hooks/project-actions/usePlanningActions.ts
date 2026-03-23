
import React, { useCallback } from 'react';
import { ResearchProject, ProjectPlan, PlanType, WeeklyTask, PlannedExperiment, UserProfile } from '../../types';
import { generateProjectPlanAI, assignTasksAI } from '../../services/gemini/experiment';
import { getMonday, parseLocalDate, toLocalISOString } from '../useWeeklyPlanBoardLogic';

interface UsePlanningActionsProps {
    project: ResearchProject;
    onUpdate: (updated: ResearchProject) => void;
    updateAi: (updates: any) => void;
    updateWeekly: (updates: any) => void;
    showToast: (msg: any) => void;
    setConfirmModal: (config: any) => void;
    teamMembers: UserProfile[];
    startGlobalTask: (task: any, action: () => Promise<any>) => Promise<void>;
}

export const usePlanningActions = ({
    project, onUpdate, updateAi, updateWeekly, showToast, setConfirmModal, teamMembers, startGlobalTask
}: UsePlanningActionsProps) => {

    const handleGenerateWeeklyPlan = useCallback(async (planId: string | null, type: PlanType = 'weekly') => {
        if (!project) return;

        await startGlobalTask(
            { id: 'weekly_plan_gen', type: 'writing_assist', status: 'running', title: '智能推演周期计划...' },
            async () => {
                const planData = await generateProjectPlanAI(project, type);
                const currentPlans = project?.weeklyPlans || [];
                const currentPlan = currentPlans.find(w => w.id === planId) || currentPlans.find(w => w.status === 'in-progress' && w.type === type);

                const tasksToSet: WeeklyTask[] = (planData?.tasks || []).map((t: any) => ({
                    title: t.title,
                    status: 'pending',
                    sourceType: 'ai'
                }));

                const now = new Date();

                let startDateStr = '';
                if (currentPlan && !currentPlan.id.startsWith('draft_')) {
                    startDateStr = currentPlan.startDate;
                } else {
                    if (type === 'weekly') {
                        const day = now.getDay();
                        const hour = now.getHours();
                        const isPlanningNext = (day === 5 && hour >= 17) || day === 6 || day === 0;
                        let targetMon = getMonday(now);
                        if (isPlanningNext) targetMon.setDate(targetMon.getDate() + 7);
                        startDateStr = toLocalISOString(targetMon);
                    } else if (type === 'monthly') {
                        startDateStr = toLocalISOString(new Date(now.getFullYear(), now.getMonth(), 1));
                    } else {
                        startDateStr = toLocalISOString(new Date(now.getFullYear(), 0, 1));
                    }
                }

                if (currentPlan && !currentPlan.id.startsWith('draft_')) {
                    const updatedPlan: ProjectPlan = { ...currentPlan, tasks: [...tasksToSet, ...(currentPlan.tasks || [])], status: 'in-progress' };
                    onUpdate({ ...project, weeklyPlans: currentPlans.map(w => w.id === updatedPlan.id ? updatedPlan : w) });
                } else {
                    const newId = `plan_${type}_${Date.now()}`;
                    const startDate = parseLocalDate(startDateStr);
                    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (type === 'weekly' ? 6 : type === 'monthly' ? 30 : 364));

                    const newPlan: ProjectPlan = {
                        id: newId,
                        type,
                        startDate: startDateStr,
                        endDate: toLocalISOString(endDate),
                        completionRate: 0,
                        goals: (planData?.goals || [])?.map((g: string, i: number) => ({ id: `g${i}_${Date.now()}`, text: g, completed: false })) || [],
                        tasks: tasksToSet,
                        status: 'in-progress',
                        periodStatus: Array(type === 'weekly' ? 7 : type === 'monthly' ? 4 : 12).fill('idle'),
                        dailyLogs: Array(type === 'weekly' ? 7 : type === 'monthly' ? 4 : 12).fill('')
                    };
                    onUpdate({ ...project, weeklyPlans: [newPlan, ...currentPlans] });
                    updateWeekly({ viewedWeekId: newId });
                }
                showToast({ message: `AI 建议任务已注入`, type: 'success' });
            }
        );
    }, [project, onUpdate, updateAi, updateWeekly, showToast, startGlobalTask]);

    /**
     * 改进版智能指派逻辑：使用任务索引 ID 替代标题模糊匹配
     */
    const handleSmartAssignTasks = useCallback(async (planId: string, isReschedule: boolean = false) => {
        const currentPlan = (project?.weeklyPlans || []).find(w => w.id === planId);
        if (!currentPlan) return;

        // 预校验 1: 检查成员库
        if (!teamMembers || teamMembers.length === 0) {
            showToast({ message: "成员池为空，请先在‘团队矩阵’中录入研究人员", type: 'error' });
            return;
        }

        const tasks = currentPlan.tasks || [];
        const tasksToReassign = isReschedule
            ? tasks.filter(t => t.status === 'pending')
            : tasks.filter(t => typeof t.assignedDay !== 'number' && t.status === 'pending');

        // 预校验 2: 检查待指派任务
        if (tasksToReassign.length === 0) {
            showToast({ message: "当前没有需要自动指派的任务项", type: 'info' });
            return;
        }

        await startGlobalTask(
            { id: 'task_assign', type: 'diagnose', status: 'running', title: '执行多维带宽对标与指派...' },
            async () => {
                const now = new Date();
                const todayIdx = (now.getDay() + 6) % 7;

                // 关键：构建带有 taskId 的上下文对象
                const allExperimentalPlans = (project?.milestones || []).flatMap(m => m.experimentalPlan || []);
                const tasksWithMeta = tasksToReassign.map((task, index) => ({
                    taskId: index, // 临时 ID 用于回显匹配
                    ...task,
                    linkedPlan: task.linkedPlanId ? allExperimentalPlans.find(p => p.id === task.linkedPlanId) : null
                }));

                const assignmentResult = await assignTasksAI(project, tasksWithMeta, teamMembers, isReschedule ? todayIdx : -1);

                if (!assignmentResult?.assignments || assignmentResult.assignments.length === 0) {
                    showToast({ message: "AI 调度建议为空，可能是任务描述不足", type: 'error' });
                    return;
                }

                // 使用 taskId 严格回写数据
                const nextTasks = [...tasks];
                assignmentResult.assignments.forEach((a: any) => {
                    if (typeof a.taskId === 'number' && tasksWithMeta[a.taskId]) {
                        const originalTask = tasksWithMeta[a.taskId];
                        // 找到在原始数组中的位置
                        const originalIndex = tasks.findIndex(t => t.title === originalTask.title);
                        if (originalIndex > -1) {
                            nextTasks[originalIndex] = {
                                ...nextTasks[originalIndex],
                                id: nextTasks[originalIndex].id || `task_${Date.now()}_${originalIndex}`,
                                assignedDay: a.assignedDay,
                                assignedTo: Array.isArray(a.assignedTo) ? a.assignedTo : [a.assignedTo],
                                assignmentReason: a.assignmentReason
                            };
                        }
                    }
                });

                const updatedPlan: ProjectPlan = { ...currentPlan, tasks: nextTasks };
                onUpdate({ ...project, weeklyPlans: (project?.weeklyPlans || []).map(w => w.id === planId ? updatedPlan : w) });

                showToast({ message: `智能分配完成：已平衡 ${assignmentResult.assignments.length} 项交付任务`, type: 'success' });
            }
        );
    }, [project, teamMembers, onUpdate, updateAi, showToast, startGlobalTask]);

    const handleClearAssignments = useCallback((planId: string) => {
        const currentPlan = (project?.weeklyPlans || []).find(w => w.id === planId);
        if (!currentPlan) return;
        setConfirmModal({
            show: true, title: '重置所有排期？', desc: '确认执行吗？',
            onConfirm: () => {
                const tasks = currentPlan.tasks || [];
                const nextTasks = tasks.map(t => (t.status === 'pending' ? { ...t, assignedDay: undefined, assignedTo: undefined, assignmentReason: undefined } : t));
                const updatedPlan: ProjectPlan = { ...currentPlan, tasks: nextTasks };
                onUpdate({ ...project, weeklyPlans: (project?.weeklyPlans || []).map(w => w.id === planId ? updatedPlan : w) });
                showToast({ message: "已清空指派", type: 'info' });
                setConfirmModal(null);
            }
        });
    }, [project, onUpdate, setConfirmModal, showToast]);

    const handleAddTaskToWeeklyPlan = useCallback((plan: PlannedExperiment, e: React.MouseEvent) => {
        e.stopPropagation();
        const now = new Date();
        const nowTime = now.getTime();
        const weeklyPlans = project?.weeklyPlans || [];
        const activeWeeklyPlans = weeklyPlans.filter(p => p.type === 'weekly' && p.status === 'in-progress');
        let targetPlan: ProjectPlan | undefined;

        if (activeWeeklyPlans.length > 0) {
            targetPlan = activeWeeklyPlans.find(p => {
                const start = parseLocalDate(p.startDate).getTime();
                const end = parseLocalDate(p.endDate);
                end.setHours(23, 59, 59, 999);
                return nowTime >= start && nowTime <= end.getTime();
            });
            if (!targetPlan) targetPlan = activeWeeklyPlans.sort((a, b) => Math.abs(parseLocalDate(a.startDate).getTime() - nowTime) - Math.abs(parseLocalDate(b.startDate).getTime() - nowTime))[0];
        }

        let updatedPlans = [...weeklyPlans];
        if (!targetPlan) {
            const day = now.getDay(); const hour = now.getHours();
            const isPlanningNextCycle = (day === 5 && hour >= 17) || day === 6 || day === 0;
            let targetMonday = getMonday(now);
            if (isPlanningNextCycle) targetMonday.setDate(targetMonday.getDate() + 7);
            const targetMondayStr = toLocalISOString(targetMonday);
            targetPlan = weeklyPlans.find(p => p.type === 'weekly' && p.startDate === targetMondayStr);
            if (!targetPlan) {
                const endDate = new Date(targetMonday);
                endDate.setDate(targetMonday.getDate() + 6);
                targetPlan = { id: `plan_weekly_${Date.now()}`, type: 'weekly', startDate: targetMondayStr, endDate: toLocalISOString(endDate), periodStatus: Array(7).fill('idle'), dailyLogs: Array(7).fill(''), completionRate: 0, goals: [{ id: 'g1', text: "承接实验矩阵任务", completed: false }], tasks: [], status: 'in-progress' };
                updatedPlans = [targetPlan, ...updatedPlans];
            }
        }

        // 智能标题生成逻辑：将 [矩阵任务] 替换为具体的实验参数清单汇总
        const paramSummary = (plan.runs && plan.runs.length > 0)
            ? `[${plan.runs.map(r => `(${plan.matrix.map(m => r.params[m.name] || '-').join(', ')})`).join('; ')}]`
            : '[矩阵任务]';

        const newTask: WeeklyTask = {
            id: `task_proposal_${Date.now()}`,
            title: `${plan.title.replace(' [矩阵任务]', '')} ${paramSummary}`,
            description: `【研究意图】：\n${plan.notes || '尚未填写说明'}`,
            status: 'pending',
            linkedPlanId: plan.id,
            sourceType: 'proposal',
            sourceProposalId: plan.sourceProposalId
        };

        updateWeekly({ viewedWeekId: targetPlan!.id });

        onUpdate({
            ...project,
            weeklyPlans: updatedPlans.map(w => w.id === targetPlan!.id ? {
                ...w,
                tasks: [newTask, ...(w.tasks || [])].filter((item, pos, self) =>
                    self.findIndex(v => v.title === item.title) === pos
                ) as WeeklyTask[]
            } : w)
        });

        showToast({ message: `任务已同步至：${targetPlan!.startDate}`, type: 'success' });
    }, [project, onUpdate, showToast, updateWeekly]);

    const handleStartNextCycle = useCallback((currentPlan: ProjectPlan) => {
        const startDate = parseLocalDate(currentPlan.endDate);
        startDate.setDate(startDate.getDate() + 1);
        const newId = `plan_${currentPlan.type}_${Date.now()}`;
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        if (currentPlan.type === 'weekly') endDate.setDate(startDate.getDate() + 6);
        else if (currentPlan.type === 'monthly') { endDate.setMonth(startDate.getMonth() + 1); endDate.setDate(0); }

        const newPlan: ProjectPlan = { id: newId, type: currentPlan.type, startDate: toLocalISOString(startDate), endDate: toLocalISOString(endDate), completionRate: 0, goals: [{ id: 'g1', text: "启动新周期研究目标", completed: false }], tasks: [], status: 'in-progress', periodStatus: Array(currentPlan.type === 'weekly' ? 7 : currentPlan.type === 'monthly' ? 4 : 12).fill('idle'), dailyLogs: Array(currentPlan.type === 'weekly' ? 7 : currentPlan.type === 'monthly' ? 4 : 12).fill('') };
        onUpdate({ ...project, weeklyPlans: [newPlan, ...(project?.weeklyPlans || [])] });
        updateWeekly({ viewedWeekId: newId });
        showToast({ message: `已成功开启下一周期`, type: 'success' });
    }, [project, onUpdate, updateWeekly, showToast]);

    const handleDeletePlan = useCallback((planId: string, viewedWeekId: string | null) => {
        setConfirmModal({
            show: true, title: '删除周期计划？', desc: '确定要移除该计划周期及其包含的所有任务记录吗？此操作无法撤销。',
            onConfirm: () => {
                const updatedPlans = (project?.weeklyPlans || []).filter(p => p.id !== planId);
                onUpdate({ ...project, weeklyPlans: updatedPlans });
                if (viewedWeekId === planId) updateWeekly({ viewedWeekId: null });
                setConfirmModal(null);
                showToast({ message: '计划周期已移除', type: 'info' });
            }
        });
    }, [project, onUpdate, setConfirmModal, showToast, updateWeekly]);

    const handleDeleteExperimentalPlan = useCallback((planId: string) => {
        setConfirmModal({
            show: true, title: '删除实验矩阵？', desc: '确定要移除该实验矩阵及其包含的所有 Run 记录吗？',
            onConfirm: () => {
                const milestones = project?.milestones || [];
                const nextMilestones = milestones.map(m => ({ ...m, experimentalPlan: (m.experimentalPlan || []).filter(p => p.id !== planId) }));
                onUpdate({ ...project, milestones: nextMilestones });
                setConfirmModal(null);
                showToast({ message: '实验矩阵已移除', type: 'info' });
            }
        });
    }, [project, onUpdate, setConfirmModal, showToast]);

    const handleMoveTaskToNextWeek = useCallback((currentPlanId: string, taskGlobalIdx: number) => {
        const weeklyPlans = project?.weeklyPlans || [];
        const currentPlan = weeklyPlans.find(p => p.id === currentPlanId);
        if (!currentPlan) return;

        const task = currentPlan.tasks[taskGlobalIdx];
        if (!task) return;

        const currentEndDate = parseLocalDate(currentPlan.endDate);
        const nextWeekStart = new Date(currentEndDate);
        nextWeekStart.setDate(currentEndDate.getDate() + 1);
        const nextWeekStartStr = toLocalISOString(nextWeekStart);

        let nextPlan = weeklyPlans.find(p => p.type === 'weekly' && p.startDate === nextWeekStartStr);
        let updatedPlans = [...weeklyPlans];

        if (!nextPlan) {
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            nextPlan = {
                id: `plan_weekly_${Date.now()}`,
                type: 'weekly',
                startDate: nextWeekStartStr,
                endDate: toLocalISOString(nextWeekEnd),
                periodStatus: Array(7).fill('idle'),
                dailyLogs: Array(7).fill(''),
                completionRate: 0,
                goals: [{ id: `g_move_${Date.now()}`, text: "承接跨周期任务", completed: false }],
                tasks: [],
                status: 'in-progress'
            };
            updatedPlans = [nextPlan, ...updatedPlans];
        }

        // 1. Remove task from current plan
        const updatedCurrentTasks = currentPlan.tasks.filter((_, i) => i !== taskGlobalIdx);

        // 2. Add task to next plan (unassigned)
        const newTask = { ...task, assignedDay: undefined, assignedTo: undefined, assignmentReason: undefined };
        const updatedNextTasks = [newTask, ...(nextPlan.tasks || [])].filter((item, pos, self) =>
            self.findIndex(v => v.title === item.title) === pos
        ) as WeeklyTask[];

        // 3. Apply updates
        const finalPlans = updatedPlans.map(w => {
            if (w.id === currentPlan.id) return { ...w, tasks: updatedCurrentTasks };
            if (w.id === nextPlan!.id) return { ...w, tasks: updatedNextTasks };
            return w;
        });

        onUpdate({ ...project, weeklyPlans: finalPlans });
        showToast({ message: `任务已移至下周 (${nextWeekStartStr})`, type: 'success' });
    }, [project, onUpdate, showToast]);

    return {
        handleGenerateWeeklyPlan,
        handleSmartAssignTasks,
        handleClearAssignments,
        handleAddTaskToWeeklyPlan,
        handleStartNextCycle,
        handleDeletePlan,
        handleDeleteExperimentalPlan,
        handleMoveTaskToNextWeek
    };
};
