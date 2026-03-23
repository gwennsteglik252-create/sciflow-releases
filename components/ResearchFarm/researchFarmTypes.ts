// ═══ ResearchFarm — Types, Constants & Utilities ═══
// 从 ResearchFarm.tsx 提取，保持主组件文件整洁

// ─── Types ──────────────────────────────────────────────────────────────────
export type PlotStatus = 'empty' | 'planted' | 'growing' | 'ready' | 'withered';
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'rain' | 'snow' | 'thunder' | null;
export interface Seed { id: string; name: string; emoji: string; color: string; glowColor: string; growthTime: number; yield: number; description: string; stages: string[]; icon?: string; unlockLevel?: number; }
export interface Plot { id: number; status: PlotStatus; seed: Seed | null; growthTick: number; waterLevel: number; fertLevel: number; shielded?: boolean; }
export interface ShopItem { id: string; name: string; emoji: string; description: string; price: number; effect: string; }
export interface InventoryItem { id: string; name: string; emoji: string; seedId: string; harvestedAt: number; yield: number; }
export interface DailyCheckin { lastDate: string; streak: number; totalDays: number; }
export interface FarmExpansion { rows: number; cols: number; }
export interface LabUpgrades { yieldBoost: number; waterRetention: number; autoHarvest: boolean; }
export interface Challenge { id: string; description: string; target: number; current: number; reward: number; type: 'harvest' | 'papers'; timeLeft: number; active: boolean; }
export interface JournalEntry { id: string; ts: number; text: string; emoji: string; }
export interface FarmState { plots: Plot[]; papers: number; patents: number; citations: number; coins: number; totalHarvests: number; events: GameEvent[]; level: number; xp: number; goals: ResearchGoal[]; achievements: Achievement[]; inventory: InventoryItem[]; boosts: { speedUp: number; shields: number; autoWater: number }; checkin: DailyCheckin; expansion: FarmExpansion; petActive: boolean; prestige: number; lastSeen: number; labUpgrades: LabUpgrades; mutations: number; journal: JournalEntry[]; plantedSeedIds: string[]; farmTheme: string; gachaCount: number; }
export interface GameEvent { id: string; type: 'success' | 'warning' | 'info' | 'danger'; message: string; ts: number; }
export interface ResearchGoal { id: string; description: string; target: number; current: number; reward: number; type: 'harvest' | 'papers' | 'coins'; completed: boolean; }
export interface Achievement { id: string; name: string; emoji: string; description: string; unlocked: boolean; unlockedAt?: number; }
export type ActionType = 'water' | 'fertilize' | 'weed' | 'harvest' | 'plant' | null;
export interface HarvestParticle { id: string; x: number; y: number; emoji: string; delay: number; }

// ─── Random Event Definitions ─────────────────────────────────────────────
export interface RandomEventDef { id: string; emoji: string; type: GameEvent['type']; message: string; probability: number; effect: (s: FarmState) => FarmState; }

export const RANDOM_EVENTS: RandomEventDef[] = [
    {
        id: 'reviewer_reject', emoji: '⛈️', type: 'danger', message: '⛈️ 审稿人拒稿！一株随机作物枯萎了...', probability: 0.08,
        effect: (s) => { const g = s.plots.filter(p => p.status === 'growing' || p.status === 'planted'); if (!g.length) return s; const t = g[Math.floor(Math.random() * g.length)]; const np = [...s.plots]; np[t.id] = { ...np[t.id], status: 'withered' }; return { ...s, plots: np }; }
    },
    {
        id: 'equipment_fail', emoji: '🔧', type: 'warning', message: '🔧 仪器故障！所有作物水分和肥料下降。', probability: 0.06,
        effect: (s) => ({ ...s, plots: s.plots.map(p => p.seed ? { ...p, waterLevel: Math.max(0, p.waterLevel - 30), fertLevel: Math.max(0, p.fertLevel - 20) } : p) })
    },
    {
        id: 'advisor_help', emoji: '☀️', type: 'success', message: '☀️ 导师指导！所有作物加速生长！', probability: 0.10,
        effect: (s) => ({ ...s, plots: s.plots.map(p => (p.status === 'planted' || p.status === 'growing') && p.seed ? { ...p, growthTick: Math.min(p.growthTick + 3, p.seed.growthTime) } : p) })
    },
    {
        id: 'inspiration', emoji: '💡', type: 'info', message: '💡 学术灵感迸发！一株作物瞬间成熟！', probability: 0.07,
        effect: (s) => { const g = s.plots.filter(p => p.status === 'growing' && p.seed); if (!g.length) return s; const t = g[Math.floor(Math.random() * g.length)]; const np = [...s.plots]; np[t.id] = { ...np[t.id], growthTick: np[t.id].seed!.growthTime, status: 'ready' }; return { ...s, plots: np }; }
    },
    { id: 'grant', emoji: '💰', type: 'success', message: '💰 国家自然科学基金拨款！经费 +20！', probability: 0.08, effect: (s) => ({ ...s, coins: s.coins + 20 }) },
    {
        id: 'rain', emoji: '🌧️', type: 'info', message: '🌧️ 天降甘霖！所有农田自动浇水！', probability: 0.10,
        effect: (s) => ({ ...s, plots: s.plots.map(p => p.seed ? { ...p, waterLevel: 100 } : p) })
    },
];

