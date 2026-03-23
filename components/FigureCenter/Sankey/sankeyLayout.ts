/**
 * sankeyLayout.ts
 * ─────────────────────────────────────────────────────────────────
 * 纯 TypeScript 实现的桑基图布局引擎（无外部依赖）
 *
 * 算法流程：
 *  1. 拓扑排序 → 确定每个节点的"列（column）"
 *  2. 计算每列中各节点的高度（与流量成比例）
 *  3. 迭代调整节点垂直位置（避免重叠，居中对齐）
 *  4. 计算每条连线的起止 y 坐标
 */

import { SankeyData, SankeyNode, SankeyLink, SankeyAlignment } from '../../../types/visuals';

// ─────────────────────────────────────────────
// 内部计算结构
// ─────────────────────────────────────────────

export interface ComputedSankeyNode {
    id: string;
    label: string;
    description?: string;
    group?: string;
    color: string;
    /** 列索引（0 = 最左） */
    column: number;
    /** 画布坐标 */
    x: number;
    y: number;
    /** 节点矩形宽度 */
    width: number;
    /** 节点矩形高度（与总流量成比例） */
    height: number;
    /** 节点入流总量 */
    inFlow: number;
    /** 节点出流总量 */
    outFlow: number;
    /** 实际流量 = max(inFlow, outFlow)，用于高度计算 */
    flow: number;
    /** 原始节点数据 */
    raw: SankeyNode;
    /** 环形布局角度 (弧度) */
    startAngle?: number;
    endAngle?: number;
}

export interface ComputedSankeyLink {
    id: string;
    source: ComputedSankeyNode;
    target: ComputedSankeyNode;
    value: number;
    label?: string;
    color: string;
    opacity: number;
    highlight: boolean;
    /** 在 source 节点右侧的起始 y（连线顶部） */
    sy0: number;
    /** 在 source 节点右侧的结束 y（连线底部） */
    sy1: number;
    /** 在 target 节点左侧的起始 y（连线顶部） */
    ty0: number;
    /** 在 target 节点左侧的结束 y（连线底部） */
    ty1: number;
    /** 连线宽度（像素） */
    bandwidth: number;
    /** 环形布局角度 (弧度) */
    sourceStartAngle?: number;
    sourceEndAngle?: number;
    targetStartAngle?: number;
    targetEndAngle?: number;
}

export interface SankeyLayoutResult {
    nodes: ComputedSankeyNode[];
    links: ComputedSankeyLink[];
    /** 画布总宽（不含 padding） */
    totalWidth: number;
    /** 画布总高（不含 padding） */
    totalHeight: number;
    /** 列数 */
    columnCount: number;
}

// ─────────────────────────────────────────────
// 默认调色板
// ─────────────────────────────────────────────

export const DEFAULT_SANKEY_PALETTE = [
    '#6366f1', // indigo
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ef4444', // red
    '#14b8a6', // teal
    '#f97316', // orange
    '#84cc16', // lime
    '#06b6d4', // cyan
    '#a855f7', // purple
];

// ─────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────

export interface SankeyLayoutOptions {
    /** 绘图区宽度（像素） */
    width: number;
    /** 绘图区高度（像素） */
    height: number;
    /** 节点矩形宽度 */
    nodeWidth?: number;
    /** 同列节点垂直间距 */
    nodePadding?: number;
    /** 节点对齐方式 */
    alignment?: SankeyAlignment;
    /** 流量比例因子（每单位流量 → 多少像素高度），0 = 自动 */
    scale?: number;
    /** 颜色调色板 */
    palette?: string[];
}

