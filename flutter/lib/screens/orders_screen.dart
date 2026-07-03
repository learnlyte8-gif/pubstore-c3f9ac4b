import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/auth_service.dart';
import '../services/cart_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';
import '../widgets/skeletons.dart';
import 'messages_screen.dart';
import 'product_detail_screen.dart';

/// Orders — mirrors `src/pages/Orders.tsx` (buyer orders list + detail).
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

enum _Filter { all, placed, processing, shipped, delivered, cancelled }

const _filterLabels = {
  _Filter.all: 'All',
  _Filter.placed: 'Placed',
  _Filter.processing: 'Processing',
  _Filter.shipped: 'Shipped',
  _Filter.delivered: 'Delivered',
  _Filter.cancelled: 'Cancelled',
};

const _steps = ['placed', 'processing', 'shipped', 'delivered'];

class _StatusMeta {
  final IconData icon;
  final String label;
  final Color color;
  const _StatusMeta(this.icon, this.label, this.color);
}

const _statusMeta = <String, _StatusMeta>{
  'awaiting_payment':
      _StatusMeta(LucideIcons.clock, 'Awaiting payment', Color(0xFFF97316)),
  'placed': _StatusMeta(LucideIcons.clock, 'Placed', Color(0xFF0EA5E9)),
  'processing':
      _StatusMeta(LucideIcons.package, 'Processing', Color(0xFFF59E0B)),
  'shipped': _StatusMeta(LucideIcons.truck, 'Shipped', Color(0xFF8B5CF6)),
  'delivered':
      _StatusMeta(LucideIcons.checkCircle2, 'Delivered', Color(0xFF10B981)),
  'cancelled': _StatusMeta(LucideIcons.xCircle, 'Cancelled', AppColors.danger),
};

