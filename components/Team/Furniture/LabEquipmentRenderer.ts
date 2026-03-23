/**
 * LabEquipmentRenderer: 实验仪器与专业设备渲染
 */
import { InventoryItem } from '../../../types';
import { drawScreenContent } from './BaseRenderer';

export const drawDynamicReagentBottle = (ctx: CanvasRenderingContext2D, x: number, y: number, item: InventoryItem) => {
    ctx.save();
    ctx.translate(x, y);
    const bW = 14, bH = 24;
    const isLow = item.quantity <= item.threshold;
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(0, 0, bW/2 + 2, 2, 0, 0, Math.PI * 2); ctx.fill();
    const glassGrad = ctx.createLinearGradient(-bW/2, -bH, bW/2, 0);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    glassGrad.addColorStop(1, 'rgba(200, 230, 255, 0.2)');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-bW/2, -bH, bW, bH, 3); else ctx.rect(-bW/2, -bH, bW, bH);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const maxCapacity = Math.max(100, item.threshold * 5);
    const levelPercent = Math.min(1, Math.max(0, item.quantity / maxCapacity));
    const liquidH = (bH - 6) * levelPercent;
    if (liquidH > 1) {
        const baseColor = isLow ? '#f43f5e' : (item.category === 'Precursor' ? '#8b5cf6' : '#6366f1');
        ctx.fillStyle = baseColor;
        if (isLow) ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 250) * 0.3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-bW/2 + 1, -1 - liquidH, bW - 2, liquidH, 1);
        else ctx.rect(-bW/2 + 1, -1 - liquidH, bW - 2, liquidH);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
    ctx.fillStyle = '#334155';
    ctx.fillRect(-bW/2 + 2, -bH - 3, bW - 4, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(-bW/2 + 2, -bH + 8, bW - 4, 8);
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    const labelText = item.formula || item.name.substring(0, 3).toUpperCase();
    ctx.fillText(labelText, 0, -bH + 14);
    ctx.restore();
};

export const drawSpectrometer = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(20, -25); ctx.lineTo(28, -32); ctx.lineTo(28, -7); ctx.lineTo(20, 0);
    ctx.fill();
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(-20, -25); ctx.lineTo(-12, -32); ctx.lineTo(28, -32); ctx.lineTo(20, -25);
    ctx.fill();
    const grad = ctx.createLinearGradient(-15, -15, 15, 5);
    grad.addColorStop(0, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -25, 40, 25);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-12, -20, 15, 10);
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(-10, -18, 11, 6);
    ctx.fillStyle = '#334155';
    ctx.fillRect(8, -20, 8, 15);
    ctx.restore();
};

export const drawCentrifuge = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.ellipse(0, -5, 24, 15, 0, 0, Math.PI * 2); ctx.fill();
    const grad = ctx.createRadialGradient(-5, -15, 0, 0, -10, 25);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, -10, 22, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -14, 20, 12, 0, 0, Math.PI * 2); 
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-6, -6, 12, 5);
    ctx.restore();
};

export const drawWorkstation = (ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(22, -30); ctx.lineTo(30, -38); ctx.lineTo(30, -8); ctx.lineTo(22, 0);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-22, -30); ctx.lineTo(-14, -38); ctx.lineTo(30, -38); ctx.lineTo(22, -30);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-22, -30, 44, 30);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-18, -26, 36, 22);
    ctx.clip();
    ctx.fillStyle = '#020617';
    ctx.fillRect(-18, -26, 36, 22);
    const time = Date.now() / 1000;
    drawScreenContent(ctx, 36, 22, seed, time, -18, -26);
    ctx.restore(); 
    ctx.fillStyle = Math.sin(time * 3) > 0 ? '#10b981' : '#064e3b';
    ctx.beginPath(); ctx.arc(-12, -20, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = Math.sin(time * 2) > 0 ? '#fbbf24' : '#78350f';
    ctx.beginPath(); ctx.arc(-12, -14, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
};

export const drawLogisticsPackage = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    const w = 45, h = 32;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, 4, 28, 10, 0, 0, Math.PI * 2); ctx.fill();
    const boxGrad = ctx.createLinearGradient(-w/2, -h, w/2, 0);
    boxGrad.addColorStop(0, '#a16207');
    boxGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = boxGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w/2, -h, w, h, 4); else ctx.rect(-w/2, -h, w, h);
    ctx.fill();
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(146, 64, 14, 0.4)';
    ctx.fillRect(-w/2, -h + 12, w, 8);
    ctx.fillStyle = 'white';
    ctx.font = 'black 6px "Plus Jakarta Sans"';
    ctx.textAlign = 'center';
    ctx.fillText('SCIFLOW', 0, -h + 9);
    ctx.font = 'bold 5px "Plus Jakarta Sans"';
    ctx.fillText('LOGISTICS', 0, -h + 24);
    const pulse = 0.4 + Math.sin(Date.now() / 600) * 0.4;
    ctx.fillStyle = `rgba(59, 130, 246, ${pulse})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#3b82f6';
    ctx.beginPath(); ctx.arc(0, -h - 15, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, -h - 15); ctx.stroke();
    ctx.restore();
};
