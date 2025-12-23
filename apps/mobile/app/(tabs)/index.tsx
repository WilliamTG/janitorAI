import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Button,
  FlatList, Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"; // already have other RN imports
import { getApiBaseUrl } from '../../src/config/api';
import apiFetch, { clearTesterToken, loadTesterToken, setTesterToken, UnauthorizedError, validateTesterToken } from '../../src/lib/apiFetch';


type Note = {
  id: string;
  text: string;
  createdAt: string;
  audioUri?: string;
  transcription?: string;
  images?: string[];  // 🆕 local URIs to photos
  videos?: string[];  // 🆕 local URIs to videos
};

type Project = {
  id: string;
  name: string;
  inspectionDate: string;
  inspector: string;
  notes: Note[];
  report?: string;
};

const STORAGE_KEY = "@inspection_projects";

export default function Index() {
  // --- projects & selection ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  // --- create project form ---
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDate, setProjectDate] = useState("");
  const [projectInspector, setProjectInspector] = useState("");

  // --- notes inside selected project ---
  const [noteText, setNoteText] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  type ProjectTab = "notes" | "report";
  const [isFabOpen, setIsFabOpen] = useState(false);
  const fabMenuAnim = useRef(new Animated.Value(0)).current;

  // Tester token state and modal logic
  const [testerToken, setTesterTokenState] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);


  const [activeProjectTab, setActiveProjectTab] =
  useState<"notes" | "report">("notes");

  const PrimaryButton = ({
    title,
    onPress,
  }: {
    title: string;
    onPress: () => void;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>{title}</Text>
      </Pressable>
    );
  };  

  useEffect(() => {
  if (isFabOpen) {
    fabMenuAnim.setValue(0);
    Animated.spring(fabMenuAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 50,
    }).start();
  }
}, [isFabOpen]);




  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleUnauthorized = async () => {
    await clearTesterToken();
    setTesterTokenState(null);
    setTokenStatus('invalid');
    setTokenError('Invalid access token. Please enter a valid token to continue.');
    setShowTokenModal(true);
  };

  // ------- TOKEN INITIALIZATION --------
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
        setTesterTokenState(storedToken);
        setTokenInput(storedToken);
        setTokenStatus('valid');
        setTokenError(null);
      } else {
        await handleUnauthorized();
      }
    })();
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
      setTesterTokenState(trimmedToken);
      setTokenStatus('valid');
      setShowTokenModal(false);
      return;
    }

    await handleUnauthorized();
  };

  const handleRemoveToken = async () => {
    await clearTesterToken();
    setTesterTokenState(null);
    setTokenStatus('invalid');
    setTokenInput('');
    setTokenError(null);
    setShowTokenModal(true);
  };

  const handleApiError = async (error: unknown) => {
    if (error instanceof UnauthorizedError || (error as any)?.status === 401) {
      await handleUnauthorized();
      return true;
    }

    return false;
  };

  const renderTokenModal = () => (
    <Modal
      visible={showTokenModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowTokenModal(true)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Enter Tester Token</Text>
          <Text style={styles.modalSubtitle}>
            You need a tester token to use this app. Please enter it below:
          </Text>
          {tokenError && <Text style={styles.modalError}>{tokenError}</Text>}
          <TextInput
            style={styles.modalInput}
            placeholder="Tester token"
            value={tokenInput}
            onChangeText={(value) => {
              setTokenInput(value);
              setTokenError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[
              styles.modalButton,
              isValidatingToken && styles.modalButtonDisabled,
            ]}
            onPress={saveToken}
            disabled={isValidatingToken}
          >
            {isValidatingToken ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.modalButtonText}>Validate & Save</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.secondaryModalButton, isValidatingToken && styles.modalButtonDisabled]}
            onPress={handleRemoveToken}
            disabled={isValidatingToken}
          >
            <Text style={styles.secondaryModalButtonText}>Remove token</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  // ------- STORAGE --------

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: Project[] = JSON.parse(saved);
          setProjects(parsed);
        }
      } catch (error) {
        // Avoid logging full error objects (may contain sensitive data)
        console.warn("Failed to load projects");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveProjectsToStorage = async (newProjects: Project[]) => {
    setProjects(newProjects);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
    } catch (error) {
      // Avoid logging full error objects (may contain sensitive data)
      console.warn("Failed to save projects");
      Alert.alert("Warning", "Could not save projects to your device.");
    }
  };

  // ------- PROJECTS --------

  const resetProjectForm = () => {
    setProjectName("");
    setProjectDate("");
    setProjectInspector("");
  };

  const createProject = async () => {
    const name = projectName.trim();
    const date = projectDate.trim();
    const inspector = projectInspector.trim();

    if (!name) {
      Alert.alert("Missing name", "Please give the project a name.");
      return;
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name,
      inspectionDate: date || "No date set",
      inspector: inspector || "Unknown inspector",
      notes: [],
    };

    const newProjects = [newProject, ...projects];
    await saveProjectsToStorage(newProjects);
    resetProjectForm();
    setIsCreatingProject(false);
  };

  const deleteProject = async (id: string) => {
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      await stopPlayback();
    }
    const newProjects = projects.filter((p) => p.id !== id);
    await saveProjectsToStorage(newProjects);
  };

  // ------- NOTES (for selected project) --------

  const updateProjectNotes = async (projectId: string, notes: Note[]) => {
    const newProjects = projects.map((p) =>
      p.id === projectId ? { ...p, notes } : p
    );
    await saveProjectsToStorage(newProjects);
  };

  const updateProjectReport = async (projectId: string, report: string) => {
  const newProjects = projects.map((p) =>
    p.id === projectId ? { ...p, report } : p
  );
  await saveProjectsToStorage(newProjects);
};


  const addTextNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    if (!selectedProject) {
      Alert.alert("Select project", "Please select a project first.");
      return;
    }

    const newNote: Note = {
      id: Date.now().toString(),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    const newNotes = [newNote, ...(selectedProject.notes || [])];
    await updateProjectNotes(selectedProject.id, newNotes);
    setNoteText("");
  };

  // ------- RECORDING --------

  const startRecording = async () => {
    try {
      if (!selectedProject) {
        Alert.alert("Select project", "Please select a project first.");
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Microphone permission is required.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (error) {
      // Avoid logging full error objects (may contain sensitive data)
      console.error("Failed to start recording");
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording || !selectedProject) return;

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert("Error", "No audio file found.");
        return;
      }

      const trimmed = noteText.trim();
      const textForNote =
        trimmed || "Voice note (no text added yet – transcription later)";

      const newNote: Note = {
        id: Date.now().toString(),
        text: textForNote,
        createdAt: new Date().toISOString(),
        audioUri: uri,
      };

      const newNotes = [newNote, ...(selectedProject.notes || [])];
      await updateProjectNotes(selectedProject.id, newNotes);
      setNoteText("");
    } catch (error) {
      // Avoid logging full error objects (may contain sensitive data)
      console.error("Failed to stop recording");
      Alert.alert("Error", "Could not stop recording.");
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

  // ------- PLAYBACK --------

  const stopPlayback = async () => {
    try {
      if (currentSound) {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded) {
          await currentSound.stopAsync();
        }
        await currentSound.unloadAsync();
      }
    } catch (error) {
      // Avoid logging full error objects (may contain sensitive data)
      console.error("Failed to stop playback");
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
    } catch (error) {
      // Avoid logging full error objects (may contain sensitive data)
      console.error("Failed to play audio");
      Alert.alert("Error", "Could not play this recording.");
    }
  };

  // ------- DELETE & TRANSCRIBE NOTES --------

  const deleteNote = async (noteId: string) => {
    if (!selectedProject) return;

    const newNotes = (selectedProject.notes || []).filter(
      (n) => n.id !== noteId
    );
    await updateProjectNotes(selectedProject.id, newNotes);
    await stopPlayback();
  };

const transcribeNote = async (noteId: string) => {
  if (!selectedProject) return;

  const note = (selectedProject.notes || []).find((n) => n.id === noteId);
  if (!note?.audioUri) {
    Alert.alert("No recording", "This note has no audio to transcribe.");
    return;
  }

  try {
    const formData = new FormData();
    formData.append("file", {
      uri: note.audioUri,
      name: "audio.m4a",
      type: "audio/m4a",
    } as any);

    const response = await apiFetch(`${getApiBaseUrl()}/transcribe`, {
      method: "POST",
      // ⚠️ Do NOT set Content-Type manually here; RN will set the correct multipart boundary
      body: formData,
    });

    if (!response.ok) {
      // Avoid logging raw error responses (may contain sensitive data)
      console.error("Backend /transcribe error: non-OK response");
      Alert.alert(
        "Transcription failed",
        "The backend returned an error. Check the logs."
      );
      return;
    }

    const data: any = await response.json();
    const textFromApi: string | undefined = data.text;

    if (!textFromApi) {
      Alert.alert(
        "No text",
        "The transcription request succeeded but returned no text."
      );
      return;
    }

    // Update the note with the transcription text
  const newNotes = (selectedProject.notes || []).map((n) =>
      n.id === noteId ? { ...n, transcription: textFromApi } : n
    );

    await updateProjectNotes(selectedProject.id, newNotes);
    Alert.alert("Transcribed", "The transcription has been saved to this note.");
  } catch (error) {
    if (await handleApiError(error)) return;
    // Avoid logging full error objects (may contain sensitive data)
    console.error("Transcription error");
    Alert.alert(
      "Transcription error",
      "Something went wrong while contacting the backend."
    );
  }
};


const addPhotoNote = async () => {
  if (!selectedProject) {
    Alert.alert("Select project", "Please select a project first.");
    return;
  }

  // Ask for camera permission
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Camera permission is required.");
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7, // smaller files
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return;
  }

  const uri = result.assets[0].uri;

  const trimmed = noteText.trim();
  const textForNote =
    trimmed || "Photo note (no manual text added yet).";

  const newNote: Note = {
    id: Date.now().toString(),
    text: textForNote,
    createdAt: new Date().toISOString(),
    images: [uri],
  };

  const newNotes = [newNote, ...(selectedProject.notes || [])];
  await updateProjectNotes(selectedProject.id, newNotes);
  setNoteText("");
};

