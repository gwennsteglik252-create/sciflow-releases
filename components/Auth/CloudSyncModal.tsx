/**
 * CloudSyncModal — 云端同步管理面板
 *
 * 纯同步控制面板（登录功能已由 AuthPage 承担）：
 * - 同步状态实时显示
 * - 手动全量同步触发
 * - 冲突处理
 * - 登出
 */
import React from 'react';
import { CloudSyncState } from '../../hooks/useCloudSync';
import { isSupabaseConfigured } from '../../services/supabase';

interface CloudSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    cloudSync: CloudSyncState;
}

const StatusBadge: React.FC<{ status: CloudSyncState['syncStatus'] }> = ({ status }) => {
    const configs: Record<string, { label: string; color: string; dot: string }> = {
        local: { label: '仅本地', color: 'text-slate-400', dot: 'bg-slate-400' },
        syncing: { label: '同步中…', color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' },
        synced: { label: '已同步', color: 'text-emerald-400', dot: 'bg-emerald-400' },
        conflict: { label: '冲突', color: 'text-amber-400', dot: 'bg-amber-400' },
        error: { label: '同步失败', color: 'text-red-400', dot: 'bg-red-400' },
    };
    const cfg = configs[status] ?? configs.local;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
};

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
    isOpen,
    onClose,
    cloudSync,
}) => {
    if (!isOpen) return null;

    const isConfigured = isSupabaseConfigured();

    const formatSyncTime = (date: Date | null) => {
        if (!date) return '—';
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-700/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                            </svg>
                            云端同步
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">跨设备同步实验数据，支持实时协作</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* 未配置 Supabase 时显示引导 */}
                    {!isConfigured && (
                        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4 text-sm text-amber-300 space-y-2">
                            <p className="font-medium">⚠ 尚未配置云同步</p>
                            <p className="text-amber-400/80 text-xs leading-relaxed">
                                请在项目根目录的 <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">.env.local</code> 文件中填入 Supabase 凭据，然后重启应用：
                            </p>
                            <pre className="bg-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-300 overflow-x-auto">
                                {`VITE_SUPABASE_URL=https://xxx.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key`}
                            </pre>
                            <a
                                href="https://supabase.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs underline underline-offset-2"
                            >
                                前往 Supabase 创建项目 →
                            </a>
                        </div>
                    )}

                    {/* 同步状态面板 */}
                    {isConfigured && (
                        <div className="space-y-4">
                            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                                {cloudSync.isSignedIn && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">当前账号</span>
                                        <span className="text-sm text-white font-medium truncate max-w-[180px]">{cloudSync.userEmail}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">同步状态</span>
                                    <StatusBadge status={cloudSync.syncStatus} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">上次同步</span>
                                    <span className="text-xs text-slate-300">{formatSyncTime(cloudSync.lastSyncedAt)}</span>
                                </div>
                            </div>

                            {/* 冲突提示 */}
                            {cloudSync.conflicts.length > 0 && (
                                <div className="bg-amber-900/30 border border-amber-600/40 rounded-xl p-3">
                                    <p className="text-amber-300 text-xs font-medium mb-2">
                                        ⚠ 检测到 {cloudSync.conflicts.length} 个数据冲突
                                    </p>
                                    {cloudSync.conflicts.slice(0, 3).map(conflict => (
                                        <div key={conflict.projectId} className="flex items-center justify-between py-1.5 border-t border-amber-800/40 first:border-0">
                                            <span className="text-xs text-slate-300 truncate max-w-[140px]">{conflict.localData.title}</span>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => cloudSync.resolveConflictKeepLocal(conflict.projectId)}
                                                    className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                                                >保留本地</button>
                                                <button
                                                    onClick={() => cloudSync.resolveConflictKeepCloud(conflict.projectId)}
                                                    className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
                                                >使用云端</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={cloudSync.triggerFullSync}
                                    disabled={cloudSync.syncStatus === 'syncing'}
                                    className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className={`w-4 h-4 ${cloudSync.syncStatus === 'syncing' ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {cloudSync.syncStatus === 'syncing' ? '同步中…' : '立即同步'}
                                </button>
                                <button
                                    onClick={async () => { await cloudSync.signOut(); onClose(); }}
                                    className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm rounded-xl transition-colors"
                                >登出</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


