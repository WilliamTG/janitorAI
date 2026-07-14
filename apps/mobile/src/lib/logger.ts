/**
 * logger.ts – silent client-side logging to the backend.
 * Failures are swallowed so the logger never crashes the app.
 *
 * Log writes are accepted by the backend even without a valid tester token,
 * so errors from unauthenticated sessions (e.g. background syncs before
 * first login) appear in the admin Logs tab. A stable device_id is sent
 * with every write so anonymous entries remain attributable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';
import { getCachedTesterToken } from './apiFetch';

const DEVICE_ID_KEY = 'DEVICE_ID';
let cachedDeviceId: string | null = null;

/** Generate a simple random hex string (no external deps). */
function generateDeviceId(): string {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Return the stable device ID, creating and persisting one on first call.
 * Falls back to an in-memory value if AsyncStorage is unavailable.
 */
async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      cachedDeviceId = stored;
      return cachedDeviceId;
    }
    const fresh = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    cachedDeviceId = fresh;
    return cachedDeviceId;
  } catch {
    // AsyncStorage unavailable — use an in-memory id for this session.
    if (!cachedDeviceId) cachedDeviceId = generateDeviceId();
    return cachedDeviceId;
  }
}

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
 * @param error    The caught error (or any value).
 * @param context  Short label for where the error happened (e.g. "media-upload").
 */
export async function logError(error: unknown, context?: string): Promise<void> {
  try {
    const message =
      error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error ? (error.stack ?? undefined) : undefined;
    const deviceId = await getDeviceId();

    await fetch(`${getApiBaseUrl()}/api/logs/error`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        error_message: message,
        stack_trace: stack,
        action_context: context ?? null,
        device_info: getDeviceInfo(),
        device_id: deviceId,
      }),
    });
  } catch {
    // Intentionally silent — logger must never crash the app.
  }
}

/**
 * Log a completed action with its elapsed time.
 * @param action      Short label (e.g. "media-upload").
 * @param durationMs  Elapsed milliseconds.
 */
export async function logAction(action: string, durationMs: number): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await fetch(`${getApiBaseUrl()}/api/logs/action`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({ action, duration_ms: durationMs, device_id: deviceId }),
    });
  } catch {
    // Intentionally silent — logger must never crash the app.
  }
}
