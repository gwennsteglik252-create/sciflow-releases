
import React, { useMemo } from 'react';
import { TemplateConfig, DocType } from '../WritingConfig';

interface PublishingToolbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onBack?: () => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  isAutoZoom: boolean;
  setIsAutoZoom: (val: boolean) => void;
  isRightSidebarVisible?: boolean;
  onToggleRightSidebar?: () => void;
  activeTemplate: TemplateConfig;
  templates: TemplateConfig[];
  onSelectTemplate?: (id: string) => void;
  viewMode?: 'standard' | 'dual' | 'triple';
  docType: DocType;
}

export const PublishingToolbar: React.FC<PublishingToolbarProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  onBack,
  zoom,
  setZoom,
  isAutoZoom,
  setIsAutoZoom,
  isRightSidebarVisible,
  onToggleRightSidebar,
  activeTemplate,
  templates,
  onSelectTemplate,
  viewMode,
  docType
}) => {
  const isTriple = viewMode === 'triple';

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => t.docType === docType);
  }, [templates, docType]);

  const handleManualZoom = (direction: 1 | -1) => {
      // 点击 +/- 按钮时立即取消自动适配模式
      setIsAutoZoom(false);
      setZoom(prev => {
          const next = prev + (direction * 0.1);
          return Math.min(2.0, Math.max(0.2, Number(next.toFixed(2))));
      });
  };

  return (
    <div className="no-print p-2 sm:p-4 flex items-center gap-2 sm:gap-4 shrink-0 bg-slate-800/40 backdrop-blur-md border-b border-white/5 z-50">
      {!isTriple && (
          <button 
              onClick={onToggleSidebar}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 border ${isSidebarOpen ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/10 text-slate-300 border-white/10 hover:bg-indigo-600 hover:text-white'}`}
              title={isSidebarOpen ? "收起导航" : "展开导航"}
          >
              <i className={`fa-solid ${isSidebarOpen ? 'fa-indent' : 'fa-outdent'} text-base`}></i>
          </button>
      )}

      {onBack && (
        <button 
          onClick={onBack}
          className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white text-slate-700 rounded-full text-[10px] font-black uppercase shadow-2xl hover:bg-indigo-50 transition-all flex items-center gap-2 active:scale-95 border border-slate-200 whitespace-nowrap"
        >
          <i className="fa-solid fa-arrow-left"></i> 返回编辑器
        </button>
      )}
      
      <button 
          onClick={() => window.print()}
          className="px-4 sm:px-6 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 border border-indigo-400/50 whitespace-nowrap"
          title="导出 PDF"
      >
          <i className="fa-solid fa-print"></i> 导出
      </button>

      {/* 缩放控制区域：现在在任何视图模式下都支持手动/自动切换 */}
      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-full border border-white/10 ml-1 sm:ml-2">
          <button 
            onClick={() => handleManualZoom(-1)}
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="缩小"
          >
            <i className="fa-solid fa-minus text-[8px] sm:text-[10px]"></i>
          </button>
          
          <div className="flex items-center gap-1.5 px-1 sm:px-2 relative">
             <span className="w-10 sm:w-12 text-center text-[9px] sm:text-[10px] font-black text-indigo-200 font-mono">{(zoom * 100).toFixed(0)}%</span>
             <button 
               onClick={() => setIsAutoZoom(!isAutoZoom)}
               className={`text-[7px] font-black px-1.5 py-0.5 rounded transition-all border ${isAutoZoom ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-transparent text-slate-500 border-slate-700 hover:text-indigo-300'}`}
               title={isAutoZoom ? "切换为手动缩放模式" : "切换为宽度自动适配模式"}
             >
               AUTO
             </button>
          </div>

          <button 
            onClick={() => handleManualZoom(1)}
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="放大"
          >
            <i className="fa-solid fa-plus text-[8px] sm:text-[10px]"></i>
          </button>
      </div>
      
      <div className="ml-auto flex items-center gap-2 sm:gap-4 min-w-0">
          {onToggleRightSidebar && viewMode === 'standard' && (
              <button 
                  onClick={onToggleRightSidebar}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 border ${isRightSidebarVisible ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white/10 text-slate-300 border-white/10 hover:bg-indigo-600 hover:text-white'}`}
                  title={isRightSidebarVisible ? "隐藏右栏" : "展开右栏"}
              >
                  <i className={`fa-solid ${isRightSidebarVisible ? 'fa-indent' : 'fa-outdent'} fa-flip-horizontal text-base`}></i>
              </button>
          )}

          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 bg-black/30 rounded-2xl border border-white/10 shadow-inner group min-w-0">
              <span className="text-[8px] sm:text-[9px] font-black text-indigo-300 uppercase tracking-widest italic shrink-0 hidden sm:inline">模板:</span>
              <select 
                  className="bg-transparent text-[9px] sm:text-[10px] font-black text-white uppercase outline-none cursor-pointer hover:text-indigo-400 transition-colors truncate max-w-[80px] sm:max-w-[120px]"
                  value={activeTemplate.id}
                  onChange={(e) => onSelectTemplate?.(e.target.value)}
              >
                  {filteredTemplates.map(t => (
                      <option key={t.id} value={t.id} className="bg-slate-900">{t.name}</option>
                  ))}
                  {filteredTemplates.length === 0 && <option disabled>暂无匹配模板</option>}
              </select>
          </div>
      </div>
    </div>
  );
};
