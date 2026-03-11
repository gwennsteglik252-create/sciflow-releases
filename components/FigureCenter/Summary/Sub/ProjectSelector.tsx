import React from 'react';
import { ResearchProject } from '../../../../types';

interface ProjectSelectorProps {
    projects: ResearchProject[];
    selectedProjectId: string;
    setSelectedProjectId: (id: string) => void;
    customTopic: string;
    setCustomTopic: (v: string) => void;
    useCustomTopic: boolean;
    setUseCustomTopic: (v: boolean) => void;
    onGenerate: () => void;
    onGenerateThumbnails: () => void;
    isGenerating: boolean;
    isGeneratingThumbnails: boolean;
    hasData: boolean;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
    projects, selectedProjectId, setSelectedProjectId, customTopic, setCustomTopic,
    useCustomTopic, setUseCustomTopic, onGenerate, onGenerateThumbnails,
    isGenerating, isGeneratingThumbnails, hasData
}) => (
    <div className="space-y-4">
        <div className="space-y-3.5 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-inner">
            <div className="flex justify-between items-center px-1">
                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">研究课题选择</label>
                <button onClick={() => setUseCustomTopic(!useCustomTopic)} className={`text-[7px] font-black uppercase transition-all px-2 py-0.5 rounded-full border ${useCustomTopic ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                    {useCustomTopic ? '切换为项目' : '输入自定义主题'}
                </button>
            </div>
            {useCustomTopic ? (
                <input className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-[11px] font-bold text-slate-700 outline-none italic shadow-sm" placeholder="输入研究关键词..." value={customTopic} onChange={e => setCustomTopic(e.target.value)} />
            ) : (
                <select className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer italic appearance-none shadow-sm" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
            )}
        </div>

        <button onClick={onGenerate} disabled={isGenerating || (useCustomTopic && !customTopic.trim())} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-lg hover:bg-indigo-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            {isGenerating ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} 启动 AI 自动建模
        </button>
        {hasData && (
            <button onClick={onGenerateThumbnails} disabled={isGeneratingThumbnails} className="w-full py-4 bg-gradient-to-r from-rose-500 to-amber-500 text-white rounded-2xl text-[11px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {isGeneratingThumbnails ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-paintbrush"></i>} 渲染 3D 视觉矩阵
            </button>
        )}
    </div>
);