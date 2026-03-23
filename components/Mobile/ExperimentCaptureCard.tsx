/**
 * ExperimentCaptureCard.tsx — 移动端实验现场拍照记录卡片
 *
 * 在移动端/平板上可用，用于拍照、添加描述，并关联到实验日志。
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCamera, CapturedPhoto } from '../../hooks/useCamera';
import { ExperimentLog, ExperimentFile } from '../../types';

interface ExperimentCaptureCardProps {
  isLightMode: boolean;
  onSaveCapture: (photo: ExperimentFile, description: string) => void;
}

const ExperimentCaptureCard: React.FC<ExperimentCaptureCardProps> = ({
  isLightMode, onSaveCapture
}) => {
  const { photo, isCapturing, error, takePhoto, pickFromGallery, clearPhoto } = useCamera();
  const [description, setDescription] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = useCallback(() => {
    if (!photo) return;
    const file: ExperimentFile = {
      name: `capture_${Date.now()}.${photo.format}`,
      url: photo.dataUrl,
      description: description || '实验现场拍照',
      lastModified: Date.now(),
    };
    onSaveCapture(file, description);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      clearPhoto();
      setDescription('');
    }, 1500);
  }, [photo, description, onSaveCapture, clearPhoto]);

  const bg = isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10';
  const textPrimary = isLightMode ? 'text-slate-800' : 'text-white';
  const textSecondary = isLightMode ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={`rounded-3xl border ${bg} p-5 backdrop-blur-xl`}>
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <i className="fa-solid fa-camera text-white text-sm" />
        </div>
        <div>
          <h3 className={`text-sm font-bold ${textPrimary}`}>实验拍照</h3>
          <p className={`text-[10px] ${textSecondary}`}>拍摄实验现场，自动同步到日志</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!photo ? (
          /* ─── 拍照按钮 ─── */
          <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex gap-3"
          >
            <button
              onClick={takePhoto}
              disabled={isCapturing}
              className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              {isCapturing ? (
                <i className="fa-solid fa-circle-notch animate-spin" />
              ) : (
                <i className="fa-solid fa-camera" />
              )}
              拍照
            </button>
            <button
              onClick={pickFromGallery}
              disabled={isCapturing}
              className={`flex-1 py-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform border ${isLightMode ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-300 hover:bg-white/5'} disabled:opacity-50`}
            >
              <i className="fa-solid fa-image" />
              相册
            </button>
          </motion.div>
        ) : (
          /* ─── 预览 & 描述 ─── */
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* 照片预览 */}
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
              <img
                src={photo.dataUrl}
                alt="实验拍照"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => { clearPhoto(); setDescription(''); }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-xs hover:bg-black/70 transition-colors"
              >
                <i className="fa-solid fa-times" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur rounded-full px-3 py-1">
                <span className="text-[9px] text-white/80 font-mono">
                  {new Date(photo.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* 描述输入 */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加实验描述（可选）..."
              rows={2}
              className={`w-full rounded-xl px-4 py-3 text-xs resize-none border outline-none transition-colors ${isLightMode
                ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-400'
                : 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-emerald-500'
              }`}
            />

            {/* 保存按钮 */}
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`w-full py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              {isSaved ? (
                <>
                  <i className="fa-solid fa-check" />
                  已保存到日志
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" />
                  保存到实验日志
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 错误提示 */}
      {error && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <p className="text-[10px] text-rose-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(ExperimentCaptureCard);
