/**
 * PDF 全文下载服务
 * 校园网 DOI 直链 → Unpaywall (OA) → Sci-Hub（用户自配）→ wytsg 图书馆通道
 */

const UNPAYWALL_EMAIL = 'sciflowpro@gmail.com';

export interface PdfDownloadResult {
  success: boolean;
  pdfUrl?: string;
  source?: 'campus_doi' | 'unpaywall' | 'scihub' | 'direct' | 'wytsg';
  error?: string;
}

// ─── 校园网 DOI 直链下载 ───────────────────────────────
const CAMPUS_DOI_KEY = 'sciflow_campus_doi_enabled';

export const getCampusDoiEnabled = (): boolean => {
  return localStorage.getItem(CAMPUS_DOI_KEY) === 'true';
};

export const setCampusDoiEnabled = (enabled: boolean): void => {
  localStorage.setItem(CAMPUS_DOI_KEY, String(enabled));
};

/**
 * 通过校园网/VPN 直接从出版商下载 PDF
 * 核心原理：通过 Electron 的 http-request IPC 绕过 CORS，解析 DOI 获取出版商 PDF 链接
 */
export const getCampusDoiPdfUrl = async (doi: string): Promise<PdfDownloadResult> => {
  if (!doi) return { success: false, error: '无 DOI' };
  if (!getCampusDoiEnabled()) return { success: false, error: '校园网直链未启用' };

  const cleanDoi = doi.replace('https://doi.org/', '').trim();
  const doiUrl = `https://doi.org/${cleanDoi}`;
  console.log('[CampusDOI] Resolving:', doiUrl);

  try {
    const electron = (window as any).electron;
    // 使用 Electron http-request IPC 绕过 CORS
    if (electron?.httpRequest) {
      const res = await electron.httpRequest({
        url: doiUrl,
        method: 'GET',
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SciFlow/1.0',
        }
      });

      if (res.ok && res.body) {
        // 从响应中提取 PDF 链接
        const pdfUrl = extractPdfUrlFromHtml(res.body, doiUrl);
        if (pdfUrl) {
          console.log('[CampusDOI] Found PDF URL:', pdfUrl);
          return { success: true, pdfUrl, source: 'campus_doi' };
        }

        // 尝试构造出版商的 PDF 直链
        const constructedUrl = constructPublisherPdfUrl(doiUrl, cleanDoi, res.body);
        if (constructedUrl) {
          console.log('[CampusDOI] Constructed PDF URL:', constructedUrl);
          return { success: true, pdfUrl: constructedUrl, source: 'campus_doi' };
        }
      }
    } else {
      // 浏览器环境：直接尝试 fetch（CORS 可能失败）
      try {
        const res = await fetch(doiUrl, {
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
          headers: { 'Accept': 'text/html' },
        });
        if (res.ok) {
          const html = await res.text();
          const pdfUrl = extractPdfUrlFromHtml(html, res.url);
          if (pdfUrl) return { success: true, pdfUrl, source: 'campus_doi' };
        }
      } catch { }
    }

    return { success: false, error: '校园网下未找到 PDF 链接' };
  } catch (e) {
    console.warn('[CampusDOI] Error:', e);
    return { success: false, error: '校园网直链解析失败' };
  }
};

/**
 * 从 HTML 页面中提取 PDF 下载链接
 */
