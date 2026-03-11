
import { Type } from "@google/genai";
import { ExperimentLog, ResearchProject, PlanType, UserProfile, WeeklyTask, ProjectPlan, MatrixParameter, DoeSession } from "../../types";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";

/**
 * AI 从截图或文本输入生成里程碑节点
 * @param imageBase64 - 可选，截图的 base64 数据（不含前缀）
 * @param imageMimeType - 可选，图片 MIME 类型
 * @param textPrompt - 可选，额外的文字描述
 * @param projectContext - 可选，当前项目上下文
 */
export const generateMilestonesFromImageAI = async (
    imageBase64?: string,
    imageMimeType: string = 'image/png',
    textPrompt?: string,
    projectContext?: { title: string; description: string }
) => {
    return callGeminiWithRetry(async (ai) => {
        const contextStr = projectContext
            ? `课题标题: ${projectContext.title}\n课题描述: ${projectContext.description.substring(0, 800)}`
            : '';
        const textDesc = textPrompt?.trim() ? `\n\n用户补充描述: ${textPrompt.trim()}` : '';

        const prompt = `你是一名资深的科研规划专家。请根据以下输入（可能包含实验流程截图、手绘拓扑图、文字描述等），分析并规划一套完整的科研研究节点（里程碑）。

${contextStr}${textDesc}

要求：
1. 规划 4-7 个关键研究节点。
2. 如果输入是图片，请识别其中的实验步骤、阶段划分、节点关系等信息并据此生成节点。
3. 每个节点必须包含：标题(title)、科学假设(hypothesis)、预计完成日期(dueDate, 格式 YYYY-MM-DD，从今天起合理规划)。
4. 节点逻辑应具有严密的科学演进性。
5. 提供一段整体的研究逻辑框架解读(frameworkRationale)。

输出格式必须为严格的 JSON：
{
  "milestones": [
    { "title": "节点名称", "hypothesis": "科学假设说明", "dueDate": "2026-06-01" }
  ],
  "frameworkRationale": "研究逻辑深度解读..."
}`;

        const contents: any[] = [];
        if (imageBase64) {
            contents.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
        }
        contents.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        const text = response.text || '{"milestones":[], "frameworkRationale":""}';
        try {
            return JSON.parse(extractJson(text));
        } catch (e) {
            console.error("Failed to parse AI milestones from image output:", text);
            return { milestones: [], frameworkRationale: "AI 生成内容解析失败" };
        }
    });
};

/**
 * AI 自动生成里程碑
 */
export const generateMilestonesAI = async (project: ResearchProject) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深的科研规划专家。请根据以下课题信息，规划一套完整的科研研究节点（里程碑）。

课题标题: ${project.title}
课题描述: ${project.description.substring(0, 1500)}

要求：
1. 规划 4-7 个关键研究节点。
2. 每个节点必须包含：标题(title)、科学假设(hypothesis)、预计完成日期(dueDate, 格式 YYYY-MM-DD)。
3. 节点逻辑应具有严密的科学演进性。
4. 提供一段整体的研究逻辑框架解读(frameworkRationale)。

输出格式必须为严格的 JSON：
{
  "milestones": [
    { "title": "节点名称", "hypothesis": "科学假设说明", "dueDate": "2026-06-01" }
  ],
  "frameworkRationale": "研究逻辑深度解读..."
}`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        const text = response.text || '{"milestones":[], "frameworkRationale":""}';
        try {
            return JSON.parse(extractJson(text));
        } catch (e) {
            console.error("Failed to parse AI milestones output:", text);
            return { milestones: [], frameworkRationale: "AI 生成内容解析失败" };
        }
    });
};

/**
 * 生成周期计划
 * 优化点：仅选择最近 10 条日志作为背景
 */
export const generateProjectPlanAI = async (project: ResearchProject, type: PlanType = 'weekly') => {
    return callGeminiWithRetry(async (ai) => {
        const logs = project.milestones.flatMap(m => m.logs).slice(-10);
        const context = `课题: ${project.title}. 最近进展: ${JSON.stringify(logs.map(l => ({ 内容: l.content, 结果: l.result })))}`;
        const prompt = `规划【${type}】任务。输出 JSON {goals: [], tasks: [{title}]}。背景: ${context}`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"goals":[], "tasks":[]}'));
    });
};

/**
 * 任务指派
 * 优化点：对任务和成员列表进行关键信息提取，不传递多余属性
 */
export const assignTasksAI = async (project: ResearchProject, tasksWithContext: any[], teamMembers: UserProfile[], todayIdx: number = -1) => {
    return callGeminiWithRetry(async (ai) => {
        const teamSummary = teamMembers.map(m => ({ name: m.name, role: m.role, exp: m.expertise, load: m.workload }));
        const taskSummary = tasksWithContext.map(t => ({ id: t.taskId, title: t.title }));

        const prompt = `指派任务排期。任务: ${JSON.stringify(taskSummary)}。团队: ${JSON.stringify(teamSummary)}。
        输出 JSON {assignments: [{taskId, assignedDay, assignedTo: [], assignmentReason}]}。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"assignments":[]}'));
    });
};

// Fix: Add generateDOEMatrix export
/**
 * Generate a DOE Matrix based on notes and factors
 */
export const generateDOEMatrix = async (notes: string, factors: MatrixParameter[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深实验设计专家。请根据以下笔记和因子生成一个正交实验矩阵。
        
        笔记: "${notes}"
        现有因子: ${JSON.stringify(factors)}
        
        要求输出 JSON:
        {
          "matrix": [{"name": "因子名", "target": "单位", "range": "取值范围"}],
          "runs": [{"idx": 1, "params": {"因子名": "具体值"}}],
          "title": "矩阵标题",
          "scientificValidation": "安全与科学性评估预警"
        }`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

// Fix: Add parseProjectProposal export
/**
 * Parse a project proposal document (PDF/Docx) or raw text
 */
export const parseProjectProposal = async (base64DataOrText: string, mimeType: string, isText: boolean = false) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深科研管理专家。请深度解析这份项目计划书。
        要求提取：
        1. 建议标题 (suggestedTitle)
        2. 详细描述 (suggestedDescription)
        3. 考核指标 (targetMetrics: [{label, value, unit, weight, isHigherBetter}])
        4. 所需物资 (requiredMaterials: [{name, estimatedAmount}])
        5. 团队人员 (personnel: [{name, role, researchArea, expertise}])
        6. 主工艺路线 (masterRoute: {title, steps: [{step, action}], hypothesis})
        7. 参考文献列表 (bibliography: [{title, authors, year, source, url, abstract, category}])
        8. 研究里程碑/实验节点 (milestones: [{title, hypothesis, dueDate}]) —— 请依据计划书进度建议 3-5 个核心节点
        
        输出 JSON。`;

        const contents: any[] = [];
        if (isText) {
            contents.push({ text: `项目计划书内容如下：\n\n${base64DataOrText}` });
        } else {
            contents.push({ inlineData: { mimeType, data: base64DataOrText } });
        }
        contents.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

// Fix: Add suggestDOENextStep export
/**
 * Suggest next step for DOE session based on history
 */
export const suggestDOENextStep = async (session: DoeSession) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深实验推演专家。基于当前的 DOE 历史数据，预测并建议下一步实验。
        
        描述: ${session.processDescription}
        历史数据: ${JSON.stringify(session.history)}
        
        要求输出 JSON 包含 recommendations (数组，含 label, params, expectedOutcome, confidenceScore, predictedValue, ciLower, ciUpper) 和 reasoning (字符串)。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
