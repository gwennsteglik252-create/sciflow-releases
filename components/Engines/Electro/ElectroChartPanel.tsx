
import React, { useRef, useCallback } from 'react';
import { DataPoint, EngineMode, AnalysisResult } from './types';
import DataChart from '../../DataAnalysis/DataChart';
import { AnnotationType, DataSeries } from '../../../types';
import { FontTabType } from '../../../hooks/useDataAnalysisLogic';

interface ElectroChartPanelProps {
  activeMode: EngineMode;
  processedData: DataPoint[];
  chartConfig: { xLabel: string, yLabel: string, color: string };
  domains: { x: any[], y: any[] };
  analysisResult: AnalysisResult | null;
  axisLabelFontSize: number;
  // 编辑功能 Props
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  seriesList: DataSeries[];
  chartTitle: string;
  setChartTitle: (v: string) => void;
  xAxisLabel: string;
  setXAxisLabel: (v: string) => void;
  yAxisLabel: string;
  setYAxisLabel: (v: string) => void;
  chartType: 'line' | 'bar' | 'scatter' | 'area';
  mainColor: string;
  strokeWidth: number;
  fontSize: number;
  pointShape: any;
  pointSize: number;
  aspectRatio: number;
  gridX: boolean;
  setGridX: (v: boolean) => void;
  gridY: boolean;
  setGridY: (v: boolean) => void;
  axisBox: boolean;
  axisLineWidth: number;
  axisColor: string;
  tickFontSize: number;
  tickSize: number;
  tickWidth: number;
  xTickCount: number;
  yTickCount: number;
  xAxisDivision: number;
  yAxisDivision: number;
  labelFontFamily: string;
  labelFontWeight: string;
  labelFontStyle: string;
  titleFontFamily: string;
  titleFontWeight: string;
  titleFontStyle: string;
  tickFontFamily: string;
  tickFontWeight: string;
  tickFontStyle: string;
  legendFontFamily: string;
  legendFontWeight: string;
  legendFontStyle: string;
  legendFontSize: number;
  showXTicks: boolean;
  showYTicks: boolean;
  showMirroredTicks: boolean;
  annotations: any[];
  setAnnotations: (v: any) => void;
  activeTool: any;
  setActiveTool: (v: any) => void;
  legendPos: { x: number, y: number };
  setLegendPos: (pos: { x: number, y: number }) => void;
  xLabelPos: { x: number, y: number };
  setXLabelPos: (pos: { x: number, y: number }) => void;
  yLabelPos: { x: number, y: number };
  setYLabelPos: (pos: { x: number, y: number }) => void;
  titlePos: { x: number, y: number };
  setTitlePos: (pos: { x: number, y: number }) => void;
  // 双击刻度/标签快捷打开设置面板所需
  setLeftPanelMode: (mode: 'basic' | 'axis' | 'series') => void;
  setActiveFontTab: (tab: FontTabType) => void;
  captureRef?: React.RefObject<HTMLDivElement | null>;
}

