
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ProjectPlan, PlanType, ResearchProject, WeeklyGoal } from '../types';

export const toLocalISOString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMonday = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); 
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

interface UseWeeklyPlanBoardLogicProps {
  project: ResearchProject;
  viewedWeekId: string | null;
  setViewedWeekId: (id: string | null) => void;
  highlightedTaskId: string | null;
  onClearTaskHighlight?: () => void;
  onUpdate: (updated: ResearchProject) => void;
}

export const useWeeklyPlanBoardLogic = ({
  project,
  viewedWeekId,
  setViewedWeekId,
  highlightedTaskId,
  onClearTaskHighlight,
  onUpdate
}: UseWeeklyPlanBoardLogicProps) => {
  const [activePlanType, setActivePlanType] = useState<PlanType>('weekly');
  const [showTextModal, setShowTextModal] = useState(false);
  const [expandedMode, setExpandedMode] = useState<'none' | 'panorama' | 'backlog'>('none');
  const lastProcessedHighlightRef = useRef<string | null>(null);

  const currentPlans = useMemo(() => project.weeklyPlans || [], [project.weeklyPlans]);

  useEffect(() => {
    if (highlightedTaskId && highlightedTaskId !== lastProcessedHighlightRef.current) {
      // Handle special keywords for view modes
      if (highlightedTaskId === 'panorama' || highlightedTaskId === 'backlog') {
          setExpandedMode(highlightedTaskId as any);
          lastProcessedHighlightRef.current = highlightedTaskId;
          return;
      }

      const targetPlan = currentPlans.find(p => (p.tasks || []).some(t => 
        t.linkedPlanId === highlightedTaskId || t.title.includes(highlightedTaskId)
      ));
      
      if (targetPlan) {
        lastProcessedHighlightRef.current = highlightedTaskId;
        if (targetPlan.type && targetPlan.type !== activePlanType) setActivePlanType(targetPlan.type as PlanType);
        if (viewedWeekId !== targetPlan.id) setViewedWeekId(targetPlan.id);
        
        let attempts = 0;
        const scrollTaskIntoView = () => {
            const taskEl = document.getElementById(`task-${highlightedTaskId}`);
            if (taskEl) {
                taskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (attempts < 20) { 
                attempts++;
                setTimeout(scrollTaskIntoView, 100);
            }
        };
        setTimeout(scrollTaskIntoView, 400);

        const clearTimer = setTimeout(() => {
          onClearTaskHighlight?.();
          lastProcessedHighlightRef.current = null;
        }, 5000);
        return () => clearTimeout(clearTimer);
      }
    }
  }, [highlightedTaskId, currentPlans, activePlanType, viewedWeekId, setViewedWeekId, onClearTaskHighlight]); 

  const planWindowInfo = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); 
    const hour = now.getHours();
    const isPlanningNextCycle = (day === 5 && hour >= 17) || day === 6 || day === 0;
    let targetMonday = getMonday(now);
    if (isPlanningNextCycle) targetMonday.setDate(targetMonday.getDate() + 7);
    return { isPlanningNextCycle, targetMondayStr: toLocalISOString(targetMonday) };
  }, []);

  const filteredTypePlans = useMemo(() => {
    return currentPlans
      .filter(p => p.type === activePlanType || (!p.type && activePlanType === 'weekly'))
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [currentPlans, activePlanType]);

  const activePlan = useMemo(() => {
    if (viewedWeekId) {
      const found = currentPlans.find(p => p.id === viewedWeekId);
      if (found) return found;
    }
    let inProgress = filteredTypePlans.find(p => p.status === 'in-progress');
    if (inProgress) return inProgress;
    const now = new Date();
    let startDate = new Date(); let endDate = new Date(); let pLen = 7;
    if (activePlanType === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      pLen = 4;
    } else if (activePlanType === 'annual') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      pLen = 12;
    } else {
      const baseDate = getMonday(now);
      if (planWindowInfo.isPlanningNextCycle) baseDate.setDate(baseDate.getDate() + 7);
      startDate = baseDate;
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
      pLen = 7;
    }
    const startStr = toLocalISOString(startDate);
    const endStr = toLocalISOString(endDate);
    const draftId = `draft_${activePlanType}_${project.id}_${startStr}`;
    return { id: draftId, type: activePlanType, startDate: startStr, endDate: endStr, periodStatus: Array(pLen).fill('idle'), dailyLogs: Array(pLen).fill(''), completionRate: 0, goals: [{ id: 'g1', text: "启动当前阶段研究", completed: false }], tasks: [], status: 'in-progress' } as ProjectPlan;
  }, [filteredTypePlans, viewedWeekId, activePlanType, project.id, currentPlans, planWindowInfo]);

  const todayIdx = useMemo(() => {
    if (!activePlan || activePlan.type !== 'weekly') return -1;
    const now = new Date();
    const start = parseLocalDate(activePlan.startDate);
    const end = parseLocalDate(activePlan.endDate);
    const d_today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    if (d_today >= start && d_today <= end) return (now.getDay() + 6) % 7;
    return -1;
  }, [activePlan]);

  const isArchived = activePlan.status === 'completed';

  const dynamicTitle = useMemo(() => {
    const startDate = parseLocalDate(activePlan.startDate);
    const month = startDate.getMonth() + 1;
    const day = startDate.getDate();
    const weekOfMonth = Math.ceil(day / 7);
    let prefix = '';
    if (activePlanType === 'weekly' && planWindowInfo.isPlanningNextCycle && activePlan.startDate === planWindowInfo.targetMondayStr) prefix = '【下周预案】';
    if (activePlanType === 'monthly') return `项目月度计划 (${month}月)`;
    if (activePlanType === 'annual') return `年度战略路线图`;
    return `${prefix}项目周计划 (${month}月第${weekOfMonth}周)`;
  }, [activePlan, activePlanType, planWindowInfo]);

  const currentIdx = useMemo(() => filteredTypePlans.findIndex(p => p.id === activePlan.id), [filteredTypePlans, activePlan.id]);

  const handlePrev = () => { if (currentIdx !== -1 && currentIdx < filteredTypePlans.length - 1) setViewedWeekId(filteredTypePlans[currentIdx + 1].id); };
  const handleNext = () => { if (currentIdx > 0) setViewedWeekId(filteredTypePlans[currentIdx - 1].id); else setViewedWeekId(null); };

  const savePlanUpdate = (updatedPlan: ProjectPlan) => {
    if (isArchived) return;
    let completionRate = 0;
    if (updatedPlan.type === 'weekly') {
      const total = updatedPlan.tasks.length + updatedPlan.goals.length;
      completionRate = total > 0 ? Math.round((updatedPlan.tasks.filter(t=>t.status==='completed').length / total) * 100) : 0;
    } else if (updatedPlan.type === 'monthly') {
      const items = updatedPlan.weeklyBreakdown || [];
      const totalTasks = items.reduce((acc, w) => acc + (w.tasks?.length || 0), 0);
      const completedTasks = items.reduce((acc, w) => acc + (w.tasks?.filter(t => t.done).length || 0), 0);
      completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    } else if (updatedPlan.type === 'annual') {
      const items = updatedPlan.annualBreakdown || [];
      const totalKRs = items.reduce((acc, m) => acc + (m.keyResults?.length || 0), 0);
      const completedKRs = items.reduce((acc, m) => acc + (m.keyResults?.filter(k => k.done).length || 0), 0);
      completionRate = totalKRs > 0 ? Math.round((completedKRs / totalKRs) * 100) : 0;
    }
    updatedPlan.completionRate = completionRate;
    if (updatedPlan.id.startsWith('draft_')) updatedPlan.id = `plan_${activePlanType}_${Date.now()}`;
    const newPlans = currentPlans.some(p => p.id === updatedPlan.id) ? currentPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p) : [updatedPlan, ...currentPlans];
    onUpdate({ ...project, weeklyPlans: newPlans });
  };

  return {
    activePlanType, setActivePlanType, activePlan, dynamicTitle, todayIdx, isArchived, handlePrev, handleNext,
    hasPrev: currentIdx !== -1 ? currentIdx < filteredTypePlans.length - 1 : false,
    hasNext: currentIdx > 0,
    savePlanUpdate, showTextModal, setShowTextModal, filteredTypePlans,
    expandedMode, setExpandedMode
  };
};
