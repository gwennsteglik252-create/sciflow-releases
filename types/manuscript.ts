// Add missing AuthorProfile interface for academic writing metadata
export interface AuthorProfile {
    id: string;
    name: string;
    email: string;
    affiliation: string;
    address?: string;
    isCorresponding?: boolean;
    isCoFirst?: boolean;
}

// Add missing PaperSectionId type for standard academic and patent document structures
export type PaperSectionId = 'abstract' | 'introduction' | 'methods' | 'results' | 'discussion' | 'references' | 'exec_summary' | 'plan_actual' | 'conclusions' | 'next_steps' | 'background' | 'tech_solution' | 'claims' | 'embodiment';

// Add missing PaperSection interface representing an individual component of a manuscript
export interface PaperSection {
    id: string;
    title: string;
    content: string;
    fontSize?: number;
    sectionType?: string;
    fontFamilyEn?: string;
    fontFamilyZh?: string;
}

// Add missing LevelStyle interface for controlling hierarchical typography in documents
export interface LevelStyle {
    fontSize: number;
    indent: number;
    fontWeight: 'normal' | 'bold' | 'black';
    fontStyle: 'normal' | 'italic';
    fontFamily: string;
    showUnderline?: boolean;
    underlineColor?: string;
    numberingType: 'none' | 'arabic' | 'roman' | 'alpha';
    showSidebar?: boolean;
    uppercase?: boolean;
}

// Add missing ManuscriptMeta interface for global document properties
export interface ManuscriptMeta {
    title: string;
    runningTitle?: string;
    keywords?: string;
    authorList: AuthorProfile[];
    outlineStyles: {
        h1: LevelStyle;
        h2: LevelStyle;
        h3: LevelStyle;
    };
    keywordsStyle?: {
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string;
        fontStyle?: string;
        color?: string;
    };
}

// Add missing WritingSnapshot interface for version control in the writing module
export interface WritingSnapshot {
    id: string;
    title: string;
    timestamp: string;
    paperSections: PaperSection[];
    manuscriptMeta: ManuscriptMeta;
    citedLiteratureIds?: string[];
}

// Add missing FigureConflict interface for submission simulation audit results
export interface FigureConflict {
    type: 'missing_ref' | 'orphan_media' | 'data_mismatch';
    severity: 'critical' | 'warning';
    label: string;
    description: string;
    suggestion: string;
}

// Add missing SubmissionSimulation interface representing the state of a pre-submission audit
export interface SubmissionSimulation {
    coverLetter: string;
    figureConflicts: FigureConflict[];
    highlights: string[];
    lastCheckTimestamp: string;
}

// ═══ 投稿管理与期刊匹配系统 ═══

/** AI 推荐的目标期刊 */
export interface JournalMatch {
    name: string;
    impactFactor: number;
    acceptRate: string;
    reviewCycle: string;
    matchScore: number;
    matchReason: string;
    websiteUrl?: string;
    category?: string;
}

/** 审稿人的单条意见 */
export interface ReviewerComment {
    id: string;
    reviewerLabel: string;
    content: string;
    type: 'major' | 'minor' | 'positive';
    status: 'pending' | 'addressed' | 'rebutted';
    response?: string;
}

/** 投稿轮次记录 */
export interface SubmissionRound {
    id: string;
    roundNumber: number;
    journal: string;
    status: 'draft' | 'submitted' | 'under_review' | 'revision_required' | 'accepted' | 'rejected';
    submittedAt?: string;
    decidedAt?: string;
    decisionLetter?: string;
    reviewerComments: ReviewerComment[];
    responseLetter?: string;
    notes?: string;
}

/** 项目级的投稿跟踪器 */
export interface SubmissionTracker {
    targetJournals: JournalMatch[];
    rounds: SubmissionRound[];
    currentRoundId?: string;
    lastRecommendedAt?: string;
}

export interface SummaryImage {
    id: string;
    url: string;
    prompt?: string;
    // 图片变换字段：极坐标位移
    scale?: number;
    radialOffset?: number;  // 沿圆心轴线移动
    angularOffset?: number; // 沿圆弧摆动
}

export interface SummarySegment {
    id: string;
    title: string;
    content: string;
    icon?: string;
    color: string;
    imagePrompt: string;

    // 排版模式
    isAutoLayout?: boolean;

    // Legacy single image fields
    thumbnailUrl?: string;
    imageScale?: number;
    imageRadialOffset?: number;
    imageAngularOffset?: number;

    // New: Multiple images
    images?: SummaryImage[];

    // 视觉定制字段 (若为 undefined 则继承 Layer Config)
    titleColor?: string;
    contentColor?: string;
    titleSize?: number;
    contentSize?: number;
    titleFontFamily?: string;
    contentFontFamily?: string;
    titleFontWeight?: string;
    contentFontWeight?: string;
    titleFontStyle?: string;
    contentFontStyle?: string;
}

export interface LayerConfig {
    uniformImageCount?: number;   // 统一图片数量显示
    titleSize?: number;           // 统一标题字号
    contentSize?: number;         // 统一内文字号
    titleContentGap?: number;     // 标题与内文的径向间距
    titleOffset?: number;         // 标题相对于外沿的偏移
    // 全局字体配置
    titleFontFamily?: string;
    contentFontFamily?: string;
    titleFontWeight?: string;
    contentFontWeight?: string;
    titleFontStyle?: string;
    contentFontStyle?: string;
    titleColor?: string;         // 统一标题文字颜色
    contentColor?: string;       // 统一内容文字颜色
}

export interface SummaryLayer {
    id: string;
    name: string;
    segments: SummarySegment[];
    config?: LayerConfig; // 层级统一样式配置
}

export interface CircularSummaryData {
    title: string;
    coreIcon?: string;
    coreThumbnailUrl?: string;
    coreImagePrompt?: string;
    // 核心区域图片变换
    coreImageScale?: number;
    coreImageOffsetX?: number;
    coreImageOffsetY?: number;
    // 核心区域定制字段
    coreColor?: string;
    coreTitleColor?: string;
    coreIconColor?: string;
    coreFontSize?: number;
    coreFontFamily?: string;
    layers: SummaryLayer[];
}

export interface SavedCircularSummary {
    id: string;
    title: string;
    timestamp: string;
    category?: string;
    data: CircularSummaryData;
}