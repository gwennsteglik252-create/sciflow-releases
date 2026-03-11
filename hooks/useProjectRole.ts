/**
 * useProjectRole — 查询当前用户在某项目中的角色
 *
 * 返回：
 * - role: 'owner' | 'editor' | 'viewer' | null
 * - canEdit: owner 或 editor 时为 true
 * - isOwner: 仅 owner 为 true
 * - isLoading: 查询中
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export type ProjectRole = 'owner' | 'editor' | 'viewer' | null;

interface UseProjectRoleResult {
    role: ProjectRole;
    canEdit: boolean;
    isOwner: boolean;
    isLoading: boolean;
}

export const useProjectRole = (projectId: string | null): UseProjectRoleResult => {
    const [role, setRole] = useState<ProjectRole>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkRole = useCallback(async () => {
        if (!projectId || !isSupabaseConfigured() || !supabase) {
            // 离线或未配置时，默认给予完整权限
            setRole('owner');
            setIsLoading(false);
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) {
                setRole('owner'); // 未登录但通过了 AuthGate = 离线模式
                setIsLoading(false);
                return;
            }

            // 1. 检查是否为项目 owner
            const { data: project } = await supabase
                .from('projects')
                .select('owner_id')
                .eq('id', projectId)
                .maybeSingle();

            if (project?.owner_id === userId) {
                setRole('owner');
                setIsLoading(false);
                return;
            }

            // 2. 检查 project_members 表中的角色
            const { data: membership } = await supabase
                .from('project_members')
                .select('role')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .maybeSingle();

            if (membership) {
                setRole(membership.role as ProjectRole);
            } else {
                // 不在成员列表中但能看到项目 = 可能是通过本地数据打开
                setRole('owner');
            }
        } catch (err) {
            console.warn('[useProjectRole] 角色查询失败，默认给予完整权限:', err);
            setRole('owner');
        }

        setIsLoading(false);
    }, [projectId]);

    useEffect(() => {
        setIsLoading(true);
        checkRole();
    }, [checkRole]);

    return {
        role,
        canEdit: role === 'owner' || role === 'editor',
        isOwner: role === 'owner',
        isLoading,
    };
};
