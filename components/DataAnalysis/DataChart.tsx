
import React, { RefObject, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  ScatterChart, Scatter, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, Customized
} from 'recharts';
import { DataSeries, ChartAnnotation, AnnotationType } from '../../types';
import { AxisTick } from './Chart/AxisTick';
import { ChartDot } from './Chart/ChartDot';
import { AnnotationOverlay } from './Chart/AnnotationOverlay';
import { DataSelectorOverlay } from './Chart/DataSelectorOverlay';
import LaTeXText from '../Common/LaTeXText';
import { FontTabType } from '../../hooks/useDataAnalysisLogic';
import PlotlyChart, { isPlotlyChartType } from './PlotlyChart';
import { SpreadsheetSnapshot } from '../../utils/plotlyDataAdapter';

interface DataChartProps {
  chartContainerRef: RefObject<HTMLDivElement>;
  /** 子图紧凑模式 — 去掉 min-height/padding/title/margin */
  subplotMode?: boolean;
  seriesList: DataSeries[];
  chartType: 'line' | 'bar' | 'scatter' | 'area' | 'box' | 'histogram' | 'contour' | 'heatmap' | 'surface3d' | 'violin' | 'bubble' | 'ternary' | 'polar' | 'waterfallPlotly' | 'parallel' | 'funnel' | 'treemap' | 'sunburst';
  mainColor: string;
  strokeWidth: number;
  fontSize: number;
  axisLabelFontSize?: number;
  pointShape: 'circle' | 'sphere' | 'square' | 'diamond' | 'triangleUp' | 'triangleDown' | 'cross' | 'star' | 'none';
  pointSize: number;
  xAxisLabel: string;
  setXAxisLabel: (v: string) => void;
  yAxisLabel: string;
  setYAxisLabel: (v: string) => void;
  chartTitle: string;
  setChartTitle: (v: string) => void;

  annotations: ChartAnnotation[];
  activeTool: AnnotationType | 'select' | 'data-selector' | 'none';
  onAddAnnotation: (ann: ChartAnnotation) => void;
  onUpdateAnnotation: (id: string, updates: Partial<ChartAnnotation>) => void;
  onDeleteAnnotation?: (id: string) => void;
  onOverrideAnnotation?: (id: string, updates: Partial<ChartAnnotation>) => void;
  onRemoveAnnotation: (id: string) => void;
  onSetActiveTool: (tool: any) => void;

  legendPos: { x: number, y: number };
  setLegendPos: (pos: { x: number, y: number }) => void;
  editingSeriesId: string | null;
  setEditingSeriesId: (id: string | null) => void;
  updateSeries: (id: string, updates: Partial<DataSeries>) => void;
  aspectRatio: number;
  xLabelPos: { x: number, y: number };
  setXLabelPos: (pos: { x: number, y: number }) => void;
  yLabelPos: { x: number, y: number };
  setYLabelPos: (pos: { x: number, y: number }) => void;
  titlePos: { x: number, y: number };
  setTitlePos: (pos: { x: number, y: number }) => void;
  xDomain: [any, any];
  yDomain: [any, any];
  xScale?: 'auto' | 'log';
  setXScale?: (v: 'auto' | 'log') => void;
  yScale?: 'auto' | 'log';
  setYScale?: (v: 'auto' | 'log') => void;
  gridX: boolean;
  setGridX?: (v: boolean) => void;
  gridY: boolean;
  setGridY?: (v: boolean) => void;
  gridLineWidth?: number;
  axisLineWidth: number;
  axisColor: string;
  axisBox?: boolean;
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
  showMirroredTicks?: boolean;

  onOpenAxisSettings?: (tab: FontTabType) => void;
  yZoom?: number;
  onYZoomChange?: (v: number) => void;
  setXDomain?: (d: [any,any]) => void;
  setYDomain?: (d: [any,any]) => void;
  autoFitDomains?: () => void;
  spreadsheet?: SpreadsheetSnapshot;

  // 数据选择器回调
  onExtractSelection?: (xMin: number, xMax: number) => void;
  onClipSelection?: (xMin: number, xMax: number) => void;
  onDeleteSelection?: (xMin: number, xMax: number) => void;

  rightYAxisLabel?: string;
  rightYDomain?: [any, any];
  setRightYDomain?: (d: [any, any]) => void;
  rightYScale?: 'auto' | 'log';
  setRightYScale?: (v: 'auto' | 'log') => void;
  rightYTickCount?: number;
  setRightYTickCount?: (v: number) => void;
  hasRightAxisSeries?: boolean;
  rightYLabelPos?: { x: number, y: number };
  setRightYLabelPos?: (pos: { x: number, y: number }) => void;
  rightYAxisDivision?: number;
  rightYAxisColor?: string;
}

const generateUniformTicks = (domain: [any, any], count: number) => {
  const min = domain[0];
  const max = domain[1];
  if (typeof min !== 'number' || typeof max !== 'number' || count < 2) return undefined;

  const ticks = [];
  const step = (max - min) / (count - 1);
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      ticks.push(max);
    } else {
      ticks.push(Number((min + i * step).toFixed(10)));
    }
  }
  return ticks;
};

const CustomErrorBar = (props: any) => {
  const { x, y, high, low, errorBarType, stroke, strokeWidth, lineCapWidth } = props;
  if (high === undefined || y === undefined) return null;
  const hw = (lineCapWidth || 4) / 2;
  const topY = high;
  const bottomY = (errorBarType === 'both' && low !== undefined) ? low : y;
  return (
    <g className="custom-error-bar-layer">
      <line x1={x} y1={topY} x2={x} y2={bottomY} stroke={stroke} strokeWidth={strokeWidth} shapeRendering="geometricPrecision" />
      <line x1={x - hw} y1={topY} x2={x + hw} y2={topY} stroke={stroke} strokeWidth={strokeWidth} shapeRendering="geometricPrecision" />
      {errorBarType === 'both' && low !== undefined && (
        <line x1={x - hw} y1={bottomY} x2={x + hw} y2={bottomY} stroke={stroke} strokeWidth={strokeWidth} shapeRendering="geometricPrecision" />
      )}
    </g>
  );
};

