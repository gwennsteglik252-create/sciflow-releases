
import React, { useRef, useState } from 'react';
import { SUB_DIGITS, SUP_DIGITS, smartConvertChemistry } from '../../utils/scientificText';

interface SubFigure {
  id: string;
  label: string;
  desc: string;
}

interface CaptionOption {
  style: string;
  text: string;
}

interface CaptionTabProps {
  isCompositeMode: boolean;
  setIsCompositeMode: (val: boolean) => void;
  subFigures: SubFigure[];
  onAddSubFigure: () => void;
  onRemoveSubFigure: (index: number) => void;
  onSubFigureChange: (index: number, val: string) => void;
  onAutoDetect: () => void;
  isAnalyzingSub: boolean;
  captionOptions: CaptionOption[];
  selectedOptionIndex: number;
  onSelectOption: (idx: number) => void;
  generatedCaption: string;
  setGeneratedCaption: (val: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onQuickSave: () => void;
  onInsert: ((isFull: boolean) => void) | undefined;
  selectedMedia: any;
}

export const CaptionTab: React.FC<CaptionTabProps> = ({
  isCompositeMode, setIsCompositeMode, subFigures, onAddSubFigure, onRemoveSubFigure,
  onSubFigureChange, onAutoDetect, isAnalyzingSub, captionOptions, selectedOptionIndex,
  onSelectOption, generatedCaption, setGeneratedCaption, isGenerating, onGenerate,
  onQuickSave, onInsert, selectedMedia
}) => {
  const [subMode, setSubMode] = useState(false);
  const [symbolPanelOpen, setSymbolPanelOpen] = useState(false);
  const [subListOpen, setSubListOpen] = useState(true);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const savedCursor = useRef<number | null>(null);

  const saveCursor = () => {
    savedCursor.current = captionRef.current?.selectionStart ?? null;
  };

  const insertChar = (char: string) => {
    const input = captionRef.current;
    const cursorPos = savedCursor.current ?? generatedCaption.length;
    const newText = generatedCaption.substring(0, cursorPos) + char + generatedCaption.substring(cursorPos);
    setGeneratedCaption(newText);
    const newCursorPos = cursorPos + char.length;
    savedCursor.current = newCursorPos;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(newCursorPos, newCursorPos);
      });
    });
  };

  const handleSmartConvert = () => {
    setGeneratedCaption(smartConvertChemistry(generatedCaption));
  };

  const digitMap = subMode ? SUB_DIGITS : SUP_DIGITS;
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-'];

  const symbols = [
    { label: '°C', char: '°C' },
    { label: 'α', char: 'α' },
    { label: 'β', char: 'β' },
    { label: 'γ', char: 'γ' },
    { label: 'δ', char: 'δ' },
    { label: 'μ', char: 'μ' },
    { label: 'Δ', char: 'Δ' },
    { label: '±', char: '±' },
    { label: '→', char: '→' },
    { label: '·', char: '·' },
    { label: 'λ', char: 'λ' },
    { label: 'θ', char: 'θ' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex bg-slate-50 p-1 rounded-lg mb-3 border border-slate-100">
        <button
          onClick={() => setIsCompositeMode(false)}
          className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${!isCompositeMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
        >
          单图
        </button>
        <button
          onClick={() => setIsCompositeMode(true)}
          className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${isCompositeMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
        >
          组图模式
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
        {isCompositeMode && (
          <div className="bg-slate-50 border border-slate-100 rounded-xl shrink-0 overflow-hidden">
            <div
              onClick={() => setSubListOpen(!subListOpen)}
              className="w-full flex justify-between items-center px-3 py-2 hover:bg-slate-100/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <i className={`fa-solid fa-chevron-right text-[7px] text-slate-300 transition-transform ${subListOpen ? 'rotate-90' : ''}`}></i>
                <span className="text-[8px] font-black text-slate-400 uppercase">子图列表</span>
                {subFigures.length > 0 && <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded-full">{subFigures.length}</span>}
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button
                  onClick={onAutoDetect}
                  disabled={isAnalyzingSub || !selectedMedia}
                  className="text-[8px] font-bold text-indigo-500 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors flex items-center gap-1 border border-indigo-100 disabled:opacity-50"
                >
                  {isAnalyzingSub ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                  自动识别
                </button>
                <button onClick={onAddSubFigure} className="text-[8px] font-bold text-slate-500 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors border border-slate-200">+添加</button>
              </div>
            </div>
            {subListOpen && (
              <div className="px-3 pb-3 flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                {subFigures.map((fig, idx) => (
                  <div key={fig.id} className="flex gap-2 items-center animate-reveal">
                    <span className="text-[10px] font-black text-indigo-500 w-4 text-center">{fig.label}</span>
                    <input
                      className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[10px] outline-none focus:border-indigo-300"
                      placeholder={`描述(${fig.label})...`}
                      value={fig.desc}
                      onChange={(e) => onSubFigureChange(idx, e.target.value)}
                    />
                    <button onClick={() => onRemoveSubFigure(idx)} className="text-slate-300 hover:text-rose-500"><i className="fa-solid fa-times text-[10px]"></i></button>
                  </div>
                ))}
                {subFigures.length === 0 && (
                  <div className="text-center py-4 text-[9px] text-slate-400 italic border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-white hover:border-indigo-200 transition-all" onClick={onAddSubFigure}>
                    点击添加子图 (a, b...)
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
          {captionOptions.length > 0 ? (
            captionOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => onSelectOption(idx)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedOptionIndex === idx ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200 hover:text-slate-700'}`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${selectedOptionIndex === idx ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>{opt.style}</span>
                  {selectedOptionIndex === idx && <i className="fa-solid fa-check-circle text-indigo-600 text-[10px]"></i>}
                </div>
                <p className="text-[10px] font-medium leading-relaxed">{opt.text}</p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50 min-h-[100px]">
              <i className="fa-solid fa-wand-magic-sparkles text-2xl opacity-50"></i>
              <p className="text-[9px] font-bold uppercase">准备生成</p>
            </div>
          )}
        </div>

        {/* 最终修订 + 科学符号面板（向上展开） */}
        <div className="shrink-0 bg-slate-50 rounded-xl border border-slate-100 focus-within:ring-2 focus-within:ring-indigo-100 transition-all overflow-hidden">
          {/* 科学符号面板 - 向上展开，位于 textarea 上方 */}
          {symbolPanelOpen && (
            <div className="px-3 pt-2 pb-1 space-y-2 border-b border-slate-200/60 bg-white/60">
              {/* 上下标数字键盘 */}
              <div className="flex items-center gap-1.5">
                <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm shrink-0">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setSubMode(true); }}
                    className={`px-2 py-1 text-[9px] font-black transition-all ${subMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    A₂
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setSubMode(false); }}
                    className={`px-2 py-1 text-[9px] font-black transition-all ${!subMode ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    A²
                  </button>
                </div>
                <div className="flex gap-0.5 flex-wrap flex-1">
                  {digits.map(d => (
                    <button
                      key={d}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); insertChar(digitMap[d] || d); }}
                      className={`w-6 h-6 rounded-md text-[11px] font-black transition-all active:scale-90 shadow-sm border ${subMode
                        ? 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                        : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50'
                        }`}
                    >
                      {digitMap[d] || d}
                    </button>
                  ))}
                </div>
              </div>

              {/* 常用符号 */}
              <div className="flex items-center gap-0.5 flex-wrap">
                {symbols.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertChar(s.char); }}
                    className="h-6 min-w-[26px] px-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-95 shadow-sm"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[8px] font-black text-slate-400 uppercase">最终修订 (FINAL EDIT)</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSmartConvert(); }}
                  className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase shadow-sm hover:bg-black transition-all active:scale-95"
                  title="自动识别化学式并转换上下标"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-amber-300 text-[7px]"></i>
                  转换
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setSymbolPanelOpen(!symbolPanelOpen); }}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all active:scale-95 ${symbolPanelOpen ? 'bg-violet-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
                  title="科学符号面板"
                >
                  <i className="fa-solid fa-keyboard text-[7px]"></i>
                  符号
                </button>
              </div>
            </div>
            <textarea
              ref={captionRef}
              className="w-full bg-transparent text-[11px] text-slate-700 outline-none resize-none font-medium h-36 placeholder:text-slate-400 custom-scrollbar text-justify pr-2"
              placeholder="在此编辑图注内容..."
              value={generatedCaption}
              onChange={(e) => { setGeneratedCaption(e.target.value); savedCursor.current = e.target.selectionStart; }}
              onBlur={saveCursor}
              onSelect={saveCursor}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 shrink-0">
        <button
          onClick={onGenerate}
          disabled={!selectedMedia || isGenerating}
          className="w-full py-3 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
          AI 联合生成 (图注+解析)
        </button>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => {
              onQuickSave();
              alert('深度描述及图注已成功保存到图片，可在侧栏一键插入。');
            }}
            disabled={!selectedMedia}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-floppy-disk"></i> 保存信息
          </button>
        </div>
      </div>
    </div>
  );
};
