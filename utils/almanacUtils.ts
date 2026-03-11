/**
 * almanacUtils.ts
 * 科研黄历 - 玄学实验吉凶判断系统
 * 基于传统农历天干地支体系，结合科研情境，提供每日实验宜忌判断。
 * 所有结果均为确定性哈希计算，同一日期结果一致。
 */

// ─── 天干地支 ───────────────────────────────────────────────
export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const FIVE_ELEMENTS: Record<string, string> = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
export const BRANCH_ELEMENTS: Record<string, string> = {
    子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
    午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

// ─── 科研实验类别 ─────────────────────────────────────────
export interface ExperimentCategory {
    key: string;
    label: string;
    icon: string; // FontAwesome class
    element: string; // 五行属性
    color: string;
    bgColor: string;
}

export const EXPERIMENT_CATEGORIES: ExperimentCategory[] = [
    { key: 'electrochem', label: '电化学测试', icon: 'fa-bolt', element: '水', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { key: 'synthesis', label: '催化剂合成', icon: 'fa-flask', element: '金', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { key: 'characterization', label: '表征测试 (XRD/TEM)', icon: 'fa-microscope', element: '土', color: 'text-slate-600', bgColor: 'bg-slate-50' },
    { key: 'computational', label: '计算模拟 (DFT)', icon: 'fa-computer', element: '木', color: 'text-green-600', bgColor: 'bg-green-50' },
    { key: 'data_analysis', label: '数据分析', icon: 'fa-chart-line', element: '木', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { key: 'literature', label: '文献调研', icon: 'fa-book-open', element: '木', color: 'text-violet-600', bgColor: 'bg-violet-50' },
    { key: 'writing', label: '论文撰写', icon: 'fa-pen-nib', element: '金', color: 'text-rose-600', bgColor: 'bg-rose-50' },
    { key: 'performance', label: '性能评测', icon: 'fa-gauge-high', element: '火', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { key: 'preparation', label: '样品制备', icon: 'fa-vials', element: '土', color: 'text-teal-600', bgColor: 'bg-teal-50' },
    { key: 'spectroscopy', label: '光谱分析', icon: 'fa-waveform-lines', element: '火', color: 'text-pink-600', bgColor: 'bg-pink-50' },
];

// ─── 元素相生相克 ─────────────────────────────────────────
// 相生: 木→火→土→金→水→木
// 相克: 木克土, 土克水, 水克火, 火克金, 金克木
const GENERATES: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const OVERCOMES: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// ─── 农历换算（简化算法）────────────────────────────────
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
    stem: string;
    branch: string;
    element: string;
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

export type LuckLevel = '大吉' | '吉' | '平' | '凶' | '大凶';

export interface LuckInfo {
    level: LuckLevel;
    score: number; // 0-100
    color: string;
    bgColor: string;
    gradient: string;
    emoji: string;
}

export function getLuckInfo(level: LuckLevel): LuckInfo {
    switch (level) {
        case '大吉': return { level, score: 90, color: 'text-red-600', bgColor: 'bg-red-50', gradient: 'from-red-600 to-amber-500', emoji: '🔴' };
        case '吉': return { level, score: 70, color: 'text-amber-600', bgColor: 'bg-amber-50', gradient: 'from-amber-500 to-yellow-400', emoji: '🟡' };
        case '平': return { level, score: 50, color: 'text-slate-500', bgColor: 'bg-slate-50', gradient: 'from-slate-400 to-slate-300', emoji: '⚪' };
        case '凶': return { level, score: 30, color: 'text-indigo-700', bgColor: 'bg-indigo-50', gradient: 'from-indigo-600 to-blue-500', emoji: '🔵' };
        case '大凶': return { level, score: 10, color: 'text-slate-900', bgColor: 'bg-slate-100', gradient: 'from-slate-900 to-slate-700', emoji: '⚫' };
    }
}

// ─── 简化农历月日 ────────────────────────────────────────
const LUNAR_MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAY_TENS = ['初', '十', '廿', '三'];
const LUNAR_DAY_ONES = ['日', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function getLunarDayName(day: number): string {
    if (day <= 0 || day > 30) return '初一';
    const ten = Math.floor((day - 1) / 10);
    const one = day % 10;
    if (day === 10) return '初十';
    if (day === 20) return '二十';
    if (day === 30) return '三十';
    return LUNAR_DAY_TENS[ten] + LUNAR_DAY_ONES[one];
}

// 极简农历估算（仅用于界面展示，精度适合玄学场景）
export function getSimpleLunarDate(date: Date): { month: string; day: string } {
    const days = getDaysSinceBase(date);
    // 农历月约29.5天
    const lunarDay = (days % 30) + 1;
    const lunarMonth = Math.floor(days / 30) % 12;
    return {
        month: LUNAR_MONTH_NAMES[lunarMonth] + '月',
        day: getLunarDayName(lunarDay),
    };
}

// ─── 年份天干地支（用于界面展示）───────────────────────────
export function getYearGanZhi(year: number): string {
    const stemIdx = ((year - 4) % 10 + 10) % 10;
    const branchIdx = ((year - 4) % 12 + 12) % 12;
    return HEAVENLY_STEMS[stemIdx] + EARTHLY_BRANCHES[branchIdx];
}

// ─── 月份天干（简化）───────────────────────────────────────
const MONTH_GAN: Record<number, string> = {
    1: '寅', 2: '卯', 3: '辰', 4: '巳', 5: '午', 6: '未',
    7: '申', 8: '酉', 9: '戌', 10: '亥', 11: '子', 12: '丑',
};

// ─── 当日整体吉凶判断 ────────────────────────────────────
export interface DailyOmen {
    ganZhi: GanZhi;
    lunarDate: { month: string; day: string };
    yearGanZhi: string;
    monthBranch: string;
    luck: LuckLevel;
    luckInfo: LuckInfo;
    auspicious: ExperimentCategory[];  // 宜
    inauspicious: ExperimentCategory[]; // 忌
    moderates: ExperimentCategory[];   // 平
    dayElement: string;                // 今日主五行
    quote: string;                     // 科研寄语
}

const SCIENCE_QUOTES = [
    '今日元气充盈，仪器精神，数据当顺吐真言。',
    '磁场和谐，电子乖顺，催化之道可循天机。',
    '今日水火相济，实验炉火纯青，成果可期。',
    '万物生长，如芽初萌，今日合成之功倍于往常。',
    '金木交融，表征之像清晰，毫末可辨。',
    '今日宜静不宜动，数值分析胜于操作。',
    '天地玄黄，数据宇宙洪荒，计算模拟当大展宏图。',
    '今日阴阳调和，论文笔墨顺达，审稿官或开颜。',
    '水克火之日，冷却系统护佑，高温实验慎之又慎。',
    '金日刚毅，研磨之功不虚，表面处理大吉。',
    '木日生机，创新思维勃发，假设推演宜今日。',
    '火日炽烈，反应活性高涨，催化转化率或破纪录。',
    '土日厚重，基础数据采集，测量精准如泰山稳固。',
    '今日星象利于深度阅读，文献之海任遨游。',
    '阴阳之交，正负极平衡，电化学循环伏安大吉。',
];

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
    const monthBranch = MONTH_GAN[date.getMonth() + 1] || '寅';
    const h = hashDate(date);

    // 今日主五行：天干五行与地支五行加权
    const stemEl = ganZhi.element;
    const branchEl = ganZhi.branchElement;

    // 吉凶判断：基于哈希 + 五行相生相克
    // 天干地支组合共60种，分布于5个等级
    const ganZhiIndex = ganZhi.stemIdx * 12 + ganZhi.branchIdx;
    const luckRaw = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3][ganZhiIndex % 60];
    const luckLevels: LuckLevel[] = ['大凶', '凶', '平', '吉', '大吉'];
    const luck = luckLevels[luckRaw];
    const luckInfo = getLuckInfo(luck);

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

    const quoteIdx = h % SCIENCE_QUOTES.length;
    const quote = SCIENCE_QUOTES[quoteIdx];

    return {
        ganZhi,
        lunarDate,
        yearGanZhi,
        monthBranch,
        luck,
        luckInfo,
        auspicious: shuffleWithHash(auspicious, h).slice(0, 3),
        inauspicious: shuffleWithHash(inauspicious, h + 1).slice(0, 2),
        moderates: shuffleWithHash(moderates, h + 2).slice(0, 3),
        dayElement: stemEl,
        quote,
    };
}

// ─── 单个任务适宜度评分 ─────────────────────────────────────
export type AuspiciousnessLabel = '大吉' | '宜' | '平' | '慎' | '忌';
export interface TaskAuspiciousness {
    stars: number; // 1-5
    label: AuspiciousnessLabel;
    reason: string;
    color: string;
    bgColor: string;
}

// 根据任务标题 + 今日五行，计算任务适宜度
export function getTaskAuspiciousness(taskTitle: string, omen: DailyOmen, taskHash: number): TaskAuspiciousness {
    const lower = taskTitle.toLowerCase();

    // 关键词映射到实验类别
    const keywordMap: { keywords: string[]; catKey: string }[] = [
        {
            keywords: ['电化学', 'lsv', 'cv', 'eis', 'chronoamperometry', '极化', '塔菲尔', 'oer', 'her', 'orr',
                '电位', '电流', '半波', '过电位', '电解', '析氢', '析氧', '法拉第效率', '阴极', '阳极',
                '电解槽', '隔膜', '电极', '恒电位', '线性扫描', '交流阻抗'],
            catKey: 'electrochem',
        },
        {
            keywords: ['合成', '水热', '溶剂热', '煅烧', '还原', '沉积', 'cvd', 'pvd', '电镀', '涂覆', '浸渍',
                '共沉淀', '工艺', '流程', '优化工艺', '工艺优化', '工艺流程', '烧结', '热处理', '退火',
                'ald', '原子层沉积', '磁控溅射', '溅射', '蒸镀', '湿化学', '溶液法', '喷涂',
                '热解', '碳化', '氮化', '磷化', '硫化', '氧化', '功能化', '修饰', '负载'],
            catKey: 'synthesis',
        },
        {
            keywords: ['xrd', 'tem', 'sem', 'xps', 'bet', 'tga', '表征', '形貌', '晶体', '结构',
                'eels', 'eds', '拉曼', 'ftir', 'afm', 'stm', 'hrtem', 'haadf', 'stem',
                '衍射', '谱图', '能谱', '映射', 'mapping', '分辨率', '微结构', '微观'],
            catKey: 'characterization',
        },
        {
            keywords: ['dft', '计算', '模拟', '第一性原理', 'vasp', 'gaussian', '能垒', 'neb',
                '吸附能', '密度泛函', 'cp2k', 'qe', 'quantum espresso', '分子动力学', 'md',
                '过渡态', '反应路径', '电子结构', '态密度', '能带', 'dos', '费米'],
            catKey: 'computational',
        },
        {
            keywords: ['数据', '分析', '处理', '统计', '作图', 'origin', '拟合', '回归', '归一化',
                '误差', '整理', '后处理', 'pipeline', '数据处理', '数据整理', '图表',
                '可视化', 'python', 'matlab', 'excel', '绘图', '汇总', '对比分析'],
            catKey: 'data_analysis',
        },
        {
            keywords: ['文献', '阅读', '综述', '调研', '检索', '知网', 'readcube', 'zotero',
                '期刊', '文献调研', '文献阅读', '文献综述', '文献整理', '引用', '参考文献',
                'web of science', 'scopus', '英文文献', '中文文献', 'doi'],
            catKey: 'literature',
        },
        {
            keywords: ['写作', '撰写', '投稿', '摘要', '修改', '返修', '审稿', '论文写作',
                '写', '报告', '汇报', '答辩', '年报', '周报', '月报', '进展报告',
                '初稿', '终稿', '定稿', '改稿', '提纲', '正文', '讨论部分'],
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
                label: stars === 5 ? '大吉' : '宜',
                reason: `今日${omen.dayElement}旺，利于此类实验`,
                color: 'text-red-600',
                bgColor: 'bg-red-50 border-red-200',
            };
        }
        if (isInauspicious) {
            const stars = 1 + (taskHash % 2); // 1 or 2
            return {
                stars,
                label: stars === 1 ? '忌' : '慎',
                reason: '今日五行相克，操作须谨慎',
                color: 'text-slate-600',
                bgColor: 'bg-slate-50 border-slate-200',
            };
        }
    }

    // 未匹配关键词或处于平级：基于哈希给出平分
    const baseStars = 2 + (taskHash % 3); // 2, 3, or 4
    const labels: AuspiciousnessLabel[] = ['慎', '平', '平', '宜'];
    return {
        stars: baseStars,
        label: labels[baseStars - 2] || '平',
        reason: '五行中和，随机而为',
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
