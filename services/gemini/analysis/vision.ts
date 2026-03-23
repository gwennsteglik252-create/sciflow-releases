// ═══ SciFlow Pro — AI 分析: vision ═══

import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "../core";

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
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json" }
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
            config: { ...SPEED_CONFIG, maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } }
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
            config: { ...SPEED_CONFIG, maxOutputTokens: 512, responseMimeType: "application/json" }
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
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