const DataChart: React.FC<DataChartProps> = ({
  chartContainerRef, subplotMode, seriesList, chartType, mainColor, strokeWidth, fontSize,
  axisLabelFontSize = 20,
  pointShape, pointSize, xAxisLabel, setXAxisLabel, yAxisLabel, setYAxisLabel, chartTitle, setChartTitle,
  annotations = [], activeTool, onAddAnnotation, onUpdateAnnotation, onRemoveAnnotation, onSetActiveTool,
  legendPos, setLegendPos, editingSeriesId, setEditingSeriesId, updateSeries,
  aspectRatio, xLabelPos, setXLabelPos, yLabelPos, setYLabelPos, titlePos, setTitlePos,
  xDomain, yDomain, xScale = 'auto', yScale = 'auto', yZoom = 1.0, onYZoomChange,
  gridX, gridY, gridLineWidth = 1.0, axisLineWidth, axisColor, axisBox, tickFontSize, tickSize, tickWidth, xTickCount, yTickCount,
  xAxisDivision, yAxisDivision,
  labelFontFamily, labelFontWeight, labelFontStyle,
  titleFontFamily, titleFontWeight, titleFontStyle,
  tickFontFamily, tickFontWeight, tickFontStyle,
  legendFontFamily, legendFontWeight, legendFontStyle, legendFontSize,
  legendBorderVisible, legendBorderColor, legendBorderWidth,
  showXTicks, showYTicks, showMirroredTicks = false,
  onOpenAxisSettings,
  setXDomain: propSetXDomain, setYDomain: propSetYDomain, autoFitDomains,
  spreadsheet,
  onExtractSelection, onClipSelection, onDeleteSelection,
  rightYAxisLabel = '',
  rightYDomain: propRightYDomain = ['auto', 'auto'],
  rightYScale = 'auto',
  rightYTickCount = 5,
  rightYLabelPos = { x: 0, y: 0 },
  setRightYLabelPos,
  rightYAxisDivision = 2,
  rightYAxisColor = '#334155'
}) => {
  const [dragTarget, setDragTarget] = useState<'legend' | 'xlabel' | 'ylabel' | 'rylabel' | 'title' | null>(null);
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const rafId = useRef<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [panStart, setPanStart] = useState<{x:number,y:number,xd:[number,number],yd:[number,number]}|null>(null);

  // ── 数据选择器 chart offset 追踪 ──
  const [chartOffsetState, setChartOffsetState] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const chartOffsetRef = useRef(chartOffsetState);
  const updateChartOffset = useCallback((offset: any) => {
    if (!offset) return;
    const next = { left: offset.left, top: offset.top, width: offset.width, height: offset.height };
    const prev = chartOffsetRef.current;
    if (!prev || prev.left !== next.left || prev.top !== next.top || prev.width !== next.width || prev.height !== next.height) {
      chartOffsetRef.current = next;
      setChartOffsetState(next);
    }
  }, []);

  // ── 交互式缩放 (Ctrl/⌘+滚轮 或 触控板捏合) ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // 只在 Ctrl/⌘ 按下时缩放（Mac 触控板捏合会自动设置 ctrlKey）
    // 普通双指滑动不触发，避免图表跑掉
    if (!e.ctrlKey && !e.metaKey) return;
    if (!propSetXDomain || !propSetYDomain) return;
    e.preventDefault();
    const numXMin = typeof xDomain[0] === 'number' ? xDomain[0] : 0;
    const numXMax = typeof xDomain[1] === 'number' ? xDomain[1] : 100;
    const numYMin = typeof yDomain[0] === 'number' ? yDomain[0] : 0;
    const numYMax = typeof yDomain[1] === 'number' ? yDomain[1] : 100;
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const xCenter = (numXMin + numXMax) / 2;
    const yCenter = (numYMin + numYMax) / 2;
    const newXHalf = ((numXMax - numXMin) / 2) * factor;
    const newYHalf = ((numYMax - numYMin) / 2) * factor;
    propSetXDomain([xCenter - newXHalf, xCenter + newXHalf]);
    propSetYDomain([yCenter - newYHalf, yCenter + newYHalf]);
    setIsZoomed(true);
  }, [xDomain, yDomain, propSetXDomain, propSetYDomain]);

  // ── 交互式平移 (Shift+拖拽) ──
  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.shiftKey || !propSetXDomain || !propSetYDomain) return;
    e.preventDefault();
    const numXMin = typeof xDomain[0] === 'number' ? xDomain[0] : 0;
    const numXMax = typeof xDomain[1] === 'number' ? xDomain[1] : 100;
    const numYMin = typeof yDomain[0] === 'number' ? yDomain[0] : 0;
    const numYMax = typeof yDomain[1] === 'number' ? yDomain[1] : 100;
    setPanStart({ x: e.clientX, y: e.clientY, xd: [numXMin, numXMax], yd: [numYMin, numYMax] });
  }, [xDomain, yDomain, propSetXDomain, propSetYDomain]);

  useEffect(() => {
    if (!panStart || !propSetXDomain || !propSetYDomain) return;
    const handleMove = (e: MouseEvent) => {
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - panStart.x) / rect.width;
      const dy = (e.clientY - panStart.y) / rect.height;
      const xRange = panStart.xd[1] - panStart.xd[0];
      const yRange = panStart.yd[1] - panStart.yd[0];
      propSetXDomain([panStart.xd[0] - dx * xRange, panStart.xd[1] - dx * xRange]);
      propSetYDomain([panStart.yd[0] + dy * yRange, panStart.yd[1] + dy * yRange]);
    };
    const handleUp = () => setPanStart(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [panStart, propSetXDomain, propSetYDomain]);


  const xTicks = useMemo(() => xScale === 'log' ? undefined : generateUniformTicks(xDomain, xTickCount), [xDomain, xTickCount, xScale]);
  const yTicks = useMemo(() => yScale === 'log' ? undefined : generateUniformTicks(yDomain, yTickCount), [yDomain, yTickCount, yScale]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragTarget) return;
      if (rafId.current) cancelAnimationFrame(rafId.current);

      rafId.current = requestAnimationFrame(() => {
        const newPos = {
          x: (e.clientX - dragStartPos.current.x) / scaleRef.current,
          y: (e.clientY - dragStartPos.current.y) / scaleRef.current
        };
        if (dragTarget === 'legend') setLegendPos(newPos);
        else if (dragTarget === 'xlabel') setXAxisLabelPos(newPos);
        else if (dragTarget === 'ylabel') setYAxisLabelPos(newPos);
        else if (dragTarget === 'rylabel') setRightYLabelPos?.(newPos);
        else if (dragTarget === 'title') setTitlePos(newPos);
      });
    };

    const handleUp = () => {
      setDragTarget(null);
      document.body.style.cursor = '';
      document.body.classList.remove('dragging-active');
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };

    if (dragTarget) {
      document.body.style.cursor = 'grabbing';
      document.body.classList.add('dragging-active');
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [dragTarget, setLegendPos, setXLabelPos, setYLabelPos, setTitlePos, setRightYLabelPos]);

  // 映射 setter
  const setXAxisLabelPos = setXLabelPos;
  const setYAxisLabelPos = setYLabelPos;

  const handleDragMouseDown = (e: React.MouseEvent, target: 'legend' | 'xlabel' | 'ylabel' | 'rylabel' | 'title') => {
    if (e.button !== 0 || inlineEditingKey) return;
    e.stopPropagation();

    const responsiveEl = chartContainerRef.current?.querySelector('.lab-chart-responsive');
    if (responsiveEl) {
      const rect = responsiveEl.getBoundingClientRect();
      scaleRef.current = rect.width / (responsiveEl as HTMLElement).offsetWidth;
    } else {
      scaleRef.current = 1;
    }

    const currentPos = target === 'legend' ? legendPos : target === 'xlabel' ? xLabelPos : target === 'ylabel' ? yLabelPos : titlePos;
    dragStartPos.current = {
      x: e.clientX - (currentPos.x * scaleRef.current),
      y: e.clientY - (currentPos.y * scaleRef.current)
    };
    setDragTarget(target);
  };

  const visibleSeries = useMemo(() => seriesList.filter(s => s.visible).map(s => {
    let cleanData = s.data.map(d => ({
      ...d,
      displayX: parseFloat(d.name),
      displayY: d.value,
      displayError: (d.error || 0)
    }));
    if (xScale === 'log') cleanData = cleanData.filter(d => d.displayX > 0);
    if (yScale === 'log') cleanData = cleanData.filter(d => d.displayY > 0);
    return { ...s, data: cleanData };
  }), [seriesList, xScale, yScale]);

  // ── 双Y轴检测 ──
  const hasRightAxis = useMemo(() => visibleSeries.some(s => s.yAxisId === 'right'), [visibleSeries]);

  // 右轴独立 domain 计算（外部可覆盖）
  const rightYDomainComputed = useMemo<[number, number]>(() => {
    if (!hasRightAxis) return [0, 1];
    const rightVals = visibleSeries
      .filter(s => s.yAxisId === 'right')
      .flatMap(s => s.data.map((d: any) => d.displayY))
      .filter(v => !isNaN(v));
    if (rightVals.length === 0) return [0, 1];
    const min = Math.min(...rightVals);
    const max = Math.max(...rightVals);
    const padding = (max - min) * 0.05 || 0.5;
    return [min - padding, max + padding];
  }, [hasRightAxis, visibleSeries]);

  // 合并外部设定与自动计算
  const rightYDomain = useMemo<[any, any]>(() => {
    const pMin = propRightYDomain[0];
    const pMax = propRightYDomain[1];
    return [
      pMin === 'auto' || pMin === undefined ? rightYDomainComputed[0] : pMin,
      pMax === 'auto' || pMax === undefined ? rightYDomainComputed[1] : pMax
    ];
  }, [propRightYDomain, rightYDomainComputed]);

  const rightYTicks = useMemo(() => {
    if (!hasRightAxis) return undefined;
    return generateUniformTicks(rightYDomain, rightYTickCount);
  }, [hasRightAxis, rightYDomain, rightYTickCount]);

  // ── 箱线图数据计算 ──
  const boxPlotData = useMemo(() => {
    if (chartType !== 'box') return [];
    return visibleSeries.map(s => {
      const vals = s.data.map((d: any) => d.displayY).filter((v: number) => !isNaN(v)).sort((a: number, b: number) => a - b);
      if (vals.length === 0) return null;
      const n = vals.length;
      const q1 = vals[Math.floor(n * 0.25)];
      const median = n % 2 === 0 ? (vals[n/2-1] + vals[n/2]) / 2 : vals[Math.floor(n/2)];
      const q3 = vals[Math.floor(n * 0.75)];
      const iqr = q3 - q1;
      const whiskerLow = Math.max(vals[0], q1 - 1.5 * iqr);
      const whiskerHigh = Math.min(vals[n-1], q3 + 1.5 * iqr);
      const outliers = vals.filter((v: number) => v < whiskerLow || v > whiskerHigh);
      return { id: s.id, name: s.name, color: s.color || mainColor, q1, median, q3, whiskerLow, whiskerHigh, outliers, min: vals[0], max: vals[n-1] };
    }).filter(Boolean);
  }, [visibleSeries, chartType, mainColor]);

  // ── 直方图数据计算 ──
  const histogramData = useMemo(() => {
    if (chartType !== 'histogram') return { bins: [], series: [] };
    const allVals = visibleSeries.flatMap(s => s.data.map((d: any) => d.displayY).filter((v: number) => !isNaN(v)));
    if (allVals.length === 0) return { bins: [], series: [] };
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const binCount = Math.max(5, Math.min(30, Math.ceil(Math.sqrt(allVals.length))));
    const binWidth = (max - min) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      binStart: min + i * binWidth,
      binEnd: min + (i + 1) * binWidth,
      binCenter: min + (i + 0.5) * binWidth,
    }));
    const seriesHistData = visibleSeries.map(s => {
      const vals = s.data.map((d: any) => d.displayY).filter((v: number) => !isNaN(v));
      const counts = new Array(binCount).fill(0);
      vals.forEach((v: number) => {
        const idx = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
        counts[idx]++;
      });
      return { id: s.id, name: s.name, color: s.color || mainColor, counts };
    });
    const merged = bins.map((bin, i) => {
      const entry: any = { displayX: parseFloat(bin.binCenter.toFixed(4)) };
      seriesHistData.forEach(s => { entry[s.id] = s.counts[i]; });
      return entry;
    });
    return { bins: merged, series: seriesHistData };
  }, [visibleSeries, chartType, mainColor]);

  // 动态调整 margin，针对负值较大的情况增加底部空间
  // 注意：必须在 visibleSeries 定义之后才能使用
  const chartMargin = useMemo(() => {
    const baseMargin = subplotMode
      ? { top: 10, right: 15, left: 45, bottom: 30 }
      : { top: 30, right: 40, left: 80, bottom: 60 };
    const hasNegativeData = visibleSeries.some(s =>
      s.data.some((d: any) => d.displayY < 0)
    );
    if (hasNegativeData) {
      return { ...baseMargin, bottom: baseMargin.bottom + 20 };
    }
    return baseMargin;
  }, [visibleSeries, subplotMode]);

  const mergedBarData = useMemo(() => {
    if (chartType !== 'bar' || visibleSeries.length === 0) return [];
    const dataMap = new Map<number, any>();
    visibleSeries.forEach(s => {
      s.data.forEach(d => {
        if (!dataMap.has(d.displayX)) dataMap.set(d.displayX, { displayX: d.displayX });
        const entry = dataMap.get(d.displayX);
        entry[s.id] = d.displayY;
        entry[`${s.id}_err`] = d.displayError;
      });
    });
    return Array.from(dataMap.values()).sort((a, b) => a.displayX - b.displayX);
  }, [visibleSeries, chartType]);

  const renderChart = () => {
    const margin = chartMargin;
    const axisLineConfig = {
      stroke: axisColor,
      strokeWidth: axisLineWidth
    };

    const commonX = (
      <XAxis
        dataKey="displayX"
        type="number"
        scale={xScale === 'log' ? 'log' : 'auto'}
        fontSize={fontSize}
        height={subplotMode ? 25 : 40}
        axisLine={axisLineConfig}
        domain={xScale === 'log' ? ['dataMin', 'dataMax'] : xDomain}
        ticks={xTicks}
        interval={0}
        tickLine={false}
        tickMargin={0}
        tickSize={0}
        tick={showXTicks ? (props: any) => (
          <AxisTick
            {...props} axis="x" division={xAxisDivision} color={axisColor} fontSize={tickFontSize}
            tickSize={tickSize} tickWidth={tickWidth} axisLineWidth={axisLineWidth}
            fontWeight={tickFontWeight} fontStyle={tickFontStyle} fontFamily={tickFontFamily}
            isLog={xScale === 'log'}
            onDoubleClick={() => onOpenAxisSettings?.('tick')}
          />
        ) : false}
        allowDataOverflow={true}
      />
    );

    const commonY = (
      <YAxis
        {...(hasRightAxis ? { yAxisId: 'left' } : {})}
        type="number"
        scale={yScale === 'log' ? 'log' : 'auto'}
        fontSize={fontSize}
        axisLine={axisLineConfig}
        domain={yScale === 'log' ? ['dataMin', 'dataMax'] : yDomain}
        ticks={yTicks}
        interval={0}
        tickLine={false}
        tickMargin={0}
        tickSize={0}
        tick={showYTicks ? (props: any) => (
          <AxisTick
            {...props} axis="y" division={yAxisDivision} color={axisColor} fontSize={tickFontSize}
            tickSize={tickSize} tickWidth={tickWidth} axisLineWidth={axisLineWidth}
            fontWeight={tickFontWeight} fontStyle={tickFontStyle} fontFamily={tickFontFamily}
            isLog={yScale === 'log'}
            onDoubleClick={() => onOpenAxisSettings?.('tick')}
          />
        ) : false}
        allowDataOverflow={true}
        width={subplotMode ? 40 : 70}
      />
    );

    // ── 独立右 Y 轴 ──
    const dualRightYAxis = hasRightAxis ? (
      <YAxis
        yAxisId="right"
        orientation="right"
        type="number"
        scale={rightYScale === 'log' ? 'log' : 'auto'}
        fontSize={fontSize}
        axisLine={{ stroke: rightYAxisColor, strokeWidth: axisLineWidth }}
        domain={rightYScale === 'log' ? ['dataMin', 'dataMax'] : rightYDomain}
        ticks={rightYTicks}
        interval={0}
        tickLine={false}
        tickMargin={0}
        tickSize={0}
        tick={showYTicks ? (props: any) => (
          <AxisTick
            {...props} axis="y" isMirror={true} division={rightYAxisDivision} color={rightYAxisColor} fontSize={tickFontSize}
            tickSize={tickSize} tickWidth={tickWidth} axisLineWidth={axisLineWidth}
            fontWeight={tickFontWeight} fontStyle={tickFontStyle} fontFamily={tickFontFamily}
            isLog={rightYScale === 'log'}
            onDoubleClick={() => onOpenAxisSettings?.('tick')}
          />
        ) : false}
        allowDataOverflow={true}
        width={70}
      />
    ) : null;

    // ── 自定义 Tooltip（双轴模式时区分左右轴系列） ──
    const chartTooltip = (
      <Tooltip
        content={({ active, payload, label }: any) => {
          if (!active || !payload || payload.length === 0) return null;
          return (
            <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 shadow-xl text-[10px]">
              <p className="font-black text-slate-500 mb-1">X: {typeof label === 'number' ? label.toPrecision(6) : label}</p>
              {payload.map((entry: any, idx: number) => {
                const matchSeries = visibleSeries.find(s => s.name === entry.name || s.id === entry.dataKey?.replace?.('_displayY', ''));
                const axisTag = matchSeries?.yAxisId === 'right' ? ' (右轴)' : hasRightAxis ? ' (左轴)' : '';
                return (
                  <p key={idx} className="font-bold" style={{ color: entry.color }}>
                    {entry.name}{axisTag}: {typeof entry.value === 'number' ? entry.value.toPrecision(6) : entry.value}
                  </p>
                );
              })}
            </div>
          );
        }}
      />
    );

    const topBoxAxis = (
      <XAxis
        orientation="top"
        xAxisId="boxTop"
        height={20}
        scale={xScale === 'log' ? 'log' : 'auto'}
        axisLine={axisBox ? axisLineConfig : false}
        domain={xScale === 'log' ? ['dataMin', 'dataMax'] : xDomain}
        ticks={xTicks}
        interval={0}
        tickLine={false}
        tickMargin={0}
        tickSize={0}
        tick={showMirroredTicks && axisBox ? (props: any) => <AxisTick {...props} axis="x" isMirror={true} division={xAxisDivision} color={axisColor} fontSize={tickFontSize} tickSize={tickSize} tickWidth={tickWidth} axisLineWidth={axisLineWidth} fontWeight={tickFontWeight} fontStyle={tickFontStyle} fontFamily={tickFontFamily} isLog={xScale === 'log'} onDoubleClick={() => onOpenAxisSettings?.('tick')} /> : false}
      />
    );

    const rightBoxAxis = hasRightAxis ? null : (
      <YAxis
        orientation="right"
        yAxisId="boxRight"
        width={35}
        scale={yScale === 'log' ? 'log' : 'auto'}
        axisLine={axisBox ? axisLineConfig : false}
        domain={yScale === 'log' ? ['dataMin', 'dataMax'] : yDomain}
        ticks={yTicks}
        interval={0}
        tickLine={false}
        tickMargin={0}
        tickSize={0}
        tick={showMirroredTicks && axisBox ? (props: any) => <AxisTick {...props} axis="y" isMirror={true} division={yAxisDivision} color={axisColor} fontSize={tickFontSize} tickSize={tickSize} tickWidth={tickWidth} axisLineWidth={axisLineWidth} fontWeight={tickFontWeight} fontStyle={tickFontStyle} fontFamily={tickFontFamily} isLog={yScale === 'log'} onDoubleClick={() => onOpenAxisSettings?.('tick')} /> : false}
      />
    );

    const gridProps = {
      strokeDasharray: "3 3",
      horizontal: gridY,
      vertical: gridX,
      stroke: "#cbd5e1",
      strokeWidth: gridLineWidth
    };

    const boxBorderOverlay = axisBox ? (
      <Customized component={(props: any) => {
        const { offset } = props;
        if (!offset) return null;
        updateChartOffset(offset);
        const { left, top, width, height } = offset;
        return (
          <g className="axis-box-overlay">
            <line x1={left + width} y1={top} x2={left + width} y2={top + height} stroke={axisColor} strokeWidth={axisLineWidth} />
            <line x1={left} y1={top} x2={left + width} y2={top} stroke={axisColor} strokeWidth={axisLineWidth} />
          </g>
        );
      }} />
    ) : (
      <Customized component={(props: any) => {
        const { offset } = props;
        if (offset) updateChartOffset(offset);
        return null;
      }} />
    );

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={mergedBarData} margin={margin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {dualRightYAxis}
            {topBoxAxis}
            {rightBoxAxis}
            {chartTooltip}
            {visibleSeries.map(s => (
              <Bar
                key={s.id}
                dataKey={s.id}
                fill={s.color || mainColor}
                fillOpacity={0.9}
                radius={0}
                barSize={(s.strokeWidth || strokeWidth || 3.0) * 8}
                name={s.name}
                isAnimationActive={false}
                {...(hasRightAxis ? { yAxisId: s.yAxisId === 'right' ? 'right' : 'left' } : {})}
                onDoubleClick={(e: any) => { e?.stopPropagation?.(); setEditingSeriesId(s.id); }}
              >
                {s.showErrorBar !== false && (
                  <ErrorBar
                    key={`err-${s.id}`}
                    dataKey={`${s.id}_err`}
                    width={s.errorBarWidth || 4}
                    strokeWidth={s.errorBarStrokeWidth || 1.5}
                    stroke={s.errorBarColor || s.color || mainColor}
                    strokeOpacity={0.8}
                    {...({
                      content: (props: any) => {
                        const { key, ...rest } = props;
                        return <CustomErrorBar key={key} {...rest} errorBarType={s.errorBarType || 'both'} lineCapWidth={s.errorBarWidth || 4} strokeWidth={s.errorBarStrokeWidth || 1.5} />;
                      }
                    } as any)}
                  />
                )}
              </Bar>
            ))}

            {boxBorderOverlay}
          </BarChart>
        );
      case 'scatter':
        return (
          <ScatterChart margin={margin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {dualRightYAxis}
            {topBoxAxis}
            {rightBoxAxis}
            {chartTooltip}
            {visibleSeries.map(s => (
              <Scatter
                key={s.id}
                data={s.data}
                dataKey="displayY"
                fill={s.color || mainColor}
                name={s.name}
                {...(hasRightAxis ? { yAxisId: s.yAxisId === 'right' ? 'right' : 'left' } : {})}
                shape={(props: any) => {
                  const { key, ...rest } = props;
                  return <ChartDot key={key} {...rest} pointShape={s.pointShape || pointShape} pointColor={s.pointColor || s.color || mainColor} pointSize={s.pointSize || pointSize || 5} onDoubleClick={() => setEditingSeriesId(s.id)} />;
                }}
                onDoubleClick={() => setEditingSeriesId(s.id)}
              />
            ))}

            {boxBorderOverlay}
          </ScatterChart>
        );
      case 'area':
        return (
          <AreaChart margin={margin}>
            <defs>
              {visibleSeries.map(s => (
                <linearGradient key={`grad-${s.id}`} id={`areaGrad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color || mainColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={s.color || mainColor} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {dualRightYAxis}
            {topBoxAxis}
            {rightBoxAxis}
            {chartTooltip}
            {visibleSeries.map(s => (
              <Area
                key={s.id}
                data={s.data}
                type="monotone"
                dataKey="displayY"
                stroke={s.color || mainColor}
                strokeWidth={s.strokeWidth || strokeWidth}
                fill={`url(#areaGrad-${s.id})`}
                fillOpacity={1}
                {...(hasRightAxis ? { yAxisId: s.yAxisId === 'right' ? 'right' : 'left' } : {})}
                dot={(props: any) => {
                  const { key, ...rest } = props;
                  return <ChartDot key={key} {...rest} pointShape={s.pointShape || pointShape} pointColor={s.pointColor || s.color || mainColor} pointSize={s.pointSize || pointSize || 4} onDoubleClick={() => setEditingSeriesId(s.id)} />;
                }}
                name={s.name}
                isAnimationActive={false}
              />
            ))}
            {boxBorderOverlay}
          </AreaChart>
        );
      case 'box': {
        // 自绘 SVG 箱线图
        const bpMargin = margin;
        const boxWidth = Math.max(30, Math.min(80, 200 / (boxPlotData.length || 1)));
        return (
          <BarChart data={[{ displayX: 0 }]} margin={bpMargin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {topBoxAxis}
            {rightBoxAxis}
            <Customized component={(props: any) => {
              const { offset } = props;
              if (!offset || boxPlotData.length === 0) return null;
              const { left, top, width, height } = offset;
              const allMin = Math.min(...boxPlotData.map((b: any) => b.whiskerLow));
              const allMax = Math.max(...boxPlotData.map((b: any) => b.whiskerHigh));
              const yRange = allMax - allMin || 1;
              const toY = (v: number) => top + height - ((v - allMin) / yRange) * height;
              const spacing = width / (boxPlotData.length + 1);
              return (
                <g>
                  {boxPlotData.map((b: any, i: number) => {
                    const cx = left + spacing * (i + 1);
                    const hw = boxWidth / 2;
                    return (
                      <g key={b.id}>
                        {/* Whisker line */}
                        <line x1={cx} y1={toY(b.whiskerHigh)} x2={cx} y2={toY(b.whiskerLow)} stroke={b.color} strokeWidth={1.5} />
                        {/* Whisker caps */}
                        <line x1={cx - hw*0.5} y1={toY(b.whiskerHigh)} x2={cx + hw*0.5} y2={toY(b.whiskerHigh)} stroke={b.color} strokeWidth={1.5} />
                        <line x1={cx - hw*0.5} y1={toY(b.whiskerLow)} x2={cx + hw*0.5} y2={toY(b.whiskerLow)} stroke={b.color} strokeWidth={1.5} />
                        {/* Box */}
                        <rect x={cx - hw} y={toY(b.q3)} width={boxWidth} height={Math.abs(toY(b.q1) - toY(b.q3))} fill={b.color} fillOpacity={0.15} stroke={b.color} strokeWidth={1.5} rx={2} />
                        {/* Median line */}
                        <line x1={cx - hw} y1={toY(b.median)} x2={cx + hw} y2={toY(b.median)} stroke={b.color} strokeWidth={2.5} />
                        {/* Outliers */}
                        {b.outliers.map((o: number, oi: number) => (
                          <circle key={oi} cx={cx} cy={toY(o)} r={3} fill="none" stroke={b.color} strokeWidth={1.2} />
                        ))}
                        {/* Name label */}
                        <text x={cx} y={top + height + 18} textAnchor="middle" fontSize={10} fill={axisColor} fontWeight="bold">{b.name}</text>
                      </g>
                    );
                  })}
                </g>
              );
            }} />
            {boxBorderOverlay}
          </BarChart>
        );
      }
      case 'histogram':
        return (
          <BarChart data={histogramData.bins} margin={margin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {topBoxAxis}
            {rightBoxAxis}
            {histogramData.series.map((s: any) => (
              <Bar
                key={s.id}
                dataKey={s.id}
                fill={s.color}
                fillOpacity={0.7}
                stroke={s.color}
                strokeWidth={0.5}
                name={s.name}
                isAnimationActive={false}
              />
            ))}
            {boxBorderOverlay}
          </BarChart>
        );
      default:
        return (
          <LineChart margin={hasRightAxis ? { ...margin, right: 80 } : margin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {dualRightYAxis}
            {topBoxAxis}
            {rightBoxAxis}
            {chartTooltip}
            {visibleSeries.map(s => (
              <Line
                key={s.id}
                data={s.data}
                type="monotone"
                dataKey="displayY"
                stroke={s.color || mainColor}
                strokeWidth={s.strokeWidth || strokeWidth}
                {...(hasRightAxis ? { yAxisId: s.yAxisId === 'right' ? 'right' : 'left' } : {})}
                dot={(props: any) => {
                  const { key, ...rest } = props;
                  return <ChartDot key={key} {...rest} pointShape={s.pointShape || pointShape} pointColor={s.pointColor || s.color || mainColor} pointSize={s.pointSize || pointSize || 4} onDoubleClick={() => setEditingSeriesId(s.id)} />;
                }}
                name={s.name}
                isAnimationActive={false}
                onDoubleClick={(e: any) => { e?.stopPropagation?.(); setEditingSeriesId(s.id); }}
              />
            ))}

            {boxBorderOverlay}
          </LineChart>
        );
    }
  };

  const xAxisCenterOffset = (chartMargin.left - chartMargin.right) / 2;
  const yAxisCenterOffset = (chartMargin.top - chartMargin.bottom) / 2;
  const xAxisDynamicLift = chartMargin.bottom - tickFontSize - 20;
  const yAxisBaseline = chartMargin.left - (tickFontSize * 0.7) + 5;

  return (
    <div
      ref={chartContainerRef}
      className={`lab-chart-container flex flex-col relative h-full outline-none select-none focus:outline-none ${subplotMode ? 'p-1' : 'p-6 min-h-[400px]'}`}
      onWheel={handleWheel}
      onMouseDown={handlePanMouseDown}
    >
      {/* 核心修正：在高清晰度导出时，确保 SVG 渲染保持最佳精度 */}
      <style>{`
        .recharts-wrapper, .recharts-surface { outline: none !important; }
        .lab-chart-container svg { shape-rendering: geometricPrecision !important; }
        .lab-chart-container *:focus { outline: none !important; }
        .lab-chart-responsive *:focus { outline: none !important; }
      `}</style>

      <div className={`flex-1 flex overflow-hidden min-h-0 ${subplotMode ? '' : 'items-center justify-center'}`}>
        <div className="lab-chart-responsive w-full mx-auto relative flex flex-col outline-none focus:outline-none" style={subplotMode ? { maxHeight: '100%', height: '100%' } : { aspectRatio: `${aspectRatio}`, maxHeight: '100%' }}>

          {/* ── Plotly 高级图表分流 ── */}
          {isPlotlyChartType(chartType) ? (
            <PlotlyChart
              ref={chartContainerRef}
              chartType={chartType}
              seriesList={seriesList}
              chartTitle={chartTitle}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
              spreadsheet={spreadsheet}
              aspectRatio={aspectRatio}
            />
          ) : (
          <>

          {!subplotMode && <div
            className={`lab-chart-title-wrap mb-0.5 text-center shrink-0 absolute left-1/2 top-10 z-[60] transition-opacity ${dragTarget === 'title' ? 'opacity-70' : 'opacity-100'}`}
            style={{
              transform: `translate(-50%, -50%) translate3d(${titlePos.x + xAxisCenterOffset}px, ${titlePos.y}px, 0)`,
              willChange: 'transform',
              pointerEvents: 'auto'
            }}
            onMouseDown={(e) => handleDragMouseDown(e, 'title')}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingSeriesId(null);
              setInlineEditingKey('title');
              onOpenAxisSettings?.('title');
            }}
          >
            {inlineEditingKey === 'title' ? (
              <input
                autoFocus
                className="bg-slate-50 border-2 border-indigo-400 rounded-lg px-4 py-1 text-lg font-black text-slate-800 uppercase italic shadow-xl outline-none"
                style={{
                  fontSize: `${axisLabelFontSize + 2}px`,
                  fontFamily: titleFontFamily,
                  width: `${Math.max(chartTitle.length * 15, 200)}px`
                }}
                value={chartTitle}
                onChange={e => setChartTitle(e.target.value)}
                onBlur={() => setInlineEditingKey(null)}
                onKeyDown={e => e.key === 'Enter' && setInlineEditingKey(null)}
              />
            ) : (
              <div
                className="lab-chart-title text-lg font-black text-slate-800 uppercase italic cursor-grab active:cursor-grabbing hover:bg-indigo-50 hover:text-indigo-600 transition-colors inline-block px-6 py-1 rounded-lg select-none outline-none"
                style={{
                  fontSize: `${axisLabelFontSize + 2}px`,
                  fontFamily: titleFontFamily,
                  fontWeight: titleFontWeight,
                  fontStyle: titleFontStyle
                }}
                onMouseDown={(e) => handleDragMouseDown(e, 'title')}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingSeriesId(null);
                  setInlineEditingKey('title');
                  onOpenAxisSettings?.('title');
                }}
              >
                <LaTeXText text={chartTitle} />
              </div>
            )}
          </div>}

          <div className={`flex-1 relative min-h-0 outline-none focus:outline-none ${subplotMode ? 'mt-0' : 'mt-12'}`}>
            {!subplotMode && visibleSeries.length > 0 && (
              <div
                className={`absolute z-[60] cursor-grab flex flex-col gap-1.5 p-2.5 select-none rounded-xl outline-none focus:outline-none ${dragTarget === 'legend' ? 'opacity-70 ring-2 ring-indigo-400 shadow-2xl scale-105' : ''} `}
                style={{
                  transform: `translate3d(${legendPos.x}px, ${legendPos.y}px, 0)`,
                  ...(legendBorderVisible
                    ? { borderStyle: 'solid', borderWidth: legendBorderWidth, borderColor: legendBorderColor }
                    : { border: 'none' }),
                  willChange: 'transform',
                  pointerEvents: 'all',
                  backgroundColor: '#ffffff'
                }}
                onMouseDown={(e) => handleDragMouseDown(e, 'legend')}
              >
                {visibleSeries.map(s => {
                  const sStroke = s.strokeWidth || strokeWidth;
                  const sPointShape = s.pointShape || pointShape;
                  const sPointColor = s.pointColor || s.color || mainColor;
                  const sPointSize = s.pointSize || pointSize;
                  const sColor = s.color || mainColor;

                  return (
                    <div key={s.id} className="flex items-center gap-2.5 hover:bg-slate-50/50 p-0.5 rounded-md outline-none">
                      <div
                        className="shrink-0 flex items-center justify-center"
                        style={{ width: '24px', height: '14px' }}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingSeriesId(s.id); }}
                      >
                        <svg width="24" height="14" className="overflow-visible">
                          <line
                            x1="0" y1="7" x2="24" y2="7"
                            stroke={sColor}
                            strokeWidth={sStroke}
                            strokeLinecap="round"
                          />
                          {sPointShape !== 'none' && (
                            <ChartDot
                              cx={12} cy={7}
                              stroke={sColor}
                              pointSize={Math.min(sPointSize * 0.85, 5)}
                              pointShape={sPointShape}
                              pointColor={sPointColor}
                            />
                          )}
                        </svg>
                      </div>

                      {inlineEditingKey === `legend-${s.id}` ? (
                        <input
                          autoFocus
                          className="bg-slate-50 border border-indigo-400 rounded px-1 py-0.5 text-[9px] font-bold text-slate-800 outline-none"
                          value={s.name}
                          onChange={e => updateSeries(s.id, { name: e.target.value })}
                          onBlur={() => setInlineEditingKey(null)}
                          onKeyDown={e => e.key === 'Enter' && setInlineEditingKey(null)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: `${Math.max(s.name.length * 8, 80)}px` }}
                        />
                      ) : (
                        <span
                          className="text-slate-700 tracking-tight cursor-text hover:text-indigo-600 transition-colors whitespace-nowrap px-1 outline-none"
                          style={{
                            fontFamily: legendFontFamily !== 'inherit' ? legendFontFamily : labelFontFamily,
                            fontWeight: legendFontWeight,
                            fontStyle: legendFontStyle,
                            fontSize: `${legendFontSize}px`
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setInlineEditingKey(`legend-${s.id}`);
                            onOpenAxisSettings?.('legend');
                          }}
                        >
                          <LaTeXText text={s.name} />
                          {hasRightAxis && (
                            <span className="text-[8px] font-black ml-1 opacity-50">
                              {s.yAxisId === 'right' ? '(右)' : '(左)'}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div
              className="absolute left-1/2 z-[60] pointer-events-auto outline-none"
              style={{
                bottom: `5px`,
                transform: `translate(-50%, 0) translate3d(${xLabelPos.x + xAxisCenterOffset}px, ${xLabelPos.y - xAxisDynamicLift}px, 0)`
              }}
            >
              {inlineEditingKey === 'xlabel' ? (
                <input
                  autoFocus
                  className="bg-slate-50 border-2 border-indigo-400 rounded-lg px-4 py-1.5 text-center font-bold text-slate-800 shadow-xl outline-none"
                  style={{
                    fontSize: `${axisLabelFontSize}px`,
                    fontFamily: labelFontFamily,
                    width: `${Math.max(xAxisLabel.length * 10, 180)}px`
                  }}
                  value={xAxisLabel}
                  onChange={e => setXAxisLabel(e.target.value)}
                  onBlur={() => setInlineEditingKey(null)}
                  onKeyDown={e => e.key === 'Enter' && setInlineEditingKey(null)}
                />
              ) : (
                <div
                  className="cursor-grab active:cursor-grabbing hover:text-indigo-600 select-none whitespace-nowrap transition-colors py-1.5 px-6 rounded-lg hover:bg-slate-50/50 outline-none focus:outline-none"
                  style={{
                    fontSize: `${axisLabelFontSize}px`,
                    fontWeight: labelFontWeight,
                    fontStyle: labelFontStyle,
                    fontFamily: labelFontFamily
                  }}
                  onMouseDown={(e) => handleDragMouseDown(e, 'xlabel')}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingSeriesId(null);
                    setInlineEditingKey('xlabel');
                    onOpenAxisSettings?.('label');
                  }}
                >
                  <LaTeXText text={xAxisLabel} />
                </div>
              )}
            </div>

            <div
              className="absolute top-1/2 z-[60] pointer-events-auto outline-none flex items-center justify-center"
              style={{
                left: `${yAxisBaseline}px`,
                transform: `translate(-50%, -50%) translate3d(${yLabelPos.x}px, ${yLabelPos.y + yAxisCenterOffset}px, 0)`
              }}
            >
              <div style={{ transform: 'rotate(-90deg)', transformOrigin: 'center center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {inlineEditingKey === 'ylabel' ? (
                  <input
                    autoFocus
                    className="bg-slate-50 border-2 border-indigo-400 rounded-lg px-4 py-1.5 text-center font-bold text-slate-800 shadow-xl outline-none"
                    style={{
                      fontSize: `${axisLabelFontSize}px`,
                      fontFamily: labelFontFamily,
                      width: `${Math.max(yAxisLabel.length * 10, 180)}px`
                    }}
                    value={yAxisLabel}
                    onChange={e => setYAxisLabel(e.target.value)}
                    onBlur={() => setInlineEditingKey(null)}
                    onKeyDown={e => e.key === 'Enter' && setInlineEditingKey(null)}
                  />
                ) : (
                  <div
                    className="cursor-grab active:cursor-grabbing hover:text-indigo-600 select-none whitespace-nowrap transition-colors py-1.5 px-6 rounded-lg hover:bg-slate-50/50 outline-none focus:outline-none"
                    style={{
                      fontSize: `${axisLabelFontSize}px`,
                      fontWeight: labelFontWeight,
                      fontStyle: labelFontStyle,
                      fontFamily: labelFontFamily
                    }}
                    onMouseDown={(e) => handleDragMouseDown(e, 'ylabel')}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSeriesId(null);
                      setInlineEditingKey('ylabel');
                      onOpenAxisSettings?.('label');
                    }}
                  >
                    <LaTeXText text={yAxisLabel} />
                  </div>
                )}
              </div>
            </div>

            {/* ── 右 Y 轴标签（仅双轴模式） ── */}
            {hasRightAxis && rightYAxisLabel && (
              <div
                className="absolute top-1/2 z-[60] pointer-events-auto outline-none flex items-center justify-center"
                style={{
                  right: '35px',
                  transform: `translate(0, -50%) translate3d(${rightYLabelPos.x}px, ${rightYLabelPos.y}px, 0)`
                }}
              >
                <div style={{ transform: 'rotate(90deg)', transformOrigin: 'center center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    className="cursor-grab active:cursor-grabbing hover:text-indigo-600 select-none whitespace-nowrap transition-colors py-1.5 px-6 rounded-lg hover:bg-slate-50/50 outline-none focus:outline-none"
                    style={{
                      fontSize: `${axisLabelFontSize}px`,
                      fontWeight: labelFontWeight,
                      fontStyle: labelFontStyle,
                      fontFamily: labelFontFamily
                    }}
                    onMouseDown={(e) => handleDragMouseDown(e, 'rylabel')}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onOpenAxisSettings?.('label');
                    }}
                  >
                    <LaTeXText text={rightYAxisLabel} />
                  </div>
                </div>
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none no-outline" minHeight={subplotMode ? 100 : 300}>
              {renderChart()}
            </ResponsiveContainer>

            {/* 缩放重置浮动按钮 */}
            {isZoomed && autoFitDomains && (
              <button
                onClick={() => { autoFitDomains(); setIsZoomed(false); }}
                className="absolute top-2 right-2 z-[70] px-3 py-1.5 bg-white/90 backdrop-blur border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
                title="重置视图"
              >
                <i className="fa-solid fa-arrows-to-dot text-[10px]" /> 重置视图
              </button>
            )}

            <AnnotationOverlay
              annotations={annotations || []}
              seriesList={seriesList}
              activeTool={activeTool}
              onAddAnnotation={onAddAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onRemoveAnnotation={onRemoveAnnotation}
              containerRef={chartContainerRef}
            />

            {/* ── 数据选择器 ── */}
            <DataSelectorOverlay
              active={activeTool === 'data-selector'}
              seriesList={seriesList}
              chartOffset={chartOffsetState}
              containerRef={chartContainerRef}
              xDomain={[typeof xDomain[0] === 'number' ? xDomain[0] : 0, typeof xDomain[1] === 'number' ? xDomain[1] : 100]}
              yDomain={[typeof yDomain[0] === 'number' ? yDomain[0] : 0, typeof yDomain[1] === 'number' ? yDomain[1] : 100]}
              onExtractSelection={onExtractSelection || (() => {})}
              onClipSelection={onClipSelection || (() => {})}
              onDeleteSelection={onDeleteSelection || (() => {})}
              onDeactivate={() => onSetActiveTool('none')}
            />
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
};

export default DataChart;
