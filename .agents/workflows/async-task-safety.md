---
description: 确保含有 AI 异步任务的组件在导航切换时不被卸载
---

# 异步任务安全规范

## 核心原则
任何包含 AI 异步调用（如 `callGeminiWithRetry`、`generateContent` 等）的组件，在用户切换导航栏时**必须保持挂载**，不能被卸载。

## 实现方式
在 `AppRouter.tsx` 中，使用 `display: none/flex` 隐藏而非条件渲染：

```tsx
{/* 始终挂载，切换页面时仅隐藏 */}
<div style={{ display: route.view === 'target_view' ? 'flex' : 'none' }} className="h-full flex-col">
  <TargetComponent ... />
</div>
```

## 已采用该模式的组件
- `ProjectDetail` — AI 实验流生成、周报生成
- `WritingModule` — 子图识别、图注生成
- `AIAssistant` — AI 对话
- `TrendsRadar` — 后台搜索/报告生成

## 检查清单
当新增含 AI 异步任务的页面级组件时：
1. 确认该组件是否在 `renderRoute()` 的 `switch` 中条件渲染
2. 如果是，将其移至底部「始终挂载区域」
3. 用 `display` 控制显隐
4. 更新本文档的「已采用该模式的组件」列表
