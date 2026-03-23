const { execSync } = require('child_process');
const { readdirSync } = require('fs');
const path = require('path');

/**
 * electron-builder afterPack 钩子
 * 
 * 问题：electron-builder 在 identity=null 时跳过签名，但 Electron 框架自带的签名
 * 与打包后的 app 不一致，导致 macOS ShipIt 更新器验证失败。
 * 
 * 解决：先移除所有旧签名，再用 ad-hoc 签名（codesign --sign -）重新签名整个应用。
 * Ad-hoc 签名不需要 Apple 开发者证书，但能通过 ShipIt 的代码签名验证。
 */
exports.default = async function afterPack(context) {
    // 只在 macOS 平台执行
    if (context.electronPlatformName !== 'darwin') {
        return;
    }

    const appPath = path.join(
        context.appOutDir,
        `${context.packager.appInfo.productFilename}.app`
    );

    console.log(`[afterPack] 正在对应用进行 ad-hoc 签名: ${appPath}`);

    try {
        // 1. 先移除所有旧签名
        console.log('[afterPack] 步骤 1/3: 移除旧签名...');

        // 移除 Electron Framework 签名
        const frameworkPath = path.join(
            appPath,
            'Contents/Frameworks/Electron Framework.framework'
        );
        safeExec(`codesign --remove-signature "${frameworkPath}"`);

        // 移除 Helper 应用签名
        const helpersDir = path.join(appPath, 'Contents/Frameworks');
        try {
            const helpers = readdirSync(helpersDir).filter(f => f.endsWith('.app'));
            for (const helper of helpers) {
                const helperPath = path.join(helpersDir, helper);
                safeExec(`codesign --remove-signature "${helperPath}"`);
            }
        } catch (e) { }

        // 移除主应用签名
        safeExec(`codesign --remove-signature "${appPath}"`);

        // 2. 用 ad-hoc 签名重新签名（从内到外）
        console.log('[afterPack] 步骤 2/3: 签名内部框架和 Helper...');

        // 签名 Electron Framework
        safeExec(`codesign --sign - --force --deep "${frameworkPath}"`);

        // 签名所有 framework
        try {
            const frameworks = readdirSync(helpersDir).filter(f => f.endsWith('.framework'));
            for (const fw of frameworks) {
                const fwPath = path.join(helpersDir, fw);
                safeExec(`codesign --sign - --force "${fwPath}"`);
            }
        } catch (e) { }

        // 签名 Helper 应用
        try {
            const helpers = readdirSync(helpersDir).filter(f => f.endsWith('.app'));
            for (const helper of helpers) {
                const helperPath = path.join(helpersDir, helper);
                safeExec(`codesign --sign - --force "${helperPath}"`);
                console.log(`[afterPack]   ✓ ${helper}`);
            }
        } catch (e) { }

        // 3. 签名主应用
        console.log('[afterPack] 步骤 3/3: 签名主应用...');
        execSync(
            `codesign --sign - --force --deep "${appPath}"`,
            { stdio: 'inherit' }
        );

        console.log('[afterPack] ✅ Ad-hoc 签名完成');
    } catch (error) {
        console.error('[afterPack] ❌ 签名失败:', error.message);
    }
};

function safeExec(cmd) {
    try {
        execSync(cmd, { stdio: 'pipe' });
    } catch (e) {
        // 忽略错误（某些组件可能不存在）
    }
}
