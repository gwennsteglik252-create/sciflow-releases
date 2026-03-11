import { app, BrowserWindow, ipcMain, dialog, shell, powerSaveBlocker } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import os from 'os';
import { fileURLToPath } from 'url';
// Fix: Import process to satisfy type checker in modern ESM Node.js environments
import process from 'node:process';
// 注意：不再使用 electron-updater / Squirrel.Mac（需要 Apple 开发者证书才能工作）
// 改为通过 GitHub API 检测新版本 + 引导用户手动下载 DMG

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

// ═══ 防止 macOS/Chromium 后台节流（必须在 app.whenReady 之前） ═══
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// ═══ 授权系统 (License System) ═══
import crypto from 'crypto';

const LICENSE_SECRET = 'SciFlowPro2026-LXJ-SecretKey-HMAC';
const TRIAL_DAYS = 14;

/** 获取授权数据文件路径 */
function getLicenseFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'license.json');
}

/** 生成设备指纹（基于用户名+平台+应用路径的哈希） */
function getMachineId(): string {
  const raw = `${(process as any).platform}-${require('os').hostname()}-${require('os').userInfo().username}-SciFlowPro`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/** 读取授权文件 */
function readLicenseData(): any {
  const filePath = getLicenseFilePath();
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

/** 写入授权文件 */
function writeLicenseData(data: any): void {
  const filePath = getLicenseFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 验证激活码（离线 HMAC-SHA256 校验） */
function verifyActivationCode(code: string): boolean {
  // 激活码格式: SCIFLOW-XXXX-XXXX-XXXX-XXXX
  const cleaned = code.trim().toUpperCase();
  if (!/^SCIFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned)) {
    return false;
  }

  // 提取数据部分和校验部分
  const parts = cleaned.replace('SCIFLOW-', '').split('-');
  const dataPart = parts.slice(0, 3).join('');  // 前3段是数据
  const checkPart = parts[3];                     // 最后1段是校验码

  // 使用 HMAC-SHA256 生成校验码并取前4位
  const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(dataPart).digest('hex').toUpperCase();
  const expectedCheck = hmac.substring(0, 4);

  return checkPart === expectedCheck;
}

/** 获取完整的授权状态 */
function getLicenseState(): any {
  const machineId = getMachineId();
  const data = readLicenseData();

  // 已激活
  if (data?.status === 'activated' && data?.activationCode) {
    return {
      status: 'activated',
      activationCode: data.activationCode,
      activatedAt: data.activatedAt,
      machineId,
    };
  }

  // 计算试用状态
  let trialStartDate = data?.trialStartDate;
  if (!trialStartDate) {
    // 首次启动，初始化试用期
    trialStartDate = new Date().toISOString();
    writeLicenseData({ status: 'trial', trialStartDate, machineId });
  }

  const startDate = new Date(trialStartDate);
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - diffDays);

  if (remaining <= 0) {
    return { status: 'expired', trialStartDate, trialDaysRemaining: 0, machineId };
  }

  return { status: 'trial', trialStartDate, trialDaysRemaining: remaining, machineId };
}

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

  // In production, load the built index.html
  // In development, load the vite dev server
  const isDev = (process as any).env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(_dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 防止 macOS App Nap 挂起整个进程
  powerSaveBlocker.start('prevent-app-suspension');

  // ═══ CORS 绕过：允许渲染进程访问所有第三方 API（COD、AI 代理等） ═══
  const { session } = require('electron');
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*/*'] },
    (details: any, callback: any) => {
      delete details.requestHeaders['Origin'];
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['https://*/*'] },
    (details: any, callback: any) => {
      details.responseHeaders['access-control-allow-origin'] = ['*'];
      details.responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
      details.responseHeaders['access-control-allow-headers'] = ['*'];
      callback({ responseHeaders: details.responseHeaders });
    }
  );

  createWindow();

  // ═══ 本地 HTTP API Server（供 OpenClaw 等外部 AI Agent 调用） ═══
  const API_PORT = 17930;
  const API_TOKEN_KEY = 'sciflow_api_token';

  /** 从渲染进程 localStorage 读取数据（通过 IPC 桥接） */
  const queryRenderer = async (channel: string, ...args: any[]): Promise<any> => {
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

  /** 读请求体 */
  const readBody = (req: http.IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk: string) => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

  /** CORS 和通用头 */
  const setHeaders = (res: http.ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Powered-By', 'SciFlow Pro API Server');
  };

  /** JSON 响应 */
  const jsonRes = (res: http.ServerResponse, status: number, data: any) => {
    res.writeHead(status);
    res.end(JSON.stringify(data, null, 2));
  };

  /** Token 验证 */
  const verifyToken = (req: http.IncomingMessage): boolean => {
    // 从 userData 目录读取 token 文件
    const tokenFilePath = path.join(app.getPath('userData'), 'api_token.txt');
    let storedToken = '';
    try {
      if (fs.existsSync(tokenFilePath)) {
        storedToken = fs.readFileSync(tokenFilePath, 'utf-8').trim();
      }
    } catch { /* ignore */ }

    // 如果没有配置 token，允许所有本地请求（首次使用时方便）
    if (!storedToken) return true;

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return token === storedToken;
  };

  /** 生成新的 API Token */
  const generateApiToken = (): string => {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenFilePath = path.join(app.getPath('userData'), 'api_token.txt');
    fs.writeFileSync(tokenFilePath, token, 'utf-8');
    return token;
  };

  /** 路由处理器 */
  const routeHandlers: Record<string, any> = {
    // ── 系统 ──
    'GET /api/v1/status': {
      handler: async (_req, res) => {
        const licState = getLicenseState();
        jsonRes(res, 200, {
          ok: true,
          app: 'SciFlow Pro',
          version: app.getVersion(),
          platform: (process as any).platform,
          arch: (process as any).arch,
          hostname: os.hostname(),
          uptime: process.uptime(),
          license: licState.status,
          pid: process.pid,
        });
      }
    } as any,

    'GET /api/v1/openapi': {
      handler: async (_req, res) => {
        jsonRes(res, 200, {
          openapi: '3.0.3',
          info: {
            title: 'SciFlow Pro Local API',
            version: app.getVersion(),
            description: 'RESTful API for external AI agents (OpenClaw, etc.) to interact with SciFlow Pro',
          },
          servers: [{ url: `http://127.0.0.1:${API_PORT}`, description: 'Local SciFlow Pro Instance' }],
          paths: {
            '/api/v1/status': { get: { summary: '获取系统状态', tags: ['System'] } },
            '/api/v1/settings': { get: { summary: '读取所有设置' }, put: { summary: '更新设置' } },
            '/api/v1/settings/{key}': { get: { summary: '读取特定设置项' } },
            '/api/v1/token': { post: { summary: '生成新的 API Token' } },
            '/api/v1/projects': { get: { summary: '获取项目列表', tags: ['Data'] } },
            '/api/v1/resources': { get: { summary: '获取情报档案（文献列表）', tags: ['Data'] } },
            '/api/v1/ai/chat': { post: { summary: '调用 AI 对话', tags: ['AI'] } },
            '/api/v1/ai/metrics': { get: { summary: '获取 AI 使用指标', tags: ['AI'] } },
            '/api/v1/files/read': { post: { summary: '读取文件内容', tags: ['Files'] } },
            '/api/v1/files/write': { post: { summary: '写入文件', tags: ['Files'] } },
            '/api/v1/files/list': { post: { summary: '列出目录内容', tags: ['Files'] } },
            '/api/v1/workflow/rules': { get: { summary: '获取工作流规则' }, post: { summary: '创建工作流规则' } },
            '/api/v1/broadcast': { post: { summary: '向 SciFlow 渲染进程广播自定义事件' } },
          },
        });
      }
    } as any,

    'POST /api/v1/token': {
      handler: async (_req, res) => {
        const token = generateApiToken();
        jsonRes(res, 200, {
          ok: true,
          token,
          message: 'New API token generated. Save it securely — it will not be shown again.',
          usage: `curl -H "Authorization: Bearer ${token}" http://127.0.0.1:${API_PORT}/api/v1/status`,
        });
      }
    } as any,

    // ── 设置 ──
    'GET /api/v1/settings': {
      handler: async (_req, res) => {
        const settings = await queryRenderer('getSettings');
        jsonRes(res, 200, { ok: true, settings: settings || {} });
      }
    } as any,

    'PUT /api/v1/settings': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let updates: any;
        try { updates = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        await queryRenderer('updateSettings', updates);
        jsonRes(res, 200, { ok: true, message: 'Settings updated' });
      }
    } as any,

    // ── 项目列表 ──
    'GET /api/v1/projects': {
      handler: async (_req, res) => {
        const projects = await queryRenderer('getProjects');
        jsonRes(res, 200, { ok: true, projects: projects || [] });
      }
    } as any,

    // ── 情报档案（文献） ──
    'GET /api/v1/resources': {
      handler: async (_req, res) => {
        const resources = await queryRenderer('getResources');
        jsonRes(res, 200, { ok: true, resources: resources || [] });
      }
    } as any,

    // ── AI 代理 ──
    'POST /api/v1/ai/chat': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.prompt) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "prompt" field' });
        }
        const result = await queryRenderer('aiChat', payload.prompt, payload.model || '');
        if (result === null) {
          return jsonRes(res, 503, { ok: false, error: 'SciFlow Pro renderer is not ready' });
        }
        jsonRes(res, 200, { ok: true, response: result });
      }
    } as any,

    'GET /api/v1/ai/metrics': {
      handler: async (_req, res) => {
        const metrics = await queryRenderer('getAiMetrics');
        jsonRes(res, 200, { ok: true, metrics: metrics || {} });
      }
    } as any,

    // ── 文件操作 ──
    'POST /api/v1/files/read': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.path) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "path" field' });
        }
        if (!fs.existsSync(payload.path)) {
          return jsonRes(res, 404, { ok: false, error: 'File not found' });
        }
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
        } catch (e: any) {
          jsonRes(res, 500, { ok: false, error: e.message });
        }
      }
    } as any,

    'POST /api/v1/files/write': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.path || payload.content === undefined) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "path" or "content" field' });
        }
        try {
          const dir = path.dirname(payload.path);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const encoding = payload.encoding === 'base64' ? 'base64' : 'utf-8';
          fs.writeFileSync(payload.path, payload.content, { encoding } as any);
          jsonRes(res, 200, { ok: true, message: 'File written', path: payload.path });
        } catch (e: any) {
          jsonRes(res, 500, { ok: false, error: e.message });
        }
      }
    } as any,

    'POST /api/v1/files/list': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.path) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "path" field' });
        }
        if (!fs.existsSync(payload.path)) {
          return jsonRes(res, 404, { ok: false, error: 'Directory not found' });
        }
        try {
          const files = fs.readdirSync(payload.path);
          const items = files.map(file => {
            const fullPath = path.join(payload.path, file);
            const stats = fs.statSync(fullPath);
            return {
              name: file,
              path: fullPath,
              isDirectory: stats.isDirectory(),
              ext: path.extname(file),
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
            };
          });
          jsonRes(res, 200, { ok: true, items });
        } catch (e: any) {
          jsonRes(res, 500, { ok: false, error: e.message });
        }
      }
    } as any,

    // ── 工作流规则 ──
    'GET /api/v1/workflow/rules': {
      handler: async (_req, res) => {
        const rules = await queryRenderer('getWorkflowRules');
        jsonRes(res, 200, { ok: true, rules: rules || [] });
      }
    } as any,

    'POST /api/v1/workflow/rules': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        const result = await queryRenderer('addWorkflowRule', payload);
        jsonRes(res, 201, { ok: true, rule: result });
      }
    } as any,

    // ── 广播事件到渲染进程 ──
    'POST /api/v1/broadcast': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.event) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "event" field' });
        }
        await queryRenderer('broadcastEvent', payload.event, payload.detail || {});
        jsonRes(res, 200, { ok: true, message: `Event "${payload.event}" broadcasted` });
      }
    } as any,

    // ═══ ⭐⭐ 中级：文件系统协作 ═══

    // ── 一键配置 OpenClaw 导入管道 ──
    'POST /api/v1/pipeline/setup': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.basePath) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "basePath" field' });
        }
        // 确保目录存在
        if (!fs.existsSync(payload.basePath)) {
          try {
            fs.mkdirSync(payload.basePath, { recursive: true });
          } catch (e: any) {
            return jsonRes(res, 500, { ok: false, error: `Cannot create directory: ${e.message}` });
          }
        }
        // 启动目录监控（主进程侧）
        const watchResult = await new Promise<any>((resolve) => {
          const stats = fs.statSync(payload.basePath);
          if (!stats.isDirectory()) { resolve({ success: false, error: 'Not a directory' }); return; }
          if (watchers.has(payload.basePath)) { resolve({ success: true, message: 'Already watching' }); return; }
          const watcher = fs.watch(payload.basePath, (eventType, filename) => {
            if (filename && eventType === 'rename') {
              const fullPath = path.join(payload.basePath, filename);
              if (fs.existsSync(fullPath)) {
                const wins = BrowserWindow.getAllWindows();
                wins.forEach(w => w.webContents.send('fs-notification', {
                  type: 'added', path: fullPath, name: filename,
                  ext: path.extname(filename), parentDir: payload.basePath
                }));
              }
            }
          });
          watchers.set(payload.basePath, watcher);
          resolve({ success: true });
        });

        // 在渲染进程侧配置工作流规则
        const rules = await queryRenderer('setupPipeline', payload.basePath, payload.types || null);

        jsonRes(res, 201, {
          ok: true,
          message: 'Pipeline configured successfully',
          basePath: payload.basePath,
          watching: watchResult.success,
          rulesCreated: rules?.length || 0,
          rules: rules || [],
          usage: {
            description: 'Drop files into the basePath directory. SciFlow will auto-process them.',
            example: `cp paper.pdf "${payload.basePath}/"`,
          }
        });
      }
    } as any,

    // ── 批量导入文件到管道 ──
    'POST /api/v1/pipeline/ingest': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.files || !Array.isArray(payload.files)) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "files" array. Each file: { name, path, ext }' });
        }
        await queryRenderer('broadcastEvent', 'sciflow-pipeline-ingest', { files: payload.files });
        jsonRes(res, 200, {
          ok: true,
          message: `${payload.files.length} files submitted to pipeline`,
          note: 'Processing is async. Poll /api/v1/events or /api/v1/workflow/logs for results.'
        });
      }
    } as any,

    // ── 手动触发工作流规则 ──
    'POST /api/v1/workflow/trigger': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.ruleId) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "ruleId" field' });
        }
        const result = await queryRenderer('triggerWorkflow', payload.ruleId, payload.fileContext || null);
        if (!result) {
          return jsonRes(res, 404, { ok: false, error: `Rule not found: ${payload.ruleId}` });
        }
        jsonRes(res, 200, { ok: true, log: result });
      }
    } as any,

    // ── 工作流执行日志 ──
    'GET /api/v1/workflow/logs': {
      handler: async (_req, res) => {
        const logs = await queryRenderer('getWorkflowLogs');
        jsonRes(res, 200, { ok: true, logs: logs || [], count: logs?.length || 0 });
      }
    } as any,

    // ── 删除工作流规则 ──
    'DELETE /api/v1/workflow/rules': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.ruleId) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "ruleId" field' });
        }
        const result = await queryRenderer('deleteWorkflowRule', payload.ruleId);
        jsonRes(res, 200, { ok: true, deleted: result });
      }
    } as any,

    // ── 文献资源导入 ──
    'POST /api/v1/resources': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.title) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "title" field' });
        }
        const resource = {
          ...payload,
          id: payload.id || `res_api_${Date.now()}`,
          importedAt: new Date().toISOString(),
          importedBy: 'api',
        };
        const result = await queryRenderer('addResource', resource);
        jsonRes(res, 201, { ok: true, resource: result });
      }
    } as any,

    // ═══ ⭐⭐⭐ 高级：事件系统联动 ═══

    // ── 事件轮询查询 ──
    'GET /api/v1/events': {
      handler: async (req, res, urlObj) => {
        const since = urlObj.searchParams.get('since') || undefined;
        const limit = parseInt(urlObj.searchParams.get('limit') || '50');
        const events = await queryRenderer('getEvents', since || '', limit);
        jsonRes(res, 200, {
          ok: true,
          events: events || [],
          count: events?.length || 0,
          serverTime: new Date().toISOString(),
        });
      }
    } as any,

    // ── SSE 实时事件流 ──
    'GET /api/v1/events/stream': {
      handler: async (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

        let lastEventCount = 0;
        const interval = setInterval(async () => {
          try {
            const count = await queryRenderer('getEventCount');
            if (count > lastEventCount) {
              const newEvents = await queryRenderer('getEvents', '', count - lastEventCount);
              if (newEvents && newEvents.length > 0) {
                for (const evt of newEvents) {
                  res.write(`id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
                }
              }
              lastEventCount = count;
            }
            // 心跳
            res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
          } catch { /* client disconnected */ }
        }, 2000);

        _req.on('close', () => {
          clearInterval(interval);
        });
      }
    } as any,

    // ── 内部状态查询 ──
    'GET /api/v1/internal/state': {
      handler: async (_req, res) => {
        const state = await queryRenderer('getInternalState');
        jsonRes(res, 200, { ok: true, state: state || {} });
      }
    } as any,

    // ═══ 🔬 XRD 表征分析 API ═══

    // ── XRD 原始数据分析 ──
    'POST /api/v1/characterization/xrd/analyze': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }

        let rawDataText = payload.data;

        // 如果提供了文件路径而非内联数据，从文件读取
        if (!rawDataText && payload.filePath) {
          try {
            rawDataText = fs.readFileSync(payload.filePath, 'utf-8');
          } catch (e: any) {
            return jsonRes(res, 400, { ok: false, error: `Cannot read file: ${e.message}` });
          }
        }

        if (!rawDataText) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "data" (inline XRD text) or "filePath" (path to .xy/.csv file)' });
        }

        const result = await queryRenderer('analyzeXrd', rawDataText, payload.options || {});
        if (result?.error) {
          return jsonRes(res, 400, { ok: false, error: result.error });
        }
        jsonRes(res, 200, { ok: true, analysis: result });
      }
    } as any,

    // ── XRD + AI 深度解读 ──
    'POST /api/v1/characterization/xrd/interpret': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }

        let rawDataText = payload.data;
        if (!rawDataText && payload.filePath) {
          try { rawDataText = fs.readFileSync(payload.filePath, 'utf-8'); } catch (e: any) {
            return jsonRes(res, 400, { ok: false, error: `Cannot read file: ${e.message}` });
          }
        }
        if (!rawDataText) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "data" or "filePath"' });
        }

        // Step 1: 执行 XRD 分析
        const xrdResult = await queryRenderer('analyzeXrd', rawDataText, payload.options || {});
        if (xrdResult?.error) {
          return jsonRes(res, 400, { ok: false, error: xrdResult.error });
        }

        // Step 2: 构建 AI 解读 prompt
        const peakTable = (xrdResult.peaks || []).map((p: any, i: number) =>
          `#${i + 1}: 2θ=${p.twoTheta}°, d=${p.dSpacing_angstrom}Å, FWHM=${p.fwhm}°, 晶粒=${p.grainSize_nm}nm, 相对强度=${p.relativeIntensity}%`
        ).join('\n');

        const aiPrompt = `你是XRD衍射数据分析专家。以下是XRD分析结果，请给出学术级的解读报告。

## 数据概况
- 数据点: ${xrdResult.dataPoints}
- 2θ范围: ${xrdResult.twoThetaRange?.min}° - ${xrdResult.twoThetaRange?.max}°
- 射线源: ${xrdResult.wavelength?.source} (λ=${xrdResult.wavelength?.value}nm)
- 噪声水平: ${xrdResult.diagnosis?.noiseLevel} (SNR=${xrdResult.diagnosis?.snr})

## 检测到的衍射峰 (${xrdResult.peaks?.length || 0} 个)
${peakTable || '无峰检测到'}

## 统计
- 平均晶粒尺寸: ${xrdResult.statistics?.avgGrainSize_nm}nm
- 结晶性: ${xrdResult.statistics?.crystallinity}

${payload.sampleInfo ? `## 样品信息\n${payload.sampleInfo}` : ''}
${payload.question ? `## 用户特定问题\n${payload.question}` : ''}

请输出:
1. **物相推测**: 根据峰位和d值推测可能的物相
2. **结晶性评估**: 评估样品的结晶程度和晶粒质量
3. **异常诊断**: 指出不寻常的峰或数据特征
4. **实验建议**: 下一步表征建议`;

        const aiResult = await queryRenderer('aiChat', aiPrompt, payload.model || null);

        jsonRes(res, 200, {
          ok: true,
          analysis: xrdResult,
          interpretation: {
            text: aiResult?.text || '',
            model: aiResult?.model || 'auto',
          }
        });
      }
    } as any,

    // ── XRD 射线源列表 ──
    'GET /api/v1/characterization/xrd/sources': {
      handler: async (_req, res) => {
        const sources = await queryRenderer('getXrdSources');
        jsonRes(res, 200, { ok: true, sources: sources || {} });
      }
    } as any,

    // ═══ 🧠 项目上下文感知 AI ═══

    // ── 获取项目上下文 ──
    'POST /api/v1/projects/context': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.projectId) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "projectId" field' });
        }
        const context = await queryRenderer('getProjectContext', payload.projectId);
        if (context?.error) {
          return jsonRes(res, 404, { ok: false, error: context.error });
        }
        jsonRes(res, 200, { ok: true, context });
      }
    } as any,

    // ── 上下文感知 AI 对话 ──
    'POST /api/v1/ai/chat/contextual': {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload: any;
        try { payload = JSON.parse(body); } catch {
          return jsonRes(res, 400, { ok: false, error: 'Invalid JSON body' });
        }
        if (!payload.projectId || !payload.prompt) {
          return jsonRes(res, 400, { ok: false, error: 'Missing "projectId" and/or "prompt" field' });
        }
        const result = await queryRenderer('contextualAiChat', payload.projectId, payload.prompt, {
          model: payload.model || null,
        });
        if (result?.error && !result?.text) {
          return jsonRes(res, 500, { ok: false, error: result.error });
        }
        jsonRes(res, 200, { ok: true, ...result });
      }
    } as any,
  };

  /** 启动 HTTP Server */
  const apiServer = http.createServer(async (req, res) => {
    setHeaders(res);

    // 处理 CORS 预检
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token 验证
    if (!verifyToken(req)) {
      return jsonRes(res, 401, { ok: false, error: 'Unauthorized. Provide a valid Bearer token.' });
    }

    const urlObj = new URL(req.url || '/', `http://127.0.0.1:${API_PORT}`);
    const routeKey = `${req.method} ${urlObj.pathname}`;

    // 精确匹配路由
    const route = routeHandlers[routeKey];
    if (route) {
      try {
        await (route as any).handler(req, res, urlObj);
      } catch (e: any) {
        console.error(`[API Server] Error handling ${routeKey}:`, e);
        jsonRes(res, 500, { ok: false, error: e.message || 'Internal server error' });
      }
      return;
    }

    // 子路径匹配：GET /api/v1/settings/:key
    if (req.method === 'GET' && urlObj.pathname.startsWith('/api/v1/settings/')) {
      const key = urlObj.pathname.replace('/api/v1/settings/', '');
      const settings = await queryRenderer('getSettings');
      const value = settings?.[key];
      jsonRes(res, 200, { ok: true, key, value: value !== undefined ? value : null });
      return;
    }

    // 根路径：友好欢迎页
    if (urlObj.pathname === '/' || urlObj.pathname === '') {
      jsonRes(res, 200, {
        ok: true,
        message: '🧪 SciFlow Pro API Server is running!',
        version: app.getVersion(),
        docs: `http://127.0.0.1:${API_PORT}/api/v1/openapi`,
        endpoints: Object.keys(routeHandlers),
      });
      return;
    }

    jsonRes(res, 404, { ok: false, error: `Route not found: ${req.method} ${urlObj.pathname}` });
  });

  apiServer.listen(API_PORT, '127.0.0.1', () => {
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  🧪 SciFlow Pro API Server`);
    console.log(`  📡 http://127.0.0.1:${API_PORT}`);
    console.log(`  📄 API Docs: http://127.0.0.1:${API_PORT}/api/v1/openapi`);
    console.log(`  🔑 Generate Token: POST http://127.0.0.1:${API_PORT}/api/v1/token`);
    console.log(`═══════════════════════════════════════════════════\n`);
  });

  apiServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[API Server] Port ${API_PORT} is already in use. API Server disabled.`);
    } else {
      console.error('[API Server] Failed to start:', err);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ═══ 自动更新系统（GitHub API 版本检测 + 手动下载） ═══
  // 不使用 electron-updater / Squirrel.Mac，因为 macOS 的 ShipIt 需要 Apple 开发者证书
  const GITHUB_REPO = 'gwennsteglik252-create/sciflow-releases';
  const RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

  const sendUpdateStatus = (data: any) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(w => w.webContents.send('update-status', data));
  };

  /**
   * 通过 GitHub API 检测是否有新版本
   * 比较当前版本与 GitHub 最新 Release 的 tag
   */
  async function checkForUpdateViaGitHub(): Promise<{ hasUpdate: boolean; version?: string; releaseDate?: string; releaseNotes?: string }> {
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
      });
      if (!response.ok) throw new Error(`GitHub API 返回 ${response.status}`);

      const release = await response.json() as any;
      const latestVersion = release.tag_name?.replace(/^v/, '') || '';
      const currentVersion = app.getVersion();

      // 简单版本比较（支持 major.minor.patch）
      const isNewer = compareVersions(latestVersion, currentVersion) > 0;

      return {
        hasUpdate: isNewer,
        version: latestVersion,
        releaseDate: release.published_at,
        releaseNotes: release.body || '',
      };
    } catch (err: any) {
      console.error('[Update] GitHub API 检查失败:', err.message);
      throw err;
    }
  }

  /** 语义化版本比较: 返回 1 (a > b), -1 (a < b), 0 (a == b) */
  function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  // IPC：手动检查更新
  ipcMain.handle('check-for-updates', async () => {
    try {
      sendUpdateStatus({ status: 'checking' });
      const result = await checkForUpdateViaGitHub();

      if (result.hasUpdate) {
        sendUpdateStatus({
          status: 'available',
          version: result.version,
          releaseDate: result.releaseDate,
          releaseNotes: result.releaseNotes,
        });
        return { success: true, version: result.version };
      } else {
        sendUpdateStatus({
          status: 'not-available',
          version: result.version,
        });
        return { success: true, version: result.version, upToDate: true };
      }
    } catch (err: any) {
      sendUpdateStatus({
        status: 'error',
        message: err?.message || '检查更新失败',
      });
      return { success: false, message: err?.message || '检查更新失败' };
    }
  });

  // IPC：打开 GitHub Release 页面下载更新
  ipcMain.handle('download-update', async () => {
    try {
      shell.openExternal(RELEASE_URL);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || '打开下载页面失败' };
    }
  });

  // IPC：install-update → 打开下载页面（无 Squirrel）
  ipcMain.handle('install-update', () => {
    shell.openExternal(RELEASE_URL);
  });

  // IPC：获取当前应用版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // ═══ 授权系统 IPC ═══
  ipcMain.handle('get-license-state', () => {
    return getLicenseState();
  });

  ipcMain.handle('activate-license', async (_event, code: string) => {
    if (!verifyActivationCode(code)) {
      return { success: false, error: '激活码无效，请检查后重试' };
    }

    const machineId = getMachineId();
    writeLicenseData({
      status: 'activated',
      activationCode: code.trim().toUpperCase(),
      activatedAt: new Date().toISOString(),
      machineId,
    });

    return { success: true };
  });

  ipcMain.handle('reset-trial', () => {
    // 仅开发环境可用
    const isDev2 = (process as any).env.NODE_ENV === 'development' || !app.isPackaged;
    if (!isDev2) return { success: false, error: '仅开发环境可用' };
    writeLicenseData({
      status: 'trial',
      trialStartDate: new Date().toISOString(),
      machineId: getMachineId(),
    });
    return { success: true };
  });

  // 生产环境下，启动 5 秒后自动检查一次更新
  const isDev = (process as any).env.NODE_ENV === 'development' || !app.isPackaged;
  if (!isDev) {
    setTimeout(() => {
      checkForUpdateViaGitHub()
        .then(result => {
          if (result.hasUpdate) {
            sendUpdateStatus({
              status: 'available',
              version: result.version,
              releaseDate: result.releaseDate,
              releaseNotes: result.releaseNotes,
            });
          }
        })
        .catch(() => { });
    }, 5000);
  }
});

// Added: Global link handling for all windows/iframes
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const isExternal = url.startsWith('http:') || url.startsWith('https:');
    const isLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');

    if (isExternal && !isLocalhost) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
});

// ═══ 原生截屏 API（替代 html-to-image，性能提升 100x+） ═══
ipcMain.handle('capture-page', async (_event, rect?: { x: number; y: number; width: number; height: number }) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return null;

  try {
    let image;
    if (rect) {
      // 直接截取指定区域，无需全屏截图后裁剪
      image = await win.webContents.capturePage(rect);
    } else {
      image = await win.webContents.capturePage();
    }
    // 返回 base64 PNG 数据
    return image.toPNG().toString('base64');
  } catch (err) {
    console.error('capturePage failed:', err);
    return null;
  }
});

app.on('window-all-closed', () => {
  // Fix: Cast process to any to avoid "Property 'platform' does not exist on type 'Process'" error
  if ((process as any).platform !== 'darwin') app.quit();
});

// Path memory: remembers last-used directory for each upload context
const lastUsedPaths: Record<string, string> = {};

ipcMain.handle('select-local-file', async (_event, arg?: string | { contextKey?: string; multiple?: boolean }) => {
  const contextKey = typeof arg === 'string' ? arg : arg?.contextKey;
  const multiple = typeof arg === 'object' ? !!arg?.multiple : false;
  const win = BrowserWindow.getFocusedWindow();
  const defaultPath = contextKey && lastUsedPaths[contextKey] ? lastUsedPaths[contextKey] : undefined;
  const result = await dialog.showOpenDialog(win!, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    defaultPath,
    filters: [
      { name: 'All Supported Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'docx', 'doc', 'txt', 'csv', 'xy', 'md', 'json', 'xlsx', 'xls', 'h5', 'ipynb', 'mp4', 'mov', 'avi', 'mp3', 'wav', 'py', 'r', 'js', 'ts', 'cpp', 'h', 'pptx', 'ppt', 'rtf'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
      { name: 'Scientific Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'csv', 'xy', 'md', 'json'] },
      { name: 'Research Data', extensions: ['csv', 'xlsx', 'xls', 'json', 'h5', 'ipynb'] },
      { name: 'Media', extensions: ['mp4', 'mov', 'avi', 'mp3', 'wav'] },
      { name: 'Source Code', extensions: ['py', 'r', 'js', 'ts', 'cpp', 'h'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  // Store the directory for this context
  if (contextKey) {
    lastUsedPaths[contextKey] = path.dirname(filePath);
  }

  if (multiple) {
    return result.filePaths.map((p) => ({
      name: path.basename(p),
      path: p
    }));
  }

  return { name: path.basename(filePath), path: filePath };
});
ipcMain.handle('select-directory', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('open-path', async (_event, targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    return await shell.openPath(targetPath);
  }
  return 'File not found';
});

ipcMain.handle('save-file', async (_event, opts: { name: string; content: string; defaultPath?: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: opts.defaultPath ? path.join(opts.defaultPath, opts.name) : opts.name,
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  try {
    fs.writeFileSync(result.filePath, opts.content);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    console.error('Failed to save file:', err);
    return { success: false };
  }
});

ipcMain.handle('read-file', async (_event, targetPath: string) => {
  if (!fs.existsSync(targetPath)) return null;

  try {
    const ext = path.extname(targetPath).toLowerCase();

    // 使用异步读取防止主进程阻塞，解决大文件读取时的卡顿问题
    if (ext === '.pdf') {
      const data = await fs.promises.readFile(targetPath, { encoding: 'base64' });
      return { mimeType: 'application/pdf', data };
    }
    else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      const data = await fs.promises.readFile(targetPath, { encoding: 'base64' });
      return { mimeType: `image/${ext.replace('.', '')}`, data };
    }
    else {
      const data = await fs.promises.readFile(targetPath, 'utf-8');
      return { mimeType: 'text/plain', data };
    }
  } catch (e) {
    console.error("Read file error:", e);
    return null;
  }
});

ipcMain.handle('show-item-in-folder', async (_event, targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    shell.showItemInFolder(targetPath);
  }
});

// Directory Watcher Implementation
const watchers = new Map<string, fs.FSWatcher>();

ipcMain.handle('watch-directory', async (event, targetPath: string) => {
  if (!fs.existsSync(targetPath)) return { success: false, error: 'Directory not found' };

  const stats = fs.statSync(targetPath);
  if (!stats.isDirectory()) return { success: false, error: 'Path is not a directory' };

  if (watchers.has(targetPath)) return { success: true, message: 'Already watching' };

  try {
    const watcher = fs.watch(targetPath, (eventType, filename) => {
      if (filename && eventType === 'rename') {
        const fullPath = path.join(targetPath, filename);
        if (fs.existsSync(fullPath)) {
          // File Added (or renamed to existing)
          event.sender.send('fs-notification', {
            type: 'added',
            path: fullPath,
            name: filename,
            ext: path.extname(filename),
            parentDir: targetPath
          });
        }
      }
    });

    watchers.set(targetPath, watcher);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-directory', async (_event, targetPath: string) => {
  if (!fs.existsSync(targetPath)) return [];
  try {
    const files = fs.readdirSync(targetPath);
    return files.map(file => {
      const fullPath = path.join(targetPath, file);
      const stats = fs.statSync(fullPath);
      return {
        name: file,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        ext: path.extname(file),
        size: stats.size,
        lastModified: stats.mtime
      };
    });
  } catch (err) {
    console.error('List directory error:', err);
    return [];
  }
});

ipcMain.handle('unwatch-directory', async (_event, targetPath: string) => {
  const watcher = watchers.get(targetPath);
  if (watcher) {
    watcher.close();
    watchers.delete(targetPath);
    return { success: true };
  }
  return { success: false, error: 'Not watching this path' };
});

ipcMain.handle('http-request', async (_event, payload: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => {
  try {
    if (!payload?.url || !/^https?:\/\//i.test(payload.url)) {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        body: 'Invalid URL'
      };
    }

    const response = await fetch(payload.url, {
      method: payload.method || 'GET',
      headers: payload.headers || {},
      body: payload.body
    });

    const headerObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headerObj[key] = value;
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: headerObj,
      body: text
    };
  } catch (error: any) {
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      headers: {},
      body: error?.message || 'Unknown error'
    };
  }
});

// ═══ 弹出独立窗口（Tab Tear-Off） ═══
ipcMain.handle('open-popout-window', async (_event, payload: { viewId: string; title: string }) => {
  const { viewId, title } = payload;

  const popout = new BrowserWindow({
    width: 1000,
    height: 700,
    title: title || 'SciFlow Pro',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(_dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  const isDev = (process as any).env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    popout.loadURL(`http://localhost:5173?popout=${encodeURIComponent(viewId)}`);
  } else {
    // For production, load file with query string
    popout.loadFile(path.join(_dirname, '../dist/index.html'), {
      query: { popout: viewId },
    });
  }

  return { success: true };
});
