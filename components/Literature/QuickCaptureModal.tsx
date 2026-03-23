import React, { useState, useCallback } from 'react';
import type { Literature, LiteratureCollection } from '../../types';
import { smartResourceSearch, SearchFilters, SearchField } from '../../services/gemini';

interface QuickCaptureModalProps {
  onImport: (items: Literature[]) => void;
  onImportBibTeX?: (raw: string) => Promise<void> | void;
  onClose: () => void;
  collections?: LiteratureCollection[];
  projectId: string;
  isBibParsing?: boolean;
}

type InputType = 'unknown' | 'doi' | 'url' | 'title' | 'bibtex';

const detectInputType = (input: string): InputType => {
  const trimmed = input.trim();
  if (!trimmed) return 'unknown';
  // BibTeX pattern: @article{, @inproceedings{, @book{, @misc{, etc.
  if (/^@\w+\s*\{/m.test(trimmed)) return 'bibtex';
  // DOI pattern: 10.xxxx/xxxx
  if (/^10\.\d{4,}\//.test(trimmed) || trimmed.toLowerCase().startsWith('https://doi.org/')) return 'doi';
  // URL pattern
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  // Otherwise treat as title
  return 'title';
};

const INPUT_TYPE_INFO: Record<InputType, { label: string; icon: string; color: string }> = {
  unknown: { label: '等待输入', icon: 'fa-paste', color: 'text-slate-400' },
  doi: { label: 'DOI 检测到', icon: 'fa-fingerprint', color: 'text-emerald-600' },
  url: { label: 'URL 检测到', icon: 'fa-link', color: 'text-sky-600' },
  title: { label: '标题搜索模式', icon: 'fa-magnifying-glass', color: 'text-amber-600' },
  bibtex: { label: 'BibTeX 格式', icon: 'fa-code', color: 'text-indigo-600' },
};

const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  onImport, onImportBibTeX, onClose, collections, projectId, isBibParsing,
}) => {
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set([0]));
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [error, setError] = useState('');
  const [bibSuccess, setBibSuccess] = useState(false);

  const inputType = detectInputType(input);
  const typeInfo = INPUT_TYPE_INFO[inputType];
  const isBibTeX = inputType === 'bibtex';

  const handleSearch = useCallback(async () => {
    if (!input.trim() || isSearching) return;

    // BibTeX 模式 → 直接调用 BibTeX 导入
    if (isBibTeX && onImportBibTeX) {
      setBibSuccess(false);
      setError('');
      try {
        await onImportBibTeX(input.trim());
        setBibSuccess(true);
        setTimeout(() => onClose(), 1500);
      } catch (e) {
        setError('BibTeX 解析失败，请检查格式');
      }
      return;
    }

    setIsSearching(true);
    setError('');
    setPreviewItems([]);
    try {
      const trimmed = input.trim();
      let searchField: SearchField = 'topic';
      let keywords: string[] = [trimmed];

      if (inputType === 'doi') {
        searchField = 'doi';
        keywords = [trimmed.replace('https://doi.org/', '')];
      } else if (inputType === 'url') {
        // Extract DOI from URL if possible
        const doiMatch = trimmed.match(/10\.\d{4,}\/[^\s]+/);
        if (doiMatch) {
          searchField = 'doi';
          keywords = [doiMatch[0]];
        } else {
          searchField = 'topic';
          // Extract meaningful text from URL
          const urlPath = new URL(trimmed).pathname;
          keywords = [urlPath.replace(/[/_-]/g, ' ').trim() || trimmed];
        }
      } else {
        searchField = 'title';
      }

      const filters: SearchFilters = { docType: 'All', timeRange: 'all', highImpactOnly: false };
      const result = await smartResourceSearch(keywords, '文献', filters, searchField);

      if (result.items.length === 0) {
        setError('未找到匹配文献，请尝试用其他关键词或 DOI');
      } else {
        setPreviewItems(result.items);
        setSelectedIdx(new Set([0]));
      }
    } catch (e) {
      console.error('[QuickCapture] Search failed:', e);
      setError('检索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  }, [input, inputType, isSearching, isBibTeX, onImportBibTeX, onClose]);

  const handleImport = () => {
    const toImport = previewItems
      .filter((_: any, idx: number) => selectedIdx.has(idx))
      .map((item: any) => ({
        ...item,
        id: `qc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        type: '文献' as const,
        readingStatus: 'unread' as const,
        tags: [...(item.tags || []), '快速抓取'],
        collectionIds: selectedCollectionId ? [selectedCollectionId] : undefined,
      }));
    if (toImport.length > 0) {
      onImport(toImport);
      onClose();
    }
  };

  const toggleSelect = (idx: number) => {
    setSelectedIdx(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const isProcessing = isSearching || (isBibParsing ?? false);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[800px] max-h-[85vh] flex flex-col overflow-hidden animate-reveal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-bolt text-amber-500"></i>
              智能导入
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">粘贴 DOI / URL / 论文标题 / BibTeX，自动识别并导入</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Input Area */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <textarea
              autoFocus
              rows={isBibTeX ? 8 : 4}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !isBibTeX) { e.preventDefault(); handleSearch(); } }}
              placeholder={`粘贴 DOI、论文 URL、中英文标题，或 BibTeX 代码...\n\n示例：\n10.1038/s41586-024-07169-z\nhttps://arxiv.org/abs/2401.12345\nSolid-state electrolyte for lithium metal batteries\n@article{Author2024, title={...}, ...}`}
              className={`w-full border rounded-xl px-4 py-3 text-xs font-bold outline-none transition-all resize-none ${
                isBibTeX
                  ? 'bg-slate-900 text-indigo-300 border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 font-mono'
                  : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-amber-200 focus:border-amber-300'
              }`}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <span className={`text-[8px] font-black uppercase flex items-center gap-1 ${isBibTeX ? 'bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md' : typeInfo.color}`}>
                <i className={`fa-solid ${typeInfo.icon} text-[7px]`}></i>
                {typeInfo.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSearch}
              disabled={!input.trim() || isProcessing}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                isBibTeX
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              <i className={`fa-solid ${isProcessing ? 'fa-circle-notch animate-spin' : isBibTeX ? 'fa-sync' : 'fa-magnifying-glass'} text-[9px]`}></i>
              {isProcessing ? (isBibTeX ? '解析中...' : '检索中...') : (isBibTeX ? '导入 BibTeX' : '检索')}
            </button>

            {/* Collection selector */}
            {!isBibTeX && collections && collections.length > 0 && (
              <select
                value={selectedCollectionId}
                onChange={e => setSelectedCollectionId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none"
              >
                <option value="">不归入集合</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.parentId ? '  └ ' : ''}{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 rounded-xl px-3 py-2 text-[10px] font-bold flex items-center gap-1.5 border border-rose-200">
              <i className="fa-solid fa-circle-exclamation"></i>{error}
            </div>
          )}

          {bibSuccess && (
            <div className="bg-emerald-50 text-emerald-700 rounded-xl px-3 py-2 text-[10px] font-bold flex items-center gap-1.5 border border-emerald-200 animate-reveal">
              <i className="fa-solid fa-circle-check"></i> BibTeX 已成功同步至项目档案！
            </div>
          )}
        </div>

        {/* Preview Results */}
        {previewItems.length > 0 && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0 space-y-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">检索结果 · 点击勾选后导入</p>
            {previewItems.map((item: any, idx: number) => (
              <div
                key={idx}
                onClick={() => toggleSelect(idx)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedIdx.has(idx) ? 'border-amber-400 bg-amber-50/50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${selectedIdx.has(idx) ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'}`}>
                    {selectedIdx.has(idx) && <i className="fa-solid fa-check text-[8px]"></i>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-black text-slate-800 line-clamp-2 leading-tight">{item.title}</h4>
                    {item.englishTitle && <p className="text-[8px] text-slate-400 line-clamp-1 mt-0.5 font-serif italic">{item.englishTitle}</p>}
                    <div className="flex items-center gap-2 mt-1 text-[8px] text-slate-400 flex-wrap">
                      <span>{item.authors?.slice(0, 3).join(', ')}{(item.authors?.length || 0) > 3 ? ' 等' : ''}</span>
                      <span className="font-bold">{item.source} · {item.year}</span>
                      {item.doi && <span className="text-indigo-400">DOI: {item.doi}</span>}
                    </div>
                    {item.abstract && <p className="text-[9px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">{item.abstract}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Import Action */}
        {previewItems.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">已选 {selectedIdx.size} 篇</span>
            <button
              onClick={handleImport}
              disabled={selectedIdx.size === 0}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-30"
            >
              <i className="fa-solid fa-file-import text-[9px]"></i>
              导入选中 ({selectedIdx.size})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickCaptureModal;
