import React, { useState, useMemo } from 'react';
import { SmartNotification, WeeklyReport } from '../../types';
import WeeklyReportPanel from './WeeklyReportPanel';

type FilterTab = 'all' | 'deadline' | 'inventory' | 'literature' | 'weekly_report' | 'cross_module';

interface NotificationCenterProps {
    notifications: SmartNotification[];
    unreadCount: number;
    weeklyReports: WeeklyReport[];
    currentWeekHasReport: boolean;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onDismiss: (id: string) => void;
    onClearAll: () => void;
    onClose: () => void;
    onAddWeeklyReport: (report: WeeklyReport) => void;
    // 周报生成所需数据
    projectTitle: string;
    milestones: any[];
    recentLogs: any[];
    inventoryAlerts: any[];
    literatureCount: number;
    language: 'zh' | 'en';
}

const FILTER_TABS: { id: FilterTab; label: string; icon: string; color: string }[] = [
    { id: 'all', label: '全部', icon: 'fa-bell', color: 'text-slate-500' },
    { id: 'deadline', label: '截止提醒', icon: 'fa-clock', color: 'text-amber-500' },
    { id: 'inventory', label: '库存预警', icon: 'fa-flask-vial', color: 'text-rose-500' },
    { id: 'literature', label: '文献更新', icon: 'fa-book-open', color: 'text-indigo-500' },
    { id: 'weekly_report', label: '周报', icon: 'fa-file-lines', color: 'text-teal-500' },
    { id: 'cross_module', label: '联动', icon: 'fa-link', color: 'text-violet-500' },
];

const PRIORITY_RING: Record<string, string> = {
    critical: 'border-l-rose-500',
    high: 'border-l-amber-500',
    medium: 'border-l-sky-400',
    low: 'border-l-slate-300',
};

