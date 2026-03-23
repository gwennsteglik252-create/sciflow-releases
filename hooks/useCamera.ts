/**
 * useCamera.ts — 移动端拍照 / 选图 Hook
 *
 * 封装 @capacitor/camera，Web 端自动回退为 file-input。
 * 返回 base64 DataURL + 元信息。
 */
import { useState, useCallback, useRef } from 'react';

export interface CapturedPhoto {
  dataUrl: string;      // base64 DataURL (data:image/jpeg;base64,...)
  format: string;       // 'jpeg' | 'png'
  timestamp: string;    // ISO
  width?: number;
  height?: number;
}

interface UseCameraReturn {
  photo: CapturedPhoto | null;
  isCapturing: boolean;
  error: string | null;
  takePhoto: () => Promise<CapturedPhoto | null>;
  pickFromGallery: () => Promise<CapturedPhoto | null>;
  clearPhoto: () => void;
}

/**
 * Capacitor Camera 动态导入（避免 SSR / Electron 报错）
 */
const getCapacitorCamera = async () => {
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    return { Camera, CameraResultType, CameraSource };
  } catch {
    return null;
  }
};

/**
 * 检测是否运行在 Capacitor 原生壳中
 */
const isNativePlatform = (): boolean => {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
};

/**
 * Web 端 file-input 回退
 */
const webFilePick = (accept: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.capture = 'environment'; // 优先后置摄像头
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
};

export function useCamera(): UseCameraReturn {
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const capture = useCallback(async (source: 'camera' | 'gallery'): Promise<CapturedPhoto | null> => {
    if (lockRef.current) return null;
    lockRef.current = true;
    setIsCapturing(true);
    setError(null);

    try {
      let dataUrl: string | null = null;

      if (isNativePlatform()) {
        // ──── Capacitor 原生路径 ────
        const cap = await getCapacitorCamera();
        if (!cap) throw new Error('Camera plugin not available');

        const { Camera, CameraResultType, CameraSource } = cap;
        const result = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.DataUrl,
          source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
          width: 1920,
          correctOrientation: true,
        });
        dataUrl = result.dataUrl || null;
      } else {
        // ──── Web 回退 ────
        dataUrl = await webFilePick('image/*');
      }

      if (!dataUrl) {
        setIsCapturing(false);
        lockRef.current = false;
        return null; // 用户取消
      }

      const captured: CapturedPhoto = {
        dataUrl,
        format: dataUrl.includes('image/png') ? 'png' : 'jpeg',
        timestamp: new Date().toISOString(),
      };

      setPhoto(captured);
      return captured;
    } catch (err: any) {
      const msg = err?.message || '拍照失败';
      // 用户取消不算错误
      if (msg.includes('cancelled') || msg.includes('User cancelled')) {
        setError(null);
      } else {
        setError(msg);
        console.error('[useCamera]', err);
      }
      return null;
    } finally {
      setIsCapturing(false);
      lockRef.current = false;
    }
  }, []);

  const takePhoto = useCallback(() => capture('camera'), [capture]);
  const pickFromGallery = useCallback(() => capture('gallery'), [capture]);
  const clearPhoto = useCallback(() => { setPhoto(null); setError(null); }, []);

  return { photo, isCapturing, error, takePhoto, pickFromGallery, clearPhoto };
}
