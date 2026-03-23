import React, { useState } from 'react';

interface CategoryGroupHeaderProps {
    name: string;
    icon: string;
    color: string;
    count: number;
    avgScore: number;
    isCollapsed: boolean;
    onToggle: () => void;
    onRename?: (newName: string) => void;
    onDelete?: () => void;
    isCustom?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; accent: string }> = {
    indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-600', accent: 'text-indigo-500' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-600', accent: 'text-emerald-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-600', accent: 'text-amber-500' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-600', accent: 'text-rose-500' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-600', accent: 'text-sky-500' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-600', accent: 'text-violet-500' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-500', accent: 'text-slate-400' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-600', accent: 'text-pink-500' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-600', accent: 'text-cyan-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-600', accent: 'text-orange-500' },
};

export const CategoryGroupHeader: React.FC<CategoryGroupHeaderProps> = ({
    name, icon, color, count, avgScore, isCollapsed, onToggle, onRename, onDelete, isCustom
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(name);
    const colors = COLOR_MAP[color] || COLOR_MAP.slate;

    const scoreBg = avgScore >= 70 ? 'bg-emerald-500' : avgScore >= 45 ? 'bg-amber-500' : 'bg-rose-500';

    const handleSave = () => {
        if (editName.trim() && editName !== name) {
            onRename?.(editName.trim());
        }
        setIsEditing(false);
    };

    return (
        <div
            className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 mb-3 cursor-pointer transition-all hover:shadow-md ${colors.bg} ${colors.border}`}
            onClick={onToggle}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-lg ${colors.badge} flex items-center justify-center shrink-0 shadow-sm`}>
                    <i className={`fa-solid ${icon} text-white text-xs`}></i>
                </div>

                {isEditing ? (
                    <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleSave(); }} onClick={e => e.stopPropagation()} className="flex-1">
                        <input
                            autoFocus
                            className={`bg-white border-b-2 ${colors.border} ${colors.text} text-sm font-black outline-none px-1 w-full`}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onBlur={handleSave}
                        />
                    </form>
                ) : (
                    <div className="flex items-center gap-2 min-w-0 flex-1 group/name">
                        <h4 className={`text-sm font-black ${colors.text} uppercase tracking-tight truncate`}>{name}</h4>
                        {isCustom && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                                className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0"
                            >
                                <i className="fa-solid fa-pen text-[7px]"></i>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-3" style={{ minWidth: 110 }}>
                <span className={`min-w-[22px] h-[22px] rounded-full text-[10px] font-black text-white shrink-0 ${colors.badge} inline-flex items-center justify-center`}>
                    {count}
                </span>

                <div className={`flex items-center gap-1.5 shrink-0 ${avgScore > 0 ? '' : 'opacity-0 pointer-events-none'}`}>
                    <div className={`w-5 h-5 rounded-md ${scoreBg} flex items-center justify-center`}>
                        <span className="text-[8px] font-black text-white">{Math.round(avgScore)}</span>
                    </div>
                    <span className="text-[7px] font-bold text-slate-400 uppercase">AVG</span>
                </div>

                {isCustom && onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="w-6 h-6 rounded-lg bg-white/80 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                        title="删除分类"
                    >
                        <i className="fa-solid fa-trash-can text-[8px]"></i>
                    </button>
                )}
                <i className={`fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'} text-xs ${colors.accent} transition-transform`}></i>
            </div>
        </div>
    );
};
