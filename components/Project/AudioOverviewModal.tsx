
import React, { useState, useEffect, useRef } from 'react';
import { ResearchProject } from '../../types';
import { generatePodcastScript, generateAudioOverview } from '../../services/gemini/audio';

interface AudioOverviewModalProps {
  show: boolean;
  onClose: () => void;
  project: ResearchProject;
}

const AudioOverviewModal: React.FC<AudioOverviewModalProps> = ({ show, onClose, project }) => {
  const [status, setStatus] = useState<'idle' | 'scripting' | 'synthesizing' | 'ready' | 'playing' | 'error'>('idle');
  const [script, setScript] = useState('');
  const [pcmData, setPcmData] = useState<ArrayBuffer | null>(null);
  const [visualizerBars, setVisualizerBars] = useState<number[]>(new Array(20).fill(10));
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (show && status === 'idle' && !script) {
      startGeneration();
    }
    return () => {
        isMounted.current = false;
        stopAudio();
    };
  }, [show]);

  // Fake visualizer effect
  useEffect(() => {
    let interval: any;
    if (status === 'playing') {
      interval = setInterval(() => {
        setVisualizerBars(prev => prev.map(() => Math.random() * 40 + 10));
      }, 100);
    } else {
      setVisualizerBars(new Array(20).fill(5));
    }
    return () => clearInterval(interval);
  }, [status]);

  const stopAudio = () => {
      if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch(e) {}
          sourceRef.current.disconnect();
          sourceRef.current = null;
      }
      if (audioCtxRef.current) {
          audioCtxRef.current.close();
          audioCtxRef.current = null;
      }
      if (status === 'playing' && isMounted.current) setStatus('ready');
  };

  const startGeneration = async (forceRegenerateScript = false) => {
    if (status === 'scripting' || status === 'synthesizing' || status === 'playing') return;

    try {
      let currentScript = script;

      // 1. Generate Script (Text) if needed
      if (!currentScript || forceRegenerateScript) {
          setStatus('scripting');
          currentScript = await generatePodcastScript(project);
          if (!isMounted.current) return;
          setScript(currentScript);
      }

      // 2. Synthesize Audio
      if (currentScript) {
          setStatus('synthesizing');
          const base64Audio = await generateAudioOverview(currentScript);
          
          if (!isMounted.current) return;

          if (base64Audio) {
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            setPcmData(bytes.buffer);
            setStatus('ready');
          } else {
            console.error("No audio data returned");
            setStatus('error');
          }
      } else {
          setStatus('error');
      }
    } catch (e) {
      console.error(e);
      if (isMounted.current) setStatus('error');
    }
  };

  const handlePlay = async () => {
    if (!pcmData) return;
    
    try {
        // Cleanup previous context if any
        stopAudio();

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioCtxRef.current = audioCtx;
        
        // Create a copy of buffer because decodeAudioData/processing might detach it
        const bufferCopy = pcmData.slice(0);
        
        const dataView = new DataView(bufferCopy);
        const float32Data = new Float32Array(bufferCopy.byteLength / 2);
        for (let i = 0; i < float32Data.length; i++) {
            float32Data[i] = dataView.getInt16(i * 2, true) / 32768.0; // Little Endian
        }
        
        const audioBuffer = audioCtx.createBuffer(1, float32Data.length, 24000);
        audioBuffer.getChannelData(0).set(float32Data);
        
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => { if(isMounted.current) setStatus('ready'); };
        
        sourceRef.current = source;
        source.start();
        
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        setStatus('playing');
    } catch (err) {
        console.error("Audio playback error", err);
        setStatus('ready');
    }
  };

  const handleClickMainButton = () => {
      if (status === 'ready') {
          handlePlay();
      } else if (status === 'idle' || status === 'error') {
          // If script exists, try synthesizing again, otherwise regenerate everything
          startGeneration(false);
      } else if (status === 'playing') {
          stopAudio();
      }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[5000] flex items-center justify-center p-6">
      <div className="bg-black border border-slate-800 w-full max-w-md rounded-[3rem] p-8 relative flex flex-col items-center shadow-2xl overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-transparent pointer-events-none"></div>
        
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
            <i className="fa-solid fa-times text-xl"></i>
        </button>

        <div 
            onClick={handleClickMainButton}
            className={`w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(99,102,241,0.4)] relative z-10 transition-transform cursor-pointer hover:scale-105 active:scale-95`}
        >
            {status === 'playing' ? (
                 <i className="fa-solid fa-pause text-4xl text-white"></i>
            ) : status === 'synthesizing' || status === 'scripting' ? (
                 <i className="fa-solid fa-circle-notch animate-spin text-4xl text-white opacity-80"></i>
            ) : status === 'error' ? (
                 <i className="fa-solid fa-rotate-right text-4xl text-white"></i>
            ) : (
                 <i className="fa-solid fa-play text-4xl text-white pl-2"></i>
            )}
        </div>

        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2 relative z-10">AI 音频概览</h3>
        <p className={`text-xs font-bold uppercase tracking-wider mb-8 text-center relative z-10 ${status === 'error' ? 'text-rose-500' : 'text-slate-400'}`}>
            {status === 'scripting' && '正在生成对话脚本...'}
            {status === 'synthesizing' && '正在合成 AI 语音...'}
            {status === 'playing' && '正在播放: 深度科研播客'}
            {status === 'ready' && '音频就绪 - 点击播放'}
            {status === 'idle' && '点击开始生成'}
            {status === 'error' && '生成失败 - 点击重试'}
        </p>

        {/* Visualizer */}
        <div className="flex gap-1 h-12 items-center justify-center w-full mb-8 relative z-10">
            {visualizerBars.map((h, i) => (
                <div 
                    key={i} 
                    className={`w-1.5 rounded-full transition-all duration-100 ${status === 'error' ? 'bg-rose-900' : 'bg-indigo-500'}`}
                    style={{ height: `${h}px`, opacity: status === 'playing' ? 1 : 0.3 }}
                ></div>
            ))}
        </div>

        {script && (
            <div className="w-full bg-white/5 rounded-2xl p-4 h-48 overflow-y-auto custom-scrollbar border border-white/10 relative z-10">
                <p className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed opacity-80">
                    {script}
                </p>
            </div>
        )}
        
        {/* Warning Text */}
        {(status === 'scripting' || status === 'synthesizing') && (
           <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-none z-20">
               <span className="text-[9px] text-indigo-200/60 font-black tracking-wider uppercase animate-pulse">
                   当退出这个界面时任务就会停止
               </span>
           </div>
        )}

        <div className="mt-6 flex gap-4 w-full relative z-10">
             <button onClick={onClose} className="flex-1 py-3 bg-white/10 rounded-xl text-[10px] font-black uppercase text-white hover:bg-white/20 transition-all">
                关闭
             </button>
             {(status === 'ready' || status === 'error' || status === 'idle') && (
                 <button onClick={() => startGeneration(true)} className="flex-1 py-3 bg-indigo-600 rounded-xl text-[10px] font-black uppercase text-white hover:bg-indigo-500 transition-all shadow-lg">
                    重新生成
                 </button>
             )}
        </div>
      </div>
    </div>
  );
};

export default AudioOverviewModal;
