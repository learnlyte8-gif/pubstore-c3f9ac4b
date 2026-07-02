import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';
import 'become_supplier_screen.dart';
import 'store_actions_screen.dart';
import 'store_analytics_screen.dart';

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
    if (uid == null) { setState(() => _loading = false); return; }
    final sup = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
    if (sup != null) {
      final orders = await supabase
          .from('orders')
          .select('total,status')
          .eq('supplier_id', sup['id']);
      final list = (orders as List).cast<Map<String, dynamic>>();
      _orderCount = list.length;
      _revenue = list.fold(
          0, (s, o) => s + (double.tryParse('${o['total']}') ?? 0));
      _pending = list
          .where((o) => o['status'] == 'placed' || o['status'] == 'processing')
          .length;
    }
    if (!mounted) return;
    setState(() { _supplier = sup == null ? null : Map<String, dynamic>.from(sup); _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
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
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
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
          const SizedBox(height: 16),
          _tile(LucideIcons.package, 'Products',
              subtitle: 'Manage catalog & inventory'),
          _tile(LucideIcons.shoppingBag, 'Orders',
              subtitle: 'Fulfilment & shipping'),
          _tile(LucideIcons.megaphone, 'Promotions',
              subtitle: 'Coupons & campaigns'),
          _tile(LucideIcons.barChart3, 'Analytics',
              subtitle: 'Sales trends & audience'),
          _tile(LucideIcons.radio, 'Go live',
              subtitle: 'Stream to your followers now'),
          _tile(LucideIcons.messageCircle, 'Inbox',
              subtitle: 'Buyer messages'),
        ],
      ),
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

  Widget _tile(IconData icon, String label, {String? subtitle}) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            side: const BorderSide(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.md)),
        child: ListTile(
          leading: Icon(icon, color: AppColors.primary),
          title: Text(label,
              style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: subtitle == null
              ? null
              : Text(subtitle,
                  style:
                      const TextStyle(fontSize: 12, color: AppColors.muted)),
          trailing: const Icon(LucideIcons.chevronRight,
              size: 16, color: AppColors.muted),
          onTap: () => ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('$label — full flow next slice'))),
        ),
      );
}
