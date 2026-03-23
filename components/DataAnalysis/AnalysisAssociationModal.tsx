
import React, { useState, useMemo } from 'react';
import { ResearchProject, ExperimentLog, ExperimentFile, Milestone } from '../../types';
import * as htmlToImage from 'html-to-image';
import { flattenMilestonesTree, getAutoSelections } from '../Characterization/AnalysisSyncModal';

interface AnalysisAssociationModalProps {
  show: boolean;
  onClose: () => void;
  projects: ResearchProject[];
  onConfirm: (updatedProject: ResearchProject) => void;
  chartTitle: string;
  chartType: string;
  mainColor: string;
  fontSize: number;
  chartContainerRef: React.RefObject<HTMLDivElement>;
}

const AnalysisAssociationModal: React.FC<AnalysisAssociationModalProps> = ({
  show, onClose, projects, onConfirm, chartTitle, chartType, mainColor, fontSize, chartContainerRef
}) => {
  const auto = useMemo(() => getAutoSelections(projects), [projects]);
  const [targetProjectId, setTargetProjectId] = useState(auto.projectId);
  const [targetMilestoneId, setTargetMilestoneId] = useState(auto.milestoneId);
  const [targetLogId, setTargetLogId] = useState(auto.logId || 'NEW_LOG');
  const [chartDescription, setChartDescription] = useState('');

  const selectedProjectForAssociation = useMemo(() => projects.find(p => p.id === targetProjectId), [projects, targetProjectId]);
  const selectedMilestoneForAssociation = useMemo(() => selectedProjectForAssociation?.milestones.find(m => m.id === targetMilestoneId), [selectedProjectForAssociation, targetMilestoneId]);

  const handleAssociate = async () => {
    if (!targetProjectId || !targetMilestoneId || !selectedProjectForAssociation) return alert("请选择目标项目与里程碑。");

    let dataUrl = "";
    if (chartContainerRef.current) {
      try {
        dataUrl = await htmlToImage.toPng(chartContainerRef.current, { backgroundColor: '#ffffff', skipFonts: true });
      } catch (e) {
        console.error("Failed to capture chart for association", e);
      }
    }

    const newFile: ExperimentFile = {
      name: `${chartTitle}.png`,
      url: dataUrl || "#",
      description: "分析实验室生成的视觉化图表成果"
    };

    let updatedMilestones: Milestone[];

    if (targetLogId === 'NEW_LOG') {
      const newLog: ExperimentLog = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        content: `[图表成果同步] ${chartTitle}`,
        description: chartDescription || "同步了实验室生成的图表模型分析结果。",
        parameters: `类型: ${chartType}, 配色: ${mainColor}, 字体: ${fontSize}px`,
        status: 'Pending',
        result: 'neutral',
        files: [newFile]
      };
      updatedMilestones = selectedProjectForAssociation.milestones.map(m =>
        m.id === targetMilestoneId ? { ...m, logs: [newLog, ...m.logs] } : m
      );
    } else {
      updatedMilestones = selectedProjectForAssociation.milestones.map(m => {
        if (m.id === targetMilestoneId) {
          const updatedLogs = m.logs.map(l => {
            if (l.id === targetLogId) {
              return {
                ...l,
                description: l.description ? `${l.description}\n\n[关联分析] ${chartDescription}` : chartDescription,
                files: [...(l.files || []), newFile]
              };
            }
            return l;
          });
          return { ...m, logs: updatedLogs };
        }
        return m;
      });
    }

    onConfirm({ ...selectedProjectForAssociation, milestones: updatedMilestones });
    onClose();
  };

  if (!show) return null;

  return (
    <div className="lab-modal-overlay fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="lab-modal-content bg-white w-full max-w-lg rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white">
        <button onClick={onClose} className="lab-modal-close-btn absolute top-8 right-8 text-slate-400 hover:text-rose-500 transition-all active:scale-90"><i className="fa-solid fa-times text-2xl"></i></button>
        <h3 className="lab-modal-title text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic border-l-4 border-indigo-600 pl-4">关联图表至研究记录</h3>
        <div className="lab-modal-body space-y-6">
          <div>
            <label className="lab-label text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">选择目标课题</label>
            <select className="lab-select w-full bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold outline-none shadow-inner cursor-pointer appearance-none" value={targetProjectId} onChange={e => { setTargetProjectId(e.target.value); const a = getAutoSelections(projects, e.target.value); setTargetMilestoneId(a.milestoneId); setTargetLogId(a.logId || 'NEW_LOG'); }}>
              <option value="">点击选择关联课题...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          {targetProjectId && (
            <div>
              <label className="lab-label text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">选择关联实验节点</label>
              <select className="lab-select w-full bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold outline-none shadow-inner cursor-pointer appearance-none" value={targetMilestoneId} onChange={e => { setTargetMilestoneId(e.target.value); const ms = selectedProjectForAssociation?.milestones.find(m => m.id === e.target.value); setTargetLogId(ms?.logs?.[0]?.id || 'NEW_LOG'); }}>
                <option value="">点击选择里程碑节点...</option>
                {flattenMilestonesTree(selectedProjectForAssociation?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
              </select>
            </div>
          )}
          {targetMilestoneId && (
            <div>
              <label className="lab-label text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">关联至具体记录</label>
              <select className="lab-select w-full bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold outline-none shadow-inner cursor-pointer appearance-none" value={targetLogId} onChange={e => setTargetLogId(e.target.value)}>
                <option value="NEW_LOG">+ 在此增加该节点下的具体实验记录</option>
                {selectedMilestoneForAssociation?.logs.map(l => (
                  <option key={l.id} value={l.id}>{l.timestamp.split(' ')[0]} - {l.content.substring(0, 30)}...</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="lab-label text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">图表学术描述与分析建议</label>
            <textarea className="lab-textarea w-full bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-bold outline-none h-32 shadow-inner resize-none focus:ring-4 focus:ring-indigo-100 transition-all leading-relaxed" placeholder="在此输入对此图表的详细学术描述..." value={chartDescription} onChange={e => setChartDescription(e.target.value)} />
          </div>
          <div className="lab-modal-actions flex gap-4 pt-4">
            <button onClick={onClose} className="lab-btn flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
            <button onClick={handleAssociate} disabled={!targetMilestoneId} className="lab-btn flex-[2] py-5 bg-indigo-600 text-white rounded-xl lg:rounded-2xl text-[11px] font-black uppercase shadow-2xl active:scale-95 disabled:opacity-30">确认关联并同步</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisAssociationModal;
