import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Fix: Import process explicitly to resolve type errors in ESM environments
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // 确保在任何 Node.js 执行环境下都能正确获取根目录
  // Fix: Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error in environments where process is not fully typed for Node
  const rootDir = typeof process !== 'undefined' ? (process as any).cwd() : './';
  const env = loadEnv(mode, rootDir, '');

  // Electron 构建模式不需要 PWA Service Worker
  const isElectronBuild = env.ELECTRON_BUILD === 'true';
  
  return {
    plugins: [
      react(),
      // PWA 插件 — 仅在 Web 构建时启用
      ...(!isElectronBuild ? [VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'SciFlow Pro — 智能科研管理平台',
          short_name: 'SciFlow',
          description: '新一代智能科研管理与数据分析平台',
          start_url: './',
          display: 'standalone',
          orientation: 'any',
          background_color: '#0f172a',
          theme_color: '#6366f1',
          lang: 'zh-CN',
          icons: [
            { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB
          globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
          // 排除大体积图片，改用运行时按需缓存
          globIgnores: ['**/farm/**', '**/*.png'],
          runtimeCaching: [
            {
              // 缓存 Google Fonts
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
            {
              // 缓存 Font Awesome
              urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/,
              handler: 'CacheFirst',
              options: { cacheName: 'font-awesome', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
            {
              // 缓存 KaTeX
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex/,
              handler: 'CacheFirst',
              options: { cacheName: 'katex', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
            },
            {
              // AI API 请求不缓存
              urlPattern: /^https:\/\/(generativelanguage|api\.openai|new\.12ai)/,
              handler: 'NetworkOnly'
            }
          ]
        }
      })] : [])
    ],
    base: env.DEPLOY_BASE || './', // DEPLOY_BASE 可设为 '/sciflow-releases/' 用于 GitHub Pages
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    server: {
      port: 5173,
      open: false,
      proxy: {
        // Dev-only CORS workaround for OpenAI-compatible providers like new.12ai.org.
        '/api/openai': {
          target: 'https://new.12ai.org',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/openai/, '')
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true
    }
  };
});
