
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../locales/useTranslation';
import { ResearchProject, AppView, Milestone, ExperimentLog, PlannedExperiment, TransformationProposal, MatrixReport, MatrixParameter, MatrixRun } from '../types';
import { chatWithMilestoneAI } from '../services/gemini/chat';
import { useProjectState } from '../hooks/useProjectState';
import { useProjectContext } from '../context/ProjectContext';
import { useProjectActions } from '../hooks/useProjectActions';
import WeeklyPlanBoard from './Project/WeeklyPlanBoard';
import ProjectHeader from './Project/ProjectHeader';
import ProjectSidebar from './Project/ProjectSidebar';
import ProjectLogsView from './Project/Views/ProjectLogsView';
import ProjectPlanView from './Project/Views/ProjectPlanView';
import ProcessRouteView from './Project/ProcessRouteView';
import SampleMatrixView from './Project/SampleMatrixView';
import ProjectReportsView from './Project/Views/ProjectReportsView';
import ScientificPresenter from './Project/ScientificPresenter';
import MilestoneDocsView from './Project/Views/MilestoneDocsView';
import ExperimentAdvisorView from './Project/Views/ExperimentAdvisorView';
import ProjectOverviewView from './Project/Views/ProjectOverviewView';
import AcademicModals from './Project/AcademicModals';
import ExperimentFlowPreviewModal from './Project/ExperimentFlowPreviewModal';
import WeeklyExperimentPlanModal from './Project/WeeklyExperimentPlanModal';
import PlanCollectorModal, { CollectedPlanItem } from './Project/PlanCollectorModal';
import { generateExperimentFlowsFromTasks } from '../services/gemini/experiment';
import ScientificMarkdown from './Common/ScientificMarkdown';
import { LogModal } from './Project/LogModal';
import { PlanModal } from './Project/PlanModal';
import { EditNodeModal } from './Project/EditNodeModal';
import { AddNodeModal } from './Project/AddNodeModal';
import ProjectEditModal from './Project/ProjectEditModal';
import EditProposalModal from './Project/EditProposalModal';
import EditProposalContentModal from './Project/EditProposalContentModal';
import SafeModal from './SafeModal';
import ProjectMembersPanel from './Project/ProjectMembersPanel';
import { useProjectRole } from '../hooks/useProjectRole';
import { useRealtimePresence } from '../hooks/useRealtimePresence';

/** 将任意日期字符串标准化为 YYYY-MM-DD（兼容 AI 返回的各种格式） */
const normalizeDateStr = (d: string | undefined): string => {
  if (!d) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
};
import DoeTraceModal from './Project/Views/DoeTraceModal';

