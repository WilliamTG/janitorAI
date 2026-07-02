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