function extractPdfUrlFromHtml(html: string, pageUrl: string): string | null {
  // 通用 PDF 链接模式
  const patterns = [
    // meta citation_pdf_url (大多数出版商都支持)
    /meta\s+name=["']citation_pdf_url["']\s+content=["']([^"']+)/i,
    /meta\s+content=["']([^"']+)["']\s+name=["']citation_pdf_url["']/i,
    // PDF 直链
    /href=["'](https?:\/\/[^"']*\.pdf(?:\?[^"']*)?)["']/i,
    // Elsevier "Download PDF" link
    /href=["'](https?:\/\/[^"']*\/pii\/[^"']*\?[^"']*pdf[^"']*)/i,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (match?.[1]) {
      let url = match[1];
      // 处理相对路径
      if (url.startsWith('/')) {
        try {
          const base = new URL(pageUrl);
          url = `${base.origin}${url}`;
        } catch { }
      }
      return url;
    }
  }
  return null;
}

/**
 * 根据出版商规则构造 PDF URL
 */
function constructPublisherPdfUrl(doiUrl: string, doi: string, html: string): string | null {
  // Elsevier / ScienceDirect
  const sdMatch = html.match(/sciencedirect\.com\/science\/article\/pii\/([A-Z0-9]+)/i);
  if (sdMatch) return `https://www.sciencedirect.com/science/article/pii/${sdMatch[1]}/pdfft`;

  // Springer
  const springerMatch = doi.match(/10\.1007\/(.+)/);
  if (springerMatch) return `https://link.springer.com/content/pdf/${doi}.pdf`;

  // Nature
  if (doi.startsWith('10.1038/')) return `https://www.nature.com/articles/${doi.replace('10.1038/', '')}.pdf`;

  // Wiley
  const wileyMatch = doi.match(/10\.1002\/(.+)/);
  if (wileyMatch) return `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`;

  // ACS
  if (doi.startsWith('10.1021/')) return `https://pubs.acs.org/doi/pdf/${doi}`;

  // RSC
  if (doi.startsWith('10.1039/')) return `https://pubs.rsc.org/en/content/articlepdf/${new Date().getFullYear()}/${doi}`;

  // IEEE
  const ieeeMatch = html.match(/ieeexplore\.ieee\.org\/document\/(\d+)/i);
  if (ieeeMatch) return `https://ieeexplore.ieee.org/stampPDF/getPDF.jsp?arnumber=${ieeeMatch[1]}`;

  return null;
}

// ─── wytsg 图书馆通道配置 ─────────────────────────────────
export interface WytsgConfig {
  cardNo: string;
  password: string;
  enabled: boolean;
  cachedMirrorUrl: string;  // 缓存的 Sci-Hub 镜像地址
  cachedAt: number;         // 缓存时间戳
}

const WYTSG_CONFIG_KEY = 'sciflow_wytsg_config';
const WYTSG_MIRROR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时过期
const WYTSG_DEFAULT_MIRROR = 'https://www.tesble.com';

export const getWytsgConfig = (): WytsgConfig => {
  try {
    const raw = localStorage.getItem(WYTSG_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return { cardNo: '', password: '', enabled: false, cachedMirrorUrl: '', cachedAt: 0 };
};

export const setWytsgConfig = (config: Partial<WytsgConfig>): void => {
  const current = getWytsgConfig();
  localStorage.setItem(WYTSG_CONFIG_KEY, JSON.stringify({ ...current, ...config }));
};

/**
 * 动态解析 wytsg.com 最新的 Sci-Hub 镜像地址
 * 从 ShowInfo.php?id=3457 中提取跳转链接
 * 如果解析失败，使用缓存或默认地址
 */
export const resolveWytsgScihubMirror = async (): Promise<string> => {
  const config = getWytsgConfig();

  // 如果缓存未过期，直接使用
  if (config.cachedMirrorUrl && (Date.now() - config.cachedAt) < WYTSG_MIRROR_CACHE_TTL) {
    console.log('[wytsg] Using cached mirror:', config.cachedMirrorUrl);
    return config.cachedMirrorUrl;
  }

  // 尝试从 wytsg.com 动态获取（通过 Electron httpRequest 绕过 CORS）
  try {
    const electron = (window as any).electron;
    let html = '';

    if (electron?.httpRequest) {
      // 优先使用 Electron IPC 绕过 CORS
      const res = await electron.httpRequest({
        url: 'http://www.wytsg.com/e/action/ShowInfo.php?classid=200&id=3457',
        method: 'GET',
        headers: { 'Accept': 'text/html' }
      });
      if (res.ok) html = res.body || '';
    } else {
      // 浏览器回退（大概率会 CORS 失败）
      try {
        const res = await fetch('http://www.wytsg.com/e/action/ShowInfo.php?classid=200&id=3457', {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) html = await res.text();
      } catch { }
    }

    if (html) {
      // 从页面 HTML 中提取 Sci-Hub 镜像链接
      const urlMatch = html.match(/href=["'](https?:\/\/[^"']*(?:sci-hub|tesble|sci\.hub)[^"']*)/i)
        || html.match(/href=["'](https?:\/\/(?:www\.)?[a-z0-9.-]+\.[a-z]{2,})/gi);
      if (urlMatch) {
        const mirrorUrl = urlMatch[1] || urlMatch[0].replace(/^href=["']/, '');
        const cleanUrl = mirrorUrl.replace(/\/+$/, '');
        console.log('[wytsg] Resolved mirror:', cleanUrl);
        setWytsgConfig({ cachedMirrorUrl: cleanUrl, cachedAt: Date.now() });
        return cleanUrl;
      }
    }
  } catch (e) {
    console.warn('[wytsg] Failed to resolve mirror, using fallback:', e);
  }

  // 回退：使用缓存地址或默认地址
  const fallback = config.cachedMirrorUrl || WYTSG_DEFAULT_MIRROR;
  console.log('[wytsg] Using fallback mirror:', fallback);
  return fallback;
};

// ─── wytsg WebView 登录相关 ───────────────────────────────
/**
 * 打开 wytsg.com 登录窗口（Electron WebView）
 */
export const openWytsgLogin = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
  const electron = (window as any).electron;
  if (electron?.openWytsgLogin) {
    return await electron.openWytsgLogin();
  }
  return { success: false, error: '需要重启应用以启用此功能' };
};

// ─── wytsg 凭据管理 ────────────────────────────────────
/**
 * 保存 wytsg.com 账号密码
 */
export const saveWytsgCredentials = async (username: string, password: string): Promise<boolean> => {
  const electron = (window as any).electron;
  if (electron?.saveWytsgCredentials) {
    const result = await electron.saveWytsgCredentials({ username, password });
    return result?.success || false;
  }
  return false;
};

/**
 * 获取已保存的 wytsg.com 凭据
 */
export const getWytsgCredentials = async (): Promise<{ saved: boolean; username?: string; password?: string }> => {
  const electron = (window as any).electron;
  if (electron?.getWytsgCredentials) {
    return await electron.getWytsgCredentials();
  }
  return { saved: false };
};

// ─── wytsg 全自动登录（AI 验证码识别） ──────────────────
/**
 * 自动登录 wytsg.com
 * 流程：获取验证码图片 → AI 识别 → 提交表单
 * @param maxRetries 最多重试次数（验证码识别可能偶尔出错）
 */
export const autoWytsgLogin = async (
  username: string,
  password: string,
  maxRetries = 3,
  onStatus?: (msg: string) => void,
): Promise<{ success: boolean; error?: string }> => {
  const electron = (window as any).electron;
  if (!electron?.wytsgGetCaptcha || !electron?.wytsgAutoLoginSubmit) {
    return { success: false, error: '应用版本不支持自动登录，请重启' };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      onStatus?.(`正在获取验证码... (${attempt}/${maxRetries})`);

      // 1. 获取验证码图片
      const captchaResult = await electron.wytsgGetCaptcha();
      if (!captchaResult?.success || !captchaResult.captchaBase64) {
        return { success: false, error: captchaResult?.error || '获取验证码失败' };
      }

      onStatus?.('AI 正在识别验证码...');

      // 2. AI 识别验证码
      const captchaText = await recognizeCaptcha(captchaResult.captchaBase64, captchaResult.mimeType);
      if (!captchaText) {
        if (attempt < maxRetries) continue; // 重试
        return { success: false, error: 'AI 无法识别验证码' };
      }

      onStatus?.(`验证码: ${captchaText}，正在登录...`);

      // 3. 提交登录
      const loginResult = await electron.wytsgAutoLoginSubmit({
        username,
        password,
        captcha: captchaText,
      });

      if (loginResult?.success) {
        return { success: true };
      }

      // 可重试的错误（验证码错误、服务器拒绝等）
      if ((loginResult?.retryable || loginResult?.error?.includes('验证码')) && attempt < maxRetries) {
        onStatus?.(`${loginResult?.error || '登录失败'}，重试中... (${attempt}/${maxRetries})`);
        continue;
      }

      return { success: false, error: loginResult?.error || '登录失败' };
    } catch (err: any) {
      if (attempt < maxRetries) continue;
      return { success: false, error: err.message || '自动登录出错' };
    }
  }

  return { success: false, error: '多次尝试均失败' };
};

/**
 * 使用 AI 模型识别验证码图片
 */
async function recognizeCaptcha(base64: string, mimeType: string): Promise<string | null> {
  try {
    const { UniversalAIAdapter } = await import('./gemini/core/adapter');
    const ai = new UniversalAIAdapter();
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: base64,
              },
            },
            {
              text: '这是一张网站登录验证码图片，通常为4位数字或字母组合。请仔细识别图中的每个字符，只输出验证码字符本身，不要输出任何说明文字或多余字符。注意区分：0和O、1和l、8和B等易混淆字符。',
            },
          ],
        },
      ],
    });
    const text = (result?.text || '').trim().replace(/[^a-zA-Z0-9]/g, '');
    return text || null;
  } catch (err) {
    console.error('[wytsg] Captcha recognition failed:', err);
    return null;
  }
}

