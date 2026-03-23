import React from 'react';

export type AlignType = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom' | 'dist-h' | 'dist-v' | 'canvas-center';

interface AlignToolbarProps {
    panelCount: number;
    onAlign: (type: AlignType) => void;
}

const ALIGN_BUTTONS: { type: AlignType; icon: string; label: string }[] = [
    { type: 'left', icon: 'fa-align-left', label: '左对齐' },
    { type: 'center-h', icon: 'fa-align-center', label: '水平居中' },
    { type: 'right', icon: 'fa-align-right', label: '右对齐' },
    { type: 'top', icon: 'fa-arrow-up-from-bracket', label: '顶对齐' },
    { type: 'center-v', icon: 'fa-grip-lines', label: '垂直居中' },
    { type: 'bottom', icon: 'fa-arrow-down-to-bracket', label: '底对齐' },
    { type: 'dist-h', icon: 'fa-arrows-left-right', label: '水平等距' },
    { type: 'dist-v', icon: 'fa-arrows-up-down', label: '垂直等距' },
    { type: 'canvas-center', icon: 'fa-crosshairs', label: '画布居中' },
];

export const AlignToolbar: React.FC<AlignToolbarProps> = ({ panelCount, onAlign }) => {
    if (panelCount < 2) return null;

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 no-export">
            <div className="flex bg-white/90 backdrop-blur-md rounded-lg shadow-xl px-1.5 py-1 border border-slate-200 items-center gap-0.5">
                {ALIGN_BUTTONS.map((btn, i) => (
                    <React.Fragment key={btn.type}>
                        {i === 3 && <div className="w-px h-5 bg-slate-200 mx-0.5" />}
                        {i === 6 && <div className="w-px h-5 bg-slate-200 mx-0.5" />}
                        {i === 8 && <div className="w-px h-5 bg-slate-200 mx-0.5" />}
                        <button
                            onClick={() => onAlign(btn.type)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                            title={btn.label}
                        >
                            <i className={`fa-solid ${btn.icon} text-[10px]`} />
                        </button>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
