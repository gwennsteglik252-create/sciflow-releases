
import React, { useState, useRef, useEffect } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { generateScientificVideo } from '../../services/gemini/video';
import { VideoItem } from '../../types';

const LOADING_MESSAGES = [
    "Initializing neural fluid dynamics simulation...",
    "Synthesizing high-fidelity molecular interactions...",
    "Compiling scientific visualization frames...",
    "Optimizing tensor flow for temporal consistency...",
    "Finalizing cinematic render of research pathways...",
    "Applying kinetic constraints to physical model...",
    "Calibrating lighting for peak academic impact..."
];

const VideoLab: React.FC = () => {
    const { activeTheme, startGlobalTask, showToast, isKeySelected, setIsKeySelected } = useProjectContext();
    const isLight = activeTheme.type === 'light';

    const [prompt, setPrompt] = useState('');
    const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [refImage, setRefImage] = useState<{data: string, mimeType: string} | null>(null);
    const [videos, setVideos] = useState<VideoItem[]>(() => {
        const saved = localStorage.getItem('sciflow_video_lab_history');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        localStorage.setItem('sciflow_video_lab_history', JSON.stringify(videos));
    }, [videos]);

    useEffect(() => {
        let interval: any;
        if (activeVideoId && videos.find(v => v.id === activeVideoId)?.status === 'processing') {
            interval = setInterval(() => {
                setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
            }, 4000);
        }
        return () => clearInterval(interval);
    }, [activeVideoId, videos]);

    const checkKey = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsKeySelected(hasKey);
            return hasKey;
        }
        return true;
    };

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setIsKeySelected(true); // Assume success as per guidelines
        }
    };

    const handleGenerate = async () => {
        const hasKey = await checkKey();
        if (!hasKey) {
            showToast({ message: "请先选择有效的 API Key 以使用视频生成功能", type: 'info' });
            return;
        }

        if (!prompt.trim()) return;

        const videoId = Date.now().toString();
        const newVideo: VideoItem = {
            id: videoId,
            title: prompt.substring(0, 20) + '...',
            url: '',
            prompt,
            timestamp: new Date().toLocaleString(),
            status: 'processing',
            metadata: { resolution, aspectRatio }
        };

        setVideos([newVideo, ...videos]);
        setActiveVideoId(videoId);

        await startGlobalTask(
            { id: 'video_gen_task', type: 'video_gen', status: 'running', title: '渲染科研动画中...' },
            async () => {
                try {
                    const videoUrl = await generateScientificVideo(prompt, { resolution, aspectRatio }, refImage || undefined);
                    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, url: videoUrl, status: 'ready' } : v));
                    showToast({ message: "科研视频渲染完成", type: 'success' });
                } catch (e: any) {
                    console.error("Video generation error:", e);
                    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'error' } : v));
                    if (e?.message?.includes("Requested entity was not found")) {
                        setIsKeySelected(false);
                    }
                    showToast({ message: "渲染失败，请检查 API 状态", type: 'error' });
                }
            }
        );
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = (event.target?.result as string).split(',')[1];
                setRefImage({ data: base64, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        }
    };

    const activeVideo = videos.find(v => v.id === activeVideoId);

    if (isKeySelected === false) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-reveal">
                <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                    <i className="fa-solid fa-key text-4xl"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase italic mb-4">需要选择 API KEY</h3>
                <p className="max-w-md text-slate-500 mb-8 leading-relaxed">
                    Veo 视频生成模型属于付费项目。请选择一个来自有效结算项目的 API Key。<br/>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-600 font-bold hover:underline">查看账单说明</a>
                </p>
                <button 
                    onClick={handleSelectKey}
                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-3"
                >
                    <i className="fa-solid fa-passport"></i> 选择 API KEY
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 animate-reveal overflow-hidden px-4 py-2">
            <header className="flex justify-between items-center bg-slate-900 px-5 py-3 rounded-2xl border border-white/5 shrink-0 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <i className="fa-solid fa-film text-lg"></i>
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white italic uppercase tracking-tight leading-none">视频工坊</h2>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2rem] mt-1">SciFlow Motion Engine v1.0</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => { setVideos([]); setActiveVideoId(null); }}
                        className="px-4 py-2 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-trash-can"></i> 清除历史
                    </button>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
                {/* Sidebar Controls */}
                <aside className="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                        <section className="space-y-4">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-sliders text-indigo-500"></i> 生成配置
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 px-1">分辨率</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button onClick={() => setResolution('720p')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${resolution === '720p' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>720p</button>
                                        <button onClick={() => setResolution('1080p')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${resolution === '1080p' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>1080p</button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 px-1">画幅比例</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${aspectRatio === '16:9' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>16:9</button>
                                        <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${aspectRatio === '9:16' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>9:16</button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-image text-emerald-500"></i> 起始帧图片 (可选)
                            </h4>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${refImage ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-emerald-300'}`}
                            >
                                {refImage ? (
                                    <img src={`data:${refImage.mimeType};base64,${refImage.data}`} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center text-slate-400">
                                        <i className="fa-solid fa-plus text-xl mb-1"></i>
                                        <p className="text-[8px] font-black uppercase">上传底图</p>
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-feather text-rose-500"></i> 动态描述 (Prompt)
                            </h4>
                            <textarea 
                                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] font-bold text-slate-700 outline-none shadow-inner resize-none leading-relaxed focus:ring-4 focus:ring-indigo-100 transition-all italic"
                                placeholder="描述一个科学场景，例如：'A futuristic laboratory rendering of graphene synthesis process with vibrant blue plasma and microscopic details'..."
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                            />
                        </section>

                        <button 
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || activeVideo?.status === 'processing'}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {activeVideo?.status === 'processing' ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-film"></i>}
                            渲染科研视频
                        </button>
                    </div>

                    <div className="flex-1 bg-white/40 rounded-[2.5rem] border border-slate-200 shadow-sm p-4 overflow-y-auto custom-scrollbar">
                         <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">历史渲染队列</h5>
                         <div className="space-y-2">
                             {videos.map(v => (
                                 <div 
                                    key={v.id} 
                                    onClick={() => setActiveVideoId(v.id)}
                                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${activeVideoId === v.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-600'}`}
                                 >
                                     <div className="flex justify-between items-center mb-1">
                                         <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${activeVideoId === v.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>{v.metadata.resolution}</span>
                                         <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'ready' ? 'bg-emerald-400' : v.status === 'processing' ? 'bg-amber-400 animate-pulse' : 'bg-rose-400'}`}></span>
                                     </div>
                                     <p className="text-[10px] font-bold truncate italic leading-none">{v.title}</p>
                                 </div>
                             ))}
                             {videos.length === 0 && <p className="text-center py-10 text-[9px] text-slate-400 italic">队列为空</p>}
                         </div>
                    </div>
                </aside>

                {/* Main Viewport */}
                <main className="col-span-12 lg:col-span-9 flex flex-col gap-4 min-h-0">
                    <div className="flex-1 bg-slate-900 rounded-[3rem] shadow-2xl relative overflow-hidden flex items-center justify-center p-8 group">
                         {activeVideo?.status === 'ready' ? (
                             <video 
                                src={activeVideo.url} 
                                controls 
                                loop 
                                className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10"
                             />
                         ) : activeVideo?.status === 'processing' ? (
                             <div className="flex flex-col items-center text-center">
                                 <div className="relative mb-8">
                                     <div className="w-32 h-32 rounded-full border-4 border-indigo-500/20 flex items-center justify-center">
                                         <div className="w-24 h-24 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                                     </div>
                                     <div className="absolute inset-0 flex items-center justify-center">
                                         <i className="fa-solid fa-microchip text-indigo-500 text-2xl animate-pulse"></i>
                                     </div>
                                 </div>
                                 <h4 className="text-white text-xl font-black uppercase italic tracking-widest mb-2">正在建模视觉张量...</h4>
                                 <p className="text-indigo-400 text-sm font-mono animate-reveal" key={loadingMsgIdx}>{LOADING_MESSAGES[loadingMsgIdx]}</p>
                                 <div className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-[0.3rem]">
                                     Estimated time: 2-3 minutes
                                 </div>
                             </div>
                         ) : activeVideo?.status === 'error' ? (
                             <div className="text-center text-rose-500">
                                 <i className="fa-solid fa-circle-exclamation text-5xl mb-4"></i>
                                 <h4 className="text-xl font-black uppercase italic">渲染中断</h4>
                                 <p className="text-sm opacity-70">AI 核心响应异常，请尝试更换 API Key 或调整描述。</p>
                             </div>
                         ) : (
                             <div className="text-center opacity-20 text-white">
                                 <i className="fa-solid fa-film text-7xl mb-6"></i>
                                 <h4 className="text-2xl font-black uppercase tracking-[0.5rem] italic">MOTION STUDIO</h4>
                                 <p className="text-sm mt-2">请输入描述以启动视觉动力学模拟</p>
                             </div>
                         )}

                         {/* Overlay Meta */}
                         {activeVideo?.status === 'ready' && (
                             <div className="absolute bottom-10 left-10 right-10 bg-black/60 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] shadow-2xl animate-reveal opacity-0 group-hover:opacity-100 transition-opacity">
                                 <div className="flex justify-between items-start">
                                     <div className="flex-1 min-w-0 pr-10">
                                         <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 tracking-widest">Research Visualization Target</p>
                                         <h4 className="text-lg font-black text-white italic truncate">{activeVideo.prompt}</h4>
                                     </div>
                                     <div className="flex gap-3">
                                         <a 
                                            href={activeVideo.url} 
                                            download={`SciFlow_Visual_${activeVideo.id}.mp4`}
                                            className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-black transition-all"
                                         >
                                             <i className="fa-solid fa-download"></i>
                                         </a>
                                     </div>
                                 </div>
                             </div>
                         )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default VideoLab;
