import React from 'react';
import { SummarySidebar } from './SummarySidebar';
import { SummaryPreview } from './SummaryPreview';
import { SummaryModals } from './SummaryModals';
import { useSummaryInfographic } from './useSummaryInfographic';
import { ACADEMIC_PALETTES } from './SummaryUtils';

/**
 * SummaryInfographic Component
 */
interface SummaryInfographicProps {
    logic: ReturnType<typeof useSummaryInfographic>;
}

/**
 * SummaryInfographic Component
 */
const SummaryInfographic: React.FC<SummaryInfographicProps> = ({ logic }) => {
    const {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        customTopic,
        setCustomTopic,
        useCustomTopic,
        setUseCustomTopic,
        activePaletteIdx,
        setActivePaletteIdx,
        autoRemoveBg,
        setAutoRemoveBg,
        infographicData,
        isGenerating,
        isGeneratingThumbnails,
        editingSegment,
        setEditingSegment,
        editingLayer,
        setEditingLayer,
        isEditingCore,
        setIsEditingCore,
        zoom,
        setZoom,
        pan,
        setPan,
        isPanning,
        fileInputRef,
        coreFileInputRef,
        containerRef,
        mouseMovedRef,
        showAddLayerModal,
        setShowAddLayerModal,
        newLayerName,
        setNewLayerName,
        showRenameLayerModal,
        setShowRenameLayerModal,
        tempLayerName,
        setTempLayerName,
        savedSummaries,
        showLibrary,
        setShowLibrary,
        showSaveModal,
        setShowSaveModal,
        saveTitle,
        setSaveTitle,
        activeTasks,
        canUndo,
        canRedo,
        handleUndo,
        handleRedo,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleWheel,
        handleGenerate,
        handleGenerateThumbnail,
        handleGenerateAllThumbnails,
        handleGenerateCoreThumbnail,
        handleRemoveBgManual,
        handleLayerUpdate,
        handleCoreUpdate,
        handleAddLayer,
        confirmAddLayer,
        handleRenameLayerTrigger,
        confirmRenameLayer,
        handleAddSegment,
        handleRemoveSegment,
        handleExport,
        handleAutoColor,
        handleSmartRandomColor,
        handleUploadCoreImage,
        handleUploadSegmentImage,
        handleLocalEditChange,
        handleSaveToLibrary,
        confirmSaveToLibrary,
        handleLoadSaved,
        handleDeleteSaved,
        handleSyncAllLayers,
        isSyncAllLayersEnabled,
        setIsSyncAllLayersEnabled,
        aiLanguage,
        setAiLanguage
    } = logic;

    return (
        <div className="flex flex-col lg:flex-row h-full gap-4">
            <SummarySidebar
                projects={projects}
                selectedProjectId={selectedProjectId}
                setSelectedProjectId={setSelectedProjectId}
                customTopic={customTopic}
                setCustomTopic={setCustomTopic}
                useCustomTopic={useCustomTopic}
                setUseCustomTopic={setUseCustomTopic}
                infographicData={infographicData}
                isGenerating={isGenerating}
                isGeneratingThumbnails={isGeneratingThumbnails}
                editingSegment={editingSegment}
                setEditingSegment={setEditingSegment}
                editingLayer={editingLayer}
                setEditingLayer={setEditingLayer}
                isEditingCore={isEditingCore}
                setIsEditingCore={setIsEditingCore}
                onCoreUpdate={handleCoreUpdate}
                onGenerate={handleGenerate}
                onGenerateAllThumbnails={handleGenerateAllThumbnails}
                onGenerateSingleThumbnail={() => {
                    if (editingSegment) {
                        handleGenerateThumbnail(editingSegment.layerId, editingSegment.segment.id, editingSegment.segment.imagePrompt);
                    }
                }}
                onGenerateCoreThumbnail={handleGenerateCoreThumbnail}
                onAutoColor={handleAutoColor}
                onSmartRandomColor={handleSmartRandomColor}
                activePaletteIdx={activePaletteIdx}
                setActivePaletteIdx={setActivePaletteIdx}
                academicPalettes={ACADEMIC_PALETTES}
                onUploadImage={handleUploadSegmentImage}
                onUploadCoreImage={handleUploadCoreImage}
                onLocalEditChange={handleLocalEditChange}
                onLayerUpdate={handleLayerUpdate}
                onAddLayer={handleAddLayer}
                onRenameLayer={handleRenameLayerTrigger}
                onAddSegment={handleAddSegment}
                onRemoveSegment={handleRemoveSegment}
                onExport={handleExport}
                onSyncAllLayers={handleSyncAllLayers}
                zoom={zoom}
                setZoom={setZoom}
                fileInputRef={fileInputRef}
                coreFileInputRef={coreFileInputRef}
                activeTasks={activeTasks}
                autoRemoveBg={autoRemoveBg}
                setAutoRemoveBg={setAutoRemoveBg}
                onRemoveBgManual={handleRemoveBgManual}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                isSyncAllLayersEnabled={isSyncAllLayersEnabled}
                setIsSyncAllLayersEnabled={setIsSyncAllLayersEnabled}
                aiLanguage={aiLanguage}
                onAiLanguageChange={setAiLanguage}
            />

            <SummaryPreview
                data={infographicData}
                isGenerating={isGenerating}
                zoom={zoom}
                setZoom={setZoom}
                pan={pan}
                setPan={setPan}
                isPanning={isPanning}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={() => { }}
                onTouchMove={() => { }}
                onSegmentClick={(lId, seg) => {
                    if (mouseMovedRef.current) return;
                    setEditingSegment({ layerId: lId, segment: seg });
                    setIsEditingCore(false);
                    setEditingLayer(null);
                }}
                onCoreClick={() => {
                    if (mouseMovedRef.current) return;
                    setIsEditingCore(true);
                    setEditingSegment(null);
                    setEditingLayer(null);
                }}
                containerRef={containerRef}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
            />

            <SummaryModals
                showAddLayer={showAddLayerModal}
                setShowAddLayer={setShowAddLayerModal}
                newLayerName={newLayerName}
                setNewLayerName={setNewLayerName}
                onConfirmAddLayer={confirmAddLayer}
                showRenameLayer={showRenameLayerModal}
                setShowRenameLayer={setShowRenameLayerModal}
                tempLayerName={tempLayerName}
                setTempLayerName={setTempLayerName}
                onConfirmRenameLayer={confirmRenameLayer}
                showLibrary={showLibrary}
                setShowLibrary={setShowLibrary}
                savedSummaries={savedSummaries}
                onLoadSaved={handleLoadSaved}
                onDeleteSaved={handleDeleteSaved}
                onRenameSaved={logic.handleRenameSaved}
                showSave={showSaveModal}
                setShowSave={setShowSaveModal}
                saveTitle={saveTitle}
                setSaveTitle={setSaveTitle}
                onSaveConfirm={confirmSaveToLibrary}
            />

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleUploadSegmentImage} />
            <input type="file" ref={coreFileInputRef} className="hidden" accept="image/*" onChange={handleUploadCoreImage} />
        </div>
    );
};

export default SummaryInfographic;
