
import { Type } from "@google/genai";
import { ExperimentLog, Literature, Milestone, TransformationProposal } from "../../types";
import { callGeminiWithRetry, extractJson, safeJsonParse, FAST_MODEL, PRO_MODEL, SPEED_CONFIG, IMAGE_MODEL } from "./core";

type Language = 'zh' | 'en';

const getLangInstruction = (lang: Language) => {
    return lang === 'en'
        ? "Output MUST be in rigorous Academic English."
        : "输出必须使用严谨的学术中文。";
};

const stripMd = (text: string) =>
    text
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+[\.\)]\s*/, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .trim();

const parsePptOutlineFromText = (rawText: string) => {
    const clean = (rawText || '')
        .replace(/^```(?:json|markdown|md)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    if (!clean) return [];

    const lines = clean.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const slides: any[] = [];
    let current: any = null;

    const flush = () => {
        if (!current) return;
        if (!current.title) current.title = `Slide ${slides.length + 1}`;
        current.pageNumber = slides.length + 1;
        if (!Array.isArray(current.points)) current.points = [];
        if (current.points.length === 0) current.points = ['待补充'];
        slides.push(current);
    };

    for (const line of lines) {
        const normalized = line.toLowerCase();
        const isSlideHeader =
            /第[一二三四五六七八九十0-9]+页/.test(line) ||
            /slide\s*0*\d+/i.test(line) ||
            /^#{1,6}\s*\*{0,2}\s*第.+页/.test(line);

        if (isSlideHeader) {
            flush();
            const titlePart = line.split(/[:：]/).slice(1).join('：') || line;
            current = { pageNumber: 0, title: stripMd(titlePart), points: [] as string[] };
            continue;
        }

        if (!current) {
            current = { pageNumber: 0, title: '生成大纲', points: [] as string[] };
        }

        if (normalized.includes('主标题')) {
            const t = stripMd(line.split(/[:：]/).slice(1).join('：'));
            if (t) current.title = t;
            continue;
        }
        if (normalized.includes('副标题')) {
            const st = stripMd(line.split(/[:：]/).slice(1).join('：'));
            if (st) current.subTitle = st;
            continue;
        }

        if (/^[-*•]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line)) {
            current.points.push(stripMd(line));
            continue;
        }

        if (!/^---+$/.test(line)) {
            current.points.push(stripMd(line));
        }
    }

    flush();
    return slides.slice(0, 16);
};

/**
 * 专门用于生图前的提示词翻译与增强
 * 优化：使用 FAST_MODEL
 */
export const translatePromptToEnglish = async (prompt: string): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const instruction = `你是一名顶级 3D 渲染提示词专家。请将以下中文科研描述翻译并增强为一段专业的英文生图提示词 (Prompt)。
        要求：
        1. 必须输出为纯英文。
        2. 增加渲染细节描述。
        3. 只输出翻译后的 Prompt 内容。
        
        待处理内容: "${prompt}"`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                temperature: 0.3,
                thinkingConfig: { thinkingBudget: 0 } // 极速模式
            }
        });
        return response.text?.trim() || prompt;
    });
};

/**
 * AI 智能增强生图指令：将用户粗略输入转化为专业级科研图像 Prompt
 * 读取 4 个输入框的内容 + 自由描述，生成专业化、结构化的增强版指令
 */
export const enhanceImagePrompt = async (inputs: {
    subject: string;
    context: string;
    mechanism: string;
    visual: string;
    additional: string;
    style: string;
}): Promise<{
    subject: string;
    context: string;
    mechanism: string;
    visual: string;
    additional: string;
}> => {
    return callGeminiWithRetry(async (ai) => {
        const rawContent = [
            inputs.subject && `研究主体: ${inputs.subject}`,
            inputs.context && `应用场景: ${inputs.context}`,
            inputs.mechanism && `机理路径: ${inputs.mechanism}`,
            inputs.visual && `视觉细化: ${inputs.visual}`,
            inputs.additional && `额外补充: ${inputs.additional}`,
        ].filter(Boolean).join('\n');

        const instruction = `你是一名顶级科研期刊（Nature/Science/JACS/Angew 级别）的 Graphical Abstract 设计专家，同时精通 3D 渲染（C4D/Octane/Blender）和科学可视化。

用户正在使用 AI 生图工具制作科研图像。当前选择的风格是: "${inputs.style}"。

用户输入的原始描述如下：
${rawContent || '（用户未填写任何内容）'}

请将用户的粗略描述**增强**为专业级别的科研图像生成指令。要求：

1. **研究主体 (subject)**：明确研究对象的化学/物理/生物属性、形貌特征、尺寸标度。
   示例："Core-shell Pt@MoS₂ nanoparticles (5-10 nm core, 2-3 layer shell) with exposed active edge sites"

2. **应用场景 (context)**：补充科学背景和应用价值,关联领域前沿。
   示例："Electrocatalytic hydrogen evolution reaction (HER) in acidic media, targeting industrial-scale PEM water electrolysis"

3. **机理路径 (mechanism)**：细化反应/作用机制，添加关键步骤和能量/电子传递路径。
   示例："Multi-step electron transfer: H₂O adsorption on Pt → dissociation at Pt-MoS₂ interface → H* intermediate on MoS₂ edge → H₂ desorption. Synergistic d-band center modulation"

4. **视觉细化 (visual)**：专业渲染参数，包括光照、材质、构图、色调。
   示例："Isometric 3D view, volumetric sub-surface scattering on nanoparticles, depth-of-field blur on background, Nature-style muted blue-green academic palette, ambient occlusion, rim lighting"

5. **额外补充 (additional)**：任何其他专业细节。

**严格要求**：
- 如果用户某个字段为空或描述不足，根据已有上下文智能推断并填充专业内容
- 每个字段输出 1-3 句精炼的英文描述（即使用户输入是中文）
- 不要出现不相关的内容，始终围绕科研图像生成
- 返回 JSON 对象

返回格式：
{
  "subject": "...",
  "context": "...",
  "mechanism": "...",
  "visual": "...",
  "additional": "..."
}`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: instruction,
            config: {
                ...SPEED_CONFIG,
                temperature: 0.5,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        const result = safeJsonParse(response.text || '{}', {
            subject: inputs.subject,
            context: inputs.context,
            mechanism: inputs.mechanism,
            visual: inputs.visual,
            additional: inputs.additional,
        });

        return {
            subject: result.subject || inputs.subject,
            context: result.context || inputs.context,
            mechanism: result.mechanism || inputs.mechanism,
            visual: result.visual || inputs.visual,
            additional: result.additional || inputs.additional,
        };
    });
};

/**
 * Generate a highly persuasive Cover Letter
 */
export const generateCoverLetter = async (
    journal: string,
    meta: any,
    sections: any[],
    innovations: string[],
    lang: Language = 'en'
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名世界顶尖科研人员。请为投稿至【${journal}】期刊的论文撰写一封极具说服力的 Cover Letter。
        论文标题: ${meta.title}
        核心创新点: ${innovations.join('; ')}
        语言: ${lang === 'en' ? '顶级学术英语' : '学术中文'}。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 1024 } // 缩减思考预算以提速
            }
        });
        return response.text || "";
    });
};

/**
 * Analyze figure/table citations vs actual assets for conflicts
 * 优化：使用 FAST_MODEL
 */
export const analyzeManuscriptConflicts = async (
    sections: any[],
    media: any[],
    tables: any[]
) => {
    return callGeminiWithRetry(async (ai) => {
        const sectionsSummary = sections.map(s => ({
            title: s.title,
            tags: s.content.match(/\[(Fig|Table|Math):[\w\d_-]+\]/gi) || []
        }));

        const prompt = `分析图表引用冲突。引用的标签: ${JSON.stringify(sectionsSummary)}。资产库: ${media.map(m => m.refId).join(', ')}。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return safeJsonParse(response.text || '[]', []);
    });
};