// ─── Achievements ────────────────────────────────────────────────────────
export const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlocked' | 'unlockedAt'>[] = [
    { id: 'first_harvest', name: '初次收获', emoji: '🌾', description: '完成第一次收获' },
    { id: 'full_farm', name: '满园春色', emoji: '🌸', description: '同时种满所有田地' },
    { id: 'paper_10', name: '学术新星', emoji: '⭐', description: '发表10篇论文' },
    { id: 'paper_50', name: '学术大牛', emoji: '🏆', description: '发表50篇论文' },
    { id: 'coins_200', name: '科研富翁', emoji: '💎', description: '累计拥有200经费' },
    { id: 'level_5', name: '资深研究员', emoji: '🎓', description: '达到5级' },
    { id: 'mutation_1', name: '基因突变', emoji: '🧬', description: '获得第一次作物变异' },
    { id: 'mutation_5', name: '变异大师', emoji: '🦖', description: '获得5次作物变异' },
    { id: 'prestige_1', name: '毕业校友', emoji: '🎖️', description: '完成第一次毕业重生' },
    { id: 'checkin_7', name: '签到之星', emoji: '📅', description: '累计签到7天' },
    { id: 'expand_1', name: '扩建先锋', emoji: '🏗️', description: '第一次扩建农场' },
    { id: 'harvest_50', name: '丰收女神', emoji: '👑', description: '累计收获50次' },
];
export const INITIAL_ACHIEVEMENTS: Achievement[] = ACHIEVEMENT_DEFS.map(a => ({ ...a, unlocked: false }));

// ─── Time of Day ─────────────────────────────────────────────────────────
export const getTimeOfDay = (): TimeOfDay => { const h = new Date().getHours(); if (h >= 5 && h < 10) return 'dawn'; if (h >= 10 && h < 17) return 'day'; if (h >= 17 && h < 20) return 'sunset'; return 'night'; };
export const TIME_OF_DAY_CONFIG: Record<TimeOfDay, { bg: string; label: string; emoji: string; overlay: string }> = {
    dawn: { bg: '/assets/farm/background_dawn.png', label: '清晨', emoji: '🌅', overlay: 'rgba(255,200,150,0.08)' },
    day: { bg: '/assets/farm/background_daytime.png', label: '白天', emoji: '☀️', overlay: 'transparent' },
    sunset: { bg: '/assets/farm/background_sunset.png', label: '黄昏', emoji: '🌇', overlay: 'rgba(255,120,50,0.10)' },
    night: { bg: '/assets/farm/background_night.png', label: '夜晚', emoji: '🌙', overlay: 'rgba(20,30,80,0.15)' },
};

