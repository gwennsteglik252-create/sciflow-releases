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
 * 分析科学机理 —— 混合架构 v2.0
 * 
 * 优先级：
 *   1. 本地 CHE 引擎计算 energySteps（确定性物理模型）
 *   2. AI 生成 analysisResult / stabilityPrediction / descriptors（报告+评估）
 *   3. 若本地无数据 → 回退纯 AI 估算（标记 dataSource: 'ai-estimated'）
 */
export const analyzeMechanism = async (session: MechanismSession) => {
    // ── Step 1: 尝试本地 CHE 计算 ──
    const { computeLocalEnergySteps } = await import('../../../components/Mechanism/computeEnergySteps');

    const cheResult = computeLocalEnergySteps({
        material: session.material,
        reactionMode: session.reactionMode as any,
        dopingElement: session.dopingElement,
        dopingConcentration: session.dopingConcentration,
        coDopingElement: session.coDopingElement || undefined,
        coDopingConcentration: session.coDopingConcentration || undefined,
    });

    const hasLocalData = cheResult !== null;

    return callGeminiWithRetry(async (ai) => {
        const isOER = session.reactionMode === 'OER' || session.reactionMode === 'ORR' || session.reactionMode === 'BIFUNCTIONAL';
        const coDoping = session.coDopingElement && session.coDopingElement !== 'None'
            ? ` + ${session.coDopingElement} (${session.coDopingConcentration || 0}%)` : '';

        const context = `
            材料: ${session.material}
            反应模式: ${session.reactionMode}
            pH: ${session.pH}
            电位: ${session.potential}V
            晶胞类型: ${session.unitCellType}
            主掺杂: ${session.dopingElement} (${session.dopingConcentration}%)${coDoping}
            质量负载: ${session.massLoading} mg/cm²
        `.trim();

        let prompt: string;

        if (hasLocalData) {
            // ── 本地 CHE 有数据: AI 仅负责分析报告和稳定性评估 ──
            const cheData = cheResult!;
            prompt = `你是一位严谨的电化学机理分析专家。以下为基于 DFT/CHE 模型的确定性计算结果，请据此生成深度分析。

催化剂参数：
${context}

DFT/CHE 计算结果（已通过本地物理引擎验证）：
- 自由能台阶: [${cheData.energySteps.map(v => v.toFixed(3)).join(', ')}] eV
- 速率决定步骤: ${cheData.rdsLabel} (ΔG_max = ${cheData.maxDeltaG.toFixed(3)} eV)
- 理论过电位 η: ${cheData.eta.toFixed(3)} V
- Tafel 斜率: ${cheData.tafelSlope} mV/dec
- 交换电流密度: ${cheData.exchangeCurrentDensity} A/cm²
- 数据来源: ${cheData.sourceRef}
- 不确定度: ±${cheData.uncertainty} eV

请严格按以下 JSON Schema 输出：

{
  "stabilityPrediction": {
    "safetyIndex": number (0-10, 基于 Pourbaix 热力学评估),
    "status": "Excellent|Good|Fair|Poor|Critical",
    "desc": "简要热力学稳定性描述（考虑 pH=${session.pH} 及电位=${session.potential}V 对 ${session.material} 的影响）",
    "thermodynamicRisk": "如有风险则描述，无风险则为 null"
  },
  "analysisResult": "详细 Markdown 格式分析报告（含反应路径、RDS 机理解释、掺杂效应分析、传质讨论、文献对比，≥500字）",
  "pathway": "反应路径描述",
  "bottleneck": "动力学瓶颈描述"
}

要求：
- 分析报告必须引用上述 CHE 计算的具体数值
- 严禁使用 LaTeX 语法，化学式用 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）`;

        } else {
            // ── 无本地数据: 回退纯 AI 估算（保留原有逻辑）──
            const stepsHint = isOER ? '5个能级台阶 (S0→S1→S2→S3→S4)' : '3个能级台阶 (S0→S1→S2)';
            const totalConstraint = isOER ? 'ΣΔG = S4 - S0 ≈ 4.92 eV' : 'ΣΔG = S2 - S0 ≈ 0.00 eV';

            prompt = `你是一台高精度电化学仿真引擎。请基于以下催化剂参数执行深度解算：

${context}

严格按以下 JSON Schema 输出（不得遗漏字段）：

{
  "physicalConstants": {
    "energySteps": [${isOER ? 'S0, S1, S2, S3, S4' : 'S0, S1, S2'}],
    "tafelSlope": number (mV/dec),
    "exchangeCurrentDensity": "数值 (A/cm²格式)",
    "eta10": number (V, 理论过电位),
    "activationEnergy": number (kJ/mol)
  },
  "stabilityPrediction": {
    "safetyIndex": number (0-10, 基于 Pourbaix 热力学评估),
    "status": "Excellent|Good|Fair|Poor|Critical",
    "desc": "简要热力学稳定性描述（考虑 pH=${session.pH} 及电位=${session.potential}V 对 ${session.material} 的影响）",
    "thermodynamicRisk": "如有风险则描述，无风险则为 null"
  },
  "analysisResult": "详细 Markdown 格式分析报告（含反应路径、RDS、掺杂效应、传质分析，≥500字）",
  "descriptors": { "adsOH": number, "adsH": number },
  "pathway": "反应路径描述",
  "bottleneck": "动力学瓶颈描述"
}

物理约束：
- energySteps 必须提供${stepsHint}的自由能值 (eV)
- 热力学守恒: ${totalConstraint}
- eta10 以伏特 (V) 为单位，不是 mV
- stabilityPrediction.safetyIndex 需基于材料在 Pourbaix 图中的热力学区域评估
- analysisResult 严禁使用 LaTeX 语法，化学式用 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）`;
        }

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 4096, responseMimeType: "application/json" }
        });
        const aiResult = JSON.parse(extractJson(response.text || '{}'));

        // ── 合并本地 CHE 数据与 AI 报告 ──
        if (hasLocalData) {
            const cheData = cheResult!;
            const desc = (await import('../../../services/gemini/analysis/audit')).TheoreticalDescriptors;
            const matDesc = (desc as any)[session.material];

            return {
                physicalConstants: {
                    energySteps: cheData.energySteps,
                    tafelSlope: cheData.tafelSlope,
                    exchangeCurrentDensity: cheData.exchangeCurrentDensity,
                    eta10: cheData.eta10,
                    activationEnergy: cheData.activationEnergy,
                    dataSource: cheData.dataSource,
                    sourceRef: cheData.sourceRef,
                    uncertainty: cheData.uncertainty,
                },
                stabilityPrediction: aiResult.stabilityPrediction || null,
                analysisResult: aiResult.analysisResult || '',
                descriptors: {
                    adsOH: matDesc?.adsOH || 0,
                    adsH: matDesc?.adsH || 0,
                },
                pathway: aiResult.pathway || cheData.rdsLabel,
                bottleneck: aiResult.bottleneck || '',
            };
        }

        // AI 回退模式：标记数据来源
        if (aiResult.physicalConstants) {
            aiResult.physicalConstants.dataSource = 'ai-estimated';
            aiResult.physicalConstants.sourceRef = 'AI-Gemini-Pro';
            aiResult.physicalConstants.uncertainty = 0.15;
        }
        return aiResult;
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

