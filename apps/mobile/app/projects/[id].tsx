import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { getApiBaseUrl } from '@/src/config/api';
import apiFetch, {
  clearTesterToken,
  loadTesterToken,
  setTesterToken,
  UnauthorizedError,
  validateTesterToken,
} from '@/src/lib/apiFetch';
import { Image as ExpoImage } from 'expo-image';

import { getCurrentGeo } from '@/src/lib/geo';
import { tileForCoordinate } from '@/src/lib/kartverket';
import { logError, logAction } from '@/src/lib/logger';
import { GeoPoint, NO_DATE_SET, Note, Project, ReportMeta, UNKNOWN_INSPECTOR } from '@/src/features/projects/types';
import { ReportDetailsSection } from '@/src/features/projects/ReportDetailsSection';
import { ReportGeneratingOverlay } from '@/src/features/projects/ReportGeneratingOverlay';
import { applyNoteChanges } from '@/src/features/projects/noteChanges';
import { nb, formatDate, formatDateTime } from '@/src/i18n/nb';
import SyncStatusIndicator from '@/src/components/SyncStatusIndicator';
import {
  loadProjects,
  saveProjects,
  getProject,
  updateProject as updateProjectInStorage,
} from '@/src/storage/projectsStorage';
import { pullAndMerge, schedulePush, subscribeToProjectUpdates, touchProject } from '@/src/sync/projectSync';
import { persistMediaLocally } from '@/src/sync/persistMedia';
import { displayMediaUri } from '@/src/sync/mediaUri';
import { useVideoUploadProgress } from '@/src/sync/syncStatus';
import {
  Body,
  Caption,
  GlassCard,
  IconButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  StatusChip,
  TextField,
  Title,
  useAppTheme,
  useToast,
} from '@/src/ui';

// ── Video upload progress bar ─────────────────────────────────────────────────
// Defined outside ProjectDetailScreen so it can call hooks at the top level.
// Shows a live progress bar while a video is uploading, and a spinner for the
// brief "preparing" (blob fetch) and "processing" (server response) phases.
function VideoUploadStatus({ videoUri }: { videoUri: string | undefined }) {
  const theme = useAppTheme();
  const pct = useVideoUploadProgress(videoUri);
  // Track how many seconds we've been stuck at pct===null so we can show
  // progressively more helpful messages instead of just "Preparing…" forever.
  const [stallSeconds, setStallSeconds] = useState(0);

  useEffect(() => {
    if (pct !== null) {
      setStallSeconds(0);
      return;
    }
    const id = setInterval(() => setStallSeconds((s) => s + 1), 1_000);
    return () => clearInterval(id);
  }, [pct]);

  if (pct === null) {
    const label =
      stallSeconds >= 35
        ? 'Upload stalled — remove and re-add the video to retry'
        : stallSeconds >= 15
        ? 'Still preparing… (this can take a moment)'
        : 'Preparing…';

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Caption muted>Forbereder …</Caption>
      </View>
    );
  }

  if (pct >= 100) {
    // Bytes sent — waiting for server to confirm and return the media ID.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Caption muted>{nb.status.processing}</Caption>
      </View>
    );
  }

  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Caption muted>{nb.detail.uploading}</Caption>
        <Caption style={{ color: theme.colors.accent, fontVariant: ['tabular-nums'] }}>
          {pct}%
        </Caption>
      </View>
      {/* Progress track */}
      <View style={{
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <View style={{
          height: '100%',
          width: `${pct}%` as `${number}%`,
          backgroundColor: theme.colors.accent,
          borderRadius: 2,
        }} />
      </View>
    </View>
  );
}

type ProjectTab = 'notes' | 'report';

type ProjectParam = {
  id?: string;
  retry?: string;
};

type ProjectState = {
  projects: Project[];
  project: Project | null;
};

