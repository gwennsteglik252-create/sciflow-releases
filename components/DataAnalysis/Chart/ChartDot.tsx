
import React from 'react';

export interface ChartDotProps {
    cx?: number;
    cy?: number;
    stroke: string;
    pointSize: number;
    pointShape: string;
    pointColor?: string;
    sizeOverride?: number;
    onDoubleClick?: () => void;
}

export const ChartDot: React.FC<ChartDotProps> = ({
    cx, cy, stroke, pointSize, pointShape, pointColor, sizeOverride, onDoubleClick
}) => {
    if (cx === undefined || cy === undefined) return null;

    const r = sizeOverride || pointSize;
    const finalColor = pointColor || stroke;

    // 增加一个透明的扩大点击热区，使小点也容易被双击
    const hitAreaRadius = Math.max(r + 12, 15);

    const handleInternalDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDoubleClick?.();
    };

    const renderShape = () => {
        const commonProps = {
            fill: finalColor,
            stroke: "none",
            strokeWidth: 0,
            fillOpacity: 0.8
        };

        if (pointShape === 'square') {
            return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} {...commonProps} />;
        }

        if (pointShape === 'diamond') {
            return <polygon points={`${cx},${cy - r - 1} ${cx + r + 1},${cy} ${cx},${cy + r + 1} ${cx - r - 1},${cy}`} {...commonProps} />;
        }

        if (pointShape === 'triangleUp') {
            return <polygon points={`${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`} {...commonProps} />;
        }

        if (pointShape === 'triangleDown') {
            return <polygon points={`${cx - r},${cy - r} ${cx + r},${cy - r} ${cx},${cy + r}`} {...commonProps} />;
        }

        if (pointShape === 'cross') {
            return (
                <g>
                    <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} stroke={finalColor} strokeWidth={1.5} strokeOpacity={0.8} />
                    <line x1={cx + r} y1={cy - r} x2={cx - r} y2={cy + r} stroke={finalColor} strokeWidth={1.5} strokeOpacity={0.8} />
                </g>
            );
        }

        if (pointShape === 'star') {
            const R = r * 1.35;
            const ir = R * 0.45;
            const pts = [];
            for (let i = 0; i < 10; i++) {
                const angle = (i * 36 - 90) * Math.PI / 180;
                const currR = i % 2 === 0 ? R : ir;
                pts.push(`${cx + currR * Math.cos(angle)},${cy + currR * Math.sin(angle)}`);
            }
            return (
                <polygon
                    points={pts.join(' ')}
                    {...commonProps}
                />
            );
        }

        if (pointShape === 'sphere') {
            return (
                <g>
                    <circle cx={cx} cy={cy} r={r} fill={finalColor} fillOpacity={0.9} />
                    {/* 减弱高光强度，从 0.45 降到 0.3 */}
                    <circle cx={cx - r * 0.25} cy={cy - r * 0.25} r={r * 0.4} fill="white" fillOpacity={0.3} />
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={0.5} />
                </g>
            );
        }

        if (pointShape === 'none') return null;
        return <circle cx={cx} cy={cy} r={r} {...commonProps} />;
    };

    return (
        <g
            className="cursor-pointer hover:brightness-110 transition-all"
            onDoubleClick={handleInternalDoubleClick}
            style={{ pointerEvents: 'all' }}
        >
            {/* 核心改动：透明热区层 */}
            <circle cx={cx} cy={cy} r={hitAreaRadius} fill="transparent" />
            {renderShape()}
        </g>
    );
};
