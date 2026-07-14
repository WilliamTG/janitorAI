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
