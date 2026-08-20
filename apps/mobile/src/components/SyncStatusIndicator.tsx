import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { nb } from '@/src/i18n/nb';
import { useSyncStatus, useMediaUploadError, useMediaBatchProgress, SyncState } from '@/src/sync/syncStatus';
import { Caption, useAppTheme } from '@/src/ui';

const LABELS: Record<SyncState, string> = {
  idle: nb.sync.idle,
  syncing: nb.sync.syncing,
  synced: nb.sync.synced,
  offline: nb.sync.offline,
  error: nb.sync.error,
  disabled: nb.sync.disabled,
};

const ICONS: Record<SyncState, keyof typeof Ionicons.glyphMap> = {
  idle: 'cloud-outline',
  syncing: 'cloud-upload-outline',
  synced: 'cloud-done-outline',
  offline: 'cloud-offline-outline',
  error: 'alert-circle-outline',
  disabled: 'cloud-offline-outline',
};

type Props = {
  onSyncNow?: () => void;
};

export default function SyncStatusIndicator({ onSyncNow }: Props) {
  const theme = useAppTheme();
  const status = useSyncStatus();
  const mediaError = useMediaUploadError();
  const batchProgress = useMediaBatchProgress();

  // When media uploads are failing, override the color and icon even if the
  // project push itself succeeded — the inspector's files aren't fully safe.
  const hasMediaError = mediaError !== null;

  const color =
    status === 'error' || hasMediaError
      ? theme.colors.danger
      : status === 'synced'
      ? theme.colors.accentStrong
      : theme.colors.foreground;

  const icon: keyof typeof Ionicons.glyphMap =
    hasMediaError && status !== 'error' ? 'alert-circle-outline' : ICONS[status];

  // Pilotfunn (aug 2026): uten teller vet ikke takstpersonen om opplastingen
  // jobber eller henger — vis «Laster opp X av Y» mens batchen pågår.
  const label = batchProgress
    ? `Laster opp ${batchProgress.done} av ${batchProgress.total} …`
    : hasMediaError && status === 'synced'
      ? nb.sync.mediaNotSynced
      : LABELS[status];

  return (
    <Pressable
      onPress={onSyncNow}
      disabled={!onSyncNow || status === 'syncing'}
      accessibilityLabel={nb.sync.syncNow}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        backgroundColor: theme.colors.surfaceSecondary,
        borderRadius: theme.radii.pill,
      }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Caption style={{ color }}>{label}</Caption>
      {onSyncNow && status !== 'syncing' && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="refresh-outline" size={13} color={theme.colors.foreground} />
        </View>
      )}
    </Pressable>
  );
}
