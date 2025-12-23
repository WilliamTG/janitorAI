import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Spacing } from '@/constants/theme';

export interface StackProps {
  children: React.ReactNode;
  gap?: keyof typeof Spacing;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  style?: StyleProp<ViewStyle>;
}

/**
 * Stack - Vertical flex layout helper with gap support
 * Simplifies vertical layouts with consistent spacing
 */
export function Stack({ 
  children, 
  gap = 'base', 
  align = 'stretch',
  justify = 'flex-start',
  style 
}: StackProps) {
  return (
    <View 
      style={[
        {
          flexDirection: 'column',
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
