import React, { useState } from 'react';
import { useProjectContext } from '../../../context/ProjectContext';

type StencilCategory = 'Glassware' | 'Instruments' | 'Biology' | 'Atoms' | 'Materials';

interface StencilItem {
    id: string;
    name: string;
    icon: string;
    prompt: string;
    category: StencilCategory;
}

const STENCILS_DB: StencilItem[] = [
    // Glassware
    { id: 'g1', category: 'Glassware', name: '标准烧杯 (Beaker)', icon: 'fa-glass-water', prompt: 'Laboratory glass beaker with accurate measurement lines, professional lighting, photorealistic' },
    { id: 'g2', category: 'Glassware', name: '圆底烧瓶 (Flask)', icon: 'fa-flask', prompt: 'Round bottom boiling flask, technical scientific render, 3D Octane style' },
    { id: 'g3', category: 'Glassware', name: 'Schlenk 线', icon: 'fa-vials', prompt: 'Vacuum-gas manifold, Schlenk line setup, detailed scientific glassware architecture' },
    
    // Instruments
    { id: 'i1', category: 'Instruments', name: '手套箱 (Glovebox)', icon: 'fa-box-open', prompt: 'Inert atmosphere glovebox workstation, stainless steel finish, academic 3D illustration' },
    { id: 'i2', category: 'Instruments', name: '电化学工作站', icon: 'fa-bolt', prompt: 'Potentiostat, electrochemical analyzer workstation with wires and electrodes, clean flat style' },
    { id: 'i3', category: 'Instruments', name: '透射电镜 (TEM)', icon: 'fa-microscope', prompt: 'TEM transmission electron microscope column, industrial scientific equipment, gray scale tech style' },
    
    // Biology
    { id: 'b1', category: 'Biology', name: '脂质体 (Liposome)', icon: 'fa-circle-nodes', prompt: 'Liposome nanoparticle, bilayer structure, cross-section view, soft biological shading' },
    { id: 'b2', category: 'Biology', name: '双螺旋 (DNA)', icon: 'fa-dna', prompt: 'DNA double helix with major and minor grooves, colorful genetic visualization, 3D render' },
    { id: 'b3', category: 'Biology', name: '癌细胞 (Tumor)', icon: 'fa-virus', prompt: 'Scanning electron micrograph of a cancer cell with microvilli, highly detailed textures' },
    
    // Atoms & Materials
    { id: 'a1', category: 'Atoms', name: '晶格层 (Lattice)', icon: 'fa-border-all', prompt: '2D lattice plane, crystal structure showing atomic arrangement, vibrant atomic spheres' },
    { id: 'a2', category: 'Atoms', name: '核壳纳米粒子', icon: 'fa-circle-dot', prompt: 'Core-shell nanoparticle structure, cross-section, transparent shell, solid core, technical schematic' },
    { id: 'a3', category: 'Materials', name: '石墨烯 (Graphene)', icon: 'fa-hexagon-nodes', prompt: 'Graphene sheet, honeycomb lattice structure, single atomic layer, gray metallic finish' },
];

export const ScientificStencils: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { showToast } = useProjectContext();
    const [activeCategory, setActiveCategory] = useState<StencilCategory | 'All'>('All');

    const filteredStencils = STENCILS_DB.filter(s => activeCategory === 'All' || s.category === activeCategory);

    const handleCopyPrompt = (prompt: string) => {
        navigator.clipboard.writeText(prompt);
        showToast({ message: "已将组件 Prompt 复制到剪贴板，可粘贴至 AI 引擎", type: 'success' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex justify-end no-print pointer-events-none">
            {/* Backdrop Area (Click to close) */}
            <div 
                className="absolute inset-0 bg-slate-950/20 backdrop-blur-[2px] pointer-events-auto" 
                onClick={onClose}
            ></div>

            {/* Sidebar Content */}
            <div className="w-80 bg-white/95 backdrop-blur-2xl h-full shadow-[-20px_0_50px_rgba(0,0,0,0.15)] flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-500 pointer-events-auto">
                <header className="p-6 bg-slate-900 text-white shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black uppercase italic tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-cube text-indigo-400"></i> 学术组件库
                        </h3>
                        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center">
                            <i className="fa-solid fa-times text-sm opacity-50"></i>
                        </button>
                    </div>
                    
                    <div className="flex bg-white/10 p-1 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
                        {(['All', 'Glassware', 'Instruments', 'Biology', 'Atoms'] as const).map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                {cat === 'All' ? '全部' : cat === 'Glassware' ? '器皿' : cat === 'Instruments' ? '仪器' : cat === 'Biology' ? '生物' : '原子'}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        {filteredStencils.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => handleCopyPrompt(item.prompt)}
                                className="group bg-slate-50 border border-slate-200 rounded-3xl p-4 flex flex-col items-center gap-3 cursor-pointer hover:border-indigo-400 hover:bg-white hover:shadow-xl transition-all active:scale-95 relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-xl text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                                    <i className={`fa-solid ${item.icon}`}></i>
                                </div>
                                <p className="text-[10px] font-black text-slate-700 text-center uppercase tracking-tighter leading-tight">{item.name}</p>
                                <div className="absolute inset-0 bg-indigo-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-center">
                                    <i className="fa-solid fa-copy text-white text-lg mb-2"></i>
                                    <p className="text-[8px] font-black text-white uppercase">点击复制 Prompt</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {filteredStencils.length === 0 && (
                        <div className="py-20 text-center opacity-30">
                            <i className="fa-solid fa-magnifying-glass text-4xl mb-4"></i>
                            <p className="text-xs font-black uppercase">未找到相关组件</p>
                        </div>
                    )}
                </div>

                <footer className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
                    <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-20"><i className="fa-solid fa-lightbulb text-3xl"></i></div>
                        <h5 className="text-[10px] font-black uppercase tracking-widest mb-1.5">使用提示</h5>
                        <p className="text-[9px] font-medium leading-relaxed opacity-90 italic">
                            点击组件即可获取专为顶级期刊视觉风格设计的“咒语”。粘贴至 AI 生成器的“补充细节”框中，可显著提升生成图像的科学专业度。
                        </p>
                    </div>
                </footer>
            </div>
        </div>
    );
};