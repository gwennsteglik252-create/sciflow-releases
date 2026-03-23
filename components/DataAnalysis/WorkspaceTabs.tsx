import React from 'react';
import { WorkspaceState } from '../../types/workspace';

interface WorkspaceTabsProps {
  workspace: WorkspaceState;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ workspace, onSelect, onClose }) => {
  const allItems = [...workspace.workbooks, ...workspace.graphs];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-100/50 border-b border-slate-200 overflow-x-auto custom-scrollbar shrink-0">
      {workspace.openTabs.map(tabId => {
        const item = allItems.find(x => x.id === tabId);
        if (!item) return null;
        const isActive = workspace.activeItemId === tabId;
        const isWorkbook = workspace.workbooks.some(w => w.id === tabId);

        return (
          <div
            key={tabId}
            onClick={() => onSelect(tabId)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all group text-nowrap ${
              isActive
                ? 'bg-white shadow-sm border border-slate-200 text-slate-800'
                : 'text-slate-400 hover:bg-white/60 hover:text-slate-600 border border-transparent'
            }`}
          >
            <i className={`${isWorkbook ? 'fa-solid fa-table' : 'fa-solid fa-chart-line'} text-[9px] ${
              isActive
                ? (isWorkbook ? 'text-blue-500' : 'text-emerald-500')
                : 'text-slate-400'
            }`} />
            <span className="text-[10px] font-bold">{item.name}</span>
            {workspace.openTabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onClose(tabId); }}
                className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all ml-0.5"
              >
                <i className="fa-solid fa-xmark text-[7px]" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkspaceTabs;
