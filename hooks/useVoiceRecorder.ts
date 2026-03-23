/**
 * useVoiceRecorder.ts — 移动端语音录制 Hook
 *
 * 使用 Web MediaRecorder API（Capacitor WebView 完全支持）。
 * 返回 base64 音频数据 + 录制时长。
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export interface RecordedAudio {
  base64: string;       // 不含 data: 前缀的纯 base64
  mimeType: string;     // 'audio/webm' | 'audio/mp4'
  duration: number;     // 秒
  timestamp: string;    // ISO
}

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;           // 当前录制时长（秒）
  recordedAudio: RecordedAudio | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordedAudio | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
}

/**
 * 选择支持的 mimeType
 */
const getSupportedMimeType = (): string => {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm'; // fallback
};

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const pausedDurationRef = useRef(0);

  // 清理计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;
      setDuration(Math.floor(elapsed));
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordedAudio(null);
    setDuration(0);
    pausedDurationRef.current = 0;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setError('录音失败');
        setIsRecording(false);
        stopTimer();
      };

      recorder.start(1000); // 每秒一个 chunk
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝');
      } else {
        setError(err.message || '无法启动录音');
      }
    }
  }, [startTimer, stopTimer]);

  const stopRecording = useCallback(async (): Promise<RecordedAudio | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;

    stopTimer();

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType;
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // 停止所有轨道
        recorder.stream.getTracks().forEach(t => t.stop());
        mediaRecorderRef.current = null;

        // Blob → base64
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] || '';
          const audio: RecordedAudio = {
            base64,
            mimeType: mimeType.split(';')[0],
            duration,
            timestamp: new Date().toISOString(),
          };
          setRecordedAudio(audio);
          setIsRecording(false);
          setIsPaused(false);
          resolve(audio);
        };
        reader.onerror = () => {
          setError('音频编码失败');
          setIsRecording(false);
          resolve(null);
        };
        reader.readAsDataURL(blob);
      };

      recorder.stop();
    });
  }, [duration, stopTimer]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
      pausedDurationRef.current += (Date.now() - startTimeRef.current) / 1000;
      stopTimer();
      setIsPaused(true);
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
      startTimer();
      setIsPaused(false);
    }
  }, [startTimer]);

  const clearRecording = useCallback(() => {
    setRecordedAudio(null);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, []);

  return {
    isRecording, isPaused, duration, recordedAudio, error,
    startRecording, stopRecording, pauseRecording, resumeRecording, clearRecording,
  };
}
