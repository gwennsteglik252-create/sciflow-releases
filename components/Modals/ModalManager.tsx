
import React, { useState, useRef } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { ResearchProject, TransformationProposal, UserProfile } from '../../types';
import SafeModal, { SafeModalConfig } from '../SafeModal';
import AccountModal from './AccountModal';
import SettingsModal from './SettingsModal';
import { parseProjectProposal } from '../../services/gemini/experiment';
import { CloudSyncState } from '../../hooks/useCloudSync';

interface ModalManagerProps {
  modals: {
    addProject: boolean;
    account: boolean;
    settings: boolean;
    confirm: SafeModalConfig | null;
  };
  closeModal: (key: string) => void;
  onOpenConfirm?: (config: SafeModalConfig) => void;
  cloudSync?: CloudSyncState;
}

const ModalManager: React.FC<ModalManagerProps> = ({ modals, closeModal, onOpenConfirm, cloudSync }) => {
  const { setProjects, userProfile, teamMembers, setTeamMembers, showToast, setAiStatus } = useProjectContext();
  const [newProject, setNewProject] = useState({
    title: '',
    desc: '',
    kpis: '',
    proposalDoc: undefined as any,
    proposalText: undefined as string | undefined,
    targetMetrics: [] as any[],
    requiredMaterials: [] as any[],
    personnel: [] as any[],
    _pendingMasterRoute: undefined as any
  });

  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProposalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    showToast({ message: "正在数字化解析项目计划书...", type: 'info' });
    setAiStatus?.("🧠 正在提取项目全局背景、KPI 及 团队人员信息...");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await parseProjectProposal(base64, file.type);

        if (result) {
          setNewProject({
            ...newProject,
            title: result.suggestedTitle || newProject.title,
            desc: result.suggestedDescription || newProject.desc,
            targetMetrics: result.targetMetrics || [],
            requiredMaterials: result.requiredMaterials || [],
            personnel: result.personnel || [],
            proposalDoc: {
              name: file.name,
              url: URL.createObjectURL(file),
              timestamp: new Date().toLocaleString()
            },
            proposalText: `标题: ${result.suggestedTitle}\n描述: ${result.suggestedDescription}\n指标: ${JSON.stringify(result.targetMetrics)}`,
            _pendingMasterRoute: result.masterRoute
          });
          showToast({ message: "计划书解析成功，已自动填充预设字段并识别出 " + (result.personnel?.length || 0) + " 名研究人员", type: 'success' });
        }
        setIsParsing(false);
        setAiStatus?.(null);
      };
    } catch (err) {
      console.error(err);
      showToast({ message: "计划书解析失败", type: 'error' });
      setIsParsing(false);
      setAiStatus?.(null);
    }
  };

  const handleCreateProject = () => {
    if (!newProject.title.trim()) return;

    // Process Personnel to Global Team Matrix
    const projectMemberNames = [userProfile.name];
    if (newProject.personnel && newProject.personnel.length > 0) {
      const newProfiles: UserProfile[] = [];
      newProject.personnel.forEach((p: any) => {
        projectMemberNames.push(p.name);
        const exists = teamMembers.find(m => m.name === p.name);
        if (!exists) {
          const newId = `SF-AUTO-${Math.floor(1000 + Math.random() * 9000)}`;
          newProfiles.push({
            name: p.name,
            role: p.role || '助理研究员',
            id: newId,
            department: '研发部 (由计划书导入)',
            projectGroup: '新课题组',
            securityLevel: '内部',
            institution: userProfile.institution,
            researchArea: p.researchArea || '',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`,
            expertise: p.expertise || [],
            activeProjectsCount: 1,
            workload: 20
          });
        }
      });
      if (newProfiles.length > 0) {
        setTeamMembers(prev => [...newProfiles, ...prev]);
        showToast({ message: `已将 ${newProfiles.length} 名新识别的人员录入团队矩阵`, type: 'success' });
      }
    }

    const extraProposals: TransformationProposal[] = [];
    if (newProject._pendingMasterRoute) {
      const mr = newProject._pendingMasterRoute;
      extraProposals.push({
        id: `master_${Date.now()}`,
        literatureId: 'MASTER_PLAN',
        literatureTitle: '项目计划书',
        timestamp: new Date().toLocaleString(),
        title: mr.title || '主工艺路线 (Master Plan)',
        status: 'main',
        processChanges: '由项目计划书自动生成的权威主干工艺路线。',
        newFlowchart: mr.steps || [],
        optimizedParameters: [],
        controlParameters: [],
        scientificHypothesis: mr.hypothesis || '基于计划书的工艺改良假设'
      });
    }

    const project: ResearchProject = {
      id: Date.now().toString(),
      title: newProject.title,
      category: '新课题',
      description: newProject.desc || '暂无详细描述。',
      status: 'Planning',
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      progress: 0,
      trl: 1,
      members: Array.from(new Set(projectMemberNames)),
      keywords: newProject.kpis.split(',').map(s => s.trim()).filter(Boolean),
      /* Fix: Added missing milestones property to satisfy strictly typed ResearchProject interface. */
      milestones: [],
      proposals: extraProposals,
      paperSections: [],
      citedLiteratureIds: [],
      proposalDoc: newProject.proposalDoc,
      proposalText: newProject.proposalText,
      targetMetrics: newProject.targetMetrics,
      requiredMaterials: newProject.requiredMaterials
    };

    setProjects(prev => [project, ...prev]);
    setNewProject({
      title: '', desc: '', kpis: '',
      proposalDoc: undefined, proposalText: undefined,
      targetMetrics: [], requiredMaterials: [], personnel: [], _pendingMasterRoute: undefined
    });
    closeModal('addProject');
  };

  return (
    <>
      {modals.addProject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
            <button onClick={() => closeModal('addProject')} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
            <h3 className="text-2xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic border-l-8 border-indigo-600 pl-6 flex items-center gap-3">
              创建新课题库
              {isParsing && <i className="fa-solid fa-spinner animate-spin text-indigo-500 text-sm"></i>}
            </h3>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
              {/* New Proposal Upload Section */}
              <section className="bg-indigo-50/50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest leading-none">上传项目计划书 (可选)</h4>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-black transition-all"
                  >
                    {newProject.proposalDoc ? '重新上传' : '点击选择文件'}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleProposalUpload} />
                </div>

                {newProject.proposalDoc ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm animate-reveal">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-lg shrink-0">
                        <i className="fa-solid fa-file-contract"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-slate-800 truncate">{newProject.proposalDoc.name}</p>
                        <p className="text-[7px] font-bold text-emerald-500 uppercase mt-0.5">AI 已解析指标、路线与团队</p>
                      </div>
                      <button onClick={() => setNewProject({ ...newProject, proposalDoc: undefined, proposalText: undefined, personnel: [], _pendingMasterRoute: undefined })} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                    </div>
                    {newProject.personnel.length > 0 && (
                      <div className="px-4 py-2 bg-white rounded-xl border border-indigo-100 flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">探测到成员</span>
                        <div className="flex -space-x-2">
                          {newProject.personnel.map((p: any, i: number) => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-indigo-600 text-white text-[6px] flex items-center justify-center font-black" title={`${p.name} (${p.role})`}>
                              {p.name[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="py-6 border-2 border-dashed border-indigo-100 rounded-2xl flex flex-col items-center justify-center text-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer group"
                  >
                    <i className="fa-solid fa-cloud-arrow-up text-2xl mb-2 group-hover:scale-110 transition-transform"></i>
                    <p className="text-[9px] font-black uppercase text-center">上传 PDF / Word 计划书<br /><span className="text-[7px] lowercase opacity-60">AI 将自动填充标题及详细描述</span></p>
                  </div>
                )}
              </section>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-2">课题名称</label>
                <input autoFocus className="w-full bg-slate-50 border-none rounded-2xl p-5 text-[14px] font-bold outline-none shadow-inner mb-4 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="输入研究课题全称..." value={newProject.title} onChange={e => setNewProject({ ...newProject, title: e.target.value })} />

                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-2">课题描述</label>
                <textarea className="w-full bg-slate-50 border-none rounded-2xl p-5 text-[14px] font-bold outline-none shadow-inner h-24 mb-4 resize-none focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="简述研究背景与目标..." value={newProject.desc} onChange={e => setNewProject({ ...newProject, desc: e.target.value })} />

                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-2">关键词 (以逗号分隔)</label>
                <input className="w-full bg-slate-50 border-none rounded-2xl p-5 text-[14px] font-bold outline-none shadow-inner focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="e.g. AEM, OER, NiFe-LDH" value={newProject.kpis} onChange={e => setNewProject({ ...newProject, kpis: e.target.value })} />
              </div>
            </div>

            <div className="flex gap-4 pt-8 shrink-0">
              <button onClick={() => closeModal('addProject')} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200">取消</button>
              <button onClick={handleCreateProject} disabled={!newProject.title.trim() || isParsing} className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-2xl disabled:opacity-30 transition-all hover:bg-black">确认开启课题库</button>
            </div>
          </div>
        </div>
      )}

      <AccountModal show={modals.account} onClose={() => closeModal('account')} cloudSync={cloudSync} />

      <SettingsModal
        show={modals.settings}
        onClose={() => closeModal('settings')}
        onOpenConfirm={onOpenConfirm || (() => { })}
      />

      <SafeModal config={modals.confirm} onClose={() => closeModal('confirm')} />
    </>
  );
};

export default ModalManager;
