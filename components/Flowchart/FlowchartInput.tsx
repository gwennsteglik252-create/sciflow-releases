import React, { useRef } from 'react';

interface FlowchartInputProps {
  description: string;
  setDescription: (val: string) => void;
  scaleFactor: number;
  setScaleFactor: (val: number) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onUploadLiterature?: (file: File) => void;
  isUploading?: boolean;
  detailLevel: 'concise' | 'detailed';
  setDetailLevel: (val: 'concise' | 'detailed') => void;
}

export const FlowchartInput: React.FC<FlowchartInputProps> = ({
  description, setDescription, scaleFactor, setScaleFactor, isGenerating, onGenerate, onUploadLiterature, isUploading,
  detailLevel, setDetailLevel
}) => {
  const litInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadLiterature) {
      onUploadLiterature(file);
    }
    if (litInputRef.current) litInputRef.current.value = '';
  };

  return (
    <div className="w-80 lg:w-96 shrink-0 h-full flex flex-col gap-4 overflow-hidden no-print">
      <div className="bg-white/95 backdrop-blur-xl p-6 rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden shadow-2xl relative group">
        <div className="flex flex-col gap-4 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <i className="fa-solid fa-code text-base"></i>
            </div>
            <div className="flex flex-col">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">工艺输入描述</h4>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Raw Process Definition</p>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-2 px-1 px-1">
            <button
              onClick={() => litInputRef.current?.click()}
              disabled={isUploading || isGenerating}
              className="col-span-5 flex items-center justify-center gap-2 bg-white border border-slate-200 text-indigo-600 px-3 py-2.5 rounded-lg text-[9px] font-black uppercase shadow-sm hover:shadow-md hover:border-indigo-400 hover:text-indigo-700 transition-all active:scale-95 disabled:opacity-50 group/btn"
              title="上传科研文献以自动提取工艺流程"
            >
              {isUploading ? (
                <i className="fa-solid fa-circle-notch animate-spin text-xs"></i>
              ) : (
                <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center group-hover/btn:bg-indigo-600 group-hover/btn:text-white transition-colors">
                  <i className="fa-solid fa-file-arrow-up text-[10px]"></i>
                </div>
              )}
              文献导入
            </button>
            <input type="file" ref={litInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleFileChange} />

            <div className="col-span-4 flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/50 shadow-inner relative overflow-hidden">
              <div
                className={`absolute inset-y-1 transition-all duration-300 ease-out bg-white rounded-xl shadow-sm border border-slate-100`}
                style={{
                  left: detailLevel === 'concise' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)'
                }}
              />
              <button
                onClick={() => setDetailLevel('concise')}
                className={`relative z-10 flex-1 py-1.5 text-[9px] font-black uppercase transition-colors duration-300 ${detailLevel === 'concise' ? 'text-indigo-600' : 'text-slate-400'}`}
              >
                简明
              </button>
              <button
                onClick={() => setDetailLevel('detailed')}
                className={`relative z-10 flex-1 py-1.5 text-[9px] font-black uppercase transition-colors duration-300 ${detailLevel === 'detailed' ? 'text-indigo-600' : 'text-slate-400'}`}
              >
                详细
              </button>
            </div>

            <div className="col-span-3 flex items-center bg-white text-slate-800 rounded-lg border border-slate-200 shadow-sm overflow-hidden relative">
              <button
                onClick={() => setScaleFactor(Math.max(0.1, scaleFactor - 0.1))}
                className="w-full h-full flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-slate-100"
              >
                <i className="fa-solid fa-minus text-[7px] text-slate-400"></i>
              </button>
              <div className="flex flex-col items-center justify-center min-w-[32px] px-1 pointer-events-none border-x border-slate-100">
                <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-0.5">Scale</span>
                <span className="text-[10px] font-mono font-black text-indigo-600 leading-none">{scaleFactor.toFixed(1)}</span>
              </div>
              <button
                onClick={() => setScaleFactor(scaleFactor + 0.1)}
                className="w-full h-full flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-slate-100"
              >
                <i className="fa-solid fa-plus text-[7px] text-slate-400"></i>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full bg-slate-50/50 p-4 rounded-lg border border-slate-100 mb-4 shadow-inner relative flex flex-col">
          <textarea
            className="flex-1 w-full bg-transparent text-[11px] font-bold text-slate-700 outline-none resize-none custom-scrollbar italic leading-relaxed placeholder:text-slate-300 placeholder:not-italic"
            placeholder="在此输入实验流程描述，AI 将自动拆解步骤并审计物料流... 或者使用上方“文献导入”功能。"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="absolute bottom-3 right-3 text-indigo-200 pointer-events-none">
            <i className="fa-solid fa-feather-pointed"></i>
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={!description.trim() || isGenerating || isUploading}
          className={`w-full py-4 rounded-lg text-[10px] font-black shadow-xl uppercase tracking-[0.1rem] flex items-center justify-center gap-2 transition-all group ${isGenerating
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-indigo-600 active:scale-[0.98]'
            }`}
        >
          {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles group-hover:rotate-12 transition-transform"></i>}
          {isGenerating ? '正在数字化建模...' : 'AI 工艺建模'}
        </button>
      </div>
    </div>
  );
};