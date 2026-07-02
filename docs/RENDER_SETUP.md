# Render Setup — Cloud Persistence for Inspection Projects

The backend (`apps/api`) now persists projects, notes, reports, and media on the server.
This guide covers the one-time Render setup needed to enable it in production.

Until this setup is done, the backend responds with `503 { "error": "Cloud sync is not configured" }`
on the `/api/projects` routes and the app quietly falls back to device-only storage
(the sync pill shows "Cloud sync not set up").

## 1. Create a Postgres database

1. In the Render dashboard: **New → PostgreSQL**.
2. Pick the same region as the `janitorai-backend` web service.
3. The free/starter plan is fine for a demo; upgrade later if needed.
4. After it's created, copy the **Internal Database URL** (preferred when the
   database and web service are in the same region; otherwise use the External URL).

No manual schema setup is needed — the API creates its tables automatically on boot
(`projects`, `deleted_projects`, `media`).

## 2. Add a persistent disk for media files

Uploaded photos and voice recordings are stored on disk (not in Postgres).
Render's default filesystem is ephemeral — files vanish on every deploy — so attach a disk:

1. Open the `janitorai-backend` web service → **Disks** → **Add Disk**.
2. Name: `media`, Mount Path: `/var/data`, Size: 1 GB is plenty to start.
3. Note: adding a disk requires a paid instance type on Render.

If you skip the disk, media uploads still work but files are lost on each deploy
(project text/notes/reports remain safe in Postgres).

## 3. Set environment variables on the web service

On `janitorai-backend` → **Environment**:

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | the URL copied in step 1 | required to enable cloud sync |
| `MEDIA_DIR` | `/var/data/media` | must live on the mounted disk |
| `DATABASE_SSL` | `true` | only needed when using the **External** database URL; internal URLs and URLs containing `render.com`/`sslmode=require` enable SSL automatically |

Existing variables (`TESTER_TOKEN`, `OPENAI_API_KEY`, …) stay as they are.

## 4. Redeploy and verify

1. Deploy the latest code (push to the connected branch or **Manual Deploy → Deploy latest commit**).
2. Smoke test (replace `$TOKEN` with the tester token):

```bash
# Should return {"projects":[],"deleted":[]} (not a 503)
curl -s -H "x-tester-token: $TOKEN" https://janitorai-backend.onrender.com/api/projects

# Upsert a test project
curl -s -X PUT -H "x-tester-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"project":{"id":"smoke-1","name":"Smoke test","inspectionDate":"2026-01-01","inspector":"Test","notes":[],"updatedAt":"2026-01-01T00:00:00.000Z"}}' \
  https://janitorai-backend.onrender.com/api/projects/smoke-1

# Clean up
curl -s -X DELETE -H "x-tester-token: $TOKEN" https://janitorai-backend.onrender.com/api/projects/smoke-1
```

3. In the app, the sync pill on the home screen should switch from
   "Cloud sync not set up" to "Saved to cloud" after the next sync
   (tap the pill to sync immediately).

## How sync behaves

- **Offline-first**: every change is saved to the device first, then pushed to the
  server about 2 seconds later. If the device is offline the pill shows
  "Offline — saved on device" and data is pushed on the next manual sync or app start.
- **Last-write-wins**: if two devices edit the same project, the most recent
  `updatedAt` wins (the server rejects older writes; the losing device picks up the
  newer copy on its next pull).
- **Deletes** propagate through tombstones, so a project deleted on one device
  disappears from others after their next sync.
- **Media**: photos/audio are uploaded once and referenced by ID; the web app loads
  media from the server, native devices prefer their local copy and fall back to the
  server copy.
