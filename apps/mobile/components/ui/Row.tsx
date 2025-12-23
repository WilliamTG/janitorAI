import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Spacing } from '@/constants/theme';

export interface RowProps {
  children: React.ReactNode;
  gap?: keyof typeof Spacing;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  style?: StyleProp<ViewStyle>;
}

/**
 * Row - Horizontal flex layout helper with gap support
 * Simplifies horizontal layouts with consistent spacing
 */
export function Row({ 
  children, 
  gap = 'base', 
  align = 'center',
  justify = 'flex-start',
  style 
}: RowProps) {
  return (
    <View 
      style={[
        {
          flexDirection: 'row',
          gap: Spacing[gap],
          alignItems: align,
          justifyContent: justify,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
