import React, { useEffect, useState } from 'react';
import { SavedDOE } from '../../../types';

interface DoeTraceModalProps {
    show: boolean;
    doeId: string | null;
    onClose: () => void;
}

const DoeTraceModal: React.FC<DoeTraceModalProps> = ({ show, doeId, onClose }) => {
    const [archive, setArchive] = useState<SavedDOE | null>(null);

    useEffect(() => {
        if (show && doeId) {
            try {
                const storedStr = localStorage.getItem('sciflow_doe_v2_archives');
                if (storedStr) {
                    const archives: SavedDOE[] = JSON.parse(storedStr);
                    const found = archives.find(a => a.id === doeId);
                    setArchive(found || null);
                }
            } catch (e) {
                console.error("Failed to load DOE archive from localStorage", e);
            }
        } else {
            setArchive(null);
        }
    }, [show, doeId]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[6000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] p-8 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                >
                    <i className="fa-solid fa-times text-xl"></i>
                </button>

                <div className="flex items-center gap-4 mb-6 shrink-0 border-b border-slate-100 pb-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg bg-indigo-600">
                        <i className="fa-solid fa-flask text-white"></i>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200 shadow-sm leading-none">DOE ARCHIVE</span>
                            <span className="text-[10px] font-bold text-slate-400 font-mono italic">{archive?.timestamp || 'Loading...'}</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight mt-1 truncate max-w-md">{archive?.title || '未找到归档记录'}</h3>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-6">
                    {!archive ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                            <i className="fa-solid fa-file-circle-xmark text-5xl mb-4 opacity-50"></i>
                            <p className="font-bold text-sm">抱歉，未能在本地找到指定的 DOE 存档 {doeId}。</p>
                        </div>
                    ) : (
                        <>
                            {/* Process Description */}
                            {archive.processDescription && (
                                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">工艺流程与参数边界说明</p>
                                    <p className="text-[12px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{archive.processDescription}</p>
                                </div>
                            )}

                            {/* Factors and Responses */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-sliders text-indigo-500"></i> 输入因子空间 (Factors)
                                    </h4>
                                    <div className="space-y-2">
                                        {archive.factors?.map((f, i) => (
                                            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                                <span className="text-xs font-bold text-slate-700">{f.name} <span className="text-[10px] text-slate-400 ml-1">{f.unit}</span></span>
                                                <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{f.min} ~ {f.max}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-2xl border border-slate-200">
                                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-chart-line text-emerald-500"></i> 预期响应指标 (Responses)
                                    </h4>
                                    <div className="space-y-2">
                                        {archive.responses?.map((r, i) => (
                                            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                                                <span className="text-xs font-bold text-slate-700">{r.name} <span className="text-[10px] text-slate-400 ml-1">{r.unit}</span></span>
                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md shadow-xs ${r.goal === 'maximize' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                        r.goal === 'minimize' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                                            'bg-amber-50 text-amber-600 border border-amber-100'
                                                    }`}>
                                                    {r.goal === 'maximize' ? 'MAX' : r.goal === 'minimize' ? 'MIN' : 'TAR'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Suggestions */}
                            {archive.suggestion && archive.suggestion.recommendations?.length > 0 && (
                                <div className="mt-2">
                                    <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2rem] italic border-l-4 border-indigo-600 pl-3 mb-4">推演结论 (RECOMMENDATIONS)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {archive.suggestion.recommendations.map((rec: any, idx: number) => (
                                            <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
                                                    <i className="fa-solid fa-flask text-5xl"></i>
                                                </div>
                                                <div className="flex justify-between items-start mb-3 relative z-10">
                                                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-black text-slate-600 uppercase shadow-sm">{rec.label}</span>
                                                    <span className="text-[10px] font-black text-indigo-500 italic">{rec.confidenceScore}% Config</span>
                                                </div>
                                                <div className="space-y-1 relative z-10 mb-3">
                                                    {Object.entries(rec.params || {}).map(([k, v]) => (
                                                        <div key={k} className="flex justify-between text-[10px]">
                                                            <span className="font-bold text-slate-500">{k}</span>
                                                            <span className="font-mono font-black text-slate-800">{String(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {typeof rec.predictedValue === 'number' && (
                                                    <div className="pt-2 border-t border-slate-200 relative z-10">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase">Predicted outcome</span>
                                                        <div className="text-xs font-black text-indigo-700 italic">{rec.predictedValue.toFixed(2)}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {archive.suggestion.reasoning && (
                                        <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><i className="fa-solid fa-brain"></i> AI Reasoning</p>
                                            <p className="text-[11px] font-medium text-indigo-900 leading-relaxed italic">“{archive.suggestion.reasoning}”</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoeTraceModal;
