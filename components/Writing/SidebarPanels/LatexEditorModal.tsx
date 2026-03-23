
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProjectLatexSnippet } from '../../../types';
import katex from 'katex';
import { FAST_MODEL, SPEED_CONFIG, callGeminiWithRetry } from '../../../services/gemini/core';
import { useTranslation } from '../../../locales/useTranslation';

interface LatexEditorModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (snippet: ProjectLatexSnippet) => void;
  initialSnippet: ProjectLatexSnippet | null;
};

export const LatexEditorModal: React.FC<LatexEditorModalProps> = ({ show, onClose, onSave, initialSnippet }) => {
  const { t } = useTranslation();
  const SNIPPETS = {
    math: [
      { label: t('writing.latexEditor.fraction'), code: '\\frac{a}{b}' },
      { label: t('writing.latexEditor.superscript'), code: 'x^{n}' },
      { label: t('writing.latexEditor.subscript'), code: 'x_{i}' },
      { label: t('writing.latexEditor.integral'), code: '\\int_{a}^{b} f(x)dx' },
      { label: 'Arrhenius', code: 'k = A e^{-\\frac{E_a}{RT}}' },
      { label: 'Butler-Volmer', code: 'j = j_0 \\{ \\exp [\\frac{\\alpha_a n F \\eta}{RT}] - \\exp [-\\frac{\\alpha_c n F \\eta}{RT}] \\}' }
    ],
    chem: [
      { label: t('writing.latexEditor.reactionArrow'), code: '\\rightarrow' },
      { label: t('writing.latexEditor.reversibleSymbol'), code: '\\rightleftharpoons' },
      { label: t('writing.latexEditor.gasGeneration'), code: '\\uparrow' },
      { label: t('writing.latexEditor.precipitate'), code: '\\downarrow' },
      { label: 'OER', code: '4OH^- \\rightarrow O_2 + 2H_2O + 4e^-' },
      { label: 'HER', code: '2H^+ + 2e^- \\rightarrow H_2' }
    ]
  };
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'math' | 'chem'>('math');
  const [isBlock, setIsBlock] = useState(true);

  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      if (initialSnippet) {
        setTitle(initialSnippet.title);
        setContent(initialSnippet.content);
        setType(initialSnippet.type);
        setIsBlock(initialSnippet.isBlock ?? true);
      } else {
        setTitle('');
        setContent('');
        setType('math');
        setIsBlock(true);
      }
    }
  }, [show, initialSnippet]);

  const insertCode = (code: string) => {
    if (!editorRef.current) return;
    const start = editorRef.current.selectionStart;
    const end = editorRef.current.selectionEnd;
    const newContent = content.substring(0, start) + code + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(start + code.length, start + code.length);
    }, 0);
  };

  const handleAiPrompt = async () => {
    if (!aiInput.trim() || isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const response: any = await callGeminiWithRetry(ai => ai.models.generateContent({
        model: FAST_MODEL,
        contents: `你是一名 LaTeX 科学绘图助手。请将用户的描述转换为标准的 LaTeX 代码。要求：
        1. 仅输出代码内容，严禁包含任何 Markdown 代码块标签、解释 or 前缀。
        2. 如果描述是化学反应，请使用 \\rightarrow 等标准符号。
        3. 如果描述是数学公式，确保语法正确。
        
        用户描述: "${aiInput}"`,
        config: { ...SPEED_CONFIG, temperature: 0.1 }
      }));

      console.log("[LaTeX AI] Full response:", JSON.stringify(response, null, 2));
      console.log("[LaTeX AI] response.text:", response.text);
      const generatedCode = response.text?.trim() || "";
      console.log("[LaTeX AI] generatedCode:", generatedCode);
      if (generatedCode) {
        insertCode(generatedCode);
        setAiInput('');
      } else {
        console.warn("[LaTeX AI] No content generated from response");
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleImageOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRecognizing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const response: any = await callGeminiWithRetry(ai => ai.models.generateContent({
        model: FAST_MODEL,
        contents: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: "请识别并提取图片中的数学公式或化学反应方程式，将其转换为标准的 LaTeX 代码。只需输出代码本身，不要包含任何解释性文字或 Markdown 代码块标识。如果是多行公式，请使用标准的 LaTeX 换行符 \\\\ 连接。"
          }
        ],
        config: SPEED_CONFIG
      }));

      const recognizedText = response.text || "";
      if (recognizedText) {
        setContent(prev => prev ? prev + "\n" + recognizedText : recognizedText);
        // 启发式判断类型
        if (recognizedText.includes('\\rightarrow') || recognizedText.includes('\\rightleftharpoons') || recognizedText.includes('OH^-')) {
          setType('chem');
        }
      }
    } catch (error) {
      console.error("OCR failed:", error);
      alert(t('writing.latexEditor.ocrFailed'));
    } finally {
      setIsRecognizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    if (typeof onSave !== 'function') {
      console.error("onSave is not a function", onSave);
      return;
    }
    onSave({
      id: initialSnippet?.id || Date.now().toString(),
      title: title || t('writing.latexEditor.untitled'),
      content,
      type,
      isBlock,
      timestamp: new Date().toLocaleString()
    });
    onClose();
  };

  const renderPreview = () => {
    try {
      return katex.renderToString(content || `\\text{${t('writing.latexEditor.waitingInput')}}`, {
        displayMode: isBlock,
        throwOnError: false
      });
    } catch (e) {
      return `<span class="text-rose-500">${t('writing.latexEditor.syntaxError')}</span>`;
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] p-0 animate-reveal shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-square-root-variable"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic">{t('writing.latexEditor.title')}</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Scientific Formula Processor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageOCR}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecognizing}
              className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-indigo-50 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isRecognizing ? (
                <><i className="fa-solid fa-circle-notch animate-spin"></i> {t('writing.latexEditor.recognizing')}</>
              ) : (
                <><i className="fa-solid fa-camera"></i> {t('writing.latexEditor.smartOCR')}</>
              )}
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-200 text-slate-500 hover:bg-rose-500 hover:text-white transition-all">
              <i className="fa-solid fa-times"></i>
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-row min-h-0">
          {/* Left: Snippets Library */}
          <div className="w-56 bg-slate-50 border-r border-slate-100 p-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0">
            <section>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('writing.latexEditor.mathSymbols')}</p>
              <div className="grid grid-cols-1 gap-2">
                {SNIPPETS.math.map(s => (
                  <button key={s.label} onClick={() => insertCode(s.code)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all text-left">
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('writing.latexEditor.chemComponents')}</p>
              <div className="grid grid-cols-1 gap-2">
                {SNIPPETS.chem.map(s => (
                  <button key={s.label} onClick={() => insertCode(s.code)} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600 transition-all text-left">
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Middle: Editor */}
          <div className="flex-1 flex flex-col p-6 gap-4 bg-white min-w-0">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 px-1">{t('writing.latexEditor.snippetTitle')}</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder={t('writing.latexEditor.snippetPlaceholder')}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
            </div>

            {/* AI Prompt Input Bar */}
            <div className="relative">
              <div className="relative flex items-center gap-2 bg-white rounded-2xl p-2 border border-slate-200 overflow-hidden">
                <input
                  className="flex-1 bg-transparent border-none text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400 py-2 pl-4"
                  placeholder={t('writing.latexEditor.aiPlaceholder')}
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiPrompt()}
                />
                <button
                  onClick={handleAiPrompt}
                  disabled={isAiGenerating || !aiInput.trim()}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all active:scale-95 disabled:opacity-30 shrink-0"
                >
                  {isAiGenerating ? t('writing.latexEditor.aiGenerating') : t('writing.latexEditor.aiGenerate')}
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 mt-2">
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase block">{t('writing.latexEditor.codeEditor')}</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className={`text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${showHelp ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
                  >
                    <i className="fa-solid fa-circle-question"></i>
                    {t('writing.latexEditor.helpRef')}
                  </button>

                  {showHelp && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-reveal overflow-hidden flex flex-col">
                      <div className="flex justify-between items-center mb-3 shrink-0">
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{t('writing.latexEditor.helpTitle')}</span>
                        <button onClick={() => setShowHelp(false)} className="text-slate-300 hover:text-rose-500 transition-colors"><i className="fa-solid fa-times text-[10px]"></i></button>
                      </div>
                      <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        <section>
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-2">{t('writing.latexEditor.helpMathBasics')}</p>
                          <div className="grid grid-cols-1 gap-1.5">
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpFraction')}</span> {"\\frac{a}{b}"}</div>
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpRadical')}</span> {"\\sqrt{x}"}</div>
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpSubSup')}</span> {"x^{n}_{i}"}</div>
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpGreek')}</span> {"\\alpha, \\beta, \\gamma, \\Delta"}</div>
                          </div>
                        </section>
                        <section>
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-2">{t('writing.latexEditor.helpChemEquation')}</p>
                          <div className="grid grid-cols-1 gap-1.5">
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpCharge')}</span> {"OH^{-}"}</div>
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpArrow')}</span> {"\\rightarrow, \\rightleftharpoons"}</div>
                            <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg text-[9px] font-mono"><span className="text-slate-400">{t('writing.latexEditor.helpState')}</span> {"\\uparrow, \\downarrow"}</div>
                          </div>
                        </section>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-100 text-center">
                        <p className="text-[8px] text-slate-400 italic">{t('writing.latexEditor.helpTip')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <textarea
                ref={editorRef}
                className="flex-1 w-full bg-slate-900 text-indigo-300 p-6 rounded-2xl font-mono text-sm outline-none resize-none shadow-inner leading-relaxed"
                placeholder={t('writing.latexEditor.editorPlaceholder')}
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase">{t('writing.latexEditor.mode')}</span>
                <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                  <button onClick={() => setType('math')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${type === 'math' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{t('writing.latexEditor.math')}</button>
                  <button onClick={() => setType('chem')} className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${type === 'chem' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>{t('writing.latexEditor.chem')}</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase">{t('writing.latexEditor.layout')}</span>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div onClick={() => setIsBlock(!isBlock)} className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isBlock ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isBlock ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-600 group-hover:text-indigo-600">{t('writing.latexEditor.blockMode')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="w-96 bg-slate-50 border-l border-slate-100 flex flex-col overflow-hidden shrink-0">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('writing.latexEditor.livePreview')}</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-white/50 relative">
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
              <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-100 max-w-full overflow-x-auto" dangerouslySetInnerHTML={{ __html: renderPreview() }} />
            </div>
          </div>
        </div>

        <footer className="p-6 border-t border-slate-100 flex gap-4 bg-white shrink-0">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">{t('writing.latexEditor.cancel')}</button>
          <button onClick={handleSave} disabled={!content.trim()} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50">{t('writing.latexEditor.saveToProject')}</button>
        </footer>
      </div>
    </div>,
    document.body
  );
};