_StatusMeta _metaFor(String s) =>
    _statusMeta[s] ?? _statusMeta['placed']!;

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  Future<List<Map<String, dynamic>>>? _future;
  _Filter _filter = _Filter.all;
  String? _openId;
  final Set<String> _reviewed = {};

  Future<List<Map<String, dynamic>>> _fetch(String uid) async {
    final ords = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', uid)
        .order('created_at', ascending: false);
    final list = (ords as List).cast<Map<String, dynamic>>();
    if (list.isEmpty) return list;

    final ids = list.map((o) => o['id']).toList();
    final supIds =
        list.map((o) => o['supplier_id']).whereType<String>().toSet().toList();

    final itemsRes = await supabase
        .from('order_items')
        .select('*')
        .inFilter('order_id', ids);
    final supsRes = supIds.isEmpty
        ? []
        : await supabase
            .from('suppliers')
            .select('id,name,logo,country')
            .inFilter('id', supIds);
    final revsRes = await supabase
        .from('reviews')
        .select('product_id')
        .eq('user_id', uid);

    final supMap = <String, Map<String, dynamic>>{
      for (final s in (supsRes as List).cast<Map<String, dynamic>>())
        s['id'] as String: s
    };
    final byOrder = <String, List<Map<String, dynamic>>>{};
    for (final it in (itemsRes as List).cast<Map<String, dynamic>>()) {
      byOrder.putIfAbsent(it['order_id'] as String, () => []).add(it);
    }
    _reviewed
      ..clear()
      ..addAll((revsRes as List).map((r) => r['product_id'].toString()));

    return list.map((o) {
      return {
        ...o,
        'supplier': supMap[o['supplier_id']],
        'items': byOrder[o['id']] ?? const [],
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('My orders')),
        body: const Center(
            child: Text('Sign in to see your orders',
                style: TextStyle(color: AppColors.muted))),
      );
    }
    _future ??= _fetch(user.id);

    return Scaffold(
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          final loading = snap.connectionState != ConnectionState.done;
          final orders = snap.data ?? const [];
          final open = _openId == null
              ? null
              : orders.cast<Map<String, dynamic>?>().firstWhere(
                  (o) => o?['id'] == _openId,
                  orElse: () => null);

          if (open != null) {
            return _OrderDetail(
              order: open,
              reviewed: _reviewed,
              onBack: () => setState(() => _openId = null),
              onUpdated: (updated) {
                setState(() {
                  final idx =
                      orders.indexWhere((o) => o['id'] == updated['id']);
                  if (idx >= 0) orders[idx] = updated;
                });
              },
              onReviewed: (pid) => setState(() => _reviewed.add(pid)),
            );
          }

          final visible = orders
              .where((o) =>
                  _filter == _Filter.all ||
                  o['status'] == _filter.name)
              .toList();

          return RefreshIndicator(
            onRefresh: () async =>
                setState(() => _future = _fetch(user.id)),
            child: CustomScrollView(slivers: [
              SliverAppBar(
                pinned: true,
                title: const Text('My orders',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                backgroundColor: AppColors.card,
                foregroundColor: AppColors.foreground,
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(46),
                  child: SizedBox(
                    height: 46,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      children: _Filter.values.map((f) {
                        final active = _filter == f;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: GestureDetector(
                            onTap: () => setState(() => _filter = f),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 6),
                              decoration: BoxDecoration(
                                color: active
                                    ? AppColors.foreground
                                    : AppColors.mutedSurface,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(_filterLabels[f]!,
                                  style: TextStyle(
                                    color: active
                                        ? AppColors.background
                                        : AppColors.muted,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  )),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
              if (loading)
                const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()))
              else if (visible.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(LucideIcons.package,
                            size: 40, color: AppColors.muted),
                        const SizedBox(height: 12),
                        const Text('No orders yet',
                            style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 14)),
                        const SizedBox(height: 6),
                        const Text(
                            'Add items to your cart and place your first order.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: AppColors.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                )
              else
                SliverList.separated(
                  itemCount: visible.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => Padding(
                    padding: EdgeInsets.fromLTRB(
                        14, i == 0 ? 12 : 0, 14, i == visible.length - 1 ? 12 : 0),
                    child: _OrderCard(
                      order: visible[i],
                      onOpen: () =>
                          setState(() => _openId = visible[i]['id'] as String),
                    ),
                  ),
                ),
            ]),
          );
        },
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback onOpen;
  const _OrderCard({required this.order, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    final meta = _metaFor(order['status'] as String? ?? 'placed');
    final supplier = order['supplier'] as Map<String, dynamic>?;
    final items = (order['items'] as List).cast<Map<String, dynamic>>();
    final total = (order['total'] as num?)?.toDouble() ?? 0;
    final eta = order['eta'] as String?;
    final ref = order['ref_code'] as String? ??
        (order['id'] as String).substring(0, 8);
    final created = DateTime.tryParse(order['created_at'] as String? ?? '');

    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header strip
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.mutedSurface.withOpacity(0.5),
                border:
                    const Border(bottom: BorderSide(color: AppColors.border)),
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(18)),
              ),
              child: Row(children: [
                if (supplier?['logo'] != null)
                  ClipOval(
                    child: Image.network(supplier!['logo'] as String,
                        width: 28,
                        height: 28,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox()),
                  ),
                if (supplier?['logo'] != null) const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(supplier?['name'] as String? ?? 'Supplier',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                      Text(
                          '$ref · ${created != null ? DateFormat.yMd().format(created.toLocal()) : ''}',
                          style: const TextStyle(
                              fontSize: 10, color: AppColors.muted)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: meta.color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(meta.icon, size: 11, color: meta.color),
                    const SizedBox(width: 4),
                    Text(meta.label,
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: meta.color)),
                  ]),
                ),
              ]),
            ),
            // Items preview
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  ...items.take(3).map((it) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              (it['image'] as String?) ?? '',
                              width: 46,
                              height: 46,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                  width: 46,
                                  height: 46,
                                  color: AppColors.mutedSurface),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(it['title'] as String? ?? '',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 12)),
                                const SizedBox(height: 2),
                                Text(
                                    '${it['qty']} × \$${(it['unit_price'] as num).toStringAsFixed(2)}',
                                    style: const TextStyle(
                                        fontSize: 10, color: AppColors.muted)),
                              ],
                            ),
                          ),
                        ]),
                      )),
                  if (items.length > 3)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text('+${items.length - 3} more',
                          style: const TextStyle(
                              fontSize: 10, color: AppColors.muted)),
                    ),
                ],
              ),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(children: [
                Text(eta != null ? 'ETA $eta' : '—',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.muted)),
                const Spacer(),
                Text('\$${total.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14)),
                const SizedBox(width: 4),
                const Icon(LucideIcons.chevronRight,
                    size: 16, color: AppColors.muted),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderDetail extends ConsumerStatefulWidget {
  final Map<String, dynamic> order;
  final Set<String> reviewed;
  final VoidCallback onBack;
  final void Function(Map<String, dynamic>) onUpdated;
  final void Function(String pid) onReviewed;

  const _OrderDetail({
    required this.order,
    required this.reviewed,
    required this.onBack,
    required this.onUpdated,
    required this.onReviewed,
  });

  @override
  ConsumerState<_OrderDetail> createState() => _OrderDetailState();
}

class _OrderDetailState extends ConsumerState<_OrderDetail> {
  Future<void> _cancel() async {
    try {
      await supabase
          .from('orders')
          .update({'status': 'cancelled'}).eq('id', widget.order['id']);
      widget.onUpdated({...widget.order, 'status': 'cancelled'});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Order cancelled')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not cancel')));
      }
    }
  }

  Future<void> _reorder() async {
    final items = (widget.order['items'] as List).cast<Map<String, dynamic>>();
    final cart = ref.read(cartProvider.notifier);
    final ids = items.map((it) => it['product_id'] as String).toList();
    try {
      final rows = await supabase
          .from('products')
          .select('id, title, price, currency, images, category, rating, sold, supplier_id')
          .inFilter('id', ids);
      final byId = <String, Product>{
        for (final r in (rows as List).cast<Map<String, dynamic>>())
          r['id'] as String: Product.fromRow(r)
      };
      for (final it in items) {
        final p = byId[it['product_id']];
        if (p != null) cart.add(p, qty: (it['qty'] as num).toInt());
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Items added back to cart')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    final meta = _metaFor(o['status'] as String? ?? 'placed');
    final activeStep = o['status'] == 'cancelled' ? -1 : _steps.indexOf(o['status'] as String);
    final items = (o['items'] as List).cast<Map<String, dynamic>>();
    final supplier = o['supplier'] as Map<String, dynamic>?;
    final subtotal = (o['subtotal'] as num?)?.toDouble() ?? 0;
    final shipping = (o['shipping'] as num?)?.toDouble() ?? 0;
    final discount = (o['discount'] as num?)?.toDouble() ?? 0;
    final total = (o['total'] as num?)?.toDouble() ?? 0;
    final isDelivered = o['status'] == 'delivered';
    final ref = o['ref_code'] as String? ??
        (o['id'] as String).substring(0, 8);
    final created = DateTime.tryParse(o['created_at'] as String? ?? '');

    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          leading: IconButton(
              onPressed: widget.onBack,
              icon: const Icon(LucideIcons.chevronLeft)),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(ref,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w800)),
              if (created != null)
                Text(DateFormat.yMd().format(created.toLocal()),
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.muted)),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: meta.color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(meta.label,
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: meta.color)),
                ),
              ),
            ),
          ],
        ),
        SliverPadding(
          padding: const EdgeInsets.all(14),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              if (o['status'] != 'cancelled')
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Tracking',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: List.generate(_steps.length, (i) {
                          final m = _metaFor(_steps[i]);
                          final done = i <= activeStep;
                          return Expanded(
                            child: Column(children: [
                              Stack(
                                clipBehavior: Clip.none,
                                alignment: Alignment.center,
                                children: [
                                  if (i < _steps.length - 1)
                                    Positioned(
                                      left: MediaQuery.of(context).size.width / 8,
                                      top: 14,
                                      right: -MediaQuery.of(context).size.width / 8,
                                      child: Container(
                                        height: 2,
                                        color: i < activeStep
                                            ? AppColors.primary
                                            : AppColors.mutedSurface,
                                      ),
                                    ),
                                  Container(
                                    width: 32,
                                    height: 32,
                                    decoration: BoxDecoration(
                                      color: done
                                          ? AppColors.primary
                                          : AppColors.mutedSurface,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(m.icon,
                                        size: 16,
                                        color: done
                                            ? AppColors.primaryForeground
                                            : AppColors.muted),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(m.label,
                                  style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                      color: done
                                          ? AppColors.foreground
                                          : AppColors.muted)),
                            ]),
                          );
                        }),
                      ),
                      if (o['tracking'] != null) ...[
                        const SizedBox(height: 10),
                        Center(
                          child: Text('Tracking: ${o['tracking']}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.muted)),
                        ),
                      ],
                      if (o['eta'] != null) ...[
                        const SizedBox(height: 4),
                        Center(
                          child: Text.rich(TextSpan(
                            text: 'Expected delivery: ',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.muted),
                            children: [
                              TextSpan(
                                  text: '${o['eta']}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.foreground)),
                            ],
                          )),
                        ),
                      ],
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withOpacity(0.1),
                    border:
                        Border.all(color: AppColors.danger.withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(children: const [
                    Icon(LucideIcons.xCircle,
                        color: AppColors.danger, size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text('This order was cancelled.',
                          style: TextStyle(
                              color: AppColors.danger, fontSize: 12)),
                    ),
                  ]),
                ),
              const SizedBox(height: 10),
              if (supplier != null)
                _card(
                  child: Row(children: [
                    if (supplier['logo'] != null)
                      ClipOval(
                        child: Image.network(supplier['logo'] as String,
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const SizedBox()),
                      ),
                    if (supplier['logo'] != null) const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(supplier['name'] as String? ?? '',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700)),
                          Text(supplier['country'] as String? ?? '',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.muted)),
                        ],
                      ),
                    ),
                    ElevatedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const MessagesScreen())),
                      icon: const Icon(LucideIcons.messageCircle, size: 14),
                      label: const Text('Chat'),
                      style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          textStyle: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ]),
                ),
              if (supplier != null) const SizedBox(height: 10),
              _EscrowCard(order: o, onUpdated: widget.onUpdated),
              const SizedBox(height: 10),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Items (${items.length})',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 10),
                    ...items.map((it) {
                      final pid = it['product_id'] as String;
                      final reviewed = widget.reviewed.contains(pid);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            GestureDetector(
                              onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) => ProductDetailScreen(
                                          productId: pid))),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  (it['image'] as String?) ?? '',
                                  width: 56,
                                  height: 56,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                      width: 56,
                                      height: 56,
                                      color: AppColors.mutedSurface),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(it['title'] as String? ?? '',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 12)),
                                  const SizedBox(height: 2),
                                  Text(
                                      '${it['qty']} × \$${(it['unit_price'] as num).toStringAsFixed(2)}',
                                      style: const TextStyle(
                                          fontSize: 10,
                                          color: AppColors.muted)),
                                  if (isDelivered) ...[
                                    const SizedBox(height: 6),
                                    if (reviewed)
                                      Row(mainAxisSize: MainAxisSize.min, children: const [
                                        Icon(LucideIcons.checkCircle2,
                                            size: 12, color: AppColors.success),
                                        SizedBox(width: 4),
                                        Text('Reviewed',
                                            style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w800,
                                                color: AppColors.success)),
                                      ])
                                    else
                                      InkWell(
                                        onTap: () => _openReview(it),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppColors.warning
                                                .withOpacity(0.15),
                                            borderRadius:
                                                BorderRadius.circular(999),
                                          ),
                                          child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: const [
                                                Icon(LucideIcons.star,
                                                    size: 12,
                                                    color: AppColors.warning),
                                                SizedBox(width: 4),
                                                Text('Write a review',
                                                    style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                        color: AppColors
                                                            .warning)),
                                              ]),
                                        ),
                                      ),
                                  ],
                                ],
                              ),
                            ),
                            Text(
                                '\$${((it['qty'] as num) * (it['unit_price'] as num)).toStringAsFixed(2)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800, fontSize: 13)),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              if (o['ship_to'] != null) ...[
                const SizedBox(height: 10),
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: const [
                        Icon(LucideIcons.mapPin,
                            size: 14, color: AppColors.primary),
                        SizedBox(width: 6),
                        Text('Ship to',
                            style: TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w800)),
                      ]),
                      const SizedBox(height: 6),
                      Text(o['ship_to'] as String,
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 10),
              _card(
                child: Column(children: [
                  _row('Subtotal', '\$${subtotal.toStringAsFixed(2)}'),
                  if (discount > 0)
                    _row(
                        'Discount${o['coupon_code'] != null ? ' (${o['coupon_code']})' : ''}',
                        '-\$${discount.toStringAsFixed(2)}'),
                  _row(
                      'Shipping',
                      shipping == 0
                          ? 'Free'
                          : '\$${shipping.toStringAsFixed(2)}'),
                  const Divider(height: 18),
                  _row('Total', '\$${total.toStringAsFixed(2)}', bold: true),
                ]),
              ),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _reorder,
                    icon: const Icon(LucideIcons.rotateCcw, size: 16),
                    label: const Text('Reorder'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.foreground,
                      foregroundColor: AppColors.background,
                      minimumSize: const Size.fromHeight(44),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: o['status'] == 'placed'
                      ? OutlinedButton.icon(
                          onPressed: _cancel,
                          icon: const Icon(LucideIcons.xCircle,
                              size: 16, color: AppColors.danger),
                          label: const Text('Cancel',
                              style: TextStyle(color: AppColors.danger)),
                          style: OutlinedButton.styleFrom(
                            backgroundColor:
                                AppColors.danger.withOpacity(0.1),
                            side: BorderSide.none,
                            minimumSize: const Size.fromHeight(44),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999)),
                          ),
                        )
                      : OutlinedButton.icon(
                          onPressed: () {},
                          icon: const Icon(LucideIcons.fileText, size: 16),
                          label: const Text('Invoice'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(44),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999)),
                          ),
                        ),
                ),
              ]),
            ]),
          ),
        ),
      ]),
    );
  }

  Future<void> _openReview(Map<String, dynamic> item) async {
    final pid = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ReviewSheet(item: item),
    );
    if (pid != null) widget.onReviewed(pid);
  }

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.card,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(18),
        ),
        child: child,
      );

  Widget _row(String l, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(l,
                style: TextStyle(
                    fontSize: 12,
                    color: bold ? AppColors.foreground : AppColors.muted,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w400)),
            Text(v,
                style: TextStyle(
                    fontSize: bold ? 15 : 12,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w600)),
          ],
        ),
      );
}

