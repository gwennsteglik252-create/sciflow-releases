
import React, { useEffect, useRef } from 'react';
import { ResearchProject, Milestone } from '../../../types';

interface MaterialsPanelProps {
  project: ResearchProject | undefined;
  docType: 'paper' | 'report' | 'patent';
  selectedLogIds: Set<string>;
  onToggleLogSelection: (id: string) => void;
  expandedMilestoneIds: Set<string>;
  onToggleMilestone: (id: string) => void;
  onGeneratePlanActual: () => void;
  onFlowchartToEmbodiment: () => void;
  onSynthesizeResults: () => void;
  onInsertText: (text: string) => void;
  onGenerateMethodology: (ms: Milestone) => void;
  onGenerateCaption: (desc: string) => void;
  onGenerateConclusion: (log: any) => void;
  onFindToken?: (type: 'Log', id: string) => void;
  isProcessing: boolean;
  highlightedResourceId?: string[] | null; 
}

const MaterialsPanel: React.FC<MaterialsPanelProps> = ({
  project, docType, selectedLogIds, onToggleLogSelection,
  expandedMilestoneIds, onToggleMilestone,
  onGeneratePlanActual, onFlowchartToEmbodiment, onSynthesizeResults,
  onInsertText, onGenerateMethodology, onGenerateCaption, onGenerateConclusion, onFindToken, isProcessing,
  highlightedResourceId
}) => {
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightedResourceId && highlightedResourceId.length > 0) {
        const id = highlightedResourceId[0];
        const target = itemRefs.current[id];
        if (target) {
            const timer = setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return () => clearTimeout(timer);
        }
    }
  }, [highlightedResourceId]);
  
  const getIsInserted = (logId: string) => {
    if (!project?.paperSections) return false;
    const pattern = new RegExp(`\\[Log:\\s*${logId}\\s*\\]`, 'i');
    return project.paperSections.some(s => pattern.test(s.content || ''));
  };

  return (
    <div className="space-y-5 animate-reveal">
      <style>{`
        @keyframes radar-pulse {
            0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); transform: scale(1); }
            50% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); transform: scale(1.01); }
            100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); transform: scale(1); }
        }
        .animate-radar-highlight {
            animation: radar-pulse 1.5s infinite ease-in-out;
            border-color: #6366f1 !important;
            z-index: 50;
        }
      `}</style>

      {docType === 'report' && (
        <button onClick={onGeneratePlanActual} disabled={isProcessing} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform">
          {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-table-list"></i> 生成进度对比表</>}
        </button>
      )}
      {docType === 'patent' && (
        <button onClick={onFlowchartToEmbodiment} disabled={isProcessing} className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform">
          {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-wand-magic-sparkles"></i> 流程图转实施例</>}
        </button>
      )}
      {selectedLogIds.size > 1 && (
        <button onClick={onSynthesizeResults} disabled={isProcessing} className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform">
          {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-layer-group"></i> 对比已选记录 ({selectedLogIds.size})</>}
        </button>
      )}
      
      <div className="space-y-3 pt-2 border-b border-slate-100 pb-4">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">诊断分析归档</p>
        <div className="space-y-2">
          {project?.weeklyReports?.filter(r => r && r.reportType === 'Diagnostic').map(rep => (
            <div key={rep.id} className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-all cursor-pointer group" onClick={() => onInsertText(`\n### ${rep.title}\n${rep.content}\n`)}>
              <div className="flex justify-between items-start mb-0.5">
                <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tight">{rep.timestamp.split(' ')[0]}</span>
                <i className="fa-solid fa-plus text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity text-[8px]"></i>
              </div>
              <p className="text-[9px] font-bold text-slate-700 line-clamp-1 truncate">{rep.title}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">研究节点素材</p>
        {project?.milestones.map(ms => {
          const isExpanded = expandedMilestoneIds.has(ms.id);
          return (
            <div key={ms.id} className="border-b border-slate-50 last:border-0 pb-2">
              <div onClick={() => onToggleMilestone(ms.id)} className="flex justify-between items-center mb-1.5 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg transition-all">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[7px] text-slate-400`}></i>
                  <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[150px]">{ms.title}</h4>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase ${ms.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{ms.status}</span>
              </div>
              {isExpanded && (
                <div className="animate-reveal pl-1.5 space-y-1.5 mb-2">
                  {ms.logs.map(log => {
                    const isInserted = getIsInserted(log.id);
                    const isHighlighted = highlightedResourceId?.includes(log.id);
                    return (
                      <div 
                        key={log.id} 
                        ref={el => { itemRefs.current[log.id] = el; }}
                        className={`p-2.5 rounded-xl border transition-all ${isHighlighted ? 'animate-radar-highlight bg-indigo-50 border-indigo-500' : selectedLogIds.has(log.id) ? 'bg-indigo-50 border-indigo-200' : (isInserted ? 'border-emerald-200 bg-emerald-50/20' : 'bg-white border-slate-100 shadow-sm')}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input type="checkbox" checked={selectedLogIds.has(log.id)} onChange={() => onToggleLogSelection(log.id)} className="mt-0.5 accent-indigo-600 scale-90" />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-1">
                              <span className="text-[7px] font-black text-slate-400">{log.timestamp.split(' ')[0]}</span>
                              <div className="flex gap-1.5 items-center">
                                {isInserted && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onFindToken?.('Log', log.id); }}
                                        className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-xs"
                                        title="定位文中引用"
                                    >
                                        <i className="fa-solid fa-location-crosshairs text-[8px]"></i>
                                    </button>
                                )}
                                <span className={`w-1 h-1 rounded-full ${log.result === 'success' ? 'bg-emerald-400' : log.status === 'Anomaly' ? 'bg-rose-600' : 'bg-amber-400'}`}></span>
                              </div>
                            </div>
                            <div className="text-[9px] text-slate-600 italic line-clamp-1 leading-tight mb-1.5 cursor-pointer" onClick={() => onInsertText(`[Log:${log.id}]`)} title="点击在文中插入标签">{log.content}</div>
                            <div className="flex flex-wrap gap-1.5">
                              <button onClick={() => onGenerateMethodology(ms)} disabled={isProcessing} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 rounded text-[6.5px] font-bold uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all">Methods</button>
                              <button onClick={() => onGenerateConclusion(log)} disabled={isProcessing} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 rounded text-[6.5px] font-bold uppercase hover:bg-emerald-50 hover:text-emerald-600 transition-all">Conclusion</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MaterialsPanel;
