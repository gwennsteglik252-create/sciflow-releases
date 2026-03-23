
/**
 * LabEntities: Handles animated entities within the lab floor.
 */

export const drawRobotAssistant = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    const time = Date.now() / 1000;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, 5, 20, 9, 0, 0, Math.PI * 2); ctx.fill();
    const bodyGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, 18);
    bodyGrad.addColorStop(0, '#f8fafc');
    bodyGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.ellipse(0, -3, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    const scanAngle = Math.sin(time * 2) * 0.5;
    ctx.save();
    ctx.rotate(scanAngle);
    const beamGrad = ctx.createLinearGradient(0, -3, 0, -50);
    beamGrad.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    beamGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(-15, -40); ctx.lineTo(15, -40); ctx.closePath(); ctx.fill();
    ctx.restore();
    const pulse = 0.5 + Math.sin(time * 6) * 0.5;
    ctx.fillStyle = `rgba(99, 102, 241, ${0.3 + pulse * 0.7})`;
    ctx.shadowBlur = 10; ctx.shadowColor = '#6366f1';
    ctx.beginPath(); ctx.arc(0, -4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-25, 12, 50, 10, 4); else ctx.rect(-25, 12, 50, 10); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'black 6px "Plus Jakarta Sans"'; ctx.textAlign = 'center';
    ctx.fillText('AI ASSISTANT', 0, 19);
    ctx.restore();
};

/**
 * drawHolographicPillar: 绘制深度优化的全息投影仪
 */
