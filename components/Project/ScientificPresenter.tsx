
import React from 'react';
import { ResearchProject } from '../../types';
import { usePptLogic, ReportLevel } from '../../hooks/usePptLogic';
import { useFileExport } from '../../hooks/useFileExport';

interface ScientificPresenterProps {
  project: ResearchProject;
}

// 简易 LaTeX 渲染组件
const LaTeXText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\$.*?\$)/);
  return (
    <span className="text-[10px] leading-relaxed text-slate-700 font-serif text-justify">
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <span key={i} className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1 mx-0.5 rounded border border-indigo-100">{part.slice(1, -1)}</span>;
        }
        return part;
      })}
    </span>
  );
};

const ScientificPresenter: React.FC<ScientificPresenterProps> = ({ project }) => {
  const {
    startDate, setStartDate,
    endDate, setEndDate,
    reportLevel, handleLevelChange,
    isGenerating,
    slides,
    handleGenerate,
    getVbaScript, // Changed from copyVBAScript to getter
    getMarkdown,  // Changed from copyMarkdown to getter
    filteredLogs,
    logSourceMode
  } = usePptLogic(project);

  const { handleSecureSave } = useFileExport();

  // Generate standardized filename: e.g., Ag-AEM_研报_20260108
  const getStandardFileName = (ext: string) => {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
      return `${safeTitle}_研报_${dateStr}.${ext}`;
  };

  const onExportVBA = () => {
      const script = getVbaScript();
      if (!script) return;
      // Convert to Blob for proper encoding and file handling
      const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
      handleSecureSave(getStandardFileName('vbs'), blob);
  };

  const onExportMarkdown = () => {
      const md = getMarkdown();
      if (!md) return;
      // Convert to Blob for proper encoding
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      handleSecureSave(getStandardFileName('md'), blob);
  };

  const reportLabel = reportLevel === 'weekly' ? '周报' : reportLevel === 'monthly' ? '月报' : '结题';
  const disableGenerate = isGenerating || filteredLogs.length === 0;
  const disabledReason = isGenerating
    ? '正在生成中，请稍候'
    : filteredLogs.length === 0
      ? '当前时间范围内没有可用实验日志'
      : '';
  const generateButtonText = isGenerating
    ? 'AI 提炼中...'
    : reportLevel === 'weekly'
      ? '生成周报 PPT'
      : reportLevel === 'monthly'
        ? '生成月报 PPT'
        : '生成结题 PPT';

  return (
    <div className="flex-1 p-6 lg:p-10 bg-white/80 backdrop-blur-xl rounded-[3rem] border border-slate-200 shadow-sm animate-reveal flex flex-col h-full overflow-hidden relative">
      
      {/* 顶部控制区 */}
      <header className="flex flex-wrap items-end justify-between gap-6 mb-8 shrink-0">
        <div>
          <h3 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter border-l-4 border-indigo-600 pl-4 mb-2">成果转化中心</h3>
          <div className="flex items-center gap-2 pl-5">
             <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verified Data to Scientific Slides</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
           <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-400 uppercase px-1">时间跨度</label>
              <div className="flex items-center gap-2">
                <input type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-slate-300">-</span>
                <input type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
           </div>
           
           <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

           <div className="flex bg-slate-200/50 p-1 rounded-xl">
              {(['weekly', 'monthly', 'final'] as ReportLevel[]).map(level => (
                <button 
                  key={level}
                  onClick={() => handleLevelChange(level)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportLevel === level ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {level === 'weekly' ? '周报' : level === 'monthly' ? '月报' : '结题'}
                </button>
              ))}
           </div>

           <button 
             onClick={handleGenerate} 
             disabled={disableGenerate} 
             title={disableGenerate ? disabledReason : '根据当前筛选范围生成汇报'}
             className="ml-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
           >
             {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>}
             {generateButtonText}
           </button>
           <div className="ml-1 min-w-[180px]">
             <p className="text-[9px] font-bold text-slate-500">
               可用日志: <span className={filteredLogs.length > 0 ? 'text-emerald-600' : 'text-rose-500'}>{filteredLogs.length}</span>
             </p>
             {filteredLogs.length > 0 && logSourceMode === 'fallback_all' && (
               <p className="text-[9px] text-amber-600 leading-tight">当前使用未审核日志(Pending/Anomaly)生成</p>
             )}
             {disableGenerate && (
               <p className="text-[9px] text-rose-500 leading-tight">{disabledReason}</p>
             )}
           </div>
        </div>
      </header>

      {/* 多页预览区 */}
      <div className="flex-1 min-h-0 bg-slate-100/50 rounded-[2.5rem] border border-slate-200 p-6 overflow-y-auto custom-scrollbar relative">
        {slides.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{reportLabel}模板 · {slides.length} 页</p>
              <p className="text-[10px] font-bold text-slate-400">可直接导出 Markdown / VBA</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {slides.map((slide) => (
                <article key={slide.pageNumber} className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded-full border border-indigo-100">
                      Slide {String(slide.pageNumber).padStart(2, '0')}
                    </div>
                    <h4 className="text-sm font-black text-slate-800 italic text-right">{slide.title}</h4>
                  </div>

                  {slide.subTitle && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l-2 border-indigo-300 pl-3">{slide.subTitle}</p>
                  )}

                  {slide.tableData && slide.tableData.length > 0 && (
                    <div className="overflow-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            {slide.tableData[0].map((h, i) => (
                              <th key={i} className="p-2 text-[9px] font-black border-b border-indigo-500">
                                <LaTeXText text={h} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {slide.tableData.slice(1).map((row, i) => (
                            <tr key={i} className={`border-b border-slate-50 last:border-0 ${i % 2 === 0 ? 'bg-indigo-50/25' : 'bg-white'}`}>
                              {row.map((cell, j) => (
                                <td key={j} className="p-2 text-[9px] text-slate-700 align-top">
                                  <LaTeXText text={cell} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {slide.points && slide.points.length > 0 && (
                    <div className="space-y-2">
                      {slide.points.map((point, i) => (
                        <div key={i} className="flex gap-2 text-[10px] text-slate-700 leading-relaxed">
                          <span className="text-indigo-500 font-black">•</span>
                          <LaTeXText text={point} />
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.nextSteps && slide.nextSteps.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Next Steps</p>
                      <div className="flex flex-wrap gap-2">
                        {slide.nextSteps.map((step, i) => (
                          <span key={i} className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-[9px] text-indigo-600 font-bold">{step}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-40 gap-4">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100">
                <i className="fa-solid fa-presentation-screen text-4xl text-slate-300"></i>
             </div>
             <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3rem]">请选择日期范围并生成报告</p>
          </div>
        )}
      </div>

      {/* 底部操作区 */}
      {slides.length > 0 && (
        <footer className="mt-6 flex justify-end gap-3 shrink-0 animate-reveal">
           <button onClick={onExportMarkdown} className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:border-indigo-300 transition-all flex items-center gap-2 active:scale-95">
             <i className="fa-solid fa-file-lines text-slate-400"></i> 导出 MARKDOWN 报告
           </button>
           <button onClick={onExportVBA} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2 active:scale-95">
             <i className="fa-solid fa-file-powerpoint text-rose-500"></i> 导出 PPT (VBA)
           </button>
        </footer>
      )}
    </div>
  );
};

export default ScientificPresenter;
