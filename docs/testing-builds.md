# Testing Builds with EAS Build

This document describes how to create and distribute installable test builds using **EAS Build** instead of Expo Go tunnel testing.

## Overview

The project uses **Managed Expo Workflow** (Expo SDK 54.0.25) with EAS Build for creating installable builds for testers.

**📚 For environment configuration details**, see [`environments.md`](./environments.md) which explains:
- How API base URLs are configured per build profile
- How to verify configuration using the debug screen
- How to change backend URLs for different environments

## Build Profiles

We have configured the following EAS build profiles in `frontend/eas.json`:

### Development Profile
- **Purpose**: Internal development builds with dev-client for debugging
- **Distribution**: Internal
- **iOS**: Default resource class
- **Android**: Generates APK (debug build)

### Preview Profile
- **Purpose**: Internal/test distribution for QA and beta testers
- **Distribution**: Internal
- **iOS**: Default resource class, uploaded to TestFlight or ad-hoc distribution
- **Android**: Generates APK for direct installation

### Production Profile
- **Purpose**: Production-ready builds for app stores
- **iOS**: Default resource class
- **Android**: Generates AAB (Android App Bundle) for Play Store

## Running EAS Build Commands

### Prerequisites

1. Install EAS CLI globally (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. Log in to your Expo account:
   ```bash
   eas login
   ```

3. Configure your project (first time only):
   ```bash
   cd frontend
   eas build:configure
   ```

### Building for Development

Build development builds for internal testing with dev-client:

**Android:**
```bash
npm run build:dev:android
```

**iOS:**
```bash
npm run build:dev:ios
```

After building a development build, start Metro bundler for dev-client:
```bash
npm run run:dev
```

### Building for Preview/Testing

Build preview builds for testers (QA, beta testers):

**Android:**
```bash
npm run build:preview:android
```

**iOS:**
```bash
npm run build:preview:ios
```

### Building for Production

For production builds ready for app store submission:

**Android:**
```bash
eas build --profile production --platform android
```

**iOS:**
```bash
eas build --profile production --platform ios
```

## Installing Builds for Testers

### Android Installation

1. After the build completes, EAS will provide a download URL
2. Share this URL with testers
3. Testers download the APK file to their Android device
4. Enable "Install from Unknown Sources" in device settings
5. Open the downloaded APK to install

**Alternative: Internal Testing via Google Play Console**
- Upload the APK/AAB to Google Play Console's Internal Testing track
- Add tester email addresses in the Google Play Console
- Testers receive an invitation link to install via Play Store

### iOS Installation

iOS builds require additional setup and must be distributed through TestFlight or ad-hoc provisioning:

**TestFlight Distribution (Recommended):**
1. Build completes on EAS
2. Upload the build to App Store Connect
3. Add testers in TestFlight
4. Testers receive an invitation and install via TestFlight app

**Ad-hoc Distribution:**
- Requires adding device UDIDs to your Apple Developer account
- Download the IPA file and distribute via third-party services (e.g., Diawi, TestFlight alternatives)

## Replacing Expo Go QR Code Testing

### Before (Expo Go with Tunnel):
- Developers ran `expo start --tunnel`
- Generated a QR code
- Testers scanned QR code in Expo Go app
- Limited to Expo Go compatibility

### After (EAS Build):
- Developers/CI create installable builds using EAS Build
- Builds are distributed as APK (Android) or via TestFlight (iOS)
- Testers install the actual app on their devices
- Full native functionality, no Expo Go limitations
- Better represents production environment

## Required External Portal Configuration

Before you can successfully build and distribute your app, you need to complete the following setup in external portals:

### Apple Developer Portal (iOS)
- [ ] Create an App ID with bundle identifier: `com.yourcompany.inspectionmvp` (update this placeholder!)
- [ ] Generate and download certificates (Distribution Certificate)
- [ ] Create provisioning profiles (Development, Ad-hoc, or App Store)
- [ ] Register tester device UDIDs for ad-hoc distribution
- [ ] Configure app capabilities (push notifications, etc.) if needed

### Google Play Console (Android)
- [ ] Create an app with package name: `com.yourcompany.inspectionmvp` (update this placeholder!)
- [ ] Configure internal testing track
- [ ] Add tester email addresses for internal testing
- [ ] Upload builds to internal testing track
- [ ] Generate and configure signing keys (if using Play App Signing)

### Expo Dashboard
- [ ] Create a project in Expo dashboard (if not already created)
- [ ] Link your project to the Expo account used with EAS CLI
- [ ] Configure credentials for iOS/Android in EAS dashboard
- [ ] Set up any required environment variables or secrets
- [ ] Review build quotas and upgrade plan if needed

### Important: Update Bundle/Package Identifiers

The current configuration uses **placeholder** identifiers:
- iOS: `com.yourcompany.inspectionmvp`
- Android: `com.yourcompany.inspectionmvp`

**You MUST update these** in `frontend/app.json` to match your actual app identifiers before building:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.inspectionmvp"  // Update this!
    },
    "android": {
      "package": "com.yourcompany.inspectionmvp"  // Update this!
    }
  }
}
```

## Troubleshooting

### Build Fails Due to Credentials
- Ensure you've configured credentials in EAS: `eas credentials`
- For iOS, you need an Apple Developer account ($99/year)
- For Android, EAS can generate a keystore automatically

### iOS Build Requires Signing
- Run `eas credentials` to configure iOS certificates and provisioning profiles
- You can let EAS manage credentials automatically or upload your own

### Android Build Issues
- Check that package name is unique and follows Android naming conventions
- Ensure Gradle dependencies are compatible with the Expo SDK version

### Metro Bundler Connection Issues with Dev Client
- Ensure your device/emulator is on the same network as your development machine
- Use `npm run run:dev` to start Metro bundler before opening the dev client app

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Internal Distribution](https://docs.expo.dev/build/internal-distribution/)
- [TestFlight Setup](https://docs.expo.dev/submit/ios/#deploying-to-testflight)
