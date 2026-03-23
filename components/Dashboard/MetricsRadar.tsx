import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ResearchProject } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface MetricsRadarProps {
  projects: ResearchProject[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  activeProject: ResearchProject | undefined;
  metricData: any[];
  isLight: boolean;
}

const MetricsRadar: React.FC<MetricsRadarProps> = ({ projects, selectedProjectId, onProjectChange, activeProject, metricData, isLight }) => {
  const { t } = useTranslation();

  return (
    <div className={`flex-1 p-6 rounded-[2.5rem] flex flex-col border overflow-hidden ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
      <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0 pr-10">
              <h4 className={`text-xs font-black flex items-center gap-2 mb-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                 <i className="fa-solid fa-bullseye text-rose-500"></i> {t('dashboard.radar.title')}
              </h4>
              <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 relative group z-20 w-full">
                      <select 
                          className="bg-transparent border-b border-dashed border-slate-300 text-[10px] font-black text-slate-500 uppercase outline-none cursor-pointer hover:text-indigo-600 hover:border-indigo-300 transition-colors pr-6 py-0.5 w-full truncate"
                          value={selectedProjectId}
                          onChange={(e) => onProjectChange(e.target.value)}
                      >
                          {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                          ))}
                      </select>
                      <i className="fa-solid fa-chevron-down text-[8px] absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                  </div>
                  {activeProject && (
                      <p className="text-[9px] text-slate-400 font-bold truncate italic">
                          {activeProject.description}
                      </p>
                  )}
              </div>
          </div>
          <span className="bg-rose-50 text-rose-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0">Benchmarking</span>
      </div>
      
      <div className="flex-1 flex gap-2 min-h-0">
          <div className="flex-1 min-w-0 h-full relative">
              <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={metricData}>
                      <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={t('dashboard.radar.measured')} dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                  </RadarChart>
              </ResponsiveContainer>
              <div className="absolute top-0 right-0 flex gap-2 text-[8px] font-black uppercase text-slate-400">
                   <span className="flex items-center gap-1"><span className="w-2 h-2 bg-violet-500 rounded-full opacity-40"></span> {t('dashboard.radar.measured')}</span>
              </div>
          </div>
          
          <div className={`w-56 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2 pl-2 border-l border-dashed ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
              <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.radar.details')}</h5>
              {metricData.map((m, i) => (
                  <div key={i} className={`rounded-xl p-2.5 border ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                      <div className="flex justify-between items-center mb-1">
                          <span className={`text-[9px] font-black uppercase truncate max-w-[100px] ${isLight ? 'text-slate-700' : 'text-slate-300'}`} title={m.subject}>{m.subject}</span>
                          <span className={`text-[10px] font-black italic ${m.A >= 90 ? 'text-emerald-500' : m.A >= 70 ? 'text-indigo-500' : 'text-amber-500'}`}>{m.A.toFixed(0)}%</span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden mb-1.5 border ${isLight ? 'bg-white border-slate-100' : 'bg-slate-700 border-white/5'}`}>
                          <div 
                            className={`h-full rounded-full ${m.A >= 90 ? 'bg-emerald-500' : m.A >= 70 ? 'bg-indigo-500' : 'bg-amber-500'}`} 
                            style={{width: `${m.A}%`}}
                          ></div>
                      </div>
                      <p className="text-[8px] text-slate-400 font-mono">
                         {t('dashboard.radar.actual')}: <span className={`${isLight ? 'text-slate-600' : 'text-slate-300'} font-bold`}>{m.actual}</span> / {t('dashboard.radar.target')}: {m.target}
                      </p>
                  </div>
              ))}
              {metricData.length === 0 && (
                  <div className="text-center py-4 text-slate-300 text-[9px] italic">{t('dashboard.radar.noMetrics')}</div>
              )}
          </div>
      </div>
    </div>
  );
};

export default MetricsRadar;
