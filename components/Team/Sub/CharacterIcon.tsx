
import React from 'react';
import { ScientificTemperament } from '../../../types';

interface CharacterIconProps {
    type?: ScientificTemperament;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

const CharacterIcon: React.FC<CharacterIconProps> = ({ type, size = "md", className = "" }) => {
    const s = size === "sm" ? 32 : size === "md" ? 48 : size === "lg" ? 64 : 120;
    
    switch(type) {
        case 'Explorer':
            return (
                <svg width={s} height={s} viewBox="0 0 100 100" className={`drop-shadow-2xl animate-pulse ${className}`}>
                    <defs>
                        <linearGradient id="gradExplorer" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="48" fill="url(#gradExplorer)" fillOpacity="0.1" stroke="url(#gradExplorer)" strokeWidth="0.5" />
                    <path d="M50 5 L60 40 L95 50 L60 60 L50 95 L40 60 L5 50 L40 40 Z" fill="url(#gradExplorer)" />
                    <path d="M50 20 L50 80 M20 50 L80 50" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                    <circle cx="50" cy="50" r="12" fill="white" fillOpacity="0.2" />
                    <path d="M45 45 L55 55 M55 45 L45 55" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
            );
        case 'Optimizer':
            return (
                <svg width={s} height={s} viewBox="0 0 100 100" className={`drop-shadow-2xl ${className}`}>
                    <defs>
                        <linearGradient id="gradOptimizer" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                    </defs>
                    <g className="animate-[spin_12s_linear_infinite]" style={{ transformOrigin: '50% 50%' }}>
                        <path d="M50 15 L55 5 L65 5 L70 15 L85 20 L95 10 L105 20 L95 35 L100 50 L110 55 L110 65 L100 70 L105 85 L95 95 L85 85 L70 90 L65 105 L55 105 L50 95 L35 100 L25 110 L15 100 L25 85 L15 70 L5 65 L5 55 L15 50 L10 35 L20 25 L35 30 L40 15 Z" fill="url(#gradOptimizer)" opacity="0.15" transform="scale(0.85) translate(8,8)" />
                    </g>
                    <rect x="30" y="30" width="40" height="40" rx="10" fill="url(#gradOptimizer)" />
                    <path d="M35 50 H65 M50 35 V65" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="4" fill="white" />
                </svg>
            );
        case 'Skeptic':
            return (
                <svg width={s} height={s} viewBox="0 0 100 100" className={`drop-shadow-2xl ${className}`}>
                    <defs>
                        <linearGradient id="gradSkeptic" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f43f5e" />
                            <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                    </defs>
                    <path d="M50 5 L92 25 V55 C92 75 72 92 50 95 C28 92 8 75 8 55 V25 Z" fill="url(#gradSkeptic)" opacity="0.1" />
                    <path d="M50 15 L82 30 V55 C82 70 68 85 50 88 C32 85 18 70 18 55 V30 Z" fill="url(#gradSkeptic)" />
                    <circle cx="50" cy="45" r="15" fill="white" fillOpacity="0.2" />
                    <circle cx="50" cy="45" r="6" fill="white" />
                    <rect x="47" y="62" width="6" height="15" rx="3" fill="white" />
                </svg>
            );
        default:
            return <div className="bg-slate-200 rounded-full" style={{ width: s, height: s }}></div>;
    }
};

export default CharacterIcon;
