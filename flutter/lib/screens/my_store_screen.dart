import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';
import 'ads_dashboard_screen.dart';
import 'become_supplier_screen.dart';
import 'messages_screen.dart';
import 'store_actions_screen.dart';
import 'store_analytics_screen.dart';
import 'store_section_screen.dart';

/// Mirrors `src/pages/MyStore.tsx` — supplier dashboard with hero banner,
/// live-stream banner, KPI strip, quick actions, and grouped shortcuts
/// (Manage, Grow, Services & verticals, Storefront) plus a Go-Live modal.
class MyStoreScreen extends StatefulWidget {
  const MyStoreScreen({super.key});
  @override
  State<MyStoreScreen> createState() => _MyStoreScreenState();
}

class _MyStoreScreenState extends State<MyStoreScreen> {
  Map<String, dynamic>? _supplier;
  Map<String, dynamic>? _liveStream;
  int _productCount = 0;
  int _orderCount = 0;
  int _pending = 0;
  double _revenue = 0;
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
      final sup = await supabase
          .from('suppliers')
          .select('*')
          .eq('owner_id', uid)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();
      if (sup != null) {
        final sid = sup['id'];
        final orders = await supabase.from('orders').select('total,status').eq('supplier_id', sid);
        final list = (orders as List).map((o) => Map<String, dynamic>.from(o as Map)).toList();
        _orderCount = list.length;
        _revenue = list.fold<double>(0, (s, o) => s + ((o['total'] ?? 0) as num).toDouble());
        _pending = list.where((o) => o['status'] == 'placed' || o['status'] == 'processing').length;

        final products = await supabase.from('products').select('id').eq('supplier_id', sid);
        _productCount = (products as List).length;

        try {
          final ls = await supabase.from('live_streams').select('*').eq('supplier_id', sid).eq('status', 'live').maybeSingle();
          _liveStream = ls == null ? null : Map<String, dynamic>.from(ls);
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() { _supplier = sup == null ? null : Map<String, dynamic>.from(sup); _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load store: $e')));
    }
  }

  Future<void> _openGoLive() async {
    if (_supplier == null) return;
    final title = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _GoLiveSheet(),
    );
    if (title == null || title.trim().isEmpty) return;
    try {
      final row = await supabase.from('live_streams').insert({
        'supplier_id': _supplier!['id'],
        'title': title.trim(),
        'status': 'live',
        'viewer_count': 0,
      }).select().single();
      if (!mounted) return;
      setState(() => _liveStream = Map<String, dynamic>.from(row));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _endStream() async {
    if (_liveStream == null) return;
    try {
      await supabase.from('live_streams').update({'status': 'ended', 'ended_at': DateTime.now().toIso8601String()}).eq('id', _liveStream!['id']);
      setState(() => _liveStream = null);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(appBar: AppBar(title: const Text('My store')), body: Skeletons.list(count: 6));
    if (_supplier == null) return _empty();

    final s = _supplier!;
    final verticals = (s['verticals'] as List?)?.cast<String>() ?? const <String>[];
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        _hero(s),
        if (_liveStream != null) Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
          child: Transform.translate(
            offset: const Offset(0, -12),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.danger, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Container(width: 36, height: 36, decoration: BoxDecoration(color: Colors.white24, shape: BoxShape.circle),
                    child: const Icon(LucideIcons.radio, color: Colors.white, size: 16)),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text("YOU'RE LIVE", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1)),
                  Text('${_liveStream!['title']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white)),
                ])),
                TextButton.icon(onPressed: _endStream,
                    style: TextButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.danger, padding: const EdgeInsets.symmetric(horizontal: 10)),
                    icon: const Icon(Icons.stop_circle_outlined, size: 14), label: const Text('End', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900))),
              ]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: Row(children: [
            _stat('Products', '$_productCount'),
            const SizedBox(width: 8),
            _stat('Orders', '$_orderCount'),
            const SizedBox(width: 8),
            _stat('Revenue', '\$${_revenue.toStringAsFixed(0)}'),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: Text('QUICK ACTIONS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.muted, letterSpacing: 1)),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            _quick(LucideIcons.plus, 'Add product', () => _go(const StoreSectionScreen(section: 'products/new'))),
            const SizedBox(width: 8),
            _quick(_liveStream != null ? LucideIcons.radio : LucideIcons.video, _liveStream != null ? 'Live now' : 'Go live', _openGoLive, danger: _liveStream != null),
            const SizedBox(width: 8),
            _quick(LucideIcons.megaphone, 'Promote', () => _go(const StoreSectionScreen(section: 'promote'))),
            const SizedBox(width: 8),
            _quick(LucideIcons.barChart3, 'Analytics', () => _go(const StoreAnalyticsScreen())),
          ]),
        ),
        _section('Manage', [
          _row(LucideIcons.package, 'Products', '$_productCount listed', () => _go(const StoreSectionScreen(section: 'products'))),
          _row(LucideIcons.shoppingBag, 'Orders', _pending > 0 ? '$_pending pending' : 'View store orders', () => _go(const StoreSectionScreen(section: 'orders'))),
          _row(LucideIcons.inbox, 'Actions inbox', 'Bookings, RFQs, applications', () => _go(const StoreActionsScreen())),
          _row(LucideIcons.truck, 'Shipping & logistics', 'Templates, carriers', () => _go(const StoreSectionScreen(section: 'shipping'))),
          _row(LucideIcons.messageCircle, 'Customer messages', 'Buyer chats', () => _go(const MessagesScreen())),
        ]),
        _section('Grow', [
          _row(LucideIcons.megaphone, 'PUBSTORE Ads', 'Banner, feed, full-screen & rewarded reels', () => _go(const AdsDashboardScreen())),
          _row(LucideIcons.tag, 'Promotions & coupons', 'Boost sales', () => _go(const StoreSectionScreen(section: 'promote'))),
          _row(LucideIcons.barChart3, 'Analytics & insights', 'Traffic, conversion', () => _go(const StoreAnalyticsScreen())),
          _row(LucideIcons.star, 'Reviews', 'Buyer feedback', () => _go(const StoreSectionScreen(section: 'reviews'))),
        ]),
        _section('Services & verticals', _verticalRows(verticals)),
        _section('Storefront', [
          _row(LucideIcons.store, 'Store profile', 'Banner, logo, about', () => _go(const StoreSectionScreen(section: 'profile'))),
          _row(LucideIcons.settings, 'Store settings', 'Payouts, taxes', () => _go(const StoreSectionScreen(section: 'settings'))),
        ]),
        const SizedBox(height: 24),
      ]),
    );
  }

  Widget _empty() => Scaffold(
        appBar: AppBar(title: const Text('My store')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.store, size: 48, color: AppColors.muted),
              const SizedBox(height: 12),
              const Text("You don't have a store yet", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 6),
              const Text('Create your supplier store to start listing products and selling on PUBSTORE.',
                  textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 13)),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () async {
                  final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const BecomeSupplierScreen()));
                  if (ok == true) _load();
                },
                icon: const Icon(LucideIcons.plus, size: 14),
                label: const Text('Create my store'),
              ),
            ]),
          ),
        ),
      );

  Widget _hero(Map<String, dynamic> s) {
    final banner = s['banner'] as String?;
    final logo = s['logo'] as String?;
    return SizedBox(
      height: 176,
      child: Stack(children: [
        Positioned.fill(
          child: banner != null && banner != '/placeholder.svg'
              ? Image.network(banner, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const ColoredBox(color: AppColors.mutedSurface))
              : const ColoredBox(color: AppColors.mutedSurface),
        ),
        Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.foreground.withOpacity(0.7), AppColors.foreground.withOpacity(0.2), Colors.transparent],
                begin: Alignment.bottomCenter, end: Alignment.topCenter,
              ),
            ),
          ),
        ),
        Positioned(top: 8, left: 8, child: SafeArea(
          child: CircleAvatar(backgroundColor: Colors.white70,
              child: IconButton(icon: const Icon(LucideIcons.arrowLeft, color: AppColors.foreground, size: 18), onPressed: () => Navigator.of(context).maybePop())),
        )),
        Positioned(left: 12, right: 12, bottom: 12, child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Container(width: 60, height: 60, clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white, width: 2)),
              child: logo != null && logo != '/placeholder.svg' ? Image.network(logo, fit: BoxFit.cover) : const Icon(LucideIcons.image, color: AppColors.muted)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${s['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white)),
            Row(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(4)),
                  child: Text((s['verified'] ?? false) as bool ? 'Verified' : 'New seller', style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w800))),
              if ((s['country'] ?? '') != '') Padding(padding: const EdgeInsets.only(left: 6),
                  child: Text('· ${s['country']}', style: const TextStyle(fontSize: 11, color: Colors.white70))),
            ]),
          ])),
          TextButton(onPressed: () => _go(const StoreSectionScreen(section: 'profile')),
              style: TextButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 12)),
              child: const Text('Edit', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
        ])),
      ]),
    );
  }

  Widget _stat(String label, String value) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(14)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.muted, letterSpacing: 1)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          ]),
        ),
      );

  Widget _quick(IconData icon, String label, VoidCallback onTap, {bool danger = false}) => Expanded(
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: danger ? AppColors.danger : AppColors.card,
              border: Border.all(color: danger ? AppColors.danger : AppColors.border),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(color: danger ? Colors.white24 : AppColors.primary, borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 16, color: Colors.white),
              ),
              const SizedBox(height: 6),
              Text(label, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: danger ? Colors.white : AppColors.foreground)),
            ]),
          ),
        ),
      );

  Widget _section(String title, List<Widget> rows) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.only(bottom: 6, left: 2),
              child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.muted, letterSpacing: 1))),
          Container(
            decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
            clipBehavior: Clip.antiAlias,
            child: Column(children: [
              for (int i = 0; i < rows.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: 56),
                rows[i],
              ],
            ]),
          ),
        ]),
      );

  Widget _row(IconData icon, String label, String hint, VoidCallback onTap) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 16, color: AppColors.primary)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              Text(hint, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            ])),
            const Icon(LucideIcons.chevronRight, size: 14, color: AppColors.muted),
          ]),
        ),
      );

  List<Widget> _verticalRows(List<String> offers) {
    bool wants(String slug) => offers.isEmpty || offers.contains(slug);
    final rows = <Widget>[];
    if (wants('restaurants')) rows.add(_row(LucideIcons.utensilsCrossed, 'Restaurants & food', 'Menus, delivery, tables', () => _go(const StoreSectionScreen(section: 'services/restaurants'))));
    if (wants('agro')) rows.add(_row(LucideIcons.sprout, 'Agro listings', 'Produce, machinery, livestock', () => _go(const StoreSectionScreen(section: 'services/agro'))));
    if (wants('stays')) rows.add(_row(LucideIcons.bedDouble, 'Stays & B&B', 'Rooms, hotels, factory tours', () => _go(const StoreSectionScreen(section: 'services/stays'))));
    if (wants('vehicles')) rows.add(_row(LucideIcons.car, 'Vehicles', 'Cars, EVs, trucks, bikes', () => _go(const StoreSectionScreen(section: 'services/vehicles'))));
    if (wants('industrial')) rows.add(_row(LucideIcons.factory, 'Industrial listings', 'Machinery, materials', () => _go(const StoreSectionScreen(section: 'services/industrial'))));
    if (wants('rides')) rows.add(_row(LucideIcons.navigation, 'Ride driver', 'Register your car', () => _go(const StoreSectionScreen(section: 'services/driver'))));
    if (wants('services')) rows.add(_row(LucideIcons.wrench, 'Local services', 'Plumbing, tutoring, freelance', () => _go(const StoreSectionScreen(section: 'services/pros'))));
    if (wants('properties')) rows.add(_row(LucideIcons.home, 'Real estate', 'Rent or sell property', () => _go(const StoreSectionScreen(section: 'services/properties'))));
    if (wants('shop')) rows.add(_row(LucideIcons.truck, 'Courier / logistics', 'Deliveries, freight', () => _go(const StoreSectionScreen(section: 'services/logistics'))));
    if (wants('finance')) rows.add(_row(LucideIcons.banknote, 'Finance products', 'Loans, insurance', () => _go(const StoreSectionScreen(section: 'services/finance'))));
    if (wants('car_rentals')) rows.add(_row(LucideIcons.car, 'Car rentals', 'Self-drive listings', () => _go(const StoreSectionScreen(section: 'services/car-rentals'))));
    if (rows.isEmpty) rows.add(_row(LucideIcons.sparkles, 'Change what you provide', 'Add verticals to unlock services', () => _go(const StoreSectionScreen(section: 'profile'))));
    return rows;
  }

  void _go(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen)).then((_) => _load());
  }
}

class _GoLiveSheet extends StatefulWidget {
  const _GoLiveSheet();
  @override
  State<_GoLiveSheet> createState() => _GoLiveSheetState();
}

class _GoLiveSheetState extends State<_GoLiveSheet> {
  final _ctl = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(color: AppColors.danger.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(LucideIcons.radio, color: AppColors.danger, size: 18)),
            const SizedBox(width: 12),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
              Text('Go live', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              Text('Start a live stream for your store', style: TextStyle(fontSize: 11, color: AppColors.muted)),
            ]),
          ]),
          const SizedBox(height: 14),
          TextField(
            controller: _ctl,
            autofocus: true,
            decoration: const InputDecoration(hintText: 'Stream title (e.g. Factory tour, Q&A)', border: OutlineInputBorder()),
            onSubmitted: (v) => Navigator.of(context).pop(v),
          ),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).pop(), style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(44)), child: const Text('Cancel'))),
            const SizedBox(width: 10),
            Expanded(child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pop(_ctl.text),
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(44), backgroundColor: AppColors.danger),
              icon: const Icon(LucideIcons.radio, size: 14),
              label: const Text('Go live', style: TextStyle(fontWeight: FontWeight.w900)),
            )),
          ]),
        ]),
      ),
    );
  }
}
