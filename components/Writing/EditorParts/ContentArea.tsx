
import React, { RefObject } from 'react';
import ScientificMarkdown from '../../Common/ScientificMarkdown';

interface ContentAreaProps {
    textareaRef: RefObject<HTMLTextAreaElement>;
    isPreviewMode: boolean;
    editorContent: string;
    activeSectionId: string;
    onEditorChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onEditorSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
    onCompositionStart?: () => void;
    onCompositionEnd?: (e: React.CompositionEvent<HTMLTextAreaElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onDoubleClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export const ContentArea: React.FC<ContentAreaProps> = ({
    textareaRef, isPreviewMode, editorContent, activeSectionId,
    onEditorChange, onEditorSelect, onCompositionStart, onCompositionEnd, onKeyDown, onDoubleClick,
    textAlign = 'left'
}) => {

    // 精简排版参数：减少内边距，使内容充满容器，同时保持专业学术美感
    const editorStyles: React.CSSProperties = {
        fontSize: '16px',
        lineHeight: '1.8',
        fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
        padding: '24px 32px 120px 32px', // 减少左右边距，增加底部余白供滚动
        width: '100%',
        height: '100%',
        border: 'none',
        outline: 'none',
        resize: 'none',
        backgroundColor: 'transparent',
        color: '#1e293b', // slate-800
        textAlign: textAlign as any,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        tabSize: 4,
    };

    return (
        <div className="relative flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
            {/* 移除背景点状装饰，保持背景纯净，避免视觉干扰 */}

            {isPreviewMode ? (
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50/20 z-10">
                    <div className="max-w-full mx-auto bg-white p-10 rounded-3xl shadow-sm border border-slate-100">
                        <ScientificMarkdown content={editorContent} />
                    </div>
                </div>
            ) : (
                <div className="flex-1 relative flex flex-col overflow-hidden">
                    {/* 移除 max-w-5xl 限制，让编辑框占满父容器宽度 */}
                    <div className="w-full h-full relative z-10">
                        <textarea
                            ref={textareaRef}
                            className="w-full h-full overflow-y-auto custom-scrollbar focus:ring-0 selection:bg-indigo-500/20 scroll-smooth"
                            style={editorStyles}
                            placeholder={activeSectionId === 'references' ? "文献列表将在此处由引用引擎自动生成..." : "在此输入您的研究成果..."}
                            value={editorContent}
                            onChange={onEditorChange}
                            onSelect={onEditorSelect}
                            onClick={onEditorSelect}
                            onCompositionStart={onCompositionStart}
                            onCompositionEnd={onCompositionEnd}
                            onKeyDown={onKeyDown}
                            onDoubleClick={onDoubleClick}
                            spellCheck={false}
                            autoComplete="off"
                            autoCorrect="off"
                        />
                    </div>

                    {/* 底部渐变遮罩：提供视觉上的柔和切断感 */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-20"></div>
                </div>
            )}

            <style>{`
            /* 深度优化选中效果 */
            textarea::selection {
                background: rgba(99, 102, 241, 0.25);
                color: inherit;
            }
            
            /* 移除输入框焦点时的背景变色，保持内容区完全洁净 */
            textarea:focus {
                background-color: transparent;
            }

            /* 优化预览模式下的 Markdown 容器宽度 */
            .max-w-full { max-width: 100% !important; }
        `}</style>
        </div>
    );
};
