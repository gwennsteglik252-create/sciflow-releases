/**
 * notificationService.ts — 应用内通知服务
 *
 * 管理通知条目的创建、存储和状态。
 * 使用 localStorage 持久化，与 Supabase Realtime 可选联动。
 * 后续可接入 @capacitor/push-notifications 和 @capacitor/local-notifications。
 */

const NOTIFICATION_STORAGE_KEY = 'sciflow_notifications';
const MAX_NOTIFICATIONS = 100;

export type NotificationType =
  | 'experiment_complete'
  | 'review_result'
  | 'milestone_due'
  | 'inventory_low'
  | 'collaboration_invite'
  | 'weekly_report'
  | 'literature_update'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;    // ISO
  isRead: boolean;
  /** 点击后跳转的目标视图 */
  targetView?: string;
  /** 关联的项目 ID */
  projectId?: string;
  /** 关联的里程碑 ID */
  milestoneId?: string;
  /** 附加元数据 */
  meta?: Record<string, any>;
}

/**
 * 从 localStorage 读取通知列表
 */
export function loadNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * 保存通知列表到 localStorage
 */
function saveNotifications(notifications: AppNotification[]): void {
  // 保留最新的 N 条
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * 创建并保存一条新通知
 */
export function createNotification(
  type: NotificationType,
  title: string,
  body: string,
  opts?: Partial<Pick<AppNotification, 'targetView' | 'projectId' | 'milestoneId' | 'meta'>>
): AppNotification {
  const notification: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    body,
    timestamp: new Date().toISOString(),
    isRead: false,
    ...opts,
  };

  const all = loadNotifications();
  all.unshift(notification);
  saveNotifications(all);

  // 尝试发送 Capacitor 本地通知（静默失败）
  tryLocalNotification(title, body).catch(() => {});

  return notification;
}

/**
 * 标记单条已读
 */
export function markNotificationRead(id: string): void {
  const all = loadNotifications();
  const target = all.find(n => n.id === id);
  if (target) {
    target.isRead = true;
    saveNotifications(all);
  }
}

/**
 * 标记全部已读
 */
export function markAllNotificationsRead(): void {
  const all = loadNotifications();
  all.forEach(n => { n.isRead = true; });
  saveNotifications(all);
}

/**
 * 删除一条通知
 */
export function deleteNotification(id: string): void {
  const all = loadNotifications();
  saveNotifications(all.filter(n => n.id !== id));
}

/**
 * 获取未读数
 */
export function getUnreadCount(): number {
  return loadNotifications().filter(n => !n.isRead).length;
}

/**
 * 通知类型对应的图标
 */
export function getNotificationIcon(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    experiment_complete: 'fa-flask-vial',
    review_result: 'fa-star',
    milestone_due: 'fa-flag',
    inventory_low: 'fa-box-archive',
    collaboration_invite: 'fa-user-plus',
    weekly_report: 'fa-chart-bar',
    literature_update: 'fa-book-open',
    system: 'fa-bell',
  };
  return map[type] || 'fa-bell';
}

/**
 * 通知类型对应的颜色
 */
export function getNotificationColor(type: NotificationType): string {
  const map: Record<NotificationType, string> = {
    experiment_complete: 'text-emerald-400',
    review_result: 'text-amber-400',
    milestone_due: 'text-rose-400',
    inventory_low: 'text-orange-400',
    collaboration_invite: 'text-indigo-400',
    weekly_report: 'text-blue-400',
    literature_update: 'text-purple-400',
    system: 'text-slate-400',
  };
  return map[type] || 'text-slate-400';
}

/**
 * 尝试发送 Capacitor 本地通知（原生平台才生效）
 */
async function tryLocalNotification(title: string, body: string): Promise<void> {
  try {
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (!isNative) return;

    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        title,
        body,
        id: Date.now(),
        schedule: { at: new Date(Date.now() + 100) },
        smallIcon: 'ic_notification',
        largeIcon: 'ic_notification',
      }]
    });
  } catch {
    // 静默失败 — 插件未安装或权限不足
  }
}
