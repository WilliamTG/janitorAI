import React from 'react';
import { View, ViewStyle, StyleProp, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '@/constants/theme';

export interface ScreenProps {
  children: React.ReactNode;
  withGradient?: boolean;
  padding?: keyof typeof Spacing;
  style?: StyleProp<ViewStyle>;
}

/**
 * Screen - Safe area wrapper with consistent padding and optional gradient background
 * Provides a consistent base for all screen layouts
 */
export function Screen({ 
  children, 
  withGradient = false,
  padding = 'base',
  style 
}: ScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const gradientColors = colorScheme === 'dark'
    ? ['#0F172A', '#1E293B', '#0F172A']
    : ['#F7FAFF', '#F0F5FF', '#EBF0FA'];

  const content = (
    <View
      style={[
        {
          flex: 1,
          paddingHorizontal: Spacing[padding],
          paddingTop: Spacing[padding],
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (withGradient) {
    return (
      <LinearGradient
        colors={gradientColors}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {content}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {content}
      </SafeAreaView>
    </View>
  );
}
