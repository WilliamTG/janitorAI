import React from 'react';
import { Pressable, TextStyle, ViewStyle, StyleProp, useColorScheme, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors, BorderRadius, Spacing, SpringConfig } from '@/constants/theme';
import { Body } from './Typography';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SecondaryButtonProps {
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
 * SecondaryButton - Outlined button with press animation and haptic feedback
 * Secondary action button with liquid glass aesthetic
 */
export function SecondaryButton({ 
  title, 
  onPress, 
  disabled = false,
  loading = false,
  fullWidth = false,
  size = 'md',
  style,
  textStyle 
}: SecondaryButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: disabled ? colors.textDisabled : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          ...sizeStyles[size],
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Body 
          color={disabled ? colors.textDisabled : colors.text}
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
