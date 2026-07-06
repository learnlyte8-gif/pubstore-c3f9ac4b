import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Admin.tsx` — platform admin console with full parity:
/// Overview, Analytics, Moderation (KYC), Top-ups, Withdrawals, Trade
/// Assurance, Reviews, and Platform Settings. Gated by has_role(uid,'admin').
class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen>
    with SingleTickerProviderStateMixin {
  bool _loading = true;
  bool _isAdmin = false;
  late final TabController _tabs = TabController(length: 8, vsync: this);

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
        title: const Text('Platform Admin'),
        bottom: TabBar(
          controller: _tabs,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Analytics'),
            Tab(text: 'KYC'),
            Tab(text: 'Top-ups'),
            Tab(text: 'Withdrawals'),
            Tab(text: 'Assurance'),
            Tab(text: 'Reviews'),
            Tab(text: 'Settings'),
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
        children: const [
          _OverviewTabWrapper(),
          _AnalyticsTabWrapper(),
          _ModerationTabWrapper(),
          _TopupsPanel(),
          _WithdrawalsPanel(),
          _AssurancePanel(),
          _ReviewsPanel(),
          _PlatformSettingsPanel(),
        ]
            .asMap()
            .entries
            .map((e) => e.key < 3 ? _localTab(e.key) : e.value)
            .toList(),
      ),
    );
  }

  Widget _localTab(int i) {
    switch (i) {
      case 0:
        return _overview();
      case 1:
        return _analytics();
      case 2:
        return _moderation();
    }
    return const SizedBox.shrink();
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
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                NumberFormat.simpleCurrency().format(_revenue30d),
                style:
                    const TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
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

  // ── KYC / Moderation ──────────────────────────────────────────────────
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
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          subtitle: Text(
              '${o['status']} · ${o['created_at']?.toString().substring(0, 10) ?? ''}',
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
                  style: const TextStyle(fontSize: 11, color: AppColors.muted)),
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

// Unused wrappers so TabBarView children list matches TabBar length above.
class _OverviewTabWrapper extends StatelessWidget {
  const _OverviewTabWrapper();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _AnalyticsTabWrapper extends StatelessWidget {
  const _AnalyticsTabWrapper();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _ModerationTabWrapper extends StatelessWidget {
  const _ModerationTabWrapper();
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

// ─────────────────────────────────────────────────────────────────────────
// Manual Top-ups
// ─────────────────────────────────────────────────────────────────────────
class _TopupsPanel extends StatefulWidget {
  const _TopupsPanel();
  @override
  State<_TopupsPanel> createState() => _TopupsPanelState();
}

class _TopupsPanelState extends State<_TopupsPanel> {
  String _filter = 'pending';
  bool _loading = true;
  String? _busy;
  List<Map<String, dynamic>> _rows = const [];
  Map<String, Map<String, dynamic>> _profiles = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      var q = supabase
          .from('manual_topups')
          .select('*')
          .order('created_at', ascending: false)
          .limit(200);
      final data = _filter == 'all'
          ? await q
          : await supabase
              .from('manual_topups')
              .select('*')
              .eq('status', _filter)
              .order('created_at', ascending: false)
              .limit(200);
      final rows = List<Map<String, dynamic>>.from(data as List);
      final ids = rows.map((r) => r['user_id']).whereType<String>().toSet();
      Map<String, Map<String, dynamic>> pm = {};
      if (ids.isNotEmpty) {
        final profs = await supabase
            .from('profiles')
            .select('user_id,display_name,username')
            .inFilter('user_id', ids.toList());
        for (final p in (profs as List)) {
          pm[p['user_id'] as String] = Map<String, dynamic>.from(p);
        }
      }
      _rows = rows;
      _profiles = pm;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _approve(String id) async {
    setState(() => _busy = id);
    try {
      await supabase
          .rpc('approve_manual_topup', params: {'_id': id, '_admin_note': null});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Top-up approved & credited')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
    setState(() => _busy = null);
  }

  Future<void> _decline(String id) async {
    final reason = await _promptReason(context, 'Reason for declining');
    setState(() => _busy = id);
    try {
      await supabase.rpc('decline_manual_topup',
          params: {'_id': id, '_admin_note': reason});
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Top-up declined')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
    setState(() => _busy = null);
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _FilterRow(
              filter: _filter,
              onChange: (v) {
                setState(() => _filter = v);
                _load();
              },
              onRefresh: _load),
          if (_loading)
            const Skeletons.list(count: 3)
          else if (_rows.isEmpty)
            const _Empty(label: 'No top-ups in this view')
          else
            for (final r in _rows) _tile(r),
        ],
      );

  Widget _tile(Map<String, dynamic> r) {
    final p = _profiles[r['user_id']];
    final id = r['id'] as String;
    final status = r['status'] as String? ?? 'pending';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: _cardDeco(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10)),
            child: const Icon(LucideIcons.creditCard,
                size: 16, color: AppColors.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(
                    p?['display_name'] ??
                        p?['username'] ??
                        (r['user_id'] as String).substring(0, 8),
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800)),
                Text(
                    'Ref ${r['reference'] ?? '-'} · ${r['created_at']?.toString().substring(0, 16) ?? ''}',
                    style:
                        const TextStyle(fontSize: 11, color: AppColors.muted)),
              ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(_fmtMoney(r['amount']),
                style: const TextStyle(fontWeight: FontWeight.w900)),
            _StatusBadge(status),
          ]),
        ]),
        if ((r['note'] ?? '').toString().isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(r['note'],
                  style:
                      const TextStyle(fontSize: 11, color: AppColors.muted))),
        if (status == 'pending')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(children: [
              Expanded(
                  child: OutlinedButton.icon(
                      onPressed: _busy == id ? null : () => _decline(id),
                      icon: const Icon(LucideIcons.x, size: 14),
                      label: const Text('Decline'))),
              const SizedBox(width: 8),
              Expanded(
                  child: FilledButton.icon(
                      onPressed: _busy == id ? null : () => _approve(id),
                      icon: const Icon(LucideIcons.check, size: 14),
                      label: const Text('Approve'))),
            ]),
          )
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Withdrawals
// ─────────────────────────────────────────────────────────────────────────
class _WithdrawalsPanel extends StatefulWidget {
  const _WithdrawalsPanel();
  @override
  State<_WithdrawalsPanel> createState() => _WithdrawalsPanelState();
}

class _WithdrawalsPanelState extends State<_WithdrawalsPanel> {
  String _filter = 'pending';
  bool _loading = true;
  String? _busy;
  List<Map<String, dynamic>> _rows = const [];
  Map<String, Map<String, dynamic>> _profiles = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = _filter == 'all'
          ? await supabase
              .from('withdrawal_requests')
              .select('*')
              .order('created_at', ascending: false)
              .limit(200)
          : await supabase
              .from('withdrawal_requests')
              .select('*')
              .eq('status', _filter)
              .order('created_at', ascending: false)
              .limit(200);
      final rows = List<Map<String, dynamic>>.from(data as List);
      final ids = rows.map((r) => r['user_id']).whereType<String>().toSet();
      Map<String, Map<String, dynamic>> pm = {};
      if (ids.isNotEmpty) {
        final profs = await supabase
            .from('profiles')
            .select('user_id,display_name,username')
            .inFilter('user_id', ids.toList());
        for (final p in (profs as List)) {
          pm[p['user_id'] as String] = Map<String, dynamic>.from(p);
        }
      }
      _rows = rows;
      _profiles = pm;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _approve(String id) async {
    setState(() => _busy = id);
    try {
      await supabase.rpc('approve_withdrawal_request',
          params: {'_id': id, '_admin_note': null});
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Withdrawal approved')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
    setState(() => _busy = null);
  }

  Future<void> _decline(String id) async {
    final reason = await _promptReason(
        context, 'Reason for declining (refunds held funds)');
    setState(() => _busy = id);
    try {
      await supabase.rpc('decline_withdrawal_request',
          params: {'_id': id, '_admin_note': reason});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Withdrawal declined & refunded')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
    setState(() => _busy = null);
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _FilterRow(
              filter: _filter,
              onChange: (v) {
                setState(() => _filter = v);
                _load();
              },
              onRefresh: _load),
          if (_loading)
            const Skeletons.list(count: 3)
          else if (_rows.isEmpty)
            const _Empty(label: 'No withdrawals in this view')
          else
            for (final r in _rows) _tile(r),
        ],
      );

  Widget _tile(Map<String, dynamic> r) {
    final p = _profiles[r['user_id']];
    final id = r['id'] as String;
    final status = r['status'] as String? ?? 'pending';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: _cardDeco(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.15),
                borderRadius: BorderRadius.circular(10)),
            child: const Icon(LucideIcons.banknote,
                size: 16, color: AppColors.warning),
          ),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(
                    p?['display_name'] ??
                        p?['username'] ??
                        (r['user_id'] as String).substring(0, 8),
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w800)),
                Text('${r['method'] ?? ''} · ${r['destination'] ?? ''}',
                    style:
                        const TextStyle(fontSize: 11, color: AppColors.muted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                Text(
                    '${r['created_at']?.toString().substring(0, 16) ?? ''} · ${r['account'] ?? 'personal'}',
                    style:
                        const TextStyle(fontSize: 10, color: AppColors.muted)),
              ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(_fmtMoney(r['amount']),
                style: const TextStyle(fontWeight: FontWeight.w900)),
            _StatusBadge(status),
          ]),
        ]),
        if ((r['notes'] ?? '').toString().isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('User: ${r['notes']}',
                  style:
                      const TextStyle(fontSize: 11, color: AppColors.muted))),
        if ((r['admin_note'] ?? '').toString().isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Admin: ${r['admin_note']}',
                  style: const TextStyle(
                      fontSize: 11, fontStyle: FontStyle.italic))),
        if (status == 'pending')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(children: [
              Expanded(
                  child: OutlinedButton.icon(
                      onPressed: _busy == id ? null : () => _decline(id),
                      icon: const Icon(LucideIcons.x, size: 14),
                      label: const Text('Decline'))),
              const SizedBox(width: 8),
              Expanded(
                  child: FilledButton.icon(
                      onPressed: _busy == id ? null : () => _approve(id),
                      icon: const Icon(LucideIcons.check, size: 14),
                      label: const Text('Approve'))),
            ]),
          ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Trade Assurance (product_inquiries)
// ─────────────────────────────────────────────────────────────────────────
class _AssurancePanel extends StatefulWidget {
  const _AssurancePanel();
  @override
  State<_AssurancePanel> createState() => _AssurancePanelState();
}

class _AssurancePanelState extends State<_AssurancePanel> {
  String _filter = 'pending';
  bool _loading = true;
  List<Map<String, dynamic>> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = _filter == 'all'
          ? await supabase
              .from('product_inquiries')
              .select('*')
              .order('created_at', ascending: false)
              .limit(200)
          : await supabase
              .from('product_inquiries')
              .select('*')
              .eq('status', _filter)
              .order('created_at', ascending: false)
              .limit(200);
      _rows = List<Map<String, dynamic>>.from(data as List);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _remove(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete inquiry?'),
        content: const Text('Remove this inquiry (e.g. fraudulent)?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await supabase.from('product_inquiries').delete().eq('id', id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Inquiry removed')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _FilterRow(
              filter: _filter,
              onChange: (v) {
                setState(() => _filter = v);
                _load();
              },
              onRefresh: _load),
          if (_loading)
            const Skeletons.list(count: 3)
          else if (_rows.isEmpty)
            const _Empty(label: 'No inquiries')
          else
            for (final r in _rows)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: _cardDeco(),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                              color: AppColors.success.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(10)),
                          child: const Icon(LucideIcons.shieldCheck,
                              size: 16, color: AppColors.success),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    r['product_title'] ?? 'Product inquiry',
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                                Text(
                                    'Buyer ${'${r['buyer_id']}'.substring(0, 8)} → Supplier ${'${r['supplier_id']}'.substring(0, 8)}',
                                    style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.muted)),
                                Text(
                                    r['created_at']
                                            ?.toString()
                                            .substring(0, 16) ??
                                        '',
                                    style: const TextStyle(
                                        fontSize: 10,
                                        color: AppColors.muted)),
                              ]),
                        ),
                        _StatusBadge(r['status'] as String? ?? 'pending'),
                      ]),
                      if ((r['message'] ?? '').toString().isNotEmpty)
                        Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(r['message'],
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.muted))),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: () => _remove(r['id'] as String),
                          icon: const Icon(LucideIcons.x, size: 14),
                          label: const Text('Remove'),
                        ),
                      ),
                    ]),
              ),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────
class _ReviewsPanel extends StatefulWidget {
  const _ReviewsPanel();
  @override
  State<_ReviewsPanel> createState() => _ReviewsPanelState();
}

class _ReviewsPanelState extends State<_ReviewsPanel> {
  bool _loading = true;
  List<Map<String, dynamic>> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await supabase
          .from('reviews')
          .select('*')
          .order('created_at', ascending: false)
          .limit(200);
      _rows = List<Map<String, dynamic>>.from(data as List);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _remove(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete review?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await supabase.from('reviews').delete().eq('id', id);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Review removed')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                  onPressed: _load,
                  icon: const Icon(LucideIcons.refreshCw, size: 12),
                  label: const Text('Refresh'))),
          if (_loading)
            const Skeletons.list(count: 3)
          else if (_rows.isEmpty)
            const _Empty(label: 'No reviews')
          else
            for (final r in _rows)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: _cardDeco(),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                          color: Colors.amber.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10)),
                      child: const Icon(LucideIcons.star,
                          size: 16, color: Colors.amber),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(_stars(((r['rating'] as num?) ?? 0).toDouble()),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  color: Colors.amber)),
                          if ((r['title'] ?? '').toString().isNotEmpty)
                            Text(r['title'],
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w700)),
                          if ((r['body'] ?? '').toString().isNotEmpty)
                            Text(r['body'],
                                style: const TextStyle(
                                    fontSize: 12, color: AppColors.muted)),
                          Text(
                              'Product ${'${r['product_id']}'.substring(0, 8)} · User ${'${r['user_id']}'.substring(0, 8)}',
                              style: const TextStyle(
                                  fontSize: 10, color: AppColors.muted)),
                        ])),
                    IconButton(
                        onPressed: () => _remove(r['id'] as String),
                        icon: const Icon(LucideIcons.x, size: 16)),
                  ],
                ),
              ),
        ],
      );

  String _stars(double n) {
    final k = n.round();
    return '★' * k + '☆' * (5 - k);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Platform Settings (manual EcoCash top-up)
// ─────────────────────────────────────────────────────────────────────────
class _PlatformSettingsPanel extends StatefulWidget {
  const _PlatformSettingsPanel();
  @override
  State<_PlatformSettingsPanel> createState() => _PlatformSettingsPanelState();
}

class _PlatformSettingsPanelState extends State<_PlatformSettingsPanel> {
  final _number = TextEditingController();
  final _name = TextEditingController();
  final _instructions = TextEditingController();
  bool _enabled = true;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _number.dispose();
    _name.dispose();
    _instructions.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final row = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'manual_topup')
          .maybeSingle();
      final v = (row?['value'] as Map?) ?? const {};
      _number.text = (v['number'] ?? '').toString();
      _name.text = (v['name'] ?? '').toString();
      _instructions.text = (v['instructions'] ?? '').toString();
      _enabled = v['enabled'] != false;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await supabase.from('platform_settings').upsert({
        'key': 'manual_topup',
        'value': {
          'enabled': _enabled,
          'number': _number.text.trim(),
          'name': _name.text.trim(),
          'instructions': _instructions.text.trim(),
        },
        'updated_at': DateTime.now().toIso8601String(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Saved')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$e')));
    }
    setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const _Empty(label: 'Loading…');
    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDeco(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Manual EcoCash top-up',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          const Text(
              "Users send EcoCash to this number to top up PUBSTORE Pay. You'll review references and approve.",
              style: TextStyle(fontSize: 11, color: AppColors.muted)),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Enabled',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            value: _enabled,
            onChanged: (v) => setState(() => _enabled = v),
          ),
          const SizedBox(height: 4),
          _label('EcoCash number'),
          TextField(
              controller: _number,
              decoration:
                  const InputDecoration(hintText: 'e.g. 0771234567')),
          const SizedBox(height: 10),
          _label('Account name'),
          TextField(
              controller: _name,
              decoration: const InputDecoration(hintText: 'PUBSTORE')),
          const SizedBox(height: 10),
          _label('Instructions to users'),
          TextField(
              controller: _instructions,
              maxLines: 4,
              decoration: const InputDecoration()),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: const Icon(LucideIcons.save, size: 14),
            label: Text(_saving ? 'Saving…' : 'Save'),
          ),
        ]),
      ),
    ]);
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(t.toUpperCase(),
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: AppColors.muted,
                letterSpacing: 0.5)),
      );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────
BoxDecoration _cardDeco() => BoxDecoration(
    color: AppColors.card,
    borderRadius: BorderRadius.circular(14),
    border: Border.all(color: AppColors.border));

String _fmtMoney(dynamic n) =>
    NumberFormat.simpleCurrency().format(((n as num?) ?? 0).toDouble());

Future<String?> _promptReason(BuildContext context, String title) async {
  final ctrl = TextEditingController();
  return showDialog<String?>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(title),
      content: TextField(
          controller: ctrl,
          maxLines: 3,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Optional')),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, null),
            child: const Text('Cancel')),
        FilledButton(
            onPressed: () => Navigator.pop(
                context, ctrl.text.trim().isEmpty ? null : ctrl.text.trim()),
            child: const Text('Confirm')),
      ],
    ),
  );
}

class _FilterRow extends StatelessWidget {
  final String filter;
  final ValueChanged<String> onChange;
  final VoidCallback onRefresh;
  const _FilterRow(
      {required this.filter, required this.onChange, required this.onRefresh});
  @override
  Widget build(BuildContext context) {
    const opts = ['pending', 'approved', 'declined', 'all'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
                children: opts
                    .map((o) => Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label:
                                Text(o[0].toUpperCase() + o.substring(1)),
                            selected: filter == o,
                            onSelected: (_) => onChange(o),
                          ),
                        ))
                    .toList()),
          ),
        ),
        TextButton.icon(
            onPressed: onRefresh,
            icon: const Icon(LucideIcons.refreshCw, size: 12),
            label: const Text('Refresh')),
      ]),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge(this.status);
  @override
  Widget build(BuildContext context) {
    Color c;
    switch (status) {
      case 'approved':
        c = AppColors.success;
        break;
      case 'declined':
        c = AppColors.destructive;
        break;
      default:
        c = AppColors.warning;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
          color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
      child: Text(status[0].toUpperCase() + status.substring(1),
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w800, color: c)),
    );
  }
}

class _Empty extends StatelessWidget {
  final String label;
  const _Empty({required this.label});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
            child: Text(label,
                style: const TextStyle(color: AppColors.muted, fontSize: 13))),
      );
}
