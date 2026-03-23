import React, { useState, useEffect } from 'react';
import { Milestone } from '../../types';
import { AnimatePresence, motion } from 'framer-motion';

interface NodeTreeProps {
  milestones: Milestone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  foldedIds: Set<string>;
  onToggleFold: (id: string, e: React.MouseEvent) => void;
  onMove: (id: string, direction: 'up' | 'down', e: React.MouseEvent) => void;
  onBranch: (parentId: string, e: React.MouseEvent) => void;
  onEdit: (ms: Milestone, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  parentId?: string;
  depth?: number;
  indexPrefix?: string;
  onReorder?: (dragId: string, dropId: string) => void;
}

const NodeTree: React.FC<NodeTreeProps> = ({ 
  milestones = [], 
  selectedId, 
  onSelect, 
  foldedIds, 
  onToggleFold, 
  onMove, 
  onBranch, 
  onEdit, 
  onDelete,
  parentId = undefined, 
  depth = 0, 
  indexPrefix = '',
  onReorder
}) => {
  const nodes = (milestones || []).filter(m => m && m.parentId === parentId);
  const [deleteStages, setDeleteStages] = useState<Record<string, number>>({});

  // Reset delete stage after 4 seconds of inactivity
  useEffect(() => {
    const activeIds = Object.keys(deleteStages).filter(id => deleteStages[id] > 0);
    if (activeIds.length > 0) {
      const timer = setTimeout(() => {
        setDeleteStages({});
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [deleteStages]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('nodeId', id);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.getData('nodeId');
    if (dragId && dragId !== targetId && onReorder) {
        onReorder(dragId, targetId);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStage = deleteStages[id] || 0;
    if (currentStage < 2) {
      setDeleteStages(prev => ({ ...prev, [id]: currentStage + 1 }));
    } else {
      onDelete(id, e);
      setDeleteStages(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <>
      {nodes.map((ms, idx) => {
        const isSelected = selectedId === ms.id;
        const currentIndex = indexPrefix ? `${indexPrefix}.${idx + 1}` : `${idx + 1}`;
        const hasChildren = milestones.some(m => m && m.parentId === ms.id);
        const isFolded = foldedIds.has(ms.id);
        const currentDeleteStage = deleteStages[ms.id] || 0;

        return (
          <div key={ms.id} className="flex flex-col relative mb-2 last:mb-0">
            {/* Vertical line connecting sibling nodes */}
            {idx < nodes.length - 1 && (
                <div 
                    className="absolute border-l-2 border-indigo-200 z-0" 
                    style={{ 
                        left: `${depth * 0.8 + 0.8}rem`, 
                        top: '1.2rem', 
                        bottom: '-1.8rem' 
                    }}
                ></div>
            )}

            {/* Indentation indicators for children */}
            {depth > 0 && (
                <div 
                    className="absolute border-l-2 border-indigo-100/50" 
                    style={{ 
                        left: `${depth * 0.8 - 0.4}rem`, 
                        top: '-0.75rem', 
                        bottom: '1.4rem' 
                    }}
                ></div>
            )}
            {depth > 0 && (
                <div 
                    className="absolute border-t-2 border-indigo-100/50" 
                    style={{ 
                        left: `${depth * 0.8 - 0.4}rem`, 
                        top: '1.4rem', 
                        width: '1rem' 
                    }}
                ></div>
            )}
            
            <div 
              draggable
              onDragStart={(e) => handleDragStart(e, ms.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, ms.id)}
              onClick={() => onSelect(ms.id)} 
              className={`group flex items-center gap-0.5 p-3.5 rounded-xl border-2 transition-all cursor-pointer relative z-10 ${
                isSelected 
                    ? 'bg-indigo-950 border-indigo-950 text-white shadow-xl scale-[1.01]' 
                    : 'bg-white/95 border-slate-100 hover:border-indigo-300 text-slate-700 shadow-md hover:shadow-lg'
              }`} 
              style={{ marginLeft: `${depth * 0.8}rem`, maxWidth: '100%' }}
            >
              <div className="flex-1 min-w-0 flex items-center gap-0.5">
                <span className={`text-[11px] font-black font-mono w-5 h-5 shrink-0 flex items-center justify-center rounded-lg relative z-20 ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-indigo-500 opacity-80'}`}>
                    {currentIndex}
                </span>
                {hasChildren ? (
                  <button 
                    onClick={(e) => onToggleFold(ms.id, e)} 
                    className={`w-3 h-5 flex items-center justify-center rounded-lg hover:bg-black/10 shrink-0 transition-transform ${isSelected ? 'text-white' : 'text-slate-400'}`}
                  >
                    <i className={`fa-solid ${isFolded ? 'fa-caret-right' : 'fa-caret-down'} text-[10px]`}></i>
                  </button>
                ) : (
                  <div className="w-3" />
                )}
                
                <span className={`w-2 h-2 rounded-full shrink-0 shadow-sm mx-0.5 ${ms.status === 'completed' ? 'bg-emerald-400' : ms.status === 'branched' ? 'bg-amber-400' : ms.status === 'in-progress' ? 'bg-indigo-400' : 'bg-slate-300'}`}></span>
                
                <h4 className={`text-[13px] font-black uppercase tracking-tight flex-1 leading-snug text-left truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                   {ms.title}
                </h4>
              </div>

              <div className={`flex gap-1 transition-all shrink-0 ${currentDeleteStage > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {currentDeleteStage === 0 && (
                  <>
                    <button onClick={(e) => onBranch(ms.id, e)} className="w-7 h-7 rounded-xl bg-white/90 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-md border border-slate-200" title="拉取分支"><i className="fa-solid fa-code-branch text-[10px]"></i></button>
                    <button onClick={(e) => onEdit(ms, e)} className="w-7 h-7 rounded-xl bg-white/90 text-indigo-400 flex items-center justify-center hover:bg-indigo-50 hover:text-white transition-all shadow-md border border-slate-200" title="编辑"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                  </>
                )}
                
                <AnimatePresence mode="wait">
                  {currentDeleteStage === 0 ? (
                    <motion.button 
                      key="delete-start"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      onClick={(e) => handleDeleteClick(ms.id, e)} 
                      className="w-7 h-7 rounded-xl bg-white/90 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-md border border-slate-200" 
                      title="删除"
                    >
                      <i className="fa-solid fa-trash-can text-[10px]"></i>
                    </motion.button>
                  ) : currentDeleteStage === 1 ? (
                    <motion.button 
                      key="delete-confirm-1"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      onClick={(e) => handleDeleteClick(ms.id, e)} 
                      className="h-7 px-2 rounded-xl bg-amber-500 text-white flex items-center justify-center gap-1.5 transition-all shadow-lg border border-amber-400 text-[9px] font-black uppercase"
                    >
                      <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
                      确认?
                    </motion.button>
                  ) : (
                    <motion.button 
                      key="delete-confirm-2"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1, x: [0, -2, 2, -2, 2, 0] }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      onClick={(e) => handleDeleteClick(ms.id, e)} 
                      className="h-7 px-2 rounded-xl bg-rose-600 text-white flex items-center justify-center gap-1.5 transition-all shadow-lg border border-rose-500 text-[9px] font-black uppercase animate-pulse"
                    >
                      <i className="fa-solid fa-radiation text-[10px]"></i>
                      彻底删除
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {!isFolded && (
              <div className="flex flex-col mt-2">
                <NodeTree 
                  milestones={milestones}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  foldedIds={foldedIds}
                  onToggleFold={onToggleFold}
                  onMove={onMove}
                  onBranch={onBranch}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  parentId={ms.id}
                  depth={depth + 1}
                  indexPrefix={currentIndex}
                  onReorder={onReorder}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default NodeTree;