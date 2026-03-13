import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ProjectContext } from './ProjectContextCore';
import type { ProjectContextType } from './ProjectContextCore';
import { ResearchProject, Literature, AiTask, UserProfile, AppTheme, AppSettings, ToastConfig, MatrixReport, FlowchartSession, DoeSession, InceptionSession, InventoryItem, SearchResult, MechanismSession, ExperimentLog, WeeklyTask, ConsumedReagent, AppView, DataAnalysisSession, WritingSession, AiCliCommand } from '../types';
import { generateProposalFromLiterature, generateAcademicReport, analyzeMechanism, suggestDOENextStep } from '../services/gemini';
import { brainstormTopicsEnhanced, scanGlobalLandscape, runVirtualReview, generateBlueprint } from '../services/gemini/inception';
import { generateFlowchartData } from '../services/gemini/flowchart';
import { normalizePhysicalConstants } from '../components/Mechanism/physicsUtils';
import { useProjectPersistence } from '../hooks/useProjectPersistence';
import { useScientificSession } from '../hooks/useScientificSession';
import { useAppSession } from '../hooks/useAppSession';
import { useCloudSync } from '../hooks/useCloudSync';
import { MOCK_TEAM } from '../constants';
import { UIContext } from './UIContext';
import type { UIContextType } from './UIContext';

