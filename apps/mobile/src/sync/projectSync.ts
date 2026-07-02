import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/src/config/api';
import apiFetch, { UnauthorizedError } from '@/src/lib/apiFetch';
import { Note, Photo, Project } from '@/src/features/projects/types';
import { updateProject as updateProjectInStorage } from '@/src/storage/projectsStorage';
import { setSyncState } from './syncStatus';

const PUSH_DEBOUNCE_MS = 2000;

const pendingPushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingProjects = new Map<string, Project>();
let syncDisabled = false;

// Deletes that could not reach the server yet (offline). Persisted so a
// pull never resurrects a project the user deleted on this device.
const PENDING_DELETES_KEY = '@inspection_pending_deletes';

async function getPendingDeletes(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setPendingDeletes(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(ids));
  } catch {
    // best-effort
  }
}

async function addPendingDelete(id: string): Promise<void> {
  const ids = await getPendingDeletes();
  if (!ids.includes(id)) {
    ids.push(id);
    await setPendingDeletes(ids);
  }
}

async function removePendingDelete(id: string): Promise<void> {
  const ids = await getPendingDeletes();
  const next = ids.filter((x) => x !== id);
  if (next.length !== ids.length) {
    await setPendingDeletes(next);
  }
}

function projectsUrl(path = ''): string {
  return `${getApiBaseUrl()}/api/projects${path}`;
}

function mediaUploadUrl(): string {
  return `${getApiBaseUrl()}/api/media`;
}

function toTime(value?: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return isNaN(t) ? 0 : t;
}

export function touchProject(project: Project): Project {
  return { ...project, updatedAt: new Date().toISOString() };
}

// ---------- MEDIA UPLOAD ----------

function guessFileMeta(uri: string, kind: 'photo' | 'audio'): { name: string; type: string } {
  const extMatch = uri.split('?')[0].match(/\.([A-Za-z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : kind === 'photo' ? 'jpg' : 'm4a';
  const type = kind === 'photo' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `audio/${ext}`;
  return { name: `${kind}.${ext}`, type };
}

// Guard against duplicate uploads when a stale in-memory project (without
// the remoteId that was already persisted) is pushed again.
const uploadedByUri = new Map<string, string>();
const uploadsInFlight = new Map<string, Promise<string | null>>();

async function uploadMedia(
  uri: string,
  kind: 'photo' | 'audio',
  projectId: string,
): Promise<string | null> {
  const cached = uploadedByUri.get(uri);
  if (cached) return cached;

  const inFlight = uploadsInFlight.get(uri);
  if (inFlight) return inFlight;

  const promise = doUploadMedia(uri, kind, projectId).then((remoteId) => {
    uploadsInFlight.delete(uri);
    if (remoteId) uploadedByUri.set(uri, remoteId);
    return remoteId;
  });
  uploadsInFlight.set(uri, promise);
  return promise;
}

async function doUploadMedia(
  uri: string,
  kind: 'photo' | 'audio',
  projectId: string,
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('projectId', projectId);
    formData.append('kind', kind);

    const meta = guessFileMeta(uri, kind);

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) return null;
      const blob = await response.blob();
      const type = blob.type || meta.type;
      const ext = type.split('/')[1] || 'bin';
      formData.append('file', blob, `${kind}.${ext}`);
    } else {
      formData.append('file', { uri, name: meta.name, type: meta.type } as any);
    }

    const response = await apiFetch(mediaUploadUrl(), {
      method: 'POST',
      body: formData,
      skipAuthHandling: true,
    });

    if (!response.ok) {
      console.warn('[sync] Media upload failed', response.status);
      return null;
    }

    const data: any = await response.json();
    return typeof data.id === 'string' ? data.id : null;
  } catch (error) {
    console.warn('[sync] Media upload error', error);
    return null;
  }
}

/**
 * Upload any media that has no durable server copy yet.
 * Returns an updated project (with remote IDs) and whether anything changed.
 */
