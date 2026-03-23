
/**
 * Scientific Journal Color Palettes & Visual Standards
 * Used for standardizing data visualization across the application.
 */

// 核心期刊配色字典
export const JOURNAL_PALETTES = {
  // 极高平衡感 - 适合综合性图表
  Nature: ['#E64B35', '#4DBBD5', '#00A087', '#3C5488'],
  
  // 现代鲜明 - 适合高对比度展示
  Science: ['#BC3C29', '#0072B5', '#E18727', '#20854E'],
  
  // 适合电化学/材料展示 - 冷色调为主
  JACS: ['#05445E', '#189AB4', '#75E6DA', '#D4F1F4'],
  
  // 色盲友好 - 高辨识度
  Safe: ['#D55E00', '#0072B2', '#009E73', '#CC79A7'],
} as const;

export type JournalThemeType = keyof typeof JOURNAL_PALETTES;

// 通用视觉参数标准
export const VISUAL_STANDARDS = {
  strokeWidth: 1.5, // Default line width in pt
  fonts: {
    sans: 'Arial, Helvetica, sans-serif', // Standard for Nature/Science
    serif: '"Times New Roman", Times, serif', // Standard for JACS/Chem
  },
  axis: {
    lineColor: '#1f2937', // Tailwind gray-800
    tickFontSize: 10, // px
  }
} as const;

/**
 * 获取完整的图表配置对象
 * @param themeName - 期刊主题名称
 */
export const getScientificThemeConfig = (themeName: JournalThemeType) => {
  // JACS 通常偏好衬线体 (Times New Roman)，其他多为非衬线体 (Arial)
  const fontFamily = themeName === 'JACS' ? VISUAL_STANDARDS.fonts.serif : VISUAL_STANDARDS.fonts.sans;

  return {
    colors: JOURNAL_PALETTES[themeName],
    chart: {
      fontFamily,
      strokeWidth: VISUAL_STANDARDS.strokeWidth,
    },
    axis: {
      stroke: VISUAL_STANDARDS.axis.lineColor,
      strokeWidth: 1, // Axis line usually thinner than data line
      tick: {
        fontSize: VISUAL_STANDARDS.axis.tickFontSize,
        fill: VISUAL_STANDARDS.axis.lineColor,
      }
    },
    grid: {
      stroke: '#e5e7eb', // Light gray for grid
      strokeDasharray: '3 3',
    }
  };
};
