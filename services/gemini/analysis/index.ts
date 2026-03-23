// ═══ SciFlow Pro — AI 分析服务聚合入口 ═══
//
// 此目录从 analysis.ts 拆分而来，按领域组织：
//   audit.ts       — 视觉合规审计 + 理论描述符
//   experiment.ts  — 实验诊断 + 机理分析 + DOE + 动力学 + 样本矩阵
//   xrd.ts         — XRD 物相检索 + 深度分析 + 图注生成 + 物相演变 + 孔隙率分析
//   vision.ts      — 视觉/OCR 分析 + 风格提取 + 元数据探测
//   industry.ts    — 行业趋势 + 调研报告

export { TheoreticalDescriptors, runVisualComplianceAudit, generateVisualFixes } from './audit';
export { diagnoseExperimentLog, analyzeLogMechanism, analyzeMechanism, analyzeComparisonMatrix, diagnoseOutlierDeviation, analyzeSampleMatrix, generateContextualKineticsReport, runMechanismDebate, runRouteDebate, runLiteratureDebate } from './experiment';
export { searchXrdPhases, generateContextualXrdAnalysis, generatePostMatchXrdAnalysis, generateContextualPorosityAnalysis, generatePublicationCaption, analyzePhaseEvolution, analyzeMultiDatasetXrd } from './xrd';
export { recognizeLabNotebook, refineParticlesWithAI, generateContextualVisionReport, handleAiExtractPrompt, detectMetadata, extractChartStyleFromImage } from './vision';
export { searchGlobalTrends, summarizeIndustryTrend, generateIndustryResearchReport } from './industry';
export { searchMarketProducts, generateProductComparison, generateMarketProductReport, analyzeProductTechnology, generateTechEvolution, generateRDRecommendation, generateRouteDeepDive } from './market';
export { discoverChartTemplate } from './templateDiscovery';