export function computeSankeyLayout(
    data: SankeyData,
    options: SankeyLayoutOptions
): SankeyLayoutResult {
    if (data.layoutMode === 'chord') {
        return computeChordLayout(data, options);
    }
    const {
        width,
        height,
        nodeWidth = data.nodeWidth ?? 16,
        nodePadding = data.nodePadding ?? 12,
        alignment = data.alignment ?? 'justify',
        palette = data.colorPalette ?? DEFAULT_SANKEY_PALETTE,
    } = options;

    const { nodes: rawNodes, links: rawLinks } = data;

    if (!rawNodes.length || !rawLinks.length) {
        return { nodes: [], links: [], totalWidth: width, totalHeight: height, columnCount: 0 };
    }

    // ── Step 1: 过滤有效连线（source/target 必须存在）
    const nodeMap = new Map<string, SankeyNode>(rawNodes.map(n => [n.id, n]));
    const validLinks = rawLinks.filter(
        l => nodeMap.has(l.source) && nodeMap.has(l.target) && l.value > 0 && l.source !== l.target
    );

    // ── Step 2: 拓扑排序 → 分配列（Kahn's algorithm）
    const inDegree = new Map<string, number>();
    const outEdges = new Map<string, string[]>();
    rawNodes.forEach(n => { inDegree.set(n.id, 0); outEdges.set(n.id, []); });
    validLinks.forEach(l => {
        inDegree.set(l.target, (inDegree.get(l.target) ?? 0) + 1);
        outEdges.get(l.source)!.push(l.target);
    });

    const columns = new Map<string, number>();
    const queue: string[] = [];
    rawNodes.forEach(n => { if (inDegree.get(n.id) === 0) queue.push(n.id); });
    rawNodes.forEach(n => { if (!columns.has(n.id)) columns.set(n.id, 0); });

    while (queue.length) {
        const cur = queue.shift()!;
        const curCol = columns.get(cur) ?? 0;
        for (const neighbor of (outEdges.get(cur) ?? [])) {
            const newCol = curCol + 1;
            if ((columns.get(neighbor) ?? 0) < newCol) {
                columns.set(neighbor, newCol);
            }
            inDegree.set(neighbor, (inDegree.get(neighbor) ?? 1) - 1);
            if (inDegree.get(neighbor) === 0) queue.push(neighbor);
        }
    }

    // 对齐处理：right/justify → 最右节点贴到最大列
    const maxCol = Math.max(...Array.from(columns.values()));

    if (alignment === 'right') {
        // 叶子节点贴最右
        rawNodes.forEach(n => {
            if ((outEdges.get(n.id)?.length ?? 0) === 0) {
                columns.set(n.id, maxCol);
            }
        });
    }

    // ── Step 3: 计算每个节点的 inFlow / outFlow
    const inFlow = new Map<string, number>();
    const outFlow = new Map<string, number>();
    rawNodes.forEach(n => { inFlow.set(n.id, 0); outFlow.set(n.id, 0); });
    validLinks.forEach(l => {
        outFlow.set(l.source, (outFlow.get(l.source) ?? 0) + l.value);
        inFlow.set(l.target, (inFlow.get(l.target) ?? 0) + l.value);
    });

    // ── Step 4: 计算比例因子（scale）
    // 每列节点：高度之和 + padding * (n-1) <= height
    const colGroups = new Map<number, string[]>();
    rawNodes.forEach(n => {
        const col = columns.get(n.id) ?? 0;
        if (!colGroups.has(col)) colGroups.set(col, []);
        colGroups.get(col)!.push(n.id);
    });

    let scale: number;
    if (options.scale && options.scale > 0) {
        scale = options.scale;
    } else {
        // 找出最"拥挤"的列，据此求 scale
        let minScale = Infinity;
        colGroups.forEach((ids, _col) => {
            const totalFlow = ids.reduce((sum, id) => {
                const f = Math.max(inFlow.get(id) ?? 0, outFlow.get(id) ?? 0);
                return sum + (f || 1);
            }, 0);
            const availHeight = height - nodePadding * (ids.length - 1);
            const s = availHeight / (totalFlow || 1);
            if (s < minScale) minScale = s;
        });
        scale = minScale;
    }

    // ── Step 5: 为节点分配颜色
    const colorMap = new Map<string, string>();
    let colorIdx = 0;
    rawNodes.forEach(n => {
        if (n.color) {
            colorMap.set(n.id, n.color);
        } else {
            colorMap.set(n.id, palette[colorIdx % palette.length]);
            colorIdx++;
        }
    });

    // ── Step 6: 计算列 x 坐标
    const colCount = maxCol + 1;
    const colGapWidth = colCount > 1 ? (width - nodeWidth * colCount) / (colCount - 1) : 0;
    const colX = (col: number) => col * (nodeWidth + colGapWidth);

    // ── Step 7: 纵向排列节点（先按字母排序，再居中）
    const computedNodes = new Map<string, ComputedSankeyNode>();

    colGroups.forEach((ids, col) => {
        const totalFlow = ids.reduce((sum, id) => {
            const f = Math.max(inFlow.get(id) ?? 0, outFlow.get(id) ?? 0);
            return sum + (f || 1);
        }, 0);
        const totalH = totalFlow * scale + nodePadding * Math.max(ids.length - 1, 0);
        let startY = (height - totalH) / 2;

        // 稳定排序
        ids.sort();

        ids.forEach(id => {
            const raw = nodeMap.get(id)!;
            const f = Math.max(inFlow.get(id) ?? 0, outFlow.get(id) ?? 0) || 1;
            const nodeH = Math.max(f * scale, 2);
            computedNodes.set(id, {
                id,
                label: raw.label,
                description: raw.description,
                group: raw.group,
                color: colorMap.get(id)!,
                column: col,
                x: colX(col),
                y: startY,
                width: raw.nodeWidth ?? nodeWidth,
                height: nodeH,
                inFlow: inFlow.get(id) ?? 0,
                outFlow: outFlow.get(id) ?? 0,
                flow: f,
                raw,
            });
            startY += nodeH + nodePadding;
        });
    });

    // ── Step 8: 计算连线坐标
    // 跟踪每个节点的"已用出流 y 偏移"和"已用入流 y 偏移"
    const sourceYOffset = new Map<string, number>();
    const targetYOffset = new Map<string, number>();
    computedNodes.forEach((_, id) => { sourceYOffset.set(id, 0); targetYOffset.set(id, 0); });

    // ──────────────────────────────────────────────────────────────────────
    // 核心修复逻辑：基于单调性的物理排序 (Monotonic Link Sorting)
    // 如果不排序，同一节点引出的多条线会根据输入顺序放置，导致交叉。
    // 正确方案：
    // 1. 出流 (Source)：按目标节点的 Y 坐标排序。
    // 2. 入流 (Target)：按源节点的 Y 坐标排序。
    // ──────────────────────────────────────────────────────────────────────

    const computedLinks: ComputedSankeyLink[] = [];
    const nodeLinks = new Map<string, { incoming: any[], outgoing: any[] }>();
    computedNodes.forEach((_, id) => nodeLinks.set(id, { incoming: [], outgoing: [] }));

    validLinks.forEach((l, idx) => {
        const linkObj = { ...l, idx };
        if (nodeLinks.has(l.source)) nodeLinks.get(l.source)!.outgoing.push(linkObj);
        if (nodeLinks.has(l.target)) nodeLinks.get(l.target)!.incoming.push(linkObj);
    });

    // 为每个节点内部的连线进行排序
    computedNodes.forEach((node, id) => {
        const links = nodeLinks.get(id)!;
        // 出流：去往更低（Y更大）节点的连线排在后面
        links.outgoing.sort((a, b) => {
            const tgtA = computedNodes.get(a.target);
            const tgtB = computedNodes.get(b.target);
            return (tgtA?.y ?? 0) - (tgtB?.y ?? 0);
        });
        // 入流：来自更低（Y更大）节点的连线排在后面
        links.incoming.sort((a, b) => {
            const srcA = computedNodes.get(a.source);
            const srcB = computedNodes.get(b.source);
            return (srcA?.y ?? 0) - (srcB?.y ?? 0);
        });
    });

    // 预先计算所有连线的 sy0/sy1 和 ty0/ty1
    const linkPositions = new Map<number, { sy0: number; sy1: number; ty0: number; ty1: number; bandwidth: number; tBandwidth: number }>();

    computedNodes.forEach((node, id) => {
        const links = nodeLinks.get(id)!;
        let sOff = 0;
        let tOff = 0;

        const srcCenterOffset = node.outFlow < node.flow
            ? (node.height - (node.outFlow / node.flow) * node.height) / 2
            : 0;
        const tgtCenterOffset = node.inFlow < node.flow
            ? (node.height - (node.inFlow / node.flow) * node.height) / 2
            : 0;

        // 处理出流（作为 Source）
        links.outgoing.forEach(l => {
            const srcOutFlow = Math.max(node.outFlow, 1);
            const bandwidth = Math.max((l.value / srcOutFlow) * node.height, 1);
            const sy0 = node.y + srcCenterOffset + sOff;
            const sy1 = sy0 + bandwidth;

            if (!linkPositions.has(l.idx)) {
                linkPositions.set(l.idx, { sy0: 0, sy1: 0, ty0: 0, ty1: 0, bandwidth: 0, tBandwidth: 0 });
            }
            const pos = linkPositions.get(l.idx)!;
            pos.sy0 = sy0;
            pos.sy1 = sy1;
            pos.bandwidth = bandwidth;
            sOff += bandwidth;
        });

        // 处理入流（作为 Target）
        links.incoming.forEach(l => {
            const tgtInFlow = Math.max(node.inFlow, 1);
            const tBandwidth = Math.max((l.value / tgtInFlow) * node.height, 1);
            const ty0 = node.y + tgtCenterOffset + tOff;
            const ty1 = ty0 + tBandwidth;

            if (!linkPositions.has(l.idx)) {
                linkPositions.set(l.idx, { sy0: 0, sy1: 0, ty0: 0, ty1: 0, bandwidth: 0, tBandwidth: 0 });
            }
            const pos = linkPositions.get(l.idx)!;
            pos.ty0 = ty0;
            pos.ty1 = ty1;
            pos.tBandwidth = tBandwidth;
            tOff += tBandwidth;
        });
    });

    // 最后组装结果
    validLinks.forEach((l, idx) => {
        const src = computedNodes.get(l.source)!;
        const tgt = computedNodes.get(l.target)!;
        const pos = linkPositions.get(idx)!;

        computedLinks.push({
            id: l.id ?? `link_${idx}`,
            source: src,
            target: tgt,
            value: l.value,
            label: l.label,
            color: l.color ?? src.color,
            opacity: l.opacity ?? data.linkOpacity ?? 0.4,
            highlight: l.highlight ?? false,
            sy0: pos.sy0,
            sy1: pos.sy1,
            ty0: pos.ty0,
            ty1: pos.ty1,
            bandwidth: Math.max(pos.bandwidth, pos.tBandwidth) / 2,
        });
    });

    return {
        nodes: Array.from(computedNodes.values()),
        links: computedLinks,
        totalWidth: width,
        totalHeight: height,
        columnCount: colCount,
    };
}

