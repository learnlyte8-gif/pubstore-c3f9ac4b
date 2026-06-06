import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/config/theme';

export function SplashScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.logo}>PUBSTORE</Text>
      <Text style={styles.tagline}>Shop. Share. Discover.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  logo: {
    fontSize: 28,
    letterSpacing: 4,
    fontFamily: theme.fonts.display,
    fontWeight: '800',
    color: theme.colors.foreground,
  },
  tagline: {
    marginTop: 8,
    fontFamily: theme.fonts.body,
    color: theme.colors.muted,
    fontSize: 13,
  },
});
