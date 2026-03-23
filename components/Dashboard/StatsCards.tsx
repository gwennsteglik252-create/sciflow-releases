
import React from 'react';

interface StatItem {
  label: string;
  value: string;
  trend: string;
  color: string;
}

interface StatsCardsProps {
  stats: StatItem[];
  isLight: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, isLight }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
      {stats.map((stat) => (
        <div key={stat.label} className={`p-3.5 rounded-xl border group transition-all hover:-translate-y-0.5 ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-lg'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-50'}`}>{stat.label}</p>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isLight ? `bg-${stat.color}-50 text-${stat.color}-600` : `bg-${stat.color}-900/40 text-${stat.color}-300`}`}>{stat.trend}</span>
          </div>
          <h3 className={`text-2xl font-black tracking-tighter ${isLight ? 'text-slate-800' : 'text-white'}`}>{stat.value}</h3>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
