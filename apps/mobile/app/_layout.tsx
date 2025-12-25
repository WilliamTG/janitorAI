import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppThemeProvider } from '@/src/ui';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const stackBackground = colorScheme === 'dark' ? '#0b1020' : '#e8eef8';

  useEffect(() => {
    console.log('[Navigation] Root layout mounted with stack background', stackBackground);
  }, [stackBackground]);

  return (
    <AppThemeProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade_from_bottom',
            contentStyle: { backgroundColor: stackBackground },
            headerBackTitleVisible: false,
            headerBackTitle: 'Projects',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppThemeProvider>
  );
}
