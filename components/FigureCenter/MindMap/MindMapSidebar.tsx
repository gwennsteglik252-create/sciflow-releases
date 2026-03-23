import React, { useState } from 'react';
import { useMindMapDesigner } from '../../../hooks/useMindMapDesigner';
import { MINDMAP_TEMPLATES, NODE_COLOR_PRESETS } from './constants';
import { MindMapNodeShape, SideAnnotation, SavedMindMap } from './types';
import { SchemeLibraryModal } from '../SchemeLibraryModal';

interface MindMapSidebarProps {
  logic: ReturnType<typeof useMindMapDesigner>;
}

const SHAPE_OPTIONS: { key: MindMapNodeShape; label: string; icon: string }[] = [
  { key: 'rect', label: '矩形', icon: 'fa-square' },
  { key: 'rounded', label: '圆角', icon: 'fa-square' },
  { key: 'pill', label: '胶囊', icon: 'fa-capsules' },
  { key: 'circle', label: '圆形', icon: 'fa-circle' },
  { key: 'diamond', label: '菱形', icon: 'fa-diamond' },
];

const FONT_FAMILIES = [
  { name: '系统默认', value: 'inherit' },
  { name: 'Sans (现代)', value: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
  { name: 'Serif (学术)', value: '"Times New Roman", Times, serif' },
  { name: 'Mono (技术)', value: '"Courier New", Courier, monospace' },
  { name: 'Impact (醒目)', value: 'Impact, sans-serif' },
];

const ICON_OPTIONS = [
  'fa-flask', 'fa-vial', 'fa-vials', 'fa-mortar-pestle', 'fa-microscope', 'fa-dna', 'fa-atom', 'fa-bacteria', 'fa-virus', 'fa-leaf',
  'fa-bolt', 'fa-fire', 'fa-droplet', 'fa-temperature-high', 'fa-gauge-high', 'fa-magnet',
  'fa-database', 'fa-server', 'fa-microchip', 'fa-calculator', 'fa-brain', 'fa-network-wired', 'fa-code',
  'fa-chart-bar', 'fa-chart-line', 'fa-chart-pie', 'fa-chart-area', 'fa-file-lines', 'fa-file-medical', 'fa-file-export',
  'fa-gear', 'fa-wrench', 'fa-filter', 'fa-magnifying-glass', 'fa-eye', 'fa-star', 'fa-circle-check', 'fa-circle-exclamation', 'fa-shield-halved', 'fa-lock',
];

export const MindMapSidebar: React.FC<MindMapSidebarProps> = ({ logic }) => {
  const {
    data, userPrompt, setUserPrompt,
    selectedNodeId, setSelectedNodeId,
    selectedLayerId, setSelectedLayerId,
    aiLanguage, setAiLanguage,
    isGenerating,
    handleCreateEmpty, handleLoadTemplate, handleGenerate, handleIterate,
    addLayer, updateLayer, deleteLayer, moveLayer,
    addNode, updateNode, deleteNode,
    addConnection, updateConnection, deleteConnection,
    updateGlobalConfig, autoLayout,
    addTimeline, updateTimeline, deleteTimeline, moveTimeline,
    savedList, showLibrary, setShowLibrary,
    showSaveModal, setShowSaveModal,
    saveTitle, setSaveTitle,
    handleSaveToLibrary, handleConfirmSave, handleLoadFromLibrary,
    handleDeleteFromLibrary, handleRenameInLibrary,
    handleExport,
    undo, redo, canUndo, canRedo,
  } = logic;

  const [activeSection, setActiveSection] = useState<'ai' | 'layers' | 'node' | 'global'>('ai');
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // 查找选中的节点
  const selectedNode = data?.layers.flatMap(l => l.nodes).find(n => n.id === selectedNodeId) || null;
  const selectedLayer = data?.layers.find(l => l.id === selectedLayerId) || null;

  // 自动切换到相关面板
  React.useEffect(() => {
    if (selectedNodeId && selectedNode) setActiveSection('node');
    else if (selectedLayerId && selectedLayer) setActiveSection('layers');
  }, [selectedNodeId, selectedLayerId]);

  const allNodes = data?.layers.flatMap(l => l.nodes) || [];

  return (
    <div className="w-[340px] shrink-0 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-xl flex flex-col overflow-hidden relative">
      {/* Section Tabs */}
      <div className="flex bg-slate-50 border-b border-slate-200 p-1 gap-0.5 shrink-0">
        {[
          { key: 'ai', icon: 'fa-robot', label: 'AI' },
          { key: 'layers', icon: 'fa-layer-group', label: '层' },
          { key: 'node', icon: 'fa-cube', label: '节点' },
          { key: 'global', icon: 'fa-sliders', label: '全局' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeSection === tab.key ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className={`fa-solid ${tab.icon} text-[9px]`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">

        {/* === AI Section === */}
        {activeSection === 'ai' && (
          <>
            {/* Template Presets */}
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">预设模板</h3>
              <div className="space-y-1.5">
                {MINDMAP_TEMPLATES.map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLoadTemplate(idx)}
                    className="w-full text-left px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all group"
                  >
                    <div className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">{tpl.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{tpl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* AI Generation */}
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">AI 智能生成</h3>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setAiLanguage('zh')}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${aiLanguage === 'zh' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                >
                  中文
                </button>
                <button
                  onClick={() => setAiLanguage('en')}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${aiLanguage === 'en' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                >
                  English
                </button>
              </div>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder={data
                  ? "输入修改指令，例如：\n• 增加一个'实验验证'层\n• 把第二层的节点改为蓝色\n• 增加从A到B的连接线"
                  : "描述你的框架结构，例如：\n• 量子密钥分发教学设计\n• 纳米催化研究框架\n• 机器学习项目技术方案"}
                className="w-full h-28 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-300 resize-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleGenerate}
                  disabled={!userPrompt.trim() || isGenerating}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <><i className="fa-solid fa-spinner fa-spin text-xs"></i> 构建中...</>
                  ) : (
                    <><i className="fa-solid fa-wand-magic-sparkles text-xs"></i> {data ? '全新生成' : 'AI 生成'}</>
                  )}
                </button>
                {data && (
                  <button
                    onClick={handleIterate}
                    disabled={!userPrompt.trim() || isGenerating}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <><i className="fa-solid fa-spinner fa-spin text-xs"></i></>
                    ) : (
                      <><i className="fa-solid fa-bolt text-xs"></i> 迭代优化</>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-200" />

            {/* Quick Actions */}
            <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">快捷操作</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCreateEmpty}
                  className="px-3 py-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-[10px] font-bold text-slate-600 hover:text-emerald-700 transition-all flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-plus text-[9px]"></i> 空白画布
                </button>
                <button
                  onClick={handleExport}
                  disabled={!data}
                  className="px-3 py-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-[10px] font-bold text-slate-600 hover:text-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <i className="fa-solid fa-download text-[9px]"></i> 导出 PNG
                </button>
                <button
                  onClick={autoLayout}
                  disabled={!data}
                  className="px-3 py-2 bg-slate-50 hover:bg-violet-50 border border-slate-200 hover:border-violet-300 rounded-xl text-[10px] font-bold text-slate-600 hover:text-violet-700 transition-all flex items-center gap-1.5 disabled:opacity-50 col-span-2"
                >
                  <i className="fa-solid fa-table-cells text-[9px]"></i> 一键自动布局
                </button>
              </div>
            </div>
          </>
        )}

        {/* === Layers Section === */}
        {activeSection === 'layers' && (
          <>
            {/* Timeline Management */}
            {data && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <i className="fa-solid fa-timeline text-[8px] text-amber-500 mr-1"></i>时间轴管理
                  </h3>
                  <button
                    onClick={() => addTimeline()}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-600 transition-all flex items-center gap-1"
                  >
                    <i className="fa-solid fa-plus text-[8px]"></i> 添加
                  </button>
                </div>
                {(!data.timeline || data.timeline.length === 0) ? (
                  <div className="text-[10px] text-slate-400 text-center py-3 bg-slate-50 rounded-lg border border-slate-200">无时间轴阶段，点击「添加」创建</div>
                ) : (
                  <div className="space-y-1.5">
                    {data.timeline.map((phase, pIdx) => (
                      <div key={pIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-amber-200 transition-all">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: phase.color || '#475569' }} />
                            <span className="text-[10px] font-bold text-slate-600">{phase.label}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => moveTimeline(pIdx, 'up')} disabled={pIdx === 0} className="w-5 h-5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center disabled:opacity-30 transition-all">
                              <i className="fa-solid fa-chevron-up text-[7px]"></i>
                            </button>
                            <button onClick={() => moveTimeline(pIdx, 'down')} disabled={pIdx === (data.timeline?.length || 0) - 1} className="w-5 h-5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center disabled:opacity-30 transition-all">
                              <i className="fa-solid fa-chevron-down text-[7px]"></i>
                            </button>
                            <button onClick={() => deleteTimeline(pIdx)} className="w-5 h-5 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all">
                              <i className="fa-solid fa-trash-can text-[7px]"></i>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase">标签</label>
                            <input
                              value={phase.label}
                              onChange={(e) => updateTimeline(pIdx, { label: e.target.value })}
                              className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-amber-400 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">起始层</label>
                              <select
                                value={phase.fromLayer}
                                onChange={(e) => updateTimeline(pIdx, { fromLayer: Number(e.target.value) })}
                                className="w-full mt-0.5 px-1 py-1 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-amber-400 outline-none"
                              >
                                {data.layers.map((l, li) => <option key={li} value={li}>{li}: {l.title}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">结束层</label>
                              <select
                                value={phase.toLayer}
                                onChange={(e) => updateTimeline(pIdx, { toLayer: Number(e.target.value) })}
                                className="w-full mt-0.5 px-1 py-1 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-amber-400 outline-none"
                              >
                                {data.layers.map((l, li) => <option key={li} value={li}>{li}: {l.title}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">颜色</label>
                              <input
                                type="color"
                                value={phase.color || '#475569'}
                                onChange={(e) => updateTimeline(pIdx, { color: e.target.value })}
                                className="w-full h-6 mt-0.5 rounded cursor-pointer border border-slate-200"
                              />
                            </div>
                          </div>
                          {/* 排版控制 */}
                          <div>
                            <label className="text-[8px] font-bold text-slate-400 uppercase mb-0.5 flex items-center justify-between">
                              <span><i className="fa-solid fa-font text-[7px] text-amber-400 mr-0.5"></i>排版</span>
                              <button
                                onClick={() => updateTimeline(pIdx, { fontSize: undefined, fontWeight: undefined, fontFamily: undefined, fontStyle: undefined, color: undefined } as any)}
                                className="text-[7px] text-amber-400 hover:text-amber-600 font-normal normal-case"
                                title="重置为全局默认"
                              >↻ 重置为全局</button>
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 mb-1">
                              <div>
                                <label className="text-[7px] text-slate-400">字号</label>
                                <input type="number" value={phase.fontSize || 11} onChange={(e) => updateTimeline(pIdx, { fontSize: Math.max(8, Number(e.target.value)) })} className="w-full mt-0.5 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-amber-400 outline-none" />
                              </div>
                              <div>
                                <label className="text-[7px] text-slate-400">字重</label>
                                <select value={phase.fontWeight || '800'} onChange={(e) => updateTimeline(pIdx, { fontWeight: e.target.value })} className="w-full mt-0.5 px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-amber-400 outline-none">
                                  <option value="400">Normal</option>
                                  <option value="600">Semi Bold</option>
                                  <option value="700">Bold</option>
                                  <option value="800">Extra Bold</option>
                                  <option value="900">Black</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="flex bg-white p-0.5 rounded border border-slate-200 shadow-sm">
                                <button
                                  onClick={() => updateTimeline(pIdx, { fontWeight: (phase.fontWeight || '800') === '700' || (phase.fontWeight || '800') === '800' || (phase.fontWeight || '800') === '900' ? '400' : '700' })}
                                  className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-black transition-all ${Number(phase.fontWeight || 800) >= 700 ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                                >B</button>
                                <button
                                  onClick={() => updateTimeline(pIdx, { fontStyle: phase.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                  className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-serif italic transition-all ${phase.fontStyle === 'italic' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                                >I</button>
                              </div>
                              <select
                                value={phase.fontFamily || 'inherit'}
                                onChange={(e) => updateTimeline(pIdx, { fontFamily: e.target.value })}
                                className="flex-1 px-1 py-1 bg-white border border-slate-200 rounded text-[8px] focus:ring-1 focus:ring-amber-400 outline-none"
                              >
                                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="h-px bg-slate-200" />

            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">分层管理</h3>
              <button
                onClick={addLayer}
                disabled={!data}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[10px] font-bold text-indigo-600 transition-all disabled:opacity-40 flex items-center gap-1"
              >
                <i className="fa-solid fa-plus text-[8px]"></i> 添加层
              </button>
            </div>

            {!data ? (
              <div className="text-xs text-slate-400 text-center py-8">请先创建画布</div>
            ) : (
              <div className="space-y-2">
                {data.layers.map((layer, lIdx) => (
                  <div
                    key={layer.id}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedLayerId === layer.id ? 'bg-indigo-50 border-indigo-300 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}
                    onClick={() => { setSelectedLayerId(layer.id); setSelectedNodeId(null); }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: layer.backgroundColor || '#e2e8f0' }} />
                        <span className="text-xs font-bold text-slate-700">{layer.title}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); }} disabled={lIdx === 0} className="w-6 h-6 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center disabled:opacity-30 transition-all">
                          <i className="fa-solid fa-chevron-up text-[8px]"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); }} disabled={lIdx === data.layers.length - 1} className="w-6 h-6 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center disabled:opacity-30 transition-all">
                          <i className="fa-solid fa-chevron-down text-[8px]"></i>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="w-6 h-6 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all">
                          <i className="fa-solid fa-trash-can text-[8px]"></i>
                        </button>
                      </div>
                    </div>

                    {selectedLayerId === layer.id && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-indigo-200">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">标题</label>
                          <input
                            value={layer.title}
                            onChange={(e) => updateLayer(layer.id, { title: e.target.value })}
                            className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">背景色</label>
                            <input
                              type="color"
                              value={layer.backgroundColor || '#E8F0FE'}
                              onChange={(e) => updateLayer(layer.id, { backgroundColor: e.target.value })}
                              className="w-full h-8 mt-1 rounded-lg cursor-pointer border border-slate-200"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">高度</label>
                            <input
                              type="number"
                              value={layer.height}
                              onChange={(e) => updateLayer(layer.id, { height: Math.max(80, Number(e.target.value)) })}
                              className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">边框样式</label>
                          <div className="flex gap-1 mt-1">
                            {(['solid', 'dashed', 'double', 'none'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => updateLayer(layer.id, { borderStyle: s })}
                                className={`flex-1 px-2 py-1 rounded text-[9px] font-bold border transition-all ${layer.borderStyle === s ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Border Width */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">边框宽度</label>
                            <input
                              type="number"
                              value={layer.borderWidth ?? 1.5}
                              onChange={(e) => updateLayer(layer.id, { borderWidth: Math.max(0, Number(e.target.value)) })}
                              className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">边框颜色</label>
                            <input
                              type="color"
                              value={layer.borderColor || '#e2e8f0'}
                              onChange={(e) => updateLayer(layer.id, { borderColor: e.target.value })}
                              className="w-full h-8 mt-1 rounded-lg cursor-pointer border border-slate-200"
                            />
                          </div>
                        </div>

                        {/* Layer Title Typography */}
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">
                            <i className="fa-solid fa-font text-[8px] text-indigo-400 mr-1"></i>标题排版
                          </label>
                          <div className="grid grid-cols-2 gap-2 mb-1.5">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">字号</label>
                              <input type="number" value={layer.titleFontSize || 11} onChange={(e) => updateLayer(layer.id, { titleFontSize: Math.max(8, Number(e.target.value)) })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">字重</label>
                              <select value={layer.titleFontWeight || '900'} onChange={(e) => updateLayer(layer.id, { titleFontWeight: e.target.value })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none">
                                <option value="400">Normal</option>
                                <option value="600">Semi Bold</option>
                                <option value="700">Bold</option>
                                <option value="800">Extra Bold</option>
                                <option value="900">Black</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">颜色</label>
                              <input type="color" value={layer.titleColor || '#475569'} onChange={(e) => updateLayer(layer.id, { titleColor: e.target.value })} className="w-full h-6 mt-0.5 rounded cursor-pointer border border-slate-200" />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold text-slate-400 uppercase">字体族</label>
                              <select value={layer.titleFontFamily || 'inherit'} onChange={(e) => updateLayer(layer.id, { titleFontFamily: e.target.value })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none">
                                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Side Annotations Management */}
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between">
                            <span>侧边标注</span>
                            <button
                              onClick={() => {
                                const anns = layer.sideAnnotations || [];
                                updateLayer(layer.id, {
                                  sideAnnotations: [...anns, { text: '标注', position: 'left', color: '#475569' }]
                                });
                              }}
                              className="text-indigo-500 hover:text-indigo-700"
                            >
                              <i className="fa-solid fa-plus text-[8px]"></i>
                            </button>
                          </label>
                          {(layer.sideAnnotations || []).map((ann, aIdx) => (
                            <div key={aIdx} className="mt-1.5 p-2 bg-white rounded-lg border border-slate-100 space-y-1.5">
                              {/* 第一行: 文本、位置、删除 */}
                              <div className="flex items-center gap-1">
                                <input
                                  value={ann.text}
                                  onChange={(e) => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns[aIdx] = { ...anns[aIdx], text: e.target.value };
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="flex-1 min-w-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none"
                                />
                                <select
                                  value={ann.position}
                                  onChange={(e) => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns[aIdx] = { ...anns[aIdx], position: e.target.value as 'left' | 'right' };
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="px-1 py-1 bg-slate-50 border border-slate-200 rounded text-[9px]"
                                >
                                  <option value="left">左</option>
                                  <option value="right">右</option>
                                </select>
                                <button
                                  onClick={() => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns.splice(aIdx, 1);
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="w-5 h-5 rounded text-rose-400 hover:text-rose-600 flex items-center justify-center shrink-0"
                                >
                                  <i className="fa-solid fa-xmark text-[8px]"></i>
                                </button>
                              </div>
                              {/* 第二行: 字号、颜色、粗体/斜体、字族 + 重置 */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={ann.fontSize ?? data.globalConfig.sideAnnotationStyle?.fontSize ?? 13}
                                  onChange={(e) => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns[aIdx] = { ...anns[aIdx], fontSize: Math.max(8, Number(e.target.value)) };
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="w-10 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] text-center"
                                  title="字号"
                                />
                                <input
                                  type="color"
                                  value={ann.color ?? data.globalConfig.sideAnnotationStyle?.color ?? '#475569'}
                                  onChange={(e) => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns[aIdx] = { ...anns[aIdx], color: e.target.value };
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="w-6 h-6 rounded cursor-pointer border border-slate-200 shrink-0"
                                />
                                <div className="flex bg-slate-50 p-0.5 rounded border border-slate-200">
                                  <button
                                    onClick={() => {
                                      const anns = [...(layer.sideAnnotations || [])];
                                      anns[aIdx] = { ...anns[aIdx], fontWeight: Number(ann.fontWeight || 800) >= 700 ? '400' : '700' };
                                      updateLayer(layer.id, { sideAnnotations: anns });
                                    }}
                                    className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-black transition-all ${Number(ann.fontWeight || 800) >= 700 ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                                  >B</button>
                                  <button
                                    onClick={() => {
                                      const anns = [...(layer.sideAnnotations || [])];
                                      anns[aIdx] = { ...anns[aIdx], fontStyle: ann.fontStyle === 'italic' ? 'normal' : 'italic' };
                                      updateLayer(layer.id, { sideAnnotations: anns });
                                    }}
                                    className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-serif italic transition-all ${ann.fontStyle === 'italic' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                                  >I</button>
                                </div>
                                <select
                                  value={ann.fontFamily || 'inherit'}
                                  onChange={(e) => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns[aIdx] = { ...anns[aIdx], fontFamily: e.target.value };
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="flex-1 min-w-0 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-[8px]"
                                  title="字体"
                                >
                                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                                </select>
                                <button
                                  onClick={() => {
                                    const anns = [...(layer.sideAnnotations || [])];
                                    anns[aIdx] = { ...anns[aIdx], fontSize: undefined, fontWeight: undefined, fontFamily: undefined, fontStyle: undefined, color: undefined } as any;
                                    updateLayer(layer.id, { sideAnnotations: anns });
                                  }}
                                  className="w-5 h-5 rounded text-amber-400 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center shrink-0"
                                  title="重置为全局默认"
                                >↻</button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => addNode(layer.id)}
                          className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 transition-all flex items-center justify-center gap-1"
                        >
                          <i className="fa-solid fa-plus text-[8px]"></i> 添加节点到此层
                        </button>
                      </div>
                    )}

                    <div className="text-[9px] text-slate-400 mt-1">{layer.nodes.length} 个节点</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === Node Section === */}
        {activeSection === 'node' && (
          <>
            {!selectedNode ? (
              <div className="text-xs text-slate-400 text-center py-12">
                <i className="fa-solid fa-mouse-pointer text-3xl text-slate-200 mb-3 block"></i>
                在画布上点击节点以编辑属性
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">节点属性</h3>

                {/* Text */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">文本</label>
                  <input
                    value={selectedNode.text}
                    onChange={(e) => updateNode(selectedNode.id, { text: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">副标题</label>
                  <input
                    value={selectedNode.subText || ''}
                    onChange={(e) => updateNode(selectedNode.id, { subText: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                    placeholder="可选"
                  />
                </div>

                {/* Shape */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">形状</label>
                  <div className="flex gap-1">
                    {SHAPE_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => updateNode(selectedNode.id, { shape: opt.key })}
                        className={`flex-1 flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-lg text-[9px] font-bold border transition-all ${(selectedNode.shape || 'rounded') === opt.key ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                        title={opt.label}
                      >
                        <i className={`fa-solid ${opt.icon} text-[10px]`}></i>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Icon Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">图标</label>
                    {selectedNode.icon && (
                      <button onClick={() => updateNode(selectedNode.id, { icon: undefined })} className="text-[8px] text-rose-400 hover:text-rose-600">清除</button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all ${showIconPicker ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${showIconPicker ? 'bg-white/20' : 'bg-white shadow-sm border border-slate-100'}`}>
                        <i className={`fa-solid ${selectedNode.icon || 'fa-icons'} text-[10px] ${showIconPicker ? 'text-white' : 'text-indigo-500'}`}></i>
                      </div>
                      <span className="text-[9px] font-bold">{showIconPicker ? '选择图标...' : '点击选择图标'}</span>
                    </div>
                    <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showIconPicker ? 'rotate-180' : ''}`}></i>
                  </button>
                  {showIconPicker && (
                    <div className="mt-1.5 p-2 bg-white rounded-xl border border-indigo-100 shadow-lg">
                      <div className="grid grid-cols-7 gap-1 max-h-36 overflow-y-auto">
                        {ICON_OPTIONS.map(ic => (
                          <button
                            key={ic}
                            onClick={() => { updateNode(selectedNode.id, { icon: ic }); }}
                            className={`aspect-square rounded flex items-center justify-center text-[10px] border transition-all ${selectedNode.icon === ic ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-indigo-200 hover:text-indigo-600'}`}
                          >
                            <i className={`fa-solid ${ic}`}></i>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Colors */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">快速配色</label>
                  <div className="flex flex-wrap gap-1.5">
                    {NODE_COLOR_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        onClick={() => updateNode(selectedNode.id, { backgroundColor: preset.bg, textColor: preset.text, borderColor: preset.border })}
                        className="w-7 h-7 rounded-lg border-2 border-white shadow-sm hover:scale-110 transition-transform"
                        style={{ backgroundColor: preset.bg }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">背景色</label>
                    <input type="color" value={selectedNode.backgroundColor || '#4A90D9'} onChange={(e) => updateNode(selectedNode.id, { backgroundColor: e.target.value })} className="w-full h-8 mt-1 rounded-lg cursor-pointer border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">文字色</label>
                    <input type="color" value={selectedNode.textColor || '#ffffff'} onChange={(e) => updateNode(selectedNode.id, { textColor: e.target.value })} className="w-full h-8 mt-1 rounded-lg cursor-pointer border border-slate-200" />
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">透明度</label>
                    <span className="text-[9px] font-mono font-bold text-indigo-600">{Math.round((selectedNode.opacity ?? 1) * 100)}%</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={selectedNode.opacity ?? 1}
                    onChange={(e) => updateNode(selectedNode.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full h-1.5 accent-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Size */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">宽度</label>
                    <input type="number" value={selectedNode.width || 160} onChange={(e) => updateNode(selectedNode.id, { width: Math.max(60, Number(e.target.value)) })} className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">高度</label>
                    <input type="number" value={selectedNode.height || 50} onChange={(e) => updateNode(selectedNode.id, { height: Math.max(30, Number(e.target.value)) })} className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none" />
                  </div>
                </div>

                {/* Border */}
                <div className="h-px bg-slate-200"></div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">
                    <i className="fa-solid fa-border-style text-[8px] text-indigo-400 mr-1"></i>边框设置
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">边框宽度</label>
                      <input type="number" value={selectedNode.borderWidth || 1} onChange={(e) => updateNode(selectedNode.id, { borderWidth: Math.max(0, Number(e.target.value)) })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">边框颜色</label>
                      <input type="color" value={selectedNode.borderColor || 'rgba(255,255,255,0.15)'} onChange={(e) => updateNode(selectedNode.id, { borderColor: e.target.value })} className="w-full h-7 mt-0.5 rounded-lg cursor-pointer border border-slate-200" />
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <label className="text-[8px] font-bold text-slate-400 uppercase">边框样式</label>
                    <div className="flex gap-1 mt-0.5">
                      {(['solid', 'dashed', 'dotted', 'none'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => updateNode(selectedNode.id, { borderStyle: s })}
                          className={`flex-1 px-1.5 py-1 rounded text-[8px] font-bold border transition-all ${(selectedNode.borderStyle || 'solid') === s ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                          {s === 'solid' ? '实线' : s === 'dashed' ? '虚线' : s === 'dotted' ? '点线' : '无'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div className="h-px bg-slate-200"></div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 block">
                    <i className="fa-solid fa-font text-[8px] text-indigo-400 mr-1"></i>标题排版
                  </label>
                  {/* Text Align */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm flex-1">
                      {[
                        { val: 'left', icon: 'fa-align-left' },
                        { val: 'center', icon: 'fa-align-center' },
                        { val: 'right', icon: 'fa-align-right' },
                      ].map(a => (
                        <button
                          key={a.val}
                          onClick={() => updateNode(selectedNode.id, { textAlign: a.val as any })}
                          className={`flex-1 py-1.5 rounded-md flex items-center justify-center text-[9px] transition-all ${(selectedNode.textAlign || 'center') === a.val ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                          <i className={`fa-solid ${a.icon}`}></i>
                        </button>
                      ))}
                    </div>
                    {/* Bold / Italic */}
                    <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm">
                      <button
                        onClick={() => updateNode(selectedNode.id, { fontWeight: selectedNode.fontWeight === '700' ? '400' : '700' })}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black transition-all ${(selectedNode.fontWeight || '700') === '700' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                      >B</button>
                      <button
                        onClick={() => updateNode(selectedNode.id, { fontStyle: selectedNode.fontStyle === 'italic' ? 'normal' : 'italic' })}
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-serif italic transition-all ${selectedNode.fontStyle === 'italic' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}
                      >I</button>
                    </div>
                  </div>
                  {/* Font Size & Weight */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">字号</label>
                      <input type="number" value={selectedNode.fontSize || 14} onChange={(e) => updateNode(selectedNode.id, { fontSize: Math.max(8, Number(e.target.value)) })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">字重</label>
                      <select value={selectedNode.fontWeight || '700'} onChange={(e) => updateNode(selectedNode.id, { fontWeight: e.target.value })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none">
                        <option value="400">Normal</option>
                        <option value="600">Semi Bold</option>
                        <option value="700">Bold</option>
                        <option value="800">Extra Bold</option>
                        <option value="900">Black</option>
                      </select>
                    </div>
                  </div>
                  {/* Font Family */}
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase">字体族</label>
                    <select
                      value={selectedNode.fontFamily || 'inherit'}
                      onChange={(e) => updateNode(selectedNode.id, { fontFamily: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none"
                    >
                      {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Sub Text Typography */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase mb-1.5 block">
                    <i className="fa-solid fa-text-height text-[8px] text-violet-400 mr-1"></i>副标题排版
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">字号</label>
                      <input type="number" value={selectedNode.subTextFontSize || 10} onChange={(e) => updateNode(selectedNode.id, { subTextFontSize: Math.max(6, Number(e.target.value)) })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">字重</label>
                      <select value={selectedNode.subTextFontWeight || '400'} onChange={(e) => updateNode(selectedNode.id, { subTextFontWeight: e.target.value })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none">
                        <option value="400">Normal</option>
                        <option value="600">Semi Bold</option>
                        <option value="700">Bold</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">颜色</label>
                      <input type="color" value={selectedNode.subTextColor || '#ffffff'} onChange={(e) => updateNode(selectedNode.id, { subTextColor: e.target.value })} className="w-full h-6 mt-0.5 rounded-lg cursor-pointer border border-slate-200" />
                    </div>
                  </div>
                </div>

                {/* Connect / Delete Actions */}
                <div className="h-px bg-slate-200"></div>
                <div className="space-y-2">
                  {connectFromId === selectedNode.id ? (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-[10px] font-bold text-amber-700 mb-2">
                        <i className="fa-solid fa-link mr-1"></i> 选择目标节点
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {allNodes.filter(n => n.id !== selectedNode.id).map(n => (
                          <button
                            key={n.id}
                            onClick={() => { addConnection(selectedNode.id, n.id); setConnectFromId(null); }}
                            className="w-full px-2 py-1 text-left bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-amber-50 hover:border-amber-300 transition-all"
                          >
                            {n.text}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setConnectFromId(null)} className="w-full mt-1.5 py-1 text-[10px] text-slate-400 hover:text-slate-600">取消</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConnectFromId(selectedNode.id)}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 transition-all flex items-center justify-center gap-1.5"
                    >
                      <i className="fa-solid fa-link text-[8px]"></i> 从此节点创建连接
                    </button>
                  )}
                  <button
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[10px] font-bold text-rose-600 transition-all flex items-center justify-center gap-1.5"
                  >
                    <i className="fa-solid fa-trash-can text-[8px]"></i> 删除节点
                  </button>
                </div>
              </div>
            )}

            {/* Connections List with Editing */}
            {data && (() => {
              // 选中节点时只显示相关连线，否则显示全部
              const filteredConns = selectedNodeId
                ? data.connections.filter(c => c.from === selectedNodeId || c.to === selectedNodeId)
                : data.connections;
              if (filteredConns.length === 0) return null;
              return (
              <div className="mt-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                  {selectedNodeId ? '相关连接线' : '连接线列表'} ({filteredConns.length})
                </h3>
                <div className="space-y-1">
                  {filteredConns.map(conn => {
                    const fromNode = allNodes.find(n => n.id === conn.from);
                    const toNode = allNodes.find(n => n.id === conn.to);
                    const isExpanded = editingConnId === conn.id;
                    return (
                      <div key={conn.id} className="bg-slate-50 rounded-lg border border-slate-200 group">
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                          onClick={() => setEditingConnId(isExpanded ? null : conn.id)}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: conn.color || '#90A4AE' }} />
                          <span className="text-[10px] text-slate-600 flex-1 truncate">
                            {fromNode?.text || '?'} → {toNode?.text || '?'}
                            {conn.label && <span className="text-slate-400 ml-1">({conn.label})</span>}
                          </span>
                          <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[7px] text-slate-300`}></i>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                            className="w-5 h-5 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <i className="fa-solid fa-xmark text-[8px]"></i>
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="px-2 pb-2 pt-1 border-t border-slate-200 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">标签</label>
                              <input
                                value={conn.label || ''}
                                onChange={(e) => updateConnection(conn.id, { label: e.target.value })}
                                className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none"
                                placeholder="可选标签"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">颜色</label>
                                <input type="color" value={conn.color || '#90A4AE'} onChange={(e) => updateConnection(conn.id, { color: e.target.value })} className="w-full h-6 mt-0.5 rounded cursor-pointer border border-slate-200" />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">线宽</label>
                                <input type="number" value={conn.width || 2} onChange={(e) => updateConnection(conn.id, { width: Math.max(1, Number(e.target.value)) })} className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">线型</label>
                                <div className="flex gap-1 mt-0.5">
                                  {(['solid', 'dashed', 'dotted'] as const).map(s => (
                                    <button
                                      key={s}
                                      onClick={() => updateConnection(conn.id, { style: s })}
                                      className={`flex-1 px-1 py-0.5 rounded text-[8px] font-bold border transition-all ${conn.style === s ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase">箭头</label>
                                <div className="flex gap-1 mt-0.5">
                                  {([
                                    { key: 'forward', label: '→' },
                                    { key: 'bidirectional', label: '↔' },
                                    { key: 'none', label: '—' },
                                  ] as const).map(opt => (
                                    <button
                                      key={opt.key}
                                      onClick={() => updateConnection(conn.id, { arrowType: opt.key })}
                                      className={`flex-1 px-1 py-0.5 rounded text-[9px] font-bold border transition-all ${conn.arrowType === opt.key ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Label Styling */}
                            <div className="border-t border-slate-100 pt-2">
                              <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">
                                <i className="fa-solid fa-tag text-[8px] text-violet-400 mr-1"></i>标签样式
                              </label>
                              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase">字号</label>
                                  <input type="number" value={conn.labelFontSize || 10} onChange={(e) => updateConnection(conn.id, { labelFontSize: Math.max(6, Number(e.target.value)) })} className="w-full mt-0.5 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                                </div>
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase">字重</label>
                                  <select value={conn.labelFontWeight || '600'} onChange={(e) => updateConnection(conn.id, { labelFontWeight: e.target.value })} className="w-full mt-0.5 px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-indigo-400 outline-none">
                                    <option value="400">Normal</option>
                                    <option value="600">Semi</option>
                                    <option value="700">Bold</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase">字体族</label>
                                  <select value={conn.labelFontFamily || 'inherit'} onChange={(e) => updateConnection(conn.id, { labelFontFamily: e.target.value })} className="w-full mt-0.5 px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] focus:ring-1 focus:ring-indigo-400 outline-none">
                                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase">文字色</label>
                                  <input type="color" value={conn.labelColor || '#64748b'} onChange={(e) => updateConnection(conn.id, { labelColor: e.target.value })} className="w-full h-5 mt-0.5 rounded cursor-pointer border border-slate-200" />
                                </div>
                                <div>
                                  <label className="text-[8px] font-bold text-slate-400 uppercase">背景色</label>
                                  <input type="color" value={conn.labelBgColor || '#ffffff'} onChange={(e) => updateConnection(conn.id, { labelBgColor: e.target.value })} className="w-full h-5 mt-0.5 rounded cursor-pointer border border-slate-200" />
                                </div>
                              </div>
                              {/* Label Position */}
                              <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase">标签位置</label>
                                <div className="flex gap-1 mt-0.5">
                                  {([
                                    { val: 'above', label: '上方' },
                                    { val: 'on-line', label: '线上' },
                                    { val: 'below', label: '下方' },
                                  ] as const).map(pos => (
                                    <button
                                      key={pos.val}
                                      onClick={() => updateConnection(conn.id, { labelPosition: pos.val })}
                                      className={`flex-1 px-1 py-0.5 rounded text-[8px] font-bold border transition-all ${(conn.labelPosition || 'on-line') === pos.val ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}
                                    >
                                      {pos.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              ); })()}
          </>
        )}

        {/* === Global Config Section === */}
        {activeSection === 'global' && data && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">全局设置</h3>

            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase">图表标题</label>
              <input
                value={data.title}
                onChange={(e) => logic.setData({ ...data, title: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-indigo-400 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">层间距</label>
                <input type="number" value={data.globalConfig.layerGap} onChange={(e) => updateGlobalConfig({ layerGap: Math.max(0, Number(e.target.value)) })} className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">画布宽度</label>
                <input type="number" value={data.globalConfig.canvasWidth} onChange={(e) => updateGlobalConfig({ canvasWidth: Math.max(600, Number(e.target.value)) })} className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">显示分隔线</label>
                <button
                  onClick={() => updateGlobalConfig({ showSeparators: !data.globalConfig.showSeparators })}
                  className={`w-full mt-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${data.globalConfig.showSeparators ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                >
                  {data.globalConfig.showSeparators ? '✓ 显示' : '✗ 隐藏'}
                </button>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">分隔线颜色</label>
                <input type="color" value={data.globalConfig.separatorColor || '#90A4AE'} onChange={(e) => updateGlobalConfig({ separatorColor: e.target.value })} className="w-full h-8 mt-1 rounded-lg cursor-pointer border border-slate-200" />
              </div>
            </div>

            {/* Global Font & Typography */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">
                  <i className="fa-solid fa-font text-[8px] text-indigo-400 mr-1"></i>全局字体族
                </label>
                <select
                  value={data.globalConfig.globalFontFamily || 'inherit'}
                  onChange={(e) => updateGlobalConfig({ globalFontFamily: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none"
                >
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">标题字号</label>
                <input type="number" value={data.globalConfig.titleFontSize || 14} onChange={(e) => updateGlobalConfig({ titleFontSize: Math.max(8, Number(e.target.value)) })} className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-400 outline-none" />
              </div>
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">快捷键</h4>
              <div className="space-y-1 text-[10px] text-slate-500">
                <div className="flex justify-between"><span>撤销</span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[8px] font-mono">⌘Z</kbd></div>
                <div className="flex justify-between"><span>重做</span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[8px] font-mono">⌘⇧Z</kbd></div>
                <div className="flex justify-between"><span>删除节点</span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[8px] font-mono">Delete</kbd></div>
                <div className="flex justify-between"><span>取消选择</span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[8px] font-mono">Esc</kbd></div>
                <div className="flex justify-between"><span>编辑文本</span><span className="text-[8px]">双击节点</span></div>
              </div>
            </div>

            {/* === 全局默认排版：时间轴 + 侧边标注 === */}
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
              <h4 className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">
                <i className="fa-solid fa-timeline text-[8px] mr-1"></i>时间轴默认样式
              </h4>
              <p className="text-[8px] text-amber-500 mb-2">新阶段自动继承此样式，单个阶段可覆盖</p>
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <div>
                  <label className="text-[7px] text-amber-500">字号</label>
                  <input type="number" value={data.globalConfig.timelineStyle?.fontSize ?? 11} onChange={(e) => updateGlobalConfig({ timelineStyle: { ...data.globalConfig.timelineStyle, fontSize: Math.max(8, Number(e.target.value)) } })} className="w-full mt-0.5 px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[9px] focus:ring-1 focus:ring-amber-400 outline-none" />
                </div>
                <div>
                  <label className="text-[7px] text-amber-500">字重</label>
                  <select value={data.globalConfig.timelineStyle?.fontWeight ?? '800'} onChange={(e) => updateGlobalConfig({ timelineStyle: { ...data.globalConfig.timelineStyle, fontWeight: e.target.value } })} className="w-full mt-0.5 px-1 py-0.5 bg-white border border-amber-200 rounded text-[9px]">
                    <option value="400">Normal</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option><option value="900">Black</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <input type="color" value={data.globalConfig.timelineStyle?.color ?? '#475569'} onChange={(e) => updateGlobalConfig({ timelineStyle: { ...data.globalConfig.timelineStyle, color: e.target.value } })} className="w-6 h-6 rounded cursor-pointer border border-amber-200 shrink-0" />
                <div className="flex bg-white p-0.5 rounded border border-amber-200">
                  <button onClick={() => updateGlobalConfig({ timelineStyle: { ...data.globalConfig.timelineStyle, fontWeight: Number(data.globalConfig.timelineStyle?.fontWeight ?? 800) >= 700 ? '400' : '700' } })} className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-black transition-all ${Number(data.globalConfig.timelineStyle?.fontWeight ?? 800) >= 700 ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>B</button>
                  <button onClick={() => updateGlobalConfig({ timelineStyle: { ...data.globalConfig.timelineStyle, fontStyle: data.globalConfig.timelineStyle?.fontStyle === 'italic' ? 'normal' : 'italic' } })} className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-serif italic transition-all ${data.globalConfig.timelineStyle?.fontStyle === 'italic' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}>I</button>
                </div>
                <select value={data.globalConfig.timelineStyle?.fontFamily ?? 'inherit'} onChange={(e) => updateGlobalConfig({ timelineStyle: { ...data.globalConfig.timelineStyle, fontFamily: e.target.value } })} className="flex-1 px-1 py-0.5 bg-white border border-amber-200 rounded text-[8px]">
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!data.timeline?.length) return;
                  const timeline = data.timeline.map(p => ({ ...p, fontSize: undefined, fontWeight: undefined, fontFamily: undefined, fontStyle: undefined, color: undefined } as any));
                  logic.setData({ ...data, timeline });
                }}
                className="w-full mt-2 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-[9px] font-bold text-amber-700 transition-all flex items-center justify-center gap-1"
              >
                <i className="fa-solid fa-arrows-rotate text-[8px]"></i> 应用到全部时间轴阶段
              </button>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200">
              <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2">
                <i className="fa-solid fa-align-left text-[8px] mr-1"></i>侧边标注默认样式
              </h4>
              <p className="text-[8px] text-indigo-400 mb-2">新标注自动继承此样式，单条标注可覆盖</p>
              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                <div>
                  <label className="text-[7px] text-indigo-400">字号</label>
                  <input type="number" value={data.globalConfig.sideAnnotationStyle?.fontSize ?? 13} onChange={(e) => updateGlobalConfig({ sideAnnotationStyle: { ...data.globalConfig.sideAnnotationStyle, fontSize: Math.max(8, Number(e.target.value)) } })} className="w-full mt-0.5 px-1.5 py-0.5 bg-white border border-indigo-200 rounded text-[9px] focus:ring-1 focus:ring-indigo-400 outline-none" />
                </div>
                <div>
                  <label className="text-[7px] text-indigo-400">字重</label>
                  <select value={data.globalConfig.sideAnnotationStyle?.fontWeight ?? '800'} onChange={(e) => updateGlobalConfig({ sideAnnotationStyle: { ...data.globalConfig.sideAnnotationStyle, fontWeight: e.target.value } })} className="w-full mt-0.5 px-1 py-0.5 bg-white border border-indigo-200 rounded text-[9px]">
                    <option value="400">Normal</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option><option value="900">Black</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="color" value={data.globalConfig.sideAnnotationStyle?.color ?? '#475569'} onChange={(e) => updateGlobalConfig({ sideAnnotationStyle: { ...data.globalConfig.sideAnnotationStyle, color: e.target.value } })} className="w-6 h-6 rounded cursor-pointer border border-indigo-200 shrink-0" />
                <div className="flex bg-white p-0.5 rounded border border-indigo-200">
                  <button onClick={() => updateGlobalConfig({ sideAnnotationStyle: { ...data.globalConfig.sideAnnotationStyle, fontWeight: Number(data.globalConfig.sideAnnotationStyle?.fontWeight ?? 800) >= 700 ? '400' : '700' } })} className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-black transition-all ${Number(data.globalConfig.sideAnnotationStyle?.fontWeight ?? 800) >= 700 ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>B</button>
                  <button onClick={() => updateGlobalConfig({ sideAnnotationStyle: { ...data.globalConfig.sideAnnotationStyle, fontStyle: data.globalConfig.sideAnnotationStyle?.fontStyle === 'italic' ? 'normal' : 'italic' } })} className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-serif italic transition-all ${data.globalConfig.sideAnnotationStyle?.fontStyle === 'italic' ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}>I</button>
                </div>
                <select value={data.globalConfig.sideAnnotationStyle?.fontFamily ?? 'inherit'} onChange={(e) => updateGlobalConfig({ sideAnnotationStyle: { ...data.globalConfig.sideAnnotationStyle, fontFamily: e.target.value } })} className="flex-1 px-1 py-0.5 bg-white border border-indigo-200 rounded text-[8px]">
                  {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!data.layers.length) return;
                  const layers = data.layers.map(layer => ({
                    ...layer,
                    sideAnnotations: layer.sideAnnotations?.map(ann => ({ ...ann, fontSize: undefined, fontWeight: undefined, fontFamily: undefined, fontStyle: undefined, color: undefined } as any))
                  }));
                  logic.setData({ ...data, layers });
                }}
                className="w-full mt-2 py-1.5 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-lg text-[9px] font-bold text-indigo-700 transition-all flex items-center justify-center gap-1"
              >
                <i className="fa-solid fa-arrows-rotate text-[8px]"></i> 应用到全部侧边标注
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Library Modal (SchemeLibraryModal) */}
      <SchemeLibraryModal<SavedMindMap>
        show={showLibrary}
        onClose={() => setShowLibrary(false)}
        items={savedList}
        onLoad={handleLoadFromLibrary}
        onDelete={handleDeleteFromLibrary}
        onRename={handleRenameInLibrary}
        onCategoryChange={logic.handleCategoryChange}
        moduleIcon="fa-sitemap"
        moduleLabel="框架思维图"
        renderExtra={(item) => (
          <span className="text-[8px] text-slate-400 font-bold">{item.data.layers.length} 层</span>
        )}
      />

      {/* Save Modal (inline overlay) */}
      {showSaveModal && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center rounded-2xl p-6">
          <h3 className="text-sm font-black text-slate-800 mb-4">保存框架思维图</h3>
          <input
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            placeholder="输入标题..."
          />
          <div className="flex gap-2 mt-4 w-full">
            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all">取消</button>
            <button onClick={() => handleConfirmSave()} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all">确认保存</button>
          </div>
        </div>
      )}
    </div>
  );
};
