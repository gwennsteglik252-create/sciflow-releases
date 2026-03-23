#!/bin/bash
# ═══════════════════════════════════════════════════
# SciFlow Pro iOS IPA 构建脚本 (通过 xcodebuild 本地归档)
# 用法: ./scripts/build-ios.sh [版本号]
# ═══════════════════════════════════════════════════

set -e

VERSION="$1"

echo ""
echo "📱 构建 iOS IPA 安装包..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 构建 Web 资源（同 Android）
echo "🔨 步骤 1/4: 构建 Web 资源..."
MOBILE_BUILD=true npx vite build
echo "   ✅ Web 资源构建完成"

# 2. 同步到 iOS 项目
echo "📦 步骤 2/4: 同步到 iOS 项目..."
npx cap sync ios
echo "   ✅ iOS 同步完成"

# 3. 如果提供了版本号，更新 iOS MARKETING_VERSION 和 CURRENT_PROJECT_VERSION
if [ -n "$VERSION" ]; then
    echo "📝 步骤 3/4: 更新 iOS 版本号..."
    VERSION_CODE=$(echo "$VERSION" | sed 's/[^0-9]//g' | sed 's/^0*//')
    [ -z "$VERSION_CODE" ] && VERSION_CODE=1
    
    PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
    if [ -f "$PBXPROJ" ]; then
        sed -i '' "s/MARKETING_VERSION = .*/MARKETING_VERSION = ${VERSION};/" "$PBXPROJ"
        sed -i '' "s/CURRENT_PROJECT_VERSION = .*/CURRENT_PROJECT_VERSION = ${VERSION_CODE};/" "$PBXPROJ"
        echo "   ✅ MARKETING_VERSION=${VERSION}, CURRENT_PROJECT_VERSION=${VERSION_CODE}"
    fi
else
    echo "⏩ 步骤 3/4: 跳过版本号更新（未指定版本）"
fi

# 4. 构建 Release IPA
echo "🔨 步骤 4/4: 归档并导出 Release IPA..."

if ! command -v xcodebuild &> /dev/null; then
    echo "   ⚠️  未检测到 xcodebuild，无法在当前环境自动打包 iOS。"
    echo "   💡 请确保安装了 Xcode 及其 Command Line Tools。"
    exit 0
fi

cd ios/App

# 先进行 archive
echo "   ⏳ 正在归档 (xcodebuild archive)... 这需要几分钟时间。"
xcodebuild archive \
    -workspace App.xcworkspace \
    -scheme App \
    -configuration Release \
    -archivePath build/App.xcarchive \
    -allowProvisioningUpdates \
    | xcpretty || echo "   ℹ️ 如果失败，请先用 Xcode 手动打开 ios/App/App.xcworkspace 并在 'Signing & Capabilities' 中配置你的开发者账户。"

# 检查归档是否成功
if [ ! -d "build/App.xcarchive" ]; then
    echo "   ❌ 归档失败，请检查上面提示的签名配置！"
    exit 1
fi

# 临时生成极简版 ExportOptions.plist
cat > build/ExportOptions.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>
EOF

echo "   ⏳ 正在导出 (xcodebuild -exportArchive)..."
xcodebuild -exportArchive \
    -archivePath build/App.xcarchive \
    -exportOptionsPlist build/ExportOptions.plist \
    -exportPath build/Exported \
    -allowProvisioningUpdates | xcpretty || true

cd ../..

# 复制 IPA 到 dist_electron 目录统一管理
IPA_PATH="ios/App/build/Exported/App.ipa"
if [ -f "$IPA_PATH" ]; then
    TARGET="dist_electron/SciFlow-Pro-${VERSION:-latest}-ios.ipa"
    cp "$IPA_PATH" "$TARGET"
    echo "   ✅ IPA 构建完成: $TARGET"
else
    echo "   ⚠️  IPA 导出失败！建议使用 Xcode 界面操作导出: \n   1. 打开 ios/App/App.xcworkspace \n   2. 菜单 Product -> Archive \n   3. 点击 Distribute App 导出"
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 iOS 包处理完毕！"
echo ""
