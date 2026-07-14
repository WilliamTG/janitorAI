import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useSyncStatus, useMediaUploadError, SyncState } from '@/src/sync/syncStatus';
import { Caption, useAppTheme } from '@/src/ui';

const LABELS: Record<SyncState, string> = {
  idle: 'Cloud sync',
  syncing: 'Syncing…',
  synced: 'Saved to cloud',
  offline: 'Offline — saved on device',
  error: 'Sync error',
  disabled: 'Saved on device',
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

  const label =
    hasMediaError && status === 'synced'
      ? 'Media not synced'
      : LABELS[status];

  return (
    <Pressable
      onPress={onSyncNow}
      disabled={!onSyncNow || status === 'syncing'}
      accessibilityLabel="Sync now"
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
