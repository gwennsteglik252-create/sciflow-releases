/**
 * useAuth — 独立认证状态管理 Hook
 *
 * 职责：仅管理用户认证（登录/注册/登出/密码重置）
 * 不包含任何数据同步逻辑（同步由 useCloudSync 独立管理）
 *
 * 离线保护：检查 localStorage 中缓存的 session，
 * 已登录用户断网重启后仍可正常使用软件。
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthState {
    /** 是否已完成初始 session 恢复（false 期间应显示加载画面） */
    isLoading: boolean;
    /** 是否已通过认证 */
    isAuthenticated: boolean;
    /** 当前用户对象 */
    user: User | null;
    /** 当前用户邮箱 */
    userEmail: string | null;
    /** 用邮箱+密码登录 */
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    /** 用邮箱+密码注册 */
    signUp: (email: string, password: string) => Promise<{ error: string | null; needsVerification: boolean }>;
    /** 登出 */
    signOut: () => Promise<void>;
    /** 发送密码重置邮件 */
    resetPassword: (email: string) => Promise<{ error: string | null }>;
    /** 使用 Google OAuth 登录 */
    signInWithGoogle: () => Promise<{ error: string | null }>;
}

/**
 * 检查 localStorage 中是否存在缓存的 Supabase session
 * 用于离线模式判断：已登录过的用户在断网时仍可进入应用
 */
function hasCachedSession(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const val = localStorage.getItem(key);
                if (val) {
                    const parsed = JSON.parse(val);
                    // 检查 token 是否存在且未过期（给 30 天缓冲）
                    if (parsed?.access_token || parsed?.user) return true;
                }
            }
        }
    } catch {
        // JSON 解析失败，忽略
    }
    return false;
}

export const useAuth = (): AuthState => {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    // ─── 初始化：恢复 session 或检查离线缓存 ─────────────────────
    useEffect(() => {
        if (!isSupabaseConfigured() || !supabase) {
            // Supabase 未配置时，检查离线缓存
            if (hasCachedSession()) {
                setIsAuthenticated(true);
            }
            setIsLoading(false);
            return;
        }

        // 监听认证状态变更
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const currentUser = session?.user ?? null;
                setUser(currentUser);
                setIsAuthenticated(!!currentUser);
                setIsLoading(false);
            }
        );

        // 立即获取当前 session（处理页面刷新/启动恢复）
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setIsAuthenticated(!!currentUser);
            setIsLoading(false);
        }).catch(() => {
            // 网络不可用时兜底检查离线缓存
            if (hasCachedSession()) {
                setIsAuthenticated(true);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─── 邮箱/密码登录 ───────────────────────────────────────────
    const signIn = useCallback(async (email: string, password: string) => {
        if (!supabase) return { error: '云服务未配置' };
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                const msg = error.message;
                return {
                    error: msg.includes('Invalid login credentials') ? '邮箱或密码错误' :
                        msg.includes('Email not confirmed') ? '请先验证邮箱' : msg,
                };
            }
            return { error: null };
        } catch (err: any) {
            return { error: err.message || '登录失败，请稍后重试' };
        }
    }, []);

    // ─── 邮箱/密码注册 ───────────────────────────────────────────
    const signUp = useCallback(async (email: string, password: string) => {
        if (!supabase) return { error: '云服务未配置', needsVerification: false };
        try {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                const msg = error.message;
                return {
                    error: msg.includes('already registered') ? '邮箱已被注册，请直接登录' : msg,
                    needsVerification: false,
                };
            }
            return { error: null, needsVerification: true };
        } catch (err: any) {
            return { error: err.message || '注册失败，请稍后重试', needsVerification: false };
        }
    }, []);

    // ─── 登出 ────────────────────────────────────────────────────
    const signOut = useCallback(async () => {
        if (supabase) {
            await supabase.auth.signOut();
        }
        // 清除离线缓存（确保登出后无法绕过登录页）
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            }
        } catch { /* ignore */ }
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    // ─── 密码重置 ────────────────────────────────────────────────
    const resetPassword = useCallback(async (email: string) => {
        if (!supabase) return { error: '云服务未配置' };
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) return { error: error.message };
            return { error: null };
        } catch (err: any) {
            return { error: err.message || '发送失败，请稍后重试' };
        }
    }, []);

    // ─── Google OAuth ────────────────────────────────────────────
    const signInWithGoogle = useCallback(async () => {
        if (!supabase) return { error: '云服务未配置' };
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
            });
            if (error) return { error: error.message };
            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Google 登录失败' };
        }
    }, []);

    return {
        isLoading,
        isAuthenticated,
        user,
        userEmail: user?.email ?? null,
        signIn,
        signUp,
        signOut,
        resetPassword,
        signInWithGoogle,
    };
};
