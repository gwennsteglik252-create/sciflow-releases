/**
 * SciFlow Pro — 云端数据同步服务 (cloudSync.ts)
 *
 * 架构：本地优先（Local-First）
 * - 写操作：先写 IndexedDB → 后台异步同步至 Supabase
 * - 读操作：启动时从 IndexedDB 加载 → 后台拉取云端，有更新则刷新
 * - 冲突解决：基于 updated_at 时间戳，云端更新时间更新时提示用户
 *
 * ====================== Supabase 数据库初始化 SQL ======================
 *
 * 请在 Supabase 控制台 SQL Editor 中执行以下语句（只需执行一次）：
 *
 * -- 启用 UUID 扩展
 * CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 *
 * -- 项目表
 * CREATE TABLE IF NOT EXISTS public.projects (
 *   id TEXT PRIMARY KEY,
 *   owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   data JSONB NOT NULL,
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 文献资源表
 * CREATE TABLE IF NOT EXISTS public.resources (
 *   id TEXT PRIMARY KEY,
 *   owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   data JSONB NOT NULL,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 试剂库存表
 * CREATE TABLE IF NOT EXISTS public.inventory (
 *   id TEXT PRIMARY KEY,
 *   owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   data JSONB NOT NULL,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 项目协作成员表
 * CREATE TABLE IF NOT EXISTS public.project_members (
 *   project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   role TEXT CHECK (role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
 *   invited_at TIMESTAMPTZ DEFAULT NOW(),
 *   PRIMARY KEY (project_id, user_id)
 * );
 *
 * -- 在线状态表（Presence）
 * CREATE TABLE IF NOT EXISTS public.project_presence (
 *   project_id TEXT,
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   user_email TEXT,
 *   user_name TEXT,
 *   last_seen TIMESTAMPTZ DEFAULT NOW(),
 *   PRIMARY KEY (project_id, user_id)
 * );
 *
 * -- Row Level Security (RLS)
 * ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE public.project_presence ENABLE ROW LEVEL SECURITY;
 *
 * -- 策略：用户只能读写自己的数据，或被邀请访问的项目
 * CREATE POLICY "owner_access_projects" ON public.projects
 *   USING (owner_id = auth.uid());
 *
 * CREATE POLICY "owner_access_resources" ON public.resources
 *   USING (owner_id = auth.uid());
 *
 * CREATE POLICY "owner_access_inventory" ON public.inventory
 *   USING (owner_id = auth.uid());
 *
 * -- 开启 Realtime 订阅
 * ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
 * ALTER PUBLICATION supabase_realtime ADD TABLE public.project_presence;
 *
 * ======================================================================
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { ResearchProject, Literature, InventoryItem } from '../types';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface SyncResult {
    success: boolean;
    status: SyncStatus;
    error?: string;
    conflictData?: any;
}

// ─── 内部工具函数 ──────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
}

function withUpdatedAt<T extends object>(item: T): T & { updatedAt: string } {
    return { ...item, updatedAt: new Date().toISOString() };
}

// ─── 项目同步 ──────────────────────────────────────────────────

/**
 * 上传单个项目至云端
 * 使用 upsert 策略（有则更新，无则插入）
 */
export async function syncProject(project: ResearchProject): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) {
        return { success: true, status: 'local' };
    }

    const userId = await getCurrentUserId();
    if (!userId) return { success: false, status: 'error', error: '用户未登录' };

    try {
        const projectWithMeta = withUpdatedAt(project);
        const { error } = await supabase
            .from('projects')
            .upsert({
                id: project.id,
                owner_id: userId,
                data: projectWithMeta,
                updated_at: projectWithMeta.updatedAt,
            }, { onConflict: 'id' });

        if (error) throw error;
        return { success: true, status: 'synced' };
    } catch (err: any) {
        console.error('[CloudSync] 项目同步失败:', err.message);
        return { success: false, status: 'error', error: err.message };
    }
}

/**
 * 批量上传所有项目（首次登录时的迁移用）
 */
