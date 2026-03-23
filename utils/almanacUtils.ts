/**
 * almanacUtils.ts
 * 科研黄历 - 国际化重构版
 */

// ─── 天干地支 ───────────────────────────────────────────────
export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 五行映射为 i18n key
export const FIVE_ELEMENTS: Record<string, string> = {
    甲: 'wood', 乙: 'wood', 丙: 'fire', 丁: 'fire', 戊: 'earth',
    己: 'earth', 庚: 'metal', 辛: 'metal', 壬: 'water', 癸: 'water',
};
export const BRANCH_ELEMENTS: Record<string, string> = {
    子: 'water', 丑: 'earth', 寅: 'wood', 卯: 'wood', 辰: 'earth', 巳: 'fire',
    午: 'fire', 未: 'earth', 申: 'metal', 酉: 'metal', 戌: 'earth', 亥: 'water',
};

// ─── 科研实验类别 ─────────────────────────────────────────
export interface ExperimentCategory {
    key: string;
    labelKey: string; // i18n 路径: almanac.categories.xxx
    icon: string;
    element: string; // wood, fire, etc.
    color: string;
    bgColor: string;
}

export const EXPERIMENT_CATEGORIES: ExperimentCategory[] = [
    { key: 'electrochem', labelKey: 'almanac.categories.electrochem', icon: 'fa-bolt', element: 'water', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { key: 'synthesis', labelKey: 'almanac.categories.synthesis', icon: 'fa-flask', element: 'metal', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { key: 'characterization', labelKey: 'almanac.categories.characterization', icon: 'fa-microscope', element: 'earth', color: 'text-slate-600', bgColor: 'bg-slate-50' },
    { key: 'computational', labelKey: 'almanac.categories.computational', icon: 'fa-computer', element: 'wood', color: 'text-green-600', bgColor: 'bg-green-50' },
    { key: 'data_analysis', labelKey: 'almanac.categories.data_analysis', icon: 'fa-chart-line', element: 'wood', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { key: 'literature', labelKey: 'almanac.categories.literature', icon: 'fa-book-open', element: 'wood', color: 'text-violet-600', bgColor: 'bg-violet-50' },
    { key: 'writing', labelKey: 'almanac.categories.writing', icon: 'fa-pen-nib', element: 'metal', color: 'text-rose-600', bgColor: 'bg-rose-50' },
    { key: 'performance', labelKey: 'almanac.categories.performance', icon: 'fa-gauge-high', element: 'fire', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { key: 'preparation', labelKey: 'almanac.categories.preparation', icon: 'fa-vials', element: 'earth', color: 'text-teal-600', bgColor: 'bg-teal-50' },
    { key: 'spectroscopy', labelKey: 'almanac.categories.spectroscopy', icon: 'fa-waveform-lines', element: 'fire', color: 'text-pink-600', bgColor: 'bg-pink-50' },
];

// ─── 元素相生相克 ─────────────────────────────────────────
// 相生: 木→火→土→金→水→木
// 相克: 木克土, 土克水, 水克火, 火克金, 金克木
const GENERATES: Record<string, string> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const OVERCOMES: Record<string, string> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

// ─── 农历换算 ────────────────────────────────────────
// 以1900年1月31日为农历正月初一庚子年基准
const BASE_DATE = new Date(1900, 0, 31);
const BASE_STEM = 6;   // 庚 (index 6)
const BASE_BRANCH = 0; // 子 (index 0)

function getDaysSinceBase(date: Date): number {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((d.getTime() - BASE_DATE.getTime()) / (1000 * 60 * 60 * 24));
}

export interface GanZhi {
    stemIdx: number;
    branchIdx: number;
    stem: string; // 保持原始字符作为 key
    branch: string;
    element: string; // wood, fire...
    branchElement: string;
    fullName: string;
}

export function getDayGanZhi(date: Date): GanZhi {
    const days = getDaysSinceBase(date);
    const stemIdx = ((BASE_STEM + days) % 10 + 10) % 10;
    const branchIdx = ((BASE_BRANCH + days) % 12 + 12) % 12;
    const stem = HEAVENLY_STEMS[stemIdx];
    const branch = EARTHLY_BRANCHES[branchIdx];
    return {
        stemIdx, branchIdx, stem, branch,
        element: FIVE_ELEMENTS[stem],
        branchElement: BRANCH_ELEMENTS[branch],
        fullName: `${stem}${branch}`,
    };
}

export type LuckLevelKey = 'greatLuck' | 'goodLuck' | 'neutral' | 'badLuck' | 'greatBadLuck';

export interface LuckInfo {
    luckKey: LuckLevelKey;
    score: number; // 0-100
    color: string;
    bgColor: string;
    gradient: string;
    emoji: string;
}

export function getLuckInfo(luckKey: LuckLevelKey): LuckInfo {
    switch (luckKey) {
        case 'greatLuck': return { luckKey, score: 90, color: 'text-red-600', bgColor: 'bg-red-50', gradient: 'from-red-600 to-amber-500', emoji: '🔴' };
        case 'goodLuck': return { luckKey, score: 70, color: 'text-amber-600', bgColor: 'bg-amber-50', gradient: 'from-amber-500 to-yellow-400', emoji: '🟡' };
        case 'neutral': return { luckKey, score: 50, color: 'text-slate-500', bgColor: 'bg-slate-50', gradient: 'from-slate-400 to-slate-300', emoji: '⚪' };
        case 'badLuck': return { luckKey, score: 30, color: 'text-indigo-700', bgColor: 'bg-indigo-50', gradient: 'from-indigo-600 to-blue-500', emoji: '🔵' };
        case 'greatBadLuck': return { luckKey, score: 10, color: 'text-slate-900', bgColor: 'bg-slate-100', gradient: 'from-slate-900 to-slate-700', emoji: '⚫' };
    }
}

export function getSimpleLunarDate(date: Date): { monthIdx: number; day: number } {
    const days = getDaysSinceBase(date);
    // 农历月约29.5天
    const lunarDay = (days % 30) + 1;
    const lunarMonth = Math.floor(days / 30) % 12;
    return {
        monthIdx: lunarMonth,
        day: lunarDay,
    };
}

// ─── 年份天干地支（用于界面展示）───────────────────────────
export function getYearGanZhi(year: number): { stemIdx: number; branchIdx: number } {
    const stemIdx = ((year - 4) % 10 + 10) % 10;
    const branchIdx = ((year - 4) % 12 + 12) % 12;
    return { stemIdx, branchIdx };
}

// ─── 月份地支（简化）───────────────────────────────────────
const MONTH_BRANCH_IDX: Record<number, number> = {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7,
    7: 8, 8: 9, 9: 10, 10: 11, 11: 0, 12: 1,
};

// ─── 当日整体吉凶判断 ────────────────────────────────────
export interface DailyOmen {
    ganZhi: GanZhi;
    lunarDate: { monthIdx: number; day: number };
    yearGanZhi: { stemIdx: number; branchIdx: number };
    monthBranchIdx: number;
    luckKey: LuckLevelKey;
    luckInfo: LuckInfo;
    auspicious: ExperimentCategory[];  // 宜
    inauspicious: ExperimentCategory[]; // 忌
    moderates: ExperimentCategory[];   // 平
    dayElement: string;                // 今日主五行 (wood, fire...)
    quoteIdx: number;                  // 科研寄语索引
}

// 字符串哈希（确定性）
function hashDate(date: Date): number {
    const str = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

export function getDailyOmen(date: Date): DailyOmen {
    const ganZhi = getDayGanZhi(date);
    const lunarDate = getSimpleLunarDate(date);
    const yearGanZhi = getYearGanZhi(date.getFullYear());
    const monthBranchIdx = MONTH_BRANCH_IDX[date.getMonth() + 1] || 2; // Default to寅 (index 2)
    const h = hashDate(date);

    // 今日主五行：天干五行与地支五行加权
    const stemEl = ganZhi.element;

    // 吉凶判断：基于哈希 + 五行相生相克
    // 天干地支组合共60种，分布于5个等级
    const ganZhiIndex = ganZhi.stemIdx * 12 + ganZhi.branchIdx;
    const luckRaw = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3][ganZhiIndex % 60];
    const luckKeys: LuckLevelKey[] = ['greatBadLuck', 'badLuck', 'neutral', 'goodLuck', 'greatLuck'];
    const luckKey = luckKeys[luckRaw];
    const luckInfo = getLuckInfo(luckKey);

    // 宜忌分配：基于五行相生相克
    const generated = GENERATES[stemEl]; // 天干生出的五行（宜）
    const overcome = OVERCOMES[stemEl];  // 天干克制的五行（忌）

    const auspicious: ExperimentCategory[] = [];
    const inauspicious: ExperimentCategory[] = [];
    const moderates: ExperimentCategory[] = [];

    EXPERIMENT_CATEGORIES.forEach(cat => {
        if (cat.element === stemEl || cat.element === generated) {
            auspicious.push(cat);
        } else if (cat.element === overcome) {
            inauspicious.push(cat);
        } else {
            moderates.push(cat);
        }
    });

    // 洗牌（确定性）以增加多样性
    const shuffleWithHash = <T>(arr: T[], seed: number): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = (seed * (i + 1) * 2654435761) % (i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    const quoteIdx = h % 15; // Assuming 15 quotes for now

    return {
        ganZhi,
        lunarDate,
        yearGanZhi,
        monthBranchIdx,
        luckKey,
        luckInfo,
        auspicious: shuffleWithHash(auspicious, h).slice(0, 3),
        inauspicious: shuffleWithHash(inauspicious, h + 1).slice(0, 2),
        moderates: shuffleWithHash(moderates, h + 2).slice(0, 3),
        dayElement: stemEl,
        quoteIdx,
    };
}

// ─── 单个任务适宜度评分 ─────────────────────────────────────
export interface TaskAuspiciousness {
    stars: number; // 1-5
    labelKey: string; // almanac.luckLevels.greatLuck, almanac.auspicious, almanac.moderate, almanac.careful, almanac.inauspicious
    reasonKey: string; // almanac.reasons.auspicious, etc.
    color: string;
    bgColor: string;
}

// 根据任务标题 + 今日五行，计算任务适宜度
export function getTaskAuspiciousness(taskTitle: string, omen: DailyOmen, taskHash: number): TaskAuspiciousness {
    const lower = taskTitle.toLowerCase();

    // 关键词映射到实验类别
    const keywordMap: { keywords: string[]; catKey: string }[] = [
        {
            keywords: ['电化学', 'lsv', 'cv', 'eis', 'oer', 'her', 'orr', '析氧', '析氢', '氧还原', '氢还原', '电池', '电解', '电镀', '电催化', '电极', '电位', '电流', '循环伏安', '阻抗谱'],
            catKey: 'electrochem',
        },
        {
            keywords: ['合成', '水热', '溶剂热', '煅烧', '还原', '沉积', '共沉淀', '溶胶凝胶', '化学气相', '物理气相', '生长', '制备', '掺杂', '修饰', '复合', '组装', '聚合', '结晶', '退火', '烧结'],
            catKey: 'synthesis',
        },
        {
            keywords: ['xrd', 'tem', 'sem', 'xps', '表征', '形貌', '结构', '元素', '成分', '尺寸', '孔径', '比表面', '拉曼', 'ftir', 'esr', 'afm', 'stm', 'bet', 'tga', 'dsc', 'icp', 'gc-ms', 'lc-ms', 'edx', 'saed', 'hr-tem', 'stem', 'eels', 'eds', 'mapping'],
            catKey: 'characterization',
        },
        {
            keywords: ['dft', '计算', '模拟', 'first principle', 'vasp', 'gaussian', 'md', '分子动力学', '有限元', '密度泛函', '理论', '建模', '量子化学', '蒙特卡洛'],
            catKey: 'computational',
        },
        {
            keywords: ['数据', '分析', '处理', '统计', '作图', 'origin', 'matlab', 'python', 'r语言', '机器学习', '深度学习', '回归', '分类', '聚类', '可视化', '拟合', '曲线', '图谱', '谱图'],
            catKey: 'data_analysis',
        },
        {
            keywords: ['文献', '阅读', '综述', '调研', '检索', '查阅', '引用', '参考', '期刊', '专利', '报告', '书籍', '论文', '引言', '讨论', '结论'],
            catKey: 'literature',
        },
        {
            keywords: ['写作', '撰写', '投稿', '摘要', '论文', '初稿', '终稿', '定稿', '改稿', '提纲', '正文', '讨论部分'],
            catKey: 'writing',
        },
        {
            keywords: ['性能', '评测', '稳定性', '循环', '耐久', '法拉第', '效率', 'fee', 'toe',
                '催化性能', '催化活性', '活性测试', '活性评价', '选择性', '产率', '转化率',
                '反应速率', 'tof', 'turnover', '过电位', '电流密度', '质量活性',
                '比活性', '抗中毒', '寿命', '耐久性测试', '加速老化'],
            catKey: 'performance',
        },
        {
            keywords: ['样品', '前处理', '研磨', '过滤', '离心', '烘干', '称量', '配液', '超声',
                '制样', '前驱体', '洗涤', '转移', '干燥', '研磨制样', '压片', '切片',
                '抛光', '刻蚀', '清洗', '封装', '组装', '裁剪', '涂膜', '滴涂'],
            catKey: 'preparation',
        },
        {
            keywords: ['光谱', 'uv', '紫外', '红外', '荧光', '核磁', 'nmr', 'epr', '穆斯堡尔',
                'uv-vis', '吸收光谱', '发射光谱', '激发光谱', 'pl', '光致发光',
                'ir', 'atr', '近红外', '可见光', '漫反射', 'diffuse reflectance'],
            catKey: 'spectroscopy',
        },
    ];

    let matchedCatKey: string | null = null;
    for (const { keywords, catKey } of keywordMap) {
        if (keywords.some(kw => lower.includes(kw))) {
            matchedCatKey = catKey;
            break;
        }
    }

    // 判断该任务是否在宜/忌/平列表中
    if (matchedCatKey) {
        const isAuspicious = omen.auspicious.some(c => c.key === matchedCatKey);
        const isInauspicious = omen.inauspicious.some(c => c.key === matchedCatKey);

        if (isAuspicious) {
            const stars = 4 + (taskHash % 2); // 4 or 5
            return {
                stars,
                labelKey: stars === 5 ? 'luckLevels.greatLuck' : 'auspicious',
                reasonKey: 'reasons.auspicious',
                color: 'text-red-600',
                bgColor: 'bg-red-50 border-red-200',
            };
        }
        if (isInauspicious) {
            const stars = 1 + (taskHash % 2); // 1 or 2
            return {
                stars,
                labelKey: stars === 1 ? 'inauspicious' : 'careful',
                reasonKey: 'reasons.inauspicious',
                color: 'text-slate-600',
                bgColor: 'bg-slate-50 border-slate-200',
            };
        }
    }

    // 未匹配关键词或处于平级：基于哈希给出平分
    const baseStars = 2 + (taskHash % 3); // 2, 3, or 4
    const labels = ['careful', 'moderate', 'moderate', 'auspicious'];
    return {
        stars: baseStars,
        labelKey: labels[baseStars - 2] || 'moderate',
        reasonKey: 'reasons.neutral',
        color: baseStars >= 3 ? 'text-amber-600' : 'text-slate-500',
        bgColor: baseStars >= 3 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200',
    };
}

// 简单哈希：用于任务级别的确定性随机
export function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}
