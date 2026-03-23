import React, { useEffect, useRef } from 'react';
import { CircularSummaryData, SummarySegment, SummaryImage, SummaryLayer } from '../../../types';

interface CircularCanvasProps {
    data: CircularSummaryData;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    onSegmentClick: (layerId: string, segment: SummarySegment) => void;
    onCoreClick: () => void;
}

const CircularCanvas: React.FC<CircularCanvasProps> = ({ data, setZoom, onSegmentClick, onCoreClick }) => {
    const size = 950;
    const center = size / 2;
    const coreRadius = 140;

    // 安全检查：如果 data.layers 不存在，直接返回
    if (!data || !data.layers) return null;

    const numLayers = data.layers.length || 1;
    const totalRingWidth = 310;
    const layerHeight = totalRingWidth / numLayers;

    const canvasRef = useRef<SVGSVGElement>(null);

    const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const getSectorPath = (innerR: number, outerR: number, startA: number, endA: number) => {
        const diff = Math.abs(endA - startA);
        const isLargeArc = diff > 180 ? 1 : 0;

        const innerP1 = polarToCartesian(center, center, innerR, startA);
        const innerP2 = polarToCartesian(center, center, innerR, endA);
        const outerP1 = polarToCartesian(center, center, outerR, startA);
        const outerP2 = polarToCartesian(center, center, outerR, endA);

        return [
            "M", innerP1.x, innerP1.y,
            "A", innerR, innerR, 0, isLargeArc, 1, innerP2.x, innerP2.y,
            "L", outerP2.x, outerP2.y,
            "A", outerR, outerR, 0, isLargeArc, 0, outerP1.x, outerP1.y,
            "Z"
        ].join(" ");
    };

    const getArcPath = (radius: number, startA: number, endA: number, reverse: boolean) => {
        const p1 = polarToCartesian(center, center, radius, reverse ? endA : startA);
        const p2 = polarToCartesian(center, center, radius, reverse ? startA : endA);
        const sweepFlag = reverse ? 0 : 1;
        const isLargeArc = Math.abs(endA - startA) > 180 ? 1 : 0;
        return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${isLargeArc} ${sweepFlag} ${p2.x} ${p2.y}`;
    };

    const getDynamicTruncate = (text: string, radius: number, angleSpan: number, fontSize: number) => {
        if (!text) return "";
        const arcLength = radius * (angleSpan * Math.PI / 180) * 0.85;
        const estimatedCharWidth = fontSize * 0.6;
        const maxChars = Math.floor(arcLength / estimatedCharWidth);

        if (text.length <= maxChars) return text;
        return text.substring(0, Math.max(0, maxChars - 1)) + '...';
    };

    const getAutoPosition = (index: number, total: number, midR: number, midA: number, sectorSpan: number, layerH: number) => {
        if (total === 1) return { r: midR, a: midA };
        if (total === 2) {
            const angleOffset = sectorSpan * 0.22;
            return { r: midR, a: midA + (index === 0 ? -angleOffset : angleOffset) };
        }
        if (total === 3) {
            const rOffset = layerH * 0.16;
            const aOffset = sectorSpan * 0.24;
            if (index === 0) return { r: midR - rOffset, a: midA };
            return { r: midR + rOffset, a: midA + (index === 1 ? -aOffset : aOffset) };
        }
        const rows = 2;
        const cols = Math.ceil(total / rows);
        const rowIdx = Math.floor(index / cols);
        const colIdx = index % cols;
        const rStep = layerH * 0.38;
        const aStep = (sectorSpan * 0.65) / Math.max(1, cols - 1);
        const r = midR + (rowIdx - 0.5) * rStep;
        const a = midA + (colIdx - (cols - 1) / 2) * aStep;
        return { r, a };
    };

    return (
        <svg
            ref={canvasRef}
            width={size} height={size} viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible select-none cursor-default"
        >
            <defs>
                <filter id="shadow-deep" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="10" />
                    <feOffset dx="0" dy="6" />
                    <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>

                <radialGradient id="nucleusGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" style={{ stopColor: data.coreColor || '#6366f1', stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: data.coreColor || '#6366f1', stopOpacity: 0 }} />
                </radialGradient>

                <linearGradient id="coreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: data.coreColor || '#0f172a' }} />
                    <stop offset="100%" style={{ stopColor: data.coreColor || '#1e293b' }} />
                </linearGradient>

                <clipPath id="coreClip"><circle cx={center} cy={center} r={coreRadius} /></clipPath>
            </defs>

            <circle cx={center} cy={center} r={coreRadius + 50} fill="url(#nucleusGlow)" className="animate-pulse" />
            <g filter="url(#shadow-deep)" className="cursor-pointer group/core" onClick={onCoreClick}>
                {data.coreThumbnailUrl ? (
                    <g>
                        <circle cx={center} cy={center} r={coreRadius} fill="white" className="transition-all duration-500 group-hover/core:scale-[1.03]" style={{ transformOrigin: `${center}px ${center}px` }} />
                        <g style={{ transform: `translate(${data.coreImageOffsetX || 0}px, ${data.coreImageOffsetY || 0}px) scale(${data.coreImageScale || 1})`, transformOrigin: `${center}px ${center}px` }}>
                            <image
                                href={data.coreThumbnailUrl}
                                x={center - coreRadius}
                                y={center - coreRadius}
                                width={coreRadius * 2}
                                height={coreRadius * 2}
                                clipPath="url(#coreClip)"
                                preserveAspectRatio="xMidYMid slice"
                                className="transition-all duration-700"
                            />
                        </g>
                        <rect x={center - coreRadius} y={center + 20} width={coreRadius * 2} height={coreRadius * 0.4} fill="rgba(0,0,0,0.5)" clipPath="url(#coreClip)" />
                        <text x={center} y={center + 50} textAnchor="middle" fill="white" className="uppercase italic tracking-tight font-black" style={{ fontSize: `${(data.coreFontSize || 18) * 0.9}px` }}>{data.title.substring(0, 16)}</text>
                    </g>
                ) : (
                    <>
                        <circle cx={center} cy={center} r={coreRadius} fill={`url(#coreGradient)`} className="transition-all duration-500 group-hover/core:scale-[1.03]" style={{ transformOrigin: `${center}px ${center}px` }} />
                        <text x={center} y={center + 35} textAnchor="middle" fill={data.coreTitleColor || "white"} className="uppercase italic tracking-tight font-black" style={{ fontSize: `${data.coreFontSize || 18}px` }}>{data.title.substring(0, 20)}</text>
                        {data.coreIcon && (
                            <foreignObject x={center - 40} y={center - 75} width="80" height="80">
                                <div className="w-full h-full flex items-center justify-center text-7xl text-indigo-400 opacity-80"><i className={`fa-solid ${data.coreIcon}`}></i></div>
                            </foreignObject>
                        )}
                    </>
                )}
            </g>

            {data.layers.map((layer, lIdx) => {
                const innerR = coreRadius + (lIdx * layerHeight) + 8;
                const outerR = innerR + layerHeight - 12;
                const midR = (innerR + outerR) / 2;

                const layerConf = layer.config || { titleSize: 22, titleOffset: 18, titleContentGap: 24, contentSize: 14 };
                const segments = layer.segments || []; // 安全防御：防止 segments 为 undefined
                const segmentCount = segments.length;
                if (segmentCount === 0) return null;
                const angleStep = 360 / segmentCount;

                return (
                    <g key={layer.id} className="animate-reveal" style={{ animationDelay: `${lIdx * 0.15}s` }}>
                        {segments.map((seg, sIdx) => {
                            const startAngle = sIdx * angleStep + 1;
                            const endAngle = (sIdx + 1) * angleStep - 1;
                            const midAngle = startAngle + (angleStep / 2);
                            const needsFlip = midAngle > 90 && midAngle < 270;

                            const fullPathData = getSectorPath(innerR, outerR, startAngle, endAngle);

                            const titleRadius = outerR - (layerConf.titleOffset || 18);
                            const contentRadius = titleRadius - (layerConf.titleContentGap || 24);

                            const paddingAngle = Math.max(3, 15 / segmentCount);
                            const titlePathId = `path-title-${seg.id}`;
                            const contentPathId = `path-content-${seg.id}`;
                            const color = seg.color || '#F2F4F8';

                            let activeImages: SummaryImage[] = seg.images && seg.images.length > 0
                                ? seg.images
                                : (seg.thumbnailUrl ? [{ id: 'legacy', url: seg.thumbnailUrl, scale: seg.imageScale || 1, radialOffset: 0, angularOffset: 0 }] : []);

                            if (layerConf.uniformImageCount && layerConf.uniformImageCount > 0) {
                                activeImages = activeImages.slice(0, layerConf.uniformImageCount);
                            }

                            const hasImages = activeImages.length > 0;
                            const isAuto = seg.isAutoLayout !== false;

                            const scaleFactor = Math.pow(layerHeight / 155, 0.6);

                            const titleFontSize = (seg.titleSize || layerConf.titleSize || 22) * scaleFactor;
                            const contentFontSize = (seg.contentSize || layerConf.contentSize || 14) * scaleFactor;
                            const titleFontFamily = seg.titleFontFamily || layerConf.titleFontFamily || 'inherit';
                            const contentFontFamily = seg.contentFontFamily || layerConf.contentFontFamily || 'inherit';
                            const titleFontWeight = seg.titleFontWeight || layerConf.titleFontWeight || '900';
                            const contentFontWeight = seg.contentFontWeight || layerConf.contentFontWeight || 'bold';
                            const titleFontStyle = seg.titleFontStyle || layerConf.titleFontStyle || 'italic';
                            const contentFontStyle = seg.contentFontStyle || layerConf.contentFontStyle || 'italic';

                            return (
                                <g key={seg.id} className="group/segment cursor-pointer" onClick={() => onSegmentClick(layer.id, seg)}>
                                    <defs>
                                        <radialGradient id={`grad-seg-${seg.id}`} cx="50%" cy="50%" r="80%">
                                            <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
                                            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.9 }} />
                                        </radialGradient>
                                        <path id={titlePathId} d={getArcPath(titleRadius, startAngle + paddingAngle, endAngle - paddingAngle, needsFlip)} />
                                        <path id={contentPathId} d={getArcPath(contentRadius, startAngle + paddingAngle, endAngle - paddingAngle, needsFlip)} />
                                    </defs>

                                    <path d={fullPathData} fill={`url(#grad-seg-${seg.id})`} stroke="white" strokeWidth={2} className="transition-all duration-500 group-hover/segment:brightness-105" />

                                    {hasImages ? (
                                        activeImages.map((img, i) => {
                                            const pos = isAuto
                                                ? getAutoPosition(i, activeImages.length, midR - 15, midAngle, angleStep, layerHeight)
                                                : { r: midR + (img.radialOffset || 0), a: midAngle + (img.angularOffset || 0) };

                                            const imgCartesian = polarToCartesian(center, center, pos.r, pos.a);
                                            const imgBoxSize = (layerHeight * 0.45) / (activeImages.length > 3 ? 1.4 : 1);

                                            return (
                                                <g key={img.id || i} transform={`rotate(${pos.a}, ${imgCartesian.x}, ${imgCartesian.y})`}>
                                                    <g style={{ transform: `scale(${img.scale || 1})`, transformOrigin: `${imgCartesian.x}px ${imgCartesian.y}px` }}>
                                                        <image
                                                            href={img.url}
                                                            x={imgCartesian.x - imgBoxSize / 2}
                                                            y={imgCartesian.y - imgBoxSize / 2}
                                                            width={imgBoxSize}
                                                            height={imgBoxSize}
                                                            preserveAspectRatio="xMidYMid meet"
                                                            className="transition-all duration-500 hover:scale-110 shadow-xl"
                                                        />
                                                    </g>
                                                </g>
                                            );
                                        })
                                    ) : (
                                        <g transform={`translate(${polarToCartesian(center, center, midR - 20, midAngle).x - 25}, ${polarToCartesian(center, center, midR - 20, midAngle).y - 25}) scale(0.7)`}>
                                            <foreignObject x="0" y="0" width="50" height="50">
                                                <div className="w-full h-full flex items-center justify-center text-slate-400 opacity-30"><i className={`fa-solid ${seg.icon || 'fa-atom'} text-3xl`}></i></div>
                                            </foreignObject>
                                        </g>
                                    )}

                                    <text
                                        fill={seg.titleColor || layerConf.titleColor || '#0f172a'}
                                        className="uppercase tracking-tight"
                                        fontStyle={titleFontStyle}
                                        fontWeight={titleFontWeight === 'black' ? '900' : titleFontWeight}
                                        fontFamily={titleFontFamily}
                                        fontSize={`${titleFontSize}px`}
                                        dominantBaseline="central"
                                        pointerEvents="none"
                                    >
                                        <textPath href={`#${titlePathId}`} startOffset="50%" textAnchor="middle">
                                            {getDynamicTruncate(seg.title, titleRadius, angleStep, titleFontSize)}
                                        </textPath>
                                    </text>

                                    <text
                                        fill={seg.contentColor || layerConf.contentColor || '#334155'}
                                        className="tracking-tight"
                                        fontStyle={contentFontStyle}
                                        fontWeight={contentFontWeight === 'black' ? '900' : contentFontWeight}
                                        fontFamily={contentFontFamily}
                                        fontSize={`${contentFontSize}px`}
                                        dominantBaseline="central"
                                        pointerEvents="none"
                                    >
                                        <textPath href={`#${contentPathId}`} startOffset="50%" textAnchor="middle">
                                            {getDynamicTruncate(seg.content, contentRadius, angleStep, contentFontSize)}
                                        </textPath>
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                );
            })}
        </svg>
    );
};

export default CircularCanvas;