/**
 * 获取 wytsg.com 登录状态
 */
export const getWytsgLoginStatus = async (): Promise<{
  loggedIn: boolean;
  expired?: boolean;
}> => {
  const electron = (window as any).electron;
  if (electron?.getWytsgCookies) {
    const result = await electron.getWytsgCookies();
    return {
      loggedIn: result.loggedIn || false,
      expired: result.expired,
    };
  }
  return { loggedIn: false };
};

/**
 * 通过 wytsg 图书馆通道获取 PDF URL
 * 优先级：WebView 登录 Cookie → Sci-Hub 镜像页面解析
 */
export const getWytsgPdfUrl = async (doi: string): Promise<PdfDownloadResult> => {
  if (!doi) return { success: false, error: '无 DOI' };

  const config = getWytsgConfig();
  if (!config.enabled) {
    return { success: false, error: '图书馆通道未启用' };
  }

  const cleanDoi = doi.replace('https://doi.org/', '').trim();
  const electron = (window as any).electron;

  // 方式 1：通过 WebView 登录 Cookie（优先）
  if (electron?.wytsgDownloadPdf) {
    console.log('[wytsg] Trying WebView login channel...');
    const result = await electron.wytsgDownloadPdf(cleanDoi);
    if (result.success && result.pdfUrl) {
      console.log('[wytsg] WebView channel found PDF:', result.pdfUrl);
      return { success: true, pdfUrl: result.pdfUrl, source: 'wytsg' };
    }
    console.log('[wytsg] WebView channel failed:', result.error);
  }

  // 方式 2：回退到 Sci-Hub 镜像页面解析（不需要登录）
  try {
    const mirrorUrl = await resolveWytsgScihubMirror();
    const pageUrl = `${mirrorUrl}/${cleanDoi}`;
    console.log('[wytsg] Fallback: fetching mirror page:', pageUrl);

    if (electron?.httpRequest) {
      const res = await electron.httpRequest({
        url: pageUrl,
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/pdf',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        }
      });

      if (res.ok && res.body) {
        const contentType = res.headers?.['content-type'] || '';
        if (contentType.includes('application/pdf')) {
          return { success: true, pdfUrl: pageUrl, source: 'wytsg' };
        }

        const realPdfUrl = extractScihubPdfUrl(res.body, mirrorUrl);
        if (realPdfUrl) {
          console.log('[wytsg] Fallback extracted PDF URL:', realPdfUrl);
          return { success: true, pdfUrl: realPdfUrl, source: 'wytsg' };
        }
      }
    }

    return { success: false, error: '图书馆通道未找到 PDF' };
  } catch (e) {
    console.error('[wytsg] Error:', e);
    return { success: false, error: '图书馆通道获取失败' };
  }
};

