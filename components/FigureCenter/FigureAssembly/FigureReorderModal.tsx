
import React, { useState, useRef } from 'react';
import { FigurePanel } from '../../../types';

interface FigureReorderModalProps {
  panels: FigurePanel[];
  onClose: () => void;
  onConfirm: (orderedPanels: FigurePanel[]) => void;
  layoutConfig: { rows: number; cols: number };
}

export const FigureReorderModal: React.FC<FigureReorderModalProps> = ({ 
  panels, onClose, onConfirm, layoutConfig 
}) => {
  const [items, setItems] = useState(panels);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position;
    e.preventDefault();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const copyListItems = [...items];
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const dragItemContent = copyListItems[dragItem.current];
      copyListItems.splice(dragItem.current, 1);
      copyListItems.splice(dragOverItem.current, 0, dragItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setItems(copyListItems);
    }
  };

  const previewItems = items.map((item, index) => ({
      ...item,
      previewLabel: String.fromCharCode(97 + (index % 26)) 
  }));

  const totalSlots = layoutConfig.rows * layoutConfig.cols;
  const emptySlots = Math.max(0, totalSlots - items.length);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[85vh]">
         <div className="flex justify-between items-center mb-6 shrink-0">
             <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <i className="fa-solid fa-arrow-down-short-wide text-xl"></i>
                 </div>
                 <div>
                     <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">智能排序与排版</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        DRAG TO REORDER • TARGET GRID: {layoutConfig.rows} × {layoutConfig.cols}
                     </p>
                 </div>
             </div>
             <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"><i className="fa-solid fa-times"></i></button>
         </div>

         <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 mb-4 text-[10px] text-indigo-800 font-bold flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-circle-info text-indigo-500"></i>
            拖拽图片卡片调整顺序。系统将按照当前序列 (a, b, c...) 依次填充至目标网格中。
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 border border-slate-200 rounded-[2rem] p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {previewItems.map((item, index) => (
                    <div 
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnter={(e) => handleDragEnter(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className="aspect-[4/3] bg-white rounded-2xl border-2 border-slate-200 shadow-sm relative overflow-hidden cursor-move hover:border-indigo-400 hover:shadow-lg transition-all group active:cursor-grabbing"
                    >
                        <img src={item.imgUrl} className="w-full h-full object-contain pointer-events-none p-1" alt="thumbnail" />
                        <div className="absolute top-0 left-0 bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-br-xl font-black text-xs font-sans shadow-md z-10">
                            {item.previewLabel}
                        </div>
                        <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <i className="fa-solid fa-arrows-up-down-left-right text-indigo-600 text-2xl drop-shadow-md"></i>
                        </div>
                    </div>
                ))}
                
                {Array.from({ length: emptySlots }).map((_, i) => (
                    <div key={`placeholder-${i}`} className="aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-100/50 opacity-60">
                        <span className="text-[10px] font-black text-slate-300 uppercase">Slot {items.length + i + 1}</span>
                    </div>
                ))}
            </div>
         </div>

         <div className="flex gap-4 mt-8 shrink-0">
             <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all">取消</button>
             <button onClick={() => onConfirm(items)} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                 <i className="fa-solid fa-check"></i> 确认并应用排版
             </button>
         </div>
      </div>
    </div>
  );
};
