
import { Type } from "@google/genai";
import { ResearchProject, UserProfile } from "../../types";
import { callGeminiWithRetry, extractJson, PRO_MODEL, SPEED_CONFIG } from "./core";

/**
 * AI 智能组队推荐引擎
 */
export const recommendTeamSquad = async (project: ResearchProject, candidates: UserProfile[]) => {
    return callGeminiWithRetry(async (ai) => {
        const candidateData = candidates.map(c => ({
            id: c.id,
            name: c.name,
            role: c.role,
            expertise: c.expertise,
            workload: c.workload,
            metrics: c.expertiseMetrics
        }));

        const prompt = `你是一名资深科研人力资源专家。请为以下科研课题匹配最优的研究小队（Squad）。
        
        【课题上下文】：
        标题: ${project.title}
        描述: ${project.description}
        关键词: ${project.keywords.join(', ')}
        
        【候选人员池】：
        ${JSON.stringify(candidateData)}
        
        【任务指令】：
        1. 从人员池中挑选 3 名最适合该课题的成员。
        2. 考量维度：
           - 技能覆盖度（必须能覆盖课题的核心技术挑战）。
           - 负载平衡（负载超过 80% 的人员除非极其匹配否则应排除）。
           - 角色多样性（PI、实验员、分析员的组合）。
        3. 为每人计算一个 0-100 的 'matchScore'。
        4. 提供深刻的 'matchReason'。
        5. 识别团队整体对该课题的 'skillGap' (技能缺口)。

        要求：使用学术中文。输出 JSON 格式。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommendedIds: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    matchScore: { type: Type.NUMBER },
                                    matchReason: { type: Type.STRING }
                                }
                            } 
                        },
                        skillGap: { type: Type.STRING }
                    },
                    required: ["recommendedIds", "skillGap"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