// ─── Constants ───────────────────────────────────────────────────────────
export const SEEDS: Seed[] = [
    { id: 'xrd', name: 'XRD 晶种', emoji: '💎', color: '#06b6d4', glowColor: 'rgba(6,182,212,0.4)', growthTime: 8, yield: 3, description: '生长快，产出稳定', stages: ['🌱', '🌿', '💎', '✨'], icon: '/assets/farm/seed_xrd.png' },
    { id: 'nano', name: '纳米复合种', emoji: '🔬', color: '#8b5cf6', glowColor: 'rgba(139,92,246,0.4)', growthTime: 12, yield: 5, description: '需要大量施肥', stages: ['🌱', '🧪', '🔬', '✨'], icon: '/assets/farm/seed_nano.png', unlockLevel: 2 },
    { id: 'bio', name: '生物医药苗', emoji: '🧬', color: '#10b981', glowColor: 'rgba(16,185,129,0.4)', growthTime: 16, yield: 7, description: '专利价值极高', stages: ['🌱', '🌿', '🧬', '✨'], icon: '/assets/farm/seed_bio.png', unlockLevel: 3 },
    { id: 'ai', name: 'AI 模型种', emoji: '🤖', color: '#f43f5e', glowColor: 'rgba(244,63,94,0.4)', growthTime: 6, yield: 4, description: '极快生长易枯萎', stages: ['🌱', '💡', '🤖', '✨'], icon: '/assets/farm/seed_ai.png' },
    { id: 'catalyst', name: '催化剂苗', emoji: '⚗️', color: '#f59e0b', glowColor: 'rgba(245,158,11,0.4)', growthTime: 14, yield: 6, description: '高影响因子论文', stages: ['🌱', '🪴', '⚗️', '✨'], unlockLevel: 4 },
    { id: 'quantum', name: '量子晶元', emoji: '⚛️', color: '#6366f1', glowColor: 'rgba(99,102,241,0.4)', growthTime: 20, yield: 10, description: '稀有极难培育', stages: ['🌱', '🌀', '⚛️', '✨'], unlockLevel: 5 },
];

export const SHOP_ITEMS: ShopItem[] = [
    { id: 'speed_boost', name: '生长加速器', emoji: '⚡', description: '所有作物生长速度翻倍，持续60秒', price: 25, effect: 'speedUp' },
    { id: 'shield', name: '防枯萎保护罩', emoji: '🛡️', description: '保护一块田免受下一次灾害', price: 15, effect: 'shield' },
    { id: 'auto_water', name: '自动灌溉系统', emoji: '🚿', description: '全田浇水并施肥一次', price: 20, effect: 'autoWater' },
];

export const STORAGE_KEY = 'sciflow_research_farm_v16';
export const DEFAULT_COLS = 4; export const DEFAULT_ROWS = 3; export const TICK_MS = 2500;
export const makePlot = (id: number): Plot => ({ id, status: 'empty', seed: null, growthTick: 0, waterLevel: 60, fertLevel: 60, shielded: false });
export const XP_PER_LEVEL = 20;

export const EXPANSION_TIERS = [
    { rows: 3, cols: 4, label: '3×4 基础田', cost: 0 },
    { rows: 4, cols: 4, label: '4×4 扩建', cost: 80 },
    { rows: 4, cols: 5, label: '4×5 大农场', cost: 200 },
];

export const CHECKIN_REWARDS = [5, 8, 12, 15, 20, 25, 35]; // Day 1-7 rewards
export const PRESTIGE_BONUS = 0.15; // +15% growth per prestige level
export const PRESTIGE_MIN_LEVEL = 5; // Min level to prestige
export const MUTATION_CHANCE = 0.1; // 10% chance

export const LAB_UPGRADES_SHOP = [
    { id: 'yieldBoost', name: '产量加成器', emoji: '📈', description: '收获产量+1（可叠加3次）', price: 60, max: 3 },
    { id: 'waterRetention', name: '保水胜地', emoji: '💧', description: '水分消耗速度-30%（可叠加2次）', price: 50, max: 2 },
    { id: 'autoHarvest', name: '自动收割机', emoji: '🪓', description: '成熟作物自动收获', price: 150, max: 1 },
];

export const CHALLENGE_TEMPLATES = [
    { description: '60秒内收获3次', target: 3, reward: 30, type: 'harvest' as const, time: 60 },
    { description: '90秒内发表10篇论文', target: 10, reward: 50, type: 'papers' as const, time: 90 },
    { description: '45秒内收获2次', target: 2, reward: 20, type: 'harvest' as const, time: 45 },
];

export const INITIAL_GOALS: ResearchGoal[] = [
    { id: 'g1', description: '收获 5 次农作物', target: 5, current: 0, reward: 15, type: 'harvest', completed: false },
    { id: 'g2', description: '发表 10 篇论文', target: 10, current: 0, reward: 25, type: 'papers', completed: false },
    { id: 'g3', description: '赚取 100 经费', target: 100, current: 0, reward: 20, type: 'coins', completed: false },
];

