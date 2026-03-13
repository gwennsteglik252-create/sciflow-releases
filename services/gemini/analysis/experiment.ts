// ═══ SciFlow Pro — AI 分析: experiment ═══

import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "../core";
import { ExperimentLog, ResearchProject, SampleEntry, MechanismSession } from "../../../types";

/**
 * 诊断实验日志异常
 */
export const diagnoseExperimentLog = async (log: ExperimentLog, project: ResearchProject) => {
    return callGeminiWithRetry(async (ai) => {
        const kpiSection = log.scientificData
            ? `\n关键性能指标：${JSON.stringify(log.scientificData)}`
            : '';
        const paramSection = log.parameters ? `\n实验参数：${log.parameters}` : '';
        const descSection = log.description ? `\n实验描述：${log.description}` : '';

        const prompt = `你是一位严谨的实验科学审计专家。请对以下实验记录进行全面的科学审计。

项目：${project.title}
实验记录内容：${log.content}${descSection}${paramSection}${kpiSection}

请进行以下审计分析并输出 JSON：

{
  "isAnomaly": boolean,
  "status": "Verified" | "Anomaly" | "Warning",
  "insight": "详细的审计分析报告（Markdown 格式，至少 300 字）"
}

审计报告（insight 字段）必须包含以下内容：

## 1. 数据合理性审查
- 检查实验参数是否在合理范围内
- 检查性能指标数值是否存在异常偏差
- 与同类实验的典型值进行对比

## 2. 实验一致性分析
- 参数设置与预期目标是否匹配
- 描述中的操作与参数是否自洽
- 各指标之间是否存在逻辑矛盾

## 3. 潜在风险预警
- 识别可能影响数据可靠性的因素
- 检查是否存在系统性偏差
- 评估废弃率风险

## 4. 改进建议
- 针对发现的问题提出具体改进方案
- 建议追加的验证实验

要求：
- 使用严格的学术语言，中文输出
- 引用具体的数值进行分析
- isAnomaly: true 仅在发现严重异常时设置
- insight 必须是详细的 Markdown 文本，不少于 300 字
- 严禁使用 LaTeX 语法，化学式用 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 4096, responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            insight: parsed.insight || parsed.diagnosis || parsed.recommendation || '审计分析未能生成有效内容',
            isAnomaly: parsed.isAnomaly === true || String(parsed.status || '').toLowerCase().includes('anomal')
        };
    });
};

/**
 * 基于实验记录内容生成详细的科学机理分析
 * （区别于 analyzeMechanism —— 后者是机理引擎模块专用，需要完整 MechanismSession）
 */
export const analyzeLogMechanism = async (log: ExperimentLog, project: ResearchProject) => {
    return callGeminiWithRetry(async (ai) => {
        const kpiSection = log.scientificData
            ? `\n关键性能指标：${JSON.stringify(log.scientificData)}`
            : '';
        const paramSection = log.parameters ? `\n实验参数：${log.parameters}` : '';
        const descSection = log.description ? `\n实验描述：${log.description}` : '';

        const prompt = `你是一位资深科研机理分析专家。请基于以下实验记录，对该实验涉及的科学机理进行深入、详尽的分析。

项目：${project.title}
实验记录内容：${log.content}${descSection}${paramSection}${kpiSection}

请输出 **详细的中文 Markdown 格式分析报告**，内容必须包含以下方面：

## 1. 反应机理路径
- 完整的反应路径或工艺过程（用化学方程式/反应步骤清晰表达）
- 每一步的热力学/动力学特征

## 2. 关键中间体与活性位点
- 识别可能的中间产物/中间态
- 活性位点的结构-性能关系

## 3. 速率决定步骤（RDS）
- 指出可能的速率控制步骤及其科学依据
- 结合实验数据（如有）给出佐证

## 4. 传质与动力学瓶颈
- 分析可能存在的扩散限制、电荷转移阻力等瓶颈
- 量化估算（如适用）

## 5. 结构-性能关系
- 材料结构/组成如何影响性能
- 与文献报道的对比分析

## 6. 改进建议
- 基于机理分析提出 3-5 条具体的实验改进方向
- 每条建议附带科学依据

要求：
- 内容必须详实、专业，不少于 500 字
- 使用严格的学术语言
- 引用具体的数值和化学式
- **严禁使用任何 LaTeX 语法**（如 $、\\rightarrow、\\downarrow、^{} 等），化学式用纯文本 Unicode 表示（如 Ni²⁺、OH⁻、Fe₂O₃、→、↓）
- 直接输出 Markdown 文本，不要输出 JSON`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 4096 }
        });
        return response.text || '机理分析未能生成';
    });
};

/**
 * 分析科学机理
 */
export const analyzeMechanism = async (session: MechanismSession) => {
    return callGeminiWithRetry(async (ai) => {
        // 修正：从 session 中提取核心物理参数进行机理诊断
        const context = `
            材料: ${session.material}
            反应模式: ${session.reactionMode}
            pH: ${session.pH}
            电位: ${session.potential}V
            掺杂: ${session.dopingElement} (${session.dopingConcentration}%)
            质量负载: ${session.massLoading}
        `.trim();

        const prompt = `分析机理数据:
        \n${context}\n
        请基于以上仿真/实验参数，执行深度科学解析。
        输出 JSON { "tafelSlope", "exchangeCurrentDensity", "pathway", "bottleneck", "descriptors": { "adsOH", "adsH" } }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * AI 横向对比分析（方案矩阵）
 */
export const analyzeComparisonMatrix = async (simulations: any[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台高能级科研解算模拟器。
现有一组电化学催化剂设计方案的对比数据：
${JSON.stringify(simulations).substring(0, 6000)}

请执行以下深度分析：
1. **性能归因**：分析不同掺杂、负载和材料体系对 Tafel 斜率和交换电流密度的影响规律。
2. **瓶颈识别**：识别这些方案中共同面临的理论上限或传质瓶颈。
3. **选型建议**：根据性能数据推荐最优方案及其科学依据。

要求：使用高度专业的中文学术语言，以 Markdown 格式输出。严禁使用 LaTeX 语法（如 $、\\rightarrow、^{} 等），化学式用纯文本 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）。
`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 4096 }
        });
        return response.text;
    });
};

/**
 * Diagnose an outlier in DOE dataset
 */
export const diagnoseOutlierDeviation = async (runResponses: any, avgResponse: number, runFactors: any) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `诊断偏离数据。实测: ${JSON.stringify(runResponses)}。平均: ${avgResponse}。因子: ${JSON.stringify(runFactors)}
        输出 JSON { "diagnosis", "confidence", "explanation" }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 根据关联实验记录上下文生成动力学深度分析
 */
export const generateContextualKineticsReport = async (
    projectTitle: string,
    mode: string,
    metrics: Record<string, number | string>,
    logContext?: {
        content?: string;
        description?: string;
        parameters?: string;
        scientificData?: Record<string, number>;
        timestamp?: string;
    } | null
) => {
    return callGeminiWithRetry(async (ai) => {
        const modeUpper = String(mode || '').toUpperCase();
        const contextText = logContext
            ? `已关联实验记录：
- 时间：${logContext.timestamp || 'N/A'}
- 内容：${logContext.content || 'N/A'}
- 描述：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}
- 指标：${JSON.stringify(logContext.scientificData || {})}`
            : '未关联具体实验记录，仅基于本次动力学数据解读。';

        const modeInstructionMap: Record<string, string> = {
            LSV: `【LSV 专项】
- 重点指标：E1/2、Onset、Tafel slope、jL、质量活性。
- 机理重点：四电子/两电子路径倾向、传质与动力学耦合。
- 必须给出：当前性能相对“高活性 ORR 催化剂”的等级判断（优秀/良好/一般/偏弱）。`,
            OER: `【OER 专项】
- 重点指标：η@10、OER Onset、OER Tafel slope、质量活性。
- 机理重点：可能的控速步骤（M-OH 形成 / M-O 脱质子 / O-O 成键）及证据链。
- 必须给出：降低过电位的优先改进路径（导电性、活性位点、表面重构、传质）。`,
            CV: `【CV 专项】
- 重点指标：阳/阴极峰位与峰电流、ΔEp、|Ipa/Ipc|。
- 机理重点：可逆性、赝电容贡献、表界面反应特征。
- 必须给出：扫描速率与窗口设置是否合理，并给出下一轮扫描参数建议。`,
            EIS: `【EIS 专项】
- 重点指标：Rs、Rct、CPE、Warburg（如有）。
- 机理重点：电荷转移阻抗与扩散限制的主导关系。
- 必须给出：等效电路拟合可信度与潜在误差来源（接触电阻、频段覆盖、噪声）。`,
            RDE: `【RDE 专项】
- 重点指标：n、jk、K-L slope/intercept、K-L R²。
- 机理重点：电子转移路径与扩散控制区间判定。
- 必须给出：转速区间与线性区选择是否稳健，并给出补测建议。`,
            ECSA: `【ECSA 专项】
- 重点指标：Cdl、ECSA、粗糙度因子。
- 机理重点：活性位点暴露、界面润湿与真实可利用面积。
- 必须给出：ECSA 与性能指标（如电流密度/过电位）是否协同一致的判断。`
        };

        const modeSpecificInstruction = modeInstructionMap[modeUpper] || `【通用动力学模式】
- 请围绕当前模式（${modeUpper || 'UNKNOWN'}）进行机理-性能归因与改进建议。`;

        const prompt = `你是一位电化学动力学分析专家。请结合实验上下文与本次解算指标，输出可直接用于实验复盘的深度分析。

项目：${projectTitle}
模式：${modeUpper || mode}

${contextText}

本次动力学关键指标：
${JSON.stringify(metrics).substring(0, 4000)}

${modeSpecificInstruction}

输出要求（Markdown）：
1. 给出“核心结论（3点）”，每点必须引用具体数值。
2. 给出“机理解释”，指出可能的限速步骤或传输瓶颈。
3. 给出“与上下文一致性判断”，明确说明哪些结果与实验目标一致/冲突。
4. 给出“风险与不确定性”，至少 2 条（如 iR 补偿、拟合区间、扩散尾迹、噪声）。
5. 给出“下一步实验建议”，按优先级列 3 条可执行动作（包含建议参数范围）。

严格要求：严禁使用任何 LaTeX 语法（如 $、\\rightarrow、^{} 等），化学式用纯文本 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 4096 }
        });
        return response.text || '';
    });
};

export const analyzeSampleMatrix = async (projectTitle: string, entries: SampleEntry[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台高精度材料数据分析引擎。项目: ${projectTitle}
        分析实验矩阵数据: ${JSON.stringify(entries).substring(0, 6000)}
        请输出 JSON: { "correlationMatrix": [], "keyTrends": [], "outliers": [], "summary": "" }`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            correlationMatrix: parsed.correlationMatrix || [],
            keyTrends: parsed.keyTrends || [],
            outliers: parsed.outliers || [],
            summary: parsed.summary || "数据样本不足，无法生成趋势洞察。"
        };
    });
};
