
import React, { useState, useMemo } from 'react';

// ═══ GHS 级别的安全审计规则引擎 ═══
type RiskCategory = 'physical' | 'chemical' | 'health' | 'environmental' | 'equipment';

interface SafetyRisk {
  keyword: string;
  aliases?: string[];  // 同义词/英文
  level: 'critical' | 'warning' | 'caution';
  category: RiskCategory;
  instruction: string;
  ppe: string[];  // 推荐 PPE
  ghsCode?: string; // GHS分类编码
  emergencyAction?: string; // 紧急处置
}

const SAFETY_GUIDELINES: SafetyRisk[] = [
  // ── 高危化学品 (CRITICAL) ──
  { keyword: '浓硝酸', aliases: ['HNO3'], level: 'critical', category: 'chemical', ghsCode: 'GHS03/GHS05',
    instruction: '具有强腐蚀性与氧化性，需在通风橱内操作。禁止与有机物、还原剂混存。',
    ppe: ['防腐蚀手套', '护目镜', '面罩', '防酸围裙'],
    emergencyAction: '溅到皮肤立即用大量流水冲洗15分钟，送医。' },
  { keyword: '浓硫酸', aliases: ['H2SO4'], level: 'critical', category: 'chemical', ghsCode: 'GHS05',
    instruction: '具有极强脱水性与腐蚀性，稀释时严禁将水倒入酸中，必须酸入水。',
    ppe: ['防腐蚀手套', '护目镜', '防酸围裙'],
    emergencyAction: '灼伤后用大量水冲洗，不可涂抹碱性物质中和。' },
  { keyword: '氢氟酸', aliases: ['HF', '氟化氢'], level: 'critical', category: 'chemical', ghsCode: 'GHS06/GHS05',
    instruction: '极度危险！可渗透皮肤造成深层组织损伤。必须备有葡萄糖酸钙凝胶急救。',
    ppe: ['HF专用手套(双层)', '面罩', '防护服', '防毒面具'],
    emergencyAction: '接触后立即涂抹葡萄糖酸钙凝胶，同时拨打急救电话。' },
  { keyword: '氢气', aliases: ['H2', 'hydrogen'], level: 'critical', category: 'physical', ghsCode: 'GHS02',
    instruction: '易燃易爆气体(LEL 4%)，需在配有氢气报警器的防爆通风橱内操作。禁止产生火花。',
    ppe: ['防静电服', '护目镜'],
    emergencyAction: '泄漏时立即关闭气源、切断电源、打开强制通风。' },
  { keyword: '高压', aliases: ['高压反应', 'autoclave', '水热釜'], level: 'critical', category: 'equipment', ghsCode: 'GHS04',
    instruction: '必须在额定压力容器中进行，作业前检查泄压阀、安全阀及压力传感器校准记录。',
    ppe: ['防护面罩', '防爆手套'], 
    emergencyAction: '异常升压时立即启动紧急泄压，撤离至安全区域。' },
  { keyword: '剧毒', aliases: ['极毒', '致死', 'toxic'], level: 'critical', category: 'health', ghsCode: 'GHS06',
    instruction: '必须执行双人双锁领用制度，操作全程处于监控范围内，严禁单人操作。',
    ppe: ['防毒面具', '防化手套', '防护服'],
    emergencyAction: '中毒时保留样品信息，立即送医并提供 MSDS。' },
  { keyword: '光气', aliases: ['COCl2', 'phosgene'], level: 'critical', category: 'health', ghsCode: 'GHS06',
    instruction: '极度剧毒气体(LC50极低)，必须在全封闭系统中操作。配备在线气体检测。',
    ppe: ['正压式空气呼吸器', '全身防化服'],
    emergencyAction: '暴露后立刻撤离至上风向，给予吸氧并紧急送医。' },
  { keyword: '爆炸', aliases: ['explosive', '炸药', '雷酸'], level: 'critical', category: 'physical', ghsCode: 'GHS01',
    instruction: '涉及爆炸性物质，须遵守用量限制（<0.1g 研究量），全程使用防爆屏。',
    ppe: ['防爆手套', '防爆面罩', '防弹衣'],
    emergencyAction: '发生爆炸后首先确认人员安全，勿用水扑灭化学品火焰。' },
  { keyword: '放射', aliases: ['radioactive', '辐射', '同位素'], level: 'critical', category: 'health', ghsCode: 'GHS07',
    instruction: '须持有辐射安全许可，佩戴个人剂量计，遵守时间/距离/屏蔽三原则。',
    ppe: ['铅围裙', '辐射防护手套', '个人剂量计'],
    emergencyAction: '过量照射后立即记录剂量并报告辐射安全主管。' },

  // ── 中等风险 (WARNING) ──
  { keyword: '高温', aliases: ['加热', '煅烧', '退火', '热处理', 'calcination', 'anneal'], level: 'warning', category: 'equipment',
    instruction: '需确认控温设备精度，严防局部热失控。超过300°C建议使用循环油浴或管式炉。',
    ppe: ['隔热手套', '护目镜'],
    emergencyAction: '烫伤后冷水冲洗10-20分钟，严重者送医。' },
  { keyword: '还原剂', aliases: ['NaBH4', 'LiAlH4', '硼氢化钠', '水合肼', 'hydrazine'], level: 'warning', category: 'chemical',
    instruction: '部分还原剂具有易燃易爆性和遇水放热特性，操作区需杜绝明火及静电。',
    ppe: ['防护手套', '护目镜', '防静电服'],
    emergencyAction: '起火时使用干粉/CO2灭火器，禁用水。' },
  { keyword: '有机溶剂', aliases: ['DMF', 'DMSO', 'THF', 'NMP', '二氯甲烷', 'DCM', '氯仿', 'CHCl3'], level: 'warning', category: 'health',
    instruction: '多数有机溶剂具有挥发性和神经毒性，必须在通风橱内操作，控制暴露时间。',
    ppe: ['有机溶剂手套', '护目镜', '活性炭口罩'],
    emergencyAction: '大量吸入后转移至新鲜空气处，保持呼吸通畅。' },
  { keyword: '甲醇', aliases: ['CH3OH', 'methanol'], level: 'warning', category: 'health',
    instruction: '可经皮肤吸收，10mL 可致盲。需在通风橱或手套箱内操作。',
    ppe: ['化学手套', '护目镜'],
    emergencyAction: '误服后给予乙醇(白酒)作为竞争性解毒并紧急送医。' },
  { keyword: '乙醇', aliases: ['ethanol', 'C2H5OH'], level: 'caution', category: 'physical',
    instruction: '易燃液体(闪点13°C)，远离明火热源，存储量不宜过大。',
    ppe: ['防护手套', '护目镜'] },
  { keyword: '丙酮', aliases: ['acetone'], level: 'warning', category: 'physical',
    instruction: '极易挥发并产生静电，闪点-20°C。须抗静电操作。',
    ppe: ['防静电手套', '护目镜'],
    emergencyAction: '起火时用干粉或CO2灭火。' },
  { keyword: '搅拌', aliases: ['磁力搅拌', '机械搅拌', 'stirring'], level: 'caution', category: 'equipment',
    instruction: '机械搅拌时需固定稳妥，防止容器破损导致物料喷溅。高速搅拌需加防溅盖。',
    ppe: ['护目镜'] },
  { keyword: '离心', aliases: ['centrifuge', '离心机'], level: 'warning', category: 'equipment',
    instruction: '必须确保对称配平(偏差<0.5g)。运行时禁止打开盖子。异常振动立即停机。',
    ppe: ['护目镜', '防护面罩'],
    emergencyAction: '转子破裂时撤离区域，等待完全停止后处理。' },
  { keyword: '超声', aliases: ['ultrasonic', '超声波', '超声清洗'], level: 'caution', category: 'equipment',
    instruction: '长时间超声可能导致溶剂局部过热。使用易燃溶剂时应保持低温水浴。',
    ppe: ['护目镜', '耳塞(长时间)'] },
  { keyword: '氩气', aliases: ['Ar', '氮气', 'N2', '惰性气体'], level: 'caution', category: 'physical',
    instruction: '惰性气体可置换氧气导致窒息。密闭空间使用需确保通风和氧含量监测。',
    ppe: ['氧含量报警器'] },
  { keyword: '纳米', aliases: ['nanoparticle', '纳米粒子', '纳米材料'], level: 'warning', category: 'health',
    instruction: '纳米颗粒可深入肺泡，须在手套箱或带HEPA过滤的通风橱中操作。',
    ppe: ['N95/FFP2口罩', '手套', '护目镜'],
    emergencyAction: '大量吸入后送医检查肺功能。' },
  { keyword: '强碱', aliases: ['NaOH', 'KOH', '氢氧化钠', '氢氧化钾', '强碱溶液'], level: 'warning', category: 'chemical',
    instruction: '强腐蚀性，可严重灼伤皮肤和眼睛。需在通风橱内操作，缓慢溶解放热。',
    ppe: ['防腐蚀手套', '护目镜', '面罩'],
    emergencyAction: '溅到眼睛立即用大量流水冲洗15分钟。' },
  { keyword: '过氧化', aliases: ['H2O2', '双氧水', 'peroxide', '过氧化物'], level: 'warning', category: 'chemical',
    instruction: '强氧化剂，与还原剂混合可能剧烈反应。高浓度(>30%)有爆炸风险。',
    ppe: ['防护手套', '护目镜'],
    emergencyAction: '泄漏后用大量水稀释。' },
  { keyword: '电化学', aliases: ['electrochemistry', '电解', '电镀'], level: 'caution', category: 'equipment',
    instruction: '注意电极短路风险和电解液飞溅。高电流操作需防护。',
    ppe: ['绝缘手套', '护目镜'] },
  { keyword: '真空', aliases: ['vacuum', '真空泵', '减压'], level: 'caution', category: 'equipment',
    instruction: '玻璃器皿在真空条件下有爆裂风险。使用前检查裂纹，建议加防护网。',
    ppe: ['护目镜', '面罩'] },
];