// ─────────────────────────────────────────────
// SVG Path 生成辅助
// ─────────────────────────────────────────────

/**
 * 生成桑基图连线的 SVG path（bezier 曲线）
 * 连线从 source 右侧出发，到 target 左侧
 */
export function buildSankeyLinkPath(
    link: ComputedSankeyLink,
    curveType: 'bezier' | 'linear' | 'step' = 'bezier'
): string {
    const { source, target, sy0, sy1, ty0, ty1 } = link;
    const x0 = source.x + source.width; // source 右边
    const x1 = target.x;               // target 左边
    const midX = (x0 + x1) / 2;

    if (curveType === 'linear') {
        return [
            `M ${x0} ${sy0}`,
            `L ${x1} ${ty0}`,
            `L ${x1} ${ty1}`,
            `L ${x0} ${sy1}`,
            `Z`,
        ].join(' ');
    }

    if (curveType === 'step') {
        return [
            `M ${x0} ${sy0}`,
            `L ${midX} ${sy0}`,
            `L ${midX} ${ty0}`,
            `L ${x1} ${ty0}`,
            `L ${x1} ${ty1}`,
            `L ${midX} ${ty1}`,
            `L ${midX} ${sy1}`,
            `L ${x0} ${sy1}`,
            `Z`,
        ].join(' ');
    }

    // bezier（默认）
    return [
        `M ${x0} ${sy0}`,
        `C ${midX} ${sy0}, ${midX} ${ty0}, ${x1} ${ty0}`,
        `L ${x1} ${ty1}`,
        `C ${midX} ${ty1}, ${midX} ${sy1}, ${x0} ${sy1}`,
        `Z`,
    ].join(' ');
}

