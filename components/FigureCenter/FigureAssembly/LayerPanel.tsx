import React, { useState, useRef } from 'react';
import { FigurePanel, FigureText, FigureShape } from '../../../types';

// ─── Types ───────────────────────────────────────────────────────────────────
type LayerTarget =
    | { scope: 'panel'; panelId: string }
    | { scope: 'text'; panelId: string; textId: string }
    | { scope: 'shape'; panelId: string; shapeId: string };

interface LayerPanelProps {
    panels: FigurePanel[];
    activePanelId: string | null;
    selectedText: { panelId: string; textId: string } | null;
    selectedShape: { panelId: string; shapeId: string } | null;
    onSelectPanel: (id: string) => void;
    onSelectText: (panelId: string, textId: string) => void;
    onSelectShape: (panelId: string, shapeId: string) => void;
    onUpdatePanel: (id: string, updates: Partial<FigurePanel>) => void;
    onUpdateText: (panelId: string, textId: string, updates: Partial<FigureText>) => void;
    onUpdateShape: (panelId: string, shapeId: string, updates: Partial<FigureShape>) => void;
    onReorderPanels: (newPanels: FigurePanel[]) => void;
}

// ─── Enhanced Icons ──────────────────────────────────────────────────────────
const IconEye = ({ visible, size = 14 }: { visible: boolean; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${visible ? 'text-indigo-400' : 'text-slate-500 opacity-40'}`}>
        {visible ? (
            <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" />
            </>
        ) : (
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        )}
    </svg>
);

const IconLock = ({ locked, size = 14 }: { locked: boolean; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-all duration-300 ${locked ? 'text-amber-400' : 'text-slate-500 opacity-40'}`}>
        {locked ? (
            <>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" fillOpacity="0.2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </>
        ) : (
            <>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </>
        )}
    </svg>
);

