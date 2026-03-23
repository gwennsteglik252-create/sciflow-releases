/**
 * wysiwygSync.ts
 * 纯文本 ↔ Tiptap HTML 双向转换工具
 * 
 * 支持两种模式的转换：
 * 1. 基础模式：标签 → 高亮 span（用于简单的富文本编辑）
 * 2. 富内容模式：标签 → 实际渲染元素（图片/表格/公式/引用）
 */

import { ResearchProject } from '../types';

// ─── 特殊标签正则 ───
const FIG_TAG_RE = /\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]/gi;
const TABLE_TAG_RE = /\[Table:\s*([\w\d_-]+)(?::Full)?\s*\]/gi;
const MATH_TAG_RE = /\[Math:\s*([\w\d_-]+)\s*\]/gi;
const FIGREF_TAG_RE = /\[FigRef:\s*([\w\d_-]+)\s*\]/gi;
const ALL_TAGS_RE = /\[(FigRef|Fig|Table|Math|Log):\s*[\w\d_-]+(?::Full)?\s*\]/gi;

export interface RichContentContext {
  projectMedia?: any[];
  project?: ResearchProject;
  figRefMap?: Map<string, number>;
  figLabel?: string;
  figSep?: string;
  tableLabel?: string;
}

/**
 * 纯文本 → HTML（富内容模式）
 * 将标签转为 Tiptap 自定义节点的 HTML 表示
 */
