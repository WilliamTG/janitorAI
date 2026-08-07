/**
 * API Configuration
 *
 * Priority order:
 *  1. EXPO_PUBLIC_API_URL  — set as a build-time env var on Render (or any CI).
 *     Metro inlines all EXPO_PUBLIC_* vars into the static bundle at export time.
 *  2. Constants.expoConfig.extra.API_BASE_URL — set via app.json/app.config.js
 *     for EAS native builds (iOS / Android).
 *  3. Auto-detect: localhost:3000 in dev (__DEV__), production Render URL otherwise.
 */

import Constants from 'expo-constants';

/**
 * Get the API base URL for the current build environment.
 */
export function getApiBaseUrl(): string {
  // 1. Build-time env var (Render static site, any CI pipeline)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl !== undefined && envUrl !== '') {
    return envUrl;
  }

  // 2. EAS / app.config extra field (native builds)
  const extraUrl = Constants.expoConfig?.extra?.API_BASE_URL as string | undefined;
  if (extraUrl !== undefined && extraUrl !== '') {
    return extraUrl;
  }

  // 3. Automatic fallback
  if (__DEV__) {
    // Local Expo dev server — backend runs on the same machine
    return 'http://localhost:3000';
  }

  return 'https://janitorai-backend.onrender.com';
}

/**
 * Get the API health check URL.
 */
export function getApiHealthUrl(): string {
  return `${getApiBaseUrl()}/health`;
}

/**
 * Get the current build profile/environment name.
 * Returns undefined if not configured.
 */
export function getBuildProfile(): string | undefined {
  return Constants.expoConfig?.extra?.BUILD_PROFILE;
}

/**
 * Check if running in development mode.
 */
export function isDevelopment(): boolean {
  return __DEV__;
}
