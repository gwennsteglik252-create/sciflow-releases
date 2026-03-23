import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { WorkspaceState } from '../../types/workspace';

interface ProjectExplorerProps {
  workspace: WorkspaceState;
  onSelect: (id: string) => void;
  onAddWorkbook: () => void;
  onAddGraph: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  workspace, onSelect, onAddWorkbook, onAddGraph, onRemove, onRename,
  collapsed, onToggleCollapse,
}) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  const handleRename = (id: string, name: string) => {
    setRenaming(id);
    setRenameValue(name);
  };

  const confirmRename = () => {
    if (renaming && renameValue.trim()) {
      onRename(renaming, renameValue.trim());
    }
    setRenaming(null);
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  };

  React.useEffect(() => {
    if (contextMenu) {
      const close = () => setContextMenu(null);
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [contextMenu]);

  if (collapsed) {
    return (
      <div className="w-10 bg-white/80 backdrop-blur-sm border-r border-slate-200 flex flex-col items-center py-3 gap-2 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-all"
          title="展开项目导航"
        >
          <i className="fa-solid fa-chevron-right text-[9px]" />
        </button>
        <div className="w-5 h-px bg-slate-200 my-1" />
        <button
          onClick={onAddWorkbook}
          title="新建工作表"
          className="w-7 h-7 rounded-lg bg-blue-50 text-blue-400 hover:bg-blue-100 hover:text-blue-600 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-table text-[9px]" />
        </button>
        <button
          onClick={onAddGraph}
          title="新建图表"
          className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-chart-line text-[9px]" />
        </button>
      </div>
    );
  }

  const renderItem = (id: string, name: string, icon: string, activeColor: string, activeBg: string, activeBorder: string, isActive: boolean) => (
    <div
      key={id}
      onClick={() => onSelect(id)}
      onDoubleClick={() => handleRename(id, name)}
      onContextMenu={e => handleContextMenu(e, id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
        isActive
          ? `${activeBg} ${activeColor} ring-1 ${activeBorder} shadow-sm`
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      <i className={`${icon} text-[10px] shrink-0 ${isActive ? activeColor : 'text-slate-400'}`} />
      {renaming === id ? (
        <input
          autoFocus
          className="flex-1 bg-transparent border-b border-indigo-400 text-xs text-slate-800 outline-none font-bold px-0"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onBlur={confirmRename}
          onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenaming(null); }}
        />
      ) : (
        <span className="text-[11px] font-bold truncate flex-1">{name}</span>
      )}
      <button
        onClick={e => { e.stopPropagation(); onRemove(id); }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all shrink-0"
        title="删除"
      >
        <i className="fa-solid fa-xmark text-[8px]" />
      </button>
    </div>
  );

  return (
    <div className="w-48 bg-white/80 backdrop-blur-sm border-r border-slate-200 flex flex-col shrink-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <i className="fa-solid fa-folder-tree text-indigo-400 text-[10px]" /> 项目导航
        </span>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-all"
        >
          <i className="fa-solid fa-chevron-left text-[8px]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
        {/* 工作表组 */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              <i className="fa-solid fa-table-columns text-[8px]" /> 工作表
            </span>
            <button
              onClick={onAddWorkbook}
              className="w-5 h-5 rounded-md text-blue-300 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all"
              title="新建工作表"
            >
              <i className="fa-solid fa-plus text-[8px]" />
            </button>
          </div>
          <div className="space-y-0.5">
            {workspace.workbooks.map(wb =>
              renderItem(
                wb.id, wb.name,
                'fa-solid fa-table',
                'text-blue-600', 'bg-blue-50', 'ring-blue-200',
                workspace.activeItemId === wb.id
              )
            )}
          </div>
        </div>

        {/* 图表组 */}
        <div>
          <div className="flex items-center justify-between px-2 mb-1.5">
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
              <i className="fa-solid fa-chart-area text-[8px]" /> 图表
            </span>
            <button
              onClick={onAddGraph}
              className="w-5 h-5 rounded-md text-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-all"
              title="新建图表"
            >
              <i className="fa-solid fa-plus text-[8px]" />
            </button>
          </div>
          <div className="space-y-0.5">
            {workspace.graphs.map(gr =>
              renderItem(
                gr.id, gr.name,
                'fa-solid fa-chart-line',
                'text-emerald-600', 'bg-emerald-50', 'ring-emerald-200',
                workspace.activeItemId === gr.id
              )
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-100 text-[8px] text-slate-400 font-mono text-center">
        {workspace.workbooks.length} 表 · {workspace.graphs.length} 图
      </div>

      {/* Context Menu - Portal to body to escape backdrop-blur containing block */}
      {contextMenu && ReactDOM.createPortal(
        <div
          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              const item = [...workspace.workbooks, ...workspace.graphs].find(x => x.id === contextMenu.id);
              if (item) handleRename(item.id, item.name);
              setContextMenu(null);
            }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-pen text-[10px] w-4" /> 重命名
          </button>
          <button
            onClick={() => { onRemove(contextMenu.id); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-trash text-[10px] w-4" /> 删除
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProjectExplorer;
