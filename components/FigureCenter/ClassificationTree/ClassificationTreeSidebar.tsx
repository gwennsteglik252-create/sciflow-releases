import React, { useState } from 'react';
import {
    ClassificationTreeData,
    ClassificationTreeNode,
    TreeLayoutDirection,
    SavedClassificationTree,
} from '../../../types/visuals';
import { ColorPickerWithPresets } from '../../DataAnalysis/Chart/ColorPickerWithPresets';
import { ACADEMIC_PALETTES } from '../Structure/constants';

// ============================================
// 分类树侧边栏 - 深度模仿结构图编辑功能
// ============================================

interface TreeSidebarProps {
    userPrompt: string;
    onUserPromptChange: (v: string) => void;
    isGenerating: boolean;
    onGenerate: () => void;
    onCreateEmpty: () => void;
    data: ClassificationTreeData | null;
    setData: (d: ClassificationTreeData | null) => void;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;
    onUpdateNode: (id: string, updates: Partial<ClassificationTreeNode>) => void;
    onDeleteNode: (id: string) => void;
    onAddChild: (parentId: string) => void;
    onToggleCollapse: (id: string) => void;
    onSetLayout: (l: TreeLayoutDirection) => void;
    aiLanguage: 'zh' | 'en';
    onAiLanguageChange: (l: 'zh' | 'en') => void;
    onExportPng: () => void;
    // Library
    savedTrees: SavedClassificationTree[];
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    onLoadSaved: (item: SavedClassificationTree) => void;
    onDeleteSaved: (id: string, e: React.MouseEvent) => void;
    onRenameSaved: (id: string, newTitle: string) => void;
    showSaveModal: boolean;
    setShowSaveModal: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    onConfirmSave: (asNew?: boolean) => void;
    onSaveToLibrary: () => void;
    // Undo/Redo
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const LAYOUT_OPTIONS: { value: TreeLayoutDirection; label: string; icon: string }[] = [
    { value: 'TB', label: '上→下', icon: 'fa-solid fa-arrow-down' },
    { value: 'LR', label: '左→右', icon: 'fa-solid fa-arrow-right' },
    { value: 'BT', label: '下→上', icon: 'fa-solid fa-arrow-up' },
    { value: 'RL', label: '右→左', icon: 'fa-solid fa-arrow-left' },
    { value: 'radial', label: '辐射', icon: 'fa-solid fa-circle-nodes' },
];

const ICON_OPTIONS = [
    'fa-solid fa-tag', 'fa-solid fa-bookmark', 'fa-solid fa-star', 'fa-solid fa-lightbulb',
    'fa-solid fa-gear', 'fa-solid fa-atom', 'fa-solid fa-microscope', 'fa-solid fa-flask',
    'fa-solid fa-dna', 'fa-solid fa-chart-line', 'fa-solid fa-database', 'fa-solid fa-server',
    'fa-solid fa-code', 'fa-solid fa-brain', 'fa-solid fa-network-wired', 'fa-solid fa-globe',
    'fa-solid fa-bolt', 'fa-solid fa-shield-halved', 'fa-solid fa-user-graduate', 'fa-solid fa-building-columns'
];

const SHAPE_OPTIONS: { value: 'rect' | 'circle' | 'diamond' | 'square'; icon: string; label: string }[] = [
    { value: 'rect', icon: 'fa-regular fa-square', label: '矩形' },
    { value: 'circle', icon: 'fa-regular fa-circle', label: '圆形' },
    { value: 'diamond', icon: 'fa-solid fa-diamond', label: '菱形' },
    { value: 'square', icon: 'fa-solid fa-square', label: '方块' },
];

interface NodeMeta {
    found: ClassificationTreeNode | null;
    parent: ClassificationTreeNode | null;
    levelNodes: ClassificationTreeNode[];
}

function findNodeAndMeta(root: ClassificationTreeNode, id: string): NodeMeta {
    let found: ClassificationTreeNode | null = null;
    let parent: ClassificationTreeNode | null = null;
    let levelNodes: ClassificationTreeNode[] = [];

    // Find target depth first
    let targetDepth: number | null = null;
    function findDepth(node: ClassificationTreeNode, depth: number) {
        if (node.id === id) { targetDepth = depth; found = node; return; }
        if (node.children) node.children.forEach(c => findDepth(c, depth + 1));
    }
    findDepth(root, 0);

    // Collect info
    function traverse(node: ClassificationTreeNode, p: ClassificationTreeNode | null, depth: number) {
        if (targetDepth !== null && depth === targetDepth) {
            levelNodes.push(node);
        }
        if (node.id === id) {
            parent = p;
        }
        if (node.children) {
            for (const child of node.children) {
                traverse(child, node, depth + 1);
            }
        }
    }
    traverse(root, null, 0);

    return { found, parent, levelNodes };
}

// Helper: deep clone + move a child node up/down among siblings
function moveNodeInTree(root: ClassificationTreeNode, nodeId: string, direction: 'up' | 'down'): ClassificationTreeNode {
    const clone = JSON.parse(JSON.stringify(root)) as ClassificationTreeNode;
    function doMove(parent: ClassificationTreeNode): boolean {
        if (!parent.children) return false;
        const idx = parent.children.findIndex(c => c.id === nodeId);
        if (idx !== -1) {
            const swap = direction === 'up' ? idx - 1 : idx + 1;
            if (swap < 0 || swap >= parent.children.length) return false;
            [parent.children[idx], parent.children[swap]] = [parent.children[swap], parent.children[idx]];
            return true;
        }
        for (const child of parent.children) {
            if (doMove(child)) return true;
        }
        return false;
    }
    doMove(clone);
    return clone;
}

// Recursive topology outline node component
const TopologyOutlineNode: React.FC<{
    node: ClassificationTreeNode;
    depth: number;
    siblingCount: number;
    siblingIndex: number;
    levelColors: string[];
    selectedNodeId: string | null;
    onSelect: (id: string) => void;
    onToggleCollapse: (id: string) => void;
    onAddChild: (id: string) => void;
    onMoveNode: (id: string, dir: 'up' | 'down') => void;
    onDeleteNode: (id: string) => void;
}> = ({ node, depth, siblingCount, siblingIndex, levelColors, selectedNodeId, onSelect, onToggleCollapse, onAddChild, onMoveNode, onDeleteNode }) => {
    const color = levelColors[depth % levelColors.length] || '#6366f1';
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isRoot = depth === 0;

    return (
        <div className="select-none">
            <div
                onClick={() => onSelect(node.id)}
                className={`flex items-center gap-1 py-1 px-1.5 rounded-lg cursor-pointer transition-all group/topo border ${isSelected
                    ? 'border-opacity-100 shadow-sm'
                    : 'border-transparent hover:border-opacity-60'
                    }`}
                style={{
                    paddingLeft: `${depth * 12 + 6}px`,
                    backgroundColor: isSelected ? `${color}12` : undefined,
                    borderColor: isSelected ? `${color}50` : `${color}20`,
                }}
            >
                {/* Reorder arrows */}
                {!isRoot && (
                    <div className="flex flex-col shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => onMoveNode(node.id, 'up')}
                            disabled={siblingIndex === 0}
                            className="w-3.5 h-3 flex items-center justify-center rounded hover:bg-black/5 transition-all disabled:opacity-15"
                            style={{ color }}
                        >
                            <i className="fa-solid fa-chevron-up text-[5px]"></i>
                        </button>
                        <button
                            onClick={() => onMoveNode(node.id, 'down')}
                            disabled={siblingIndex >= siblingCount - 1}
                            className="w-3.5 h-3 flex items-center justify-center rounded hover:bg-black/5 transition-all disabled:opacity-15"
                            style={{ color }}
                        >
                            <i className="fa-solid fa-chevron-down text-[5px]"></i>
                        </button>
                    </div>
                )}

                {/* Collapse toggle */}
                {hasChildren ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                        className="w-3.5 h-3.5 shrink-0 flex items-center justify-center rounded transition-all hover:bg-black/5"
                        style={{ color }}
                    >
                        <i className={`fa-solid ${node.collapsed ? 'fa-caret-right' : 'fa-caret-down'} text-[8px]`}></i>
                    </button>
                ) : (
                    <div className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full" style={{ backgroundColor: color }}></div>
                    </div>
                )}

                {/* Icon + Label */}
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    <i className={`${node.icon || 'fa-solid fa-tag'} text-[7px]`} style={{ color }}></i>
                    <span
                        className={`text-[9px] truncate ${isSelected ? 'font-black' : 'font-bold'}`}
                        style={{ color: isSelected ? color : '#475569' }}
                    >
                        {node.label}
                    </span>
                </div>

                {/* Quick actions on hover */}
                <div className="flex gap-0.5 opacity-0 group-hover/topo:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => onAddChild(node.id)}
                        className="w-4 h-4 rounded flex items-center justify-center transition-all hover:scale-110"
                        style={{ color, backgroundColor: `${color}12` }}
                        title="添加子节点"
                    >
                        <i className="fa-solid fa-plus text-[6px]"></i>
                    </button>
                    {!isRoot && (
                        <button
                            onClick={() => onDeleteNode(node.id)}
                            className="w-4 h-4 rounded flex items-center justify-center text-rose-400 bg-rose-50 hover:bg-rose-500 hover:text-white transition-all hover:scale-110"
                            title="删除"
                        >
                            <i className="fa-solid fa-xmark text-[6px]"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Recursive children */}
            {hasChildren && !node.collapsed && (
                <div className="relative">
                    <div
                        className="absolute left-0 top-0 bottom-0 w-px opacity-15"
                        style={{ marginLeft: `${depth * 12 + 14}px`, backgroundColor: color }}
                    ></div>
                    {node.children!.map((child, idx) => (
                        <TopologyOutlineNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            siblingCount={node.children!.length}
                            siblingIndex={idx}
                            levelColors={levelColors}
                            selectedNodeId={selectedNodeId}
                            onSelect={onSelect}
                            onToggleCollapse={onToggleCollapse}
                            onAddChild={onAddChild}
                            onMoveNode={onMoveNode}
                            onDeleteNode={onDeleteNode}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export const ClassificationTreeSidebar: React.FC<TreeSidebarProps> = (props) => {
    const {
        userPrompt, onUserPromptChange, isGenerating, onGenerate, onCreateEmpty,
        data, setData, selectedNodeId, setSelectedNodeId,
        onUpdateNode, onDeleteNode, onAddChild, onSetLayout,
        aiLanguage, onAiLanguageChange, onExportPng,
        savedTrees, showLibrary, setShowLibrary, onLoadSaved, onDeleteSaved, onRenameSaved,
        showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, onConfirmSave,
        onUndo, onRedo, canUndo, canRedo,
    } = props;

    const [showAi, setShowAi] = useState(false);
    const [showStyle, setShowStyle] = useState(false);
    const [showTopo, setShowTopo] = useState(true);
    const [showPalettes, setShowPalettes] = useState(false);
    const [syncGlobal, setSyncGlobal] = useState(false);
    const [syncLevel, setSyncLevel] = useState(false);

    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renamingValue, setRenamingValue] = useState('');

    const levelColors = data?.levelColors || ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

    const handleMoveNode = (nodeId: string, direction: 'up' | 'down') => {
        if (!data) return;
        const newRoot = moveNodeInTree(data.rootNode, nodeId, direction);
        setData({ ...data, rootNode: newRoot });
    };

    const meta = data && selectedNodeId ? findNodeAndMeta(data.rootNode, selectedNodeId) : null;
    const selectedNode = meta?.found as ClassificationTreeNode | null;


    const applyPalette = (colors: string[]) => {
        if (!data) return;
        // Apply border colors to each node by depth
        const colorizeByDepth = (node: ClassificationTreeNode, depth: number): ClassificationTreeNode => {
            const c = colors[depth % colors.length];
            return {
                ...node,
                style: { ...node.style, borderColor: c },
                children: node.children?.map(child => colorizeByDepth(child, depth + 1)),
            };
        };
        const newRoot = colorizeByDepth(data.rootNode, 0);
        setData({ ...data, rootNode: newRoot, levelColors: colors });
    };

    // Collect all node ids in the tree
    const collectAllNodeIds = (node: ClassificationTreeNode): string[] => {
        const ids = [node.id];
        if (node.children) node.children.forEach(c => ids.push(...collectAllNodeIds(c)));
        return ids;
    };

    // Apply updates to multiple nodes in tree at once (returns new root)
    const applyUpdatesToTree = (
        root: ClassificationTreeNode,
        targetIds: Set<string>,
        updates: Partial<ClassificationTreeNode>
    ): ClassificationTreeNode => {
        const newNode = targetIds.has(root.id) ? { ...root, ...updates } : { ...root };
        if (root.children) {
            newNode.children = root.children.map(c => applyUpdatesToTree(c, targetIds, updates));
        }
        return newNode;
    };

    // Wrapped update that applies sync modes — single batch setData call
    const handleNodeUpdate = (id: string, updates: Partial<ClassificationTreeNode>) => {
        if (!data) { onUpdateNode(id, updates); return; }

        const needsSync = updates.style || updates.nodeShape !== undefined || updates.icon !== undefined;

        if (!needsSync || (!syncGlobal && !syncLevel)) {
            // No sync needed, just do normal single-node update
            onUpdateNode(id, updates);
            return;
        }

        // Build style-only updates for synced nodes
        const styleUpdates: Partial<ClassificationTreeNode> = {};
        if (updates.style) styleUpdates.style = updates.style;
        if (updates.nodeShape !== undefined) styleUpdates.nodeShape = updates.nodeShape;
        if (updates.icon !== undefined) styleUpdates.icon = updates.icon;

        // Collect target node IDs
        let syncIds: string[];
        if (syncGlobal) {
            syncIds = collectAllNodeIds(data.rootNode);
        } else {
            syncIds = meta?.levelNodes?.map(n => n.id) || [id];
        }

        // Apply full updates to current node, style updates to others
        let newRoot = applyUpdatesToTree(data.rootNode, new Set([id]), updates);
        // Now apply style-only updates to all synced nodes except current (already updated)
        const otherIds = new Set(syncIds.filter(nid => nid !== id));
        if (otherIds.size > 0) {
            newRoot = applyUpdatesToTree(newRoot, otherIds, styleUpdates);
        }
        setData({ ...data, rootNode: newRoot });
    };

    // ─── Render Node Editor View ───
    if (selectedNode) {
        return (
            <div className="w-full lg:w-80 bg-white p-4 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col gap-3 overflow-y-auto custom-scrollbar shrink-0 z-20 animate-reveal">
                {/* Back Header */}
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => setSelectedNodeId(null)}
                        className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md transition-all active:scale-95 text-xs"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">编辑节点</h3>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest leading-none">Node Properties</p>
                    </div>
                    <button
                        onClick={() => onDeleteNode(selectedNode.id)}
                        className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all text-[10px]"
                        title="删除此节点"
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>

                {/* Sync Mode Toggles */}
                <div className="flex gap-1.5">
                    <button
                        onClick={() => { setSyncGlobal(!syncGlobal); if (!syncGlobal) setSyncLevel(false); }}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all border ${syncGlobal
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-300'
                            }`}
                    >
                        <i className={`fa-solid ${syncGlobal ? 'fa-toggle-on' : 'fa-toggle-off'} text-[10px]`}></i>
                        全局同步
                    </button>
                    <button
                        onClick={() => { setSyncLevel(!syncLevel); if (!syncLevel) setSyncGlobal(false); }}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-1.5 transition-all border ${syncLevel
                            ? 'bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-200'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-violet-500 hover:border-violet-300'
                            }`}
                    >
                        <i className={`fa-solid ${syncLevel ? 'fa-toggle-on' : 'fa-toggle-off'} text-[10px]`}></i>
                        同级同步
                    </button>
                </div>

                {/* Content Editing */}
                <div className="space-y-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 border-l-4 border-l-indigo-400 shadow-sm">
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-2.5 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">内容编辑</span>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">标签</span>
                        <input
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all"
                            value={selectedNode.label}
                            onChange={(e) => handleNodeUpdate(selectedNode.id, { label: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">描述</span>
                        <textarea
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[9px] font-bold text-slate-500 outline-none focus:border-indigo-400 transition-all resize-none leading-relaxed"
                            rows={2}
                            placeholder="输入描述..."
                            value={selectedNode.description || ''}
                            onChange={(e) => handleNodeUpdate(selectedNode.id, { description: e.target.value })}
                        />
                    </div>
                </div>

                {/* Typography - Title */}
                <div className="space-y-2 p-3 bg-violet-50/50 rounded-xl border border-violet-100 border-l-4 border-l-violet-400 shadow-sm">
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-2.5 bg-violet-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest">标题排版</span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, fontWeight: selectedNode.style?.fontWeight === 'bold' ? 'normal' : 'bold' } })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] ${selectedNode.style?.fontWeight === 'bold' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-bold"></i>
                        </button>
                        <button
                            onClick={() => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, fontStyle: selectedNode.style?.fontStyle === 'italic' ? 'normal' : 'italic' } })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] ${selectedNode.style?.fontStyle === 'italic' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-italic"></i>
                        </button>
                        <div className="flex-1 h-8 bg-white border border-slate-200 rounded-lg flex items-center px-0.5 overflow-hidden">
                            {['left', 'center', 'right', 'justify'].map(align => (
                                <button
                                    key={align}
                                    onClick={() => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, textAlign: align as any } })}
                                    className={`flex-1 h-6 rounded flex items-center justify-center transition-all ${selectedNode.style?.textAlign === align ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-400'}`}
                                >
                                    <i className={`fa-solid fa-align-${align} text-[8px]`}></i>
                                </button>
                            ))}
                        </div>
                        <input
                            type="number" min={8} max={24}
                            value={selectedNode.style?.fontSize || 12}
                            onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, fontSize: Number(e.target.value) } })}
                            className="w-12 h-8 bg-white rounded-lg border border-slate-200 px-2 text-[10px] font-black text-slate-700 outline-none text-center focus:border-indigo-400"
                            title="字号"
                        />
                        <div className="h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200" title="文字颜色">
                            <ColorPickerWithPresets
                                color={selectedNode.style?.color || '#334155'}
                                documentColors={[]}
                                onChange={(c) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, color: c } })}
                                size="sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Typography - Description */}
                <div className="space-y-2 p-3 bg-teal-50/50 rounded-xl border border-teal-100 border-l-4 border-l-teal-400 shadow-sm">
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-2.5 bg-teal-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-teal-700 uppercase tracking-widest">描述排版</span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, descFontWeight: selectedNode.style?.descFontWeight === 'bold' ? 'normal' : 'bold' } })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] ${selectedNode.style?.descFontWeight === 'bold' ? 'bg-teal-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-bold"></i>
                        </button>
                        <button
                            onClick={() => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, descFontStyle: selectedNode.style?.descFontStyle === 'italic' ? 'normal' : 'italic' } })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] ${selectedNode.style?.descFontStyle === 'italic' ? 'bg-teal-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        >
                            <i className="fa-solid fa-italic"></i>
                        </button>
                        <div className="flex-1 h-8 bg-white border border-slate-200 rounded-lg flex items-center px-0.5 overflow-hidden">
                            {['left', 'center', 'right', 'justify'].map(align => (
                                <button
                                    key={align}
                                    onClick={() => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, descTextAlign: align as any } })}
                                    className={`flex-1 h-6 rounded flex items-center justify-center transition-all ${selectedNode.style?.descTextAlign === align ? 'bg-teal-50 text-teal-600' : 'text-slate-400 hover:text-teal-400'}`}
                                >
                                    <i className={`fa-solid fa-align-${align} text-[8px]`}></i>
                                </button>
                            ))}
                        </div>
                        <input
                            type="number" min={6} max={18}
                            value={selectedNode.style?.descFontSize || 8}
                            onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, descFontSize: Number(e.target.value) } })}
                            className="w-12 h-8 bg-white rounded-lg border border-slate-200 px-2 text-[10px] font-black text-slate-700 outline-none text-center focus:border-teal-400"
                            title="描述字号"
                        />
                        <div className="h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200" title="描述颜色">
                            <ColorPickerWithPresets
                                color={selectedNode.style?.descColor || '#94a3b8'}
                                documentColors={[]}
                                onChange={(c) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, descColor: c } })}
                                size="sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Node Appearance - compact */}
                <div className="space-y-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100 border-l-4 border-l-blue-400 shadow-sm">
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-2.5 bg-blue-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">节点外观</span>
                    </div>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">背景色</span>
                            <div className="h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200">
                                <ColorPickerWithPresets
                                    color={selectedNode.style?.backgroundColor || (selectedNode.depth === 0 ? '#1e293b' : '#ffffff')}
                                    documentColors={[]}
                                    onChange={(c) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, backgroundColor: c, bgColor: c } })}
                                    size="sm"
                                />
                            </div>
                        </div>
                        <div className="flex-1 space-y-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">边框色</span>
                            <div className="h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200">
                                <ColorPickerWithPresets
                                    color={selectedNode.style?.borderColor || '#6366f1'}
                                    documentColors={[]}
                                    onChange={(c) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, borderColor: c } })}
                                    size="sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Border Width & Radius */}
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">边框宽度</span>
                                <span className="text-[8px] font-black text-indigo-500">{selectedNode.style?.borderWidth ?? 2}px</span>
                            </div>
                            <input
                                type="range" min={0} max={8} step={0.5}
                                value={selectedNode.style?.borderWidth ?? 2}
                                onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, borderWidth: Number(e.target.value) } })}
                                className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">圆角</span>
                                <span className="text-[8px] font-black text-indigo-500">{selectedNode.style?.borderRadius ?? 20}px</span>
                            </div>
                            <input
                                type="range" min={0} max={40} step={1}
                                value={selectedNode.style?.borderRadius ?? 20}
                                onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, borderRadius: Number(e.target.value) } })}
                                className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Width & PaddingX */}
                    <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">节点宽度</span>
                                <span className="text-[8px] font-black text-indigo-500">{selectedNode.style?.width || 160}px</span>
                            </div>
                            <input
                                type="range" min={100} max={320} step={10}
                                value={selectedNode.style?.width || 160}
                                onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, width: Number(e.target.value) } })}
                                className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">水平内边距</span>
                                <span className="text-[8px] font-black text-indigo-500">{selectedNode.style?.paddingX ?? 12}px</span>
                            </div>
                            <input
                                type="range" min={4} max={32} step={2}
                                value={selectedNode.style?.paddingX ?? 12}
                                onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, paddingX: Number(e.target.value) } })}
                                className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Opacity */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">透明度</span>
                            <span className="text-[8px] font-black text-indigo-500">{Math.round((selectedNode.style?.opacity ?? 1) * 100)}%</span>
                        </div>
                        <input
                            type="range" min={0.1} max={1} step={0.05}
                            value={selectedNode.style?.opacity ?? 1}
                            onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, opacity: Number(e.target.value) } })}
                            className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Shadow */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">阴影模糊</span>
                                <span className="text-[8px] font-black text-indigo-500">{selectedNode.style?.shadowBlur ?? 0}px</span>
                            </div>
                            <input
                                type="range" min={0} max={40} step={1}
                                value={selectedNode.style?.shadowBlur ?? 0}
                                onChange={(e) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, shadowBlur: Number(e.target.value) } })}
                                className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-1 shrink-0">
                            <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">阴影色</span>
                            <div className="h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200">
                                <ColorPickerWithPresets
                                    color={selectedNode.style?.shadowColor || '#00000030'}
                                    documentColors={[]}
                                    onChange={(c) => handleNodeUpdate(selectedNode.id, { style: { ...selectedNode.style, shadowColor: c } })}
                                    size="sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Shape */}
                    <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">形状</span>
                        <div className="flex bg-white p-0.5 rounded-lg border border-slate-200">
                            {SHAPE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleNodeUpdate(selectedNode.id, { nodeShape: opt.value })}
                                    className={`flex-1 py-1 rounded flex items-center justify-center transition-all ${selectedNode.nodeShape === opt.value ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                                    title={opt.label}
                                >
                                    <i className={`${opt.icon} text-[9px]`}></i>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">图标</span>
                        <div className="grid grid-cols-10 gap-0.5 p-1 bg-white rounded-lg border border-slate-200">
                            {ICON_OPTIONS.map(icon => (
                                <button
                                    key={icon}
                                    onClick={() => handleNodeUpdate(selectedNode.id, { icon })}
                                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${selectedNode.icon === icon ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-indigo-400'}`}
                                >
                                    <i className={`${icon} text-[8px]`}></i>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions - compact row */}
                <div className="flex gap-1.5 mt-auto pt-2 border-t border-slate-100">
                    <button onClick={() => setSelectedNodeId(null)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all">
                        完成退出
                    </button>
                </div>
            </div>
        );
    }

    // ─── Render Main Dashboard View ───
    return (
        <div className="w-full lg:w-80 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0 z-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2 px-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                    <i className="fa-solid fa-sitemap text-xl"></i>
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">分类树设计</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                            {data ? "视觉排版与属性编辑" : "AI 驱动的结构生成"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Section: AI Generation */}
                <div className={`pt-4 border-l-2 pl-3 rounded-r-2xl transition-all duration-300 ${showAi ? 'bg-violet-50/50 border-violet-400 shadow-sm' : 'border-transparent'}`}>
                    <button
                        onClick={() => setShowAi(!showAi)}
                        className="w-full flex items-center justify-between group/title px-1 pb-1"
                    >
                        <span className={`text-[11px] font-black group-hover:text-violet-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors ${showAi ? 'text-violet-600' : 'text-slate-400'}`}>
                            <i className={`fa-solid fa-wand-magic-sparkles ${showAi ? 'text-violet-600' : 'text-slate-300'}`}></i> AI 智能生成
                        </span>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showAi ? 'rotate-180 text-violet-400' : ''}`}></i>
                    </button>

                    <div className={`space-y-4 overflow-hidden transition-all duration-300 ${showAi ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">生成语言</span>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                    onClick={() => onAiLanguageChange('zh')}
                                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${aiLanguage === 'zh' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >中文</button>
                                <button
                                    onClick={() => onAiLanguageChange('en')}
                                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase transition-all ${aiLanguage === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >EN</button>
                            </div>
                        </div>

                        <textarea
                            className="w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] font-bold outline-none resize-none focus:ring-2 focus:ring-indigo-200 transition-all text-slate-700 leading-relaxed"
                            placeholder="输入核心主题，AI 将为你拆解分类。例如：纳米技术应用领域、市场营销组合(4P)..."
                            value={userPrompt}
                            onChange={(e) => onUserPromptChange(e.target.value)}
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={onGenerate}
                                disabled={isGenerating || !userPrompt.trim()}
                                className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
                                {isGenerating ? "生成中..." : "开始建模"}
                            </button>
                            <button
                                onClick={onCreateEmpty}
                                className="px-4 py-3 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm"
                                title="创建空白树"
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section: Academic Palettes */}
                <div className={`pt-4 border-l-2 pl-3 rounded-r-2xl transition-all duration-300 ${showPalettes ? 'bg-indigo-50/50 border-indigo-400 shadow-sm' : 'border-transparent'}`}>
                    <button
                        onClick={() => setShowPalettes(!showPalettes)}
                        className="w-full flex items-center justify-between group/title px-1 pb-1"
                    >
                        <span className={`text-[11px] font-black group-hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors ${showPalettes ? 'text-indigo-600' : 'text-slate-400'}`}>
                            <i className={`fa-solid fa-palette ${showPalettes ? 'text-indigo-600' : 'text-slate-300'}`}></i> 全局学术配色
                        </span>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showPalettes ? 'rotate-180 text-indigo-400' : ''}`}></i>
                    </button>

                    <div className={`space-y-2.5 overflow-hidden transition-all duration-300 ${showPalettes ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>

                        {/* Current Colors + Random Button */}
                        {data && (
                            <div className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">当前配色</span>
                                    <button
                                        onClick={() => {
                                            // Calculate max depth of tree
                                            const getMaxDepth = (node: ClassificationTreeNode, d: number): number => {
                                                if (!node.children?.length) return d;
                                                return Math.max(...node.children.map(c => getMaxDepth(c, d + 1)));
                                            };
                                            const maxDepth = getMaxDepth(data.rootNode, 0);
                                            const levels = maxDepth + 1;

                                            // Generate one color per level with harmonious logic
                                            const baseHue = Math.random() * 360;
                                            const hueStep = 360 / Math.max(levels, 3);
                                            const levelColors: string[] = [];
                                            for (let i = 0; i < levels; i++) {
                                                const h = Math.round((baseHue + i * hueStep) % 360);
                                                const s = Math.round(60 + (levels > 1 ? (i / (levels - 1)) * 15 : 0));
                                                const l = Math.round(42 + (levels > 1 ? (i / (levels - 1)) * 12 : 0));
                                                levelColors.push(`hsl(${h}, ${s}%, ${l}%)`);
                                            }

                                            // Apply color by depth - same level same color
                                            const colorizeByLevel = (node: ClassificationTreeNode, depth: number): ClassificationTreeNode => ({
                                                ...node,
                                                style: { ...node.style, borderColor: levelColors[depth % levelColors.length] },
                                                children: node.children?.map(c => colorizeByLevel(c, depth + 1)),
                                            });
                                            const newRoot = colorizeByLevel(data.rootNode, 0);
                                            setData({ ...data, rootNode: newRoot, levelColors });
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[8px] font-black uppercase flex items-center gap-1 hover:shadow-md hover:scale-105 transition-all"
                                    >
                                        <i className="fa-solid fa-shuffle text-[7px]"></i>
                                        随机上色
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    {(data.levelColors || []).map((c, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                            <div
                                                className="w-full h-5 rounded-md border border-white shadow-sm cursor-pointer hover:scale-110 transition-transform ring-1 ring-black/5"
                                                style={{ backgroundColor: c }}
                                                title={`L${i}: ${c}`}
                                            ></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Palette Grid */}
                        <div className="grid grid-cols-1 gap-1.5 overflow-y-auto max-h-48 pr-1 custom-scrollbar">
                            {ACADEMIC_PALETTES.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={() => applyPalette(p.colors)}
                                    className="w-full group/palette bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-200 rounded-xl p-2 transition-all text-left flex items-center justify-between shadow-sm hover:shadow-md"
                                >
                                    <span className="text-[9px] font-extrabold text-slate-700 group-hover/palette:text-indigo-600 uppercase tracking-tight">{p.name}</span>
                                    <div className="flex -space-x-1">
                                        {p.colors.slice(0, 5).map((c, ci) => (
                                            <div key={ci} className="w-3 h-3 rounded-full border border-white shadow-sm ring-1 ring-black/5" style={{ backgroundColor: c }}></div>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Section: Global Styling */}
                <div className={`pt-4 border-l-2 pl-3 rounded-r-2xl transition-all duration-300 ${showStyle ? 'bg-amber-50/50 border-amber-400 shadow-sm' : 'border-transparent'}`}>
                    <button
                        onClick={() => setShowStyle(!showStyle)}
                        className="w-full flex items-center justify-between group/title px-1 pb-1"
                    >
                        <span className={`text-[11px] font-black group-hover:text-amber-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors ${showStyle ? 'text-amber-600' : 'text-slate-400'}`}>
                            <i className={`fa-solid fa-sliders ${showStyle ? 'text-amber-600' : 'text-slate-300'}`}></i> 画布基础排版
                        </span>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showStyle ? 'rotate-180 text-amber-400' : ''}`}></i>
                    </button>

                    <div className={`space-y-4 overflow-hidden transition-all duration-300 ${showStyle ? 'max-h-[900px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                        {data && (
                            <>
                                {/* All controls in one compact container */}
                                <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">

                                    {/* Layout Direction */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-0.5 h-2.5 bg-indigo-500 rounded-full"></div>
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">排版方向</span>
                                        </div>
                                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            {LAYOUT_OPTIONS.map(dir => (
                                                <button
                                                    key={dir.value}
                                                    onClick={() => onSetLayout(dir.value)}
                                                    className={`flex-1 py-1.5 rounded-md text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-all ${data.layout === dir.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    <i className={`${dir.icon} text-[9px]`}></i>
                                                    <span className="scale-90 origin-center">{dir.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Spacing Controls */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-0.5 h-2.5 bg-indigo-500 rounded-full"></div>
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">间距</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-bold text-slate-400 w-8 shrink-0">垂直</span>
                                                <input
                                                    type="range" min={10} max={250} step={2}
                                                    value={data.verticalSpacing || 40}
                                                    onChange={(e) => setData({ ...data, verticalSpacing: Number(e.target.value) })}
                                                    className="flex-1 h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                                                />
                                                <span className="text-[8px] font-black text-indigo-500 w-8 text-right">{data.verticalSpacing || 40}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-bold text-slate-400 w-8 shrink-0">横向</span>
                                                <input
                                                    type="range" min={50} max={300} step={10}
                                                    value={data.horizontalSpacing || 180}
                                                    onChange={(e) => setData({ ...data, horizontalSpacing: Number(e.target.value) })}
                                                    className="flex-1 h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                                                />
                                                <span className="text-[8px] font-black text-indigo-500 w-8 text-right">{data.horizontalSpacing || 180}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Node Shape */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-0.5 h-2.5 bg-indigo-500 rounded-full"></div>
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">节点形状</span>
                                        </div>
                                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            {SHAPE_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setData({ ...data, nodeShape: opt.value })}
                                                    className={`flex-1 py-1 rounded-md flex items-center justify-center transition-all ${data.nodeShape === opt.value ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                                                    title={opt.label}
                                                >
                                                    <i className={`${opt.icon} text-[10px]`}></i>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-slate-200/80"></div>

                                    {/* Connection Style */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-0.5 h-2.5 bg-teal-500 rounded-full"></div>
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">连线样式</span>
                                        </div>

                                        {/* Line Width */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-bold text-slate-400 w-8 shrink-0">线宽</span>
                                            <input
                                                type="range" min={0.5} max={5} step={0.5}
                                                value={data.connectionStyle?.width || 1.5}
                                                onChange={(e) => setData({ ...data, connectionStyle: { ...data.connectionStyle, width: Number(e.target.value) } })}
                                                className="flex-1 h-1 accent-teal-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                                            />
                                            <span className="text-[8px] font-black text-teal-500 w-6 text-right">{data.connectionStyle?.width || 1.5}</span>
                                        </div>
                                        {/* Line Color */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-bold text-slate-400 w-8 shrink-0">颜色</span>
                                            <div className="bg-white rounded-lg border border-slate-200 shrink-0">
                                                <ColorPickerWithPresets
                                                    color={data.connectionStyle?.color || '#e2e8f0'}
                                                    documentColors={[]}
                                                    onChange={(c) => setData({ ...data, connectionStyle: { ...data.connectionStyle, color: c } })}
                                                    size="sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Line Style */}
                                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            {([
                                                { value: 'solid', label: '实线', icon: 'fa-solid fa-minus' },
                                                { value: 'dashed', label: '虚线', icon: 'fa-solid fa-ellipsis' },
                                                { value: 'dotted', label: '点线', icon: 'fa-solid fa-ellipsis-vertical' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setData({ ...data, connectionStyle: { ...data.connectionStyle, style: opt.value } })}
                                                    className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase flex items-center justify-center gap-1 transition-all ${(data.connectionStyle?.style || 'solid') === opt.value
                                                        ? 'bg-white text-teal-600 shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    <i className={`${opt.icon} text-[7px]`}></i>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Curve Type */}
                                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            {([
                                                { value: 'bezier', label: '曲线' },
                                                { value: 'straight', label: '直线' },
                                                { value: 'step', label: '阶梯' },
                                                { value: 'elbow', label: '折线' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => setData({ ...data, connectionStyle: { ...data.connectionStyle, curveType: opt.value } })}
                                                    className={`flex-1 py-1 rounded-md text-[8px] font-black uppercase flex items-center justify-center transition-all ${(data.connectionStyle?.curveType || 'bezier') === opt.value
                                                        ? 'bg-white text-teal-600 shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Animate Toggle */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-bold text-slate-400">连线动画</span>
                                            <button
                                                onClick={() => setData({ ...data, connectionStyle: { ...data.connectionStyle, animate: !data.connectionStyle?.animate } })}
                                                className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase flex items-center gap-1 transition-all border ${data.connectionStyle?.animate
                                                    ? 'bg-teal-500 text-white border-teal-500'
                                                    : 'bg-white text-slate-400 border-slate-200 hover:text-teal-500'
                                                    }`}
                                            >
                                                <i className={`fa-solid ${data.connectionStyle?.animate ? 'fa-toggle-on' : 'fa-toggle-off'} text-[9px]`}></i>
                                                {data.connectionStyle?.animate ? '开启' : '关闭'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        {!data && (
                            <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <i className="fa-solid fa-layer-group text-slate-200 text-3xl mb-3 block"></i>
                                <p className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">请先生成数据</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section: Topology Management */}
                <div className={`pt-4 border-l-2 pl-3 rounded-r-2xl transition-all duration-300 ${showTopo ? 'bg-emerald-50/50 border-emerald-400 shadow-sm' : 'border-transparent'}`}>
                    <button
                        onClick={() => setShowTopo(!showTopo)}
                        className="w-full flex items-center justify-between group/title px-1 pb-1"
                    >
                        <span className={`text-[11px] font-black group-hover:text-emerald-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors ${showTopo ? 'text-emerald-600' : 'text-slate-400'}`}>
                            <i className={`fa-solid fa-diagram-project ${showTopo ? 'text-emerald-600' : 'text-slate-300'}`}></i> 层级拓扑管理
                        </span>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showTopo ? 'rotate-180 text-emerald-400' : ''}`}></i>
                    </button>

                    <div className={`space-y-4 overflow-hidden transition-all duration-300 ${showTopo ? 'max-h-[800px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                        {data && (
                            <div className="space-y-2">
                                <div className="p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 max-h-[350px] overflow-y-auto custom-scrollbar">
                                    <TopologyOutlineNode
                                        node={data.rootNode}
                                        depth={0}
                                        siblingCount={1}
                                        siblingIndex={0}
                                        levelColors={levelColors}
                                        selectedNodeId={selectedNodeId}
                                        onSelect={(id) => setSelectedNodeId(id)}
                                        onToggleCollapse={props.onToggleCollapse}
                                        onAddChild={onAddChild}
                                        onMoveNode={handleMoveNode}
                                        onDeleteNode={onDeleteNode}
                                    />
                                </div>
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[9px] font-black text-indigo-500 flex items-center gap-1">
                                            <i className="fa-solid fa-cubes-stacked text-[8px] opacity-60"></i>
                                            {(() => { let c = 0; const count = (n: ClassificationTreeNode) => { c++; n.children?.forEach(count); }; count(data.rootNode); return c; })()} 节点
                                        </span>
                                        <div className="w-0.5 h-3 bg-slate-200 rounded-full"></div>
                                        <span className="text-[9px] font-black text-indigo-500 flex items-center gap-1">
                                            <i className="fa-solid fa-layer-group text-[8px] opacity-60"></i>
                                            {(() => { const depth = (n: ClassificationTreeNode): number => n.children?.length ? 1 + Math.max(...n.children.map(depth)) : 1; return depth(data.rootNode); })()} 层
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Actions: Library & Save */}
            <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button onClick={() => setShowLibrary(true)} className="py-3.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all flex items-center justify-center gap-2 group">
                    <i className="fa-solid fa-box-archive text-slate-300 group-hover:text-indigo-400 transition-colors"></i> 方案库
                </button>
                <button onClick={onExportPng} className="py-3.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all flex items-center justify-center gap-2 group">
                    <i className="fa-solid fa-cloud-arrow-down text-slate-300 group-hover:text-indigo-400 transition-colors"></i> 导出图像
                </button>
                {data && (
                    <button
                        onClick={() => { setSaveTitle(data.title || "分类树方案"); setShowSaveModal(true); }}
                        className="col-span-2 py-4 bg-indigo-600 text-white rounded-[1.25rem] text-[11px] font-black uppercase shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-floppy-disk"></i> 保存当前设计
                    </button>
                )}
            </div>

            {/* Library Modal */}
            {showLibrary && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowLibrary(false)}>
                    <div className="bg-white w-[600px] max-h-[80vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-scale-up" onClick={e => e.stopPropagation()}>
                        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 uppercase italic leading-none">方案库 <span className="text-indigo-600">LIBRARY</span></h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">浏览并加载已保存的分类树结构</p>
                            </div>
                            <button onClick={() => setShowLibrary(false)} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-white custom-scrollbar">
                            {savedTrees.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                                    <div className="w-24 h-24 rounded-full bg-white mx-auto flex items-center justify-center mb-6 shadow-sm">
                                        <i className="fa-solid fa-folder-open text-4xl text-slate-200"></i>
                                    </div>
                                    <p className="text-slate-400 text-sm font-black uppercase tracking-widest">暂无方案</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {savedTrees.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => onLoadSaved(item)}
                                            className="p-6 bg-white rounded-[2rem] border border-slate-100 hover:border-indigo-400 hover:shadow-xl cursor-pointer transition-all flex items-center justify-between group relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                    <i className="fa-solid fa-sitemap"></i>
                                                </div>
                                                <div>
                                                    {renamingId === item.id ? (
                                                        <input
                                                            autoFocus
                                                            className="bg-slate-50 border border-indigo-400 text-sm font-black text-slate-800 px-4 py-1.5 rounded-xl outline-none"
                                                            value={renamingValue}
                                                            onChange={(e) => setRenamingValue(e.target.value)}
                                                            onBlur={() => { onRenameSaved(item.id, renamingValue); setRenamingId(null); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') { onRenameSaved(item.id, renamingValue); setRenamingId(null); } }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <p className="text-base font-black text-slate-800">{item.title}</p>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase flex items-center gap-1.5"><i className="fa-regular fa-clock"></i>{item.timestamp}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                                                <button onClick={(e) => { e.stopPropagation(); setRenamingId(item.id); setRenamingValue(item.title); }}
                                                    className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-white hover:text-indigo-600 transition-all shadow-sm">
                                                    <i className="fa-solid fa-pen"></i>
                                                </button>
                                                <button onClick={(e) => onDeleteSaved(item.id, e)}
                                                    className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowSaveModal(false)}>
                    <div className="bg-white w-[450px] rounded-[3rem] shadow-2xl p-10 animate-scale-up" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 shadow-sm">
                            <i className="fa-solid fa-floppy-disk text-2xl"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">保存分类树方案</h3>
                        <p className="text-sm text-slate-500 mb-8 leading-relaxed">确定保存当前的设计方案？你可以随时在方案库中找回并继续编辑。</p>

                        <div className="space-y-2 mb-8">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">方案名称</label>
                            <input
                                className="w-full bg-slate-50 border border-slate-100 rounded-[1.25rem] px-6 py-4 text-sm text-slate-800 font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                                value={saveTitle}
                                onChange={(e) => setSaveTitle(e.target.value)}
                                placeholder="输入方案名称..."
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-4 rounded-[1.25rem] border border-slate-100 text-sm font-black text-slate-400 hover:bg-slate-50 transition-all">取消</button>
                            <button
                                onClick={() => onConfirmSave()}
                                disabled={!saveTitle.trim()}
                                className="flex-1 py-4 bg-indigo-600 text-white rounded-[1.25rem] text-sm font-black shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-[1.02] transition-all disabled:opacity-50"
                            >
                                确认保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

