// ═══ SciFlow Pro — AI 分析: industry ═══

import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "../core";

/**
 * 搜索全球趋势
 */
export const searchGlobalTrends = async (query: string, timeRange: string = '2weeks') => {
  const today = new Date().toISOString().split('T')[0];
  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一台全球行业动态探测引擎。正在搜索关键词: "${query}"，时间范围: ${timeRange}。
        请探测该领域相关的技术演进、政策调整、市场波动及竞争对手动作。
        
        对每条动态，除了原文内容(content)外，还需要生成一段 100-200 字的"内参摘要"(summary)：
        - 去粗取精，概括核心事件及影响
        - 强调该动态对相关行业的潜在颠覆性、机会或风险
        - 语言简练专业，适合高层快速查阅

        输出必须是一个严格的 JSON 格式：
        {
          "items": [
            {
              "id": "随机字符串",
              "title": "动态标题",
              "category": "Technology" | "Market" | "Policy" | "Competitor",
              "content": "详细情报原文内容（200-400字）",
              "summary": "内参摘要（100-200字，精炼核心要点与影响分析）",
              "impactScore": 1-5,
              "source": "来源机构/网站名称",
              "url": "来源链接（如果有，没有则留空）",
              "timestamp": "YYYY-MM-DD",
              "detectedAt": "${today}"
            }
          ]
        }`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 4096, responseMimeType: "application/json" }
    });
    return JSON.parse(extractJson(response.text || '{"items":[]}'));
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
      config: { ...SPEED_CONFIG, maxOutputTokens: 512, thinkingConfig: { thinkingBudget: 0 } }
    });
    return response.text || "";
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
      config: { ...SPEED_CONFIG, maxOutputTokens: 4096 }
    });
    return response.text || '';
  });
};
