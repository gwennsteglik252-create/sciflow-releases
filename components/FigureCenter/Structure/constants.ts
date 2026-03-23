
import { NodeType } from './types';

export const NODE_THEMES: Record<NodeType, { bg: string, border: string, header: string, text: string, iconColor: string }> = {
  // Colors darkened for better contrast (Text changed from ~500/600 weight to ~800/900 weight)
  input: { bg: 'bg-[#F2F4F8]', border: 'border-[#BDC3C7]', header: 'bg-[#BDC3C7]', text: 'text-[#1e293b]', iconColor: 'text-[#0f172a]' }, // Slate / Concrete
  process: { bg: 'bg-[#F0F4EF]', border: 'border-[#A3BFA8]', header: 'bg-[#A3BFA8]', text: 'text-[#14532d]', iconColor: 'text-[#064e3b]' }, // Sage Green (Darker text)
  decision: { bg: 'bg-[#F5EFF5]', border: 'border-[#C4B7CB]', header: 'bg-[#C4B7CB]', text: 'text-[#4c1d95]', iconColor: 'text-[#3b0764]' }, // Dusty Purple (Darker text)
  output: { bg: 'bg-[#F9F0F0]', border: 'border-[#DDB6B6]', header: 'bg-[#DDB6B6]', text: 'text-[#7f1d1d]', iconColor: 'text-[#450a0a]' }  // Muted Rose (Darker text)
};

export const COLOR_MAP: Record<string, any> = {
  slate: { border: 'border-slate-300', bg: 'bg-slate-50', header: 'bg-slate-200', text: 'text-slate-800', iconColor: 'text-slate-900' },
  indigo: { border: 'border-indigo-300', bg: 'bg-indigo-50', header: 'bg-indigo-200', text: 'text-indigo-800', iconColor: 'text-indigo-900' },
  emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50', header: 'bg-emerald-200', text: 'text-emerald-800', iconColor: 'text-emerald-900' },
  amber: { border: 'border-amber-300', bg: 'bg-amber-50', header: 'bg-amber-200', text: 'text-amber-800', iconColor: 'text-amber-900' },
  rose: { border: 'border-rose-300', bg: 'bg-rose-50', header: 'bg-rose-200', text: 'text-rose-800', iconColor: 'text-rose-900' },
  blue: { border: 'border-blue-300', bg: 'bg-blue-50', header: 'bg-blue-200', text: 'text-blue-800', iconColor: 'text-blue-900' },
  violet: { border: 'border-violet-300', bg: 'bg-violet-50', header: 'bg-violet-200', text: 'text-violet-800', iconColor: 'text-violet-900' },
};

