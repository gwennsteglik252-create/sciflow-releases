/**
 * Citation Formatter — 多格式学术引用生成器
 * 支持 APA 7th, ACS, IEEE, GB/T 7714-2015 (国标), Harvard, Vancouver, Chicago
 */

import { Literature } from '../types';
import { cleanAcademicTitle } from '../utils/cleanTitle';

export type CitationStyle = 'APA' | 'ACS' | 'IEEE' | 'GBT7714' | 'Harvard' | 'Vancouver' | 'Chicago' | 'BibTeX' | 'Plain';

export interface CitationStyleInfo {
  id: CitationStyle;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export const CITATION_STYLES: CitationStyleInfo[] = [
  { id: 'APA', label: 'APA 7th', description: '美国心理学学会 — 社科/心理学', icon: 'fa-book', color: 'text-blue-600' },
  { id: 'ACS', label: 'ACS', description: '美国化学学会 — 化学/材料', icon: 'fa-flask', color: 'text-emerald-600' },
  { id: 'IEEE', label: 'IEEE', description: '电气与电子工程师 — 工程/计算机', icon: 'fa-microchip', color: 'text-sky-600' },
  { id: 'GBT7714', label: 'GB/T 7714', description: '中国国家标准 — 国内投稿首选', icon: 'fa-landmark', color: 'text-rose-600' },
  { id: 'Harvard', label: 'Harvard', description: '哈佛引用格式 — 英联邦通用', icon: 'fa-graduation-cap', color: 'text-amber-600' },
  { id: 'Vancouver', label: 'Vancouver', description: '温哥华格式 — 生物医学/临床', icon: 'fa-stethoscope', color: 'text-violet-600' },
  { id: 'Chicago', label: 'Chicago 17th', description: '芝加哥格式 — 人文/历史', icon: 'fa-building-columns', color: 'text-orange-600' },
  { id: 'BibTeX', label: 'BibTeX', description: 'LaTeX 引用格式', icon: 'fa-code', color: 'text-slate-600' },
  { id: 'Plain', label: '纯文本', description: '简洁格式', icon: 'fa-align-left', color: 'text-slate-400' },
];

// ─── Helper functions ────────────────────────────────────────────

/** Format author names for different styles */
const formatAuthors = (authors: string[] | undefined, style: CitationStyle): string => {
  if (!authors || authors.length === 0) return 'Unknown Author';

  switch (style) {
    case 'APA':
      // APA: Last, F. M., Last, F. M., & Last, F. M.
      if (authors.length > 20) {
        const first19 = authors.slice(0, 19).map(a => formatAuthorAPA(a)).join(', ');
        return `${first19}, ... ${formatAuthorAPA(authors[authors.length - 1])}`;
      }
      if (authors.length === 1) return formatAuthorAPA(authors[0]);
      if (authors.length === 2) return `${formatAuthorAPA(authors[0])}, & ${formatAuthorAPA(authors[1])}`;
      return authors.slice(0, -1).map(a => formatAuthorAPA(a)).join(', ') + `, & ${formatAuthorAPA(authors[authors.length - 1])}`;

    case 'ACS':
      // ACS: Last, F. M.; Last, F. M.; Last, F. M.
      return authors.map(a => formatAuthorAPA(a)).join('; ');

    case 'IEEE':
      // IEEE: F. M. Last, F. M. Last, and F. M. Last
      if (authors.length === 1) return formatAuthorIEEE(authors[0]);
      if (authors.length === 2) return `${formatAuthorIEEE(authors[0])} and ${formatAuthorIEEE(authors[1])}`;
      return authors.slice(0, -1).map(a => formatAuthorIEEE(a)).join(', ') + `, and ${formatAuthorIEEE(authors[authors.length - 1])}`;

    case 'GBT7714':
      // GB/T 7714: Last F M, Last F M, et al.
      if (authors.length > 3) {
        return authors.slice(0, 3).map(a => formatAuthorGBT(a)).join(', ') + ', 等';
      }
      return authors.map(a => formatAuthorGBT(a)).join(', ');

    case 'Vancouver':
      // Vancouver: Last FM, Last FM, Last FM.
      if (authors.length > 6) {
        return authors.slice(0, 6).map(a => formatAuthorVancouver(a)).join(', ') + ', et al.';
      }
      return authors.map(a => formatAuthorVancouver(a)).join(', ');

    case 'Harvard':
      if (authors.length === 1) return formatAuthorAPA(authors[0]);
      if (authors.length === 2) return `${formatAuthorAPA(authors[0])} and ${formatAuthorAPA(authors[1])}`;
      if (authors.length > 3) return `${formatAuthorAPA(authors[0])} et al.`;
      return authors.slice(0, -1).map(a => formatAuthorAPA(a)).join(', ') + ` and ${formatAuthorAPA(authors[authors.length - 1])}`;

    case 'Chicago':
      if (authors.length === 1) return formatAuthorAPA(authors[0]);
      if (authors.length <= 3) {
        return authors.slice(0, -1).map(a => formatAuthorAPA(a)).join(', ') + `, and ${formatAuthorAPA(authors[authors.length - 1])}`;
      }
      return `${formatAuthorAPA(authors[0])} et al.`;

    default:
      return authors.join(', ');
  }
};

/** APA style author: "Last, F. M." */
const formatAuthorAPA = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => `${p.charAt(0).toUpperCase()}.`).join(' ');
  return `${lastName}, ${initials}`;
};

