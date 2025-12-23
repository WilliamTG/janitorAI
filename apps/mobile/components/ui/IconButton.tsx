import React from 'react';
import { Pressable, ViewStyle, StyleProp, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Shadows, BlurIntensity, SpringConfig } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'glass';
  style?: StyleProp<ViewStyle>;
}

/**
 * IconButton - Circular icon button with glass effect and press animation
 * Compact action button for toolbars and FABs
 */
export function IconButton({ 
  icon, 
  onPress, 
  disabled = false,
  size = 'md',
  variant = 'glass',
  style 
}: IconButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const shadows = Shadows[colorScheme ?? 'light'];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, SpringConfig.default) }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = 0.95;
      Haptics.selectionAsync();
    }
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  const handlePress = () => {
    if (!disabled) {
      onPress();
    }
  };

  const sizeStyles = {
    sm: { width: 32, height: 32, iconSize: 16 },
    md: { width: 44, height: 44, iconSize: 22 },
    lg: { width: 56, height: 56, iconSize: 28 },
  };

  const variantStyles = {
    primary: {
      backgroundColor: colors.primary,
      iconColor: '#FFFFFF',
    },
    secondary: {
      backgroundColor: colors.surfaceSecondary,
      iconColor: colors.text,
    },
    glass: {
      backgroundColor: colors.glassBackground,
      iconColor: colors.primary,
    },
  };

  const buttonSize = sizeStyles[size];
  const variantStyle = variantStyles[variant];

  if (variant === 'glass') {
    return (
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        style={[
          {
            width: buttonSize.width,
            height: buttonSize.height,
            borderRadius: buttonSize.width / 2,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.glassBorder,
          },
          shadows.sm,
          animatedStyle,
          style,
        ]}
      >
        <BlurView
          intensity={BlurIntensity.light}
          tint={colorScheme ?? 'light'}
          style={{
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: variantStyle.backgroundColor,
          }}
        >
          <Ionicons 
            name={icon} 
            size={buttonSize.iconSize} 
            color={disabled ? colors.textDisabled : variantStyle.iconColor} 
          />
        </BlurView>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      style={[
        {
          width: buttonSize.width,
          height: buttonSize.height,
          borderRadius: buttonSize.width / 2,
          backgroundColor: disabled ? colors.textDisabled : variantStyle.backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        shadows.sm,
        animatedStyle,
        style,
      ]}
    >
      <Ionicons 
        name={icon} 
        size={buttonSize.iconSize} 
        color={disabled ? colors.textDisabled : variantStyle.iconColor} 
      />
    </AnimatedPressable>
  );
}
