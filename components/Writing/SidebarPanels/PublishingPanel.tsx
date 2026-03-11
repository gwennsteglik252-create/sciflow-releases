
import React, { useState, useMemo } from 'react';
import { ManuscriptMeta, AuthorProfile } from '../../../types';
import { TEMPLATES, DocType } from '../WritingConfig';
import { useProjectContext } from '../../../context/ProjectContext';

interface PublishingPanelProps {
    templates: any[];
    activeTemplateId: string;
    onSelectTemplate: (id: string) => void;
    manuscriptMeta: ManuscriptMeta;
    onUpdateMeta: (meta: ManuscriptMeta) => void;
    onExportWord: () => void;
    onExportPackage: () => void;
    isProcessing: boolean;
    onAddTemplate: (tpl: any) => void;
    onDeleteTemplate: (id: string) => void;
    docType: DocType;
}

const PublishingPanel: React.FC<PublishingPanelProps> = ({
    templates, activeTemplateId, onSelectTemplate,
    manuscriptMeta, onUpdateMeta,
    onExportWord, onExportPackage, isProcessing,
    onAddTemplate, onDeleteTemplate, docType
}) => {
    const { teamMembers, showToast } = useProjectContext();
    const [isAdding, setIsAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isMetaExpanded, setIsMetaExpanded] = useState(false);
    const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(true);
    const [editingAuthorId, setEditingAuthorId] = useState<string | null>(null);
    const [showTeamImport, setShowTeamImport] = useState(false);
    const [showContributionMatrix, setShowContributionMatrix] = useState(false);
    const [draggedAuthorId, setDraggedAuthorId] = useState<string | null>(null);

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => t.docType === docType);
    }, [templates, docType]);

    const handleSearchAdd = () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setTimeout(() => {
            const newTpl = {
                id: `tpl_${Date.now()}`,
                name: searchQuery,
                docType: docType,
                columns: 1,
                fontFamily: 'font-serif',
                citationStyle: 'numbered',
                logo: searchQuery.substring(0, 2).toUpperCase(),
                figLabel: 'Fig.',
                tableLabel: 'Table',
                figSeparator: '.',
                styles: TEMPLATES[0].styles
            };
            onAddTemplate(newTpl);
            setIsSearching(false);
            setIsAdding(false);
            setSearchQuery('');
        }, 1500);
    };

    const handleAddAuthor = () => {
        const newAuthor: AuthorProfile = { id: Date.now().toString(), name: '', email: '', affiliation: '', address: '', isCorresponding: false, isCoFirst: false };
        onUpdateMeta({ ...manuscriptMeta, authorList: [...manuscriptMeta.authorList, newAuthor] });
        setEditingAuthorId(newAuthor.id);
        setIsAuthorsExpanded(true);
    };

    const handleImportFromTeam = (member: any) => {
        if (manuscriptMeta.authorList.some(a => a.name === member.name)) {
            showToast({ message: "该研究员已在作者列表中", type: 'info' });
            return;
        }
        const newAuthor: AuthorProfile = {
            id: `team_${member.id}`,
            name: member.name,
            email: `${member.name.toLowerCase().replace(' ', '.')}@sciflow.edu`,
            affiliation: `${member.department}, ${member.institution}`,
            isCorresponding: member.securityLevel === '绝密' || member.role.includes('首席'),
            isCoFirst: false
        };
        onUpdateMeta({ ...manuscriptMeta, authorList: [...manuscriptMeta.authorList, newAuthor] });
        showToast({ message: `已从人力矩阵同步作者数据: ${member.name}`, type: 'success' });
    };

    const contributionData = useMemo(() => {
        return teamMembers.slice(0, 5).map(m => ({
            name: m.name,
            expCount: 10 + Math.floor(Math.random() * 20),
            dataShare: 15 + Math.floor(Math.random() * 40),
            writingShare: 5 + Math.floor(Math.random() * 30)
        })).sort((a, b) => (b.dataShare + b.writingShare) - (a.dataShare + a.writingShare));
    }, [teamMembers]);

    const handleUpdateAuthor = (id: string, updates: Partial<AuthorProfile>) => {
        onUpdateMeta({ ...manuscriptMeta, authorList: manuscriptMeta.authorList.map(a => a.id === id ? { ...a, ...updates } : a) });
    };

    const handleRemoveAuthor = (id: string) => {
        onUpdateMeta({ ...manuscriptMeta, authorList: manuscriptMeta.authorList.filter(a => a.id !== id) });
        if (editingAuthorId === id) setEditingAuthorId(null);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedAuthorId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedAuthorId || draggedAuthorId === targetId) return;

        const next = [...manuscriptMeta.authorList];
        const dragIdx = next.findIndex(a => a.id === draggedAuthorId);
        const dropIdx = next.findIndex(a => a.id === targetId);

        if (dragIdx > -1 && dropIdx > -1) {
            const [moved] = next.splice(dragIdx, 1);
            next.splice(dropIdx, 0, moved);
            onUpdateMeta({ ...manuscriptMeta, authorList: next });
        }
        setDraggedAuthorId(null);
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar animate-reveal pb-12 px-1">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic mb-6 flex items-center gap-3">
                <i className="fa-solid fa-print text-indigo-600"></i> 投稿发布中心
            </h3>

            <section className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-scroll"></i> 投稿期刊模板
                    </h5>
                    {!isAdding && (
                        <button onClick={() => setIsAdding(true)} className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">
                            <i className="fa-solid fa-magnifying-glass-plus"></i> 发现
                        </button>
                    )}
                </div>

                {isAdding && (
                    <div className="mb-4 p-4 bg-indigo-50/50 rounded-xl border-2 border-dashed border-indigo-200 animate-reveal shadow-inner">
                        <div className="flex gap-2">
                            <input autoFocus className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="输入期刊全名..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchAdd()} />
                            <button onClick={handleSearchAdd} disabled={isSearching || !searchQuery.trim()} className="px-4 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-xl hover:bg-black transition-all">
                                {isSearching ? <i className="fa-solid fa-spinner animate-spin"></i> : '添加'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="relative group">
                    <select
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 outline-none appearance-none cursor-pointer hover:border-indigo-400 transition-all focus:ring-2 focus:ring-indigo-100 shadow-sm"
                        value={activeTemplateId}
                        onChange={(e) => onSelectTemplate(e.target.value)}
                    >
                        {filteredTemplates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <i className="fa-solid fa-chevron-down text-xs"></i>
                    </div>
                </div>
            </section>

            <section className="mb-4">
                <div
                    className={`flex justify-between items-center cursor-pointer group select-none p-4 rounded-xl transition-all border-2 ${isMetaExpanded ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-indigo-300 shadow-sm'}`}
                    onClick={() => setIsMetaExpanded(!isMetaExpanded)}
                >
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2rem] flex items-center gap-3 italic">
                        <i className="fa-solid fa-circle-info text-indigo-400"></i> 稿件元数据
                    </h5>
                    <i className={`fa-solid ${isMetaExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] opacity-40 group-hover:opacity-100`}></i>
                </div>

                {isMetaExpanded && (
                    <div className="mt-3 space-y-4 animate-reveal px-1">
                        <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 px-1">正式稿件标题</label>
                            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-black italic outline-none focus:border-indigo-500 shadow-sm resize-none h-20" value={manuscriptMeta.title} onChange={e => onUpdateMeta({ ...manuscriptMeta, title: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1.5 px-1">索引关键词</label>
                            <input className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[11px] font-bold outline-none focus:border-indigo-500 shadow-sm" value={manuscriptMeta.keywords} onChange={e => onUpdateMeta({ ...manuscriptMeta, keywords: e.target.value })} placeholder="Keyword 1, Keyword 2..." />
                        </div>
                    </div>
                )}
            </section>

            <section className="mb-8">
                <div
                    className={`flex justify-between items-center cursor-pointer group select-none p-4 rounded-xl transition-all border-2 ${isAuthorsExpanded ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-indigo-300 shadow-sm'}`}
                    onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                >
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2rem] flex items-center gap-3 italic">
                        <i className="fa-solid fa-user-group text-emerald-400"></i> 作者贡献
                    </h5>
                    <i className={`fa-solid ${isAuthorsExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] opacity-40`}></i>
                </div>

                {isAuthorsExpanded && (
                    <div className="mt-4 space-y-3 animate-reveal px-0.5">
                        <div className="bg-indigo-600/5 rounded-xl border-2 border-dashed border-indigo-200 p-4 mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h6 className="text-[9px] font-black text-indigo-700 uppercase tracking-widest leading-none">AI 贡献审计 (CRediT Analysis)</h6>
                                    <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">基于工作流自动分析建议</p>
                                </div>
                                <button
                                    onClick={() => setShowContributionMatrix(!showContributionMatrix)}
                                    className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all shadow-sm ${showContributionMatrix ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}
                                >
                                    {showContributionMatrix ? '收起' : '分析'}
                                </button>
                            </div>

                            {showContributionMatrix && (
                                <div className="space-y-2 animate-reveal">
                                    {contributionData.map(item => (
                                        <div key={item.name} className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 shadow-sm flex items-center gap-3">
                                            <span className="text-[9px] font-black text-slate-700 w-16 truncate">{item.name}</span>
                                            <div className="flex-1 flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-slate-100 shadow-inner">
                                                <div className="bg-emerald-500" style={{ width: `${item.dataShare}%` }}></div>
                                                <div className="bg-indigo-500" style={{ width: `${item.writingShare}%` }}></div>
                                            </div>
                                            <span className="text-[8px] font-black text-indigo-600 font-mono w-8 text-right">{item.dataShare + item.writingShare}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center mb-3 px-1">
                            <button onClick={() => setShowTeamImport(!showTeamImport)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-sm border ${showTeamImport ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}>
                                <i className="fa-solid fa-id-card-clip"></i> 人力矩阵导入
                            </button>
                            <button onClick={handleAddAuthor} className="text-[8px] font-black text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                                <i className="fa-solid fa-plus-circle"></i> 新增作者
                            </button>
                        </div>

                        {showTeamImport && (
                            <div className="bg-slate-900 p-4 rounded-xl border border-white/5 mb-4 animate-reveal shadow-xl">
                                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-bolt"></i> 团队矩阵成员池
                                </p>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {teamMembers.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => handleImportFromTeam(member)}
                                            className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/5 hover:bg-indigo-600 hover:border-indigo-500 transition-all text-left group"
                                        >
                                            <img src={member.avatar} className="w-7 h-7 rounded-lg border border-white/10" alt="" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-black text-white truncate">{member.name}</p>
                                                <p className="text-[7px] text-slate-500 truncate uppercase font-bold">{member.role}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {manuscriptMeta.authorList.map((author, index) => (
                                <div
                                    key={author.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, author.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, author.id)}
                                    className={`rounded-xl border transition-all p-3.5 relative group/author ${editingAuthorId === author.id ? 'bg-indigo-50/20 border-indigo-400 shadow-md' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'} ${draggedAuthorId === author.id ? 'opacity-40 scale-95 border-dashed' : ''}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setEditingAuthorId(editingAuthorId === author.id ? null : author.id)}>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover/author:opacity-30 cursor-grab active:cursor-grabbing">
                                                    <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                                    <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                                    <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                                </div>
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${editingAuthorId === author.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover/author:bg-indigo-50'}`}>
                                                    <span className="text-[10px] font-black uppercase">{index + 1}</span>
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[12px] font-black text-slate-800 truncate block leading-none">
                                                    {author.name || '未录入姓名'}
                                                    {author.isCoFirst && <span className="ml-1 text-emerald-500 font-black">†</span>}
                                                    {author.isCorresponding && <span className="ml-1 text-rose-500 font-black">*</span>}
                                                </span>
                                                <span className="text-[7.5px] font-black text-slate-400 truncate block uppercase mt-1 tracking-tight">
                                                    {author.affiliation || '机构信息未对标'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveAuthor(author.id); }}
                                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover/author:opacity-100"
                                        >
                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                        </button>
                                    </div>

                                    {editingAuthorId === author.id && (
                                        <div className="mt-4 space-y-4 animate-reveal border-t border-slate-100 pt-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[7.5px] font-black text-slate-400 uppercase mb-1 px-1">作者姓名</label>
                                                    <input className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-[10.5px] font-black outline-none" value={author.name} onChange={e => handleUpdateAuthor(author.id, { name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-[7.5px] font-black text-slate-400 uppercase mb-1 px-1">电子邮箱</label>
                                                    <input className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-[10.5px] font-black outline-none" value={author.email} onChange={e => handleUpdateAuthor(author.id, { email: e.target.value })} />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[7.5px] font-black text-slate-400 uppercase mb-1 px-1">所属机构 (AFFILIATION)</label>
                                                    <textarea className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-[9.5px] font-bold outline-none resize-none h-16" value={author.affiliation} onChange={e => handleUpdateAuthor(author.id, { affiliation: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdateAuthor(author.id, { isCoFirst: !author.isCoFirst })}
                                                    className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase transition-all border flex items-center justify-center gap-1.5 ${author.isCoFirst ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                                >
                                                    共同第一 (†)
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateAuthor(author.id, { isCorresponding: !author.isCorresponding })}
                                                    className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase transition-all border flex items-center justify-center gap-1.5 ${author.isCorresponding ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                                                >
                                                    通讯作者 (*)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <div className="space-y-3 mt-auto pt-4 border-t border-slate-100 no-print">
                <button onClick={onExportWord} disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3 group">
                    {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-file-word text-base group-hover:scale-110 transition-transform"></i> 生成标准化 WORD 稿件</>}
                </button>
                <button onClick={onExportPackage} disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-3 group">
                    {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-file-export text-base group-hover:scale-110 transition-transform"></i> LATEX 完整投稿包</>}
                </button>
            </div>
        </div>
    );
};

export default PublishingPanel;
