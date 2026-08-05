import 'package:flutter/material.dart';

import '../theme/palette.dart';

/// Mirrors `src/pages/PrivacyPolicy.tsx` — detailed privacy policy content.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  static const _sections = <(String, String)>[
    (
      '1. Introduction',
      'PUBSTORE ("we", "us", or "our") is committed to protecting your privacy. This policy explains how we collect, use, store, share, and protect your personal information when you use the PUBSTORE platform, including our website, mobile apps, and related services. This policy is designed to be consistent with privacy laws applicable to our users, including POPIA, GDPR, and the CCPA.',
    ),
    (
      '2. What we collect',
      'Account information you provide (name, email, phone, profile photo, address), identity and verification documents, payment and wallet records, products you browse and buy, orders and messages, device and session info, location when you enable it for delivery or ride features, and activity data such as searches and suppliers you follow.',
    ),
    (
      '3. How we use it',
      'To create and secure your account, process orders and payments, connect you with suppliers, drivers, and couriers, personalise recommendations, run AI features, prevent fraud, verify identities, comply with legal and tax obligations, and communicate with you about orders, support, and policy updates.',
    ),
    (
      '4. Who we share with',
      'Suppliers or couriers you transact with (only the minimum information needed to fulfil the order), payment processors, identity verification services, cloud and infrastructure providers, fraud detection tools, and legal and regulatory authorities when required. We do not sell your personal information.',
    ),
    (
      '5. International transfers',
      'PUBSTORE is operated from South Africa. Some service providers are located in other countries. When we transfer personal data across borders, we use safeguards such as standard contractual clauses and data processing agreements to keep your information protected.',
    ),
    (
      '6. Data retention',
      'We keep your personal information for as long as needed to provide the Platform, comply with legal obligations, resolve disputes, and enforce our agreements. When no longer needed, we delete or anonymise it. Transaction and tax records may be kept for several years after account closure.',
    ),
    (
      '7. Your rights',
      'You may have rights including access, correction, deletion, objection, restriction, data portability, and withdrawal of consent. You can exercise many of these rights in Settings > Privacy or by contacting us at privacy@pubstore.app.',
    ),
    (
      '8. Security',
      'All data is encrypted in transit and at rest. Payment credentials are tokenised by our providers — PUBSTORE never stores raw card numbers. We also use access controls, monitoring, and regular security reviews. No system is completely secure, so please keep your account credentials confidential.',
    ),
    (
      '9. Cookies and tracking',
      'We use cookies and similar technologies to operate the Platform, remember preferences, analyse usage, and deliver personalised content. You can manage these in Settings > Privacy. Disabling personalised ads or activity tracking may reduce relevance but will not stop core features.',
    ),
    (
      '10. Children',
      'PUBSTORE is not intended for users under 18. We do not knowingly collect personal information from children. If you believe a child has provided us with data, please contact us at privacy@pubstore.app.',
    ),
    (
      '11. AI features',
      'Our AI features process data you provide to generate outputs. We do not use your personal messages or confidential account data to train third-party AI models. AI outputs are for convenience and should be reviewed before use.',
    ),
    (
      '12. Changes to this policy',
      'We may update this policy from time to time. We will notify you of material changes through the app, email, or a prominent notice. Continued use of the Platform after changes means you accept the revised policy.',
    ),
    (
      '13. Contact',
      'Questions? Reach us at privacy@pubstore.app, help@pubstore.app, or through the in-app help center. Please also review our Terms of Service.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy policy')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Text('Privacy policy',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, height: 1.1)),
        const SizedBox(height: 8),
        const Text('Last updated · 5 August 2026',
            style: TextStyle(color: AppColors.muted, fontSize: 12)),
        const SizedBox(height: 24),
        for (final s in _sections) ...[
          Text(s.$1, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(s.$2, style: const TextStyle(height: 1.45, color: AppColors.foreground)),
          const SizedBox(height: 20),
        ],
      ]),
    );
  }
}

