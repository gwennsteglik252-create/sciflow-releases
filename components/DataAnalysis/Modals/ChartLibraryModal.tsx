import React, { useState, useMemo } from 'react';
import { SavedChart, ChartFolder } from '../../../types/scientific';

interface ChartLibraryModalProps {
    show: boolean;
    onClose: () => void;
    savedCharts: SavedChart[];
    chartFolders: ChartFolder[];
    onLoadChart: (id: string) => void;
    onDeleteChart: (id: string) => void;
    onSaveCurrent: (name: string, folderId?: string) => void;
    onCreateFolder: (name: string) => void;
    onDeleteFolder: (id: string) => void;
    onMoveChartToFolder: (chartId: string, folderId?: string) => void;
}

const ChartLibraryModal: React.FC<ChartLibraryModalProps> = ({
    show, onClose, savedCharts, chartFolders = [],
    onLoadChart, onDeleteChart, onSaveCurrent,
    onCreateFolder, onDeleteFolder, onMoveChartToFolder
}) => {
    const [saveName, setSaveName] = useState('');
    const [selectedFolderIdForSave, setSelectedFolderIdForSave] = useState<string | undefined>(undefined);
    const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'uncategorized'>('all');
    const [isSaving, setIsSaving] = useState(false);

    // New Folder State
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const handleSave = () => {
        if (!saveName.trim()) return;
        setIsSaving(true);
        setTimeout(() => {
            onSaveCurrent(saveName, selectedFolderIdForSave);
            setSaveName('');
            setIsSaving(false);
        }, 100);
    };

    const handleCreateFolder = () => {
        if (!newFolderName.trim()) return;
        onCreateFolder(newFolderName.trim());
        setNewFolderName('');
        setIsCreatingFolder(false);
    };

    // Robust Null Checking for Arrays
    const safeCharts = useMemo(() => (savedCharts || []).filter(c => c && typeof c === 'object'), [savedCharts]);
    const safeFolders = useMemo(() => (chartFolders || []).filter(f => f && typeof f === 'object'), [chartFolders]);

    const displayedCharts = useMemo(() => {
        if (activeFolderId === 'all') return safeCharts;
        if (activeFolderId === 'uncategorized') return safeCharts.filter(c => !c?.folderId);
        return safeCharts.filter(c => c?.folderId === activeFolderId);
    }, [safeCharts, activeFolderId]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4 lg:p-8">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-xl flex flex-col overflow-hidden shadow-2xl animate-reveal border-4 border-white/20">

                {/* Header */}
                <header className="px-10 py-8 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <i className="fa-solid fa-layer-group text-2xl"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">工作区存档库</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Workspace Archive Library</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-rose-500 transition-all active:scale-95 shadow-sm">
                        <i className="fa-solid fa-times text-xl"></i>
                    </button>
                </header>

                {/* Content */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left Panel: Save Current State */}
                    <div className="w-full md:w-80 bg-slate-50/50 border-r border-slate-100 p-8 flex flex-col shrink-0">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">保存当前状态</h3>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">存档名称</label>
                                <input
                                    type="text"
                                    placeholder="如: OER 初步表征结果..."
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors shadow-sm"
                                    value={saveName}
                                    onChange={(e) => setSaveName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                />
                            </div>
                            <div className="flex flex-col gap-2 relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">选择目标文件夹</label>
                                <select
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors shadow-sm appearance-none cursor-pointer"
                                    value={selectedFolderIdForSave || ''}
                                    onChange={(e) => setSelectedFolderIdForSave(e.target.value || undefined)}
                                >
                                    <option value="">未分类 (默认)</option>
                                    {safeFolders.map(f => (
                                        <option key={f?.id || Math.random().toString()} value={f?.id || ''}>{f?.name || '未命名文件夹'}</option>
                                    ))}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-4 top-[38px] text-slate-400 text-xs pointer-events-none"></i>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={!saveName.trim() || isSaving}
                                className="w-full py-3.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-lg hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
                                {isSaving ? '正在捕捉快照...' : '保存为新存档'}
                            </button>

                            <div className="mt-8 p-4 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                <p className="text-[10px] text-indigo-400/80 font-bold leading-relaxed">
                                    <i className="fa-solid fa-circle-info mr-1"></i>
                                    保存存档会将当前工作区的完整状态保存下来，包括所有工作表数据、图表配置及数据系列。您随时可以从右侧存档列表中一键恢复。
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Middle Panel: Folder List */}
                    <div className="w-full md:w-64 bg-white border-r border-slate-100 p-6 flex flex-col shrink-0 overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">分类夹</h3>
                            <button onClick={() => setIsCreatingFolder(true)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="新建文件夹">
                                <i className="fa-solid fa-folder-plus"></i>
                            </button>
                        </div>

                        {isCreatingFolder && (
                            <div className="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100 animate-reveal">
                                <input
                                    autoFocus
                                    placeholder="输入文件夹名"
                                    className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none mb-2"
                                    value={newFolderName}
                                    onChange={e => setNewFolderName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleCreateFolder} className="flex-1 bg-indigo-600 text-white text-[10px] py-1.5 rounded-lg font-bold">确定</button>
                                    <button onClick={() => setIsCreatingFolder(false)} className="flex-1 bg-white text-slate-500 text-[10px] py-1.5 rounded-lg border border-slate-200">取消</button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => setActiveFolderId('all')}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeFolderId === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-2"><i className="fa-solid fa-border-all text-indigo-400"></i> 全部图表</div>
                                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm text-slate-400">{safeCharts.length}</span>
                            </button>
                            <button
                                onClick={() => setActiveFolderId('uncategorized')}
                                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeFolderId === 'uncategorized' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-2"><i className="fa-solid fa-inbox text-slate-400"></i> 未分类</div>
                                <span className="text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm text-slate-400">{safeCharts.filter(c => !c?.folderId).length}</span>
                            </button>

                            <hr className="my-2 border-slate-100" />

                            {safeFolders.map(folder => {
                                const count = safeCharts.filter(c => c?.folderId === folder?.id).length;
                                const fId = folder?.id || Math.random().toString();
                                return (
                                    <div key={fId} className="group relative">
                                        <button
                                            onClick={() => setActiveFolderId(fId)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeFolderId === fId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-center gap-2 truncate pr-6"><i className="fa-solid fa-folder text-amber-400"></i> <span className="truncate">{folder?.name || '未命名'}</span></div>
                                            <span className="text-[10px] bg-white px-2 py-0.5 rounded-full shadow-sm text-slate-400">{count}</span>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(fId); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-rose-50 text-rose-500 rounded-md opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                            <i className="fa-solid fa-trash text-[10px]"></i>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Panel: List view */}
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                历史存档纪录 ({displayedCharts.length})
                            </h3>
                            {activeFolderId !== 'all' && activeFolderId !== 'uncategorized' && (
                                <span className="text-[10px] bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-500 font-bold flex items-center gap-2"><i className="fa-solid fa-folder text-amber-400"></i> {safeFolders.find(f => f?.id === activeFolderId)?.name}</span>
                            )}
                        </div>

                        {displayedCharts.length === 0 ? (
                            <div className="h-full min-h-[300px] flex flex-col items-center justify-center opacity-40">
                                <i className="fa-solid fa-box-open text-6xl text-slate-300 mb-6"></i>
                                <p className="text-lg font-black uppercase tracking-[0.2rem] text-slate-400 italic">空空如也</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {displayedCharts.map(chart => (
                                    <div key={chart?.id || Math.random().toString()} className="group relative bg-white border border-slate-200 rounded-xl p-3 flex flex-col hover:border-indigo-300 hover:shadow-xl transition-all cursor-default">
                                        {/* Thumbnail */}
                                        <div className="w-full aspect-[16/9] bg-slate-50 rounded-lg mb-3 overflow-hidden border border-slate-100 flex items-center justify-center relative">
                                            {chart?.thumbnailUrl ? (
                                                <img src={chart.thumbnailUrl} alt={chart?.name || '图表'} className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="text-slate-300 flex flex-col items-center">
                                                    <i className="fa-solid fa-chart-line text-4xl mb-2"></i>
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">无快照记录</span>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm gap-4">
                                                <button
                                                    onClick={() => { if (chart?.id) { onLoadChart(chart.id); onClose(); } }}
                                                    className="px-6 py-3 bg-indigo-500 text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-indigo-400 transition-all shadow-xl hover:scale-105 active:scale-95"
                                                >
                                                    <i className="fa-solid fa-clock-rotate-left mr-2"></i> 恢复此状态
                                                </button>
                                            </div>
                                        </div>

                                        {/* Info & Folder Actions */}
                                        <div className="flex flex-col px-2 pb-1 gap-2">
                                            <div className="flex justify-between items-start">
                                                <div className="min-w-0 pr-2">
                                                    <h4 className="text-[14px] font-black text-slate-800 tracking-tight truncate">{chart?.name || '未命名图表'}</h4>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest"><i className="fa-regular fa-calendar-days mr-1"></i> {chart?.timestamp || '无时间戳'}</p>
                                                </div>
                                                <button onClick={() => chart?.id && onDeleteChart(chart.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shrink-0 shadow-sm">
                                                    <i className="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>

                                            <div className="border-t border-slate-100 pt-2 flex items-center justify-between mt-1">
                                                <div className="relative">
                                                    <select
                                                        className="pl-7 pr-4 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none appearance-none cursor-pointer transition-colors"
                                                        value={chart?.folderId || ''}
                                                        onChange={(e) => chart?.id && onMoveChartToFolder(chart.id, e.target.value || undefined)}
                                                    >
                                                        <option value="">未分类</option>
                                                        {safeFolders.map(f => (
                                                            <option key={f?.id || Math.random()} value={f?.id || ''}>{f?.name || '未命名'}</option>
                                                        ))}
                                                    </select>
                                                    <i className="fa-solid fa-folder text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none"></i>
                                                    <i className="fa-solid fa-caret-down text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none"></i>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ChartLibraryModal;
