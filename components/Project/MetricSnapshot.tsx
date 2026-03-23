
import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, XAxis, Tooltip, Bar, LabelList } from 'recharts';

interface MetricSnapshotProps {
  data: Record<string, number>;
}

const MetricSnapshot: React.FC<MetricSnapshotProps> = ({ data }) => {
    const chartData = Object.entries(data).map(([key, value]) => ({ subject: key, A: value, fullMark: 100 }));
    if (chartData.length < 1) return null;

    return (
        <div className="w-[80%] aspect-[2/1] mt-4 bg-white/50 rounded-2xl border border-slate-100 shadow-inner flex items-center justify-center p-2">
            {chartData.length >= 3 ? (
                <ResponsiveContainer width="100%" height="100%" aspect={2}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 8, fontWeight: 'bold' }} />
                        <Radar name="Performance" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                    </RadarChart>
                </ResponsiveContainer>
            ) : (
                <ResponsiveContainer width="100%" height="100%" aspect={2}>
                    <BarChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 10 }}>
                        <XAxis dataKey="subject" fontSize={8} tick={{fill: '#94a3b8', fontWeight: 'bold', dy: 5}} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: '8px', borderRadius: '8px' }} />
                        <Bar dataKey="A" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20}>
                            <LabelList dataKey="A" position="top" fill="#6366f1" fontSize={8} fontWeight="bold" />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default MetricSnapshot;
