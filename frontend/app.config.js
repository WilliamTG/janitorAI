/**
 * Expo App Configuration
 * 
 * Dynamically configures the app based on build profile.
 * Injects API_BASE_URL and BUILD_PROFILE into app's extra config.
 */

module.exports = ({ config }) => {
  // Determine build profile from EAS environment or APP_ENV
  const buildProfile = process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || 'development';
  
  // Configure API base URL based on build profile
  let apiBaseUrl;
  
  switch (buildProfile) {
    case 'production':
      apiBaseUrl = 'https://janitorai-backend.onrender.com';
      break;
    case 'preview':
      // Preview uses production backend (or configure staging URL here if available)
      apiBaseUrl = 'https://janitorai-backend.onrender.com';
      break;
    case 'development':
    default:
      // Development defaults to production backend (Render URL is acceptable per requirements)
      apiBaseUrl = 'https://janitorai-backend.onrender.com';
      break;
  }
  
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
      // Inject runtime configuration
      extra: {
        API_BASE_URL: apiBaseUrl,
        BUILD_PROFILE: buildProfile,
      },
    },
  };
};
