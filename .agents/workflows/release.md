---
description: 发布新版本到 GitHub Releases（一键构建 + 上传）
---

# 发布新版本到 GitHub Releases

// turbo-all

## 触发方式

用户说"帮我发布"、"发布新版本"、"/release" 即可触发。

## 完整流程

### 步骤 0：自动分析更新内容
1. 运行 `git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~20)..HEAD` 查看自上次发布以来的提交
2. 结合当前对话中的修改记录，总结本次更新了哪些功能
3. 自动决定版本号：
   - Bug 修复、小调整 → patch（x.x.+1）
   - 新功能、较大改进 → minor（x.+1.0）
   - 重大架构变更 → major（+1.0.0）
4. 生成简短的更新描述（中文）
5. 向用户确认版本号和描述，用户同意后执行

### 步骤 1：执行发布脚本

```bash
./scripts/publish.sh <版本号> "<更新描述>"
```

脚本会自动完成：
1. 更新 `package.json` 版本号
2. 更新 `README.md` 版本徽章和下载链接
3. 构建 macOS 安装包（npm run dist → .dmg + .zip）
4. 构建 Android APK（如本机有 Android SDK；否则由 CI 云端构建）
5. 构建 iOS IPA（本地 xcodebuild 打包）
6. 部署网页版到 GitHub Pages（npm run deploy:web）
7. git add + commit
8. 推送源码到 `build` 分支（触发云端 Windows + Android 构建）
9. 创建 Git tag 并推送
10. 推送 README 更新到 main 分支
11. 创建 GitHub Release + 上传本地安装包（macOS + iOS IPA + Android APK）
12. Windows .exe 和 Android .apk 由 GitHub Actions 云端自动构建后追加上传

### 步骤 2：验证发布结果
1. 检查 GitHub Release 页面是否创建成功
2. 确认安装包是否上传成功（macOS .dmg + .zip、Windows .exe、Android .apk、iOS .ipa）
3. 向用户汇报发布结果和链接

## 构建产物

| 平台 | 构建方式 | 产物 |
|------|---------|------|
| macOS | 本地 `npm run dist` | `.dmg` + `.zip` |
| Windows | GitHub Actions 云端 | `.exe` |
| Android | 本地或 GitHub Actions 云端 | `.apk` |
| iOS | 本地 `scripts/build-ios.sh` | `.ipa` |

## 仓库结构

| 分支 | 内容 | 说明 |
|------|------|------|
| `main` | README + 文档截图 | 用户可见的干净页面 |
| `build` | 完整源代码 | CI 构建用，不对外展示 |
