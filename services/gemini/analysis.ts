import { Type } from "@google/genai";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";
import { ExperimentLog, ResearchProject, SampleEntry, GraphNode, MechanismSession } from "../../types";

export const TheoreticalDescriptors = {
    'NiFe-LDH': { adsOH: 0.15, adsH: -0.2, category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Ni' },
    'NiCo2O4': { adsOH: 0.22, adsH: -0.15, category: 'Bifunctional', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Ni' },
    'ZIF-67 (MOF)': { adsOH: 0.32, adsH: -0.1, category: 'Bifunctional', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Co' },
    'MIL-101 (MOF)': { adsOH: 0.28, adsH: -0.12, category: 'Bifunctional', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Fe' },
    'MOF-74': { adsOH: 0.25, adsH: -0.2, category: 'OER', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Mg' },
    'Fe-N-C (SAC)': { adsOH: 0.08, adsH: 0.12, category: 'ORR', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'Fe' },
    'FeNC@NiFe-LDH (Heterostructure)': { adsOH: 0.15, adsH: -0.1, category: 'Bifunctional', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Ni' },
    'Pt/C': { adsOH: -0.1, adsH: 0.05, category: 'ORR', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Pt' },
    'RuO2': { adsOH: 0.08, adsH: -0.25, category: 'OER', defaultUnitCell: 'Rutile', primaryMetal: 'Ru' },
    'BSCF (Perovskite)': { adsOH: 0.14, adsH: -0.35, category: 'Bifunctional', defaultUnitCell: 'Perovskite', primaryMetal: 'Ba' },
    'Pd': { adsOH: 0.05, adsH: 0.1, category: 'Noble Metal', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Pd' },
    'FeCoNiMnCr (HEA)': { adsOH: 0.18, adsH: -0.05, category: 'Bifunctional', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'HEA' }
};

/**
 * 执行全栈视觉合规性审计
 * @param extraContext 额外上下文信息（分类树/桑基图等非项目级数据）
 */
export const runVisualComplianceAudit = async (project: ResearchProject, journal: string, scope: string, extraContext?: Record<string, any>) => {
    return callGeminiWithRetry(async (ai) => {
        const visualContext: Record<string, any> = {
            title: project.title,
            sections: project.paperSections?.map(s => ({ id: s.id, title: s.title, len: s.content.length }))
        };

        // 根据审计范围构建针对性 prompt
        let scopeDetail = '';
        if (scope === 'tree' && extraContext?.treeData) {
            const tree = extraContext.treeData;
            scopeDetail = `\n【分类树专项审计】\n分类树标题: ${tree.title}\n布局方向: ${tree.layout}\n层级结构摘要: ${JSON.stringify(summarizeTreeNodes(tree.rootNode), null, 0)}\n请重点检查：\n1. 分类逻辑完整性：层级划分是否合理，分类标准是否一致（MECE 原则）\n2. 标签规范：标签命名是否学术化、是否有拼写错误或歧义\n3. 排版合规：字体大小/颜色是否满足期刊图表标准，对比度是否充足\n4. 结构深度：层级深度是否合理（过深/过浅）\n5. 叶节点完整性：是否存在不均衡的分支或悬空节点`;
        } else if (scope === 'sankey' && extraContext?.sankeyData) {
            const sankey = extraContext.sankeyData;
            scopeDetail = `\n【桑基图专项审计】\n桑基图标题: ${sankey.title}\n节点数量: ${sankey.nodes?.length || 0}\n连线数量: ${sankey.links?.length || 0}\n节点列表: ${JSON.stringify((sankey.nodes || []).map((n: any) => ({ id: n.id, label: n.label })))}\n连线摘要: ${JSON.stringify((sankey.links || []).map((l: any) => ({ source: l.source, target: l.target, value: l.value })))}\n请重点检查：\n1. 数据一致性：流入总量是否等于流出总量（质量守恒检查）\n2. 节点合理性：是否存在孤立节点（无任何连线的节点）\n3. 数值精度：数值标签的单位和精度是否符合期刊规范\n4. 视觉规范：配色是否色盲友好，字体/字号是否合规\n5. 标签规范：节点和连线标签是否学术化、是否有歧义\n6. 连线逻辑：是否存在不合理的循环流或反向流`;
        }

        const prompt = `你是一台学术图表合规性审计机器人。
        当前正在处理项目《${project.title}》，目标期刊《${journal}》。
        
        审计范围: ${scope} ${scopeDetail}
        
        请进行严格的合规性扫描并输出 JSON:
        { "overallStatus": "pass" | "warning" | "error", "issues": [ { "id", "severity", "category", "description", "suggestion" } ], "summary" }`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

const summarizeTreeNodes = (node: any): any => {
    return {
        id: node.id,
        label: node.label,
        childrenCount: node.children?.length || 0,
        children: node.children?.map((c: any) => summarizeTreeNodes(c))
    };
};

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
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
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
            config: { ...SPEED_CONFIG }
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
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
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
${JSON.stringify(simulations)}

请执行以下深度分析：
1. **性能归因**：分析不同掺杂、负载和材料体系对 Tafel 斜率和交换电流密度的影响规律。
2. **瓶颈识别**：识别这些方案中共同面临的理论上限或传质瓶颈。
3. **选型建议**：根据性能数据推荐最优方案及其科学依据。

要求：使用高度专业的中文学术语言，以 Markdown 格式输出。严禁使用 LaTeX 语法（如 $、\\rightarrow、^{} 等），化学式用纯文本 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→）。
`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG }
        });
        return response.text;
    });
};

/**
 * 搜索全球趋势
 */
export const searchGlobalTrends = async (query: string, timeRange: string = '2weeks') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台全球行业动态探测引擎。正在搜索关键词: "${query}"，时间范围: ${timeRange}。
        请探测该领域相关的技术演进、政策调整、市场波动及竞争对手动作。
        
        输出必须是一个严格的 JSON 格式：
        {
          "items": [
            {
              "id": "随机字符串",
              "title": "动态标题",
              "category": "Technology" | "Market" | "Policy" | "Competitor",
              "content": "详细情报内容",
              "impactScore": 1-5,
              "source": "来源机构/网站名称",
              "url": "来源链接（如果有，没有则留空）",
              "timestamp": "YYYY-MM-DD"
            }
          ]
        }`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"items":[]}'));
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
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * Generate visual fixes for audit issues
 */
export const generateVisualFixes = async (project: ResearchProject, issues: any[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `提供视觉修复补丁。问题: ${JSON.stringify(issues)}。输出 JSON { "circularSummaryPatch", "optimizationSummary" }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * OCR and parse a lab notebook scan
 */
export const recognizeLabNotebook = async (base64Data: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `识别实验记录本。输出 JSON { "content", "description", "parameters", "scientificData" }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                { text: prompt }
            ],
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * AI 智能颗粒识别修正
 * 利用 Gemini Vision 识别图像中被算法遗漏或误识别的颗粒
 */
export const refineParticlesWithAI = async (base64Image: string, existingParticles: any[], materialContext: string = 'SEM Microscopy') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台高精度的科研显微镜图像分析 AI。
现有一张 ${materialContext} 图像，算法已经初步识别了一些颗粒（坐标已提供）。
请基于视觉信息执行以下任务：
1. **补全遗漏**：识别算法漏掉的高对比度颗粒。
2. **剔除误判**：识别并标记属于背景噪声或非颗粒物（如标尺、污渍）的错误识别项。
3. **精准回归**：对重叠颗粒进行分割。

算法已识别的数据（仅供参考）: ${JSON.stringify(existingParticles.map(p => ({ x: p.x, y: p.y, r: p.radius })))}

输出 JSON:
{
  "newParticles": [ { "x": number, "y": number, "r": number }, ... ],
  "toRemove": [ { "x": number, "y": number } ]
}`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [
                { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
                { text: prompt }
            ],
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 行业动态摘要识别与生成
 */
export const summarizeIndustryTrend = async (content: string, category?: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深的科技/商业情报分析师。
请针对以下动态内容生成一段 100-200 字的“内参摘要”：
[行业分类]: ${category || '未分类'}
[原文内容]: ${content}

要求：
1. **去粗取精**：概括核心事件及影响。
2. **专业视角**：强调该动态对相关行业的潜在颠覆性、机会或风险。
3. **分点陈述**：如适用，请分条列出关键点。
4. **简洁专业**：语言简练，适合高层查阅。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    });
};

/**
 * 结合上下文生成深度视觉分析报告
 */
export const generateContextualVisionReport = async (
    projectTitle: string,
    logContext: string,
    stats: string,
    mode: string
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深的材料表征分析专家。
现有一项课题《${projectTitle}》，其中一份实验记录的内容如下：
"""
${logContext}
"""

在该实验中，我们对样品进行了 ${mode} 图像分析，得到的硬性统计结果如下：
"""
${stats}
"""

请基于以上实验背景（上下文）和视觉统计数据，生成一份深度分析报告。
要求：
0. **模式强约束**：本次报告只能围绕「${mode}」输出结论。若上下文出现其他表征（如 SEM/TEM/XRD 混杂），仅可作为背景，不得把非本模式结果写成当前结论。
1. **科学关联**：联系实验内容解释视觉数据（例如：为什么粒径如此分布，是否符合工艺预期）。
2. **专业术语**：使用严谨的学术词汇（如分散度、形貌特征、工艺一致性等）。
3. **结论建议**：基于数据提供实验改进建议。
4. **格式规范**：以 Markdown 格式输出。
5. **严禁 LaTeX**：不得使用任何 LaTeX 语法（如 $、\\rightarrow、\\downarrow、^{} 等），化学式用纯文本 Unicode（如 Ni²⁺、OH⁻、Fe₂O₃、→、↓）。

输出：直接返回 Markdown 文本报告。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
            }
        });
        return response.text;
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
${JSON.stringify(metrics, null, 2)}

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
            config: { ...SPEED_CONFIG }
        });
        return response.text || '';
    });
};

/**
 * AI 自动提取 Prompt：基于上下文生成精准提示词
 */
export const handleAiExtractPrompt = async (context: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台科研提示词提取引擎。
上下文: ${context}
请提取 1-2 句核心科研描述，作为 AI 处理的种子提示词。只输出提取后的文本。`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    });
};

/**
 * AI 视觉元数据探测：识别图像中的物理尺度、单位、关键区域
 */
export const detectMetadata = async (imageBase64: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `识别科研图像的元数据。
输出 JSON: { "scaleBar": "100nm", "pixelRate": number, "unit": "nm", "confidence": number }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } },
                { text: prompt }
            ],
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * AI 视觉风格提取：识别并模仿论文插图风格
 */
export const extractChartStyleFromImage = async (imageBase64: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台高精度科研图表视觉逆向分析引擎。请仔细分析这张科研插图/图表的视觉风格，并提取以下所有特征。

输出严格 JSON，字段说明：
{
  "colors": ["#hex1", "#hex2", ...],   // 图表中使用的所有颜色（数据系列颜色），至少提取 3 个，按出现频率排序
  "chartType": "line" | "bar" | "scatter",  // 图表类型：折线图、柱状图、散点图
  "strokeWidth": number,               // 数据线条粗细（像素，通常 1-5）
  "pointShape": "circle" | "square" | "triangle" | "diamond",  // 数据点标记形状
  "fontFamily": "serif" | "sans-serif", // 字体风格：衬线体(Times等) 或 无衬线体(Arial/Helvetica等)
  "hasGrid": boolean,                  // 是否有网格线
  "title": "string",                   // OCR 识别的图表标题（如果有）
  "xLabel": "string",                  // OCR 识别的 X 轴标签（如果有）
  "yLabel": "string"                   // OCR 识别的 Y 轴标签（如果有）
}

要求：
1. 颜色必须是精确的 HEX 值，尽量还原原图色彩。
2. 如果图中没有标题或轴标签，对应字段留空字符串。
3. 如果无法判断某个属性，使用合理的默认值。`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } },
                { text: prompt }
            ],
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

export const analyzeSampleMatrix = async (projectTitle: string, entries: SampleEntry[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台高精度材料数据分析引擎。项目: ${projectTitle}
        分析实验矩阵数据: ${JSON.stringify(entries)}
        请输出 JSON: { "correlationMatrix": [], "keyTrends": [], "outliers": [], "summary": "" }`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
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
 * AI 检索标准 XRD 物相数据 — COD 优先 + AI 回退
 *
 * 策略：
 * 1. 先用 AI 将用户输入格式化为 Hill Notation 化学式
 * 2. 查询 COD（Crystallography Open Database）真实数据库
 * 3. COD 无结果时回退到 AI 生成（temperature=0 确保一致性）
 */
export const searchXrdPhases = async (query: string) => {
    // ═══ Step 1: 尝试 COD 真实数据库 ═══
    try {
        const { searchCOD } = await import('../cod');

        // 用 AI 快速格式化化学式为 Hill Notation（COD 要求）
        let hillFormula: string | undefined;
        try {
            const formatResult = await callGeminiWithRetry(async (ai) => {
                const resp = await ai.models.generateContent({
                    model: FAST_MODEL,
                    contents: `将以下材料名称/化学式转换为 Hill Notation 格式（碳优先，再氢，其余字母序，元素间用空格分隔）。
仅输出 Hill Notation 字符串，不要其他内容。如果无法识别，输出 "UNKNOWN"。

输入: "${query}"

示例:
- TiO2 → O2 Ti
- NaCl → Cl Na
- Fe2O3 → Fe2 O3
- 锐钛矿 → O2 Ti
- Anatase → O2 Ti`,
                    config: { temperature: 0, topK: 1, topP: 0.1 }
                });
                return (resp.text || '').trim();
            });
            if (formatResult && formatResult !== 'UNKNOWN' && formatResult.length < 50) {
                hillFormula = formatResult;
            }
        } catch (e) {
            console.warn('[XRD Search] Hill formula formatting failed, using text search only:', e);
        }

        const codResult = await searchCOD(query, hillFormula);

        if (codResult.phases && codResult.phases.length > 0) {
            console.log(`[XRD Search] COD returned ${codResult.phases.length} phases for "${query}"`);
            return codResult;
        }
    } catch (e) {
        console.warn('[XRD Search] COD search failed, falling back to AI:', e);
    }

    // ═══ Step 2: AI 回退（temperature=0 确保一致性）═══
    console.log(`[XRD Search] COD no results for "${query}", falling back to AI generation`);
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台全球化学与物理材料数据库索引引擎。
目标材料/化学式: "${query}"

请根据该关键词检索最匹配的国际标准 XRD 物相数据（如 PDF 卡片数据）。
注意：同一种材料可能存在不同的晶体结构（多晶型/Polymorphs，如 TiO2 的锐钛矿和金红石），请尽可能提供所有常见结构的卡片。

输出严格的 JSON 格式:
{
  "phases": [
    {
      "name": "物相名称 (需包含晶型，例如: TiO2 - Anatase)",
      "card": "卡片号 (例如: PDF#21-1272)",
      "crystalSystem": "晶系 (例如: Tetragonal)",
      "spaceGroup": "空间群 (例如: I41/amd)",
      "latticeParams": "晶格参数简述 (例如: a=3.785, c=9.514 Å)",
      "source": "AI",
      "peaks": [
        { "twoTheta": number, "intensity": number, "dSpacing": number, "hkl": "(101)" }
      ]
    }
  ]
}

要求：
1. 提供该材料常见的所有晶体结构（最多 5 个）。
2. 每个物相提供 5-8 个特征衍射峰，必须使用真实已知的标准数据。
3. 强度 (intensity) 范围为 1-100。
4. dSpacing 以 nm 为单位 (基于 Cu Kα, λ=0.15406 nm)。
5. hkl 为密勒指数，用括号表示 (例如: "(101)")。
6. source 字段固定填 "AI"。
7. 卡片号请使用真实存在的 PDF/JCPDS 卡片号。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { temperature: 0, topK: 1, topP: 0.1, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"phases":[]}'));
    });
};

/**
 * 根据实验记录上下文生成 XRD 深度分析与参考卡片建议
 */
export const generateContextualXrdAnalysis = async (
    projectTitle: string,
    logContext: {
        content: string;
        description?: string;
        parameters?: string;
        scientificData?: Record<string, number>;
    },
    xrdContext: {
        datasetName: string;
        peakSummary: Array<{ twoTheta: number; intensity: number; label?: string }>;
        matchedPhases?: string[];
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名材料表征专家，请基于实验记录上下文和 XRD 结果给出可执行分析。

项目：${projectTitle}

实验记录：
- 标题/内容：${logContext.content || 'N/A'}
- 说明：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}
- 关键指标：${JSON.stringify(logContext.scientificData || {})}

XRD 当前信息：
- 数据集：${xrdContext.datasetName}
- 峰摘要：${JSON.stringify(xrdContext.peakSummary || [])}
- 已匹配物相：${JSON.stringify(xrdContext.matchedPhases || [])}

请输出严格 JSON，字段含义如下：
- summary: 对当前样品物相状态的总判断（2-3 句）
- keyFindings: 3-5 条关键发现
- suggestedPhaseQueries: 3-5 个建议检索的物相关键词（用于继续搜 PDF 卡片）
- cardAdjustmentAdvice: 3-5 条“调卡片”建议（例如应关注的峰位窗口、可疑杂相、优先对比晶型）
- riskFlags: 2-4 条风险提醒（如峰重叠、择优取向、背景未扣净）
- nextActions: 2-4 条下一步实验建议（要具体，可执行）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestedPhaseQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
                        cardAdjustmentAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
                        riskFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        anomalousPeaks: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    twoTheta: { type: Type.NUMBER },
                                    diagnosis: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ['summary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            summary: parsed.summary || '',
            keyFindings: parsed.keyFindings || [],
            suggestedPhaseQueries: parsed.suggestedPhaseQueries || [],
            cardAdjustmentAdvice: parsed.cardAdjustmentAdvice || [],
            riskFlags: parsed.riskFlags || [],
            nextActions: parsed.nextActions || [],
            anomalousPeaks: parsed.anomalousPeaks || []
        };
    });
};

/**
 * 基于匹配卡片的 XRD 二次深度分析
 * 在用户匹配参考物相卡片后，结合实验峰数据+卡片数据+上下文进行更精准的分析
 */
export const generatePostMatchXrdAnalysis = async (
    projectTitle: string,
    logContext: {
        content: string;
        description?: string;
        parameters?: string;
    } | null,
    xrdContext: {
        datasetName: string;
        peaks: Array<{ twoTheta: number; intensity: number; d?: string; size?: string; label?: string }>;
    },
    matchedCards: Array<{
        groupName: string;
        phases: Array<{
            name: string;
            card: string;
            crystalSystem?: string;
            spaceGroup?: string;
            latticeParams?: string;
            peaks?: Array<{ twoTheta: number; intensity: number; hkl?: string }>;
        }>;
    }>
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深 XRD 物相分析专家。用户已完成初步分析并匹配了参考物相 PDF 卡片。
请基于实验峰位数据和已匹配卡片进行深度对比分析。**所有回复内容必须使用中文。**

项目：${projectTitle}

${logContext ? `实验记录上下文：
- 内容：${logContext.content || 'N/A'}
- 说明：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}` : '（未关联实验记录）'}

XRD 实验数据：
- 数据集：${xrdContext.datasetName}
- 检测峰（2θ, I%）：${JSON.stringify(xrdContext.peaks.map(p => ({ '2θ': p.twoTheta, I: p.intensity, d: p.d, size: p.size, label: p.label })))}

已匹配参考卡片：
${matchedCards.map(g => `[${g.groupName}]
${g.phases.map(p => `  - ${p.name} (${p.card}) ${p.crystalSystem || ''} ${p.spaceGroup || ''}
    晶格参数: ${p.latticeParams || 'N/A'}
    参考峰: ${JSON.stringify((p.peaks || []).slice(0, 6).map(pk => ({ '2θ': pk.twoTheta, I: pk.intensity, hkl: pk.hkl })))}`).join('\n')}`).join('\n')}

请执行以下分析并输出 JSON（所有文本字段必须使用中文）：

1. **matchSummary**: 总体匹配质量评估（2-3句中文，说明物相鉴定是否可靠）
2. **phaseComposition**: 定性/半定量物相组成分析 [{ phaseName, estimatedFraction, confidence, evidence }]（中文描述）
3. **peakShiftAnalysis**: 峰位偏移分析 [{ experimentalTheta, referenceTheta, referenceName, shiftDeg, possibleCause }]（possibleCause 用中文，只列出偏移>0.1°的峰）
4. **unmatchedPeaks**: 未被任何卡片归属的实验峰 [{ twoTheta, intensity, possibleOrigin }]（possibleOrigin 用中文）
5. **crystallographicInsights**: 晶体学深度洞察（择优取向、晶粒效应、微应变等，中文）[string]
6. **synthesisAssessment**: 合成质量评估（目标相纯度、副产物评估、工艺优化方向，中文）
7. **publicationSentence**: 可直接用于论文中 XRD 结果与讨论部分的 1-2 句中文学术表述
8. **nextExperiments**: 基于匹配结果推荐的后续表征实验（中文）[string]`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        matchSummary: { type: Type.STRING },
                        phaseComposition: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    phaseName: { type: Type.STRING },
                                    estimatedFraction: { type: Type.STRING },
                                    confidence: { type: Type.STRING },
                                    evidence: { type: Type.STRING },
                                }
                            }
                        },
                        peakShiftAnalysis: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    experimentalTheta: { type: Type.NUMBER },
                                    referenceTheta: { type: Type.NUMBER },
                                    referenceName: { type: Type.STRING },
                                    shiftDeg: { type: Type.NUMBER },
                                    possibleCause: { type: Type.STRING },
                                }
                            }
                        },
                        unmatchedPeaks: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    twoTheta: { type: Type.NUMBER },
                                    intensity: { type: Type.NUMBER },
                                    possibleOrigin: { type: Type.STRING },
                                }
                            }
                        },
                        crystallographicInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
                        synthesisAssessment: { type: Type.STRING },
                        publicationSentence: { type: Type.STRING },
                        nextExperiments: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['matchSummary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            matchSummary: parsed.matchSummary || '',
            phaseComposition: parsed.phaseComposition || [],
            peakShiftAnalysis: parsed.peakShiftAnalysis || [],
            unmatchedPeaks: parsed.unmatchedPeaks || [],
            crystallographicInsights: parsed.crystallographicInsights || [],
            synthesisAssessment: parsed.synthesisAssessment || '',
            publicationSentence: parsed.publicationSentence || '',
            nextExperiments: parsed.nextExperiments || [],
        };
    });
};

