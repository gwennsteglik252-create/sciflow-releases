
import React from 'react';
import { ResearchProject } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';

interface ProjectGalleryProps {
  projects: ResearchProject[];
  onSelectProject: (id: string) => void;
}

const ProjectGallery: React.FC<ProjectGalleryProps> = ({ projects, onSelectProject }) => {
  const { activeTheme } = useProjectContext();
  const isLight = activeTheme.type === 'light';

  return (
    <div className="h-full flex flex-col gap-6 animate-reveal p-4">
      <header className="flex justify-between items-center mb-2">
        <div>
          <h2 className={`text-3xl font-black italic uppercase tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>情报档案</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Select a research project to browse intelligence archives</p>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-10">
        {projects.map(p => (
          <div 
            key={p.id} 
            onClick={() => onSelectProject(p.id)} 
            className={`p-8 rounded-[3rem] border transition-all flex flex-col group min-h-[340px] shadow-sm hover:shadow-2xl relative overflow-hidden cursor-pointer ${isLight ? 'bg-white border-slate-100 hover:border-indigo-500/50' : 'bg-slate-800/80 border-white/10 hover:border-indigo-500/50 backdrop-blur-md'}`}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

            <div className="flex-1 relative z-10 flex flex-col">
              <div className="flex justify-between items-start mb-5">
                 <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-indigo-100 shadow-sm">{p.category}</span>
                 <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-300' : 'text-slate-500'}`}>TRL {p.trl}</span>
                    <span className={`w-2 h-2 rounded-full ${p.status === 'In Progress' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                 </div>
              </div>

              <h3 className={`text-2xl font-black leading-tight group-hover:text-indigo-600 transition-colors line-clamp-3 uppercase italic mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {p.title}
              </h3>
              
              <p className={`text-[11px] font-medium leading-relaxed line-clamp-3 mb-6 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {p.description}
              </p>

              <div className="mt-auto space-y-5">
                  {/* Keywords */}
                  <div className="flex flex-wrap gap-2">
                    {p.keywords?.slice(0, 3).map((k, i) => (
                        <span key={i} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase border ${isLight ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-white/5 text-slate-400 border-white/5'}`}>
                            #{k}
                        </span>
                    ))}
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-end justify-between border-t border-slate-50 pt-5">
                    <div className="w-full mr-6">
                        <div className="flex justify-between mb-1.5">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Research Progress</span>
                            <span className="text-[9px] font-black text-indigo-600">{p.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-1000 group-hover:bg-indigo-600" style={{ width: `${p.progress}%` }}></div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm shrink-0">
                        <i className="fa-solid fa-arrow-right text-xs"></i>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectGallery;
