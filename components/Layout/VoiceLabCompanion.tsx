import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { useAiCommandExecutor } from '../../hooks/useAiCommandExecutor';
import { useTranslation } from '../../locales/useTranslation';

export const VoiceLabCompanion: React.FC = () => {
    const { t } = useTranslation();
    const { isVoiceMode, setIsVoiceMode, showToast } = useProjectContext();
    const { processCommand } = useAiCommandExecutor();
    
    const COMMANDS = [
        { cmd: "Start Timer", action: t('voice.waiting') }, 
        { cmd: "Log Data", action: "记录：pH值 7.4" },
        { cmd: "Next Step", action: "标记步骤 3 完成" },
        { cmd: "Check Stock", action: "查询：乙醇库存" },
        { cmd: "Emergency", action: "紧急呼叫安全员" }
    ];

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [lastAction, setLastAction] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const dataArrayRef = useRef<Uint8Array | null>(null);

    // Timer State
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    useEffect(() => {
        let interval: any;
        if (isTimerRunning && timer > 0) {
            interval = setInterval(() => setTimer(prev => prev - 1), 1000);
        } else if (timer === 0 && isTimerRunning) {
            setIsTimerRunning(false);
            showToast({ message: t('voice.timerEnded'), type: 'info' });
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timer, showToast, t]);

    // Real Audio Visualizer Setup
    useEffect(() => {
        if (!isVoiceMode) return;

        const startAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioContextClass();
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 64;
                source.connect(analyser);

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                audioContextRef.current = audioCtx;
                analyserRef.current = analyser;
                dataArrayRef.current = dataArray;
            } catch (err) {
                console.error('Microphone access denied', err);
            }
        };

        startAudio();

        return () => {
            audioContextRef.current?.close();
        };
    }, [isVoiceMode]);

    // Animation Loop for Visualizer
    useEffect(() => {
        let animationFrame: number;

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas || !analyserRef.current || !dataArrayRef.current) {
                animationFrame = requestAnimationFrame(draw);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            analyserRef.current.getByteFrequencyData(dataArrayRef.current as any);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / dataArrayRef.current.length) * 2.5;
            let x = 0;

            const centerY = canvas.height / 2;

            for (let i = 0; i < dataArrayRef.current.length; i++) {
                const barHeight = (dataArrayRef.current[i] / 255) * canvas.height * 0.8;

                const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
                gradient.addColorStop(0, 'rgba(99, 102, 241, 0)');
                gradient.addColorStop(0.5, isListening ? '#f43f5e' : '#6366f1');
                gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);

                x += barWidth + 2;
            }

            animationFrame = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationFrame);
    }, [isListening]);

    const handleVoiceCommand = useCallback(async (text: string) => {
        setTranscript(text);
        setInterimTranscript('');

        // 1. Basic Local Commands
        if (text.toLowerCase().includes("计时") || text.toLowerCase().includes("timer")) {
            // Extract numbers if present, else default 30m
            const match = text.match(/\d+/);
            const mins = match ? parseInt(match[0]) : 30;
            setTimer(mins * 60);
            setIsTimerRunning(true);
            setLastAction(t('voice.timerStarted', { mins }));
            return;
        }

        // 2. Dispatch to AI CLI Executor
        try {
            const { message } = await processCommand(text);
            setLastAction(message);
        } catch (e: any) {
            console.error('Voice execution error', e);
            setLastAction(t('voice.failed', { message: e.message }));
        }
    }, [processCommand, t]);

    useEffect(() => {
        if (!isVoiceMode) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast({ message: t('voice.notSupported'), type: 'error' });
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const final = event.results[i][0].transcript.toLowerCase().trim();

                    const wakeWords = ["hey sciflow", "嘿 sciflow", "嘿sciflow", "开机", "启动"]; 
                    const foundWakeWord = wakeWords.find(w => final.includes(w));

                    if (foundWakeWord) {
                        const command = final.split(foundWakeWord).pop()?.trim();
                        if (command) {
                            handleVoiceCommand(command);
                        } else {
                            setTranscript(t('voice.iamHere'));
                        }
                    }
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            if (event.error !== 'no-speech') {
                setIsListening(false);
                showToast({ message: t('voice.error', { error: event.error }), type: 'error' });
            }
        };

        recognitionRef.current = recognition;
        recognition.start();

        return () => {
            recognition.stop();
        };
    }, [isVoiceMode, handleVoiceCommand, showToast, t]);

    const toggleListening = () => {
        if (!isListening) {
            recognitionRef.current?.start();
        } else {
            recognitionRef.current?.stop();
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (!isVoiceMode) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/95 z-[9000] flex flex-col items-center justify-center p-8 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
            <button
                onClick={() => setIsVoiceMode(false)}
                className="absolute top-8 left-8 w-16 h-16 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-2xl border-2 border-white/10"
            >
                <i className="fa-solid fa-times text-2xl"></i>
            </button>

            <div className="w-full max-w-4xl flex flex-col items-center gap-10">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-3 bg-indigo-500/20 px-6 py-2 rounded-full border border-indigo-500/50 mb-4">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_#6366f1]"></div>
                        <span className="text-indigo-300 font-black uppercase tracking-widest text-xs">Hands-Free Lab Mode</span>
                    </div>
                    <h2 className="text-5xl font-black text-white uppercase italic tracking-tighter">{t('voice.title')}</h2>
                    <p className="text-slate-400 font-bold text-lg max-w-xl mx-auto">{t('voice.subtitle')}</p>
                </div>

                <div className="w-full bg-black/40 rounded-[3rem] border border-white/10 p-10 flex flex-col items-center gap-8 relative overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

                    <div className="w-full h-32 flex items-center justify-center relative">
                        <canvas ref={canvasRef} width={600} height={128} className="w-full h-full object-contain" />
                    </div>

                    <div className="text-center space-y-4 relative z-10">
                        <p className={`text-4xl font-bold transition-all ${transcript || interimTranscript ? 'text-white' : 'text-slate-600'}`}>
                            "{transcript || interimTranscript || t('voice.waiting')}"
                        </p>
                        {lastAction && (
                            <div className="inline-block bg-emerald-500/20 text-emerald-400 px-6 py-2 rounded-xl border border-emerald-500/30 font-black uppercase tracking-wider text-sm animate-reveal">
                                <i className="fa-solid fa-check mr-2"></i> {lastAction}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={toggleListening}
                        className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl shadow-[0_0_50px_rgba(99,102,241,0.3)] transition-all transform hover:scale-110 active:scale-95 ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                    >
                        <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'}`}></i>
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
                    <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-3 text-center group hover:bg-indigo-600/20 hover:border-indigo-500/50 transition-all cursor-pointer h-40">
                        <i className="fa-solid fa-stopwatch text-4xl text-amber-400 group-hover:scale-110 transition-transform"></i>
                        <div>
                            <p className="text-white font-black text-xl">{formatTime(timer)}</p>
                            <p className="text-slate-400 text-xs font-bold uppercase mt-1">{t('voice.timer')}</p>
                        </div>
                    </div>

                    {COMMANDS.slice(1, 4).map((cmd, idx) => (
                        <button
                            key={cmd.cmd}
                            onClick={() => handleVoiceCommand(cmd.cmd)}
                            className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center gap-4 text-center group hover:bg-slate-700 transition-all active:scale-95 h-40"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white text-2xl group-hover:bg-indigo-500 transition-colors">
                                <i className={`fa-solid ${idx === 0 ? 'fa-pen-to-square' : idx === 1 ? 'fa-check' : 'fa-box-open'}`}></i>
                            </div>
                            <span className="text-slate-200 font-bold text-lg leading-tight">{cmd.action}</span>
                        </button>
                    ))}
                    <button
                        onClick={() => setIsVoiceMode(false)}
                        className="bg-rose-500/20 p-6 rounded-3xl border border-rose-500/30 flex flex-col items-center justify-center gap-4 text-center group hover:bg-rose-600 transition-all active:scale-95 h-40"
                    >
                        <div className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center text-white text-2xl">
                            <i className="fa-solid fa-power-off"></i>
                        </div>
                        <span className="text-rose-200 font-bold text-lg leading-tight">{t('voice.exit')}</span>
                    </button>
                </div>

                <div className="text-slate-500 font-mono text-xs uppercase tracking-[0.2rem]">
                    Pro Tip: Say "Hey SciFlow" to wake up
                </div>
            </div>
        </div>
    );
};
