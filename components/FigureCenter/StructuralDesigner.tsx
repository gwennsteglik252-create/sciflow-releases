
import React, { useState, useEffect } from 'react';
import { useStructuralDesigner } from '../../hooks/useStructuralDesigner';
import { StructureSidebar } from './Structure/StructureSidebar';
import { StructureCanvas } from './Structure/StructureCanvas';
import { StructureModals } from './Structure/StructureModals';
import SafeModal from '../SafeModal';
import { ScientificTheme, SCIENTIFIC_THEMES } from '../../ScientificThemes';

interface StructuralDesignerProps {
   logic: ReturnType<typeof useStructuralDesigner>;
}

const StructuralDesigner: React.FC<StructuralDesignerProps> = ({ logic }) => {
   const {
      template, data, positions,
      undo, redo, canUndo, canRedo,
      editingId, setEditingId,
      editingGroupId, setEditingGroupId,
      editingConnectionIndex, setEditingConnectionIndex,
      isConnectMode, setIsConnectMode,
      connectSourceId, setConnectSourceId,
      scale, setScale, pan, setPan,
      dragNodeId,
      userPrompt, setUserPrompt,
      isGenerating,
      isIterationMode, setIsIterationMode,
      savedDiagrams, showLibrary, setShowLibrary,
      showSaveModal, setShowSaveModal,
      saveTitle, setSaveTitle,
      containerRef, scrollContainerRef,
      handleTemplateChange, handleNodeUpdate, handleNodeDelete,
      handleGroupUpdate, handleGroupDelete, handleConnectionUpdate, handleConnectionLabelUpdate, handleConnectionDelete,
      handleAddGroup, handleAddNode, handleNodeClick,
      handleAutoLayout,
      handleSaveToLibrary, handleConfirmSave, handleLoadFromLibrary, handleDeleteFromLibrary,
      handleWheel, handleAiGenerate,
      onNodeMouseDown, handleCanvasMouseDown, handleBackgroundClick,
      confirmModal, setConfirmModal,
      handleExport, handleSvgExport, handleApplyGlobalPalette,
      handleMoveNode, handleMoveGroup,
      guides,
      spacingConfig, handleSpacingChange,
      handleSmartLabelLayout
   } = logic;

   const [activeTheme, setActiveTheme] = useState<ScientificTheme>(SCIENTIFIC_THEMES.clean);
   const [editingGroupConfigId, setEditingGroupConfigId] = useState<string | null>(null);

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         const target = e.target as HTMLElement;
         if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
         }

         const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
         const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

         if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
            if (e.shiftKey) {
               if (canRedo) redo();
            } else {
               if (canUndo) undo();
            }
            e.preventDefault();
         } else if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
            if (canRedo) redo();
            e.preventDefault();
         }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [undo, redo, canUndo, canRedo]);

   return (
      <div className="flex h-full flex-col lg:flex-row gap-4 overflow-hidden relative">
         <StructureSidebar
            template={template}
            onTemplateChange={handleTemplateChange}
            userPrompt={userPrompt}
            onUserPromptChange={setUserPrompt}
            isGenerating={isGenerating}
            onAiGenerate={handleAiGenerate}
            isIterationMode={isIterationMode}
            setIsIterationMode={setIsIterationMode}
            aiLanguage={logic.aiLanguage}
            onAiLanguageChange={logic.setAiLanguage}
            onAddGroup={handleAddGroup}
            onAddNode={handleAddNode}
            isConnectMode={isConnectMode}
            setIsConnectMode={setIsConnectMode}
            connectSourceId={connectSourceId}
            setConnectSourceId={setConnectSourceId}
            onAutoLayout={handleAutoLayout}
            onExportPng={handleExport}
            onExportSvg={handleSvgExport}
            activeTheme={activeTheme}
            onThemeChange={setActiveTheme}
            onApplyGlobalPalette={handleApplyGlobalPalette}

            editingId={editingId}
            setEditingId={setEditingId}
            editingGroupId={editingGroupId}
            setEditingGroupId={setEditingGroupId}
            editingConnectionIndex={editingConnectionIndex}
            setEditingConnectionIndex={setEditingConnectionIndex}
            data={data}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            onGroupUpdate={handleGroupUpdate}
            onGroupDelete={handleGroupDelete}
            onConnectionUpdate={handleConnectionUpdate}
            onConnectionDelete={handleConnectionDelete}
            onSyncNodeToGroup={logic.handleSyncNodeToGroup}
            onSyncTypographyGlobal={logic.handleSyncTypographyGlobal}
            onSyncGroupConfig={logic.handleSyncGroupConfig}
            editingGroupConfigId={editingGroupConfigId}
            setEditingGroupConfigId={setEditingGroupConfigId}
            onMoveNode={handleMoveNode}
            onMoveGroup={handleMoveGroup}
            spacingConfig={spacingConfig}
            onSpacingChange={handleSpacingChange}
            onSmartLabelLayout={handleSmartLabelLayout}
         />


         <StructureCanvas
            data={data}
            positions={positions}
            scale={scale}
            setScale={setScale}
            pan={pan}
            setPan={setPan}
            containerRef={containerRef}
            scrollContainerRef={scrollContainerRef}
            onWheel={handleWheel}
            onBackgroundClick={handleBackgroundClick}
            onCanvasMouseDown={handleCanvasMouseDown}
            editingGroupId={editingGroupId}
            setEditingGroupId={setEditingGroupId}
            handleGroupUpdate={handleGroupUpdate}
            handleGroupDelete={handleGroupDelete}
            onGroupTitleUpdate={(id, title) => handleGroupUpdate(id, { title })}
            editingConnectionIndex={editingConnectionIndex}
            setEditingConnectionIndex={setEditingConnectionIndex}
            onConnectionLabelUpdate={handleConnectionLabelUpdate}
            onConnectionUpdate={handleConnectionUpdate}
            onConnectionDelete={handleConnectionDelete}
            dragNodeId={dragNodeId}
            editingId={editingId}
            connectSourceId={connectSourceId}
            onNodeMouseDown={onNodeMouseDown}
            onNodeClick={handleNodeClick}
            setEditingId={setEditingId}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            onAddNode={handleAddNode}
            activeTheme={activeTheme}
            guides={guides}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
         />


         <StructureModals
            showLibrary={showLibrary}
            setShowLibrary={setShowLibrary}
            savedDiagrams={savedDiagrams}
            onLoad={handleLoadFromLibrary}
            onDelete={handleDeleteFromLibrary}
            onRename={logic.handleRenameInLibrary}
            showSaveModal={showSaveModal}
            setShowSaveModal={setShowSaveModal}
            saveTitle={saveTitle}
            setSaveTitle={setSaveTitle}
            onSave={handleConfirmSave}
         />

         <SafeModal config={confirmModal} onClose={() => setConfirmModal(null)} />
      </div>
   );
};

export default StructuralDesigner;
