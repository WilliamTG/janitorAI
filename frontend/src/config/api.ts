/**
 * API Configuration
 * 
 * Provides a single source of truth for API base URLs.
 * Uses expo-constants to read configuration from app.config.js based on build profile.
 */

import Constants from 'expo-constants';

/**
 * Get the API base URL for the current build environment.
 * Falls back to production URL if not configured.
 */
export function getApiBaseUrl(): string {
  const baseUrl = Constants.expoConfig?.extra?.API_BASE_URL;
  
  if (!baseUrl) {
    console.warn('API_BASE_URL not configured in app.config.js, using default');
    return 'https://janitorai-backend.onrender.com';
  }
  
  return baseUrl;
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
