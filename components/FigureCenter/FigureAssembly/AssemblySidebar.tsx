import React from 'react';
import { useProjectContext } from '../../../context/ProjectContext';

interface AssemblySidebarProps {
    showGrid: boolean;
    setShowGrid: (v: boolean) => void;
    layoutConfig: { rows: number, cols: number };
    handleLayoutChange: (key: 'rows' | 'cols' | 'ratio', val: number) => void;
    cellAspectRatio: number;
    imageFit: 'contain' | 'cover';
    setImageFit: (v: 'contain' | 'cover' | ((prev: 'contain' | 'cover') => 'contain' | 'cover')) => void;
    handleManualSortAndLayout: () => void;
    handleQuickSpatialLayout: () => void;
    handleExport: () => void;
    isProcessingUpload: boolean;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    combinedLibrary: any[];
    handleAddPanel: (url: string) => void;
    handleClearAll: () => void;
    onDeleteLocalAsset?: (id: string) => void;
}

export const AssemblySidebar: React.FC<AssemblySidebarProps> = ({
    showGrid, setShowGrid, layoutConfig, handleLayoutChange, cellAspectRatio,
    imageFit, setImageFit, handleManualSortAndLayout, handleQuickSpatialLayout,
    handleExport, isProcessingUpload, handleFileUpload,
    combinedLibrary, handleAddPanel, handleClearAll, onDeleteLocalAsset
}) => {
    const { activeTheme } = useProjectContext();
    const isLightMode = activeTheme.type === 'light';

    return (
        <div className="w-72 bg-white rounded-[2rem] border border-slate-200 shadow-sm flex flex-col p-6 shrink-0 z-20 overflow-hidden h-full">
            <div className="flex items-center gap-2 mb-4 px-1">
                <i className="fa-solid fa-images text-indigo-600"></i>
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">素材资源库</h4>
            </div>

            <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden shadow-inner">
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-950 uppercase tracking-widest leading-none">SMART GRID</span>
                        <span className="text-[6px] font-black text-indigo-400 uppercase tracking-tighter mt-1 opacity-60">默认设定</span>
                    </div>
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm ${showGrid ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}
                    >
                        {showGrid ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div className="flex items-center gap-2 mb-3 relative z-10">
                    <div className="flex-1 flex items-center bg-white rounded-xl border border-slate-200 px-1 py-1 shadow-sm">
                        <span className="pl-2 text-[7px] font-black text-slate-400 mr-1 uppercase">ROWS:</span>
                        <input type="number" min="1" max="10" className="w-full bg-transparent text-[11px] font-black text-center outline-none text-slate-700" value={layoutConfig.rows} onChange={e => handleLayoutChange('rows', Math.max(1, parseInt(e.target.value) || 1))} />
                    </div>
                    <span className="text-[8px] text-slate-300 font-black">x</span>
                    <div className="flex-1 flex items-center bg-white rounded-xl border border-slate-200 px-1 py-1 shadow-sm">
                        <span className="pl-2 text-[7px] font-black text-slate-400 mr-1 uppercase">COLS:</span>
                        <input type="number" min="1" max="10" className="w-full bg-transparent text-[11px] font-black text-center outline-none text-slate-700" value={layoutConfig.cols} onChange={e => handleLayoutChange('cols', Math.max(1, parseInt(e.target.value) || 1))} />
                    </div>
                </div>

                <div className="flex items-center gap-2 mb-4 relative z-10">
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 px-2 py-1 shadow-sm flex items-center justify-between" title="Grid Aspect Ratio">
                        <span className="text-[7px] font-black text-slate-400 uppercase">RATIO:</span>
                        <select
                            className="bg-transparent text-[9px] font-black text-center outline-none w-16 cursor-pointer text-slate-700 uppercase"
                            value={cellAspectRatio}
                            onChange={(e) => handleLayoutChange('ratio', parseFloat(e.target.value))}
                        >
                            <option value={0.75}>4:3</option>
                            <option value={1}>1:1</option>
                            <option value={0.5625}>16:9</option>
                            <option value={1.33}>3:4</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setImageFit(prev => prev === 'contain' ? 'cover' : 'contain')}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm border ${imageFit === 'cover' ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-indigo-50'}`}
                    >
                        {imageFit === 'cover' ? 'FILL' : 'FIT'}
                    </button>
                </div>

                <div className="flex flex-col gap-2 relative z-10 pt-2 border-t border-slate-200">
                    <button
                        onClick={handleManualSortAndLayout}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <i className="fa-solid fa-list-ol"></i> 排序 & 排版
                    </button>
                    <button
                        onClick={handleQuickSpatialLayout}
                        className="w-full py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-100 transition-all"
                    >
                        快速空间整理
                    </button>
                </div>

            </div>

            <div className="mb-4">
                <label className={`flex items-center gap-3 w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all group ${isProcessingUpload ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-indigo-500 shadow-sm group-hover:scale-110 transition-transform border border-slate-100">
                        {isProcessingUpload ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide leading-none">上传本地图片</span>
                        <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">Upload Local Assets</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                {combinedLibrary.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 pb-4">
                        {combinedLibrary.map((item) => (
                            <div key={item.id} className="relative group cursor-pointer aspect-square" onClick={() => handleAddPanel(item.url)}>
                                <div className={`w-full h-full rounded-2xl overflow-hidden border-2 shadow-sm bg-white transition-all ${item.type === 'local' ? 'border-emerald-200' : 'border-slate-100'} group-hover:border-indigo-400 group-hover:shadow-md relative`}>
                                    <img src={item.url} className="w-full h-full object-cover" alt="asset" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-indigo-600 shadow-lg">
                                            <i className="fa-solid fa-plus text-sm"></i>
                                        </div>
                                    </div>
                                    {item.type === 'local' && (
                                        <>
                                            <div className="absolute top-1 left-1 bg-emerald-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md border-2 border-white">
                                                <i className="fa-solid fa-check text-[10px]"></i>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDeleteLocalAsset?.(item.id); }}
                                                className="absolute top-1 right-1 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg active:scale-90 z-20"
                                                title="移除素材"
                                            >
                                                <i className="fa-solid fa-times text-[10px]"></i>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-48 border-4 border-dashed border-indigo-100 rounded-[2.5rem] flex flex-col items-center justify-center text-slate-300 bg-slate-50/50 animate-reveal group-hover:border-indigo-200 transition-colors">
                        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner mb-4">
                            <i className="fa-solid fa-image text-3xl opacity-20 text-indigo-400"></i>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2rem] text-slate-400">图库暂空</p>
                        <p className="text-[7px] font-bold text-slate-300 uppercase mt-1">Library is Empty</p>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                <button
                    onClick={handleExport}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    <i className="fa-solid fa-file-export"></i> 导出组合图
                </button>
                <button
                    onClick={handleClearAll}
                    className="w-full py-3 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
                >
                    <i className="fa-solid fa-trash-can"></i> 重置画布 & 清除缓存
                </button>
            </div>
        </div>
    );
};
