/**
 * WaterfallPlot.tsx
 * 3D 瀑布图（Canvas 2D 伪3D 投影）
 * 堆叠偏移渲染原位光谱
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { extractVoltageKeys, voltageKeyToValue, SpectrumDataPoint } from './spectroscopyAnalysis';

interface Props {
    dataset: SpectrumDataPoint[];
}

const PALETTE = [
    '#94a3b8', '#818cf8', '#6366f1', '#4338ca', '#312e81',
    '#1e1b4b', '#0f172a',
];

const WaterfallPlot: React.FC<Props> = ({ dataset }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const voltageKeys = useMemo(() => extractVoltageKeys(dataset), [dataset]);
    const [angle, setAngle] = useState(35);
    const [colorScheme, setColorScheme] = useState<'gradient' | 'distinct'>('gradient');

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

        // 绘图参数
        const margin = { top: 40, right: 40, bottom: 60, left: 70 };
        const plotW = W - margin.left - margin.right;
        const plotH = H - margin.top - margin.bottom;

        const wavenumbers = dataset.map(d => d.wavenumber);
        const minWN = Math.min(...wavenumbers);
        const maxWN = Math.max(...wavenumbers);

        // 计算全局最大强度
        let globalMax = 0;
        for (const d of dataset) {
            for (const key of voltageKeys) {
                const val = d[key] as number || 0;
                if (val > globalMax) globalMax = val;
            }
        }

        const offsetY = (plotH * 0.6) / voltageKeys.length; // 每条谱的Y偏移
        const offsetX = (plotW * 0.1) / voltageKeys.length; // X方向透视偏移
        const angleRad = (angle * Math.PI) / 180;

        // 从后到前绘制 (低电位在后面)
        for (let vi = 0; vi < voltageKeys.length; vi++) {
            const key = voltageKeys[vi];
            const voltage = voltageKeyToValue(key);
            const yOff = (voltageKeys.length - 1 - vi) * offsetY * Math.sin(angleRad);
            const xOff = vi * offsetX * Math.cos(angleRad);

            // 颜色
            let color: string;
            if (colorScheme === 'gradient') {
                const t = vi / Math.max(1, voltageKeys.length - 1);
                const r = Math.round(148 + t * (67 - 148));
                const g = Math.round(163 + t * (56 - 163));
                const b = Math.round(184 + t * (202 - 184));
                color = `rgb(${r},${g},${b})`;
            } else {
                color = PALETTE[vi % PALETTE.length];
            }

            // 构建路径
            ctx.beginPath();
            const points: [number, number][] = [];

            for (let i = 0; i < dataset.length; i++) {
                const wn = dataset[i].wavenumber;
                const intensity = dataset[i][key] as number || 0;
                const x = margin.left + xOff + ((wn - minWN) / (maxWN - minWN)) * (plotW - offsetX * voltageKeys.length);
                const y = margin.top + plotH - yOff - (intensity / globalMax) * (plotH * 0.5);
                points.push([x, y]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }

            // 填充底部（白色遮盖后面的谱线）
            const lastPt = points[points.length - 1];
            const firstPt = points[0];
            ctx.lineTo(lastPt[0], margin.top + plotH - yOff);
            ctx.lineTo(firstPt[0], margin.top + plotH - yOff);
            ctx.closePath();

            ctx.fillStyle = '#ffffffee';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 填充渐变
            ctx.beginPath();
            for (let i = 0; i < points.length; i++) {
                if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
                else ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.lineTo(lastPt[0], margin.top + plotH - yOff);
            ctx.lineTo(firstPt[0], margin.top + plotH - yOff);
            ctx.closePath();
            ctx.fillStyle = color + '18';
            ctx.fill();

            // 电压标签
            ctx.fillStyle = color;
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${voltage} V`, margin.left + xOff - 8, margin.top + plotH - yOff + 3);
        }

        // 坐标轴
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, margin.top + plotH);
        ctx.lineTo(margin.left + plotW, margin.top + plotH);
        ctx.stroke();

        // X轴标签
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const tickCount = 6;
        for (let i = 0; i <= tickCount; i++) {
            const wn = minWN + (maxWN - minWN) * (i / tickCount);
            const x = margin.left + (i / tickCount) * plotW;
            ctx.fillText(wn.toFixed(0), x, margin.top + plotH + 20);
            ctx.beginPath();
            ctx.moveTo(x, margin.top + plotH);
            ctx.lineTo(x, margin.top + plotH + 5);
            ctx.stroke();
        }

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText('Wavenumber (cm⁻¹)', margin.left + plotW / 2, H - 10);

        // 标题
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('In-situ Raman Waterfall Plot', W / 2, 20);

    }, [dataset, voltageKeys, angle, colorScheme]);

    if (dataset.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-mountain-sun text-4xl"></i>
                <p className="text-[10px] font-black uppercase">请先加载原位光谱数据</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-3">
            <div className="flex items-center gap-4 px-2 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">视角</span>
                    <input
                        type="range"
                        min={10}
                        max={80}
                        value={angle}
                        onChange={e => setAngle(Number(e.target.value))}
                        className="w-32 accent-indigo-600"
                    />
                    <span className="text-[9px] font-mono text-slate-400">{angle}°</span>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <button
                        onClick={() => setColorScheme('gradient')}
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${colorScheme === 'gradient' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >渐变</button>
                    <button
                        onClick={() => setColorScheme('distinct')}
                        className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${colorScheme === 'distinct' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >分色</button>
                </div>
            </div>
            <div ref={containerRef} className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>
        </div>
    );
};

export default WaterfallPlot;
