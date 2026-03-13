---
description: 发布新版本到 GitHub Releases 的完整流程
---

# 发布新版本到 GitHub Releases

// turbo-all

## 前置条件
- 所有代码已提交并通过测试
- 确认好新版本号（遵循语义化版本：major.minor.patch）

## 步骤

### 1. 更新版本号
修改 `package.json` 中的 `version` 字段为新版本号。

### 2. 提交版本更新
```bash
git add -A
git commit -m "release: v<版本号> - <简短描述>"
```

### 3. 创建 Git Tag
```bash
git tag -a v<版本号> -m "v<版本号> - <简短描述>"
```

### 4. 推送到 GitHub（触发自动构建）
```bash
git push origin main --tags
```

推送 tag 后，GitHub Actions 会自动执行：
- 在 **macOS** 上构建 `.dmg` 和 `.zip` 安装包
- 在 **Windows** 上构建 `.exe` 安装包
- 自动创建 GitHub Release 并上传所有安装包

### 5. 检查构建状态
访问 https://github.com/gwennsteglik252-create/sciflow-releases/actions 查看构建进度。

### 6.（可选）手动构建本地安装包
如果需要在本地构建：
```bash
npm run dist
```
构建产物在 `dist_electron/` 目录中。

## 工作流配置
- 工作流文件：`.github/workflows/release.yml`
- 触发条件：推送 `v*` 格式的 tag
- 构建平台：macOS (arm64) + Windows (nsis)
- 发布方式：自动创建 GitHub Release + 上传安装包
