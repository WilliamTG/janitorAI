# Deployment

This repository is now organized as an npm workspace monorepo:

- `apps/api`: Node/Express API
- `apps/mobile`: Expo Router mobile app
- `packages/shared`: Reserved for shared code between apps
- `docs`: Documentation

## Render (API)

Render should point at the API workspace directly.

- **Root directory**: `apps/api`
- **Build command**: `npm install`
- **Start command**: `npm start`
- **Environment variables**: unchanged (e.g., `PORT`, `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`, `OPENAI_TRANSCRIBE_MODEL`). Store them in Render as before or in `apps/api/.env` for local runs.
- **Node version**: `>=18.18.0` (from the API package).

The API still uses `node src/index.js` as its entrypoint and loads environment variables with `dotenv` from the workspace root.

## EAS (Mobile)

EAS builds should target the mobile workspace.

- **Working directory**: `apps/mobile`
- **Install command**: `npm install`
- **Build commands**: run your existing `eas build` commands (e.g., `eas build --profile preview --platform ios`).
- **Environment variables**: `APP_ENV` (or `EAS_BUILD_PROFILE`) selects the build profile; optional `API_BASE_URL` override is read by `app.config.js`.

Expo Router continues to look for the `app/` directory inside `apps/mobile/app`, so no additional configuration is required after pointing EAS at the new workspace.
