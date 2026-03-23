// ═══ SciFlow Pro — 智能通知与自动化工作流引擎 类型定义 ═══

/** 通知类型 */
export type NotificationType =
  | 'deadline'       // 实验截止提醒
  | 'inventory'      // 库存预警
  | 'literature'     // 文献追踪
  | 'weekly_report'  // 周报提醒
  | 'cross_module'   // 跨模块联动
  | 'system';        // 系统通知

/** 通知优先级 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

/** 智能通知 */
export interface SmartNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  icon: string;
  color: string;
  sourceModule: string;
  sourceId?: string;
  actionLabel?: string;
  actionRoute?: string;
  createdAt: string;
  readAt?: string;
  dismissed?: boolean;
}

/** 自动化规则触发器类型 */
export type RuleTriggerType =
  | 'milestone_due'        // 里程碑到期
  | 'inventory_low'        // 库存低于阈值
  | 'feed_new'             // 文献新增
  | 'analysis_complete'    // 分析完成
  | 'weekly_check';        // 周检查

/** 自动化规则动作类型 */
export type RuleActionType =
  | 'notify'               // 发送通知
  | 'create_purchase'      // 自动创建采购项
  | 'update_log'           // 更新实验日志
  | 'generate_report';     // 生成周报

/** 自动化规则 */
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: RuleTriggerType;
    config: Record<string, any>;
  };
  actions: {
    type: RuleActionType;
    config: Record<string, any>;
  }[];
}

/** 周报数据 */
export interface WeeklyReport {
  id: string;
  weekLabel: string;           // 如 "2026-W12"
  generatedAt: string;
  content: string;             // Markdown
  stats: {
    experimentsCompleted: number;
    milestonesUpdated: number;
    literatureAdded: number;
    inventoryAlerts: number;
  };
}
