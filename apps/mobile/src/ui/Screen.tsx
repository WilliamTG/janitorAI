import React, { PropsWithChildren } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, ScrollView, StyleSheet, View, ViewProps } from 'react-native';

import { useAppTheme } from './theme';

export const Screen = ({ children, style, scrollable = true }: PropsWithChildren<ViewProps & { scrollable?: boolean }>) => {
  const theme = useAppTheme();

  const content = (
    <View style={[styles.content, { padding: theme.spacing.lg }, style]}>{children}</View>
  );

  return (
    <LinearGradient
      colors={
        theme.mode === 'dark'
          ? ['#0b1020', '#0f172a']
          : ['#e8eef8', '#f4f6fb']
      }
      style={styles.flex}
    >
      <SafeAreaView style={[styles.flex]}>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: theme.spacing.xl * 2 }}
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
