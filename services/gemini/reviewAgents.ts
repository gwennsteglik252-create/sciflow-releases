
import { Literature, ReviewConfig, ReviewOutlineNode, AgentReport, AgentIssue, MultiAgentRevisionRound, ReviewAgentRole } from "../../types";
import { callGeminiWithRetry, safeJsonParse, PRO_MODEL, FAST_MODEL, SPEED_CONFIG } from "./core";
import { reviseReviewSection, AuditIssue } from "./review";

type Language = 'zh' | 'en';

// ═══════════════════════════════════════════════════════════════════
// Agent 权重配置
// ═══════════════════════════════════════════════════════════════════

const AGENT_WEIGHTS: Record<ReviewAgentRole, number> = {
    editor: 0.30,
    writer: 0.00,   // Writer 不参与评审评分
    critic: 0.40,
    fact_checker: 0.30
};


// ═══════════════════════════════════════════════════════════════════
// Agent 1: Editor Agent — 全局叙事总监
// ═══════════════════════════════════════════════════════════════════

export const runEditorAgent = async (
    fullContent: string,
    config: ReviewConfig,
    language: Language = 'zh'
): Promise<AgentReport> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一位顶刊综述的 **责任编辑（Managing Editor）**，专注于全文的叙事品质和结构完整性。
你不关心具体的科学事实（那是审稿人和事实核查员的工作），你只关注：

## 你的职责维度

### 1. 叙事连贯性 (narrative)
- 全文是否有一条清晰的"故事线"从引言贯穿到结论？
- 章节之间的过渡是否自然？是否存在突兀的跳跃？
- 结论是否回应了引言中提出的问题？

### 2. 术语一致性 (terminology)
- 同一概念在全文中是否使用了统一的术语？
- 缩写在首次出现时是否有全称定义？
- 英文术语是否拼写一致（如 electrocatalysis vs electro-catalysis）？

### 3. 结构合理性 (structure)
- 各章节字数分配是否合理（引言/结论 10-15%，主体 70-80%）？
- 是否有章节过于臃肿或过于单薄？
- 段落长度是否均匀？是否有超长无断段？

---

【综述主题】: ${config.topic}
【综述全文】:
${fullContent.substring(0, 25000)}

---

