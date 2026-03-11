
import { GraphNode, GraphEdge } from "../types";
import { analyzePatentRisk, generateTraceabilityReport } from "./gemini";

// --- Cost Calculation Logic ---

export const calculatePathCost = (targetNodeId: string, nodes: GraphNode[], edges: GraphEdge[]): { total: number, currency: string, breakdown: any[] } => {
  const visited = new Set<string>();
  let totalCost = 0;
  const breakdown: any[] = [];
  const baseCurrency = 'USD'; // Standardize to USD for aggregation

  const getConvertedCost = (value: number, unit: string) => {
    // Simple mock conversion rates
    if (unit === 'CNY') return value / 7.2;
    // Add other conversions if needed, e.g., EUR to USD
    return value;
  };

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const currentNode = nodes.find(n => n.id === currentId);
    if (!currentNode) return;

    // Aggregate Cost
    if (currentNode.type === 'Cost' && currentNode.costData) {
        const convertedValue = getConvertedCost(currentNode.costData.value, currentNode.costData.currency);
        totalCost += convertedValue;
        breakdown.push({ item: currentNode.label, cost: convertedValue, original: currentNode.costData });
    }

    // Find upstream nodes (sources of edges targeting current)
    const upstreamEdges = edges.filter(e => e.target === currentId);
    upstreamEdges.forEach(e => traverse(e.source));
  };

  traverse(targetNodeId);
  return { total: Number(totalCost.toFixed(2)), currency: baseCurrency, breakdown };
};

// --- Success Path Traceability ---

export const findUpstreamPath = (targetNodeId: string, edges: GraphEdge[]): Set<string> => {
    const pathNodes = new Set<string>();
    const queue = [targetNodeId];

    while (queue.length > 0) {
        const curr = queue.shift()!;
        if (!pathNodes.has(curr)) {
            pathNodes.add(curr);
            // Find inputs
            const inputs = edges.filter(e => e.target === curr).map(e => e.source);
            queue.push(...inputs);
        }
    }
    return pathNodes;
};

// --- Risk Analysis Wrapper ---

export const triggerNodeRiskAnalysis = async (node: GraphNode, edges: GraphEdge[], allNodes: GraphNode[]) => {
    // Collect context: upstream technologies and related project info
    const upstreamIds = findUpstreamPath(node.id, edges);
    const contextLabels = allNodes
        .filter(n => upstreamIds.has(n.id) && n.id !== node.id && (n.type === 'Literature' || n.type === 'TRL_Milestone' || n.type === 'Project'))
        .map(n => {
            if (n.type === 'Literature' && n.meta) return `文献: ${n.meta.title} (作者: ${n.meta.authors.join(', ')})`;
            if (n.type === 'TRL_Milestone' && n.meta) return `里程碑: ${n.label} (假设: ${n.meta.hypothesis})`;
            if (n.type === 'Project' && n.meta) return `课题: ${n.label} (描述: ${n.meta.description})`;
            return n.label;
        })
        .join('; ');
    
    // Call the AI service with rich context
    try {
        return await analyzePatentRisk(node.label, `相关上下文: ${contextLabels}. 专利详细信息: ${JSON.stringify(node.patentData || {})}`);
    } catch (error) {
        console.error("AI Patent Risk Analysis Failed:", error);
        // Return a default/error structure
        return {
            riskLevel: "High",
            similarPatent: "AI 服务异常，无法检索到类似专利。",
            advice: "请手动进行专利检索并谨慎评估。",
            blockageDesc: "AI 服务暂时无法提供详细风险说明。"
        };
    }
};

// --- Report Generation Wrapper ---

export const exportPathReport = async (pathIds: Set<string>, nodes: GraphNode[]) => {
    const activeNodes = nodes.filter(n => pathIds.has(n.id));
    // Provide more detailed context to the AI for report generation
    const detailedNodes = activeNodes.map(n => ({
        id: n.id,
        label: n.label,
        type: n.type,
        status: n.status,
        trlLevel: n.trlLevel,
        evidenceWeight: n.evidenceWeight,
        meta: n.meta, // Pass full meta for rich AI context
        patentData: n.patentData,
        charData: n.charData,
        costData: n.costData
    }));
    
    try {
        return await generateTraceabilityReport(detailedNodes);
    } catch (error) {
        console.error("AI Traceability Report Generation Failed:", error);
        return "报告生成失败：AI 服务异常或数据格式不正确。";
    }
};
