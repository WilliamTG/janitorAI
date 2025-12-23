import React from 'react';
import { View, ViewStyle, StyleProp, useColorScheme } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

export interface DividerProps {
  marginVertical?: keyof typeof Spacing;
  style?: StyleProp<ViewStyle>;
}

/**
 * Divider - Styled horizontal divider
 * Provides visual separation between content sections
 */
export function Divider({ marginVertical = 'base', style }: DividerProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: colors.border,
          marginVertical: Spacing[marginVertical],
        },
        style,
      ]}
    />
  );
}