/**
 * 根据实验记录上下文生成 BET/BJH 深度分析
 */
export const generateContextualPorosityAnalysis = async (
    projectTitle: string,
    logContext: {
        content: string;
        description?: string;
        parameters?: string;
        scientificData?: Record<string, number>;
    },
    porosityContext: {
        sampleName: string;
        ssa: number;
        poreVolume: number;
        avgPoreSize: number;
        cConstant: number;
        r2: number;
        iupacType: string;
        hysteresisType: string;
        psdPeakNm?: number | null;
        fitRange: { min: number; max: number };
        bjhParams?: { thicknessModel: string; branchMode: string };
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名材料孔结构表征专家，请基于实验记录上下文和 BET/BJH 结果给出可执行分析。

项目：${projectTitle}

实验记录：
- 标题/内容：${logContext.content || 'N/A'}
- 说明：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}
- 关键指标：${JSON.stringify(logContext.scientificData || {})}

BET/BJH 当前信息：
- 样品：${porosityContext.sampleName}
- SSA：${porosityContext.ssa} m²/g
- 总孔容：${porosityContext.poreVolume} cm³/g
- 平均孔径：${porosityContext.avgPoreSize} nm
- C 常数：${porosityContext.cConstant}
- BET R²：${porosityContext.r2}
- IUPAC 类型：${porosityContext.iupacType}
- 回滞环类型：${porosityContext.hysteresisType}
- PSD 峰位：${porosityContext.psdPeakNm ?? 'N/A'} nm
- 拟合区间：${porosityContext.fitRange.min}-${porosityContext.fitRange.max}
- BJH 参数：${JSON.stringify(porosityContext.bjhParams || {})}

请输出严格 JSON：
- summary: 2-3 句总判断
- keyFindings: 3-5 条关键发现
- mechanismHints: 2-4 条机理关联线索（结合实验记录参数）
- riskFlags: 2-4 条风险提醒（如拟合区间偏置、孔径分布假峰、样品活化不足）
- nextActions: 2-4 条可执行建议（明确实验动作）
- publicationSentence: 1-2 句可直接用于论文结果讨论的表述`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanismHints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        riskFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        publicationSentence: { type: Type.STRING }
                    },
                    required: ['summary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            summary: parsed.summary || '',
            keyFindings: parsed.keyFindings || [],
            mechanismHints: parsed.mechanismHints || [],
            riskFlags: parsed.riskFlags || [],
            nextActions: parsed.nextActions || [],
            publicationSentence: parsed.publicationSentence || ''
        };
    });
};

/**
 * Phase 4.2: 生成发表级英文 XRD 图注
 */
export const generatePublicationCaption = async (
    context: {
        sampleName: string;
        peaks: Array<{ twoTheta: number; intensity: number; hkl?: string }>;
        matchedPhases: Array<{ name: string; card: string; crystalSystem?: string; spaceGroup?: string; latticeParams?: string }>;
        grainSize?: number;
        strain?: number;
        wavelength?: string;
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `You are an expert scientific writer. Generate a publication-quality figure caption for an XRD pattern.

Context:
- Sample: ${context.sampleName}
- Wavelength: ${context.wavelength || 'Cu Kα (λ=1.5406 Å)'}
- Number of peaks detected: ${context.peaks.length}
- Matched phases: ${JSON.stringify(context.matchedPhases.map(p => ({ name: p.name, card: p.card, crystal: p.crystalSystem, spaceGroup: p.spaceGroup, lattice: p.latticeParams })))}
${context.grainSize ? `- Average crystallite size (Scherrer/W-H): ${context.grainSize.toFixed(1)} nm` : ''}
${context.strain ? `- Microstrain (W-H): ${context.strain.toExponential(2)}` : ''}

Requirements:
1. Write in formal academic English suitable for a peer-reviewed journal.
2. Include the PDF card number(s), crystal system, space group, and lattice parameters if available.
3. Mention crystallite size and microstrain if provided.
4. Keep it to 2-3 sentences maximum.
5. Start with "Figure X." (leave X for the user to fill in).
6. Output ONLY the caption text, nothing else.`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || '';
    });
};

/**
 * 物相演变追踪：分析多条实验记录中的物相变化趋势
 * 适用于系列实验（如不同温度/时间/掺杂比的 XRD 对比）
 */
export const analyzePhaseEvolution = async (
    context: {
        projectTitle: string;
        /** 各实验节点的数据（按条件排列） */
        dataPoints: Array<{
            label: string;           // 实验条件标签 (如 "500°C / 2h")
            logContent?: string;     // 实验记录内容
            peaks: Array<{ twoTheta: number; intensity: number; label?: string }>;
            matchedPhases?: string[];
        }>;
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名材料物相分析专家。现有一组实验序列的 XRD 数据，请分析物相演变规律。

项目：${context.projectTitle}

实验序列（共 ${context.dataPoints.length} 个条件）：
${context.dataPoints.map((dp, i) => `
--- 条件 ${i + 1}: ${dp.label} ---
实验记录: ${dp.logContent?.slice(0, 200) || 'N/A'}
检测到的峰 (2θ, I): ${JSON.stringify(dp.peaks.slice(0, 8).map(p => ({ '2θ': p.twoTheta, I: p.intensity })))}
已匹配物相: ${JSON.stringify(dp.matchedPhases || [])}
`).join('\n')}

请输出严格的 JSON，含以下字段：
- evolutionSummary: 总体物相演变趋势（2-4 句）
- phaseTransitions: 检测到的物相转变事件列表 [{ fromPhase, toPhase, condition, evidence }]
- trendAnalysis: 各物相含量随条件变化的定性趋势 [{ phaseName, trend: "increasing"|"decreasing"|"stable"|"appears"|"disappears", notes }]
- criticalPoints: 关键转折点 [{ condition, event, significance }]
- recommendations: 基于演变规律的下一步建议 [string]`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        evolutionSummary: { type: Type.STRING },
                        phaseTransitions: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    fromPhase: { type: Type.STRING },
                                    toPhase: { type: Type.STRING },
                                    condition: { type: Type.STRING },
                                    evidence: { type: Type.STRING },
                                }
                            }
                        },
                        trendAnalysis: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    phaseName: { type: Type.STRING },
                                    trend: { type: Type.STRING },
                                    notes: { type: Type.STRING },
                                }
                            }
                        },
                        criticalPoints: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    condition: { type: Type.STRING },
                                    event: { type: Type.STRING },
                                    significance: { type: Type.STRING },
                                }
                            }
                        },
                        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['evolutionSummary']
                }
            }
        });

        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            evolutionSummary: parsed.evolutionSummary || '',
            phaseTransitions: parsed.phaseTransitions || [],
            trendAnalysis: parsed.trendAnalysis || [],
            criticalPoints: parsed.criticalPoints || [],
            recommendations: parsed.recommendations || [],
        };
    });
};