/**
 * AI 机理辩论 —— 模拟多学科专家审视推演结果
 * 三位虚拟专家从各自学科角度对机理推演结论进行质疑和论证
 */
export const runMechanismDebate = async (context: {
    material: string;
    reactionMode: string;
    pH: number;
    potential: number;
    dopingElement: string;
    dopingConcentration: number;
    physicalConstants: any;
    stabilityPrediction: any;
    analysisResult: string;
    currentRound: number;
    previousDebate?: string;
}) => {
    return callGeminiWithRetry(async (ai) => {
        const isFirstRound = context.currentRound <= 1;
        const previousContext = context.previousDebate
            ? `\n\n上一轮辩论内容摘要：\n${context.previousDebate.substring(0, 3000)}`
            : '';

        const physicsStr = context.physicalConstants
            ? `\n物理常数：\n- Tafel 斜率: ${context.physicalConstants.tafelSlope} mV/dec\n- 交换电流密度: ${context.physicalConstants.exchangeCurrentDensity}\n- 过电位 η10: ${context.physicalConstants.eta10} V\n- 能垒台阶: [${(context.physicalConstants.energySteps || []).map((v: number) => v?.toFixed?.(3) || v).join(', ')}] eV\n- 数据来源: ${context.physicalConstants.dataSource || 'AI'}`
            : '';

        const stabilityStr = context.stabilityPrediction
            ? `\n稳定性预测：\n- 安全指数: ${context.stabilityPrediction.safetyIndex}/10 (${context.stabilityPrediction.status})\n- 描述: ${context.stabilityPrediction.desc || 'N/A'}`
            : '';

        const prompt = `你是一个多专家学术辩论模拟器。请模拟三位不同领域的资深专家，对以下电化学催化剂机理推演结果进行第 ${context.currentRound} 轮${isFirstRound ? '初始' : '深入'}辩论。

催化剂系统：
- 材料: ${context.material}
- 反应模式: ${context.reactionMode}
- pH: ${context.pH}
- 电位: ${context.potential} V
- 掺杂: ${context.dopingElement} (${context.dopingConcentration}%)
${physicsStr}
${stabilityStr}

AI 分析报告摘要：
${(context.analysisResult || '').substring(0, 2000)}
${previousContext}

请严格按以下 JSON Schema 输出：
{
  "entries": [
    {
      "expertId": "electrochemist",
      "content": "（电化学家 Dr. ElectroChem 的观点）从电化学动力学角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：引用具体 Tafel 斜率/过电位数值，讨论 Butler-Volmer 方程的适用性，分析电荷转移系数的物理含义。使用 Markdown 格式，≥200字。"
    },
    {
      "expertId": "materialist",
      "content": "（材料学家 Dr. Materials 的观点）从材料科学角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：讨论掺杂元素对晶体结构的影响、活性位点暴露、形貌调控策略，以及与文献报道的对比。使用 Markdown 格式，≥200字。"
    },
    {
      "expertId": "theorist",
      "content": "（理论化学家 Dr. Theory 的观点）从 DFT/理论计算角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：讨论能垒台阶的合理性、d-band center 理论、Sabatier 原理预测、计算精度不确定度。使用 Markdown 格式，≥200字。"
    }
  ],
  "conclusion": ${isFirstRound ? 'null' : '"三位专家经过辩论后的初步共识（200字左右），包含共同认可的关键发现和仍存分歧的方面"'}
}

要求：
- 各专家必须有明确不同甚至对立的观点，不能一团和气
- 引用具体的数值和化学式进行论证
- 严禁使用 LaTeX 语法，化学式用 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 8192, responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            entries: (parsed.entries || []).map((e: any) => ({
                expertId: e.expertId || 'electrochemist',
                content: e.content || '',
                round: context.currentRound,
            })),
            conclusion: parsed.conclusion || null,
        };
    });
};

/**
 * AI 实验方案辩论 —— 模拟多学科专家审视工艺路线
 * 三位虚拟专家从不同角度对实验方案进行质疑和论证
 */
export const runRouteDebate = async (context: {
    title: string;
    hypothesis: string;
    processChanges: string;
    flowchart: { step: string; action: string }[];
    controlParams: { key: string; value: string; reason: string }[];
    optimizedParams: { key: string; value: string; reason: string }[];
    feasibilityScore: number;
    currentRound: number;
    previousDebate?: string;
}) => {
    return callGeminiWithRetry(async (ai) => {
        const isFirstRound = context.currentRound <= 1;
        const previousContext = context.previousDebate
            ? `\n\n上一轮辩论内容摘要：\n${context.previousDebate.substring(0, 3000)}`
            : '';

        const stepsStr = context.flowchart
            .map((s, i) => `  ${i + 1}. ${s.step}: ${s.action}`)
            .join('\n');

        const paramsStr = [...context.controlParams, ...context.optimizedParams]
            .map(p => `  - ${p.key}: ${p.value} (${p.reason})`)
            .join('\n');

        const prompt = `你是一个多专家学术辩论模拟器。请模拟三位不同领域的资深专家，对以下实验方案进行第 ${context.currentRound} 轮${isFirstRound ? '初始' : '深入'}辩论。

实验方案信息：
- 方案名称: ${context.title}
- 可行性评分: ${context.feasibilityScore}/100
- 科学假设: ${context.hypothesis}
- 工艺变更: ${context.processChanges}

实验步骤：
${stepsStr || '(未定义)'}

关键参数：
${paramsStr || '(未定义)'}
${previousContext}

请严格按以下 JSON Schema 输出：
{
  "entries": [
    {
      "expertId": "designer",
      "content": "（实验设计师 Dr. ExperimentDesign 的观点）从工艺合理性角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：审查步骤是否完整连贯、操作描述是否可执行、是否遗漏关键步骤（如前处理/后处理/质检）、安全风险是否已被充分考虑。使用 Markdown 格式，≥200字。"
    },
    {
      "expertId": "statistician",
      "content": "（统计学家 Dr. Statistics 的观点）从实验设计与数据角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：评估控制变量是否合理、参数范围是否有统计依据、实验是否具备可重复性、是否需要平行实验或对照组、样本量是否充分。使用 Markdown 格式，≥200字。"
    },
    {
      "expertId": "domain_expert",
      "content": "（领域专家 Dr. DomainExpert 的观点）从科学原理角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：评估科学假设是否合理、反应机理是否成立、工艺路径是否有文献支撑、是否存在更优的替代方案、表征/检测手段是否充分。使用 Markdown 格式，≥200字。"
    }
  ],
  "conclusion": ${isFirstRound ? 'null' : '"三位专家经过辩论后的初步共识（200字左右），包含共同认可的关键发现和仍存分歧的方面"'}
}

要求：
- 各专家必须有明确不同甚至对立的观点，不能一团和气
- 引用具体的参数数值和工艺细节进行论证
- 严禁使用 LaTeX 语法，化学式用 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 8192, responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            entries: (parsed.entries || []).map((e: any) => ({
                expertId: e.expertId || 'designer',
                content: e.content || '',
                round: context.currentRound,
            })),
            conclusion: parsed.conclusion || null,
        };
    });
};

