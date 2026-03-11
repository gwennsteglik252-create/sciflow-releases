
import React, { RefObject, useState, useRef, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar, Customized
} from 'recharts';
import { DataSeries, ChartAnnotation, AnnotationType } from '../../types';
import { AxisTick } from './Chart/AxisTick';
import { ChartDot } from './Chart/ChartDot';
import { AnnotationOverlay } from './Chart/AnnotationOverlay';
import LaTeXText from '../Common/LaTeXText';
import { FontTabType } from '../../hooks/useDataAnalysisLogic';

interface DataChartProps {
  chartContainerRef: RefObject<HTMLDivElement>;
  seriesList: DataSeries[];
  chartType: 'line' | 'bar' | 'scatter' | 'area';
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
  activeTool: AnnotationType | 'select' | 'none';
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
  chartContainerRef, seriesList, chartType, mainColor, strokeWidth, fontSize,
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
  onOpenAxisSettings
}) => {
  const [dragTarget, setDragTarget] = useState<'legend' | 'xlabel' | 'ylabel' | 'title' | null>(null);
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const rafId = useRef<number | null>(null);

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
  }, [dragTarget, setLegendPos, setXLabelPos, setYLabelPos, setTitlePos]);

  // 映射 setter
  const setXAxisLabelPos = setXLabelPos;
  const setYAxisLabelPos = setYLabelPos;

  const handleDragMouseDown = (e: React.MouseEvent, target: 'legend' | 'xlabel' | 'ylabel' | 'title') => {
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

  // 动态调整 margin，针对负值较大的情况增加底部空间
  // 注意：必须在 visibleSeries 定义之后才能使用
  const chartMargin = useMemo(() => {
    const baseMargin = { top: 30, right: 40, left: 80, bottom: 60 };
    const hasNegativeData = visibleSeries.some(s =>
      s.data.some((d: any) => d.displayY < 0)
    );
    if (hasNegativeData) {
      return { ...baseMargin, bottom: 80 };
    }
    return baseMargin;
  }, [visibleSeries]);

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
        height={40}
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
        width={70}
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

    const rightBoxAxis = (
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

    // Reliable box border overlay using Customized - draws right + top lines directly
    const boxBorderOverlay = axisBox ? (
      <Customized component={(props: any) => {
        const { formattedGraphicalItems, xAxisMap, yAxisMap, offset } = props;
        if (!offset) return null;
        const { left, top, width, height } = offset;
        return (
          <g className="axis-box-overlay">
            {/* Right border */}
            <line
              x1={left + width} y1={top}
              x2={left + width} y2={top + height}
              stroke={axisColor} strokeWidth={axisLineWidth}
            />
            {/* Top border */}
            <line
              x1={left} y1={top}
              x2={left + width} y2={top}
              stroke={axisColor} strokeWidth={axisLineWidth}
            />
          </g>
        );
      }} />
    ) : null;

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={mergedBarData} margin={margin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {topBoxAxis}
            {rightBoxAxis}
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
            {topBoxAxis}
            {rightBoxAxis}
            {visibleSeries.map(s => (
              <Scatter
                key={s.id}
                data={s.data}
                dataKey="displayY"
                fill={s.color || mainColor}
                name={s.name}
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
      default:
        return (
          <LineChart margin={margin}>
            <CartesianGrid {...gridProps} />
            {commonX}
            {commonY}
            {topBoxAxis}
            {rightBoxAxis}
            {visibleSeries.map(s => (
              <Line
                key={s.id}
                data={s.data}
                type="monotone"
                dataKey="displayY"
                stroke={s.color || mainColor}
                strokeWidth={s.strokeWidth || strokeWidth}
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
      className="lab-chart-container flex flex-col p-6 relative h-full min-h-[400px] outline-none select-none focus:outline-none"
    >
      {/* 核心修正：在高清晰度导出时，确保 SVG 渲染保持最佳精度 */}
      <style>{`
        .recharts-wrapper, .recharts-surface { outline: none !important; }
        .lab-chart-container svg { shape-rendering: geometricPrecision !important; }
        .lab-chart-container *:focus { outline: none !important; }
        .lab-chart-responsive *:focus { outline: none !important; }
      `}</style>

      <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
        <div className="lab-chart-responsive w-full mx-auto relative flex flex-col outline-none focus:outline-none" style={{ aspectRatio: `${aspectRatio}`, maxHeight: '100%' }}>

          <div
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
              >
                <LaTeXText text={chartTitle} />
              </div>
            )}
          </div>

          <div className="flex-1 relative min-h-0 mt-12 outline-none focus:outline-none">
            {visibleSeries.length > 0 && (
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

            <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none no-outline" minHeight={300}>
              {renderChart()}
            </ResponsiveContainer>

            <AnnotationOverlay
              annotations={annotations || []}
              seriesList={seriesList}
              activeTool={activeTool}
              onAddAnnotation={onAddAnnotation}
              onUpdateAnnotation={onUpdateAnnotation}
              onRemoveAnnotation={onRemoveAnnotation}
              containerRef={chartContainerRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataChart;