/**
 * 从 Sci-Hub 镜像页面 HTML 中提取真实 PDF 下载链接
 * Sci-Hub 常见模式：
 *   <iframe src="//cdn.sci-hub.se/xxx.pdf">
 *   <embed src="/downloads/xxx.pdf">
 *   <iframe src="https://moscow.sci-hub.se/xxx.pdf#view=FitH">
 */
function extractScihubPdfUrl(html: string, mirrorBase: string): string | null {
  const patterns = [
    // iframe 或 embed 中的 PDF 链接
    /<(?:iframe|embed)[^>]+src=["']([^"']*\.pdf[^"']*)/i,
    // 带 #view 后缀的 PDF
    /<(?:iframe|embed)[^>]+src=["']([^"']+#[^"']*)/i,
    // onclick 中的 PDF 链接
    /location\.href\s*=\s*["']([^"']*\.pdf[^"']*)/i,
    // 直接的 PDF 链接
    /href=["'](https?:\/\/[^"']*\.pdf[^"']*)/i,
    // sci-hub button 下载链接
    /onclick=["'].*?location\.href\s*=\s*'([^']+)'/i,
  ];

  for (const pat of patterns) {
    const match = html.match(pat);
    if (match?.[1]) {
      let url = match[1].split('#')[0]; // 去掉 #view=FitH 等后缀
      // 处理 // 开头的协议相对URL
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      // 处理 / 开头的相对路径
      else if (url.startsWith('/')) {
        url = mirrorBase + url;
      }
      // 处理完全没有协议的情况
      else if (!url.startsWith('http')) {
        url = mirrorBase + '/' + url;
      }
      return url;
    }
  }

  return null;
}

