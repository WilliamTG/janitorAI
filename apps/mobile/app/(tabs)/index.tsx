import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  clearTesterToken,
  loadTesterToken,
  setTesterToken,
  validateTesterToken,
} from '@/src/lib/apiFetch';
import { Project } from '@/src/features/projects/types';
import { loadProfile } from '@/src/storage/profileStorage';
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
import MediaUploadErrorBanner from '@/src/components/MediaUploadErrorBanner';
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

// ── Status helpers ────────────────────────────────────────────────────────────

type ProjectStatus = 'draft' | 'processing' | 'ready' | 'failed';

function getProjectStatus(project: Project): ProjectStatus {
  if (project.reportStatus === 'processing') return 'processing';
  if (project.reportUrl || project.reportStatus === 'ready') return 'ready';
  if (project.reportStatus === 'failed') return 'failed';
  return 'draft';
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: 'Draft',
  processing: 'Processing AI…',
  ready: 'Ready',
  failed: 'Failed',
};

const STATUS_ICON: Record<Exclude<ProjectStatus, 'processing'>, keyof typeof Ionicons.glyphMap> = {
  draft: 'ellipse-outline',
  ready: 'checkmark-circle',
  failed: 'warning',
};

const STATUS_COLOR: Record<ProjectStatus, string> = {
  draft: '#94a3b8',
  processing: '#60a5fa',
  ready: '#22c55e',
  failed: '#ef4444',
};

// ── Filter helpers ────────────────────────────────────────────────────────────

type FilterStatus = 'all' | ProjectStatus;

