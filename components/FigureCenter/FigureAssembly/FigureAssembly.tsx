import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGenerativeDesigner } from '../../../hooks/useGenerativeDesigner';
import { FigureReorderModal } from './FigureReorderModal';
import { FigurePanel, SavedFigureAssembly, FigureText, FigureShape } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { AssemblySidebar } from './AssemblySidebar';
import { AssemblyCanvas } from './AssemblyCanvas';
import { AssemblyModals } from './AssemblyModals';
import { LayerPanel } from './LayerPanel';
import { useFigureAssemblyLogic } from '../../../hooks/useFigureAssemblyLogic';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';

const FONT_FAMILIES = [
    { name: 'Arial', value: 'Arial, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { name: 'Courier New', value: '"Courier New", Courier, monospace' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Verdana', value: 'Verdana, sans-serif' },
    { name: 'Impact', value: 'Impact, sans-serif' },
    { name: 'Helvetica', value: 'Helvetica, sans-serif' }
];

export const FigureAssembly: React.FC<{ generativeLogic: ReturnType<typeof useGenerativeDesigner>, logic: ReturnType<typeof useFigureAssemblyLogic> }> = ({ generativeLogic, logic }) => {
    const { savedLibrary } = generativeLogic;
    const { showToast } = useProjectContext();

    const {
        panels, setPanels, layoutConfig, setLayoutConfig, cellAspectRatio, setCellAspectRatio,
        imageFit, setImageFit, showGrid, setShowGrid, localAssets, setLocalAssets,
        activePanelId, setActivePanelId, showReorderModal, setShowReorderModal, canvasScale, setCanvasScale,
        pan, setPan, isProcessingUpload, setIsProcessingUpload, defaultTextStyle, setDefaultTextStyle,
        defaultLabelStyle, setDefaultLabelStyle, clipboard, setClipboard, canUndo, canRedo, undo, redo,
        recordState, calculateLayout, handleBatchUpdate, isDragging, setIsDragging, dragOffset, setDragOffset,
        isPanning, setIsPanning, panStart, setPanStart, containerRef, canvasRef, savedAssemblies, setSavedAssemblies,
        showLibrary, setShowLibrary, showSaveModal, setShowSaveModal, saveTitle, setSaveTitle,
        editingText, setEditingText, selectedText, setSelectedText, selectedShape, setSelectedShape,
        textDragState, setTextDragState, shapeDragState, setShapeDragState, compressImage,
        handleWheel, handleLoadSaved, handleDeleteSaved, handleSaveConfirm, handleDeleteLocalAsset,
        // Layer system
        showLayerPanel, setShowLayerPanel,
        handleUpdatePanelLayer, handleUpdateTextLayer, handleUpdateShapeLayer, handleReorderPanelsByZIndex,
    } = logic;

    const canvasWidth = 1600;
    const canvasHeight = 1200;
    const gridSize = 20;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable) return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (selectedText && activePanelId) {
                    const panel = panels.find(p => p.id === activePanelId);
                    const text = panel?.texts?.find(t => t.id === selectedText.textId);
                    if (text) { setClipboard({ type: 'text', data: text }); showToast({ message: "文本已复制", type: 'success' }); }
                } else if (selectedShape && activePanelId) {
                    const panel = panels.find(p => p.id === activePanelId);
                    const shape = panel?.shapes?.find(s => s.id === selectedShape.shapeId);
                    if (shape) { setClipboard({ type: 'shape', data: shape }); showToast({ message: "图形已复制", type: 'success' }); }
                } else if (activePanelId) {
                    const panel = panels.find(p => p.id === activePanelId);
                    if (panel) { setClipboard({ type: 'panel', data: panel }); showToast({ message: "图片面板已复制", type: 'success' }); }
                }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                if (!clipboard) return;
                if (clipboard.type === 'panel') {
                    const newPanel = JSON.parse(JSON.stringify(clipboard.data));
                    newPanel.id = Date.now().toString() + Math.random().toString().slice(2, 5);
                    newPanel.x += 20; newPanel.y += 20;
                    newPanel.texts?.forEach((t: any) => t.id = Date.now().toString() + Math.random().toString().slice(2, 5));
                    newPanel.shapes?.forEach((s: any) => s.id = Date.now().toString() + Math.random().toString().slice(2, 5));
                    recordState([...panels, newPanel]);
                    setActivePanelId(newPanel.id);
                    showToast({ message: "已粘贴面板", type: 'success' });
                }
                else if ((clipboard.type === 'text' || clipboard.type === 'shape') && activePanelId) {
                    const next = panels.map(p => {
                        if (p.id === activePanelId) {
                            if (clipboard.type === 'text') {
                                const nt = { ...clipboard.data, id: Date.now().toString() + Math.random().toString().slice(2, 5) };
                                nt.x += 15; nt.y += 15;
                                return { ...p, texts: [...(p.texts || []), nt] };
                            } else {
                                const ns = { ...clipboard.data, id: Date.now().toString() + Math.random().toString().slice(2, 5) };
                                ns.x1 += 15; ns.x2 += 15; ns.y1 += 15; ns.y2 += 15;
                                return { ...p, shapes: [...(p.shapes || []), ns] };
                            }
                        }
                        return p;
                    });
                    recordState(next);
                    showToast({ message: "已粘贴元素", type: 'success' });
                }
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedText && activePanelId) {
                    recordState(panels.map(p => p.id === activePanelId ? { ...p, texts: p.texts?.filter(t => t.id !== selectedText.textId) } : p));
                    setSelectedText(null);
                } else if (selectedShape && activePanelId) {
                    recordState(panels.map(p => p.id === activePanelId ? { ...p, shapes: p.shapes?.filter(s => s.id !== selectedShape.shapeId) } : p));
                    setSelectedShape(null);
                } else if (activePanelId && !editingText) {
                    recordState(calculateLayout(panels.filter(p => p.id !== activePanelId), layoutConfig.cols, cellAspectRatio, layoutConfig.rows));
                    setActivePanelId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [clipboard, panels, activePanelId, selectedText, selectedShape, editingText, layoutConfig, cellAspectRatio, recordState, calculateLayout]);

    // 状态已由顶级 FigureCenter 统一通过 FigureHeaderProps 分发

    const handleLayoutChange = (key: 'rows' | 'cols' | 'ratio', val: number) => {
        let newConfig = { ...layoutConfig }; let newRatio = cellAspectRatio;
        if (key === 'rows') newConfig.rows = val; if (key === 'cols') newConfig.cols = val; if (key === 'ratio') newRatio = val;
        recordState(calculateLayout(panels, newConfig.cols, newRatio, newConfig.rows), newConfig, newRatio);
    };

    const handleAddPanel = (imgUrl: string) => {
        const newPanel: FigurePanel = {
            id: Date.now().toString() + Math.random(),
            imgUrl, x: 0, y: 0, w: 100, h: 100,
            label: String.fromCharCode(97 + (panels.length % 26)),
            ...defaultLabelStyle,
            texts: [], shapes: [], spanCols: 1, spanRows: 1
        };
        recordState(calculateLayout([...panels, newPanel], layoutConfig.cols, cellAspectRatio, layoutConfig.rows));
    };

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        const panel = panels.find(p => p.id === id);
        if (panel?.locked) return; // 🔒 locked panels cannot be moved
        e.stopPropagation(); setActivePanelId(id); setSelectedText(null); setSelectedShape(null); setIsDragging(true); setDragOffset({ x: e.clientX, y: e.clientY });
    };

    const handleContainerMouseDown = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget || e.target === containerRef.current || e.target === canvasRef.current) {
            e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            setActivePanelId(null); setSelectedText(null); setSelectedShape(null); setEditingText(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) { setPan({ x: Math.max(-2000, Math.min(2000, e.clientX - panStart.x)), y: Math.max(-2000, Math.min(2000, e.clientY - panStart.y)) }); return; }
        if (textDragState) {
            const dx = (e.clientX - textDragState.startX) / canvasScale, dy = (e.clientY - textDragState.startY) / canvasScale;
            setPanels(prev => prev.map(p => p.id === textDragState.panelId ? { ...p, texts: p.texts?.map(t => t.id === textDragState.textId ? { ...t, x: textDragState.initialX + dx, y: textDragState.initialY + dy } : t) } : p));
            return;
        }
        if (shapeDragState) {
            const dx = (e.clientX - shapeDragState.startX) / canvasScale, dy = (e.clientY - shapeDragState.startY) / canvasScale;
            setPanels(prev => prev.map(p => p.id === shapeDragState.panelId ? {
                ...p,
                shapes: p.shapes?.map(s => {
                    if (s.id !== shapeDragState.shapeId) return s;
                    if (shapeDragState.mode === 'move') return { ...s, x1: shapeDragState.initialX1 + dx, y1: shapeDragState.initialY1 + dy, x2: shapeDragState.initialX2 + dx, y2: shapeDragState.initialY2 + dy };
                    else if (shapeDragState.mode === 'p1') return { ...s, x1: shapeDragState.initialX1 + dx, y1: shapeDragState.initialY1 + dy };
                    else return { ...s, x2: shapeDragState.initialX2 + dx, y2: shapeDragState.initialY2 + dy };
                })
            } : p));
            return;
        }
        if (isDragging && activePanelId) {
            const dx = (e.clientX - dragOffset.x) / canvasScale, dy = (e.clientY - dragOffset.y) / canvasScale;
            setPanels(prev => prev.map(p => {
                if (p.id === activePanelId) {
                    let nx = p.x + dx, ny = p.y + dy;
                    if (showGrid) { const modX = nx % gridSize, modY = ny % gridSize; if (Math.abs(modX) < 10) nx -= modX; if (Math.abs(modY) < 10) ny -= modY; }
                    return { ...p, x: nx, y: ny };
                }
                return p;
            }));
            setDragOffset({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (textDragState || (shapeDragState && shapeDragState.mode === 'move')) {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if (canvasRect) {
                const mouseX = (e.clientX - canvasRect.left) / canvasScale;
                const mouseY = (e.clientY - canvasRect.top) / canvasScale;
                const targetPanel = [...panels].reverse().find(p => mouseX >= p.x && mouseX <= (p.x + p.w) && mouseY >= p.y && mouseY <= (p.y + p.h));
                if (targetPanel) {
                    const sourcePanelId = textDragState ? textDragState.panelId : shapeDragState!.panelId;
                    if (targetPanel.id !== sourcePanelId) {
                        const sourcePanel = panels.find(p => p.id === sourcePanelId);
                        if (sourcePanel) {
                            let newPanels = [...panels];
                            if (textDragState) {
                                const text = sourcePanel.texts?.find(t => t.id === textDragState.textId);
                                if (text) {
                                    newPanels = newPanels.map(p => p.id === sourcePanelId ? { ...p, texts: p.texts?.filter(t => t.id !== text.id) } : p);
                                    newPanels = newPanels.map(p => p.id === targetPanel.id ? { ...p, texts: [...(p.texts || []), { ...text, x: sourcePanel.x + text.x - targetPanel.x, y: sourcePanel.y + text.y - targetPanel.y }] } : p);
                                    setActivePanelId(targetPanel.id); setSelectedText({ panelId: targetPanel.id, textId: text.id });
                                    showToast({ message: "标注已自动绑定至新图像", type: 'success' });
                                }
                            } else if (shapeDragState) {
                                const shape = sourcePanel.shapes?.find(s => s.id === shapeDragState.shapeId);
                                if (shape) {
                                    newPanels = newPanels.map(p => p.id === sourcePanelId ? { ...p, shapes: p.shapes?.filter(s => s.id !== shape.id) } : p);
                                    newPanels = newPanels.map(p => p.id === targetPanel.id ? { ...p, shapes: [...(p.shapes || []), { ...shape, x1: sourcePanel.x + shape.x1 - targetPanel.x, y1: sourcePanel.y + shape.y1 - targetPanel.y, x2: sourcePanel.x + shape.x2 - targetPanel.x, y2: sourcePanel.y + shape.y2 - targetPanel.y }] } : p);
                                    setActivePanelId(targetPanel.id); setSelectedShape({ panelId: targetPanel.id, shapeId: shape.id });
                                    showToast({ message: "形状已自动绑定至新图像", type: 'success' });
                                }
                            }
                            recordState(newPanels);
                            setIsDragging(false); setIsPanning(false); setTextDragState(null); setShapeDragState(null);
                            return;
                        }
                    }
                }
            }
        }
        if (isDragging || textDragState || shapeDragState) recordState(panels);
        setIsDragging(false); setIsPanning(false); setTextDragState(null); setShapeDragState(null);
    };

    /**
     * handleExport - 深度优化导出质量
     * 采用 pixelRatio: 5.0 以实现超高清位图渲染（3000px+ 精度）
     */
    const handleExport = async () => {
        if (!canvasRef.current || panels.length === 0) return;
        showToast({ message: "正在分析内容边界并生成位图...", type: 'info' });
        setActivePanelId(null); setSelectedText(null); setSelectedShape(null); setEditingText(null);
        await new Promise(r => setTimeout(r, 100));
        try {
            // Calculate the visual Bounding Box including external labels and internal elements
            let minX = panels[0].x, minY = panels[0].y;
            let maxX = panels[0].x + panels[0].w, maxY = panels[0].y + panels[0].h;

            panels.forEach(p => {
                // Account for external labels (padding + estimated font width)
                const labelOffset = (p.labelPadding ?? 8) + (p.labelFontSize ? p.labelFontSize * 1.5 : 40);
                minX = Math.min(minX, p.x - labelOffset);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x + p.w);
                maxY = Math.max(maxY, p.y + p.h);

                // Include texts and shapes boundaries
                p.texts?.forEach(t => {
                    minX = Math.min(minX, p.x + t.x);
                    minY = Math.min(minY, p.y + t.y);
                    maxX = Math.max(maxX, p.x + t.x + 100);
                    maxY = Math.max(maxY, p.y + t.y + 20);
                });
                p.shapes?.forEach(s => {
                    minX = Math.min(minX, p.x + Math.min(s.x1, s.x2));
                    minY = Math.min(minY, p.y + Math.min(s.y1, s.y2));
                    maxX = Math.max(maxX, p.x + Math.max(s.x1, s.x2));
                    maxY = Math.max(maxY, p.y + Math.max(s.y1, s.y2));
                });
            });

            const margin = 24;
            const ew = maxX - minX + margin * 2;
            const eh = maxY - minY + margin * 2;

            // 核心更新：设置 pixelRatio 为 5.0 保证输出极其清晰
            const blob = await htmlToImage.toBlob(canvasRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 5.0,
                width: ew,
                height: eh,
                cacheBust: true,
                style: {
                    transform: `translate(${-minX + margin}px, ${-minY + margin}px)`,
                    width: `${ew}px`,
                    height: `${eh}px`,
                    border: 'none',
                    boxShadow: 'none',
                    backgroundImage: 'none'
                },
                filter: (n) => !(n as any).classList?.contains('no-export')
            });

            if (blob) {
                saveAs(blob, `Figure_Composite_${Date.now()}.png`);
                showToast({ message: "导出成功，已自动裁切并包含完整序号", type: 'success' });
            }
        } catch (e) {
            showToast({ message: '导出失败', type: 'error' });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files?.length) {
            setIsProcessingUpload(true);
            try {
                const base64s = await Promise.all(Array.from(files).map(f => compressImage(f as File)));
                setLocalAssets(prev => [...prev, ...base64s.map(url => ({ id: `local_${Date.now()}_${Math.random()}`, url }))]);
                const next = [...panels];
                base64s.forEach(url => next.push({ id: Date.now().toString() + Math.random(), imgUrl: url, x: 0, y: 0, w: 100, h: 100, label: String.fromCharCode(97 + (next.length % 26)), ...defaultLabelStyle, texts: [], shapes: [], spanCols: 1, spanRows: 1 }));
                recordState(calculateLayout(next, layoutConfig.cols, cellAspectRatio, layoutConfig.rows));
                showToast({ message: `成功导入 ${files.length} 张图片`, type: 'success' });
            } catch (e) { showToast({ message: "图片读取失败", type: 'error' }); }
            finally { setIsProcessingUpload(false); }
        }
        e.target.value = '';
    };

    const combinedLibrary = useMemo(() => [...localAssets.map(a => ({ id: a.id, url: a.url, type: 'local' })), ...savedLibrary.map(a => ({ id: a.timestamp + Math.random(), url: a.url, type: 'cloud' }))], [localAssets, savedLibrary]);

    return (
        <div className="flex h-full gap-4 overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <AssemblySidebar
                showGrid={showGrid} setShowGrid={setShowGrid} layoutConfig={layoutConfig} handleLayoutChange={handleLayoutChange} cellAspectRatio={cellAspectRatio}
                imageFit={imageFit} setImageFit={setImageFit} handleManualSortAndLayout={() => setShowReorderModal(true)} handleQuickSpatialLayout={() => recordState(calculateLayout([...panels].sort((a, b) => a.y - b.y || a.x - b.x), layoutConfig.cols, cellAspectRatio, layoutConfig.rows))}
                handleExport={handleExport} isProcessingUpload={isProcessingUpload} handleFileUpload={handleFileUpload}
                combinedLibrary={combinedLibrary} handleAddPanel={handleAddPanel} handleClearAll={() => { if (window.confirm("确定清空画布？")) { setPanels([]); setLocalAssets([]); recordState([]); } }}
                onDeleteLocalAsset={handleDeleteLocalAsset}
            />
            <AssemblyCanvas
                containerRef={containerRef} canvasRef={canvasRef} canvasWidth={canvasWidth} canvasHeight={canvasHeight} pan={pan} canvasScale={canvasScale} showGrid={showGrid} gridSize={gridSize} panels={panels}
                activePanelId={activePanelId} imageFit={imageFit} selectedText={selectedText} selectedShape={selectedShape} editingText={editingText} FONT_FAMILIES={FONT_FAMILIES}
                onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
                onMouseDown={handleMouseDown} onToggleSpan={(id, type) => recordState(panels.map(p => p.id === id ? { ...p, [type === 'col' ? 'spanCols' : 'spanRows']: (p[type === 'col' ? 'spanCols' : 'spanRows'] || 1) >= layoutConfig[type === 'col' ? 'cols' : 'rows'] ? 1 : (p[type === 'col' ? 'spanCols' : 'spanRows'] || 1) + 1 } : p).map((p, i, a) => calculateLayout(a, layoutConfig.cols, cellAspectRatio, layoutConfig.rows)[i]))}
                onAddText={(e, id) => recordState(panels.map(p => p.id === id ? { ...p, texts: [...(p.texts || []), { id: Date.now().toString(), x: p.w / 2 - 40, y: p.h / 2 - 10, content: 'Text', ...defaultTextStyle }] } : p))}
                onAddTextAt={(e, id) => { e.stopPropagation(); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const p = panels.find(x => x.id === id); if (!p) return; const nx = (e.clientX - rect.left) / canvasScale - p.x, ny = (e.clientY - rect.top) / canvasScale - p.y; recordState(panels.map(x => x.id === id ? { ...x, texts: [...(x.texts || []), { id: Date.now().toString(), x: nx, y: ny, content: 'Text', ...defaultTextStyle }] } : x)); }}
                onAddShape={(e, id, type) => recordState(panels.map(p => p.id === id ? { ...p, shapes: [...(p.shapes || []), { id: Date.now().toString(), type, x1: 20, y1: 20, x2: 80, y2: 80, color: '#4f46e5', strokeWidth: 2 }] } : p))}
                onDeletePanel={(e, id) => recordState(calculateLayout(panels.filter(p => p.id !== id), layoutConfig.cols, cellAspectRatio, layoutConfig.rows))}
                onTextMouseDown={(e, pId, tId) => { e.stopPropagation(); const t = panels.find(p => p.id === pId)?.texts?.find(x => x.id === tId); if (t?.locked) return; setActivePanelId(pId); setSelectedText({ panelId: pId, textId: tId }); setSelectedShape(null); if (t) setTextDragState({ panelId: pId, textId: tId, startX: e.clientX, startY: e.clientY, initialX: t.x, initialY: t.y }); }}
                onTextDoubleClick={(pId, tId) => setEditingText({ panelId: pId, textId: tId })}
                onTextUpdate={(pId, tId, u, b) => { const next = handleBatchUpdate(panels, pId, tId, u, 'text', b); recordState(next); if (u.content) setEditingText(null); const styleOnly = Object.keys(u).filter(k => !['id', 'x', 'y', 'content'].includes(k)); if (styleOnly.length) setDefaultTextStyle(prev => ({ ...prev, ...u })); }}
                onTextDelete={(pId, tId) => { recordState(panels.map(p => p.id === pId ? { ...p, texts: p.texts?.filter(t => t.id !== tId) } : p)); setSelectedText(null); }}
                onShapeMouseDown={(e, pId, sId, m) => { e.stopPropagation(); const s = panels.find(p => p.id === pId)?.shapes?.find(x => x.id === sId); if (s?.locked) return; setActivePanelId(pId); setSelectedShape({ panelId: pId, shapeId: sId }); setSelectedText(null); if (s) setShapeDragState({ panelId: pId, shapeId: sId, startX: e.clientX, startY: e.clientY, initialX1: s.x1, initialY1: s.y1, initialX2: s.x2, initialY2: s.y2, mode: m }); }}
                onShapeUpdate={(pId, sId, u, b) => recordState(handleBatchUpdate(panels, pId, sId, u, 'shape', b))}
                onShapeDelete={(pId, sId) => { recordState(panels.map(p => p.id === pId ? { ...p, shapes: p.shapes?.filter(s => s.id !== sId) } : p)); setSelectedShape(null); }}
                onUpdatePanel={(id, u) => {
                    const isGlobalStyle = 'labelFontSize' in u || 'labelFontFamily' in u || 'labelFontWeight' in u || 'labelFontStyle' in u || 'labelPadding' in u;
                    recordState(panels.map(p => (isGlobalStyle || p.id === id) ? { ...p, ...u } : p));
                    if (isGlobalStyle) {
                        const labelUpdates: any = {};
                        if ('labelFontSize' in u) labelUpdates.labelFontSize = u.labelFontSize;
                        if ('labelFontFamily' in u) labelUpdates.labelFontFamily = u.labelFontFamily;
                        if ('labelFontWeight' in u) labelUpdates.labelFontWeight = u.labelFontWeight;
                        if ('labelFontStyle' in u) labelUpdates.labelFontStyle = u.labelFontStyle;
                        if ('labelPadding' in u) labelUpdates.labelPadding = u.labelPadding;
                        setDefaultLabelStyle(prev => ({ ...prev, ...labelUpdates }));
                    }
                }}
                onActivatePanel={id => { setActivePanelId(id); setSelectedText(null); setSelectedShape(null); }} onContainerMouseDown={handleContainerMouseDown} onWheel={handleWheel} setCanvasScale={setCanvasScale} setPan={setPan}
                onBackgroundClick={() => { setActivePanelId(null); setSelectedText(null); setSelectedShape(null); setEditingText(null); }}
            />

            {/* ── Right Layer Panel ─────────────────────────────────── */}
            <div
                className={`flex flex-col shrink-0 transition-all duration-300 rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden ${showLayerPanel ? 'w-52' : 'w-8'
                    }`}
                style={{ minHeight: 0 }}
            >
                {/* Toggle button */}
                <button
                    onClick={() => setShowLayerPanel(v => !v)}
                    className="flex items-center justify-center w-full py-2 text-white/40 hover:text-white/80 transition-colors border-b border-white/5 shrink-0"
                    title={showLayerPanel ? '收起图层面板' : '展开图层面板'}
                >
                    {showLayerPanel ? (
                        <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest w-full px-3">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="13" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
                            图层
                            <svg className="ml-auto" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                        </span>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="13" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
                    )}
                </button>

                {showLayerPanel && (
                    <LayerPanel
                        panels={panels}
                        activePanelId={activePanelId}
                        selectedText={selectedText}
                        selectedShape={selectedShape}
                        onSelectPanel={(id) => { setActivePanelId(id); setSelectedText(null); setSelectedShape(null); }}
                        onSelectText={(pId, tId) => { setActivePanelId(pId); setSelectedText({ panelId: pId, textId: tId }); setSelectedShape(null); }}
                        onSelectShape={(pId, sId) => { setActivePanelId(pId); setSelectedShape({ panelId: pId, shapeId: sId }); setSelectedText(null); }}
                        onUpdatePanel={handleUpdatePanelLayer}
                        onUpdateText={handleUpdateTextLayer}
                        onUpdateShape={handleUpdateShapeLayer}
                        onReorderPanels={handleReorderPanelsByZIndex}
                    />
                )}
            </div>

            <AssemblyModals
                showLibrary={showLibrary} setShowLibrary={setShowLibrary} savedAssemblies={savedAssemblies} handleLoadSaved={handleLoadSaved} handleDeleteSaved={handleDeleteSaved} handleRenameSaved={logic.handleRenameSaved}
                showSaveModal={showSaveModal} setShowSaveModal={setShowSaveModal} saveTitle={saveTitle} setSaveTitle={setSaveTitle} handleSaveConfirm={handleSaveConfirm}
            />
            {showReorderModal && <FigureReorderModal panels={panels} layoutConfig={layoutConfig} onClose={() => setShowReorderModal(false)} onConfirm={(ordered) => {
                recordState(calculateLayout(ordered.map((item, idx) => ({ ...item, label: String.fromCharCode(97 + (idx % 26)) })), layoutConfig.cols, cellAspectRatio, layoutConfig.rows));
                setShowReorderModal(false);
            }} />}
        </div>
    );
};
