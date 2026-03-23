
import { useCallback } from 'react';
import { ResearchProject, AppView } from '../types';
import { useTranslation } from '../locales/useTranslation';

interface UseProjectNavigationParams {
  project: ResearchProject;
  viewState: any;
  onBack: () => void;
  returnPath: string | null;
  setReturnPath: (path: string | null) => void;
  showToast: (toast: { message: string; type: string }) => void;
  Maps: (view: AppView, projectId?: string, subView?: string) => void;
  handleRunWeeklyReportTask: (project: ResearchProject, type?: string) => Promise<void>;
  updateAi: (patch: any) => void;
  toggleModal: (key: string, value: any) => void;
}

export function useProjectNavigation({
  project, viewState, onBack, returnPath, setReturnPath,
  showToast, Maps, handleRunWeeklyReportTask, updateAi, toggleModal
}: UseProjectNavigationParams) {
  const { t } = useTranslation();

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
    Maps('project_detail', project.id, `plan_board:${planId}`);
    showToast({ message: t('projectDetailModule.navigatedToSchedule'), type: 'success' });
  };

  const handleTracePlan = (planId: string) => {
    const ownerMilestone = project.milestones.find(m =>
      m.experimentalPlan?.some(p => p.id === planId)
    );
    if (ownerMilestone) {
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

  const handleStartReportAction = (type?: 'weekly' | 'monthly' | 'annual' | 'manual') => {
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
      handleRunWeeklyReportTask(project, type).then(() => {
        Maps('project_detail', project.id, 'reports');
      });
    }
  };

  return {
    handleBackInternal,
    handleTraceSourceProposal,
    handleTraceDoe,
    handleNavigateToBoard,
    handleTracePlan,
    handleTraceLog,
    handleStartReportAction
  };
}
