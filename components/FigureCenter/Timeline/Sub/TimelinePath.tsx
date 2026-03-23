import React from 'react';
import { TimelineArrowStyle } from '../../../../types/visuals';

interface TimelinePathProps {
    d: string;
    width: number;
    height: number;
    strokeWidth?: number;
    arrowWidth?: number;
    glowIntensity?: number;
    axisColor?: string;
    gradientPreset?: string;
    arrowStyle?: TimelineArrowStyle;
    showArrow?: boolean;
    isHollow?: boolean;
}

const GRADIENT_DEFINITIONS: Record<string, string[]> = {
    rainbow: ['#6366f1', '#818cf8', '#c084fc', '#f472b6', '#f43f5e'],
    ocean: ['#06b6d4', '#0891b2', '#2563eb', '#1d4ed8', '#4338ca'],
    forest: ['#84cc16', '#22c55e', '#10b981', '#059669', '#0d9488'],
    sunset: ['#facc15', '#fde047', '#f97316', '#ea580c', '#dc2626'],
    cyber: ['#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#06b6d4']
};

/**
 * 从 SVG path 字符串中解析命令，提取路径终点及其前驱点（用于计算切线方向）。
 * 特别处理 Q（二次贝塞尔）命令：终点切线方向由控制点→终点决定。
 */
function extractPathEndpoints(d: string): { tip: [number, number]; prev: [number, number] } {
    // 将 path 切分为 [命令字母, ...数字] 的段落
    const segments = d.trim().split(/(?=[MLQCZ])/i).filter(Boolean);

    interface Cmd { type: string; nums: number[] }
    const cmds: Cmd[] = segments.map(seg => {
        const type = seg[0].toUpperCase();
        const nums = (seg.slice(1).match(/[-+]?\d*\.?\d+/g) || []).map(Number);
        return { type, nums };
    });

    if (cmds.length === 0) return { tip: [0, 0], prev: [0, 0] };

    const last = cmds[cmds.length - 1];
    const secondLast = cmds.length > 1 ? cmds[cmds.length - 2] : cmds[0];

    // 从命令中取最后两个数字作为终点
    const getEndPt = (cmd: Cmd): [number, number] => {
        const n = cmd.nums;
        return [n[n.length - 2] ?? 0, n[n.length - 1] ?? 0];
    };

    const tip = getEndPt(last);

    let prev: [number, number];
    if (last.type === 'Q' && last.nums.length >= 4) {
        // Q cx cy x y → 切线方向是 (cx,cy) → (x,y)
        prev = [last.nums[0], last.nums[1]];
    } else if (last.type === 'C' && last.nums.length >= 6) {
        // C cx1 cy1 cx2 cy2 x y → 切线方向是 (cx2,cy2) → (x,y)
        prev = [last.nums[2], last.nums[3]];
    } else if (last.type === 'L' || last.type === 'M') {
        prev = getEndPt(secondLast);
    } else {
        prev = getEndPt(secondLast);
    }

    // 如果 prev 与 tip 完全相同（例如只有一个点），则向左偏移
    if (prev[0] === tip[0] && prev[1] === tip[1]) {
        prev = [tip[0] - 10, tip[1]];
    }

    return { tip, prev };
}

/**
 * 根据箭头风格和颜色，生成箭头 SVG path 的 d 属性字符串
 * 以原点(0,0)为箭头尖端，向左（-x方向）生长，可以旋转
 */
function buildArrowPath(style: TimelineArrowStyle, size: number): string {
    // 比例调整：使箭头更修长 (Length > Width)
    const width = size * 0.45; // 宽度变窄
    const length = size * 0.9;  // 长度增加

    switch (style) {
        case 'stealth':
            // 尖锐的燕尾形
            return `M 0 0 L ${-length} ${-width} L ${-length * 0.6} 0 L ${-length} ${width} Z`;
        case 'diamond':
            // 修长的菱形
            return `M 0 0 L ${-length * 0.5} ${-width * 0.7} L ${-length} 0 L ${-length * 0.5} ${width * 0.7} Z`;
        case 'classic':
        default:
            // 锐角三角形
            return `M 0 0 L ${-length} ${-width} L ${-length} ${width} Z`;
    }
}

