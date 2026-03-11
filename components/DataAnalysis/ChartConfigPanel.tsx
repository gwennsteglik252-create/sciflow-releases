
import React, { RefObject } from 'react';
import { DataSeries, AnnotationType } from '../../types';
import { ScientificTheme } from '../../ScientificThemes';
import { ChartTemplate } from '../../hooks/useDataAnalysisLogic';
import { TemplateSection } from './Config/TemplateSection';
import { JournalStyleSection } from './Config/JournalStyleSection';
import { DataSourceSection } from './Config/DataSourceSection';
import { GlobalSettingsSection } from './Config/GlobalSettingsSection';
import { AnnotationToolsSection } from './Config/AnnotationToolsSection';

interface ChartConfigPanelProps {
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  seriesList: DataSeries[];
  updateSeries: (id: string, updates: Partial<DataSeries>) => void;
  removeSeries: (id: string) => void;
  setSeriesSettingsId: (id: string | null) => void; 
  titleInputRef: RefObject<HTMLInputElement>;
  chartTitle: string;
  setChartTitle: (v: string) => void;
  chartType: 'line' | 'bar' | 'scatter' | 'area';
  setChartType: (v: 'line' | 'bar' | 'scatter' | 'area') => void;
  mainColor: string;
  setMainColor: (v: string) => void;
  strokeWidth: number;
  setStrokeWidth: (v: number) => void;
  fontSize: number;
  setFontSize: (v: number) => void;
  pointShape: 'circle' | 'sphere' | 'square' | 'diamond' | 'triangleUp' | 'triangleDown' | 'cross' | 'star' | 'none';
  setPointShape: (v: any) => void;
  pointSize: number;
  setPointSize: (v: number) => void;
  xLabelInputRef: RefObject<HTMLInputElement>;
  xAxisLabel: string;
  setXAxisLabel: (v: string) => void;
  yLabelInputRef: React.RefObject<HTMLInputElement>;
  yAxisLabel: string;
  setYAxisLabel: (v: string) => void;
  activeScientificTheme: string | null;
  applyScientificTheme: (theme: ScientificTheme) => void;
  onOpenSaveTemplate: () => void;
  onOpenAxisConfig: () => void; 
  aspectRatio: number;
  setAspectRatio: (v: number) => void;
  showTemplateList?: boolean;
  setShowTemplateList?: (show: boolean) => void;
  userTemplates?: ChartTemplate[];
  applyTemplate?: (tpl: ChartTemplate) => void;
  onDeleteTemplate?: (id: string, e: React.MouseEvent) => void;
  
  // Annotation Tools
  activeTool: AnnotationType | 'select' | 'none';
  onSetActiveTool: (tool: any) => void;

  // New Discovery Props
  templateSearchQuery: string;
  setTemplateSearchQuery: (q: string) => void;
  handleDiscoverTemplate: () => void;
  isDiscoveringTemplate: boolean;
  onDiscoverFromImage?: (file: File) => void;
  
  // 画廊控制
  onOpenGallery: () => void;
}

const ChartConfigPanel: React.FC<ChartConfigPanelProps> = ({
  fileInputRef, handleFileUpload, seriesList, updateSeries, removeSeries, setSeriesSettingsId,
  titleInputRef, chartTitle, setChartTitle, chartType, setChartType, mainColor, setMainColor,
  strokeWidth, setStrokeWidth, fontSize, setFontSize, pointShape, pointSize, setPointSize,
  xLabelInputRef, xAxisLabel, setXAxisLabel, yLabelInputRef, yAxisLabel, setYAxisLabel,
  activeScientificTheme, applyScientificTheme, onOpenSaveTemplate, onOpenAxisConfig,
  aspectRatio, setAspectRatio,
  showTemplateList, setShowTemplateList, userTemplates = [], applyTemplate, onDeleteTemplate,
  activeTool, onSetActiveTool,
  templateSearchQuery, setTemplateSearchQuery, handleDiscoverTemplate, isDiscoveringTemplate,
  onDiscoverFromImage, onOpenGallery
}) => {
  return (
    <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 space-y-3 shadow-md">
      <TemplateSection 
        showTemplateList={!!showTemplateList} 
        setShowTemplateList={setShowTemplateList || (() => {})} 
        userTemplates={userTemplates} 
        applyTemplate={applyTemplate || (() => {})} 
        onDeleteTemplate={onDeleteTemplate || (() => {})} 
        templateSearchQuery={templateSearchQuery}
        setTemplateSearchQuery={setTemplateSearchQuery}
        handleDiscoverTemplate={handleDiscoverTemplate}
        isDiscoveringTemplate={!!isDiscoveringTemplate}
        onDiscoverFromImage={onDiscoverFromImage}
        onOpenGallery={onOpenGallery}
      />

      <JournalStyleSection 
        activeScientificTheme={activeScientificTheme} 
        applyScientificTheme={applyScientificTheme} 
      />

      <DataSourceSection 
        fileInputRef={fileInputRef} 
        handleFileUpload={handleFileUpload} 
        seriesList={seriesList} 
        updateSeries={updateSeries} 
        removeSeries={removeSeries} 
        setSeriesSettingsId={setSeriesSettingsId} 
      />

      <GlobalSettingsSection 
        onOpenSeriesConfig={() => { if (seriesList.length > 0) setSeriesSettingsId(seriesList[0].id); }}
        onOpenAxisConfig={onOpenAxisConfig}
        onOpenSaveTemplate={onOpenSaveTemplate}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        titleInputRef={titleInputRef}
        chartTitle={chartTitle}
        setChartTitle={setChartTitle}
        chartType={chartType}
        setChartType={setChartType}
        mainColor={mainColor}
        setMainColor={setMainColor}
        xLabelInputRef={xLabelInputRef}
        xAxisLabel={xAxisLabel}
        setXAxisLabel={setXAxisLabel}
        yLabelInputRef={yLabelInputRef}
        yAxisLabel={yAxisLabel}
        setYAxisLabel={setYAxisLabel}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />
      
      <AnnotationToolsSection 
        activeTool={activeTool}
        onSetActiveTool={onSetActiveTool}
      />
    </div>
  );
};

export default ChartConfigPanel;
