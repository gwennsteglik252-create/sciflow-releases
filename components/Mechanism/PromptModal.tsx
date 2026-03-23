import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../locales/useTranslation';

interface PromptModalProps {
    isOpen: boolean;
    title: string;
    defaultValue: string;
    onConfirm: (val: string) => void;
    onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({ isOpen, title, defaultValue, onConfirm, onCancel }) => {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 z-[9999] backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 animate-reveal">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">{title}</h3>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') onConfirm(value);
                        if (e.key === 'Escape') onCancel();
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-bold text-slate-700"
                />
                <div className="flex gap-3 mt-6 justify-end">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">{t('mechanism.prompt.cancel')}</button>
                    <button onClick={() => onConfirm(value)} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-colors">{t('mechanism.prompt.confirm')}</button>
                </div>
            </div>
        </div>
    );
};
