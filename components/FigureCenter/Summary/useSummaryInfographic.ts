
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useProjectContext } from '../../../context/ProjectContext';
import { CircularSummaryData, SummarySegment, SavedCircularSummary, SummaryLayer, LayerConfig } from '../../../types';
import { generateSummaryInfographic, generateSummaryThumbnail, removeImageBackground, generateFigureTitleAI } from '../../../services/gemini/flowchart';
import { translatePromptToEnglish } from '../../../services/gemini/writing';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';
import { resizeForAI, ACADEMIC_PALETTES, hslToHex } from './SummaryUtils';

export const useSummaryInfographic = () => {
    const { projects, setProjects, showToast, startGlobalTask, activeTasks } = useProjectContext();
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [customTopic, setCustomTopic] = useState('');
    const [useCustomTopic, setUseCustomTopic] = useState(false);
    const [activePaletteIdx, setActivePaletteIdx] = useState(0);
    const [autoRemoveBg, setAutoRemoveBg] = useState(false);
    const [isSyncAllLayersEnabled, setIsSyncAllLayersEnabled] = useState(false);
    const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');

    const [history, setHistory] = useState<CircularSummaryData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const fileInputRef = useRef<HTMLInputElement>(null!);
    const coreFileInputRef = useRef<HTMLInputElement>(null!);
    const containerRef = useRef<HTMLDivElement>(null!);

    useEffect(() => {
        if (!selectedProjectId && projects.length > 0) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, selectedProjectId]);

    const activeProject = useMemo(() => {
        const p = projects.find(p => p.id === selectedProjectId);
        return p || projects[0] || null;
    }, [projects, selectedProjectId]);

    const infographicData = activeProject?.circularSummary || null;

    useEffect(() => {
        if (infographicData && history.length === 0) {
            setHistory([JSON.parse(JSON.stringify(infographicData))]);
            setHistoryIndex(0);
        }
    }, [infographicData]);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const recordState = useCallback((newData: CircularSummaryData) => {
        const snapshot = JSON.parse(JSON.stringify(newData));
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            next.push(snapshot);
            if (next.length > 50) next.shift();
            return next;
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const handleUndo = useCallback(() => {
        if (!canUndo) return;
        const targetIdx = historyIndex - 1;
        const prevState = history[targetIdx];
        setHistoryIndex(targetIdx);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: JSON.parse(JSON.stringify(prevState)) } : p));
        }
        showToast({ message: '已撤销', type: 'info' });
    }, [canUndo, history, historyIndex, selectedProjectId, setProjects, showToast]);

    const handleRedo = useCallback(() => {
        if (!canRedo) return;
        const targetIdx = historyIndex + 1;
        const nextState = history[targetIdx];
        setHistoryIndex(targetIdx);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: JSON.parse(JSON.stringify(nextState)) } : p));
        }
        showToast({ message: '已重做', type: 'info' });
    }, [canRedo, history, historyIndex, selectedProjectId, setProjects, showToast]);

    const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'summary_gen'), [activeTasks]);
    const isGeneratingThumbnails = useMemo(() => activeTasks.some(t => t.id === 'thumbs_gen' || String(t.id).startsWith('thumb_gen_') || t.id === 'core_thumb_gen' || t.id === 'remove_bg'), [activeTasks]);

    const [editingSegment, setEditingSegment] = useState<{ layerId: string, segment: SummarySegment } | null>(null);
    const [editingLayer, setEditingLayer] = useState<SummaryLayer | null>(null);
    const [isEditingCore, setIsEditingCore] = useState(false);

    const [zoom, setZoom] = useState(0.7);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const mouseMovedRef = useRef(false);

    useEffect(() => {
        setPan({ x: 0, y: 0 });
    }, [selectedProjectId]);

    const [showAddLayerModal, setShowAddLayerModal] = useState(false);
    const [newLayerName, setNewLayerName] = useState('');
    const [showRenameLayerModal, setShowRenameLayerModal] = useState(false);
    const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
    const [tempLayerName, setTempLayerName] = useState('');

    const [savedSummaries, setSavedSummaries] = useState<SavedCircularSummary[]>(() => {
        try { return JSON.parse(localStorage.getItem('sciflow_summary_library') || '[]'); } catch { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveTitle, setSaveTitle] = useState('');
    const [isNamingAI, setIsNamingAI] = useState(false);
    const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('sciflow_summary_library', JSON.stringify(savedSummaries));
    }, [savedSummaries]);


    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.button === 0 || e.button === 1)) {
            const target = e.target as HTMLElement;
            if (target.closest('button')) return;
            setIsPanning(true);
            mouseMovedRef.current = false;
            panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const dx = Math.abs(e.clientX - (panStartRef.current.x + pan.x));
            const dy = Math.abs(e.clientY - (panStartRef.current.y + pan.y));
            if (dx > 3 || dy > 3) mouseMovedRef.current = true;
            setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomFactor = 0.05;
            const direction = e.deltaY > 0 ? -1 : 1;
            setZoom(prev => Math.min(3, Math.max(0.2, prev + direction * zoomFactor)));
        } else {
            setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
    };

    // Keyboard Shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if no input is focused, OR if Cmd/Ctrl is pressed (likely a shortcut)
            const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
            const isMod = e.metaKey || e.ctrlKey;

            if (isMod && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (isMod && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const handleGenerate = async () => {
        const topic = useCustomTopic ? customTopic : activeProject?.title;
        if (!topic) {
            showToast({ message: useCustomTopic ? '请输入自定义主题' : '未检测到项目数据，请先创建或进入一个项目', type: 'info' });
            return;
        }

        try {
            await startGlobalTask(
                { id: 'summary_gen', type: 'transformation', status: 'running', title: '构建综述圆环结构...' },
                async () => {
                    const data = await generateSummaryInfographic(topic, aiLanguage);
                    if (data && data.layers && data.layers.length > 0) {
                        const enhancedData: CircularSummaryData = {
                            title: data.title || topic,
                            coreIcon: data.coreIcon || 'fa-atom',
                            coreImagePrompt: data.coreImagePrompt,
                            coreThumbnailUrl: data.coreThumbnailUrl,
                            layers: data.layers.map((l: any) => ({
                                id: l.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                name: l.name || '未命名层级',
                                segments: (l.segments || []).map((s: any) => ({
                                    id: s.id || `seg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                    title: s.title || '未命名区块',
                                    content: s.content || '',
                                    color: s.color || '#e2e8f0',
                                    imagePrompt: s.imagePrompt || '',
                                    images: s.images || []
                                }))
                            }))

                        };
                        recordState(enhancedData);
                        if (selectedProjectId) {
                            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: enhancedData } : p));
                        }
                        showToast({ message: '综述结构已生成', type: 'success' });
                    } else {
                        showToast({ message: '无法解析 AI 生成的结构，请稍后重试', type: 'error' });
                    }
                }
            );
        } catch (error: any) {
            console.error("[Summary Generator] Failed:", error);
            showToast({
                message: error?.message || '综述结构生成失败，请检查网络或配置',
                type: 'error'
            });
        }

    };

    const handleGenerateThumbnail = async (layerId: string, segmentId: string, prompt: string) => {
        if (!infographicData) return;
        const taskTitle = `渲染: ${prompt.substring(0, 10)}...`;

        try {
            await startGlobalTask(
                { id: `thumb_gen_${segmentId}`, type: 'image_gen', status: 'running', title: taskTitle },
                async () => {
                    const englishPrompt = await translatePromptToEnglish(prompt);
                    const imageUrl = await generateSummaryThumbnail(englishPrompt);

                    if (imageUrl) {
                        let processedUrl = imageUrl;
                        if (autoRemoveBg) {
                            const noBgUrl = await removeImageBackground(imageUrl);
                            if (noBgUrl) processedUrl = noBgUrl;
                        }

                        const newImage = { id: Date.now().toString(), url: processedUrl };

                        const nextLayers = infographicData.layers.map(l => {
                            if (l.id === layerId) {
                                return {
                                    ...l,
                                    segments: l.segments.map(s => {
                                        if (s.id === segmentId) {
                                            return { ...s, images: [newImage] };
                                        }
                                        return s;
                                    })
                                };
                            }
                            return l;
                        });

                        const newData = { ...infographicData, layers: nextLayers };
                        recordState(newData);

                        if (selectedProjectId) {
                            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
                        }
                    }
                }
            );
        } catch (error) {
            showToast({ message: '子图表生图失败，触发网关频率限制', type: 'error' });
        }
    };

    const handleGenerateAllThumbnails = async () => {
        if (!infographicData) return;

        const tasks: (() => Promise<void>)[] = [];

        if (infographicData.coreImagePrompt && !infographicData.coreThumbnailUrl) {
            tasks.push(async () => {
                try {
                    await startGlobalTask(
                        { id: 'core_thumb_gen', type: 'image_gen', status: 'running', title: '渲染核心插图...' },
                        async () => {
                            const englishPrompt = await translatePromptToEnglish(infographicData.coreImagePrompt!);
                            const url = await generateSummaryThumbnail(englishPrompt);
                            if (url) {
                                let processedUrl = url;
                                if (autoRemoveBg) {
                                    const noBgUrl = await removeImageBackground(url);
                                    if (noBgUrl) processedUrl = noBgUrl;
                                }
                                const newData = { ...infographicData, coreThumbnailUrl: processedUrl };
                                recordState(newData);
                                if (selectedProjectId) setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
                            }
                        }
                    );
                } catch (error) {
                    showToast({ message: '核心插图渲染失败', type: 'error' });
                }
            });
        }

        infographicData.layers.forEach(layer => {
            layer.segments.forEach(seg => {
                if (seg.imagePrompt && (!seg.images || seg.images.length === 0)) {
                    tasks.push(() => handleGenerateThumbnail(layer.id, seg.id, seg.imagePrompt));
                }
            });
        });

        if (tasks.length === 0) return;

        for (const task of tasks) {
            await task();
        }
        showToast({ message: '批量渲染任务已完成', type: 'success' });
    };

    const handleGenerateCoreThumbnail = async () => {
        if (!infographicData || !infographicData.coreImagePrompt) return;
        try {
            await startGlobalTask(
                { id: 'core_thumb_gen', type: 'image_gen', status: 'running', title: '渲染核心插图...' },
                async () => {
                    const englishPrompt = await translatePromptToEnglish(infographicData.coreImagePrompt!);
                    const url = await generateSummaryThumbnail(englishPrompt);
                    if (url) {
                        let processedUrl = url;
                        if (autoRemoveBg) {
                            const noBgUrl = await removeImageBackground(url);
                            if (noBgUrl) processedUrl = noBgUrl;
                        }
                        const newData = { ...infographicData, coreThumbnailUrl: processedUrl };
                        recordState(newData);
                        if (selectedProjectId) {
                            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
                        }
                    }
                }
            );
        } catch (error) {
            showToast({ message: '核心插图渲染失败，请重试', type: 'error' });
        }
    };

    const handleRemoveBgManual = async (base64: string, type: 'core' | 'segment', id?: string) => {
        if (!infographicData) return;
        try {
            await startGlobalTask(
                { id: 'remove_bg', type: 'image_gen', status: 'running', title: 'AI 智能去除背景...' },
                async () => {
                    const noBgUrl = await removeImageBackground(base64);
                    if (!noBgUrl) {
                        showToast({ message: '背景去除失败', type: 'error' });
                        return;
                    }

                    let newData = { ...infographicData };
                    if (type === 'core') {
                        newData.coreThumbnailUrl = noBgUrl;
                    } else if (type === 'segment' && id) {
                        const nextLayers = newData.layers.map(l => ({
                            ...l,
                            segments: l.segments.map(s => ({
                                ...s,
                                images: s.images?.map(img => img.id === id ? { ...img, url: noBgUrl } : img)
                            }))
                        }));
                        newData.layers = nextLayers;
                    }

                    recordState(newData);
                    if (selectedProjectId) {
                        setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
                    }
                    showToast({ message: '背景已移除', type: 'success' });
                }
            );
        } catch (error) {
            showToast({ message: '云端扣除背景失败', type: 'error' });
        }
    };

    const handleLayerUpdate = (layerId: string, updates: Partial<SummaryLayer>) => {
        if (!infographicData) return;

        let updatedLayer: SummaryLayer | null = null;
        const configToSync = (isSyncAllLayersEnabled && updates.config) ? updates.config : null;

        const nextLayers = infographicData.layers.map(l => {
            if (configToSync) {
                const updated = { ...l, config: { ...(l.config || {}), ...configToSync } };
                // 同步模式下同样记录当前被编辑层的最新值，确保 setEditingLayer 能被调用
                if (l.id === layerId) updatedLayer = updated;
                return updated;
            }
            if (l.id === layerId) {
                const newL = {
                    ...l,
                    ...updates,
                    config: (updates.config && l.config)
                        ? { ...l.config, ...updates.config }
                        : (updates.config || l.config)
                };
                updatedLayer = newL;
                return newL;
            }
            return l;
        });

        const newData = { ...infographicData, layers: nextLayers };
        recordState(newData);

        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }

        if (editingLayer && editingLayer.id === layerId && updatedLayer) {
            setEditingLayer(updatedLayer);
        }
    };

    const handleCoreUpdate = (updates: Partial<CircularSummaryData>) => {
        if (!infographicData) return;
        const newData = { ...infographicData, ...updates };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
    };

    const handleAddLayer = () => {
        setShowAddLayerModal(true);
        setNewLayerName('');
    };

    const confirmAddLayer = () => {
        if (!infographicData || !newLayerName.trim()) return;
        const newLayer: SummaryLayer = {
            id: `layer_${Date.now()}`,
            name: newLayerName,
            segments: [
                { id: `seg_${Date.now()}_1`, title: 'Topic 1', content: 'Description...', color: '#e2e8f0', imagePrompt: '' },
                { id: `seg_${Date.now()}_2`, title: 'Topic 2', content: 'Description...', color: '#e2e8f0', imagePrompt: '' },
                { id: `seg_${Date.now()}_3`, title: 'Topic 3', content: 'Description...', color: '#e2e8f0', imagePrompt: '' }
            ]
        };
        const newData = { ...infographicData, layers: [...infographicData.layers, newLayer] };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
        setShowAddLayerModal(false);
    };

    const handleRenameLayerTrigger = (layerId: string, currentName: string) => {
        setRenamingLayerId(layerId);
        setTempLayerName(currentName);
        setShowRenameLayerModal(true);
    };

    const confirmRenameLayer = () => {
        if (!infographicData || !renamingLayerId || !tempLayerName.trim()) return;
        handleLayerUpdate(renamingLayerId, { name: tempLayerName });
        setShowRenameLayerModal(false);
        setRenamingLayerId(null);
    };

    const handleAddSegment = (layerId: string) => {
        if (!infographicData) return;
        const layer = infographicData.layers.find(l => l.id === layerId);
        if (!layer) return;
        const newSeg: SummarySegment = {
            id: `seg_${Date.now()}`,
            title: 'New Segment',
            content: 'Content...',
            color: '#e2e8f0',
            imagePrompt: ''
        };
        handleLayerUpdate(layerId, { segments: [...layer.segments, newSeg] });
    };

    const handleRemoveSegment = (layerId: string, segmentId: string) => {
        if (!infographicData) return;
        const layer = infographicData.layers.find(l => l.id === layerId);
        if (!layer) return;
        handleLayerUpdate(layerId, { segments: layer.segments.filter(s => s.id !== segmentId) });
        if (editingSegment?.segment.id === segmentId) setEditingSegment(null);
    };

    const handleExport = async () => {
        if (!containerRef.current) return;
        const svgElement = containerRef.current.querySelector('svg');
        if (!svgElement) return;

        showToast({ message: "正在分析综述拓扑边界进行紧凑裁剪...", type: 'info' });

        try {
            // 1. Get the actual bounding box of the SVG content
            // Note: SVG getBBox() returns coordinates in the SVG's coordinate system (viewBox).
            const bbox = svgElement.getBBox();

            // 2. Add some safety padding for text height, shadows, and labels (e.g. 60px)
            const padding = 60;
            const x = bbox.x - padding;
            const y = bbox.y - padding;
            const width = bbox.width + padding * 2;
            const height = bbox.height + padding * 2;

            // 3. Since the SVG might be inside a div with p-12 (48px)
            // we need to offset the capture correctly.
            // In SummaryPreview.tsx, the structure is containerRef -> div(p-12) -> svg
            // So the SVG's top-left is at (48, 48) inside containerRef.
            const offsetInContainer = 48;

            const blob = await htmlToImage.toBlob(containerRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                width: width,
                height: height,
                style: {
                    // Shift the capture window to start exactly at the start of our content
                    // relative to the containerRef's origin.
                    transform: `translate(${- (x + offsetInContainer)}px, ${- (y + offsetInContainer)}px) scale(1)`,
                    transformOrigin: 'top left',
                    margin: '0',
                    padding: '0'
                }
            });

            if (blob) {
                saveAs(blob, `Summary_Infographic_${Date.now()}.png`);
                showToast({ message: '导出成功(已自动优化间距)', type: 'success' });
            }
        } catch (e) {
            console.error("Export failed:", e);
            showToast({ message: '导出失败', type: 'error' });
        }
    };

    const handleAutoColor = (overridePaletteIdx?: number) => {
        if (!infographicData) return;
        const idx = overridePaletteIdx ?? activePaletteIdx;
        const palette = ACADEMIC_PALETTES[idx];
        if (!palette) return;

        // 智能分离深色（用于核心/标识）和浅色（用于区块填充）
        const isLight = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
        };
        const strongColors = palette.colors.filter(c => !isLight(c));
        const coreColor = strongColors.length > 0
            ? strongColors[strongColors.length - 1]
            : palette.colors[palette.colors.length - 1];

        const nextLayers = infographicData.layers.map((l, lIdx) => {
            const baseColor = palette.colors[lIdx % palette.colors.length];
            return {
                ...l,
                segments: l.segments.map((s) => ({
                    ...s,
                    color: baseColor
                }))
            };
        });
        const newData = { ...infographicData, layers: nextLayers, coreColor };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
    };

    const handleSmartRandomColor = () => {
        if (!infographicData) return;

        /**
         * 宝石色调随机配色生成器 (Jewel Tone Generator)
         * 
         * 设计原理：
         * 参考顶刊综述/TOC 图中的高级环形图配色（如附件参考图）
         * 每个颜色都是"宝石色调"——深邃、浓郁、有质感
         * 
         * 核心策略：
         * 1. 预定义 24 个"贵族色相锚点"，每个锚点都经过精心调配
         *    避开了容易显廉价的色域（如纯黄绿、纯青色等）
         * 2. 每个锚点有独立的饱和度/亮度参数，因为不同色相在
         *    同一饱和度下观感完全不同（例如黄色需要更低饱和度才不刺眼）
         * 3. 随机打乱顺序后依次分配，施加微小扰动保证每次不同
         */

        // [色相, 饱和度, 亮度] — 参考附图色调：鲜艳明亮、饱满丰富
        const VIVID_ANCHORS: [number, number, number][] = [
            [0, 72, 48],      // Ruby 红宝石
            [12, 78, 52],     // Vermillion 朱砂红
            [25, 82, 55],     // Bright Orange 亮橙
            [38, 70, 62],     // Warm Gold 暖金
            [48, 62, 65],     // Wheat Gold 麦金
            [85, 55, 48],     // Olive Green 橄榄绿
            [145, 60, 42],    // Emerald 翡翠绿
            [165, 65, 42],    // Teal 青绿
            [180, 62, 45],    // Cyan Teal 青色
            [200, 70, 52],    // Sky Blue 天蓝
            [215, 75, 55],    // Bright Blue 亮蓝
            [230, 65, 48],    // Royal Blue 皇家蓝
            [255, 55, 48],    // Indigo 靛青
            [270, 58, 48],    // Amethyst 紫水晶
            [285, 55, 42],    // Deep Purple 深紫
            [310, 55, 48],    // Plum 梅子紫
            [325, 62, 50],    // Magenta 品红
            [345, 68, 45],    // Wine Red 酒红
            [190, 58, 40],    // Dark Teal 暗青
            [155, 55, 38],    // Forest 森林绿
            [18, 72, 48],     // Terracotta 赤陶
            [55, 55, 52],     // Bronze Gold 青铜金
            [240, 50, 42],    // Midnight Blue 午夜蓝
            [355, 70, 46],    // Crimson 绯红
        ];

        const toHex = (h: number, s: number, l: number): string => {
            s /= 100; l /= 100;
            const a = s * Math.min(l, 1 - l);
            const f = (n: number) => {
                const k = (n + h / 30) % 12;
                const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.max(0, Math.min(255, Math.round(255 * c))).toString(16).padStart(2, '0');
            };
            return `#${f(0)}${f(8)}${f(4)}`;
        };

        // Fisher-Yates 洗牌
        const shuffled = [...VIVID_ANCHORS];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // 为每个区块分配一个鲜艳色，施加微扰
        let segIdx = 0;
        const nextLayers = infographicData.layers.map((l) => ({
            ...l,
            segments: l.segments.map((s) => {
                const [h, s_base, l_base] = shuffled[segIdx % shuffled.length];
                // 微扰：色相 ±8°, 饱和度 ±5%, 亮度 ±5%
                const jH = (h + Math.round((Math.random() - 0.5) * 16) + 360) % 360;
                const jS = Math.min(88, Math.max(45, s_base + Math.round((Math.random() - 0.5) * 10)));
                const jL = Math.min(68, Math.max(38, l_base + Math.round((Math.random() - 0.5) * 10)));
                segIdx++;
                return { ...s, color: toHex(jH, jS, jL) };
            })
        }));

        // 核心：用深色版本
        const coreAnchor = shuffled[Math.floor(Math.random() * 6)];
        const coreColor = toHex(coreAnchor[0], coreAnchor[1] - 5, 22);

        const newData = { ...infographicData, layers: nextLayers, coreColor };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
        showToast({ message: '已生成随机配色', type: 'success' });
    };

    const handleUploadCoreImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await resizeForAI(await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.readAsDataURL(file);
            }));
            handleCoreUpdate({ coreThumbnailUrl: base64 });
            if (coreFileInputRef.current) coreFileInputRef.current.value = '';
        }
    };

    const handleUploadSegmentImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !editingSegment || !infographicData) return;

        // 批量将所有选中图片转为 base64
        const newImgs = await Promise.all(
            Array.from(files).map(async (file, idx) => {
                const base64 = await resizeForAI(await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target?.result as string);
                    reader.readAsDataURL(file);
                }));
                return { id: `${Date.now()}_${idx}`, url: base64, scale: 1, radialOffset: 0, angularOffset: 0 };
            })
        );

        const nextLayers = infographicData.layers.map(l => {
            if (l.id === editingSegment.layerId) {
                return {
                    ...l,
                    segments: l.segments.map(s => {
                        if (s.id === editingSegment.segment.id) {
                            return { ...s, images: [...(s.images || []), ...newImgs] };
                        }
                        return s;
                    })
                };
            }
            return l;
        });
        const newData = { ...infographicData, layers: nextLayers };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
        // 同步更新 editingSegment，避免 SegmentEditor 拿到旧的 segment
        const updatedSeg = nextLayers
            .find(l => l.id === editingSegment.layerId)
            ?.segments.find(s => s.id === editingSegment.segment.id);
        if (updatedSeg) {
            setEditingSegment({ ...editingSegment, segment: updatedSeg });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleLocalEditChange = (updates: Partial<SummarySegment>) => {
        if (!editingSegment || !infographicData) return;
        const nextLayers = infographicData.layers.map(l => {
            if (l.id === editingSegment.layerId) {
                return {
                    ...l,
                    segments: l.segments.map(s => s.id === editingSegment.segment.id ? { ...s, ...updates } : s)
                };
            }
            return l;
        });
        const newData = { ...infographicData, layers: nextLayers };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
        setEditingSegment({ ...editingSegment, segment: { ...editingSegment.segment, ...updates } });
    };

    const handleSaveToLibrary = useCallback(async () => {
        if (!infographicData) return;
        setShowSaveModal(true);
        setSaveTitle('正在 AI 智能命名...');
        setIsNamingAI(true);

        try {
            const segmentTexts = infographicData.layers.flatMap(l => l.segments.map(s => s.title)).join(', ');
            const aiTitle = await generateFigureTitleAI(segmentTexts || infographicData.title || "综述信息图", '综述圆环信息图');
            setSaveTitle(aiTitle);
        } catch (e) {
            setSaveTitle(`综述_${new Date().toLocaleDateString()}`);
        } finally {
            setIsNamingAI(false);
        }
    }, [infographicData]);

    const confirmSaveToLibrary = () => {
        if (!infographicData || !saveTitle.trim()) return;
        const now = new Date().toLocaleString();
        if (currentSavedId) {
            setSavedSummaries(prev => prev.map(s =>
                s.id === currentSavedId ? { ...s, title: saveTitle, timestamp: now, data: JSON.parse(JSON.stringify(infographicData)) } : s
            ));
        } else {
            const newId = Date.now().toString();
            const newSave: SavedCircularSummary = {
                id: newId,
                title: saveTitle,
                timestamp: now,
                data: JSON.parse(JSON.stringify(infographicData))
            };
            setSavedSummaries(prev => [newSave, ...prev]);
            setCurrentSavedId(newId);
        }
        setShowSaveModal(false);
        showToast({ message: "综述方案已保存", type: 'success' });
    };

    const handleLoadSaved = (item: SavedCircularSummary) => {
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: JSON.parse(JSON.stringify(item.data)) } : p));
        }
        recordState(item.data);
        setCurrentSavedId(item.id);
        setShowLibrary(false);
        showToast({ message: `已加载方案: ${item.title}`, type: 'info' });
    };

    const handleSyncAllLayers = (configToSync: LayerConfig) => {
        if (!infographicData) return;
        const nextLayers = infographicData.layers.map(l => ({
            ...l,
            config: { ...configToSync }
        }));
        const newData = { ...infographicData, layers: nextLayers };
        recordState(newData);
        if (selectedProjectId) {
            setProjects(prev => prev.map(p => p.id === selectedProjectId ? { ...p, circularSummary: newData } : p));
        }
        showToast({ message: '已同步全局配置', type: 'success' });
    };

    const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedSummaries(prev => prev.filter(s => s.id !== id));
    };

    const handleRenameSaved = (id: string, newTitle: string) => {
        setSavedSummaries(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    };

    const handleCategoryChangeSaved = (id: string, newCategory: string) => {
        setSavedSummaries(prev => prev.map(s => s.id === id ? { ...s, category: newCategory } : s));
    };

    // 快速保存
    const handleQuickSave = useCallback(async () => {
        if (!infographicData) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        if (currentSavedId) {
            const now = new Date().toLocaleString();
            const existing = savedSummaries.find(s => s.id === currentSavedId);
            setSavedSummaries(prev => prev.map(s =>
                s.id === currentSavedId
                    ? { ...s, timestamp: now, data: JSON.parse(JSON.stringify(infographicData)) }
                    : s
            ));
            showToast({ message: `已覆盖保存「${existing?.title || '当前方案'}」`, type: 'success' });
        } else {
            await handleSaveToLibrary();
        }
    }, [infographicData, currentSavedId, savedSummaries, handleSaveToLibrary, showToast]);

    // 另存为
    const handleSaveAs = useCallback(async () => {
        if (!infographicData) {
            showToast({ message: '画布为空，无法保存', type: 'info' });
            return;
        }
        setCurrentSavedId(null);
        await handleSaveToLibrary();
    }, [infographicData, handleSaveToLibrary, showToast]);

    return {
        projects,
        selectedProjectId,
        setSelectedProjectId,
        customTopic,
        setCustomTopic,
        useCustomTopic,
        setUseCustomTopic,
        activePaletteIdx,
        setActivePaletteIdx,
        autoRemoveBg,
        setAutoRemoveBg,
        isSyncAllLayersEnabled,
        setIsSyncAllLayersEnabled,
        aiLanguage,
        setAiLanguage,
        infographicData,
        isGenerating,
        isGeneratingThumbnails,
        editingSegment,
        setEditingSegment,
        editingLayer,
        setEditingLayer,
        isEditingCore,
        setIsEditingCore,
        zoom,
        setZoom,
        pan,
        setPan,
        isPanning,
        fileInputRef,
        coreFileInputRef,
        containerRef,
        mouseMovedRef,
        showAddLayerModal,
        setShowAddLayerModal,
        newLayerName,
        setNewLayerName,
        showRenameLayerModal,
        setShowRenameLayerModal,
        tempLayerName,
        setTempLayerName,
        savedSummaries,
        showLibrary,
        setShowLibrary,
        showSaveModal,
        setShowSaveModal,
        saveTitle,
        setSaveTitle,
        activeTasks,
        canUndo,
        canRedo,
        handleUndo,
        handleRedo,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleWheel,
        handleGenerate,
        handleGenerateThumbnail,
        handleGenerateAllThumbnails,
        handleGenerateCoreThumbnail,
        handleRemoveBgManual,
        handleLayerUpdate,
        handleCoreUpdate,
        handleAddLayer,
        confirmAddLayer,
        handleRenameLayerTrigger,
        confirmRenameLayer,
        handleAddSegment,
        handleRemoveSegment,
        handleExport,
        handleAutoColor,
        handleSmartRandomColor,
        handleUploadCoreImage,
        handleUploadSegmentImage,
        handleLocalEditChange,
        handleSaveToLibrary,
        confirmSaveToLibrary,
        handleLoadSaved,
        handleDeleteSaved,
        handleRenameSaved,
        handleSyncAllLayers,
        isNamingAI,
        currentSavedId, handleQuickSave, handleSaveAs, handleCategoryChangeSaved,
    };
};
