
import React from 'react';
import { MilestoneStatus } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface EditNodeModalProps {
  show: boolean;
  onClose: () => void;
  data: { title: string; hypothesis: string; date: string; status: MilestoneStatus };
  setData: (data: any) => void;
  onSave: () => void;
}

export const EditNodeModal: React.FC<EditNodeModalProps> = ({ show, onClose, data, setData, onSave }) => {
  if (!show) return null;
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white">
        <h3 className="text-xl font-black text-slate-800 mb-8 uppercase italic border-l-8 border-indigo-600 pl-6">{t('nodeModals.editNode')}</h3>
        <div className="space-y-4">
          <input 
            className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-indigo-100" 
            placeholder={t('nodeModals.titlePlaceholder')} 
            value={data.title} 
            onChange={e => setData({...data, title: e.target.value})} 
          />
          <textarea 
            className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold outline-none h-24 border border-transparent focus:border-indigo-100 resize-none" 
            placeholder={t('nodeModals.hypothesisPlaceholder')} 
            value={data.hypothesis} 
            onChange={e => setData({...data, hypothesis: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-3">
            <select 
              className="w-full bg-slate-50 rounded-2xl p-3 text-xs font-bold outline-none cursor-pointer" 
              value={data.status} 
              onChange={e => setData({...data, status: e.target.value as any})}
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <input 
              type="date" 
              className="w-full bg-slate-50 rounded-2xl p-3 text-xs font-bold outline-none" 
              value={data.date} 
              onChange={e => setData({...data, date: e.target.value})} 
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">{t('nodeModals.cancel')}</button>
            <button onClick={onSave} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl">{t('nodeModals.saveChanges')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