const addVideoNote = async () => {
  if (!selectedProject) {
    Alert.alert("Select project", "Please select a project first.");
    return;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Camera permission is required.");
    return;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    quality: 0.7,
    videoMaxDuration: 60, // keep it short for now
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return;
  }

  const uri = result.assets[0].uri;

  const trimmed = noteText.trim();
  const textForNote =
    trimmed || "Video note (no manual text added yet).";

  const newNote: Note = {
    id: Date.now().toString(),
    text: textForNote,
    createdAt: new Date().toISOString(),
    videos: [uri],
  };

  const newNotes = [newNote, ...(selectedProject.notes || [])];
  await updateProjectNotes(selectedProject.id, newNotes);
  setNoteText("");
};


const createReportForSelectedProject = async () => {
  if (!selectedProject) return;

  const notes = selectedProject.notes || [];
  if (notes.length === 0) {
    Alert.alert("No notes", "Add some notes first.");
    return;
  }

  // Convert notes into minimal shape for backend
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      // Avoid logging raw error responses (may contain sensitive data)
      console.error("Backend error: report generation failed");
      Alert.alert("Report generation failed", "Backend error.");
      return;
    }

    const data = await response.json();
    const reportText = data.report;

    if (!reportText) {
      Alert.alert("No report", "Backend returned no report text.");
      return;
    }

    await updateProjectReport(selectedProject.id, reportText);
    Alert.alert("Report created", "Saved to this project.");
  } catch (error) {
    if (await handleApiError(error)) return;
    // Avoid logging full error objects (may contain sensitive data)
    console.error("Error calling backend");
    Alert.alert("Error", "Could not reach backend.");
  } finally {
    setIsGeneratingReport(false);
  }
};



  // ------- RENDER HELPERS --------

