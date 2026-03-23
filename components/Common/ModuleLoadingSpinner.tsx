/**
 * ModuleLoadingSpinner — 模块懒加载时的占位 UI
 *
 * 在 React.lazy + Suspense 加载模块时显示。
 * 设计风格与 ProjectProvider 的 Hydrating 加载画面一致。
 */
import React from 'react';

interface Props {
    module?: string;
}

const ModuleLoadingSpinner: React.FC<Props> = ({ module }) => (
    <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl border-2 border-indigo-500 border-t-transparent animate-spin"></div>
            {module && (
                <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-widest animate-pulse">
                    Loading {module}…
                </p>
            )}
        </div>
    </div>
);

export default ModuleLoadingSpinner;
