#!/bin/bash
# ═══════════════════════════════════════════════════
# SciFlow Pro 一键发布脚本（本地 macOS + Android + 云端 Windows）
# 用法: ./scripts/publish.sh 1.2.0 "简短更新描述"
# ═══════════════════════════════════════════════════

set -e

GH="$HOME/bin/gh"
REPO="gwennsteglik252-create/sciflow-releases"

# 检查参数
VERSION="$1"
DESC="$2"

if [ -z "$VERSION" ]; then
    echo "❌ 请指定版本号！"
    echo "用法: ./scripts/publish.sh 1.2.0 \"更新描述\""
    exit 1
fi

if [ -z "$DESC" ]; then
    DESC="v${VERSION} 版本更新"
fi

echo ""
echo "🚀 SciFlow Pro 发布流程 v${VERSION}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 更新 package.json 版本号 + README
echo ""
echo "📝 步骤 1/11: 更新版本号和 README..."
OLD_VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
echo "   ✅ package.json: ${OLD_VERSION} → ${VERSION}"

# 更新 README 中的版本徽章和下载链接
if [ -f "README.md" ]; then
    sed -i '' "s/版本-v${OLD_VERSION}/版本-v${VERSION}/g" README.md
    sed -i '' "s/SciFlow-Pro-${OLD_VERSION}/SciFlow-Pro-${VERSION}/g" README.md
    sed -i '' "s/SciFlow-Pro-Setup-${OLD_VERSION}/SciFlow-Pro-Setup-${VERSION}/g" README.md
    sed -i '' "s|/download/v${OLD_VERSION}/|/download/v${VERSION}/|g" README.md
    echo "   ✅ README.md 版本号和下载链接已更新"
fi

# 2. 构建前端 + Electron (macOS)
echo ""
echo "🔨 步骤 2/11: 构建 macOS 安装包..."

# 引入公证用的鉴权环境变量
if [ -f ".env.local" ]; then
    echo "   🔑 检测到 .env.local，加载 Apple 凭证以准备签名与公证..."
    export $(grep -v '^#' .env.local | xargs)
else
    echo "   ⚠️  未检测到 .env.local，如果你没有其他全局配置，Mac 应用可能无法成功公证！"
fi

npm run dist
echo "   ✅ macOS 构建完成"

# 2.5. 构建 Android APK（如有 Android SDK）
echo ""
echo "📱 步骤 2.5/11: 构建 Android APK..."
./scripts/build-apk.sh "${VERSION}"
echo "   ✅ Android APK 构建步骤完成"

# 2.6. 部署网页版到 GitHub Pages
echo ""
echo "🌐 步骤 2.6/11: 部署网页版到 GitHub Pages..."
npm run deploy:web
echo "   ✅ 网页版部署完成"

# 2.7. 构建 iOS IPA (仅限本地 macOS 系统并配置了证书)
echo ""
echo "📱 步骤 2.7/11: 构建 iOS IPA..."
./scripts/build-ios.sh "${VERSION}" || echo "   ⚠️  iOS 打包可能因为缺少证书略过"
echo "   ✅ iOS IPA 构建步骤结束"

# 3. 提交更改（本地，main 分支只追踪 README/docs）
echo ""
echo "📦 步骤 3/11: 提交代码..."
git add -A
git commit -m "release: v${VERSION} - ${DESC}" || true
echo "   ✅ 已提交"

# 4.推送当前源码到 build 分支（利用独立 Git 索引安全包含源码，不影响当前工作区和 main 分支）
echo ""
echo "🪟 步骤 4/11: 推送源代码到 build 分支（触发 Windows + Android 云端构建）..."

# 临时重命名 .gitignore 使得我们能添加被忽略的源码
mv .gitignore .gitignore.bak

# 生成仅适用于 CI 的临时排除规则
cat > .git/ci_exclude << 'EOF'
node_modules/
dist/
dist_electron/
android/app/build/
ios/App/build/
ios/App/DerivedData/
.DS_Store
.vite/
*.log
.gitignore.bak
.git/
EOF

# 使用独立的 Git 索引
export GIT_INDEX_FILE=.git/ci_index
git read-tree HEAD
# 利用新规则扫描并添加所有未被排除的源码文件
git -c core.excludesFile=.git/ci_exclude add -A

# 将索引树转为 Tree 对象并创建一个新 Commit
TREE_HASH=$(git write-tree)
COMMIT_HASH=$(git commit-tree $TREE_HASH -p HEAD -m "build: 包含完整源码的 v${VERSION} CI构建")

# 强制推送到远程 build 分支
git push origin ${COMMIT_HASH}:refs/heads/build --force

# 清理现场
mv .gitignore.bak .gitignore
rm -f .git/ci_index .git/ci_exclude
unset GIT_INDEX_FILE
echo "   ✅ 完整源代码已推送到 build 分支"

# 5. 创建 tag 并推送
echo ""
echo "🏷️  步骤 5/11: 创建 tag..."
git tag -a "v${VERSION}" -m "v${VERSION} - ${DESC}" 2>/dev/null || {
    echo "   ⚠️  Tag v${VERSION} 已存在，删除重建..."
    git tag -d "v${VERSION}"
    git push origin :refs/tags/v${VERSION} 2>/dev/null || true
    git tag -a "v${VERSION}" -m "v${VERSION} - ${DESC}"
}
echo "   ✅ tag v${VERSION} 已创建"

# 6. 推送 main 和 tag
echo ""
echo "☁️  步骤 6/11: 推送到 GitHub..."
git push origin main --tags
echo "   ✅ 已推送"

# 7. 创建 Release 并上传 macOS 安装包
echo ""
echo "📤 步骤 7/11: 创建 Release 并上传安装包..."

DMG="dist_electron/SciFlow-Pro-${VERSION}-arm64.dmg"
ZIP="dist_electron/SciFlow-Pro-${VERSION}-arm64.zip"
MAC_YML="dist_electron/latest-mac.yml"
APK="dist_electron/SciFlow-Pro-${VERSION}-android.apk"
IPA="dist_electron/SciFlow-Pro-${VERSION}-ios.ipa"

FILES=""
[ -f "$DMG" ] && FILES="$FILES $DMG"
[ -f "$ZIP" ] && FILES="$FILES $ZIP"
[ -f "$MAC_YML" ] && FILES="$FILES $MAC_YML"
[ -f "$APK" ] && FILES="$FILES $APK"
[ -f "$IPA" ] && FILES="$FILES $IPA"

# 删除已有的同名 release
$GH release delete "v${VERSION}" --repo "$REPO" -y 2>/dev/null || true
sleep 2

$GH release create "v${VERSION}" \
    --repo "$REPO" \
    --title "v${VERSION} - ${DESC}" \
    --generate-notes \
    $FILES

echo "   ✅ Release 已发布，安装包已上传"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 v${VERSION} 发布完成！"
echo ""
echo "📎 Release: https://github.com/${REPO}/releases/tag/v${VERSION}"
echo "🪟 Windows .exe 将由 GitHub Actions 自动构建并上传"
echo "📱 Android .apk 也将由 GitHub Actions 云端构建并上传"
echo "🍎 iOS .ipa 如有生成已自动上传（须有本地 Xcode 证书支持）"
echo "   查看进度: https://github.com/${REPO}/actions"
echo ""
