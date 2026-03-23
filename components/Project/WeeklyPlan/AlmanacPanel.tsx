import React, { useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import { WeeklyTask } from '../../../types';
import {
    getDailyOmen, getTaskAuspiciousness, hashString,
    DailyOmen, TaskAuspiciousness, LuckLevelKey,
    HEAVENLY_STEMS, EARTHLY_BRANCHES // 补齐导入
} from '../../../utils/almanacUtils';

interface AlmanacPanelProps {
    tasks: WeeklyTask[];
    planStartDate?: string;
    onClose: () => void;
    /** 'left' | 'right' | 'inline'(嵌入父容器，不渲染 overlay) */
    slideFrom?: 'left' | 'right' | 'inline';
}

// ─── 星级渲染 ─────────────────────────────────────────────
const StarRating: React.FC<{ stars: number; color: string }> = ({ stars, color }) => (
    <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
            <i key={s} className={`fa-solid fa-star text-[8px] ${s <= stars ? color : 'text-slate-200'}`} />
        ))}
    </span>
);

// ─── 宜忌标签 ─────────────────────────────────────────────
const AuspiciousBadge: React.FC<{ labelKey: string }> = ({ labelKey }) => {
    const { t } = useTranslation();
    const styleMap: Record<string, string> = {
        'luckLevels.greatLuck': 'bg-red-600 text-white shadow-sm shadow-red-200',
        'auspicious': 'bg-amber-500 text-white shadow-sm shadow-amber-100',
        'moderate': 'bg-slate-200 text-slate-600',
        'careful': 'bg-indigo-100 text-indigo-700',
        'inauspicious': 'bg-slate-700 text-white',
    };
    
    const fullKey = labelKey.includes('.') ? `almanac.${labelKey}` : `almanac.${labelKey}`;
    
    return (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${styleMap[labelKey] || 'bg-slate-200 text-slate-600'}`}>
            {t(fullKey)}
        </span>
    );
};

// ─── 吉凶总评徽章 ─────────────────────────────────────────
const LuckBadge: React.FC<{ luckKey: LuckLevelKey }> = ({ luckKey }) => {
    const { t } = useTranslation();
    const styles: Record<LuckLevelKey, string> = {
        'greatLuck': 'border-red-500 text-red-600 bg-red-50',
        'goodLuck': 'border-amber-400 text-amber-600 bg-amber-50',
        'neutral': 'border-slate-300 text-slate-500 bg-slate-50',
        'badLuck': 'border-indigo-400 text-indigo-700 bg-indigo-50',
        'greatBadLuck': 'border-slate-700 text-slate-900 bg-slate-100',
    };
    const icons: Record<LuckLevelKey, string> = {
        'greatLuck': 'fa-sun', 
        'goodLuck': 'fa-cloud-sun', 
        'neutral': 'fa-cloud',
        'badLuck': 'fa-cloud-rain', 
        'greatBadLuck': 'fa-cloud-bolt',
    };
    return (
        <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-4 ${styles[luckKey]} shrink-0`}>
            <i className={`fa-solid ${icons[luckKey]} text-xl`} />
            <span className="text-[11px] font-black mt-0.5">{t(`almanac.luckLevels.${luckKey}`)}</span>
        </div>
    );
};

