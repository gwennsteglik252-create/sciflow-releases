import { TimelineEvent } from '../../../types/visuals';

/**
 * 智能日期解析器：支持多种科研常用时间格式
 */
export const parseDateToTimestamp = (dateStr: string): number => {
    try {
        const str = dateStr.trim().toUpperCase();

        // 0. 预处理：科研常见特殊格式
        // 0a. "1960s-1970s" / "1960S–1970S" 等年代范围 → 取起始年份
        const decadeRangeMatch = str.match(/(\d{4})S?\s*[-–—]\s*\d{4}S?/);
        if (decadeRangeMatch) {
            return new Date(parseInt(decadeRangeMatch[1]), 0, 1).getTime();
        }

        // 0b. "2000s Early" / "1990S EARLY" / "2000S MID" / "2010S LATE" → 年代 + 修饰词偏移
        const decadeModMatch = str.match(/(\d{4})S?\s*(EARLY|MID|LATE|PRESENT|NOW)/);
        if (decadeModMatch) {
            const baseYear = parseInt(decadeModMatch[1]);
            const mod = decadeModMatch[2];
            const offset = mod === 'MID' ? 5 : mod === 'LATE' ? 8 : 0;
            return new Date(baseYear + offset, 0, 1).getTime();
        }

        // 0c. "2023-PRESENT" / "2023–Now" → 取起始年份
        const presentMatch = str.match(/(\d{4})\s*[-–—]\s*(PRESENT|NOW|TODAY|至今|现在)/);
        if (presentMatch) {
            return new Date(parseInt(presentMatch[1]), 0, 1).getTime();
        }

        // 0d. 单独的年代 "1960s" → 年代起始年
        const decadeOnlyMatch = str.match(/^(\d{4})S$/);
        if (decadeOnlyMatch) {
            return new Date(parseInt(decadeOnlyMatch[1]), 0, 1).getTime();
        }

        // 1. 优先尝试标准日期解析 (通过将中文日期词替换为/来兼容)
        const d = new Date(str.replace(/年|月|日/g, '/'));
        if (!isNaN(d.getTime()) && d.getFullYear() > 1000) {
            return d.getTime();
        }

        // 2. 处理带有“年”字的年份 (如 2011年)
        const nMatch = str.match(/(\d{4})年/);
        if (nMatch) {
            return new Date(parseInt(nMatch[1]), 0, 1).getTime();
        }

        // 3. 处理季度格式 Q1 2025
        const qMatch1 = str.match(/Q([1-4])\s+(\d{4})/);
        if (qMatch1) {
            const quarter = parseInt(qMatch1[1]);
            const year = parseInt(qMatch1[2]);
            return new Date(year, (quarter - 1) * 3, 1).getTime();
        }

        // 4. 处理季度格式 2025-Q1
        const qMatch2 = str.match(/(\d{4})-Q([1-4])/);
        if (qMatch2) {
            const year = parseInt(qMatch2[1]);
            const quarter = parseInt(qMatch2[2]);
            return new Date(year, (quarter - 1) * 3, 1).getTime();
        }

        // 5. 处理标准 YYYY-MM（仅当两个部分都是数字时）
        if (str.includes('-') && str.split('-').length === 2) {
            const parts = str.split('-');
            const y = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            if (!isNaN(y) && !isNaN(m) && y > 1000) return new Date(y, m, 1).getTime();
        }

        // 6. 处理纯数字年份 YYYY
        const pureYearMatch = str.match(/^(\d{4})$/);
        if (pureYearMatch) {
            return new Date(parseInt(pureYearMatch[1]), 0, 1).getTime();
        }

        // 7. 兜底：从字符串中提取第一个合理的四位年份
        const anyYearMatch = str.match(/(\d{4})/);
        if (anyYearMatch) {
            const year = parseInt(anyYearMatch[1]);
            if (year > 1000 && year < 3000) return new Date(year, 0, 1).getTime();
        }

        // 8. 回退：标准日期解析
        const lastD = new Date(str);
        return isNaN(lastD.getTime()) ? 0 : lastD.getTime();
    } catch (e) {
        return 0;
    }
};
/**
 * 路径配置参数
 */
export interface PathConfig {
    waveCurvature?: number;    // 波浪振幅 (默认280)
    straightTilt?: number;     // 直线倾斜 (默认0)
    steppedCount?: number;     // 阶梯数 (默认3)
    steppedHeight?: number;    // 阶高 (默认80)
    scurveSteepness?: number;  // S曲线陡峭度 (默认10)
    scurveAmplitude?: number;  // S曲线振幅 (默认120)
    zigzagAmplitude?: number;  // 锯齿振幅 (默认80)
    zigzagCount?: number;      // 锯齿齿数 (默认2)
}

