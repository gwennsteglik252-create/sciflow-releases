/**
 * PdfFigureExtractor — PDF 文献图片截取弹窗
 *
 * 使用 pdfjs-dist 渲染 PDF 页面到 canvas，支持：
 * 1. 浏览 PDF 页面（翻页 + 缩放）
 * 2. 框选矩形区域
 * 3. 截取框选区域为高清 PNG → 发送到组图画布
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfFigureExtractorProps {
  /** base64 PDF 数据 (不含 data: 前缀) */
  fileData: string;
  /** 文献标题 */
  sourceTitle?: string;
  /** 关闭弹窗 */
  onClose: () => void;
  /** 截取的图片发送到组图 */
  onExtract: (imageData: string, meta: { sourceTitle?: string; sourcePage: number }) => void;
}

const PdfFigureExtractor: React.FC<PdfFigureExtractorProps> = ({
  fileData,
  sourceTitle,
  onClose,
  onExtract,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 框选状态
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [hasCrop, setHasCrop] = useState(false);

  // ─── 加载 PDF ──────────────────────────────────
  useEffect(() => {
    if (!fileData) return;
    setIsLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
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
        setError('PDF 加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
    return () => { pdfDoc?.destroy(); };
  }, [fileData]);

  // ─── 渲染当前页 ──────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        // 同步 overlay 尺寸
        if (overlayRef.current) {
          overlayRef.current.width = viewport.width;
          overlayRef.current.height = viewport.height;
        }

        // 翻页后清除框选
        clearCrop();
      } catch (e) {
        console.error('Page render error:', e);
      }
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // ─── 框选绘制 ──────────────────────────────────
  const drawCropRect = useCallback(() => {
    if (!overlayRef.current || !cropStart || !cropEnd) return;
    const ctx = overlayRef.current.getContext('2d')!;
    const w = overlayRef.current.width;
    const h = overlayRef.current.height;
    ctx.clearRect(0, 0, w, h);

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const rw = Math.abs(cropEnd.x - cropStart.x);
    const rh = Math.abs(cropEnd.y - cropStart.y);

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, w, h);

    // 清除框选区域（显示原图）
    ctx.clearRect(x, y, rw, rh);

    // 框选边框
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, rw, rh);

    // 尺寸标注
    if (rw > 40 && rh > 20) {
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(79, 70, 229, 0.9)';
      const label = `${Math.round(rw)} × ${Math.round(rh)}`;
      ctx.font = 'bold 11px system-ui';
      const tm = ctx.measureText(label);
      const lx = x + rw / 2 - tm.width / 2 - 4;
      const ly = y + rh + 4;
      ctx.fillRect(lx, ly, tm.width + 8, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + 4, ly + 13);
    }
  }, [cropStart, cropEnd]);

  useEffect(() => {
    drawCropRect();
  }, [drawCropRect]);

  const clearCrop = () => {
    setCropStart(null);
    setCropEnd(null);
    setHasCrop(false);
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  };

  // ─── 鼠标事件 ──────────────────────────────────
  const getCanvasCoords = (e: React.MouseEvent) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);
    setCropStart(pos);
    setCropEnd(pos);
    setIsCropping(true);
    setHasCrop(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isCropping) return;
    setCropEnd(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    if (!isCropping) return;
    setIsCropping(false);
    if (cropStart && cropEnd) {
      const rw = Math.abs(cropEnd.x - cropStart.x);
      const rh = Math.abs(cropEnd.y - cropStart.y);
      if (rw > 10 && rh > 10) {
        setHasCrop(true);
      } else {
        clearCrop();
      }
    }
  };

  // ─── 截取图片 ──────────────────────────────────
  const handleExtract = () => {
    if (!canvasRef.current || !cropStart || !cropEnd) return;

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const rw = Math.abs(cropEnd.x - cropStart.x);
    const rh = Math.abs(cropEnd.y - cropStart.y);

    // 创建临时 canvas 截取区域
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = rw;
    tmpCanvas.height = rh;
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.drawImage(canvasRef.current, x, y, rw, rh, 0, 0, rw, rh);

    const imageData = tmpCanvas.toDataURL('image/png');
    onExtract(imageData, { sourceTitle, sourcePage: currentPage });
    clearCrop();
  };

  // ─── 截取整页 ──────────────────────────────────
  const handleExtractFullPage = () => {
    if (!canvasRef.current) return;
    const imageData = canvasRef.current.toDataURL('image/png');
    onExtract(imageData, { sourceTitle, sourcePage: currentPage });
  };

  // ─── 翻页和缩放 ──────────────────────────────────
  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <i className="fa-solid fa-spinner animate-spin text-3xl text-indigo-500"></i>
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">正在加载 PDF...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <i className="fa-solid fa-file-circle-exclamation text-3xl text-slate-400"></i>
          <span className="text-xs font-bold text-slate-500">{error}</span>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">关闭</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        style={{ width: '85vw', height: '85vh', maxWidth: 1200, maxHeight: 900 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Header ──────────────────────── */}
        <div className="bg-slate-900 px-5 py-3 flex items-center gap-4 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-crop-simple text-sm"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-white uppercase tracking-wide leading-none">图片提取器</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
              {sourceTitle || 'PDF Document'} — P.{currentPage}/{totalPages}
            </p>
          </div>

          {/* 翻页控制 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white disabled:opacity-30 transition-all"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span className="text-xs font-black text-white/70 px-2 tabular-nums min-w-[40px] text-center">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white disabled:opacity-30 transition-all"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          <div className="w-px h-6 bg-white/10"></div>

          {/* 缩放 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
            >
              <i className="fa-solid fa-minus text-[10px]"></i>
            </button>
            <span className="text-[10px] font-black text-white/50 w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(4, s + 0.25))}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
            </button>
          </div>

          <div className="w-px h-6 bg-white/10"></div>

          {/* 操作按钮 */}
          <button
            onClick={handleExtractFullPage}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <i className="fa-solid fa-file-image"></i> 整页截取
          </button>
          <button
            onClick={handleExtract}
            disabled={!hasCrop}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 active:scale-95"
          >
            <i className="fa-solid fa-crop-simple"></i> 截取选区
          </button>
          {hasCrop && (
            <button
              onClick={clearCrop}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-rose-500/30 hover:text-rose-300 transition-all"
              title="清除选区"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all ml-2"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* ─── 提示栏 ──────────────────────── */}
        <div className="bg-amber-50 border-b border-amber-100 px-5 py-2 flex items-center gap-2 shrink-0">
          <i className="fa-solid fa-circle-info text-amber-500 text-xs"></i>
          <span className="text-[10px] font-bold text-amber-700">
            在 PDF 页面上 <strong>拖拽框选</strong> 需要截取的图片区域，然后点击「截取选区」发送到组图画布
          </span>
        </div>

        {/* ─── PDF Canvas ──────────────────── */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-slate-200/50 custom-scrollbar">
          <div className="flex justify-center py-6 px-4">
            <div className="relative shadow-2xl bg-white cursor-crosshair">
              <canvas ref={canvasRef} className="block" />
              <canvas
                ref={overlayRef}
                className="absolute top-0 left-0"
                style={{ cursor: isCropping ? 'crosshair' : 'crosshair' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfFigureExtractor;
