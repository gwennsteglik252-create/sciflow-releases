
import React, { useEffect, RefObject } from 'react';
import { ParticleData, XrdPeakData, AnalysisMode } from './types';

interface VisionCanvasProps {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    imgRef: RefObject<HTMLImageElement | null>;
    containerRef: RefObject<HTMLDivElement | null>;
    imageSrc: string;
    mode: AnalysisMode;

    isCalibrating: boolean;
    setIsCalibrating: (val: boolean) => void;
    scaleRatio: number | null;
    setScaleRatio: (val: number | null) => void;

    calibrationLine: { start: { x: number, y: number }, end: { x: number, y: number } } | null;
    setCalibrationLine: (val: { start: { x: number, y: number }, end: { x: number, y: number } } | null) => void;
    tempLineEnd: { x: number, y: number } | null;
    setTempLineEnd: (val: { x: number, y: number } | null) => void;

    particles: ParticleData[];
    xrdPeaks: XrdPeakData[];
    hoveredParticleId: number | null;

    sheetOverlay?: ImageData | null;

    // TEM Props
    latticeLine?: { start: { x: number, y: number }, end: { x: number, y: number } } | null;
    fftBox?: { x: number, y: number } | null;
    fftSize?: number;

    // Zoom & Pan
    zoom?: number;
    setZoom?: React.Dispatch<React.SetStateAction<number>>;
    pan?: { x: number, y: number };
    setPan?: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;

    // TEM Angle mode
    angleLine1?: { start: { x: number, y: number }, end: { x: number, y: number } } | null;
    angleLine2?: { start: { x: number, y: number }, end: { x: number, y: number } } | null;
    angleResult?: { angleDeg: number } | null;

    // TEM SAED mode
    saedResult?: { centerX: number, centerY: number, rings: Array<{ radiusPx: number, dSpacing: number, hkl?: string, material?: string }> } | null;

    // TEM EDS mode
    edsLayers?: Array<{ id: string, imageSrc: string, color: string, opacity: number, visible: boolean, element: string }>;

    // XRD Props
    showStandardLine?: boolean;

    imgError: boolean;
    setImgError: (val: boolean) => void;
    isProcessing: boolean;

    showCalibrationInput: boolean;
    setShowCalibrationInput: (val: boolean) => void;
    realLengthInput: string;
    setRealLengthInput: (val: string) => void;
    onConfirmCalibration: () => void;
    onCancelCalibration: () => void;

    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onCanvasClick: (e: React.MouseEvent) => void;
    onWheel?: (e: React.WheelEvent) => void;
    onClearImage: () => void;
    onResetReport: () => void;
}