/**
 * 多数据组 XRD 综合对比分析
 * 关联各数据组的实验记录，结构化提取并对比实验参数差异，
 * 分析参数变化对物相组成、晶体结构的影响
 */
export const analyzeMultiDatasetXrd = async (
    projectTitle: string,
    datasets: Array<{
        datasetName: string;
        linkedLogTitle?: string;
        rawParameters?: Record<string, any> | string;
        content?: string;
        description?: string;
        peaks: Array<{ twoTheta: number; intensity: number; label?: string }>;
        matchedPhases?: string[];
    }>
) => {
    return callGeminiWithRetry(async (ai) => {
        // 构建参数差异矩阵
        const allParamKeys = new Set<string>();
        const paramMatrix: Array<Record<string, string>> = [];
        datasets.forEach(ds => {
            const params: Record<string, string> = {};
            if (ds.rawParameters && typeof ds.rawParameters === 'object') {
                Object.entries(ds.rawParameters).forEach(([k, v]) => {
                    if (v !== null && v !== undefined && v !== '') {
                        allParamKeys.add(k);
                        params[k] = String(v);
                    }
                });
            }
            paramMatrix.push(params);
        });

        // 找出在各组间有差异的参数
        const varyingParams: string[] = [];
        const constantParams: string[] = [];
        allParamKeys.forEach(key => {
            const values = paramMatrix.map(p => p[key] || '').filter(Boolean);
            const unique = new Set(values);
            if (unique.size > 1) {
                varyingParams.push(key);
            } else if (values.length > 0) {
                constantParams.push(key);
            }
        });

        const paramDiffSection = varyingParams.length > 0
            ? `\n【参数差异矩阵（以下参数在各组之间存在差异）】\n${varyingParams.map(key =>
                `- ${key}: ${datasets.map((ds, i) =>
                    `组${i + 1}(${ds.datasetName})=${paramMatrix[i][key] || 'N/A'}`
                ).join(' | ')}`
            ).join('\n')}\n\n${constantParams.length > 0 ? `【不变参数】\n${constantParams.map(key => `- ${key}: ${paramMatrix.find(p => p[key])?.[key] || ''}`).join('\n')}` : ''}`
            : '（未检测到结构化参数差异，请基于实验记录正文内容推断可能的差异）';

        const prompt = `你是一名材料结构-工艺参数关联分析专家。现有 ${datasets.length} 组 XRD 数据，它们来自同一课题的不同实验条件。
请分析各组之间的参数设定差异，以及这些差异如何影响 XRD 物相结果。

项目：${projectTitle}

${datasets.map((ds, i) => `
--- 数据组 ${i + 1}: ${ds.datasetName} ---
关联实验记录: ${ds.linkedLogTitle || '未关联'}
实验内容: ${(ds.content || '').slice(0, 300) || 'N/A'}
实验描述: ${(ds.description || '').slice(0, 200) || 'N/A'}
参数: ${ds.rawParameters ? (typeof ds.rawParameters === 'string' ? ds.rawParameters : JSON.stringify(ds.rawParameters)) : 'N/A'}
检测到的峰 (2θ, I): ${JSON.stringify(ds.peaks.slice(0, 8).map(p => ({ '2θ': p.twoTheta, I: p.intensity, label: p.label })))}
已匹配物相: ${JSON.stringify(ds.matchedPhases || [])}
`).join('\n')}

${paramDiffSection}

请执行以下分析并输出 JSON（所有文本必须使用中文）：

1. **comparativeSummary**: 跨组综合对比结论（3-5 句），必须明确指出关键参数变化与物相变化的对应关系
2. **parameterEffects**: 各关键参数变化对物相的影响 [{ parameter: 参数名, valueRange: 变化范围描述, observedEffect: 在XRD中的具体体现（峰位/峰强/新相出现等）, confidence: 高/中/低 }]
3. **keyDifferences**: 各组间最显著的 XRD 特征差异（3-5条），每条必须引用具体2θ值或物相名
4. **processingInsights**: 工艺参数与晶体结构的关联洞察（3-5条），联系材料科学原理
5. **recommendations**: 基于对比分析的下一步实验建议（2-4条），要具体可执行`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        comparativeSummary: { type: Type.STRING },
                        parameterEffects: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    parameter: { type: Type.STRING },
                                    valueRange: { type: Type.STRING },
                                    observedEffect: { type: Type.STRING },
                                    confidence: { type: Type.STRING },
                                }
                            }
                        },
                        keyDifferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                        processingInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
                        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['comparativeSummary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            comparativeSummary: parsed.comparativeSummary || '',
            parameterEffects: parsed.parameterEffects || [],
            keyDifferences: parsed.keyDifferences || [],
            processingInsights: parsed.processingInsights || [],
            recommendations: parsed.recommendations || [],
        };
    });
};

