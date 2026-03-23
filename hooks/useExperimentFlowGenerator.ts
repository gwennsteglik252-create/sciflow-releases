
import { useState, useCallback, useRef } from 'react';
import { ResearchProject, PlannedExperiment, ExperimentLog, MatrixParameter, MatrixRun } from '../types';
import { generateExperimentFlowsFromTasks } from '../services/gemini/experiment';
import { useTranslation } from '../locales/useTranslation';

interface UseExperimentFlowGeneratorParams {
  project: ResearchProject;
  projectRef: React.MutableRefObject<ResearchProject>;
  viewState: any;
  onUpdate: (project: ResearchProject) => void;
  showToast: (toast: { message: string; type: string }) => void;
}

export function useExperimentFlowGenerator({
  project, projectRef, viewState, onUpdate, showToast
}: UseExperimentFlowGeneratorParams) {
  const { t } = useTranslation();

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

      const optimalConditions = {
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
        groupAnalyses: allLogs
          .filter(l => (l as any).groupAnalysisInsight)
          .slice(-3)
          .map(l => (l as any).groupAnalysisInsight as string),
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

    const targetMilestoneId = viewState.selectedMilestoneId || project.milestones[0]?.id;
    if (!targetMilestoneId) {
      showToast({ message: t('projectDetailModule.noMilestone'), type: 'error' });
      setGeneratedFlows(null);
      return;
    }

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
        let parameterList: { key: string; value: string; unit: string }[];
        const matrixKeys = new Set(matrix.map((m: any) => m.name));

        if (Array.isArray(run.fullParams) && run.fullParams.length > 0) {
          const allParams = run.fullParams.map((p: any) => ({
            key: String(p.key || ''),
            value: String(p.value || ''),
            unit: String(p.unit || '')
          })).filter((p: any) => p.key);

          const matrixParams = allParams.filter((p: { key: string }) => matrixKeys.has(p.key));
          const otherParams = allParams.filter((p: { key: string }) => !matrixKeys.has(p.key));

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

    const latestProject = projectRef.current;

    const nextMilestones = latestProject.milestones.map(m => {
      if (m.id !== targetMilestoneId) return m;
      return {
        ...m,
        experimentalPlan: [...newPlans, ...(m.experimentalPlan || [])],
        logs: [...(m.logs || []), ...newLogs]
      };
    });

    const planIdMap = new Map<number, string>();
    selectedExperiments.forEach((exp, idx) => {
      planIdMap.set(exp.sourceTaskIndex, newPlans[idx].id);
    });

    const nextWeeklyPlans = (latestProject.weeklyPlans || []).map(plan => ({
      ...plan,
      tasks: plan.tasks.map((t, tIdx) => {
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
    setWeeklyPlanReport(selectedExperiments);
    lastConfirmedExperimentsRef.current = selectedExperiments;
  }, [project, viewState.selectedMilestoneId, flowTaskTitles, onUpdate, showToast]);

  return {
    generatedFlows,
    setGeneratedFlows,
    lastGeneratedFlows,
    isGeneratingFlows,
    weeklyPlanReport,
    setWeeklyPlanReport,
    lastConfirmedExperimentsRef,
    handleRequestExperimentFlows,
    handleConfirmExperimentFlows,
    flowTaskTitles
  };
}