const IconChevron = ({ expanded, size = 10 }: { expanded: boolean; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${expanded ? 'rotate-90 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

// ─── Layer Row ────────────────────────────────────────────────────────────────
interface LayerRowProps {
    label: string;
    icon: React.ReactNode;
    color: string;
    isActive: boolean;
    visible: boolean;
    locked: boolean;
    opacity: number;
    indent?: boolean;
    draggable?: boolean;
    hasChildren?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    onSelect: () => void;
    onToggleVisible: (e: React.MouseEvent) => void;
    onToggleLock: (e: React.MouseEvent) => void;
    onOpacityChange: (val: number) => void;
    onRename: (name: string) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
}

const LayerRow: React.FC<LayerRowProps> = ({
    label, icon, color, isActive, visible, locked, opacity, indent,
    hasChildren, isExpanded, onToggleExpand,
    onSelect, onToggleVisible, onToggleLock, onOpacityChange, onRename,
    draggable, onDragStart, onDragOver, onDrop
}) => {
    const [editing, setEditing] = useState(false);
    const [editVal, setEditVal] = useState(label);
    const [showOpacity, setShowOpacity] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDoubleClick = () => {
        setEditVal(label);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 50);
    };

    const commitRename = () => {
        setEditing(false);
        if (editVal.trim() && editVal !== label) onRename(editVal.trim());
        else setEditVal(label);
    };

    return (
        <div
            draggable={draggable && !locked}
            onDragStart={onDragStart}
            onDragOver={(e) => { e.preventDefault(); onDragOver?.(e); }}
            onDrop={onDrop}
            onClick={onSelect}
            className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer transition-all duration-300 select-none border-l-2
        ${isActive
                    ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.1)]'
                    : 'hover:bg-white/5 border-transparent'}
        ${indent ? 'ml-4' : ''}
        ${!visible ? 'grayscale-[0.5]' : ''}
      `}
        >
            {/* Expand/Collapse Toggle */}
            {hasChildren && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                    className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors shrink-0"
                >
                    <IconChevron expanded={isExpanded ?? false} />
                </button>
            )}
            {!hasChildren && indent && <div className="w-5 shrink-0" />}

            {/* Layer Thumbnail/Icon */}
            <div
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 relative"
                style={{
                    background: `linear-gradient(135deg, ${color}30, ${color}10)`,
                    border: `1px solid ${color}40`
                }}
            >
                <span style={{ color }} className="text-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{icon}</span>
                {isActive && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-slate-900" style={{ backgroundColor: color }} />
                )}
            </div>

            {/* Name Content */}
            <div className="flex-1 min-w-0 flex flex-col">
                {editing ? (
                    <input
                        ref={inputRef}
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setEditVal(label); } }}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-slate-800/95 text-white text-[11px] font-black px-2 py-1 rounded-lg outline-none border-2 border-indigo-500/50 shadow-2xl animate-precision-glow"
                    />
                ) : (
                    <div className="flex flex-col">
                        <span
                            onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(); }}
                            className={`block truncate text-[11px] font-black transition-colors ${isActive ? 'text-indigo-100' : 'text-slate-300 group-hover:text-white'}`}
                            title={label}
                        >
                            {label}
                        </span>
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {Math.round(opacity * 100)}% 透明度
                        </span>
                    </div>
                )}
            </div>

            {/* Interactive Controls */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                {/* Opacity switch */}
                <button
                    onClick={(e) => { e.stopPropagation(); setShowOpacity(v => !v); }}
                    className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg transition-all ${showOpacity
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'hover:bg-white/10 text-slate-400 hover:text-indigo-200'
                        }`}
                >
                    <span className="text-[8px] font-black">{Math.round(opacity * 100)}</span>
                    <div className="w-3 h-0.5 rounded-full bg-current mt-0.5 opacity-30" />
                </button>

                {/* Lock switch */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleLock(e); }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${locked
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'hover:bg-white/10 text-slate-400 hover:text-amber-200'
                        }`}
                >
                    <IconLock locked={locked} />
                </button>

                {/* Visibility switch */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisible(e); }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${visible
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'hover:bg-white/10 text-slate-400 hover:text-emerald-200'
                        }`}
                >
                    <IconEye visible={visible} />
                </button>
            </div>

            {/* Glassmorphism Opacity Popover */}
            {showOpacity && (
                <div
                    className="absolute right-0 top-full mt-2 z-[100] bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-lg p-4 w-56 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-reveal overflow-visible"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-white/40 uppercase tracking-widest font-black italic">透明通道</span>
                            <span className="text-[10px] text-indigo-300 font-bold uppercase mt-0.5">透明度控制</span>
                        </div>
                        <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-400/20 px-2 py-1 rounded-xl shadow-inner font-mono">
                            {Math.round(opacity * 100)}%
                        </span>
                    </div>
                    <div className="relative group/slider">
                        <input
                            type="range"
                            min={0} max={100} step={1}
                            value={Math.round(opacity * 100)}
                            onChange={e => onOpacityChange(parseInt(e.target.value) / 100)}
                            className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer hover:bg-white/10 transition-all
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4
                [&::-webkit-slider-thumb]:border-indigo-500 [&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(99,102,241,0.5)]
                [&::-webkit-slider-thumb]:cursor-grabbing [&::-webkit-slider-thumb]:transition-all
                "
                        />
                        <div
                            className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full pointer-events-none group-hover/slider:brightness-125 transition-all"
                            style={{ width: `${opacity * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-3 text-[7px] text-white/20 font-black uppercase tracking-widest italic">
                        <span>最低</span>
                        <span>均衡</span>
                        <span>完全不透明</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main LayerPanel ──────────────────────────────────────────────────────────
export const LayerPanel: React.FC<LayerPanelProps> = ({
    panels, activePanelId, selectedText, selectedShape,
    onSelectPanel, onSelectText, onSelectShape,
    onUpdatePanel, onUpdateText, onUpdateShape, onReorderPanels
}) => {
    const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const [filter, setFilter] = useState('');

    const toggleExpand = (id: string) => {
        setExpandedPanels(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const sortedPanels = [...panels].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

    const filteredPanels = sortedPanels.filter(p =>
        !filter || p.name?.toLowerCase().includes(filter.toLowerCase()) ||
        p.texts?.some(t => t.content.toLowerCase().includes(filter.toLowerCase())) ||
        p.shapes?.some(s => s.type.toLowerCase().includes(filter.toLowerCase()))
    );

    const handlePanelDragStart = (e: React.DragEvent, idx: number) => {
        setDragIndex(idx);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handlePanelDrop = (e: React.DragEvent, dropIdx: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === dropIdx) { setDragIndex(null); setDropIndex(null); return; }
        const reordered = [...sortedPanels];
        const [moved] = reordered.splice(dragIndex, 1);
        reordered.splice(dropIdx, 0, moved);
        const reassigned = reordered.map((p, i) => ({ ...p, zIndex: reordered.length - i }));
        const finalPanels = panels.map(p => {
            const found = reassigned.find(r => r.id === p.id);
            return found ? { ...p, zIndex: found.zIndex } : p;
        });
        onReorderPanels(finalPanels);
        setDragIndex(null);
        setDropIndex(null);
    };

    const getShapeIcon = (type: string) => {
        if (type === 'arrow') return '↗';
        if (type === 'line') return '—';
        if (type === 'rect') return '🔲';
        if (type === 'circle') return '🟢';
        return '💠';
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-xl border-l border-white/5 relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

            {/* Header */}
            <div className="relative px-5 py-4 border-b border-white/10 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-white/10 flex items-center justify-center shadow-[0_10px_30px_rgba(79,70,229,0.3)] group cursor-help">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="group-hover:rotate-12 transition-transform duration-500">
                                <rect x="2" y="7" width="20" height="13" rx="2" />
                                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[13px] font-black uppercase tracking-[0.2em] text-white">图层</span>
                            <span className="text-[8px] text-slate-500 font-black tracking-widest uppercase flex items-center gap-1.5 mt-0.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                拼版图层管理
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md shadow-inner">
                            <span className="text-[11px] text-indigo-400 font-black font-mono tracking-tighter">{panels.length}</span>
                            <span className="text-[8px] text-slate-500 font-bold ml-1.5 uppercase">个</span>
                        </div>
                    </div>
                </div>

                {/* Search/Filter Bar */}
                <div className="relative group/search">
                    <input
                        type="text"
                        placeholder="搜索图层..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full bg-slate-800/40 border border-white/5 rounded-xl px-9 py-2 text-[10px] font-black text-white outline-none focus:border-indigo-500/50 focus:bg-slate-800 transition-all placeholder:text-slate-600 shadow-inner"
                    />
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 group-focus-within/search:text-indigo-400 transition-colors" />
                    {filter && (
                        <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                            <i className="fa-solid fa-circle-xmark text-[10px]" />
                        </button>
                    )}
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white/2 border-b border-white/5 z-10">
                <div className="flex-1 text-[8px] text-slate-500 uppercase tracking-[0.3em] font-black italic">组合层级</div>
                <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800 border border-white/10" />
                    <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest">控制</span>
                </div>
            </div>

            {/* Scrollable Layer Stack */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 z-10 custom-scrollbar">
                {filteredPanels.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-600 animate-pulse">
                        <div className="w-20 h-20 rounded-full bg-slate-800/50 border border-white/5 flex items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black uppercase tracking-widest italic">{filter ? '未匹配到结果' : '图层堆栈为空'}</p>
                            <p className="text-[9px] font-bold text-slate-700 mt-1 uppercase tracking-wider">{filter ? '请尝试重置过滤器' : '从素材库拖入图像开始'}</p>
                        </div>
                    </div>
                )}

                {filteredPanels.map((panel, sortedIdx) => {
                    const globalIdx = panels.findIndex(p => p.id === panel.id);
                    const isActive = activePanelId === panel.id;
                    const isExpanded = expandedPanels.has(panel.id);
                    const hasChildren = (panel.texts?.length ?? 0) + (panel.shapes?.length ?? 0) > 0;
                    const visible = panel.visible !== false;
                    const locked = panel.locked === true;
                    const opacity = panel.opacity ?? 1;
                    const isDragOver = dropIndex === sortedIdx;

                    return (
                        <div key={panel.id} className="animate-reveal">
                            {/* Vertical Drop Line Visualizer */}
                            {isDragOver && dragIndex !== null && (
                                <div className="h-0.5 bg-indigo-500/80 rounded-full mx-4 my-2 shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-glow-pulse" />
                            )}

                            <div
                                className={`transition-all duration-300 ${isDragOver ? 'translate-x-1' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDropIndex(sortedIdx); }}
                            >
                                <LayerRow
                                    label={panel.name || `图层 ${panels.length - globalIdx}`}
                                    icon={<i className="fa-solid fa-image" />}
                                    color="#818cf8"
                                    isActive={isActive}
                                    visible={visible}
                                    locked={locked}
                                    opacity={opacity}
                                    draggable
                                    hasChildren={hasChildren}
                                    isExpanded={isExpanded}
                                    onToggleExpand={() => toggleExpand(panel.id)}
                                    onSelect={() => onSelectPanel(panel.id)}
                                    onToggleVisible={() => onUpdatePanel(panel.id, { visible: !visible })}
                                    onToggleLock={() => onUpdatePanel(panel.id, { locked: !locked })}
                                    onOpacityChange={(val) => onUpdatePanel(panel.id, { opacity: val })}
                                    onRename={(name) => onUpdatePanel(panel.id, { name })}
                                    onDragStart={(e) => handlePanelDragStart(e, sortedIdx)}
                                    onDragOver={(e) => { e.preventDefault(); setDropIndex(sortedIdx); }}
                                    onDrop={(e) => handlePanelDrop(e, sortedIdx)}
                                />
                            </div>

                            {/* Recursive Children Display */}
                            {isExpanded && hasChildren && (
                                <div className="ml-2 mt-1 space-y-1 relative border-l border-white/5 animate-reveal-down">
                                    {panel.texts?.map((text) => {
                                        const isTextActive = selectedText?.panelId === panel.id && selectedText?.textId === text.id;
                                        return (
                                            <LayerRow
                                                key={text.id}
                                                label={text.name || text.content.slice(0, 16) || '文本说明'}
                                                icon={<i className="fa-solid fa-font" />}
                                                color="#34d399"
                                                isActive={isTextActive}
                                                visible={text.visible !== false}
                                                locked={text.locked === true}
                                                opacity={text.opacity ?? 1}
                                                indent
                                                onSelect={() => onSelectText(panel.id, text.id)}
                                                onToggleVisible={() => onUpdateText(panel.id, text.id, { visible: text.visible === false })}
                                                onToggleLock={() => onUpdateText(panel.id, text.id, { locked: !text.locked })}
                                                onOpacityChange={(val) => onUpdateText(panel.id, text.id, { opacity: val })}
                                                onRename={(name) => onUpdateText(panel.id, text.id, { name })}
                                            />
                                        );
                                    })}

                                    {panel.shapes?.map((shape) => {
                                        const isShapeActive = selectedShape?.panelId === panel.id && selectedShape?.shapeId === shape.id;
                                        return (
                                            <LayerRow
                                                key={shape.id}
                                                label={shape.name || `矢量 ${shape.type.toUpperCase()}`}
                                                icon={<span className="font-black">{getShapeIcon(shape.type)}</span>}
                                                color="#fb923c"
                                                isActive={isShapeActive}
                                                visible={shape.visible !== false}
                                                locked={shape.locked === true}
                                                opacity={shape.opacity ?? 1}
                                                indent
                                                onSelect={() => onSelectShape(panel.id, shape.id)}
                                                onToggleVisible={() => onUpdateShape(panel.id, shape.id, { visible: shape.visible === false })}
                                                onToggleLock={() => onUpdateShape(panel.id, shape.id, { locked: !shape.locked })}
                                                onOpacityChange={(val) => onUpdateShape(panel.id, shape.id, { opacity: val })}
                                                onRename={(name) => onUpdateShape(panel.id, shape.id, { name })}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer / Summary Strip */}
            <div className="border-t border-white/10 px-6 py-5 bg-slate-950/40 z-10">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">图例</span>
                    <div className="h-px bg-white/5 flex-1 mx-4" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 group cursor-help">
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center transition-all group-hover:bg-indigo-500/20">
                            <i className="fa-solid fa-image text-[10px] text-indigo-400" />
                        </div>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">图片</span>
                    </div>
                    <div className="flex items-center gap-2.5 group cursor-help">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center transition-all group-hover:bg-emerald-500/20">
                            <i className="fa-solid fa-font text-[10px] text-emerald-400" />
                        </div>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">标签</span>
                    </div>
                    <div className="flex items-center gap-2.5 group cursor-help">
                        <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center transition-all group-hover:bg-orange-500/20">
                            <i className="fa-solid fa-shapes text-[10px] text-orange-400" />
                        </div>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">形状</span>
                    </div>
                    <div className="flex items-center gap-2.5 group cursor-help">
                        <div className="w-6 h-6 rounded-lg bg-slate-800/10 border border-slate-700/50 flex items-center justify-center transition-all group-hover:bg-slate-700/20">
                            <i className="fa-solid fa-lock text-[10px] text-slate-500" />
                        </div>
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">锁定</span>
                    </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500/50 blur-[2px] animate-pulse" />
                        <span className="text-[8px] text-indigo-400/80 font-black uppercase tracking-[0.2em]">图层系统</span>
                    </div>
                    <span className="text-[8px] text-slate-600 font-bold italic">双击可重命名图层</span>
                </div>
            </div>
        </div>
    );
};