const renderProjectItem = ({ item }: { item: Project }) => {
  const notes = item.notes || [];
  const noteCount = notes.length;
  const audioCount = notes.filter((n) => n.audioUri).length;
  const photoCount = notes.filter((n) => n.images && n.images.length > 0).length;
  const videoCount = notes.filter((n) => n.videos && n.videos.length > 0).length;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setSelectedProjectId(item.id)}
      style={styles.projectCardWrapper}
    >
      <BlurView intensity={45} tint="light" style={styles.projectCard}>
        <Text style={styles.projectName}>{item.name}</Text>

        <View style={styles.projectMetaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color="rgba(37, 99, 235, 0.85)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.projectMetaText}>{item.inspectionDate}</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons
              name="person-outline"
              size={14}
              color="rgba(37, 99, 235, 0.85)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.projectMetaText} numberOfLines={1}>
              {item.inspector}
            </Text>
          </View>
        </View>

        <View style={styles.projectStatsRow}>
          <View style={styles.statItem}>
            <Ionicons
              name="document-text-outline"
              size={14}
              color="rgba(30, 64, 175, 0.9)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.projectStatText}>{noteCount} notes</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name="mic-outline"
              size={14}
              color="rgba(30, 64, 175, 0.9)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.projectStatText}>{audioCount} audio</Text>
          </View>
        </View>

        <View style={styles.projectStatsRow}>
          <View style={styles.statItem}>
            <Ionicons
              name="camera-outline"
              size={14}
              color="rgba(30, 64, 175, 0.9)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.projectStatText}>{photoCount} photos</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name="videocam-outline"
              size={14}
              color="rgba(30, 64, 175, 0.9)"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.projectStatText}>{videoCount} videos</Text>
          </View>
        </View>

        <Pressable
          style={styles.deleteProjectButton}
          onPress={() => deleteProject(item.id)}
        >
          <Text style={styles.deleteProjectText}>Delete project</Text>
        </Pressable>
      </BlurView>
    </TouchableOpacity>
  );
};


  const renderNoteItem = ({ item }: { item: Note }) => (
    <View style={styles.note}>
      <Text style={styles.noteText}>{item.text}</Text>
      <Text style={styles.noteMeta}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>
      {item.images && item.images.length > 0 && (
      <View style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 12, marginBottom: 4 }}>
            📷 Photo attachments: {item.images.length}
            </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {item.images.map((uri, idx) => (
        <Image
          key={idx}
          source={{ uri }}
          style={{ width: 80, height: 80, marginRight: 6, marginBottom: 6, borderRadius: 4 }}
            />
            ))}
          </View>
        </View>
          )}

