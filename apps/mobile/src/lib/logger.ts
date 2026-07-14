/**
 * logger.ts – silent client-side logging to the backend.
 * Failures are swallowed so the logger never crashes the app.
 */

import { getApiBaseUrl } from '../config/api';
import { getCachedTesterToken } from './apiFetch';

function buildHeaders(): Record<string, string> {
  const token = getCachedTesterToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['x-tester-token'] = token;
  return headers;
}

function getDeviceInfo(): Record<string, string> {
  try {
    return { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown' };
  } catch {
    return { userAgent: 'unknown' };
  }
}

/**
 * Log an error to the backend.
 * @param error  The caught error (or any value).
 * @param context  Short label for where the error happened (e.g. "generate-google-doc").
 */
export async function logError(error: unknown, context?: string): Promise<void> {
  try {
    const message =
      error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error ? (error.stack ?? undefined) : undefined;

    await fetch(`${getApiBaseUrl()}/api/logs/error`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        error_message: message,
        stack_trace: stack,
        action_context: context ?? null,
        device_info: getDeviceInfo(),
      }),
    });
  } catch {
    // Intentionally silent — logger must never crash the app.
  }
}

/**
 * Log a completed action with its elapsed time.
 * @param action      Short label (e.g. "generate-google-doc").
 * @param durationMs  Elapsed milliseconds.
 */
export async function logAction(action: string, durationMs: number): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/logs/action`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ action, duration_ms: durationMs }),
    });
  } catch {
    // Intentionally silent — logger must never crash the app.
  }
}
