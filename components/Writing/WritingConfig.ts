
import { PaperSectionId, LevelStyle } from '../../types';

export type DocType = 'paper' | 'report' | 'patent';

export const SECTION_CONFIG: Record<DocType, { id: string; label: string; icon: string }[]> = {
  paper: [
    { id: 'abstract', label: 'Abstract', icon: 'fa-regular fa-file-lines' },
    { id: 'introduction', label: 'Introduction', icon: 'fa-solid fa-heading' },
    { id: 'methods', label: 'Methods', icon: 'fa-solid fa-flask' },
    { id: 'results', label: 'Results', icon: 'fa-solid fa-square-poll-vertical' },
    { id: 'discussion', label: 'Discussion', icon: 'fa-regular fa-comments' },
    { id: 'references', label: 'References', icon: 'fa-solid fa-floppy-disk' },
  ],
  report: [
    { id: 'exec_summary', label: '执行摘要', icon: 'fa-solid fa-briefcase' },
    { id: 'plan_actual', label: '进度对比', icon: 'fa-solid fa-chart-gantt' },
    { id: 'conclusions', label: '关键结论', icon: 'fa-solid fa-lightbulb' },
    { id: 'next_steps', label: '后续计划', icon: 'fa-solid fa-forward' },
  ],
  patent: [
    { id: 'background', label: '背景技术', icon: 'fa-solid fa-clock-rotate-left' },
    { id: 'tech_solution', label: '技术方案', icon: 'fa-solid fa-puzzle-piece' },
    { id: 'claims', label: '权利要求书', icon: 'fa-solid fa-gavel' },
    { id: 'embodiment', label: '具体实施方式', icon: 'fa-solid fa-flask-vial' },
  ]
};

export interface TemplateConfig {
  id: string;
  name: string;
  docType: DocType;
  columns: number;
  fontFamily: string;
  citationStyle: 'numbered' | 'author-year';
  logo: string;
  figLabel: string;
  tableLabel: string;
  figSeparator: string;
  // 强制同步的排版预设 — 严格遵循期刊投稿规范
  styles: {
    h1: LevelStyle;
    h2: LevelStyle;
    h3: LevelStyle;
    abstract: {
      fontSize: number;
      fontFamily: string;
      lineHeight: number;
      italic: boolean;
    };
    keywords: {
      fontSize: number;
      fontFamily: string;
      fontWeight: string;
      color: string;
    };
    // 正文段落排版
    body: {
      fontSize: number;       // pt
      fontFamily: string;     // 字体族
      lineHeight: number;     // 行距倍数
      textIndent: number;     // 首行缩进 (em), 0 = 无缩进
      color: string;
      paragraphSpacing: number; // 段间距 (pt)
    };
    // 参考文献条目
    references: {
      fontSize: number;
      fontFamily: string;
      lineHeight: number;
    };
    // 图注样式
    figCaption: {
      fontSize: number;
      fontFamily: string;
      labelFontWeight: string;  // 如 "Figure 1." 的粗细
    };
    // 表格标题 & 单元格
    tableCaption: {
      fontSize: number;
      fontFamily: string;
    };
    tableCell: {
      fontSize: number;
      fontFamily: string;
    };
    // 论文标题
    title: {
      fontSize: number;
      fontFamily: string;
      fontWeight: string;
    };
    // 作者信息
    authors: {
      fontSize: number;
      fontFamily: string;
    };
    // 单位信息
    affiliations: {
      fontSize: number;
      fontFamily: string;
      fontStyle: string;
    };
  };
}

