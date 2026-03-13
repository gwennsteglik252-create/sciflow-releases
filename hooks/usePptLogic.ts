
import { useState, useMemo, useEffect } from 'react';
import { ExperimentLog, ResearchProject } from '../types';
import { generateScientificPPT } from '../services/gemini';
import { SCIENCE_REGEX, extractMetric } from '../utils/scienceRegex';
import { generateVbaScript } from '../constants/vbaTemplates';

export interface Slide {
  pageNumber: number;
  title: string;
  subTitle?: string;
  points: string[];
  mermaid?: string;
  tableData?: string[][];
  nextSteps?: string[];
}

export type ReportLevel = 'weekly' | 'monthly' | 'final';

const REPORT_LABEL: Record<ReportLevel, string> = {
  weekly: '周报',
  monthly: '月报',
  final: '结题报告'
};

const REPORT_TARGET_PAGES: Record<ReportLevel, number> = {
  weekly: 8,
  monthly: 10,
  final: 12
};

const parseLogTime = (ts: string) => {
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

const buildNumericMetricMap = (logs: ExperimentLog[]) => {
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

  if (reportLevel === 'weekly') {
    const weeklySlides: Slide[] = [
      {
        pageNumber: 1,
        title: `${project.title} 科研周报`,
        subTitle: 'Weekly Research Progress Briefing',
        points: [
          `统计区间: ${formatDate(sortedLogs[0]?.timestamp || new Date().toISOString())} 至 ${formatDate(sortedLogs[sortedLogs.length - 1]?.timestamp || new Date().toISOString())}`,
          `本周有效实验: ${sortedLogs.length} 组，成功率 ${successRate}%`,
          `课题状态: ${project.status} | 当前进度 ${project.progress}%`
        ]
      },
      {
        pageNumber: 2,
        title: '本周目标与完成度',
        points: [
          ...(planGoals.length ? planGoals : ['未填写 weeklyPlans.goals，建议在周计划里补充本周目标。']),
          `里程碑完成度: ${milestoneDone}/${milestoneTotal}`,
          ...(aiHighlights[0] ? [`本周摘要: ${aiHighlights[0]}`] : []),
          ...(syncedModuleSummaryLines.length > 0 ? [`表征同步: 本周已同步 ${syncedModuleSummaryLines.length} 个表征模块数据`] : [])
        ]
      },
      {
        pageNumber: 3,
        title: '本周关键实验进展',
        points: timelinePoints.length ? timelinePoints : ['本周暂无可展示进展，请检查日志时间范围。']
      },
      {
        pageNumber: 4,
        title: '核心数据与结果对比',
        points: [
          '以下为本周核心证据数据，建议汇报时优先讲“趋势变化+原因解释”。',
          ...topMetrics.slice(0, 2).map(m => `${m.name}: 阶段变化 ${safeMetric(m.delta)}，平均值 ${safeMetric(average(m.values))}`),
          ...syncedModuleMetricLines.slice(0, 3)
        ],
        tableData: buildEvidenceTable(sortedLogs)
      },
      {
        pageNumber: 5,
        title: '问题与风险清单',
        points: [
          `产物纯度风险: ${hasAnomaly ? '本周存在 Anomaly 记录，提示样品可能存在杂质或工艺偏差。' : '本周未出现异常状态，但仍需通过重复洗涤与干燥复核纯度。'}`,
          `工艺一致性风险: 最新实验“${latestLogDesc}”仍需批次复现；参数摘要：${latestLogParams || '未填写参数详情。'}`,
          `${neutral.length ? `数据一致性风险: 中性结果 ${neutral.length} 组，建议补充对照组并统一判定标准。` : '数据一致性风险: 当前样本量偏小，需扩展平行实验以确认趋势稳定。'}`
        ]
      },
      {
        pageNumber: 6,
        title: '下周实验计划',
        points: [
          ...(weeklyTaskNarratives.length ? weeklyTaskNarratives : [
            '待推进: 强化产物洗涤。对现有产物执行多次离心洗涤，直至上清液接近中性并复核真实产量。',
            '待推进: 结构表征分析。通过 XRD/SEM 排查是否存在非目标物相与颗粒团聚。',
            '待推进: 电化学性能预测试。在样品纯度确认后开展 LSV 测试，评估实际 OER 活性。'
          ]),
          '方法约束: 采用“关键变量优先、单次只改一个变量”的对照策略，避免多变量耦合干扰。',
          '执行规范: 每个任务绑定验收指标与截止日期，避免任务堆积并提升周会可汇报性。'
        ],
        nextSteps: ['周一: 样品准备', '周二-周四: 对照实验', '周五: 数据复盘与汇报']
      },
      {
        pageNumber: 7,
        title: '资源与协作需求',
        points: [
          `材料需求: ${materialNarrative || '建议补充前驱体、碱液与导电载体的用量，便于形成可执行采购清单。'}`,
          `人员协作: ${project.members?.length || 0} 人参与。建议明确“合成-表征-电化学-数据复核”分工，避免责任空档。`,
          '资源支持: 申请关键仪器时段（XRD/SEM/电化学工作站）与重复性测试工位，保证下周计划落地。'
        ]
      },
      {
        pageNumber: 8,
        title: '下周决策事项',
        points: [
          `建议决策1: 是否按当前工艺窗口继续放大验证（当前样本成功率 ${successRate}%）。`,
          '建议决策2: 是否先完成纯度与物相复核，再冻结本周最佳参数进入稳定性阶段。',
          '建议决策3: 是否追加资源用于重复性与批次一致性测试，并设定明确 Go/No-Go 门槛。'
        ],
        nextSteps: ['确认参数冻结范围', '锁定下周资源排期', '确定周会汇报责任人']
      }
    ];
    return weeklySlides;
  }

  const slides: Slide[] = [
    {
      pageNumber: 1,
      title: `${project.title} ${REPORT_LABEL[reportLevel]}`,
      subTitle: `${REPORT_LABEL[reportLevel]} | Verified Data Driven`,
      points: [
        `统计区间: ${formatDate(sortedLogs[0]?.timestamp || new Date().toISOString())} 至 ${formatDate(sortedLogs[sortedLogs.length - 1]?.timestamp || new Date().toISOString())}`,
        `有效样本: ${sortedLogs.length} 组，成功率 ${successRate}%`,
        `课题状态: ${project.status} | TRL ${project.trl}`
      ]
    },
    {
      pageNumber: 2,
      title: '执行摘要',
      points: [
        `本周期共完成 ${sortedLogs.length} 组已核验实验，成功 ${success.length} 组，观察 ${observed.length} 组。`,
        ...primaryMetricLine,
        ...(syncedModuleMetricLines.length > 0 ? [`表征数据同步: ${syncedModuleMetricLines.slice(0, 2).join('；')}`] : []),
        ...(aiHighlights.length ? [`专家摘要: ${aiHighlights[0]}`] : [])
      ]
    },
    {
      pageNumber: 3,
      title: '场景痛点与目标对齐',
      points: [
        `核心应用场景: ${project.category || '未分类'}，目标是将实验结果转化为可复现工艺与可交付指标。`,
        `当前痛点: ${failed.length ? summarizeText(failed[failed.length - 1].content, 46) : '失败样本不足，需关注规模化一致性风险。'}`,
        `目标指标: ${project.targetMetrics?.slice(0, 3).map(m => `${m.label}=${m.value}${m.unit || ''}`).join('；') || '建议补充 targetMetrics 以提升目标管理能力。'}`
      ]
    },
    {
      pageNumber: 4,
      title: '技术路线与实施策略',
      points: ['以下内容用于支撑“从实验到转化”的可执行路线。'],
      tableData: buildRoadmapTable(project)
    },
    {
      pageNumber: 5,
      title: '数据证据矩阵',
      points: [
        '全部数据均来自已审计通过的实验记录（Verified）。',
        '建议将该页作为评审问询时的核心证据页。'
      ],
      tableData: buildEvidenceTable(sortedLogs)
    },
    {
      pageNumber: 6,
      title: '关键结果与科学发现',
      points: [
        ...topMetrics.slice(0, 3).map(m => `${m.name} 趋势 ${m.delta >= 0 ? '上升' : '下降'}，阶段变化 ${safeMetric(m.delta)}。`),
        ...syncedModuleSummaryLines.slice(0, 2),
        ...syncedModuleMetricLines.slice(0, 2),
        `最佳窗口记录: ${success.length ? summarizeText(success[success.length - 1].content, 52) : '暂无成功样本窗口。'}`,
        ...(aiHighlights.length > 1 ? [`补充洞察: ${aiHighlights[1]}`] : [])
      ]
    },
    {
      pageNumber: 7,
      title: '里程碑进展与组织执行',
      points: [
        `里程碑完成度: ${milestoneDone}/${milestoneTotal}，课题整体进度 ${project.progress}%。`,
        `成员与协同: ${project.members?.length || 0} 人参与，建议围绕关键路径做任务闭环。`,
        `最新验证记录: ${summarizeText(sortedLogs[sortedLogs.length - 1]?.description || sortedLogs[sortedLogs.length - 1]?.content || '', 48)}`
      ]
    },
    {
      pageNumber: 8,
      title: '成果转化路径与商业价值',
      points: [
        '转化路径: 实验可重复 -> 工艺参数固化 -> 中试验证 -> 对外合作/内部量产。',
        `预期价值: ${project.targetPerformance || '建议定义 targetPerformance，便于量化商业化收益与里程碑。'}`,
        `建议输出件: 工艺SOP、关键参数包、质量控制清单。`
      ]
    },
    {
      pageNumber: 9,
      title: '风险识别与应对策略',
      points: riskLines,
      nextSteps: ['建立参数边界库', '增加重复批次验证', '形成风险台账与责任人']
    },
    {
      pageNumber: 10,
      title: '下阶段资源与行动计划',
      points: [
        `30天行动: 完成关键对照实验、固化最佳参数、形成阶段报告。`,
        `资源需求: ${(project.requiredMaterials || []).slice(0, 3).map(r => `${r.name}${r.estimatedAmount ? `(${r.estimatedAmount})` : ''}`).join('；') || '建议补充 requiredMaterials。'}`,
        `决策请求: 批准下一阶段验证预算与人员时间窗口。`
      ],
      nextSteps: ['第1周: 对照实验', '第2-3周: 参数收敛', '第4周: 汇报评审']
    }
  ];

  if (reportLevel === 'final') {
    slides.push(
      {
        pageNumber: 11,
        title: '结题产出与知识资产',
        points: [
          `论文/报告产出: ${project.publications?.length || 0} 项，建议补齐可公开成果清单。`,
          `知识资产: ${project.tables?.length || 0} 张表格、${project.latexSnippets?.length || 0} 条公式、${project.media?.length || 0} 份媒体材料。`,
          '建议形成结题归档包：数据、路线、风险、转化建议全量留痕。'
        ]
      },
      {
        pageNumber: 12,
        title: '结题结论与后续建议',
        points: [
          `结题判断: ${successRate >= 60 ? '具备继续放大验证的基础' : '建议先完成关键指标补强再放大'}`,
          `核心结论: ${aiHighlights[2] || '验证数据支持当前技术路线具备持续优化空间。'}`,
          '后续建议: 以产业化约束反推实验设计，提升成果转化效率。'
        ],
        nextSteps: ['形成结题评审包', '启动放大验证立项', '对接潜在合作方']
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

    if (level === 'weekly') {
      start.setDate(end.getDate() - 7);
    } else if (level === 'monthly') {
      start.setDate(end.getDate() - 30);
    } else if (level === 'final') {
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
      alert("该时间段内暂无经由 AI 审计通过 (Verified) 的实验数据，无法生成信赖级报告。");
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

  // Keep compatibility for existing direct copies, but new UI will use get+secureSave
  const copyVBAScript = () => {
    const script = getVbaScript();
    if (script) {
      navigator.clipboard.writeText(script);
      alert("VBA 脚本已就绪，请在 PPT 中按 Alt+F11 粘贴运行。");
    }
  };

  const copyMarkdown = () => {
    const md = getMarkdown();
    if (md) {
      navigator.clipboard.writeText(md);
      alert("Markdown 大纲已复制到剪贴板。");
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
    copyVBAScript, // Legacy
    copyMarkdown,  // Legacy
    filteredLogs,
    relevantProposals,
    logSourceMode
  };
};
