import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/config/theme';

export function ScreenLoader({ label }: { label?: string }) {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.empty}>{title}</Text>
      {hint ? <Text style={styles.label}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { fontFamily: theme.fonts.display, fontWeight: '700', fontSize: 18, color: theme.colors.foreground },
  label: { marginTop: 6, color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 13, textAlign: 'center' },
});
