/**
 * SubplotLayout — 多子图布局容器
 *
 * 根据 subplotLayout 模式（1×2, 2×1, 2×2 等）用 CSS Grid
 * 渲染多个独立 DataChart 实例，并在每个面板左上角显示学术标签 (a)/(b)/(c)/(d)。
 *
 * 每面板属性优先使用 panel.xxx，未设置时回退到全局 props。
 * 轴标签支持在子图上拖拽移动，刻度值支持除以系数显示。
 */
import React, { useMemo, useRef } from 'react';
import DataChart from './DataChart';
import { DataSeries, SubplotLayoutMode, SubplotPanel } from '../../types';

/** 布局 → CSS Grid 映射 */
const LAYOUT_GRID: Record<SubplotLayoutMode, { cols: string; rows: string }> = {
  single: { cols: '1fr', rows: '1fr' },
  '1x2': { cols: '1fr 1fr', rows: '1fr' },
  '2x1': { cols: '1fr', rows: '1fr 1fr' },
  '2x2': { cols: '1fr 1fr', rows: '1fr 1fr' },
  '1x3': { cols: '1fr 1fr 1fr', rows: '1fr' },
  '3x1': { cols: '1fr', rows: '1fr 1fr 1fr' },
  '2x3': { cols: '1fr 1fr 1fr', rows: '1fr 1fr' },
  '3x2': { cols: '1fr 1fr', rows: '1fr 1fr 1fr' },
};

interface SubplotLayoutProps {
  layout: SubplotLayoutMode;
  panels: SubplotPanel[];
  allSeries: DataSeries[];
  activeSubplotId: string | null;
  onSelectPanel: (id: string) => void;
  onUpdatePanel: (id: string, updates: Partial<SubplotPanel>) => void;

  mainColor: string;
  strokeWidth: number;
  fontSize: number;
  axisLabelFontSize: number;
  pointShape: any;
  pointSize: number;
  aspectRatio: number;
  gridX: boolean;
  gridY: boolean;
  gridLineWidth: number;
  axisLineWidth: number;
  axisColor: string;
  axisBox: boolean;
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
  legendBorderVisible: boolean;
  legendBorderColor: string;
  legendBorderWidth: number;
  showXTicks: boolean;
  showYTicks: boolean;
  showMirroredTicks: boolean;
}