export async function syncAllProjects(projects: ResearchProject[]): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) return { success: true, status: 'local' };

    const userId = await getCurrentUserId();
    if (!userId) return { success: false, status: 'error', error: '用户未登录' };

    try {
        const rows = projects.map(p => ({
            id: p.id,
            owner_id: userId,
            data: withUpdatedAt(p),
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('projects')
            .upsert(rows, { onConflict: 'id' });

        if (error) throw error;
        return { success: true, status: 'synced' };
    } catch (err: any) {
        console.error('[CloudSync] 批量项目同步失败:', err.message);
        return { success: false, status: 'error', error: err.message };
    }
}

/**
 * 从云端拉取当前用户的所有项目（含自有 + 被邀请的共享项目）
 */
export async function fetchCloudProjects(): Promise<ResearchProject[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const userId = await getCurrentUserId();
    if (!userId) return null;

    try {
        // 1. 查询自己创建的项目
        const { data: ownData, error: ownError } = await supabase
            .from('projects')
            .select('data, updated_at')
            .eq('owner_id', userId)
            .order('updated_at', { ascending: false });

        if (ownError) throw ownError;

        const ownProjects = (ownData || []).map((row: any) => row.data as ResearchProject);

        // 2. 查询被邀请的共享项目
        let sharedProjects: ResearchProject[] = [];
        try {
            const { data: memberships } = await supabase
                .from('project_members')
                .select('project_id')
                .eq('user_id', userId);

            const sharedIds = (memberships || []).map((m: any) => m.project_id);

            if (sharedIds.length > 0) {
                // 排除自己已拥有的项目（避免重复）
                const ownIds = new Set(ownProjects.map(p => p.id));
                const uniqueSharedIds = sharedIds.filter((id: string) => !ownIds.has(id));

                if (uniqueSharedIds.length > 0) {
                    const { data: sharedData } = await supabase
                        .from('projects')
                        .select('data, updated_at')
                        .in('id', uniqueSharedIds);

                    sharedProjects = (sharedData || []).map((row: any) => row.data as ResearchProject);
                }
            }
        } catch (sharedErr: any) {
            // project_members 表可能不存在，忽略
            console.warn('[CloudSync] 共享项目查询跳过:', sharedErr.message);
        }

        // 3. 合并返回
        return [...ownProjects, ...sharedProjects];
    } catch (err: any) {
        console.error('[CloudSync] 项目拉取失败:', err.message);
        return null;
    }
}

/**
 * 删除云端项目
 */
export async function deleteCloudProject(projectId: string): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) return { success: true, status: 'local' };

    try {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) throw error;
        return { success: true, status: 'synced' };
    } catch (err: any) {
        return { success: false, status: 'error', error: err.message };
    }
}

// ─── 文献资源同步 ──────────────────────────────────────────────

export async function syncAllResources(resources: Literature[]): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) return { success: true, status: 'local' };

    const userId = await getCurrentUserId();
    if (!userId) return { success: false, status: 'error', error: '用户未登录' };

    try {
        const rows = resources.map(r => ({
            id: r.id,
            owner_id: userId,
            data: r,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('resources')
            .upsert(rows, { onConflict: 'id' });

        if (error) throw error;
        return { success: true, status: 'synced' };
    } catch (err: any) {
        console.error('[CloudSync] 文献同步失败:', err.message);
        return { success: false, status: 'error', error: err.message };
    }
}

export async function fetchCloudResources(): Promise<Literature[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const userId = await getCurrentUserId();
    if (!userId) return null;

    try {
        const { data, error } = await supabase
            .from('resources')
            .select('data')
            .eq('owner_id', userId);

        if (error) throw error;
        return (data || []).map((row: any) => row.data as Literature);
    } catch (err: any) {
        console.error('[CloudSync] 文献拉取失败:', err.message);
        return null;
    }
}

// ─── 试剂库存同步 ──────────────────────────────────────────────

export async function syncAllInventory(inventory: InventoryItem[]): Promise<SyncResult> {
    if (!isSupabaseConfigured() || !supabase) return { success: true, status: 'local' };

    const userId = await getCurrentUserId();
    if (!userId) return { success: false, status: 'error', error: '用户未登录' };

    try {
        const rows = inventory.map(item => ({
            id: item.id,
            owner_id: userId,
            data: item,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('inventory')
            .upsert(rows, { onConflict: 'id' });

        if (error) throw error;
        return { success: true, status: 'synced' };
    } catch (err: any) {
        console.error('[CloudSync] 库存同步失败:', err.message);
        return { success: false, status: 'error', error: err.message };
    }
}

export async function fetchCloudInventory(): Promise<InventoryItem[] | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    const userId = await getCurrentUserId();
    if (!userId) return null;

    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('data')
            .eq('owner_id', userId);

        if (error) throw error;
        return (data || []).map((row: any) => row.data as InventoryItem);
    } catch (err: any) {
        console.error('[CloudSync] 库存拉取失败:', err.message);
        return null;
    }
}

// ─── 冲突检测 ──────────────────────────────────────────────────

/**
 * 基于 updatedAt 时间戳检测本地与云端数据是否冲突
 * 返回：'local_newer' | 'cloud_newer' | 'same'
 */
export function detectConflict(
    local: { updatedAt?: string },
    cloud: { updatedAt?: string }
): 'local_newer' | 'cloud_newer' | 'same' {
    const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
    const cloudTime = cloud.updatedAt ? new Date(cloud.updatedAt).getTime() : 0;

    const THRESHOLD_MS = 5000; // 5 秒内视为相同
    if (Math.abs(localTime - cloudTime) < THRESHOLD_MS) return 'same';
    return localTime > cloudTime ? 'local_newer' : 'cloud_newer';
}
