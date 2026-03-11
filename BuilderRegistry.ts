/**
 * Builder 自定义组件注册表
 * 用于与 Gemini AI Studio Builder 代码同步：在 Builder 预览中渲染已注册组件（可配 Mock 数据），在 Electron 中使用真实数据。
 */

import React from 'react';
import { useMockData } from './utils/runtimeEnv';

export interface BuilderRegistryEntry<P = Record<string, unknown>> {
  /** 组件 */
  Component: React.ComponentType<P>;
  /** Builder 预览模式下返回的 Mock props；不提供则使用 defaultProps 或空对象 */
  getMockProps?: () => P;
  /** 展示名称（用于预览页列表） */
  displayName?: string;
}

const registry = new Map<string, BuilderRegistryEntry>();

/**
 * 注册一个可在 Builder 预览中使用的自定义组件
 * @param id 唯一标识，如 'AgentWorker'
 * @param entry 组件与可选的 Mock 数据工厂
 */
export function registerBuilderComponent<P = Record<string, unknown>>(
  id: string,
  entry: BuilderRegistryEntry<P>
): void {
  registry.set(id, entry as BuilderRegistryEntry);
}

/**
 * 根据 id 获取已注册的组件配置
 */
export function getBuilderComponent(id: string): BuilderRegistryEntry | undefined {
  return registry.get(id);
}

/**
 * 获取所有已注册的组件 id 列表
 */
export function getRegisteredBuilderIds(): string[] {
  return Array.from(registry.keys());
}

/**
 * 根据 id 渲染已注册组件
 * 在 Builder 预览模式下使用 getMockProps()，否则使用传入的 props
 */
export function renderBuilderComponent<P extends Record<string, unknown>>(
  id: string,
  props: P
): React.ReactElement | null {
  const entry = registry.get(id);
  if (!entry) return null;
  const { Component, getMockProps } = entry;
  const useMock = useMockData();
  const resolvedProps = (useMock && getMockProps ? getMockProps() : props) as P;
  return React.createElement(Component, resolvedProps);
}

// ——— 示例：占位组件 AgentWorker（可替换为你的真实组件） ———
export interface AgentWorkerProps {
  title?: string;
  status?: string;
  onRun?: () => void;
}

const AgentWorkerPlaceholder: React.FC<AgentWorkerProps> = ({
  title = 'Agent Worker',
  status = 'idle',
  onRun
}) =>
  React.createElement(
    'div',
    { style: { padding: 16, border: '1px dashed #94a3b8', borderRadius: 12 } },
    React.createElement('div', { style: { fontWeight: 700, marginBottom: 8 } }, title),
    React.createElement('div', { style: { fontSize: 12, color: '#64748b' } }, '状态: ', status),
    onRun &&
      React.createElement(
        'button',
        { type: 'button', onClick: onRun, style: { marginTop: 8 } },
        '运行'
      )
  );

/** 注册默认示例组件（可在应用入口调用；之后可将 AgentWorker 换为真实实现） */
export function registerDefaultBuilderComponents(): void {
  registerBuilderComponent<AgentWorkerProps>('AgentWorker', {
    Component: AgentWorkerPlaceholder,
    displayName: 'Agent Worker',
    getMockProps: () => ({
      title: 'Agent Worker（Mock 预览）',
      status: 'preview',
      onRun: () => console.log('Mock: onRun')
    })
  });
}
