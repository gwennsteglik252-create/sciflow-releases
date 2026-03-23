/**
 * Graph Intelligence Engine — 图谱自动推理引擎 (Phase 3)
 * 
 * 功能：
 * 1. 矛盾检测 — 发现同一参数在不同实验中结论相反
 * 2. 缺口发现 — 检测里程碑缺少实验验证的薄弱环节
 * 3. 机会推荐 — 发现可以结合的文献/方法交叉点
 * 4. 风险预警 — 关键依赖链上的节点缺少支撑
 * 5. 语义聚类 — 基于节点语义相似度形成主题簇
 */

import { GraphNode, GraphEdge, GraphInsight } from '../types';
import { cosineSimilarity } from '../services/gemini/rag';
import { findUpstreamPath } from '../services/graphService';

// ─── 矛盾检测 ─────────────────────────────────────────────────────
// 规则：同一个里程碑下既有 success 又有 failed 的实验，且它们都连接了不同文献
function detectContradictions(nodes: GraphNode[], edges: GraphEdge[]): GraphInsight[] {
  const insights: GraphInsight[] = [];

  // 找到所有里程碑
  const milestones = nodes.filter(n => n.type === 'TRL_Milestone');

  for (const ms of milestones) {
    // 找到连接此里程碑的所有实验节点
    const connectedExperiments = edges
      .filter(e => e.source === ms.id || e.target === ms.id)
      .map(e => e.source === ms.id ? e.target : e.source)
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is GraphNode =>
        n !== undefined && n.type === 'Characterization'
      );

    const successExps = connectedExperiments.filter(n => n.status === 'success');
    const failedExps = connectedExperiments.filter(n => n.status === 'failed');

    if (successExps.length > 0 && failedExps.length > 0) {
      insights.push({
        id: `contradiction_${ms.id}`,
        type: 'contradiction',
        involvedNodes: [ms.id, ...successExps.map(n => n.id), ...failedExps.map(n => n.id)],
        title: `数据矛盾: ${ms.label}`,
        description: `里程碑「${ms.label}」下有 ${successExps.length} 条成功实验和 ${failedExps.length} 条失败实验。` +
          `建议对比分析两组实验的参数差异，确认是条件差异还是结论矛盾。`,
        confidence: 0.75,
        severity: 'medium',
        suggestedAction: `对比成功/失败实验的关键参数差异`,
        generatedAt: Date.now(),
      });
    }
  }

  return insights;
}

// ─── 缺口发现 ─────────────────────────────────────────────────────
// 规则：里程碑没有任何实验证据支撑（0连接），或所有实验都失败了
function detectGaps(nodes: GraphNode[], edges: GraphEdge[]): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const milestones = nodes.filter(n => n.type === 'TRL_Milestone');

  for (const ms of milestones) {
    const connectedExperiments = edges
      .filter(e => (e.source === ms.id || e.target === ms.id) && e.type === 'proves')
      .map(e => e.source === ms.id ? e.target : e.source)
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => n !== undefined && n.type === 'Characterization');

    if (connectedExperiments.length === 0) {
      // 完全没有实验支撑
      insights.push({
        id: `gap_no_evidence_${ms.id}`,
        type: 'gap',
        involvedNodes: [ms.id],
        title: `证据缺失: ${ms.label}`,
        description: `里程碑「${ms.label}」目前没有任何实验数据支撑验证。建议设计相关实验来验证研究假设。`,
        confidence: 0.9,
        severity: 'high',
        suggestedAction: `为此里程碑设计验证实验`,
        generatedAt: Date.now(),
      });
    } else {
      // 所有实验都失败了
      const allFailed = connectedExperiments.every(n => n.status === 'failed');
      if (allFailed && connectedExperiments.length >= 2) {
        insights.push({
          id: `gap_all_failed_${ms.id}`,
          type: 'gap',
          involvedNodes: [ms.id, ...connectedExperiments.map(n => n.id)],
          title: `验证困难: ${ms.label}`,
          description: `里程碑「${ms.label}」的所有 ${connectedExperiments.length} 条实验均已失败。` +
            `建议重新评估研究假设或调整实验方案。`,
          confidence: 0.85,
          severity: 'high',
          suggestedAction: `重新评估假设，考虑调整实验路线`,
          generatedAt: Date.now(),
        });
      }
    }
  }

  return insights;
}

