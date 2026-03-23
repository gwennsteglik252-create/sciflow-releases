
import React, { useMemo } from 'react';
import { ChartTemplate, ACADEMIC_TEMPLATES } from '../../../hooks/useDataAnalysisLogic';

interface TemplateSectionProps {
  showTemplateList: boolean;
  setShowTemplateList: (show: boolean) => void;
  userTemplates: ChartTemplate[];
  applyTemplate: (tpl: ChartTemplate) => void;
  onDeleteTemplate: (id: string, e: React.MouseEvent) => void;
  // 保持 props 接口兼容，但内部逻辑精简
  templateSearchQuery: string;
  setTemplateSearchQuery: (val: string) => void;
  handleDiscoverTemplate: () => void;
  isDiscoveringTemplate: boolean;
  onDiscoverFromImage?: (file: File) => void;
  onOpenGallery: () => void;
}

export const TemplateSection: React.FC<TemplateSectionProps> = ({
  showTemplateList, setShowTemplateList, userTemplates, applyTemplate, onDeleteTemplate,
  onOpenGallery
}) => {
  
  const recentTemplates = useMemo(() => {
    // 侧边栏仅显示最近 3 个用户模板和前 3 个标准模板，方便快速切换
    return [...userTemplates.slice(0, 3), ...ACADEMIC_TEMPLATES.slice(0, 3)];
  }, [userTemplates]);

  return (
    <section className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 shadow-sm transition-all overflow-hidden space-y-3">
      <div 
        className="flex justify-between items-center px-1 cursor-pointer group"
        onClick={() => setShowTemplateList(!showTemplateList)}
      >
           <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
               <i className="fa-solid fa-swatchbook text-indigo-500"></i> 图表模板库
           </h4>
           <button 
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${showTemplateList ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
           >
               {showTemplateList ? '收起' : '展开'}
           </button>
      </div>

      {showTemplateList && (
          <div className="animate-reveal space-y-4 flex flex-col items-center">
              {/* 核心操作入口：打开全量画廊 - 按照用户反馈缩小了宽度并保持居中 */}
              <button 
                  onClick={onOpenGallery}
                  className="w-[92%] py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-lg shadow-indigo-100 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 group"
              >
                  <i className="fa-solid fa-images group-hover:rotate-12 transition-transform"></i>
                  打开模板画廊与 AI 发现
              </button>
              
              <div className="space-y-1.5 w-full">
                  <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest px-2 mb-2">常用与最近使用</p>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {recentTemplates.map(tpl => (
                          <button 
                              key={tpl.id} 
                              onClick={() => applyTemplate(tpl)} 
                              className="w-full text-left p-3 hover:bg-white rounded-2xl transition-all border border-slate-100 hover:border-indigo-100 group bg-white/40 shadow-sm flex items-center justify-between"
                          >
                              <p className="text-[10px] font-black text-slate-700 group-hover:text-indigo-600 uppercase italic truncate pr-2">{tpl.name}</p>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tpl.color }}></div>
                          </button>
                      ))}
                  </div>
              </div>

              <div className="pt-2 border-t border-slate-200 w-full">
                  <p className="text-[7px] text-slate-400 italic text-center px-1">进入画廊可使用 AI 搜索及图片识别功能</p>
              </div>
          </div>
      )}
    </section>
  );
};
