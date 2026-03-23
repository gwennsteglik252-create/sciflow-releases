
import React, { useState, useCallback } from 'react';

export interface CollectedPlanItem {
  id: string;
  source: 'route' | 'report' | 'log';
  sourceLabel: string;
  task: string;
  addedAt: number;
}

interface PlanCollectorModalProps {
  items: CollectedPlanItem[];
  onClose: () => void;
  onUpdateItems: (items: CollectedPlanItem[]) => void;
  onSubmitAll: (tasks: string[]) => void;
  isGenerating?: boolean;
}

const SOURCE_CONFIG = {
  route: { icon: 'fa-route', label: '实验路线', color: 'indigo', gradient: 'from-indigo-500 to-blue-500' },
  report: { icon: 'fa-file-lines', label: '归档报告', color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
  log: { icon: 'fa-flask-vial', label: '实验记录', color: 'violet', gradient: 'from-violet-500 to-purple-500' },
};

const PlanCollectorModal: React.FC<PlanCollectorModalProps> = ({
  items, onClose, onUpdateItems, onSubmitAll, isGenerating = false
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState('');

  const handleDelete = useCallback((id: string) => {
    onUpdateItems(items.filter(item => item.id !== id));
  }, [items, onUpdateItems]);

  const handleStartEdit = useCallback((item: CollectedPlanItem) => {
    setEditingId(item.id);
    setEditText(item.task);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !editText.trim()) return;
    onUpdateItems(items.map(item => item.id === editingId ? { ...item, task: editText.trim() } : item));
    setEditingId(null);
    setEditText('');
  }, [editingId, editText, items, onUpdateItems]);

  const handleAddCustom = useCallback(() => {
    if (!newTask.trim()) return;
    const newItem: CollectedPlanItem = {
      id: `custom_${Date.now()}`,
      source: 'route',
      sourceLabel: '手动添加',
      task: newTask.trim(),
      addedAt: Date.now(),
    };
    onUpdateItems([...items, newItem]);
    setNewTask('');
    setShowAddForm(false);
  }, [newTask, items, onUpdateItems]);

  const handleSubmit = useCallback(() => {
    if (items.length === 0) return;
    onSubmitAll(items.map(item => item.task));
  }, [items, onSubmitAll]);

  // 按来源分组
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.source]) acc[item.source] = [];
    acc[item.source].push(item);
    return acc;
  }, {} as Record<string, CollectedPlanItem[]>);

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2200] flex items-center justify-center p-4 lg:p-10">
      <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] animate-reveal flex flex-col max-h-[90vh] overflow-hidden border-4 border-white/20">
        
        {/* Header */}
        <header className="px-10 py-7 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-white/10">
                <i className="fa-solid fa-basket-shopping text-white text-xl"></i>
              </div>
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">实验计划收集篮</h3>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3rem] mt-1">
                  Plan Collector — {items.length} 项待生成
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="h-10 px-5 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all flex items-center gap-2 border border-white/10"
              >
                <i className="fa-solid fa-plus"></i> 手动添加
              </button>
              <button
                onClick={onClose}
                className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-rose-500 transition-all text-white/80"
              >
                <i className="fa-solid fa-times text-xl"></i>
              </button>
            </div>
          </div>
          
          {/* 来源统计 */}
          <div className="flex gap-3 mt-5">
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => {
              const count = groupedItems[key]?.length || 0;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                    count > 0
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/5 border-white/5 text-white/30'
                  }`}
                >
                  <i className={`fa-solid ${cfg.icon} text-[10px]`}></i>
                  <span className="text-[10px] font-black uppercase">{cfg.label}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    count > 0 ? `bg-gradient-to-r ${cfg.gradient} text-white` : 'bg-white/10 text-white/40'
                  }`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50">
          {/* 手动添加表单 */}
          {showAddForm && (
            <div className="mb-6 p-5 bg-white rounded-2xl border-2 border-dashed border-indigo-200 animate-reveal">
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-pen-to-square text-indigo-500 text-sm"></i>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">手动添加实验任务</span>
              </div>
              <textarea
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-[12px] font-medium text-slate-700 outline-none resize-none min-h-[80px] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="描述你想要生成的实验任务..."
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAddCustom(); }}
              />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setShowAddForm(false); setNewTask(''); }} className="px-5 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                <button onClick={handleAddCustom} disabled={!newTask.trim()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg disabled:opacity-30 hover:bg-black transition-all">添加</button>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <i className="fa-solid fa-basket-shopping text-6xl text-slate-300 mb-6"></i>
              <p className="text-sm font-black uppercase tracking-[0.3rem] text-slate-400">收集篮为空</p>
              <p className="text-[11px] text-slate-400 mt-2">从实验路线、归档报告或实验记录中添加任务</p>
            </div>
          )}

          {/* 分组显示 */}
          {Object.entries(groupedItems).map(([sourceKey, sourceItems]) => {
            const cfg = SOURCE_CONFIG[sourceKey as keyof typeof SOURCE_CONFIG];
            if (!cfg) return null;
            return (
              <div key={sourceKey} className="mb-6">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-6 h-6 bg-gradient-to-br ${cfg.gradient} rounded-lg flex items-center justify-center shadow-sm`}>
                    <i className={`fa-solid ${cfg.icon} text-white text-[9px]`}></i>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{cfg.label}</span>
                  <span className="text-[10px] font-black text-slate-300">({sourceItems.length})</span>
                </div>
                <div className="space-y-2">
                  {sourceItems.map(item => (
                    <div
                      key={item.id}
                      className={`bg-white rounded-xl border transition-all group hover:shadow-md ${
                        editingId === item.id ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'
                      }`}
                    >
                      {editingId === item.id ? (
                        <div className="p-4">
                          <textarea
                            autoFocus
                            className="w-full bg-slate-50 border border-indigo-200 rounded-lg p-3 text-[11px] font-medium text-slate-700 outline-none resize-none min-h-[60px] focus:border-indigo-400 transition-all"
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button onClick={() => setEditingId(null)} className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase">取消</button>
                            <button onClick={handleSaveEdit} className="px-5 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md">保存</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[8px] font-black text-slate-300 uppercase">{item.sourceLabel}</span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-3">{item.task}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-all"
                              title="编辑"
                            >
                              <i className="fa-solid fa-pen text-[9px]"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all"
                              title="删除"
                            >
                              <i className="fa-solid fa-trash-can text-[9px]"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="px-10 py-6 bg-white border-t border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onUpdateItems([])}
                disabled={items.length === 0}
                className="px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all disabled:opacity-30"
              >
                <i className="fa-solid fa-trash-can mr-2"></i>清空全部
              </button>
              <span className="text-[10px] font-black text-slate-300 uppercase">
                共 {items.length} 项任务
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={items.length === 0 || isGenerating}
              className="h-12 px-10 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-30 flex items-center gap-3 border border-indigo-500/50"
            >
              {isGenerating ? (
                <><i className="fa-solid fa-spinner animate-spin"></i> AI 生成中...</>
              ) : (
                <><i className="fa-solid fa-rocket"></i> 统一生成实验计划</>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PlanCollectorModal;
