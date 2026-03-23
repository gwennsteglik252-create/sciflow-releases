/**
 * Notebook AI Service — 科研笔记 AI 功能
 * 提供 AI 摘要、写作助手、智能标签推荐
 */
import { UniversalAIAdapter } from './core/adapter';

/**
 * 为笔记内容生成 AI 摘要
 */
export async function generateNoteSummary(content: string): Promise<string> {
  if (!content || content.trim().length < 20) {
    return '内容过短，无法生成有效摘要。';
  }

  const adapter = new UniversalAIAdapter();
  const truncated = content.length > 4000 ? content.slice(0, 4000) + '...(已截断)' : content;

  const response = await adapter.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `你是一位科研助理，请为以下科研笔记内容生成一段简明摘要（150字以内）。
摘要应当：
1. 提炼核心观点和关键发现
2. 使用学术语言
3. 保留重要的数据指标和方法名称

笔记内容：
${truncated}`
          }
        ]
      }
    ],
    config: {
      temperature: 0.3,
    }
  });

  return (response?.text || '摘要生成失败').trim();
}

/**
 * 基于关联笔记和文献，AI 起草文献综述段落或实验方案
 */
export async function generateDraftFromNotes(opts: {
  noteContents: string[];
  literatureInfos: { title: string; authors?: string[]; abstract?: string }[];
  draftType: 'review' | 'experiment';
}): Promise<string> {
  const { noteContents, literatureInfos, draftType } = opts;

  if (noteContents.length === 0 && literatureInfos.length === 0) {
    return '请先关联笔记或文献以生成草稿。';
  }

  const adapter = new UniversalAIAdapter();

  const noteSummary = noteContents
    .slice(0, 5)
    .map((c, i) => `【笔记 ${i + 1}】\n${c.slice(0, 800)}`)
    .join('\n\n');

  const litSummary = literatureInfos
    .slice(0, 8)
    .map((l, i) => `【文献 ${i + 1}】${l.title}${l.authors?.length ? ` — ${l.authors.slice(0, 3).join(', ')}` : ''}${l.abstract ? `\n摘要: ${l.abstract.slice(0, 300)}` : ''}`)
    .join('\n\n');

  const promptMap = {
    review: `你是一位资深科研写作助理。请根据以下笔记和文献信息，起草一段文献综述段落（300-500字）。
要求：
1. 学术语言，逻辑清晰
2. 自然地引用和整合多篇文献的观点
3. 指出研究趋势和潜在的研究空白
4. 使用中文撰写

${noteSummary ? `关联笔记：\n${noteSummary}` : ''}
${litSummary ? `\n关联文献：\n${litSummary}` : ''}`,

    experiment: `你是一位资深科研助理。请根据以下笔记和文献信息，起草一份实验方案（包括目标、方法路线、预期结果）。
要求：
1. 方法描述具体可执行
2. 包含关键参数和条件
3. 参考文献中已验证的方法
4. 使用中文撰写

${noteSummary ? `关联笔记：\n${noteSummary}` : ''}
${litSummary ? `\n关联文献：\n${litSummary}` : ''}`,
  };

  const response = await adapter.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: promptMap[draftType] }] }],
    config: { temperature: 0.5 },
  });

  return (response?.text || '草稿生成失败').trim();
}

/**
 * 智能标签推荐：分析笔记内容，推荐已有标签或建议新标签
 */
export async function suggestTags(opts: {
  content: string;
  title: string;
  existingTags: string[];
  allUsedTags: string[];
}): Promise<string[]> {
  const { content, title, existingTags, allUsedTags } = opts;

  if (!content && !title) return [];

  const adapter = new UniversalAIAdapter();
  const truncated = content.length > 2000 ? content.slice(0, 2000) : content;

  const response = await adapter.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `你是一位科研标签分类专家。请根据以下笔记内容推荐 3-5 个标签。

规则：
1. 优先从已有标签库中匹配：[${allUsedTags.join(', ')}]
2. 如果已有标签不够，可以建议新标签
3. 不要推荐笔记已有的标签：[${existingTags.join(', ')}]
4. 标签应简洁（2-4字），无#号

标题：${title}
内容：${truncated}

请直接返回标签列表，每行一个标签，不要其他解释文字。`
          }
        ]
      }
    ],
    config: { temperature: 0.3 },
  });

  const rawText = response?.text || '';
  return rawText
    .split('\n')
    .map((line: string) => line.replace(/^[#\-*·•\d.)\s]+/, '').trim())
    .filter((tag: string) => tag.length >= 1 && tag.length <= 10 && !existingTags.includes(tag))
    .slice(0, 5);
}
