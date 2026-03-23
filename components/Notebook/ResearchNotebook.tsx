/**
 * ResearchNotebook — 科研笔记本主视图
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectContext } from '../../context/ProjectContextCore';
import { NotebookNote, NoteType, NotebookViewMode, NotebookSortBy, NoteResearchStage } from '../../types/notebook';
import NoteEditorModal from './NoteEditorModal';
import NoteGraphView from './NoteGraphView';
import NoteStatsView from './NoteStatsView';
import NoteKanbanView from './NoteKanbanView';

// ═══ 笔记类型元数据 ═══
const NOTE_TYPE_META: Record<NoteType, { label: string; icon: string; color: string; bg: string }> = {
  thought: { label: '灵感', icon: 'fa-lightbulb', color: '#a855f7', bg: 'from-purple-500/20 to-violet-500/10' },
  meeting: { label: '会议', icon: 'fa-users', color: '#f59e0b', bg: 'from-amber-500/20 to-orange-500/10' },
  reading: { label: '阅读', icon: 'fa-book', color: '#22c55e', bg: 'from-emerald-500/20 to-green-500/10' },
  experiment: { label: '实验', icon: 'fa-flask', color: '#3b82f6', bg: 'from-blue-500/20 to-cyan-500/10' },
  idea: { label: '想法', icon: 'fa-rocket', color: '#ec4899', bg: 'from-pink-500/20 to-rose-500/10' },
};

const VIEW_MODES: { mode: NotebookViewMode; icon: string; label: string }[] = [
  { mode: 'grid', icon: 'fa-grip', label: '网格' },
  { mode: 'list', icon: 'fa-list', label: '列表' },
  { mode: 'timeline', icon: 'fa-timeline', label: '时间线' },
  { mode: 'graph', icon: 'fa-diagram-project', label: '图谱' },
  { mode: 'stats', icon: 'fa-chart-pie', label: '看板' },
  { mode: 'kanban', icon: 'fa-columns', label: 'Kanban' },
];

const SORT_OPTIONS: { value: NotebookSortBy; label: string }[] = [
  { value: 'updatedAt', label: '最近更新' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'title', label: '标题排序' },
];

// ═══ 模糊搜索工具 ═══
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  // Direct include
  if (lowerText.includes(lowerQuery)) return true;
  // Character-level fuzzy: all query chars appear in order
  let qi = 0;
  for (let i = 0; i < lowerText.length && qi < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

function highlightText(text: string, query: string, isLight: boolean): React.ReactNode {
  if (!query || !query.trim()) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className={`px-0.5 rounded ${isLight ? 'bg-amber-200 text-amber-900' : 'bg-amber-500/30 text-amber-200'}`}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

const ResearchNotebook: React.FC = () => {
  const { notebookSession, updateNotebookSession, activeTheme, projects } = useProjectContext();
  const isLight = activeTheme.type === 'light';
  const { notes, activeTags, searchQuery, viewMode, sortBy } = notebookSession;

  const [editingNote, setEditingNote] = useState<NotebookNote | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ═══ 全部标签收集 ═══
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  // ═══ 过滤与排序 ═══
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // 标签过滤
    if (activeTags.length > 0) {
      result = result.filter(n => activeTags.some(t => n.tags.includes(t)));
    }

    // 类型过滤
    if (typeFilter !== 'all') {
      result = result.filter(n => n.type === typeFilter);
    }

    // 模糊搜索过滤
    if (searchQuery.trim()) {
      result = result.filter(n =>
        fuzzyMatch(n.title, searchQuery) ||
        fuzzyMatch(n.content, searchQuery) ||
        n.tags.some(t => fuzzyMatch(t, searchQuery))
      );
    }

    // 排序
    result.sort((a, b) => {
      // Pinned first
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [notes, activeTags, searchQuery, sortBy]);

  // ═══ 时间线分组 ═══
  const timelineGroups = useMemo(() => {
    if (viewMode !== 'timeline') return [];
    const groups: { date: string; notes: NotebookNote[] }[] = [];
    const map = new Map<string, NotebookNote[]>();
    filteredNotes.forEach(n => {
      const d = new Date(n.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(n);
    });
    map.forEach((notes, date) => groups.push({ date, notes }));
    return groups;
  }, [filteredNotes, viewMode]);

  // ═══ CRUD 操作 ═══
  const handleSaveNote = useCallback((note: NotebookNote) => {
    // 确保 attachments/history 等字段存在（兼容旧数据）
    const safeNote = { ...note, attachments: note.attachments || [], history: note.history || [], syncedAnnotations: note.syncedAnnotations || undefined };
    const updatedNotes = notes.some(n => n.id === safeNote.id)
      ? notes.map(n => n.id === safeNote.id ? safeNote : n)
      : [safeNote, ...notes];
    // 处理双向链接：确保被链接的笔记也反向链接当前笔记
    safeNote.linkedNoteIds.forEach(linkedId => {
      const linkedNote = updatedNotes.find(n => n.id === linkedId);
      if (linkedNote && !linkedNote.linkedNoteIds.includes(safeNote.id)) {
        linkedNote.linkedNoteIds = [...linkedNote.linkedNoteIds, safeNote.id];
      }
    });
    updateNotebookSession({ notes: updatedNotes });
    setShowEditor(false);
    setEditingNote(null);
  }, [notes, updateNotebookSession]);

  const handleDeleteNote = useCallback((id: string) => {
    updateNotebookSession({ notes: notes.filter(n => n.id !== id) });
    setConfirmDeleteId(null);
  }, [notes, updateNotebookSession]);

  const handleTogglePin = useCallback((id: string) => {
    updateNotebookSession({
      notes: notes.map(n => n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: new Date().toISOString() } : n),
    });
  }, [notes, updateNotebookSession]);

  const handleToggleFav = useCallback((id: string) => {
    updateNotebookSession({
      notes: notes.map(n => n.id === id ? { ...n, isFavorite: !n.isFavorite, updatedAt: new Date().toISOString() } : n),
    });
  }, [notes, updateNotebookSession]);

  const handleStageChange = useCallback((id: string, stage: NoteResearchStage) => {
    updateNotebookSession({
      notes: notes.map(n => n.id === id ? { ...n, researchStage: stage, updatedAt: new Date().toISOString() } : n),
    });
  }, [notes, updateNotebookSession]);

  const handleToggleTag = useCallback((tag: string) => {
    const next = activeTags.includes(tag) ? activeTags.filter(t => t !== tag) : [...activeTags, tag];
    updateNotebookSession({ activeTags: next });
  }, [activeTags, updateNotebookSession]);

  // ═══ 渲染 — Glassmorphism 卡片 ═══
  const renderNoteCard = (note: NotebookNote, index: number) => {
    const meta = NOTE_TYPE_META[note.type];
    const projectTitles = note.linkedProjectIds.map(id => projects.find(p => p.id === id)?.title).filter(Boolean);
    const linkedNoteCount = note.linkedNoteIds.length;
    const attachmentCount = (note.attachments || []).length;
    const hasAiSummary = !!note.aiSummary;
    const isCompact = viewMode === 'list';

    return (
      <motion.div
        key={note.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        className={`group relative rounded-2xl border cursor-pointer transition-all duration-300
          ${isLight
            ? 'bg-white/80 backdrop-blur-xl border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50'
            : 'bg-white/[0.03] backdrop-blur-xl border-white/[0.06] hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/10'
          }
          ${isCompact ? 'flex items-center px-4 py-3 gap-4' : 'p-4'}
          ${note.isPinned ? (isLight ? 'ring-2 ring-indigo-200' : 'ring-1 ring-indigo-500/30') : ''}
        `}
        onClick={() => { setEditingNote(note); setShowEditor(true); }}
      >
        {/* Color stripe */}
        {note.color && (
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ backgroundColor: note.color }} />
        )}

        {/* Top row — Type badge + actions */}
        <div className={`flex items-center ${isCompact ? 'shrink-0 gap-2' : 'justify-between mb-3'}`}>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider bg-gradient-to-r ${meta.bg}`} style={{ color: meta.color }}>
            <i className={`fa-solid ${meta.icon} text-[8px]`} />
            {meta.label}
          </div>
          {!isCompact && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {note.isPinned && <i className="fa-solid fa-thumbtack text-[8px] text-indigo-400" />}
              {note.isFavorite && <i className="fa-solid fa-star text-[8px] text-amber-400" />}
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className={`font-black text-[12px] leading-snug ${isCompact ? 'flex-1 min-w-0 truncate' : 'mb-2 line-clamp-2'}  ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {note.title}
        </h3>

        {/* Content preview (grid only) */}
        {!isCompact && (
          <p className={`text-[10px] leading-relaxed mb-3 line-clamp-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {note.content || '暂无内容...'}
          </p>
        )}

        {/* Tags & Meta */}
        <div className={`flex items-center flex-wrap gap-1 ${isCompact ? 'shrink-0' : 'mt-auto'}`}>
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${isLight ? 'bg-indigo-50 text-indigo-500' : 'bg-indigo-500/15 text-indigo-300'}`}>
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className={`text-[7px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>+{note.tags.length - 3}</span>
          )}
        </div>

        {/* Footer — links & time */}
        {!isCompact && (
          <div className={`flex items-center justify-between mt-3 pt-2 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <div className="flex items-center gap-2">
              {projectTitles.length > 0 && (
                <span className={`text-[7px] font-bold flex items-center gap-1 ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`}>
                  <i className="fa-solid fa-vials text-[7px]" /> {projectTitles.length}
                </span>
              )}
              {linkedNoteCount > 0 && (
                <span className={`text-[7px] font-bold flex items-center gap-1 ${isLight ? 'text-violet-500' : 'text-violet-400'}`}>
                  <i className="fa-solid fa-link text-[7px]" /> {linkedNoteCount}
                </span>
              )}
              {note.linkedLiteratureIds.length > 0 && (
                <span className={`text-[7px] font-bold flex items-center gap-1 ${isLight ? 'text-blue-500' : 'text-blue-400'}`}>
                  <i className="fa-solid fa-book text-[7px]" /> {note.linkedLiteratureIds.length}
                </span>
              )}
              {attachmentCount > 0 && (
                <span className={`text-[7px] font-bold flex items-center gap-1 ${isLight ? 'text-cyan-500' : 'text-cyan-400'}`}>
                  <i className="fa-solid fa-paperclip text-[7px]" /> {attachmentCount}
                </span>
              )}
              {hasAiSummary && (
                <span className={`text-[7px] font-bold flex items-center gap-1 ${isLight ? 'text-amber-500' : 'text-amber-400'}`} title="已生成 AI 摘要">
                  <i className="fa-solid fa-bolt text-[7px]" />
                </span>
              )}
            </div>
            <span className={`text-[7px] font-bold ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
              {new Date(note.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Hover action bar */}
        <div className={`absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all ${isCompact ? 'relative top-0 right-0' : ''}`}>
          <button
            onClick={e => { e.stopPropagation(); handleTogglePin(note.id); }}
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] transition-all ${note.isPinned ? 'bg-indigo-500 text-white' : isLight ? 'bg-white/80 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500' : 'bg-slate-800/80 text-slate-500 hover:bg-indigo-500/20 hover:text-indigo-400'}`}
          >
            <i className="fa-solid fa-thumbtack" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleToggleFav(note.id); }}
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] transition-all ${note.isFavorite ? 'bg-amber-500 text-white' : isLight ? 'bg-white/80 text-slate-400 hover:bg-amber-50 hover:text-amber-500' : 'bg-slate-800/80 text-slate-500 hover:bg-amber-500/20 hover:text-amber-400'}`}
          >
            <i className={`fa-${note.isFavorite ? 'solid' : 'regular'} fa-star`} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setConfirmDeleteId(note.id); }}
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] transition-all ${isLight ? 'bg-white/80 text-slate-400 hover:bg-rose-50 hover:text-rose-500' : 'bg-slate-800/80 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400'}`}
          >
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      </motion.div>
    );
  };

  // ═══ 主界面 ═══
  return (
    <div className={`flex-1 h-full overflow-y-auto custom-scrollbar ${isLight ? 'bg-slate-50' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <i className="fa-solid fa-book-open text-white text-sm" />
              </div>
              <div>
                <h1 className={`text-lg font-black uppercase tracking-widest ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  科研笔记
                </h1>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Research Notebook · {notes.length} Notes
                </p>
              </div>
            </div>
            <button
              onClick={() => { setEditingNote(null); setShowEditor(true); }}
              className="px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-[1.02] transition-all active:scale-95 flex items-center gap-2"
            >
              <i className="fa-solid fa-plus text-[8px]" />
              新建笔记
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className={`flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isLight ? 'bg-white border-slate-200 focus-within:border-indigo-300' : 'bg-white/5 border-white/10 focus-within:border-indigo-500'}`}>
              <i className={`fa-solid fa-magnifying-glass text-[10px] ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => updateNotebookSession({ searchQuery: e.target.value })}
                placeholder="搜索笔记..."
                className={`flex-1 text-[11px] font-bold bg-transparent outline-none placeholder:text-slate-400 ${isLight ? 'text-slate-800' : 'text-white'}`}
              />
              {searchQuery && (
                <button onClick={() => updateNotebookSession({ searchQuery: '' })} className="text-slate-400 hover:text-slate-600">
                  <i className="fa-solid fa-xmark text-[9px]" />
                </button>
              )}
              {/* 搜索筛选按钮 */}
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[9px] transition-all ${showFilterPanel || typeFilter !== 'all'
                  ? 'bg-indigo-600 text-white'
                  : isLight ? 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50' : 'text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10'
                }`}
                title="筛选"
              >
                <i className="fa-solid fa-filter" />
              </button>
            </div>

            {/* 搜索筛选面板 */}
            {showFilterPanel && (
              <div className={`flex items-center gap-2 flex-wrap mt-2 p-3 rounded-xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>按类型</span>
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${typeFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >全部</button>
                {Object.entries(NOTE_TYPE_META).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key as NoteType)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all ${typeFilter === key
                      ? 'text-white shadow-md'
                      : isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                    style={typeFilter === key ? { backgroundColor: meta.color } : {}}
                  >
                    <i className={`fa-solid ${meta.icon} text-[7px]`} />
                    {meta.label}
                  </button>
                ))}
                {typeFilter !== 'all' && (
                  <button onClick={() => { setTypeFilter('all'); setShowFilterPanel(false); }} className="text-[8px] font-bold text-rose-400 hover:text-rose-500 ml-2">
                    <i className="fa-solid fa-xmark text-[7px] mr-0.5" />清除
                  </button>
                )}
              </div>
            )}

            {/* View mode */}
            <div className={`flex items-center rounded-xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              {VIEW_MODES.map(v => (
                <button
                  key={v.mode}
                  onClick={() => updateNotebookSession({ viewMode: v.mode })}
                  className={`px-3 py-2 text-[10px] font-black transition-all ${viewMode === v.mode
                    ? 'bg-indigo-600 text-white'
                    : isLight ? 'bg-white text-slate-400 hover:bg-slate-50' : 'bg-white/5 text-slate-500 hover:bg-white/10'
                  }`}
                  title={v.label}
                >
                  <i className={`fa-solid ${v.icon}`} />
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => updateNotebookSession({ sortBy: e.target.value as NotebookSortBy })}
              className={`px-3 py-2 rounded-xl text-[10px] font-black outline-none border cursor-pointer ${isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400'}`}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Tags bar */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <span className={`text-[7px] font-black uppercase tracking-widest mr-1 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>TAGS</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  className={`px-2 py-1 rounded-lg text-[8px] font-bold transition-all active:scale-95 ${activeTags.includes(tag)
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isLight ? 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-500' : 'bg-white/5 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300'
                  }`}
                >
                  #{tag}
                </button>
              ))}
              {activeTags.length > 0 && (
                <button
                  onClick={() => updateNotebookSession({ activeTags: [] })}
                  className="text-[8px] font-bold text-slate-400 hover:text-rose-400 transition-all ml-1"
                >
                  <i className="fa-solid fa-xmark text-[7px] mr-0.5" />清除
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* ── Content ── */}
        {notes.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex flex-col items-center justify-center py-20 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center mb-5">
              <i className={`fa-solid fa-book-open text-3xl ${isLight ? 'text-amber-400' : 'text-amber-500/60'}`} />
            </div>
            <h3 className={`text-sm font-black uppercase tracking-widest mb-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              还没有笔记
            </h3>
            <p className={`text-[10px] font-bold mb-6 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              在这里记录碎片化的灵感、实验心得和阅读笔记
            </p>
            <button
              onClick={() => { setEditingNote(null); setShowEditor(true); }}
              className="px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg hover:scale-105 transition-all active:scale-95"
            >
              <i className="fa-solid fa-plus text-[8px] mr-1.5" />
              创建第一条笔记
            </button>
          </motion.div>
        ) : filteredNotes.length === 0 ? (
          /* No results */
          <div className={`flex flex-col items-center justify-center py-16 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
            <i className={`fa-solid fa-magnifying-glass text-2xl mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
            <p className={`text-xs font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>未找到匹配的笔记</p>
          </div>
        ) : viewMode === 'timeline' ? (
          /* Timeline view */
          <div className="space-y-6">
            {timelineGroups.map((group, gi) => (
              <motion.div
                key={group.date}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: gi * 0.05 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30" />
                  <h3 className={`text-[11px] font-black uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {group.date}
                  </h3>
                  <div className={`flex-1 h-px ${isLight ? 'bg-slate-200' : 'bg-white/5'}`} />
                  <span className={`text-[8px] font-bold ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>{group.notes.length} 条</span>
                </div>
                <div className="pl-6 space-y-2">
                  {group.notes.map((note, ni) => renderNoteCard(note, ni))}
                </div>
              </motion.div>
            ))}
          </div>
        ) : viewMode === 'graph' ? (
          /* Graph view */
          <NoteGraphView
            notes={filteredNotes}
            isLight={isLight}
            onSelectNote={(n) => { setEditingNote(n); setShowEditor(true); }}
          />
        ) : viewMode === 'stats' ? (
          /* Stats view */
          <NoteStatsView notes={notes} isLight={isLight} projects={projects} />
        ) : viewMode === 'kanban' ? (
          /* Kanban view */
          <NoteKanbanView
            notes={filteredNotes}
            isLight={isLight}
            onSelectNote={(n) => { setEditingNote(n); setShowEditor(true); }}
            onStageChange={handleStageChange}
          />
        ) : (
          /* Grid / List view */
          <AnimatePresence mode="popLayout">
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-2'
            }>
              {filteredNotes.map((note, i) => renderNoteCard(note, i))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Stats footer ── */}
        {notes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`mt-8 pt-4 border-t text-center ${isLight ? 'border-slate-200' : 'border-white/5'}`}
          >
            <div className="flex items-center justify-center gap-6">
              <span className={`text-[8px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                共 {notes.length} 条笔记
              </span>
              <span className={`text-[8px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                {allTags.length} 个标签
              </span>
              <span className={`text-[8px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                {notes.filter(n => n.isPinned).length} 置顶
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Editor Modal ── */}
      {showEditor && (
        <NoteEditorModal
          note={editingNote}
          allNotes={notes}
          onSave={handleSaveNote}
          onClose={() => { setShowEditor(false); setEditingNote(null); }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center" onClick={() => setConfirmDeleteId(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`relative p-6 rounded-2xl border shadow-2xl max-w-sm ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-trash text-rose-500 text-lg" />
            </div>
            <h3 className={`text-center text-sm font-black mb-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              确认删除笔记？
            </h3>
            <p className={`text-center text-[10px] font-bold mb-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              此操作不可撤销
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-slate-400'}`}
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteNote(confirmDeleteId)}
                className="flex-1 py-2 rounded-xl text-[10px] font-black uppercase bg-rose-600 text-white shadow-lg active:scale-95 transition-all"
              >
                确认删除
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ResearchNotebook;
