import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme/palette.dart';
import 'ads_dashboard_screen.dart';
import 'store_analytics_screen.dart';
import 'store_section_screen.dart';

/// Mirrors `src/pages/StoreActions.tsx` — shortcuts for supplier operations.
class StoreActionsScreen extends StatelessWidget {
  const StoreActionsScreen({super.key});

  static const _actions = <(IconData, String, String)>[
    (LucideIcons.plusSquare, 'Add product', 'List a new item for sale'),
    (LucideIcons.package, 'Manage inventory', 'Stock levels & variants'),
    (LucideIcons.tag, 'Create coupon', 'Discounts to boost sales'),
    (LucideIcons.megaphone, 'Run an ad', 'Boost reach in feed & search'),
    (LucideIcons.barChart3, 'Store analytics', 'Revenue & visitor trends'),
    (LucideIcons.truck, 'Fulfilment', 'Pending shipments'),
    (LucideIcons.messageCircle, 'Buyer chats', 'Answer inquiries'),
    (LucideIcons.settings, 'Store settings', 'Payouts, hours & branding'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Store actions')),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 1.1),
        itemCount: _actions.length,
        itemBuilder: (context, i) {
          final a = _actions[i];
          return InkWell(
            onTap: () {
              if (a.$2 == 'Add product') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreSectionScreen(section: 'products/new')));
              } else if (a.$2 == 'Manage inventory') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreSectionScreen(section: 'products')));
              } else if (a.$2 == 'Run an ad') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AdsDashboardScreen()));
              } else if (a.$2 == 'Store analytics') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreAnalyticsScreen()));
              } else if (a.$2 == 'Fulfilment') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreSectionScreen(section: 'orders')));
              } else if (a.$2 == 'Store settings') {
                Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreSectionScreen(section: 'settings')));
              } else {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${a.$2} — coming soon')));
              }
            },
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(12)), child: Icon(a.$1, color: AppColors.primary)),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(a.$2, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(a.$3, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
              ]),
            ),
          );
        },
      ),
    );
  }
}
