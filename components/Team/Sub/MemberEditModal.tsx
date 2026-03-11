
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserProfile, ExpertiseScore, ScientificTemperament, AvailabilityStatus } from '../../../types';
import CharacterIcon from './CharacterIcon';
import EducationBadge from './EducationBadge';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

interface MemberEditModalProps {
    member: UserProfile;
    onClose: () => void;
    onSave: (member: UserProfile) => void;
    avatarOptions: string[]; // 兼容旧接口
    commonEquipment: string[];
}

const DEPARTMENTS = [
    '新能源所',
    '金属所',
    '选矿所',
    '冶金所',
    '环保所',
    '其他'
];

const RESEARCH_GROUPS = [
    '技术前瞻组',
    '二次电池组',
    '氢能电解水组',
    '燃料电池组',
    '其他'
];

// 扩展后的性别化头像配置 (总计40种：20男20女)
const GENDERED_AVATARS = {
    Male: [
        'Luo', 'James', 'Jasper', 'Leo', 'Felix', 'John', 'Victor', 'George', 'Oliver', 'Jack',
        'Arthur', 'Dylan', 'Caleb', 'Ethan', 'Ryan', 'Mason', 'Lucas', 'Logan', 'Nolan', 'Julian'
    ],
    Female: [
        'Sarah', 'Aria', 'Lily', 'Nova', 'Mia', 'Zoe', 'Maya', 'Anna', 'Elena', 'Iris',
        'Chloe', 'Ruby', 'Luna', 'Stella', 'Hazel', 'Bella', 'Lucy', 'Daisy', 'Cora', 'Jade'
    ]
};

