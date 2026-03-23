/**
 * EPO OPS (Open Patent Services) API 客户端
 * 
 * 提供与欧洲专利局 OPS REST API 的集成，支持：
 * - OAuth2 Client Credentials 认证
 * - CQL (Contextual Query Language) 专利检索
 * - 书目数据获取
 * - localStorage 持久化 Key 配置
 * 
 * API 文档：https://developers.epo.org
 */

const EPO_AUTH_URL = 'https://ops.epo.org/3.2/auth/accesstoken';
const EPO_SEARCH_URL = 'https://ops.epo.org/3.2/rest-services/published-data/search';
const EPO_BIBLIO_URL = 'https://ops.epo.org/3.2/rest-services/published-data';
const STORAGE_KEY = 'sciflow_epo_settings';

// ─── 类型定义 ─────────────────────────────────────────────

export interface EpoSettings {
  consumerKey: string;
  consumerSecret: string;
  enabled: boolean;
}

export interface EpoPatentResult {
  patentNumber: string;
  title: string;
  titleEn: string;
  applicants: string[];
  inventors: string[];
  ipcCodes: string[];
  publicationDate: string;
  filingDate: string;
  abstract: string;
  abstractEn: string;
  country: string;
  kind: string; // A1, B1, B2 etc.
  familyId: string;
  sourceUrl: string;
}

// ─── Token 缓存 ──────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// ─── Settings 管理 ────────────────────────────────────────

export function getEpoSettings(): EpoSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { consumerKey: '', consumerSecret: '', enabled: false };
}

export function saveEpoSettings(settings: EpoSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  // 清除缓存的 token，强制下次重新获取
  cachedToken = null;
  tokenExpiry = 0;
}

export function isEpoConfigured(): boolean {
  const s = getEpoSettings();
  return s.enabled && !!s.consumerKey && !!s.consumerSecret;
}

// ─── OAuth2 认证 ──────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  // 使用缓存 token（未过期时）
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const settings = getEpoSettings();
  if (!settings.consumerKey || !settings.consumerSecret) {
    throw new Error('EPO OPS Consumer Key / Secret 未配置');
  }

  // Base64 编码 Key:Secret
  const credentials = btoa(`${settings.consumerKey}:${settings.consumerSecret}`);

  const response = await fetch(EPO_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EPO 认证失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Token 有效期通常 20 分钟，留 60 秒余量
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken!;
}

// ─── 连接测试 ──────────────────────────────────────────────

