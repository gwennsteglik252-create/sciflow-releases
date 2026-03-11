/**
 * BaseRenderer: 基础渲染组件，处理屏幕、道具与通用座椅
 */
import { LabStation } from '../collaborationUtils';

export const drawScreenContent = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, time: number, offsetX: number, offsetY: number) => {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    const type = Math.floor((seed * 100) % 5);
    const hue = Math.floor(seed * 360);

    // 增加一个暗色背景遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, w, h);

    if (type === 0) {
        // 动态代码/列表流
        const lines = 8 + Math.floor(seed * 4);
        const lh = h / (lines + 2);
        for (let i = 0; i < lines; i++) {
            const rowTime = time * (1 + seed) + i * 0.1;
            const lw = (0.2 + 0.7 * Math.abs(Math.sin(rowTime))) * w;
            const indent = (i % 4 === 0) ? 2 : (i % 2 === 0) ? 6 : 4;
            ctx.fillStyle = i % 3 === 0 ? `hsl(${(hue + i * 20) % 360}, 70%, 65%)` : '#94a3b8';
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(rowTime * 2);
            ctx.fillRect(indent, 2 + i * lh, lw, lh * 0.5);
        }
    } else if (type === 1) {
        // 复杂正弦波形 (模拟示波器)
        ctx.beginPath();
        ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.lineWidth = 1.2;
        for (let x = 0; x < w; x += 1.5) {
            const y = h / 2 + Math.sin(x * 0.2 + time * 3 + seed * 50) * (h * 0.3) + Math.cos(x * 0.1 - time) * (h * 0.1);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // 扫描线
        const scanX = (time * 40) % w;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(scanX, 0, 2, h);
    } else if (type === 2) {
        // 频谱图
        const bars = 8;
        const bw = (w - (bars + 1) * 1.5) / bars;
        for (let i = 0; i < bars; i++) {
            const bh = (0.1 + 0.8 * Math.abs(Math.sin(time * 2 + i + seed * 20))) * h;
            const bHue = (hue + i * 15) % 360;
            const baseGrad = ctx.createLinearGradient(0, h - bh, 0, h);
            baseGrad.addColorStop(0, `hsl(${bHue}, 80%, 60%)`);
            baseGrad.addColorStop(1, `hsl(${bHue}, 40%, 30%)`);
            ctx.fillStyle = baseGrad;
            ctx.fillRect(1.5 + i * (bw + 1.5), h - bh, bw, bh);
        }
    } else if (type === 3) {
        // 神经网络/节点拓扑
        const nodes = 5;
        const pts: { x: number, y: number }[] = [];
        for (let i = 0; i < nodes; i++) {
            const ang = time * 0.5 + i * (Math.PI * 2 / nodes) + seed * 5;
            const r = h * 0.35;
            const px = w / 2 + Math.cos(ang) * r;
            const py = h / 2 + Math.sin(ang) * r;
            pts.push({ x: px, y: py });
        }
        ctx.strokeStyle = `hsla(${hue}, 70%, 70%, 0.4)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        pts.forEach((p, i) => {
            pts.slice(i + 1).forEach(p2 => { ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); });
        });
        ctx.stroke();
        ctx.fillStyle = `hsl(${hue}, 80%, 70%)`;
        pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill(); });
    } else {
        // 科学网格监控
        const cols = 3; const rows = 2;
        const gw = (w - 4) / cols; const gh = (h - 4) / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const active = (Math.floor(time + r + c) % 3) === 0;
                ctx.fillStyle = active ? `hsla(${hue}, 70%, 60%, 0.6)` : 'rgba(255,255,255,0.05)';
                ctx.fillRect(1 + c * (gw + 1), 1 + r * (gh + 1), gw, gh);
                if (active && Math.random() > 0.8) {
                    ctx.fillStyle = 'white'; ctx.fillRect(1 + c * (gw + 1) + 2, 1 + r * (gh + 1) + 2, 2, 2);
                }
            }
        }
    }
    ctx.restore();
};

export const drawSmallProp = (ctx: CanvasRenderingContext2D, x: number, y: number, type: string) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (type === 'coffee') {
        const cupH = 12;
        const cupW = 8;
        const cupGrad = ctx.createLinearGradient(x - cupW, y - cupH, x + cupW, y - cupH);
        cupGrad.addColorStop(0, '#ffffff');
        cupGrad.addColorStop(0.5, '#e2e8f0');
        cupGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = cupGrad;
        ctx.fillRect(x - cupW, y - cupH, cupW * 2, cupH);
        ctx.beginPath(); ctx.ellipse(x, y, cupW, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y - cupH, cupW, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + cupW, y - cupH / 2, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.beginPath(); ctx.ellipse(x, y - cupH + 1, cupW - 1, 2, 0, 0, Math.PI * 2); ctx.fill();
        const time = Date.now() / 400;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 2; i++) {
            const offset = (time + i * Math.PI) % (Math.PI * 2);
            const sy = y - cupH - 10 - offset * 3;
            const sx = x - 2 + Math.sin(offset) * 2;
            const opacity = Math.max(0, 0.4 - offset / Math.PI);
            ctx.globalAlpha = opacity;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 3, sy - 4, sx, sy - 8); ctx.stroke();
        }
    } else if (type === 'plant') {
        // --- 精致化小型盆栽 ---
        const potW = 14; const potH = 13;
        // 磨砂陶土质感花盆
        const potGrad = ctx.createLinearGradient(x - potW / 2, y - potH, x + potW / 2, y);
        potGrad.addColorStop(0, '#a8a29e');
        potGrad.addColorStop(0.4, '#78716c');
        potGrad.addColorStop(1, '#44403c');
        ctx.fillStyle = potGrad;
        ctx.beginPath();
        ctx.moveTo(x - potW / 2 + 3, y);
        ctx.lineTo(x + potW / 2 - 3, y);
        ctx.lineTo(x + potW / 2, y - potH + 4);
        ctx.lineTo(x - potW / 2, y - potH + 4);
        ctx.closePath();
        ctx.fill();

        // 盆沿边框
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - potW / 2 - 1, y - potH, potW + 2, 4, 1.5);
        else ctx.rect(x - potW / 2 - 1, y - potH, potW + 2, 4);
        ctx.fill();

        // 盆底土壤
        ctx.fillStyle = '#27272a';
        ctx.beginPath(); ctx.ellipse(x, y - potH + 1, potW / 2 - 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();

        const drawMiniLeaf = (lx: number, ly: number, rot: number, size: number, color: string) => {
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(rot + Math.sin(Date.now() / 800) * 0.05);

            const leafG = ctx.createLinearGradient(0, 0, 0, -size);
            leafG.addColorStop(0, '#064e3b');
            leafG.addColorStop(0.6, color);
            leafG.addColorStop(1, '#d1fae5');
            ctx.fillStyle = leafG;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-size / 3, -size / 2, 0, -size);
            ctx.quadraticCurveTo(size / 3, -size / 2, 0, 0);
            ctx.fill();

            // 叶脉
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 0.4;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -size); ctx.stroke();
            ctx.restore();
        };

        // 减少后的微型叶丛 (从5片减少到3片)
        const leafConfigs = [
            { ang: -0.5, s: 9, c: '#10b981' },
            { ang: 0.5, s: 8, c: '#059669' },
            { ang: 0, s: 10, c: '#059669' }
        ];
        leafConfigs.forEach(lc => drawMiniLeaf(x, y - potH, lc.ang, lc.s, lc.c));

    } else if (type === 'magazine' || type === 'books') {
        const isBook = type === 'books';
        const count = isBook ? 3 : 1;
        for (let i = 0; i < count; i++) {
            const ox = x + i * 2; const oy = y - i * 3;
            const bw = 24, bh = 16;
            ctx.fillStyle = i === 0 ? '#4f46e5' : i === 1 ? '#10b981' : '#f59e0b';
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 5, oy - 5); ctx.lineTo(ox + 5, i === 0 ? oy - 5 + 3 : oy - 5 + 3); ctx.lineTo(ox, oy + 3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = i === 0 ? '#6366f1' : i === 1 ? '#34d399' : '#fbbf24';
            ctx.fillRect(ox, oy - 3, bw, 3);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.moveTo(ox, oy - 3); ctx.lineTo(ox + 5, oy - 3 - 5); ctx.lineTo(ox + bw + 5, oy - 3 - 5); ctx.lineTo(ox + bw, oy - 3); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.3; ctx.stroke();
        }
    } else if (type === 'water') {
        const bW = 6, bH = 22;
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.beginPath(); ctx.ellipse(x, y, bW + 2, 3, 0, 0, Math.PI * 2); ctx.fill();
        const glassGrad = ctx.createLinearGradient(x - bW, y - bH, x + bW, y);
        glassGrad.addColorStop(0, 'rgba(186, 230, 253, 0.4)');
        glassGrad.addColorStop(1, 'rgba(186, 230, 253, 0.1)');
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - bW, y - bH, bW * 2, bH, [4, 4, 1, 1]);
        else ctx.fillRect(x - bW, y - bH, bW * 2, bH);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fillRect(x - bW + 1, y - bH * 0.7, bW * 2 - 2, bH * 0.7 - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x - bW + 1, y - bH + 5, 2, bH - 10);
    } else if (type === 'laptop') {
        const lW = 35;
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        // 底盘
        ctx.moveTo(x - lW / 2, y);
        ctx.lineTo(x + lW / 2, y);
        ctx.lineTo(x + lW / 2 + 5, y - 5);
        ctx.lineTo(x - lW / 2 + 5, y - 5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 0.5; ctx.stroke();
        // 屏幕
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        const screenPath = new Path2D();
        screenPath.moveTo(x - lW / 2 + 5, y - 5);
        screenPath.lineTo(x + lW / 2 + 5, y - 5);
        screenPath.lineTo(x + lW / 2 + 5, y - 30);
        screenPath.lineTo(x - lW / 2 + 5, y - 30);
        screenPath.closePath();
        ctx.fill(screenPath);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - lW / 2 + 7, y - 28, lW - 4, 20);
        const glow = ctx.createRadialGradient(x + 5, y - 18, 2, x + 5, y - 18, 15);
        glow.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
        glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - lW / 2 + 7, y - 28, lW - 4, 20);
        ctx.strokeStyle = 'rgba(165, 180, 252, 0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 5, y - 22); ctx.lineTo(x + 15, y - 22); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 5, y - 18); ctx.lineTo(x + 10, y - 18); ctx.stroke();
    }
    ctx.restore();
};

export const draw3DChair = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    if (['coffee_table', 'sofa', 'rug', 'lamp', 'large_plant', 'water_dispenser', 'achievement_shelf', 'coffee_machine'].includes(s.item)) return;
    const isDesk = s.type === 'desk';
    const cx = s.x; const cy = s.y + 25;
    ctx.save();

    // 通用阴影
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(cx + 8, cy + 10, 18, 7, Math.PI / 10, 0, Math.PI * 2); ctx.fill();

    if (isDesk) {
        // --- 办公椅美化 ---
        const baseRadius = 16;
        const baseY = cy + 6;
        const rotation = (Date.now() / 20000);

        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 + rotation;
            const lx = cx + Math.cos(angle) * baseRadius;
            const ly = baseY + Math.sin(angle) * 5;
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(cx, baseY - 4); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.fillStyle = '#1e293b';
            ctx.beginPath(); ctx.arc(lx, ly + 2, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.beginPath(); ctx.arc(lx - 0.5, ly + 1.5, 1, 0, Math.PI * 2); ctx.fill();
        }

        const stemGrad = ctx.createLinearGradient(cx - 3, baseY - 15, cx + 3, baseY);
        stemGrad.addColorStop(0, '#94a3b8'); stemGrad.addColorStop(0.5, '#f8fafc'); stemGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = stemGrad; ctx.fillRect(cx - 3, cy - 10, 6, 15);

        const seatGrad = ctx.createLinearGradient(cx - 16, cy - 18, cx + 16, cy - 8);
        seatGrad.addColorStop(0, '#1e293b'); seatGrad.addColorStop(1, '#475569');
        ctx.fillStyle = seatGrad;
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(cx - 16, cy - 18, 32, 12, [6, 6, 4, 4]); ctx.fill();
        } else {
            ctx.fillRect(cx - 16, cy - 18, 32, 12);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - 16, cy - 12); ctx.lineTo(cx + 16, cy - 12); ctx.stroke();

        ctx.strokeStyle = '#334155'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 14, cy - 12); ctx.quadraticCurveTo(cx - 18, cy - 12, cx - 18, cy - 2); ctx.stroke();
        // Fix: Changed '吸引' to 'cx' on line 280
        ctx.beginPath(); ctx.moveTo(cx + 14, cy - 12); ctx.quadraticCurveTo(cx + 18, cy - 12, cx + 18, cy - 2); ctx.stroke();

        ctx.save();
        const backGrad = ctx.createLinearGradient(cx - 14, cy - 35, cx + 14, cy - 10);
        backGrad.addColorStop(0, '#334155'); backGrad.addColorStop(0.5, '#1e293b'); backGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = backGrad;
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(cx - 14, cy - 35, 28, 26, [10, 10, 4, 4]); ctx.fill();
        } else {
            ctx.fillRect(cx - 14, cy - 35, 28, 26);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5;
        for (let j = 0; j < 5; j++) {
            ctx.beginPath(); ctx.moveTo(cx - 10 + j * 5, cy - 35); ctx.lineTo(cx - 10 + j * 5, cy - 10); ctx.stroke();
        }
        ctx.restore();

    } else {
        // --- 实验凳美化 ---
        const baseY = cy + 10;
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx - 12, baseY);
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 12, baseY);
        ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, baseY + 4);
        ctx.stroke();

        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy + 3, 10, 3, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.ellipse(cx, cy + 2.5, 9.5, 2.5, 0, 0, Math.PI * 2); ctx.stroke();

        const centralGrad = ctx.createLinearGradient(cx - 3, cy - 10, cx + 3, cy);
        centralGrad.addColorStop(0, '#f1f5f9'); centralGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = centralGrad;
        ctx.fillRect(cx - 2, cy - 12, 4, 15);

        const seatColor = '#334155';
        ctx.fillStyle = seatColor;
        ctx.beginPath(); ctx.ellipse(cx, cy - 10, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
        const seatTopGrad = ctx.createRadialGradient(cx - 4, cy - 15, 0, cx, cy - 12, 18);
        seatTopGrad.addColorStop(0, '#64748b'); seatTopGrad.addColorStop(1, '#334155');
        ctx.fillStyle = seatTopGrad;
        ctx.beginPath(); ctx.ellipse(cx, cy - 14, 13, 5, 0, 0, Math.PI * 2); ctx.fill();
        const strokeColor = '#1e293b';
        ctx.strokeStyle = strokeColor; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy - 14, 13, 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
};

export class BaseRenderer {
    render(ctx: CanvasRenderingContext2D, s: LabStation) {
        draw3DChair(ctx, s);
    }
}

