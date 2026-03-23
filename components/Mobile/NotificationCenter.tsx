/**
 * NotificationCenter.tsx — 移动端通知中心
 *
 * 从底部弹出的通知面板，显示按时间分组的通知列表。
 * 支持标记已读、删除、点击跳转。
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AppNotification,
  loadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationIcon,
  getNotificationColor,
} from '../../services/notificationService';

interface NotificationCenterProps {
  show: boolean;
  onClose: () => void;
  isLightMode: boolean;
  onNavigate?: (view: string, projectId?: string) => void;
}

/**
 * 通知按时间分组
 */
function groupByDate(notifications: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  const groups: { label: string; items: AppNotification[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '更早', items: [] },
  ];

  for (const n of notifications) {
    const t = new Date(n.timestamp).getTime();
    if (t >= today) groups[0].items.push(n);
    else if (t >= yesterday) groups[1].items.push(n);
    else groups[2].items.push(n);
  }

  return groups.filter(g => g.items.length > 0);
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  show, onClose, isLightMode, onNavigate
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // 加载通知
  useEffect(() => {
    if (show) {
      setNotifications(loadNotifications());
    }
  }, [show]);

  const grouped = useMemo(() => groupByDate(notifications), [notifications]);
  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  const handleMarkRead = useCallback((id: string) => {
    markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleClick = useCallback((n: AppNotification) => {
    handleMarkRead(n.id);
    if (n.targetView && onNavigate) {
      onNavigate(n.targetView, n.projectId);
      onClose();
    }
  }, [handleMarkRead, onNavigate, onClose]);

  const bg = isLightMode ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-white/10';
  const textPrimary = isLightMode ? 'text-slate-800' : 'text-white';
  const textSecondary = isLightMode ? 'text-slate-500' : 'text-slate-400';

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9970]"
            onClick={onClose}
          />

          {/* 面板 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={`fixed bottom-0 left-0 right-0 z-[9975] rounded-t-3xl border-t ${bg} backdrop-blur-xl overflow-hidden`}
            style={{ maxHeight: '80vh', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            {/* 拖拽指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className={`w-10 h-1 rounded-full ${isLightMode ? 'bg-slate-300' : 'bg-white/20'}`} />
            </div>

            {/* 标题栏 */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <i className="fa-solid fa-bell text-white text-xs" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${textPrimary}`}>通知中心</h3>
                  <p className={`text-[9px] ${textSecondary}`}>
                    {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className={`text-[9px] px-3 py-1.5 rounded-lg font-bold ${isLightMode ? 'text-indigo-600 hover:bg-indigo-50' : 'text-indigo-400 hover:bg-indigo-500/10'}`}
                  >
                    全部已读
                  </button>
                )}
                <button onClick={onClose} className={`p-2 rounded-xl ${isLightMode ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}>
                  <i className={`fa-solid fa-times text-sm ${textSecondary}`} />
                </button>
              </div>
            </div>

            {/* 通知列表 */}
            <div className="px-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
              {grouped.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-4">
                    <i className={`fa-solid fa-bell-slash text-2xl ${textSecondary}`} />
                  </div>
                  <p className={`text-xs font-bold ${textSecondary}`}>暂无通知</p>
                  <p className={`text-[10px] mt-1 ${textSecondary}`}>新的实验完成或审稿结果将在此处显示</p>
                </div>
              ) : (
                grouped.map(group => (
                  <div key={group.label} className="mb-6">
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-2.5 ${textSecondary}`}>
                      {group.label}
                    </p>
                    <div className="space-y-2">
                      {group.items.map(n => (
                        <motion.div
                          key={n.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          onClick={() => handleClick(n)}
                          className={`rounded-2xl p-4 border cursor-pointer transition-all active:scale-[0.98] ${
                            n.isRead
                              ? isLightMode ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white/3 border-white/5 opacity-60'
                              : isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* 图标 */}
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isLightMode ? 'bg-slate-100' : 'bg-white/5'}`}>
                              <i className={`fa-solid ${getNotificationIcon(n.type)} text-xs ${getNotificationColor(n.type)}`} />
                            </div>
                            {/* 内容 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className={`text-xs font-bold ${textPrimary}`}>{n.title}</h4>
                                {!n.isRead && (
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
                                )}
                              </div>
                              <p className={`text-[10px] mt-0.5 line-clamp-2 ${textSecondary}`}>{n.body}</p>
                              <span className={`text-[9px] mt-1.5 block ${textSecondary}`}>{formatTime(n.timestamp)}</span>
                            </div>
                            {/* 删除 */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                              className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${isLightMode ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                            >
                              <i className={`fa-solid fa-trash-can text-[9px] ${textSecondary}`} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default React.memo(NotificationCenter);
