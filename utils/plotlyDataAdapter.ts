/**
 * PlotlyDataAdapter — 将 DataSeries[] + 电子表格数据 转换为 Plotly Data & Layout
 *
 * 支持的高级图表类型：
 *   contour, heatmap, surface3d, violin, bubble, ternary
 */
import { DataSeries } from '../types';

// Plotly types – use inline shapes to avoid tight coupling with plotly.js typings
export type PlotlyTrace = Record<string, any>;
export type PlotlyLayout = Record<string, any>;

export interface SpreadsheetSnapshot {
  columns: { id: string; name: string; role: string }[];
  rows: string[][];
}

export interface PlotlyAdapterResult {
  data: PlotlyTrace[];
  layout: PlotlyLayout;
}

// ═══════════════════════════════════════════════════
//  公共工具
// ═══════════════════════════════════════════════════

/** 从 DataSeries 提取纯数值 Y 数组 */
const extractY = (s: DataSeries): number[] =>
  s.data.map(d => d.value).filter(v => !isNaN(v));

/** 从 DataSeries 提取 X 数值数组 */
const extractX = (s: DataSeries): number[] =>
  s.data.map(d => parseFloat(d.name)).filter(v => !isNaN(v));

/** 从电子表格中按列角色提取数值列 */
const extractColumnByRole = (
  sheet: SpreadsheetSnapshot,
  role: string,
  colIndex?: number
): number[] => {
  const idx = colIndex !== undefined
    ? colIndex
    : sheet.columns.findIndex(c => c.role === role);
  if (idx < 0) return [];
  return sheet.rows.map(row => parseFloat(row[idx] || '')).filter(v => !isNaN(v));
};

/** 构建所有 Y 列为矩阵（用于 heatmap/contour/surface） */
const buildZMatrix = (sheet: SpreadsheetSnapshot): { x: number[]; y: number[]; z: number[][] } => {
  const yCols = sheet.columns
    .map((c, i) => ({ role: c.role, idx: i }))
    .filter(c => c.role === 'Y');

  const xCol = extractColumnByRole(sheet, 'X');

  // 每列 Y 值 => z 矩阵的一行，每行 = 对应 x 点上各列 Y 不同的值
  // 但对于 heatmap/contour，z[i][j] = sheet[row_j][yCol_i]
  const z: number[][] = [];
  const maxRows = Math.max(...yCols.map(c => sheet.rows.length));
  for (let ri = 0; ri < maxRows; ri++) {
    const row: number[] = [];
    for (const yc of yCols) {
      const val = parseFloat(sheet.rows[ri]?.[yc.idx] || '');
      row.push(isNaN(val) ? 0 : val);
    }
    z.push(row);
  }

  // y 轴 = 列名（各系列名称）
  const yLabels = yCols.map((_, i) => i);

  return { x: xCol.length > 0 ? xCol.slice(0, maxRows) : Array.from({ length: maxRows }, (_, i) => i), y: yLabels, z };
};

// ═══════════════════════════════════════════════════
//  基础 Layout 构建
// ═══════════════════════════════════════════════════

