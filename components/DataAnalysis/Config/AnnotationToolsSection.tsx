
import React from 'react';
import { AnnotationType } from '../../../types';

interface AnnotationToolsSectionProps {
  activeTool: AnnotationType | 'select' | 'data-selector' | 'none';
  onSetActiveTool: (tool: any) => void;
}

export const AnnotationToolsSection: React.FC<AnnotationToolsSectionProps> = ({
  activeTool, onSetActiveTool
}) => {
  const tools: { 
    id: AnnotationType; 
    icon: string; 
    label: string; 
    isChar?: boolean; 
    isRegular?: boolean;
    color: string;
    activeBg: string;
    activeBorder: string;
    hoverBorder: string;
    shadow: string;
  }[] = [
      { 
        id: 'text', icon: 'A', label: '文字标注', isChar: true, 
        color: 'text-indigo-500', activeBg: 'bg-indigo-600', activeBorder: 'border-indigo-500', 
        hoverBorder: 'hover:border-indigo-300', shadow: 'shadow-indigo-200/50' 
      },
      { 
        id: 'arrow', icon: 'fa-arrow-right', label: '趋势箭头', 
        color: 'text-rose-500', activeBg: 'bg-rose-600', activeBorder: 'border-rose-500', 
        hoverBorder: 'hover:border-rose-300', shadow: 'shadow-rose-200/50' 
      },
      { 
        id: 'line', icon: 'fa-minus', label: '辅助直线', 
        color: 'text-emerald-500', activeBg: 'bg-emerald-600', activeBorder: 'border-emerald-500', 
        hoverBorder: 'hover:border-emerald-300', shadow: 'shadow-emerald-200/50' 
      },
      { 
        id: 'rect', icon: 'fa-square', label: '区域框选', isRegular: true, 
        color: 'text-violet-500', activeBg: 'bg-violet-600', activeBorder: 'border-violet-500', 
        hoverBorder: 'hover:border-violet-300', shadow: 'shadow-violet-200/50' 
      },
      { 
        id: 'circle', icon: 'fa-circle', label: '特征圆圈', isRegular: true, 
        color: 'text-amber-500', activeBg: 'bg-amber-600', activeBorder: 'border-amber-500', 
        hoverBorder: 'hover:border-amber-300', shadow: 'shadow-amber-200/50' 
      },
  ];

  return (
    <section className="bg-slate-50/50 p-4 rounded-[2.5rem] border border-slate-200 shadow-inner mt-4 animate-reveal relative overflow-hidden">
       {/* Decorative Background Element */}
       <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none">
          <i className="fa-solid fa-pen-nib text-5xl"></i>
       </div>

       <div className="flex justify-between items-center mb-4 px-1">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-marker text-indigo-400"></i> 图表标注工具集
          </h4>
          <div className="flex items-center gap-2">
            {activeTool !== 'none' && activeTool !== 'select' && (
                <span className="text-[7px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase animate-pulse shadow-sm">
                    In Use
                </span>
            )}
            <button 
              onClick={() => onSetActiveTool('none')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${activeTool === 'none' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-300 hover:text-slate-500 bg-white border border-slate-100'}`}
              title="选择/平移"
            >
                <i className="fa-solid fa-arrow-pointer text-[10px]"></i>
            </button>
          </div>
       </div>
       
       <div className="flex gap-2 w-full justify-between items-center relative z-10">
          {tools.map(tool => {
              const isActive = activeTool === tool.id;
              return (
                <button 
                  key={tool.id}
                  onClick={() => onSetActiveTool(activeTool === tool.id ? 'none' : tool.id)} 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 relative group/btn border-2 ${
                    isActive 
                      ? `${tool.activeBg} ${tool.activeBorder} text-white shadow-lg ${tool.shadow} scale-105 z-10` 
                      : `bg-white border-slate-100 ${tool.color} ${tool.hoverBorder} hover:shadow-md active:scale-95`
                  }`} 
                >
                   {tool.isChar ? (
                       <span className="font-black font-serif text-lg leading-none">{tool.icon}</span>
                   ) : (
                       <i className={`${tool.isRegular ? 'fa-regular' : 'fa-solid'} ${tool.icon} text-base`}></i>
                   )}
                   
                   {/* Floating Label on Hover */}
                   <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2.5 py-1.5 bg-slate-900/95 backdrop-blur-sm text-white text-[8px] font-black uppercase rounded-lg opacity-0 group-hover/btn:opacity-100 group-hover/btn:-translate-y-1 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 shadow-2xl border border-white/10">
                      {tool.label}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-900"></div>
                   </div>

                   {/* Subtle Glow Effect for Active Tool */}
                   {isActive && (
                      <div className={`absolute inset-0 rounded-2xl opacity-20 animate-ping pointer-events-none ${tool.activeBg}`}></div>
                   )}
                </button>
              );
          })}
       </div>
       
       <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter italic">
            <i className="fa-solid fa-circle-info mr-1"></i> 选中工具后在右侧图表区域拖拽即可添加标注
          </p>
          <button
            onClick={() => onSetActiveTool(activeTool === 'data-selector' ? 'none' : 'data-selector')}
            className={`shrink-0 ml-2 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase border-2 transition-all duration-300 flex items-center gap-1.5 ${
              activeTool === 'data-selector'
                ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-200/50 scale-105'
                : 'bg-white border-slate-100 text-cyan-500 hover:border-cyan-300 hover:shadow-md active:scale-95'
            }`}
            title="交互式数据选择器 — 在图表上框选数据范围"
          >
            <i className="fa-solid fa-crosshairs text-[9px]" />
            数据选择
          </button>
       </div>
    </section>
  );
};
