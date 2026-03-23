import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ResearchProject, AppView } from '../types';
import { useProjectContext } from '../context/ProjectContext';
import ElectrochemicalEngine from './Engines/ElectrochemicalEngine';
import ChartConfigPanel from './DataAnalysis/ChartConfigPanel';

import DataChart from './DataAnalysis/DataChart';
import SubplotLayout from './DataAnalysis/SubplotLayout';
import SubplotLayoutSelector from './DataAnalysis/SubplotLayoutSelector';
import DataSpreadsheet from './DataAnalysis/DataSpreadsheet';
import DataProcessingToolbar from './DataAnalysis/DataProcessingToolbar';
import CurveFittingPanel from './DataAnalysis/CurveFittingPanel';
import StatsPanel from './DataAnalysis/StatsPanel';
import PeakFinderPanel from './DataAnalysis/PeakFinderPanel';
import DataClipTool from './DataAnalysis/DataClipTool';
import WaterfallTool from './DataAnalysis/WaterfallTool';
import DualAxisTool from './DataAnalysis/DualAxisTool';
import ErrorBandTool from './DataAnalysis/ErrorBandTool';
import PolarChartPanel from './DataAnalysis/PolarChartPanel';
import HypothesisTestPanel from './DataAnalysis/HypothesisTestPanel';
import FFTPanel from './DataAnalysis/FFTPanel';
import DeconvolutionPanel from './DataAnalysis/DeconvolutionPanel';
import AIFitAdvisor from './DataAnalysis/AIFitAdvisor';
import BatchMacroTool from './DataAnalysis/BatchMacroTool';
import PCAPanel from './DataAnalysis/PCAPanel';
import CorrelationHeatmap from './DataAnalysis/CorrelationHeatmap';
import TSNEPanel from './DataAnalysis/TSNEPanel';
import AutoReportGenerator from './DataAnalysis/AutoReportGenerator';
import ToolbarGroupMenu from './DataAnalysis/ToolbarGroupMenu';
import ExportPanel from './DataAnalysis/ExportPanel';
import AnalysisAssociationModal from './DataAnalysis/AnalysisAssociationModal';
import TemplateSaveModal from './DataAnalysis/TemplateSaveModal';
import AxisSettingsPanel from './DataAnalysis/AxisSettingsPanel';
import SeriesSettingsPanel from './DataAnalysis/SeriesSettingsPanel';
import SubplotSeriesSelector from './DataAnalysis/SubplotSeriesSelector';
import DataAnalysisHeader from './DataAnalysis/DataAnalysisHeader';
import StyleMimicView from './DataAnalysis/StyleMimic/StyleMimicView';
import TemplateGalleryModal from './DataAnalysis/Modals/TemplateGalleryModal';
import ChartLibraryModal from './DataAnalysis/Modals/ChartLibraryModal';
import { useDataAnalysisLogic } from '../hooks/useDataAnalysisLogic';
import ProjectExplorer from './DataAnalysis/ProjectExplorer';
import WorkspaceTabs from './DataAnalysis/WorkspaceTabs';
import { useWorkspaceLogic } from '../hooks/useWorkspaceLogic';
import { parseFileToSpreadsheet } from '../utils/parseFileToSpreadsheet';
import WorkspaceSaveModal from './DataAnalysis/Modals/WorkspaceSaveModal';

interface DataAnalysisProps {
  projects: ResearchProject[];
  onUpdateProject: (updated: ResearchProject) => void;
  navigate: (view: AppView, projectId?: string) => void;
}

