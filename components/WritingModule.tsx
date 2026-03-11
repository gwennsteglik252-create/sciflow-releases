import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ResearchProject, Literature, AiTask, AppView, PaperSectionId, PaperSection } from '../types';
import SafeModal from './SafeModal';
import WritingSidebar from './Writing/WritingSidebar';
import WritingHeader from './Writing/WritingHeader';
import WritingEditor from './Writing/WritingEditor';
import PublishingView from './Writing/PublishingView';
import ManageSectionsModal from './Writing/ManageSectionsModal';
import WritingSettingsModal from './Writing/WritingSettingsModal';
import ScientificFigureStudio from './ScientificFigureStudio';
import SubmissionSimulator from './Writing/SubmissionSimulator/SubmissionSimulator';
import { TableEditorModal } from './Writing/SidebarPanels/TableEditorModal';
import { LatexEditorModal } from './Writing/SidebarPanels/LatexEditorModal';
import { useWritingLogic } from '../hooks/useWritingLogic';
import { useProjectContext } from '../context/ProjectContext';
import { SECTION_CONFIG, DocType } from './Writing/WritingConfig';

const MemoizedEditor = React.memo(WritingEditor);
const MemoizedPublishing = React.memo(PublishingView);
const MemoizedHeader = React.memo(WritingHeader);

interface WritingModuleProps {
  projects: ResearchProject[];
  resources: Literature[];
  activeTasks: AiTask[];
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
  onUpdateProject?: (project: ResearchProject) => void;
  initialProjectId?: string;
  initialSection?: PaperSectionId;
  initialSubView?: string;
  onSetAiStatus?: (status: string | null) => void;
}