/**
 * 为数值添加单位后缀，并格式化
 */
export function formatSankeyValue(value: number, unit?: string): string {
    let str: string;
    if (value >= 1_000_000) str = `${(value / 1_000_000).toFixed(1)}M`;
    else if (value >= 1_000) str = `${(value / 1_000).toFixed(1)}K`;
    else if (Number.isInteger(value)) str = value.toString();
    else str = value.toFixed(2);
    return unit ? `${str} ${unit}` : str;
}

// ─────────────────────────────────────────────
// 轻量级拓扑列计算（供侧边栏拓扑管理用）
// ─────────────────────────────────────────────

export interface SankeyColumnInfo {
    /** 列索引 */
    column: number;
    /** 该列中的节点 ID 列表 */
    nodeIds: string[];
}

/**
 * 仅做拓扑排序计算节点列归属，不做坐标布局。
 * 返回按列索引排好序的列信息数组。
 */
export function computeNodeColumns(data: SankeyData): SankeyColumnInfo[] {
    if (!data.nodes.length) return [];

    const nodeMap = new Map<string, SankeyNode>(data.nodes.map(n => [n.id, n]));
    const validLinks = data.links.filter(
        l => nodeMap.has(l.source) && nodeMap.has(l.target) && l.value > 0 && l.source !== l.target
    );

    // Kahn's algorithm
    const inDegree = new Map<string, number>();
    const outEdges = new Map<string, string[]>();
    data.nodes.forEach(n => { inDegree.set(n.id, 0); outEdges.set(n.id, []); });
    validLinks.forEach(l => {
        inDegree.set(l.target, (inDegree.get(l.target) ?? 0) + 1);
        outEdges.get(l.source)!.push(l.target);
    });

    const columns = new Map<string, number>();
    const queue: string[] = [];
    data.nodes.forEach(n => { if (inDegree.get(n.id) === 0) queue.push(n.id); });
    data.nodes.forEach(n => { if (!columns.has(n.id)) columns.set(n.id, 0); });

    while (queue.length) {
        const cur = queue.shift()!;
        const curCol = columns.get(cur) ?? 0;
        for (const neighbor of (outEdges.get(cur) ?? [])) {
            const newCol = curCol + 1;
            if ((columns.get(neighbor) ?? 0) < newCol) {
                columns.set(neighbor, newCol);
            }
            inDegree.set(neighbor, (inDegree.get(neighbor) ?? 1) - 1);
            if (inDegree.get(neighbor) === 0) queue.push(neighbor);
        }
    }

    // 按列分组
    const colGroups = new Map<number, string[]>();
    data.nodes.forEach(n => {
        const col = columns.get(n.id) ?? 0;
        if (!colGroups.has(col)) colGroups.set(col, []);
        colGroups.get(col)!.push(n.id);
    });

    // 排序后返回
    return Array.from(colGroups.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([column, nodeIds]) => ({ column, nodeIds }));
}

