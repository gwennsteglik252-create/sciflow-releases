import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ManuscriptMeta, LevelStyle } from '../../../types';
import { TEMPLATES } from '../WritingConfig';

export interface OutlineItem {
    level: number;
    text: string;
    sectionId: string;
}

interface OutlinePanelProps {
    outline: OutlineItem[];
    onJump?: (sectionId: string, text: string) => void;
    manuscriptMeta?: ManuscriptMeta;
    onUpdateMeta?: (meta: ManuscriptMeta) => void;
    // 联动 props
    activeTemplateId?: string;
    onSelectTemplate?: (id: string) => void;
}

const FONT_OPTIONS = [
  { name: 'Sans (Modern)', value: 'Arial, sans-serif' },
  { name: 'Serif (Academic)', value: '"Times New Roman", Times, serif' },
  { name: 'Mono', value: '"Courier New", Courier, monospace' }
];

const OutlinePanel: React.FC<OutlinePanelProps> = ({ 
    outline, onJump, manuscriptMeta, onUpdateMeta, activeTemplateId, onSelectTemplate 
}) => {
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [showStylesModal, setShowStylesModal] = useState(false);

    const toggleSection = (e: React.MouseEvent, sectionKey: string) => {
        e.stopPropagation();
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionKey)) next.delete(sectionKey);
            else next.add(sectionKey);
            return next;
        });
    };

    const currentOutlineStyles = useMemo(() => {
        // Fix: Added required numberingType and fontStyle to fallback objects to satisfy LevelStyle interface
        return manuscriptMeta?.outlineStyles || {
            h1: { fontSize: 11, indent: 0.5, fontWeight: 'black' as const, fontStyle: 'normal' as const, fontFamily: 'Arial, sans-serif', numberingType: 'none' as const },
            h2: { fontSize: 10, indent: 1.2, fontWeight: 'bold' as const, fontStyle: 'normal' as const, fontFamily: 'Arial, sans-serif', numberingType: 'none' as const },
            h3: { fontSize: 9, indent: 1.8, fontWeight: 'normal' as const, fontStyle: 'italic' as const, fontFamily: 'Arial, sans-serif', numberingType: 'none' as const }
        };
    }, [manuscriptMeta?.outlineStyles]);

    const updateLevelStyle = (level: 'h1' | 'h2' | 'h3', updates: Partial<LevelStyle>) => {
        if (!onUpdateMeta || !manuscriptMeta) return;
        const nextStyles = { ...currentOutlineStyles };
        nextStyles[level] = { ...nextStyles[level], ...updates };
        onUpdateMeta({ ...manuscriptMeta, outlineStyles: nextStyles });
    };

    const visibleOutline = useMemo(() => {
        let currentParentCollapsed = false;
        return outline.map((item) => {
            const itemKey = `${item.sectionId}-${item.text}`;
            if (item.level === 1) {
                currentParentCollapsed = collapsedSections.has(itemKey);
                return { ...item, isVisible: true, isCollapsed: currentParentCollapsed, key: itemKey, hasChildren: false };
            }
            return { ...item, isVisible: !currentParentCollapsed, key: itemKey };
        }).map((item, idx, arr) => {
            if (item.level === 1) {
                const nextItem = arr[idx + 1];
                const hasChildren = nextItem && nextItem.level > 1;
                return { ...item, hasChildren };
            }
            return item;
        });
    }, [outline, collapsedSections]);

    return (
        <div className="space-y-4 animate-reveal">
            <div className="flex justify-between items-start px-1">
                <div className="flex flex-col gap-1.5">
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-list-ol text-indigo-600"></i> 文档结构大纲
                    </h4>
                    <p className="text-[8px] text-slate-400 font-bold uppercase leading-none">实时解析多级标题锚点</p>
                </div>
                <button 
                    onClick={() => setShowStylesModal(true)}
                    className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center shadow-sm active:scale-95"
                >
                    <i className="fa-solid fa-cog text-xs"></i>
                </button>
            </div>

            {/* 期刊模板快速切换 */}
            <div className="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100 flex flex-wrap gap-1.5">
                {TEMPLATES.map(tpl => (
                    <button 
                        key={tpl.id}
                        onClick={() => onSelectTemplate?.(tpl.id)}
                        className={`px-2 py-1 rounded text-[7px] font-black uppercase border transition-all ${activeTemplateId === tpl.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                    >
                        {tpl.name.split(' ')[0]}
                    </button>
                ))}
            </div>

            <div className="space-y-1 mt-2">
                {visibleOutline.map((item: any, idx) => (
                    <div 
                        key={idx}
                        className={`flex items-center group transition-all rounded-xl hover:bg-slate-50 ${item.level === 1 ? 'mt-2 mb-0.5' : ''}`}
                        style={{ paddingLeft: `${(item.level - 1) * 0.8}rem`, display: item.isVisible ? 'flex' : 'none' }}
                    >
                        {item.level === 1 && item.hasChildren ? (
                            <button onClick={(e) => toggleSection(e, item.key)} className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400 hover:text-indigo-600">
                                <i className={`fa-solid ${item.isCollapsed ? 'fa-caret-right' : 'fa-caret-down'} text-[10px]`}></i>
                            </button>
                        ) : item.level === 1 ? <div className="w-5" /> : null}

                        <button onClick={() => onJump?.(item.sectionId, item.text)} className="flex-1 text-left py-2 flex items-start gap-2 min-w-0">
                            {item.level > 1 && <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${item.level === 2 ? 'bg-indigo-300' : 'bg-slate-200'} group-hover:bg-indigo-500`}></span>}
                            <p className={`truncate leading-tight text-[10px] ${item.level === 1 ? 'font-black uppercase text-slate-800' : item.level === 2 ? 'font-bold text-slate-700' : 'font-medium italic text-slate-500'}`}>{item.text}</p>
                        </button>
                    </div>
                ))}
            </div>

            {showStylesModal && createPortal(
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
                        <button onClick={() => setShowStylesModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
                        <header className="mb-6 shrink-0"><h3 className="text-xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6">排版高级设置</h3></header>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            {(['h1', 'h2', 'h3'] as const).map(lvl => (
                                <div key={lvl} className="space-y-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                                    <span className="text-[9px] font-black text-indigo-600 uppercase">{lvl.toUpperCase()} Level</span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-[7px] font-bold text-slate-400 block mb-1">Size (PT)</label><input type="number" step="0.5" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] font-bold" value={currentOutlineStyles[lvl].fontSize} onChange={e => updateLevelStyle(lvl, { fontSize: parseFloat(e.target.value) || 9 })}/></div>
                                        <div><label className="text-[7px] font-bold text-slate-400 block mb-1">Indent (REM)</label><input type="number" step="0.1" className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] font-bold" value={currentOutlineStyles[lvl].indent} onChange={e => updateLevelStyle(lvl, { indent: parseFloat(e.target.value) || 0 })}/></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <select className="flex-1 bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] font-bold" value={currentOutlineStyles[lvl].fontFamily} onChange={e => updateLevelStyle(lvl, { fontFamily: e.target.value })}>{FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}</select>
                                        <button onClick={() => updateLevelStyle(lvl, { fontWeight: currentOutlineStyles[lvl].fontWeight === 'bold' ? 'normal' : 'bold' })} className={`w-8 h-8 rounded-lg border flex items-center justify-center ${currentOutlineStyles[lvl].fontWeight === 'bold' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}><i className="fa-solid fa-bold text-[10px]"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowStylesModal(false)} className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all">保存设置</button>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};

export default OutlinePanel;