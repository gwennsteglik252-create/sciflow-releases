
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 精简版 Markdown 渲染器，专用于洞察卡片、摘要面板等紧凑场景。
 * 字体偏小，不带 LaTeX，样式不会溢出父容器。
 */
const CompactMarkdown = ({ content }: { content: string }) => {
    const safeContent = (content || '')
        .replace(/\\n/g, '\n')
        .trim();

    return (
        <div className="compact-markdown text-inherit">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ node, ...props }) => (
                        <h1 className="text-[13px] font-black text-inherit mb-2 mt-3 border-b border-white/10 pb-1" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2 className="text-[12px] font-black text-inherit mb-1.5 mt-2.5 flex items-center gap-1.5" {...props}>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block shrink-0"></span>
                            {props.children}
                        </h2>
                    ),
                    h3: ({ node, ...props }) => (
                        <h3 className="text-[11px] font-bold text-inherit mb-1 mt-2" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                        <p className="text-[11px] text-inherit leading-relaxed mb-2 last:mb-0 opacity-90" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                        <li className="text-[11px] text-inherit leading-relaxed opacity-90" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                        <strong className="font-bold text-inherit" {...props} />
                    ),
                    em: ({ node, ...props }) => (
                        <em className="italic text-slate-500" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-2 border-indigo-300 pl-3 my-2 text-[10px] text-slate-500 italic" {...props} />
                    ),
                    code: ({ node, ...props }) => (
                        <code className="bg-slate-100 text-rose-600 rounded px-1 py-0.5 font-mono text-[10px] border border-slate-200" {...props} />
                    ),
                    hr: () => <hr className="border-slate-200 my-2" />,
                }}
            >
                {safeContent}
            </ReactMarkdown>
        </div>
    );
};

export default CompactMarkdown;