class _EscrowCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final void Function(Map<String, dynamic>) onUpdated;
  const _EscrowCard({required this.order, required this.onUpdated});

  @override
  Widget build(BuildContext context) {
    final status = order['escrow_status'] as String? ?? 'none';
    if (status == 'none') return const SizedBox.shrink();
    final amount = ((order['escrow_amount'] ?? order['total'] ?? 0) as num)
        .toDouble();

    Color bg;
    Color border;
    switch (status) {
      case 'held':
        bg = AppColors.warning.withOpacity(0.1);
        border = AppColors.warning.withOpacity(0.3);
        break;
      case 'released':
        bg = AppColors.success.withOpacity(0.1);
        border = AppColors.success.withOpacity(0.3);
        break;
      case 'disputed':
        bg = AppColors.danger.withOpacity(0.1);
        border = AppColors.danger.withOpacity(0.3);
        break;
      default:
        bg = AppColors.mutedSurface;
        border = AppColors.border;
    }

    final label = status == 'held'
        ? 'Funds held in escrow'
        : status == 'released'
            ? 'Funds released'
            : status == 'disputed'
                ? 'Dispute open'
                : status == 'refunded'
                    ? 'Refunded'
                    : 'Trade Assurance';
    final icon = status == 'released'
        ? LucideIcons.checkCircle2
        : status == 'disputed'
            ? LucideIcons.alertTriangle
            : LucideIcons.lock;

    Future<void> update(Map<String, dynamic> patch) async {
      try {
        await supabase.from('orders').update(patch).eq('id', order['id']);
        onUpdated({...order, ...patch});
      } catch (e) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(LucideIcons.shieldCheck,
                size: 18, color: AppColors.primary),
            const SizedBox(width: 8),
            const Expanded(
              child: Text('Trade Assurance',
                  style:
                      TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.background,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(icon, size: 11),
                const SizedBox(width: 4),
                Text(label,
                    style: const TextStyle(
                        fontSize: 10, fontWeight: FontWeight.w800)),
              ]),
            ),
          ]),
          const SizedBox(height: 6),
          Text(
              '\$${amount.toStringAsFixed(2)}${status == 'held' ? ' is securely held until you confirm delivery.' : status == 'disputed' ? ' Our trade team is reviewing this case.' : ''}',
              style:
                  const TextStyle(fontSize: 11, color: AppColors.muted)),
          if (order['dispute_reason'] != null) ...[
            const SizedBox(height: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('Reason: ${order['dispute_reason']}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.danger)),
            ),
          ],
          if (status == 'held') ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: order['status'] == 'delivered'
                      ? () async {
                          await update({
                            'escrow_status': 'released',
                            'escrow_released_at':
                                DateTime.now().toUtc().toIso8601String(),
                          });
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content:
                                        Text('Funds released to supplier')));
                          }
                        }
                      : null,
                  icon: const Icon(LucideIcons.checkCircle2, size: 14),
                  label: const Text('Release funds'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(38),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999)),
                    textStyle: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final reason = await _promptReason(context);
                    if (reason == null || reason.isEmpty) return;
                    await update({
                      'escrow_status': 'disputed',
                      'dispute_opened_at':
                          DateTime.now().toUtc().toIso8601String(),
                      'dispute_reason': reason,
                    });
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text(
                              'Dispute opened — our team will mediate')));
                    }
                  },
                  icon: const Icon(LucideIcons.alertTriangle,
                      size: 14, color: AppColors.danger),
                  label: const Text('Open dispute',
                      style: TextStyle(color: AppColors.danger)),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: AppColors.danger.withOpacity(0.1),
                    side: BorderSide.none,
                    minimumSize: const Size.fromHeight(38),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999)),
                    textStyle: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ]),
            if (order['status'] != 'delivered')
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Center(
                  child: Text(
                      'You can release funds once the order is delivered.',
                      style:
                          TextStyle(fontSize: 10, color: AppColors.muted)),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Future<String?> _promptReason(BuildContext context) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Open dispute'),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(
              hintText:
                  'Briefly describe the issue (item not received, damaged…)'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, ctrl.text.trim()),
              child: const Text('Submit')),
        ],
      ),
    );
  }
}

