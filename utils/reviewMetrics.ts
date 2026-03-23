/**
 * 综述写作质量指标计算引擎
 * 纯前端计算，零 AI 调用
 */

import { ReviewOutlineNode } from '../types';

// ─── 中文停用词（过滤高频但无意义的词） ───
const ZH_STOPWORDS = new Set([
    '的', '了', '在', '是', '和', '与', '或', '等', '对', '从', '中', '为',
    '以', '及', '到', '被', '将', '而', '但', '也', '都', '所', '其', '这',
    '那', '有', '不', '可', '能', '会', '要', '并', '于', '由', '上', '下',
    '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '个', '种',
    '此', '该', '之', '如', '则', '更', '已', '可以', '通过', '进行', '具有',
    '以及', '因此', '然而', '同时', '目前', '其中', '这些', '那些', '研究',
    '表明', '结果', '方法', '性能', '条件', '过程', '系统', '分析', '图',
    '表', '基于', '提出', '实现', '采用', '利用', 'the', 'a', 'an', 'of',
    'in', 'on', 'at', 'to', 'for', 'and', 'or', 'is', 'are', 'was', 'were',
    'be', 'been', 'has', 'have', 'had', 'with', 'by', 'from', 'as', 'that',
    'this', 'it', 'not', 'but', 'which', 'can', 'such', 'than', 'also',
    'these', 'their', 'its', 'they', 'we', 'our', 'between', 'into'
]);

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════

export interface SectionMetrics {
    id: string;
    title: string;
    level: number;
    wordCount: number;
    targetWords: number;
    charCount: number;
    paragraphCount: number;
    avgParagraphLength: number;
    longParagraphs: number;      // >300字
    shortParagraphs: number;     // <50字
    citationCount: number;
    uncitedParagraphs: number;   // 无引用的段落数
    avgSentenceLength: number;
    sentenceCount: number;
}

export interface TermFrequency {
    term: string;
    count: number;
}

export interface ReviewQualityMetrics {
    // 全文统计
    totalWords: number;
    totalChars: number;
    totalParagraphs: number;
    totalCitations: number;
    totalSentences: number;
    avgCitationDensity: number;  // 引用/千字
    avgSentenceLength: number;

    // 章节级指标
    sections: SectionMetrics[];

    // 段落问题
    totalLongParagraphs: number;
    totalShortParagraphs: number;
    totalUncitedParagraphs: number;

    // 术语频率
    topTerms: TermFrequency[];

    // 综合得分 0-100
    qualityScore: number;
}

// ═══════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════

/** 展平大纲为所有叶节点 */
const flattenOutline = (nodes: ReviewOutlineNode[]): ReviewOutlineNode[] => {
    const result: ReviewOutlineNode[] = [];
    for (const node of nodes) {
        result.push(node);
        if (node.children?.length) {
            result.push(...flattenOutline(node.children));
        }
    }
    return result;
};

/** 按中文/英文分割段落 */
const splitParagraphs = (text: string): string[] =>
    text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

/** 按句子分割 */
const splitSentences = (text: string): string[] =>
    text.split(/[。！？；.!?;]+/).map(s => s.trim()).filter(s => s.length > 2);

/** 统计字数（中文按字符，英文按单词） */
const countWords = (text: string): number => {
    const zhChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const enWords = text.replace(/[\u4e00-\u9fff]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0).length;
    return zhChars + enWords;
};

/** 统计引用数 */
const countCitations = (text: string): number =>
    (text.match(/\[Ref:[^\]]+\]/g) || []).length;