async function uploadPendingMedia(project: Project): Promise<{ project: Project; changed: boolean }> {
  let changed = false;

  const notes: Note[] = await Promise.all(
    (project.notes || []).map(async (note) => {
      let nextNote = note;

      if (note.audioUri && !note.audioRemoteId) {
        const remoteId = await uploadMedia(note.audioUri, 'audio', project.id);
        if (remoteId) {
          nextNote = { ...nextNote, audioRemoteId: remoteId };
          changed = true;
        }
      }

      if (note.photos && note.photos.length > 0) {
        const photos: Photo[] = await Promise.all(
          note.photos.map(async (photo) => {
            if (!photo.uri || photo.remoteId) return photo;
            const remoteId = await uploadMedia(photo.uri, 'photo', project.id);
            if (remoteId) {
              changed = true;
              return { ...photo, remoteId };
            }
            return photo;
          }),
        );
        nextNote = { ...nextNote, photos };
      }

      return nextNote;
    }),
  );

  let next: Project = { ...project, notes };

  if (project.projectDescriptionAudioUri && !project.projectDescriptionAudioRemoteId) {
    const remoteId = await uploadMedia(project.projectDescriptionAudioUri, 'audio', project.id);
    if (remoteId) {
      next = { ...next, projectDescriptionAudioRemoteId: remoteId };
      changed = true;
    }
  }

  return { project: next, changed };
}

// ---------- PUSH ----------

function isDeviceLocalUri(uri?: string): boolean {
  if (!uri) return false;
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:')
  );
}

/**
 * Server copies must not carry device-local file paths — they are meaningless
 * (and misleading) on other devices. Strip them where a durable remote copy
 * exists; the origin device restores its own local URIs on pull via
 * mergeLocalMediaUris.
 */
function stripLocalUrisForServer(project: Project): Project {
  const notes = (project.notes || []).map((note) => {
    let next = note;
    if (note.audioRemoteId && isDeviceLocalUri(note.audioUri)) {
      next = { ...next, audioUri: undefined };
    }
    if (note.photos && note.photos.some((p) => p.remoteId && isDeviceLocalUri(p.uri))) {
      next = {
        ...next,
        photos: note.photos.map((p) =>
          p.remoteId && isDeviceLocalUri(p.uri) ? { ...p, uri: '' } : p,
        ),
      };
    }
    return next;
  });

  let next: Project = { ...project, notes };
  if (
    next.projectDescriptionAudioRemoteId &&
    isDeviceLocalUri(next.projectDescriptionAudioUri)
  ) {
    next = { ...next, projectDescriptionAudioUri: undefined };
  }
  return next;
}

export async function pushProject(project: Project): Promise<Project> {
  if (syncDisabled) return project;

  setSyncState('syncing');

  try {
    const { project: withMedia, changed } = await uploadPendingMedia(project);
    let toPush = withMedia;

    if (changed) {
      // Persist the remote IDs locally so we don't re-upload next time.
      // Keep the same updatedAt to avoid endless sync loops.
      await updateProjectInStorage(toPush);
    }

    const response = await apiFetch(projectsUrl(`/${encodeURIComponent(project.id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: stripLocalUrisForServer(toPush) }),
      skipAuthHandling: true,
    });

    // 503 = backend has the code but no DATABASE_URL; 404 = backend not yet
    // redeployed with the sync routes. Either way, cloud sync is unavailable.
    if (response.status === 503 || response.status === 404) {
      syncDisabled = true;
      setSyncState('disabled');
      return toPush;
    }

    if (response.status === 401) {
      setSyncState('error');
      return toPush;
    }

    if (!response.ok) {
      setSyncState('error');
      return toPush;
    }

    setSyncState('synced');
    return toPush;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      setSyncState('error');
    } else {
      setSyncState('offline');
    }
    return project;
  }
}

/**
 * Debounced push: call after every local save.
 */
export function schedulePush(project: Project): void {
  if (syncDisabled) return;

  pendingProjects.set(project.id, project);

  const existing = pendingPushTimers.get(project.id);
  if (existing) clearTimeout(existing);

  pendingPushTimers.set(
    project.id,
    setTimeout(() => {
      pendingPushTimers.delete(project.id);
      const pending = pendingProjects.get(project.id);
      pendingProjects.delete(project.id);
      if (pending) {
        pushProject(pending).catch(() => {});
      }
    }, PUSH_DEBOUNCE_MS),
  );
}

// ---------- DELETE ----------

export async function deleteProjectRemote(id: string): Promise<void> {
  const timer = pendingPushTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    pendingPushTimers.delete(id);
    pendingProjects.delete(id);
  }

  // Record the delete first so a pull can never resurrect this project,
  // even if the server is unreachable right now.
  await addPendingDelete(id);

  if (syncDisabled) return;

  try {
    const response = await apiFetch(projectsUrl(`/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      skipAuthHandling: true,
    });
    if (response.status === 503 || response.status === 404) {
      syncDisabled = true;
      setSyncState('disabled');
      return;
    }
    if (response.ok) {
      await removePendingDelete(id);
    }
  } catch (error) {
    console.warn('[sync] Failed to delete project on server (will retry on next sync)', error);
  }
}

