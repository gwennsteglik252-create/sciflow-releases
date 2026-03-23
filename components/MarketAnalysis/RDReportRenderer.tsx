// ═══ RDReportRenderer — 研发战略建议书可视化渲染 ═══
import React, { useState, useMemo, useRef, useEffect } from 'react';

interface Props {
    content: string;
    isLightMode?: boolean;
}

// 章节图标和颜色映射
const SECTION_STYLES: Record<string, { icon: string; color: string; gradient: string }> = {
    '执行摘要': { icon: 'fa-clipboard-list', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
    '技术路线': { icon: 'fa-route', color: 'violet', gradient: 'from-violet-500 to-purple-600' },
    '性能对标': { icon: 'fa-bullseye', color: 'blue', gradient: 'from-blue-500 to-indigo-600' },
    '知识产权': { icon: 'fa-shield-halved', color: 'amber', gradient: 'from-amber-500 to-orange-600' },
    '供应链': { icon: 'fa-truck-fast', color: 'cyan', gradient: 'from-cyan-500 to-teal-600' },
    '差异化': { icon: 'fa-crosshairs', color: 'rose', gradient: 'from-rose-500 to-pink-600' },
    '研发投资': { icon: 'fa-coins', color: 'yellow', gradient: 'from-yellow-500 to-amber-600' },
    '风险评估': { icon: 'fa-triangle-exclamation', color: 'red', gradient: 'from-red-500 to-rose-600' },
    '里程碑': { icon: 'fa-flag-checkered', color: 'indigo', gradient: 'from-indigo-500 to-violet-600' },
    '关键成功': { icon: 'fa-chart-line', color: 'teal', gradient: 'from-teal-500 to-emerald-600' },
    '战略总结': { icon: 'fa-star', color: 'orange', gradient: 'from-orange-500 to-red-600' },
    'KPI': { icon: 'fa-chart-line', color: 'teal', gradient: 'from-teal-500 to-emerald-600' },
    // 路线深度分析模块章节
    '合成工艺': { icon: 'fa-flask-vial', color: 'violet', gradient: 'from-violet-500 to-purple-600' },
    '工艺流程': { icon: 'fa-flask-vial', color: 'violet', gradient: 'from-violet-500 to-purple-600' },
    '原材料': { icon: 'fa-cubes', color: 'amber', gradient: 'from-amber-500 to-orange-600' },
    '设备': { icon: 'fa-gears', color: 'cyan', gradient: 'from-cyan-500 to-blue-600' },
    '基础设施': { icon: 'fa-gears', color: 'cyan', gradient: 'from-cyan-500 to-blue-600' },
    '验证实验': { icon: 'fa-vial', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
    '实验方案': { icon: 'fa-vial', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
    '技术难点': { icon: 'fa-puzzle-piece', color: 'rose', gradient: 'from-rose-500 to-red-600' },
    '突破策略': { icon: 'fa-puzzle-piece', color: 'rose', gradient: 'from-rose-500 to-red-600' },
    '技术情报': { icon: 'fa-magnifying-glass', color: 'blue', gradient: 'from-blue-500 to-indigo-600' },
    '文献检索': { icon: 'fa-magnifying-glass', color: 'blue', gradient: 'from-blue-500 to-indigo-600' },
    '成本递减': { icon: 'fa-chart-line', color: 'yellow', gradient: 'from-yellow-500 to-amber-600' },
    '成本模型': { icon: 'fa-chart-line', color: 'yellow', gradient: 'from-yellow-500 to-amber-600' },
    '团队配置': { icon: 'fa-users', color: 'sky', gradient: 'from-sky-500 to-blue-600' },
    '验收标准': { icon: 'fa-clipboard-check', color: 'indigo', gradient: 'from-indigo-500 to-violet-600' },
    'Go/No-Go': { icon: 'fa-clipboard-check', color: 'indigo', gradient: 'from-indigo-500 to-violet-600' },
};

function getStyle(title: string) {
    for (const [key, style] of Object.entries(SECTION_STYLES)) {
        if (title.includes(key)) return style;
    }
    return { icon: 'fa-bookmark', color: 'slate', gradient: 'from-slate-500 to-slate-600' };
}

// 解析 Markdown 表格
function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
    if (lines.length < 2) return null;
    const headerLine = lines[0];
    const sepLine = lines[1];
    if (!sepLine.match(/^[\s|:-]+$/)) return null;
    const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
    const rows = lines.slice(2).map(l => l.split('|').map(c => c.trim()).filter(Boolean));
    return { headers, rows };
}

// 将 inline markdown 转为简单 HTML
function inlineMarkdown(text: string): string {
    return text
        // 清理 LaTeX 格式：$Co_3O_4$ → Co3O4
        .replace(/\$([^$]+)\$/g, (_, inner) => inner.replace(/[_{}\\]/g, '').replace(/\\(?:text|mathrm|mathbf)\{([^}]+)\}/g, '$1'))
        .replace(/\\\((.+?)\\\)/g, (_, inner) => inner.replace(/[_{}\\]/g, ''))
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-violet-600">$1</code>')
        .replace(/🟢/g, '<span class="inline-block w-3 h-3 rounded-full bg-emerald-500 align-middle mr-1"></span>')
        .replace(/🟡/g, '<span class="inline-block w-3 h-3 rounded-full bg-amber-400 align-middle mr-1"></span>')
        .replace(/🔴/g, '<span class="inline-block w-3 h-3 rounded-full bg-red-500 align-middle mr-1"></span>');
}

// 渲染内容块（非表格部分）
function ContentBlock({ lines, isLightMode }: { lines: string[]; isLightMode: boolean }) {
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 检测表格开始
        if (line.includes('|') && i + 1 < lines.length && lines[i + 1]?.match(/^[\s|:-]+$/)) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].includes('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            const table = parseTable(tableLines);
            if (table) {
                elements.push(
                    <div key={`table-${i}`} className="overflow-x-auto my-4 rounded-xl border border-slate-200 shadow-sm">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className={`${isLightMode ? 'bg-gradient-to-r from-slate-100 to-slate-50' : 'bg-slate-700/50'}`}>
                                    {table.headers.map((h, hi) => (
                                        <th key={hi} className={`px-3 py-2.5 text-left font-black uppercase tracking-wider whitespace-nowrap ${isLightMode ? 'text-slate-700 border-b-2 border-slate-200' : 'text-white border-b border-slate-600'}`}
                                            dangerouslySetInnerHTML={{ __html: inlineMarkdown(h) }} />
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {table.rows.map((row, ri) => (
                                    <tr key={ri} className={`${ri % 2 === 0 ? (isLightMode ? 'bg-white' : 'bg-transparent') : (isLightMode ? 'bg-slate-50/50' : 'bg-white/3')} hover:bg-teal-50/50 transition-colors`}>
                                        {row.map((cell, ci) => (
                                            <td key={ci} className={`px-3 py-2 border-b ${isLightMode ? 'border-slate-100 text-slate-600' : 'border-slate-700 text-slate-300'}`}
                                                dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }
            continue;
        }

        // H4 子标题
        if (line.startsWith('#### ')) {
            elements.push(
                <h4 key={`h4-${i}`} className={`text-[11px] font-black mt-4 mb-2 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                    <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-purple-500" />
                    <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(line.replace(/^####\s*/, '')) }} />
                </h4>
            );
            i++;
            continue;
        }

        // 列表项
        if (line.match(/^\s*[-*]\s/)) {
            const listItems: string[] = [];
            while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
                listItems.push(lines[i].replace(/^\s*[-*]\s/, ''));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} className="my-2 space-y-1.5">
                    {listItems.map((item, li) => (
                        <li key={li} className={`flex items-start gap-2 text-[10px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                            <i className="fa-solid fa-chevron-right text-[6px] text-teal-500 mt-1.5 shrink-0" />
                            <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        // 有序列表
        if (line.match(/^\s*\d+\.\s/)) {
            const listItems: string[] = [];
            while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
                listItems.push(lines[i].replace(/^\s*\d+\.\s/, ''));
                i++;
            }
            elements.push(
                <ol key={`ol-${i}`} className="my-2 space-y-1.5">
                    {listItems.map((item, li) => (
                        <li key={li} className={`flex items-start gap-2 text-[10px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-[8px] font-black flex items-center justify-center shrink-0 mt-0.5">{li + 1}</span>
                            <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        // 空行
        if (!line.trim()) { i++; continue; }

        // 分割线
        if (line.match(/^---+$/)) {
            i++;
            continue;
        }

        // 普通段落
        elements.push(
            <p key={`p-${i}`} className={`text-[10px] leading-relaxed my-2 ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}
                dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
        );
        i++;
    }

    return <>{elements}</>;
}

export const RDReportRenderer: React.FC<Props> = ({ content, isLightMode = true }) => {
    const [activeSection, setActiveSection] = useState(0);
    const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

    // 解析 markdown 为章节
    const sections = useMemo(() => {
        const result: { level: number; title: string; rawTitle: string; content: string[] }[] = [];
        const lines = content.split('\n');
        let current: { level: number; title: string; rawTitle: string; content: string[] } | null = null;

        for (const line of lines) {
            const h1Match = line.match(/^#\s+(.+)/);
            const h2Match = line.match(/^##\s+(.+)/);
            const h3Match = line.match(/^###\s+(.+)/);

            if (h1Match) {
                // H1 = 报告标题，作为特殊章节
                if (current) result.push(current);
                current = { level: 1, title: h1Match[1].trim(), rawTitle: line, content: [] };
            } else if (h2Match) {
                if (current) result.push(current);
                current = { level: 2, title: h2Match[1].trim(), rawTitle: line, content: [] };
            } else if (h3Match) {
                if (current) result.push(current);
                current = { level: 3, title: h3Match[1].trim(), rawTitle: line, content: [] };
            } else {
                if (current) {
                    current.content.push(line);
                } else {
                    // 标题前的内容
                    current = { level: 0, title: '概述', rawTitle: '', content: [line] };
                }
            }
        }
        if (current) result.push(current);
        return result;
    }, [content]);

    // 监听滚动高亮目录
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const idx = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
                    if (idx >= 0) setActiveSection(idx);
                }
            });
        }, { threshold: 0.3 });

        sectionRefs.current.forEach(ref => { if (ref) observer.observe(ref); });
        return () => observer.disconnect();
    }, [sections]);

    const scrollToSection = (idx: number) => {
        sectionRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 分离标题区域和内容章节
    const titleSection = sections.find(s => s.level === 1);
    const contentSections = sections.filter(s => s.level >= 2);

    return (
        <div className="flex gap-5 h-full">
            {/* 左侧目录 */}
            <div className="w-52 shrink-0 sticky top-0 self-start">
                <div className={`rounded-2xl border p-4 ${isLightMode ? 'bg-white/80 backdrop-blur-xl border-slate-200 shadow-sm' : 'bg-slate-800/80 backdrop-blur-xl border-slate-700'}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <i className="fa-solid fa-list text-teal-500" />目录导航
                    </p>
                    <nav className="space-y-0.5">
                        {contentSections.map((sec, idx) => {
                            const style = getStyle(sec.title);
                            const isActive = activeSection === sections.indexOf(sec);
                            return (
                                <button
                                    key={idx}
                                    onClick={() => scrollToSection(sections.indexOf(sec))}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all flex items-center gap-2 ${
                                        isActive
                                            ? `bg-${style.color}-50 text-${style.color}-700 shadow-sm`
                                            : `text-slate-500 hover:bg-slate-50 hover:text-slate-700`
                                    }`}
                                >
                                    <i className={`fa-solid ${style.icon} text-[7px] ${isActive ? `text-${style.color}-500` : 'text-slate-300'}`} />
                                    <span className="truncate">{sec.title.replace(/^\d+\.\s*/, '').replace(/^📋\s*/, '')}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* 右侧内容 */}
            <div className="flex-1 min-w-0 space-y-5 overflow-y-auto custom-scrollbar pb-10">
                {/* 报告标题 */}
                {titleSection && (
                    <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg">
                        <h1 className="text-xl font-black">{titleSection.title}</h1>
                        {titleSection.content.filter(l => l.trim()).length > 0 && (
                            <div className="mt-3 text-[10px] text-white/80 space-y-1">
                                {titleSection.content.filter(l => l.trim()).map((l, i) => (
                                    <p key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(l) }} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 内容章节 */}
                {contentSections.map((sec, idx) => {
                    const style = getStyle(sec.title);
                    const globalIdx = sections.indexOf(sec);
                    const isExecutiveSummary = sec.title.includes('执行摘要');

                    return (
                        <div
                            key={idx}
                            ref={el => { sectionRefs.current[globalIdx] = el; }}
                            className={`rounded-2xl border overflow-hidden transition-all ${
                                isExecutiveSummary
                                    ? `${isLightMode ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-md' : 'bg-emerald-900/20 border-emerald-700'}`
                                    : `${isLightMode ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-white/5 border-white/10'}`
                            }`}
                        >
                            {/* 章节标题栏 */}
                            <div className={`px-5 py-3 flex items-center gap-3 border-b ${
                                isExecutiveSummary
                                    ? 'border-emerald-200 bg-emerald-500/10'
                                    : isLightMode ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/3'
                            }`}>
                                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                                    <i className={`fa-solid ${style.icon} text-white text-[10px]`} />
                                </div>
                                <h2 className={`text-[12px] font-black flex-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}
                                    dangerouslySetInnerHTML={{ __html: inlineMarkdown(sec.title.replace(/^#+\s*/, '')) }} />
                            </div>

                            {/* 章节内容 */}
                            <div className="px-5 py-4">
                                <ContentBlock lines={sec.content} isLightMode={isLightMode} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RDReportRenderer;