export async function testEpoConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getAccessToken();
    // 用一个简单查询测试连接
    const url = `${EPO_SEARCH_URL}?q=ti%3D%22battery%22&Range=1-1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    if (res.ok) {
      return { success: true, message: '✅ EPO OPS 连接成功！' };
    }
    return { success: false, message: `连接失败 (${res.status})` };
  } catch (err: any) {
    return { success: false, message: err.message || '未知错误' };
  }
}

// ─── XML 解析工具 ──────────────────────────────────────────

function parseXmlText(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function parseXmlTexts(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const text = match[1].trim();
    if (text) results.push(text);
  }
  return results;
}

function parseXmlAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

// 提取特定语言的文本（优先中文 zh，其次英文 en）
function parseLocalizedText(xml: string, tag: string, preferLang: string = 'en'): { text: string; lang: string } {
  const regex = new RegExp(`<${tag}[^>]*?data-format="[^"]*"[^>]*?lang="([^"]*)"[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const all: { lang: string; text: string }[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    all.push({ lang: match[1], text: match[2].trim() });
  }

  // 也尝试不带 data-format 的简单格式
  if (all.length === 0) {
    const simpleRegex = new RegExp(`<${tag}[^>]*?lang="([^"]*)"[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
    while ((match = simpleRegex.exec(xml)) !== null) {
      all.push({ lang: match[1], text: match[2].trim() });
    }
  }

  const preferred = all.find(a => a.lang === preferLang);
  if (preferred) return preferred;
  return all[0] || { text: '', lang: '' };
}

// ─── 专利搜索 ──────────────────────────────────────────────

/** 
 * 将用户关键词转换为 EPO CQL 查询
 * 智能检测专利号格式 vs 普通关键词
 */
function buildCqlQuery(keywords: string[]): string {
  const parts = keywords.map(kw => {
    const trimmed = kw.trim();
    // 检测专利号格式：CN/US/EP/WO/JP/KR + 数字
    if (/^(CN|US|EP|WO|JP|KR|DE|GB|FR)\d/i.test(trimmed)) {
      // 专利号查询
      return `pn=${trimmed}`;
    }
    // 普通关键词 → 在标题和摘要中搜索
    return `(ti="${trimmed}" OR ab="${trimmed}")`;
  });
  return parts.join(' AND ');
}

export async function searchEpoPatents(keywords: string[], maxResults: number = 12): Promise<EpoPatentResult[]> {
  const token = await getAccessToken();
  const cql = buildCqlQuery(keywords);
  const range = `1-${Math.min(maxResults, 25)}`;

  const url = `${EPO_SEARCH_URL}?q=${encodeURIComponent(cql)}&Range=${range}`;

  const searchRes = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/xml',
    },
  });

  if (!searchRes.ok) {
    if (searchRes.status === 404) return []; // 无结果
    const errText = await searchRes.text();
    throw new Error(`EPO 搜索失败 (${searchRes.status}): ${errText.substring(0, 200)}`);
  }

  const searchXml = await searchRes.text();

  // 解析搜索结果中的专利号列表
  const docIds = parseDocumentIds(searchXml);
  if (docIds.length === 0) return [];

  // 批量获取书目数据（使用 published-data/publication 端点）
  const results: EpoPatentResult[] = [];
  
  // 并发获取详情（最多 12 条，分批 4 个一组）
  const batchSize = 4;
  for (let i = 0; i < docIds.length; i += batchSize) {
    const batch = docIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(docId => fetchPatentBiblio(token, docId))
    );
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

/** 从搜索响应 XML 中提取文档 ID 列表 */
function parseDocumentIds(xml: string): string[] {
  // 格式: <document-id document-id-type="docdb">
  //          <country>US</country><doc-number>1234567</doc-number><kind>A1</kind>
  //        </document-id>
  const docIdBlocks = xml.match(/<document-id\s[^>]*document-id-type="docdb"[^>]*>[\s\S]*?<\/document-id>/gi) || [];
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const block of docIdBlocks) {
    const country = parseXmlText(block, 'country');
    const docNumber = parseXmlText(block, 'doc-number');
    const kind = parseXmlText(block, 'kind');
    if (country && docNumber) {
      const id = `${country}.${docNumber}.${kind || 'A'}`;
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  return ids.slice(0, 12);
}

/** 获取单个专利的书目数据 */
async function fetchPatentBiblio(token: string, docId: string): Promise<EpoPatentResult | null> {
  const url = `${EPO_BIBLIO_URL}/publication/docdb/${docId}/biblio`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/xml',
    },
  });

  if (!res.ok) return null;

  const xml = await res.text();
  const parts = docId.split('.');
  const country = parts[0] || '';
  const docNumber = parts[1] || '';
  const kind = parts[2] || '';
  const patentNumber = `${country}${docNumber}${kind}`;

  // 解析标题
  const titleEn = parseLocalizedText(xml, 'invention-title', 'en');
  const titleZh = parseLocalizedText(xml, 'invention-title', 'zh');

  // 解析摘要
  const abstractEn = parseLocalizedText(xml, 'abstract', 'en');
  const abstractZh = parseLocalizedText(xml, 'abstract', 'zh');

  // 解析申请人
  const applicants = parseXmlTexts(xml, 'applicant-name')
    .map(n => parseXmlText(n, 'name') || n)
    .filter(Boolean)
    .slice(0, 5);

  // 解析发明人
  const inventors = parseXmlTexts(xml, 'inventor-name')
    .map(n => parseXmlText(n, 'name') || n)
    .filter(Boolean)
    .slice(0, 5);

  // 解析 IPC 分类号
  const ipcCodes = parseXmlTexts(xml, 'classification-ipcr')
    .map(block => parseXmlText(block, 'text'))
    .filter(Boolean)
    .slice(0, 3);

  // 解析日期
  const pubDateRaw = parseXmlText(xml, 'date-of-publication') || '';
  const filingDateRaw = parseXmlText(xml, 'date-of-filing') || '';
  const formatDate = (d: string) => d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d;

  // Family ID
  const familyId = parseXmlAttr(xml, 'patent-family', 'family-id') ||
                   parseXmlAttr(xml, 'exchange-document', 'family-id') || '';

  return {
    patentNumber,
    title: titleZh.text || titleEn.text || '未知专利',
    titleEn: titleEn.text || '',
    applicants: applicants.length > 0 ? applicants : ['未知'],
    inventors,
    ipcCodes,
    publicationDate: formatDate(pubDateRaw),
    filingDate: formatDate(filingDateRaw),
    abstract: abstractZh.text || abstractEn.text || '',
    abstractEn: abstractEn.text || '',
    country,
    kind,
    familyId,
    sourceUrl: `https://patents.google.com/patent/${patentNumber}`,
  };
}