function isNodeBetweenClockwise(pos: number, start: number, end: number): boolean {
    if (start === end) return false;
    if (start < end) return pos > start && pos < end;
    return pos > start || pos < end;
}

function doChordLinksCross(
    a0: number,
    a1: number,
    b0: number,
    b1: number
): boolean {
    const b0InA = isNodeBetweenClockwise(b0, a0, a1);
    const b1InA = isNodeBetweenClockwise(b1, a0, a1);
    if (b0InA === b1InA) return false;

    const a0InB = isNodeBetweenClockwise(a0, b0, b1);
    const a1InB = isNodeBetweenClockwise(a1, b0, b1);
    return a0InB !== a1InB;
}

function computeChordCrossingCost(nodes: SankeyNode[], links: SankeyLink[]): number {
    if (nodes.length < 4 || links.length < 2) return 0;
    const pos = new Map<string, number>();
    nodes.forEach((n, idx) => pos.set(n.id, idx));

    let cost = 0;
    for (let i = 0; i < links.length; i++) {
        const li = links[i];
        if (li.source === li.target) continue;
        const liS = pos.get(li.source);
        const liT = pos.get(li.target);
        if (liS === undefined || liT === undefined) continue;

        for (let j = i + 1; j < links.length; j++) {
            const lj = links[j];
            if (lj.source === lj.target) continue;
            // 共享端点时不计交叉
            if (
                li.source === lj.source ||
                li.source === lj.target ||
                li.target === lj.source ||
                li.target === lj.target
            ) {
                continue;
            }

            const ljS = pos.get(lj.source);
            const ljT = pos.get(lj.target);
            if (ljS === undefined || ljT === undefined) continue;

            if (doChordLinksCross(liS, liT, ljS, ljT)) {
                // 交叉代价按较小流量加权，优先消除“粗线交叉”
                cost += Math.min(li.value, lj.value);
            }
        }
    }
    return cost;
}

function computeChordSpanCost(nodes: SankeyNode[], links: SankeyLink[]): number {
    if (nodes.length < 2 || links.length === 0) return 0;
    const n = nodes.length;
    const pos = new Map<string, number>();
    nodes.forEach((node, idx) => pos.set(node.id, idx));

    let span = 0;
    for (const l of links) {
        const s = pos.get(l.source);
        const t = pos.get(l.target);
        if (s === undefined || t === undefined || s === t) continue;
        const diff = Math.abs(s - t);
        const ringDist = Math.min(diff, n - diff);
        span += ringDist * l.value;
    }
    return span;
}

function refineChordOrder(nodes: SankeyNode[], links: SankeyLink[], maxPasses: number): SankeyNode[] {
    let best = [...nodes];
    let bestCross = computeChordCrossingCost(best, links);
    let bestSpan = computeChordSpanCost(best, links);

    for (let pass = 0; pass < maxPasses; pass++) {
        let improved = false;

        // 1) 邻接交换
        for (let i = 0; i < best.length - 1; i++) {
            const cand = [...best];
            [cand[i], cand[i + 1]] = [cand[i + 1], cand[i]];
            const cCross = computeChordCrossingCost(cand, links);
            const cSpan = computeChordSpanCost(cand, links);
            if (cCross < bestCross || (cCross === bestCross && cSpan + 1e-9 < bestSpan)) {
                best = cand;
                bestCross = cCross;
                bestSpan = cSpan;
                improved = true;
            }
        }

        // 2) 插入移动（比纯 swap 更能跳出局部最优）
        for (let i = 0; i < best.length; i++) {
            for (let j = 0; j < best.length; j++) {
                if (i === j) continue;
                const cand = [...best];
                const [moved] = cand.splice(i, 1);
                cand.splice(j, 0, moved);
                const cCross = computeChordCrossingCost(cand, links);
                const cSpan = computeChordSpanCost(cand, links);
                if (cCross < bestCross || (cCross === bestCross && cSpan + 1e-9 < bestSpan)) {
                    best = cand;
                    bestCross = cCross;
                    bestSpan = cSpan;
                    improved = true;
                }
            }
        }

        // 3) 2-opt 反转
        for (let i = 0; i < best.length - 2; i++) {
            for (let j = i + 2; j < best.length; j++) {
                if (i === 0 && j === best.length - 1) continue;
                const cand = [
                    ...best.slice(0, i),
                    ...best.slice(i, j + 1).reverse(),
                    ...best.slice(j + 1),
                ];
                const cCross = computeChordCrossingCost(cand, links);
                const cSpan = computeChordSpanCost(cand, links);
                if (cCross < bestCross || (cCross === bestCross && cSpan + 1e-9 < bestSpan)) {
                    best = cand;
                    bestCross = cCross;
                    bestSpan = cSpan;
                    improved = true;
                }
            }
        }

        if (!improved || bestCross <= 0) break;
    }

    return best;
}

