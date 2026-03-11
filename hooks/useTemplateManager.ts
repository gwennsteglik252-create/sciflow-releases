// ============================================
// 科研绘图中心 — 通用模板管理 Hook
// 提供 CRUD + 持久化 + 预设模板
// ============================================

import { useState, useCallback, useEffect } from 'react';
import {
    FigureTemplate,
    TemplateModule,
    StructuralStyle,
    TimelineStyle,
    SummaryStyle,
    AssemblyStyle,
    StructuralTemplate,
    TimelineTemplate,
} from '../types/templates';
import {
    DiagramGroup,
    DiagramNode,
    Connection,
    GroupConfig,
    TextConfig,
} from '../components/FigureCenter/Structure/types';
import { TimelineData, TimelineEvent } from '../types/visuals';

// ============================================
// 存储 Key 生成
// ============================================
const getStorageKey = (module: TemplateModule) => `sciflow_templates_${module}`;

// ============================================
// 结构图：提取模板
// ============================================
export function extractStructuralTemplate(
    data: { groups: DiagramGroup[]; connections: Connection[] },
    spacingConfig?: { nodeGap: number; groupPaddingX: number }
): StructuralStyle {
    const firstGroup = data.groups?.[0];
    const firstNode = firstGroup?.nodes?.[0];
    const firstConn = data.connections?.[0];

    return {
        globalTextConfig: firstNode?.textConfig ? { ...firstNode.textConfig } : undefined,
        globalSubTextConfig: firstNode?.subTextConfig ? { ...firstNode.subTextConfig } : undefined,
        globalParamsConfig: firstNode?.paramsConfig ? { ...firstNode.paramsConfig } : undefined,
        groupConfig: firstGroup?.config ? { ...firstGroup.config } : undefined,
        connectionStyle: firstConn
            ? {
                color: firstConn.color,
                style: firstConn.style,
                width: firstConn.width,
                arrowSize: firstConn.arrowSize,
                arrowType: firstConn.arrowType,
                arrowShape: firstConn.arrowShape,
                labelFontSize: firstConn.labelFontSize,
                labelConfig: firstConn.labelConfig ? { ...firstConn.labelConfig } : undefined,
                boxConfig: firstConn.boxConfig ? { ...firstConn.boxConfig } : undefined,
            }
            : undefined,
        colorPalette: data.groups
            ?.map((g) => g.colorTheme)
            .filter((c): c is string => !!c),
        spacingConfig: spacingConfig ? { ...spacingConfig } : undefined,
    };
}

