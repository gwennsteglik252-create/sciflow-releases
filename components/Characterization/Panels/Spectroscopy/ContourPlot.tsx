/**
 * ContourPlot.tsx
 * 等高线/热力图（Canvas 2D 渲染）
 * X 轴: Wavenumber, Y 轴: Voltage, 颜色: Intensity
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { extractVoltageKeys, voltageKeyToValue, SpectrumDataPoint } from './spectroscopyAnalysis';

interface Props {
    dataset: SpectrumDataPoint[];
}

type ColorMap = 'viridis' | 'plasma' | 'inferno';

// 颜色映射表
const COLOR_MAPS: Record<ColorMap, number[][]> = {
    viridis: [
        [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142],
        [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89],
        [180, 222, 44], [253, 231, 37],
    ],
    plasma: [
        [13, 8, 135], [75, 3, 161], [125, 3, 168], [168, 34, 150],
        [203, 70, 121], [229, 107, 93], [248, 148, 65], [253, 195, 40],
        [240, 249, 33], [252, 255, 164],
    ],
    inferno: [
        [0, 0, 4], [22, 11, 57], [66, 10, 104], [106, 23, 110],
        [147, 38, 103], [188, 55, 84], [221, 81, 58], [243, 118, 27],
        [249, 166, 10], [252, 255, 164],
    ],
};

function interpolateColor(colorMap: number[][], t: number): [number, number, number] {
    const idx = Math.min(t * (colorMap.length - 1), colorMap.length - 1.001);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const frac = idx - lo;
    return [
        Math.round(colorMap[lo][0] + (colorMap[hi][0] - colorMap[lo][0]) * frac),
        Math.round(colorMap[lo][1] + (colorMap[hi][1] - colorMap[lo][1]) * frac),
        Math.round(colorMap[lo][2] + (colorMap[hi][2] - colorMap[lo][2]) * frac),
    ];
}

const ContourPlot: React.FC<Props> = ({ dataset }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const voltageKeys = useMemo(() => extractVoltageKeys(dataset), [dataset]);
    const [colorMap, setColorMap] = useState<ColorMap>('viridis');
    const [showContourLines, setShowContourLines] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || dataset.length === 0 || voltageKeys.length === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        const W = rect.width;
        const H = rect.height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;

        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const margin = { top: 30, right: 80, bottom: 60, left: 70 };
        const plotW = W - margin.left - margin.right;
        const plotH = H - margin.top - margin.bottom;

        const wavenumbers = dataset.map(d => d.wavenumber);
        const minWN = Math.min(...wavenumbers);
        const maxWN = Math.max(...wavenumbers);
        const voltages = voltageKeys.map(voltageKeyToValue);
        const minV = Math.min(...voltages);
        const maxV = Math.max(...voltages);

        // 收集强度范围
        let minI = Infinity, maxI = -Infinity;
        for (const d of dataset) {
            for (const key of voltageKeys) {
                const val = d[key] as number || 0;
                if (val < minI) minI = val;
                if (val > maxI) maxI = val;
            }
        }
        const rangeI = maxI - minI || 1;

        // 双线性插值渲染热力图
        const imgW = Math.min(plotW, 400);
        const imgH = Math.min(plotH, 200);
        const imageData = ctx.createImageData(imgW, imgH);

        for (let py = 0; py < imgH; py++) {
            const t = py / (imgH - 1);
            const v = maxV - t * (maxV - minV); // Y轴从上到下: 高电位到低电位

            // 找到相邻的两个电位键进行插值
            let loIdx = 0, hiIdx = 0;
            for (let i = 0; i < voltages.length - 1; i++) {
                if (v >= voltages[i] && v <= voltages[i + 1]) { loIdx = i; hiIdx = i + 1; break; }
            }
            if (v <= voltages[0]) { loIdx = 0; hiIdx = 0; }
            if (v >= voltages[voltages.length - 1]) { loIdx = voltages.length - 1; hiIdx = voltages.length - 1; }
            const vFrac = loIdx === hiIdx ? 0 : (v - voltages[loIdx]) / (voltages[hiIdx] - voltages[loIdx]);

            for (let px = 0; px < imgW; px++) {
                const wnFrac = px / (imgW - 1);
                const wn = minWN + wnFrac * (maxWN - minWN);

                // 在波数维度插值
                let wnLoIdx = 0;
                for (let i = 0; i < wavenumbers.length - 1; i++) {
                    if (wn >= wavenumbers[i] && wn <= wavenumbers[i + 1]) { wnLoIdx = i; break; }
                }
                const wnHiIdx = Math.min(wnLoIdx + 1, wavenumbers.length - 1);
                const wnFracLocal = wnLoIdx === wnHiIdx ? 0 : (wn - wavenumbers[wnLoIdx]) / (wavenumbers[wnHiIdx] - wavenumbers[wnLoIdx]);

                // 双线性插值
                const loKey = voltageKeys[loIdx];
                const hiKey = voltageKeys[hiIdx];
                const v00 = dataset[wnLoIdx]?.[loKey] as number || 0;
                const v10 = dataset[wnHiIdx]?.[loKey] as number || 0;
                const v01 = dataset[wnLoIdx]?.[hiKey] as number || 0;
                const v11 = dataset[wnHiIdx]?.[hiKey] as number || 0;

                const vLo = v00 + (v10 - v00) * wnFracLocal;
                const vHi = v01 + (v11 - v01) * wnFracLocal;
                const intensity = vLo + (vHi - vLo) * vFrac;

                const norm = (intensity - minI) / rangeI;
                const [r, g, b] = interpolateColor(COLOR_MAPS[colorMap], Math.max(0, Math.min(1, norm)));

                const idx = (py * imgW + px) * 4;
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = 255;
            }
        }

        // 先绘制到临时 canvas 再缩放
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = imgW;
        tmpCanvas.height = imgH;
        const tmpCtx = tmpCanvas.getContext('2d')!;
        tmpCtx.putImageData(imageData, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tmpCanvas, margin.left, margin.top, plotW, plotH);

        // 等高线（可选）
        if (showContourLines) {
            const levels = 8;
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;

            for (let level = 1; level < levels; level++) {
                const threshold = minI + (rangeI * level) / levels;
                // 简单的marching squares近似：在数据网格上绘制等值线
                for (let vi = 0; vi < voltageKeys.length - 1; vi++) {
                    for (let wi = 0; wi < dataset.length - 1; wi++) {
                        const k0 = voltageKeys[vi], k1 = voltageKeys[vi + 1];
                        const v0 = dataset[wi][k0] as number || 0;
                        const v1 = dataset[wi + 1][k0] as number || 0;
                        const v2 = dataset[wi + 1][k1] as number || 0;
                        const v3 = dataset[wi][k1] as number || 0;

                        // 检查是否穿过等值线
                        const above = [v0 >= threshold, v1 >= threshold, v2 >= threshold, v3 >= threshold];
                        const crossCount = above.filter(Boolean).length;
                        if (crossCount > 0 && crossCount < 4) {
                            const x0 = margin.left + ((dataset[wi].wavenumber - minWN) / (maxWN - minWN)) * plotW;
                            const x1 = margin.left + ((dataset[wi + 1].wavenumber - minWN) / (maxWN - minWN)) * plotW;
                            const y0 = margin.top + ((maxV - voltages[vi]) / (maxV - minV)) * plotH;
                            const y1 = margin.top + ((maxV - voltages[vi + 1]) / (maxV - minV)) * plotH;

                            ctx.beginPath();
                            ctx.moveTo((x0 + x1) / 2, y0);
                            ctx.lineTo((x0 + x1) / 2, y1);
                            ctx.stroke();
                        }
                    }
                }
            }
        }

        // 坐标轴
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, margin.top + plotH);
        ctx.lineTo(margin.left + plotW, margin.top + plotH);
        ctx.stroke();

        // X轴标签
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 6; i++) {
            const wn = minWN + (maxWN - minWN) * (i / 6);
            const x = margin.left + (i / 6) * plotW;
            ctx.fillText(wn.toFixed(0), x, margin.top + plotH + 20);
        }
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('Wavenumber (cm⁻¹)', margin.left + plotW / 2, margin.top + plotH + 45);

        // Y轴标签
        ctx.textAlign = 'right';
        ctx.font = 'bold 10px Inter, sans-serif';
        for (let i = 0; i < voltages.length; i++) {
            const y = margin.top + ((maxV - voltages[i]) / (maxV - minV)) * plotH;
            ctx.fillText(`${voltages[i]} V`, margin.left - 8, y + 4);
        }
        ctx.save();
        ctx.translate(15, margin.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('Voltage (V vs. RHE)', 0, 0);
        ctx.restore();

        // 色彩条
        const barX = margin.left + plotW + 15;
        const barW = 15;
        for (let y = 0; y < plotH; y++) {
            const t = 1 - y / plotH;
            const [r, g, b] = interpolateColor(COLOR_MAPS[colorMap], t);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(barX, margin.top + y, barW, 1);
        }
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(barX, margin.top, barW, plotH);

        ctx.fillStyle = '#64748b';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(maxI.toFixed(0), barX + barW + 5, margin.top + 10);
        ctx.fillText(minI.toFixed(0), barX + barW + 5, margin.top + plotH);
        ctx.fillText('a.u.', barX + barW + 5, margin.top + plotH / 2);

    }, [dataset, voltageKeys, colorMap, showContourLines]);

    if (dataset.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-layer-group text-4xl"></i>
                <p className="text-[10px] font-black uppercase">请先加载原位光谱数据</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-3">
            <div className="flex items-center gap-4 px-2 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">颜色映射</span>
                    {(['viridis', 'plasma', 'inferno'] as ColorMap[]).map(cm => (
                        <button
                            key={cm}
                            onClick={() => setColorMap(cm)}
                            className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${colorMap === cm ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >{cm}</button>
                    ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showContourLines}
                        onChange={e => setShowContourLines(e.target.checked)}
                        className="accent-indigo-600 w-3.5 h-3.5"
                    />
                    <span className="text-[9px] font-black text-slate-500 uppercase">等高线</span>
                </label>
            </div>
            <div ref={containerRef} className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>
        </div>
    );
};

export default ContourPlot;
