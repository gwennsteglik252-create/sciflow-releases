
import React from 'react';

interface VisionSyncStatusProps {
    morphologyLink: {
        type: 'particle' | 'sheet' | 'lattice' | 'defect';
        value: number;
        label: string;
        crystalPlane?: string;
        defectDensity?: number;
    } | null | undefined;
}

const VisionSyncStatus: React.FC<VisionSyncStatusProps> = ({ morphologyLink }) => {
    if (!morphologyLink) return null;

    return (
        <div className={`p-1.5 rounded-xl shadow-sm shrink-0 border border-indigo-200/50 bg-indigo-50/50 animate-reveal flex items-center gap-2 overflow-hidden`}>
            <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <i className={`fa-solid ${morphologyLink.type === 'sheet' ? 'fa-layer-group' : morphologyLink.type === 'defect' ? 'fa-virus' : 'fa-braille'} text-[10px]`}></i>
                </div>
                <div className="hidden sm:block">
                    <h5 className="text-[8px] font-black text-indigo-800 uppercase tracking-widest leading-none">Linked</h5>
                </div>
            </div>
            <div className="flex-1 flex justify-between items-center bg-white/60 px-2 py-1.5 rounded-lg border border-indigo-100 min-w-[80px]">
                <span className="text-[8px] font-bold text-slate-500 uppercase truncate mr-2">
                    {morphologyLink.type === 'sheet' ? 'Porosity' : morphologyLink.type === 'defect' ? 'Defect' : 'Size'}
                </span>
                <span className="text-[10px] font-black text-indigo-600 font-mono whitespace-nowrap">
                    {morphologyLink.value.toFixed(1)}{morphologyLink.type === 'sheet' || morphologyLink.type === 'defect' ? '%' : 'nm'}
                </span>
            </div>
        </div>
    );
};

export default VisionSyncStatus;
