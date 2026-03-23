/**
 * RAG 文本分块引擎 — Phase 1 核心模块
 * 
 * 智能语义分块策略：
 * 1. 按段落/句子边界分块，避免在语义中间截断
 * 2. 滑动窗口重叠确保上下文连续性
 * 3. 短文本直接作为单 chunk，不额外拆分
 * 4. 内容哈希用于增量索引的变更检测
 */

// ─── 内容哈希 ─────────────────────────────────────────────────────
// 使用 DJB2 变体哈希算法（纯 JS，无第三方依赖，足够用于变更检测）
export function hashContent(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36);
}

// ─── 分块配置 ─────────────────────────────────────────────────────

export interface ChunkConfig {
  /** 每个 chunk 的最大字符数（默认 500） */
  maxChunkSize: number;
  /** 相邻 chunk 重叠字符数（默认 80） */
  overlapSize: number;
  /** 低于此长度的文本不拆分，直接作为单 chunk（默认 600） */
  minSplitThreshold: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  maxChunkSize: 500,
  overlapSize: 80,
  minSplitThreshold: 600,
};

// ─── 分割标记优先级 ───────────────────────────────────────────────
// 优先按段落 > 句号/问号/感叹号 > 分号/冒号 > 逗号 的顺序寻找分割点

const SPLIT_MARKERS = [
  /\n\n+/,                             // 段落分隔
  /(?<=[。！？.!?])\s*/,              // 句子终止符
  /(?<=[；;：:])\s*/,                  // 分号/冒号
  /(?<=[，,])\s*/,                     // 逗号（最后手段）
];

/**
 * 在 text[0..maxPos] 范围内找到最佳分割位置
 * 优先在段落/句号边界分割，避免在词中间截断
 */
function findBestSplitPoint(text: string, maxPos: number): number {
  // 优先检查高优先级分割标记
  for (const marker of SPLIT_MARKERS) {
    // 从 maxPos 位置往前搜索最近的分割点
    const searchRange = text.substring(0, maxPos);
    let lastMatch = -1;
    let match: RegExpExecArray | null;
    const regex = new RegExp(marker.source, 'g');

    while ((match = regex.exec(searchRange)) !== null) {
      const pos = match.index + match[0].length;
      if (pos <= maxPos && pos > maxPos * 0.3) { // 不要太靠前（至少用掉30%的空间）
        lastMatch = pos;
      }
    }

    if (lastMatch > 0) return lastMatch;
  }

  // 所有标记都没找到 → 硬截断（回退到空格或直接截断）
  const spacePos = text.lastIndexOf(' ', maxPos);
  if (spacePos > maxPos * 0.5) return spacePos + 1;

  return maxPos;
}

// ─── 核心分块函数 ─────────────────────────────────────────────────

export interface TextChunk {
  /** 分块序号（从 0 开始） */
  chunkIndex: number;
  /** 分块文本 */
  text: string;
  /** 在原始文本中的起始字符位置 */
  startOffset: number;
  /** 在原始文本中的结束字符位置 */
  endOffset: number;
}

/**
 * 将长文本智能分块
 * - 短文本直接返回单个 chunk
 * - 长文本按语义边界分割，相邻 chunk 有 overlap
 */
export function chunkText(
  text: string,
  config: Partial<ChunkConfig> = {}
): TextChunk[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cleaned = text.trim();

  if (!cleaned) return [];

  // 短文本不拆分
  if (cleaned.length <= cfg.minSplitThreshold) {
    return [{
      chunkIndex: 0,
      text: cleaned,
      startOffset: 0,
      endOffset: cleaned.length,
    }];
  }

  const chunks: TextChunk[] = [];
  let cursor = 0;
  let chunkIdx = 0;

  while (cursor < cleaned.length) {
    const remaining = cleaned.length - cursor;

    // 最后一个 chunk 不足 maxChunkSize 的 1.3 倍 → 直接整块吃掉避免碎片
    if (remaining <= cfg.maxChunkSize * 1.3) {
      chunks.push({
        chunkIndex: chunkIdx,
        text: cleaned.substring(cursor),
        startOffset: cursor,
        endOffset: cleaned.length,
      });
      break;
    }

    // 在 maxChunkSize 范围内找最佳分割点
    const splitPos = findBestSplitPoint(
      cleaned.substring(cursor),
      cfg.maxChunkSize
    );

    chunks.push({
      chunkIndex: chunkIdx,
      text: cleaned.substring(cursor, cursor + splitPos),
      startOffset: cursor,
      endOffset: cursor + splitPos,
    });

    // 下一个 chunk 的起始位置 = 当前结尾 - 重叠量
    cursor = cursor + splitPos - cfg.overlapSize;
    if (cursor < 0) cursor = 0;
    // 防止原地踏步（安全阀）
    if (cursor <= chunks[chunks.length - 1].startOffset) {
      cursor = chunks[chunks.length - 1].endOffset;
    }
    chunkIdx++;
  }

  return chunks;
}

