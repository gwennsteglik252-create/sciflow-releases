import { NodePosition } from './types';

/**
 * 更精确且紧凑的节点高度估算模型
 * 会根据自定义字体大小 (textConfig.fontSize 等) 动态调整估算
 */
export const getNodeHeight = (node: any): number => {
    // --- 标题区域 ---
    // 自定义字体大小 (pt)；默认约 16px ≈ 12pt
    const titleFontPx = node.textConfig?.fontSize
        ? node.textConfig.fontSize * 1.333  // pt → px
        : 16;
    const titleLineHeight = Math.max(titleFontPx * 1.5, 24); // 行高
    // 假设卡片内容宽度 ~232px (256 - 24 padding)，按平均字宽估算行数
    const avgTitleCharWidth = titleFontPx * 0.6;
    const charsPerTitleLine = Math.max(1, Math.floor(232 / avgTitleCharWidth));
    const titleLines = Math.ceil((node.text?.length || 0) / charsPerTitleLine) || 1;

    // --- 副标题区域 ---
    const subFontPx = node.subTextConfig?.fontSize
        ? node.subTextConfig.fontSize * 1.333
        : 12;
    const subLineHeight = Math.max(subFontPx * 1.5, 20);
    const avgSubCharWidth = subFontPx * 0.55;
    const charsPerSubLine = Math.max(1, Math.floor(232 / avgSubCharWidth));
    const subTextLines = Math.ceil((node.subText?.length || 0) / charsPerSubLine) || 1;

    // --- 参数区域 ---
    const paramFontPx = node.paramsConfig?.fontSize
        ? node.paramsConfig.fontSize * 1.333
        : 10.67; // 8pt default
    const paramRowHeight = Math.max(paramFontPx * 1.5 + 8, 30); // 含 padding
    const paramsRows = Math.ceil((node.params?.length || 0) / 2.5) || 1;

    const headerHeight = 36;
    const bodyPadding = 16;
    const titleHeight = titleLines * titleLineHeight;
    const subTextHeight = subTextLines * subLineHeight;
    const footerHeight = 16 + (paramsRows * paramRowHeight);

    return headerHeight + bodyPadding + titleHeight + subTextHeight + footerHeight;
};

const DEFAULT_LAYOUT_CONSTANTS = {
    startX: 30,
    startY: 50,
    groupPaddingX: 310,
    nodeGap: 16,             // 节点边框与边框之间的真实缝隙
    innerPaddingY: 24,       // 组分容器顶部和底部的固定留白
    bottomSafeMargin: 12,    // 底部安全余量，防止估算偏差导致节点溢出
    groupWidth: 290,
    nodeWidth: 256,
    headerOffset: 42
};

// 可被运行时覆盖的间距参数
let layoutOverrides: Partial<typeof DEFAULT_LAYOUT_CONSTANTS> = {};

export const setLayoutOverrides = (overrides: Partial<typeof DEFAULT_LAYOUT_CONSTANTS>) => {
    layoutOverrides = { ...layoutOverrides, ...overrides };
};

export const getLayoutConstants = () => ({
    ...DEFAULT_LAYOUT_CONSTANTS,
    ...layoutOverrides
});

// 向后兼容的只读引用（仅用于不需要动态更新的场景）
export const LAYOUT_CONSTANTS = DEFAULT_LAYOUT_CONSTANTS;

export const getGroupCenteredX = (gIdx: number) => {
    const lc = getLayoutConstants();
    return lc.startX + gIdx * lc.groupPaddingX + (lc.groupWidth - lc.nodeWidth) / 2;
};

export const calculateInitialPositions = (data: any): Record<string, NodePosition> => {
    const pos: Record<string, NodePosition> = {};
    if (!data?.groups) return pos;

    const lc = getLayoutConstants();

    data.groups.forEach((g: any, gIdx: number) => {
        const centeredNodeX = lc.startX + gIdx * lc.groupPaddingX + (lc.groupWidth - lc.nodeWidth) / 2;
        // 起始 Y：组分顶部 + 标题高度 + 顶部留白
        let currentY = lc.startY + lc.headerOffset + lc.innerPaddingY;

        g.nodes.forEach((n: any, nIdx: number) => {
            pos[n.id] = {
                x: centeredNodeX,
                y: currentY
            };
            // 下一个节点的 Y = 当前节点 Y + 当前节点高度 + 固定缝隙
            currentY += getNodeHeight(n) + lc.nodeGap;
        });
    });

    return pos;
};
