
import { useMemo, useEffect, useRef } from 'react';
import { ResearchProject, ManuscriptMeta, AuthorProfile, Literature } from '../types';
import { renderScientificText } from '../utils/textRenderer';
import { TemplateConfig } from '../components/Writing/WritingConfig';
import { CITE_REGEX, getPureCiteKey } from './usePublishingCitations';

// DOM 测量结果缓存
// v3: 改用 BFC 包裹测量（精确含 margin-bottom，不阻断 margin collapse）
const CACHE_VERSION = 'v3';
const measurementCache = new Map<string, number>();
const MAX_CACHE_SIZE = 500;

interface ContentBlock {
    id: string;
    html: string;
    height: number;
    isFullSpan?: boolean;
    clipTop?: number; // 跳过前 N px（用于跨页续接块）
}


export const usePublishingPagination = ({
    project, projectMedia, activeTemplate, manuscriptMeta,
    activeSectionId, cursorPosition, activeSectionContent, orderedCitations,
    currentSections, language = 'zh'
}: {
    project: ResearchProject | undefined;
    projectMedia: any[];
    activeTemplate: TemplateConfig;
    manuscriptMeta: ManuscriptMeta;
    activeSectionId?: string;
    cursorPosition?: number | null;
    activeSectionContent?: string;
    orderedCitations: { list: Literature[]; map: Map<string, number> };
    currentSections: { id: string; label: string; icon: string }[];
    language?: 'zh' | 'en';
}) => {

    const cursorHtml = `<span id="publishing-cursor-anchor" class="inline-block w-[1.5px] h-[0.9em] bg-rose-500 align-middle -ml-[0.75px] relative shadow-[0_0_4px_rgba(244,63,94,0.5)] z-50 rounded-full animate-pulse"></span>`;

    // 用 ref 跟踪 cursorPosition，这样 useMemo 不依赖它
    const cursorPositionRef = useRef(cursorPosition);
    cursorPositionRef.current = cursorPosition;
    const activeSectionIdRef = useRef(activeSectionId);
    activeSectionIdRef.current = activeSectionId;

    /**
     * 格式化标号数组 [1, 2, 3, 5] -> "1–3, 5"
     */
    const formatCitationNumbers = (nums: number[]) => {
        if (nums.length === 0) return "";
        const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
        const result: string[] = [];
        let start = sorted[0];
        let end = sorted[0];

        for (let i = 1; i <= sorted.length; i++) {
            if (i < sorted.length && sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                if (end - start >= 2) result.push(`${start}–${end}`);
                else if (end - start === 1) result.push(`${start}`, `${end}`);
                else result.push(`${start}`);
                if (i < sorted.length) {
                    start = sorted[i];
                    end = sorted[i];
                }
            }
        }
        return Array.from(new Set(result)).join(', ');
    };

    const pages = useMemo(() => {
        if (!project || !project.paperSections || project.paperSections.length === 0) return [];

        // 计算图交叉引用映射：扫描所有 section 中的 [Fig:xxx] 标签，按出现顺序为每个 refId 编号
        const figRefMap = new Map<string, number>();
        const figFoundIds = new Set<string>();
        let figSeqCounter = 0;
        (project.paperSections || []).forEach(section => {
            const content = (activeSectionId === section.id && activeSectionContent !== undefined) ? activeSectionContent : (section.content || '');
            if (!content) return;
            const matches = content.matchAll(/\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]/gi);
            for (const match of matches) {
                const id = match[1];
                if (!figFoundIds.has(id)) {
                    figFoundIds.add(id);
                    figRefMap.set(id, ++figSeqCounter);
                }
            }
        });

        /**
         * 增强型渲染管道 - 统一引用 utils/textRenderer，含图交叉引用解析
         */
        const renderFormattedText = (text: string) => {
            return renderScientificText(text, {
                activeTemplateId: activeTemplate.id,
                orderedCitations,
                cursorHtml,
                getPureCiteKey,
                CITE_REGEX,
                figRefMap
            });
        };

        const paperSections = project.paperSections;
        const firstSectionConfig = currentSections[0];
        const firstSectionId = firstSectionConfig?.id;
        const firstSectionLabel = firstSectionConfig?.label || 'Abstract';
        const COLUMNS = activeTemplate?.columns || 2;
        const allBlocks: ContentBlock[] = [];

        // === 严格从模板读取正文排版参数 ===
        const tplBody = activeTemplate?.styles?.body;
        const tplBodyFontSize = tplBody?.fontSize || 9.5;  // pt
        const tplBodyFontFamily = tplBody?.fontFamily || '"Times New Roman", serif';
        const tplBodyLineHeight = tplBody?.lineHeight || 1.5;
        const tplBodyParagraphSpacing = tplBody?.paragraphSpacing || 8;
        const tplRefStyle = activeTemplate?.styles?.references;

        // 基准行高（像素）：用于对齐排版网格，防止分页/分栏处的文字截断
        // 关键修复：增加 Math.max(..., 12) 兜底，防止模板未加载或配置异常导致 lhPx 为 0 从而引发分页崩溃
        const lhPx = Math.max(tplBodyFontSize * 1.333333 * tplBodyLineHeight, 12);

        // 辅助函数：渲染文本，注入 data 属性供光标后处理使用
        // 注意：不再在 useMemo 中注入光标，光标由独立的 useEffect 处理
        const injectCursorAndRender = (text: string, sectionId: string, baseOffset: number) => {
            if (!text) return "";
            return renderFormattedText(text);
        };

        const toRoman = (n: number) => {
            const lookup: any = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
            let roman = '';
            for (let i in lookup) { while (n >= lookup[i]) { roman += i; n -= lookup[i]; } }
            return roman;
        };
        const toAlpha = (n: number) => String.fromCharCode(64 + n);

        let h1Idx = 0, h2Idx = 0, h3Idx = 0, tableIdx = 0, figIdx = 0;
        const getNumStr = (lvl: 1 | 2 | 3, cfg: any) => {
            if (!cfg || cfg.numberingType === 'none') return '';
            if (lvl === 1) { h1Idx++; h2Idx = 0; h3Idx = 0; return (cfg.numberingType === 'roman' ? toRoman(h1Idx) : cfg.numberingType === 'alpha' ? toAlpha(h1Idx) : h1Idx) + '. '; }
            if (lvl === 2) { h2Idx++; h3Idx = 0; return (cfg.numberingType === 'alpha' ? toAlpha(h2Idx) : cfg.numberingType === 'roman' ? toRoman(h2Idx).toLowerCase() : `${h1Idx}.${h2Idx}`) + ' '; }
            if (lvl === 3) { h3Idx++; return (cfg.numberingType === 'arabic' ? h3Idx : `${h1Idx}.${h2Idx}.${h3Idx}`) + '. '; }
            return '';
        };

        const getFullAff = (a: AuthorProfile) => a.address ? `${a.affiliation}, ${a.address}` : a.affiliation;
        const authorList = manuscriptMeta?.authorList || [];
        const uniqueAffs = Array.from(new Set(authorList.map(getFullAff))).filter(Boolean);
        const getAffIdx = (aff: string) => uniqueAffs.indexOf(aff) + 1;

        let abstractRaw = (activeSectionId === firstSectionId && activeSectionContent !== undefined) ? activeSectionContent : (paperSections.find(s => s.id === firstSectionId)?.content || '');
        const kwStyle = manuscriptMeta?.keywordsStyle || {};
        const kwCss = `font-size: ${kwStyle.fontSize || 9}pt; font-family: ${kwStyle.fontFamily || 'inherit'}; font-weight: ${kwStyle.fontWeight || 'normal'}; font-style: ${kwStyle.fontStyle || 'italic'}; color: ${kwStyle.color || '#475569'}; text-align: left; margin-top: 10px; padding-top: 5px; border-top: 0.5pt solid #eee;`;

        const headerHtml = `<div class="paper-header-info"><div class="header-journal-line"><span>${activeTemplate?.name || ''}</span><span>${manuscriptMeta?.runningTitle || ''}</span></div><h1 class="title">${manuscriptMeta?.title || 'Untitled'}</h1><div class="authors">${authorList.map((a, i) => `${a.name}<sup>${getAffIdx(getFullAff(a))}${a.isCoFirst ? '†' : ''}${a.isCorresponding ? '*' : ''}</sup>${i < authorList.length - 1 ? ', ' : ''}`).join('')}</div><div class="affiliations">${uniqueAffs.map((aff, i) => `<p><sup>${i + 1}</sup>${aff}</p>`).join('')}</div>${(abstractRaw || manuscriptMeta?.keywords) ? `<div id="sec-title-${firstSectionId}" class="abstract-container"><div><strong>${firstSectionLabel}: </strong>${injectCursorAndRender(abstractRaw, firstSectionId, 0)}</div>${manuscriptMeta?.keywords ? `<div style="${kwCss}"><strong>Keywords: </strong>${renderFormattedText(manuscriptMeta.keywords)}</div>` : ''}</div>` : ''}</div>`;

        // Dynamic header height estimation
        const titleLines = Math.ceil((manuscriptMeta?.title?.length || 0) / 45); // Titles are big
        const abstractLines = abstractRaw.split('\n').map(l => Math.max(1, Math.ceil(l.length / 90))).reduce((a, b) => a + b, 0);
        const headerHeight = 140 + (titleLines * 35) + (abstractLines * 20) + (uniqueAffs.length * 15);

        allBlocks.push({ id: 'header', html: headerHtml, height: headerHeight, isFullSpan: true });

        currentSections.forEach(secDef => {
            if (secDef.id === firstSectionId || secDef.id === 'references') return;
            const section = paperSections.find(s => s.id === secDef.id);
            if (!section) return;

            allBlocks.push({ id: `sec-title-${section.id}`, html: `<h2 class="section-title sync-target" data-sync-section="${section.id}" data-sync-offset="0" data-sync-len="${section.title.length}">${getNumStr(1, activeTemplate?.styles?.h1)}${activeTemplate?.styles?.h1?.uppercase ? section.title.toUpperCase() : section.title}</h2>`, height: 65, isFullSpan: false });

            let rawContent = (activeSectionId === section.id && activeSectionContent !== undefined) ? activeSectionContent : (section.content || '');
            if (rawContent) {
                const tokenRegex = /(\$\$[\s\S]*?\$$|\\\[[\s\S]*?\\\]|\[Fig:\s*[\w\d_-]+(?::(?:Full))?\]|\[Table:\s*[\w\d_-]+(?::(?:Full))?\]|\[Math:\s*[\w\d_-]+\]|^(?:##|###)\s+.*)/gm;
                const parts = rawContent.split(tokenRegex);
                // 严格使用模板正文排版参数，不再使用 section 级别的字体 fallback
                const lhFactor = tplBodyFontSize * tplBodyLineHeight + (tplBodyParagraphSpacing / 2);

                let currentOffset = 0;
                parts.forEach((part, index) => {
                    if (part === undefined) return;
                    const trimmed = part.trim();
                    const partOffset = currentOffset;

                    if (trimmed.startsWith('## ')) {
                        const h2Content = part.replace('## ', '');
                        allBlocks.push({
                            id: `h2-${section.id}-${index}`,
                            html: `<h3 class="article-h2 sync-target" data-sync-section="${section.id}" data-sync-offset="${partOffset + 3}" data-sync-len="${h2Content.length}">${getNumStr(2, activeTemplate?.styles?.h2)}${injectCursorAndRender(h2Content, section.id, partOffset + 3)}</h3>`,
                            height: 45
                        });
                    }
                    else if (trimmed.startsWith('### ')) {
                        const h3Content = part.replace('### ', '');
                        allBlocks.push({
                            id: `h3-${section.id}-${index}`,
                            html: `<h4 class="article-h3 sync-target" data-sync-section="${section.id}" data-sync-offset="${partOffset + 4}" data-sync-len="${h3Content.length}">${getNumStr(3, activeTemplate?.styles?.h3)}${injectCursorAndRender(h3Content, section.id, partOffset + 4)}</h4>`,
                            height: 40
                        });
                    }
                    else if (part.match(/\[Math:\s*([\w\d_-]+)\s*\]/i)) {
                        const snippet = project.latexSnippets?.find(s => s.id === (part.match(/\[Math:\s*([\w\d_-]+)\s*\]/i)?.[1]));
                        if (snippet) allBlocks.push({ id: `math-tag-${snippet.id}`, html: `<div class="math-block">${renderFormattedText('$$' + snippet.content + '$$')}</div>`, height: 90 });
                    }
                    else if (part.match(/\[Table:\s*([\w\d_-]+)(?::(?:Full))?\s*\]/i)) {
                        const tableData = project.tables?.find(t => t.id === (part.match(/\[Table:\s*([\w\d_-]+)(?::(?:Full))?\s*\]/i)?.[1]));
                        if (tableData) {
                            const isFull = part.includes(':Full');
                            tableIdx++;
                            const tableLabel = activeTemplate?.tableLabel || 'Table';
                            const noteHtml = tableData.note ? `<div class="table-note">${renderFormattedText(tableData.note)}</div>` : '';
                            const tableHtml = `<div class="article-table-wrapper"><div class="table-caption"><strong>${tableLabel} ${tableIdx}.</strong> ${renderFormattedText(tableData.title)}</div><table class="scientific-table"><thead><tr>${tableData.headers.map(h => `<th>${renderFormattedText(h)}</th>`).join('')}</tr></thead><tbody>${tableData.rows.map(row => `<tr>${row.map(cell => `<td>${renderFormattedText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>${noteHtml}</div>`;
                            allBlocks.push({ id: `table-tag-${tableData.id}`, html: tableHtml, height: (tableData.rows.length + 1) * 38 + 75, isFullSpan: isFull });
                        }
                    }
                    else if (part.match(/^\[Fig:/i)) {
                        const figMatch = part.match(/\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]/i);
                        if (figMatch) {
                            const media = (projectMedia || []).find(m => m.refId === figMatch[1]);
                            if (media) {
                                figIdx++;
                                const figLabel = activeTemplate?.figLabel || 'Figure';
                                const figSep = activeTemplate?.figSeparator || '.';
                                const isFull = part.includes(':Full');
                                // 如果没有图注内容，则不再强行塞入 Result 占位符，而是回退给图片原来的 name，否则为空
                                const captionText = renderFormattedText(media.description?.split(/\s*\[Analysis\]\s*/i)[0] || media.name || '');
                                // 两栏模式列宽≈314px，图片实际渲染高度远小于单栏的360px
                                // Full-span图片横跨全宽，高度估算不变
                                const figHeightEst = isFull ? 440 : (COLUMNS === 1 ? 360 : 290);
                                allBlocks.push({ id: `fig-${media.refId}`, html: `<figure class="page-figure ${isFull ? 'full-span' : ''}"><img src="${media.url}" /><figcaption><strong>${figLabel} ${figIdx}${figSep}</strong> ${captionText}</figcaption></figure>`, height: figHeightEst, isFullSpan: isFull });
                            }
                        }
                    }
                    else {
                        const paragraphs = part.split(/(\n+)/);
                        let subParaOffset = 0;
                        const charsPerLine = COLUMNS === 1 ? 90 : 45;

                        paragraphs.forEach((p, pIdx) => {
                            if (pIdx % 2 !== 0 || !p.trim()) {
                                subParaOffset += p.length;
                                return;
                            }

                            // 去掉编辑器自动插入的全角空格缩进（\u3000\u3000），发布视图使用 CSS text-indent
                            const hasEditorIndent = p.startsWith('\u3000\u3000');
                            const cleanP = hasEditorIndent ? p.slice(2) : p;
                            const indentClass = hasEditorIndent ? 'article-p' : 'article-p no-indent';

                            // Accurate height estimation
                            const lines = cleanP.split('\n').map(line => Math.max(1, Math.ceil(line.length / charsPerLine)));
                            const totalLines = lines.reduce((a, b) => a + b, 0);
                            const estimatedHeight = totalLines * lhFactor + 15; // Tightened buffer

                            const paraOffset = partOffset + subParaOffset + (hasEditorIndent ? 2 : 0);
                            allBlocks.push({
                                id: `p-${section.id}-${index}-${pIdx}`,
                                html: `<p class="${indentClass} sync-target" data-sync-section="${section.id}" data-sync-offset="${paraOffset}" data-sync-len="${cleanP.length}">${injectCursorAndRender(cleanP, section.id, paraOffset)}</p>`,
                                height: estimatedHeight
                            });
                            subParaOffset += p.length;
                        });
                    }
                    currentOffset += part.length;
                });
            }
        });

        if (orderedCitations.list.length > 0) {
            // 综合写作语言 + 模板判断：英文语言或英文期刊模板都用 References
            const isChineseTemplate = activeTemplate?.figLabel === '图';
            const isEnglish = language === 'en' || !isChineseTemplate;
            const refsTitle = isEnglish ? 'References' : '参考文献';
            allBlocks.push({ id: 'sec-title-refs', html: `<h2 class="section-title">${refsTitle}</h2>`, height: 60 });

            orderedCitations.list.forEach((res, idx) => {
                const num = idx + 1;

                // 构造作者列表
                const formatAuthors = (authors: string[] | undefined, style: string): string => {
                    if (!authors || authors.length === 0) return 'Unknown';
                    if (style === 'nature') {
                        // Nature: 全部列出，逗号分隔，最后 &
                        if (authors.length === 1) return authors[0];
                        if (authors.length <= 3) return `${authors.slice(0, -1).join(', ')} & ${authors[authors.length - 1]}`;
                        return `${authors[0]} et al.`;
                    }
                    if (style === 'jacs' || style === 'science') {
                        // ACS/Science: Author1; Author2; ...
                        if (authors.length === 1) return authors[0];
                        if (authors.length === 2) return `${authors[0]}; ${authors[1]}`;
                        return `${authors[0]}; ${authors[1]}; et al.`;
                    }
                    if (style === 'cell') {
                        // Cell: Author1, Author2, ... and AuthorN
                        if (authors.length === 1) return authors[0];
                        if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
                        return `${authors[0]} et al.`;
                    }
                    // 默认（中文/通用）
                    if (authors.length === 1) return authors[0];
                    if (authors.length <= 3) return authors.join(', ');
                    return `${authors[0]}, ${authors[1]}, 等`;
                };

                const tplId = activeTemplate?.id || 'csb_zh';
                const citStyle = activeTemplate?.citationStyle || 'numbered';
                const authorStr = formatAuthors(res.authors, tplId);
                // 有 englishTitle 说明是外文文献，始终用英文原标题；否则用原始 title
                const rawTitle = res.englishTitle || res.title;
                const titleClean = rawTitle.endsWith('.') ? rawTitle.slice(0, -1) : rawTitle;
                const doiStr = res.doi ? ` https://doi.org/${res.doi.replace(/^https?:\/\/doi\.org\//, '')}` : '';

                let entryText: string;

                if (tplId === 'nature') {
                    // Nature: [num] Author(s). Title. *Journal* **vol**, pages (year).
                    entryText = `${num}. ${authorStr}. ${titleClean}. *${res.source}* (**${res.year}**).${doiStr}`;
                } else if (tplId === 'jacs') {
                    // JACS (ACS): (num) Author(s). Title. *Journal* year, vol, pages.
                    entryText = `(${num}) ${authorStr}. ${titleClean}. *${res.source}* **${res.year}**.${doiStr}`;
                } else if (tplId === 'science') {
                    // Science: num. Author(s), Title. *Journal* **vol**, pages (year).
                    entryText = `${num}. ${authorStr}, ${titleClean}. *${res.source}* (**${res.year}**).${doiStr}`;
                } else if (tplId === 'cell' || citStyle === 'author-year') {
                    // Cell/author-year: Author(s) (year). Title. Journal.
                    entryText = `${authorStr} (${res.year}). ${titleClean}. *${res.source}*.${doiStr}`;
                } else if (isEnglish) {
                    // 英文通用编号格式
                    entryText = `${num}. ${authorStr}. ${titleClean}. *${res.source}*, **${res.year}**.${doiStr}`;
                } else {
                    // 中文模板（GB/T 7714 风格简化版）: [num] 作者. 标题[J]. 期刊, 年份.
                    entryText = `[${num}] ${authorStr}. ${titleClean}[J]. ${res.source}, ${res.year}.${doiStr}`;
                }

                // 使用模板引用字号来估算行高
                const refFontSize = tplRefStyle?.fontSize || 8;
                const refLh = tplRefStyle?.lineHeight || 1.4;
                const refCharsPerLine = COLUMNS === 1 ? 100 : 50;
                const refLines = Math.max(1, Math.ceil(entryText.length / refCharsPerLine));
                const refLineHeight = refFontSize * refLh;

                allBlocks.push({ id: `ref-${idx}`, html: `<div class="ref-item">${renderFormattedText(entryText)}</div>`, height: refLines * refLineHeight + 8 });
            });
        }

        // ================================================================
        // DOM 实测：用隐藏容器测量每个 block 的真实渲染高度
        // 替代不准确的字符数估算，彻底解决内容填不满/溢出的问题
        // ================================================================
        if (typeof document !== 'undefined' && allBlocks.length > 0) {
            // 页面内容区宽度：210mm - 左右padding各18mm = 174mm
            const PAGE_W_MM = 174;
            const MM_TO_PX = 3.7795275591;
            const PAGE_W_PX = PAGE_W_MM * MM_TO_PX;  // ≈ 658px
            const COL_GAP_PX = 8 * MM_TO_PX;          // ≈ 30px
            const COL_W_PX = COLUMNS > 1
                ? (PAGE_W_PX - COL_GAP_PX * (COLUMNS - 1)) / COLUMNS
                : PAGE_W_PX;

            // 过滤出需要实际 DOM 测量的 block（缓存命中的跳过）
            const blocksNeedMeasure: { block: typeof allBlocks[0]; blockW: number }[] = [];
            allBlocks.forEach(block => {
                const blockW = block.isFullSpan ? PAGE_W_PX : COL_W_PX;
                const cacheKey = `${CACHE_VERSION}|${block.id}|${blockW}|${block.html.length}|${block.html.slice(0, 80)}`;
                const cached = measurementCache.get(cacheKey);
                if (cached !== undefined) {
                    block.height = Math.ceil(cached / lhPx) * lhPx;
                } else {
                    blocksNeedMeasure.push({ block, blockW });
                }
            });

            // ─────────────────────────────────────────────────────────────────
            // BFC 包裹测量法（精确含 margin-bottom，不阻断 margin collapse）
            //
            // 原理：将每个 block 放入一个 overflow:auto 的 BFC 容器。
            //       BFC 容器的 offsetHeight 会自动包含子元素的 margin-bottom，
            //       因为 BFC 根据 clearance 规范会将子 margin 纳入自身高度。
            //
            // 注意：每个 block 单独放入一个 BFC 容器，所以 block 间的
            //       margin collapse 不会被计入（与实际 CSS column 渲染一致，
            //       因为 column 内连续 block 的 margin 实际上会 collapse，
            //       但 collapse 量因内容而异，统一不计比高估更安全）。
            // ─────────────────────────────────────────────────────────────────
            if (blocksNeedMeasure.length > 0) {
                // 全局测量根容器（正常流，在屏幕外）
                const measureRoot = document.createElement('div');
                measureRoot.style.cssText = `
                    position:absolute; left:-99999px; top:0;
                    visibility:hidden; pointer-events:none;
                    font-family: ${tplBodyFontFamily};
                    font-size: ${tplBodyFontSize}pt;
                    line-height: ${tplBodyLineHeight};
                    text-align: justify;
                `;
                document.body.appendChild(measureRoot);

                blocksNeedMeasure.forEach(({ block, blockW }) => {
                    // BFC 包裹容器：overflow:auto 让容器高度包含子块的 margin-bottom
                    const bfc = document.createElement('div');
                    bfc.style.cssText = `width:${blockW}px; overflow:auto; box-sizing:border-box;`;

                    const inner = document.createElement('div');
                    inner.innerHTML = block.html;

                    // 图片：尝试从浏览器缓存获取实际尺寸
                    const imgs = inner.querySelectorAll<HTMLImageElement>('img');
                    imgs.forEach(img => {
                        const probe = new Image();
                        probe.src = img.src;
                        if (probe.complete && probe.naturalWidth > 0) {
                            const scaledH = (probe.naturalHeight / probe.naturalWidth) * Math.min(blockW, probe.naturalWidth);
                            img.style.height = `${scaledH}px`;
                            img.style.display = 'block';
                            img.style.maxWidth = '100%';
                        } else {
                            img.style.height = `${block.isFullSpan ? 380 : 220}px`;
                            img.style.display = 'block';
                            img.style.maxWidth = '100%';
                        }
                    });

                    bfc.appendChild(inner);
                    measureRoot.appendChild(bfc);

                    // BFC 容器的 offsetHeight = 内容高度 + 子元素 margin-bottom
                    const measured = bfc.offsetHeight;

                    if (measured > 10) {
                        block.height = Math.ceil(measured / lhPx) * lhPx;
                        const cacheKey = `${CACHE_VERSION}|${block.id}|${blockW}|${block.html.length}|${block.html.slice(0, 80)}`;
                        if (measurementCache.size > MAX_CACHE_SIZE) {
                            const keys = Array.from(measurementCache.keys());
                            keys.slice(0, MAX_CACHE_SIZE / 2).forEach(k => measurementCache.delete(k));
                        }
                        measurementCache.set(cacheKey, measured);
                    }
                });

                document.body.removeChild(measureRoot);
            }
        }

        // ================================================================
        // 列感知分页模拟（Column-Aware Pagination Simulation）
        // ================================================================
        //
        // 为什么需要列感知：
        //   CSS `column-fill: auto` + `break-inside: avoid` 在列边界会产生
        //   空隙（gap）。线性累加模型 `linearUsed += h` 无法捕获这些空隙，
        //   导致 JS 认为页面放得下，但 CSS 实际溢出被 `overflow:clip` 裁断。
        //
        // 方案：
        //   用 `colFills[0..N-1]` 逐列追踪已填充高度，模拟 CSS 的真实行为：
        //   - 段落/参考文献（无 break-inside:avoid）：可跨列拆分
        //   - 标题/图表/公式（有 break-inside:avoid）：必须整列放置
        //   - fullSpan 块：跨全列，消耗垂直空间后重置列填充
        //
        // 安全裕量：1%（≈10px），覆盖 orphans/widows 和亚像素渲染误差
        // ================================================================
        const MM_TO_PX_96 = 96 / 25.4;
        const PAGE_H_PX = Math.round(261 * MM_TO_PX_96);  // ≈ 987px
        const SAFETY_PX = Math.ceil(lhPx);                 // 留 1 行安全裕量
        const PAGE_H = Math.floor((PAGE_H_PX - SAFETY_PX) / lhPx) * lhPx;

        // 判断 block 是否可跨列拆分（对应 CSS 无 break-inside:avoid）
        const canSplitAcrossColumns = (blockId: string): boolean => {
            return blockId.startsWith('p-') || blockId.startsWith('ref-');
        };

        const resultPages: ContentBlock[][] = [];
        let currentPageBlocks: ContentBlock[] = [];
        let colFills: number[] = new Array(COLUMNS).fill(0);
        let currentCol = 0;
        let fullSpanUsed = 0;
        let availableColH = PAGE_H;

        const startNewPage = () => {
            if (currentPageBlocks.length > 0) resultPages.push([...currentPageBlocks]);
            currentPageBlocks = [];
            colFills = new Array(COLUMNS).fill(0);
            currentCol = 0;
            fullSpanUsed = 0;
            availableColH = PAGE_H;
        };

        // 计算当前列起、所有列剩余空间之和
        const getTotalRemaining = (): number => {
            let total = 0;
            for (let c = currentCol; c < COLUMNS; c++) {
                total += availableColH - colFills[c];
            }
            return total;
        };

        // 将可拆分 block 的高度分配到各列（模拟 CSS 跨列流动）
        const fillSplittable = (height: number) => {
            let leftover = height;
            while (leftover > 0 && currentCol < COLUMNS) {
                const colSpace = availableColH - colFills[currentCol];
                if (leftover <= colSpace) {
                    colFills[currentCol] += leftover;
                    leftover = 0;
                } else {
                    leftover -= colSpace;
                    colFills[currentCol] = availableColH;
                    currentCol++;
                }
            }
            return leftover; // >0 表示溢出所有列
        };

        allBlocks.forEach(block => {
            if (block.isFullSpan) {
                // fullSpan 块占全宽，结束当前列区间
                // 垂直占用 = fullSpanUsed + 当前列区间最高列
                const tallestCol = Math.max(...colFills);
                const verticalUsed = fullSpanUsed + tallestCol;
                if (verticalUsed + block.height > PAGE_H && currentPageBlocks.length > 0) {
                    startNewPage();
                }
                currentPageBlocks.push(block);
                fullSpanUsed += block.height;
                availableColH = Math.floor(Math.max(0, PAGE_H - fullSpanUsed) / lhPx) * lhPx;
                // fullSpan 后列区间重新开始
                colFills = new Array(COLUMNS).fill(0);
                currentCol = 0;

            } else if (canSplitAcrossColumns(block.id)) {
                // ── 可拆分块（段落/参考文献）：跨列自然流动 ──
                const totalRemaining = getTotalRemaining();
                if (block.height <= totalRemaining) {
                    // 当前页放得下
                    fillSplittable(block.height);
                    currentPageBlocks.push(block);
                } else {
                    // 放不下 → 换页后放入
                    startNewPage();
                    fillSplittable(block.height);
                    currentPageBlocks.push(block);
                }

            } else {
                // ── 不可拆分块（标题/图/表/公式）：必须整体放入某一列 ──
                let placed = false;
                // 从当前列开始，找第一个放得下的列
                for (let c = currentCol; c < COLUMNS; c++) {
                    if (availableColH - colFills[c] >= block.height) {
                        // 跳到列 c（CSS 跳过中间列底部的空隙）
                        currentCol = c;
                        colFills[c] += block.height;
                        currentPageBlocks.push(block);
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    // 当前页所有列都放不下 → 换页
                    startNewPage();
                    colFills[0] = block.height;
                    currentPageBlocks.push(block);
                }
            }
        });

        if (currentPageBlocks.length > 0) resultPages.push(currentPageBlocks);
        return resultPages;
    }, [project, manuscriptMeta, projectMedia, orderedCitations, activeTemplate, activeSectionId, activeSectionContent, currentSections, language]);
    // 注意：cursorPosition 已从依赖中移除！光标变化不再触发整个分页重算

    // ================================================================
    // 轻量级光标注入
    // ================================================================
    // 原始文本偏移 vs 渲染后 DOM 文本的长度不一致问题：
    //   引用: [Smith, 2023](16字符) → [1](3字符)
    //   LaTeX: $E=mc^2$(8字符) → KaTeX HTML（大量嵌套 span）
    //
    // 解决方案：统一的 walkNode 函数直接在遍历时插入光标
    //   - 文本节点：rawPos == domPos，用 splitText 精确插入
    //   - data-raw-len 元素：作为原子单元处理（不递归子节点）
    //     若光标在其内部，把光标插在该元素之后
    //   - 普通元素（em/strong）：递归进入
    // ================================================================
    useEffect(() => {
        const cp = cursorPositionRef.current;
        const sid = activeSectionIdRef.current;
        const oldAnchor = document.getElementById('publishing-cursor-anchor');
        if (oldAnchor) oldAnchor.remove();

        if (cp === null || cp === undefined || sid === undefined) return;

        // 找到光标所在的段落元素
        const allTargets = document.querySelectorAll<HTMLElement>(`.sync-target[data-sync-section="${sid}"]`);
        let foundTarget: HTMLElement | null = null;
        let rawOffsetInPara = 0;

        allTargets.forEach(el => {
            const baseOffset = parseInt(el.getAttribute('data-sync-offset') || '0');
            const len = parseInt(el.getAttribute('data-sync-len') || '0');
            if (cp >= baseOffset && cp <= baseOffset + len) {
                foundTarget = el;
                rawOffsetInPara = cp - baseOffset;
            }
        });

        const target = foundTarget as HTMLElement | null;
        if (!target) return;

        // 构建光标 span
        const cursorSpan = document.createElement('span');
        cursorSpan.id = 'publishing-cursor-anchor';
        cursorSpan.className = 'inline-block w-[1.5px] h-[0.9em] bg-rose-500 align-middle -ml-[0.75px] relative shadow-[0_0_4px_rgba(244,63,94,0.5)] z-50 rounded-full animate-pulse';

        // rawPos：当前在原始文本中走到哪里了
        let rawPos = 0;
        let inserted = false;

        // 统一遍历函数：遍历 DOM 节点，将 rawPos 与 rawOffsetInPara 对齐后插入光标
        const walkNode = (node: Node): boolean => {
            if (inserted) return true;

            if (node.nodeType === Node.TEXT_NODE) {
                const textLen = node.textContent?.length || 0;
                if (rawPos + textLen >= rawOffsetInPara) {
                    // 光标在此文本节点内，直接 splitText 插入
                    const relOffset = rawOffsetInPara - rawPos;
                    try {
                        const afterNode = (node as Text).splitText(
                            Math.min(Math.max(0, relOffset), textLen)
                        );
                        afterNode.parentNode?.insertBefore(cursorSpan, afterNode);
                        inserted = true;
                    } catch (_) {
                        target.appendChild(cursorSpan);
                        inserted = true;
                    }
                    return true;
                }
                rawPos += textLen;
                return false;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const rawLenAttr = el.getAttribute('data-raw-len');
                const mdExtraAttr = el.getAttribute('data-md-extra');

                if (rawLenAttr !== null) {
                    // ── 原子元素（引用/LaTeX/br）：不递归进入子节点 ──
                    const rawLenNum = parseInt(rawLenAttr);
                    if (rawPos + rawLenNum > rawOffsetInPara) {
                        // 光标落在此原子元素内（或之上），把光标插在元素之后
                        el.parentNode?.insertBefore(cursorSpan, el.nextSibling);
                        inserted = true;
                        return true;
                    }
                    rawPos += rawLenNum;
                    return false; // 不递归，跳过整个元素
                }

                if (mdExtraAttr !== null) {
                    // ── Markdown 格式元素（strong/em）：递归进入，但额外计入标记符字符 ──
                    // 例：**bold** 变成 <strong data-md-extra="4">bold</strong>
                    //   rawPos 需要先跳过 ** (2字符)，处理内容，再跳过 ** (2字符)
                    const extra = parseInt(mdExtraAttr);
                    const halfExtra = extra / 2; // 左侧标记符长度

                    // 光标在左侧标记符内（比如在 ** 里面）
                    if (rawPos + halfExtra > rawOffsetInPara) {
                        el.parentNode?.insertBefore(cursorSpan, el);
                        inserted = true;
                        return true;
                    }
                    rawPos += halfExtra; // 跳过左侧标记符

                    // 递归处理内容
                    for (const child of Array.from(el.childNodes)) {
                        if (walkNode(child)) return true;
                    }

                    // 光标在右侧标记符内
                    if (rawPos + halfExtra > rawOffsetInPara) {
                        el.parentNode?.insertBefore(cursorSpan, el.nextSibling);
                        inserted = true;
                        return true;
                    }
                    rawPos += halfExtra; // 跳过右侧标记符
                    return false;
                }

                // 普通元素（em、strong、br 等），递归进入
                for (const child of Array.from(node.childNodes)) {
                    if (walkNode(child)) return true;
                }
            }
            return false;
        };

        for (const child of Array.from(target.childNodes)) {
            if (walkNode(child)) break;
        }

        // 没找到合适位置（比如光标在段落末尾），放到末尾
        if (!inserted) {
            target.appendChild(cursorSpan);
        }
    }, [pages, cursorPosition, activeSectionId]);

    return pages;
};
