/**
 * Expo app configuration with environment-based settings.
 * 
 * This file replaces app.json to enable dynamic configuration based on
 * EAS build profiles (development, preview, production).
 * 
 * Environment variables are set in eas.json for each build profile.
 */

module.exports = ({ config }) => {
  // Read environment variables from EAS build process
  const API_BASE_URL = process.env.API_BASE_URL || 'https://janitorai-backend.onrender.com';
  const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || process.env.BUILD_PROFILE || 'unknown';
  
  return {
    ...config,
    expo: {
      name: 'inspection-mvp',
      slug: 'inspection-mvp',
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/images/icon.png',
      scheme: 'inspectionmvp',
      userInterfaceStyle: 'automatic',
      newArchEnabled: true,
      ios: {
        supportsTablet: true,
        bundleIdentifier: 'com.yourcompany.inspectionmvp',
        buildNumber: '1',
      },
      android: {
        adaptiveIcon: {
          backgroundColor: '#E6F4FE',
          foregroundImage: './assets/images/android-icon-foreground.png',
          backgroundImage: './assets/images/android-icon-background.png',
          monochromeImage: './assets/images/android-icon-monochrome.png',
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        package: 'com.yourcompany.inspectionmvp',
        versionCode: 1,
      },
      web: {
        output: 'static',
        favicon: './assets/images/favicon.png',
      },
      plugins: [
        'expo-router',
        [
          'expo-splash-screen',
          {
            image: './assets/images/splash-icon.png',
            imageWidth: 200,
            resizeMode: 'contain',
            backgroundColor: '#ffffff',
            dark: {
              backgroundColor: '#000000',
            },
          },
        ],
      ],
      experiments: {
        typedRoutes: true,
        reactCompiler: true,
      },
      // Extra configuration available at runtime via Constants.expoConfig.extra
      extra: {
        API_BASE_URL,
        BUILD_PROFILE,
        APP_ENV: BUILD_PROFILE, // Alias for compatibility
      },
    },
  };
};
