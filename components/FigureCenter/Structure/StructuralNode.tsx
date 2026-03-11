
import React from 'react';
import { DiagramNode, NodeType } from './types';
import { NODE_THEMES, COLOR_MAP } from './constants';
import { ScientificTheme } from '../../../ScientificThemes';
import { ColorPickerWithPresets } from '../../DataAnalysis/Chart/ColorPickerWithPresets';

interface StructuralNodeProps {
    node: DiagramNode;
    position: { x: number; y: number };
    isDragging: boolean;
    isEditing: boolean;
    isConnectingSource?: boolean;
    onMouseDown: (e: React.MouseEvent, id: string) => void;
    onClick: (e: React.MouseEvent) => void;
    setEditingId: (id: string | null) => void;
    onUpdateNode: (id: string, updates: Partial<DiagramNode>) => void;
    onDeleteNode?: (id: string) => void;
    activeTheme: ScientificTheme;
    documentColors: string[];
}

const COLOR_OPTIONS = [
    { label: 'Slate', value: 'slate' },
    { label: 'Indigo', value: 'indigo' },
    { label: 'Emerald', value: 'emerald' },
    { label: 'Amber', value: 'amber' },
    { label: 'Rose', value: 'rose' },
    { label: 'Blue', value: 'blue' },
    { label: 'Violet', value: 'violet' },
];

const FONT_SIZES = [
    { label: 'S', value: 'sm' },
    { label: 'M', value: 'md' },
    { label: 'L', value: 'lg' }
];

