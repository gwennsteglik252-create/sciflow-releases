import React, { useState } from 'react';

interface BibTeXModalProps {
  onClose: () => void;
  onImport: (raw: string) => Promise<void> | void;
  isParsing: boolean;
}

const BibTeXModal: React.FC<BibTeXModalProps> = ({ onClose, onImport, isParsing }) => {
  const [bibText, setBibText] = useState('');

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
        
        <header className="mb-6 shrink-0">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">引文批量同步引擎</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-8">Sync from Zotero, EndNote or Mendeley (BibTeX Format)</p>
        </header>

        <div className="flex-1 flex flex-col gap-4">
            <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed italic">
                <i className="fa-solid fa-circle-info mr-2"></i>
                请从您的引文管理器中导出并粘贴 <b>BibTeX</b> 代码。AI 将自动识别题录信息、作者、年份及 DOI，并为您完成入库。
            </div>

            <textarea 
                autoFocus
                className="flex-1 w-full bg-slate-900 text-indigo-300 p-6 rounded-[2rem] font-mono text-[11px] outline-none border-4 border-slate-800 focus:border-indigo-500 transition-all shadow-inner resize-none custom-scrollbar"
                placeholder={`@article{AuthorYear,
  title = {Paper Title},
  author = {Lastname, Firstname and Others},
  journal = {Science},
  year = {2024},
  doi = {10.1038/...}
}`}
                value={bibText}
                onChange={e => setBibText(e.target.value)}
            />
        </div>

        <footer className="mt-8 flex gap-4 shrink-0">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all">取消</button>
          <button 
            onClick={() => onImport(bibText)} 
            disabled={isParsing || !bibText.trim()}
            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isParsing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-sync"></i>}
            {isParsing ? '正在解析引文网络...' : '立即同步至项目档案'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default BibTeXModal;