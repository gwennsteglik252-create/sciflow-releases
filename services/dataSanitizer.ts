/**
 * SciFlow Pro — 数据清洗层 (Data Sanitizer)
 *
 * 确保从任何来源（云端 Supabase / 本地 IndexedDB）加载的数据
 * 具有完整的嵌套结构，防止 undefined.forEach 等运行时崩溃。
 *
 * 使用场景：
 * - useCloudSync 从云端拉取项目后
 * - useAsyncStorage hydration 后
 */

import { ResearchProject, Milestone, ExperimentLog } from '../types';

// ─── 实验日志清洗 ─────────────────────────────────────────────
function sanitizeLog(log: any): ExperimentLog {
    return {
        ...log,
        files: log.files ?? [],
        parameterList: log.parameterList ?? [],
        chatHistory: log.chatHistory ?? [],
        consumedReagents: log.consumedReagents ?? [],
    };
}

// ─── 里程碑清洗 ───────────────────────────────────────────────
function sanitizeMilestone(m: any): Milestone {
    return {
        ...m,
        logs: (m.logs ?? []).map(sanitizeLog),
        chatHistory: m.chatHistory ?? [],
        experimentalPlan: m.experimentalPlan ?? [],
        savedDocuments: m.savedDocuments ?? [],
    };
}

// ─── 项目清洗（核心入口） ─────────────────────────────────────
export function sanitizeProject(p: any): ResearchProject {
    if (!p || typeof p !== 'object') {
        console.warn('[DataSanitizer] 收到无效项目数据，跳过清洗');
        return p;
    }

    return {
        ...p,
        // 必需的数组字段
        milestones: (p.milestones ?? []).map(sanitizeMilestone),
        members: p.members ?? [],
        keywords: p.keywords ?? [],
        // 可选但常用的数组字段
        proposals: p.proposals ?? [],
        weeklyPlans: p.weeklyPlans ?? [],
        weeklyReports: p.weeklyReports ?? [],
        media: p.media ?? [],
        paperSections: p.paperSections ?? [],
        citedLiteratureIds: p.citedLiteratureIds ?? [],
        latexSnippets: p.latexSnippets ?? [],
        tables: p.tables ?? [],
        publications: p.publications ?? [],
        matrices: p.matrices ?? [],
        writingSnapshots: p.writingSnapshots ?? [],
        sampleMatrix: p.sampleMatrix ?? [],
        savedReports: p.savedReports ?? [],
        personnel: p.personnel ?? [],
        targetMetrics: p.targetMetrics ?? [],
        requiredMaterials: p.requiredMaterials ?? [],
        customCategories: p.customCategories ?? [],
    };
}

// ─── 批量清洗 ─────────────────────────────────────────────────
export function sanitizeProjects(projects: any[]): ResearchProject[] {
    if (!Array.isArray(projects)) return [];
    return projects.map(sanitizeProject);
}