请输出严格 JSON：
{
  "score": 0-100,
  "issues": [
    {
      "agentRole": "editor",
      "severity": "critical" | "moderate" | "minor",
      "category": "narrative" | "terminology" | "structure",
      "sectionTitle": "问题所在章节标题",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "summary": "一段话总结编辑评审结论"
}

评分标准：
- 90-100: 叙事流畅、术语统一、结构完美
- 70-89: 有少量叙事断裂或术语不统一
- 50-69: 存在明显的结构问题
- <50: 全文缺乏连贯性，需要大幅重组`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });

        const result = safeJsonParse(response.text || '{}', {
            score: 50,
            issues: [],
            summary: 'Editor Agent 解析失败'
        });

        return {
            role: 'editor' as ReviewAgentRole,
            score: Number(result.score) || 50,
            issues: Array.isArray(result.issues) ? result.issues.map((i: any) => ({
                agentRole: 'editor' as ReviewAgentRole,
                severity: ['critical', 'moderate', 'minor'].includes(i.severity) ? i.severity : 'moderate',
                category: ['narrative', 'terminology', 'structure'].includes(i.category) ? i.category : 'narrative',
                sectionTitle: i.sectionTitle || '',
                description: i.description || '',
                suggestion: i.suggestion || ''
            })) : [],
            summary: result.summary || '',
            timestamp: new Date().toISOString()
        };
    });
};


// ═══════════════════════════════════════════════════════════════════
// Agent 2: Critic Agent — 严苛审稿人
// ═══════════════════════════════════════════════════════════════════

export const runCriticAgent = async (
    fullContent: string,
    config: ReviewConfig,
    language: Language = 'zh'
): Promise<AgentReport> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是 Nature Reviews / Chemical Society Reviews 的 **Reviewer #2（以严苛著称的审稿人）**。
你的工作是对综述稿件进行学术质量的全面评审。

## 你的评审维度

### 1. 逻辑严密性 (logic)
- 论证链是否完整？因果关系是否成立？
- 是否存在过度概括或缺乏证据的结论？
- 比较分析是否公平、有标准？

### 2. 覆盖度 (coverage)
- 综述是否遗漏了该领域的重要研究方向？
- 各子主题的讨论深度是否均衡？
- 是否过度聚焦于某一课题组的工作？

### 3. 方法论讨论 (methodology)
- 是否充分讨论了不同研究方法的优劣？
- 实验条件的对比是否系统化？
- 是否指出了现有研究的方法论局限？

### 4. 学术价值与新颖性 (novelty)
- 综述是否提供了超越简单文献罗列的 **原创性观点**？
- "挑战与展望"部分是否具体且有洞察力？（而非泛泛的"需要进一步研究"）
- 是否建立了不同研究之间的新联系？

---

【综述主题】: ${config.topic}
【综述全文】:
${fullContent.substring(0, 25000)}

---

请输出严格 JSON：
{
  "score": 0-100,
  "issues": [
    {
      "agentRole": "critic",
      "severity": "critical" | "moderate" | "minor",
      "category": "logic" | "coverage" | "methodology" | "novelty",
      "sectionTitle": "问题所在章节标题",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "summary": "一段话总结审稿意见（模拟审稿人口吻）"
}

你的评审风格严苛但建设性。评分标准：
- 90-100: Accept as is（极罕见）
- 70-89: Minor revision
- 50-69: Major revision
- <50: Reject`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });

        const result = safeJsonParse(response.text || '{}', {
            score: 50,
            issues: [],
            summary: 'Critic Agent 解析失败'
        });

        return {
            role: 'critic' as ReviewAgentRole,
            score: Number(result.score) || 50,
            issues: Array.isArray(result.issues) ? result.issues.map((i: any) => ({
                agentRole: 'critic' as ReviewAgentRole,
                severity: ['critical', 'moderate', 'minor'].includes(i.severity) ? i.severity : 'moderate',
                category: ['logic', 'coverage', 'methodology', 'novelty'].includes(i.category) ? i.category : 'logic',
                sectionTitle: i.sectionTitle || '',
                description: i.description || '',
                suggestion: i.suggestion || ''
            })) : [],
            summary: result.summary || '',
            timestamp: new Date().toISOString()
        };
    });
};


// ═══════════════════════════════════════════════════════════════════
// Agent 3: Fact-Checker Agent — 引文验核员
// ═══════════════════════════════════════════════════════════════════

