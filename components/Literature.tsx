import React, { useState, useMemo } from 'react';
import { useTranslation } from '../locales';
import { ResearchProject, Literature as LiteratureType, AppView, Milestone } from '../types';
import LiteratureDetail from './Literature/LiteratureDetail';
import ReportView from './Literature/ReportView';
import ProposalView from './Literature/ProposalView';
import LiteratureSidebar from './Literature/LiteratureSidebar';
import LiteratureHeader from './Literature/LiteratureHeader';
import ProjectGallery from './Literature/ProjectGallery';
import ProjectIntroduction from './Literature/ProjectIntroduction';
import ManualPathModal from './Literature/ManualPathModal';
import EmptyPrompt from './Literature/EmptyPrompt';
import SafeModal from './SafeModal';
import ExportModal from './Literature/ExportModal';
import BenchmarkingView from './Literature/BenchmarkingView';
import CitationGraphView from './Literature/CitationGraphView';
import KnowledgePoolPanel from './Literature/KnowledgePoolPanel';
import SearchPreviewModal from './Literature/SearchPreviewModal';
import PatentSearchModal from './Literature/PatentSearchModal';
import SubscriptionPanel from './Literature/SubscriptionPanel';
import PdfSettingsModal from './Literature/PdfSettingsModal';
import QuickCaptureModal from './Literature/QuickCaptureModal';
import EpoSettingsModal from './Literature/EpoSettingsModal';
import { useProjectContext } from '../context/ProjectContext';
import { useLiteratureLogic } from '../hooks/useLiteratureLogic';
import { analyzeCitationRelations } from '../services/gemini/resource';

// Sub-component for Rename Modal
const RenameModal: React.FC<{
  show: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onConfirm: (val: string) => void;
}> = ({ show, title, initialValue, onClose, onConfirm }) => {
  const [val, setVal] = useState(initialValue);
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">{title}</h3>
        <input
          autoFocus
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none mb-6"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm(val)}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">{t('literatureModule.cancel')}</button>
          <button onClick={() => onConfirm(val)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">{t('literatureModule.confirmRename')}</button>
        </div>
      </div>
    </div>
  );
};

interface LiteratureProps {
  resources: LiteratureType[];
  projects: ResearchProject[];
  onAddResources: (newResources: LiteratureType[]) => void;
  onDeleteResource: (id: string) => void;
  onUpdateProject: (project: ResearchProject) => void;
  onUpdateResource?: (resource: LiteratureType) => void;
  activeTasks: any[];
  onStartTransformation: (lit: LiteratureType) => Promise<string | null>;
  initialProjectId?: string;
  initialResourceId?: string;
  Maps: (view: AppView, projectId?: string, subView?: string) => void;
  onSetAiStatus?: (status: string | null) => void;
}

