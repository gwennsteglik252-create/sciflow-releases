import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { IMAGE_MODEL, callGeminiWithRetry } from '../services/gemini/core';
import { translatePromptToEnglish, enhanceImagePrompt } from '../services/gemini/writing';

export interface GenerationResult {
    url: string;
    timestamp: string;
    style: string;
    prompt: string;
}

export interface Region {
    id: string;
    x: number; // 0-1000
    y: number; // 0-1000
    w: number; // 0-1000
    h: number; // 0-1000
    instruction: string;
}

export const useGenerativeDesigner = () => {
    const { showToast, startGlobalTask, activeTasks } = useProjectContext();

    // --- Generative State ---
    const [userPrompt, setUserPrompt] = useState('');
    const [baseImage, setBaseImage] = useState<string | null>(null);

    // History State for Undo/Redo
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Multi-Region State
    const [regions, setRegions] = useState<Region[]>([]);
    const [activeRegionId, setActiveRegionId] = useState<string | null>(null);

    // Universal Inputs (4 Boxes)
    const [chemContext, setChemContext] = useState('');
    const [bioContext, setBioContext] = useState('');
    const [mechContext, setMechContext] = useState('');
    const [styleContext, setStyleContext] = useState('');

    // Session Results
    const [results, setResults] = useState<GenerationResult[]>([]);

    // Derived loading state
    const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'image_gen_task'), [activeTasks]);

    // Library State
    const [libraryCount, setLibraryCount] = useState(0);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [savedLibrary, setSavedLibrary] = useState<GenerationResult[]>([]);

    const refreshLibrary = useCallback(() => {
        try {
            const saved = localStorage.getItem('sciflow_figure_library_v2');
            if (saved) {
                const parsed = JSON.parse(saved);
                setSavedLibrary(parsed);
                setLibraryCount(parsed.length);
            } else {
                setSavedLibrary([]);
                setLibraryCount(0);
            }
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { refreshLibrary(); }, [refreshLibrary]);

    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
    const [figureStyle, setFigureStyle] = useState<'极简学术示意图 (Scheme)' | '扁平化工业流程图 (Flowchart)' | '顶级期刊 3D 机理图 (High-End 3D Abstract)'>('顶级期刊 3D 机理图 (High-End 3D Abstract)');
    const [aiLanguage, setAiLanguage] = useState<'zh' | 'en'>('zh');

    const assemblePrompt = useCallback(() => {
        const contextParts = [];
        if (chemContext) contextParts.push(`Subject/Material: ${chemContext}`);
        if (bioContext) contextParts.push(`Application/Context: ${bioContext}`);
        if (mechContext) contextParts.push(`Mechanism/Process: ${mechContext}`);
        if (styleContext) contextParts.push(`Visual Style/Layout: ${styleContext}`);

        const contextStr = contextParts.join('\n');

        let stylePrompt = '';
        if (figureStyle === '顶级期刊 3D 机理图 (High-End 3D Abstract)') {
            stylePrompt = `High-impact Graphical Abstract. 3D rendering aesthetic (C4D/Octane). Soft lighting, rich textures. Clean background. Academic color palette.`;
        } else if (figureStyle === '极简学术示意图 (Scheme)') {
            stylePrompt = `Flat vector style scientific schematic. Clean spheres, bold text, clear pathway. Minimalist colors.`;
        } else {
            stylePrompt = `Technical flowchart. Labeled components. Directional arrows. Flat industrial style.`;
        }

        return `${stylePrompt}\nContext:\n${contextStr}\n${userPrompt ? `Additional Details: ${userPrompt}` : ''}`;
    }, [chemContext, bioContext, mechContext, styleContext, figureStyle, userPrompt]);

    // ── AI 智能增强指令 ──
    const [isEnhancing, setIsEnhancing] = useState(false);
    const handleEnhancePrompt = async () => {
        if (isEnhancing || isGenerating) return;
        setIsEnhancing(true);
        try {
            const result = await enhanceImagePrompt({
                subject: chemContext,
                context: bioContext,
                mechanism: mechContext,
                visual: styleContext,
                additional: userPrompt,
                style: figureStyle,
            });
            setChemContext(result.subject);
            setBioContext(result.context);
            setMechContext(result.mechanism);
            setStyleContext(result.visual);
            setUserPrompt(result.additional);
            showToast({ message: '指令已智能增强，请检查各输入框', type: 'success' });
        } catch (error: any) {
            showToast({ message: `增强失败: ${error.message}`, type: 'error' });
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleGenerate = async (mode: 'create' | 'iterate') => {
        if (isGenerating) return;

        const isIteration = mode === 'iterate' && !!baseImage;
        let finalPrompt = '';

        if (isIteration) {
            if (regions.length > 0) {
                const regionInstructions = regions.map((r, i) => {
                    const ymin = Math.round(r.y);
                    const xmin = Math.round(r.x);
                    const ymax = Math.round(r.y + r.h);
                    const xmax = Math.round(r.x + r.w);
                    const instr = r.instruction.trim() || "enhance detail";
                    return `Region #${i + 1} [${ymin}, ${xmin}, ${ymax}, ${xmax}]: ${instr}`;
                }).join('\n');

                finalPrompt = `Edit the image based on the following specific regional instructions:\n${regionInstructions}\n\nGlobal context/background instruction: ${userPrompt || 'Keep the rest consistent.'}`;
            } else {
                finalPrompt = userPrompt || "Improve quality and lighting";
            }
        } else {
            const rawPrompt = assemblePrompt();
            if (aiLanguage === 'en') {
                finalPrompt = await translatePromptToEnglish(rawPrompt);
            } else {
                finalPrompt = rawPrompt;
            }
        }

        await startGlobalTask(
            { id: 'image_gen_task', type: 'image_gen', status: 'running', title: isIteration ? '多区域视觉迭代中...' : '科研视觉建模中...' },
            async () => {
                try {
                    const res = await callGeminiWithRetry(async (ai) => {
                        // 路径一：通过 generateContent + responseModalities 生成图像
                        // 适用于支持图片输出的代理或 Gemini 多模态模型
                        const contents = isIteration && baseImage
                            ? {
                                parts: [
                                    { inlineData: { mimeType: baseImage.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/png', data: baseImage.split(',')[1] } },
                                    { text: finalPrompt }
                                ]
                            }
                            : { parts: [{ text: finalPrompt }] };

                        try {
                            const response = await ai.models.generateContent({
                                model: IMAGE_MODEL,
                                contents,
                                config: {
                                    responseModalities: ['IMAGE', 'TEXT'],
                                }
                            });
                            // 检查是否真的返回了图片
                            const hasParts = response.candidates?.[0]?.content?.parts?.some((p: any) => p.inlineData);
                            if (hasParts) return response;
                        } catch (primaryErr) {
                            console.warn('[Image Gen] generateContent 路径失败，降级到 generateImages:', primaryErr);
                        }

                        // 路径二：Imagen 原生 generateImages API（纯文生图，不支持图片迭代）
                        // 适用于 Google 直连 API 且代理不可用时
                        if (!isIteration) {
                            const imgRes = await ai.models.generateImages({
                                model: 'imagen-3.0-generate-002',
                                prompt: finalPrompt,
                                config: {
                                    numberOfImages: 1,
                                    aspectRatio: aspectRatio,
                                    outputMimeType: 'image/png',
                                }
                            });
                            return { _imagenResponse: imgRes };
                        }

                        throw new Error('图像引擎无法完成此任务，请确保代理支持图片生成或配置有效的 Google API Key。');
                    });

                    let imageUrl = '';

                    // 解析 Imagen 原生响应格式
                    if ((res as any)._imagenResponse) {
                        const imgRes = (res as any)._imagenResponse;
                        const imgData = imgRes.generatedImages?.[0]?.image?.imageBytes;
                        if (imgData) imageUrl = `data:image/png;base64,${imgData}`;
                    } else if (res.candidates?.[0]?.content?.parts) {
                        // 解析 generateContent 多模态响应格式
                        for (const part of res.candidates[0].content.parts) {
                            if (part.inlineData) {
                                imageUrl = `data:image/png;base64,${part.inlineData.data}`;
                                break;
                            }
                        }
                    }

                    if (!imageUrl) throw new Error("AI 引擎未返回有效图像流。请检查模型是否支持图片生成（代理模型：需支持 responseModalities IMAGE；直连：需有效 Gemini API Key）。");

                    const newResult: GenerationResult = {
                        url: imageUrl,
                        timestamp: new Date().toLocaleTimeString(),
                        style: isIteration ? 'Iterated' : figureStyle,
                        prompt: finalPrompt
                    };

                    setResults(prev => [newResult, ...prev]);

                    if (isIteration) {
                        const newHistory = history.slice(0, historyIndex + 1);
                        newHistory.push(imageUrl);
                        setHistory(newHistory);
                        setHistoryIndex(newHistory.length - 1);
                        setBaseImage(imageUrl);
                        setRegions([]);
                        showToast({ message: '迭代完成，结果已更新', type: 'success' });
                    } else {
                        showToast({ message: '图像已生成，请在下部图库中查看', type: 'success' });
                    }

                } catch (error: any) {
                    console.error(error);
                    showToast({ message: `生成失败: ${error.message}`, type: 'error' });
                }
            }
        );
    };

    const handleUndoHistory = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setBaseImage(history[newIndex]);
            setRegions([]);
        }
    };

    const handleRedoHistory = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setBaseImage(history[newIndex]);
            setRegions([]);
        }
    };

    const handleExitIteration = () => {
        setBaseImage(null);
        setHistory([]);
        setHistoryIndex(-1);
        setRegions([]);
    };

    const handleDownload = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `SciFlow_Figure_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSelectForIteration = (result: GenerationResult) => {
        setBaseImage(result.url);
        setHistory([result.url]);
        setHistoryIndex(0);
        setRegions([]);
        setUserPrompt('');
        showToast({ message: '已载入底图，请框选区域进行修改', type: 'info' });
    };

    const handleUploadBaseImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            setBaseImage(url);
            setHistory([url]);
            setHistoryIndex(0);
            setRegions([]);
            setUserPrompt('');
            showToast({ message: '外部图片载入成功，进入迭代模式', type: 'success' });
        };
        reader.readAsDataURL(file);
    };

    const handleResetSession = () => {
        if (window.confirm('确定清空当前画布吗？')) {
            setResults([]);
            handleExitIteration();
        }
    };

    const saveCurrentToLibrary = () => {
        if (results.length === 0) return;
        try {
            const currentLib = localStorage.getItem('sciflow_figure_library_v2');
            const libData: GenerationResult[] = currentLib ? JSON.parse(currentLib) : [];
            const newLib = [...results, ...libData];
            localStorage.setItem('sciflow_figure_library_v2', JSON.stringify(newLib));
            refreshLibrary();
            showToast({ message: '已归档至云端图库', type: 'success' });
        } catch (e) {
            showToast({ message: '保存失败 (Storage Quota)', type: 'error' });
        }
    };

    const deleteFromLibrary = (index: number) => {
        const newLib = [...savedLibrary];
        newLib.splice(index, 1);
        setSavedLibrary(newLib);
        setLibraryCount(newLib.length);
        localStorage.setItem('sciflow_figure_library_v2', JSON.stringify(newLib));
    };

    const addRegion = (x: number, y: number, w: number, h: number) => {
        const newRegion: Region = {
            id: Date.now().toString(),
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(h),
            instruction: ''
        };
        setRegions([...regions, newRegion]);
        setActiveRegionId(newRegion.id);
    };

    const updateRegionInstruction = (id: string, text: string) => {
        setRegions(regions.map(r => r.id === id ? { ...r, instruction: text } : r));
    };

    const deleteRegion = (id: string) => {
        setRegions(regions.filter(r => r.id !== id));
        if (activeRegionId === id) setActiveRegionId(null);
    };

    return {
        userPrompt, setUserPrompt,
        chemContext, setChemContext,
        bioContext, setBioContext,
        mechContext, setMechContext,
        styleContext, setStyleContext,
        isGenerating,
        baseImage, setBaseImage,
        history, historyIndex, handleUndoHistory, handleRedoHistory, handleExitIteration,
        regions, activeRegionId, setActiveRegionId,
        addRegion, updateRegionInstruction, deleteRegion,
        results,
        aspectRatio, setAspectRatio,
        figureStyle, setFigureStyle,
        aiLanguage, setAiLanguage,
        handleGenerate,
        handleEnhancePrompt,
        isEnhancing,
        handleDownload,
        handleSelectForIteration,
        handleUploadBaseImage,
        handleResetSession,
        saveCurrentToLibrary,
        libraryCount,
        showLibraryModal, setShowLibraryModal,
        savedLibrary,
        deleteFromLibrary,
        refreshLibrary
    };
};