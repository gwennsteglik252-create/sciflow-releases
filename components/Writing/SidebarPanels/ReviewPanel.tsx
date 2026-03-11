import React, { useState } from 'react';

interface ReviewPanelProps {
  onRunSimulatedReview: () => void;
  isProcessing: boolean;
  reviewResult: any;
  appliedCritiqueQuotes?: Set<string>;
  onReviewClick: (quote: string) => void;
  onApplySuggestion: (quote: string, revision: string) => void;
  // New Prop
  onOpenSubmissionSimulator?: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  onRunSimulatedReview, isProcessing, reviewResult, appliedCritiqueQuotes = new Set(), onReviewClick, onApplySuggestion,
  onOpenSubmissionSimulator
}) => {
  return (
    <div className="space-y-5 animate-reveal">
      <div className="grid grid-cols-1 gap-2 mb-6">
        <div 
            className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group bg-slate-50/50 cursor-pointer" 
            onClick={onRunSimulatedReview}
            title="点击执行 AI 模拟同行评审"
        >
            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            <i className="fa-solid fa-user-graduate"></i>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-500">
            {isProcessing ? '正在模拟评审...' : '启动模拟同行评审'}
            </p>
        </div>

        <button 
            onClick={onOpenSubmissionSimulator}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-3 border border-white/5 group"
        >
            <i className="fa-solid fa-vial-circle-check text-base group-hover:rotate-12 transition-transform"></i>
            进入投稿全栈模拟器
        </button>
      </div>

      <div className="flex items-center gap-3 mb-2 px-1">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-black shadow-inner">
          {reviewResult?.score || '-'}
        </div>
        <div>
          <h4 className="text-[10px] font-black text-slate-800 uppercase leading-none">审稿建议评分</h4>
          <p className="text-[8px] text-slate-400 mt-1 uppercase tracking-widest">Journal Reviewer Assessment</p>
        </div>
      </div>

      {reviewResult?.critiques && reviewResult.critiques.length > 0 ? (
        <div className="space-y-3">
          {reviewResult.critiques.map((critique: any, i: number) => {
            const isApplied = appliedCritiqueQuotes.has(critique.quote);
            
            return (
              <div key={i} className={`p-4 rounded-[2rem] border transition-all shadow-sm relative overflow-hidden ${isApplied ? 'bg-emerald-50 border-emerald-200' : (critique.severity === 'critical' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100')}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase shadow-sm ${isApplied ? 'bg-emerald-500 text-white' : (critique.severity === 'critical' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white')}`}>
                      {isApplied ? 'APPLIED' : critique.severity.toUpperCase()}
                    </span>
                    {isApplied && <i className="fa-solid fa-check-circle text-emerald-600"></i>}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onReviewClick(critique.quote); }}
                      className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm flex items-center justify-center"
                      title="在当前章节定位该段原文"
                    >
                      <i className="fa-solid fa-location-crosshairs text-xs"></i>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">原文引用 (QUOTE)</p>
                    <p className={`text-[10px] font-bold italic border-l-2 pl-3 leading-relaxed ${isApplied ? 'text-emerald-800 border-emerald-200' : 'text-slate-700 border-slate-200'}`}>
                      "{critique.quote}"
                    </p>
                  </div>

                  {!isApplied && (
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">审稿人批注 (COMMENT)</p>
                      <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                        {critique.comment}
                      </p>
                    </div>
                  )}

                  {critique.suggestedRevision && !isApplied && (
                      <div className="pt-3 border-t border-slate-200/50">
                          <p className="text-[8px] font-black text-emerald-600 uppercase mb-1">修订建议 (SUGGESTION)</p>
                          <div className="bg-white/80 p-3 rounded-xl border border-emerald-100 mb-3">
                              <p className="text-[10px] font-bold text-emerald-800 leading-relaxed italic">
                                  {critique.suggestedRevision}
                              </p>
                          </div>
                          <button 
                              onClick={() => onApplySuggestion(critique.quote, critique.suggestedRevision)}
                              disabled={isProcessing}
                              className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase shadow-lg transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-black'}`}
                          >
                              {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                              智能采纳并匹配语境
                          </button>
                      </div>
                  )}
                  
                  {isApplied && (
                      <div className="mt-2 text-[9px] font-black text-emerald-600 italic uppercase">
                         <i className="fa-solid fa-check-double mr-1"></i> 已根据审稿建议完成上下文重构
                      </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 opacity-50 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
            <i className="fa-solid fa-clipboard-check text-2xl text-slate-200"></i>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2rem] text-slate-400">暂无评审记录</p>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;