const Literature: React.FC<LiteratureProps> = (props) => {
  const { activeTheme } = useProjectContext();
  const { t } = useTranslation();
  const isLightMode = activeTheme.type === 'light';
  const [isDeepReading, setIsDeepReading] = useState(false);
  const [isAnalyzingGraph, setIsAnalyzingGraph] = useState(false);
  const [showEpoSettings, setShowEpoSettings] = useState(false);

  const { state, actions, refs } = useLiteratureLogic(props);

  const existingProposalIds = useMemo(() => {
    const map: Record<string, string> = {};
    if (state.selectedProject?.proposals) {
      state.selectedProject.proposals.forEach(p => {
        if (p.literatureId) map[p.literatureId] = p.id;
      });
    }
    return map;
  }, [state.selectedProject?.proposals]);

  const handleJumpToProposal = (proposalId: string) => {
    state.setViewMode('proposals');
    state.setSelectedProposalId(proposalId);
  };

  const handleTraceLiterature = (literatureId: string) => {
    state.setViewMode('list');
    state.setSelectedItemId(literatureId);
  };

  const handleAdoptProposal = (proposal: any) => {
    if (!state.selectedProject) return;
    const newMilestone: Milestone = {
      id: Date.now().toString(),
      title: `${t('literatureModule.transformPrefix')} ${proposal.title.substring(0, 20)}...`,
      hypothesis: proposal.scientificHypothesis,
      status: 'pending',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      logs: [{
        id: Date.now().toString() + '-log',
        timestamp: new Date().toLocaleString(),
        content: t('literatureModule.adoptedFromProposal', { hypothesis: proposal.scientificHypothesis.substring(0, 15) }),
        description: t('literatureModule.autoGeneratedVerification'),
        parameters: '',
        status: 'Verified',
        result: 'neutral'
      }],
      chatHistory: []
    };
    props.onUpdateProject({ ...state.selectedProject, milestones: [...(state.selectedProject.milestones || []), newMilestone] });
    props.Maps('project_detail', state.selectedProject.id, 'process');
  };

  const handleBack = () => {
    if (state.isReturnToBrain && state.selectedProjectId) {
      props.Maps('research_brain', state.selectedProjectId);
    } else if (state.isReturnToWriting && state.selectedProjectId) {
      props.Maps('writing', state.selectedProjectId, 'literature');
    } else if (state.isReturnToProject && state.selectedProjectId) {
      props.Maps('project_detail', state.selectedProjectId, 'process');
    } else if (state.isReturnToMatrix && state.selectedProjectId) {
      props.Maps('project_detail', state.selectedProjectId, 'plan');
    } else {
      props.Maps('literature');
    }
  };

  // AI Citation Relation Analysis
  const handleAnalyzeCitationRelations = async () => {
    if (!state.selectedProject || state.projectResources.length < 2) return;
    setIsAnalyzingGraph(true);
    try {
      const relations = await analyzeCitationRelations(state.projectResources);
      // Update each resource with its citation links
      const updatedResources = state.projectResources.map(r => {
        const outgoing = relations.filter((rel: any) => rel.sourceId === r.id).map((rel: any) => ({
          type: 'cites' as const,
          targetId: rel.targetId,
          targetTitle: state.projectResources.find(res => res.id === rel.targetId)?.title || '',
          targetDoi: state.projectResources.find(res => res.id === rel.targetId)?.doi,
          confidence: rel.confidence,
        }));
        const incoming = relations.filter((rel: any) => rel.targetId === r.id).map((rel: any) => ({
          type: 'cited_by' as const,
          targetId: rel.sourceId,
          targetTitle: state.projectResources.find(res => res.id === rel.sourceId)?.title || '',
          targetDoi: state.projectResources.find(res => res.id === rel.sourceId)?.doi,
          confidence: rel.confidence,
        }));
        const citationLinks = [...outgoing, ...incoming];
        if (citationLinks.length > 0 && props.onUpdateResource) {
          props.onUpdateResource({ ...r, citationLinks });
        }
        return { ...r, citationLinks };
      });
    } catch (e) {
      console.error('Citation analysis error:', e);
    } finally {
      setIsAnalyzingGraph(false);
    }
  };

  if (!state.selectedProjectId) {
    return <ProjectGallery projects={props.projects} onSelectProject={(id) => props.Maps('literature', id)} />;
  }

  return (
    <div className="h-full flex flex-col gap-3 animate-reveal overflow-y-auto lg:overflow-hidden relative px-3 sm:px-4 lg:px-5">
      <LiteratureHeader
        isLightMode={isLightMode}
        onBackToProjects={handleBack}
        projectTitle={state.selectedProject?.title}
        aiSearchKeywords={state.aiSearchKeywords}
        setAiSearchKeywords={state.setAiSearchKeywords}
        handleSearchAndAdd={actions.handleSearchAndAdd}
        isGlobalSearching={state.isGlobalSearching}
        fileInputRef={refs.fileInputRef as any}
        handleManualUpload={actions.handleManualUpload}
        onUploadArchivesClick={actions.handleUploadArchivesClick}
        viewMode={state.viewMode}
        setViewMode={state.setViewMode}
        handleCompareAnalysis={actions.handleCompareAnalysis}
        isSummarizing={state.isSummarizing}
        canSummarize={state.filteredResources.length >= 2}
        isReturnMode={state.isReturnToWriting || state.isReturnToProject || state.isReturnToMatrix || state.isReturnToBrain}
        returnType={state.isReturnToBrain ? 'brain' : state.isReturnToWriting ? 'writing' : state.isReturnToProject ? 'project' : state.isReturnToMatrix ? 'matrix' : undefined}
        searchFilters={state.searchFilters}
        onUpdateFilters={state.setSearchFilters}

        searchField={state.searchField}
        onSearchFieldChange={state.setSearchField}
        hasLastSearchResults={state.searchPreviewResults.length > 0}
        onReopenSearch={actions.handleReopenSearchPreview}
        unreadFeedCount={state.unreadFeedCount}
        onOpenSubscription={() => state.setShowSubscriptionPanel(true)}
        onOpenPdfSettings={() => state.setShowPdfSettings(true)}
        onOpenQuickCapture={() => state.setShowQuickCapture(true)}
        onOpenEpoSettings={() => setShowEpoSettings(true)}
      />

      {/* Verified Sources HUD */}
      {state.currentSearchSources.length > 0 && (
        <div className="bg-indigo-900/90 text-white px-6 py-3 rounded-2xl flex items-center gap-4 animate-reveal shadow-xl overflow-hidden shrink-0 border border-indigo-400/30">
          <div className="flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-shield-check text-emerald-400"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">{t('literatureModule.searchSourceVerification')}</span>
          </div>
          <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar scroll-smooth">
            {state.currentSearchSources.map((source, idx) => (
              <a
                key={idx}
                href={source.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-200 hover:text-white transition-colors whitespace-nowrap bg-white/10 px-2 py-1 rounded-lg border border-white/5"
              >
                <i className="fa-solid fa-link text-[8px]"></i>
                {source.title.substring(0, 30)}{source.title.length > 30 ? '...' : ''}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 pb-4 no-print">
        <div className={`transition-all duration-500 ease-in-out flex flex-col min-h-0 ${isDeepReading ? 'lg:col-span-0 w-0 opacity-0 pointer-events-none overflow-hidden lg:hidden' : 'col-span-1 lg:col-span-3 lg:h-full'}`}>
          <LiteratureSidebar
            activeType={state.activeType}
            onTypeChange={t => { state.setActiveType(t); state.setSelectedItemId(null); }}
            searchQuery={state.localSearchQuery}
            onSearchChange={state.setLocalSearchQuery}
            viewMode={state.viewMode}
            resources={state.filteredResources}
            reports={state.selectedProject?.savedReports?.filter(r => r.type === state.activeType) || []}
            proposals={(state.selectedProject?.proposals || []).filter(prop => props.resources.find(r => r.id === prop.literatureId)?.type === state.activeType || prop.literatureId === 'ALL')}
            selectedCategory={state.selectedCategory}
            onSelectCategory={state.setSelectedCategory}
            selectedTag={state.selectedTag}
            onSelectTag={state.setSelectedTag}
            allTags={state.allTags}
            allCategories={state.allCategories}
            sortBy={state.sortBy}
            onSortChange={state.setSortBy}
            onAddCategory={actions.handleAddCategory}
            onRemoveCategory={actions.handleRemoveCategory}
            selectedResourceId={state.selectedItemId}
            selectedReportId={state.selectedReportId}
            selectedProposalId={state.selectedProposalId}
            onSelectResource={id => { state.setSelectedItemId(id); state.setViewMode('list'); }}
            onSelectReport={state.setSelectedReportId}
            onSelectProposal={state.setSelectedProposalId}
            activeTasks={props.activeTasks}
            onDeleteResource={props.onDeleteResource}
            onStartTransformation={actions.handleTriggerTransformation}
            onLinkLocalFile={actions.handleLinkLocalFile}
            onOpenLocalFile={actions.handleOpenLocalFile}
            onDeleteReport={actions.handleDeleteReport}
            onRenameReport={actions.handleRenameReport}
            onDeleteProposal={actions.handleDeleteProposal}
            onRenameProposal={actions.handleRenameProposal}
            existingProposalIds={existingProposalIds}
            onJumpToProposal={handleJumpToProposal}
            onTogglePin={actions.handleTogglePin}
            enrichingIds={state.enrichingIds}
            readingStatusFilter={state.readingStatusFilter}
            onReadingStatusFilterChange={state.setReadingStatusFilter}
            isMultiSelectMode={state.isMultiSelectMode}
            selectedIds={state.selectedIds}
            onToggleMultiSelect={() => state.setIsMultiSelectMode(true)}
            onToggleCheck={actions.handleToggleSelect}
            onSelectAll={actions.handleSelectAll}
            onDeselectAll={actions.handleDeselectAll}
            onExitMultiSelect={actions.handleExitMultiSelect}
            onShowExportModal={() => state.setShowExportModal(true)}
            collections={state.projectCollections}
            selectedCollectionId={state.selectedCollectionId}
            onSelectCollection={state.setSelectedCollectionId}
            onAddCollection={actions.handleAddCollection}
            onRenameCollection={actions.handleRenameCollection}
            onDeleteCollection={actions.handleDeleteCollection}
            collectionCountMap={state.collectionCountMap}
          />
        </div>

        <div className={`${isDeepReading ? 'col-span-1 lg:col-span-12' : 'col-span-1 lg:col-span-9'} bg-white rounded-[2.5rem] overflow-hidden flex flex-col relative border border-slate-200 min-h-[500px] lg:h-full transition-all duration-500 ease-in-out`}>
          {state.viewMode === 'reports' && state.selectedReportId ? (
            state.selectedProject?.savedReports?.find(r => r.id === state.selectedReportId)
              ? <ReportView report={state.selectedProject.savedReports.find(r => r.id === state.selectedReportId)!} />
              : <EmptyPrompt icon="fa-chart-pie" text={t('literatureModule.reportExpired')} />
          ) : state.viewMode === 'list' ? (
            state.selectedItem ? (
              <LiteratureDetail
                item={state.selectedItem}
                activeType={state.activeType}
                isGenerating={state.isGeneratingThisItem}
                onDelete={props.onDeleteResource}
                onLinkLocalFile={() => actions.handleLinkLocalFile(state.selectedItem!)}
                onOpenLocalFile={() => state.selectedItem?.localPath && actions.handleOpenLocalFile(state.selectedItem.localPath)}
                onStartTransformation={actions.handleTriggerTransformation}
                onKnowledgeSink={actions.handleKnowledgeSink}
                existingProposalId={existingProposalIds[state.selectedItem.id]}
                onJumpToProposal={handleJumpToProposal}
                onUpdateResource={props.onUpdateResource}
                onReaderModeChange={setIsDeepReading}
                allCategories={state.allCategories}
                onUpdateReadingStatus={actions.handleUpdateReadingStatus}
                onDownloadPdf={actions.handleDownloadPdf}
              />
            ) : (
              <ProjectIntroduction
                project={state.selectedProject}
                resources={state.projectResources}
                proposals={state.selectedProject?.proposals || []}
                onSelectResource={(id) => { state.setSelectedItemId(id); state.setViewMode('list'); }}
                onOpenBibTeX={() => state.setShowQuickCapture(true)}
                onSwitchToGraph={() => state.setViewMode('graph')}
                onUploadClick={() => actions.handleUploadArchivesClick()}
              />
            )
          ) : (state.viewMode === 'benchmarking' || state.viewMode === 'knowledgePool') ? (
            <KnowledgePoolPanel
              projectId={state.selectedProjectId || ''}
              projectTitle={state.selectedProject?.title || ''}
              resources={state.projectResources}
              knowledgePool={state.selectedProject?.knowledgePool}
              targetMetrics={state.selectedProject?.targetMetrics}
              onUpdatePool={(pool) => {
                if (state.selectedProject) {
                  props.onUpdateProject({ ...state.selectedProject, knowledgePool: pool });
                }
              }}
              onNavigateToLiterature={(id) => {
                state.setSelectedItemId(id);
                state.setViewMode('list'); 
              }}
            />
          ) : state.viewMode === 'graph' ? (
            <CitationGraphView
              resources={state.projectResources}
              onSelectResource={(id) => {
                state.setSelectedItemId(id);
                state.setViewMode('list');
              }}
              onAnalyzeRelations={handleAnalyzeCitationRelations}
              isAnalyzing={isAnalyzingGraph}
            />
          ) : (
            state.selectedProject?.proposals?.find(p => p.id === state.selectedProposalId)
              ? <ProposalView proposal={state.selectedProject.proposals.find(p => p.id === state.selectedProposalId)!} onAdopt={handleAdoptProposal} onTraceLiterature={handleTraceLiterature} />
              : <EmptyPrompt icon="fa-file-shield" text={t('literatureModule.selectTransformPlan')} />
          )}
        </div>
      </div>

      {state.pathModalConfig.show && (
        <ManualPathModal
          manualPathInput={state.manualPathInput}
          setManualPathInput={state.setManualPathInput}
          onCancel={() => state.setPathModalConfig({ show: false, resource: null })}
          onConfirm={actions.handleConfirmManualPath}
        />
      )}



      {state.showExportModal && state.selectedIds.size > 0 && (
        <ExportModal
          items={actions.getSelectedResources()}
          onClose={() => state.setShowExportModal(false)}
        />
      )}

      {state.showSearchPreview && state.searchField === 'patent' && (
        <PatentSearchModal
          results={state.searchPreviewResults}
          isLoading={state.isSearchLoading}
          searchKeyword={state.aiSearchKeywords}
          groundingSources={state.currentSearchSources}
          onImport={actions.handleImportSelected}
          onClose={() => state.setShowSearchPreview(false)}
        />
      )}

      {state.showSearchPreview && state.searchField !== 'patent' && (
        <SearchPreviewModal
          results={state.searchPreviewResults}
          isLoading={state.isSearchLoading}
          searchField={state.searchField}
          searchKeyword={state.aiSearchKeywords}
          groundingSources={state.currentSearchSources}
          onImport={actions.handleImportSelected}
          onClose={() => state.setShowSearchPreview(false)}
        />
      )}

      {state.showSubscriptionPanel && (
        <SubscriptionPanel
          rules={state.subscriptionRules}
          feedItems={state.feedItems}
          isChecking={state.isCheckingSubscriptions}
          onAddRule={actions.handleAddSubscriptionRule}
          onRemoveRule={actions.handleRemoveSubscriptionRule}
          onToggleRule={actions.handleToggleSubscriptionRule}
          onCheckNow={actions.handleCheckSubscriptions}
          onImportFeedItem={actions.handleImportFeedItem}
          onMarkRead={actions.handleMarkFeedRead}
          onStarFeedItem={actions.handleStarFeedItem}
          digestReports={state.digestReports}
          isGeneratingDigest={state.isGeneratingDigest}
          onGenerateDigest={actions.handleGenerateDigest}
          recommendations={state.recommendations}
          isFetchingRecommendations={state.isFetchingRecommendations}
          onFetchRecommendations={actions.handleFetchRecommendations}
          onImportRecommendation={actions.handleImportRecommendation}
          onDismissRecommendation={actions.handleDismissRecommendation}
          onClose={() => state.setShowSubscriptionPanel(false)}
        />
      )}

      {state.showPdfSettings && (
        <PdfSettingsModal
          onClose={() => state.setShowPdfSettings(false)}
        />
      )}

      {state.showQuickCapture && (
        <QuickCaptureModal
          projectId={state.selectedProjectId || ''}
          collections={state.projectCollections}
          onImport={actions.handleQuickImport}
          onImportBibTeX={actions.handleImportBibTeX}
          isBibParsing={state.isParsingBib}
          onClose={() => state.setShowQuickCapture(false)}
        />
      )}

      {showEpoSettings && (
        <EpoSettingsModal
          onClose={() => setShowEpoSettings(false)}
        />
      )}

      {/* Internal Flow Modals */}
      <SafeModal config={state.confirmConfig} onClose={() => state.setConfirmConfig(null)} />
      <RenameModal
        show={!!state.renameConfig?.show}
        title={state.renameConfig?.title || ''}
        initialValue={state.renameConfig?.initialValue || ''}
        onClose={() => state.setRenameConfig(null)}
        onConfirm={(val) => state.renameConfig?.onConfirm(val)}
      />
    </div>
  );
};

export default Literature;
