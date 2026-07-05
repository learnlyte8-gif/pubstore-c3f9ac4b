import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/StoreAnalytics.tsx` — revenue, orders, visitors, and
/// top products for a supplier.
class StoreAnalyticsScreen extends StatefulWidget {
  const StoreAnalyticsScreen({super.key});
  @override
  State<StoreAnalyticsScreen> createState() => _StoreAnalyticsScreenState();
}

class _StoreAnalyticsScreenState extends State<StoreAnalyticsScreen> {
  Map<String, dynamic> _stats = {};
  List<Map<String, dynamic>> _top = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loading = false); return; }
    try {
      final supplier = await supabase
          .from('suppliers')
          .select('id')
          .eq('owner_id', uid)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();
      if (supplier == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final supplierId = supplier['id'];
      final orders = await supabase.from('orders').select('total, status, created_at').eq('supplier_id', supplierId);
      final products = await supabase
          .from('products')
          .select('id, title, image, sold, price')
          .eq('supplier_id', supplierId)
          .order('sold', ascending: false)
          .limit(6);
      double revenue = 0;
      int pending = 0;
      int total = (orders as List).length;
      for (final o in orders) {
        final m = o as Map;
        revenue += (m['total'] as num?)?.toDouble() ?? 0;
        if (m['status'] == 'pending' || m['status'] == 'processing') pending++;
      }
      if (!mounted) return;
      setState(() {
        _stats = {'revenue': revenue, 'orders': total, 'pending': pending};
        _top = (products as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(appBar: AppBar(title: const Text('Store analytics')), body: Skeletons.screen(SkeletonPreset.dashboard));
    return Scaffold(
      appBar: AppBar(title: const Text('Store analytics')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Row(children: [
          _kpi('Revenue', '\$${(_stats['revenue'] as num? ?? 0).toStringAsFixed(2)}', LucideIcons.dollarSign, AppColors.success),
          const SizedBox(width: 10),
          _kpi('Orders', '${_stats['orders'] ?? 0}', LucideIcons.shoppingBag, AppColors.primary),
          const SizedBox(width: 10),
          _kpi('Pending', '${_stats['pending'] ?? 0}', LucideIcons.clock, AppColors.warning),
        ]),
        const SizedBox(height: 24),
        const Text('Top products', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (_top.isEmpty) const Text('No sales yet.', style: TextStyle(color: AppColors.muted)),
        for (final p in _top)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
            child: Row(children: [
              Expanded(child: Text('${p['title']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800))),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('${p['sold'] ?? 0} sold', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                Text('\$${p['price'] ?? 0}', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              ]),
            ]),
          ),
      ]),
    );
  }

  Widget _kpi(String label, String value, IconData icon, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ]),
        ),
      );
}
