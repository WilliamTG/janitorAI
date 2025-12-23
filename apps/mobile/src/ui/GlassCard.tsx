import React, { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useAppTheme } from './theme';

export const GlassCard = ({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) => {
  const theme = useAppTheme();

  return (
    <BlurView intensity={theme.blurIntensity} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={{ borderRadius: theme.radii.lg }}>
      <View
        style={[
          {
            padding: theme.spacing.md,
            backgroundColor: theme.colors.glassOverlay,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadow,
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 14 },
            shadowRadius: 18,
            elevation: 2,
          },
          style,
        ]}
      >
        {children}
      </View>
    </BlurView>
  );
};
