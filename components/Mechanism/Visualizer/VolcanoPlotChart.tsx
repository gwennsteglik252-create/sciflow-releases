import React, { useMemo, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Label, Area, ComposedChart, ReferenceLine, Customized
} from 'recharts';

interface Props {
  volcanoData: any;
  material: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const scatterPayload = payload.find((p: any) => p.name === 'Experimental Points' || p.payload?.name);
    const data = scatterPayload ? scatterPayload.payload : payload[0].payload;

    if (!data || !data.name) return null;
    return (
      <div className="bg-slate-900 border border-white/20 p-2.5 rounded-xl shadow-2xl animate-reveal backdrop-blur-md">
        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 border-b border-white/10 pb-1">{data.name}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-slate-400 text-[8px] uppercase font-bold">描述符 ΔG:</span>
            <span className="text-white text-[9px] font-mono font-black">{data.x.toFixed(3)} eV</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400 text-[8px] uppercase font-bold">预测活性:</span>
            <span className="text-emerald-400 text-[9px] font-mono font-black">{data.y.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const VolcanoPlotChart: React.FC<Props> = ({ volcanoData, material }) => {
  const [showComparison, setShowComparison] = useState(false);

  if (!volcanoData || !volcanoData.volcanoPath) return null;

  const { volcanoPath, currentPoint, basePoint, comparisonPoints } = volcanoData;

  const COLORS = ['#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];

  const scatterData = useMemo(() => {
    return [
      { ...basePoint, name: `原始 ${material} 基材`, type: 'base' },
      { ...currentPoint, name: '当前优化方案', type: 'current' },
      ...(showComparison ? (comparisonPoints || []).slice(0, 5).map((p: any) => ({ ...p, type: 'comparison' })) : [])
    ];
  }, [basePoint, currentPoint, comparisonPoints, material, showComparison]);

  return (
    <div className="w-full h-full flex flex-col animate-reveal relative p-4 min-h-[500px] overflow-hidden select-none">
      {/* Header Metadata */}
      <div className="flex justify-between items-center mb-4 px-2 shrink-0 relative z-20">
        <div className="flex flex-col">
          <h5 className="text-lg font-black text-slate-800 uppercase tracking-tight italic leading-none text-left">SABATIER 活性火山模型 (基于解算描述符)</h5>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest flex items-center gap-2">
            <span className="w-2 h-px bg-slate-300"></span>
            活性 VS 中间体吸附描述符 ΔG(O*) - ΔG(OH*)
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowComparison(!showComparison)}
            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-md border ${showComparison ? 'bg-slate-600 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'}`}
          >
            {showComparison ? '隐藏对比点 (Hide)' : '载入对比库 (Load)'}
          </button>
        </div>
      </div>

      <div className="flex-1 w-full relative group min-h-0">
        <div className="absolute top-[15%] left-12 pointer-events-none z-0 opacity-[0.1] transform -rotate-12">
          <span className="text-[18px] font-black text-slate-900 uppercase tracking-widest block text-center">吸附过强</span>
          <span className="text-[8px] font-bold text-slate-500 uppercase block text-center tracking-tighter">BINDING OVER-STRONG</span>
        </div>
        <div className="absolute top-[15%] right-12 pointer-events-none z-0 opacity-[0.1] transform rotate-12 text-right">
          <span className="text-[18px] font-black text-slate-900 uppercase tracking-widest block text-center">吸附过弱</span>
          <span className="text-[8px] font-bold text-slate-500 uppercase block text-center tracking-tighter">BINDING WEAK</span>
        </div>

        {/* Volcano Plot Legend */}
        <div className="absolute top-4 right-6 bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2 z-20 max-w-[140px]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] shadow-[0_0_6px_#f43f5e]"></div>
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight truncate">当前方案</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]"></div>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight truncate">基材 (Base)</span>
          </div>
          {scatterData.filter(d => d.type === 'comparison').map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
              <span className="text-[8px] font-black uppercase tracking-tight truncate flex-1" style={{ color: COLORS[i % COLORS.length] }}>{d.name}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={volcanoPath} margin={{ top: 20, right: 10, bottom: 60, left: 10 }}>
            <defs>
              <filter id="rds-glow-volcano" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="volcanoAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="x"
              type="number"
              domain={[-1.8, 1.8]}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
              axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
            >
              <Label value="DESCRIPTOR [ΔG(O*) – ΔG(OH*)] (EV)" offset={-25} position="insideBottom" style={{ fill: '#64748b', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
            </XAxis>
            <YAxis type="number" domain={[0, 11]} hide />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '5 5' }} />

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
              // recharts 通过 viewBox 告知实际绘图区域
              const { xAxisMap, yAxisMap } = props;
              const xAxis = xAxisMap && Object.values(xAxisMap)[0] as any;
              const yAxis = yAxisMap && Object.values(yAxisMap)[0] as any;
              if (!xAxis || !yAxis) return null;

              const xScale = xAxis.scale;
              const yScale = yAxis.scale;
              if (!xScale || !yScale) return null;

              return (
                <g>
                  {scatterData.map((entry, index) => {
                    if (entry.x == null || entry.y == null) return null;
                    const cx = xScale(entry.x);
                    const cy = yScale(entry.y);

                    let fill = '#94a3b8';
                    let r = 7;
                    let glowColor = 'transparent';

                    if (entry.type === 'current') {
                      fill = '#f43f5e';
                      r = 11;
                      glowColor = 'rgba(244,63,94,0.35)';
                    } else if (entry.type === 'comparison') {
                      const compIdx = scatterData
                        .filter(d => d.type === 'comparison')
                        .findIndex(d => d.name === entry.name);
                      fill = COLORS[compIdx % COLORS.length];
                    }

                    return (
                      <g key={`dot-${index}`}>
                        {entry.type === 'current' && (
                          <circle cx={cx} cy={cy} r={r + 8} fill={glowColor} />
                        )}
                        <circle
                          cx={cx} cy={cy} r={r}
                          fill={fill}
                          stroke="white"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  })}
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
            物理审计确认：描述符由能垒台阶实时映射，Y轴反映 1/η 动力学活性。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-1 hover:shadow-lg transition-all">
            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">描述符位移 (ΔDESCRIPTOR)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-500 font-mono tracking-tighter">
                {currentPoint && basePoint ? (currentPoint.x - basePoint.x).toFixed(3) : '--'}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase">eV</span>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-1 hover:shadow-lg transition-all">
            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">预测活性指数</span>
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