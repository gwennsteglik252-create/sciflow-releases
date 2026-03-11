
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ResearchProject } from '../../../types';

interface ProjectReportsViewProps {
  project: ResearchProject;
  updateAi: (updates: any) => void;
  toggleModal: (key: any, value: any) => void;
  onDeleteReport: (id: string, e: React.MouseEvent) => void;
  onRenameReport?: (id: string) => void;
  onStartWeeklyReport: (type?: 'weekly' | 'monthly' | 'annual' | 'manual') => void;
  isGenerating?: boolean;
}

const ProjectReportsView: React.FC<ProjectReportsViewProps> = ({
  project,
  updateAi,
  toggleModal,
  onDeleteReport,
  onRenameReport,
  onStartWeeklyReport,
  isGenerating = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    if (showCreateMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCreateMenu]);

  const getWeeklyReportDisplayName = (timestamp: string, originalTitle: string, type?: string) => {
    if (type !== 'Weekly') return originalTitle;
    try {
      const dateStr = timestamp.split(' ')[0].replace(/-/g, '/');
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return originalTitle;
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekNum = Math.ceil(day / 7);
      return `${month}月第${weekNum}周的周报告`;
    } catch (e) { return originalTitle; }
  };

  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (project.weeklyReports || []).filter(rep =>
      (rep.title || "").toLowerCase().includes(q) ||
      (rep.content || "").toLowerCase().includes(q) ||
      (rep.timestamp || "").includes(q)
    );
  }, [project.weeklyReports, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-8 overflow-hidden bg-slate-50/20">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 shrink-0 relative z-30">
        <h3 className="text-xl lg:text-3xl font-black text-slate-800 uppercase tracking-tight italic mb-0">研报/诊断 历史归档</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="搜索历史报告..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold outline-none focus:border-indigo-300 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreateMenu(!showCreateMenu); }}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap border-2 ${isGenerating ? 'bg-indigo-700 text-white border-indigo-500 ring-4 ring-indigo-100' : (showCreateMenu ? 'bg-indigo-700 text-white border-indigo-500 ring-4 ring-indigo-100' : 'bg-indigo-600 text-white border-indigo-400 hover:bg-indigo-700')}`}
            >
              {isGenerating ? (
                <i className="fa-solid fa-spinner animate-spin"></i>
              ) : (
                <i className={`fa-solid ${showCreateMenu ? 'fa-chevron-up' : 'fa-plus'}`}></i>
              )}
              {isGenerating ? '正在智能生成...' : '新建研报'}
            </button>
            {showCreateMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-reveal">
                <button onClick={() => { onStartWeeklyReport('manual'); setShowCreateMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-[10px] font-bold text-indigo-600 border-b border-slate-50 flex items-center gap-2 transition-colors">
                  <i className="fa-solid fa-pen-to-square"></i> 空白研报 (白板)
                </button>
                <button onClick={() => { onStartWeeklyReport('weekly'); setShowCreateMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-bold text-slate-700 border-b border-slate-50 flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> 周报智能生成
                </button>
                <button onClick={() => { onStartWeeklyReport('monthly'); setShowCreateMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-bold text-slate-700 border-b border-slate-50 flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> 月报智能生成
                </button>
                <button onClick={() => { onStartWeeklyReport('annual'); setShowCreateMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-bold text-slate-700 flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 年报智能生成
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 生成中的视觉占位符 */}
          {isGenerating && (
            <div className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-indigo-200 shadow-sm animate-pulse relative overflow-hidden flex flex-col justify-center min-h-[140px]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/20">
                <div className="h-full bg-indigo-600 w-1/3 animate-[loading_1.5s_infinite]"></div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                  <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 animate-bounce"></i>
                </div>
                <div>
                  <div className="h-3 w-32 bg-slate-100 rounded mb-1.5"></div>
                  <div className="h-2 w-20 bg-slate-50 rounded"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-slate-50 rounded"></div>
                <div className="h-2 w-2/3 bg-slate-50 rounded"></div>
              </div>
              <p className="mt-4 text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center">AI 正在深度解算并同步实验数据...</p>
            </div>
          )}

          {filteredReports.map(rep => {
            const displayName = getWeeklyReportDisplayName(rep.timestamp, rep.title, rep.reportType);
            return (
              <div key={rep.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:border-indigo-100 transition-all cursor-pointer relative group/rep" onClick={() => { updateAi({ currentReport: { id: rep.id, title: displayName, content: rep.content, sourceLogIds: rep.sourceLogIds } }); toggleModal('weekly', true); }}>
                <div className="absolute top-4 right-4 flex gap-2 sm:opacity-0 group-hover/rep:opacity-100 transition-all z-20">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRenameReport?.(rep.id); }}
                    className="w-8 h-8 bg-indigo-50 text-indigo-500 border border-indigo-100 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
                    title="重命名"
                  >
                    <i className="fa-solid fa-pen text-[10px]"></i>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteReport(rep.id, e); }}
                    className="w-8 h-8 bg-rose-50 text-rose-400 border border-rose-100 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                    title="删除归档"
                  >
                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                  </button>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase ${rep.reportType === 'Weekly' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>{rep.reportType || 'Record'}</span>
                  <span className="text-[8px] font-black text-slate-300 uppercase mr-2 sm:group-hover/rep:mr-20 transition-all">{rep.timestamp}</span>
                </div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase truncate mb-2 pr-12">
                  {displayName}
                </h4>
                <p className="text-[9.5px] text-slate-400 line-clamp-2 italic leading-relaxed">{rep.content}</p>
              </div>
            );
          })}
        </div>
        {filteredReports.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 gap-4">
            <i className="fa-solid fa-file-circle-exclamation text-6xl text-slate-300"></i>
            <p className="text-sm font-black uppercase tracking-[0.4rem]">暂无研报归档</p>
          </div>
        )}
      </div>
      <style>{`
           @keyframes loading {
               0% { transform: translateX(-100%); }
               100% { transform: translateX(200%); }
           }
       `}</style>
    </div>
  );
};

export default ProjectReportsView;
