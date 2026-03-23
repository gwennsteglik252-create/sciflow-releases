
import { Type } from "@google/genai";
import { ExperimentLog, ResearchProject, PlanType, UserProfile, WeeklyTask, ProjectPlan, MatrixParameter, DoeSession } from "../../types";
import { callGeminiWithRetry, extractJson, safeJsonParse, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";

/**
 * AI 从截图或文本输入生成里程碑节点
 * @param imageBase64 - 可选，截图的 base64 数据（不含前缀）
 * @param imageMimeType - 可选，图片 MIME 类型
 * @param textPrompt - 可选，额外的文字描述
 * @param projectContext - 可选，当前项目上下文
 */
export const generateMilestonesFromImageAI = async (
    imageBase64?: string,
    imageMimeType: string = 'image/png',
    textPrompt?: string,
    projectContext?: { title: string; description: string }
) => {
    return callGeminiWithRetry(async (ai) => {
        const contextStr = projectContext
            ? `课题标题: ${projectContext.title}\n课题描述: ${projectContext.description.substring(0, 800)}`
            : '';
        const textDesc = textPrompt?.trim() ? `\n\n用户补充描述: ${textPrompt.trim()}` : '';

        const prompt = `你是一名资深的科研规划专家。请根据以下输入（可能包含实验流程截图、手绘拓扑图、文字描述等），分析并规划一套完整的科研研究节点（里程碑）。

${contextStr}${textDesc}

要求：
1. 规划 4-7 个关键研究节点。
2. 如果输入是图片，请识别其中的实验步骤、阶段划分、节点关系等信息并据此生成节点。
3. 每个节点必须包含：标题(title)、科学假设(hypothesis)、预计完成日期(dueDate, 格式 YYYY-MM-DD，从今天起合理规划)。
4. 节点逻辑应具有严密的科学演进性。
5. 提供一段整体的研究逻辑框架解读(frameworkRationale)。

输出格式必须为严格的 JSON：
{
  "milestones": [
    { "title": "节点名称", "hypothesis": "科学假设说明", "dueDate": "2026-06-01" }
  ],
  "frameworkRationale": "研究逻辑深度解读..."
}`;

        const contents: any[] = [];
        if (imageBase64) {
            contents.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
        }
        contents.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        const text = response.text || '{"milestones":[], "frameworkRationale":""}';
        try {
            return JSON.parse(extractJson(text));
        } catch (e) {
            console.error("Failed to parse AI milestones from image output:", text);
            return { milestones: [], frameworkRationale: "AI 生成内容解析失败" };
        }
    });
};

/**
 * AI 自动生成里程碑
 */
export const generateMilestonesAI = async (project: ResearchProject) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深的科研规划专家。请根据以下课题信息，规划一套完整的科研研究节点（里程碑）。

课题标题: ${project.title}
课题描述: ${project.description.substring(0, 1500)}

要求：
1. 规划 4-7 个关键研究节点。
2. 每个节点必须包含：标题(title)、科学假设(hypothesis)、预计完成日期(dueDate, 格式 YYYY-MM-DD)。
3. 节点逻辑应具有严密的科学演进性。
4. 提供一段整体的研究逻辑框架解读(frameworkRationale)。

输出格式必须为严格的 JSON：
{
  "milestones": [
    { "title": "节点名称", "hypothesis": "科学假设说明", "dueDate": "2026-06-01" }
  ],
  "frameworkRationale": "研究逻辑深度解读..."
}`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        const text = response.text || '{"milestones":[], "frameworkRationale":""}';
        try {
            return JSON.parse(extractJson(text));
        } catch (e) {
            console.error("Failed to parse AI milestones output:", text);
            return { milestones: [], frameworkRationale: "AI 生成内容解析失败" };
        }
    });
};

/**
 * 生成周期计划（全面升级版）
 * 注入完整项目上下文：标题、描述、里程碑、最近日志、历史计划、待延续任务
 * 按 weekly / monthly / annual 三种类型生成差异化任务内容
 */
export const generateProjectPlanAI = async (project: ResearchProject, type: PlanType = 'weekly') => {
    return callGeminiWithRetry(async (ai) => {
        const now = new Date();
        const currentDateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

        // ── 里程碑摘要：最近3个，含假设和截止日期 ────────────────────
        const recentMilestones = (project.milestones || []).slice(-3).map(m => ({
            节点: m.title,
            假设: (m.hypothesis || '').substring(0, 100),
            截止: m.dueDate || '未定',
            完成率: `${(m as any).completionRate ?? 0}%`
        }));

        // ── 最近实验日志：最近8条，精炼字段 ─────────────────────────
        const recentLogs = (project.milestones || [])
            .flatMap(m => (m.logs || []).map((l: any) => ({ ...l, milestoneName: m.title })))
            .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
            .slice(0, 8)
            .map((l: any) => ({
                日期: l.date || '未知',
                节点: l.milestoneName,
                内容: (l.content || '').substring(0, 120),
                结果: (l.result || '').substring(0, 80)
            }));

        // ── 历史计划完成情况：最近2个已完成计划 ──────────────────────
        const historyPlans = (project.weeklyPlans || [])
            .filter((p: any) => p.status === 'completed' && p.type === type)
            .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
            .slice(0, 2)
            .map((p: any) => ({
                周期: `${p.startDate} ~ ${p.endDate}`,
                完成率: `${p.completionRate ?? 0}%`,
                未完成任务数: (p.tasks || []).filter((t: any) => t.status !== 'completed').length
            }));

        // ── 当前进行中的未完成任务（需要延续的工作） ────────────────
        const currentPlan = (project.weeklyPlans || []).find((p: any) => p.status === 'in-progress' && p.type === type);
        const pendingTasks = (currentPlan?.tasks || [])
            .filter((t: any) => t.status !== 'completed')
            .slice(0, 5)
            .map((t: any) => t.title);

        // ── 差异化指令（按计划类型） ─────────────────────────────────
        let typeInstruction = '';
        let taskCountGuide = '';
        let goalsGuide = '';

        if (type === 'weekly') {
            typeInstruction = `本次规划为本周（7天）的具体执行计划。任务必须是可在1-2个工作日内完成的具体操作。`;
            taskCountGuide = `生成 8-12 个任务，类型分布建议：
 - 实验操作类（约40%）：如"制备NiCo-LDH前驱体（共沉淀法，pH=10）""进行XRD表征验证"，必须含具体方法/样品/参数
 - 数据分析类（约20%）：如"整理上周电化学性能数据并绘制极化曲线对比图"
 - 文献阅读类（约20%）：如"精读2篇关于OER活性位点机理的文献并记录要点"
 - 项目推进类（约20%）：如"撰写实验报告第3节""准备组会汇报PPT"`;
            goalsGuide = `生成 2-4 个本周SMART目标，格式：「[动词] + [具体内容] + [量化指标或截止时间]」
 示例：「完成Ce掺杂NiFe-LDH的3组正交实验并获得初步OER性能数据」`;
        } else if (type === 'monthly') {
            typeInstruction = `本次规划为本月（约4周）的阶段性计划。任务应以"周"为粒度，描述每周的核心工作方向和预期产出。`;
            taskCountGuide = `生成 4-8 个月度任务（对应约4周的工作），每个任务代表1-2周的核心工作方向。
每个任务标题须以"【第X周】"标注时间段，例如：
 - 【第1-2周】完成催化剂合成参数优化（3组正交实验）
 - 【第3周】完成XRD/SEM表征并整理数据
 - 【第4周】撰写阶段性实验报告并进行组内汇报`;
            goalsGuide = `生成 2-3 个月度核心里程碑目标（可交付的阶段性成果），如"完成催化剂合成优化并获得初步电化学性能数据"`;
        } else {
            typeInstruction = `本次规划为年度战略路线图（Annual Plan）。任务应以"季度"为粒度，覆盖全年研究阶段的核心里程碑。`;
            taskCountGuide = `生成 8-12 个年度任务，必须按季度分组（Q1-Q4），每个季度2-3项核心任务：
 - 【Q1】基础研究与材料探索阶段（1-3月）
 - 【Q2】机理研究与性能优化阶段（4-6月）
 - 【Q3】集成验证与稳定性测试阶段（7-9月）
 - 【Q4】成果总结、论文投稿与专利申请（10-12月）`;
            goalsGuide = `生成 3-5 个年度战略目标，须包含论文发表计划（数量/目标期刊）、专利申请、重要会议参加等可量化学术成果`;
        }

        const prompt = `你是一名资深科研项目经理，擅长将科研课题分解为高质量的可执行任务清单。
当前日期：${currentDateStr}

## 课题信息
- **标题**：${project.title}
- **描述**：${(project.description || '').substring(0, 600)}

## 当前里程碑进展
${JSON.stringify(recentMilestones, null, 2)}

## 最近实验日志（最新8条）
${JSON.stringify(recentLogs, null, 2)}

## 历史计划完成情况
${historyPlans.length > 0 ? JSON.stringify(historyPlans, null, 2) : '暂无历史计划数据'}

## 当前待延续的未完成任务
${pendingTasks.length > 0 ? pendingTasks.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n') : '无（新建计划）'}

---

## 规划指令：${typeInstruction}

### 任务生成规范
${taskCountGuide}

**任务质量硬性要求**：
1. 每个任务标题必须以动词开头（制备/合成/测试/分析/撰写/阅读/整理/优化/验证/绘制等）
2. 实验类任务必须包含具体的方法、材料或参数信息，禁止使用"做实验""进行测试"等模糊表述
3. 任务应与当前里程碑进展强关联，体现研究的连续性和逻辑递进性
4. 若有未完成任务，应将其纳入新计划（可适当调整或拆解描述）
5. 禁止生成重复或高度相似的任务

### 目标（Goals）生成规范
${goalsGuide}

---

## 输出格式（严格JSON，不要有多余文字）
{
  "goals": ["SMART目标1", "SMART目标2"],
  "tasks": [
    {"title": "任务标题（动词开头，具体可执行，禁止模糊表述）"}
  ]
}`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"goals":[], "tasks":[]}'));
    });
};

/**
 * 任务智能指派（全面升级版）
 * 新增：专业领域匹配、当周剩余工作日感知、成员负载均衡、每日任务量上限约束
 */
export const assignTasksAI = async (project: ResearchProject, tasksWithContext: any[], teamMembers: UserProfile[], todayIdx: number = -1) => {
    return callGeminiWithRetry(async (ai) => {
        // ── 工作日上下文 ──────────────────────────────────────────
        const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        const workdayContext = todayIdx >= 0
            ? `今天是${dayNames[todayIdx]}（dayIdx=${todayIdx}），本周剩余可排期工作日：${dayNames.slice(todayIdx).map((d, i) => `${d}(${todayIdx + i})`).join('、')}`
            : `请为完整的一周（周一=0 至 周日=6）进行排期`;

        // ── 成员能力特征摘要 ──────────────────────────────────────
        const teamSummary = teamMembers.map(m => ({
            name: m.name,
            role: m.role || '研究员',
            expertise: m.expertise || [],
            workload: m.workload ?? 50
        }));

        // ── 任务摘要（含来源类型和关联实验计划） ────────────────────
        const taskSummary = tasksWithContext.map(t => ({
            taskId: t.taskId,
            title: t.title,
            sourceType: t.sourceType || 'manual',
            linkedExperiment: t.linkedPlan
                ? { title: t.linkedPlan.title, notes: (t.linkedPlan.notes || '').substring(0, 80) }
                : null
        }));

        const prompt = `你是一名科研团队的任务调度专家，负责将本周任务合理分配给相应研究人员并安排到具体工作日。

## 课题背景
课题名称：${project.title}

## 团队成员能力档案
${JSON.stringify(teamSummary, null, 2)}

## 需要排期的任务清单（共${taskSummary.length}项）
${JSON.stringify(taskSummary, null, 2)}

## 排期约束
${workdayContext}

---

## 分配原则（必须严格遵守）
1. **专业匹配优先**：实验操作类任务优先分配给有对应专业技能（expertise）的成员；数据分析类优先分配给数据处理能力强的成员；文献阅读可灵活分配
2. **负载均衡**：当前 workload > 80% 的成员应少分配；workload < 40% 的成员可多承担
3. **每日任务量合理**：同一成员同一天最多分配 2 个任务，避免单日超载
4. **工作日优先**：实验操作类任务优先排在周一(0)至周四(3)；整理/写作类可排周五(4)；周末（索引5、6）仅在必要时排期
5. **避免连续同类**：相邻两天不要安排完全相同类型的任务给同一人
6. **assignmentReason 必须具体**：须说明选择该成员和该日期的理由，如"李四有电化学测试专业背景，且周二当前负载仅35%"

## 输出格式（严格JSON，不要有多余文字）
{
  "assignments": [
    {
      "taskId": 0,
      "assignedDay": 0,
      "assignedTo": ["成员姓名"],
      "assignmentReason": "选择该成员和该日期的具体理由"
    }
  ],
  "summary": "本次排期的整体说明（负载均衡情况、注意事项等，50字以内）"
}`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"assignments":[]}'));
    });
};

// Fix: Add generateDOEMatrix export
/**
 * Generate a DOE Matrix based on notes and factors
 */
export const generateDOEMatrix = async (notes: string, factors: MatrixParameter[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深实验设计专家。请根据以下笔记和因子生成一个正交实验矩阵。
        
        笔记: "${notes}"
        现有因子: ${JSON.stringify(factors)}
        
        要求输出 JSON:
        {
          "matrix": [{"name": "因子名", "target": "单位", "range": "取值范围"}],
          "runs": [{"idx": 1, "params": {"因子名": "具体值"}}],
          "title": "矩阵标题",
          "scientificValidation": "安全与科学性评估预警"
        }`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

// Fix: Add parseProjectProposal export
/**
 * Parse a project proposal document (PDF/Docx) or raw text
 */
export const parseProjectProposal = async (base64DataOrText: string, mimeType: string, isText: boolean = false) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深科研管理专家。请深度解析这份项目计划书。
        要求提取：
        1. 建议标题 (suggestedTitle)
        2. 详细描述 (suggestedDescription)
        3. 考核指标 (targetMetrics: [{label, value, unit, weight, isHigherBetter}])
        4. 所需物资 (requiredMaterials: [{name, estimatedAmount}])
        5. 团队人员 (personnel: [{name, role, researchArea, expertise}])
        6. 主工艺路线 (masterRoute: {title, steps: [{step, action}], hypothesis})
        7. 参考文献列表 (bibliography: [{title, authors, year, source, url, abstract, category}])
        8. 研究里程碑/实验节点 (milestones: [{title, hypothesis, dueDate}]) —— 请依据计划书进度建议 3-5 个核心节点
        
        输出 JSON。`;

        const contents: any[] = [];
        if (isText) {
            contents.push({ text: `项目计划书内容如下：\n\n${base64DataOrText}` });
        } else {
            contents.push({ inlineData: { mimeType, data: base64DataOrText } });
        }
        contents.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

// Fix: Add suggestDOENextStep export
/**
 * Suggest next step for DOE session based on history
 * Enhanced: Returns comprehensive analysis report alongside recommendations
 */
/**
 * AI 分析推周计划任务，识别实验类任务并生成 PlannedExperiment 设计
 * 含完整的 matrix 因子和 runs 正交实验组
 */
export const generateExperimentFlowsFromTasks = async (
    projectTitle: string,
    tasks: string[],
    milestones: { id: string; title: string }[],
    recentLogs?: { content: string; parameters: string; description?: string; scientificData?: Record<string, number> }[],
    templates?: { name: string; description: string; parameters: { key: string; value: string; unit: string }[] }[],
    optimalConditions?: {
        insights: { title: string; summary: string; mechanism: string; params: string; metrics: Record<string, any> }[];
        groupAnalyses: string[];
        bestPerformers: { title: string; params: string; parameterList?: { key: string; value: string; unit: string }[]; metrics?: Record<string, any> }[];
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const logsContext = recentLogs && recentLogs.length > 0
            ? `\n\n最近实验记录（供参考已有参数范围与写作风格）：\n${recentLogs.slice(-8).map(l =>
                `- ${l.content}${l.parameters ? ` | 参数: ${l.parameters}` : ''}${l.description ? `\n  操作描述: ${l.description.substring(0, 300)}` : ''}${l.scientificData ? ` | 指标: ${JSON.stringify(l.scientificData)}` : ''}`
            ).join('\n')}`
            : '';

        const templatesContext = templates && templates.length > 0
            ? `\n\n用户已保存的实验模板（参考其写作风格和参数体系）：\n${templates.slice(0, 6).map(t =>
                `- 模板: ${t.name}\n  描述样例: ${t.description}\n  标准参数: ${t.parameters.map(p => `${p.key}=${p.value}${p.unit}`).join(', ')}`
            ).join('\n')}`
            : '';

        // ── 历史最优条件上下文构建 ──
        let optimalContext = '';
        if (optimalConditions) {
            const parts: string[] = [];

            // AI 洞察总结
            if (optimalConditions.insights.length > 0) {
                parts.push(`### AI 已总结的实验结论与最优条件\n${optimalConditions.insights.map(ins =>
                    `- **${ins.title}**\n  AI总结: ${ins.summary.substring(0, 400)}${ins.mechanism ? `\n  机理分析: ${ins.mechanism.substring(0, 300)}` : ''}${ins.params ? `\n  实验参数: ${ins.params}` : ''}${Object.keys(ins.metrics).length > 0 ? `\n  性能指标: ${JSON.stringify(ins.metrics)}` : ''}`
                ).join('\n')}`);
            }

            // 性能最优记录
            if (optimalConditions.bestPerformers.length > 0) {
                parts.push(`### 性能指标最优的实验记录\n${optimalConditions.bestPerformers.map(bp =>
                    `- **${bp.title}**\n  参数: ${bp.params}${bp.parameterList ? `\n  详细参数列表: ${bp.parameterList.map(p => `${p.key}=${p.value} ${p.unit}`).join(', ')}` : ''}${bp.metrics ? `\n  性能指标: ${JSON.stringify(bp.metrics)}` : ''}`
                ).join('\n')}`);
            }

            // 对照组分析报告
            if (optimalConditions.groupAnalyses.length > 0) {
                parts.push(`### 对照组对比分析报告\n${optimalConditions.groupAnalyses.map((ga, i) =>
                    `**报告 ${i + 1}**: ${ga.substring(0, 600)}`
                ).join('\n\n')}`);
            }

            if (parts.length > 0) {
                optimalContext = `\n\n## ⚠️ 历史实验最优条件（必须参考！）
