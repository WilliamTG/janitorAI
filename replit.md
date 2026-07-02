# JanitorAI Monorepo (Inspection MVP)

## Overview
npm-workspaces monorepo imported from GitHub:
- `apps/api` — Node/Express API (report generation, transcription, image description via OpenAI; DOCX export)
- `apps/mobile` — Expo Router mobile app (also runs as a web app via `expo start --web` / `expo export`)
- `packages/shared`, `packages/docx-builder` — shared workspace packages
- `ai-engine` — standalone Python service (deployed separately on Render originally; not run in this workspace)

## Replit Setup
- Install: `npm install` at repo root (workspaces).
- Workflows:
  - `Backend API` (console, port 3000): `npm --workspace apps/api run start`. Binds all interfaces; exposed externally on port 3000 so the web preview (proxied iframe) can reach it.
  - `Start application` (webview, port 5000): Expo web dev server, started with `API_BASE_URL=https://$REPLIT_DEV_DOMAIN:3000` so the browser calls the backend cross-origin (CORS is open on the API).
- `app.config.js` honors an `API_BASE_URL` env override; empty string means "same origin" (see `apps/mobile/src/config/api.ts`).
- Deployment (autoscale): build runs `expo export --platform web` with `API_BASE_URL=''`; run starts the Express API on port 5000, which serves the static web export from `apps/mobile/dist` and handles API routes same-origin.

## Environment Variables
- `TESTER_TOKEN` — required by the API auth guard (all routes except `/health`). A random development value is set in the Replit development environment; set a production value before publishing.
- `OPENAI_API_KEY` — needed for `/report`, `/transcribe`, `/describe-image`. Not set; API starts with a warning without it.
- `OPENAI_CHAT_MODEL`, `OPENAI_TRANSCRIBE_MODEL` — optional model overrides.

## User Preferences
(none recorded yet)
