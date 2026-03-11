
import React from 'react';
import { PaperSection } from '../../../types';

interface PublishingSidebarProps {
  isOpen: boolean;
  projectSections: PaperSection[];
  onScrollToSection: (id: string) => void;
  onManageSections?: () => void;
}

export const PublishingSidebar: React.FC<PublishingSidebarProps> = ({
  isOpen,
  projectSections,
  onScrollToSection,
  onManageSections
}) => {
  return (
    <div className={`sidebar-transition shrink-0 bg-slate-900/80 backdrop-blur-3xl border-r border-white/10 flex flex-col no-print overflow-hidden ${isOpen ? 'w-64' : 'w-0 opacity-0 border-none'}`}>
      <div className="p-6 flex flex-col gap-3 min-w-[16rem] h-full">
         <div className="flex justify-between items-center mb-4 shrink-0">
             <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2rem] flex items-center gap-2">
                <i className="fa-solid fa-list-ul"></i> 文档动态大纲
             </h4>
         </div>
         
         <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
             {projectSections.map((sec, idx) => (
                <button 
                   key={sec.id}
                   onClick={() => onScrollToSection(sec.id)}
                   className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-indigo-600/20 transition-all text-left group border border-transparent hover:border-indigo-500/30 active:scale-95"
                >
                   <span className="text-[9px] font-black text-slate-500 group-hover:text-indigo-400 w-5 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                   <span className="text-[11px] font-black text-slate-300 group-hover:text-white uppercase truncate tracking-tight">{sec.title}</span>
                </button>
             ))}
             {/* 参考文献始终存在 */}
             <button 
                onClick={() => onScrollToSection('refs')}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-indigo-600/20 transition-all text-left group border border-transparent hover:border-indigo-500/30 active:scale-95"
             >
                <i className="fa-solid fa-quote-left text-slate-500 group-hover:text-indigo-400 text-xs w-5 text-center"></i>
                <span className="text-[11px] font-black text-slate-300 group-hover:text-white uppercase truncate tracking-tight">References</span>
             </button>
         </div>

         {onManageSections && (
             <div className="pt-4 mt-auto border-t border-white/10 shrink-0">
                 <button 
                     onClick={onManageSections}
                     className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black text-slate-300 uppercase hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all flex items-center justify-center gap-2 group"
                 >
                     <i className="fa-solid fa-pen-to-square group-hover:rotate-12 transition-transform"></i>
                     管理章节结构
                 </button>
             </div>
         )}
      </div>
    </div>
  );
};
