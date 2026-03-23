/**
 * 综述工坊导出工具
 * 支持 DOCX / LaTeX / PDF / 多引用格式
 */

import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, Packer, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import type { ReviewSession, ReviewOutlineNode } from '../types';
import type { Literature } from '../types/resources';

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

export type CitationStyle = 'numbered' | 'apa' | 'gbt7714' | 'nature';
export type LatexTemplate = 'generic' | 'elsevier' | 'acs' | 'rsc';
export type ExportFormat = 'docx' | 'latex' | 'pdf';

function flattenOutline(nodes: ReviewOutlineNode[]): ReviewOutlineNode[] {
    const result: ReviewOutlineNode[] = [];
    for (const n of nodes) {
        result.push(n);
        if (n.children?.length) result.push(...flattenOutline(n.children));
    }
    return result;
}

function getCitedLiterature(session: ReviewSession, results: Literature[]): Literature[] {
    const citedIds = new Set<string>();
    flattenOutline(session.outline).forEach(s => s.literatureIds.forEach(id => citedIds.add(id)));
    return results.filter(r => citedIds.has(r.id));
}

// ═══════════════════════════════════════════════════════════════════
// 引用格式化
// ═══════════════════════════════════════════════════════════════════

export function formatReference(lit: Literature, idx: number, style: CitationStyle): string {
    const authors = lit.authors?.join(', ') || 'Unknown';
    const firstAuthor = lit.authors?.[0] || 'Unknown';
    const title = lit.title || '';
    const year = lit.year || '';
    const source = lit.source || '';
    const doi = (lit as any).doi || '';
    const volume = (lit as any).volume || '';
    const pages = (lit as any).pages || '';

    switch (style) {
        case 'numbered':
            return `[${idx}] ${authors}. ${title}. ${source}${volume ? `, ${volume}` : ''}${pages ? `, ${pages}` : ''}, ${year}.${doi ? ` DOI: ${doi}` : ''}`;

        case 'apa':
            return `${authors} (${year}). ${title}. *${source}*${volume ? `, *${volume}*` : ''}${pages ? `, ${pages}` : ''}.${doi ? ` https://doi.org/${doi}` : ''}`;

        case 'gbt7714':
            return `[${idx}] ${authors}. ${title}[J]. ${source}, ${year}${volume ? `, ${volume}` : ''}${pages ? `: ${pages}` : ''}.`;

        case 'nature':
            return `${idx}. ${firstAuthor}${lit.authors && lit.authors.length > 1 ? ' et al.' : ''}. ${title}. *${source}* **${volume}**, ${pages} (${year}).`;

        default:
            return `[${idx}] ${authors}. ${title}. ${source}, ${year}.`;
    }
}

