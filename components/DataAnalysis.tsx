import React from 'react';
import { ResearchProject, AppView } from '../types';
import { useProjectContext } from '../context/ProjectContext';
import ElectrochemicalEngine from './Engines/ElectrochemicalEngine';
import ChartConfigPanel from './DataAnalysis/ChartConfigPanel';

import DataChart from './DataAnalysis/DataChart';
import AnalysisAssociationModal from './DataAnalysis/AnalysisAssociationModal';
import TemplateSaveModal from './DataAnalysis/TemplateSaveModal';
import AxisSettingsPanel from './DataAnalysis/AxisSettingsPanel';
import SeriesSettingsPanel from './DataAnalysis/SeriesSettingsPanel';
import DataAnalysisHeader from './DataAnalysis/DataAnalysisHeader';
import StyleMimicView from './DataAnalysis/StyleMimic/StyleMimicView';
import TemplateGalleryModal from './DataAnalysis/Modals/TemplateGalleryModal';
import ChartLibraryModal from './DataAnalysis/Modals/ChartLibraryModal';
import { useDataAnalysisLogic } from '../hooks/useDataAnalysisLogic';

interface DataAnalysisProps {
  projects: ResearchProject[];
  onUpdateProject: (updated: ResearchProject) => void;
  navigate: (view: AppView, projectId?: string) => void;
}

