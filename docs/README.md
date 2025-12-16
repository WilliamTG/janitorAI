# JanitorAI Documentation

Welcome to the JanitorAI project documentation.

## Table of Contents

### Configuration & Environments
- **[environments.md](./environments.md)** - Environment configuration guide for API URLs and build profiles
  - How to set API URLs per build profile
  - How to verify configuration with the debug screen
  - Troubleshooting environment issues

### Building & Distribution
- **[testing-builds.md](./testing-builds.md)** - Guide for creating and distributing builds using EAS Build
  - EAS Build setup and configuration
  - Creating development, preview, and production builds
  - Distributing builds to testers
  - iOS and Android specific instructions

### Implementation Details
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Detailed summary of the environment configuration implementation
  - Architecture and design decisions
  - File-by-file changes
  - Testing and verification
  - Security considerations
  - Troubleshooting guide

## Quick Start

### For Developers
1. **Configure Environment**: See [environments.md](./environments.md)
2. **Build the App**: See [testing-builds.md](./testing-builds.md)
3. **Test Configuration**: Use the debug screen in development builds

### For Testers
1. **Install the build** you received (APK or TestFlight)
2. **Open the app** and go to "Explore" tab
3. **Access debug screen** (dev builds only) to verify configuration
4. **Check health status** to ensure backend connectivity

### For Understanding Changes
1. **Read the implementation summary**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
2. **Review environment configuration**: [environments.md](./environments.md)

## Key Concepts

### Build Profiles
The app uses three EAS Build profiles:
- **development** - For internal development with debugging tools
- **preview** - For QA testing and beta testers
- **production** - For production app store releases

Each profile can have its own backend API URL configuration.

### API Configuration
All API URLs are managed through `src/config/api.ts`:
- `getApiBaseUrl()` - Returns the backend base URL
- `getApiHealthUrl()` - Returns the health check endpoint
- `getBuildProfile()` - Returns the current build profile
- `isDevelopmentBuild()` - Returns whether this is a dev build

### Debug Screen
A development-only screen (accessible via Explore tab) that shows:
- Current build profile
- API base URL configuration
- Live backend health check

**Note**: Debug screen is automatically hidden in production builds.

## Common Tasks

### Change Backend URL for Preview Builds
Edit `frontend/eas.json`:
```json
{
  "build": {
    "preview": {
      "env": {
        "API_BASE_URL": "https://your-staging-backend.com"
      }
    }
  }
}
```

Then rebuild with `eas build --profile preview`.

### Create a Preview Build
```bash
cd frontend
eas build --profile preview --platform android
# or
eas build --profile preview --platform ios
```

### Verify Configuration
1. Install a development or preview build
2. Open app → Explore tab → Debug Information
3. Check build profile and API URL
4. Verify health check shows ✅

## Security Notes

- **No secrets in mobile app**: All API keys and secrets remain in backend environment variables
- **Public information only**: Mobile app only contains backend URLs (public information)
- **Tester tokens**: Managed client-side, stored in device AsyncStorage

## Support & Troubleshooting

For issues related to:
- **Environment configuration**: See [environments.md](./environments.md#troubleshooting)
- **Build failures**: See [testing-builds.md](./testing-builds.md)
- **Implementation details**: See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md#troubleshooting-guide)

## Project Structure

```
janitorAI/
├── backend/           # Node.js Express backend
├── frontend/          # React Native Expo frontend
│   ├── app/          # App screens and routes
│   ├── src/
│   │   └── config/   # Configuration (API URLs, etc.)
│   ├── app.config.js # Dynamic app configuration
│   └── eas.json      # EAS Build profiles
└── docs/             # Documentation (you are here)
```

## Related Resources

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [React Native Documentation](https://reactnative.dev/)
- [expo-constants Documentation](https://docs.expo.dev/versions/latest/sdk/constants/)
