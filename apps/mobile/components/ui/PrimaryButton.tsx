import React from 'react';
import { Pressable, TextStyle, ViewStyle, StyleProp, useColorScheme, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Shadows, Spacing, SpringConfig } from '@/constants/theme';
import { Body } from './Typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * PrimaryButton - Filled button with press animation and haptic feedback
 * Primary call-to-action button with liquid glass aesthetic
 */
export function PrimaryButton({ 
  title, 
  onPress, 
  disabled = false,
  loading = false,
  fullWidth = false,
  size = 'md',
  style,
  textStyle 
}: PrimaryButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const shadows = Shadows[colorScheme ?? 'light'];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, SpringConfig.default) }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = 0.97;
      Haptics.selectionAsync();
    }
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      onPress();
    }
  };

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 16, minHeight: 36 },
    md: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44 },
    lg: { paddingVertical: 16, paddingHorizontal: 32, minHeight: 52 },
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        {
          borderRadius: BorderRadius.full,
          backgroundColor: disabled ? colors.textDisabled : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          ...sizeStyles[size],
        },
        shadows.md,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Body 
          color="#FFFFFF" 
          style={[
            { 
              fontWeight: '600',
            },
            textStyle,
          ]}
        >
          {title}
        </Body>
      )}
    </AnimatedPressable>
  );
}
