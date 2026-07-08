import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';

import { getApiBaseUrl } from '@/src/config/api';
import apiFetch, {
  clearTesterToken,
  loadTesterToken,
  setTesterToken,
  UnauthorizedError,
  validateTesterToken,
} from '@/src/lib/apiFetch';
import { Note, Project } from '@/src/features/projects/types';
import { loadProfile } from '@/src/storage/profileStorage';
import { applyNoteChanges } from '@/src/features/projects/noteChanges';
import {
  loadProjects,
  saveProjects,
  deleteProject as deleteProjectFromStorage,
} from '@/src/storage/projectsStorage';
import {
  deleteProjectRemote,
  pullAndMerge,
  schedulePush,
  syncNow,
  touchProject,
} from '@/src/sync/projectSync';
import { persistMediaLocally } from '@/src/sync/persistMedia';
import { displayMediaUri } from '@/src/sync/mediaUri';
import SyncStatusIndicator from '@/src/components/SyncStatusIndicator';
import {
  Body,
  Caption,
  DateField,
  GlassCard,
  IconButton,
  localDateString,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextField,
  Title,
  useAppTheme,
} from '@/src/ui';

type ProjectTab = 'notes' | 'report';

export default function Index() {
  const theme = useAppTheme();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDate, setProjectDate] = useState(() => localDateString(new Date()));
  const [projectInspector, setProjectInspector] = useState('');

  const [noteText, setNoteText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTab>('notes');
  const [describingPhotos, setDescribingPhotos] = useState<Set<string>>(new Set());
  const [editingPhotos, setEditingPhotos] = useState<Record<string, { editing: boolean; caption: string }>>({});

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  // showModal=true only when an in-flight AI call was rejected; never on cold start.
  const handleUnauthorized = async (showModal = true) => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenError('Invalid access token. Please enter a valid token to continue.');
    if (showModal) setShowTokenModal(true);
  };

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setTokenError(null);
    setShowTokenModal(true);
  };

  useEffect(() => {
    (async () => {
      let loaded: Project[] = [];
      try {
        loaded = await loadProjects();
        setProjects(loaded);
      } catch {
        console.warn('Failed to load projects');
      } finally {
        setIsLoading(false);
      }

      // Pull the durable copies from the server and merge (needs the token,
      // which is loaded by the token-validation effect before this resolves).
      try {
        const merged = await pullAndMerge(loaded);
        if (merged) {
          setProjects(merged);
          await saveProjects(merged);
        }
      } catch {
        console.warn('Initial sync failed');
      }
    })();
  }, []);

  const handleSyncNow = async () => {
    try {
      const merged = await syncNow(await loadProjects());
      if (merged) {
        setProjects(merged);
        await saveProjects(merged);
      }
    } catch {
      console.warn('Manual sync failed');
    }
  };

  const saveProjectsToStorage = async (newProjects: Project[], changedProject?: Project) => {
    let toSave = newProjects;
    let touched: Project | undefined;

    if (changedProject) {
      touched = touchProject(changedProject);
      toSave = newProjects.map((p) => (p.id === touched!.id ? touched! : p));
    }

    setProjects(toSave);
    try {
      await saveProjects(toSave);
    } catch {
      console.warn('Failed to save projects');
      Alert.alert('Warning', 'Could not save projects to your device.');
    }

    if (touched) {
      schedulePush(touched);
    }
  };

  const resetProjectForm = () => {
    setProjectName('');
    setProjectDate(localDateString(new Date()));
    setProjectInspector('');
  };

  const toggleProjectForm = () => {
    setIsCreatingProject((prev) => {
      const next = !prev;
      if (!next) {
        resetProjectForm();
      }
      return next;
    });
  };

  const createProject = async () => {
    const name = projectName.trim();
    const date = projectDate.trim();
    const inspector = projectInspector.trim();

    if (!name) {
      Alert.alert('Missing name', 'Please give the project a name.');
      return;
    }

    const profile = await loadProfile();

    const newProject: Project = {
      id: Date.now().toString(),
      name,
      inspectionDate: date || 'No date set',
      inspector: inspector || 'Unknown inspector',
      notes: [],
      reportMeta: {
        contributors: [{}],
        buildings: [{}],
        inspectionDoneByName: profile.name || undefined,
        inspectionDoneByPhone: profile.phone || undefined,
        inspectionDoneByCompany: profile.company || undefined,
      },
    };

    const newProjects = [newProject, ...projects];
    await saveProjectsToStorage(newProjects, newProject);
    resetProjectForm();
    setIsCreatingProject(false);
  };

  const deleteProject = async (id: string) => {
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      await stopPlayback();
    }
    const newProjects = await deleteProjectFromStorage(id);
    setProjects(newProjects);
    deleteProjectRemote(id).catch(() => {});
  };

  const updateProjectNotes = async (projectId: string, notes: Note[]) => {
    const changed = projects.find((p) => p.id === projectId);
    const updated = changed ? applyNoteChanges(changed, notes) : undefined;
    const newProjects = projects.map((p) => (p.id === projectId && updated ? updated : p));
    await saveProjectsToStorage(newProjects, updated);
  };

  const updateProjectReport = async (projectId: string, report: string) => {
    const changed = projects.find((p) => p.id === projectId);
    const updated = changed ? { ...changed, report } : undefined;
    const newProjects = projects.map((p) => (p.id === projectId && updated ? updated : p));
    await saveProjectsToStorage(newProjects, updated);
  };

  const addTextNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    if (!selectedProject) {
      Alert.alert('Select project', 'Please select a project first.');
      return;
    }

    const newNote: Note = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    const newNotes = [newNote, ...(selectedProject.notes || [])];
    await updateProjectNotes(selectedProject.id, newNotes);
    setNoteText('');
  };

  const deleteNote = async (id: string) => {
    if (!selectedProject) return;
    const newNotes = (selectedProject.notes || []).filter((n) => n.id !== id);
    await updateProjectNotes(selectedProject.id, newNotes);
  };

  const startRecording = async () => {
    try {
      if (!selectedProject) {
        Alert.alert('Select project', 'Please select a project first.');
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
      if (!recording || !selectedProject) return;

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

      const newNotes = [newNote, ...(selectedProject.notes || [])];
      await updateProjectNotes(selectedProject.id, newNotes);
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

  const stopPlayback = async () => {
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
  };

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
    if (!selectedProject) return;

    const note = selectedProject.notes.find((n) => n.id === noteId);
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

      const newNotes = (selectedProject.notes || []).map((n) => (n.id === noteId ? { ...n, transcription: textFromApi } : n));
      await updateProjectNotes(selectedProject.id, newNotes);
      Alert.alert('Transcribed', 'The transcription has been saved to this note.');
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Transcription error');
      Alert.alert('Transcription error', 'Something went wrong while contacting the backend.');
    }
  };

  const autoDescribePhoto = async (noteId: string, photoId: string) => {
    if (!selectedProject) return;

    const note = selectedProject.notes.find((n) => n.id === noteId);
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

      const newNotes = selectedProject.notes.map((n) => {
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

      await updateProjectNotes(selectedProject.id, newNotes);
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
    if (!selectedProject) return;

    const newNotes = selectedProject.notes.map((n) => {
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

    await updateProjectNotes(selectedProject.id, newNotes);
  };

  const addPhotoNote = async () => {
    if (!selectedProject) {
      Alert.alert('Select project', 'Please select a project first.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const uri = await persistMediaLocally(result.assets[0].uri);

    const trimmed = noteText.trim();
    const textForNote = trimmed || 'Photo note (no manual text added yet).';

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

    const newNotes = [newNote, ...(selectedProject.notes || [])];
    await updateProjectNotes(selectedProject.id, newNotes);
    setNoteText('');
  };



  const createReportForSelectedProject = async () => {
    if (!selectedProject) return;

    const notes = selectedProject.notes || [];
    if (notes.length === 0) {
      Alert.alert('No notes', 'Add some notes first.');
      return;
    }

    const payloadNotes = notes.map((n) => ({
      text: n.text,
      createdAt: new Date(n.createdAt).toLocaleString(),
      transcription: n.transcription,
      photos: n.photos?.map(p => ({ caption: p.caption })) || [],
      legacyImagesCount: n.images ? n.images.length : 0,
    }));

    try {
      setIsGeneratingReport(true);

      const response = await apiFetch(`${getApiBaseUrl()}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: {
            name: selectedProject.name,
            inspectionDate: selectedProject.inspectionDate,
            inspector: selectedProject.inspector,
          },
          notes: payloadNotes,
        }),
      });

      if (!response.ok) {
        console.error('Backend error: report generation failed');
        Alert.alert('Report generation failed', 'Backend error.');
        return;
      }

      const data = await response.json();
      const reportText = data.report;

      if (!reportText) {
        Alert.alert('No report', 'Backend returned no report text.');
        return;
      }

      await updateProjectReport(selectedProject.id, reportText);
      Alert.alert('Report created', 'Saved to this project.');
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Error calling backend');
      Alert.alert('Error', 'Could not reach backend.');
    } finally {
      setIsGeneratingReport(false);
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
    <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => setShowTokenModal(true)}>
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
          <Title>Enter tester token</Title>
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

  const renderProjectCard = ({ item, index }: { item: Project; index: number }) => {
    const notes = item.notes || [];
    const noteCount = notes.length;
    const audioCount = notes.filter((n) => n.audioUri).length;
    const photoCount = notes.reduce((sum, n) => sum + (n.photos?.length || 0), 0);

    return (
      <Animated.View entering={FadeInDown.springify().delay(index * 50)}>
        <GlassCard style={{ marginBottom: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm }}>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Title numberOfLines={1}>{item.name}</Title>
              <Caption muted>Inspection: {item.inspectionDate}</Caption>
              <Caption muted>Inspector: {item.inspector}</Caption>
            </View>
            <IconButton
              accessibilityLabel="Delete project"
              onPress={() => deleteProject(item.id)}
              style={{ backgroundColor: theme.colors.surfaceSecondary }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </IconButton>
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              marginTop: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <StatPill icon="document-text-outline" label={`${noteCount} notes`} />
            <StatPill icon="mic-outline" label={`${audioCount} audio`} />
            <StatPill icon="camera-outline" label={`${photoCount} photos`} />
          </View>

          <View style={{ flexDirection: 'row', marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            <PrimaryButton
              width="100%"
              onPress={() => {
                const route = `/projects/${item.id}`;

                console.log('[Projects] Navigating to project detail', {
                  projectId: item.id,
                  route,
                  expectedRouteFile: 'app/projects/[id].tsx',
                });

                router.push(route);
              }}
            >
              Open
            </PrimaryButton>
          </View>
        </GlassCard>
      </Animated.View>
    );
  };

  const renderProjectListHeader = () => (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Caption muted>Inspections</Caption>
          <Title>Projects</Title>
        </View>
        <IconButton onPress={() => setShowTokenModal(true)}>
          <Ionicons name="key-outline" size={18} color={theme.colors.foreground} />
        </IconButton>
      </View>

      {tokenStatus !== 'valid' && (
        <GlassCard style={{ gap: theme.spacing.xs }}>
          <Title muted>Access needed</Title>
          <Body muted>Enter your tester token to unlock report generation.</Body>
          <PrimaryButton onPress={() => setShowTokenModal(true)}>Enter token</PrimaryButton>
        </GlassCard>
      )}

      {isCreatingProject && (
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <Title>Create project</Title>
          <TextField label="Project name" value={projectName} onChangeText={setProjectName} placeholder="Main lobby walkthrough" />
          <DateField label="Inspection date" value={projectDate} onChange={setProjectDate} />
          <TextField label="Inspector" value={projectInspector} onChangeText={setProjectInspector} placeholder="Your name" />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <PrimaryButton style={{ flex: 1 }} onPress={createProject}>Create</PrimaryButton>
            <SecondaryButton style={{ flex: 1 }} onPress={toggleProjectForm}>Cancel</SecondaryButton>
          </View>
        </GlassCard>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SyncStatusIndicator onSyncNow={handleSyncNow} />
        <SecondaryButton onPress={toggleProjectForm} width={140}>
          {isCreatingProject ? 'Close form' : 'New project'}
        </SecondaryButton>
      </View>
    </View>
  );

  const renderProjectList = () => (
    <Screen scrollable={false} style={{ flex: 1 }}>
      {renderTokenModal()}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectCard}
        ListHeaderComponent={renderProjectListHeader()}
        ListEmptyComponent={<Caption muted>No projects yet. Tap “New project” to start.</Caption>}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl * 1.5 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );

  const renderNoteItem = ({ item, index }: { item: Note; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
      <GlassCard style={{ marginBottom: theme.spacing.sm, gap: theme.spacing.xs }}>
        <Body>{item.text}</Body>
        <Caption muted>{new Date(item.createdAt).toLocaleString()}</Caption>

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

  const renderReport = () => (
    <View style={{ gap: theme.spacing.md }}>
      <PrimaryButton onPress={createReportForSelectedProject} loading={isGeneratingReport}>
        {isGeneratingReport
          ? 'Creating report...'
          : selectedProject?.report
          ? 'Regenerate report'
          : 'Create report'}
      </PrimaryButton>

      {selectedProject?.report ? (
        <GlassCard style={{ maxHeight: 420 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Body>{selectedProject.report}</Body>
          </ScrollView>
        </GlassCard>
      ) : (
        <Caption muted>No report yet. Generate one to view it here.</Caption>
      )}
    </View>
  );

  const renderProjectDetail = () => {
    if (!selectedProject) return null;
    const projectNotes = selectedProject.notes || [];
    const projectHeader = (
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <IconButton
              onPress={async () => {
                await stopPlayback();
                setSelectedProjectId(null);
              }}
            >
              <Ionicons name="chevron-back" size={18} color={theme.colors.foreground} />
            </IconButton>
            <View>
              <Caption muted>Project</Caption>
              <Title numberOfLines={1}>{selectedProject.name}</Title>
            </View>
          </View>
          <IconButton onPress={() => setShowTokenModal(true)}>
            <Ionicons name="key-outline" size={18} color={theme.colors.foreground} />
          </IconButton>
        </View>

        <GlassCard style={{ gap: theme.spacing.xs }}>
          <Body muted>Inspection date: {selectedProject.inspectionDate}</Body>
          <Body muted>Inspector: {selectedProject.inspector}</Body>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <SecondaryButton
              style={{ flex: 1, borderColor: activeProjectTab === 'notes' ? theme.colors.accent : theme.colors.border }}
              onPress={() => setActiveProjectTab('notes')}
            >
              Notes
            </SecondaryButton>
            <SecondaryButton
              style={{ flex: 1, borderColor: activeProjectTab === 'report' ? theme.colors.accent : theme.colors.border }}
              onPress={() => setActiveProjectTab('report')}
            >
              Report
            </SecondaryButton>
          </View>
        </GlassCard>
      </View>
    );

    const noteComposer = (
      <GlassCard style={{ gap: theme.spacing.sm }}>
        <Caption muted>What would you say during the inspection?</Caption>
        <TextField
          multiline
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Type your observation here..."
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <PrimaryButton style={{ flex: 1 }} onPress={addTextNote}>
            Save text note
          </PrimaryButton>
          <SecondaryButton style={{ flex: 1 }} onPress={handleRecordPress}>
            {recording ? 'Stop & save voice' : 'Voice note'}
          </SecondaryButton>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <SecondaryButton style={{ flex: 1 }} onPress={addPhotoNote}>
            Add photo
          </SecondaryButton>
        </View>
      </GlassCard>
    );

    if (activeProjectTab === 'notes') {
      return (
        <Animated.View entering={FadeInRight.duration(320)}>
          <Screen scrollable={false} style={{ flex: 1 }}>
            {renderTokenModal()}
            <FlatList
              data={isLoading ? [] : projectNotes}
              keyExtractor={(item) => item.id}
              renderItem={renderNoteItem}
              ListHeaderComponent={
                <View style={{ gap: theme.spacing.md }}>
                  {projectHeader}
                  {noteComposer}
                  {isLoading && <Caption muted>Loading notes…</Caption>}
                </View>
              }
              ListEmptyComponent={!isLoading ? <Caption muted>No notes yet. Add your first observation.</Caption> : null}
              contentContainerStyle={{ paddingBottom: theme.spacing.xl * 1.5 }}
              showsVerticalScrollIndicator={false}
            />
          </Screen>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInRight.duration(320)}>
        <Screen>
          {renderTokenModal()}
          <View style={{ gap: theme.spacing.md }}>
            {projectHeader}
            {activeProjectTab === 'report' && renderReport()}
          </View>
        </Screen>
      </Animated.View>
    );
  };

  if (selectedProject) {
    return renderProjectDetail();
  }

  return renderProjectList();
}

type StatPillProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const StatPill = ({ icon, label }: StatPillProps) => {
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexBasis: '48%',
        flexGrow: 1,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        backgroundColor: theme.colors.surfaceSecondary,
        borderRadius: theme.radii.pill,
        gap: theme.spacing.xs,
      }}
    >
      <Ionicons name={icon} size={16} color={theme.colors.accentStrong} />
      <Caption>{label}</Caption>
    </View>
  );
};
