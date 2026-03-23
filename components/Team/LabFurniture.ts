
/**
 * LabFurniture: 实验室家具与设备渲染总入口
 * 该模块集成了基础渲染、实验设备、休息区家具等子模块
 */
import { LabStation } from './collaborationUtils';
import { draw3DChair, drawScreenContent, drawSmallProp } from './Furniture/BaseRenderer';
import { drawDynamicReagentBottle, drawLogisticsPackage, drawSpectrometer, drawCentrifuge, drawWorkstation } from './Furniture/LabEquipmentRenderer';
import { drawRug, drawFloorLamp, drawSofa, drawCoffeeTable, drawWaterDispenser, drawCoffeeMachine, drawLargePlant, drawAchievementShelf, drawPetBed } from './Furniture/LoungeRenderer';

// 重新导出所有子模块函数
export * from './Furniture/BaseRenderer';
export * from './Furniture/LabEquipmentRenderer';
export * from './Furniture/LoungeRenderer';

export const draw3DFurniture = (ctx: CanvasRenderingContext2D, s: LabStation, projectName?: string) => {
    if (s.item === 'rug') { drawRug(ctx, s); return; }
    if (s.item === 'lamp') { drawFloorLamp(ctx, s); return; }
    if (s.item === 'sofa') { drawSofa(ctx, s); return; }
    if (s.item === 'coffee_table') { drawCoffeeTable(ctx, s); return; }
    if (s.item === 'water_dispenser') { drawWaterDispenser(ctx, s); return; }
    if (s.item === 'coffee_machine') { drawCoffeeMachine(ctx, s); return; }
    if (s.item === 'large_plant') { drawLargePlant(ctx, s); return; }
    if (s.item === 'achievement_shelf') { drawAchievementShelf(ctx, s); return; }
    if (s.item === 'cat_bed' || s.item === 'dog_bed') { drawPetBed(ctx, s); return; }

    const isDesk = s.type === 'desk';
    const w = 85; const h = 10; const depth = 16; const tableH = 30; 
    const x = s.x - w / 2; const y = s.y; 

    ctx.save();
    if (isDesk) {
        const legW = 4; const legH = tableH; const inset = 4;
        const legs = [{ x: x + inset, y: y, dark: false }, { x: x + w - inset - legW, y: y, dark: false }, { x: x + depth + inset, y: y - depth, dark: true }, { x: x + w + depth - inset - legW, y: y - depth, dark: true }];
        legs.sort((a, b) => a.y - b.y).forEach(leg => {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath(); ctx.ellipse(leg.x + legW / 2 + 8, leg.y + legH + 2, 12, 4, Math.PI / 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = leg.dark ? '#475569' : '#94a3b8'; ctx.fillRect(leg.x, leg.y, legW, legH);
        });
    } else {
        const cabinetH = tableH;
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath(); ctx.ellipse(x + w / 2 + 8, y + cabinetH + 2, w / 2 + 10, depth / 2 + 5, Math.PI / 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e293b'; 
        ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + depth, y - depth); ctx.lineTo(x + w + depth, y - depth + cabinetH); ctx.lineTo(x + w, y + cabinetH); ctx.closePath(); ctx.fill();
        const cabinetGrad = ctx.createLinearGradient(x, y, x, y + cabinetH);
        cabinetGrad.addColorStop(0, '#f8fafc'); cabinetGrad.addColorStop(1, '#e2e8f0');
        ctx.fillStyle = cabinetGrad; ctx.fillRect(x, y, w, cabinetH);
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, cabinetH);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; ctx.fillRect(x + 4, y + cabinetH - 6, w - 8, 6);
    }

    const frontGrad = ctx.createLinearGradient(x, y, x, y + h);
    frontGrad.addColorStop(0, s.themeColor); frontGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = frontGrad;
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 3); else ctx.rect(x, y, w, h); ctx.fill();
    
    const topGrad = ctx.createLinearGradient(x, y - depth, x + w + depth, y);
    topGrad.addColorStop(0, '#ffffff'); topGrad.addColorStop(0.4, isDesk ? '#f8fafc' : '#334155'); topGrad.addColorStop(1, s.themeColor);
    ctx.fillStyle = topGrad;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + depth, y - depth); ctx.lineTo(x + w + depth, y - depth); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();

    s.props.forEach((propType, idx) => {
        const propX = x + 15 + (idx * 28); const propY = y - 4;
        drawSmallProp(ctx, propX, propY, propType);
    });

    const itemX = x + w / 2 + 8; const itemY = y - 4; 
    switch (s.item) {
        case 'monitor':
            const isDual = s.seed > 0.75;
            const drawSingleMonitor = (mx: number, my: number, angle: number, monitorSeed: number) => {
                ctx.save(); ctx.translate(mx, my); ctx.rotate(angle);
                const glow = ctx.createRadialGradient(0, -15, 2, 0, -15, 35);
                glow.addColorStop(0, 'rgba(99, 102, 241, 0.15)'); glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
                ctx.fillStyle = glow; ctx.fillRect(-30, -40, 60, 50);
                ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
                const standGrad = ctx.createLinearGradient(-3, -10, 3, 0);
                standGrad.addColorStop(0, '#94a3b8'); standGrad.addColorStop(1, '#475569');
                ctx.fillStyle = standGrad; ctx.fillRect(-3, -12, 6, 12);
                ctx.fillStyle = '#0f172a'; if (ctx.roundRect) ctx.roundRect(-21, -33, 42, 24, 2); else ctx.fillRect(-21, -33, 42, 24);
                ctx.save(); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-20, -32, 40, 22, 1); else ctx.rect(-20, -32, 40, 22); ctx.clip();
                ctx.fillStyle = '#020617'; ctx.fillRect(-20, -32, 40, 22);
                const time = Date.now() / 1000;
                if (projectName) {
                    ctx.globalAlpha = 0.25; drawScreenContent(ctx, 40, 22, monitorSeed, time, -20, -32); ctx.globalAlpha = 1.0;
                    ctx.fillStyle = '#818cf8'; ctx.font = 'bold 5px "Plus Jakarta Sans"'; ctx.textAlign = 'center';
                    const displayLabel = projectName.length > 10 ? projectName.substring(0, 8) + '..' : projectName;
                    ctx.fillText(displayLabel.toUpperCase(), 0, -20);
                } else drawScreenContent(ctx, 40, 22, monitorSeed, time, -20, -32);
                ctx.restore(); 
                const shine = ctx.createLinearGradient(-20, -32, 10, -10);
                shine.addColorStop(0, 'rgba(255,255,255,0.08)'); shine.addColorStop(0.5, 'rgba(255,255,255,0)');
                ctx.fillStyle = shine; ctx.fillRect(-20, -32, 40, 22);
                ctx.restore(); 
            };
            if (isDual) { drawSingleMonitor(itemX - 22, itemY, -0.15, s.seed); drawSingleMonitor(itemX + 18, itemY, 0.12, (s.seed * 7) % 1); } 
            else drawSingleMonitor(itemX, itemY, 0, s.seed);
            break;
        case 'microscope':
            ctx.save(); ctx.translate(itemX, itemY); ctx.fillStyle = '#1e293b'; ctx.fillRect(-10, -4, 20, 5);
            ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.lineTo(-10, -24); ctx.stroke();
            ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(-10, -24, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            break;
        case 'rack':
            const bottleColors = ['#ef4444', '#10b981', '#3b82f6'];
            for(let i=0; i<4; i++) {
                ctx.fillStyle = 'rgba(255,255,255,0.8)'; const ox = itemX - 12 + i * 8;
                if (ctx.roundRect) ctx.roundRect(ox, itemY - 16, 5, 16, 1); else ctx.rect(ox, itemY - 16, 5, 16); ctx.fill(); 
                ctx.fillStyle = bottleColors[i % 3]; ctx.fillRect(ox + 1, itemY - 7, 3, 6); 
            }
            break;
        case 'spectrometer': drawSpectrometer(ctx, itemX, itemY); break;
        case 'centrifuge': drawCentrifuge(ctx, itemX, itemY); break;
        case 'workstation': drawWorkstation(ctx, itemX, itemY, s.seed); break;
    }
    ctx.restore();
};
