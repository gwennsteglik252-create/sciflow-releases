import { MindMapData } from './types';

/** 默认层颜色 */
export const LAYER_COLORS = [
  '#E8F0FE', // 浅蓝
  '#FEF3E2', // 浅橙
  '#E8F5E9', // 浅绿
  '#F3E5F5', // 浅紫
  '#FFF3E0', // 浅黄
  '#E0F2F1', // 浅青
];

/** 默认节点颜色方案 */
export const NODE_COLOR_PRESETS = [
  { bg: '#4A90D9', text: '#ffffff', border: '#3A7BBF', name: '学术蓝' },
  { bg: '#F5DEB3', text: '#5D4037', border: '#D4B896', name: '暖麦色' },
  { bg: '#81C784', text: '#1B5E20', border: '#66BB6A', name: '清新绿' },
  { bg: '#CE93D8', text: '#4A148C', border: '#BA68C8', name: '优雅紫' },
  { bg: '#90CAF9', text: '#0D47A1', border: '#64B5F6', name: '天空蓝' },
  { bg: '#FFAB91', text: '#BF360C', border: '#FF8A65', name: '暖橙色' },
  { bg: '#A5D6A7', text: '#2E7D32', border: '#81C784', name: '翡翠绿' },
  { bg: '#B0BEC5', text: '#263238', border: '#90A4AE', name: '银灰色' },
];

/** 默认全局配置 */
export const DEFAULT_GLOBAL_CONFIG = {
  layerGap: 20,
  canvasWidth: 880,
  fontFamily: "'Noto Sans SC', 'Microsoft YaHei', sans-serif",
  titleFontSize: 18,
  showSeparators: true,
  separatorColor: '#90A4AE',
};

/** 预设模板：论文研究框架 */
const RESEARCH_FRAMEWORK_TEMPLATE: MindMapData = {
  title: '研究框架图',
  globalConfig: { ...DEFAULT_GLOBAL_CONFIG },
  layers: [
    {
      id: 'layer_1',
      title: '第一部分：研究背景',
      backgroundColor: '#E8F0FE',
      borderStyle: 'dashed',
      height: 180,
      separatorStyle: 'double-line',
      sideAnnotations: [{ text: '文献综述', position: 'right', color: '#1565C0' }],
      nodes: [
        { id: 'n1_1', text: '研究现状', x: 80, y: 40, width: 160, height: 50, backgroundColor: '#4A90D9', textColor: '#fff', fontSize: 14 },
        { id: 'n1_2', text: '研究空白', x: 300, y: 40, width: 160, height: 50, backgroundColor: '#4A90D9', textColor: '#fff', fontSize: 14 },
        { id: 'n1_3', text: '研究问题', x: 520, y: 40, width: 160, height: 50, backgroundColor: '#4A90D9', textColor: '#fff', fontSize: 14 },
        { id: 'n1_4', text: '研究目标', x: 740, y: 40, width: 160, height: 50, backgroundColor: '#FFA726', textColor: '#fff', fontSize: 14 },
      ],
    },
    {
      id: 'layer_2',
      title: '第二部分：研究方法',
      backgroundColor: '#FEF3E2',
      borderStyle: 'dashed',
      height: 180,
      separatorStyle: 'arrow',
      sideAnnotations: [{ text: '方法论', position: 'right', color: '#E65100' }],
      nodes: [
        { id: 'n2_1', text: '实验设计', x: 100, y: 40, width: 160, height: 50, backgroundColor: '#FF8F00', textColor: '#fff', fontSize: 14 },
        { id: 'n2_2', text: '数据采集', x: 340, y: 40, width: 160, height: 50, backgroundColor: '#FF8F00', textColor: '#fff', fontSize: 14 },
        { id: 'n2_3', text: '数据分析', x: 580, y: 40, width: 160, height: 50, backgroundColor: '#FF8F00', textColor: '#fff', fontSize: 14 },
      ],
    },
    {
      id: 'layer_3',
      title: '第三部分：研究结论',
      backgroundColor: '#E8F5E9',
      borderStyle: 'dashed',
      height: 160,
      separatorStyle: 'none',
      sideAnnotations: [{ text: '归纳总结', position: 'right', color: '#2E7D32' }],
      nodes: [
        { id: 'n3_1', text: '主要发现', x: 200, y: 40, width: 200, height: 50, backgroundColor: '#43A047', textColor: '#fff', fontSize: 14 },
        { id: 'n3_2', text: '未来展望', x: 500, y: 40, width: 200, height: 50, backgroundColor: '#43A047', textColor: '#fff', fontSize: 14 },
      ],
    },
  ],
  connections: [
    { id: 'c1', from: 'n1_1', to: 'n1_2', label: '发现', arrowType: 'forward', style: 'solid', color: '#4A90D9' },
    { id: 'c2', from: 'n1_2', to: 'n1_3', label: '提出', arrowType: 'forward', style: 'solid', color: '#4A90D9' },
    { id: 'c3', from: 'n1_3', to: 'n1_4', label: '聚焦', arrowType: 'forward', style: 'solid', color: '#4A90D9' },
    { id: 'c4', from: 'n1_4', to: 'n2_1', label: '指导', arrowType: 'forward', style: 'dashed', color: '#90A4AE' },
    { id: 'c5', from: 'n2_1', to: 'n2_2', arrowType: 'forward', style: 'solid', color: '#FF8F00' },
    { id: 'c6', from: 'n2_2', to: 'n2_3', arrowType: 'forward', style: 'solid', color: '#FF8F00' },
    { id: 'c7', from: 'n2_3', to: 'n3_1', label: '总结', arrowType: 'forward', style: 'dashed', color: '#90A4AE' },
    { id: 'c8', from: 'n3_1', to: 'n3_2', label: '延伸', arrowType: 'forward', style: 'solid', color: '#43A047' },
  ],
};

