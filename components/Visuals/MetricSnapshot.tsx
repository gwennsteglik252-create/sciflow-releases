import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, XAxis, Tooltip, Bar, LabelList, ReferenceLine, Cell } from 'recharts';
import { getMetricDisplay, normalizeMetricKey, formatMetricNumber } from '../../utils/metricDisplay';

interface MetricSnapshotProps {
  data: Record<string, number>;
  targets?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
}

const MetricSnapshot: React.FC<MetricSnapshotProps> = ({ data, targets = [] }) => {
    const chartData = Object.entries(data).map(([key, value]) => {
      const metric = getMetricDisplay(key);
      const targetObj = targets.find(t => normalizeMetricKey(t.label) === metric.normalizedKey);
      const targetVal = targetObj ? parseFloat(targetObj.value) : null;
      const unit = String(targetObj?.unit || metric.unit || '').replace(/^\((.*)\)$/, '$1').trim();
      const labelWithoutUnit = String(metric.label || '').replace(/\s*\([^()]+\)\s*$/, '').trim();

      return {
        key,
        subject: unit ? `${labelWithoutUnit} (${unit})` : labelWithoutUnit,
        displayValue: `${formatMetricNumber(Number(value))}${unit ? ` ${unit}` : ''}`,
        A: value,
        target: targetVal,
        fullMark: 100
      };
    });

    if (chartData.length < 1) return null;

    const renderCustomTick = ({ payload, x, y, textAnchor, stroke, radius }: any) => {
        const item = chartData.find(d => d.subject === payload.value);
        return (
            <g className="recharts-layer recharts-polar-angle-axis-tick">
                <text 
                    radius={radius} 
                    stroke={stroke} 
                    x={x} 
                    y={y} 
                    className="recharts-text recharts-polar-angle-axis-tick-value" 
                    textAnchor={textAnchor}
                >
                    <tspan x={x} dy="0em" fill="#475569" fontSize="11" fontWeight="800">{payload.value}</tspan>
                    <tspan x={x} dy="1.1em" fill="#10b981" fontSize="10" fontWeight="900" fontFamily="monospace">{item?.displayValue}</tspan>
                </text>
            </g>
        );
    };

    return (
        <div className="w-[82%] mx-auto mt-2 bg-white/50 rounded-xl border border-slate-100 shadow-inner p-2">
            <div className="flex justify-between items-center mb-1 px-1">
                <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">实测数据 VS 目标 (BENCHMARKING)</h5>
            </div>

            <div className="w-full h-[180px] px-1">
                {chartData.length >= 3 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={chartData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis 
                                dataKey="subject" 
                                tick={renderCustomTick}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{fontSize: 6}} stroke="#e2e8f0" />
                            <Radar name="目标值" dataKey="target" stroke="#fb7185" fill="#fb7185" fillOpacity={0.1} strokeDasharray="2 2" />
                            <Radar name="实测值" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                            <Tooltip contentStyle={{ fontSize: '9px', borderRadius: '8px', padding: '4px 8px' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <XAxis dataKey="subject" fontSize={7} tick={{fill: '#475569', fontWeight: 'bold', dy: 2}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ fontSize: '9px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '4px 8px' }} />
                            <Bar dataKey="A" fill="#6366f1" radius={0} barSize={20}>
                                {chartData.map((entry, index) => {
                                    const isAchieved = entry.target !== null && (entry.A as number) >= (entry.target as number);
                                    return <Cell key={`cell-${index}`} fill={isAchieved ? '#10b981' : '#6366f1'} />;
                                })}
                                <LabelList dataKey="A" position="top" fill="#6366f1" fontSize={8} fontWeight="black" offset={2} />
                            </Bar>
                            {chartData.map((entry, idx) => entry.target !== null && (
                                <ReferenceLine 
                                    key={idx} 
                                    y={entry.target} 
                                    stroke="#fb7185" 
                                    strokeDasharray="3 3" 
                                    label={{ position: 'right', value: `目标:${entry.target}`, fill: '#fb7185', fontSize: 6, fontWeight: 'bold' }} 
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default MetricSnapshot;