export default function ProjectDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const toast = useToast();
  const { id, retry } = useLocalSearchParams<ProjectParam>();
  const projectId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
  const wantsRetry = retry === '1';

  const [state, setState] = useState<ProjectState>({ projects: [], project: null });
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [descriptionRecording, setDescriptionRecording] = useState<Audio.Recording | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isGeneratingGoogleDoc, setIsGeneratingGoogleDoc] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{ url: string; pin: string; expiresAt: string } | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [caseWeather, setCaseWeather] = useState<{ station: string; totalMm: number } | null>(null);
  const [caseBuilding, setCaseBuilding] = useState<{
    type: string;
    status: string;
    kulturminne: boolean;
    bygningsnummer: string | null;
  } | null>(null);
  const [showMoreUnderlag, setShowMoreUnderlag] = useState(false);
  const [casePlace, setCasePlace] = useState<{
    moh: number | null;
    terreng: string | null;
    tempC: number | null;
    beskrivelse: string | null;
    nedborMm: number | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('notes');
  const [describingPhotos, setDescribingPhotos] = useState<Set<string>>(new Set());
  const [editingPhotos, setEditingPhotos] = useState<Record<string, { editing: boolean; caption: string }>>({});
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isTranscribingDescription, setIsTranscribingDescription] = useState(false);

  const [reportMetaDraft, setReportMetaDraft] = useState<ReportMeta>({ contributors: [{}], buildings: [{}] });
  const [reportMetaOpen, setReportMetaOpen] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [saveMetaError, setSaveMetaError] = useState<string | null>(null);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  const project = state.project;
  const isTokenValid = tokenStatus === 'valid';

  // showModal=true only when an in-flight AI call was rejected; never on cold start.
  const handleUnauthorized = useCallback(async (showModal = true) => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenError('Ugyldig tilgangskode. Skriv inn en gyldig kode for å fortsette.');
    if (showModal) setShowTokenModal(true);
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await loadTesterToken();

      if (!storedToken) {
        // No token yet — mark invalid but don't pop modal; the banner prompts softly.
        setTokenStatus('invalid');
        return;
      }

      const isValid = await validateTesterToken(storedToken);
      if (isValid) {
        setTokenInput(storedToken);
        setTokenStatus('valid');
        setTokenError(null);
      } else {
        // Stored token no longer valid — clear quietly; modal only on next AI action.
        await handleUnauthorized(false);
      }
    })();
  }, [handleUnauthorized]);

  const saveToken = async () => {
    setTokenError(null);
    const trimmedToken = tokenInput.trim();

    if (!trimmedToken) {
      setTokenError(nb.auth.accessMissing);
      return;
    }

    setIsValidatingToken(true);
    const isValid = await validateTesterToken(trimmedToken);
    setIsValidatingToken(false);

    if (isValid) {
      await setTesterToken(trimmedToken);
      setTokenStatus('valid');
      setShowTokenModal(false);
      return;
    }

    await handleUnauthorized();
  };

  const handleRemoveToken = async () => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenInput('');
    setShowTokenModal(true);
  };

  const loadProject = useCallback(async () => {
    const route = projectId ? `/projects/${projectId}` : '/projects/unknown';

    console.log('[Projects] Project detail params', {
      projectId,
      route,
      file: 'app/projects/[id].tsx',
    });

    if (!projectId) {
      setState({ projects: [], project: null });
      setLoading(false);
      return;
    }

    try {
      let projects = await loadProjects();
      let found = await getProject(projectId);

      if (!found) {
        // Not on this device yet (fresh install / other device): try the server.
        const merged = await pullAndMerge(projects);
        if (merged) {
          await saveProjects(merged);
          projects = merged;
          found = merged.find((p) => String(p.id) === String(projectId)) ?? null;
        }
      }

      console.log('[Projects] Loaded project detail result', {
        projectId,
        found: Boolean(found),
      });

      setState({ projects, project: found });
    } catch (error) {
      console.warn('[Projects] Failed to load project detail', error);
      setState({ projects: [], project: null });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // «Prøv igjen» fra prosjektlisten (?retry=1): åpne rapport-fanen og start
  // genereringen på nytt — men først når tilgangskoden er ferdig validert,
  // og aldri mer enn én gang per besøk.
  const retryConsumedRef = useRef(false);
  useEffect(() => {
    if (!wantsRetry || retryConsumedRef.current || loading || !project || tokenStatus === 'checking') {
      return;
    }
    retryConsumedRef.current = true;
    setActiveTab('report');
    if (tokenStatus === 'valid' && project.reportStatus === 'failed') {
      generateGoogleDocReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsRetry, loading, project, tokenStatus]);

  useEffect(() => {
    if (!isEditingDescription) {
      setDescriptionDraft(state.project?.projectDescriptionText ?? '');
    }
  }, [isEditingDescription, state.project]);

  // Initialise reportMeta draft whenever a (different) project loads.
  // Auto-expand the section when the key inspection fields are all empty so the
  // user immediately knows they need to fill them in.
  useEffect(() => {
    if (project) {
      const meta = project.reportMeta;
      setReportMetaDraft({
        contributors: [{}],
        buildings: [{}],
        ...meta,
      });
      const isEmpty =
        !meta?.caseNumber &&
        !meta?.inspectionDoneByName &&
        !meta?.customerName &&
        !meta?.addressStreet;
      if (isEmpty) setReportMetaOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Restore the Google Doc URL from the persisted project record when opening/re-entering.
  useEffect(() => {
    if (project?.reportUrl && !googleDocUrl) {
      setGoogleDocUrl(project.reportUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.reportUrl]);

  const updateProjectLocally = async (updated: Project) => {
    // Stamp the change time so sync can do last-write-wins.
    const touched = touchProject(updated);
    // Update project in storage and get back all projects
    const nextProjects = await updateProjectInStorage(touched);
    const normalizedId = String(touched.id);
    const normalizedProject = { ...touched, id: normalizedId };
    setState({ projects: nextProjects, project: normalizedProject });
    schedulePush(normalizedProject);
  };

  const updateProjectNotes = async (notes: Note[]) => {
    if (!project) return;
    const updatedProject = applyNoteChanges(project, notes);
    await updateProjectLocally(updatedProject);
  };

  const saveReportMeta = async () => {
    if (!project) return;
    setIsSavingMeta(true);
    setSaveMetaError(null);
    try {
      const updatedProject: Project = { ...project, reportMeta: reportMetaDraft };
      await updateProjectLocally(updatedProject);
      setReportMetaOpen(false); // collapse panel so the user sees it was saved
    } catch (e: any) {
      setSaveMetaError(e?.message ?? 'Kunne ikke lagre. Prøv igjen.');
    } finally {
      setIsSavingMeta(false);
    }
  };

  const saveProjectDescriptionText = async () => {
    if (!project) return;
    const trimmed = descriptionDraft.trim();

    const updatedProject: Project = {
      ...project,
      projectDescriptionText: trimmed || undefined,
      projectDescriptionUpdatedAt: new Date().toISOString(),
    };

    await updateProjectLocally(updatedProject);
    setIsEditingDescription(false);
  };

  const cancelProjectDescriptionEdit = () => {
    setDescriptionDraft(project?.projectDescriptionText ?? '');
    setIsEditingDescription(false);
  };

  const addTextNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || !project) return;

    const newNote: Note = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    const newNotes = [newNote, ...(project.notes || [])];
    await updateProjectNotes(newNotes);
    setNoteText('');
    toast.show({ message: nb.detail.noteSaved, variant: 'success' });
  };

  const deleteNote = async (noteId: string) => {
    if (!project) return;
    const newNotes = (project.notes || []).filter((n) => n.id !== noteId);
    await updateProjectNotes(newNotes);
  };

  // B15: sletting av notat krever bekreftelse — Alert beholdes for destruktive valg.
  const confirmDeleteNote = (noteId: string) => {
    if (Platform.OS === 'web') {
      // Alert.alert er no-op på web — bruk window.confirm i stedet.
      if (window.confirm(`${nb.detail.deleteNoteTitle}\n\n${nb.detail.deleteNoteMessage}`)) {
        deleteNote(noteId);
      }
      return;
    }

    Alert.alert(nb.detail.deleteNoteTitle, nb.detail.deleteNoteMessage, [
      { text: nb.common.cancel, style: 'cancel' },
      { text: nb.common.delete, style: 'destructive', onPress: () => deleteNote(noteId) },
    ]);
  };

  const startRecording = async () => {
    try {
      if (!project) {
        toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        toast.show({ message: 'Mikrofontilgang kreves for å ta opp lyd.', variant: 'error' });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: started } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(started);
    } catch {
      console.error('Failed to start recording');
      toast.show({ message: 'Kunne ikke starte opptaket.', variant: 'error' });
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording || !project) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        toast.show({ message: 'Fant ingen lydfil.', variant: 'error' });
        return;
      }

      const durableUri = await persistMediaLocally(uri);

      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Lydnotat (ingen tekst ennå – transkriberes senere)';

      const newNote: Note = {
        id: Date.now().toString(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        audioUri: durableUri,
      };

      const newNotes = [newNote, ...(project.notes || [])];
      await updateProjectNotes(newNotes);
      setNoteText('');
      toast.show({ message: nb.detail.audioSaved, variant: 'success' });
    } catch {
      console.error('Failed to stop recording');
      toast.show({ message: 'Kunne ikke stoppe opptaket.', variant: 'error' });
      setRecording(null);
    }
  };

  const handleRecordPress = async () => {
    if (recording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startDescriptionRecording = async () => {
    try {
      if (!project) {
        toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        toast.show({ message: 'Mikrofontilgang kreves for å ta opp lyd.', variant: 'error' });
        return;
      }

      await stopPlayback();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: started } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setDescriptionRecording(started);
    } catch {
      console.error('Failed to start recording project description');
      toast.show({ message: 'Kunne ikke starte opptaket.', variant: 'error' });
    }
  };

  const stopDescriptionRecording = async () => {
    try {
      if (!descriptionRecording || !project) return;

      await descriptionRecording.stopAndUnloadAsync();
      const uri = descriptionRecording.getURI();
      setDescriptionRecording(null);

      if (!uri) {
        toast.show({ message: 'Fant ingen lydfil.', variant: 'error' });
        return;
      }

      const durableUri = await persistMediaLocally(uri);

      const updatedProject: Project = {
        ...project,
        projectDescriptionAudioUri: durableUri,
        projectDescriptionAudioRemoteId: undefined,
        projectDescriptionTranscription: undefined,
        projectDescriptionUpdatedAt: new Date().toISOString(),
      };

      await updateProjectLocally(updatedProject);
      toast.show({ message: 'Muntlig beskrivelse lagret', variant: 'success' });
    } catch {
      console.error('Failed to stop recording project description');
      toast.show({ message: 'Kunne ikke stoppe opptaket.', variant: 'error' });
      setDescriptionRecording(null);
    }
  };

  const handleDescriptionRecordPress = async () => {
    if (descriptionRecording) {
      await stopDescriptionRecording();
    } else {
      await startDescriptionRecording();
    }
  };

  const stopPlayback = useCallback(async () => {
    try {
      if (currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded) {
          await currentSound.stopAsync();
        }
        await currentSound.unloadAsync();
      }
    } catch {
      console.error('Failed to stop playback');
    } finally {
      setCurrentSound(null);
    }
  }, [currentSound]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const playAudio = async (uri?: string) => {
    if (!uri) return;

    try {
      await stopPlayback();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync({ uri });
      setCurrentSound(sound);
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync();
          setCurrentSound(null);
        }
      });
    } catch {
      console.error('Failed to play audio');
      toast.show({ message: 'Kunne ikke spille av opptaket.', variant: 'error' });
    }
  };

  const transcribeNote = async (noteId: string) => {
    if (!project) return;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note || !note.audioUri) {
      toast.show({ message: 'Notatet har ingen lyd å transkribere.', variant: 'info' });
      return;
    }

    try {
      const response = await apiFetch(`${getApiBaseUrl()}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUri: note.audioUri,
        }),
      });

      if (!response.ok) {
        console.error('Backend /transcribe error: non-OK response');
        toast.show({ message: nb.detail.transcriptionFailed, variant: 'error' });
        return;
      }

      const data: any = await response.json();
      const textFromApi: string | undefined = data.text;

      if (!textFromApi) {
        toast.show({ message: 'Transkripsjonen returnerte ingen tekst.', variant: 'error' });
        return;
      }

      const newNotes = project.notes.map((n) =>
        n.id === noteId
          ? {
              ...n,
              transcription: textFromApi,
            }
          : n
      );

      await updateProjectNotes(newNotes);
      toast.show({ message: nb.detail.transcriptionReady, variant: 'success' });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Backend /transcribe error');
      toast.show({ message: 'Fikk ikke kontakt med serveren.', variant: 'error' });
    }
  };

  const deleteProjectDescriptionAudio = async () => {
    if (!project) return;

    const updatedProject: Project = {
      ...project,
      projectDescriptionAudioUri: undefined,
      projectDescriptionAudioRemoteId: undefined,
      projectDescriptionTranscription: undefined,
      projectDescriptionUpdatedAt: new Date().toISOString(),
    };

    await updateProjectLocally(updatedProject);
  };

  const transcribeProjectDescription = async () => {
    if (!project?.projectDescriptionAudioUri) {
      toast.show({ message: 'Ta opp en muntlig prosjektbeskrivelse først.', variant: 'info' });
      return;
    }

    try {
      setIsTranscribingDescription(true);
      const response = await apiFetch(`${getApiBaseUrl()}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUri: project.projectDescriptionAudioUri,
        }),
      });

      if (!response.ok) {
        console.error('Backend /transcribe error: non-OK response');
        toast.show({ message: nb.detail.transcriptionFailed, variant: 'error' });
        return;
      }

      const data: any = await response.json();
      const textFromApi: string | undefined = data.text;

      if (!textFromApi) {
        toast.show({ message: 'Transkripsjonen returnerte ingen tekst.', variant: 'error' });
        return;
      }

      const updatedProject: Project = {
        ...project,
        projectDescriptionTranscription: textFromApi,
        projectDescriptionUpdatedAt: new Date().toISOString(),
      };

      await updateProjectLocally(updatedProject);
      toast.show({ message: nb.detail.transcriptionReady, variant: 'success' });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Backend /transcribe error');
      toast.show({ message: 'Fikk ikke kontakt med serveren.', variant: 'error' });
    } finally {
      setIsTranscribingDescription(false);
    }
  };

  const autoDescribePhoto = async (noteId: string, photoId: string) => {
    if (!project) return;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note || !note.photos) {
      toast.show({ message: 'Fant ikke bildet.', variant: 'error' });
      return;
    }

    const photo = note.photos.find((p) => p.id === photoId);
    if (!photo) {
      toast.show({ message: 'Fant ikke bildet.', variant: 'error' });
      return;
    }

    const photoKey = `${noteId}-${photoId}`;
    setDescribingPhotos((prev) => new Set(prev).add(photoKey));

    try {
      const formData = new FormData();
      const uriParts = photo.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      formData.append('file', {
        uri: photo.uri,
        name: `photo.${fileType}`,
        type: `image/${fileType}`,
      } as any);

      const response = await apiFetch(`${getApiBaseUrl()}/describe-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('Backend /describe-image error: non-OK response');
        toast.show({ message: 'Bildebeskrivelsen feilet.', variant: 'error' });
        return;
      }

      const data: any = await response.json();
      const description: string | undefined = data.description;

      if (!description) {
        toast.show({ message: 'Beskrivelsen returnerte ingen tekst.', variant: 'error' });
        return;
      }

      const newNotes = project.notes.map((n) => {
        if (n.id === noteId && n.photos) {
          return {
            ...n,
            photos: n.photos.map((p) =>
              p.id === photoId
                ? { ...p, caption: description, aiGenerated: true }
                : p
            ),
          };
        }
        return n;
      });

      await updateProjectNotes(newNotes);
      toast.show({ message: 'Bildebeskrivelse lagt til', variant: 'success' });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Auto-describe error');
      toast.show({ message: 'Bildebeskrivelsen feilet.', variant: 'error' });
    } finally {
      setDescribingPhotos((prev) => {
        const next = new Set(prev);
        next.delete(photoKey);
        return next;
      });
    }
  };

  const updatePhotoCaption = async (noteId: string, photoId: string, newCaption: string) => {
    if (!project) return;

    const newNotes = project.notes.map((n) => {
      if (n.id === noteId && n.photos) {
        return {
          ...n,
          photos: n.photos.map((p) =>
            p.id === photoId ? { ...p, caption: newCaption } : p
          ),
        };
      }
      return n;
    });

    await updateProjectNotes(newNotes);
  };

  const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB
  const MAX_VIDEO_DURATION_SECONDS = 120;   // 2 minutes

  const addPhotoNote = async () => {
    if (!project) {
      toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
      return;
    }

    // B9: start geo-innhenting med en gang — den løper mens brukeren er i
    // kameraet/bildevelgeren og blokkerer aldri lagringen (null ved avslag).
    const geoPromise = getCurrentGeo();

    const pickPhoto = async (fromLibrary: boolean) => {
      if (fromLibrary) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          toast.show({ message: 'Tilgang til bildebiblioteket kreves.', variant: 'error' });
          return;
        }
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          toast.show({ message: 'Kameratilgang kreves.', variant: 'error' });
          return;
        }
      }

      const result = fromLibrary
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            exif: false,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
            exif: false,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];

      // Guard: reject oversized photos
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
        const sizeMb = (asset.fileSize / 1024 / 1024).toFixed(1).replace('.', ',');
        toast.show({
          message: `Bildet er ${sizeMb} MB. Velg et bilde under 8 MB.`,
          variant: 'error',
          durationMs: 4200,
        });
        return;
      }

      const uri = await persistMediaLocally(asset.uri);
      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Bildenotat (ingen tekst ennå)';

      const geo = await geoPromise;
      const newNote: Note = {
        id: Date.now().toString(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        photos: [{
          id: Date.now().toString(),
          uri,
          caption: '',
          aiGenerated: false,
          capturedAt: new Date().toISOString(),
          ...(geo ? { geo } : {}),
        }],
      };

      const newNotes = [newNote, ...(project.notes || [])];
      await updateProjectNotes(newNotes);
      setNoteText('');
      toast.show({ message: nb.detail.photoAdded, variant: 'success' });
    };

    // Alert.alert is a no-op on web — go straight to the library picker
    if (Platform.OS === 'web') {
      await pickPhoto(true);
      return;
    }

    // Valg-dialog beholdes som Alert (B18) — men på norsk.
    Alert.alert(nb.detail.mediaSourceTitle, 'Velg kilde', [
      { text: nb.detail.takePhoto, onPress: () => pickPhoto(false) },
      { text: nb.detail.chooseFromLibrary, onPress: () => pickPhoto(true) },
      { text: nb.common.cancel, style: 'cancel' },
    ]);
  };

  const addVideoNote = async () => {
    if (!project) {
      toast.show({ message: 'Vent til prosjektet er lastet inn.', variant: 'info' });
      return;
    }

    // B9: samme mønster som foto — geo hentes parallelt med opptaket.
    const geoPromise = getCurrentGeo();

    const pickVideo = async (fromLibrary: boolean) => {
      try {
        if (fromLibrary) {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            toast.show({ message: 'Tilgang til bildebiblioteket kreves.', variant: 'error' });
            return;
          }
        } else {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            toast.show({ message: 'Kameratilgang kreves.', variant: 'error' });
            return;
          }
        }

        setIsAddingVideo(true);

        const result = fromLibrary
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Videos,
              videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Videos,
              videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
            });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          // On iOS Safari the browser silently returns "canceled" when it can't
          // load a video (e.g. the file is too large or stored in iCloud and
          // the download fails). Give the user a hint so they know what happened.
          if (Platform.OS === 'web') {
            toast.show({
              message: 'Fikk ikke lastet videoen. Ligger den i iCloud, last den ned til enheten først, eller prøv et kortere klipp.',
              variant: 'error',
              durationMs: 5200,
            });
          }
          return;
        }

        const asset = result.assets[0];

        // Guard: check duration (expo-image-picker reports duration in ms on all platforms)
        if (asset.duration && asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000) {
          toast.show({
            message: 'Videoen er for lang. Velg et klipp under 2 minutter.',
            variant: 'error',
            durationMs: 4200,
          });
          return;
        }

        // Guard: check file size (must fit within server's 200 MB cap)
        const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          const sizeMb = (asset.fileSize / 1024 / 1024).toFixed(0);
          toast.show({
            message: `Videoen er ${sizeMb} MB. Velg et klipp under 200 MB.`,
            variant: 'error',
            durationMs: 4200,
          });
          return;
        }

        // Generate the note ID before persisting so we can pass it to
        // persistMediaLocally — on web it uses the ID as the IndexedDB key.
        const noteId = Date.now().toString();
        const uri = await persistMediaLocally(asset.uri, noteId);
        const trimmed = noteText.trim();
        const textForNote = trimmed || 'Videonotat (ingen tekst ennå)';

        const geo = await geoPromise;
        const newNote: Note = {
          id: noteId,
          text: textForNote,
          createdAt: new Date().toISOString(),
          videoUri: uri,
          videoCapturedAt: new Date().toISOString(),
          ...(geo ? { videoGeo: geo } : {}),
        };

        const newNotes = [newNote, ...(project.notes || [])];
        await updateProjectNotes(newNotes);
        setNoteText('');
        toast.show({ message: nb.detail.videoAdded, variant: 'success' });
      } catch (error) {
        console.error('[addVideoNote] Unexpected error', error);
        toast.show({ message: 'Kunne ikke legge til videoen. Prøv igjen.', variant: 'error' });
      } finally {
        setIsAddingVideo(false);
      }
    };

    // Alert.alert is a no-op on web — go straight to the library picker
    if (Platform.OS === 'web') {
      await pickVideo(true);
      return;
    }

    // Valg-dialog beholdes som Alert (B18) — men på norsk.
    Alert.alert(nb.detail.videoSourceTitle, 'Velg kilde', [
      { text: nb.detail.recordVideo, onPress: () => pickVideo(false) },
      { text: nb.detail.chooseVideo, onPress: () => pickVideo(true) },
      { text: nb.common.cancel, style: 'cancel' },
    ]);
  };



  const downloadReport = async (format: 'pdf' | 'docx') => {
    const reportUrl = googleDocUrl || project?.reportUrl;
    if (!reportUrl || !projectId) return;

    try {
      const apiBase = getApiBaseUrl();
      const encodedDocUrl = encodeURIComponent(reportUrl);
      const downloadUrl = `${apiBase}/api/projects/${projectId}/download/${format}?doc_url=${encodedDocUrl}`;

      if (Platform.OS === 'web') {
        // apiFetch sends the x-tester-token header automatically
        const response = await apiFetch(downloadUrl);
        if (!response.ok) {
          toast.show({ message: 'Kunne ikke laste ned rapporten.', variant: 'error' });
          return;
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } else {
        await Linking.openURL(downloadUrl);
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.show({ message: 'Kunne ikke laste ned rapporten.', variant: 'error' });
    }
  };

  const generateGoogleDocReport = async () => {
    if (!project) return;

    const t0 = Date.now();
    // Snapshot to avoid stale-closure bugs across async boundaries
    const snap = project;

    try {
      setIsGeneratingGoogleDoc(true);
      setGoogleDocUrl(null);
      await updateProjectLocally({ ...snap, reportStatus: 'processing', reportError: undefined });

      // Require an uploaded video — no demo fallback
      const videoNote = (snap.notes || []).find(n => n.videoRemoteId);
      if (!videoNote) {
        const errMsg = nb.report.requiresVideo;
        toast.show({ message: nb.report.requiresVideo, variant: 'error', durationMs: 4200 });
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        setIsGeneratingGoogleDoc(false);
        return;
      }
      const videoFilename = videoNote.videoRemoteId;

      // Build enriched project context
      const enrichedNotes = (snap.notes || [])
        .filter(n => n.text || n.transcription || (n.photos && n.photos.length > 0))
        .map(n => ({
          ...(n.text ? { text: n.text } : {}),
          ...(n.transcription ? { transcription: n.transcription } : {}),
          photos: (n.photos || [])
            .filter(p => p.remoteId || p.uri)
            .map(p => ({
              uri: p.remoteId ?? p.uri,
              ...(p.caption ? { caption: p.caption } : {}),
            })),
        }));

      const projectContext = {
        name: snap.name,
        inspectionDate: snap.inspectionDate,
        inspector: snap.inspector,
        ...(snap.projectDescriptionText ? { projectDescriptionText: snap.projectDescriptionText } : {}),
        ...(snap.projectDescriptionTranscription ? { projectDescriptionTranscription: snap.projectDescriptionTranscription } : {}),
        notes: enrichedNotes,
      };

      const response = await apiFetch(`${getApiBaseUrl()}/report/google-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_meta: reportMetaDraft,
          video_filename: videoFilename,
          project: projectContext,
        }),
      });

      if (!response.ok) {
        const errMsg = `${nb.report.failed} (HTTP ${response.status})`;
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        toast.show({ message: nb.report.failed, variant: 'error' });
        return;
      }

      const data = await response.json();
      if (data.status === 'error') {
        const errMsg = data.message || 'AI-motoren returnerte en feil.';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        toast.show({ message: nb.report.failed, variant: 'error' });
        return;
      }
      if (data.url) {
        logAction('generate-google-doc', Date.now() - t0).catch(() => {});
        setGoogleDocUrl(data.url);
        await updateProjectLocally({ ...snap, reportUrl: data.url, reportStatus: 'ready', reportError: undefined });
        toast.show({ message: nb.report.ready, variant: 'success' });
      } else {
        const errMsg = 'Fikk ingen dokumentlenke fra AI-motoren.';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        toast.show({ message: nb.report.failed, variant: 'error' });
      }
    } catch (error) {
      logError(error, 'generate-google-doc').catch(() => {});
      if (await handleApiError(error)) {
        // 401 må ikke etterlate prosjektet i evig «Behandler …».
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: nb.report.unauthorized });
        return;
      }
      const errMsg = 'Fikk ikke kontakt med serveren.';
      await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
      toast.show({ message: errMsg, variant: 'error' });
    } finally {
      setIsGeneratingGoogleDoc(false);
    }
  };

  // B7/B10: kontoløs delingslenke med PIN og utløp (Wenn-mønsteret, hardnet).
  // PIN-koden vises kun her — den legges aldri i delingsmeldingen (nb.share.hint).
  // Nedbør rundt skadedato (MET Frost via API-et) — vises kun når serveren har
  // nøkkel konfigurert og saken har både posisjon og skadedato.
  useEffect(() => {
    const cf = project?.caseFile;
    const damageDate = project?.reportMeta?.damageDate;
    if (!cf || !damageDate || !/^\d{4}-\d{2}-\d{2}$/.test(damageDate) || !isTokenValid) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/vaer?lat=${cf.lat}&lon=${cf.lon}&date=${damageDate}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled && data.configured && typeof data.totalMm === 'number' && data.station) {
          setCaseWeather({ station: String(data.station), totalMm: data.totalMm });
        }
      } catch {
        // værdata er en berikelse — stille feil
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.caseFile, project?.reportMeta?.damageDate, isTokenValid]);

  // Terrenghøyde (Kartverket) og værvarsel (MET) for adressepunktet.
  useEffect(() => {
    const cf = project?.caseFile;
    if (!cf || !isTokenValid) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/stedsinfo?lat=${cf.lat}&lon=${cf.lon}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled && (data.hoyde || data.vaer)) {
          setCasePlace({
            moh: data.hoyde?.moh ?? null,
            terreng: data.hoyde?.terreng ?? null,
            tempC: data.vaer?.tempC ?? null,
            beskrivelse: data.vaer?.beskrivelse ?? null,
            nedborMm: data.vaer?.nedborNeste24tMm ?? null,
          });
        }
      } catch {
        // stedsinfo er en berikelse — stille feil
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.caseFile, isTokenValid]);

  // Bygningsdata fra den åpne matrikkelen (Geonorge) — type, status og
  // kulturminne-flagg for nærmeste bygning til adressepunktet.
  useEffect(() => {
    const cf = project?.caseFile;
    if (!cf || !isTokenValid) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch(
          `${getApiBaseUrl()}/api/underlag/bygg?lat=${cf.lat}&lon=${cf.lon}`,
          { skipAuthHandling: true },
        );
        if (cancelled || !response.ok) return;
        const data: any = await response.json();
        if (!cancelled && data.bygning) {
          setCaseBuilding({
            type: String(data.bygning.type),
            status: String(data.bygning.status),
            kulturminne: Boolean(data.bygning.kulturminne),
            bygningsnummer: data.bygning.bygningsnummer ? String(data.bygning.bygningsnummer) : null,
          });
        }
      } catch {
        // åpen-matrikkel-oppslaget er en berikelse — stille feil
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.caseFile, isTokenValid]);

  const createShare = async () => {
    if (!project || isCreatingShare) return;
    try {
      setIsCreatingShare(true);
      const response = await apiFetch(`${getApiBaseUrl()}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!response.ok) {
        toast.show({ message: nb.share.failed, variant: 'error' });
        return;
      }
      const data: any = await response.json();
      if (typeof data.path !== 'string' || typeof data.pin !== 'string') {
        toast.show({ message: nb.share.failed, variant: 'error' });
        return;
      }
      // Samme-origin-bygg (base '') må få absolutt lenke — mottakeren skal
      // kunne lime den inn hvor som helst.
      const linkBase =
        getApiBaseUrl() ||
        (Platform.OS === 'web' ? ((globalThis as any)?.location?.origin ?? '') : '');
      setShareInfo({
        url: `${linkBase}${data.path}`,
        pin: data.pin,
        expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : '',
      });
      logAction('create-share', 0).catch(() => {});
    } catch (error) {
      logError(error, 'create-share').catch(() => {});
      if (await handleApiError(error)) return;
      toast.show({ message: nb.share.failed, variant: 'error' });
    } finally {
      setIsCreatingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareInfo) return;
    const clipboard = (globalThis as any)?.navigator?.clipboard;
    if (Platform.OS === 'web' && clipboard?.writeText) {
      try {
        await clipboard.writeText(shareInfo.url);
        toast.show({ message: nb.share.copied, variant: 'success' });
      } catch {
        toast.show({ message: nb.share.failed, variant: 'error' });
      }
      return;
    }
    try {
      await Share.share({ message: shareInfo.url });
    } catch {
      // brukeren avbrøt delingsarket — ikke en feil
    }
  };

  const handleApiError = async (error: unknown) => {
    if (error instanceof UnauthorizedError || (error as any)?.status === 401) {
      await handleUnauthorized();
      return true;
    }

    return false;
  };

  const renderTokenModal = () => (
    <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => setShowTokenModal(false)}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <GlassCard style={{ width: '100%', gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title>{nb.auth.accessTitle}</Title>
            <TouchableOpacity
              onPress={() => setShowTokenModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={nb.common.close}
            >
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
          <Body muted>{nb.auth.accessMessage}</Body>
          {tokenError && <Caption style={{ color: theme.colors.danger }}>{tokenError}</Caption>}
          <TextField
            value={tokenInput}
            onChangeText={(value) => {
              setTokenInput(value);
              setTokenError(null);
            }}
            placeholder={nb.auth.accessPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton onPress={saveToken} loading={isValidatingToken}>
            {nb.auth.accessSave}
          </PrimaryButton>
          <SecondaryButton onPress={handleRemoveToken} disabled={isValidatingToken}>
            Fjern kode
          </SecondaryButton>
        </GlassCard>
      </View>
    </Modal>
  );

  // B9/B11: diskret bevislinje — tid, posisjon og sjekksum når de finnes.
  // Rå hash vises aldri i sin helhet i appen; delingssiden viser den fullt ut.
  const renderEvidenceMeta = (capturedAt?: string, geo?: GeoPoint, sha256?: string) => {
    if (!capturedAt && !geo && !sha256) return null;
    const parts: string[] = [];
    if (capturedAt) parts.push(formatDateTime(capturedAt));
    if (geo) parts.push(`${geo.lat.toFixed(4)}°N ${geo.lng.toFixed(4)}°Ø`);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {parts.length > 0 && <Caption muted>{parts.join(' · ')}</Caption>}
        {sha256 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="shield-checkmark-outline" size={12} color={theme.colors.accent} />
            <Caption muted>{`SHA-256 ${sha256.slice(0, 12)}…`}</Caption>
          </View>
        ) : null}
      </View>
    );
  };

  const renderNoteItem = ({ item, index }: { item: Note; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
      <GlassCard style={{ marginBottom: theme.spacing.sm, gap: theme.spacing.xs }}>
        <Body>{item.text}</Body>
        <Caption muted>{formatDateTime(item.createdAt)}</Caption>

        {/* Video clip — show whenever local URI or remote copy exists */}
        {(item.videoUri || item.videoRemoteId) && (
          <View
            style={{
              marginTop: theme.spacing.xs,
              padding: theme.spacing.sm,
              backgroundColor: theme.colors.surfaceSecondary,
              borderRadius: theme.radii.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name="videocam-outline" size={22} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              <Caption>Videoklipp vedlagt</Caption>
              {item.videoRemoteId
                ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={theme.colors.accent} />
                    <Caption muted>{nb.detail.uploaded}</Caption>
                  </View>
                )
                : <VideoUploadStatus videoUri={item.videoUri} />}
              {renderEvidenceMeta(item.videoCapturedAt, item.videoGeo, item.videoSha256)}
            </View>
          </View>
        )}

        {(item.photos?.length || 0) > 0 && (
          <View style={{ marginTop: theme.spacing.xs, gap: theme.spacing.sm }}>
            {item.photos?.map((photo) => {
              const photoKey = `${item.id}-${photo.id}`;
              const isDescribing = describingPhotos.has(photoKey);
              const editState = editingPhotos[photoKey];
              const isEditingCaption = editState?.editing ?? false;
              const editedCaption = editState?.caption ?? photo.caption;

              return (
                <View key={photo.id} style={{ gap: theme.spacing.xs }}>
                  <Image
                    source={{ uri: displayMediaUri(photo.uri, photo.remoteId) }}
                    style={{ width: 82, height: 82, borderRadius: theme.radii.sm }}
                  />
                  {renderEvidenceMeta(photo.capturedAt, photo.geo, photo.sha256)}

                  {isEditingCaption ? (
                    <>
                      <TextField
                        value={editedCaption}
                        onChangeText={(text) =>
                          setEditingPhotos(prev => ({
                            ...prev,
                            [photoKey]: { editing: true, caption: text }
                          }))
                        }
                        placeholder="Beskriv bildet …"
                        multiline
                        style={{ minHeight: 60 }}
                      />
                      <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                        <SecondaryButton
                          onPress={async () => {
                            await updatePhotoCaption(item.id, photo.id, editedCaption);
                            setEditingPhotos(prev => {
                              const next = { ...prev };
                              delete next[photoKey];
                              return next;
                            });
                          }}
                          width={100}
                        >
                          {nb.common.save}
                        </SecondaryButton>
                        <SecondaryButton
                          onPress={() => {
                            setEditingPhotos(prev => {
                              const next = { ...prev };
                              delete next[photoKey];
                              return next;
                            });
                          }}
                          width={100}
                        >
                          {nb.common.cancel}
                        </SecondaryButton>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.xs }}>
                        <Body style={{ flex: 1 }}>
                          {photo.caption || 'Ingen beskrivelse ennå'}
                        </Body>
                        <SecondaryButton
                          onPress={() => {
                            setEditingPhotos(prev => ({
                              ...prev,
                              [photoKey]: { editing: true, caption: photo.caption }
                            }));
                          }}
                          width={100}
                        >
                          Rediger
                        </SecondaryButton>
                      </View>
                    </>
                  )}

                  <SecondaryButton
                    onPress={() => autoDescribePhoto(item.id, photo.id)}
                    loading={isDescribing}
                    width={180}
                  >
                    {isDescribing ? 'Beskriver …' : 'Beskriv automatisk'}
                  </SecondaryButton>
                </View>
              );
            })}
          </View>
        )}

        {(item.images?.length || 0) > 0 && (
          <View style={{ marginTop: theme.spacing.xs, gap: theme.spacing.xs }}>
            <Caption muted>{item.images?.length} {nb.projects.photosCount}</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {item.images?.map((uri, idx) => (
                <Image
                  key={`${uri}-${idx}`}
                  source={{ uri }}
                  style={{ width: 82, height: 82, borderRadius: theme.radii.sm }}
                />
              ))}
            </View>
          </View>
        )}

        {item.audioUri && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <SecondaryButton
              onPress={() => playAudio(displayMediaUri(item.audioUri, item.audioRemoteId))}
              width={120}
              icon={<Ionicons name="play" size={16} color={theme.colors.foreground} />}
            >
              {nb.detail.play}
            </SecondaryButton>
            <SecondaryButton
              onPress={stopPlayback}
              width={120}
              icon={<Ionicons name="stop" size={16} color={theme.colors.foreground} />}
            >
              {nb.detail.stop}
            </SecondaryButton>
            <SecondaryButton onPress={() => transcribeNote(item.id)} width={160}>
              Transkriber
            </SecondaryButton>
          </View>
        )}

        {item.transcription && (
          <View style={{ marginTop: theme.spacing.xs }}>
            <Caption muted>Transkripsjon</Caption>
            <Body>{item.transcription}</Body>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
          <SecondaryButton
            onPress={() => confirmDeleteNote(item.id)}
            width={120}
            icon={<Ionicons name="trash-outline" size={16} color={theme.colors.danger} />}
          >
            {nb.common.delete}
          </SecondaryButton>
        </View>
      </GlassCard>
    </Animated.View>
  );

  const renderReport = () => {
    const displayUrl = googleDocUrl || project?.reportUrl;
    const reportFailed = project?.reportStatus === 'failed';

    return (
      <View style={{ gap: theme.spacing.md }}>
        <PrimaryButton
          onPress={generateGoogleDocReport}
          loading={isGeneratingGoogleDoc}
          disabled={!isTokenValid || isGeneratingGoogleDoc}
          style={{ minHeight: 56 }}
        >
          {isGeneratingGoogleDoc ? nb.report.generating : nb.report.generate}
        </PrimaryButton>

        {!isTokenValid && (
          <Caption muted>Skriv inn en gyldig tilgangskode for å lage rapport.</Caption>
        )}

        {/* B20: feilet generering viser status-chip med «Prøv igjen» — feilteksten under. */}
        {reportFailed && !displayUrl && (
          <GlassCard style={{ gap: theme.spacing.xs }}>
            <StatusChip status="failed" onRetry={isTokenValid ? generateGoogleDocReport : undefined} />
            {project?.reportError ? (
              <Caption muted>{project.reportError}</Caption>
            ) : null}
          </GlassCard>
        )}

        {displayUrl && (
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.accent} />
              <Caption muted>{nb.report.ready}</Caption>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL(displayUrl)}
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, minHeight: 44 }}
            >
              <Ionicons name="open-outline" size={18} color={theme.colors.accent} />
              <Body style={{ color: theme.colors.accent, textDecorationLine: 'underline' }}>
                {nb.report.openReport}
              </Body>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <SecondaryButton
                style={{ flex: 1 }}
                onPress={() => downloadReport('pdf')}
                disabled={isGeneratingGoogleDoc}
                icon={<Ionicons name="download-outline" size={16} color={theme.colors.foreground} />}
              >
                {nb.report.downloadPdf}
              </SecondaryButton>
              <SecondaryButton
                style={{ flex: 1 }}
                onPress={() => downloadReport('docx')}
                disabled={isGeneratingGoogleDoc}
                icon={<Ionicons name="download-outline" size={16} color={theme.colors.foreground} />}
              >
                {nb.report.downloadWord}
              </SecondaryButton>
            </View>
          </GlassCard>
        )}

        {/* B7/B10: kontoløs deling med PIN + utløp */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Ionicons name="share-outline" size={18} color={theme.colors.accent} />
            <Title style={{ fontSize: 18 }}>{nb.share.title}</Title>
          </View>
          <Caption muted>{nb.share.hint}</Caption>

          {shareInfo ? (
            <View style={{ gap: theme.spacing.sm }}>
              <View style={{ gap: 2 }}>
                <Caption muted>{nb.share.linkLabel}</Caption>
                <Body selectable style={{ color: theme.colors.accent }}>{shareInfo.url}</Body>
              </View>
              <View style={{ gap: 2 }}>
                <Caption muted>{nb.share.pinLabel}</Caption>
                <Title
                  selectable
                  style={{
                    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
                    letterSpacing: 6,
                  }}
                >
                  {shareInfo.pin}
                </Title>
              </View>
              {shareInfo.expiresAt ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="lock-closed-outline" size={13} color={theme.colors.muted} />
                  <Caption muted>{`${nb.share.statusPrefix} ${formatDate(shareInfo.expiresAt)}`}</Caption>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <SecondaryButton
                  style={{ flex: 1 }}
                  onPress={copyShareLink}
                  icon={<Ionicons name="copy-outline" size={16} color={theme.colors.foreground} />}
                >
                  {Platform.OS === 'web' ? nb.share.copyLink : nb.share.shareVia}
                </SecondaryButton>
              </View>
            </View>
          ) : (
            <PrimaryButton
              style={{ minHeight: 56 }}
              onPress={createShare}
              loading={isCreatingShare}
              disabled={!isTokenValid || isCreatingShare}
              icon={<Ionicons name="share-outline" size={18} color="#fff" />}
            >
              {isCreatingShare ? nb.share.creating : nb.share.create}
            </PrimaryButton>
          )}
          {!isTokenValid && <Caption muted>{nb.share.requiresToken}</Caption>}
        </GlassCard>
      </View>
    );
  };

  const renderProjectDescription = () => (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 18 }}>{nb.detail.description}</Title>
        {!isEditingDescription && (
          <SecondaryButton onPress={() => setIsEditingDescription(true)} width={140}>
            Rediger tekst
          </SecondaryButton>
        )}
      </View>

      <Caption muted>Gi litt kontekst om prosjektet, så rapporten fokuserer på det viktigste.</Caption>

      {isEditingDescription ? (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            multiline
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            placeholder={nb.detail.descriptionPlaceholder}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <PrimaryButton onPress={saveProjectDescriptionText} width={120}>
              {nb.common.save}
            </PrimaryButton>
            <SecondaryButton onPress={cancelProjectDescriptionEdit} width={120}>
              {nb.common.cancel}
            </SecondaryButton>
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <GlassCard style={{ backgroundColor: theme.colors.glassOverlay, borderColor: theme.colors.border }}>
            <Body muted={!project?.projectDescriptionText}>
              {project?.projectDescriptionText || 'Ingen prosjektbeskrivelse ennå.'}
            </Body>
          </GlassCard>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <SecondaryButton onPress={() => setIsEditingDescription(true)} width={140}>
              Rediger tekst
            </SecondaryButton>
            <SecondaryButton
              onPress={handleDescriptionRecordPress}
              width={180}
              icon={
                <Ionicons
                  name={descriptionRecording ? 'stop-circle-outline' : 'mic-outline'}
                  size={16}
                  color={descriptionRecording ? theme.colors.danger : theme.colors.foreground}
                />
              }
            >
              {descriptionRecording ? nb.detail.stopRecording : 'Les inn beskrivelse'}
            </SecondaryButton>
          </View>
        </View>
      )}

      <View style={{ gap: theme.spacing.xs }}>
        <Caption muted>Muntlig beskrivelse</Caption>
        {project?.projectDescriptionAudioUri ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <SecondaryButton
                onPress={() => playAudio(displayMediaUri(project.projectDescriptionAudioUri, project.projectDescriptionAudioRemoteId))}
                width={120}
                icon={<Ionicons name="play" size={16} color={theme.colors.foreground} />}
              >
                {nb.detail.play}
              </SecondaryButton>
              <SecondaryButton
                onPress={stopPlayback}
                width={120}
                icon={<Ionicons name="stop" size={16} color={theme.colors.foreground} />}
              >
                {nb.detail.stop}
              </SecondaryButton>
              <SecondaryButton onPress={handleDescriptionRecordPress} width={160}>
                {descriptionRecording ? nb.detail.stopRecording : 'Ta opp på nytt'}
              </SecondaryButton>
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {!project.projectDescriptionTranscription && (
                <SecondaryButton
                  onPress={transcribeProjectDescription}
                  loading={isTranscribingDescription}
                  width={160}
                >
                  Transkriber
                </SecondaryButton>
              )}
              <SecondaryButton
                onPress={deleteProjectDescriptionAudio}
                width={160}
                icon={<Ionicons name="trash-outline" size={16} color={theme.colors.danger} />}
              >
                Slett lydopptak
              </SecondaryButton>
            </View>
          </View>
        ) : (
          <Caption muted>Ingen muntlig beskrivelse ennå.</Caption>
        )}

        {project?.projectDescriptionTranscription && (
          <View style={{ gap: theme.spacing.xs }}>
            <Caption muted>Transkripsjon</Caption>
            <Body>{project.projectDescriptionTranscription}</Body>
          </View>
        )}
      </View>
    </GlassCard>
  );

  // Saksunderlaget fra adressevalget: kartutsnitt (Kartverket WMTS), matrikkel-
  // referanse og eventuell nedbørshistorikk rundt skadedato.
  const renderUnderlagCard = () => {
    const cf = project?.caseFile;
    if (!cf) return null;
    const pin = tileForCoordinate(cf.lat, cf.lon);
    const MAP = 216;
    return (
      <GlassCard style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="map-outline" size={18} color={theme.colors.accent} />
          <Title style={{ fontSize: 18 }}>{nb.underlag.title}</Title>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <View
            style={{
              width: MAP,
              height: MAP,
              borderRadius: theme.radii.md,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <ExpoImage
              source={{ uri: pin.url }}
              style={{ width: MAP, height: MAP }}
              contentFit="cover"
              accessibilityLabel={nb.underlag.mapAlt}
            />
            <View
              style={{
                position: 'absolute',
                left: pin.fx * MAP - 7,
                top: pin.fy * MAP - 7,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.colors.accent,
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 180, gap: 6 }}>
            <Body style={{ fontWeight: '600' }}>
              {cf.addressText}
              {cf.postPlace ? `, ${cf.postPlace}` : ''}
            </Body>
            {cf.municipality ? (
              <Caption muted>{`${nb.underlag.municipality}: ${cf.municipality}`}</Caption>
            ) : null}
            {cf.gnr != null ? (
              <Caption muted>{`${nb.underlag.cadastre}: ${cf.gnr}/${cf.bnr}`}</Caption>
            ) : null}
            <Caption muted>{`${nb.underlag.coordinates}: ${cf.lat.toFixed(5)}°N ${cf.lon.toFixed(5)}°Ø`}</Caption>
            {caseBuilding ? (
              <Caption muted>
                {`${nb.underlag.buildingType}: ${caseBuilding.type} · ${caseBuilding.status}`}
              </Caption>
            ) : null}
            {caseBuilding?.kulturminne ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="ribbon-outline" size={13} color={theme.colors.accent} />
                <Caption style={{ color: theme.colors.accent }}>{nb.underlag.heritage}</Caption>
              </View>
            ) : null}
            {casePlace?.moh != null ? (
              <Caption muted>
                {`${nb.underlag.elevation}: ${casePlace.moh} ${nb.underlag.metersAboveSea}${casePlace.terreng ? ` · ${casePlace.terreng.toLowerCase()}` : ''}`}
              </Caption>
            ) : null}
            {casePlace?.tempC != null || casePlace?.beskrivelse ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="rainy-outline" size={13} color={theme.colors.muted} />
                <Caption muted>
                  {`${nb.underlag.weather24}: ${[
                    casePlace.tempC != null ? `${casePlace.tempC}°` : null,
                    casePlace.beskrivelse,
                    casePlace.nedborMm != null && casePlace.nedborMm > 0 ? `${String(casePlace.nedborMm).replace('.', ',')} mm` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}`}
                </Caption>
              </View>
            ) : null}
            {caseWeather ? (
              <Caption muted>
                {`${nb.underlag.rainAroundDamage}: ${caseWeather.totalMm} mm (${nb.underlag.rainStation} ${caseWeather.station})`}
              </Caption>
            ) : null}
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://www.norgeskart.no/#!?sok=${encodeURIComponent(cf.addressText)}`)}
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}
            >
              <Ionicons name="open-outline" size={14} color={theme.colors.accent} />
              <Caption style={{ color: theme.colors.accent }}>{nb.underlag.openMap}</Caption>
            </TouchableOpacity>
            <Caption muted>{nb.underlag.sourceLine}</Caption>
          </View>
        </View>

        {/* «Se mer»: dyplenker til alt vannskade-relevant offentlig innsyn */}
        <TouchableOpacity
          onPress={() => setShowMoreUnderlag((v) => !v)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 }}
        >
          <Ionicons
            name={showMoreUnderlag ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={16}
            color={theme.colors.accent}
          />
          <Body style={{ color: theme.colors.accent, fontWeight: '600' }}>
            {showMoreUnderlag ? nb.underlag.seeLess : nb.underlag.seeMore}
          </Body>
        </TouchableOpacity>
        {showMoreUnderlag && (
          <View style={{ gap: 2 }}>
            {[
              cf.municipalityNumber && cf.gnr != null && cf.bnr != null
                ? {
                    icon: 'home-outline' as const,
                    label: nb.underlag.linkSeeiendom,
                    sub: nb.underlag.linkSeeiendomSub,
                    url: `https://seeiendom.kartverket.no/eiendom/${cf.municipalityNumber}/${cf.gnr}/${cf.bnr}/0/0`,
                  }
                : null,
              {
                icon: 'layers-outline' as const,
                label: nb.underlag.linkPlan,
                sub: nb.underlag.linkPlanSub,
                url: 'https://arealplaner.no/',
              },
              {
                icon: 'water-outline' as const,
                label: nb.underlag.linkNve,
                sub: nb.underlag.linkNveSub,
                url: 'https://temakart.nve.no/tema/flomaktsomhet',
              },
              {
                icon: 'earth-outline' as const,
                label: nb.underlag.linkNgu,
                sub: nb.underlag.linkNguSub,
                url: 'https://geo.ngu.no/kart/losmasse_mobil/',
              },
              {
                icon: 'thermometer-outline' as const,
                label: nb.underlag.linkSeklima,
                sub: nb.underlag.linkSeklimaSub,
                url: 'https://seklima.met.no/observations/',
              },
              {
                icon: 'camera-outline' as const,
                label: nb.underlag.linkFlyfoto,
                sub: nb.underlag.linkFlyfotoSub,
                url: 'https://norgeibilder.no/',
              },
              {
                icon: 'folder-open-outline' as const,
                label: nb.underlag.linkBoligmappa,
                sub: nb.underlag.linkBoligmappaSub,
                url: 'https://www.boligmappa.no/',
              },
            ]
              .filter((link): link is NonNullable<typeof link> => link !== null)
              .map((link) => (
                <TouchableOpacity
                  key={link.url}
                  onPress={() => Linking.openURL(link.url)}
                  accessibilityRole="link"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    paddingVertical: 8,
                    minHeight: 44,
                  }}
                >
                  <Ionicons name={link.icon} size={17} color={theme.colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '600' }}>{link.label}</Body>
                    <Caption muted>{link.sub}</Caption>
                  </View>
                  <Ionicons name="open-outline" size={14} color={theme.colors.muted} />
                </TouchableOpacity>
              ))}
            <Caption muted style={{ marginTop: 4 }}>{nb.underlag.municipalHint}</Caption>
          </View>
        )}
      </GlassCard>
    );
  };

  const renderInfoCard = () => {
    const rawDate = project?.inspectionDate;
    const dateText =
      rawDate && rawDate !== NO_DATE_SET ? formatDate(rawDate) || rawDate : nb.projects.dateNotSet;
    const inspectorText =
      project?.inspector && project.inspector !== UNKNOWN_INSPECTOR
        ? project.inspector
        : nb.projects.unknownInspector;
    return (
      <GlassCard style={{ gap: theme.spacing.xs }}>
        <Body muted>Befaringsdato: {dateText}</Body>
        <Body muted>{nb.projects.inspectorLabel}: {inspectorText}</Body>
      </GlassCard>
    );
  };

  // B16: fast topprad (scroller ikke) — synk-status + tilgangskode.
  // Prosjektnavnet vises i navigasjonsheaderen (Stack.Screen), ikke her —
  // ellers står tittelen dobbelt og trunkeres ved siden av synk-pillen.
  const renderTopBar = () => (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
        <SyncStatusIndicator />
        <IconButton onPress={() => setShowTokenModal(true)} accessibilityLabel={nb.auth.accessTitle}>
          <Ionicons name="key-outline" size={18} color={theme.colors.foreground} />
        </IconButton>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <SecondaryButton
          style={{ flex: 1, borderColor: activeTab === 'notes' ? theme.colors.accent : theme.colors.border }}
          onPress={() => setActiveTab('notes')}
        >
          {nb.detail.notesTab}
        </SecondaryButton>
        <SecondaryButton
          style={{ flex: 1, borderColor: activeTab === 'report' ? theme.colors.accent : theme.colors.border }}
          onPress={() => setActiveTab('report')}
        >
          {nb.detail.reportTab}
        </SecondaryButton>
      </View>
    </View>
  );

  // B13: tre store fangst-knapper i full bredde — alltid synlige uten scrolling.
  const renderCaptureButtons = () => (
    <View style={{ gap: theme.spacing.sm }}>
      <SecondaryButton
        onPress={handleRecordPress}
        style={{
          minHeight: 56,
          borderColor: recording ? theme.colors.danger : theme.colors.border,
          borderWidth: recording ? 2 : 1,
        }}
        icon={
          <Ionicons
            name={recording ? 'stop-circle-outline' : 'mic-outline'}
            size={22}
            color={recording ? theme.colors.danger : theme.colors.foreground}
          />
        }
      >
        {recording ? nb.detail.stopRecording : nb.detail.audioNote}
      </SecondaryButton>
      <SecondaryButton
        onPress={addPhotoNote}
        style={{ minHeight: 56 }}
        icon={<Ionicons name="camera-outline" size={22} color={theme.colors.foreground} />}
      >
        {nb.detail.photo}
      </SecondaryButton>
      <SecondaryButton
        onPress={addVideoNote}
        disabled={isAddingVideo}
        style={{ minHeight: 56 }}
        icon={<Ionicons name="videocam-outline" size={22} color={theme.colors.foreground} />}
      >
        {isAddingVideo ? nb.detail.loadingVideo : nb.detail.video}
      </SecondaryButton>
    </View>
  );

  const renderTextNoteCard = () => (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      <TextField
        multiline
        value={noteText}
        onChangeText={setNoteText}
        placeholder={nb.detail.notePlaceholder}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <PrimaryButton onPress={addTextNote} style={{ minHeight: 56 }}>
        {nb.detail.saveNote}
      </PrimaryButton>
    </GlassCard>
  );

  const renderNotesTab = () => {
    const noteData = project?.notes || [];

    return (
      <Animated.View entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
        {/* B13: fangst-knappene ligger fast øverst, utenfor scrollingen. */}
        <View style={{ marginTop: theme.spacing.md }}>
          {renderCaptureButtons()}
        </View>

        <View style={{ flex: 1, marginTop: theme.spacing.md }}>
          <FlatList
            data={loading ? [] : noteData}
            keyExtractor={(item) => item.id}
            renderItem={renderNoteItem}
            ListHeaderComponent={
              <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                {renderUnderlagCard()}
                {renderInfoCard()}
                {renderProjectDescription()}
                {renderTextNoteCard()}
                {loading && <Caption muted>{nb.common.loadingEllipsis}</Caption>}
              </View>
            }
            ListEmptyComponent={
              !loading ? <Caption muted>Ingen notater ennå. Legg til din første observasjon.</Caption> : null
            }
            contentContainerStyle={{ paddingBottom: theme.spacing.md }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Animated.View>
    );
  };

  const renderReportTab = () => (
    <Animated.View entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, marginTop: theme.spacing.md }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {renderInfoCard()}
        <ReportDetailsSection
          meta={reportMetaDraft}
          onChange={setReportMetaDraft}
          onSave={saveReportMeta}
          isOpen={reportMetaOpen}
          onToggle={() => setReportMetaOpen((o) => !o)}
          saving={isSavingMeta}
          saveError={saveMetaError}
        />
        {renderReport()}
      </ScrollView>
    </Animated.View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <Screen>
          <Caption muted>{nb.common.loadingEllipsis}</Caption>
        </Screen>
      );
    }

    if (!project) {
      return (
        <Screen>
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Title muted>Fant ikke prosjektet</Title>
            <Body muted>Vi fant ikke prosjektet. Det kan være slettet.</Body>
            <PrimaryButton onPress={() => router.back()}>{nb.common.back}</PrimaryButton>
          </GlassCard>
        </Screen>
      );
    }

    // Fast topprad (B16) og fast bunn-CTA (B13) — bare innholdet i midten scroller.
    return (
      <Screen scrollable={false} style={{ flex: 1 }}>
        {renderTokenModal()}
        {renderTopBar()}

        <View style={{ flex: 1 }}>
          {activeTab === 'notes' ? renderNotesTab() : renderReportTab()}
        </View>

        {/* B13: «Se rapport» fast i bunn, skjult når rapport-fanen alt er aktiv.
            Screen sin SafeAreaView gir safe-area-polstring i bunnen. */}
        {activeTab !== 'report' && (
          <View style={{ paddingTop: theme.spacing.sm }}>
            <PrimaryButton
              onPress={() => setActiveTab('report')}
              style={{ minHeight: 56 }}
              icon={<Ionicons name="document-text-outline" size={20} color="#fff" />}
            >
              {nb.detail.seeReport}
            </PrimaryButton>
          </View>
        )}
      </Screen>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Stack.Screen
        options={{
          title: project?.name ?? 'Prosjekt',
          headerShown: true,
          headerBackTitle: nb.tabs.home,
        }}
      />

      {renderContent()}

      <ReportGeneratingOverlay visible={isGeneratingGoogleDoc} />
    </View>
  );
}