export const runFactCheckerAgent = async (
    fullContent: string,
    config: ReviewConfig,
    literatures: Literature[],
    language: Language = 'zh'
): Promise<AgentReport> => {
    return callGeminiWithRetry(async (ai) => {
        // 构建引文映射（供 AI 交叉核验）
        const litMap = literatures.slice(0, 40).map(lit => {
            const abstract = (lit.abstract || '').substring(0, 200);
            const perf = (lit as any).performance;
            const perfStr = Array.isArray(perf) && perf.length > 0
                ? `\n  性能: ${perf.map((p: any) => `${p.label}: ${p.value}`).join(', ')}`
                : '';
            return `[Ref:${lit.id}] ${lit.title} (${lit.authors?.[0] || ''}, ${lit.year})\n  摘要: ${abstract}${perfStr}`;
        }).join('\n\n');

        const prompt = `你是一位 **事实核查专家（Fact-Checker）**，专门负责学术综述的引文准确性和事实可靠性验证。
你的工作极其重要——引用错误是综述最严重的学术不端之一。

## 你的核查维度

### 1. 引用缺失 (citation_missing)
- 重要的事实陈述、数据引用、结论性断言是否都有引文支撑？
- 每个包含数据的段落是否至少有一处引用？

### 2. 引用不匹配 (citation_mismatch)
- [Ref:xxx] 标签引用的文献，其实际内容是否支持文中的论述？
- 是否存在张冠李戴（把 A 论文的结论归给 B 论文）？

### 3. 幻觉检测 (hallucination)
- 文中描述的实验结果、数据、性能指标是否与原文一致？
- 是否存在 AI 编造的数据或不存在于任何文献中的声称？

### 4. 无源声称 (uncited_claim)
- 是否有断言性句子缺少引用支撑？
- 特别关注包含"已证明"、"研究表明"、"据报道"等措辞但缺少引文的段落

---

【综述主题】: ${config.topic}

【综述全文】:
${fullContent.substring(0, 20000)}

【参考文献信息库（用于交叉核验）】:
${litMap}

---

请输出严格 JSON：
{
  "score": 0-100,
  "issues": [
    {
      "agentRole": "fact_checker",
      "severity": "critical" | "moderate" | "minor",
      "category": "citation_missing" | "citation_mismatch" | "hallucination" | "uncited_claim",
      "sectionTitle": "问题所在章节标题",
      "description": "问题描述",
      "suggestion": "修改建议",
      "evidence": "引用原文或数据证据（如有）"
    }
  ],
  "summary": "一段话总结引文核查结论"
}

评分标准：
- 90-100: 引用严谨，无幻觉
- 70-89: 少量引用缺失
- 50-69: 多处引用问题
- <50: 存在严重幻觉或大量引用错误`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });

        const result = safeJsonParse(response.text || '{}', {
            score: 50,
            issues: [],
            summary: 'Fact-Checker Agent 解析失败'
        });

        return {
            role: 'fact_checker' as ReviewAgentRole,
            score: Number(result.score) || 50,
            issues: Array.isArray(result.issues) ? result.issues.map((i: any) => ({
                agentRole: 'fact_checker' as ReviewAgentRole,
                severity: ['critical', 'moderate', 'minor'].includes(i.severity) ? i.severity : 'moderate',
                category: ['citation_missing', 'citation_mismatch', 'hallucination', 'uncited_claim'].includes(i.category) ? i.category : 'citation_missing',
                sectionTitle: i.sectionTitle || '',
                description: i.description || '',
                suggestion: i.suggestion || '',
                evidence: i.evidence || undefined
            })) : [],
            summary: result.summary || '',
            timestamp: new Date().toISOString()
        };
    });
};


// ═══════════════════════════════════════════════════════════════════
// 协调器: 多 Agent 协作修订循环
// ═══════════════════════════════════════════════════════════════════

export interface MultiAgentOrchestrationResult {
    history: MultiAgentRevisionRound[];
    finalReports: Record<ReviewAgentRole, AgentReport>;
    finalScore: number;
    totalRevisedSections: string[];
    /** 修订后的章节内容副本 */
    updatedSections: Record<string, string>;
}

