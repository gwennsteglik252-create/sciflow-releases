
import React from 'react';
import { ExperimentLog, ExperimentFile, LogStatus, MatrixDataset } from '../../types';
import { useLogModalLogic } from '../../hooks/useLogModalLogic';
import { LogHeader } from './LogModalSub/LogHeader';
import { LogBasicInfo } from './LogModalSub/LogBasicInfo';
import { LogMetrics } from './LogModalSub/LogMetrics';
import { LogParameters } from './LogParameters';
import { LogFiles } from './LogModalSub/LogFiles';
import { LogMatrixSync } from './LogModalSub/LogMatrixSync';
import { LogReagentConsumption } from './LogModalSub/LogReagentConsumption';
import { useProjectContext } from '../../context/ProjectContext';

interface LogModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (logData: {
    content: string;
    description: string;
    parameters: string;
    scientificData: Record<string, number>;
    files: ExperimentFile[];
    result: 'success' | 'neutral' | 'failure' | 'observation';
    status: LogStatus;
    consumedReagents?: any[];
    matrixEntry?: {
      targetMatrixId: string;
      sampleId: string;
      processParams: Record<string, string | number>;
      results: Record<string, string | number>
    };
    linkedPlanId?: string;
    linkedRunIdx?: number;
    planSnapshot?: Record<string, string>;
    samplePhoto?: ExperimentFile;
    sampleAppearanceInsight?: string;
    groupId?: string;
    groupLabel?: string;
  }) => void;
  editingLog: ExperimentLog | null;
  selectedLog?: ExperimentLog | null;
  projectMatrices?: MatrixDataset[];
  projectTargets?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
  // 所有实验记录，用于归纳已有实验组
  allLogs?: ExperimentLog[];
}

