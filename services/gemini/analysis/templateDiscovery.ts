// ═══ SciFlow Pro — AI 分析: 学术图表模板智能发现 ═══

import { callGeminiWithRetry, extractJson, PRO_MODEL, SPEED_CONFIG } from "../core";

/**
 * AI 智能模板发现：根据用户输入的学术关键词（如 "XRD 衍射图"、"LSV 极化曲线"）
 * 自动生成符合学术规范的图表样式模板。
 */
export const discoverChartTemplate = async (query: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一位资深的科研图表规范专家，精通各类学术论文插图的视觉标准。

用户想要为以下类型的实验数据创建学术级图表：
「${query}」

请根据该实验/数据类型，输出一份最佳的学术制图规范。输出严格 JSON，字段说明如下：

{
  "name": "string",                    // 模板名称（中文，简洁，如 "XRD 衍射能量分布图"）
  "chartType": "line" | "bar" | "scatter" | "heatmap" | "contour" | "surface3d" | "violin" | "bubble" | "polar",
  "colors": ["#hex1", "#hex2", ...],   // 推荐的学术配色方案（3-5 个 HEX 色值，应符合该领域常见配色）
  "strokeWidth": number,               // 线条粗细（通常 1.5-3）
  "pointShape": "circle" | "square" | "diamond" | "triangleUp" | "none",  // 数据点形状
  "pointSize": number,                 // 数据点大小（通常 3-6）
  "xLabel": "string",                  // X 轴标签（含单位，如 "2θ (°)"、"Potential (V vs. RHE)"）
  "yLabel": "string",                  // Y 轴标签（含单位，如 "Intensity (a.u.)"、"Current Density (mA/cm²)"）
  "gridX": boolean,                    // 是否显示 X 方向网格线
  "gridY": boolean,                    // 是否显示 Y 方向网格线
  "axisBox": boolean,                  // 是否显示四面围框
  "fontFamily": "serif" | "sans-serif",// 字体风格
  "showErrorBar": boolean,             // 是否推荐显示误差棒
  "xScale": "auto" | "log",           // X 轴刻度类型
  "yScale": "auto" | "log",           // Y 轴刻度类型
  "aspectRatio": number,               // 推荐的宽高比（通常 1.0-1.6）
  "dataType": "string",                // 数据类型描述（简短，如 "衍射能量分布"）
  "dataRequirement": "string",         // 数据格式要求描述（如 "双列结构：X轴(2-Theta), Y轴(强度)"）
  "typicalExperiment": "string",       // 典型应用场景（如 "XRD / 晶相物理结构分析"）
  "description": "string"              // 模板用途描述（一句话）
}

要求：
1. 必须基于该实验/数据类型的学术出版标准来推荐参数。
2. 颜色方案应符合高影响因子期刊（Nature, Science, JACS 等）的常见风格。
3. 坐标轴标签必须包含物理量和单位，使用国际标准写法。
4. 如果该类型数据有特殊的制图惯例（如 XRD 通常不显示网格线），请遵守。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                maxOutputTokens: 1024,
                responseMimeType: "application/json"
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
