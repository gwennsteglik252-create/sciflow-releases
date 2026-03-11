/**
 * useInviteNotifications — 登录后检查新的项目邀请
 *
 * 返回：
 * - newInvites: 未读邀请列表
 * - hasNew: 是否有新邀请
 * - markAsRead: 标记某个邀请为已读
 * - markAllAsRead: 标记所有为已读
 * - refresh: 手动刷新
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export interface InviteNotification {
    projectId: string;
    projectTitle: string;
    role: string;
    invitedAt: string;
}

interface UseInviteNotificationsResult {
    newInvites: InviteNotification[];
    hasNew: boolean;
    markAsRead: (projectId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    refresh: () => Promise<void>;
}

export const useInviteNotifications = (): UseInviteNotificationsResult => {
    const [newInvites, setNewInvites] = useState<InviteNotification[]>([]);

    const fetchInvites = useCallback(async () => {
        if (!isSupabaseConfigured() || !supabase) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;

            // 查询未读邀请
            const { data, error } = await supabase
                .from('project_members')
                .select('project_id, role, invited_at, is_read')
                .eq('user_id', session.user.id)
                .eq('is_read', false);

            if (error) {
                // is_read 字段可能不存在（用户未执行 ALTER TABLE SQL）
                if (error.message?.includes('is_read')) {
                    console.warn('[InviteNotifications] is_read 字段不存在，跳过通知检查');
                    return;
                }
                throw error;
            }

            if (!data || data.length === 0) {
                setNewInvites([]);
                return;
            }

            // 获取项目标题
            const projectIds = data.map((d: any) => d.project_id);
            const { data: projects } = await supabase
                .from('projects')
                .select('id, data')
                .in('id', projectIds);

            const projectTitleMap = new Map<string, string>();
            (projects || []).forEach((p: any) => {
                projectTitleMap.set(p.id, p.data?.title || '未命名项目');
            });

            const invites: InviteNotification[] = data.map((d: any) => ({
                projectId: d.project_id,
                projectTitle: projectTitleMap.get(d.project_id) || '未命名项目',
                role: d.role,
                invitedAt: d.invited_at,
            }));

            setNewInvites(invites);
        } catch (err: any) {
            console.warn('[InviteNotifications] 查询失败:', err.message);
        }
    }, []);

    // 登录后立即检查一次
    useEffect(() => {
        fetchInvites();
        // 每 60 秒轮询
        const interval = setInterval(fetchInvites, 60000);
        return () => clearInterval(interval);
    }, [fetchInvites]);

    const markAsRead = useCallback(async (projectId: string) => {
        if (!isSupabaseConfigured() || !supabase) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;

            await supabase
                .from('project_members')
                .update({ is_read: true })
                .eq('project_id', projectId)
                .eq('user_id', session.user.id);

            setNewInvites(prev => prev.filter(i => i.projectId !== projectId));
        } catch (err: any) {
            console.warn('[InviteNotifications] 标记已读失败:', err.message);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        if (!isSupabaseConfigured() || !supabase) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;

            await supabase
                .from('project_members')
                .update({ is_read: true })
                .eq('user_id', session.user.id)
                .eq('is_read', false);

            setNewInvites([]);
        } catch (err: any) {
            console.warn('[InviteNotifications] 全部标记已读失败:', err.message);
        }
    }, []);

    return {
        newInvites,
        hasNew: newInvites.length > 0,
        markAsRead,
        markAllAsRead,
        refresh: fetchInvites,
    };
};
