import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaUploadError } from '@/src/sync/syncStatus';
import { Caption, useAppTheme } from '@/src/ui';

/**
 * Non-blocking inline banner that appears after repeated media upload failures.
 * Dismissible per-session; the underlying failure state persists until uploads
 * succeed so the sync status indicator continues to reflect the error.
 */
export default function MediaUploadErrorBanner() {
  const theme = useAppTheme();
  const mediaError = useMediaUploadError();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state whenever the error clears (uploads recovered)
  React.useEffect(() => {
    if (!mediaError) setDismissed(false);
  }, [mediaError]);

  if (!mediaError || dismissed) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.danger + '22',
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.danger + '55',
        marginBottom: theme.spacing.sm,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={theme.colors.danger} />
      <Caption style={{ flex: 1, color: theme.colors.danger }}>
        Photos and videos couldn't sync to the server. Your data is saved on this device. We'll
        keep retrying in the background.
      </Caption>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityLabel="Dismiss media upload error"
        hitSlop={8}
      >
        <Ionicons name="close-outline" size={18} color={theme.colors.danger} />
      </Pressable>
    </View>
  );
}
