
import React from 'react';
import { ExperimentFile } from '../../../types';

interface LogFilesProps {
    fileDescInput: string;
    setFileDescInput: (val: string) => void;
    triggerFileSelection: () => void;
    logFileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    logFiles: ExperimentFile[];
    removeFile: (idx: number) => void;
    handleLinkExistingLocalFile: (idx: number) => void;
    updateFile: (idx: number, updates: Partial<ExperimentFile>) => void;
}

export const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return { icon: 'fa-file-image', color: 'text-indigo-500', bg: 'bg-indigo-50' };
    if (['pdf'].includes(ext || '')) return { icon: 'fa-file-pdf', color: 'text-rose-500', bg: 'bg-rose-50' };
    if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext || '')) return { icon: 'fa-file-word', color: 'text-blue-500', bg: 'bg-blue-50' };
    if (['csv', 'xls', 'xlsx', 'json'].includes(ext || '')) return { icon: 'fa-file-csv', color: 'text-emerald-500', bg: 'bg-emerald-50' };
    if (['py', 'r', 'js', 'ts', 'cpp', 'h', 'ipynb'].includes(ext || '')) return { icon: 'fa-file-code', color: 'text-amber-500', bg: 'bg-amber-50' };
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return { icon: 'fa-file-video', color: 'text-purple-500', bg: 'bg-purple-50' };
    if (['mp3', 'wav', 'flac'].includes(ext || '')) return { icon: 'fa-file-audio', color: 'text-fuchsia-500', bg: 'bg-fuchsia-50' };
    return { icon: 'fa-file', color: 'text-slate-400', bg: 'bg-slate-50' };
};

export const LogFiles: React.FC<LogFilesProps> = ({
    fileDescInput, setFileDescInput, triggerFileSelection, logFileInputRef, handleFileUpload,
    logFiles, removeFile, handleLinkExistingLocalFile, updateFile
}) => {
    return (
        <div className="border-t border-slate-100 pt-4">
            <label className="text-xs font-black text-slate-950 uppercase mb-2 block px-1">上传文件及原始数据</label>
            <div className="flex gap-2 mb-3">
                <input className="flex-1 bg-slate-50 border-none rounded-xl p-3.5 text-xs font-bold outline-none shadow-inner" placeholder="默认文件描述..." value={fileDescInput} onChange={e => setFileDescInput(e.target.value)} />
                <button onClick={triggerFileSelection} className="px-4 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase shadow-xl shrink-0 active:scale-95 hover:bg-indigo-600 transition-colors"><i className="fa-solid fa-upload"></i></button>
                <input
                    type="file"
                    ref={logFileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.json,.py,.r,.md,.mp4,.mov,.mp3,.wav"
                />
            </div>
            <div className="space-y-2">
                {logFiles.map((file, idx) => {
                    const { icon, color, bg } = getFileIcon(file.name);
                    return (
                        <div key={idx} className={`flex flex-col ${bg} p-3 rounded-xl border border-slate-100 group hover:border-indigo-100 transition-colors relative shadow-sm`}>
                            <div className="flex items-start gap-3 min-w-0">
                                <i className={`fa-solid ${icon} ${color} shrink-0 text-base mt-1`}></i>
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <input
                                        className="w-full bg-transparent border-none text-[11px] font-black text-slate-700 uppercase outline-none focus:bg-white focus:ring-1 focus:ring-indigo-100 rounded px-2 py-1"
                                        value={file.name}
                                        onChange={(e) => updateFile(idx, { name: e.target.value })}
                                        placeholder="文件名"
                                    />
                                    <input
                                        className="w-full bg-transparent border-none text-[10px] text-slate-400 italic outline-none focus:bg-white focus:ring-1 focus:ring-indigo-100 rounded px-2 py-1"
                                        value={file.description || ''}
                                        onChange={(e) => updateFile(idx, { description: e.target.value })}
                                        placeholder="添加文件描述..."
                                    />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {file.localPath && <span className="text-emerald-600 text-[10px] font-black uppercase"><i className="fa-solid fa-link"></i> Linked</span>}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!file.localPath && (
                                            <button onClick={(e) => { e.stopPropagation(); handleLinkExistingLocalFile(idx); }} className="text-slate-400 hover:text-indigo-600 p-1" title="关联本地">
                                                <i className="fa-solid fa-link text-xs"></i>
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="text-rose-400 hover:text-rose-600 p-1">
                                            <i className="fa-solid fa-trash-can text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {logFiles.length === 0 && <p className="text-[11px] text-slate-300 italic text-center py-4">未上传附件</p>}
            </div>
        </div>
    );
};