/** 预设模板：教学设计 */
const TEACHING_DESIGN_TEMPLATE: MindMapData = {
  title: '教学设计框架图',
  globalConfig: { ...DEFAULT_GLOBAL_CONFIG },
  layers: [
    {
      id: 'layer_pre',
      title: '课前准备',
      backgroundColor: '#E3F2FD',
      borderStyle: 'solid',
      height: 140,
      separatorStyle: 'line',
      sideAnnotations: [
        { text: '预习阶段', position: 'left', color: '#1565C0' },
        { text: '自主学习', position: 'right', color: '#1565C0' },
      ],
      nodes: [
        { id: 'tp_1', text: '基础知识测试', x: 200, y: 30, width: 200, height: 50, backgroundColor: '#42A5F5', textColor: '#fff', fontSize: 14 },
        { id: 'tp_2', text: '预习材料', x: 500, y: 30, width: 200, height: 50, backgroundColor: '#42A5F5', textColor: '#fff', fontSize: 14 },
      ],
    },
    {
      id: 'layer_during',
      title: '课中教学',
      backgroundColor: '#FFF8E1',
      borderStyle: 'solid',
      height: 300,
      separatorStyle: 'line',
      sideAnnotations: [
        { text: '互动教学', position: 'left', color: '#F57F17' },
        { text: '问题驱动', position: 'right', color: '#E65100' },
      ],
      nodes: [
        { id: 'td_1', text: '情景导入', x: 60, y: 30, width: 160, height: 50, backgroundColor: '#FFA726', textColor: '#fff', fontSize: 14 },
        { id: 'td_2', text: '概念讲授', x: 280, y: 30, width: 160, height: 50, backgroundColor: '#FFB74D', textColor: '#5D4037', fontSize: 14 },
        { id: 'td_3', text: '小组讨论', x: 500, y: 30, width: 160, height: 50, backgroundColor: '#FFA726', textColor: '#fff', fontSize: 14 },
        { id: 'td_4', text: '实践操作', x: 720, y: 30, width: 160, height: 50, backgroundColor: '#FFA726', textColor: '#fff', fontSize: 14 },
        { id: 'td_5', text: '课堂展示', x: 200, y: 120, width: 200, height: 50, backgroundColor: '#EF6C00', textColor: '#fff', fontSize: 14 },
        { id: 'td_6', text: '教师总结', x: 500, y: 120, width: 200, height: 50, backgroundColor: '#EF6C00', textColor: '#fff', fontSize: 14 },
      ],
    },
    {
      id: 'layer_post',
      title: '课后巩固',
      backgroundColor: '#E8F5E9',
      borderStyle: 'solid',
      height: 140,
      separatorStyle: 'none',
      sideAnnotations: [
        { text: '拓展提升', position: 'left', color: '#2E7D32' },
        { text: '能力评估', position: 'right', color: '#2E7D32' },
      ],
      nodes: [
        { id: 'tpo_1', text: '课后作业', x: 200, y: 30, width: 200, height: 50, backgroundColor: '#66BB6A', textColor: '#fff', fontSize: 14 },
        { id: 'tpo_2', text: '拓展探索', x: 500, y: 30, width: 200, height: 50, backgroundColor: '#66BB6A', textColor: '#fff', fontSize: 14 },
      ],
    },
  ],
  connections: [
    { id: 'tc1', from: 'tp_1', to: 'tp_2', arrowType: 'forward', style: 'solid', color: '#42A5F5' },
    { id: 'tc2', from: 'tp_2', to: 'td_1', label: '引入', arrowType: 'forward', style: 'dashed', color: '#90A4AE' },
    { id: 'tc3', from: 'td_1', to: 'td_2', arrowType: 'forward', style: 'solid', color: '#FFA726' },
    { id: 'tc4', from: 'td_2', to: 'td_3', arrowType: 'forward', style: 'solid', color: '#FFA726' },
    { id: 'tc5', from: 'td_3', to: 'td_4', arrowType: 'forward', style: 'solid', color: '#FFA726' },
    { id: 'tc6', from: 'td_4', to: 'td_5', arrowType: 'forward', style: 'dashed', color: '#EF6C00' },
    { id: 'tc7', from: 'td_5', to: 'td_6', arrowType: 'forward', style: 'solid', color: '#EF6C00' },
    { id: 'tc8', from: 'td_6', to: 'tpo_1', label: '巩固', arrowType: 'forward', style: 'dashed', color: '#90A4AE' },
    { id: 'tc9', from: 'tpo_1', to: 'tpo_2', arrowType: 'forward', style: 'solid', color: '#66BB6A' },
  ],
};

