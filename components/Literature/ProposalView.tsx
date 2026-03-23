
import React from 'react';
import { TransformationProposal } from '../../types';
import CompactMarkdown from '../Common/CompactMarkdown';

interface ProposalViewProps {
  proposal: TransformationProposal;
  onAdopt: (proposal: TransformationProposal) => void;
  onTraceLiterature?: (literatureId: string) => void;
}

const ProposalView: React.FC<ProposalViewProps> = ({ proposal, onAdopt, onTraceLiterature }) => {
  if (!proposal) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 bg-gray-50/50">
        <div className="text-center">
          <i className="fa-solid fa-file-circle-exclamation text-4xl text-slate-300 mb-4"></i>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">建议数据加载异常</p>
        </div>
      </div>
    );
  }

  const safeTitle = String(proposal.title || '未命名转化建议');
  const safeHypothesis = (typeof proposal.scientificHypothesis === 'string' ? proposal.scientificHypothesis : JSON.stringify(proposal.scientificHypothesis)) || '暂无科学假设描述';
  const safeProcessChanges = (typeof proposal.processChanges === 'string' ? proposal.processChanges : JSON.stringify(proposal.processChanges)) || '暂无详细路径说明，AI 正在分析核心路线差异...';
  const safeParameters = Array.isArray(proposal.optimizedParameters) ? proposal.optimizedParameters : [];
  const safeControlParams = Array.isArray(proposal.controlParameters) ? proposal.controlParameters : [];
  const safeFlowchart = Array.isArray(proposal.newFlowchart) ? proposal.newFlowchart : [];

  return (
    <div className="flex-1 overflow-y-auto p-10 bg-gray-50/50 custom-scrollbar animate-reveal relative space-y-10">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-lightbulb text-indigo-500"></i>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">转化建议存档</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900 leading-tight max-w-3xl italic tracking-tighter">{safeTitle}</h3>
        </div>
        <div className="flex items-center gap-3">
          {proposal.literatureId && (
            <button
              onClick={() => onTraceLiterature?.(proposal.literatureId!)}
              className="px-6 py-3 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-left-long"></i> 溯源至原文献
            </button>
          )}
          <button onClick={() => onAdopt(proposal)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-indigo-100">
            <i className="fa-solid fa-code-branch"></i> 推送至课题中心
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">科学假设与工艺改良背景</h5>
          <div className="text-sm font-black text-slate-900 leading-loose italic relative z-10">{safeHypothesis}</div>
        </div>
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
          <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-6 italic">关键路径变更说明</h5>
          <div className="relative z-10">
            <CompactMarkdown content={safeProcessChanges} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 italic">性能指标矩阵 (EXPECTED PERFORMANCE)</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {safeParameters.length > 0 ? safeParameters.map((p, i) => (
            <div key={i} className="bg-emerald-50/20 p-6 rounded-3xl border border-emerald-100 shadow-sm flex flex-col group relative hover:border-emerald-400 transition-all min-h-[160px]">
              <p className="text-[8.5px] font-black text-emerald-600 uppercase tracking-widest mb-2">{String(p?.key || '')}</p>
              <p className="text-base lg:text-lg font-black text-emerald-800 mb-3 italic tracking-tighter leading-snug whitespace-pre-wrap">{String(p?.value || '')}</p>
              <div className="mt-auto pt-3 border-t border-emerald-100/50">
                <p className="text-[10px] text-slate-600 leading-relaxed font-black italic opacity-90 text-justify">“{String(p?.reason || '')}”</p>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 bg-slate-100/50 rounded-3xl border-2 border-dashed border-slate-300 text-center flex flex-col items-center">
              <i className="fa-solid fa-chart-line text-2xl text-slate-300 mb-2"></i>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">暂无生成的性能预测内容</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 italic">关键工艺参数建议 (CONTROL PARAMETERS)</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {safeControlParams.length > 0 ? safeControlParams.map((p, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col group relative hover:border-indigo-400 transition-all min-h-[160px]">
              <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-500">{String(p?.key || '')}</p>
              <p className="text-base lg:text-lg font-black text-indigo-800 mb-3 italic tracking-tighter leading-snug whitespace-pre-wrap">{String(p?.value || '')}</p>
              <div className="mt-auto pt-3 border-t border-slate-50">
                <p className="text-[10px] text-slate-800 leading-relaxed font-black italic opacity-90 text-justify">“{String(p?.reason || '')}”</p>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 bg-slate-100/50 rounded-3xl border-2 border-dashed border-slate-300 text-center flex flex-col items-center">
              <i className="fa-solid fa-sliders text-2xl text-slate-300 mb-2"></i>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">暂无生成的工艺参数建议</p>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 italic">建议优化工艺路线 (SYNTHESIS SUGGESTIONS)</h5>
        <div className="grid grid-cols-1 gap-3">
          {safeFlowchart.length > 0 ? safeFlowchart.map((step, i) => (
            <div key={i} className="bg-indigo-50/30 p-5 rounded-[2rem] border border-indigo-100/50 flex gap-5 items-start">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] shrink-0 shadow-md">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-indigo-900 uppercase mb-1 italic">{String(step?.step || '')}</p>
                <p className="text-[10px] text-slate-800 font-black leading-relaxed italic text-justify">{String(step?.action || '')}</p>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 bg-indigo-50/10 rounded-3xl border-2 border-dashed border-indigo-100/50 text-center flex flex-col items-center">
              <i className="fa-solid fa-vial-circle-check text-2xl text-indigo-200 mb-2"></i>
              <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest italic">暂无生成的工艺路线内容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProposalView;
