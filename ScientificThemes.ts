export interface ScientificTheme {
  id: string;
  name: string;
  description: string;
  chartConfig: {
    backgroundColor: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: number | string;
    strokeWidth: number;
    colors: string[];
    grid: {
      stroke: string;
      strokeDasharray: string;
      visible: boolean;
    };
    axis: {
      stroke: string;
      strokeWidth: number;
      tickStroke: string;
    };
    legendPosition: 'top' | 'right' | 'bottom';
    barRadius?: number;
  };
  layout: {
    columns: 1 | 2;
    padding: number;
    aspectRatio?: number;
  };
}

export const SCIENTIFIC_THEMES: Record<string, ScientificTheme> = {
  clean: {
    id: 'clean',
    name: 'Classic Clean',
    description: '标准科研制图风格，柔和的靛蓝色调。',
    chartConfig: {
      backgroundColor: '#ffffff',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      strokeWidth: 2,
      colors: ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'],
      grid: {
        stroke: '#f1f5f9',
        strokeDasharray: '0',
        visible: true
      },
      axis: {
        stroke: '#e2e8f0',
        strokeWidth: 1.5,
        tickStroke: '#e2e8f0'
      },
      legendPosition: 'top',
      barRadius: 4
    },
    layout: {
      columns: 1,
      padding: 20,
      aspectRatio: 1.5
    }
  },
  nature: {
    id: 'nature',
    name: 'Nature Standard',
    description: 'Nature 杂志经典风格：低饱和度高对比配色，无衬线字体。',
    chartConfig: {
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      strokeWidth: 2,
      colors: ['#E64B35', '#4DBBD5', '#00A087', '#3C5488', '#F39B7F', '#8491B4'],
      grid: {
        stroke: 'transparent',
        strokeDasharray: '0',
        visible: false
      },
      axis: {
        stroke: '#000000',
        strokeWidth: 1.5,
        tickStroke: '#000000'
      },
      legendPosition: 'top',
      barRadius: 0
    },
    layout: {
      columns: 1,
      padding: 20,
      aspectRatio: 1.618
    }
  },
  jacs: {
    id: 'jacs',
    name: 'J. Am. Chem. Soc.',
    description: 'ACS 经典化学风格：衬线字体 (Times New Roman)，极细线型，紧凑布局。',
    chartConfig: {
      backgroundColor: '#ffffff',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: 14,
      fontWeight: 'normal',
      strokeWidth: 1.5,
      colors: ['#000000', '#D32F2F', '#1976D2', '#388E3C', '#FBC02D', '#7B1FA2'],
      grid: {
        stroke: 'transparent',
        strokeDasharray: '0',
        visible: false
      },
      axis: {
        stroke: '#000000',
        strokeWidth: 1.2,
        tickStroke: '#000000'
      },
      legendPosition: 'right',
      barRadius: 0
    },
    layout: {
      columns: 2,
      padding: 10,
      aspectRatio: 1.33
    }
  },
  cell: {
    id: 'cell',
    name: 'Cell Press',
    description: 'Cell 风格：色彩鲜明，强调机理与对比，适合图形化摘要。',
    chartConfig: {
      backgroundColor: '#ffffff',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: 13,
      fontWeight: 600,
      strokeWidth: 2.5,
      colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'],
      grid: {
        stroke: '#e5e7eb',
        strokeDasharray: '4 4',
        visible: true
      },
      axis: {
        stroke: '#374151',
        strokeWidth: 2,
        tickStroke: '#374151'
      },
      legendPosition: 'bottom',
      barRadius: 4
    },
    layout: {
      columns: 1,
      padding: 25,
      aspectRatio: 1.5
    }
  },
  science: {
    id: 'science',
    name: 'Science Magazine',
    description: 'Science 风格：深邃、稳重，适合物理与综合科学数据。',
    chartConfig: {
      backgroundColor: '#ffffff',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSize: 12,
      fontWeight: 500,
      strokeWidth: 2,
      colors: ['#BC3C29', '#0072B5', '#E18727', '#20854E', '#7876B1', '#6F99AD'],
      grid: {
        stroke: '#f1f5f9',
        strokeDasharray: '2 2',
        visible: true
      },
      axis: {
        stroke: '#1e293b',
        strokeWidth: 1.2,
        tickStroke: '#1e293b'
      },
      legendPosition: 'top',
      barRadius: 2
    },
    layout: {
      columns: 1,
      padding: 20,
      aspectRatio: 1.5
    }
  }
};