import { XrdPeakData } from './types';
import { calculateBraggD, calculateScherrer } from '../xrdUtils';

export const performGaussianFitting = (
    ctx: CanvasRenderingContext2D, clickX: number, clickY: number, width: number, height: number, wavelength: number, shapeFactor: number
): XrdPeakData | null => {
    const startY = Math.max(0, clickY - 20); const safeH = Math.min(height - startY, 40);
    const data = ctx.getImageData(0, startY, width, safeH).data;
    const profile = new Float32Array(width);
    for (let x = 0; x < width; x++) {
        let s = 0; for (let y = 0; y < safeH; y++) s += (255 - (0.299 * data[(y*width+x)*4] + 0.587 * data[(y*width+x)*4+1] + 0.114 * data[(y*width+x)*4+2]));
        profile[x] = s / safeH;
    }
    const smoothed = new Float32Array(width);
    for (let i = 0; i < width; i++) {
        let s = 0, c = 0; for (let k = -5; k <= 5; k++) if (i+k >= 0 && i+k < width) { s += profile[i+k]; c++; }
        smoothed[i] = s / c;
    }
    let peakX = clickX, maxVal = -Infinity;
    for (let i = Math.max(0, clickX-50); i <= Math.min(width-1, clickX+50); i++) if (smoothed[i] > maxVal) { maxVal = smoothed[i]; peakX = i; }
    const halfMax = maxVal / 2; let lx = peakX, rx = peakX;
    while (lx > 0 && smoothed[lx] > halfMax) lx--; while (rx < width - 1 && smoothed[rx] > halfMax) rx++;
    const mapPxToTheta = (px: number) => 10 + (px / width) * 80;
    const twoTheta = mapPxToTheta(peakX), fwhm = mapPxToTheta(rx) - mapPxToTheta(lx);
    return { id: Date.now(), x: peakX, y: clickY, twoTheta, intensity: maxVal, fwhm, dSpacing: calculateBraggD(twoTheta, wavelength), crystalliteSize: calculateScherrer(fwhm, twoTheta, wavelength, shapeFactor), shiftAnalysis: "" };
};

export const generateXrdPlotImage = (data: {x: number, y: number}[], width = 1200, height = 800) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height);
    const xs = data.map(d => d.x), ys = data.map(d => d.y), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scaleX = (x: number) => 80 + ((x - minX) / (maxX - minX)) * (width - 160);
    const scaleY = (y: number) => (height - 80) - ((y - minY) / (maxY - minY)) * (height - 160);
    ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(80, 80); ctx.lineTo(80, height-80); ctx.lineTo(width-80, height-80); ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 3;
    if (data.length > 0) {
        ctx.moveTo(scaleX(data[0].x), scaleY(data[0].y));
        for (let i = 1; i < data.length; i++) ctx.lineTo(scaleX(data[i].x), scaleY(data[i].y));
    }
    ctx.stroke(); return canvas.toDataURL('image/png');
};