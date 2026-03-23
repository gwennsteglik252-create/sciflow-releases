/**
 * SubplotLayoutSelector — 子图布局选择器
 *
 * 渲染一组布局缩略图按钮（类似 PPT 的幻灯片布局选择面板），
 * 让用户快速在不同子图排列间切换。
 */
import React, { useState, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { SubplotLayoutMode } from '../../types';

const LAYOUTS: { mode: SubplotLayoutMode; label: string; grid: number[][] }[] = [
  { mode: 'single', label: '单图', grid: [[1]] },
  { mode: '1x2', label: '1×2', grid: [[1, 1]] },
  { mode: '2x1', label: '2×1', grid: [[1], [1]] },
  { mode: '2x2', label: '2×2', grid: [[1, 1], [1, 1]] },
  { mode: '1x3', label: '1×3', grid: [[1, 1, 1]] },
  { mode: '3x1', label: '3×1', grid: [[1], [1], [1]] },
  { mode: '2x3', label: '2×3', grid: [[1, 1, 1], [1, 1, 1]] },
  { mode: '3x2', label: '3×2', grid: [[1, 1], [1, 1], [1, 1]] },
];

interface Props {
  currentLayout: SubplotLayoutMode;
  onSelectLayout: (mode: SubplotLayoutMode) => void;
}

const renderGridIcon = (grid: number[][], size = 28, isActive = false) => {
  const rows = grid.length;
  const cols = Math.max(...grid.map(r => r.length));
  const gap = 1.5;
  const cellW = (size - gap * (cols - 1)) / cols;
  const cellH = (size - gap * (rows - 1)) / rows;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grid.map((row, ri) =>
        row.map((_, ci) => (
          <rect
            key={`${ri}-${ci}`}
            x={ci * (cellW + gap)}
            y={ri * (cellH + gap)}
            width={cellW}
            height={cellH}
            rx={2}
            fill={isActive ? '#6366f1' : '#94a3b8'}
            opacity={isActive ? 1 : 0.5}
          />
        ))
      )}
    </svg>
  );
};

const SubplotLayoutSelector: React.FC<Props> = ({ currentLayout, onSelectLayout }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 计算面板位置：从按钮右边缘向左展开，避免超出视口
  const panelPos = useMemo(() => {
    if (!open || !btnRef.current) return { top: 0, left: 0 };
    const rect = btnRef.current.getBoundingClientRect();
    const panelW = 240;
    let left = rect.right - panelW;
    if (left < 8) left = 8;
    return { top: rect.bottom + 6, left };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase transition-all border bg-white text-violet-600 border-violet-200 hover:bg-violet-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm shrink-0"
        title="子图布局"
      >
        <i className="fa-solid fa-table-cells text-[10px]" />
        子图
      </button>

      {/* 点击外部关闭 */}
      {open && ReactDOM.createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
          onClick={() => setOpen(false)}
        />,
        document.body
      )}

      {open && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            width: 240,
            zIndex: 99999,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.97), rgba(248,250,252,0.99))',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226,232,240,0.8)',
            borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
            padding: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '6px',
            animation: 'subplotPopIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
          onClick={e => e.stopPropagation()}
        >
          {LAYOUTS.map(l => {
            const isActive = currentLayout === l.mode;
            return (
              <button
                key={l.mode}
                onClick={() => {
                  onSelectLayout(l.mode);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: isActive ? '2px solid #6366f1' : '1.5px solid #e2e8f0',
                  background: isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(99,102,241,0.04)';
                }}
                onMouseOut={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {renderGridIcon(l.grid, 28, isActive)}
                <span style={{
                  fontSize: 8,
                  fontWeight: 800,
                  color: isActive ? '#4f46e5' : '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {l.label}
                </span>
              </button>
            );
          })}
          <style>{`
            @keyframes subplotPopIn {
              from { opacity: 0; transform: translateY(-4px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </>
  );
};

export default SubplotLayoutSelector;