// ─── 机会推荐 ─────────────────────────────────────────────────────
// 规则：两篇文献连接到同一个项目节点但彼此没有直接连接 → 交叉参考机会
function detectOpportunities(nodes: GraphNode[], edges: GraphEdge[]): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const literatureNodes = nodes.filter(n => n.type === 'Literature');

  // 找到连接到同一个项目/里程碑的文献对
  const nodeConnections = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!nodeConnections.has(edge.source)) nodeConnections.set(edge.source, new Set());
    if (!nodeConnections.has(edge.target)) nodeConnections.set(edge.target, new Set());
    nodeConnections.get(edge.source)!.add(edge.target);
    nodeConnections.get(edge.target)!.add(edge.source);
  }

  // 检查文献之间是否存在间接关联（通过共同的上游/下游节点）
  for (let i = 0; i < literatureNodes.length; i++) {
    for (let j = i + 1; j < literatureNodes.length; j++) {
      const litA = literatureNodes[i];
      const litB = literatureNodes[j];

      // 检查是否已直接关联
      const directlyConnected =
        nodeConnections.get(litA.id)?.has(litB.id) ||
        nodeConnections.get(litB.id)?.has(litA.id);

      if (directlyConnected) continue;

      // 找共同邻居
      const neighborsA = nodeConnections.get(litA.id) || new Set();
      const neighborsB = nodeConnections.get(litB.id) || new Set();
      const commonNeighbors = [...neighborsA].filter(n => neighborsB.has(n));

      if (commonNeighbors.length > 0) {
        const commonLabels = commonNeighbors
          .map(id => nodes.find(n => n.id === id)?.label || '')
          .filter(l => l)
          .slice(0, 3);

        insights.push({
          id: `opportunity_${litA.id}_${litB.id}`,
          type: 'opportunity',
          involvedNodes: [litA.id, litB.id, ...commonNeighbors],
          title: `交叉参考机会`,
          description: `文献「${litA.label}」和「${litB.label}」通过 ${commonLabels.join('、')} 间接关联，` +
            `但尚未直接比较。建议交叉对比两者的方法论或数据。`,
          confidence: 0.6,
          severity: 'low',
          suggestedAction: `对比两篇文献的方法异同`,
          generatedAt: Date.now(),
        });
      }
    }
  }

  // 限制机会洞察数量避免噪声
  return insights.slice(0, 3);
}

// ─── 风险预警 ─────────────────────────────────────────────────────
// 规则：关键路径上单点依赖（某节点的上游只有一条路径，且直接依赖的实验只有一条）
function detectRisks(nodes: GraphNode[], edges: GraphEdge[]): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const milestones = nodes.filter(n => n.type === 'TRL_Milestone');

  for (const ms of milestones) {
    // 检查此里程碑的上游路径
    const upstreamPath = findUpstreamPath(ms.id, edges);
    const upstreamNodes = [...upstreamPath]
      .map(id => nodes.find(n => n.id === id))
      .filter((n): n is GraphNode => n !== undefined);

    // 找出路径上的实验节点
    const pathExperiments = upstreamNodes.filter(n => n.type === 'Characterization');
    const pathLiterature = upstreamNodes.filter(n => n.type === 'Literature');

    // 风险：里程碑只有一条实验支撑，且没有文献参考
    if (pathExperiments.length === 1 && pathLiterature.length === 0) {
      insights.push({
        id: `risk_single_dep_${ms.id}`,
        type: 'risk',
        involvedNodes: [ms.id, ...pathExperiments.map(n => n.id)],
        title: `单点依赖风险: ${ms.label}`,
        description: `里程碑「${ms.label}」仅依赖 1 条实验数据，且没有文献理论支撑。` +
          `建议增加重复实验或查找相关文献佐证。`,
        confidence: 0.7,
        severity: 'medium',
        suggestedAction: `增加重复实验或查找支撑文献`,
        generatedAt: Date.now(),
      });
    }
  }

  return insights;
}

