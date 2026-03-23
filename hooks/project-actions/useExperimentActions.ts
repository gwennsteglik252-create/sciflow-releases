
import React, { useCallback } from 'react';
import { ResearchProject, Milestone, ExperimentLog, PlannedExperiment } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';

interface UseExperimentActionsProps {
  project: ResearchProject;
  onUpdate: (updated: ResearchProject) => void;
  toggleModal: (key: any, value: any) => void;
  updateForm: (key: any, value: any) => void;
  showToast: (msg: any) => void;
  selectedMilestoneId: string | null;
}

export const useExperimentActions = ({
  project, onUpdate, toggleModal, updateForm, showToast, selectedMilestoneId
}: UseExperimentActionsProps) => {
  const { consumeInventoryItems } = useProjectContext();

  const handleSaveLog = useCallback((logData: any) => {
    const selectedMilestone = project.milestones.find(m => m.id === selectedMilestoneId);
    if (!selectedMilestone) return;
    
    const isEdit = !!logData.id;
    const logId = logData.id || Date.now().toString();
    const existingLog = isEdit
      ? selectedMilestone.logs.find(l => l.id === logId)
      : undefined;
    
    const finalLog: ExperimentLog = {
        ...(existingLog || {}),
        ...logData,
        id: logId,
        // 规范化时间戳格式
        timestamp: logData.timestamp || new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
    };

    const nextMilestonesBase = project.milestones.map(m => {
        if (m.id !== selectedMilestone.id) return m;
        
        let newLogs;
        if (isEdit) {
            newLogs = m.logs.map(l => l.id === logId ? finalLog : l);
        } else {
            newLogs = [finalLog, ...m.logs];
        }
        
        return { ...m, logs: newLogs };
    });

    const finalMilestones: Milestone[] = nextMilestonesBase.map(m => ({
        ...m,
        experimentalPlan: m.experimentalPlan?.map(p => {
            if (p.id === logData.linkedPlanId) {
                const updatedRuns = p.runs?.map(r => 
                    r.idx === logData.linkedRunIdx ? { ...r, status: 'executed' as const, logId: logId } : r
                );
                const allDone = updatedRuns?.every(r => r.status === 'executed');
                const nextStatus: 'completed' | 'executing' = allDone ? 'completed' : 'executing';
                
                return { 
                    ...p, 
                    runs: updatedRuns, 
                    status: nextStatus
                };
            }
            return p;
        })
    }));

    if (logData.consumedReagents && logData.consumedReagents.length > 0) {
        consumeInventoryItems(logData.consumedReagents);
    }

    let nextProject = { ...project, milestones: finalMilestones };

    if (logData.linkedPlanId) {
        nextProject.weeklyPlans = (nextProject.weeklyPlans || []).map(plan => ({
            ...plan,
            tasks: plan.tasks.map(t => {
                if (t.linkedPlanId === logData.linkedPlanId) {
                    return { ...t, logId: logId };
                }
                return t;
            })
        }));
    }

    if (logData.matrixEntry) {
        const entry = logData.matrixEntry;
        const newSample = {
            id: Date.now().toString(),
            sampleId: entry.sampleId,
            timestamp: new Date().toISOString(),
            processParams: entry.processParams,
            results: entry.results,
            note: entry.note,
            source: 'workflow' as const, 
            linkedLogId: logId
        };
        const currentMatrices = project.matrices || [];
        const targetMatrixIdx = currentMatrices.findIndex(m => m.id === entry.targetMatrixId);
        if (targetMatrixIdx > -1) {
            const nextMatrices = [...currentMatrices];
            const existingSampleIdx = nextMatrices[targetMatrixIdx].data.findIndex(s => s.sampleId === entry.sampleId);
            if (existingSampleIdx > -1) {
                const nextData = [...nextMatrices[targetMatrixIdx].data];
                nextData[existingSampleIdx] = { ...nextData[existingSampleIdx], ...newSample, id: nextData[existingSampleIdx].id };
                nextMatrices[targetMatrixIdx] = { ...nextMatrices[targetMatrixIdx], data: nextData };
            } else {
                nextMatrices[targetMatrixIdx] = { ...nextMatrices[targetMatrixIdx], data: [newSample, ...nextMatrices[targetMatrixIdx].data] };
            }
            nextProject.matrices = nextMatrices;
        } else {
            nextProject.matrices = [{ id: entry.targetMatrixId, title: 'Default Matrix', data: [newSample] }, ...currentMatrices];
        }
    }

    onUpdate(nextProject);
    toggleModal('log', false);
    showToast({ message: isEdit ? '实验实录已更新并同步矩阵' : '实验实录已保存并同步矩阵', type: 'success' });
  }, [project, selectedMilestoneId, onUpdate, toggleModal, showToast, consumeInventoryItems]);

  const handleUpdateLog = useCallback((updatedLog: ExperimentLog) => {
    const nextMilestones = project.milestones.map(m => ({
        ...m,
        logs: m.logs.map(l => l.id === updatedLog.id ? updatedLog : l)
    }));
    onUpdate({ ...project, milestones: nextMilestones });
  }, [project, onUpdate]);

  const handleSavePlan = useCallback((planData: any, editingPlanId?: string | null) => {
    const selectedMilestone = project.milestones.find(m => m.id === selectedMilestoneId);
    if (!selectedMilestone) return;
    const isNew = !editingPlanId;
    const planId = editingPlanId || Date.now().toString();
    const newPlan: PlannedExperiment = { ...planData, id: planId, status: isNew ? 'planned' : planData.status || 'planned' };

    const nextMilestones = project.milestones.map(m => {
      if (m.id === selectedMilestone.id) {
        const plans = m.experimentalPlan || [];
        return { ...m, experimentalPlan: isNew ? [newPlan, ...plans] : plans.map(p => p.id === planId ? newPlan : p) };
      }
      return m;
    });
    onUpdate({ ...project, milestones: nextMilestones });
    toggleModal('plan', false);
    showToast({ message: '实验设计矩阵已发布', type: 'success' });
  }, [project, selectedMilestoneId, onUpdate, toggleModal, showToast]);

  const handleUpdatePlan = useCallback((updatedPlan: PlannedExperiment) => {
      const nextMilestones = project.milestones.map(m => ({
          ...m,
          experimentalPlan: m.experimentalPlan?.map(p => {
              if (p.id === updatedPlan.id) return updatedPlan;
              return p;
          })
      }));
      onUpdate({ ...project, milestones: nextMilestones });
      showToast({ message: '矩阵设计修订已同步', type: 'success' });
  }, [project, onUpdate, showToast]);

  const handleConvertPlanToLogWithActuals = useCallback((plan: PlannedExperiment, e: React.MouseEvent, runIdx?: number) => {
      e.stopPropagation();
      const targetRun = (typeof runIdx === 'number' && plan.runs && plan.runs[runIdx]) ? plan.runs[runIdx] : null;
      
      const planSnapshot: Record<string, string> = {};
      if (targetRun) {
          Object.entries(targetRun.params).forEach(([k, v]) => { 
              const unit = plan.matrix.find(m => m.name === k)?.target || '';
              planSnapshot[k] = `${v}${unit}`; 
          });
      } else {
          plan.matrix.forEach(m => { planSnapshot[m.name] = `${m.range || ''}${m.target || ''}`; });
      }

      let cleanedSubject = plan.title.replace(/^\[.*?\]\s*/, '').split('(')[0].trim();
      const effectiveRun = targetRun || (plan.runs && plan.runs.length > 0 ? plan.runs[0] : null);
      let conditionStr = '';
      if (effectiveRun) {
          // 对标用户要求的参数格式：逗号分隔
          conditionStr = plan.matrix.map(m => effectiveRun.params[m.name]).filter(v => v).join(', ');
      }
      
      const logName = `${cleanedSubject}${conditionStr ? ` (${conditionStr})` : ''}`;
      const intentLabel = targetRun?.label || '计划内实验';

      const initialLog: Partial<ExperimentLog> = {
          content: logName,
          description: `基于矩阵计划: ${plan.title}。\n设计意图溯源：${intentLabel}\n条件快照已载入对标引擎。`,
          parameters: Object.entries(planSnapshot).map(([k, v]) => `${k}: ${v}`).join(', '),
          result: 'neutral',
          status: 'Pending',
          // 确保新录入的记录使用标准 ISO 日期或易解析格式
          timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
          linkedPlanId: plan.id,
          linkedRunIdx: targetRun ? targetRun.idx : (plan.runs && plan.runs.length > 0 ? plan.runs[0].idx : undefined),
          planSnapshot: planSnapshot 
      };

      updateForm('editingLog', initialLog);
      toggleModal('log', true);
      showToast({ message: `已成功加载【${intentLabel}】对标元数据`, type: 'info' });
  }, [updateForm, toggleModal, showToast]);

  return { handleSaveLog, handleUpdateLog, handleSavePlan, handleUpdatePlan, handleConvertPlanToLogWithActuals };
};
