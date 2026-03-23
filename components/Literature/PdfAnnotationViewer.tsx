/**
 * PdfAnnotationViewer — 基于 pdf.js 的 PDF 阅读器 + 标注系统
 * 
 * 功能：
 * 1. 使用 pdf.js canvas 渲染 PDF 页面（替代 iframe）
 * 2. 高亮标注（多色）+ 文字批注
 * 3. 文本框选 → 一键发送到 AI 研读助手
 * 4. 标注数据持久化
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// ─── Types ───────────────────────────────────────

export interface PdfHighlight {
  id: string;
  page: number;
  text: string; // The selected text content
  rects: { x: number; y: number; w: number; h: number }[]; // Normalized coordinates [0,1]
  color: HighlightColor;
  note?: string;
  timestamp: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; bg: string; bgHover: string; ring: string }[] = [
  { id: 'yellow', label: '黄色', bg: 'bg-yellow-200/50', bgHover: 'hover:bg-yellow-300/70', ring: 'ring-yellow-400' },
  { id: 'green', label: '绿色', bg: 'bg-emerald-200/50', bgHover: 'hover:bg-emerald-300/70', ring: 'ring-emerald-400' },
  { id: 'blue', label: '蓝色', bg: 'bg-blue-200/50', bgHover: 'hover:bg-blue-300/70', ring: 'ring-blue-400' },
  { id: 'pink', label: '粉色', bg: 'bg-pink-200/50', bgHover: 'hover:bg-pink-300/70', ring: 'ring-pink-400' },
  { id: 'orange', label: '橙色', bg: 'bg-orange-200/50', bgHover: 'hover:bg-orange-300/70', ring: 'ring-orange-400' },
];

const COLOR_CSS: Record<HighlightColor, string> = {
  yellow: 'rgba(253, 224, 71, 0.35)',
  green: 'rgba(110, 231, 183, 0.35)',
  blue: 'rgba(147, 197, 253, 0.35)',
  pink: 'rgba(249, 168, 212, 0.35)',
  orange: 'rgba(253, 186, 116, 0.35)',
};

interface PdfAnnotationViewerProps {
  /** Base64 file data (from electron readFile) */
  fileData: string;
  /** MIME type (should be application/pdf) */
  mimeType: string;
  /** Existing highlights to render */
  highlights?: PdfHighlight[];
  /** Called when highlights change */
  onHighlightsChange?: (highlights: PdfHighlight[]) => void;
  /** Called when user selects text to send to AI */
  onSendToAI?: (text: string) => void;
}

