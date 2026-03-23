
import React, { useState } from 'react';

interface PaletteSelectorProps {
    academicPalettes: any[];
    activePaletteIdx: number;
    setActivePaletteIdx: (idx: number) => void;
    onApplyPalette?: (idx: number) => void;
    onSmartRandomColor?: () => void;
    hasData: boolean;
}

export const PaletteSelector: React.FC<PaletteSelectorProps> = ({
    academicPalettes, activePaletteIdx, setActivePaletteIdx, onApplyPalette, onSmartRandomColor, hasData
}) => {
    const [isVibeExpanded, setIsVibeExpanded] = useState(false);

    if (!hasData) return null;

    const handlePaletteClick = (idx: number) => {
        setActivePaletteIdx(idx);
        onApplyPalette?.(idx);
    };

    return (
        <div className="mb-4 space-y-2.5">
            <div
                className="flex justify-between items-center p-2.5 rounded-xl cursor-pointer group bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                onClick={() => setIsVibeExpanded(!isVibeExpanded)}
            >
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                        <i className="fa-solid fa-palette text-[10px]"></i>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider cursor-pointer group-hover:text-indigo-600 transition-colors">智能配色预设</label>
                        <span className="text-[7px] font-bold text-slate-400 uppercase">VIBE COLOR PRESETS</span>
                    </div>
                </div>
                <i className={`fa-solid ${isVibeExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-slate-300 group-hover:text-indigo-400 transition-all`}></i>
            </div>

            {isVibeExpanded && (
                <div className="space-y-2.5 animate-reveal">
                    <div className="grid grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                        {academicPalettes.map((p, idx) => (
                            <button
                                key={p.name}
                                onClick={() => handlePaletteClick(idx)}
                                className={`p-1.5 rounded-xl border-2 transition-all flex flex-col gap-1 active:scale-95 ${activePaletteIdx === idx ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-white hover:border-indigo-300 hover:shadow-sm'}`}
                                title={p.desc}
                            >
                                <span className={`text-[6px] font-black uppercase truncate w-full text-left ${activePaletteIdx === idx ? 'text-indigo-600' : 'text-slate-500'}`}>{p.name}</span>
                                <div className="flex h-1.5 w-full rounded-full overflow-hidden">
                                    {p.colors.map((c: string) => <div key={c} className="flex-1" style={{ backgroundColor: c }}></div>)}
                                </div>
                            </button>
                        ))}
                    </div>
                    <button onClick={onSmartRandomColor} className="w-full py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 active:scale-95">
                        <i className="fa-solid fa-dice text-amber-300"></i> 鲜艳随机配色
                    </button>
                </div>
            )}
        </div>
    );
};