/**
 * 测试 wytsg 镜像连通性
 */
export const testWytsgConnection = async (): Promise<{ ok: boolean; mirrorUrl: string; error?: string }> => {
  try {
    const mirrorUrl = await resolveWytsgScihubMirror();
    const electron = (window as any).electron;
    if (electron?.httpRequest) {
      const res = await electron.httpRequest({
        url: mirrorUrl,
        method: 'HEAD',
      });
      return { ok: res.ok || res.status === 200, mirrorUrl };
    }
    // 浏览器回退
    const res = await fetch(mirrorUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      mode: 'no-cors',
    });
    return { ok: true, mirrorUrl };
  } catch (e: any) {
    const config = getWytsgConfig();
    const mirrorUrl = config.cachedMirrorUrl || WYTSG_DEFAULT_MIRROR;
    return { ok: false, mirrorUrl, error: e.message || '连接失败' };
  }
};

/**
 * 根据 DOI 前缀为已知出版商构造直接 PDF URL
 * 当 Unpaywall 的 URL 都返回 HTML 时，这些直链通常可以直接下载
 */
function getPublisherPdfUrls(doi: string): string[] {
  const urls: string[] = [];
  const cleanDoi = doi.replace('https://doi.org/', '').trim();

  // ACS (10.1021) → https://pubs.acs.org/doi/pdf/10.1021/xxx
  if (cleanDoi.startsWith('10.1021/')) {
    urls.push(`https://pubs.acs.org/doi/pdf/${cleanDoi}`);
  }
  // RSC (10.1039) → https://pubs.rsc.org/en/content/articlepdf/YEAR/XX/DOI
  if (cleanDoi.startsWith('10.1039/')) {
    urls.push(`https://pubs.rsc.org/doi/pdf/${cleanDoi}`);
  }
  // Wiley (10.1002) → https://onlinelibrary.wiley.com/doi/pdfdirect/10.1002/xxx
  if (cleanDoi.startsWith('10.1002/')) {
    urls.push(`https://onlinelibrary.wiley.com/doi/pdfdirect/${cleanDoi}`);
  }
  // Nature/Springer (10.1038) → https://www.nature.com/articles/DOIsuffix.pdf
  if (cleanDoi.startsWith('10.1038/')) {
    const suffix = cleanDoi.replace('10.1038/', '');
    urls.push(`https://www.nature.com/articles/${suffix}.pdf`);
  }
  // Springer (10.1007) → https://link.springer.com/content/pdf/DOI.pdf
  if (cleanDoi.startsWith('10.1007/')) {
    urls.push(`https://link.springer.com/content/pdf/${cleanDoi}.pdf`);
  }
  // Elsevier (10.1016) → via ScienceDirect API 
  if (cleanDoi.startsWith('10.1016/')) {
    urls.push(`https://www.sciencedirect.com/science/article/pii/${cleanDoi.replace('10.1016/', '').replace(/[^a-zA-Z0-9]/g, '')}/pdfft`);
  }
  // MDPI (10.3390) → https://www.mdpi.com/xxx/pdf
  if (cleanDoi.startsWith('10.3390/')) {
    const suffix = cleanDoi.replace('10.3390/', '');
    urls.push(`https://www.mdpi.com/${suffix}/pdf`);
  }

  return urls;
}

