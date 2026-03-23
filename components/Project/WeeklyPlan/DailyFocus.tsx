
import React, { useLayoutEffect, useRef } from 'react';

interface DailyFocusProps {
  dayLog?: string;
  dayIdx: number;
  isArchived: boolean;
  onUpdateDailyLog?: (dayIndex: number, content: string) => void;
}

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, placeholder, disabled, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = '12px'; 
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = `${Math.max(12, scrollHeight)}px`;
      }
    };

    adjustHeight();
    const timer = setTimeout(adjustHeight, 50);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      className={className}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      spellCheck={false}
      style={{ 
        minHeight: '12px',
        lineHeight: '1.1',
        padding: '0px',
        margin: '0px',
        border: 'none',
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        background: 'transparent',
        outline: 'none',
        resize: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all'
      }}
    />
  );
};

export const DailyFocus: React.FC<DailyFocusProps> = ({
  dayLog, dayIdx, isArchived, onUpdateDailyLog
}) => {
  if (isArchived && !dayLog) return null;

  return (
    <div className="mb-0 px-1.5 py-0.5 bg-indigo-50/20 rounded-md border border-indigo-100/30 group/focus relative transition-all hover:border-indigo-200/50 shadow-none overflow-hidden">
      <div className="flex items-center gap-1 mb-0.5 opacity-50 select-none pointer-events-none">
        <i className="fa-solid fa-bullseye text-indigo-400 text-[7px]"></i>
        <span className="font-black text-indigo-500 uppercase text-[8px] tracking-tighter leading-none">Focus</span>
      </div>
      <AutoResizeTextarea
        className="w-full bg-transparent outline-none resize-none overflow-hidden text-[8.5px] font-black text-slate-600 italic p-0 m-0 focus:text-slate-900 border-none"
        value={dayLog || ''}
        onChange={(e) => onUpdateDailyLog?.(dayIdx, e.target.value)}
        placeholder="..."
        disabled={isArchived}
      />
    </div>
  );
};
