import React, { PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, ViewProps } from 'react-native';

import { useAppTheme } from './theme';

// Flat, varm bakgrunn fra temaet — gradienter er valgt bort bevisst
// (fargeidentiteten deles med salgs- og delingssidene).
export const Screen = ({ children, style, scrollable = true }: PropsWithChildren<ViewProps & { scrollable?: boolean }>) => {
  const theme = useAppTheme();

  const content = (
    <View style={[styles.content, { padding: theme.spacing.lg }, style]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // B14: innhold sentreres med maks-bredde så web/nettbrett ikke strekker kortene.
  content: { flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' },
});