// ============================================
// 结构图：应用模板（保留内容，仅覆盖视觉属性）
// ============================================
export function applyStructuralTemplate(
    data: { groups: DiagramGroup[]; connections: Connection[] },
    template: StructuralStyle
): { groups: DiagramGroup[]; connections: Connection[] } {
    const newData = JSON.parse(JSON.stringify(data));

    // 应用到每个组
    newData.groups = newData.groups.map((g: DiagramGroup, gIdx: number) => {
        // 色板
        if (template.colorPalette && template.colorPalette.length > 0) {
            g.colorTheme = template.colorPalette[gIdx % template.colorPalette.length];

            // 同步组容器颜色（使用色板颜色）
            if (!g.config) g.config = {};
            g.config.titleBgColor = g.colorTheme;

            // 根据颜色亮度自动选择标题文字颜色
            const hex = g.colorTheme;
            if (hex?.startsWith('#')) {
                const r = parseInt(hex.slice(1, 3), 16);
                const gVal = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                const luminance = (0.299 * r + 0.587 * gVal + 0.114 * b) / 255;
                g.config.titleTextColor = luminance > 0.55 ? '#1e293b' : '#ffffff';
            }

            g.config.backgroundColor = g.colorTheme;
            g.config.fillOpacity = 0.08;
        }

        // 组布局配置（仅应用有值的字段）
        if (template.groupConfig) {
            if (!g.config) g.config = {};
            const tc = template.groupConfig;
            if (tc.titleSize !== undefined) g.config.titleSize = tc.titleSize;
            if (tc.titleFontWeight !== undefined) g.config.titleFontWeight = tc.titleFontWeight;
            if (tc.titleFontStyle !== undefined) g.config.titleFontStyle = tc.titleFontStyle;
            if (tc.titleFontFamily !== undefined) g.config.titleFontFamily = tc.titleFontFamily;
            if (tc.borderWidth !== undefined) g.config.borderWidth = tc.borderWidth;
            if (tc.padding !== undefined) g.config.padding = tc.padding;
            if (tc.gap !== undefined) g.config.gap = tc.gap;
            if (tc.titlePaddingX !== undefined) g.config.titlePaddingX = tc.titlePaddingX;
            if (tc.titlePaddingY !== undefined) g.config.titlePaddingY = tc.titlePaddingY;
        }

        // 节点排版
        g.nodes = g.nodes.map((n: DiagramNode) => {
            if (template.globalTextConfig) {
                n.textConfig = { ...(n.textConfig || {}), ...template.globalTextConfig };
            }
            if (template.globalSubTextConfig) {
                n.subTextConfig = { ...(n.subTextConfig || {}), ...template.globalSubTextConfig };
            }
            if (template.globalParamsConfig) {
                n.paramsConfig = { ...(n.paramsConfig || {}), ...template.globalParamsConfig };
            }
            // 继承组色
            if (template.colorPalette && template.colorPalette.length > 0) {
                n.customColor = g.colorTheme;
            }
            return n;
        });

        return g;
    });

    // 应用连线样式
    if (template.connectionStyle) {
        const cs = template.connectionStyle;
        newData.connections = newData.connections.map((c: Connection) => ({
            ...c,
            ...(cs.color !== undefined && { color: cs.color }),
            ...(cs.style !== undefined && { style: cs.style }),
            ...(cs.width !== undefined && { width: cs.width }),
            ...(cs.arrowSize !== undefined && { arrowSize: cs.arrowSize }),
            ...(cs.arrowType !== undefined && { arrowType: cs.arrowType }),
            ...(cs.arrowShape !== undefined && { arrowShape: cs.arrowShape }),
            ...(cs.labelFontSize !== undefined && { labelFontSize: cs.labelFontSize }),
            ...(cs.labelConfig && { labelConfig: { ...(c.labelConfig || {}), ...cs.labelConfig } }),
            ...(cs.boxConfig && { boxConfig: { ...(c.boxConfig || {}), ...cs.boxConfig } }),
        }));
    }

    return newData;
}

// ============================================
// 演进：提取模板
// ============================================
export function extractTimelineTemplate(data: TimelineData): TimelineStyle {
    // 从第一个事件中提取气泡样式作为默认
    const firstEvent = data.events?.[0];

    return {
        pathType: data.pathType,
        axisWidth: data.axisWidth,
        arrowWidth: data.arrowWidth,
        glowIntensity: data.glowIntensity,
        axisColor: data.axisColor,
        gradientPreset: data.gradientPreset,
        arrowStyle: data.arrowStyle,
        showArrow: data.showArrow,
        isHollow: data.isHollow,
        distributionMode: data.distributionMode,
        defaultBubbleConfig: firstEvent?.bubbleConfig
            ? { ...firstEvent.bubbleConfig }
            : undefined,
    };
}

// ============================================
// 演进：应用模板
// ============================================
export function applyTimelineTemplate(
    data: TimelineData,
    template: TimelineStyle
): TimelineData {
    const newData = JSON.parse(JSON.stringify(data)) as TimelineData;

    if (template.pathType !== undefined) newData.pathType = template.pathType;
    if (template.axisWidth !== undefined) newData.axisWidth = template.axisWidth;
    if (template.arrowWidth !== undefined) newData.arrowWidth = template.arrowWidth;
    if (template.glowIntensity !== undefined) newData.glowIntensity = template.glowIntensity;
    if (template.axisColor !== undefined) newData.axisColor = template.axisColor;
    if (template.gradientPreset !== undefined) newData.gradientPreset = template.gradientPreset;
    if (template.arrowStyle !== undefined) newData.arrowStyle = template.arrowStyle as any;
    if (template.showArrow !== undefined) newData.showArrow = template.showArrow;
    if (template.isHollow !== undefined) newData.isHollow = template.isHollow;
    if (template.distributionMode !== undefined) newData.distributionMode = template.distributionMode;

    // 应用默认气泡样式到所有事件
    if (template.defaultBubbleConfig) {
        newData.events = newData.events.map((ev) => ({
            ...ev,
            bubbleConfig: { ...(ev.bubbleConfig || {}), ...template.defaultBubbleConfig },
        }));
    }

    return newData;
}