export const StructuralNode: React.FC<StructuralNodeProps> = ({
    node, position, isDragging, isEditing, isConnectingSource,
    onMouseDown, onClick, setEditingId, onUpdateNode, onDeleteNode, activeTheme,
    documentColors
}) => {
    // 基础主题逻辑
    const isHexColor = node.customColor?.startsWith('#');
    let theme: any = node.customColor && !node.customColor.startsWith('#')
        ? (COLOR_MAP[node.customColor] || NODE_THEMES[node.type] || NODE_THEMES['process'])
        : (NODE_THEMES[node.type] || NODE_THEMES['process']);

    // 应用期刊主题覆盖 (仅在没有自定义颜色时)
    if (!node.customColor && activeTheme) {
        if (activeTheme.id === 'nature') {
            if (node.type === 'process') theme = { ...theme, bg: 'bg-white', border: 'border-slate-800', header: 'bg-blue-800', text: 'text-slate-900', iconColor: 'text-white' };
            else if (node.type === 'decision') theme = { ...theme, bg: 'bg-white', border: 'border-slate-800', header: 'bg-rose-700', text: 'text-slate-900', iconColor: 'text-white' };
            else theme = { ...theme, bg: 'bg-white', border: 'border-slate-400', header: 'bg-slate-100', text: 'text-slate-800', iconColor: 'text-slate-600' };
        } else if (activeTheme.id === 'cell') {
            if (node.type === 'process') theme = { ...theme, border: 'border-blue-500 border-4', bg: 'bg-blue-50', header: 'bg-blue-500', text: 'text-blue-900', iconColor: 'text-white' };
            else if (node.type === 'decision') theme = { ...theme, border: 'border-pink-500 border-4', bg: 'bg-pink-50', header: 'bg-pink-500', text: 'text-pink-900', iconColor: 'text-white' };
            else theme = { ...theme, border: 'border-emerald-500 border-4', bg: 'bg-emerald-50', header: 'bg-emerald-500', text: 'text-emerald-900', iconColor: 'text-white' };
        } else if (activeTheme.id === 'jacs') {
            theme = { ...theme, bg: 'bg-white', border: 'border-black border-2', header: 'bg-white border-b-2 border-black', text: 'text-black', iconColor: 'text-black' };
        } else if (activeTheme.id === 'clean') {
            theme = { ...theme, border: 'border-slate-200', bg: 'bg-white shadow-sm', header: 'bg-slate-50 border-b border-slate-100', text: 'text-slate-600', iconColor: 'text-slate-400' };
            if (node.type === 'process') {
                theme.header = 'bg-indigo-50 text-indigo-600 border-b border-indigo-100';
                theme.iconColor = 'text-indigo-400';
                theme.border = 'border-indigo-100 ring-1 ring-indigo-50';
            }
            if (node.type === 'decision') {
                theme.header = 'bg-amber-50 text-amber-600 border-b border-amber-100';
                theme.iconColor = 'text-amber-400';
                theme.border = 'border-amber-100 ring-1 ring-amber-50';
            }
            if (node.type === 'output') {
                theme.header = 'bg-emerald-50 text-emerald-600 border-b border-emerald-100';
                theme.iconColor = 'text-emerald-400';
                theme.border = 'border-emerald-100 ring-1 ring-emerald-50';
            }
        }
    }

    const customStyle: React.CSSProperties = {
        width: 256, // 严格锁定宽度，与 LAYOUT_CONSTANTS.nodeWidth 保持一致
        ...(isHexColor ? {
            backgroundColor: `${node.customColor}40`,
            borderColor: `${node.customColor}80`,
            boxShadow: isDragging
                ? `0 20px 25px -5px ${node.customColor}66`
                : isEditing
                    ? `0 0 0 2px ${node.customColor}4D`
                    : 'none'
        } : {})
    };

    const customHeaderStyle: React.CSSProperties = isHexColor ? {
        backgroundColor: node.customColor,
        color: '#fff'
    } : {};

    // Default to 'lg' if not set.
    const currentSize = node.fontSize || 'lg';

    const fontSizeClass = currentSize === 'lg' ? 'text-base' : currentSize === 'sm' ? 'text-xs' : 'text-sm';
    const subFontSizeClass = currentSize === 'lg' ? 'text-xs' : currentSize === 'sm' ? 'text-[8px]' : 'text-[10px]';

    const handleParamChange = (idx: number, val: string) => {
        const newParams = [...(node.params || [])];
        newParams[idx] = val;
        onUpdateNode(node.id, { params: newParams });
    };

    const handleAddParam = () => {
        onUpdateNode(node.id, { params: [...(node.params || []), 'New Param'] });
    };

    const handleRemoveParam = (idx: number) => {
        const newParams = (node.params || []).filter((_, i) => i !== idx);
        onUpdateNode(node.id, { params: newParams });
    };

    return (
        <div
            data-node-id={node.id}
            className={`
          absolute rounded-xl border-2 shadow-sm transition-all cursor-move flex flex-col overflow-hidden group/node
          ${isHexColor ? '' : `${theme.border} ${theme.bg}`}
          ${isDragging ? `shadow-2xl scale-105 z-[100]` : isEditing ? `z-[100] shadow-xl ${isHexColor ? '' : 'ring-2 ring-indigo-400'}` : 'hover:shadow-md z-10'}
          ${isConnectingSource ? 'ring-4 ring-amber-400 border-amber-500 animate-pulse z-[100]' : ''}
       `}
            style={{ left: position.x, top: position.y, ...customStyle }}
            onMouseDown={(e) => onMouseDown(e, node.id)}
            onClick={onClick}
        >
            {/* Header */}
            <div className={`px-3 py-2.5 flex flex-col ${isHexColor ? '' : theme.header}`} style={customHeaderStyle}>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 flex-1">
                        <i className={`fa-solid ${node.icon || 'fa-circle'} ${isHexColor ? 'text-white' : theme.iconColor} text-[10px]`}></i>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isHexColor ? 'text-white' : theme.iconColor}`}>{node.type}</span>
                    </div>
                    <div className="flex gap-1 items-center">
                        {onDeleteNode && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                                className="w-6 h-6 rounded-lg bg-white/20 text-white border border-white/10 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover/node:opacity-100 shadow-sm active:scale-90"
                                title="删除节点"
                            >
                                <i className="fa-solid fa-times text-xs"></i>
                            </button>
                        )}
                        <div className={`w-2 h-2 rounded-full bg-black/10 group-hover/node:hidden`}></div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className={`px-3 py-3 flex-1 flex flex-col gap-2 justify-center`}>
                <p
                    onDoubleClick={() => setEditingId(node.id)}
                    title="双击编辑内容"
                    className={`px-2 transition-colors leading-snug tracking-tight cursor-text hover:bg-black/5 rounded mb-1.5 text-center ${!node.textConfig?.color ? (isHexColor ? 'text-slate-800' : theme.text) : ''}`}
                    style={{
                        fontFamily: node.textConfig?.fontFamily !== 'inherit' ? node.textConfig?.fontFamily : undefined,
                        fontSize: node.textConfig?.fontSize ? `${node.textConfig.fontSize}pt` : undefined,
                        fontWeight: node.textConfig?.fontWeight || '900',
                        fontStyle: node.textConfig?.fontStyle || 'normal',
                        color: node.textConfig?.color || (isHexColor ? '#1e293b' : undefined),
                        textAlign: (node.textConfig?.textAlign as any) || 'center'
                    }}
                >{node.text}</p>
                <p
                    className={`px-2 italic leading-snug font-medium opacity-80 text-center`}
                    style={{
                        fontFamily: node.subTextConfig?.fontFamily !== 'inherit' ? node.subTextConfig?.fontFamily : undefined,
                        fontSize: node.subTextConfig?.fontSize ? `${node.subTextConfig.fontSize}pt` : undefined,
                        fontWeight: node.subTextConfig?.fontWeight || '500',
                        fontStyle: node.subTextConfig?.fontStyle || 'italic',
                        color: node.subTextConfig?.color || '#64748b',
                        textAlign: (node.subTextConfig?.textAlign as any) || 'center'
                    }}
                >{node.subText || ''}</p>
            </div>

            {/* Footer / Params — wrapping allowed to show all content */}
            <div className={`px-3 py-2 border-t ${activeTheme.id === 'clean' ? 'border-slate-100' : theme.border.replace('border-4', 'border').replace('border-2', 'border')} bg-white/50 shrink-0`}>
                <div className={`flex flex-wrap gap-1 ${node.paramsConfig?.textAlign === 'left' ? 'justify-start' : node.paramsConfig?.textAlign === 'right' ? 'justify-end' : 'justify-center'}`}>
                    {node.params && node.params.map((p, i) => (
                        <span
                            key={i}
                            className="px-1.5 py-0.5 rounded border border-black/5 shadow-sm bg-white/80"
                            style={{
                                fontFamily: node.paramsConfig?.fontFamily !== 'inherit' ? node.paramsConfig?.fontFamily : '"Courier New", Courier, monospace',
                                fontSize: node.paramsConfig?.fontSize ? `${node.paramsConfig.fontSize}pt` : '8pt',
                                fontWeight: node.paramsConfig?.fontWeight || 'bold',
                                fontStyle: node.paramsConfig?.fontStyle || 'normal',
                                color: node.paramsConfig?.color || '#475569'
                            }}
                        >
                            {p}
                        </span>
                    ))}
                </div>
            </div>

        </div >
    );
};
