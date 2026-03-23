/**
 * PlotlyChart — Plotly.js 渲染组件
 *
 * 在 chartType 为高级类型时替代 Recharts 渲染。
 * 使用 react-plotly.js 懒加载以减少初始 bundle 影响。
 */
import React, { useMemo, forwardRef, Suspense, lazy } from 'react';
import { DataSeries } from '../../types';
import { adaptToPlotly, SpreadsheetSnapshot } from '../../utils/plotlyDataAdapter';

// 懒加载 Plotly（约 3.5MB），仅在高级图表类型激活时加载
const Plot = lazy(() => import('react-plotly.js'));

/** Plotly 支持的高级图表类型 */
export const PLOTLY_CHART_TYPES = [
  'contour', 'heatmap', 'surface3d', 'violin', 'bubble', 'ternary',
  'polar', 'waterfallPlotly', 'parallel', 'funnel', 'treemap', 'sunburst'
] as const;

export type PlotlyChartType = typeof PLOTLY_CHART_TYPES[number];

export const isPlotlyChartType = (type: string): type is PlotlyChartType =>
  PLOTLY_CHART_TYPES.includes(type as PlotlyChartType);

interface PlotlyChartProps {
  chartType: string;
  seriesList: DataSeries[];
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  spreadsheet?: SpreadsheetSnapshot;
  aspectRatio?: number;
}

/**
 * Plotly 图表渲染器
 *
 * 通过 forwardRef 将 ref 传到最外层 div，
 * 使 exportChart 可以截图此区域。
 */
const PlotlyChart = forwardRef<HTMLDivElement, PlotlyChartProps>(({
  chartType,
  seriesList,
  chartTitle,
  xAxisLabel,
  yAxisLabel,
  spreadsheet,
  aspectRatio = 1.33,
}, ref) => {

  const { data, layout } = useMemo(
    () => adaptToPlotly(chartType, seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio),
    [chartType, seriesList, spreadsheet, chartTitle, xAxisLabel, yAxisLabel, aspectRatio]
  );

  const config = useMemo(() => ({
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['sendDataToCloud'] as any[],
    toImageButtonOptions: {
      format: 'png' as const,
      filename: chartTitle || 'SciFlow_Chart',
      width: 1200,
      height: Math.round(1200 / aspectRatio),
      scale: 3, // 高清 3x
    },
  }), [chartTitle, aspectRatio]);

  // 动态高度：基于 aspectRatio 计算
  const heightStyle = useMemo(() => {
    // 使用 CSS 百分比让 Plotly 自适应
    return { width: '100%', height: '100%' };
  }, []);

  return (
    <div
      ref={ref}
      className="lab-chart-responsive w-full h-full bg-white rounded-xl"
      style={{ minHeight: 300 }}
    >
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl">
            <div className="flex flex-col items-center gap-3 animate-pulse">
              <i className="fa-solid fa-chart-pie text-3xl text-indigo-300" />
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                加载 Plotly 渲染引擎...
              </span>
            </div>
          </div>
        }
      >
        <Plot
          data={data}
          layout={{
            ...layout,
            autosize: true,
          }}
          config={config}
          useResizeHandler
          style={heightStyle}
        />
      </Suspense>
    </div>
  );
});

PlotlyChart.displayName = 'PlotlyChart';

export default PlotlyChart;
