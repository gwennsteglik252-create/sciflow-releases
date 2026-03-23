import React from 'react';

interface AnnotationLabelProps {
  cx: number;
  cy: number;
  text: string;
  color?: string;
  onRemove: () => void;
}

export const AnnotationLabel: React.FC<AnnotationLabelProps> = ({ cx, cy, text, color, onRemove }) => {
    return (
        <g onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
            <path 
                d={`M ${cx} ${cy} L ${cx - 20} ${cy - 20}`} 
                stroke={color || "#f43f5e"} 
                strokeWidth="2" 
                fill="none" 
            />
            <rect x={cx - 100} y={cy - 45} width="110" height="22" rx="6" fill="rgba(244, 63, 94, 0.9)" stroke="white" strokeWidth="1" />
            <text x={cx - 45} y={cy - 30} fill="white" textAnchor="middle" fontSize="10" fontWeight="black">{text}</text>
        </g>
    );
};