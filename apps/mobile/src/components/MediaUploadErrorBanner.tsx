import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useMediaUploadError, useOversizedFileError } from '@/src/sync/syncStatus';
import { Caption, useAppTheme } from '@/src/ui';

// Amber palette for the "file too large" banner — distinct from the red danger
// colour used for the generic connectivity-failure banner.
const AMBER_BG = '#F59E0B22';
const AMBER_BORDER = '#F59E0B88';
const AMBER_TEXT = '#92400E';

/**
 * Renders up to two inline banners:
 *
 * 1. Amber — "file too large": shown immediately when any upload is rejected
 *    with FILE_TOO_LARGE. Dismissible per-session. Does NOT wait for the
 *    three-failure threshold.
 *
 * 2. Red — generic connectivity failure: shown after repeated upload failures
 *    unrelated to file size (network errors, server errors, etc.).
 *
 * Both are dismissible per-session; the underlying state persists so the sync
 * status indicator continues to reflect the error condition.
 */
export default function MediaUploadErrorBanner() {
  const theme = useAppTheme();
  const mediaError = useMediaUploadError();
  const oversizedError = useOversizedFileError();

  const [genericDismissed, setGenericDismissed] = useState(false);
  const [oversizedDismissed, setOversizedDismissed] = useState(false);

  // Reset dismissed states whenever the underlying error clears.
  React.useEffect(() => {
    if (!mediaError) setGenericDismissed(false);
  }, [mediaError]);

  React.useEffect(() => {
    if (!oversizedError) setOversizedDismissed(false);
  }, [oversizedError]);

  const showOversized = oversizedError && !oversizedDismissed;
  const showGeneric = mediaError && !genericDismissed;

  if (!showOversized && !showGeneric) return null;

  return (
    <>
      {showOversized && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: AMBER_BG,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: AMBER_BORDER,
            marginBottom: theme.spacing.sm,
          }}
        >
          <Ionicons name="alert-circle-outline" size={18} color={AMBER_TEXT} />
          <Caption style={{ flex: 1, color: AMBER_TEXT }}>
            One or more files are too large to upload (max 50 MB). Please trim your videos or
            export at a lower resolution.
          </Caption>
          <Pressable
            onPress={() => setOversizedDismissed(true)}
            accessibilityLabel="Dismiss file size error"
            hitSlop={8}
          >
            <Ionicons name="close-outline" size={18} color={AMBER_TEXT} />
          </Pressable>
        </View>
      )}

      {showGeneric && (
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
            onPress={() => setGenericDismissed(true)}
            accessibilityLabel="Dismiss media upload error"
            hitSlop={8}
          >
            <Ionicons name="close-outline" size={18} color={theme.colors.danger} />
          </Pressable>
        </View>
      )}
    </>
  );
}
