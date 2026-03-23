import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface ToolbarGroupMenuProps {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  hoverBg: string;
  children: React.ReactNode;
}

/**
 * 工具栏分组下拉菜单 — 使用 Portal 渲染到 body，避免 overflow 裁切
 */
const ToolbarGroupMenu: React.FC<ToolbarGroupMenuProps> = ({
  icon, label, color, bgColor, borderColor, hoverBg, children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 计算菜单位置
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuW = 180;
    let left = rect.left;
    // 防止右溢出
    if (left + menuW > window.innerWidth - 8) {
      left = window.innerWidth - menuW - 8;
    }
    // 防止左溢出
    if (left < 8) left = 8;

    setPos({
      top: rect.bottom + 6,
      left,
    });
  }, []);

  // 打开或关闭
  const toggle = useCallback(() => {
    if (!isOpen) updatePosition();
    setIsOpen(prev => !prev);
  }, [isOpen, updatePosition]);

  // ESC 关闭 + 滚动/大小变化时更新位置
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const onReposition = () => updatePosition();

    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        onClick={toggle}
        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border flex items-center gap-1.5 shadow-sm active:scale-95
          ${isOpen
            ? `${bgColor} ${color} ${borderColor} ring-2 ring-offset-1 ring-current/20`
            : `bg-white ${color} ${borderColor} ${hoverBg} hover:text-white`
          }`}
      >
        <i className={`fa-solid ${icon} text-[10px]`} />
        {label}
        <i className={`fa-solid fa-chevron-down text-[7px] ml-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 p-2 min-w-[160px] animate-reveal"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
          }}
        >
          <div className="flex flex-col gap-1">
            {children}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ToolbarGroupMenu;