function buildGreedyOrder(nodes: SankeyNode[], links: SankeyLink[]): SankeyNode[] {
    if (nodes.length <= 2) return [...nodes];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const idxById = new Map(nodes.map((n, i) => [n.id, i]));
    const weight = new Map<string, number>();
    const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    for (const l of links) {
        if (!nodeById.has(l.source) || !nodeById.has(l.target) || l.source === l.target) continue;
        const k = keyOf(l.source, l.target);
        weight.set(k, (weight.get(k) ?? 0) + l.value);
    }

    const degree = new Map<string, number>();
    nodes.forEach(n => degree.set(n.id, 0));
    for (const [k, w] of weight.entries()) {
        const [a, b] = k.split('|');
        degree.set(a, (degree.get(a) ?? 0) + w);
        degree.set(b, (degree.get(b) ?? 0) + w);
    }

    const start = [...nodes].sort((a, b) => {
        const da = degree.get(a.id) ?? 0;
        const db = degree.get(b.id) ?? 0;
        if (db !== da) return db - da;
        return (idxById.get(a.id) ?? 0) - (idxById.get(b.id) ?? 0);
    })[0];

    const used = new Set<string>([start.id]);
    const order: SankeyNode[] = [start];

    while (order.length < nodes.length) {
        const tail = order[order.length - 1];
        let bestNode: SankeyNode | null = null;
        let bestWeight = -1;
        let bestIdx = Infinity;

        for (const cand of nodes) {
            if (used.has(cand.id)) continue;
            const w = weight.get(keyOf(tail.id, cand.id)) ?? 0;
            const idx = idxById.get(cand.id) ?? 0;
            if (w > bestWeight || (w === bestWeight && idx < bestIdx)) {
                bestWeight = w;
                bestIdx = idx;
                bestNode = cand;
            }
        }

        if (!bestNode) break;
        used.add(bestNode.id);
        order.push(bestNode);
    }

    if (order.length < nodes.length) {
        for (const n of nodes) {
            if (!used.has(n.id)) order.push(n);
        }
    }
    return order;
}

const chordOrderCache = new Map<string, string[]>();

function makeChordGraphSignature(nodes: SankeyNode[], links: SankeyLink[]): string {
    const nodePart = nodes.map(n => n.id).join(',');
    const linkPart = [...links]
        .map(l => `${l.source}>${l.target}:${l.value}`)
        .sort()
        .join('|');
    return `${nodePart}||${linkPart}`;
}

function optimizeChordNodeOrderExact(nodes: SankeyNode[], links: SankeyLink[]): SankeyNode[] | null {
    // 小图使用精确枚举，获得全局最优节点环序
    if (nodes.length < 4 || nodes.length > 10 || links.length > 80) return null;

    const signature = makeChordGraphSignature(nodes, links);
    const cached = chordOrderCache.get(signature);
    if (cached) {
        const byId = new Map(nodes.map(n => [n.id, n]));
        const restored = cached.map(id => byId.get(id)).filter(Boolean) as SankeyNode[];
        if (restored.length === nodes.length) return restored;
    }

    const degree = new Map<string, number>();
    nodes.forEach(n => degree.set(n.id, 0));
    links.forEach(l => {
        degree.set(l.source, (degree.get(l.source) ?? 0) + l.value);
        degree.set(l.target, (degree.get(l.target) ?? 0) + l.value);
    });

    const startNode = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
    const rest = nodes.filter(n => n.id !== startNode.id);

    let bestOrder = [startNode, ...rest];
    let bestCross = computeChordCrossingCost(bestOrder, links);
    let bestSpan = computeChordSpanCost(bestOrder, links);

    const used = new Array(rest.length).fill(false);
    const current: SankeyNode[] = [startNode];

    const dfs = () => {
        if (current.length === nodes.length) {
            const cCross = computeChordCrossingCost(current, links);
            const cSpan = computeChordSpanCost(current, links);
            if (cCross < bestCross || (cCross === bestCross && cSpan + 1e-9 < bestSpan)) {
                bestOrder = [...current];
                bestCross = cCross;
                bestSpan = cSpan;
            }
            return;
        }

        for (let i = 0; i < rest.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            current.push(rest[i]);
            dfs();
            current.pop();
            used[i] = false;
        }
    };

    dfs();
    chordOrderCache.set(signature, bestOrder.map(n => n.id));
    return bestOrder;
}

