// Tidsmetrikk (inkorporering A3): «tid til godkjent rapport» er
// casestudie-valutaen og må kunne leses ut av hver sak. Beregnes fra data
// som allerede finnes — tidligste bevis-tidsstempel til godkjenningsstempelet
// — så historiske prosjekter får metrikken gratis.

import { Project } from './types';

function collectTimestamps(project: Project): number[] {
  const times: number[] = [];
  const push = (iso?: string) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) times.push(t);
  };
  for (const note of project.notes || []) {
    push(note.createdAt);
    push(note.videoCapturedAt);
    for (const photo of note.photos || []) push(photo.capturedAt);
  }
  return times;
}

/** Tidligste bevis-tidspunkt i saken (ms epoch), eller null uten bevis. */
export function firstEvidenceAt(project: Project): number | null {
  const times = collectTimestamps(project);
  return times.length ? Math.min(...times) : null;
}

/**
 * Minutter fra første bevis til godkjent rapport. Null når saken mangler
 * bevis, ikke er godkjent, eller klokkene gir et meningsløst (negativt
 * eller flerdøgns) spenn — da er tallet støy, ikke metrikk.
 */
export function minutesToApproved(project: Project): number | null {
  const approvedAt = project.reportApproval?.approvedAt;
  if (!approvedAt) return null;
  const start = firstEvidenceAt(project);
  if (start === null) return null;
  const end = new Date(approvedAt).getTime();
  if (Number.isNaN(end)) return null;
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 0 || minutes > 14 * 24 * 60) return null;
  return minutes;
}

/** «42 min» / «1 t 19 m» — kompakt norsk visning. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} t ${m} m` : `${h} t`;
}
