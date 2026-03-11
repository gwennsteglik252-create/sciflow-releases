
import React from 'react';
import { MOCK_PROJECTS, Icons } from '../constants';
import { ProjectStatus } from '../types';

const StatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  const labels: Record<ProjectStatus, string> = {
    'Planning': '规划中',
    'In Progress': '进行中',
    'Peer Review': '同行评审',
    'Completed': '已结题',
    'Archived': '归档',
  };
  const colors: Record<ProjectStatus, string> = {
    'Planning': 'bg-slate-100 text-slate-600',
    'In Progress': 'bg-blue-100 text-blue-600',
    'Peer Review': 'bg-amber-100 text-amber-600',
    'Completed': 'bg-green-100 text-green-600',
    'Archived': 'bg-slate-200 text-slate-500',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${colors[status]}`}>
      {labels[status]}
    </span>
  );
};

const Projects: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">科研课题档案</h3>
          <p className="text-slate-500 mt-1 font-medium">集中管理和跟踪您的所有科学研究进程。</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all font-bold active:scale-95">
          <Icons.Plus /> 开启新课题
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {MOCK_PROJECTS.map((project) => (
          <div key={project.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer">
            <div className="flex justify-between items-start mb-6">
              <StatusBadge status={project.status} />
              <button className="text-slate-300 hover:text-indigo-600 transition-colors">
                <i className="fa-solid fa-ellipsis"></i>
              </button>
            </div>
            
            <h4 className="text-xl font-black text-slate-800 mb-3 leading-tight min-h-[3.5rem] group-hover:text-indigo-600 transition-colors">
              {project.title}
            </h4>
            
            <p className="text-slate-500 text-xs mb-8 line-clamp-2 font-medium leading-relaxed">
              {project.description}
            </p>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                  <span>总体任务进度</span>
                  <span className="text-slate-800">{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex -space-x-3">
                  {project.members.map((m, i) => (
                    <div key={i} className="w-8 h-8 rounded-xl border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 shadow-sm" title={m}>
                      {m.split(' ').map(n => n[0]).join('')}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase">
                  <i className="fa-regular fa-calendar text-indigo-500"></i>
                  {project.deadline}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button className="border-2 border-dashed border-slate-100 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all min-h-[350px] group">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
            <Icons.Plus />
          </div>
          <span className="font-black uppercase tracking-widest text-xs">添加新的研究课题</span>
        </button>
      </div>
    </div>
  );
};

export default Projects;
