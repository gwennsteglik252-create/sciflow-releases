
import React from 'react';
import { ResearchProject, Literature, ManuscriptMeta } from '../../types';
import { TemplateConfig } from './WritingConfig';
import { usePublishingLogic } from '../../hooks/usePublishingLogic';
import { PublishingSidebar } from './Publishing/PublishingSidebar';
import { PublishingToolbar } from './Publishing/PublishingToolbar';
import { PageRenderer } from './Publishing/PageRenderer';

interface PublishingViewProps {
  project: ResearchProject | undefined;
  resources: Literature[];
  projectMedia: any[];
  docType: 'paper' | 'report' | 'patent';
  activeTemplate: TemplateConfig;
  templates: TemplateConfig[];
  manuscriptMeta: ManuscriptMeta;
  currentSections: { id: string; label: string; icon: string }[];
  onBack?: () => void;
  isRightSidebarVisible?: boolean;
  onToggleRightSidebar?: () => void;
  onSelectTemplate?: (id: string) => void;
  onManageSections?: () => void;
  activeSectionId?: string;
  cursorPosition?: number | null;
  activeSectionContent?: string;
  viewMode?: 'standard' | 'dual' | 'triple';
  isFocusMode?: boolean;
  onSyncClick?: (sectionId: string, offset: number, length: number) => void;
  onFigCaptionDblClick?: (refId: string) => void;
  onTableDblClick?: (tableId: string) => void;
  onMathDblClick?: (snippetId: string) => void;
  isJumpingManual?: boolean;
  language?: 'zh' | 'en';
}