// ─── BM25 + IDF 关键词检索 ────────────────────────────────────────

/**
 * 预计算每个关键词的文档频率（DF）
 * @param keywords 查询关键词列表
 * @param docs     所有文档的文本数组
 * @returns Map<keyword, documentFrequency>
 */
export function computeDocFrequencies(keywords: string[], docs: string[]): Map<string, number> {
    const dfMap = new Map<string, number>();
    for (const keyword of keywords) {
        let count = 0;
        const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        for (const doc of docs) {
            if (regex.test(doc)) count++;
        }
        dfMap.set(keyword, count);
    }
    return dfMap;
}

/**
 * 从查询中提取关键词
 * 去除常见停用词，保留有意义的中/英文词汇
 */
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上',
  '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己',
  '这', '他', '她', '他们', '我们', '什么', '那', '里', '请', '分析', '帮',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'can', 'could', 'of', 'in', 'to', 'for',
  'with', 'on', 'at', 'by', 'from', 'as', 'or', 'and', 'but', 'if',
  'not', 'no', 'so', 'it', 'its', 'this', 'that', 'which', 'what',
]);

export function extractKeywords(query: string): string[] {
  // 1. 中文分词（简单版：按字符切分 2-4 字组合）+ 英文按空格
  const words: string[] = [];

  // 英文词
  const englishWords = query.match(/[a-zA-Z][a-zA-Z0-9_-]{1,}/g) || [];
  words.push(...englishWords.map(w => w.toLowerCase()).filter(w => !STOP_WORDS.has(w)));

  // 中文：提取2-4个字的连续中文（ngram）
  const chineseChars = query.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const segment of chineseChars) {
    if (segment.length <= 4 && !STOP_WORDS.has(segment)) {
      words.push(segment);
    } else {
      // 长中文段：提取 2-gram 和 3-gram
      for (let n = 2; n <= Math.min(4, segment.length); n++) {
        for (let i = 0; i <= segment.length - n; i++) {
          const gram = segment.substring(i, i + n);
          if (!STOP_WORDS.has(gram)) {
            words.push(gram);
          }
        }
      }
    }
  }

  // 去重
  return [...new Set(words)];
}

/**
 * BM25 + IDF 完整评分
 * score = Σ IDF(t) × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × docLen/avgDocLen))
 */
export function bm25ScoreWithIdf(
  keywords: string[],
  docText: string,
  avgDocLength: number,
  totalDocs: number,
  docFrequencies: Map<string, number>,
  k1: number = 1.2,
  b: number = 0.75
): number {
  const docLen = docText.length;
  let score = 0;

  for (const keyword of keywords) {
    // 词频（term frequency）
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = docText.match(regex);
    const tf = matches ? matches.length : 0;
    if (tf === 0) continue;

    // ★ IDF: log((N - n(t) + 0.5) / (n(t) + 0.5) + 1)
    const df = docFrequencies.get(keyword) || 0;
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

    // BM25 TF 正则化
    const normalizedTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLength)));
    score += idf * normalizedTf;
  }

  return score;
}

/** 向后兼容别名（不含 IDF） */
export function bm25Score(
  keywords: string[],
  docText: string,
  avgDocLength: number,
  k1: number = 1.2,
  b: number = 0.75
): number {
  const docLen = docText.length;
  let score = 0;
  for (const keyword of keywords) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = docText.match(regex);
    const tf = matches ? matches.length : 0;
    if (tf === 0) continue;
    const normalizedTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLength)));
    score += normalizedTf;
  }
  return score;
}

// ─── RRF 融合排序 ─────────────────────────────────────────────────

export interface RankedResult<T> {
  item: T;
  score: number;
}

/**
 * Reciprocal Rank Fusion (RRF) — 融合多路排序结果
 * 参考论文: "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"
 * 
 * @param rankedLists 多个已排序的结果列表
 * @param k RRF 常数（默认 60）
 * @param getId 从结果项中提取唯一 ID 的函数
 */
export function reciprocalRankFusion<T>(
  rankedLists: T[][],
  k: number = 60,
  getId: (item: T) => string
): T[] {
  const scoreMap = new Map<string, { item: T; score: number }>();

  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const id = getId(item);
      const rrfScore = 1 / (k + rank + 1);
      const existing = scoreMap.get(id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(id, { item, score: rrfScore });
      }
    });
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.item);
}
