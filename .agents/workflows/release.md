---
description: 发布新版本到 GitHub Releases 的完整流程
---

# 🚀 发布新版本工作流

## 前置准备
确保所有代码修改已完成并测试通过。

## 步骤

### 1. 更新版本号
修改 `package.json` 中的 `version` 字段（遵循语义化版本：patch/minor/major）

### 2. 更新 README.md
- 版本徽章：`v1.0.x` → 新版本号
- 下载链接：更新 DMG 和 EXE 的文件名和 URL
- 更新日志：在 `## 📋 更新日志` 下添加新版本的变更记录

### 3. 停止开发服务器
```bash
pkill -f "electron ." 2>/dev/null; lsof -ti :5173 | xargs kill -9 2>/dev/null
```

// turbo
### 4. 打包构建（macOS + Windows）
```bash
cd "/Users/luoxiaojin/Desktop/copy-of-sciflow-pro (2)" && npm run dist
```
然后单独打包 Windows：
```bash
npx electron-builder --win --config.win.target=nsis
```

### 5. 验证文件名
确保 `dist_electron/latest-mac.yml` 和 `dist_electron/latest.yml` 中的文件名与实际生成的文件名一致。

⚠️ **重要**：`artifactName` 已在 `package.json` 中配置为不含空格的格式（`SciFlow-Pro-xxx`），
生成的文件名应该直接与 GitHub 兼容，不需要手动修改 yml 文件。

### 6. 提交代码并推送
```bash
git add .gitignore README.md package.json
git commit -m "release: vX.Y.Z - 简要描述"
git push origin main
```

### 7. 创建 Tag 并推送
```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

### 8. 在 GitHub 上创建 Release
1. 打开 https://github.com/gwennsteglik252-create/sciflow-releases/releases/new
2. 选择刚推送的 tag
3. 填写标题和更新日志
4. 上传 `dist_electron/` 中的以下文件：
   - `SciFlow-Pro-{version}-arm64.dmg` (macOS 安装包)
   - `SciFlow-Pro-{version}-arm64.dmg.blockmap`
   - `SciFlow-Pro-{version}-arm64.zip` (macOS 自动更新包)
   - `SciFlow-Pro-{version}-arm64.zip.blockmap`
   - `SciFlow-Pro-Setup-{version}.exe` (Windows 安装包)
   - `SciFlow-Pro-Setup-{version}.exe.blockmap`
   - `latest-mac.yml` (macOS 自动更新配置)
   - `latest.yml` (Windows 自动更新配置)
5. 点击 "Publish release"

### 9. 验证
打开软件，检查自动更新是否能正常检测到新版本并下载。

## ⚠️ 常见问题

### 自动更新 404 错误
- **原因**：GitHub 会将文件名中的空格替换为点号
- **解决**：`package.json` 中已通过 `artifactName` 固定文件名格式为连字符，不再有空格
- **验证**：上传后检查 GitHub 上的文件名是否与 yml 中的一致

### macOS "ZIP file not provided" 错误
- **原因**：`electron-updater` 在 macOS 上需要 `.zip` 格式进行自动更新
- **解决**：`mac.target` 已配置为 `["dmg", "zip"]`，同时生成两种格式

### Windows 无法打包
- 在 macOS 上可以通过 `npx electron-builder --win` 交叉编译 Windows 版本
