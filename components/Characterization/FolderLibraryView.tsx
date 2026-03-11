
import React, { useState, useMemo } from 'react';

interface FolderLibraryViewProps {
    records: any[];
    onLoad: (record: any) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    emptyText?: string;
}

interface FolderNode {
    label: string;
    children: FolderNode[];
    records: any[];
}

/** 按 folder.projectTitle → milestoneTitle → logTitle 构建三级树 */
const buildFolderTree = (records: any[]): FolderNode => {
    const root: FolderNode = { label: '全部', children: [], records: [] };
    const projectMap = new Map<string, FolderNode>();

    for (const rec of records) {
        const f = rec.folder;
        if (!f || !f.projectTitle || f.projectTitle === '未分配项目') {
            // 无归属 → 直接放根级
            root.records.push(rec);
            continue;
        }

        // ── 课题层 ──
        const projKey = f.projectId || f.projectTitle;
        if (!projectMap.has(projKey)) {
            const node: FolderNode = { label: f.projectTitle, children: [], records: [] };
            projectMap.set(projKey, node);
            root.children.push(node);
        }
        const projNode = projectMap.get(projKey)!;

        // ── 节点层 ──
        if (!f.milestoneTitle || f.milestoneTitle === '未分配节点') {
            projNode.records.push(rec);
            continue;
        }
        const msKey = `${projKey}::${f.milestoneId || f.milestoneTitle}`;
        let msNode = projNode.children.find(c => c.label === f.milestoneTitle);
        if (!msNode) {
            msNode = { label: f.milestoneTitle, children: [], records: [] };
            projNode.children.push(msNode);
        }

        // ── 实验记录层 ──
        if (!f.logTitle || f.logTitle === '未关联实验记录') {
            msNode.records.push(rec);
            continue;
        }
        let logNode = msNode.children.find(c => c.label === f.logTitle);
        if (!logNode) {
            logNode = { label: f.logTitle, children: [], records: [] };
            msNode.children.push(logNode);
        }
        logNode.records.push(rec);
    }

    return root;
};

const countAll = (node: FolderNode): number => {
    return node.records.length + node.children.reduce((s, c) => s + countAll(c), 0);
};

/* ─── 递归文件夹节点 ─── */
const FolderNodeView: React.FC<{
    node: FolderNode;
    depth: number;
    onLoad: (rec: any) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}> = ({ node, depth, onLoad, onDelete }) => {
    const [expanded, setExpanded] = useState(depth < 2);
    const total = countAll(node);
    const hasContent = total > 0;

    if (!hasContent) return null;

    const indent = depth * 16;
    const iconColor = depth === 0 ? 'text-indigo-500' : depth === 1 ? 'text-violet-500' : 'text-sky-500';
    const depthLabels = ['', '节点', '实验记录'];

    return (
        <div>
            {/* 文件夹行 */}
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all group text-left"
                style={{ paddingLeft: `${12 + indent}px` }}
            >
                <i className={`fa-solid ${expanded ? 'fa-folder-open' : 'fa-folder'} ${iconColor} text-sm transition-all`}></i>
                <span className="text-[11px] font-black text-slate-700 flex-1 truncate">{node.label}</span>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{total}</span>
                <i className={`fa-solid fa-chevron-${expanded ? 'down' : 'right'} text-[8px] text-slate-300 group-hover:text-slate-500 transition-all`}></i>
            </button>

            {/* 展开内容 */}
            {expanded && (
                <div className="animate-reveal">
                    {/* 子文件夹 */}
                    {node.children.map((child, idx) => (
                        <FolderNodeView
                            key={`folder-${depth}-${idx}-${child.label}`}
                            node={child}
                            depth={depth + 1}
                            onLoad={onLoad}
                            onDelete={onDelete}
                        />
                    ))}

                    {/* 文件（记录） */}
                    {node.records.map(rec => (
                        <div
                            key={rec.id}
                            onClick={() => onLoad(rec)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-indigo-50/60 cursor-pointer group/item transition-all border border-transparent hover:border-indigo-100"
                            style={{ paddingLeft: `${28 + indent}px` }}
                        >
                            <i className="fa-regular fa-file-lines text-slate-400 text-[11px] group-hover/item:text-indigo-500 transition-colors"></i>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-slate-700 truncate group-hover/item:text-indigo-700 transition-colors">{rec.title}</p>
                                <p className="text-[8px] text-slate-400 font-medium mt-0.5">{rec.timestamp}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(rec.id, e); }}
                                className="w-7 h-7 rounded-lg bg-white text-rose-300 hover:text-rose-500 hover:bg-rose-50 shadow-sm opacity-0 group-hover/item:opacity-100 transition-all shrink-0"
                            >
                                <i className="fa-solid fa-trash-can text-[9px]"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const FolderLibraryView: React.FC<FolderLibraryViewProps> = ({ records, onLoad, onDelete, emptyText }) => {
    const tree = useMemo(() => buildFolderTree(records), [records]);
    const hasAny = records.length > 0;

    if (!hasAny) {
        return <p className="text-center py-10 text-[10px] text-slate-400 italic">{emptyText || '暂无相关存档'}</p>;
    }

    return (
        <div className="space-y-0.5">
            {/* 子文件夹（课题级） */}
            {tree.children.map((child, idx) => (
                <FolderNodeView
                    key={`root-folder-${idx}-${child.label}`}
                    node={child}
                    depth={0}
                    onLoad={onLoad}
                    onDelete={onDelete}
                />
            ))}

            {/* 未归类的根级记录 */}
            {tree.records.length > 0 && (
                <FolderNodeView
                    node={{ label: '未分配', children: [], records: tree.records }}
                    depth={0}
                    onLoad={onLoad}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
};

export default FolderLibraryView;
