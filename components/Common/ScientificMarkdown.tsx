
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useProjectContext } from '../../context/ProjectContext';

// Enhanced Markdown Renderer for Academic Reports using Standard Libraries
const ScientificMarkdown = ({ content }: { content: string }) => {
    const { appSettings } = useProjectContext();

    // 关键修复：预处理文本，防止 Markdown 误吞公式中的特殊字符
    const cleanContent = (content || "")
        .replace(/\\n/g, '\n')
        // 保护吸附位点星号，防止被识别为斜体（Markdown 转义）
        .replace(/([A-Z][a-z]?)\*/g, '$1\\*')
        // 修复化学式中下标/上标字符后的多余空格（如 H₂ O → H₂O）
        .replace(/([₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔⁿ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾])\s+([A-Za-z(（·])/g, '$1$2')
        // 修复中间点前后的多余空格（如 NiCl₂ · 6H₂O → NiCl₂·6H₂O）
        .replace(/\s*·\s*/g, '·')
        .trim();

    const isSerif = appSettings.latexStyle === 'serif';

    return (
        <>
            <style>{`
                @font-face {
                    font-family: 'AcademicLatin';
                    src: local('Times New Roman'), local('TimesNewRoman'), local('Times');
                    unicode-range: U+0020-007F, U+00A0-00FF, U+0100-024F, U+2000-206F;
                }
                .markdown-body {
                    font-family: 'AcademicLatin', ${isSerif ? "'Songti SC', 'SimSun', 'STSong', serif" : "'PingFang SC', 'Microsoft YaHei', sans-serif"} !important;
                }
                .markdown-body h1, .markdown-body h2, .markdown-body h3 {
                    font-family: 'AcademicLatin', ${isSerif ? "'Songti SC', 'SimSun', serif" : "'PingFang SC', 'Microsoft YaHei', sans-serif"} !important;
                }
                .markdown-body p, .markdown-body li, .markdown-body td, .markdown-body th {
                    font-family: 'AcademicLatin', ${isSerif ? "'Songti SC', 'SimSun', serif" : "'PingFang SC', 'Microsoft YaHei', sans-serif"} !important;
                }
            `}</style>
            <div className={`markdown-body text-slate-800 leading-relaxed text-justify selection:bg-indigo-100 ${isSerif ? 'font-serif' : 'font-sans'}`} id="academic-report-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
                    rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                    components={{
                        h1: ({ node, ...props }) => (
                            <h1 className={`text-4xl font-black text-indigo-950 border-l-[12px] border-indigo-600 pl-8 mb-12 mt-4 uppercase tracking-tighter leading-tight`} {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                            <h2 className={`text-2xl font-black text-indigo-900 mt-12 mb-8 flex items-center gap-3 leading-tight border-b border-indigo-100 pb-2`} {...props}>
                                <i className="fa-solid fa-diamond text-indigo-500 text-sm"></i>
                                {props.children}
                            </h2>
                        ),
                        h3: ({ node, ...props }) => (
                            <h3 className={`text-lg font-black text-slate-800 mt-8 mb-4 flex items-center gap-2 leading-tight`} {...props}>
                                {props.children}
                            </h3>
                        ),
                        p: ({ node, ...props }) => (
                            <p className={`mb-6 text-[16px] font-medium text-slate-700 leading-[2.0] tracking-normal`} {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-8 mb-6 space-y-4" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                            <li className={`text-[16px] font-medium text-slate-700 leading-[1.8]`} {...props} />
                        ),
                        blockquote: ({ node, ...props }) => (
                            <blockquote className="border-l-4 border-amber-400 bg-amber-50/50 p-6 my-10 rounded-r-2xl text-amber-900 italic text-base shadow-sm" {...props} />
                        ),
                        code: ({ node, className, children, ...props }) => {
                            return (
                                <code className={`${className} bg-slate-100 text-rose-600 rounded px-2 py-0.5 font-mono text-[13px] font-bold border border-slate-200/50`} {...props}>
                                    {children}
                                </code>
                            )
                        },
                        img: ({ node, ...props }) => (
                            <div className="my-12 flex flex-col items-center">
                                <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-w-[95%] transition-transform hover:scale-[1.02] cursor-zoom-in">
                                    <img {...props} className="w-full h-auto rounded-xl block" style={{ maxHeight: '600px', objectFit: 'contain' }} />
                                </div>
                                {props.alt && (
                                    <p className="mt-5 text-[12px] font-black text-slate-500 uppercase tracking-widest text-center italic max-w-[85%] leading-relaxed">
                                        <span className="text-indigo-600 mr-2 font-black">Figure.</span> {props.alt}
                                    </p>
                                )}
                            </div>
                        )
                    }}
                >
                    {cleanContent}
                </ReactMarkdown>
            </div>
        </>
    );
};

export default ScientificMarkdown;