const CATEGORY_META: Record<RiskCategory, { icon: string; label: string; color: string }> = {
  physical: { icon: 'fa-fire', label: '物理危害', color: 'text-orange-500' },
  chemical: { icon: 'fa-flask-vial', label: '化学危害', color: 'text-rose-500' },
  health: { icon: 'fa-heart-pulse', label: '健康危害', color: 'text-red-600' },
  environmental: { icon: 'fa-leaf', label: '环境危害', color: 'text-emerald-500' },
  equipment: { icon: 'fa-gear', label: '设备安全', color: 'text-indigo-500' },
};

interface SafetyDashboardProps {
  description: string;
}

export const SafetyDashboard: React.FC<SafetyDashboardProps> = ({ description }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<RiskCategory | 'all'>('all');

  const detectedRisks = useMemo(() => {
    if (!description.trim()) return [];
    return SAFETY_GUIDELINES.filter(rule => {
      const allKeywords = [rule.keyword, ...(rule.aliases || [])];
      return allKeywords.some(kw => new RegExp(kw, 'i').test(description));
    });
  }, [description]);

  const criticalCount = detectedRisks.filter(r => r.level === 'critical').length;
  const warningCount = detectedRisks.filter(r => r.level === 'warning').length;
  const cautionCount = detectedRisks.filter(r => r.level === 'caution').length;

  const filteredRisks = activeCategory === 'all'
    ? detectedRisks
    : detectedRisks.filter(r => r.category === activeCategory);

  // 收集所有涉及的 PPE
  const allPPE = useMemo(() => {
    const ppeSet = new Set<string>();
    detectedRisks.forEach(r => r.ppe?.forEach(p => ppeSet.add(p)));
    return Array.from(ppeSet);
  }, [detectedRisks]);

  const overallRiskLevel = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : cautionCount > 0 ? 'caution' : 'safe';
  const riskColors: Record<string, string> = {
    critical: 'bg-rose-50 border-rose-200',
    warning: 'bg-amber-50 border-amber-200',
    caution: 'bg-sky-50 border-sky-200',
    safe: 'bg-emerald-50 border-emerald-100',
  };
  const iconColors: Record<string, string> = {
    critical: 'bg-rose-500 text-white',
    warning: 'bg-amber-500 text-white',
    caution: 'bg-sky-500 text-white',
    safe: 'bg-emerald-500 text-white',
  };

  return (
    <div className="w-full shrink-0 border-t border-slate-200 bg-white px-6 py-2 z-30 no-print">
      <div className={`w-full transition-all duration-500 overflow-hidden px-4 py-1.5 rounded-lg border ${riskColors[overallRiskLevel]}`}>
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${iconColors[overallRiskLevel]} ${criticalCount > 0 ? 'animate-pulse' : ''}`}>
              <i className={`fa-solid ${criticalCount > 0 ? 'fa-shield-virus' : detectedRisks.length > 0 ? 'fa-shield-halved' : 'fa-shield-check'} text-[10px]`}></i>
            </div>
            <div className="flex items-center gap-3">
              <h4 className={`text-[10px] font-black uppercase tracking-[0.15rem] italic ${criticalCount > 0 ? 'text-rose-500' : detectedRisks.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                GHS 安全审计引擎
              </h4>
              <div className={`flex items-center gap-2 transition-opacity ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
                {criticalCount > 0 && <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[7px] font-black uppercase shadow-sm">{criticalCount} Critical</span>}
                {warningCount > 0 && <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[7px] font-black uppercase shadow-sm">{warningCount} Warning</span>}
                {cautionCount > 0 && <span className="px-1.5 py-0.5 bg-sky-500 text-white rounded text-[7px] font-black uppercase shadow-sm">{cautionCount} Caution</span>}
                {detectedRisks.length === 0 && <span className="text-[9px] font-bold text-emerald-600">✓ 环境合规扫描正常</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {detectedRisks.length > 0 && !isExpanded && (
              <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded text-[7px] font-black uppercase shadow-lg flex items-center gap-1">
                <i className="fa-solid fa-triangle-exclamation text-[6px]"></i>
                {detectedRisks.length} 项风险
              </span>
            )}
            <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'} text-slate-600 text-[8px] group-hover:text-slate-400 transition-colors`}></i>
          </div>
        </div>

        {isExpanded && (
          <div className="pt-3 pb-2 animate-reveal border-t border-black/5 mt-2 space-y-3">
            {/* PPE 推荐横条 */}
            {allPPE.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                <i className="fa-solid fa-user-shield text-indigo-500 text-[10px] shrink-0"></i>
                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest shrink-0">PPE 必备:</p>
                <div className="flex flex-wrap gap-1">
                  {allPPE.map((item, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[7px] font-bold text-indigo-700 shadow-sm">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 分类筛选 */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); setActiveCategory('all'); }}
                className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase transition-all ${activeCategory === 'all' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                全部 ({detectedRisks.length})
              </button>
              {Object.entries(CATEGORY_META).map(([key, meta]) => {
                const count = detectedRisks.filter(r => r.category === key).length;
                if (count === 0) return null;
                return (
                  <button key={key}
                    onClick={(e) => { e.stopPropagation(); setActiveCategory(key as RiskCategory); }}
                    className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase transition-all flex items-center gap-1 ${activeCategory === key ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    <i className={`fa-solid ${meta.icon} text-[6px]`}></i>
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* 风险卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto custom-scrollbar pr-2">
              {filteredRisks.length > 0 ? filteredRisks.map((risk, idx) => {
                const levelStyle = risk.level === 'critical'
                  ? 'border-l-rose-500 bg-white hover:border-rose-300'
                  : risk.level === 'warning'
                    ? 'border-l-amber-400 bg-white hover:border-amber-300'
                    : 'border-l-sky-400 bg-white hover:border-sky-300';
                const levelBadge = risk.level === 'critical'
                  ? 'bg-rose-600 text-white'
                  : risk.level === 'warning'
                    ? 'bg-amber-500 text-white'
                    : 'bg-sky-500 text-white';
                const catMeta = CATEGORY_META[risk.category];

                return (
                  <div key={idx} className={`p-3 rounded-xl border border-slate-200 border-l-4 ${levelStyle} transition-all shadow-sm hover:shadow-md group/card`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[6px] font-black px-1.5 py-0.5 rounded uppercase ${levelBadge}`}>
                          {risk.level}
                        </span>
                        <span className={`text-[7px] font-bold flex items-center gap-0.5 ${catMeta.color}`}>
                          <i className={`fa-solid ${catMeta.icon} text-[6px]`}></i> {catMeta.label}
                        </span>
                      </div>
                      {risk.ghsCode && (
                        <span className="text-[6px] font-mono font-bold text-slate-300">{risk.ghsCode}</span>
                      )}
                    </div>
                    <p className="text-[9px] font-black text-slate-800 mb-1 flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-exclamation text-[7px] text-rose-400"></i>
                      {risk.keyword}
                      {risk.aliases && risk.aliases.length > 0 && (
                        <span className="text-[7px] text-slate-400 font-normal">({risk.aliases.slice(0, 2).join(', ')})</span>
                      )}
                    </p>
                    <p className="text-[8px] font-medium text-slate-500 italic leading-relaxed">{risk.instruction}</p>
                    {risk.emergencyAction && (
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-100 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <p className="text-[7px] font-bold text-rose-500 flex items-center gap-1">
                          <i className="fa-solid fa-kit-medical text-[6px]"></i> 急救: {risk.emergencyAction}
                        </p>
                      </div>
                    )}
                  </div>
                );
              }) : (
                <p className="text-[9px] font-bold text-emerald-500 italic py-4 w-full col-span-full text-center flex items-center justify-center gap-2">
                  <i className="fa-solid fa-shield-check"></i>
                  当前工艺描述暂未触发预设安全风险报警。所有 {SAFETY_GUIDELINES.length} 条 GHS 规则检查通过。
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
