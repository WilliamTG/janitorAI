import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../config/api';

const STORAGE_KEY = 'TESTER_TOKEN';
let cachedToken: string | null = null;

export class UnauthorizedError extends Error {
  status: number;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

/**
 * Synchronous access to the in-memory token (may be null before first load).
 * Used to build media URLs that cannot set headers (e.g. <Image> sources).
 */
export function getCachedTesterToken(): string | null {
  return cachedToken;
}

export async function loadTesterToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(STORAGE_KEY);
    return cachedToken;
  } catch {
    console.warn('Failed to load tester token from storage');
    return null;
  }
}

export async function setTesterToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token === null) {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, token);
    }
  } catch {
    console.warn('Failed to persist tester token');
  }
}

export async function clearTesterToken(): Promise<void> {
  cachedToken = null;
  await setTesterToken(null);
}

export interface ApiFetchInit extends RequestInit {
  skipAuthHandling?: boolean;
}

export async function validateTesterToken(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const response = await apiFetch(`${getApiBaseUrl()}/whoami`, {
      method: 'GET',
      headers: {
        'x-tester-token': token,
      },
      skipAuthHandling: true,
    });

    if (response.ok) {
      cachedToken = token;
      return true;
    }

    return false;
  } catch (err) {
    console.warn('Token validation failed', err);
    return false;
  }
}

export default async function apiFetch(
  input: RequestInfo,
  init?: ApiFetchInit,
): Promise<Response> {
  const { skipAuthHandling, ...restInit } = init || {};
  const token = cachedToken ?? (await loadTesterToken());
  const headers = new Headers(restInit.headers || {});

  if (!headers.has('x-tester-token') && token) {
    headers.set('x-tester-token', token);
  }

  const merged: RequestInit = { ...restInit, headers };
  const response = await fetch(input, merged);

  if (!skipAuthHandling && response.status === 401) {
    await clearTesterToken();
    throw new UnauthorizedError();
  }

  return response;
}
