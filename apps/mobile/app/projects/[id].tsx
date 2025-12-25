import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Note, Project, PROJECT_STORAGE_KEY } from '@/src/features/projects/types';
import { Body, Caption, GlassCard, PrimaryButton, Screen, Title, useAppTheme } from '@/src/ui';

export default function ProjectDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    const projectId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;
    const route = projectId ? `/projects/${projectId}` : '/projects/unknown';

    console.log('[Projects] Project detail params', {
      projectId,
      route,
      file: 'app/projects/[id].tsx',
    });

    if (!projectId) {
      setProject(null);
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

      setProject(found);
    } catch (error) {
      console.warn('[Projects] Failed to load project detail', error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const projectId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined;

  const renderNote = (note: Note, index: number) => (
    <GlassCard key={note.id} style={{ gap: theme.spacing.xs }}>
      <Caption muted>Note {index + 1}</Caption>
      <Body>{note.text}</Body>
      <Caption muted>{new Date(note.createdAt).toLocaleString()}</Caption>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {!!note.audioUri && <Caption muted>🎙️ Voice note saved</Caption>}
        {!!note.images?.length && <Caption muted>📷 {note.images.length} photos</Caption>}
        {!!note.videos?.length && <Caption muted>🎬 {note.videos.length} videos</Caption>}
      </View>

      {note.transcription && <Caption muted>Transcript: {note.transcription}</Caption>}
    </GlassCard>
  );

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

  const renderContent = () => {
    if (loading) {
      return <Caption muted>Loading project…</Caption>;
    }

    if (!project) {
      return (
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <Title muted>Project not found</Title>
          <Body muted>We could not locate that project. It may have been removed.</Body>
          <PrimaryButton onPress={() => router.back()}>Go back</PrimaryButton>
        </GlassCard>
      );
    }

    return (
      <View style={{ gap: theme.spacing.md }}>
        <GlassCard style={{ gap: theme.spacing.xs }}>
          <Caption muted>Inspection</Caption>
          <Title>{project.name}</Title>
          <Caption muted>Date: {project.inspectionDate}</Caption>
          <Caption muted>Inspector: {project.inspector}</Caption>
        </GlassCard>

        {!!project.notes.length && (
          <View style={{ gap: theme.spacing.sm }}>
            <Caption muted>{project.notes.length} notes</Caption>
            {project.notes.map(renderNote)}
          </View>
        )}

        {project.notes.length === 0 && (
          <Caption muted>No notes saved yet for this project.</Caption>
        )}

        {project.report && (
          <GlassCard style={{ gap: theme.spacing.xs }}>
            <Caption muted>Report</Caption>
            <Body>{project.report}</Body>
          </GlassCard>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Stack.Screen
        options={{
          title: project?.name ?? 'Project',
          headerShown: true,
        }}
      />

      <Screen style={{ flex: 1 }} scrollable>
        {renderContent()}
      </Screen>

      {debugOverlay}
    </View>
  );
}
