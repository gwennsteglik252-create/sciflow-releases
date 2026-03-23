/**
 * UIContext — UI 交互状态管理
 *
 * 从 ProjectContext 中拆分出高频变化的 UI 状态，
 * 避免 toast/modals 变更触发全组件树重渲染。
 *
 * 包含：
 * - Toast 通知
 * - 弹窗控制 (modals)
 * - AI CLI
 * - 语音模式
 * - 搜索
 */
import React, { createContext, useContext, useMemo } from 'react';
import type { ToastConfig, AiCliCommand } from '../types';

// ── 类型定义 ──

export interface UIModals {
    addProject: boolean;
    account: boolean;
    settings: boolean;
    confirm: any;
}

export interface UIContextType {
    // Toast
    toast: ToastConfig | null;
    showToast: (config: ToastConfig) => void;
    hideToast: () => void;

    // Modals
    modals: UIModals;
    setModalOpen: (key: string, value: any) => void;

    // AI CLI
    isAiCliOpen: boolean;
    setIsAiCliOpen: (val: boolean) => void;
    aiCliHistory: AiCliCommand[];
    setAiCliHistory: React.Dispatch<React.SetStateAction<AiCliCommand[]>>;

    // Voice
    isVoiceMode: boolean;
    setIsVoiceMode: (val: boolean) => void;

    // Search
    searchQuery: string;
    setSearchQuery: (q: string) => void;

    // AI status
    aiStatus: string | null;
    setAiStatus: (status: string | null) => void;
}

// ── Context 创建 ──

export const UIContext = createContext<UIContextType | undefined>(undefined);

/**
 * useUIContext — 消费 UI 交互状态
 *
 * 推荐在只需要 UI 状态（toast/modals/search）的组件中使用此 hook，
 * 这样 projects/resources 等业务数据变化时不会触发该组件重渲染。
 *
 * 兼容说明：ProjectContext 仍然暴露了所有字段，
 * 旧代码通过 useProjectContext() 访问这些字段仍然正常工作。
 */
export const useUIContext = (): UIContextType => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUIContext must be used within UIProvider');
    }
    return context;
};