const WritingModule: React.FC<WritingModuleProps> = ({
  projects, resources, activeTasks, navigate, onUpdateProject, initialProjectId, initialSection, initialSubView, onSetAiStatus
}) => {
  const { activeTheme, showToast, setAppSettings } = useProjectContext();
  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [viewMode, setViewMode] = useState<'standard' | 'dual' | 'triple'>('standard');
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [isManageSectionsOpen, setIsManageSectionsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showSubmissionSimulator, setShowSubmissionSimulator] = useState(false);
  // 稳定的 noop 回调，避免传给 MemoizedEditor/MemoizedPublishing 的 onToggleRightSidebar 每次渲染都是新箭头函数
  const noopToggle = useCallback(() => { }, []);
  const toggleRightSidebar = useCallback(() => setIsRightSidebarVisible(v => !v), []);

  const { state, refs, actions } = useWritingLogic({
    projects,
    resources,
    initialProjectId,
    initialSubView,
    onUpdateProject,
    onSetAiStatus,
    setCursorPosition,
    isFocusMode, // 传入聚焦模式状态
    viewMode     // 传入视图模式，供双栏/三栏预览防抖使用
  });

  const {
    selectedProjectId, setSelectedProjectId,
    docType, setDocType,
    language, setLanguage,
    activeSectionId,
    activeTab, setActiveTab,
    activeMediaSubTab, setActiveMediaSubTab,
    expandedMilestoneIds, setExpandedMilestoneIds,
    editorContent, syncedContent,
    saveStatus, lastSavedTime,
    selectedLogIds, setSelectedLogIds,
    reviewResult,
    appliedCritiqueQuotes,
    activeTemplateId,
    manuscriptMeta, setManuscriptMeta,
    isProcessing,
    confirmConfig, setConfirmConfig,
    showFigureStudio, setShowFigureStudio,
    figureStudioTarget, setFigureStudioTarget,
    tableEditorTarget, setTableEditorTarget,
    mathEditorTarget, setMathEditorTarget,
    selectedProject,
    activeTemplate,
    templates,
    currentSections,
    projectMedia,
    highlightedResourceIds,
    documentOutline,
    canUndo, canRedo,
    mirrorInsight,
    isJumpingManual
  } = state;

  const { textareaRef, cursorPositionRef } = refs;

  // 用 ref 跟踪 editorContent，让侧边栏（润色面板）按需读取最新值，
  // 但不因每次按键 editorContent 变化而导致 commonSidebarProps useMemo 重新计算
  const editorContentRef = React.useRef(editorContent);
  editorContentRef.current = editorContent;

  useEffect(() => {
    if (viewMode === 'dual' || viewMode === 'triple') {
      setAppSettings({ sidebarMode: 'collapsed' });
    } else {
      setAppSettings({ sidebarMode: 'expanded' });
      // 切换回标准模式时，如果不在发布视图，恢复右侧工具栏可见
      if (activeTab !== 'publishing') {
        setIsRightSidebarVisible(true);
      }
    }
  }, [viewMode, setAppSettings]);

  // 当从 publishing tab 切换回其他 tab 时，恢复右侧工具栏
  useEffect(() => {
    if (viewMode === 'standard' && activeTab !== 'publishing') {
      setIsRightSidebarVisible(true);
    }
  }, [activeTab, viewMode]);

  const handleUpdateMediaAsset = (media: any, newName: string, newCaption: string, subFigures?: { label: string; desc: string }[]) => {
    if (!selectedProject || !onUpdateProject) return;

    if (media.logId === 'PROJECT_LEVEL') {
      const updatedMedia = [...(selectedProject.media || [])];
      if (updatedMedia[media.fileIndex]) {
        updatedMedia[media.fileIndex] = { ...updatedMedia[media.fileIndex], name: newName, description: newCaption, ...(subFigures !== undefined ? { subFigures } : {}) };
      }
      onUpdateProject({ ...selectedProject, media: updatedMedia });
      showToast({ message: '项目素材信息已更新', type: 'success' });
      return;
    }

    const updatedMilestones = selectedProject.milestones.map(m => ({
      ...m,
      logs: m.logs.map(l => {
        if (l.id === media.logId) {
          const newFiles = [...(l.files || [])];
          if (newFiles[media.fileIndex]) {
            newFiles[media.fileIndex] = { ...newFiles[media.fileIndex], name: newName, description: newCaption, ...(subFigures !== undefined ? { subFigures } : {}) };
          }
          return { ...l, files: newFiles };
        }
        return l;
      })
    }));
    onUpdateProject({ ...selectedProject, milestones: updatedMilestones });
    showToast({ message: '素材信息已更新', type: 'success' });
  };

  // useMemo 包裹，防止 React.memo(WritingSidebar) 因引用变化失效
  const commonSidebarProps = useMemo(() => ({
    project: selectedProject, resources, activeTab, onTabChange: setActiveTab, docType,
    activeMediaSubTab, onMediaSubTabChange: (sub: any) => setActiveMediaSubTab(sub),
    selectedLogIds,
    onToggleLogSelection: (id: string) => setSelectedLogIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
    expandedMilestoneIds,
    onToggleMilestone: (id: string) => setExpandedMilestoneIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    }),
    onInsertText: actions.handleInsertText,
    onCiteLiterature: (res: Literature) => actions.handleInsertText(actions.getCitationTag(res)),
    onFindCitation: actions.handleFindCitation,
    onRemoveCitation: actions.handleRemoveCitation,
    onPolish: actions.handlePolish,
    onGenerateMethodology: actions.onGenerateMethodology,
    onGenerateCaption: actions.onGenerateCaption,
    onGenerateConclusion: actions.handleGenerateConclusion,
    onGenerateBibliography: actions.handleGenerateBib,
    orderedCitations: state.orderedCitations,
    activeTemplateId: state.activeTemplateId,
    onAddNode: actions.handleFlowchartToEmbodiment || (() => { }),
    onDeleteMedia: (logId: string, fileIndex: number) => {
      setConfirmConfig({
        show: true,
        title: '确认删除素材？',
        desc: '该素材及其关联的原始数据将从课题记录中永久移除。确认执行吗？',
        onConfirm: () => {
          actions.handleDeleteMedia(logId, fileIndex);
          setConfirmConfig(null);
        }
      });
    },
    onRenameMedia: actions.handleRenameMedia,
    onReplaceMediaImage: actions.handleReplaceMediaImage,
    onRunSimulatedReview: actions.handleRunSimulatedReview,
    onRunMirrorAnalysis: actions.handleRunMirrorAnalysis,
    mirrorInsight,
    onGeneratePlanActual: actions.handleGeneratePlanActual,
    onFlowchartToEmbodiment: actions.handleFlowchartToEmbodiment,
    onSynthesizeResults: actions.handleSynthesizeResults,
    isProcessing, projectMedia,
    reviewResult,
    appliedCritiqueQuotes,
    onReviewClick: actions.handleFindQuote,
    onApplySuggestion: actions.handleApplySuggestion,
    onSelectTemplate: actions.handleSelectTemplate,
    templates, manuscriptMeta, onUpdateMeta: setManuscriptMeta,
    onExportWord: actions.handleExportWord, onExportPackage: actions.handleExportPackage,
    onOpenFigureStudio: (media?: any) => {
      if (media) setFigureStudioTarget(media.refId);
      else setFigureStudioTarget(null);
      setShowFigureStudio(true);
    },
    onInsertFigure: (refId: string) => actions.handleInsertText(`[Fig:${refId}]`),
    onUploadMedia: actions.handleManualMediaUpload,
    onAddTemplate: actions.handleAddTemplate,
    snapshots: selectedProject?.writingSnapshots || [],
    onCreateSnapshot: actions.handleCreateSnapshot,
    onRestoreSnapshot: actions.handleRestoreSnapshot,
    onDeleteSnapshot: actions.handleDeleteSnapshot,
    highlightedResourceId: highlightedResourceIds,
    onViewDetails: (res: Literature) => selectedProject && navigate('literature', selectedProject.id, `${res.id}_rw`),
    onDeleteTemplate: actions.handleDeleteTemplate,
    onSaveTable: actions.handleSaveTable,
    onDeleteTable: (id: string) => {
      setConfirmConfig({
        show: true,
        title: '确认删除表格？',
        desc: '该三线表将从课题文库中永久移除。确认执行吗？',
        onConfirm: () => {
          actions.handleDeleteTable(id);
          setConfirmConfig(null);
        }
      });
    },
    onSaveSnippet: actions.handleSaveSnippet,
    onDeleteSnippet: (id: string) => {
      setConfirmConfig({
        show: true,
        title: '确认删除公式？',
        desc: '该 LaTeX 公式片段将从课题文库中永久移除。确认执行吗？',
        onConfirm: () => {
          actions.handleDeleteSnippet(id);
          setConfirmConfig(null);
        }
      });
    },
    viewMode, documentOutline, onJumpToHeading: actions.handleJumpToHeading,
    onFindToken: (type: any, id: string) => actions.handleFindToken(type, id),
    language,
    editorContentRef,
    onApplyPolished: (text: string) => {
      actions.handleEditorChange({ target: { value: text } } as any);
      showToast({ message: "已采纳润色建议", type: 'success' });
    },
    onOpenSubmissionSimulator: () => setShowSubmissionSimulator(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    selectedProject, resources, activeTab, docType, activeMediaSubTab, selectedLogIds,
    expandedMilestoneIds, isProcessing, projectMedia, reviewResult, appliedCritiqueQuotes,
    templates, manuscriptMeta, highlightedResourceIds, viewMode, documentOutline,
    language, mirrorInsight,
    state.orderedCitations, state.activeTemplateId,
    actions.handleInsertText, actions.handleFindCitation, actions.handleRemoveCitation,
    actions.handlePolish, actions.onGenerateMethodology, actions.onGenerateCaption,
    actions.handleGenerateConclusion, actions.handleGenerateBib,
    actions.handleRenameMedia, actions.handleReplaceMediaImage, actions.handleRunSimulatedReview,
    actions.handleRunMirrorAnalysis, actions.handleGeneratePlanActual, actions.handleFlowchartToEmbodiment,
    actions.handleSynthesizeResults, actions.handleFindQuote, actions.handleApplySuggestion,
    actions.handleSelectTemplate, actions.handleExportWord, actions.handleExportPackage,
    actions.handleManualMediaUpload, actions.handleAddTemplate, actions.handleCreateSnapshot,
    actions.handleRestoreSnapshot, actions.handleDeleteSnapshot, actions.handleDeleteTemplate,
    actions.handleSaveTable, actions.handleSaveSnippet, actions.handleJumpToHeading,
    actions.handleFindToken, actions.getCitationTag
  ]);

  // useMemo 包裹，防止每次 WritingModule 渲染时 commonEditorProps 对象重建，
  // 导致 React.memo(WritingEditor) 失效、编辑器组件树频繁重渲染
  const commonEditorProps = useMemo(() => ({
    currentSections, activeSectionId, onSectionSwitch: actions.handleSectionSwitch,
    editorContent,
    onEditorChange: actions.handleEditorChange,
    onEditorSelect: actions.handleEditorSelect,
    onCompositionStart: actions.handleCompositionStart,
    onCompositionEnd: actions.handleCompositionEnd,
    onBlur: () => actions.handleSectionSwitch(activeSectionId),
    saveStatus, lastSavedTime, isProcessing,
    onPolish: actions.handlePolish, onGenerateBib: actions.handleGenerateBib, onSmartWrite: actions.handleSmartWrite,
    onAddSection: (sections: PaperSection[]) => actions.handleAddSection(sections),
    onManageSections: () => setIsManageSectionsOpen(true),
    onManualSave: actions.handleManualSave,
    onUndo: actions.handleUndo,
    onRedo: actions.handleRedo,
    canUndo, canRedo,
    activeTemplateName: activeTemplate.name, textareaRef, onKeyDown: actions.handleEditorKeyDown,
    onDoubleClick: actions.handleEditorDoubleClick, onFormatText: actions.handleFormatText,
    onSwitchToPublishing: () => { setViewMode('standard'); setActiveTab('publishing'); setIsRightSidebarVisible(false); },
    viewMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    currentSections, activeSectionId, editorContent, saveStatus, lastSavedTime, isProcessing,
    canUndo, canRedo, activeTemplate.name, viewMode,
    actions.handleSectionSwitch, actions.handleEditorChange, actions.handleEditorSelect,
    actions.handleCompositionStart, actions.handleCompositionEnd,
    actions.handlePolish, actions.handleGenerateBib, actions.handleSmartWrite,
    actions.handleAddSection, actions.handleManualSave, actions.handleUndo, actions.handleRedo,
    actions.handleEditorKeyDown, actions.handleEditorDoubleClick, actions.handleFormatText,
    textareaRef
  ]);

  // 同样用 useMemo 包裹 publishing props，防止 MemoizedPublishing 无效重渲染
  const commonPublishingProps = useMemo(() => ({
    project: selectedProject, resources, projectMedia, docType, activeTemplate, templates, manuscriptMeta, language,
    currentSections, onBack: () => { setViewMode('standard'); setActiveTab('materials'); setIsRightSidebarVisible(true); },
    onSelectTemplate: actions.handleSelectTemplate,
    onManageSections: () => setIsManageSectionsOpen(true), activeSectionId, cursorPosition,
    activeSectionContent: syncedContent,
    viewMode, isFocusMode,
    onSyncClick: (sid: string, off: number, len: number) => actions.handleJumpToOffset(sid, off, len),
    onFigCaptionDblClick: (refId: string) => {
      setFigureStudioTarget(refId);
      setShowFigureStudio(true);
    },
    onTableDblClick: (tableId: string) => {
      const table = selectedProject?.tables?.find(t => t.id === tableId);
      if (table) setTableEditorTarget(table);
    },
    onMathDblClick: (snippetId: string) => {
      const snippet = selectedProject?.latexSnippets?.find(s => s.id === snippetId);
      if (snippet) setMathEditorTarget(snippet);
    },
    isJumpingManual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    selectedProject, resources, projectMedia, docType, activeTemplate, templates, manuscriptMeta, language,
    currentSections, activeSectionId, cursorPosition, syncedContent, viewMode, isFocusMode, isJumpingManual,
    actions.handleSelectTemplate, actions.handleJumpToOffset
  ]);

  const panelStyle: React.CSSProperties = {
    contain: 'size layout style',
    willChange: 'width, transform, flex',
    transition: 'flex 250ms cubic-bezier(0.4, 0, 0.2, 1), width 250ms cubic-bezier(0.4, 0, 0.2, 1)'
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-reveal relative px-4 sm:px-6 lg:px-8 overflow-hidden">
      <MemoizedHeader
        selectedProject={selectedProject} projects={projects} selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId} docType={docType} onDocTypeChange={setDocType}
        onSectionSwitch={actions.handleSectionSwitch} isLightMode={activeTheme.type === 'light'} onManualSave={actions.handleManualSave}
        language={language} setLanguage={setLanguage} viewMode={viewMode} setViewMode={setViewMode}
        isFocusMode={isFocusMode} setIsFocusMode={setIsFocusMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 h-[calc(100vh-120px)] min-h-0 py-1 overflow-hidden">
        {viewMode === 'triple' ? (
          <div className="grid grid-cols-12 gap-4 h-full overflow-hidden">
            <div className="col-span-3 flex flex-col h-full overflow-hidden" style={panelStyle}>
              <WritingSidebar {...commonSidebarProps} />
            </div>
            <div className="col-span-4 flex flex-col overflow-hidden h-full shadow-lg rounded-3xl border border-slate-200/60 bg-white relative" style={panelStyle}>
              <MemoizedEditor {...commonEditorProps} isRightSidebarVisible={false} onToggleRightSidebar={noopToggle} />
            </div>
            <div className="col-span-5 flex flex-col overflow-hidden h-full shadow-lg rounded-3xl border border-slate-200/60 bg-slate-50 relative" style={panelStyle}>
              <MemoizedPublishing {...commonPublishingProps} isRightSidebarVisible={false} onToggleRightSidebar={noopToggle} />
            </div>
          </div>
        ) : viewMode === 'dual' ? (
          <div className="grid grid-cols-12 gap-4 h-full overflow-hidden">
            <div className="col-span-6 flex flex-col overflow-hidden h-full shadow-lg rounded-3xl border border-slate-200/60 bg-white relative" style={panelStyle}>
              <MemoizedEditor {...commonEditorProps} isRightSidebarVisible={false} onToggleRightSidebar={noopToggle} />
            </div>
            <div className="col-span-6 flex flex-col overflow-hidden h-full shadow-lg rounded-3xl border border-slate-200/60 bg-slate-50 relative" style={panelStyle}>
              <MemoizedPublishing {...commonPublishingProps} isRightSidebarVisible={false} onToggleRightSidebar={noopToggle} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
            {isRightSidebarVisible && <div className="lg:col-span-5 lg:order-2 flex flex-col gap-4 overflow-hidden h-auto lg:h-full min-w-0 sm:min-w-[300px]"><WritingSidebar {...commonSidebarProps} /></div>}
            <div className={`col-span-1 ${isRightSidebarVisible ? 'lg:col-span-7' : 'lg:col-span-12'} lg:order-1 flex flex-col overflow-hidden h-full`} style={panelStyle}>
              {activeTab === 'publishing' ? <MemoizedPublishing {...commonPublishingProps} isRightSidebarVisible={isRightSidebarVisible} onToggleRightSidebar={toggleRightSidebar} /> : <MemoizedEditor {...commonEditorProps} isRightSidebarVisible={isRightSidebarVisible} onToggleRightSidebar={toggleRightSidebar} />}
            </div>
          </div>
        )}
      </div>
      <SafeModal config={confirmConfig} onClose={() => setConfirmConfig(null)} />
      <ManageSectionsModal show={isManageSectionsOpen} onClose={() => setIsManageSectionsOpen(false)} sections={currentSections.map(sec => selectedProject?.paperSections?.find(p => p.id === sec.id) || { id: sec.id, title: sec.label, content: '' })} onSave={actions.handleAddSection} />
      <WritingSettingsModal
        show={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        docType={docType}
        onDocTypeChange={setDocType}
        language={language}
        setLanguage={setLanguage}
        onSectionSwitch={actions.handleSectionSwitch}
        activeTemplateId={activeTemplateId}
        onSelectTemplate={actions.handleSelectTemplate}
        templates={templates}
        onAddTemplate={actions.handleAddTemplate}
      />
      <ScientificFigureStudio projectMedia={projectMedia} onUpdateAsset={handleUpdateMediaAsset} onClose={() => setShowFigureStudio(false)} isActive={showFigureStudio} initialRefId={figureStudioTarget} onInsert={actions.handleInsertText} language={language} project={selectedProject} />

      {showSubmissionSimulator && (
        <SubmissionSimulator
          project={selectedProject}
          meta={manuscriptMeta}
          sections={selectedProject?.paperSections || []}
          media={projectMedia}
          tables={selectedProject?.tables || []}
          language={language}
          onClose={() => setShowSubmissionSimulator(false)}
        />
      )}

      {/* 双击发布视图中的表格时直接打开编辑弹窗 */}
      <TableEditorModal
        show={!!tableEditorTarget}
        onClose={() => setTableEditorTarget(null)}
        onSave={(table) => { actions.handleSaveTable(table); setTableEditorTarget(null); }}
        onInsertText={actions.handleInsertText}
        onAddNode={undefined}
        onCiteLiterature={() => { }}
        initialTable={tableEditorTarget}
        project={selectedProject}
        allResources={resources}
      />

      {/* 双击发布视图中的公式时直接打开编辑弹窗 */}
      <LatexEditorModal
        show={!!mathEditorTarget}
        onClose={() => setMathEditorTarget(null)}
        onSave={(snippet) => { actions.handleSaveSnippet(snippet); setMathEditorTarget(null); }}
        initialSnippet={mathEditorTarget}
      />
    </div>
  );
};

export default WritingModule;