/**
 * 增强型润色引擎
 */
export const polishTextEnhanced = async (text: string, mode: string, lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = getLangInstruction(lang);
        let modeDesc = mode === 'formula' ? "将描述提取为 LaTeX 公式。" : "学术规范化润色。";

        const prompt = `你是一台学术写作优化引擎。
        任务：${modeDesc}
        ${langInstr}
        原文: "${text}"
        
        请输出 JSON 格式: { "polishedText": "润色后的文本", "reasoning": ["改进点1", "改进点2"], "impact": "Precision" }
        impact 可选值: Precision, Logic, Formality`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        return safeJsonParse(response.text || '{}', {
            polishedText: text,
            reasoning: [] as string[],
            impact: 'Precision' as string
        });
    });
};

export const polishText = async (text: string, mode: string, lang: Language = 'zh') => {
    const res = await polishTextEnhanced(text, mode, lang);
    return res.polishedText;
};

/**
 * 自动排版参考文献
 * 优化：极简配置
 */
export const formatDynamicBibliography = async (journalName: string, resources: Literature[]) => {
    return callGeminiWithRetry(async (ai) => {
        const limitedResources = resources.slice(0, 30);
        const prompt = `格式化文献列表，遵循【${journalName}】规范。\n数据: ${JSON.stringify(limitedResources)}`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } }
        });

        return response.text || "";
    });
};

