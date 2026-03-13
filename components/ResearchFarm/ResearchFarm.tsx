
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    PlotStatus, TimeOfDay, WeatherType, Seed, Plot, ShopItem, InventoryItem,
    DailyCheckin, FarmExpansion, LabUpgrades, Challenge, JournalEntry, FarmState,
    GameEvent, ResearchGoal, Achievement, ActionType, HarvestParticle, RandomEventDef,
    RANDOM_EVENTS, ACHIEVEMENT_DEFS, INITIAL_ACHIEVEMENTS,
    getTimeOfDay, TIME_OF_DAY_CONFIG, SEEDS, SHOP_ITEMS,
    STORAGE_KEY, DEFAULT_COLS, DEFAULT_ROWS, TICK_MS, makePlot, XP_PER_LEVEL,
    EXPANSION_TIERS, CHECKIN_REWARDS, PRESTIGE_BONUS, PRESTIGE_MIN_LEVEL,
    MUTATION_CHANCE, LAB_UPGRADES_SHOP, CHALLENGE_TEMPLATES, INITIAL_GOALS,
    GACHA_COST, GACHA_POOL, FARM_THEMES, initState,
} from './researchFarmTypes';

// ─── Sub-Components ──────────────────────────────────────────────────────
const EventToast: React.FC<{ event: GameEvent | null; onDismiss: () => void }> = ({ event, onDismiss }) => {
    useEffect(() => { if (event) { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); } }, [event, onDismiss]);
    if (!event) return null;
    const bg = { success: 'from-emerald-500/90 to-green-600/90', warning: 'from-amber-500/90 to-yellow-600/90', info: 'from-sky-500/90 to-blue-600/90', danger: 'from-red-500/90 to-rose-600/90' }[event.type];
    return (<div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-toast-slide"><div className={`bg-gradient-to-r ${bg} text-white px-8 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border border-white/30`}><span className="text-lg font-bold">{event.message}</span></div></div>);
};

const AchievementPopup: React.FC<{ achievement: Achievement | null; onDismiss: () => void }> = ({ achievement, onDismiss }) => {
    useEffect(() => { if (achievement) { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); } }, [achievement, onDismiss]);
    if (!achievement) return null;
    return (<div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[300] animate-achievement-pop">
        <div className="bg-gradient-to-r from-yellow-400/95 to-amber-500/95 text-white px-8 py-5 rounded-[2rem] shadow-2xl border-2 border-yellow-300/50 flex items-center gap-4">
            <span className="text-4xl">{achievement.emoji}</span>
            <div><p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">成就解锁</p><p className="text-lg font-black">{achievement.name}</p></div>
        </div></div>);
};

const AmbientLayer: React.FC<{ timeOfDay: TimeOfDay }> = ({ timeOfDay }) => {
    const pts = useMemo(() => Array.from({ length: timeOfDay === 'night' ? 15 : timeOfDay === 'day' ? 5 : 10 }, (_, i) => ({
        id: i, left: Math.random() * 100, top: 10 + Math.random() * 80, size: 2 + Math.random() * (timeOfDay === 'day' ? 6 : 3), delay: Math.random() * 5, dur: 3 + Math.random() * 5,
    })), [timeOfDay]);
    const clr = { night: 'rgba(180,255,100,0.8)', sunset: 'rgba(255,180,60,0.7)', day: 'rgba(255,255,255,0.4)', dawn: 'rgba(255,220,180,0.6)' }[timeOfDay];
    return (<div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">{pts.map(p => (
        <div key={p.id} className="absolute rounded-full animate-float-particle" style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size, backgroundColor: clr, boxShadow: `0 0 ${p.size * 2}px ${clr}`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
    ))}</div>);
};

