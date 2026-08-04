import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Modal, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { getApiBaseUrl } from '@/src/config/api';
import apiFetch, {
  clearTesterToken,
  loadTesterToken,
  setTesterToken,
  UnauthorizedError,
  validateTesterToken,
} from '@/src/lib/apiFetch';
import { logError, logAction } from '@/src/lib/logger';
import { Note, Project, ReportMeta } from '@/src/features/projects/types';
import { ReportDetailsSection } from '@/src/features/projects/ReportDetailsSection';
import { ReportGeneratingOverlay } from '@/src/features/projects/ReportGeneratingOverlay';
import { applyNoteChanges } from '@/src/features/projects/noteChanges';
import {
  loadProjects,
  saveProjects,
  getProject,
  updateProject as updateProjectInStorage,
} from '@/src/storage/projectsStorage';
import { pullAndMerge, schedulePush, subscribeToProjectUpdates, touchProject, clearVideoRetryState } from '@/src/sync/projectSync';
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
  TextField,
  Title,
  useAppTheme,
} from '@/src/ui';

// ── Video upload progress bar ─────────────────────────────────────────────────
// Defined outside ProjectDetailScreen so it can call hooks at the top level.
// Shows a live progress bar while a video is uploading, and a spinner for the
// brief "preparing" (blob fetch) and "processing" (server response) phases.
function VideoUploadStatus({
  videoUri,
  onReselect,
}: {
  videoUri: string | undefined;
  onReselect?: () => void;
}) {
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
    const isStalled = stallSeconds >= 35;
    const label = isStalled
      ? 'Upload stalled'
      : stallSeconds >= 15
      ? 'Still preparing… (this can take a moment)'
      : 'Preparing…';

    return (
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ActivityIndicator size="small" color={isStalled ? 'orange' : theme.colors.accent} />
          <Caption muted style={isStalled ? { color: 'orange' } : undefined}>{label}</Caption>
        </View>
        {isStalled && onReselect && (
          <TouchableOpacity
            onPress={onReselect}
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: 'orange',
            }}
            accessibilityLabel="Re-select file to retry upload"
          >
            <Caption style={{ color: 'orange' }}>Re-select file</Caption>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (pct >= 100) {
    // Bytes sent — waiting for server to confirm and return the media ID.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
        <Caption muted>Processing…</Caption>
      </View>
    );
  }

  return (
    <View style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Caption muted>Uploading video…</Caption>
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
};

type ProjectState = {
  projects: Project[];
  project: Project | null;
};

export default function ProjectDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<ProjectParam>();
  const projectId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;

  const [state, setState] = useState<ProjectState>({ projects: [], project: null });
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [descriptionRecording, setDescriptionRecording] = useState<Audio.Recording | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isGeneratingGoogleDoc, setIsGeneratingGoogleDoc] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState<string | null>(null);
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
    setTokenError('Invalid access token. Please enter a valid token to continue.');
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
      setTokenError('Token required. Please enter the tester token to continue.');
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

  // When pushProject writes remote IDs (e.g. videoRemoteId) back to storage
  // after a successful upload, it notifies subscribers so the UI can update
  // immediately instead of waiting for the next pull cycle.
  useEffect(() => {
    if (!projectId) return;
    return subscribeToProjectUpdates(projectId, (updatedProject) => {
      setState((prev) => ({
        ...prev,
        project: updatedProject,
        projects: prev.projects.map((p) =>
          String(p.id) === String(updatedProject.id) ? updatedProject : p,
        ),
      }));
    });
  }, [projectId]);

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
      setSaveMetaError(e?.message ?? 'Failed to save. Please try again.');
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
  };

  const deleteNote = async (noteId: string) => {
    if (!project) return;
    const newNotes = (project.notes || []).filter((n) => n.id !== noteId);
    await updateProjectNotes(newNotes);
  };

  const startRecording = async () => {
    try {
      if (!project) {
        Alert.alert('Select project', 'Please wait for the project to load first.');
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required.');
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
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording || !project) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert('Error', 'No audio file found.');
        return;
      }

      const durableUri = await persistMediaLocally(uri);

      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Voice note (no text added yet – transcription later)';

      const newNote: Note = {
        id: Date.now().toString(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        audioUri: durableUri,
      };

      const newNotes = [newNote, ...(project.notes || [])];
      await updateProjectNotes(newNotes);
      setNoteText('');
    } catch {
      console.error('Failed to stop recording');
      Alert.alert('Error', 'Could not stop recording.');
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
        Alert.alert('Select project', 'Please wait for the project to load first.');
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone permission is required.');
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
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopDescriptionRecording = async () => {
    try {
      if (!descriptionRecording || !project) return;

      await descriptionRecording.stopAndUnloadAsync();
      const uri = descriptionRecording.getURI();
      setDescriptionRecording(null);

      if (!uri) {
        Alert.alert('Error', 'No audio file found.');
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
    } catch {
      console.error('Failed to stop recording project description');
      Alert.alert('Error', 'Could not stop recording.');
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
      Alert.alert('Error', 'Could not play this recording.');
    }
  };

  const transcribeNote = async (noteId: string) => {
    if (!project) return;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note || !note.audioUri) {
      Alert.alert('No audio', 'This note has no audio to transcribe.');
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
        Alert.alert('Transcription failed', 'The backend returned an error.');
        return;
      }

      const data: any = await response.json();
      const textFromApi: string | undefined = data.text;

      if (!textFromApi) {
        Alert.alert('No text', 'The transcription request succeeded but returned no text.');
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
      Alert.alert('Transcription ready', 'Added to this note.');
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Backend /transcribe error');
      Alert.alert('Error', 'Could not reach backend.');
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
      Alert.alert('No audio', 'Record a project description first.');
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
        Alert.alert('Transcription failed', 'The backend returned an error.');
        return;
      }

      const data: any = await response.json();
      const textFromApi: string | undefined = data.text;

      if (!textFromApi) {
        Alert.alert('No text', 'The transcription request succeeded but returned no text.');
        return;
      }

      const updatedProject: Project = {
        ...project,
        projectDescriptionTranscription: textFromApi,
        projectDescriptionUpdatedAt: new Date().toISOString(),
      };

      await updateProjectLocally(updatedProject);
      Alert.alert('Transcription ready', 'Added to this project description.');
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Backend /transcribe error');
      Alert.alert('Error', 'Could not reach backend.');
    } finally {
      setIsTranscribingDescription(false);
    }
  };

  const autoDescribePhoto = async (noteId: string, photoId: string) => {
    if (!project) return;

    const note = project.notes.find((n) => n.id === noteId);
    if (!note || !note.photos) {
      Alert.alert('Error', 'Photo not found.');
      return;
    }

    const photo = note.photos.find((p) => p.id === photoId);
    if (!photo) {
      Alert.alert('Error', 'Photo not found.');
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
        Alert.alert('Description failed', 'The backend returned an error.');
        return;
      }

      const data: any = await response.json();
      const description: string | undefined = data.description;

      if (!description) {
        Alert.alert('No description', 'The description request succeeded but returned no text.');
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
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Auto-describe error');
      Alert.alert('Description error', 'Something went wrong while contacting the backend.');
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
      Alert.alert('Select project', 'Please wait for the project to load first.');
      return;
    }

    const pickPhoto = async (fromLibrary: boolean) => {
      if (fromLibrary) {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required.');
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
        Alert.alert(
          'Photo too large',
          `This photo is ${(asset.fileSize / 1024 / 1024).toFixed(1)} MB. Please choose a photo under 8 MB to keep uploads fast and within server limits.`,
        );
        return;
      }

      const uri = await persistMediaLocally(asset.uri);
      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Photo note (no text added yet).';

      const newNote: Note = {
        id: Date.now().toString(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        photos: [{
          id: Date.now().toString(),
          uri,
          caption: '',
          aiGenerated: false,
        }],
      };

      const newNotes = [newNote, ...(project.notes || [])];
      await updateProjectNotes(newNotes);
      setNoteText('');
    };

    // Alert.alert is a no-op on web — go straight to the library picker
    if (Platform.OS === 'web') {
      await pickPhoto(true);
      return;
    }

    Alert.alert('Add photo', 'Choose a source', [
      { text: 'Take photo', onPress: () => pickPhoto(false) },
      { text: 'Choose from library', onPress: () => pickPhoto(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const addVideoNote = async () => {
    if (!project) {
      Alert.alert('Select project', 'Please wait for the project to load first.');
      return;
    }

    const pickVideo = async (fromLibrary: boolean) => {
      try {
        if (fromLibrary) {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Photo library access is required to pick videos.');
            return;
          }
        } else {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission needed', 'Camera permission is required to record video.');
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
            Alert.alert(
              'No video loaded',
              'The video could not be loaded. If you selected a video but nothing happened, it may be stored in iCloud — download it to your device first, or try a shorter clip (under 30 seconds).',
            );
          }
          return;
        }

        const asset = result.assets[0];

        // Guard: check duration (expo-image-picker reports duration in ms on all platforms)
        if (asset.duration && asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000) {
          Alert.alert(
            'Video too long',
            `Please select a video shorter than ${MAX_VIDEO_DURATION_SECONDS} seconds (2 minutes) to keep uploads within server limits.`,
          );
          return;
        }

        // Guard: check file size (must fit within server's 200 MB cap)
        const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          Alert.alert(
            'Video too large',
            `This clip is ${(asset.fileSize / 1024 / 1024).toFixed(0)} MB. Please choose a clip under 200 MB to keep uploads reliable.`,
          );
          return;
        }

        // Generate the note ID before persisting so we can pass it to
        // persistMediaLocally — on web it uses the ID as the IndexedDB key.
        const noteId = Date.now().toString();
        const uri = await persistMediaLocally(asset.uri, noteId);
        const trimmed = noteText.trim();
        const textForNote = trimmed || 'Video note (no text added yet).';

        const newNote: Note = {
          id: noteId,
          text: textForNote,
          createdAt: new Date().toISOString(),
          videoUri: uri,
        };

        const newNotes = [newNote, ...(project.notes || [])];
        await updateProjectNotes(newNotes);
        setNoteText('');
      } catch (error) {
        console.error('[addVideoNote] Unexpected error', error);
        Alert.alert('Could not add video', 'Something went wrong while adding the video. Please try again.');
      } finally {
        setIsAddingVideo(false);
      }
    };

    // Alert.alert is a no-op on web — go straight to the library picker
    if (Platform.OS === 'web') {
      await pickVideo(true);
      return;
    }

    Alert.alert('Add video', 'Choose a source', [
      { text: 'Record video', onPress: () => pickVideo(false) },
      { text: 'Choose from library', onPress: () => pickVideo(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /**
   * Let the inspector pick a replacement video for a note whose upload stalled.
   * Only the videoUri is replaced — all other note content (text, photos, audio)
   * is left untouched.  The old URI's in-memory upload state is cleared so the
   * sync engine treats the new URI as a fresh upload.
   */
  const reSelectVideoForNote = async (noteId: string, oldVideoUri: string | undefined) => {
    if (!project) return;

    const pickReplacement = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required to pick videos.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoMaxDuration: MAX_VIDEO_DURATION_SECONDS,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) return;

        const asset = result.assets[0];

        if (asset.duration && asset.duration > MAX_VIDEO_DURATION_SECONDS * 1000) {
          Alert.alert(
            'Video too long',
            `Please select a video shorter than ${MAX_VIDEO_DURATION_SECONDS} seconds (2 minutes).`,
          );
          return;
        }

        const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
          Alert.alert(
            'Video too large',
            `This clip is ${(asset.fileSize / 1024 / 1024).toFixed(0)} MB. Please choose a clip under 200 MB.`,
          );
          return;
        }

        // Persist the new file under a fresh IDB key so the replacement gets a
        // URI that is distinct from the stalled upload's URI.  If the same key
        // were reused, uploadMedia() would find the old in-flight promise in
        // uploadsInFlight and join it instead of starting a fresh upload.
        const idbKey = `${noteId}-r${Date.now()}`;
        const newUri = await persistMediaLocally(asset.uri, idbKey);

        // Clear the old URI from the sync engine's deduplication / quarantine maps
        // so the next push treats the new URI as a fresh upload.
        clearVideoRetryState(oldVideoUri);

        // Replace only the video fields on the matching note.
        const newNotes = (project.notes || []).map((n) =>
          n.id === noteId
            ? { ...n, videoUri: newUri, videoRemoteId: undefined }
            : n,
        );
        await updateProjectNotes(newNotes);
      } catch (error) {
        console.error('[reSelectVideoForNote] Unexpected error', error);
        Alert.alert('Could not pick video', 'Something went wrong. Please try again.');
      }
    };

    // On web Alert.alert is a no-op — go straight to library picker.
    if (Platform.OS === 'web') {
      await pickReplacement();
      return;
    }

    Alert.alert('Replace video', 'Choose a replacement video', [
      { text: 'Choose from library', onPress: pickReplacement },
      { text: 'Cancel', style: 'cancel' },
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
          Alert.alert('Download failed', 'Could not download the report file.');
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
      Alert.alert('Download failed', 'Could not download the report.');
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
        const errMsg = 'No video found on this project.';
        Alert.alert('No video found', 'Please add a video note to this project before generating a Google Doc report.');
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
        const errMsg = 'Failed to generate Google Doc report (HTTP ' + response.status + ')';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        Alert.alert('Error', 'Failed to generate Google Doc report.');
        return;
      }

      const data = await response.json();
      if (data.status === 'error') {
        const errMsg = data.message || 'AI engine returned an error.';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        Alert.alert('Error', errMsg);
        return;
      }
      if (data.url) {
        logAction('generate-google-doc', Date.now() - t0).catch(() => {});
        setGoogleDocUrl(data.url);
        await updateProjectLocally({ ...snap, reportUrl: data.url, reportStatus: 'ready', reportError: undefined });
      } else {
        const errMsg = 'No document URL returned from AI engine.';
        logError(new Error(errMsg), 'generate-google-doc').catch(() => {});
        await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
        Alert.alert('Error', errMsg);
      }
    } catch (error) {
      logError(error, 'generate-google-doc').catch(() => {});
      if (await handleApiError(error)) return;
      const errMsg = 'Could not reach backend.';
      await updateProjectLocally({ ...snap, reportStatus: 'failed', reportError: errMsg });
      Alert.alert('Error', errMsg);
    } finally {
      setIsGeneratingGoogleDoc(false);
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
            <Title>Enter tester token</Title>
            <TouchableOpacity
              onPress={() => setShowTokenModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
          <Body muted>Access is restricted. Enter your tester token to continue.</Body>
          {tokenError && <Caption style={{ color: theme.colors.danger }}>{tokenError}</Caption>}
          <TextField
            value={tokenInput}
            onChangeText={(value) => {
              setTokenInput(value);
              setTokenError(null);
            }}
            placeholder="Tester token"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <PrimaryButton onPress={saveToken} loading={isValidatingToken}>
            Validate & Save
          </PrimaryButton>
          <SecondaryButton onPress={handleRemoveToken} disabled={isValidatingToken}>
            Remove token
          </SecondaryButton>
        </GlassCard>
      </View>
    </Modal>
  );

  const renderNoteItem = ({ item, index }: { item: Note; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
      <GlassCard style={{ marginBottom: theme.spacing.sm, gap: theme.spacing.xs }}>
        <Body>{item.text}</Body>
        <Caption muted>{new Date(item.createdAt).toLocaleString()}</Caption>

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
              <Caption>Video clip attached</Caption>
              {item.videoRemoteId
                ? <Caption muted>✓ Uploaded to server</Caption>
                : (
                  <VideoUploadStatus
                    videoUri={item.videoUri}
                    onReselect={() => reSelectVideoForNote(item.id, item.videoUri)}
                  />
                )}
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
                        placeholder="Describe this photo…"
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
                          Save
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
                          Cancel
                        </SecondaryButton>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.xs }}>
                        <Body style={{ flex: 1 }}>
                          {photo.caption || 'No description yet'}
                        </Body>
                        <SecondaryButton
                          onPress={() => {
                            setEditingPhotos(prev => ({
                              ...prev,
                              [photoKey]: { editing: true, caption: photo.caption }
                            }));
                          }}
                          width={80}
                        >
                          Edit
                        </SecondaryButton>
                      </View>
                    </>
                  )}
                  
                  <SecondaryButton
                    onPress={() => autoDescribePhoto(item.id, photo.id)}
                    loading={isDescribing}
                    width={160}
                  >
                    {isDescribing ? 'Describing...' : 'Auto-describe'}
                  </SecondaryButton>
                </View>
              );
            })}
          </View>
        )}

        {(item.images?.length || 0) > 0 && (
          <View style={{ marginTop: theme.spacing.xs, gap: theme.spacing.xs }}>
            <Caption muted>Photos: {item.images?.length}</Caption>
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
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <SecondaryButton onPress={() => playAudio(displayMediaUri(item.audioUri, item.audioRemoteId))} width={120}>
              ▶ Play
            </SecondaryButton>
            <SecondaryButton onPress={stopPlayback} width={120}>
              ⏹ Stop
            </SecondaryButton>
            <SecondaryButton onPress={() => transcribeNote(item.id)} width={160}>
              Transcribe
            </SecondaryButton>
          </View>
        )}

        {item.transcription && (
          <View style={{ marginTop: theme.spacing.xs }}>
            <Caption muted>Transcription</Caption>
            <Body>{item.transcription}</Body>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
          <SecondaryButton onPress={() => deleteNote(item.id)} width={120}>
            Delete
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
        >
          {isGeneratingGoogleDoc ? 'Generating…' : 'Generate Google Doc Report'}
        </PrimaryButton>

        {!isTokenValid && (
          <Caption muted>Enter a valid tester token to enable report generation.</Caption>
        )}

        {reportFailed && !displayUrl && (
          <GlassCard style={{ gap: theme.spacing.xs, borderColor: theme.colors.danger }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="warning" size={16} color={theme.colors.danger} />
              <Caption style={{ color: theme.colors.danger, fontWeight: '600' }}>
                Report generation failed
              </Caption>
            </View>
            {project?.reportError ? (
              <Caption muted>{project.reportError}</Caption>
            ) : null}
          </GlassCard>
        )}

        {displayUrl && (
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Caption muted>Google Doc report ready:</Caption>
            <TouchableOpacity onPress={() => Linking.openURL(displayUrl)}>
              <Body
                style={{ color: theme.colors.accent, textDecorationLine: 'underline' }}
                numberOfLines={2}
              >
                {displayUrl}
              </Body>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <SecondaryButton
                style={{ flex: 1 }}
                onPress={() => downloadReport('pdf')}
                disabled={isGeneratingGoogleDoc}
              >
                ↓ PDF
              </SecondaryButton>
              <SecondaryButton
                style={{ flex: 1 }}
                onPress={() => downloadReport('docx')}
                disabled={isGeneratingGoogleDoc}
              >
                ↓ Word
              </SecondaryButton>
            </View>
          </GlassCard>
        )}
      </View>
    );
  };

  const renderProjectDescription = () => (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 18 }}>Project description</Title>
        {!isEditingDescription && (
          <SecondaryButton onPress={() => setIsEditingDescription(true)} width={120}>
            Edit text
          </SecondaryButton>
        )}
      </View>

      <Caption muted>Add context about the project so the report focuses on the right things.</Caption>

      {isEditingDescription ? (
        <View style={{ gap: theme.spacing.sm }}>
          <TextField
            multiline
            value={descriptionDraft}
            onChangeText={setDescriptionDraft}
            placeholder="Describe the project goals, constraints, client preferences, etc."
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'flex-end' }}>
            <PrimaryButton onPress={saveProjectDescriptionText} width={120}>
              Save
            </PrimaryButton>
            <SecondaryButton onPress={cancelProjectDescriptionEdit} width={120}>
              Cancel
            </SecondaryButton>
          </View>
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <GlassCard style={{ backgroundColor: theme.colors.glass, borderColor: theme.colors.border }}>
            <Body muted={!project?.projectDescriptionText}>
              {project?.projectDescriptionText || 'No project description yet.'}
            </Body>
          </GlassCard>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <SecondaryButton onPress={() => setIsEditingDescription(true)} width={140}>
              Edit text
            </SecondaryButton>
            <SecondaryButton onPress={handleDescriptionRecordPress} width={160}>
              {descriptionRecording ? 'Stop & save voice' : 'Record voice'}
            </SecondaryButton>
          </View>
        </View>
      )}

      <View style={{ gap: theme.spacing.xs }}>
        <Caption muted>Voice description</Caption>
        {project?.projectDescriptionAudioUri ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              <SecondaryButton onPress={() => playAudio(displayMediaUri(project.projectDescriptionAudioUri, project.projectDescriptionAudioRemoteId))} width={120}>
                ▶ Play
              </SecondaryButton>
              <SecondaryButton onPress={stopPlayback} width={120}>
                ⏹ Stop
              </SecondaryButton>
              <SecondaryButton onPress={handleDescriptionRecordPress} width={140}>
                {descriptionRecording ? 'Stop recording' : 'Re-record'}
              </SecondaryButton>
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {!project.projectDescriptionTranscription && (
                <SecondaryButton
                  onPress={transcribeProjectDescription}
                  loading={isTranscribingDescription}
                  width={160}
                >
                  Transcribe
                </SecondaryButton>
              )}
              <SecondaryButton onPress={deleteProjectDescriptionAudio} width={140}>
                Delete voice
              </SecondaryButton>
            </View>
          </View>
        ) : (
          <Caption muted>No voice project description yet.</Caption>
        )}

        {project?.projectDescriptionTranscription && (
          <View style={{ gap: theme.spacing.xs }}>
            <Caption muted>Transcription</Caption>
            <Body>{project.projectDescriptionTranscription}</Body>
          </View>
        )}
      </View>
    </GlassCard>
  );

  const renderHeader = () => (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Caption muted>Project</Caption>
          <Title numberOfLines={1}>{project?.name ?? 'Project'}</Title>
        </View>
        <IconButton onPress={() => setShowTokenModal(true)}>
          <Ionicons name="key-outline" size={18} color={theme.colors.foreground} />
        </IconButton>
      </View>

      <GlassCard style={{ gap: theme.spacing.xs }}>
        <Body muted>Inspection date: {project?.inspectionDate}</Body>
        <Body muted>Inspector: {project?.inspector}</Body>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
          <SecondaryButton
            style={{ flex: 1, borderColor: activeTab === 'notes' ? theme.colors.accent : theme.colors.border }}
            onPress={() => setActiveTab('notes')}
          >
            Notes
          </SecondaryButton>
          <SecondaryButton
            style={{ flex: 1, borderColor: activeTab === 'report' ? theme.colors.accent : theme.colors.border }}
            onPress={() => setActiveTab('report')}
          >
            Report
          </SecondaryButton>
        </View>
      </GlassCard>
    </View>
  );

  const noteComposer = (
    <>
      <GlassCard style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
        <Caption muted>What would you say during the inspection?</Caption>
        <TextField
          multiline
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Type your observation here..."
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm }}>
          <PrimaryButton style={{ flexBasis: '48%', flexGrow: 1 }} onPress={addTextNote}>
            Save note
          </PrimaryButton>
          <SecondaryButton style={{ flexBasis: '48%', flexGrow: 1 }} onPress={handleRecordPress}>
            {recording ? 'Stop & save voice' : 'Voice note'}
          </SecondaryButton>
          <SecondaryButton style={{ flexBasis: '48%', flexGrow: 1 }} onPress={addPhotoNote}>
            📷 Add photo
          </SecondaryButton>
          <SecondaryButton style={{ flexBasis: '48%', flexGrow: 1 }} onPress={addVideoNote} disabled={isAddingVideo}>
            {isAddingVideo ? '⏳ Loading video…' : '🎬 Add video'}
          </SecondaryButton>
        </View>
      </GlassCard>
      <TouchableOpacity
        onPress={() => setActiveTab('report')}
        activeOpacity={0.75}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.accent,
          borderRadius: theme.radii.md,
          marginTop: theme.spacing.xs,
          marginBottom: theme.spacing.lg,
        }}
      >
        <Body style={{ color: '#fff', fontWeight: '600' }}>View Report</Body>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </>
  );

  const renderNotesTab = () => {
    const noteData = project?.notes || [];

    return (
      <Animated.View entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
        <Screen scrollable={false} style={{ flex: 1 }}>
          {renderTokenModal()}
          <FlatList
            data={loading ? [] : noteData}
            keyExtractor={(item) => item.id}
            renderItem={renderNoteItem}
            ListHeaderComponent={
              <View style={{ gap: theme.spacing.md }}>
                {renderHeader()}
                {renderProjectDescription()}
                {noteComposer}
                {loading && <Caption muted>Loading notes…</Caption>}
              </View>
            }
            ListEmptyComponent={!loading ? <Caption muted>No notes yet. Add your first observation.</Caption> : null}
            contentContainerStyle={{ paddingBottom: theme.spacing.xl * 1.5 }}
            showsVerticalScrollIndicator={false}
          />
        </Screen>
      </Animated.View>
    );
  };

  const renderReportTab = () => (
    <Animated.View entering={FadeInRight.duration(320)} style={{ flex: 1 }}>
      <Screen>
        {renderTokenModal()}
        <View style={{ gap: theme.spacing.md }}>
          {renderHeader()}
          <ReportDetailsSection
            meta={reportMetaDraft}
            onChange={setReportMetaDraft}
            onSave={saveReportMeta}
            isOpen={reportMetaOpen}
            onToggle={() => setReportMetaOpen((o) => !o)}
            saving={isSavingMeta}
            saveError={saveMetaError}
          />
          {activeTab === 'report' && renderReport()}
        </View>
      </Screen>
    </Animated.View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <Screen>
          <Caption muted>Loading project…</Caption>
        </Screen>
      );
    }

    if (!project) {
      return (
        <Screen>
          <GlassCard style={{ gap: theme.spacing.sm }}>
            <Title muted>Project not found</Title>
            <Body muted>We could not locate that project. It may have been removed.</Body>
            <PrimaryButton onPress={() => router.back()}>Go back</PrimaryButton>
          </GlassCard>
        </Screen>
      );
    }

    if (activeTab === 'notes') {
      return renderNotesTab();
    }

    return renderReportTab();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Stack.Screen
        options={{
          title: project?.name ?? 'Project',
          headerShown: true,
          headerBackTitleVisible: false,
          headerBackTitle: 'Projects',
        }}
      />

      {renderContent()}

      <ReportGeneratingOverlay visible={isGeneratingGoogleDoc} />
    </View>
  );
}