export const ElectroChartPanel: React.FC<ElectroChartPanelProps> = (props) => {
  const chartRef = useRef<HTMLDivElement>(null!);

  const handleOpenAxisSettings = useCallback((tab: FontTabType) => {
    // 确保先进入编辑模式再切面板
    if (!props.isEditMode) props.setIsEditMode(true);
    props.setLeftPanelMode('axis');
    props.setActiveFontTab(tab);
  }, [props.isEditMode, props.setIsEditMode, props.setLeftPanelMode, props.setActiveFontTab]);

  // 稳定化回调引用，避免 DataChart 不必要重渲染
  const handleAddAnnotation = useCallback((ann: any) => {
    props.setAnnotations((prev: any[]) => [...prev, ann]);
  }, [props.setAnnotations]);

  const handleUpdateAnnotation = useCallback((id: string, up: any) => {
    props.setAnnotations((prev: any[]) => prev.map((a: any) => a.id === id ? { ...a, ...up } : a));
  }, [props.setAnnotations]);

  const handleRemoveAnnotation = useCallback((id: string) => {
    props.setAnnotations((prev: any[]) => prev.filter((a: any) => a.id !== id));
  }, [props.setAnnotations]);

  const noopSetEditingSeriesId = useCallback(() => { }, []);
  const noopUpdateSeries = useCallback(() => { }, []);

  return (
    <div className="flex-1 eco-analysis-grid-bg rounded-[3.5rem] border border-slate-200 flex flex-col relative overflow-hidden shadow-2xl bg-white group">

      {/* 顶部工具栏 - 整合标注与编辑入口 */}
      <div className="absolute top-6 left-8 right-8 z-40 flex justify-between items-center pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl text-white ${props.isEditMode ? 'bg-amber-500' : 'bg-slate-900'}`}>
            {props.activeMode} {props.isEditMode ? '排版编辑模式' : '动力学解算结果'}
          </span>

          <div className="bg-white/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-lg flex gap-1 items-center">
            <button
              onClick={() => props.setIsEditMode(!props.isEditMode)}
              className={`h-8 px-4 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 transition-all ${props.isEditMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <i className={`fa-solid ${props.isEditMode ? 'fa-check' : 'fa-wand-magic-sparkles'}`}></i>
              {props.isEditMode ? '完成编辑' : '编辑图表'}
            </button>

            {props.isEditMode && (
              <>
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button
                  onClick={() => props.setAnnotations([])}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  title="清空标注"
                >
                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pointer-events-auto bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-[8px] font-black uppercase border border-indigo-100 shadow-sm">
          有效数据点: {props.processedData.length}
        </div>
      </div>

      {/* 主绘图区域 */}
      <div className="flex-1 flex flex-col p-6 lg:p-10 h-full min-h-0">
        <div ref={props.captureRef} className="flex-1 w-full bg-white rounded-[3rem] p-4 lg:p-6 border border-slate-100 shadow-inner min-h-0 relative">
          <DataChart
            chartContainerRef={chartRef}
            seriesList={props.seriesList}
            chartType={props.chartType}
            mainColor={props.mainColor}
            strokeWidth={props.strokeWidth}
            fontSize={props.fontSize}
            axisLabelFontSize={props.axisLabelFontSize}
            pointShape={props.pointShape}
            pointSize={props.pointSize}
            xAxisLabel={props.xAxisLabel}
            setXAxisLabel={props.setXAxisLabel}
            yAxisLabel={props.yAxisLabel}
            setYAxisLabel={props.setYAxisLabel}
            chartTitle={props.chartTitle}
            setChartTitle={props.setChartTitle}
            annotations={props.annotations}
            activeTool={props.activeTool}
            onAddAnnotation={handleAddAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onRemoveAnnotation={handleRemoveAnnotation}
            onSetActiveTool={props.setActiveTool}
            legendPos={props.legendPos}
            setLegendPos={props.setLegendPos}
            editingSeriesId={null}
            setEditingSeriesId={noopSetEditingSeriesId}
            updateSeries={noopUpdateSeries}
            aspectRatio={props.aspectRatio}
            xLabelPos={props.xLabelPos}
            setXLabelPos={props.setXLabelPos}
            yLabelPos={props.yLabelPos}
            setYLabelPos={props.setYLabelPos}
            titlePos={props.titlePos}
            setTitlePos={props.setTitlePos}
            xDomain={props.domains.x as any}
            yDomain={props.domains.y as any}
            gridX={props.gridX}
            setGridX={props.setGridX}
            gridY={props.gridY}
            setGridY={props.setGridY}
            axisLineWidth={props.axisLineWidth}
            axisColor={props.axisColor}
            axisBox={props.axisBox}
            tickFontSize={props.tickFontSize}
            tickSize={props.tickSize}
            tickWidth={props.tickWidth}
            xTickCount={props.xTickCount}
            yTickCount={props.yTickCount}
            xAxisDivision={props.xAxisDivision}
            yAxisDivision={props.yAxisDivision}
            labelFontFamily={props.labelFontFamily}
            labelFontWeight={props.labelFontWeight}
            labelFontStyle={props.labelFontStyle}
            titleFontFamily={props.titleFontFamily}
            titleFontWeight={props.titleFontWeight}
            titleFontStyle={props.titleFontStyle}
            tickFontFamily={props.tickFontFamily}
            tickFontWeight={props.tickFontWeight}
            tickFontStyle={props.tickFontStyle}
            showXTicks={props.showXTicks}
            showYTicks={props.showYTicks}
            showMirroredTicks={props.showMirroredTicks}
            legendFontFamily={props.legendFontFamily}
            legendFontWeight={props.legendFontWeight}
            legendFontStyle={props.legendFontStyle}
            legendFontSize={props.legendFontSize}
            legendBorderVisible={false}
            legendBorderColor="transparent"
            legendBorderWidth={0}
            onOpenAxisSettings={handleOpenAxisSettings}
          />
        </div>
      </div>
    </div>
  );
};
