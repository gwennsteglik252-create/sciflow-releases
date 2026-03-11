
import React from 'react';

interface TimelineStep {
    step: string;
    action: string;
}

interface RouteTimelineProps {
    steps: TimelineStep[];
    isEditing: boolean;
    onUpdate: (next: TimelineStep[]) => void;
}

export const RouteTimeline: React.FC<RouteTimelineProps> = ({ steps, isEditing, onUpdate }) => {
    const handleAddStep = () => onUpdate([...(steps || []), { step: 'New Step', action: '' }]);
    const handleRemoveStep = (idx: number) => onUpdate((steps || []).filter((_, i) => i !== idx));
    const handleUpdateStep = (idx: number, updates: Partial<TimelineStep>) => {
        const next = [...(steps || [])];
        next[idx] = { ...next[idx], ...updates };
        onUpdate(next);
    };

    return (
        <div className="border-r-2 border-dashed border-slate-100 pr-6">
            <div className="flex justify-between items-center mb-5">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-timeline text-indigo-500"></i> 工艺流程演进 (STEPS)
                </h5>
                {isEditing && (
                    <button onClick={handleAddStep} className="text-[8px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all">+ Add Step</button>
                )}
            </div>
            <div className="relative pl-3 space-y-0">
                {/* 加粗的主干连接线 */}
                <div className="absolute left-[18px] top-2 bottom-6 w-0 border-l-4 border-dashed border-indigo-100 opacity-60"></div>
                {(steps || []).map((step, idx) => (
                    <div key={idx} className="relative flex gap-5 items-start mb-8 last:mb-0 group/step">
                        <div className="w-9 h-9 rounded-xl bg-white border-2 border-indigo-200 flex items-center justify-center font-black text-[11px] text-indigo-600 shrink-0 shadow-sm z-10 group-hover/step:border-indigo-600 group-hover/step:scale-110 group-hover/step:shadow-lg transition-all duration-300">
                            {idx + 1}
                        </div>
                        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border-2 border-white shadow-sm group-hover/step:shadow-md group-hover/step:bg-white transition-all relative">
                            {isEditing ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between gap-3">
                                        <input className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black normal-case outline-none focus:border-indigo-500 shadow-inner" value={step.step} onChange={e => handleUpdateStep(idx, { step: e.target.value })} />
                                        <button onClick={() => handleRemoveStep(idx)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-times"></i></button>
                                    </div>
                                    <textarea className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-medium italic outline-none focus:border-indigo-500 shadow-inner resize-none h-16" value={step.action} onChange={e => handleUpdateStep(idx, { action: e.target.value })} />
                                </div>
                            ) : (
                                <>
                                    <p className="text-[10px] font-black text-slate-800 normal-case mb-1.5 tracking-tight">{step.step}</p>
                                    <p className="text-[9.5px] text-slate-500 font-bold leading-relaxed italic text-justify">{step.action}</p>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
