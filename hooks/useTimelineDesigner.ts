import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { TimelineData, TimelineEvent, SavedTimeline } from '../types/visuals';
import { generateTimelineDataAI, generateFigureTitleAI } from '../services/gemini/flowchart';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';

const MAX_HISTORY = 50;

export const useTimelineDesigner = (isActive: boolean) => {
    const { startGlobalTask, showToast, activeTasks, timelineSession, updateTimelineSession } = useProjectContext();
    const [data, setDataRaw] = useState<TimelineData | null>(timelineSession.data);
    const [userPrompt, setUserPrompt] = useState(timelineSession.userPrompt);
    const [zoom, setZoom] = useState(1);
    const [activeEventId, setActiveEventId] = useState<string | null>(null);
    const [showLibrary, setShowLibrary] = useState(false);
    const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [isNamingAI, setIsNamingAI] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null!);
    // 当前已保存的库项 ID（用于快速覆盖保存）
    const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

    // ====== 撤回/重做历史管理 ======
    const undoStackRef = useRef<(TimelineData | null)[]>([]);
    const redoStackRef = useRef<(TimelineData | null)[]>([]);
    const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });

    // 更新历史计数（触发重渲染，以让 UI 反映 canUndo/canRedo 状态）
    const syncHistorySize = useCallback(() => {
        setHistorySize({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
    }, []);

    // 代替 setData 的带历史的设置方法（需要记录历史时用此方法）
    const setData = useCallback((newData: TimelineData | null) => {
        setDataRaw(prev => {
            undoStackRef.current = [prev, ...undoStackRef.current].slice(0, MAX_HISTORY);
            redoStackRef.current = [];
            return newData;
        });
        syncHistorySize();
    }, [syncHistorySize]);

    const canUndo = historySize.undo > 0;
    const canRedo = historySize.redo > 0;

    const undo = useCallback(() => {
        if (undoStackRef.current.length === 0) return;
        setDataRaw(prev => {
            const [top, ...rest] = undoStackRef.current;
            undoStackRef.current = rest;
            redoStackRef.current = [prev, ...redoStackRef.current].slice(0, MAX_HISTORY);
            syncHistorySize();
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
            syncHistorySize();
            return top;
        });
        setTimeout(syncHistorySize, 0);
    }, [syncHistorySize]);

    // 同步状态到全局 session
    useEffect(() => {
        updateTimelineSession({ data, userPrompt });
    }, [data, userPrompt, updateTimelineSession]);

    const [savedTimelines, setSavedTimelines] = useState<SavedTimeline[]>(() => {
        try {
            const saved = localStorage.getItem('sciflow_timelines_library');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem('sciflow_timelines_library', JSON.stringify(savedTimelines));
    }, [savedTimelines]);

    const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'timeline_gen'), [activeTasks]);

    const handleCreateEmpty = () => {
        const emptyData: TimelineData = {
            title: "未命名演进路线",
            pathType: 'straight',
            theme: 'default',
            axisWidth: 4,
            arrowWidth: 4,
            glowIntensity: 5,
            axisColor: '#6366f1',
            gradientPreset: 'rainbow',
            arrowStyle: 'classic',
            showArrow: true,
            isHollow: true,
            distributionMode: 'proportional',
            events: [
                {
                    id: `ev_${Date.now()}`,
                    date: "2024-01",
                    title: "起始节点",
                    description: "在此输入您的研究起点...",
                    type: 'milestone',
                    side: 'top'
                }
            ]
        };
        setData(emptyData);
        setActiveEventId(emptyData.events[0].id);
        showToast({ message: "空白画布已就绪", type: 'info' });
    };

    const handleGenerate = async () => {
        if (!userPrompt.trim()) return;
        await startGlobalTask({ id: 'timeline_gen', type: 'transformation', status: 'running', title: '正在推演研究演进轨迹...' }, async () => {
            const result = await generateTimelineDataAI(userPrompt, aiLanguage);
            if (result) {
                const events = result.events || [];
                if (events.length === 0) {
                    showToast({ message: "AI 未能提取到有效节点，请尝试更详细的描述", type: 'info' });
                    return;
                }
                setData({
                    ...result,
                    events,
                    pathType: 'straight',
                    theme: 'default',
                    axisWidth: 4,
                    arrowWidth: 4,
                    glowIntensity: 5,
                    axisColor: '#6366f1',
                    gradientPreset: 'rainbow',
                    arrowStyle: 'classic',
                    showArrow: true,
                    isHollow: true,
                    distributionMode: 'proportional'
                });
                showToast({ message: "AI 建模完成", type: 'success' });
            }
        });
    };

    const updateEvent = (id: string, updates: Partial<TimelineEvent>) => {
        if (!data) return;
        setData({
            ...data,
            events: data.events.map(ev => ev.id === id ? { ...ev, ...updates } : ev)
        });
    };

    const addEvent = () => {
        if (!data) return;
        const lastEvent = data.events[data.events.length - 1];
        const newEv: TimelineEvent = {
            id: `ev_${Date.now()}`,
            date: new Date().toISOString().slice(0, 7),
            title: "新里程碑",
            description: "描述内容...",
            type: 'milestone',
            side: lastEvent?.side === 'top' ? 'bottom' : 'top'
        };
        setData({ ...data, events: [...data.events, newEv] });
        setActiveEventId(newEv.id);
    };

    const deleteEvent = (id: string) => {
        if (!data) return;
        setData({ ...data, events: data.events.filter(ev => ev.id !== id) });
        if (activeEventId === id) setActiveEventId(null);
    };

    const handleSaveToLibrary = useCallback(async () => {
        if (!data) {
            showToast({ message: "画布为空，无法保存", type: 'info' });
            return;
        }
        setShowSaveModal(true);
        setSaveTitle('正在 AI 智能命名...');
        setIsNamingAI(true);

        try {
            const eventTexts = data.events.map(ev => ev.title).join(', ');
            const aiTitle = await generateFigureTitleAI(eventTexts || "空白科研演进轨迹", '科研发展演进');
            setSaveTitle(aiTitle);
        } catch (e) {
            setSaveTitle(data.title || `演进路线_${new Date().toLocaleDateString()}`);
        } finally {
            setIsNamingAI(false);
        }
    }, [data, showToast]);

    const handleConfirmSave = useCallback((asNew?: boolean) => {
        if (!data || !saveTitle.trim()) return;
        const now = new Date().toLocaleString();
        if (!asNew && currentSavedId) {
            // 覆盖已有记录
            setSavedTimelines(prev => prev.map(s =>
                s.id === currentSavedId ? { ...s, title: saveTitle, timestamp: now, data: JSON.parse(JSON.stringify(data)) } : s
            ));
        } else {
            // 新建记录
            const newId = Date.now().toString();
            const newSave: SavedTimeline = {
                id: newId,
                title: saveTitle,
                timestamp: now,
                data: JSON.parse(JSON.stringify(data))
            };
            setSavedTimelines(prev => [newSave, ...prev]);
            setCurrentSavedId(newId);
        }
        setShowSaveModal(false);
        setSaveTitle('');
        showToast({ message: "演进路线已存入库", type: 'success' });
    }, [data, saveTitle, currentSavedId, showToast]);

    const handleLoadFromLibrary = (item: SavedTimeline) => {
        const loadedData = JSON.parse(JSON.stringify(item.data)) as TimelineData;
        if (loadedData.showArrow === undefined || loadedData.showArrow === null) {
            loadedData.showArrow = true;
        }
        if (!loadedData.arrowStyle) {
            loadedData.arrowStyle = 'classic';
        }
        setData(loadedData);
        setCurrentSavedId(item.id); // 记录当前就是这个库项
        setShowLibrary(false);
        showToast({ message: `已加载: ${item.title}`, type: 'info' });
    };


    // Import React to fix 'Cannot find namespace React' error when using React.MouseEvent.
    const handleDeleteFromLibrary = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedTimelines(prev => prev.filter(s => s.id !== id));
    };

    const handleRenameInLibrary = (id: string, newTitle: string) => {
        setSavedTimelines(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    };

    const handleExport = async () => {
        if (!containerRef.current || !data) return;
        showToast({ message: "正在生成学术演进路线高精度 PNG...", type: 'info' });

        try {
            // 根据节点分布计算最小裁剪区域
            const nodeElements = Array.from(containerRef.current.querySelectorAll('.timeline-node-item')) as HTMLElement[];

            // 设定默认安全边距
            const paddingX = 60;
            const paddingY = 40;

            // 计算边界 (基于 SVG 坐标系 1000x400)
            // 这里我们简单导出整个路径区域，但确保容器包含所有节点及其气泡内容
            const blob = await htmlToImage.toBlob(containerRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                cacheBust: true,
                // 我们不进行特殊的偏移裁剪，直接导出整个画布容器内容，依靠 scale(1) 还原原始精度
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'center center',
                }
            });

            if (blob) {
                saveAs(blob, `Timeline_${data.title.replace(/\s+/g, '_')}_${Date.now()}.png`);
                showToast({ message: "导出成功", type: 'success' });
            }
        } catch (e) {
            console.error("Export Error:", e);
            showToast({ message: "导出失败", type: 'error' });
        }
    };

    // 快速保存：有已保存记录则静默覆盖，无则弹对话框
    const handleQuickSave = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        if (currentSavedId) {
            // 直接覆盖
            const now = new Date().toLocaleString();
            const existing = savedTimelines.find(s => s.id === currentSavedId);
            setSavedTimelines(prev => prev.map(s =>
                s.id === currentSavedId
                    ? { ...s, timestamp: now, data: JSON.parse(JSON.stringify(data)) }
                    : s
            ));
            showToast({ message: `已覆盖保存「${existing?.title || '当前方案'}」`, type: 'success' });
        } else {
            // 新方案，启动命名流程
            await handleSaveToLibrary();
        }
    }, [data, currentSavedId, savedTimelines, handleSaveToLibrary, showToast]);

    // 另存为：始终弹对话框
    const handleSaveAs = useCallback(async () => {
        if (!data) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        setCurrentSavedId(null); // 清除 ID，确保保存为新记录
        await handleSaveToLibrary();
    }, [data, handleSaveToLibrary, showToast]);

    // 状态已由顶级 FigureCenter 统一通过 FigureHeaderProps 分发

    return {
        data, setData, userPrompt, setUserPrompt, isGenerating, zoom, setZoom,
        activeEventId, setActiveEventId, savedTimelines, showLibrary, setShowLibrary,
        aiLanguage, setAiLanguage,
        handleGenerate, updateEvent, addEvent, deleteEvent, handleCreateEmpty,
        handleSaveToLibrary, handleConfirmSave, handleLoadFromLibrary, handleDeleteFromLibrary, handleRenameInLibrary,
        showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, isNamingAI,
        containerRef, handleExport,
        undo, redo, canUndo, canRedo,
        currentSavedId, handleQuickSave, handleSaveAs,
    };
};