/** 提取术语频率 */
const extractTerms = (text: string, topN: number = 20): TermFrequency[] => {
    const freq = new Map<string, number>();

    // 中文：提取 2-4 字词组（简单 n-gram）
    const zhText = text.replace(/[a-zA-Z0-9\s\[\]():.,;!?@#$%^&*_+={}|\\/<>"'-]/g, '');
    for (let n = 2; n <= 4; n++) {
        for (let i = 0; i <= zhText.length - n; i++) {
            const gram = zhText.substring(i, i + n);
            if (!Array.from(gram).some(c => ZH_STOPWORDS.has(c))) {
                freq.set(gram, (freq.get(gram) || 0) + 1);
            }
        }
    }

    // 英文：提取单词
    const enWords = text.match(/[A-Za-z]{3,}/g) || [];
    for (const w of enWords) {
        const lower = w.toLowerCase();
        if (!ZH_STOPWORDS.has(lower)) {
            freq.set(lower, (freq.get(lower) || 0) + 1);
        }
    }

    return Array.from(freq.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([term, count]) => ({ term, count }));
};


// ═══════════════════════════════════════════════════════════════════
// 主计算函数
// ═══════════════════════════════════════════════════════════════════

export const computeReviewMetrics = (
    outline: ReviewOutlineNode[],
    generatedSections: Record<string, string>
): ReviewQualityMetrics => {
    const allNodes = flattenOutline(outline);
    const allText = Object.values(generatedSections).join('\n\n');

    // ─── 章节级指标 ───
    const sections: SectionMetrics[] = allNodes
        .filter(n => generatedSections[n.id])
        .map(node => {
            const content = generatedSections[node.id];
            const paragraphs = splitParagraphs(content);
            const sentences = splitSentences(content);
            const wordCount = countWords(content);
            const charCount = content.replace(/\s/g, '').length;
            const citations = countCitations(content);

            const paragraphLengths = paragraphs.map(p => countWords(p));
            const avgParagraphLength = paragraphLengths.length > 0
                ? Math.round(paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length)
                : 0;

            const longParagraphs = paragraphLengths.filter(l => l > 300).length;
            const shortParagraphs = paragraphLengths.filter(l => l < 50).length;

            const uncitedParagraphs = paragraphs.filter(p =>
                countCitations(p) === 0 && countWords(p) > 30
            ).length;

            const sentenceLengths = sentences.map(s => countWords(s));
            const avgSentenceLength = sentenceLengths.length > 0
                ? Math.round(sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length)
                : 0;

            return {
                id: node.id,
                title: node.title,
                level: node.level,
                wordCount,
                targetWords: node.targetWords || 0,
                charCount,
                paragraphCount: paragraphs.length,
                avgParagraphLength,
                longParagraphs,
                shortParagraphs,
                citationCount: citations,
                uncitedParagraphs,
                avgSentenceLength,
                sentenceCount: sentences.length
            };
        });

    // ─── 全文聚合 ───
    const totalWords = sections.reduce((a, s) => a + s.wordCount, 0);
    const totalChars = sections.reduce((a, s) => a + s.charCount, 0);
    const totalParagraphs = sections.reduce((a, s) => a + s.paragraphCount, 0);
    const totalCitations = sections.reduce((a, s) => a + s.citationCount, 0);
    const totalSentences = sections.reduce((a, s) => a + s.sentenceCount, 0);
    const totalLongParagraphs = sections.reduce((a, s) => a + s.longParagraphs, 0);
    const totalShortParagraphs = sections.reduce((a, s) => a + s.shortParagraphs, 0);
    const totalUncitedParagraphs = sections.reduce((a, s) => a + s.uncitedParagraphs, 0);

    const avgCitationDensity = totalWords > 0
        ? Math.round((totalCitations / totalWords) * 1000 * 10) / 10
        : 0;

    const avgSentenceLength = totalSentences > 0
        ? Math.round(sections.reduce((a, s) => a + s.avgSentenceLength * s.sentenceCount, 0) / totalSentences)
        : 0;

    // ─── 术语频率 ───
    const topTerms = extractTerms(allText, 20);

    // ─── 综合评分 ───
    let qualityScore = 70; // 基础分

    // 字数充实度 (+0~15)
    const wordCompletionRate = sections.filter(s =>
        s.targetWords > 0 && s.wordCount >= s.targetWords * 0.7
    ).length / Math.max(sections.length, 1);
    qualityScore += Math.round(wordCompletionRate * 15);

    // 引用密度 (+0~10)
    if (avgCitationDensity >= 3) qualityScore += 10;
    else if (avgCitationDensity >= 1.5) qualityScore += 5;

    // 段落质量 (-0~10)
    const problemParagraphRate = (totalLongParagraphs + totalShortParagraphs) / Math.max(totalParagraphs, 1);
    qualityScore -= Math.round(problemParagraphRate * 10);

    // 无引用段落扣分 (-0~5)
    const uncitedRate = totalUncitedParagraphs / Math.max(totalParagraphs, 1);
    qualityScore -= Math.round(uncitedRate * 5);

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    return {
        totalWords,
        totalChars,
        totalParagraphs,
        totalCitations,
        totalSentences,
        avgCitationDensity,
        avgSentenceLength,
        sections,
        totalLongParagraphs,
        totalShortParagraphs,
        totalUncitedParagraphs,
        topTerms,
        qualityScore
    };
};
