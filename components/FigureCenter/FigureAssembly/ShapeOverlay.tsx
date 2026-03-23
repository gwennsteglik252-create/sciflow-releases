
import React, { useState, useEffect } from 'react';
import { FigureShape, FigureHeadStyle } from '../../../types';

interface ShapeOverlayProps {
  shape: FigureShape;
  isSelected: boolean;
  onMouseDown: (mode: 'move' | 'p1' | 'p2', e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<FigureShape>, isBatch?: boolean) => void;
  onDelete: () => void;
}

export const ShapeOverlay: React.FC<ShapeOverlayProps> = ({
  shape, isSelected, onMouseDown, onUpdate, onDelete
}) => {
  const [isBatch, setIsBatch] = useState(false);
  const [localStrokeWidth, setLocalStrokeWidth] = useState<string | number>(shape.strokeWidth);

  useEffect(() => {
    setLocalStrokeWidth(shape.strokeWidth);
  }, [shape.strokeWidth]);

  const isLineOrArrow = shape.type === 'line' || shape.type === 'arrow';
  const isClosedShape = shape.type === 'rect' || shape.type === 'circle' || shape.type === 'polygon';

  // 功能14: 填充值计算
  const getFillValue = () => {
    if (!shape.fill) return 'transparent';
    switch (shape.fill.type) {
      case 'solid': return shape.fill.color || 'transparent';
      case 'linear-gradient': return `url(#fill-lg-${shape.id})`;
      case 'radial-gradient': return `url(#fill-rg-${shape.id})`;
      case 'pattern': return `url(#fill-pat-${shape.id})`;
      default: return 'transparent';
    }
  };

  const getDashArray = () => {
    switch (shape.dashStyle) {
      case 'dashed': return '8,4';
      case 'dotted': return '2,4';
      default: return 'none';
    }
  };

  const handleStrokeWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalStrokeWidth(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onUpdate({ strokeWidth: parsed }, isBatch);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (document.activeElement === e.currentTarget) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        onUpdate({ strokeWidth: Math.round(shape.strokeWidth + delta) }, isBatch);
    }
  };

  const cycleDashStyle = () => {
    const styles: ('solid' | 'dashed' | 'dotted')[] = ['solid', 'dashed', 'dotted'];
    const nextIdx = (styles.indexOf(shape.dashStyle || 'solid') + 1) % styles.length;
    onUpdate({ dashStyle: styles[nextIdx] }, isBatch);
  };

  const cycleHeadStyle = () => {
    const styles: FigureHeadStyle[] = ['solid', 'open', 't-bar', 'circle', 'double-solid', 'double-open', 'none'];
    const current = shape.headStyle || 'solid';
    const nextIdx = (styles.indexOf(current) + 1) % styles.length;
    onUpdate({ headStyle: styles[nextIdx] }, isBatch);
  };

  const getMarkers = () => {
    const style = shape.headStyle || 'solid';
    if (style === 'none') return {};

    const markerMap: Record<string, string> = {
        'solid': `url(#arrowhead-solid-${shape.id})`,
        'open': `url(#arrowhead-open-${shape.id})`,
        't-bar': `url(#arrowhead-tbar-${shape.id})`,
        'circle': `url(#arrowhead-circle-${shape.id})`,
        'double-solid': `url(#arrowhead-solid-${shape.id})`,
        'double-open': `url(#arrowhead-open-${shape.id})`
    };

    const startMarkerMap: Record<string, string> = {
        'double-solid': `url(#arrowhead-solid-start-${shape.id})`,
        'double-open': `url(#arrowhead-open-start-${shape.id})`
    };

    return {
        markerEnd: markerMap[style],
        markerStart: startMarkerMap[style]
    };
  };

  return (
    <div 
        className={`absolute pointer-events-none ${isSelected ? 'z-50' : 'z-20'}`}
        style={{ left: 0, top: 0, width: '100%', height: '100%' }}
    >
        <svg className="w-full h-full pointer-events-none overflow-visible">
            <defs>
                <marker id={`arrowhead-solid-${shape.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={shape.color} />
                </marker>
                <marker id={`arrowhead-solid-start-${shape.id}`} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto">
                    <polygon points="10 0, 0 3.5, 10 7" fill={shape.color} />
                </marker>
                <marker id={`arrowhead-open-${shape.id}`} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
                    <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke={shape.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </marker>
                <marker id={`arrowhead-open-start-${shape.id}`} markerWidth="10" markerHeight="10" refX="1" refY="5" orient="auto">
                    <path d="M 9 1 L 1 5 L 9 9" fill="none" stroke={shape.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </marker>
                <marker id={`arrowhead-tbar-${shape.id}`} markerWidth="6" markerHeight="10" refX="5" refY="5" orient="auto">
                    <line x1="5" y1="0" x2="5" y2="10" stroke={shape.color} strokeWidth="2" strokeLinecap="butt" />
                </marker>
                <marker id={`arrowhead-circle-${shape.id}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <circle cx="4" cy="4" r="3" fill={shape.color} />
                </marker>
            </defs>

            {/* 功能14: 渐变/图案填充 SVG defs */}
            <defs>
                {shape.fill?.type === 'linear-gradient' && shape.fill.gradient && (
                    <linearGradient id={`fill-lg-${shape.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={shape.fill.gradient.from} />
                        <stop offset="100%" stopColor={shape.fill.gradient.to} />
                    </linearGradient>
                )}
                {shape.fill?.type === 'radial-gradient' && shape.fill.gradient && (
                    <radialGradient id={`fill-rg-${shape.id}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={shape.fill.gradient.from} />
                        <stop offset="100%" stopColor={shape.fill.gradient.to} />
                    </radialGradient>
                )}
                {shape.fill?.type === 'pattern' && (
                    <pattern id={`fill-pat-${shape.id}`} patternUnits="userSpaceOnUse" width="8" height="8">
                        {shape.fill.pattern === 'dots' && <circle cx="4" cy="4" r="1.5" fill={shape.color} />}
                        {shape.fill.pattern === 'lines' && <line x1="0" y1="0" x2="0" y2="8" stroke={shape.color} strokeWidth="1" />}
                        {shape.fill.pattern === 'crosshatch' && <><line x1="0" y1="0" x2="8" y2="8" stroke={shape.color} strokeWidth="0.5" /><line x1="8" y1="0" x2="0" y2="8" stroke={shape.color} strokeWidth="0.5" /></>}
                        {shape.fill.pattern === 'diagonal' && <line x1="0" y1="8" x2="8" y2="0" stroke={shape.color} strokeWidth="1" />}
                    </pattern>
                )}
            </defs>

            <g className="pointer-events-auto cursor-move" onMouseDown={(e) => onMouseDown('move', e)}>
                {shape.type === 'arrow' && (
                    <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} {...getMarkers()} strokeLinecap="round" />
                )}
                {shape.type === 'line' && (
                    <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} strokeLinecap="round" />
                )}
                {shape.type === 'rect' && (
                    <rect x={Math.min(shape.x1, shape.x2)} y={Math.min(shape.y1, shape.y2)} width={Math.abs(shape.x2 - shape.x1)} height={Math.abs(shape.y2 - shape.y1)} fill={getFillValue()} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} />
                )}
                {shape.type === 'circle' && (
                    <ellipse cx={(shape.x1 + shape.x2) / 2} cy={(shape.y1 + shape.y2) / 2} rx={Math.abs(shape.x2 - shape.x1) / 2} ry={Math.abs(shape.y2 - shape.y1) / 2} fill={getFillValue()} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} />
                )}
                {/* 功能8: 贝塞尔曲线 */}
                {shape.type === 'bezier' && (() => {
                    const cx = (shape.x1 + shape.x2) / 2;
                    const cy = Math.min(shape.y1, shape.y2) - Math.abs(shape.y2 - shape.y1) * 0.5;
                    const cp = shape.controlPoints?.[0];
                    const qx = cp ? cp.cx1 : cx;
                    const qy = cp ? cp.cy1 : cy;
                    return <path d={`M ${shape.x1} ${shape.y1} Q ${qx} ${qy} ${shape.x2} ${shape.y2}`} fill="none" stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} strokeLinecap="round" />;
                })()}
                {/* 功能8: 多边形 (默认正六边形) */}
                {shape.type === 'polygon' && (() => {
                    const pts = shape.points || (() => {
                        const cx = (shape.x1 + shape.x2) / 2, cy = (shape.y1 + shape.y2) / 2;
                        const rx = Math.abs(shape.x2 - shape.x1) / 2, ry = Math.abs(shape.y2 - shape.y1) / 2;
                        const sides = 6;
                        return Array.from({ length: sides }, (_, i) => ({
                            x: cx + rx * Math.cos(2 * Math.PI * i / sides - Math.PI / 2),
                            y: cy + ry * Math.sin(2 * Math.PI * i / sides - Math.PI / 2)
                        }));
                    })();
                    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                    return <path d={d} fill={getFillValue()} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} strokeLinejoin="round" />;
                })()}
                {/* 功能15: 标注连线 (callout) */}
                {shape.type === 'callout' && (() => {
                    const midX = (shape.x1 + shape.x2) / 2;
                    const midY = shape.y1;
                    const textW = Math.max(60, (shape.calloutText?.length || 4) * 8);
                    const textH = 24;
                    const fontSize = shape.calloutFontSize || 12;
                    return (
                        <>
                            {/* 折线标注线 */}
                            <polyline points={`${shape.x1},${shape.y1} ${midX},${midY - 20} ${shape.x2},${shape.y2 - textH}`} fill="none" stroke={shape.color} strokeWidth={shape.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
                            {/* 圆点 */}
                            <circle cx={shape.x1} cy={shape.y1} r={3} fill={shape.color} />
                            {/* 文字框 */}
                            <rect x={shape.x2 - textW / 2} y={shape.y2 - textH} width={textW} height={textH} rx={4} fill="white" stroke={shape.color} strokeWidth={1} />
                            <text x={shape.x2} y={shape.y2 - textH / 2 + fontSize * 0.35} textAnchor="middle" fill={shape.color} fontSize={fontSize} fontWeight="bold" fontFamily="sans-serif">
                                {shape.calloutText || 'Label'}
                            </text>
                        </>
                    );
                })()}
                {/* 功能8: 徒手画 */}
                {shape.type === 'freehand' && (() => {
                    const pts = shape.points || [{ x: shape.x1, y: shape.y1 }, { x: (shape.x1 + shape.x2) / 2, y: Math.min(shape.y1, shape.y2) - 30 }, { x: shape.x2, y: shape.y2 }];
                    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    return <path d={d} fill="none" stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} strokeLinecap="round" strokeLinejoin="round" />;
                })()}
                {isLineOrArrow ? (
                    <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="transparent" strokeWidth={Math.max(15, shape.strokeWidth + 10)} />
                ) : (
                    <rect x={Math.min(shape.x1, shape.x2) - 5} y={Math.min(shape.y1, shape.y2) - 5} width={Math.abs(shape.x2 - shape.x1) + 10} height={Math.abs(shape.y2 - shape.y1) + 10} fill="transparent" stroke="transparent" strokeWidth={5} />
                )}
            </g>

            {isSelected && (
                <>
                    <circle cx={shape.x1} cy={shape.y1} r={6} fill="white" stroke="#4f46e5" strokeWidth={2} className="pointer-events-auto cursor-nwse-resize shadow-sm" onMouseDown={(e) => onMouseDown('p1', e)} />
                    <circle cx={shape.x2} cy={shape.y2} r={6} fill="white" stroke="#4f46e5" strokeWidth={2} className="pointer-events-auto cursor-nwse-resize shadow-sm" onMouseDown={(e) => onMouseDown('p2', e)} />
                </>
            )}
        </svg>

        {isSelected && (
            <div 
                className="absolute bg-slate-900/95 text-white rounded-full shadow-2xl border border-white/20 flex items-center gap-2 p-1.5 z-[100] whitespace-nowrap animate-reveal"
                style={{ left: (shape.x1 + shape.x2) / 2, top: Math.min(shape.y1, shape.y2) - 55, transform: 'translateX(-50%)', pointerEvents: 'auto' }}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()} // 拦截双击
            >
                <div className="flex flex-col items-center px-1">
                    <button 
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isBatch ? 'bg-amber-50 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'text-slate-400 hover:bg-white/20 hover:text-white'}`}
                        onClick={() => setIsBatch(!isBatch)}
                        title={isBatch ? "已开启联动" : "开启联动"}
                    >
                        <i className="fa-solid fa-link text-[10px]"></i>
                    </button>
                    <span className="text-[5px] font-black text-indigo-400 uppercase tracking-tighter mt-0.5 opacity-60">默认设定</span>
                </div>
                
                <div className="w-px h-8 bg-white/20 mx-1"></div>

                {/* Editable Stroke Width Input */}
                <div className="flex items-center bg-white/10 rounded-lg p-0.5">
                    <button onClick={() => onUpdate({ strokeWidth: Math.round(Math.max(0.5, shape.strokeWidth - 1)) }, isBatch)} className="w-6 h-7 hover:bg-white/10 flex items-center justify-center text-xs"><i className="fa-solid fa-minus"></i></button>
                    <input 
                      type="number"
                      step="1"
                      className="w-10 bg-transparent border-none outline-none text-white font-mono font-black text-[10px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={localStrokeWidth === 0 ? '' : localStrokeWidth}
                      onChange={handleStrokeWidthChange}
                      onWheel={handleWheel}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button onClick={() => onUpdate({ strokeWidth: Math.round(Math.min(20, shape.strokeWidth + 1)) }, isBatch)} className="w-6 h-7 hover:bg-white/10 flex items-center justify-center text-xs"><i className="fa-solid fa-plus"></i></button>
                </div>
                
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/20 cursor-pointer hover:scale-110 transition-transform">
                    <input type="color" className="absolute -top-2 -left-2 w-12 h-12 p-0 border-none cursor-pointer" value={shape.color} onChange={(e) => onUpdate({ color: e.target.value }, isBatch)} title="调色板" />
                </div>

                <button onClick={(e) => { e.stopPropagation(); cycleDashStyle(); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-indigo-600 text-white transition-all shadow-sm">
                    <i className={`fa-solid ${shape.dashStyle === 'dashed' ? 'fa-minus' : shape.dashStyle === 'dotted' ? 'fa-ellipsis' : 'fa-minus'}`}></i>
                </button>

                {shape.type === 'arrow' && (
                    <button onClick={(e) => { e.stopPropagation(); cycleHeadStyle(); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-indigo-600 text-white transition-all shadow-sm">
                        {shape.headStyle === 'double-solid' ? <i className="fa-solid fa-arrows-left-right text-[10px]"></i> :
                         shape.headStyle === 'double-open' ? <i className="fa-solid fa-arrows-alt-h text-[10px]"></i> :
                         shape.headStyle === 't-bar' ? <span className="font-black text-[10px]">--|</span> :
                         shape.headStyle === 'circle' ? <i className="fa-regular fa-dot-circle text-[10px]"></i> :
                         <i className={`fa-solid ${shape.headStyle === 'open' ? 'fa-chevron-right' : shape.headStyle === 'none' ? 'fa-slash' : 'fa-long-arrow-right'}`}></i>}
                    </button>
                )}

                {/* 功能14: 填充切换按钮 */}
                {isClosedShape && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const fillTypes: ('none' | 'solid' | 'linear-gradient' | 'radial-gradient' | 'pattern')[] = ['none', 'solid', 'linear-gradient', 'radial-gradient', 'pattern'];
                            const current = shape.fill?.type || 'none';
                            const currentIdx = fillTypes.indexOf(current as any);
                            const next = fillTypes[(currentIdx + 1) % fillTypes.length];
                            if (next === 'none') {
                                onUpdate({ fill: undefined } as any, isBatch);
                            } else if (next === 'solid') {
                                onUpdate({ fill: { type: 'solid', color: shape.color + '40' } }, isBatch);
                            } else if (next === 'linear-gradient') {
                                onUpdate({ fill: { type: 'linear-gradient', gradient: { from: shape.color, to: '#ffffff' } } }, isBatch);
                            } else if (next === 'radial-gradient') {
                                onUpdate({ fill: { type: 'radial-gradient', gradient: { from: shape.color, to: '#ffffff' } } }, isBatch);
                            } else {
                                onUpdate({ fill: { type: 'pattern', pattern: 'diagonal' } }, isBatch);
                            }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-teal-600 text-white transition-all shadow-sm"
                        title={`填充: ${shape.fill?.type || '无'}`}
                    >
                        <i className="fa-solid fa-fill-drip text-[10px]"></i>
                    </button>
                )}

                {/* 功能15: Callout 文字编辑 */}
                {shape.type === 'callout' && (
                    <input
                        type="text"
                        className="w-20 bg-white/10 border border-white/20 rounded px-1 py-0.5 text-[10px] text-white outline-none"
                        value={shape.calloutText || ''}
                        placeholder="Label"
                        onChange={(e) => onUpdate({ calloutText: e.target.value }, isBatch)}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}

                <div className="w-px h-8 bg-white/20 mx-1"></div>

                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
            </div>
        )}
    </div>
  );
};