/**
 * 核心功能：章节内容生成
 * 优化：对背景进行深度压缩
 */
export const generateSectionContent = async (sectionId: string, sectionLabel: string, context: { title: string, description: string, logs: any[], resources?: Literature[] }, lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = getLangInstruction(lang);
        const logsContext = context.logs.slice(-5).map(l => ({ // 仅保留最后5条
            content: l.content,
            data: l.scientificData
        }));

        const prompt = `撰写章节: ${sectionLabel}。${langInstr}\n课题: ${context.title}\n最近记录: ${JSON.stringify(logsContext)}`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        return safeJsonParse(response.text || '{}', {});
    });
};

export const summarizeExperimentLog = async (log: ExperimentLog, lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const truncatedDesc = (log.description || '').substring(0, 2000);
        const prompt = `你是一名顶级科研机构的资深实验分析专家，擅长从实验记录中挖掘深层科学意义。请对以下实验记录进行**深度**总结与分析，报告将被团队长期存档。

        实验标题: ${log.content}
        实验描述: ${truncatedDesc || '无'}
        实验结果: ${log.result || '未知'}
        科学数据: ${JSON.stringify(log.scientificData || {})}

        重要要求：
        1. 全程使用中文输出，语言专业严谨。
        2. 不得使用 LaTeX 公式。数值直接用数字和单位描述（例如："过电位约为 320 mV"）。
        3. 使用 Markdown 格式，包含以下五个章节：
           ## 实验背景与目标
           ## 实验方法与流程分析
           ## 关键数据深度解读
           ## 异常点与潜在风险
           ## 后续研究方向建议
        4. 每个章节至少写 3-5 句话，深度挖掘数据背后的科学意义，不要泛泛而谈。
        5. 总字数 500-800 字，内容充实而不冗余。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG }
        });
        return response.text || "";
    });
};

export const generateAcademicReport = async (projectTitle: string, logs: ExperimentLog[], type: 'weekly' | 'monthly' | 'annual' = 'weekly', lang: Language = 'zh', aiDocuments?: { title: string; content: string }[]) => {
    const typeLabel = type === 'weekly' ? '周报' : type === 'monthly' ? '月报' : '年报';
    const periodLabel = type === 'weekly' ? '周' : type === 'monthly' ? '月' : '年';
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const rangeDays = type === 'weekly' ? 7 : type === 'monthly' ? 30 : 365;
    const startDate = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    return callGeminiWithRetry(async (ai) => {
        const limitedLogs = logs.slice(-15);
        const logsData = limitedLogs.map(l => ({
            时间: l.timestamp || '',
            标题: l.content,
            结果: l.result || '',
            参数: l.parameters || '',
            数据: l.scientificData
        }));

        const prompt = `你是一名资深科研项目经理，请基于以下实验记录，为课题「${projectTitle}」生成一份专业的研究${typeLabel}。

[生成ID: ${Date.now()}-${Math.random().toString(36).slice(2, 8)}]
当前日期：${currentDate}
报告覆盖时间范围：${startDateStr} 至 ${currentDate}
以下是该时间范围内的实验记录（共 ${limitedLogs.length} 条）：

${JSON.stringify(logsData, null, 2)}

${aiDocuments && aiDocuments.length > 0 ? `以下是课题组此前积累的分析笔记和讨论记录，请在报告中**辩证地**参考和融入这些已有成果：

${aiDocuments.map(d => `### ${d.title}\n${d.content?.substring(0, 800)}`).join('\n\n')}

⚠️ 辩证引用原则：
- 不同分析之间如存在观点矛盾或数据冲突，应在报告中指出差异并分析可能原因
- 对推测性结论应保持审慎态度，使用"初步分析认为""有待进一步验证"等学术措辞
- 优先采信实验原始数据，分析笔记仅作为辅助参考
- 当多份文档对同一现象有不同解读时，在"存在问题与风险"章节中讨论` : ''}

**严格要求：你必须且只能返回一个 JSON 对象，不要输出任何其他文字、标记或解释。**

JSON 格式如下：
{
  "title": "${projectTitle} ${typeLabel}（${startDateStr} ~ ${currentDate}）",
  "content": "报告正文内容（使用 Markdown 格式，包含：## 本${periodLabel}工作进展、## 关键实验结果、## 数据分析与讨论、## 存在问题与风险、## 下${periodLabel}工作计划 五个章节）"
}

注意：
- content 字段的值是一个完整的 Markdown 字符串
- 内容必须基于提供的实验记录，并辩证地融入已有分析成果
- 如果数据不足，可基于实验标题合理推演
- 报告标题必须包含时间范围
- 全程使用中文
- **绝对禁止**在报告正文中出现"AI""人工智能""机器学习""大模型""智能分析""AI辅助""AI生成"等一切暴露 AI 参与的字眼，报告必须读起来完全像是研究人员亲自撰写的
- **严禁使用 LaTeX 语法**（如 $、\\rightarrow、\\downarrow、^{} 等），化学式用纯文本 Unicode 表示（如 Ni²⁺、OH⁻、Fe₂O₃、→、↓）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        const rawText = response.text || '';
        const parsed = safeJsonParse(rawText, null as any);

        // 如果 JSON 解析成功且包含 content 字段，直接返回
        if (parsed && parsed.content) {
            return parsed;
        }

        // 解析失败或缺少 content：将原始文本智能包装为报告结构
        if (rawText.trim()) {
            console.warn('[generateAcademicReport] 模型返回了非 JSON 文本，自动包装为报告格式');
            // 清理可能的 markdown 代码块标记
            let cleanContent = rawText.trim()
                .replace(/^```(json|markdown)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
            // 尝试提取标题（第一行 # 开头的内容）
            const titleMatch = cleanContent.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : `${projectTitle} - ${typeLabel}`;
            return { title, content: cleanContent };
        }

        return { title: `${projectTitle} - ${typeLabel}`, content: '**报告生成失败，AI 未返回有效内容，请重试。**' };
    });
};