/** 一维三次贝塞尔求值 */
const cubicBezier1D = (u: number, p0: number, p1: number, p2: number, p3: number): number =>
    (1 - u) ** 3 * p0 + 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u ** 2 * p2 + u ** 3 * p3;

/** 牛顿迭代法：给定目标 x (0~1)，求贝塞尔参数 u */
const findBezierU = (targetX: number, p0x: number, p1x: number, p2x: number, p3x: number): number => {
    let u = targetX; // 初始猜测
    for (let i = 0; i < 12; i++) {
        const x = cubicBezier1D(u, p0x, p1x, p2x, p3x);
        const dx = 3 * (1 - u) ** 2 * (p1x - p0x) + 6 * (1 - u) * u * (p2x - p1x) + 3 * u ** 2 * (p3x - p0x);
        if (Math.abs(dx) < 1e-8) break;
        u -= (x - targetX) / dx;
        u = Math.max(0, Math.min(1, u));
    }
    return u;
};

/**
 * 根据横轴百分比和路径类型，计算纵轴位置
 */
export const getYOnPath = (percent: number, pathType: 'straight' | 'wave' | 'stepped' | 'scurve' | 'zigzag', midY: number, config: PathConfig = {}): number => {
    const t = percent / 100;

    if (pathType === 'straight') {
        const tilt = config.straightTilt ?? 0;
        return midY - tilt * (t - 0.5);
    } else if (pathType === 'wave') {
        const amp = config.waveCurvature ?? 280;
        if (t <= 0.5) {
            const localT = t / 0.5;
            const p0 = midY;
            const p1 = midY - amp;
            const p2 = midY;
            return (1 - localT) ** 2 * p0 + 2 * (1 - localT) * localT * p1 + localT ** 2 * p2;
        } else {
            const localT = (t - 0.5) / 0.5;
            const p0 = midY;
            const p1 = midY + amp;
            const p2 = midY;
            return (1 - localT) ** 2 * p0 + 2 * (1 - localT) * localT * p1 + localT ** 2 * p2;
        }
    } else if (pathType === 'stepped') {
        const levels = config.steppedCount ?? 3;
        const stepH = config.steppedHeight ?? 80;
        const segWidth = 1 / levels;
        for (let i = 0; i < levels; i++) {
            if (t < (i + 1) * segWidth || i === levels - 1) {
                return midY - i * stepH;
            }
        }
        return midY;
    } else if (pathType === 'scurve') {
        // 与 getPathD 中的三次贝塞尔完全一致
        const amp = config.scurveAmplitude ?? 120;
        const k = config.scurveSteepness ?? 10;
        const cpOffset = Math.max(0.1, 0.5 - k * 0.02);
        // 归一化 x 控制点
        const p0x = 0, p1x = cpOffset, p2x = 1 - cpOffset, p3x = 1;
        // y 控制点
        const p0y = midY + amp * 0.5;
        const p1y = midY + amp * 0.5;
        const p2y = midY - amp * 0.5;
        const p3y = midY - amp * 0.5;
        const u = findBezierU(t, p0x, p1x, p2x, p3x);
        return cubicBezier1D(u, p0y, p1y, p2y, p3y);
    } else if (pathType === 'zigzag') {
        const amp = config.zigzagAmplitude ?? 80;
        const n = config.zigzagCount ?? 2;
        const totalSegs = 2 * n + 1;
        const points: Array<{ t: number; y: number }> = [{ t: 0, y: midY }];
        for (let i = 1; i <= 2 * n; i++) {
            points.push({ t: i / totalSegs, y: i % 2 === 1 ? midY - amp : midY + amp * 0.75 });
        }
        points.push({ t: 1, y: midY });
        for (let i = 0; i < points.length - 1; i++) {
            if (t >= points[i].t && t <= points[i + 1].t) {
                const localT = (t - points[i].t) / (points[i + 1].t - points[i].t);
                return points[i].y + (points[i + 1].y - points[i].y) * localT;
            }
        }
        return midY;
    }

    return midY;
};

/**
 * 根据横轴宽度和路径类型，生成完整路径字符串
 */
