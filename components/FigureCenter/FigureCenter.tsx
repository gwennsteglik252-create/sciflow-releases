import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStructuralDesigner } from '../../hooks/useStructuralDesigner';
import { useGenerativeDesigner } from '../../hooks/useGenerativeDesigner';
import { useTimelineDesigner } from '../../hooks/useTimelineDesigner';
import { useClassificationTree } from '../../hooks/useClassificationTree';
import { useSankeyDesigner } from '../../hooks/useSankeyDesigner';
import { useMindMapDesigner } from '../../hooks/useMindMapDesigner';
import StructuralDesigner from './StructuralDesigner';
import { FigureHeader } from './FigureHeader';
import { GenerativeView } from './Generative/GenerativeView';
import { FigureAssembly } from './FigureAssembly/FigureAssembly';
import { useFigureAssemblyLogic } from '../../hooks/useFigureAssemblyLogic';
import SummaryInfographic from './Summary/SummaryInfographic';
import { TimelineCanvas } from './Timeline/TimelineCanvas';
import { TimelineSidebar } from './Timeline/TimelineSidebar';
import { ClassificationTreeCanvas } from './ClassificationTree/ClassificationTreeCanvas';
import { ClassificationTreeSidebar } from './ClassificationTree/ClassificationTreeSidebar';
import { SankeyCanvas } from './Sankey/SankeyCanvas';
import { SankeySidebar } from './Sankey/SankeySidebar';
import { MindMapCanvas } from './MindMap/MindMapCanvas';
import { MindMapSidebar } from './MindMap/MindMapSidebar';
import { PublicationAudit } from './Audit/PublicationAudit';
import { ScientificStencils } from './Stencils/ScientificStencils';
import { useSummaryInfographic } from './Summary/useSummaryInfographic';
import { TemplateModal } from './TemplateModal';
import {
  useTemplateManager,
  extractStructuralTemplate,
  applyStructuralTemplate,
  extractTimelineTemplate,
  applyTimelineTemplate,
  extractSummaryTemplate,
  applySummaryTemplate,
} from '../../hooks/useTemplateManager';
import { useProjectContext } from '../../context/ProjectContext';
import { FigureTemplate, TemplateModule } from '../../types/templates';
import { calculateInitialPositions } from './Structure/utils';

type FigureTab = 'generative' | 'structural' | 'assembly' | 'summary' | 'timeline' | 'tree' | 'audit' | 'sankey' | 'mindmap';
const VALID_TABS: FigureTab[] = ['generative', 'structural', 'assembly', 'summary', 'timeline', 'tree', 'audit', 'sankey', 'mindmap'];

