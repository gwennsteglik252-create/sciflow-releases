
import React from 'react';

interface RouteParam {
    key: string;
    value: string;
    reason: string;
}

interface RouteParametersProps {
    params: RouteParam[];
    isEditing: boolean;
    onUpdate: (next: RouteParam[]) => void;
    getIntensity: (val: string) => number;
}

export const RouteParameters: React.FC<RouteParametersProps> = ({ params, isEditing, onUpdate, getIntensity }) => {
    const handleAddParam = () => onUpdate([...(params || []), { key: 'Param', value: '', reason: '' }]);
    const handleRemoveParam = (idx: number) => onUpdate((params || []).filter((_, i) => i !== idx));
    const handleUpdateParam = (idx: number, updates: Partial<RouteParam>) => {
        const next = [...(params || [])];
        next[idx] = { ...next[idx], ...updates };
        onUpdate(next);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-5 px-1">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-sliders text-indigo-500"></i> 关键工艺参数矩阵 (PROCESS PARAMETERS)
                </h5>
                {isEditing && (
                    <button onClick={handleAddParam} className="text-[8px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all">+ Add Param</button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-3">
                {(params || []).map((p, idx) => {
                    const intensity = getIntensity(p.value);
                    return (
                        <div
                            key={idx}
                            className="rounded-2xl border-2 border-indigo-100 flex items-stretch overflow-hidden group/param hover:scale-[1.03] transition-all duration-300 shadow-sm hover:shadow-lg"
                            style={{ backgroundColor: `rgba(99, 102, 241, ${intensity + 0.05})` }}
                        >
                            {/* 显著加宽的指示条 */}
                            <div className="w-3 bg-indigo-500 opacity-30 shadow-[4px_0_10px_rgba(99,102,241,0.2)]"></div>
                            <div className="flex-1 p-4 flex flex-col justify-center gap-1">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="flex gap-3">
                                            <input className="flex-1 bg-white/80 border border-indigo-100 rounded-lg px-3 py-1 text-[10px] font-black normal-case outline-none focus:border-indigo-500" value={p.key} onChange={e => handleUpdateParam(idx, { key: e.target.value })} />
                                            <input className="w-20 bg-white/95 border border-indigo-100 rounded-lg px-3 py-1 text-[11px] font-black font-mono text-indigo-700 outline-none focus:border-indigo-500" value={p.value} onChange={handleUpdateParam.bind(null, idx, { value: p.value })} />
                                            <button onClick={() => handleRemoveParam(idx)} className="text-rose-500 hover:scale-110 transition-transform"><i className="fa-solid fa-times-circle"></i></button>
                                        </div>
                                        <input className="w-full bg-white/50 border border-indigo-50 rounded-lg px-3 py-1.5 text-[9px] italic font-bold text-slate-600 outline-none focus:border-indigo-400" value={p.reason} onChange={e => handleUpdateParam(idx, { reason: e.target.value })} placeholder="输入优化理由..." />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[9px] font-black text-indigo-900/80 normal-case tracking-widest">{p.key}</span>
                                            <span className="text-[12px] font-black text-slate-900 font-mono bg-white/80 px-3 py-0.5 rounded-lg shadow-sm border border-white/50">{p.value}</span>
                                        </div>
                                        <p className="text-[9.5px] text-slate-700 font-bold italic leading-relaxed text-justify opacity-80 group-hover/param:opacity-100 transition-opacity bg-white/20 p-2 rounded-xl mt-1">
                                            <i className="fa-solid fa-quote-left mr-2 text-[8px] text-indigo-400"></i> {p.reason}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {(!params || params.length === 0) && (
                <div className="py-12 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-300 opacity-40">
                    <i className="fa-solid fa-layer-group text-2xl mb-2"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest">暂无关键参数解析</p>
                </div>
            )}
        </div>
    );
};