// ─── Weather Visual Layer ────────────────────────────────────────────────
const WeatherLayer: React.FC<{ weather: WeatherType }> = ({ weather }) => {
    const drops = useMemo(() => {
        if (weather === 'rain') return Array.from({ length: 60 }, (_, i) => ({ id: i, left: Math.random() * 100, delay: Math.random() * 2, dur: 0.4 + Math.random() * 0.4, size: 1 + Math.random() * 2 }));
        if (weather === 'snow') return Array.from({ length: 40 }, (_, i) => ({ id: i, left: Math.random() * 100, delay: Math.random() * 4, dur: 3 + Math.random() * 4, size: 3 + Math.random() * 5 }));
        return [];
    }, [weather]);
    if (!weather || weather === 'clear') return null;
    return (<div className="absolute inset-0 z-[6] pointer-events-none overflow-hidden">
        {weather === 'thunder' && <div className="absolute inset-0 animate-thunder-flash bg-white/30" />}
        {drops.map(d => (
            <div key={d.id} className={weather === 'rain' ? 'absolute animate-rain-drop' : 'absolute animate-snow-fall rounded-full'}
                style={{
                    left: `${d.left}%`, top: -10, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s`,
                    ...(weather === 'rain' ? { width: d.size, height: 15 + d.size * 5, background: 'linear-gradient(transparent, rgba(120,180,255,0.6))' }
                        : { width: d.size, height: d.size, backgroundColor: 'rgba(255,255,255,0.8)', boxShadow: '0 0 4px rgba(255,255,255,0.5)' })
                }} />
        ))}
    </div>);
};

// ─── Research Pet ──────────────────────────────────────────────────────
const ResearchPet: React.FC<{ active: boolean; cols: number }> = ({ active, cols }) => {
    const [pos, setPos] = useState({ x: 50, y: 60 });
    const [flip, setFlip] = useState(false);
    useEffect(() => {
        if (!active) return;
        const move = () => {
            const nx = 15 + Math.random() * (cols > 4 ? 70 : 55);
            setFlip(nx < pos.x);
            setPos({ x: nx, y: 50 + Math.random() * 30 });
        };
        const t = setInterval(move, 4000);
        return () => clearInterval(t);
    }, [active, cols, pos.x]);
    if (!active) return null;
    return (
        <div className="absolute z-[25] pointer-events-none transition-all duration-[3000ms] ease-in-out"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
            <div className={`text-3xl select-none animate-pet-bob ${flip ? 'scale-x-[-1]' : ''}`}
                style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
                🐱
            </div>
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-black text-white bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm whitespace-nowrap">
                科研助手
            </div>
        </div>
    );
};

const PlotTile: React.FC<{ plot: Plot; onClick: () => void; action: ActionType }> = ({ plot, onClick, action }) => {
    const seed = plot.seed;
    const pct = seed && plot.status !== 'empty' && plot.status !== 'withered' ? Math.min(100, Math.round((plot.growthTick / seed.growthTime) * 100)) : plot.status === 'ready' ? 100 : 0;
    const isActionable = (action === 'water' && (plot.status === 'planted' || plot.status === 'growing'))
        || (action === 'fertilize' && (plot.status === 'planted' || plot.status === 'growing'))
        || (action === 'weed' && plot.status === 'withered')
        || (action === 'harvest' && plot.status === 'ready')
        || (!action && (plot.status === 'empty' || plot.status === 'ready'));

    return (
        <div className="relative w-full aspect-[1/0.7]">
            <button onClick={(e) => { e.stopPropagation(); onClick(); }}
                className={`absolute inset-0 z-20 cursor-pointer group outline-none border-none bg-transparent transition-all duration-300 ${isActionable ? 'hover:scale-110' : 'opacity-80'}`}>
                {/* Soil base - transparent, only glow effects */}
                <div className={`absolute inset-0 rounded-xl transition-all duration-500
                    ${plot.status === 'ready' ? 'shadow-[0_0_30px_rgba(251,191,36,0.5),0_0_60px_rgba(251,191,36,0.2)] border-2 border-yellow-400/80 animate-glow-pulse bg-yellow-400/5' : ''}
                    ${plot.status === 'withered' ? 'shadow-[0_0_20px_rgba(239,68,68,0.25)] border border-red-400/30 bg-red-900/10' : ''}
                    ${isActionable && action ? 'ring-2 ring-white/40 bg-white/5' : ''}
                    group-hover:bg-white/10 group-active:scale-95`} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {plot.status === 'empty' ? (
                        <span className="text-4xl text-white/30 drop-shadow-xl font-black opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">＋</span>
                    ) : (
                        <div className="relative flex flex-col items-center">
                            {/* Glow ring for growing */}
                            {(plot.status === 'growing' || plot.status === 'planted') && (
                                <div className="absolute -inset-3 rounded-full bg-emerald-400/8 animate-breathe" />
                            )}
                            {/* Star ring for ready */}
                            {plot.status === 'ready' && (
                                <div className="absolute -inset-5 animate-spin-slow">
                                    {[0, 60, 120, 180, 240, 300].map(deg => (
                                        <div key={deg} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${deg}deg)` }}>
                                            <span className="text-[8px] opacity-70">✨</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <span className={`transition-all duration-700 select-none text-5xl ${plot.status === 'ready' ? 'animate-bounce' : ''} ${plot.status === 'withered' ? 'grayscale opacity-40 animate-wither' : ''}`}
                                style={{ transform: `scale(${0.9 + (pct / 100) * 0.2}) translateY(-10px)`, filter: plot.status === 'ready' ? 'drop-shadow(0 0 20px rgba(255,255,255,0.9)) drop-shadow(0 0 40px rgba(251,191,36,0.5))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
                                {plot.status === 'withered' ? '🥀' : (plot.status === 'ready' ? (seed?.stages[3] || '✨') : (!seed ? '🌱' : (pct < 33 ? seed.stages[0] : pct < 66 ? seed.stages[1] : seed.stages[2])))}
                            </span>
                            {seed && plot.status !== 'ready' && plot.status !== 'withered' && (
                                <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/15 shadow-lg">
                                    <div className="flex items-center gap-0.5">
                                        <span className="text-[5px]">💧</span>
                                        <div className={`w-6 h-1.5 rounded-full overflow-hidden ${plot.waterLevel < 30 ? 'bg-red-900/50' : 'bg-white/15'}`}>
                                            <div className={`h-full rounded-full transition-all duration-500 ${plot.waterLevel < 30 ? 'bg-red-400 animate-pulse' : 'bg-gradient-to-r from-sky-400 to-blue-500'}`} style={{ width: `${plot.waterLevel}%` }} />
                                        </div>
                                    </div>
                                    <div className="w-[1px] h-2 bg-white/20" />
                                    <div className="flex items-center gap-0.5">
                                        <span className="text-[5px]">🧪</span>
                                        <div className={`w-6 h-1.5 rounded-full overflow-hidden ${plot.fertLevel < 30 ? 'bg-red-900/50' : 'bg-white/15'}`}>
                                            <div className={`h-full rounded-full transition-all duration-500 ${plot.fertLevel < 30 ? 'bg-red-400 animate-pulse' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} style={{ width: `${plot.fertLevel}%` }} />
                                        </div>
                                    </div>
                                    <span className="text-[7px] font-black text-white/80 ml-0.5 tabular-nums">{pct}%</span>
                                </div>
                            )}
                            {seed && (plot.waterLevel < 20 || plot.fertLevel < 20) && plot.status !== 'ready' && plot.status !== 'withered' && (
                                <span className="absolute -top-2 -right-3 text-sm animate-pulse drop-shadow-lg">⚠️</span>
                            )}
                        </div>
                    )}
                </div>
            </button>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────
const ResearchFarm: React.FC = () => {
    const [state, setState] = useState<FarmState>(initState);
    const [action, setAction] = useState<ActionType>(null);
    const [showSeedModal, setShowSeedModal] = useState<number | null>(null);
    const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(getTimeOfDay);
    const [particles, setParticles] = useState<HarvestParticle[]>([]);
    const [activeToast, setActiveToast] = useState<GameEvent | null>(null);
    const [achievementPopup, setAchievementPopup] = useState<Achievement | null>(null);
    const [showAchievements, setShowAchievements] = useState(false);
    const [showShop, setShowShop] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    const [weather, setWeather] = useState<WeatherType>(null);
    const [speedBoostActive, setSpeedBoostActive] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [showCheckinBanner, setShowCheckinBanner] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);
    const [offlineReport, setOfflineReport] = useState<{ ticks: number; matured: number; minutes: number } | null>(null);
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [showGacha, setShowGacha] = useState(false);
    const [gachaResult, setGachaResult] = useState<typeof GACHA_POOL[0] | null>(null);
    const [showJournal, setShowJournal] = useState(false);
    const [showCodex, setShowCodex] = useState(false);
    const [showThemes, setShowThemes] = useState(false);

    const COLS = state.expansion.cols;
    const ROWS = state.expansion.rows;
    const TOTAL = COLS * ROWS;

    useEffect(() => { const t = setInterval(() => setTimeOfDay(getTimeOfDay()), 60_000); return () => clearInterval(t); }, []);
    const todConfig = TIME_OF_DAY_CONFIG[timeOfDay];
    useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

    // ── Offline Progress ──
    useEffect(() => {
        const elapsed = Date.now() - state.lastSeen;
        const elapsedMinutes = Math.floor(elapsed / 60_000);
        if (elapsedMinutes >= 2) {
            const offlineTicks = Math.min(Math.floor(elapsed / TICK_MS), 200);
            setState(prev => {
                let matured = 0;
                const prestigeMult = 1 + prev.prestige * PRESTIGE_BONUS;
                const nextPlots = prev.plots.map(p => {
                    if (!p.seed || (p.status !== 'planted' && p.status !== 'growing')) return p;
                    let nt = p.growthTick + offlineTicks * 0.5 * prestigeMult;
                    let ns: PlotStatus = p.status;
                    if (nt >= p.seed.growthTime) { ns = 'ready'; matured++; }
                    else if (nt > 1) ns = 'growing';
                    return { ...p, growthTick: nt, status: ns, waterLevel: Math.max(0, p.waterLevel - offlineTicks * 0.3), fertLevel: Math.max(0, p.fertLevel - offlineTicks * 0.2) };
                });
                setOfflineReport({ ticks: offlineTicks, matured, minutes: elapsedMinutes });
                return { ...prev, plots: nextPlots, lastSeen: Date.now() };
            });
        } else {
            setState(prev => ({ ...prev, lastSeen: Date.now() }));
        }
    }, []);

    // ── Daily Checkin ──
    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        if (state.checkin.lastDate !== today) {
            setShowCheckinBanner(true);
        }
    }, []);

    // ── Growth tick ──
    useEffect(() => {
        const timer = setInterval(() => {
            setState(prev => {
                const speedMult = (speedBoostActive ? 2 : 1) * (1 + prev.prestige * PRESTIGE_BONUS);
                const nextPlots = prev.plots.map(p => {
                    if (!p.seed || (p.status !== 'planted' && p.status !== 'growing')) return p;
                    let nt = p.growthTick + ((p.waterLevel > 50 ? 1.3 : 0.8) * (p.fertLevel > 50 ? 1.2 : 0.9)) * speedMult;
                    let nw = Math.max(0, p.waterLevel - 3 * (1 - prev.labUpgrades.waterRetention * 0.3)), nf = Math.max(0, p.fertLevel - 2);
                    let ns: PlotStatus = p.status;
                    if (p.seed.id === 'ai' && nw === 0 && nf === 0 && !p.shielded) ns = 'withered';
                    else if (nt >= p.seed.growthTime) ns = 'ready';
                    else if (nt > 1) ns = 'growing';
                    return { ...p, growthTick: nt, status: ns, waterLevel: nw, fertLevel: nf };
                });
                return { ...prev, plots: nextPlots };
            });
        }, TICK_MS);
        return () => clearInterval(timer);
    }, [speedBoostActive]);

    // ── Random Events (every 30s) ──
    useEffect(() => {
        const timer = setInterval(() => {
            // Weather trigger (30% chance)
            if (Math.random() < 0.3) {
                const w: WeatherType[] = ['rain', 'snow', 'thunder'];
                const picked = w[Math.floor(Math.random() * w.length)];
                setWeather(picked);
                setTimeout(() => setWeather(null), picked === 'thunder' ? 5000 : 15000);
            }
            setState(prev => {
                if (!prev.plots.some(p => p.status !== 'empty')) return prev;
                for (const evt of RANDOM_EVENTS) {
                    if (Math.random() < evt.probability) {
                        const ns = evt.effect(prev);
                        const ge: GameEvent = { id: Date.now().toString(), type: evt.type, message: evt.message, ts: Date.now() };
                        setActiveToast(ge);
                        return { ...ns, events: [ge, ...ns.events].slice(0, 8) };
                    }
                }
                return prev;
            });
        }, 30_000);
        return () => clearInterval(timer);
    }, []);

    // ── Achievement Checker ──
    useEffect(() => {
        setState(prev => {
            const a = [...prev.achievements]; let changed = false; let newA: Achievement | null = null;
            const chk = (id: string, cond: boolean) => { const i = a.findIndex(x => x.id === id); if (i >= 0 && !a[i].unlocked && cond) { a[i] = { ...a[i], unlocked: true, unlockedAt: Date.now() }; changed = true; newA = a[i]; } };
            chk('first_harvest', prev.totalHarvests >= 1); chk('full_farm', prev.plots.every(p => p.status !== 'empty'));
            chk('paper_10', prev.papers >= 10); chk('paper_50', prev.papers >= 50);
            chk('coins_200', prev.coins >= 200); chk('level_5', prev.level >= 5);
            chk('mutation_1', prev.mutations >= 1); chk('mutation_5', prev.mutations >= 5);
            chk('prestige_1', prev.prestige >= 1); chk('checkin_7', prev.checkin.totalDays >= 7);
            chk('expand_1', prev.expansion.rows * prev.expansion.cols > 12); chk('harvest_50', prev.totalHarvests >= 50);
            if (changed) { if (newA) setAchievementPopup(newA); return { ...prev, achievements: a }; }
            return prev;
        });
    }, [state.totalHarvests, state.papers, state.coins, state.level, state.mutations, state.prestige, state.checkin.totalDays]);

    // ── Goal Tracker ──
    useEffect(() => {
        setState(prev => {
            const goals = prev.goals.map(g => {
                let cur = g.type === 'harvest' ? prev.totalHarvests : g.type === 'papers' ? prev.papers : prev.coins;
                return { ...g, current: cur, completed: cur >= g.target };
            });
            const bonus = goals.filter((g, i) => g.completed && !prev.goals[i].completed).reduce((s, g) => s + g.reward, 0);
            if (JSON.stringify(goals) !== JSON.stringify(prev.goals) || bonus > 0) return { ...prev, goals, coins: prev.coins + bonus };
            return prev;
        });
    }, [state.totalHarvests, state.papers, state.coins]);

    // ── Handlers ──
    const handlePlotClick = (idx: number) => {
        const p = state.plots[idx];
        if (p.status === 'empty' && !action) setShowSeedModal(idx);
        else if (p.status === 'ready' && (!action || action === 'harvest')) harvest(idx);
        else if (action === 'water') water(idx);
        else if (action === 'fertilize') fertilize(idx);
        else if (action === 'weed' && p.status === 'withered') weed(idx);
    };

    const harvest = (idx: number) => {
        setState(prev => {
            const s = prev.plots[idx].seed!; let count = s.yield + prev.labUpgrades.yieldBoost;
            const isMutation = Math.random() < MUTATION_CHANCE;
            if (isMutation) count = count * 2;
            const np = [...prev.plots]; np[idx] = makePlot(idx);
            let newXp = prev.xp + 5, newLv = prev.level;
            while (newXp >= XP_PER_LEVEL) { newXp -= XP_PER_LEVEL; newLv++; }
            const invItem: InventoryItem = { id: `inv-${Date.now()}`, name: isMutation ? `✨${s.name}(变异)` : s.name, emoji: isMutation ? '🧬' : s.emoji, seedId: s.id, harvestedAt: Date.now(), yield: count };
            const msg = isMutation ? `🧬 变异收获！${s.name} 产量翻倍！+${count}📄 +${count * 3}💰` : `🎉 ${s.name} 收获！+${count}📄 +${count * 3}💰`;
            return {
                ...prev, plots: np, papers: s.id !== 'bio' ? prev.papers + count : prev.papers, patents: s.id === 'bio' ? prev.patents + 1 : prev.patents,
                coins: prev.coins + (count * 3), totalHarvests: prev.totalHarvests + 1, xp: newXp, level: newLv,
                inventory: [invItem, ...prev.inventory].slice(0, 50), mutations: prev.mutations + (isMutation ? 1 : 0),
                events: [{ id: Date.now().toString(), type: isMutation ? 'warning' as const : 'success' as const, message: msg, ts: Date.now() }, ...prev.events].slice(0, 8)
            };
        });
        setParticles(Array.from({ length: 8 }, (_, i) => ({ id: `${Date.now()}-${i}`, x: 300 + (idx % COLS) * 136 + (Math.random() - 0.5) * 80, y: 250 + Math.floor(idx / COLS) * 82 + (Math.random() - 0.5) * 40, emoji: ['✨', '💫', '⭐', '💰', '🎉'][Math.floor(Math.random() * 5)], delay: i * 80 })));
        setTimeout(() => setParticles([]), 2000);
    };

    const buyShopItem = (item: ShopItem) => {
        if (state.coins < item.price) return;
        setState(pv => {
            const evt: GameEvent = { id: Date.now().toString(), type: 'success', message: `🛒 购买了${item.name}！(-${item.price}💰)`, ts: Date.now() };
            return { ...pv, coins: pv.coins - item.price, events: [evt, ...pv.events].slice(0, 8) };
        });
        if (item.effect === 'speedUp') { setSpeedBoostActive(true); setActiveToast({ id: Date.now().toString(), type: 'info', message: '⚡ 加速器启动！生长速度翻倍 60 秒！', ts: Date.now() }); setTimeout(() => setSpeedBoostActive(false), 60_000); }
        if (item.effect === 'autoWater') { setState(pv => ({ ...pv, plots: pv.plots.map(p => p.seed ? { ...p, waterLevel: 100, fertLevel: 100 } : p) })); setActiveToast({ id: Date.now().toString(), type: 'info', message: '🚿 自动灌溉完成！全田浇水+施肥！', ts: Date.now() }); }
        if (item.effect === 'shield') { setState(pv => { const growing = pv.plots.filter(p => p.status === 'growing' || p.status === 'planted'); if (!growing.length) return pv; const t = growing[0]; const np = [...pv.plots]; np[t.id] = { ...np[t.id], shielded: true }; return { ...pv, plots: np }; }); setActiveToast({ id: Date.now().toString(), type: 'info', message: '🛡️ 保护罩已部署到第一块活跃田地！', ts: Date.now() }); }
        setShowShop(false);
    };

    const water = (idx: number) => { if (state.coins < 2) return; setState(pv => { const n = [...pv.plots]; n[idx] = { ...n[idx], waterLevel: 100 }; return { ...pv, plots: n, coins: pv.coins - 2, events: [{ id: Date.now().toString(), type: 'info' as const, message: '💧 已浇水 (-2💰)', ts: Date.now() }, ...pv.events].slice(0, 8) }; }); };
    const fertilize = (idx: number) => { if (state.coins < 5) return; setState(pv => { const n = [...pv.plots]; n[idx] = { ...n[idx], fertLevel: 100 }; return { ...pv, plots: n, coins: pv.coins - 5, events: [{ id: Date.now().toString(), type: 'info' as const, message: '🧪 已施肥 (-5💰)', ts: Date.now() }, ...pv.events].slice(0, 8) }; }); };
    const weed = (idx: number) => { setState(pv => { const n = [...pv.plots]; n[idx] = makePlot(idx); return { ...pv, plots: n, events: [{ id: Date.now().toString(), type: 'info' as const, message: '🧹 已清理枯萎作物', ts: Date.now() }, ...pv.events].slice(0, 8) }; }); };
    const plant = (idx: number, seed: Seed) => { setState(pv => { if (pv.coins < 5) return pv; const n = [...pv.plots]; n[idx] = { ...makePlot(idx), status: 'planted', seed, waterLevel: 100, fertLevel: 100 }; const isNew = !pv.plantedSeedIds.includes(seed.id); const newIds = isNew ? [...pv.plantedSeedIds, seed.id] : pv.plantedSeedIds; const newJournal = isNew ? [...pv.journal, { id: Date.now().toString(), ts: Date.now(), text: `首次培育${seed.name}！`, emoji: seed.emoji }].slice(-30) : pv.journal; return { ...pv, plots: n, coins: pv.coins - 5, plantedSeedIds: newIds, journal: newJournal, events: [{ id: Date.now().toString(), type: 'success' as const, message: `🌱 培育 ${seed.name} (-5💰)`, ts: Date.now() }, ...pv.events].slice(0, 8) }; }); setShowSeedModal(null); };

    const doCheckin = () => {
        const today = new Date().toISOString().slice(0, 10);
        setState(pv => {
            const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
            const isConsecutive = pv.checkin.lastDate === yesterday;
            const newStreak = isConsecutive ? pv.checkin.streak + 1 : 1;
            const rewardIdx = Math.min(newStreak - 1, CHECKIN_REWARDS.length - 1);
            const reward = CHECKIN_REWARDS[rewardIdx];
            const evt: GameEvent = { id: Date.now().toString(), type: 'success', message: `🎁 签到成功！连续${newStreak}天 +${reward}💰`, ts: Date.now() };
            setActiveToast(evt);
            return { ...pv, coins: pv.coins + reward, checkin: { lastDate: today, streak: newStreak, totalDays: pv.checkin.totalDays + 1 }, events: [evt, ...pv.events].slice(0, 8) };
        });
        setShowCheckinBanner(false);
    };

    const expandFarm = (tier: typeof EXPANSION_TIERS[number]) => {
        if (state.coins < tier.cost) return;
        setState(pv => {
            const newTotal = tier.rows * tier.cols;
            const existingPlots = [...pv.plots];
            while (existingPlots.length < newTotal) existingPlots.push(makePlot(existingPlots.length));
            const evt: GameEvent = { id: Date.now().toString(), type: 'success', message: `🏗️ 农场扩建到 ${tier.label}！`, ts: Date.now() };
            setActiveToast(evt);
            return { ...pv, plots: existingPlots, coins: pv.coins - tier.cost, expansion: { rows: tier.rows, cols: tier.cols }, events: [evt, ...pv.events].slice(0, 8) };
        });
    };

    const togglePet = () => { setState(pv => ({ ...pv, petActive: !pv.petActive })); };

    const buyLabUpgrade = (upgradeId: string) => {
        const def = LAB_UPGRADES_SHOP.find(u => u.id === upgradeId);
        if (!def || state.coins < def.price) return;
        setState(pv => {
            const lab = { ...pv.labUpgrades };
            if (upgradeId === 'yieldBoost' && lab.yieldBoost < def.max) lab.yieldBoost++;
            else if (upgradeId === 'waterRetention' && lab.waterRetention < def.max) lab.waterRetention++;
            else if (upgradeId === 'autoHarvest' && !lab.autoHarvest) lab.autoHarvest = true;
            else return pv;
            const evt: GameEvent = { id: Date.now().toString(), type: 'success', message: `⚙️ 实验室升级：${def.name}！`, ts: Date.now() };
            setActiveToast(evt);
            return { ...pv, labUpgrades: lab, coins: pv.coins - def.price, events: [evt, ...pv.events].slice(0, 8) };
        });
    };

    // ── Auto-harvest effect ──
    useEffect(() => {
        if (!state.labUpgrades.autoHarvest) return;
        const t = setInterval(() => {
            const readyIdx = state.plots.findIndex(p => p.status === 'ready');
            if (readyIdx >= 0) harvest(readyIdx);
        }, 5000);
        return () => clearInterval(t);
    }, [state.labUpgrades.autoHarvest, state.plots]);

    // ── Challenge system ──
    const startChallenge = () => {
        const tmpl = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
        const baseVal = tmpl.type === 'harvest' ? state.totalHarvests : state.papers;
        setChallenge({ id: Date.now().toString(), description: tmpl.description, target: tmpl.target, current: 0, reward: tmpl.reward, type: tmpl.type, timeLeft: tmpl.time, active: true });
        setActiveToast({ id: Date.now().toString(), type: 'info', message: `🎯 挑战开始！${tmpl.description}`, ts: Date.now() });
    };

    useEffect(() => {
        if (!challenge || !challenge.active) return;
        const t = setInterval(() => {
            setChallenge(prev => {
                if (!prev || !prev.active) return prev;
                const newLeft = prev.timeLeft - 1;
                const currentVal = prev.type === 'harvest' ? state.totalHarvests : state.papers;
                const progress = currentVal - (prev.type === 'harvest' ? state.totalHarvests - (state.totalHarvests - prev.current) : state.papers - (state.papers - prev.current));
                if (newLeft <= 0) {
                    if (progress >= prev.target) {
                        setState(pv => ({ ...pv, coins: pv.coins + prev.reward, events: [{ id: Date.now().toString(), type: 'success' as const, message: `🎉 挑战完成！+${prev.reward}💰`, ts: Date.now() }, ...pv.events].slice(0, 8) }));
                        setActiveToast({ id: Date.now().toString(), type: 'success', message: `🎉 挑战完成！+${prev.reward}💰`, ts: Date.now() });
                    } else {
                        setActiveToast({ id: Date.now().toString(), type: 'danger', message: '❌ 挑战失败…下次努力！', ts: Date.now() });
                    }
                    return null;
                }
                return { ...prev, timeLeft: newLeft, current: progress };
            });
        }, 1000);
        return () => clearInterval(t);
    }, [challenge?.active]);

    const doPrestige = () => {
        setState(pv => {
            const total = DEFAULT_COLS * DEFAULT_ROWS;
            const evt: GameEvent = { id: Date.now().toString(), type: 'success', message: `🎓 毕业重生！永久加成 +${((pv.prestige + 1) * PRESTIGE_BONUS * 100).toFixed(0)}% 生长速度`, ts: Date.now() };
            setActiveToast(evt);
            return {
                plots: Array.from({ length: total }, (_, i) => makePlot(i)),
                papers: 0, patents: 0, citations: 0, coins: 50, totalHarvests: 0,
                events: [evt], level: 1, xp: 0, goals: INITIAL_GOALS,
                achievements: pv.achievements, inventory: [],
                boosts: { speedUp: 0, shields: 0, autoWater: 0 },
                checkin: pv.checkin, expansion: { rows: DEFAULT_ROWS, cols: DEFAULT_COLS },
                petActive: false, prestige: pv.prestige + 1, lastSeen: Date.now(),
                labUpgrades: { yieldBoost: 0, waterRetention: 0, autoHarvest: false }, mutations: 0,
                journal: [...pv.journal, { id: Date.now().toString(), ts: Date.now(), text: `第${pv.prestige + 1}次毕业，重新起航！`, emoji: '🎓' }].slice(-30),
                plantedSeedIds: pv.plantedSeedIds, farmTheme: 'default', gachaCount: pv.gachaCount,
            };
        });
        setShowPrestigeConfirm(false);
        setShowStats(false);
    };

    // ── Gacha ──
    const doGacha = () => {
        if (state.coins < GACHA_COST) return;
        const totalWeight = GACHA_POOL.reduce((s, g) => s + g.weight, 0);
        let r = Math.random() * totalWeight;
        let pick = GACHA_POOL[0];
        for (const g of GACHA_POOL) { r -= g.weight; if (r <= 0) { pick = g; break; } }
        setState(pv => {
            const result = pick.effect({ ...pv, coins: pv.coins - GACHA_COST });
            return { ...result, gachaCount: pv.gachaCount + 1, events: [{ id: Date.now().toString(), type: 'info' as const, message: `🎰 抽奖：${pick.emoji} ${pick.name}！${pick.msg}`, ts: Date.now() }, ...result.events].slice(0, 8) };
        });
        setGachaResult(pick);
    };

    // ── Journal auto-entry ──
    const addJournal = useCallback((text: string, emoji: string) => {
        setState(pv => ({ ...pv, journal: [...pv.journal, { id: Date.now().toString(), ts: Date.now(), text, emoji }].slice(-30) }));
    }, []);

    // ── Theme ──
    const buyTheme = (themeId: string) => {
        const t = FARM_THEMES.find(x => x.id === themeId);
        if (!t || state.coins < t.cost) return;
        setState(pv => ({ ...pv, farmTheme: themeId, coins: pv.coins - t.cost }));
        setActiveToast({ id: Date.now().toString(), type: 'success', message: `🎨 已解锁主题：${t.name}！`, ts: Date.now() });
    };

    // ── Pet auto-water effect ──
    useEffect(() => {
        if (!state.petActive) return;
        const t = setInterval(() => {
            setState(pv => {
                const thirsty = pv.plots.filter(p => p.seed && p.waterLevel < 40 && (p.status === 'planted' || p.status === 'growing'));
                if (!thirsty.length) return pv;
                const target = thirsty[Math.floor(Math.random() * thirsty.length)];
                const np = [...pv.plots]; np[target.id] = { ...np[target.id], waterLevel: Math.min(100, np[target.id].waterLevel + 30) };
                return { ...pv, plots: np };
            });
        }, 10_000);
        return () => clearInterval(t);
    }, [state.petActive]);

    const xpPct = (state.xp / XP_PER_LEVEL) * 100;
    const activePlots = state.plots.filter(p => p.status !== 'empty').length;
    const readyPlots = state.plots.filter(p => p.status === 'ready').length;

    return (
        <div className="h-full flex flex-col text-slate-900 relative overflow-hidden" style={{ backgroundColor: timeOfDay === 'night' ? '#101828' : '#95B182' }}>
            {/* Background */}
            <div className="absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: `url(${todConfig.bg})`, transition: 'background-image 1.5s ease-in-out' }}>
                <div className="absolute inset-0 pointer-events-none transition-all duration-[2000ms]" style={{ backgroundColor: todConfig.overlay }} /></div>
            <AmbientLayer timeOfDay={timeOfDay} />
            <WeatherLayer weather={weather} />
            <ResearchPet active={state.petActive} cols={COLS} />

            {/* Harvest Particles */}
            {particles.length > 0 && <div className="fixed inset-0 z-[200] pointer-events-none">{particles.map(p => (
                <div key={p.id} className="absolute animate-harvest-float" style={{ left: p.x, top: p.y, animationDelay: `${p.delay}ms` }}><span className="text-3xl">{p.emoji}</span></div>
            ))}</div>}

            <EventToast event={activeToast} onDismiss={() => setActiveToast(null)} />
            <AchievementPopup achievement={achievementPopup} onDismiss={() => setAchievementPopup(null)} />

            {/* Offline Report */}
            {offlineReport && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-xl p-8" onClick={() => setOfflineReport(null)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-md p-12 shadow-2xl pointer-events-auto animate-reveal text-center" onClick={e => e.stopPropagation()}>
                        <span className="text-6xl block mb-4">🌟</span>
                        <h2 className="text-2xl font-black italic tracking-tighter mb-2 text-slate-800">欢迎回来！</h2>
                        <p className="text-sm text-slate-500 mb-6">你离开了 {offlineReport.minutes >= 60 ? `${Math.floor(offlineReport.minutes / 60)} 小时 ${offlineReport.minutes % 60} 分钟` : `${offlineReport.minutes} 分钟`}</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-emerald-50 p-4 rounded-2xl"><p className="text-2xl font-black text-emerald-600">{offlineReport.ticks}</p><p className="text-[9px] font-bold text-emerald-400">离线生长 Ticks</p></div>
                            <div className="bg-amber-50 p-4 rounded-2xl"><p className="text-2xl font-black text-amber-600">{offlineReport.matured}</p><p className="text-[9px] font-bold text-amber-400">作物已成熟</p></div>
                        </div>
                        <button onClick={() => setOfflineReport(null)} className="bg-emerald-500 text-white font-black px-8 py-3 rounded-full hover:bg-emerald-600 transition-all shadow-lg">开始劳作！</button>
                    </div>
                </div>
            )}

            {/* Checkin Banner */}
            {showCheckinBanner && state.checkin.lastDate !== new Date().toISOString().slice(0, 10) && (
                <div className="absolute top-0 left-0 right-0 z-[50] bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3 px-6 flex items-center justify-center gap-4 shadow-xl pointer-events-auto animate-reveal">
                    <span className="text-2xl">🎁</span>
                    <span className="font-black text-sm">今日签到可领取 {CHECKIN_REWARDS[Math.min(state.checkin.streak, CHECKIN_REWARDS.length - 1)]}💰 (连续{state.checkin.streak + 1}天)</span>
                    <button onClick={doCheckin} className="bg-white text-amber-600 font-black px-4 py-1.5 rounded-full text-sm hover:scale-105 transition-all shadow-lg">签到领取</button>
                    <button onClick={() => setShowCheckinBanner(false)} className="text-white/70 hover:text-white text-xl ml-2">×</button>
                </div>
            )}

            {/* Time Badge */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full border border-white/30 text-white text-xs font-bold">
                <span>{todConfig.emoji}</span><span>{todConfig.label}</span></div>

            {/* UI Overlay */}
            <div className="relative z-10 flex flex-col h-full pointer-events-none">
                {/* Header */}
                {/* Header - compact info */}
                <div className="p-6 flex items-center justify-between pointer-events-auto">
                    <div className="flex items-center gap-4 bg-white/15 backdrop-blur-2xl p-3 pr-6 rounded-[2rem] border border-white/40 shadow-2xl">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-xl shadow-lg ring-2 ring-white/20">🌱</div>
                        <div>
                            <h1 className="text-lg font-black italic tracking-tighter text-slate-800">ECO-LAB <span className="text-[10px] non-italic text-emerald-700 opacity-50 ml-0.5">v9.0</span></h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[7px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded-full shadow-sm">Lv.{state.level}</span>
                                {state.prestige > 0 && <span className="text-[7px] font-black text-white bg-amber-500 px-1.5 py-0.5 rounded-full shadow-sm">⭐×{state.prestige}</span>}
                                <div className="w-16 h-1.5 bg-black/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500 rounded-full" style={{ width: `${xpPct}%` }} /></div>
                                <span className="text-[6px] text-slate-500 font-bold tabular-nums">{state.xp}/{XP_PER_LEVEL}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {[{ e: '💰', v: state.coins, c: 'from-yellow-400/30 to-amber-400/30 border-amber-300/40' }, { e: '📄', v: state.papers, c: 'from-sky-400/30 to-blue-400/30 border-sky-300/40' }, { e: '🏆', v: state.patents, c: 'from-orange-400/30 to-red-400/30 border-orange-300/40' }].map((s, i) => (
                            <div key={i} className={`bg-gradient-to-b ${s.c} backdrop-blur-xl px-4 py-2 rounded-2xl border text-center min-w-[70px] shadow-xl`}>
                                <p className="text-lg font-black text-slate-900 tabular-nums">{s.e} {s.v}</p>
                            </div>))}
                    </div>
                </div>

                {/* Floating Toolbar */}
                <div className="absolute top-[72px] right-6 z-20 pointer-events-auto">
                    <div className="flex gap-1 bg-black/15 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/20 shadow-2xl">
                        {([
                            { fn: startChallenge, icon: '🎯', active: !!challenge, badge: challenge ? `${challenge.timeLeft}` : '', disabled: !!challenge },
                            { fn: () => setShowGacha(true), icon: '🎰' },
                            { fn: () => setShowShop(true), icon: '🛒' },
                            { fn: () => setShowInventory(true), icon: '📦', badge: state.inventory.length > 0 ? `${state.inventory.length}` : '' },
                            { fn: () => setShowStats(true), icon: '📊' },
                            { fn: togglePet, icon: '🐱', active: state.petActive },
                            { fn: () => setShowAchievements(!showAchievements), icon: '🏅', badge: state.achievements.filter(a => a.unlocked).length > 0 ? `${state.achievements.filter(a => a.unlocked).length}` : '' },
                            { fn: () => setShowGuide(true), icon: '❓' },
                            { fn: () => setShowJournal(true), icon: '📖' },
                            { fn: () => setShowCodex(true), icon: '📚', badge: `${state.plantedSeedIds.length}/${SEEDS.length}` },
                            { fn: () => setShowThemes(true), icon: '🎨' },
                        ] as { fn: () => void; icon: string; active?: boolean; badge?: string; disabled?: boolean }[]).map((btn, i) => (
                            <button key={i} onClick={btn.fn} disabled={btn.disabled}
                                className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all hover:scale-110 hover:bg-white/20 active:scale-95 ${btn.active ? 'bg-white/30 ring-1 ring-white/40' : ''} ${btn.disabled && !btn.active ? 'opacity-40' : ''}`}>
                                {btn.icon}
                                {btn.badge && <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 rounded-full text-[7px] font-black flex items-center justify-center text-white border border-white/80 px-0.5">{btn.badge}</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Center Farm */}
                <div className="flex-1 flex items-center justify-center relative translate-y-[60px] -translate-x-[30px]">
                    <div className="relative z-30 pointer-events-none" style={{ isolation: 'isolate' }}>
                        <div className="grid gap-[14px]" style={{ gridTemplateColumns: `repeat(${COLS}, 100px)`, transform: `skewX(-8deg) translateY(80px)`, transformOrigin: 'bottom center', pointerEvents: 'auto' }}>
                            {state.plots.map((plot, i) => <PlotTile key={i} plot={plot} onClick={() => handlePlotClick(i)} action={action} />)}
                        </div>
                    </div>

                    {activePlots > 0 && <div className="absolute left-8 bottom-8 bg-black/20 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/20 text-white pointer-events-auto">
                        <div className="flex items-center gap-4 text-[10px] font-bold">
                            <span>🌿 {activePlots}/12 活跃</span>
                            {readyPlots > 0 && <span className="text-yellow-300 animate-pulse">🌾 {readyPlots} 待收获!</span>}
                            {speedBoostActive && <span className="text-cyan-300 animate-pulse">⚡ 加速中</span>}
                            {weather && <span className="text-blue-200">{weather === 'rain' ? '🌧️ 下雨' : weather === 'snow' ? '❄️ 飘雪' : '⛈️ 雷暴'}</span>}
                        </div></div>}

                    {/* Mission Panel */}
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 w-64 bg-white/25 border border-white/60 rounded-[2rem] p-4 backdrop-blur-3xl shadow-2xl flex flex-col gap-3 pointer-events-auto">
                        <h3 className="text-[9px] font-black text-slate-500 tracking-[0.3em] text-center border-b border-black/5 pb-2">TARGETS</h3>
                        <div className="space-y-2">{state.goals.map(g => (
                            <div key={g.id} className={`p-3 rounded-2xl border transition-all ${g.completed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/40 border-white/30'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <p className={`text-[9px] font-black tracking-tight leading-tight ${g.completed ? 'text-emerald-700 line-through' : 'text-slate-600'}`}>{g.description}</p>
                                    {g.completed && <span className="text-xs shrink-0">✅</span>}</div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-1 bg-black/10 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${g.completed ? 'bg-emerald-500' : 'bg-sky-400'}`} style={{ width: `${Math.min(100, (g.current / g.target) * 100)}%` }} /></div>
                                    <span className="text-[8px] font-bold text-slate-500 tabular-nums">{Math.min(g.current, g.target)}/{g.target}</span></div>
                            </div>))}</div>
                        <div className="h-24 overflow-y-auto scrollbar-hide pt-2 border-t border-black/5">
                            <p className="text-[8px] font-black text-slate-400 tracking-[0.3em] mb-1.5">EVENT LOG</p>
                            {state.events.slice(0, 5).map(ev => (
                                <div key={ev.id} className={`text-[9px] font-bold py-1 border-b border-black/5 leading-tight ${ev.type === 'danger' ? 'text-red-400' : ev.type === 'warning' ? 'text-amber-500' : ev.type === 'success' ? 'text-emerald-500' : 'text-slate-400'}`}>{ev.message}</div>
                            ))}</div>
                        {challenge && (
                            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl animate-pulse">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-[9px] font-black text-red-600">🎯 {challenge.description}</p>
                                    <span className="text-[9px] font-black text-red-500 tabular-nums">{challenge.timeLeft}s</span>
                                </div>
                                <div className="w-full h-1 bg-red-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 transition-all duration-300 rounded-full" style={{ width: `${Math.min(100, (challenge.current / challenge.target) * 100)}%` }} />
                                </div>
                                <p className="text-[7px] text-red-400 mt-1 text-right">{challenge.current}/{challenge.target} · 奖励 {challenge.reward}💰</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="pb-16 flex flex-col items-center gap-6 pointer-events-auto">
                    <div className="flex gap-4 p-2 bg-white/40 rounded-[2.5rem] border border-white/60 shadow-2xl backdrop-blur-3xl ring-8 ring-white/5">
                        {[{ id: 'water', l: 'Water', e: '💧', c: 'bg-sky-500', cost: '2💰' }, { id: 'fertilize', l: 'Feed', e: '🧪', c: 'bg-amber-500', cost: '5💰' }, { id: 'weed', l: 'Clean', e: '🧹', c: 'bg-slate-400', cost: 'Free' }, { id: 'harvest', l: 'Pick', e: '🧺', c: 'bg-emerald-500', cost: 'Free' }].map(t => (
                            <button key={t.id} onClick={() => setAction(action === t.id ? null : (t.id as ActionType))}
                                className={`flex flex-col items-center px-8 py-3 rounded-3xl transition-all border-2 ${action === t.id ? `${t.c} border-white shadow-xl scale-110 text-white` : 'bg-white/10 border-transparent hover:bg-white/30 text-slate-700'}`}>
                                <span className="text-2xl mb-1">{t.e}</span>
                                <span className="text-[9px] font-black uppercase tracking-widest">{t.l}</span>
                                <span className={`text-[7px] mt-0.5 ${action === t.id ? 'text-white/70' : 'text-slate-400'}`}>{t.cost}</span>
                            </button>))}
                    </div>
                </div>
            </div>

            {/* Seed Picker Modal */}
            {showSeedModal !== null && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-2xl p-8" onClick={() => setShowSeedModal(null)}>
                    <div className="bg-white/95 border-b-[8px] border-emerald-500 rounded-[4rem] w-full max-w-2xl p-14 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-3xl font-black italic tracking-tighter mb-1 text-slate-800">New Cultivation</h2>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-10">Select specimen (5 Credits) — You have {state.coins}💰</p>
                        <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {SEEDS.map(s => {
                                const locked = (s.unlockLevel || 0) > state.level;
                                const cantAfford = state.coins < 5;
                                return (
                                    <button key={s.id} onClick={() => !locked && plant(showSeedModal!, s)} disabled={cantAfford || locked}
                                        className={`group p-6 text-left rounded-[2.5rem] border-2 transition-all active:scale-95 shadow-sm relative
                                        ${locked ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-100' : cantAfford ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50' : 'border-slate-100 bg-white hover:border-emerald-500 hover:bg-emerald-50'}`}>
                                        {locked && <div className="absolute top-3 right-4 flex items-center gap-1 bg-slate-200 px-2 py-0.5 rounded-full"><span className="text-xs">🔒</span><span className="text-[8px] font-black text-slate-500">Lv.{s.unlockLevel}</span></div>}
                                        <div className="flex items-center gap-4 mb-2">
                                            {s.icon ? <img src={s.icon} className={`w-12 h-12 object-contain ${locked ? 'grayscale' : ''}`} alt={s.name} /> : <span className={`text-3xl ${locked ? 'grayscale' : ''}`}>{s.emoji}</span>}
                                            <div><span className="text-[12px] font-black text-slate-800 uppercase leading-none block">{s.name}</span>
                                                <span className="text-[9px] text-slate-400">⏱️ {s.growthTime} ticks · 📄 ×{s.yield}</span></div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold group-hover:text-slate-600 transition-colors">{locked ? `需要达到 Lv.${s.unlockLevel} 解锁` : s.description}</p>
                                    </button>);
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Shop Modal */}
            {showShop && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowShop(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-lg p-12 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black italic tracking-tighter mb-1 text-slate-800">🛒 科研商店</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">购买道具提升效率 · 当前经费 {state.coins}💰</p>
                        <div className="space-y-3">
                            {SHOP_ITEMS.map(item => (
                                <button key={item.id} onClick={() => buyShopItem(item)} disabled={state.coins < item.price}
                                    className={`w-full p-5 rounded-3xl border-2 text-left transition-all flex items-center gap-4 ${state.coins < item.price ? 'opacity-40 cursor-not-allowed border-slate-200' : 'border-slate-100 hover:border-amber-400 hover:bg-amber-50 active:scale-98'}`}>
                                    <span className="text-3xl">{item.emoji}</span>
                                    <div className="flex-1">
                                        <p className="text-[12px] font-black text-slate-800">{item.name}</p>
                                        <p className="text-[9px] text-slate-400">{item.description}</p>
                                    </div>
                                    <span className="text-sm font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-full">{item.price}💰</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Inventory Modal */}
            {showInventory && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowInventory(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-lg p-12 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black italic tracking-tighter mb-1 text-slate-800">📦 收获仓库</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">共 {state.inventory.length} 次收获记录 · {state.papers} 篇论文 · {state.patents} 项专利</p>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
                            {state.inventory.length === 0 ? (
                                <div className="text-center py-12 text-slate-300"><span className="text-5xl block mb-4">🌾</span><p className="text-sm font-bold">暂无收获记录</p><p className="text-xs mt-1">种下第一颗种子开始你的科研之旅！</p></div>
                            ) : state.inventory.map(inv => (
                                <div key={inv.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-100">
                                    <span className="text-2xl">{inv.emoji}</span>
                                    <div className="flex-1">
                                        <p className="text-[11px] font-black text-slate-700">{inv.name}</p>
                                        <p className="text-[8px] text-slate-400">{new Date(inv.harvestedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+{inv.yield} {inv.seedId === 'bio' ? '🏆' : '📄'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Achievements Panel */}
            {showAchievements && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowAchievements(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-lg p-12 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black italic tracking-tighter mb-1 text-slate-800">🏅 Achievements</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">{state.achievements.filter(a => a.unlocked).length} / {state.achievements.length} 已解锁</p>
                        <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            {state.achievements.map(a => (
                                <div key={a.id} className={`p-5 rounded-3xl border-2 transition-all ${a.unlocked ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                                    <span className="text-3xl block mb-2">{a.emoji}</span>
                                    <p className="text-[11px] font-black text-slate-800">{a.name}</p>
                                    <p className="text-[9px] text-slate-400 mt-1">{a.description}</p>
                                </div>))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Panel */}
            {showStats && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowStats(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-lg p-12 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black italic tracking-tighter mb-1 text-slate-800">📊 科研成果统计</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">你的科研之旅全览</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {[{ l: '总收获', v: state.totalHarvests, e: '🌾', c: 'from-emerald-400 to-green-500' },
                            { l: '论文数', v: state.papers, e: '📄', c: 'from-sky-400 to-blue-500' },
                            { l: '专利数', v: state.patents, e: '🏆', c: 'from-amber-400 to-orange-500' },
                            { l: '当前经费', v: state.coins, e: '💰', c: 'from-yellow-400 to-amber-500' },
                            { l: '研究等级', v: state.level, e: '🎓', c: 'from-violet-400 to-purple-500' },
                            { l: '签到天数', v: state.checkin.totalDays, e: '📅', c: 'from-rose-400 to-pink-500' },
                            { l: '作物变异', v: state.mutations, e: '🧬', c: 'from-purple-400 to-fuchsia-500' },
                            ].map(s => (
                                <div key={s.l} className={`bg-gradient-to-br ${s.c} p-4 rounded-3xl text-white`}>
                                    <span className="text-2xl">{s.e}</span>
                                    <p className="text-2xl font-black mt-1">{s.v}</p>
                                    <p className="text-[9px] font-bold opacity-80">{s.l}</p>
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">⚙️ 实验室升级</p>
                            <div className="space-y-2 mb-4">
                                {LAB_UPGRADES_SHOP.map(u => {
                                    const cur = u.id === 'yieldBoost' ? state.labUpgrades.yieldBoost : u.id === 'waterRetention' ? state.labUpgrades.waterRetention : (state.labUpgrades.autoHarvest ? 1 : 0);
                                    const maxed = cur >= u.max;
                                    return (
                                        <button key={u.id} onClick={() => !maxed && buyLabUpgrade(u.id)} disabled={maxed || state.coins < u.price}
                                            className={`w-full p-3 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${maxed ? 'bg-emerald-50 border-emerald-200 opacity-70' : state.coins < u.price ? 'opacity-40 border-slate-200' : 'border-slate-100 hover:border-cyan-400 hover:bg-cyan-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{u.emoji}</span>
                                                <div>
                                                    <p className="text-[11px] font-black text-slate-700">{u.name} {maxed ? '✅' : `(${cur}/${u.max})`}</p>
                                                    <p className="text-[8px] text-slate-400">{u.description}</p>
                                                </div>
                                            </div>
                                            {!maxed && <span className="text-[10px] font-black text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-full">{u.price}💰</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">🏗️ 农场扩建</p>
                            <div className="space-y-2">
                                {EXPANSION_TIERS.map(tier => {
                                    const isCurrent = state.expansion.rows === tier.rows && state.expansion.cols === tier.cols;
                                    const isUnlocked = (state.expansion.rows * state.expansion.cols) >= (tier.rows * tier.cols);
                                    return (
                                        <button key={tier.label} onClick={() => !isUnlocked && expandFarm(tier)} disabled={isUnlocked || state.coins < tier.cost}
                                            className={`w-full p-3 rounded-2xl border-2 text-left flex items-center justify-between transition-all
                                                ${isCurrent ? 'bg-emerald-50 border-emerald-300' : isUnlocked ? 'bg-slate-50 border-slate-200 opacity-60' : state.coins < tier.cost ? 'opacity-40 border-slate-200' : 'border-slate-100 hover:border-emerald-400 hover:bg-emerald-50'}`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{isCurrent ? '✅' : isUnlocked ? '✔️' : '🔒'}</span>
                                                <div>
                                                    <p className="text-[11px] font-black text-slate-700">{tier.label}</p>
                                                    <p className="text-[8px] text-slate-400">{tier.rows * tier.cols} 块田地</p>
                                                </div>
                                            </div>
                                            {!isUnlocked && <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{tier.cost}💰</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Prestige Section */}
                        <div className="border-t border-slate-100 pt-4 mt-4">
                            <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] mb-3">🎓 毕业重生 (Prestige {state.prestige})</p>
                            <p className="text-[9px] text-slate-400 mb-3">重置农场，永久获得 +{((state.prestige + 1) * PRESTIGE_BONUS * 100).toFixed(0)}% 生长速度加成。成就和签到保留。</p>
                            {state.prestige > 0 && <p className="text-[9px] text-amber-500 font-bold mb-2">当前加成: +{(state.prestige * PRESTIGE_BONUS * 100).toFixed(0)}% 生长速度 ⭐</p>}
                            <button onClick={() => setShowPrestigeConfirm(true)} disabled={state.level < PRESTIGE_MIN_LEVEL}
                                className={`w-full p-3 rounded-2xl border-2 text-center font-black text-sm transition-all ${state.level < PRESTIGE_MIN_LEVEL ? 'opacity-40 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
                                {state.level < PRESTIGE_MIN_LEVEL ? `需要 Lv.${PRESTIGE_MIN_LEVEL} 才可毕业` : '🎓 毕业重生'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prestige Confirm */}
            {showPrestigeConfirm && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-xl p-8" onClick={() => setShowPrestigeConfirm(false)}>
                    <div className="bg-white/95 rounded-[3rem] w-full max-w-sm p-10 shadow-2xl pointer-events-auto animate-reveal text-center" onClick={e => e.stopPropagation()}>
                        <span className="text-5xl block mb-4">🎓</span>
                        <h2 className="text-xl font-black mb-2 text-slate-800">确认毕业重生？</h2>
                        <p className="text-[11px] text-slate-500 mb-6">将重置：农场、等级、经费、论文、专利、仓库<br />保留：成就、签到记录<br />获得：永久 +{((state.prestige + 1) * PRESTIGE_BONUS * 100).toFixed(0)}% 生长加成 + 50💰</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowPrestigeConfirm(false)} className="flex-1 py-3 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50">取消</button>
                            <button onClick={doPrestige} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black shadow-lg hover:scale-105 transition-all">确认毕业</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Guide Modal */}
            {showGuide && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowGuide(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-lg p-12 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-black italic tracking-tighter mb-6 text-slate-800">❓ 科研农场指南</h2>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-4 text-[11px] text-slate-600">
                            {[
                                { t: '🌱 基本玩法', c: '点击空地播种(5💰)，用💧浇水(2💰)和🧪施肥(5💰)加速生长，成熟后收获论文和经费。' },
                                { t: '💧 资源系统', c: '水分和肥料会自动消耗。低于20%会显示⚠️警告。AI模型种在双资源耗尽时会枯萎。' },
                                { t: '⚡ 随机事件', c: '每30秒随机触发：审稿人拒稿(枯萎)、导师指导(加速)、经费拨款(+20💰)等。' },
                                { t: '🌧️ 天气系统', c: '随机出现雨/雪/雷暴视觉特效，为农场增添氛围。' },
                                { t: '🔒 等级解锁', c: '纳米复合种(Lv.2)、生物医药(Lv.3)、催化剂(Lv.4)、量子晶元(Lv.5)。' },
                                { t: '🛒 商店道具', c: '加速器(25💰)、保护罩(15💰)、自动灌溉(20💰)。' },
                                { t: '🐱 科研助手', c: '激活后自动为缺水作物浇水，每10秒检测一次。' },
                                { t: '🎓 毕业重生', c: '达到Lv.5可毕业，重置农场换取永久+15%生长速度/次。' },
                                { t: '⏰ 离线收益', c: '离开超2分钟后返回，作物会自动生长(速度减半)。' },
                                { t: '🧬 作物变异', c: '每次收获有10%概率变异，产量翻倍！变异收获会显示特殊标记。' },
                                { t: '⚙️ 实验室升级', c: '在统计面板中购买永久升级：产量+1、保水-30%、自动收割。' },
                                { t: '🎯 限时挑战', c: '点击🎯按钮随机接受限时任务，完成获额外经费奖励。' },
                            ].map(item => (
                                <div key={item.t} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="font-black text-slate-700 mb-1">{item.t}</p>
                                    <p className="text-slate-500">{item.c}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Gacha Modal */}
            {showGacha && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => { setShowGacha(false); setGachaResult(null); }}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-sm p-10 shadow-2xl pointer-events-auto animate-reveal text-center" onClick={e => e.stopPropagation()}>
                        <span className="text-5xl block mb-3">🎰</span>
                        <h2 className="text-xl font-black italic tracking-tighter mb-2 text-slate-800">科研抽奖机</h2>
                        <p className="text-[10px] text-slate-400 mb-6">每次 {GACHA_COST}💰 · 已抽 {state.gachaCount} 次</p>
                        {gachaResult ? (
                            <div className="mb-6 p-6 bg-amber-50 rounded-3xl border-2 border-amber-200 animate-reveal">
                                <span className="text-5xl block mb-2">{gachaResult.emoji}</span>
                                <p className="text-lg font-black text-amber-700">{gachaResult.name}</p>
                                <p className="text-sm text-amber-500 mt-1">{gachaResult.msg}</p>
                            </div>
                        ) : (
                            <div className="mb-6 p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <span className="text-4xl block mb-2">❓</span>
                                <p className="text-sm text-slate-400">点击抽奖揭晓奖品</p>
                            </div>
                        )}
                        <button onClick={() => { setGachaResult(null); doGacha(); }} disabled={state.coins < GACHA_COST}
                            className={`w-full py-3 rounded-2xl font-black text-white transition-all ${state.coins < GACHA_COST ? 'bg-slate-300' : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:scale-105 shadow-lg'}`}>
                            {state.coins < GACHA_COST ? '经费不足' : `抽奖 (${GACHA_COST}💰)`}
                        </button>
                    </div>
                </div>
            )}

            {/* Journal Modal */}
            {showJournal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowJournal(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-md p-10 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black italic tracking-tighter mb-1 text-slate-800">📖 研究日志</h2>
                        <p className="text-[10px] text-slate-400 mb-6">共 {state.journal.length} 条记录</p>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
                            {state.journal.length === 0 ? (
                                <p className="text-center text-slate-300 py-8">暂无日志记录，开始科研之旅吧！</p>
                            ) : [...state.journal].reverse().map(e => (
                                <div key={e.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-lg">{e.emoji}</span>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-700">{e.text}</p>
                                        <p className="text-[8px] text-slate-400">{new Date(e.ts).toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Seed Codex */}
            {showCodex && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowCodex(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-md p-10 shadow-2xl pointer-events-auto animate-reveal" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black italic tracking-tighter mb-1 text-slate-800">📚 种子图鉴</h2>
                        <p className="text-[10px] text-slate-400 mb-6">已解锁 {state.plantedSeedIds.length}/{SEEDS.length}</p>
                        <div className="grid grid-cols-2 gap-3">
                            {SEEDS.map(s => {
                                const unlocked = state.plantedSeedIds.includes(s.id);
                                return (
                                    <div key={s.id} className={`p-4 rounded-2xl border-2 text-center transition-all ${unlocked ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-40'}`}>
                                        <span className="text-3xl block mb-1">{unlocked ? s.emoji : '❓'}</span>
                                        <p className="text-[11px] font-black text-slate-700">{unlocked ? s.name : '???'}</p>
                                        {unlocked && <p className="text-[8px] text-slate-400 mt-1">产量:{s.yield} · 生长:{s.growthTime} · Lv.{s.unlockLevel || 1}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Theme Modal */}
            {showThemes && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-xl p-8" onClick={() => setShowThemes(false)}>
                    <div className="bg-white/95 rounded-[4rem] w-full max-w-sm p-10 shadow-2xl pointer-events-auto animate-reveal text-center" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-black italic tracking-tighter mb-6 text-slate-800">🎨 农场主题</h2>
                        <div className="space-y-3">
                            {FARM_THEMES.map(t => {
                                const isActive = state.farmTheme === t.id;
                                const owned = t.cost === 0 || isActive;
                                return (
                                    <button key={t.id} onClick={() => !isActive && (owned ? setState(pv => ({ ...pv, farmTheme: t.id })) : buyTheme(t.id))}
                                        className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${isActive ? `${t.border} bg-white ${t.ring} ring-4` : owned ? 'border-slate-200 hover:border-slate-400' : state.coins < t.cost ? 'opacity-40 border-slate-200' : 'border-slate-200 hover:border-amber-400'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{t.emoji}</span>
                                            <span className="font-black text-slate-700">{t.name}</span>
                                        </div>
                                        {isActive ? <span className="text-[10px] font-black text-emerald-500">✅ 使用中</span> : owned ? <span className="text-[10px] font-black text-sky-500">切换</span> : <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{t.cost}💰</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            .custom-scrollbar::-webkit-scrollbar {width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-thumb {background: rgba(0,0,0,0.05); border-radius: 10px; }
            @keyframes reveal {from {opacity: 0; transform: scale(0.9); } to {opacity: 1; transform: scale(1); } }
            .animate-reveal {animation: reveal 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            @keyframes harvest-float {0 % { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); } 100% {opacity: 0; transform: translateY(-120px) scale(0.3) rotate(360deg); } }
            .animate-harvest-float {animation: harvest-float 1.5s ease-out forwards; }
            @keyframes float-particle {0 %, 100 % { opacity: 0.3; transform: translate(0, 0); } 25% {opacity: 0.8; transform: translate(10px, -15px); } 50% {opacity: 0.5; transform: translate(-5px, -30px); } 75% {opacity: 0.7; transform: translate(15px, -15px); } }
            .animate-float-particle {animation: float-particle 4s ease-in-out infinite; }
            @keyframes wither {0 %, 100 % { transform: rotate(0deg); } 25% {transform: rotate(-5deg); } 75% {transform: rotate(5deg); } }
            .animate-wither {animation: wither 2s ease-in-out infinite; }
            @keyframes toast-slide {0 % { opacity: 0; transform: translate(-50 %, -20px); } 10% {opacity: 1; transform: translate(-50%, 0); } 90% {opacity: 1; transform: translate(-50%, 0); } 100% {opacity: 0; transform: translate(-50%, -20px); } }
            .animate-toast-slide {animation: toast-slide 4s ease-out forwards; }
            @keyframes achievement-pop {0 % { opacity: 0; transform: translate(-50 %, 30px) scale(0.8); } 20% {opacity: 1; transform: translate(-50%, 0) scale(1.05); } 30% {transform: translate(-50%, 0) scale(1); } 85% {opacity: 1; transform: translate(-50%, 0) scale(1); } 100% {opacity: 0; transform: translate(-50%, -10px) scale(0.9); } }
            .animate-achievement-pop {animation: achievement-pop 3.5s ease-out forwards; }
            @keyframes rain-drop {0 % { opacity: 0.7; transform: translateY(-10px); } 100% {opacity: 0; transform: translateY(100vh); } }
            .animate-rain-drop {animation: rain-drop linear infinite; }
            @keyframes snow-fall {0 % { opacity: 0.8; transform: translateY(-10px) translateX(0) rotate(0deg); } 50% {transform: translateY(50vh) translateX(30px) rotate(180deg); } 100% {opacity: 0; transform: translateY(100vh) translateX(-10px) rotate(360deg); } }
            .animate-snow-fall {animation: snow-fall linear infinite; }
            @keyframes thunder-flash {0 %, 30 %, 50 %, 70 %, 100 % { opacity: 0; } 10%, 40%, 60% {opacity: 0.6; } }
            .animate-thunder-flash {animation: thunder-flash 2s ease-out infinite; }
            @keyframes pet-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
            .animate-pet-bob { animation: pet-bob 1.5s ease-in-out infinite; }
            @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 30px rgba(251,191,36,0.5), 0 0 60px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 45px rgba(251,191,36,0.7), 0 0 90px rgba(251,191,36,0.3); } }
            .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
            @keyframes breathe { 0%, 100% { opacity: 0.08; transform: scale(1); } 50% { opacity: 0.2; transform: scale(1.1); } }
            .animate-breathe { animation: breathe 3s ease-in-out infinite; }
            @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .animate-spin-slow { animation: spin-slow 8s linear infinite; }
            `}</style>
        </div >
    );
};

export default ResearchFarm;
