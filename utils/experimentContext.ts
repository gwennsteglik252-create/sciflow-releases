import { ExperimentLog, ResearchProject } from '../types';

export interface LinkedExperimentRef {
  projectId: string;
  milestoneId: string;
  logId: string;
}

interface ResolveContextOptions {
  projects: ResearchProject[];
  selectedProjectId?: string;
  savedRecords?: any[];
  currentRecordId?: string | null;
  fallbackRef?: LinkedExperimentRef | null;
}

export interface ResolvedExperimentContext {
  ref: LinkedExperimentRef;
  source: 'linked' | 'folder' | 'fallback' | 'latest';
  projectTitle: string;
  milestoneTitle: string;
  log: ExperimentLog;
}

const isValidRef = (ref: any): ref is LinkedExperimentRef =>
  Boolean(ref?.projectId && ref?.milestoneId && ref?.logId);

const pickRefFromRecord = (record: any): { ref: LinkedExperimentRef | null; source: 'linked' | 'folder' | null } => {
  if (!record) return { ref: null, source: null };
  if (isValidRef(record.linkedContext)) return { ref: record.linkedContext, source: 'linked' };
  if (isValidRef(record?.data?.linkedContext)) return { ref: record.data.linkedContext, source: 'linked' };
  const folderRef = {
    projectId: record?.folder?.projectId,
    milestoneId: record?.folder?.milestoneId,
    logId: record?.folder?.logId
  };
  if (isValidRef(folderRef)) return { ref: folderRef, source: 'folder' };
  return { ref: null, source: null };
};

export const resolveExperimentRef = (
  projects: ResearchProject[],
  ref: LinkedExperimentRef
): Omit<ResolvedExperimentContext, 'source'> | null => {
  const project = projects.find(p => p.id === ref.projectId);
  const milestone = project?.milestones.find(m => m.id === ref.milestoneId);
  const log = milestone?.logs.find(l => l.id === ref.logId);
  if (!project || !milestone || !log) return null;
  return {
    ref,
    projectTitle: project.title,
    milestoneTitle: milestone.title,
    log
  };
};

export const findLatestExperimentRef = (
  projects: ResearchProject[],
  selectedProjectId?: string
): LinkedExperimentRef | null => {
  const scopedProjects = selectedProjectId
    ? projects.filter(p => p.id === selectedProjectId)
    : projects;
  let best: { ref: LinkedExperimentRef; score: number } | null = null;
  for (const project of scopedProjects) {
    for (let mi = 0; mi < project.milestones.length; mi++) {
      const milestone = project.milestones[mi];
      for (let li = 0; li < milestone.logs.length; li++) {
        const log = milestone.logs[li];
        const parsed = Date.parse(log.timestamp || '');
        const score = Number.isFinite(parsed) ? parsed : (mi + 1) * 1e6 + li;
        const ref = { projectId: project.id, milestoneId: milestone.id, logId: log.id };
        if (!best || score > best.score) best = { ref, score };
      }
    }
  }
  return best?.ref || null;
};

export const resolveContextForAnalysis = ({
  projects,
  selectedProjectId,
  savedRecords = [],
  currentRecordId = null,
  fallbackRef = null
}: ResolveContextOptions): ResolvedExperimentContext | null => {
  const currentRecord = currentRecordId ? savedRecords.find(r => r.id === currentRecordId) : null;
  const fromRecord = pickRefFromRecord(currentRecord);
  if (fromRecord.ref) {
    const resolved = resolveExperimentRef(projects, fromRecord.ref);
    if (resolved) return { ...resolved, source: fromRecord.source! };
  }

  if (fallbackRef) {
    const resolved = resolveExperimentRef(projects, fallbackRef);
    if (resolved) return { ...resolved, source: 'fallback' };
  }

  const latest = findLatestExperimentRef(projects, selectedProjectId);
  if (!latest) return null;
  const resolved = resolveExperimentRef(projects, latest);
  return resolved ? { ...resolved, source: 'latest' } : null;
};

export const buildContextSummary = (ctx: ResolvedExperimentContext): string => {
  const scientificPairs = Object.entries(ctx.log.scientificData || {})
    .slice(0, 4)
    .map(([k, v]) => `${k}:${v}`);
  const scientificText = scientificPairs.length ? scientificPairs.join('; ') : '无结构化指标';
  return [
    `课题:${ctx.projectTitle}`,
    `节点:${ctx.milestoneTitle}`,
    `记录:${(ctx.log.content || '').slice(0, 48) || '未命名记录'}`,
    `描述:${(ctx.log.description || '').slice(0, 72) || '无'}`,
    `参数:${(ctx.log.parameters || '').slice(0, 72) || '无'}`,
    `指标:${scientificText}`
  ].join(' | ');
};
