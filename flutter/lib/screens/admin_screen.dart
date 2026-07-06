import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Admin.tsx` — platform admin console: KPIs, moderation
/// queues, plus deep analytics (revenue timeseries, top verticals, recent
/// signups & orders). Gated by `has_role(uid, 'admin')`.
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  bool _isAdmin = false;
  late final TabController _tabs = TabController(length: 3, vsync: this);

  Map<String, int> _counts = {};
  double _revenue30d = 0;
  List<_DayPoint> _series = const [];
  List<_VerticalCount> _topVerticals = const [];
  List<Map<String, dynamic>> _recentOrders = const [];
  List<Map<String, dynamic>> _pendingVerifs = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final res = await supabase
          .rpc('has_role', params: {'_user_id': uid, '_role': 'admin'});
      _isAdmin = res == true;
      if (_isAdmin) {
        await Future.wait([
          _loadKpis(),
          _loadRevenueSeries(),
          _loadTopVerticals(),
          _loadRecent(),
        ]);
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadKpis() async {
    final users = await supabase.from('profiles').select('id');
    final orders = await supabase.from('orders').select('id');
    final suppliers = await supabase.from('suppliers').select('id');
    final pendingVerif = await supabase
        .from('user_verifications')
        .select('id')
        .eq('status', 'pending');
    _counts = {
      'users': (users as List).length,
      'orders': (orders as List).length,
      'suppliers': (suppliers as List).length,
      'pending_verif': (pendingVerif as List).length,
    };
  }

  Future<void> _loadRevenueSeries() async {
    final since = DateTime.now().toUtc().subtract(const Duration(days: 30));
    try {
      final rows = await supabase
          .from('orders')
          .select('total, created_at, status')
          .gte('created_at', since.toIso8601String());
      final byDay = <String, double>{};
      double revenue = 0;
      for (final r in (rows as List)) {
        final created = DateTime.tryParse('${r['created_at']}')?.toLocal();
        if (created == null) continue;
        final key = DateFormat('MM-dd').format(created);
        final total = ((r['total'] as num?) ?? 0).toDouble();
        byDay[key] = (byDay[key] ?? 0) + total;
        if (r['status'] != 'cancelled') revenue += total;
      }
      _revenue30d = revenue;
      _series = List.generate(30, (i) {
        final d = DateTime.now().subtract(Duration(days: 29 - i));
        final k = DateFormat('MM-dd').format(d);
        return _DayPoint(i.toDouble(), byDay[k] ?? 0, k);
      });
    } catch (_) {
      _series = const [];
    }
  }

  Future<void> _loadTopVerticals() async {
    try {
      final rows = await supabase.from('suppliers').select('verticals');
      final counts = <String, int>{};
      for (final r in (rows as List)) {
        for (final v in List<String>.from(r['verticals'] ?? const [])) {
          counts[v] = (counts[v] ?? 0) + 1;
        }
      }
      final entries = counts.entries.toList()
        ..sort((a, b) => b.value.compareTo(a.value));
      _topVerticals =
          entries.take(6).map((e) => _VerticalCount(e.key, e.value)).toList();
    } catch (_) {
      _topVerticals = const [];
    }
  }

  Future<void> _loadRecent() async {
    try {
      _recentOrders = List<Map<String, dynamic>>.from(await supabase
          .from('orders')
          .select('id, total, status, created_at, buyer_id')
          .order('created_at', ascending: false)
          .limit(8));
    } catch (_) {}
    try {
      _pendingVerifs = List<Map<String, dynamic>>.from(await supabase
          .from('user_verifications')
          .select('id, user_id, status, created_at, kind')
          .eq('status', 'pending')
          .order('created_at', ascending: false)
          .limit(8));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Skeletons.list(count: 6));
    if (!_isAdmin) {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.shieldOff,
                  size: 44, color: AppColors.destructive),
              SizedBox(height: 10),
              Text('Not authorised',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              SizedBox(height: 6),
              Text('You need an admin role to access this area.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.muted)),
            ]),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin console'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Analytics'),
            Tab(text: 'Moderation'),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () {
              setState(() => _loading = true);
              _load();
            },
            icon: const Icon(LucideIcons.refreshCw, size: 18),
          ),
        ],
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_overview(), _analytics(), _moderation()],
      ),
    );
  }

  // ── Overview ──────────────────────────────────────────────────────────
  Widget _overview() => RefreshIndicator(
        onRefresh: () async {
          setState(() => _loading = true);
          await _load();
        },
        child: ListView(padding: const EdgeInsets.all(16), children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.5,
            children: [
              _kpi('Users', '${_counts['users'] ?? 0}', LucideIcons.users,
                  AppColors.primary),
              _kpi('Orders', '${_counts['orders'] ?? 0}',
                  LucideIcons.shoppingBag, AppColors.success),
              _kpi('Suppliers', '${_counts['suppliers'] ?? 0}',
                  LucideIcons.store, AppColors.warning),
              _kpi('Pending KYC', '${_counts['pending_verif'] ?? 0}',
                  LucideIcons.badgeAlert, AppColors.destructive),
            ],
          ),
          const SizedBox(height: 20),
          _sectionTitle('30-day revenue'),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: _cardDeco(),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                NumberFormat.simpleCurrency().format(_revenue30d),
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
              ),
              const Text('Gross merchandise value across all completed orders.',
                  style: TextStyle(fontSize: 11, color: AppColors.muted)),
              const SizedBox(height: 12),
              SizedBox(height: 140, child: _revenueChart()),
            ]),
          ),
          const SizedBox(height: 16),
          _sectionTitle('Recent orders'),
          if (_recentOrders.isEmpty)
            _emptyRow('No orders yet.')
          else
            for (final o in _recentOrders) _orderTile(o),
        ]),
      );

  // ── Analytics ─────────────────────────────────────────────────────────
  Widget _analytics() => ListView(padding: const EdgeInsets.all(16), children: [
        _sectionTitle('Top verticals by supplier count'),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: _cardDeco(),
          child: _topVerticals.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                      child: Text('No supplier data yet.',
                          style: TextStyle(color: AppColors.muted))),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final v in _topVerticals) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(children: [
                          SizedBox(
                              width: 96,
                              child: Text(v.name,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700))),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: LinearProgressIndicator(
                                minHeight: 10,
                                value: _topVerticals.first.count == 0
                                    ? 0
                                    : v.count / _topVerticals.first.count,
                                backgroundColor: AppColors.mutedSurface,
                                valueColor: const AlwaysStoppedAnimation(
                                    AppColors.primary),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text('${v.count}',
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w800)),
                        ]),
                      ),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 16),
        _sectionTitle('Order volume (30d)'),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: _cardDeco(),
          child: SizedBox(height: 180, child: _revenueChart()),
        ),
      ]);

  // ── Moderation ────────────────────────────────────────────────────────
  Widget _moderation() =>
      ListView(padding: const EdgeInsets.all(16), children: [
        _sectionTitle('Pending KYC (${_pendingVerifs.length})'),
        if (_pendingVerifs.isEmpty)
          _emptyRow('Inbox zero — no verifications waiting.')
        else
          for (final v in _pendingVerifs)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: _cardDeco(),
              child: ListTile(
                leading: const Icon(LucideIcons.badgeCheck,
                    color: AppColors.warning),
                title: Text('${v['kind'] ?? 'verification'}'),
                subtitle: Text('${v['user_id']}'),
                trailing: Wrap(spacing: 4, children: [
                  IconButton(
                    tooltip: 'Approve',
                    onPressed: () => _moderate(v['id'] as String, 'approved'),
                    icon: const Icon(LucideIcons.check,
                        size: 18, color: AppColors.success),
                  ),
                  IconButton(
                    tooltip: 'Reject',
                    onPressed: () => _moderate(v['id'] as String, 'rejected'),
                    icon: const Icon(LucideIcons.x,
                        size: 18, color: AppColors.destructive),
                  ),
                ]),
              ),
            ),
        const SizedBox(height: 12),
        _sectionTitle('Queues'),
        for (final t in const [
          ('Reported listings', LucideIcons.flag),
          ('Withdrawal requests', LucideIcons.arrowDownToLine),
          ('Ad approvals', LucideIcons.megaphone),
          ('Refunds & disputes', LucideIcons.gavel),
        ])
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: _cardDeco(),
            child: ListTile(
              leading: Icon(t.$2),
              title: Text(t.$1),
              trailing: const Icon(LucideIcons.chevronRight,
                  size: 16, color: AppColors.muted),
            ),
          ),
      ]);

  Future<void> _moderate(String id, String status) async {
    try {
      await supabase
          .from('user_verifications')
          .update({'status': status}).eq('id', id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Marked $status')));
      setState(() {
        _pendingVerifs = _pendingVerifs.where((v) => v['id'] != id).toList();
        _counts['pending_verif'] = _pendingVerifs.length;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  // ── Widgets ───────────────────────────────────────────────────────────
  Widget _revenueChart() {
    if (_series.isEmpty) {
      return const Center(
          child: Text('No revenue data yet.',
              style: TextStyle(color: AppColors.muted)));
    }
    return LineChart(LineChartData(
      gridData: const FlGridData(show: false),
      titlesData: const FlTitlesData(show: false),
      borderData: FlBorderData(show: false),
      lineBarsData: [
        LineChartBarData(
          spots: [for (final p in _series) FlSpot(p.x, p.y)],
          isCurved: true,
          barWidth: 2.5,
          color: AppColors.primary,
          dotData: const FlDotData(show: false),
          belowBarData: BarAreaData(
            show: true,
            color: AppColors.primary.withOpacity(0.12),
          ),
        ),
      ],
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipItems: (spots) => spots
              .map((s) => LineTooltipItem(
                    '${_series[s.x.toInt()].label}\n${NumberFormat.simpleCurrency().format(s.y)}',
                    const TextStyle(color: Colors.white, fontSize: 11),
                  ))
              .toList(),
        ),
      ),
    ));
  }

  Widget _orderTile(Map<String, dynamic> o) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: _cardDeco(),
        child: ListTile(
          leading: const Icon(LucideIcons.shoppingBag),
          title: Text('Order · ${(o['id'] as String).substring(0, 8)}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          subtitle: Text('${o['status']} · ${o['created_at']?.toString().substring(0, 10) ?? ''}',
              style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          trailing: Text(
            NumberFormat.simpleCurrency()
                .format(((o['total'] as num?) ?? 0).toDouble()),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      );

  Widget _sectionTitle(String s) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(s,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
      );

  Widget _emptyRow(String s) => Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDeco(),
        child: Text(s, style: const TextStyle(color: AppColors.muted)),
      );

  BoxDecoration _cardDeco() => BoxDecoration(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.border));

  Widget _kpi(String label, String value, IconData icon, Color color) =>
      Container(
        padding: const EdgeInsets.all(14),
        decoration: _cardDeco(),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 22),
              Text(value,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w900)),
              Text(label,
                  style:
                      const TextStyle(fontSize: 11, color: AppColors.muted)),
            ]),
      );
}

class _DayPoint {
  const _DayPoint(this.x, this.y, this.label);
  final double x;
  final double y;
  final String label;
}

class _VerticalCount {
  const _VerticalCount(this.name, this.count);
  final String name;
  final int count;
}
