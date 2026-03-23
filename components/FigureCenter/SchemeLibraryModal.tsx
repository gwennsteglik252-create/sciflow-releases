// ============================================
// 科研绘图中心 — 通用方案库弹窗（两级分类文件夹）
// 一级：材料体系等  |  二级：工艺类型等
// 使用 "/" 分隔符表示层级，如 "NiFe基催化剂/水热合成"
// ============================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

// --- 泛型约束 ---
export interface SchemeItem {
    id: string;
    title: string;
    timestamp: string;
    category?: string;
}

interface SchemeLibraryModalProps<T extends SchemeItem> {
    show: boolean;
    onClose: () => void;
    items: T[];
    onLoad: (item: T) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRename: (id: string, newTitle: string) => void;
    onCategoryChange: (id: string, newCategory: string) => void;
    moduleIcon: string;
    moduleLabel: string;
    renderExtra?: (item: T) => React.ReactNode;
}

const DEFAULT_CATEGORY = '未分类';
const ALL_CATEGORY = '__ALL__';
const STORAGE_KEY_PREFIX = 'sciflow_scheme_categories_';

/** 解析分类路径 → { parent, child } */
const parseCatPath = (cat: string): { parent: string; child?: string } => {
    const idx = cat.indexOf('/');
    if (idx === -1) return { parent: cat };
    return { parent: cat.substring(0, idx), child: cat.substring(idx + 1) };
};

/** 构建完整路径 */
const buildCatPath = (parent: string, child?: string): string => {
    return child ? `${parent}/${child}` : parent;
};

