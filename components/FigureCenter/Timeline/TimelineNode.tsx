import React from 'react';
import { TimelineEvent } from '../../../types/visuals';

interface TimelineNodeProps {
    event: TimelineEvent & { computedLineLength?: number };
    isActive: boolean;
    onClick: () => void;
    onUpdate: (updates: Partial<TimelineEvent>) => void;
    onDelete: () => void;
    part?: 'line' | 'body'; // 'line' for the vertical connector, 'body' for the bubble and anchor dot
}

const TYPE_CONFIG: Record<string, { color: string; icon: string; labelZh: string; labelEn: string; glow: string; pulse: string }> = {
    breakthrough: { color: 'bg-rose-500', icon: 'fa-bolt-lightning', labelZh: '突破', labelEn: 'Breakthrough', glow: 'shadow-[0_0_12px_rgba(244,63,94,0.4)]', pulse: 'animate-ping bg-rose-400' },
    milestone: { color: 'bg-indigo-600', icon: 'fa-flag', labelZh: '里程碑', labelEn: 'Milestone', glow: 'shadow-[0_0_12px_rgba(99,102,241,0.4)]', pulse: 'animate-ping bg-indigo-400' },
    publication: { color: 'bg-emerald-600', icon: 'fa-book', labelZh: '发布', labelEn: 'Publication', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]', pulse: 'animate-ping bg-emerald-400' },
    industrial: { color: 'bg-amber-500', icon: 'fa-industry', labelZh: '应用', labelEn: 'Industrial', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]', pulse: 'animate-ping bg-amber-400' },
    failed_attempt: { color: 'bg-slate-400', icon: 'fa-skull-crossbones', labelZh: '回溯', labelEn: 'Retrospect', glow: '', pulse: '' }
};

// 检测文本是否主要是英文（超过 50% 为 ASCII 字母）
const isEnglishText = (text: string): boolean => {
    if (!text) return false;
    const letters = text.replace(/[^a-zA-Z\u4e00-\u9fff]/g, '');
    if (!letters.length) return false;
    const asciiCount = (letters.match(/[a-zA-Z]/g) || []).length;
    return asciiCount / letters.length > 0.5;
};

