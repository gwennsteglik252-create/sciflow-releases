// 1. Added TimelineEventType for research evolution paths
export type TimelineEventType = 'breakthrough' | 'milestone' | 'publication' | 'industrial' | 'failed_attempt';

export interface TimelineEvent {
  id: string;
  date: string; // "2024" or "Q1 2025" or "1991-05"
  title: string;
  description: string;
  type: TimelineEventType;
  side: 'top' | 'bottom'; // 节点分布在轴的哪一侧
  lineLength?: number; // 连接线物理长度
  lineStrokeWidth?: number;  // 连接线粗细
  lineStyle?: 'solid' | 'dashed' | 'dotted';  // 连接线虚实
  color?: string;
  icon?: string;
  mediaUrl?: string;
  dotSize?: number;  // 锚点圆点大小
  dotShape?: 'circle' | 'diamond' | 'square';  // 锚点形状
  bubbleWidth?: number;  // 气泡卡片宽度
  // 气泡样式定制
  bubbleConfig?: {
    bgColor?: string;        // 气泡背景色
    borderColor?: string;    // 气泡边框色
    borderWidth?: number;    // 气泡边框宽度
    borderRadius?: number;   // 气泡圆角
    opacity?: number;        // 气泡整体透明度
    glassEffect?: boolean;   // 玻璃拟态效果
    titleFontSize?: number;  // 标题字号
    descFontSize?: number;   // 描述字号
    fontFamily?: string;     // 全局字体族（回退）
    titleFontFamily?: string; // 标题字体族
    descFontFamily?: string;  // 描述字体族
    dateFontFamily?: string;  // 日期字体族
    titleFontWeight?: string;
    titleFontStyle?: string;
    descFontWeight?: string;
    descFontStyle?: string;
    titleColor?: string;
    descColor?: string;
    dateFontSize?: number;
    dateFontWeight?: string;
    dateFontStyle?: string;
    dateColor?: string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';       // 全局对齐（回退）
    titleTextAlign?: 'left' | 'center' | 'right' | 'justify';   // 标题对齐
    descTextAlign?: 'left' | 'center' | 'right' | 'justify';    // 描述对齐
    dateTextAlign?: 'left' | 'center' | 'right' | 'justify';    // 日期对齐
  };
}

export type TimelineArrowStyle = 'classic' | 'open' | 'stealth' | 'diamond' | 'none';

export interface TimelineData {
  title: string;
  pathType: 'straight' | 'wave' | 'stepped' | 'scurve' | 'zigzag';
  events: TimelineEvent[];
  theme: string;
  axisLength?: number;     // 主轴线长度 (px, 默认1000)
  axisWidth?: number;      // 主轴粗细
  arrowWidth?: number;     // 箭头尺寸 (独立控制)
  glowIntensity?: number;  // 辉光强度
  axisColor?: string;      // 主轴颜色 (支持渐变或纯色)
  gradientPreset?: string; // 渐变预设 ID
  arrowStyle?: TimelineArrowStyle; // 箭头样式
  showArrow?: boolean;     // 是否显示箭头
  isHollow?: boolean;      // 是否为空心样式
  distributionMode?: 'proportional' | 'equal'; // 节点分布模式
  waveCurvature?: number;  // 波浪型曲率振幅 (默认280)
  straightTilt?: number;   // 直线型倾斜量 (默认0，正值上倾)
  steppedCount?: number;   // 阶梯型台阶数 (默认3)
  steppedHeight?: number;  // 阶梯型每阶高度 (默认80)
  scurveSteepness?: number; // S曲线陡峭度 (默认10)
  scurveAmplitude?: number; // S曲线振幅 (默认120)
  zigzagAmplitude?: number; // 锯齿型振幅 (默认80)
  zigzagCount?: number;    // 锯齿型齿数 (默认2)
  crossLinks?: TimelineCrossLink[];  // 节点间关联连线
}

// 跨节点关联连线
export interface TimelineCrossLink {
  id: string;
  fromId: string;  // 起始节点 ID
  toId: string;    // 目标节点 ID
  label?: string;  // 连线标签
  color?: string;  // 连线颜色
  style?: 'solid' | 'dashed' | 'dotted';  // 连线样式
  width?: number;  // 连线宽度
}

export interface SavedTimeline {
  id: string;
  title: string;
  timestamp: string;
  data: TimelineData;
}

// --- Knowledge Graph Types ---
/* Added GraphNode to support KnowledgeGraph visualization */
export interface GraphNode {
  id: string;
  label: string;
  type: 'Project' | 'Literature' | 'Patent' | 'Characterization' | 'TRL_Milestone' | 'Cost' | 'Metric';
  x: number;
  y: number;
  trlLevel?: number;
  evidenceWeight?: number;
  status?: 'active' | 'success' | 'failed';
  meta?: any;
  patentData?: {
    riskLevel: 'Low' | 'Medium' | 'High';
    blockageDesc?: string;
    similarPatent?: string;
    advice?: string;
  };
  charData?: {
    linkedLogId?: string;
    analysisText?: string;
  };
  costData?: {
    value: number;
    currency: string;
    unit: string;
  };
}

