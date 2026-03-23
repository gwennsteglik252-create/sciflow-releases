
/**
 * LoungeRenderer: 处理休息区家具、环境装饰与特殊展示柜
 */
import { LabStation } from '../collaborationUtils';
import { Publication } from '../../../types';

export const drawRug = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    ctx.save();
    const rh = 370;
    const rx = 0;
    const rw = s.x + 105 - rx;
    const ry = s.y - rh / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry - 5, rw + 10, rh + 10, 50);
    else ctx.rect(rx, ry - 5, rw + 10, rh + 10);
    ctx.fill();
    const rugGrad = ctx.createLinearGradient(rx, ry, rx + rw, ry);
    rugGrad.addColorStop(0, '#cbd5e1');
    rugGrad.addColorStop(0.3, '#e2e8f0');
    rugGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = rugGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, 45);
    else ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx + 10, ry + 10, rw - 20, rh - 20, 35);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.5;
    for (let i = rx + 25; i < rx + rw - 25; i += 12) {
        ctx.beginPath(); ctx.moveTo(i, ry + 20); ctx.lineTo(i, ry + rh - 20); ctx.stroke();
    }
    ctx.restore();
};

export const drawFloorLamp = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const x = s.x;
    const y = s.y;
    ctx.save();
    const alpha = s.hasLamp ? 0.15 : 0.08;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath(); ctx.ellipse(x + 5, y + 5, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 80); ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.ellipse(x, y, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    const shadeY = y - 85;
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    const radius = 20;
    ctx.moveTo(x - radius, shadeY + 15);
    ctx.lineTo(x + radius, shadeY + 15);
    ctx.lineTo(x + 10, shadeY - 10);
    ctx.lineTo(x - 10, shadeY - 10);
    ctx.closePath();
    ctx.fill();
    if (s.hasLamp) {
        const pulse = 0.5 + Math.sin(Date.now() / 1000) * 0.2;
        const glow = ctx.createRadialGradient(x, shadeY + 5, 2, x, shadeY + 10, 30);
        glow.addColorStop(0, `rgba(251, 191, 36, ${0.4 * pulse})`);
        glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, shadeY + 5, 35, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
};

export const drawSofa = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const { x, y, themeColor, rotation = 0 } = s;
    const w = 110;
    const h = 45;
    const cornerRadius = 12;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // Coordinate system is now centered at the sofa's logical position
    const shadowGrad = ctx.createRadialGradient(0, 15, 10, 0, 15, 65);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath(); ctx.ellipse(0, 15, 65, 20, 0, 0, Math.PI * 2); ctx.fill();

    // Legs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(- w / 2 + 10, 10, 6, 10);
    ctx.fillRect(w / 2 - 16, 10, 6, 10);

    // Base
    const baseGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 25);
    baseGrad.addColorStop(0, themeColor);
    baseGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -5, w, 22, cornerRadius); else ctx.rect(-w / 2, -5, w, 22);
    ctx.fill();

    // Stitching
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(-w / 2 + 15, 6); ctx.lineTo(w / 2 - 15, 6); ctx.stroke();
    ctx.setLineDash([]);

    // Backrest
    const backH = 32;
    const drawBackSegment = (bx: number, bw: number) => {
        const segGrad = ctx.createLinearGradient(bx, -35, bx + bw, 0);
        segGrad.addColorStop(0, themeColor);
        segGrad.addColorStop(0.5, '#1e1b4b');
        segGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = segGrad;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, -35, bw, backH, [10, 10, 0, 0]);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
    };
    drawBackSegment(-w / 2 + 2, w / 2 - 3);
    drawBackSegment(1, w / 2 - 3);

    // Armrests
    const armW = 18; const armH = 34;
    const drawArm = (ax: number) => {
        const armGrad = ctx.createLinearGradient(ax, -24, ax + armW, 10);
        armGrad.addColorStop(0, '#1e293b');
        armGrad.addColorStop(1, '#020617');
        ctx.fillStyle = armGrad;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(ax, -24, armW, armH, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(ax + 2, -22, armW - 4, 4);
    };
    drawArm(-w / 2 - 8); drawArm(w / 2 - 10);

    // Decorative Pillow
    const pX = 18, pY = -18;
    ctx.save();
    ctx.translate(pX, pY); ctx.rotate(-0.1);
    const pillowGrad = ctx.createLinearGradient(0, 0, 18, 18);
    pillowGrad.addColorStop(0, '#6366f1'); pillowGrad.addColorStop(1, '#4338ca');
    ctx.fillStyle = pillowGrad;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(0, 0, 18, 18, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(9, 2); ctx.lineTo(9, 16); ctx.stroke();
    ctx.fillStyle = 'white'; ctx.globalAlpha = 0.6; ctx.font = 'bold 6px "Plus Jakarta Sans"'; ctx.textAlign = 'center';
    ctx.fillText("SF", 9, 11);
    ctx.restore();

    ctx.restore();
};

/**
 * 宠物窝渲染引擎 - 高精优化版
 */
export const drawPetBed = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const { x, y, item, themeColor } = s;
    ctx.save();

    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 5, item === 'cat_bed' ? 26 : 38, item === 'cat_bed' ? 12 : 18, 0, 0, Math.PI * 2);
    ctx.fill();

    if (item === 'cat_bed') {
        // --- 猫窝：柔软的“甜甜圈”设计 ---
        const r = 24;
        const time = Date.now() / 1000;

        // 1. 外部蓬松垫圈
        const rimGrad = ctx.createRadialGradient(x, y, r * 0.6, x, y, r);
        rimGrad.addColorStop(0, '#f8fafc');
        rimGrad.addColorStop(0.7, '#e2e8f0');
        rimGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = rimGrad;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)'; ctx.lineWidth = 1; ctx.stroke();

        // 2. 内部下陷核心
        const coreGrad = ctx.createRadialGradient(x - 5, y - 5, 0, x, y, r * 0.6);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(1, themeColor);
        ctx.fillStyle = coreGrad;
        ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();

        // 3. 全息小鱼干标识 (Floating Hologram)
        const fx = x + 18, fy = y - 22 + Math.sin(time * 3) * 3;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(0.3);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        // 鱼头
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
        // 鱼尾
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-10, -3); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
        ctx.restore();

    } else if (item === 'dog_bed') {
        // --- 狗窝：耐用的长方形围栏垫 ---
        const bw = 68, bh = 44;

        // 1. 围栏外框
        const outerGrad = ctx.createLinearGradient(x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2);
        outerGrad.addColorStop(0, '#1e293b');
        outerGrad.addColorStop(1, '#334155');
        ctx.fillStyle = outerGrad;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 10); ctx.fill();

        // 2. 内部软垫
        const padGrad = ctx.createLinearGradient(x, y - bh / 2 + 6, x, y + bh / 2 - 6);
        padGrad.addColorStop(0, themeColor);
        padGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = padGrad;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bw / 2 + 6, y - bh / 2 + 6, bw - 12, bh - 12, 6); ctx.fill();

        // 3. 缝合线细节 (Stitches)
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - bw / 2 + 3, y - bh / 2 + 3, bw - 6, bh - 6, 8); ctx.stroke();
        ctx.setLineDash([]);

        // 4. 骨头玩具 (Bone Accessory)
        ctx.save();
        ctx.translate(x - 22, y + 12);
        ctx.rotate(-0.5);
        ctx.fillStyle = '#f1f5f9';
        const drawBone = () => {
            ctx.beginPath(); ctx.arc(-4, -2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-4, 2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, -2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, 2, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(-4, -2, 8, 4);
        };
        drawBone();
        ctx.restore();
    }

    ctx.restore();
};

