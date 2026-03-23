// ═══ SciFlow Pro — AI 分析: market (市场产品分析) ═══

import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "../core";

/**
 * 搜索市场竞品产品
 */
export const searchMarketProducts = async (query: string, options?: {
  region?: string;
  focusOn?: string;
}) => {
  const { region = '全球', focusOn } = options || {};
  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名资深的材料/化学品市场分析师。
请针对以下产品/材料搜索当前市场上的主要商业产品和竞品信息。

**搜索对象（用户原始搜索词，不得替换或泛化）**: "${query}"
**地区范围**: ${region}
${focusOn ? `**重点关注**: ${focusOn}` : ''}

⚠️ **严格主题锁定（最高优先级规则）**：
1. 所有产品必须**严格且仅限于**「${query}」这一精确细分领域
2. 每款产品在纳入前必须通过**应用场景验证**：该产品的主要应用场景是否直接对应「${query}」？
3. 「${query}」不可被拆解、泛化或替换为相关但不同的领域。例如：
   - 搜索"空气电池双功能催化剂" → ✅ 仅限锌-空气/铝-空气等金属-空气电池用 ORR/OER 双功能催化剂 ❌ 排除 PEMFC 催化剂、水电解催化剂、单功能 ORR 催化剂
   - 搜索"锂电池正极材料" → ✅ 仅限锂离子电池正极 ❌ 排除钠电池正极、锂电负极
4. 如果某厂商（如田中贵金属、Johnson Matthey）同时生产多领域催化剂，只纳入其**明确用于「${query}」应用场景**的产品
5. category 字段必须精确到应用场景（如"金属-空气电池双功能催化剂"），不得写泛化类别（如"催化剂"、"贵金属催化剂"）

**多样性与去重要求**：
- 优先覆盖**不同技术路线/制备工艺**的代表性产品，而非同一路线下的多款相似产品
- 每条技术路线最多保留 1-2 款最具代表性的产品
- 产品间应有明显的技术差异化（如贵金属 vs 非贵金属、碳基 vs 氧化物、商业化 vs 实验室阶段）
- 如果同一厂商有多款相似产品，只保留最核心的 1 款

请列出 5-8 款市场上的主要商业产品/竞品（覆盖至少 3 条不同技术路线），每款需包含：
- 产品名称（中文，统一使用「材料体系+功能描述」格式，如"铂铱合金载碳双功能催化剂"、"钴基尖晶石氧化物催化剂"、"铁氮碳单原子催化剂"。禁止使用品牌型号作为中文名称，品牌型号放入 nameEn 字段）
- 英文名称（可包含品牌型号，如"HiSPEC® Pt-Ir/C Bifunctional Catalyst"）
- 生产厂商及所在国家
- 产品类别
- 核心技术规格（3-6 项关键参数，含单位）
- 参考价格（含单位，如 ¥/kg、$/g 等）
- 技术路线（制备工艺名称）
- 主要优势（2-3 点）
- 主要劣势（1-2 点）
- 市场份额估算（%，如有）
- 成熟度（Lab = 实验室阶段 / Pilot = 中试阶段 / Mass = 量产阶段）

输出必须是严格的 JSON：
{
  "products": [
    {
      "id": "随机字符串",
      "name": "产品名",
      "nameEn": "Product Name",
      "manufacturer": "厂商名",
      "country": "国家",
      "category": "产品类别",
      "specs": [
        { "label": "参数名", "value": "参数值", "unit": "单位" }
      ],
      "price": { "value": 数字, "unit": "元/kg", "note": "备注" },
      "techRoute": "制备工艺名称",
      "advantages": ["优势1", "优势2"],
      "disadvantages": ["劣势1"],
      "marketShare": 数字或null,
      "maturityLevel": "Lab" | "Pilot" | "Mass",
      "source": "信息来源"
    }
  ],
  "marketOverview": "50-100字的市场概述"
}`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 4096, responseMimeType: "application/json" }
    });
    return JSON.parse(extractJson(response.text || '{"products":[]}'));
  });
};

/**
 * 生成产品对比分析
 */
export const generateProductComparison = async (products: { name: string; specs: { label: string; value: string; unit?: string }[] }[]) => {
  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名产品对比分析专家。请对以下产品进行多维度对比分析。

**待对比产品**:
${products.map((p, i) => `${i + 1}. ${p.name} — 规格: ${p.specs.map(s => `${s.label}: ${s.value}${s.unit || ''}`).join(', ')}`).join('\n')}

请生成：
1. **对比维度列表**（5-8 个关键指标维度）
2. **雷达图数据**：每个产品在每个维度上的评分（0-100）
3. **总结分析**：200-300 字的对比总结，突出各产品的差异化优势

输出 JSON 格式：
{
  "dimensions": ["维度1", "维度2", ...],
  "radarData": [
    { "dimension": "维度1", "产品A名": 85, "产品B名": 70, ... }
  ],
  "summary": "对比总结文本"
}`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 2048, responseMimeType: "application/json" }
    });
    return JSON.parse(extractJson(response.text || '{"dimensions":[],"radarData":[],"summary":""}'));
  });
};

