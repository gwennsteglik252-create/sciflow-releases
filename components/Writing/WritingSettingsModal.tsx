import React, { useMemo, useState } from 'react';
import { ResearchProject } from '../../types';
import { DocType, SECTION_CONFIG, TEMPLATES } from './WritingConfig';

interface WritingSettingsModalProps {
    show: boolean;
    onClose: () => void;
    projects: ResearchProject[];
    selectedProjectId: string;
    onSelectProject: (id: string) => void;
    docType: DocType;
    onDocTypeChange: (type: DocType) => void;
    language: 'zh' | 'en';
    setLanguage: (lang: 'zh' | 'en') => void;
    onSectionSwitch: (id: string) => void;
    activeTemplateId: string;
    onSelectTemplate: (id: string) => void;
    templates: any[];
    onAddTemplate: (tpl: any) => void;
}

const WritingSettingsModal: React.FC<WritingSettingsModalProps> = ({
    show, onClose, projects, selectedProjectId, onSelectProject,
    docType, onDocTypeChange, language, setLanguage, onSectionSwitch,
    activeTemplateId, onSelectTemplate, templates, onAddTemplate
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // New configuration states
    const [aiAgentMode, setAiAgentMode] = useState<'editor' | 'reviewer' | 'translator'>('editor');
    const [wordCountGoal, setWordCountGoal] = useState('3000');
    const [protectTerms, setProtectTerms] = useState(true);

    const filteredTemplates = useMemo(() => {
        return templates.filter(t => t.docType === docType);
    }, [templates, docType]);

    const docTypes: { id: DocType; label: string; icon: string; color: string }[] = useMemo(() => [
        { id: 'paper', label: '学术论文', icon: 'fa-file-lines', color: 'bg-indigo-600' },
        { id: 'report', label: '技术报告', icon: 'fa-chart-pie', color: 'bg-teal-600' },
        { id: 'patent', label: '发明专利', icon: 'fa-gavel', color: 'bg-violet-600' }
    ], []);

    const handleSearchAdd = () => {
        if (!searchQuery.trim() || isSearching) return;
        setIsSearching(true);
        setTimeout(() => {
            const newTpl = {
                id: `tpl_discovery_${Date.now()}`,
                name: searchQuery,
                docType: docType,
                columns: 2,
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
            setSearchQuery('');
        }, 1500);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-6 lg:p-10 animate-reveal shadow-2xl relative border border-slate-200 flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all active:scale-90"><i className="fa-solid fa-times text-xl"></i></button>

                <header className="mb-8 shrink-0 text-center">
                    <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">写作工作站配置</h3>
                    <div className="w-10 h-1 bg-indigo-600 mx-auto mt-2 rounded-full opacity-20"></div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                    {/* 1. Project Context */}
                    <section>
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <i className="fa-solid fa-link"></i> 关联研究课题
                        </h4>
                        <div className="relative group">
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 transition-all appearance-none cursor-pointer shadow-sm"
                                value={selectedProjectId}
                                onChange={(e) => onSelectProject(e.target.value)}
                            >
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <i className="fa-solid fa-chevron-down text-xs"></i>
                            </div>
                        </div>
                    </section>

                    {/* 2. Document Type */}
                    <section>
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <i className="fa-solid fa-shapes"></i> 文档体裁
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                            {docTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => {
                                        onDocTypeChange(type.id);
                                        onSectionSwitch(SECTION_CONFIG[type.id][0].id);
                                    }}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-3 group relative overflow-hidden ${docType === type.id ? `border-indigo-500 shadow-md ${type.color} text-white` : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-white'}`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${docType === type.id ? 'bg-white/20' : 'bg-white text-indigo-600 border border-slate-100'}`}>
                                        <i className={`fa-solid ${type.icon} text-lg`}></i>
                                    </div>
                                    <h5 className="text-[10px] font-black uppercase">{type.label}</h5>
                                    {docType === type.id && (
                                        <div className="absolute top-2 right-2">
                                            <i className="fa-solid fa-circle-check text-white text-[10px]"></i>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* 3. Journal Template - Searchable discovery bar and dropdown */}
                    <section>
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <i className="fa-solid fa-scroll"></i> 期刊排版模板
                        </h4>

                        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-4 focus-within:ring-indigo-100 transition-all flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                                {isSearching ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                            </div>
                            <input
                                className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 placeholder:text-slate-400"
                                placeholder="输入新期刊名称以通过 AI 发现并添加..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchAdd()}
                            />
                            <button
                                onClick={handleSearchAdd}
                                disabled={isSearching || !searchQuery.trim()}
                                className="px-6 py-2 bg-indigo-500/80 text-white rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50"
                            >
                                发现
                            </button>
                        </div>

                        <div className="relative group">
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 transition-all appearance-none cursor-pointer shadow-sm"
                                value={activeTemplateId}
                                onChange={(e) => onSelectTemplate(e.target.value)}
                            >
                                {filteredTemplates.map(tpl => (
                                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                                ))}
                                {filteredTemplates.length === 0 && <option disabled>暂无匹配体裁的模板</option>}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <i className="fa-solid fa-chevron-down text-xs"></i>
                            </div>
                        </div>
                    </section>

                    {/* 4. AI Agent Strategy - NEW FEATURE */}
                    <section>
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <i className="fa-solid fa-robot"></i> AI 协作策略 (STRATEGY)
                        </h4>
                        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            {[
                                { id: 'editor', label: '资深编辑', icon: 'fa-wand-magic-sparkles', sub: '侧重语言润色' },
                                { id: 'reviewer', label: '批判评审', icon: 'fa-scale-balanced', sub: '侧重逻辑找茬' },
                                { id: 'translator', label: '学术翻译', icon: 'fa-language', sub: '侧重地道直译' }
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setAiAgentMode(mode.id as any)}
                                    className={`flex flex-col items-center py-2.5 rounded-xl transition-all ${aiAgentMode === mode.id ? 'bg-white text-indigo-600 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <i className={`fa-solid ${mode.icon} mb-1.5 text-xs`}></i>
                                    <span className="text-[9px] font-black uppercase leading-none">{mode.label}</span>
                                    <span className="text-[6px] font-bold opacity-60 mt-1">{mode.sub}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* 5. Writing Goals & Constraints - NEW FEATURE */}
                    <section className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                                <i className="fa-solid fa-bullseye text-rose-500"></i> 字数目标 (GOAL)
                            </h4>
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 focus-within:border-indigo-400 transition-all shadow-sm">
                                <input
                                    type="number"
                                    className="bg-transparent border-none outline-none text-base font-black text-slate-800 w-24"
                                    value={wordCountGoal}
                                    onChange={e => setWordCountGoal(e.target.value)}
                                />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Words</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                                <i className="fa-solid fa-shield-check text-emerald-500"></i> 术语一致性
                            </h4>
                            <button
                                onClick={() => setProtectTerms(!protectTerms)}
                                className={`flex-1 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 px-4 py-3 shadow-sm ${protectTerms ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                            >
                                <i className={`fa-solid ${protectTerms ? 'fa-lock' : 'fa-lock-open'}`}></i>
                                <span className="text-[10px] font-black uppercase">术语保护 {protectTerms ? 'ON' : 'OFF'}</span>
                            </button>
                        </div>
                    </section>

                    {/* 6. Language Preference */}
                    <section>
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                            <i className="fa-solid fa-language"></i> 辅助输出语言
                        </h4>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full shadow-inner">
                            <button
                                onClick={() => setLanguage('zh')}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${language === 'zh' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                学术中文 (SIMPLIFIED CHINESE)
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${language === 'en' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                ACADEMIC ENGLISH
                            </button>
                        </div>
                    </section>
                </div>

                <footer className="mt-10 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-5 bg-slate-700/80 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
                    >
                        完成并应用配置
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default WritingSettingsModal;