const COLOR_MAP: Record<string, string> = {
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
    sky: 'bg-sky-100 text-sky-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    teal: 'bg-teal-100 text-teal-600',
    violet: 'bg-violet-100 text-violet-600',
    emerald: 'bg-emerald-100 text-emerald-600',
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
    notifications, unreadCount, weeklyReports, currentWeekHasReport,
    onMarkAsRead, onMarkAllAsRead, onDismiss, onClearAll, onClose,
    onAddWeeklyReport,
    projectTitle, milestones, recentLogs, inventoryAlerts, literatureCount, language
}) => {
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
    const [showWeeklyPanel, setShowWeeklyPanel] = useState(false);

    const filtered = useMemo(() => {
        let items = notifications.filter(n => !n.dismissed);
        if (activeFilter !== 'all') {
            items = items.filter(n => n.type === activeFilter);
        }
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [notifications, activeFilter]);

    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        notifications.filter(n => !n.dismissed && !n.readAt).forEach(n => {
            counts[n.type] = (counts[n.type] || 0) + 1;
        });
        return counts;
    }, [notifications]);

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return '刚刚';
        if (diffMin < 60) return `${diffMin} 分钟前`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH} 小时前`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD} 天前`;
        return d.toLocaleDateString();
    };

    if (showWeeklyPanel) {
        return (
            <WeeklyReportPanel
                weeklyReports={weeklyReports}
                currentWeekHasReport={currentWeekHasReport}
                onAddWeeklyReport={onAddWeeklyReport}
                onBack={() => setShowWeeklyPanel(false)}
                projectTitle={projectTitle}
                milestones={milestones}
                recentLogs={recentLogs}
                inventoryAlerts={inventoryAlerts}
                literatureCount={literatureCount}
                language={language}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[5000] flex justify-end" onClick={onClose}>
            <div
                className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-reveal"
                onClick={e => e.stopPropagation()}
            >
                {/* ═══ Header ═══ */}
                <header className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-gradient-to-br from-amber-400 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <i className="fa-solid fa-bell text-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight">通知中心</h3>
                            <p className="text-[8px] font-black text-amber-400 uppercase tracking-[0.2rem]">
                                Smart Notification Hub
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={onMarkAllAsRead}
                                className="px-3 py-1.5 bg-white/10 rounded-xl text-[9px] font-black uppercase hover:bg-white/20 transition-all"
                            >全部已读</button>
                        )}
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-500 flex items-center justify-center transition-all"
                        >
                            <i className="fa-solid fa-times" />
                        </button>
                    </div>
                </header>

                {/* ═══ 快捷操作条 ═══ */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => setShowWeeklyPanel(true)}
                        className="flex-1 px-3 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl text-[9px] font-black uppercase shadow hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-file-lines" />
                        {currentWeekHasReport ? '查看周报' : '生成周报'}
                        {!currentWeekHasReport && <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />}
                    </button>
                    {notifications.length > 0 && (
                        <button
                            onClick={onClearAll}
                            className="px-3 py-2.5 bg-white rounded-xl text-[9px] font-black text-slate-400 uppercase border border-slate-200 hover:border-rose-300 hover:text-rose-500 transition-all"
                        >清空</button>
                    )}
                </div>

                {/* ═══ Filter Tabs ═══ */}
                <div className="px-4 py-3 shrink-0">
                    <div className="grid grid-cols-3 gap-2">
                        {FILTER_TABS.map(tab => {
                            const count = tab.id === 'all' ? unreadCount : (tabCounts[tab.id] || 0);
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveFilter(tab.id)}
                                    className={`px-2.5 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                                        activeFilter === tab.id
                                            ? 'bg-slate-900 text-white shadow-md'
                                            : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'
                                    }`}
                                >
                                    <i className={`fa-solid ${tab.icon} ${activeFilter === tab.id ? '' : tab.color} text-[8px]`} />
                                    {tab.label}
                                    {count > 0 && (
                                        <span className={`w-4 h-4 rounded-full text-[7px] font-black flex items-center justify-center shrink-0 ${
                                            activeFilter === tab.id ? 'bg-amber-400 text-slate-900' : 'bg-rose-100 text-rose-600'
                                        }`}>{count}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ 通知列表 ═══ */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
                    {filtered.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                            <i className="fa-solid fa-bell-slash text-5xl" />
                            <p className="text-sm font-black uppercase tracking-[0.2rem]">暂无通知</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map(n => {
                                const colorCls = COLOR_MAP[n.color] || COLOR_MAP.sky;
                                const priorityCls = PRIORITY_RING[n.priority] || PRIORITY_RING.medium;
                                const isRead = !!n.readAt;

                                return (
                                    <div
                                        key={n.id}
                                        className={`p-4 rounded-2xl border-l-4 transition-all cursor-pointer group ${priorityCls} ${
                                            isRead ? 'bg-slate-50/50 opacity-60' : 'bg-white shadow-sm hover:shadow-md'
                                        }`}
                                        onClick={() => !isRead && onMarkAsRead(n.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorCls}`}>
                                                <i className={`fa-solid ${n.icon} text-sm`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h5 className={`text-[11px] font-black truncate ${isRead ? 'text-slate-400' : 'text-slate-800'}`}>
                                                        {n.title}
                                                    </h5>
                                                    {!isRead && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                                                </div>
                                                <p className="text-[10px] font-medium text-slate-500 leading-relaxed line-clamp-2 whitespace-pre-line">{n.body}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[8px] font-bold text-slate-300 uppercase">{formatTime(n.createdAt)}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {n.actionLabel && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); if (n.actionRoute) window.location.hash = n.actionRoute; onMarkAsRead(n.id); }}
                                                                className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase hover:bg-indigo-100 transition-all"
                                                            >{n.actionLabel}</button>
                                                        )}
                                                        <button
                                                            onClick={e => { e.stopPropagation(); onDismiss(n.id); }}
                                                            className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                                        >
                                                            <i className="fa-solid fa-times text-[8px]" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ═══ Footer ═══ */}
                <footer className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0">
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest text-center">
                        <i className="fa-solid fa-shield-halved mr-1" /> 通知数据存储在本地，仅您可见
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default NotificationCenter;
