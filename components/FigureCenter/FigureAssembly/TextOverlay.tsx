
import React, { useState, useEffect } from 'react';
import { FigureText } from '../../../types';

interface TextOverlayProps {
  text: FigureText;
  panelId: string;
  isSelected: boolean;
  isEditing: boolean;
  scale: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onUpdate: (updates: Partial<FigureText>, isBatch?: boolean) => void;
  onDelete: () => void;
  FONT_FAMILIES: { name: string, value: string }[];
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text, panelId, isSelected, isEditing, scale,
  onMouseDown, onDoubleClick, onUpdate, onDelete, FONT_FAMILIES
}) => {
  const [isBatch, setIsBatch] = useState(false);
  const [localFontSize, setLocalFontSize] = useState<string | number>(text.fontSize);

  useEffect(() => {
    setLocalFontSize(text.fontSize);
  }, [text.fontSize]);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalFontSize(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onUpdate({ fontSize: parsed }, isBatch);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (document.activeElement === e.currentTarget) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        onUpdate({ fontSize: Math.round(text.fontSize + delta) }, isBatch);
    }
  };

  return (
    <div
        style={{ 
            left: text.x, top: text.y, 
            position: 'absolute', 
            zIndex: isSelected || isEditing ? 60 : 20,
            cursor: isEditing ? 'text' : 'move' 
        }}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className={`group/text ${isSelected && !isEditing ? 'ring-2 ring-indigo-500 ring-dashed rounded-lg p-1' : ''}`}
    >
        {/* Beautified Editing Toolbar */}
        {isSelected && !isEditing && (
            <div 
                className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/20 flex items-center gap-1.5 p-1.5 z-50 whitespace-nowrap animate-reveal origin-bottom"
                onMouseDown={(e) => e.stopPropagation()} 
                onDoubleClick={(e) => e.stopPropagation()} // 关键修复：防止工具栏点击触发文本编辑模式
            >
                {/* Batch Toggle */}
                <div className="flex flex-col items-center px-1">
                    <button 
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isBatch ? 'bg-amber-50 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'text-slate-400 hover:bg-white/20 hover:text-white'}`}
                        onClick={() => setIsBatch(!isBatch)}
                        title={isBatch ? "已开启联动：修改将应用到所有文本" : "开启联动：批量修改同类元素"}
                    >
                        <i className="fa-solid fa-link text-[10px]"></i>
                    </button>
                    <span className="text-[5px] font-black text-indigo-400 uppercase tracking-tighter mt-0.5 opacity-60">默认设定</span>
                </div>
                
                <div className="w-px h-8 bg-white/20 mx-1"></div>

                {/* Font Size Selector with Editable Input */}
                <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/5 overflow-hidden">
                    <button 
                      onClick={() => onUpdate({ fontSize: Math.round(Math.max(8, text.fontSize - 1)) }, isBatch)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white hover:text-indigo-600 rounded transition-colors text-slate-400"
                    >
                        <i className="fa-solid fa-minus text-[8px]"></i>
                    </button>
                    <input 
                      type="number"
                      step="1"
                      className="w-10 bg-transparent border-none outline-none text-white font-black text-[10px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={localFontSize === 0 ? '' : localFontSize}
                      onChange={handleFontSizeChange}
                      onWheel={handleWheel}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button 
                      onClick={() => onUpdate({ fontSize: Math.round(Math.min(200, text.fontSize + 1)) }, isBatch)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white hover:text-indigo-600 rounded transition-colors text-slate-400"
                    >
                        <i className="fa-solid fa-plus text-[8px]"></i>
                    </button>
                </div>
                
                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/20 cursor-pointer hover:scale-110 transition-transform">
                    <input 
                        type="color" 
                        className="absolute -top-2 -left-2 w-12 h-12 p-0 border-none cursor-pointer"
                        value={text.color}
                        onChange={(e) => onUpdate({ color: e.target.value }, isBatch)}
                        title="文字颜色"
                    />
                </div>

                <div className="w-px h-8 bg-white/20 mx-1"></div>

                <select 
                    className="bg-white/10 text-white rounded-lg px-2 py-1 text-[10px] font-bold outline-none border border-white/10 cursor-pointer max-w-[80px]"
                    value={text.fontFamily}
                    onChange={(e) => onUpdate({ fontFamily: e.target.value }, isBatch)}
                >
                    {FONT_FAMILIES.map(f => <option key={f.name} value={f.value} className="bg-slate-900">{f.name}</option>)}
                </select>

                <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/5">
                    <button 
                        onClick={() => onUpdate({ fontWeight: text.fontWeight === 'bold' ? 'normal' : 'bold' }, isBatch)}
                        className={`w-7 h-7 flex items-center justify-center rounded transition-all ${text.fontWeight === 'bold' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        title="加粗"
                    >
                        <i className="fa-solid fa-bold text-[10px]"></i>
                    </button>
                    <button 
                        onClick={() => onUpdate({ fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' }, isBatch)}
                        className={`w-7 h-7 flex items-center justify-center rounded transition-all ${text.fontStyle === 'italic' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        title="斜体"
                    >
                        <i className="fa-solid fa-italic text-[10px]"></i>
                    </button>
                </div>

                <div className="w-px h-8 bg-white/20 mx-1"></div>

                <button 
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
            </div>
        )}

        {isEditing ? (
            <textarea
                autoFocus
                className="bg-white border-2 border-indigo-500 rounded p-1 outline-none font-bold shadow-2xl min-w-[120px]"
                style={{ 
                    fontSize: text.fontSize, 
                    color: text.color, 
                    fontWeight: text.fontWeight as any, 
                    fontStyle: text.fontStyle, 
                    fontFamily: text.fontFamily,
                    lineHeight: 1
                }}
                value={text.content}
                onChange={(e) => onUpdate({ content: e.target.value })}
                onBlur={(e) => onUpdate({ content: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && e.currentTarget.blur()}
            />
        ) : (
            <span 
                className="select-none transition-opacity hover:opacity-80 block whitespace-nowrap"
                style={{ 
                    fontSize: text.fontSize, 
                    color: text.color, 
                    fontWeight: text.fontWeight as any, 
                    fontStyle: text.fontStyle, 
                    fontFamily: text.fontFamily,
                    lineHeight: 1
                }}
            >
                {text.content}
            </span>
        )}
    </div>
  );
};
