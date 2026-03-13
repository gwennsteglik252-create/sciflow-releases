/**
 * useInviteNotifications — 登录后检查新的项目邀请
 *
 * 使用本地 localStorage 跟踪已读状态，避免依赖 Supabase is_read 字段。
 *
 * 返回：
 * - newInvites: 未读邀请列表
 * - hasNew: 是否有新邀请
 * - markAsRead: 标记某个邀请为已读
 * - markAllAsRead: 标记所有为已读
 * - refresh: 手动刷新
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const READ_INVITES_KEY = 'sciflow_read_invites';

/** 模块级标记：project_members 表是否可用（首次失败后置 false，停止后续查询） */
let projectMembersAvailable = true;

function getReadInviteIds(): Set<string> {
    try {
        const raw = localStorage.getItem(READ_INVITES_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveReadInviteIds(ids: Set<string>) {
    localStorage.setItem(READ_INVITES_KEY, JSON.stringify([...ids]));
}

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
    const hasWarnedRef = useRef(false);

    const fetchInvites = useCallback(async () => {
        // 如果表不可用或未配置 Supabase，直接跳过
        if (!projectMembersAvailable || !isSupabaseConfigured() || !supabase) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;

            // 简单查询，不依赖 is_read 字段
            const { data, error } = await supabase
                .from('project_members')
                .select('project_id, role, invited_at')
                .eq('user_id', session.user.id);

            if (error) {
                // 表不存在或 RLS/权限问题 → 标记为不可用，不再重试
                projectMembersAvailable = false;
                if (!hasWarnedRef.current) {
                    console.warn('[InviteNotifications] project_members 表不可用，已停止查询:', error.message);
                    hasWarnedRef.current = true;
                }
                return;
            }

            if (!data || data.length === 0) {
                setNewInvites([]);
                return;
            }

            // 用本地已读列表过滤
            const readIds = getReadInviteIds();
            const unreadData = data.filter((d: any) => !readIds.has(d.project_id));

            if (unreadData.length === 0) {
                setNewInvites([]);
                return;
            }

            // 获取项目标题
            const projectIds = unreadData.map((d: any) => d.project_id);
            const { data: projects } = await supabase
                .from('projects')
                .select('id, data')
                .in('id', projectIds);

            const projectTitleMap = new Map<string, string>();
            (projects || []).forEach((p: any) => {
                projectTitleMap.set(p.id, p.data?.title || '未命名项目');
            });

            const invites: InviteNotification[] = unreadData.map((d: any) => ({
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
        const readIds = getReadInviteIds();
        readIds.add(projectId);
        saveReadInviteIds(readIds);
        setNewInvites(prev => prev.filter(i => i.projectId !== projectId));
    }, []);

    const markAllAsRead = useCallback(async () => {
        const readIds = getReadInviteIds();
        newInvites.forEach(i => readIds.add(i.projectId));
        saveReadInviteIds(readIds);
        setNewInvites([]);
    }, [newInvites]);

    return {
        newInvites,
        hasNew: newInvites.length > 0,
        markAsRead,
        markAllAsRead,
        refresh: fetchInvites,
    };
};
