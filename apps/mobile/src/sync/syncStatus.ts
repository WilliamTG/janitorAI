import { useEffect, useState } from 'react';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'disabled';

let currentState: SyncState = 'idle';
const listeners = new Set<(state: SyncState) => void>();

export function setSyncState(state: SyncState): void {
  currentState = state;
  listeners.forEach((listener) => listener(state));
}

export function getSyncState(): SyncState {
  return currentState;
}

export function useSyncStatus(): SyncState {
  const [state, setState] = useState<SyncState>(currentState);

  useEffect(() => {
    const listener = (next: SyncState) => setState(next);
    listeners.add(listener);
    setState(currentState);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

// ---------- MEDIA UPLOAD FAILURE TRACKING ----------

export interface MediaFailureInfo {
  projectId: string;
  consecutiveFailures: number;
}

let mediaFailureInfo: MediaFailureInfo | null = null;
const mediaFailureListeners = new Set<(info: MediaFailureInfo | null) => void>();

export function setMediaUploadFailures(projectId: string, consecutiveFailures: number): void {
  mediaFailureInfo = { projectId, consecutiveFailures };
  mediaFailureListeners.forEach((l) => l(mediaFailureInfo));
}

export function clearMediaUploadFailures(projectId: string): void {
  if (mediaFailureInfo?.projectId === projectId) {
    mediaFailureInfo = null;
    mediaFailureListeners.forEach((l) => l(null));
  }
}

export function getMediaFailureInfo(): MediaFailureInfo | null {
  return mediaFailureInfo;
}

export function useMediaUploadError(): MediaFailureInfo | null {
  const [info, setInfo] = useState<MediaFailureInfo | null>(mediaFailureInfo);

  useEffect(() => {
    const listener = (next: MediaFailureInfo | null) => setInfo(next);
    mediaFailureListeners.add(listener);
    setInfo(mediaFailureInfo);
    return () => {
      mediaFailureListeners.delete(listener);
    };
  }, []);

  return info;
}

// ---------- OVERSIZED FILE TRACKING ----------
// Separate from the generic upload failure counter so that a permanently-rejected
// file doesn't increment the retry counter and trigger the wrong banner.

let oversizedFileDetected = false;
const oversizedFileListeners = new Set<(detected: boolean) => void>();

/** Call once when a FILE_TOO_LARGE response is received. Idempotent. */
export function recordOversizedFile(): void {
  if (!oversizedFileDetected) {
    oversizedFileDetected = true;
    oversizedFileListeners.forEach((l) => l(true));
  }
}

/** Reset the flag (e.g. when the project list is fully reloaded). */
export function clearOversizedFiles(): void {
  if (oversizedFileDetected) {
    oversizedFileDetected = false;
    oversizedFileListeners.forEach((l) => l(false));
  }
}

export function useOversizedFileError(): boolean {
  const [detected, setDetected] = useState(oversizedFileDetected);

  useEffect(() => {
    const listener = (next: boolean) => setDetected(next);
    oversizedFileListeners.add(listener);
    setDetected(oversizedFileDetected);
    return () => {
      oversizedFileListeners.delete(listener);
    };
  }, []);

  return detected;
}

// ---------- VIDEO UPLOAD PROGRESS ----------
// Per-URI upload progress (0–100). Stored in a plain Map; React components
// subscribe via useVideoUploadProgress() and re-render on each progress tick.

const videoUploadProgress = new Map<string, number>();
const videoProgressListeners = new Map<string, Set<(pct: number | null) => void>>();

export function setVideoUploadProgress(uri: string, pct: number): void {
  videoUploadProgress.set(uri, pct);
  videoProgressListeners.get(uri)?.forEach((l) => l(pct));
}

export function clearVideoUploadProgress(uri: string): void {
  videoUploadProgress.delete(uri);
  videoProgressListeners.get(uri)?.forEach((l) => l(null));
  videoProgressListeners.delete(uri);
}

export function useVideoUploadProgress(uri: string | undefined): number | null {
  const [pct, setPct] = useState<number | null>(
    uri != null ? (videoUploadProgress.get(uri) ?? null) : null,
  );

  useEffect(() => {
    if (uri == null) return;
    // Sync immediately with whatever the store has right now.
    setPct(videoUploadProgress.get(uri) ?? null);

    const listener = (next: number | null) => setPct(next);
    if (!videoProgressListeners.has(uri)) {
      videoProgressListeners.set(uri, new Set());
    }
    videoProgressListeners.get(uri)!.add(listener);
    return () => {
      videoProgressListeners.get(uri)?.delete(listener);
    };
  }, [uri]);

  return pct;
}

// ---------- MEDIA UPLOAD BATCH PROGRESS ----------
// «Laster opp 3 av 12» i synk-pillen (pilotfunn aug 2026: uten teller vet ikke
// takstpersonen om opplastingen jobber eller henger). Settes av
// uploadPendingMedia rundt hver kjøring og nullstilles når batchen er ferdig.

export interface MediaBatchProgress {
  done: number;
  total: number;
}

let mediaBatchProgress: MediaBatchProgress | null = null;
const mediaBatchListeners = new Set<(p: MediaBatchProgress | null) => void>();

export function setMediaBatchProgress(p: MediaBatchProgress | null): void {
  mediaBatchProgress = p;
  mediaBatchListeners.forEach((l) => l(p));
}

export function useMediaBatchProgress(): MediaBatchProgress | null {
  const [p, setP] = useState<MediaBatchProgress | null>(mediaBatchProgress);

  useEffect(() => {
    const listener = (next: MediaBatchProgress | null) => setP(next);
    mediaBatchListeners.add(listener);
    setP(mediaBatchProgress);
    return () => {
      mediaBatchListeners.delete(listener);
    };
  }, []);

  return p;
}
