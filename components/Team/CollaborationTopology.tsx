
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { UserProfile, ResearchProject } from '../../types';

interface CollaborationTopologyProps {
    members: UserProfile[];
    projects: ResearchProject[];
}

interface TopologyNode extends UserProfile {
    x: number;
    y: number;
    vx?: number;
    vy?: number;
}

const CollaborationTopology: React.FC<CollaborationTopologyProps> = ({ members, projects }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [nodes, setNodes] = useState<TopologyNode[]>([]);
    
    // Interaction State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [radarAngle, setRadarAngle] = useState(0);

    // Radar Animation
    useEffect(() => {
        let animationFrameId: number;
        const animate = () => {
            setRadarAngle(prev => (prev + 0.4) % 360);
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Initialize Layout (Circular)
    useEffect(() => {
        const radius = 220;
        const centerX = 400;
        const centerY = 350;
        const initialNodes = members.map((m, i) => {
            const angle = (i / members.length) * 2 * Math.PI - (Math.PI / 2); // Start from top
            return { 
                ...m, 
                x: centerX + radius * Math.cos(angle), 
                y: centerY + radius * Math.sin(angle) 
            };
        });
        setNodes(initialNodes);
    }, [members]);

    // Calculate connectivity based on members
    const links = useMemo(() => {
        const connections: { source: string, target: string, weight: number, sharedProjects: string[] }[] = [];
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const m1 = members[i];
                const m2 = members[j];
                const commonProjects = projects.filter(p => 
                    p.members.includes(m1.name) && p.members.includes(m2.name)
                );
                if (commonProjects.length > 0) {
                    connections.push({ 
                        source: m1.id, 
                        target: m2.id, 
                        weight: commonProjects.length,
                        sharedProjects: commonProjects.map(p => p.title)
                    });
                }
            }
        }
        return connections;
    }, [members, projects]);

    // Network Density Calculation for HUD
    const networkStats = useMemo(() => {
        const maxLinks = (members.length * (members.length - 1)) / 2;
        const density = maxLinks > 0 ? (links.length / maxLinks) * 100 : 0;
        const avgLoad = members.reduce((acc, m) => acc + (m.workload || 0), 0) / (members.length || 1);
        return { density, avgLoad };
    }, [members, links]);

    // Fast lookup for node positions during render
    const nodeMap = useMemo(() => {
        const map = new Map<string, TopologyNode>();
        nodes.forEach(n => map.set(n.id, n));
        return map;
    }, [nodes]);

    const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDraggingId(id);
    };

    const handleNodeClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedId(id);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingId && svgRef.current) {
            const CTM = svgRef.current.getScreenCTM();
            if (CTM) {
                const x = (e.clientX - CTM.e) / CTM.a;
                const y = (e.clientY - CTM.f) / CTM.d;
                setNodes(prev => prev.map(n => n.id === draggingId ? { ...n, x, y } : n));
            }
        }
    };

    const handleMouseUp = () => {
        setDraggingId(null);
    };

    const handleBackgroundClick = () => {
        setSelectedId(null);
    };

    const getGlowColor = (level: string) => {
        switch(level) {
            case '绝密': return '#f43f5e'; // Rose
            case '机密': return '#f59e0b'; // Amber
            default: return '#6366f1'; // Indigo
        }
    };

    const selectedMember = nodes.find(n => n.id === selectedId);
    
    // Calculate Synergy Stats for Selected Node
    const synergyStats = useMemo(() => {
        if (!selectedMember) return null;
        const relatedLinks = links.filter(l => l.source === selectedMember.id || l.target === selectedMember.id);
        const totalCollabs = relatedLinks.reduce((acc, curr) => acc + curr.weight, 0);
        
        let maxWeight = -1;
        let topPartnerId: string | null = null;
        
        relatedLinks.forEach(link => {
            if (link.weight > maxWeight) {
                maxWeight = link.weight;
                topPartnerId = link.source === selectedMember.id ? link.target : link.source;
            }
        });

        const topCollaborator = topPartnerId ? nodeMap.get(topPartnerId) : null;
        return { totalCollabs, topCollaborator };
    }, [selectedMember, links, nodeMap]);

    return (
        <div 
            className="w-full h-full min-h-[650px] bg-slate-50/50 rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden relative flex flex-col group/container" 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onClick={handleBackgroundClick}
        >
            <style>{`
                @keyframes pulse-aura {
                    0% { opacity: 0.2; transform: scale(0.95); }
                    50% { opacity: 0.5; transform: scale(1.05); }
                    100% { opacity: 0.2; transform: scale(0.95); }
                }
                .node-aura {
                    animation: pulse-aura 4s infinite ease-in-out;
                    transform-origin: center;
                }
                @keyframes orbit-rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .orbit-path {
                    animation: orbit-rotate 60s linear infinite;
                    transform-origin: 400px 350px;
                }
            `}</style>
            
            {/* Header Overlay */}
            <div className="absolute top-8 left-10 pointer-events-none z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                        <i className="fa-solid fa-circle-nodes text-xl animate-pulse"></i>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">
                            协同神经网络
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3rem] mt-1">Synergy Neural Network</p>
                    </div>
                </div>
            </div>

            {/* Right: Visual Legend Panel */}
            <div className="absolute top-8 right-10 pointer-events-none z-10">
                <div className="bg-white/80 backdrop-blur-md border border-slate-200 p-4 rounded-3xl shadow-lg w-48 space-y-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-2">图标语义图例</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">绝密权限 (Level 5)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">机密权限 (Level 3)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                        <span className="text-[9px] font-bold text-slate-600 uppercase">内部权限 (Level 1)</span>
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                        <span className="text-[8px] font-black text-slate-400 uppercase italic">负载环 (Workload)</span>
                    </div>
                </div>
            </div>

            {/* Bottom Left HUD: Network Statistics */}
            <div className="absolute bottom-8 left-10 pointer-events-none z-10 flex gap-4">
                <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-3xl shadow-lg w-40">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">NETWORK DENSITY</p>
                    <div className="flex items-end gap-2">
                        <span className="text-2xl font-black text-indigo-600 italic">{networkStats.density.toFixed(1)}%</span>
                        <div className="mb-1.5 flex gap-0.5">
                            <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                            <div className={`w-1 h-3 rounded-full ${networkStats.density > 30 ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                            <div className={`w-1 h-3 rounded-full ${networkStats.density > 60 ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-3xl shadow-lg w-40">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">AVG WORKLOAD</p>
                    <div className="flex items-end gap-2">
                        <span className={`text-2xl font-black italic ${networkStats.avgLoad > 80 ? 'text-rose-500' : 'text-emerald-500'}`}>{networkStats.avgLoad.toFixed(0)}%</span>
                    </div>
                </div>
            </div>

            {/* Main Visualization */}
            <svg 
                ref={svgRef}
                viewBox="0 0 800 700" 
                className="w-full h-full cursor-grab active:cursor-grabbing"
            >
                <defs>
                    <radialGradient id="nodeGradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </radialGradient>
                    
                    {/* Standard Gradient for idle links */}
                    <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
                    </linearGradient>

                    {/* High-Opacity Gradient for selected/active links to maintain curve aesthetics */}
                    <linearGradient id="linkGradientSelected" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.7" />
                    </linearGradient>

                    {/* Radar Gradient */}
                    <linearGradient id="radarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.08" />
                    </linearGradient>
                </defs>
                
                {/* Background Grid */}
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1.5" fill="#94a3b8" fillOpacity="0.1" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Background Concentric Rings to fill space */}
                <circle cx="400" cy="350" r="300" fill="none" stroke="#6366f1" strokeWidth="0.5" strokeDasharray="5 15" opacity="0.15" className="orbit-path" />
                <circle cx="400" cy="350" r="220" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="2 4" opacity="0.1" />
                <circle cx="400" cy="350" r="100" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.05" />

                <text x="400" y="580" textAnchor="middle" className="text-[7px] font-black fill-slate-300 uppercase tracking-[0.5rem] opacity-40">Extended Network</text>
                <text x="400" y="460" textAnchor="middle" className="text-[7px] font-black fill-slate-300 uppercase tracking-[0.3rem] opacity-30">Core Team</text>

                {/* Radar Scan Effect */}
                <g transform={`translate(400, 350) rotate(${radarAngle})`}>
                    <path d="M 0 0 L -400 -400 A 600 600 0 0 1 400 -400 Z" fill="url(#radarGradient)" style={{ pointerEvents: 'none' }} />
                </g>

                {/* Connection Links (Curved Bezier with True Organic Offset) */}
                {links.map((link, idx) => {
                    const s = nodeMap.get(link.source);
                    const t = nodeMap.get(link.target);
                    if (!s || !t) return null;
                    
                    const isRelated = hoveredId ? (link.source === hoveredId || link.target === hoveredId) : true;
                    const isSelected = selectedId ? (link.source === selectedId || link.target === selectedId) : false;
                    
                    // Spotlight Effect: Heavy fade for unrelated links
                    const opacityClass = hoveredId && !isRelated ? 'opacity-[0.05] blur-[1px]' : 'opacity-100';

                    const midX = (s.x + t.x) / 2;
                    const midY = (s.y + t.y) / 2;
                    
                    // Calculate organic curve offset based on normal vector
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const curvature = 0.15; 
                    const nx = -dy / dist;
                    const ny = dx / dist;
                    // Control point
                    const cx = midX + nx * (dist * curvature);
                    const cy = midY + ny * (dist * curvature);

                    // Calculate Bezier midpoint for the badge
                    const badgeX = 0.25 * s.x + 0.5 * cx + 0.25 * t.x;
                    const badgeY = 0.25 * s.y + 0.5 * cy + 0.25 * t.y;

                    return (
                        <g key={`${link.source}-${link.target}`} className={`transition-all duration-500 ${opacityClass}`}>
                            <path 
                                d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`}
                                // Use the selected gradient instead of solid color, and FIXED strokeWidth
                                stroke={isSelected ? "url(#linkGradientSelected)" : "url(#linkGradient)"}
                                strokeWidth={link.weight * 1.5} 
                                fill="none"
                                style={{ pointerEvents: 'none' }}
                                strokeLinecap="round"
                            />
                            {/* Connection Badge (Small pill showing prj count) */}
                            {(!hoveredId || isRelated) && (
                                <g transform={`translate(${badgeX}, ${badgeY})`} className="cursor-default pointer-events-none">
                                    <rect x="-14" y="-7" width="28" height="14" rx="7" fill="white" stroke="#e2e8f0" strokeWidth="1" className="shadow-sm" />
                                    <text y="3" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#6366f1">{link.weight} PRJ</text>
                                </g>
                            )}

                            {/* Animated particle flow for active or selected links */}
                            {isRelated && !hoveredId && (
                                <circle r="2" fill="#6366f1">
                                    <animateMotion dur={`${4 - link.weight * 0.5}s`} repeatCount="indefinite" path={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`} />
                                </circle>
                            )}
                        </g>
                    );
                })}

                {/* Nodes */}
                {nodes.map(node => {
                    const isHighLoad = (node.workload || 0) > 80;
                    const isHovered = hoveredId === node.id;
                    // Spotlight Logic: Dim if hover exists AND this node is not hovered AND not connected to hovered
                    const isDimmed = hoveredId && hoveredId !== node.id && !links.some(l => (l.source === hoveredId && l.target === node.id) || (l.target === hoveredId && l.source === node.id));
                    const isSelected = selectedId === node.id;

                    return (
                        <g 
                            key={node.id} 
                            className={`transition-all duration-500 cursor-pointer ${isDimmed ? 'opacity-20 grayscale blur-[1px]' : 'opacity-100'}`}
                            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                            onClick={(e) => handleNodeClick(e, node.id)}
                            onMouseEnter={() => setHoveredId(node.id)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            {/* Interactive Aura (Pulsing) */}
                            {!isDimmed && (
                                <circle 
                                    cx={node.x} cy={node.y} r={isHovered ? 70 : 50} 
                                    fill="url(#nodeGradient)"
                                    className="node-aura transition-all duration-500"
                                />
                            )}
                            
                            {/* Security Level Halo */}
                            <circle 
                                cx={node.x} cy={node.y} r="38" 
                                fill="white" 
                                stroke={getGlowColor(node.securityLevel)} 
                                strokeWidth={isSelected ? 3 : 1.5} 
                                className={`shadow-sm ${node.securityLevel === '绝密' ? 'animate-pulse' : ''}`}
                            />
                            
                            {/* Workload Ring (Progress) */}
                            <circle 
                                cx={node.x} cy={node.y} r="32" 
                                fill="transparent" 
                                stroke={isHighLoad ? "#f43f5e" : "#10b981"} 
                                strokeWidth="3" 
                                strokeDasharray={`${(node.workload || 0) * 2.01} 201`} 
                                transform={`rotate(-90 ${node.x} ${node.y})`}
                                strokeLinecap="round"
                                className="opacity-90"
                            />
                             {/* Ring Background */}
                             <circle 
                                cx={node.x} cy={node.y} r="32" 
                                fill="#ffffff" 
                                stroke="#f1f5f9" 
                                strokeWidth="3" 
                            />

                            {/* Avatar Container */}
                            <foreignObject x={node.x - 24} y={node.y - 24} width="48" height="48" className="pointer-events-none">
                                <div className="w-full h-full rounded-full overflow-hidden border-2 border-slate-100 bg-slate-50 relative group">
                                    <img src={node.avatar} className="w-full h-full object-cover" alt="" />
                                </div>
                            </foreignObject>

                            {/* Label */}
                            <text x={node.x} y={node.y + 55} textAnchor="middle" className={`text-[10px] font-black uppercase tracking-tight fill-slate-800 ${isHovered ? 'text-sm font-extrabold fill-indigo-600' : ''} transition-all`}>
                                {node.name}
                            </text>
                            <text x={node.x} y={node.y + 68} textAnchor="middle" className={`text-[7px] font-bold uppercase fill-slate-400`}>
                                Load: {node.workload}%
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Synergy Insight Panel (Bottom Right) */}
            {selectedMember ? (
                <div className="absolute bottom-8 right-8 w-72 bg-white/90 backdrop-blur-xl border border-slate-200 p-5 rounded-[2rem] shadow-2xl animate-reveal" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4">
                        <img src={selectedMember.avatar} className="w-10 h-10 rounded-full border-2 border-indigo-100" />
                        <div>
                            <h5 className="text-sm font-black text-slate-800 uppercase">{selectedMember.name}</h5>
                            <p className="text-[9px] text-indigo-600 font-bold uppercase">{selectedMember.role}</p>
                        </div>
                        <button onClick={() => setSelectedId(null)} className="ml-auto w-6 h-6 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors"><i className="fa-solid fa-times text-[10px]"></i></button>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">协作强度 (Total Links)</span>
                            <span className="text-sm font-black text-emerald-600 font-mono">{synergyStats?.totalCollabs}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-[9px] text-slate-500 font-bold uppercase">最佳拍档 (Top Partner)</span>
                            <span className="text-[10px] font-black text-slate-700">{synergyStats?.topCollaborator?.name || 'None'}</span>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">活跃协作课题</p>
                        <div className="flex flex-wrap gap-1.5">
                            {links.filter(l => l.source === selectedMember.id || l.target === selectedMember.id)
                                  .flatMap(l => l.sharedProjects)
                                  .slice(0, 3)
                                  .map((p, i) => (
                                <span key={i} className="px-2 py-1 bg-white rounded-lg text-[8px] text-slate-600 border border-slate-200 truncate max-w-[100px] shadow-sm">{p}</span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="absolute bottom-8 right-8 flex flex-col gap-2 bg-white/80 p-4 rounded-3xl border border-slate-200 backdrop-blur-sm pointer-events-none shadow-lg">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">操作指南</p>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-dashed border-slate-300 flex items-center justify-center"><i className="fa-solid fa-hand-pointer text-[8px] text-slate-500"></i></div>
                        <span className="text-[9px] font-bold text-slate-500">拖拽节点调整布局</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-dashed border-slate-300 flex items-center justify-center"><i className="fa-solid fa-eye text-[8px] text-slate-500"></i></div>
                        <span className="text-[9px] font-bold text-slate-500">点击节点查看详情</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollaborationTopology;
