
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

            <g className="pointer-events-auto cursor-move" onMouseDown={(e) => onMouseDown('move', e)}>
                {shape.type === 'arrow' && (
                    <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} {...getMarkers()} strokeLinecap="round" />
                )}
                {shape.type === 'line' && (
                    <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} strokeLinecap="round" />
                )}
                {shape.type === 'rect' && (
                    <rect x={Math.min(shape.x1, shape.x2)} y={Math.min(shape.y1, shape.y2)} width={Math.abs(shape.x2 - shape.x1)} height={Math.abs(shape.y2 - shape.y1)} fill="transparent" stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} />
                )}
                {shape.type === 'circle' && (
                    <ellipse cx={(shape.x1 + shape.x2) / 2} cy={(shape.y1 + shape.y2) / 2} rx={Math.abs(shape.x2 - shape.x1) / 2} ry={Math.abs(shape.y2 - shape.y1) / 2} fill="transparent" stroke={shape.color} strokeWidth={shape.strokeWidth} strokeDasharray={getDashArray()} />
                )}
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

                <div className="w-px h-8 bg-white/20 mx-1"></div>

                <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
            </div>
        )}
    </div>
  );
};
