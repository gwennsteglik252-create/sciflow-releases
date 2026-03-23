/**
 * renderAssemblyToImage — 离屏 Canvas 合成组图为 base64 PNG
 *
 * 从 SavedFigureAssembly 的面板数据（imgUrl / x / y / w / h / label）出发，
 * 在内存中创建 canvas，逐面板绘制图片和标签，最终输出 data:image/png。
 */

import { SavedFigureAssembly, FigurePanel } from '../types/visuals';

/** 加载一张 base64/URL 图片为 HTMLImageElement */
const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src.substring(0, 60)}...`));
        img.src = src;
    });

/**
 * 将 SavedFigureAssembly 渲染为 base64 PNG 字符串
 * @param assembly  已保存的组图方案
 * @param scale     输出缩放因子（默认 2x 以获得高清图）
 * @returns         data:image/png;base64,...
 */
export async function renderAssemblyToImage(
    assembly: SavedFigureAssembly,
    scale: number = 2
): Promise<string> {
    const panels = assembly.panels;
    if (!panels.length) throw new Error('Assembly has no panels');

    // ── 1. 计算画布边界 ──────────────────────────────────────────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of panels) {
        // 标签占位（左侧外部标签）
        const labelOffset = (p.labelPadding ?? 8) + (p.labelFontSize ? p.labelFontSize * 1.2 : 20);
        minX = Math.min(minX, p.x - labelOffset);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + p.w);
        maxY = Math.max(maxY, p.y + p.h);
    }

    const margin = 16;
    const canvasW = maxX - minX + margin * 2;
    const canvasH = maxY - minY + margin * 2;
    const offsetX = -minX + margin;
    const offsetY = -minY + margin;

    // ── 2. 创建离屏 Canvas ───────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(canvasW * scale);
    canvas.height = Math.round(canvasH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create 2d context');

    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // ── 3. 按 zIndex 排序并逐面板绘制 ────────────────────────────
    const sorted = [...panels].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    for (const panel of sorted) {
        if (panel.visible === false) continue;

        const px = panel.x + offsetX;
        const py = panel.y + offsetY;

        ctx.save();
        ctx.globalAlpha = panel.opacity ?? 1;

        // 旋转 / 翻转
        if (panel.rotation || panel.flipH || panel.flipV) {
            ctx.translate(px + panel.w / 2, py + panel.h / 2);
            if (panel.rotation) ctx.rotate((panel.rotation * Math.PI) / 180);
            ctx.scale(panel.flipH ? -1 : 1, panel.flipV ? -1 : 1);
            ctx.translate(-(px + panel.w / 2), -(py + panel.h / 2));
        }

        // 边框
        if (panel.border && panel.border.width > 0) {
            ctx.strokeStyle = panel.border.color || '#000';
            ctx.lineWidth = panel.border.width;
            ctx.strokeRect(px, py, panel.w, panel.h);
        }

        // 绘制主图
        try {
            const img = await loadImage(panel.imgUrl);
            if (panel.crop) {
                const sx = img.width * panel.crop.x;
                const sy = img.height * panel.crop.y;
                const sw = img.width * panel.crop.w;
                const sh = img.height * panel.crop.h;
                ctx.drawImage(img, sx, sy, sw, sh, px, py, panel.w, panel.h);
            } else {
                ctx.drawImage(img, px, py, panel.w, panel.h);
            }
        } catch {
            // 图片加载失败 → 灰底占位
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(px, py, panel.w, panel.h);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Image not available', px + panel.w / 2, py + panel.h / 2);
        }

        // 标签（左上角外部）
        if (panel.label) {
            const fontSize = panel.labelFontSize || 14;
            const fontFamily = panel.labelFontFamily || 'Arial, sans-serif';
            const fontWeight = panel.labelFontWeight || 'bold';
            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            const labelX = px - (panel.labelPadding ?? 4);
            const labelY = py + 2;
            ctx.fillText(panel.label, labelX, labelY);
        }

        // 比例尺
        if (panel.scaleBar) {
            const sb = panel.scaleBar;
            const positions: Record<string, { x: number; y: number }> = {
                'bottom-right': { x: px + panel.w - sb.width - 8, y: py + panel.h - sb.height - 20 },
                'bottom-left': { x: px + 8, y: py + panel.h - sb.height - 20 },
                'top-right': { x: px + panel.w - sb.width - 8, y: py + 8 },
                'top-left': { x: px + 8, y: py + 8 },
            };
            const pos = positions[sb.position] || positions['bottom-right'];
            ctx.fillStyle = sb.color || '#ffffff';
            ctx.fillRect(pos.x, pos.y, sb.width, sb.height);
            ctx.font = `bold ${sb.fontSize || 10}px Arial`;
            ctx.fillStyle = sb.color || '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(sb.text, pos.x + sb.width / 2, pos.y + sb.height + (sb.fontSize || 10) + 2);
        }

        ctx.restore();
    }

    // ── 4. 输出 base64 ───────────────────────────────────────────
    return canvas.toDataURL('image/png', 0.92);
}
