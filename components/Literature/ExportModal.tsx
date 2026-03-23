import React, { useState, useMemo } from 'react';
import { Literature } from '../../types';

interface ExportModalProps {
  items: Literature[];
  onClose: () => void;
}

type ExportFormat = 'bibtex' | 'ris' | 'apa' | 'gbt';

const FORMAT_OPTIONS: { key: ExportFormat; label: string; icon: string }[] = [
  { key: 'bibtex', label: 'BibTeX (.bib)', icon: 'fa-code' },
  { key: 'ris', label: 'RIS (.ris)', icon: 'fa-file-lines' },
  { key: 'apa', label: 'APA 7th', icon: 'fa-font' },
  { key: 'gbt', label: 'GB/T 7714', icon: 'fa-language' },
];

function buildBibTeX(items: Literature[]): string {
  return items.map(item => {
    const key = `${(item.authors?.[0]?.split(/\s+/).pop() || 'unknown').toLowerCase()}${item.year}${item.title?.split(/\s+/)[0]?.toLowerCase() || ''}`;
    const fields: string[] = [];
    fields.push(`  title = {${item.title}}`);
    if (item.authors?.length) fields.push(`  author = {${item.authors.join(' and ')}}`);
    fields.push(`  year = {${item.year}}`);
    if (item.source) fields.push(`  journal = {${item.source}}`);
    if (item.volume) fields.push(`  volume = {${item.volume}}`);
    if (item.issue) fields.push(`  number = {${item.issue}}`);
    if (item.pages) fields.push(`  pages = {${item.pages}}`);
    if (item.doi) fields.push(`  doi = {${item.doi}}`);
    if (item.url) fields.push(`  url = {${item.url}}`);
    if (item.abstract) fields.push(`  abstract = {${item.abstract.substring(0, 500)}}`);
    return `@article{${key},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
}

function buildRIS(items: Literature[]): string {
  return items.map(item => {
    const lines: string[] = ['TY  - JOUR'];
    if (item.title) lines.push(`TI  - ${item.title}`);
    item.authors?.forEach(a => lines.push(`AU  - ${a}`));
    lines.push(`PY  - ${item.year}`);
    if (item.source) lines.push(`JO  - ${item.source}`);
    if (item.volume) lines.push(`VL  - ${item.volume}`);
    if (item.issue) lines.push(`IS  - ${item.issue}`);
    if (item.pages) {
      const [sp, ep] = item.pages.split('-');
      if (sp) lines.push(`SP  - ${sp.trim()}`);
      if (ep) lines.push(`EP  - ${ep.trim()}`);
    }
    if (item.doi) lines.push(`DO  - ${item.doi}`);
    if (item.url) lines.push(`UR  - ${item.url}`);
    if (item.abstract) lines.push(`AB  - ${item.abstract.substring(0, 500)}`);
    lines.push('ER  - ');
    return lines.join('\n');
  }).join('\n\n');
}

function buildAPA(items: Literature[]): string {
  return items.map(item => {
    const authors = item.authors?.length
      ? item.authors.length > 7
        ? `${item.authors.slice(0, 6).join(', ')}, ... ${item.authors[item.authors.length - 1]}`
        : item.authors.join(', ')
      : 'Unknown Author';
    const title = item.title || 'Untitled';
    const source = item.source ? `*${item.source}*` : '';
    const vol = item.volume ? `, *${item.volume}*` : '';
    const issue = item.issue ? `(${item.issue})` : '';
    const pages = item.pages ? `, ${item.pages}` : '';
    const doi = item.doi ? ` https://doi.org/${item.doi}` : '';
    return `${authors} (${item.year}). ${title}. ${source}${vol}${issue}${pages}.${doi}`;
  }).join('\n\n');
}

function buildGBT(items: Literature[]): string {
  return items.map((item, idx) => {
    const authors = item.authors?.length
      ? item.authors.length > 3
        ? `${item.authors.slice(0, 3).join(', ')}, 等`
        : item.authors.join(', ')
      : '佚名';
    const title = item.title || '无题';
    const source = item.source ? `[J]. ${item.source}` : '[J]';
    const vol = item.volume ? `, ${item.volume}` : '';
    const issue = item.issue ? `(${item.issue})` : '';
    const pages = item.pages ? `: ${item.pages}` : '';
    return `[${idx + 1}] ${authors}. ${title}${source}, ${item.year}${vol}${issue}${pages}.`;
  }).join('\n');
}

const BUILDERS: Record<ExportFormat, (items: Literature[]) => string> = {
  bibtex: buildBibTeX,
  ris: buildRIS,
  apa: buildAPA,
  gbt: buildGBT,
};

const FILE_EXTS: Record<ExportFormat, string> = { bibtex: '.bib', ris: '.ris', apa: '.txt', gbt: '.txt' };

const ExportModal: React.FC<ExportModalProps> = ({ items, onClose }) => {
  const [format, setFormat] = useState<ExportFormat>('bibtex');
  const [copied, setCopied] = useState(false);
  const output = useMemo(() => BUILDERS[format](items), [items, format]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `references_${items.length}${FILE_EXTS[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[600px] max-h-[80vh] flex flex-col overflow-hidden animate-reveal"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-file-export text-indigo-500"></i>
              批量导出参考文献
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">已选 {items.length} 篇文献</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Format Tabs */}
        <div className="flex gap-1 p-3 border-b border-slate-100 bg-slate-50/50">
          {FORMAT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setFormat(opt.key)}
              className={`flex-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                format === opt.key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200'
              }`}
            >
              <i className={`fa-solid ${opt.icon} text-[9px]`}></i>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <pre className="text-[10px] leading-relaxed text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-[400px] overflow-y-auto custom-scrollbar">
            {output}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 bg-slate-50/30">
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
              copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[9px]`}></i>
            {copied ? '已复制' : '复制到剪贴板'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-md"
          >
            <i className="fa-solid fa-download text-[9px]"></i>
            下载文件
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
