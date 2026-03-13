
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProjectTable, Literature, ResearchProject } from '../../../types';
import { GoogleGenAI, Type } from "@google/genai";
import LaTeXText from '../../Common/LaTeXText';
import { SPEED_CONFIG, extractJson, getGeminiApiKey } from '../../../services/gemini/core';
import { useTranslation } from '../../../locales/useTranslation';

interface TableEditorModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (table: ProjectTable) => void;
  onInsertText: (text: string) => void;
  onAddNode?: () => void;
  onCiteLiterature: (res: Literature) => void;
  initialTable: ProjectTable | null;
  project?: ResearchProject;
  allResources: Literature[];
  orderedCitations?: { list: Literature[]; map: Map<string, number> };
  activeTemplateId?: string;
}

const FONT_FAMILIES = [
  { name: 'Default (Sans)', value: 'inherit' },
  { name: 'Times New Roman (Serif)', value: "'Times New Roman', Times, serif" },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Courier New', value: "'Courier New', Courier, monospace" },
  { name: 'Georgia', value: 'Georgia, serif' }
];

const SYMBOLS = [
  'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω',
  'Δ', 'Σ', 'Ω', '°C', '±', '≈', '≠', '≤', '≥', '×', '÷', '∞', '∂', '∫', '√', '‰', 'Å', '←', '→', '↑', '↓'
];

type FocusedElement = {
  type: 'title' | 'header' | 'cell' | 'note';
  row?: number;
  col?: number;
};

