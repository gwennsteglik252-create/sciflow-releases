
import React, { useState, useRef, useEffect } from 'react';

interface PanelControlsProps {
  spanCols: number;
  spanRows: number;
  hasCrop?: boolean;
  onToggleSpan: (type: 'col' | 'row') => void;
  onAddText: (e: React.MouseEvent) => void;
  onAddShape: (type: 'arrow' | 'line' | 'rect' | 'circle', e: React.MouseEvent) => void;
  onCrop?: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const PanelControls: React.FC<PanelControlsProps> = ({
  spanCols, spanRows, hasCrop, onToggleSpan, onAddText, onAddShape, onCrop, onDelete
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowShapeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 p-2 bg-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 z-50 animate-reveal scale-100 hover:scale-105 transition-all origin-bottom no-export">

      {/* Span Controls Group */}
      <div className="flex items-center gap-2 pr-2 border-r border-white/20">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSpan('col'); }}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/10 hover:bg-indigo-600 text-white transition-all active:scale-95 group"
          title="调整宽度 (列跨度)"
        >
          <i className="fa-solid fa-arrows-left-right text-lg mb-1 group-hover:scale-110 transition-transform"></i>
          <span className="text-[8px] font-black leading-none">{spanCols}x</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSpan('row'); }}
          className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/10 hover:bg-indigo-600 text-white transition-all active:scale-95 group"
          title="调整高度 (行跨度)"
        >
          <i className="fa-solid fa-arrows-up-down text-lg mb-1 group-hover:scale-110 transition-transform"></i>
          <span className="text-[8px] font-black leading-none">{spanRows}x</span>
        </button>
      </div>

      {/* Drawing Tools Group */}
      <div className="flex items-center gap-1.5 px-2 border-r border-white/20 relative" ref={menuRef}>
        <button
          onMouseDown={onAddText}
          className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-all shadow-lg active:scale-95"
          title="添加文本标注"
        >
          <i className="fa-solid fa-font text-lg"></i>
        </button>

        {/* Shape Tools Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowShapeMenu(!showShapeMenu); }}
            className={`w-10 h-10 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 ${showShapeMenu ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white hover:bg-indigo-600'}`}
            title="插入几何图形"
          >
            <i className="fa-solid fa-shapes text-lg"></i>
            <i className={`fa-solid fa-caret-up text-[8px] transition-transform ${showShapeMenu ? 'rotate-180' : ''}`}></i>
          </button>

          {showShapeMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-32 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-1.5 animate-reveal z-[60] flex flex-col gap-1">
              <button
                onClick={(e) => { onAddShape('arrow', e); setShowShapeMenu(false); }}
                className="w-full py-2 px-3 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-white flex items-center gap-3 transition-colors text-left"
              >
                <i className="fa-solid fa-long-arrow-alt-right text-indigo-400 w-4 text-center"></i> 箭头
              </button>
              <button
                onClick={(e) => { onAddShape('line', e); setShowShapeMenu(false); }}
                className="w-full py-2 px-3 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-white flex items-center gap-3 transition-colors text-left"
              >
                <i className="fa-solid fa-slash text-indigo-400 w-4 text-center"></i> 线条
              </button>
              <button
                onClick={(e) => { onAddShape('rect', e); setShowShapeMenu(false); }}
                className="w-full py-2 px-3 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-white flex items-center gap-3 transition-colors text-left"
              >
                <i className="fa-regular fa-square text-indigo-400 w-4 text-center"></i> 矩形框
              </button>
              <button
                onClick={(e) => { onAddShape('circle', e); setShowShapeMenu(false); }}
                className="w-full py-2 px-3 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-white flex items-center gap-3 transition-colors text-left"
              >
                <i className="fa-regular fa-circle text-indigo-400 w-4 text-center"></i> 椭圆圈
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Crop Tool */}
      <div className="flex items-center gap-1.5 px-2 border-r border-white/20">
        <button
          onClick={(e) => { e.stopPropagation(); onCrop?.(e); }}
          className={`w-10 h-10 rounded-xl transition-all active:scale-95 flex items-center justify-center ${hasCrop ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-white/10 text-white hover:bg-indigo-600'}`}
          title={hasCrop ? '编辑裁剪（已裁剪）' : '裁剪图片'}
        >
          <i className="fa-solid fa-crop-simple text-base"></i>
        </button>
      </div>

      {/* Delete Group */}
      <div className="flex items-center pl-1">
        <button
          onMouseDown={onDelete}
          className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-all shadow-lg active:scale-95"
          title="移除图片"
        >
          <i className="fa-solid fa-trash-can text-lg"></i>
        </button>
      </div>
    </div>
  );
};
