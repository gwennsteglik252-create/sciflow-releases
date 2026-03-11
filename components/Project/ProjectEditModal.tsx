import React, { useRef, useState } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { parseProjectProposal } from '../../services/gemini/experiment';
import { Literature, UserProfile } from '../../types';

interface ProjectEditModalProps {
  show: boolean;
  onClose: () => void;
  data: {
    id: string;
    title: string;
    description: string;
    startDate?: string;
    deadline: string;
    targetPerformance: string;
    targetMetrics: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
    proposalDoc?: any;
    proposalText?: string;
    requiredMaterials?: { name: string; estimatedAmount?: string }[];
    personnel?: any[];
    milestones?: any[];
    _pendingMasterRoute?: any;
  };
  setData: (data: any) => void;
  onSave: () => void;
}

const ProjectEditModal: React.FC<ProjectEditModalProps> = ({ show, onClose, data, setData, onSave }) => {
  const { showToast, setAiStatus, setResources, teamMembers, setTeamMembers, userProfile } = useProjectContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [pendingBib, setPendingBib] = useState<any[]>([]);
  const [pendingMasterRoute, setPendingMasterRoute] = useState<any>(data._pendingMasterRoute || null);

  if (!show) return null;

  const handleAddMetric = () => {
    setData({
      ...data,
      targetMetrics: [...(data.targetMetrics || []), { label: '', value: '', unit: '', weight: 1, isHigherBetter: true }]
    });
  };

  const handleRemoveMetric = (index: number) => {
    const next = [...(data.targetMetrics || [])];
    next.splice(index, 1);
    setData({ ...data, targetMetrics: next });
  };

  const handleUpdateMetric = (index: number, field: string, val: any) => {
    const next = [...(data.targetMetrics || [])];
    next[index] = { ...next[index], [field]: val };
    setData({ ...data, targetMetrics: next });
  };

  const handleProposalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    const isWord = file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');

    if (isWord) {
      showToast({ message: "Gemini 目前不支持直接解析 Word 文档，请另存为 PDF 后上传。", type: 'info' });
      return;
    }

    if (!isPdf && !isTxt) {
      showToast({ message: "仅支持 PDF 或 TXT 格式的项目计划书", type: 'info' });
      return;
    }

    setIsParsing(true);
    showToast({ message: "正在数字化解析项目计划书...", type: 'info' });
    setAiStatus?.("🧠 正在提取项目全局背景、KPI 及 团队人员名单...");

    try {
      const reader = new FileReader();

      if (isPdf) {
        reader.readAsDataURL(file);
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const result = await parseProjectProposal(base64, file.type, false);
          handleParsingResult(result, file);
        };
      } else {
        reader.readAsText(file);
        reader.onload = async () => {
          const text = reader.result as string;
          const result = await parseProjectProposal(text, 'text/plain', true);
          handleParsingResult(result, file);
        };
      }
    } catch (err) {
      console.error("Proposal parsing error:", err);
      showToast({ message: "计划书解析失败", type: 'error' });
      setIsParsing(false);
      setAiStatus?.(null);
    }
  };

  const handleParsingResult = (result: any, file: File) => {
    if (result) {
      if (result.bibliography && result.bibliography.length > 0) {
        setPendingBib(result.bibliography);
      }

      if (window.confirm("AI 已成功解析计划书。是否根据计划书内容自动填充课题信息、指标、参考文献及团队成员？")) {

        if (result.personnel && result.personnel.length > 0) {
          const newProfiles: UserProfile[] = [];
          result.personnel.forEach((p: any) => {
            const exists = teamMembers.find(m => m.name === p.name);
            if (!exists) {
              newProfiles.push({
                name: p.name,
                role: p.role || '助理研究员',
                id: `SF-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
                department: '研发部',
                projectGroup: '新课题组',
                securityLevel: '内部',
                institution: userProfile.institution,
                researchArea: p.researchArea || '',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`,
                expertise: p.expertise || [],
                expertiseMetrics: [
                  { subject: '合成制备', A: 50, fullMark: 100 },
                  { subject: '性能表征', A: 50, fullMark: 100 },
                  { subject: '理论计算', A: 50, fullMark: 100 },
                  { subject: '工程放大', A: 50, fullMark: 100 },
                  { subject: '数据挖掘', A: 50, fullMark: 100 },
                ],
                activeProjectsCount: 1,
                workload: 10
              });
            }
          });
          if (newProfiles.length > 0) {
            setTeamMembers(prev => [...newProfiles, ...prev]);
          }
        }

        setData({
          ...data,
          title: result.suggestedTitle || data.title,
          description: result.suggestedDescription || data.description,
          targetMetrics: result.targetMetrics || data.targetMetrics,
          requiredMaterials: result.requiredMaterials || data.requiredMaterials,
          proposalDoc: {
            name: file.name,
            url: URL.createObjectURL(file),
            timestamp: new Date().toLocaleString()
          },
          proposalText: `标题: ${result.suggestedTitle}\n描述: ${result.suggestedDescription}\n指标: ${JSON.stringify(result.targetMetrics)}`,
          milestones: result.milestones ? result.milestones.map((m: any, idx: number) => ({
            id: `ms_extracted_${Date.now()}_${idx}`,
            title: m.title,
            hypothesis: m.hypothesis || '',
            status: 'pending',
            dueDate: m.dueDate || new Date(Date.now() + (idx + 1) * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            logs: [],
            chatHistory: []
          })) : data.milestones,
          _pendingMasterRoute: result.masterRoute,
          _pendingBibliography: result.bibliography
        });
        setPendingMasterRoute(result.masterRoute);
        showToast({ message: "已基于计划书完成全栈数据对标", type: 'success' });
      }
    }
    setIsParsing(false);
    setAiStatus?.(null);
  };

  const ingestBibliography = () => {
    if (!pendingBib || pendingBib.length === 0) return;

    const newResources: Literature[] = pendingBib.map(b => ({
      id: `bib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      projectId: data.id,
      type: '文献',
      category: b.category || '核心理论',
      title: b.title,
      authors: b.authors || ['自动提取'],
      year: b.year || new Date().getFullYear(),
      source: b.source,
      url: b.url,
      abstract: b.abstract || '由项目计划书自动导入。',
      tags: ['源自计划书', '自动同步']
    }));

    setResources((prev: Literature[]) => [...newResources, ...prev]);
    setPendingBib([]);
    showToast({ message: `成功导入 ${newResources.length} 篇参考文献`, type: 'success' });
  };

  const ingestMasterRoute = () => {
    if (!pendingMasterRoute) return;

    const newProposal: any = {
      id: `route_${Date.now()}`,
      literatureId: 'PROPOSAL',
      literatureTitle: '项目计划书核心工艺',
      timestamp: new Date().toLocaleString(),
      title: pendingMasterRoute.title || '计划书提取主工艺路线',
      status: 'main',
      processChanges: '从项目计划书中自动提取的工艺基准路径。',
      newFlowchart: pendingMasterRoute.steps || [],
      controlParameters: [],
      optimizedParameters: [],
      scientificHypothesis: pendingMasterRoute.hypothesis || '基于项目计划书的科学假设。'
    };

    setData({
      ...data,
      proposals: [newProposal, ...(data as any).proposals || []]
    });
    setPendingMasterRoute(null);
    showToast({ message: "主工艺路线已同步至演进拓扑", type: 'success' });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[95vh]">

        <header className="flex justify-between items-center mb-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
              <i className="fa-solid fa-folder-open text-xl"></i>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">课题核心管理</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Project Configuration
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-90"><i className="fa-solid fa-times"></i></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-3 space-y-8 pb-4">

          {/* Section: Master Plan Upload */}
          <section className="bg-indigo-50/50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-200 group hover:bg-indigo-50 hover:border-indigo-400 transition-all">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><i className="fa-solid fa-file-contract"></i></div>
                <div>
                  <h4 className="text-[11px] font-black text-indigo-800 uppercase tracking-widest leading-none">项目计划书 (MASTER PLAN)</h4>
                  <p className="text-[7px] text-indigo-400 font-bold uppercase mt-1">AI-Powered Extraction & Sync</p>
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-file-upload"></i> {data.proposalDoc ? '更新计划书' : '上传 PDF/DOCX'}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleProposalUpload} />
            </div>

            {data.proposalDoc ? (
              <div className="flex flex-col gap-4 animate-reveal">
                <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl shrink-0 border border-indigo-100 shadow-inner">
                    <i className="fa-solid fa-check-double"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-slate-800 truncate">{data.proposalDoc.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">上传时间: {data.proposalDoc.timestamp}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={data.proposalDoc.url} target="_blank" className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all"><i className="fa-solid fa-eye text-xs"></i></a>
                    <button onClick={() => { setData({ ...data, proposalDoc: undefined, proposalText: undefined, requiredMaterials: [] }); setPendingBib([]); }} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-xs"></i></button>
                  </div>
                </div>

                {pendingBib.length > 0 && (
                  <div className="bg-slate-900 p-5 rounded-[2rem] shadow-xl animate-reveal border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">探测到文献资源 ({pendingBib.length})</p>
                        <p className="text-[7px] text-slate-500 uppercase mt-0.5">Reference Data Ready for Ingestion</p>
                      </div>
                      <button onClick={ingestBibliography} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 transition-all shadow-lg border border-indigo-400">一键同步至情报档案</button>
                    </div>
                    <div className="max-h-24 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                      {pendingBib.map((b, i) => (
                        <div key={i} className="text-[9px] text-slate-400 border-b border-white/5 pb-1.5 last:border-0 truncate flex gap-2">
                          <span className="font-black text-indigo-500">[{i + 1}]</span> {b.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="py-12 border-2 border-dashed border-indigo-100 rounded-3xl flex flex-col items-center justify-center text-indigo-300 hover:bg-indigo-100/10 hover:border-indigo-400 transition-all cursor-pointer group"
              >
                <i className="fa-solid fa-cloud-arrow-up text-4xl mb-3 group-hover:scale-110 transition-transform"></i>
                <p className="text-[10px] font-black uppercase tracking-[0.2rem]">上传项目计划书</p>
                <p className="text-[8px] mt-1 font-bold">AI 将自动以此为核心生成后续所有任务、节点与物料库</p>
              </div>
            )}

            {/* AI Extracted Route Preview */}
            {pendingMasterRoute && (
              <div className="mt-6 bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl animate-reveal border border-white/10">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
                      <i className="fa-solid fa-route"></i>
                    </div>
                    <div>
                      <h5 className="text-[11px] font-black text-white uppercase tracking-widest">主工艺路线预览 (MASTER ROUTE)</h5>
                      <p className="text-[7px] text-slate-500 font-bold uppercase mt-1">Found in Proposal Structure</p>
                    </div>
                  </div>
                  <button
                    onClick={ingestMasterRoute}
                    className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/40 border border-violet-400/30 flex items-center gap-2"
                  >
                    <i className="fa-solid fa-link"></i> 同步至工艺拓扑
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase mb-2 tracking-tighter">核心科学假设</p>
                    <p className="text-xs text-slate-300 italic leading-relaxed">“ {pendingMasterRoute.hypothesis} ”</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {pendingMasterRoute.steps?.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5 group hover:bg-white/10 transition-all">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-[10px] font-black text-slate-500 flex items-center justify-center border border-white/5">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-slate-200">{s.step}</p>
                          <p className="text-[9px] text-slate-400 truncate">{s.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">课题正式标题 (TITLE)</label>
                <input
                  className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-black text-slate-800 outline-none shadow-inner border-2 border-transparent focus:border-indigo-300 transition-all italic"
                  value={data.title}
                  onChange={e => setData({ ...data, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">项目周期 (CYCLE)</label>
                <div className="flex gap-2 items-center bg-slate-50 rounded-2xl px-4 py-1.5 shadow-inner border border-slate-100">
                  <input type="date" className="flex-1 bg-transparent py-2.5 text-xs font-bold text-slate-700 outline-none" value={data.startDate || ''} onChange={e => setData({ ...data, startDate: e.target.value })} />
                  <span className="text-slate-300 text-xs">—</span>
                  <input type="date" className="flex-1 bg-transparent py-2.5 text-xs font-bold text-slate-700 outline-none" value={data.deadline} onChange={e => setData({ ...data, deadline: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">课题全局目标描述 (OBJECTIVES)</label>
              <textarea
                className="w-full bg-slate-50 rounded-2xl p-4 text-xs font-medium text-slate-700 outline-none shadow-inner h-[134px] resize-none leading-relaxed border-2 border-transparent focus:border-indigo-300 transition-all custom-scrollbar"
                placeholder="描述定性研究目标、团队发展目标或产业化意图..."
                value={data.description}
                onChange={e => setData({ ...data, description: e.target.value })}
              />
            </div>
          </div>

          {/* Section: Performance Matrix */}
          <div>
            <div className="flex justify-between items-center mb-4 px-1">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic">
                <i className="fa-solid fa-chart-line text-rose-500"></i> 量化指标矩阵 (PERFORMANCE MATRIX)
              </h4>
              <button onClick={handleAddMetric} className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">+ 新增考核指标</button>
            </div>

            <div className="rounded-[2.5rem] p-6 bg-slate-50/50 border border-slate-100 shadow-inner space-y-4">
              <div className="grid grid-cols-12 gap-3 px-3 text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                <div className="col-span-5">指标名称 (Metric)</div>
                <div className="col-span-2 text-center">目标值</div>
                <div className="col-span-1 text-center">单位</div>
                <div className="col-span-2 text-center">权重 (0-1)</div>
                <div className="col-span-2 text-right">极值策略</div>
              </div>

              <div className="space-y-2">
                {data.targetMetrics?.map((metric, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center group animate-reveal bg-white p-2 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
                    <div className="col-span-5">
                      <input
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-all"
                        placeholder="指标名"
                        value={metric.label}
                        onChange={e => handleUpdateMetric(idx, 'label', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-[11px] font-black text-rose-600 font-mono text-center outline-none focus:bg-white"
                        placeholder="数值"
                        value={metric.value}
                        onChange={e => handleUpdateMetric(idx, 'value', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        className="w-full bg-transparent text-[10px] font-bold text-slate-400 text-center outline-none"
                        placeholder="unit"
                        value={metric.unit || ''}
                        onChange={e => handleUpdateMetric(idx, 'unit', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        className="w-full bg-slate-50 rounded-xl px-3 py-2.5 text-[10px] font-black text-amber-600 text-center outline-none focus:bg-white"
                        value={metric.weight || ''}
                        onChange={e => handleUpdateMetric(idx, 'weight', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleUpdateMetric(idx, 'isHigherBetter', !metric.isHigherBetter)}
                        className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center transition-all ${metric.isHigherBetter ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}
                      >
                        <i className={`fa-solid ${metric.isHigherBetter ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-[11px]`}></i>
                        <span className="text-[6px] font-black uppercase mt-0.5">{metric.isHigherBetter ? 'Max' : 'Min'}</span>
                      </button>
                      <button onClick={() => handleRemoveMetric(idx)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm">
                        <i className="fa-solid fa-times text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {(!data.targetMetrics || data.targetMetrics.length === 0) && (
                  <div className="py-8 text-center text-slate-300 italic text-[10px] uppercase font-bold tracking-widest border-2 border-dashed border-slate-200 rounded-3xl">暂无量化考核指标</div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Extracted Materials */}
          {data.requiredMaterials && data.requiredMaterials.length > 0 && (
            <section className="animate-reveal">
              <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 italic">
                <i className="fa-solid fa-box-open text-amber-500"></i> 物资供应预设清单
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-inner">
                {data.requiredMaterials.map((m, i) => (
                  <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-1 hover:border-indigo-300 transition-colors">
                    <span className="text-[10px] font-black text-slate-800 truncate uppercase">{m.name}</span>
                    {m.estimatedAmount && <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tight">{m.estimatedAmount}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        <footer className="shrink-0 flex gap-4 pt-6 border-t border-slate-100 mt-2">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all active:scale-95">取消修改</button>
          <button
            onClick={onSave}
            className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-2xl shadow-indigo-100 hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-floppy-disk"></i> 保存课题变更
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ProjectEditModal;