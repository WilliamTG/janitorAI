---
name: Sync design decisions
description: Rules behind the offline-first project sync between the Expo app and the Render backend
---

- Whole-project last-write-wins by `updatedAt`; server rejects stale PUTs and returns the newer copy. Deletes propagate via server tombstones.
  **Why:** demo-grade simplicity was the explicit requirement; per-field merging deferred (follow-up exists).
- Offline deletes must be queued locally (persisted pending-delete list) and replayed before any pull, otherwise a pull resurrects the deleted project from the server.
- Device-local URIs (`file://`, `content://`, `blob:`, `data:`) must be stripped from project payloads sent to the server whenever a `remoteId` exists — another device's local path is meaningless elsewhere. The origin device restores its local URIs on pull by merging with its stored copy.
- Media uploads are deduped by local URI (in-memory cache + in-flight promise map) because remote IDs persisted to storage may not be reflected in stale in-memory React state, which would otherwise re-upload the same file.
- Backend responses 503 (no DATABASE_URL) and 404 (backend not redeployed with sync routes) both mean "cloud sync unavailable" → app shows "Cloud sync not set up" and stays device-only; 401 means bad/missing tester token → "Sync error".
