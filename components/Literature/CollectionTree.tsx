import React, { useState } from 'react';
import type { LiteratureCollection } from '../../types';

interface CollectionTreeProps {
  collections: LiteratureCollection[];
  selectedCollectionId: string | null;
  onSelectCollection: (id: string | null) => void;
  onAddCollection: (name: string, parentId?: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  resourceCountMap: Record<string, number>;  // collectionId → count
  totalCount: number;
}

const COLLECTION_COLORS: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  sky: 'bg-sky-100 text-sky-600',
  purple: 'bg-purple-100 text-purple-600',
  slate: 'bg-slate-100 text-slate-500',
};

const COLOR_KEYS = Object.keys(COLLECTION_COLORS);

const CollectionTree: React.FC<CollectionTreeProps> = ({
  collections, selectedCollectionId, onSelectCollection,
  onAddCollection, onRenameCollection, onDeleteCollection,
  resourceCountMap, totalCount,
}) => {
  const [newName, setNewName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addParentId, setAddParentId] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddCollection(newName.trim(), addParentId);
    setNewName('');
    setShowAddForm(false);
    setAddParentId(undefined);
  };

  const handleRename = (id: string) => {
    if (!editingName.trim()) return;
    onRenameCollection(id, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  // Build tree structure
  const topLevel = collections.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const getChildren = (parentId: string) => collections.filter(c => c.parentId === parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const renderNode = (col: LiteratureCollection, depth: number = 0) => {
    const children = getChildren(col.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isSelected = selectedCollectionId === col.id;
    const count = resourceCountMap[col.id] || 0;
    const colorClass = COLLECTION_COLORS[col.color || 'slate'] || COLLECTION_COLORS.slate;

    return (
      <div key={col.id}>
        <div
          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all relative ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onSelectCollection(isSelected ? null : col.id)}
          onContextMenu={e => { e.preventDefault(); setContextMenuId(contextMenuId === col.id ? null : col.id); }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button onClick={e => { e.stopPropagation(); toggleExpand(col.id); }} className="w-4 h-4 flex items-center justify-center text-[8px] text-slate-400 hover:text-slate-600 shrink-0">
              <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
            </button>
          ) : <span className="w-4 shrink-0"></span>}

          {/* Icon */}
          <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] shrink-0 ${isSelected ? 'bg-indigo-500 text-white' : colorClass}`}>
            <i className={`fa-solid ${col.icon || 'fa-folder'}`}></i>
          </div>

          {/* Name */}
          {editingId === col.id ? (
            <input
              autoFocus
              className="flex-1 text-[10px] font-bold bg-white border border-indigo-300 rounded px-1.5 py-0.5 outline-none"
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(col.id); if (e.key === 'Escape') setEditingId(null); }}
              onBlur={() => handleRename(col.id)}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-[10px] font-bold truncate">{col.name}</span>
          )}

          {/* Count */}
          <span className={`text-[8px] font-bold shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-300'}`}>{count}</span>

          {/* Context Menu Trigger */}
          <button
            onClick={e => { e.stopPropagation(); setContextMenuId(contextMenuId === col.id ? null : col.id); }}
            className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>

        {/* Context Menu */}
        {contextMenuId === col.id && (
          <div className="ml-10 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 p-1 z-50 animate-reveal">
            <button onClick={() => { setAddParentId(col.id); setShowAddForm(true); setContextMenuId(null); }} className="w-full text-left px-2 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-50 rounded flex items-center gap-1.5">
              <i className="fa-solid fa-folder-plus text-emerald-500"></i>添加子集合
            </button>
            <button onClick={() => { setEditingId(col.id); setEditingName(col.name); setContextMenuId(null); }} className="w-full text-left px-2 py-1 text-[9px] font-bold text-slate-600 hover:bg-slate-50 rounded flex items-center gap-1.5">
              <i className="fa-solid fa-pen text-amber-500"></i>重命名
            </button>
            <button onClick={() => { onDeleteCollection(col.id); setContextMenuId(null); }} className="w-full text-left px-2 py-1 text-[9px] font-bold text-rose-500 hover:bg-rose-50 rounded flex items-center gap-1.5">
              <i className="fa-solid fa-trash-can"></i>删除
            </button>
          </div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">文献集合</p>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setAddParentId(undefined); }}
          className="w-5 h-5 rounded flex items-center justify-center text-[9px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
        >
          <i className="fa-solid fa-plus"></i>
        </button>
      </div>

      {/* "All" button */}
      <div
        onClick={() => onSelectCollection(null)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${selectedCollectionId === null ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
      >
        <span className="w-4 shrink-0"></span>
        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] shrink-0 ${selectedCollectionId === null ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
          <i className="fa-solid fa-layer-group"></i>
        </div>
        <span className="flex-1 text-[10px] font-bold">全部文献</span>
        <span className={`text-[8px] font-bold ${selectedCollectionId === null ? 'text-indigo-500' : 'text-slate-300'}`}>{totalCount}</span>
      </div>

      {/* Tree */}
      {topLevel.map(col => renderNode(col))}

      {/* Add Form */}
      {showAddForm && (
        <div className="mx-2 bg-slate-50 rounded-lg p-2 border border-slate-200" onClick={e => e.stopPropagation()}>
          {addParentId && (
            <p className="text-[7px] text-indigo-500 font-bold mb-1">
              <i className="fa-solid fa-arrow-turn-down-right mr-1"></i>
              添加到: {collections.find(c => c.id === addParentId)?.name}
            </p>
          )}
          <div className="flex gap-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddForm(false); }}
              placeholder="集合名称..."
              className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-200"
            />
            <button onClick={handleAdd} disabled={!newName.trim()} className="px-2 py-1 bg-indigo-600 text-white rounded text-[9px] font-black disabled:opacity-30">
              <i className="fa-solid fa-check"></i>
            </button>
          </div>
        </div>
      )}

      {/* Uncollected (virtual) */}
      {collections.length > 0 && (
        <div
          onClick={() => onSelectCollection('__uncollected__')}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${selectedCollectionId === '__uncollected__' ? 'bg-slate-200 text-slate-700' : 'hover:bg-slate-50 text-slate-400'}`}
        >
          <span className="w-4 shrink-0"></span>
          <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] shrink-0 ${selectedCollectionId === '__uncollected__' ? 'bg-slate-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <i className="fa-solid fa-inbox"></i>
          </div>
          <span className="flex-1 text-[10px] font-bold italic">未归集</span>
          <span className="text-[8px] font-bold text-slate-300">{resourceCountMap['__uncollected__'] || 0}</span>
        </div>
      )}
    </div>
  );
};

export default CollectionTree;
