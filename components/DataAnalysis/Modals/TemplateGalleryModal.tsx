
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChartTemplate, ACADEMIC_TEMPLATES } from '../../../hooks/useDataAnalysisLogic';
import { 
  ResponsiveContainer, LineChart, Line, BarChart, Bar, 
  ScatterChart, Scatter, XAxis, YAxis, ErrorBar
} from 'recharts';

// 深度物理仿真数据生成引擎，模拟真实实验产生的原始数据
const generateRealWorldData = (tpl: ChartTemplate) => {
    const data = [];
    const type = tpl.type;
    const name = tpl.name.toLowerCase();

    if (type === 'line' || type === 'area') {
        if (name.includes('xrd') || name.includes('衍射')) {
            for (let i = 0; i <= 200; i++) {
                const x = 10 + (i / 200) * 80;
                let y = 15 * Math.exp(-x / 40) + Math.random() * 2;
                y += 80 * Math.exp(-Math.pow(x - 38.1, 2) / 0.4); 
                y += 35 * Math.exp(-Math.pow(x - 44.3, 2) / 0.5); 
                y += 15 * Math.exp(-Math.pow(x - 64.5, 2) / 0.6); 
                y += 12 * Math.exp(-Math.pow(x - 77.4, 2) / 0.6);
                data.push({ x, y });
            }
        } else if (name.includes('lsv') || name.includes('极化') || name.includes('cv')) {
            for (let i = 0; i <= 100; i++) {
                const x = 0.2 + (i / 100) * 0.8;
                const j_kin = 0.1 * Math.exp((x - 0.5) / 0.05); 
                const j_lim = 60; 
                const y = (j_kin * j_lim) / (j_kin + j_lim) + (Math.random() - 0.5) * 0.8; 
                data.push({ x, y });
            }
        } else {
            for (let i = 0; i <= 100; i++) {
                const x = i;
                const y = 20 + 60 * Math.exp(-Math.pow(x - 50, 2) / 200) + (Math.random() - 0.5) * 2;
                data.push({ x, y });
            }
        }
    } else if (type === 'bar') {
        const categories = ['S1', 'S2', 'S3', 'S4', 'S5'];
        const values = [25, 48, 82, 55, 30];
        return categories.map((cat, i) => ({ 
            x: cat, 
            y: values[i], 
            error: [values[i] * 0.1, values[i] * 0.1] 
        }));
    } else if (type === 'scatter') {
        for (let i = 0; i < 40; i++) {
            const baseLine = i * 2;
            data.push({
                x: i + (Math.random() - 0.5) * 5,
                y: baseLine + (Math.random() - 0.5) * 15
            });
        }
    }
    return data;
};

