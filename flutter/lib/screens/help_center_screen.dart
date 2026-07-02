import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/palette.dart';

/// Mirrors `src/pages/HelpCenter.tsx` — FAQ + contact options.
class HelpCenterScreen extends StatefulWidget {
  const HelpCenterScreen({super.key});
  @override
  State<HelpCenterScreen> createState() => _HelpCenterScreenState();
}

class _HelpCenterScreenState extends State<HelpCenterScreen> {
  final _query = TextEditingController();

  static const _faqs = <(String, String)>[
    ('How do I place an order?', 'Add items to your cart, tap Checkout, choose an address and a payment method and confirm.'),
    ('When will my order ship?', 'Suppliers typically dispatch within 24-72 hours. You’ll get updates in Orders and via push notifications.'),
    ('Can I return an item?', 'Yes — most items can be returned within 7 days of delivery if they’re unused and in original packaging.'),
    ('How do I become a seller?', 'Go to Profile → Sell on PUBSTORE and complete the supplier onboarding form.'),
    ('How does the wallet work?', 'Load funds via mobile money, card or bank transfer and use them to pay for anything on PUBSTORE.'),
    ('Is my payment info safe?', 'Payment credentials are tokenised by our providers — PUBSTORE never stores raw card data.'),
  ];

  static const _contact = <(IconData, String, String)>[
    (LucideIcons.mail, 'Email support', 'help@pubstore.app'),
    (LucideIcons.phone, 'Call us', '+263 77 000 0000'),
    (LucideIcons.messageCircle, 'WhatsApp', '+263 77 000 0000'),
  ];

  @override
  Widget build(BuildContext context) {
    final q = _query.text.trim().toLowerCase();
    final filtered = q.isEmpty
        ? _faqs
        : _faqs.where((f) => f.$1.toLowerCase().contains(q) || f.$2.toLowerCase().contains(q)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Help center')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        TextField(
          controller: _query,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(
            prefixIcon: Icon(LucideIcons.search),
            hintText: 'Search help articles',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 20),
        const Text('Frequently asked', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.muted)),
        const SizedBox(height: 8),
        ...filtered.map((f) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
              child: ExpansionTile(
                title: Text(f.$1, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                children: [Align(alignment: Alignment.centerLeft, child: Text(f.$2, style: const TextStyle(color: AppColors.muted)))],
              ),
            )),
        const SizedBox(height: 24),
        const Text('Talk to us', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.muted)),
        const SizedBox(height: 8),
        ..._contact.map((c) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
              child: ListTile(
                leading: Icon(c.$1),
                title: Text(c.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(c.$3),
                trailing: const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.muted),
              ),
            )),
      ]),
    );
  }
}
