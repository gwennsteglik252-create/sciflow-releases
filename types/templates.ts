// ============================================
// 科研绘图中心 — 样式模板类型定义
// Template = 样式配置快照，与内容数据完全解耦
// ============================================

import { TextConfig, GroupConfig, Connection } from '../components/FigureCenter/Structure/types';

// --- 通用模板容器 ---
export type TemplateModule = 'structural' | 'timeline' | 'summary' | 'assembly';

export interface FigureTemplate<T = any> {
    id: string;
    name: string;
    module: TemplateModule;
    timestamp: string;
    isPreset?: boolean;        // 是否为内置预设模板（不可删除）
    styleData: T;
}

// --- 结构图模板样式 ---
export interface StructuralStyle {
    // 节点排版
    globalTextConfig?: TextConfig;
    globalSubTextConfig?: TextConfig;
    globalParamsConfig?: TextConfig;
    // 组通用布局
    groupConfig?: GroupConfig;
    // 连线默认样式
    connectionStyle?: {
        color?: string;
        style?: 'solid' | 'dashed' | 'dotted';
        width?: number;
        arrowSize?: number;
        arrowType?: string;
        arrowShape?: string;
        labelFontSize?: number;
        labelConfig?: TextConfig;
        boxConfig?: TextConfig;
    };
    // 色板
    colorPalette?: string[];
    // 间距
    spacingConfig?: {
        nodeGap: number;
        groupPaddingX: number;
    };
}

// --- 演进模板样式 ---
export interface TimelineStyle {
    pathType?: 'straight' | 'wave' | 'stepped' | 'scurve' | 'zigzag';
    axisWidth?: number;
    arrowWidth?: number;
    glowIntensity?: number;
    axisColor?: string;
    gradientPreset?: string;
    arrowStyle?: string;
    showArrow?: boolean;
    isHollow?: boolean;
    distributionMode?: 'proportional' | 'equal';
    defaultBubbleConfig?: {
        bgColor?: string;
        borderColor?: string;
        borderWidth?: number;
        borderRadius?: number;
        opacity?: number;
        glassEffect?: boolean;
        titleFontSize?: number;
        descFontSize?: number;
    };
}

// --- 综述模板样式 ---
export interface SummaryStyle {
    layerConfig?: any;       // LayerConfig
    colorPalette?: string[];
    coreColor?: string;
}

// --- 拼版模板样式 ---
export interface AssemblyStyle {
    labelFontSize?: number;
    labelFontFamily?: string;
    labelFontWeight?: string;
    labelPadding?: number;
}

// 类型别名
export type StructuralTemplate = FigureTemplate<StructuralStyle>;
export type TimelineTemplate = FigureTemplate<TimelineStyle>;
export type SummaryTemplate = FigureTemplate<SummaryStyle>;
export type AssemblyTemplate = FigureTemplate<AssemblyStyle>;
