
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ResearchProject, AppView, Milestone, ExperimentLog, PlannedExperiment, TransformationProposal, MatrixReport } from '../types';
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
import AcademicModals from './Project/AcademicModals';
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
  onStartWeeklyReport: (type: 'weekly' | 'monthly' | 'annual' | 'manual') => void;
  Maps: (view: AppView, projectId?: string, subView?: string) => void;
  initialView?: string;
  onSetAiStatus?: (status: string | null) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onUpdate, onBack, activeTasks: propsActiveTasks, onStartWeeklyReport, Maps, initialView = 'logs', onSetAiStatus }) => {
  const {
    viewState, modals, toggleModal, forms, updateForm, ai, updateAi, weeklyPlan, updateWeekly
  } = useProjectState(project, initialView);

  const { showToast, setReturnPath, activeTasks: contextActiveTasks, handleRunWeeklyReportTask, returnPath } = useProjectContext();

  const [traceDoeId, setTraceDoeId] = useState<string | null>(null);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

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
      showToast({ message: '您只有查看权限，无法编辑此项目', type: 'error' });
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
    sections.push(`【实验标题】${log.content}`);
    sections.push(`【时间】${log.timestamp}`);
    sections.push(`【状态】${log.status} | 结果: ${log.result}`);
    if (log.description) sections.push(`【实验详述与现象观测】\n${log.description}`);
    if (log.parameters) sections.push(`【实验参数（原始）】${log.parameters}`);
    if (log.parameterList && log.parameterList.length > 0) {
      sections.push(`【参数列表】\n${log.parameterList.map(p => `  ${p.key}: ${p.value} ${p.unit}`).join('\n')}`);
    }
    if (log.scientificData && Object.keys(log.scientificData).length > 0) {
      sections.push(`【科学数据指标】\n${Object.entries(log.scientificData).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
    }
    if (log.files && log.files.length > 0) {
      sections.push(`【附件文件】${log.files.map(f => f.name + (f.description ? ` (${f.description})` : '')).join(', ')}`);
    }
    if (log.consumedReagents && log.consumedReagents.length > 0) {
      sections.push(`【消耗试剂】\n${log.consumedReagents.map(r => `  ${r.name}: ${r.amount} ${r.unit}`).join('\n')}`);
    }
    if (log.summaryInsight) sections.push(`【AI 总结】\n${log.summaryInsight}`);
    if (log.auditInsight) sections.push(`【AI 审计】\n${log.auditInsight}`);
    if (log.mechanismInsight) sections.push(`【AI 机理分析】\n${log.mechanismInsight}`);
    if (log.complianceInsight) sections.push(`【合规性审计】\n${log.complianceInsight}`);
    return sections.join('\n\n');
  }, []);

  const handleStartLogChat = useCallback((log: ExperimentLog) => {
    const context = serializeLogContext(log);
    updateAi({
      showChat: true,
      chatLogId: log.id,
      chatLogContext: context,
      chatContextLabel: `实验记录: ${log.content}`,
      history: (log.chatHistory || []) as any[],
      input: ''
    });
  }, [serializeLogContext, updateAi]);

  // 将对话历史持久化到实验记录
  const saveLogChatHistory = useCallback((logId: string, history: any[]) => {
    const nextMilestones = project.milestones.map(m => ({
      ...m,
      logs: m.logs.map(l => l.id === logId ? { ...l, chatHistory: history.map(h => ({ role: h.role, text: h.text, timestamp: h.timestamp, images: h.images })) } : l)
    }));
    onUpdate({ ...project, milestones: nextMilestones });
  }, [project, onUpdate]);

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
      const contextPrompt = `你现在是针对一条具体实验记录的智能研究助理。以下是该实验记录的完整内容，请基于这些数据回答用户的问题。\n\n${ai.chatLogContext}`;
      const responseText = await chatWithMilestoneAI(historyForModel, message, contextPrompt, imageDataUrls.length > 0 ? imageDataUrls : undefined);

      const modelMsg = { role: 'model' as const, text: responseText || '无法获取响应，请重试。', timestamp: new Date().toLocaleTimeString() };
      const finalHistory = [...updatedHistory, modelMsg];
      updateAi({ history: finalHistory, isLoading: false });
      // 自动持久化到实验记录
      if (ai.chatLogId) saveLogChatHistory(ai.chatLogId, finalHistory);
    } catch (e) {
      showToast({ message: 'AI 引擎连接超时', type: 'error' });
      updateAi({ isLoading: false });
    }
  }, [ai.input, ai.isLoading, ai.history, ai.chatLogContext, ai.chatAttachments, ai.chatLogId, updateAi, showToast, saveLogChatHistory]);

  // 增强版返回逻辑：如果有返回路径（如虚拟实验室），则优先返回
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
    showToast({ message: "正在回溯原始方案拓扑节点...", type: 'info' });
  };

  const handleTraceDoe = (doeId: string, planId?: string) => {
    const subView = planId ? `${viewState.activeView}:${planId}` : viewState.activeView;
    const exactPath = `#project/${project.id}/${subView}`;

    setReturnPath(exactPath);
    Maps('doe', undefined, doeId);
    showToast({ message: "正在回溯原始 DOE 推推演存档...", type: 'info' });
  };

  const handleNavigateToBoard = (planId: string) => {
    // 通过路由子路径高亮任务
    Maps('project_detail', project.id, `plan_board:${planId}`);
    showToast({ message: "已跳转至排期视图并定位任务", type: 'success' });
  };

  const handleTracePlan = (planId: string) => {
    const ownerMilestone = project.milestones.find(m =>
      m.experimentalPlan?.some(p => p.id === planId)
    );

    if (ownerMilestone) {
      // 选中正确的里程碑并跳转
      viewState.setSelectedMilestoneId(ownerMilestone.id);
      Maps('project_detail', project.id, `plan:${planId}`);
      showToast({ message: `已回溯至《${ownerMilestone.title}》的实验矩阵详情`, type: 'success' });
    } else {
      Maps('project_detail', project.id, 'plan');
      showToast({ message: "正在查找关联矩阵...", type: 'info' });
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
      showToast({ message: "正在回溯至原始实验实录...", type: 'success' });

      setTimeout(() => viewState.setHighlightLogId(null), 5000);
    } else {
      showToast({ message: "未找到关联的实验记录数据", type: 'error' });
    }
  };

  const handleStartReportAction = (type?: 'weekly' | 'monthly' | 'annual' | 'manual') => {
    if (type === 'manual') {
      updateAi({
        currentReport: {
          title: `研究报告_${new Date().toLocaleDateString()}`,
          content: '',
          sourceLogIds: []
        }
      });
      toggleModal('weekly', true);
    } else {
      handleRunWeeklyReportTask(project, type).then(() => {
        Maps('project_detail', project.id, 'reports');
      });
    }
  };

  const renderActiveView = () => {
    switch (viewState.activeView) {
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
            onUpdateLog={handleUpdateLog}
            onShowInsightView={(title, content) => updateAi({ currentInsight: { title, content } })}
            highlightLogId={viewState.highlightLogId}
            projectTargets={project.targetMetrics}
            onTracePlan={handleTracePlan}
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
            onDelete={(id) => onUpdate({ ...project, proposals: project.proposals?.filter(p => p.id !== id) })}
            Maps={Maps}
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
        onEditProject={() => canEdit ? toggleModal('projectEdit', true) : showToast({ message: '您只有查看权限', type: 'error' })}
        isGeneratingWeekly={isGeneratingReport}
        onStartWeeklyReport={handleStartReportAction}
        onOpenMembers={isOwner ? () => setShowMembersPanel(true) : undefined}
        onlineUsers={onlineUsers}
      />

      {/* ── 协同冲突横幅 ── */}
      {hasRemoteChanges && (
        <div className="mx-1 mb-2 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 shadow-sm animate-reveal">
          <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
          <span className="text-[11px] font-bold text-amber-800 flex-1">其他协作者更新了此项目的数据</span>
          <button
            onClick={acceptRemoteChanges}
            className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-600 transition-all active:scale-95"
          >
            接受远端更新
          </button>
          <button
            onClick={() => showToast({ message: '已保留本地数据，远端更新将被忽略', type: 'info' })}
            className="px-4 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg text-[10px] font-black uppercase hover:bg-amber-50 transition-all active:scale-95"
          >
            保留本地
          </button>
        </div>
      )}

      {/* ── viewer 权限提示横幅 ── */}
      {!canEdit && (
        <div className="mx-1 mb-2 flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-5 py-2.5">
          <i className="fa-solid fa-eye text-slate-400 text-xs"></i>
          <span className="text-[10px] font-bold text-slate-500">您以 <span className="text-indigo-600">查看者</span> 身份浏览此项目，编辑功能已禁用</span>
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
          />
        )}

        <div className={`col-span-1 ${ai.showChat ? (viewState.isSidebarVisible ? 'lg:col-span-5' : 'lg:col-span-8') : (viewState.isSidebarVisible ? 'lg:col-span-9' : 'lg:col-span-12')} bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[500px] transition-all duration-300`}>
          {renderActiveView()}
        </div>

        {/* 实验记录 AI 助理——内联面板（增强版） */}
        {ai.showChat && (() => {
          const logChatFileRef = React.createRef<HTMLInputElement>();
          const suggestions = [
            { icon: 'fa-file-lines', text: '总结这条实验的关键发现', color: 'bg-violet-50 text-violet-700 border-violet-200' },
            { icon: 'fa-stethoscope', text: '诊断实验中的异常现象', color: 'bg-rose-50 text-rose-700 border-rose-200' },
            { icon: 'fa-atom', text: '分析潜在的反应机理', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { icon: 'fa-chart-line', text: '评估关键性能指标', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { icon: 'fa-lightbulb', text: '给出下一步优化建议', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { icon: 'fa-scale-balanced', text: '对比计划参数与实际偏差', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          ];
          return (
            <div className="col-span-1 lg:col-span-4 flex flex-col bg-white rounded-[2rem] shadow-xl border border-indigo-200 overflow-hidden min-h-[500px] animate-in slide-in-from-right duration-300">
              <header className="px-5 py-3 bg-slate-900 text-white flex justify-between items-center shrink-0 rounded-t-[2rem]">
                <div className="min-w-0 flex-1 mr-3">
                  <h3 className="text-sm font-black uppercase italic flex items-center gap-2"><i className="fa-solid fa-user-astronaut text-amber-400"></i> 实验助理</h3>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate" title={ai.chatContextLabel}>{ai.chatContextLabel}</p>
                </div>
                <button onClick={() => updateAi({ showChat: false, chatLogId: null, chatLogContext: '', chatContextLabel: '' })} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center shrink-0"><i className="fa-solid fa-xmark text-sm"></i></button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                {/* 空状态——引导式快捷提问 */}
                {ai.history.length === 0 && !ai.isLoading && (
                  <div className="flex flex-col items-center justify-center h-full gap-5 py-6 animate-reveal">
                    <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center shadow-inner border-2 border-dashed border-indigo-200">
                      <i className="fa-solid fa-user-astronaut text-2xl text-indigo-400"></i>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-700 italic">你好，有什么可以帮你？</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">我已阅读该实验记录的完整数据，直接提问即可</p>
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
                    <div className={`relative max-w-[90%] p-3 rounded-2xl shadow-sm text-[12px] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                      {/* 用户图片附件展示 */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex gap-1.5 mb-2 flex-wrap">
                          {msg.images.map((imgUrl, idx) => (
                            <img key={idx} src={imgUrl} className="w-20 h-20 object-cover rounded-lg border-2 border-white/30 shadow-sm" alt={`附件 ${idx + 1}`} />
                          ))}
                        </div>
                      )}
                      <div className="markdown-body text-[12px] leading-relaxed"><ScientificMarkdown content={msg.text} /></div>
                      <div className={`flex items-center justify-between mt-1.5`}>
                        <p className={`text-[7px] font-black uppercase ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-300'}`}>{msg.timestamp}</p>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(msg.text); showToast({ message: '已复制到剪贴板', type: 'success' }); }}
                            className="opacity-0 group-hover/chatmsg:opacity-100 transition-opacity w-5 h-5 rounded-md bg-slate-50 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center"
                            title="复制"
                          >
                            <i className="fa-solid fa-copy text-[8px]"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {ai.isLoading && <div className="flex justify-start"><div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2"><i className="fa-solid fa-spinner animate-spin text-indigo-600 text-xs"></i><span className="text-[9px] font-black text-slate-400 uppercase">正在分析实验数据...</span></div></div>}
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
                  <button onClick={() => logChatFileRef.current?.click()} className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center shadow-sm shrink-0" title="上传图片">
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
                  <textarea className="flex-1 bg-transparent border-none p-2 text-[12px] font-medium outline-none resize-none max-h-28 min-h-[36px] custom-scrollbar" placeholder="向 AI 提问机理或诊断建议..." rows={1} value={ai.input} onChange={(e) => updateAi({ input: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendLogChat(); } }} />
                  <button onClick={() => handleSendLogChat()} disabled={(!ai.input?.trim() && !(ai.chatAttachments?.length > 0)) || ai.isLoading} className="w-8 h-8 bg-indigo-600 text-white rounded-lg shadow-lg active:scale-90 transition-all disabled:opacity-30 shrink-0 flex items-center justify-center"><i className="fa-solid fa-paper-plane text-xs"></i></button>
                </div>
              </div>
            </div>
          );
        })()}
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
            onUpdate({ ...project, weeklyReports: project.weeklyReports?.map(r => r.id === id ? { ...r, title, content } : r) });
          } else {
            const newReport: MatrixReport = {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleString(),
              title,
              content,
              reportType: 'Manual',
              comparisonTable: { headers: [], rows: [] },
              insights: [],
              type: '内参'
            };
            onUpdate({ ...project, weeklyReports: [newReport, ...(project.weeklyReports || [])] });
          }
          toggleModal('weekly', false);
        }}
        onSaveToLibrary={(content, title) => {
          if (!selectedMilestone) return;
          const newDoc = { id: Date.now().toString(), timestamp: new Date().toLocaleString(), title, content };
          const nextMilestones = project.milestones.map(m => m.id === selectedMilestone.id ? { ...m, savedDocuments: [newDoc, ...(m.savedDocuments || [])] } : m);
          onUpdate({ ...project, milestones: nextMilestones });
          toggleModal('weekly', false);
          showToast({ message: "报告已存入节点文档库", type: 'success' });
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
    </div>
  );
};

export default ProjectDetail;
