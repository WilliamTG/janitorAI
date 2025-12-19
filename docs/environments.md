# Environment Configuration

This document describes how to configure and build the mobile app for different environments using EAS Build.

## Overview

The app uses **environment-based configuration** to connect to the correct backend API based on the build profile. This eliminates the need for Expo Go tunneling and hardcoded URLs.

## How It Works

### Configuration Flow

1. **Build Profile** → Set via EAS Build profiles (`development`, `preview`, `production`)
2. **app.config.js** → Reads `EAS_BUILD_PROFILE` environment variable and injects `API_BASE_URL` into `expo.extra`
3. **Runtime** → App reads configuration from `Constants.expoConfig.extra` via `src/config/api.ts`
4. **API Calls** → All API calls use `getApiBaseUrl()` helper function

### Build Profiles

The app is configured with three build profiles in `apps/mobile/eas.json`:

#### Development Profile
- **Purpose**: Internal development with dev-client for debugging
- **Backend**: `https://janitorai-backend.onrender.com` (production backend)
- **Environment Variable**: `APP_ENV=development`
- **Distribution**: Internal

#### Preview Profile
- **Purpose**: Testing and QA builds for testers
- **Backend**: `https://janitorai-backend.onrender.com` (production backend)
- **Environment Variable**: `APP_ENV=preview`
- **Distribution**: Internal

#### Production Profile
- **Purpose**: Production-ready builds for app stores
- **Backend**: `https://janitorai-backend.onrender.com` (production backend)
- **Environment Variable**: `APP_ENV=production`
- **Distribution**: App Store / Play Store

> **Note**: All profiles currently point to the same production backend URL. To use different backends for different environments, update the `apiBaseUrl` switch statement in `app.config.js`.

## Configuring Backend URLs

### Option 1: Modify app.config.js (Recommended)

Edit `apps/mobile/app.config.js` to change backend URLs per profile:

```javascript
switch (buildProfile) {
  case 'production':
    apiBaseUrl = 'https://janitorai-backend.onrender.com';
    break;
  case 'preview':
    apiBaseUrl = 'https://staging-backend.onrender.com';  // Change this
    break;
  case 'development':
  default:
    apiBaseUrl = 'https://dev-backend.onrender.com';  // Change this
    break;
}
```

### Option 2: Use Environment Variables (Advanced)

You can override the URL at build time using environment variables in `eas.json`:

```json
{
  "build": {
    "preview": {
      "env": {
        "APP_ENV": "preview",
        "API_BASE_URL": "https://staging-backend.onrender.com"
      }
    }
  }
}
```

Then update `app.config.js` to check for this environment variable first:

```javascript
let apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  switch (buildProfile) {
    // ... fallback logic
  }
}
```

## Building the App

### Prerequisites

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Log in to your Expo account:
   ```bash
   eas login
   ```

3. Configure project (first time only):
   ```bash
   cd apps/mobile
   eas build:configure
   ```

### Build Commands

#### Preview Build (for Testers)

**Android:**
```bash
cd apps/mobile
eas build --profile preview --platform android
```

**iOS:**
```bash
cd apps/mobile
eas build --profile preview --platform ios
```

Or use the npm scripts:
```bash
npm run build:preview:android
npm run build:preview:ios
```

#### Production Build (for App Stores)

**Android:**
```bash
cd apps/mobile
eas build --profile production --platform android
```

**iOS:**
```bash
cd apps/mobile
eas build --profile production --platform ios
```

#### Development Build (for Developers)

**Android:**
```bash
npm run build:dev:android
```

**iOS:**
```bash
npm run build:dev:ios
```

## Verifying Configuration

### For Testers

After installing a build, testers can verify the configuration:

1. **Open the app**
2. **Navigate to the "Explore" tab**
3. **Tap the "🛠️ Debug Info" button** (only visible in development builds)
4. **Check the displayed information:**
   - Build Profile (development/preview/production)
   - API Base URL
   - Health check status (should show ✓ API is healthy)

> **Note**: The Debug Info button is only visible in development builds (`__DEV__ === true`). Preview and production builds will not show this button for security reasons.

### For Developers

During development (using `expo start`), you can:

1. Navigate to `/debug` route directly
2. View current configuration and test API health
3. Confirm the correct backend URL is being used

### Manual Health Check

You can also verify the backend connection manually:

```bash
# Check the health endpoint
curl https://janitorai-backend.onrender.com/health

# Expected response:
{"status":"ok"}
```

## API Configuration Files

### src/config/api.ts

Central configuration file that provides:

- `getApiBaseUrl()`: Returns the configured backend URL
- `getApiHealthUrl()`: Returns the health check endpoint URL
- `getBuildProfile()`: Returns the current build profile name
- `isDevelopment()`: Returns true if running in development mode

### app.config.js

Dynamic Expo configuration that:

- Reads the build profile from `EAS_BUILD_PROFILE` or `APP_ENV`
- Sets the appropriate `API_BASE_URL` in `expo.extra`
- Maintains all other app configuration (icons, splash screen, etc.)

## Troubleshooting

### "API_BASE_URL not configured" Warning

If you see this warning in the console:
- Check that `app.config.js` is being used (not `app.json`)
- Verify the build profile is set correctly in `eas.json`
- Ensure the app was built with EAS Build (not Expo Go)

### Health Check Fails

If the health check shows an error:
- Verify the backend is running and accessible
- Check your network connection
- Confirm the URL in `app.config.js` is correct
- Try accessing the health endpoint in a browser: `https://janitorai-backend.onrender.com/health`

### Debug Screen Not Showing

The debug screen is only available in development builds:
- Check that `__DEV__` is `true`
- Verify you're using a development build profile
- Preview and production builds intentionally hide the debug screen

### App Using Wrong Backend

1. Check which build profile was used to create the build
2. Verify `app.config.js` is setting the correct URL for that profile
3. Rebuild the app after making configuration changes

## Migration Notes

### What Changed

**Before:**
- Hardcoded `BACKEND_BASE_URL` in `app/config.ts`
- All API calls used string concatenation with hardcoded URL
- No environment-specific configuration
- Expo Go tunnel dependencies

**After:**
- Dynamic configuration via `app.config.js` and `src/config/api.ts`
- All API calls use `getApiBaseUrl()` helper
- Environment-based URLs via EAS build profiles
- No tunnel dependencies required

### Backend Unchanged

The backend remains unchanged:
- Still uses Render environment variables for secrets
- Still requires `x-tester-token` header (handled by `apiFetch` wrapper)
- No code changes needed on backend

## Security

### What's Protected

- Tester tokens are NOT committed (stored in device storage via AsyncStorage)
- No API keys or secrets in source code
- Backend secrets remain in Render environment variables
- Debug screen disabled in production builds

### What's Visible

- API base URLs are visible in the app configuration (this is acceptable)
- Build profiles are visible in development builds (this is acceptable)

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Constants Documentation](https://docs.expo.dev/versions/latest/sdk/constants/)
- [App Configuration Documentation](https://docs.expo.dev/workflow/configuration/)
- [Testing Builds Guide](./testing-builds.md)
