
export type DiagramTemplate = 'omics' | 'framework';
export type NodeType = string;

export interface TextConfig {
  fontSize?: number;
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  borderWidth?: number;
  borderColor?: string;
}

export interface DiagramNode {
  id: string;
  text: string;
  subText?: string;
  type: NodeType;
  icon?: string;
  params?: string[];
  customColor?: string;
  fontSize?: 'sm' | 'md' | 'lg'; // Keep for backward compatibility
  textConfig?: TextConfig;
  subTextConfig?: TextConfig;
  paramsConfig?: TextConfig;
  autoSync?: boolean;             // 同组同步：组内颜色+排版同步
  typographyGlobalSync?: boolean; // 排版全局同步：仅排版跨所有节点，颜色独立
}

export interface GroupConfig {
  titleSize?: number;
  titleColor?: string;
  titleFontWeight?: string;
  titleFontStyle?: string;
  titleFontFamily?: string;
  titleBgColor?: string;
  titleTextColor?: string;
  backgroundColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  padding?: number;
  gap?: number;
  titlePaddingX?: number;
  titlePaddingY?: number;
}

export interface DiagramGroup {
  id: string;
  title: string;
  type: 'container';
  nodes: DiagramNode[];
  colorTheme?: string;
  config?: GroupConfig;
  autoSync?: boolean;
}

export interface Connection {
  from: string;
  to: string;
  label?: string;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  width?: number;
  arrowSize?: number;
  offset?: { x: number; y: number };
  arrowType?: 'forward' | 'backward' | 'bidirectional' | 'none';
  arrowShape?: 'arrow' | 'dot' | 'diamond';
  labelFontSize?: number;
  labelConfig?: TextConfig;
  boxConfig?: TextConfig;
  labelPosition?: 'on-line' | 'above' | 'below' | 'left' | 'right';
  autoSync?: boolean;
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface SavedDiagram {
  id: string;
  title: string;
  timestamp: string;
  category?: string;
  data: { groups: DiagramGroup[], connections: any[] };
  positions: Record<string, NodePosition>;
  spacingConfig?: { nodeGap: number; groupPaddingX: number };
}
