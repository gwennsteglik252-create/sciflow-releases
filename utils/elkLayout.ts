/**
 * 分层带布局引擎 — 节点居中紧凑排列，支持全宽横幅节点
 */
import { MindMapData } from '../components/FigureCenter/MindMap/types';

const NODE_GAP_MIN = 24;
const NODE_GAP_MAX = 55;
const LAYER_PAD_TOP = 45;
const LAYER_PAD_BOTTOM = 20;
const PAD_X = 40;
// 与 MindMapCanvas 中保持一致的不对称内缩
const LAYER_INSET_LEFT = 95;
const LAYER_INSET_RIGHT = 55;

export async function applyElkLayout(data: MindMapData): Promise<MindMapData> {
  return applySimpleLayout(data);
}

export function applySimpleLayout(data: MindMapData): MindMapData {
  const canvasW = data.globalConfig.canvasWidth;
  // 层容器有效宽度
  const effectiveW = canvasW - LAYER_INSET_LEFT - LAYER_INSET_RIGHT;
  const usableW = effectiveW - PAD_X * 2;

  const newLayers = data.layers.map(layer => {
    const nodes = layer.nodes;
    if (nodes.length === 0) return layer;

    // 分离全宽节点和普通节点
    const fullNodes = nodes.filter(n => n.widthMode === 'full');
    const autoNodes = nodes.filter(n => n.widthMode !== 'full');

    const nodeY = LAYER_PAD_TOP;
    let placedNodes: typeof nodes = [];

    // 全宽节点：横跨整个可用宽度，居中
    const fullWidth = usableW - 20; // 留 10px 两侧余量
    fullNodes.forEach((n, i) => {
      placedNodes.push({
        ...n,
        x: PAD_X + 10,
        y: nodeY + i * 50, // 多个全宽节点垂直堆叠
        width: fullWidth,
        height: n.height || 40,
      });
    });

    // 普通节点
    if (autoNodes.length > 0) {
      const autoY = fullNodes.length > 0
        ? nodeY + fullNodes.length * 50 + 10 // 全宽节点下方
        : nodeY;

      const maxW = Math.floor((usableW - NODE_GAP_MIN * Math.max(0, autoNodes.length - 1)) / autoNodes.length);
      const clampedAuto = autoNodes.map(n => ({
        ...n,
        width: Math.min(n.width || 170, Math.max(120, maxW)),
        height: n.height || 52,
      }));

      const widths = clampedAuto.map(n => n.width);
      const totalNodesW = widths.reduce((s, w) => s + w, 0);

      if (autoNodes.length === 1) {
        // 单节点在层容器内居中
        placedNodes.push({ ...clampedAuto[0], x: (effectiveW - widths[0]) / 2, y: autoY });
      } else {
        const rawGap = (usableW - totalNodesW) / (autoNodes.length - 1);
        const gap = Math.max(NODE_GAP_MIN, Math.min(NODE_GAP_MAX, rawGap));
        const totalOccupied = totalNodesW + gap * (autoNodes.length - 1);
        // 在层容器内居中
        const startX = (effectiveW - totalOccupied) / 2;

        let cx = startX;
        clampedAuto.forEach((n, i) => {
          placedNodes.push({ ...n, x: cx, y: autoY });
          cx += widths[i] + gap;
        });
      }
    }

    // 计算层高度
    const maxBottom = Math.max(...placedNodes.map(n => n.y + n.height));
    const autoH = maxBottom + LAYER_PAD_BOTTOM;
    const finalHeight = Math.max(layer.height || 0, autoH, 120);

    return { ...layer, nodes: placedNodes, height: finalHeight };
  });

  const newConnections = data.connections.map(conn => {
    const { routePoints, ...rest } = conn;
    return rest;
  });

  return { ...data, layers: newLayers, connections: newConnections };
}
