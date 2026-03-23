/**
 * AuthGate — 认证守卫组件
 *
 * 作为应用最外层包裹组件：
 * - isLoading  → 显示品牌 splash screen（session 恢复中）
 * - 未认证     → 显示全屏 AuthPage 登录页
 * - 已认证     → 放行，渲染 children（主应用）
 */
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import AuthPage from './AuthPage';

interface AuthGateProps {
    children: React.ReactNode;
}

/** 品牌加载画面 — session 恢复期间展示 */
const SplashScreen: React.FC = () => (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 flex flex-col items-center justify-center select-none">
        <style>{`
            @keyframes splash-glow {
                0%, 100% { opacity: 0.3; transform: scale(1); }
                50% { opacity: 0.6; transform: scale(1.08); }
            }
            @keyframes splash-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
        {/* 背景光效 */}
        <div className="absolute w-[300px] h-[300px] rounded-full bg-indigo-600/20 blur-[100px]" style={{ animation: 'splash-glow 3s ease-in-out infinite' }} />

        {/* Logo */}
        <div className="relative mb-6">
            <div className="w-20 h-20 rounded-[22px] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.6)] relative overflow-hidden bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#db2777] flex items-center justify-center ring-2 ring-white/10">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/25 to-transparent pointer-events-none" />
                <svg viewBox="0 0 100 100" className="w-12 h-12 text-white drop-shadow-lg" style={{ animation: 'splash-spin 20s linear infinite' }}>
                    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="5" strokeOpacity="0.3" />
                    <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(45 50 50)" />
                    <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(-45 50 50)" />
                    <circle cx="50" cy="50" r="7" fill="currentColor" className="animate-pulse" />
                </svg>
            </div>
        </div>

        {/* 品牌名 */}
        <h1 className="text-2xl font-black tracking-tight mb-3">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400">
                SciFlow Pro
            </span>
        </h1>

        {/* 加载指示 */}
        <div className="flex items-center gap-2 text-slate-500 text-xs">
            <div className="w-4 h-4 border-2 border-indigo-500/40 border-t-indigo-400 rounded-full" style={{ animation: 'splash-spin 1s linear infinite' }} />
            <span>正在加载…</span>
        </div>
    </div>
);

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
    const auth = useAuth();

    // 初始 session 恢复中 → 显示 splash
    if (auth.isLoading) {
        return <SplashScreen />;
    }

    // 未认证 → 显示登录页
    if (!auth.isAuthenticated) {
        return <AuthPage auth={auth} />;
    }

    // 已认证 → 放行
    return <>{children}</>;
};

export default AuthGate;
