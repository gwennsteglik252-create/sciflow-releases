/**
 * autoFigureComposer — 自动组图引擎
 *
 * 将 AI 匹配到的 Figure 图片自动编排为多面板组图 (SavedFigureAssembly)，
 * 然后复用 renderAssemblyToImage 合成最终图片。
 */

import { SavedFigureAssembly, FigurePanel } from '../types/visuals';
import { ExtractedFigure } from './pdfFigureExtractor';
import { renderAssemblyToImage } from './renderAssemblyToImage';

// ─── 布局配置 ────────────────────────────────────────────

/** 面板基础尺寸 (px) */
const PANEL_BASE_W = 400;
const PANEL_BASE_H = 320;
/** 面板间距 */
const GAP = 16;

/** 标签序列 */
const PANEL_LABELS = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)'];

/** 根据 Figure 数量自动选择布局网格 */
function autoSelectLayout(count: number): { rows: number; cols: number } {
    if (count <= 1) return { rows: 1, cols: 1 };
    if (count === 2) return { rows: 1, cols: 2 };
    if (count === 3) return { rows: 1, cols: 3 };
    if (count === 4) return { rows: 2, cols: 2 };
    if (count <= 6) return { rows: 2, cols: 3 };
    if (count <= 9) return { rows: 3, cols: 3 };
    return { rows: Math.ceil(count / 3), cols: 3 };
}

// ─── 主函数 ──────────────────────────────────────────────

/**
 * 将提取的 Figure 自动编排为 SavedFigureAssembly
 *
 * @param figures - AI 匹配到的 Figure 列表
 * @param sectionTitle - 所属章节标题（用于组图标题）
 * @returns SavedFigureAssembly 对象（含 panels + layoutConfig）
 */
export function composeFigureAssembly(
    figures: ExtractedFigure[],
    sectionTitle: string
): SavedFigureAssembly {
    if (figures.length === 0) {
        throw new Error('至少需要 1 张 Figure 才能组图');
    }

    const { rows, cols } = autoSelectLayout(figures.length);

    const panels: FigurePanel[] = figures.map((fig, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;

        return {
            id: `auto_panel_${idx}`,
            imgUrl: fig.imageBase64,
            x: col * (PANEL_BASE_W + GAP),
            y: row * (PANEL_BASE_H + GAP),
            w: PANEL_BASE_W,
            h: PANEL_BASE_H,
            label: PANEL_LABELS[idx] || `(${String.fromCharCode(97 + idx)})`,
            labelFontSize: 14,
            labelFontFamily: 'Arial, sans-serif',
            labelFontWeight: 'bold',
            texts: [],
            shapes: [],
            zIndex: idx,
            visible: true,
            locked: false,
            opacity: 1,
            sourceRef: {
                type: 'literature' as const,
                title: fig.sourceLitTitle,
                page: fig.pageNum,
            },
        };
    });

    return {
        id: `auto_assembly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${sectionTitle} — 文献组图`,
        timestamp: new Date().toISOString(),
        panels,
        layoutConfig: { rows, cols },
    };
}

/**
 * 将提取的 Figure 自动组图并渲染为 base64 图片
 *
 * @param figures - AI 匹配到的 Figure 列表
 * @param sectionTitle - 所属章节标题
 * @returns { assembly, renderedImage } - 组图数据 + 渲染后的图片
 */
export async function composeAndRender(
    figures: ExtractedFigure[],
    sectionTitle: string
): Promise<{ assembly: SavedFigureAssembly; renderedImage: string }> {
    const assembly = composeFigureAssembly(figures, sectionTitle);

    // 复用已有的离屏 Canvas 渲染管线
    const renderedImage = await renderAssemblyToImage(assembly, 2);

    return { assembly, renderedImage };
}
