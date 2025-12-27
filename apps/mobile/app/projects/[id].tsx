import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Modal, ScrollView, Share, View } from 'react-native';
import { Buffer } from 'buffer';
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
import {
  loadProjects,
  getProject,
  updateProject as updateProjectInStorage,
} from '@/src/storage/projectsStorage';
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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTab>('notes');
  const [describingPhotos, setDescribingPhotos] = useState<Set<string>>(new Set());
  const [editingPhotos, setEditingPhotos] = useState<Record<string, { editing: boolean; caption: string }>>({});
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [isTranscribingDescription, setIsTranscribingDescription] = useState(false);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const project = state.project;
  const isTokenValid = tokenStatus === 'valid';

  const handleUnauthorized = useCallback(async () => {
    await clearTesterToken();
    setTokenStatus('invalid');
    setTokenError('Invalid access token. Please enter a valid token to continue.');
    setShowTokenModal(true);
  }, []);

  useEffect(() => {
    (async () => {
      const storedToken = await loadTesterToken();

      if (!storedToken) {
        setTokenStatus('invalid');
        setShowTokenModal(true);
        return;
      }

      const isValid = await validateTesterToken(storedToken);
      if (isValid) {
        setTokenInput(storedToken);
        setTokenStatus('valid');
        setTokenError(null);
      } else {
        await handleUnauthorized();
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
      const projects = await loadProjects();
      const found = await getProject(projectId);

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

  useEffect(() => {
    if (!isEditingDescription) {
      setDescriptionDraft(state.project?.projectDescriptionText ?? '');
    }
  }, [isEditingDescription, state.project]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const updateProjectLocally = async (updated: Project) => {
    // Update project in storage and get back all projects
    const nextProjects = await updateProjectInStorage(updated);
    const normalizedId = String(updated.id);
    const normalizedProject = { ...updated, id: normalizedId };
    setState({ projects: nextProjects, project: normalizedProject });
  };

  const updateProjectNotes = async (notes: Note[]) => {
    if (!project) return;
    const updatedProject = { ...project, notes };
    await updateProjectLocally(updatedProject);
  };

  const updateProjectReport = async (report: string) => {
    if (!project) return;
    const updatedProject = { ...project, report };
    await updateProjectLocally(updatedProject);
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

      const trimmed = noteText.trim();
      const textForNote = trimmed || 'Voice note (no text added yet – transcription later)';

      const newNote: Note = {
        id: Date.now().toString(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        audioUri: uri,
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

      const updatedProject: Project = {
        ...project,
        projectDescriptionAudioUri: uri,
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

  const addPhotoNote = async () => {
    if (!project) {
      Alert.alert('Select project', 'Please wait for the project to load first.');
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

    const uri = result.assets[0].uri;

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

    const newNotes = [newNote, ...(project.notes || [])];
    await updateProjectNotes(newNotes);
    setNoteText('');
  };



  const createReportForProject = async () => {
    if (!project) return;

    const notes = project.notes || [];
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
            name: project.name,
            inspectionDate: project.inspectionDate,
            inspector: project.inspector,
            descriptionText: project.projectDescriptionText,
            descriptionTranscription: project.projectDescriptionTranscription,
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

      await updateProjectReport(reportText);
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

  const exportReportAsDocx = async () => {
    if (!project?.report) {
      Alert.alert('No report', 'Generate a report before exporting.');
      return;
    }

    try {
      setIsExportingDocx(true);

      const response = await apiFetch(`${getApiBaseUrl()}/report/docx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportText: project.report,
          project: {
            name: project.name,
            inspectionDate: project.inspectionDate,
            inspector: project.inspector,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('Backend error: report export failed', { status: response.status });
        Alert.alert('Export failed', errorText || 'Backend error.');
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

      if (!targetDir) {
        throw new Error('No writable directory available');
      }

      const safeName = (project.name || 'Project').replace(/[\\/:*?"<>|]/g, '_');
      const fileUri = `${targetDir}Inspection Report - ${safeName}.docx`;

      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Share.share({
        url: fileUri,
        title: 'Inspection report',
        message: `Inspection report for ${project.name}`,
      });
    } catch (error) {
      if (await handleApiError(error)) return;
      console.error('Error exporting report DOCX', error);
      Alert.alert('Export failed', 'Could not export the report. Please try again.');
    } finally {
      setIsExportingDocx(false);
    }
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
                    source={{ uri: photo.uri }}
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
            <SecondaryButton onPress={() => playAudio(item.audioUri)} width={120}>
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
      <View style={{ gap: theme.spacing.sm }}>
        <PrimaryButton onPress={createReportForProject} loading={isGeneratingReport} disabled={!isTokenValid}>
          {isGeneratingReport
            ? 'Creating report...'
            : project?.report
            ? 'Regenerate report'
            : 'Create report'}
        </PrimaryButton>

        <SecondaryButton
          onPress={exportReportAsDocx}
          loading={isExportingDocx}
          disabled={!project?.report || !isTokenValid}
        >
          Export DOCX
        </SecondaryButton>

        {!project?.report && (
          <Caption muted>Generate report first.</Caption>
        )}
      </View>

      {!isTokenValid && (
        <Caption muted>Enter a valid tester token to enable report generation.</Caption>
      )}

      {project?.report ? (
        <GlassCard style={{ maxHeight: 420 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Body>{project.report}</Body>
          </ScrollView>
        </GlassCard>
      ) : (
        <Caption muted>No report yet. Generate one to view it here.</Caption>
      )}
    </View>
  );

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
              <SecondaryButton onPress={() => playAudio(project.projectDescriptionAudioUri)} width={120}>
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
    <GlassCard style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
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
          Save text note
        </PrimaryButton>
        <SecondaryButton style={{ flexBasis: '48%', flexGrow: 1 }} onPress={handleRecordPress}>
          {recording ? 'Stop & save voice' : 'Voice note'}
        </SecondaryButton>
        <SecondaryButton style={{ flexBasis: '48%', flexGrow: 1 }} onPress={addPhotoNote}>
          Add photo
        </SecondaryButton>
      </View>
    </GlassCard>
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
    </View>
  );
}
