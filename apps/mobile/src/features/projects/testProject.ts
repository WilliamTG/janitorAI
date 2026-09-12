import type { Project } from './types';

function nextTestProjectName(sourceName: string, projects: Project[]): string {
  const base = `${sourceName} — test`;
  const existingNames = new Set(projects.map((project) => project.name.trim().toLocaleLowerCase()));
  if (!existingNames.has(base.toLocaleLowerCase())) return base;

  let suffix = 2;
  while (existingNames.has(`${base} ${suffix}`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

/**
 * Creates an independent project document while deliberately reusing durable
 * media IDs owned by the same tester. Report output is never inherited: every
 * test copy starts ready for a fresh generation.
 */
export function createTestProjectCopy(
  source: Project,
  existingProjects: Project[],
  id: string,
  createdAt = new Date().toISOString(),
): Project {
  const cloned: Project = JSON.parse(JSON.stringify(source));
  const {
    report: _report,
    reportUrl: _reportUrl,
    reportStatus: _reportStatus,
    reportApproval: _reportApproval,
    reportDraft: _reportDraft,
    reportFinal: _reportFinal,
    reportError: _reportError,
    reportAttemptId: _reportAttemptId,
    updatedAt: _updatedAt,
    ...inspectionEvidence
  } = cloned;

  return {
    ...inspectionEvidence,
    id,
    name: nextTestProjectName(source.name, existingProjects),
    isTestProject: true,
    sourceProjectId: String(source.id),
    updatedAt: createdAt,
  };
}