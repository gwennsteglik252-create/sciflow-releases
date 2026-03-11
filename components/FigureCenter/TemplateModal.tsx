// ============================================
// 科研绘图中心 — 样式模板管理弹窗
// 展示预设模板 + 用户模板，提供应用/保存/删除
// ============================================

import React, { useState } from 'react';
import { FigureTemplate, TemplateModule } from '../../types/templates';

interface TemplateModalProps {
    // 模板浏览与应用
    showTemplateModal: boolean;
    setShowTemplateModal: (v: boolean) => void;
    presets: FigureTemplate[];
    userTemplates: FigureTemplate[];
    onApplyTemplate: (template: FigureTemplate) => void;
    onDeleteTemplate: (id: string) => void;
    onRenameTemplate: (id: string, newName: string) => void;
    onSaveCurrentAsTemplate: () => void;

    // 保存模板
    showSaveModal: boolean;
    setShowSaveModal: (v: boolean) => void;
    templateName: string;
    setTemplateName: (v: string) => void;
    onConfirmSave: () => void;

    module: TemplateModule;
}

const MODULE_LABELS: Record<TemplateModule, string> = {
    structural: '结构图',
    timeline: '演进',
    summary: '综述',
    assembly: '拼版',
};

const MODULE_ICONS: Record<TemplateModule, string> = {
    structural: 'fa-diagram-project',
    timeline: 'fa-timeline',
    summary: 'fa-circle-nodes',
    assembly: 'fa-table-cells-large',
};

// 渲染色板预览（独立函数，不依赖组件状态）
function renderColorPreview(template: FigureTemplate) {
    const colors: string[] = [];

    if (template.styleData?.colorPalette) {
        colors.push(...template.styleData.colorPalette.slice(0, 6));
    } else if (template.styleData?.axisColor) {
        colors.push(template.styleData.axisColor);
    } else if (template.styleData?.coreColor) {
        colors.push(template.styleData.coreColor);
    }

    if (colors.length === 0) return null;

    return (
        <div className="flex -space-x-1 mt-2">
            {colors.map((c, i) => (
                <div
                    key={i}
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm ring-1 ring-black/5"
                    style={{ backgroundColor: c }}
                />
            ))}
        </div>
    );
}

// 渲染样式摘要标签
function renderStyleTags(template: FigureTemplate, module: TemplateModule) {
    const tags: string[] = [];
    const sd = template.styleData;

    if (module === 'structural') {
        if (sd?.globalTextConfig?.fontFamily) {
            const font = sd.globalTextConfig.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            tags.push(font);
        }
        if (sd?.connectionStyle?.style) tags.push(sd.connectionStyle.style);
        if (sd?.groupConfig?.borderWidth) tags.push(`边框 ${sd.groupConfig.borderWidth}px`);
    } else if (module === 'timeline') {
        if (sd?.pathType) tags.push(sd.pathType);
        if (sd?.isHollow !== undefined) tags.push(sd.isHollow ? '空心' : '实心');
        if (sd?.arrowStyle) tags.push(sd.arrowStyle);
    }

    if (tags.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-white/80 rounded text-[7px] font-bold text-slate-400 uppercase border border-slate-100">
                    {tag}
                </span>
            ))}
        </div>
    );
}