以下是之前实验中 AI 分析总结的最优条件和关键发现。**新实验方案必须以这些较优条件为基础/起点**，在此基础上做增量优化或拓展研究，而不是从零开始设计。

${parts.join('\n\n')}`;
            }
        }

        const prompt = `你是一名资深的实验设计专家（DOE 正交设计）。以下是课题「${projectTitle}」下周计划中的任务列表：

${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

现有研究节点：
${milestones.map(m => `- ${m.title}`).join('\n')}
${logsContext}
${templatesContext}
${optimalContext}

请分析上述任务，**仅对涉及实验操作的任务**生成实验流设计。

## 判定规则
- ✅ 实验类：包含"制备""合成""沉积""测试""表征""优化…参数""梯度实验""浓度/温度/时间…调控""催化""电解""退火""煅烧"等实验操作关键词
- ❌ 非实验类：包含"阅读""文献""撰写""整理""分析已有数据""会议""讨论""汇报"等

## 核心原则：继承历史最优条件
- **若存在历史最优条件数据**：新实验的固定参数（非 matrix 变化因子）必须优先采用历史最优条件中的参数值（如最优温度、浓度、pH值、搅拌时间等），而非重新从文献值或默认值开始
- **matrix 变化因子**在最优条件基础上进行微调、拓展或进一步梯度细化
- 在 notes 中主动提及"基于前序实验中 XXX 条件表现最优，本实验以这些条件为基准进行 YYY 优化"
- **若无历史最优条件**：按照常规文献值或经验值设计

## 实验流设计要求
1. title：清晰的实验流标题
2. notes：注明实验目的、科学假设、安全注意事项
3. matrix：实验因子列表（2-5个关键因子）
   - name: 因子名称（如"电沉积电流密度"）
   - target: 单位（如"mA/cm²"）
   - range: 合理的取值范围（如"5-50"）
4. runs：2-6 组正交实验设计
   - idx: 序号 (从1开始)
   - label: 方案命名（如"低电流-长时间组" "高浓度梯度组"）
   - params: {因子名: 具体值}（值为字符串，仅含matrix变化因子）
   - sampleId: 样品标识，简短有意义的命名（如"NiFe-Ce3%""LDH-S01""Cu₂O-pH9"），体现该样品的组成或条件特征，同一实验流内不重复
   - fullParams: **该run的完整实验参数列表**（数组格式），这是最终录入实验记录的参数，必须非常详尽。
     必须包含以下所有类别的参数：
     a) **所有化学试剂的用量**（如NiCl₂·6H₂O: 641.8 mg, CeCl₃·7H₂O: 111.8 mg, FeCl₃·6H₂O: 240.6 mg）
     b) **所有溶液浓度**（如Ni²⁺浓度: 0.27 mol·L⁻¹, NaOH浓度: 4.0 mol·L⁻¹）
     c) **所有液体体积**（如去离子水体积: 10.0 mL, 碱液体积: 10.0 mL）
     d) **所有固体添加量**（如Na₂CO₃: 1.46 g）
     e) **所有操作时间**（如共沉淀搅拌: 2 h, Na₂CO₃搅拌: 1 h, 干燥时间: 12 h）
     f) **所有温度条件**（如干燥温度: 60 °C）
     g) **其他工艺参数**（如洗涤次数: 3 次, 搅拌速度: 500 rpm）
     h) matrix变化因子的具体值（这些参数也要包含在fullParams中）
     格式: [{"key": "参数名", "value": "具体值", "unit": "单位"}]
     ⚠️ 如果用户提供了模板，fullParams 必须至少包含模板的所有参数（使用该 run 的实际值），再补充 description 中提到的其他参数
     ⚠️ 最低要求: 10-25 个参数，覆盖 description 中所有可量化的数值
     ⚠️⚠️ **极其重要——参数联动规则**：
      - **掺杂/固溶极限类实验**：保持总金属摩尔量恒定。例如Ce掺杂NiFe-LDH时，Ce³⁺替代部分Fe³⁺（等价取代），即 Ce³⁺+Fe³⁺=恒定，Ni²⁺不变。需要根据化学计量重新计算各试剂用量。在 notes 中注明"采用恒总金属量方案"。
      - **其他实验（工艺优化、条件筛选等）**：除 matrix 变化因子外，其他参数保持模板原始值不变。
   - description: **每个run的详细实验操作步骤**，必须包含：
     a) 具体的合成/制备方法名称
     b) 精确的化学试剂名称、用量（mg/g/mL）、浓度（mol·L⁻¹）
     c) 操作步骤（如溶解、滴加、搅拌、过滤、洗涤、干燥等）
     d) 温度、时间等关键工艺参数
     e) 预期产物描述
     示例: "采用共沉淀法合成LDH。将 641.8 mg NiCl₂·6H₂O、111.8 mg CeCl₃·7H₂O 和 240.6 mg FeCl₃·6H₂O 溶解在10.0 mL去离子水中。随后逐滴加入10.0 mL含4.0 mol·L⁻¹ NaOH的碱性溶液。搅拌2小时后加入1.46g Na₂CO₃，搅拌1小时，过滤并用去离子水和乙醇各洗涤三次。60°C干燥12小时，得到棕黄色LDH。"
      ⚠️ **同一实验流内一致性**：同一 experiments 条目下的所有 run 的 description 必须使用**完全相同的句式模板**，仅替换具体参数数值（如试剂用量、浓度、pH值等）。禁止在不同 run 之间改变叙述顺序、用词风格或句子结构。先写好第一个 run 的 description，然后其他 run 只做数值替换。
