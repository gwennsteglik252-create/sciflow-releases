
import React from 'react';
import DataLaboratory from '../DataLaboratory';
import { Milestone, ExperimentLog } from '../../../types';

interface ProjectLogsViewProps {
  selectedMilestone?: Milestone;
  viewState: any;
  ai: any;
  onCompareLogs: () => void;
  onGenerateBriefing: () => void;
  onStartAiChat: () => void;
  onStartLogChat: (log: ExperimentLog) => void;
  onOpenLogModal: (log?: ExperimentLog) => void;
  onOpenDocuments: () => void;
  onOpenArchives: () => void;
  onDiagnoseLog: (log: ExperimentLog) => void;
  onSummarizeLog: (log: ExperimentLog) => void;
  onAnalyzeMechanism: (log: ExperimentLog) => void;
  onFullAnalysis: (log: ExperimentLog) => void;
  onDeleteLog: (id: string) => void;
  onUpdateLog: (log: ExperimentLog) => void;
  onShowInsightView: (title: string, content: string) => void;
  highlightLogId: string | null;
  onTracePlan?: (planId: string) => void;
  projectTargets?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
}

const ProjectLogsView: React.FC<ProjectLogsViewProps> = ({
  selectedMilestone,
  viewState,
  ai,
  onCompareLogs,
  onGenerateBriefing,
  onStartAiChat,
  onStartLogChat,
  onOpenLogModal,
  onOpenDocuments,
  onOpenArchives,
  onDiagnoseLog,
  onSummarizeLog,
  onAnalyzeMechanism,
  onFullAnalysis,
  onDeleteLog,
  onUpdateLog,
  onShowInsightView,
  highlightLogId,
  onTracePlan,
  projectTargets
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <DataLaboratory
        selectedMilestone={selectedMilestone}
        isCompareMode={viewState.isCompareMode}
        selectedLogsForComparison={viewState.selectedLogsForComparison}
        onToggleCompareMode={() => { viewState.setIsCompareMode(!viewState.isCompareMode); viewState.setSelectedLogsForComparison(new Set()); }}
        onSelectForCompare={(id) => viewState.setSelectedLogsForComparison((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        onCompareLogs={onCompareLogs}
        onGenerateBriefing={onGenerateBriefing}
        onStartAiChat={onStartAiChat}
        onStartLogChat={onStartLogChat}
        onOpenLogModal={onOpenLogModal}
        onOpenDocuments={onOpenDocuments}
        onOpenArchives={onOpenArchives}
        onDiagnoseLog={onDiagnoseLog}
        onSummarizeLog={onSummarizeLog}
        onAnalyzeMechanism={onAnalyzeMechanism}
        onFullAnalysis={onFullAnalysis}
        onDeleteLog={onDeleteLog}
        onUpdateLog={onUpdateLog}
        onShowInsightView={onShowInsightView}
        highlightLogId={highlightLogId}
        isAiLoading={ai.isLoading}
        expandedLogIds={viewState.expandedLogIds}
        onToggleLogExpansion={(id) => viewState.setExpandedLogIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        expandedInsightIds={viewState.expandedInsightIds}
        onToggleInsightCollapse={(id, e) => { e.stopPropagation(); viewState.setExpandedInsightIds((prev: Set<string>) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }}
        projectTargets={projectTargets}
        onTracePlan={onTracePlan}
      />
    </div>
  );
};

export default ProjectLogsView;
