import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '@/config/theme';
import { ScreenContainer } from '@/components/ScreenContainer';

const sections = [
  {
    title: '1. Introduction',
    body: 'PUBSTORE ("we", "us", or "our") is committed to protecting your privacy. This policy explains how we collect, use, store, share, and protect your personal information when you use the PUBSTORE platform, including our website, mobile apps, and related services. This policy is designed to be consistent with privacy laws applicable to our users, including POPIA, GDPR, and the CCPA.',
  },
  {
    title: '2. What we collect',
    body: 'Account information you provide (name, email, phone, profile photo, address), identity and verification documents, payment and wallet records, products you browse and buy, orders and messages, device and session info, location when you enable it for delivery or ride features, and activity data such as searches and suppliers you follow.',
  },
  {
    title: '3. How we use it',
    body: 'To create and secure your account, process orders and payments, connect you with suppliers, drivers, and couriers, personalise recommendations, run AI features, prevent fraud, verify identities, comply with legal and tax obligations, and communicate with you about orders, support, and policy updates.',
  },
  {
    title: '4. Who we share with',
    body: 'Suppliers or couriers you transact with (only the minimum information needed to fulfil the order), payment processors, identity verification services, cloud and infrastructure providers, fraud detection tools, and legal and regulatory authorities when required. We do not sell your personal information.',
  },
  {
    title: '5. International transfers',
    body: 'PUBSTORE is operated from South Africa. Some service providers are located in other countries. When we transfer personal data across borders, we use safeguards such as standard contractual clauses and data processing agreements to keep your information protected.',
  },
  {
    title: '6. Data retention',
    body: 'We keep your personal information for as long as needed to provide the Platform, comply with legal obligations, resolve disputes, and enforce our agreements. When no longer needed, we delete or anonymise it. Transaction and tax records may be kept for several years after account closure.',
  },
  {
    title: '7. Your rights',
    body: 'You may have rights including access, correction, deletion, objection, restriction, data portability, and withdrawal of consent. You can exercise many of these rights in Settings > Privacy or by contacting us at privacy@pubstore.app.',
  },
  {
    title: '8. Security',
    body: 'All data is encrypted in transit and at rest. Payment credentials are tokenised by our providers — PUBSTORE never stores raw card numbers. We also use access controls, monitoring, and regular security reviews. No system is completely secure, so please keep your account credentials confidential.',
  },
  {
    title: '9. Cookies and tracking',
    body: 'We use cookies and similar technologies to operate the Platform, remember preferences, analyse usage, and deliver personalised content. You can manage these in Settings > Privacy. Disabling personalised ads or activity tracking may reduce relevance but will not stop core features.',
  },
  {
    title: '10. Children',
    body: 'PUBSTORE is not intended for users under 18. We do not knowingly collect personal information from children. If you believe a child has provided us with data, please contact us at privacy@pubstore.app.',
  },
  {
    title: '11. AI features',
    body: 'Our AI features process data you provide to generate outputs. We do not use your personal messages or confidential account data to train third-party AI models. AI outputs are for convenience and should be reviewed before use.',
  },
  {
    title: '12. Changes to this policy',
    body: 'We may update this policy from time to time. We will notify you of material changes through the app, email, or a prominent notice. Continued use of the Platform after changes means you accept the revised policy.',
  },
  {
    title: '13. Contact',
    body: 'Questions? Reach us at privacy@pubstore.app, help@pubstore.app, or through the in-app help center. Please also review our Terms of Service.',
  },
];

export function PrivacyScreen() {
  return (
    <ScreenContainer title="Privacy policy">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={styles.updated}>Last updated: 5 August 2026</Text>
        {sections.map((s, i) => (
          <React.Fragment key={i}>
            <Text style={styles.h2}>{s.title}</Text>
            <Text style={styles.p}>{s.body}</Text>
          </React.Fragment>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  updated: { color: theme.colors.muted, fontFamily: theme.fonts.body, fontSize: 12, marginBottom: 8 },
  h2: { fontFamily: theme.fonts.display, fontWeight: '700', color: theme.colors.foreground, fontSize: 16, marginTop: 8 },
  p: { color: theme.colors.foreground, fontFamily: theme.fonts.body, lineHeight: 20 },
});

