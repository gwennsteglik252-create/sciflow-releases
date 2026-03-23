import React, { useMemo } from 'react';
import { TimelineEvent } from '../../../../types/visuals';

interface DateNavigatorProps {
    activeEvent: TimelineEvent;
    onDateChange: (newDateStr: string) => void;
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({ activeEvent, onDateChange }) => {
    const dateState = useMemo(() => {
        const dateStr = activeEvent.date;
        const qMatch = dateStr.match(/Q([1-4])\s+(\d{4})/);
        if (qMatch) return { year: parseInt(qMatch[2]), mode: 'quarter', value: parseInt(qMatch[1]) };
        if (dateStr.includes('-')) {
            const [y, m] = dateStr.split('-');
            return { year: parseInt(y), mode: 'month', value: parseInt(m) };
        }
        return { year: parseInt(dateStr) || 2024, mode: 'year', value: 1 };
    }, [activeEvent.date]);

    const triggerUpdate = (year: number, mode: string, val: number) => {
        let newDateStr = '';
        if (mode === 'year') newDateStr = `${year}`;
        else if (mode === 'quarter') newDateStr = `Q${val} ${year}`;
        else if (mode === 'month') newDateStr = `${year}-${String(val).padStart(2, '0')}`;
        onDateChange(newDateStr);
    };

    return (
        <div className="space-y-2.5">
            <label className="text-[8px] font-black text-indigo-500 uppercase block italic">时间窗口对标 (TIME WINDOW)</label>
            <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1">
                {['year', 'quarter', 'month'].map(m => (
                    <button 
                        key={m}
                        onClick={() => triggerUpdate(dateState.year, m, 1)}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${dateState.mode === m ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {m === 'year' ? '年度' : m === 'quarter' ? '季度' : '月份'}
                    </button>
                ))}
            </div>
            <div className="flex gap-2">
                <div className="flex-[1.2] flex flex-col gap-1">
                    <span className="text-[7px] font-bold text-slate-400 uppercase px-1">年份</span>
                    <input 
                        type="number" 
                        className="w-full bg-white border border-indigo-100 rounded-xl p-2.5 text-xs font-black text-indigo-700 outline-none shadow-sm text-center"
                        value={dateState.year}
                        onChange={e => triggerUpdate(parseInt(e.target.value) || 2024, dateState.mode, dateState.value)}
                    />
                </div>
                {dateState.mode !== 'year' && (
                    <div className="flex-1 flex flex-col gap-1 animate-reveal">
                        <span className="text-[7px] font-bold text-slate-400 uppercase px-1">{dateState.mode === 'quarter' ? '季度' : '月份'}</span>
                        <select 
                            className="w-full bg-white border border-indigo-100 rounded-xl p-2.5 text-xs font-black text-indigo-700 outline-none shadow-sm cursor-pointer appearance-none text-center"
                            value={dateState.value}
                            onChange={e => triggerUpdate(dateState.year, dateState.mode, parseInt(e.target.value))}
                        >
                            {dateState.mode === 'quarter' 
                                ? [1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)
                                : Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{i+1}月</option>)
                            }
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
};
