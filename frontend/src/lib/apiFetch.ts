import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'TESTER_TOKEN';
let cachedToken: string | null = null;

export async function loadTesterToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(STORAGE_KEY);
    return cachedToken;
  } catch (err) {
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
  } catch (err) {
    console.warn('Failed to persist tester token');
  }
}

export default async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = cachedToken ?? (await loadTesterToken());
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('x-tester-token', token);
  const merged: RequestInit = { ...init, headers };
  return fetch(input, merged);
}
