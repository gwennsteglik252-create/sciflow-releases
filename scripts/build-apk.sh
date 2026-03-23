#!/bin/bash
# ═══════════════════════════════════════════════════
# SciFlow Pro Android APK 构建脚本
# 用法: ./scripts/build-apk.sh [版本号]
# ═══════════════════════════════════════════════════

set -e

VERSION="$1"

echo ""
echo "📱 构建 Android APK..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. 构建 Web 资源（移动端模式，不包含 Electron 相关代码）
echo "🔨 步骤 1/4: 构建 Web 资源..."
MOBILE_BUILD=true npx vite build
echo "   ✅ Web 资源构建完成"

# 2. 同步到 Android 项目
echo "📦 步骤 2/4: 同步到 Android 项目..."
npx cap sync android
echo "   ✅ Android 同步完成"

# 3. 如果提供了版本号，更新 Android 版本
if [ -n "$VERSION" ]; then
    echo "📝 步骤 3/4: 更新 Android 版本号..."
    # 将版本号转为 versionCode（去掉点号，如 0.8.1 → 81）
    VERSION_CODE=$(echo "$VERSION" | sed 's/[^0-9]//g' | sed 's/^0*//')
    [ -z "$VERSION_CODE" ] && VERSION_CODE=1

    GRADLE_FILE="android/app/build.gradle"
    if [ -f "$GRADLE_FILE" ]; then
        sed -i '' "s/versionCode [0-9]*/versionCode ${VERSION_CODE}/" "$GRADLE_FILE"
        sed -i '' "s/versionName \".*\"/versionName \"${VERSION}\"/" "$GRADLE_FILE"
        echo "   ✅ versionName=${VERSION}, versionCode=${VERSION_CODE}"
    fi
else
    echo "⏩ 步骤 3/4: 跳过版本号更新（未指定版本）"
fi

# 4. 构建 Release APK
echo "🔨 步骤 4/4: 构建 Release APK..."

# 检查是否有 Android SDK（本地构建需要）
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "   ⚠️  未检测到 Android SDK，APK 将由 GitHub Actions 云端构建"
    echo "   💡 如需本地构建，请安装 Android Studio 并设置 ANDROID_HOME"
    exit 0
fi

cd android
./gradlew assembleRelease
cd ..

# 复制 APK 到 dist_electron 目录统一管理
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    TARGET="dist_electron/SciFlow-Pro-${VERSION:-latest}-android.apk"
    cp "$APK_PATH" "$TARGET"
    echo "   ✅ APK 构建完成: $TARGET"
else
    echo "   ⚠️  APK 文件未找到，请检查构建日志"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Android APK 构建完成！"
echo ""
