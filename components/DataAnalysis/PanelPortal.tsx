import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface PanelPortalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;  // e.g. '400px'
}

/**
 * 面板 Portal — 将展开的面板渲染到 body 层，居中显示，带遮罩
 * 彻底避免任何父容器 overflow 裁切问题
 */
const PanelPortal: React.FC<PanelPortalProps> = ({ isOpen, onClose, children, width = '400px' }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟绑定避免立即触发
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* 半透明遮罩 */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* 面板 */}
      <div
        ref={panelRef}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 animate-reveal custom-scrollbar"
        style={{
          position: 'relative',
          width,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default PanelPortal;
