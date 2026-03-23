/**
 * PWAInstallPrompt.tsx — PWA 安装引导提示（简化直接版）
 *
 * 不再依赖 beforeinstallprompt 事件（很多浏览器不支持），
 * 直接显示明确的手动操作步骤指引。
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../locales/useTranslation';

const PWAInstallPrompt: React.FC<{ isLightMode: boolean }> = ({ isLightMode }) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // 检测是否已安装为 PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;

  // 检测平台
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    if (isStandalone) return;

    // 只在手机端显示
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    // 用户已关闭过则 7 天内不再显示
    const dismissedAt = localStorage.getItem('pwa_install_dismissed');
    if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) return;

    // 延迟 4 秒显示，避免首屏干扰
    const timer = setTimeout(() => setShow(true), 4000);
    return () => clearTimeout(timer);
  }, [isStandalone]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  if (isStandalone || dismissed || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed bottom-20 left-3 right-3 z-[9960] rounded-2xl border shadow-2xl p-4 backdrop-blur-xl ${isLightMode
          ? 'bg-white/95 border-slate-200'
          : 'bg-slate-900/95 border-white/10'
          }`}
      >
        <div className="flex items-start gap-3">
          {/* Logo */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg shrink-0 mt-0.5">
            <span className="text-white text-sm font-black">S</span>
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black mb-1 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
              {t('pwa.addToHome')}
            </p>
            <div className={`text-[11px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>
              {isIOS ? (
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: t('pwa.iosInstructions').replace('<icon></icon>', `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-500 text-white text-[8px] mx-0.5 align-middle"><i class="fa-solid fa-arrow-up-from-square"></i></span>`)
                  }} 
                />
              ) : (
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: t('pwa.androidInstructions').replace('<icon></icon>', `<span class="inline-flex items-center justify-center w-5 h-5 rounded bg-slate-600 text-white text-[8px] mx-0.5 align-middle"><i class="fa-solid fa-ellipsis-vertical"></i></span>`)
                  }} 
                />
              )}
            </div>
            <p className={`text-[9px] mt-1.5 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('pwa.benefit')}
            </p>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={handleDismiss}
            className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${isLightMode ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-slate-500'}`}
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default React.memo(PWAInstallPrompt);