export const orchestrateMultiAgentRevision = async (
    config: ReviewConfig,
    outline: ReviewOutlineNode[],
    generatedSections: Record<string, string>,
    literatures: Literature[],
    maxRounds: number = 3,
    passThreshold: number = 80,
    onProgress?: (msg: string, phase: 'audit' | 'revise', round: number, agentRole?: ReviewAgentRole) => void,
    abortSignal?: { current: boolean }
): Promise<MultiAgentOrchestrationResult> => {

    const flattenOutline = (nodes: ReviewOutlineNode[]): ReviewOutlineNode[] => {
        const flat: ReviewOutlineNode[] = [];
        for (const node of nodes) {
            flat.push(node);
            if (node.children?.length) flat.push(...flattenOutline(node.children));
        }
        return flat;
    };

    const sections = flattenOutline(outline);
    const history: MultiAgentRevisionRound[] = [];
    // 工作副本
    const workingSections = { ...generatedSections };
    let finalReports: Record<string, AgentReport> = {};

    for (let round = 1; round <= maxRounds; round++) {
        if (abortSignal?.current) break;

        // ─── Step 1: 构建全文 ───
        const fullContent = sections
            .map(n => `## ${n.title}\n\n${workingSections[n.id] || ''}`)
            .join('\n\n');

        // ─── Step 2: 并行调用三个 Agent ───
        onProgress?.(`第 ${round} 轮: 三个 Agent 并行评审中...`, 'audit', round);

        const [editorReport, criticReport, factCheckReport] = await Promise.all([
            runEditorAgent(fullContent, config, config.language).catch(err => ({
                role: 'editor' as ReviewAgentRole,
                score: 60,
                issues: [],
                summary: `Editor Agent 调用失败: ${err.message}`,
                timestamp: new Date().toISOString()
            })),
            runCriticAgent(fullContent, config, config.language).catch(err => ({
                role: 'critic' as ReviewAgentRole,
                score: 60,
                issues: [],
                summary: `Critic Agent 调用失败: ${err.message}`,
                timestamp: new Date().toISOString()
            })),
            runFactCheckerAgent(fullContent, config, literatures, config.language).catch(err => ({
                role: 'fact_checker' as ReviewAgentRole,
                score: 60,
                issues: [],
                summary: `Fact-Checker Agent 调用失败: ${err.message}`,
                timestamp: new Date().toISOString()
            }))
        ]);

        if (abortSignal?.current) break;

        const reports = [editorReport, criticReport, factCheckReport];
        finalReports = {
            editor: editorReport,
            critic: criticReport,
            fact_checker: factCheckReport
        };

        // ─── Step 3: 计算加权共识分 ───
        const consensusScore = Math.round(
            editorReport.score * AGENT_WEIGHTS.editor +
            criticReport.score * AGENT_WEIGHTS.critic +
            factCheckReport.score * AGENT_WEIGHTS.fact_checker
        );

        const allIssues = reports.flatMap(r => r.issues);
        const criticalCount = allIssues.filter(i => i.severity === 'critical').length;

        onProgress?.(
            `第 ${round} 轮评审完成 — 共识分: ${consensusScore} | Editor ${editorReport.score} | Critic ${criticReport.score} | Fact-Checker ${factCheckReport.score} | 🔴 ${criticalCount} 严重`,
            'audit', round
        );

        // ─── Step 4: 判断终止 ───
        if (consensusScore >= passThreshold && criticalCount === 0) {
            history.push({
                round,
                agentReports: reports,
                consensusScore,
                revisedSections: [],
                timestamp: new Date().toISOString()
            });
            onProgress?.(
                `✅ 共识分 ${consensusScore} ≥ ${passThreshold}，无严重问题，修订循环终止`,
                'audit', round
            );
            break;
        }

        // ─── Step 5: 汇聚问题，按章节分组 ───
        const issuesBySectionTitle = new Map<string, AuditIssue[]>();
        for (const issue of allIssues) {
            if (issue.severity === 'critical' || issue.severity === 'moderate') {
                const converted: AuditIssue = {
                    severity: issue.severity,
                    category: issue.category as any,
                    sectionTitle: issue.sectionTitle,
                    description: `[${issue.agentRole.toUpperCase()}] ${issue.description}`,
                    suggestion: issue.suggestion
                };
                const existing = issuesBySectionTitle.get(issue.sectionTitle) || [];
                existing.push(converted);
                issuesBySectionTitle.set(issue.sectionTitle, existing);
            }
        }

        // ─── Step 6: 定向修订 ───
        const revisedSectionTitles: string[] = [];
        let reviseIdx = 0;
        const totalToRevise = issuesBySectionTitle.size;

        for (const [sectionTitle, sectionIssues] of issuesBySectionTitle) {
            if (abortSignal?.current) break;

            const node = sections.find(n => n.title === sectionTitle);
            if (!node || !workingSections[node.id]) continue;

            reviseIdx++;
            onProgress?.(
                `第 ${round} 轮修订 (${reviseIdx}/${totalToRevise}): ${sectionTitle}`,
                'revise', round
            );

            try {
                const revisedContent = await reviseReviewSection(
                    config,
                    sectionTitle,
                    workingSections[node.id],
                    sectionIssues,
                    literatures
                );
                workingSections[node.id] = revisedContent;
                revisedSectionTitles.push(sectionTitle);
            } catch (reviseErr: any) {
                console.warn(`[MultiAgent] 修订失败: ${sectionTitle}`, reviseErr);
            }
        }

        history.push({
            round,
            agentReports: reports,
            consensusScore,
            revisedSections: revisedSectionTitles,
            timestamp: new Date().toISOString()
        });
    }

    return {
        history,
        finalReports: finalReports as Record<ReviewAgentRole, AgentReport>,
        finalScore: history.length > 0 ? history[history.length - 1].consensusScore : 0,
        totalRevisedSections: [...new Set(history.flatMap(h => h.revisedSections))],
        updatedSections: workingSections
    };
};
