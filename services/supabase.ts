/**
 * SciFlow Pro — Supabase 客户端初始化
 *
 * 使用前请在 .env.local 中配置：
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your-anon-key
 *
 * 如何获取这两个值：
 *   1. 访问 https://supabase.com → 创建新项目
 *   2. 进入 Project Settings → API → 复制 URL 和 anon key
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY as string;

// 延迟初始化：未配置时返回 null，应用其余功能正常运行
export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL') {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            // Electron 环境下绕过 navigator.locks（避免锁竞争导致死锁）
            lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
            // Electron 不支持 PKCE 重定向
            flowType: 'implicit',
            // 使用 localStorage 存储 session（兼容 Electron renderer）
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });
}

/** 检查 Supabase 是否已配置并可用 */
export const isSupabaseConfigured = (): boolean => {
    return supabase !== null;
};

export default supabase;