export const LogModal: React.FC<LogModalProps> = ({
  show, onClose, onSave, editingLog, selectedLog, projectMatrices = [], projectTargets = [], allLogs = []
}) => {
  const { inventory } = useProjectContext();
  const { state, refs, actions } = useLogModalLogic({ show, editingLog, projectMatrices, onSave, onClose });

  // 归纳当前节点中全部已有的实验组
  const existingGroups = React.useMemo(() => {
    const map = new Map<string, string>();
    allLogs.forEach(log => {
      if (log.groupId && log.groupLabel && !map.has(log.groupId)) {
        map.set(log.groupId, log.groupLabel);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [allLogs]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-2 lg:p-4">
      <div className="bg-white w-full max-w-7xl rounded-[3rem] p-6 lg:p-8 animate-reveal shadow-2xl relative border-4 border-white max-h-[95vh] flex flex-col overflow-hidden">

        <LogHeader
          onClose={onClose}
          templates={state.templates}
          onTriggerNaming={() => actions.setShowNamingModal(true)}
          onLoadTemplate={actions.handleLoadTemplate}
          onDeleteTemplate={actions.handleDeleteTemplate}
          isScanning={state.isScanning}
          onScanClick={() => refs.notebookInputRef.current?.click()}
          notebookInputRef={refs.notebookInputRef}
          handleNotebookScan={actions.handleNotebookScan}
        />

        {/* 日期时间编辑器与关联表征 */}
        <div className="shrink-0 flex items-center gap-3 mb-4 px-2 overflow-x-auto custom-scrollbar pb-2">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 shadow-inner shrink-0">
            <i className="fa-regular fa-calendar text-indigo-400 text-sm"></i>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">实验日期</span>
            <input
              type="datetime-local"
              className="bg-transparent text-[12px] font-bold text-slate-700 outline-none border-none cursor-pointer"
              value={(() => {
                // 将显示格式 "YYYY-M-D HH:mm:ss" 转换为 datetime-local 需要的 "YYYY-MM-DDTHH:mm"
                try {
                  const ts = state.logTimestamp;
                  if (!ts) return '';
                  const normalized = ts.replace(/\//g, '-');
                  const d = new Date(normalized);
                  if (isNaN(d.getTime())) return '';
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                } catch { return ''; }
              })()}
              onChange={(e) => {
                const val = e.target.value; // "YYYY-MM-DDTHH:mm"
                if (!val) return;
                const d = new Date(val);
                if (isNaN(d.getTime())) return;
                const pad = (n: number) => String(n).padStart(2, '0');
                const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                state.setLogTimestamp(formatted);
              }}
            />
          </div>

          {state.linkedAnalysis && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2 shadow-sm animate-reveal shrink-0">
              <i className="fa-solid fa-microscope text-rose-500 text-sm"></i>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest leading-none">关联深度证据</span>
                <span className="text-[11px] font-bold text-rose-700 truncate max-w-[150px]">{state.linkedAnalysis.title}</span>
              </div>
              <button
                onClick={() => state.setLinkedAnalysis(undefined)}
                className="w-5 h-5 rounded-full bg-white border border-rose-200 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center ml-1"
                title="解除关联"
              >
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-6 mb-4 pr-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-6">
              <LogBasicInfo
                logContent={state.logContent}
                setLogContent={state.setLogContent}
                logDescription={state.logDescription}
                setLogDescription={state.setLogDescription}
                isExtracting={state.isExtracting}
                handleAiExtract={actions.handleAiExtract}
                samplePhoto={state.samplePhoto}
                samplePhotoInputRef={refs.samplePhotoInputRef}
                handleSamplePhotoUpload={actions.handleSamplePhotoUpload}
                isAnalyzingSample={state.isAnalyzingSample}
                handleAnalyzeSampleAppearance={actions.handleAnalyzeSampleAppearance}
                sampleAppearanceInsight={state.sampleAppearanceInsight}
                groupId={state.groupId}
                groupLabel={state.groupLabel}
                onGroupChange={(gId, gLabel) => { state.setGroupId(gId); state.setGroupLabel(gLabel); }}
                existingGroups={existingGroups}
              />

              <LogReagentConsumption
                inventory={inventory}
                consumedReagents={state.consumedReagents}
                setConsumedReagents={state.setConsumedReagents}
              />
            </div>

            <div className="space-y-6">
              <LogMetrics
                scientificData={state.scientificData}
                removeMetric={actions.removeMetric}
                updateMetric={actions.updateMetric}
                renameMetric={actions.renameMetric} // 透传重命名逻辑
                newMetricKey={state.newMetricKey}
                setNewMetricKey={state.setNewMetricKey}
                newMetricVal={state.newMetricVal}
                setNewMetricVal={state.setNewMetricVal}
                newMetricUnit={state.newMetricUnit}
                setNewMetricUnit={state.setNewMetricUnit}
                addMetric={actions.addMetric}
                logResult={state.logResult}
                setLogResult={state.setLogResult}
                projectTargets={projectTargets}
              />
            </div>

            <div className="space-y-6">
              <LogParameters
                paramList={state.paramList}
                setParamList={state.setParamList}
                planSnapshot={editingLog?.planSnapshot}
              />

              <LogFiles
                fileDescInput={state.fileDescInput}
                setFileDescInput={state.setFileDescInput}
                triggerFileSelection={() => {
                  if ((window as any).electron && (window as any).electron.selectLocalFile) {
                    actions.handleFileUpload({ target: {}, preventDefault: () => { } } as any);
                  } else {
                    refs.logFileInputRef.current?.click();
                  }
                }}
                logFileInputRef={refs.logFileInputRef}
                handleFileUpload={actions.handleFileUpload}
                logFiles={state.logFiles}
                removeFile={actions.removeFile}
                handleLinkExistingLocalFile={actions.handleLinkExistingLocalFile}
                updateFile={actions.updateFile}
              />
            </div>
          </div>
        </div>

        <LogMatrixSync
          pushToMatrix={state.pushToMatrix}
          setPushToMatrix={state.setPushToMatrix}
          projectMatrices={projectMatrices}
          selectedMatrixId={state.selectedMatrixId}
          setSelectedMatrixId={state.setSelectedMatrixId}
          matrixSampleId={state.matrixSampleId}
          setMatrixSampleId={state.setMatrixSampleId}
          matrixNote={state.matrixNote}
          setMatrixNote={state.setMatrixNote}
          matrixProcessParams={state.matrixProcessParams}
          setMatrixProcessParams={state.setMatrixProcessParams}
          matrixResults={state.matrixResults}
          setMatrixResults={state.setMatrixResults}
        />

        <footer className="shrink-0 flex gap-4 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200">取消</button>
          <button onClick={actions.handleConfirmSave} disabled={!state.logContent.trim()} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-[0_10px_25px_rgba(99,102,241,0.4)] hover:bg-black transition-all">保存实验实录</button>
        </footer>

        {state.showNamingModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1500] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl border-4 border-white text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner"><i className="fa-solid fa-floppy-disk"></i></div>
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase italic">保存为模板</h3>
              <input autoFocus className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black outline-none mb-6 text-center focus:border-indigo-400" placeholder="例如: 标准电解池 LSV 扫描" value={state.tempTemplateName} onChange={e => actions.setTempTemplateName(e.target.value)} onKeyDown={e => e.key === 'Enter' && actions.handleSaveTemplate()} />
              <div className="flex gap-4"><button onClick={() => actions.setShowNamingModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button><button onClick={actions.handleSaveTemplate} disabled={!state.tempTemplateName.trim()} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl">确认保存</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
