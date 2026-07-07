---
name: Sync design decisions
description: Rules behind the offline-first project sync between the Expo app and the Render backend
---

- Project-level fields (name, inspector, report, description*) use whole-project last-write-wins by `updatedAt`; server rejects stale PUTs and returns the newer copy. Deletes propagate via server tombstones.
- Notes use **per-note merge** (union by note id, newest-per-note by `note.updatedAt`) during `pullAndMerge` when a project exists on both sides, so concurrent offline edits on two devices don't lose each other's notes. Note deletions are tracked as project-embedded tombstones (`Project.deletedNotes`: id→ISO time) that sync inside the project JSON — no new backend route. A note stays deleted unless it was edited *after* its tombstone time (edit-after-delete resurrects).
  **Why:** whole-project LWW silently discarded the losing device's new notes. **How to apply:** every note write must go through `applyNoteChanges(prev, nextNotes)` (stamps note `updatedAt`, records/clears tombstones); the merge in `mergeProjects` returns `changed` and only pushes back when the merged result differs from server, which is what prevents ping-pong loops (merged `updatedAt` = max of both sides, never a fresh `now`).
- Offline deletes must be queued locally (persisted pending-delete list) and replayed before any pull, otherwise a pull resurrects the deleted project from the server.
- Device-local URIs (`file://`, `content://`, `blob:`, `data:`) must be stripped from project payloads sent to the server whenever a `remoteId` exists — another device's local path is meaningless elsewhere. The origin device restores its local URIs on pull by merging with its stored copy.
- Media uploads are deduped by local URI (in-memory cache + in-flight promise map) because remote IDs persisted to storage may not be reflected in stale in-memory React state, which would otherwise re-upload the same file.
- Backend responses 503 (no DATABASE_URL) and 404 (backend not redeployed with sync routes) both mean "cloud sync unavailable" → app shows "Cloud sync not set up" and stays device-only; 401 means bad/missing tester token → "Sync error".
