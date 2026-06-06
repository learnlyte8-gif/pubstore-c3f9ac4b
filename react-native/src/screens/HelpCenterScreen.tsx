import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

const FAQS = [
  { q: 'How do I place an order?', a: 'Add items to cart and tap Checkout. You can pay with wallet or any saved method.' },
  { q: 'How do refunds work?', a: 'Open the order, tap Request refund, and chat with the seller. Wallet refunds are instant.' },
  { q: 'How do I become a seller?', a: 'Go to Profile → My store and complete the supplier onboarding flow.' },
  { q: 'Is my data safe?', a: 'All traffic is encrypted and sensitive data is stored in our secure cloud.' },
];

export function HelpCenterScreen() {
  return (
    <ScreenContainer title="Help center">
      <View style={{ padding: 16, gap: 12 }}>
        {FAQS.map((f, i) => (
          <View key={i} style={styles.row}>
            <Ionicons name="help-circle" size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.q}>{f.q}</Text>
              <Text style={styles.a}>{f.a}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.contact} onPress={() => Linking.openURL('mailto:support@pubstore.app')}>
          <Ionicons name="mail-outline" size={18} color={theme.colors.background} />
          <Text style={styles.contactText}>Contact support</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: theme.colors.mutedSurface, borderRadius: 14 },
  q: { fontFamily: theme.fonts.body, fontWeight: '700', color: theme.colors.foreground },
  a: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 4, lineHeight: 18 },
  contact: { marginTop: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: theme.colors.foreground, padding: 14, borderRadius: 12 },
  contactText: { color: theme.colors.background, fontFamily: theme.fonts.body, fontWeight: '700' },
});
