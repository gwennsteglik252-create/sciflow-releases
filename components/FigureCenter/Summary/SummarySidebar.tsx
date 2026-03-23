import React, { useState, useMemo } from 'react';
import { ResearchProject, CircularSummaryData, SummarySegment, SummaryLayer, LayerConfig } from '../../../types';
import { ProjectSelector } from './Sub/ProjectSelector';
import { PaletteSelector } from './Sub/PaletteSelector';
import { SegmentEditor } from './Sub/SegmentEditor';
import { CoreEditor } from './Sub/CoreEditor';
import { LayerEditor } from './Sub/LayerEditor';

interface SummarySidebarProps {
    projects: ResearchProject[];
    selectedProjectId: string;
    setSelectedProjectId: (id: string) => void;
    customTopic: string;
    setCustomTopic: (v: string) => void;
    useCustomTopic: boolean;
    setUseCustomTopic: (v: boolean) => void;
    infographicData: CircularSummaryData | null;
    isGenerating: boolean;
    isGeneratingThumbnails: boolean;
    editingSegment: { layerId: string, segment: SummarySegment } | null;
    setEditingSegment: (val: { layerId: string, segment: SummarySegment } | null) => void;
    editingLayer: SummaryLayer | null;
    setEditingLayer: (layer: SummaryLayer | null) => void;
    isEditingCore: boolean;
    setIsEditingCore: (v: boolean) => void;
    onCoreUpdate: (updates: Partial<CircularSummaryData>) => void;
    onGenerate: () => void;
    onGenerateAllThumbnails: () => void;
    onGenerateSingleThumbnail: () => void;
    onGenerateCoreThumbnail?: () => void;
    onAutoColor?: (paletteIdx?: number) => void;
    onSmartRandomColor?: () => void;
    activePaletteIdx: number;
    setActivePaletteIdx: (idx: number) => void;
    academicPalettes: any[];
    onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUploadCoreImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLocalEditChange: (updates: Partial<SummarySegment>) => void;
    onLayerUpdate: (layerId: string, updates: Partial<SummaryLayer>) => void;
    onSyncAllLayers?: (config: LayerConfig) => void;
    onAddLayer: () => void;
    onRenameLayer: (layerId: string, currentName: string) => void;
    onAddSegment: (layerId: string) => void;
    onRemoveSegment: (layerId: string, segmentId: string) => void;
    onExport: () => void;
    zoom: number;
    setZoom: (v: number | ((p: number) => number)) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    coreFileInputRef?: React.RefObject<HTMLInputElement>;
    activeTasks: any[];
    autoRemoveBg: boolean;
    setAutoRemoveBg: (v: boolean) => void;
    onRemoveBgManual?: (base64: string, type: 'core' | 'segment', id?: string) => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    isSyncAllLayersEnabled: boolean;
    setIsSyncAllLayersEnabled: (v: boolean) => void;
    aiLanguage: 'zh' | 'en';
    onAiLanguageChange: (val: 'zh' | 'en') => void;
}

