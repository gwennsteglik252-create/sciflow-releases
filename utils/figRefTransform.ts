
/**
 * FigRef 标签双向转换工具
 * 编辑器显示 «N:XXXX»（图号 + refId后缀），存储时用后缀稳定还原
 */

/** 将 [FigRef:xxx] 缩短为 «N:shortId» 用于编辑器显示 */
export function shortenFigRefs(
    content: string,
    figRefMap?: Map<string, number>
): string {
    if (!content) return content;
    return content.replace(/\[FigRef:([\w\d_-]+)\]/gi, (_match, refId) => {
        const short = refId.startsWith('IMG_PROJ_') ? refId.slice(9) : refId;
        const num = figRefMap?.get(refId);
        // 有图号则显示 «N:ID»，无图号则只显示 «ID»
        return num !== undefined ? `«${num}:${short}»` : `«${short}»`;
    });
}

/** 将 «N:shortId» 或 «shortId» 还原为 [FigRef:xxx]（用后缀还原，忽略图号） */
export function expandFigRefs(content: string): string {
    if (!content) return content;
    // 匹配 «数字:ID» 或 «ID»，提取 ID 部分
    return content.replace(/«(?:\d+:)?([\w\d_-]+)»/g, (_match, id) => {
        const fullId = id.length <= 6 ? `IMG_PROJ_${id}` : id;
        return `[FigRef:${fullId}]`;
    });
}

/** 将编辑器（短形式）中的光标位置映射到内部（长形式）中的位置 */
export function mapDisplayPosToInternal(
    displayContent: string,
    displayPos: number
): number {
    if (!displayContent) return displayPos;
    let delta = 0;
    const regex = /«(?:\d+:)?([\w\d_-]+)»/g;
    let match;
    while ((match = regex.exec(displayContent)) !== null) {
        if (match.index >= displayPos) break;
        const id = match[1];
        const fullId = id.length <= 6 ? `IMG_PROJ_${id}` : id;
        const internalTag = `[FigRef:${fullId}]`;
        delta += internalTag.length - match[0].length;
    }
    return displayPos + delta;
}

/** 将内部（长形式）中的位置映射到编辑器（短形式）中的光标位置 */
export function mapInternalPosToDisplay(
    internalContent: string,
    internalPos: number,
    figRefMap?: Map<string, number>
): number {
    if (!internalContent) return internalPos;
    let delta = 0;
    const regex = /\[FigRef:([\w\d_-]+)\]/gi;
    let match;
    while ((match = regex.exec(internalContent)) !== null) {
        if (match.index >= internalPos) break;
        const refId = match[1];
        const short = refId.startsWith('IMG_PROJ_') ? refId.slice(9) : refId;
        const num = figRefMap?.get(refId);
        const displayTag = num !== undefined ? `«${num}:${short}»` : `«${short}»`;
        delta += displayTag.length - match[0].length;
    }
    return internalPos + delta;
}
