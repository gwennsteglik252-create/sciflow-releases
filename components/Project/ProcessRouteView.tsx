
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ResearchProject, TransformationProposal, RouteCategory } from '../../types';
import { RouteNode } from './Route/RouteNode';
import { RouteComparisonModal } from './Route/RouteComparisonModal';
import { CategoryGroupHeader } from './Route/CategoryGroupHeader';
import { useProjectContext } from '../../context/ProjectContext';

// ═══ 预设分类定义 ═══
const DEFAULT_CATEGORIES: RouteCategory[] = [
  { id: 'cat_synthesis', name: '催化剂合成', color: 'indigo', icon: 'fa-flask-vial' },
  { id: 'cat_ldh', name: 'LDH基复合材料', color: 'emerald', icon: 'fa-layer-group' },
  { id: 'cat_sac', name: '单原子催化剂', color: 'amber', icon: 'fa-atom' },
  { id: 'cat_mof', name: 'MOF衍生策略', color: 'rose', icon: 'fa-cubes' },
  { id: 'cat_interface', name: '多相界面工程', color: 'sky', icon: 'fa-border-all' },
];

const CATEGORY_COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-600', emerald: 'bg-emerald-600', amber: 'bg-amber-600',
  rose: 'bg-rose-600', sky: 'bg-sky-600', violet: 'bg-violet-600', slate: 'bg-slate-500',
  pink: 'bg-pink-600', cyan: 'bg-cyan-600', orange: 'bg-orange-600',
};

const AVAILABLE_COLORS = [
  { id: 'indigo', label: '靛蓝' }, { id: 'emerald', label: '翠绿' },
  { id: 'amber', label: '琥珀' }, { id: 'rose', label: '玫红' },
  { id: 'sky', label: '天蓝' }, { id: 'violet', label: '紫罗兰' },
  { id: 'pink', label: '粉色' }, { id: 'cyan', label: '青色' },
  { id: 'orange', label: '橙色' },
];

const AVAILABLE_ICONS = [
  'fa-flask-vial', 'fa-layer-group', 'fa-atom', 'fa-cubes', 'fa-border-all',
  'fa-fire', 'fa-bolt', 'fa-gears', 'fa-droplet', 'fa-water',
  'fa-microscope', 'fa-vials', 'fa-temperature-half', 'fa-magnet', 'fa-diamond',
];

interface ProcessRouteViewProps {
  project: ResearchProject;
  expandedProposalIds: Set<string>;
  onToggleExpansion: (id: string) => void;
  onUpdateProject: (updated: ResearchProject) => void;
  onAdoptProposal: (proposal: TransformationProposal) => void;
  onLinkPlan: (proposal: TransformationProposal) => void;
  onAddSubProposal: (parentId: string) => void;
  onEditContent: (proposal: TransformationProposal) => void;
  onEditMeta: (id: string, title: string, status: any) => void;
  onDelete: (id: string) => void;
  Maps: (view: any, projectId?: string, subView?: string) => void;
  onAddToCollector?: (tasks: string[], sourceLabel: string) => void;
}

