import React, { useMemo, useState } from 'react';
import { InventoryItem } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';

interface InventoryCalendarViewProps {
    items: InventoryItem[];
    onEdit: (item: InventoryItem) => void;
}

interface CalendarEvent {
    date: string; // YYYY-MM-DD
    type: 'calibration' | 'maintenance' | 'expiring' | 'expired';
    item: InventoryItem;
    label: string;
}

const EVENT_STYLES: Record<string, { dot: string; bg: string; text: string; icon: string }> = {
    calibration: { dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'fa-gauge-high' },
    maintenance: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', icon: 'fa-wrench' },
    expiring: { dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: 'fa-clock' },
    expired: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', icon: 'fa-triangle-exclamation' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const InventoryCalendarView: React.FC<InventoryCalendarViewProps> = React.memo(({ items, onEdit }) => {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const todayStr = new Date().toISOString().split('T')[0];

    // Build events from items
    const events = useMemo<CalendarEvent[]>(() => {
        const evts: CalendarEvent[] = [];
        const now = new Date();

        for (const item of items) {
            // Calibration due dates (hardware)
            if (item.nextCalibrationDate) {
                evts.push({ date: item.nextCalibrationDate, type: 'calibration', item, label: item.name });
            }

            // Maintenance records
            if (item.maintenanceHistory) {
                for (const m of item.maintenanceHistory) {
                    if (m.nextDue) {
                        evts.push({ date: m.nextDue, type: 'maintenance', item, label: item.name });
                    }
                }
            }

            // Expiry dates
            if (item.expiryDate) {
                const exp = new Date(item.expiryDate);
                if (exp < now) {
                    evts.push({ date: item.expiryDate, type: 'expired', item, label: item.name });
                } else {
                    evts.push({ date: item.expiryDate, type: 'expiring', item, label: item.name });
                }
            }

            // Procurement deadlines
            if (item.procurementDeadline && item.status === 'Purchasing') {
                evts.push({ date: item.procurementDeadline, type: 'maintenance', item, label: `📦 ${item.name}` });
            }
        }

        return evts;
    }, [items]);

    // Build calendar grid
    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];

        // Padding before month start
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);

        return days;
    }, [year, month]);

    // Map events to date strings for lookup
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        for (const evt of events) {
            const dateStr = evt.date.substring(0, 10);
            // Only show events for current month view
            const evtDate = new Date(dateStr);
            if (evtDate.getFullYear() === year && evtDate.getMonth() === month) {
                if (!map.has(dateStr)) map.set(dateStr, []);
                map.get(dateStr)!.push(evt);
            }
        }
        return map;
    }, [events, year, month]);

    const monthStr = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    // Event type counts for legend
    const eventCounts = useMemo(() => {
        const counts = { calibration: 0, maintenance: 0, expiring: 0, expired: 0 };
        for (const evt of events) {
            const d = new Date(evt.date);
            if (d.getFullYear() === year && d.getMonth() === month) {
                counts[evt.type]++;
            }
        }
        return counts;
    }, [events, year, month]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg">
                        <i className="fa-solid fa-calendar-days text-lg" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase italic leading-none">{t('inventory.calendarView.title')}</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('inventory.calendarView.subtitle')}</p>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3">
                    {(['calibration', 'maintenance', 'expiring', 'expired'] as const).map(type => (
                        <div key={type} className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${EVENT_STYLES[type].dot}`} />
                            <span className="text-[9px] font-black text-slate-500 uppercase">
                                {t(`inventory.calendarView.${type}` as any)} ({eventCounts[type]})
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3 border border-slate-100 shadow-sm">
                <button onClick={prevMonth} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                    <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <div className="flex items-center gap-3">
                    <h4 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">{monthStr}</h4>
                    <button onClick={goToday} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">
                        {t('inventory.calendarView.today')}
                    </button>
                </div>
                <button onClick={nextMonth} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                    <i className="fa-solid fa-chevron-right text-xs" />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-slate-100">
                    {WEEKDAYS.map(day => (
                        <div key={day} className="py-2.5 text-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-slate-50 bg-slate-25" />;
                        }

                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = eventsByDate.get(dateStr) || [];
                        const isToday = dateStr === todayStr;

                        return (
                            <div key={dateStr} className={`min-h-[100px] border-b border-r border-slate-50 p-1.5 transition-colors ${isToday ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'}`}>
                                {/* Day number */}
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                                        {day}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span className="text-[8px] font-black text-slate-300">{dayEvents.length}</span>
                                    )}
                                </div>

                                {/* Events */}
                                <div className="space-y-0.5">
                                    {dayEvents.slice(0, 3).map((evt, i) => {
                                        const style = EVENT_STYLES[evt.type];
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => onEdit(evt.item)}
                                                className={`w-full text-left px-1.5 py-0.5 rounded-md ${style.bg} ${style.text} text-[8px] font-black truncate hover:opacity-80 transition-all flex items-center gap-1`}
                                            >
                                                <i className={`fa-solid ${style.icon} text-[7px] shrink-0`} />
                                                <span className="truncate">{evt.label}</span>
                                            </button>
                                        );
                                    })}
                                    {dayEvents.length > 3 && (
                                        <span className="text-[8px] font-black text-slate-400 px-1">+{dayEvents.length - 3}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

InventoryCalendarView.displayName = 'InventoryCalendarView';