/**
 * 生成市场产品深度分析报告
 */
export const generateMarketProductReport = async (params: {
  product: string;
  region: string;
  competitors?: string[];
  focusDimensions: string[];
  customContext?: string;
}) => {
  const { product, region, competitors, focusDimensions, customContext } = params;

  const dimensionGuides: Record<string, string> = {
    '产品技术规格对比': `## 产品技术规格对比
- 列出各竞品的完整技术参数对比表格
- 标注各参数的行业标杆值
- 分析各产品的技术差异化路径`,

    '制备工艺与成本': `## 制备工艺与成本结构
- 主要竞品的制备工艺路线
- 原材料成本、设备投入、人工成本拆分
- 规模效应与降本路径分析`,

    '市场份额与定价': `## 市场份额与定价策略
- 主要厂商的市场份额（如有公开数据）
- 产品定价区间（标注单位）
- 价格影响因素与趋势预测`,

    '竞争优劣势分析': `## 竞争优劣势 SWOT 分析
| 维度 | 优势 | 劣势 | 机会 | 威胁 |
|------|------|------|------|------|
| ... | ... | ... | ... | ... |`,

    '应用场景与客户': `## 应用场景与目标客户
- 主要应用领域及各领域用量
- 目标客户画像
- 客户决策关键因素`,

    '供应链与原料': `## 供应链与原料风险
- 核心原料的供应商与价格波动
- 供应链关键瓶颈
- 国产替代进展`,

    '技术趋势与替代风险': `## 技术趋势与替代风险
- 下一代技术路线预测
- 潜在替代产品/技术
- 创新专利布局分析`,

    '进入壁垒与建议': `## 进入壁垒与战略建议
- 技术壁垒、资本壁垒、品牌壁垒分析
- 差异化切入点建议
- 短期/中期关键里程碑`
  };

  const selectedGuides = focusDimensions
    .map(d => dimensionGuides[d] || `## ${d}\n请提供该维度的详细专业分析。`)
    .join('\n\n');

  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名顶级市场分析师，同时具备材料科学与商业战略背景。
请针对以下产品生成一份深度竞品与市场分析报告。

**分析产品**: ${product}
**地区范围**: ${region}
${competitors && competitors.length > 0 ? `**已知竞品**: ${competitors.join('、')}` : ''}
${customContext ? `**补充背景**: ${customContext}` : ''}

**主题锁定**: 所有分析内容必须严格围绕「${product}」这一精确细分领域，不得扩展到技术上相关但应用场景不同的其他领域。

---

请严格按以下章节框架输出报告。每章节必须包含具体数据、参数和可量化信息。

## 执行摘要（Executive Summary）
（200字以内，提炼核心发现）

${selectedGuides}

---

**输出要求**：
1. 使用中文，专业准确
2. Markdown 格式，含分级标题、表格、重点加粗
3. 每章节内容丰富具体，禁止空泛描述
4. 报告总长度 2000-4000 字`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 4096 }
    });
    return response.text || '';
  });
};

/**
 * 分析产品的专利技术档案
 */
export const analyzeProductTechnology = async (product: {
  name: string;
  manufacturer: string;
  techRoute?: string;
  category?: string;
}) => {
  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名资深的材料/化学品专利分析师和工艺工程师。
请对以下产品进行深度技术分析，重点挖掘技术细节和知识产权信息。

**产品**: ${product.name}
**生产商**: ${product.manufacturer}
${product.techRoute ? `**已知技术路线**: ${product.techRoute}` : ''}
${product.category ? `**产品类别**: ${product.category}` : ''}

请从以下维度进行分析：

1. **核心专利**：列出该厂商/该类产品的关键专利（可基于公开信息推断）
2. **工艺流程**：拆解制备工艺的关键步骤
3. **配方/组分**：分析关键原料及其作用
4. **技术壁垒**：评估整体技术壁垒和可替代性

输出严格 JSON 格式：
{
  "patents": [
    {
      "id": "专利编号（如CN123456A或推断编号）",
      "title": "专利标题",
      "applicant": "申请人",
      "filingDate": "申请年份",
      "status": "已授权 / 审查中 / 已失效",
      "keyTech": "核心技术点（一句话）"
    }
  ],
  "processSteps": ["步骤1: 前驱体制备 – 详细描述", "步骤2: 反应/合成 – 详细描述", "步骤3: 后处理 – 详细描述"],
  "keyFormulation": "关键配方描述（如：以碳酸锂和氢氧化镍为原料，掺杂3%铝...）",
  "precursors": ["前驱体1", "前驱体2"],
  "sinteringTemp": "反应/烧结温度范围",
  "techBarrierScore": 0到100的整数,
  "techBarrierNotes": "技术壁垒分析说明（100-200字）",
  "substitutability": "low" | "medium" | "high"
}`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 3072, responseMimeType: "application/json" }
    });
    return JSON.parse(extractJson(response.text || '{}'));
  });
};

