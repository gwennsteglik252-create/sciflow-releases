/**
 * 订阅检查服务 — 多数据源支持
 * 数据源：OpenAlex / arXiv RSS / 自定义 RSS / DOI 引用追踪
 */
import { callGeminiWithRetry, extractJson, FAST_MODEL, SPEED_CONFIG } from './core';
import type { SubscriptionRule, FeedItem } from '../../types';

// ═══ 主路由器 ═══════════════════════════════════════════════════
export const checkSubscription = async (
  rule: SubscriptionRule,
  existingDois: Set<string>
): Promise<FeedItem[]> => {
  switch (rule.type) {
    case 'arxiv_category':
      return fetchArxivFeed(rule, existingDois);
    case 'rss_url':
      return fetchCustomRss(rule, existingDois);
    case 'doi_alert':
      return fetchCitationAlerts(rule, existingDois);
    case 'keyword':
    case 'author':
    case 'journal':
    default:
      return fetchOpenAlex(rule, existingDois);
  }
};

// ═══ OpenAlex（原有逻辑） ═══════════════════════════════════════
const fetchOpenAlex = async (
  rule: SubscriptionRule,
  existingDois: Set<string>
): Promise<FeedItem[]> => {
  const { cleanAcademicTitle } = await import('../../utils/cleanTitle');
  const currentYear = new Date().getFullYear();
  const sinceDate = rule.lastChecked
    ? new Date(rule.lastChecked).toISOString().split('T')[0]
    : `${currentYear}-01-01`;
  const dateFilter = `,from_publication_date:${sinceDate}`;
  const query = encodeURIComponent(rule.value);
  let apiUrl = '';

  switch (rule.type) {
    case 'author':
      apiUrl = `https://api.openalex.org/works?filter=authorships.author.display_name.search:${query}${dateFilter}&sort=publication_date:desc&per_page=10`;
      break;
    case 'journal':
      apiUrl = `https://api.openalex.org/works?filter=primary_location.source.display_name.search:${query}${dateFilter}&sort=publication_date:desc&per_page=10`;
      break;
    case 'keyword':
    default:
      apiUrl = `https://api.openalex.org/works?search=${query}&filter=type:article${dateFilter}&sort=publication_date:desc&per_page=10`;
      break;
  }

  apiUrl += '&mailto=sciflow@example.com';
  console.log(`[Subscription] Checking rule "${rule.value}" (${rule.type}):`, apiUrl);

  let works: any[] = [];
  try {
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      works = data.results || [];
    }
  } catch (e) {
    console.error('[Subscription] OpenAlex fetch error:', e);
    return [];
  }

  const newWorks = works.filter((w: any) => {
    const doi = w.doi?.replace('https://doi.org/', '').toLowerCase().trim();
    return !doi || !existingDois.has(doi);
  });

  if (newWorks.length === 0) return [];

  const rawItems = newWorks.map((work: any) => {
    const doi = work.doi?.replace('https://doi.org/', '') || '';
    const title = cleanAcademicTitle(work.title || '');
    const authors = work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [];
    const year = work.publication_year || currentYear;
    const source = work.primary_location?.source?.display_name || '';
    const url = work.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : '');

    let abstract = '';
    if (work.abstract_inverted_index) {
      const words: [string, number][] = [];
      for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
        for (const pos of (positions as number[])) {
          words.push([word, pos]);
        }
      }
      words.sort((a, b) => a[1] - b[1]);
      abstract = words.map(w => w[0]).join(' ');
    }

    return { englishTitle: title, authors, year, source, doi, url, abstract };
  });

  return buildFeedItems(rawItems, rule, 'openalex');
};

// ═══ arXiv RSS ═══════════════════════════════════════════════════
const fetchArxivFeed = async (
  rule: SubscriptionRule,
  existingDois: Set<string>
): Promise<FeedItem[]> => {
  const category = rule.value.trim(); // e.g. "cs.AI", "cond-mat.mtrl-sci"
  const rssUrl = `https://export.arxiv.org/rss/${category}`;
  console.log(`[Subscription] Fetching arXiv RSS: ${rssUrl}`);

  try {
    const res = await fetch(rssUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, rule, existingDois, 'arxiv');
  } catch (e) {
    console.error('[Subscription] arXiv fetch error:', e);
    return [];
  }
};

// ═══ 自定义 RSS Feed ═══════════════════════════════════════════
const fetchCustomRss = async (
  rule: SubscriptionRule,
  existingDois: Set<string>
): Promise<FeedItem[]> => {
  const feedUrl = rule.value.trim();
  console.log(`[Subscription] Fetching custom RSS: ${feedUrl}`);

  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssXml(xml, rule, existingDois, 'rss');
  } catch (e) {
    console.error('[Subscription] Custom RSS fetch error:', e);
    return [];
  }
};

