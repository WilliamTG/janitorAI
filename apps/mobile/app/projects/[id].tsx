import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { Note, Project, PROJECT_STORAGE_KEY } from '@/src/features/projects/types';
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
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTab>('notes');

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
      const saved = await AsyncStorage.getItem(PROJECT_STORAGE_KEY);
      const parsed: Project[] = saved ? JSON.parse(saved) : [];
      const found = parsed.find((item) => item.id === projectId) ?? null;

      console.log('[Projects] Loaded project detail result', {
        projectId,
        found: Boolean(found),
      });

      setState({ projects: parsed, project: found });
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
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const persistProjects = async (nextProjects: Project[]) => {
    setState((prev) => ({ ...prev, projects: nextProjects }));
    try {
      await AsyncStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(nextProjects));
    } catch (error) {
      console.warn('[Projects] Failed to save changes', error);
      Alert.alert('Warning', 'Could not save changes to your device.');
    }
  };

  const updateProjectLocally = async (updated: Project) => {
    let nextProjects: Project[] = [];

    setState((prev) => {
      const baseProjects = prev.projects.length ? prev.projects : prev.project ? [prev.project] : [];
      nextProjects = baseProjects.some((p) => p.id === updated.id)
        ? baseProjects.map((p) => (p.id === updated.id ? updated : p))
        : [...baseProjects, updated];

      return { projects: nextProjects, project: updated };
    });

    await persistProjects(nextProjects);
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
      images: [uri],
    };

    const newNotes = [newNote, ...(project.notes || [])];
    await updateProjectNotes(newNotes);
    setNoteText('');
  };

  const addVideoNote = async () => {
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
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const uri = result.assets[0].uri;

    const trimmed = noteText.trim();
    const textForNote = trimmed || 'Video note (no manual text added yet).';

    const newNote: Note = {
      id: Date.now().toString(),
      text: textForNote,
      createdAt: new Date().toISOString(),
      videos: [uri],
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
      imagesCount: n.images ? n.images.length : 0,
      videosCount: n.videos ? n.videos.length : 0,
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

        {(item.videos?.length || 0) > 0 && <Caption muted>Videos attached: {item.videos?.length}</Caption>}

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
      <PrimaryButton onPress={createReportForProject} loading={isGeneratingReport} disabled={!isTokenValid}>
        {isGeneratingReport
          ? 'Creating report...'
          : project?.report
          ? 'Regenerate report'
          : 'Create report'}
      </PrimaryButton>

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
        <SecondaryButton style={{ flex: 1 }} onPress={addVideoNote}>
          Add video
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

  const debugOverlay = __DEV__ ? (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: theme.spacing.sm,
        left: theme.spacing.sm,
        padding: theme.spacing.xs,
        borderRadius: theme.radii.sm,
        backgroundColor: 'rgba(220, 38, 38, 0.9)',
      }}
    >
      <Caption style={{ color: 'white' }}>app/projects/[id].tsx</Caption>
      <Caption style={{ color: 'white' }}>id: {projectId ?? 'unknown'}</Caption>
    </View>
  ) : null;

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

      {debugOverlay}
    </View>
  );
}
