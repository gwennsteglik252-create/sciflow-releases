// ═══ SciFlow Pro — Electron Main Process ═══
//
// 拆分后的模块：
//   license.ts      — 授权系统（验证/激活/试用期）
//   updater.ts      — 自动更新（GitHub API 版本检测）
//   ipcHandlers.ts  — IPC 事件处理器（文件对话框/截屏/目录监控/弹出窗口）

import { app, BrowserWindow, shell, powerSaveBlocker } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import process from 'node:process';

import { getLicenseState } from './license';
import { registerUpdaterIpc, initAutoUpdateCheck } from './updater';
import { registerIpcHandlers } from './ipcHandlers';

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

// ═══ 防止 macOS/Chromium 后台节流 ═══
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(_dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(_dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  powerSaveBlocker.start('prevent-app-suspension');

  // ═══ CORS 绕过 ═══
  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*/*'] },
    (details: Electron.OnBeforeSendHeadersListenerDetails, callback: (response: Electron.BeforeSendResponse) => void) => {
      delete details.requestHeaders['Origin'];
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*/*'] },
    (details: Electron.OnHeadersReceivedListenerDetails, callback: (response: Electron.HeadersReceivedResponse) => void) => {
      const headers = details.responseHeaders || {};
      headers['access-control-allow-origin'] = ['*'];
      headers['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
      headers['access-control-allow-headers'] = ['*'];
      callback({ responseHeaders: headers });
    }
  );

  createWindow();

  // ═══ 注册模块化 IPC 处理器 ═══
  registerIpcHandlers(_dirname);
  registerUpdaterIpc();
  initAutoUpdateCheck();

  // ═══ 本地 HTTP API Server ═══
  const API_PORT = 17930;

  const queryRenderer = async (channel: string, ...args: unknown[]): Promise<any> => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length === 0) return null;
    try {
      return await wins[0].webContents.executeJavaScript(
        `window.__sciflowAPI__?.${channel}?.(${args.map(a => JSON.stringify(a)).join(',')})`
      );
    } catch (e) {
      console.error(`[API Server] queryRenderer(${channel}) failed:`, e);
      return null;
    }
  };

  const readBody = (req: http.IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: string) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

  const setHeaders = (res: http.ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Powered-By', 'SciFlow Pro API Server');
  };

  const jsonRes = (res: http.ServerResponse, status: number, data: unknown) => {
    res.writeHead(status);
    res.end(JSON.stringify(data, null, 2));
  };

  const verifyToken = (req: http.IncomingMessage): boolean => {
    const tokenFilePath = path.join(app.getPath('userData'), 'api_token.txt');
    let storedToken = '';
    try {
      if (fs.existsSync(tokenFilePath)) {
        storedToken = fs.readFileSync(tokenFilePath, 'utf-8').trim();
      }
    } catch { /* ignore */ }
    if (!storedToken) return true;
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token === storedToken;
  };

  const generateApiToken = (): string => {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenFilePath = path.join(app.getPath('userData'), 'api_token.txt');
    fs.writeFileSync(tokenFilePath, token, 'utf-8');
    return token;
  };

  // Directory watchers (used by pipeline routes)
  const watchers = new Map<string, fs.FSWatcher>();

  interface RouteHandler {
    handler: (req: http.IncomingMessage, res: http.ServerResponse, urlObj?: URL) => Promise<void>;
  }

  /** 路由处理器 */
  const routeHandlers: Record<string, RouteHandler> = {
    // ── 系统 ──
    'GET /api/v1/status': {
      handler: async (_req, res) => {
        const licState = getLicenseState();
        jsonRes(res, 200, {
          ok: true, app: 'SciFlow Pro', version: app.getVersion(),
          platform: process.platform, arch: process.arch, hostname: os.hostname(),
          uptime: process.uptime(), license: licState.status, pid: process.pid,
        });
      }
    },

    'GET /api/v1/openapi': {
      handler: async (_req, res) => {
        jsonRes(res, 200, {
          openapi: '3.0.3',
          info: { title: 'SciFlow Pro Local API', version: app.getVersion(), description: 'RESTful API for external AI agents' },
          servers: [{ url: `http://127.0.0.1:${API_PORT}`, description: 'Local SciFlow Pro Instance' }],
          paths: {
            '/api/v1/status': { get: { summary: '获取系统状态', tags: ['System'] } },
            '/api/v1/settings': { get: { summary: '读取所有设置' }, put: { summary: '更新设置' } },
            '/api/v1/settings/{key}': { get: { summary: '读取特定设置项' } },
            '/api/v1/token': { post: { summary: '生成新的 API Token' } },
            '/api/v1/projects': { get: { summary: '获取项目列表', tags: ['Data'] } },
            '/api/v1/resources': { get: { summary: '获取情报档案', tags: ['Data'] } },
            '/api/v1/ai/chat': { post: { summary: '调用 AI 对话', tags: ['AI'] } },
            '/api/v1/ai/metrics': { get: { summary: '获取 AI 使用指标', tags: ['AI'] } },
            '/api/v1/files/read': { post: { summary: '读取文件内容', tags: ['Files'] } },
            '/api/v1/files/write': { post: { summary: '写入文件', tags: ['Files'] } },
            '/api/v1/files/list': { post: { summary: '列出目录内容', tags: ['Files'] } },
            '/api/v1/workflow/rules': { get: { summary: '获取工作流规则' }, post: { summary: '创建工作流规则' } },
            '/api/v1/broadcast': { post: { summary: '向渲染进程广播自定义事件' } },
          },
        });
      }
    },

    'POST /api/v1/token': {
      handler: async (_req, res) => {
        const token = generateApiToken();
        jsonRes(res, 200, {
          ok: true, token,
          message: 'New API token generated.',
          usage: `curl -H "Authorization: Bearer ${token}" http://127.0.0.1:${API_PORT}/api/v1/status`,
        });
      }
    },

    // ── 设置 ──
    'GET /api/v1/settings': {
      handler: async (_req, res) => {
        const settings = await queryRenderer('getSettings');
        jsonRes(res, 200, { ok: true, settings: settings || {} });
      }
    },
    'PUT /api/v1/settings': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let updates: Record<string, any>;
        try { updates = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        await queryRenderer('updateSettings', updates);
        jsonRes(res, 200, { ok: true, message: 'Settings updated' });
      }
    },

    // ── 项目/文献 ──
    'GET /api/v1/projects': {
      handler: async (_req, res) => {
        const projects = await queryRenderer('getProjects');
        jsonRes(res, 200, { ok: true, projects: projects || [] });
      }
    },
    'GET /api/v1/resources': {
      handler: async (_req, res) => {
        const resources = await queryRenderer('getResources');
        jsonRes(res, 200, { ok: true, resources: resources || [] });
      }
    },

    // ── AI 代理 ──
    'POST /api/v1/ai/chat': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.prompt) return jsonRes(res, 400, { ok: false, error: 'Missing "prompt" field' });
        const result = await queryRenderer('aiChat', payload.prompt, payload.model || '');
        if (result === null) return jsonRes(res, 503, { ok: false, error: 'Renderer not ready' });
        jsonRes(res, 200, { ok: true, response: result });
      }
    },
    'GET /api/v1/ai/metrics': {
      handler: async (_req, res) => {
        const metrics = await queryRenderer('getAiMetrics');
        jsonRes(res, 200, { ok: true, metrics: metrics || {} });
      }
    },

    // ── 文件操作 ──
    'POST /api/v1/files/read': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.path) return jsonRes(res, 400, { ok: false, error: 'Missing "path" field' });
        if (!fs.existsSync(payload.path)) return jsonRes(res, 404, { ok: false, error: 'File not found' });
        try {
          const ext = path.extname(payload.path).toLowerCase();
          const isBinary = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf'].includes(ext);
          if (isBinary) {
            const data = await fs.promises.readFile(payload.path, { encoding: 'base64' });
            jsonRes(res, 200, { ok: true, data, encoding: 'base64', mimeType: ext === '.pdf' ? 'application/pdf' : `image/${ext.replace('.', '')}` });
          } else {
            const data = await fs.promises.readFile(payload.path, 'utf-8');
            jsonRes(res, 200, { ok: true, data, encoding: 'utf-8', mimeType: 'text/plain' });
          }
        } catch (e: any) { jsonRes(res, 500, { ok: false, error: e.message }); }
      }
    },
    'POST /api/v1/files/write': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.path || payload.content === undefined) return jsonRes(res, 400, { ok: false, error: 'Missing "path" or "content"' });
        try {
          const dir = path.dirname(payload.path);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const encoding = payload.encoding === 'base64' ? 'base64' : 'utf-8';
          fs.writeFileSync(payload.path, payload.content, { encoding } as any);
          jsonRes(res, 200, { ok: true, message: 'File written', path: payload.path });
        } catch (e: any) { jsonRes(res, 500, { ok: false, error: e.message }); }
      }
    },
    'POST /api/v1/files/list': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.path) return jsonRes(res, 400, { ok: false, error: 'Missing "path"' });
        if (!fs.existsSync(payload.path)) return jsonRes(res, 404, { ok: false, error: 'Directory not found' });
        try {
          const files = fs.readdirSync(payload.path);
          const items = files.map(file => {
            const fullPath = path.join(payload.path, file);
            const stats = fs.statSync(fullPath);
            return { name: file, path: fullPath, isDirectory: stats.isDirectory(), ext: path.extname(file), size: stats.size, lastModified: stats.mtime.toISOString() };
          });
          jsonRes(res, 200, { ok: true, items });
        } catch (e: any) { jsonRes(res, 500, { ok: false, error: e.message }); }
      }
    },

    // ── 工作流 ──
    'GET /api/v1/workflow/rules': {
      handler: async (_req, res) => { const rules = await queryRenderer('getWorkflowRules'); jsonRes(res, 200, { ok: true, rules: rules || [] }); }
    },
    'POST /api/v1/workflow/rules': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        const result = await queryRenderer('addWorkflowRule', payload);
        jsonRes(res, 201, { ok: true, rule: result });
      }
    },
    'POST /api/v1/broadcast': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.event) return jsonRes(res, 400, { ok: false, error: 'Missing "event"' });
        await queryRenderer('broadcastEvent', payload.event, payload.detail || {});
        jsonRes(res, 200, { ok: true, message: `Event "${payload.event}" broadcasted` });
      }
    },

    // ── Pipeline ──
    'POST /api/v1/pipeline/setup': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.basePath) return jsonRes(res, 400, { ok: false, error: 'Missing "basePath"' });
        if (!fs.existsSync(payload.basePath)) {
          try { fs.mkdirSync(payload.basePath, { recursive: true }); } catch (e: any) {
            return jsonRes(res, 500, { ok: false, error: `Cannot create directory: ${e.message}` });
          }
        }
        const watchResult = await new Promise<any>((resolve) => {
          const stats = fs.statSync(payload.basePath);
          if (!stats.isDirectory()) { resolve({ success: false, error: 'Not a directory' }); return; }
          if (watchers.has(payload.basePath)) { resolve({ success: true, message: 'Already watching' }); return; }
          const watcher = fs.watch(payload.basePath, (eventType: string, filename: string | null) => {
            if (filename && eventType === 'rename') {
              const fullPath = path.join(payload.basePath, filename);
              if (fs.existsSync(fullPath)) {
                BrowserWindow.getAllWindows().forEach(w => w.webContents.send('fs-notification', {
                  type: 'added', path: fullPath, name: filename, ext: path.extname(filename), parentDir: payload.basePath
                }));
              }
            }
          });
          watchers.set(payload.basePath, watcher);
          resolve({ success: true });
        });
        const rules = await queryRenderer('setupPipeline', payload.basePath, payload.types || null);
        jsonRes(res, 201, {
          ok: true, message: 'Pipeline configured', basePath: payload.basePath,
          watching: watchResult.success, rulesCreated: rules?.length || 0, rules: rules || [],
        });
      }
    },
    'POST /api/v1/pipeline/ingest': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.files || !Array.isArray(payload.files)) return jsonRes(res, 400, { ok: false, error: 'Missing "files" array' });
        await queryRenderer('broadcastEvent', 'sciflow-pipeline-ingest', { files: payload.files });
        jsonRes(res, 200, { ok: true, message: `${payload.files.length} files submitted` });
      }
    },
    'POST /api/v1/workflow/trigger': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.ruleId) return jsonRes(res, 400, { ok: false, error: 'Missing "ruleId"' });
        const result = await queryRenderer('triggerWorkflow', payload.ruleId, payload.fileContext || null);
        if (!result) return jsonRes(res, 404, { ok: false, error: `Rule not found: ${payload.ruleId}` });
        jsonRes(res, 200, { ok: true, log: result });
      }
    },
    'GET /api/v1/workflow/logs': {
      handler: async (_req, res) => { const logs = await queryRenderer('getWorkflowLogs'); jsonRes(res, 200, { ok: true, logs: logs || [], count: logs?.length || 0 }); }
    },
    'DELETE /api/v1/workflow/rules': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.ruleId) return jsonRes(res, 400, { ok: false, error: 'Missing "ruleId"' });
        const result = await queryRenderer('deleteWorkflowRule', payload.ruleId);
        jsonRes(res, 200, { ok: true, deleted: result });
      }
    },
    'POST /api/v1/resources': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.title) return jsonRes(res, 400, { ok: false, error: 'Missing "title"' });
        const resource = { ...payload, id: payload.id || `res_api_${Date.now()}`, importedAt: new Date().toISOString(), importedBy: 'api' };
        const result = await queryRenderer('addResource', resource);
        jsonRes(res, 201, { ok: true, resource: result });
      }
    },

    // ── 事件系统 ──
    'GET /api/v1/events': {
      handler: async (req, res, urlObj?) => {
        if (!urlObj) return jsonRes(res, 500, { ok: false, error: 'URL object required' });
        const since = urlObj.searchParams.get('since') || undefined;
        const limit = parseInt(urlObj.searchParams.get('limit') || '50');
        const events = await queryRenderer('getEvents', since || '', limit);
        jsonRes(res, 200, { ok: true, events: events || [], count: events?.length || 0, serverTime: new Date().toISOString() });
      }
    },
    'GET /api/v1/events/stream': {
      handler: async (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
        let lastEventCount = 0;
        const interval = setInterval(async () => {
          try {
            const count = await queryRenderer('getEventCount');
            if (count > lastEventCount) {
              const newEvents = await queryRenderer('getEvents', '', count - lastEventCount);
              if (newEvents?.length > 0) {
                for (const evt of newEvents) { res.write(`id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`); }
              }
              lastEventCount = count;
            }
            res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
          } catch { /* client disconnected */ }
        }, 2000);
        _req.on('close', () => clearInterval(interval));
      }
    },
    'GET /api/v1/internal/state': {
      handler: async (_req, res) => { const state = await queryRenderer('getInternalState'); jsonRes(res, 200, { ok: true, state: state || {} }); }
    },

    // ── XRD API ──
    'POST /api/v1/characterization/xrd/analyze': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        let rawDataText = payload.data;
        if (!rawDataText && payload.filePath) {
          try { rawDataText = fs.readFileSync(payload.filePath, 'utf-8'); } catch (e: any) {
            return jsonRes(res, 400, { ok: false, error: `Cannot read file: ${e.message}` });
          }
        }
        if (!rawDataText) return jsonRes(res, 400, { ok: false, error: 'Missing "data" or "filePath"' });
        const result = await queryRenderer('analyzeXrd', rawDataText, payload.options || {});
        if (result?.error) return jsonRes(res, 400, { ok: false, error: result.error });
        jsonRes(res, 200, { ok: true, analysis: result });
      }
    },
    'POST /api/v1/characterization/xrd/interpret': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        let rawDataText = payload.data;
        if (!rawDataText && payload.filePath) {
          try { rawDataText = fs.readFileSync(payload.filePath, 'utf-8'); } catch (e: any) {
            return jsonRes(res, 400, { ok: false, error: `Cannot read file: ${e.message}` });
          }
        }
        if (!rawDataText) return jsonRes(res, 400, { ok: false, error: 'Missing "data" or "filePath"' });
        const xrdResult = await queryRenderer('analyzeXrd', rawDataText, payload.options || {});
        if (xrdResult?.error) return jsonRes(res, 400, { ok: false, error: xrdResult.error });
        const peakTable = (xrdResult.peaks || []).map((p: any, i: number) =>
          `#${i + 1}: 2θ=${p.twoTheta}°, d=${p.dSpacing_angstrom}Å, FWHM=${p.fwhm}°, 晶粒=${p.grainSize_nm}nm, 相对强度=${p.relativeIntensity}%`
        ).join('\n');
        const aiPrompt = `你是XRD衍射数据分析专家。以下是XRD分析结果，请给出学术级的解读报告。\n\n## 数据概况\n- 数据点: ${xrdResult.dataPoints}\n- 2θ范围: ${xrdResult.twoThetaRange?.min}° - ${xrdResult.twoThetaRange?.max}°\n- 射线源: ${xrdResult.wavelength?.source} (λ=${xrdResult.wavelength?.value}nm)\n\n## 检测到的衍射峰 (${xrdResult.peaks?.length || 0} 个)\n${peakTable || '无峰检测到'}\n\n${payload.sampleInfo ? `## 样品信息\n${payload.sampleInfo}` : ''}\n${payload.question ? `## 用户特定问题\n${payload.question}` : ''}\n\n请输出:\n1. **物相推测**: 根据峰位和d值推测可能的物相\n2. **结晶性评估**: 评估样品的结晶程度和晶粒质量\n3. **异常诊断**: 指出不寻常的峰或数据特征\n4. **实验建议**: 下一步表征建议`;
        const aiResult = await queryRenderer('aiChat', aiPrompt, payload.model || null);
        jsonRes(res, 200, { ok: true, analysis: xrdResult, interpretation: { text: aiResult?.text || '', model: aiResult?.model || 'auto' } });
      }
    },
    'GET /api/v1/characterization/xrd/sources': {
      handler: async (_req, res) => { const sources = await queryRenderer('getXrdSources'); jsonRes(res, 200, { ok: true, sources: sources || {} }); }
    },

    // ── 项目上下文 AI ──
    'POST /api/v1/projects/context': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.projectId) return jsonRes(res, 400, { ok: false, error: 'Missing "projectId"' });
        const context = await queryRenderer('getProjectContext', payload.projectId);
        if (context?.error) return jsonRes(res, 404, { ok: false, error: context.error });
        jsonRes(res, 200, { ok: true, context });
      }
    },
    'POST /api/v1/ai/chat/contextual': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: Record<string, any>;
        try { payload = JSON.parse(body); } catch { return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' }); }
        if (!payload.projectId || !payload.prompt) return jsonRes(res, 400, { ok: false, error: 'Missing "projectId" and/or "prompt"' });
        const result = await queryRenderer('contextualAiChat', payload.projectId, payload.prompt, { model: payload.model || null });
        if (result?.error && !result?.text) return jsonRes(res, 500, { ok: false, error: result.error });
        jsonRes(res, 200, { ok: true, ...result });
      }
    },
  };

  // ═══ HTTP Server 启动 ═══
  const apiServer = http.createServer(async (req, res) => {
    setHeaders(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (!verifyToken(req)) return jsonRes(res, 401, { ok: false, error: 'Unauthorized' });

    const urlObj = new URL(req.url || '/', `http://127.0.0.1:${API_PORT}`);
    const routeKey = `${req.method} ${urlObj.pathname}`;
    const route = routeHandlers[routeKey];
    if (route) {
      try { await route.handler(req, res, urlObj); } catch (e: any) {
        console.error(`[API Server] Error ${routeKey}:`, e);
        jsonRes(res, 500, { ok: false, error: e.message });
      }
      return;
    }

    if (req.method === 'GET' && urlObj.pathname.startsWith('/api/v1/settings/')) {
      const key = urlObj.pathname.replace('/api/v1/settings/', '');
      const settings = await queryRenderer('getSettings');
      jsonRes(res, 200, { ok: true, key, value: settings?.[key] ?? null });
      return;
    }

    if (urlObj.pathname === '/' || urlObj.pathname === '') {
      jsonRes(res, 200, { ok: true, message: '🧪 SciFlow Pro API Server is running!', version: app.getVersion(), docs: `http://127.0.0.1:${API_PORT}/api/v1/openapi`, endpoints: Object.keys(routeHandlers) });
      return;
    }

    jsonRes(res, 404, { ok: false, error: `Route not found: ${req.method} ${urlObj.pathname}` });
  });

  apiServer.listen(API_PORT, '127.0.0.1', () => {
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  🧪 SciFlow Pro API Server`);
    console.log(`  📡 http://127.0.0.1:${API_PORT}`);
    console.log(`  📄 API Docs: http://127.0.0.1:${API_PORT}/api/v1/openapi`);
    console.log(`═══════════════════════════════════════════════════\n`);
  });

  apiServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[API Server] Port ${API_PORT} already in use.`);
    } else {
      console.error('[API Server] Failed:', err);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ═══ 全局链接处理 ═══
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const isExternal = url.startsWith('http:') || url.startsWith('https:');
    const isLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
    if (isExternal && !isLocalhost) { event.preventDefault(); shell.openExternal(url); }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
