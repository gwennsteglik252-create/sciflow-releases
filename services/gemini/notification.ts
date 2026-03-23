// ═══ SciFlow Pro — AI 周报与通知 AI 服务 ═══

import { callGeminiWithRetry, FAST_MODEL, SPEED_CONFIG } from "./core";

type Language = 'zh' | 'en';

interface WeeklyReportInput {
    projectTitle: string;
    milestones: { title: string; status: string; dueDate: string }[];
    recentLogs: { timestamp: string; description: string; result: string; sampleId?: string }[];
    inventoryAlerts: { name: string; quantity: number; threshold: number; unit: string }[];
    literatureCount: number;
    weekLabel: string;
}

/**
 * AI 自动生成实验周报
 */
export const generateWeeklyReport = async (
    input: WeeklyReportInput,
    lang: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const milestonesText = input.milestones.length > 0
            ? input.milestones.map(m => `- [${m.status}] ${m.title}（截止: ${m.dueDate}）`).join('\n')
            : '本周无里程碑变更';

        const logsText = input.recentLogs.length > 0
            ? input.recentLogs.map(l => `- ${l.timestamp}: ${l.description} → ${l.result}${l.sampleId ? ` [样品: ${l.sampleId}]` : ''}`).join('\n')
            : '本周无实验记录';

        const alertsText = input.inventoryAlerts.length > 0
            ? input.inventoryAlerts.map(a => `- ⚠️ ${a.name}: 剩余 ${a.quantity}${a.unit}（阈值: ${a.threshold}${a.unit}）`).join('\n')
            : '无库存预警';

        const prompt = `你是一位资深科研项目经理，请为项目「${input.projectTitle}」生成本周（${input.weekLabel}）的实验周报。

## 本周数据

### 里程碑状态
${milestonesText}

### 实验记录（${input.recentLogs.length} 条）
${logsText}

### 库存预警
${alertsText}

### 文献跟踪
本周新增 ${input.literatureCount} 篇相关文献

## 输出要求
请生成一份结构清晰的 Markdown 周报，包含：
1. **本周摘要**（1-2 句话概括本周进展）
2. **实验进展**（按里程碑组织，列出关键实验结果和发现）
3. **关键数据与发现**（提炼实验数据中的重要趋势或异常）
4. **问题与风险**（包括库存预警、延期里程碑等）
5. **下周计划建议**（基于当前进度 AI 推荐的下一步行动）

${lang === 'zh' ? '使用中文撰写，专业术语可保留英文' : '使用学术英文撰写'}
控制在 500-800 字`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });
        return response.text || '';
    });
};
