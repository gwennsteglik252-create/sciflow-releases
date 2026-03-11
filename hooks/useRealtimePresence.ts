/**
 * useRealtimePresence — 实时在线状态 Hook
 *
 * 功能：
 * 1. 当用户进入某个项目时，广播自己的在线状态
 * 2. 订阅同一项目的其他在线用户
 * 3. 订阅项目数据变更（其他人保存时刷新本地）
 *
 * 使用示例：
 * const { onlineUsers, hasRemoteChanges, acceptRemoteChanges } = useRealtimePresence({
 *   projectId: project.id,
 *   onRemoteUpdate: (newProjectData) => setProject(newProjectData),
 * });
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlineUser {
    userId: string;
    email: string;
    name?: string;
    joinedAt: string;
    isCurrentUser: boolean;
}

interface UseRealtimePresenceOptions {
    projectId: string | null;
    /** 收到远端数据更新时的回调（传入最新的项目 data） */
    onRemoteUpdate?: (updatedData: any) => void;
}

export interface RealtimePresenceState {
    /** 当前在线的协作用户（不含自己） */
    onlineUsers: OnlineUser[];
    /** 是否有来自远端的未接受更改 */
    hasRemoteChanges: boolean;
    /** 接受远端更改（刷新本地数据） */
    acceptRemoteChanges: () => void;
    /** 是否已连接实时频道 */
    isConnected: boolean;
}

export const useRealtimePresence = ({
    projectId,
    onRemoteUpdate,
}: UseRealtimePresenceOptions): RealtimePresenceState => {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [hasRemoteChanges, setHasRemoteChanges] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const latestRemoteDataRef = useRef<any>(null);
    const currentUserIdRef = useRef<string | null>(null);

    // ─── 获取当前用户信息 ─────────────────────────────────────────
    useEffect(() => {
        if (!isSupabaseConfigured() || !supabase) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
            currentUserIdRef.current = session?.user?.id ?? null;
        });
    }, []);

    // ─── 建立实时频道连接 ─────────────────────────────────────────
    useEffect(() => {
        if (!isSupabaseConfigured() || !supabase || !projectId) return;

        // 清理上一个频道
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channelName = `project:${projectId}`;

        const channel = supabase.channel(channelName, {
            config: {
                presence: { key: currentUserIdRef.current || 'anonymous' },
            },
        });

        // ─── Presence（在线用户追踪） ───────────────────────────────
        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState<{
                    email: string;
                    name?: string;
                    joinedAt: string;
                }>();

                const users: OnlineUser[] = Object.entries(state)
                    .flatMap(([userId, presences]) =>
                        presences.map(p => ({
                            userId,
                            email: p.email,
                            name: p.name,
                            joinedAt: p.joinedAt,
                            isCurrentUser: userId === currentUserIdRef.current,
                        }))
                    )
                    .filter(u => !u.isCurrentUser); // 过滤掉自己

                setOnlineUsers(users);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                if (key === currentUserIdRef.current) return;
                console.log('[Realtime] 用户加入:', key, newPresences);
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                if (key === currentUserIdRef.current) return;
                console.log('[Realtime] 用户离开:', key);
            });

        // ─── 数据库变更订阅（项目被他人更新时） ───────────────────────
        channel.on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'projects',
                filter: `id=eq.${projectId}`,
            },
            (payload) => {
                const updatedBy = payload.new?.data?.ownerId;
                // 忽略自己发出的更新
                if (updatedBy === currentUserIdRef.current) return;

                console.log('[Realtime] 远端项目数据已更新，来自用户:', updatedBy);
                latestRemoteDataRef.current = payload.new?.data;
                setHasRemoteChanges(true);
            }
        );

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                setIsConnected(true);

                // 广播自己的在线状态
                const { data: { session } } = await supabase!.auth.getSession();
                if (session?.user) {
                    await channel.track({
                        email: session.user.email || 'unknown',
                        name: session.user.user_metadata?.full_name,
                        joinedAt: new Date().toISOString(),
                    });
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                setIsConnected(false);
            }
        });

        channelRef.current = channel;

        return () => {
            if (supabase && channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                setIsConnected(false);
                setOnlineUsers([]);
            }
        };
    }, [projectId]);

    // ─── 接受远端更改 ─────────────────────────────────────────────
    const acceptRemoteChanges = useCallback(() => {
        if (latestRemoteDataRef.current && onRemoteUpdate) {
            onRemoteUpdate(latestRemoteDataRef.current);
        }
        setHasRemoteChanges(false);
        latestRemoteDataRef.current = null;
    }, [onRemoteUpdate]);

    return {
        onlineUsers,
        hasRemoteChanges,
        acceptRemoteChanges,
        isConnected,
    };
};
