import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { clearLostMedia, useLostMediaNotice, useMediaUploadError, useOversizedFileError } from '@/src/sync/syncStatus';
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

  const lostMedia = useLostMediaNotice();

  const showOversized = oversizedError && !oversizedDismissed;
  const showGeneric = mediaError && !genericDismissed;
  const showLost = lostMedia !== null;

  if (!showOversized && !showGeneric && !showLost) return null;

  return (
    <>
      {showLost && lostMedia && (
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
          <Ionicons name="image-outline" size={18} color={AMBER_TEXT} />
          <Caption style={{ flex: 1, color: AMBER_TEXT }}>
            {lostMedia.count === 1
              ? 'Ett bilde gikk tapt fordi appen ble lukket før opplastingen var ferdig. Legg det til på nytt fra kamerarullen.'
              : `${lostMedia.count} bilder gikk tapt fordi appen ble lukket før opplastingen var ferdig. Legg dem til på nytt fra kamerarullen.`}
          </Caption>
          <Pressable
            onPress={() => clearLostMedia()}
            accessibilityLabel="Lukk varsel om tapte bilder"
            hitSlop={8}
          >
            <Ionicons name="close-outline" size={18} color={AMBER_TEXT} />
          </Pressable>
        </View>
      )}
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
            Én eller flere filer er for store til å lastes opp (bilder maks 50 MB, videoer maks
            500 MB). Kort ned videoene eller eksporter i lavere oppløsning.
          </Caption>
          <Pressable
            onPress={() => setOversizedDismissed(true)}
            accessibilityLabel="Lukk varsel om filstørrelse"
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
            Bilder og videoer ble ikke synkronisert til serveren. Dataene er lagret på denne
            enheten. Vi prøver igjen automatisk i bakgrunnen.
          </Caption>
          <Pressable
            onPress={() => setGenericDismissed(true)}
            accessibilityLabel="Lukk varsel om medieopplasting"
            hitSlop={8}
          >
            <Ionicons name="close-outline" size={18} color={theme.colors.danger} />
          </Pressable>
        </View>
      )}
    </>
  );
}
