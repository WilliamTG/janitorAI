# JanitorAI Monorepo

This repository hosts the mobile app (Expo + Expo Router) and API (Node/Express) in a single npm workspace layout.

## Project Structure

- `apps/api` — Node/Express API (Render deploy target)
- `apps/mobile` — Expo Router mobile app (EAS/TestFlight deploy target)
- `packages/shared` — Placeholder for shared types/schemas/constants
- `docs` — Documentation and deployment notes

## Installation

Install dependencies from the repository root using npm workspaces:

```bash
npm install
```

> If you only want to install a single workspace, run `npm install` inside that workspace directory instead.

## Development

From the repository root:

- Start the API: `npm run dev:api`
- Start the mobile app: `npm run dev:mobile`
- Start both concurrently: `npm run dev`

You can also run scripts directly inside each workspace:

```bash
cd apps/api && npm start
cd apps/mobile && npm start
```

## Environment Variables

- **API (`apps/api/.env`)**: unchanged variable names such as `PORT`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, and `OPENAI_TRANSCRIBE_MODEL`. The API loads them via `dotenv` when `npm start` runs in `apps/api`.
- **Mobile (`apps/mobile`)**: build profile comes from `EAS_BUILD_PROFILE` or `APP_ENV`. Optional `API_BASE_URL` can override the backend URL in `app.config.js` during builds. See `docs/environments.md` for details.

## Deployment

See `docs/DEPLOYMENT.md` for Render (API) and EAS/TestFlight (mobile) deployment settings. Additional build guidance remains in `docs/environments.md` and `docs/testing-builds.md`.
