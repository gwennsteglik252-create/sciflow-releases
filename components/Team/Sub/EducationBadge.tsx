import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';

interface EducationBadgeProps {
    level?: string;
    className?: string;
    showLabel?: boolean;
}

const EducationBadge: React.FC<EducationBadgeProps> = ({ level, className = "", showLabel = true }) => {
    const { t } = useTranslation();
    let color = "bg-slate-500";
    let icon = "fa-graduation-cap";
    let text = level || t('team.edit.form.edu.bachelor');
    let shadow = "shadow-slate-200";

    if (level === 'Postdoc' || level === '博士后') {
        color = "bg-gradient-to-br from-purple-600 to-indigo-700";
        icon = "fa-crown";
        shadow = "shadow-purple-500/40";
        text = t('team.edit.form.edu.postdoc');
    } else if (level === 'PhD' || level === '博士') {
        color = "bg-gradient-to-br from-amber-500 to-orange-600";
        icon = "fa-microscope";
        shadow = "shadow-amber-500/40";
        text = t('team.edit.form.edu.phd');
    } else if (level === 'Master' || level === '硕士') {
        color = "bg-gradient-to-br from-emerald-500 to-teal-700";
        icon = "fa-book-open";
        shadow = "shadow-emerald-500/40";
        text = t('team.edit.form.edu.master');
    } else if (level === 'Bachelor' || level === '本科') {
        color = "bg-gradient-to-br from-blue-500 to-indigo-600";
        icon = "fa-user-graduate";
        shadow = "shadow-blue-500/40";
        text = t('team.edit.form.edu.bachelor');
    }

    return (
        <span className={`${color} ${shadow} text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-white/20 shadow-lg ${className}`}>
            <i className={`fa-solid ${icon} text-[8px]`}></i>
            {showLabel && <span>{text}</span>}
        </span>
    );
};

export default EducationBadge;
