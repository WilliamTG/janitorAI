# JanitorAI — Inspection MVP

A monorepo for property inspections. Field inspectors collect notes, voice recordings, photos, and short video clips on their mobile device, then generate AI-powered Word reports.

## Project Structure

```
apps/mobile/   — Expo React Native app (TypeScript)
apps/api/      — Node.js / Express backend
ai-engine/     — Python / FastAPI AI engine (Gemini video analysis)
packages/      — Shared types and utilities
```

## Running the Mobile App (Expo Web)

The configured workflow runs:
```
cd apps/mobile && npx expo start --web --port 5000
```

The app is viewable in the browser preview at port 5000.

## Running the API

```
cd apps/api && npm start
```

Requires env secrets: `OPENAI_API_KEY`, `DATABASE_URL`, `TESTER_TOKEN`.

## Key Features

- Create inspection projects with name, date, inspector
- Add text notes, voice recordings, photos, and video clips (≤2 min / ≤40 MB)
- AI auto-describe photos via `/describe-image`
- AI transcribe voice notes via `/transcribe`
- Generate AI inspection report via `/report`
- Export report as `.docx` via `/report/docx`
- Offline-first local storage with cloud sync (last-write-wins)

## Auth

All AI/report endpoints are protected by `x-tester-token` header. Demo users enter this token once in the app; it is stored locally.

## Media Limits

- Photos: max 8 MB (compressed at quality 0.6, exif stripped)
- Videos: max 2 minutes duration, max 40 MB file size
- Server upload cap: 50 MB per file (media route), 20 MB (transcribe/describe-image)

## Presentation Maintenance

The slide deck lives in `presentation/index.html`. Hardcoded limits in the slides are annotated with
`<!-- LIMIT: ... — source: <file> — last verified: <month year> -->` comments so they are easy to locate.

When you change any of the values below, search the presentation for the corresponding `LIMIT:` comment
and update both the visible text **and** the `last verified` date:

| What changed | Source file | Slides to update |
|---|---|---|
| 50 MB server upload cap | `apps/api/src/routes/media.js` (`limits.fileSize`) | 04, 05, 08, 10 |
| 2-min / 40 MB video limits | `apps/mobile` (video picker config) | 03 |
| General rate limit (300 req / 15 min) | `apps/api/src/middleware/rateLimiters.js` (`generalLimiter`) | 08, 10 |
| Heavy rate limit (30 req / 15 min) | `apps/api/src/middleware/rateLimiters.js` (`heavyLimiter`) | 08, 10 |
| Disk-full threshold (90%) | `apps/api/src/diskSpace.js` (`CRITICAL_PERCENT`) | 05, 10 |

## User Preferences

- Keep the project's existing monorepo structure (npm workspaces)
- Do not restructure or migrate the stack
