import React, { useMemo, useState } from 'react';
import { Literature, ExtractedTable } from '../../types';
import ScientificMarkdown from '../Common/ScientificMarkdown';

interface BenchmarkingViewProps {
  resources: Literature[];
}

const BenchmarkingView: React.FC<BenchmarkingViewProps> = ({ resources }) => {
  const [selectedTable, setSelectedTable] = useState<ExtractedTable | null>(null);

  // Aggregate all extracted performance metrics from all papers
  const allPerformancePoints = useMemo(() => {
      const points: { label: string; values: { paperTitle: string, value: string }[] }[] = [];
      const labels = new Set<string>();
      
      resources.forEach(r => {
          r.performance?.forEach(p => labels.add(p.label));
      });

      Array.from(labels).forEach(label => {
          const vals: { paperTitle: string, value: string }[] = [];
          resources.forEach(r => {
              const match = r.performance?.find(p => p.label === label);
              if (match) vals.push({ paperTitle: r.title, value: match.value });
          });
          points.push({ label, values: vals });
      });

      return points;
  }, [resources]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 bg-slate-50/30 flex flex-col gap-10">
        <header className="flex flex-col gap-2">
            <h3 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-4 leading-none">
                <i className="fa-solid fa-database text-emerald-600"></i> 项目知识沉淀池
            </h3>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3rem] pl-12">AGGREGATED KNOWLEDGE BENCHMARKING</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left: Global Parameters Matrix */}
            <div className="xl:col-span-8 space-y-6">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-8">
                        <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2rem] italic">跨文献核心参数矩阵 (PARAMETER HEATMAP)</h4>
                        <span className="text-[8px] font-black text-slate-300 uppercase">AI Extracted from {resources.filter(r => r.knowledgeSinked).length} Papers</span>
                    </div>

                    <div className="space-y-4">
                        {allPerformancePoints.map((point, idx) => (
                            <div key={idx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 group hover:border-indigo-300 transition-all">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-[11px] font-black text-slate-800 uppercase italic">{point.label}</span>
                                    <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">{point.values.length} 组对比</span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {point.values.map((v, vi) => (
                                        <div key={vi} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 hover:shadow-md transition-all max-w-[180px]">
                                            <p className="text-[13px] font-black text-emerald-600 font-mono italic leading-none">{v.value}</p>
                                            <p className="text-[8px] font-bold text-slate-400 truncate uppercase mt-1" title={v.paperTitle}>{v.paperTitle}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {allPerformancePoints.length === 0 && (
                            <div className="py-20 text-center opacity-20 italic">
                                <i className="fa-solid fa-braille text-5xl mb-4"></i>
                                <p className="text-sm font-black uppercase">等待执行“知识沉淀”以激活矩阵</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Extracted Tables Feed */}
            <div className="xl:col-span-4 flex flex-col gap-6">
                <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white flex-1 overflow-hidden flex flex-col border border-white/5">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2rem] mb-6 flex items-center gap-3 shrink-0">
                        <i className="fa-solid fa-table"></i> 结构化表格源流
                    </h4>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {resources.flatMap(r => r.extractedTables || []).map(table => (
                            <div 
                                key={table.id} 
                                onClick={() => setSelectedTable(table)}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedTable?.id === table.id ? 'bg-indigo-600 border-indigo-500 shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h5 className="text-[11px] font-black uppercase italic leading-tight line-clamp-2">{table.title}</h5>
                                    <i className="fa-solid fa-arrow-right-to-bracket text-[10px] opacity-20 group-hover:opacity-100"></i>
                                </div>
                                <div className="flex gap-2">
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{table.rows.length} ROWS</span>
                                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{table.headers.length} COLS</span>
                                </div>
                            </div>
                        ))}
                        {resources.every(r => !r.extractedTables?.length) && (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3 italic">
                                <i className="fa-solid fa-table-cells text-3xl"></i>
                                <p className="text-[9px] font-black uppercase">暂无沉淀表格</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Modal for Full Table Preview */}
        {selectedTable && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[6000] flex items-center justify-center p-4 lg:p-12">
                <div className="bg-white w-full max-w-6xl rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border-4 border-white/20 animate-reveal">
                    <header className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <i className="fa-solid fa-table text-xl"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter">{selectedTable.title}</h3>
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3rem] mt-1">Extracted Experimental Data Block</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedTable(null)} className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-xl"></i></button>
                    </header>
                    <div className="flex-1 overflow-auto p-12 bg-slate-50">
                        <div className="max-w-full mx-auto bg-white p-8 rounded-[2rem] shadow-xl border border-slate-200">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b-2 border-slate-900">
                                        {selectedTable.headers.map((h, i) => (
                                            <th key={i} className="px-6 py-4 text-[11px] font-black uppercase text-slate-800 tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedTable.rows.map((row, ri) => (
                                        <tr key={ri} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                                            {row.map((cell, ci) => (
                                                <td key={ci} className="px-6 py-4 text-[10px] font-bold text-slate-600 italic leading-relaxed">{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default BenchmarkingView;