import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';

type TextAlign = 'left' | 'center' | 'right' | 'justify';

interface FormattingToolbarProps {
    onFormatText?: (format: 'bold' | 'italic' | 'sub' | 'sup' | 'math' | 'h2' | 'h3') => void;
    isPreviewMode: boolean;
    setIsPreviewMode: (v: boolean) => void;
    showFindReplace: boolean;
    setShowFindReplace: (v: boolean) => void;
    showSymbolMenu?: boolean;
    setShowSymbolMenu?: (v: boolean) => void;
    onInsertSymbol?: (s: string) => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    viewMode?: 'standard' | 'dual' | 'triple';
    textAlign?: TextAlign;
    onTextAlignChange?: (align: TextAlign) => void;
}

const COMMON_SYMBOLS = [
    'α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'φ', 'ω', 'Δ', 'Σ', 'Ω',
    '°C', '±', '≈', '≠', '≤', '≥', '×', '÷', '∞', '∂', '∫', '√', '‰', 'Å', '←', '→', '↑', '↓'
];

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
    onFormatText,
    isPreviewMode,
    setIsPreviewMode,
    showFindReplace,
    setShowFindReplace,
    showSymbolMenu,
    setShowSymbolMenu,
    onInsertSymbol,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    viewMode,
    textAlign = 'left',
    onTextAlignChange
}) => {
    const { t } = useTranslation();
    if (!onFormatText) return null;

    const handleFormat = (e: React.MouseEvent, format: 'bold' | 'italic' | 'sub' | 'sup' | 'math' | 'h2' | 'h3') => {
        e.preventDefault(); // Prevent focus loss on textarea
        onFormatText(format);
    };

    const handleInsert = (e: React.MouseEvent, sym: string) => {
        e.preventDefault();
        onInsertSymbol && onInsertSymbol(sym);
    };

    return (
        <div className="bg-slate-50 px-3 sm:px-4 py-1 border-b border-slate-100 flex items-center gap-1.5 sm:gap-2 z-20 shrink-0 relative">
            {/* Undo / Redo Actions */}
            <div className="flex items-center gap-1">
                <button
                    onClick={(e) => { e.preventDefault(); onUndo?.(); }}
                    disabled={!canUndo}
                    className="w-8 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title={t('writing.formattingToolbar.undo')}
                >
                    <i className="fa-solid fa-rotate-left text-[11px]"></i>
                </button>
                <button
                    onClick={(e) => { e.preventDefault(); onRedo?.(); }}
                    disabled={!canRedo}
                    className="w-8 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    title={t('writing.formattingToolbar.redo')}
                >
                    <i className="fa-solid fa-rotate-right text-[11px]"></i>
                </button>
            </div>

            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>

            <button onMouseDown={(e) => handleFormat(e, 'bold')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.bold')}>
                <i className="fa-solid fa-bold text-xs"></i>
            </button>
            <button onMouseDown={(e) => handleFormat(e, 'italic')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.italic')}>
                <i className="fa-solid fa-italic text-xs"></i>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>
            <button onMouseDown={(e) => handleFormat(e, 'sub')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.subscript')}>
                <i className="fa-solid fa-subscript text-xs"></i>
            </button>
            <button onMouseDown={(e) => handleFormat(e, 'sup')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.superscript')}>
                <i className="fa-solid fa-superscript text-xs"></i>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>
            <button onMouseDown={(e) => handleFormat(e, 'math')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.inlineMath')}>
                <i className="fa-solid fa-square-root-variable text-xs"></i>
            </button>

            {/* Symbol Picker */}
            <div className="relative">
                <button
                    onMouseDown={(e) => { e.preventDefault(); setShowSymbolMenu && setShowSymbolMenu(!showSymbolMenu); }}
                    className={`w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center transition-colors ${showSymbolMenu ? 'bg-slate-200 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                    title={t('writing.formattingToolbar.insertSymbol')}
                >
                    <span className="font-serif font-bold text-sm">Ω</span>
                </button>
                {showSymbolMenu && onInsertSymbol && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 grid grid-cols-8 gap-1 z-50 animate-reveal">
                        {COMMON_SYMBOLS.map(sym => (
                            <button
                                key={sym}
                                onMouseDown={(e) => handleInsert(e, sym)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-indigo-50 rounded text-slate-700 hover:text-indigo-600 font-serif text-sm transition-all"
                            >
                                {sym}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>
            <button onMouseDown={(e) => handleFormat(e, 'h2')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.h2')}>
                <span className="text-[10px] font-black">H2</span>
            </button>
            <button onMouseDown={(e) => handleFormat(e, 'h3')} className="w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors" title={t('writing.formattingToolbar.h3')}>
                <span className="text-[10px] font-black">H3</span>
            </button>

            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>

            {/* Text Alignment */}
            {onTextAlignChange && (
                <>
                    {(['left', 'center', 'right', 'justify'] as TextAlign[]).map(align => (
                        <button
                            key={align}
                            onMouseDown={(e) => { e.preventDefault(); onTextAlignChange(align); }}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${textAlign === align
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                                }`}
                            title={{
                                left: t('writing.formattingToolbar.alignLeft'),
                                center: t('writing.formattingToolbar.alignCenter'),
                                right: t('writing.formattingToolbar.alignRight'),
                                justify: t('writing.formattingToolbar.alignJustify')
                            }[align]}
                        >
                            <i className={`fa-solid fa-align-${align} text-xs`}></i>
                        </button>
                    ))}
                </>
            )}

            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"></div>
            <button
                onClick={() => setShowFindReplace(!showFindReplace)}
                className={`w-6 h-6 rounded hover:bg-slate-200 flex items-center justify-center transition-colors ${showFindReplace ? 'bg-slate-200 text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                title={t('writing.findReplace.title')}
            >
                <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </button>

            <div className="flex-1"></div>
            {/* 在三栏模式下隐藏预览按钮，因为已经有实时预览 */}
            {viewMode !== 'triple' && (
                <button onClick={() => setIsPreviewMode(!isPreviewMode)} className={`px-3 py-1 rounded text-[10px] font-black uppercase flex items-center gap-2 transition-all ${isPreviewMode ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                    <i className={`fa-solid ${isPreviewMode ? 'fa-eye-slash' : 'fa-eye'}`}></i> {isPreviewMode ? t('writing.formattingToolbar.edit') : t('writing.formattingToolbar.preview')}
                </button>
            )}
        </div>
    );
};