interface ProjectDetailProps {
  project: ResearchProject;
  onUpdate: (updated: ResearchProject) => void;
  onBack: () => void;
  activeTasks: any[];
  onStartWeeklyReport: (type: 'weekly' | 'monthly' | 'annual' | 'manual', startDate?: string, endDate?: string) => void;
  Maps: (view: AppView, projectId?: string, subView?: string) => void;
  initialView?: string;
  onSetAiStatus?: (status: string | null) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onUpdate, onBack, activeTasks: propsActiveTasks, onStartWeeklyReport, Maps, initialView = 'logs', onSetAiStatus }) => {
  const { t } = useTranslation();
  const {
    viewState, modals, toggleModal, forms, updateForm, ai, updateAi, weeklyPlan, updateWeekly,
    advisor, updateAdvisor, resetAdvisor
  } = useProjectState(project, initialView);

  const { showToast, setReturnPath, activeTasks: contextActiveTasks, handleRunWeeklyReportTask, returnPath } = useProjectContext();

  const [traceDoeId, setTraceDoeId] = useState<string | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  // ── 实验流自动生成状态 ──
  const [generatedFlows, setGeneratedFlows] = useState<{
    experiments: any[];
    skippedTasks: any[];
  } | null>(null);
  const [lastGeneratedFlows, setLastGeneratedFlows] = useState<{
    experiments: any[];
    skippedTasks: any[];
  } | null>(null);
  const [flowTaskTitles, setFlowTaskTitles] = useState<string[]>([]);
  const [isGeneratingFlows, setIsGeneratingFlows] = useState(false);
  const [weeklyPlanReport, setWeeklyPlanReport] = useState<any[] | null>(null);
  const lastConfirmedExperimentsRef = useRef<any[] | null>(null);

  // ═══ 计划收集篮 ═══
  const [collectedPlanItems, setCollectedPlanItems] = useState<CollectedPlanItem[]>([]);
  const [showPlanCollector, setShowPlanCollector] = useState(false);
  const handleAddToCollector = useCallback((tasks: string[], source: 'route' | 'report' | 'log', sourceLabel: string) => {
    const newItems: CollectedPlanItem[] = tasks.map(task => ({
      id: `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      source,
      sourceLabel,
      task,
      addedAt: Date.now(),
    }));
    setCollectedPlanItems(prev => [...prev, ...newItems]);
    setShowPlanCollector(true);
    showToast({ message: `已添加 ${tasks.length} 项到收集篮`, type: 'success' });
  }, [showToast]);

  // 始终引用最新的 project，防止 stale closure 导致数据覆盖
  const projectRef = useRef(project);
  projectRef.current = project;

  // 实验助理聊天面板自动滚动 ref
  const chatScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ai.showChat && chatScrollRef.current) {
      // 使用 setTimeout 确保 DOM 已更新后再滚动
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [ai.showChat, ai.history.length, ai.isLoading]);

  // ── 权限控制 ──
  const { canEdit, isOwner } = useProjectRole(project.id);

  // ── 协同冲突检测 ──
  const { onlineUsers, hasRemoteChanges, acceptRemoteChanges } = useRealtimePresence({
    projectId: project.id,
    onRemoteUpdate: (newData) => onUpdate(newData),
  });

  // viewer 权限拦截：替换 onUpdate 为 noop
  const guardedOnUpdate = canEdit
    ? onUpdate
    : (_updated: ResearchProject) => {
      showToast({ message: t('projectDetailModule.viewerPermission'), type: 'error' });
    };

  const allActiveTasks = propsActiveTasks || contextActiveTasks || [];

  const isGeneratingReport = useMemo(() => {
    return allActiveTasks.some(t => t.id && String(t.id).startsWith(`weekly_${project.id}`));
  }, [allActiveTasks, project.id]);

  const setConfirmModal = (config: any) => toggleModal('confirm', config);

  const {
    pushUpdate, handleSaveLog, handleSavePlan, handleUpdatePlan, handleSaveNode, handleSaveProjectEdit,
    handleSaveProposalMeta, handleSaveProposalContent, handleDeleteReport, handleAdoptProposal,
    handleDiagnoseLog, handleSummarizeLog, handleAnalyzeMechanism, handleFullAnalysis, handleCompareLogs, handleGenerateBriefing,
    handleTrlChange, handleUpdateLog, handleGenerateWeeklyPlan, handleSmartAssignTasks, handleClearAssignments,
    selectedMilestone, handleAutoGenerateMilestones, handleSortMilestones,
    handleReorderNode, handleStartNextCycle, handleDeletePlan, handleConvertPlanToLogWithActuals,
    handlePushProposalToMatrix, handleDeleteExperimentalPlan,
    handleAddTaskToWeeklyPlan, handleApplyWorkflowPreset, handleGenerateFromInput,
    handleMoveTaskToNextWeek
  } = useProjectActions({
    project, onUpdate: guardedOnUpdate, toggleModal, updateForm, updateAi, updateWeekly, viewState, setConfirmModal, onSetAiStatus, forms
  });

  // ── 实验记录级 AI 助理 ──
  const serializeLogContext = useCallback((log: ExperimentLog) => {
    const sections: string[] = [];
    sections.push(`【${t('projectDetailModule.contextLabels.title')}】${log.content}`);
    sections.push(`【${t('projectDetailModule.contextLabels.time')}】${log.timestamp}`);
    sections.push(`【${t('projectDetailModule.contextLabels.status')}】${log.status} | ${t('projectDetailModule.contextLabels.result')}: ${log.result}`);
    if (log.description) sections.push(`【${t('projectDetailModule.contextLabels.description')}】\n${log.description}`);
    if (log.parameters) sections.push(`【${t('projectDetailModule.contextLabels.rawParams')}】${log.parameters}`);
    if (log.parameterList && log.parameterList.length > 0) {
      sections.push(`【${t('projectDetailModule.contextLabels.paramList')}】\n${log.parameterList.map(p => `  ${p.key}: ${p.value} ${p.unit}`).join('\n')}`);
    }
    if (log.scientificData && Object.keys(log.scientificData).length > 0) {
      sections.push(`【${t('projectDetailModule.contextLabels.scientificData')}】\n${Object.entries(log.scientificData).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
    }
    if (log.files && log.files.length > 0) {
      sections.push(`【${t('projectDetailModule.contextLabels.attachments')}】${log.files.map(f => f.name + (f.description ? ` (${f.description})` : '')).join(', ')}`);
    }
    if (log.consumedReagents && log.consumedReagents.length > 0) {
      sections.push(`【${t('projectDetailModule.contextLabels.reagents')}】\n${log.consumedReagents.map(r => `  ${r.name}: ${r.amount} ${r.unit}`).join('\n')}`);
    }
    if (log.summaryInsight) sections.push(`【${t('projectDetailModule.contextLabels.aiSummary')}】\n${log.summaryInsight}`);
    if (log.auditInsight) sections.push(`【${t('projectDetailModule.contextLabels.aiAudit')}】\n${log.auditInsight}`);
    if (log.mechanismInsight) sections.push(`【${t('projectDetailModule.contextLabels.aiMechanism')}】\n${log.mechanismInsight}`);
    if (log.complianceInsight) sections.push(`【${t('projectDetailModule.contextLabels.compliance')}】\n${log.complianceInsight}`);
    return sections.join('\n\n');
  }, []);

  const handleStartLogChat = useCallback((log: ExperimentLog) => {
    const context = serializeLogContext(log);
    updateAi({
      showChat: true,
      chatLogId: log.id,
      chatLogContext: context,
      chatContextLabel: `${t('projectDetailModule.chatContextPrefix')}${log.content}`,
      history: (log.chatHistory || []) as any[],
      input: ''
    });
  }, [serializeLogContext, updateAi]);

  // 将对话历史持久化到实验记录
  const saveLogChatHistory = useCallback((logId: string, history: any[]) => {
    const latest = projectRef.current;
    const nextMilestones = latest.milestones.map(m => ({
      ...m,
      logs: m.logs.map(l => l.id === logId ? { ...l, chatHistory: history.map(h => ({ role: h.role, text: h.text, timestamp: h.timestamp, images: h.images })) } : l)
    }));
    onUpdate({ ...latest, milestones: nextMilestones });
  }, [onUpdate]);

  const handleSendLogChat = useCallback(async (directMessage?: string) => {
    const message = directMessage || ai.input?.trim();
    if (!message || ai.isLoading) return;

    // 收集图片附件
    const imageDataUrls = (ai.chatAttachments || [])
      .filter((a: any) => a.dataUrl && a.type?.startsWith('image'))
      .map((a: any) => a.dataUrl as string);
    const imagePreviewUrls = (ai.chatAttachments || []).map((a: any) => a.url);

    const userMsg = {
      role: 'user' as const,
      text: message,
      timestamp: new Date().toLocaleTimeString(),
      images: imagePreviewUrls.length > 0 ? imagePreviewUrls : undefined
    };
    const updatedHistory = [...ai.history, userMsg];
    updateAi({ history: updatedHistory, input: '', isLoading: true, chatAttachments: [] });

    try {
      const historyForModel = updatedHistory.slice(-20).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      const contextPrompt = `${t('projectDetailModule.contextPrompt')}\n\n${ai.chatLogContext}`;
      const responseText = await chatWithMilestoneAI(historyForModel, message, contextPrompt, imageDataUrls.length > 0 ? imageDataUrls : undefined);

      const modelMsg = { role: 'model' as const, text: responseText || t('projectDetailModule.noResponse'), timestamp: new Date().toLocaleTimeString() };
      const finalHistory = [...updatedHistory, modelMsg];
      updateAi({ history: finalHistory, isLoading: false });
      // Auto-persist to experiment log
      if (ai.chatLogId) saveLogChatHistory(ai.chatLogId, finalHistory);
    } catch (e) {
      showToast({ message: t('projectDetailModule.aiEngineTimeout'), type: 'error' });
      updateAi({ isLoading: false });
    }
  }, [ai.input, ai.isLoading, ai.history, ai.chatLogContext, ai.chatAttachments, ai.chatLogId, updateAi, showToast, saveLogChatHistory]);

  // Enhanced return logic: prioritizing return path if present (e.g., virtual lab)
  const handleBackInternal = useCallback(() => {
    if (returnPath) {
      const path = returnPath;
      setReturnPath(null);
      if (path.startsWith('#')) {
        window.location.hash = path;
      } else {
        window.location.hash = `#${path}`;
      }
    } else {
      onBack();
    }
  }, [returnPath, onBack, setReturnPath]);

  const handleTraceSourceProposal = (proposalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    viewState.setExpandedProposalIds((prev: Set<string>) => {
      const next = new Set(prev);
      next.add(proposalId);
      return next;
    });
    // 统一通过渲染引擎跳转
    Maps('project_detail', project.id, 'process');
    showToast({ message: t('projectDetailModule.tracingFlowchart'), type: 'info' });
  };

  const handleTraceDoe = (doeId: string, planId?: string) => {
    const subView = planId ? `${viewState.activeView}:${planId}` : viewState.activeView;
    const exactPath = `#project/${project.id}/${subView}`;

    setReturnPath(exactPath);
    Maps('doe', undefined, doeId);
    showToast({ message: t('projectDetailModule.tracingDOE'), type: 'info' });
  };

  const handleNavigateToBoard = (planId: string) => {
    // 通过路由子路径高亮任务
    Maps('project_detail', project.id, `plan_board:${planId}`);
    showToast({ message: t('projectDetailModule.navigatedToSchedule'), type: 'success' });
  };

  const handleTracePlan = (planId: string) => {
    const ownerMilestone = project.milestones.find(m =>
      m.experimentalPlan?.some(p => p.id === planId)
    );

    if (ownerMilestone) {
      // 选中正确的里程碑并跳转
      viewState.setSelectedMilestoneId(ownerMilestone.id);
      Maps('project_detail', project.id, `plan:${planId}`);
      showToast({ message: t('projectDetailModule.tracedToMatrix', { title: ownerMilestone.title }), type: 'success' });
    } else {
      Maps('project_detail', project.id, 'plan');
      showToast({ message: t('projectDetailModule.searchingMatrix'), type: 'info' });
    }
  };

  const handleTraceLog = (logId: string) => {
    const ownerMilestone = project.milestones.find(m =>
      m.logs.some(l => l.id === logId)
    );

    if (ownerMilestone) {
      viewState.setSelectedMilestoneId(ownerMilestone.id);
      viewState.setHighlightLogId(logId);
      viewState.setExpandedLogIds((prev: Set<string>) => {
        const next = new Set(prev);
        next.add(logId);
        return next;
      });

      Maps('project_detail', project.id, 'logs');
      showToast({ message: t('projectDetailModule.tracingLog'), type: 'success' });

      setTimeout(() => viewState.setHighlightLogId(null), 5000);
    } else {
      showToast({ message: t('projectDetailModule.logNotFound'), type: 'error' });
    }
  };

  const handleStartReportAction = (type?: 'weekly' | 'monthly' | 'annual' | 'manual', startDate?: string, endDate?: string) => {
    if (type === 'manual') {
      updateAi({
        currentReport: {
          title: `${t('projectDetailModule.reportTitlePrefix')}${new Date().toLocaleDateString()}`,
          content: '',
          sourceLogIds: []
        }
      });
      toggleModal('weekly', true);
    } else {
      const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;
      handleRunWeeklyReportTask(project, type, dateRange).then(() => {
        Maps('project_detail', project.id, 'reports');
      });
    }
  };

  // ── Push Weekly Plan → AI Generated Experiment Flow ──
  const handleRequestExperimentFlows = useCallback(async (tasks: string[]) => {
    console.log('[ExperimentFlows] Triggering generation, tasks count:', tasks.length, 'Tasks:', tasks);
    if (!tasks.length || isGeneratingFlows) {
      console.warn('[ExperimentFlows] Skipping: tasks empty or generating', { tasksLen: tasks.length, isGeneratingFlows });
      return;
    }
    setFlowTaskTitles(tasks);
    setIsGeneratingFlows(true);
    showToast({ message: t('projectDetailModule.generatingExperimentFlow'), type: 'info' });

    try {
      const allLogs = project.milestones.flatMap(m => m.logs || []);
      const recentLogs = allLogs.slice(-10).map(l => ({
        content: l.content,
        parameters: l.parameters || '',
        description: l.description || '',
        scientificData: l.scientificData
      }));

      // ── Collect Historical Optimal Conditions & AI Insights ──
      const optimalConditions = {
        // AI analyzed experiment summaries and insights
        insights: allLogs
          .filter(l => l.summaryInsight || l.mechanismInsight)
          .slice(-5)
          .map(l => ({
            title: l.content,
            summary: l.summaryInsight || '',
            mechanism: l.mechanismInsight || '',
            params: l.parameters || '',
            metrics: l.scientificData || {}
          })),
        // 对照组分析报告
        groupAnalyses: allLogs
          .filter(l => (l as any).groupAnalysisInsight)
          .slice(-3)
          .map(l => (l as any).groupAnalysisInsight as string),
        // Best performing experiment records (KPI optimized)
        bestPerformers: allLogs
          .filter(l => l.scientificData && Object.keys(l.scientificData).length > 0)
          .sort((a, b) => {
            const scoreA = Object.values(a.scientificData || {}).reduce((s, v) => s + (Math.abs(Number(v)) || 0), 0);
            const scoreB = Object.values(b.scientificData || {}).reduce((s, v) => s + (Math.abs(Number(v)) || 0), 0);
            return scoreB - scoreA;
          })
          .slice(0, 3)
          .map(l => ({
            title: l.content,
            params: l.parameters || '',
            parameterList: l.parameterList,
            metrics: l.scientificData
          }))
      };

      // Load user-saved template presets
      let userTemplates: { name: string; description: string; parameters: { key: string; value: string; unit: string }[] }[] = [];
      try {
        const saved = localStorage.getItem('sciflow_log_templates');
        if (saved) {
          const parsed = JSON.parse(saved);
          userTemplates = Array.isArray(parsed) ? parsed.map((t: any) => ({
            name: t.name || '',
            description: t.description || '',
            parameters: Array.isArray(t.parameters) ? t.parameters : []
          })) : [];
        }
      } catch { /* Ignore parsing errors */ }

      const result = await generateExperimentFlowsFromTasks(
        project.title,
        tasks,
        project.milestones.map(m => ({ id: m.id, title: m.title })),
        recentLogs,
        userTemplates,
        optimalConditions
      );

      console.log('[ExperimentFlows] AI result:', {
        experiments: result.experiments?.length,
        skippedTasks: result.skippedTasks?.length
      });

      if (result.experiments.length > 0) {
        setGeneratedFlows(result);
        showToast({ message: t('projectDetailModule.aiGenerated', { count: String(result.experiments.length) }), type: 'success' });
      } else {
        showToast({ message: t('projectDetailModule.noExperimentTasks'), type: 'info' });
      }
    } catch (e: any) {
      console.error('[ExperimentFlows] Generation failed:', e);
      showToast({ message: `${t('projectDetailModule.experimentFlowFailed')}: ${e?.message || ''}`, type: 'error' });
    } finally {
      setIsGeneratingFlows(false);
    }
  }, [project, isGeneratingFlows, showToast]);

  const handleConfirmExperimentFlows = useCallback((selectedExperiments: any[]) => {
    if (!selectedExperiments.length) {
      setGeneratedFlows(null);
      return;
    }

    // Attach to the currently selected milestone
    const targetMilestoneId = viewState.selectedMilestoneId || project.milestones[0]?.id;
    if (!targetMilestoneId) {
      showToast({ message: t('projectDetailModule.noMilestone'), type: 'error' });
      setGeneratedFlows(null);
      return;
    }

    // ── 1. Create Experiment Matrix PlannedExperiment (Keep existing logic) ──
    const newPlans: PlannedExperiment[] = selectedExperiments.map((exp, idx) => {
      const planId = `plan_auto_${Date.now()}_${idx}`;
      return {
        id: planId,
        title: `${t('projectDetailModule.autoFlowPrefix')} ${exp.title}`,
        status: 'planned' as const,
        notes: exp.notes || '',
        parameters: {},
        matrix: (exp.matrix || []).map((m: any) => ({
          name: m.name,
          target: m.target,
          range: m.range
        })) as MatrixParameter[],
        runs: (exp.runs || []).map((r: any) => ({
          idx: r.idx,
          label: r.label,
          params: r.params || {},
          status: 'pending' as const
        })) as MatrixRun[],
        sourceType: 'doe_ai' as const
      };
    });

    // ── 2. Create Experiment Log ExperimentLog (New: one Pending log for each run) ──
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const baseTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newLogs: ExperimentLog[] = [];
    selectedExperiments.forEach((exp, expIdx) => {
      const groupId = `group_auto_${Date.now()}_${expIdx}`;
      const groupLabel = exp.title;
      const runs = exp.runs || [];
      const matrix = exp.matrix || [];

      runs.forEach((run: any, runIdx: number) => {
        // Build parameter list: matrix factors first, followed by others
        let parameterList: { key: string; value: string; unit: string }[];
        const matrixKeys = new Set(matrix.map((m: any) => m.name));

        if (Array.isArray(run.fullParams) && run.fullParams.length > 0) {
          const allParams = run.fullParams.map((p: any) => ({
            key: String(p.key || ''),
            value: String(p.value || ''),
            unit: String(p.unit || '')
          })).filter((p: any) => p.key);

          // Matrix factors first, others later
          const matrixParams = allParams.filter((p: { key: string }) => matrixKeys.has(p.key));
          const otherParams = allParams.filter((p: { key: string }) => !matrixKeys.has(p.key));

          // Fill matrix factors from run.params if missing in fullParams
          if (matrixParams.length === 0 && run.params) {
            Object.entries(run.params).forEach(([key, value]) => {
              const matrixItem = matrix.find((m: any) => m.name === key);
              matrixParams.push({
                key,
                value: String(value),
                unit: matrixItem?.target || ''
              });
            });
          }

          parameterList = [...matrixParams, ...otherParams];
        } else {
          parameterList = Object.entries(run.params || {}).map(([key, value]) => {
            const matrixItem = matrix.find((m: any) => m.name === key);
            return {
              key,
              value: String(value),
              unit: matrixItem?.target || ''
            };
          });
        }
        const parametersStr = parameterList.map(p => `${p.key}: ${p.value}${p.unit ? ' ' + p.unit : ''}`).join(', ');

        newLogs.push({
          id: `log_auto_${Date.now()}_${expIdx}_${runIdx}`,
          timestamp: baseTimestamp + `:${pad(runIdx)}`,
          content: run.label || `Run #${run.idx}`,
          description: run.description || exp.notes || '',
          parameters: parametersStr,
          parameterList,
          scientificData: {},
          files: [],
          result: 'neutral',
          status: 'Pending',
          sampleId: run.sampleId || '',
          groupId,
          groupLabel,
          linkedPlanId: newPlans[expIdx]?.id,
          linkedRunIdx: runIdx,
          planSnapshot: run.params || {}
        });
      });
    });

    // Use ref for latest project data to avoid stale closures overwriting fields
    const latestProject = projectRef.current;

    const nextMilestones = latestProject.milestones.map(m => {
      if (m.id !== targetMilestoneId) return m;
      return {
        ...m,
        experimentalPlan: [...newPlans, ...(m.experimentalPlan || [])],
        logs: [...(m.logs || []), ...newLogs]
      };
    });

    // ── 4. Synchronously link WeeklyTask ↔ PlannedExperiment ──
    const planIdMap = new Map<number, string>();
    selectedExperiments.forEach((exp, idx) => {
      planIdMap.set(exp.sourceTaskIndex, newPlans[idx].id);
    });

    const nextWeeklyPlans = (latestProject.weeklyPlans || []).map(plan => ({
      ...plan,
      tasks: plan.tasks.map((t, tIdx) => {
        // Match via task title
        const matchedIdx = flowTaskTitles.findIndex(ft => t.title.includes(ft) || ft.includes(t.title));
        const linkedId = matchedIdx >= 0 ? planIdMap.get(matchedIdx) : undefined;
        return linkedId ? { ...t, linkedPlanId: linkedId } : t;
      })
    }));

    onUpdate({ ...latestProject, milestones: nextMilestones, weeklyPlans: nextWeeklyPlans, lastExperimentPlan: selectedExperiments });

    const targetMs = latestProject.milestones.find(m => m.id === targetMilestoneId);
    showToast({
      message: t('projectDetailModule.flowGenerated', { planCount: String(newPlans.length), logCount: String(newLogs.length), milestone: targetMs?.title || '' }),
      type: 'success'
    });
    setLastGeneratedFlows(generatedFlows);
    setGeneratedFlows(null);
    // Display weekly plan report modal
    setWeeklyPlanReport(selectedExperiments);
    lastConfirmedExperimentsRef.current = selectedExperiments;
  }, [project, viewState.selectedMilestoneId, flowTaskTitles, onUpdate, showToast]);

  const renderActiveView = () => {
    switch (viewState.activeView) {
      case 'overview':
        return (
          <ProjectOverviewView
            project={project}
            onTabChange={(v) => Maps('project_detail', project.id, v)}
          />
        );
      case 'logs':
        return (
          <ProjectLogsView
            selectedMilestone={selectedMilestone}
            viewState={viewState}
            ai={ai}
            onCompareLogs={handleCompareLogs}
            onGenerateBriefing={handleGenerateBriefing}
            onStartAiChat={() => updateAi({ showChat: true, chatContextLabel: selectedMilestone?.title || '', chatLogId: null, chatLogContext: '', history: [], input: '' })}
            onStartLogChat={handleStartLogChat}
            onOpenLogModal={(log) => { updateForm('editingLog', log || null); toggleModal('log', true); }}
            onOpenDocuments={() => Maps('project_detail', project.id, 'milestone_docs')}
            onOpenArchives={() => Maps('project_detail', project.id, 'reports')}
            onDiagnoseLog={handleDiagnoseLog}
            onSummarizeLog={handleSummarizeLog}
            onAnalyzeMechanism={handleAnalyzeMechanism}
            onFullAnalysis={handleFullAnalysis}
            onDeleteLog={(id) => {
              const nextMilestones = project.milestones.map(m => m.id === viewState.selectedMilestoneId ? { ...m, logs: m.logs.filter(l => l.id !== id) } : m);
              pushUpdate(nextMilestones);
            }}
            onDeleteGroup={(groupId) => {
              const nextMilestones = project.milestones.map(m => m.id === viewState.selectedMilestoneId ? { ...m, logs: m.logs.filter(l => l.groupId !== groupId) } : m);
              pushUpdate(nextMilestones);
            }}
            onUpdateLog={handleUpdateLog}
            onShowInsightView={(title, content) => updateAi({ currentInsight: { title, content } })}
            highlightLogId={viewState.highlightLogId}
            projectTargets={project.targetMetrics}
            onTracePlan={handleTracePlan}
            onAddToCollector={(log) => {
              const paramsText = log.parameterList?.map((p: any) => `${p.key}: ${p.value}${p.unit ? ' ' + p.unit : ''}`).join('; ') || log.parameters || '';
              const metricsText = log.scientificData ? Object.entries(log.scientificData).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
              const task = [
                `基于实验「${log.content}」的结果设计后续实验`,
                log.description ? `实验描述：${log.description}` : '',
                paramsText ? `实验参数：${paramsText}` : '',
                metricsText ? `实验结果：${metricsText}` : '',
                `实验状态：${log.status}，结果：${log.result || '未记录'}`,
                `请基于以上实验结果，设计针对性的后续实验方案，优化关键参数或探索新方向`,
              ].filter(Boolean).join('\n');
              handleAddToCollector([task], 'log', log.content);
            }}
          />
        );
      case 'reports':
        return (
          <ProjectReportsView
            project={project}
            updateAi={updateAi}
            onDeleteReport={handleDeleteReport}
            onStartWeeklyReport={handleStartReportAction}
            isGenerating={isGeneratingReport}
            toggleModal={toggleModal}
            onUpdateProject={onUpdate}
            onViewGeneratedFlows={lastGeneratedFlows ? () => setGeneratedFlows(lastGeneratedFlows) : undefined}
            onViewExperimentPlan={project.lastExperimentPlan?.length ? () => setWeeklyPlanReport(project.lastExperimentPlan!) : (lastConfirmedExperimentsRef.current ? () => setWeeklyPlanReport(lastConfirmedExperimentsRef.current) : undefined)}
            onAddToCollector={(tasks: string[], sourceLabel: string) => handleAddToCollector(tasks, 'report', sourceLabel)}
          />
        );
      case 'plan':
        return (
          <ProjectPlanView
            project={project}
            selectedMilestone={selectedMilestone}
            onOpenPlanModal={(plan) => { updateForm('editingPlan', plan || null); toggleModal('plan', true); }}
            onAddTaskToWeeklyPlan={(plan, e) => {
              handleAddTaskToWeeklyPlan(plan, e);
            }}
            onConvertPlanToLogWithActuals={handleConvertPlanToLogWithActuals}
            onTraceProposal={handleTraceSourceProposal}
            onTraceDoe={handleTraceDoe}
            onTraceLog={handleTraceLog}
            onTraceLiterature={(id) => Maps('literature', project.id, `${id}_rm`)}
            onViewDoeArchive={(id) => setTraceDoeId(id)}
            onDeletePlan={handleDeleteExperimentalPlan}
            highlightedPlanId={viewState.highlightedPlanId}
            onClearHighlight={() => viewState.setHighlightedPlanId(null)}
            onNavigateToBoard={handleNavigateToBoard}
            collectedPlanCount={collectedPlanItems.length}
            onOpenCollector={() => setShowPlanCollector(true)}
          />
        );
      case 'process':
        return (
          <ProcessRouteView
            project={project}
            expandedProposalIds={viewState.expandedProposalIds}
            onToggleExpansion={(id) => viewState.setExpandedProposalIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            onUpdateProject={onUpdate}
            onAdoptProposal={handleAdoptProposal}
            onLinkPlan={handlePushProposalToMatrix}
            onAddSubProposal={(parentId) => {
              updateForm('editingNodeId', null);
              updateForm('nodeData', { title: '', hypothesis: '', date: new Date().toISOString().split('T')[0], status: 'pending', parentId });
              toggleModal('addNode', true);
            }}
            onEditContent={(prop) => { updateForm('tempProposal', prop); toggleModal('editProposalContent', true); }}
            onEditMeta={(id, title, status) => { updateForm('editingProposalId', id); updateForm('proposalData', { title, status }); toggleModal('editProposal', true); }}
            onDelete={(id) => onUpdate({ ...projectRef.current, proposals: projectRef.current.proposals?.filter(p => p.id !== id) })}
            Maps={Maps}
            onAddToCollector={(tasks: string[], sourceLabel: string) => handleAddToCollector(tasks, 'route', sourceLabel)}
          />
        );
      case 'plan_board':
        return (
          <WeeklyPlanBoard
            project={project}
            onUpdate={onUpdate}
            onBack={handleBackInternal}
            onStartWeeklyReport={() => onStartWeeklyReport('weekly')}
            onGenerateWeeklyPlan={handleGenerateWeeklyPlan}
            onSmartAssignTasks={handleSmartAssignTasks}
            onClearAssignments={handleClearAssignments}
            onStartNextCycle={handleStartNextCycle}
            onDeletePlan={handleDeletePlan}
            onNavigate={Maps}
            viewedWeekId={weeklyPlan.viewedWeekId}
            setViewedWeekId={(id) => updateWeekly({ viewedWeekId: id })}
            editingGoalIdx={weeklyPlan.editingGoalIdx}
            setEditingGoalIdx={(idx) => updateWeekly({ editingGoalIdx: idx })}
            goalInput={weeklyPlan.goalInput}
            setGoalInput={(val) => updateWeekly({ goalInput: val })}
            isAddingTask={weeklyPlan.isAddingTask}
            setIsAddingTask={(val) => updateWeekly({ isAddingTask: val })}
            newTaskInput={weeklyPlan.newTaskInput}
            setNewTaskInput={(val) => updateWeekly({ newTaskInput: val })}
            isAiLoading={allActiveTasks.some(t => t.id === 'weekly_plan_gen' || t.id === 'task_assign')}
            onToggleFocus={() => viewState.setIsSidebarVisible(!viewState.isSidebarVisible)}
            isFocused={!viewState.isSidebarVisible}
            onTracePlan={handleTracePlan}
            onTraceLog={handleTraceLog}
            onTraceDog={handleTraceLog}
            onTraceDoe={handleTraceDoe}
            highlightedTaskId={viewState.highlightedTaskId}
            onClearTaskHighlight={() => viewState.setHighlightedTaskId(null)}
            onMoveTaskToNextWeek={handleMoveTaskToNextWeek}
            collectedPlanCount={collectedPlanItems.length}
            onOpenCollector={() => setShowPlanCollector(true)}
          />
        );
      case 'sample_matrix':
        return (
          <SampleMatrixView
            project={project}
            onUpdate={onUpdate}
            onSetAiStatus={onSetAiStatus}
            onTraceLog={handleTraceLog}
          />
        );
      case 'presentation':
        return <ScientificPresenter project={project} />;
      case 'advisor':
        return (
          <ExperimentAdvisorView
            project={project}
            selectedMilestone={selectedMilestone ?? null}
            onUpdateProject={onUpdate}
            advisor={advisor}
            updateAdvisor={updateAdvisor}
            resetAdvisor={resetAdvisor}
          />
        );
      case 'milestone_docs':
        return (
          <MilestoneDocsView
            milestone={selectedMilestone}
            onUpdateMilestone={(ms) => pushUpdate(project.milestones.map(m => m.id === ms.id ? ms : m))}
            updateAi={updateAi}
            toggleModal={toggleModal}
            onBackToWorkflow={() => Maps('project_detail', project.id, 'logs')}
            onTraceLog={handleTraceLog}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden relative">
      <ProjectHeader
        project={project}
        onBack={handleBackInternal}
        activeView={viewState.activeView}
        onTabChange={(v) => Maps('project_detail', project.id, v)}
        onEditProject={() => canEdit ? toggleModal('projectEdit', true) : showToast({ message: t('projectDetailModule.viewerShort'), type: 'error' })}
        isGeneratingWeekly={isGeneratingReport}
        onStartWeeklyReport={handleStartReportAction}
        onOpenMembers={isOwner ? () => setShowMembersPanel(true) : undefined}
        onlineUsers={onlineUsers}
      />

      {/* ── 协同冲突横幅 ── */}
      {hasRemoteChanges && (
        <div className="mx-1 mb-2 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 shadow-sm animate-reveal">
          <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
          <span className="text-[11px] font-bold text-amber-800 flex-1">{t('projectDetailModule.remoteUpdate')}</span>
          <button
            onClick={acceptRemoteChanges}
            className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 transition-all active:scale-95"
          >
            {t('projectDetailModule.acceptRemote')}
          </button>
          <button
            onClick={() => showToast({ message: t('projectDetailModule.keptLocal'), type: 'info' })}
            className="px-4 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-[10px] font-black uppercase hover:bg-amber-50 transition-all active:scale-95"
          >
            {t('projectDetailModule.keepLocal')}
          </button>
        </div>
      )}

      {/* ── viewer 权限提示横幅 ── */}
      {!canEdit && (
        <div className="mx-1 mb-2 flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-5 py-2.5">
          <i className="fa-solid fa-eye text-slate-400 text-xs"></i>
          <span className="text-[10px] font-bold text-slate-500">{t('projectDetailModule.viewerBanner').split('{role}')[0]}<span className="text-indigo-600">{t('projectDetailModule.viewerRole')}</span>{t('projectDetailModule.viewerBanner').split('{role}')[1]}</span>
        </div>
      )}


      <div className="flex-1 flex gap-0 min-h-0">
        {/* ── 侧边栏收起后的展开按钮 ── */}
        {!viewState.isSidebarVisible && viewState.activeView !== 'plan_board' && (
          <div className="flex flex-col items-center pt-4 gap-3 shrink-0 px-1.5">
            <button
              onClick={() => viewState.setIsSidebarVisible(true)}
              className="w-9 h-9 bg-white border-2 border-indigo-200 rounded-xl flex items-center justify-center shadow-lg hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all active:scale-95 text-indigo-500"
              title={t('projectDetailModule.expandTopology')}
            >
              <i className="fa-solid fa-angles-right text-xs"></i>
            </button>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>{t('projectDetailModule.topologyLabel')}</span>
          </div>
        )}

        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        {viewState.isSidebarVisible && (
          <ProjectSidebar
            trl={project.trl}
            onTrlChange={handleTrlChange}
            milestones={project.milestones}
            selectedMilestoneId={viewState.selectedMilestoneId}
            onSelectMilestone={(id) => viewState.setSelectedMilestoneId(id)}
            foldedNodeIds={viewState.foldedNodeIds}
            onToggleFold={(id, e) => { e.stopPropagation(); viewState.setFoldedNodeIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }}
            onMoveNode={() => { }}
            onBranchNode={(id, e) => {
              e.stopPropagation();
              updateForm('editingNodeId', null);
              updateForm('nodeData', { title: '', hypothesis: '', date: new Date().toISOString().split('T')[0], status: 'pending', parentId: id });
              toggleModal('addNode', true);
            }}
            onEditNode={(ms, e) => { e.stopPropagation(); updateForm('editingNodeId', ms.id); updateForm('nodeData', { title: ms.title, hypothesis: ms.hypothesis, status: ms.status, date: normalizeDateStr(ms.dueDate) }); toggleModal('editNode', true); }}
            onDeleteNode={(id, e) => { e.stopPropagation(); pushUpdate(project.milestones.filter(m => m.id !== id)); }}
            onAddNode={() => { updateForm('editingNodeId', null); updateForm('nodeData', { title: '', hypothesis: '', date: new Date().toISOString().split('T')[0], status: 'pending' }); toggleModal('addNode', true); }}
            onSortNodes={handleSortMilestones}
            onReorderNode={handleReorderNode}
            onShowBlueprint={() => updateAi({ showBlueprint: true })}
            hasBlueprint={!!project.frameworkRationale}
            onGenerateFromInput={handleGenerateFromInput}
            onCollapse={() => viewState.setIsSidebarVisible(false)}
          />
        )}

        <div className={`col-span-1 ${ai.showChat ? (viewState.isSidebarVisible ? 'lg:col-span-5' : 'lg:col-span-8') : (viewState.isSidebarVisible ? 'lg:col-span-9' : 'lg:col-span-12')} bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[500px] transition-all duration-300`}>
          {renderActiveView()}
        </div>

        {/* 实验记录 AI 助理——内联面板（增强版） */}
        {ai.showChat && (() => {
          const logChatFileRef = React.createRef<HTMLInputElement>();
          const suggestions = [
            { icon: 'fa-file-lines', text: t('projectDetailModule.chatSuggestions.summarize'), color: 'bg-violet-50 text-violet-700 border-violet-200' },
            { icon: 'fa-stethoscope', text: t('projectDetailModule.chatSuggestions.diagnose'), color: 'bg-rose-50 text-rose-700 border-rose-200' },
            { icon: 'fa-atom', text: t('projectDetailModule.chatSuggestions.mechanism'), color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { icon: 'fa-chart-line', text: t('projectDetailModule.chatSuggestions.metrics'), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { icon: 'fa-lightbulb', text: t('projectDetailModule.chatSuggestions.optimize'), color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { icon: 'fa-scale-balanced', text: t('projectDetailModule.chatSuggestions.compare'), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          ];
          return (
            <div className="col-span-1 lg:col-span-4 flex flex-col bg-white rounded-[2rem] shadow-xl border border-indigo-200 overflow-hidden min-h-[500px] animate-in slide-in-from-right duration-300">
              <header className="px-5 py-3 bg-slate-900 text-white flex justify-between items-center shrink-0 rounded-t-[2rem]">
                <div className="min-w-0 flex-1 mr-3">
                  <h3 className="text-sm font-black uppercase italic flex items-center gap-2"><i className="fa-solid fa-user-astronaut text-amber-400"></i> {t('projectDetailModule.experimentAssistant')}</h3>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={ai.chatContextLabel}>{ai.chatContextLabel}</p>
                </div>
                <button onClick={() => updateAi({ showChat: false, chatLogId: null, chatLogContext: '', chatContextLabel: '' })} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center shrink-0"><i className="fa-solid fa-xmark text-sm"></i></button>
              </header>

              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                {/* 空状态——引导式快捷提问 */}
                {ai.history.length === 0 && !ai.isLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-5 py-6 animate-reveal">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center shadow-inner border-2 border-dashed border-indigo-200">
                      <i className="fa-solid fa-user-astronaut text-2xl text-indigo-400"></i>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-700 italic">{t('projectDetailModule.chatGreeting')}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">{t('projectDetailModule.chatSubtitle')}</p>
                    </div>
                    <div className="w-full grid grid-cols-1 gap-1.5 px-2">
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => handleSendLogChat(s.text)} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${s.color}`}>
                          <i className={`fa-solid ${s.icon} text-[10px]`}></i>
                          <span className="text-[10px] font-bold">{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 对话消息 */}
                {ai.history.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group/chatmsg`}>
                    <div className={`relative max-w-[90%] p-3 rounded-2xl shadow-sm text-[12px] ${msg.role === 'user' ? 'bg-indigo-400/90 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                      {/* 用户图片附件展示 */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                          {msg.images.map((imgUrl, idx) => (
                            <img key={idx} src={imgUrl} className="w-20 h-20 object-cover rounded-lg border-2 border-white/30 shadow-sm" alt={`Attachment ${idx + 1}`} />
                          ))}
                        </div>
                      )}
                      <div className="markdown-body text-[12px] leading-relaxed"><ScientificMarkdown content={msg.text} /></div>
                      <div className={`flex items-center justify-between mt-1.5`}>
                        <p className={`text-[7px] font-black uppercase ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-300'}`}>{msg.timestamp}</p>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(msg.text); showToast({ message: t('projectDetailModule.copiedToClipboard'), type: 'success' }); }}
                            className="opacity-0 group-hover/chatmsg:opacity-100 transition-opacity w-5 h-5 rounded-md bg-slate-50 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center"
                            title={t('common.copy')}
                          >
                            <i className="fa-solid fa-copy text-[8px]"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {ai.isLoading && <div className="flex justify-start"><div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2"><i className="fa-solid fa-spinner animate-spin text-indigo-600 text-xs"></i><span className="text-[9px] font-black text-slate-400 uppercase">{t('projectDetailModule.analyzingData')}</span></div></div>}
              </div>

              {/* 图片附件预览 */}
              {ai.chatAttachments && ai.chatAttachments.length > 0 && (
                <div className="px-3 pt-2 flex gap-2 flex-wrap">
                  {ai.chatAttachments.map((file: any, i: number) => (
                    <div key={i} className="group relative w-14 h-14 rounded-xl overflow-hidden border-2 border-indigo-200 shadow-sm">
                      <img src={file.url} className="w-full h-full object-cover" alt="" />
                      <button onClick={() => updateAi({ chatAttachments: ai.chatAttachments.filter((_: any, idx: number) => idx !== i) })} className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px]"><i className="fa-solid fa-times"></i></button>
                    </div>
                  ))}
                </div>
              )}

              {/* 输入区 */}
              <div className="p-3 bg-white border-t border-slate-100">
                <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                  <button onClick={() => logChatFileRef.current?.click()} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center shadow-sm shrink-0" title={t('projectDetailModule.uploadImage')}>
                    <i className="fa-solid fa-paperclip text-xs"></i>
                  </button>
                  <input type="file" ref={logChatFileRef} className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const prev = ai.chatAttachments || [];
                        updateAi({ chatAttachments: [...prev, { name: file.name, url, type: file.type, dataUrl }] });
                      };
                      reader.readAsDataURL(file);
                    }
                    e.target.value = '';
                  }} />
                  <textarea className="flex-1 bg-transparent border-none p-2 text-[12px] font-medium outline-none resize-none max-h-28 min-h-[36px] custom-scrollbar" placeholder={t('projectDetailModule.chatPlaceholder')} rows={1} value={ai.input} onChange={(e) => updateAi({ input: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendLogChat(); } }} />
                  <button onClick={() => handleSendLogChat()} disabled={(!ai.input?.trim() && !(ai.chatAttachments?.length > 0)) || ai.isLoading} className="w-8 h-8 bg-indigo-600 text-white rounded-lg shadow-lg active:scale-90 transition-all disabled:opacity-30 shrink-0 flex items-center justify-center"><i className="fa-solid fa-paper-plane text-xs"></i></button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      </div>

      <LogModal
        show={modals.log}
        onClose={() => toggleModal('log', false)}
        onSave={handleSaveLog}
        editingLog={forms.editingLog}
        projectMatrices={project.matrices}
        projectTargets={project.targetMetrics}
        allLogs={selectedMilestone?.logs}
      />

      <PlanModal
        show={modals.plan}
        onClose={() => toggleModal('plan', false)}
        onSave={handleSavePlan}
        onUpdate={handleUpdatePlan}
        editingPlan={forms.editingPlan}
      />

      <EditNodeModal
        show={modals.editNode}
        onClose={() => toggleModal('editNode', false)}
        data={forms.nodeData}
        setData={(d) => updateForm('nodeData', d)}
        onSave={handleSaveNode}
      />

      <AddNodeModal
        show={modals.addNode}
        onClose={() => toggleModal('addNode', false)}
        data={forms.nodeData}
        setData={(d) => updateForm('nodeData', d)}
        onSave={handleSaveNode}
      />

      <ProjectEditModal
        show={modals.projectEdit}
        onClose={() => toggleModal('projectEdit', false)}
        data={forms.projectData}
        setData={(d) => updateForm('projectData', d)}
        onSave={handleSaveProjectEdit}
      />

      <EditProposalModal
        show={modals.editProposal}
        onClose={() => toggleModal('editProposal', false)}
        data={forms.proposalData}
        setData={(d) => updateForm('proposalData', d)}
        onSave={handleSaveProposalMeta}
      />

      <EditProposalContentModal
        show={modals.editProposalContent}
        onClose={() => toggleModal('editProposalContent', false)}
        proposal={forms.tempProposal}
        setProposal={(p) => updateForm('tempProposal', p)}
        onSave={handleSaveProposalContent}
      />

      <AcademicModals
        showWeekly={modals.weekly}
        weeklyReport={ai.currentReport}
        projectId={project.id}
        onCloseWeekly={() => toggleModal('weekly', false)}
        onSaveWeekly={(content, title, id) => {
          if (id) {
            onUpdate({ ...projectRef.current, weeklyReports: projectRef.current.weeklyReports?.map(r => r.id === id ? { ...r, title, content } : r) });
          } else {
            const newReport: MatrixReport = {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleString(),
              title,
              content,
              reportType: 'Manual',
              comparisonTable: { headers: [], rows: [] },
              insights: [],
              type: t('projectDetailModule.internalReport')
            };
            onUpdate({ ...projectRef.current, weeklyReports: [newReport, ...(projectRef.current.weeklyReports || [])] });
          }
          toggleModal('weekly', false);
        }}
        onSaveToLibrary={(content, title) => {
          if (!selectedMilestone) return;
          const newDoc = { id: Date.now().toString(), timestamp: new Date().toLocaleString(), title, content };
          const latestProj = projectRef.current;
          const nextMilestones = latestProj.milestones.map(m => m.id === selectedMilestone.id ? { ...m, savedDocuments: [newDoc, ...(m.savedDocuments || [])] } : m);
          onUpdate({ ...latestProj, milestones: nextMilestones });
          toggleModal('weekly', false);
          showToast({ message: t('projectDetailModule.reportSavedToLib'), type: 'success' });
        }}
        onTraceSource={(logIds) => { if (logIds?.[0]) { toggleModal('weekly', false); handleTraceLog(logIds[0]); } }}
        showInsight={!!ai.currentInsight}
        insightContent={ai.currentInsight}
        onCloseInsight={() => updateAi({ currentInsight: null })}
        showChat={false}
        onCloseChat={() => { }}
        chatHistory={[]}
        chatInput={''}
        setChatInput={() => { }}
        onSendMessage={() => { }}
        isChatLoading={false}
        chatContextLabel={''}
        showBlueprint={ai.showBlueprint}
        blueprintRationale={project.frameworkRationale}
        onCloseBlueprint={() => updateAi({ showBlueprint: false })}
        onRequestExperimentFlows={handleRequestExperimentFlows}
        isGeneratingFlows={isGeneratingFlows}
        onViewGeneratedFlows={lastGeneratedFlows ? () => setGeneratedFlows(lastGeneratedFlows) : undefined}
        onViewExperimentPlan={project.lastExperimentPlan?.length ? () => setWeeklyPlanReport(project.lastExperimentPlan!) : (lastConfirmedExperimentsRef.current ? () => setWeeklyPlanReport(lastConfirmedExperimentsRef.current) : undefined)}
      />

      {showPlanCollector && (
        <PlanCollectorModal
          items={collectedPlanItems}
          onClose={() => setShowPlanCollector(false)}
          onUpdateItems={setCollectedPlanItems}
          onSubmitAll={(tasks) => {
            setShowPlanCollector(false);
            handleRequestExperimentFlows(tasks);
          }}
          isGenerating={isGeneratingFlows}
        />
      )}

      <ExperimentFlowPreviewModal
        show={!!generatedFlows && generatedFlows.experiments.length > 0}
        experiments={generatedFlows?.experiments || []}
        skippedTasks={generatedFlows?.skippedTasks || []}
        taskTitles={flowTaskTitles}
        onConfirm={handleConfirmExperimentFlows}
        onClose={() => setGeneratedFlows(null)}
      />

      <DoeTraceModal
        show={!!traceDoeId}
        doeId={traceDoeId}
        onClose={() => setTraceDoeId(null)}
      />

      <SafeModal config={modals.confirm} onClose={() => toggleModal('confirm', null)} />

      <ProjectMembersPanel
        projectId={project.id}
        isOpen={showMembersPanel}
        onClose={() => setShowMembersPanel(false)}
      />

      <WeeklyExperimentPlanModal
        show={!!weeklyPlanReport && weeklyPlanReport.length > 0}
        experiments={weeklyPlanReport || []}
        projectTitle={project.title}
        onClose={() => setWeeklyPlanReport(null)}
      />
    </div>
  );
};

export default ProjectDetail;