// ============================================
// 独立的 TemplateCard 组件（不在渲染函数内定义）
// ============================================
const TemplateCard: React.FC<{
    template: FigureTemplate;
    canDelete: boolean;
    module: TemplateModule;
    onApply: (template: FigureTemplate) => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newName: string) => void;
}> = React.memo(({ template, canDelete, module, onApply, onDelete, onRename }) => {
    const [isRenaming, setIsRenaming] = useState(false);
    const [editName, setEditName] = useState(template.name);

    const handleStartRename = () => {
        setEditName(template.name);
        setIsRenaming(true);
    };

    const handleConfirmRename = () => {
        if (editName.trim() && editName !== template.name) {
            onRename(template.id, editName);
        }
        setIsRenaming(false);
    };

    return (
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-300 hover:shadow-md transition-all relative">
            {/* 预设标签 */}
            {template.isPreset && (
                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[6px] font-black uppercase rounded-full shadow-sm tracking-wider">
                    预设
                </div>
            )}

            <div className="flex items-start justify-between">
                {/* 左侧：模板信息 */}
                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <input
                            className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black outline-none"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleConfirmRename}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename();
                                if (e.key === 'Escape') setIsRenaming(false);
                            }}
                            autoFocus
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate">{template.name}</p>
                            {canDelete && (
                                <button
                                    type="button"
                                    onClick={handleStartRename}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all shrink-0"
                                >
                                    <i className="fa-solid fa-pen-to-square text-[9px]" />
                                </button>
                            )}
                        </div>
                    )}

                    {template.timestamp && (
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{template.timestamp}</p>
                    )}

                    {renderStyleTags(template, module)}
                    {renderColorPreview(template)}
                </div>

                {/* 右侧：操作按钮（独立按钮，不依赖事件冒泡） */}
                <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => onApply(template)}
                        className="h-7 px-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-[9px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                    >
                        应用
                    </button>
                    {canDelete && (
                        <button
                            type="button"
                            onClick={() => onDelete(template.id)}
                            className="w-7 h-7 rounded-lg bg-white text-rose-300 hover:text-rose-500 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 transition-all flex items-center justify-center active:scale-95"
                        >
                            <i className="fa-solid fa-trash-can text-[9px]" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

// ============================================
// 主弹窗组件
// ============================================
export const TemplateModal: React.FC<TemplateModalProps> = ({
    showTemplateModal, setShowTemplateModal,
    presets, userTemplates,
    onApplyTemplate, onDeleteTemplate, onRenameTemplate,
    onSaveCurrentAsTemplate,
    showSaveModal, setShowSaveModal,
    templateName, setTemplateName, onConfirmSave,
    module,
}) => {
    const moduleLabel = MODULE_LABELS[module];
    const moduleIcon = MODULE_ICONS[module];

    // 应用模板后关闭弹窗
    const handleApplyAndClose = React.useCallback((template: FigureTemplate) => {
        onApplyTemplate(template);
        setShowTemplateModal(false);
    }, [onApplyTemplate, setShowTemplateModal]);

    // 删除模板（不关闭弹窗）
    const handleDelete = React.useCallback((id: string) => {
        onDeleteTemplate(id);
    }, [onDeleteTemplate]);

    return (
        <>
            {/* ==================== 模板库弹窗 ==================== */}
            {showTemplateModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        {/* 标题 */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <i className={`fa-solid ${moduleIcon} text-lg`} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-tight leading-none">
                                        {moduleLabel}样式模板
                                    </h3>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        STYLE TEMPLATES
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onSaveCurrentAsTemplate}
                                className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-indigo-500/30 flex items-center gap-1.5 hover:bg-indigo-700 transition-all active:scale-95 border border-indigo-400/50"
                            >
                                <i className="fa-solid fa-plus" />
                                保存当前样式
                            </button>
                        </div>

                        {/* 模板列表 */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5">
                            {/* 用户模板 */}
                            {userTemplates.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3 px-1">
                                        <i className="fa-solid fa-user text-[9px] text-slate-300" />
                                        我的模板
                                    </label>
                                    <div className="space-y-2">
                                        {userTemplates.map((t) => (
                                            <TemplateCard
                                                key={t.id}
                                                template={t}
                                                canDelete
                                                module={module}
                                                onApply={handleApplyAndClose}
                                                onDelete={handleDelete}
                                                onRename={onRenameTemplate}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 预设模板 */}
                            {presets.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3 px-1">
                                        <i className="fa-solid fa-crown text-[9px] text-amber-400" />
                                        预设模板
                                    </label>
                                    <div className="space-y-2">
                                        {presets.map((t) => (
                                            <TemplateCard
                                                key={t.id}
                                                template={t}
                                                canDelete={false}
                                                module={module}
                                                onApply={handleApplyAndClose}
                                                onDelete={handleDelete}
                                                onRename={onRenameTemplate}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 空状态 */}
                            {userTemplates.length === 0 && presets.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <i className="fa-solid fa-swatchbook text-2xl text-slate-300" />
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-bold">暂无样式模板</p>
                                    <p className="text-[9px] text-slate-300 mt-1">点击「保存当前样式」创建你的第一个模板</p>
                                </div>
                            )}
                        </div>

                        {/* 关闭 */}
                        <button
                            onClick={() => setShowTemplateModal(false)}
                            className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}

            {/* ==================== 保存模板弹窗 ==================== */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                                <i className="fa-solid fa-swatchbook text-sm" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 uppercase italic">保存样式模板</h3>
                        </div>

                        <p className="text-[10px] text-slate-400 font-bold mb-3">
                            将当前{moduleLabel}的视觉样式（颜色、字体、间距、连线等）保存为可复用模板
                        </p>

                        <input
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-6 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="输入模板名称 (如: 我的 Nature 风格)..."
                            autoFocus
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                            >
                                取消
                            </button>
                            <button
                                onClick={onConfirmSave}
                                disabled={!templateName.trim()}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <i className="fa-solid fa-check" />
                                确认保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
