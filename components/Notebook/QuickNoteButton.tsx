/**
 * QuickNoteButton — 全局快捷笔记悬浮按钮
 * 在所有页面右下角显示，点击弹出精简版笔记弹窗
 */
import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectContext } from '../../context/ProjectContextCore';
import { NotebookNote, NoteType } from '../../types/notebook';

const QUICK_NOTE_TYPES: { type: NoteType; label: string; icon: string; color: string }[] = [
  { type: 'thought', label: '灵感', icon: 'fa-lightbulb', color: '#a855f7' },
  { type: 'meeting', label: '会议', icon: 'fa-users', color: '#f59e0b' },
  { type: 'reading', label: '阅读', icon: 'fa-book', color: '#22c55e' },
  { type: 'experiment', label: '实验', icon: 'fa-flask', color: '#3b82f6' },
  { type: 'idea', label: '想法', icon: 'fa-rocket', color: '#ec4899' },
];

/** 从 hash 推断当前上下文的关联课题 ID */
function detectContextProjectId(hash: string, projects: { id: string }[]): string | null {
  const match = hash.match(/#(?:project|project_detail|literature)\/([^/]+)/);
  if (match) {
    const found = projects.find(p => p.id === match[1]);
    if (found) return found.id;
  }
  return null;
}

/** 检测当前模块名称 */
function detectModuleName(hash: string): string | null {
  const moduleMap: Record<string, string> = {
    'dashboard': '研究看板', 'project_detail': '课题中心', 'projects': '课题中心',
    'literature': '情报档案', 'research_brain': '中心大脑', 'mechanism': '机理推演',
    'data': '数据分析', 'writing': '写作工坊', 'notebook': '科研笔记',
    'characterization_hub': '实验表征', 'figure_center': '科研绘图',
    'doe': 'DOE 迭代', 'flowchart': '实验路线', 'inventory': '库存管理',
    'team': '团队矩阵', 'inception': '战略立项',
  };
  const viewMatch = hash.match(/#([a-z_]+)/);
  if (viewMatch) return moduleMap[viewMatch[1]] || null;
  return null;
}

const QuickNoteButton: React.FC = () => {
  const { notebookSession, updateNotebookSession, activeTheme, projects } = useProjectContext();
  const isLight = activeTheme.type === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<NoteType>('thought');

  // 监听 hash 变化
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  useEffect(() => {
    const onHashChange = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const currentModule = detectModuleName(currentHash);

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) return;

    const now = new Date().toISOString();
    const contextProjectId = detectContextProjectId(currentHash, projects);

    const newNote: NotebookNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || '快捷笔记',
      content,
      type,
      tags: ['快捷笔记'],
      linkedProjectIds: contextProjectId ? [contextProjectId] : [],
      linkedLiteratureIds: [],
      linkedNoteIds: [],
      isPinned: false,
      isFavorite: false,
      attachments: [],
      history: [],
      createdAt: now,
      updatedAt: now,
    };

    updateNotebookSession({
      notes: [newNote, ...notebookSession.notes],
    });

    // Reset
    setTitle('');
    setContent('');
    setType('thought');
    setIsOpen(false);
  }, [title, content, type, currentHash, projects, notebookSession.notes, updateNotebookSession]);

  return (
    <>
      {/* 悬浮按钮 */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={`fixed bottom-6 right-6 z-[8500] w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center transition-all
          bg-gradient-to-br from-amber-500 to-orange-600 text-white
          hover:shadow-amber-500/40 hover:shadow-xl
        `}
        title="快捷笔记"
      >
        <i className="fa-solid fa-pen-to-square text-base" />
        {/* 脉冲光晕 */}
        <span className="absolute inset-0 rounded-2xl bg-amber-400/30 animate-ping" style={{ animationDuration: '3s' }} />
      </motion.button>

      {/* 快捷编辑弹窗 */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[8600] flex items-end justify-end p-6" onClick={() => setIsOpen(false)}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative w-[380px] max-h-[500px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden
                ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}
              `}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b shrink-0 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-white text-[10px]" />
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    快捷笔记
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${isLight ? 'bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500' : 'bg-white/5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400'}`}
                >
                  <i className="fa-solid fa-xmark text-[10px]" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {/* Title */}
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="标题..."
                  autoFocus
                  className={`w-full text-sm font-black outline-none bg-transparent placeholder:text-slate-400 ${isLight ? 'text-slate-800' : 'text-white'}`}
                />

                {/* Type */}
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_NOTE_TYPES.map(t => (
                    <button
                      key={t.type}
                      onClick={() => setType(t.type)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all active:scale-95
                        ${type === t.type ? 'text-white shadow-md' : isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}
                      `}
                      style={type === t.type ? { backgroundColor: t.color } : {}}
                    >
                      <i className={`fa-solid ${t.icon} text-[8px]`} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="快速记录你的想法..."
                  rows={5}
                  className={`w-full px-3 py-2 rounded-xl border text-[11px] font-medium leading-relaxed outline-none resize-none transition-all
                    ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-300' : 'bg-white/5 border-white/10 text-white focus:border-indigo-500'}
                  `}
                />

                {/* Context hint */}
                {currentModule && (
                  <div className={`flex items-center gap-1.5 text-[8px] font-bold ${isLight ? 'text-indigo-400' : 'text-indigo-400'}`}>
                    <i className="fa-solid fa-location-dot text-[7px]" />
                    当前模块：{currentModule}
                  </div>
                )}
                {detectContextProjectId(currentHash, projects) && (
                  <div className={`flex items-center gap-1.5 text-[8px] font-bold ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`}>
                    <i className="fa-solid fa-link text-[7px]" />
                    将自动关联当前课题
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t shrink-0 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                <button
                  onClick={() => setIsOpen(false)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'}`}
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!title.trim() && !content.trim()}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95
                    ${!title.trim() && !content.trim()
                      ? (isLight ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white/5 text-slate-600 cursor-not-allowed')
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl'
                    }
                  `}
                >
                  <i className="fa-solid fa-check text-[8px] mr-1" />
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickNoteButton;