/**
 * 生成技术路线演化时间线数据（基于已搜索竞品上下文）
 */
export const generateTechEvolution = async (params: {
  query: string;
  region?: string;
  products?: { name: string; manufacturer: string; techRoute?: string; maturityLevel?: string; category?: string }[];
}) => {
  const { query, region = '全球', products } = params;

  const productContext = products && products.length > 0
    ? `\n**已知市场竞品详情**:\n${products.map((p, i) => `${i + 1}. ${p.name}（${p.manufacturer}${p.techRoute ? `，技术路线: ${p.techRoute}` : ''}${p.maturityLevel ? `，成熟度: ${p.maturityLevel}` : ''}${p.category ? `，类别: ${p.category}` : ''}`).join('\n')}`
    : '';

  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名资深的材料/化学领域技术情报分析师。
请针对以下产品/材料/技术领域，结合已知市场竞品数据，生成一份完整的技术路线演化时间线。

**分析对象（用户原始搜索词，禁止替换、泛化或缩写）**: "${query}"
**地区范围**: ${region}
${productContext}

⚠️ **严格主题锁定（最高优先级规则）**：
1. 所有里程碑、代际划分和未来展望，都必须**严格且仅限于**「${query}」这一精确细分领域
2. 「${query}」不可被替换为任何泛化概念。例如用户搜索"空气电池双功能催化剂"时：
   ✅ 必须聚焦：金属-空气电池中 ORR/OER 双功能催化剂的演化
   ❌ 严禁混入：PEMFC 燃料电池催化剂、水电解催化剂、贵金属复合催化剂等相关但不同的领域
3. 上方竞品数据中，如果某产品**不属于**「${query}」领域，则在时间线中**忽略该产品**
4. futureOutlook 中必须使用「${query}」原文描述未来展望，不得替换为其他术语

请基于以上竞品产品的技术路线、成熟度和厂商背景，生成该细分领域的技术演化时间线。
必须涵盖这些竞品厂商在演化进程中扮演的角色和贡献（仅限与「${query}」直接相关的贡献）。

请涵盖以下内容：

1. **里程碑事件**（8-15 个关键节点）：
   - 重大技术突破（breakthrough）
   - 标志性商业产品发布（product）— 尤其要覆盖上述竞品中的代表性产品
   - 关键专利布局（patent）
   - 行业标准制定（standard）
   - 未来趋势预测（forecast，2-3 个）
   ⚠️ 每个里程碑的 title 和 description 都必须明确体现与「${query}」的直接关联

2. **技术代际划分**（3-5 代）：
   - 每一代技术的名称、起止年份、特征描述
   - 标注上述竞品分别属于哪代技术
   ⚠️ 代名称必须体现「${query}」领域特征，不得使用通用名称

3. **未来展望**：100-200 字的技术演进趋势总结
   ⚠️ 必须以「${query}」为主语描述，如"${query}的演进正处于…"，不得切换到其他领域

每个里程碑需要区分影响力：high（行业变革性）、medium（显著进步）、low（渐进改良）。

输出严格 JSON 格式：
{
  "milestones": [
    {
      "id": "m1",
      "year": "2010",
      "title": "里程碑标题",
      "description": "详细描述（30-80 字）",
      "category": "breakthrough" | "product" | "patent" | "standard" | "forecast",
      "techRoute": "相关技术路线名称",
      "companies": ["企业1", "企业2"],
      "impact": "high" | "medium" | "low"
    }
  ],
  "generations": [
    {
      "name": "第一代: 名称",
      "startYear": "2000",
      "endYear": "2010",
      "color": "#颜色hex值",
      "description": "该代技术特征描述"
    }
  ],
  "futureOutlook": "以「${query}」为主语的未来展望文本（100-200字）"
}

最终检查：如果你生成的任何内容偏离了「${query}」而涉及了其他催化剂领域或材料体系，都必须删除重写。`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 4096, responseMimeType: "application/json" }
    });
    return JSON.parse(extractJson(response.text || '{"milestones":[],"generations":[],"futureOutlook":""}'));
  });
};

/**
 * 生成研发战略建议（综合全部分析数据 — 增强版）
 */
export const generateRDRecommendation = async (params: {
  query: string;
  products: {
    name: string; manufacturer: string; country?: string;
    techRoute?: string; maturityLevel?: string; category?: string;
    advantages?: string[]; disadvantages?: string[];
    marketShare?: number;
    specs?: { label: string; value: string; unit?: string }[];
    price?: { value: number; unit: string; note?: string };
  }[];
  techProfiles?: {
    productName: string; techBarrierScore?: number; substitutability?: string;
    processSteps?: string[];  techBarrierNotes?: string;
    patents?: { id: string; title: string; applicant: string; filingDate: string; status: string; keyTech: string }[];
    keyFormulation?: string; precursors?: string[]; sinteringTemp?: string;
  }[];
  evolutionData?: { futureOutlook?: string; generations?: { name: string; description: string }[]; milestoneCount?: number };
  comparisonData?: { dimensions?: string[]; summary?: string };
}) => {
  const { query, products, techProfiles, evolutionData, comparisonData } = params;

  // ── 构建竞品全景（含规格、价格）──
  const productList = products.map((p, i) => {
    const specsStr = p.specs && p.specs.length > 0
      ? `\n   - 核心规格: ${p.specs.map(s => `${s.label}: ${s.value}${s.unit || ''}`).join(' | ')}`
      : '';
    const priceStr = p.price ? `\n   - 参考价格: ${p.price.value} ${p.price.unit}${p.price.note ? `（${p.price.note}）` : ''}` : '';
    return `${i + 1}. **${p.name}**（${p.manufacturer}，${p.country || '—'}）\n   - 技术路线: ${p.techRoute || '未知'}\n   - 成熟度: ${p.maturityLevel || '未知'}\n   - 市场份额: ${p.marketShare != null ? p.marketShare + '%' : '未知'}${specsStr}${priceStr}\n   - 优势: ${(p.advantages || []).join('、') || '无'}\n   - 劣势: ${(p.disadvantages || []).join('、') || '无'}`;
  }).join('\n');

  // ── 构建技术档案（含专利、配方、工艺）──
  const techSection = techProfiles && techProfiles.length > 0
    ? `\n**深度技术档案**:\n${techProfiles.map(t => {
        const parts = [
          `- **${t.productName}**: 壁垒评分 ${t.techBarrierScore ?? '?'}/100, 可替代性: ${t.substitutability || '?'}`,
          t.processSteps && t.processSteps.length > 0 ? `  工艺: ${t.processSteps.join(' → ')}` : '',
          t.keyFormulation ? `  配方: ${t.keyFormulation}` : '',
          t.precursors && t.precursors.length > 0 ? `  前驱体: ${t.precursors.join('、')}` : '',
          t.sinteringTemp ? `  烧结温度: ${t.sinteringTemp}` : '',
          t.techBarrierNotes ? `  壁垒说明: ${t.techBarrierNotes}` : '',
          t.patents && t.patents.length > 0 ? `  关键专利 (${t.patents.length}): ${t.patents.map(pt => `[${pt.id}] ${pt.title}（${pt.applicant}，${pt.status}）— ${pt.keyTech}`).join('；')}` : '',
        ].filter(Boolean);
        return parts.join('\n');
      }).join('\n\n')}`
    : '';

  // ── 构建演化趋势摘要 ──
  const evolutionSection = evolutionData
    ? `\n**技术演化分析**:${evolutionData.milestoneCount ? `\n- 共追踪到 ${evolutionData.milestoneCount} 个技术里程碑` : ''}${evolutionData.generations && evolutionData.generations.length > 0 ? `\n- 代际划分: ${evolutionData.generations.map(g => `${g.name}（${g.description}）`).join(' → ')}` : ''}${evolutionData.futureOutlook ? `\n- 未来展望: ${evolutionData.futureOutlook}` : ''}`
    : '';

  // ── 构建对比分析摘要 ──
  const comparisonSection = comparisonData
    ? `\n**竞品对比结论**:${comparisonData.dimensions ? `\n- 对比维度: ${comparisonData.dimensions.join('、')}` : ''}${comparisonData.summary ? `\n- 结论: ${comparisonData.summary}` : ''}`
    : '';

  // ── 统计元数据 ──
  const techRoutes = [...new Set(products.map(p => p.techRoute).filter(Boolean))];
  const maturityDist = { Lab: 0, Pilot: 0, Mass: 0 };
  products.forEach(p => { if (p.maturityLevel && maturityDist[p.maturityLevel as keyof typeof maturityDist] !== undefined) maturityDist[p.maturityLevel as keyof typeof maturityDist]++; });
  const avgBarrier = techProfiles && techProfiles.length > 0
    ? Math.round(techProfiles.reduce((sum, t) => sum + (t.techBarrierScore || 0), 0) / techProfiles.length)
    : null;

  const metaSection = `\n**数据统计摘要**:
- 竞品数量: ${products.length} 款
- 技术路线分布: ${techRoutes.join('、') || '未知'}
- 成熟度分布: 实验室(${maturityDist.Lab}) / 中试(${maturityDist.Pilot}) / 量产(${maturityDist.Mass})
${avgBarrier !== null ? `- 平均技术壁垒: ${avgBarrier}/100` : ''}
${techProfiles ? `- 已完成技术深度分析: ${techProfiles.length}/${products.length}` : ''}`;

  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名同时具备材料科学博士学位、10年产业投资经验和 McKinsey 战略咨询背景的顶级研发战略顾问。
你需要基于下方**详尽的市场竞品分析数据**（包含产品规格、价格、工艺、专利、技术壁垒、技术演化趋势），为一家拟进入该领域的科技企业撰写一份 **专业级研发战略建议书**。

# ${query}研发战略建议书

**目标领域（用户原始搜索词，禁止替换或泛化）**: "${query}"

⚠️ **主题强制规则**：
1. 报告一级标题已固定为「# ${query}研发战略建议书」，禁止更改
2. 全文分析必须严格锁定在「${query}」精确细分领域内
3. 所有推荐的技术路线、产品方向和研发投资都必须直接服务于「${query}」的研发与产业化

---

## 输入数据（请仔细阅读，所有分析必须基于这些实证数据）

${metaSection}

**市场竞品全景**:
${productList}
${techSection}
${evolutionSection}
${comparisonSection}

---

## 请按以下框架撰写建议书（共10个章节，每章节有明确要求）：

### 📋 执行摘要
- 用 200-300 字概括核心发现和首要建议
- 明确指出最推荐的 1 条技术路线和最优先的研发方向
- 给出信心等级：🟢高度推荐 / 🟡建议审慎推进 / 🔴需重大前提条件

### 1. 技术路线决策分析
对比上述竞品采用的所有技术路线，从以下维度对每条路线进行定量评估：

| 技术路线 | 技术成熟度(TRL) | 成本竞争力 | 性能天花板 | 专利风险 | 规模化潜力 | 综合推荐指数 |
|---------|---------------|----------|----------|---------|----------|------------|
（综合推荐指数 = 10分制量化评分。必须覆盖上方所有不同技术路线）

结论：明确推荐 1-2 条最值得投入的路线，给出清晰的推荐理由。

### 2. 性能对标矩阵
基于竞品的核心技术规格，构建性能对标矩阵：
- 提取关键性能指标（基于上方 specs 数据）
- 标注当前行业最佳值、平均值和市场准入门槛值
- 明确我方研发需达到的**最低目标值**和**竞争优势目标值**

| 性能指标 | 行业最佳 | 行业均值 | 准入门槛 | 我方最低目标 | 竞争优势目标 |

### 3. 知识产权(IP)风险与机会分析
${techProfiles && techProfiles.some(t => t.patents && t.patents.length > 0) ? '基于上方专利数据进行分析：' : '基于行业公开信息推断：'}
- **专利壁垒地图**: 哪些技术环节已被密集布局？哪些存在空白？
- **FTO（Freedom to Operate）分析概要**: 推荐路线是否可能侵犯现有核心专利？
- **自主 IP 布局建议**: 优先申请专利的 3-5 个技术方向

### 4. 供应链与成本分析
${products.some(p => p.price) ? '基于上方价格数据：' : '基于行业公开信息：'}
- 核心原材料供应风险评估
- 目标产品成本结构拆解（原料占比、设备折旧、人工、能耗）
- 与现有竞品的成本对比和降本路径

### 5. 差异化定位与市场切入策略
- 市场空白点和未被满足的需求（基于竞品优劣势分析）
- 推荐的 2-3 个差异化切入方向，每个包含：
  - 目标细分市场
  - 核心差异化卖点
  - 预估目标客户规模

### 6. 研发投资决策矩阵
| 研发方向 | 技术可行性 | 市场前景 | 竞争壁垒 | 初始投资(万元) | 预计突破周期 | ROI预期 | 综合优先级 |
|---------|----------|---------|---------|-------------|-----------|---------|----------|
（技术可行性/市场前景/竞争壁垒用 ★ 到 ★★★★★ 评级；投资、周期用具体数字）

### 7. 三维风险评估
用以下格式系统评估每类风险：
#### 7.1 技术风险
| 风险因素 | 发生概率 | 影响程度 | 缓解措施 |
#### 7.2 市场风险
| 风险因素 | 发生概率 | 影响程度 | 缓解措施 |
#### 7.3 知识产权风险
| 风险因素 | 发生概率 | 影响程度 | 缓解措施 |
（概率和影响用 高/中/低 标注）

### 8. 里程碑路线图
- **Phase 1 — 可行性验证 (0-6月)**：具体任务清单、关键交付物、预算、团队配置
- **Phase 2 — 技术攻关 (6-18月)**：核心指标达标目标、中试验证计划
- **Phase 3 — 产业化推进 (18-36月)**：良率/产能目标、商业化策略

### 9. 关键成功指标 (KPIs)
列出需要追踪的 top 10 KPI，含目标值和时间节点：
| KPI | 基线值(竞品参考) | 6个月目标 | 12个月目标 | 18个月目标 |

### 10. 战略总结与首要行动
- 用 3 点式概括核心战略建议（每点一句话）
- 列出**立即启动的 Top 5 行动项**（每项含负责角色和截止时间）

---

**输出要求**：
1. 使用中文，数据驱动、具体量化
2. 严格按 Markdown 格式输出（含表格、分级标题、加粗重点、emoji 标记）
3. 所有论据必须回溯到上方竞品数据，引用具体产品名和参数值
4. 总长度 4000-7000 字
5. **禁止使用 LaTeX 格式**：化学式直接用纯文本书写（如 Co3O4、MnCo2O4、Fe-N-C），不得使用 $...$ 或 \\(...\\) 等 LaTeX 语法
5. **主题锁定**: 所有分析、路线推荐和研发建议必须严格围绕「${query}」，不得偏移到其他相关领域`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 8192 }
    });
    return response.text || '';
  });
};

