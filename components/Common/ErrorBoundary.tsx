/**
 * ErrorBoundary — 通用错误边界组件
 *
 * 捕获子组件树中的渲染错误，显示友好的错误回退界面，
 * 而不是让整个应用崩溃为白屏。
 *
 * 使用方式：
 *   <ErrorBoundary module="XRD 分析">
 *     <XrdPhasePanel />
 *   </ErrorBoundary>
 */
import React, { Component, ErrorInfo } from 'react';


interface ErrorBoundaryProps {
    children: React.ReactNode;
    /** 模块名称，用于展示在错误界面上 */
    module?: string;
    /** 自定义回退 UI */
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        console.error(`[ErrorBoundary] ${this.props.module || 'Unknown'} 模块崩溃:`, error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const moduleName = this.props.module || '未知模块';

            return (
                <div className="flex items-center justify-center h-full min-h-[300px] p-8">
                    <div className="max-w-lg w-full text-center space-y-6">
                        {/* 图标 */}
                        <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center">
                            <i className="fa-solid fa-triangle-exclamation text-3xl text-rose-400"></i>
                        </div>

                        {/* 标题 */}
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-wider mb-2" style={{ color: 'var(--error-title, #e2e8f0)' }}>
                                {moduleName} 遇到了问题
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--error-desc, #94a3b8)' }}>
                                该模块在渲染时发生了错误，但不会影响其他功能。<br />
                                你可以尝试重新加载此模块，或切换到其他页面。
                            </p>
                        </div>

                        {/* 错误信息（可折叠） */}
                        {this.state.error && (
                            <details className="text-left rounded-xl border p-4 cursor-pointer" style={{ background: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.2)' }}>
                                <summary className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#64748b' }}>
                                    技术详情
                                </summary>
                                <pre className="mt-3 text-[10px] font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto" style={{ color: '#f87171' }}>
                                    {this.state.error.message}
                                    {this.state.errorInfo?.componentStack && (
                                        <>
                                            {'\n\n--- Component Stack ---\n'}
                                            {this.state.errorInfo.componentStack}
                                        </>
                                    )}
                                </pre>
                            </details>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-500 transition-all active:scale-95 shadow-lg"
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i>
                                重新加载
                            </button>
                            <button
                                onClick={() => { window.location.hash = '#dashboard'; this.handleReset(); }}
                                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 border shadow-md cursor-pointer"
                                style={{ background: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.25)', color: '#475569' }}
                            >
                                <i className="fa-solid fa-house mr-2"></i>
                                返回首页
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