// ─── 语义聚类检测 ─────────────────────────────────────────────────
// ★ 动态关键词提取（替代硬编码关键词列表）
function detectClusters(nodes: GraphNode[]): GraphInsight[] {
  const insights: GraphInsight[] = [];
  const literatureNodes = nodes.filter(n => n.type === 'Literature');

  if (literatureNodes.length < 3) return insights;

  // ★ 从节点标签中动态提取高频关键词（ngram）
  const freqMap = new Map<string, GraphNode[]>();
  const STOP_WORDS = new Set(['...', 'the', 'and', 'for', 'with', 'from', 'based', '的', '与', '及']);

  for (const node of literatureNodes) {
    const label = node.label.replace(/\.{3}$/, ''); // 去掉截断省略号
    const seen = new Set<string>(); // 去重：每个节点对每个关键词只计一次

    // 提取英文单词（≥3字母）
    const englishWords = label.match(/[a-zA-Z]{3,}/gi) || [];
    for (const word of englishWords) {
      const lower = word.toLowerCase();
      if (STOP_WORDS.has(lower)) continue;
      if (!seen.has(lower)) {
        seen.add(lower);
        if (!freqMap.has(lower)) freqMap.set(lower, []);
        freqMap.get(lower)!.push(node);
      }
    }

    // 提取中文 ngram（2-4 字）
    const chineseSegments = label.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const seg of chineseSegments) {
      for (let n = 2; n <= Math.min(4, seg.length); n++) {
        for (let i = 0; i <= seg.length - n; i++) {
          const gram = seg.substring(i, i + n);
          if (STOP_WORDS.has(gram)) continue;
          if (!seen.has(gram)) {
            seen.add(gram);
            if (!freqMap.has(gram)) freqMap.set(gram, []);
            freqMap.get(gram)!.push(node);
          }
        }
      }
    }
  }

  // 筛选出现 ≥3 个节点的聚类
  for (const [keyword, groupNodes] of freqMap) {
    if (groupNodes.length >= 3) {
      insights.push({
        id: `cluster_${keyword}`,
        type: 'cluster',
        involvedNodes: groupNodes.map(n => n.id),
        title: `主题聚类: ${keyword}`,
        description: `发现 ${groupNodes.length} 篇涉及「${keyword}」主题的文献。` +
          `这些文献可能代表一个重要的研究方向。`,
        confidence: 0.65,
        severity: 'low',
        suggestedAction: `评估此方向是否值得深入探索`,
        generatedAt: Date.now(),
      });
    }
  }

  // 按涉及节点数量降序，限制输出
  return insights
    .sort((a, b) => b.involvedNodes.length - a.involvedNodes.length)
    .slice(0, 5);
}

// ─── 主入口：综合推理 ─────────────────────────────────────────────

export function generateGraphInsights(
  nodes: GraphNode[],
  edges: GraphEdge[]
): GraphInsight[] {
  if (nodes.length < 3) return []; // 图谱太小，无法推理

  const allInsights: GraphInsight[] = [
    ...detectContradictions(nodes, edges),
    ...detectGaps(nodes, edges),
    ...detectRisks(nodes, edges),
    ...detectOpportunities(nodes, edges),
    ...detectClusters(nodes),
  ];

  // 按严重程度排序：high > medium > low
  const severityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  allInsights.sort((a, b) => {
    const sa = severityOrder[a.severity || 'low'] || 0;
    const sb = severityOrder[b.severity || 'low'] || 0;
    return sb - sa;
  });

  return allInsights;
}

// ─── 洞察类型的显示配置 ───────────────────────────────────────────

export const INSIGHT_CONFIG: Record<string, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  contradiction: {
    icon: 'fa-solid fa-triangle-exclamation',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.08)',
    borderColor: 'rgba(249, 115, 22, 0.25)',
  },
  gap: {
    icon: 'fa-solid fa-circle-exclamation',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  opportunity: {
    icon: 'fa-solid fa-lightbulb',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  risk: {
    icon: 'fa-solid fa-shield-halved',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.08)',
    borderColor: 'rgba(234, 179, 8, 0.25)',
  },
  cluster: {
    icon: 'fa-solid fa-diagram-project',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.08)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
};