const SubplotLayout: React.FC<SubplotLayoutProps> = ({
  layout, panels, allSeries, activeSubplotId, onSelectPanel, onUpdatePanel,
  mainColor, strokeWidth, fontSize, axisLabelFontSize, pointShape, pointSize,
  aspectRatio, gridX, gridY, gridLineWidth, axisLineWidth, axisColor, axisBox,
  tickFontSize, tickSize, tickWidth, xTickCount, yTickCount, xAxisDivision, yAxisDivision,
  labelFontFamily, labelFontWeight, labelFontStyle,
  titleFontFamily, titleFontWeight, titleFontStyle,
  tickFontFamily, tickFontWeight, tickFontStyle,
  legendFontFamily, legendFontWeight, legendFontStyle, legendFontSize,
  legendBorderVisible, legendBorderColor, legendBorderWidth,
  showXTicks, showYTicks, showMirroredTicks,
}) => {
  const grid = LAYOUT_GRID[layout] || LAYOUT_GRID.single;
  const refsMap = useRef<Record<string, HTMLDivElement | null>>({});

  const panelSeriesMap = useMemo(() => {
    const map: Record<string, DataSeries[]> = {};
    panels.forEach(p => {
      map[p.id] = p.seriesIds.length > 0
        ? allSeries.filter(s => p.seriesIds.includes(s.id))
        : [];
    });
    return map;
  }, [panels, allSeries]);

  return (
    <>
      {/* 子图紧凑模式 CSS — 覆盖 DataChart 内部间距 */}
      <style>{`
        .subplot-compact .lab-chart-container {
          min-height: unset !important;
          padding: 4px 2px 2px 2px !important;
        }
        .subplot-compact .lab-chart-title-wrap {
          display: none !important;
        }
        .subplot-compact .lab-chart-container .flex-1.relative.min-h-0 {
          margin-top: 4px !important;
        }
      `}</style>

      <div
        className="subplot-layout-container w-full h-full"
        style={{
          display: 'grid',
          gridTemplateColumns: grid.cols,
          gridTemplateRows: grid.rows,
          gap: '6px',
          padding: '2px',
        }}
      >
        {panels.map(panel => {
          const isActive = activeSubplotId === panel.id;
          const panelSeries = panelSeriesMap[panel.id] || [];
          const labelPos = panel.labelPos ?? { x: 8, y: 4 };

          // 逐字段 panel ?? global 回退
          const pStrokeWidth = panel.strokeWidth ?? strokeWidth;
          const pFontSize = panel.fontSize ?? Math.max(fontSize - 2, 10);
          const pAxisLabelFontSize = panel.axisLabelFontSize ?? Math.max(axisLabelFontSize - 4, 10);
          const pPointShape = panel.pointShape ?? pointShape;
          const pPointSize = panel.pointSize ?? Math.max(pointSize - 1, 2);
          const pTickFontSize = panel.tickFontSize ?? Math.max(tickFontSize - 2, 8);
          const pAxisLineWidth = panel.axisLineWidth ?? axisLineWidth;
          const pAxisColor = panel.axisColor ?? axisColor;
          const pGridLineWidth = panel.gridLineWidth ?? gridLineWidth;
          const pLabelFontFamily = panel.labelFontFamily ?? labelFontFamily;
          const pTitleFontFamily = panel.titleFontFamily ?? titleFontFamily;
          const pTickFontFamily = panel.tickFontFamily ?? tickFontFamily;
          const pShowXTicks = panel.showXTicks ?? showXTicks;
          const pShowYTicks = panel.showYTicks ?? showYTicks;
          const pShowMirroredTicks = panel.showMirroredTicks ?? showMirroredTicks;
          const pLegendPos = panel.legendPos ?? { x: 8, y: 4 };
          const pXLabelPos = panel.xLabelPos ?? { x: 0, y: 0 };
          const pYLabelPos = panel.yLabelPos ?? { x: 0, y: 0 };
          const pXAxisDivision = panel.xAxisDivision ?? xAxisDivision;
          const pYAxisDivision = panel.yAxisDivision ?? yAxisDivision;

          return (
            <div
              key={panel.id}
              className="subplot-panel subplot-compact relative flex flex-col bg-white rounded-lg overflow-hidden transition-all cursor-pointer"
              style={{
                border: isActive ? '2px solid #6366f1' : '1.5px solid #e2e8f0',
                boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}
              onClick={() => onSelectPanel(panel.id)}
            >
              {/* 子图标签 (a)/(b) — 固定位置 */}
              <div
                className="absolute z-[80] select-none pointer-events-none"
                style={{
                  left: `${labelPos.x}px`,
                  top: `${labelPos.y}px`,
                  fontFamily: pTitleFontFamily !== 'inherit' ? pTitleFontFamily : 'Times New Roman, serif',
                  fontSize: `${Math.max(pAxisLabelFontSize, 14)}px`,
                  fontWeight: '700',
                  color: '#1e293b',
                  lineHeight: 1,
                }}
              >
                {panel.label}
              </div>

              {/* 选中指示器 */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-500 rounded-t-lg z-[85]" />
              )}

              {/* DataChart 渲染 */}
              <div
                className="flex-1 min-h-0"
                ref={(el) => { refsMap.current[panel.id] = el; }}
              >
                <DataChart
                  subplotMode
                  chartContainerRef={{ current: refsMap.current[panel.id] } as React.RefObject<HTMLDivElement>}
                  seriesList={panelSeries}
                  chartType={panel.chartType as any}
                  mainColor={mainColor}
                  strokeWidth={pStrokeWidth}
                  fontSize={pFontSize}
                  axisLabelFontSize={pAxisLabelFontSize}
                  pointShape={pPointShape}
                  pointSize={pPointSize}
                  xAxisLabel={panel.xAxisLabel}
                  setXAxisLabel={(v) => onUpdatePanel(panel.id, { xAxisLabel: v })}
                  yAxisLabel={panel.yAxisLabel}
                  setYAxisLabel={(v) => onUpdatePanel(panel.id, { yAxisLabel: v })}
                  chartTitle=""
                  setChartTitle={() => {}}
                  annotations={[]}
                  activeTool="none"
                  onAddAnnotation={() => {}}
                  onUpdateAnnotation={() => {}}
                  onRemoveAnnotation={() => {}}
                  onSetActiveTool={() => {}}
                  legendPos={pLegendPos}
                  setLegendPos={(pos) => onUpdatePanel(panel.id, { legendPos: pos })}
                  editingSeriesId={null}
                  setEditingSeriesId={() => {}}
                  updateSeries={() => {}}
                  aspectRatio={aspectRatio}
                  xLabelPos={pXLabelPos}
                  setXLabelPos={(pos) => onUpdatePanel(panel.id, { xLabelPos: pos })}
                  yLabelPos={pYLabelPos}
                  setYLabelPos={(pos) => onUpdatePanel(panel.id, { yLabelPos: pos })}
                  titlePos={{ x: 0, y: 0 }}
                  setTitlePos={() => {}}
                  xDomain={panel.xDomain}
                  yDomain={panel.yDomain}
                  xScale={(panel.xScale || 'auto') as any}
                  yScale={(panel.yScale || 'auto') as any}
                  gridX={panel.gridX ?? gridX}
                  gridY={panel.gridY ?? gridY}
                  gridLineWidth={pGridLineWidth}
                  axisLineWidth={pAxisLineWidth}
                  axisColor={pAxisColor}
                  axisBox={panel.axisBox ?? axisBox}
                  tickFontSize={pTickFontSize}
                  tickSize={tickSize}
                  tickWidth={tickWidth}
                  xTickCount={panel.xTickCount ?? Math.min(xTickCount, 4)}
                  yTickCount={panel.yTickCount ?? Math.min(yTickCount, 4)}
                  xAxisDivision={pXAxisDivision}
                  yAxisDivision={pYAxisDivision}
                  labelFontFamily={pLabelFontFamily}
                  labelFontWeight={labelFontWeight}
                  labelFontStyle={labelFontStyle}
                  titleFontFamily={pTitleFontFamily}
                  titleFontWeight={titleFontWeight}
                  titleFontStyle={titleFontStyle}
                  tickFontFamily={pTickFontFamily}
                  tickFontWeight={tickFontWeight}
                  tickFontStyle={tickFontStyle}
                  legendFontFamily={legendFontFamily}
                  legendFontWeight={legendFontWeight}
                  legendFontStyle={legendFontStyle}
                  legendFontSize={Math.max(legendFontSize - 2, 8)}
                  legendBorderVisible={legendBorderVisible}
                  legendBorderColor={legendBorderColor}
                  legendBorderWidth={legendBorderWidth}
                  showXTicks={pShowXTicks}
                  showYTicks={pShowYTicks}
                  showMirroredTicks={pShowMirroredTicks}
                />
              </div>

              {/* 空面板提示 */}
              {panelSeries.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[50]">
                  <div className="flex flex-col items-center gap-2 opacity-30">
                    <i className="fa-solid fa-chart-line text-2xl text-slate-300" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      点击面板分配数据
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default SubplotLayout;
