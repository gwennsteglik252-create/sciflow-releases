
import React, { useState } from 'react';
import { polishTextEnhanced } from '../../../services/gemini/writing';
import { useProjectContext } from '../../../context/ProjectContext';
import { useTranslation } from '../../../locales/useTranslation';

interface PolishingPanelProps {
    onPolish: (mode: string) => void;
    isProcessing: boolean;
    docType: 'paper' | 'report' | 'patent';
    language: 'zh' | 'en';
    editorContent: string;
    onApplyPolished: (text: string) => void;
}

interface Suggestion {
    id: string;
    original: string;
    polished: string;
    reasoning: string[];
    impact: string;
}

const PolishingPanel: React.FC<PolishingPanelProps> = ({
    onPolish, isProcessing, docType, language, editorContent, onApplyPolished
}) => {
    const { showToast } = useProjectContext();
    const { t } = useTranslation();
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [internalLoading, setInternalLoading] = useState(false);

    const handlePolishWithSuggestion = async (mode: string) => {
        // 逻辑：如果用户在编辑器里有选区，则润色选区；否则润色当前整个章节
        const selection = window.getSelection()?.toString() || editorContent;
        if (!selection.trim()) {
            showToast({ message: t('writing.polishingPanel.selectTextFirst'), type: 'info' });
            return;
        }

        setInternalLoading(true);
        try {
            const result = await polishTextEnhanced(selection, mode, language);
            if (result && result.polishedText) {
                const newSuggestion: Suggestion = {
                    id: Date.now().toString(),
                    original: selection,
                    polished: result.polishedText,
                    reasoning: result.reasoning || [],
                    impact: result.impact || 'Precision'
                };
                setSuggestions([newSuggestion, ...suggestions]);
                showToast({ message: t('writing.polishingPanel.generated'), type: 'success' });
            }
        } catch (e) {
            showToast({ message: t('writing.polishingPanel.serviceError'), type: 'error' });
        } finally {
            setInternalLoading(false);
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'Precision': return 'bg-emerald-100 text-emerald-700';
            case 'Logic': return 'bg-indigo-100 text-indigo-700';
            case 'Formality': return 'bg-violet-100 text-violet-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="flex flex-col gap-4 animate-reveal">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[9px] text-amber-800 leading-relaxed italic">
                <i className="fa-solid fa-lightbulb mr-1.5"></i>
                {t('writing.polishingPanel.hint')}
            </div>

            {/* 模式选择网格 */}
            <div className="grid grid-cols-2 gap-2">
                {[
                    { id: 'academic', label: t('writing.polishingPanel.academic'), icon: 'fa-wand-magic-sparkles', color: 'indigo' },
                    { id: 'objective', label: t('writing.polishingPanel.objective'), icon: 'fa-scale-balanced', color: 'emerald' },
                    { id: 'logic', label: t('writing.polishingPanel.logic'), icon: 'fa-link', color: 'violet' },
                    { id: 'formula', label: t('writing.polishingPanel.formula'), icon: 'fa-square-root-variable', color: 'blue' }
                ].map(m => (
                    <button
                        key={m.id}
                        onClick={() => handlePolishWithSuggestion(m.id)}
                        disabled={isProcessing || internalLoading}
                        className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md transition-all flex flex-col items-center gap-2 group active:scale-95 disabled:opacity-50"
                    >
                        <div className={`w-8 h-8 rounded-full bg-${m.color}-50 text-${m.color}-600 flex items-center justify-center group-hover:bg-${m.color}-600 group-hover:text-white transition-all`}>
                            <i className={`fa-solid ${m.icon} text-xs`}></i>
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* 建议列表 */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 flex justify-between items-center">
                    <span>{t('writing.polishingPanel.pendingSuggestions')} ({suggestions.length})</span>
                    {suggestions.length > 0 && <button onClick={() => setSuggestions([])} className="text-rose-500 hover:underline">{t('writing.polishingPanel.clear')}</button>}
                </p>

                <div className="space-y-3">
                    {suggestions.map((s) => (
                        <div key={s.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-reveal group">
                            <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${getImpactColor(s.impact)}`}>{s.impact}</span>
                                <button onClick={() => setSuggestions(prev => prev.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-rose-500"><i className="fa-solid fa-times text-[10px]"></i></button>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="space-y-1">
                                    <p className="text-[7px] font-black text-slate-300 uppercase">{t('writing.polishingPanel.polished')}</p>
                                    <p className="text-[10.5px] font-medium text-slate-800 leading-relaxed italic bg-indigo-50/30 p-2 rounded-lg border border-indigo-50">"{s.polished}"</p>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-[7px] font-black text-slate-300 uppercase">{t('writing.polishingPanel.reasoning')}</p>
                                    <div className="flex flex-col gap-1">
                                        {s.reasoning.map((r, ri) => (
                                            <div key={ri} className="flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                                                <p className="text-[9px] text-slate-500 italic">{r}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        onApplyPolished(s.polished);
                                        setSuggestions(prev => prev.filter(x => x.id !== s.id));
                                    }}
                                    className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95"
                                >
                                    {t('writing.polishingPanel.applyAndUpdate')}
                                </button>
                            </div>
                        </div>
                    ))}

                    {suggestions.length === 0 && !internalLoading && (
                        <div className="py-10 text-center opacity-30 flex flex-col items-center gap-2">
                            <i className="fa-solid fa-wand-magic-sparkles text-2xl"></i>
                            <p className="text-[9px] font-black uppercase">{t('writing.polishingPanel.noSuggestions')}</p>
                        </div>
                    )}

                    {internalLoading && (
                        <div className="py-10 text-center animate-pulse flex flex-col items-center gap-3">
                            <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-xl"></i>
                            <p className="text-[9px] font-black text-indigo-400 uppercase">{t('writing.polishingPanel.analyzing')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PolishingPanel;