export const ACADEMIC_PALETTES = [
  // === 顶刊风格系列 (Journal-Inspired) ===
  { name: 'Nature', colors: ['#2166AC', '#67A9CF', '#F7F7F7', '#EF8A62', '#B2182B'], desc: 'Nature 经典 Diverging — 蓝白红渐变，适合对比/分类流程' },
  { name: 'Science', colors: ['#1B4F72', '#2E86C1', '#85C1E9', '#F0B27A', '#CA6F1E'], desc: 'Science 蓝橙系 — 冷暖对比鲜明而不失优雅' },
  { name: 'Cell', colors: ['#4A235A', '#7D3C98', '#AF7AC5', '#F5CBA7', '#E67E22'], desc: 'Cell 紫橙系 — 生物医学常用高辨识配色' },
  { name: 'JACS', colors: ['#1A237E', '#283593', '#5C6BC0', '#9FA8DA', '#C5CAE9'], desc: 'JACS 深靛蓝序列 — 单色渐变，端庄典雅' },
  { name: 'Angew. Chem.', colors: ['#004D40', '#00897B', '#4DB6AC', '#E0F2F1', '#FF6F00'], desc: 'Angew 青绿+点缀橙 — 清透兼具视觉焦点' },
  { name: 'ACS Nano', colors: ['#0D47A1', '#E53935', '#43A047', '#FB8C00', '#8E24AA'], desc: 'ACS Nano 多色均衡 — 每色辨识度极高，适合多步流程' },

  // === 科学领域配色 (Domain-Specific) ===
  { name: 'Electrochemistry', colors: ['#1565C0', '#0277BD', '#00838F', '#00695C', '#2E7D32'], desc: '冷色梯度 — 电化学/催化/能源' },
  { name: 'Biomedical', colors: ['#AD1457', '#6A1B9A', '#4527A0', '#283593', '#1565C0'], desc: '紫红蓝过渡 — 生物医学/药学/基因组学' },
  { name: 'Materials Science', colors: ['#37474F', '#546E7A', '#78909C', '#B0BEC5', '#D84315'], desc: '钢灰+赤橙点缀 — 材料/金属/纳米结构' },
  { name: 'Organic Synthesis', colors: ['#1B5E20', '#388E3C', '#66BB6A', '#FDD835', '#E65100'], desc: '绿黄橙渐变 — 有机合成/化学反应路径' },
  { name: 'Computational', colors: ['#311B92', '#4527A0', '#5E35B1', '#7E57C2', '#B39DDB'], desc: '紫罗兰梯度 — 计算/理论/模拟' },

  // === 经典学术色板 (Classic Academic) ===
  { name: 'Tableau 10', colors: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F'], desc: 'Tableau 学术十色前五 — 数据可视化黄金标准' },
  { name: 'ColorBrewer Set1', colors: ['#E41A1C', '#377EB8', '#4DAF4A', '#984EA3', '#FF7F00'], desc: 'Brewer Set1 — 学术论文最广泛引用的分类色板' },
  { name: 'Wong (色盲友好)', colors: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9'], desc: 'Wong 色盲友好 — Nature Methods 推荐的无障碍配色' },
  { name: 'Tol Muted', colors: ['#332288', '#88CCEE', '#44AA99', '#DDCC77', '#CC6677'], desc: 'Paul Tol Muted — 柔和低饱和，适合印刷出版' },

  // === 极简高级系列 (Minimalist Premium) ===
  { name: 'Monochrome Ink', colors: ['#212121', '#424242', '#757575', '#BDBDBD', '#E0E0E0'], desc: '纯灰度 — 极简黑白，最适合线稿/示意图' },
  { name: 'Nordic Frost', colors: ['#2E3440', '#5E81AC', '#88C0D0', '#A3BE8C', '#EBCB8B'], desc: '北欧极光 — 沉静优雅，低饱和高级感' },
  { name: 'Deep Ocean', colors: ['#0C2340', '#1B4D6E', '#2980B9', '#5DADE2', '#AED6F1'], desc: '深海蓝梯度 — 高端清透，适合工艺/系统流程' },
];


export const hslToHex = (h: number, s: number, l: number) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const OMICS_DATA = {
  groups: [
    {
      id: 'g1', title: 'Data Acquisition', type: 'container' as const,
      nodes: [
        { id: 'n1', text: 'RNA Sequencing', subText: 'Illumina NovaSeq', type: 'input' as const, icon: 'fa-dna', params: ['Depth: 30X', 'PE150'] },
        { id: 'n2', text: 'Mass Spectrometry', subText: 'Orbitrap Fusion', type: 'input' as const, icon: 'fa-chart-bar', params: ['Res: 120k', 'DDA Mode'] }
      ]
    },
    {
      id: 'g2', title: 'Bioinformatics Processing', type: 'container' as const,
      nodes: [
        { id: 'n3', text: 'Quality Control', subText: 'FastQC / Trimmomatic', type: 'decision' as const, icon: 'fa-filter', params: ['Q30 > 90%', 'Adapter < 1%'] },
        { id: 'n4', text: 'Differential Analysis', subText: 'DESeq2 / MaxQuant', type: 'process' as const, icon: 'fa-laptop-code', params: ['log2FC > 1', 'FDR < 0.05'] }
      ]
    },
    {
      id: 'g3', title: 'Integration & Insight', type: 'container' as const,
      nodes: [
        { id: 'n5', text: 'Pathway Enrichment', subText: 'KEGG / GO', type: 'output' as const, icon: 'fa-network-wired', params: ['P < 0.01'] }
      ]
    }
  ],
  connections: [
    { from: 'n1', to: 'n3', label: 'Raw Reads' },
    { from: 'n2', to: 'n3', label: 'Raw Spectra' },
    { from: 'n3', to: 'n4', label: 'Clean Data' },
    { from: 'n4', to: 'n5', label: 'Candidates' }
  ]
};

export const FRAMEWORK_DATA = {
  groups: [
    {
      id: 'f1', title: 'Theoretical Foundation', type: 'container' as const,
      nodes: [
        { id: 'fn1', text: 'Literature Review', subText: 'Current State', type: 'input' as const, icon: 'fa-book-open', params: ['N=120 Ref', 'Gap Analysis'] },
        { id: 'fn2', text: 'Hypothesis', subText: 'Core Proposition', type: 'decision' as const, icon: 'fa-lightbulb', params: ['Variable A', 'Variable B'] }
      ]
    },
    {
      id: 'f2', title: 'Experimental Design', type: 'container' as const,
      nodes: [
        { id: 'fn3', text: 'Methodology', subText: 'Dual-Arm Trial', type: 'process' as const, icon: 'fa-vials', params: ['Control Grp', 'Exp Grp'] },
        { id: 'fn4', text: 'Data Collection', subText: 'Longitudinal', type: 'process' as const, icon: 'fa-database', params: ['T=0, 3, 6m', 'Compliance'] }
      ]
    },
    {
      id: 'f3', title: 'Conclusion', type: 'container' as const,
      nodes: [
        { id: 'fn5', text: 'Statistical Analysis', subText: 'ANOVA / Regression', type: 'output' as const, icon: 'fa-chart-pie', params: ['Significance'] }
      ]
    }
  ],
  connections: [
    { from: 'fn1', to: 'fn2', label: 'Synthesis' },
    { from: 'fn2', to: 'fn3', label: 'Design' },
    { from: 'fn3', to: 'fn4', label: 'Execution' },
    { from: 'fn4', to: 'fn5', label: 'Validation' }
  ]
};
