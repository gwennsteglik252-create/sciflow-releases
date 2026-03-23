
import { useState, useMemo, useEffect } from 'react';
import { ExperimentLog, ResearchProject } from '../types';
import { generateScientificPPT } from '../services/gemini';
import { SCIENCE_REGEX, extractMetric } from '../utils/scienceRegex';
import { generateVbaScript } from '../constants/vbaTemplates';

export interface SlideChartSeries {
  name: string;
  data: { date: string; value: number }[];
}

export interface Slide {
  pageNumber: number;
  title: string;
  subTitle?: string;
  points: string[];
  mermaid?: string;
  tableData?: string[][];
  nextSteps?: string[];
  chartData?: SlideChartSeries[];
  successRate?: number;
}

export type ReportLevel = 'weekly' | 'monthly' | 'final' | 'seminar' | 'defense';

const REPORT_LABEL: Record<ReportLevel, string> = {
  weekly: '周报',
  monthly: '月报',
  final: '结题报告',
  seminar: '组会汇报',
  defense: '答辩报告'
};

const REPORT_TARGET_PAGES: Record<ReportLevel, number> = {
  weekly: 8,
  monthly: 10,
  final: 12,
  seminar: 6,
  defense: 10
};

export const parseLogTime = (ts: string) => {
  if (!ts) return 0;
  const raw = String(ts).trim();
  const ampmNormalized = raw.replace(/上午/g, 'AM').replace(/下午/g, 'PM');
  const candidates = [
    raw,
    ampmNormalized,
    raw.replace(/,\s*/g, ' '),
    ampmNormalized.replace(/,\s*/g, ' '),
    raw.replace(/\//g, '-'),
    ampmNormalized.replace(/\//g, '-'),
    raw.replace(/,\s*/g, ' ').replace(/\//g, '-'),
    ampmNormalized.replace(/,\s*/g, ' ').replace(/\//g, '-')
  ];

  for (const item of candidates) {
    const d = new Date(item);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // fallback: extract date part manually (YYYY/MM/DD or MM/DD/YYYY)
  const ymd = raw.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (ymd) {
    const y = Number(ymd[1]);
    const m = Number(ymd[2]) - 1;
    const d = Number(ymd[3]);
    return new Date(y, m, d, 12, 0, 0).getTime();
  }
  const mdy = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (mdy) {
    const m = Number(mdy[1]) - 1;
    const d = Number(mdy[2]);
    const y = Number(mdy[3]);
    return new Date(y, m, d, 12, 0, 0).getTime();
  }

  return 0;
};

const formatDate = (ts: string) => {
  const t = parseLogTime(ts);
  if (!t) return ts.split(' ')[0] || ts;
  return new Date(t).toISOString().slice(0, 10);
};

const summarizeText = (text: string, max = 36) => {
  if (!text) return '暂无记录';
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max)}...`;
};

const safeMetric = (v: number | null | undefined, digits = 3) => {
  if (v === null || v === undefined || Number.isNaN(v)) return 'N/A';
  return String(Number(v.toFixed(digits)));
};

const average = (arr: number[]) => {
  if (!arr.length) return null;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
};

export const buildNumericMetricMap = (logs: ExperimentLog[]) => {
  const map = new Map<string, number[]>();
  logs.forEach(log => {
    if (!log.scientificData) return;
    Object.entries(log.scientificData).forEach(([key, val]) => {
      if (typeof val !== 'number' || !Number.isFinite(val)) return;
      const arr = map.get(key) || [];
      arr.push(val);
      map.set(key, arr);
    });
  });
  return map;
};

const buildEvidenceTable = (logs: ExperimentLog[]): string[][] => {
  const header = ['日期', '实验编号', '结论', '$E_{1/2}$ (V)', 'j (mA)', '关键备注'];
  const rows = logs.slice(-8).map(log => {
    const mixText = `${log.content} ${log.parameters}`;
    const e12 = extractMetric(mixText, SCIENCE_REGEX.E12);
    const j = extractMetric(mixText, SCIENCE_REGEX.j);
    const result = log.result === 'success' ? '成功' : log.result === 'neutral' ? '中性' : log.result === 'failure' ? '失败' : '观察';
    return [
      formatDate(log.timestamp),
      log.id.slice(0, 8),
      result,
      e12,
      j,
      summarizeText(log.description || log.content, 20)
    ];
  });
  return [header, ...rows];
};

const buildRoadmapTable = (project: ResearchProject): string[][] => {
  const header = ['来源', '路线/动作', '关键参数', '预期收益'];
  const fromProposals = (project.proposals || []).slice(0, 4).map(p => ([
    summarizeText(p.literatureTitle, 18),
    summarizeText(p.processChanges, 26),
    summarizeText((p.optimizedParameters || []).map(it => `${it.key}:${it.value}`).join('; '), 24),
    summarizeText((p.controlParameters || []).map(it => it.reason).join('; ') || p.scientificHypothesis, 24)
  ]));
  if (fromProposals.length) return [header, ...fromProposals];

  return [
    header,
    ['课题现状', '核心实验路线优化', '温度/时间/负载量', '提升重复性与稳定性'],
    ['里程碑推进', '关键样品横向对比', '电化学性能窗口', '筛选可产业化配方'],
    ['转化导向', '工艺放大验证', '批次一致性', '形成可交付工艺包']
  ];
};

const buildStructuredSlides = (
  project: ResearchProject,
  reportLevel: ReportLevel,
  logs: ExperimentLog[],
  aiSeedSlides: Slide[]
): Slide[] => {
  const sortedLogs = [...logs].sort((a, b) => parseLogTime(a.timestamp) - parseLogTime(b.timestamp));
  const success = sortedLogs.filter(l => l.result === 'success');
  const neutral = sortedLogs.filter(l => l.result === 'neutral');
  const failed = sortedLogs.filter(l => l.result === 'failure');
  const observed = sortedLogs.filter(l => l.result === 'observation');
  const successRate = sortedLogs.length ? Math.round((success.length / sortedLogs.length) * 100) : 0;

  const aiHighlights = aiSeedSlides
    .flatMap(s => s.points || [])
    .map(p => p.trim())
    .filter(Boolean)
    .slice(0, 4);

  const metricMap = buildNumericMetricMap(sortedLogs);
  const topMetrics = [...metricMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([name, values]) => {
      const mid = Math.max(1, Math.floor(values.length / 2));
      const firstAvg = average(values.slice(0, mid));
      const secondAvg = average(values.slice(mid));
      const delta = (secondAvg ?? 0) - (firstAvg ?? 0);
      return { name, values, delta };
    });

  // ▶ 提取同步模块性能雷达的表征内容
  const syncedModuleSummaryLines: string[] = [];
  const syncedModuleMetricLines: string[] = [];
  sortedLogs.forEach(log => {
    const deepRaw = (log as any).deepAnalysis;
    if (deepRaw && Array.isArray(deepRaw.syncedModules)) {
      deepRaw.syncedModules.filter(Boolean).forEach((sm: any) => {
        const label = sm.moduleLabel || sm.mode || '未知模块';
        const mode = sm.mode ? `(${sm.mode})` : '';
        // 收集指标摘要
        if (sm.metrics && typeof sm.metrics === 'object') {
          const topEntries = Object.entries(sm.metrics).slice(0, 5);
          if (topEntries.length > 0) {
            const metricsStr = topEntries.map(([k, v]) => `${k}=${v}`).join('；');
            syncedModuleMetricLines.push(`${label}${mode}: ${metricsStr}`);
          }
        }
        // 收集分析摘要
        if (sm.summary) {
          syncedModuleSummaryLines.push(`${label}: ${summarizeText(sm.summary, 80)}`);
        }
      });
    }
    // 提取组级别的 groupSyncedModules（组表征同步）
    const groupModulesRaw = (log as any).groupSyncedModules;
    if (Array.isArray(groupModulesRaw)) {
      groupModulesRaw.filter(Boolean).forEach((sm: any) => {
        const label = sm.moduleLabel || sm.mode || '未知模块';
        const mode = sm.mode ? `(${sm.mode})` : '';
        if (sm.metrics && typeof sm.metrics === 'object') {
          const topEntries = Object.entries(sm.metrics).slice(0, 5);
          if (topEntries.length > 0) {
            const metricsStr = topEntries.map(([k, v]) => `${k}=${v}`).join('；');
            syncedModuleMetricLines.push(`[组]${label}${mode}: ${metricsStr}`);
          }
        }
        if (sm.summary) {
          syncedModuleSummaryLines.push(`[组]${label}: ${summarizeText(sm.summary, 80)}`);
        }
      });
    }
  });

  const primaryMetricLine = topMetrics.length
    ? topMetrics.map(m => `${m.name}: 平均 ${safeMetric(average(m.values))}，区间 ${safeMetric(Math.min(...m.values))}~${safeMetric(Math.max(...m.values))}`).slice(0, 2)
    : ['当前日志中可结构化指标较少，建议补充 scientificData 字段以增强报告说服力。'];

  const riskLines = [
    failed.length ? `失败实验占比 ${Math.round((failed.length / sortedLogs.length) * 100)}%，主要来自参数边界与工艺稳定性波动。` : '本周期未出现明显失败实验，但需要保持边界条件审计。',
    neutral.length ? `中性结果 ${neutral.length} 组，建议明确 Go/No-Go 判据缩短筛选周期。` : '中性结果较少，需持续观察长期稳定性。',
    `高优先级动作：围绕 ${project.keywords?.slice(0, 2).join(' / ') || '核心指标'} 建立批次一致性验证。`
  ];

  const milestoneDone = project.milestones.filter(m => m.status === 'completed').length;
  const milestoneTotal = project.milestones.length;
  const thisWeekPlan = (project.weeklyPlans || [])
    .filter(p => p.type === 'weekly')
    .sort((a, b) => parseLogTime(b.startDate) - parseLogTime(a.startDate))[0];
  const buildWeeklyProgressPoints = () => {
    const recent = sortedLogs.slice(-8);
    const detailed = recent.flatMap((l) => {
      const label = l.result === 'success' ? '已完成' : l.result === 'failure' ? '受阻' : l.result === 'neutral' ? '进行中' : '观察记录';
      const content = summarizeText(l.content, 56);
      const desc = l.description ? summarizeText(l.description, 70) : '';
      const param = l.parameters ? summarizeText(l.parameters, 64) : '';
      const mixText = `${l.content} ${l.parameters || ''}`;
      const e12 = extractMetric(mixText, SCIENCE_REGEX.E12);
      const j = extractMetric(mixText, SCIENCE_REGEX.j);
      const metricText = (e12 !== 'N/A' || j !== 'N/A') ? `，关键指标：E1/2=${e12}，j=${j}` : '';

      const lines = [`[${formatDate(l.timestamp)}] ${label}: ${content}${metricText}`];
      if (desc) lines.push(`实验说明: ${desc}`);
      if (param) lines.push(`参数摘要: ${param}`);
      return lines;
    });

    const planDaily = (thisWeekPlan?.dailyLogs || []).slice(-3).map((txt, idx) => `日度记录${idx + 1}: ${summarizeText(txt, 72)}`);
    const planTasksLine = (thisWeekPlan?.tasks || []).slice(0, 2).map((t, idx) => `任务跟踪${idx + 1}: ${t.title}（状态: ${t.status === 'completed' ? '已完成' : '待推进'}）`);

    const points = [...detailed, ...planDaily, ...planTasksLine];
    if (points.length >= 6) return points.slice(0, 10);
    return [
      ...points,
      '补充建议: 当前可展示进展不足，建议在每条日志中补充“实验目的、关键参数、结果判断、下一步动作”。',
      '补充建议: 在周计划中填写 dailyLogs，可自动形成更完整的周报叙事。'
    ];
  };
  const timelinePoints = buildWeeklyProgressPoints();
  const planGoals = (thisWeekPlan?.goals || []).slice(0, 4).map(g => `${g.completed ? '已完成' : '进行中'}: ${g.text}`);
  const planTasks = (thisWeekPlan?.tasks || []).slice(0, 4).map(t => `${t.status === 'completed' ? '已完成' : '待推进'}: ${t.title}`);
  const latestLog = sortedLogs[sortedLogs.length - 1];
  const latestLogDesc = summarizeText(latestLog?.description || latestLog?.content || '暂无最新实验描述', 64);
  const latestLogParams = summarizeText(latestLog?.parameters || '', 70);
  const hasAnomaly = sortedLogs.some(l => String(l.status || '').trim().toLowerCase() === 'anomaly');
  const weeklyTaskNarratives = (thisWeekPlan?.tasks || []).slice(0, 4).map(t => {
    const prefix = t.status === 'completed' ? '已完成' : '待推进';
    return `${prefix}: ${t.title}。执行要求：明确输入变量、输出指标与截止日期，形成可复核实验闭环。`;
  });
  const materialNarrative = (project.requiredMaterials || []).slice(0, 5)
    .map(r => `${r.name}${r.estimatedAmount ? `（${r.estimatedAmount}）` : '（适量）'}`)
    .join('；');

  // ── Build chart trend data for top metrics ──
  const buildChartDataForMetrics = (): SlideChartSeries[] => {
    const series: SlideChartSeries[] = [];
    topMetrics.slice(0, 2).forEach(m => {
      const dataPoints: { date: string; value: number }[] = [];
      sortedLogs.forEach(log => {
        if (!log.scientificData) return;
        const val = (log.scientificData as Record<string, unknown>)[m.name];
        if (typeof val === 'number' && Number.isFinite(val)) {
          dataPoints.push({ date: formatDate(log.timestamp), value: Number(val.toFixed(4)) });
        }
      });
      if (dataPoints.length >= 2) series.push({ name: m.name, data: dataPoints });
    });
    return series;
  };
  const chartSeriesData = buildChartDataForMetrics();

  // ══════ Seminar template ══════
  if (reportLevel === 'seminar') {
    return [
      { pageNumber: 1, title: `${project.title}`, subTitle: 'Research Group Seminar', successRate,
        points: [`${formatDate(sortedLogs[0]?.timestamp || new Date().toISOString())} ~ ${formatDate(sortedLogs[sortedLogs.length - 1]?.timestamp || new Date().toISOString())}`, `${sortedLogs.length} experiments | ${successRate}% success | ${project.status}`] },
      { pageNumber: 2, title: '\u672C\u671F\u5DE5\u4F5C\u5185\u5BB9',
        points: timelinePoints.length ? timelinePoints.slice(0, 8) : ['\u672C\u671F\u6682\u65E0\u53EF\u5C55\u793A\u8FDB\u5C55'] },
      { pageNumber: 3, title: '\u5173\u952E\u53D1\u73B0\u4E0E\u6570\u636E', chartData: chartSeriesData,
        points: [...topMetrics.slice(0, 3).map(m => `${m.name}: avg ${safeMetric(average(m.values))}, ${m.delta >= 0 ? '\u2191' : '\u2193'}${safeMetric(Math.abs(m.delta))}`), ...syncedModuleMetricLines.slice(0, 2), ...(aiHighlights.length ? [`AI: ${aiHighlights[0]}`] : [])],
        tableData: buildEvidenceTable(sortedLogs) },
      { pageNumber: 4, title: '\u95EE\u9898\u4E0E\u8BA8\u8BBA',
        points: [`\u5931\u8D25/\u4E2D\u6027: ${failed.length + neutral.length} \u7EC4`, ...(failed.length ? [summarizeText(failed[failed.length - 1].content, 60)] : ['\u672C\u671F\u65E0\u5931\u8D25\u5B9E\u9A8C']), ...(neutral.length ? [`\u4E2D\u6027\u7ED3\u679C ${neutral.length} \u7EC4`] : []), hasAnomaly ? '\u26A0 \u5B58\u5728\u5F02\u5E38\u8BB0\u5F55' : '\u672C\u671F\u65E0\u5F02\u5E38'] },
      { pageNumber: 5, title: '\u4E0B\u4E00\u6B65\u8BA1\u5212',
        points: [...(weeklyTaskNarratives.length ? weeklyTaskNarratives.slice(0, 4) : ['\u8BF7\u5728\u5468\u8BA1\u5212\u4E2D\u586B\u5199\u4EFB\u52A1']), `\u6750\u6599: ${materialNarrative || '\u5F85\u8865\u5145'}`],
        nextSteps: ['\u786E\u8BA4\u65B9\u5411', '\u8865\u5145\u5BF9\u7167\u7EC4', '\u51C6\u5907\u4E0B\u6B21\u6C47\u62A5'] },
      { pageNumber: 6, title: '\u9700\u51B3\u7B56\u4E8B\u9879',
        points: [`\u51B3\u7B561: \u5F53\u524D\u8DEF\u7EBF\u662F\u5426\u7EE7\u7EED (${successRate}%)`, '\u51B3\u7B562: \u662F\u5426\u8C03\u6574\u53C2\u6570\u7A97\u53E3', `\u8D44\u6E90: ${project.members?.length || 0} \u4EBA\u53C2\u4E0E`] }
    ];
  }

  // ══════ Defense template ══════
  if (reportLevel === 'defense') {
    return [
      { pageNumber: 1, title: project.title, subTitle: '\u5B66\u4F4D\u8BBA\u6587\u7B54\u8FA9 / \u8BFE\u9898\u9A8C\u6536\u62A5\u544A', successRate,
        points: [`\u7B54\u8FA9\u4EBA: ${project.members?.[0] || '\u7814\u7A76\u8005'}`, `${formatDate(sortedLogs[0]?.timestamp || new Date().toISOString())} ~ ${formatDate(sortedLogs[sortedLogs.length - 1]?.timestamp || new Date().toISOString())}`, `${project.category || ''} | \u8FDB\u5EA6 ${project.progress}%`] },
      { pageNumber: 2, title: '\u7814\u7A76\u80CC\u666F\u4E0E\u9009\u9898\u610F\u4E49',
        points: [`\u65B9\u5411: ${project.category || '\u672A\u5206\u7C7B'}`, `\u5173\u952E\u8BCD: ${project.keywords?.join(', ') || '\u5F85\u8865\u5145'}`, `\u76EE\u6807: ${project.targetMetrics?.slice(0, 3).map(m => `${m.label}=${m.value}${m.unit || ''}`).join('; ') || '\u5F85\u5B9A\u4E49'}`] },
      { pageNumber: 3, title: '\u6280\u672F\u8DEF\u7EBF', points: ['\u4ECE\u65B9\u6848\u8BBE\u8BA1\u5230\u5B9E\u9A8C\u9A8C\u8BC1\u7684\u5B8C\u6574\u6280\u672F\u8DEF\u7EBF'], tableData: buildRoadmapTable(project) },
      { pageNumber: 4, title: '\u5B9E\u9A8C\u65B9\u6CD5\u4E0E\u6761\u4EF6',
        points: [`\u5B9E\u9A8C: ${sortedLogs.length} \u7EC4, ${[...new Set(sortedLogs.map(l => formatDate(l.timestamp)))].length} \u5929`, `\u53C2\u6570: ${topMetrics.map(m => `${m.name}(${safeMetric(Math.min(...m.values))}~${safeMetric(Math.max(...m.values))})`).join('; ') || '\u5F85\u7EDF\u8BA1'}`, `\u8868\u5F81: ${syncedModuleSummaryLines.length > 0 ? `${syncedModuleSummaryLines.length} \u4E2A\u6A21\u5757` : '\u5F85\u8865\u5145'}`, `\u6750\u6599: ${materialNarrative || '\u5F85\u8865\u5145'}`] },
      { pageNumber: 5, title: '\u6838\u5FC3\u5B9E\u9A8C\u7ED3\u679C', chartData: chartSeriesData,
        points: [`\u6210\u529F\u7387: ${successRate}% (${success.length}/${sortedLogs.length})`, ...topMetrics.slice(0, 3).map(m => `${m.name}: avg ${safeMetric(average(m.values))}, ${m.delta >= 0 ? '\u2191' : '\u2193'}${safeMetric(Math.abs(m.delta))}`), ...syncedModuleMetricLines.slice(0, 3)],
        tableData: buildEvidenceTable(sortedLogs) },
      { pageNumber: 6, title: '\u7ED3\u679C\u5206\u6790\u4E0E\u8BA8\u8BBA',
        points: [...(aiHighlights.length ? aiHighlights.slice(0, 2) : ['\u5F85AI\u5206\u6790']), ...syncedModuleSummaryLines.slice(0, 2), `\u6700\u4F73\u7A97\u53E3: ${success.length ? summarizeText(success[success.length - 1].content, 60) : '\u6682\u65E0'}`, `\u6311\u6218: ${failed.length ? summarizeText(failed[failed.length - 1].content, 50) : '\u5F85\u603B\u7ED3'}`] },
      { pageNumber: 7, title: '\u91CC\u7A0B\u7891\u4E0E\u8FDB\u5C55',
        points: [`\u91CC\u7A0B\u7891: ${milestoneDone}/${milestoneTotal} (${milestoneTotal ? Math.round(milestoneDone / milestoneTotal * 100) : 0}%)`, `\u8FDB\u5EA6: ${project.progress}%`, `\u6700\u65B0: ${latestLogDesc}`] },
      { pageNumber: 8, title: '\u7814\u7A76\u7ED3\u8BBA',
        points: [aiHighlights[2] || '\u5B9E\u9A8C\u6570\u636E\u652F\u6301\u5F53\u524D\u6280\u672F\u8DEF\u7EBF\u7684\u53EF\u884C\u6027', successRate >= 60 ? '\u4E3B\u8981\u7814\u7A76\u76EE\u6807\u5DF2\u57FA\u672C\u8FBE\u6210' : '\u90E8\u5206\u6307\u6807\u4ECD\u9700\u9A8C\u8BC1', `\u56F4\u7ED5 ${project.keywords?.slice(0, 2).join(' \u548C ') || '\u6838\u5FC3\u65B9\u5411'} \u5F62\u6210\u7CFB\u7EDF\u5316\u65B9\u6CD5\u8BBA`] },
      { pageNumber: 9, title: '\u4E0D\u8DB3\u4E0E\u5C55\u671B',
        points: [...riskLines.slice(0, 2), '\u6269\u5927\u53C2\u6570\u7A7A\u95F4\u63A2\u7D22', '\u5F00\u5C55\u957F\u671F\u7A33\u5B9A\u6027\u6D4B\u8BD5', '\u63A2\u7D22\u4EA7\u4E1A\u5316\u8F6C\u5316\u8DEF\u5F84'] },
      { pageNumber: 10, title: '\u81F4\u8C22',
        points: ['\u611F\u8C22\u5BFC\u5E08\u7684\u6082\u5FC3\u6307\u5BFC', `\u611F\u8C22\u56E2\u961F ${project.members?.length || 0} \u4F4D\u6210\u5458\u7684\u534F\u4F5C`, '\u611F\u8C22\u5B9E\u9A8C\u5E73\u53F0\u4E0E\u4EEA\u5668\u8BBE\u5907\u7684\u652F\u6301'] }
    ];
  }

  if (reportLevel === 'weekly') {
    const weeklySlides: Slide[] = [
      {
        pageNumber: 1,
        title: `${project.title} \u79D1\u7814\u5468\u62A5`,
        subTitle: 'Weekly Research Progress Briefing',
        successRate,
        points: [
          `\u7EDF\u8BA1\u533A\u95F4: ${formatDate(sortedLogs[0]?.timestamp || new Date().toISOString())} \u81F3 ${formatDate(sortedLogs[sortedLogs.length - 1]?.timestamp || new Date().toISOString())}`,
          `\u672C\u5468\u6709\u6548\u5B9E\u9A8C: ${sortedLogs.length} \u7EC4\uFF0C\u6210\u529F\u7387 ${successRate}%`,
          `\u8BFE\u9898\u72B6\u6001: ${project.status} | \u5F53\u524D\u8FDB\u5EA6 ${project.progress}%`
        ]
      },
      {
        pageNumber: 2,
        title: '\u672C\u5468\u76EE\u6807\u4E0E\u5B8C\u6210\u5EA6',
        points: [
          ...(planGoals.length ? planGoals : ['\u672A\u586B\u5199 weeklyPlans.goals\uFF0C\u5EFA\u8BAE\u5728\u5468\u8BA1\u5212\u91CC\u8865\u5145\u672C\u5468\u76EE\u6807\u3002']),
          `\u91CC\u7A0B\u7891\u5B8C\u6210\u5EA6: ${milestoneDone}/${milestoneTotal}`,
          ...(aiHighlights[0] ? [`\u672C\u5468\u6458\u8981: ${aiHighlights[0]}`] : []),
          ...(syncedModuleSummaryLines.length > 0 ? [`\u8868\u5F81\u540C\u6B65: \u672C\u5468\u5DF2\u540C\u6B65 ${syncedModuleSummaryLines.length} \u4E2A\u8868\u5F81\u6A21\u5757\u6570\u636E`] : [])
        ]
      },
      {
        pageNumber: 3,
        title: '\u672C\u5468\u5173\u952E\u5B9E\u9A8C\u8FDB\u5C55',
        points: timelinePoints.length ? timelinePoints : ['\u672C\u5468\u6682\u65E0\u53EF\u5C55\u793A\u8FDB\u5C55\uFF0C\u8BF7\u68C0\u67E5\u65E5\u5FD7\u65F6\u95F4\u8303\u56F4\u3002']
      },
      {
        pageNumber: 4,
        title: '\u6838\u5FC3\u6570\u636E\u4E0E\u7ED3\u679C\u5BF9\u6BD4',
        chartData: chartSeriesData,
        points: [
          '\u4EE5\u4E0B\u4E3A\u672C\u5468\u6838\u5FC3\u8BC1\u636E\u6570\u636E\uFF0C\u5EFA\u8BAE\u6C47\u62A5\u65F6\u4F18\u5148\u8BB2\u201C\u8D8B\u52BF\u53D8\u5316+\u539F\u56E0\u89E3\u91CA\u201D\u3002',
          ...topMetrics.slice(0, 2).map(m => `${m.name}: \u9636\u6BB5\u53D8\u5316 ${safeMetric(m.delta)}\uFF0C\u5E73\u5747\u503C ${safeMetric(average(m.values))}`),
          ...syncedModuleMetricLines.slice(0, 3)
        ],
        tableData: buildEvidenceTable(sortedLogs)
      },
      {
        pageNumber: 5,
        title: '\u95EE\u9898\u4E0E\u98CE\u9669\u6E05\u5355',
        points: [
          `\u4EA7\u7269\u7EAF\u5EA6\u98CE\u9669: ${hasAnomaly ? '\u672C\u5468\u5B58\u5728 Anomaly \u8BB0\u5F55\uFF0C\u63D0\u793A\u6837\u54C1\u53EF\u80FD\u5B58\u5728\u6742\u8D28\u6216\u5DE5\u827A\u504F\u5DEE\u3002' : '\u672C\u5468\u672A\u51FA\u73B0\u5F02\u5E38\u72B6\u6001\uFF0C\u4F46\u4ECD\u9700\u901A\u8FC7\u91CD\u590D\u6D17\u6DA4\u4E0E\u5E72\u71E5\u590D\u6838\u7EAF\u5EA6\u3002'}`,
          `\u5DE5\u827A\u4E00\u81F4\u6027\u98CE\u9669: \u6700\u65B0\u5B9E\u9A8C\u201C${latestLogDesc}\u201D\u4ECD\u9700\u6279\u6B21\u590D\u73B0\uFF1B\u53C2\u6570\u6458\u8981\uFF1A${latestLogParams || '\u672A\u586B\u5199\u53C2\u6570\u8BE6\u60C5\u3002'}`,
          `${neutral.length ? `\u6570\u636E\u4E00\u81F4\u6027\u98CE\u9669: \u4E2D\u6027\u7ED3\u679C ${neutral.length} \u7EC4\uFF0C\u5EFA\u8BAE\u8865\u5145\u5BF9\u7167\u7EC4\u5E76\u7EDF\u4E00\u5224\u5B9A\u6807\u51C6\u3002` : '\u6570\u636E\u4E00\u81F4\u6027\u98CE\u9669: \u5F53\u524D\u6837\u672C\u91CF\u504F\u5C0F\uFF0C\u9700\u6269\u5C55\u5E73\u884C\u5B9E\u9A8C\u4EE5\u786E\u8BA4\u8D8B\u52BF\u7A33\u5B9A\u3002'}`
        ]
      },
      {
        pageNumber: 6,
        title: '\u4E0B\u5468\u5B9E\u9A8C\u8BA1\u5212',
        points: [
          ...(weeklyTaskNarratives.length ? weeklyTaskNarratives : [
            '\u5F85\u63A8\u8FDB: \u5F3A\u5316\u4EA7\u7269\u6D17\u6DA4\u3002\u5BF9\u73B0\u6709\u4EA7\u7269\u6267\u884C\u591A\u6B21\u79BB\u5FC3\u6D17\u6DA4\uFF0C\u76F4\u81F3\u4E0A\u6E05\u6DB2\u63A5\u8FD1\u4E2D\u6027\u5E76\u590D\u6838\u771F\u5B9E\u4EA7\u91CF\u3002',
            '\u5F85\u63A8\u8FDB: \u7ED3\u6784\u8868\u5F81\u5206\u6790\u3002\u901A\u8FC7 XRD/SEM \u6392\u67E5\u662F\u5426\u5B58\u5728\u975E\u76EE\u6807\u7269\u76F8\u4E0E\u9897\u7C92\u56E2\u805A\u3002',
            '\u5F85\u63A8\u8FDB: \u7535\u5316\u5B66\u6027\u80FD\u9884\u6D4B\u8BD5\u3002\u5728\u6837\u54C1\u7EAF\u5EA6\u786E\u8BA4\u540E\u5F00\u5C55 LSV \u6D4B\u8BD5\uFF0C\u8BC4\u4F30\u5B9E\u9645 OER \u6D3B\u6027\u3002'
          ]),
          '\u65B9\u6CD5\u7EA6\u675F: \u91C7\u7528\u201C\u5173\u952E\u53D8\u91CF\u4F18\u5148\u3001\u5355\u6B21\u53EA\u6539\u4E00\u4E2A\u53D8\u91CF\u201D\u7684\u5BF9\u7167\u7B56\u7565\u3002',
          '\u6267\u884C\u89C4\u8303: \u6BCF\u4E2A\u4EFB\u52A1\u7ED1\u5B9A\u9A8C\u6536\u6307\u6807\u4E0E\u622A\u6B62\u65E5\u671F\u3002'
        ],
        nextSteps: ['\u5468\u4E00: \u6837\u54C1\u51C6\u5907', '\u5468\u4E8C-\u5468\u56DB: \u5BF9\u7167\u5B9E\u9A8C', '\u5468\u4E94: \u6570\u636E\u590D\u76D8\u4E0E\u6C47\u62A5']
      },
      {
        pageNumber: 7,
        title: '\u8D44\u6E90\u4E0E\u534F\u4F5C\u9700\u6C42',
        points: [
          `\u6750\u6599\u9700\u6C42: ${materialNarrative || '\u5EFA\u8BAE\u8865\u5145\u524D\u9A71\u4F53\u3001\u78B1\u6DB2\u4E0E\u5BFC\u7535\u8F7D\u4F53\u7684\u7528\u91CF\u3002'}`,
          `\u4EBA\u5458\u534F\u4F5C: ${project.members?.length || 0} \u4EBA\u53C2\u4E0E\u3002`,
          '\u8D44\u6E90\u652F\u6301: \u7533\u8BF7\u5173\u952E\u4EEA\u5668\u65F6\u6BB5\uFF08XRD/SEM/\u7535\u5316\u5B66\u5DE5\u4F5C\u7AD9\uFF09\u3002'
        ]
      },
      {
        pageNumber: 8,
        title: '\u4E0B\u5468\u51B3\u7B56\u4E8B\u9879',
        points: [
          `\u5EFA\u8BAE\u51B3\u7B561: \u662F\u5426\u6309\u5F53\u524D\u5DE5\u827A\u7A97\u53E3\u7EE7\u7EED\u653E\u5927\u9A8C\u8BC1\uFF08\u5F53\u524D\u6837\u672C\u6210\u529F\u7387 ${successRate}%\uFF09\u3002`,
          '\u5EFA\u8BAE\u51B3\u7B562: \u662F\u5426\u5148\u5B8C\u6210\u7EAF\u5EA6\u4E0E\u7269\u76F8\u590D\u6838\u3002',
          '\u5EFA\u8BAE\u51B3\u7B563: \u662F\u5426\u8FFD\u52A0\u91CD\u590D\u6027\u6D4B\u8BD5\u3002'
        ],
        nextSteps: ['\u786E\u8BA4\u53C2\u6570\u51BB\u7ED3\u8303\u56F4', '\u9501\u5B9A\u8D44\u6E90\u6392\u671F', '\u786E\u5B9A\u6C47\u62A5\u8D23\u4EFB\u4EBA']
      }
    ];
    return weeklySlides;
  }

  const slides: Slide[] = [
    {
      pageNumber: 1,
      title: `${project.title} ${REPORT_LABEL[reportLevel]}`,
      subTitle: `${REPORT_LABEL[reportLevel]} | Verified Data Driven`,
      successRate,
      points: [
        `\u7EDF\u8BA1\u533A\u95F4: ${formatDate(sortedLogs[0]?.timestamp || new Date().toISOString())} \u81F3 ${formatDate(sortedLogs[sortedLogs.length - 1]?.timestamp || new Date().toISOString())}`,
        `\u6709\u6548\u6837\u672C: ${sortedLogs.length} \u7EC4\uFF0C\u6210\u529F\u7387 ${successRate}%`,
        `\u8BFE\u9898\u72B6\u6001: ${project.status} | TRL ${project.trl}`
      ]
    },
    {
      pageNumber: 2,
      title: '\u6267\u884C\u6458\u8981',
      points: [
        `\u672C\u5468\u671F\u5171\u5B8C\u6210 ${sortedLogs.length} \u7EC4\u5DF2\u6838\u9A8C\u5B9E\u9A8C\uFF0C\u6210\u529F ${success.length} \u7EC4\uFF0C\u89C2\u5BDF ${observed.length} \u7EC4\u3002`,
        ...primaryMetricLine,
        ...(syncedModuleMetricLines.length > 0 ? [`\u8868\u5F81\u6570\u636E\u540C\u6B65: ${syncedModuleMetricLines.slice(0, 2).join('\uFF1B')}`] : []),
        ...(aiHighlights.length ? [`\u4E13\u5BB6\u6458\u8981: ${aiHighlights[0]}`] : [])
      ]
    },
    {
      pageNumber: 3,
      title: '\u573A\u666F\u75DB\u70B9\u4E0E\u76EE\u6807\u5BF9\u9F50',
      points: [
        `\u6838\u5FC3\u5E94\u7528\u573A\u666F: ${project.category || '\u672A\u5206\u7C7B'}\uFF0C\u76EE\u6807\u662F\u5C06\u5B9E\u9A8C\u7ED3\u679C\u8F6C\u5316\u4E3A\u53EF\u590D\u73B0\u5DE5\u827A\u4E0E\u53EF\u4EA4\u4ED8\u6307\u6807\u3002`,
        `\u5F53\u524D\u75DB\u70B9: ${failed.length ? summarizeText(failed[failed.length - 1].content, 46) : '\u5931\u8D25\u6837\u672C\u4E0D\u8DB3\uFF0C\u9700\u5173\u6CE8\u89C4\u6A21\u5316\u4E00\u81F4\u6027\u98CE\u9669\u3002'}`,
        `\u76EE\u6807\u6307\u6807: ${project.targetMetrics?.slice(0, 3).map(m => `${m.label}=${m.value}${m.unit || ''}`).join('\uFF1B') || '\u5EFA\u8BAE\u8865\u5145 targetMetrics\u3002'}`
      ]
    },
    {
      pageNumber: 4,
      title: '\u6280\u672F\u8DEF\u7EBF\u4E0E\u5B9E\u65BD\u7B56\u7565',
      points: ['\u4EE5\u4E0B\u5185\u5BB9\u7528\u4E8E\u652F\u6491\u201C\u4ECE\u5B9E\u9A8C\u5230\u8F6C\u5316\u201D\u7684\u53EF\u6267\u884C\u8DEF\u7EBF\u3002'],
      tableData: buildRoadmapTable(project)
    },
    {
      pageNumber: 5,
      title: '\u6570\u636E\u8BC1\u636E\u77E9\u9635',
      chartData: chartSeriesData,
      points: [
        '\u5168\u90E8\u6570\u636E\u5747\u6765\u81EA\u5DF2\u5BA1\u8BA1\u901A\u8FC7\u7684\u5B9E\u9A8C\u8BB0\u5F55\uFF08Verified\uFF09\u3002',
        '\u5EFA\u8BAE\u5C06\u8BE5\u9875\u4F5C\u4E3A\u8BC4\u5BA1\u95EE\u8BE2\u65F6\u7684\u6838\u5FC3\u8BC1\u636E\u9875\u3002'
      ],
      tableData: buildEvidenceTable(sortedLogs)
    },
    {
      pageNumber: 6,
      title: '\u5173\u952E\u7ED3\u679C\u4E0E\u79D1\u5B66\u53D1\u73B0',
      points: [
        ...topMetrics.slice(0, 3).map(m => `${m.name} \u8D8B\u52BF ${m.delta >= 0 ? '\u4E0A\u5347' : '\u4E0B\u964D'}\uFF0C\u9636\u6BB5\u53D8\u5316 ${safeMetric(m.delta)}\u3002`),
        ...syncedModuleSummaryLines.slice(0, 2),
        ...syncedModuleMetricLines.slice(0, 2),
        `\u6700\u4F73\u7A97\u53E3\u8BB0\u5F55: ${success.length ? summarizeText(success[success.length - 1].content, 52) : '\u6682\u65E0\u6210\u529F\u6837\u672C\u7A97\u53E3\u3002'}`,
        ...(aiHighlights.length > 1 ? [`\u8865\u5145\u6D1E\u5BDF: ${aiHighlights[1]}`] : [])
      ]
    },
    {
      pageNumber: 7,
      title: '\u91CC\u7A0B\u7891\u8FDB\u5C55\u4E0E\u7EC4\u7EC7\u6267\u884C',
      points: [
        `\u91CC\u7A0B\u7891\u5B8C\u6210\u5EA6: ${milestoneDone}/${milestoneTotal}\uFF0C\u8BFE\u9898\u6574\u4F53\u8FDB\u5EA6 ${project.progress}%\u3002`,
        `\u6210\u5458\u4E0E\u534F\u540C: ${project.members?.length || 0} \u4EBA\u53C2\u4E0E\uFF0C\u5EFA\u8BAE\u56F4\u7ED5\u5173\u952E\u8DEF\u5F84\u505A\u4EFB\u52A1\u95ED\u73AF\u3002`,
        `\u6700\u65B0\u9A8C\u8BC1\u8BB0\u5F55: ${summarizeText(sortedLogs[sortedLogs.length - 1]?.description || sortedLogs[sortedLogs.length - 1]?.content || '', 48)}`
      ]
    },
    {
      pageNumber: 8,
      title: '\u6210\u679C\u8F6C\u5316\u8DEF\u5F84\u4E0E\u5546\u4E1A\u4EF7\u503C',
      points: [
        '\u8F6C\u5316\u8DEF\u5F84: \u5B9E\u9A8C\u53EF\u91CD\u590D -> \u5DE5\u827A\u53C2\u6570\u56FA\u5316 -> \u4E2D\u8BD5\u9A8C\u8BC1 -> \u5BF9\u5916\u5408\u4F5C/\u5185\u90E8\u91CF\u4EA7\u3002',
        `\u9884\u671F\u4EF7\u503C: ${project.targetPerformance || '\u5EFA\u8BAE\u5B9A\u4E49 targetPerformance\u3002'}`,
        '\u5EFA\u8BAE\u8F93\u51FA\u4EF6: \u5DE5\u827ASOP\u3001\u5173\u952E\u53C2\u6570\u5305\u3001\u8D28\u91CF\u63A7\u5236\u6E05\u5355\u3002'
      ]
    },
    {
      pageNumber: 9,
      title: '\u98CE\u9669\u8BC6\u522B\u4E0E\u5E94\u5BF9\u7B56\u7565',
      points: riskLines,
      nextSteps: ['\u5EFA\u7ACB\u53C2\u6570\u8FB9\u754C\u5E93', '\u589E\u52A0\u91CD\u590D\u6279\u6B21\u9A8C\u8BC1', '\u5F62\u6210\u98CE\u9669\u53F0\u8D26\u4E0E\u8D23\u4EFB\u4EBA']
    },
    {
      pageNumber: 10,
      title: '\u4E0B\u9636\u6BB5\u8D44\u6E90\u4E0E\u884C\u52A8\u8BA1\u5212',
      points: [
        '30\u5929\u884C\u52A8: \u5B8C\u6210\u5173\u952E\u5BF9\u7167\u5B9E\u9A8C\u3001\u56FA\u5316\u6700\u4F73\u53C2\u6570\u3001\u5F62\u6210\u9636\u6BB5\u62A5\u544A\u3002',
        `\u8D44\u6E90\u9700\u6C42: ${(project.requiredMaterials || []).slice(0, 3).map(r => `${r.name}${r.estimatedAmount ? `(${r.estimatedAmount})` : ''}`).join('\uFF1B') || '\u5EFA\u8BAE\u8865\u5145 requiredMaterials\u3002'}`,
        '\u51B3\u7B56\u8BF7\u6C42: \u6279\u51C6\u4E0B\u4E00\u9636\u6BB5\u9A8C\u8BC1\u9884\u7B97\u4E0E\u4EBA\u5458\u65F6\u95F4\u7A97\u53E3\u3002'
      ],
      nextSteps: ['\u7B2C1\u5468: \u5BF9\u7167\u5B9E\u9A8C', '\u7B2C2-3\u5468: \u53C2\u6570\u6536\u655B', '\u7B2C4\u5468: \u6C47\u62A5\u8BC4\u5BA1']
    }
  ];

  if (reportLevel === 'final') {
    slides.push(
      {
        pageNumber: 11,
        title: '\u7ED3\u9898\u4EA7\u51FA\u4E0E\u77E5\u8BC6\u8D44\u4EA7',
        points: [
          `\u8BBA\u6587/\u62A5\u544A\u4EA7\u51FA: ${project.publications?.length || 0} \u9879\uFF0C\u5EFA\u8BAE\u8865\u9F50\u53EF\u516C\u5F00\u6210\u679C\u6E05\u5355\u3002`,
          `\u77E5\u8BC6\u8D44\u4EA7: ${project.tables?.length || 0} \u5F20\u8868\u683C\u3001${project.latexSnippets?.length || 0} \u6761\u516C\u5F0F\u3001${project.media?.length || 0} \u4EFD\u5A92\u4F53\u6750\u6599\u3002`,
          '\u5EFA\u8BAE\u5F62\u6210\u7ED3\u9898\u5F52\u6863\u5305\uFF1A\u6570\u636E\u3001\u8DEF\u7EBF\u3001\u98CE\u9669\u3001\u8F6C\u5316\u5EFA\u8BAE\u5168\u91CF\u7559\u75D5\u3002'
        ]
      },
      {
        pageNumber: 12,
        title: '\u7ED3\u9898\u7ED3\u8BBA\u4E0E\u540E\u7EED\u5EFA\u8BAE',
        points: [
          `\u7ED3\u9898\u5224\u65AD: ${successRate >= 60 ? '\u5177\u5907\u7EE7\u7EED\u653E\u5927\u9A8C\u8BC1\u7684\u57FA\u7840' : '\u5EFA\u8BAE\u5148\u5B8C\u6210\u5173\u952E\u6307\u6807\u8865\u5F3A\u518D\u653E\u5927'}`,
          `\u6838\u5FC3\u7ED3\u8BBA: ${aiHighlights[2] || '\u9A8C\u8BC1\u6570\u636E\u652F\u6301\u5F53\u524D\u6280\u672F\u8DEF\u7EBF\u5177\u5907\u6301\u7EED\u4F18\u5316\u7A7A\u95F4\u3002'}`,
          '\u540E\u7EED\u5EFA\u8BAE: \u4EE5\u4EA7\u4E1A\u5316\u7EA6\u675F\u53CD\u63A8\u5B9E\u9A8C\u8BBE\u8BA1\uFF0C\u63D0\u5347\u6210\u679C\u8F6C\u5316\u6548\u7387\u3002'
        ],
        nextSteps: ['\u5F62\u6210\u7ED3\u9898\u8BC4\u5BA1\u5305', '\u542F\u52A8\u653E\u5927\u9A8C\u8BC1\u7ACB\u9879', '\u5BF9\u63A5\u6F5C\u5728\u5408\u4F5C\u65B9']
      }
    );
  }

  const target = REPORT_TARGET_PAGES[reportLevel];
  return slides.slice(0, target).map((s, idx) => ({ ...s, pageNumber: idx + 1 }));
};

export const usePptLogic = (project: ResearchProject) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportLevel, setReportLevel] = useState<ReportLevel>('monthly');
  const [isGenerating, setIsGenerating] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [logSourceMode, setLogSourceMode] = useState<'verified' | 'fallback_all'>('verified');

  const getFormattedDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleLevelChange = (level: ReportLevel) => {
    setReportLevel(level);
    const end = new Date();
    const start = new Date();

    if (level === 'weekly' || level === 'seminar') {
      start.setDate(end.getDate() - 7);
    } else if (level === 'monthly') {
      start.setDate(end.getDate() - 30);
    } else if (level === 'final' || level === 'defense') {
      const allLogs = project.milestones.flatMap(m => m.logs);
      if (allLogs.length > 0) {
        const sorted = [...allLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const firstLogDate = new Date(sorted[0].timestamp);
        start.setTime(firstLogDate.getTime());
      } else {
        start.setMonth(end.getMonth() - 6);
      }
    }

    setStartDate(getFormattedDate(start));
    setEndDate(getFormattedDate(end));
  };

  useEffect(() => {
    if (!startDate || !endDate) {
      handleLevelChange('monthly');
    }
  }, []);

  const filteredLogs = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const parseTs = (ts: string) => {
      const normalized = ts.replace(/\//g, '-');
      const d = new Date(normalized);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const logsInRange = project.milestones.flatMap(m => m.logs)
      .filter(log => {
        const status = String(log.status || '').trim().toLowerCase();
        const ts = parseLogTime(log.timestamp);
        if (!ts) return false;
        return (status === 'verified' || status === 'pending' || status === 'anomaly') && ts >= start.getTime() && ts <= end.getTime();
      })
      .sort((a, b) => parseTs(a.timestamp) - parseTs(b.timestamp));

    const verified = logsInRange.filter(log => String(log.status || '').trim().toLowerCase() === 'verified');
    return verified.length > 0 ? verified : logsInRange;
  }, [project, startDate, endDate]);

  useEffect(() => {
    const hasVerified = filteredLogs.some(log => String(log.status || '').trim().toLowerCase() === 'verified');
    setLogSourceMode(hasVerified ? 'verified' : 'fallback_all');
  }, [filteredLogs]);

  const relevantProposals = useMemo(() => (project.proposals || []).slice(0, 5), [project.proposals]);

  const handleOfflineGenerate = (aiSeedSlides: Slide[] = []) => {
    if (filteredLogs.length === 0) return;
    setSlides(buildStructuredSlides(project, reportLevel, filteredLogs, aiSeedSlides));
  };

  const handleGenerate = async () => {
    if (filteredLogs.length === 0) {
      alert("\u8BE5\u65F6\u95F4\u6BB5\u5185\u6682\u65E0\u7ECF\u7531 AI \u5BA1\u8BA1\u901A\u8FC7 (Verified) \u7684\u5B9E\u9A8C\u6570\u636E\uFF0C\u65E0\u6CD5\u751F\u6210\u4FE1\u8D56\u7EA7\u62A5\u544A\u3002");
      return;
    }
    setIsGenerating(true);

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000));

    try {
      const contextTitle = `[${reportLevel.toUpperCase()} REPORT] ${project.title}`;

      const result = await Promise.race([
        generateScientificPPT(filteredLogs, relevantProposals, contextTitle),
        timeout
      ]) as Slide[];

      const aiSeedSlides = Array.isArray(result) ? result : [];
      handleOfflineGenerate(aiSeedSlides);
    } catch (error) {
      console.warn("PPT Gen Timeout or Error, switching to offline mode:", error);
      handleOfflineGenerate();
    } finally {
      setIsGenerating(false);
    }
  };

  const getVbaScript = () => {
    if (slides.length === 0) return null;
    return generateVbaScript(slides);
  };

  const getMarkdown = () => {
    if (slides.length === 0) return null;
    let md = `# ${project.title} - ${REPORT_LABEL[reportLevel]}\n\n`;
    slides.forEach(s => {
      md += `## Slide ${s.pageNumber}. ${s.title}\n`;
      if (s.subTitle) md += `> ${s.subTitle}\n\n`;
      s.points.forEach(p => md += `- ${p}\n`);
      if (s.tableData) {
        md += `\n| ${s.tableData[0].join(' | ')} |\n| ${s.tableData[0].map(() => '---').join(' | ')} |\n`;
        s.tableData.slice(1).forEach(r => md += `| ${r.join(' | ')} |\n`);
      }
      if (s.nextSteps && s.nextSteps.length) {
        md += `\n**Next Steps**\n`;
        s.nextSteps.forEach(step => {
          md += `- ${step}\n`;
        });
      }
      md += `\n---\n\n`;
    });
    return md;
  };

  const copyVBAScript = () => {
    const script = getVbaScript();
    if (script) {
      navigator.clipboard.writeText(script);
      alert("VBA \u811A\u672C\u5DF2\u5C31\u7EEA\uFF0C\u8BF7\u5728 PPT \u4E2D\u6309 Alt+F11 \u7C98\u8D34\u8FD0\u884C\u3002");
    }
  };

  const copyMarkdown = () => {
    const md = getMarkdown();
    if (md) {
      navigator.clipboard.writeText(md);
      alert("Markdown \u5927\u7EB2\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\u3002");
    }
  };

  return {
    startDate, setStartDate,
    endDate, setEndDate,
    reportLevel, handleLevelChange,
    isGenerating,
    slides,
    handleGenerate,
    getVbaScript,
    getMarkdown,
    copyVBAScript,
    copyMarkdown,
    filteredLogs,
    relevantProposals,
    logSourceMode
  };
};