const VisionCanvas: React.FC<VisionCanvasProps> = ({
    canvasRef, imgRef, containerRef, imageSrc, mode,
    isCalibrating, setIsCalibrating, scaleRatio, setScaleRatio,
    calibrationLine, setCalibrationLine, tempLineEnd, setTempLineEnd,
    particles, xrdPeaks, hoveredParticleId, sheetOverlay,
    latticeLine, fftBox, fftSize: fftSizeProp, zoom: zoomProp, setZoom, pan: panProp, setPan,
    angleLine1, angleLine2, angleResult,
    saedResult, edsLayers,
    showStandardLine,
    imgError, setImgError, isProcessing,
    showCalibrationInput, realLengthInput, setRealLengthInput, onConfirmCalibration, onCancelCalibration,
    onMouseDown, onMouseMove, onMouseUp, onCanvasClick, onWheel, onClearImage, onResetReport
}) => {
    const fftSize = fftSizeProp || 128;
    const zoom = zoomProp || 1;
    const panX = panProp?.x || 0;
    const panY = panProp?.y || 0;

    // --- Canvas Drawing Logic ---
    const drawOverlay = () => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img) return;

        if (canvas.width !== img.clientWidth || canvas.height !== img.clientHeight) {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 0. Draw Sheet Overlay (Heatmap) if available
        if (sheetOverlay && mode === 'SEM') {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = sheetOverlay.width;
            tempCanvas.height = sheetOverlay.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.putImageData(sheetOverlay, 0, 0);
                ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
            }
        }

        // 1. Draw Calibration Line (Amber)
        if (calibrationLine) {
            ctx.beginPath();
            ctx.moveTo(calibrationLine.start.x, calibrationLine.start.y);
            ctx.lineTo(calibrationLine.end.x, calibrationLine.end.y);
            ctx.strokeStyle = '#f59e0b'; // Amber
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = '#f59e0b';
            ctx.beginPath(); ctx.arc(calibrationLine.start.x, calibrationLine.start.y, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(calibrationLine.end.x, calibrationLine.end.y, 4, 0, Math.PI * 2); ctx.fill();

            if (scaleRatio) {
                const midX = (calibrationLine.start.x + calibrationLine.end.x) / 2;
                const midY = (calibrationLine.start.y + calibrationLine.end.y) / 2;
                const pixelLen = Math.hypot(calibrationLine.end.x - calibrationLine.start.x, calibrationLine.end.y - calibrationLine.start.y);
                const realLen = (pixelLen * scaleRatio).toFixed(1);

                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(midX - 30, midY - 20, 60, 20);
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${realLen} nm`, midX, midY - 6);
            }
        }

        if (isCalibrating && calibrationLine?.start && tempLineEnd) {
            ctx.beginPath();
            ctx.moveTo(calibrationLine.start.x, calibrationLine.start.y);
            ctx.lineTo(tempLineEnd.x, tempLineEnd.y);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // 2. Draw TEM Lattice Line (Cyan)
        if (mode === 'TEM' && latticeLine) {
            ctx.beginPath();
            ctx.moveTo(latticeLine.start.x, latticeLine.start.y);
            ctx.lineTo(latticeLine.end.x, latticeLine.end.y);
            ctx.strokeStyle = '#06b6d4'; // Cyan
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#06b6d4';
            ctx.beginPath(); ctx.arc(latticeLine.start.x, latticeLine.start.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(latticeLine.end.x, latticeLine.end.y, 3, 0, Math.PI * 2); ctx.fill();
        }

        // 3. Draw FFT Box (Yellow) — uses dynamic fftSize
        if (mode === 'TEM' && fftBox) {
            ctx.strokeStyle = '#facc15'; // Yellow
            ctx.lineWidth = 2;
            ctx.strokeRect(fftBox.x, fftBox.y, fftSize, fftSize);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
            ctx.fillRect(fftBox.x, fftBox.y, fftSize, fftSize);
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 9px Arial';
            ctx.fillText(`FFT ${fftSize}px`, fftBox.x, fftBox.y - 5);
        }

        // 3a. Draw TEM Angle Lines (Cyan + Fuchsia) + angle arc
        if (mode === 'TEM' && angleLine1) {
            // Line 1 - Cyan
            ctx.beginPath();
            ctx.moveTo(angleLine1.start.x, angleLine1.start.y);
            ctx.lineTo(angleLine1.end.x, angleLine1.end.y);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath(); ctx.arc(angleLine1.start.x, angleLine1.start.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(angleLine1.end.x, angleLine1.end.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.font = 'bold 9px Arial';
            ctx.fillText('L1', angleLine1.end.x + 5, angleLine1.end.y - 5);
        }
        if (mode === 'TEM' && angleLine2) {
            // Line 2 - Fuchsia
            ctx.beginPath();
            ctx.moveTo(angleLine2.start.x, angleLine2.start.y);
            ctx.lineTo(angleLine2.end.x, angleLine2.end.y);
            ctx.strokeStyle = '#d946ef';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#d946ef';
            ctx.beginPath(); ctx.arc(angleLine2.start.x, angleLine2.start.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(angleLine2.end.x, angleLine2.end.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.font = 'bold 9px Arial';
            ctx.fillText('L2', angleLine2.end.x + 5, angleLine2.end.y - 5);
        }
        if (mode === 'TEM' && angleLine1 && angleLine2 && angleResult) {
            // Draw angle arc at intersection area
            const midX = (angleLine1.start.x + angleLine2.start.x) / 2;
            const midY = (angleLine1.start.y + angleLine2.start.y) / 2;
            const angle1 = Math.atan2(angleLine1.end.y - angleLine1.start.y, angleLine1.end.x - angleLine1.start.x);
            const angle2 = Math.atan2(angleLine2.end.y - angleLine2.start.y, angleLine2.end.x - angleLine2.start.x);
            ctx.beginPath();
            ctx.arc(midX, midY, 25, Math.min(angle1, angle2), Math.max(angle1, angle2));
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
            // Angle label
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            ctx.fillRect(midX - 25, midY - 30, 50, 18);
            ctx.fillStyle = '#e9d5ff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${angleResult.angleDeg.toFixed(1)}°`, midX, midY - 16);
            ctx.textAlign = 'start';
        }

        // 3b. Draw SAED rings
        if (mode === 'TEM' && saedResult) {
            const { centerX, centerY, rings } = saedResult;
            // Center cross
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(centerX - 8, centerY); ctx.lineTo(centerX + 8, centerY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(centerX, centerY - 8); ctx.lineTo(centerX, centerY + 8); ctx.stroke();

            rings.forEach((ring, i) => {
                ctx.beginPath();
                ctx.arc(centerX, centerY, ring.radiusPx, 0, Math.PI * 2);
                ctx.strokeStyle = `hsla(${220 + i * 30}, 80%, 65%, 0.8)`;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.stroke();
                ctx.setLineDash([]);

                // Label
                const labelX = centerX + ring.radiusPx * Math.cos(-Math.PI / 4);
                const labelY = centerY + ring.radiusPx * Math.sin(-Math.PI / 4);
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                const labelW = ring.hkl ? 80 : 55;
                ctx.fillRect(labelX - 2, labelY - 12, labelW, 14);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 8px Arial';
                ctx.fillText(`d=${ring.dSpacing.toFixed(3)}${ring.hkl ? ` ${ring.hkl}` : ''}`, labelX, labelY - 2);
            });
        }

        // 3c. Draw EDS overlay layers
        if (mode === 'TEM' && edsLayers && edsLayers.length > 0) {
            edsLayers.forEach(layer => {
                if (!layer.visible || layer.opacity <= 0) return;
                const img = new Image();
                img.src = layer.imageSrc;
                if (img.complete) {
                    ctx.globalAlpha = layer.opacity;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    ctx.globalAlpha = 1.0;
                    // Element label
                    ctx.fillStyle = layer.color;
                    ctx.font = 'bold 10px Arial';
                    ctx.fillText(layer.element, 5, 15 + edsLayers.indexOf(layer) * 14);
                }
            });
        }

        // 4. Draw Particles
        if (mode !== 'XRD' && particles.length > 0) {
            particles.forEach((p, i) => {
                const isHovered = p.id === hoveredParticleId;

                ctx.beginPath();
                if (p.radiusX && p.radiusY) {
                    ctx.ellipse(p.x, p.y, p.radiusX, p.radiusY, p.rotation || 0, 0, 2 * Math.PI);
                } else {
                    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
                }

                ctx.strokeStyle = isHovered ? 'rgba(244, 63, 94, 1)' : 'rgba(52, 211, 153, 0.9)';
                ctx.lineWidth = isHovered ? 3 : 1.5;
                ctx.stroke();

                ctx.fillStyle = isHovered ? 'rgba(244, 63, 94, 0.3)' : 'rgba(52, 211, 153, 0.15)';
                ctx.fill();

                if (isHovered || p.radius > 5 || (p.radiusX && p.radiusX > 5)) {
                    ctx.fillStyle = isHovered ? '#f43f5e' : '#10b981';
                    ctx.font = isHovered ? 'bold 10px Arial' : '8px Arial';
                    const r = p.radiusX || p.radius;
                    ctx.fillText(isHovered ? 'X' : `#${p.id}`, p.x + r, p.y - r);
                }
            });
        }

        // 5. Draw XRD Peaks and Overlays
        if (mode === 'XRD') {
            // Standard Ag Line Overlay
            if (showStandardLine) {
                // Assume 10-90 degree mapping over width for the visual
                // Ag (111) @ 38.12 deg. Map 38.12 to x
                // x = (38.12 - 10) / 80 * width
                const stdX = ((38.12 - 10) / 80) * canvas.width;

                ctx.beginPath();
                ctx.moveTo(stdX, 0);
                ctx.lineTo(stdX, canvas.height);
                ctx.strokeStyle = '#6366f1'; // Indigo
                ctx.lineWidth = 2;
                ctx.setLineDash([10, 5]);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#6366f1';
                ctx.font = 'bold 10px Arial';
                ctx.fillText('Ag (111) Std', stdX + 5, 20);
            }

            if (xrdPeaks.length > 0) {
                xrdPeaks.forEach((peak) => {
                    // Peak vertical line
                    ctx.beginPath();
                    ctx.moveTo(peak.x, 0);
                    ctx.lineTo(peak.x, canvas.height);
                    ctx.strokeStyle = 'rgba(244, 63, 94, 0.8)'; // Rose
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Peak Marker
                    ctx.beginPath();
                    ctx.arc(peak.x, peak.y, 4, 0, 2 * Math.PI);
                    ctx.fillStyle = '#f43f5e';
                    ctx.fill();

                    // Info Bubble
                    const bubbleY = peak.y - 60;
                    const bubbleW = 100;
                    const bubbleH = 50;
                    const bubbleX = peak.x - bubbleW / 2;

                    // Bubble Background
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                    ctx.beginPath();
                    ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 8);
                    ctx.fill();

                    // Bubble Text
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`2θ: ${peak.twoTheta.toFixed(2)}°`, peak.x, bubbleY + 15);
                    ctx.fillStyle = '#cbd5e1';
                    ctx.font = '9px Arial';
                    ctx.fillText(`FWHM: ${peak.fwhm.toFixed(3)}°`, peak.x, bubbleY + 28);
                    ctx.fillStyle = '#fbbf24'; // Amber
                    ctx.fillText(`d: ${peak.dSpacing.toFixed(3)} nm`, peak.x, bubbleY + 41);
                });
            }
        }
    };

    useEffect(() => {
        drawOverlay();
        window.addEventListener('resize', drawOverlay);
        return () => window.removeEventListener('resize', drawOverlay);
    }, [particles, xrdPeaks, calibrationLine, tempLineEnd, scaleRatio, imageSrc, isCalibrating, hoveredParticleId, sheetOverlay, latticeLine, fftBox, showStandardLine, fftSize, angleLine1, angleLine2, angleResult, saedResult, edsLayers]);

    return (
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center group border-2 border-slate-200">
            <div ref={containerRef} className="relative w-full h-full bg-slate-900 overflow-hidden">
                <div style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s ease-out' }} className="relative w-full h-full">
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Analysis Target"
                        className="absolute inset-0 m-auto max-h-full max-w-full object-contain z-0 select-none"
                        onLoad={() => { setImgError(false); drawOverlay(); }}
                        onError={() => setImgError(true)}
                    />
                    <canvas
                        ref={canvasRef}
                        className={`absolute inset-0 m-auto z-10 ${isCalibrating ? 'cursor-crosshair' : 'cursor-pointer'}`}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onClick={onCanvasClick}
                        onWheel={onWheel}
                        title={isCalibrating ? "Drag to calibrate" : mode === 'TEM' ? "Drag to interact" : "Click particles to delete"}
                    />
                </div>
                {/* Zoom Controls — inside canvas container */}
                {setZoom && mode !== 'XRD' && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 z-30">
                        <button onClick={() => setZoom(prev => Math.max(0.5, +(prev - 0.25).toFixed(2)))} className="w-7 h-7 bg-black/60 backdrop-blur text-white rounded-lg flex items-center justify-center hover:bg-black/80 transition-all border border-white/10" title="缩小">
                            <i className="fa-solid fa-minus text-[9px]"></i>
                        </button>
                        <button onClick={() => { setZoom?.(1); setPan?.({ x: 0, y: 0 }); }} className="h-7 px-2 bg-black/60 backdrop-blur text-white rounded-lg flex items-center justify-center hover:bg-black/80 transition-all text-[9px] font-black border border-white/10" title="重置">
                            {Math.round(zoom * 100)}%
                        </button>
                        <button onClick={() => setZoom(prev => Math.min(5, +(prev + 0.25).toFixed(2)))} className="w-7 h-7 bg-black/60 backdrop-blur text-white rounded-lg flex items-center justify-center hover:bg-black/80 transition-all border border-white/10" title="放大">
                            <i className="fa-solid fa-plus text-[9px]"></i>
                        </button>
                        {(zoom !== 1 || panX !== 0 || panY !== 0) && (
                            <button onClick={() => { setZoom?.(1); setPan?.({ x: 0, y: 0 }); }} className="w-7 h-7 bg-indigo-600/80 backdrop-blur text-white rounded-lg flex items-center justify-center hover:bg-indigo-500 transition-all border border-indigo-400/30 ml-1" title="一键归位">
                                <i className="fa-solid fa-crosshairs text-[10px]"></i>
                            </button>
                        )}
                    </div>
                )}
                {imgError && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="w-64 h-32 border-2 border-dashed border-indigo-400 bg-indigo-500/10 rounded-2xl flex flex-col items-center justify-center text-indigo-300 font-black uppercase tracking-widest gap-2">
                            <i className="fa-regular fa-image-slash text-2xl"></i>
                            <span className="text-xs">不能正常显示图片</span>
                        </div>
                    </div>
                )}

                {showCalibrationInput && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <div className="bg-white p-5 rounded-2xl shadow-2xl border border-slate-100 w-64 animate-reveal" onMouseDown={e => e.stopPropagation()}>
                            <h5 className="text-[11px] font-black text-slate-700 uppercase mb-3 text-center flex items-center justify-center gap-2">
                                <i className="fa-solid fa-ruler-horizontal text-indigo-500"></i> 输入实际长度
                            </h5>
                            <div className="flex items-center gap-2 mb-4 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                                <input
                                    autoFocus
                                    type="number"
                                    className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none text-center"
                                    value={realLengthInput}
                                    onChange={e => setRealLengthInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && onConfirmCalibration()}
                                />
                                <span className="text-[10px] font-black text-slate-400">nm</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={onCancelCalibration} className="flex-1 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors">取消</button>
                                <button onClick={onConfirmCalibration} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">确认</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm z-30">
                    <i className="fa-solid fa-spinner animate-spin text-4xl mb-4 text-indigo-400"></i>
                    <p className="text-xs font-black uppercase tracking-[0.2rem]">Vision Computing...</p>
                </div>
            )}

            {/* Image Controls Overlay */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                <button
                    onClick={() => { setIsCalibrating(!isCalibrating); setCalibrationLine(null); setScaleRatio(null); setTempLineEnd(null); }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all border ${isCalibrating || calibrationLine ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-500 hover:text-amber-500'}`}
                    title="标尺校准 (Ruler)"
                >
                    <i className="fa-solid fa-ruler-combined"></i>
                </button>
                <button onClick={() => { onClearImage(); onResetReport(); }} className="w-10 h-10 bg-white/10 backdrop-blur hover:bg-rose-500 rounded-xl flex items-center justify-center text-white transition-all shadow-lg border border-white/20">
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>

            {/* Scale Indicator */}
            {scaleRatio && (
                <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-[9px] font-mono border border-white/20 z-20">
                    Scale: 1px ≈ {scaleRatio.toFixed(2)} nm
                </div>
            )}
        </div>
    );
};

export default VisionCanvas;