/**
 * AI 文献综述辩论 —— 模拟多学科专家审视文献
 * 三位虚拟专家从不同角度对文献的创新点、方法论和结论进行批判性审视
 */
export const runLiteratureDebate = async (context: {
    title: string;
    authors: string[];
    year: number;
    source: string;
    abstract: string;
    executiveSummary?: string;
    currentRound: number;
    previousDebate?: string;
}) => {
    return callGeminiWithRetry(async (ai) => {
        const isFirstRound = context.currentRound <= 1;
        const previousContext = context.previousDebate
            ? `\n\n上一轮辩论内容摘要：\n${context.previousDebate.substring(0, 3000)}`
            : '';

        const authorsStr = context.authors.length > 0
            ? context.authors.slice(0, 5).join(', ') + (context.authors.length > 5 ? ' et al.' : '')
            : 'Unknown';

        const prompt = `你是一个多专家学术辩论模拟器。请模拟三位不同角色的资深学术专家，对以下文献进行第 ${context.currentRound} 轮${isFirstRound ? '初始' : '深入'}批判性辩论。

文献信息：
- 标题: ${context.title}
- 作者: ${authorsStr}
- 发表年份: ${context.year}
- 期刊/来源: ${context.source}
- 摘要: ${context.abstract.substring(0, 2000)}
${context.executiveSummary ? `\nAI 深度研读摘要:\n${context.executiveSummary.substring(0, 1500)}` : ''}
${previousContext}

请严格按以下 JSON Schema 输出：
{
  "entries": [
    {
      "expertId": "reviewer",
      "content": "（严格审稿人 Reviewer #1 的观点）以顶级期刊审稿标准${isFirstRound ? '提出初始审查意见' : '回应前轮观点并深入质疑'}。要求：从实验设计严谨性、数据可靠性、对照实验完备性、统计分析正确性等角度审查，指出至少2个潜在问题或薄弱环节。对数据表述和结论推导提出质疑。使用 Markdown 格式，≥200字。"
    },
    {
      "expertId": "domain_expert",
      "content": "（领域专家 Dr. DomainExpert 的观点）作为该研究领域的资深学者${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：评判本文的创新性和领域贡献、与前沿工作的对比、实验结果的可信度和可重现性、是否推进了该领域的认知边界、潜在的应用前景和局限性。使用 Markdown 格式，≥200字。"
    },
    {
      "expertId": "methodologist",
      "content": "（方法论学家 Dr. Methodology 的观点）从研究方法论角度${isFirstRound ? '提出初始评估' : '回应前轮观点并深入分析'}。要求：评估研究设计是否合理、表征手段是否充分、数据处理方法是否得当、是否存在方法论偏差（如选择性报告、过度拟合等）、建议补充的实验或表征。使用 Markdown 格式，≥200字。"
    }
  ],
  "conclusion": ${isFirstRound ? 'null' : '"三位专家经过辩论后的初步共识（200字左右），包含共同认可的优势、关键不足和改进建议"'}
}

要求：
- 各专家必须有明确不同甚至对立的观点，不能一团和气
- 引用文献中的具体数据和观点进行论证
- 严禁使用 LaTeX 语法，化学式用 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 8192, responseMimeType: "application/json" }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            entries: (parsed.entries || []).map((e: any) => ({
                expertId: e.expertId || 'reviewer',
                content: e.content || '',
                round: context.currentRound,
            })),
            conclusion: parsed.conclusion || null,
        };
    });
};