// ---------- PULL & MERGE ----------

type ServerListResponse = {
  projects: Project[];
  deleted: { id: string; deletedAt: string }[];
};

/**
 * Fetch server projects and merge with local (last-write-wins by updatedAt).
 * Local-only projects and locally-newer projects are pushed back to the server.
 * Returns the merged list, or null when the server could not be reached.
 */
export async function pullAndMerge(localProjects: Project[]): Promise<Project[] | null> {
  setSyncState('syncing');

  // Replay deletes that never reached the server before merging, so those
  // projects cannot come back from the pull.
  const pendingDeletes = await getPendingDeletes();
  for (const id of pendingDeletes) {
    await deleteProjectRemote(id);
    if (syncDisabled) break;
  }
  const stillPendingDeletes = new Set(await getPendingDeletes());

  let data: ServerListResponse;
  try {
    const response = await apiFetch(projectsUrl(), {
      method: 'GET',
      skipAuthHandling: true,
    });

    if (response.status === 503 || response.status === 404) {
      syncDisabled = true;
      setSyncState('disabled');
      return null;
    }

    if (!response.ok) {
      setSyncState(response.status === 401 ? 'error' : 'offline');
      return null;
    }

    data = await response.json();
    syncDisabled = false;
  } catch (error) {
    setSyncState('offline');
    return null;
  }

  const serverById = new Map<string, Project>();
  for (const p of data.projects || []) {
    const id = String(p.id);
    if (stillPendingDeletes.has(id)) continue; // deleted locally, replay pending
    serverById.set(id, { ...p, id });
  }

  const deletedAtById = new Map<string, number>();
  for (const tomb of data.deleted || []) {
    deletedAtById.set(String(tomb.id), toTime(tomb.deletedAt));
  }

  const merged: Project[] = [];
  const toPush: Project[] = [];
  const seen = new Set<string>();

  for (const local of localProjects) {
    const id = String(local.id);
    seen.add(id);

    const deletedAt = deletedAtById.get(id);
    if (deletedAt !== undefined && deletedAt >= toTime(local.updatedAt)) {
      continue; // deleted on another device
    }

    const server = serverById.get(id);
    if (!server) {
      merged.push(local);
      toPush.push(local);
      continue;
    }

    if (toTime(local.updatedAt) > toTime(server.updatedAt)) {
      merged.push(local);
      toPush.push(local);
    } else {
      merged.push(mergeLocalMediaUris(local, server));
    }
  }

  for (const [id, server] of serverById) {
    if (!seen.has(id)) merged.push(server);
  }

  setSyncState('synced');

  // Push local-only / locally-newer projects in the background.
  for (const project of toPush) {
    schedulePush(project);
  }

  return merged;
}

/**
 * When the server version wins, keep local file URIs for media that this
 * device already has (they are faster and work offline).
 */
function mergeLocalMediaUris(local: Project, server: Project): Project {
  const localNotes = new Map((local.notes || []).map((n) => [n.id, n]));

  const notes = (server.notes || []).map((serverNote) => {
    const localNote = localNotes.get(serverNote.id);
    if (!localNote) return serverNote;

    const localPhotos = new Map((localNote.photos || []).map((p) => [p.id, p]));
    const photos = serverNote.photos?.map((sp) => {
      const lp = localPhotos.get(sp.id);
      return lp && lp.uri && !sp.uri ? { ...sp, uri: lp.uri } : sp;
    });

    return {
      ...serverNote,
      audioUri: serverNote.audioUri || localNote.audioUri,
      ...(photos ? { photos } : {}),
    };
  });

  return {
    ...server,
    notes,
    projectDescriptionAudioUri:
      server.projectDescriptionAudioUri || local.projectDescriptionAudioUri,
  };
}

/**
 * Manual "Sync now": pushes all local projects immediately, then pulls.
 */
export async function syncNow(localProjects: Project[]): Promise<Project[] | null> {
  if (syncDisabled) {
    // Allow retry after e.g. a backend redeploy.
    syncDisabled = false;
  }

  setSyncState('syncing');

  for (const project of localProjects) {
    await pushProject(project);
    if (syncDisabled) return null;
  }

  return pullAndMerge(localProjects);
}