/** IEEE style author: "F. M. Last" */
const formatAuthorIEEE = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => `${p.charAt(0).toUpperCase()}.`).join(' ');
  return `${initials} ${lastName}`;
};

/** GB/T 7714 style author: "Last F M" */
const formatAuthorGBT = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Check if name is already in Chinese
  if (/[\u4e00-\u9fa5]/.test(name)) return name;
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => `${p.charAt(0).toUpperCase()}`).join(' ');
  return `${lastName} ${initials}`;
};

/** Vancouver style author: "Last FM" */
const formatAuthorVancouver = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => `${p.charAt(0).toUpperCase()}`).join('');
  return `${lastName} ${initials}`;
};

/** Generate a BibTeX cite key from the item */
const generateCiteKey = (item: Literature): string => {
  const firstAuthor = item.authors?.[0]?.split(/\s+/).pop()?.toLowerCase() || 'unknown';
  const year = item.year || new Date().getFullYear();
  const rawTitle = item.englishTitle || item.title || 'untitled';
  const titleWord = rawTitle.split(/\s+/)[0]?.toLowerCase()?.replace(/[^a-z0-9]/gi, '') || 'untitled';
  return `${firstAuthor}${year}${titleWord}`;
};

// ─── Main Citation Formatter ────────────────────────────────────

