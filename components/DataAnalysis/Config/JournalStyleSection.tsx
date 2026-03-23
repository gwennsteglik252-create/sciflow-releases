
import React, { useState } from 'react';
import { SCIENTIFIC_THEMES, ScientificTheme } from '../../../ScientificThemes';

interface JournalStyleSectionProps {
  activeScientificTheme: string | null;
  applyScientificTheme: (theme: ScientificTheme) => void;
}

export const JournalStyleSection: React.FC<JournalStyleSectionProps> = ({
  activeScientificTheme, applyScientificTheme
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 shadow-sm transition-all overflow-hidden space-y-3">
      <div className="flex justify-between items-center px-1 cursor-pointer group" onClick={() => setIsExpanded(!isExpanded)}>
           <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
               <i className="fa-solid fa-medal text-amber-500"></i> 顶刊投稿风格
           </h4>
           <button 
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${isExpanded ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
           >
               {isExpanded ? '收起' : '展开'}
           </button>
      </div>
      
      {isExpanded && (
          <div className="animate-reveal space-y-3">
              <div className="relative group/journal">
                  <select 
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase text-slate-700 outline-none cursor-pointer hover:border-indigo-400 transition-all appearance-none shadow-sm"
                      value={activeScientificTheme || ''}
                      onChange={(e) => {
                          const theme = SCIENTIFIC_THEMES[e.target.value];
                          if (theme) applyScientificTheme(theme);
                      }}
                  >
                      <option value="" disabled>选择期刊预设风格...</option>
                      {Object.values(SCIENTIFIC_THEMES).map(theme => (
                          <option key={theme.id} value={theme.id}>{theme.name}</option>
                      ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <i className="fa-solid fa-chevron-down text-[10px]"></i>
                  </div>
              </div>

              {activeScientificTheme && SCIENTIFIC_THEMES[activeScientificTheme] && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-inner flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                          <span className="text-[8px] font-black text-indigo-600 uppercase">
                            {SCIENTIFIC_THEMES[activeScientificTheme].name}
                          </span>
                          <span className="text-[7px] text-slate-400 font-bold uppercase">
                            {SCIENTIFIC_THEMES[activeScientificTheme].id === 'jacs' ? 'Serif / Compact' : 'Sans-Serif / Clean'}
                          </span>
                      </div>
                      <div className="flex gap-1">
                          {SCIENTIFIC_THEMES[activeScientificTheme].chartConfig.colors.slice(0, 4).map((c, i) => (
                              <div key={i} className="w-2.5 h-2.5 rounded-full border border-black/5" style={{ backgroundColor: c }}></div>
                          ))}
                      </div>
                  </div>
              )}
              <p className="text-[7px] text-slate-400 italic text-center px-1">选择后将同步色彩、字体与线框比例标准。</p>
          </div>
      )}
    </section>
  );
};