// 内部组件：缩略图显示逻辑
const TemplateThumbnail: React.FC<{ tpl: ChartTemplate; onPreview: () => void; isLarge?: boolean }> = ({ tpl, onPreview, isLarge = false }) => {
    const previewData = useMemo(() => generateRealWorldData(tpl), [tpl.id, tpl.type]);
    
    const renderChart = () => {
        // 核心更新：如果存在 thumbnailUrl（用户保存的真实快照），则无论是否是大图模式都优先显示图片
        if (tpl.thumbnailUrl) {
            return (
                <div className="w-full h-full bg-white flex items-center justify-center relative overflow-hidden">
                    <img 
                        src={tpl.thumbnailUrl} 
                        alt={tpl.name} 
                        className="w-full h-full object-contain transition-transform duration-700 group-hover/thumb:scale-105"
                    />
                </div>
            );
        }

        const commonProps = {
            margin: isLarge ? { top: 40, right: 40, left: 40, bottom: 40 } : { top: 15, right: 10, left: 10, bottom: 15 }
        };

        if (tpl.type === 'bar') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart margin={commonProps.margin} data={previewData}>
                        <Bar dataKey="y" fill={tpl.color} isAnimationActive={false}>
                            <ErrorBar dataKey="error" stroke="#94a3b8" strokeWidth={isLarge ? 2 : 1} width={isLarge ? 10 : 4} />
                        </Bar>
                        {isLarge && <XAxis dataKey="x" hide={false} />}
                        {isLarge && <YAxis hide={false} />}
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        if (tpl.type === 'scatter') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={commonProps.margin}>
                        <Scatter 
                            data={previewData} 
                            fill={tpl.color} 
                            isAnimationActive={false}
                            shape={tpl.pointShape === 'none' ? 'circle' : ((tpl.pointShape as any) || 'circle')}
                        />
                        {isLarge && <XAxis dataKey="x" type="number" hide={false} />}
                        {isLarge && <YAxis dataKey="y" type="number" hide={false} />}
                    </ScatterChart>
                </ResponsiveContainer>
            );
        }

        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart margin={commonProps.margin} data={previewData}>
                    <Line 
                        type="monotone" 
                        dataKey="y" 
                        stroke={tpl.color} 
                        strokeWidth={isLarge ? (tpl.stroke * 1.5 || 3) : (tpl.stroke || 1.5)} 
                        dot={tpl.pointShape && tpl.pointShape !== 'none' ? { r: isLarge ? 4 : 1.5, fill: tpl.color, strokeWidth: 0 } : false} 
                        isAnimationActive={false} 
                    />
                    {isLarge && <XAxis dataKey="x" type="number" hide={false} />}
                    {isLarge && <YAxis hide={false} />}
                </LineChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div 
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
            className={`${isLarge ? 'w-full h-full' : 'w-full aspect-[16/10]'} bg-white rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden relative group/thumb hover:shadow-inner transition-all shadow-sm ${!isLarge ? 'cursor-zoom-in' : ''}`}
        >
            {/* 装饰层：仅在没有真实图片且非大图预览时显示 */}
            {!tpl.thumbnailUrl && !isLarge && (
                <>
                    <div className="absolute left-[10%] right-[5%] bottom-[15%] h-[1px] bg-slate-300 z-10"></div>
                    <div className="absolute left-[10%] top-[10%] bottom-[15%] w-[1px] bg-slate-300 z-10"></div>
                    <div className="absolute left-[10%] bottom-[15%] w-full flex justify-around px-4 opacity-20">
                        {[1,2,3,4].map(i => <div key={i} className="w-px h-1 bg-black"></div>)}
                    </div>
                </>
            )}

            <div className="w-full h-full opacity-90 group-hover/thumb:opacity-100 transition-opacity">
                {renderChart()}
            </div>

            {/* 悬停放大图标 */}
            {!isLarge && (
                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover/thumb:opacity-100 transition-all flex items-center justify-center backdrop-blur-[1px]">
                    <div className="w-10 h-10 rounded-full bg-white/90 shadow-xl flex items-center justify-center text-indigo-600 border border-white">
                        <i className="fa-solid fa-magnifying-glass-plus"></i>
                    </div>
                </div>
            )}
            
            {!isLarge && (
                <div className="absolute bottom-2 right-3 flex gap-1 pointer-events-none">
                    <span className="text-[5px] font-black text-slate-300 uppercase tracking-widest">
                        {tpl.thumbnailUrl ? 'Captured Result' : 'Simulation'}
                    </span>
                </div>
            )}
        </div>
    );
};

interface TemplateGalleryModalProps {
    show: boolean;
    onClose: () => void;
    userTemplates: ChartTemplate[];
    onSelectTemplate: (tpl: ChartTemplate) => void;
    onApplyAndImport: (tpl: ChartTemplate) => void; 
    templateSearchQuery: string;
    setTemplateSearchQuery: (val: string) => void;
    handleDiscoverTemplate: () => void;
    isDiscoveringTemplate: boolean;
    onDiscoverFromImage?: (file: File) => void;
    onDeleteTemplate?: (id: string) => void;
    onUpdateTemplate?: (id: string, updates: Partial<ChartTemplate>) => void;
}

