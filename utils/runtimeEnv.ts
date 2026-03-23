
/**
 * runtimeEnv.ts
 * 检测当前运行环境，区分 Builder 预览与 Electron 真实环境。
 */

/**
 * 是否应使用 Mock 数据
 * 在 Builder 预览模式下通常需要 Mock 数据，在 Electron 中使用真实数据。
 */
export const useMockData = (): boolean => {
    // 简单的启发式检测：如果在 Electron 中，通常会有 process 核心模块
    if (typeof window !== 'undefined' && window.electron) {
        return false;
    }

    // 如果在普通的 Web 环境预览（如 Builder），则可能需要 Mock
    // 这里可以根据实际需要扩展逻辑
    return false;
};