// ============================================
// 综述：提取模板
// ============================================
export function extractSummaryTemplate(data: any): SummaryStyle {
    const firstLayer = data?.layers?.[0];
    return {
        layerConfig: firstLayer?.config ? { ...firstLayer.config } : undefined,
        colorPalette: data?.layers
            ?.flatMap((l: any) => l.segments?.map((s: any) => s.color))
            .filter((c: string | undefined): c is string => !!c)
            .filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i), // unique
        coreColor: data?.coreColor,
    };
}

// ============================================
// 综述：应用模板
// ============================================
export function applySummaryTemplate(data: any, template: SummaryStyle): any {
    const newData = JSON.parse(JSON.stringify(data));

    // 层级配置
    if (template.layerConfig) {
        newData.layers = newData.layers.map((l: any) => ({
            ...l,
            config: { ...(l.config || {}), ...template.layerConfig },
        }));
    }

    // 色板
    if (template.colorPalette && template.colorPalette.length > 0) {
        let colorIdx = 0;
        newData.layers = newData.layers.map((l: any) => ({
            ...l,
            segments: l.segments.map((s: any) => {
                const color = template.colorPalette![colorIdx % template.colorPalette!.length];
                colorIdx++;
                return { ...s, color };
            }),
        }));
    }

    // 核心色
    if (template.coreColor) {
        newData.coreColor = template.coreColor;
    }

    return newData;
}

