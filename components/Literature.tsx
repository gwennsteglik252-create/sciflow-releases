import React, { useState, useMemo } from 'react';
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
import BibTeXModal from './Literature/BibTeXModal';
import BenchmarkingView from './Literature/BenchmarkingView';
import SearchPreviewModal from './Literature/SearchPreviewModal';
import { useProjectContext } from '../context/ProjectContext';
import { useLiteratureLogic } from '../hooks/useLiteratureLogic';

// Sub-component for Rename Modal
const RenameModal: React.FC<{
  show: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onConfirm: (val: string) => void;
}> = ({ show, title, initialValue, onClose, onConfirm }) => {
  const [val, setVal] = useState(initialValue);
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
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
          <button onClick={() => onConfirm(val)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">确认重命名</button>
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
  const isLightMode = activeTheme.type === 'light';
  const [isDeepReading, setIsDeepReading] = useState(false);

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
      title: `[转化] ${proposal.title.substring(0, 20)}...`,
      hypothesis: proposal.scientificHypothesis,
      status: 'pending',
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      logs: [{
        id: Date.now().toString() + '-log',
        timestamp: new Date().toLocaleString(),
        content: `采纳自建议库。关键目标：验证${proposal.scientificHypothesis.substring(0, 15)}...`,
        description: '由工艺转化建议自动生成的验证环节。',
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
    if (state.isReturnToWriting && state.selectedProjectId) {
      props.Maps('writing', state.selectedProjectId, 'literature');
    } else if (state.isReturnToProject && state.selectedProjectId) {
      props.Maps('project_detail', state.selectedProjectId, 'process');
    } else if (state.isReturnToMatrix && state.selectedProjectId) {
      props.Maps('project_detail', state.selectedProjectId, 'plan');
    } else {
      props.Maps('literature');
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
        isReturnMode={state.isReturnToWriting || state.isReturnToProject || state.isReturnToMatrix}
        returnType={state.isReturnToWriting ? 'writing' : state.isReturnToProject ? 'project' : state.isReturnToMatrix ? 'matrix' : undefined}
        searchFilters={state.searchFilters}
        onUpdateFilters={state.setSearchFilters}
        onOpenBibTeX={() => state.setShowBibTeXModal(true)}
        searchField={state.searchField}
        onSearchFieldChange={state.setSearchField}
        hasLastSearchResults={state.searchPreviewResults.length > 0}
        onReopenSearch={actions.handleReopenSearchPreview}
      />

      {/* Verified Sources HUD */}
      {state.currentSearchSources.length > 0 && (
        <div className="bg-indigo-900/90 text-white px-6 py-3 rounded-2xl flex items-center gap-4 animate-reveal shadow-xl overflow-hidden shrink-0 border border-indigo-400/30">
          <div className="flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-shield-check text-emerald-400"></i>
            <span className="text-[10px] font-black uppercase tracking-widest">检索溯源验证:</span>
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
          />
        </div>

        <div className={`${isDeepReading ? 'col-span-1 lg:col-span-12' : 'col-span-1 lg:col-span-9'} bg-white rounded-[2.5rem] overflow-hidden flex flex-col relative border border-slate-200 min-h-[500px] lg:h-full transition-all duration-500 ease-in-out`}>
          {state.viewMode === 'reports' && state.selectedReportId ? (
            state.selectedProject?.savedReports?.find(r => r.id === state.selectedReportId)
              ? <ReportView report={state.selectedProject.savedReports.find(r => r.id === state.selectedReportId)!} />
              : <EmptyPrompt icon="fa-chart-pie" text="分析报告已失效" />
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
              />
            ) : (
              <ProjectIntroduction project={state.selectedProject} resourcesCount={state.projectResources.length} />
            )
          ) : state.viewMode === 'benchmarking' ? (
            <BenchmarkingView resources={state.projectResources} />
          ) : (
            state.selectedProject?.proposals?.find(p => p.id === state.selectedProposalId)
              ? <ProposalView proposal={state.selectedProject.proposals.find(p => p.id === state.selectedProposalId)!} onAdopt={handleAdoptProposal} onTraceLiterature={handleTraceLiterature} />
              : <EmptyPrompt icon="fa-file-shield" text="请选择转化方案" />
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

      {state.showBibTeXModal && (
        <BibTeXModal
          onClose={() => state.setShowBibTeXModal(false)}
          onImport={actions.handleImportBibTeX}
          isParsing={state.isParsingBib}
        />
      )}

      {state.showSearchPreview && (
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
