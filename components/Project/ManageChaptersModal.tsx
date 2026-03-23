

import React, { useState, useEffect } from 'react';
import { Milestone, MilestoneStatus } from '../../types';

interface ManageChaptersModalProps {
  show: boolean;
  onClose: () => void;
  milestones: Milestone[];
  onSave: (updatedMilestones: Milestone[]) => void;
}

const ManageChaptersModal: React.FC<ManageChaptersModalProps> = ({ show, onClose, milestones, onSave }) => {
  const [localNodes, setLocalNodes] = useState<Milestone[]>([]);

  useEffect(() => {
    if (show) {
      // Create a deep copy to avoid direct mutation
      setLocalNodes(JSON.parse(JSON.stringify(milestones)));
    }
  }, [show, milestones]);

  if (!show) return null;

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setLocalNodes(prev => prev.map(n => n.id === id ? { ...n, title: newTitle } : n));
  };

  const handleUpdateProp = (id: string, field: keyof Milestone, value: any) => {
    setLocalNodes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
  };

  const handleDelete = (id: string) => {
    setLocalNodes(prev => prev.filter(n => n.id !== id));
  };

  const handleAddNode = () => {
    const newNode: Milestone = {
      id: Date.now().toString(),
      title: '新研究章节',
      hypothesis: '未设定假设',
      status: 'pending' as MilestoneStatus,
      dueDate: new Date().toISOString().split('T')[0],
      logs: [],
      chatHistory: [],
      experimentalPlan: [],
      savedDocuments: [],
      fontSize: 12,
      sectionType: 'Standard',
      fontFamilyEn: 'Times New Roman',
      fontFamilyZh: 'SimSun'
    };
    setLocalNodes(prev => [...prev, newNode]);
  };

  const handleConfirm = () => {
    onSave(localNodes);
    onClose();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const next = [...localNodes];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setLocalNodes(next);
  };

  const handleApplyToAll = (sourceId: string) => {
      const source = localNodes.find(n => n.id === sourceId);
      if (!source) return;
      
      const { fontSize, fontFamilyEn, fontFamilyZh } = source;
      
      setLocalNodes(prev => prev.map(n => ({
          ...n,
          fontSize: fontSize || 12,
          fontFamilyEn: fontFamilyEn || 'Times New Roman',
          fontFamilyZh: fontFamilyZh || 'SimSun'
      })));
      alert("已将当前字体样式应用到所有章节");
  };

  const enFonts = [
      { name: 'Times New Roman', value: 'Times New Roman' },
      { name: 'Arial', value: 'Arial' },
      { name: 'Calibri', value: 'Calibri' },
      { name: 'Helvetica', value: 'Helvetica' }
  ];

  const zhFonts = [
      { name: '宋体 (SimSun)', value: 'SimSun' },
      { name: '黑体 (SimHei)', value: 'SimHei' },
      { name: '楷体 (KaiTi)', value: 'KaiTi' },
      { name: '仿宋 (FangSong)', value: 'FangSong' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-2xl rounded-[3rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all active:scale-90">
          <i className="fa-solid fa-times text-2xl"></i>
        </button>
        
        <header className="mb-8 shrink-0">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">
            文档章节管理
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-8">管理、重命名、排序及增删学术章节</p>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col border-2 border-dashed border-indigo-200 rounded-[2.5rem] p-6 bg-slate-50/50 mb-6">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {localNodes.map((node, index) => (
              <div 
                key={node.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                className="flex flex-col gap-2 p-3 bg-white rounded-2xl border border-slate-100 group hover:border-indigo-300 transition-all cursor-move shadow-sm"
              >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-300 flex items-center justify-center text-[11px] font-black shrink-0 shadow-sm group-hover:text-indigo-400 transition-colors">
                        <i className="fa-solid fa-grip-vertical"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <input 
                            className="w-full bg-transparent border-none text-sm font-bold text-slate-800 outline-none focus:bg-slate-50 rounded px-2 py-1 transition-all"
                            value={node.title}
                            onChange={(e) => handleUpdateTitle(node.id, e.target.value)}
                            placeholder="章节名称..."
                        />
                    </div>
                    <button 
                        onClick={() => handleDelete(node.id)}
                        className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-90 shrink-0"
                        title="删除章节"
                    >
                        <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
                
                <div className="flex flex-wrap gap-2 pl-11 pr-2 items-center">
                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm min-w-[80px]">
                        <i className="fa-solid fa-text-height text-slate-400 text-[9px]"></i>
                        <input 
                           type="number" 
                           className="w-8 bg-transparent text-[9px] font-bold text-slate-600 outline-none text-center"
                           value={node.fontSize || 12}
                           onChange={(e) => handleUpdateProp(node.id, 'fontSize', parseInt(e.target.value) || 12)}
                           placeholder="12"
                        />
                        <span className="text-[8px] text-slate-400 font-bold">px</span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm flex-1 min-w-[100px]">
                        <span className="text-[8px] text-indigo-400 font-bold uppercase">En</span>
                        <select 
                            className="w-full bg-transparent text-[9px] font-bold text-slate-600 outline-none appearance-none cursor-pointer"
                            value={node.fontFamilyEn || 'Times New Roman'}
                            onChange={(e) => handleUpdateProp(node.id, 'fontFamilyEn', e.target.value)}
                        >
                            {enFonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                        </select>
                     </div>

                     <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm flex-1 min-w-[100px]">
                        <span className="text-[8px] text-emerald-500 font-bold uppercase">中</span>
                        <select 
                            className="w-full bg-transparent text-[9px] font-bold text-slate-600 outline-none appearance-none cursor-pointer"
                            value={node.fontFamilyZh || 'SimSun'}
                            onChange={(e) => handleUpdateProp(node.id, 'fontFamilyZh', e.target.value)}
                        >
                            {zhFonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                        </select>
                     </div>

                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm min-w-[100px]">
                        <i className="fa-solid fa-tag text-slate-400 text-[10px]"></i>
                        <select 
                            className="w-full bg-transparent text-[10px] font-bold text-slate-600 outline-none appearance-none cursor-pointer"
                            value={node.sectionType || 'Standard'}
                            onChange={(e) => handleUpdateProp(node.id, 'sectionType', e.target.value)}
                        >
                            <option value="Standard">Standard (正文)</option>
                            <option value="Appendix">Appendix (附录)</option>
                            <option value="Supplementary">Supplementary (补充)</option>
                        </select>
                    </div>
                    
                    <button 
                        onClick={() => handleApplyToAll(node.id)}
                        className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all shadow-sm ml-auto"
                        title="将此字体设置一键应用到其他章节"
                     >
                        <i className="fa-solid fa-clone text-[10px]"></i>
                     </button>
                </div>
              </div>
            ))}
            
            {localNodes.length === 0 && (
              <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
                <i className="fa-solid fa-list-ul text-4xl"></i>
                <p className="text-xs font-black uppercase tracking-widest">暂无章节数据</p>
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 flex gap-4 border-t border-slate-100 pt-6">
          <button 
            onClick={handleAddNode}
            className="flex-1 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-[11px] uppercase transition-all hover:bg-indigo-50 active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> 新增章节
          </button>
          <button 
            onClick={handleConfirm}
            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-indigo-100 transition-all hover:bg-black active:scale-95"
          >
            确认并应用章节变更
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ManageChaptersModal;