export const generateNarrativeBriefing = async (projectTitle: string, logs: ExperimentLog[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `合并生成简报: ${projectTitle}。\n数据: ${JSON.stringify(logs.slice(-10).map(l => ({ 标题: l.content, 数据: l.scientificData })))}`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
        });
        return safeJsonParse(response.text || '{}', {});
    });
};

export const generateScientificPPT = async (logs: ExperimentLog[], proposals: TransformationProposal[], title: string, lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `基于以下数据生成科研汇报 PPT 大纲（仅输出 JSON 数组，不要输出 Markdown，不要额外解释）。
标题: ${title}
数据: ${JSON.stringify(logs.slice(-8).map(l => ({ content: l.content, data: l.scientificData })))}
参考方案: ${JSON.stringify((proposals || []).slice(0, 3).map(p => ({ title: p.title, processChanges: p.processChanges })))}

输出格式（严格）:
[
  {
    "pageNumber": 1,
    "title": "字符串",
    "subTitle": "可选字符串",
    "points": ["要点1", "要点2"],
    "tableData": [["表头1","表头2"],["值1","值2"]],
    "nextSteps": ["下一步1","下一步2"]
  }
]
要求:
1) points 至少 3 条；
2) 仅返回 JSON，不能有代码块标记。`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            pageNumber: { type: Type.NUMBER },
                            title: { type: Type.STRING },
                            subTitle: { type: Type.STRING },
                            points: { type: Type.ARRAY, items: { type: Type.STRING } },
                            tableData: {
                                type: Type.ARRAY,
                                items: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["title", "points"]
                    }
                },
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        const raw = response.text || '';
        const parsed = safeJsonParse(raw, null as any);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((s: any, idx: number) => ({
                pageNumber: Number(s?.pageNumber) || idx + 1,
                title: String(s?.title || `Slide ${idx + 1}`),
                subTitle: s?.subTitle ? String(s.subTitle) : undefined,
                points: Array.isArray(s?.points) ? s.points.map((p: any) => String(p)) : [],
                tableData: Array.isArray(s?.tableData) ? s.tableData.map((r: any[]) => r.map(c => String(c))) : undefined,
                nextSteps: Array.isArray(s?.nextSteps) ? s.nextSteps.map((n: any) => String(n)) : undefined
            }));
        }

        const recovered = parsePptOutlineFromText(raw);
        if (recovered.length > 0) return recovered;
        return [];
    });
};

