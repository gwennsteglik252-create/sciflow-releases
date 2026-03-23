
/**
 * LabEnvironment: Handles architectural and structural rendering of the lab.
 * Beautified with high-fidelity wall decorations.
 */

export const drawEnvironment = (ctx: CanvasRenderingContext2D, w: number, h: number, lightsOn: boolean = false) => {
    const wallHeight = h * 0.22; 
    const sideWallWidth = 90;    
    const wallTopY = 25;         
    const wallBaseY = wallHeight + wallTopY;

    const now = new Date();
    const hour = now.getHours();
    const isNightTime = hour < 7 || hour >= 19;
    const renderAsNight = isNightTime && !lightsOn;
    const isGoldenHour = (hour >= 17 && hour < 19) || (hour >= 6 && hour < 8);

    // 1. Zoned Floor Rendering
    const dividerX = sideWallWidth + (w - sideWallWidth) * 0.58;

    const officeFloorGrad = ctx.createLinearGradient(0, wallHeight, 0, h);
    if (renderAsNight) {
        officeFloorGrad.addColorStop(0, '#1e293b'); 
        officeFloorGrad.addColorStop(1, '#0f172a');
    } else if (isGoldenHour && !lightsOn) {
        officeFloorGrad.addColorStop(0, '#94a3b8'); 
        officeFloorGrad.addColorStop(1, '#fed7aa'); 
    } else {
        officeFloorGrad.addColorStop(0, '#cbd5e1'); 
        officeFloorGrad.addColorStop(1, '#f1f5f9');
    }
    ctx.fillStyle = officeFloorGrad;
    ctx.fillRect(0, wallHeight, dividerX, h - wallHeight);

    const labFloorGrad = ctx.createLinearGradient(dividerX, wallHeight, dividerX, h);
    if (renderAsNight) {
        labFloorGrad.addColorStop(0, '#0f172a');
        labFloorGrad.addColorStop(1, '#020617');
    } else {
        labFloorGrad.addColorStop(0, '#cbd5e1');
        labFloorGrad.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = labFloorGrad;
    ctx.fillRect(dividerX, wallHeight, w - dividerX, h - wallHeight);

    // 2. Zone Patterns
    ctx.save();
    ctx.fillStyle = renderAsNight ? 'rgba(255,255,255,0.02)' : 'rgba(99, 102, 241, 0.05)';
    for (let ix = 120; ix < dividerX; ix += 30) {
        for (let iy = wallHeight + 30; iy < h; iy += 30) {
            ctx.beginPath(); ctx.arc(ix, iy, 1, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.strokeStyle = renderAsNight ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    const tileSize = 80;
    ctx.beginPath();
    for (let x = dividerX; x < w; x += tileSize) {
        ctx.moveTo(x, wallHeight); ctx.lineTo(x, h);
    }
    for (let y = wallHeight; y < h; y += tileSize) {
        ctx.moveTo(dividerX, y); ctx.lineTo(w, y);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Back Wall Background
    const backWallGrad = ctx.createLinearGradient(0, 0, 0, wallBaseY);
    if (renderAsNight) {
        backWallGrad.addColorStop(0, '#0f172a');
        backWallGrad.addColorStop(1, '#1e293b');
    } else {
        backWallGrad.addColorStop(0, '#f8fafc');
        backWallGrad.addColorStop(1, '#e2e8f0');
    }
    ctx.fillStyle = backWallGrad;
    ctx.fillRect(sideWallWidth, 0, w - sideWallWidth, wallBaseY);

    // 4. Side diagonal wall with Window
    ctx.fillStyle = renderAsNight ? '#0f172a' : '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sideWallWidth, wallTopY);
    ctx.lineTo(sideWallWidth, wallBaseY);
    ctx.lineTo(0, wallHeight);
    ctx.closePath();
    ctx.fill();

    // --- Window with Enhanced Depth & Precise Perspective Alignment ---
    ctx.save();
    ctx.beginPath();
    
    // Geometry calculation to ensure parallelism with wall boundaries
    const winLeftX = 15;
    const winRightX = sideWallWidth - 15;
    const slope = wallTopY / sideWallWidth;
    
    // Y-offsets logic: Y = slope * X + baseOffset
    const winTopMargin = 50; 
    const winBottomPadding = 35; 

    // Top edge parallel to wallTop line (y = slope * x)
    const winTopL = winTopMargin + (winLeftX * slope);
    const winTopR = winTopMargin + (winRightX * slope);
    
    // Bottom edge parallel to wallBase line (y = wallHeight + slope * x)
    const winBotL = (wallHeight - winBottomPadding) + (winLeftX * slope);
    const winBotR = (wallHeight - winBottomPadding) + (winRightX * slope);

    ctx.moveTo(winLeftX, winTopL);
    ctx.lineTo(winRightX, winTopR);
    ctx.lineTo(winRightX, winBotR);
    ctx.lineTo(winLeftX, winBotL);
    ctx.closePath();
    ctx.clip();

    // Sky Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, wallHeight);
    if (renderAsNight) {
        skyGrad.addColorStop(0, '#020617');
        skyGrad.addColorStop(1, '#1e1b4b');
    } else if (isGoldenHour) {
        skyGrad.addColorStop(0, '#fb923c');
        skyGrad.addColorStop(1, '#ffedd5');
    } else {
        skyGrad.addColorStop(0, '#7dd3fc');
        skyGrad.addColorStop(1, '#e0f2fe');
    }
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // Window Frame & Dividers
    ctx.strokeStyle = renderAsNight ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Perspective Grid Lines for Window
    const midX = (winLeftX + winRightX) / 2;
    const midYOffset = (winTopMargin + (wallHeight - winBottomPadding)) / 2;

    // Vertical Divider
    ctx.beginPath();
    ctx.moveTo(midX, winTopMargin + (midX * slope));
    ctx.lineTo(midX, (wallHeight - winBottomPadding) + (midX * slope));
    ctx.stroke();

    // Horizontal Divider (Parallel to top/bottom edges)
    ctx.beginPath();
    ctx.moveTo(winLeftX, midYOffset + (winLeftX * slope));
    ctx.lineTo(winRightX, midYOffset + (winRightX * slope));
    ctx.stroke();

    ctx.restore();

    const drawWallDetails = () => {
        // --- 踢脚线绘制 (Baseboards) ---
        ctx.save();
        const baseboardColor = renderAsNight ? '#020617' : '#334155';
        ctx.fillStyle = baseboardColor;
        
        // 1. 后墙踢脚线
        ctx.fillRect(sideWallWidth, wallBaseY - 6, w - sideWallWidth, 6);

        // 2. 侧墙踢脚线 (斜向透视)
        ctx.beginPath();
        ctx.moveTo(0, wallHeight);
        ctx.lineTo(sideWallWidth, wallBaseY);
        ctx.lineTo(sideWallWidth, wallBaseY - 6);
        ctx.lineTo(0, wallHeight - 6);
        ctx.closePath();
        ctx.fill();

        // 3. 踢脚线顶部高光勾边 (提升立体感)
        ctx.strokeStyle = renderAsNight ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // 后墙边
        ctx.moveTo(sideWallWidth, wallBaseY - 6);
        ctx.lineTo(w, wallBaseY - 6);
        // 侧墙边
        ctx.moveTo(0, wallHeight - 6);
        ctx.lineTo(sideWallWidth, wallBaseY - 6);
        ctx.stroke();
        ctx.restore();

        const drawPoster = (px: number, py: number, theme: string, type: 'chart' | 'molecule' | 'table') => {
            const pw = 48, ph = 64;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = '#1e293b'; 
            ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            const paperGrad = ctx.createLinearGradient(px, py, px + pw, py + ph);
            paperGrad.addColorStop(0, '#ffffff');
            paperGrad.addColorStop(1, '#f1f5f9');
            ctx.fillStyle = paperGrad;
            ctx.fillRect(px, py, pw, ph);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(px + 4, py + 4, pw - 8, 3);
            ctx.fillStyle = theme;
            ctx.fillRect(px + 4, py + 8, 12, 1.5);

            if (type === 'chart') {
                ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(px + 6, py + 15); ctx.lineTo(px + 6, py + ph - 10); ctx.lineTo(px + pw - 6, py + ph - 10);
                ctx.stroke();
                ctx.strokeStyle = theme; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px + 6, py + ph - 12);
                for(let i=0; i<15; i++) {
                    const x = px + 8 + i * 2.2;
                    const noise = Math.sin(i * 0.8) * 1.5; 
                    let peak = 0;
                    if (i === 5) peak = 20; if (i === 10) peak = 12;
                    ctx.lineTo(x, py + ph - 12 - peak - noise);
                }
                ctx.stroke();
            } else if (type === 'molecule') {
                ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
                const centerX = px + pw/2, centerY = py + ph/2 + 5;
                const drawHex = (hx: number, hy: number, r: number) => {
                    ctx.beginPath();
                    for(let i=0; i<6; i++) {
                        const ang = (i * Math.PI * 2) / 6;
                        const xx = hx + Math.cos(ang) * r;
                        const yy = hy + Math.sin(ang) * r;
                        if(i===0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
                    }
                    ctx.closePath(); ctx.stroke();
                };
                drawHex(centerX, centerY, 8);
                drawHex(centerX - 10, centerY - 6, 8);
                drawHex(centerX + 10, centerY - 6, 8);
                ctx.fillStyle = theme;
                ctx.beginPath(); ctx.arc(centerX, centerY, 1.5, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = '#f8fafc'; ctx.fillRect(px + 6, py + 15, pw - 12, ph - 25);
                ctx.fillStyle = theme; ctx.globalAlpha = 0.3;
                for(let i=0; i<6; i++) {
                    const barWidth = (pw - 16) * (0.4 + (i * 0.1));
                    ctx.fillRect(px + 8, py + 18 + i * 6, barWidth, 3);
                }
                ctx.globalAlpha = 1.0;
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            const tapeW = 12, tapeH = 5;
            ctx.save(); ctx.translate(px, py); ctx.rotate(-Math.PI/4); ctx.fillRect(-tapeW/2, -tapeH/2, tapeW, tapeH); ctx.restore();
            ctx.save(); ctx.translate(px + pw, py); ctx.rotate(Math.PI/4); ctx.fillRect(-tapeW/2, -tapeH/2, tapeW, tapeH); ctx.restore();
            ctx.save(); ctx.translate(px, py + ph); ctx.rotate(Math.PI/4); ctx.fillRect(-tapeW/2, -tapeH/2, tapeW, tapeH); ctx.restore();
            ctx.save(); ctx.translate(px + pw, py + ph); ctx.rotate(-Math.PI/4); ctx.fillRect(-tapeW/2, -tapeH/2, tapeW, tapeH); ctx.restore();
            ctx.restore();
        };

        drawPoster(dividerX - 90, 45, '#6366f1', 'chart');
        drawPoster(dividerX - 160, 60, '#10b981', 'molecule');
        drawPoster(dividerX - 230, 40, '#f59e0b', 'table');
        drawPoster(w - 150, 50, '#ef4444', 'chart');
        drawPoster(w - 220, 65, '#8b5cf6', 'table');

        const drawSafetySign = (sx: number, sy: number, type: 'bio' | 'caution') => {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 4); ctx.fill();
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.stroke();
            if (type === 'caution') {
                ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(11, 8); ctx.lineTo(-11, 8); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'black'; ctx.fillRect(-1, -4, 2, 6); ctx.fillRect(-1, 4, 2, 2);
            } else {
                ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    ctx.save(); ctx.rotate((i * Math.PI * 2) / 3); ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
                }
                ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        };
        drawSafetySign(dividerX + 150, wallBaseY - 80, 'caution');
        drawSafetySign(w - 120, wallBaseY - 120, 'bio');

        const boxX = dividerX + 40, boxY = wallBaseY - 95;
        ctx.save();
        ctx.fillStyle = renderAsNight ? '#0f172a' : '#64748b';
        ctx.fillRect(boxX, boxY, 35, 50);
        ctx.strokeStyle = '#334155'; ctx.strokeRect(boxX, boxY, 35, 50);
        ctx.fillStyle = '#064e3b'; ctx.fillRect(boxX + 5, boxY + 8, 25, 12);
        ctx.fillStyle = '#10b981'; ctx.globalAlpha = 0.5;
        for (let i = 0; i < 3; i++) ctx.fillRect(boxX + 8, boxY + 11 + i * 3, 10 + i * 4, 1);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); ctx.arc(boxX + 12, boxY + 32, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(boxX + 25, boxY + 32, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        const drawClock = (cx: number, cy: number) => {
            const r = 28;
            const sec = now.getSeconds();
            const min = now.getMinutes();
            const hour = now.getHours();
            const ms = now.getMilliseconds();
            ctx.save();
            ctx.translate(cx, cy);
            const rimGrad = ctx.createLinearGradient(-r, -r, r, r);
            rimGrad.addColorStop(0, '#94a3b8'); rimGrad.addColorStop(0.5, '#f8fafc'); rimGrad.addColorStop(1, '#475569');
            ctx.fillStyle = rimGrad; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#64748b';
            for (let i = 0; i < 12; i++) {
                ctx.save(); ctx.rotate((i * Math.PI) / 6); ctx.beginPath();
                const tickLen = i % 3 === 0 ? 6 : 3;
                ctx.moveTo(0, -(r - 4)); ctx.lineTo(0, -(r - 4 - tickLen));
                ctx.lineWidth = i % 3 === 0 ? 2 : 1;
                ctx.stroke(); ctx.restore();
            }
            const sAng = (sec + ms / 1000) * (Math.PI / 30);
            const mAng = (min + sec / 60) * (Math.PI / 30);
            const hAng = ((hour % 12) + min / 60) * (Math.PI / 6);
            const drawHand = (angle: number, length: number, width: number, color: string) => {
                ctx.save(); ctx.rotate(angle); ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.2)';
                ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -length); ctx.stroke(); ctx.restore();
            };
            drawHand(hAng, r * 0.5, 3.5, '#1e1b4b'); drawHand(mAng, r * 0.75, 2.5, '#334155'); drawHand(sAng, r * 0.85, 1, '#ef4444');
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        };
        drawClock(sideWallWidth + 160, wallTopY + 70);

        // --- 深度优化的大门绘制 (Detailed Door with Depth & Inset) ---
        const doorX = sideWallWidth + 30; 
        const doorW = 75, doorH = 110, doorY = wallBaseY - doorH;
        
        // 1. 门框 (Outer Frame for depth)
        ctx.fillStyle = renderAsNight ? '#020617' : '#334155';
        ctx.fillRect(doorX - 4, doorY - 4, doorW + 8, doorH + 4);
        
        // 2. 门体凹陷阴影 (Bezel/Inset shadow)
        ctx.fillStyle = renderAsNight ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.2)';
        ctx.fillRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2);

        // 3. 门主体材质 (Door Body)
        const doorGrad = ctx.createLinearGradient(doorX, doorY, doorX + doorW, doorY);
        if (renderAsNight) {
            doorGrad.addColorStop(0, '#1e293b');
            doorGrad.addColorStop(1, '#0f172a');
        } else {
            doorGrad.addColorStop(0, '#f8fafc');
            doorGrad.addColorStop(0.5, '#ffffff');
            doorGrad.addColorStop(1, '#e2e8f0');
        }
        ctx.fillStyle = doorGrad;
        ctx.fillRect(doorX, doorY, doorW, doorH);

        // 4. 观察窗 (Vision Panel)
        const winW = doorW * 0.5, winH = 24, winX = doorX + (doorW - winW)/2, winY = doorY + 18;
        ctx.fillStyle = '#1e293b'; // 窗框
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(winX - 1, winY - 1, winW + 2, winH + 2, 3); ctx.fill();
        const glassG = ctx.createLinearGradient(winX, winY, winX + winW, winY + winH);
        glassG.addColorStop(0, '#1e1b4b'); glassG.addColorStop(1, '#312e81');
        ctx.fillStyle = glassG;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(winX, winY, winW, winH, 2); ctx.fill();
        // 反光
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(winX + 5, winY + winH - 5); ctx.lineTo(winX + winW - 5, winY + 5); ctx.stroke();

        // 5. 拉丝金属长把手 (Modern Handle)
        const handleX = doorX + doorW - 12, handleY = doorY + doorH/2 - 15;
        const handleW = 4, handleH = 30;
        // 把手阴影
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(handleX + 1, handleY + 1, handleW, handleH);
        // 把手金属质感
        const metalG = ctx.createLinearGradient(handleX, handleY, handleX + handleW, handleY);
        metalG.addColorStop(0, '#94a3b8'); metalG.addColorStop(0.5, '#f8fafc'); metalG.addColorStop(1, '#475569');
        ctx.fillStyle = metalG;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(handleX, handleY, handleW, handleH, 2); ctx.fill();
        // 把手基座 (Studs)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(handleX + 2, handleY + 4, 1.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(handleX + 2, handleY + handleH - 4, 1.2, 0, Math.PI*2); ctx.fill();

        // 6. 优化的 EXIT 标识灯 (Enhanced Glowing Exit Sign)
        const exitX = doorX + (doorW - 45)/2, exitY = doorY - 22;
        const exitBoxW = 45, exitBoxH = 15;
        ctx.save();
        // 指示牌外壳
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(exitX - 1, exitY - 1, exitBoxW + 2, exitBoxH + 2, 4); ctx.fill();
        
        // 绿色灯光辉光
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#10b981';
        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)'; 
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(exitX, exitY, exitBoxW, exitBoxH, 3); ctx.fill();
        
        // 文字排版
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        // 英文
        ctx.font = 'black 8px "Plus Jakarta Sans"';
        ctx.fillText('EXIT', exitX + exitBoxW/2, exitY + 8);
        // 中文副标
        ctx.font = 'bold 4px sans-serif';
        ctx.fillText('安全出口', exitX + exitBoxW/2, exitY + 13);
        ctx.restore();
    };

    drawWallDetails();

    ctx.strokeStyle = renderAsNight ? '#334155' : '#64748b'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sideWallWidth, wallTopY); ctx.lineTo(sideWallWidth, wallBaseY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sideWallWidth, wallBaseY); ctx.lineTo(w, wallBaseY); ctx.stroke();
};

export const drawGlassWall = (ctx: CanvasRenderingContext2D, w: number, h: number, lightsOn: boolean) => {
    const wallHeight = h * 0.22; 
    const sideWallWidth = 90;
    const dividerX = sideWallWidth + (w - sideWallWidth) * 0.58;
    const doorTopY = 340;
    const doorBottomY = 500;
    ctx.save();
    const glassColor = lightsOn ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)';
    ctx.fillStyle = glassColor;
    ctx.fillRect(dividerX - 2, wallHeight, 4, doorTopY - wallHeight);
    ctx.fillRect(dividerX - 2, doorBottomY, 4, h - doorBottomY);
    ctx.fillStyle = '#475569';
    ctx.fillRect(dividerX - 4, wallHeight - 2, 8, 6);
    ctx.fillRect(dividerX - 4, h - 4, 8, 4);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(dividerX - 4, doorTopY, 8, 4); 
    ctx.fillRect(dividerX - 4, doorBottomY - 4, 8, 4); 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    const drawShine = (yStart: number, yEnd: number) => {
        for (let i = 0; i < 3; i++) {
            const y = yStart + (yEnd - yStart) * 0.3 + i * 20;
            ctx.beginPath(); ctx.moveTo(dividerX - 10, y); ctx.lineTo(dividerX + 10, y - 15); ctx.stroke();
        }
    };
    drawShine(wallHeight, doorTopY);
    drawShine(doorBottomY, h);
    ctx.fillStyle = '#10b981';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#10b981';
    ctx.beginPath(); ctx.arc(dividerX + 6, doorTopY + 20, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
};

export const applyGlobalLighting = (ctx: CanvasRenderingContext2D, w: number, h: number, lightsOn: boolean = false) => {
    const hour = new Date().getHours();
    const isNightTime = hour < 7 || hour >= 19;
    const renderAsNight = isNightTime && !lightsOn;
    const isGoldenHour = (hour >= 17 && hour < 19) || (hour >= 6 && hour < 8);
    ctx.save();
    const grad = ctx.createRadialGradient(w / 2, h / 2, h / 4, w / 2, h / 2, w / 2);
    if (renderAsNight) {
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)'); grad.addColorStop(1, 'rgba(15, 23, 42, 0.4)');
    } else if (isGoldenHour && !lightsOn) {
        grad.addColorStop(0, 'rgba(251, 146, 60, 0.05)'); grad.addColorStop(1, 'rgba(251, 146, 60, 0.1)');
    } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)'); grad.addColorStop(1, 'rgba(99, 102, 241, 0.05)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
};
