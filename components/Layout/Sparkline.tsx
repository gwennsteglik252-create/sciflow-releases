import React from 'react';

interface SparklineProps {
  data: { progress: number }[];
  color?: string;
  id: string;
}

const Sparkline: React.FC<SparklineProps> = ({ data, color = "#6366f1", id }) => {
  if (!data || data.length < 2) return null;
  const height = 30;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - ((d.progress / 100) * height);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="100" cy={height - ((data[data.length-1].progress / 100) * height)} r="3" fill={color} vectorEffect="non-scaling-stroke"/>
    </svg>
  );
};

export default Sparkline;