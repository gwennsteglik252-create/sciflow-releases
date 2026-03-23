
import React, { useCallback, useMemo } from 'react';
import {
  ResearchProject, Milestone, ExperimentLog, PlannedExperiment,
  TransformationProposal, MilestoneStatus, ProposalStatus
} from '../types';
import { useProjectContext } from '../context/ProjectContext';
import { useExperimentActions } from './project-actions/useExperimentActions';
import { usePlanningActions } from './project-actions/usePlanningActions';
import { useAiAndProposalActions } from './project-actions/useAiAndProposalActions';

interface UseProjectActionsProps {
  project: ResearchProject;
  onUpdate: (updated: ResearchProject) => void;
  toggleModal: (key: any, value: any) => void;
  updateForm: (key: any, value: any) => void;
  updateAi: (updates: any) => void;
  updateWeekly: (updates: any) => void;
  viewState: any;
  setConfirmModal: (config: any) => void;
  onSetAiStatus?: (status: string | null) => void;
  forms: any;
}

export const useProjectActions = ({
  project, onUpdate, toggleModal, updateForm, updateAi, updateWeekly, viewState, setConfirmModal, onSetAiStatus, forms
}: UseProjectActionsProps) => {
  const { userProfile, showToast, teamMembers, startGlobalTask } = useProjectContext();

  const pushUpdate = useCallback((milestones: Milestone[], title?: string) => {
    const updated = { ...project, milestones };
    if (title) updated.title = title;
    onUpdate(updated);
  }, [project, onUpdate]);

  const selectedMilestone = useMemo(() =>
    project.milestones.find(m => m.id === viewState.selectedMilestoneId),
    [project.milestones, viewState.selectedMilestoneId]);

  const experimentActions = useExperimentActions({
    project, onUpdate, toggleModal, updateForm, showToast, selectedMilestoneId: viewState.selectedMilestoneId
  });

  const planningActions = usePlanningActions({
    project, onUpdate, updateAi, updateWeekly, showToast, setConfirmModal, teamMembers, startGlobalTask
  });

  const aiAndProposalActions = useAiAndProposalActions({
    project, onUpdate, updateAi, toggleModal, showToast, selectedMilestoneId: viewState.selectedMilestoneId, startGlobalTask
  });

  const handleApplyWorkflowPreset = useCallback((presetId: string) => {
    let nodesToAdd: Partial<Milestone>[] = [];
    const baseDate = new Date();

    if (presetId === 'standard_char') {
      nodesToAdd = [
        { title: '显微形貌观测 (SEM/TEM)', hypothesis: '验证材料的核壳结构或片层剥离程度' },
        { title: '物相结构鉴定 (XRD)', hypothesis: '确认目标物相的晶体衍射峰位' },
        { title: '表面化学分析 (XPS)', hypothesis: '解构金属活性中心的价态与配位环境' }
      ];
    } else if (presetId === 'electro_eval') {
      nodesToAdd = [
        { title: '电化学活化与 ECSA', hypothesis: '获得稳定的循环伏安曲线与活性面积' },
        { title: '动力学极化测试 (LSV)', hypothesis: '测量过电位与 Tafel 斜率' },
        { title: '服役稳定性考核 (Stability)', hypothesis: '验证 500h 工业级电流下的耐久性' }
      ];
    } else if (presetId === 'comp_exp') {
      nodesToAdd = [
        { title: '理论吸附能预测 (DFT)', hypothesis: '基于 d 带中心理论预测最佳掺杂位点' },
        { title: '定向合成验证', hypothesis: '对标理论预测的参数进行实测' },
        { title: '构效关系总结', hypothesis: '总结物理模型并修正计算参数' }
      ];
    }

    const newMilestones: Milestone[] = nodesToAdd.map((node, idx) => {
      const dueDate = new Date(baseDate);
      dueDate.setDate(baseDate.getDate() + (idx + 1) * 7);
      return {
        id: `preset_${presetId}_${Date.now()}_${idx}`,
        title: node.title!,
        hypothesis: node.hypothesis!,
        status: 'pending' as const,
        dueDate: dueDate.toISOString().split('T')[0],
        logs: [],
        chatHistory: [],
        experimentalPlan: [],
        savedDocuments: []
      };
    });

    pushUpdate([...project.milestones, ...newMilestones]);
    showToast({ message: `已批量注入预设节点序列`, type: 'success' });
  }, [project, pushUpdate, showToast]);

  const handleSaveNode = useCallback(() => {
    const isNew = !forms.editingNodeId;
    const id = forms.editingNodeId || Date.now().toString();
    const { title, hypothesis, date, status, parentId } = forms.nodeData;
    let nextMilestones;
    if (isNew) {
      const newNode: Milestone = { id, title, hypothesis, status, dueDate: date, parentId, logs: [], chatHistory: [], experimentalPlan: [], savedDocuments: [] };
      nextMilestones = [...project.milestones, newNode];
    } else {
      nextMilestones = project.milestones.map(m => m.id === id ? { ...m, title, hypothesis, dueDate: date, status } : m);
    }
    pushUpdate(nextMilestones);
    toggleModal(isNew ? 'addNode' : 'editNode', false);
  }, [forms.editingNodeId, forms.nodeData, project.milestones, pushUpdate, toggleModal]);

  const handleReorderNode = useCallback((dragId: string, dropId: string) => {
    const next = [...project.milestones];
    const dragIdx = next.findIndex(m => m.id === dragId);
    const dropIdx = next.findIndex(m => m.id === dropId);
    if (dragIdx > -1 && dropIdx > -1) {
      const [moved] = next.splice(dragIdx, 1);
      next.splice(dropIdx, 0, moved);
      onUpdate({ ...project, milestones: next });
    }
  }, [project, onUpdate]);

  const handleSaveProjectEdit = useCallback(() => {
    onUpdate({ ...project, ...forms.projectData });
    toggleModal('projectEdit', false);
    showToast({ message: '课题配置已更新', type: 'success' });
  }, [project, forms.projectData, onUpdate, toggleModal, showToast]);

  const handleSaveProposalMeta = useCallback(() => {
    const updated = (project.proposals || []).map(p => p.id === forms.editingProposalId ? { ...p, title: forms.proposalData.title, status: forms.proposalData.status } : p);
    onUpdate({ ...project, proposals: updated });
    toggleModal('editProposal', false);
  }, [project, forms, onUpdate, toggleModal]);

  const handleSaveProposalContent = useCallback(() => {
    const updated = (project.proposals || []).map(p => p.id === forms.tempProposal?.id ? forms.tempProposal : p);
    onUpdate({ ...project, proposals: updated });
    toggleModal('editProposalContent', false);
  }, [project, forms.tempProposal, onUpdate, toggleModal]);

  const handleTrlChange = useCallback((newTrl: number) => {
    onUpdate({ ...project, trl: newTrl });
    showToast({ message: `TRL 已更新至 Level ${newTrl}`, type: 'info' });
  }, [project, onUpdate, showToast]);

  const handleSortMilestones = useCallback(() => {
    const sorted = [...project.milestones].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    onUpdate({ ...project, milestones: sorted });
    showToast({ message: "节点已按时间顺序排列", type: 'success' });
  }, [project, onUpdate, showToast]);

  return {
    ...experimentActions,
    ...planningActions,
    ...aiAndProposalActions,
    pushUpdate,
    handleSaveNode,
    handleReorderNode,
    handleSaveProjectEdit,
    handleSaveProposalMeta,
    handleSaveProposalContent,
    handleTrlChange,
    handleSortMilestones,
    handleApplyWorkflowPreset,
    selectedMilestone,
    handleDeleteReport: (id: string) => onUpdate({ ...project, weeklyReports: project.weeklyReports?.filter(r => r.id !== id) }),
    handleCompareLogs: () => showToast({ message: "正在构建对比矩阵...", type: 'info' }),
    handleGenerateBriefing: () => aiAndProposalActions.handleGenerateBriefing(selectedMilestone?.logs.filter(l => viewState.selectedLogsForComparison.has(l.id)) || []),
    handleDeletePlan: (id: string) => planningActions.handleDeletePlan(id, viewState.viewedWeekId),
    handleDeleteExperimentalPlan: planningActions.handleDeleteExperimentalPlan,
    handleGenerateFromInput: aiAndProposalActions.handleGenerateFromInput,
    handleMoveTaskToNextWeek: planningActions.handleMoveTaskToNextWeek,
  };
};