const DataAnalysis: React.FC<DataAnalysisProps> = ({ projects, onUpdateProject, navigate }) => {
  const { setAiStatus, activeTheme } = useProjectContext();
  const isLightMode = activeTheme.type === 'light';

  const { state, refs, actions } = useDataAnalysisLogic(projects, onUpdateProject, setAiStatus);

  const documentColors = React.useMemo(() => {
    const colors = new Set<string>();
    state.seriesList.forEach(s => {
      if (s.color) colors.add(s.color.toLowerCase());
      if (s.pointColor) colors.add(s.pointColor.toLowerCase());
      if ((s as any).errorBarColor) colors.add((s as any).errorBarColor.toLowerCase());
    });
    return Array.from(colors);
  }, [state.seriesList]);

  const currentSeriesForSettings = state.seriesList.find(s => s.id === state.seriesSettingsId) || null;

  // Resolve lag caused by ProjectContext global re-renders
  const actionsRef = React.useRef(actions);
  React.useEffect(() => { actionsRef.current = actions; }, [actions]);

  const stableActions = React.useMemo(() => {
    const bound: any = {};
    Object.keys(actionsRef.current).forEach(key => {
      bound[key] = (...args: any[]) => (actionsRef.current as any)[key](...args);
    });
    return bound;
  }, []);

  const memoizedChart = React.useMemo(() => (
    <DataChart
      chartContainerRef={refs.chartContainerRef}
      seriesList={state.seriesList}
      chartType={state.chartType}
      mainColor={state.mainColor}
      strokeWidth={state.strokeWidth}
      fontSize={state.fontSize}
      axisLabelFontSize={state.axisLabelFontSize}
      pointShape={state.pointShape}
      pointSize={state.pointSize}
      xAxisLabel={state.xAxisLabel}
      setXAxisLabel={stableActions.setXAxisLabel}
      yAxisLabel={state.yAxisLabel}
      setYAxisLabel={stableActions.setYAxisLabel}
      chartTitle={state.chartTitle}
      setChartTitle={stableActions.setChartTitle}
      annotations={state.annotations}
      activeTool={state.activeTool}
      onAddAnnotation={stableActions.addAnnotation}
      onUpdateAnnotation={stableActions.updateAnnotation}
      onRemoveAnnotation={stableActions.removeAnnotation}
      onSetActiveTool={stableActions.setActiveTool}
      legendPos={state.legendPos}
      setLegendPos={stableActions.setLegendPos}
      editingSeriesId={state.seriesSettingsId}
      setEditingSeriesId={stableActions.setSeriesSettingsId}
      updateSeries={stableActions.updateSeries}
      aspectRatio={state.aspectRatio}
      xLabelPos={state.xLabelPos}
      setXLabelPos={stableActions.setXLabelPos}
      yLabelPos={state.yLabelPos}
      setYLabelPos={stableActions.setYLabelPos}
      titlePos={state.titlePos}
      setTitlePos={stableActions.setTitlePos}
      xDomain={state.xDomain}
      yDomain={state.yDomain}
      xScale={state.xScale}
      yScale={state.yScale}
      yZoom={state.yZoom}
      onYZoomChange={stableActions.setYZoom}
      setGridX={stableActions.setGridX}
      setGridY={stableActions.setGridY}
      gridX={state.gridX}
      gridY={state.gridY}
      gridLineWidth={state.gridLineWidth}
      axisLineWidth={state.axisLineWidth}
      axisColor={state.axisColor}
      axisBox={state.axisBox}
      tickFontSize={state.tickFontSize}
      tickSize={state.tickSize}
      tickWidth={state.tickWidth}
      xTickCount={state.xTickCount}
      yTickCount={state.yTickCount}
      xAxisDivision={state.xAxisDivision}
      yAxisDivision={state.yAxisDivision}

      labelFontFamily={state.labelFontFamily}
      labelFontWeight={state.labelFontWeight}
      labelFontStyle={state.labelFontStyle}

      titleFontFamily={state.titleFontFamily}
      titleFontWeight={state.titleFontWeight}
      titleFontStyle={state.titleFontStyle}

      tickFontFamily={state.tickFontFamily}
      tickFontWeight={state.tickFontWeight}
      tickFontStyle={state.tickFontStyle}

      legendFontFamily={state.legendFontFamily}
      legendFontWeight={state.legendFontWeight}
      legendFontStyle={state.legendFontStyle}
      legendFontSize={state.legendFontSize}

      legendBorderVisible={state.legendBorderVisible}
      legendBorderColor={state.legendBorderColor}
      legendBorderWidth={state.legendBorderWidth}

      showXTicks={state.showXTicks}
      showYTicks={state.showYTicks}
      showMirroredTicks={state.showMirroredTicks}

      onOpenAxisSettings={stableActions.openAxisSettings}
    />
  ), [
    refs.chartContainerRef,
    state.seriesList, state.chartType, state.mainColor, state.strokeWidth, state.fontSize, state.axisLabelFontSize, state.pointShape, state.pointSize, state.xAxisLabel, state.yAxisLabel, state.chartTitle, state.annotations, state.activeTool, state.legendPos, state.seriesSettingsId, state.aspectRatio, state.xLabelPos, state.yLabelPos, state.titlePos, state.xDomain, state.yDomain, state.xScale, state.yScale, state.yZoom, state.gridX, state.gridY, state.gridLineWidth, state.axisLineWidth, state.axisColor, state.axisBox, state.tickFontSize, state.tickSize, state.tickWidth, state.xTickCount, state.yTickCount, state.xAxisDivision, state.yAxisDivision, state.labelFontFamily, state.labelFontWeight, state.labelFontStyle, state.titleFontFamily, state.titleFontWeight, state.titleFontStyle, state.tickFontFamily, state.tickFontWeight, state.tickFontStyle, state.legendFontFamily, state.legendFontWeight, state.legendFontStyle, state.legendFontSize, state.legendBorderVisible, state.legendBorderColor, state.legendBorderWidth, state.showXTicks, state.showYTicks, state.showMirroredTicks
  ]);

  return (
    <div className="lab-container h-full flex flex-col gap-4 animate-reveal px-2 overflow-hidden relative">
      <DataAnalysisHeader
        activeTab={state.activeTab}
        onTabChange={actions.setActiveTab}
        onOpenEcoEngine={() => actions.setShowEcoEngine(true)}
        onOpenAssociate={() => actions.setShowAssociateModal(true)}
        onOpenChartLibrary={() => actions.setShowChartLibraryModal(true)}
        onExport={actions.exportChart}
        isExporting={state.isExporting}
        isLightMode={isLightMode}
      />

      {state.activeTab === 'chart' ? (
        <div className="lab-main-grid flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden pb-4">
          <div className="lab-config-panel col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 custom-scrollbar">
            {state.leftPanelMode === 'basic' ? (
              <ChartConfigPanel
                fileInputRef={refs.fileInputRef} handleFileUpload={actions.handleFileUpload}
                seriesList={state.seriesList} updateSeries={actions.updateSeries} removeSeries={actions.removeSeries}
                setSeriesSettingsId={actions.setSeriesSettingsId}
                titleInputRef={refs.titleInputRef} chartTitle={state.chartTitle} setChartTitle={actions.setChartTitle}
                chartType={state.chartType} setChartType={actions.setChartType}
                mainColor={state.mainColor} setMainColor={actions.setMainColor}
                strokeWidth={state.strokeWidth} setStrokeWidth={actions.setStrokeWidth}
                fontSize={state.fontSize} setFontSize={actions.setFontSize}
                pointShape={state.pointShape} setPointShape={actions.setPointShape}
                pointSize={state.pointSize} setPointSize={actions.setPointSize}
                xLabelInputRef={refs.xLabelInputRef} xAxisLabel={state.xAxisLabel} setXAxisLabel={actions.setXAxisLabel}
                yLabelInputRef={refs.yLabelInputRef} yAxisLabel={state.yAxisLabel} setYAxisLabel={actions.setYAxisLabel}
                activeScientificTheme={state.activeScientificTheme} applyScientificTheme={actions.applyScientificTheme}
                onOpenSaveTemplate={() => actions.setShowSaveTemplateModal(true)}
                onOpenAxisConfig={() => actions.setLeftPanelMode('axis')}
                aspectRatio={state.aspectRatio} setAspectRatio={actions.setAspectRatio}
                showTemplateList={state.showTemplateList}
                setShowTemplateList={actions.setShowTemplateList}
                userTemplates={state.userTemplates}
                applyTemplate={stableActions.applyTemplate}
                onDeleteTemplate={(id, e) => {
                  e.stopPropagation();
                  stableActions.deleteUserTemplate(id);
                }}
                activeTool={state.activeTool}
                onSetActiveTool={actions.setActiveTool}
                templateSearchQuery={state.templateSearchQuery}
                setTemplateSearchQuery={actions.setTemplateSearchQuery}
                handleDiscoverTemplate={actions.handleDiscoverTemplate}
                isDiscoveringTemplate={state.isDiscoveringTemplate}
                onDiscoverFromImage={actions.handleDiscoverTemplateFromImage}
                onOpenGallery={() => actions.setShowGalleryModal(true)}
              />
            ) : state.leftPanelMode === 'axis' ? (
              <AxisSettingsPanel
                onClose={() => actions.setLeftPanelMode('basic')}
                onSwitchToSeries={() => {
                  if (!state.seriesSettingsId && state.seriesList.length > 0) {
                    actions.setSeriesSettingsId(state.seriesList[0].id);
                  } else {
                    actions.setLeftPanelMode('series');
                  }
                }}
                xDomain={state.xDomain} setXDomain={actions.setXDomain}
                yDomain={state.yDomain} setYDomain={actions.setYDomain}
                xScale={state.xScale} setXScale={actions.setXScale}
                yScale={state.yScale} setYScale={actions.setYScale}
                gridX={state.gridX} setGridX={actions.setGridX}
                gridY={state.gridY} setGridY={actions.setGridY}
                gridLineWidth={state.gridLineWidth} setGridLineWidth={actions.setGridLineWidth}
                axisLineWidth={state.axisLineWidth} setAxisLineWidth={actions.setAxisLineWidth}
                axisColor={state.axisColor} setAxisColor={actions.setAxisColor}
                axisBox={state.axisBox} setAxisBox={actions.setAxisBox}
                tickFontSize={state.tickFontSize} setTickFontSize={actions.setTickFontSize}
                tickSize={state.tickSize} setTickSize={actions.setTickSize}
                tickWidth={state.tickWidth} setTickWidth={actions.setTickWidth}
                axisLabelFontSize={state.axisLabelFontSize} setAxisLabelFontSize={actions.setAxisLabelFontSize}
                xTickCount={state.xTickCount} setXTickCount={actions.setXTickCount}
                yTickCount={state.yTickCount} setYTickCount={actions.setYTickCount}
                xAxisDivision={state.xAxisDivision} setXAxisDivision={actions.setXAxisDivision}
                yAxisDivision={state.yAxisDivision} setYAxisDivision={actions.setYAxisDivision}
                computedAutoDomains={state.computedAutoDomains}

                labelFontFamily={state.labelFontFamily} setLabelFontFamily={actions.setLabelFontFamily}
                labelFontWeight={state.labelFontWeight} setLabelFontWeight={actions.setLabelFontWeight}
                labelFontStyle={state.labelFontStyle} setLabelFontStyle={actions.setLabelFontStyle}

                titleFontFamily={state.titleFontFamily} setTitleFontFamily={actions.setTitleFontFamily}
                titleFontWeight={state.titleFontWeight} setTitleFontWeight={actions.setTitleFontWeight}
                titleFontStyle={state.titleFontStyle} setTitleFontStyle={actions.setTitleFontStyle}

                tickFontFamily={state.tickFontFamily} setTickFontFamily={actions.setTickFontFamily}
                tickFontWeight={state.tickFontWeight} setTickFontWeight={actions.setTickFontWeight}
                tickFontStyle={state.tickFontStyle} setTickFontStyle={actions.setTickFontStyle}

                legendFontFamily={state.legendFontFamily} setLegendFontFamily={actions.setLegendFontFamily}
                legendFontWeight={state.legendFontWeight} setLegendFontWeight={actions.setLegendFontWeight}
                legendFontStyle={state.legendFontStyle} setLegendFontStyle={actions.setLegendFontStyle}
                legendFontSize={state.legendFontSize} setLegendFontSize={actions.setLegendFontSize}

                legendBorderVisible={state.legendBorderVisible}
                setLegendBorderVisible={actions.setLegendBorderVisible}
                legendBorderColor={state.legendBorderColor}
                setLegendBorderColor={actions.setLegendBorderColor}
                legendBorderWidth={state.legendBorderWidth}
                setLegendBorderWidth={actions.setLegendBorderWidth}

                activeFontTab={state.activeFontTab}
                setActiveFontTab={actions.setActiveFontTab}

                showXTicks={state.showXTicks} setShowXTicks={actions.setShowXTicks}
                showYTicks={state.showYTicks} setShowYTicks={actions.setShowYTicks}
                autoFitDomains={actions.autoFitDomains}
                showMirroredTicks={state.showMirroredTicks}
                setShowMirroredTicks={actions.setShowMirroredTicks}
                documentColors={documentColors}
              />
            ) : (
              <SeriesSettingsPanel
                series={currentSeriesForSettings}
                seriesList={state.seriesList}
                chartType={state.chartType}
                onClose={() => actions.setLeftPanelMode('basic')}
                onSwitchToAxis={() => actions.setLeftPanelMode('axis')}
                onSelectSeries={actions.setSeriesSettingsId}
                onApplyPalette={actions.applyPalette}
                onUpdate={(updates, applyToAll) => {
                  if (state.seriesSettingsId) {
                    if (applyToAll) {
                      actions.updateAllSeries(updates);
                    } else {
                      actions.updateSeries(state.seriesSettingsId, updates);
                    }
                  }
                }}
              />
            )}
          </div>

          <div className="lab-chart-area col-span-12 lg:col-span-8 bg-white rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col relative">
            {memoizedChart}
          </div>
        </div>
      ) : (
        <StyleMimicView />
      )}

      <TemplateGalleryModal
        show={state.showGalleryModal}
        onClose={() => actions.setShowGalleryModal(false)}
        userTemplates={state.userTemplates}
        onSelectTemplate={(tpl) => {
          stableActions.applyTemplate(tpl);
          actions.setShowGalleryModal(false);
        }}
        onApplyAndImport={(tpl) => {
          stableActions.applyTemplate(tpl);
          refs.fileInputRef.current?.click();
          actions.setShowGalleryModal(false);
        }}
        templateSearchQuery={state.templateSearchQuery}
        setTemplateSearchQuery={actions.setTemplateSearchQuery}
        handleDiscoverTemplate={actions.handleDiscoverTemplate}
        isDiscoveringTemplate={state.isDiscoveringTemplate}
        onDiscoverFromImage={actions.handleDiscoverTemplateFromImage}
        onDeleteTemplate={stableActions.deleteUserTemplate}
        onUpdateTemplate={stableActions.updateUserTemplate}
      />

      <AnalysisAssociationModal
        show={state.showAssociateModal}
        onClose={() => actions.setShowAssociateModal(false)}
        projects={projects}
        onConfirm={(updated) => { onUpdateProject(updated); actions.setShowAssociateModal(false); }}
        chartTitle={state.chartTitle}
        chartType={state.chartType}
        mainColor={state.mainColor}
        fontSize={state.fontSize}
        chartContainerRef={refs.chartContainerRef}
      />

      <TemplateSaveModal
        show={state.showSaveTemplateModal}
        onClose={() => actions.setShowSaveTemplateModal(false)}
        onSave={async (name) => {
          await actions.handleSaveCurrentTemplate(name);
          actions.setShowSaveTemplateModal(false);
        }}
        defaultName={state.chartTitle}
      />

      <ElectrochemicalEngine
        show={state.showEcoEngine}
        onClose={() => actions.setShowEcoEngine(false)}
        projects={projects}
        onSave={actions.handleSaveDeepAnalysis}
      />

      <ChartLibraryModal
        show={state.showChartLibraryModal}
        onClose={() => actions.setShowChartLibraryModal(false)}
        savedCharts={Array.isArray(state.savedCharts) ? state.savedCharts : []}
        chartFolders={Array.isArray(state.chartFolders) ? state.chartFolders : []}
        onLoadChart={actions.loadChartFromLibrary}
        onDeleteChart={actions.deleteChartFromLibrary}
        onSaveCurrent={actions.saveChartToLibrary}
        onCreateFolder={actions.createChartFolder}
        onDeleteFolder={actions.deleteChartFolder}
        onMoveChartToFolder={actions.moveChartToFolder}
      />
    </div>
  );
};

export default DataAnalysis;