export const SummarySidebar: React.FC<SummarySidebarProps> = (props) => {
    const { infographicData, editingSegment, isEditingCore, setIsEditingCore, setEditingSegment, editingLayer, setEditingLayer, canUndo, canRedo, onUndo, onRedo, isSyncAllLayersEnabled, setIsSyncAllLayersEnabled } = props;
    const [isModelingPanelCollapsed, setIsModelingPanelCollapsed] = useState(false);

    const documentColors = useMemo(() => {
        if (!infographicData) return [];
        const colors = new Set<string>();
        infographicData.layers.forEach(l => l.segments.forEach(s => {
            if (s.color) colors.add(s.color.toLowerCase());
            if (s.titleColor) colors.add(s.titleColor.toLowerCase());
            if (s.contentColor) colors.add(s.contentColor.toLowerCase());
        }));
        if (infographicData.coreColor) colors.add(infographicData.coreColor.toLowerCase());
        return Array.from(colors);
    }, [infographicData]);

    if (isEditingCore && infographicData) {
        return (
            <aside className="h-full w-full lg:w-[340px] bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col shrink-0 z-20 overflow-hidden">
                <CoreEditor
                    data={infographicData}
                    onUpdate={props.onCoreUpdate}
                    onBack={() => setIsEditingCore(false)}
                    onGenerateThumbnail={props.onGenerateCoreThumbnail}
                    isGenerating={props.isGeneratingThumbnails}
                    fileInputRef={props.coreFileInputRef}
                    onUploadImage={props.onUploadCoreImage}
                    documentColors={documentColors}
                    onRemoveBgManual={(base64) => props.onRemoveBgManual?.(base64, 'core')}
                />
            </aside>
        );
    }

    if (editingLayer) {
        return (
            <aside className="h-full w-full lg:w-[340px] bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col shrink-0 z-20 overflow-hidden">
                <LayerEditor
                    layer={editingLayer}
                    onUpdate={(updates) => props.onLayerUpdate(editingLayer.id, updates)}
                    onBack={() => setEditingLayer(null)}
                    documentColors={documentColors}
                    onSyncAllLayers={props.onSyncAllLayers}
                    isSyncEnabled={isSyncAllLayersEnabled}
                    onSyncToggle={setIsSyncAllLayersEnabled}
                />
            </aside>
        );
    }

    if (editingSegment) {
        return (
            <aside className="h-full w-full lg:w-[340px] bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col shrink-0 z-20 overflow-hidden">
                <SegmentEditor
                    layerId={editingSegment.layerId}
                    segment={editingSegment.segment}
                    onUpdate={props.onLocalEditChange}
                    onBack={() => setEditingSegment(null)}
                    onGenerateThumbnail={props.onGenerateSingleThumbnail}
                    isGenerating={props.isGeneratingThumbnails}
                    fileInputRef={props.fileInputRef}
                    onUploadImage={props.onUploadImage}
                    documentColors={documentColors}
                    onRemoveBgManual={(base64, id) => props.onRemoveBgManual?.(base64, 'segment', id)}
                />
            </aside>
        );
    }

    return (
        <aside className="h-full w-full lg:w-[340px] bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col shrink-0 z-20 overflow-hidden">
            <div className="flex flex-col shrink-0">
                <div
                    className="flex justify-between items-center px-1 mb-2 select-none"
                >
                    <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setIsModelingPanelCollapsed(!isModelingPanelCollapsed)}>
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-layer-group text-[10px]"></i></div>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">综述建模引擎</h4>
                        <i className={`fa-solid ${isModelingPanelCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px] text-slate-300 transition-transform`}></i>
                    </div>

                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-4">
                        <button
                            onClick={(e) => { e.stopPropagation(); props.onAiLanguageChange('zh'); }}
                            className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${props.aiLanguage === 'zh' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            中
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); props.onAiLanguageChange('en'); }}
                            className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${props.aiLanguage === 'en' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            EN
                        </button>
                    </div>
                </div>

                {!isModelingPanelCollapsed && (
                    <div className="animate-reveal space-y-4">
                        <ProjectSelector
                            projects={props.projects}
                            selectedProjectId={props.selectedProjectId}
                            setSelectedProjectId={props.setSelectedProjectId}
                            customTopic={props.customTopic}
                            setCustomTopic={props.setCustomTopic}
                            useCustomTopic={props.useCustomTopic}
                            setUseCustomTopic={props.setUseCustomTopic}
                            onGenerate={props.onGenerate}
                            onGenerateThumbnails={props.onGenerateAllThumbnails}
                            isGenerating={props.isGenerating}
                            isGeneratingThumbnails={props.isGeneratingThumbnails}
                            hasData={!!infographicData}
                        />

                        <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-between shadow-inner">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                                    <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-700 uppercase leading-none">自动净化背景</span>
                                    <span className="text-[6px] font-bold text-slate-400 uppercase mt-0.5">Auto Background Clear</span>
                                </div>
                            </div>
                            <button
                                onClick={() => props.setAutoRemoveBg(!props.autoRemoveBg)}
                                className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${props.autoRemoveBg ? 'bg-indigo-600' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${props.autoRemoveBg ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col min-h-0 pt-4 animate-reveal">
                <div className="flex justify-between items-center mb-3 px-1 border-t border-slate-100 pt-5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">层级拓扑管理</h4>
                    <button onClick={props.onAddLayer} className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-md text-[8px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95">+ 层级</button>
                </div>

                <PaletteSelector
                    academicPalettes={props.academicPalettes}
                    activePaletteIdx={props.activePaletteIdx}
                    setActivePaletteIdx={props.setActivePaletteIdx}
                    onApplyPalette={(idx: number) => props.onAutoColor?.(idx)}
                    onSmartRandomColor={props.onSmartRandomColor}
                    hasData={!!infographicData}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1">
                    {infographicData && (
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter mb-2 px-1">CORE 中心核心</p>
                            <div
                                className="text-[10px] font-bold text-slate-700 flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all group shadow-sm cursor-pointer"
                                onClick={() => setIsEditingCore(true)}
                            >
                                <div className="flex items-center gap-2 truncate flex-1">
                                    {infographicData.coreThumbnailUrl ? (
                                        <div className="w-5 h-5 rounded-lg overflow-hidden shrink-0 border border-slate-100 shadow-sm"><img src={infographicData.coreThumbnailUrl} className="w-full h-full object-cover" alt="core" /></div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[8px] shrink-0 shadow-sm"><i className={`fa-solid ${infographicData.coreIcon || 'fa-bullseye'}`}></i></div>
                                    )}
                                    <span className="truncate">{infographicData.title}</span>
                                </div>
                                <i className="fa-solid fa-pen-nib text-[8px] text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                            </div>
                        </div>
                    )}

                    {infographicData?.layers.map(layer => (
                        <div key={layer.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2.5 px-1">
                                <div className="flex items-center gap-2 group/layer-name cursor-pointer">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter truncate max-w-[120px]">
                                        {layer.name}
                                    </p>
                                    <button
                                        onClick={() => props.onRenameLayer(layer.id, layer.name)}
                                        className="text-slate-300 hover:text-indigo-600 opacity-0 group-hover/layer-name:opacity-100 transition-all"
                                        title="快速重命名"
                                    >
                                        <i className="fa-solid fa-pen-nib text-[7px]"></i>
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setEditingLayer(layer)}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black hover:bg-black transition-all shadow-md flex items-center gap-2 active:scale-95 border border-indigo-400/50"
                                        title="层级全局排版配置"
                                    >
                                        <i className="fa-solid fa-sliders text-xs"></i>
                                        层级配置
                                    </button>
                                    <button onClick={() => props.onAddSegment(layer.id)} className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-600 rounded-md text-[8px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm">+ 新增区块</button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {layer.segments.map(seg => (
                                    <div key={seg.id} className="text-[10px] font-bold text-slate-700 flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 hover:border-indigo-300 transition-all group shadow-sm">
                                        <div className="flex items-center gap-2 truncate flex-1 cursor-pointer" onClick={() => setEditingSegment({ layerId: layer.id, segment: seg })}>
                                            {seg.images?.length ? (
                                                <div className="w-5 h-5 rounded-lg overflow-hidden shrink-0 border border-slate-100 relative">
                                                    <img src={seg.images[0].url} className="w-full h-full object-cover" />
                                                </div>
                                            ) : <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }}></div>}
                                            <span className="truncate">{seg.title}</span>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => props.onRemoveSegment(layer.id, seg.id)} className="text-slate-300 hover:text-rose-500"><i className="fa-solid fa-trash text-[8px]"></i></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {infographicData && (
                    <button onClick={props.onExport} className="mt-auto w-full py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-lg hover:bg-black transition-all shrink-0 mb-2"><i className="fa-solid fa-file-export mr-2"></i> 导出高清 PNG</button>
                )}
            </div>
        </aside>
    );
};
