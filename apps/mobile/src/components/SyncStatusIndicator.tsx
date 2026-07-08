import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useSyncStatus, SyncState } from '@/src/sync/syncStatus';
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

  const color =
    status === 'synced'
      ? theme.colors.accentStrong
      : status === 'error'
      ? theme.colors.danger
      : theme.colors.foreground;

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
      <Ionicons name={ICONS[status]} size={14} color={color} />
      <Caption style={{ color }}>{LABELS[status]}</Caption>
      {onSyncNow && status !== 'syncing' && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="refresh-outline" size={13} color={theme.colors.foreground} />
        </View>
      )}
    </Pressable>
  );
}