export const TableEditorModal: React.FC<TableEditorModalProps> = ({
  show, onClose, onSave, onInsertText, onAddNode, onCiteLiterature, initialTable, project, allResources, orderedCitations, activeTemplateId
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [headers, setHeaders] = useState<string[]>(['Header 1', 'Header 2', 'Header 3']);
  const [rows, setRows] = useState<string[][]>([['', '', ''], ['', '', '']]);
  const [note, setNote] = useState('');

  const [fontSize, setFontSize] = useState(8.5);
  const [titleFontSize, setTitleFontSize] = useState(8.5);
  const [fontFamily, setFontFamily] = useState('inherit');

  const [showLitPanel, setShowLitPanel] = useState(false);
  const [showSymbolMenu, setShowSymbolMenu] = useState(false);
  const [focusedElement, setFocusedElement] = useState<FocusedElement | null>(null);
  const [litSearch, setLitSearch] = useState('');

  const [batchRows, setBatchRows] = useState('3');
  const [batchCols, setBatchCols] = useState('3');

  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const symbolMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show) {
      if (initialTable) {
        setTitle(initialTable.title);
        setHeaders([...initialTable.headers]);
        setRows(initialTable.rows.map(row => [...row]));
        setNote(initialTable.note || '');
        setBatchRows(String(initialTable.rows.length));
        setBatchCols(String(initialTable.headers.length));
        setFontSize(initialTable.style?.fontSize || 8.5);
        setTitleFontSize(initialTable.style?.titleFontSize || 8.5);
        setFontFamily(initialTable.style?.fontFamily || 'inherit');
      } else {
        setTitle('');
        setHeaders(['Header 1', 'Header 2', 'Header 3']);
        setRows([['', '', ''], ['', '', '']]);
        setNote('');
        setBatchRows('3');
        setBatchCols('3');
        setFontSize(8.5);
        setTitleFontSize(8.5);
        setFontFamily('inherit');
      }
    }
  }, [show, initialTable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (symbolMenuRef.current && !symbolMenuRef.current.contains(event.target as Node)) {
        setShowSymbolMenu(false);
      }
    };
    if (showSymbolMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSymbolMenu]);

  const filteredLit = allResources.filter(r =>
    r.projectId === project?.id &&
    (r.title.toLowerCase().includes(litSearch.toLowerCase()) || r.authors?.some(a => a.toLowerCase().includes(litSearch.toLowerCase())))
  );

  /**
   * handleInsertTextAtCursor - 同步优化
   */
  const handleInsertTextAtCursor = (mode: 'bold' | 'italic' | 'sub' | 'sup' | 'latex' | 'symbol', payload?: string) => {
    if (!focusedElement) return;

    const activeEl = document.activeElement as HTMLInputElement;
    const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (!isInput) return;

    let start = activeEl.selectionStart || 0;
    let end = activeEl.selectionEnd || 0;

    const tags: Record<string, { pre: string; post: string }> = {
      bold: { pre: '**', post: '**' },
      italic: { pre: '*', post: '*' },
      sub: { pre: '$_{', post: '}$' },
      sup: { pre: '$^{', post: '}$' },
      latex: { pre: '$', post: '$' },
      symbol: { pre: '', post: '' }
    };

    const processContent = (original: string) => {
      if (mode === 'symbol') {
        const result = original.substring(0, start) + (payload || '') + original.substring(end);
        const next = start + (payload || '').length;
        setTimeout(() => { activeEl.focus(); activeEl.setSelectionRange(next, next); }, 0);
        return result;
      }

      const { pre, post } = tags[mode];
      let selection = original.substring(start, end);

      const findEnvelopingRange = (text: string, pos: number, preStr: string, postStr: string) => {
        if (!postStr) return null;
        const isSymmetric = preStr === postStr;
        const preIdx = text.lastIndexOf(preStr, isSymmetric ? pos - preStr.length : pos);
        if (preIdx === -1) return null;
        const postIdx = text.indexOf(postStr, pos);
        if (postIdx === -1) return null;
        const inner = text.substring(preIdx + preStr.length, postIdx);
        if (inner.includes('\n')) return null;
        return { start: preIdx, end: postIdx + postStr.length, content: inner };
      };

      const isInternalWrapped = selection.startsWith(pre) && (post ? selection.endsWith(post) : true);
      const enveloped = findEnvelopingRange(original, start, pre, post);

      let resultText = '';
      let nextStart = start;
      let nextEnd = end;

      if (isInternalWrapped && selection.length >= pre.length + (post?.length || 0)) {
        resultText = post ? selection.slice(pre.length, -post.length) : selection.slice(pre.length);
        original = original.substring(0, start) + resultText + original.substring(end);
        nextStart = start;
        nextEnd = start + resultText.length;
      } else if (enveloped) {
        resultText = enveloped.content;
        original = original.substring(0, enveloped.start) + resultText + original.substring(enveloped.end);
        nextStart = enveloped.start;
        nextEnd = nextStart + resultText.length;
      } else if (selection.length === 0 && post) {
        resultText = `${pre}${post}`;
        original = original.substring(0, start) + resultText + original.substring(end);
        nextStart = start + pre.length;
        nextEnd = nextStart;
      } else {
        resultText = `${pre}${selection}${post}`;
        original = original.substring(0, start) + resultText + original.substring(end);
        nextStart = start;
        nextEnd = start + resultText.length;
      }

      setTimeout(() => {
        activeEl.focus();
        activeEl.setSelectionRange(nextStart, nextEnd);
      }, 0);

      return original;
    };

    if (focusedElement.type === 'title') {
      setTitle(prev => processContent(prev));
    } else if (focusedElement.type === 'note') {
      setNote(prev => processContent(prev));
    } else if (focusedElement.type === 'header' && focusedElement.col !== undefined) {
      const newHeaders = [...headers];
      newHeaders[focusedElement.col] = processContent(newHeaders[focusedElement.col]);
      setHeaders(newHeaders);
    } else if (focusedElement.type === 'cell' && focusedElement.row !== undefined && focusedElement.col !== undefined) {
      const newRows = [...rows];
      newRows[focusedElement.row][focusedElement.col] = processContent(newRows[focusedElement.row][focusedElement.col]);
      setRows(newRows);
    }
  };

  const handleInsertLit = (lit: Literature) => {
    if (!focusedElement) return;
    const getAuthorLastName = (name: string) => {
      const t = name.trim();
      if (t.includes(',')) return t.split(',')[0].trim();
      if (/^[\u4e00-\u9fff]+$/.test(t)) return t;
      return t.split(/\s+/)[0] || t;
    };
    const lastName = (lit.authors && lit.authors.length > 0) ? getAuthorLastName(lit.authors[0]) : 'Unknown';
    const tag = lit.type === '专利' ? ` [${lit.source}] ` : ` (${lastName} et al., ${lit.year}) `;
    handleInsertTextAtCursor('symbol', tag);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          { inlineData: { mimeType: file.type, data: base64 } },
          { text: "Extract scientific table data. Return JSON with 'title', 'headers', 'rows', 'note'." }
        ],
        config: {
          ...SPEED_CONFIG,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              headers: { type: Type.ARRAY, items: { type: Type.STRING } },
              rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
              note: { type: Type.STRING }
            }
          }
        }
      });
      const result = JSON.parse(extractJson(response.text || '{}'));
      if (result.headers && result.rows) {
        setTitle(result.title || ''); setHeaders(result.headers); setRows(result.rows); setNote(result.note || '');
        setBatchRows(String(result.rows.length)); setBatchCols(String(result.headers.length));
      }
    } catch (err) { alert(t('writing.tableEditor.ocrFailed')); } finally { setIsOcrLoading(false); }
  };

  const applyMatrixSize = () => {
    const targetRows = Math.max(1, parseInt(batchRows) || 1);
    const targetCols = Math.max(1, parseInt(batchCols) || 1);
    let newHeaders = [...headers];
    if (newHeaders.length < targetCols) {
      for (let i = newHeaders.length; i < targetCols; i++) newHeaders.push(`Header ${i + 1}`);
    } else if (newHeaders.length > targetCols) { newHeaders = newHeaders.slice(0, targetCols); }
    let newRows = rows.map(row => {
      let newRow = [...row];
      if (newRow.length < targetCols) newRow = [...newRow, ...new Array(targetCols - newRow.length).fill('')];
      else if (newRow.length > targetCols) newRow = newRow.slice(0, targetCols);
      return newRow;
    });
    if (newRows.length < targetRows) {
      for (let i = newRows.length; i < targetRows; i++) newRows.push(new Array(targetCols).fill(''));
    } else if (newRows.length > targetRows) { newRows = newRows.slice(0, targetRows); }
    setHeaders(newHeaders); setRows(newRows);
  };

  const handleSave = () => {
    onSave({
      id: initialTable?.id || Date.now().toString(),
      title: title || 'Untitled Table',
      headers, rows, note,
      timestamp: new Date().toLocaleString(),
      style: { fontSize, titleFontSize, fontFamily }
    });
    onClose();
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-[90vw] h-full max-h-[95vh] rounded-3xl p-0 animate-reveal shadow-2xl relative border border-slate-200 flex flex-row overflow-hidden">
        <div className="w-20 bg-teal-600 flex items-center justify-center shrink-0">
          <span className="text-white font-black uppercase text-4xl tracking-[1.2rem]" style={{ writingMode: 'vertical-rl' }}>{t('writing.tableEditor.verticalTitle')}</span>
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="p-4 lg:p-6 border-b border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-50/50 shrink-0">
            <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{t('writing.tableEditor.headerTitle')}</h3>
            <div className="flex flex-wrap items-center justify-end gap-3 flex-1">
              <div className="flex items-center gap-5 bg-white px-5 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                <select className="bg-transparent text-[11px] font-bold outline-none cursor-pointer w-44" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase">TITLE</span>
                  <input type="number" step="0.5" className="w-14 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-center" value={titleFontSize} onChange={e => setTitleFontSize(parseFloat(e.target.value) || 8.5)} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-slate-400 uppercase">GRID</span>
                  <input type="number" step="0.5" className="w-14 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-center" value={fontSize} onChange={e => setFontSize(parseFloat(e.target.value) || 8.5)} />
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                <input type="number" className="w-10 bg-transparent text-sm font-black text-center outline-none text-teal-600" value={batchRows} onChange={e => setBatchRows(e.target.value)} />
                <span className="text-slate-300 font-black text-xs">×</span>
                <input type="number" className="w-10 bg-transparent text-sm font-black text-center outline-none text-emerald-600" value={batchCols} onChange={e => setBatchCols(e.target.value)} />
                <button onClick={applyMatrixSize} className="px-8 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-black transition-all">{t('writing.tableEditor.apply')}</button>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="px-10 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                {isOcrLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}{t('writing.tableEditor.smartOCR')}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              <button onClick={() => setShowLitPanel(!showLitPanel)} onMouseDown={(e) => e.preventDefault()} className={`px-10 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-2 ${showLitPanel ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200'}`}>
                <i className="fa-solid fa-book"></i> {showLitPanel ? t('writing.tableEditor.collapseLit') : t('writing.tableEditor.insertLit')}
              </button>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><i className="fa-solid fa-times"></i></button>
            </div>
          </header>
          <div className="flex-1 flex flex-row min-h-0 relative">
            <div className="w-16 bg-slate-50 border-r border-slate-200 flex flex-col items-center py-6 gap-3 shrink-0 z-30">
              <button onMouseDown={(e) => { e.preventDefault(); handleInsertTextAtCursor('bold'); }} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Bold"><i className="fa-solid fa-bold text-xs"></i></button>
              <button onMouseDown={(e) => { e.preventDefault(); handleInsertTextAtCursor('italic'); }} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Italic"><i className="fa-solid fa-italic text-xs"></i></button>
              <div className="w-8 h-px bg-slate-200 my-1"></div>
              <button onMouseDown={(e) => { e.preventDefault(); handleInsertTextAtCursor('sub'); }} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Subscript (_{})"><i className="fa-solid fa-subscript text-xs"></i></button>
              <button onMouseDown={(e) => { e.preventDefault(); handleInsertTextAtCursor('sup'); }} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Superscript (^{})"><i className="fa-solid fa-superscript text-xs"></i></button>
              <div className="w-8 h-px bg-slate-200 my-1"></div>
              <button onMouseDown={(e) => { e.preventDefault(); handleInsertTextAtCursor('latex'); }} className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="LaTeX Container ($$)"><i className="fa-solid fa-square-root-variable text-xs"></i></button>
              <div className="w-8 h-px bg-slate-200 my-1"></div>
              <div className="relative" ref={symbolMenuRef}>
                <button onClick={() => setShowSymbolMenu(!showSymbolMenu)} onMouseDown={(e) => e.preventDefault()} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm border ${showSymbolMenu ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`} title="Scientific Symbols"><span className="font-serif font-black text-sm leading-none">Ω</span></button>
                {showSymbolMenu && (
                  <div className="absolute left-14 top-0 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 grid grid-cols-6 gap-1.5 z-50 animate-reveal min-w-[220px]">
                    {SYMBOLS.map(sym => (
                      <button key={sym} onMouseDown={(e) => { e.preventDefault(); handleInsertTextAtCursor('symbol', sym); setShowSymbolMenu(false); }} className="w-8 h-8 flex items-center justify-center hover:bg-indigo-50 rounded-lg text-xs font-serif text-slate-700 hover:text-indigo-600 transition-all">{sym}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar bg-slate-50 z-20">
              <div className="max-w-5xl mx-auto space-y-4 pb-20">
                <div className={`p-4 lg:p-5 rounded-3xl bg-white border transition-all shadow-sm cursor-text ${focusedElement?.type === 'title' ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-slate-100'}`} onClick={() => setFocusedElement({ type: 'title' })}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">{t('writing.tableEditor.tableCaption')}</label>
                  {focusedElement?.type === 'title' ? (
                    <input autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none italic" style={{ fontFamily, fontSize: `${titleFontSize}pt` }} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setTimeout(() => setFocusedElement(null), 200)} />
                  ) : (
                    <div className="w-full px-4 py-3 min-h-[40px] text-sm font-bold text-slate-700 italic" style={{ fontFamily, fontSize: `${titleFontSize}pt` }}><LaTeXText text={title || t('writing.tableEditor.clickEditTitle')} orderedCitations={orderedCitations} activeTemplateId={activeTemplateId} />
                    </div>
                  )}
                </div>
                <div className="p-4 lg:p-5 rounded-3xl bg-white border border-slate-100 flex flex-col shadow-md">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">{t('writing.tableEditor.dataGrid')}</label>
                  <div className="overflow-auto border-2 border-slate-900 rounded-2xl bg-white shadow-lg">
                    <table className="w-full border-collapse" style={{ fontFamily, fontSize: `${fontSize}pt` }}>
                      <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr className="border-b-2 border-slate-900">
                          {headers.map((h, i) => (
                            <th key={i} className={`p-0 border-r border-slate-900 last:border-r-0 min-w-[120px] cursor-text ${focusedElement?.type === 'header' && focusedElement.col === i ? 'bg-indigo-50' : ''}`} onClick={() => setFocusedElement({ type: 'header', col: i })}>
                              {focusedElement?.type === 'header' && focusedElement.col === i ? (
                                <input autoFocus className="w-full px-2 py-3 bg-transparent font-black text-xs text-center outline-none uppercase" value={h} onChange={(e) => { const n = [...headers]; n[i] = e.target.value; setHeaders(n); }} onBlur={() => setTimeout(() => setFocusedElement(null), 200)} />
                              ) : (
                                <div className="w-full px-2 py-3 font-black text-xs text-center uppercase truncate"><LaTeXText text={h} /></div>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-slate-200 last:border-b-0 group hover:bg-slate-50/50">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className={`p-0 border-r border-slate-200 last:border-r-0 cursor-text ${focusedElement?.type === 'cell' && focusedElement.row === rIdx && focusedElement.col === cIdx ? 'bg-indigo-50' : ''}`} onClick={() => setFocusedElement({ type: 'cell', row: rIdx, col: cIdx })}>
                                {focusedElement?.type === 'cell' && focusedElement.row === rIdx && focusedElement.col === cIdx ? (
                                  <input autoFocus className="w-full px-3 py-3 bg-transparent text-[11px] font-medium text-center outline-none" value={cell} onChange={(e) => { const n = [...rows]; n[rIdx][cIdx] = e.target.value; setRows(n); }} onBlur={() => setTimeout(() => setFocusedElement(null), 200)} />
                                ) : (
                                  <div className="w-full px-3 py-3 text-[11px] font-medium text-center min-h-[40px] flex items-center justify-center"><LaTeXText text={cell || '--'} orderedCitations={orderedCitations} activeTemplateId={activeTemplateId} />
                                  </div>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className={`p-4 lg:p-5 rounded-3xl bg-white border transition-all shadow-sm cursor-text ${focusedElement?.type === 'note' ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-slate-100'}`} onClick={() => setFocusedElement({ type: 'note' })}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">{t('writing.tableEditor.tableNote')}</label>
                  {focusedElement?.type === 'note' ? (
                    <input autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium italic outline-none" style={{ fontFamily, fontSize: `${fontSize}pt` }} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => setTimeout(() => setFocusedElement(null), 200)} />
                  ) : (
                    <div className="w-full px-4 py-3 min-h-[40px] text-xs font-medium italic text-slate-500" style={{ fontFamily, fontSize: `${fontSize}pt` }}><LaTeXText text={note || t('writing.tableEditor.clickAddNote')} orderedCitations={orderedCitations} activeTemplateId={activeTemplateId} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showLitPanel && (
              <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col p-6 animate-in slide-in-from-right duration-300 shrink-0 z-10">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-book-atlas"></i> {t('writing.tableEditor.litLibrary')}</h4>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold outline-none mb-4" placeholder={t('writing.tableEditor.searchLit')} value={litSearch} onChange={e => setLitSearch(e.target.value)} />
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {filteredLit.map(lit => (
                    <div key={lit.id} onMouseDown={(e) => e.preventDefault()} onClick={() => handleInsertLit(lit)} className="p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group">
                      <p className="text-[10px] font-black text-slate-800 line-clamp-2 leading-tight group-hover:text-indigo-600 mb-1">{lit.title}</p>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">{(() => { const a = lit.authors?.[0]?.trim() || ''; return a.includes(',') ? a.split(',')[0].trim() : /^[\u4e00-\u9fff]+$/.test(a) ? a : a.split(' ')[0] || a; })()} et al., {lit.year}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <footer className="p-4 lg:p-6 border-t border-slate-100 flex gap-4 shrink-0 bg-white shadow-xl relative z-40">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase">{t('writing.tableEditor.cancel')}</button>
            <button onClick={handleSave} className="flex-[2] py-4 bg-teal-600 text-white rounded-xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all">{t('writing.tableEditor.save')}</button>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
};
