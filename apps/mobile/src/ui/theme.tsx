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
    /**
     * Kobber — identitetens signaturdetalj (jf. presentation/fargealternativer,
     * valgt retning C «Skifer og kobber»). Brukes KUN på godkjenningsstempel og
     * nøkkeltall — aldri på knapper eller flater.
     */
    copper: string;
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

// Fargeidentiteten deles med salgs-, demo- og delingssidene: «Skifer og
// kobber» (retning C fra presentation/fargealternativer.html) — petrolblå-
// grønn aksent (#23545C-familien), kjølig-nøytral skiferbakgrunn og kobber
// (#A65E2E) som signaturdetalj på stempel og nøkkeltall. Bevisst valgt bort:
// knallblå/neonrød «template-farger» og tung glass/blur — takstbransjen skal
// kjenne igjen et fagverktøy, ikke en demo.
const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: '#F1F3F3',
    surface: 'rgba(255,255,255,0.96)',
    surfaceSecondary: 'rgba(255,255,255,0.85)',
    foreground: '#1B262B',
    muted: '#566670',
    border: 'rgba(27, 38, 43, 0.16)',
    accent: '#23545C',
    accentStrong: '#1A4148',
    danger: '#A6453A',
    copper: '#A65E2E',
    shadow: 'rgba(27, 38, 43, 0.10)',
    glassOverlay: 'rgba(255,255,255,0.5)',
    overlay: 'rgba(27, 38, 43, 0.30)',
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
    background: '#11181B',
    surface: 'rgba(26, 35, 39, 0.97)',
    surfaceSecondary: 'rgba(26, 35, 39, 0.88)',
    foreground: '#E4EAEC',
    muted: '#9AA8AE',
    border: 'rgba(154, 168, 174, 0.28)',
    accent: '#8FC2CB',
    accentStrong: '#B3D8DE',
    danger: '#D3766B',
    copper: '#C98B5A',
    shadow: 'rgba(0, 0, 0, 0.35)',
    glassOverlay: 'rgba(17, 24, 27, 0.5)',
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
