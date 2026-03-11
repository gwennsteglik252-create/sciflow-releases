import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Fix: Import process explicitly to resolve type errors in ESM environments
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // 确保在任何 Node.js 执行环境下都能正确获取根目录
  // Fix: Cast process to any to avoid "Property 'cwd' does not exist on type 'Process'" error in environments where process is not fully typed for Node
  const rootDir = typeof process !== 'undefined' ? (process as any).cwd() : './';
  const env = loadEnv(mode, rootDir, '');
  
  return {
    plugins: [react()],
    base: './', // 关键：Electron 加载静态资源需要使用相对路径
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
