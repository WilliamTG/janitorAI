import React from 'react';
import { View, ViewStyle, StyleProp, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Shadows, BlurIntensity, Spacing } from '@/constants/theme';

export interface GlassCardProps {
  children: React.ReactNode;
  blurIntensity?: keyof typeof BlurIntensity;
  borderRadius?: keyof typeof BorderRadius;
  padding?: keyof typeof Spacing;
  shadow?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

/**
 * GlassCard - Translucent container with blur, soft border, and shadow
 * Creates the signature "Liquid Glass" aesthetic
 */
export function GlassCard({ 
  children, 
  blurIntensity = 'light',
  borderRadius = 'xl',
  padding = 'base',
  shadow = 'md',
  style 
}: GlassCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const shadows = Shadows[colorScheme ?? 'light'];

  return (
    <View
      style={[
        {
          borderRadius: BorderRadius[borderRadius],
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        shadows[shadow],
        style,
      ]}
    >
      <BlurView
        intensity={BlurIntensity[blurIntensity]}
        tint={colorScheme ?? 'light'}
        style={{
          padding: Spacing[padding],
          backgroundColor: colors.glassBackground,
        }}
      >
        {children}
      </BlurView>
    </View>
  );
}