// ═══ DOI 引用追踪 ═══════════════════════════════════════════════
const fetchCitationAlerts = async (
  rule: SubscriptionRule,
  existingDois: Set<string>
): Promise<FeedItem[]> => {
  const { cleanAcademicTitle } = await import('../../utils/cleanTitle');
  const doi = rule.value.trim();
  const apiUrl = `https://api.openalex.org/works?filter=cites:https://doi.org/${encodeURIComponent(doi)}&sort=publication_date:desc&per_page=10&mailto=sciflow@example.com`;
  console.log(`[Subscription] Checking citation alerts for DOI: ${doi}`);

  try {
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const works = (data.results || []).filter((w: any) => {
      const wDoi = w.doi?.replace('https://doi.org/', '').toLowerCase().trim();
      return !wDoi || !existingDois.has(wDoi);
    });

    if (works.length === 0) return [];

    const rawItems = works.map((work: any) => ({
      englishTitle: cleanAcademicTitle(work.title || ''),
      authors: work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [],
      year: work.publication_year || new Date().getFullYear(),
      source: work.primary_location?.source?.display_name || '',
      doi: work.doi?.replace('https://doi.org/', '') || '',
      url: work.primary_location?.landing_page_url || '',
      abstract: work.abstract_inverted_index ? invertedIndexToAbstract(work.abstract_inverted_index) : '',
    }));

    return buildFeedItems(rawItems, rule, 'openalex_citation');
  } catch (e) {
    console.error('[Subscription] Citation alert error:', e);
    return [];
  }
};

// ═══ 通用 RSS XML 解析器 ═══════════════════════════════════════
const parseRssXml = async (
  xml: string,
  rule: SubscriptionRule,
  existingDois: Set<string>,
  sourceApi: string
): Promise<FeedItem[]> => {
  // 简易 XML 解析（不依赖 DOMParser，兼容 Node/Electron）
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
    };
    const title = getTag('title').replace(/<[^>]*>/g, '').trim();
    const link = getTag('link');
    const description = getTag('description').replace(/<[^>]*>/g, '').trim();
    const creator = getTag('dc:creator') || getTag('author');
    const pubDate = getTag('pubDate') || getTag('dc:date');

    // 尝试从 link 提取 DOI
    let doi = '';
    const doiMatch = link.match(/10\.\d{4,}\/[^\s]+/);
    if (doiMatch) doi = doiMatch[0];

    if (doi && existingDois.has(doi.toLowerCase())) continue;

    const year = pubDate ? new Date(pubDate).getFullYear() : new Date().getFullYear();
    items.push({
      englishTitle: title,
      authors: creator ? creator.split(/[,;]/).map((a: string) => a.trim()).filter(Boolean) : [],
      year: isNaN(year) ? new Date().getFullYear() : year,
      source: sourceApi === 'arxiv' ? 'arXiv' : new URL(rule.value).hostname,
      doi,
      url: link,
      abstract: description.substring(0, 500),
    });
  }

  if (items.length === 0) return [];
  return buildFeedItems(items, rule, sourceApi);
};

// ═══ 工具函数 ═══════════════════════════════════════════════════
const invertedIndexToAbstract = (index: Record<string, number[]>): string => {
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map(w => w[0]).join(' ');
};

// ─── AI 翻译 + 构造 FeedItem ──────────────────────────────────
const buildFeedItems = async (
  rawItems: any[],
  rule: SubscriptionRule,
  sourceApi: string
): Promise<FeedItem[]> => {
  let translatedItems = rawItems;
  try {
    const translations = await callGeminiWithRetry(async (ai) => {
      const toTranslate = rawItems.map((p: any, i: number) => ({
        idx: i,
        t: p.englishTitle,
        a: (p.abstract || '').substring(0, 300)
      }));

      const prompt = `请将以下学术论文标题和摘要翻译为中文。要求：
1. 标题翻译要专业、准确
2. 摘要翻译为 50-100 字的精炼智能摘要，突出核心发现和创新点
3. 输出 JSON 数组，每项包含 idx, title, abstract

输入：
${JSON.stringify(toTranslate)}`;

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: SPEED_CONFIG
      });

      return JSON.parse(extractJson(response.text || '[]'));
    });

    if (Array.isArray(translations)) {
      translatedItems = rawItems.map((paper: any, idx: number) => {
        const tr = translations.find((t: any) => t.idx === idx) || {};
        return {
          ...paper,
          title: tr.title || paper.englishTitle,
          abstract: tr.abstract || paper.abstract,
        };
      });
    }
  } catch (e) {
    console.warn('[Subscription] Translation failed:', e);
    translatedItems = rawItems.map((p: any) => ({ ...p, title: p.englishTitle }));
  }

  const now = new Date().toISOString();
  const prefix = `feed_${Date.now()}`;
  return translatedItems.map((item: any, idx: number): FeedItem => ({
    id: `${prefix}_${idx}`,
    ruleId: rule.id,
    title: item.title || item.englishTitle || 'Untitled',
    englishTitle: item.englishTitle,
    authors: item.authors || [],
    year: item.year,
    source: item.source || '',
    doi: item.doi || '',
    url: item.url || '',
    abstract: item.abstract || '',
    discoveredAt: now,
    isRead: false,
    imported: false,
    sourceApi,
  }));
};