export const GACHA_COST = 30;
export const GACHA_POOL = [
    { name: '小额经费', emoji: '💰', weight: 30, effect: (s: FarmState) => ({ ...s, coins: s.coins + 15 }), msg: '+15💰' },
    { name: '大额经费', emoji: '💰', weight: 10, effect: (s: FarmState) => ({ ...s, coins: s.coins + 50 }), msg: '+50💰' },
    { name: '经验包', emoji: '⭐', weight: 20, effect: (s: FarmState) => { let xp = s.xp + 15, lv = s.level; while (xp >= XP_PER_LEVEL) { xp -= XP_PER_LEVEL; lv++; } return { ...s, xp, level: lv }; }, msg: '+15 XP' },
    { name: '全田浇水', emoji: '💧', weight: 15, effect: (s: FarmState) => ({ ...s, plots: s.plots.map(p => p.seed ? { ...p, waterLevel: 100 } : p) }), msg: '全田满水' },
    { name: '变异催化', emoji: '🧬', weight: 8, effect: (s: FarmState) => ({ ...s, mutations: s.mutations + 1 }), msg: '+1 变异计数' },
    { name: '空奖', emoji: '💨', weight: 17, effect: (s: FarmState) => s, msg: '什么都没有...' },
];

export const FARM_THEMES = [
    { id: 'default', name: '默认', emoji: '🌿', cost: 0, border: 'border-emerald-400', ring: 'ring-emerald-300/20' },
    { id: 'sakura', name: '樱花', emoji: '🌸', cost: 100, border: 'border-pink-400', ring: 'ring-pink-300/20' },
    { id: 'ocean', name: '海洋', emoji: '🌊', cost: 120, border: 'border-cyan-400', ring: 'ring-cyan-300/20' },
    { id: 'gold', name: '黄金', emoji: '🌟', cost: 200, border: 'border-amber-400', ring: 'ring-amber-300/20' },
];

export const initState = (): FarmState => {
    const defaultExp = { rows: DEFAULT_ROWS, cols: DEFAULT_COLS };
    const defaultCheckin: DailyCheckin = { lastDate: '', streak: 0, totalDays: 0 };
    try {
        const s = localStorage.getItem(STORAGE_KEY);
        if (s) {
            const p = JSON.parse(s);
            if (!p.achievements) p.achievements = INITIAL_ACHIEVEMENTS;
            if (!p.inventory) p.inventory = [];
            if (!p.boosts) p.boosts = { speedUp: 0, shields: 0, autoWater: 0 };
            if (!p.checkin) p.checkin = defaultCheckin;
            if (!p.expansion) p.expansion = defaultExp;
            if (p.petActive === undefined) p.petActive = false;
            if (p.prestige === undefined) p.prestige = 0;
            if (!p.lastSeen) p.lastSeen = Date.now();
            if (!p.labUpgrades) p.labUpgrades = { yieldBoost: 0, waterRetention: 0, autoHarvest: false };
            if (p.mutations === undefined) p.mutations = 0;
            if (!p.journal) p.journal = [];
            if (!p.plantedSeedIds) p.plantedSeedIds = [];
            if (!p.farmTheme) p.farmTheme = 'default';
            if (p.gachaCount === undefined) p.gachaCount = 0;
            return p;
        }
    } catch { }
    const total = DEFAULT_COLS * DEFAULT_ROWS;
    const defaultLab: LabUpgrades = { yieldBoost: 0, waterRetention: 0, autoHarvest: false };
    return { plots: Array.from({ length: total }, (_, i) => makePlot(i)), papers: 0, patents: 0, citations: 0, coins: 30, totalHarvests: 0, events: [], level: 1, xp: 0, goals: INITIAL_GOALS, achievements: INITIAL_ACHIEVEMENTS, inventory: [], boosts: { speedUp: 0, shields: 0, autoWater: 0 }, checkin: defaultCheckin, expansion: defaultExp, petActive: false, prestige: 0, lastSeen: Date.now(), labUpgrades: defaultLab, mutations: 0, journal: [], plantedSeedIds: [], farmTheme: 'default', gachaCount: 0 };
};