export const formatCitation = (item: Literature, style: CitationStyle): string => {
  const year = item.year || new Date().getFullYear();
  // 学术引用应优先使用英文原标题，中文标题仅作后备，并清理 HTML 标签
  const title = cleanAcademicTitle(item.englishTitle) || cleanAcademicTitle(item.title) || 'Untitled';
  const journal = item.source || 'Unknown Journal';
  const doi = item.doi || '';
  const url = item.url || '';
  const vol = item.volume || '';
  const iss = item.issue || '';
  const pages = item.pages || '';

  // Helper: build volume/issue/pages segment
  const volIssuePart = (sep: string = ', ') => {
    const parts: string[] = [];
    if (vol) parts.push(vol);
    if (iss) parts[parts.length > 0 ? 0 : 0] = parts.length > 0 ? `${vol}(${iss})` : `(${iss})`;
    return parts.length > 0 ? parts[0] : '';
  };

  switch (style) {
    case 'APA': {
      // Author, A. A., Author, B. B., & Author, C. C. (Year). Title of article. *Journal Name*, volume(issue), pages. https://doi.org/xxx
      const authors = formatAuthors(item.authors, 'APA');
      let citation = `${authors} (${year}). ${title}. *${journal}*`;
      const vip = volIssuePart();
      if (vip) citation += `, ${vip}`;
      if (pages) citation += `, ${pages}`;
      if (doi) citation += `. https://doi.org/${doi}`;
      else if (url) citation += `. ${url}`;
      return citation;
    }

    case 'ACS': {
      // Author, A. A.; Author, B. B.; Author, C. C. Title of Article. *Journal Name* **Year**, volume (issue), pages. DOI: xxx
      const authors = formatAuthors(item.authors, 'ACS');
      let citation = `${authors}. ${title}. *${journal}* **${year}**`;
      if (vol) citation += `, *${vol}*`;
      if (iss) citation += ` (${iss})`;
      if (pages) citation += `, ${pages}`;
      if (doi) citation += `. DOI: ${doi}`;
      return citation;
    }

    case 'IEEE': {
      // [n] F. M. Last, F. M. Last, and F. M. Last, "Title of article," *Journal Name*, vol. X, no. Y, pp. Z–ZZ, Month Year.
      const authors = formatAuthors(item.authors, 'IEEE');
      let citation = `${authors}, "${title}," *${journal}*`;
      if (vol) citation += `, vol. ${vol}`;
      if (iss) citation += `, no. ${iss}`;
      if (pages) citation += `, pp. ${pages}`;
      citation += `, ${year}`;
      if (doi) citation += `, doi: ${doi}`;
      return citation + '.';
    }

    case 'GBT7714': {
      // GB/T 7714-2015: 作者. 题名[J]. 刊名, 年, 卷(期): 页码.
      const authors = formatAuthors(item.authors, 'GBT7714');
      let citation = `${authors}. ${title}[J]. ${journal}, ${year}`;
      if (vol) citation += `, ${vol}`;
      if (iss) citation += `(${iss})`;
      if (pages) citation += `: ${pages}`;
      if (doi) citation += `. DOI: ${doi}`;
      return citation + '.';
    }

    case 'Harvard': {
      // Author, A.A. (Year) 'Title of article', *Journal Name*, volume(issue), pp. pages.
      const authors = formatAuthors(item.authors, 'Harvard');
      let citation = `${authors} (${year}) '${title}', *${journal}*`;
      const vip = volIssuePart();
      if (vip) citation += `, ${vip}`;
      if (pages) citation += `, pp. ${pages}`;
      if (doi) citation += `. doi: ${doi}`;
      return citation + '.';
    }

    case 'Vancouver': {
      // Author FM, Author FM, Author FM. Title of article. Journal Name. Year;volume(issue):pages.
      const authors = formatAuthors(item.authors, 'Vancouver');
      let citation = `${authors}. ${title}. ${journal}. ${year}`;
      if (vol) citation += `;${vol}`;
      if (iss) citation += `(${iss})`;
      if (pages) citation += `:${pages}`;
      if (doi) citation += `. doi: ${doi}`;
      return citation + '.';
    }

    case 'Chicago': {
      // Author, First M., First M. Author, and First M. Author. "Title." *Journal* volume, no. issue (Year): pages.
      const authors = formatAuthors(item.authors, 'Chicago');
      let citation = `${authors}. "${title}." *${journal}*`;
      if (vol) citation += ` ${vol}`;
      if (iss) citation += `, no. ${iss}`;
      citation += ` (${year})`;
      if (pages) citation += `: ${pages}`;
      if (doi) citation += `. https://doi.org/${doi}`;
      return citation + '.';
    }

    case 'BibTeX': {
      const citeKey = generateCiteKey(item);
      const authorsStr = item.authors?.join(' and ') || 'Unknown';
      return `@article{${citeKey},
  title     = {${title}},
  author    = {${authorsStr}},
  journal   = {${journal}},
  year      = {${year}},${vol ? `\n  volume    = {${vol}},` : ''}${iss ? `\n  number    = {${iss}},` : ''}${pages ? `\n  pages     = {${pages}},` : ''}${doi ? `\n  doi       = {${doi}},` : ''}${url ? `\n  url       = {${url}},` : ''}
}`;
    }

    case 'Plain':
    default: {
      const authorStr = item.authors?.join(', ') || 'Unknown Author';
      let citation = `${authorStr}. ${title}. ${journal} ${year}`;
      if (vol) citation += `, ${vol}`;
      if (iss) citation += `(${iss})`;
      if (pages) citation += `, ${pages}`;
      if (doi) citation += `, DOI: ${doi}`;
      return citation + '.';
    }
  }
};

/** Generate inline citation text (e.g. for inserting into text body) */
export const formatInlineCitation = (item: Literature, style: CitationStyle): string => {
  const year = item.year || new Date().getFullYear();
  const firstAuthor = item.authors?.[0]?.split(/\s+/).pop() || 'Unknown';
  const hasMultiple = (item.authors?.length || 0) > 1;
  const etAl = hasMultiple ? ' et al.' : '';

  switch (style) {
    case 'APA':
    case 'Harvard':
    case 'Chicago':
      return `(${firstAuthor}${etAl}, ${year})`;
    case 'ACS':
      return `(${firstAuthor}${etAl}, ${year})`;
    case 'IEEE':
      return `[ref]`; // IEEE uses numbered references
    case 'GBT7714':
      return `[${firstAuthor}${etAl}, ${year}]`;
    case 'Vancouver':
      return `(${firstAuthor}${etAl} ${year})`;
    default:
      return `(${firstAuthor}${etAl}, ${year})`;
  }
};

/** Batch format multiple items into a reference list */
export const formatReferenceList = (items: Literature[], style: CitationStyle): string => {
  return items.map((item, idx) => {
    const citation = formatCitation(item, style);
    if (style === 'IEEE') return `[${idx + 1}] ${citation}`;
    if (style === 'Vancouver') return `${idx + 1}. ${citation}`;
    return citation;
  }).join('\n\n');
};