export const generateWritingMirrorInsight = async (proposalText: string, logs: ExperimentLog[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `执行镜像分析。计划: ${proposalText.substring(0, 500)}。证据: ${JSON.stringify(logs.slice(-10).map(l => ({ 标题: l.content, 数据: l.scientificData })))}`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
        });
        return safeJsonParse(response.text || '{}', {});
    });
};

export const integrateRevision = async (sectionContent: string, quote: string, revision: string, lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `整合建议。原文: ${sectionContent.substring(0, 3000)}。修改建议: "${revision}"。`;
        const response = await ai.models.generateContent({ model: FAST_MODEL, contents: prompt, config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } } });
        return response.text;
    });
};

export const runPeerReview = async (sections: any[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const summary = sections.map(s => ({ title: s.title, content: s.content.substring(0, 1000) }));
        const prompt = `模拟审稿。\n内容: ${JSON.stringify(summary)}。`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } }
        });
        return safeJsonParse(response.text || '{}', {});
    });
};

export const generateCaptionOptions = async (context: string, subFigures: any[], imageBase64: string, lang: 'zh' | 'en') => {
    return callGeminiWithRetry(async (ai) => {
        const subFigInfo = subFigures.length > 0
            ? `\n子图信息：${subFigures.map(f => `(${f.label}) ${f.desc || ''}`).join('；')}`
            : '';
        const isComposite = subFigures.length > 0;

        const prompt = lang === 'en'
            ? `You are writing figure captions for a top-tier scientific journal (Nature, Science, JACS, Angew level).

Analyze this scientific figure and generate 3 different caption options in varying styles.

Context: ${context}${subFigInfo}

Requirements:
1. Each caption must be publication-ready, using precise scientific terminology.
2. ${isComposite ? `This is a composite figure with sub-panels (${subFigures.map(f => f.label).join(', ')}). Each caption MUST describe all sub-panels using the format: "(a) description. (b) description. (c) description."` : 'This is a single-panel figure.'}
3. Generate exactly 3 options:
   - Option 1 (style: "Concise"): Brief and factual, 1-2 sentences. Example: "Figure 1. Morphological and structural characterization. (a) SEM image of the as-prepared catalyst. (b) XRD patterns showing crystalline phases."
   - Option 2 (style: "Detailed"): Comprehensive with key data points, 3-5 sentences. Include quantitative details where visible.
   - Option 3 (style: "Extended"): Full description with context and significance, 4-6 sentences.
4. DO NOT use emotional or subjective language.
5. Return a JSON array with exactly 3 objects, each having "style" (string) and "text" (string) fields.`
            : `你正在为顶刊论文（Nature、Science、JACS、Angew 级别）撰写图注（Figure Caption）。

分析这张科研图片，生成 3 种不同风格的图注方案。

背景信息：${context}${subFigInfo}

要求：
1. 每条图注必须达到发表级别水准，使用精确的科学术语（专业术语可保留英文）。
2. ${isComposite ? `这是一张含多个子图面板（${subFigures.map(f => f.label).join(', ')}）的组图。每条图注**必须**逐一描述所有子图，使用格式："(a) 描述。(b) 描述。(c) 描述。"` : '这是一张单图。'}
3. 生成恰好 3 种方案：
   - 方案1（style 字段填 "简洁版"）：简明扼要，1-2句话。示例："图1. 催化剂的形貌与结构表征。(a) 所制备催化剂的 SEM 图像。(b) 显示晶相的 XRD 图谱。"
   - 方案2（style 字段填 "详细版"）：较为全面，3-5句话，包含可见的关键定量信息。
   - 方案3（style 字段填 "扩展版"）：完整描述，含背景与意义，4-6句话。
4. 禁止使用感性语言或主观评价。
5. 返回一个恰好含 3 个对象的 JSON 数组，每个对象有 "style"（字符串）和 "text"（字符串）两个字段。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } }, { text: prompt }],
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            style: { type: Type.STRING, description: "Caption style name" },
                            text: { type: Type.STRING, description: "The figure caption text" }
                        },
                        required: ["style", "text"]
                    }
                },
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        return safeJsonParse(response.text || '[]', []);
    });
};

export const detectSubFigures = async (imageBase64: string, lang: 'zh' | 'en') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = lang === 'en'
            ? `You are a scientific figure analysis expert. Carefully examine this composite/multi-panel scientific figure and identify all sub-figures (panels).

Instructions:
1. Look for sub-figure labels such as (a), (b), (c), (d), (A), (B), (C), (D), a), b), c), d), or similar alphabetical/numerical panel markers in the image.
2. For each identified sub-figure panel, provide:
   - "label": the lowercase letter label (e.g. "a", "b", "c", "d")
   - "desc": a brief scientific description of what that panel shows (e.g. "SEM image of the nanostructure", "XRD pattern", "CV curves at different scan rates")
