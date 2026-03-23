import React from 'react';
import { useTranslation } from '../../locales/useTranslation';
import { ResearchProject, Literature, Milestone, WritingSnapshot, ProjectTable, ProjectLatexSnippet } from '../../types';

import MaterialsPanel from './SidebarPanels/MaterialsPanel';
import MediaPanel from './SidebarPanels/MediaPanel';
import LiteraturePanel from './SidebarPanels/LiteraturePanel';
import PolishingPanel from './SidebarPanels/PolishingPanel';
import ReviewPanel from './SidebarPanels/ReviewPanel';
import PublishingPanel from './SidebarPanels/PublishingPanel';
import HistoryPanel from './SidebarPanels/HistoryPanel';
import OutlinePanel from './SidebarPanels/OutlinePanel';
import MirrorPanel from './SidebarPanels/MirrorPanel';
import ReviewWorkshopTab from './SidebarPanels/ReviewWorkshopTab';
import { useReviewWorkshop } from '../../hooks/useReviewWorkshop';

export interface WritingSidebarProps {
  project: ResearchProject | undefined;
  resources: Literature[];
  activeTab: string;
  onTabChange: (tab: any) => void;
  activeMediaSubTab?: 'images' | 'tables' | 'latex';
  onMediaSubTabChange?: (subTab: 'images' | 'tables' | 'latex') => void;
  docType: 'paper' | 'report' | 'patent';
  selectedLogIds: Set<string>;
  onToggleLogSelection: (id: string) => void;
  expandedMilestoneIds: Set<string>;
  onToggleMilestone: (id: string) => void;
  onInsertText: (text: string) => void;
  onCiteLiterature: (res: Literature) => void;
  onFindCitation: (res: Literature) => void;
  onRemoveCitation: (res: Literature) => void;
  onPolish: (mode: any) => void;
  onGenerateMethodology: (ms: Milestone) => void;
  onGenerateCaption: (desc: string) => void;
  onGenerateConclusion: (log: any) => void;
  onDeleteMedia: (logId: string, fileIndex: number) => void;
  onRenameMedia: (logId: string, fileIndex: number, newName: string) => void;
  onReplaceMediaImage?: (logId: string, fileIndex: number, newFile: File) => void;
  onRunSimulatedReview: () => void;
  onRunMirrorAnalysis: () => void;
  mirrorInsight: any;
  onGeneratePlanActual: () => void;
  onFlowchartToEmbodiment: () => void;
  onSynthesizeResults: () => void;
  isProcessing: boolean;
  projectMedia: any[];
  reviewResult: any;
  onReviewClick: (quote: string) => void;
  onApplySuggestion: (quote: string, revision: string) => void;
  appliedCritiqueQuotes?: Set<string>;
  activeTemplateId: string;
  onSelectTemplate: (id: string) => void;
  templates: any[];
  manuscriptMeta: any;
  onUpdateMeta: (meta: any) => void;
  onExportWord: () => void;
  onExportPackage: () => void;
  onOpenFigureStudio: (media?: any) => void;
  onUploadMedia: (file: File, desc: string) => void;
  onAddTemplate: (tpl: any) => void;
  snapshots: WritingSnapshot[];
  onCreateSnapshot: (name: string) => void;
  onRestoreSnapshot: (snap: WritingSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  orderedCitations?: { list: Literature[]; map: Map<string, number> };
  onAddNode?: () => void;
  highlightedResourceId?: string[] | null;
  onViewDetails?: (res: Literature) => void;
  onDeleteTemplate: (id: string) => void;
  onSaveTable: (table: ProjectTable) => void;
  onDeleteTable: (id: string) => void;
  onSaveSnippet: (snippet: ProjectLatexSnippet) => void;
  onDeleteSnippet: (id: string) => void;
  viewMode?: 'standard' | 'dual' | 'triple';
  documentOutline?: any[];
  onJumpToHeading?: (sectionId: string, headingText: string) => void;
  onGenerateBibliography: (style: string) => void;
  onFindToken?: (type: any, id: string) => void;
  language: 'zh' | 'en';
  editorContentRef: React.RefObject<string>;
  onApplyPolished: (text: string) => void;
  // 核心修复：添加缺失的属性定义
  onOpenSubmissionSimulator?: () => void;
  /** 综述工坊 hook 返回值 */
  workshop?: ReturnType<typeof useReviewWorkshop>;
}

const tabColors: Record<string, string> = {
  outline: 'bg-slate-800',
  materials: 'bg-indigo-600',
  media: 'bg-sky-500',
  literature: 'bg-emerald-600',
  mirror: 'bg-amber-600',
  polishing: 'bg-amber-500',
  review_workshop: 'bg-purple-600',
  review: 'bg-rose-500',
  publishing: 'bg-slate-600',
  history: 'bg-violet-600'
};

const WritingSidebar: React.FC<WritingSidebarProps> = (props) => {
  const { activeTab, onTabChange, viewMode, documentOutline, onJumpToHeading, manuscriptMeta, onUpdateMeta, docType, onFindToken, language, editorContentRef, onApplyPolished, onOpenSubmissionSimulator } = props;
  const { t } = useTranslation();
  const tabs = ['outline', 'materials', 'media', 'literature', 'mirror', 'polishing', 'review_workshop', 'review', 'publishing', 'history'];
  const filteredTabs = viewMode === 'triple' ? tabs.filter(t => t !== 'publishing') : tabs;

  return (
    <div className="flex flex-col gap-4 overflow-hidden h-full min-w-0">
      <div className="bg-slate-900 rounded-[1.25rem] p-1.5 flex shrink-0 shadow-lg overflow-x-auto no-scrollbar">
        {filteredTabs.map((tab) => (
          <button key={tab} onClick={() => onTabChange(tab)} className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab ? `${tabColors[tab]} text-white shadow-md` : 'text-slate-400 hover:text-white'}`}>
            {tab === 'outline' ? t('writing.sidebar.outline') : tab === 'materials' ? t('writing.sidebar.materials') : tab === 'media' ? t('writing.sidebar.media') : tab === 'literature' ? t('writing.sidebar.literature') : tab === 'mirror' ? t('writing.sidebar.mirror') : tab === 'polishing' ? t('writing.sidebar.polishing') : tab === 'review_workshop' ? '综述' : tab === 'review' ? t('writing.sidebar.review') : tab === 'history' ? t('writing.sidebar.history') : t('writing.sidebar.publishing')}
          </button>
        ))}
      </div>
      <div className="flex-1 bg-white/95 backdrop-blur rounded-[1.25rem] border border-white/20 shadow-xl overflow-y-auto custom-scrollbar p-5 min-h-0">
        {activeTab === 'outline' && <OutlinePanel outline={documentOutline || []} onJump={onJumpToHeading} manuscriptMeta={manuscriptMeta} onUpdateMeta={onUpdateMeta} />}
        {activeTab === 'materials' && <MaterialsPanel project={props.project} docType={props.docType} selectedLogIds={props.selectedLogIds} onToggleLogSelection={props.onToggleLogSelection} expandedMilestoneIds={props.expandedMilestoneIds} onToggleMilestone={props.onToggleMilestone} onInsertText={props.onInsertText} onGenerateMethodology={props.onGenerateMethodology} onGenerateCaption={props.onGenerateCaption} onGenerateConclusion={props.onGenerateConclusion} onGeneratePlanActual={props.onGeneratePlanActual} onFlowchartToEmbodiment={props.onAddNode || (() => { })} onSynthesizeResults={props.onSynthesizeResults} isProcessing={props.isProcessing} onFindToken={(t, id) => onFindToken?.(t, id)} highlightedResourceId={props.highlightedResourceId} />}
        {activeTab === 'media' && (
          <MediaPanel
            project={props.project}
            resources={props.resources}
            onOpenFigureStudio={props.onOpenFigureStudio}
            projectMedia={props.projectMedia}
            onInsertText={props.onInsertText}
            onDeleteMedia={props.onDeleteMedia}
            onRenameMedia={props.onRenameMedia}
            onUploadMedia={props.onUploadMedia}
            onSaveTable={props.onSaveTable}
            onDeleteTable={props.onDeleteTable}
            onSaveSnippet={props.onSaveSnippet}
            onDeleteSnippet={props.onDeleteSnippet}
            onFindToken={(t, id) => onFindToken?.(t, id)}
            activeSubTab={props.activeMediaSubTab}
            onSubTabChange={props.onMediaSubTabChange}
            highlightedResourceId={props.highlightedResourceId}
            orderedCitations={props.orderedCitations}
            activeTemplateId={props.activeTemplateId}
            onCiteLiterature={props.onCiteLiterature}
            onReplaceMediaImage={props.onReplaceMediaImage}
            onAddNode={props.onAddNode}
          />
        )}
        {activeTab === 'literature' && <LiteraturePanel project={props.project} resources={props.resources} docType={props.docType} onCiteLiterature={props.onCiteLiterature} onFindCitation={props.onFindCitation} onRemoveCitation={props.onRemoveCitation} onGenerateBibliography={props.onGenerateBibliography} isProcessing={props.isProcessing} highlightedResourceId={props.highlightedResourceId} onViewDetails={props.onViewDetails} onFindToken={(t, id) => onFindToken?.(t, id)} orderedCitations={props.orderedCitations} />}
        {activeTab === 'mirror' && <MirrorPanel onRunMirrorAnalysis={props.onRunMirrorAnalysis} isProcessing={props.isProcessing} mirrorInsight={props.mirrorInsight} onInsertText={props.onInsertText} />}
        {activeTab === 'polishing' && <PolishingPanel onPolish={props.onPolish} isProcessing={props.isProcessing} docType={props.docType} language={language} editorContent={editorContentRef.current || ''} onApplyPolished={onApplyPolished} />}
        {activeTab === 'review_workshop' && props.workshop && <ReviewWorkshopTab workshop={props.workshop} onSwitchTab={onTabChange} />}
        {activeTab === 'review' && (
          <ReviewPanel
            onRunSimulatedReview={props.onRunSimulatedReview}
            isProcessing={props.isProcessing}
            reviewResult={props.reviewResult}
            onReviewClick={props.onReviewClick}
            onApplySuggestion={props.onApplySuggestion}
            appliedCritiqueQuotes={props.appliedCritiqueQuotes}
            // 核心修复：在这里将属性传给底层面板
            onOpenSubmissionSimulator={onOpenSubmissionSimulator}
          />
        )}
        {activeTab === 'publishing' && viewMode !== 'triple' && <PublishingPanel templates={props.templates} activeTemplateId={props.activeTemplateId} onSelectTemplate={props.onSelectTemplate} manuscriptMeta={props.manuscriptMeta} onUpdateMeta={props.onUpdateMeta} onExportWord={props.onExportWord} onExportPackage={props.onExportPackage} isProcessing={props.isProcessing} onAddTemplate={props.onAddTemplate} onDeleteTemplate={props.onDeleteTemplate} docType={docType} />}
        {activeTab === 'history' && <HistoryPanel snapshots={props.snapshots} onCreateSnapshot={props.onCreateSnapshot} onRestoreSnapshot={props.onRestoreSnapshot} onDeleteSnapshot={props.onDeleteSnapshot} />}
      </div>
    </div>
  );
};

export default React.memo(WritingSidebar);