/**
 * useCloudSync — 云端数据同步 Hook
 *
 * 功能：
 * 1. 应用启动时，从云端拉取最新数据并与本地合并
 * 2. 监听本地数据变化，自动上传至云端（防抖 5 秒）
 * 3. 提供同步状态（syncing/synced/conflict/local）给 UI 显示
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import {
    syncProject,
    syncAllProjects,
    syncAllResources,
    syncAllInventory,
    fetchCloudProjects,
    fetchCloudResources,
    fetchCloudInventory,
    detectConflict,
    SyncStatus,
} from '../services/cloudSync';
import { ResearchProject, Literature, InventoryItem } from '../types';
import { sanitizeProjects } from '../services/dataSanitizer';
import { vault } from '../services/persistence';

interface UseCloudSyncOptions {
    projects: ResearchProject[];
    setProjects: (projects: ResearchProject[]) => void;
    resources: Literature[];
    setResources: (resources: Literature[]) => void;
    inventory: InventoryItem[];
    setInventory: (inventory: InventoryItem[]) => void;
    isStorageReady: boolean;
}

export interface CloudSyncState {
    /** 是否已登录云端账号 */
    isSignedIn: boolean;
    /** 当前用户 email */
    userEmail: string | null;
    /** 整体同步状态 */
    syncStatus: SyncStatus;
    /** 上次成功同步时间 */
    lastSyncedAt: Date | null;
    /** 冲突项目列表（等待用户手动解决） */
    conflicts: Array<{ projectId: string; localData: ResearchProject; cloudData: ResearchProject }>;
    /** 手动触发全量同步 */
    triggerFullSync: () => Promise<void>;
    /** 接受本地版本（丢弃云端） */
    resolveConflictKeepLocal: (projectId: string) => Promise<void>;
    /** 接受云端版本（丢弃本地） */
    resolveConflictKeepCloud: (projectId: string) => void;
    /** 登出 */
    signOut: () => Promise<void>;
}

