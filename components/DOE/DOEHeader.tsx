import React, { useState, useMemo } from 'react';
import { SavedDOE } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';

interface DOEHeaderProps {
  savedResults: SavedDOE[];
  showArchiveDropdown: boolean;
  setShowArchiveDropdown: (show: boolean) => void;
  loadArchive: (archive: SavedDOE) => void;
  handleDeleteArchive: (id: string, e: React.MouseEvent) => void;
  handleRenameArchive: (id: string, newTitle: string) => void;
  setIntensityMode: (mode: 'screening' | 'standard' | 'ai_inspired') => void;
  setShowOEDModal: (show: boolean) => void;
  setShowConfigModal: (show: boolean) => void;
  handleReset: () => void;
  onSaveTrigger: () => void;
  isSaveDisabled: boolean;
  onLoadPreset?: () => void;
}

export const DOEHeader: React.FC<DOEHeaderProps> = ({
  savedResults,
  showArchiveDropdown,
  setShowArchiveDropdown,
  loadArchive,
  handleDeleteArchive,
  handleRenameArchive,
  setIntensityMode,
  setShowOEDModal,
  setShowConfigModal,
  handleReset,
  onSaveTrigger,
  isSaveDisabled,
  onLoadPreset
}) => {
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const { returnPath, setReturnPath } = useProjectContext();

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleReturn = () => {
    if (returnPath) {
      const path = returnPath;
      setReturnPath(null);
      if (path.startsWith('#')) {
        window.location.hash = path;
      } else {
        window.location.hash = `#${path}`;
      }
    }
  };

  const returnLabel = useMemo(() => {
    if (!returnPath) return '返回课题';
    if (returnPath.includes('plan_board')) return '返回项目计划';
    if (returnPath.includes('plan')) return '返回实验矩阵';
    if (returnPath.includes('project/')) return '返回课题详情';
    return '返回课题中心';
  }, [returnPath]);

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center shrink-0 p-5 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 mb-2 gap-4 shadow-2xl relative z-[200]">
      <div className="flex items-center gap-4 shrink-0">
        {returnPath && (
          <button
            onClick={handleReturn}
            className="px-6 py-3 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase hover:bg-black transition-all flex items-center gap-3 shadow-lg shadow-amber-200/50 animate-bounce-subtle shrink-0 border-2 border-white/20"
          >
            <i className="fa-solid fa-arrow-left-long text-base"></i> {returnLabel}
          </button>
        )}
        <h2 className="text-2xl font-black text-white tracking-tighter italic uppercase shrink-0 border-l-4 border-indigo-500 pl-4 leading-none">DOE智能实验迭代中心</h2>
        {onLoadPreset && (
          <button
            onClick={onLoadPreset}
            className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-lg flex items-center gap-2"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-[11px]"></i> 演示案例
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 ml-auto">
        <div className="relative z-[100]">
          <button onClick={(e) => { e.stopPropagation(); setShowArchiveDropdown(!showArchiveDropdown); }} className="px-5 py-2.5 bg-white/10 text-slate-100 border border-white/10 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 transition-all active:scale-95 shadow-xl flex items-center gap-2">
            <i className="fa-solid fa-box-archive text-[11px]"></i> 推演档案库 ({savedResults.length})
          </button>
          {showArchiveDropdown && (
            <div className="absolute top-full right-0 mt-3 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1 overflow-hidden animate-reveal z-[210]">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">存档历史清单</h4>
                <span className="text-[9px] font-black text-slate-300 uppercase">{savedResults.length} 份</span>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {(() => {
                  // 按课题+节点分组
                  const groups: { key: string; projectTitle: string; milestoneTitle: string; items: typeof savedResults }[] = [];
                  const groupMap = new Map<string, typeof groups[0]>();

                  savedResults.forEach(res => {
                    const gKey = `${res.projectId || '_none_'}::${res.milestoneId || '_none_'}`;
                    if (!groupMap.has(gKey)) {
                      const group = {
                        key: gKey,
                        projectTitle: res.projectTitle || '',
                        milestoneTitle: res.milestoneTitle || '',
                        items: [] as typeof savedResults
                      };
                      groupMap.set(gKey, group);
                      groups.push(group);
                    }
                    groupMap.get(gKey)!.items.push(res);
                  });

                  // 把有课题的排前面，未分类的排最后
                  groups.sort((a, b) => {
                    if (a.projectTitle && !b.projectTitle) return -1;
                    if (!a.projectTitle && b.projectTitle) return 1;
                    return 0;
                  });

                  if (savedResults.length === 0) {
                    return <p className="p-10 text-center text-[11px] font-black text-slate-400 italic uppercase">档案库暂无数据</p>;
                  }

                  return groups.map(group => {
                    const isExpanded = expandedGroups.has(group.key);
                    return (
                      <div key={group.key} className="mb-1">
                        <div
                          onClick={() => toggleGroup(group.key)}
                          className="px-4 pt-3 pb-1.5 flex items-center gap-2 sticky top-0 bg-white/95 backdrop-blur-sm z-10 cursor-pointer hover:bg-slate-50 rounded-xl transition-all select-none"
                        >
                          <i className={`fa-solid fa-chevron-right text-[8px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}></i>
                          {group.projectTitle ? (
                            <>
                              <i className="fa-solid fa-bookmark text-[8px] text-indigo-500"></i>
                              <span className="text-[9px] font-black text-indigo-600 uppercase truncate max-w-[120px]">{group.projectTitle}</span>
                              {group.milestoneTitle && (
                                <>
                                  <i className="fa-solid fa-chevron-right text-[6px] text-slate-300"></i>
                                  <span className="text-[9px] font-black text-amber-600 uppercase truncate max-w-[100px]">{group.milestoneTitle}</span>
                                </>
                              )}
                              {!group.milestoneTitle && (
                                <span className="text-[8px] font-bold text-slate-300 italic">未指定节点</span>
                              )}
                            </>
                          ) : (
                            <>
                              <i className="fa-solid fa-folder-open text-[8px] text-slate-300"></i>
                              <span className="text-[9px] font-black text-slate-400 uppercase italic">未分类</span>
                            </>
                          )}
                          <span className="text-[8px] font-bold text-slate-300 ml-auto">({group.items.length})</span>
                        </div>
                        {isExpanded && group.items.map(res => (
                          <div key={res.id} onClick={() => { if (editingId !== res.id) loadArchive(res); }} className="px-4 py-3 hover:bg-indigo-50 rounded-2xl transition-all cursor-pointer group/item flex justify-between items-center border-b border-slate-50 last:border-0 mx-1 animate-reveal">
                            <div className="min-w-0 flex-1 pr-2">
                              {editingId === res.id ? (
                                <input
                                  autoFocus
                                  className="w-full text-[11px] font-black text-slate-800 uppercase bg-white border border-indigo-300 rounded-lg px-2 py-1 outline-none shadow-inner"
                                  value={editingTitle}
                                  onChange={e => setEditingTitle(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { handleRenameArchive(res.id, editingTitle); setEditingId(null); }
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  onBlur={() => { handleRenameArchive(res.id, editingTitle); setEditingId(null); }}
                                />
                              ) : (
                                <p
                                  className="text-[11px] font-black text-slate-800 truncate uppercase"
                                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(res.id); setEditingTitle(res.title); }}
                                  title="双击编辑名称"
                                >{res.title}</p>
                              )}
                              <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{res.timestamp}</p>
                            </div>
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover/item:opacity-100 transition-all">
                              <button onClick={(e) => { e.stopPropagation(); setEditingId(res.id); setEditingTitle(res.title); }} className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-sm hover:bg-indigo-100 transition-all" title="重命名">
                                <i className="fa-solid fa-pen text-[9px]"></i>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteArchive(res.id, e); }} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm hover:bg-rose-100 transition-all" title="删除">
                                <i className="fa-solid fa-trash-can text-[9px]"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        <div className="relative z-[100]">
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95 border border-emerald-500/50"
          >
            <i className="fa-solid fa-vial text-[11px]"></i> 正交设计 <i className={`fa-solid fa-chevron-down text-[10px] ml-1 transition-transform ${showModeMenu ? 'rotate-180' : ''}`}></i>
          </button>
          {showModeMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1 overflow-hidden animate-reveal z-[220]">
              <div className="p-2 border-b border-slate-100 bg-slate-50">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">选择实验模式</span>
              </div>
              <button onClick={() => { setIntensityMode('screening'); setShowOEDModal(true); setShowModeMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl transition-all flex items-center gap-2 group">
                <i className="fa-solid fa-filter text-emerald-500"></i>
                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-emerald-600">快速摸底 (L4)</span>
              </button>
              <button onClick={() => { setIntensityMode('standard'); setShowOEDModal(true); setShowModeMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 group">
                <i className="fa-solid fa-table-cells text-indigo-500"></i>
                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-indigo-600">标准研发 (L9)</span>
              </button>
              <button onClick={() => { setIntensityMode('ai_inspired'); setShowOEDModal(true); setShowModeMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-xl transition-all flex items-center gap-2 group">
                <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-amber-600">AI 启发式 (Hybrid)</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onSaveTrigger}
          disabled={isSaveDisabled}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-amber-600 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale"
        >
          <i className="fa-solid fa-floppy-disk text-[11px]"></i> 保存推演
        </button>

        <button onClick={() => setShowConfigModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
          <i className="fa-solid fa-sliders text-[11px]"></i> 配置变量
        </button>

        <button onClick={handleReset} className="w-10 h-10 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95" title="重置工作区">
          <i className="fa-solid fa-rotate-right text-[12px]"></i>
        </button>
      </div>
      <style>{`
        @keyframes bounce-subtle {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-8px); }
        }
        .animate-bounce-subtle { animation: bounce-subtle 1.5s ease-in-out infinite; }
      `}</style>
    </header>
  );
};
