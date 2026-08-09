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

// Fargeidentiteten deles med salgs-, demo- og delingssidene: dempet stålblå
// aksent (#3D5A80-familien), varm papirhvit bakgrunn og nesten ugjennomsiktige
// flater. Bevisst valgt bort: knallblå/neonrød «template-farger» og tung
// glass/blur — takstbransjen skal kjenne igjen et fagverktøy, ikke en demo.
const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: '#F4F3EF',
    surface: 'rgba(255,255,255,0.96)',
    surfaceSecondary: 'rgba(255,255,255,0.85)',
    foreground: '#1D2730',
    muted: '#55636E',
    border: 'rgba(29, 39, 48, 0.16)',
    accent: '#3D5A80',
    accentStrong: '#2E4763',
    danger: '#A6453A',
    shadow: 'rgba(29, 39, 48, 0.10)',
    glassOverlay: 'rgba(255,255,255,0.5)',
    overlay: 'rgba(29, 39, 48, 0.30)',
  },
  spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  radii: { sm: 6, md: 10, lg: 16, pill: 999 },
  typography: {
    title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.2 },
    body: { fontSize: 16, fontWeight: '400', letterSpacing: -0.1 },
    caption: { fontSize: 13, fontWeight: '400', letterSpacing: 0 },
  },
  blurIntensity: 12,
};

const darkTheme: AppTheme = {
  mode: 'dark',
  colors: {
    background: '#12181D',
    surface: 'rgba(26, 34, 42, 0.97)',
    surfaceSecondary: 'rgba(26, 34, 42, 0.88)',
    foreground: '#E6EAEE',
    muted: '#9DA9B3',
    border: 'rgba(157, 169, 179, 0.28)',
    accent: '#94B9DE',
    accentStrong: '#B7D2EC',
    danger: '#D3766B',
    shadow: 'rgba(0, 0, 0, 0.35)',
    glassOverlay: 'rgba(18, 24, 29, 0.5)',
    overlay: 'rgba(0,0,0,0.5)',
  },
  spacing: lightTheme.spacing,
  radii: lightTheme.radii,
  typography: lightTheme.typography,
  blurIntensity: 14,
};

const ThemeContext = createContext<AppTheme>(lightTheme);

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const scheme = useColorScheme();

  const theme = useMemo(() => (scheme === 'dark' ? darkTheme : lightTheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