export const useCloudSync = ({
    projects,
    setProjects,
    resources,
    setResources,
    inventory,
    setInventory,
    isStorageReady,
}: UseCloudSyncOptions): CloudSyncState => {
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [conflicts, setConflicts] = useState<CloudSyncState['conflicts']>([]);

    // 防止首次 hydration 触发不必要的上传
    const isInitialSyncDone = useRef(false);
    const uploadDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // 用 ref 保存最新的数据引用，避免闭包捕获旧值
    const projectsRef = useRef(projects);
    const resourcesRef = useRef(resources);
    const inventoryRef = useRef(inventory);
    projectsRef.current = projects;
    resourcesRef.current = resources;
    inventoryRef.current = inventory;

    // ─── 初始全量同步 ────────────────────────────────────────────
    const performInitialSync = useCallback(async () => {
        if (!isSupabaseConfigured()) return;
        setSyncStatus('syncing');

        try {
            // 并行拉取三大实体
            const [cloudProjects, cloudResources, cloudInventory] = await Promise.all([
                fetchCloudProjects(),
                fetchCloudResources(),
                fetchCloudInventory(),
            ]);

            const currentProjects = projectsRef.current || [];
            const currentResources = resourcesRef.current || [];
            const currentInventory = inventoryRef.current || [];

            // 合并项目（检测冲突）
            if (cloudProjects && cloudProjects.length > 0) {
                // ✅ 数据清洗：确保云端数据结构完整
                const safeCloudProjects = sanitizeProjects(cloudProjects);

                // ✅ 空数据保护：如果云端数据量远小于本地，标为冲突
                if (currentProjects.length > 3 && safeCloudProjects.length < currentProjects.length / 3) {
                    console.warn(`[CloudSync] 空数据保护触发: 云端 ${safeCloudProjects.length} 项 vs 本地 ${currentProjects.length} 项`);
                    const bulkConflicts = safeCloudProjects.map(cp => ({
                        projectId: cp.id,
                        localData: currentProjects.find(lp => lp.id === cp.id) || cp,
                        cloudData: cp,
                    }));
                    setConflicts(bulkConflicts);
                    setSyncStatus('conflict');
                } else {
                    // ✅ 覆盖前备份本地数据
                    try {
                        await vault.createBackup('projects', 'cloud_sync_before_merge');
                    } catch (e) {
                        console.warn('[CloudSync] 备份创建失败，继续同步:', e);
                    }

                    const newConflicts: CloudSyncState['conflicts'] = [];
                    const updatedProjects = [...currentProjects];

                    safeCloudProjects.forEach(cloudProj => {
                        const localIdx = updatedProjects.findIndex(p => p.id === cloudProj.id);
                        if (localIdx === -1) {
                            updatedProjects.push(cloudProj);
                        } else {
                            const localProj = updatedProjects[localIdx];
                            const resolution = detectConflict(
                                { updatedAt: (localProj as any).updatedAt },
                                { updatedAt: (cloudProj as any).updatedAt }
                            );
                            if (resolution === 'cloud_newer') {
                                updatedProjects[localIdx] = cloudProj;
                            }
                        }
                    });

                    if (newConflicts.length > 0) {
                        setConflicts(newConflicts);
                        setSyncStatus('conflict');
                    } else {
                        // ✅ 最终写入也做清洗
                        setProjects(sanitizeProjects(updatedProjects));
                    }
                }
            }

            // 首次登录迁移：云端为空但本地有数据 → 上传
            if (cloudProjects !== null && (cloudProjects?.length ?? 0) === 0 && currentProjects.length > 0) {
                await syncAllProjects(currentProjects);
            }
            if (currentResources.length > 0) {
                if (cloudResources && cloudResources.length > 0) {
                    setResources(cloudResources);
                } else {
                    await syncAllResources(currentResources);
                }
            }
            if (currentInventory.length > 0) {
                if (cloudInventory && cloudInventory.length > 0) {
                    setInventory(cloudInventory);
                } else {
                    await syncAllInventory(currentInventory);
                }
            }

            isInitialSyncDone.current = true;
            // ✅ 确保所有路径最终都设置同步完成状态
            setSyncStatus(prev => prev === 'conflict' ? 'conflict' : 'synced');
            setLastSyncedAt(new Date());
        } catch (err) {
            console.error('[useCloudSync] 初始同步失败:', err);
            setSyncStatus('error');
        }
    }, [setProjects, setResources, setInventory]);

    // ─── 监听 Auth 状态（仅更新显示，不触发同步） ─────────────────
    useEffect(() => {
        if (!isSupabaseConfigured() || !supabase) return;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                const user = session?.user ?? null;
                setIsSignedIn(!!user);
                setUserEmail(user?.email ?? null);

                if (event === 'SIGNED_OUT') {
                    setSyncStatus('local');
                    setLastSyncedAt(null);
                    setConflicts([]);
                    isInitialSyncDone.current = false;
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // ─── 监听本地数据变化，防抖上传 ────────────────────────────────
    useEffect(() => {
        if (!isSignedIn || !isStorageReady || !isInitialSyncDone.current) return;

        if (uploadDebounceRef.current) clearTimeout(uploadDebounceRef.current);

        uploadDebounceRef.current = setTimeout(async () => {
            const currentProjects = projectsRef.current;
            if (!currentProjects || currentProjects.length === 0) return;
            setSyncStatus('syncing');
            try {
                await syncAllProjects(currentProjects);
                setSyncStatus('synced');
                setLastSyncedAt(new Date());
            } catch {
                setSyncStatus('error');
            }
        }, 5000); // 5 秒防抖

        return () => {
            if (uploadDebounceRef.current) clearTimeout(uploadDebounceRef.current);
        };
    }, [projects, isSignedIn, isStorageReady]);

    // ─── 手动全量同步 ────────────────────────────────────────────
    const triggerFullSync = useCallback(async () => {
        const currentProjects = projectsRef.current;
        const currentResources = resourcesRef.current;
        const currentInventory = inventoryRef.current;
        if (!currentProjects) return;
        setSyncStatus('syncing');
        try {
            await Promise.all([
                syncAllProjects(currentProjects),
                currentResources ? syncAllResources(currentResources) : Promise.resolve(),
                currentInventory ? syncAllInventory(currentInventory) : Promise.resolve(),
            ]);
            setSyncStatus('synced');
            setLastSyncedAt(new Date());
        } catch {
            setSyncStatus('error');
        }
    }, []);

    // ─── 冲突解决 ────────────────────────────────────────────────
    const resolveConflictKeepLocal = useCallback(async (projectId: string) => {
        const conflict = conflicts.find(c => c.projectId === projectId);
        if (!conflict) return;
        await syncProject(conflict.localData);
        setConflicts(prev => prev.filter(c => c.projectId !== projectId));
        if (conflicts.length <= 1) setSyncStatus('synced');
    }, [conflicts]);

    const resolveConflictKeepCloud = useCallback((projectId: string) => {
        const conflict = conflicts.find(c => c.projectId === projectId);
        if (!conflict) return;
        const updated = projects.map((p: ResearchProject) =>
            p.id === projectId ? conflict.cloudData : p
        );
        setProjects(updated);
        setConflicts(prev => prev.filter(c => c.projectId !== projectId));
        if (conflicts.length <= 1) setSyncStatus('synced');
    }, [conflicts, setProjects, projects]);

    // ─── 登出 ────────────────────────────────────────────────────
    const signOut = useCallback(async () => {
        if (supabase) await supabase.auth.signOut();
    }, []);

    return {
        isSignedIn,
        userEmail,
        syncStatus,
        lastSyncedAt,
        conflicts,
        triggerFullSync,
        resolveConflictKeepLocal,
        resolveConflictKeepCloud,
        signOut,
    };
};
