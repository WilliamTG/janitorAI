import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Caption } from './Typography';
import { TextField } from './TextField';
import { useAppTheme } from './theme';

// Native-only — not used on web
let DateTimePicker: any = null;
let DateTimePickerEvent: any = null;
if (Platform.OS !== 'web') {
  const pkg = require('@react-native-community/datetimepicker');
  DateTimePicker = pkg.default;
}

export type DateFieldProps = {
  value?: string;
  onChange: (dateString: string) => void;
  label?: string;
};

/** Returns today's date as a local YYYY-MM-DD string (timezone-safe). */
export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DateField = ({ value, onChange, label }: DateFieldProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const theme = useAppTheme();

  // Always have a valid date to display and fall back to
  const effectiveValue = value || localDateString(new Date());

  // ─── Web: native <input type="date"> ──────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: theme.spacing.xs, width: '100%', minWidth: 0 }}>
        {label && <Caption style={{ color: theme.colors.muted }}>{label}</Caption>}
        <View style={{ width: '100%', minWidth: 0 }}>
          {/* @ts-ignore — <input> is valid JSX in React Native Web */}
          <input
            type="date"
            value={effectiveValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            style={{
              width: '100%',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface,
              color: theme.colors.foreground,
              padding: theme.spacing.sm,
              fontSize: 16,
              boxSizing: 'border-box',
              // Use the system-ui font stack to match the rest of the app
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              cursor: 'pointer',
              outline: 'none',
              // Force the calendar popup to match the app's color scheme so it's
              // always readable regardless of the OS-level dark/light preference
              colorScheme: theme.mode === 'dark' ? 'dark' : 'light',
              accentColor: theme.colors.accent,
            } as React.CSSProperties}
          />
        </View>
      </View>
    );
  }

  // ─── Native: DateTimePicker (iOS / Android) ───────────────────────────────
  const handleChange = (_event: any, selected?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }
    if (selected) {
      onChange(selected.toISOString().split('T')[0]);
    }
  };

  return (
    <View>
      <TextField
        label={label}
        value={effectiveValue}
        placeholder="Select a date"
        editable={false}
        rightIcon={<Ionicons name="calendar-outline" size={18} color={theme.colors.muted} />}
        onPressIn={() => setShowPicker(true)}
      />
      {showPicker && (
        <DateTimePicker
          value={new Date(effectiveValue)}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}
    </View>
  );
};
