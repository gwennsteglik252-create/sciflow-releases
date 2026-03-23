import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * 通用 Portal 包装组件 — 带拖拽、ESC 关闭能力
 * 将 children 渲染到 document.body，避免被父容器的 overflow-hidden / transform 裁切。
 * 默认位置偏左（约 30% 水平位置），方便查看右侧图表。
 * 
 * - 标题栏区域可拖拽移动
 * - 按 ESC 键关闭（需传入 onClose）
 */
interface FixedPortalProps {
  children: React.ReactNode;
  onClose?: () => void;
}

const FixedPortal: React.FC<FixedPortalProps> = ({ children, onClose }) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hasUserDragged, setHasUserDragged] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ESC 关闭
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 拖拽逻辑
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName?.toLowerCase();
    if (['input', 'select', 'button', 'textarea', 'svg', 'path', 'i'].includes(tag)) return;
    // 不拖拽 close 按钮
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setOffset({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
      setHasUserDragged(true);
    };

    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [offset]);

  // 注入覆盖样式：children 的 fixed 定位用我们的坐标系覆盖
  const styleId = 'fixed-portal-override';
  useEffect(() => {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .fixed-portal-wrapper > .fixed {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return ReactDOM.createPortal(
    <div
      className="fixed-portal-wrapper"
      style={{
        position: 'fixed',
        top: `calc(50% + ${offset.y}px)`,
        left: hasUserDragged
          ? `calc(50% + ${offset.x}px)`
          : `calc(30% + ${offset.x}px)`,
        transform: 'translate(-50%, -50%)',
        zIndex: 9990,
        width: 'fit-content',
        height: 'fit-content',
      }}
    >
      {/* 拖拽手柄覆盖层 — 覆盖面板顶部标题栏 */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 50,
          height: 44,
          cursor: 'grab',
          zIndex: 10000,
          borderRadius: '1rem 1rem 0 0',
        }}
      />
      {children}
    </div>,
    document.body,
  );
};

export default FixedPortal;
