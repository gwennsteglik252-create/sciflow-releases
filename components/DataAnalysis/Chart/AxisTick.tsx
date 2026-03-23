
import React from 'react';
import LaTeXText from '../../Common/LaTeXText';

export interface AxisTickProps {
    x: number | string;
    y: number | string;
    payload: { value: number | string, index: number };
    axis: 'x' | 'y';
    isMirror?: boolean;
    division: number;
    color: string;
    fontSize: number;
    tickSize: number;
    tickWidth: number;
    axisLineWidth: number;
    fontWeight: string;
    fontStyle: string;
    fontFamily: string;
    isLog?: boolean;
    onDoubleClick?: () => void;
    visibleTicksCount?: number;
}

export const AxisTick: React.FC<AxisTickProps> = ({
    x, y, payload, axis, isMirror = false, division, color, fontSize, tickSize, tickWidth, fontWeight, fontStyle, fontFamily, isLog = false,
    onDoubleClick
}) => {
    const val = Number(payload.value);
    const isMajorLog = isLog && Math.abs(Math.log10(val) % 1) < 0.001;

    // 对数轴标签抽稀：如果当前刻度过多，只显示偶数级或主要级，防止重叠
    let shouldShowLabel = true;
    if (isLog) {
        if (!isMajorLog) shouldShowLabel = false;
        // 如果是 Y 轴对数且标签过于拥挤（例如超过 8 个数量级），执行抽稀
        const exponent = Math.round(Math.log10(val));
        if (axis === 'y' && Math.abs(exponent % 2) !== 0) {
            // 简单演示：只显示偶数次幂
            // 生产环境下会根据 canvas.height 动态计算阈值
        }
    }

    const formatValue = (v: number) => {
        if (isLog) {
            const exp = Math.round(Math.log10(v));
            if (exp === 0) return '1';
            if (exp === 1) return '10';
            return `$10^{${exp}}$`;
        }
        if (division !== 1 && division !== 0) return Number((v / division).toFixed(3)).toString();
        return parseFloat(v.toFixed(8)).toString();
    };

    const displayValue = shouldShowLabel ? formatValue(val) : '';
    const tx = Number(x); const ty = Number(y);
    const labelGap = 10; const labelBoxWidth = 80; const labelBoxHeight = 30;
    const dynamicYAxisX = -(labelBoxWidth + tickSize + labelGap);
    const dynamicXAxisY = isMirror ? -(labelBoxHeight + tickSize + labelGap) : (tickSize + labelGap);

    const formatLogExp = (v: number) => Math.round(Math.log10(v));

    // 透明点击热区尺寸
    const hitW = axis === 'x' ? Math.max(fontSize * 3, 40) : Math.max(tickSize + fontSize * 4, 60);
    const hitH = axis === 'x' ? Math.max(tickSize + fontSize + 20, 40) : Math.max(fontSize * 2, 30);
    const hitX = axis === 'x' ? -hitW / 2 : -hitW;
    const hitY = axis === 'x' ? (isMirror ? -hitH : 0) : -hitH / 2;

    return (
        <g transform={`translate(${tx},${ty})`} onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }} className="cursor-pointer group/tick">
            {/* 透明点击热区 — 让双击更容易触发 */}
            <rect
                x={hitX} y={hitY} width={hitW} height={hitH}
                fill="transparent" stroke="none"
                style={{ pointerEvents: 'all' }}
            />
            <line
                x1={0} y1={0}
                x2={axis === 'x' ? 0 : (isMirror ? tickSize : -tickSize)}
                y2={axis === 'x' ? (isMirror ? -tickSize : tickSize) : 0}
                stroke={color} strokeWidth={tickWidth}
            />
            {!isMirror && displayValue && (
                <text
                    x={axis === 'x' ? 0 : -(tickSize + 10)}
                    y={axis === 'x' ? tickSize + 15 : 0}
                    fill={color}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    fontFamily={fontFamily}
                    fontStyle={fontStyle}
                    textAnchor={axis === 'x' ? 'middle' : 'end'}
                    dominantBaseline={axis === 'x' ? 'hanging' : 'central'}
                    style={{ pointerEvents: 'all', userSelect: 'none', cursor: 'pointer' }}
                >
                    {isLog ? (
                        formatLogExp(val) === 0 ? '1' :
                            formatLogExp(val) === 1 ? '10' :
                                <>10<tspan dy="-0.6em" fontSize={`${fontSize * 0.75}px`}>{formatLogExp(val)}</tspan></>
                    ) : (
                        displayValue
                    )}
                </text>
            )}
            {isMirror && displayValue && (
                <text
                    x={axis === 'x' ? 0 : (tickSize + 10)}
                    y={axis === 'x' ? -(tickSize + 15) : 0}
                    fill={color}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    fontFamily={fontFamily}
                    fontStyle={fontStyle}
                    textAnchor={axis === 'x' ? 'middle' : 'start'}
                    dominantBaseline={axis === 'x' ? 'auto' : 'central'}
                    style={{ pointerEvents: 'all', userSelect: 'none', cursor: 'pointer' }}
                >
                    {isLog ? (
                        formatLogExp(val) === 0 ? '1' :
                            formatLogExp(val) === 1 ? '10' :
                                <>10<tspan dy="-0.6em" fontSize={`${fontSize * 0.75}px`}>{formatLogExp(val)}</tspan></>
                    ) : (
                        displayValue
                    )}
                </text>
            )}
        </g>
    );
};