export const drawCoffeeTable = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const x = s.x; const y = s.y;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath(); ctx.ellipse(x + 5, y + 5, 35, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 15, y + 10); ctx.lineTo(x, y - 5); ctx.lineTo(x + 15, y + 10); ctx.stroke();
    const glassGrad = ctx.createRadialGradient(x - 10, y - 15, 0, x, y - 10, 35);
    glassGrad.addColorStop(0, 'rgba(186, 230, 253, 0.6)');
    glassGrad.addColorStop(1, 'rgba(186, 230, 253, 0.2)');
    ctx.fillStyle = glassGrad;
    ctx.beginPath(); ctx.ellipse(x, y - 10, 32, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
};

export const drawWaterDispenser = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const x = s.x; const y = s.y;
    const w = 26; const h = 64;
    const time = Date.now() / 1000;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
    const bodyGrad = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
    bodyGrad.addColorStop(0, '#cbd5e1');
    bodyGrad.addColorStop(0.5, '#f8fafc');
    bodyGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bodyGrad;
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h, w, h, 4);
    else ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(x + w / 2 - 4, y - h, 4, h);
    const panelY = y - h + 6;
    const panelH = 16;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2 + 4, panelY, w - 8, panelH, 2); ctx.fill();
    const hotAlpha = 0.5 + Math.sin(time * 4) * 0.5;
    const coldAlpha = 0.5 + Math.cos(time * 3) * 0.5;
    ctx.fillStyle = `rgba(244, 63, 94, ${0.4 + 0.6 * hotAlpha})`;
    ctx.shadowBlur = 4; ctx.shadowColor = '#f43f5e';
    ctx.beginPath(); ctx.arc(x - 5, panelY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(59, 130, 246, ${0.4 + 0.6 * coldAlpha})`;
    ctx.shadowBlur = 4; ctx.shadowColor = '#3b82f6';
    ctx.beginPath(); ctx.arc(x + 5, panelY + 6, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    const recessY = y - h + 26; const recessH = 28;
    const recessGrad = ctx.createLinearGradient(x, recessY, x, recessY + recessH);
    recessGrad.addColorStop(0, '#020617');
    recessGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = recessGrad;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2 + 3, recessY, w - 6, recessH, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.8;
    for (let i = 1; i < 5; i++) {
        const gy = recessY + recessH - i * 3.5;
        ctx.beginPath(); ctx.moveTo(x - w / 2 + 5, gy); ctx.lineTo(x + w / 2 - 5, gy); ctx.stroke();
    }
    const bottleW = 22; const bottleH = 30;
    const bottleY = y - h - bottleH + 2;
    ctx.fillStyle = '#334155'; ctx.fillRect(x - 6, y - h - 3, 12, 5);
    const bottleGrad = ctx.createRadialGradient(x - 6, bottleY + 8, 0, x, bottleY + 12, 22);
    bottleGrad.addColorStop(0, 'rgba(186, 230, 253, 0.9)');
    bottleGrad.addColorStop(0.7, 'rgba(59, 130, 246, 0.7)');
    bottleGrad.addColorStop(1, 'rgba(29, 78, 216, 0.8)');
    ctx.fillStyle = bottleGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - bottleW / 2, bottleY, bottleW, bottleH, [12, 12, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x - bottleW / 2 + 4, bottleY + 15, 8, Math.PI, Math.PI * 1.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 4; i++) {
        const bTime = time + i * 0.75;
        const offset = (bTime % 1.5) / 1.5;
        const bx = x + Math.sin(bTime * 3) * 6;
        const by = (bottleY + bottleH - 4) - (offset * (bottleH - 6));
        const br = 0.8 + (1 - offset) * 1.5;
        if (by > bottleY + 2) {
            ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
};

export const drawCoffeeMachine = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const x = s.x; const y = s.y;
    const cabW = 40; const cabH = 34;
    const time = Date.now() / 1000;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 25, 8, 0, 0, Math.PI * 2); ctx.fill();
    const cabGrad = ctx.createLinearGradient(x - cabW / 2, y, x + cabW / 2, y);
    cabGrad.addColorStop(0, '#1e293b'); cabGrad.addColorStop(0.5, '#334155'); cabGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = cabGrad;
    if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x - cabW / 2, y - 25, cabW, 35, 4); ctx.fill();
    } else {
        ctx.fillRect(x - cabW / 2, y - 25, cabW, 35);
    }
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1;
    ctx.strokeRect(x - cabW / 2, y - 25, cabW, 35);
    const mY = y - 23;
    const mW = 32, mH = 42;
    const mGrad = ctx.createLinearGradient(x - mW / 2, mY - mH, x + mW / 2, mY - mH);
    mGrad.addColorStop(0, '#0a0a0a'); mGrad.addColorStop(0.3, '#262626'); mGrad.addColorStop(0.7, '#262626'); mGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = mGrad;
    if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x - mW / 2, mY - mH, mW, mH, [6, 6, 2, 2]); ctx.fill();
    } else {
        ctx.fillRect(x - mW / 2, mY - mH, mW, mH);
    }
    ctx.fillStyle = '#171717';
    ctx.fillRect(x - mW / 2 + 4, mY - mH + 4, mW - 8, 12);
    ctx.strokeStyle = '#404040'; ctx.strokeRect(x - mW / 2 + 4, mY - mH + 4, mW - 8, 12);
    const ledAlpha = 0.5 + Math.sin(time * 2) * 0.3;
    ctx.fillStyle = `rgba(56, 189, 248, ${ledAlpha})`;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x - 8 + i * 8, mY - mH + 10, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    const dripY = mY - 4;
    const dripW = 28, dripH = 4;
    const dripGrad = ctx.createLinearGradient(x - dripW / 2, dripY, x + dripW / 2, dripY);
    dripGrad.addColorStop(0, '#404040'); dripGrad.addColorStop(0.5, '#737373'); dripGrad.addColorStop(1, '#404040');
    ctx.fillStyle = dripGrad;
    ctx.fillRect(x - dripW / 2, dripY, dripW, dripH);
    ctx.strokeStyle = '#171717'; ctx.lineWidth = 0.5;
    for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(x - dripW / 2 + i * 4.5, dripY); ctx.lineTo(x - dripW / 2 + i * 4.5, dripY + dripH); ctx.stroke();
    }
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(x + 8, mY - 22, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#171717'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 8, mY - 22);
    ctx.lineTo(x + 8 + Math.cos(time) * 4, mY - 22 + Math.sin(time) * 4); ctx.stroke();
    const steamX = x; const steamY = mY - 24;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
        const sTime = time + i * 1.2;
        const offset = (sTime % 3) / 3;
        const sy = steamY - offset * 25;
        const sx = steamX + Math.sin(sTime * 4) * 3;
        const alpha = Math.max(0, 0.4 - offset);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 4, sy - 5, sx, sy - 10);
        ctx.stroke();
    }
    ctx.restore();
};

const drawMonsteraLeaf = (ctx: CanvasRenderingContext2D, lx: number, ly: number, angle: number, size: number, leafSeed: number, time: number) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle + Math.sin(time * 0.8 + leafSeed * 10) * 0.12);
    const baseHue = 120 + leafSeed * 40;
    const leafGrad = ctx.createRadialGradient(0, -size / 2, 2, 0, -size / 2, size);
    leafGrad.addColorStop(0, `hsl(${baseHue}, 75%, 45%)`);
    leafGrad.addColorStop(0.7, `hsl(${baseHue}, 85%, 25%)`);
    leafGrad.addColorStop(1, `hsl(${baseHue}, 60%, 15%)`);
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(size * 0.4, -size * 0.05, size * 0.8, -size * 0.15, size * 0.9, -size * 0.3);
    ctx.lineTo(size * 0.5, -size * 0.4);
    ctx.lineTo(size * 0.95, -size * 0.5);
    ctx.lineTo(size * 0.6, -size * 0.6);
    ctx.lineTo(size * 0.85, -size * 0.75);
    ctx.bezierCurveTo(size * 0.4, -size * 0.95, size * 0.1, -size, 0, -size);
    ctx.bezierCurveTo(-size * 0.1, -size, -size * 0.4, -size * 0.95, -size * 0.85, -size * 0.75);
    ctx.lineTo(-size * 0.6, -size * 0.6);
    ctx.lineTo(-size * 0.95, -size * 0.5);
    ctx.lineTo(-size * 0.5, -size * 0.4);
    ctx.lineTo(-size * 0.9, -size * 0.3);
    ctx.bezierCurveTo(-size * 0.8, -size * 0.15, -size * 0.4, -size * 0.05, 0, 0);
    ctx.closePath();
    ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = `hsla(${baseHue}, 40%, 80%, 0.15)`; ctx.lineWidth = size * 0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -size); ctx.stroke();
    ctx.lineWidth = size * 0.015;
    for (let i = 1; i <= 4; i++) {
        const vy = -size * 0.22 * i; const vLen = size * 0.5 * (1 - i / 6);
        ctx.beginPath(); ctx.moveTo(0, vy); ctx.quadraticCurveTo(vLen * 0.5, vy, vLen, vy - 10);
        ctx.moveTo(0, vy); ctx.quadraticCurveTo(-vLen * 0.5, vy, -vLen, vy - 10); ctx.stroke();
    }
    const glossAlpha = 0.15 + Math.sin(time * 0.5 + leafSeed * 5) * 0.08;
    const glossGrad = ctx.createLinearGradient(-size * 0.5, -size, size * 0.3, 0);
    glossGrad.addColorStop(0, `rgba(255,255,255,${glossAlpha})`);
    glossGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    glossGrad.addColorStop(1, `rgba(255,255,255,${glossAlpha * 0.5})`);
    ctx.fillStyle = glossGrad; ctx.globalCompositeOperation = 'lighter'; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
};

export const drawLargePlant = (ctx: CanvasRenderingContext2D, s: LabStation) => {
    const x = s.x; const y = s.y;
    const time = Date.now() / 1000;
    const seed = s.seed || 0.5;
    ctx.save();
    const shadowPulse = 1 + Math.sin(time * 0.5) * 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 40 * shadowPulse, 14 * shadowPulse, 0, 0, Math.PI * 2); ctx.fill();
    const potW = 34, potH = 32;
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - potW / 2, y); ctx.lineTo(x - potW / 2 - 4, y + 8);
    ctx.moveTo(x + potW / 2, y); ctx.lineTo(x + potW / 2 + 4, y + 8);
    ctx.stroke();
    const potGrad = ctx.createLinearGradient(x - potW / 2, y - potH, x + potW / 2, y);
    potGrad.addColorStop(0, '#f1f5f9'); potGrad.addColorStop(0.6, '#cbd5e1'); potGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = potGrad;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - potW / 2, y - potH, potW, potH, 8); else ctx.rect(x - potW / 2, y - potH, potW, potH); ctx.fill();
    ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.ellipse(x, y - potH + 2, potW / 2 - 1, 3, 0, 0, Math.PI * 2); ctx.fill();
    const sway = Math.sin(time * 0.7 + seed * 5) * 5;
    const branchBaseX = x; const branchBaseY = y - potH + 2;

    // 优化：缩短枝条长度，提升紧凑感
    const branchConfigs = [
        { ex: x - 12 + sway, ey: y - 55, cpX: x - 8, cpY: y - 40, size: 40 },
        { ex: x + 14 + sway, ey: y - 45, cpX: x + 10, cpY: y - 35, size: 35 },
        { ex: x + 2 + sway * 0.5, ey: y - 60, cpX: x + 4, cpY: y - 45, size: 45 }
    ];

    branchConfigs.forEach((b, i) => {
        const stemGrad = ctx.createLinearGradient(branchBaseX, branchBaseY, b.ex, b.ey);
        stemGrad.addColorStop(0, '#14532d'); stemGrad.addColorStop(1, '#3f6212');
        ctx.strokeStyle = stemGrad; ctx.lineWidth = 3.5 - (i * 0.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(branchBaseX, branchBaseY); ctx.quadraticCurveTo(b.cpX, b.cpY, b.ex, b.ey); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        const midX = (branchBaseX + b.cpX) / 2; const midY = (branchBaseY + b.cpY) / 2;
        ctx.beginPath(); ctx.arc(midX, midY, 2, 0, Math.PI * 2); ctx.fill();
    });
    branchConfigs.forEach((b, i) => {
        const lSeed = (seed + i * 0.23) % 1;
        const dx = b.ex - b.cpX; const dy = b.ey - b.cpY;
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        drawMonsteraLeaf(ctx, b.ex, b.ey, angle, b.size, lSeed, time);
        if (lSeed > 0.6) { const smallSize = b.size * 0.5; drawMonsteraLeaf(ctx, b.ex + 10, b.ey + 10, angle + 0.4, smallSize, lSeed * 0.5, time); }
    });
    ctx.restore();
};

export const drawAchievementShelf = (ctx: CanvasRenderingContext2D, s: LabStation, publications: Publication[] = []) => {
    const { x, y } = s;
    const w = 65; const h = 120;
    const time = Date.now() / 1000;
    ctx.save();

    // 增加墙面接触阴影
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 5, w * 0.8, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    const cabinetGrad = ctx.createLinearGradient(x, y - h, x + w, y - h);
    cabinetGrad.addColorStop(0, '#0f172a'); cabinetGrad.addColorStop(0.5, '#1e293b'); cabinetGrad.addColorStop(1, '#020617');
    ctx.fillStyle = cabinetGrad;
    if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x, y - h, w, h, 6); ctx.fill();
    } else {
        ctx.fillRect(x, y - h, w, h);
    }

    // 内部背板装饰
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 5, y - h + 15 + i * 30, w - 10, 15);

    const lightPulse = 0.4 + Math.sin(time * 1.5) * 0.15;
    const lightGrad = ctx.createLinearGradient(x, y - h, x, y);
    lightGrad.addColorStop(0, `rgba(56, 189, 248, ${lightPulse})`);
    lightGrad.addColorStop(0.5, `rgba(56, 189, 248, ${lightPulse * 0.5})`);
    lightGrad.addColorStop(1, `rgba(56, 189, 248, ${lightPulse})`);
    ctx.fillStyle = lightGrad;
    ctx.fillRect(x + 1, y - h + 2, 2.5, h - 4);
    ctx.fillRect(x + w - 3.5, y - h + 2, 2.5, h - 4);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
    const shelfCount = 4;
    for (let i = 1; i < shelfCount; i++) {
        const sy = y - (i * (h / shelfCount));
        ctx.beginPath(); ctx.moveTo(x + 2, sy); ctx.lineTo(x + w - 2, sy); ctx.stroke();
    }

    // 玻璃柜门反光效果
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glassGrad = ctx.createLinearGradient(x, y - h, x + w, y);
    glassGrad.addColorStop(0, 'rgba(255,255,255,0)');
    glassGrad.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    glassGrad.addColorStop(0.55, 'rgba(255,255,255,0.05)');
    glassGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glassGrad;
    ctx.fillRect(x + 2, y - h + 2, w - 4, h - 4);
    ctx.restore();

    publications.slice(0, 16).forEach((pub, idx) => {
        const shelfIdx = Math.floor(idx / 4);
        const colIdx = idx % 4;
        const itemX = x + 12 + colIdx * 13;
        const itemY = y - 8 - (shelfIdx * (h / shelfCount));
        ctx.save();
        ctx.translate(itemX, itemY);
        const isTopTier = pub.journal === 'Nature' || pub.journal === 'Science';
        if (isTopTier) {
            const medalCol = pub.journal === 'Nature' ? '#fbbf24' : '#94a3b8';
            ctx.shadowBlur = 10; ctx.shadowColor = medalCol;
            ctx.fillStyle = '#334155'; ctx.fillRect(-5, -3, 10, 3);
            const trophyGrad = ctx.createLinearGradient(-4, -15, 4, -15);
            trophyGrad.addColorStop(0, '#ffffff'); trophyGrad.addColorStop(1, medalCol);
            ctx.fillStyle = trophyGrad;
            const trophyPath = new Path2D();
            trophyPath.moveTo(-4, -3);
            trophyPath.lineTo(-2, -15);
            trophyPath.lineTo(2, -15);
            trophyPath.lineTo(4, -3);
            trophyPath.closePath();
            ctx.fill(trophyPath);
        } else {
            let spineCol = pub.journal === 'JACS' ? '#1e3a8a' : (pub.journal === 'Angewandte' ? '#991b1b' : '#475569');
            ctx.rotate((idx % 3 - 1) * 0.08);
            const bookGrad = ctx.createLinearGradient(-4, -24, 4, -24);
            bookGrad.addColorStop(0, spineCol); bookGrad.addColorStop(1, '#000000');
            ctx.fillStyle = bookGrad;
            if (ctx.roundRect) {
                ctx.beginPath(); ctx.roundRect(-4, -24, 8, 24, 1); ctx.fill();
            } else {
                ctx.fillRect(-4, -24, 8, 24);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(-4, -20, 8, 1);
            ctx.fillRect(-4, -5, 8, 1);
        }
        ctx.restore();
    });
    ctx.restore();
};