{item.videos && item.videos.length > 0 && (
  <View style={{ marginTop: 4 }}>
    <Text style={{ fontSize: 12 }}>
      🎥 Video attachments: {item.videos.length} (playback UI can be added later)
    </Text>
  </View>
)}


      {item.audioUri && (
        <View style={styles.noteActionsRow}>
          <View style={styles.noteButton}>
            <Button title="▶ Play" onPress={() => playAudio(item.audioUri)} />
          </View>
          <View style={styles.noteButton}>
            <Button title="⏹ Stop" onPress={stopPlayback} />
          </View>
          <View style={styles.noteButton}>
            <Button
              title="Transcribe"
              onPress={() => transcribeNote(item.id)}
            />
          </View>
        </View>
      )}

      <View style={styles.noteActionsRow}>
        <View style={styles.noteButton}>
          <Button title="Delete" onPress={() => deleteNote(item.id)} />
        </View>
      </View>

      {item.transcription && (
        <View style={styles.transcriptionBox}>
          <Text style={styles.transcriptionLabel}>Transcription (demo)</Text>
          <Text style={styles.transcriptionText}>{item.transcription}</Text>
        </View>
      )}
    </View>
  );

  // ------- SCREENS --------

  const tokenModal = renderTokenModal();

  if (tokenStatus !== 'valid') {
    return (
      <LinearGradient
        colors={["#F7FAFF", "#F0F5FF", "#EBF0FA"]}
        style={styles.gradientBackground}
      >
        <SafeAreaView style={styles.safeArea}>
          {tokenModal}
          <View style={[styles.container, styles.tokenGateContainer]}>
            <Text style={styles.projectsTitle}>Access token required</Text>
            <Text style={styles.modalSubtitle}>
              You need a valid tester token to use this app. Please enter it to continue.
            </Text>
            {tokenError && <Text style={styles.modalError}>{tokenError}</Text>}
            {tokenStatus === 'checking' ? (
              <ActivityIndicator color="#1D4ED8" />
            ) : (
              <Pressable style={styles.modalButton} onPress={() => setShowTokenModal(true)}>
                <Text style={styles.modalButtonText}>Enter token</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // 1) PROJECT LIST SCREEN
if (!selectedProject) {
  return (
    <LinearGradient
      colors={["#F7FAFF", "#F0F5FF", "#EBF0FA"]}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.safeArea}>
        {tokenModal}
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.projectsHeaderRow}>
            <Text style={styles.projectsTitle}>Projects</Text>
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerTokenButton}
                onPress={() => {
                  setTokenError(null);
                  setShowTokenModal(true);
                }}
              >
                <Ionicons name="key-outline" size={20} color="#1D4ED8" />
              </Pressable>
              <Pressable
                style={styles.headerPlusButton}
                onPress={() => {
                  setIsCreatingProject((prev) => !prev);
                  resetProjectForm();
                }}
              >
                <Ionicons
                  name={isCreatingProject ? "close" : "add"}
                  size={24}
                  color="#1D4ED8"
                />
              </Pressable>
            </View>
          </View>

          {/* New project panel */}
          {isCreatingProject && (
            <BlurView intensity={40} tint="light" style={styles.newProjectBox}>
              <Text style={styles.sectionTitle}>New project</Text>
              <TextInput
                style={styles.input}
                placeholder="Project name"
                value={projectName}
                onChangeText={setProjectName}
              />
              <TextInput
                style={styles.input}
                placeholder="Inspection date (e.g. 2025-01-04)"
                value={projectDate}
                onChangeText={setProjectDate}
              />
              <TextInput
                style={styles.input}
                placeholder="Inspector name"
                value={projectInspector}
                onChangeText={setProjectInspector}
              />
              <Button title="Create project" onPress={createProject} />
            </BlurView>
          )}

          <Text style={styles.sectionTitle}>Your projects</Text>

          {isLoading ? (
            <Text style={styles.empty}>Loading projects…</Text>
          ) : (
            <FlatList
              data={projects}
              keyExtractor={(item) => item.id}
              renderItem={renderProjectItem}
              contentContainerStyle={{ paddingBottom: 96 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons
                    name="folder-open-outline"
                    size={40}
                    color="rgba(37, 99, 235, 0.7)"
                  />
                  <Text style={styles.emptyTitle}>No projects yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Tap the + button to create your first inspection project.
                  </Text>
                </View>
              }
            />
          )}

          {/* Floating add button (same as + in header, just nicer UX) */}
          <Pressable
            style={styles.fab}
            onPress={() => {
              setIsCreatingProject(true);
            }}
          >
            <BlurView
              intensity={60}
              tint="light"
              style={styles.fabInnerBlur}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </BlurView>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}


  // 2) PROJECT DETAIL SCREEN (NOTES + AUDIO)
  const projectNotes = selectedProject.notes || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      {tokenModal}
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={async () => {
              await stopPlayback();
              setSelectedProjectId(null);
            }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.backButtonText}>← Projects</Text>
          </Pressable>

          <Text style={styles.title} numberOfLines={1}>
            {selectedProject.name}
          </Text>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerTokenButton}
              onPress={() => {
                setTokenError(null);
                setShowTokenModal(true);
              }}
            >
              <Ionicons name="key-outline" size={20} color="#1D4ED8" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.projectInfo}>
          Date: {selectedProject.inspectionDate}
        </Text>
        <Text style={styles.projectInfo}>
          Inspector: {selectedProject.inspector}
        </Text>
        {/* Tab selector */}
        <View style={styles.projectTabBar}>
          <Pressable
            style={[
              styles.projectTab,
              activeProjectTab === "notes" && styles.projectTabActive,
            ]}
            onPress={() => setActiveProjectTab("notes")}
          >
            <Text
              style={[
                styles.projectTabText,
                activeProjectTab === "notes" && styles.projectTabTextActive,
              ]}
            >
              Notes
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.projectTab,
              activeProjectTab === "report" && styles.projectTabActive,
            ]}
            onPress={() => setActiveProjectTab("report")}
          >
            <Text
              style={[
                styles.projectTabText,
                activeProjectTab === "report" && styles.projectTabTextActive,
              ]}
            >
              Report
            </Text>
          </Pressable>
        </View>
        {/* NOTES TAB */}
{activeProjectTab === "notes" && (
  <>
    <Text style={[styles.label, { marginTop: 16 }]}>
      What would you say during the inspection?
    </Text>

    <TextInput
      style={styles.input}
      placeholder="Type your observation here..."
      multiline
      value={noteText}
      onChangeText={setNoteText}
    />

    <Text style={styles.subTitle}>Notes for this project</Text>
    {isLoading ? (
      <Text style={styles.empty}>Loading notes…</Text>
    ) : (
      <FlatList
        data={projectNotes}
        keyExtractor={(item) => item.id}
        renderItem={renderNoteItem}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No notes yet. Use the + button to add your first note.
          </Text>
        }
      />
    )}
  </>
)}

