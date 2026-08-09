import React from 'react';
import { Pressable, View } from 'react-native';

import { nb } from '@/src/i18n/nb';

import { Caption } from './Typography';
import { useAppTheme } from './theme';

export type ProjectStatus = 'draft' | 'processing' | 'ready' | 'failed';

// Fargepar valgt for minst 4,5:1-kontrast (WCAG AA) mot chip-bakgrunnen
// i begge temaer — B20. Ikke gjenbruk theme.colors her; de er for flater, ikke tekst.
const COLORS: Record<'light' | 'dark', Record<ProjectStatus, { bg: string; fg: string; border: string }>> = {
  light: {
    draft: { bg: '#E4E9F1', fg: '#3D4C63', border: '#C3CDDC' },
    processing: { bg: '#E4EDF5', fg: '#2E4763', border: '#A8BFD4' },
    ready: { bg: '#DCFCE7', fg: '#14532D', border: '#86EFAC' },
    failed: { bg: '#FEE2E2', fg: '#7F1D1D', border: '#FCA5A5' },
  },
  dark: {
    draft: { bg: '#263143', fg: '#C7D2E2', border: '#3A4A63' },
    processing: { bg: '#1B2A3A', fg: '#A9C9EF', border: '#3D5A80' },
    ready: { bg: '#103524', fg: '#86EFAC', border: '#166534' },
    failed: { bg: '#3B1513', fg: '#FCA5A5', border: '#7F1D1D' },
  },
};

type Props = {
  status: ProjectStatus;
  // B20: «Feilet» skal alltid tilby en handling, ikke bare en feilmelding.
  onRetry?: () => void;
};

export const StatusChip = ({ status, onRetry }: Props) => {
  const theme = useAppTheme();
  const mode = theme.mode === 'dark' ? 'dark' : 'light';
  const colors = COLORS[mode][status];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        accessibilityLabel={`Status: ${nb.status[status]}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.fg }} />
        <Caption style={{ color: colors.fg, fontWeight: '600' }}>{nb.status[status]}</Caption>
      </View>
      {status === 'failed' && onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={nb.common.retry}
          hitSlop={8}
          style={{
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: theme.radii.pill,
            borderWidth: 1,
            borderColor: theme.colors.accent,
          }}
        >
          <Caption style={{ color: theme.colors.accent, fontWeight: '600' }}>{nb.common.retry}</Caption>
        </Pressable>
      )}
    </View>
  );
};
