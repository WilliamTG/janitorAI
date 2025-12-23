/**
 * Liquid Glass iOS-Native Design System
 * A comprehensive theme system with colors, typography, spacing, and glass effects
 * for a premium, Apple-like aesthetic
 */

import { Platform } from 'react-native';

// ============================================================================
// COLORS
// ============================================================================

export const Colors = {
  light: {
    // Primary colors
    primary: '#2563EB', // Blue 600
    primaryLight: '#3B82F6', // Blue 500
    primaryDark: '#1D4ED8', // Blue 700
    
    // Secondary colors
    secondary: '#8B5CF6', // Violet 500
    secondaryLight: '#A78BFA', // Violet 400
    secondaryDark: '#7C3AED', // Violet 600
    
    // Background colors
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB', // Gray 50
    backgroundTertiary: '#F3F4F6', // Gray 100
    
    // Surface colors (for cards, containers)
    surface: '#FFFFFF',
    surfaceSecondary: '#F9FAFB',
    surfaceElevated: '#FFFFFF',
    
    // Text colors
    text: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    textTertiary: '#64748B', // Slate 500
    textDisabled: '#94A3B8', // Slate 400
    
    // Border colors
    border: '#E2E8F0', // Slate 200
    borderSecondary: '#CBD5E1', // Slate 300
    borderFocus: '#2563EB', // Blue 600
    
    // Status colors
    error: '#DC2626', // Red 600
    errorLight: '#EF4444', // Red 500
    success: '#16A34A', // Green 600
    successLight: '#22C55E', // Green 500
    warning: '#EA580C', // Orange 600
    warningLight: '#F97316', // Orange 500
    info: '#0284C7', // Sky 600
    
    // Glass effect colors
    glassBackground: 'rgba(255, 255, 255, 0.75)',
    glassBorder: 'rgba(148, 163, 184, 0.35)',
    glassOverlay: 'rgba(0, 0, 0, 0.05)',
    
    // Tab bar
    tint: '#2563EB',
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#2563EB',
  },
  dark: {
    // Primary colors
    primary: '#3B82F6', // Blue 500
    primaryLight: '#60A5FA', // Blue 400
    primaryDark: '#2563EB', // Blue 600
    
    // Secondary colors
    secondary: '#A78BFA', // Violet 400
    secondaryLight: '#C4B5FD', // Violet 300
    secondaryDark: '#8B5CF6', // Violet 500
    
    // Background colors
    background: '#0F172A', // Slate 900
    backgroundSecondary: '#1E293B', // Slate 800
    backgroundTertiary: '#334155', // Slate 700
    
    // Surface colors (for cards, containers)
    surface: '#1E293B', // Slate 800
    surfaceSecondary: '#334155', // Slate 700
    surfaceElevated: '#475569', // Slate 600
    
    // Text colors
    text: '#F8FAFC', // Slate 50
    textSecondary: '#CBD5E1', // Slate 300
    textTertiary: '#94A3B8', // Slate 400
    textDisabled: '#64748B', // Slate 500
    
    // Border colors
    border: '#334155', // Slate 700
    borderSecondary: '#475569', // Slate 600
    borderFocus: '#3B82F6', // Blue 500
    
    // Status colors
    error: '#EF4444', // Red 500
    errorLight: '#F87171', // Red 400
    success: '#22C55E', // Green 500
    successLight: '#4ADE80', // Green 400
    warning: '#F97316', // Orange 500
    warningLight: '#FB923C', // Orange 400
    info: '#0EA5E9', // Sky 500
    
    // Glass effect colors
    glassBackground: 'rgba(30, 41, 59, 0.75)',
    glassBorder: 'rgba(148, 163, 184, 0.25)',
    glassOverlay: 'rgba(255, 255, 255, 0.05)',
    
    // Tab bar
    tint: '#3B82F6',
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#3B82F6',
  },
};

// ============================================================================
// SPACING
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const Shadows = {
  light: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  dark: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};

// ============================================================================
// BLUR INTENSITIES
// ============================================================================

export const BlurIntensity = {
  light: 40,
  medium: 60,
  heavy: 80,
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const Typography = {
  // Display styles
  display: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  
  // Title styles
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
    letterSpacing: 0.36,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: 0.35,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600' as const,
    letterSpacing: 0.38,
  },
  
  // Headline styles
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
  },
  
  // Body styles
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400' as const,
    letterSpacing: -0.41,
  },
  bodyEmphasized: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.41,
  },
  
  // Callout styles
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400' as const,
    letterSpacing: -0.32,
  },
  
  // Subheadline styles
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
  },
  subheadlineEmphasized: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.24,
  },
  
  // Footnote styles
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: -0.08,
  },
  footnoteEmphasized: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600' as const,
    letterSpacing: -0.08,
  },
  
  // Caption styles
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400' as const,
    letterSpacing: 0.07,
  },
} as const;

// ============================================================================
// FONTS
// ============================================================================

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ============================================================================
// ANIMATION TIMINGS
// ============================================================================

export const AnimationDuration = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

export const SpringConfig = {
  default: {
    damping: 15,
    stiffness: 150,
  },
  gentle: {
    damping: 20,
    stiffness: 100,
  },
  bouncy: {
    damping: 10,
    stiffness: 200,
  },
} as const;
