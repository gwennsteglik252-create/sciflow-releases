import React from 'react';
import { ResearchProject } from '../../types';

interface ProjectIntroductionProps {
  project: ResearchProject | undefined;
  resourcesCount: number;
}

const ProjectIntroduction: React.FC<ProjectIntroductionProps> = ({ project, resourcesCount }) => {
  const resourceStats = {
    papers: resourcesCount,
    highIntel: resourcesCount > 5 ? 'HIGH' : 'MID'
  };

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-8 overflow-y-auto custom-scrollbar bg-slate-50/20">
      <div className="max-w-6xl mx-auto w-full space-y-8 animate-reveal">
        <header className="text-left border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-indigo-600/80 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">PROJECT INTEL</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v12.5 ACTIVE</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <i className="fa-solid fa-microscope text-indigo-600 text-3xl mt-1.5"></i>
            <h3 className="text-4xl font-black text-slate-800 italic uppercase tracking-tighter leading-none">{project?.title}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {project?.keywords?.map((k, i) => (
              <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-500 uppercase italic shadow-sm hover:border-indigo-300 transition-colors cursor-default"># {k}</span>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2rem] mb-4 flex items-center gap-2 italic">
                <i className="fa-solid fa-align-left"></i> 课题背景与核心描述
              </h4>
              <p className="text-sm font-bold text-slate-700 leading-loose italic text-justify opacity-90 relative z-10">{project?.description}</p>
            </section>

            <section className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2rem] italic border-l-2 border-indigo-500 pl-4">情报捕捉深度评估</h4>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AUTOMATED ANALYSIS</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">文献关联度</p>
                  <p className="text-xl font-black italic text-indigo-400">{resourceStats.highIntel}</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">专利壁垒</p>
                  <p className="text-xl font-black italic text-emerald-400">CORE</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">TRL 成熟度</p>
                  <p className="text-xl font-black italic text-amber-400">Lv.{project?.trl || 1}</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[7px] font-black text-slate-400 uppercase mb-1">节点完成率</p>
                  <p className="text-xl font-black italic text-rose-400">{project?.progress}%</p>
                </div>
              </div>
            </section>
          </div>

          <div className="md:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">项目情报档案统计</p>
              <div className="text-4xl font-black text-indigo-600">{resourcesCount}</div>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">TOTAL INTELLIGENCE ASSETS</p>
            </div>

            <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 flex flex-col items-center justify-center text-center gap-4 group cursor-pointer hover:bg-slate-900 transition-all">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-magnifying-glass-plus text-2xl"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1">开始捕捉情报</p>
                <p className="text-[8px] font-bold opacity-60 uppercase">请从左侧选择条目查阅深度解析</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectIntroduction;