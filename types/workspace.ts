// ─────────────────────────────────────────────
// Workspace Types — Origin-style Multi-Document Workspace
// ─────────────────────────────────────────────

import { SpreadsheetState, createDefaultSpreadsheet } from './spreadsheet';

/** 工作区项目类型 */
export type WorkspaceItemType = 'workbook' | 'graph';

/** 图表配置快照（从 DataAnalysisSession 中提取的独立图表状态） */
export interface GraphConfig {
  seriesList: any[];
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  chartType: 'line' | 'bar' | 'scatter' | 'area' | 'box' | 'histogram' | 'contour' | 'heatmap' | 'surface3d' | 'violin' | 'bubble' | 'ternary' | 'polar' | 'waterfallPlotly' | 'parallel' | 'funnel' | 'treemap' | 'sunburst';
  strokeWidth: number;
  mainColor: string;
  fontSize: number;
  pointShape: any;
  pointSize: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xScale: 'auto' | 'log';
  yScale: 'auto' | 'log';
  gridX: boolean;
  gridY: boolean;
  axisBox: boolean;
  legendPos: { x: number; y: number };
  annotations: any[];
  aspectRatio: number;
  axisColor: string;
  axisLineWidth: number;
  gridLineWidth: number;
  tickFontSize: number;
  tickSize: number;
  tickWidth: number;
  axisLabelFontSize: number;
  xTickCount: number;
  yTickCount: number;
  xAxisDivision?: number;
  yAxisDivision?: number;
  titleFontFamily: string;
  titleFontWeight: string;
  titleFontStyle: string;
  labelFontFamily: string;
  labelFontWeight: string;
  labelFontStyle: string;
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
  xLabelPos: { x: number; y: number };
  yLabelPos: { x: number; y: number };
  titlePos: { x: number; y: number };
  showXTicks: boolean;
  showYTicks: boolean;
  showMirroredTicks: boolean;
  yZoom?: number;
  /** 引用的工作表数据源 ID（可选，跨工作表引用） */
  sourceWorkbookId?: string;
}

/** 工作表项 */
export interface WorkbookItem {
  id: string;
  name: string;
  spreadsheet: SpreadsheetState;
  /** 从工作表直接派生的 seriesList，在图表引用时使用 */
  seriesList?: any[];
}

/** 图表项 */
export interface GraphItem {
  id: string;
  name: string;
  config: GraphConfig;
}

/** 工作区状态 */
export interface WorkspaceState {
  workbooks: WorkbookItem[];
  graphs: GraphItem[];
  /** 当前打开的标签页列表（按 ID） */
  openTabs: string[];
  /** 当前活跃项 ID */
  activeItemId: string;
}

/** 默认图表配置 */
export const createDefaultGraphConfig = (): GraphConfig => ({
  seriesList: [],
  chartTitle: '',
  xAxisLabel: 'X Axis',
  yAxisLabel: 'Y Axis',
  chartType: 'scatter',
  strokeWidth: 2,
  mainColor: '#6366f1',
  fontSize: 12,
  pointShape: 'circle',
  pointSize: 5,
  xDomain: [0, 10],
  yDomain: [0, 10],
  xScale: 'auto',
  yScale: 'auto',
  gridX: false,
  gridY: false,
  axisBox: false,
  legendPos: { x: 0, y: 0 },
  annotations: [],
  aspectRatio: 1.6,
  axisColor: '#374151',
  axisLineWidth: 1.5,
  gridLineWidth: 0.5,
  tickFontSize: 10,
  tickSize: 5,
  tickWidth: 1,
  axisLabelFontSize: 12,
  xTickCount: 6,
  yTickCount: 6,
  titleFontFamily: 'Arial',
  titleFontWeight: 'bold',
  titleFontStyle: 'normal',
  labelFontFamily: 'Arial',
  labelFontWeight: 'bold',
  labelFontStyle: 'normal',
  tickFontFamily: 'Arial',
  tickFontWeight: 'normal',
  tickFontStyle: 'normal',
  legendFontFamily: 'Arial',
  legendFontWeight: 'normal',
  legendFontStyle: 'normal',
  legendFontSize: 10,
  legendBorderVisible: true,
  legendBorderColor: '#e2e8f0',
  legendBorderWidth: 1,
  xLabelPos: { x: 0, y: 0 },
  yLabelPos: { x: 0, y: 0 },
  titlePos: { x: 0, y: 0 },
  showXTicks: true,
  showYTicks: true,
  showMirroredTicks: false,
});

/** 创建默认工作区 */
export const createDefaultWorkspace = (): WorkspaceState => {
  const wb: WorkbookItem = {
    id: 'wb_default',
    name: 'Book1',
    spreadsheet: createDefaultSpreadsheet(3, 10),
  };
  const gr: GraphItem = {
    id: 'gr_default',
    name: 'Graph1',
    config: createDefaultGraphConfig(),
  };
  return {
    workbooks: [wb],
    graphs: [gr],
    openTabs: [wb.id, gr.id],
    activeItemId: gr.id,
  };
};
