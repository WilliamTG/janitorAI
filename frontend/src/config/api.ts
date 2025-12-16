import Constants from 'expo-constants';

/**
 * Returns the backend API base URL based on the build profile.
 * 
 * In production builds, this will be set via EAS build profile configuration.
 * In development, it defaults to the production backend URL or can be overridden.
 * 
 * @returns {string} The base URL for API requests (without trailing slash)
 */
export function getApiBaseUrl(): string {
  // Try to read from expo config extra fields (set by app.config.js based on EAS build profile)
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra;
  
  if (extra && extra.API_BASE_URL) {
    return extra.API_BASE_URL;
  }
  
  // Fallback for local development without EAS build
  // This should not be reached in production builds
  console.warn('API_BASE_URL not configured via EAS build profile, using default');
  return 'https://janitorai-backend.onrender.com';
}

/**
 * Returns the health check endpoint URL.
 * 
 * @returns {string} The full URL for the health check endpoint
 */
export function getApiHealthUrl(): string {
  return `${getApiBaseUrl()}/health`;
}

/**
 * Returns the current build profile or environment name.
 * 
 * @returns {string} The build profile (development, preview, production, or 'unknown')
 */
export function getBuildProfile(): string {
  const extra = Constants.expoConfig?.extra || Constants.manifest?.extra;
  return extra?.BUILD_PROFILE || extra?.APP_ENV || 'unknown';
}

/**
 * Returns whether the app is running in a development build.
 * 
 * @returns {boolean} True if this is a development build
 */
export function isDevelopmentBuild(): boolean {
  return __DEV__ || getBuildProfile() === 'development';
}