const ProcessRouteView: React.FC<ProcessRouteViewProps> = ({
  project, expandedProposalIds, onToggleExpansion, onUpdateProject,
  onAdoptProposal, onLinkPlan, onAddSubProposal: onAddSubProposalProp, onEditContent, onEditMeta, onDelete, Maps,
  onAddToCollector
}) => {
  const { updateFlowchartSession } = useProjectContext();
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [selectedCompareIds, setSelectedCompareIds] = useState<Set<string>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);

  // ═══ 分类管理状态 ═══
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    // 默认全部折叠
    const allIds = DEFAULT_CATEGORIES.map(c => c.id);
    allIds.push('__uncategorized__');
    return new Set(allIds);
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null); // null = 全部
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('violet');
  const [newCatIcon, setNewCatIcon] = useState('fa-flask-vial');

  // 获取当前项目的分类（合并预设 + 自定义）
  const categories = useMemo(() => {
    const custom = project.routeCategories || [];
    // 去重：自定义分类优先
    const customIds = new Set(custom.map(c => c.id));
    const defaults = DEFAULT_CATEGORIES.filter(d => !customIds.has(d.id));
    return [...defaults, ...custom];
  }, [project.routeCategories]);

  // 获取每个分类的路线数量
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const proposals = project.proposals || [];
    proposals.filter(p => !p.parentId).forEach(p => {
      const key = p.category || '__uncategorized__';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [project.proposals]);

  // ═══ 分类管理操作 ═══
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: RouteCategory = {
      id: `custom_${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
      icon: newCatIcon,
    };
    const updated = [...(project.routeCategories || []), newCat];
    onUpdateProject({ ...project, routeCategories: updated });
    // 新分类也默认折叠
    setCollapsedCategories(prev => { const n = new Set(prev); n.add(newCat.id); return n; });
    setNewCatName('');
    setNewCatColor('violet');
    setNewCatIcon('fa-flask-vial');
  };

  const handleRenameCategory = (catId: string, newName: string) => {
    // 如果是预设分类需要先添加到自定义中
    const defaultCat = DEFAULT_CATEGORIES.find(d => d.id === catId);
    const existingCustom = project.routeCategories || [];
    const already = existingCustom.find(c => c.id === catId);

    let updated: RouteCategory[];
    if (already) {
      updated = existingCustom.map(c => c.id === catId ? { ...c, name: newName } : c);
    } else if (defaultCat) {
      updated = [...existingCustom, { ...defaultCat, name: newName }];
    } else {
      return;
    }
    onUpdateProject({ ...project, routeCategories: updated });
  };

  const handleDeleteCategory = (catId: string) => {
    // 从自定义分类中删除
    const updated = (project.routeCategories || []).filter(c => c.id !== catId);
    // 将属于该分类的路线重置为未分类
    const updatedProposals = (project.proposals || []).map(p =>
      p.category === catId ? { ...p, category: undefined } : p
    );
    onUpdateProject({ ...project, routeCategories: updated, proposals: updatedProposals });
    if (activeFilter === catId) setActiveFilter(null);
  };

  const handleChangeCategory = useCallback((propId: string, categoryId: string | undefined) => {
    const updatedProposals = (project.proposals || []).map(p =>
      p.id === propId ? { ...p, category: categoryId } : p
    );
    onUpdateProject({ ...project, proposals: updatedProposals });
  }, [project, onUpdateProject]);

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const handleExpandAll = () => setCollapsedCategories(new Set());
  const handleCollapseAll = () => {
    const allIds = categories.map(c => c.id);
    allIds.push('__uncategorized__');
    setCollapsedCategories(new Set(allIds));
  };

  // ═══ 智能模板库 ═══
  const BUILT_IN_TEMPLATES = useMemo(() => [
    {
      id: 'tpl_hydrothermal', name: '水热合成法', icon: 'fa-water', category: '合成',
      hypothesis: '通过水热条件下的高温高压环境，促进纳米晶体的成核与定向生长。',
      processChanges: '以水/醇为溶剂体系，利用密封高压反应釜进行原位合成。',
      flowchart: [
        { step: '前驱体配制', action: '称取定量金属盐溶于去离子水中，加入结构导向剂搅拌均匀' },
        { step: 'pH 调控', action: '逐滴加入 NaOH/NH3·H2O 调节 pH 至目标值' },
        { step: '水热反应', action: '转移至聚四氟乙烯内衬反应釜，密封后放入烘箱反应' },
        { step: '冷却洗涤', action: '自然冷却至室温，抽滤并用去离子水和乙醇交替洗涤' },
        { step: '干燥', action: '60-80°C 真空干燥过夜' },
      ],
      controlParams: [{ key: '反应温度', value: '150-200°C', reason: '水热标准温度范围' }, { key: '反应时间', value: '12-24h', reason: '充分结晶' }, { key: 'pH', value: '9-11', reason: '调控形貌' }],
      optimizedParams: [{ key: '预期收率', value: '>85%', reason: '水热法典型收率' }]
    },
    {
      id: 'tpl_coprecip', name: '共沉淀法', icon: 'fa-droplet', category: '合成',
      hypothesis: '通过快速混合多种金属离子溶液与沉淀剂，实现均匀成核并控制化学组成。',
      processChanges: '将金属盐溶液同时滴加入碱性沉淀剂中，快速搅拌促进均匀沉淀。',
      flowchart: [
        { step: '配制溶液', action: '分别配制金属盐混合溶液和沉淀剂溶液' },
        { step: '共沉淀', action: '将金属盐溶液逐滴加入沉淀剂中，持续剧烈搅拌' },
        { step: '陈化', action: '室温陈化 2-4 小时，促进颗粒长大' },
        { step: '洗涤过滤', action: '抽滤，去离子水洗涤至中性' },
        { step: '干燥煅烧', action: '110°C 干燥后，高温煅烧得到目标氧化物' },
      ],
      controlParams: [{ key: 'pH', value: '8-10', reason: '沉淀完全' }, { key: '搅拌速率', value: '800-1200 rpm', reason: '保证均匀性' }],
      optimizedParams: [{ key: '预期粒径', value: '<50 nm', reason: '快速沉淀利于小粒径' }]
    },
    {
      id: 'tpl_solgel', name: '溶胶-凝胶法', icon: 'fa-flask', category: '合成',
      hypothesis: '利用金属醇盐或有机金属化合物的水解缩聚反应，形成三维网络凝胶结构。',
      processChanges: '控制水解和缩合速率，自下而上构筑均质纳米结构材料。',
      flowchart: [
        { step: '溶胶配制', action: '将金属醇盐溶于无水乙醇，缓慢加入催化量酸/碱' },
        { step: '水解', action: '缓慢滴加定量去离子水，搅拌促进水解反应' },
        { step: '凝胶化', action: '持续搅拌直至形成透明凝胶' },
        { step: '陈化', action: '密封陈化 24-48h' },
        { step: '干燥与煅烧', action: '超临界干燥或常压干燥后煅烧' },
      ],
      controlParams: [{ key: '水/醇盐比', value: '4:1', reason: '控制水解速率' }, { key: '煅烧温度', value: '500-800°C', reason: '去除有机物' }],
      optimizedParams: [{ key: '比表面积', value: '>100 m²/g', reason: '溶胶凝胶优势' }]
    },
    {
      id: 'tpl_electrodep', name: '电沉积法', icon: 'fa-bolt', category: '制备',
      hypothesis: '通过电化学沉积直接在导电基底上原位生长功能薄膜或纳米结构。',
      processChanges: '恒电位/恒电流模式，在三电极体系中定向生长功能材料。',
      flowchart: [
        { step: '基底预处理', action: '超声清洗基底(丙酮→乙醇→水)，氮气吹干' },
        { step: '配制电解液', action: '配制含目标金属离子的电解液' },
        { step: '电沉积', action: '三电极体系，设定电位/电流，控制沉积时间' },
        { step: '后处理', action: '去离子水冲洗，干燥' },
      ],
      controlParams: [{ key: '沉积电位', value: '-1.0 to -1.5V', reason: 'vs. Ag/AgCl' }, { key: '沉积时间', value: '300-600s', reason: '控制膜厚' }],
      optimizedParams: [{ key: '膜厚均匀性', value: '<5% RSD', reason: '电化学精确控制' }]
    },
    {
      id: 'tpl_calcination', name: '高温煅烧法', icon: 'fa-fire', category: '后处理',
      hypothesis: '通过高温热处理促进相变、结晶度提升和杂质去除。',
      processChanges: '前驱体在惰性/氧化/还原气氛下高温烧结，获得目标晶体结构。',
      flowchart: [
        { step: '前驱体准备', action: '将前驱体研磨至均匀细粉' },
        { step: '装舟进炉', action: '平铺于陶瓷舟/石英舟，置入管式炉' },
        { step: '程序升温', action: '以设定速率升温至目标温度' },
        { step: '恒温保持', action: '目标温度下保温固定时间' },
        { step: '自然降温', action: '关闭加热，自然冷却至室温取出' },
      ],
      controlParams: [{ key: '煅烧温度', value: '500-900°C', reason: '关键工艺参数' }, { key: '升温速率', value: '5°C/min', reason: '防止热应力' }, { key: '气氛', value: 'N2/Ar', reason: '防氧化' }],
      optimizedParams: [{ key: '结晶度', value: '>95%', reason: '充分相变' }]
    },
    {
      id: 'tpl_ballmill', name: '球磨法', icon: 'fa-gears', category: '制备',
      hypothesis: '利用高能球磨的机械化学效应实现固相合成或粒径减小。',
      processChanges: '在密封球磨罐中通过磨球的高速碰撞实现机械力化学反应。',
      flowchart: [
        { step: '配料', action: '按化学计量比称取原料粉末' },
        { step: '装罐', action: '将原料与磨球按设定球料比装入球磨罐' },
        { step: '球磨', action: '设定转速和时间进行球磨' },
        { step: '取样检测', action: '定时取样检测粒径和物相' },
      ],
      controlParams: [{ key: '球料比', value: '10:1', reason: '能量传递效率' }, { key: '转速', value: '400/800 rpm', reason: '高/低速交替' }],
      optimizedParams: [{ key: '目标粒径', value: 'D50<1μm', reason: '超细粉体' }]
    },
  ], []);

  // 从 localStorage 获取用户自定义模板
  const [customTemplates, setCustomTemplates] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('sciflow_route_templates') || '[]'); } catch { return []; }
  });

  const handleSaveAsTemplate = (prop: TransformationProposal) => {
    const tpl = {
      id: `user_tpl_${Date.now()}`,
      name: prop.title,
      icon: 'fa-user-pen',
      category: '自定义',
      hypothesis: prop.scientificHypothesis,
      processChanges: prop.processChanges,
      flowchart: prop.newFlowchart,
      controlParams: prop.controlParameters,
      optimizedParams: prop.optimizedParameters,
    };
    const updated = [...customTemplates, tpl];
    setCustomTemplates(updated);
    localStorage.setItem('sciflow_route_templates', JSON.stringify(updated));
  };

  const handleCreateFromTemplate = (tpl: any) => {
    const newId = `tpl_${Date.now()}`;
    const newProp: TransformationProposal = {
      id: newId,
      literatureId: 'TEMPLATE',
      literatureTitle: `模板: ${tpl.name}`,
      timestamp: new Date().toLocaleString(),
      title: `[${tpl.name}] 新方案`,
      status: 'main',
      processChanges: tpl.processChanges || '',
      newFlowchart: tpl.flowchart || [],
      controlParameters: tpl.controlParams || [],
      optimizedParameters: tpl.optimizedParams || [],
      scientificHypothesis: tpl.hypothesis || ''
    };
    onUpdateProject({ ...project, proposals: [...(project.proposals || []), newProp] });
    handleStartEdit(newProp);
    setShowTemplatePanel(false);
  };

  const handleDeleteTemplate = (tplId: string) => {
    const updated = customTemplates.filter(t => t.id !== tplId);
    setCustomTemplates(updated);
    localStorage.setItem('sciflow_route_templates', JSON.stringify(updated));
  };

  // Drag & Drop state for reordering top-level routes
  const dragItem = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragItem.current = id;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    dragItem.current = null;
    setDragOverId(null);
    setDragOverPosition(null);
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragItem.current === id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverId(id);
    setDragOverPosition(pos);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragItem.current;
    if (!sourceId || sourceId === targetId) return;

    const proposals = [...(project.proposals || [])];
    const topLevel = proposals.filter(p => !p.parentId);
    const children = proposals.filter(p => p.parentId);

    const sourceIdx = topLevel.findIndex(p => p.id === sourceId);
    const targetIdx = topLevel.findIndex(p => p.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [moved] = topLevel.splice(sourceIdx, 1);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIdx = e.clientY < midY ? targetIdx : (targetIdx >= sourceIdx ? targetIdx : targetIdx + 1);
    topLevel.splice(insertIdx > topLevel.length ? topLevel.length : insertIdx, 0, moved);

    onUpdateProject({ ...project, proposals: [...topLevel, ...children] });
    dragItem.current = null;
    setDragOverId(null);
    setDragOverPosition(null);
    setIsDragging(false);
  }, [project, onUpdateProject]);

  // In-place editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHypothesis, setEditHypothesis] = useState('');
  const [editProcessChanges, setEditProcessChanges] = useState('');
  const [editFlowchart, setEditFlowchart] = useState<{ step: string; action: string }[]>([]);
  const [editControlParams, setEditControlParams] = useState<{ key: string; value: string; reason: string }[]>([]);
  const [editOptimizedParams, setEditOptimizedParams] = useState<{ key: string; value: string; reason: string }[]>([]);

  const handleStartEdit = (prop: TransformationProposal) => {
    setEditingId(prop.id);
    setEditHypothesis(prop.scientificHypothesis || "");
    setEditProcessChanges(prop.processChanges || "");
    setEditFlowchart([...(prop.newFlowchart || [])]);
    setEditControlParams([...(prop.controlParameters || [])]);
    setEditOptimizedParams([...(prop.optimizedParameters || [])]);
    if (!expandedProposalIds.has(prop.id)) onToggleExpansion(prop.id);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const updatedProposals = (project.proposals || []).map(p =>
      p.id === editingId ? {
        ...p,
        scientificHypothesis: editHypothesis,
        processChanges: editProcessChanges,
        newFlowchart: editFlowchart,
        controlParameters: editControlParams,
        optimizedParameters: editOptimizedParams
      } : p
    );
    onUpdateProject({ ...project, proposals: updatedProposals });
    setEditingId(null);
  };

  const handleAdoptClick = (prop: TransformationProposal) => {
    setAdoptingId(prop.id);
    setTimeout(() => { onAdoptProposal(prop); setAdoptingId(null); Maps('project_detail', project.id, 'logs'); }, 1500);
  };

  const handleRenameProposal = (id: string, newTitle: string) => {
    const updated = (project.proposals || []).map(p => p.id === id ? { ...p, title: newTitle } : p);
    onUpdateProject({ ...project, proposals: updated });
  };

  const handlePushToLab = (prop: TransformationProposal) => {
    const stepsText = (prop.newFlowchart || []).map((s, i) => `${i + 1}. ${s.step}: ${s.action}`).join('\n');
    const allParams = [...(prop.optimizedParameters || []), ...(prop.controlParameters || [])];
    const paramsText = allParams.map(p => `- ${p.key}: ${p.value} (${p.reason})`).join('\n');
    const fullDescription = `【工艺来源】${prop.title}\n\n【建议步骤】\n${stepsText}\n\n【关键控制参数】\n${paramsText}`;

    updateFlowchartSession({ description: fullDescription });
    Maps('flowchart', project.id);
  };


  // ═══ 实验路线 → 收集到计划篮 ═══
  const handleAddToCollectorFromRoute = useCallback((prop: TransformationProposal) => {
    const stepsText = (prop.newFlowchart || []).map((s, i) => `${i + 1}. ${s.step}: ${s.action}`).join('\n');
    const controlParams = (prop.controlParameters || []).map(p => `${p.key}: ${p.value} (${p.reason})`).join('; ');
    const optimizedParams = (prop.optimizedParameters || []).map(p => `${p.key}: ${p.value} (${p.reason})`).join('; ');

    const taskDescription = [
      `实验方案：${prop.title}`,
      prop.scientificHypothesis ? `科学假设：${prop.scientificHypothesis}` : '',
      prop.processChanges ? `工艺变更：${prop.processChanges}` : '',
      stepsText ? `工艺步骤：\n${stepsText}` : '',
      controlParams ? `控制参数：${controlParams}` : '',
      optimizedParams ? `优化目标：${optimizedParams}` : '',
    ].filter(Boolean).join('\n');

    if (onAddToCollector) {
      onAddToCollector([taskDescription], prop.title);
    }
  }, [onAddToCollector]);

  const getParamIntensity = (valStr: string) => {
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0.05;
    return Math.min(Math.max(Math.log10(num + 1) / 5, 0.05), 0.3);
  };

  const getAiFeasibility = (prop: TransformationProposal) => {
    let score = 0;
    const riskFactors: string[] = [];

    const steps = prop.newFlowchart || [];
    const stepsWithAction = steps.filter(s => s.action && s.action.trim().length > 10);
    if (steps.length === 0) {
      riskFactors.push('缺少工艺步骤定义');
    } else {
      const stepCompleteness = Math.min(20, (stepsWithAction.length / Math.max(steps.length, 1)) * 20);
      score += stepCompleteness;
      if (stepCompleteness < 10) riskFactors.push('部分步骤缺少详细操作描述');
    }

    const allParams = [...(prop.optimizedParameters || []), ...(prop.controlParameters || [])];
    const validParams = allParams.filter(p => p.key && p.value && p.value.trim() !== '');
    const CRITICAL_PARAM_KEYWORDS = ['温度', '时间', '浓度', 'Temp', 'Time', 'pH', '压力', '速率', '收率', '纯度'];
    const coveredCritical = CRITICAL_PARAM_KEYWORDS.filter(kw =>
      validParams.some(p => p.key.includes(kw) || p.reason?.includes(kw))
    );
    const paramScore = Math.min(20, (validParams.length >= 3 ? 10 : validParams.length * 3) + (coveredCritical.length / CRITICAL_PARAM_KEYWORDS.length) * 10);
    score += paramScore;
    if (coveredCritical.length < 3) riskFactors.push('关键工艺参数覆盖不足（温度/时间/浓度等）');

    const audit = prop.resourceAudit;
    if (audit) {
      const allItems = [...(audit.reagents || []), ...(audit.equipment || [])];
      const readyCount = allItems.filter(i => i.status === 'ready').length;
      const lowCount = allItems.filter(i => i.status === 'low').length;
      const missingCount = allItems.filter(i => i.status === 'missing').length;
      const totalItems = allItems.length || 1;
      const resourceScore = Math.max(0, 20 * (readyCount / totalItems) - (missingCount * 4) - (lowCount * 1));
      score += Math.min(20, Math.max(0, resourceScore));
      if (missingCount > 0) riskFactors.push(`${missingCount} 项关键资源缺失，需紧急采购`);
      if (lowCount > 0) riskFactors.push(`${lowCount} 项资源存量偏低`);
    } else {
      score += 8;
      riskFactors.push('尚未执行资源对标审计');
    }

    const allText = `${prop.processChanges || ''} ${prop.scientificHypothesis || ''} ${steps.map(s => s.action).join(' ')}`;
    const HIGH_RISK_KEYWORDS = ['高压', '氢气', '剧毒', '浓硝酸', '浓硫酸', '爆炸', 'HF', '氢氟酸', '高毒', '放射', '光气'];
    const MED_RISK_KEYWORDS = ['高温', '还原剂', '搅拌', '有机溶剂', '甲醇', '乙醇', '丙酮', '腐蚀', '易燃'];
    const highRiskCount = HIGH_RISK_KEYWORDS.filter(kw => allText.includes(kw)).length;
    const medRiskCount = MED_RISK_KEYWORDS.filter(kw => allText.includes(kw)).length;
    const safetyScore = Math.max(0, 20 - (highRiskCount * 6) - (medRiskCount * 2));
    score += safetyScore;
    if (highRiskCount > 0) riskFactors.push(`检测到 ${highRiskCount} 项高危因子，需双重安全审核`);
    if (medRiskCount > 1) riskFactors.push('存在多项中等风险操作，建议强化防护措施');

    const hypothesis = prop.scientificHypothesis || '';
    let hypothesisScore = 0;
    if (hypothesis.length > 50) hypothesisScore += 8;
    else if (hypothesis.length > 20) hypothesisScore += 4;
    if (prop.literatureId && !['MANUAL', 'FLOW_GEN'].includes(prop.literatureId)) hypothesisScore += 6;
    if (prop.processChanges && prop.processChanges.length > 30) hypothesisScore += 6;
    score += Math.min(20, hypothesisScore);
    if (hypothesis.length < 20) riskFactors.push('科学假设描述薄弱，建议补充推演逻辑');

    const finalScore = Math.round(Math.min(100, Math.max(0, score)));
    const topRisk = riskFactors.length > 0
      ? riskFactors.slice(0, 2).join('；')
      : '各维度评估均达标，适合推进实施。';

    return { score: finalScore, riskText: topRisk };
  };

  const comparedProposals = useMemo(() => (project.proposals || []).filter(p => selectedCompareIds.has(p.id)), [project.proposals, selectedCompareIds]);

  const comparisonData = useMemo(() => {
    if (comparedProposals.length !== 2) return null;
    const [p1, p2] = comparedProposals;
    const params1 = p1.controlParameters || [];
    const params2 = p2.controlParameters || [];
    const allKeys = new Set([...params1.map(p => p.key), ...params2.map(p => p.key)]);
    return Array.from(allKeys).map(key => {
      const val1 = params1.find(p => p.key === key)?.value || '-';
      const val2 = params2.find(p => p.key === key)?.value || '-';
      return { key, val1, val2, isDiff: val1 !== val2 };
    });
  }, [comparedProposals]);

  const handleAddNewRoute = (parentId?: string) => {
    const newId = `manual_${Date.now()}`;
    let newProp: TransformationProposal;

    if (parentId) {
      const parent = project.proposals?.find(p => p.id === parentId);
      if (parent) {
        newProp = {
          ...parent,
          id: newId,
          parentId,
          title: `子路线: ${parent.title}`,
          status: 'sub',
          timestamp: new Date().toLocaleString()
        };
      } else {
        return;
      }
    } else {
      newProp = {
        id: newId,
        literatureId: 'MANUAL',
        literatureTitle: '手动创建',
        timestamp: new Date().toLocaleString(),
        title: '新工艺路线',
        status: 'main',
        processChanges: '手动录入的工艺变更路径。',
        newFlowchart: [{ step: '初始工序', action: '待描述操作细节' }],
        controlParameters: [{ key: '反应温度', value: '25°C', reason: '初始基准值' }],
        optimizedParameters: [{ key: '预期收率', value: '>90%', reason: '参考基准' }],
        scientificHypothesis: '待设定改进假设',
        category: activeFilter || undefined, // 自动分配当前筛选的分类
      };
    }

    onUpdateProject({ ...project, proposals: [...(project.proposals || []), newProp] });
    if (parentId && !expandedProposalIds.has(parentId)) onToggleExpansion(parentId);
    handleStartEdit(newProp);
  };

  // ═══ 渲染单个路线节点 ═══
  const renderRouteNode = (prop: TransformationProposal, idx: number, listLength: number, depth = 0) => {
    const isTopLevel = depth === 0;
    const isDropTarget = dragOverId === prop.id;
    const cat = categories.find(c => c.id === prop.category);

    const dragProps = isTopLevel ? {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, prop.id),
      onDragEnd: handleDragEnd,
      onDragOver: (e: React.DragEvent) => handleDragOver(e, prop.id),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, prop.id),
    } : {};

    // 获取当前 prop 的子路线
    const children = (project.proposals || []).filter(p => p.parentId === prop.id);

    return (
      <div key={prop.id} {...dragProps} className={`relative ${isTopLevel ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        {isTopLevel && isDropTarget && dragOverPosition === 'above' && (
          <div className="absolute top-0 left-4 right-4 h-1 bg-indigo-500 rounded-full z-30 -translate-y-1/2 shadow-lg shadow-indigo-500/40 animate-pulse" />
        )}

        <RouteNode
          prop={prop} depth={depth} idx={idx} listLength={listLength}
          isExpanded={expandedProposalIds.has(prop.id)} isSelected={selectedCompareIds.has(prop.id)}
          isActive={adoptingId === prop.id} isCurrentlyEditing={editingId === prop.id} adoptingId={adoptingId}
          onToggleExpansion={onToggleExpansion} toggleCompareSelection={(id) => setSelectedCompareIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else if (n.size < 2) n.add(id); return n; })}
          onAddSubProposal={handleAddNewRoute}
          onLinkPlan={() => onLinkPlan(prop)}
          onDelete={onDelete} onEditMeta={onEditMeta}
          handleStartEdit={handleStartEdit} handleSaveEdit={handleSaveEdit} handleCancelEdit={() => setEditingId(null)}
          handleAdoptClick={handleAdoptClick} handleSourceLink={(p) => Maps('literature', project.id, `${p.literatureId}_rp`)}
          handleRename={handleRenameProposal}
          onPushToLab={() => handlePushToLab(prop)}
          onAddToCollector={onAddToCollector ? () => handleAddToCollectorFromRoute(prop) : undefined}
          onSaveAsTemplate={handleSaveAsTemplate}
          getAiFeasibility={getAiFeasibility} getParamIntensity={getParamIntensity}
          availableCategories={categories}
          onChangeCategory={(catId) => handleChangeCategory(prop.id, catId)}
          categoryLabel={cat?.name}
          categoryColor={cat ? CATEGORY_COLOR_MAP[cat.color] : undefined}
          editingData={{
            hypothesis: editHypothesis, setHypothesis: setEditHypothesis,
            processChanges: editProcessChanges, setProcessChanges: setEditProcessChanges,
            flowchart: editFlowchart, setFlowchart: setEditFlowchart,
            params: [...editOptimizedParams, ...editControlParams],
            setParams: (newParams) => {
              setEditOptimizedParams(newParams.filter(p => p.key.includes('收率') || p.key.includes('纯度')));
              setEditControlParams(newParams.filter(p => !(p.key.includes('收率') || p.key.includes('纯度'))));
            }
          }}
        >
          {children.map((child, ci) => renderRouteNode(child, ci, children.length, depth + 1))}
        </RouteNode>

        {isTopLevel && isDropTarget && dragOverPosition === 'below' && (
          <div className="absolute bottom-0 left-4 right-4 h-1 bg-indigo-500 rounded-full z-30 translate-y-1/2 shadow-lg shadow-indigo-500/40 animate-pulse" />
        )}
      </div>
    );
  };

  // ═══ 按分类分组渲染 ═══
  const renderGroupedProposals = () => {
    const topLevel = (project.proposals || []).filter(p => !p.parentId);

    // 如果进行了标签筛选，只显示该类别
    const filteredTopLevel = activeFilter
      ? topLevel.filter(p => activeFilter === '__uncategorized__' ? !p.category : p.category === activeFilter)
      : topLevel;

    // 分组（按分类）
    const groups: { cat: RouteCategory | null; proposals: TransformationProposal[] }[] = [];

    // 有分类的组
    categories.forEach(cat => {
      const matching = filteredTopLevel.filter(p => p.category === cat.id);
      if (matching.length > 0 || !activeFilter) {
        // 只有当有内容或未启用筛选时才显示分组（筛选状态下只显示匹配的组）
        if (matching.length > 0) {
          groups.push({ cat, proposals: matching });
        }
      }
    });

    // 未分类组
    const uncategorized = filteredTopLevel.filter(p => !p.category || !categories.find(c => c.id === p.category));
    if (uncategorized.length > 0) {
      groups.push({ cat: null, proposals: uncategorized });
    }

    if (groups.length === 0) {
      return (
        <div className="text-center py-16">
          <i className="fa-solid fa-folder-open text-4xl text-slate-200 mb-4 block"></i>
          <p className="text-sm font-bold text-slate-400">
            {activeFilter ? '当前筛选条件下无路线' : '暂无实验路线，点击"新建路线"开始'}
          </p>
        </div>
      );
    }

    return groups.map(({ cat, proposals }) => {
      const catId = cat?.id || '__uncategorized__';
      const isCollapsed = collapsedCategories.has(catId);
      const isCustom = cat ? !DEFAULT_CATEGORIES.find(d => d.id === cat.id) : false;
      const avgScore = proposals.length > 0
        ? proposals.reduce((acc, p) => acc + getAiFeasibility(p).score, 0) / proposals.length
        : 0;

      return (
        <div key={catId} className="mb-2">
          <CategoryGroupHeader
            name={cat?.name || '未分类'}
            icon={cat?.icon || 'fa-folder-open'}
            color={cat?.color || 'slate'}
            count={proposals.length}
            avgScore={avgScore}
            isCollapsed={isCollapsed}
            onToggle={() => toggleCategoryCollapse(catId)}
            onRename={cat ? (newName) => handleRenameCategory(catId, newName) : undefined}
            onDelete={isCustom ? () => handleDeleteCategory(catId) : undefined}
            isCustom={isCustom || (cat ? !!DEFAULT_CATEGORIES.find(d => d.id === cat.id) : false)}
          />
          {!isCollapsed && (
            <div className="pl-2 animate-reveal">
              {proposals.map((prop, idx) => renderRouteNode(prop, idx, proposals.length))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-8 overflow-y-auto bg-slate-50/10 custom-scrollbar animate-reveal relative">
      {/* ═══ 顶部操作栏 ═══ */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 px-2 gap-4 shrink-0">
        <div>
          <h3 className="text-xl lg:text-3xl font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3"><i className="fa-solid fa-bezier-curve text-violet-600"></i> 工艺演进全景</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 pl-10">PROCESS EVOLUTION TOPOLOGY</p>
        </div>
        <div className="flex gap-3">
          {selectedCompareIds.size === 2 && <button onClick={() => setShowCompareModal(true)} className="bg-amber-500 text-white px-5 py-3 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2"><i className="fa-solid fa-scale-balanced"></i> Compare (2)</button>}
          <button onClick={() => setShowTemplatePanel(!showTemplatePanel)} className={`px-5 py-3 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2 transition-all ${showTemplatePanel ? 'bg-sky-600 text-white' : 'bg-white text-sky-600 border-2 border-sky-200 hover:border-sky-500'}`}><i className="fa-solid fa-shapes"></i> 模板库</button>
          <button onClick={() => handleAddNewRoute()} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-xl"><i className="fa-solid fa-wand-magic-sparkles mr-2 text-amber-300"></i>新建路线</button>
        </div>
      </div>

      {/* ═══ 分类筛选标签栏 ═══ */}
      <div className="flex items-center gap-2 px-2 mb-4 shrink-0 flex-wrap">
        <button
          onClick={() => setActiveFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            !activeFilter
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          <i className="fa-solid fa-border-all mr-1.5"></i>全部 <span className="ml-1 opacity-70">{(project.proposals || []).filter(p => !p.parentId).length}</span>
        </button>

        {categories.map(cat => {
          const count = categoryCounts[cat.id] || 0;
          const isActive = activeFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(isActive ? null : cat.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                isActive
                  ? `${CATEGORY_COLOR_MAP[cat.color]} text-white shadow-md`
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              <i className={`fa-solid ${cat.icon} text-[8px]`}></i>
              {cat.name}
              {count > 0 && <span className={`ml-0.5 ${isActive ? 'opacity-70' : 'text-slate-400'}`}>{count}</span>}
            </button>
          );
        })}

        {/* 未分类标签 */}
        {(categoryCounts['__uncategorized__'] || 0) > 0 && (
          <button
            onClick={() => setActiveFilter(activeFilter === '__uncategorized__' ? null : '__uncategorized__')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              activeFilter === '__uncategorized__'
                ? 'bg-slate-500 text-white shadow-md'
                : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
            }`}
          >
            <i className="fa-solid fa-folder-open text-[8px]"></i>
            未分类 <span className="ml-0.5 opacity-70">{categoryCounts['__uncategorized__'] || 0}</span>
          </button>
        )}

        {/* 分隔符 + 折叠操作 */}
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        <button onClick={handleExpandAll} className="px-2 py-1.5 text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors" title="全部展开">
          <i className="fa-solid fa-angles-down"></i>
        </button>
        <button onClick={handleCollapseAll} className="px-2 py-1.5 text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors" title="全部折叠">
          <i className="fa-solid fa-angles-up"></i>
        </button>

        {/* 分类管理入口 */}
        <div className="w-px h-5 bg-slate-200 mx-1"></div>
        <button
          onClick={() => setShowCategoryManager(!showCategoryManager)}
          className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1 ${
            showCategoryManager ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
          }`}
          title="管理分类"
        >
          <i className="fa-solid fa-tags"></i> 管理
        </button>
      </div>

      {/* ═══ 分类管理面板 ═══ */}
      {showCategoryManager && (
        <div className="mb-4 mx-2 p-4 bg-white rounded-xl border-2 border-violet-100 shadow-lg animate-reveal">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-black text-slate-800 uppercase flex items-center gap-2">
              <i className="fa-solid fa-tags text-violet-500"></i> 分类管理
            </h4>
            <button onClick={() => setShowCategoryManager(false)} className="text-slate-300 hover:text-slate-500 text-xs"><i className="fa-solid fa-times"></i></button>
          </div>

          {/* 已有分类列表 */}
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map(cat => {
              const isCustom = !DEFAULT_CATEGORIES.find(d => d.id === cat.id);
              const count = categoryCounts[cat.id] || 0;
              return (
                <div key={cat.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-100 group/cat">
                  <div className={`w-3 h-3 rounded ${CATEGORY_COLOR_MAP[cat.color]}`}></div>
                  <i className={`fa-solid ${cat.icon} text-[8px] text-slate-400`}></i>
                  <span className="text-[10px] font-bold text-slate-700">{cat.name}</span>
                  <span className="text-[8px] font-bold text-slate-400">({count})</span>
                  {isCustom && (
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-slate-300 hover:text-rose-500 opacity-0 group-hover/cat:opacity-100 transition-opacity ml-0.5"
                    >
                      <i className="fa-solid fa-times text-[7px]"></i>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 新增分类 */}
          <div className="flex items-end gap-3 pt-3 border-t border-slate-100">
            <div className="flex-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">分类名称</label>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="输入新分类名称..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-violet-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">颜色</label>
              <div className="flex gap-1">
                {AVAILABLE_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setNewCatColor(c.id)}
                    className={`w-5 h-5 rounded-md ${CATEGORY_COLOR_MAP[c.id]} transition-all ${
                      newCatColor === c.id ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">图标</label>
              <div className="flex gap-1 flex-wrap max-w-[120px]">
                {AVAILABLE_ICONS.slice(0, 8).map(ic => (
                  <button
                    key={ic}
                    onClick={() => setNewCatIcon(ic)}
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                      newCatIcon === ic ? 'bg-violet-100 text-violet-600 ring-1 ring-violet-400' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <i className={`fa-solid ${ic} text-[8px]`}></i>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddCategory}
              disabled={!newCatName.trim()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-violet-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <i className="fa-solid fa-plus mr-1"></i> 添加
            </button>
          </div>
        </div>
      )}

      {/* ═══ 模板库面板 ═══ */}
      {showTemplatePanel && (
        <div className="mb-6 p-5 bg-white rounded-xl border-2 border-sky-100 shadow-lg animate-reveal mx-2">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
              <i className="fa-solid fa-shapes text-sky-500"></i> 智能工艺模板库
            </h4>
            <span className="text-[8px] font-bold text-slate-400 uppercase">{BUILT_IN_TEMPLATES.length + customTemplates.length} Templates</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...BUILT_IN_TEMPLATES, ...customTemplates].map(tpl => (
              <div key={tpl.id} onClick={() => handleCreateFromTemplate(tpl)} className="p-4 bg-slate-50 rounded-lg border-2 border-slate-100 hover:border-sky-300 hover:shadow-md cursor-pointer transition-all group/tpl relative">
                {tpl.category === '自定义' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full opacity-0 group-hover/tpl:opacity-100 transition-opacity flex items-center justify-center text-[8px] shadow-md z-10"
                  ><i className="fa-solid fa-times"></i></button>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center group-hover/tpl:bg-sky-600 group-hover/tpl:text-white transition-colors">
                    <i className={`fa-solid ${tpl.icon} text-xs`}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-800 truncate">{tpl.name}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase">{tpl.category} · {(tpl.flowchart || []).length} 步骤</p>
                  </div>
                </div>
                <p className="text-[8px] text-slate-500 italic leading-snug line-clamp-2">{tpl.hypothesis}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 分组路线列表 ═══ */}
      <div className="flex-1 pb-10">{renderGroupedProposals()}</div>
      {showCompareModal && <RouteComparisonModal onClose={() => setShowCompareModal(false)} comparedProposals={comparedProposals} comparisonData={comparisonData} />}
    </div>
  );
};

export default ProcessRouteView;