3. If no sub-figure labels are found, try to identify visually distinct panels and assign labels starting from "a".
4. Return a JSON array of objects. Each object must have exactly two fields: "label" (string) and "desc" (string).
5. Order the results by label alphabetically.

Example output: [{"label":"a","desc":"SEM morphology of the catalyst"},{"label":"b","desc":"TEM image showing lattice fringes"}]`
            : `你是一名科研论文图片分析专家。请仔细分析这张科研组图（复合图/多面板图），识别其中所有的子图面板。

要求：
1. 寻找图片中的子图标签，如 (a), (b), (c), (d), (A), (B), (C), (D), a), b), c), d) 或类似的字母/数字面板标记。
2. 对每个识别到的子图面板，提供：
   - "label": 小写字母标签（如 "a", "b", "c", "d"）
   - "desc": 该子图内容的简短科学描述（如 "催化剂的SEM形貌图", "XRD衍射图谱", "不同扫描速率下的CV曲线"）
3. 如果未发现明确的子图标签，请尝试识别视觉上可区分的独立面板，并从 "a" 开始分配标签。
4. 返回一个 JSON 数组，每个元素必须包含 "label"（字符串）和 "desc"（字符串）两个字段。
5. 按标签字母顺序排列结果。

输出示例: [{"label":"a","desc":"催化剂的SEM形貌图"},{"label":"b","desc":"显示晶格条纹的TEM图像"}]`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } }, { text: prompt }],
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING, description: "Sub-figure label, e.g. a, b, c, d" },
                            desc: { type: Type.STRING, description: "Brief description of what this sub-figure shows" }
                        },
                        required: ["label", "desc"]
                    }
                },
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        return safeJsonParse(response.text || '[]', []);
    });
};

export const generateImageAnalysis = async (imageBase64: string, context: string, subFigures: any, lang: 'zh' | 'en', detailLevel: 'concise' | 'standard' | 'detailed' = 'standard') => {
    return callGeminiWithRetry(async (ai) => {
        const subFigInfo = Array.isArray(subFigures) && subFigures.length > 0
            ? `\n子图信息：${subFigures.map((f: any) => `(${f.label}) ${f.desc || ''}`).join('；')}`
            : '';

        const detailConfig = {
            concise: {
                enLength: '100-250 words, focusing only on the most critical observations',
                zhLength: '150-300字，仅聚焦最关键的观察结果',
                enDetail: 'Be concise and highlight only the most important features. Skip minor details.',
                zhDetail: '简明扼要，仅突出最重要的特征，省略次要细节。',
            },
            standard: {
                enLength: '200-400 words, balanced between conciseness and completeness',
                zhLength: '300-500字，兼顾简洁性与完整性',
                enDetail: 'Provide a balanced description covering key features and their significance.',
                zhDetail: '提供均衡的描述，涵盖关键特征及其科学意义。',
            },
            detailed: {
                enLength: '400-600 words, dense with scientific content',
                zhLength: '500-800字，内容密实，富含科学信息',
                enDetail: 'Provide comprehensive descriptions with quantitative details, trend analysis, and scientific significance for every observable feature.',
                zhDetail: '对每个可观察到的特征提供全面描述，包括定量细节、趋势分析和科学意义。',
            }
        }[detailLevel];

        const prompt = lang === 'en'
            ? `You are a senior researcher at a world-class institution writing for a top-tier journal (Nature, Science, JACS, Angewandte Chemie, Advanced Materials level).

Analyze this scientific figure and write a **Results and Discussion** style description that can be directly used in a manuscript.

Context: ${context}${subFigInfo}

