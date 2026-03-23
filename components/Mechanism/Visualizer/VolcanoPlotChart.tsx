import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Label, Area, ComposedChart, ReferenceLine, Customized
} from 'recharts';

interface Props {
  volcanoData: any;
  material: string;
  onLoadSimulation?: (sim: any) => void;
}

const CustomTooltip = ({ active, payload, t }: any) => {
  if (active && payload && payload.length) {
    const scatterPayload = payload.find((p: any) => p.name === 'Experimental Points' || p.payload?.name);
    const data = scatterPayload ? scatterPayload.payload : payload[0].payload;

    if (!data || !data.name) return null;
    return (
      <div className="bg-slate-900 border border-white/20 p-2.5 rounded-xl shadow-2xl animate-reveal backdrop-blur-md">
        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 border-b border-white/10 pb-1">{data.name}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-slate-400 text-[8px] uppercase font-bold">{t('mechanism.visualizer.volcanoDescriptorLabel')}</span>
            <span className="text-white text-[9px] font-mono font-black">{data.x.toFixed(3)} eV</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400 text-[8px] uppercase font-bold">{t('mechanism.visualizer.volcanoActivityLabel')}</span>
            <span className="text-emerald-400 text-[9px] font-mono font-black">{data.y.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const VolcanoPlotChart: React.FC<Props> = ({ volcanoData, material, onLoadSimulation }) => {
  const [showComparison, setShowComparison] = useState(false);
  const [clickedPointId, setClickedPointId] = useState<string | null>(null);
  const { t } = useTranslation();

  if (!volcanoData || !volcanoData.volcanoPath) return null;

  const { volcanoPath, currentPoint, basePoint, comparisonPoints, volcanoParams } = volcanoData;

  const COLORS = ['#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];

  // Sabatier 最优点
  const peakX = volcanoParams?.peakX ?? 0;
  const peakY = volcanoParams?.peakY ?? 10;
  const xAxisLabel = volcanoParams?.xAxisLabel ?? 'DESCRIPTOR (eV)';
  const optimumLabel = volcanoParams?.label ?? 'SABATIER OPTIMUM';

  const scatterData = useMemo(() => {
    return [
      { ...basePoint, name: t('mechanism.visualizer.volcanoOriginalBase', { material }), type: 'base' },
      { ...currentPoint, name: t('mechanism.visualizer.volcanoCurrentOptimized'), type: 'current' },
      ...(showComparison ? (comparisonPoints || []).slice(0, 5).map((p: any) => ({ ...p, type: 'comparison' })) : [])
    ];
  }, [basePoint, currentPoint, comparisonPoints, material, showComparison]);

  // 偏移量计算
  const descriptorOffset = currentPoint ? (currentPoint.x - peakX) : null;

  const handlePointClick = (entry: any) => {
    if (entry.type === 'comparison' && onLoadSimulation) {
      setClickedPointId(entry.id);
      // 从对比点找到原始 sim 数据
      const sim = comparisonPoints?.find((p: any) => p.id === entry.id);
      if (sim) {
        onLoadSimulation(sim);
        setTimeout(() => setClickedPointId(null), 600);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col animate-reveal relative p-4 min-h-[500px] overflow-hidden select-none">
      {/* Header Metadata */}
      <div className="flex justify-between items-center mb-4 px-2 shrink-0 relative z-20">
        <div className="flex flex-col">
          <h5 className="text-lg font-black text-slate-800 uppercase tracking-tight italic leading-none text-left">{t('mechanism.visualizer.volcanoTitle')}</h5>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest flex items-center gap-2">
            <span className="w-2 h-px bg-slate-300"></span>
            {t('mechanism.visualizer.volcanoSubtitle')} {xAxisLabel}
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-md border ${showComparison ? 'bg-slate-600 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'}`}
          >
            {showComparison ? t('mechanism.visualizer.volcanoHideComparison') : t('mechanism.visualizer.volcanoLoadComparison')}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full relative group min-h-0">
        <div className="absolute top-[15%] left-12 pointer-events-none z-0 opacity-[0.1] transform -rotate-12">
          <span className="text-[18px] font-black text-slate-900 uppercase tracking-widest block text-center">{t('mechanism.visualizer.volcanoBindingStrong')}</span>
          <span className="text-[8px] font-bold text-slate-500 uppercase block text-center tracking-tighter">BINDING OVER-STRONG</span>
        </div>
        <div className="absolute top-[15%] right-12 pointer-events-none z-0 opacity-[0.1] transform rotate-12 text-right">
          <span className="text-[18px] font-black text-slate-900 uppercase tracking-widest block text-center">{t('mechanism.visualizer.volcanoBindingWeak')}</span>
          <span className="text-[8px] font-bold text-slate-500 uppercase block text-center tracking-tighter">BINDING WEAK</span>
        </div>

        {/* Volcano Plot Legend */}
        <div className="absolute top-4 right-6 bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2 z-20 max-w-[140px]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shadow-[0_0_6px_#f43f5e]"></div>
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight truncate">{t('mechanism.visualizer.volcanoCurrentScheme')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]"></div>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight truncate">{t('mechanism.visualizer.volcanoBaseMaterial')}</span>
          </div>
          {scatterData.filter(d => d.type === 'comparison').map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
              <span className="text-[8px] font-black uppercase tracking-tight truncate flex-1" style={{ color: COLORS[i % COLORS.length] }}>{d.name}</span>
            </div>
          ))}
          {showComparison && comparisonPoints?.length > 0 && (
            <div className="border-t border-slate-200 pt-1.5 mt-0.5">
              <span className="text-[7px] text-slate-400 font-bold uppercase tracking-wider">{t('mechanism.visualizer.volcanoClickToLoad')}</span>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={volcanoPath} margin={{ top: 20, right: 10, bottom: 60, left: 40 }}>
            <defs>
              <filter id="rds-glow-volcano" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="volcanoAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
                <stop offset="60%" stopColor="#818cf8" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
              </linearGradient>
              <radialGradient id="optimumGlow">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </radialGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="x"
              type="number"
              domain={[-1.8, 1.8]}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
            >
              <Label value={xAxisLabel.toUpperCase()} offset={-25} position="insideBottom" style={{ fill: '#64748b', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
            </XAxis>
            <YAxis
              type="number"
              domain={[0, 11]}
              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              tickLine={false}
              width={30}
            >
              <Label value="ACTIVITY (-log η)" angle={-90} position="insideLeft" offset={-20} style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
            </YAxis>

            <Tooltip content={<CustomTooltip t={t} />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }} />

            <Area
              type="monotone"
              dataKey="activity"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#volcanoAreaGradient)"
              baseValue={0}
              isAnimationActive={false}
            />

            <ReferenceLine x={0} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="8 4" opacity={0.25} />

            <Customized component={(props: any) => {
              const { xAxisMap, yAxisMap } = props;
              const xAxis = xAxisMap && Object.values(xAxisMap)[0] as any;
              const yAxis = yAxisMap && Object.values(yAxisMap)[0] as any;
              if (!xAxis || !yAxis) return null;

              const xScale = xAxis.scale;
              const yScale = yAxis.scale;
              if (!xScale || !yScale) return null;

              // 图表绘图区域边界（用于 clipPath）
              const plotLeft = xScale.range()[0];
              const plotRight = xScale.range()[1];
              const plotTop = yScale.range()[1]; // yScale 的 range 是反转的（top 是小值）
              const plotBottom = yScale.range()[0];
              const clipId = 'volcano-plot-clip';

              // 辅助函数：将坐标 clamp 到绘图区域内
              const clampX = (v: number) => Math.max(plotLeft + 10, Math.min(plotRight - 10, v));
              const clampY = (v: number) => Math.max(plotTop + 10, Math.min(plotBottom - 10, v));

              // 火山顶峰坐标
              const peakCx = xScale(peakX);
              const peakCy = yScale(peakY);

              // 当前方案坐标
              const currentCx = currentPoint ? xScale(currentPoint.x) : null;
              const currentCy = currentPoint ? yScale(currentPoint.y) : null;

              return (
                <g>
                  {/* clipPath 定义：限制所有散点和标注在图表绘图区内 */}
                  <defs>
                    <clipPath id={clipId}>
                      <rect
                        x={plotLeft - 8}
                        y={plotTop - 8}
                        width={plotRight - plotLeft + 16}
                        height={plotBottom - plotTop + 16}
                      />
                    </clipPath>
                  </defs>

                  {/* === Sabatier Optimum 顶峰注解（不裁剪，始终显示） === */}
                  <circle cx={peakCx} cy={peakCy} r={20} fill="url(#optimumGlow)" />
                  <line
                    x1={peakCx} y1={peakCy - 8}
                    x2={peakCx} y2={peakCy - 35}
                    stroke="#6366f1" strokeWidth={1.2} strokeDasharray="3 2" opacity={0.6}
                  />
                  <rect
                    x={peakCx - 55} y={peakCy - 55} width={110} height={18}
                    rx={9} fill="#6366f1" fillOpacity={0.1} stroke="#6366f1" strokeWidth={0.5} strokeOpacity={0.3}
                  />
                  <text x={peakCx} y={peakCy - 43} textAnchor="middle" fill="#6366f1" fontSize="7" fontWeight="900" style={{ letterSpacing: '0.05em' }}>
                    {optimumLabel}
                  </text>
                  <text x={peakCx} y={peakCy - 62} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="700">
                    x = {peakX.toFixed(2)} eV
                  </text>

                  {/* === 裁剪区域内的内容：散点 + 偏移线 === */}
                  <g clipPath={`url(#${clipId})`}>
                    {/* === 当前方案到顶峰的偏移虚线 === */}
                    {currentCx != null && currentCy != null && descriptorOffset != null && Math.abs(descriptorOffset) > 0.01 && (
                      <g>
                        <line
                          x1={currentCx} y1={currentCy}
                          x2={peakCx} y2={peakCy}
                          stroke="#f43f5e" strokeWidth={1} strokeDasharray="4 3" opacity={0.5}
                        />
                        {/* 偏移标签：clamp 到可视区域内 */}
                        <rect
                          x={clampX((currentCx + peakCx) / 2) - 28}
                          y={clampY((currentCy + peakCy) / 2) - 8}
                          width={56} height={16} rx={8}
                          fill="white" stroke="#f43f5e" strokeWidth={0.8} fillOpacity={0.9}
                        />
                        <text
                          x={clampX((currentCx + peakCx) / 2)}
                          y={clampY((currentCy + peakCy) / 2) + 3}
                          textAnchor="middle" fill="#f43f5e" fontSize="7" fontWeight="900"
                        >
                          Δ{descriptorOffset > 0 ? '+' : ''}{descriptorOffset.toFixed(3)}
                        </text>
                      </g>
                    )}

                    {/* === 散点渲染 === */}
                    {scatterData.map((entry, index) => {
                      if (entry.x == null || entry.y == null) return null;
                      const cx = xScale(entry.x);
                      const cy = yScale(entry.y);

                      let fill = '#94a3b8';
                      let r = 4.5;
                      let glowColor = 'transparent';
                      let isClickable = false;

                      if (entry.type === 'current') {
                        fill = '#f43f5e';
                        r = 6;
                        glowColor = 'rgba(244,63,94,0.18)';
                      } else if (entry.type === 'comparison') {
                        const compIdx = scatterData
                          .filter(d => d.type === 'comparison')
                          .indexOf(entry);
                        fill = COLORS[compIdx >= 0 ? compIdx % COLORS.length : 0];
                        r = 4.5;
                        isClickable = !!onLoadSimulation;
                      }

                      const isClicked = clickedPointId === entry.id;

                      return (
                        <g
                          key={`dot-${index}`}
                          style={{ cursor: isClickable ? 'pointer' : 'default' }}
                          onClick={isClickable ? () => handlePointClick(entry) : undefined}
                        >
                          {entry.type === 'current' && (
                            <circle cx={cx} cy={cy} r={r + 5} fill={glowColor} />
                          )}
                          {/* 点击反馈动画环 */}
                          {isClicked && (
                            <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke={fill} strokeWidth={1.5} opacity={0.6}>
                              <animate attributeName="r" from={String(r + 2)} to={String(r + 12)} dur="0.5s" fill="freeze" />
                              <animate attributeName="opacity" from="0.8" to="0" dur="0.5s" fill="freeze" />
                            </circle>
                          )}
                          <circle
                            cx={cx} cy={cy} r={isClicked ? r + 1 : r}
                            fill={fill}
                            stroke="white"
                            strokeWidth={1.5}
                            style={{ transition: 'r 0.2s ease' }}
                          />
                          {/* 对比点 hover 提示可点击 */}
                          {isClickable && (
                            <title>{t('mechanism.visualizer.volcanoClickTooltip', { name: entry.name })}</title>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </g>
              );
            }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <footer className="mt-4 p-5 bg-white rounded-[2.5rem] border border-slate-100 flex flex-col gap-5 shrink-0 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-full bg-indigo-600/5 blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100 shadow-inner shrink-0">
            <i className="fa-solid fa-microscope text-xs"></i>
          </div>
          <p className="text-[10px] font-black text-slate-700 leading-relaxed italic text-left">
            {t('mechanism.visualizer.volcanoAuditNote')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-1 hover:shadow-lg transition-all">
            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">{t('mechanism.visualizer.volcanoDescriptorShift')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-500 font-mono tracking-tighter">
                {currentPoint && basePoint ? (currentPoint.x - basePoint.x).toFixed(3) : '--'}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase">eV</span>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-1 hover:shadow-lg transition-all">
            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">{t('mechanism.visualizer.volcanoActivityIndex')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-500 font-mono tracking-tighter">
                {currentPoint ? currentPoint.y.toFixed(2) : '--'}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase">Score</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};