function optimizeChordNodeOrder(nodes: SankeyNode[], links: SankeyLink[]): SankeyNode[] {
    if (nodes.length < 4 || links.length < 2) return nodes;
    // 避免超大规模时重排过慢
    if (nodes.length > 80 || links.length > 240) return nodes;

    const exactOrder = optimizeChordNodeOrderExact(nodes, links);
    if (exactOrder) return exactOrder;

    const reverseOrder = [...nodes].reverse();
    const greedyOrder = buildGreedyOrder(nodes, links);
    const greedyReverse = [...greedyOrder].reverse();
    const initialCandidates: SankeyNode[][] = [nodes, reverseOrder, greedyOrder, greedyReverse];

    let bestOrder = [...nodes];
    let bestCross = computeChordCrossingCost(bestOrder, links);
    let bestSpan = computeChordSpanCost(bestOrder, links);
    const maxPasses = nodes.length <= 36 && links.length <= 120 ? 4 : 2;

    for (const cand of initialCandidates) {
        const refined = refineChordOrder(cand, links, maxPasses);
        const cCross = computeChordCrossingCost(refined, links);
        const cSpan = computeChordSpanCost(refined, links);
        if (cCross < bestCross || (cCross === bestCross && cSpan + 1e-9 < bestSpan)) {
            bestOrder = refined;
            bestCross = cCross;
            bestSpan = cSpan;
        }
    }

    return bestOrder;
}

/**
 * 环形弦图布局算法
 */
