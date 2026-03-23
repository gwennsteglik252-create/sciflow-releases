/**
 * NoteEditorModal — 笔记编辑弹窗 (增强版)
 * 新增：模板系统、附件支持、AI 摘要
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { NotebookNote, NoteType, NoteAttachment, NoteTemplate, NoteHistoryEntry, ExperimentLogData, SyncedAnnotation } from '../../types/notebook';
import { useProjectContext } from '../../context/ProjectContextCore';
import { generateNoteSummary, generateDraftFromNotes, suggestTags } from '../../services/gemini/notebookAI';

// ═══ 笔记类型元数据 ═══
const NOTE_TYPES: { type: NoteType; label: string; icon: string; color: string }[] = [
  { type: 'thought', label: '灵感', icon: 'fa-lightbulb', color: '#a855f7' },
  { type: 'meeting', label: '会议', icon: 'fa-users', color: '#f59e0b' },
  { type: 'reading', label: '阅读', icon: 'fa-book', color: '#22c55e' },
  { type: 'experiment', label: '实验', icon: 'fa-flask', color: '#3b82f6' },
  { type: 'idea', label: '想法', icon: 'fa-rocket', color: '#ec4899' },
];

const CARD_COLORS = ['#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#06b6d4'];

// ═══ 内置模板 ═══
const BUILTIN_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tpl_experiment',
    name: '实验记录',
    type: 'experiment',
    icon: 'fa-flask',
    tags: ['实验'],
    content: `## 实验目标\n\n\n## 实验材料与方法\n\n- 材料：\n- 仪器：\n- 步骤：\n  1. \n  2. \n  3. \n\n## 实验结果\n\n\n## 讨论与分析\n\n\n## 下一步计划\n\n`,
  },
  {
    id: 'tpl_meeting',
    name: '会议纪要',
    type: 'meeting',
    icon: 'fa-users',
    tags: ['会议'],
    content: `## 会议信息\n\n- 日期：${new Date().toLocaleDateString('zh-CN')}\n- 参会人员：\n- 主持人：\n\n## 议题与讨论要点\n\n1. \n\n## 决议事项\n\n- [ ] \n\n## 后续行动\n\n| 事项 | 负责人 | 截止日期 |\n|------|--------|----------|\n|      |        |          |\n`,
  },
  {
    id: 'tpl_reading',
    name: '文献阅读',
    type: 'reading',
    icon: 'fa-book',
    tags: ['阅读', '文献'],
    content: `## 文献信息\n\n- 标题：\n- 作者：\n- 期刊/年份：\n- DOI：\n\n## 研究背景与动机\n\n\n## 核心方法\n\n\n## 关键结果\n\n\n## 启发与思考\n\n\n## 可借鉴之处\n\n`,
  },
  {
    id: 'tpl_idea',
    name: '灵感闪现',
    type: 'idea',
    icon: 'fa-rocket',
    tags: ['灵感'],
    content: `## 💡 核心想法\n\n\n## 灵感来源\n\n\n## 可行性初步分析\n\n- 优势：\n- 挑战：\n- 所需资源：\n\n## 相关文献/参考\n\n`,
  },
  {
    id: 'tpl_weekly',
    name: '项目周记',
    type: 'thought',
    icon: 'fa-calendar-week',
    tags: ['周记', '进展'],
    content: `## 本周进展 (${new Date().toLocaleDateString('zh-CN')})\n\n### 已完成\n- \n\n### 进行中\n- \n\n### 遇到的问题\n- \n\n### 下周计划\n- \n\n### 心得体会\n\n`,
  },
];

interface NoteEditorModalProps {
  note: NotebookNote | null;
  allNotes: NotebookNote[];
  onSave: (note: NotebookNote) => void;
  onClose: () => void;
}

const NoteEditorModal: React.FC<NoteEditorModalProps> = ({ note, allNotes, onSave, onClose }) => {
  const { projects, resources, activeTheme } = useProjectContext();
  const isLight = activeTheme.type === 'light';

  const isNew = !note;
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [type, setType] = useState<NoteType>(note?.type || 'thought');
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>(note?.linkedProjectIds || []);
  const [linkedLiteratureIds, setLinkedLiteratureIds] = useState<string[]>(note?.linkedLiteratureIds || []);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>(note?.linkedNoteIds || []);
  const [isPinned, setIsPinned] = useState(note?.isPinned || false);
  const [isFavorite, setIsFavorite] = useState(note?.isFavorite || false);
  const [color, setColor] = useState(note?.color || '');
  const [showPreview, setShowPreview] = useState(false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>(note?.attachments || []);
  const [aiSummary, setAiSummary] = useState(note?.aiSummary || '');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(isNew);
  const [showHistory, setShowHistory] = useState(false);
  const [previewHistoryIdx, setPreviewHistoryIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 3 states
  const [experimentData, setExperimentData] = useState<ExperimentLogData>(note?.experimentData || { objective: '', materials: '', procedure: '', results: '', conclusion: '' });
  const [useStructuredForm, setUseStructuredForm] = useState(!!note?.experimentData);
  const [syncedAnnotations, setSyncedAnnotations] = useState<SyncedAnnotation[]>(note?.syncedAnnotations || []);
  const [isSyncingAnnotations, setIsSyncingAnnotations] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [isSuggestingTags, setIsSuggestingTags] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const noteHistory: NoteHistoryEntry[] = note?.history || [];

  // Reset form when note changes
  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
    setType(note?.type || 'thought');
    setTags(note?.tags || []);
    setLinkedProjectIds(note?.linkedProjectIds || []);
    setLinkedLiteratureIds(note?.linkedLiteratureIds || []);
    setLinkedNoteIds(note?.linkedNoteIds || []);
    setIsPinned(note?.isPinned || false);
    setIsFavorite(note?.isFavorite || false);
    setColor(note?.color || '');
    setAttachments(note?.attachments || []);
    setAiSummary(note?.aiSummary || '');
    setShowTemplates(!note);
  }, [note]);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  // ═══ 模板应用 ═══
  const handleApplyTemplate = useCallback((tpl: NoteTemplate) => {
    setContent(tpl.content);
    setType(tpl.type);
    setTags(prev => {
      const merged = new Set([...prev, ...tpl.tags]);
      return Array.from(merged);
    });
    setShowTemplates(false);
  }, []);

  // ═══ 附件处理 ═══
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // 限制单个文件 5MB
      if (file.size > 5 * 1024 * 1024) {
        alert(`文件 "${file.name}" 超过 5MB 限制`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const newAttachment: NoteAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl: reader.result as string,
        };
        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'fa-image';
    if (mimeType.startsWith('application/pdf')) return 'fa-file-pdf';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'fa-file-excel';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    return 'fa-file';
  };

  // ═══ AI 摘要 ═══
  const handleGenerateSummary = useCallback(async () => {
    if (!content || content.trim().length < 20) return;
    setIsSummarizing(true);
    try {
      const summary = await generateNoteSummary(content);
      setAiSummary(summary);
    } catch (e: any) {
      console.error('[NotebookAI] Summary generation failed:', e);
      setAiSummary(`摘要生成失败: ${e?.message || '未知错误'}`);
    } finally {
      setIsSummarizing(false);
    }
  }, [content]);

  const handleSave = () => {
    const now = new Date().toISOString();

    // 自动创建版本历史快照（仅编辑模式且内容有变更时）
    const existingHistory: NoteHistoryEntry[] = note?.history || [];
    let updatedHistory = [...existingHistory];
    if (note && (note.title !== title || note.content !== content || note.type !== type)) {
      updatedHistory = [
        ...existingHistory,
        {
          timestamp: note.updatedAt,
          title: note.title,
          content: note.content,
          type: note.type,
          tags: [...note.tags],
        },
      ];
      // 最多保留 20 个版本
      if (updatedHistory.length > 20) updatedHistory = updatedHistory.slice(-20);
    }

    const savedNote: NotebookNote = {
      id: note?.id || `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || '无标题笔记',
      content,
      type,
      tags,
      linkedProjectIds,
      linkedLiteratureIds,
      linkedNoteIds,
      isPinned,
      isFavorite,
      color: color || undefined,
      attachments,
      aiSummary: aiSummary || undefined,
      history: updatedHistory,
      experimentData: type === 'experiment' && useStructuredForm ? experimentData : undefined,
      syncedAnnotations: syncedAnnotations.length > 0 ? syncedAnnotations : undefined,
      createdAt: note?.createdAt || now,
      updatedAt: now,
    };
    onSave(savedNote);
  };

  const otherNotes = useMemo(() => allNotes.filter(n => n.id !== note?.id), [allNotes, note]);

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={`relative w-[90vw] max-w-3xl max-h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-pen-to-square text-white text-xs" />
            </div>
            <h2 className={`text-sm font-black uppercase tracking-widest ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {isNew ? '新建笔记' : '编辑笔记'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPinned(!isPinned)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isPinned ? 'bg-indigo-500 text-white' : isLight ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
              title="置顶"
            >
              <i className="fa-solid fa-thumbtack text-[10px]" />
            </button>
            {/* 版本历史按钮 */}
            {!isNew && noteHistory.length > 0 && (
              <button
                onClick={() => { setShowHistory(!showHistory); setPreviewHistoryIdx(null); }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${showHistory ? 'bg-cyan-500 text-white' : isLight ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                title={`版本历史 (${noteHistory.length})`}
              >
                <i className="fa-solid fa-clock-rotate-left text-[10px]" />
              </button>
            )}
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isFavorite ? 'bg-amber-500 text-white' : isLight ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
              title="收藏"
            >
              <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-star text-[10px]`} />
            </button>
            <button onClick={onClose} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isLight ? 'bg-slate-100 text-slate-400 hover:bg-rose-100 hover:text-rose-500' : 'bg-white/5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400'}`}>
              <i className="fa-solid fa-xmark text-xs" />
            </button>
            {/* 导出按钮 */}
            {!isNew && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isLight ? 'bg-slate-100 text-slate-400 hover:bg-teal-100 hover:text-teal-500' : 'bg-white/5 text-slate-500 hover:bg-teal-500/20 hover:text-teal-400'}`}
                  title="导出笔记"
                >
                  <i className="fa-solid fa-download text-[10px]" />
                </button>
                {showExportMenu && (
                  <div className={`absolute right-0 top-full mt-1 rounded-xl border shadow-xl overflow-hidden z-20 min-w-[120px] ${isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10'}`}>
                    <button
                      onClick={() => {
                        const md = `# ${title}\n\n${content}`;
                        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${title || '无标题笔记'}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setShowExportMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-[10px] font-bold flex items-center gap-2 transition-all ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-slate-300'}`}
                    >
                      <i className="fa-solid fa-file-lines text-[9px]" />
                      Markdown (.md)
                    </button>
                    <button
                      onClick={() => {
                        const plainText = content.replace(/[#*_`~>\-\[\]()!|]/g, '').replace(/\n{3,}/g, '\n\n');
                        const txt = `${title}\n${'='.repeat(title.length)}\n\n${plainText}`;
                        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${title || '无标题笔记'}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setShowExportMenu(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-[10px] font-bold flex items-center gap-2 transition-all ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-slate-300'}`}
                    >
                      <i className="fa-solid fa-file-alt text-[9px]" />
                      纯文本 (.txt)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">

          {/* ═══ 版本历史面板 ═══ */}
          {showHistory && noteHistory.length > 0 && (
            <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-cyan-50 border-cyan-200' : 'bg-cyan-500/5 border-cyan-500/20'}`}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isLight ? 'border-cyan-100' : 'border-cyan-500/10'}`}>
                <div className="flex items-center gap-2">
                  <i className={`fa-solid fa-clock-rotate-left text-[10px] ${isLight ? 'text-cyan-500' : 'text-cyan-400'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-cyan-600' : 'text-cyan-300'}`}>
                    版本历史 ({noteHistory.length})
                  </span>
                </div>
                <button onClick={() => { setShowHistory(false); setPreviewHistoryIdx(null); }} className={`text-[8px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                {[...noteHistory].reverse().map((entry, idx) => {
                  const realIdx = noteHistory.length - 1 - idx;
                  const isSelected = previewHistoryIdx === realIdx;
                  return (
                    <div
                      key={entry.timestamp + idx}
                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-all ${isSelected
                        ? (isLight ? 'bg-cyan-100' : 'bg-cyan-500/15')
                        : (isLight ? 'hover:bg-cyan-50' : 'hover:bg-cyan-500/5')
                      } ${isLight ? 'border-b border-cyan-50 last:border-0' : 'border-b border-cyan-500/5 last:border-0'}`}
                      onClick={() => setPreviewHistoryIdx(isSelected ? null : realIdx)}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-cyan-500' : isLight ? 'bg-cyan-300' : 'bg-cyan-600'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-[10px] font-bold truncate block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          {entry.title || '无标题'}
                        </span>
                        <span className={`text-[8px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {new Date(entry.timestamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{entry.content.length} 字符
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTitle(entry.title);
                          setContent(entry.content);
                          setType(entry.type);
                          setTags([...entry.tags]);
                          setShowHistory(false);
                          setPreviewHistoryIdx(null);
                        }}
                        className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase shrink-0 transition-all active:scale-95 ${isLight ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-cyan-600 text-white hover:bg-cyan-500'}`}
                      >
                        回滚
                      </button>
                    </div>
                  );
                })}
              </div>
              {previewHistoryIdx !== null && (
                <div className={`px-4 py-3 border-t ${isLight ? 'border-cyan-100 bg-white/60' : 'border-cyan-500/10 bg-black/20'}`}>
                  <span className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${isLight ? 'text-cyan-500' : 'text-cyan-400'}`}>内容预览</span>
                  <pre className={`text-[10px] font-medium leading-relaxed max-h-[80px] overflow-y-auto whitespace-pre-wrap ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {noteHistory[previewHistoryIdx].content.slice(0, 500)}{noteHistory[previewHistoryIdx].content.length > 500 ? '...' : ''}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ═══ 模板选择器（仅新建模式） ═══ */}
          {isNew && showTemplates && (
            <div className={`rounded-2xl border p-4 ${isLight ? 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100' : 'bg-gradient-to-r from-indigo-500/5 to-violet-500/5 border-indigo-500/20'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid fa-wand-magic-sparkles text-[10px] ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-indigo-600' : 'text-indigo-300'}`}>
                    选择模板快速开始
                  </span>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className={`text-[8px] font-bold px-2 py-0.5 rounded-lg ${isLight ? 'text-slate-400 hover:bg-slate-200' : 'text-slate-500 hover:bg-white/10'}`}
                >
                  跳过
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {BUILTIN_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => handleApplyTemplate(tpl)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 hover:scale-[1.02] ${isLight
                      ? 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-md shadow-sm'
                      : 'bg-white/5 border border-white/10 text-slate-300 hover:border-indigo-500/40 hover:bg-white/10'
                    }`}
                  >
                    <i className={`fa-solid ${tpl.icon} text-[9px]`} style={{ color: NOTE_TYPES.find(t => t.type === tpl.type)?.color }} />
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 折叠后可重新展开模板 */}
          {isNew && !showTemplates && (
            <button
              onClick={() => setShowTemplates(true)}
              className={`text-[9px] font-bold flex items-center gap-1 ${isLight ? 'text-indigo-500 hover:text-indigo-700' : 'text-indigo-400 hover:text-indigo-300'}`}
            >
              <i className="fa-solid fa-wand-magic-sparkles text-[8px]" />
              使用模板
            </button>
          )}

          {/* Title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="笔记标题..."
            className={`w-full text-lg font-black outline-none bg-transparent placeholder:text-slate-400 ${isLight ? 'text-slate-800' : 'text-white'}`}
            autoFocus
          />

          {/* Type Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[8px] font-black uppercase tracking-widest mr-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>类型</span>
            {NOTE_TYPES.map(t => (
              <button
                key={t.type}
                onClick={() => setType(t.type)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all active:scale-95 ${type === t.type
                  ? 'text-white shadow-lg'
                  : isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
                style={type === t.type ? { backgroundColor: t.color } : {}}
              >
                <i className={`fa-solid ${t.icon} text-[9px]`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tags */}
          <div>
            <span className={`text-[8px] font-black uppercase tracking-widest block mb-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>标签</span>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className={`px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 ${isLight ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300'}`}>
                  #{tag}
                  <button onClick={() => setTags(tags.filter(t => t !== tag))} className="opacity-60 hover:opacity-100">
                    <i className="fa-solid fa-xmark text-[7px]" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                placeholder="输入标签，回车添加..."
                className={`flex-1 px-3 py-1.5 rounded-xl text-[11px] font-bold outline-none border transition-all ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-300' : 'bg-white/5 border-white/10 text-white focus:border-indigo-500'}`}
              />
              <button onClick={handleAddTag} className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black active:scale-95">
                <i className="fa-solid fa-plus text-[8px]" />
              </button>
              {/* AI 智能标签推荐 */}
              <button
                onClick={async () => {
                  if (isSuggestingTags) return;
                  setIsSuggestingTags(true);
                  try {
                    const allUsedTags = Array.from(new Set(allNotes.flatMap(n => n.tags)));
                    const suggested = await suggestTags({ content, title, existingTags: tags, allUsedTags });
                    setSuggestedTags(suggested);
                  } catch (e) { console.error('[NotebookAI] Tag suggestion failed:', e); }
                  finally { setIsSuggestingTags(false); }
                }}
                disabled={isSuggestingTags || (!content && !title)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 transition-all active:scale-95 ${isSuggestingTags
                  ? 'bg-violet-500/20 text-violet-400 cursor-wait'
                  : (!content && !title)
                    ? (isLight ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white/5 text-slate-600 cursor-not-allowed')
                    : 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md hover:shadow-lg'
                }`}
              >
                <i className={`fa-solid ${isSuggestingTags ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[8px]`} />
                {isSuggestingTags ? '推荐中...' : 'AI 推荐'}
              </button>
            </div>
            {/* AI 推荐标签展示 */}
            {suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[7px] font-black uppercase tracking-widest mr-1 ${isLight ? 'text-violet-400' : 'text-violet-500'}`}>AI 推荐</span>
                {suggestedTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setTags(prev => [...prev, tag]); setSuggestedTags(prev => prev.filter(t => t !== tag)); }}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all active:scale-95 border border-dashed ${isLight ? 'border-violet-300 text-violet-500 bg-violet-50 hover:bg-violet-100' : 'border-violet-500/30 text-violet-300 bg-violet-500/10 hover:bg-violet-500/20'}`}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {type === 'experiment' ? '实验日志' : '内容 (Markdown)'}
              </span>
              <div className="flex items-center gap-2">
                {type === 'experiment' && (
                  <button
                    onClick={() => {
                      if (!useStructuredForm && content) {
                        // Parse existing content into structured fields if possible
                      }
                      setUseStructuredForm(!useStructuredForm);
                    }}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-lg transition-all ${useStructuredForm ? 'bg-blue-600 text-white' : isLight ? 'text-blue-500 hover:bg-blue-50' : 'text-blue-400 hover:bg-blue-500/10'}`}
                  >
                    <i className="fa-solid fa-table-cells text-[8px] mr-1" />
                    {useStructuredForm ? '结构化' : '切换表单'}
                  </button>
                )}
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-lg transition-all ${showPreview ? 'bg-indigo-600 text-white' : isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-white/5'}`}
                >
                  {showPreview ? '编辑' : '预览'}
                </button>
              </div>
            </div>

            {/* ═══ 实验日志结构化表单 ═══ */}
            {type === 'experiment' && useStructuredForm ? (
              <div className="space-y-3">
                {[
                  { key: 'objective' as const, label: '🎯 实验目标', placeholder: '本实验的目标是...', rows: 2 },
                  { key: 'materials' as const, label: '🧪 材料与仪器', placeholder: '列出所需材料、试剂、设备...', rows: 3 },
                  { key: 'procedure' as const, label: '📝 实验步骤', placeholder: '1. 第一步\n2. 第二步\n3. ...', rows: 4 },
                  { key: 'results' as const, label: '📊 实验结果', placeholder: '记录实验数据、观察结果...', rows: 3 },
                  { key: 'conclusion' as const, label: '💡 讨论与结论', placeholder: '分析结果、得出结论、下一步计划...', rows: 3 },
                ].map(field => (
                  <div key={field.key}>
                    <span className={`text-[9px] font-black block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{field.label}</span>
                    <textarea
                      value={experimentData[field.key]}
                      onChange={e => {
                        const updated = { ...experimentData, [field.key]: e.target.value };
                        setExperimentData(updated);
                        // 同步到 content
                        setContent(`## 实验目标\n${updated.objective}\n\n## 材料与仪器\n${updated.materials}\n\n## 实验步骤\n${updated.procedure}\n\n## 实验结果\n${updated.results}\n\n## 讨论与结论\n${updated.conclusion}`);
                      }}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      className={`w-full px-3 py-2 rounded-xl border text-[11px] font-medium leading-relaxed outline-none resize-none transition-all ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-300' : 'bg-white/5 border-white/10 text-white focus:border-blue-500'}`}
                    />
                  </div>
                ))}
              </div>
            ) : showPreview ? (
              <div className={`w-full min-h-[200px] p-4 rounded-2xl border prose prose-sm max-w-none ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-slate-200'}`}>
                <pre className="whitespace-pre-wrap text-[12px] font-medium leading-relaxed">{content || '暂无内容...'}</pre>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="在这里记录你的想法、实验笔记、文献阅读心得..."
                rows={10}
                className={`w-full px-4 py-3 rounded-2xl border text-[12px] font-medium leading-relaxed outline-none resize-y transition-all ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-300' : 'bg-white/5 border-white/10 text-white focus:border-indigo-500'}`}
              />
            )}
          </div>

          {/* ═══ 文献批注同步区域 ═══ */}
          {type === 'reading' && (
            <div className={`rounded-2xl border p-4 ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <i className={`fa-solid fa-highlighter text-[10px] ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-emerald-600' : 'text-emerald-300'}`}>文献批注同步</span>
                </div>
                <button
                  onClick={async () => {
                    if (isSyncingAnnotations) return;
                    setIsSyncingAnnotations(true);
                    try {
                      const newAnnotations: SyncedAnnotation[] = [];
                      linkedLiteratureIds.forEach(litId => {
                        const lit = resources.find((r: any) => r.id === litId);
                        if (lit && (lit as any).annotations) {
                          ((lit as any).annotations as any[]).forEach((ann: any) => {
                            if (!syncedAnnotations.some(sa => sa.text === ann.selectedText && sa.literatureId === litId)) {
                              newAnnotations.push({
                                text: ann.selectedText,
                                note: ann.note || '',
                                color: ann.color || 'yellow',
                                literatureId: litId,
                                literatureTitle: (lit as any).title,
                                timestamp: ann.timestamp || new Date().toISOString(),
                              });
                            }
                          });
                        }
                      });
                      if (newAnnotations.length > 0) {
                        setSyncedAnnotations(prev => [...prev, ...newAnnotations]);
                        const annotationMd = newAnnotations.map(a => `> 「${a.text}」\n> —— ${a.literatureTitle || '文献'}${a.note ? `\n> 📝 ${a.note}` : ''}`).join('\n\n');
                        setContent(prev => prev + `\n\n---\n## 📚 同步批注\n\n${annotationMd}`);
                      }
                    } finally { setIsSyncingAnnotations(false); }
                  }}
                  disabled={isSyncingAnnotations || linkedLiteratureIds.length === 0}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-1 transition-all active:scale-95 ${isSyncingAnnotations
                    ? 'bg-emerald-500/20 text-emerald-400 cursor-wait'
                    : linkedLiteratureIds.length === 0
                      ? (isLight ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white/5 text-slate-600 cursor-not-allowed')
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  <i className={`fa-solid ${isSyncingAnnotations ? 'fa-spinner fa-spin' : 'fa-download'} text-[8px]`} />
                  {isSyncingAnnotations ? '同步中...' : '同步批注'}
                </button>
              </div>
              {linkedLiteratureIds.length === 0 && (
                <p className={`text-[9px] font-bold ${isLight ? 'text-emerald-400' : 'text-emerald-500'}`}>
                  <i className="fa-solid fa-info-circle text-[8px] mr-1" />请先在下方「关联文献」中链接文献
                </p>
              )}
              {syncedAnnotations.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                  {syncedAnnotations.slice(0, 5).map((sa, i) => (
                    <div key={i} className={`px-3 py-1.5 rounded-lg text-[9px] ${isLight ? 'bg-white/80' : 'bg-black/20'}`}>
                      <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>「{sa.text.slice(0, 60)}{sa.text.length > 60 ? '...' : ''}」</span>
                      {sa.note && <span className={`block text-[8px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>📝 {sa.note}</span>}
                    </div>
                  ))}
                  {syncedAnnotations.length > 5 && (
                    <span className={`text-[8px] font-bold ${isLight ? 'text-emerald-400' : 'text-emerald-500'}`}>… 及其他 {syncedAnnotations.length - 5} 条</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ AI 摘要区域 ═══ */}
          {aiSummary && (
            <div className={`rounded-2xl border p-3 ${isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <i className={`fa-solid fa-bolt text-[10px] ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-amber-600' : 'text-amber-300'}`}>AI 摘要</span>
                <button
                  onClick={() => setAiSummary('')}
                  className={`ml-auto text-[8px] ${isLight ? 'text-slate-400 hover:text-rose-500' : 'text-slate-500 hover:text-rose-400'}`}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <p className={`text-[11px] font-medium leading-relaxed ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>{aiSummary}</p>
            </div>
          )}

          {/* ═══ 附件区域 ═══ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-[8px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                附件 {attachments.length > 0 && `(${attachments.length})`}
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
              >
                <i className="fa-solid fa-paperclip text-[8px]" />
                添加文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {attachments.length > 0 && (
              <div className={`rounded-2xl border p-2 space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all group ${isLight ? 'hover:bg-white' : 'hover:bg-white/5'}`}
                  >
                    <i className={`fa-solid ${getFileIcon(att.mimeType)} text-[11px] ${
                      att.mimeType.startsWith('image/') ? (isLight ? 'text-emerald-500' : 'text-emerald-400') :
                      att.mimeType.includes('pdf') ? (isLight ? 'text-rose-500' : 'text-rose-400') :
                      (isLight ? 'text-blue-500' : 'text-blue-400')
                    }`} />
                    <span className={`flex-1 text-[10px] font-bold truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {att.name}
                    </span>
                    <span className={`text-[8px] font-bold shrink-0 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                      {formatFileSize(att.size)}
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all ${isLight ? 'hover:bg-rose-50 text-rose-400' : 'hover:bg-rose-500/20 text-rose-400'}`}
                    >
                      <i className="fa-solid fa-xmark text-[7px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Color Selector */}
          <div>
            <span className={`text-[8px] font-black uppercase tracking-widest block mb-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>颜色标记</span>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setColor('')}
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${!color ? 'border-indigo-500 scale-110' : 'border-slate-300 opacity-50 hover:opacity-100'}`}
              >
                <i className="fa-solid fa-ban text-[8px] text-slate-400" />
              </button>
              {CARD_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Linked Projects */}
          <div>
            <span className={`text-[8px] font-black uppercase tracking-widest block mb-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>关联课题</span>
            <div className="flex flex-wrap gap-1.5">
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLinkedProjectIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 ${linkedProjectIds.includes(p.id)
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <i className="fa-solid fa-vials text-[7px] mr-1" />
                  {p.title.length > 15 ? p.title.slice(0, 15) + '...' : p.title}
                </button>
              ))}
              {projects.length === 0 && <span className={`text-[9px] italic ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>暂无课题</span>}
            </div>
          </div>

          {/* Linked Literature */}
          {resources.length > 0 && (
            <div>
              <span className={`text-[8px] font-black uppercase tracking-widest block mb-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>关联文献 (最近 10 篇)</span>
              <div className="flex flex-wrap gap-1.5">
                {resources.slice(0, 10).map(r => (
                  <button
                    key={r.id}
                    onClick={() => setLinkedLiteratureIds(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 ${linkedLiteratureIds.includes(r.id)
                      ? 'bg-emerald-600 text-white shadow-md'
                      : isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <i className="fa-solid fa-book text-[7px] mr-1" />
                    {r.title.length > 20 ? r.title.slice(0, 20) + '...' : r.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Linked Notes */}
          {otherNotes.length > 0 && (
            <div>
              <span className={`text-[8px] font-black uppercase tracking-widest block mb-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>双向链接笔记</span>
              <div className="flex flex-wrap gap-1.5">
                {otherNotes.slice(0, 15).map(n => (
                  <button
                    key={n.id}
                    onClick={() => setLinkedNoteIds(prev => prev.includes(n.id) ? prev.filter(x => x !== n.id) : [...prev, n.id])}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 ${linkedNoteIds.includes(n.id)
                      ? 'bg-violet-600 text-white shadow-md'
                      : isLight ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    <i className="fa-solid fa-link text-[7px] mr-1" />
                    {n.title.length > 15 ? n.title.slice(0, 15) + '...' : n.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t shrink-0 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
          <div className="flex items-center gap-3">
            <span className={`text-[9px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {content.length} 字符
              {attachments.length > 0 && ` · ${attachments.length} 附件`}
            </span>
            {/* AI 摘要按钮 */}
            <button
              onClick={handleGenerateSummary}
              disabled={isSummarizing || content.trim().length < 20}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${isSummarizing
                ? 'bg-amber-500/20 text-amber-400 cursor-wait'
                : content.trim().length < 20
                  ? (isLight ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white/5 text-slate-600 cursor-not-allowed')
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:shadow-lg'
              }`}
            >
              <i className={`fa-solid ${isSummarizing ? 'fa-spinner fa-spin' : 'fa-bolt'} text-[8px]`} />
              {isSummarizing ? '生成中...' : 'AI 摘要'}
            </button>
            {/* AI 起草按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowDraftMenu(!showDraftMenu)}
                disabled={isDrafting || content.trim().length < 10}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all active:scale-95 ${isDrafting
                  ? 'bg-teal-500/20 text-teal-400 cursor-wait'
                  : content.trim().length < 10
                    ? (isLight ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white/5 text-slate-600 cursor-not-allowed')
                    : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md hover:shadow-lg'
                }`}
              >
                <i className={`fa-solid ${isDrafting ? 'fa-spinner fa-spin' : 'fa-pen-fancy'} text-[8px]`} />
                {isDrafting ? '起草中...' : 'AI 起草'}
              </button>
              {showDraftMenu && !isDrafting && (
                <div className={`absolute bottom-full left-0 mb-1 rounded-xl border shadow-xl overflow-hidden z-10 ${isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/10'}`}>
                  {[
                    { type: 'review' as const, label: '文献综述段落', icon: 'fa-book-open' },
                    { type: 'experiment' as const, label: '实验方案草稿', icon: 'fa-flask' },
                  ].map(opt => (
                    <button
                      key={opt.type}
                      onClick={async () => {
                        setShowDraftMenu(false);
                        setIsDrafting(true);
                        try {
                          const linkedNoteContents = linkedNoteIds.map(id => allNotes.find(n => n.id === id)?.content || '').filter(Boolean);
                          const litInfos = linkedLiteratureIds.map(id => {
                            const lit = resources.find((r: any) => r.id === id) as any;
                            return lit ? { title: lit.title || '', authors: lit.authors, abstract: lit.abstract } : null;
                          }).filter(Boolean) as any[];
                          const draft = await generateDraftFromNotes({ noteContents: [content, ...linkedNoteContents], literatureInfos: litInfos, draftType: opt.type });
                          setContent(prev => prev + `\n\n---\n## 🤖 AI 起草（${opt.label}）\n\n${draft}`);
                        } catch (e) { console.error('[NotebookAI] Draft failed:', e); }
                        finally { setIsDrafting(false); }
                      }}
                      className={`w-full px-4 py-2 text-left text-[10px] font-bold flex items-center gap-2 transition-all ${isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-slate-300'}`}
                    >
                      <i className={`fa-solid ${opt.icon} text-[9px]`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              取消
            </button>
            <button onClick={handleSave} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg hover:shadow-xl transition-all active:scale-95">
              <i className="fa-solid fa-check text-[8px] mr-1.5" />
              保存笔记
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteEditorModal;