export const getPathD = (type: 'straight' | 'wave' | 'stepped' | 'scurve' | 'zigzag', width: number, midY: number, config: PathConfig = {}): string => {
    if (type === 'straight') {
        const tilt = config.straightTilt ?? 0;
        return `M 0 ${midY + tilt * 0.5} L ${width} ${midY - tilt * 0.5}`;
    }
    if (type === 'wave') {
        const amp = config.waveCurvature ?? 280;
        const d1 = `M 0 ${midY} Q ${width * 0.25} ${midY - amp} ${width * 0.5} ${midY}`;
        const d2 = `Q ${width * 0.75} ${midY + amp} ${width} ${midY}`;
        return d1 + " " + d2;
    }
    if (type === 'stepped') {
        const levels = config.steppedCount ?? 3;
        const stepH = config.steppedHeight ?? 80;
        let d = `M 0 ${midY}`;
        for (let i = 1; i < levels; i++) {
            const x = (i / levels) * width;
            d += ` L ${x} ${midY - (i - 1) * stepH}`;
            d += ` L ${x} ${midY - i * stepH}`;
        }
        d += ` L ${width} ${midY - (levels - 1) * stepH}`;
        return d;
    }
    if (type === 'scurve') {
        const amp = config.scurveAmplitude ?? 120;
        const k = config.scurveSteepness ?? 10;
        // 用陡峭度调整控制点的紧密程度
        const cpOffset = Math.max(0.1, 0.5 - k * 0.02);
        return `M 0 ${midY + amp * 0.5} C ${width * cpOffset} ${midY + amp * 0.5} ${width * (1 - cpOffset)} ${midY - amp * 0.5} ${width} ${midY - amp * 0.5}`;
    }
    if (type === 'zigzag') {
        const amp = config.zigzagAmplitude ?? 80;
        const n = config.zigzagCount ?? 2;
        const totalSegs = 2 * n + 1;
        let d = `M 0 ${midY}`;
        for (let i = 1; i <= 2 * n; i++) {
            const x = (i / totalSegs) * width;
            const y = i % 2 === 1 ? midY - amp : midY + amp * 0.75;
            d += ` L ${x} ${y}`;
        }
        d += ` L ${width} ${midY}`;
        return d;
    }
    return `M 0 ${midY} L ${width} ${midY}`;
};

/**
 * 计算事件在时间轴上的物理位置，并自动处理垂直错位以防重叠
 */
export const calculateEventPositions = (
    events: TimelineEvent[],
    pathType: 'straight' | 'wave' | 'stepped' | 'scurve' | 'zigzag',
    midY: number,
    distributionMode: 'proportional' | 'equal' = 'proportional',
    config: PathConfig = {}
) => {
    if (!events || events.length === 0) return [];

    // 1. 解析时间并预排序
    let eventsWithTime = events.map((ev, idx) => ({
        ...ev,
        timestamp: parseDateToTimestamp(ev.date),
        originalIndex: idx
    })).sort((a, b) => a.timestamp - b.timestamp || a.originalIndex - b.originalIndex);

    const minT = eventsWithTime[0].timestamp;
    const maxT = eventsWithTime[eventsWithTime.length - 1].timestamp;
    const totalSpan = maxT - minT;

    // 2. 计算横向百分比
    const maxPercentRange = 94;
    const minStartPercent = 6;

    const positioned = eventsWithTime.map((ev, idx) => {
        let percent: number;

        if (distributionMode === 'equal') {
            // 等间距模式：在 6% 到 94% 之间均匀排布
            if (eventsWithTime.length === 1) {
                percent = 50;
            } else {
                percent = minStartPercent + (idx * (maxPercentRange - minStartPercent) / (eventsWithTime.length - 1));
            }
        } else {
            // 比例模式：按时间戳线性映射
            percent = totalSpan === 0
                ? (eventsWithTime.length > 1 ? minStartPercent + (idx * (maxPercentRange - minStartPercent) / (eventsWithTime.length - 1)) : 50)
                : minStartPercent + ((ev.timestamp - minT) / totalSpan) * (maxPercentRange - minStartPercent);
        }

        const y = getYOnPath(percent, pathType, midY, config);
        return { ...ev, percent, y };
    });

    // 3. 核心改进：防重叠纵向错位算法 (Staggering Logic)
    // 气泡宽度约为 200px，SVG 总宽 1000px，即气泡占 20%
    const OVERLAP_THRESHOLD = 22; // 22% 的安全距离
    const STACK_OFFSET = 110;     // 每层错位的高度像素
    const BASE_LINE_H = 40;       // 基础连线长度

    const levels = { top: [] as number[], bottom: [] as number[] };

    return positioned.map((ev) => {
        const side = ev.side || 'top';
        const sideLevels = levels[side];

        let targetLevel = 0;
        let foundLevel = false;

        // 寻找第一个不冲突的层级
        while (!foundLevel) {
            const lastPercentAtLevel = sideLevels[targetLevel];
            if (lastPercentAtLevel === undefined || (ev.percent - lastPercentAtLevel) > OVERLAP_THRESHOLD) {
                sideLevels[targetLevel] = ev.percent;
                foundLevel = true;
            } else {
                targetLevel++;
            }
        }

        // 计算最终展示的连线长度
        // 如果用户手动设置了 lineLength，则在 staggered 基础上累加或作为最小值
        const staggeredExtra = targetLevel * STACK_OFFSET;
        const computedLineLength = (ev.lineLength || BASE_LINE_H) + staggeredExtra;

        return {
            ...ev,
            computedLineLength
        };
    });
};