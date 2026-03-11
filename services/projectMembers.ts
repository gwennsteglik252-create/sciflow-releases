/**
 * projectMembers.ts — 项目成员共享管理服务
 *
 * 功能：
 * - 通过邮箱邀请成员加入项目（owner/editor/viewer）
 * - 移除成员
 * - 修改成员角色
 * - 查询项目成员列表
 * - 查询当前用户被邀请的共享项目
 *
 * 依赖 Supabase project_members 表（SQL schema 见 cloudSync.ts 注释）
 */
import { supabase, isSupabaseConfigured } from './supabase';

export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface ProjectMember {
    userId: string;
    email: string;
    role: MemberRole;
    invitedAt: string;
}

export interface MemberActionResult {
    success: boolean;
    error?: string;
}

// ─── 内部辅助 ───────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
}

/**
 * 通过邮箱查找已注册用户的 UUID
 * 注意：需在 Supabase Dashboard 启用 "auth.users" 的 service_role 访问，
 * 或者创建一个 public.profiles 表映射 user_id → email。
 * 这里使用 project_presence 表或 RPC 函数作为折中方案。
 */
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    if (!supabase) return null;

    // 方案一：使用 Supabase Admin API（需要 RPC 函数）
    // 为了安全和简便，我们使用一个 RPC 函数 get_user_id_by_email
    // 如果 RPC 不存在，则回退到在 project_presence 中查找
    try {
        const { data, error } = await supabase.rpc('get_user_id_by_email', { target_email: email });
        if (!error && data) {
            return { id: data, email };
        }
    } catch {
        // RPC 不存在，尝试回退方案
    }

    // 回退：在 project_presence 表中查找（该表存储了 user_email）
    try {
        const { data, error } = await supabase
            .from('project_presence')
            .select('user_id, user_email')
            .eq('user_email', email)
            .limit(1)
            .single();

        if (!error && data) {
            return { id: data.user_id, email: data.user_email };
        }
    } catch {
        // 表不存在或无数据
    }

    return null;
}

// ─── 公开 API ───────────────────────────────────────────────────

/**
 * 邀请成员加入项目
 * @param projectId 项目 ID
 * @param email 被邀请人邮箱
 * @param role 角色（默认 editor）
 */
export async function inviteMember(
    projectId: string,
    email: string,
    role: MemberRole = 'editor'
): Promise<MemberActionResult> {
    if (!isSupabaseConfigured() || !supabase) {
        return { success: false, error: '云服务未配置' };
    }

    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return { success: false, error: '请先登录' };

    // 查找被邀请用户
    const targetUser = await findUserByEmail(email);
    if (!targetUser) {
        return { success: false, error: '该用户尚未注册 SciFlow Pro，请让对方先注册账号' };
    }

    // 不能邀请自己
    if (targetUser.id === currentUserId) {
        return { success: false, error: '不能邀请自己' };
    }

    // 检查是否已是成员
    try {
        const { data: existing } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId)
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (existing) {
            return { success: false, error: '该用户已是项目成员' };
        }

        // 插入成员记录
        const { error } = await supabase
            .from('project_members')
            .insert({
                project_id: projectId,
                user_id: targetUser.id,
                role,
                invited_at: new Date().toISOString(),
            });

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('[ProjectMembers] 邀请失败:', err.message);
        return { success: false, error: err.message || '邀请失败' };
    }
}

/**
 * 移除项目成员
 */
export async function removeMember(
    projectId: string,
    userId: string
): Promise<MemberActionResult> {
    if (!isSupabaseConfigured() || !supabase) {
        return { success: false, error: '云服务未配置' };
    }

    try {
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('[ProjectMembers] 移除失败:', err.message);
        return { success: false, error: err.message || '移除失败' };
    }
}

/**
 * 更新成员角色
 */
export async function updateMemberRole(
    projectId: string,
    userId: string,
    role: MemberRole
): Promise<MemberActionResult> {
    if (!isSupabaseConfigured() || !supabase) {
        return { success: false, error: '云服务未配置' };
    }

    try {
        const { error } = await supabase
            .from('project_members')
            .update({ role })
            .eq('project_id', projectId)
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('[ProjectMembers] 角色更新失败:', err.message);
        return { success: false, error: err.message || '更新失败' };
    }
}

/**
 * 获取项目所有成员
 */
export async function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    try {
        const { data, error } = await supabase
            .from('project_members')
            .select('user_id, role, invited_at')
            .eq('project_id', projectId)
            .order('invited_at', { ascending: true });

        if (error) throw error;

        // 获取成员邮箱信息（通过 project_presence 表或 RPC）
        const members: ProjectMember[] = [];
        for (const row of (data || [])) {
            let email = '未知';
            try {
                const { data: presenceData } = await supabase
                    .from('project_presence')
                    .select('user_email')
                    .eq('user_id', row.user_id)
                    .limit(1)
                    .maybeSingle();
                if (presenceData?.user_email) email = presenceData.user_email;
            } catch { /* ignore */ }

            members.push({
                userId: row.user_id,
                email,
                role: row.role as MemberRole,
                invitedAt: row.invited_at,
            });
        }

        return members;
    } catch (err: any) {
        console.error('[ProjectMembers] 成员列表查询失败:', err.message);
        return [];
    }
}

/**
 * 查询当前用户被邀请的所有项目 ID
 */
export async function fetchSharedProjectIds(): Promise<string[]> {
    if (!isSupabaseConfigured() || !supabase) return [];

    const userId = await getCurrentUserId();
    if (!userId) return [];

    try {
        const { data, error } = await supabase
            .from('project_members')
            .select('project_id')
            .eq('user_id', userId);

        if (error) throw error;
        return (data || []).map((row: any) => row.project_id);
    } catch (err: any) {
        console.error('[ProjectMembers] 共享项目查询失败:', err.message);
        return [];
    }
}