/**
 * 推荐路线深度分析
 */
export const generateRouteDeepDive = async (params: {
  query: string;
  routeName: string;
  routeRationale?: string;
  products?: { name: string; manufacturer: string; techRoute?: string; specs?: any[]; price?: any }[];
  rdAdviceSummary?: string;
}) => {
  const { query, routeName, routeRationale, products, rdAdviceSummary } = params;

  const productContext = products && products.length > 0
    ? `\n**相关竞品参考**:\n${products.map((p, i) => `${i + 1}. ${p.name}（${p.manufacturer}${p.techRoute ? `，工艺: ${p.techRoute}` : ''}${p.specs ? `，参数: ${p.specs.map(s => `${s.label}: ${s.value}${s.unit || ''}`).join(', ')}` : ''}${p.price ? `，价格: ${p.price.value} ${p.price.unit}` : ''}）`).join('\n')}`
    : '';

  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名拥有 15 年产业化经验的材料科学首席技术官（CTO），同时具备从实验室到中试再到量产的全流程管理经验。

**分析主题（用户原始搜索词）**: "${query}"
**首要推荐技术路线**: "${routeName}"
${routeRationale ? `**推荐理由**: ${routeRationale}` : ''}
${productContext}
${rdAdviceSummary ? `\n**研发战略建议摘要**:\n${rdAdviceSummary.slice(0, 2000)}` : ''}

⚠️ **严格主题锁定**: 所有分析必须严格围绕「${query}」领域中的「${routeName}」技术路线，不得偏移。

请针对「${routeName}」这一推荐技术路线，生成一份**详细的实施落地分析报告**，覆盖以下 9 个维度：

---

## 一、合成工艺流程详解

请提供**完整的制备工艺流程**：
1. 逐步骤列出（Step 1 → Step N），每步包含：操作描述、关键参数（温度/时间/气氛/转速/pH等）、注意事项
2. 用表格展示**关键工艺参数窗口**（参数名 | 最优值 | 可接受范围 | 超出后果）
3. 标注**质量控制检查点**（哪些步骤需要取样检测）

## 二、原材料需求清单

用表格列出所有需要的前驱体/原料：
| 原料名称 | 纯度要求 | 用量(per batch) | 单价参考 | 供应商举例 | 可替代方案 |

标注关键原料的**供应链风险**（单一来源？进口依赖？价格波动大？）

## 三、核心设备与基础设施

分**实验室阶段**和**中试阶段**列出设备清单：
| 设备名称 | 规格要求 | 用途 | 估算成本 | 是否可共享/租赁 |

标注**必须定制**的特殊设备

## 四、关键验证实验方案

设计 **5-8 个核心验证实验**，每个包含：
- 实验目的
- 实验方法（简述）
- 预期指标 + 判定标准（Pass/Fail 线）
- 预计周期
- 优先级（P0=必做 / P1=重要 / P2=锦上添花）

用表格呈现

## 五、核心技术难点与突破策略

识别 **3-5 个关键技术挑战**，每个包含：
- 难点描述
- 当前业界解决程度（已解决/部分解决/尚无共识）
- 推荐的突破策略（2-3 种方案）
- 对标竞品中的解决方案（如有）

## 六、关键文献与专利参考

列出 **5-10 篇**与该技术路线最相关的：
- 高被引学术论文（作者/年份/期刊/核心发现）
- 核心专利（专利号/持有人/核心权利要求）
标注哪些可以直接指导实验设计

## 七、成本递减路径模型

用表格展示从实验室到量产的成本变化：
| 阶段 | 批次规模 | 单位成本 | 主要成本构成 | 降本关键措施 |

- Lab（1-10g级）
- Pilot（100g-1kg级）
- Mass（10kg+级）

## 八、研发团队配置建议

建议的核心团队结构：
| 角色 | 人数 | 专业背景要求 | 核心职责 | 是否可兼职 |

标注**必须全职**的关键岗位

## 九、阶段验收标准（Go/No-Go 决策）

按 Phase 划分里程碑：
| 阶段 | 时间节点 | 关键交付物 | Go 标准 | No-Go 触发条件 |

- Phase 1: 可行性验证（0-6月）
- Phase 2: 工艺优化（6-18月）
- Phase 3: 中试放大（18-36月）

---

**输出要求**：
1. 使用中文，数据驱动、具体量化
2. 严格按 Markdown 格式输出（含表格、分级标题、加粗重点）
3. 所有建议必须基于「${routeName}」路线的实际工艺特点
4. 总长度 3000-6000 字
5. **禁止使用 LaTeX 格式**：化学式直接用纯文本书写（如 Co3O4、MnCo2O4、Fe-N-C），不得使用 $...$ 或 \\(...\\) 等 LaTeX 语法
5. 一级标题使用「# ${query}：${routeName}技术路线实施分析」`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: { ...SPEED_CONFIG, maxOutputTokens: 8192 }
    });
    return response.text || '';
  });
};
