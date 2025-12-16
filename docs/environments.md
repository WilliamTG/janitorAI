# Environment Configuration

This document describes how the app manages API base URLs and environment-specific configuration using EAS Build profiles.

## Overview

The app uses **EAS Build** with three profiles (development, preview, production) to control the backend API URL at build time. No hardcoded URLs or tunneling dependencies remain in the runtime code.

## How It Works

### 1. Configuration Files

#### `app.config.js`
- Replaces the static `app.json` with a dynamic configuration function
- Reads `API_BASE_URL` and `BUILD_PROFILE` from environment variables
- Exposes these values via `Constants.expoConfig.extra` at runtime

#### `eas.json`
- Defines three build profiles: `development`, `preview`, and `production`
- Each profile sets environment variables (`API_BASE_URL`, `BUILD_PROFILE`)
- Environment variables are injected during the EAS build process

#### `src/config/api.ts`
- Single source of truth for API configuration
- Exports helper functions:
  - `getApiBaseUrl()` - Returns the backend base URL
  - `getApiHealthUrl()` - Returns the health check endpoint URL
  - `getBuildProfile()` - Returns the current build profile name
  - `isDevelopmentBuild()` - Returns whether this is a development build

### 2. Build Profiles

The app has three EAS build profiles configured in `frontend/eas.json`:

#### Development Profile
```bash
cd frontend
eas build --profile development --platform android
eas build --profile development --platform ios
```
- **Purpose**: Internal development builds with dev-client for debugging
- **Backend**: Points to production backend URL (or can be changed to a dev backend)
- **Distribution**: Internal
- **Output**: APK (Android), development build (iOS)

#### Preview Profile
```bash
cd frontend
eas build --profile preview --platform android
eas build --profile preview --platform ios
```
- **Purpose**: Testing and QA builds for internal testers
- **Backend**: Points to production backend URL (or staging if available)
- **Distribution**: Internal (TestFlight for iOS, direct APK for Android)
- **Output**: APK (Android), ad-hoc or TestFlight (iOS)

#### Production Profile
```bash
cd frontend
eas build --profile production --platform android
eas build --profile production --platform ios
```
- **Purpose**: Production-ready builds for app stores
- **Backend**: Points to production backend URL
- **Distribution**: App stores
- **Output**: AAB (Android), App Store (iOS)

### 3. Setting API URLs per Profile

To change the backend URL for a specific profile, edit `frontend/eas.json`:

```json
{
  "build": {
    "preview": {
      "env": {
        "API_BASE_URL": "https://your-staging-backend.com",
        "BUILD_PROFILE": "preview"
      }
    }
  }
}
```

**Important**: 
- Do NOT commit secrets or tokens to `eas.json`
- Backend secrets (OPENAI_API_KEY, TESTER_TOKEN) are managed in Render environment variables, not in the mobile app

## Testing Configuration

### For Developers

1. **Local development with Expo Go** (limited):
   - Run `expo start` in the `frontend` directory
   - The app will use the fallback URL from `src/config/api.ts`
   - Note: Some native features require a development build

2. **Local development with dev client**:
   - Build a development build: `eas build --profile development --platform android --local`
   - Install on device/emulator
   - Run `expo start --dev-client`

### For Testers

After receiving a build (APK, TestFlight invite, etc.):

1. **Install the build** on your device
2. **Open the app** and navigate to the "Explore" tab
3. **Access the Debug Screen** (only visible in development/preview builds):
   - Scroll down to find "🔧 Debug Information (Dev Only)"
   - Tap "Open Debug Screen"
4. **Verify configuration**:
   - Check that "Build Profile" matches the expected profile (development/preview/production)
   - Check that "Base URL" points to the correct backend
   - Verify that "Health Check" shows ✅ (backend is reachable)

### Debug Screen Details

The debug screen shows:
- **Build Configuration**: Build profile, dev build status, `__DEV__` flag
- **API Configuration**: Base URL and health endpoint URL
- **Health Check**: Live test of backend connectivity

**Note**: The debug screen is only accessible in development and preview builds. It will not appear in production builds.

## Troubleshooting

### Problem: Health check fails
- **Check**: Verify the device has internet connectivity
- **Check**: Verify the backend URL is correct in `eas.json`
- **Check**: Verify the backend is actually running and accessible

### Problem: Wrong backend URL showing
- **Check**: Build was created with the correct profile (`--profile development|preview|production`)
- **Check**: `eas.json` has the correct `API_BASE_URL` for that profile
- **Rebuild**: Changes to `eas.json` require a new build

### Problem: Debug screen not appearing
- **Expected**: Debug screen only appears in development builds (when `isDevelopmentBuild()` returns true)
- **Check**: Build was created with `--profile development` or the `__DEV__` flag is set
- **Production**: This is intentional; debug screens are hidden in production builds

### Problem: API calls failing
- **Check**: Tester token is set (first-run modal in the app)
- **Check**: Backend is healthy (use debug screen health check)
- **Check**: Network connectivity

## Migration Notes

### What Changed
- ✅ Removed hardcoded `BACKEND_BASE_URL` from `app/config.ts`
- ✅ Created `src/config/api.ts` as single source of truth
- ✅ Converted `app.json` to `app.config.js` for dynamic configuration
- ✅ Updated `eas.json` with environment variables per profile
- ✅ Updated all API call sites to use `getApiBaseUrl()`
- ✅ Added dev-only debug screen for testing configuration

### What Didn't Change
- ❌ Backend code and environment variable handling (unchanged per requirements)
- ❌ Tester token modal and `x-tester-token` header behavior (unchanged)
- ❌ App functionality and features (unchanged)

## Security Notes

- **Never commit secrets**: The app only stores the backend URL and build profile
- **Tester tokens**: Managed client-side using AsyncStorage (same as before)
- **Backend secrets**: Managed in Render environment variables (unchanged)
- **API URLs**: Public information (backend URL), safe to include in builds
