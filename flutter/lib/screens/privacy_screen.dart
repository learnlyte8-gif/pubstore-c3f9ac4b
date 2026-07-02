import 'package:flutter/material.dart';

import '../theme/palette.dart';

/// Mirrors `src/pages/Privacy.tsx` — static policy content.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  static const _sections = <(String, String)>[
    (
      'What we collect',
      'Account info you provide (name, email, phone, address), the products you browse and buy, wallet balances and transactions, device/session info, and location when you enable it for delivery or ride features.',
    ),
    (
      'How we use it',
      'To run the marketplace: process orders, provide rides and logistics, personalise recommendations, prevent fraud, and comply with local regulations. We never sell your data.',
    ),
    (
      'Who we share with',
      'Suppliers or couriers you transact with (only the minimum info needed to fulfil the order), payment processors, and infrastructure providers under strict contracts. Legal disclosures only when required.',
    ),
    (
      'Your controls',
      'Update or delete your profile, export your data, revoke third-party connections, disable notifications, and close your account at any time from Settings.',
    ),
    (
      'Security',
      'All data is encrypted in transit and at rest. Payment credentials are tokenised by our providers — PUBSTORE never stores raw card numbers.',
    ),
    (
      'Contact',
      'Questions? Reach us at privacy@pubstore.app or through the in-app help center.',
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
        const Text('Last updated · 2 July 2026',
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