{/* REPORT TAB */}
{activeProjectTab === "report" && (
  <>
    <View style={{ marginTop: 16, marginBottom: 8 }}>
    <PrimaryButton
      title={
        isGeneratingReport
          ? "Creating report..."
          : selectedProject.report
          ? "Regenerate report"
          : "Create report"
      }
      onPress={createReportForSelectedProject}
    />

    </View>

    {selectedProject.report ? (
      <View style={styles.reportBox}>
        <Text style={styles.reportTitle}>Generated report</Text>
        <ScrollView style={styles.reportScroll}>
          <Text style={styles.reportText}>{selectedProject.report}</Text>
        </ScrollView>
      </View>
    ) : (
      <Text style={[styles.empty, { marginTop: 12 }]}>
        No report yet. Tap "Create report" to generate one from your notes.
      </Text>
    )}
  </>
)}
      {/* Liquid Glass FAB for adding notes (only on Notes tab) */}
      {activeProjectTab === "notes" && (
        <View pointerEvents="box-none" style={styles.fabProjectContainer}>
          {isFabOpen && (
              <Animated.View
    style={[
      styles.fabProjectMenu,
      {
        opacity: fabMenuAnim,
        transform: [
          {
            translateY: fabMenuAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0], // slide up a bit
            }),
          },
        ],
      },
    ]}
  >
              <BlurView intensity={70} tint="dark" style={styles.fabProjectMenuBlur}>
                <Pressable
                  style={styles.fabProjectMenuItem}
                  onPress={() => {
                    addTextNote();
                    setIsFabOpen(false);
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#E5E7EB"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.fabProjectMenuText}>Save text note</Text>
                </Pressable>

                <Pressable
                  style={styles.fabProjectMenuItem}
                  onPress={() => {
                    handleRecordPress();
                    // keep menu open while recording if you like, for now we close
                    setIsFabOpen(false);
                  }}
                >
                  <Ionicons
                    name="mic-outline"
                    size={18}
                    color="#0F172A"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.fabProjectMenuText}>
                    {recording ? "Stop & save voice" : "Voice note"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.fabProjectMenuItem}
                  onPress={() => {
                    addPhotoNote();
                    setIsFabOpen(false);
                  }}
                >
                  <Ionicons
                    name="camera-outline"
                    size={18}
                    color="#0F172A"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.fabProjectMenuText}>Photo note</Text>
                </Pressable>

                <Pressable
                  style={styles.fabProjectMenuItem}
                  onPress={() => {
                    addVideoNote();
                    setIsFabOpen(false);
                  }}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={18}
                    color="#0F172A"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.fabProjectMenuText}>Video note</Text>
                </Pressable>
              </BlurView>
            </Animated.View>
          )}

          <Pressable
            style={styles.fabProject}
            onPress={() => setIsFabOpen((prev) => !prev)}
          >
            <BlurView intensity={70} tint="light" style={styles.fabProjectInnerBlur}>
              <Ionicons
                name={isFabOpen ? "close" : "add"}
                size={28}
                color="#FFFFFF"
              />
            </BlurView>
          </Pressable>
        </View>
      )}

      </View>
    </SafeAreaView>
  );
}

