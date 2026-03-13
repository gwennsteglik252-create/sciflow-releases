import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../../locales/useTranslation';

interface FindReplaceWidgetProps {
  show: boolean;
  onClose: () => void;
  findTerm: string;
  setFindTerm: (v: string) => void;
  replaceTerm: string;
  setReplaceTerm: (v: string) => void;
  onFind: (direction: 'next' | 'prev') => void;
  onReplace: () => void;
  onReplaceAll: () => void;
}

export const FindReplaceWidget: React.FC<FindReplaceWidgetProps> = ({
  show, onClose, findTerm, setFindTerm, replaceTerm, setReplaceTerm, onFind, onReplace, onReplaceAll
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const { t } = useTranslation();
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!show) {
      setPosition({ x: 0, y: 0 }); // Reset position on close/reopen
    }
  }, [show]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow dragging with left mouse button
    if (e.button !== 0) return;

    // Don't start dragging if we're clicking a button or an input
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    // Prevent default to avoid text selection issues during drag
    e.preventDefault();

    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };

    // Capture the pointer to continue receiving events even if the mouse leaves the header
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;

    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  if (!show) return null;

  return (
    <div
      className="absolute top-20 right-8 z-[100] bg-white p-4 rounded-2xl shadow-2xl border border-slate-200 w-72 ring-4 ring-black/5"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        // We use a local simple animation to avoid transform conflicts with global animate-reveal
        animation: 'find-replace-entry 0.3s cubic-bezier(0, 0, 0.2, 1) forwards'
      }}
    >
      <style>{`
            @keyframes find-replace-entry {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `}</style>
      <div
        className="flex justify-between items-center mb-3 cursor-move select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <h5 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 pointer-events-none">
          <i className="fa-solid fa-magnifying-glass"></i> {t('writing.findReplace.title')}
        </h5>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
        >
          <i className="fa-solid fa-times"></i>
        </button>
      </div>
      <div className="space-y-3">
        <div className="bg-slate-50 flex items-center px-3 py-2 rounded-xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
          <i className="fa-solid fa-font text-slate-400 text-xs mr-2"></i>
          <input
            className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder:text-slate-300"
            placeholder={t('writing.findReplace.findPlaceholder')}
            value={findTerm}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={e => setFindTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onFind('next')}
            autoFocus
          />
        </div>
        <div className="bg-slate-50 flex items-center px-3 py-2 rounded-xl border border-slate-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
          <i className="fa-solid fa-pen text-slate-400 text-xs mr-2"></i>
          <input
            className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-full placeholder:text-slate-300"
            placeholder={t('writing.findReplace.replacePlaceholder')}
            value={replaceTerm}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={e => setReplaceTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onReplace()}
          />
        </div>
        <div className="flex gap-2">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onFind('prev')} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 hover:bg-slate-50 transition-all"><i className="fa-solid fa-arrow-up mr-1"></i> {t('writing.findReplace.prev')}</button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onFind('next')} className="flex-1 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-600 hover:bg-slate-50 transition-all"><i className="fa-solid fa-arrow-down mr-1"></i> {t('writing.findReplace.next')}</button>
        </div>
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onReplace} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black hover:bg-indigo-100 transition-all">{t('writing.findReplace.replace')}</button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onReplaceAll} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-[9px] font-black hover:bg-indigo-700 transition-all shadow-sm">{t('writing.findReplace.replaceAll')}</button>
        </div>
      </div>
    </div>
  );
};