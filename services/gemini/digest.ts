/**
 * AI 聚合摘要服务 — 将 Feed 论文按主题聚类并生成趋势洞察
 * 借鉴 RSSbrew 的 AI Digest 功能
 */
import { callGeminiWithRetry, extractJson, FAST_MODEL, SPEED_CONFIG } from './core';
import type { FeedItem, DigestReport } from '../../types';

export const generateDigest = async (
  feedItems: FeedItem[],
  period: 'daily' | 'weekly' = 'weekly'
): Promise<DigestReport> => {
  if (feedItems.length === 0) {
    return {
      id: `digest_${Date.now()}`,
      period,
      generatedAt: new Date().toISOString(),
      topicClusters: [],
      overallInsight: '当前订阅流中没有可分析的论文。',
      feedItemCount: 0,
    };
  }

  // 准备论文摘要数据
  const papersForAI = feedItems.slice(0, 30).map((item, idx) => ({
    idx,
    id: item.id,
    title: item.title || item.englishTitle,
    authors: item.authors?.slice(0, 2).join(', ') || '',
    year: item.year,
    source: item.source,
    abstract: (item.abstract || '').substring(0, 200),
  }));

  try {
    const result = await callGeminiWithRetry(async (ai) => {
      const prompt = `你是一位资深的科研情报分析师。请对以下 ${papersForAI.length} 篇最新学术论文进行主题聚类和趋势分析。

要求：
1. 将论文按研究主题分成 2-5 个聚类（cluster）
2. 每个聚类需要：
   - topic: 主题名称（中文，简洁）
   - paperIdxList: 属于该聚类的论文 idx 数组
   - aiSummary: 中文摘要总结（80-150字），概括该主题下论文的共同发现
   - trendInsight: 趋势洞察（50-80字），分析该研究方向的发展趋势
3. 最后给出 overallInsight: 全局趋势总结（100-200字）

输出 JSON 格式：
{
  "clusters": [{ "topic": "", "paperIdxList": [], "aiSummary": "", "trendInsight": "" }],
  "overallInsight": ""
}

论文列表：
${JSON.stringify(papersForAI)}`;

      const response = await ai.models.generateContent({
        model: FAST_MODEL,
        contents: prompt,
        config: SPEED_CONFIG
      });

      return JSON.parse(extractJson(response.text || '{}'));
    });

    const clusters = (result.clusters || []).map((c: any) => ({
      topic: c.topic || '未分类',
      paperIds: (c.paperIdxList || []).map((idx: number) => papersForAI[idx]?.id).filter(Boolean),
      aiSummary: c.aiSummary || '',
      trendInsight: c.trendInsight || '',
    }));

    return {
      id: `digest_${Date.now()}`,
      period,
      generatedAt: new Date().toISOString(),
      topicClusters: clusters,
      overallInsight: result.overallInsight || '分析完成。',
      feedItemCount: feedItems.length,
    };
  } catch (e) {
    console.error('[Digest] Generation failed:', e);
    return {
      id: `digest_${Date.now()}`,
      period,
      generatedAt: new Date().toISOString(),
      topicClusters: [],
      overallInsight: 'AI 摘要生成失败，请稍后重试。',
      feedItemCount: feedItems.length,
    };
  }
};