export function formatBibliography(results: Literature[], session: ReviewSession, style: CitationStyle): string {
    const cited = getCitedLiterature(session, results);
    return cited.map((lit, i) => formatReference(lit, i + 1, style)).join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════
// DOCX 导出
// ═══════════════════════════════════════════════════════════════════

export async function exportToDocx(session: ReviewSession, results: Literature[], style: CitationStyle = 'numbered') {
    const sections = flattenOutline(session.outline);
    const cited = getCitedLiterature(session, results);
    const children: Paragraph[] = [];

    // 标题
    children.push(new Paragraph({
        text: session.config.topic,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
    }));

    // 摘要
    if (session.abstract) {
        children.push(new Paragraph({ text: '摘要', heading: HeadingLevel.HEADING_1 }));
        session.abstract.split('\n').forEach(line => {
            children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 22 })] }));
        });
    }

    // 关键词
    if (session.keywords?.length) {
        children.push(new Paragraph({
            children: [
                new TextRun({ text: '关键词: ', bold: true, size: 22 }),
                new TextRun({ text: session.keywords.join('; '), size: 22 })
            ],
            spacing: { after: 300 }
        }));
    }

    // 各章节
    for (const section of sections) {
        const content = session.generatedSections[section.id];
        if (!content) continue;

        children.push(new Paragraph({
            text: section.title,
            heading: section.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            spacing: { before: 300 }
        }));

        content.split('\n').forEach(line => {
            if (!line.trim()) return;
            children.push(new Paragraph({
                children: [new TextRun({ text: line.trim(), size: 22 })],
                spacing: { after: 120 }
            }));
        });

        // 嵌入表格
        const figure = session.generatedFigures?.[section.id];
        if (figure?.figureType === 'comparison_table' && figure.headers.length > 0) {
            const tableRows = [
                new TableRow({
                    children: figure.headers.map(h => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })],
                        width: { size: Math.floor(9000 / figure.headers.length), type: WidthType.DXA }
                    }))
                }),
                ...figure.rows.map(row => new TableRow({
                    children: row.map(cell => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })],
                        width: { size: Math.floor(9000 / figure.headers.length), type: WidthType.DXA }
                    }))
                }))
            ];
            children.push(new Paragraph({ text: '' }));
            children.push(new Paragraph({
                children: [new TextRun({ text: figure.description || '表', bold: true, size: 20 })],
                alignment: AlignmentType.CENTER
            }));
            // Table 需要单独处理
            const table = new Table({ rows: tableRows, width: { size: 9000, type: WidthType.DXA } });
            (children as any).push(table);
        }
    }

    // 参考文献
    if (cited.length > 0) {
        children.push(new Paragraph({ text: '参考文献', heading: HeadingLevel.HEADING_1, spacing: { before: 400 } }));
        cited.forEach((lit, i) => {
            children.push(new Paragraph({
                children: [new TextRun({ text: formatReference(lit, i + 1, style), size: 20 })],
                spacing: { after: 80 }
            }));
        });
    }

    const doc = new Document({
        sections: [{ children }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${session.config.topic.substring(0, 30)}_综述.docx`);
}

// ═══════════════════════════════════════════════════════════════════
// LaTeX 导出
// ═══════════════════════════════════════════════════════════════════

const LATEX_TEMPLATES: Record<LatexTemplate, { preamble: string; docClass: string }> = {
    generic: {
        docClass: '\\documentclass{article}',
        preamble: '\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{graphicx}\n\\usepackage{hyperref}'
    },
    elsevier: {
        docClass: '\\documentclass[review]{elsarticle}',
        preamble: '\\usepackage{amsmath}\n\\usepackage{graphicx}\n\\usepackage{hyperref}\n\\usepackage{lineno}\n\\linenumbers'
    },
    acs: {
        docClass: '\\documentclass[journal=jacsat,manuscript=article]{achemso}',
        preamble: '\\usepackage{graphicx}\n\\usepackage{amsmath}'
    },
    rsc: {
        docClass: '\\documentclass[twoside]{article}',
        preamble: '\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{graphicx}\n\\usepackage{hyperref}'
    }
};

function escapeLatex(text: string): string {
    return text
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/[&%$#_{}]/g, m => `\\${m}`)
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}

export function exportToLatex(session: ReviewSession, results: Literature[], template: LatexTemplate = 'generic', style: CitationStyle = 'numbered') {
    const tmpl = LATEX_TEMPLATES[template];
    const sections = flattenOutline(session.outline);
    const cited = getCitedLiterature(session, results);
    const lines: string[] = [];

    lines.push(tmpl.docClass);
    lines.push(tmpl.preamble);
    lines.push('');
    lines.push(`\\title{${escapeLatex(session.config.topic)}}`);
    lines.push('\\author{}');
    lines.push('\\date{\\today}');
    lines.push('');
    lines.push('\\begin{document}');
    lines.push('\\maketitle');

    // 摘要
    if (session.abstract) {
        lines.push('');
        lines.push('\\begin{abstract}');
        lines.push(escapeLatex(session.abstract));
        lines.push('\\end{abstract}');
    }

    // 关键词
    if (session.keywords?.length) {
        lines.push('');
        lines.push(`\\textbf{Keywords:} ${session.keywords.map(k => escapeLatex(k)).join('; ')}`);
    }

    // 章节
    for (const section of sections) {
        const content = session.generatedSections[section.id];
        if (!content) continue;
        const cmd = section.level === 1 ? '\\section' : '\\subsection';
        lines.push('');
        lines.push(`${cmd}{${escapeLatex(section.title)}}`);
        lines.push('');
        lines.push(escapeLatex(content));
    }

    // 参考文献
    if (cited.length > 0) {
        lines.push('');
        lines.push('\\begin{thebibliography}{99}');
        cited.forEach((lit, i) => {
            const authors = lit.authors?.join(', ') || 'Unknown';
            const doi = (lit as any).doi || '';
            lines.push(`\\bibitem{ref${i + 1}} ${escapeLatex(authors)}. ${escapeLatex(lit.title)}. \\textit{${escapeLatex(lit.source)}}, ${lit.year}.${doi ? ` DOI: ${escapeLatex(doi)}` : ''}`);
        });
        lines.push('\\end{thebibliography}');
    }

    lines.push('');
    lines.push('\\end{document}');

    const texContent = lines.join('\n');
    const blob = new Blob([texContent], { type: 'application/x-tex; charset=utf-8' });
    saveAs(blob, `${session.config.topic.substring(0, 30)}_综述.tex`);
}

// ═══════════════════════════════════════════════════════════════════
// PDF 导出
// ═══════════════════════════════════════════════════════════════════

export function exportToPdf(session: ReviewSession, results: Literature[], style: CitationStyle = 'numbered') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const addText = (text: string, fontSize: number, isBold = false) => {
        doc.setFontSize(fontSize);
        if (isBold) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');

        const lines = doc.splitTextToSize(text, contentWidth);
        for (const line of lines) {
            if (y > 270) { doc.addPage(); y = margin; }
            doc.text(line, margin, y);
            y += fontSize * 0.5;
        }
        y += 2;
    };

    // 标题
    addText(session.config.topic, 18, true);
    y += 5;

    // 摘要
    if (session.abstract) {
        addText('Abstract', 14, true);
        addText(session.abstract, 10);
        y += 3;
    }

    // 关键词
    if (session.keywords?.length) {
        addText(`Keywords: ${session.keywords.join('; ')}`, 10, true);
        y += 3;
    }

    // 章节
    const sections = flattenOutline(session.outline);
    for (const section of sections) {
        const content = session.generatedSections[section.id];
        if (!content) continue;
        y += 3;
        addText(section.title, section.level === 1 ? 14 : 12, true);
        addText(content, 10);
    }

    // 参考文献
    const cited = getCitedLiterature(session, results);
    if (cited.length > 0) {
        y += 5;
        addText('References', 14, true);
        cited.forEach((lit, i) => {
            addText(formatReference(lit, i + 1, style), 9);
        });
    }

    doc.save(`${session.config.topic.substring(0, 30)}_综述.pdf`);
}