const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({ 
    show, onClose, userTemplates, onSelectTemplate, onApplyAndImport,
    templateSearchQuery, setTemplateSearchQuery, handleDiscoverTemplate, isDiscoveringTemplate, onDiscoverFromImage,
    onDeleteTemplate, onUpdateTemplate
}) => {
    const [localSearch, setLocalSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ChartTemplate>>({});
    const [previewTpl, setPreviewTpl] = useState<ChartTemplate | null>(null);
    
    const imageInputRef = useRef<HTMLInputElement>(null);
    const allTemplates = useMemo(() => [...userTemplates, ...ACADEMIC_TEMPLATES], [userTemplates]);
    
    const filtered = useMemo(() => {
        if (!localSearch.trim()) return allTemplates;
        const q = localSearch.toLowerCase();
        return allTemplates.filter(t => 
            t.name.toLowerCase().includes(q) || 
            (t.dataType || "").toLowerCase().includes(q) ||
            (t.typicalExperiment || "").toLowerCase().includes(q)
        );
    }, [allTemplates, localSearch]);

    useEffect(() => {
        if (deleteConfirmId) {
            const timer = setTimeout(() => setDeleteConfirmId(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [deleteConfirmId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onDiscoverFromImage) {
            onDiscoverFromImage(file);
        }
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const startEdit = (e: React.MouseEvent, tpl: ChartTemplate) => {
        e.stopPropagation();
        setEditingId(tpl.id);
        setDeleteConfirmId(null);
        setEditForm({ ...tpl });
    };

    const confirmEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingId && onUpdateTemplate) {
            onUpdateTemplate(editingId, editForm);
        }
        setEditingId(null);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (deleteConfirmId === id) {
            if (onDeleteTemplate) onDeleteTemplate(id);
            setDeleteConfirmId(null);
        } else {
            setDeleteConfirmId(id);
            setEditingId(null);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-2 lg:p-6">
            <div className="bg-white w-full max-w-[96vw] h-full max-h-[94vh] rounded-[3.5rem] flex flex-col overflow-hidden animate-reveal shadow-2xl border-4 border-white/20">
                <header className="p-8 lg:px-12 lg:py-10 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
                        <div className="flex items-center gap-5 min-w-0">
                            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 shrink-0">
                                <i className="fa-solid fa-swatchbook text-2xl"></i>
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">学术绘图画廊</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3rem] mt-2">Visual Standards & AI Discovery</p>
                            </div>
                        </div>
                        
                        <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-90">
                            <i className="fa-solid fa-times text-xl"></i>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        <div className="lg:col-span-8 flex gap-3 bg-white p-2 rounded-[2rem] border border-slate-200 shadow-inner">
                            <div className="flex-1 flex items-center gap-3 pl-4">
                                {isDiscoveringTemplate ? <i className="fa-solid fa-circle-notch animate-spin text-indigo-500"></i> : <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-sm"></i>}
                                <input 
                                    className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none placeholder:text-slate-300"
                                    placeholder="输入数据类型或表征方法发现新规范 (e.g. LSV 极化曲线)..."
                                    value={templateSearchQuery}
                                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleDiscoverTemplate()}
                                />
                            </div>
                            <button 
                                onClick={handleDiscoverTemplate}
                                disabled={isDiscoveringTemplate || !templateSearchQuery.trim()}
                                className="px-8 py-3 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-30"
                            >
                                AI 建模
                            </button>
                        </div>

                        <div className="lg:col-span-4 flex items-center gap-3">
                            <button 
                                onClick={() => imageInputRef.current?.click()}
                                disabled={isDiscoveringTemplate}
                                className="flex-1 h-14 bg-indigo-50 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-[2rem] flex items-center justify-center gap-3 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm group disabled:opacity-50"
                            >
                                <i className="fa-solid fa-camera-retro group-hover:scale-110 transition-transform"></i>
                                <span className="text-[10px] font-black uppercase">上传图谱识别 DNA</span>
                            </button>
                            <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                    <div className="p-8 lg:px-12 py-4 bg-white border-b border-slate-50 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">浏览现有模板 ({filtered.length})</span>
                            <div className="h-4 w-px bg-slate-200"></div>
                            <div className="flex gap-1">
                                {['Line', 'Bar', 'Scatter'].map(cat => (
                                    <button key={cat} onClick={() => setLocalSearch(cat)} className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all">{cat}</button>
                                ))}
                            </div>
                        </div>
                        <div className="relative w-64">
                            <i className="fa-solid fa-filter absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                            <input 
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold outline-none focus:border-indigo-300 transition-all"
                                placeholder="快速过滤画廊..."
                                value={localSearch}
                                onChange={e => setLocalSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12 bg-slate-50/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
                            {filtered.map(tpl => {
                                const isEditing = editingId === tpl.id;
                                const isDeleting = deleteConfirmId === tpl.id;
                                const isUserTemplate = !tpl.isStandard;

                                return (
                                    <div 
                                        key={tpl.id}
                                        onClick={() => !isEditing && !isDeleting && onSelectTemplate(tpl)}
                                        className={`bg-white rounded-[2.5rem] border-2 border-slate-100 p-5 flex flex-col group transition-all relative ${isEditing ? 'border-indigo-600 shadow-xl ring-4 ring-indigo-50' : isDeleting ? 'border-rose-500 shadow-xl ring-4 ring-rose-50 scale-[0.98]' : 'hover:border-indigo-400 hover:shadow-2xl cursor-pointer'}`}
                                    >
                                        <TemplateThumbnail tpl={tpl} onPreview={() => setPreviewTpl(tpl)} />
                                        
                                        {!isEditing && isUserTemplate && (
                                            <div className={`absolute top-8 right-8 flex gap-2 transition-all ${isDeleting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} z-10`}>
                                                {!isDeleting ? (
                                                    <>
                                                        <button 
                                                            onClick={(e) => startEdit(e, tpl)}
                                                            className="w-8 h-8 rounded-xl bg-white shadow-lg text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center border border-indigo-100"
                                                        >
                                                            <i className="fa-solid fa-pen-nib text-xs"></i>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, tpl.id); }}
                                                            className="w-8 h-8 rounded-xl bg-white shadow-lg text-rose-50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100"
                                                        >
                                                            <i className="fa-solid fa-trash-can text-xs"></i>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 animate-reveal" onClick={e => e.stopPropagation()}>
                                                        <button 
                                                            onClick={() => setDeleteConfirmId(null)}
                                                            className="px-3 h-8 bg-slate-100 text-slate-500 rounded-xl text-[8px] font-black uppercase hover:bg-slate-200 transition-all border border-slate-200 shadow-sm"
                                                        >
                                                            取消
                                                        </button>
                                                        <button 
                                                            onClick={(e) => handleDeleteClick(e, tpl.id)}
                                                            className="px-4 h-8 bg-rose-600 text-white rounded-xl text-[8px] font-black uppercase shadow-lg border border-rose-500 animate-pulse flex items-center gap-1.5"
                                                        >
                                                            <i className="fa-solid fa-check"></i>
                                                            确认删除
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="mt-5 flex-1">
                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                {isEditing ? (
                                                    <input 
                                                        className="w-full bg-slate-50 border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-800 outline-none"
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <h4 className={`text-lg font-black uppercase italic leading-tight transition-colors truncate ${isDeleting ? 'text-rose-600' : 'group-hover:text-indigo-600 text-slate-800'}`}>{tpl.name}</h4>
                                                )}
                                                {tpl.id.startsWith('discovered') && <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[6px] font-black uppercase shadow-sm animate-reveal">AI</span>}
                                            </div>
                                            
                                            <div className="mt-4 space-y-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">数据类型 (DATA TYPE)</span>
                                                    {isEditing ? (
                                                        <input className="w-full bg-slate-50 border border-indigo-200 rounded px-2 py-0.5 text-[10px] outline-none" value={editForm.dataType} onChange={e => setEditForm({...editForm, dataType: e.target.value})} />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-600">{tpl.dataType || '通用科研数据'}</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">数据要求 (REQUIREMENT)</span>
                                                    {isEditing ? (
                                                        <input className="w-full bg-slate-50 border border-indigo-200 rounded px-2 py-0.5 text-[10px] outline-none" value={editForm.dataRequirement} onChange={e => setEditForm({...editForm, dataRequirement: e.target.value})} />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-indigo-700 italic">“ {tpl.dataRequirement || '标准双列(X,Y)结构'} ”</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onApplyAndImport(tpl); }}
                                                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <i className="fa-solid fa-file-import"></i>
                                                应用并导入数据
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onSelectTemplate(tpl); }}
                                                className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all"
                                            >
                                                仅应用样式
                                            </button>
                                        </div>
                                        
                                        <div className="mt-4 flex items-center justify-between">
                                            {isEditing ? (
                                                <input className="flex-1 bg-slate-50 border border-indigo-200 rounded px-2 py-0.5 text-[8px] outline-none" value={editForm.typicalExperiment} onChange={e => setEditForm({...editForm, typicalExperiment: e.target.value})} />
                                            ) : (
                                                <span className="text-[8px] font-black text-slate-300 uppercase italic">{tpl.typicalExperiment || 'Standard Protocol'}</span>
                                            )}
                                            
                                            {isEditing && (
                                                <div className="flex gap-1 ml-2">
                                                    <button onClick={() => setEditingId(null)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-[10px]"></i></button>
                                                    <button onClick={confirmEdit} className="w-7 h-7 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center justify-center shadow-md"><i className="fa-solid fa-check text-[10px]"></i></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {filtered.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center py-40 opacity-40">
                                <i className="fa-solid fa-swatchbook text-6xl text-slate-200 mb-6"></i>
                                <p className="text-xl font-black uppercase tracking-[0.5rem] text-slate-400 italic">未发现匹配模板</p>
                                <p className="text-[10px] font-bold text-slate-300 uppercase mt-2">使用上方 AI 建模引擎可立即创建新规范</p>
                            </div>
                        )}
                    </div>

                    {isDiscoveringTemplate && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center animate-reveal">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-[2rem] border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <i className="fa-solid fa-robot text-indigo-600 text-3xl animate-pulse"></i>
                                </div>
                            </div>
                            <h4 className="mt-8 text-xl font-black text-slate-800 uppercase italic tracking-widest">正在解构学术 DNA...</h4>
                            <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2rem]">AI is synthesizing new visual archetypes</p>
                        </div>
                    )}
                </div>

                <footer className="p-8 border-t border-slate-100 bg-white shrink-0 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">
                        <i className="fa-solid fa-circle-info mr-2"></i> 只有用户自定义和 AI 发现的模板支持编辑与删除
                    </p>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all">稍后再说</button>
                        <button onClick={onClose} className="px-12 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all">返回工作台</button>
                    </div>
                </footer>
            </div>

            {/* 高清预览图遮罩层 (恢复并增强：优先显示保存的 thumbnailUrl) */}
            {previewTpl && (
                <div 
                    className="fixed inset-0 bg-slate-950/95 z-[6000] flex items-center justify-center p-4 lg:p-20 animate-in fade-in duration-300 cursor-zoom-out"
                    onClick={() => setPreviewTpl(null)}
                >
                    <button className="absolute top-10 right-10 w-14 h-14 rounded-full bg-white/10 text-white hover:bg-rose-500 transition-all flex items-center justify-center shadow-2xl border border-white/10">
                        <i className="fa-solid fa-times text-2xl"></i>
                    </button>
                    
                    <div className="relative w-full max-w-6xl aspect-[16/10] flex flex-col items-center justify-center">
                        <div className="w-full h-full bg-white shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-[3rem] border-4 border-white/20 animate-reveal overflow-hidden p-8 flex flex-col">
                            <div className="flex justify-between items-center mb-6 px-4 shrink-0">
                                <div>
                                    <h4 className="text-2xl font-black text-slate-900 uppercase italic">{previewTpl.name}</h4>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">High-Fidelity Visual Archetype Preview</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-indigo-600 font-black text-xs uppercase">
                                        Type: {previewTpl.type}
                                    </div>
                                    <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-slate-600 font-black text-xs uppercase">
                                        {previewTpl.thumbnailUrl ? 'Saved Snapshot' : `Stroke: ${previewTpl.stroke}pt`}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 w-full min-h-0">
                                <TemplateThumbnail tpl={previewTpl} onPreview={() => {}} isLarge={true} />
                            </div>
                        </div>
                        <div className="mt-8 px-8 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-[0.2rem]">
                            {previewTpl.thumbnailUrl ? 'Real Workflow Record Snapshot' : 'High Definition Scientific Model Simulation'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateGalleryModal;