/**
 * 生成专业行业商业调研报告
 * 涵盖商业品技术细节、制备工艺、生产流程、成本结构、价格体系、市场数据
 */
export const generateIndustryResearchReport = async (params: {
    industry: string;
    region: string;
    timeRange: string;
    dimensions: string[];
    customContext?: string;
}) => {
    const { industry, region, timeRange, dimensions, customContext } = params;

    const dimensionGuides: Record<string, string> = {
        '市场规模与增速': `
## 一、市场规模与增速
- 全球/区域市场总规模（亿元人民币 / 亿美元），近年 CAGR
- 细分市场拆分（按产品形态 / 应用场景 / 地区）
- 市场渗透率现状与天花板预测
- 主要数据来源：机构报告名称（如 Grand View Research、中商产业研究院等）`,

        '核心商业品与技术规格': `
## 二、核心商业品与技术规格
- 列出 3-5 种主流商业产品/材料，每种需包含：
  - 产品名称（中英文）、CAS 号（如有）
  - 主要技术指标（纯度、颗粒度、比表面积、稳定性等）
  - 领先供应商（国内外各 2-3 家）
  - 市场主流规格与交付形式（包装、储运条件）`,

        '制备工艺与生产流程': `
## 三、制备工艺与生产流程
- 主流工业制备路线（至少 2-3 条），每条包含：
  - 工艺名称（如 CVD、水热法、共沉淀法等）
  - 关键步骤与温度/压力/气氛等核心参数
  - 原料来源与关键前驱体
  - 批次产能范围与设备要求
  - 良率与质量控制要点
- 技术成熟度（TRL 级别）与工业化进程（实验室 / 中试 / 量产）
- 工艺路线优缺点对比表`,

        '生产成本与价格分析': `
## 四、生产成本与价格分析
- 完整成本结构拆解（原材料 / 能源 / 人工 / 折旧 / 环保）
- 不同规模（实验室 / 千克级 / 吨级）下的单位成本参考
- 市场参考售价（含税、出厂价、终端价），单位需注明（元/千克、$/kg 等）
- 价格主要影响因素（原材料波动、能源成本、汇率）
- 近 1-2 年价格走势与预期`,

        '竞争格局与主要厂商': `
## 五、竞争格局与主要厂商
- 市场集中度（CR3/CR5）与竞争格局（分散/寡头）
- 国内外头部企业列表（各 3-5 家），每家包含：
  - 公司名称、成立时间、上市情况
  - 核心产品线与技术特色
  - 年产能、市场份额（如有公开数据）
  - 近年重要战略动作（融资、扩产、并购）
- 新进入者与潜在颠覆者分析`,

        '政策法规与标准体系': `
## 六、政策法规与标准体系
- 国内主要政策法规（产业政策、安全法规、环保标准）
- 国际标准与认证体系（ISO、REACH、RoHS 等）
- 近期政策动向对行业的影响（利好 / 利空）
- 进出口管制与贸易壁垒`,

        '供应链与原料分析': `
## 七、供应链与原料分析
- 核心原材料列表（前 3-5 种），每种包含：
  - 主要产地与供应商
  - 对外依存度与替代方案
  - 价格波动风险
- 供应链关键瓶颈与「卡脖子」环节
- 国产替代进展`,

        '应用领域与下游市场': `
## 八、应用领域与下游市场
- 主要应用场景列表（按用量/价值占比排序）
- 各场景对产品性能指标的差异化要求
- 新兴应用方向与商业化时间线
- 下游行业景气度与需求拉动分析`,

        '技术路线图与创新前沿': `
## 九、技术路线图与创新前沿
- 当前主流技术路线的成熟阶段
- 近 1-2 年高影响力专利（assignee、核心权利要求摘要）
- 学术前沿（高引文献方向、关键突破点）
- 下一代技术路线与时间线预测
- 研发投入强度与创新生态（初创公司、高校）`,

        '投资动向与融资事件': `
## 十、投资动向与融资事件
- 近 2 年该领域主要融资事件（时间、企业、金额、轮次、投资方）
- 资本关注的细分赛道与逻辑
- IPO 进展与估值参考
- 战略并购事件分析`,

        '风险与机会矩阵': `
## 十一、风险与机会矩阵
| 维度 | 主要风险 | 主要机会 |
|------|---------|---------|
| 技术 | ... | ... |
| 市场 | ... | ... |
| 政策 | ... | ... |
| 供应链 | ... | ... |

- 首要风险深度分析
- 近期窗口性机会识别`,

        '战略建议': `
## 十二、战略建议
- 新进入者建议（切入点、差异化路径）
- 现有企业建议（产品策略、市场拓展优先级）
- 研发方向优先级评估
- 短期（1年）/ 中期（3年）关键里程碑建议`
    };

    const selectedGuides = dimensions
        .map(d => dimensionGuides[d] || `## ${d}\n请提供该维度的详细专业分析。`)
        .join('\n\n');

    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名顶级行业分析师，同时具备材料科学、化工工程与商业战略背景。
请针对以下行业生成一份覆盖深度商业与技术细节的专业调研报告。

**研究对象**: ${industry}
**地区范围**: ${region}
**时间跨度**: ${timeRange}
${customContext ? `**补充背景**: ${customContext}` : ''}

---

请严格按以下章节框架输出报告内容。每个章节必须包含具体数据、参数、价格等可量化信息，避免空泛描述。
如数据为推算/估计，请标注「(估算)」或「(参考)」。
所有价格单位请明确标注（元/kg、$/kg 等）。
对于制备工艺，请给出具体温度、压力、时间、关键催化剂/助剂等参数。

${selectedGuides}

---

## 执行摘要（Executive Summary）
（置于最前，200字以内，提炼核心发现与战略判断）

---

## 数据来源说明
（列出本报告主要参考的公开数据来源：如公司年报、行业协会、学术期刊、政府统计等）

---

**输出要求**：
1. 使用中文，专业准确，数据有据可查
2. Markdown 格式，含分级标题、表格、重点加粗
3. 每个章节内容丰富具体，避免流于表面
4. 报告总长度不得少于 3000 字`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG }
        });
        return response.text || '';
    });
};
