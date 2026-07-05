import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';
import '../widgets/skeletons.dart';
import 'become_supplier_screen.dart';
import 'store_actions_screen.dart';
import 'store_analytics_screen.dart';
import 'store_section_screen.dart';

/// Mirrors `src/pages/MyStore.tsx` — supplier dashboard entry with stats,
/// go-live CTA, and shortcuts to product management.
class MyStoreScreen extends StatefulWidget {
  const MyStoreScreen({super.key});
  @override
  State<MyStoreScreen> createState() => _MyStoreScreenState();
}

class _MyStoreScreenState extends State<MyStoreScreen> {
  Map<String, dynamic>? _supplier;
  int _orderCount = 0;
  double _revenue = 0;
  int _pending = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { if (mounted) setState(() => _loading = false); return; }
    try {
      final sup = await supabase
          .from('suppliers')
          .select('*')
          .eq('owner_id', uid)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();
      if (sup != null) {
        final orders = await supabase
            .from('orders')
            .select('total,status')
            .eq('supplier_id', sup['id']);
        final list = (orders as List).cast<Map<String, dynamic>>();
        _orderCount = list.length;
        _revenue = list.fold<double>(
            0, (s, o) => s + (double.tryParse('${o['total']}') ?? 0));
        _pending = list
            .where((o) => o['status'] == 'placed' || o['status'] == 'processing')
            .length;
      }
      if (!mounted) return;
      setState(() { _supplier = sup == null ? null : Map<String, dynamic>.from(sup); _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load store: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(appBar: AppBar(title: const Text('My store')), body: Skeletons.screen(SkeletonPreset.dashboard));
    }
    if (_supplier == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('My store')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.store, size: 48, color: AppColors.muted),
              const SizedBox(height: 12),
              const Text("You don't have a store yet",
                  style:
                      TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 6),
              const Text(
                'Create your supplier store to start listing products and selling on PUBSTORE.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted, fontSize: 13),
              ),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () async {
                  final ok = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(builder: (_) => const BecomeSupplierScreen()),
                  );
                  if (ok == true) _load();
                },
                icon: const Icon(LucideIcons.plus, size: 14),
                label: const Text('Create my store'),
              ),
            ]),
          ),
        ),
      );
    }
    final s = _supplier!;
    return Scaffold(
      appBar: AppBar(
        title: Text(s['name']?.toString() ?? 'My store'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.barChart3),
            tooltip: 'Analytics',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreAnalyticsScreen())),
          ),
          IconButton(
            icon: const Icon(LucideIcons.layoutGrid),
            tooltip: 'Actions',
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const StoreActionsScreen())),
          ),
        ],
      ),
      body: Builder(builder: (context) {
        final tiles = <(IconData, String, String, String)>[
          (LucideIcons.package, 'Products', 'products', 'Manage catalog & inventory'),
          (LucideIcons.shoppingBag, 'Orders', 'orders', 'Fulfilment & shipping'),
          (LucideIcons.megaphone, 'Promotions', 'promote', 'Coupons & campaigns'),
          (LucideIcons.barChart3, 'Analytics', 'analytics', 'Sales trends & audience'),
          (LucideIcons.star, 'Reviews', 'reviews', 'What buyers are saying'),
          (LucideIcons.truck, 'Shipping', 'shipping', 'Templates & carriers'),
          (LucideIcons.image, 'Store profile', 'profile', 'Banner, logo, about'),
          (LucideIcons.settings, 'Settings', 'settings', 'Payouts, taxes, hours'),
          (LucideIcons.download, 'Import', 'import', 'Alibaba / Amazon / Shopify'),
        ];
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: tiles.length + 1,
          itemBuilder: (context, i) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF3B82F6), Color(0xFF0EA5E9)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Row(children: [
                    _stat('Orders', '$_orderCount'),
                    _divider(),
                    _stat('Revenue', '\$${_revenue.toStringAsFixed(0)}'),
                    _divider(),
                    _stat('Pending', '$_pending'),
                  ]),
                ),
              );
            }
            final t = tiles[i - 1];
            return _tile(t.$1, t.$2, section: t.$3, subtitle: t.$4);
          },
        );
      }),
    );
  }

  Widget _stat(String label, String value) => Expanded(
        child: Column(children: [
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900)),
          Text(label,
              style: const TextStyle(color: Colors.white70, fontSize: 11)),
        ]),
      );
  Widget _divider() => Container(
      width: 1, height: 32, color: Colors.white.withOpacity(0.3));

  Widget _tile(IconData icon, String label, {String? subtitle, String? section}) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            side: const BorderSide(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.md)),
        child: ListTile(
          leading: Icon(icon, color: AppColors.primary),
          title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: subtitle == null ? null : Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          trailing: const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.muted),
          onTap: section == null
              ? () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label — coming soon')))
              : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => StoreSectionScreen(section: section))).then((_) => _load()),
        ),
      );
}
