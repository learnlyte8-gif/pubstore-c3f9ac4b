import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/auth_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Orders — mirrors `src/pages/Orders.tsx` (buyer orders list).
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  Future<List<Map<String, dynamic>>>? _future;

  Future<List<Map<String, dynamic>>> _fetch(String uid) async {
    final rows = await supabase
        .from('orders')
        .select('id, created_at, status, total_amount, currency, '
            'items, supplier_id, tracking_number')
        .eq('buyer_id', uid)
        .order('created_at', ascending: false)
        .limit(80);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Orders')),
        body: const Center(
            child: Text('Sign in to see your orders',
                style: TextStyle(color: AppColors.muted))),
      );
    }
    _future ??= _fetch(user.id);
    return Scaffold(
      appBar: AppBar(
          title: const Text('Orders',
              style: TextStyle(fontWeight: FontWeight.w800))),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _fetch(user.id)),
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Center(
                    child: Text('No orders yet',
                        style: TextStyle(color: AppColors.muted))),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final o = items[i];
                final total = (o['total_amount'] as num?)?.toDouble() ?? 0;
                final currency = o['currency'] as String? ?? 'USD';
                final status = (o['status'] as String? ?? 'pending');
                final created = o['created_at'] as String?;
                final itemsList =
                    (o['items'] as List?)?.cast<dynamic>() ?? const [];
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _statusColor(status).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(status.toUpperCase(),
                              style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: _statusColor(status))),
                        ),
                        const Spacer(),
                        if (created != null)
                          Text(
                              DateFormat.yMMMd()
                                  .format(DateTime.parse(created).toLocal()),
                              style: const TextStyle(
                                  color: AppColors.muted, fontSize: 11)),
                      ]),
                      const SizedBox(height: 10),
                      Text('${itemsList.length} item${itemsList.length == 1 ? '' : 's'}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13)),
                      const SizedBox(height: 6),
                      Text('$currency ${total.toStringAsFixed(2)}',
                          style: const TextStyle(
                              color: AppColors.priceRed,
                              fontWeight: FontWeight.w900,
                              fontSize: 18)),
                      if (o['tracking_number'] != null) ...[
                        const SizedBox(height: 8),
                        Row(children: [
                          const Icon(LucideIcons.truck,
                              size: 12, color: AppColors.muted),
                          const SizedBox(width: 4),
                          Text('Tracking: ${o['tracking_number']}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.muted)),
                        ]),
                      ],
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'delivered':
        return AppColors.success;
      case 'shipped':
        return AppColors.primary;
      case 'cancelled':
      case 'refunded':
        return AppColors.danger;
      case 'processing':
      case 'confirmed':
        return AppColors.warning;
      default:
        return AppColors.muted;
    }
  }
}
