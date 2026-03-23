
import { Literature } from '../types';

export type CitationStyle = 'Nature' | 'IEEE' | 'APA' | 'JACS' | 'Science' | 'Cell' | 'ACS Nano';

const STANDARD_STYLES = ['Nature', 'IEEE', 'APA', 'JACS', 'Science', 'Cell', 'ACS Nano'];

/**
 * 检查是否为内置的标准格式
 */
export const isStandardStyle = (style: string): boolean => {
  return STANDARD_STYLES.includes(style);
};

/**
 * 格式化作者姓名的工具函数
 */
const formatSingleAuthor = (name: string, style: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return name;

  // 处理 "Last, First" 格式
  if (trimmed.includes(',')) {
    const [last, ...rest] = trimmed.split(',').map(s => s.trim());
    const initial = rest.join(' ').charAt(0).toUpperCase() + '.';
    if (style === 'IEEE' || style === 'Science') {
      return `${initial} ${last}`;
    }
    return `${last}, ${initial}`;
  }

  // 中文名直接返回
  if (/^[\u4e00-\u9fff]+$/.test(trimmed)) return trimmed;

  // 处理 "First Last" 格式
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return name;

  const lastName = parts[0]; // 姓在前
  const initial = parts.slice(1).map(p => p.charAt(0).toUpperCase() + '.').join(' ');

  if (style === 'IEEE' || style === 'Science') {
    return `${initial} ${lastName}`;
  }
  return `${lastName}, ${initial}`;
};

const formatAuthors = (authors: string[] | undefined, style: CitationStyle): string => {
  if (!authors || authors.length === 0) return 'Unknown Author';

  const formattedNames = authors.map(a => formatSingleAuthor(a, style));
  const etAlThreshold = (style === 'Nature' || style === 'Science') ? 3 : 6;

  if (authors.length > etAlThreshold) {
    return `${formattedNames[0]} et al.`;
  }

  if (style === 'JACS' || style === 'ACS Nano') {
    return formattedNames.join('; ');
  }

  if (authors.length === 2) {
    return formattedNames.join(' & ');
  }

  return formattedNames.join(', ');
};

/**
 * 核心格式化引擎 (本地模式)
 */
export const formatBibliography = (style: string, resources: Literature[]): string => {
  if (!resources || resources.length === 0) return "";

  const entries = resources.map((res, index) => {
    const num = index + 1;
    const authors = formatAuthors(res.authors, style as CitationStyle);
    const title = res.title || 'Untitled';
    const source = res.source || 'Unpublished';
    const year = res.year || 'n.d.';

    switch (style) {
      case 'Nature':
        return `${num}. ${authors} ${title}. *${source}* (**${year}**).`;
      case 'IEEE':
        return `[${num}] ${authors}, "${title}," *${source}*, ${year}.`;
      case 'JACS':
      case 'ACS Nano':
        return `${num}. ${authors} *${source}* **${year}**; *${title}*.`;
      case 'APA':
        return `${authors} (${year}). ${title}. *${source}*.`;
      case 'Science':
        return `${num}. ${authors}, ${title}, *${source}* (${year}).`;
      case 'Cell':
        const firstAuthor = res.authors?.[0]?.trim() || '';
        const lastName = firstAuthor.includes(',')
          ? firstAuthor.split(',')[0].trim()
          : /^[\u4e00-\u9fff]+$/.test(firstAuthor)
            ? firstAuthor
            : firstAuthor.split(' ')[0] || 'Unknown';
        return `${lastName} et al. (${year}) ${title}. *${source}*.`;
      default:
        return `${num}. ${authors}, ${title}, ${source}, ${year}.`;
    }
  });

  return entries.join('\n');
};