5. sourceTaskIndex：对应的任务序号（0-indexed）

## 输出 JSON（严格遵守）
{
  "experiments": [
    {
      "title": "实验流标题",
      "notes": "实验目的、假设、安全注意事项（3-5句话）",
      "matrix": [
        {"name": "因子名", "target": "单位", "range": "取值范围"}
      ],
      "runs": [
        {"idx": 1, "label": "方案标签", "sampleId": "NiFe-Ce3%", "params": {"因子名": "具体值"}, "fullParams": [{"key": "NiCl₂·6H₂O用量", "value": "641.8", "unit": "mg"}, {"key": "CeCl₃·7H₂O用量", "value": "111.8", "unit": "mg"}, {"key": "NaOH浓度", "value": "4.0", "unit": "mol·L⁻¹"}, {"key": "搅拌时间", "value": "2", "unit": "h"}, {"key": "干燥温度", "value": "60", "unit": "°C"}], "description": "详细的实验操作步骤（150-400字）"}
      ],
      "sourceTaskIndex": 0
    }
  ],
  "skippedTasks": [
    {"index": 1, "reason": "非实验类任务：文献阅读"}
  ]
}

注意：
- experiments 仅包含实验类任务
- 如果所有任务都不是实验类，experiments 为空数组
- runs 中的 params 的 key 必须与 matrix 中的 name 完全一致
- runs 应体现正交设计思想：控制变量、梯度探索
- 参数值必须在 range 范围内且科学合理
- **description 必须针对每个 run 单独撰写**，体现该 run 的具体参数值（不要用占位符），参考用户已有模板的写作风格
- 如果用户有相关模板，优先使用模板的描述格式并替换为该 run 的具体参数
- **fullParams 是最关键的字段**：必须列出该实验的所有可量化参数（10-25个），做到与 description 完全对应
- fullParams 中 description 提到的每一个数值都应该有对应条目（药品用量、浓度、体积、温度、时间等）
- 不同 run 之间，变化因子对应的参数值应不同，固定参数保持一致
- 全程使用中文`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        console.log('[generateExperimentFlows] AI 原始返回:', response.text?.substring(0, 200));
        const parsed = safeJsonParse(response.text || '{}', { experiments: [], skippedTasks: [] });
        console.log('[generateExperimentFlows] 解析结果:', {
            experiments: parsed.experiments?.length ?? 0,
            skippedTasks: parsed.skippedTasks?.length ?? 0
        });
        return {
            experiments: Array.isArray(parsed.experiments) ? parsed.experiments : [],
            skippedTasks: Array.isArray(parsed.skippedTasks) ? parsed.skippedTasks : []
        };
    });
};

export const suggestDOENextStep = async (session: DoeSession) => {
    return callGeminiWithRetry(async (ai) => {
        const factorInfo = session.factors?.map(f => `${f.name}(${f.unit}, 范围:${f.min}-${f.max})`).join(', ') || '未指定';
        const responseInfo = session.responses?.map(r => `${r.name}(${r.unit}, 目标:${r.goal}, 权重:${r.weight})`).join(', ') || '未指定';

        const prompt = `你是一名资深 DOE（实验设计）推演专家和数据分析科学家。基于当前的实验历史数据，进行全面的多维分析并生成优化方案。

