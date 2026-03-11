
import React from 'react';

interface EducationBadgeProps {
    level?: string;
    className?: string;
    showLabel?: boolean;
}

const EducationBadge: React.FC<EducationBadgeProps> = ({ level, className = "", showLabel = true }) => {
    let color = "bg-slate-500";
    let icon = "fa-graduation-cap";
    let text = level || "本科";
    let shadow = "shadow-slate-200";

    if (level === '博士后') {
        color = "bg-gradient-to-br from-purple-600 to-indigo-700";
        icon = "fa-crown";
        shadow = "shadow-purple-500/40";
    } else if (level === '博士') {
        color = "bg-gradient-to-br from-amber-500 to-orange-600";
        icon = "fa-microscope";
        shadow = "shadow-amber-500/40";
    } else if (level === '硕士') {
        color = "bg-gradient-to-br from-emerald-500 to-teal-700";
        icon = "fa-book-open";
        shadow = "shadow-emerald-500/40";
    } else if (level === '本科') {
        color = "bg-gradient-to-br from-blue-500 to-indigo-600";
        icon = "fa-user-graduate";
        shadow = "shadow-blue-500/40";
    }

    return (
        <span className={`${color} ${shadow} text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/20 shadow-lg ${className}`}>
            <i className={`fa-solid ${icon} text-[8px]`}></i>
            {showLabel && <span>{text}</span>}
        </span>
    );
};

export default EducationBadge;
