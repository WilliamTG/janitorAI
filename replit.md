# JanitorAI Monorepo (Inspection MVP)

## Overview
npm-workspaces monorepo imported from GitHub:
- `apps/api` — Node/Express API (report generation, transcription, image description via OpenAI; DOCX export)
- `apps/mobile` — Expo Router mobile app (also runs as a web app via `expo start --web` / `expo export`)
- `packages/shared`, `packages/docx-builder` — shared workspace packages
- `ai-engine` — standalone Python service (deployed separately on Render originally; not run in this workspace)

## Replit Setup
- Install: `npm install` at repo root (workspaces).
- The backend is NOT run in Replit (user preference): the app talks directly to the live Render backend (`https://janitorai-backend.onrender.com`), which is the code's default in `app.config.js`.
- Workflow:
  - `Start application` (webview, port 5000): `cd apps/mobile && npx expo start --web --port 5000`. No `API_BASE_URL` override, so the app uses the Render backend.
- `app.config.js` honors an optional `API_BASE_URL` env override; empty string means "same origin" (see `apps/mobile/src/config/api.ts`). The Express API in `apps/api` can also serve the static web export (`apps/mobile/dist`) if a self-contained deployment is ever wanted again.
- Deployment (static): build runs `expo export --platform web` with `APP_ENV=production` (bakes in the Render backend URL); publishes `apps/mobile/dist`.

## Environment Variables
- `TESTER_TOKEN` — Replit secret set to the same value as the Render backend's token (used only for verification/testing from the workspace; the deployed backend on Render does the actual validation).
- Backend env vars (`OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_TRANSCRIBE_MODEL`) live on Render, not here.

## User Preferences
(none recorded yet)
