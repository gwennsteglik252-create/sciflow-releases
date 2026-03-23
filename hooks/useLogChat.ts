
import { useCallback, useRef } from 'react';
import { ExperimentLog, ResearchProject } from '../types';
import { chatWithMilestoneAI } from '../services/gemini/chat';
import { useTranslation } from '../locales/useTranslation';

interface UseLogChatParams {
  projectRef: React.MutableRefObject<ResearchProject>;
  ai: any;
  updateAi: (patch: any) => void;
  onUpdate: (project: ResearchProject) => void;
  showToast: (toast: { message: string; type: string }) => void;
}

export function useLogChat({ projectRef, ai, updateAi, onUpdate, showToast }: UseLogChatParams) {
  const { t } = useTranslation();

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
      if (ai.chatLogId) saveLogChatHistory(ai.chatLogId, finalHistory);
    } catch (e) {
      showToast({ message: t('projectDetailModule.aiEngineTimeout'), type: 'error' });
      updateAi({ isLoading: false });
    }
  }, [ai.input, ai.isLoading, ai.history, ai.chatLogContext, ai.chatAttachments, ai.chatLogId, updateAi, showToast, saveLogChatHistory]);

  return {
    serializeLogContext,
    handleStartLogChat,
    handleSendLogChat,
    saveLogChatHistory
  };
}
