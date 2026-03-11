import React, { useState, useRef, useEffect, useMemo } from 'react';
import { chatWithAssistant } from '../services/gemini';
import { ChatMessage, ResearchProject, Literature, DebatePersona } from '../types';
import { useProjectContext } from '../context/ProjectContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import saveAs from 'file-saver';
import DebateView from './AIAssistant/DebateView';

type SessionTag = '机理分析' | '文献研究' | '实验设计' | '数据分析' | '项目管理' | '专家辩论' | '综合咨询';

const TAG_CONFIG: Record<SessionTag, { icon: string; color: string; bg: string; border: string }> = {
  '机理分析': { icon: 'fa-atom', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  '文献研究': { icon: 'fa-book-open', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  '实验设计': { icon: 'fa-flask', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  '数据分析': { icon: 'fa-chart-line', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  '项目管理': { icon: 'fa-diagram-project', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  '专家辩论': { icon: 'fa-comments-dollar', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  '综合咨询': { icon: 'fa-wand-magic-sparkles', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const inferSessionTag = (text: string, mode?: string): SessionTag => {
  if (mode === 'debate') return '专家辩论';
  const t = text.toLowerCase();
  if (/机理|机制|催化|her|oer|orr|电化学|掺杂|晶胞|反应路径|中间体|dft|密度泛函/.test(t)) return '机理分析';
  if (/文献|论文|专利|综述|摘要|引用|期刊|发表|作者|doi/.test(t)) return '文献研究';
  if (/doe|实验设计|因子|正交|参数优化|合成|制备|工艺|流程|温度|浓度|时间|转速/.test(t)) return '实验设计';
  if (/数据|图表|曲线|散点|拟合|趋势|分析|统计|误差|均值|方差/.test(t)) return '数据分析';
  if (/项目|进度|里程碑|日志|计划|团队|任务|截止|trl|课题/.test(t)) return '项目管理';
  return '综合咨询';
};

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  projectId?: string;
  messages: ChatMessage[];
  mode?: 'chat' | 'debate';
  tag?: SessionTag;
  pinned?: boolean;
}

const DEBATE_PERSONAS: DebatePersona[] = [
  { id: 'rigor', name: 'Dr. Rigor', title: '严谨派审计专家', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=rigor', color: '#f43f5e', icon: 'fa-scale-balanced', description: '极其关注热力学自洽性、实验误差范围及数据复现性。对“由于实验误差导致的假阳性结果”有职业洁癖。', focus: '物理常识、热力学极限、统计显著性' },
  { id: 'nova', name: 'Dr. Nova', title: '创新派远见家', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nova', color: '#8b5cf6', icon: 'fa-wand-magic-sparkles', description: '追求学术新奇度、跨学科的潜在连接以及长远的产业影响力。鼓励打破常规假设，即使在数据尚不完全充分时也敢于提出新范式。', focus: '新奇度、应用前景、跨学科创新' },
  { id: 'expert', name: 'Legacy Pioneer', title: '学术泰斗数字孪生', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=expert', color: '#fbbf24', icon: 'fa-landmark', description: '基于领域经典语料库生成的数字孪生，具备深厚的理论积淀，能够从底层物理图像角度质询当前方案。', focus: '底层机制、领域共识、历史演进' }
];

interface AIAssistantProps {
  initialQuery?: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ initialQuery }) => {
  const { projects, resources, inventory, teamMembers, showToast, activeTheme, returnPath, setReturnPath, dataAnalysisSession, doeSession, mechanismSession, flowchartSession } = useProjectContext();
  const isLight = activeTheme.type === 'light';

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('sciflow_ai_history_v3');
    return saved ? JSON.parse(saved) : [{
      id: Date.now().toString(),
      title: '新科研对话',
      timestamp: new Date().toLocaleString(),
      mode: 'chat',
      messages: [{ role: 'model', text: `你好，我是您的专属科研助理。\n您可以点击左侧“知识源”选择项目上下文，或切换为“多智能体辩论”模式进行多维立项评估。`, timestamp: new Date().toLocaleTimeString() }]
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<SessionTag | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<{ sessionId: string; index: number } | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const [knowledgeSource, setKnowledgeSource] = useState<'global' | 'project' | 'literature' | 'debate'>('global');
  const [dataSources, setDataSources] = useState<Set<string>>(new Set());
  const [autoDetectedSources, setAutoDetectedSources] = useState<string[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const toggleDataSource = (source: string) => {
    setDataSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };
  const [attachments, setAttachments] = useState<{ name: string, url: string, type: string, dataUrl?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);

  // Filter messages based on search query and track match indices
  const { filteredMessages, matchIndices } = useMemo(() => {
    if (!activeSession || !messageSearch.trim()) {
      return { filteredMessages: activeSession?.messages || [], matchIndices: [] };
    }
    const query = messageSearch.toLowerCase();
    const matches: number[] = [];
    const filtered = activeSession.messages.filter((msg, index) => {
      if (msg.text.toLowerCase().includes(query)) {
        matches.push(index);
        return true;
      }
      return false;
    });
    return { filteredMessages: filtered, matchIndices: matches };
  }, [activeSession, messageSearch]);

  // Reset current match index when search changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [messageSearch]);

  // Navigate to next match
  const goToNextMatch = () => {
    if (matchIndices.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matchIndices.length);
    }
  };

  // Navigate to previous match
  const goToPreviousMatch = () => {
    if (matchIndices.length > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + matchIndices.length) % matchIndices.length);
    }
  };

  // Scroll to current match
  useEffect(() => {
    if (matchIndices.length > 0 && scrollRef.current && messageSearch) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const targetIndex = matchIndices[currentMatchIndex];
        const messageElements = scrollRef.current?.querySelectorAll('[data-message-index]');
        if (messageElements) {
          const targetElement = Array.from(messageElements).find(
            (el) => parseInt((el as HTMLElement).dataset.messageIndex || '-1') === targetIndex
          );
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 100);
    }
  }, [currentMatchIndex, matchIndices, messageSearch]);

  // Highlight search text with current match indicator
  const highlightText = (text: string, query: string, messageIndex: number) => {
    if (!query.trim()) return text;
    const isCurrentMatch = matchIndices[currentMatchIndex] === messageIndex;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? `<mark class="${isCurrentMatch
          ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-500 shadow-lg animate-pulse'
          : 'bg-amber-300/40 text-amber-900'
        } px-1 py-0.5 rounded font-bold">${part}</mark>`
        : part
    ).join('');
  };

  useEffect(() => {
    localStorage.setItem('sciflow_ai_history_v3', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, activeSessionId, isLoading]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl/Cmd + F to toggle search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        setShowMessageSearch(prev => !prev);
      }
      // ESC to close search
      if (e.key === 'Escape' && showMessageSearch) {
        setShowMessageSearch(false);
        setMessageSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMessageSearch]);

  const activeProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  // ── 自动感知：根据用户问题中的关键词检测需要注入哪些数据模块 ──
  const detectRelevantSources = (message: string): string[] => {
    const msg = message.toLowerCase();
    const detected: string[] = [];

    // 实验室资产 / 药物 / 试剂 / 耗材 / 仪器
    const inventoryKeywords = ['资产', '药物', '试剂', '耗材', '仪器', '设备', '库存', '低库存', '在用', '化学品', '前驱体', 'cas', '安全等级', '存放', '采购', '物资', '管理处', '药品', '清单', '物料', '储存', '过期', '品牌', '纯度', '瓶', '盒', '包装', 'msds', '毒性', '易燃', '腐蚀', '实验室'];
    if (inventoryKeywords.some(kw => msg.includes(kw))) detected.push('inventory');

    // 情报档案 / 文献 / 专利
    const literatureKeywords = ['文献', '论文', '专利', '情报', '档案', '摘要', '作者', '期刊', '参考', '引用', '竞品', '综述', '发表', '研究成果', '文章', '出版', 'doi', '标签', '知识库'];
    if (literatureKeywords.some(kw => msg.includes(kw))) detected.push('literature');

    // 团队成员 / 人员
    const teamKeywords = ['团队', '成员', '人员', '谁', '空闲', '负载', '工作量', '分工', '协作', '研究员', '博士', '课题组', '导师', '可用', '请假', '负责人', '专长', '擅长'];
    if (teamKeywords.some(kw => msg.includes(kw))) detected.push('team');

    // 项目相关
    const projectKeywords = ['项目', '课题', '进度', '里程碑', '实验日志', 'trl', '进展', '截止', '状态', '延期', '目标', '阶段', '计划', '任务', '落后'];
    if (projectKeywords.some(kw => msg.includes(kw))) detected.push('projects');

    // DOE实验设计
    const doeKeywords = ['doe', '因子', '响应', '优化', '实验设计', '正交', '参数', '水平', '控制变量', '实验矩阵'];
    if (doeKeywords.some(kw => msg.includes(kw))) detected.push('doe');

    // 机理分析
    const mechanismKeywords = ['机理', '机制', '催化', 'her', 'oer', 'orr', '电化学', '电位', 'ph', '掺杂', '晶胞', '材料', '载量', '反应模式'];
    if (mechanismKeywords.some(kw => msg.includes(kw))) detected.push('mechanism');

    // 工艺流程
    const flowchartKeywords = ['工艺', '流程', '步骤', '放大', '产量', '风险', '合成路线', '制备', '工序', '量产'];
    if (flowchartKeywords.some(kw => msg.includes(kw))) detected.push('flowchart');

    // 数据分析/图表
    const dataKeywords = ['数据', '图表', '曲线', '散点', '柱状图', 'x轴', 'y轴', '系列', '拟合', '趋势', '分析数据'];
    if (dataKeywords.some(kw => msg.includes(kw))) detected.push('dataAnalysis');

    return detected;
  };

  // ── 统一数据上下文构建器（支持传入合并后的数据源集合 + 用户消息用于智能过滤） ──
  const buildDataContext = (activeSources?: Set<string>, userMessage?: string) => {
    const sources = activeSources || dataSources;
    const msg = (userMessage || '').toLowerCase();
    const sections: string[] = [];

    // 实验室资产中心 — 智能过滤
    if (sources.has('inventory') && inventory.length > 0) {
      const inUse = inventory.filter(i => i.status === 'In Use');
      const lowStock = inventory.filter(i => i.quantity <= i.threshold);
      const purchasing = inventory.filter(i => i.status === 'Purchasing');
      const byCategory = inventory.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 根据用户问题智能筛选子集
      let filteredItems = inventory;
      let filterLabel = '全部';

      if (msg.includes('在用') || msg.includes('使用中')) {
        filteredItems = inUse;
        filterLabel = '在用(In Use)';
      } else if (msg.includes('低库存') || msg.includes('不足') || msg.includes('缺少') || msg.includes('补充')) {
        filteredItems = lowStock;
        filterLabel = '低库存预警';
      } else if (msg.includes('采购') || msg.includes('购买') || msg.includes('订购')) {
        filteredItems = purchasing.length > 0 ? purchasing : lowStock;
        filterLabel = purchasing.length > 0 ? '采购中' : '需采购(低库存)';
      } else if (msg.includes('化学品') || msg.includes('试剂')) {
        filteredItems = inventory.filter(i => i.category === 'Chemical');
        filterLabel = '化学品(Chemical)';
      } else if (msg.includes('前驱体')) {
        filteredItems = inventory.filter(i => i.category === 'Precursor');
        filterLabel = '前驱体(Precursor)';
      } else if (msg.includes('仪器') || msg.includes('设备')) {
        filteredItems = inventory.filter(i => i.category === 'Hardware');
        filterLabel = '仪器设备(Hardware)';
      } else if (msg.includes('耗材')) {
        filteredItems = inventory.filter(i => i.category === 'Consumable');
        filterLabel = '耗材(Consumable)';
      } else if (msg.includes('危险') || msg.includes('毒') || msg.includes('易燃') || msg.includes('腐蚀') || msg.includes('爆炸')) {
        filteredItems = inventory.filter(i => ['Toxic', 'Flammable', 'Corrosive', 'Explosive', 'Hazardous', 'Restricted'].includes(i.safetyLevel));
        filterLabel = '危险品';
      }

      // 如果未命中任何特定筛选，且数据量大于100，只发摘要+前50条
      if (filterLabel === '全部' && filteredItems.length > 100) {
        let s = `📦 [实验室资产中心] 共${inventory.length}项 | 在用${inUse.length}项 | 低库存${lowStock.length}项 | 采购中${purchasing.length}项\n`;
        s += `分类: ${Object.entries(byCategory).map(([c, n]) => `${c}(${n})`).join(', ')}\n`;
        s += `(数据量较大，仅展示前50项摘要。如需查看特定子集，请用"在用"、"低库存"、"化学品"等关键词筛选)\n`;
        filteredItems.slice(0, 50).forEach(item => {
          s += `• ${item.name} | ${item.category} | ${item.status || 'Ready'} | ${item.quantity}${item.unit}\n`;
        });
        s += `... 还有${filteredItems.length - 50}项，请使用筛选关键词查看\n`;
        sections.push(s);
      } else {
        let s = `📦 [实验室资产中心] 总计${inventory.length}项 → 当前筛选「${filterLabel}」共${filteredItems.length}项\n`;
        s += `全局统计: 在用${inUse.length}项 | 低库存${lowStock.length}项 | 采购中${purchasing.length}项\n`;
        s += `分类: ${Object.entries(byCategory).map(([c, n]) => `${c}(${n})`).join(', ')}\n`;
        filteredItems.forEach(item => {
          s += `• ${item.name}`;
          if (item.formula) s += ` (${item.formula})`;
          s += ` | ${item.category} | 状态:${item.status || 'Ready'} | ${item.quantity}${item.unit}`;
          if (item.quantity <= item.threshold) s += ' ⚠️低库存';
          s += ` | 存放:${item.location} | 安全:${item.safetyLevel}`;
          if (item.casNo) s += ` | CAS:${item.casNo}`;
          if (item.brand) s += ` | 品牌:${item.brand}`;
          if (item.purity) s += ` | 纯度:${item.purity}`;
          s += '\n';
        });
        sections.push(s);
      }
    }

    // 情报档案（文献/专利） — 智能过滤
    if (sources.has('literature') && resources.length > 0) {
      const byType = resources.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      let filteredLit = resources;
      let litFilterLabel = '全部';

      if (msg.includes('专利')) {
        filteredLit = resources.filter(r => r.type === '专利');
        litFilterLabel = '专利';
      } else if (msg.includes('竞品') || msg.includes('商业')) {
        filteredLit = resources.filter(r => r.type === '商业竞品');
        litFilterLabel = '商业竞品';
      } else if (msg.includes('文献') || msg.includes('论文')) {
        filteredLit = resources.filter(r => r.type === '文献');
        litFilterLabel = '文献';
      }

      // 大数据量时压缩
      if (litFilterLabel === '全部' && filteredLit.length > 50) {
        let s = `📚 [情报档案] 共${resources.length}篇 | ${Object.entries(byType).map(([t, n]) => `${t}(${n})`).join(', ')}\n`;
        s += `(数据量较大，仅展示前30篇。如需查看特定类型，请用"文献"、"专利"、"竞品"等关键词)\n`;
        filteredLit.slice(0, 30).forEach(lit => {
          s += `• [${lit.type}] ${lit.title} (${lit.year}) | ${lit.source}\n`;
        });
        sections.push(s);
      } else {
        let s = `📚 [情报档案] 总计${resources.length}篇 → 当前筛选「${litFilterLabel}」共${filteredLit.length}篇\n`;
        filteredLit.forEach(lit => {
          s += `• [${lit.type}] ${lit.title} (${lit.year}) | 来源:${lit.source}`;
          if (lit.authors?.length) s += ` | 作者:${lit.authors.slice(0, 3).join(',')}`;
          if (lit.tags?.length) s += ` | 标签:${lit.tags.join(',')}`;
          if (lit.abstract) s += `\n  摘要: ${lit.abstract.substring(0, 120)}...`;
          s += '\n';
        });
        sections.push(s);
      }
    }

    // 团队成员
    if (sources.has('team') && teamMembers.length > 0) {
      let s = `👥 [团队成员] 共${teamMembers.length}人\n`;
      teamMembers.forEach(m => {
        s += `• ${m.name} | ${m.role} | ${m.department}`;
        s += ` | 状态:${m.availabilityStatus || 'Available'}`;
        if (m.researchArea) s += ` | 研究方向:${m.researchArea}`;
        if (m.expertise?.length) s += ` | 专长:${m.expertise.join(',')}`;
        if (m.workload !== undefined) s += ` | 工作负载:${m.workload}%`;
        s += '\n';
      });
      sections.push(s);
    }

    // 全部项目概览
    if (sources.has('projects') && projects.length > 0) {
      let s = `🔬 [项目概览] 共${projects.length}个项目\n`;
      projects.forEach(p => {
        s += `• ${p.title} | 状态:${p.status} | 进度:${p.progress}% | TRL:${p.trl}`;
        s += ` | 类别:${p.category} | 截止:${p.deadline}`;
        if (p.keywords?.length) s += ` | 关键词:${p.keywords.join(',')}`;
        s += `\n  描述: ${p.description.substring(0, 100)}`;
        const totalLogs = p.milestones.reduce((sum, m) => sum + m.logs.length, 0);
        s += `\n  里程碑: ${p.milestones.length}个 | 实验日志: ${totalLogs}条\n`;
        // 最新3条实验日志摘要
        const recentLogs = p.milestones.flatMap(m => m.logs).slice(-3);
        if (recentLogs.length > 0) {
          s += `  最近日志:\n`;
          recentLogs.forEach(log => {
            s += `    - [${log.timestamp}] ${log.content.substring(0, 60)} | 结果:${log.result}\n`;
          });
        }
      });
      sections.push(s);
    }

    // DOE 实验设计
    if (sources.has('doe') && doeSession) {
      let s = `🧪 [DOE实验设计]\n`;
      if (doeSession.processDescription) s += `工艺描述: ${doeSession.processDescription}\n`;
      if (doeSession.factors?.length) {
        s += `因子: ${doeSession.factors.map(f => `${f.name}(${f.min}-${f.max}${f.unit})`).join(', ')}\n`;
      }
      if (doeSession.responses?.length) {
        s += `响应: ${doeSession.responses.map(r => `${r.name}(${r.goal}, 权重${r.weight})`).join(', ')}\n`;
      }
      if (doeSession.history?.length) {
        s += `已完成${doeSession.history.length}组实验\n`;
        doeSession.history.slice(-5).forEach((h, i) => {
          s += `  #${i + 1}: 因子=${JSON.stringify(h.factors)} → 响应=${JSON.stringify(h.responses)}\n`;
        });
      }
      sections.push(s);
    }

    // 机理分析
    if (sources.has('mechanism') && mechanismSession) {
      let s = `⚛️ [机理分析模块]\n`;
      s += `材料: ${mechanismSession.material} | 反应模式: ${mechanismSession.reactionMode}\n`;
      s += `pH: ${mechanismSession.pH} | 电位: ${mechanismSession.potential}V\n`;
      s += `晶胞类型: ${mechanismSession.unitCellType} | 掺杂: ${mechanismSession.dopingElement}(${mechanismSession.dopingConcentration}%)`;
      if (mechanismSession.coDopingElement) s += ` + ${mechanismSession.coDopingElement}(${mechanismSession.coDopingConcentration}%)`;
      s += `\n载量: ${mechanismSession.massLoading} mg/cm²\n`;
      if (mechanismSession.analysisResult) s += `分析结果: ${mechanismSession.analysisResult.substring(0, 200)}\n`;
      sections.push(s);
    }

    // 工艺流程
    if (sources.has('flowchart') && flowchartSession?.currentFlowchart) {
      const fc = flowchartSession.currentFlowchart;
      let s = `🏭 [工艺流程] ${fc.title}\n`;
      s += `TRL: ${fc.trlLevel} | 产量: ${fc.productionValue}${fc.unitLabel} | 放大因子: ${fc.scaleFactor}\n`;
      if (fc.steps?.length) {
        s += `步骤(${fc.steps.length}步):\n`;
        fc.steps.forEach((step, i) => {
          s += `  ${i + 1}. ${step.text}: ${step.description}`;
          if (step.riskLevel) s += ` [风险:${step.riskLevel}]`;
          s += '\n';
        });
      }
      sections.push(s);
    }

    // 数据分析图表
    if (sources.has('dataAnalysis') && dataAnalysisSession) {
      let s = `📊 [数据分析]\n`;
      if (dataAnalysisSession.chartTitle) s += `当前图表: ${dataAnalysisSession.chartTitle}\n`;
      s += `图表类型: ${dataAnalysisSession.chartType} | X轴: ${dataAnalysisSession.xAxisLabel} | Y轴: ${dataAnalysisSession.yAxisLabel}\n`;
      if (dataAnalysisSession.seriesList?.length) {
        s += `数据系列(${dataAnalysisSession.seriesList.length}组):\n`;
        dataAnalysisSession.seriesList.forEach(series => {
          const name = series.name || series.label || '未命名';
          const pointCount = series.data?.length || 0;
          s += `  • ${name}: ${pointCount}个数据点\n`;
        });
      }
      sections.push(s);
    }

    return sections.length > 0
      ? '\n=== 以下是用户应用中的实时数据上下文，请基于这些数据回答用户问题 ===\n' + sections.join('\n---\n') + '\n=== 数据上下文结束 ===\n'
      : '';
  };

  const handleBack = () => {
    if (returnPath) {
      const path = returnPath;
      setReturnPath(null);
      if (path.startsWith('#')) window.location.hash = path;
      else window.location.hash = `#${path}`;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      // 将图片转为 base64 以便传给 Gemini API
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments(prev => [...prev, { name: file.name, url, type: file.type, dataUrl }]);
        showToast({ message: "附件已添加至对话上下文", type: 'info' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (suggestion?: string) => {
    const textToSend = suggestion || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
      images: attachments.filter(a => a.type.startsWith('image/')).map(a => a.url)
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isFirstUserMsg = s.messages.filter(m => m.role === 'user').length === 0;
        const newTitle = s.title === '新科研对话' ? textToSend.substring(0, 16) + '...' : s.title;
        const newTag = isFirstUserMsg ? inferSessionTag(textToSend, s.mode) : s.tag;
        return { ...s, title: newTitle, tag: newTag, messages: [...s.messages, userMsg] };
      }
      return s;
    }));

    setInput('');
    setIsLoading(true);

    // Build Context — 统一数据上下文注入（自动感知 + 手动勾选合并）
    const autoDetected = detectRelevantSources(textToSend);
    setAutoDetectedSources(autoDetected);
    const mergedSources = new Set([...dataSources, ...autoDetected]);

    let contextPrompt = "[Knowledge Source: " + knowledgeSource.toUpperCase() + "]\n";
    if (knowledgeSource === 'project' && activeProject) {
      contextPrompt += `Current context: Project "${activeProject.title}". TRL: ${activeProject.trl}. Status: ${activeProject.status}. Progress: ${activeProject.progress}%. Description: ${activeProject.description}. Recent Logs: ${JSON.stringify(activeProject.milestones.flatMap(m => m.logs).slice(0, 5))}`;
    }
    // 注入合并后的数据源上下文（自动检测 + 手动勾选）
    contextPrompt += buildDataContext(mergedSources, textToSend);

    try {
      const historyForModel = (sessions.find(s => s.id === activeSessionId)?.messages || []).slice(-20).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // 提取 attachments 中的 base64 图片数据传给 Gemini
      const imageData = attachments
        .filter(a => a.dataUrl && a.type.startsWith('image/'))
        .map(a => a.dataUrl!);
      const responseText = await chatWithAssistant(historyForModel, `${contextPrompt}\nUser: ${textToSend}`, imageData.length > 0 ? imageData : undefined, useWebSearch);

      const modelMsg: ChatMessage = {
        role: 'model',
        text: responseText || "无法获取响应，请重试。",
        timestamp: new Date().toLocaleTimeString()
      };

      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, modelMsg] } : s));
    } catch (error) {
      showToast({ message: "AI 引擎连接超时", type: 'error' });
    } finally {
      setIsLoading(false);
      setAttachments([]);
    }
  };

  const handleUpdateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));
  };

  const handleCreateNewDebate = () => {
    const id = Date.now().toString();
    const newSession: ChatSession = {
      id,
      title: '新立项辩论会',
      timestamp: new Date().toLocaleString(),
      mode: 'debate',
      messages: []
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(id);
    setKnowledgeSource('debate');
  };

  // --- 处理机器人巡逻兵传入的预设指令 ---
  useEffect(() => {
    if (initialQuery === 'efficiency') {
      handleSend("分析今天实验室整体的团队协作效率，并指出目前的任务阻塞点。");
    } else if (initialQuery === 'availability') {
      handleSend("帮我查看一下团队里现在谁处于空闲状态，可以承接新的表征任务？");
    }
  }, [initialQuery]);

  return (
    <div className="h-full flex gap-4 animate-reveal overflow-hidden">
      {/* Sidebar: History & Sources */}
      <div className={`${showHistory ? 'w-72 opacity-100' : 'w-0 opacity-0 overflow-hidden'} transition-all duration-500 flex-shrink-0 flex flex-col gap-4 h-full`}>
        {/* Sessions List */}
        <div className={`flex-1 bg-white/80 backdrop-blur-xl rounded-2xl border ${isLight ? 'border-slate-200 shadow-sm' : 'border-white/5 bg-slate-900/50 shadow-xl'} flex flex-col overflow-hidden min-h-0`}>
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">会话历史</h3>
              <div className="flex gap-1.5">
                <button onClick={handleCreateNewDebate} className="w-7 h-7 bg-amber-500 text-white rounded-lg shadow hover:bg-black transition-all active:scale-95" title="发起多专家辩论">
                  <i className="fa-solid fa-users-viewfinder text-[10px]"></i>
                </button>
                <button onClick={() => {
                  const id = Date.now().toString();
                  setSessions([{ id, title: '新科研对话', timestamp: new Date().toLocaleString(), mode: 'chat', messages: [] }, ...sessions]);
                  setActiveSessionId(id);
                  setKnowledgeSource('global');
                }} className="w-7 h-7 bg-indigo-600 text-white rounded-lg shadow hover:bg-black transition-all active:scale-95" title="新对话">
                  <i className="fa-solid fa-plus text-[10px]"></i>
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 text-[9px]"></i>
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="搜索对话..."
                className="w-full pl-7 pr-3 py-1.5 text-[10px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all"
              />
            </div>
            {/* Tag filters */}
            <div className="flex gap-1 mt-2 flex-wrap">
              <button
                onClick={() => setActiveTagFilter(null)}
                className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all border ${activeTagFilter === null ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'
                  }`}
              >全部</button>
              {(Object.keys(TAG_CONFIG) as SessionTag[]).filter(tag =>
                sessions.some(s => s.tag === tag)
              ).map(tag => {
                const cfg = TAG_CONFIG[tag];
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                    className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase transition-all border flex items-center gap-1 ${activeTagFilter === tag
                      ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                      : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'
                      }`}
                  >
                    <i className={`fa-solid ${cfg.icon} text-[7px]`}></i>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {(() => {
              const query = historySearch.toLowerCase();
              const filtered = sessions.filter(s => {
                const matchSearch = !query || s.title.toLowerCase().includes(query) ||
                  s.messages.some(m => m.text.toLowerCase().includes(query));
                const matchTag = !activeTagFilter || s.tag === activeTagFilter;
                return matchSearch && matchTag;
              });
              const pinned = filtered.filter(s => s.pinned);
              const unpinned = filtered.filter(s => !s.pinned);
              const renderSession = (s: ChatSession) => {
                const tagCfg = s.tag ? TAG_CONFIG[s.tag] : null;
                return (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSessionId(s.id); if (s.mode === 'debate') setKnowledgeSource('debate'); }}
                    className={`p-3 rounded-xl cursor-pointer transition-all group relative border ${activeSessionId === s.id
                      ? 'bg-indigo-600 text-white shadow-indigo-200 shadow-md border-indigo-500'
                      : 'hover:bg-slate-50 border-transparent hover:border-slate-100'
                      }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-black truncate pr-5 leading-tight ${activeSessionId === s.id ? 'text-white' : 'text-slate-700'
                          }`}>{s.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {tagCfg && (
                            <span className={`inline-flex items-center gap-0.5 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md border ${activeSessionId === s.id
                              ? 'bg-white/20 text-white/90 border-white/20'
                              : `${tagCfg.bg} ${tagCfg.color} ${tagCfg.border}`
                              }`}>
                              <i className={`fa-solid ${tagCfg.icon}`}></i>
                              {s.tag}
                            </span>
                          )}
                          <span className={`text-[8px] font-bold ${activeSessionId === s.id ? 'text-indigo-200' : 'text-slate-400'
                            }`}>{s.timestamp.split(' ')[0]}</span>
                        </div>
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessions(prev => prev.map(x => x.id === s.id ? { ...x, pinned: !x.pinned } : x)); }}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${s.pinned
                          ? 'bg-amber-400 text-white'
                          : 'bg-slate-100 text-slate-400 hover:bg-amber-400 hover:text-white'
                          }`}
                        title={s.pinned ? '取消置顶' : '置顶'}
                      >
                        <i className="fa-solid fa-thumbtack text-[7px]"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSessionToDelete(s.id); }}
                        className="w-5 h-5 rounded-md bg-slate-100 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                      >
                        <i className="fa-solid fa-trash-can text-[7px]"></i>
                      </button>
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {pinned.length > 0 && (
                    <>
                      <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest px-1 pt-1 flex items-center gap-1">
                        <i className="fa-solid fa-thumbtack text-[7px]"></i> 已置顶
                      </p>
                      {pinned.map(renderSession)}
                      {unpinned.length > 0 && <div className="h-px bg-slate-100 my-1"></div>}
                    </>
                  )}
                  {unpinned.length > 0 && unpinned.map(renderSession)}
                  {filtered.length === 0 && (
                    <div className="text-center py-8">
                      <i className="fa-solid fa-inbox text-slate-200 text-2xl"></i>
                      <p className="text-[9px] text-slate-400 mt-2 font-bold">没有匹配的对话</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Source Selector */}
        <div className={`p-5 bg-white/80 backdrop-blur-xl rounded-2xl border ${isLight ? 'border-slate-200' : 'border-white/5 bg-slate-900/50'} space-y-4`}>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">对话模式</h4>
          <div className="grid grid-cols-1 gap-2">
            {[
              { id: 'global', label: '全网对话', icon: 'fa-globe', color: 'text-blue-500' },
              { id: 'project', label: '项目流对标', icon: 'fa-vial', color: 'text-indigo-500' },
              { id: 'debate', label: '专家团辩论', icon: 'fa-users-between-lines', color: 'text-amber-500' }
            ].map(src => (
              <button key={src.id} onClick={() => { setKnowledgeSource(src.id as any); if (src.id === 'debate' && activeSession?.mode !== 'debate') handleCreateNewDebate(); }} className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${knowledgeSource === src.id ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-slate-50 border-transparent grayscale hover:grayscale-0 hover:border-slate-200'}`}>
                <i className={`fa-solid ${src.icon} ${src.color}`}></i>
                <span className="text-[10px] font-black text-slate-700 uppercase">{src.label}</span>
              </button>
            ))}
          </div>

          {/* 数据上下文注入 */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 flex items-center gap-2">
              <i className="fa-solid fa-database text-[8px]"></i> 数据上下文
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: 'inventory', label: '实验室资产', icon: 'fa-box-archive', color: 'bg-emerald-500', count: inventory.length },
                { id: 'literature', label: '情报档案', icon: 'fa-book-journal-whills', color: 'bg-blue-500', count: resources.length },
                { id: 'team', label: '团队成员', icon: 'fa-user-group', color: 'bg-purple-500', count: teamMembers.length },
                { id: 'projects', label: '项目概览', icon: 'fa-diagram-project', color: 'bg-orange-500', count: projects.length },
                { id: 'doe', label: 'DOE实验', icon: 'fa-flask-vial', color: 'bg-rose-500', count: doeSession?.history?.length || 0 },
                { id: 'mechanism', label: '机理分析', icon: 'fa-atom', color: 'bg-cyan-500', count: mechanismSession?.analysisResult ? 1 : 0 },
                { id: 'flowchart', label: '工艺流程', icon: 'fa-sitemap', color: 'bg-amber-500', count: flowchartSession?.currentFlowchart?.steps?.length || 0 },
                { id: 'dataAnalysis', label: '数据图表', icon: 'fa-chart-line', color: 'bg-indigo-500', count: dataAnalysisSession?.seriesList?.length || 0 },
              ].map(src => (
                <button
                  key={src.id}
                  onClick={() => toggleDataSource(src.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left group ${dataSources.has(src.id)
                    ? 'bg-slate-900 border-slate-700 shadow-lg'
                    : 'bg-slate-50 border-transparent hover:border-slate-200 hover:bg-white'
                    }`}
                >
                  <div className={`w-6 h-6 rounded-lg ${dataSources.has(src.id) ? src.color : 'bg-slate-200'} flex items-center justify-center transition-all shadow-sm`}>
                    <i className={`fa-solid ${src.icon} text-[9px] ${dataSources.has(src.id) ? 'text-white' : 'text-slate-400'}`}></i>
                  </div>
                  <span className={`text-[10px] font-black flex-1 ${dataSources.has(src.id) ? 'text-white' : 'text-slate-500'}`}>{src.label}</span>
                  {src.count > 0 && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${dataSources.has(src.id) ? 'bg-white/20 text-white/80' : 'bg-slate-100 text-slate-400'
                      }`}>{src.count}</span>
                  )}
                  {dataSources.has(src.id) && (
                    <i className="fa-solid fa-circle-check text-[10px] text-emerald-400"></i>
                  )}
                </button>
              ))}
            </div>
            {dataSources.size > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[8px] font-bold text-emerald-600 flex items-center gap-1">
                  <i className="fa-solid fa-plug-circle-check text-[7px]"></i>
                  已固定 {dataSources.size} 个数据源
                </p>
                <button onClick={() => setDataSources(new Set())} className="text-[8px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase">
                  清除全部
                </button>
              </div>
            )}
            <div className="mt-3 p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
              <p className="text-[8px] font-bold text-indigo-400 leading-relaxed flex items-start gap-1.5">
                <i className="fa-solid fa-wand-magic-sparkles text-[7px] mt-0.5 shrink-0"></i>
                <span>🧠 <strong>自动感知已启用</strong>：AI 会根据您的提问自动读取相关模块数据，无需手动勾选。手动勾选可强制固定。</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative">
        {activeSession?.mode === 'debate' ? (
          <DebateView
            session={activeSession}
            onUpdateSession={(updates) => handleUpdateSession(activeSession.id, updates)}
            personas={DEBATE_PERSONAS}
            isLight={isLight}
            projectContext={activeProject ? `Project: ${activeProject.title}. Description: ${activeProject.description}` : "General Context"}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                {returnPath ? (
                  <button onClick={handleBack} className="bg-amber-500 text-slate-900 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-white transition-all flex items-center gap-2 animate-bounce-subtle shrink-0">
                    <i className="fa-solid fa-arrow-left-long"></i> 返回虚拟室
                  </button>
                ) : (
                  <button onClick={() => setShowHistory(!showHistory)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-indigo-600 transition-all flex items-center justify-center">
                    <i className={`fa-solid ${showHistory ? 'fa-indent' : 'fa-outdent'}`}></i>
                  </button>
                )}
                <div>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter leading-none">SciFlow AI 助理 <span className="text-indigo-400 font-mono text-[10px] ml-1">v4.0</span></h3>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2rem] mt-1.5">Expert-Level Research Support</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] font-black uppercase text-indigo-200">
                    {activeProject ? activeProject.title.substring(0, 15) + '...' : 'General Mode'}
                  </span>
                </div>
                <button
                  onClick={() => setShowMessageSearch(!showMessageSearch)}
                  className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${showMessageSearch
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  title="搜索对话内容 (Ctrl+F)"
                >
                  <i className="fa-solid fa-magnifying-glass"></i>
                </button>
                <button onClick={() => {
                  if (activeSession) saveAs(new Blob([JSON.stringify(activeSession, null, 2)], { type: 'application/json' }), `Chat_${activeSession.title}.json`);
                }} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center"><i className="fa-solid fa-download"></i></button>
              </div>
            </header>

            {/* Search Bar for Messages */}
            {showMessageSearch && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 ring-2 ring-amber-300 shadow-inner">
                  <i className="fa-solid fa-magnifying-glass text-amber-500 text-sm"></i>
                  <input
                    type="text"
                    value={messageSearch}
                    onChange={e => setMessageSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) {
                          goToPreviousMatch();
                        } else {
                          goToNextMatch();
                        }
                      }
                    }}
                    placeholder="搜索对话内容..."
                    className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-amber-400/60"
                    autoFocus
                  />
                  {messageSearch && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-600 font-mono font-bold">
                        {matchIndices.length > 0 ? `${currentMatchIndex + 1} / ${matchIndices.length}` : '0 / 0'}
                      </span>
                      <div className="flex items-center gap-1 border-l border-amber-200 pl-2">
                        <button
                          onClick={goToPreviousMatch}
                          disabled={matchIndices.length === 0}
                          className="w-7 h-7 rounded-lg hover:bg-amber-100 flex items-center justify-center transition-colors text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上一个 (Shift+Enter)"
                        >
                          <i className="fa-solid fa-chevron-up text-xs"></i>
                        </button>
                        <button
                          onClick={goToNextMatch}
                          disabled={matchIndices.length === 0}
                          className="w-7 h-7 rounded-lg hover:bg-amber-100 flex items-center justify-center transition-colors text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="下一个 (Enter)"
                        >
                          <i className="fa-solid fa-chevron-down text-xs"></i>
                        </button>
                      </div>
                      <button
                        onClick={() => setMessageSearch('')}
                        className="w-6 h-6 rounded-full hover:bg-amber-100 flex items-center justify-center transition-colors text-amber-500"
                        title="清除搜索"
                      >
                        <i className="fa-solid fa-times text-xs"></i>
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setShowMessageSearch(false);
                      setMessageSearch('');
                    }}
                    className="text-[9px] text-amber-600 hover:text-amber-800 transition-colors uppercase tracking-wider font-bold px-2 py-1 hover:bg-amber-100 rounded-lg"
                  >
                    ESC
                  </button>
                </div>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/20 custom-scrollbar">
              {messageSearch && filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-amber-100 border-2 border-amber-200 flex items-center justify-center">
                    <i className="fa-solid fa-search text-3xl text-amber-400"></i>
                  </div>
                  <p className="text-slate-500 text-sm font-bold">未找到匹配 "{messageSearch}" 的消息</p>
                  <button
                    onClick={() => setMessageSearch('')}
                    className="px-4 py-2 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all font-bold"
                  >
                    清除搜索
                  </button>
                </div>
              ) : (
                (activeSession?.messages || []).map((msg, i) => {
                  if (messageSearch && !matchIndices.includes(i)) return null;

                  return (
                    <div
                      key={i}
                      data-message-index={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-reveal group/msg ${messageSearch && matchIndices[currentMatchIndex] === i
                        ? 'ring-4 ring-amber-400/50 rounded-3xl p-2 bg-amber-50/30 transition-all duration-300'
                        : ''
                        }`}
                    >
                      <div className={`relative max-w-[85%] lg:max-w-[75%] p-5 rounded-2xl shadow-sm ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100'
                        : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                        }`}>
                        {msg.role === 'model' ? (
                          <div className="markdown-body text-[13px] leading-relaxed">
                            {messageSearch ? (
                              <div dangerouslySetInnerHTML={{ __html: highlightText(msg.text, messageSearch, i) }} />
                            ) : (
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            )}
                          </div>
                        ) : (
                          <>
                            {msg.images && msg.images.length > 0 && (
                              <div className="flex gap-2 mb-3 flex-wrap">
                                {msg.images.map((imgUrl, idx) => (
                                  <img key={idx} src={imgUrl} className="w-28 h-28 object-cover rounded-xl border-2 border-white/30 shadow-md" alt={`附件 ${idx + 1}`} />
                                ))}
                              </div>
                            )}
                            {messageSearch ? (
                              <div
                                className="text-sm font-medium whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: highlightText(msg.text, messageSearch, i) }}
                              />
                            ) : (
                              <p className="text-sm font-medium whitespace-pre-wrap">{msg.text}</p>
                            )}
                          </>
                        )}
                        <div className={`absolute bottom-[-1.5rem] ${msg.role === 'user' ? 'right-2' : 'left-2'} text-[8px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2`}>
                          {msg.timestamp} {msg.role === 'model' && '· Verified AI Response'}
                          <button
                            onClick={() => setMessageToDelete({ sessionId: activeSession!.id, index: i })}
                            className="opacity-0 group-hover/msg:opacity-100 transition-all w-5 h-5 rounded-md bg-rose-50 hover:bg-rose-500 text-rose-400 hover:text-white flex items-center justify-center"
                            title="删除此消息"
                          >
                            <i className="fa-solid fa-trash-can text-[7px]"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isLoading && (
                <div className="flex justify-start animate-pulse">
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正在解析多维科研数据...</span>
                    </div>
                    {autoDetectedSources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-[8px] font-bold text-indigo-400 mr-1">🧠 自动感知:</span>
                        {autoDetectedSources.map(src => {
                          const labelMap: Record<string, string> = {
                            inventory: '实验室资产', literature: '情报档案', team: '团队成员',
                            projects: '项目概览', doe: 'DOE实验', mechanism: '机理分析',
                            flowchart: '工艺流程', dataAnalysis: '数据图表'
                          };
                          return (
                            <span key={src} className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md border border-indigo-100">
                              {labelMap[src] || src}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <footer className="px-6 py-3 bg-white border-t border-slate-100">
              {attachments.length > 0 && (
                <div className="flex gap-2 mb-4 animate-reveal overflow-x-auto pb-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="group relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-lg shrink-0">
                      <img src={file.url} className="w-full h-full object-cover" />
                      <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-times text-[10px]"></i></button>
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:bg-indigo-50 transition-all shrink-0">
                    <i className="fa-solid fa-plus mb-1"></i>
                    <span className="text-[8px] font-black uppercase">Add Image</span>
                  </button>
                </div>
              )}

              <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 shadow-inner focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center shadow-sm shrink-0">
                  <i className="fa-solid fa-paperclip text-lg"></i>
                </button>
                <input type="file" alt="upload" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

                <button
                  onClick={() => setUseWebSearch(!useWebSearch)}
                  className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-sm shrink-0 ${useWebSearch
                    ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-200'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300'
                    }`}
                  title={useWebSearch ? '联网搜索已开启（会增加响应时间）' : '点击开启联网搜索'}
                >
                  <i className="fa-solid fa-globe text-sm"></i>
                </button>

                <textarea
                  ref={textareaRef}
                  className="flex-1 bg-transparent border-none p-3 text-sm font-medium outline-none resize-none max-h-40 min-h-[48px] custom-scrollbar"
                  placeholder={useWebSearch ? '联网搜索模式 · 回复较慢但可获取最新信息...' : '向 AI 助理询问机理、分析趋势或识别图谱...'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />

                <button
                  onClick={() => handleSend()}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-xl hover:bg-black transition-all active:scale-90 disabled:opacity-30 flex items-center justify-center shrink-0"
                >
                  <i className="fa-solid fa-paper-plane text-lg"></i>
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>

      {sessionToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-8 animate-reveal shadow-2xl text-center border-2 border-slate-100">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner"><i className="fa-solid fa-trash-can"></i></div>
            <h3 className="text-lg font-black text-slate-800 mb-2 uppercase italic tracking-tighter">删除会话历史？</h3>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-8 italic">此操作将永久移除当前对话上下文及其关联的临时分析数据。</p>
            <div className="flex gap-4">
              <button onClick={() => setSessionToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase">取消</button>
              <button onClick={() => {
                setSessions(sessions.filter(s => s.id !== sessionToDelete));
                if (activeSessionId === sessionToDelete) setActiveSessionId(sessions[0]?.id || '');
                setSessionToDelete(null);
              }} className="flex-1 py-3 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-rose-100 active:scale-95">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {messageToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-8 animate-reveal shadow-2xl text-center border-2 border-slate-100">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner"><i className="fa-solid fa-eraser"></i></div>
            <h3 className="text-lg font-black text-slate-800 mb-2 uppercase italic tracking-tighter">删除这条消息？</h3>
            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-8 italic">此消息将从当前对话中永久移除。</p>
            <div className="flex gap-4">
              <button onClick={() => setMessageToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase">取消</button>
              <button onClick={() => {
                setSessions(prev => prev.map(s => {
                  if (s.id === messageToDelete.sessionId) {
                    const newMessages = [...s.messages];
                    newMessages.splice(messageToDelete.index, 1);
                    return { ...s, messages: newMessages };
                  }
                  return s;
                }));
                setMessageToDelete(null);
              }} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-orange-100 active:scale-95">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;