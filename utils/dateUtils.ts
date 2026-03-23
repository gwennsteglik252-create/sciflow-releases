// ═══ Shared Date Utility Functions ═══
// Extracted from ProjectOverviewView & ProjectReportsView to eliminate duplication.

/** 时间戳 → 排序用数值 */
export const tsToNum = (ts: string): number => {
  try {
    const d = new Date(ts.replace(/\//g, '-'));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch { return 0; }
};

/** 判断是否本月 */
export const isThisMonth = (ts: string): boolean => {
  try {
    const d = new Date(ts.replace(/\//g, '-'));
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch { return false; }
};

/** 短日期格式 M/D */
export const fmtDate = (ts: string): string => {
  try {
    const d = new Date(ts.replace(/\//g, '-'));
    if (isNaN(d.getTime())) return ts;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return ts; }
};

/** 按月分组键 (例: "2026年3月") */
export const getMonthGroupKey = (timestamp: string): string => {
  try {
    const dateStr = timestamp.split(' ')[0].replace(/-/g, '/');
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '未知时间';
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  } catch {
    return '未知时间';
  }
};

/** 时间戳 → 排序用数值 (标准化版) */
export const parseTimestampToNum = (ts: string): number => {
  try {
    const normalized = ts.replace(/-/g, '/').replace(/\//g, '-');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
};

/** 另一种本月判断 (通用化 isCurrentMonth) */
export const isCurrentMonth = (ts: string): boolean => {
  try {
    const dateStr = ts.split(' ')[0].replace(/-/g, '/');
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch { return false; }
};

/** 获取 N 天前的日期对象 */
export const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** 获取时间戳所属的周序号 (相对于今天, 0=本周, 1=上周...) */
export const getWeekIndex = (ts: string): number => {
  try {
    const d = new Date(ts.replace(/\//g, '-'));
    if (isNaN(d.getTime())) return -1;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7);
  } catch { return -1; }
};
