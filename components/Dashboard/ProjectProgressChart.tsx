import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { AppView } from '../../types';

interface ProjectProgressChartProps {
  data: any[];
  isLight: boolean;
  navigate: (view: AppView, projectId?: string) => void;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e'];

const ProjectProgressChart: React.FC<ProjectProgressChartProps> = ({ data, isLight, navigate }) => {
  return (
    <div className="flex-[3] min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{top: 10, right: 10, left: -20, bottom: 0}}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? "#f1f5f9" : "#334155"} />
          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 'bold'}} />
          <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
          <Tooltip 
            cursor={{fill: isLight ? '#f8fafc' : '#1e293b', radius: 12}}
            contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isLight ? '#fff' : '#0f172a', color: isLight ? '#000' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
          />
          <Bar name="完成进度" dataKey="progress" radius={0} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer" onClick={() => navigate('project_detail', entry.id)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProjectProgressChart;