
import React from 'react';
import { Literature, ResearchProject, AppTheme, InventoryItem, UserProfile, Publication, SavedInception } from './types';

// Define and export Icons used across the application
export const Icons = {
  Dashboard: (() => <i className="fa-solid fa-house-chimney"></i>) as React.FC,
  Project: (() => <i className="fa-solid fa-vials"></i>) as React.FC,
  Literature: (() => <i className="fa-solid fa-book-atlas"></i>) as React.FC,
  Assistant: (() => <i className="fa-solid fa-wand-magic-sparkles"></i>) as React.FC,
  Team: (() => <i className="fa-solid fa-id-card-clip"></i>) as React.FC,
  Search: (() => <i className="fa-solid fa-magnifying-glass"></i>) as React.FC,
  Plus: (() => <i className="fa-solid fa-plus"></i>) as React.FC,
};

export const APP_THEMES: AppTheme[] = [
  {
    id: 'clean_light',
    name: '经典护眼',
    type: 'light',
    colors: {
      background: '#F1F5F9',
      sidebar: 'bg-white/80',
      sidebarBorder: 'border-slate-200',
      text: 'text-slate-800'
    }
  },
  {
    id: 'cyber_blue',
    name: '赛博极客',
    type: 'dark',
    colors: {
      background: '#0F172A',
      sidebar: 'bg-slate-900/95',
      sidebarBorder: 'border-white/5',
      text: 'text-indigo-400'
    }
  },
  {
    id: 'emerald_lab',
    name: '翡翠实验室',
    type: 'light',
    colors: {
      background: '#F0FDF4',
      sidebar: 'bg-white/70',
      sidebarBorder: 'border-emerald-100',
      text: 'text-emerald-900'
    }
  },
  {
    id: 'paper_white',
    name: '学术纸墨',
    type: 'light',
    colors: {
      background: '#FFFFFF',
      sidebar: 'bg-slate-50/90',
      sidebarBorder: 'border-slate-200',
      text: 'text-black'
    }
  },
  {
    id: 'midnight_oil',
    name: '深海探索',
    type: 'dark',
    colors: {
      background: '#020617',
      sidebar: 'bg-black/80',
      sidebarBorder: 'border-white/10',
      text: 'text-sky-300'
    }
  },
  {
    id: 'sunset_amber',
    name: '暖阳逻辑',
    type: 'light',
    colors: {
      background: '#FFFBEB',
      sidebar: 'bg-white/60',
      sidebarBorder: 'border-orange-100',
      text: 'text-amber-950'
    }
  }
];

export const MOCK_INCEPTION_DRAFTS: SavedInception[] = [
  {
    id: 'inception_aem_001',
    title: '高载量银基 AEM 膜电极催化剂的表界面调控',
    timestamp: '2026-02-10 10:00:00',
    sessionData: {
      stage: 'review',
      domain: 'AEM, 电解水, 银基催化剂, 低贵金属',
      suggestions: [],
      selectedTopic: {
        title: '高载量银基 AEM 膜电极催化剂的表界面调控',
        evolution: '从块体银电极向高分散纳米片/簇演进',
        painPoint: '碱性高电位下银的稳定性与团聚问题',
        hypothesis: '通过 ALD 沉积单原子过渡金属壳层可诱发界面张力，大幅提升稳定性',
        impact: '将 AEM 制氢成本降低 30% 以上',
        estimatedTrl: 3
      },
      landscape: {
        activeLabs: [
          { name: 'Stanford Nanocatalysis Lab', leader: 'Dr. Yi Cui', contribution: '银基纳米结构合成' },
          { name: '中科院大连化物所', leader: '张涛', contribution: '单原子催化机理' },
          { name: 'Max Planck Institute', leader: 'Dr. Strasser', contribution: '原位能谱分析' }
        ],
        commercialStatus: '目前市场主流为铂/铱体系，银基 AEM 正处于实验室向中试过渡的窗口期',
        patentRisks: [
          { description: 'US Patent 10,821,XXX: 涉及银纳米线在碱性介质的修饰方法' },
          { description: 'CN Patent 114,XXX: 涉及双金属界面应力调控的通用权利要求' }
        ],
        researchGaps: [
          { content: '缺乏在 2A/cm² 大电流密度下长期运行（>500h）的晶格演变原位证据', urgency: 'high' }
        ],
        sources: ['https://nature.com/articles/s41560', 'https://pubs.acs.org/jacs'],
        hotnessData: [
          { id: 'h1', topic: 'Ag-Ni 协同效应', x: 20, y: 85, val: 92, isBlueOcean: true, competitors: ['Lab A', 'Lab B'], trend: [20, 35, 50, 80, 95] },
          { id: 'h2', topic: '非贵金属掺杂', x: 80, y: 90, val: 85, isBlueOcean: false, competitors: ['Global Generic'], trend: [90, 95, 95, 90, 85] },
          { id: 'h3', topic: 'ALD 界面工程', x: 15, y: 60, val: 78, isBlueOcean: true, competitors: ['Specialist Groups'], trend: [10, 20, 45, 60, 80] }
        ]
      },
      review: {
        rigorousReview: '科学假设具备自洽性，但需补充 1.0M KOH 下的溶出极化曲线对比。',
        innovativeReview: 'ALD 与 Ag 的结合在 AEM 领域非常新颖，建议申报高新原创课题。',
        engineeringReview: '需要考虑大规模生产时的前驱体利用率。',
        overallScore: 88
      }
    }
  }
];

export const MOCK_TEAM: UserProfile[] = [
  {
    name: 'Dr. Elena Vance',
    role: '高级材料合成专家',
    id: 'SF-MEM-001',
    department: '金属材料研究所',
    projectGroup: '二次电池组',
    securityLevel: '机密',
    institution: 'SciFlow 前沿实验室',
    researchArea: '纳米材料受控合成与表面改性',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena',
    gender: 'Female',
    scientificTemperament: 'Optimizer',
    expertise: ['水热合成', 'ALD 沉积', '二维材料'],
    expertiseMetrics: [
      { subject: '合成制备', A: 95, fullMark: 100 },
      { subject: '性能表征', A: 70, fullMark: 100 },
      { subject: '理论计算', A: 40, fullMark: 100 },
      { subject: '工程放大', A: 85, fullMark: 100 },
      { subject: '数据挖掘', A: 60, fullMark: 100 },
    ],
    workload: 45,
    mastery: [
      { name: '原子层沉积 (ALD)', level: 9 },
      { name: '水热反应釜操作', level: 10 }
    ]
  },
  {
    name: 'Dr. Marcus Miller',
    role: '资深表征科学家',
    id: 'SF-MEM-002',
    department: '应用物理研究所',
    projectGroup: '技术前瞻组',
    securityLevel: '绝密',
    institution: 'SciFlow 前沿实验室',
    researchArea: '同步辐射 XAFS 与原位能谱分析',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus',
    gender: 'Male',
    scientificTemperament: 'Skeptic',
    expertise: ['原位拉曼', '同步辐射', '球差电镜'],
    expertiseMetrics: [
      { subject: '合成制备', A: 40, fullMark: 100 },
      { subject: '性能表征', A: 98, fullMark: 100 },
      { subject: '理论计算', A: 80, fullMark: 100 },
      { subject: '工程放大', A: 30, fullMark: 100 },
      { subject: '数据挖掘', A: 90, fullMark: 100 },
    ],
    workload: 65,
    mastery: [
      { name: '透射电镜 (TEM)', level: 10 },
      { name: 'XPS 能谱分析', level: 9 }
    ]
  },
  {
    name: 'Sarah Chen',
    role: '仿真计算研究员',
    id: 'SF-MEM-003',
    department: '量子化学研究室',
    projectGroup: '氢能电解水组',
    securityLevel: '内部',
    institution: 'SciFlow 前沿实验室',
    researchArea: '多尺度动力学模拟与机器学习能势',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria',
    gender: 'Female',
    scientificTemperament: 'Explorer',
    expertise: ['DFT 计算', '机器学习', '多尺度模拟'],
    expertiseMetrics: [
      { subject: '合成制备', A: 30, fullMark: 100 },
      { subject: '性能表征', A: 60, fullMark: 100 },
      { subject: '理论计算', A: 96, fullMark: 100 },
      { subject: '工程放大', A: 20, fullMark: 100 },
      { subject: '数据挖掘', A: 92, fullMark: 100 },
    ],
    workload: 30,
    mastery: [
      { name: 'VASP 软件操作', level: 9 },
      { name: 'Python 数据挖掘', level: 10 }
    ]
  }
];

export const MOCK_PROJECTS: ResearchProject[] = [
  {
    id: 'oer_silver_2026',
    title: '高载量银基 AEM 膜电极催化剂的表界面调控与工业放大研究',
    category: '新能源',
    description: '本项目旨在解决阴离子交换膜（AEM）制氢中，银基催化剂在碱性高电位下易团聚、稳定性不足的问题。通过原子层沉积（ALD）技术在 Ag 纳米颗粒表面构筑单原子 Ni 层，实现协同催化效应。',
    status: 'In Progress',
    deadline: '2026-12-31',
    progress: 42,
    trl: 3,
    members: ['Dr. Elena Vance', 'Dr. Marcus Miller', 'Sarah Chen'],
    keywords: ['Ag', 'AEM制氢', '界面调控', 'ALD'],
    targetMetrics: [
      { label: '过电位 @10mA/cm²', value: '250', unit: 'mV', weight: 0.8, isHigherBetter: false },
      { label: 'Tafel Slope', value: '45', unit: 'mV/dec', weight: 0.6, isHigherBetter: false },
      { label: '500h 稳定性', value: '95', unit: '%', weight: 1.0, isHigherBetter: true }
    ],
    milestones: [
      {
        id: 'ms_1',
        title: 'DFT 活性位点筛选与能垒解算',
        hypothesis: 'Ni-Ag 界面电荷转移可将 d 带中心移向费米面，优化 OH* 吸附能。',
        status: 'completed',
        dueDate: '2026-02-01',
        logs: [
          {
            id: 'log_101',
            timestamp: '2026-01-20 14:30',
            content: '执行 Ni-Ag (111) 界面态密度 analysis',
            description: '通过 VASP 软件计算了不同 Ni 载量下的 PDOS，发现 Ni 原子倾向于占据 Ag 的空位，且显著拓宽了 d 带宽度。',
            parameters: 'DFT-PBE, Cutoff: 400eV, K-Mesh: 4x4x1',
            status: 'Verified',
            result: 'success',
            scientificData: { 'd-Band Center': -2.35, 'Binding Energy': -4.52 },
            summaryInsight: '计算结果表明 Ni-Ag 协同效应能有效平衡 OER 中间体的吸附。'
          }
        ],
        chatHistory: [],
        experimentalPlan: [],
        savedDocuments: []
      },
      {
        id: 'ms_2',
        title: 'ALD 受控合成与形貌表征',
        hypothesis: 'ALD 循环数可精准控制 Ni 壳层厚度，避免体积效应。',
        status: 'in-progress',
        dueDate: '2026-03-15',
        logs: [],
        chatHistory: [],
        experimentalPlan: [
          {
            id: 'plan_1',
            title: 'L9 正交优化：ALD 前驱体脉冲时间对覆盖度的影响',
            status: 'executing',
            notes: '重点监测 150C 时的反应窗口',
            parameters: {},
            matrix: [
              { name: '温度', target: 'C', range: '120, 150, 180' },
              { name: '脉冲时间', target: 's', range: '0.1, 0.5, 1.0' }
            ],
            runs: [
              { idx: 1, params: { '温度': '120', '脉冲时间': '0.1' }, status: 'executed', logId: 'log_201' },
              { idx: 2, params: { '温度': '150', '脉冲时间': '0.5' }, status: 'pending' }
            ]
          }
        ],
        savedDocuments: []
      }
    ],
    weeklyPlans: [
      {
        id: 'week_cur',
        type: 'weekly',
        startDate: '2026-02-09',
        endDate: '2026-02-15',
        status: 'in-progress',
        completionRate: 35,
        goals: [{ id: 'g1', text: "完成 ALD 样品的首批电化学初筛", completed: false }],
        tasks: [
          { id: 't1', title: "制备 20 个循环的 Ni-Ag 标准样", status: "pending", assignedDay: 1, assignedTo: ["Dr. Elena Vance"] },
          { id: 't2', title: "执行原位拉曼观测 O-O 键合", status: "pending", assignedDay: 2, assignedTo: ["Dr. Marcus Miller"] }
        ],
        periodStatus: ['exp', 'ana', 'idle', 'idle', 'idle', 'idle', 'idle'],
        dailyLogs: ["ALD 系统维护完成", "发现 580 cm-1 处有异常峰信号", "", "", "", "", ""]
      }
    ],
    matrices: [
      {
        id: 'mat_oer',
        title: 'OER 动力学参数库',
        data: [
          { id: 's1', sampleId: 'Ni-Ag-20c', timestamp: '2026-02-05', processParams: { 'Temp': 150, 'Cycles': 20 }, results: { 'Overpotential': 265, 'Tafel': 42 }, source: 'workflow' },
          { id: 's2', sampleId: 'Pure-Ag', timestamp: '2026-02-05', processParams: { 'Temp': 150, 'Cycles': 0 }, results: { 'Overpotential': 380, 'Tafel': 85 }, source: 'workflow' }
        ]
      }
    ],
    circularSummary: {
      title: "银基催化剂体系综述",
      coreIcon: "fa-atom",
      layers: [
        {
          id: "l1", name: "微观机理层",
          segments: [
            { id: "s1", title: "d带调控", content: "通过掺杂实现电子重构", color: "#6366f1", imagePrompt: "Abstract molecular bonding of Ni and Ag atoms, 3D render, high detail" },
            { id: "s2", title: "界面应力", content: "晶格错配诱发的压缩应变", color: "#8b5cf6", imagePrompt: "Crystalline lattice structure showing compression, atomic scale, photorealistic" }
          ]
        }
      ]
    }
  }
];

