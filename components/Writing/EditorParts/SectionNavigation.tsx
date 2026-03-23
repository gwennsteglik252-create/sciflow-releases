
import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';

interface SectionNavigationProps {
  currentSections: { id: string; label: string; icon: string }[];
  activeSectionId: string;
  onSectionSwitch: (id: string) => void;
  onManageSections?: () => void;
}

export const SectionNavigation: React.FC<SectionNavigationProps> = ({
  currentSections,
  activeSectionId,
  onSectionSwitch,
  onManageSections
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-12 sm:w-16 bg-slate-50 border-r border-slate-100 flex flex-col items-center py-6 gap-4 shrink-0">
      {currentSections.map(section => (
        <button
          key={section.id}
          onClick={() => onSectionSwitch(section.id)}
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all relative group ${activeSectionId === section.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-indigo-500'}`}
        >
          <i className={`${section.icon} text-sm`}></i>
          <span className="absolute left-11 bg-slate-800 text-white text-[9px] px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 group-hover:translate-x-1 whitespace-nowrap z-50 font-bold uppercase pointer-events-none transition-all duration-200 delay-150 shadow-xl border border-white/10">
            {section.label}
          </span>
        </button>
      ))}

      <button
        onClick={onManageSections}
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all group relative shadow-sm border-2 border-dashed border-indigo-200 text-indigo-400 hover:bg-indigo-50 hover:border-indigo-400 mt-2"
        title={t('writing.sectionNav.manageSectionsTitle')}
      >
        <i className="fa-solid fa-list-check text-sm"></i>
        <span className="absolute left-11 bg-slate-800 text-white text-[9px] px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 group-hover:translate-x-1 whitespace-nowrap z-50 font-bold uppercase pointer-events-none transition-all shadow-xl border border-white/10">
          {t('writing.sectionNav.manageSections')}
        </span>
      </button>

      <div className="flex-1"></div>
    </div>
  );
};
