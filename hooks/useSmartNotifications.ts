/**
 * useSmartNotifications — 智能通知与自动化工作流引擎
 *
 * 本地优先的通知系统，通过周期扫描 + 事件驱动生成通知：
 * 1. 里程碑截止提醒（≤3天）
 * 2. 库存预警（quantity ≤ threshold）
 * 3. 文献追踪（未读 feedItems）
 * 4. AI 周报提醒（本周未生成）
 * 5. 跨模块联动（分析完成→通知）
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SmartNotification, WeeklyReport } from '../types';

// ═══ localStorage 持久化 ═══
const NOTIFICATIONS_KEY = 'sciflow_smart_notifications';
const WEEKLY_REPORTS_KEY = 'sciflow_weekly_reports';
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

function loadNotifications(): SmartNotification[] {
    try {
        const raw = localStorage.getItem(NOTIFICATIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveNotifications(items: SmartNotification[]) {
    // 只保留最近 200 条
    const trimmed = items.slice(0, 200);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(trimmed));
}

function loadWeeklyReports(): WeeklyReport[] {
    try {
        const raw = localStorage.getItem(WEEKLY_REPORTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveWeeklyReports(reports: WeeklyReport[]) {
    localStorage.setItem(WEEKLY_REPORTS_KEY, JSON.stringify(reports.slice(0, 52)));
}

function getWeekLabel(date: Date = new Date()): string {
    const year = date.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const dayOfYear = Math.ceil((date.getTime() - oneJan.getTime()) / 86400000);
    const weekNum = Math.ceil(dayOfYear / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function createNotification(
    overrides: Partial<SmartNotification> & Pick<SmartNotification, 'type' | 'title' | 'body' | 'icon' | 'color' | 'sourceModule'>
): SmartNotification {
    return {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        priority: 'medium',
        createdAt: new Date().toISOString(),
        ...overrides,
    };
}

// ═══ 扫描引擎接口 ═══
interface ScanInput {
    milestones: { id: string; title: string; status: string; dueDate: string }[];
    inventory: { id: string; name: string; quantity: number; threshold: number; unit: string; category: string; status?: string }[];
    feedItems: { id: string; title: string; isRead: boolean; authors: string[]; source: string; discoveredAt: string }[];
    projectTitle: string;
}

export interface UseSmartNotificationsResult {
    notifications: SmartNotification[];
    unreadCount: number;
    weeklyReports: WeeklyReport[];
    currentWeekHasReport: boolean;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    dismissNotification: (id: string) => void;
    clearAll: () => void;
    addWeeklyReport: (report: WeeklyReport) => void;
    triggerScan: () => void;
}

export const useSmartNotifications = (scanInput: ScanInput): UseSmartNotificationsResult => {
    const [notifications, setNotifications] = useState<SmartNotification[]>(loadNotifications);
    const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>(loadWeeklyReports);
    const lastScanRef = useRef<string>('');

    // 避免重复通知：生成 dedup key
    const existingKeys = useMemo(() => {
        return new Set(notifications.map(n => `${n.type}::${n.sourceId || ''}::${n.createdAt.slice(0, 10)}`));
    }, [notifications]);

    const addNotification = useCallback((n: SmartNotification) => {
        const key = `${n.type}::${n.sourceId || ''}::${n.createdAt.slice(0, 10)}`;
        setNotifications(prev => {
            const prevKeys = new Set(prev.map(p => `${p.type}::${p.sourceId || ''}::${p.createdAt.slice(0, 10)}`));
            if (prevKeys.has(key)) return prev;
            const next = [n, ...prev].slice(0, 200);
            saveNotifications(next);
            return next;
        });
    }, []);

    // ═══ 扫描函数 ═══
    const runScan = useCallback(() => {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);

        // 防止同一天重复全量扫描
        if (lastScanRef.current === todayStr) return;
        lastScanRef.current = todayStr;

        const newNotifs: SmartNotification[] = [];

        // ── 1. 里程碑截止提醒 ──
        scanInput.milestones.forEach(m => {
            if (m.status === 'completed' || m.status === 'failed') return;
            if (!m.dueDate) return;
            const due = new Date(m.dueDate);
            const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
            if (daysLeft <= 3 && daysLeft >= -1) {
                const key = `deadline::${m.id}::${todayStr}`;
                if (!existingKeys.has(key)) {
                    newNotifs.push(createNotification({
                        type: 'deadline',
                        priority: daysLeft <= 0 ? 'critical' : daysLeft <= 1 ? 'high' : 'medium',
                        title: daysLeft <= 0 ? `⚠️ 里程碑已过期: ${m.title}` : `📅 里程碑即将到期: ${m.title}`,
                        body: daysLeft <= 0
                            ? `已过期 ${Math.abs(daysLeft)} 天，请及时处理`
                            : `距离截止还有 ${daysLeft} 天（${m.dueDate}）`,
                        icon: 'fa-clock',
                        color: daysLeft <= 0 ? 'rose' : daysLeft <= 1 ? 'amber' : 'sky',
                        sourceModule: 'milestone',
                        sourceId: m.id,
                        actionLabel: '查看里程碑',
                        actionRoute: `#milestone/${m.id}`,
                    }));
                }
            }
        });

        // ── 2. 库存预警 ──
        scanInput.inventory.forEach(item => {
            if (item.category === 'Hardware') return;
            if (item.status === 'Purchasing') return;
            if (item.quantity > item.threshold) return;
            const key = `inventory::${item.id}::${todayStr}`;
            if (!existingKeys.has(key)) {
                const ratio = item.threshold > 0 ? item.quantity / item.threshold : 0;
                newNotifs.push(createNotification({
                    type: 'inventory',
                    priority: ratio <= 0.2 ? 'critical' : ratio <= 0.5 ? 'high' : 'medium',
                    title: `🧪 库存不足: ${item.name}`,
                    body: `剩余 ${item.quantity}${item.unit}（安全阈值: ${item.threshold}${item.unit}）`,
                    icon: 'fa-flask-vial',
                    color: ratio <= 0.2 ? 'rose' : 'amber',
                    sourceModule: 'inventory',
                    sourceId: item.id,
                    actionLabel: '采购补充',
                    actionRoute: '#inventory',
                }));
            }
        });

        // ── 3. 文献追踪 ──
        const unreadFeeds = scanInput.feedItems.filter(f => !f.isRead);
        if (unreadFeeds.length > 0) {
            const firstFew = unreadFeeds.slice(0, 3);
            const key = `literature::batch::${todayStr}`;
            if (!existingKeys.has(key)) {
                newNotifs.push(createNotification({
                    type: 'literature',
                    priority: 'low',
                    title: `📚 ${unreadFeeds.length} 篇新文献待阅读`,
                    body: firstFew.map(f => `• ${f.title.substring(0, 60)}...`).join('\n'),
                    icon: 'fa-book-open',
                    color: 'indigo',
                    sourceModule: 'literature',
                    sourceId: 'batch',
                    actionLabel: '查看文献',
                    actionRoute: '#literature',
                }));
            }
        }

        // ── 4. 周报提醒 ──
        const currentWeek = getWeekLabel(now);
        const hasReport = weeklyReports.some(r => r.weekLabel === currentWeek);
        if (!hasReport && now.getDay() >= 5) { // 周五及以后提醒
            const key = `weekly_report::${currentWeek}::${todayStr}`;
            if (!existingKeys.has(key)) {
                newNotifs.push(createNotification({
                    type: 'weekly_report',
                    priority: 'medium',
                    title: '📝 本周周报尚未生成',
                    body: `${currentWeek} 的实验周报还未生成，建议在本周结束前完成`,
                    icon: 'fa-file-lines',
                    color: 'teal',
                    sourceModule: 'weekly_report',
                    actionLabel: '生成周报',
                }));
            }
        }

        // 批量添加
        if (newNotifs.length > 0) {
            setNotifications(prev => {
                const next = [...newNotifs, ...prev].slice(0, 200);
                saveNotifications(next);
                return next;
            });
        }
    }, [scanInput, existingKeys, weeklyReports]);

    // 周期扫描
    useEffect(() => {
        runScan();
        const timer = setInterval(runScan, SCAN_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [runScan]);

    // ═══ 操作方法 ═══
    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => {
            const next = prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n);
            saveNotifications(next);
            return next;
        });
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => {
            const now = new Date().toISOString();
            const next = prev.map(n => n.readAt ? n : { ...n, readAt: now });
            saveNotifications(next);
            return next;
        });
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => {
            const next = prev.filter(n => n.id !== id);
            saveNotifications(next);
            return next;
        });
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
        saveNotifications([]);
    }, []);

    const addWeeklyReport = useCallback((report: WeeklyReport) => {
        setWeeklyReports(prev => {
            const next = [report, ...prev.filter(r => r.weekLabel !== report.weekLabel)].slice(0, 52);
            saveWeeklyReports(next);
            return next;
        });
    }, []);

    // ═══ 计算属性 ═══
    const unreadCount = useMemo(() => notifications.filter(n => !n.readAt && !n.dismissed).length, [notifications]);
    const currentWeekHasReport = useMemo(() => weeklyReports.some(r => r.weekLabel === getWeekLabel()), [weeklyReports]);

    return {
        notifications,
        unreadCount,
        weeklyReports,
        currentWeekHasReport,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        clearAll,
        addWeeklyReport,
        triggerScan: runScan,
    };
};
