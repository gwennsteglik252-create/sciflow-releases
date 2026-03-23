/**
 * LicenseGate — 授权守卫组件
 *
 * 包裹在 AuthGate 内部（登录之后）：
 * - 加载中    → SplashScreen（复用品牌加载画面）
 * - 已激活    → 放行
 * - 试用中    → 放行 + 顶部提示条
 * - 试用过期  → 全屏激活页面
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getLicenseState, activateLicense, LicenseState } from '../../services/licenseService';

interface LicenseGateProps {
    children: React.ReactNode;
}

const LicenseGate: React.FC<LicenseGateProps> = ({ children }) => {
    const [license, setLicense] = useState<LicenseState | null>(null);
    const [loading, setLoading] = useState(true);

    const checkLicense = useCallback(async () => {
        const state = await getLicenseState();
        setLicense(state);
        setLoading(false);
    }, []);

    useEffect(() => {
        checkLicense();
    }, [checkLicense]);

    if (loading) return null; // AuthGate 已有 splash
    if (!license) return null;

    // 已激活 → 直接放行
    if (license.status === 'activated') {
        return <>{children}</>;
    }

    // 试用中 → 放行 + 顶部提示条
    if (license.status === 'trial') {
        return (
            <>
                <TrialBanner daysRemaining={license.trialDaysRemaining ?? 0} onActivated={checkLicense} />
                {children}
            </>
        );
    }

    // 试用过期 → 全屏激活页面
    return <ActivationPage onActivated={checkLicense} />;
};

/** 试用期顶部提示条 */
const TrialBanner: React.FC<{ daysRemaining: number; onActivated: () => void }> = ({ daysRemaining, onActivated }) => {
    const [showInput, setShowInput] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleActivate = async () => {
        if (!code.trim()) return;
        setLoading(true);
        setError('');
        const result = await activateLicense(code);
        if (result.success) {
            onActivated();
        } else {
            setError(result.error || '激活失败');
        }
        setLoading(false);
    };

    const isUrgent = daysRemaining <= 3;

    // 非紧急状态下，关闭后不再显示（当次会话内）
    if (dismissed && !isUrgent) return null;

    return (
        <div
            className={`fixed top-0 left-0 right-0 h-8 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-wider z-[9998] select-none transition-all ${isUrgent
                ? 'bg-gradient-to-r from-rose-600 to-amber-500 text-white'
                : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900'
                }`}
            style={{ WebkitAppRegion: 'drag' } as any}
        >
            <i className={`fa-solid ${isUrgent ? 'fa-triangle-exclamation animate-pulse' : 'fa-clock'}`} />
            <span>
                试用期剩余 <strong className="text-[12px]">{daysRemaining}</strong> 天
                {isUrgent ? ' — 即将到期！' : ''}
            </span>

            {!showInput ? (
                <button
                    onClick={(e) => { e.stopPropagation(); setShowInput(true); }}
                    className={`px-3 py-0.5 rounded-md text-[9px] font-black transition-all active:scale-95 ${isUrgent
                        ? 'bg-white text-rose-600 hover:bg-rose-100'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <i className="fa-solid fa-key mr-1" />
                    输入激活码
                </button>
            ) : (
                <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <input
                        type="text"
                        value={code}
                        onChange={e => { setCode(e.target.value); setError(''); }}
                        placeholder="SCIFLOW-XXXX-XXXX-XXXX-XXXX"
                        className="w-64 bg-white/90 text-slate-800 text-[10px] font-mono px-2 py-0.5 rounded border border-white/50 outline-none focus:ring-1 focus:ring-indigo-500"
                        onKeyDown={e => e.key === 'Enter' && handleActivate()}
                        autoFocus
                    />
                    <button
                        onClick={handleActivate}
                        disabled={loading || !code.trim()}
                        className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black hover:bg-emerald-700 disabled:opacity-50 transition-all"
                    >
                        {loading ? <i className="fa-solid fa-spinner fa-spin" /> : '激活'}
                    </button>
                    <button
                        onClick={() => { setShowInput(false); setError(''); }}
                        className="px-1 py-0.5 text-white/80 hover:text-white transition-all"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                    {error && <span className="text-white/90 text-[8px] bg-red-500/80 px-2 py-0.5 rounded">{error}</span>}
                </div>
            )}

            {/* 关闭按钮 — 最后3天不可关闭 */}
            {!isUrgent && (
                <button
                    onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-700/60 hover:text-slate-900 hover:bg-black/10 transition-all"
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                    title="关闭提示"
                >
                    <i className="fa-solid fa-xmark text-[9px]" />
                </button>
            )}
        </div>
    );
};

/** 全屏激活页面（试用过期后显示） */
const ActivationPage: React.FC<{ onActivated: () => void }> = ({ onActivated }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleActivate = async () => {
        if (!code.trim()) return;
        setLoading(true);
        setError('');
        const result = await activateLicense(code);
        if (result.success) {
            setSuccess(true);
            setTimeout(onActivated, 1500);
        } else {
            setError(result.error || '激活失败');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 flex items-center justify-center select-none">
            <style>{`
        @keyframes lic-glow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.08); }
        }
        @keyframes lic-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes lic-slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lic-success {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

            {/* 背景光效 */}
            <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[120px]" style={{ animation: 'lic-glow 6s ease-in-out infinite' }} />
            <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] rounded-full bg-rose-500/10 blur-[100px]" style={{ animation: 'lic-glow 8s ease-in-out infinite 2s' }} />

            {success ? (
                /* 激活成功画面 */
                <div className="text-center" style={{ animation: 'lic-success 0.6s ease-out' }}>
                    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(16,185,129,0.4)]">
                        <i className="fa-solid fa-check text-4xl text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-3">激活成功！</h2>
                    <p className="text-slate-400 text-sm">感谢购买 SciFlow Pro，尽情享受完整功能吧 ✨</p>
                </div>
            ) : (
                /* 激活码输入界面 */
                <div className="relative z-10 w-full max-w-md mx-6" style={{ animation: 'lic-slide-up 0.6s ease-out' }}>
                    {/* Logo */}
                    <div className="flex justify-center mb-8" style={{ animation: 'lic-float 6s ease-in-out infinite' }}>
                        <div className="w-20 h-20 rounded-[22px] shadow-[0_20px_40px_-10px_rgba(79,70,229,0.6)] relative overflow-hidden bg-gradient-to-br from-[#4f46e5] via-[#7c3aed] to-[#db2777] flex items-center justify-center ring-2 ring-white/10">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/25 to-transparent pointer-events-none" />
                            <svg viewBox="0 0 100 100" className="w-12 h-12 text-white drop-shadow-lg" style={{ animation: 'spin 20s linear infinite' }}>
                                <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="5" strokeOpacity="0.3" />
                                <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(45 50 50)" />
                                <ellipse cx="50" cy="50" rx="35" ry="12" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(-45 50 50)" />
                                <circle cx="50" cy="50" r="7" fill="currentColor" className="animate-pulse" />
                            </svg>
                        </div>
                    </div>

                    {/* 过期提示 */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black text-white mb-2">试用期已结束</h1>
                        <p className="text-slate-400 text-sm">14 天免费试用体验已到期</p>
                        <p className="text-slate-500 text-xs mt-1">请输入激活码以继续使用完整功能</p>
                    </div>

                    {/* 激活码输入卡片 */}
                    <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
                        <label className="text-xs font-semibold text-slate-400 block mb-3 uppercase tracking-wider">
                            <i className="fa-solid fa-key mr-1.5 text-indigo-400" />
                            激活码
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
                            placeholder="SCIFLOW-XXXX-XXXX-XXXX-XXXX"
                            className="w-full bg-slate-800/60 border border-slate-700/50 text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                            onKeyDown={e => e.key === 'Enter' && handleActivate()}
                            autoFocus
                        />

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/15 border border-red-700/25 rounded-xl px-4 py-3 mt-3">
                                <i className="fa-solid fa-circle-xmark text-sm shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            onClick={handleActivate}
                            disabled={loading || !code.trim()}
                            className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                                    验证中…
                                </span>
                            ) : (
                                <>
                                    <i className="fa-solid fa-unlock mr-1.5" />
                                    激活 SciFlow Pro
                                </>
                            )}
                        </button>
                    </div>

                    {/* 获取授权引导 */}
                    <div className="mt-6 text-center">
                        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl px-5 py-3 backdrop-blur-sm">
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-black text-amber-400">一次性买断授权</span>
                                <span className="text-[10px] text-slate-500">永久授权 · 无订阅 · 含终身更新</span>
                            </div>
                            <button
                                onClick={() => window.open('https://github.com/gwennsteglik252-create/sciflow-releases/issues/new?labels=license&title=申请获取授权码', '_blank')}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-black uppercase rounded-lg transition-all shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer border-none"
                            >
                                获取授权 →
                            </button>
                        </div>
                    </div>

                    {/* 底部信息 */}
                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-slate-600 tracking-wider">© 2026 SciFlow Pro · All Rights Reserved</p>
                        <p className="text-[9px] text-slate-700 mt-1">如有任何问题，请联系技术支持</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LicenseGate;
