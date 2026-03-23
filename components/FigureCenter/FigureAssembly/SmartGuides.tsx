import React from 'react';

export interface GuideLine {
    type: 'h' | 'v';
    position: number;      // x for v-line, y for h-line
    from: number;          // start coordinate on the other axis
    to: number;            // end coordinate on the other axis
    distance?: number;     // distance label (optional)
}

interface SmartGuidesProps {
    guides: GuideLine[];
    canvasScale: number;
}

export const SmartGuides: React.FC<SmartGuidesProps> = ({ guides, canvasScale }) => {
    if (guides.length === 0) return null;

    return (
        <svg className="absolute inset-0 pointer-events-none z-[100] no-export overflow-visible" style={{ width: '100%', height: '100%' }}>
            {guides.map((g, i) => {
                if (g.type === 'v') {
                    return (
                        <g key={i}>
                            <line x1={g.position} y1={g.from} x2={g.position} y2={g.to}
                                stroke="#f43f5e" strokeWidth={1 / canvasScale} strokeDasharray={`${4 / canvasScale} ${4 / canvasScale}`} />
                            {g.distance !== undefined && (
                                <text x={g.position + 4 / canvasScale} y={(g.from + g.to) / 2}
                                    fill="#f43f5e" fontSize={10 / canvasScale} fontWeight="bold" fontFamily="monospace">
                                    {Math.round(g.distance)}px
                                </text>
                            )}
                        </g>
                    );
                } else {
                    return (
                        <g key={i}>
                            <line x1={g.from} y1={g.position} x2={g.to} y2={g.position}
                                stroke="#f43f5e" strokeWidth={1 / canvasScale} strokeDasharray={`${4 / canvasScale} ${4 / canvasScale}`} />
                            {g.distance !== undefined && (
                                <text x={(g.from + g.to) / 2} y={g.position - 4 / canvasScale}
                                    fill="#f43f5e" fontSize={10 / canvasScale} fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                                    {Math.round(g.distance)}px
                                </text>
                            )}
                        </g>
                    );
                }
            })}
        </svg>
    );
};

/** 计算拖拽面板与其他面板的对齐参考线 + 磁吸修正 */
export function computeSmartGuides(
    draggingId: string,
    panels: { id: string; x: number; y: number; w: number; h: number }[],
    dx: number,
    dy: number,
    threshold: number = 5
): { guides: GuideLine[]; snapDx: number; snapDy: number } {
    const dragging = panels.find(p => p.id === draggingId);
    if (!dragging) return { guides: [], snapDx: dx, snapDy: dy };

    const dragX = dragging.x + dx;
    const dragY = dragging.y + dy;
    const dragCX = dragX + dragging.w / 2;
    const dragCY = dragY + dragging.h / 2;
    const dragR = dragX + dragging.w;
    const dragB = dragY + dragging.h;

    const guides: GuideLine[] = [];
    let snapX: number | null = null;
    let snapY: number | null = null;

    for (const other of panels) {
        if (other.id === draggingId) continue;
        const oR = other.x + other.w;
        const oB = other.y + other.h;
        const oCX = other.x + other.w / 2;
        const oCY = other.y + other.h / 2;

        // Vertical alignment checks (x-axis)
        const vChecks = [
            { dragVal: dragX, otherVal: other.x },        // left-left
            { dragVal: dragR, otherVal: oR },              // right-right
            { dragVal: dragCX, otherVal: oCX },            // center-center
            { dragVal: dragX, otherVal: oR },              // left-right
            { dragVal: dragR, otherVal: other.x },         // right-left
        ];
        for (const vc of vChecks) {
            if (Math.abs(vc.dragVal - vc.otherVal) < threshold && snapX === null) {
                snapX = vc.otherVal - (vc.dragVal - dragX);
                const minY = Math.min(dragY, other.y);
                const maxY = Math.max(dragB, oB);
                guides.push({ type: 'v', position: vc.otherVal, from: minY, to: maxY });
            }
        }

        // Horizontal alignment checks (y-axis)
        const hChecks = [
            { dragVal: dragY, otherVal: other.y },         // top-top
            { dragVal: dragB, otherVal: oB },              // bottom-bottom
            { dragVal: dragCY, otherVal: oCY },            // center-center
            { dragVal: dragY, otherVal: oB },              // top-bottom
            { dragVal: dragB, otherVal: other.y },         // bottom-top
        ];
        for (const hc of hChecks) {
            if (Math.abs(hc.dragVal - hc.otherVal) < threshold && snapY === null) {
                snapY = hc.otherVal - (hc.dragVal - dragY);
                const minX = Math.min(dragX, other.x);
                const maxX = Math.max(dragR, oR);
                guides.push({ type: 'h', position: hc.otherVal, from: minX, to: maxX });
            }
        }
    }

    return {
        guides,
        snapDx: snapX !== null ? snapX - dragging.x : dx,
        snapDy: snapY !== null ? snapY - dragging.y : dy,
    };
}
