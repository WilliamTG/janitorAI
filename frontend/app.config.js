/**
 * Expo App Configuration
 *
 * Dynamically configures the app based on build profile.
 * Injects API_BASE_URL and BUILD_PROFILE into app's extra config.
 */

module.exports = ({ config }) => {
  const buildProfile =
    process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || "development";

  let apiBaseUrl;
  switch (buildProfile) {
    case "production":
      apiBaseUrl = "https://janitorai-backend.onrender.com";
      break;
    case "preview":
      apiBaseUrl = "https://janitorai-backend.onrender.com";
      break;
    case "development":
    default:
      apiBaseUrl = "https://janitorai-backend.onrender.com";
      break;
  }

  return {
    // start from existing Expo config (important!)
    ...config,

    name: "inspection-mvp",
    slug: "inspection-mvp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "inspectionmvp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      ...(config.ios || {}),
      supportsTablet: true,
      bundleIdentifier: "com.yourcompany.inspectionmvp",
      buildNumber: "1",
    },

    android: {
      ...(config.android || {}),
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.yourcompany.inspectionmvp",
      versionCode: 1,
    },

    web: {
      ...(config.web || {}),
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: { backgroundColor: "#000000" },
        },
      ],
    ],

    experiments: {
      ...(config.experiments || {}),
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      ...(config.extra || {}),
      API_BASE_URL: apiBaseUrl,
      BUILD_PROFILE: buildProfile,
      eas: {
        projectId: "943e8965-076c-4370-96cc-62ecd3bf39e3",
      },
    },
  };
};
