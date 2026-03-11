
import { useMemo } from 'react';
import { ResearchProject, Literature, ManuscriptMeta } from '../types';

/**
 * 极简清洗函数：移除所有空白、光标及占位符，统一转小写。
 * 这是确保 Map 查找 100% 命中的核心。
 */
export const getPureCiteKey = (str: string) => {
  return str
    .replace(/@@SCIFLOW_CURSOR@@/g, '')
    .replace(/@@STUB_\d+@@/g, '')
    .replace(/\s+/g, '')
    .replace(/[.，。]/g, '') // 移除可能的标点干扰
    .toLowerCase()
    .trim();
};

/**
 * 强化版引文匹配正则：
 * 1. (Author et al., 2024)
 * 2. [Patent/Ref, Source]
 * 排除系统内置标签: Fig, Table, Math, Ref
 */
export const CITE_REGEX = /(\((?:[^)]|@@SCIFLOW_CURSOR@@)+?,?\s*\d{4}\)|\[(?!(?:Fig|FigRef|Table|Math|Ref):)(?:[^\]]|@@SCIFLOW_CURSOR@@)+?\])/gi;

export const usePublishingCitations = ({
  project,
  resources,
  currentSections,
  activeSectionId,
  activeSectionContent,
  manuscriptMeta
}: {
  project: ResearchProject | undefined;
  resources: Literature[];
  currentSections: { id: string; label: string; icon: string }[];
  activeSectionId?: string;
  activeSectionContent?: string;
  manuscriptMeta: ManuscriptMeta;
}) => {
  return useMemo(() => {
    if (!project?.paperSections) return { list: [], map: new Map<string, number>() };

    const seenPureKeys = new Set<string>();
    const uniqueRawCites: string[] = [];

    // 1. 全文扫描，建立引用顺序
    currentSections.forEach(secDef => {
      const sec = project.paperSections?.find(s => s.id === secDef.id);
      if (!sec) return;

      const content = (activeSectionId === sec.id && activeSectionContent !== undefined)
        ? activeSectionContent
        : (sec.content || '');

      if (content) {
        // A. 扫描正文
        const matches = content.matchAll(CITE_REGEX);
        for (const match of matches) {
          const raw = match[0];
          const pure = getPureCiteKey(raw);
          if (!seenPureKeys.has(pure)) {
            seenPureKeys.add(pure);
            uniqueRawCites.push(raw);
          }
        }

        // B. 扫描正文中引用的表格
        const tableMatches = content.matchAll(/\[Table:\s*([\w\d_-]+)(?::(?:Full))?\s*\]/gi);
        for (const tMatch of tableMatches) {
          const tableId = tMatch[1];
          const table = project.tables?.find(t => t.id === tableId);
          if (table) {
            // 扫描表格标题
            const titleMatches = (table.title || '').matchAll(CITE_REGEX);
            for (const m of titleMatches) {
              const pure = getPureCiteKey(m[0]);
              if (!seenPureKeys.has(pure)) { seenPureKeys.add(pure); uniqueRawCites.push(m[0]); }
            }
            // 扫描表格表头
            table.headers.forEach(header => {
              const headerMatches = (header || '').matchAll(CITE_REGEX);
              for (const m of headerMatches) {
                const pure = getPureCiteKey(m[0]);
                if (!seenPureKeys.has(pure)) { seenPureKeys.add(pure); uniqueRawCites.push(m[0]); }
              }
            });
            // 扫描表格内容
            table.rows.forEach(row => {
              row.forEach(cell => {
                const cellMatches = (cell || '').matchAll(CITE_REGEX);
                for (const m of cellMatches) {
                  const pure = getPureCiteKey(m[0]);
                  if (!seenPureKeys.has(pure)) { seenPureKeys.add(pure); uniqueRawCites.push(m[0]); }
                }
              });
            });
            // 扫描表格注脚
            if (table.note) {
              const noteMatches = table.note.matchAll(CITE_REGEX);
              for (const m of noteMatches) {
                const pure = getPureCiteKey(m[0]);
                if (!seenPureKeys.has(pure)) { seenPureKeys.add(pure); uniqueRawCites.push(m[0]); }
              }
            }
          }
        }
      }
    });

    const validatedList: Literature[] = [];
    const finalMap = new Map<string, number>();

    // 2. 匹配数据库，生成 纯净Key -> 序号 的映射
    uniqueRawCites.forEach(raw => {
      const pureKey = getPureCiteKey(raw);
      let found: Literature | undefined;

      if (raw.startsWith('[')) {
        const inner = raw.slice(1, -1).toLowerCase();
        found = resources.find(r =>
          r.projectId === project?.id &&
          r.type === '专利' &&
          (inner.includes(r.title.toLowerCase()) || (r.source && inner.includes(r.source.toLowerCase())))
        );
      } else {
        const match = raw.match(/\((.+?)(?:(?:\s+et\s+al\.?|等))?,?\s*(\d{4})\)/i);
        if (match) {
          const name = match[1].trim().toLowerCase();
          const year = parseInt(match[2]);
          // 从作者名中提取姓氏，与引用标签中的名字进行精确匹配
          const getAuthorSurname = (a: string) => {
            const t = a.trim();
            if (t.includes(',')) return t.split(',')[0].trim().toLowerCase();
            if (/^[\u4e00-\u9fff]+$/.test(t)) return t.toLowerCase();
            return (t.split(/\s+/)[0] || t).toLowerCase();
          };
          found = resources.find(r =>
            r.projectId === project?.id &&
            r.year === year &&
            r.authors?.some(a => {
              const surname = getAuthorSurname(a);
              // 优先精确匹配姓氏，其次 fallback 到 includes
              return surname === name || a.toLowerCase().includes(name);
            })
          );
        }
      }

      if (found) {
        let idx = validatedList.findIndex(v => v.id === found!.id);
        if (idx === -1) {
          validatedList.push(found);
          idx = validatedList.length - 1;
        }
        finalMap.set(pureKey, idx + 1);
      }
    });

    return { list: validatedList, map: finalMap };
  }, [project?.paperSections, project?.id, project?.tables, resources, activeSectionId, activeSectionContent, currentSections]);
};