// ─── 原有功能 ─────────────────────────────────────────────

/**
 * 通过 Unpaywall API 查询所有可用的 Open Access PDF 链接
 * 返回候选 URL 数组（优先直接 PDF 链接，landing page 放最后）
 */
export const getUnpaywallLinks = async (doi: string): Promise<string[]> => {
  if (!doi) return [];
  try {
    const cleanDoi = doi.replace('https://doi.org/', '').trim();
    const apiUrl = `https://api.unpaywall.org/v2/${cleanDoi}?email=${UNPAYWALL_EMAIL}`;
    console.log('[Unpaywall] Querying:', apiUrl);

    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return [];

    const data = await res.json();
    const pdfUrls: string[] = [];
    const landingUrls: string[] = [];

    // 收集所有 url_for_pdf
    for (const loc of (data.oa_locations || [])) {
      if (loc.url_for_pdf && !pdfUrls.includes(loc.url_for_pdf)) {
        pdfUrls.push(loc.url_for_pdf);
      }
    }
    // best_oa_location 的 pdf 优先
    if (data.best_oa_location?.url_for_pdf) {
      const best = data.best_oa_location.url_for_pdf;
      const idx = pdfUrls.indexOf(best);
      if (idx > 0) { pdfUrls.splice(idx, 1); pdfUrls.unshift(best); }
      else if (idx < 0) { pdfUrls.unshift(best); }
    }

    // landing page 作为最后备选
    if (data.best_oa_location?.url) {
      landingUrls.push(data.best_oa_location.url);
    }

    const all = [...pdfUrls, ...landingUrls];
    console.log('[Unpaywall] Found', all.length, 'candidate URLs:', all);
    return all;
  } catch (e) {
    console.error('[Unpaywall] Error:', e);
    return [];
  }
};

/**
 * 构造 Sci-Hub 下载 URL（用户自行配置镜像地址）
 */
export const getScihubUrl = (doi: string, mirror: string): string => {
  const cleanDoi = doi.replace('https://doi.org/', '').trim();
  const base = mirror.endsWith('/') ? mirror : mirror + '/';
  return `${base}${cleanDoi}`;
};

/**
 * 获取 Sci-Hub 镜像设置（从 localStorage）
 */
export const getScihubMirror = (): string => {
  return localStorage.getItem('sciflow_scihub_mirror') || '';
};

export const setScihubMirror = (mirror: string): void => {
  localStorage.setItem('sciflow_scihub_mirror', mirror);
};

export const getAutoDownloadEnabled = (): boolean => {
  return localStorage.getItem('sciflow_auto_pdf_download') === 'true';
};

export const setAutoDownloadEnabled = (enabled: boolean): void => {
  localStorage.setItem('sciflow_auto_pdf_download', String(enabled));
};

/**
 * 尝试下载 PDF：校园网 DOI 直链 → Unpaywall → Sci-Hub → wytsg 图书馆通道
 * 返回 PDF URL 以便 Electron 层处理实际下载
 */
/**
 * 收集所有候选 PDF 下载 URL
 * 返回 { candidates: [{url, source}], error? }
 */
