import { useState, useEffect, useCallback } from 'react';
import { ResearchProject, MilestoneStatus, ProposalStatus, ExperimentLog, PlannedExperiment, ChatMessage, TransformationProposal } from '../types';
import { SafeModalConfig } from '../components/SafeModal';

export const useProjectState = (project: ResearchProject, initialView: any) => {
  // 解析初始视图字符串，支持 "view:id" 格式
  const parseInitialView = useCallback(() => {
    const raw = String(initialView || 'logs');
    if (raw.includes(':')) {
      const [view, id] = raw.split(':');
      return { view, id };
    }
    return { view: raw, id: null };
  }, [initialView]);

  const init = parseInitialView();

  // --- 核心优化：根据 ID 自动锁定所属里程碑 ---
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<'overview' | 'logs' | 'reports' | 'plan' | 'process' | 'plan_board' | 'presentation' | 'sample_matrix' | 'milestone_docs' | 'advisor'>(init.view as any);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [expandedInsightIds, setExpandedInsightIds] = useState<Set<string>>(new Set());
  const [foldedNodeIds, setFoldedNodeIds] = useState<Set<string>>(new Set());
  const [expandedProposalIds, setExpandedProposalIds] = useState<Set<string>>(new Set());
  const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [highlightLogId, setHighlightLogId] = useState<string | null>(null);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // 1. 同步 URL 状态到本地 View (移除 activeView 依赖，解决同步环冲突)
  useEffect(() => {
    const updated = parseInitialView();
    if (updated.view) {
      setActiveView(updated.view as any);
    }

    if (updated.id) {
      if (updated.view === 'logs') {
        setHighlightLogId(updated.id);
        setExpandedLogIds(prev => {
          const next = new Set(prev);
          next.add(updated.id);
          return next;
        });
      }
      if (updated.view === 'plan_board') {
        setHighlightedTaskId(updated.id);
      }
      if (updated.view === 'plan') {
        setHighlightedPlanId(updated.id);
      }
    }
  }, [initialView, parseInitialView]);

  // 2. 自动对焦里程碑逻辑：支持直接通过 subView ID 或是关联 Plan ID 定位
  useEffect(() => {
    const milestones = project?.milestones || [];
    if (milestones.length === 0) return;

    const initial = parseInitialView();
    let targetMilestoneId = null;

    // 优先 1: 如果 subView 是 logs:logId，定位该日志所属里程碑
    if (initial.view === 'logs' && initial.id) {
      const ownerByLog = milestones.find(m => m.logs?.some(l => l.id === initial.id));
      if (ownerByLog) targetMilestoneId = ownerByLog.id;
    }
    // 优先 2: 如果 subView 本身就是里程碑 ID (格式 logs:ms_1)
    if (initial.id && milestones.some(m => m.id === initial.id)) {
      targetMilestoneId = initial.id;
    }
    // 优先 3: 如果当前有高亮的实验矩阵 ID，找到它所属的里程碑
    else if (highlightedPlanId || (initial.view === 'plan' && initial.id)) {
      const planId = highlightedPlanId || initial.id;
      const owner = milestones.find(m =>
        m.experimentalPlan?.some(p => p.id === planId)
      );
      if (owner) targetMilestoneId = owner.id;
    }

    // 保底: 选中拥有最新实验记录的节点，若无记录则选第一个
    if (!targetMilestoneId && !selectedMilestoneId && milestones.length > 0) {
      const parseTs = (ts: string) => {
        const normalized = ts.replace(/\//g, '-');
        const d = new Date(normalized);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      let latestTime = 0;
      let latestMsId = milestones[0].id;
      for (const m of milestones) {
        for (const log of (m.logs || [])) {
          const t = parseTs(log.timestamp);
          if (t > latestTime) {
            latestTime = t;
            latestMsId = m.id;
          }
        }
      }
      targetMilestoneId = latestMsId;
    }

    if (targetMilestoneId && targetMilestoneId !== selectedMilestoneId) {
      setSelectedMilestoneId(targetMilestoneId);
    }
  }, [initialView, highlightedPlanId, project?.milestones]);

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedLogsForComparison, setSelectedLogsForComparison] = useState<Set<string>>(new Set());

  const [modals, setModals] = useState({
    log: false,
    editNode: false,
    addNode: false,
    weekly: false,
    insight: false,
    plan: false,
    projectEdit: false,
    editProposal: false,
    editProposalContent: false,
    confirm: null as SafeModalConfig | null
  });

  const [forms, setForms] = useState({
    editingLog: null as ExperimentLog | null,
    editingPlan: null as PlannedExperiment | null,
    editingNodeId: null as string | null,
    nodeData: { title: '', hypothesis: '', date: '', status: 'pending' as MilestoneStatus, parentId: undefined as string | undefined },
    projectData: {
      id: project?.id || '',
      title: project?.title || '',
      deadline: project?.deadline || '',
      description: project?.description || '',
      targetPerformance: project?.targetPerformance || '',
      targetMetrics: project?.targetMetrics?.map(m => ({ ...m })) || [{ label: '', value: '', unit: '', weight: 1, isHigherBetter: true }],
      milestones: project?.milestones || [],
      personnel: project?.personnel || [],
      requiredMaterials: project?.requiredMaterials || [],
      proposalDoc: project?.proposalDoc,
      proposalText: project?.proposalText,
      proposals: project?.proposals || []
    },
    editingProposalId: null as string | null,
    proposalData: { title: '', status: 'main' as ProposalStatus },
    tempProposal: null as TransformationProposal | null
  });

  const [ai, setAi] = useState({
    showChat: false,
    showBlueprint: false, // 新增：蓝图展示状态
    history: [] as ChatMessage[],
    input: '',
    isLoading: false,
    currentReport: null as { id?: string, title: string, content: string, sourceLogIds?: string[] } | null,
    currentInsight: null as { id?: string, title: string, content: string, sourceLogIds?: string[] } | null,
    chatLogId: null as string | null,       // 当前对话关联的实验记录 ID
    chatLogContext: '' as string,            // 序列化的实验记录上下文
    chatContextLabel: '' as string,          // Chat Drawer 显示的上下文标题
    chatAttachments: [] as { name: string; url: string; type: string; dataUrl: string }[]  // 图片附件
  });

  const [weeklyPlan, setWeeklyPlan] = useState({
    editingGoalIdx: null as number | null,
    goalInput: '',
    isAddingTask: false,
    newTaskInput: '',
    viewedWeekId: null as string | null
  });

  // ── AI 实验顾问工作状态（切换 Tab 不丢失）──
  const [advisor, setAdvisor] = useState({
    proposalText: '',
    uploadedPdf: null as { base64: string; mimeType: string; name: string } | null,
    selectedLitIds: [] as string[],
    uploadedLitPdfs: [] as { name: string; base64: string; mimeType: string }[],
    advisorResult: null as any,           // AdvisorResult
    iterationHistory: [] as { result: any; feedback?: string }[],
    userFeedback: '',
    isGenerating: false,
    activeSessionId: null as string | null // 当前加载的存档 ID
  });

  const updateAdvisor = (updates: Partial<typeof advisor>) => {
    setAdvisor(prev => ({ ...prev, ...updates }));
  };

  const resetAdvisor = () => {
    setAdvisor({
      proposalText: '', uploadedPdf: null, selectedLitIds: [],
      uploadedLitPdfs: [], advisorResult: null, iterationHistory: [],
      userFeedback: '', isGenerating: false, activeSessionId: null
    });
  };

  const toggleModal = (key: keyof typeof modals, value: any) => {
    setModals(prev => ({ ...prev, [key]: value }));
  };

  const updateForm = (key: keyof typeof forms, value: any) => {
    setForms(prev => ({ ...prev, [key]: value }));
  };

  const updateAi = (updates: Partial<typeof ai>) => {
    setAi(prev => ({ ...prev, ...updates }));
  };

  const updateWeekly = (updates: Partial<typeof weeklyPlan>) => {
    setWeeklyPlan(prev => ({ ...prev, ...updates }));
  };

  return {
    viewState: {
      selectedMilestoneId, setSelectedMilestoneId,
      activeView, setActiveView,
      expandedLogIds, setExpandedLogIds,
      expandedInsightIds, setExpandedInsightIds,
      foldedNodeIds, setFoldedNodeIds,
      expandedProposalIds, setExpandedProposalIds,
      highlightedPlanId, setHighlightedPlanId,
      highlightedTaskId, setHighlightedTaskId,
      highlightLogId, setHighlightLogId,
      isCompareMode, setIsCompareMode,
      selectedLogsForComparison, setSelectedLogsForComparison,
      isSidebarVisible, setIsSidebarVisible
    },
    modals, toggleModal,
    forms, updateForm,
    ai, updateAi,
    weeklyPlan, updateWeekly,
    advisor, updateAdvisor, resetAdvisor
  };
};
