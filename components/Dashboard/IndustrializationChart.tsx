
import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface IndustrializationChartProps {
  data: any[];
  totalProjects: number;
  isLight: boolean;
}

const IndustrializationChart: React.FC<IndustrializationChartProps> = ({ data, totalProjects, isLight }) => {
  return (
    <div className={`w-full lg:w-1/3 p-5 rounded-[2.5rem] flex flex-col border ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
      <h4 className={`text-[10px] font-black uppercase tracking-[0.2rem] mb-4 flex items-center gap-2 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
         <i className="fa-solid fa-industry"></i> 产业化进度
      </h4>
      <div className="flex-1 flex flex-col justify-center items-center relative">
         <div className="w-32 h-32 relative">
            <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                  <Pie
                    data={data}
                    innerRadius={38}
                    outerRadius={58}
                    paddingAngle={data.length > 1 ? 4 : 0}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{fontSize: '9px', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
               </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <div className="w-16 h-16 bg-slate-50/80 backdrop-blur-sm rounded-full border border-slate-100 shadow-inner flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-800 leading-none">{totalProjects}</span>
                  <span className="text-[7px] text-slate-400 uppercase font-black tracking-tighter mt-0.5">Total</span>
               </div>
            </div>
         </div>
         <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-4">
             {data.map(s => (
               <div key={s.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shadow-sm" style={{backgroundColor: s.color}}></span>
                  <span className={`text-[8px] font-black uppercase ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{s.name}</span>
               </div>
             ))}
         </div>
      </div>
    </div>
  );
};

export default IndustrializationChart;
