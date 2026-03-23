/**
 * NoteKanbanView — 研究阶段看板（Kanban）
 * 4 列拖拽式看板：灵感 → 实验中 → 有结果 → 已发表
 */
import React, { useState, useCallback } from 'react';
import { NotebookNote, NoteType, NoteResearchStage } from '../../types/notebook';

const NOTE_TYPE_META: Record<NoteType, { label: string; icon: string; color: string }> = {
  thought: { label: '灵感', icon: 'fa-lightbulb', color: '#a855f7' },
  meeting: { label: '会议', icon: 'fa-users', color: '#f59e0b' },
  reading: { label: '阅读', icon: 'fa-book', color: '#22c55e' },
  experiment: { label: '实验', icon: 'fa-flask', color: '#3b82f6' },
  idea: { label: '想法', icon: 'fa-rocket', color: '#ec4899' },
};

const KANBAN_COLUMNS: { stage: NoteResearchStage; label: string; icon: string; gradient: string; borderColor: string }[] = [
  { stage: 'idea', label: '💡 灵感', icon: 'fa-lightbulb', gradient: 'from-violet-500/20 to-purple-500/10', borderColor: 'border-violet-500/30' },
  { stage: 'experimenting', label: '🧪 实验中', icon: 'fa-flask', gradient: 'from-blue-500/20 to-cyan-500/10', borderColor: 'border-blue-500/30' },
  { stage: 'results', label: '📊 有结果', icon: 'fa-chart-column', gradient: 'from-emerald-500/20 to-green-500/10', borderColor: 'border-emerald-500/30' },
  { stage: 'published', label: '📄 已发表', icon: 'fa-trophy', gradient: 'from-amber-500/20 to-orange-500/10', borderColor: 'border-amber-500/30' },
];

interface NoteKanbanViewProps {
  notes: NotebookNote[];
  isLight: boolean;
  onSelectNote: (note: NotebookNote) => void;
  onStageChange: (noteId: string, stage: NoteResearchStage) => void;
}

const NoteKanbanView: React.FC<NoteKanbanViewProps> = ({ notes, isLight, onSelectNote, onStageChange }) => {
  const [dragOverColumn, setDragOverColumn] = useState<NoteResearchStage | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('noteId', noteId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(noteId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: NoteResearchStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stage: NoteResearchStage) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      onStageChange(noteId, stage);
    }
    setDragOverColumn(null);
    setDraggingId(null);
  }, [onStageChange]);

  const handleDragEnd = useCallback(() => {
    setDragOverColumn(null);
    setDraggingId(null);
  }, []);

  // Group notes by stage (default to 'idea' if no stage set)
  const columnNotes = KANBAN_COLUMNS.map(col => ({
    ...col,
    notes: notes.filter(n => (n.researchStage || 'idea') === col.stage),
  }));

  return (
    <div className="grid grid-cols-4 gap-4 h-[calc(100vh-280px)] min-h-[400px]">
      {columnNotes.map(col => (
        <div
          key={col.stage}
          onDragOver={e => handleDragOver(e, col.stage)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, col.stage)}
          className={`flex flex-col rounded-2xl border transition-all duration-200 ${
            dragOverColumn === col.stage
              ? (isLight ? 'border-indigo-400 bg-indigo-50/50 shadow-lg shadow-indigo-200/30' : 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10')
              : (isLight ? 'border-slate-200 bg-slate-50/50' : `border-white/[0.06] bg-gradient-to-b ${col.gradient}`)
          }`}
        >
          {/* Column header */}
          <div className={`px-4 py-3 border-b shrink-0 ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-black ${isLight ? 'text-slate-700' : 'text-white'}`}>
                {col.label}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-slate-400'}`}>
                {col.notes.length}
              </span>
            </div>
          </div>

          {/* Cards area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {col.notes.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-8 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                <i className={`fa-solid ${col.icon} text-lg mb-2 opacity-30`} />
                <span className="text-[9px] font-bold">拖拽笔记到此列</span>
              </div>
            ) : (
              col.notes.map(note => {
                const meta = NOTE_TYPE_META[note.type];
                return (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={e => handleDragStart(e, note.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelectNote(note)}
                    className={`rounded-xl border p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                      draggingId === note.id ? 'opacity-40 scale-95' : ''
                    } ${isLight
                      ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                      : 'bg-white/[0.04] border-white/[0.08] hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/5'
                    }`}
                  >
                    {/* Type badge */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded" style={{ color: meta.color, backgroundColor: meta.color + '20' }}>
                        <i className={`fa-solid ${meta.icon} text-[6px] mr-0.5`} />
                        {meta.label}
                      </span>
                      {note.isPinned && <i className="fa-solid fa-thumbtack text-[7px] text-indigo-400" />}
                    </div>

                    {/* Title */}
                    <h4 className={`text-[11px] font-bold leading-snug line-clamp-2 mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {note.title || '无标题'}
                    </h4>

                    {/* Content preview */}
                    <p className={`text-[9px] font-medium leading-relaxed line-clamp-2 mb-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {note.content.slice(0, 80) || '暂无内容'}
                    </p>

                    {/* Footer: tags + time */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 overflow-hidden">
                        {note.tags.slice(0, 2).map(tag => (
                          <span key={tag} className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${isLight ? 'bg-indigo-50 text-indigo-500' : 'bg-indigo-500/15 text-indigo-300'}`}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <span className={`text-[7px] font-bold shrink-0 ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
                        {new Date(note.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NoteKanbanView;