## 背景信息
- 工艺描述: ${session.processDescription || '未提供'}
- 实验因子: ${factorInfo}
- 响应指标: ${responseInfo}
- 历史实验数据 (共${session.history?.length || 0}组): ${JSON.stringify(session.history)}

## 输出要求
请以严格 JSON 格式返回以下完整结构：

{
  "recommendations": [
    {
      "label": "方案标签, 如'激进优化点 (Aggressive)'",
      "params": { "因子名": 数值, ... },
      "expectedOutcome": "预期结果描述",
      "confidenceScore": 0-100的置信度,
      "predictedValue": 预测响应值(数字),
      "ciLower": 95%置信区间下界(数字),
      "ciUpper": 95%置信区间上界(数字)
    }
  ],
  "reasoning": "核心推演逻辑总结(1-3句)",
  "report": {
    "analysisSummary": "综合分析摘要：对整体实验数据和当前工艺状态的全面评估(200-400字)，包括数据质量评价、模型拟合度、整体趋势判断",
    "factorSensitivity": [
      {
        "factor": "因子名称",
        "importance": "high/medium/low",
        "effect": "正向/负向/非线性",
        "description": "该因子对响应的影响机理描述(1-2句)",
        "optimalRange": "推荐最优范围",
        "currentCoverage": 当前实验覆盖该因子范围的百分比(0-100)
      }
    ],
    "interactions": [
      {
        "factors": ["因子A", "因子B"],
        "type": "协同/拮抗/独立",
        "strength": "strong/moderate/weak",
        "description": "交互作用描述(1-2句)"
      }
    ],
    "optimizationInsights": [
      "洞察1: 关于优化方向的具体发现...",
      "洞察2: ...",
      "洞察3: ..."
    ],
    "processWindow": {
      "feasibilityScore": 0-100,
      "description": "当前工艺窗口的可行性评估(1-3句)",
      "constraints": ["约束条件1", "约束条件2"]
    },
    "riskWarnings": [
      {
        "level": "high/medium/low",
        "title": "风险标题",
        "description": "风险描述和建议(1-2句)"
      }
    ],
    "nextSteps": [
      "建议1: 下一步实验方向...",
      "建议2: ...",
      "建议3: ..."
    ],
    "dataQuality": {
      "totalExperiments": ${session.history?.length || 0},
      "coverageScore": 0-100,
      "balanceScore": 0-100,
      "suggestion": "关于数据补充的建议(1句)"
    }
  },
  "diagnostics": []
}

## 注意
1. recommendations 至少包含3个差异化方案（激进/稳健/探索）
2. report 中的每个字段都必须填写，不要留空
3. factorSensitivity 应涵盖所有实验因子
4. 所有文字使用中文
5. 数值精确到小数点后1位
6. 分析要基于实际数据，不要编造
7. 禁止使用任何 LaTeX 语法（如 $...$ 或 \\(...\\)），所有公式和符号用纯文本表示（如 R²、2³、±）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
