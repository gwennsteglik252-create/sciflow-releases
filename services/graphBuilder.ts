/**
 * Graph Builder — 项目知识图谱构建引擎
 * 
 * 纯函数，将项目数据转换为图谱节点和边。
 * 从 ResearchBrain.tsx 中抽离，支持复用和单元测试。
 */

import { GraphNode, GraphEdge } from '../types';

interface ProjectLike {
    id: string;
    title: string;
    description?: string;
    milestones: {
        id: string;
        title: string;
        status?: string;
        hypothesis?: string;
        dueDate?: string;
        logs: {
            id: string;
            content: string;
            description?: string;
            summaryInsight?: string;
            timestamp?: string;
            status?: string;
        }[];
        experimentalPlan?: any[];
    }[];
}

interface ResourceLike {
    id: string;
    title: string;
    source?: string;
    year?: number;
    authors?: string[];
    projectId?: string;
}

/**
 * 构建项目知识图谱
 * 将项目、里程碑、实验记录和文献转换为图谱节点和边
 */
export function buildProjectGraph(
    project: ProjectLike,
    resources: ResourceLike[]
): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodesList: GraphNode[] = [];
    const edgesList: GraphEdge[] = [];
    const projectNodeId = `proj_${project.id}`;

    // ── 项目节点 ──
    nodesList.push({
        id: projectNodeId,
        label: project.title.substring(0, 12) + '...',
        type: 'Project',
        x: 400, y: 300,
        status: 'active',
        meta: { description: project.description }
    });

    // ── 里程碑 + 实验记录节点 ──
    project.milestones.forEach((ms, i) => {
        const msId = `ms_${ms.id}`;
        nodesList.push({
            id: msId,
            label: ms.title,
            type: 'TRL_Milestone',
            x: 200 + (i * 180) % 400,
            y: 450 + Math.floor(i / 3) * 120,
            status: ms.status === 'completed' ? 'success' : 'active',
            meta: { hypothesis: ms.hypothesis, dueDate: ms.dueDate, realId: ms.id }
        });
        edgesList.push({ source: projectNodeId, target: msId, type: 'relates_to' });

        ms.logs.forEach((log, j) => {
            const logId = `log_${log.id}`;
            nodesList.push({
                id: logId,
                label: log.content.substring(0, 10),
                type: 'Characterization',
                x: (nodesList[nodesList.length - 1].x) + (j % 2 === 0 ? 60 : -60),
                y: (nodesList[nodesList.length - 1].y) + 80,
                charData: { linkedLogId: log.id, analysisText: log.summaryInsight || log.description },
                meta: { timestamp: log.timestamp, status: log.status, milestoneId: ms.id }
            });
            edgesList.push({ source: msId, target: logId, type: 'proves' });
        });
    });

    // ── 文献节点 ──
    const projectResources = resources.filter(r => r.projectId === project.id);
    projectResources.forEach((res, i) => {
        const litId = `lit_${res.id}`;
        nodesList.push({
            id: litId,
            label: res.title.substring(0, 15) + '...',
            type: 'Literature',
            x: 100 + (i * 150) % 600,
            y: 120 + Math.floor(i / 4) * 80,
            meta: { source: res.source, year: res.year, authors: res.authors?.join(', ') }
        });
        edgesList.push({ source: litId, target: projectNodeId, type: 'derived_from' });
    });

    return { nodes: nodesList, edges: edgesList };
}
