
/** 思维图节点形状 */
export type MindMapNodeShape = 'rect' | 'rounded' | 'pill' | 'diamond' | 'circle';

/** 分层带内的节点 */
export interface MindMapNode {
  id: string;
  text: string;
  subText?: string;
  x: number;              // 层内相对 x（px）
  y: number;              // 层内相对 y（px）
  width: number;
  height: number;
  /** 'full' = 横跨整个层宽的横幅节点 */
  widthMode?: 'auto' | 'full';
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';
  textColor?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number;
  shape?: MindMapNodeShape;
  icon?: string;
  /** 副标题独立排版 */
  subTextFontSize?: number;
  subTextColor?: string;
  subTextFontWeight?: string;
}

/** 侧边标注 */
export interface SideAnnotation {
  text: string;
  position: 'left' | 'right';
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  backgroundColor?: string;
}

/** 分层带 */
export interface MindMapLayer {
  id: string;
  title: string;
  titlePosition?: 'left' | 'center' | 'top';
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'double' | 'none';
  borderWidth?: number;
  height: number;           // 层高度 px
  nodes: MindMapNode[];
  sideAnnotations?: SideAnnotation[];
  separatorStyle?: 'line' | 'double-line' | 'arrow' | 'none';
  /** 层标题排版 */
  titleFontSize?: number;
  titleFontWeight?: string;
  titleColor?: string;
  titleFontFamily?: string;
}

/** 连接线 */
export interface MindMapConnection {
  id: string;
  from: string;               // nodeId
  to: string;                 // nodeId
  label?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  color?: string;
  width?: number;
  arrowType?: 'forward' | 'backward' | 'bidirectional' | 'none';
  labelColor?: string;
  labelBgColor?: string;
  labelFontSize?: number;
  labelFontWeight?: string;
  labelFontFamily?: string;
  labelPosition?: 'above' | 'below' | 'on-line';
  /** elkjs 计算出的路由点（绝对坐标），渲染时优先使用 */
  routePoints?: { x: number; y: number }[];
}

/** 文本样式（用于全局默认 + 元素级覆盖） */
export interface TextStyle {
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  color?: string;
  letterSpacing?: string;
}

/** 全局配置 */
export interface MindMapGlobalConfig {
  layerGap: number;           // 层间距 px
  canvasWidth: number;        // 画布宽度 px
  fontFamily: string;
  titleFontSize: number;
  showSeparators: boolean;
  separatorColor: string;
  globalFontFamily?: string;
  /** 时间轴标签全局默认样式 */
  timelineStyle?: TextStyle;
  /** 侧边标注全局默认样式 */
  sideAnnotationStyle?: TextStyle;
}

/** 时间轴阶段 */
export interface TimelinePhase {
  label: string;          // 阶段名称, 如 "课前"
  fromLayer: number;      // 起始层索引 (0-based)
  toLayer: number;        // 结束层索引 (inclusive)
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
}

/** 完整思维图数据 */
export interface MindMapData {
  title: string;
  layers: MindMapLayer[];
  connections: MindMapConnection[];
  globalConfig: MindMapGlobalConfig;
  /** 左侧时间轴 */
  timeline?: TimelinePhase[];
  /** 底部图注 */
  caption?: string;
}

/** 已保存的思维图 */
export interface SavedMindMap {
  id: string;
  title: string;
  timestamp: string;
  category?: string;
  data: MindMapData;
}