// 自定义可输入下拉组件
const CustomCombobox: React.FC<{
    label: string;
    value: string;
    options: string[];
    onChange: (val: string) => void;
    placeholder: string;
}> = ({ label, value, options, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
        if (!value) return options;
        return options.filter(opt => opt.toLowerCase().includes(value.toLowerCase()));
    }, [options, value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">{label}</label>
            <div className="relative group">
                <input
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm pr-8"
                    value={value}
                    onChange={e => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-500 transition-colors"
                >
                    <i className={`fa-solid fa-chevron-down text-[9px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}></i>
                </button>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden animate-reveal py-1">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-[10px] font-bold transition-colors flex items-center justify-between group ${value === opt ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <span>{opt}</span>
                                    {value === opt && <i className="fa-solid fa-check text-[8px]"></i>}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-3 text-[9px] text-slate-400 italic">
                                按回车使用自定义内容
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const MemberEditModal: React.FC<MemberEditModalProps> = ({
    member: initialMember, onClose, onSave, commonEquipment
}) => {
    const [editingMember, setEditingMember] = useState<UserProfile>({
        ...initialMember,
        gender: initialMember.gender || 'Male'
    });
    const [isEquipmentExpanded, setIsEquipmentExpanded] = useState(false);
    const [equipmentSearch, setEquipmentSearch] = useState('');
    const [manualMasteryName, setManualMasteryName] = useState('');

    // 根据当前性别过滤头像，现在返回对应性别的多种选择，并混合多样化的开心和苦闷/严肃的表情参数
    const currentGenderAvatars = useMemo(() => {
        const gender = editingMember.gender || 'Male';

        const happyMouths = ['smile', 'twinkle', 'default'];
        const happyEyes = ['happy', 'wink', 'default'];

        const sadMouths = ['sad', 'serious', 'grimace', 'default'];
        const sadEyes = ['cry', 'squint', 'default'];

        const maleTops = ['shortFlat', 'shortRound', 'shortWaved', 'frizzle', 'dreads01', 'theCaesar', 'theCaesarAndSidePart', 'dreads02', 'shaggy', 'shortCurly'];
        const femaleTops = ['straight01', 'straight02', 'curly', 'curvy', 'dreads', 'frida', 'fro', 'miaWallace', 'longButNotTooLong', 'bob', 'straightAndStrand'];

        return GENDERED_AVATARS[gender].map((seed, idx) => {
            const isHappy = idx % 2 === 0;
            const seedIdx = Math.floor(idx / 2);

            let mouth, eyes;
            if (isHappy) {
                mouth = happyMouths[seedIdx % happyMouths.length];
                eyes = happyEyes[seedIdx % happyEyes.length];
            } else {
                mouth = sadMouths[seedIdx % sadMouths.length];
                eyes = sadEyes[seedIdx % sadEyes.length];
            }

            let genderParams = '';
            if (gender === 'Male') {
                const top = maleTops[seedIdx % maleTops.length];
                const hasFacialHair = seedIdx % 3 === 0;
                genderParams = `&top=${top}&facialHairProbability=${hasFacialHair ? 100 : 0}`;
            } else {
                const top = femaleTops[seedIdx % femaleTops.length];
                genderParams = `&top=${top}&facialHairProbability=0`;
            }

            return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&mouth=${mouth}&eyes=${eyes}${genderParams}`;
        });
    }, [editingMember.gender]);

    const handleEditMetric = (subject: string, value: number) => {
        const nextMetrics = (editingMember.expertiseMetrics || []).map(m =>
            m.subject === subject ? { ...m, A: value } : m
        );
        setEditingMember({ ...editingMember, expertiseMetrics: nextMetrics });
    };

    const handleAddMastery = (name: string) => {
        const currentMastery = editingMember.mastery || [];
        if (currentMastery.some(m => m.name === name)) return;
        setEditingMember({
            ...editingMember,
            mastery: [...currentMastery, { name, level: 1 }]
        });
    };

    const handleManualAddMastery = () => {
        if (!manualMasteryName.trim()) return;
        handleAddMastery(manualMasteryName.trim());
        setManualMasteryName('');
    };

    const getMasteryColor = (level: number) => {
        if (level === 10) return 'bg-indigo-600 border-indigo-700';
        if (level >= 8) return 'bg-sky-500 border-sky-600';
        if (level >= 6) return 'bg-emerald-500 border-emerald-600';
        return 'bg-amber-500 border-amber-600';
    };

    const filteredCommonEquipment = useMemo(() => {
        if (!equipmentSearch.trim()) return commonEquipment;
        const q = equipmentSearch.toLowerCase();
        return commonEquipment.filter(name => name.toLowerCase().includes(q));
    }, [commonEquipment, equipmentSearch]);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3rem] p-8 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[95vh] overflow-hidden">
                <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all active:scale-90 z-10">
                    <i className="fa-solid fa-times text-xl"></i>
                </button>

                <header className="mb-6 border-l-8 border-indigo-600 pl-6 shrink-0 flex flex-col justify-center">
                    <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">研究员核心档案修订</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-0.5 tracking-widest">PERSONNEL ID: {editingMember.id}</p>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* 左栏：身份信息 (Left Column) */}
                        <div className="lg:col-span-4 flex flex-col gap-6">

                            {/* Visual Identity Card */}
                            <div className="bg-slate-50/50 rounded-[2.5rem] p-6 border border-slate-200 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-50 to-transparent pointer-events-none"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl bg-white mb-5 relative group/avatar">
                                        <img src={editingMember.avatar} className="w-full h-full object-cover" alt="Selected" />
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/avatar:opacity-100 transition-opacity"></div>
                                    </div>

                                    {/* Gender Selection */}
                                    <div className="w-full mb-4 space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block px-2">性别 (GENDER)</label>
                                        <div className="flex bg-white rounded-2xl p-1 border border-slate-200 shadow-sm">
                                            <button
                                                onClick={() => setEditingMember({ ...editingMember, gender: 'Male' })}
                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${editingMember.gender === 'Male' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                <i className="fa-solid fa-mars text-[12px]"></i> 男性
                                            </button>
                                            <button
                                                onClick={() => setEditingMember({ ...editingMember, gender: 'Female' })}
                                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${editingMember.gender === 'Female' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                <i className="fa-solid fa-venus text-[12px]"></i> 女性
                                            </button>
                                        </div>
                                    </div>

                                    {/* Filtered Avatar Grid - Scrollable 2 rows */}
                                    <div className="w-full mb-6">
                                        <div className="flex justify-center items-center gap-2 mb-3">
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2rem]">选择化身 ({editingMember.gender === 'Male' ? '男性库' : '女性库'})</p>
                                            <button
                                                title="随机生成头像"
                                                onClick={() => {
                                                    const randomUrl = currentGenderAvatars[Math.floor(Math.random() * currentGenderAvatars.length)];
                                                    setEditingMember({ ...editingMember, avatar: randomUrl });
                                                }}
                                                className="w-5 h-5 rounded-md bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all flex items-center justify-center active:scale-90"
                                            >
                                                <i className="fa-solid fa-dice text-[10px]"></i>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-5 gap-2 w-full max-h-[100px] overflow-y-auto custom-scrollbar pr-1 pb-1">
                                            {currentGenderAvatars.map((url, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setEditingMember({ ...editingMember, avatar: url })}
                                                    className={`w-full aspect-square rounded-xl border-2 transition-all overflow-hidden shadow-sm hover:scale-110 active:scale-95 ${editingMember.avatar === url ? 'border-indigo-600 ring-2 ring-indigo-100 scale-110 z-10' : 'border-white bg-white opacity-60 hover:opacity-100'}`}
                                                >
                                                    <img src={url} className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Availability Status Selector */}
                                    <div className="w-full mb-4 space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase block px-2">实时出勤状态</label>
                                        <div className="flex bg-white rounded-2xl p-1 border border-slate-200 shadow-sm">
                                            {(['Available', 'Busy', 'On Leave'] as AvailabilityStatus[]).map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => setEditingMember({ ...editingMember, availabilityStatus: s })}
                                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${editingMember.availabilityStatus === s
                                                        ? (s === 'Available' ? 'bg-emerald-600 text-white shadow-md' : s === 'Busy' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-600 text-white shadow-md')
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {s === 'Available' ? '空闲' : s === 'Busy' ? '忙碌' : '请假'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Temperament Selector */}
                                    <div className="w-full bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center gap-2 px-2 py-1">
                                            <div className="shrink-0">
                                                <CharacterIcon type={editingMember.scientificTemperament} size="sm" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[9px] font-black text-slate-800 uppercase leading-none">科研性格 (TEMPERAMENT)</p>
                                                <p className="text-[7px] text-slate-400 uppercase mt-0.5 font-bold">Identity Profile & Role Logic</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            {[
                                                { id: 'Explorer', label: '探索者', desc: '新方向/新奇度' },
                                                { id: 'Optimizer', label: '优化师', desc: '精度/工艺效率' },
                                                { id: 'Skeptic', label: '批判者', desc: '严谨度/审计' }
                                            ].map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => setEditingMember({ ...editingMember, scientificTemperament: t.id as ScientificTemperament })}
                                                    className={`py-2 rounded-lg transition-all flex flex-col items-center ${editingMember.scientificTemperament === t.id ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                                >
                                                    <span className="text-[8px] font-black uppercase">{t.label}</span>
                                                    <span className="text-[6px] opacity-60 mt-0.5">{t.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info Form */}
                            <div className="space-y-4 px-1">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">全名 (FULL NAME)</label>
                                        <input
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-sm font-black text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
                                            value={editingMember.name}
                                            onChange={e => setEditingMember({ ...editingMember, name: e.target.value })}
                                            placeholder="输入姓名"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">职称 (ROLE)</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm"
                                                value={editingMember.role}
                                                onChange={e => setEditingMember({ ...editingMember, role: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">密级 (LEVEL)</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm appearance-none cursor-pointer"
                                                    value={editingMember.securityLevel}
                                                    onChange={e => setEditingMember({ ...editingMember, securityLevel: e.target.value as any })}
                                                >
                                                    {['公开', '内部', '秘密', '机密', '绝密'].map(l => <option key={l} value={l}>{l}</option>)}
                                                </select>
                                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">机构 (INSTITUTION)</label>
                                            <input className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:border-indigo-400 transition-all shadow-sm" value={editingMember.institution} onChange={e => setEditingMember({ ...editingMember, institution: e.target.value })} placeholder="机构名称" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <CustomCombobox
                                                label="部门 (DEPT)"
                                                value={editingMember.department}
                                                options={DEPARTMENTS}
                                                placeholder="输入或选择..."
                                                onChange={(val) => setEditingMember({ ...editingMember, department: val })}
                                            />
                                            <CustomCombobox
                                                label="研究组 (GROUP)"
                                                value={editingMember.projectGroup}
                                                options={RESEARCH_GROUPS}
                                                placeholder="输入或选择..."
                                                onChange={(val) => setEditingMember({ ...editingMember, projectGroup: val })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">最高学历 (CREDENTIAL)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['博士后', '博士', '硕士', '本科'].map(edu => (
                                                <div
                                                    key={edu}
                                                    onClick={() => setEditingMember({ ...editingMember, education: edu })}
                                                    className={`cursor-pointer transition-all active:scale-95 ${editingMember.education !== edu ? 'opacity-40 grayscale hover:opacity-100' : 'ring-2 ring-indigo-100 rounded-lg'}`}
                                                >
                                                    <EducationBadge level={edu} className="w-full justify-center" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-2">研究领域 (FOCUS)</label>
                                        <textarea
                                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm h-24 resize-none leading-relaxed custom-scrollbar"
                                            value={editingMember.researchArea}
                                            onChange={e => setEditingMember({ ...editingMember, researchArea: e.target.value })}
                                            placeholder="描述主要研究方向与专长..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 右栏：能力基因与设备 (Right Column) */}
                        <div className="lg:col-span-8 flex flex-col gap-6">

                            {/* 1. 核心能力权重 (SKILL DNA) */}
                            <div className="bg-white p-6 lg:p-8 rounded-[3rem] shadow-sm border border-slate-200 relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
                                <div className="flex-1 w-full space-y-4">
                                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2rem] mb-4 flex items-center gap-2 border-b border-indigo-50 pb-2">
                                        <i className="fa-solid fa-sliders"></i> 核心能力权重 (SKILL MATRIX)
                                    </h4>
                                    {editingMember.expertiseMetrics?.map((m) => (
                                        <div key={m.subject} className="space-y-1">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-wide">{m.subject}</span>
                                                <span className="text-[11px] font-black text-indigo-600 font-mono bg-indigo-50 px-1.5 rounded">{m.A.toFixed(0)}%</span>
                                            </div>
                                            <input type="range" min="0" max="100" className="w-full accent-indigo-500 h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer" value={m.A} onChange={(e) => handleEditMetric(m.subject, parseInt(e.target.value))} />
                                        </div>
                                    ))}
                                </div>
                                <div className="w-full md:w-72 aspect-square bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-center p-4 relative shadow-inner">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={editingMember.expertiseMetrics}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: '800' }} />
                                            <Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                    <div className="absolute bottom-4 right-6 text-[8px] font-black text-indigo-200 uppercase tracking-widest pointer-events-none">Capability Radar</div>
                                </div>
                            </div>

                            {/* 2. 心理与协同评估 (PSYCHOMETRICS) */}
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2rem] mb-6 flex items-center gap-2 italic">
                                    <i className="fa-solid fa-brain text-violet-500"></i> 科研心理与协同评估 (PSYCHOMETRICS)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-2">
                                    {[
                                        { key: 'resilienceIndex', label: '抗压韧性 (RESIL)', color: 'accent-emerald-500', bar: 'bg-emerald-500' },
                                        { key: 'synergyIndex', label: '协作协同率 (SYNGR)', color: 'accent-indigo-500', bar: 'bg-indigo-500' },
                                        { key: 'qcConsistency', label: '操作严谨度 (RIGOR)', color: 'accent-amber-500', bar: 'bg-amber-500' },
                                    ].map(idx => (
                                        <div key={idx.key} className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] font-black text-slate-500 uppercase">{idx.label}</span>
                                                <span className="text-[11px] font-black text-slate-800 font-mono">{(editingMember as any)[idx.key] || 0}%</span>
                                            </div>
                                            <input
                                                type="range" min="0" max="100"
                                                className={`w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer ${idx.color}`}
                                                value={(editingMember as any)[idx.key] || 0}
                                                onChange={e => setEditingMember({ ...editingMember, [idx.key]: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3. 设备操控等级认证 (MASTERY) */}
                            <div className="flex-1 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 shadow-inner flex flex-col min-h-0">
                                <div className="flex justify-between items-center mb-4 shrink-0">
                                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2rem] flex items-center gap-2 italic">
                                        <i className="fa-solid fa-microscope text-indigo-600"></i> 设备操控等级认证 (MASTERY)
                                    </h4>
                                    <button onClick={() => setIsEquipmentExpanded(!isEquipmentExpanded)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all border ${isEquipmentExpanded ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200'}`}>
                                        {isEquipmentExpanded ? '收起标准库' : '展开标准库'}
                                    </button>
                                </div>

                                {isEquipmentExpanded && (
                                    <div className="flex flex-col gap-3 animate-reveal p-4 rounded-2xl bg-white border border-indigo-100 mb-4 shadow-sm shrink-0">
                                        <div className="relative group">
                                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]"></i>
                                            <input
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold outline-none focus:bg-white focus:border-indigo-300 transition-all"
                                                placeholder="搜索标准设备库..."
                                                value={equipmentSearch}
                                                onChange={e => setEquipmentSearch(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                            {filteredCommonEquipment.map(name => (
                                                <button key={name} onClick={() => handleAddMastery(name)} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all active:scale-95">{name}</button>
                                            ))}
                                            {filteredCommonEquipment.length === 0 && (
                                                <p className="text-[10px] text-slate-400 italic py-2 px-1">未找到匹配设备</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 mb-4 shrink-0">
                                    <input
                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm"
                                        placeholder="手动输入设备或技能名称，如: 磁控溅射..."
                                        value={manualMasteryName}
                                        onChange={e => setManualMasteryName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleManualAddMastery()}
                                    />
                                    <button
                                        onClick={handleManualAddMastery}
                                        disabled={!manualMasteryName.trim()}
                                        className="px-5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <i className="fa-solid fa-plus"></i>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto custom-scrollbar pr-2 pb-2">
                                    {editingMember.mastery?.map((m, idx) => (
                                        <div key={idx} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm group/item hover:border-indigo-200 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-black text-slate-700 uppercase italic truncate max-w-[150px]">{m.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-mono font-bold text-indigo-500 bg-indigo-50 px-1.5 rounded">Lv.{m.level}</span>
                                                    <button onClick={() => setEditingMember({ ...editingMember, mastery: editingMember.mastery?.filter((_, i) => i !== idx) })} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-all p-0.5"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-[2px] h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                {Array.from({ length: 10 }).map((_, levelIdx) => (
                                                    <button
                                                        key={levelIdx}
                                                        onClick={() => {
                                                            const next = [...(editingMember.mastery || [])];
                                                            next[idx].level = levelIdx + 1;
                                                            setEditingMember({ ...editingMember, mastery: next });
                                                        }}
                                                        className={`flex-1 h-full transition-all hover:opacity-80 ${levelIdx < m.level ? getMasteryColor(m.level) : 'bg-transparent'}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {(!editingMember.mastery || editingMember.mastery.length === 0) && (
                                        <div className="col-span-2 text-center py-6 text-slate-300 italic text-[10px]">暂无认证技能</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="mt-0 shrink-0 flex gap-4 pt-6 border-t border-slate-100">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase transition-all hover:bg-slate-200">取消</button>
                    <button onClick={() => onSave(editingMember)} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-2xl hover:bg-black transition-all active:scale-95">确认并保存档案</button>
                </footer>
            </div>
        </div>
    );
};

export default MemberEditModal;
