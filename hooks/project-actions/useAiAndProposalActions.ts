
import React, { useCallback } from 'react';
import { ResearchProject, ExperimentLog, TransformationProposal, LogStatus, Milestone } from '../../types';
import { diagnoseExperimentLog, summarizeExperimentLog, analyzeMechanism, generateNarrativeBriefing, generateMilestonesAI, generateMilestonesFromImageAI } from '../../services/gemini';
import { analyzeLogMechanism } from '../../services/gemini/analysis';

/** 将任意日期字符串标准化为 YYYY-MM-DD（兼容 AI 返回的各种格式） */
const normalizeDateStr = (d: string | undefined): string => {
  if (!d) return new Date().toISOString().split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
};

interface UseAiAndProposalActionsProps {
  project: ResearchProject;
  onUpdate: (updated: ResearchProject) => void;
  updateAi: (updates: any) => void;
  toggleModal: (key: string, value: boolean) => void;
  showToast: (msg: any) => void;
  selectedMilestoneId: string | null;
  startGlobalTask: (task: any, action: () => Promise<any>) => Promise<void>;
}

export const useAiAndProposalActions = ({
  project, onUpdate, updateAi, toggleModal, showToast, selectedMilestoneId, startGlobalTask
}: UseAiAndProposalActionsProps) => {

  const handleDiagnoseLog = useCallback(async (log: ExperimentLog) => {
    updateAi({ isLoading: true });
    try {
      await startGlobalTask(
        { id: `diag_${log.id}`, type: 'diagnose', status: 'running', title: '执行 AI 科学审计...' },
        async () => {
          try {
            const result = await diagnoseExperimentLog(log, project);
            const ownerMilestone = project.milestones.find(m => m.logs.some(l => l.id === log.id));
            const newDoc = { id: `audit_${log.id}_${Date.now()}`, timestamp: new Date().toLocaleString(), title: `[AI审计] ${log.content.substring(0, 20)}`, content: result.insight, sourceLogContent: log.content, sourceLogId: log.id, sourceLogIds: [log.id] };
            const updatedMilestones = project.milestones.map(m => ({
              ...m,
              logs: m.logs.map(l => l.id === log.id ? { ...l, auditInsight: result.insight, status: (result.isAnomaly ? 'Anomaly' : 'Verified') as LogStatus } : l),
              ...(m.id === ownerMilestone?.id && { savedDocuments: [newDoc, ...(m.savedDocuments || [])] })
            }));
            onUpdate({ ...project, milestones: updatedMilestones });
            showToast({ message: "AI 审计完成", type: 'success' });
          } catch (e) {
            showToast({ message: "审计引擎通讯受限或请求失败", type: 'error' });
            throw e;
          }
        }
      );
    } finally {
      updateAi({ isLoading: false });
    }
  }, [project, onUpdate, updateAi, showToast, startGlobalTask]);

  const handleSummarizeLog = useCallback(async (log: ExperimentLog) => {
    updateAi({ isLoading: true });
    try {
      await startGlobalTask(
        { id: `sum_${log.id}`, type: 'writing_assist', status: 'running', title: '智能生成记录总结...' },
        async () => {
          try {
            const summary = await summarizeExperimentLog(log);
            const ownerMilestone = project.milestones.find(m => m.logs.some(l => l.id === log.id));
            const newDoc = { id: `sum_${log.id}_${Date.now()}`, timestamp: new Date().toLocaleString(), title: `[总结] ${log.content.substring(0, 20)}`, content: summary, sourceLogContent: log.content, sourceLogId: log.id, sourceLogIds: [log.id] };
            const updatedMilestones = project.milestones.map(m => ({
              ...m,
              logs: m.logs.map(l => l.id === log.id ? { ...l, summaryInsight: summary } : l),
              ...(m.id === ownerMilestone?.id && { savedDocuments: [newDoc, ...(m.savedDocuments || [])] })
            }));
            onUpdate({ ...project, milestones: updatedMilestones });
            showToast({ message: "记录总结完成", type: 'success' });
          } catch (e) {
            showToast({ message: "智能总结生成失败", type: 'error' });
            throw e;
          }
        }
      );
    } finally {
      updateAi({ isLoading: false });
    }
  }, [project, onUpdate, updateAi, showToast, startGlobalTask]);

  const handleAnalyzeMechanism = useCallback(async (log: ExperimentLog) => {
    updateAi({ isLoading: true });
    try {
      await startGlobalTask(
        { id: `mech_${log.id}`, type: 'diagnose', status: 'running', title: '解算物理演变机理...' },
        async () => {
          try {
            const result = await analyzeLogMechanism(log, project);
            const ownerMilestone = project.milestones.find(m => m.logs.some(l => l.id === log.id));
            const analysisResult = result || '分析完成';
            const newDoc = { id: `mech_${log.id}_${Date.now()}`, timestamp: new Date().toLocaleString(), title: `[机理] ${log.content.substring(0, 20)}`, content: analysisResult, sourceLogContent: log.content, sourceLogId: log.id, sourceLogIds: [log.id] };
            const updatedMilestones = project.milestones.map(m => ({
              ...m,
              logs: m.logs.map(l => l.id === log.id ? { ...l, mechanismInsight: analysisResult } : l),
              ...(m.id === ownerMilestone?.id && { savedDocuments: [newDoc, ...(m.savedDocuments || [])] })
            }));
            onUpdate({ ...project, milestones: updatedMilestones });
            showToast({ message: "机理推导完成", type: 'success' });
          } catch (e) {
            showToast({ message: "推演物理机理服务拒绝连接或响应不稳定", type: 'error' });
            throw e;
          }
        }
      );
    } finally {
      updateAi({ isLoading: false });
    }
  }, [project, onUpdate, updateAi, showToast, startGlobalTask]);

  // Optimized: Parallelized full analysis: runs all three AI tasks at once for performance, merging results into one update.
  const handleFullAnalysis = useCallback(async (log: ExperimentLog) => {
    updateAi({ isLoading: true });
    try {
      await startGlobalTask(
        { id: `full_${log.id}`, type: 'diagnose', status: 'running', title: '一键全析：总结 / 审计 / 机理...' },
        async () => {
          showToast({ message: '⚡ 正在并行执行全方位科学解析...', type: 'info' });

          const results = await Promise.allSettled([
            summarizeExperimentLog(log),
            diagnoseExperimentLog(log, project),
            analyzeLogMechanism(log, project)
          ]);

          const summaryResult = results[0].status === 'fulfilled' ? (results[0].value as string) : '';
          const diagResult = results[1].status === 'fulfilled' ? (results[1].value as any) : null;
          const mechanismResult = results[2].status === 'fulfilled' ? (results[2].value as string) : '';

          // Error reporting for individual failures
          if (results[0].status === 'rejected') console.warn('Summary failed:', results[0].reason);
          if (results[1].status === 'rejected') console.warn('Diagnose failed:', results[1].reason);
          if (results[2].status === 'rejected') console.warn('Mechanism failed:', results[2].reason);

          const auditResult = diagResult?.insight || '';
          const auditStatus = diagResult?.isAnomaly ? 'Anomaly' : 'Verified';

          // Single merged update — no overwrites, also auto-save to node documents
          const ownerMilestone = project.milestones.find(m => m.logs.some(l => l.id === log.id));
          const newDocs: any[] = [];
          const timestamp = new Date().toLocaleString();
          const logTitlePrefix = log.content.substring(0, 20);

          if (summaryResult) newDocs.push({ id: `sum_${log.id}_${Date.now()}`, timestamp, title: `[总结] ${logTitlePrefix}`, content: summaryResult, sourceLogContent: log.content, sourceLogId: log.id, sourceLogIds: [log.id] });
          if (auditResult) newDocs.push({ id: `audit_${log.id}_${Date.now() + 1}`, timestamp, title: `[AI审计] ${logTitlePrefix}`, content: auditResult, sourceLogContent: log.content, sourceLogId: log.id, sourceLogIds: [log.id] });
          if (mechanismResult) newDocs.push({ id: `mech_${log.id}_${Date.now() + 2}`, timestamp, title: `[机理] ${logTitlePrefix}`, content: mechanismResult, sourceLogContent: log.content, sourceLogId: log.id, sourceLogIds: [log.id] });

          const updatedMilestones = project.milestones.map(m => ({
            ...m,
            logs: m.logs.map(l => l.id === log.id ? {
              ...l,
              ...(summaryResult && { summaryInsight: summaryResult }),
              ...(auditResult && { auditInsight: auditResult, status: auditStatus as any }),
              ...(mechanismResult && { mechanismInsight: mechanismResult })
            } : l),
            ...(m.id === ownerMilestone?.id && { savedDocuments: [...newDocs, ...(m.savedDocuments || [])] })
          }));
          onUpdate({ ...project, milestones: updatedMilestones });

          const successCount = [summaryResult, auditResult, mechanismResult].filter(Boolean).length;
          showToast({
            message: successCount > 0 ? `⚡ 一键全析完成 (${successCount}/3), 文档已归档` : '解析完成，但部分引擎未返回有效数据',
            type: successCount > 0 ? 'success' : 'warning'
          });
        }
      );
    } finally {
      updateAi({ isLoading: false });
    }
  }, [project, onUpdate, updateAi, showToast, startGlobalTask]);

  const handleGenerateBriefing = useCallback(async (logs: ExperimentLog[]) => {
    await startGlobalTask(
      { id: `briefing_${Date.now()}`, type: 'writing_assist', status: 'running', title: '合并生成实验叙述简报...' },
      async () => {
        const result = await generateNarrativeBriefing(project.title, logs);
        updateAi({ currentReport: result });
        toggleModal('weekly', true);
      }
    );
  }, [project.title, updateAi, toggleModal, startGlobalTask]);

  const handleAutoGenerateMilestones = useCallback(async () => {
    await startGlobalTask(
      { id: 'milestone_gen', type: 'transformation', status: 'running', title: '正在推演科学研究路线...' },
      async () => {
        try {
          const result = await generateMilestonesAI(project);
          if (!result || !result.milestones || result.milestones.length === 0) return;

          const newMilestones: Milestone[] = result.milestones.map((node: any, idx: number) => ({
            id: `auto_${Date.now()}_${idx}`,
            title: node.title,
            hypothesis: node.hypothesis,
            dueDate: normalizeDateStr(node.dueDate),
            status: 'pending' as const,
            logs: [],
            chatHistory: [],
            experimentalPlan: [],
            savedDocuments: []
          }));

          // 将新生成的节点合并到现有节点中，并保存研究框架解读
          onUpdate({
            ...project,
            milestones: [...project.milestones, ...newMilestones],
            frameworkRationale: result.frameworkRationale
          });
          showToast({ message: `成功规划并注入 ${newMilestones.length} 个新研究节点，逻辑框架已就绪`, type: 'success' });
        } catch (e) {
          showToast({ message: "路线规划失败，请检查课题描述是否清晰", type: 'error' });
          throw e;
        }
      }
    );
  }, [project, onUpdate, showToast, startGlobalTask]);

  const handleGenerateFromInput = useCallback(async (
    imageBase64?: string,
    imageMimeType?: string,
    textPrompt?: string
  ) => {
    if (!imageBase64 && !textPrompt?.trim()) return;
    await startGlobalTask(
      { id: 'milestone_gen', type: 'transformation', status: 'running', title: imageBase64 ? '正在解析截图并规划研究路线...' : '正在推演科学研究路线...' },
      async () => {
        try {
          const result = await generateMilestonesFromImageAI(
            imageBase64,
            imageMimeType || 'image/png',
            textPrompt,
            { title: project.title, description: project.description }
          );
          if (!result || !result.milestones || result.milestones.length === 0) return;

          const newMilestones: Milestone[] = result.milestones.map((node: any, idx: number) => ({
            id: `gen_${Date.now()}_${idx}`,
            title: node.title,
            hypothesis: node.hypothesis,
            dueDate: normalizeDateStr(node.dueDate),
            status: 'pending' as const,
            logs: [],
            chatHistory: [],
            experimentalPlan: [],
            savedDocuments: []
          }));

          onUpdate({
            ...project,
            milestones: [...project.milestones, ...newMilestones],
            frameworkRationale: result.frameworkRationale
          });
          showToast({ message: `成功规划并注入 ${newMilestones.length} 个新研究节点`, type: 'success' });
        } catch (e) {
          showToast({ message: '路线规划失败，请检查输入内容', type: 'error' });
          throw e;
        }
      }
    );
  }, [project, onUpdate, showToast, startGlobalTask]);

  const handlePushProposalToMatrix = useCallback((proposal: TransformationProposal) => {
    if (!selectedMilestoneId) {
      showToast({ message: "推送失败：请先选择目标实验节点", type: 'error' });
      return;
    }
    const performanceSection = (proposal.optimizedParameters || []).map(p => `- ${p.key}: ${p.value} (${p.reason})`).join('\n');
    const newPlan = {
      id: Date.now().toString(), title: `[验证] ${proposal.title}`, status: 'planned' as const,
      notes: `源自工艺建议初衷：${proposal.scientificHypothesis}\n\n【预期性能指标】\n${performanceSection}`,
      matrix: (proposal.controlParameters || []).map(p => ({ name: p.key, range: p.value, target: '' })),
      parameters: {}, sourceProposalId: proposal.id, sourceType: 'proposal' as const,
      sourceLiteratureId: proposal.literatureId, sourceLiteratureTitle: proposal.literatureTitle
    };
    const nextMilestones = project.milestones.map(m => m.id === selectedMilestoneId ? { ...m, experimentalPlan: [newPlan, ...(m.experimentalPlan || [])] } : m);
    onUpdate({ ...project, milestones: nextMilestones });
    showToast({ message: "工艺建议已同步至实验设计中心", type: 'success' });
  }, [project, onUpdate, selectedMilestoneId, showToast]);

  const handleAdoptProposal = useCallback((prop: TransformationProposal) => {
    const performanceSection = (prop.optimizedParameters || []).map(p => `- ${p.key}: ${p.value} (${p.reason})`).join('\n');
    const newPlan = {
      id: `plan_${Date.now()}`, title: `[初始] ${prop.title.substring(0, 20)}`, status: 'planned' as const,
      notes: `源自演进路线采纳：${prop.scientificHypothesis}\n\n【预期性能指标】\n${performanceSection}`,
      matrix: (prop.controlParameters || []).map(p => ({ name: p.key, range: p.value, target: '' })),
      parameters: {}, sourceProposalId: prop.id, sourceType: 'proposal' as const,
      sourceLiteratureId: prop.literatureId, sourceLiteratureTitle: prop.literatureTitle
    };
    const newMilestone: Milestone = {
      id: Date.now().toString(), title: `[转化] ${prop.title.substring(0, 15)}...`, hypothesis: prop.scientificHypothesis,
      status: 'pending', dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      logs: [], experimentalPlan: [newPlan], chatHistory: [], savedDocuments: []
    };
    onUpdate({ ...project, milestones: [...project.milestones, newMilestone] });
    showToast({ message: '建议路线已转化为新的研究节点', type: 'success' });
  }, [project, onUpdate, showToast]);

  return { handleDiagnoseLog, handleSummarizeLog, handleAnalyzeMechanism, handleFullAnalysis, handleGenerateBriefing, handlePushProposalToMatrix, handleAdoptProposal, handleAutoGenerateMilestones, handleGenerateFromInput };
};
