import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import {
    ClassificationTreeData, ClassificationTreeNode,
    SavedClassificationTree, TreeLayoutDirection
} from '../types/visuals';
import { generateClassificationTreeAI, generateFigureTitleAI } from '../services/gemini/flowchart';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';

const MAX_HISTORY = 50;
const TREE_CURRENT_KEY = 'sciflow_tree_current';

// 默认层级颜色调色板
const DEFAULT_LEVEL_COLORS = [
    '#6366f1', // root - indigo
    '#ec4899', // L1 - pink
    '#f59e0b', // L2 - amber
    '#10b981', // L3 - emerald
    '#8b5cf6', // L4 - violet
    '#ef4444', // L5 - red
];

export const useClassificationTree = () => {
    const { startGlobalTask, showToast, activeTasks } = useProjectContext();

    const [data, setDataRaw] = useState<ClassificationTreeData | null>(() => {
        try {
            const raw = localStorage.getItem(TREE_CURRENT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });
    const [userPrompt, setUserPrompt] = useState('');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');

    // Library
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null!);

    // Undo/Redo
    const undoStackRef = useRef<(ClassificationTreeData | null)[]>([]);
    const redoStackRef = useRef<(ClassificationTreeData | null)[]>([]);
    const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });

    const syncHistorySize = useCallback(() => {
        setHistorySize({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
    }, []);

    const setData = useCallback((newData: ClassificationTreeData | null) => {
        setDataRaw(prev => {
            undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
            redoStackRef.current = [];
            return newData;
        });
        syncHistorySize();
        // 自动持久化当前编辑数据
        try {
            if (newData) {
                localStorage.setItem(TREE_CURRENT_KEY, JSON.stringify(newData));
            } else {
                localStorage.removeItem(TREE_CURRENT_KEY);
            }
        } catch { }
    }, [syncHistorySize]);

    const canUndo = historySize.undo > 0;
    const canRedo = historySize.redo > 0;

    const undo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        setDataRaw(prev => {
            const [top, ...rest] = undoStackRef.current;
            undoStackRef.current = rest;
            redoStackRef.current = [prev, ...redoStackRef.current].slice(0, MAX_HISTORY);
            return top;
        });
        setTimeout(syncHistorySize, 0);
    }, [syncHistorySize]);

    const redo = useCallback(() => {
        if (redoStackRef.current.length === 0) return;
        setDataRaw(prev => {
            const [top, ...rest] = redoStackRef.current;
            redoStackRef.current = rest;
            undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
            return top;
        });
        setTimeout(syncHistorySize, 0);
    }, [syncHistorySize]);

    // Saved library
    const [savedTrees, setSavedTrees] = useState<SavedClassificationTree[]>(() => {
        try {
            const saved = localStorage.getItem('sciflow_classification_trees_library');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    // Persist saved trees
    React.useEffect(() => {
        localStorage.setItem('sciflow_classification_trees_library', JSON.stringify(savedTrees));
    }, [savedTrees]);

    const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'classification_tree_gen'), [activeTasks]);

    // Create empty tree
    const handleCreateEmpty = useCallback(() => {
        const emptyData: ClassificationTreeData = {
            title: '未命名分类树',
            layout: 'TB',
            theme: 'default',
            horizontalSpacing: 60,
            verticalSpacing: 100,
            levelColors: [...DEFAULT_LEVEL_COLORS],
            connectionStyle: {
                color: '#94a3b8',
                width: 2,
                style: 'solid',
                curveType: 'bezier',
            },
            rootNode: {
                id: `node_${Date.now()}`,
                label: '根节点',
                description: '请编辑此节点或使用AI生成',
                icon: 'fa-solid fa-sitemap',
                depth: 0,
                children: [
                    {
                        id: `node_${Date.now()}_1`,
                        label: '分类 A',
                        icon: 'fa-solid fa-folder',
                        depth: 1,
                        children: []
                    },
                    {
                        id: `node_${Date.now()}_2`,
                        label: '分类 B',
                        icon: 'fa-solid fa-folder',
                        depth: 1,
                        children: []
                    },
                    {
                        id: `node_${Date.now()}_3`,
                        label: '分类 C',
                        icon: 'fa-solid fa-folder',
                        depth: 1,
                        children: []
                    }
                ]
            }
        };
        setData(emptyData);
        showToast({ message: '空白分类树已就绪', type: 'info' });
    }, [setData, showToast]);

    // AI Generate
    const handleGenerate = useCallback(async () => {
        if (!userPrompt.trim()) return;
        await startGlobalTask({ id: 'classification_tree_gen', type: 'transformation', status: 'running', title: '正在推演分类层级结构...' }, async () => {
            const result = await generateClassificationTreeAI(userPrompt, aiLanguage);
            if (result?.rootNode) {
                const treeData: ClassificationTreeData = {
                    title: result.title || '分类层级图',
                    rootNode: result.rootNode,
                    layout: 'TB',
                    theme: 'default',
                    horizontalSpacing: 60,
                    verticalSpacing: 100,
                    levelColors: [...DEFAULT_LEVEL_COLORS],
                    connectionStyle: {
                        color: '#94a3b8',
                        width: 2,
                        style: 'solid',
                        curveType: 'bezier',
                    }
                };
                setData(treeData);
                showToast({ message: 'AI 分类树建模完成', type: 'success' });
            }
        });
    }, [userPrompt, aiLanguage, startGlobalTask, setData, showToast]);

    // Node operations
    const findAndUpdate = useCallback((root: ClassificationTreeNode, nodeId: string, updater: (n: ClassificationTreeNode) => ClassificationTreeNode | null): ClassificationTreeNode | null => {
        if (root.id === nodeId) return updater(root);
        if (!root.children) return root;
        const newChildren: ClassificationTreeNode[] = [];
        for (const child of root.children) {
            const result = findAndUpdate(child, nodeId, updater);
            if (result !== null) newChildren.push(result);
        }
        return { ...root, children: newChildren };
    }, []);

    const updateNode = useCallback((nodeId: string, updates: Partial<ClassificationTreeNode>) => {
        if (!data) return;
        const newRoot = findAndUpdate(data.rootNode, nodeId, n => ({ ...n, ...updates }));
        if (newRoot) setData({ ...data, rootNode: newRoot });
    }, [data, findAndUpdate, setData]);

    const deleteNode = useCallback((nodeId: string) => {
        if (!data) return;
        if (nodeId === data.rootNode.id) {
            showToast({ message: '不能删除根节点', type: 'error' });
            return;
        }
        const newRoot = findAndUpdate(data.rootNode, nodeId, () => null);
        if (newRoot) setData({ ...data, rootNode: newRoot });
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }, [data, findAndUpdate, setData, selectedNodeId, showToast]);

    const addChildNode = useCallback((parentId: string) => {
        if (!data) return;
        const newChild: ClassificationTreeNode = {
            id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            label: '新节点',
            icon: 'fa-solid fa-tag',
            children: []
        };
        const newRoot = findAndUpdate(data.rootNode, parentId, n => ({
            ...n,
            collapsed: false,
            children: [...(n.children || []), newChild]
        }));
        if (newRoot) setData({ ...data, rootNode: newRoot });
        setSelectedNodeId(newChild.id);
    }, [data, findAndUpdate, setData]);

    const toggleCollapse = useCallback((nodeId: string) => {
        if (!data) return;
        const newRoot = findAndUpdate(data.rootNode, nodeId, n => ({
            ...n,
            collapsed: !n.collapsed
        }));
        if (newRoot) setData({ ...data, rootNode: newRoot });
    }, [data, findAndUpdate, setData]);

    // Layout change
    const setLayout = useCallback((layout: TreeLayoutDirection) => {
        if (!data) return;
        setData({ ...data, layout });
    }, [data, setData]);

    // Save to library
    const handleSaveToLibrary = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        setShowSaveModal(true);
        setSaveTitle('正在 AI 智能命名...');
        try {
            const nodeLabels = getAllLabels(data.rootNode);
            const aiTitle = await generateFigureTitleAI(nodeLabels.join(', '), '分类层级图');
            setSaveTitle(aiTitle);
        } catch {
            setSaveTitle(data.title || `分类树_${new Date().toLocaleDateString()}`);
        }
    }, [data, showToast]);

    const handleConfirmSave = useCallback((asNew?: boolean) => {
        if (!data || !saveTitle.trim()) return;
        const now = new Date().toLocaleString();
        if (!asNew && currentSavedId) {
            setSavedTrees(prev => prev.map(s =>
                s.id === currentSavedId ? { ...s, title: saveTitle, timestamp: now, data: JSON.parse(JSON.stringify(data)) } : s
            ));
        } else {
            const newId = Date.now().toString();
            const newSave: SavedClassificationTree = {
                id: newId,
                title: saveTitle,
                timestamp: now,
                data: JSON.parse(JSON.stringify(data))
            };
            setSavedTrees(prev => [newSave, ...prev]);
            setCurrentSavedId(newId);
        }
        setShowSaveModal(false);
        setSaveTitle('');
        showToast({ message: '分类树已存入库', type: 'success' });
    }, [data, saveTitle, currentSavedId, showToast]);

    const handleLoadFromLibrary = useCallback((item: SavedClassificationTree) => {
        const loadedData = JSON.parse(JSON.stringify(item.data)) as ClassificationTreeData;
        setData(loadedData);
        setCurrentSavedId(item.id);
        setShowLibrary(false);
        showToast({ message: `已加载: ${item.title}`, type: 'info' });
    }, [setData, showToast]);

    const handleDeleteFromLibrary = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedTrees(prev => prev.filter(s => s.id !== id));
    }, []);

    const handleRenameInLibrary = useCallback((id: string, newTitle: string) => {
        setSavedTrees(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    }, []);

    const handleCategoryChange = useCallback((id: string, newCategory: string) => {
        setSavedTrees(prev => prev.map(s => s.id === id ? { ...s, category: newCategory } : s));
    }, []);

    // Export
    const handleExport = useCallback(async () => {
        if (!containerRef.current || !data) return;
        showToast({ message: '正在生成分类树高精度 PNG...', type: 'info' });
        try {
            const blob = await htmlToImage.toBlob(containerRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                cacheBust: true,
            });
            if (blob) {
                saveAs(blob, `ClassificationTree_${data.title.replace(/\s+/g, '_')}_${Date.now()}.png`);
                showToast({ message: '导出成功', type: 'success' });
            }
        } catch (e) {
            console.error('Export Error:', e);
            showToast({ message: '导出失败', type: 'error' });
        }
    }, [data, showToast]);

    // Quick save
    const handleQuickSave = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        if (currentSavedId) {
            const now = new Date().toLocaleString();
            const existing = savedTrees.find(s => s.id === currentSavedId);
            setSavedTrees(prev => prev.map(s =>
                s.id === currentSavedId ? { ...s, timestamp: now, data: JSON.parse(JSON.stringify(data)) } : s
            ));
            showToast({ message: `已覆盖保存「${existing?.title || '当前方案'}」`, type: 'success' });
        } else {
            await handleSaveToLibrary();
        }
    }, [data, currentSavedId, savedTrees, handleSaveToLibrary, showToast]);

    const handleSaveAs = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        setCurrentSavedId(null);
        await handleSaveToLibrary();
    }, [data, handleSaveToLibrary, showToast]);

    return {
        data, setData, userPrompt, setUserPrompt,
        selectedNodeId, setSelectedNodeId,
        zoom, setZoom, pan, setPan,
        aiLanguage, setAiLanguage,
        isGenerating, containerRef,
        handleCreateEmpty, handleGenerate,
        updateNode, deleteNode, addChildNode, toggleCollapse,
        setLayout,
        savedTrees, showLibrary, setShowLibrary,
        showSaveModal, setShowSaveModal, saveTitle, setSaveTitle,
        handleSaveToLibrary, handleConfirmSave, handleLoadFromLibrary,
        handleDeleteFromLibrary, handleRenameInLibrary, handleCategoryChange,
        handleExport,
        undo, redo, canUndo, canRedo,
        currentSavedId, handleQuickSave, handleSaveAs,
    };
};

// Helper: collect all labels from tree
function getAllLabels(node: ClassificationTreeNode): string[] {
    const labels = [node.label];
    if (node.children) {
        for (const child of node.children) {
            labels.push(...getAllLabels(child));
        }
    }
    return labels;
}
