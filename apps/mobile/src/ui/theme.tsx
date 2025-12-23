import React, { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';

export type AppTheme = {
  mode: ColorSchemeName;
  colors: {
    background: string;
    surface: string;
    surfaceSecondary: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
    accentStrong: string;
    danger: string;
    shadow: string;
    glassOverlay: string;
    overlay: string;
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radii: { sm: number; md: number; lg: number; pill: number };
  typography: {
    title: { fontSize: number; fontWeight: '700' | '600'; letterSpacing: number };
    body: { fontSize: number; fontWeight: '400' | '500'; letterSpacing: number };
    caption: { fontSize: number; fontWeight: '400'; letterSpacing: number };
  };
  blurIntensity: number;
};

const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: '#eef2f7',
    surface: 'rgba(255,255,255,0.82)',
    surfaceSecondary: 'rgba(255,255,255,0.65)',
    foreground: '#0f172a',
    muted: '#475569',
    border: 'rgba(148, 163, 184, 0.45)',
    accent: '#2563EB',
    accentStrong: '#1d4ed8',
    danger: '#ef4444',
    shadow: 'rgba(15, 23, 42, 0.12)',
    glassOverlay: 'rgba(255,255,255,0.32)',
    overlay: 'rgba(15, 23, 42, 0.25)',
  },
  spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  radii: { sm: 8, md: 14, lg: 22, pill: 999 },
  typography: {
    title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.2 },
    body: { fontSize: 16, fontWeight: '400', letterSpacing: -0.1 },
    caption: { fontSize: 13, fontWeight: '400', letterSpacing: 0 },
  },
  blurIntensity: 40,
};

const darkTheme: AppTheme = {
  mode: 'dark',
  colors: {
    background: '#0b1220',
    surface: 'rgba(20,25,38,0.8)',
    surfaceSecondary: 'rgba(20,25,38,0.6)',
    foreground: '#e2e8f0',
    muted: '#cbd5e1',
    border: 'rgba(100, 116, 139, 0.45)',
    accent: '#60a5fa',
    accentStrong: '#93c5fd',
    danger: '#f87171',
    shadow: 'rgba(15, 23, 42, 0.35)',
    glassOverlay: 'rgba(15,23,42,0.32)',
    overlay: 'rgba(0,0,0,0.5)',
  },
  spacing: lightTheme.spacing,
  radii: lightTheme.radii,
  typography: lightTheme.typography,
  blurIntensity: 50,
};

const ThemeContext = createContext<AppTheme>(lightTheme);

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const scheme = useColorScheme();

  const theme = useMemo(() => (scheme === 'dark' ? darkTheme : lightTheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
