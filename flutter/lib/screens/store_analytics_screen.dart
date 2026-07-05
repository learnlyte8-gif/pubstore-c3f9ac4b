import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/StoreAnalytics.tsx` — Sales Cockpit with a 7d/30d/90d
/// range selector, revenue KPIs, sparkline / bar / status charts, and a
/// top-products leaderboard.
class StoreAnalyticsScreen extends StatefulWidget {
  const StoreAnalyticsScreen({super.key});
  @override
  State<StoreAnalyticsScreen> createState() => _StoreAnalyticsScreenState();
}

class _Range {
  const _Range(this.id, this.label, this.days);
  final String id;
  final String label;
  final int days;
}

const _ranges = <_Range>[
  _Range('7d', '7 days', 7),
  _Range('30d', '30 days', 30),
  _Range('90d', '90 days', 90),
];

class _StoreAnalyticsScreenState extends State<StoreAnalyticsScreen> {
  _Range _range = _ranges[1];
  Map<String, dynamic>? _supplier;
  bool _loadingSupplier = true;
  bool _loading = false;

  // metrics
  List<({DateTime date, double revenue, int orders})> _daily = const [];
  double _revenue = 0, _prevRevenue = 0, _aov = 0, _avgRating = 0;
  int _orderCount = 0, _prevOrderCount = 0, _buyers = 0, _activeProducts = 0, _reviewsCount = 0, _followers = 0, _totalProducts = 0;
  Map<String, int> _statusMix = const {};
  List<Map<String, dynamic>> _topProducts = const [];

  @override
  void initState() {
    super.initState();
    _loadSupplier();
  }

  Future<void> _loadSupplier() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) { setState(() => _loadingSupplier = false); return; }
    try {
      final s = await supabase.from('suppliers').select('id,name').eq('owner_id', uid).order('created_at', ascending: false).limit(1).maybeSingle();
      _supplier = s == null ? null : Map<String, dynamic>.from(s);
    } catch (_) {}
    setState(() => _loadingSupplier = false);
    if (_supplier != null) _load();
  }

  DateTime _daysAgo(int n) {
    final now = DateTime.now();
    final d = DateTime(now.year, now.month, now.day).subtract(Duration(days: n));
    return d;
  }

  Future<void> _load() async {
    if (_supplier == null) return;
    setState(() => _loading = true);
    try {
      final sid = _supplier!['id'];
      final since = _daysAgo(_range.days - 1);
      final prevSince = _daysAgo(_range.days * 2 - 1);

      final ordersRes = await supabase
          .from('orders')
          .select('id,total,status,created_at,buyer_id')
          .eq('supplier_id', sid)
          .gte('created_at', since.toIso8601String())
          .order('created_at', ascending: true);
      final prevOrdersRes = await supabase
          .from('orders')
          .select('id,total')
          .eq('supplier_id', sid)
          .gte('created_at', prevSince.toIso8601String())
          .lt('created_at', since.toIso8601String());
      final products = await supabase
          .from('products')
          .select('id,title,price,sold,rating,image,active')
          .eq('supplier_id', sid)
          .order('sold', ascending: false)
          .limit(50);

      // Followers
      int followers = 0;
      try {
        final f = await supabase.from('followers').select('id').eq('supplier_id', sid);
        followers = (f as List).length;
      } catch (_) {}

      final orders = (ordersRes as List).map((o) => Map<String, dynamic>.from(o as Map)).toList();
      final prev = (prevOrdersRes as List).map((o) => Map<String, dynamic>.from(o as Map)).toList();
      final prodList = (products as List).map((p) => Map<String, dynamic>.from(p as Map)).toList();

      // Build daily buckets.
      final buckets = <String, ({DateTime date, double revenue, int orders})>{};
      for (int i = 0; i < _range.days; i++) {
        final d = _daysAgo(_range.days - 1 - i);
        buckets[d.toIso8601String().substring(0, 10)] = (date: d, revenue: 0.0, orders: 0);
      }
      for (final o in orders) {
        final key = DateTime.parse(o['created_at']).toUtc().toIso8601String().substring(0, 10);
        final b = buckets[key];
        if (b != null) {
          buckets[key] = (date: b.date, revenue: b.revenue + ((o['total'] ?? 0) as num).toDouble(), orders: b.orders + 1);
        }
      }

      double rev = 0, prevRev = 0;
      final buyerSet = <String>{};
      final status = <String, int>{};
      for (final o in orders) {
        rev += ((o['total'] ?? 0) as num).toDouble();
        if (o['buyer_id'] != null) buyerSet.add('${o['buyer_id']}');
        final s = (o['status'] ?? 'placed') as String;
        status[s] = (status[s] ?? 0) + 1;
      }
      for (final o in prev) {
        prevRev += ((o['total'] ?? 0) as num).toDouble();
      }

      final top = [...prodList]..sort((a, b) =>
          (((b['sold'] ?? 0) as num) * ((b['price'] ?? 0) as num))
              .compareTo(((a['sold'] ?? 0) as num) * ((a['price'] ?? 0) as num)));

      final active = prodList.where((p) => p['active'] == true).length;
      final avgRating = prodList.isEmpty ? 0.0 : prodList.fold<double>(0, (s, p) => s + ((p['rating'] ?? 0) as num).toDouble()) / prodList.length;

      if (!mounted) return;
      setState(() {
        _daily = buckets.values.toList();
        _revenue = rev;
        _prevRevenue = prevRev;
        _orderCount = orders.length;
        _prevOrderCount = prev.length;
        _buyers = buyerSet.length;
        _aov = _orderCount == 0 ? 0 : rev / _orderCount;
        _statusMix = status;
        _topProducts = top.take(5).toList();
        _activeProducts = active;
        _totalProducts = prodList.length;
        _avgRating = avgRating;
        _followers = followers;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _fmt(num n) => '\$${n.toStringAsFixed(0)}';

  @override
  Widget build(BuildContext context) {
    if (_loadingSupplier) return Scaffold(appBar: AppBar(title: const Text('Sales Cockpit')), body: Skeletons.list(count: 4));
    if (_supplier == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sales Cockpit')),
        body: const Center(child: Padding(padding: EdgeInsets.all(24),
            child: Text('Create your store first to see analytics.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)))),
      );
    }
    final revDelta = _revenue - _prevRevenue;
    final revDeltaPct = _prevRevenue > 0 ? (revDelta / _prevRevenue) * 100 : (_revenue > 0 ? 100.0 : 0.0);
    final ordDelta = _orderCount - _prevOrderCount;

    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverToBoxAdapter(child: _hero(revDelta, revDeltaPct)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
          sliver: SliverGrid(
            delegate: SliverChildListDelegate([
              _kpi(LucideIcons.shoppingBag, 'ORDERS', '$_orderCount', '${ordDelta >= 0 ? '+' : ''}$ordDelta vs prev'),
              _kpi(LucideIcons.users, 'UNIQUE BUYERS', '$_buyers', '$_followers followers'),
              _kpi(LucideIcons.trendingUp, 'AVG ORDER', _fmt(_aov), 'per order'),
              _kpi(LucideIcons.package, 'ACTIVE PRODUCTS', '$_activeProducts', '$_totalProducts total'),
            ]),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 1.7),
          ),
        ),
        SliverToBoxAdapter(child: _chartCard('Revenue trend', LucideIcons.activity, height: 140, child: _RevenueSpark(daily: _daily))),
        SliverToBoxAdapter(child: _chartCard('Orders per day', LucideIcons.zap, height: 120, child: _OrdersBars(daily: _daily))),
        SliverToBoxAdapter(child: _chartCard('Order status mix', LucideIcons.eye, child: _StatusMix(mix: _statusMix))),
        SliverToBoxAdapter(child: _chartCard('Top products by revenue', LucideIcons.trendingUp, child: _TopProducts(items: _topProducts))),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
          sliver: SliverGrid(
            delegate: SliverChildListDelegate([
              _miniStat('AVG RATING', _avgRating.toStringAsFixed(2), '$_reviewsCount new reviews'),
              _miniStat('FOLLOWERS', '$_followers', 'all-time'),
            ]),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 2.4),
          ),
        ),
      ]),
    );
  }

  Widget _hero(double revDelta, double revDeltaPct) => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [AppColors.primary, Color(0xFF9333EA)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 20),
            child: Column(children: [
              Row(children: [
                IconButton(icon: const Icon(LucideIcons.arrowLeft, color: Colors.white, size: 18), onPressed: () => Navigator.of(context).maybePop()),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: const [
                    Icon(LucideIcons.sparkles, size: 14, color: Colors.white),
                    SizedBox(width: 4),
                    Text('Sales Cockpit', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white)),
                  ]),
                  Text('${_supplier?['name'] ?? ''}', style: const TextStyle(fontSize: 11, color: Colors.white70, fontWeight: FontWeight.w700)),
                ])),
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(99), border: Border.all(color: Colors.white24)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: _ranges.map((r) {
                    final on = _range.id == r.id;
                    return InkWell(
                      onTap: () { setState(() => _range = r); _load(); },
                      borderRadius: BorderRadius.circular(99),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: on ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(99)),
                        child: Text(r.label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: on ? AppColors.primary : Colors.white70)),
                      ),
                    );
                  }).toList()),
                ),
              ]),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white24)),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: const [
                      Icon(LucideIcons.dollarSign, size: 12, color: Colors.white70),
                      SizedBox(width: 4),
                      Text('REVENUE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white70, letterSpacing: 1)),
                    ]),
                    const SizedBox(height: 2),
                    Text(_loading ? '—' : _fmt(_revenue), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white, height: 1)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: (revDelta >= 0 ? AppColors.success : AppColors.danger).withOpacity(0.25), borderRadius: BorderRadius.circular(99)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(revDelta >= 0 ? LucideIcons.arrowUpRight : LucideIcons.arrowDownRight, size: 10, color: Colors.white),
                        const SizedBox(width: 2),
                        Text('${revDeltaPct.abs().toStringAsFixed(0)}% vs prev', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                      ]),
                    ),
                  ])),
                  SizedBox(width: 90, height: 46, child: _RevenueSpark(daily: _daily, color: Colors.white)),
                ]),
              ),
            ]),
          ),
        ),
      );

  Widget _kpi(IconData icon, String label, String value, String sub) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(width: 24, height: 24, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                child: Icon(icon, size: 12, color: AppColors.primary)),
            const SizedBox(width: 6),
            Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 1)),
          ]),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          Text(sub, style: const TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w700)),
        ]),
      );

  Widget _miniStat(String label, String value, String sub) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 1)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          Text(sub, style: const TextStyle(fontSize: 10, color: AppColors.muted, fontWeight: FontWeight.w700)),
        ]),
      );

  Widget _chartCard(String title, IconData icon, {required Widget child, double? height}) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(icon, size: 14, color: AppColors.primary),
              const SizedBox(width: 4),
              Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
            ]),
            const SizedBox(height: 10),
            SizedBox(height: height, child: child),
          ]),
        ),
      );
}

class _RevenueSpark extends StatelessWidget {
  const _RevenueSpark({required this.daily, this.color = AppColors.primary});
  final List<({DateTime date, double revenue, int orders})> daily;
  final Color color;
  @override
  Widget build(BuildContext context) {
    if (daily.isEmpty) return const SizedBox();
    return CustomPaint(size: Size.infinite, painter: _SparkPainter(daily.map((d) => d.revenue).toList(), color));
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color);
  final List<double> values;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;
    final maxV = values.fold<double>(0, math.max);
    final minV = 0.0;
    final range = math.max(1.0, maxV - minV);
    final path = Path();
    for (int i = 0; i < values.length; i++) {
      final x = size.width * i / math.max(1, values.length - 1);
      final y = size.height - ((values[i] - minV) / range) * size.height;
      if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    final fill = Path.from(path)..lineTo(size.width, size.height)..lineTo(0, size.height)..close();
    canvas.drawPath(fill, Paint()..shader = LinearGradient(colors: [color.withOpacity(0.4), color.withOpacity(0)], begin: Alignment.topCenter, end: Alignment.bottomCenter).createShader(Offset.zero & size));
    canvas.drawPath(path, Paint()..color = color..strokeWidth = 2..style = PaintingStyle.stroke);
  }
  @override
  bool shouldRepaint(covariant _SparkPainter old) => old.values != values;
}

class _OrdersBars extends StatelessWidget {
  const _OrdersBars({required this.daily});
  final List<({DateTime date, double revenue, int orders})> daily;
  @override
  Widget build(BuildContext context) {
    if (daily.isEmpty) return const Center(child: Text('No data', style: TextStyle(color: AppColors.muted, fontSize: 12)));
    final maxV = math.max(1, daily.fold<int>(0, (m, d) => math.max(m, d.orders)));
    return LayoutBuilder(
      builder: (context, cs) {
        final bw = cs.maxWidth / daily.length;
        return Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (final d in daily) SizedBox(
            width: bw,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: bw * 0.15),
              child: Container(
                height: cs.maxHeight * (d.orders / maxV),
                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(4)),
              ),
            ),
          ),
        ]);
      },
    );
  }
}

class _StatusMix extends StatelessWidget {
  const _StatusMix({required this.mix});
  final Map<String, int> mix;
  static const _palette = [Color(0xFF3B82F6), Color(0xFF9333EA), Color(0xFF10B981), Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF06B6D4)];
  @override
  Widget build(BuildContext context) {
    if (mix.isEmpty) return const Text('No orders in this range yet.', style: TextStyle(color: AppColors.muted, fontSize: 12));
    final entries = mix.entries.toList();
    return Column(children: [
      for (int i = 0; i < entries.length; i++) Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(children: [
          Container(width: 12, height: 12, decoration: BoxDecoration(color: _palette[i % _palette.length], borderRadius: BorderRadius.circular(3))),
          const SizedBox(width: 8),
          Expanded(child: Text(entries[i].key, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800))),
          Text('${entries[i].value}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
        ]),
      ),
    ]);
  }
}

class _TopProducts extends StatelessWidget {
  const _TopProducts({required this.items});
  final List<Map<String, dynamic>> items;
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const Text('No products to rank yet.', style: TextStyle(color: AppColors.muted, fontSize: 12));
    final max = math.max(1.0, (((items.first['sold'] ?? 0) as num) * ((items.first['price'] ?? 0) as num)).toDouble());
    return Column(children: [
      for (int i = 0; i < items.length; i++) ...[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            SizedBox(width: 22, child: Text('#${i + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppColors.muted))),
            Container(width: 32, height: 32, clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(6)),
                child: items[i]['image'] != null && (items[i]['image'] as String).isNotEmpty
                    ? Image.network(items[i]['image'], fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox())
                    : null),
            const SizedBox(width: 8),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${items[i]['title']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              LayoutBuilder(builder: (_, cs) {
                final rev = (((items[i]['sold'] ?? 0) as num) * ((items[i]['price'] ?? 0) as num)).toDouble();
                final pct = math.max(0.06, rev / max);
                return Container(
                  height: 5,
                  decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(3)),
                  child: FractionallySizedBox(alignment: Alignment.centerLeft, widthFactor: pct.clamp(0.0, 1.0),
                    child: Container(decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.primary, Color(0xFF9333EA)]), borderRadius: BorderRadius.circular(3))),
                  ),
                );
              }),
            ])),
            const SizedBox(width: 6),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('\$${((((items[i]['sold'] ?? 0) as num) * ((items[i]['price'] ?? 0) as num))).toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
              Text('${items[i]['sold'] ?? 0} sold', style: const TextStyle(fontSize: 9, color: AppColors.muted)),
            ]),
          ]),
        ),
      ],
    ]);
  }
}
