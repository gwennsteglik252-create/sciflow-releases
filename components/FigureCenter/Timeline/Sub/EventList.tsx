import React from 'react';
import { TimelineEvent } from '../../../../types/visuals';

interface EventListProps {
    events: TimelineEvent[];
    activeEventId: string | null;
    onSelect: (id: string) => void;
    onDelete?: (id: string) => void;
}

export const EventList: React.FC<EventListProps> = ({ events, activeEventId, onSelect, onDelete }) => {
    return (
        <div className="space-y-1.5 mt-2">
            {events.map((ev) => (
                <div 
                    key={ev.id}
                    onClick={() => {
                        const el = document.getElementById(`node-${ev.id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        onSelect(ev.id);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${activeEventId === ev.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-white hover:border-slate-200'}`}
                >
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase truncate">{ev.title}</p>
                        <p className={`text-[7px] font-bold ${activeEventId === ev.id ? 'text-indigo-200' : 'text-slate-400'}`}>{ev.date}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete?.(ev.id); }}
                            className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 ${
                                activeEventId === ev.id ? 'bg-white/10 text-white hover:bg-rose-500' : 'bg-white text-rose-400 border border-slate-100 hover:bg-rose-500 hover:text-white'
                            }`}
                            title="删除节点"
                        >
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                        <i className={`fa-solid fa-chevron-right text-[8px] opacity-40 group-hover:opacity-0 ${activeEventId === ev.id ? 'hidden' : ''}`}></i>
                    </div>
                </div>
            ))}
        </div>
    );
};
