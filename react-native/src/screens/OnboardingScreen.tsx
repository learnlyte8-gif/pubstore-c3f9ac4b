import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { theme } from '@/config/theme';

export function OnboardingScreen() {
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.h1}>Welcome to PUBSTORE</Text>
        <Text style={styles.p}>
          Discover, share and buy from suppliers, restaurants, rides and more — all in one place.
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
        >
          <Text style={styles.primaryText}>Continue as guest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => navigation.navigate('Auth')}>
          <Text style={styles.secondaryText}>Sign in / Sign up</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background, padding: 24 },
  body: { flex: 1, justifyContent: 'center' },
  h1: { fontFamily: theme.fonts.display, fontSize: 32, fontWeight: '800', color: theme.colors.foreground },
  p: { marginTop: 12, fontFamily: theme.fonts.body, color: theme.colors.muted, fontSize: 15, lineHeight: 22 },
  actions: { gap: 12, paddingBottom: 12 },
  primary: { backgroundColor: theme.colors.foreground, padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: theme.colors.border, padding: 16, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: theme.colors.foreground, fontFamily: theme.fonts.body, fontWeight: '600' },
});