export const collectPdfCandidates = async (
  doi: string
): Promise<{ candidates: Array<{ url: string; source: string }>; error?: string }> => {
  if (!doi) return { candidates: [], error: '无 DOI' };
  const candidates: Array<{ url: string; source: string }> = [];

  // 0. 校园网/VPN DOI 直链（最高优先级）
  if (getCampusDoiEnabled()) {
    const campusResult = await getCampusDoiPdfUrl(doi);
    if (campusResult.success && campusResult.pdfUrl) {
      candidates.push({ url: campusResult.pdfUrl, source: 'campus' });
    }
  }

  // 1. Unpaywall (免费 OA) — 可能有多个候选
  const oaUrls = await getUnpaywallLinks(doi);
  for (const u of oaUrls) {
    // 跳过 landing page（doi.org 链接通常只是 HTML）
    if (!u.includes('doi.org/10.')) {
      candidates.push({ url: u, source: 'unpaywall' });
    }
  }

  // 1.5 出版商直接 PDF URL（基于 DOI 前缀构造）
  const cleanDoi = doi.replace('https://doi.org/', '').trim();
  const publisherPdfUrls = getPublisherPdfUrls(cleanDoi);
  for (const u of publisherPdfUrls) {
    candidates.push({ url: u, source: 'unpaywall' });
  }

  // 2. Sci-Hub (用户自配)
  const mirror = getScihubMirror();
  if (mirror) {
    candidates.push({ url: getScihubUrl(doi, mirror), source: 'scihub' });
  }

  // 3. wytsg 图书馆通道
  const wytsgResult = await getWytsgPdfUrl(doi);
  if (wytsgResult.success && wytsgResult.pdfUrl) {
    candidates.push({ url: wytsgResult.pdfUrl, source: 'wytsg' });
  }

  return { candidates };
};

/** 兼容旧调用方式 */
export const tryGetPdfUrl = async (doi: string): Promise<PdfDownloadResult> => {
  const { candidates } = await collectPdfCandidates(doi);
  if (candidates.length > 0) {
    return { success: true, pdfUrl: candidates[0].url, source: candidates[0].source as PdfDownloadResult['source'] };
  }
  return { success: false, error: '所有下载通道均未能获取全文' };
};

/**
 * 通过 Electron IPC 下载 PDF 到本地
 * preload 暴露 window.electron.downloadFile -> download-pdf IPC
 */
export const downloadPdfToLocal = async (
  pdfUrl: string,
  filename: string
): Promise<string | null> => {
  try {
    const electron = (window as any).electron;
    if (electron?.downloadFile) {
      const result = await electron.downloadFile(pdfUrl, filename);
      if (result?.success && result.filePath) {
        console.log('[PDF] Downloaded to:', result.filePath);
        return result.filePath;
      }
      if (result?.error) {
        console.warn('[PDF] Download failed:', result.error);
      }
    }
    // 没有 Electron API 或下载失败，返回 null（不跳转浏览器）
    return null;
  } catch (e) {
    console.error('[PDF] Download error:', e);
    return null;
  }
};

/**
 * 获取当前 PDF 下载目录路径
 */
export const getPdfDownloadDir = async (): Promise<string> => {
  const electron = (window as any).electron;
  if (electron?.getPdfDownloadDir) {
    return await electron.getPdfDownloadDir();
  }
  return '~/Documents/SciFlow-PDFs';
};

/**
 * 设置 PDF 下载目录
 */
export const setPdfDownloadDir = async (dir: string): Promise<boolean> => {
  const electron = (window as any).electron;
  if (electron?.setPdfDownloadDir) {
    const result = await electron.setPdfDownloadDir(dir);
    return result?.success ?? false;
  }
  return false;
};

/**
 * 打开目录选择对话框
 */
export const selectPdfDownloadDir = async (): Promise<string | null> => {
  const electron = (window as any).electron;
  // 优先新 API，回退到已有的 selectDirectory
  if (electron?.selectPdfDownloadDir) {
    return await electron.selectPdfDownloadDir();
  }
  if (electron?.selectDirectory) {
    return await electron.selectDirectory();
  }
  return null;
};