const baseLayout = (
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyLayout => ({
  title: {
    text: title,
    font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' },
    x: 0.5,
  },
  xaxis: {
    title: { text: xLabel, font: { size: 13, color: '#475569' } },
    gridcolor: '#f1f5f9',
    zerolinecolor: '#e2e8f0',
  },
  yaxis: {
    title: { text: yLabel, font: { size: 13, color: '#475569' } },
    gridcolor: '#f1f5f9',
    zerolinecolor: '#e2e8f0',
  },
  paper_bgcolor: '#ffffff',
  plot_bgcolor: '#ffffff',
  font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
  margin: { t: 60, r: 30, b: 60, l: 70 },
  autosize: true,
  showlegend: true,
  legend: { font: { size: 11 }, bgcolor: 'rgba(255,255,255,0.8)' },
});

// ═══════════════════════════════════════════════════
//  图表类型适配器
// ═══════════════════════════════════════════════════

/** 小提琴图 */
const buildViolin = (
  series: DataSeries[],
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const visible = series.filter(s => s.visible !== false);
  const data: PlotlyTrace[] = visible.map(s => ({
    type: 'violin',
    name: s.name,
    y: extractY(s),
    box: { visible: true },
    meanline: { visible: true },
    line: { color: s.color || '#6366f1' },
    fillcolor: s.color ? `${s.color}33` : '#6366f133',
    opacity: 0.8,
  }));

  return { data, layout: baseLayout(title, xLabel, yLabel, aspectRatio) };
};

/** 气泡图 */
const buildBubble = (
  series: DataSeries[],
  sheet: SpreadsheetSnapshot | undefined,
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const visible = series.filter(s => s.visible !== false);
  const data: PlotlyTrace[] = visible.map(s => {
    const x = extractX(s);
    const y = extractY(s);
    // 气泡大小来自 error 字段或固定值
    const sizes = s.data.map(d => (d.error && d.error > 0 ? d.error : 5));
    const maxSize = Math.max(...sizes, 1);
    const normalized = sizes.map(sz => (sz / maxSize) * 40 + 5);

    return {
      type: 'scatter',
      mode: 'markers',
      name: s.name,
      x,
      y,
      marker: {
        size: normalized,
        color: s.color || '#6366f1',
        opacity: 0.7,
        line: { width: 1, color: '#ffffff' },
        sizemode: 'diameter',
      },
    };
  });

  return { data, layout: baseLayout(title, xLabel, yLabel, aspectRatio) };
};

/** 热力图 */
const buildHeatmap = (
  series: DataSeries[],
  sheet: SpreadsheetSnapshot | undefined,
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  let z: number[][];
  let x: (number | string)[] | undefined;
  let y: (number | string)[] | undefined;

  if (sheet && sheet.columns.length > 2) {
    const result = buildZMatrix(sheet);
    z = result.z;
    x = result.x as any;
    y = sheet.columns
      .filter(c => c.role === 'Y')
      .map(c => c.name);
  } else {
    // 回退：每个 series 的 Y 值作为矩阵的一行
    const visible = series.filter(s => s.visible !== false);
    z = visible.map(s => extractY(s));
    y = visible.map(s => s.name);
    x = visible[0] ? extractX(visible[0]) : undefined;
  }

  const data: PlotlyTrace[] = [{
    type: 'heatmap',
    z,
    x,
    y,
    colorscale: 'Viridis',
    colorbar: { title: { text: yLabel, side: 'right' } },
  }];

  const layout = baseLayout(title, xLabel, yLabel, aspectRatio);
  layout.yaxis.autorange = 'reversed'; // heatmap 惯例

  return { data, layout };
};

/** 等高线图 */
const buildContour = (
  series: DataSeries[],
  sheet: SpreadsheetSnapshot | undefined,
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const heatmapResult = buildHeatmap(series, sheet, title, xLabel, yLabel, aspectRatio);
  // 简单地将 heatmap 变为 contour
  heatmapResult.data[0].type = 'contour';
  heatmapResult.data[0].contours = { coloring: 'heatmap', showlabels: true };
  delete heatmapResult.layout.yaxis.autorange;
  return heatmapResult;
};

/** 3D 曲面图 */
const buildSurface3d = (
  series: DataSeries[],
  sheet: SpreadsheetSnapshot | undefined,
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  let z: number[][];

  if (sheet && sheet.columns.length > 2) {
    z = buildZMatrix(sheet).z;
  } else {
    const visible = series.filter(s => s.visible !== false);
    z = visible.map(s => extractY(s));
  }

  const data: PlotlyTrace[] = [{
    type: 'surface',
    z,
    colorscale: 'Viridis',
    colorbar: { title: { text: yLabel, side: 'right' } },
  }];

  const layout: PlotlyLayout = {
    title: {
      text: title,
      font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' },
    },
    scene: {
      xaxis: { title: xLabel },
      yaxis: { title: yLabel },
      zaxis: { title: 'Z' },
    },
    paper_bgcolor: '#ffffff',
    font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
    margin: { t: 60, r: 20, b: 20, l: 20 },
    autosize: true,
  };

  return { data, layout };
};

/** 三元相图 */
const buildTernary = (
  series: DataSeries[],
  sheet: SpreadsheetSnapshot | undefined,
  title: string
): PlotlyAdapterResult => {
  const visible = series.filter(s => s.visible !== false);

  // 三元相图需要 3 个组分 (a, b, c)
  // 数据来源优先从电子表格的前三列 Y 取值
  const data: PlotlyTrace[] = [];

  if (sheet) {
    const yCols = sheet.columns
      .map((c, i) => ({ role: c.role, idx: i }))
      .filter(c => c.role === 'Y');

    if (yCols.length >= 3) {
      const a = sheet.rows.map(r => parseFloat(r[yCols[0].idx] || '0'));
      const b = sheet.rows.map(r => parseFloat(r[yCols[1].idx] || '0'));
      const c = sheet.rows.map(r => parseFloat(r[yCols[2].idx] || '0'));

      data.push({
        type: 'scatterternary',
        mode: 'markers',
        a,
        b,
        c,
        marker: {
          size: 8,
          color: '#6366f1',
          line: { width: 1, color: '#ffffff' },
        },
        name: '数据点',
      });
    }
  }

  // 回退：用前 3 个 series 的 Y 值
  if (data.length === 0 && visible.length >= 3) {
    const minLen = Math.min(...visible.slice(0, 3).map(s => s.data.length));
    const a = extractY(visible[0]).slice(0, minLen);
    const b = extractY(visible[1]).slice(0, minLen);
    const c = extractY(visible[2]).slice(0, minLen);

    data.push({
      type: 'scatterternary',
      mode: 'markers',
      a,
      b,
      c,
      marker: {
        size: 8,
        color: visible[0].color || '#6366f1',
        line: { width: 1, color: '#ffffff' },
      },
      name: '数据点',
    });
  }

  // 零数据回退
  if (data.length === 0) {
    data.push({
      type: 'scatterternary',
      mode: 'markers',
      a: [33],
      b: [33],
      c: [34],
      marker: { size: 10, color: '#94a3b8' },
      name: '无数据',
    });
  }

  const layout: PlotlyLayout = {
    title: {
      text: title,
      font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' },
      x: 0.5,
    },
    ternary: {
      aaxis: { title: { text: 'A' }, gridcolor: '#e2e8f0', linecolor: '#cbd5e1' },
      baxis: { title: { text: 'B' }, gridcolor: '#e2e8f0', linecolor: '#cbd5e1' },
      caxis: { title: { text: 'C' }, gridcolor: '#e2e8f0', linecolor: '#cbd5e1' },
      bgcolor: '#ffffff',
    },
    paper_bgcolor: '#ffffff',
    font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
    showlegend: true,
    autosize: true,
    margin: { t: 60, r: 30, b: 30, l: 30 },
  };

  return { data, layout };
};

// ═══════════════════════════════════════════════════
//  主入口
// ═══════════════════════════════════════════════════

/** 极坐标图 */
const buildPolar = (
  series: DataSeries[],
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const visible = series.filter(s => s.visible !== false);
  const data: PlotlyTrace[] = visible.map(s => ({
    type: 'scatterpolar',
    mode: 'lines+markers',
    name: s.name,
    theta: s.data.map(d => d.name),
    r: extractY(s),
    line: { color: s.color || '#6366f1' },
    marker: { size: 5, color: s.color || '#6366f1' },
    fill: 'toself',
    fillcolor: s.color ? `${s.color}1a` : '#6366f11a',
  }));

  return {
    data,
    layout: {
      title: { text: title, font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' }, x: 0.5 },
      polar: {
        radialaxis: { visible: true, range: [0, Math.max(...visible.flatMap(s => extractY(s)), 1) * 1.1] },
      },
      paper_bgcolor: '#ffffff',
      font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
      showlegend: true,
      autosize: true,
      margin: { t: 60, r: 40, b: 40, l: 40 },
    },
  };
};

/** 瀑布图 */
const buildWaterfall = (
  series: DataSeries[],
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const s = series.find(s => s.visible !== false) || series[0];
  if (!s) return { data: [], layout: baseLayout(title, xLabel, yLabel, aspectRatio) };

  const data: PlotlyTrace[] = [{
    type: 'waterfall',
    name: s.name,
    x: s.data.map(d => d.name),
    y: extractY(s),
    connector: { line: { color: '#94a3b8' } },
    decreasing: { marker: { color: '#ef4444' } },
    increasing: { marker: { color: '#22c55e' } },
    totals: { marker: { color: '#6366f1' } },
    textposition: 'outside',
  }];

  return { data, layout: baseLayout(title, xLabel, yLabel, aspectRatio) };
};

/** 平行坐标图 */
const buildParallel = (
  series: DataSeries[],
  sheet: SpreadsheetSnapshot | undefined,
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  // 每个 series 的 Y 值作为一个维度
  const visible = series.filter(s => s.visible !== false);
  const dimensions = visible.map(s => ({
    label: s.name,
    values: extractY(s),
  }));

  if (dimensions.length === 0) {
    return { data: [], layout: baseLayout(title, xLabel, yLabel, aspectRatio) };
  }

  // 颜色映射到第一个维度的值
  const colorValues = dimensions[0].values;

  const data: PlotlyTrace[] = [{
    type: 'parcoords',
    line: {
      color: colorValues,
      colorscale: 'Viridis',
      showscale: true,
    },
    dimensions,
  }];

  return {
    data,
    layout: {
      title: { text: title, font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' }, x: 0.5 },
      paper_bgcolor: '#ffffff',
      font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
      autosize: true,
      margin: { t: 60, r: 30, b: 30, l: 60 },
    },
  };
};

/** 漏斗图 */
const buildFunnel = (
  series: DataSeries[],
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const s = series.find(s => s.visible !== false) || series[0];
  if (!s) return { data: [], layout: baseLayout(title, xLabel, yLabel, aspectRatio) };

  const data: PlotlyTrace[] = [{
    type: 'funnel',
    name: s.name,
    y: s.data.map(d => d.name),
    x: extractY(s),
    textinfo: 'value+percent initial',
    marker: {
      color: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#94a3b8'],
    },
    connector: { line: { color: '#e2e8f0', width: 2 } },
  }];

  return { data, layout: baseLayout(title, xLabel, yLabel, aspectRatio) };
};

/** 矩形树图 */
const buildTreemap = (
  series: DataSeries[],
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  const s = series.find(s => s.visible !== false) || series[0];
  if (!s) return { data: [], layout: baseLayout(title, xLabel, yLabel, aspectRatio) };

  const labels = s.data.map(d => d.name);
  const values = extractY(s);
  const parents = labels.map(() => '');

  const data: PlotlyTrace[] = [{
    type: 'treemap',
    labels,
    parents,
    values,
    textinfo: 'label+value+percent root',
    marker: { colorscale: 'Viridis', line: { width: 2, color: '#ffffff' } },
    pathbar: { visible: true },
  }];

  return {
    data,
    layout: {
      title: { text: title, font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' }, x: 0.5 },
      paper_bgcolor: '#ffffff',
      font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
      autosize: true,
      margin: { t: 60, r: 10, b: 10, l: 10 },
    },
  };
};

/** 旭日图 */
const buildSunburst = (
  series: DataSeries[],
  title: string,
  xLabel: string,
  yLabel: string,
  aspectRatio: number
): PlotlyAdapterResult => {
  // 多个 series → 分组层级，每个 series 作为一级
  const allLabels: string[] = [];
  const allParents: string[] = [];
  const allValues: number[] = [];

  const visible = series.filter(s => s.visible !== false);

  if (visible.length > 1) {
    // 多系列：series 名作为第一层
    visible.forEach(s => {
      const yVals = extractY(s);
      s.data.forEach((d, i) => {
        allLabels.push(d.name);
        allParents.push(s.name);
        allValues.push(yVals[i] || 0);
      });
      allLabels.push(s.name);
      allParents.push('');
      allValues.push(0); // branch node
    });
  } else {
    // 单系列
    const s = visible[0] || series[0];
    if (s) {
      s.data.forEach(d => {
        allLabels.push(d.name);
        allParents.push('');
        allValues.push(d.value || 0);
      });
    }
  }

  const data: PlotlyTrace[] = [{
    type: 'sunburst',
    labels: allLabels,
    parents: allParents,
    values: allValues,
    branchvalues: 'total',
    textinfo: 'label+percent root',
    marker: { line: { width: 2, color: '#ffffff' } },
  }];

  return {
    data,
    layout: {
      title: { text: title, font: { size: 16, family: 'Inter, system-ui, sans-serif', color: '#1e293b' }, x: 0.5 },
      paper_bgcolor: '#ffffff',
      font: { family: 'Inter, system-ui, sans-serif', color: '#334155' },
      autosize: true,
      margin: { t: 60, r: 10, b: 10, l: 10 },
    },
  };
};

export function adaptToPlotly(
  chartType: string,
  seriesList: DataSeries[],
  spreadsheet: SpreadsheetSnapshot | undefined,
  chartTitle: string,
  xAxisLabel: string,
  yAxisLabel: string,
  aspectRatio: number = 1.33
): PlotlyAdapterResult {
  switch (chartType) {
    case 'violin':
      return buildViolin(seriesList, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'bubble':
      return buildBubble(seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'heatmap':
      return buildHeatmap(seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'contour':
      return buildContour(seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'surface3d':
      return buildSurface3d(seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'ternary':
      return buildTernary(seriesList, spreadsheet, chartTitle);
    case 'polar':
      return buildPolar(seriesList, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'waterfallPlotly':
      return buildWaterfall(seriesList, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'parallel':
      return buildParallel(seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'funnel':
      return buildFunnel(seriesList, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'treemap':
      return buildTreemap(seriesList, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    case 'sunburst':
      return buildSunburst(seriesList, chartTitle, xAxisLabel, yAxisLabel, aspectRatio);
    default:
      // 不应该到达，返回空图
      return { data: [], layout: baseLayout(chartTitle, xAxisLabel, yAxisLabel, aspectRatio) };
  }
}

