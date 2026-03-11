import React, { useState } from 'react';
import { TransformationProposal } from '../../../types';

interface RouteHeaderProps {
    prop: TransformationProposal;
    isSelected: boolean;
    isActive: boolean;
    onToggleExpansion: () => void;
    toggleCompareSelection: () => void;
    onRename?: (id: string, newTitle: string) => void;
}

export const RouteHeader: React.FC<RouteHeaderProps> = ({
    prop, isSelected, isActive, onToggleExpansion, toggleCompareSelection, onRename
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(prop.title);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (title.trim() && title !== prop.title) {
            onRename?.(prop.id, title);
        }
        setIsEditing(false);
    };

    return (
        <div className="flex-1 min-w-0 flex items-center gap-3">
            <div
                onClick={(e) => { e.stopPropagation(); toggleCompareSelection(); }}
                className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
            >
                {isSelected && <i className="fa-solid fa-check text-white text-[10px]"></i>}
            </div>

            <span className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest shrink-0 border ${prop.status === 'sub'
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-violet-600 text-white border-violet-500 shadow-sm'
                }`}>
                {prop.status === 'sub' ? 'SUB-ROUTE' : 'MASTER'}
            </span>

            <div className="flex-1 min-w-0 flex items-center gap-3" onClick={onToggleExpansion}>
                {isEditing ? (
                    <form onSubmit={handleSave} className="flex-1" onClick={e => e.stopPropagation()}>
                        <input
                            autoFocus
                            className="w-full bg-slate-100 border-b-2 border-indigo-500 text-base font-black text-slate-800 normal-case outline-none px-1"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            onBlur={handleSave}
                        />
                    </form>
                ) : (
                    <div className="flex items-center gap-2 group/title min-w-0 flex-1">
                        <h4 className="text-base font-black text-slate-800 normal-case tracking-tight truncate leading-none flex items-center gap-2">
                            {prop.title}
                            {isActive && <span className="flex w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>}
                        </h4>
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                            className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
                        >
                            <i className="fa-solid fa-pen text-[8px]"></i>
                        </button>
                    </div>
                )}
                <span className="text-[7px] font-bold text-slate-300 uppercase shrink-0 font-mono tracking-wider">{prop.timestamp.split(' ')[0]}</span>
            </div>
        </div>
    );
};