/* Added GraphEdge to support KnowledgeGraph relationships */
export interface GraphEdge {
  source: string;
  target: string;
  type: 'relates_to' | 'proves' | 'derived_from' | 'contradicts';
  weight?: number;
}

// --- Figure Assembly Types ---

/* 2. Added FigureText for text overlays on figure panels */
export interface FigureText {
  id: string;
  x: number;
  y: number;
  content: string;
  fontSize: number;
  fontWeight: string;
  fontStyle?: string;
  color: string;
  fontFamily: string;
  // Layer system
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  name?: string; // custom layer name
}

/* 3. Added FigureHeadStyle for line/arrow ends */
export type FigureHeadStyle = 'solid' | 'open' | 't-bar' | 'circle' | 'double-solid' | 'double-open' | 'none';

/* 4. Added FigureShape for geometric annotations on figures */
export interface FigureShape {
  id: string;
  type: 'arrow' | 'line' | 'rect' | 'circle';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  dashStyle?: 'solid' | 'dashed' | 'dotted';
  headStyle?: FigureHeadStyle;
  // Layer system
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  name?: string;
}

/* 5. Added FigurePanel for composite figure assembly */
export interface FigurePanel {
  id: string;
  imgUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  labelFontSize?: number;
  labelFontFamily?: string;
  labelFontWeight?: string;
  labelFontStyle?: string;
  labelPadding?: number;
  texts: FigureText[];
  shapes: FigureShape[];
  spanCols?: number;
  spanRows?: number;
  // Layer system
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  name?: string; // custom layer name
  // Crop: normalized 0-1 values (percentage of original image)
  crop?: { x: number; y: number; w: number; h: number };
}

/* Added SavedFigureAssembly to support FigureAssembly persistence */
export interface SavedFigureAssembly {
  id: string;
  title: string;
  timestamp: string;
  panels: FigurePanel[];
  layoutConfig: { rows: number; cols: number };
}

// --- Scientific Table & Equation Types ---

/* 6. Added ProjectTable for scientific three-line tables */
export interface ProjectTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
  note?: string;
  timestamp: string;
  style?: {
    fontSize?: number;
    titleFontSize?: number;
    fontFamily?: string;
  };
}

/* 7. Added ProjectLatexSnippet for reusable LaTeX math/chem fragments */
export interface ProjectLatexSnippet {
  id: string;
  title: string;
  content: string;
  type: 'math' | 'chem';
  isBlock?: boolean;
  timestamp: string;
}

// --- Data Analysis Chart Types ---

/* 8. Added ChartDataPoint for atomic chart entries */
export interface ChartDataPoint {
  name: string;
  value: number;
  error?: number;
}

/* 9. Added AnnotationType for chart interaction tools */
export type AnnotationType = 'text' | 'arrow' | 'line' | 'rect' | 'circle';

/* 10. Added ChartAnnotation for persisting visual overlays on charts */
export interface ChartAnnotation {
  id: string;
  type: AnnotationType;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  dashStyle?: 'solid' | 'dashed' | 'dotted';
  headStyle?: 'solid' | 'open' | 'none';
  fontWeight?: string;
  fontStyle?: string;
  fontFamily?: string;
  text?: string;
}

/* 11. Added DataSeries for grouped chart data and its styling */
export interface DataSeries {
  id: string;
  name: string;
  data: ChartDataPoint[];
  color?: string;
  pointColor?: string;
  strokeWidth?: number;
  visible?: boolean;
  pointShape?: 'circle' | 'sphere' | 'square' | 'diamond' | 'triangleUp' | 'triangleDown' | 'cross' | 'star' | 'none';
  pointSize?: number;
  showErrorBar?: boolean;
  errorBarType?: 'both' | 'plus';
  errorBarWidth?: number;
  errorBarStrokeWidth?: number;
  errorBarColor?: string;
}

// --- Classification Tree / Hierarchical Diagram Types ---

export type TreeLayoutDirection = 'TB' | 'LR' | 'RL' | 'BT' | 'radial'; // Top-Bottom, Left-Right, Radial (fan-shaped)

export interface TreeNodeStyle {
  backgroundColor?: string;
  bgColor?: string; // fallback
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  textColor?: string;
  color?: string; // fallback
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  iconColor?: string;
  width?: number;
  height?: number;
  paddingX?: number;
  paddingY?: number;
  shadowColor?: string;
  shadowBlur?: number;
  opacity?: number;
  // 描述文字排版属性
  descFontSize?: number;
  descFontWeight?: string;
  descFontStyle?: string;
  descColor?: string;
  descTextAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface TreeConnectionStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  curveType?: 'straight' | 'bezier' | 'step' | 'elbow';
  animate?: boolean;
}

