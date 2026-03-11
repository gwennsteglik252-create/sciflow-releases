import React from 'react';
import { useProjectContext } from '../../context/ProjectContext';

const GlobalSearchOverlay: React.FC = () => {
  const { searchQuery, setSearchQuery, searchResults, setCitationBuffer } = useProjectContext();

  if (searchQuery === '') return null;

  const literatureResults = searchResults.filter(r => r.type === 'literature');
  const logResults = searchResults.filter(r => r.type === 'log');
  const failureLogs = logResults.filter(r => r.isFailure);
  const successLogs = logResults.filter(r => !r.isFailure);
  const reportResults = searchResults.filter(r => r.type === 'report');

  const handleCite = (text: string) => {
    setCitationBuffer(text);
    setSearchQuery(''); // Close search
  };

  return (
    <div className="fixed inset-0 bg-white/98 backdrop-blur-3xl z-[2000] flex flex-col p-6 lg:p-12 animate-in fade-in duration-300">
      <header className="flex items-center mb-10 max-w-7xl mx-auto w-full border-b border-slate-100 pb-8 gap-6">
         {/* Close button moved to the left */}
         <button onClick={() => setSearchQuery('')} className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95 shrink-0">
            <i className="fa-solid fa-times text-xl"></i>
         </button>

         <div className="flex items-center gap-6 flex-1">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner">
                <i className="fa-solid fa-magnifying-glass text-indigo-600 text-xl"></i>
            </div>
            <input 
              autoFocus
              className="bg-transparent border-none text-4xl font-black text-slate-900 outline-none w-full placeholder:text-slate-300 italic tracking-tighter"
              placeholder="搜索知识图谱: 文献、实录、研报..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
         </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-12 gap-10 overflow-hidden">
        {/* Main Results Column */}
        <div className="col-span-12 lg:col-span-8 overflow-y-auto custom-scrollbar pr-6 space-y-12 pb-20">
          
          {/* 1. Literature Section */}
          {literatureResults.length > 0 && (
            <section className="animate-reveal">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3rem] mb-6 flex items-center gap-3">
                <i className="fa-solid fa-book-atlas"></i> 关联文献知识库 ({literatureResults.length})
                <div className="flex-1 h-px bg-indigo-100"></div>
              </h4>
              <div className="space-y-6">
                {literatureResults.map(r => (
                  <div key={r.id} className="bg-white border border-slate-200 p-8 rounded-[2.5rem] hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-20"></div>
                    <div className="flex justify-between items-start mb-3">
                      <h5 className="text-xl font-black text-slate-800 leading-tight italic group-hover:text-indigo-600 transition-colors">{r.title}</h5>
                      <button onClick={() => handleCite(`${r.title} (${r.metadata?.authors?.[0]} et al., ${r.metadata?.year})`)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all shadow-xl shadow-indigo-100 active:scale-95 whitespace-nowrap">一键引用</button>
                    </div>
                    <p className="text-[13px] text-slate-500 line-clamp-3 leading-relaxed mb-5 font-medium">{r.content}</p>
                    <div className="flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                       <span className="bg-slate-50 px-2 py-0.5 rounded">{r.metadata?.authors?.join(', ')}</span>
                       <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full opacity-30"></span>
                       <span className="bg-slate-50 px-2 py-0.5 rounded">{r.metadata?.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Success Logs & Reports */}
          {(successLogs.length > 0 || reportResults.length > 0) && (
            <section className="animate-reveal" style={{ animationDelay: '0.1s' }}>
              <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3rem] mb-6 flex items-center gap-3">
                <i className="fa-solid fa-check-double"></i> 实验成果与总结 ({successLogs.length + reportResults.length})
                <div className="flex-1 h-px bg-emerald-100"></div>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {successLogs.map(r => (
                  <div key={r.id} className="bg-emerald-50/30 border border-emerald-100 p-6 rounded-[2rem] hover:bg-white hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 transition-all group border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[8px] font-black text-emerald-600 uppercase px-2.5 py-1 bg-white border border-emerald-100 rounded-lg shadow-sm">{r.projectTitle}</span>
                      <button onClick={() => handleCite(r.content)} className="w-10 h-10 rounded-xl bg-emerald-600 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-lg shadow-emerald-100 active:scale-90"><i className="fa-solid fa-quote-right text-xs"></i></button>
                    </div>
                    <h5 className="text-[14px] font-black text-slate-800 mb-2 truncate italic uppercase">{r.title}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 italic font-medium leading-relaxed">{r.content}</p>
                  </div>
                ))}
                {reportResults.map(r => (
                  <div key={r.id} className="bg-indigo-50/30 border border-indigo-100 p-6 rounded-[2rem] hover:bg-white hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group border-l-4 border-l-indigo-500">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[8px] font-black text-indigo-600 uppercase px-2.5 py-1 bg-white border border-indigo-100 rounded-lg shadow-sm">研报: {r.projectTitle}</span>
                      <button onClick={() => handleCite(r.content)} className="w-10 h-10 rounded-xl bg-indigo-600 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-lg shadow-indigo-100 active:scale-90"><i className="fa-solid fa-quote-right text-xs"></i></button>
                    </div>
                    <h5 className="text-[14px] font-black text-slate-800 mb-2 truncate italic uppercase">{r.title}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 italic font-medium leading-relaxed">{r.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {searchResults.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-200 py-40 animate-reveal">
               <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center border-4 border-dashed border-slate-100 mb-8">
                <i className="fa-solid fa-diagram-project text-5xl opacity-40"></i>
               </div>
               <p className="text-2xl font-black uppercase tracking-[0.8rem] opacity-40 text-slate-800 italic">未探测到关联知识节点</p>
            </div>
          )}
        </div>

        {/* Associated Failures Sidebar (Associated Recommendations) */}
        <div className="hidden lg:block col-span-4 border-l border-slate-100 pl-10 overflow-y-auto custom-scrollbar animate-reveal" style={{ animationDelay: '0.2s' }}>
           <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.3rem] mb-8 flex items-center gap-3">
             <i className="fa-solid fa-triangle-exclamation"></i> 参数预警: 历史失败
             <div className="flex-1 h-px bg-rose-100"></div>
           </h4>
           
           <div className="space-y-6">
              {failureLogs.length > 0 ? failureLogs.map(r => (
                <div key={r.id} className="bg-rose-50/50 border border-rose-100 p-6 rounded-[2rem] group relative overflow-hidden transition-all hover:bg-rose-50 hover:shadow-lg hover:shadow-rose-100">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fa-solid fa-skull-crossbones text-rose-600 text-3xl"></i></div>
                   <p className="text-[8px] font-black text-rose-500 uppercase mb-2 tracking-widest">项目: {r.projectTitle}</p>
                   <h5 className="text-[13px] font-black text-slate-800 mb-3 leading-snug uppercase italic">{r.title}</h5>
                   <div className="p-4 bg-white rounded-2xl border border-rose-100 mb-4 shadow-inner">
                      <p className="text-[10px] text-rose-800 font-bold italic leading-relaxed">{r.content}</p>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black text-slate-400 uppercase font-mono">{r.metadata?.timestamp}</span>
                      <button onClick={() => handleCite(`历史失败记录警告: ${r.content}`)} className="text-[9px] font-black text-rose-500 uppercase hover:underline flex items-center gap-1">
                        引用结论 <i className="fa-solid fa-arrow-right text-[7px]"></i>
                      </button>
                   </div>
                </div>
              )) : (
                <div className="p-12 border-2 border-dashed border-slate-100 rounded-[2.5rem] text-center bg-slate-50/30">
                   <i className="fa-solid fa-shield-check text-slate-100 text-4xl mb-4"></i>
                   <p className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">针对此参数暂无失败预警</p>
                </div>
              )}
           </div>

           <div className="mt-12 bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100/50 relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-600/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <i className="fa-solid fa-lightbulb"></i> 搜索建议
              </h5>
              <p className="text-[12px] text-indigo-900/70 font-medium leading-relaxed italic text-justify">
                搜索特定化学式 (如 $AgNO_3$)、实验编号或关键性能指标 (如 $E_{1/2}$) 可获得跨课题、跨文献的精准图谱联动结果。
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchOverlay;
