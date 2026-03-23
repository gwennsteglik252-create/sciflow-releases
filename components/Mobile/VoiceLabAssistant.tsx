/**
 * VoiceLabAssistant.tsx — 语音实验伴侣
 *
 * 在湿实验时语音口述实验现象，AI 自动整理为结构化日志。
 * 底部悬浮麦克风按钮唤起，录音 → 转写 → 结构化预览 → 确认存储。
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceRecorder, RecordedAudio } from '../../hooks/useVoiceRecorder';
import { processVoiceToExperimentLog, StructuredExperimentFromVoice } from '../../services/gemini/voiceTranscription';

interface VoiceLabAssistantProps {
  isLightMode: boolean;
  onSaveLog: (data: StructuredExperimentFromVoice) => void;
}

/**
 * 格式化时长 mm:ss
 */
const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const VoiceLabAssistant: React.FC<VoiceLabAssistantProps> = ({
  isLightMode, onSaveLog
}) => {
  const {
    isRecording, isPaused, duration, recordedAudio, error: recorderError,
    startRecording, stopRecording, pauseRecording, resumeRecording, clearRecording,
  } = useVoiceRecorder();

  const [isOpen, setIsOpen] = useState(false);
  const [processing, setProcessing] = useState<'idle' | 'transcribing' | 'structuring' | 'done' | 'error'>('idle');
  const [transcription, setTranscription] = useState('');
  const [structured, setStructured] = useState<StructuredExperimentFromVoice | null>(null);
  const [processError, setProcessError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleStop = useCallback(async () => {
    const audio = await stopRecording();
    if (!audio) return;

    // 自动开始转写
    setProcessing('transcribing');
    setProcessError('');

    try {
      const result = await processVoiceToExperimentLog(audio.base64, audio.mimeType);
      setTranscription(result.transcription);
      setStructured(result.structured);
      setProcessing('done');
    } catch (err: any) {
      setProcessError(err.message || 'AI 转写失败');
      setProcessing('error');
    }
  }, [stopRecording]);

  const handleSave = useCallback(() => {
    if (!structured) return;
    onSaveLog(structured);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setTranscription('');
      setStructured(null);
      setProcessing('idle');
      clearRecording();
    }, 1500);
  }, [structured, onSaveLog, clearRecording]);

  const handleClose = useCallback(() => {
    if (isRecording) stopRecording();
    setIsOpen(false);
    setTranscription('');
    setStructured(null);
    setProcessing('idle');
    clearRecording();
  }, [isRecording, stopRecording, clearRecording]);

  const handleRetry = useCallback(() => {
    setTranscription('');
    setStructured(null);
    setProcessing('idle');
    setProcessError('');
    clearRecording();
  }, [clearRecording]);

  const bg = isLightMode ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-white/10';
  const textPrimary = isLightMode ? 'text-slate-800' : 'text-white';
  const textSecondary = isLightMode ? 'text-slate-500' : 'text-slate-400';

  return (
    <>
      {/* ─── 悬浮麦克风按钮 ─── */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-5 z-[9960] w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-600/30 flex items-center justify-center"
        >
          <i className="fa-solid fa-microphone text-white text-lg" />
        </motion.button>
      )}

      {/* ─── 语音面板 ─── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* 遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9970]"
              onClick={handleClose}
            />

            {/* 面板 */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`fixed bottom-0 left-0 right-0 z-[9975] rounded-t-3xl border-t ${bg} backdrop-blur-xl max-h-[85vh] overflow-y-auto`}
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
            >
              {/* 拖拽指示器 */}
              <div className="flex justify-center pt-3 pb-2">
                <div className={`w-10 h-1 rounded-full ${isLightMode ? 'bg-slate-300' : 'bg-white/20'}`} />
              </div>

              {/* 标题 */}
              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                    <i className="fa-solid fa-waveform-lines text-white text-xs" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${textPrimary}`}>语音实验助手</h3>
                    <p className={`text-[9px] ${textSecondary}`}>口述实验现象，AI 自动整理</p>
                  </div>
                </div>
                <button onClick={handleClose} className={`p-2 rounded-xl ${isLightMode ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}>
                  <i className={`fa-solid fa-times text-sm ${textSecondary}`} />
                </button>
              </div>

              <div className="px-5 space-y-4">
                {/* ─── 录制状态 ─── */}
                {processing === 'idle' && !recordedAudio && (
                  <div className="flex flex-col items-center py-6">
                    {/* 时长 */}
                    <span className={`text-3xl font-mono font-bold mb-6 ${isRecording ? 'text-rose-400' : textPrimary}`}>
                      {formatDuration(duration)}
                    </span>

                    {/* 录音脉动动画 */}
                    {isRecording && !isPaused && (
                      <div className="flex gap-1 mb-6 h-8 items-end">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-1 rounded-full bg-gradient-to-t from-violet-600 to-indigo-400"
                            animate={{ height: [8, Math.random() * 30 + 8, 8] }}
                            transition={{ duration: 0.5 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }}
                          />
                        ))}
                      </div>
                    )}

                    {/* 控制按钮 */}
                    <div className="flex items-center gap-4">
                      {!isRecording ? (
                        <button
                          onClick={startRecording}
                          className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl shadow-rose-500/30 active:scale-90 transition-transform"
                        >
                          <i className="fa-solid fa-microphone text-white text-xl" />
                        </button>
                      ) : (
                        <>
                          {/* 暂停/恢复 */}
                          <button
                            onClick={isPaused ? resumeRecording : pauseRecording}
                            className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-transform ${isLightMode ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-300'}`}
                          >
                            <i className={`fa-solid ${isPaused ? 'fa-play' : 'fa-pause'} text-sm`} />
                          </button>
                          {/* 停止 */}
                          <button
                            onClick={handleStop}
                            className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl shadow-rose-500/30 active:scale-90 transition-transform"
                          >
                            <div className="w-5 h-5 rounded-sm bg-white" />
                          </button>
                        </>
                      )}
                    </div>

                    {!isRecording && (
                      <p className={`text-[10px] mt-4 ${textSecondary}`}>点击开始录音，口述实验现象</p>
                    )}
                  </div>
                )}

                {/* ─── 处理中状态 ─── */}
                {(processing === 'transcribing' || processing === 'structuring') && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                      <i className="fa-solid fa-brain text-2xl text-violet-400 animate-pulse" />
                    </div>
                    <p className={`text-xs font-bold ${textPrimary}`}>
                      {processing === 'transcribing' ? 'AI 正在转写语音...' : '正在结构化为日志...'}
                    </p>
                    <p className={`text-[10px] mt-1 ${textSecondary}`}>这可能需要几秒钟</p>
                  </div>
                )}

                {/* ─── 错误 ─── */}
                {(processing === 'error' || recorderError) && (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-3">
                      <i className="fa-solid fa-exclamation-triangle text-rose-400 text-xl" />
                    </div>
                    <p className="text-xs text-rose-400 font-bold mb-1">{processError || recorderError}</p>
                    <button onClick={handleRetry} className="text-[10px] text-violet-400 font-bold hover:underline">
                      重试
                    </button>
                  </div>
                )}

                {/* ─── 结果预览 ─── */}
                {processing === 'done' && structured && (
                  <div className="space-y-3 pb-4">
                    {/* 转写原文 */}
                    <div className={`rounded-2xl p-4 border ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${textSecondary}`}>转写原文</p>
                      <p className={`text-xs leading-relaxed ${textPrimary}`}>{transcription}</p>
                    </div>

                    {/* 结构化预览 */}
                    <div className={`rounded-2xl p-4 border ${isLightMode ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mb-3 ${isLightMode ? 'text-indigo-500' : 'text-indigo-400'}`}>结构化日志预览</p>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className={`text-[9px] font-bold shrink-0 w-12 ${textSecondary}`}>标题</span>
                          <span className={`text-xs font-bold ${textPrimary}`}>{structured.content}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className={`text-[9px] font-bold shrink-0 w-12 ${textSecondary}`}>描述</span>
                          <span className={`text-xs ${textPrimary}`}>{structured.description}</span>
                        </div>
                        {structured.parameterList.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className={`text-[9px] font-bold shrink-0 w-12 ${textSecondary}`}>参数</span>
                            <div className="flex flex-wrap gap-1.5">
                              {structured.parameterList.map((p, i) => (
                                <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${isLightMode ? 'bg-white border border-slate-200 text-slate-700' : 'bg-white/10 border border-white/10 text-slate-300'}`}>
                                  {p.key}: {p.value} {p.unit}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className={`text-[9px] font-bold shrink-0 w-12 ${textSecondary}`}>结果</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            structured.result === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            structured.result === 'failure' ? 'bg-rose-500/10 text-rose-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {structured.result === 'success' ? '成功' : structured.result === 'failure' ? '失败' : structured.result === 'observation' ? '观察' : '中性'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleRetry}
                        className={`flex-1 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border ${isLightMode ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
                      >
                        <i className="fa-solid fa-rotate-right" />
                        重新录制
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saved}
                        className={`flex-1 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${saved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20'
                        }`}
                      >
                        {saved ? (
                          <><i className="fa-solid fa-check" /> 已添加</>
                        ) : (
                          <><i className="fa-solid fa-plus" /> 添加到日志</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default React.memo(VoiceLabAssistant);
