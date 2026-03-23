/**
 * 智能推荐服务 — 基于 Semantic Scholar Recommendations API
 * 借鉴 Semantic Scholar Research Feeds 的正/负反馈机制
 */
import { callGeminiWithRetry, extractJson, FAST_MODEL, SPEED_CONFIG } from './core';
import type { RecommendedPaper } from '../../types';

/**
 * 从用户已有的文献 DOI 列表获取推荐论文
 * @param positiveDois  用户已导入/收藏的 DOI 列表 (正向信号)
 * @param negativeDois  用户标记"不感兴趣"的 DOI 列表 (负向信号)
 */
export const getRecommendations = async (
  positiveDois: string[],
  negativeDois: string[] = []
): Promise<RecommendedPaper[]> => {
  if (positiveDois.length === 0) return [];

  // ─── 策略 1：Semantic Scholar Recommendations API ──────────
  const recommendations = await fetchSemanticScholarRecommendations(positiveDois, negativeDois);
  if (recommendations.length > 0) return recommendations;

  // ─── 策略 2：若 Semantic Scholar 失败，回退到 OpenAlex 相关推荐 ──
  return fetchOpenAlexRelated(positiveDois);
};

// ═══ Semantic Scholar API ═══════════════════════════════════════
const fetchSemanticScholarRecommendations = async (
  positiveDois: string[],
  negativeDois: string[]
): Promise<RecommendedPaper[]> => {
  try {
    // 将 DOI 转换为 Semantic Scholar Paper ID 格式
    const positivePaperIds = positiveDois.slice(0, 5).map(doi => `DOI:${doi}`);
    const negativePaperIds = negativeDois.slice(0, 3).map(doi => `DOI:${doi}`);

    const body: any = { positivePaperIds };
    if (negativePaperIds.length > 0) body.negativePaperIds = negativePaperIds;

    console.log('[Recommendation] Calling Semantic Scholar API with', positivePaperIds.length, 'positive,', negativePaperIds.length, 'negative');

    const res = await fetch('https://api.semanticscholar.org/recommendations/v1/papers/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      console.warn('[Recommendation] Semantic Scholar API returned', res.status);
      return [];
    }

    const data = await res.json();
    const papers = (data.recommendedPapers || []).slice(0, 10);

    if (papers.length === 0) return [];

    // 提取基础信息
    const rawPapers = papers.map((p: any) => ({
      englishTitle: p.title || '',
      authors: (p.authors || []).map((a: any) => a.name).filter(Boolean),
      year: p.year || new Date().getFullYear(),
      source: p.venue || p.journal?.name || '',
      doi: p.externalIds?.DOI || '',
      url: p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : ''),
      abstract: p.abstract || '',
      citationCount: p.citationCount || 0,
    }));

    // AI 翻译 + 推荐理由生成
    return translateAndEnrich(rawPapers);
  } catch (e) {
    console.error('[Recommendation] Semantic Scholar error:', e);
    return [];
  }
};

// ═══ OpenAlex 相关推荐（回退方案）═══════════════════════════════
const fetchOpenAlexRelated = async (
  positiveDois: string[]
): Promise<RecommendedPaper[]> => {
  try {
    const doi = positiveDois[0];
    // 通过 OpenAlex 的 related_works 获取推荐
    const lookupUrl = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?mailto=sciflow@example.com`;
    const lookupRes = await fetch(lookupUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!lookupRes.ok) return [];
    const lookupData = await lookupRes.json();
    const relatedIds = (lookupData.related_works || []).slice(0, 10);

    if (relatedIds.length === 0) return [];

    // 批量获取相关论文的详细信息
    const pipe = relatedIds.map((id: string) => id.replace('https://openalex.org/', '')).join('|');
    const detailUrl = `https://api.openalex.org/works?filter=openalex:${pipe}&per_page=10&mailto=sciflow@example.com`;
    const detailRes = await fetch(detailUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!detailRes.ok) return [];
    const detailData = await detailRes.json();

    const rawPapers = (detailData.results || []).map((w: any) => {
      let abstract = '';
      if (w.abstract_inverted_index) {
        const words: [string, number][] = [];
        for (const [word, positions] of Object.entries(w.abstract_inverted_index)) {
          for (const pos of (positions as number[])) words.push([word, pos]);
        }
        words.sort((a, b) => a[1] - b[1]);
        abstract = words.map(wd => wd[0]).join(' ');
      }
      return {
        englishTitle: w.title || '',
        authors: w.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [],
        year: w.publication_year || new Date().getFullYear(),
        source: w.primary_location?.source?.display_name || '',
        doi: w.doi?.replace('https://doi.org/', '') || '',
        url: w.primary_location?.landing_page_url || '',
        abstract,
        citationCount: w.cited_by_count || 0,
      };
    });

    return translateAndEnrich(rawPapers);
  } catch (e) {
    console.error('[Recommendation] OpenAlex fallback error:', e);
    return [];
  }
};

// ═══ AI 翻译 + 推荐理由增强 ═══════════════════════════════════
const translateAndEnrich = async (rawPapers: any[]): Promise<RecommendedPaper[]> => {
  if (rawPapers.length === 0) return [];

  let enriched = rawPapers;
  try {
    const result = await callGeminiWithRetry(async (ai) => {
      const input = rawPapers.map((p: any, i: number) => ({
        idx: i,
        t: p.englishTitle,
        a: (p.abstract || '').substring(0, 200),
      }));

      const prompt = `请将以下推荐学术论文翻译并生成推荐理由。要求：
1. 标题翻译为专业中文
2. 摘要翻译为 50-80 字的精炼版
3. 推荐理由: 30-50 字说明为什么这篇论文对研究有参考价值
4. 输出 JSON 数组，每项包含 idx, title, abstract, reason

输入：
${JSON.stringify(input)}`;

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: SPEED_CONFIG
      });

      return JSON.parse(extractJson(response.text || '[]'));
    });

    if (Array.isArray(result)) {
      enriched = rawPapers.map((paper: any, idx: number) => {
        const tr = result.find((t: any) => t.idx === idx) || {};
        return {
          ...paper,
          title: tr.title || paper.englishTitle,
          abstract: tr.abstract || paper.abstract,
          recommendReason: tr.reason || '',
        };
      });
    }
  } catch (e) {
    console.warn('[Recommendation] Translation failed:', e);
    enriched = rawPapers.map((p: any) => ({ ...p, title: p.englishTitle }));
  }

  const prefix = `rec_${Date.now()}`;
  return enriched.map((item: any, idx: number): RecommendedPaper => ({
    id: `${prefix}_${idx}`,
    title: item.title || item.englishTitle || 'Untitled',
    englishTitle: item.englishTitle,
    authors: item.authors || [],
    year: item.year,
    source: item.source || '',
    doi: item.doi || '',
    url: item.url || '',
    abstract: item.abstract || '',
    citationCount: item.citationCount || 0,
    recommendReason: item.recommendReason || '',
    dismissed: false,
  }));
};