export const drawHolographicPillar = (ctx: CanvasRenderingContext2D, x: number, y: number, projects: any[], time: number) => {
    ctx.save();
    ctx.translate(x, y);

    // 1. 地面辉光 (Ground Ambient Light)
    const groundGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    groundGlow.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    groundGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = groundGlow;
    ctx.beginPath(); ctx.ellipse(0, 0, 60, 20, 0, 0, Math.PI * 2); ctx.fill();

    // 2. 精致底座 (Industrial Emitter)
    const emitterW = 44, emitterH = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 8, emitterW / 2 + 8, 8, 0, 0, Math.PI * 2); ctx.fill();

    // 底座主体金属渐变
    const baseGrad = ctx.createLinearGradient(-emitterW / 2, 0, emitterW / 2, 0);
    baseGrad.addColorStop(0, '#0f172a');
    baseGrad.addColorStop(0.5, '#475569');
    baseGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-emitterW / 2, -emitterH / 2, emitterW, emitterH, 6);
    else ctx.rect(-emitterW / 2, -emitterH / 2, emitterW, emitterH);
    ctx.fill();

    // 中心能量核心 (Energy Core)
    const corePulse = 0.5 + Math.sin(time * 8) * 0.5;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.ellipse(0, -emitterH / 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(99, 102, 241, ${0.4 + corePulse * 0.6})`;
    ctx.shadowBlur = 15; ctx.shadowColor = '#6366f1';
    ctx.beginPath(); ctx.ellipse(0, -emitterH / 2, 10, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // 3. 复合全息光柱 (Multi-layer Beam)
    const beamW = 50, beamH = 260;
    const flicker = Math.random() > 0.98 ? 0.5 : 1.0; // 模拟偶尔的闪烁

    // 主丁达尔光束
    const mainBeam = ctx.createLinearGradient(0, -emitterH / 2, 0, -beamH);
    mainBeam.addColorStop(0, `rgba(99, 102, 241, ${0.4 * flicker})`);
    mainBeam.addColorStop(0.4, `rgba(139, 92, 246, ${0.15 * flicker})`);
    mainBeam.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = mainBeam;
    ctx.beginPath();
    ctx.moveTo(-8, -emitterH / 2);
    ctx.lineTo(8, -emitterH / 2);
    ctx.lineTo(beamW, -beamH);
    ctx.lineTo(-beamW, -beamH);
    ctx.closePath();
    ctx.fill();

    // 内部高亮核心
    const innerBeam = ctx.createLinearGradient(0, -emitterH / 2, 0, -beamH * 0.7);
    innerBeam.addColorStop(0, `rgba(255, 255, 255, ${0.3 * flicker})`);
    innerBeam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = innerBeam;
    ctx.beginPath();
    ctx.moveTo(-3, -emitterH / 2);
    ctx.lineTo(3, -emitterH / 2);
    ctx.lineTo(12, -beamH * 0.7);
    ctx.lineTo(-12, -beamH * 0.7);
    ctx.closePath();
    ctx.fill();

    // 4. 浮动数据粒子 (Data Particles)
    ctx.fillStyle = 'rgba(165, 180, 252, 0.6)';
    for (let i = 0; i < 12; i++) {
        const pSeed = (time * 0.5 + i * 0.88) % 1.0;
        const py = -emitterH / 2 - (pSeed * (beamH - 20));
        const px = Math.sin(time + i) * (beamW * pSeed);
        const pSize = (1 - pSeed) * 2.5;
        ctx.fillRect(px, py, pSize, pSize);
    }

    // 5. 装饰性轨道环 (Orbital Rings)
    const drawRing = (ry: number, rx: number, speed: number, alpha: number) => {
        ctx.save();
        ctx.translate(0, ry + Math.sin(time + ry) * 5);
        ctx.rotate(time * speed);
        ctx.strokeStyle = `rgba(165, 180, 252, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 8]);
        ctx.beginPath(); ctx.ellipse(0, 0, rx, rx * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    };
    drawRing(-70, 45, 0.4, 0.5);
    drawRing(-160, 60, -0.2, 0.3);

    // 6. 全息项目卡片 (Glassmorphism Cards)
    const activePrj = projects.slice(0, 3);
    activePrj.forEach((p, idx) => {
        const angle = (idx / activePrj.length) * Math.PI * 2 + time * 0.2;
        const radius = 90;
        const px = Math.cos(angle) * radius;
        const py = -130 + Math.sin(angle) * 35;
        const scale = (Math.sin(angle) + 2.5) / 3.5;

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(scale, scale);
        ctx.globalAlpha = (0.4 + scale * 0.6) * flicker;

        // 卡片主体 (深色半透明玻璃)
        const kw = 72, kh = 28;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-kw / 2, -kh / 2, kw, kh, 8);
        else ctx.rect(-kw / 2, -kh / 2, kw, kh);
        ctx.fill();

        // 动态流光边框 (Rim Light)
        const borderGlow = ctx.createLinearGradient(-kw / 2, -kh / 2, kw / 2, kh / 2);
        borderGlow.addColorStop(0, `rgba(99, 102, 241, ${0.4 + 0.6 * Math.sin(time + idx)})`);
        borderGlow.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        borderGlow.addColorStop(1, `rgba(139, 92, 246, ${0.4 + 0.6 * Math.cos(time + idx)})`);
        ctx.strokeStyle = borderGlow;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 装饰图标区
        ctx.fillStyle = `rgba(99, 102, 241, 0.3)`;
        ctx.fillRect(-kw / 2 + 5, -kh / 2 + 5, 12, 18);
        ctx.fillStyle = '#818cf8';
        ctx.beginPath(); ctx.arc(-kw / 2 + 11, -kh / 2 + 14, 3, 0, Math.PI * 2); ctx.fill();

        // 文本内容
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 7px "Plus Jakarta Sans"';
        ctx.textAlign = 'left';
        const label = p.title.substring(0, 10).toUpperCase() + (p.title.length > 10 ? '..' : '');
        ctx.fillText(label, -kw / 2 + 22, -kh / 2 + 14);

        // 进度小条
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(-kw / 2 + 22, -kh / 2 + 18, 40, 2);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(-kw / 2 + 22, -kh / 2 + 18, 40 * (p.progress / 100), 2);

        ctx.restore();
    });

    ctx.restore();
};

const drawSpeechBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, timer: number) => {
    ctx.save();
    // 关键优化：加速消失时的淡出感
    ctx.globalAlpha = Math.min(1, timer / 12);
    ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
    const bw = ctx.measureText(text).width + 16;
    const bh = 22;
    const bx = x - bw / 2;
    const by = y - bh - 20;
    ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.fillStyle = 'white';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10); else ctx.rect(bx, by, bw, bh); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 4, by + bh); ctx.lineTo(x + 4, by + bh); ctx.lineTo(x, by + bh + 6); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#334155'; ctx.textAlign = 'center';
    ctx.fillText(text, x, by + 14);
    ctx.restore();
};

const drawInteractionEmoji = (ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, time: number) => {
    ctx.save();
    const bounce = Math.sin(time * 5) * 5;
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.7 + Math.sin(time * 10) * 0.3;
    ctx.fillText(emoji, x, y - 40 + bounce);
    ctx.restore();
};

export const drawCat = (ctx: CanvasRenderingContext2D, x: number, y: number, jumpY: number = 0, state: string = 'idle', mood: number = 0.5, bubbles: any[] = [], bubbleText: string = "", bubbleTimer: number = 0, facing: number = 1) => {
    ctx.save();
    const time = Date.now() / 1000;
    if (state === 'playing') drawInteractionEmoji(ctx, x, y + jumpY, '⚡', time);

    ctx.save();
    ctx.translate(x, y + jumpY);
    ctx.scale(facing, 1); // Apply horizontal flip

    const isBlinking = (Date.now() % 5000) < 150;
    const tailSpeed = (state === 'hunting' || state === 'playing') ? 8 : 2;
    const tailAngle = Math.sin(time * tailSpeed) * 0.6;
    const breatheFactor = state === 'sleeping' ? Math.sin(time * 2) * 0.3 : Math.sin(time * 4) * 0.5;
    const earTwitch = Math.random() > 0.98 ? Math.sin(time * 20) * 0.2 : 0;

    // Shadow
    ctx.save();
    ctx.scale(facing, 1);
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 0.12 * (1 - Math.abs(jumpY) / 100))})`;
    ctx.beginPath(); ctx.ellipse(0, 5, state === 'sleeping' ? 14 : 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Tail
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, 0);
    if (state === 'sleeping' || state === 'rolling') ctx.bezierCurveTo(12, 0, 15, -5, 10, -10);
    else if (state === 'stretching') ctx.bezierCurveTo(12, -8, 16, -12, 22, -6);
    else ctx.bezierCurveTo(18 + tailAngle * 15, -10 + breatheFactor, 24 + tailAngle * 10, 4, 20, 8);
    ctx.stroke();

    // Body
    if (state !== 'sleeping' && state !== 'rolling') {
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.ellipse(-6, 3, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-1, 4, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, 3, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    }

    if (state === 'rolling') {
        ctx.translate(0, 0); // shift center
        ctx.rotate(Math.PI + Math.sin(time * 5) * 0.3); // upside down and rolling
    }

    const bodyGrad = ctx.createLinearGradient(-10, -5, 10, 5);
    bodyGrad.addColorStop(0, '#475569'); bodyGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    if (state === 'sleeping' || state === 'rolling') ctx.arc(0, 0, 11 + breatheFactor * 0.4, 0, Math.PI * 2);
    else if (state === 'grooming') ctx.ellipse(0, -1, 8, 9 + breatheFactor * 0.5, 0, 0, Math.PI * 2);
    else if (state === 'stretching') ctx.ellipse(2, 0, 13, 6, 0.1, 0, Math.PI * 2);
    else ctx.ellipse(0, -1 + breatheFactor * 0.5, 9 + breatheFactor * 0.2, 7 + breatheFactor * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (state === 'rolling') {
        // draw paws while rolling
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.ellipse(-4, -12, 3, 4, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4, -12, 3, 4, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-8, -10, 3, 4, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(8, -10, 3, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    }

    // Head
    ctx.save();
    let headX = state === 'sleeping' ? -4 : (state === 'stretching' ? -12 : -8);
    let headY = state === 'sleeping' ? -4 : (state === 'grooming' ? -12 : (state === 'stretching' ? 2 : -8)) + breatheFactor * 0.8;
    ctx.translate(headX, headY);
    ctx.rotate(state === 'hunting' || state === 'playing' ? 0.3 : (state === 'stretching' ? 0.5 : -0.1));
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-8 - earTwitch * 5, -12); ctx.lineTo(-2, -6);
    ctx.moveTo(2, -6); ctx.lineTo(6 + earTwitch * 5, -11); ctx.lineTo(6, -1); ctx.fill();
    if (state === 'sleeping' || state === 'stretching' || state === 'rolling') {
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-3.5, -1, 2, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(3.5, -1, 2, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
        ctx.fillStyle = isBlinking ? '#1e293b' : `hsl(${120 - mood * 100}, 80%, 60%)`;
        ctx.beginPath(); ctx.arc(-3.5, -1, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.5, -1, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    // Bubble outside to keep text readable
    if (bubbleTimer > 0 && bubbleText) drawSpeechBubble(ctx, x, y + jumpY - 15, bubbleText, bubbleTimer);
    ctx.restore();
};

export const drawDog = (ctx: CanvasRenderingContext2D, x: number, y: number, jumpY: number = 0, state: string = 'idle', mood: number = 0.5, bubbleText: string = "", bubbleTimer: number = 0, facing: number = 1) => {
    ctx.save();
    const time = Date.now() / 1000;
    if (state === 'playing') drawInteractionEmoji(ctx, x, y + jumpY, '❤️', time);

    // Shadow
    ctx.save();
    ctx.translate(x, y + 6);
    ctx.fillStyle = `rgba(0,0,0,${0.12 * (1 - Math.abs(jumpY) / 50)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y + jumpY);
    ctx.scale(facing, 1);

    const wagSpeed = state === 'playing' ? 18 : 12;
    const wagAngle = Math.sin(time * wagSpeed) * (0.3 + mood * 0.6);
    const earWobble = Math.sin(time * 8) * 0.05;

    // Tail
    ctx.save();
    const tailX = 12, tailY = -8;
    ctx.translate(tailX, tailY);
    ctx.rotate(wagAngle);
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(8, -10, 15, 0);
    ctx.quadraticCurveTo(8, 5, 0, 0);
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.fillStyle = '#78350f';
    const legMove = (state === 'walking' || state === 'playing') ? Math.sin(time * 8) * 4 : 0;
    const scratchMove = state === 'scratching' ? Math.sin(time * 20) * 5 : 0;
    ctx.fillRect(-12, 2, 4, 6 + legMove);
    if (state === 'scratching') {
        ctx.translate(10, 4);
        ctx.rotate(-0.5 + scratchMove * 0.1);
        ctx.fillRect(-2, -2, 4, 8);
        ctx.rotate(0.5 - scratchMove * 0.1);
        ctx.translate(-10, -4);
    } else {
        ctx.fillRect(8, 2, 4, 6 - legMove);
    }

    // Body
    const bodyGrad = ctx.createLinearGradient(-18, -15, 18, 5);
    bodyGrad.addColorStop(0, '#92400e');
    bodyGrad.addColorStop(0.5, '#d97706');
    bodyGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-18, -18, 32, 20, 10); else ctx.rect(-18, -18, 32, 20);
    ctx.fill();

    // Collar
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-14, -4); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(-14, -4, 2, 0, Math.PI * 2); ctx.fill();

    // Head
    ctx.save();
    let headX = -15;
    let headY = -16;
    let headTilt = state === 'sniffing' ? 0.3 : Math.sin(time * 2) * 0.05;

    if (state === 'howling') {
        headX = -10;
        headY = -22;
        headTilt = -0.8;
    } else if (state === 'scratching') {
        headTilt = 0.5;
    }

    ctx.translate(headX, headY);
    ctx.rotate(headTilt);

    const drawEar = (ex: number, ey: number, side: number) => {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(side * (0.2 + earWobble));
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(side * 8, 2, side * 10, 18, 0, 20);
        ctx.bezierCurveTo(side * -6, 18, side * -4, 2, 0, 0);
        ctx.fill();
        ctx.restore();
    };
    drawEar(-6, -4, -1);
    drawEar(6, -4, 1);
    ctx.fillStyle = '#d97706';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.beginPath(); ctx.ellipse(0, 5, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(0, 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(-1, 5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
    const isBlinking = (Date.now() % 4000) < 150;
    ctx.fillStyle = isBlinking ? '#451a03' : '#0f172a';
    if (isBlinking) { ctx.fillRect(-6, -2, 3, 1); ctx.fillRect(3, -2, 3, 1); } else {
        ctx.beginPath(); ctx.arc(-4.5, -2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4.5, -2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(-4, -2.5, 0.7, 0, Math.PI * 2); ctx.fill();
    }
    if ((mood > 0.6 && state !== 'sniffing') || state === 'howling') {
        ctx.fillStyle = state === 'howling' ? '#ef4444' : '#fb7185';
        const panting = state === 'howling' ? 4 : Math.sin(time * 10) * 1.5;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-2, 8, 4, 6 + panting, 2); ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    if (bubbleTimer > 0 && bubbleText) drawSpeechBubble(ctx, x, y + jumpY - 30, bubbleText, bubbleTimer);
    ctx.restore();
};

export const drawDataParticle = (ctx: CanvasRenderingContext2D, p: { x: number, y: number, char: string, opacity: number }) => {
    ctx.save();
    ctx.globalAlpha = p.opacity; ctx.fillStyle = '#6366f1'; ctx.font = 'bold 10px serif';
    ctx.fillText(p.char, p.x, p.y); ctx.restore();
};
export const drawKnowledgeCore = (ctx: CanvasRenderingContext2D, x: number, y: number, intensity: number, time: number) => {
    ctx.save();
    ctx.translate(x, y);

    // Base platform
    const coreR = 30;
    const baseGrad = ctx.createLinearGradient(-coreR, 0, coreR, 0);
    baseGrad.addColorStop(0, '#1e293b');
    baseGrad.addColorStop(0.5, '#475569');
    baseGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.ellipse(0, 10, coreR + 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Internal glow
    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    const coreGlow = ctx.createRadialGradient(0, -10, 0, 0, -10, coreR + 20);
    coreGlow.addColorStop(0, `rgba(99, 102, 241, ${0.4 + pulse * 0.4 * intensity})`);
    coreGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(0, -10, coreR + 20, 0, Math.PI * 2);
    ctx.fill();

    // Floating rings
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(time * (0.5 + i * 0.2) + i * Math.PI / 3);
        ctx.strokeStyle = `rgba(165, 180, 252, ${0.3 + intensity * 0.4})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 15]);
        ctx.beginPath();
        ctx.ellipse(0, 0, coreR + 10 + i * 8, (coreR + 10 + i * 8) * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Central Sphere
    const sphereGrad = ctx.createRadialGradient(-5, -15, 0, 0, -10, coreR);
    sphereGrad.addColorStop(0, '#818cf8');
    sphereGrad.addColorStop(1, '#312e81');
    ctx.fillStyle = sphereGrad;
    ctx.shadowBlur = 20 * intensity;
    ctx.shadowColor = '#6366f1';
    ctx.beginPath();
    ctx.arc(0, -10, coreR * (0.8 + pulse * 0.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Data streams
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8 + time;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * coreR, -10 + Math.sin(ang) * coreR);
        ctx.lineTo(Math.cos(ang) * (coreR + 40), -10 + Math.sin(ang) * (coreR + 40));
        ctx.stroke();
    }

    ctx.restore();
};

export const drawDroneStation = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    const time = Date.now() / 1000;

    // 1. Bottom Glow (Pulse)
    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    const baseGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    baseGlow.addColorStop(0, `rgba(16, 185, 129, ${0.1 * pulse})`);
    baseGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = baseGlow;
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 15, 0, 0, Math.PI * 2); ctx.fill();

    // 2. Base Plate (Multi-layer Industrial)
    const baseGrad = ctx.createLinearGradient(-20, -10, 20, 10);
    baseGrad.addColorStop(0, '#1e293b');
    baseGrad.addColorStop(1, '#334155');
    ctx.fillStyle = baseGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Concentric Detail Rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, Math.PI * 2); ctx.stroke();

    // 3. Glowing Landing Marker (H-Sign)
    ctx.strokeStyle = '#10b981';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    // Left leg
    ctx.moveTo(-7, -4); ctx.lineTo(-7, 4);
    // Right leg
    ctx.moveTo(7, -4); ctx.lineTo(7, 4);
    // Cross
    ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Small LED indicators around the plate
    for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + time;
        const lx = Math.cos(ang) * 20;
        const ly = Math.sin(ang) * 10;
        ctx.fillStyle = (i % 2 === 0) ? '#10b981' : '#059669';
        ctx.beginPath(); ctx.arc(lx, ly, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
};

export const drawDrone = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, altitude: number, time: number) => {
    ctx.save();
    const isResting = altitude < 5;
    ctx.translate(x, y - altitude);
    ctx.rotate(angle);

    // 1. Shadow (Dynamic based on height)
    if (!isResting) {
        ctx.save();
        ctx.translate(0, altitude);
        const shadowAlpha = 0.15 * Math.max(0, 1 - altitude / 100);
        ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 8, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 2. Rotor Arms (Cross design)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -14); ctx.lineTo(14, 14);
    ctx.moveTo(14, -14); ctx.lineTo(-14, 14);
    ctx.stroke();

    // Joint details
    ctx.fillStyle = '#475569';
    for (const [jx, jy] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
        ctx.beginPath(); ctx.arc(jx, jy, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // 3. Main Body (Aerodynamic Pod)
    const bodyPulse = Math.sin(time * 2) * 2;
    // Lower half (Industrial)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 15, 0, 0, Math.PI * 2); ctx.fill();
    // Upper half (Scientific White)
    const podGrad = ctx.createLinearGradient(0, -10, 0, 5);
    podGrad.addColorStop(0, '#f8fafc');
    podGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = podGrad;
    ctx.beginPath(); ctx.ellipse(0, -2, 12, 10, 0, 0, Math.PI * 2); ctx.fill();

    // 4. Tech Details & Sensors
    // Front Eye
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(0, -6, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Glowing lens
    ctx.fillStyle = '#6366f1';
    ctx.shadowBlur = 5; ctx.shadowColor = '#6366f1';
    ctx.beginPath(); ctx.arc(2, -6, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Status Blinkers
    const blink = Math.floor(time * 2) % 2 === 0;
    ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
    ctx.beginPath(); ctx.arc(-8, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = !blink ? '#22c55e' : '#14532d';
    ctx.beginPath(); ctx.arc(8, 0, 1.5, 0, Math.PI * 2); ctx.fill();

    // 5. Rotors (Semi-transparent Blur)
    const rotorSpeed = isResting ? 0 : 25;
    for (const [rx, ry] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(time * rotorSpeed * (rx * ry > 0 ? 1 : -1));

        ctx.strokeStyle = isResting ? 'rgba(71, 85, 105, 0.8)' : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 1.5;
        // Blade 1
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        // Blade 2
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();

        // Motor cap
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // 6. Translucent Package (when flying)
    if (!isResting) {
        ctx.save();
        ctx.translate(0, 12 + Math.sin(time * 5) * 1);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 1;
        if (ctx.roundRect) ctx.roundRect(-5, 0, 10, 10, 2); else ctx.rect(-5, 0, 10, 10);
        ctx.fill(); ctx.stroke();
        // Item inside
        ctx.fillStyle = '#818cf8';
        ctx.beginPath(); ctx.arc(0, 5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    ctx.restore();
};

export const drawSynergySpark = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, time: number) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);

    // Main curve
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 - 40;

    ctx.beginPath();
    ctx.moveTo(x1, y1 - 30);
    ctx.quadraticCurveTo(midX, midY, x2, y2 - 30);
    ctx.stroke();

    // Animated sparks
    const segments = 10;
    for (let i = 0; i < segments; i++) {
        const t = (i + (time * 2) % 1) / segments;
        if (t > 1) continue;

        const px = Math.pow(1 - t, 2) * x1 + 2 * (1 - t) * t * midX + Math.pow(t, 2) * x2;
        const py = Math.pow(1 - t, 2) * (y1 - 30) + 2 * (1 - t) * t * midY + Math.pow(t, 2) * (y2 - 30);

        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#818cf8';
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
};

export const drawLiveNewsBoard = (ctx: CanvasRenderingContext2D, x: number, y: number, messages: string[], time: number) => {
    const w = 110, h = 60;
    ctx.save();
    ctx.translate(x, y);

    // 1. Frosted Glass Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    if (ctx.roundRect) ctx.roundRect(0, 0, w, h, 8); else ctx.fillRect(0, 0, w, h);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2. High-precision borders and corners
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Corner brackets for 'Premium' feel
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2;
    // Top Left
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 0); ctx.lineTo(10, 0); ctx.stroke();
    // Bottom Right
    ctx.beginPath(); ctx.moveTo(w, h - 10); ctx.lineTo(w, h); ctx.lineTo(w - 10, h); ctx.stroke();

    // 3. Screen Header
    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.fillRect(2, 2, w - 4, 12);
    ctx.fillStyle = '#818cf8';
    ctx.font = '700 6px "Inter", "Plus Jakarta Sans", sans-serif';
    ctx.fillText("SF-LIVE BROADCAST", 8, 10);

    // Animated status dot
    const pulse = 0.5 + Math.sin(time * 4) * 0.5;
    ctx.fillStyle = `rgba(16, 185, 129, ${0.4 + pulse * 0.6})`;
    ctx.beginPath(); ctx.arc(w - 12, 8, 2, 0, Math.PI * 2); ctx.fill();

    // 4. Message Content Area
    ctx.save();
    ctx.rect(2, 16, w - 4, h - 18);
    ctx.clip();

    // Subtle Grid background
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.05)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < w; gx += 8) { ctx.beginPath(); ctx.moveTo(gx, 16); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 16; gy < h; gy += 8) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // Render Messages with clarity
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lineH = 14;
    messages.forEach((msg, idx) => {
        const scrollY = 18 + (idx * lineH) - (time * 12) % (messages.length * lineH);
        let yPos = scrollY;
        if (yPos < 18 - lineH) yPos += (messages.length * lineH);

        if (yPos < h && yPos > 18 - lineH) {
            // Text Shadow for readability (Glow)
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
            ctx.fillStyle = '#10b981';
            ctx.font = '900 8.5px "Inter", "Monospace", sans-serif';
            ctx.fillText(msg.toUpperCase(), 8, yPos);
            ctx.shadowBlur = 0;

            // Decorative Mini-Signal (Moving Bar)
            const barW = 4 + Math.sin(time * 3 + idx) * 3;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
            ctx.fillRect(w - 15, yPos + 3, barW, 2);
        }
    });
    ctx.restore();

    // 5. Overall Glass Shine
    const shine = ctx.createLinearGradient(0, 0, w, h);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    shine.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
};