export { useProjectContext } from './ProjectContextCore';
export { useUIContext } from './UIContext';

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const {
    activeTasks, setActiveTasks, aiStatus, setAiStatus, isOnline, isKeySelected, setIsKeySelected,
    searchQuery, setSearchQuery, citationBuffer, setCitationBuffer, toast, setToast,
    modals, setModalOpen, activeTheme, setActiveTheme, appSettings, setAppSettingsWithCallback,
    userProfile, setUserProfile,
    isAiCliOpen, setIsAiCliOpen,
    aiCliHistory, setAiCliHistory,
    pendingEditInventoryId, setPendingEditInventoryId,
    returnPath, setReturnPath
  } = useAppSession();

  const {
    projects, setProjects, resources, setResources, inventory, setInventory, searchResults, isStorageReady
  } = useProjectPersistence(searchQuery);

  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [isTeamHydrated, setIsTeamHydrated] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // 1. 数据 Hydration: 处理 Team 数据独立持久化
  useEffect(() => {
    if (isStorageReady) {
      const saved = localStorage.getItem('sciflow_team_data');
      if (saved) {
        setTeamMembers(JSON.parse(saved));
      } else {
        setTeamMembers(MOCK_TEAM);
      }
      setIsTeamHydrated(true);
    }
  }, [isStorageReady]);

  // 2. 数据写回: Team 数据
  useEffect(() => {
    if (isTeamHydrated) {
      localStorage.setItem('sciflow_team_data', JSON.stringify(teamMembers));
    }
  }, [teamMembers, isTeamHydrated]);

  const {
    mechanismSession, updateMechanismSession,
    flowchartSession, updateFlowchartSession,
    doeSession, updateDoeSession,
    inceptionSession, updateInceptionSession,
    dataAnalysisSession, updateDataAnalysisSession,
    writingSession, updateWritingSession,
    structuralSession, updateStructuralSession,
    timelineSession, updateTimelineSession,
    visionSession, updateVisionSession,
    isSessionsReady
  } = useScientificSession();

  const isSystemReady = isStorageReady && isSessionsReady && isTeamHydrated;

  // ─── 云端同步 ────────────────────────────────────────────────
  const cloudSync = useCloudSync({
    projects, setProjects,
    resources, setResources,
    inventory, setInventory,
    isStorageReady,
  });

  // 3. 状态自动调和 (Reconciliation): 
  // 防止 isThinking:true 在页面刷新后因为没有运行中的 activeTasks 而卡死
  useEffect(() => {
    if (isSystemReady && inceptionSession.isThinking) {
      const relatedTaskIds = ['inception_brainstorm', 'inception_research', 'inception_blueprint', 'inception_review'];
      const hasRelatedTask = activeTasks.some(t => relatedTaskIds.includes(t.id));
      if (!hasRelatedTask) {
        console.log('[Context] Reconciling inception state: no active task found, resetting Thinking status');
        updateInceptionSession({ isThinking: false });
      }
    }
  }, [isSystemReady, activeTasks, inceptionSession.isThinking, updateInceptionSession]);

  // 使用 ref 跟踪 appSettings，避免 navigate 依赖 appSettings 引起不必要刷新
  const appSettingsRef = useRef(appSettings);
  useEffect(() => { appSettingsRef.current = appSettings; }, [appSettings]);

  const navigate = useCallback((view: AppView, projectId?: string, subView?: string) => {
    // 仅在 sidebar 不是 expanded 时才触发状态更新，避免无谓重渲染
    if (appSettingsRef.current.sidebarMode !== 'expanded') {
      setAppSettingsWithCallback({ sidebarMode: 'expanded' });
    }
    if (!projectId && !subView && view !== 'team') setReturnPath(null);
    if (view === 'project_detail' && projectId) {
      window.location.hash = `#project/${projectId}${subView ? `/${subView}` : ''}`;
    } else {
      window.location.hash = `#${view}${projectId ? `/${projectId}` : ''}${subView ? `/${subView}` : ''}`;
    }
  }, [setAppSettingsWithCallback, setReturnPath]);

  const startGlobalTask = async <T,>(task: AiTask, action: () => Promise<T>): Promise<T> => {
    setActiveTasks(prev => [...prev, task]);
    try {
      const result = await action();
      setActiveTasks(prev => prev.filter(t => t.id !== task.id));
      return result;
    } catch (e: any) {
      if (e?.name === 'TaskCancelled') {
        // 被用户手动取消，静默处理
        return undefined as any;
      }
      setToast({ message: `任务失败: ${e?.message || '未知错误'}`, type: 'error' });
      setActiveTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error' as const } : t));
      setTimeout(() => setActiveTasks(prev => prev.filter(t => t.id !== task.id)), 3000);
      throw e;
    }
  };

  const cancelTask = (taskId: string) => {
    setActiveTasks(prev => prev.filter(t => t.id !== taskId));
    setToast({ message: '任务已取消', type: 'info' });
    console.log(`[Task] 用户取消任务: ${taskId}`);
  };

  const runInceptionBrainstorm = async (domain: string) => {
    updateInceptionSession({ isThinking: true, domain });
    await startGlobalTask({ id: 'inception_brainstorm', type: 'transformation', status: 'running', title: '孵化研究课题' }, async () => {
      try {
        const res = await brainstormTopicsEnhanced(domain);
        updateInceptionSession({ suggestions: res, isThinking: false });
      } catch (e) {
        updateInceptionSession({ isThinking: false });
        throw e;
      }
    });
  };

  const runInceptionResearch = async (topic: any) => {
    updateInceptionSession({ isThinking: true, selectedTopic: topic, stage: 'research', landscape: null, hotnessData: undefined, blueprint: null, review: null });
    await startGlobalTask({ id: 'inception_research', type: 'trend_analysis', status: 'running', title: '全球情报扫射' }, async () => {
      try {
        const res = await scanGlobalLandscape(topic.title, [inceptionSession.domain, ...topic.title.split(' ')], topic.type);
        updateInceptionSession({ landscape: res, hotnessData: res.hotnessData, isThinking: false });
      } catch (e) {
        updateInceptionSession({ isThinking: false });
        throw e;
      }
    });
  };

  const runInceptionBlueprint = async () => {
    updateInceptionSession({ isThinking: true, stage: 'blueprint', blueprint: null });
    await startGlobalTask({ id: 'inception_blueprint', type: 'transformation', status: 'running', title: '推演路线蓝图' }, async () => {
      try {
        const res = await generateBlueprint(inceptionSession.selectedTopic, inceptionSession.landscape);
        updateInceptionSession({ blueprint: res, isThinking: false });
      } catch (e) {
        updateInceptionSession({ isThinking: false });
        throw e;
      }
    });
  };

  const runInceptionReview = async () => {
    updateInceptionSession({ isThinking: true, stage: 'review', review: null });
    await startGlobalTask({ id: 'inception_review', type: 'diagnose', status: 'running', title: '立项质询评审' }, async () => {
      try {
        const res = await runVirtualReview(inceptionSession.selectedTopic, inceptionSession.landscape);
        updateInceptionSession({ review: res, isThinking: false });
      } catch (e) {
        updateInceptionSession({ isThinking: false });
        throw e;
      }
    });
  };

  const runFlowchartModeling = async () => {
    await startGlobalTask({ id: 'flowchart_modeling', type: 'transformation', status: 'running', title: '工艺数字化建模' }, async () => {
      const res = await generateFlowchartData(flowchartSession.description, flowchartSession.scaleFactor, flowchartSession.targetTrl, flowchartSession.detailLevel);
      if (res?.steps) {
        updateFlowchartSession({
          currentFlowchart: {
            id: Date.now().toString(),
            title: res.title || '数字化工艺预演方案',
            timestamp: new Date().toLocaleString(),
            originalDescription: flowchartSession.description,
            steps: res.steps.map((s: any, i: number) => ({
              ...s,
              id: s.id || `step_${i}_${Date.now()}`
            })),
            scaleFactor: flowchartSession.scaleFactor,
            trlLevel: flowchartSession.targetTrl,
            productionValue: flowchartSession.productionValue,
            unitLabel: flowchartSession.unitLabel,
            includeMaterialCost: flowchartSession.includeMaterialCost,
            includeOperationCost: flowchartSession.includeOperationCost,
            optimizedParameters: res.optimizedParameters || [],
            controlParameters: res.controlParameters || []
          }
        });
      }
    });
  };

  const runMechanismAnalysis = async () => {
    await startGlobalTask({ id: `mechanism_${Date.now()}`, type: 'diagnose', status: 'running', title: `仿真解算: ${mechanismSession.material}` }, async () => {
      updateMechanismSession({ isProcessing: true });
      const result = await analyzeMechanism({ ...mechanismSession });

      // 物理标准化纠偏：自动处理单位冲突与物理审计
      if (result.physicalConstants) {
        result.physicalConstants = normalizePhysicalConstants(result.physicalConstants, mechanismSession.reactionMode);
      }

      updateMechanismSession({ ...result, isProcessing: false });
    });
  };

  const runDoeInference = async () => {
    await startGlobalTask({ id: `doe_${Date.now()}`, type: 'diagnose', status: 'running', title: 'DOE 工艺推演' }, async () => {
      updateDoeSession({ isCalculating: true });
      const res = await suggestDOENextStep(doeSession);
      updateDoeSession({ isCalculating: false, suggestion: res });
    });
  };

  const handleRunWeeklyReportTask = async (project: ResearchProject, type: any = 'weekly') => {
    return startGlobalTask({ id: `weekly_${project.id}`, type: 'weekly_report', status: 'running', title: '生成研究报告' }, async () => {
      const allLogs = (project.milestones ?? []).flatMap(m => m.logs ?? []);

      // 根据报告类型过滤对应时间范围的日志
      const now = Date.now();
      const rangeDays = type === 'weekly' ? 7 : type === 'monthly' ? 30 : 365;
      const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

      const filteredLogs = allLogs.filter(log => {
        if (!log.timestamp) return false;
        try {
          const logTime = new Date(log.timestamp).getTime();
          return !isNaN(logTime) && logTime >= cutoff;
        } catch {
          return false; // 无法解析的时间戳，跳过
        }
      });

      // 如果过滤后无记录，回退使用全部日志（避免生成空报告）
      const logsToUse = filteredLogs.length > 0 ? filteredLogs : allLogs;

      // 收集各节点已有的 AI 分析文档（总结/审计/机理），作为额外上下文
      const aiDocuments = project.milestones
        .flatMap(m => (m.savedDocuments || []))
        .filter(doc => doc.title && doc.content && /^\[(总结|AI审计|机理)\]/.test(doc.title))
        .slice(-15)
        .map(doc => ({ title: doc.title, content: doc.content }));

      // 收集实验记录级 AI 问答的精华（仅取 model 回复）
      const chatInsights: { title: string; content: string }[] = [];
      // 收集同步模块性能雷达的表征内容（XRD/XPS/SEM/TEM/电化学等）
      const syncedModuleInsights: { title: string; content: string }[] = [];
      for (const m of (project.milestones ?? [])) {
        for (const log of (m.logs || [])) {
          if (log.chatHistory && log.chatHistory.length > 0) {
            const modelReplies = log.chatHistory
              .filter((msg: any) => msg.role === 'model' && msg.text)
              .slice(-3) // 每条记录最多取最近 3 条 AI 回复
              .map((msg: any) => msg.text.substring(0, 400));
            if (modelReplies.length > 0) {
              chatInsights.push({
                title: `[AI问答] ${log.content?.substring(0, 20) || '实验记录'}`,
                content: modelReplies.join('\n---\n')
              });
            }
          }
          // 提取 deepAnalysis.syncedModules 中的表征性能数据
          const deepRaw = log.deepAnalysis as any;
          if (deepRaw && Array.isArray(deepRaw.syncedModules)) {
            for (const sm of deepRaw.syncedModules) {
              if (!sm) continue;
              const metricsStr = sm.metrics && typeof sm.metrics === 'object'
                ? Object.entries(sm.metrics).map(([k, v]) => `${k}: ${v}`).join('；')
                : '';
              const parts = [
                `表征模块: ${sm.moduleLabel || sm.mode || '未知模块'}`,
                sm.mode ? `分析类型: ${sm.mode}` : '',
                metricsStr ? `关键性能指标: ${metricsStr}` : '',
                sm.summary ? `分析摘要: ${String(sm.summary).substring(0, 500)}` : '',
                sm.aiDeepAnalysis ? `深度分析: ${String(sm.aiDeepAnalysis).substring(0, 600)}` : '',
              ].filter(Boolean).join('\n');
              if (parts) {
                syncedModuleInsights.push({
                  title: `[表征数据-${sm.moduleLabel || sm.mode || '模块'}] ${log.content?.substring(0, 20) || '实验记录'}`,
                  content: parts
                });
              }
            }
          }
          // 提取组级别的 groupSyncedModules（表征中心组分析同步的数据）
          const groupModulesRaw = (log as any).groupSyncedModules;
          if (Array.isArray(groupModulesRaw)) {
            for (const sm of groupModulesRaw) {
              if (!sm) continue;
              const metricsStr = sm.metrics && typeof sm.metrics === 'object'
                ? Object.entries(sm.metrics).map(([k, v]) => `${k}: ${v}`).join('；')
                : '';
              const parts = [
                `组表征模块: ${sm.moduleLabel || sm.mode || '未知模块'}`,
                sm.mode ? `分析类型: ${sm.mode}` : '',
                metricsStr ? `关键性能指标: ${metricsStr}` : '',
                sm.summary ? `分析摘要: ${String(sm.summary).substring(0, 500)}` : '',
                sm.aiDeepAnalysis ? `深度分析: ${String(sm.aiDeepAnalysis).substring(0, 600)}` : '',
              ].filter(Boolean).join('\n');
              if (parts) {
                syncedModuleInsights.push({
                  title: `[组表征-${sm.moduleLabel || sm.mode || '模块'}] ${log.content?.substring(0, 20) || '实验记录'}`,
                  content: parts
                });
              }
            }
          }
        }
      }
      // 合并 AI 文档、问答精华和表征模块数据，限制总量
      const allAiContext = [...aiDocuments, ...syncedModuleInsights.slice(-10), ...chatInsights.slice(-10)];

      const res = await generateAcademicReport(project.title, logsToUse, type, 'zh', allAiContext);
      if (res?.content) {
        const reportTypeMap: Record<string, 'Weekly' | 'Monthly' | 'Annual'> = { weekly: 'Weekly', monthly: 'Monthly', annual: 'Annual' };
        const newReport: MatrixReport = { id: Date.now().toString(), timestamp: new Date().toLocaleString(), title: res.title, content: res.content, reportType: reportTypeMap[type] || 'Weekly', comparisonTable: { headers: [], rows: [] }, insights: [], type: '内参' };
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, weeklyReports: [newReport, ...(p.weeklyReports || [])] } : p));
      }
    });
  };

  const handleStartTransformation = async (literature: Literature) => {
    return startGlobalTask({ id: `trans_${literature.id}`, type: 'transformation', status: 'running', title: '工艺转化建议' }, async () => {
      // 修正：寻找正确的关联课题标题，而不是盲目使用 projects[0]
      const targetProject = projects.find(p => p.id === literature.projectId) || projects[0] || { title: '通用催化研究' };

      // 增强：传递更丰富的上下文，包含已提取的性能指标和合成步骤
      const context = `
    文献标题: ${literature.title}
    文献摘要: ${literature.abstract}
    ${literature.performance && literature.performance.length > 0 ? `已知性能指标: ${JSON.stringify(literature.performance)}` : ''}
    ${literature.synthesisSteps && literature.synthesisSteps.length > 0 ? `已知工艺步骤: ${JSON.stringify(literature.synthesisSteps)}` : ''}
    `.trim();

      const strategy = await generateProposalFromLiterature(targetProject.title, context);
      if (strategy?.proposalTitle) {
        const newProp = {
          id: Date.now().toString(),
          literatureId: literature.id,
          literatureTitle: literature.title,
          timestamp: new Date().toLocaleString(),
          title: strategy.proposalTitle,
          status: 'main' as const,
          processChanges: strategy.processChanges,
          newFlowchart: strategy.newFlowchart,
          optimizedParameters: strategy.optimizedParameters,
          controlParameters: strategy.controlParameters,
          scientificHypothesis: strategy.scientificHypothesis
        };
        setProjects(prev => prev.map(p => p.id === literature.projectId ? { ...p, proposals: [newProp, ...(p.proposals || [])] } : p));
        return newProp.id;
      }
      return null;
    });
  };

  const handleProcessMemberGrowth = (task: WeeklyTask) => {
    if (!task.assignedTo || task.assignedTo.length === 0) return;
    setTeamMembers(prev => prev.map(m => {
      if (task.assignedTo?.includes(m.name)) {
        return { ...m, activeProjectsCount: (m.activeProjectsCount || 0) + 1 };
      }
      return m;
    }));
  };
  const consumeInventoryItems = useCallback((reagents: ConsumedReagent[]) => {
    setInventory(prev => prev.map(item => {
      const consumption = reagents.find(r => r.inventoryId === item.id);
      if (consumption) {
        return { ...item, quantity: Math.max(0, item.quantity - consumption.amount), lastUpdated: new Date().toLocaleDateString() };
      }
      return item;
    }));
  }, [setInventory]);

  const addProjectLog = useCallback((projectId: string, content: string, title: string = 'AI 自动记录') => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const newLog: ExperimentLog = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        content,
        description: title,
        parameters: '',
        result: 'observation',
        status: 'Verified',
        aiInsight: '由工作流引擎自动生成'
      };
      // Add to first milestone if exists, or create one
      const milestones = [...(p.milestones || [])];
      if (milestones.length === 0) {
        milestones.push({
          id: `ms_${Date.now()}`,
          title: '默认阶段',
          hypothesis: '',
          status: 'in-progress',
          dueDate: new Date().toLocaleDateString(),
          logs: [newLog],
          chatHistory: []
        });
      } else {
        milestones[0].logs = [newLog, ...(milestones[0].logs || [])];
      }
      return { ...p, milestones };
    }));
    setToast({ message: `已在项目《${projects.find(p => p.id === projectId)?.title}》中添加日志`, type: 'success' });
  }, [setProjects, projects]);

  const updateProjectProgress = useCallback((projectId: string, progress: number) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, progress } : p));
    setToast({ message: `项目进度已更新至 ${progress}%`, type: 'info' });
  }, [setProjects]);

  const autoPlotData = useCallback((title: string, data: any[]) => {
    // Basic mapping of raw data to chart series
    updateDataAnalysisSession({
      chartTitle: title,
      seriesList: [
        {
          id: `series_${Date.now()}`,
          name: '自动提取数据',
          data: data.map((d, i) => ({ x: i, y: typeof d === 'number' ? d : (Number(d) || 0) })),
          color: '#6366f1'
        }
      ]
    });
    navigate('data');
    setToast({ message: `已为您生成数据图表: ${title}`, type: 'success' });
  }, [updateDataAnalysisSession, navigate]);

  const hideToastCb = useCallback(() => setToast(null), [setToast]);
  const confirmDeleteProjectCb = useCallback((id: string, cb: (id: string) => void) => cb(id), []);
  const recommendProjectTeamCb = useCallback(() => [] as UserProfile[], []);

  const addTaskToActivePlan = useCallback((projectId: string, taskTitle: string, metadata?: { deadline?: string, urgency?: string, quantity?: string | number, unit?: string, inventoryId?: string, inventoryName?: string, category?: string }) => {
    const taskId = `task_${Date.now()}`;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const plans = p.weeklyPlans || [];
      const now = new Date();

      const urgencyMap: Record<string, string> = { 'Normal': '普通', 'Urgent': '紧急', 'Critical': '特急' };
      const desc = metadata ? `采购期限: ${metadata.deadline || '未设置'} | 紧急度: ${urgencyMap[metadata.urgency || 'Normal']} | 拟购数量: ${metadata.quantity}${metadata.unit || ''}` : undefined;

      // Find in-progress weekly plan
      let target = plans.find((pl: any) => pl.status === 'in-progress' && pl.type === 'weekly');
      if (!target) {
        // Create a new one for this week
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const mon = new Date(now);
        mon.setDate(now.getDate() + diffToMon);
        mon.setHours(0, 0, 0, 0);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        target = { id: `plan_weekly_${Date.now()}`, type: 'weekly', startDate: fmt(mon), endDate: fmt(sun), completionRate: 0, goals: [], tasks: [], status: 'in-progress', periodStatus: Array(7).fill('idle'), dailyLogs: Array(7).fill('') };
        return { ...p, weeklyPlans: [target, ...plans].map((pl: any) => pl.id === target!.id ? { ...pl, tasks: [{ id: taskId, title: taskTitle, description: desc, status: 'pending', sourceType: 'manual' }, ...pl.tasks] } : pl) };
      }
      return { ...p, weeklyPlans: plans.map((pl: any) => pl.id === target.id ? { ...pl, tasks: [{ id: taskId, title: taskTitle, description: desc, status: 'pending', sourceType: 'manual' }, ...pl.tasks] } : pl) };
    }));

    // --- NEW: Sync to Inventory Procurement List ---
    if (metadata?.inventoryId) {
      setInventory(prev => prev.map(item =>
        item.id === metadata.inventoryId ? { ...item, status: 'Purchasing', pushedToPlan: true, pushedTaskId: taskId, urgency: metadata.urgency as any || 'Normal', procurementDeadline: metadata.deadline } : item
      ));
    } else if (metadata?.inventoryName) {
      setInventory(prev => {
        const nameLower = metadata.inventoryName!.toLowerCase().trim();
        const existingIndex = prev.findIndex(item => item.name.toLowerCase().trim() === nameLower);

        if (existingIndex > -1) {
          // Update existing item status to Purchasing
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            status: 'Purchasing',
            pushedToPlan: true,
            pushedTaskId: taskId,
            urgency: metadata.urgency as any || 'Normal',
            procurementDeadline: metadata.deadline
          };
          return next;
        } else {
          // Create new "missing" item as Purchasing
          const newItem: InventoryItem = {
            id: `inv_${Date.now()}`,
            name: metadata.inventoryName!,
            category: (metadata.category as any) || 'Chemical',
            quantity: Number(metadata.quantity) || 0,
            unit: metadata.unit || '个',
            threshold: 1,
            location: '待定 (采购中)',
            safetyLevel: 'Safe',
            status: 'Purchasing',
            lastUpdated: new Date().toLocaleDateString(),
            urgency: metadata.urgency as any || 'Normal',
            procurementDeadline: metadata.deadline,
            pushedToPlan: true,
            pushedTaskId: taskId,
            linkedProjectId: projectId
          };
          return [newItem, ...prev];
        }
      });
    }

    setReturnPath('/inventory');
    setToast({ message: `"${taskTitle}" 已推送到项目计划并同步至采购清单`, type: 'success' });
    return taskId;
  }, [setProjects, setInventory, setReturnPath, setToast]);

  const contextValue = useMemo(() => ({
    projects, resources, inventory, teamMembers, activeTasks, userProfile, activeTheme, appSettings, aiStatus, isOnline,
    searchQuery, searchResults, citationBuffer, toast, isKeySelected, mechanismSession, flowchartSession, doeSession, inceptionSession,
    isAiCliOpen, setIsAiCliOpen, aiCliHistory, setAiCliHistory,
    modals, setModalOpen,
    addProjectLog, updateProjectProgress, autoPlotData,
    setSearchQuery, setCitationBuffer, setIsKeySelected, updateMechanismSession, runMechanismAnalysis,
    updateFlowchartSession, runFlowchartModeling,
    updateDoeSession, runDoeInference,
    updateInceptionSession, runInceptionBrainstorm, runInceptionResearch, runInceptionBlueprint, runInceptionReview,
    dataAnalysisSession, updateDataAnalysisSession,
    writingSession, updateWritingSession,
    structuralSession, updateStructuralSession,
    timelineSession, updateTimelineSession,
    visionSession, updateVisionSession,
    setProjects, setResources, setInventory, setTeamMembers, setActiveTasks, setUserProfile, setActiveTheme, setAppSettings: setAppSettingsWithCallback, setAppSettingsWithCallback, setAiStatus,
    showToast: setToast, hideToast: hideToastCb,
    startGlobalTask, cancelTask, handleStartTransformation, handleRunWeeklyReportTask, confirmDeleteProject: confirmDeleteProjectCb,
    pendingEditInventoryId, setPendingEditInventoryId,
    returnPath, setReturnPath, addTaskToActivePlan,
    recommendProjectTeam: recommendProjectTeamCb,
    handleProcessMemberGrowth,
    consumeInventoryItems,
    navigate,
    isVoiceMode, setIsVoiceMode,
    cloudSync,
  }), [
    projects, resources, inventory, teamMembers, activeTasks, userProfile, activeTheme, appSettings, aiStatus, isOnline,
    searchQuery, searchResults, citationBuffer, isKeySelected, mechanismSession, flowchartSession, doeSession, inceptionSession,
    isAiCliOpen, aiCliHistory, modals,
    // 注意：toast/writingSession/structuralSession/timelineSession/dataAnalysisSession 是高频变化的局部状态，
    // 不应放入 contextValue deps，否则每次 showToast 或切章节都会引起全 App 组件树重渲染。
    // 这些值通过 context 传递但不影响 memo 重建；下游消费者通过 useProjectContext() 直接获取最新值即可。
    pendingEditInventoryId, returnPath, isVoiceMode,
    // stable callbacks（来自 useCallback，引用稳定）
    setIsAiCliOpen, setAiCliHistory, setModalOpen,
    addProjectLog, updateProjectProgress, autoPlotData,
    setSearchQuery, setCitationBuffer, setIsKeySelected, updateMechanismSession, runMechanismAnalysis,
    updateFlowchartSession, runFlowchartModeling,
    updateDoeSession, runDoeInference,
    updateInceptionSession, runInceptionBrainstorm, runInceptionResearch, runInceptionBlueprint, runInceptionReview,
    updateDataAnalysisSession, updateWritingSession, updateStructuralSession, updateTimelineSession, updateVisionSession,
    setProjects, setResources, setInventory, setTeamMembers, setActiveTasks, setUserProfile, setActiveTheme, setAppSettingsWithCallback, setAiStatus,
    setToast, hideToastCb, startGlobalTask, cancelTask, handleStartTransformation, handleRunWeeklyReportTask, confirmDeleteProjectCb,
    setPendingEditInventoryId, setReturnPath, addTaskToActivePlan, recommendProjectTeamCb,
    handleProcessMemberGrowth, consumeInventoryItems, navigate, setIsVoiceMode, cloudSync
  ]);

  // Expose to window for global access in certain UI components
  if (typeof window !== 'undefined') {
    (window as any).ProjectContextValue = contextValue;
  }

  // ── UI Context（高频状态独立 Provider，减少全局重渲染） ──
  const uiContextValue = useMemo<UIContextType>(() => ({
    toast,
    showToast: setToast,
    hideToast: hideToastCb,
    modals,
    setModalOpen,
    isAiCliOpen,
    setIsAiCliOpen,
    aiCliHistory,
    setAiCliHistory,
    isVoiceMode,
    setIsVoiceMode,
    searchQuery,
    setSearchQuery,
    aiStatus,
    setAiStatus,
  }), [
    // toast 不放入依赖（高频变化），通过 ref 或直接读最新值
    modals, isAiCliOpen, aiCliHistory, isVoiceMode, searchQuery, aiStatus,
    setToast, hideToastCb, setModalOpen, setIsAiCliOpen, setAiCliHistory,
    setIsVoiceMode, setSearchQuery, setAiStatus,
  ]);

  return (
    <UIContext.Provider value={uiContextValue}>
      <ProjectContext.Provider value={contextValue}>
        {!isSystemReady ? (
          <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-[9999]">
            <div className="w-24 h-24 rounded-[2rem] border-4 border-indigo-500 border-t-transparent animate-spin mb-8"></div>
            <h2 className="text-white text-xl font-black italic uppercase tracking-widest">Hydrating Research Vault...</h2>
            <p className="text-indigo-400 text-[10px] mt-4 uppercase font-bold animate-pulse">Initializing IndexedDB Entities</p>
          </div>
        ) : children}
      </ProjectContext.Provider>
    </UIContext.Provider>
  );
};
