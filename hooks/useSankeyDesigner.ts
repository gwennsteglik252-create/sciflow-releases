/**
 * useSankeyDesigner.ts
 * ─────────────────────────────────────────────────────────────────
 * 桑基图（Sankey Diagram）完整状态管理 Hook
 *
 * 提供：
 *  - data / setData（带 undo/redo）
 *  - AI 生成数据（generateSankeyDataAI）
 *  - 空白创建
 *  - 节点/连线的增删改
 *  - 保存到库 / 从库加载（localStorage 持久化）
 *  - PNG 导出
 *  - zoom 控制
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { SankeyData, SankeyNode, SankeyLink, SavedSankey } from '../types/visuals';
import { generateSankeyDataAI, generateFigureTitleAI } from '../services/gemini/flowchart';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';
import { DEFAULT_SANKEY_PALETTE } from '../components/FigureCenter/Sankey/sankeyLayout';

const MAX_HISTORY = 50;
const STORAGE_KEY = 'sciflow_sankey_library';
const CURRENT_DATA_KEY = 'sciflow_sankey_current';

// ─── 默认空白数据 ─────────────────────────────────────────────────────────────
function buildDefaultSankey(): SankeyData {
    return {
        title: '未命名桑基图',
        nodeWidth: 16,
        nodePadding: 12,
        alignment: 'justify',
        curveType: 'bezier',
        showValues: true,
        valueUnit: '',
        colorPalette: [...DEFAULT_SANKEY_PALETTE],
        theme: 'default',
        backgroundColor: '#ffffff',
        labelStyle: { fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: '500', color: '#1e293b' },
        nodes: [
            { id: 'source_a', label: '来源 A', description: '主要输入来源' },
            { id: 'source_b', label: '来源 B', description: '次要输入来源' },
            { id: 'process_1', label: '中间过程', description: '转化/处理阶段' },
            { id: 'output_x', label: '输出 X', description: '主要产出' },
            { id: 'output_y', label: '损耗', description: '过程损耗' },
        ],
        links: [
            { id: 'l1', source: 'source_a', target: 'process_1', value: 70 },
            { id: 'l2', source: 'source_b', target: 'process_1', value: 30 },
            { id: 'l3', source: 'process_1', target: 'output_x', value: 80 },
            { id: 'l4', source: 'process_1', target: 'output_y', value: 20 },
        ],
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useSankeyDesigner = () => {
    const { startGlobalTask, showToast, activeTasks } = useProjectContext();

    // ── 核心数据 & undo/redo ───────────────────────────────────────────────────
    const [data, setDataRaw] = useState<SankeyData | null>(() => {
        try {
            const raw = localStorage.getItem(CURRENT_DATA_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });
    const [userPrompt, setUserPrompt] = useState('');
    const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');
    const [aiComplexity, setAiComplexity] = useState<'simple' | 'moderate' | 'complex'>('moderate');
    const [zoom, setZoom] = useState(1);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    const undoStackRef = useRef<(SankeyData | null)[]>([]);
    const redoStackRef = useRef<(SankeyData | null)[]>([]);
    const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });

    const syncHistorySize = useCallback(() => {
        setHistorySize({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
    }, []);

    /** 带历史的 setData（需要记录撤销时用此方法） */
    const setData = useCallback((newData: SankeyData | null) => {
        setDataRaw(prev => {
            undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
            redoStackRef.current = [];
            return newData;
        });
        syncHistorySize();
        // 自动持久化当前编辑数据
        try {
            if (newData) {
                localStorage.setItem(CURRENT_DATA_KEY, JSON.stringify(newData));
            } else {
                localStorage.removeItem(CURRENT_DATA_KEY);
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

    // ── 库管理（localStorage 持久化） ─────────────────────────────────────────
    const [savedSankeyList, setSavedSankeyList] = useState<SavedSankey[]>(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSankeyList));
    }, [savedSankeyList]);

    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

    // ── 生成状态 ──────────────────────────────────────────────────────────────
    const isGenerating = useMemo(
        () => activeTasks.some(t => t.id === 'sankey_gen'),
        [activeTasks]
    );

    // ── containerRef（供导出 PNG 使用） ───────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null!);

    // ─────────────────────────────────────────────────────────────────────────
    // 创建空白桑基图
    // ─────────────────────────────────────────────────────────────────────────
    const handleCreateEmpty = useCallback(() => {
        setData(buildDefaultSankey());
        setSelectedNodeId(null);
        showToast({ message: '空白桑基图已就绪', type: 'info' });
    }, [setData, showToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // AI 生成
    // ─────────────────────────────────────────────────────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!userPrompt.trim()) return;
        await startGlobalTask(
            { id: 'sankey_gen', type: 'transformation', status: 'running', title: '正在构建流量转化路径...' },
            async () => {
                const result = await generateSankeyDataAI(userPrompt, aiLanguage, aiComplexity);
                if (result && result.nodes.length > 0 && result.links.length > 0) {
                    const sankeyData: SankeyData = {
                        ...buildDefaultSankey(),
                        title: result.title || '流量转化图',
                        nodes: result.nodes as SankeyNode[],
                        links: result.links.map((l: any, idx: number) => ({
                            id: l.id || `link_${idx}`,
                            source: l.source,
                            target: l.target,
                            value: l.value,
                            label: l.label,
                        })) as SankeyLink[],
                    };
                    setData(sankeyData);
                    setSelectedNodeId(null);
                    showToast({ message: 'AI 桑基图建模完成', type: 'success' });
                } else {
                    showToast({ message: 'AI 未能返回有效数据，请调整描述后重试', type: 'info' });
                }
            }
        );
    }, [userPrompt, aiLanguage, aiComplexity, startGlobalTask, setData, showToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // 节点操作
    // ─────────────────────────────────────────────────────────────────────────
    const updateNode = useCallback((nodeId: string, updates: Partial<SankeyNode>) => {
        if (!data) return;
        setData({
            ...data,
            nodes: data.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
        });
    }, [data, setData]);

    const addNode = useCallback(() => {
        if (!data) return;
        const newNode: SankeyNode = {
            id: `node_${Date.now()}`,
            label: '新节点',
            description: '',
        };
        setData({ ...data, nodes: [...data.nodes, newNode] });
        setSelectedNodeId(newNode.id);
    }, [data, setData]);

    const deleteNode = useCallback((nodeId: string) => {
        if (!data) return;
        // 删除节点同时删除关联连线
        const newLinks = data.links.filter(l => l.source !== nodeId && l.target !== nodeId);
        setData({ ...data, nodes: data.nodes.filter(n => n.id !== nodeId), links: newLinks });
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
    }, [data, setData, selectedNodeId]);

    // ─────────────────────────────────────────────────────────────────────────
    // 连线操作
    // ─────────────────────────────────────────────────────────────────────────
    const updateLink = useCallback((linkId: string, updates: Partial<SankeyLink>) => {
        if (!data) return;
        setData({
            ...data,
            links: data.links.map(l => l.id === linkId ? { ...l, ...updates } : l),
        });
    }, [data, setData]);

    const addLink = useCallback((source: string, target: string, value: number = 10) => {
        if (!data) return;
        // 防止重复连线和自环
        if (source === target) return;
        const exists = data.links.some(l => l.source === source && l.target === target);
        if (exists) {
            showToast({ message: '该连线已存在', type: 'info' });
            return;
        }
        const newLink: SankeyLink = {
            id: `link_${Date.now()}`,
            source, target, value,
        };
        setData({ ...data, links: [...data.links, newLink] });
    }, [data, setData, showToast]);

    const deleteLink = useCallback((linkId: string) => {
        if (!data) return;
        setData({ ...data, links: data.links.filter(l => l.id !== linkId) });
    }, [data, setData]);

    // ─────────────────────────────────────────────────────────────────────────
    // 全局属性更新
    // ─────────────────────────────────────────────────────────────────────────
    const updateGlobal = useCallback((updates: Partial<SankeyData>) => {
        if (!data) return;
        setData({ ...data, ...updates });
    }, [data, setData]);

    // ─────────────────────────────────────────────────────────────────────────
    // 保存到库
    // ─────────────────────────────────────────────────────────────────────────
    const handleSaveToLibrary = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        setShowSaveModal(true);
        setSaveTitle('正在 AI 智能命名...');
        try {
            const nodeLabels = data.nodes.map(n => n.label).join(', ');
            const aiTitle = await generateFigureTitleAI(nodeLabels || '桑基流量图', '桑基图');
            setSaveTitle(aiTitle);
        } catch {
            setSaveTitle(data.title || `桑基图_${new Date().toLocaleDateString()}`);
        }
    }, [data, showToast]);

    const handleConfirmSave = useCallback((asNew?: boolean) => {
        if (!data || !saveTitle.trim()) return;
        const now = new Date().toLocaleString();
        if (!asNew && currentSavedId) {
            setSavedSankeyList(prev => prev.map(s =>
                s.id === currentSavedId
                    ? { ...s, title: saveTitle, timestamp: now, data: JSON.parse(JSON.stringify(data)) }
                    : s
            ));
        } else {
            const newId = Date.now().toString();
            const newSave: SavedSankey = {
                id: newId,
                title: saveTitle,
                timestamp: now,
                data: JSON.parse(JSON.stringify(data)),
            };
            setSavedSankeyList(prev => [newSave, ...prev]);
            setCurrentSavedId(newId);
        }
        setShowSaveModal(false);
        setSaveTitle('');
        showToast({ message: '桑基图已存入库', type: 'success' });
    }, [data, saveTitle, currentSavedId, showToast]);

    const handleLoadFromLibrary = useCallback((item: SavedSankey) => {
        setData(JSON.parse(JSON.stringify(item.data)) as SankeyData);
        setCurrentSavedId(item.id);
        setShowLibrary(false);
        setSelectedNodeId(null);
        showToast({ message: `已加载: ${item.title}`, type: 'info' });
    }, [setData, showToast]);

    const handleDeleteFromLibrary = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedSankeyList(prev => prev.filter(s => s.id !== id));
    }, []);

    const handleRenameInLibrary = useCallback((id: string, newTitle: string) => {
        setSavedSankeyList(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    }, []);

    const handleCategoryChange = useCallback((id: string, newCategory: string) => {
        setSavedSankeyList(prev => prev.map(s => s.id === id ? { ...s, category: newCategory } : s));
    }, []);

    const handleQuickSave = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        if (currentSavedId) {
            const now = new Date().toLocaleString();
            const existing = savedSankeyList.find(s => s.id === currentSavedId);
            setSavedSankeyList(prev => prev.map(s =>
                s.id === currentSavedId
                    ? { ...s, timestamp: now, data: JSON.parse(JSON.stringify(data)) }
                    : s
            ));
            showToast({ message: `已覆盖保存「${existing?.title || '当前方案'}」`, type: 'success' });
        } else {
            await handleSaveToLibrary();
        }
    }, [data, currentSavedId, savedSankeyList, handleSaveToLibrary, showToast]);

    const handleSaveAs = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        setCurrentSavedId(null);
        await handleSaveToLibrary();
    }, [data, handleSaveToLibrary, showToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // PNG 导出
    // ─────────────────────────────────────────────────────────────────────────
    const handleExport = useCallback(async () => {
        if (!containerRef.current || !data) return;
        showToast({ message: '正在生成桑基图高精度 PNG...', type: 'info' });
        try {
            const blob = await htmlToImage.toBlob(containerRef.current, {
                backgroundColor: data.backgroundColor ?? '#ffffff',
                pixelRatio: 3,
                cacheBust: true,
            });
            if (blob) {
                saveAs(blob, `Sankey_${data.title.replace(/\s+/g, '_')}_${Date.now()}.png`);
                showToast({ message: '导出成功', type: 'success' });
            }
        } catch (e) {
            console.error('Sankey export error:', e);
            showToast({ message: '导出失败', type: 'error' });
        }
    }, [data, showToast]);

    // ─────────────────────────────────────────────────────────────────────────
    // 返回
    // ─────────────────────────────────────────────────────────────────────────
    return {
        // 数据
        data, setData,
        userPrompt, setUserPrompt,
        aiLanguage, setAiLanguage,
        aiComplexity, setAiComplexity,
        // 视图
        zoom, setZoom,
        selectedNodeId, setSelectedNodeId,
        containerRef,
        // 生成状态
        isGenerating,
        // 操作
        handleCreateEmpty, handleGenerate,
        updateNode, addNode, deleteNode,
        updateLink, addLink, deleteLink,
        updateGlobal,
        // 库管理
        savedSankeyList,
        showLibrary, setShowLibrary,
        showSaveModal, setShowSaveModal,
        saveTitle, setSaveTitle,
        handleSaveToLibrary, handleConfirmSave,
        handleLoadFromLibrary, handleDeleteFromLibrary, handleRenameInLibrary, handleCategoryChange,
        handleQuickSave, handleSaveAs,
        currentSavedId,
        // 历史
        undo, redo, canUndo, canRedo,
        // 导出
        handleExport,
    };
};
