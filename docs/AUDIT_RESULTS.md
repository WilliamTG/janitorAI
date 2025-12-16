# Audit Results: Tunnel & Hardcoded URL References

This document provides a comprehensive audit of all tunnel, localhost, and hardcoded URL references found in the repository, as required by the problem statement.

## Methodology

Searched for the following patterns across the entire repository:
- `ngrok`
- `tunnel`
- `localhost`
- `192.168.*`
- `inspection-backend.onrender.com`
- `BACKEND_BASE_URL`
- `API_URL`
- `baseUrl`

## Findings

### 1. Code References (Frontend)

#### ❌ REMOVED: `frontend/app/config.ts`
**Status:** DELETED (replaced by `src/config/api.ts`)

**Before (Lines 1-4):**
```typescript
// ⚠️ For personal/local testing only.
// Do NOT commit this file to a public repo.
// config.ts in the frontend project (NOT the backend)
export const BACKEND_BASE_URL = `https://janitorai-backend.onrender.com`;
```

**Issue:** Hardcoded backend URL, marked as "do not commit" but was committed
**Resolution:** File deleted, replaced with environment-based configuration

---

#### ✅ FIXED: `frontend/app/(tabs)/index.tsx`

**Before (Line 24):**
```typescript
import { BACKEND_BASE_URL } from "../config";
```

**Before (Line 399):**
```typescript
const response = await apiFetch(`${BACKEND_BASE_URL}/transcribe`, {
```

**Before (Line 548):**
```typescript
const response = await apiFetch(`${BACKEND_BASE_URL}/report`, {
```

**After:**
```typescript
import { getApiBaseUrl } from '../../src/config/api';
// ...
const response = await apiFetch(`${getApiBaseUrl()}/transcribe`, {
// ...
const response = await apiFetch(`${getApiBaseUrl()}/report`, {
```

**Resolution:** All references now use centralized `getApiBaseUrl()` function

---

### 2. Documentation References

#### ℹ️ CONTEXT ONLY: `docs/testing-builds.md`

**Line 3:**
```markdown
This document describes how to create and distribute installable test builds using **EAS Build** instead of Expo Go tunnel testing.
```

**Lines 128-133:**
```markdown
### Before (Expo Go with Tunnel):
- Developers ran `expo start --tunnel`
- Generated a QR code
- Testers scanned QR code in Expo Go app
- Limited to Expo Go compatibility
```

**Status:** Historical context, not actual code
**Resolution:** No changes needed, but added reference to new environment documentation

---

### 3. Package Dependencies

#### ℹ️ DEPENDENCIES ONLY: `frontend/package-lock.json`

**Found:**
- `@expo/mcp-tunnel` (line 1985)
- `@expo/ws-tunnel` (line 2241)

**Status:** Build dependencies, not runtime code
**Context:** These are Expo CLI dependencies used during development. They:
- Are not imported in any application code
- Do not affect production builds
- Are part of the Expo development toolchain

**Resolution:** No action needed - these are legitimate development dependencies

---

## Summary by Category

### 🔴 Critical Issues (Hardcoded URLs in Code)
| File | Pattern | Status |
|------|---------|--------|
| `frontend/app/config.ts` | `BACKEND_BASE_URL` | ✅ FIXED - File deleted |
| `frontend/app/(tabs)/index.tsx` | `BACKEND_BASE_URL` usage | ✅ FIXED - Uses `getApiBaseUrl()` |

### 🟡 Documentation References (Context Only)
| File | Pattern | Status |
|------|---------|--------|
| `docs/testing-builds.md` | "tunnel testing" | ℹ️ Historical context |
| `docs/testing-builds.md` | "expo start --tunnel" | ℹ️ Historical context |

### 🟢 Acceptable References (Dependencies)
| File | Pattern | Status |
|------|---------|--------|
| `frontend/package-lock.json` | `@expo/mcp-tunnel` | ℹ️ Dev dependency |
| `frontend/package-lock.json` | `@expo/ws-tunnel` | ℹ️ Dev dependency |

## Complete List of Occurrences

### Pattern: `BACKEND_BASE_URL`
1. ❌ `frontend/app/config.ts:4` - DELETED
2. ✅ `frontend/app/(tabs)/index.tsx:24` - FIXED (import)
3. ✅ `frontend/app/(tabs)/index.tsx:399` - FIXED (usage)
4. ✅ `frontend/app/(tabs)/index.tsx:548` - FIXED (usage)

### Pattern: `tunnel`
1. ℹ️ `docs/testing-builds.md:3` - Historical context
2. ℹ️ `docs/testing-builds.md:128` - Historical context
3. ℹ️ `frontend/package-lock.json:1985` - Dev dependency
4. ℹ️ `frontend/package-lock.json:2004` - Dev dependency
5. ℹ️ `frontend/package-lock.json:2241` - Dev dependency
6. ℹ️ `frontend/package-lock.json:6730` - Dev dependency
7. ℹ️ `frontend/package-lock.json:6739` - Dev dependency

### Pattern: `ngrok`
**Result:** No occurrences found ✅

### Pattern: `localhost`
**Result:** No occurrences found ✅

### Pattern: `192.168`
**Result:** No occurrences found ✅

### Pattern: `inspection-backend.onrender.com`
**Result:** No occurrences found ✅

### Pattern: `API_URL`
**Result:** No occurrences found ✅

### Pattern: `baseUrl`
**Result:** No occurrences found (case-sensitive) ✅

## Backend Verification

### Pattern: Environment Variables in Backend
**File:** `backend/src/index.js`

**Found (Lines 26-29):**
```javascript
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
```

**Status:** ✅ UNCHANGED (as required)
**Note:** Backend continues to use environment variables from Render, no changes made

## Resolution Summary

### Removed
- ❌ 1 file deleted: `frontend/app/config.ts` (hardcoded URL)
- ❌ 4 hardcoded URL references removed from runtime code

### Added
- ✅ 1 centralized config module: `frontend/src/config/api.ts`
- ✅ 1 dynamic config file: `frontend/app.config.js`
- ✅ 1 debug screen: `frontend/app/debug.tsx`
- ✅ Environment variables in `frontend/eas.json` for each build profile

### Modified
- ✅ 2 API call sites updated to use `getApiBaseUrl()`
- ✅ 1 navigation route added (debug screen)
- ✅ 1 explore tab updated (debug access)

### Unchanged (As Required)
- ✅ Backend environment variable handling
- ✅ Backend code
- ✅ Tester token modal and behavior
- ✅ Development dependencies (acceptable)

## Verification

### How to Verify No Hardcoded URLs Remain

Run the following searches in the repository:

```bash
# Search for hardcoded BACKEND_BASE_URL (should find 0 results in code)
cd frontend
grep -r "BACKEND_BASE_URL" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .

# Search for getApiBaseUrl usage (should find 3 results: definition + 2 usages)
grep -r "getApiBaseUrl" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules .

# Verify config module exists
ls -la src/config/api.ts

# Verify old config is gone
ls -la app/config.ts 2>&1 | grep "No such file"
```

### Expected Results
- ✅ No hardcoded `BACKEND_BASE_URL` in TypeScript files
- ✅ `getApiBaseUrl()` used in 2 places (index.tsx)
- ✅ `src/config/api.ts` exists
- ✅ `app/config.ts` does not exist

## Conclusion

All hardcoded URLs and tunnel dependencies have been successfully removed from runtime code:

- **0** hardcoded backend URLs in code
- **0** localhost references in code
- **0** tunnel references in runtime code
- **0** ngrok references
- **2** API call sites properly using centralized config
- **1** single source of truth for API configuration

The remaining tunnel references are:
1. Historical context in documentation (acceptable)
2. Development dependencies in package-lock.json (acceptable and expected)

✅ **Audit Complete: All requirements met**