// ============================================
// SchemeCard — 单个方案卡片
// ============================================
const SchemeCard = React.memo(<T extends SchemeItem>({
    item, onLoad, onDelete, onRename, onCategoryChange, categories, renderExtra,
}: {
    item: T;
    onLoad: (item: T) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRename: (id: string, newTitle: string) => void;
    onCategoryChange: (id: string, newCategory: string) => void;
    categories: string[];
    renderExtra?: (item: T) => React.ReactNode;
}) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [editName, setEditName] = useState(item.title);
    const [showCatMenu, setShowCatMenu] = useState(false);

    const handleConfirmRename = () => {
        if (editName.trim() && editName !== item.title) onRename(item.id, editName);
        setIsRenaming(false);
    };

    // 当前分类的显示文本
    const catDisplay = useMemo(() => {
        const cat = item.category || DEFAULT_CATEGORY;
        if (cat === DEFAULT_CATEGORY) return null;
        const { parent, child } = parseCatPath(cat);
        return child ? `${parent} › ${child}` : parent;
    }, [item.category]);

    // 按层级分组显示分类菜单
    const catTree = useMemo(() => {
        const tree: Record<string, string[]> = {};
        categories.forEach(cat => {
            const { parent, child } = parseCatPath(cat);
            if (!tree[parent]) tree[parent] = [];
            if (child && !tree[parent].includes(child)) tree[parent].push(child);
        });
        return tree;
    }, [categories]);

    return (
        <div
            className="p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-300 hover:shadow-lg cursor-pointer transition-all group relative overflow-visible"
            onClick={() => { if (!isRenaming && !showCatMenu) onLoad(item); }}
        >
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-l-full" />
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-sm shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    <i className="fa-solid fa-file-lines" />
                </div>
                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <input
                            className="w-full bg-slate-50 border border-indigo-300 rounded-lg px-2.5 py-1 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-100"
                            value={editName} onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleConfirmRename}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                            autoFocus onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <p className="text-[12px] font-black text-slate-800 truncate leading-tight">{item.title}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[8px] text-slate-400 font-bold uppercase flex items-center gap-1">
                            <i className="fa-regular fa-clock text-[7px]" />{item.timestamp}
                        </span>
                        {catDisplay && (
                            <span className="text-[7px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full">
                                {catDisplay}
                            </span>
                        )}
                    </div>
                    {renderExtra && <div className="mt-1">{renderExtra(item)}</div>}
                </div>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setEditName(item.title); setIsRenaming(true); }} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-white hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm" title="重命名">
                        <i className="fa-solid fa-pen text-[9px]" />
                    </button>
                    <div className="relative">
                        <button onClick={() => setShowCatMenu(!showCatMenu)} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-white hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm" title="移动到分类">
                            <i className="fa-solid fa-folder-tree text-[9px]" />
                        </button>
                        {showCatMenu && (
                            <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1 w-48 animate-reveal max-h-60 overflow-y-auto custom-scrollbar">
                                {/* 未分类选项 */}
                                <button
                                    onClick={() => { onCategoryChange(item.id, DEFAULT_CATEGORY); setShowCatMenu(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-[10px] font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2 ${(item.category || DEFAULT_CATEGORY) === DEFAULT_CATEGORY ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                                >
                                    <i className="fa-solid fa-inbox text-[9px] text-slate-300" />{DEFAULT_CATEGORY}
                                </button>
                                <div className="border-t border-slate-100 my-1" />
                                {/* 按层级显示分类 */}
                                {Object.entries(catTree).filter(([k]) => k !== DEFAULT_CATEGORY).map(([parent, children]) => (
                                    <div key={parent}>
                                        <button
                                            onClick={() => { onCategoryChange(item.id, parent); setShowCatMenu(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-[10px] font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2 ${item.category === parent ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'}`}
                                        >
                                            <i className="fa-solid fa-folder text-amber-400 text-[9px]" />
                                            <span className="font-black">{parent}</span>
                                        </button>
                                        {children.map(child => {
                                            const fullPath = buildCatPath(parent, child);
                                            return (
                                                <button
                                                    key={fullPath}
                                                    onClick={() => { onCategoryChange(item.id, fullPath); setShowCatMenu(false); }}
                                                    className={`w-full text-left pl-7 pr-3 py-1 text-[9px] font-bold hover:bg-indigo-50 transition-colors flex items-center gap-1.5 ${item.category === fullPath ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-500'}`}
                                                >
                                                    <i className="fa-solid fa-file-alt text-slate-300 text-[7px]" />{child}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={(e) => onDelete(item.id, e)} className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all shadow-sm" title="删除">
                        <i className="fa-solid fa-trash-can text-[9px]" />
                    </button>
                </div>
            </div>
        </div>
    );
}) as <T extends SchemeItem>(props: {
    item: T; onLoad: (item: T) => void; onDelete: (id: string, e: React.MouseEvent) => void;
    onRename: (id: string, newTitle: string) => void; onCategoryChange: (id: string, newCategory: string) => void;
    categories: string[]; renderExtra?: (item: T) => React.ReactNode;
}) => React.ReactElement;

// ============================================
// 主弹窗组件
// ============================================
export function SchemeLibraryModal<T extends SchemeItem>({
    show, onClose, items, onLoad, onDelete, onRename, onCategoryChange, moduleIcon, moduleLabel, renderExtra,
}: SchemeLibraryModalProps<T>) {
    const storageKey = STORAGE_KEY_PREFIX + moduleLabel;

    const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newParentName, setNewParentName] = useState('');
    const [newChildName, setNewChildName] = useState('');
    const [createMode, setCreateMode] = useState<'parent' | 'child'>('parent');
    const [createUnderParent, setCreateUnderParent] = useState('');
    const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
    const [renameCategoryValue, setRenameCategoryValue] = useState('');
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);

    // 用户手动创建的分类（持久化到 localStorage）
    const [userCategories, setUserCategories] = useState<string[]>(() => {
        try { const saved = localStorage.getItem(storageKey); return saved ? JSON.parse(saved) : []; } catch { return []; }
    });

    useEffect(() => {
        try { localStorage.setItem(storageKey, JSON.stringify(userCategories)); } catch { }
    }, [userCategories, storageKey]);

    // 合并分类列表
    const allCategories = useMemo(() => {
        const catSet = new Set<string>();
        catSet.add(DEFAULT_CATEGORY);
        userCategories.forEach(c => catSet.add(c));
        items.forEach(item => { if (item.category?.trim()) catSet.add(item.category); });
        return Array.from(catSet);
    }, [items, userCategories]);

    // 构建树形结构 { parent → children[] }
    const categoryTree = useMemo(() => {
        const tree: Record<string, string[]> = {};
        allCategories.forEach(cat => {
            if (cat === DEFAULT_CATEGORY) return;
            const { parent, child } = parseCatPath(cat);
            if (!tree[parent]) tree[parent] = [];
            if (child && !tree[parent].includes(child)) tree[parent].push(child);
        });
        return tree;
    }, [allCategories]);

    // 一级分类列表（排序）
    const parentCategories = useMemo(() => Object.keys(categoryTree).sort(), [categoryTree]);

    // 全局展开的默认行为：初次打开展开所有
    const [didAutoExpand, setDidAutoExpand] = useState(false);
    useEffect(() => {
        if (show && !didAutoExpand && parentCategories.length > 0) {
            setExpandedParents(new Set(parentCategories));
            setDidAutoExpand(true);
        }
        if (!show) setDidAutoExpand(false);
    }, [show, parentCategories, didAutoExpand]);

    // 计数
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allCategories.forEach(cat => { counts[cat] = 0; });
        // 也为每个 parent 统计总数
        parentCategories.forEach(p => { counts[`__parent__${p}`] = 0; });
        items.forEach(item => {
            const cat = item.category || DEFAULT_CATEGORY;
            counts[cat] = (counts[cat] || 0) + 1;
            // 累加到 parent
            const { parent } = parseCatPath(cat);
            if (parent !== DEFAULT_CATEGORY) {
                counts[`__parent__${parent}`] = (counts[`__parent__${parent}`] || 0) + 1;
            }
        });
        return counts;
    }, [items, allCategories, parentCategories]);

    // 过滤
    const filteredItems = useMemo(() => {
        let result = items;
        if (activeCategory !== ALL_CATEGORY) {
            if (activeCategory === DEFAULT_CATEGORY) {
                result = result.filter(item => !item.category || item.category === DEFAULT_CATEGORY);
            } else if (activeCategory.startsWith('__parent__')) {
                // 点击一级分类 → 显示该一级及其所有二级下的方案
                const parent = activeCategory.substring(10);
                result = result.filter(item => {
                    if (!item.category) return false;
                    const { parent: p } = parseCatPath(item.category);
                    return p === parent;
                });
            } else {
                result = result.filter(item => item.category === activeCategory);
            }
        }
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(item => item.title.toLowerCase().includes(query));
        }
        return [...result].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }, [items, activeCategory, searchQuery]);

    // 新建分类
    const handleCreateCategory = useCallback(() => {
        if (createMode === 'parent') {
            const name = newParentName.trim();
            if (name && !allCategories.includes(name)) {
                setUserCategories(prev => [...prev, name]);
                setExpandedParents(prev => new Set(prev).add(name));
                setActiveCategory(`__parent__${name}`);
            }
        } else {
            const child = newChildName.trim();
            if (child && createUnderParent) {
                const fullPath = buildCatPath(createUnderParent, child);
                if (!allCategories.includes(fullPath)) {
                    setUserCategories(prev => [...prev, fullPath]);
                    setActiveCategory(fullPath);
                }
            }
        }
        setNewParentName('');
        setNewChildName('');
        setIsCreatingCategory(false);
    }, [createMode, newParentName, newChildName, createUnderParent, allCategories]);

    // 重命名分类
    const handleRenameCategory = useCallback((oldName: string, newName: string) => {
        if (!newName.trim() || newName === oldName) { setRenamingCategory(null); return; }
        const isParent = !oldName.includes('/');
        items.forEach(item => {
            if (isParent) {
                // 重命名一级：修改所有以该 parent 开头的方案分类
                if (item.category) {
                    const { parent, child } = parseCatPath(item.category);
                    if (parent === oldName) {
                        onCategoryChange(item.id, buildCatPath(newName, child));
                    }
                }
            } else {
                if (item.category === oldName) onCategoryChange(item.id, newName);
            }
        });
        // 更新 userCategories
        setUserCategories(prev => prev.map(c => {
            if (isParent) {
                const { parent, child } = parseCatPath(c);
                return parent === oldName ? buildCatPath(newName, child) : c;
            }
            return c === oldName ? newName : c;
        }));
        if (isParent && activeCategory === `__parent__${oldName}`) setActiveCategory(`__parent__${newName}`);
        if (!isParent && activeCategory === oldName) setActiveCategory(newName);
        setRenamingCategory(null);
    }, [items, onCategoryChange, activeCategory]);

    // 删除分类
    const handleDeleteCategory = useCallback((catName: string) => {
        if (catName === DEFAULT_CATEGORY) return;
        const isParent = !catName.includes('/');
        items.forEach(item => {
            if (isParent) {
                if (item.category) {
                    const { parent } = parseCatPath(item.category);
                    if (parent === catName) onCategoryChange(item.id, DEFAULT_CATEGORY);
                }
            } else {
                if (item.category === catName) onCategoryChange(item.id, DEFAULT_CATEGORY);
            }
        });
        setUserCategories(prev => prev.filter(c => {
            if (isParent) { const { parent } = parseCatPath(c); return parent !== catName; }
            return c !== catName;
        }));
        if ((isParent && activeCategory === `__parent__${catName}`) || activeCategory === catName) {
            setActiveCategory(ALL_CATEGORY);
        }
        setConfirmDeleteCat(null);
    }, [items, onCategoryChange, activeCategory]);

    const toggleParent = useCallback((parent: string) => {
        setExpandedParents(prev => {
            const next = new Set(prev);
            if (next.has(parent)) next.delete(parent); else next.add(parent);
            return next;
        });
    }, []);

    const handleLoadAndClose = useCallback((item: T) => { onLoad(item); onClose(); }, [onLoad, onClose]);

    // 当前活动分类的显示名
    const activeCatDisplay = useMemo(() => {
        if (activeCategory === ALL_CATEGORY) return '全部方案';
        if (activeCategory === DEFAULT_CATEGORY) return DEFAULT_CATEGORY;
        if (activeCategory.startsWith('__parent__')) {
            return activeCategory.substring(10);
        }
        const { parent, child } = parseCatPath(activeCategory);
        return child ? `${parent} › ${child}` : parent;
    }, [activeCategory]);

    if (!show) return null;

    return createPortal(
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9000] flex items-center justify-center p-6 no-print" onClick={onClose}>
            <div className="bg-white w-full max-w-4xl max-h-[75vh] rounded-[2.5rem] shadow-2xl relative border-4 border-white flex overflow-hidden animate-reveal" onClick={e => e.stopPropagation()}>

                {/* ═══ 左侧：两级分类树 ═══ */}
                <div className="w-60 bg-slate-50/80 border-r border-slate-100 flex flex-col shrink-0">
                    {/* Header */}
                    <div className="p-5 pb-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <i className={`fa-solid ${moduleIcon} text-lg`} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight leading-none">{moduleLabel}方案库</h3>
                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">SCHEME LIBRARY</p>
                            </div>
                        </div>
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-300" />
                            <input className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all placeholder:text-slate-300" placeholder="搜索方案..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>

                    {/* 分类树 */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-3 space-y-0.5">
                        {/* 全部 */}
                        <button onClick={() => setActiveCategory(ALL_CATEGORY)} className={`w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-between gap-2 ${activeCategory === ALL_CATEGORY ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}>
                            <span className="flex items-center gap-2 truncate"><i className="fa-solid fa-layer-group text-[10px]" /> 全部方案</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeCategory === ALL_CATEGORY ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{items.length}</span>
                        </button>

                        {/* 未分类 */}
                        <button onClick={() => setActiveCategory(DEFAULT_CATEGORY)} className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-between gap-2 ${activeCategory === DEFAULT_CATEGORY ? 'bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}>
                            <span className="flex items-center gap-2 truncate"><i className="fa-solid fa-inbox text-slate-300 text-[10px]" /> 未分类</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${activeCategory === DEFAULT_CATEGORY ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>{categoryCounts[DEFAULT_CATEGORY] || 0}</span>
                        </button>

                        <div className="border-t border-slate-200/60 my-2" />
                        <p className="px-3 py-1 text-[8px] font-black text-slate-300 uppercase tracking-widest">两级分类</p>

                        {/* 一级分类（可展开） */}
                        {parentCategories.map(parent => {
                            const isExpanded = expandedParents.has(parent);
                            const children = categoryTree[parent] || [];
                            const parentActive = activeCategory === `__parent__${parent}`;
                            const parentCount = categoryCounts[`__parent__${parent}`] || 0;

                            return (
                                <div key={parent} className="group/parent">
                                    {renamingCategory === parent ? (
                                        <div className="px-2 py-1">
                                            <input className="w-full bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-100" value={renameCategoryValue} onChange={(e) => setRenameCategoryValue(e.target.value)} onBlur={() => handleRenameCategory(parent, renameCategoryValue)} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(parent, renameCategoryValue); if (e.key === 'Escape') setRenamingCategory(null); }} autoFocus />
                                        </div>
                                    ) : confirmDeleteCat === parent ? (
                                        <div className="px-2 py-1.5 bg-rose-50 border border-rose-200 rounded-xl">
                                            <p className="text-[9px] font-bold text-rose-600 mb-1.5">
                                                确认删除「{parent}」及其所有子分类？
                                                {parentCount > 0 && <span className="text-[8px] text-rose-400 block mt-0.5">{parentCount} 个方案将移到"未分类"</span>}
                                            </p>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleDeleteCategory(parent)} className="flex-1 py-1 bg-rose-500 text-white rounded-lg text-[8px] font-black hover:bg-rose-600 transition-all">删除</button>
                                                <button onClick={() => setConfirmDeleteCat(null)} className="flex-1 py-1 bg-white text-slate-500 rounded-lg text-[8px] font-black border border-slate-200 hover:bg-slate-50 transition-all">取消</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`flex items-center rounded-xl transition-all ${parentActive ? 'bg-amber-50 border border-amber-200 shadow-sm' : 'hover:bg-white hover:shadow-sm'}`}>
                                            {/* 展开/折叠按钮 */}
                                            <button onClick={() => toggleParent(parent)} className="w-6 h-8 flex items-center justify-center shrink-0 text-slate-300 hover:text-slate-500 transition-colors ml-1">
                                                <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[7px]`} />
                                            </button>
                                            {/* 一级分类名 */}
                                            <button onClick={() => { setActiveCategory(`__parent__${parent}`); if (!isExpanded) toggleParent(parent); }} className="flex-1 text-left py-2 pr-1 text-[11px] font-black transition-all flex items-center gap-1.5 truncate" style={{ color: parentActive ? '#d97706' : '#64748b' }}>
                                                <i className={`fa-solid ${isExpanded ? 'fa-folder-open' : 'fa-folder'} text-[10px]`} style={{ color: parentActive ? '#f59e0b' : '#cbd5e1' }} />
                                                <span className="truncate">{parent}</span>
                                            </button>
                                            {/* 操作按钮 */}
                                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/parent:opacity-100 transition-opacity">
                                                {/* 新建子分类 */}
                                                <button onClick={() => { setCreateMode('child'); setCreateUnderParent(parent); setNewChildName(''); setIsCreatingCategory(true); if (!isExpanded) toggleParent(parent); }} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="新建子分类">
                                                    <i className="fa-solid fa-plus text-[7px]" />
                                                </button>
                                                <button onClick={() => { setRenamingCategory(parent); setRenameCategoryValue(parent); }} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="重命名">
                                                    <i className="fa-solid fa-pen text-[7px]" />
                                                </button>
                                                <button onClick={() => setConfirmDeleteCat(parent)} className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="删除">
                                                    <i className="fa-solid fa-trash-can text-[7px]" />
                                                </button>
                                            </div>
                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 mr-1 ${parentActive ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>{parentCount}</span>
                                        </div>
                                    )}

                                    {/* 二级子分类 */}
                                    {isExpanded && children.length > 0 && (
                                        <div className="ml-5 pl-2 border-l-2 border-slate-200/50 space-y-0.5 mt-0.5 mb-1">
                                            {children.map(child => {
                                                const fullPath = buildCatPath(parent, child);
                                                const childActive = activeCategory === fullPath;
                                                const childCount = categoryCounts[fullPath] || 0;

                                                return (
                                                    <div key={fullPath} className="group/child">
                                                        {renamingCategory === fullPath ? (
                                                            <div className="py-0.5">
                                                                <input className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100" value={renameCategoryValue} onChange={(e) => setRenameCategoryValue(e.target.value)} onBlur={() => handleRenameCategory(fullPath, buildCatPath(parent, renameCategoryValue))} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(fullPath, buildCatPath(parent, renameCategoryValue)); if (e.key === 'Escape') setRenamingCategory(null); }} autoFocus />
                                                            </div>
                                                        ) : confirmDeleteCat === fullPath ? (
                                                            <div className="py-0.5 px-1 bg-rose-50 border border-rose-200 rounded-lg">
                                                                <p className="text-[8px] font-bold text-rose-600 mb-1">删除「{child}」？{childCount > 0 && `（${childCount}个方案→未分类）`}</p>
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => handleDeleteCategory(fullPath)} className="flex-1 py-0.5 bg-rose-500 text-white rounded text-[7px] font-black">删除</button>
                                                                    <button onClick={() => setConfirmDeleteCat(null)} className="flex-1 py-0.5 bg-white text-slate-500 rounded text-[7px] font-black border border-slate-200">取消</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setActiveCategory(fullPath)} className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between gap-1 ${childActive ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}>
                                                                <span className="flex items-center gap-1.5 truncate">
                                                                    <i className={`fa-solid fa-file-alt text-[8px] ${childActive ? 'text-indigo-400' : 'text-slate-300'}`} />
                                                                    <span className="truncate">{child}</span>
                                                                </span>
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    <div className="flex gap-0.5 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                                                        <button onClick={(e) => { e.stopPropagation(); setRenamingCategory(fullPath); setRenameCategoryValue(child); }} className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all" title="重命名"><i className="fa-solid fa-pen text-[6px]" /></button>
                                                                        <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteCat(fullPath); }} className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all" title="删除"><i className="fa-solid fa-trash-can text-[6px]" /></button>
                                                                    </div>
                                                                    <span className={`text-[8px] font-black px-1 py-0.5 rounded-full ${childActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>{childCount}</span>
                                                                </div>
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* 展开但无子分类 */}
                                    {isExpanded && children.length === 0 && (
                                        <div className="ml-5 pl-2 border-l-2 border-slate-200/50 mt-0.5 mb-1">
                                            <p className="text-[8px] text-slate-300 italic py-1 pl-2">暂无子分类</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 新建分类 */}
                    <div className="p-3 border-t border-slate-100">
                        {isCreatingCategory ? (
                            <div className="space-y-1.5">
                                {/* 模式切换 */}
                                <div className="flex bg-slate-100 rounded-lg p-0.5">
                                    <button onClick={() => setCreateMode('parent')} className={`flex-1 py-1 text-[8px] font-black rounded-md transition-all ${createMode === 'parent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                                        <i className="fa-solid fa-folder-plus text-[7px] mr-1" />一级分类
                                    </button>
                                    <button onClick={() => setCreateMode('child')} className={`flex-1 py-1 text-[8px] font-black rounded-md transition-all ${createMode === 'child' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>
                                        <i className="fa-solid fa-file-circle-plus text-[7px] mr-1" />二级子分类
                                    </button>
                                </div>

                                {createMode === 'parent' ? (
                                    <div className="flex gap-1.5">
                                        <input className="flex-1 bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-50" placeholder="如：NiFe基催化剂" value={newParentName} onChange={(e) => setNewParentName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setIsCreatingCategory(false); }} autoFocus />
                                        <button onClick={handleCreateCategory} className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all shadow-sm"><i className="fa-solid fa-check text-[9px]" /></button>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <select value={createUnderParent} onChange={(e) => setCreateUnderParent(e.target.value)} className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none">
                                            <option value="">选择一级分类...</option>
                                            {parentCategories.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <div className="flex gap-1.5">
                                            <input className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-amber-50" placeholder="如：水热合成" value={newChildName} onChange={(e) => setNewChildName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setIsCreatingCategory(false); }} autoFocus={!!createUnderParent} />
                                            <button onClick={handleCreateCategory} className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-all shadow-sm"><i className="fa-solid fa-check text-[9px]" /></button>
                                        </div>
                                    </div>
                                )}
                                <button onClick={() => { setIsCreatingCategory(false); setNewParentName(''); setNewChildName(''); }} className="w-full py-1 text-[8px] font-bold text-slate-400 hover:text-slate-600 transition-colors">取消</button>
                            </div>
                        ) : (
                            <button onClick={() => { setCreateMode('parent'); setIsCreatingCategory(true); }} className="w-full py-2.5 bg-white border-2 border-dashed border-slate-200 text-slate-400 rounded-xl text-[10px] font-bold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all flex items-center justify-center gap-1.5">
                                <i className="fa-solid fa-folder-plus text-[10px]" /> 新建分类
                            </button>
                        )}
                    </div>
                </div>

                {/* ═══ 右侧：方案列表 ═══ */}
                <div className="flex-1 flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div>
                            <h4 className="text-base font-black text-slate-800 uppercase italic tracking-tight leading-none flex items-center gap-2">
                                {activeCategory === ALL_CATEGORY ? (
                                    '全部方案'
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <i className="fa-solid fa-folder-open text-amber-400 text-sm" />
                                        {activeCatDisplay}
                                    </span>
                                )}
                                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full normal-case not-italic">{filteredItems.length} 项</span>
                            </h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {searchQuery ? `搜索: "${searchQuery}"` : '点击卡片加载 · 右侧按钮可重命名、移动分类或删除'}
                            </p>
                        </div>
                        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white hover:shadow-lg hover:border-slate-300 transition-all active:scale-95">
                            <i className="fa-solid fa-xmark text-base" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2.5">
                        {filteredItems.length > 0 ? (
                            filteredItems.map(item => (
                                <SchemeCard key={item.id} item={item} onLoad={handleLoadAndClose} onDelete={onDelete} onRename={onRename} onCategoryChange={onCategoryChange} categories={allCategories} renderExtra={renderExtra} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
                                    <i className="fa-solid fa-folder-open text-3xl text-slate-200" />
                                </div>
                                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{searchQuery ? '未找到匹配方案' : '暂无方案'}</p>
                                <p className="text-[10px] text-slate-300 font-bold">{searchQuery ? '尝试其他关键词或切换分类' : '保存当前设计后，方案将出现在这里'}</p>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-3 border-t border-slate-100 text-center shrink-0">
                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest italic">方案保存在本地浏览器缓存中 · Local Storage</p>
                    </div>
                </div>
            </div>
        </div>
    , document.body);
}
