import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ACADEMIC_PALETTES } from '../../../hooks/useDataAnalysisLogic';

interface ColorPickerWithPresetsProps {
    label?: string;
    color: string;
    documentColors: string[];
    onChange: (color: string) => void;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const ColorPickerWithPresets: React.FC<ColorPickerWithPresetsProps> = ({
    label, color, documentColors, onChange, size = 'md'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [initialColor, setInitialColor] = useState(color);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, isBottom: true });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    const academicPresets = useMemo(() =>
        Array.from(new Set(ACADEMIC_PALETTES.flatMap(p => p.colors.map(c => c.toLowerCase())))),
        []);

    const updateCoords = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const popoverEstimatedHeight = 350;
            const spaceBelow = window.innerHeight - rect.bottom;
            const isBottom = spaceBelow >= popoverEstimatedHeight || spaceBelow > rect.top;

            setCoords({
                top: isBottom ? rect.bottom + window.scrollY : rect.top + window.scrollY - popoverEstimatedHeight,
                left: rect.left + window.scrollX,
                width: rect.width,
                isBottom: isBottom
            });
        }
    }, []);

    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        setInitialColor(color);
        updateCoords();
        setIsOpen(true);
    };

    const handleRevert = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(initialColor);
    };

    const handleConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen) updateCoords();
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', updateCoords);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen, updateCoords]);

    const popoverContent = (
        <div
            ref={popoverRef}
            className={`fixed bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[10000] p-4 animate-reveal overflow-hidden transition-transform duration-200 ${coords.isBottom ? 'origin-top' : 'origin-bottom'}`}
            style={{
                top: `${coords.top + (coords.isBottom ? 8 : -8)}px`,
                left: `${coords.left}px`,
                width: '260px'
            }}
            onMouseDown={e => e.stopPropagation()}
        >
            <div className="flex justify-between items-center mb-3 px-1">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest">色彩动态调试</span>
                    <span className="text-[7px] font-bold text-indigo-400 uppercase italic">Adaptive Palette</span>
                </div>
                <div className="w-4 h-4 rounded border border-slate-200" style={{ backgroundColor: color }}></div>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {documentColors.length > 0 && (
                    <div className="mb-4">
                        <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-2 px-1">图表应用色 (Document)</p>
                        <div className="grid grid-cols-6 gap-1.5">
                            {documentColors.map((c, i) => (
                                <button
                                    key={`doc-${i}`}
                                    onClick={() => onChange(c)}
                                    className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-white bg-white shadow-sm'}`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">标准学术色 (Journal)</p>
                    <div className="grid grid-cols-6 gap-1.5">
                        {academicPresets.map((c, i) => (
                            <button
                                key={`acad-${i}`}
                                onClick={() => onChange(c)}
                                className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100">
                <div className="flex flex-col gap-2">
                    <label className="relative flex items-center justify-center gap-2 w-full py-2 bg-slate-900 rounded-xl cursor-pointer hover:bg-black transition-all group overflow-hidden shadow-md">
                        <i className="fa-solid fa-palette text-indigo-400 text-[10px]"></i>
                        <span className="text-[8px] font-black text-white uppercase">更多色彩</span>
                        <input type="color" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={color} onChange={(e) => onChange(e.target.value)} />
                    </label>
                    <div className="flex gap-2">
                        <button onClick={handleRevert} className="flex-1 py-2 bg-slate-50 text-slate-500 rounded-xl text-[9px] font-black uppercase border border-slate-200">重置</button>
                        <button onClick={handleConfirm} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg">确定</button>
                    </div>
                </div>
            </div>
        </div>
    );

    const sizeClasses = {
        xs: 'w-6 h-6 rounded-lg',
        sm: 'w-8 h-8 rounded-lg',
        md: 'w-full h-9 rounded-xl',
        lg: 'w-full h-11 rounded-2xl'
    };

    return (
        <div className={`relative ${size === 'md' || size === 'lg' ? 'w-full' : ''}`}>
            {label && <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase px-1 tracking-tighter">{label}</label>}
            <button
                ref={triggerRef}
                onClick={handleOpen}
                className={`${sizeClasses[size]} border transition-all active:scale-95 flex items-center p-1 shadow-sm ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-400'}`}
            >
                <div className="w-full h-full rounded-[inherit] shadow-inner border border-black/5" style={{ backgroundColor: color }}></div>
            </button>
            {isOpen && createPortal(popoverContent, document.body)}
        </div>
    );
};