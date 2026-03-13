// ═══ SciFlow Pro — AI 分析: audit ═══

import { callGeminiWithRetry, extractJson, PRO_MODEL, SPEED_CONFIG } from "../core";
import { ResearchProject } from "../../../types";

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
            config: { ...SPEED_CONFIG, maxOutputTokens: 2048, responseMimeType: "application/json" }
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
 * Generate visual fixes for audit issues
 */
export const generateVisualFixes = async (project: ResearchProject, issues: any[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `提供视觉修复补丁。问题: ${JSON.stringify(issues)}。输出 JSON { "circularSummaryPatch", "optimizationSummary" }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