function formatDateStr(d: Date, t: any): string {
    return t('common.datePattern', {
        defaultValue: `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`,
        year: d.getFullYear(),
        month: String(d.getMonth() + 1).padStart(2, '0'),
        day: String(d.getDate()).padStart(2, '0')
    });
}
function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── 主组件 ───────────────────────────────────────────────
const AlmanacPanel: React.FC<AlmanacPanelProps> = ({ tasks, planStartDate, onClose, slideFrom = 'right' }) => {
    const { t, lang } = useTranslation();
    
    // 使用本地 useTranslation 返回的 lang 替代 react-i18next 的 i18n.language
    const isZh = lang === 'zh';
    
    // 直接从翻译文件获取数组类型的翻译值（本地 t() 不支持 returnObjects）
    const zhDays = ['一', '二', '三', '四', '五', '六', '日'];
    const enDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const daysArr = isZh ? zhDays : enDays;
    const zhMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
    const enMonths = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    const monthsArr = isZh ? zhMonths : enMonths;

    const realToday = useMemo(() => new Date(), []);
    const [selectedDate, setSelectedDate] = useState<Date>(realToday);

    const omen = useMemo(() => getDailyOmen(selectedDate), [selectedDate]);
    const isToday = isSameDay(selectedDate, realToday);
    const dayIdx = (selectedDate.getDay() + 6) % 7;

    const goDay = useCallback((delta: number) => {
        setSelectedDate(prev => { const n = new Date(prev); n.setDate(n.getDate() + delta); return n; });
    }, []);
    const goToday = useCallback(() => setSelectedDate(new Date()), []);

    // ─── 敲木鱼祈福 ──────────────────────────────────
    const [merit, setMerit] = useState(0);
    const [floatingTexts, setFloatingTexts] = useState<{ id: number; x: number; y: number }[]>([]);
    const [isKnocking, setIsKnocking] = useState(false);
    const [showPrayer, setShowPrayer] = useState(false);
    const meritIdRef = useRef(0);
    const isBadLuck = omen.luckKey === 'greatBadLuck' || omen.luckKey === 'badLuck';

    const knockWoodfish = useCallback(() => {
        setMerit(prev => prev + 1);
        setIsKnocking(true);
        setTimeout(() => setIsKnocking(false), 150);
        // 飘字
        const id = ++meritIdRef.current;
        const x = 30 + Math.random() * 40; // 30%~70% left
        const y = Math.random() * 20;       // 0~20 offset
        setFloatingTexts(prev => [...prev, { id, x, y }]);
        setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1200);
    }, []);

    // 本周 7 日
    const weekDates = useMemo(() => {
        const d = new Date(selectedDate);
        const dow = (d.getDay() + 6) % 7;
        const mon = new Date(d); mon.setDate(d.getDate() - dow);
        return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd; });
    }, [selectedDate]);

    // 任务评分
    const weekTasks = useMemo(() =>
        tasks.filter(t => t.status !== 'completed')
            .map(t => ({ task: t, auspiciousness: getTaskAuspiciousness(t.title, omen, hashString(t.id + t.title)) }))
            .sort((a, b) => b.auspiciousness.stars - a.auspiciousness.stars), [tasks, omen]);
    const completedTasks = useMemo(() =>
        tasks.filter(t => t.status === 'completed').map(t => ({
            task: t, auspiciousness: getTaskAuspiciousness(t.title, omen, hashString(t.id + t.title)),
        })), [tasks, omen]);

    const luckGradients: Record<LuckLevelKey, string> = {
        'greatLuck': 'from-red-900 via-red-800 to-amber-900',
        'goodLuck': 'from-amber-800 via-amber-700 to-yellow-800',
        'neutral': 'from-slate-800 via-slate-700 to-slate-800',
        'badLuck': 'from-indigo-900 via-indigo-800 to-slate-900',
        'greatBadLuck': 'from-slate-900 via-slate-800 to-slate-900',
    };
    const headerGrad = luckGradients[omen.luckKey];
    const hasTop = weekTasks.length > 0 && weekTasks[0].auspiciousness.stars >= 4;
    const todayDayIdx = (realToday.getDay() + 6) % 7;
    const isInline = slideFrom === 'inline';

    // ── 头部渲染 ──
    const headerEl = (
        <div className={`relative bg-gradient-to-br ${headerGrad} text-white shrink-0 overflow-hidden`}>
            <div className="absolute inset-0 opacity-5 pointer-events-none select-none"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '20px 20px' }} />
            <div className="absolute top-3 right-14 text-6xl opacity-5 pointer-events-none font-black select-none">☯</div>
            <button onClick={onClose}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white flex items-center justify-center transition-all z-10">
                <i className="fa-solid fa-times text-xs" />
            </button>

            <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                        <i className="fa-solid fa-yin-yang text-[8px] text-amber-300" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/60">{t('almanac.title')}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-white/50 font-bold mb-0.5 font-mono tracking-widest uppercase">
                            {HEAVENLY_STEMS[omen.yearGanZhi.stemIdx]}{EARTHLY_BRANCHES[omen.yearGanZhi.branchIdx]}{t('almanac.lunar.year')} · {monthsArr[omen.lunarDate.monthIdx] || ''}{omen.lunarDate.day}
                        </p>
                        <div className="flex items-baseline gap-2 mb-1.5">
                            <h2 className="text-3xl font-black tracking-tighter leading-none text-white">{omen.ganZhi.fullName}{t('almanac.lunar.day')}</h2>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-amber-400/80 uppercase tracking-widest leading-none">{isZh ? omen.ganZhi.stem : t(`almanac.elements.${omen.ganZhi.element}`)}</span>
                                <span className="text-[9px] font-bold text-white/40 leading-none">{t('almanac.lunar.fiveElements')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => goDay(-1)} className="w-5 h-5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition-all active:scale-90"><i className="fa-solid fa-chevron-left text-[7px]" /></button>
                            <p className="text-[8px] text-white/60 font-bold uppercase tracking-widest">{formatDateStr(selectedDate, t)} · {isZh ? `周${daysArr[dayIdx] || ''}` : (daysArr[dayIdx] || '')}</p>
                            <button onClick={() => goDay(1)} className="w-5 h-5 rounded bg-white/10 text-white/70 hover:bg-white/20 hover:text-white flex items-center justify-center transition-all active:scale-90"><i className="fa-solid fa-chevron-right text-[7px]" /></button>
                            {!isToday && <button onClick={goToday} className="px-1.5 py-0.5 bg-amber-500/80 text-white rounded text-[7px] font-black uppercase hover:bg-amber-400 transition-all active:scale-95 ml-0.5">{t('almanac.actions.backToToday')}</button>}
                        </div>
                    </div>
                    <LuckBadge luckKey={omen.luckKey} />
                </div>

                {/* 本周 7 日速览 */}
                <div className="mt-2 flex items-center gap-0.5 bg-white/10 rounded-xl p-1 border border-white/10">
                    {weekDates.map((d, i) => {
                        const sel = isSameDay(d, selectedDate);
                        const rt = isSameDay(d, realToday);
                        const dOmen = getDailyOmen(d);
                        const lc: Record<LuckLevelKey, string> = { 'greatLuck': 'bg-red-500', 'goodLuck': 'bg-amber-500', 'neutral': 'bg-slate-400', 'badLuck': 'bg-indigo-500', 'greatBadLuck': 'bg-slate-700' };
                        return (
                            <button key={i} onClick={() => setSelectedDate(new Date(d))}
                                className={`flex-1 flex flex-col items-center py-0.5 rounded-lg transition-all cursor-pointer ${sel ? 'bg-white/20 shadow-sm' : 'hover:bg-white/10'}`}>
                                <span className={`text-[6px] font-black uppercase leading-none ${sel ? 'text-white' : 'text-white/40'}`}>{daysArr[i]}</span>
                                <span className={`text-[10px] font-black leading-none mt-0.5 ${sel ? 'text-white' : 'text-white/60'}`}>{d.getDate()}</span>
                                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${lc[dOmen.luckKey]}`} />
                                {rt && <div className="w-1 h-1 rounded-full bg-amber-400 mt-0.5 animate-pulse" />}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-2 px-3 py-2 bg-white/10 rounded-xl border border-white/10">
                    <p className="text-[10px] text-white/80 font-bold italic leading-relaxed text-center">「{t(`almanac.quotes.${omen.quoteIdx}`)}」</p>
                </div>
            </div>
        </div>
    );

    const dateLabel = isToday ? t('almanac.actions.today') : `${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`;

    // ── 内容区渲染 ──
    const meritMessages = [
        { min: 0, text: t('almanac.meritMsg.m0'), emoji: '😰' },
        { min: 10, text: t('almanac.meritMsg.m1'), emoji: '🙏' },
        { min: 30, text: t('almanac.meritMsg.m3'), emoji: '✨' },
        { min: 66, text: t('almanac.meritMsg.m6'), emoji: '🔮' },
        { min: 99, text: t('almanac.meritMsg.m9'), emoji: '🎊' },
        { min: 108, text: t('almanac.meritMsg.m10'), emoji: '☯️' },
    ];
    const currentMeritMsg = [...meritMessages].reverse().find(m => merit >= m.min) || meritMessages[0];

    const contentEl = (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ── 祈福区（仅凶/大凶日显示，默认折叠） ── */}
            {isBadLuck && (
                <div className="px-4 pt-3 pb-0">
                    {/* 折叠横幅触发按钮 */}
                    <button
                        onClick={() => setShowPrayer(p => !p)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-slate-800 to-indigo-900 border border-indigo-700/40 hover:border-amber-500/50 transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[8px] font-black text-amber-400/80 uppercase tracking-widest">{t('almanac.prayerMode')}</span>
                            {merit > 0 && (
                                <span className="text-[7px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                                    {t('almanac.merit')} {merit}
                                </span>
                            )}
                        </div>
                        <i className={`fa-solid fa-chevron-${showPrayer ? 'up' : 'down'} text-[8px] text-amber-400/60 group-hover:text-amber-400 transition-all`} />
                    </button>

                    {/* 展开内容 */}
                    {showPrayer && (
                        <div className="mt-2 mb-3 relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-4 overflow-hidden">
                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(251,191,36,0.3) 0%, transparent 50%)' }} />

                            {/* 木鱼区 */}
                            <div className="flex flex-col items-center relative" style={{ minHeight: 110 }}>
                                {/* 飘字 */}
                                {floatingTexts.map(ft => (
                                    <div key={ft.id} className="absolute text-amber-400 font-black text-sm pointer-events-none select-none z-20"
                                        style={{ left: `${ft.x}%`, top: `${ft.y}px`, animation: 'floatUp 1.2s ease-out forwards' }}>
                                        {t('almanac.merit')}+1
                                    </div>
                                ))}

                                {/* 木鱼 SVG 按钮 */}
                                <button
                                    onClick={knockWoodfish}
                                    className={`relative w-20 h-20 flex items-center justify-center transition-transform select-none ${isKnocking ? 'scale-90' : 'scale-100 hover:scale-105'}`}
                                    style={{ filter: isKnocking ? 'brightness(1.4) drop-shadow(0 0 8px rgba(251,191,36,0.8))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}
                                >
                                    {/* 光晕 */}
                                    <div className={`absolute inset-[-10px] rounded-full transition-all ${merit >= 99 ? 'bg-amber-400/30 blur-xl animate-pulse' : merit >= 30 ? 'bg-amber-400/15 blur-lg' : 'bg-amber-400/0'}`} />
                                    {/* 木鱼 SVG */}
                                    <svg viewBox="0 0 80 80" className="w-16 h-16 z-10" xmlns="http://www.w3.org/2000/svg">
                                        {/* 鱼身主体 - 圆润椭圆 */}
                                        <ellipse cx="36" cy="44" rx="26" ry="20" fill="#92400e" />
                                        <ellipse cx="36" cy="42" rx="26" ry="20" fill="#b45309" />
                                        {/* 鱼身高光 */}
                                        <ellipse cx="30" cy="36" rx="14" ry="8" fill="#d97706" opacity="0.5" />
                                        {/* 鱼嘴开口（中间的孔） */}
                                        <ellipse cx="36" cy="44" rx="7" ry="5" fill="#1c1917" />
                                        <ellipse cx="36" cy="43" rx="5.5" ry="3.5" fill="#292524" />
                                        {/* 眼睛 */}
                                        <circle cx="52" cy="38" r="3.5" fill="#1c1917" />
                                        <circle cx="52" cy="38" r="2" fill="#292524" />
                                        <circle cx="53" cy="37" r="0.8" fill="#fbbf24" opacity="0.8" />
                                        {/* 鱼尾 */}
                                        <path d="M10 42 Q2 32 6 26 Q10 38 10 42Z" fill="#92400e" />
                                        <path d="M10 42 Q2 52 6 58 Q10 46 10 42Z" fill="#92400e" />
                                        <path d="M10 42 Q4 42 6 36 Q9 40 10 42Z" fill="#b45309" opacity="0.7" />
                                        {/* 敲击棒 */}
                                        <line x1="58" y1="12" x2="44" y2="30" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" />
                                        <circle cx="58" cy="12" r="4" fill="#a855f7" />
                                        <circle cx="58" cy="12" r="2.5" fill="#c4b5fd" />
                                        {/* 敲击时的星光 */}
                                        {isKnocking && (
                                            <g fill="#fbbf24" opacity="0.9">
                                                <polygon points="44,26 45.5,29 49,29 46.5,31 47.5,34.5 44,32.5 40.5,34.5 41.5,31 39,29 42.5,29" />
                                            </g>
                                        )}
                                    </svg>
                                    {/* 敲击波纹 */}
                                    {isKnocking && <div className="absolute inset-0 rounded-full border-2 border-amber-400/50 animate-ping" />}
                                </button>

                                {/* 功德计数 */}
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-white/40">{t('almanac.accumulatedMerit')}</span>
                                    <span className={`text-lg font-black tabular-nums ${merit >= 99 ? 'text-amber-400 animate-pulse' : merit >= 30 ? 'text-amber-500' : 'text-white/70'}`}>{merit}</span>
                                </div>
                                <p className="mt-0.5 text-[9px] font-bold text-center text-white/50">{currentMeritMsg.emoji} {currentMeritMsg.text}</p>
                                <div className="mt-2 w-full max-w-[180px] h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (merit / 108) * 100)}%` }} />
                                </div>
                                <p className="mt-0.5 text-[6px] text-white/25 font-bold">{t('almanac.meritComplete')} 108</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="p-4 border-b border-slate-100">
                <div className="flex gap-2.5">
                    <div className="flex-1 bg-red-50 rounded-2xl border border-red-100 p-2.5">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center"><i className="fa-solid fa-check text-white text-[6px]" /></div>
                            <span className="text-[7px] font-black text-red-700 uppercase tracking-widest">{dateLabel}{t('almanac.actions.auspicious')}</span>
                        </div>
                        <div className="space-y-1.5">
                            {omen.auspicious.map(cat => (
                                <div key={cat.key} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-red-100 shadow-sm">
                                    <div className={`w-5 h-5 rounded ${cat.bgColor} flex items-center justify-center shrink-0`}><i className={`fa-solid ${cat.icon} ${cat.color} text-[8px]`} /></div>
                                    <span className="text-[9px] font-bold text-slate-700 leading-tight">{t(cat.labelKey)}</span>
                                </div>
                            ))}
                            {omen.moderates.slice(0, 1).map(cat => (
                                <div key={cat.key} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-red-100 shadow-sm">
                                    <div className={`w-5 h-5 rounded ${cat.bgColor} flex items-center justify-center shrink-0 opacity-70`}><i className={`fa-solid ${cat.icon} ${cat.color} text-[8px]`} /></div>
                                    <span className="text-[9px] font-bold text-slate-500 leading-tight">{t(cat.labelKey)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 p-2.5">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-3.5 h-3.5 rounded-full bg-slate-700 flex items-center justify-center"><i className="fa-solid fa-xmark text-white text-[6px]" /></div>
                            <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest">{dateLabel}{t('almanac.actions.inauspicious')}</span>
                        </div>
                        <div className="space-y-1.5">
                            {omen.inauspicious.map(cat => (
                                <div key={cat.key} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center shrink-0 grayscale"><i className={`fa-solid ${cat.icon} text-slate-400 text-[8px]`} /></div>
                                    <span className="text-[9px] font-bold text-slate-500 leading-tight line-through decoration-slate-300">{t(cat.labelKey)}</span>
                                </div>
                            ))}
                            {omen.inauspicious.length === 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-100">
                                    <span className="text-[8px] text-slate-400 font-bold italic">{t('almanac.actions.noInauspicious')}</span>
                                </div>
                            )}
                            {omen.moderates.slice(1, 2).map(cat => (
                                <div key={cat.key} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                                    <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center shrink-0 opacity-70"><i className={`fa-solid ${cat.icon} text-slate-400 text-[8px]`} /></div>
                                    <span className="text-[9px] font-bold text-slate-500 leading-tight">{t('almanac.actions.moderate')}: {t(cat.labelKey)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-2 mx-0.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-info text-slate-300 text-[9px] shrink-0" />
                    <p className="text-[7px] text-slate-400 font-bold leading-relaxed">
                        {t('almanac.lunar.logic', {
                            stem: omen.ganZhi.stem,
                            stemE: t(`almanac.elements.${omen.ganZhi.element}`),
                            branch: omen.ganZhi.branch,
                            branchE: t(`almanac.elements.${omen.ganZhi.branchElement}`)
                        })}
                    </p>
                </div>
            </div>

            {/* 任务黄历扫描 */}
            <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-lg bg-amber-500 flex items-center justify-center"><i className="fa-solid fa-list-check text-white text-[9px]" /></div>
                    <div>
                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">{t('almanac.tasks.scan')}</h4>
                        <p className="text-[6px] text-slate-400 font-bold mt-0.5">Task Fortune Scan</p>
                    </div>
                    <span className="ml-auto text-[7px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-black border border-slate-200">{t('almanac.tasks.pending', { count: weekTasks.length })}</span>
                </div>

                {hasTop && (
                    <div className="mb-2.5 p-3 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border-2 border-red-200 shadow-sm">
                        <div className="flex items-center gap-1.5 mb-1.5"><i className="fa-solid fa-fire text-red-600 text-[9px]" /><span className="text-[7px] font-black text-red-600 uppercase tracking-widest">{t('almanac.actions.recommendation')}</span></div>
                        <p className="text-[11px] font-black text-slate-800 leading-tight mb-1">{weekTasks[0].task.title}</p>
                        <div className="flex items-center gap-2">
                            <StarRating stars={weekTasks[0].auspiciousness.stars} color="text-amber-500" />
                            <span className="text-[7px] text-slate-500 font-bold">{t(`almanac.${weekTasks[0].auspiciousness.reasonKey}`)}</span>
                        </div>
                    </div>
                )}

                {tasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 opacity-30">
                        <i className="fa-solid fa-scroll text-3xl text-slate-300 mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('almanac.tasks.empty')}</p>
                        <p className="text-[8px] text-slate-400 mt-1">{t('almanac.tasks.emptyHint')}</p>
                    </div>
                )}

                <div className="space-y-1.5">
                    {weekTasks.map(({ task, auspiciousness }, idx) => (
                        <div key={task.id} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${idx === 0 && hasTop ? 'hidden' : `${auspiciousness.bgColor} hover:shadow-sm`}`}>
                            <span className="text-[8px] font-black text-slate-300 w-3 shrink-0 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-slate-700 leading-tight truncate">{task.title}</p>
                                {task.assignedDay !== undefined && (
                                    <p className="text-[7px] text-slate-400 font-bold mt-0.5">
                                        {t('almanac.tasks.scheduled', { day: (daysArr[task.assignedDay] || '') })}
                                        {task.assignedDay === todayDayIdx && <span className="ml-1 text-indigo-600 font-black">· {t('almanac.actions.today')}</span>}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                <AuspiciousBadge labelKey={auspiciousness.labelKey} />
                                <StarRating stars={auspiciousness.stars} color={auspiciousness.labelKey === 'luckLevels.greatLuck' || auspiciousness.labelKey === 'auspicious' ? 'text-amber-400' : 'text-slate-300'} />
                            </div>
                        </div>
                    ))}

                    {completedTasks.length > 0 && (
                        <>
                            <div className="flex items-center gap-2 pt-1.5 pb-0.5">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest shrink-0">{t('almanac.tasks.completed')}</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                            {completedTasks.map(({ task }) => (
                                <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-xl border border-slate-100 opacity-40">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-[9px] shrink-0" />
                                    <p className="text-[9px] font-bold text-slate-500 line-through truncate flex-1">{task.title}</p>
                                    <span className="text-[7px] text-slate-300 font-black shrink-0">{t('almanac.tasks.done')}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="mt-5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[6px] text-slate-300 font-bold text-center leading-relaxed">
                        {t('almanac.disclaimer')}
                    </p>
                </div>
            </div>
        </div>
    );

    const animCSS = `
        @keyframes slideInRight { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes slideInLeft  { from { transform: translateX(-100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes floatUp { 0% { opacity:1; transform: translateY(0); } 100% { opacity:0; transform: translateY(-60px) scale(1.2); } }
    `;

    // ── inline 模式：紧贴父容器 ──
    if (isInline) {
        return (
            <div className="h-full w-full bg-white flex flex-col overflow-hidden">
                {headerEl}
                {contentEl}
                <style>{animCSS}</style>
            </div>
        );
    }

    // ── overlay 模式 ──
    const slideAnim = slideFrom === 'left' ? 'slideInLeft' : 'slideInRight';
    const justifyClass = slideFrom === 'left' ? 'justify-start' : 'justify-end';

    return (
        <div className={`fixed inset-0 z-[9000] flex items-start ${justifyClass}`} onClick={onClose}>
            <div className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
                style={{ animation: `${slideAnim} 0.3s cubic-bezier(0.16,1,0.3,1)` }}>
                {headerEl}
                {contentEl}
            </div>
            <style>{animCSS}</style>
        </div>
    );
};

export default AlmanacPanel;