class _ReviewSheet extends StatefulWidget {
  final Map<String, dynamic> item;
  const _ReviewSheet({required this.item});

  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  int _rating = 5;
  final _ctrl = TextEditingController();
  bool _saving = false;

  Future<void> _submit() async {
    final text = _ctrl.text.trim();
    if (text.length > 1000) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Review too long (max 1000 chars)')));
      return;
    }
    setState(() => _saving = true);
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Sign in required')));
      return;
    }
    try {
      await supabase.from('reviews').insert({
        'product_id': widget.item['product_id'],
        'user_id': uid,
        'rating': _rating,
        'text': text.isEmpty ? null : text,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Review posted · thanks!')));
        Navigator.pop(context, widget.item['product_id'] as String);
      }
    } catch (e) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: const BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  (widget.item['image'] as String?) ?? '',
                  width: 44,
                  height: 44,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                      width: 44,
                      height: 44,
                      color: AppColors.mutedSurface),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Write a review',
                        style: TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 14)),
                    Text(widget.item['title'] as String? ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.muted)),
                  ],
                ),
              ),
              IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(LucideIcons.x, size: 18)),
            ]),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final filled = i < _rating;
                return IconButton(
                  onPressed: () => setState(() => _rating = i + 1),
                  icon: Icon(LucideIcons.star,
                      size: 30,
                      color: filled ? AppColors.warning : AppColors.muted),
                );
              }),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _ctrl,
              maxLength: 1000,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Tell other buyers what you think (optional)…',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999)),
                  ),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999)),
                  ),
                  child: Text(_saving ? 'Posting…' : 'Post review'),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}
