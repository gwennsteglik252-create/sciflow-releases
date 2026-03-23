import React, { useState, useEffect, useRef } from 'react';

interface WorkspaceSaveModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}

const WorkspaceSaveModal: React.FC<WorkspaceSaveModalProps> = ({
  show, onClose, onSave, defaultName = ''
}) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setName(defaultName || `工作区存档 ${new Date().toLocaleDateString('zh-CN')}`);
      setTimeout(() => inputRef.current?.select(), 100);
    }
  }, [show, defaultName]);

  const handleSave = () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setTimeout(() => {
      onSave(name.trim());
      setIsSaving(false);
      onClose();
    }, 150);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[5100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl animate-reveal overflow-hidden border-2 border-indigo-100">
        {/* Header */}
        <header className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center gap-4">
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <i className="fa-solid fa-floppy-disk text-lg" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase italic tracking-tight">保存工作区</h3>
            <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">SAVE WORKSPACE SNAPSHOT</p>
          </div>
        </header>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">
              存档名称
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="输入工作区存档名称..."
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100/50 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
            <p className="text-[10px] text-indigo-400/80 font-bold leading-relaxed">
              <i className="fa-solid fa-circle-info mr-1.5" />
              将保存当前工作区的完整状态，包括所有工作表数据、图表配置和数据系列。可通过「工作区存档」随时恢复。
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-50 text-slate-500 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-floppy-disk" />}
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSaveModal;
