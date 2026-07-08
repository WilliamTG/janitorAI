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

## User Preferences

- Keep the project's existing monorepo structure (npm workspaces)
- Do not restructure or migrate the stack