export function computeChordLayout(
    data: SankeyData,
    options: SankeyLayoutOptions
): SankeyLayoutResult {
    const { width, height, palette = data.colorPalette ?? DEFAULT_SANKEY_PALETTE } = options;
    const { nodes: rawNodes, links: rawLinks } = data;

    const nodeMap = new Map<string, SankeyNode>(rawNodes.map(n => [n.id, n]));
    const validLinks = rawLinks.filter(l => nodeMap.has(l.source) && nodeMap.has(l.target) && l.value > 0);
    const orderedNodes = optimizeChordNodeOrder(rawNodes, validLinks);
    const rawIndexById = new Map<string, number>();
    rawNodes.forEach((n, i) => rawIndexById.set(n.id, i));

    // 读取可配置参数
    const gapRatio = Math.max(0, Math.min(0.3, data.chordGapRatio ?? 0.1));
    const startAngleOffset = ((data.chordStartAngle ?? 0) / 180) * Math.PI; // 度转弧度

    // 计算总流量 —— 统一分配策略: arc = inFlow + outFlow
    // 这样每个连线（入/出）都有自己独立的弧段，永不重叠。
    const inFlow = new Map<string, number>();
    const outFlow = new Map<string, number>();
    orderedNodes.forEach(n => { inFlow.set(n.id, 0); outFlow.set(n.id, 0); });
    validLinks.forEach(l => {
        outFlow.set(l.source, (outFlow.get(l.source) ?? 0) + l.value);
        inFlow.set(l.target, (inFlow.get(l.target) ?? 0) + l.value);
    });

    const totalFlow = orderedNodes.reduce((sum, n) => sum + (inFlow.get(n.id) ?? 0) + (outFlow.get(n.id) ?? 0), 0);
    const gapTotal = gapRatio * (Math.PI * 2);
    const flowScale = (Math.PI * 2 - gapTotal) / (totalFlow || 1);
    const nodeGap = gapTotal / (orderedNodes.length || 1);

    const computedNodes: ComputedSankeyNode[] = [];
    const nodesById = new Map<string, ComputedSankeyNode>();
    let currentAngle = startAngleOffset;

    orderedNodes.forEach((n, i) => {
        const flow = (inFlow.get(n.id) ?? 0) + (outFlow.get(n.id) ?? 0) || 1;
        const arcLen = flow * flowScale;
        const startAngle = currentAngle;
        const endAngle = startAngle + arcLen;
        const rawIdx = rawIndexById.get(n.id) ?? i;

        const node: ComputedSankeyNode = {
            id: n.id,
            label: n.label,
            color: n.color || palette[rawIdx % palette.length],
            column: 0,
            x: 0, y: 0, width: 20, height: 20,
            inFlow: inFlow.get(n.id) ?? 0,
            outFlow: outFlow.get(n.id) ?? 0,
            flow,
            raw: n,
            startAngle,
            endAngle
        };
        computedNodes.push(node);
        nodesById.set(n.id, node);
        currentAngle = endAngle + nodeGap;
    });

    // ──────────────────────────────────────────────────────────────────────
    // 统一分配策略: 每个节点上的所有连线（入和出）统一排序并按序分配角度。
    // 按对端节点的全局索引排序，保证连线像花瓣一样散开且互不交叉。
    // ──────────────────────────────────────────────────────────────────────

    const linkSourceAngles = new Map<number, { sStart: number; sEnd: number }>();
    const linkTargetAngles = new Map<number, { tStart: number; tEnd: number }>();

    orderedNodes.forEach(node => {
        const cNode = nodesById.get(node.id)!;

        // 收集该节点上的所有连线（作为源或作为目标）
        const connections: {
            link: typeof validLinks[0];
            idx: number;
            isSource: boolean;
            otherNodeId: string
        }[] = [];

        validLinks.forEach((l, i) => {
            if (l.source === node.id) {
                connections.push({ link: l, idx: i, isSource: true, otherNodeId: l.target });
            } else if (l.target === node.id) {
                connections.push({ link: l, idx: i, isSource: false, otherNodeId: l.source });
            }
        });

        // ──────────────────────────────────────────────────────────────────────
        // 核心修复逻辑：基于极坐标偏角的单调性排序 (Unified Monotonicity)
        // 移除出/入流分区，统统按关联节点在圆周上的物理顺时针偏角排序。
        // 这样可以确保：“顺时针看第一个撞到的节点，其流量点也在本弧段顺时针第一位”。
        // ──────────────────────────────────────────────────────────────────────
        const getAngle = (id: string) => {
            const otherNode = nodesById.get(id)!;
            const otherMid = (otherNode.startAngle! + otherNode.endAngle!) / 2;
            let diff = otherMid - cNode.startAngle!;
            while (diff < 0) diff += Math.PI * 2;
            while (diff >= Math.PI * 2) diff -= Math.PI * 2;
            return diff;
        };

        connections.sort((a, b) => {
            const angA = getAngle(a.otherNodeId);
            const angB = getAngle(b.otherNodeId);
            if (Math.abs(angA - angB) > 0.000001) return angA - angB;

            // 如果对端是同一个节点（双向流），出流排在前面，保持确定性
            if (a.isSource !== b.isSource) return a.isSource ? -1 : 1;
            return b.link.value - a.link.value;
        });

        const finalSorted = connections;

        // 统一分配
        let currentOffset = 0;
        const nodeFlow = cNode.flow || 1;
        const nodeArc = cNode.endAngle! - cNode.startAngle!;

        finalSorted.forEach(conn => {
            const padding = nodeArc * 0.002; // 0.2% 物理间距
            const start = cNode.startAngle! + (currentOffset / nodeFlow) * nodeArc + padding;
            const end = start + (conn.link.value / nodeFlow) * nodeArc - padding * 2;

            if (conn.isSource) {
                linkSourceAngles.set(conn.idx, { sStart: start, sEnd: end });
            } else {
                linkTargetAngles.set(conn.idx, { tStart: start, tEnd: end });
            }
            currentOffset += conn.link.value;
        });
    });

    // 第三步：组装 computedLinks
    const computedLinks: ComputedSankeyLink[] = [];
    validLinks.forEach((l, i) => {
        const src = nodesById.get(l.source)!;
        const tgt = nodesById.get(l.target)!;
        const sa = linkSourceAngles.get(i) ?? { sStart: src.startAngle!, sEnd: src.endAngle! };
        const ta = linkTargetAngles.get(i) ?? { tStart: tgt.startAngle!, tEnd: tgt.endAngle! };

        computedLinks.push({
            id: l.id || `link_${i}`,
            source: src,
            target: tgt,
            value: l.value,
            color: l.color || src.color,
            opacity: l.opacity ?? data.chordLinkOpacity ?? 0.25,
            highlight: l.highlight ?? false,
            bandwidth: 0,
            sy0: 0, sy1: 0, ty0: 0, ty1: 0,
            sourceStartAngle: sa.sStart,
            sourceEndAngle: sa.sEnd,
            targetStartAngle: ta.tStart,
            targetEndAngle: ta.tEnd
        });
    });

    return {
        nodes: computedNodes,
        links: computedLinks,
        totalWidth: width,
        totalHeight: height,
        columnCount: 1
    };
}
