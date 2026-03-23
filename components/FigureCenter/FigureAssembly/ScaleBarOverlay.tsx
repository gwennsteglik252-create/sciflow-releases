import React, { useState } from 'react';
import { FigurePanel } from '../../../types';

export interface ScaleBarConfig {
    text: string;
    width: number;      // px within panel
    height: number;     // bar thickness in px
    color: string;
    position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    fontSize: number;
}

export const DEFAULT_SCALE_BAR: ScaleBarConfig = {
    text: '100 μm',
    width: 80,
    height: 4,
    color: '#ffffff',
    position: 'bottom-right',
    fontSize: 12,
};

interface ScaleBarOverlayProps {
    config: ScaleBarConfig;
    isActive: boolean;
    onUpdate: (updates: Partial<ScaleBarConfig>) => void;
    onDelete: () => void;
}

export const ScaleBarOverlay: React.FC<ScaleBarOverlayProps> = ({
    config, isActive, onUpdate, onDelete
}) => {
    const [editing, setEditing] = useState(false);
    const pos = config.position;

    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        zIndex: 150,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: pos.includes('right') ? 'flex-end' : 'flex-start',
        gap: 2,
        ...(pos.includes('bottom') ? { bottom: 8 } : { top: 8 }),
        ...(pos.includes('right') ? { right: 8 } : { left: 8 }),
    };

    return (
        <div style={containerStyle}>
            {/* Text label */}
            {editing ? (
                <input
                    autoFocus
                    className="bg-transparent outline-none border-b border-white/50 text-center"
                    style={{
                        color: config.color,
                        fontSize: config.fontSize,
                        fontWeight: 700,
                        width: Math.max(60, config.width),
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                    }}
                    value={config.text}
                    onChange={e => onUpdate({ text: e.target.value })}
                    onBlur={() => setEditing(false)}
                    onKeyDown={e => e.key === 'Enter' && setEditing(false)}
                />
            ) : (
                <span
                    style={{
                        color: config.color,
                        fontSize: config.fontSize,
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        cursor: 'text',
                    }}
                    onDoubleClick={() => setEditing(true)}
                >
                    {config.text}
                </span>
            )}

            {/* Scale bar */}
            <div
                style={{
                    width: config.width,
                    height: config.height,
                    backgroundColor: config.color,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
                    borderRadius: 1,
                }}
            />

            {/* Toolbar - only shown when panel active */}
            {isActive && (
                <div
                    className="no-export flex items-center gap-1 mt-1 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1"
                    onClick={e => e.stopPropagation()}
                >
                    <input
                        type="number"
                        min={20}
                        max={400}
                        value={config.width}
                        onChange={e => onUpdate({ width: Math.max(20, parseInt(e.target.value) || 20) })}
                        className="w-12 bg-transparent text-white text-[9px] text-center outline-none"
                        title="宽度(px)"
                    />
                    <input
                        type="color"
                        value={config.color}
                        onChange={e => onUpdate({ color: e.target.value })}
                        className="w-5 h-5 border-0 p-0 cursor-pointer"
                        title="颜色"
                    />
                    <select
                        value={config.position}
                        onChange={e => onUpdate({ position: e.target.value as ScaleBarConfig['position'] })}
                        className="bg-transparent text-white text-[8px] outline-none cursor-pointer"
                        title="位置"
                    >
                        <option value="bottom-right" className="text-black">右下</option>
                        <option value="bottom-left" className="text-black">左下</option>
                        <option value="top-right" className="text-black">右上</option>
                        <option value="top-left" className="text-black">左上</option>
                    </select>
                    <button
                        onClick={onDelete}
                        className="text-rose-400 hover:text-rose-300 text-[10px] ml-1"
                        title="删除比例尺"
                    >
                        <i className="fa-solid fa-trash-can" />
                    </button>
                </div>
            )}
        </div>
    );
};