**Strict Requirements:**
1. Write in rigorous academic English. Use precise scientific terminology throughout.
2. Structure: Write in flowing paragraph form. If there are labeled sub-figures (a, b, c...), describe each panel using the format "As shown in Figure X(a), ..." or "Figure X(b) presents...".
3. For each sub-figure or visual element, describe:
   - What the panel shows (technique/measurement type)
   - Key observable features and trends in the data
   - Quantitative details where visible (peak positions, values, scale bars)
   - Scientific significance of the observations
4. **DO NOT** use emotional language, exclamation marks, or subjective evaluations like "stunning", "impressive", "beautiful".
5. **DO NOT** write titles, headings, or bullet points. Use continuous academic paragraphs only.
6. **DO NOT** speculate wildly. Base descriptions strictly on what is visible in the figure.
7. Maintain a neutral, objective, and analytical tone throughout.
8. ${detailConfig.enDetail}
9. Total length: ${detailConfig.enLength}.

Example tone: "As illustrated in Figure 1(a), the scanning electron microscopy (SEM) image reveals a uniformly distributed hierarchical porous structure with an average pore diameter of approximately 200 nm. The high-resolution transmission electron microscopy (HRTEM) image in Figure 1(b) clearly shows lattice fringes with an interplanar spacing of 0.34 nm, corresponding to the (002) plane of graphitic carbon..."`
            : `你是一名世界顶级科研机构的资深研究者，正在为顶刊（Nature、Science、JACS、Angew、Adv. Mater. 级别）撰写论文。

分析这张科研图片，撰写一段**可直接用于论文 Results and Discussion 部分**的学术化图片描述。

背景信息：${context}${subFigInfo}

**严格要求：**
1. 使用严谨的学术中文（数值、化学式、专业术语可保留英文）。全文行文风格对标顶刊中文综述或中文学位论文正文。
2. 结构：以连贯的段落形式书写。如果有标记的子图 (a, b, c...)，使用"如图X(a)所示，……"或"图X(b)展示了……"的格式逐一描述。
3. 对每个子图或视觉元素，描述：
   - 该面板展示的内容（表征手段/测量类型）
   - 数据中可观察到的关键特征和趋势
   - 可见的定量细节（峰位、数值、标尺等）
   - 观察结果的科学意义
4. **禁止**使用感性语言、感叹号、主观评价性词汇（如"令人惊叹""极具美感""打动人心"等）。
5. **禁止**使用标题、小标题或项目符号列表。只使用连续的学术段落。
6. **禁止**过度推测。描述严格基于图片中可观察到的内容。
7. 全文保持客观、中性、分析性的学术基调。
8. ${detailConfig.zhDetail}
9. 总篇幅：${detailConfig.zhLength}。

参考基调示例："如图1(a)所示，扫描电子显微镜（SEM）图像揭示了均匀分布的分级多孔结构，平均孔径约为200 nm。图1(b)的高分辨透射电子显微镜（HRTEM）图像清晰显示了晶格条纹，层间距为0.34 nm，对应石墨碳的(002)晶面……"`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } }, { text: prompt }],
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 2048 } }
        });
        return response.text || "";
    });
};

export const generateMethodologyFromLogs = async (title: string, logs: ExperimentLog[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `撰写【Methodology】。节点: ${title}\n记录: ${JSON.stringify(logs.map(l => ({ content: l.content, params: l.parameters })))}`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    });
};

export const generateCaptionFromImage = async (desc: string, lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `生成专业图注。描述: "${desc}"`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    });
};

export const generateComparativeResults = async (logs: ExperimentLog[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `对比分析实验结果。数据: ${JSON.stringify(logs.map(l => ({ content: l.content, data: l.scientificData })))}`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 1024 } }
        });
        return response.text || "";
    });
};

export const generatePlanVsActualTable = async (title: string, logs: ExperimentLog[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `生成进度对比表: ${title}。\n数据: ${JSON.stringify(logs.slice(-5).map(l => ({ 标题: l.content, 数据: l.scientificData })))}`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    });
};

export const convertFlowchartToEmbodiment = async (flowchart: any[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `流程图转【具体实施方式】。流程: ${JSON.stringify(flowchart)}`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    });
};

export const generateManuscriptHighlights = async (sections: any[], lang: Language = 'zh') => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `提取 3 条 Highlights。内容: ${JSON.stringify(sections.map(s => ({ title: s.title, content: s.content.substring(0, 300) })))}`;
        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        });
        return safeJsonParse(response.text || '[]', []);
    });
};