export const TimelineNode: React.FC<TimelineNodeProps> = ({ event, isActive, onClick, onUpdate, onDelete, part = 'body' }) => {
    const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.milestone;
    const isTop = event.side === 'top';
    const lineH = event.computedLineLength || event.lineLength || 40;
    const bc = event.bubbleConfig;

    const isLinePart = part === 'line';
    const isBodyPart = part === 'body';

    // 连接线属性
    const lineW = event.lineStrokeWidth || 2.5;
    const lineDash = event.lineStyle || 'dashed';
    const lineStyleStr = lineDash === 'solid' ? 'solid' : lineDash === 'dotted' ? 'dotted' : 'dashed';

    // 锚点属性
    const dotSz = event.dotSize || 16; // px
    const dotShape = event.dotShape || 'circle';
    const dotBorderRadius = dotShape === 'circle' ? '50%' : dotShape === 'diamond' ? '3px' : '3px';
    const dotTransform = dotShape === 'diamond' ? 'rotate(45deg)' : undefined;

    // 气泡宽度
    const bWidth = event.bubbleWidth || 200;

    // 节点颜色覆盖（如果用户自定义了 color）
    const dotColorStyle = event.color ? { backgroundColor: event.color } : undefined;
    const lineColorClass = event.color ? '' : (isActive ? 'border-indigo-600' : 'border-slate-400 opacity-60');

    // 气泡自定义样式
    const bubbleStyle: React.CSSProperties = {};
    if (bc?.bgColor) bubbleStyle.backgroundColor = bc.bgColor;
    if (bc?.borderColor) bubbleStyle.borderColor = bc.borderColor;
    if (bc?.borderWidth !== undefined) bubbleStyle.borderWidth = `${bc.borderWidth}px`;
    if (bc?.borderRadius !== undefined) bubbleStyle.borderRadius = `${bc.borderRadius}px`;
    if (bc?.opacity !== undefined) bubbleStyle.opacity = bc.opacity;

    const glassClass = bc?.glassEffect ? 'backdrop-blur-md bg-white/70' : '';
    const globalFont = bc?.fontFamily || undefined;
    const globalAlign = bc?.textAlign || 'left';

    // 检测当前内容语言
    const isEng = isEnglishText(event.title) || isEnglishText(event.description);
    const typeLabel = isEng ? config.labelEn : config.labelZh;

    // 组合标题样式（独立字体/对齐 > 全局回退）
    const titleStyleObj: React.CSSProperties = {
        ...(bc?.titleFontSize ? { fontSize: `${bc.titleFontSize}px` } : {}),
        fontFamily: bc?.titleFontFamily || globalFont || undefined,
        ...(bc?.titleFontWeight ? { fontWeight: bc.titleFontWeight as any } : {}),
        ...(bc?.titleFontStyle ? { fontStyle: bc.titleFontStyle } : {}),
        ...(bc?.titleColor ? { color: bc.titleColor } : {}),
        textAlign: bc?.titleTextAlign || globalAlign,
    };
    // 组合描述样式
    const descStyleObj: React.CSSProperties = {
        ...(bc?.descFontSize ? { fontSize: `${bc.descFontSize}px` } : {}),
        fontFamily: bc?.descFontFamily || globalFont || undefined,
        ...(bc?.descFontWeight ? { fontWeight: bc.descFontWeight as any } : {}),
        ...(bc?.descFontStyle ? { fontStyle: bc.descFontStyle } : {}),
        ...(bc?.descColor ? { color: bc.descColor } : {}),
        textAlign: bc?.descTextAlign || globalAlign,
    };
    // 日期样式
    const dateStyleObj: React.CSSProperties = {
        ...(bc?.dateFontSize ? { fontSize: `${bc.dateFontSize}px` } : {}),
        fontFamily: bc?.dateFontFamily || globalFont || undefined,
        ...(bc?.dateFontWeight ? { fontWeight: bc.dateFontWeight as any } : {}),
        ...(bc?.dateFontStyle ? { fontStyle: bc.dateFontStyle } : {}),
        ...(bc?.dateColor ? { color: bc.dateColor } : (event.color ? { color: event.color } : {})),
        textAlign: bc?.dateTextAlign || globalAlign,
    };

    return (
        <div
            className={`absolute overflow-visible transition-all duration-500 ${isActive ? 'z-50' : 'z-10'}`}
            onClick={(e) => {
                if (isBodyPart) {
                    e.stopPropagation();
                    onClick();
                }
            }}
        >
            {/* 核心锚点圆点：归属于 body 层 */}
            {isBodyPart && (
                <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                    {/* 语义化扩散光圈 — 仅 breakthrough 和 milestone 显示 */}
                    {(event.type === 'breakthrough' || event.type === 'milestone') && (
                        <div className={`absolute rounded-full opacity-20 ${config.pulse}`} style={{ width: `${dotSz * 2}px`, height: `${dotSz * 2}px`, ...dotColorStyle }}></div>
                    )}
                    {/* 实体圆点/形状 */}
                    <div
                        className={`border-4 border-white shadow-xl transition-all duration-300 ${config.color} ${isActive ? `scale-125 ${config.glow}` : 'group-hover:scale-110'}`}
                        style={{
                            width: `${dotSz}px`,
                            height: `${dotSz}px`,
                            borderRadius: dotBorderRadius,
                            transform: dotTransform,
                            ...(dotColorStyle || {})
                        }}
                    ></div>
                    {/* 语义图标覆层 — breakthrough 类型 */}
                    {event.type === 'breakthrough' && (
                        <div className="absolute -top-3 -right-3 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white transform rotate-12 animate-bounce" style={{ animationDuration: '2s', animationIterationCount: 3 }}>
                            <i className="fa-solid fa-bolt text-[7px] text-white"></i>
                        </div>
                    )}
                </div>
            )}

            {/* 内容支架：包含连接线和气泡 */}
            <div
                className={`absolute left-0 flex flex-col items-center -translate-x-1/2 pointer-events-none ${isTop ? 'bottom-2 flex-col-reverse' : 'top-2 flex-col'
                    }`}
                style={{ width: `${bWidth}px` }}
            >
                {/* 垂直连接线 - 归属于 line 层 */}
                {isLinePart ? (
                    <div
                        className={`transition-all duration-300 ${lineColorClass}`}
                        style={{
                            height: `${lineH}px`,
                            width: 0,
                            borderLeftWidth: `${lineW}px`,
                            borderLeftStyle: lineStyleStr as any,
                            borderLeftColor: event.color || undefined
                        }}
                    ></div>
                ) : (
                    // 占位空间，确保 Body 层布局与 Line 层完全同步
                    <div style={{ height: `${lineH}px` }} className="w-0.5"></div>
                )}

                {/* 气泡内容 - 归属于 body 层 */}
                {isBodyPart && (
                    <div
                        className={`w-full p-4 rounded-3xl border-2 transition-all shadow-xl pointer-events-auto ${glassClass} ${isActive
                            ? 'bg-white border-indigo-500 scale-105 ring-4 ring-indigo-50'
                            : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-2xl'
                            }`}
                        style={bubbleStyle}
                    >
                        {/* 节点图片展示区 */}
                        {event.mediaUrl && (
                            <div className="mb-3 rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 aspect-video flex items-center justify-center group/img relative">
                                <img src={event.mediaUrl} alt={event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                            </div>
                        )}

                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-indigo-600 italic font-mono" style={dateStyleObj}>{event.date}</span>
                            <div className="flex gap-1.5 items-center">
                                <span className={`px-2 py-0.5 rounded-full text-[7px] font-black text-white uppercase ${config.color}`} style={dotColorStyle}>
                                    <i className={`fa-solid ${config.icon} mr-0.5 text-[6px]`}></i> {typeLabel}
                                </span>
                                {isActive && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                        className="w-5 h-5 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                        title="删除节点"
                                    >
                                        <i className="fa-solid fa-trash-can text-[8px]"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {isActive ? (
                            <div className="space-y-2 animate-reveal">
                                <input
                                    className="w-full bg-slate-50 border-none text-[11px] font-black uppercase outline-none px-1 py-0.5 focus:ring-1 focus:ring-indigo-100 rounded"
                                    style={titleStyleObj}
                                    value={event.title}
                                    onChange={e => onUpdate({ title: e.target.value })}
                                />
                                <textarea
                                    className="w-full bg-slate-50 border-none text-[10px] font-medium leading-relaxed outline-none px-1 py-0.5 focus:ring-1 focus:ring-indigo-100 rounded resize-none min-h-[80px]"
                                    style={descStyleObj}
                                    value={event.description}
                                    onChange={e => onUpdate({ description: e.target.value })}
                                />
                            </div>
                        ) : (
                            <>
                                <h4 className="text-[11px] font-black text-slate-800 leading-snug mb-1 break-words" style={titleStyleObj}>{event.title}</h4>
                                <p className="text-[9px] text-slate-500 leading-relaxed whitespace-pre-wrap break-words" style={descStyleObj}>{event.description}</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};