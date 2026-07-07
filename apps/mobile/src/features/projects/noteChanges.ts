import { Note, Project } from './types';

/** Content signature of a note, ignoring its updatedAt stamp. */
function noteContentKey(note: Note): string {
  const { updatedAt, ...rest } = note;
  return JSON.stringify(rest);
}

/**
 * Apply a new set of notes to a project, stamping `updatedAt` on notes that
 * were added or changed and recording tombstones (`deletedNotes`) for notes
 * that were removed. Every note write should go through this so the per-note
 * merge across devices can tell "added on B" from "deleted on A" and pick the
 * newest version of each note.
 */
export function applyNoteChanges(prev: Project, nextNotes: Note[]): Project {
  const now = new Date().toISOString();
  const prevById = new Map((prev.notes || []).map((n) => [n.id, n]));

  const notes: Note[] = nextNotes.map((n) => {
    const before = prevById.get(n.id);
    if (!before) {
      return { ...n, updatedAt: n.updatedAt || now };
    }
    if (noteContentKey(before) !== noteContentKey(n)) {
      return { ...n, updatedAt: now };
    }
    return { ...n, updatedAt: n.updatedAt || before.updatedAt || before.createdAt };
  });

  const nextIds = new Set(nextNotes.map((n) => n.id));
  const deletedNotes: Record<string, string> = { ...(prev.deletedNotes || {}) };

  for (const id of prevById.keys()) {
    if (!nextIds.has(id)) deletedNotes[id] = now;
  }
  // A note that was re-added clears its tombstone.
  for (const id of nextIds) {
    if (deletedNotes[id]) delete deletedNotes[id];
  }

  return { ...prev, notes, deletedNotes };
}
