/**
 * 科研笔记本模块类型定义
 * Research Notebook Module Types
 */

/** 笔记类型枚举 */
export type NoteType = 'thought' | 'meeting' | 'reading' | 'experiment' | 'idea';

/** 研究阶段（用于 Kanban 看板） */
export type NoteResearchStage = 'idea' | 'experimenting' | 'results' | 'published';

/** 附件类型 */
export interface NoteAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;           // bytes
  dataUrl: string;        // base64 DataURL
}

/** 版本历史条目 */
export interface NoteHistoryEntry {
  timestamp: string;      // ISO string
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
}

/** 结构化实验日志数据 */
export interface ExperimentLogData {
  objective: string;      // 实验目标
  materials: string;      // 材料与仪器
  procedure: string;      // 实验步骤
  results: string;        // 实验结果
  conclusion: string;     // 讨论与结论
}

/** 同步的文献批注 */
export interface SyncedAnnotation {
  text: string;           // 高亮原文
  note: string;           // 批注内容
  color: string;          // 标注颜色
  literatureId: string;   // 来源文献 ID
  literatureTitle?: string;
  timestamp: string;
}

/** 单条笔记 */
export interface NotebookNote {
  id: string;
  title: string;
  content: string;             // Markdown 内容
  type: NoteType;
  tags: string[];
  linkedProjectIds: string[];
  linkedLiteratureIds: string[];
  linkedNoteIds: string[];      // 双向链接
  isPinned: boolean;
  isFavorite: boolean;
  color?: string;               // 可选卡片颜色标记
  attachments: NoteAttachment[];
  aiSummary?: string;           // AI 生成的摘要
  history: NoteHistoryEntry[];  // 版本历史
  experimentData?: ExperimentLogData;  // 实验日志结构化数据
  syncedAnnotations?: SyncedAnnotation[]; // 同步的文献批注
  researchStage?: NoteResearchStage;  // 研究阶段（Kanban）
  createdAt: string;
  updatedAt: string;
}

/** 内置模板 */
export interface NoteTemplate {
  id: string;
  name: string;
  type: NoteType;
  icon: string;
  tags: string[];
  content: string;
}

/** 视图模式 */
export type NotebookViewMode = 'grid' | 'list' | 'timeline' | 'graph' | 'stats' | 'kanban';

/** 排序方式 */
export type NotebookSortBy = 'updatedAt' | 'createdAt' | 'title';

/** 笔记会话（全局状态） */
export interface NotebookSession {
  notes: NotebookNote[];
  activeTags: string[];
  searchQuery: string;
  viewMode: NotebookViewMode;
  sortBy: NotebookSortBy;
}
