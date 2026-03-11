/**
 * ProjectMembersPanel — 项目成员管理面板
 *
 * 功能：
 * - 显示当前项目成员列表（邮箱、角色、加入时间）
 * - 通过邮箱邀请新成员（选择角色）
 * - 修改成员角色 / 移除成员
 * - 仅项目 owner 可操作
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    inviteMember,
    removeMember,
    updateMemberRole,
    fetchProjectMembers,
    ProjectMember,
    MemberRole,
} from '../../services/projectMembers';

interface ProjectMembersPanelProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
    isLightMode?: boolean;
}

const ROLE_CONFIG: Record<MemberRole, { label: string; color: string; bgColor: string; icon: string }> = {
    owner: { label: '所有者', color: 'text-amber-400', bgColor: 'bg-amber-500/15 border-amber-500/25', icon: 'fa-crown' },
    editor: { label: '编辑者', color: 'text-blue-400', bgColor: 'bg-blue-500/15 border-blue-500/25', icon: 'fa-pen' },
    viewer: { label: '查看者', color: 'text-slate-400', bgColor: 'bg-slate-500/15 border-slate-500/25', icon: 'fa-eye' },
};

const ProjectMembersPanel: React.FC<ProjectMembersPanelProps> = ({
    projectId,
    isOpen,
    onClose,
    isLightMode = false,
}) => {
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<MemberRole>('editor');
    const [isInviting, setIsInviting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // ─── 加载成员列表 ─────────────────────────────────────────────
    const loadMembers = useCallback(async () => {
        setIsLoading(true);
        const result = await fetchProjectMembers(projectId);
        setMembers(result);
        setIsLoading(false);
    }, [projectId]);

    useEffect(() => {
        if (isOpen) {
            loadMembers();
            setMessage(null);
        }
    }, [isOpen, loadMembers]);

    // ─── 邀请成员 ─────────────────────────────────────────────────
    const handleInvite = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;

        setIsInviting(true);
        setMessage(null);

        const result = await inviteMember(projectId, inviteEmail.trim(), inviteRole);

        if (result.success) {
            setMessage({ type: 'success', text: `已成功邀请 ${inviteEmail} 为${ROLE_CONFIG[inviteRole].label}` });
            setInviteEmail('');
            await loadMembers();
        } else {
            setMessage({ type: 'error', text: result.error || '邀请失败' });
        }

        setIsInviting(false);
    }, [projectId, inviteEmail, inviteRole, loadMembers]);

    // ─── 移除成员 ─────────────────────────────────────────────────
    const handleRemove = useCallback(async (member: ProjectMember) => {
        setMessage(null);
        const result = await removeMember(projectId, member.userId);
        if (result.success) {
            setMessage({ type: 'success', text: `已移除 ${member.email}` });
            await loadMembers();
        } else {
            setMessage({ type: 'error', text: result.error || '移除失败' });
        }
    }, [projectId, loadMembers]);

    // ─── 修改角色 ─────────────────────────────────────────────────
    const handleRoleChange = useCallback(async (member: ProjectMember, newRole: MemberRole) => {
        setMessage(null);
        const result = await updateMemberRole(projectId, member.userId, newRole);
        if (result.success) {
            setMessage({ type: 'success', text: `已将 ${member.email} 角色改为${ROLE_CONFIG[newRole].label}` });
            await loadMembers();
        } else {
            setMessage({ type: 'error', text: result.error || '更新失败' });
        }
    }, [projectId, loadMembers]);

    if (!isOpen) return null;

    const bg = isLightMode ? 'bg-white' : 'bg-slate-900';
    const border = isLightMode ? 'border-slate-200' : 'border-slate-700';
    const textPrimary = isLightMode ? 'text-slate-800' : 'text-white';
    const textSecondary = isLightMode ? 'text-slate-500' : 'text-slate-400';
    const cardBg = isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/50 border-slate-700/50';
    const inputBg = isLightMode
        ? 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
        : 'bg-slate-800/60 border-slate-700/50 text-white placeholder-slate-600';

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className={`relative w-full max-w-lg mx-4 ${bg} border ${border} rounded-2xl shadow-2xl overflow-hidden`}
                style={{ animation: 'slide-up 0.3s ease-out' }}>
                <style>{`
                    @keyframes slide-up {
                        from { opacity: 0; transform: translateY(16px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>

                {/* Header */}
                <div className={`px-6 pt-6 pb-4 border-b ${border} flex items-center justify-between`}>
                    <div>
                        <h2 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
                            <i className="fa-solid fa-users text-indigo-400" />
                            成员管理
                        </h2>
                        <p className={`text-xs ${textSecondary} mt-0.5`}>邀请协作者共同编辑此项目</p>
                    </div>
                    <button onClick={onClose} className={`${textSecondary} hover:${textPrimary} transition-colors p-1.5 rounded-lg hover:bg-slate-700/30`}>
                        <i className="fa-solid fa-xmark text-sm" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                    {/* ═══ 邀请表单 ═══ */}
                    <form onSubmit={handleInvite} className="space-y-3">
                        <label className={`text-xs font-semibold ${textSecondary} uppercase tracking-wider`}>邀请新成员</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <i className={`fa-solid fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-xs ${textSecondary}`} />
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="输入对方邮箱"
                                    required
                                    className={`w-full ${inputBg} border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all`}
                                />
                            </div>
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value as MemberRole)}
                                className={`${inputBg} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60 transition-all cursor-pointer`}
                            >
                                <option value="editor">编辑者</option>
                                <option value="viewer">查看者</option>
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={isInviting || !inviteEmail}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {isInviting ? (
                                <><i className="fa-solid fa-spinner animate-spin text-xs" /> 邀请中…</>
                            ) : (
                                <><i className="fa-solid fa-user-plus text-xs" /> 发送邀请</>
                            )}
                        </button>
                    </form>

                    {/* ═══ 提示消息 ═══ */}
                    {message && (
                        <div className={`flex items-center gap-2 text-xs rounded-xl px-4 py-3 border ${message.type === 'success'
                                ? 'text-emerald-400 bg-emerald-900/15 border-emerald-700/25'
                                : 'text-red-400 bg-red-900/15 border-red-700/25'
                            }`}>
                            <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'} text-sm`} />
                            <span>{message.text}</span>
                        </div>
                    )}

                    {/* ═══ 角色说明 ═══ */}
                    <div className={`border ${border} rounded-xl p-3 space-y-1.5`}>
                        <p className={`text-[10px] font-bold ${textSecondary} uppercase tracking-wider mb-2`}>角色权限说明</p>
                        <div className="flex gap-3">
                            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                                <div key={role} className="flex items-center gap-1.5">
                                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${cfg.bgColor}`}>
                                        <i className={`fa-solid ${cfg.icon} text-[8px] ${cfg.color}`} />
                                    </span>
                                    <span className={`text-[10px] font-medium ${textSecondary}`}>{cfg.label}</span>
                                </div>
                            ))}
                        </div>
                        <p className={`text-[10px] ${textSecondary} leading-relaxed`}>
                            所有者：完整权限 · 编辑者：可编辑数据 · 查看者：仅只读
                        </p>
                    </div>

                    {/* ═══ 成员列表 ═══ */}
                    <div>
                        <p className={`text-xs font-semibold ${textSecondary} uppercase tracking-wider mb-3`}>
                            当前成员 {members.length > 0 && <span className="text-indigo-400 ml-1">({members.length})</span>}
                        </p>

                        {isLoading ? (
                            <div className={`flex items-center justify-center py-8 ${textSecondary}`}>
                                <i className="fa-solid fa-spinner animate-spin mr-2" />
                                <span className="text-xs">加载中…</span>
                            </div>
                        ) : members.length === 0 ? (
                            <div className={`text-center py-8 ${textSecondary}`}>
                                <i className="fa-solid fa-user-group text-2xl opacity-30 mb-2" />
                                <p className="text-xs">暂无协作成员</p>
                                <p className="text-[10px] opacity-60 mt-1">通过上方表单邀请团队成员加入</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {members.map(member => {
                                    const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
                                    const initial = member.email.charAt(0).toUpperCase();
                                    return (
                                        <div
                                            key={member.userId}
                                            className={`flex items-center gap-3 border ${cardBg} rounded-xl px-4 py-3 group transition-all`}
                                        >
                                            {/* 头像 */}
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shrink-0 shadow-md">
                                                {initial}
                                            </div>

                                            {/* 信息 */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${textPrimary} truncate`}>{member.email}</p>
                                                <p className={`text-[10px] ${textSecondary}`}>
                                                    加入于 {new Date(member.invitedAt).toLocaleDateString('zh-CN')}
                                                </p>
                                            </div>

                                            {/* 角色标签 */}
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${roleConfig.bgColor} ${roleConfig.color}`}>
                                                <i className={`fa-solid ${roleConfig.icon} text-[8px]`} />
                                                {roleConfig.label}
                                            </span>

                                            {/* 操作按钮（非 owner 可操作） */}
                                            {member.role !== 'owner' && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* 切换角色 */}
                                                    <button
                                                        onClick={() => handleRoleChange(
                                                            member,
                                                            member.role === 'editor' ? 'viewer' : 'editor'
                                                        )}
                                                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all text-[10px] ${isLightMode
                                                                ? 'border-slate-300 text-slate-500 hover:bg-slate-100'
                                                                : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                                                            }`}
                                                        title={`切换为${member.role === 'editor' ? '查看者' : '编辑者'}`}
                                                    >
                                                        <i className="fa-solid fa-arrows-rotate" />
                                                    </button>
                                                    {/* 移除 */}
                                                    <button
                                                        onClick={() => handleRemove(member)}
                                                        className="w-7 h-7 rounded-lg border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500/10 transition-all text-[10px]"
                                                        title="移除成员"
                                                    >
                                                        <i className="fa-solid fa-user-minus" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectMembersPanel;