export const TimelinePath: React.FC<TimelinePathProps> = ({
    d, width, height, strokeWidth = 4, arrowWidth = 4, glowIntensity = 5,
    axisColor = '#6366f1', gradientPreset = 'rainbow', arrowStyle = 'classic', showArrow = true, isHollow = true
}) => {
    const isGradient = axisColor === 'gradient';
    const activePreset = gradientPreset || 'rainbow';
    const colors = GRADIENT_DEFINITIONS[activePreset] || GRADIENT_DEFINITIONS.rainbow;

    // 渐变 ID 保持固定或根据颜色生成
    const gradId = "axisGrad-" + (isGradient ? activePreset : axisColor.replace('#', ''));
    const glowId = "axisGlow-" + glowIntensity;

    const strokeValue = `url(#${gradId})`;
    // 获取末端色：如果是渐变则取最后一个色，否则取主色
    const lastColor = isGradient ? colors[colors.length - 1] : axisColor;

    // ---- 计算箭头的位置和旋转角度 ----
    const { tip, prev } = extractPathEndpoints(d);
    const dx = tip[0] - prev[0];
    const dy = tip[1] - prev[1];
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // 箭头大小解耦：不再受主轴线宽影响，仅受“倍率”设置控制
    // 基础尺寸 10 * 倍率，这样调节起来更符合用户预期
    const arrowSize = arrowWidth * 10;

    // 箭头的 transform：平移到路径终点，然后旋转到切线方向
    const arrowTransform = `translate(${tip[0]}, ${tip[1]}) rotate(${angle})`;

    // 主路径截断 - 截断到路径的 96.5%，留出箭头空间
    // 用 strokeDasharray 实现视觉截断
    // 主路径截断 - 调整为 98.5%，确保在各种线宽下主路径都能被箭头完美覆盖，不外露尖端
    const dashArray = showArrow && arrowStyle !== 'none' ? "98.5, 100" : undefined;

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
                    {isGradient ? (
                        colors.map((c, i) => (
                            <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c} />
                        ))
                    ) : (
                        <>
                            <stop offset="0%" stopColor={axisColor} />
                            <stop offset="100%" stopColor={axisColor} />
                        </>
                    )}
                </linearGradient>

                <filter id={glowId} filterUnits="userSpaceOnUse" x="-200" y="-200" width={width + 400} height={height + 400}>
                    <feGaussianBlur stdDeviation={glowIntensity} result="blur" />
                    <feComponentTransfer in="blur" result="brightBlur">
                        <feFuncA type="linear" slope="1.5" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode in="brightBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* 1. 底层阴影路径 - 物理截断 3.5% */}
            <path
                d={d}
                stroke={isGradient ? colors[0] : axisColor}
                strokeWidth={strokeWidth + 2}
                fill="none"
                strokeLinecap="butt"
                className="opacity-[0.08]"
                pathLength="100"
                strokeDasharray={dashArray}
            />

            {/* 2. 主干路径 - 物理截断 3.5% */}
            <path
                d={d}
                stroke={strokeValue}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="butt"
                filter={`url(#${glowId})`}
                pathLength="100"
                strokeDasharray={dashArray}
            />

            {/* 3. 顶层高光路径 (创建空心感) - 物理截断 3.5% */}
            {isHollow && (
                <path
                    d={d}
                    stroke="white"
                    strokeWidth={strokeWidth * 0.6} // 比例缩放，确保大线宽时空心感也随之增强
                    fill="none"
                    strokeLinecap="butt"
                    className="opacity-80"
                    pathLength="100"
                    strokeDasharray={dashArray}
                />
            )}

            {/* 4. 直接绘制箭头（不依赖 SVG marker，用标准 JSX 条件渲染） */}
            {showArrow && arrowStyle !== 'none' && (
                <g transform={arrowTransform}>
                    <path
                        d={buildArrowPath(arrowStyle, arrowSize)}
                        stroke={lastColor}
                        strokeWidth={isHollow ? Math.max(strokeWidth, 1.5) : 0}
                        fill={isHollow ? 'none' : lastColor}
                        strokeLinejoin="round"
                        className="transition-all duration-300"
                    />
                </g>
            )}
        </svg>
    );
};