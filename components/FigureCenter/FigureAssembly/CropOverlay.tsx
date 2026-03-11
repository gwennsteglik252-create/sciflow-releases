import React, { useState, useRef, useCallback, useEffect } from 'react';

interface CropOverlayProps {
    panelW: number;
    panelH: number;
    imgUrl: string;
    initialCrop?: { x: number; y: number; w: number; h: number }; // 0-1
    onConfirm: (crop: { x: number; y: number; w: number; h: number }) => void;
    onCancel: () => void;
    onReset: () => void;
}

// ─── Aspect Ratio Presets ────────────────────────────────────────────────────
type Ratio = { label: string; value: number | null; icon?: string };

const RATIOS: Ratio[] = [
    { label: '自由', value: null, icon: 'fa-expand' },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '3:2', value: 3 / 2 },
    { label: '2:3', value: 2 / 3 },
];

/**
 * CropOverlay — 全屏裁剪模式
 * 支持自由裁剪和预设比例锁定
 */
export const CropOverlay: React.FC<CropOverlayProps> = ({
    panelW, panelH, imgUrl, initialCrop, onConfirm, onCancel, onReset
}) => {
    const toPixel = (c: { x: number; y: number; w: number; h: number }) => ({
        x: c.x * panelW, y: c.y * panelH, w: c.w * panelW, h: c.h * panelH
    });
    const toNorm = (p: { x: number; y: number; w: number; h: number }) => ({
        x: p.x / panelW, y: p.y / panelH, w: p.w / panelW, h: p.h / panelH
    });

    const defaultPx = initialCrop
        ? toPixel(initialCrop)
        : { x: panelW * 0.1, y: panelH * 0.1, w: panelW * 0.8, h: panelH * 0.8 };

    const [crop, setCrop] = useState(defaultPx);
    const [aspectRatio, setAspectRatio] = useState<number | null>(null); // null = free
    const [dragMode, setDragMode] = useState<
        null | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'draw'
    >(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [cropStart, setCropStart] = useState(crop);
    const overlayRef = useRef<HTMLDivElement>(null);

    const clamp = useCallback((v: number, min: number, max: number) => Math.max(min, Math.min(max, v)), []);

    // ─── Apply ratio constraint to crop rect ─────────────────────────────────
    const applyRatio = useCallback((c: typeof crop, ratio: number | null, anchor: 'center' | 'nw' | 'ne' | 'sw' | 'se' = 'center') => {
        if (!ratio) return c;
        let { x, y, w, h } = c;
        // Determine new dimensions based on the dominant axis
        const currentR = w / h;
        if (currentR > ratio) {
            // Too wide → shrink width
            const newW = h * ratio;
            if (anchor === 'ne' || anchor === 'se') x = x; // left stays
            else if (anchor === 'nw' || anchor === 'sw') x = x + w - newW;
            else x = x + (w - newW) / 2;
            w = newW;
        } else {
            // Too tall → shrink height
            const newH = w / ratio;
            if (anchor === 'sw' || anchor === 'se') y = y; // top stays
            else if (anchor === 'nw' || anchor === 'ne') y = y + h - newH;
            else y = y + (h - newH) / 2;
            h = newH;
        }
        // Clamp to panel bounds
        x = clamp(x, 0, panelW - w);
        y = clamp(y, 0, panelH - h);
        return { x, y, w: Math.max(20, w), h: Math.max(20, h) };
    }, [panelW, panelH, clamp]);

    // When user picks a new ratio, re-apply to current crop
    const handleRatioChange = useCallback((ratio: number | null) => {
        setAspectRatio(ratio);
        if (ratio) setCrop(prev => applyRatio(prev, ratio));
    }, [applyRatio]);

    const handleMouseDown = (e: React.MouseEvent, mode: typeof dragMode) => {
        e.stopPropagation();
        e.preventDefault();
        setDragMode(mode);
        setDragStart({ x: e.clientX, y: e.clientY });
        setCropStart({ ...crop });
    };

    const handleOverlayMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;
        const ox = e.clientX - rect.left;
        const oy = e.clientY - rect.top;
        setDragMode('draw');
        setDragStart({ x: e.clientX, y: e.clientY });
        setCropStart({ x: ox, y: oy, w: 0, h: 0 });
        setCrop({ x: ox, y: oy, w: 0, h: 0 });
    };

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            if (!dragMode) return;
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            if (dragMode === 'draw') {
                let nx = Math.min(cropStart.x, cropStart.x + dx);
                let ny = Math.min(cropStart.y, cropStart.y + dy);
                let nw = Math.abs(dx);
                let nh = Math.abs(dy);
                // Lock ratio while drawing
                if (aspectRatio) {
                    nh = nw / aspectRatio;
                    if (dy < 0) ny = cropStart.y - nh;
                }
                setCrop({
                    x: clamp(nx, 0, panelW - 10),
                    y: clamp(ny, 0, panelH - 10),
                    w: clamp(nw, 10, panelW - clamp(nx, 0, panelW)),
                    h: clamp(nh, 10, panelH - clamp(ny, 0, panelH))
                });
                return;
            }

            if (dragMode === 'move') {
                setCrop({
                    ...cropStart,
                    x: clamp(cropStart.x + dx, 0, panelW - cropStart.w),
                    y: clamp(cropStart.y + dy, 0, panelH - cropStart.h)
                });
                return;
            }

            // Resize handles with ratio lock
            let nx = cropStart.x, ny = cropStart.y, nw = cropStart.w, nh = cropStart.h;

            if (aspectRatio) {
                // For locked ratio, use diagonal movement
                const diag = (dx + dy) / 2;
                if (dragMode === 'se') { nw = clamp(cropStart.w + dx, 20, panelW - nx); nh = nw / aspectRatio; }
                else if (dragMode === 'nw') { nw = clamp(cropStart.w - dx, 20, cropStart.x + cropStart.w); nh = nw / aspectRatio; nx = cropStart.x + cropStart.w - nw; ny = cropStart.y + cropStart.h - nh; }
                else if (dragMode === 'ne') { nw = clamp(cropStart.w + dx, 20, panelW - nx); nh = nw / aspectRatio; ny = cropStart.y + cropStart.h - nh; }
                else if (dragMode === 'sw') { nw = clamp(cropStart.w - dx, 20, cropStart.x + cropStart.w); nh = nw / aspectRatio; nx = cropStart.x + cropStart.w - nw; }
                else if (dragMode === 'e' || dragMode === 'w') {
                    if (dragMode === 'w') { nw = clamp(cropStart.w - dx, 20, cropStart.x + cropStart.w); nx = cropStart.x + cropStart.w - nw; }
                    else { nw = clamp(cropStart.w + dx, 20, panelW - nx); }
                    nh = nw / aspectRatio; const dh = nh - cropStart.h; ny = cropStart.y - dh / 2;
                }
                else if (dragMode === 'n' || dragMode === 's') {
                    if (dragMode === 'n') { nh = clamp(cropStart.h - dy, 20, cropStart.y + cropStart.h); ny = cropStart.y + cropStart.h - nh; }
                    else { nh = clamp(cropStart.h + dy, 20, panelH - ny); }
                    nw = nh * aspectRatio; const dw = nw - cropStart.w; nx = cropStart.x - dw / 2;
                }
            } else {
                // Free resize
                if (dragMode.includes('w')) { nx = clamp(cropStart.x + dx, 0, cropStart.x + cropStart.w - 20); nw = cropStart.w - (nx - cropStart.x); }
                if (dragMode.includes('e')) { nw = clamp(cropStart.w + dx, 20, panelW - cropStart.x); }
                if (dragMode.includes('n')) { ny = clamp(cropStart.y + dy, 0, cropStart.y + cropStart.h - 20); nh = cropStart.h - (ny - cropStart.y); }
                if (dragMode.includes('s')) { nh = clamp(cropStart.h + dy, 20, panelH - cropStart.y); }
            }

            // Clamp to bounds
            nx = clamp(nx, 0, panelW - nw);
            ny = clamp(ny, 0, panelH - nh);
            setCrop({ x: nx, y: ny, w: Math.max(20, nw), h: Math.max(20, nh) });
        };

        const handleUp = () => setDragMode(null);

        if (dragMode) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [dragMode, dragStart, cropStart, panelW, panelH, clamp, aspectRatio]);

    // Keyboard
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); onConfirm(toNorm(crop)); }
            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [crop, onConfirm, onCancel]);

    const handleSize = 8;
    const handles: { key: string; mode: typeof dragMode; cursor: string; style: React.CSSProperties }[] = [
        { key: 'nw', mode: 'nw', cursor: 'nwse-resize', style: { left: -handleSize / 2, top: -handleSize / 2 } },
        { key: 'ne', mode: 'ne', cursor: 'nesw-resize', style: { right: -handleSize / 2, top: -handleSize / 2 } },
        { key: 'sw', mode: 'sw', cursor: 'nesw-resize', style: { left: -handleSize / 2, bottom: -handleSize / 2 } },
        { key: 'se', mode: 'se', cursor: 'nwse-resize', style: { right: -handleSize / 2, bottom: -handleSize / 2 } },
        { key: 'n', mode: 'n', cursor: 'ns-resize', style: { left: '50%', top: -handleSize / 2, transform: 'translateX(-50%)' } },
        { key: 's', mode: 's', cursor: 'ns-resize', style: { left: '50%', bottom: -handleSize / 2, transform: 'translateX(-50%)' } },
        { key: 'w', mode: 'w', cursor: 'ew-resize', style: { left: -handleSize / 2, top: '50%', transform: 'translateY(-50%)' } },
        { key: 'e', mode: 'e', cursor: 'ew-resize', style: { right: -handleSize / 2, top: '50%', transform: 'translateY(-50%)' } },
    ];

    const cropPct = toNorm(crop);
    const dimText = `${Math.round(cropPct.w * 100)}% × ${Math.round(cropPct.h * 100)}%`;

    return (
        <div
            ref={overlayRef}
            className="absolute inset-0 z-[500]"
            style={{ cursor: 'crosshair' }}
            onMouseDown={handleOverlayMouseDown}
        >
            {/* Full uncropped image as background */}
            <img
                src={imgUrl}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                alt=""
                draggable={false}
            />

            {/* Dark mask */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                <div className="absolute bg-black/60" style={{ left: 0, top: 0, width: '100%', height: crop.y }} />
                <div className="absolute bg-black/60" style={{ left: 0, top: crop.y + crop.h, width: '100%', bottom: 0 }} />
                <div className="absolute bg-black/60" style={{ left: 0, top: crop.y, width: crop.x, height: crop.h }} />
                <div className="absolute bg-black/60" style={{ left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h }} />
            </div>

            {/* Crop selection box */}
            <div
                className="absolute border-2 border-white shadow-lg"
                style={{
                    left: crop.x, top: crop.y, width: crop.w, height: crop.h,
                    cursor: 'move', zIndex: 2,
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 0 12px rgba(99,102,241,0.5)',
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
            >
                {/* Rule of thirds grid */}
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
                    <div className="absolute bg-white/20" style={{ left: '33.33%', top: 0, width: 1, height: '100%' }} />
                    <div className="absolute bg-white/20" style={{ left: '66.66%', top: 0, width: 1, height: '100%' }} />
                    <div className="absolute bg-white/20" style={{ left: 0, top: '33.33%', width: '100%', height: 1 }} />
                    <div className="absolute bg-white/20" style={{ left: 0, top: '66.66%', width: '100%', height: 1 }} />
                </div>

                {/* Resize handles */}
                {handles.map(h => (
                    <div
                        key={h.key}
                        className="absolute bg-white border border-indigo-500 rounded-sm shadow-md hover:bg-indigo-100 transition-colors"
                        style={{ width: handleSize, height: handleSize, cursor: h.cursor, zIndex: 3, ...h.style }}
                        onMouseDown={(e) => handleMouseDown(e, h.mode)}
                    />
                ))}

                {/* dimension + ratio label */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
                    <span className="bg-slate-900/90 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-md whitespace-nowrap shadow-lg">
                        {dimText}
                    </span>
                    {aspectRatio && (
                        <span className="bg-indigo-600/90 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-lg">
                            {RATIOS.find(r => r.value === aspectRatio)?.label}
                        </span>
                    )}
                </div>
            </div>

            {/* ─── Top: Aspect Ratio Selector ────────────────────────────────────── */}
            <div
                className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-2xl border border-white/10 no-export"
                style={{ zIndex: 10 }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest mr-1.5 shrink-0">比例</span>
                {RATIOS.map(r => {
                    const isActive = aspectRatio === r.value;
                    return (
                        <button
                            key={r.label}
                            onClick={(e) => { e.stopPropagation(); handleRatioChange(r.value); }}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all active:scale-95 whitespace-nowrap ${isActive
                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/15 hover:text-white'
                                }`}
                            title={r.label}
                        >
                            {r.icon ? <i className={`fa-solid ${r.icon} text-[8px]`}></i> : r.label}
                        </button>
                    );
                })}
            </div>

            {/* ─── Bottom: Action buttons ────────────────────────────────────────── */}
            <div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-2xl border border-white/10 no-export"
                style={{ zIndex: 10 }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onConfirm(toNorm(crop)); }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-lg"
                >
                    <i className="fa-solid fa-check text-[9px]"></i> 确认裁剪
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onReset(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/80 hover:bg-amber-400 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                >
                    <i className="fa-solid fa-rotate-left text-[9px]"></i> 重置
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95"
                >
                    <i className="fa-solid fa-times text-[9px]"></i> 取消
                </button>
                <span className="text-[8px] text-white/30 ml-2 font-mono">Enter确认 · Esc取消</span>
            </div>
        </div>
    );
};