export const MOCK_LITERATURE: Literature[] = [
  {
    id: 'lit_nature_2025', projectId: 'oer_silver_2026', type: '文献',
    category: '核心理论',
    title: 'Atomic-scale modulation of silver surfaces for efficient AEM water splitting',
    authors: ['Li, M.', 'Wang, J.'], year: 2025, source: 'NATURE NANOTECHNOLOGY',
    abstract: '本文报道了一种通过单原子沉积技术在银表面构筑协同活性位点的方法，将 OER 过电位降低至 230mV...',
    tags: ['Ag', 'AEM', 'OER'],
    performance: [
      { label: 'Overpotential', value: '230 mV' },
      { label: 'Durability', value: '1500 h' }
    ],
    synthesisSteps: [
      { step: 1, title: '载体预处理', content: '将银纳米颗粒在 300C 氢气还原 2 小时。' },
      { step: 2, title: 'Ni原子沉积', content: '使用 ALD 循环 5 次，温度控制在 150C。' }
    ],
    knowledgeSinked: true
  }
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'inv_ag_nitrate', name: '硝酸银', formula: 'AgNO3', category: 'Precursor', purity: '99.99%', quantity: 50, unit: 'g', threshold: 10, location: 'A101-冷柜-2', safetyLevel: 'Corrosive', lastUpdated: '2026-02-01', status: 'Ready' },
  { id: 'inv_pot_hydroxide', name: '氢氧化钾', formula: 'KOH', category: 'Chemical', purity: 'AR', quantity: 500, unit: 'g', threshold: 100, location: 'C302-化学柜-1', safetyLevel: 'Corrosive', lastUpdated: '2026-02-01', status: 'Ready' },
  { id: 'inv_autolab', name: '电化学工作站', brand: 'Metrohm', model: 'PGSTAT302N', category: 'Hardware', quantity: 1, unit: '台', threshold: 0, location: 'D405-测试室', safetyLevel: 'Safe', status: 'In Use', lastUpdated: '2026-02-05' }
];