/** 预设模板：空白框架 */
const BLANK_TEMPLATE: MindMapData = {
  title: '未命名框架思维图',
  globalConfig: { ...DEFAULT_GLOBAL_CONFIG },
  layers: [
    {
      id: `layer_${Date.now()}_0`,
      title: '第一阶段',
      backgroundColor: '#E8F0FE',
      borderStyle: 'dashed',
      height: 160,
      separatorStyle: 'line',
      nodes: [
        { id: `n_${Date.now()}_0`, text: '节点 1', x: 200, y: 40, width: 160, height: 50, backgroundColor: '#4A90D9', textColor: '#fff', fontSize: 14 },
        { id: `n_${Date.now()}_1`, text: '节点 2', x: 450, y: 40, width: 160, height: 50, backgroundColor: '#4A90D9', textColor: '#fff', fontSize: 14 },
      ],
    },
    {
      id: `layer_${Date.now()}_1`,
      title: '第二阶段',
      backgroundColor: '#FEF3E2',
      borderStyle: 'dashed',
      height: 160,
      separatorStyle: 'none',
      nodes: [
        { id: `n_${Date.now()}_2`, text: '节点 3', x: 200, y: 40, width: 160, height: 50, backgroundColor: '#FF8F00', textColor: '#fff', fontSize: 14 },
        { id: `n_${Date.now()}_3`, text: '节点 4', x: 450, y: 40, width: 160, height: 50, backgroundColor: '#FF8F00', textColor: '#fff', fontSize: 14 },
      ],
    },
  ],
  connections: [],
};

export const MINDMAP_TEMPLATES: { name: string; desc: string; data: MindMapData }[] = [
  { name: '论文研究框架', desc: '标准三段式研究结构：背景 → 方法 → 结论', data: RESEARCH_FRAMEWORK_TEMPLATE },
  { name: '教学设计框架', desc: '课前 → 课中 → 课后三阶段教学流程', data: TEACHING_DESIGN_TEMPLATE },
  { name: '空白框架', desc: '最小化模板，从零开始搭建', data: BLANK_TEMPLATE },
];
