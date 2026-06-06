import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

export function PrivacyScreen() {
  return (
    <ScreenContainer title="Privacy">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={styles.h2}>What we collect</Text>
        <Text style={styles.p}>We store your account email, profile data, orders, messages, and any data you submit to use the app.</Text>
        <Text style={styles.h2}>How we use it</Text>
        <Text style={styles.p}>To run your account, deliver orders, personalize recommendations, and prevent fraud.</Text>
        <Text style={styles.h2}>Who we share it with</Text>
        <Text style={styles.p}>Suppliers you transact with, payment processors, and cloud infrastructure providers — never advertisers.</Text>
        <Text style={styles.h2}>Your rights</Text>
        <Text style={styles.p}>You can export or delete your account anytime by contacting support.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  h2: { fontFamily: theme.fonts.display, fontWeight: '700', color: theme.colors.foreground, fontSize: 16, marginTop: 8 },
  p: { color: theme.colors.foreground, fontFamily: theme.fonts.body, lineHeight: 20 },
});
