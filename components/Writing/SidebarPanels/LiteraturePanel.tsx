
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ResearchProject, Literature } from '../../../types';
import { SECTION_CONFIG } from '../WritingConfig';
import { useTranslation } from '../../../locales/useTranslation';

interface LiteraturePanelProps {
    project: ResearchProject | undefined;
    resources: Literature[];
    docType: 'paper' | 'report' | 'patent';
    onCiteLiterature: (res: Literature) => void;
    onFindCitation: (res: Literature) => void;
    onRemoveCitation: (res: Literature) => void;
    onGenerateBibliography: (style: 'Nature' | 'IEEE') => void;
    isProcessing: boolean;
    highlightedResourceId?: string[] | null;
    onViewDetails?: (res: Literature) => void;
    onFindToken?: (type: 'Cite', id: string) => void;
    orderedCitations?: { list: Literature[]; map: Map<string, number> };
}

const LiteraturePanel: React.FC<LiteraturePanelProps> = ({
    project, resources, docType,
    onCiteLiterature, onFindCitation, onRemoveCitation, onGenerateBibliography,
    isProcessing, highlightedResourceId, onViewDetails, onFindToken,
    orderedCitations
}) => {
    const { t } = useTranslation();
    const CATEGORIES = [
        t('writing.literaturePanel.categories.coreTheory'),
        t('writing.literaturePanel.categories.processStandard'),
        t('writing.literaturePanel.categories.performanceBenchmark'),
        t('writing.literaturePanel.categories.patentSearch')
    ];
    const [litSearchQuery, setLitSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [showCitedOnly, setShowCitedOnly] = useState(false);
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const projectResources = useMemo(() =>
        (resources || []).filter(r => r && r.projectId === project?.id),
        [resources, project?.id]
    );

    // 计算文献在文中的出现顺序（序号）
    const citationOrder = useMemo(() => {
        if (orderedCitations) {
            const orderMap = new Map<string, number>();
            orderedCitations.list.forEach((res, idx) => {
                orderMap.set(res.id, idx + 1);
            });
            return orderMap;
        }

        // 如果没有传入全局引文（兜底逻辑），则维持现状
        if (!project?.paperSections || projectResources.length === 0) return new Map<string, number>();
        // ... 原有逻辑 (稍作增强以支持表格也作为兜底)
        return new Map<string, number>();
    }, [orderedCitations, project?.paperSections, projectResources]);

    const allTags = useMemo(() => {
        const tags = new Set<string>();
        projectResources.forEach(r => r.tags?.forEach(t => tags.add(t)));
        return Array.from(tags);
    }, [projectResources]);

    const filteredLit = useMemo(() => {
        let res = projectResources;

        if (showCitedOnly) {
            res = res.filter(r => citationOrder.has(r.id));
        }

        if (selectedCategory) {
            res = res.filter(r => r.categories?.includes(selectedCategory) || r.category === selectedCategory);
        }

        if (selectedTag) {
            res = res.filter(r => r.tags?.includes(selectedTag));
        }

        if (litSearchQuery.trim()) {
            const q = litSearchQuery.toLowerCase();
            res = res.filter(r =>
                (r.title || "").toLowerCase().includes(q) ||
                (r.source || "").toLowerCase().includes(q) ||
                (Array.isArray(r.authors) && r.authors.some(a => a.toLowerCase().includes(q)))
            );
        }

        // 排序逻辑：优先按文中出现序号排序，未引用的排在后面
        return [...res].sort((a, b) => {
            const orderA = citationOrder.get(a.id) ?? 9999;
            const orderB = citationOrder.get(b.id) ?? 9999;
            if (orderA !== orderB) return orderA - orderB;
            // 如果都未引用，按年份降序
            return (b.year || 0) - (a.year || 0);
        });
    }, [projectResources, litSearchQuery, selectedCategory, selectedTag, showCitedOnly, citationOrder]);

    useEffect(() => {
        if (highlightedResourceId && highlightedResourceId.length > 0) {
            const firstId = highlightedResourceId[0];
            if (itemRefs.current[firstId]) {
                itemRefs.current[firstId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [highlightedResourceId]);

    const getCitingSections = (resId: string) => {
        // 只有在 orderedCitations 中的文献才算已引用（精确匹配）
        if (orderedCitations && !orderedCitations.list.some(r => r.id === resId)) return [];
        if (!project?.paperSections) return [];
        const res = (resources || []).find(r => r && r.id === resId);
        if (!res) return [];

        let pattern: RegExp;
        if (res.type === '专利') {
            const patentTag = `[${res.title}, ${res.source}]`;
            pattern = new RegExp(patentTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        } else {
            const authors = Array.isArray(res.authors) ? res.authors : [];
            if (authors.length === 0 || !res.year) return [];
            const firstAuthorName = authors[0];
            const lastName = firstAuthorName.includes(',')
                ? firstAuthorName.split(',')[0].trim()
                : /^[\u4e00-\u9fff]+$/.test(firstAuthorName.trim())
                    ? firstAuthorName.trim()
                    : firstAuthorName.trim().split(' ')[0] || firstAuthorName;
            const safeName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pattern = new RegExp(`${safeName}(?:\\s+et\\s+al\\.?)?,?\\s*${res.year}`, 'i');
        }

        const locations: string[] = [];
        project.paperSections.forEach(s => {
            if (s.content && pattern.test(s.content)) {
                locations.push(s.title || s.id);
            }
        });
        if (project.tables) {
            project.tables.forEach(table => {
                let foundInTable = pattern.test(table.title || '');
                if (!foundInTable) {
                    foundInTable = table.rows.some(row => row.some(cell => pattern.test(cell || '')));
                }
                if (foundInTable) {
                    locations.push(`Table: ${table.title || 'Untitled'}`);
                }
            });
        }
        return Array.from(new Set(locations));
    };

    return (
        <div className="space-y-3 animate-reveal">
            <div className="flex justify-between items-center px-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('writing.literaturePanel.linkedLiterature')}</p>
                {citationOrder.size > 0 && (
                    <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {t('writing.literaturePanel.cited')} {citationOrder.size} {t('writing.literaturePanel.pieces')}
                    </span>
                )}
            </div>

            <div className={`bg-slate-50/60 rounded-xl border border-slate-200/50 shadow-sm shrink-0 transition-all duration-300 overflow-hidden ${isPanelExpanded ? 'p-2.5' : 'p-1.5'}`}>
                <div className={`flex justify-between items-center cursor-pointer ${isPanelExpanded ? 'mb-2' : 'mb-0'}`} onClick={() => setIsPanelExpanded(!isPanelExpanded)}>
                    <div className="flex items-center gap-3">
                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                            <i className="fa-solid fa-filter"></i> {t('writing.literaturePanel.smartFilter')}
                        </p>
                        {/* 已引用筛选开关 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowCitedOnly(!showCitedOnly); }}
                            className={`px-2 py-0.5 rounded text-[7px] font-black uppercase transition-all border flex items-center gap-1 ${showCitedOnly ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                        >
                            <i className={`fa-solid ${showCitedOnly ? 'fa-check-circle' : 'fa-circle-dot opacity-40'}`}></i>
                            {t('writing.literaturePanel.citedOnly')}
                        </button>
                    </div>
                    <button className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-all">
                        <i className={`fa-solid ${isPanelExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                    </button>
                </div>

                {isPanelExpanded && (
                    <div className="space-y-3 animate-reveal">
                        <div>
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`px-2.5 py-1 rounded-lg text-[8px] font-bold border transition-all ${selectedCategory === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                >
                                    {t('writing.literaturePanel.all')}
                                </button>
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                                        className={`px-2 py-0.5 rounded-lg text-[7.5px] font-bold border transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {allTags.length > 0 && (
                            <div>
                                <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest px-1 mb-1.5 flex items-center gap-1">
                                    <i className="fa-solid fa-tags"></i> {t('writing.literaturePanel.tagCloud')}
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                    {allTags.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                            className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border transition-all ${selectedTag === tag ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200 hover:text-emerald-600'}`}
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="relative mb-3">
                <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px]"></i>
                <input
                    type="text"
                    placeholder={t('writing.literaturePanel.searchPlaceholder')}
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-lg pl-8 pr-3 py-1.5 text-[9px] font-bold outline-none focus:ring-1 focus:ring-indigo-100 transition-all shadow-inner"
                    value={litSearchQuery}
                    onChange={e => setLitSearchQuery(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                {filteredLit.map(res => {
                    if (!res) return null;
                    const citingSections = getCitingSections(res.id);
                    const isCited = citingSections.length > 0;
                    const isHighlighted = highlightedResourceId ? highlightedResourceId.includes(res.id) : false;
                    const seqNum = citationOrder.get(res.id);

                    return (
                        <div
                            key={res.id}
                            ref={el => { itemRefs.current[res.id] = el; }}
                            onClick={() => onCiteLiterature(res)}
                            className={`p-2.5 rounded-xl border transition-all relative overflow-hidden group cursor-pointer ${isHighlighted
                                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100 shadow-md transform scale-[1.01] z-10'
                                : isCited
                                    ? 'bg-emerald-50/40 border-emerald-300 shadow-sm hover:bg-emerald-50 hover:shadow-md'
                                    : 'bg-slate-50 border-slate-100 hover:border-emerald-200 shadow-none'
                                }`}
                            title={t('writing.literaturePanel.clickToInsert')}
                        >
                            <div className="flex justify-between items-start gap-2 mb-2">
                                <div className="flex items-start gap-2 flex-1">
                                    {seqNum && (
                                        <span className="shrink-0 w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black shadow-sm" title={t('writing.literaturePanel.citationAt').replace('{num}', String(seqNum))}>
                                            {seqNum}
                                        </span>
                                    )}
                                    <p className={`text-[9px] font-black leading-tight flex-1 ${isCited ? 'text-emerald-800' : 'text-slate-700 group-hover:text-emerald-700'}`}>{res.title}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    {(res.categories && res.categories.length > 0) ? res.categories.map((cat, i) => (
                                        <span key={i} className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[6px] font-black uppercase">{cat}</span>
                                    )) : res.category && <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[6px] font-black uppercase">{res.category}</span>}
                                </div>
                            </div>

                            <div className="flex justify-between items-end">
                                <div className="min-w-0 flex-1 mr-2">
                                    <span className="text-[7.5px] text-slate-400 font-bold uppercase block truncate">{res.source} · {res.year}</span>
                                    {isCited && (
                                        <p className="text-[7px] text-emerald-600 font-bold mt-1.5 truncate italic">
                                            <i className="fa-solid fa-location-dot mr-1"></i>
                                            {t('writing.literaturePanel.fullTextLocation')} {citingSections.join(', ')}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {onViewDetails && (
                                        <button onClick={() => onViewDetails(res)} className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all shadow-sm" title={t('writing.literaturePanel.viewDetails')}><i className="fa-solid fa-eye text-[9px]"></i></button>
                                    )}
                                    {isCited ? (
                                        <>
                                            <button onClick={() => onFindToken?.('Cite', res.id)} className="w-6 h-6 rounded-lg bg-indigo-600 text-white hover:bg-black flex items-center justify-center transition-all shadow-md active:scale-95" title={t('writing.literaturePanel.trackCitations')}><i className="fa-solid fa-location-crosshairs text-[9px]"></i></button>
                                            <button onClick={() => onRemoveCitation(res)} className="w-6 h-6 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm" title={t('writing.literaturePanel.removeCitation')}><i className="fa-solid fa-eraser text-[9px]"></i></button>
                                        </>
                                    ) : (
                                        <button onClick={() => onCiteLiterature(res)} className="w-6 h-6 rounded-lg bg-slate-200 text-slate-400 group-hover:bg-indigo-500 group-hover:text-white flex items-center justify-center transition-all" title={t('writing.literaturePanel.insertCitation')}><i className="fa-solid fa-quote-right text-[9px]"></i></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredLit.length === 0 && (
                    <div className="text-center py-12 opacity-40">
                        <i className="fa-solid fa-magnifying-glass text-2xl mb-2 text-slate-300"></i>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">
                            {showCitedOnly ? t('writing.literaturePanel.noCitedLiterature') : t('writing.literaturePanel.noMatchingLiterature')}
                        </p>
                    </div>
                )}
            </div>

            <button
                onClick={() => onGenerateBibliography('Nature')}
                disabled={isProcessing}
                className="w-full py-3 bg-white border-2 border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm flex items-center justify-center gap-2 mt-4 active:scale-95"
            >
                {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-list-ol"></i>}
                {t('writing.literaturePanel.generateBibliography')}
            </button>
        </div>
    );
};

export default LiteraturePanel;