export interface ClassificationTreeNode {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  children?: ClassificationTreeNode[];
  collapsed?: boolean;
  style?: TreeNodeStyle;
  depth?: number; // auto-computed
  /** 节点形状 */
  nodeShape?: 'rect' | 'circle' | 'diamond' | 'square';
}

export interface ClassificationTreeData {
  title: string;
  rootNode: ClassificationTreeNode;
  layout: TreeLayoutDirection;
  theme: string;
  globalNodeStyle?: TreeNodeStyle;
  connectionStyle?: TreeConnectionStyle;
  levelColors?: string[]; // color palette per depth level
  horizontalSpacing?: number;
  verticalSpacing?: number;
  showDepthIndicator?: boolean;
  /** 全局节点形状 */
  nodeShape?: 'rect' | 'circle' | 'diamond' | 'square';
}

export interface SavedClassificationTree {
  id: string;
  title: string;
  timestamp: string;
  data: ClassificationTreeData;
}

// ─────────────────────────────────────────────
// Sankey Diagram Types
// ─────────────────────────────────────────────

/** 桑基图节点 */
export interface SankeyNode {
  id: string;
  label: string;
  /** 可选自定义颜色；未指定时由调色板自动分配 */
  color?: string;
  /** 节点描述/备注 */
  description?: string;
  /** 节点分组（用于自动着色或分层标注） */
  group?: string;
  /** 节点在列中的固定位置 0-1（0=顶部，1=底部）；null 表示自动 */
  fixedPosition?: number | null;
  /** 节点宽度（像素，默认16） */
  nodeWidth?: number;
  /** 是否隐藏节点标签 */
  hideLabel?: boolean;
  /** 标签位置 */
  labelSide?: 'left' | 'right' | 'auto';
  /** 节点图标 */
  icon?: string;
  /** 自定义样式 */
  style?: Partial<TreeNodeStyle>;
}

/** 桑基图连线 */
export interface SankeyLink {
  id: string;
  source: string;   // SankeyNode.id
  target: string;   // SankeyNode.id
  value: number;    // 流量/权重，必须 > 0
  /** 连线标签 */
  label?: string;
  /** 可选自定义颜色；未指定时继承 source 节点色 */
  color?: string;
  /** 透明度 0-1 */
  opacity?: number;
  /** 连线高亮标注 */
  highlight?: boolean;
}

/** 节点对齐方式 */
export type SankeyAlignment = 'left' | 'right' | 'center' | 'justify';

/** 连线曲线类型 */
export type SankeyCurveType = 'bezier' | 'linear' | 'step';

/** 标签字体样式 */
export interface SankeyLabelStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
}

/** 桑基图完整数据 */
export interface SankeyData {
  title: string;
  /** 标题样式 */
  titleStyle?: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    color?: string;
    fontFamily?: string;
    letterSpacing?: number;
    textDecoration?: string;
    offsetY?: number;
    opacity?: number;
    hidden?: boolean;
  };
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** 节点宽度（全局默认，可被节点覆盖） */
  nodeWidth?: number;
  /** 节点之间的垂直间距 */
  nodePadding?: number;
  /** 布局列对齐方式 */
  alignment?: SankeyAlignment;
  /** 连线曲线风格 */
  curveType?: SankeyCurveType;
  /** 是否显示数值标注 */
  showValues?: boolean;
  /** 数值单位后缀 */
  valueUnit?: string;
  /** 数值标签的显示样式 */
  valueStyle?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    opacity?: number;
  };
  /** 节点调色板（循环使用） */
  colorPalette?: string[];
  /** 标签样式 */
  labelStyle?: SankeyLabelStyle;
  /** 节点矩形圆角半径（默认 3px） */
  nodeCornerRadius?: number;
  /** 连线默认透明度 0-1（默认 0.4） */
  linkOpacity?: number;
  /** 布局模式：linear (线性桑基) | chord (环形弦图) */
  layoutMode?: 'linear' | 'chord';
  /** 背景色 */
  backgroundColor?: string;
  /** 主题名称 */
  theme?: string;
  /** 备注/说明 */
  note?: string;

  // ── Chord 环形布局专属属性 ──
  /** 环形半径比例 0.1-0.5（相对于画布短边的比例，默认 0.35） */
  chordRadius?: number;
  /** 弧段宽度（节点弧线粗细，默认 12px） */
  chordArcWidth?: number;
  /** 内圈偏移（ribbon 与弧线的间距，默认 10px） */
  chordInnerOffset?: number;
  /** 节点间隙比例 0-0.3（弧段之间的空隙占比，默认 0.1） */
  chordGapRatio?: number;
  /** 连线默认透明度 0-1（ribbon 基础透明度，默认 0.25） */
  chordLinkOpacity?: number;
  /** 标签偏移距离（标签离圆弧的距离，默认 25px） */
  chordLabelOffset?: number;
  /** 起始角度 0-360°（环形旋转偏移角度，默认 0） */
  chordStartAngle?: number;
}

/** 保存到库的桑基图记录 */
export interface SavedSankey {
  id: string;
  title: string;
  timestamp: string;
  data: SankeyData;
}