export default function PublishingView({
  project, resources, projectMedia, activeTemplate, templates,
  manuscriptMeta, currentSections, onBack,
  isRightSidebarVisible, onToggleRightSidebar, onSelectTemplate,
  onManageSections, activeSectionId, cursorPosition, activeSectionContent, viewMode, docType,
  isFocusMode = false, onSyncClick, onFigCaptionDblClick, onTableDblClick, onMathDblClick, isJumpingManual, language = 'zh'
}: PublishingViewProps) {

  const {
    isSidebarOpen,
    setIsSidebarOpen,
    zoom,
    setZoom,
    isAutoZoom,
    setIsAutoZoom,
    scrollerRef,
    pages,
    scrollToSection
  } = usePublishingLogic({
    project,
    resources,
    projectMedia,
    currentSections,
    activeTemplate,
    manuscriptMeta,
    activeSectionId,
    cursorPosition,
    activeSectionContent,
    viewMode,
    isFocusMode,
    isJumpingManual,
    language
  });

  const templateStyles = activeTemplate.styles;

  // --- 严格从模板读取所有排版参数 ---
  const bodyStyle = templateStyles.body;
  const refStyle = templateStyles.references;
  const figCaptionStyle = templateStyles.figCaption;
  const tableCaptionStyle = templateStyles.tableCaption;
  const tableCellStyle = templateStyles.tableCell;
  const titleStyle = templateStyles.title;
  const authorsStyle = templateStyles.authors;
  const affiliationsStyle = templateStyles.affiliations;

  const abstractCss = `
    font-size: ${templateStyles.abstract.fontSize}pt;
    font-family: ${templateStyles.abstract.fontFamily};
    line-height: ${templateStyles.abstract.lineHeight};
    font-style: ${templateStyles.abstract.italic ? 'italic' : 'normal'};
    text-align: justify;
    background: #fdfdfd;
    padding: 10px 0;
    border-top: 0.5pt solid #000;
    border-bottom: 0.5pt solid #000;
    margin-bottom: 25px;
    column-span: all;
  `;

  const keywordsCss = `
    font-size: ${templateStyles.keywords.fontSize}pt;
    font-family: ${templateStyles.keywords.fontFamily};
    font-weight: ${templateStyles.keywords.fontWeight};
    color: ${templateStyles.keywords.color};
    margin-top: 10px;
    text-align: left;
  `;

  return (
    <div className="h-full flex flex-row bg-[#334155] overflow-hidden relative">
      <style>{`
        .page-scroller {
          flex: 1;
          overflow: auto;
          display: block;
          width: 100%;
          box-sizing: border-box;
          scroll-behavior: auto;
          -webkit-overflow-scrolling: touch;
          background-color: #334155;
        }

        .publishing-canvas-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          /* 核心调整：在自动缩放模式下，左右内边距设为 0，允许页面触边 */
          padding: ${isAutoZoom ? '20px 0px 80px 0px' : (isFocusMode ? '100vh 100vw' : '40px 20px 80px 20px')};
          min-width: 100%;
          backface-visibility: hidden;
          transform: translateZ(0);
        }
        
        h2.sync-target:hover, h3.sync-target:hover, h4.sync-target:hover {
            background-color: rgba(99, 102, 241, 0.05);
            outline: 1px dashed rgba(99, 102, 241, 0.2);
            border-radius: 2px;
        }

        .publishing-page {
          width: 210mm;
          min-width: 210mm;
          height: 297mm;
          background: white;
          padding: 18mm 18mm 18mm 18mm; 
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          position: relative;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          flex-shrink: 0;
          transform-origin: center top;
          will-change: transform;
        }
        .page-content-columns {
          column-gap: 8mm;
          column-fill: auto;
          /* A4内容区 = 297mm - padding 18mm×2 = 261mm */
          height: 261mm;
          /* 关键修复：overflow:clip 同时裁剪垂直和水平方向                    */
          /* 多列布局超出高度时会生成额外的列（水平方向），overflow:hidden 只   */
          /* 裁剪垂直溢出，而 overflow:clip 才能真正截断水平方向的额外列。      */
          overflow: clip;
          /* 双重保护：限制宽度，防止任何水平溢出版式 */
          max-width: 100%;
          text-align: justify;
          width: 100%;
          box-sizing: border-box;
        }
        /* 图片/表格/标题不允许被拆分到两列；段落允许自然跨列流动 */
        .page-content-columns .page-figure,
        .page-content-columns .article-table-wrapper,
        .page-content-columns .section-title,
        .page-content-columns .article-h2,
        .page-content-columns .article-h3,
        .page-content-columns .math-block {
          break-inside: avoid;
        }
        .paper-header-info {
          column-span: all;
          width: 100%;
          margin-bottom: 20px;
          text-align: center;
        }
        .header-journal-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 8pt;
            font-weight: bold;
            text-transform: uppercase;
            color: #1a1a1a;
            border-bottom: 0.5pt solid #333;
            padding-bottom: 3px;
        }
        /* ===== 论文标题/作者/单位 — 严格从模板读取 ===== */
        .paper-header-info .title {
          font-size: ${titleStyle.fontSize}pt;
          font-family: ${titleStyle.fontFamily};
          font-weight: ${titleStyle.fontWeight};
          line-height: 1.2;
          margin: 15px 0;
          color: #000;
        }
        .authors {
          font-size: ${authorsStyle.fontSize}pt;
          font-family: ${authorsStyle.fontFamily};
          font-weight: bold;
          margin-bottom: 8px;
          color: #333;
        }
        .affiliations {
          font-size: ${affiliationsStyle.fontSize}pt;
          font-family: ${affiliationsStyle.fontFamily};
          font-style: ${affiliationsStyle.fontStyle};
          color: #666;
          margin-bottom: 18px;
        }
        .abstract-container { ${abstractCss} }
        .keywords-container { ${keywordsCss} }
        .section-title {
          font-size: ${templateStyles.h1.fontSize}pt;
          font-weight: ${templateStyles.h1.fontWeight === 'black' ? '900' : 'bold'};
          font-family: ${templateStyles.h1.fontFamily};
          border-bottom: ${templateStyles.h1.showUnderline ? `0.5pt solid ${templateStyles.h1.underlineColor || '#000'}` : 'none'};
          margin: 15pt 0 8pt 0;
          padding-bottom: 3pt;
          color: #000;
          break-inside: avoid;
        }
        .article-h2 {
            font-size: ${templateStyles.h2.fontSize}pt;
            font-weight: ${templateStyles.h2.fontWeight === 'black' ? '900' : 'bold'};
            font-family: ${templateStyles.h2.fontFamily};
            margin: 12pt 0 6pt 0;
            color: #000;
            break-inside: avoid;
        }
        .article-h3 {
            font-size: ${templateStyles.h3.fontSize}pt;
            font-weight: ${templateStyles.h3.fontWeight === 'bold' ? '700' : 'normal'};
            font-family: ${templateStyles.h3.fontFamily};
            margin: 10pt 0 5pt 0;
            color: #000;
            font-style: ${templateStyles.h3.fontStyle};
            break-inside: avoid;
        }
        /* Katex 基础对齐修复与富文本支持 */
        .katex { font-size: 1.1em; line-height: 1.2; text-indent: 0; text-rendering: auto; }
        .katex .mathnormal { font-family: KaTeX_Math; font-style: italic; }
        .katex .base { position: relative; white-space: nowrap; }
        .katex .vlist-t { border-collapse: collapse; display: inline-table; table-layout: fixed; }
        .katex .vlist-r { display: table-row; }
        .katex .vlist { display: table-cell; position: relative; vertical-align: bottom; }
        
        /* 全局富文本格式化支持 */
        sub, sup {
          font-size: 75% !important;
          line-height: 0 !important;
          position: relative !important;
          vertical-align: baseline !important;
        }
        sup { top: -0.4em !important; }
        sub { bottom: -0.2em !important; }
        strong, b { font-weight: bold !important; color: #000; }
        em, i { font-style: italic !important; }

        /* ===== 正文段落 — 严格从模板读取 ===== */
        .article-p {
          font-size: ${bodyStyle.fontSize}pt;
          font-family: ${bodyStyle.fontFamily};
          line-height: ${bodyStyle.lineHeight};
          text-indent: ${bodyStyle.textIndent}em;
          margin-top: 0;
          margin-bottom: ${bodyStyle.paragraphSpacing}pt;
          color: ${bodyStyle.color};
          orphans: 3;
          widows: 3;
        }
        .article-p.no-indent { text-indent: 0; }
        
        /* ===== 表格 — 严格从模板读取 ===== */
        .article-table-wrapper {
          column-span: none;
          margin: 15pt 0;
          break-inside: avoid;
          width: 100%;
          display: block;
        }
        .scientific-table {
          width: 100%;
          border-collapse: collapse;
          border-top: 1.5pt solid #000;
          border-bottom: 1.5pt solid #000;
          font-size: ${tableCellStyle.fontSize}pt;
          font-family: ${tableCellStyle.fontFamily};
          margin-top: 5pt;
          line-height: 1.4;
        }
        .scientific-table th {
          border-bottom: 0.75pt solid #000;
          padding: 6pt 4pt;
          font-weight: bold;
          text-align: center;
        }
        .scientific-table td {
          padding: 5pt 4pt;
          text-align: center;
        }
        .table-caption {
          text-align: left;
          font-size: ${tableCaptionStyle.fontSize}pt;
          font-family: ${tableCaptionStyle.fontFamily};
          font-weight: normal;
          margin-bottom: 4pt;
          color: #000;
          width: 100%;
          display: block;
          line-height: 1.4;
          white-space: normal;
          word-wrap: break-word;
        }
        .table-note {
          font-size: ${Math.max(tableCellStyle.fontSize - 0.5, 7)}pt;
          font-family: ${tableCellStyle.fontFamily};
          margin-top: 6pt;
          font-style: italic;
          color: #444;
          text-align: left;
        }

        /* ===== 参考文献 — 严格从模板读取 ===== */
        .ref-item {
          font-size: ${refStyle.fontSize}pt;
          font-family: ${refStyle.fontFamily};
          line-height: ${refStyle.lineHeight};
          margin-bottom: 6pt;
          text-indent: -1.5em;
          padding-left: 1.5em;
          text-align: justify;
          word-break: break-word;
        }
        .cite-ref { color: #000; font-weight: bold; }
        .math-block { margin: 12pt 0; text-align: center; }

        /* ===== 图注 — 严格从模板读取 ===== */
        .page-figure { margin: 18pt 0; text-align: center; column-span: none; }
        .page-figure img { max-width: 100%; height: auto; display: block; margin: 0 auto 6pt auto; border: 0.2pt solid #eee; }
        .page-figure figcaption {
          font-size: ${figCaptionStyle.fontSize}pt;
          font-family: ${figCaptionStyle.fontFamily};
          color: #333;
          line-height: 1.4;
          text-align: justify;
        }
        .page-figure figcaption strong {
          font-weight: ${figCaptionStyle.labelFontWeight} !important;
        }
        
        @keyframes focus-glow {
            0%, 100% { border-color: rgba(99, 102, 241, 0.4); box-shadow: inset 0 0 25px rgba(99, 102, 241, 0.15); }
            50% { border-color: rgba(99, 102, 241, 0.9); box-shadow: inset 0 0 40px rgba(99, 102, 241, 0.3); }
        }
        .focus-mode-active-border { animation: focus-glow 3s infinite ease-in-out; border-width: 3px; }

        /* 页码：绝对定位到页面底部，不参与内容区 flex 布局 */
        .page-footer-num {
          position: absolute;
          bottom: 8mm;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 8pt;
          color: #888;
          pointer-events: none;
        }

        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .page-scroller { padding: 0 !important; gap: 0 !important; overflow: visible !important; }
          .publishing-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; border: none !important; transform: none !important; }
        }
      `}</style>

      <PublishingSidebar
        isOpen={isSidebarOpen}
        projectSections={project?.paperSections || []}
        onScrollToSection={scrollToSection}
        onManageSections={onManageSections}
      />

      <div className={`flex-1 flex flex-col min-w-0 ${isFocusMode ? 'focus-mode-active-border' : ''}`}>
        <PublishingToolbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onBack={onBack}
          zoom={zoom}
          setZoom={setZoom}
          isAutoZoom={isAutoZoom}
          setIsAutoZoom={setIsAutoZoom}
          isRightSidebarVisible={isRightSidebarVisible}
          onToggleRightSidebar={onToggleRightSidebar}
          activeTemplate={activeTemplate}
          templates={templates}
          onSelectTemplate={onSelectTemplate}
          viewMode={viewMode}
          docType={docType}
        />

        <div ref={scrollerRef} className="page-scroller custom-scrollbar no-print">
          <div className="publishing-canvas-container">
            <div className="flex flex-col items-center gap-[20px] transition-transform duration-300" style={{ transform: `scale(${zoom})`, transformOrigin: 'center top' }}>
              {pages.map((pageBlocks, pIdx) => (
                <PageRenderer
                  key={pIdx}
                  pageBlocks={pageBlocks}
                  pageIndex={pIdx}
                  activeTemplate={activeTemplate}
                  onSyncClick={onSyncClick}
                  onFigCaptionDblClick={onFigCaptionDblClick}
                  onTableDblClick={onTableDblClick}
                  onMathDblClick={onMathDblClick}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