const FILTER_CHIPS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function Index() {
  const theme = useAppTheme();
  const router = useRouter();

  // Projects
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter & search (ephemeral — resets on navigation)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Token
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  // Creation wizard: 0 = closed, 1/2/3 = active step
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [wizardName, setWizardName] = useState('');
  const [wizardDate, setWizardDate] = useState(() => localDateString(new Date()));
  const [wizardInspector, setWizardInspector] = useState('');
  const [wizardDescription, setWizardDescription] = useState('');
  const [wizardMediaFiles, setWizardMediaFiles] = useState<{ name: string; size: number; type: string }[]>([]);
  const fileInputRef = useRef<any>(null);

  // ── Token management ────────────────────────────────────────────────────────

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
        setTokenStatus('invalid');
        return;
      }
      const isValid = await validateTesterToken(storedToken);
      if (isValid) {
        setTokenInput(storedToken);
        setTokenStatus('valid');
        setTokenError(null);
      } else {
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

  // ── Project loading & sync ──────────────────────────────────────────────────

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

  // ── Project CRUD ────────────────────────────────────────────────────────────

  const resetWizard = () => {
    setWizardStep(0);
    setWizardName('');
    setWizardDate(localDateString(new Date()));
    setWizardInspector('');
    setWizardDescription('');
    setWizardMediaFiles([]);
  };

  const createProject = async () => {
    const name = wizardName.trim();
    const date = wizardDate.trim();
    const inspector = wizardInspector.trim();
    const description = wizardDescription.trim();

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
      ...(description ? { projectDescriptionText: description } : {}),
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
    resetWizard();
  };

  const deleteProject = async (id: string) => {
    Alert.alert(
      'Delete project',
      'This will permanently delete this project and all its notes. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const newProjects = await deleteProjectFromStorage(id);
            setProjects(newProjects);
            deleteProjectRemote(id).catch(() => {});
          },
        },
      ]
    );
  };

  // ── Render: token modal ─────────────────────────────────────────────────────

  const renderTokenModal = () => (
    <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => setShowTokenModal(true)}>
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
      }}>
        <GlassCard style={{ width: '100%', gap: theme.spacing.sm }}>
          <Title>Enter tester token</Title>
          <Body muted>Access is restricted. Enter your tester token to continue.</Body>
          {tokenError && <Caption style={{ color: theme.colors.danger }}>{tokenError}</Caption>}
          <TextField
            value={tokenInput}
            onChangeText={(value) => { setTokenInput(value); setTokenError(null); }}
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

  // ── Render: 3-step creation wizard ─────────────────────────────────────────

  const renderWizardModal = () => (
    <Modal
      visible={wizardStep > 0}
      transparent
      animationType="slide"
      onRequestClose={resetWizard}
    >
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: theme.radii.lg,
          borderTopRightRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xl * 2,
          gap: theme.spacing.md,
        }}>
          {/* Step label + close */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Caption muted style={{ fontWeight: '600' }}>Step {wizardStep} of 3</Caption>
            <IconButton onPress={resetWizard}>
              <Ionicons name="close" size={20} color={theme.colors.muted} />
            </IconButton>
          </View>

          {/* Dot progress bar */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignSelf: 'center' }}>
            {([1, 2, 3] as const).map((s) => (
              <View
                key={s}
                style={{
                  height: 8,
                  width: s === wizardStep ? 32 : 8,
                  borderRadius: 4,
                  backgroundColor: s <= wizardStep ? theme.colors.accent : theme.colors.border,
                }}
              />
            ))}
          </View>

          {/* Step 1 — Details */}
          {wizardStep === 1 && (
            <>
              <Title style={{ fontSize: 20 }}>Inspection details</Title>
              <TextField
                label="Project name *"
                value={wizardName}
                onChangeText={setWizardName}
                placeholder="e.g. Main lobby walkthrough"
                autoFocus
              />
              <DateField label="Inspection date" value={wizardDate} onChange={setWizardDate} />
              <TextField
                label="Inspector name"
                value={wizardInspector}
                onChangeText={setWizardInspector}
                placeholder="Your name"
              />
              <PrimaryButton
                onPress={() => {
                  if (!wizardName.trim()) {
                    Alert.alert('Missing name', 'Please enter a project name to continue.');
                    return;
                  }
                  setWizardStep(2);
                }}
              >
                Next →
              </PrimaryButton>
            </>
          )}

          {/* Step 2 — Media Upload */}
          {wizardStep === 2 && (
            <>
              <Title style={{ fontSize: 20 }}>Add media</Title>
              <Caption muted>
                Select photos and videos for this inspection. You can also add more after the project is created.
              </Caption>

              {/* Drop zone — triggers the hidden file input */}
              <Pressable
                onPress={() => fileInputRef.current?.click()}
                style={{
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: wizardMediaFiles.length > 0 ? theme.colors.accent : theme.colors.border,
                  borderRadius: theme.radii.md,
                  paddingVertical: theme.spacing.xl,
                  paddingHorizontal: theme.spacing.lg,
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  backgroundColor: wizardMediaFiles.length > 0
                    ? `${theme.colors.accent}10`
                    : theme.colors.surfaceSecondary,
                }}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={40}
                  color={wizardMediaFiles.length > 0 ? theme.colors.accent : theme.colors.muted}
                />
                <Body style={{ color: wizardMediaFiles.length > 0 ? theme.colors.accent : theme.colors.muted, fontWeight: '600' }}>
                  {wizardMediaFiles.length > 0 ? 'Tap to change selection' : 'Tap to select files'}
                </Body>
                <Caption muted>Photos & videos · Optional</Caption>
              </Pressable>

              {/* Hidden file input (web only) */}
              {/* @ts-ignore */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={(e: any) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
                  setWizardMediaFiles(files.map((f) => ({ name: f.name, size: f.size, type: f.type })));
                }}
              />

              {/* Selected file list */}
              {wizardMediaFiles.length > 0 && (
                <GlassCard style={{ gap: theme.spacing.xs }}>
                  <Caption muted style={{ fontWeight: '600' }}>
                    {wizardMediaFiles.length} file{wizardMediaFiles.length !== 1 ? 's' : ''} selected
                  </Caption>
                  {wizardMediaFiles.map((f, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                      <Ionicons
                        name={f.type.startsWith('video') ? 'videocam-outline' : 'image-outline'}
                        size={15}
                        color={theme.colors.accent}
                      />
                      <Caption numberOfLines={1} style={{ flex: 1 }}>{f.name}</Caption>
                      <Caption muted>{(f.size / 1024 / 1024).toFixed(1)} MB</Caption>
                    </View>
                  ))}
                </GlassCard>
              )}

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <SecondaryButton style={{ flex: 1 }} onPress={() => setWizardStep(1)}>
                  ← Back
                </SecondaryButton>
                <PrimaryButton style={{ flex: 1 }} onPress={() => setWizardStep(3)}>
                  Next →
                </PrimaryButton>
              </View>
            </>
          )}

          {/* Step 3 — Notes & Review */}
          {wizardStep === 3 && (
            <>
              <Title style={{ fontSize: 20 }}>Notes & review</Title>

              {/* Initial notes / description */}
              <TextField
                label="Initial notes (optional)"
                multiline
                value={wizardDescription}
                onChangeText={setWizardDescription}
                placeholder="Describe the damage, location, client context, special considerations…"
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />

              {/* Review summary */}
              <GlassCard style={{ gap: theme.spacing.sm }}>
                <View style={{ gap: theme.spacing.xs }}>
                  <Caption muted>Project name</Caption>
                  <Body>{wizardName}</Body>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <Caption muted>Inspection date</Caption>
                  <Body>{wizardDate || 'Not set'}</Body>
                </View>
                <View style={{ gap: theme.spacing.xs }}>
                  <Caption muted>Inspector</Caption>
                  <Body>{wizardInspector.trim() || 'Unknown inspector'}</Body>
                </View>
                {wizardMediaFiles.length > 0 && (
                  <View style={{ gap: theme.spacing.xs }}>
                    <Caption muted>Media selected</Caption>
                    <Body>{wizardMediaFiles.length} file{wizardMediaFiles.length !== 1 ? 's' : ''}</Body>
                  </View>
                )}
              </GlassCard>

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <SecondaryButton style={{ flex: 1 }} onPress={() => setWizardStep(2)}>
                  ← Back
                </SecondaryButton>
                <PrimaryButton style={{ flex: 1 }} onPress={createProject}>
                  Create project
                </PrimaryButton>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ── Derived: filtered project list ──────────────────────────────────────────

  const filteredProjects = projects.filter((p) => {
    if (filterStatus !== 'all' && getProjectStatus(p) !== filterStatus) return false;
    if (searchQuery.trim()) {
      return p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  // ── Render: empty state ─────────────────────────────────────────────────────

  const renderEmptyState = () => (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      minHeight: 360,
    }}>
      <View style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: theme.colors.surfaceSecondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Ionicons name="clipboard-outline" size={40} color={theme.colors.accent} />
      </View>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Title style={{ textAlign: 'center' }}>No reports yet</Title>
        <Body muted style={{ textAlign: 'center', maxWidth: 280 }}>
          No inspection reports generated yet. Click below to start your first inspection!
        </Body>
      </View>
      <PrimaryButton onPress={() => setWizardStep(1)} width={240}>
        + Create first inspection
      </PrimaryButton>
    </View>
  );

  // ── Render: project card ────────────────────────────────────────────────────

  const renderProjectCard = ({ item, index }: { item: Project; index: number }) => {
    const notes = item.notes || [];
    const noteCount = notes.length;
    const audioCount = notes.filter((n) => n.audioUri).length;
    const photoCount = notes.reduce((sum, n) => sum + (n.photos?.length || 0), 0);
    const status = getProjectStatus(item);

    return (
      <Animated.View entering={FadeInDown.springify().delay(index * 50)}>
        <GlassCard style={{ marginBottom: theme.spacing.md, gap: theme.spacing.sm }}>
          {/* Name + delete */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm }}>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Title numberOfLines={1}>{item.name}</Title>
              <Caption muted>{item.inspectionDate}</Caption>
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

          {/* Status badge */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            {status === 'processing' ? (
              <ActivityIndicator size="small" color={STATUS_COLOR.processing} />
            ) : (
              <Ionicons
                name={STATUS_ICON[status as Exclude<ProjectStatus, 'processing'>]}
                size={15}
                color={STATUS_COLOR[status]}
              />
            )}
            <Caption style={{ color: STATUS_COLOR[status], fontWeight: '600' }}>
              {STATUS_LABEL[status]}
            </Caption>
            {status === 'failed' && (
              <SecondaryButton
                onPress={() =>
                  Alert.alert(
                    'Report error',
                    item.reportError || 'An error occurred during report generation.'
                  )
                }
                width={96}
              >
                View Error
              </SecondaryButton>
            )}
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <StatPill icon="document-text-outline" label={`${noteCount} notes`} />
            <StatPill icon="mic-outline" label={`${audioCount} audio`} />
            <StatPill icon="camera-outline" label={`${photoCount} photos`} />
          </View>

          {/* CTA */}
          <PrimaryButton
            width="100%"
            onPress={() => router.push(`/projects/${item.id}`)}
          >
            Open project →
          </PrimaryButton>
        </GlassCard>
      </Animated.View>
    );
  };

  // ── Render: list header ─────────────────────────────────────────────────────

  const renderListHeader = () => (
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

      <MediaUploadErrorBanner />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
        <SyncStatusIndicator onSyncNow={handleSyncNow} />
        <SecondaryButton onPress={() => setWizardStep(1)}>
          + New project
        </SecondaryButton>
      </View>

      {/* Search input */}
      <TextField
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search projects…"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {FILTER_CHIPS.map((chip) => {
          const active = filterStatus === chip.value;
          const chipColor = chip.value === 'all'
            ? theme.colors.accent
            : STATUS_COLOR[chip.value as ProjectStatus];
          return (
            <Pressable
              key={chip.value}
              onPress={() => setFilterStatus(chip.value)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radii.pill,
                borderWidth: 1.5,
                borderColor: active ? chipColor : theme.colors.border,
                backgroundColor: active ? `${chipColor}22` : theme.colors.surfaceSecondary,
              }}
            >
              <Caption
                style={{
                  color: active ? chipColor : theme.colors.muted,
                  fontWeight: active ? '700' : '400',
                }}
              >
                {chip.label}
              </Caption>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <Screen scrollable={false} style={{ flex: 1 }}>
      {renderTokenModal()}
      {renderWizardModal()}
      <FlatList
        data={isLoading ? [] : filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectCard}
        ListHeaderComponent={renderListHeader()}
        ListEmptyComponent={
          isLoading ? null : (
            projects.length === 0
              ? renderEmptyState()
              : (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: theme.spacing.xl,
                  gap: theme.spacing.md,
                  minHeight: 200,
                }}>
                  <Ionicons name="search-outline" size={40} color={theme.colors.muted} />
                  <Body muted style={{ textAlign: 'center' }}>
                    No projects match your filter.
                  </Body>
                  <SecondaryButton onPress={() => { setFilterStatus('all'); setSearchQuery(''); }}>
                    Clear filters
                  </SecondaryButton>
                </View>
              )
          )
        }
        contentContainerStyle={{ paddingBottom: theme.spacing.xl * 2, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

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
