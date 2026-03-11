/**
 * AuthPage — 全屏品牌登录页
 *
 * 设计：
 * - 左侧品牌展示区（深色渐变 + 品牌 Logo + 特色功能亮点）
 * - 右侧登录卡片（玻璃拟态 + 邮箱密码 + 忘记密码 + 第三方登录）
 * - 响应式：小屏幕时上下堆叠
 */
import React, { useState, useCallback } from 'react';
import { AuthState } from '../../hooks/useAuth';
import { useTranslation } from '../../locales/useTranslation';

type AuthMode = 'login' | 'register' | 'reset';

interface AuthPageProps {
    auth: AuthState;
}

const AuthPage: React.FC<AuthPageProps> = ({ auth }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { t } = useTranslation();

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            if (mode === 'login') {
                const { error } = await auth.signIn(email, password);
                if (error) setErrorMsg(error);
            } else if (mode === 'register') {
                const { error, needsVerification } = await auth.signUp(email, password);
                if (error) {
                    setErrorMsg(error);
                } else if (needsVerification) {
                    setSuccessMsg(t('auth.registerSuccess'));
                    setMode('login');
                }
            } else if (mode === 'reset') {
                const { error } = await auth.resetPassword(email);
                if (error) {
                    setErrorMsg(error);
                } else {
                    setSuccessMsg(t('auth.resetEmailSent'));
                    setMode('login');
                }
            }
        } catch {
            setErrorMsg(t('auth.operationFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [mode, email, password, auth]);

    const handleGoogleLogin = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg('');
        const { error } = await auth.signInWithGoogle();
        if (error) setErrorMsg(error);
        setIsLoading(false);
    }, [auth]);

    const features = [
        { icon: 'fa-flask', title: t('auth.featureExperiment'), desc: t('auth.featureExperimentDesc') },
        { icon: 'fa-chart-line', title: t('auth.featureData'), desc: t('auth.featureDataDesc') },
        { icon: 'fa-pen-fancy', title: t('auth.featureWriting'), desc: t('auth.featureWritingDesc') },
        { icon: 'fa-users', title: t('auth.featureTeam'), desc: t('auth.featureTeamDesc') },
    ];

    return (
        <div className="fixed inset-0 flex bg-slate-950 overflow-hidden select-none">
            {/* ═══ CSS 动画定义 ═══ */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(-12px) rotate(1deg); }
                    66% { transform: translateY(6px) rotate(-1deg); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                @keyframes glow-pulse {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
                @keyframes orbit {
                    from { transform: rotate(0deg) translateX(120px) rotate(0deg); }
                    to { transform: rotate(360deg) translateX(120px) rotate(-360deg); }
                }
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* ═══ 左侧品牌展示区 ═══ */}
            <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden">
                {/* 深色渐变背景 */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950" />

                {/* 装饰性光效 */}
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[100px]" style={{ animation: 'glow-pulse 6s ease-in-out infinite' }} />
                <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-purple-600/15 blur-[80px]" style={{ animation: 'glow-pulse 8s ease-in-out infinite 2s' }} />
                <div className="absolute top-1/2 left-1/2 w-[200px] h-[200px] rounded-full bg-rose-500/10 blur-[60px]" style={{ animation: 'glow-pulse 5s ease-in-out infinite 1s' }} />

                {/* 轨道装饰 */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] opacity-20">
                    <div className="absolute inset-0 border border-indigo-500/30 rounded-full" />
                    <div className="absolute inset-[-40px] border border-purple-500/20 rounded-full" />
                    <div className="absolute inset-[-80px] border border-slate-500/10 rounded-full" />
                    <div className="w-2 h-2 rounded-full bg-indigo-400 absolute" style={{ animation: 'orbit 12s linear infinite' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 absolute" style={{ animation: 'orbit 18s linear infinite reverse' }} />
                </div>

                {/* 品牌内容 */}
                <div className="relative z-10 text-center px-12 max-w-lg" style={{ animation: 'float 10s ease-in-out infinite' }}>
                    {/* Logo */}
                    <div className="mb-8 flex justify-center">
                        <div className="w-20 h-20 rounded-[22px] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] relative overflow-hidden bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#db2777] flex items-center justify-center ring-2 ring-white/10">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/25 to-transparent pointer-events-none" />
                            <svg viewBox="0 0 100 100" className="w-12 h-12 text-white drop-shadow-lg" style={{ animation: 'spin 20s linear infinite' }}>
                                <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="5" strokeOpacity="0.3" />
                                <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(45 50 50)" />
                                <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(-45 50 50)" />
                                <circle cx="50" cy="50" r="7" fill="currentColor" className="animate-pulse" />
                            </svg>
                        </div>
                    </div>

                    {/* 品牌文字 */}
                    <h1 className="text-4xl font-black tracking-tight mb-3">
                        <span
                            className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400"
                            style={{
                                backgroundSize: '200% auto',
                                animation: 'shimmer 4s linear infinite',
                            }}
                        >
                            SciFlow Pro
                        </span>
                    </h1>
                    <p className="text-slate-400 text-sm leading-relaxed mb-10">
                        {t('auth.brandSubtitle')}<br />
                        <span className="text-slate-500">{t('auth.brandSlogan')}</span>
                    </p>

                    {/* 特色功能 */}
                    <div className="grid grid-cols-2 gap-3">
                        {features.map((f, i) => (
                            <div
                                key={f.title}
                                className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 backdrop-blur-sm hover:bg-white/[0.06] transition-all duration-300"
                                style={{ animation: `slide-up 0.5s ease-out ${i * 0.1}s both` }}
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                                    <i className={`fa-solid ${f.icon} text-xs text-indigo-400`} />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-bold text-slate-200">{f.title}</div>
                                    <div className="text-[10px] text-slate-500">{f.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 底部版权 */}
                <div className="absolute bottom-6 text-center">
                    <p className="text-[10px] text-slate-600 tracking-wider">© 2026 SciFlow Pro · All Rights Reserved</p>
                </div>
            </div>

            {/* ═══ 右侧登录区 ═══ */}
            <div className="flex-1 lg:max-w-[520px] flex items-center justify-center relative">
                {/* 背景 */}
                <div className="absolute inset-0 bg-gradient-to-bl from-slate-900 via-slate-900 to-slate-950 lg:border-l lg:border-white/[0.06]" />

                {/* 登录卡片 */}
                <div className="relative z-10 w-full max-w-sm mx-6" style={{ animation: 'slide-up 0.6s ease-out' }}>
                    {/* 移动端 Logo */}
                    <div className="lg:hidden flex justify-center mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#db2777] flex items-center justify-center shadow-lg ring-1 ring-white/10">
                                <svg viewBox="0 0 100 100" className="w-6 h-6 text-white">
                                    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.3" />
                                    <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="5" transform="rotate(45 50 50)" />
                                    <circle cx="50" cy="50" r="7" fill="currentColor" />
                                </svg>
                            </div>
                            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">SciFlow Pro</span>
                        </div>
                    </div>

                    {/* 标题 */}
                    <div className="mb-7">
                        <h2 className="text-2xl font-black text-white mb-1.5">
                            {mode === 'login' ? t('auth.welcomeBack') : mode === 'register' ? t('auth.createAccount') : t('auth.resetPassword')}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {mode === 'login' ? t('auth.loginSubtitle') :
                                mode === 'register' ? t('auth.registerSubtitle') :
                                    t('auth.resetSubtitle')}
                        </p>
                    </div>

                    {/* 表单 */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 邮箱 */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wider">{t('auth.email')}</label>
                            <div className="relative">
                                <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    required
                                    className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                />
                            </div>
                        </div>

                        {/* 密码（重置模式不显示） */}
                        {mode !== 'reset' && (
                            <div>
                                <label className="text-xs font-semibold text-slate-400 block mb-2 uppercase tracking-wider">{t('auth.password')}</label>
                                <div className="relative">
                                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder={mode === 'register' ? t('auth.passwordHint') : t('auth.enterPassword')}
                                        required
                                        minLength={6}
                                        className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl pl-11 pr-11 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                                    </button>
                                </div>
                                {/* 忘记密码 */}
                                {mode === 'login' && (
                                    <button
                                        type="button"
                                        onClick={() => { setMode('reset'); setErrorMsg(''); setSuccessMsg(''); }}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition-colors"
                                    >
                                        {t('auth.forgotPassword')}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* 错误/成功提示 */}
                        {errorMsg && (
                            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/15 border border-red-700/25 rounded-xl px-4 py-3">
                                <i className="fa-solid fa-circle-xmark text-sm shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}
                        {successMsg && (
                            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-900/15 border border-emerald-700/25 rounded-xl px-4 py-3">
                                <i className="fa-solid fa-circle-check text-sm shrink-0" />
                                <span>{successMsg}</span>
                            </div>
                        )}

                        {/* 提交按钮 */}
                        <button
                            type="submit"
                            disabled={isLoading || !email || (mode !== 'reset' && !password)}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                                    {t('auth.processing')}
                                </span>
                            ) : mode === 'login' ? t('auth.login') : mode === 'register' ? t('auth.register') : t('auth.sendResetEmail')}
                        </button>
                    </form>

                    {/* 分割线 */}
                    {mode !== 'reset' && (
                        <>
                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-slate-700/50" />
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t('auth.or')}</span>
                                <div className="flex-1 h-px bg-slate-700/50" />
                            </div>

                            {/* 第三方登录 */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleGoogleLogin}
                                    disabled={isLoading}
                                    className="flex-1 flex items-center justify-center gap-2.5 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-300 hover:bg-slate-700/60 hover:text-white transition-all disabled:opacity-40"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    Google
                                </button>
                                <button
                                    disabled
                                    className="flex-1 flex items-center justify-center gap-2.5 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-500 cursor-not-allowed opacity-50"
                                    title="微信登录即将上线"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.18 2.907c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
                                    </svg>
                                    {t('auth.wechat')} <span className="text-[8px] text-slate-600">{t('auth.wechatComingSoon')}</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* 模式切换 */}
                    <div className="mt-8 text-center">
                        {mode === 'login' && (
                            <p className="text-sm text-slate-500">
                                {t('auth.noAccount')}{' '}
                                <button onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                    {t('auth.signUpNow')}
                                </button>
                            </p>
                        )}
                        {mode === 'register' && (
                            <p className="text-sm text-slate-500">
                                {t('auth.hasAccount')}{' '}
                                <button onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                    {t('auth.backToLogin')}
                                </button>
                            </p>
                        )}
                        {mode === 'reset' && (
                            <p className="text-sm text-slate-500">
                                <button onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                    {t('auth.backArrow')}
                                </button>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