// ------- STYLES --------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  tokenGateContainer: {
    gap: 12,
  },

  gradientBackground: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 8,
    padding: 10,
    minHeight: 40,
    marginBottom: 12,
    textAlignVertical: "top",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  buttonWrapper: {
    flex: 1,
  },
  subTitle: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 8,
  },
  projectLine: {
    fontSize: 13,
    color: "#444444",
  },
  newProjectBox: {
    borderWidth: 1,
    borderColor: "#eeeeee",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  projectInfo: {
    fontSize: 13,
    color: "#555555",
  },
  // notes
  note: {
    borderWidth: 1,
    borderColor: "#eeeeee",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    marginBottom: 4,
  },
  noteMeta: {
    fontSize: 12,
    color: "#666666",
    marginBottom: 4,
  },
  noteActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  noteButton: {
    marginRight: 8,
    marginTop: 4,
  },
  transcriptionBox: {
    marginTop: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  transcriptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  transcriptionText: {
    fontSize: 12,
    color: "#444444",
  },
  reportBox: {
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  reportScroll: {
    maxHeight: 250, // adjust if you want more/less height
    marginTop: 4,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  reportText: {
    fontSize: 13,
    color: "#333333",
  
  },
   // existing safeArea + container are fine, just keep them
  // Header
  projectsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  projectsTitle: {
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: "#0F172A",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTokenButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(191, 219, 254, 0.65)",
  },
  headerPlusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(191, 219, 254, 0.65)",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 8,
    color: "#0F172A",
  },

  // Project cards
  projectCardWrapper: {
    marginBottom: 14,
  },
  projectCard: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    backgroundColor: "rgba(248, 250, 252, 0.55)",
  },
  projectName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#0F172A",
  },
  projectMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  projectMetaText: {
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.8)",
  },
  projectStatsRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginTop: 2,
  },
  projectStatText: {
    fontSize: 13,
    color: "rgba(15, 23, 42, 0.75)",
  },

  deleteProjectButton: {
    alignSelf: "flex-start",
    marginTop: 10,
  },
  deleteProjectText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "500",
  },

  // Empty state
  empty: {
    fontStyle: "italic",
    color: "#6B7280",
  },
  emptyState: {
    alignItems: "center",
    marginTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },

  // Floating action button
  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
  },
  fabInnerBlur: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37, 99, 235, 0.85)",
    overflow: "hidden",
  },
  
  projectTabBar: {
    flexDirection: "row",
    alignSelf: "flex-start",
    marginTop: 16,
    borderRadius: 999,
    padding: 3,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
  },
  projectTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  projectTabActive: {
    backgroundColor: "rgba(37, 99, 235, 0.9)",
  },
  projectTabText: {
    fontSize: 14,
    color: "rgba(15, 23, 42, 0.8)",
    fontWeight: "500",
  },
  projectTabTextActive: {
    color: "#FFFFFF",
  },
  fabProjectContainer: {
    position: "absolute",
    right: 24,
    bottom: 32,
  },

  // The round main button
  fabProject: {
    alignItems: "center",
    justifyContent: "center",
  },
  fabProjectInnerBlur: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    // bright blue liquid orb
    backgroundColor: "rgba(59, 130, 246, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },

  // The menu container above the FAB
  fabProjectMenu: {
    marginBottom: 12,
    alignItems: "flex-end",
  },

  fabProjectMenuBlur: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 180,
    backgroundColor: "rgba(15, 23, 42, 0.9)", // dark glass
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.45)",
  },

  fabProjectMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },

  fabProjectMenuText: {
    fontSize: 14,
    color: "#E5E7EB",
    fontWeight: "500",
  },
    primaryButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "rgba(59, 130, 246, 0.95)",
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
    backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  backButtonText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "500",
  },
  
  // Token Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  modalButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.7,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalError: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  secondaryModalButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  secondaryModalButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
  },

});
