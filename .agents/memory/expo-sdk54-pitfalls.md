---
name: Expo SDK 54 pitfalls
description: Quirks hit while adding cloud sync to the Expo app (file-system API move, media auth via query token)
---

- `expo-file-system` v19 (SDK 54) replaced the old API; `documentDirectory`, `moveAsync`, etc. now live in `expo-file-system/legacy`. Importing from the root package fails typecheck (and would fail at runtime).
  **How to apply:** any new code needing the classic FileSystem API must import from `expo-file-system/legacy`. Pre-existing code in the DOCX export still uses the root import and has known (pre-existing) TS errors.
- `<Image>` and audio players cannot set HTTP headers, so authenticated media downloads use a `?token=` query param accepted by the backend media route.
  **Why:** the Render backend requires the tester token on every request.
  **How to apply:** never log raw URLs server-side without redacting `token` (the request logger redacts it); keep header auth for all non-media requests.
- Baseline `npx tsc --noEmit` in `apps/mobile` has ~15 pre-existing errors (Buttons.tsx style types, `headerBackTitleVisible`, theme `glass`, DOCX export FS usage). Don't try to fix them incidentally; only keep new files clean.