const FigureCenter: React.FC = () => {
  // 从 URL hash 初始化 tab（支持 #figure_center/sankey 等精确定位）
  const [activeTab, setActiveTabRaw] = useState<FigureTab>(() => {
    const hash = window.location.hash.replace('#', '');
    const parts = hash.split('/');
    if (parts[0] === 'figure_center' && parts[1] && VALID_TABS.includes(parts[1] as FigureTab)) {
      return parts[1] as FigureTab;
    }
    return 'generative';
  });

  // 切换 tab 时同步更新 URL hash
  const setActiveTab = useCallback((tab: FigureTab) => {
    setActiveTabRaw(tab);
    // 静默更新 hash，不触发 hashchange 事件以避免重复记录
    const newHash = `#figure_center/${tab}`;
    if (window.location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
  }, []);

  // 监听外部 hash 变化（如从快速访问导航点击跳转）
  useEffect(() => {
    // 初始化时同步 hash，确保 #figure_center 变为 #figure_center/tab
    const currentHash = window.location.hash.replace('#', '');
    const parts = currentHash.split('/');
    if (parts[0] === 'figure_center' && !parts[1]) {
      history.replaceState(null, '', `#figure_center/${activeTab}`);
    }

    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const p = hash.split('/');
      if (p[0] === 'figure_center' && p[1] && VALID_TABS.includes(p[1] as FigureTab)) {
        setActiveTabRaw(p[1] as FigureTab);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showStencils, setShowStencils] = useState(false);
  const { showToast } = useProjectContext();

  const structuralLogic = useStructuralDesigner(activeTab === 'structural');
  const generativeLogic = useGenerativeDesigner();
  const timelineLogic = useTimelineDesigner(activeTab === 'timeline');
  const summaryLogic = useSummaryInfographic();
  const assemblyLogic = useFigureAssemblyLogic(generativeLogic.savedLibrary);
  const treeLogic = useClassificationTree();
  const sankeyLogic = useSankeyDesigner();
  const mindmapLogic = useMindMapDesigner();
  const [editingSankeyTitle, setEditingSankeyTitle] = useState(false);

  const inputRef = useRef<HTMLDivElement>(null!);
  const libraryRef = useRef<HTMLDivElement>(null!);

  // ============================================
  // 模板管理：每个模块独立实例，避免跨模块数据混淆
  // ============================================
  const structuralTplMgr = useTemplateManager('structural');
  const timelineTplMgr = useTemplateManager('timeline');
  const summaryTplMgr = useTemplateManager('summary');

  // 根据当前 tab 选择对应的模板管理器
  const templateModule: TemplateModule =
    activeTab === 'structural' ? 'structural' :
      activeTab === 'timeline' ? 'timeline' :
        activeTab === 'summary' ? 'summary' :
          'structural';

  const templateManager =
    activeTab === 'structural' ? structuralTplMgr :
      activeTab === 'timeline' ? timelineTplMgr :
        activeTab === 'summary' ? summaryTplMgr :
          structuralTplMgr;

  // --- 模板操作回调 ---

  // 保存当前样式为模板
  const handleSaveCurrentAsTemplate = useCallback(() => {
    templateManager.setTemplateName('');
    templateManager.setShowSaveTemplateModal(true);
  }, [templateManager]);

  // 确认保存模板
  const handleConfirmSaveTemplate = useCallback(() => {
    const name = templateManager.templateName.trim();
    if (!name) return;

    let styleData: any = null;

    if (activeTab === 'structural') {
      styleData = extractStructuralTemplate(
        structuralLogic.data,
        structuralLogic.spacingConfig
      );
    } else if (activeTab === 'timeline' && timelineLogic.data) {
      styleData = extractTimelineTemplate(timelineLogic.data);
    } else if (activeTab === 'summary' && summaryLogic.infographicData) {
      styleData = extractSummaryTemplate(summaryLogic.infographicData);
    }

    if (styleData) {
      templateManager.saveTemplate(name, styleData);
      templateManager.setShowSaveTemplateModal(false);
      showToast({ message: `样式模板「${name}」已保存`, type: 'success' });
    }
  }, [activeTab, templateManager, structuralLogic, timelineLogic, summaryLogic, showToast]);

  // 应用模板
  const handleApplyTemplate = useCallback((template: FigureTemplate) => {
    if (activeTab === 'structural') {
      const newData = applyStructuralTemplate(structuralLogic.data, template.styleData);
      const newPositions = calculateInitialPositions(newData);
      // 借助 handleLoadFromLibrary 来设置 data + positions（它会调用 setData + setPositions）
      structuralLogic.handleLoadFromLibrary({
        id: 'tpl_apply',
        title: `模板: ${template.name}`,
        timestamp: '',
        data: newData,
        positions: newPositions,
      });
    } else if (activeTab === 'timeline' && timelineLogic.data) {
      const newData = applyTimelineTemplate(timelineLogic.data, template.styleData);
      timelineLogic.setData(newData);
      showToast({ message: `已应用模板「${template.name}」`, type: 'success' });
    } else if (activeTab === 'summary' && summaryLogic.infographicData) {
      const newData = applySummaryTemplate(summaryLogic.infographicData, template.styleData);
      summaryLogic.handleCoreUpdate(newData);
      showToast({ message: `已应用模板「${template.name}」`, type: 'success' });
    }
  }, [activeTab, structuralLogic, timelineLogic, summaryLogic, showToast]);

  // 打开模板弹窗
  const handleTemplateClick = useCallback(() => {
    templateManager.setShowTemplateModal(true);
  }, [templateManager]);

  return (
    <div className="h-full flex flex-col gap-4 animate-reveal overflow-hidden px-4 py-2 relative">
      <FigureHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        generativeLogic={generativeLogic}
        structuralLogic={structuralLogic}
        timelineLogic={timelineLogic}
        summaryLogic={summaryLogic}
        assemblyLogic={assemblyLogic}
        treeLogic={treeLogic}
        sankeyLogic={sankeyLogic}
        mindmapLogic={mindmapLogic}
        onTemplateClick={handleTemplateClick}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'structural' ? (
          <StructuralDesigner logic={structuralLogic} />
        ) : activeTab === 'assembly' ? (
          <FigureAssembly generativeLogic={generativeLogic} logic={assemblyLogic} />
        ) : activeTab === 'summary' ? (
          <SummaryInfographic logic={summaryLogic} />
        ) : activeTab === 'audit' ? (
          <PublicationAudit />
        ) : activeTab === 'tree' ? (
          <div className="flex-1 flex gap-4 h-full min-h-0 overflow-hidden">
            <ClassificationTreeSidebar
              userPrompt={treeLogic.userPrompt}
              onUserPromptChange={treeLogic.setUserPrompt}
              isGenerating={treeLogic.isGenerating}
              onGenerate={treeLogic.handleGenerate}
              onCreateEmpty={treeLogic.handleCreateEmpty}
              data={treeLogic.data}
              setData={treeLogic.setData}
              selectedNodeId={treeLogic.selectedNodeId}
              setSelectedNodeId={treeLogic.setSelectedNodeId}
              onUpdateNode={treeLogic.updateNode}
              onDeleteNode={treeLogic.deleteNode}
              onAddChild={treeLogic.addChildNode}
              onToggleCollapse={treeLogic.toggleCollapse}
              onSetLayout={treeLogic.setLayout}
              aiLanguage={treeLogic.aiLanguage}
              onAiLanguageChange={treeLogic.setAiLanguage}
              onExportPng={treeLogic.handleExport}
              savedTrees={treeLogic.savedTrees}
              showLibrary={treeLogic.showLibrary}
              setShowLibrary={treeLogic.setShowLibrary}
              onLoadSaved={treeLogic.handleLoadFromLibrary}
              onDeleteSaved={treeLogic.handleDeleteFromLibrary}
              onRenameSaved={treeLogic.handleRenameInLibrary}
              onCategoryChange={treeLogic.handleCategoryChange}
              showSaveModal={treeLogic.showSaveModal}
              setShowSaveModal={treeLogic.setShowSaveModal}
              saveTitle={treeLogic.saveTitle}
              setSaveTitle={treeLogic.setSaveTitle}
              onConfirmSave={treeLogic.handleConfirmSave}
              onSaveToLibrary={treeLogic.handleSaveToLibrary}
              onUndo={treeLogic.undo}
              onRedo={treeLogic.redo}
              canUndo={treeLogic.canUndo}
              canRedo={treeLogic.canRedo}
            />
            <ClassificationTreeCanvas
              data={treeLogic.data}
              selectedNodeId={treeLogic.selectedNodeId}
              setSelectedNodeId={treeLogic.setSelectedNodeId}
              onUpdateNode={treeLogic.updateNode}
              onDeleteNode={treeLogic.deleteNode}
              onAddChild={treeLogic.addChildNode}
              onToggleCollapse={treeLogic.toggleCollapse}
              zoom={treeLogic.zoom}
              setZoom={treeLogic.setZoom}
              pan={treeLogic.pan}
              setPan={treeLogic.setPan}
              containerRef={treeLogic.containerRef}
              onUndo={treeLogic.undo}
              onRedo={treeLogic.redo}
              canUndo={treeLogic.canUndo}
              canRedo={treeLogic.canRedo}
            />
          </div>
        ) : activeTab === 'sankey' ? (
          <div className="flex-1 flex gap-4 h-full min-h-0 overflow-hidden">
            <SankeySidebar
              // AI & Core
              userPrompt={sankeyLogic.userPrompt}
              onUserPromptChange={sankeyLogic.setUserPrompt}
              isGenerating={sankeyLogic.isGenerating}
              onGenerate={sankeyLogic.handleGenerate}
              onCreateEmpty={sankeyLogic.handleCreateEmpty}
              data={sankeyLogic.data}
              setData={sankeyLogic.setData}
              selectedNodeId={sankeyLogic.selectedNodeId}
              setSelectedNodeId={sankeyLogic.setSelectedNodeId}

              // Operations
              updateNode={sankeyLogic.updateNode}
              deleteNode={sankeyLogic.deleteNode}
              addNode={sankeyLogic.addNode}
              updateLink={sankeyLogic.updateLink}
              deleteLink={sankeyLogic.deleteLink}
              addLink={sankeyLogic.addLink}
              updateGlobal={sankeyLogic.updateGlobal}

              // Tools
              aiLanguage={sankeyLogic.aiLanguage}
              onAiLanguageChange={sankeyLogic.setAiLanguage}
              aiComplexity={sankeyLogic.aiComplexity}
              onAiComplexityChange={sankeyLogic.setAiComplexity}
              onExportPng={sankeyLogic.handleExport}
              onUndo={sankeyLogic.undo}
              onRedo={sankeyLogic.redo}
              canUndo={sankeyLogic.canUndo}
              canRedo={sankeyLogic.canRedo}

              // Library
              savedSankeys={sankeyLogic.savedSankeyList}
              showLibrary={sankeyLogic.showLibrary}
              setShowLibrary={sankeyLogic.setShowLibrary}
              onLoadSaved={sankeyLogic.handleLoadFromLibrary}
              onDeleteSaved={sankeyLogic.handleDeleteFromLibrary}
              onRenameSaved={sankeyLogic.handleRenameInLibrary}
              onCategoryChange={sankeyLogic.handleCategoryChange}
              onSaveToLibrary={sankeyLogic.handleSaveToLibrary}
              showSaveModal={sankeyLogic.showSaveModal}
              setShowSaveModal={sankeyLogic.setShowSaveModal}
              saveTitle={sankeyLogic.saveTitle}
              setSaveTitle={sankeyLogic.setSaveTitle}
              onConfirmSave={sankeyLogic.handleConfirmSave}
              editingTitle={editingSankeyTitle}
              setEditingTitle={setEditingSankeyTitle}
            />
            <SankeyCanvas
              data={sankeyLogic.data}
              containerRef={sankeyLogic.containerRef}
              zoom={sankeyLogic.zoom}
              setZoom={sankeyLogic.setZoom}
              selectedNodeId={sankeyLogic.selectedNodeId}
              onSelectNode={sankeyLogic.setSelectedNodeId}
              onUndo={sankeyLogic.undo}
              onRedo={sankeyLogic.redo}
              canUndo={sankeyLogic.canUndo}
              canRedo={sankeyLogic.canRedo}
              onEditTitle={() => { sankeyLogic.setSelectedNodeId(null); setEditingSankeyTitle(true); }}
            />
          </div>
        ) : activeTab === 'mindmap' ? (
          <div className="flex-1 flex gap-4 h-full min-h-0 overflow-hidden">
            <MindMapSidebar logic={mindmapLogic} />
            <MindMapCanvas logic={mindmapLogic} />
          </div>
        ) : activeTab === 'timeline' ? (
          <div className="flex-1 flex gap-4 h-full min-h-0 overflow-hidden">
            <TimelineSidebar
              userPrompt={timelineLogic.userPrompt}
              onUserPromptChange={timelineLogic.setUserPrompt}
              isGenerating={timelineLogic.isGenerating}
              onGenerate={timelineLogic.handleGenerate}
              onAddEvent={timelineLogic.addEvent}
              onDeleteEvent={timelineLogic.deleteEvent}
              onCreateEmpty={timelineLogic.handleCreateEmpty}
              data={timelineLogic.data}
              setData={timelineLogic.setData}
              onSaveToLibrary={timelineLogic.handleSaveToLibrary}
              activeEventId={timelineLogic.activeEventId}
              aiLanguage={timelineLogic.aiLanguage}
              onAiLanguageChange={timelineLogic.setAiLanguage}
              // @ts-ignore
              setActiveEventId={timelineLogic.setActiveEventId}
              savedTimelines={timelineLogic.savedTimelines}
              showLibrary={timelineLogic.showLibrary}
              setShowLibrary={timelineLogic.setShowLibrary}
              onLoadSaved={timelineLogic.handleLoadFromLibrary}
              onDeleteSaved={timelineLogic.handleDeleteFromLibrary}
              onRenameSaved={timelineLogic.handleRenameInLibrary}
              onCategoryChange={timelineLogic.handleCategoryChange}
              showSaveModal={timelineLogic.showSaveModal}
              setShowSaveModal={timelineLogic.setShowSaveModal}
              saveTitle={timelineLogic.saveTitle}
              setSaveTitle={timelineLogic.setSaveTitle}
              onConfirmSave={timelineLogic.handleConfirmSave}
              onExportPng={timelineLogic.handleExport}
              onUndo={timelineLogic.undo}
              onRedo={timelineLogic.redo}
              canUndo={timelineLogic.canUndo}
              canRedo={timelineLogic.canRedo}
            />
            <TimelineCanvas
              data={timelineLogic.data}
              activeEventId={timelineLogic.activeEventId}
              setActiveEventId={timelineLogic.setActiveEventId}
              onUpdateEvent={timelineLogic.updateEvent}
              onDeleteEvent={timelineLogic.deleteEvent}
              zoom={timelineLogic.zoom}
              setZoom={timelineLogic.setZoom}
              containerRef={timelineLogic.containerRef}
              onUndo={timelineLogic.undo}
              onRedo={timelineLogic.redo}
              canUndo={timelineLogic.canUndo}
              canRedo={timelineLogic.canRedo}
            />
          </div>
        ) : (
          <GenerativeView logic={generativeLogic} inputRef={inputRef} libraryRef={libraryRef} />
        )}
      </div>

      {/* Template Modal */}
      <TemplateModal
        showTemplateModal={templateManager.showTemplateModal}
        setShowTemplateModal={templateManager.setShowTemplateModal}
        presets={templateManager.presets}
        userTemplates={templateManager.userTemplates}
        onApplyTemplate={handleApplyTemplate}
        onDeleteTemplate={templateManager.deleteTemplate}
        onRenameTemplate={templateManager.renameTemplate}
        onSaveCurrentAsTemplate={handleSaveCurrentAsTemplate}
        showSaveModal={templateManager.showSaveTemplateModal}
        setShowSaveModal={templateManager.setShowSaveTemplateModal}
        templateName={templateManager.templateName}
        setTemplateName={templateManager.setTemplateName}
        onConfirmSave={handleConfirmSaveTemplate}
        module={templateModule}
      />

      {/* Floating Stencils Toggle */}
      <button
        onClick={() => setShowStencils(true)}
        className="fixed right-8 bottom-8 w-16 h-16 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:bg-indigo-600 transition-all active:scale-95 group z-[100] border-2 border-white/20"
        title="打开科学组件库"
      >
        <i className="fa-solid fa-layer-group text-xl group-hover:rotate-12 transition-transform"></i>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[8px] font-black">NEW</div>
      </button>

      {/* Scientific Stencils Drawer */}
      <ScientificStencils
        isOpen={showStencils}
        onClose={() => setShowStencils(false)}
      />
    </div>
  );
};

export default FigureCenter;