const PdfAnnotationViewer: React.FC<PdfAnnotationViewerProps> = ({
  fileData,
  mimeType,
  highlights = [],
  onHighlightsChange,
  onSendToAI,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Canvas refs for current page
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [selectedText, setSelectedText] = useState('');
  const [selectionRects, setSelectionRects] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [activeColor, setActiveColor] = useState<HighlightColor>('yellow');
  
  // Note editing  
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  
  // Sidebar for annotations list
  const [showAnnotationsSidebar, setShowAnnotationsSidebar] = useState(false);
  
  // Page input for jump
  const [pageInputValue, setPageInputValue] = useState('');
  const [showPageInput, setShowPageInput] = useState(false);
  
  // Rotation
  const [rotation, setRotation] = useState(0);
  
  // Page highlights for quick access
  const pageHighlights = highlights.filter(h => h.page === currentPage);

  // ─── Load PDF ──────────────────────────────────
  useEffect(() => {
    if (!fileData || mimeType !== 'application/pdf') return;
    
    setIsLoading(true);
    setError(null);
    
    const loadPdf = async () => {
      try {
        // Convert base64 to Uint8Array
        const binaryData = atob(fileData);
        const array = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          array[i] = binaryData.charCodeAt(i);
        }
        
        const doc = await pdfjsLib.getDocument({ data: array }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (e) {
        console.error('PDF load error:', e);
        setError('PDF 文件加载失败，请确认文件格式正确');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPdf();
    
    return () => {
      // Cleanup
      pdfDoc?.destroy();
    };
  }, [fileData]);

  // ─── Render Page ──────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render PDF page to canvas
        await page.render({
          canvasContext: context,
          viewport,
        }).promise;
        
        // Render text layer for selection
        if (textLayerRef.current) {
          textLayerRef.current.innerHTML = '';
          textLayerRef.current.style.width = `${viewport.width}px`;
          textLayerRef.current.style.height = `${viewport.height}px`;
          
          const textContent = await page.getTextContent();
          
          textContent.items.forEach((item: any) => {
            if (!item.str) return;
            
            const tx = pdfjsLib.Util.transform(
              viewport.transform,
              item.transform
            );
            
            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.position = 'absolute';
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - item.height * scale}px`;
            span.style.fontSize = `${item.height * scale}px`;
            span.style.fontFamily = item.fontName || 'sans-serif';
            span.style.color = 'transparent';
            span.style.whiteSpace = 'pre';
            span.style.transformOrigin = '0 0';
            
            // Handle width based on text content
            if (item.width) {
              const textWidth = item.width * scale;
              span.style.width = `${textWidth}px`;
              span.style.letterSpacing = '0';
            }
            
            textLayerRef.current!.appendChild(span);
          });
        }
        
        // Update highlight layer size
        if (highlightLayerRef.current) {
          highlightLayerRef.current.style.width = `${viewport.width}px`;
          highlightLayerRef.current.style.height = `${viewport.height}px`;
        }
      } catch (e) {
        console.error('Page render error:', e);
      }
    };
    
    renderPage();
  }, [pdfDoc, currentPage, scale, rotation]);

  // ─── Handle Text Selection ──────────────────────────
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current || !canvasRef.current) {
      setShowToolbar(false);
      return;
    }
    
    const text = selection.toString().trim();
    if (!text) {
      setShowToolbar(false);
      return;
    }
    
    setSelectedText(text);
    
    // Get selection rectangles normalized to canvas
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    const normalizedRects = rects.map(r => ({
      x: (r.left - canvasRect.left) / canvasRect.width,
      y: (r.top - canvasRect.top) / canvasRect.height,
      w: r.width / canvasRect.width,
      h: r.height / canvasRect.height,
    }));
    
    setSelectionRects(normalizedRects);
    
    // Position toolbar near the end of selection
    if (rects.length > 0) {
      const lastRect = rects[rects.length - 1];
      const containerRect = containerRef.current.getBoundingClientRect();
      setToolbarPos({
        x: lastRect.right - containerRect.left,
        y: lastRect.bottom - containerRect.top + 8,
      });
      setShowToolbar(true);
    }
  }, []);

  // ─── Add Highlight ──────────────────────────────────
  const addHighlight = (color: HighlightColor = activeColor) => {
    if (!selectedText || selectionRects.length === 0) return;
    
    const newHighlight: PdfHighlight = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      page: currentPage,
      text: selectedText,
      rects: selectionRects,
      color,
      timestamp: new Date().toLocaleString(),
    };
    
    const updated = [...highlights, newHighlight];
    onHighlightsChange?.(updated);
    
    setShowToolbar(false);
    setSelectedText('');
    setSelectionRects([]);
    window.getSelection()?.removeAllRanges();
  };

  // ─── Remove Highlight ──────────────────────────────────
  const removeHighlight = (id: string) => {
    const updated = highlights.filter(h => h.id !== id);
    onHighlightsChange?.(updated);
    setEditingHighlightId(null);
  };

  // ─── Update Highlight Note ──────────────────────────
  const updateHighlightNote = (id: string, note: string) => {
    const updated = highlights.map(h => h.id === id ? { ...h, note } : h);
    onHighlightsChange?.(updated);
  };

  // ─── Navigation ──────────────────────────────────
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  // ─── Fit Width / Fit Page ──────────────────────────
  const fitToWidth = async () => {
    if (!pdfDoc || !containerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const unscaledViewport = page.getViewport({ scale: 1, rotation });
    const containerWidth = containerRef.current.clientWidth - 48; // padding
    const newScale = containerWidth / unscaledViewport.width;
    setScale(Math.round(newScale * 100) / 100);
  };

  const fitToPage = async () => {
    if (!pdfDoc || !containerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const unscaledViewport = page.getViewport({ scale: 1, rotation });
    const containerWidth = containerRef.current.clientWidth - 48;
    const containerHeight = containerRef.current.clientHeight - 48;
    const scaleW = containerWidth / unscaledViewport.width;
    const scaleH = containerHeight / unscaledViewport.height;
    const newScale = Math.min(scaleW, scaleH);
    setScale(Math.round(newScale * 100) / 100);
  };

  // ─── Rotate ──────────────────────────────────────
  const rotateCW = () => setRotation(r => (r + 90) % 360);

  // ─── Download ──────────────────────────────────────
  const handleDownload = () => {
    try {
      const binaryData = atob(fileData);
      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  // ─── Print ──────────────────────────────────────
  const handlePrint = () => {
    try {
      const binaryData = atob(fileData);
      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    } catch (e) {
      console.error('Print failed:', e);
    }
  };

  // ─── Page Jump via Input ──────────────────────────
  const handlePageInputSubmit = () => {
    const num = parseInt(pageInputValue);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      setCurrentPage(num);
    }
    setShowPageInput(false);
    setPageInputValue('');
  };

  // ─── Loading State ──────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 rounded-2xl">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-spinner animate-spin text-3xl text-indigo-500"></i>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">正在加载 PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 rounded-2xl">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <i className="fa-solid fa-file-circle-exclamation text-3xl"></i>
          <span className="text-xs font-bold">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
      {/* ─── Top Toolbar ──────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-all"
            title="上一页"
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>
          {showPageInput ? (
            <input
              type="number"
              className="w-12 h-7 text-center text-[10px] font-black text-slate-600 border border-indigo-300 rounded-lg outline-none bg-indigo-50 tabular-nums"
              value={pageInputValue}
              onChange={e => setPageInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePageInputSubmit(); if (e.key === 'Escape') { setShowPageInput(false); setPageInputValue(''); } }}
              onBlur={handlePageInputSubmit}
              autoFocus
              min={1}
              max={totalPages}
            />
          ) : (
            <button
              onClick={() => { setShowPageInput(true); setPageInputValue(String(currentPage)); }}
              className="text-[10px] font-black text-slate-600 px-2 tabular-nums hover:bg-indigo-50 rounded-lg h-7 flex items-center transition-all"
              title="点击输入页码跳转"
            >
              {currentPage} / {totalPages}
            </button>
          )}
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 transition-all"
            title="下一页"
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </div>
        
        <div className="w-px h-5 bg-slate-200"></div>
        
        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button onClick={zoomOut} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="缩小">
            <i className="fa-solid fa-minus"></i>
          </button>
          <span className="text-[9px] font-black text-slate-400 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="放大">
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>
        
        <div className="w-px h-5 bg-slate-200"></div>

        {/* Fit & Rotate */}
        <div className="flex items-center gap-1">
          <button onClick={fitToWidth} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="适应宽度">
            <i className="fa-solid fa-arrows-left-right"></i>
          </button>
          <button onClick={fitToPage} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="适应页面">
            <i className="fa-solid fa-expand"></i>
          </button>
          <button onClick={rotateCW} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="顺时针旋转">
            <i className="fa-solid fa-rotate-right"></i>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200"></div>
        
        {/* Color Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] font-black text-slate-400 uppercase mr-1">标注色</span>
          {HIGHLIGHT_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveColor(c.id)}
              className={`w-5 h-5 rounded-full transition-all ${activeColor === c.id ? `ring-2 ${c.ring} ring-offset-1 scale-110` : 'hover:scale-110'}`}
              style={{ backgroundColor: COLOR_CSS[c.id].replace('0.35', '0.8') }}
              title={c.label}
            />
          ))}
        </div>
        
        <div className="flex-1"></div>

        {/* Download & Print */}
        <div className="flex items-center gap-1">
          <button onClick={handleDownload} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="下载 PDF">
            <i className="fa-solid fa-download"></i>
          </button>
          <button onClick={handlePrint} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all" title="打印">
            <i className="fa-solid fa-print"></i>
          </button>
        </div>

        <div className="w-px h-5 bg-slate-200"></div>
        
        {/* Annotations sidebar toggle */}
        <button
          onClick={() => setShowAnnotationsSidebar(!showAnnotationsSidebar)}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 transition-all border ${
            showAnnotationsSidebar 
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
              : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          <i className="fa-solid fa-highlighter text-[8px]"></i>
          标注 ({highlights.length})
        </button>
      </div>
      
      {/* ─── Main Content Area ──────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* PDF Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto custom-scrollbar relative bg-slate-200/50"
          onMouseUp={handleMouseUp}
        >
          <div className="flex justify-center py-6 px-4">
            <div className="relative shadow-2xl bg-white">
              {/* PDF Canvas */}
              <canvas ref={canvasRef} className="block" />
              
              {/* Text Layer (for selection) */}
              <div
                ref={textLayerRef}
                className="absolute top-0 left-0 select-text"
                style={{ mixBlendMode: 'multiply' }}
              />
              
              {/* Highlight Layer */}
              <div
                ref={highlightLayerRef}
                className="absolute top-0 left-0 pointer-events-none"
              >
                {pageHighlights.map(hl => (
                  <React.Fragment key={hl.id}>
                    {hl.rects.map((rect, ri) => (
                      <div
                        key={`${hl.id}_${ri}`}
                        className="absolute pointer-events-auto cursor-pointer transition-all hover:brightness-90 group/hl"
                        style={{
                          left: `${rect.x * 100}%`,
                          top: `${rect.y * 100}%`,
                          width: `${rect.w * 100}%`,
                          height: `${rect.h * 100}%`,
                          backgroundColor: COLOR_CSS[hl.color],
                          borderRadius: '2px',
                        }}
                        onClick={() => {
                          setEditingHighlightId(editingHighlightId === hl.id ? null : hl.id);
                          setNoteText(hl.note || '');
                        }}
                      >
                        {/* Note indicator */}
                        {hl.note && ri === 0 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm pointer-events-none">
                            <i className="fa-solid fa-comment text-[5px] text-white"></i>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Note Edit Popover */}
                    {editingHighlightId === hl.id && hl.rects.length > 0 && (
                      <div 
                        className="absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-64 animate-reveal"
                        style={{
                          left: `${hl.rects[0].x * 100}%`,
                          top: `${(hl.rects[hl.rects.length - 1].y + hl.rects[hl.rects.length - 1].h) * 100 + 1}%`,
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">标注笔记</span>
                          <div className="flex items-center gap-1">
                            {onSendToAI && (
                              <button
                                onClick={() => onSendToAI(hl.text)}
                                className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[7px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1"
                                title="发送到 AI 研读助手"
                              >
                                <i className="fa-solid fa-robot text-[6px]"></i> AI
                              </button>
                            )}
                            <button
                              onClick={() => removeHighlight(hl.id)}
                              className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </div>
                        </div>
                        
                        {/* Highlighted text preview */}
                        <div className="bg-slate-50 rounded-lg p-2 mb-2 border border-slate-100">
                          <p className="text-[9px] text-slate-600 leading-relaxed line-clamp-3 italic">"{hl.text}"</p>
                        </div>
                        
                        <textarea
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] text-slate-700 outline-none resize-none focus:ring-2 focus:ring-indigo-200 transition-all"
                          rows={3}
                          placeholder="添加批注..."
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          autoFocus
                        />
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[7px] text-slate-400">{hl.timestamp}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingHighlightId(null)}
                              className="px-2 py-1 text-[8px] font-bold text-slate-400 hover:text-slate-600 transition-all"
                            >
                              关闭
                            </button>
                            <button
                              onClick={() => {
                                updateHighlightNote(hl.id, noteText);
                                setEditingHighlightId(null);
                              }}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              {/* Selection Toolbar (floating) */}
              {showToolbar && (
                <div
                  className="absolute z-[100] bg-slate-900 text-white rounded-xl shadow-2xl px-2 py-1.5 flex items-center gap-1 animate-reveal"
                  style={{
                    left: `${toolbarPos.x}px`,
                    top: `${toolbarPos.y}px`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {HIGHLIGHT_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => addHighlight(c.id)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center hover:scale-110 transition-all"
                      style={{ backgroundColor: COLOR_CSS[c.id].replace('0.35', '0.7') }}
                      title={`${c.label}高亮`}
                    >
                      <i className="fa-solid fa-highlighter text-[8px] text-white drop-shadow-sm"></i>
                    </button>
                  ))}
                  
                  <div className="w-px h-5 bg-white/20 mx-1"></div>
                  
                  {onSendToAI && (
                    <button
                      onClick={() => {
                        onSendToAI(selectedText);
                        setShowToolbar(false);
                        window.getSelection()?.removeAllRanges();
                      }}
                      className="px-2 h-6 bg-indigo-500 rounded-lg text-[8px] font-black uppercase flex items-center gap-1 hover:bg-indigo-400 transition-all"
                    >
                      <i className="fa-solid fa-robot text-[7px]"></i> 问 AI
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedText);
                      setShowToolbar(false);
                      window.getSelection()?.removeAllRanges();
                    }}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    title="复制文本"
                  >
                    <i className="fa-solid fa-copy"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* ─── Annotations Sidebar ──────────────────── */}
        {showAnnotationsSidebar && (
          <div className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                <i className="fa-solid fa-highlighter text-[8px]"></i>
                全部标注 ({highlights.length})
              </span>
              <button
                onClick={() => setShowAnnotationsSidebar(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-slate-400 hover:bg-slate-100 transition-all"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {highlights.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                  <i className="fa-solid fa-highlighter text-2xl opacity-30"></i>
                  <p className="text-[9px] font-bold uppercase">选中文本即可添加标注</p>
                </div>
              ) : (
                highlights.map(hl => (
                  <div
                    key={hl.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all group/ann ${
                      hl.page === currentPage 
                        ? 'border-indigo-200 bg-indigo-50/50' 
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                    onClick={() => {
                      if (hl.page !== currentPage) setCurrentPage(hl.page);
                      setEditingHighlightId(hl.id);
                      setNoteText(hl.note || '');
                    }}
                  >
                    {/* Color strip + page label */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: COLOR_CSS[hl.color].replace('0.35', '0.8') }}
                        />
                        <span className="text-[7px] font-black text-slate-400 uppercase">P.{hl.page}</span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/ann:opacity-100 transition-opacity">
                        {onSendToAI && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSendToAI(hl.text); }}
                            className="w-5 h-5 rounded flex items-center justify-center text-[7px] text-indigo-400 hover:bg-indigo-50 transition-all"
                            title="发送到 AI"
                          >
                            <i className="fa-solid fa-robot"></i>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(hl.text); }}
                          className="w-5 h-5 rounded flex items-center justify-center text-[7px] text-slate-400 hover:bg-slate-100 transition-all"
                          title="复制"
                        >
                          <i className="fa-solid fa-copy"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeHighlight(hl.id); }}
                          className="w-5 h-5 rounded flex items-center justify-center text-[7px] text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          title="删除"
                        >
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </div>
                    </div>
                    
                    {/* Quoted text */}
                    <p className="text-[9px] text-slate-600 leading-relaxed line-clamp-3 italic">
                      &ldquo;{hl.text}&rdquo;
                    </p>
                    
                    {/* Note */}
                    {hl.note && (
                      <div className="mt-1.5 pl-2 border-l-2 border-indigo-200">
                        <p className="text-[8px] text-indigo-600 font-medium leading-relaxed line-clamp-2">{hl.note}</p>
                      </div>
                    )}
                    
                    <span className="text-[7px] text-slate-300 mt-1 block">{hl.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfAnnotationViewer;