// ============================================
// 内置预设模板
// ============================================
const PRESET_STRUCTURAL_TEMPLATES: StructuralTemplate[] = [
    {
        id: 'preset_nature',
        name: 'Nature 经典',
        module: 'structural',
        timestamp: '',
        isPreset: true,
        styleData: {
            globalTextConfig: { fontSize: 13, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' },
            globalSubTextConfig: { fontSize: 10, fontWeight: 'normal', fontStyle: 'italic', fontFamily: 'Arial, sans-serif' },
            globalParamsConfig: { fontSize: 9, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', color: '#64748b' },
            groupConfig: { titleSize: 13, titleFontWeight: 'bold', borderWidth: 2, fillOpacity: 0.06, titlePaddingX: 12, titlePaddingY: 4 },
            connectionStyle: {
                width: 2, arrowSize: 8, style: 'solid',
                labelConfig: { fontSize: 10, fontWeight: 'bold', color: '#C0392B' },
                boxConfig: { backgroundColor: 'transparent', borderWidth: 0 },
            },
            colorPalette: ['#2166AC', '#67A9CF', '#EF8A62', '#B2182B', '#4393C3'],
        },
    },
    {
        id: 'preset_minimalist',
        name: '极简灰调',
        module: 'structural',
        timestamp: '',
        isPreset: true,
        styleData: {
            globalTextConfig: { fontSize: 12, fontWeight: '600', fontFamily: '"Inter", sans-serif', color: '#1e293b' },
            globalSubTextConfig: { fontSize: 10, fontWeight: 'normal', fontFamily: '"Inter", sans-serif', color: '#64748b' },
            globalParamsConfig: { fontSize: 9, fontWeight: 'normal', fontFamily: '"Inter", sans-serif', color: '#94a3b8' },
            groupConfig: { titleSize: 12, titleFontWeight: '600', borderWidth: 1, fillOpacity: 0.04, titlePaddingX: 10, titlePaddingY: 3 },
            connectionStyle: {
                width: 1.5, arrowSize: 6, style: 'solid', color: '#94a3b8',
                labelConfig: { fontSize: 9, fontWeight: '500', color: '#64748b' },
                boxConfig: { backgroundColor: 'transparent', borderWidth: 0 },
            },
            colorPalette: ['#212121', '#424242', '#757575', '#BDBDBD', '#37474F'],
        },
    },
    {
        id: 'preset_warm',
        name: '暖色学术',
        module: 'structural',
        timestamp: '',
        isPreset: true,
        styleData: {
            globalTextConfig: { fontSize: 13, fontWeight: 'bold', fontFamily: '"Roboto", sans-serif' },
            globalSubTextConfig: { fontSize: 10, fontWeight: 'normal', fontFamily: '"Roboto", sans-serif' },
            globalParamsConfig: { fontSize: 9, fontWeight: 'normal', fontFamily: '"Roboto", sans-serif' },
            groupConfig: { titleSize: 13, titleFontWeight: 'bold', borderWidth: 2, fillOpacity: 0.08 },
            connectionStyle: {
                width: 2, arrowSize: 8,
                labelConfig: { fontSize: 10, fontWeight: 'bold', color: '#E65100' },
                boxConfig: { backgroundColor: 'transparent', borderWidth: 0 },
            },
            colorPalette: ['#D35400', '#C0392B', '#8E44AD', '#27AE60', '#2980B9'],
        },
    },
];

const PRESET_TIMELINE_TEMPLATES: TimelineTemplate[] = [
    {
        id: 'preset_tl_classic',
        name: '经典蓝紫',
        module: 'timeline',
        timestamp: '',
        isPreset: true,
        styleData: {
            pathType: 'straight',
            axisWidth: 4,
            arrowWidth: 4,
            glowIntensity: 5,
            axisColor: '#6366f1',
            gradientPreset: 'rainbow',
            arrowStyle: 'classic',
            showArrow: true,
            isHollow: true,
            distributionMode: 'proportional',
        },
    },
    {
        id: 'preset_tl_minimal',
        name: '极简细线',
        module: 'timeline',
        timestamp: '',
        isPreset: true,
        styleData: {
            pathType: 'straight',
            axisWidth: 2,
            arrowWidth: 3,
            glowIntensity: 0,
            axisColor: '#94a3b8',
            arrowStyle: 'open',
            showArrow: true,
            isHollow: false,
            distributionMode: 'equal',
        },
    },
];

function getPresets(module: TemplateModule): FigureTemplate[] {
    switch (module) {
        case 'structural':
            return PRESET_STRUCTURAL_TEMPLATES;
        case 'timeline':
            return PRESET_TIMELINE_TEMPLATES;
        default:
            return [];
    }
}

// ============================================
// 通用模板管理 Hook
// ============================================
export function useTemplateManager(module: TemplateModule) {
    const storageKey = getStorageKey(module);
    const presets = getPresets(module);

    // 用户自定义模板
    const [userTemplates, setUserTemplates] = useState<FigureTemplate[]>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // 持久化
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(userTemplates));
    }, [userTemplates, storageKey]);

    // 所有模板 = 预设 + 用户
    const allTemplates = [...presets, ...userTemplates];

    // 保存新模板
    const saveTemplate = useCallback(
        (name: string, styleData: any) => {
            const newTemplate: FigureTemplate = {
                id: `tpl_${Date.now()}`,
                name,
                module,
                timestamp: new Date().toLocaleString(),
                styleData: JSON.parse(JSON.stringify(styleData)),
            };
            setUserTemplates((prev) => [newTemplate, ...prev]);
            return newTemplate;
        },
        [module]
    );

    // 删除模板（仅用户模板）
    const deleteTemplate = useCallback((id: string) => {
        setUserTemplates((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // 重命名模板
    const renameTemplate = useCallback((id: string, newName: string) => {
        setUserTemplates((prev) =>
            prev.map((t) => (t.id === id ? { ...t, name: newName } : t))
        );
    }, []);

    // UI 控制
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [templateName, setTemplateName] = useState('');

    return {
        allTemplates,
        userTemplates,
        presets,
        saveTemplate,
        deleteTemplate,
        renameTemplate,
        showTemplateModal,
        setShowTemplateModal,
        showSaveTemplateModal,
        setShowSaveTemplateModal,
        templateName,
        setTemplateName,
    };
}