const DataAnalysis: React.FC<DataAnalysisProps> = ({ projects, onUpdateProject, navigate }) => {
  const { setAiStatus, activeTheme } = useProjectContext();
  const isLightMode = activeTheme.type === 'light';

  // ── 工作区逻辑 ──
  const ws = useWorkspaceLogic();
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [showSaveWorkspaceModal, setShowSaveWorkspaceModal] = useState(false);
  const isWorkbookActive = ws.activeItem.type === 'workbook';

  // ── 删除确认弹窗 ──
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const handleRequestRemove = React.useCallback((id: string) => {
    const item = [...ws.workspace.workbooks, ...ws.workspace.graphs].find(x => x.id === id);
    if (item) setConfirmDelete({ id: item.id, name: item.name });
  }, [ws.workspace]);
  const handleConfirmRemove = React.useCallback(() => {
    if (confirmDelete) {
      ws.removeItem(confirmDelete.id);
      setConfirmDelete(null);
    }
  }, [confirmDelete, ws]);

  // ── 统一文件导入：支持追加模式 ──
  const unifiedFileUpload = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const newData = await parseFileToSpreadsheet(file);
      const activeWb = ws.workspace.workbooks[0];
      if (!activeWb) return;

      // 提取文件名（去掉扩展名）作为列标识
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const taggedColumns = newData.columns.map((c: any) => ({
        ...c,
        longName: c.longName ? `[${baseName}] ${c.longName}` : `[${baseName}] ${c.name}`,
      }));

      const existingSpreadsheet = (activeWb as any).spreadsheet as any;
      const existingRows: string[][] = existingSpreadsheet?.rows ?? [];
      const existingCols: any[] = existingSpreadsheet?.columns ?? [];
      const hasData = existingRows.some((r: string[]) => r.some(cell => cell.trim() !== ''));

      if (!hasData) {
        // 空表格 → 直接填入（带文件名标签）
        ws.updateWorkbook(activeWb.id, { spreadsheet: { ...newData, columns: taggedColumns } });
      } else {
        // 已有数据 → 追加新列到右侧
        const existingColCount = existingCols.length;
        const { getColumnLetter } = await import('../types/spreadsheet');
        const appendedCols = taggedColumns.map((c: any, ci: number) => ({
          ...c,
          id: `col_append_${Date.now()}_${ci}`,
          name: getColumnLetter(existingColCount + ci),
        }));
        const mergedColumns = [...existingCols, ...appendedCols];
        const maxRowCount = Math.max(existingRows.length, newData.rows.length);
        const mergedRows: string[][] = [];
        for (let ri = 0; ri < maxRowCount; ri++) {
          const eRow = existingRows[ri] || new Array(existingColCount).fill('');
          const padded = eRow.length < existingColCount
            ? [...eRow, ...new Array(existingColCount - eRow.length).fill('')]
            : eRow;
          const nRow = newData.rows[ri] || new Array(newData.columns.length).fill('');
          mergedRows.push([...padded, ...nRow]);
        }
        ws.updateWorkbook(activeWb.id, {
          spreadsheet: {
            columns: mergedColumns,
            rows: mergedRows,
            maskedRows: existingSpreadsheet?.maskedRows ?? [],
          },
        });
      }
      ws.setActiveItem(activeWb.id);
    } catch (err) {
      console.error('导入失败:', err);
    }
    e.target.value = '';
  }, [ws]);

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

  // ── 全局快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // 判断是否聚焦在文本编辑区域
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isEditing = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable;

      const key = e.key.toLowerCase();

      // ⌘Z / Ctrl+Z → 撤销（不在编辑区域时）
      if (key === 'z' && !e.shiftKey && !isEditing) {
        e.preventDefault();
        actions.handleUndo();
        return;
      }
      // ⌘⇧Z / Ctrl+Shift+Z → 重做（不在编辑区域时）
      if (key === 'z' && e.shiftKey && !isEditing) {
        e.preventDefault();
        actions.handleRedo();
        return;
      }
      // ⌘S / Ctrl+S → 保存
      if (key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (state.currentSavedChartId) {
          actions.overwriteCurrentChart();
        } else {
          setShowSaveWorkspaceModal(true);
        }
        return;
      }
      // ⌘⇧S / Ctrl+Shift+S → 另存为
      if (key === 's' && e.shiftKey) {
        e.preventDefault();
        setShowSaveWorkspaceModal(true);
        return;
      }
      // ⌘E / Ctrl+E → 导出
      if (key === 'e' && !e.shiftKey) {
        e.preventDefault();
        actions.exportChart();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions, state.currentSavedChartId]);

  // ── 数据选择器操作回调 ──
  const handleExtractSelection = React.useCallback((xMin: number, xMax: number) => {
    const newSeries = state.seriesList.filter(s => s.visible !== false).map(s => {
      const filtered = s.data.filter((d: { name: string; value: number }) => {
        const x = parseFloat(d.name);
        return !isNaN(x) && x >= xMin && x <= xMax;
      });
      if (filtered.length === 0) return null;
      return { ...s, id: Date.now().toString() + s.id.slice(-4), name: `${s.name} (选区)`, data: filtered };
    }).filter(Boolean) as any[];
    if (newSeries.length > 0) {
      actions.setSeriesList((prev: any[]) => [...prev, ...newSeries]);
    }
  }, [state.seriesList, actions]);

  const handleClipSelection = React.useCallback((xMin: number, xMax: number) => {
    actions.setSeriesList((prev: any[]) => prev.map((s: any) => ({
      ...s,
      data: s.data.filter((d: any) => {
        const x = parseFloat(d.name);
        return !isNaN(x) && x >= xMin && x <= xMax;
      })
    })));
  }, [actions]);

  const handleDeleteSelection = React.useCallback((xMin: number, xMax: number) => {
    actions.setSeriesList((prev: any[]) => prev.map((s: any) => ({
      ...s,
      data: s.data.filter((d: any) => {
        const x = parseFloat(d.name);
        return isNaN(x) || x < xMin || x > xMax;
      })
    })));
  }, [actions]);

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
      setXDomain={stableActions.setXDomain}
      setYDomain={stableActions.setYDomain}
      autoFitDomains={stableActions.autoFitDomains}
      spreadsheet={(ws.workspace.workbooks[0] as any)?.spreadsheet}
      rightYAxisLabel={state.rightYAxisLabel}
      rightYDomain={state.rightYDomain}
      rightYScale={state.rightYScale}
      rightYTickCount={state.rightYTickCount}
      rightYLabelPos={state.rightYLabelPos}
      setRightYLabelPos={actions.setRightYLabelPos}
      rightYAxisDivision={state.rightYAxisDivision}
      rightYAxisColor={state.rightYAxisColor}
      onExtractSelection={handleExtractSelection}
      onClipSelection={handleClipSelection}
      onDeleteSelection={handleDeleteSelection}
    />
  ), [
    refs.chartContainerRef,
    state.seriesList, state.chartType, state.mainColor, state.strokeWidth, state.fontSize, state.axisLabelFontSize, state.pointShape, state.pointSize, state.xAxisLabel, state.yAxisLabel, state.chartTitle, state.annotations, state.activeTool, state.legendPos, state.seriesSettingsId, state.aspectRatio, state.xLabelPos, state.yLabelPos, state.titlePos, state.xDomain, state.yDomain, state.xScale, state.yScale, state.yZoom, state.gridX, state.gridY, state.gridLineWidth, state.axisLineWidth, state.axisColor, state.axisBox, state.tickFontSize, state.tickSize, state.tickWidth, state.xTickCount, state.yTickCount, state.xAxisDivision, state.yAxisDivision, state.labelFontFamily, state.labelFontWeight, state.labelFontStyle, state.titleFontFamily, state.titleFontWeight, state.titleFontStyle, state.tickFontFamily, state.tickFontWeight, state.tickFontStyle, state.legendFontFamily, state.legendFontWeight, state.legendFontStyle, state.legendFontSize, state.legendBorderVisible, state.legendBorderColor, state.legendBorderWidth, state.showXTicks, state.showYTicks, state.showMirroredTicks, ws.workspace.workbooks, state.rightYAxisLabel, state.rightYDomain, state.rightYScale, state.rightYTickCount, state.rightYLabelPos, state.rightYAxisDivision, state.rightYAxisColor
  ]);

  return (
    <div className="lab-container h-full flex animate-reveal overflow-hidden relative">
      {/* ── Origin 项目导航侧栏 ── */}
      <ProjectExplorer
        workspace={ws.workspace}
        onSelect={ws.setActiveItem}
        onAddWorkbook={() => ws.addWorkbook()}
        onAddGraph={() => ws.addGraph()}
        onRemove={handleRequestRemove}
        onRename={ws.renameItem}
        collapsed={explorerCollapsed}
        onToggleCollapse={() => setExplorerCollapsed(!explorerCollapsed)}
      />

      {/* ── 主内容区 ── */}
      <div className="flex-1 flex flex-col gap-4 px-2 min-w-0 overflow-hidden">
      <DataAnalysisHeader
        activeTab={isWorkbookActive ? 'data' : state.activeTab}
        onTabChange={actions.setActiveTab}
        onOpenEcoEngine={() => actions.setShowEcoEngine(true)}
        onOpenAssociate={() => actions.setShowAssociateModal(true)}
        onOpenChartLibrary={() => actions.setShowChartLibraryModal(true)}
        onSaveWorkspace={() => {
          if (state.currentSavedChartId) {
            actions.overwriteCurrentChart();
          } else {
            setShowSaveWorkspaceModal(true);
          }
        }}
        onSaveAs={() => setShowSaveWorkspaceModal(true)}
        onExport={actions.exportChart}
        isExporting={state.isExporting}
        isLightMode={isLightMode}
        currentSavedChartId={state.currentSavedChartId}
        currentSavedChartName={state.currentSavedChartName}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={actions.handleUndo}
        onRedo={actions.handleRedo}
      />

      {/* ── 工作区标签页 ── */}
      <WorkspaceTabs
        workspace={ws.workspace}
        onSelect={ws.setActiveItem}
        onClose={ws.closeTab}
      />

      {state.activeTab === 'mimic' ? (
        <StyleMimicView />
      ) : isWorkbookActive ? (
        <div className="flex-1 min-h-0 overflow-hidden pb-4">
          <DataSpreadsheet
            spreadsheet={(ws.activeItem.item as any).spreadsheet}
            updateSpreadsheet={(val: any) => ws.updateWorkbook(ws.activeItem.item.id, { spreadsheet: val })}
            setSeriesList={actions.setSeriesList}
            seriesList={state.seriesList}
            templates={state.userTemplates}
            onPlotColumns={(template, seriesData) => {
              actions.setSeriesList(seriesData);
              actions.setChartType(template.type);
              // 应用模板的完整样式配置
              stableActions.applyTemplate(template);
              // 切到第一个图表
              const firstGraph = ws.workspace.graphs[0];
              if (firstGraph) {
                ws.updateGraph(firstGraph.id, { seriesList: seriesData, chartType: template.type });
                ws.setActiveItem(firstGraph.id);
              }
            }}
          />
        </div>
      ) : (
        <div className="lab-main-grid flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden pb-4">
          <div className="lab-config-panel col-span-12 lg:col-span-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2 custom-scrollbar">
            {state.leftPanelMode === 'basic' ? (
              <ChartConfigPanel
                fileInputRef={refs.fileInputRef} handleFileUpload={unifiedFileUpload}
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
                hasRightAxis={state.seriesList.some(s => s.yAxisId === 'right')}
                rightYDomain={state.rightYDomain}
                setRightYDomain={actions.setRightYDomain}
                rightYScale={state.rightYScale}
                setRightYScale={actions.setRightYScale}
                rightYTickCount={state.rightYTickCount}
                setRightYTickCount={actions.setRightYTickCount}
                rightYAxisLabel={state.rightYAxisLabel}
                setRightYAxisLabel={actions.setRightYAxisLabel}
                rightYAxisDivision={state.rightYAxisDivision}
                setRightYAxisDivision={actions.setRightYAxisDivision}
                rightYAxisColor={state.rightYAxisColor}
                setRightYAxisColor={actions.setRightYAxisColor}
                documentColors={documentColors}
              />
            ) : (state.leftPanelMode as string) === 'subplot' && state.activeSubplotId ? (
              (() => {
                const activePanel = state.subplotPanels.find((p: any) => p.id === state.activeSubplotId);
                if (!activePanel) return <div />;
                return (
                  <SubplotSeriesSelector
                    panel={activePanel}
                    seriesList={state.seriesList}
                    onAssignSeries={stableActions.assignSeriesToPanel}
                    onUpdatePanel={stableActions.updateSubplotPanel}
                    onClose={() => actions.setLeftPanelMode('basic')}
                    globalStrokeWidth={state.strokeWidth}
                    globalPointSize={state.pointSize}
                    globalFontSize={state.fontSize}
                    globalAxisLabelFontSize={state.axisLabelFontSize}
                    globalTickFontSize={state.tickFontSize}
                    globalAxisLineWidth={state.axisLineWidth}
                    globalGridLineWidth={state.gridLineWidth}
                  />
                );
              })()
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

          <div className="lab-chart-area col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col relative">
            <div className="flex items-center gap-1.5 pr-4 flex-nowrap overflow-x-auto custom-scrollbar py-1 shrink-0">
              <DataProcessingToolbar
                seriesList={state.seriesList}
                onAddProcessedSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])}
              />

              {/* ── 拟合与建模 ── */}
              <ToolbarGroupMenu icon="fa-chart-line" label="拟合" color="text-indigo-600" bgColor="bg-indigo-50" borderColor="border-indigo-200" hoverBg="hover:bg-indigo-600">
                <div className="relative"><CurveFittingPanel seriesList={state.seriesList} onAddFittedSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])} /></div>
                <div className="relative"><AIFitAdvisor seriesList={state.seriesList} onAddSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])} /></div>
                <div className="relative"><DeconvolutionPanel seriesList={state.seriesList} onAddSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])} /></div>
              </ToolbarGroupMenu>

              {/* ── 统计检验 ── */}
              <ToolbarGroupMenu icon="fa-flask-vial" label="统计" color="text-rose-600" bgColor="bg-rose-50" borderColor="border-rose-200" hoverBg="hover:bg-rose-600">
                <div className="relative"><StatsPanel seriesList={state.seriesList} /></div>
                <div className="relative"><HypothesisTestPanel seriesList={state.seriesList} onAddAnnotation={stableActions.addAnnotation} /></div>
                <div className="relative"><FFTPanel seriesList={state.seriesList} onAddSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])} /></div>
                <div className="relative"><PCAPanel seriesList={state.seriesList} /></div>
                <div className="relative"><CorrelationHeatmap seriesList={state.seriesList} /></div>
                <div className="relative"><TSNEPanel seriesList={state.seriesList} /></div>
              </ToolbarGroupMenu>

              {/* ── 数据操作 ── */}
              <ToolbarGroupMenu icon="fa-scissors" label="操作" color="text-amber-600" bgColor="bg-amber-50" borderColor="border-amber-200" hoverBg="hover:bg-amber-600">
                <div className="relative"><PeakFinderPanel seriesList={state.seriesList} onAddAnnotations={(anns) => actions.setAnnotations((prev: any[]) => [...prev, ...anns])} /></div>
                <div className="relative"><DataClipTool seriesList={state.seriesList} onUpdateSeries={actions.updateSeries} onAddSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])} /></div>
                <div className="relative"><BatchMacroTool seriesList={state.seriesList} onSetSeriesList={actions.setSeriesList} /></div>
              </ToolbarGroupMenu>

              {/* ── 可视化增强 ── */}
              <ToolbarGroupMenu icon="fa-eye" label="视图" color="text-teal-600" bgColor="bg-teal-50" borderColor="border-teal-200" hoverBg="hover:bg-teal-600">
                <div className="relative"><WaterfallTool seriesList={state.seriesList} onSetSeriesList={actions.setSeriesList} /></div>
                <div className="relative"><DualAxisTool seriesList={state.seriesList} onSetSeriesList={actions.setSeriesList} rightYAxisLabel={state.rightYAxisLabel} onRightYAxisLabelChange={actions.setRightYAxisLabel} /></div>
                <div className="relative"><ErrorBandTool seriesList={state.seriesList} onAddSeries={(s) => actions.setSeriesList((prev: any[]) => [...prev, s])} /></div>
                <div className="relative"><PolarChartPanel seriesList={state.seriesList} /></div>
              </ToolbarGroupMenu>

              {/* ── 导出 ── */}
              <div className="relative shrink-0">
                <AutoReportGenerator seriesList={state.seriesList} />
              </div>
              <button
                onClick={() => {
                  const el = refs.chartContainerRef?.current?.querySelector('.lab-chart-responsive') as HTMLElement;
                  if (el) {
                    import('html-to-image').then(mod => {
                      mod.toSvg(el, { backgroundColor: '#ffffff', skipFonts: true, cacheBust: true }).then(dataUrl => {
                        const svgContent = decodeURIComponent(dataUrl.split(',')[1]);
                        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.download = `${state.chartTitle || 'chart'}.svg`;
                        a.href = url;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      });
                    });
                  }
                }}
                className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase transition-all border bg-white text-sky-600 border-sky-200 hover:bg-sky-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm shrink-0"
              >
                <i className="fa-solid fa-file-code text-[10px]" /> SVG
              </button>

              {/* ── 子图布局选择器 ── */}
              <div className="ml-auto shrink-0">
                <SubplotLayoutSelector
                  currentLayout={state.subplotLayout}
                  onSelectLayout={stableActions.setSubplotLayout}
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
            {state.subplotLayout !== 'single' && state.subplotPanels.length > 1 ? (
              <SubplotLayout
                layout={state.subplotLayout}
                panels={state.subplotPanels}
                allSeries={state.seriesList}
                activeSubplotId={state.activeSubplotId}
                onSelectPanel={(id: string) => {
                  stableActions.setActiveSubplotId(id);
                  actions.setLeftPanelMode('subplot');
                }}
                onUpdatePanel={stableActions.updateSubplotPanel}
                mainColor={state.mainColor}
                strokeWidth={state.strokeWidth}
                fontSize={state.fontSize}
                axisLabelFontSize={state.axisLabelFontSize}
                pointShape={state.pointShape}
                pointSize={state.pointSize}
                aspectRatio={state.aspectRatio}
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
              />
            ) : (
              memoizedChart
            )}
            </div>
          </div>
        </div>
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

      <WorkspaceSaveModal
        show={showSaveWorkspaceModal}
        onClose={() => setShowSaveWorkspaceModal(false)}
        onSave={(name) => actions.saveChartToLibrary(name)}
        defaultName={state.chartTitle}
      />

      <ExportPanel
        show={state.showExportPanel}
        onClose={() => actions.setShowExportPanel(false)}
        chartContainerRef={refs.chartContainerRef}
        chartTitle={state.chartTitle}
      />

      {/* ── 删除确认弹窗（Portal 到 body，彻底脱离 overflow-hidden 和 transform 容器） ── */}
      {confirmDelete && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.25), rgba(0,0,0,0.45))',
          }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              width: '20rem',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,250,252,0.98))',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.6)',
              animation: 'confirmPopIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            {/* 顶部装饰条 */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #f43f5e, #fb923c, #f43f5e)' }} />

            <div style={{ padding: '1.25rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 图标 */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div
                  style={{
                    width: 48, height: 48, borderRadius: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                  }}
                >
                  <i className="fa-solid fa-trash-can" style={{ color: '#ef4444', fontSize: 16 }} />
                </div>
              </div>

              {/* 文案 */}
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1e293b', marginBottom: 6 }}>确认删除</h3>
                <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
                  确定要删除 <span style={{ fontWeight: 700, color: '#334155' }}>「{confirmDelete.name}」</span> 吗？<br/>
                  此操作不可撤销。
                </p>
              </div>

              {/* 按钮 */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '0.75rem',
                    fontSize: 12, fontWeight: 700, color: '#64748b',
                    background: '#f1f5f9', border: 'none', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmRemove}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '0.75rem',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                    transition: 'all 0.15s',
                  }}
                >
                  <i className="fa-solid fa-trash" style={{ fontSize: 9, marginRight: 4 }} />
                  确认删除
                </button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes confirmPopIn {
              from { opacity: 0; transform: scale(0.85) translateY(10px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </div>{/* 主内容区结束 */}
    </div>
  );
};

export default DataAnalysis;