export const TEMPLATES: TemplateConfig[] = [
  {
    id: 'csb_zh',
    name: 'Chinese Science Bulletin (科学通报)',
    docType: 'paper',
    columns: 2,
    fontFamily: 'font-serif',
    citationStyle: 'numbered',
    logo: 'CSB',
    figLabel: '图',
    tableLabel: '表',
    figSeparator: '.',
    styles: {
      h1: { fontSize: 12, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'SimHei, sans-serif', showUnderline: false, numberingType: 'arabic' },
      h2: { fontSize: 10.5, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'SimHei, sans-serif', showSidebar: false, numberingType: 'arabic' },
      h3: { fontSize: 9.5, indent: 0, fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'SimHei, sans-serif', showUnderline: false, numberingType: 'arabic' },
      abstract: { fontSize: 9, fontFamily: 'SimSun, serif', lineHeight: 1.5, italic: false },
      keywords: { fontSize: 9, fontFamily: 'SimSun, serif', fontWeight: 'normal', color: '#000000' },
      body: { fontSize: 9, fontFamily: 'SimSun, serif', lineHeight: 1.5, textIndent: 2, color: '#000000', paragraphSpacing: 6 },
      references: { fontSize: 8, fontFamily: 'SimSun, serif', lineHeight: 1.4 },
      figCaption: { fontSize: 8, fontFamily: 'SimSun, serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 8.5, fontFamily: 'SimSun, serif' },
      tableCell: { fontSize: 8.5, fontFamily: 'SimSun, serif' },
      title: { fontSize: 18, fontFamily: 'SimHei, sans-serif', fontWeight: '900' },
      authors: { fontSize: 10, fontFamily: 'SimSun, serif' },
      affiliations: { fontSize: 8, fontFamily: 'SimSun, serif', fontStyle: 'normal' }
    }
  },
  {
    id: 'nature',
    name: 'Nature (Double Column)',
    docType: 'paper',
    columns: 2,
    fontFamily: 'font-serif',
    citationStyle: 'numbered',
    logo: 'N',
    figLabel: 'Fig.',
    tableLabel: 'Table',
    figSeparator: ' |',
    styles: {
      h1: { fontSize: 10.5, indent: 0, fontWeight: 'black', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', showUnderline: false, numberingType: 'none' },
      h2: { fontSize: 9.5, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', showSidebar: false, numberingType: 'none' },
      h3: { fontSize: 9, indent: 0, fontWeight: 'normal', fontStyle: 'italic', fontFamily: 'Arial, sans-serif', showUnderline: false, numberingType: 'none' },
      abstract: { fontSize: 9, fontFamily: 'Arial, sans-serif', lineHeight: 1.5, italic: false },
      keywords: { fontSize: 8.5, fontFamily: 'Arial, sans-serif', fontWeight: 'normal', color: '#1e293b' },
      body: { fontSize: 8.5, fontFamily: 'Arial, sans-serif', lineHeight: 1.5, textIndent: 0, color: '#000000', paragraphSpacing: 8 },
      references: { fontSize: 7.5, fontFamily: 'Arial, sans-serif', lineHeight: 1.3 },
      figCaption: { fontSize: 7.5, fontFamily: 'Helvetica, Arial, sans-serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 7.5, fontFamily: 'Helvetica, Arial, sans-serif' },
      tableCell: { fontSize: 7.5, fontFamily: 'Helvetica, Arial, sans-serif' },
      title: { fontSize: 18, fontFamily: 'Arial, sans-serif', fontWeight: '900' },
      authors: { fontSize: 10, fontFamily: 'Arial, sans-serif' },
      affiliations: { fontSize: 8, fontFamily: 'Arial, sans-serif', fontStyle: 'italic' }
    }
  },
  {
    id: 'jacs',
    name: 'JACS (Compact Layout)',
    docType: 'paper',
    columns: 2,
    fontFamily: 'font-sans',
    citationStyle: 'numbered',
    logo: 'J',
    figLabel: 'Figure',
    tableLabel: 'Table',
    figSeparator: '.',
    styles: {
      h1: { fontSize: 11, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: '"Times New Roman", serif', showUnderline: false, numberingType: 'roman', uppercase: true },
      h2: { fontSize: 10, indent: 0.5, fontWeight: 'normal', fontStyle: 'italic', fontFamily: '"Times New Roman", serif', showSidebar: false, numberingType: 'alpha' },
      h3: { fontSize: 9.5, indent: 1, fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", serif', showUnderline: false, numberingType: 'arabic' },
      abstract: { fontSize: 9.5, fontFamily: '"Times New Roman", serif', lineHeight: 1.4, italic: true },
      keywords: { fontSize: 9, fontFamily: '"Times New Roman", serif', fontWeight: 'bold', color: '#000000' },
      body: { fontSize: 10, fontFamily: '"Times New Roman", serif', lineHeight: 1.15, textIndent: 0, color: '#000000', paragraphSpacing: 6 },
      references: { fontSize: 8, fontFamily: '"Times New Roman", serif', lineHeight: 1.2 },
      figCaption: { fontSize: 8, fontFamily: '"Times New Roman", serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 8, fontFamily: '"Times New Roman", serif' },
      tableCell: { fontSize: 8, fontFamily: '"Times New Roman", serif' },
      title: { fontSize: 14, fontFamily: '"Times New Roman", serif', fontWeight: '700' },
      authors: { fontSize: 10, fontFamily: '"Times New Roman", serif' },
      affiliations: { fontSize: 8, fontFamily: '"Times New Roman", serif', fontStyle: 'italic' }
    }
  },
  {
    id: 'science',
    name: 'Science Magazine',
    docType: 'paper',
    columns: 2,
    fontFamily: 'font-serif',
    citationStyle: 'numbered',
    logo: 'S',
    figLabel: 'Fig.',
    tableLabel: 'Table',
    figSeparator: '.',
    styles: {
      h1: { fontSize: 12, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Helvetica, sans-serif', showUnderline: false, numberingType: 'none' },
      h2: { fontSize: 11, indent: 0, fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'Helvetica, sans-serif', showSidebar: false, numberingType: 'none' },
      h3: { fontSize: 10, indent: 0, fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'Helvetica, sans-serif', showUnderline: false, numberingType: 'none' },
      abstract: { fontSize: 10, fontFamily: 'Helvetica, sans-serif', lineHeight: 1.6, italic: false },
      keywords: { fontSize: 9, fontFamily: 'Helvetica, sans-serif', fontWeight: 'normal', color: '#334155' },
      body: { fontSize: 9, fontFamily: 'Helvetica, sans-serif', lineHeight: 1.4, textIndent: 0, color: '#000000', paragraphSpacing: 6 },
      references: { fontSize: 7.5, fontFamily: 'Helvetica, sans-serif', lineHeight: 1.3 },
      figCaption: { fontSize: 8, fontFamily: 'Helvetica, sans-serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 8, fontFamily: 'Helvetica, sans-serif' },
      tableCell: { fontSize: 8, fontFamily: 'Helvetica, sans-serif' },
      title: { fontSize: 20, fontFamily: 'Helvetica, sans-serif', fontWeight: '900' },
      authors: { fontSize: 10, fontFamily: 'Helvetica, sans-serif' },
      affiliations: { fontSize: 8, fontFamily: 'Helvetica, sans-serif', fontStyle: 'italic' }
    }
  },
  {
    id: 'cell',
    name: 'Cell Press',
    docType: 'paper',
    columns: 1,
    fontFamily: 'font-sans',
    citationStyle: 'author-year',
    logo: 'Cell',
    figLabel: 'Figure',
    tableLabel: 'Table',
    figSeparator: '.',
    styles: {
      h1: { fontSize: 13, indent: 0, fontWeight: 'black', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', showUnderline: false, numberingType: 'none' },
      h2: { fontSize: 11, indent: 0, fontWeight: 'black', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', showSidebar: false, numberingType: 'none' },
      h3: { fontSize: 10, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'Arial, sans-serif', showUnderline: false, numberingType: 'none' },
      abstract: { fontSize: 11, fontFamily: 'Arial, sans-serif', lineHeight: 1.8, italic: false },
      keywords: { fontSize: 10, fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#000000' },
      body: { fontSize: 10, fontFamily: 'Arial, sans-serif', lineHeight: 1.5, textIndent: 0, color: '#000000', paragraphSpacing: 10 },
      references: { fontSize: 9, fontFamily: 'Arial, sans-serif', lineHeight: 1.4 },
      figCaption: { fontSize: 9, fontFamily: 'Arial, sans-serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 9, fontFamily: 'Arial, sans-serif' },
      tableCell: { fontSize: 9, fontFamily: 'Arial, sans-serif' },
      title: { fontSize: 22, fontFamily: 'Arial, sans-serif', fontWeight: '900' },
      authors: { fontSize: 11, fontFamily: 'Arial, sans-serif' },
      affiliations: { fontSize: 9, fontFamily: 'Arial, sans-serif', fontStyle: 'italic' }
    }
  },
  {
    id: 'report_std',
    name: '通用技术报告模板',
    docType: 'report',
    columns: 1,
    fontFamily: 'font-sans',
    citationStyle: 'numbered',
    logo: 'REP',
    figLabel: '图',
    tableLabel: '表',
    figSeparator: '.',
    styles: {
      h1: { fontSize: 14, indent: 0, fontWeight: 'black', fontStyle: 'normal', fontFamily: 'SimHei, sans-serif', showUnderline: true, underlineColor: '#e2e8f0', numberingType: 'arabic' },
      h2: { fontSize: 12, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'SimHei, sans-serif', showSidebar: false, numberingType: 'arabic' },
      h3: { fontSize: 10.5, indent: 0, fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'SimHei, sans-serif', showUnderline: false, numberingType: 'arabic' },
      abstract: { fontSize: 10.5, fontFamily: 'SimSun, serif', lineHeight: 1.8, italic: false },
      keywords: { fontSize: 10, fontFamily: 'SimSun, serif', fontWeight: 'bold', color: '#1e293b' },
      body: { fontSize: 10.5, fontFamily: 'SimSun, serif', lineHeight: 1.8, textIndent: 2, color: '#000000', paragraphSpacing: 8 },
      references: { fontSize: 9, fontFamily: 'SimSun, serif', lineHeight: 1.5 },
      figCaption: { fontSize: 9, fontFamily: 'SimSun, serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 9, fontFamily: 'SimSun, serif' },
      tableCell: { fontSize: 9, fontFamily: 'SimSun, serif' },
      title: { fontSize: 18, fontFamily: 'SimHei, sans-serif', fontWeight: '900' },
      authors: { fontSize: 12, fontFamily: 'SimSun, serif' },
      affiliations: { fontSize: 10, fontFamily: 'SimSun, serif', fontStyle: 'normal' }
    }
  },
  {
    id: 'patent_std',
    name: '国家发明专利申请书 (CN)',
    docType: 'patent',
    columns: 1,
    fontFamily: 'font-serif',
    citationStyle: 'numbered',
    logo: 'PAT',
    figLabel: '图',
    tableLabel: '表',
    figSeparator: '.',
    styles: {
      h1: { fontSize: 12, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'SimSun, serif', showUnderline: false, numberingType: 'none', uppercase: false },
      h2: { fontSize: 12, indent: 0, fontWeight: 'bold', fontStyle: 'normal', fontFamily: 'SimSun, serif', showSidebar: false, numberingType: 'none' },
      h3: { fontSize: 12, indent: 0, fontWeight: 'normal', fontStyle: 'normal', fontFamily: 'SimSun, serif', showUnderline: false, numberingType: 'none' },
      abstract: { fontSize: 12, fontFamily: 'SimSun, serif', lineHeight: 2.0, italic: false },
      keywords: { fontSize: 12, fontFamily: 'SimSun, serif', fontWeight: 'normal', color: '#000000' },
      body: { fontSize: 12, fontFamily: 'SimSun, serif', lineHeight: 2.0, textIndent: 2, color: '#000000', paragraphSpacing: 0 },
      references: { fontSize: 10.5, fontFamily: 'SimSun, serif', lineHeight: 1.6 },
      figCaption: { fontSize: 10.5, fontFamily: 'SimSun, serif', labelFontWeight: 'bold' },
      tableCaption: { fontSize: 10.5, fontFamily: 'SimSun, serif' },
      tableCell: { fontSize: 10.5, fontFamily: 'SimSun, serif' },
      title: { fontSize: 16, fontFamily: 'SimHei, sans-serif', fontWeight: '700' },
      authors: { fontSize: 12, fontFamily: 'SimSun, serif' },
      affiliations: { fontSize: 12, fontFamily: 'SimSun, serif', fontStyle: 'normal' }
    }
  }
];
