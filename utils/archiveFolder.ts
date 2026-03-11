import { ResearchProject } from '../types';

export interface ArchiveFolderMeta {
  projectId?: string;
  projectTitle?: string;
  milestoneId?: string;
  milestoneTitle?: string;
  logId?: string;
  logTitle?: string;
  path: string;
}

export const buildArchiveFolderMeta = (
  projects: ResearchProject[],
  projectId?: string,
  milestoneId?: string,
  logId?: string
): ArchiveFolderMeta => {
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;
  const milestone = project && milestoneId ? project.milestones.find(m => m.id === milestoneId) : undefined;
  const log = milestone && logId ? milestone.logs.find(l => l.id === logId) : undefined;
  const projectTitle = project?.title || '未分配项目';
  const milestoneTitle = milestone?.title || '未分配节点';
  const logTitle = log?.content || '未关联实验记录';
  return {
    projectId,
    projectTitle,
    milestoneId,
    milestoneTitle,
    logId,
    logTitle,
    path: `${projectTitle} / ${milestoneTitle} / ${logTitle}`
  };
};