export function plainTextToHtml(text: string, ctx?: RichContentContext): string {
  if (!text) return '<p></p>';

  // 按行分割
  const lines = text.split(/\n/);
  const htmlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // 空行
    if (!trimmed) {
      htmlLines.push('<p></p>');
      continue;
    }

    // H2/H3 标题
    if (trimmed.startsWith('### ')) {
      const content = inlineFormatToHtml(trimmed.slice(4), ctx);
      htmlLines.push(`<h3>${content}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      const content = inlineFormatToHtml(trimmed.slice(3), ctx);
      htmlLines.push(`<h2>${content}</h2>`);
      continue;
    }

    // [Fig:xxx] 独占一行 → 图片块
    const figMatch = trimmed.match(/^\[Fig:\s*([\w\d_-]+)(?::W=([^\]]+))?\]$/i) || trimmed.match(/^\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]$/i);
    if (figMatch && ctx?.projectMedia) {
      const refId = figMatch[1];
      const width = figMatch[2] || '';
      const media = ctx.projectMedia.find((m: any) => m.refId === refId);
      if (media) {
        const figNum = ctx.figRefMap?.get(refId) || 0;
        const figLabel = ctx.figLabel || 'Figure';
        const figSep = ctx.figSep || '.';
        const caption = media.description?.split(/\s*\[Analysis\]\s*/i)[0] || media.name || '';
        htmlLines.push(`<sci-figure refid="${refId}" src="${media.url}" caption="${escapeAttr(caption)}" fignum="${figNum}" figlabel="${figLabel}" figsep="${figSep}" width="${width}"></sci-figure>`);
        continue;
      }
    }

    // [Table:xxx] 独占一行 → 表格块
    const tableMatch = trimmed.match(/^\[Table:\s*([\w\d_-]+)(?::Full)?\s*\]$/i);
    if (tableMatch && ctx?.project?.tables) {
      const tableId = tableMatch[1];
      const tableData = ctx.project.tables.find((t: any) => t.id === tableId);
      if (tableData) {
        const tableNum = 0; // 简化：不做自动编号
        const tableLabel = ctx.tableLabel || 'Table';
        const headersJson = escapeAttr(JSON.stringify(tableData.headers || []));
        const rowsJson = escapeAttr(JSON.stringify(tableData.rows || []));
        htmlLines.push(`<sci-table tableid="${tableId}" title="${escapeAttr(tableData.title || '')}" headers="${headersJson}" rows="${rowsJson}" note="${escapeAttr(tableData.note || '')}" tablenum="${tableNum}" tablelabel="${tableLabel}"></sci-table>`);
        continue;
      }
    }

    // [Math:xxx] 独占一行 → 公式块
    const mathMatch = trimmed.match(/^\[Math:\s*([\w\d_-]+)\s*\]$/i);
    if (mathMatch && ctx?.project?.latexSnippets) {
      const snippetId = mathMatch[1];
      const snippet = ctx.project.latexSnippets.find((s: any) => s.id === snippetId);
      if (snippet) {
        htmlLines.push(`<sci-math snippetid="${snippetId}" latex="${escapeAttr(snippet.content || '')}"></sci-math>`);
        continue;
      }
    }

    // 普通段落（行内标签处理）带 PStyle 支持
    let pStyle = '';
    let contentLine = line;
    const pStyleMatch = line.match(/^\[P:\s*([^\]]+)\]\s*\n?([\s\S]*)$/i);
    if (pStyleMatch) {
      pStyle = ` style="${escapeAttr(pStyleMatch[1])}"`;
      contentLine = pStyleMatch[2];
    }

    let processed = inlineFormatToHtml(contentLine, ctx);
    htmlLines.push(`<p${pStyle}>${processed}</p>`);
  }

  return htmlLines.join('');
}

/**
 * HTML → 纯文本
 * 将 Tiptap 编辑器的 HTML 输出转回纯文本标记格式
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const lines: string[] = [];

  const processNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // 自定义节点还原
    if (tag === 'sci-figure') {
      const width = el.getAttribute('width');
      const refId = el.getAttribute('refid') || '';
      if (width && width !== 'null') {
        return `[Fig:${refId}:W=${width}]`;
      }
      return `[Fig:${refId}]`;
    }
    if (tag === 'sci-table') {
      return `[Table:${el.getAttribute('tableid') || ''}]`;
    }
    if (tag === 'sci-math') {
      return `[Math:${el.getAttribute('snippetid') || ''}]`;
    }
    if (tag === 'sci-figref') {
      return `[FigRef:${el.getAttribute('refid') || ''}]`;
    }

    // 旧的 sciflow-tag span
    if (el.classList?.contains('sciflow-tag')) {
      const originalTag = el.getAttribute('data-tag');
      if (originalTag) return decodeURIComponent(originalTag);
      return el.textContent || '';
    }

    // 递归处理子节点
    let inner = '';
    for (const child of Array.from(el.childNodes)) {
      inner += processNode(child);
    }

    switch (tag) {
      case 'h2':
        return `## ${inner}`;
      case 'h3':
        return `### ${inner}`;
      case 'strong':
      case 'b':
        return `**${inner}**`;
      case 'em':
      case 'i':
        return `*${inner}*`;
      case 'u':
        return inner;
      case 'sub':
        return `$_{${inner}}$`;
      case 'sup':
        return `$^{${inner}}$`;
      case 'br':
        return '\n';
      case 'p': {
        const style = el.getAttribute('style');
        if (style && style.trim() && !style.includes('text-align: left')) { // ignore default left align
          return `[P:${style.trim()}]\n${inner}`;
        }
        return inner;
      }
      case 'span': {
        const style = el.getAttribute('style');
        if (style && style.trim()) {
          return `[Span:${style.trim()}]${inner}[/Span]`;
        }
        return inner;
      }
      default:
        return inner;
    }
  };

  const body = doc.body;
  for (const child of Array.from(body.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const text = processNode(child);
      lines.push(text);
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * 行内格式转换（纯文本标记 → HTML）
 */
function inlineFormatToHtml(text: string, ctx?: RichContentContext): string {
  // 加粗: **text** → <strong>text</strong>
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 斜体: *text* → <em>text</em>
  text = text.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // 下标: $_{text}$ → <sub>text</sub>
  text = text.replace(/\$_\{\s*(.*?)\s*\}\$/g, '<sub>$1</sub>');

  // 上标: $^{text}$ → <sup>text</sup>
  text = text.replace(/\$\^\{\s*(.*?)\s*\}\$/g, '<sup>$1</sup>');

  // 自定义 Span 样式: [Span:style]text[/Span]
  text = text.replace(/\[Span:([^\]]+)\]([\s\S]*?)\[\/Span\]/g, '<span style="$1">$2</span>');

  // 行内 [FigRef:xxx] → sci-figref 自定义元素
  if (ctx?.figRefMap) {
    text = text.replace(/\[FigRef:\s*([\w\d_-]+)\s*\]/gi, (_match, refId) => {
      const figNum = ctx.figRefMap?.get(refId) || 0;
      const figLabel = ctx.figLabel || 'Figure';
      return `<sci-figref refid="${refId}" fignum="${figNum}" figlabel="${figLabel}"></sci-figref>`;
    });
  }

  // 其他标签保持为高亮 span
  text = text.replace(ALL_TAGS_RE, (match) => {
    return `<span class="sciflow-tag" data-tag="${encodeURIComponent(match)}">${match}</span>`;
  });

  return text;
}

/** HTML 属性转义 */
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
