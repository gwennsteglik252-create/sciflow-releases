
import React from 'react';
import { PlanType } from '../../../types';

interface TaskSectionHeaderProps {
  activePlanType: PlanType;
  isArchived: boolean;
  unassignedCount: number;
  hasOverdueTasks: boolean; 
  hasAssignedTasks: boolean;
  isAiLoading?: boolean;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  onViewText?: () => void;
  onSmartAssign?: () => void;
  onReschedule?: () => void; 
  onClearAssign?: () => void;
  onAddTask: () => void;
  onExpandAssigned?: () => void;
}

export const TaskSectionHeader: React.FC<TaskSectionHeaderProps> = ({
  activePlanType, isArchived, unassignedCount, hasOverdueTasks, hasAssignedTasks, isAiLoading, isFocused,
  onToggleFocus, onViewText, onSmartAssign, onReschedule, onClearAssign, onExpandAssigned
}) => {
  return (
    <div className="flex justify-between items-center px-1">
      <div className="flex items-center gap-3">
        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-list-check text-indigo-400"></i> 研究路线与交付任务清单
        </h4>
        
        <div className="flex items-center gap-2 ml-3">
          {/* 聚焦按钮 - 靛蓝主题 */}
          <button 
            onClick={() => onToggleFocus?.()}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm border active:scale-95 ${
                isFocused 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-100' 
                : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white hover:border-indigo-500'
            }`}
            title={isFocused ? "恢复侧边栏" : "放大至全屏聚焦 (Hide Node Info)"}
          >
            <i className={`fa-solid ${isFocused ? 'fa-minimize' : 'fa-maximize'} text-base`}></i>
          </button>
          
          {/* 全景按钮 - 翡翠绿主题 */}
          <button 
            onClick={onExpandAssigned}
            className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 transition-all flex items-center justify-center shadow-sm active:scale-95"
            title="沉浸式全景排期工作站 (Enlarge Panorama)"
          >
            <i className="fa-solid fa-calendar-week text-base"></i>
          </button>

          {/* 查看文本按钮 - 紫罗兰主题 */}
          <button 
            onClick={onViewText}
            className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 text-violet-600 hover:bg-violet-600 hover:text-white hover:border-violet-500 transition-all flex items-center justify-center shadow-sm active:scale-95"
            title="查看任务清单文本"
          >
            <i className="fa-solid fa-file-lines text-base"></i>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {!isArchived && (
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
            {hasOverdueTasks ? (
               <button 
                onClick={onReschedule}
                disabled={isAiLoading}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 active:scale-95 bg-rose-600 text-white shadow-lg shadow-rose-100 animate-pulse border border-rose-400`}
              >
                {isAiLoading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-clock-rotate-left"></i>}
                AI 动态重排逾期
              </button>
            ) : hasAssignedTasks ? (
                <button 
                    onClick={onReschedule}
                    disabled={isAiLoading}
                    className="px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 active:scale-95 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg border border-indigo-400"
                >
                    {isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                    AI 重新优化排期
                </button>
            ) : (
              <button 
                onClick={onSmartAssign}
                disabled={isAiLoading || unassignedCount === 0}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 active:scale-95 ${unassignedCount > 0 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}
              >
                {isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt-lightning"></i>}
                一键智能指派
              </button>
            )}
            
            <button 
              onClick={onClearAssign}
              disabled={isAiLoading || !hasAssignedTasks}
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 active:scale-95 ${hasAssignedTasks ? 'bg-white text-rose-500 border border-rose-100 hover:bg-rose-50' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}
              title="清空当前计划中的排期"
            >
              <i className="fa-solid fa-rotate-left"></i>
              清空
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
