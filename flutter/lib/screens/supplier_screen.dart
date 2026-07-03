import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';
import '../widgets/masonry_grid.dart';
import '../widgets/skeletons.dart';
import 'auth_screen.dart';
import 'messages_screen.dart';
import 'rfq_screen.dart';

/// Mirrors `src/pages/Supplier.tsx` — public supplier storefront with banner,
/// verification badges, follow / contact / RFQ actions, stats card, and
/// tabbed content (Products, About).
class SupplierScreen extends StatefulWidget {
  const SupplierScreen({super.key, required this.supplierId});
  final String supplierId;

  @override
  State<SupplierScreen> createState() => _SupplierScreenState();
}

class _SupplierScreenState extends State<SupplierScreen> {
  Map<String, dynamic>? _supplier;
  List<Product> _products = const [];
  bool _loading = true;
  bool _following = false;
  int _followerCount = 0;
  String? _userId;
  String? _ownerId;
  String _tab = 'products';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final id = widget.supplierId;
      _userId = supabase.auth.currentUser?.id;

      final s = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
      final rows = await supabase
          .from('products')
          .select('*, suppliers!inner(name, verified, gold, country, location_address, latitude, longitude, trade_type)')
          .eq('supplier_id', id)
          .eq('active', true)
          .order('created_at', ascending: false)
          .limit(80);
      final followers = await supabase.from('followers').select('id').eq('supplier_id', id);
      Map<String, dynamic>? myFollow;
      if (_userId != null) {
        myFollow = await supabase
            .from('followers')
            .select('id')
            .eq('supplier_id', id)
            .eq('user_id', _userId as Object)
            .maybeSingle();
      }

      if (!mounted) return;
      setState(() {
        _supplier = s == null ? null : Map<String, dynamic>.from(s);
        _ownerId = _supplier?['owner_id'] as String?;
        _products = (rows as List).map((e) => Product.fromRow(Map<String, dynamic>.from(e))).toList();
        _followerCount = (followers as List).length;
        _following = myFollow != null;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleFollow() async {
    final id = widget.supplierId;
    if (_userId == null) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen()));
      return;
    }
    if (_following) {
      setState(() {
        _following = false;
        _followerCount = (_followerCount - 1).clamp(0, 1 << 30);
      });
      await supabase.from('followers').delete().eq('supplier_id', id).eq('user_id', _userId as Object);
    } else {
      setState(() {
        _following = true;
        _followerCount += 1;
      });
      await supabase.from('followers').insert({'supplier_id': id, 'user_id': _userId});
      if (_ownerId != null && _ownerId != _userId) {
        await supabase.from('notifications').insert({
          'user_id': _ownerId,
          'type': 'follower',
          'title': 'New follower',
          'body': 'Someone just followed your store.',
          'link': '/supplier/$id',
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return Scaffold(appBar: AppBar(), body: Skeletons.screen(SkeletonPreset.detail));
    final s = _supplier;
    if (s == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Supplier not found.', style: TextStyle(color: AppColors.muted))),
      );
    }
    final banner = (s['banner'] ?? '').toString();
    final logo = (s['logo'] ?? '').toString();
    final name = (s['name'] ?? '').toString();
    final country = (s['country'] ?? '').toString();
    final rating = (s['rating'] as num?)?.toDouble() ?? 0;
    final yearsActive = (s['years_active'] as num?)?.toInt() ?? 0;
    final responseRate = (s['response_rate'] as num?)?.toInt() ?? 0;
    final responseTime = (s['response_time'] ?? '—').toString();
    final onTime = (s['on_time_delivery'] as num?)?.toInt() ?? 0;
    final verified = s['verified'] == true;
    final gold = s['gold'] == true;
    final tradeAssured = s['trade_assurance'] == true;
    final about = (s['about'] ?? '').toString();
    final exportCountries = ((s['export_countries'] as List?) ?? const []).whereType<String>().toList();
    final countryCode = (s['country_code'] ?? '').toString();

    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverToBoxAdapter(
          child: SizedBox(
            height: 160,
            child: Stack(fit: StackFit.expand, children: [
              banner.isEmpty
                  ? Container(color: AppColors.mutedSurface)
                  : CachedNetworkImage(imageUrl: banner, fit: BoxFit.cover, errorWidget: (_, __, ___) => Container(color: AppColors.mutedSurface)),
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withOpacity(0.35), Colors.black.withOpacity(0.7)],
                  ),
                ),
              ),
              Positioned(
                top: MediaQuery.of(context).padding.top + 8,
                left: 12,
                right: 12,
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  _circleBtn(LucideIcons.arrowLeft, () => Navigator.of(context).maybePop()),
                  Row(children: [
                    _circleBtn(LucideIcons.share2, () {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Share — coming soon')));
                    }),
                    const SizedBox(width: 8),
                    _circleBtn(_following ? LucideIcons.heart : LucideIcons.heart, _toggleFollow,
                        active: _following),
                  ]),
                ]),
              ),
            ]),
          ),
        ),
        SliverToBoxAdapter(
          child: Transform.translate(
            offset: const Offset(0, -40),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 4),
                      boxShadow: const [BoxShadow(color: Color(0x1A000000), blurRadius: 12, offset: Offset(0, 4))],
                    ),
                    clipBehavior: Clip.hardEdge,
                    child: logo.isEmpty
                        ? const Icon(LucideIcons.store, size: 28)
                        : CachedNetworkImage(imageUrl: logo, fit: BoxFit.cover, errorWidget: (_, __, ___) => const Icon(LucideIcons.store, size: 28)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Wrap(spacing: 4, runSpacing: 4, children: [
                        if (verified) _badge(LucideIcons.shieldCheck, 'Verified', AppColors.primary),
                        if (gold) _badge(LucideIcons.award, 'Gold', const Color(0xFFB45309)),
                        if (tradeAssured) _badge(LucideIcons.shieldCheck, 'Trade Assured', const Color(0xFF047857)),
                      ]),
                    ),
                  ),
                ]),
                const SizedBox(height: 10),
                Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Wrap(spacing: 12, runSpacing: 4, children: [
                  _meta(LucideIcons.mapPin, country),
                  _meta(LucideIcons.calendar, '$yearsActive yrs on PUBSTORE'),
                  _meta(LucideIcons.star, rating.toStringAsFixed(1), amber: true),
                  _meta(LucideIcons.heart, '$_followerCount follower${_followerCount == 1 ? '' : 's'}'),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _primaryBtn(LucideIcons.messageCircle, 'Contact', () {
                    Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => MessagesScreen(supplierId: widget.supplierId),
                    ));
                  })),
                  const SizedBox(width: 8),
                  Expanded(child: _darkBtn(LucideIcons.fileText, 'RFQ', () {
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RfqScreen()));
                  })),
                  const SizedBox(width: 8),
                  Expanded(child: _followBtn()),
                ]),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(children: [
                    _stat(LucideIcons.messageCircle, '$responseRate%', 'Response'),
                    _stat(LucideIcons.clock, responseTime, 'Reply time'),
                    _stat(LucideIcons.truck, '$onTime%', 'On-time'),
                  ]),
                ),
              ]),
            ),
          ),
        ),
        SliverPersistentHeader(
          pinned: true,
          delegate: _TabsHeader(
            tab: _tab,
            productsCount: _products.length,
            onChanged: (t) => setState(() => _tab = t),
          ),
        ),
        if (_tab == 'products')
          _products.isEmpty
              ? const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(child: Text('No products listed yet.', style: TextStyle(color: AppColors.muted, fontSize: 13))),
                  ),
                )
              : SliverToBoxAdapter(child: MasonryProductGrid(products: _products))
        else
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _card('Company overview', LucideIcons.package,
                    Text(about.isEmpty ? 'No company description yet.' : about,
                        style: const TextStyle(fontSize: 12, color: AppColors.muted, height: 1.5))),
                const SizedBox(height: 12),
                _card('Business details', LucideIcons.clipboardCheck, Column(children: [
                  _row('Country / Region', countryCode.isEmpty ? country : '$country ($countryCode)'),
                  _row('Years active', '$yearsActive years'),
                  _row('Response rate', '$responseRate%'),
                  _row('Avg. reply time', responseTime),
                  _row('On-time delivery', '$onTime%'),
                  _row('Rating', '${rating.toStringAsFixed(1)} / 5'),
                  _row('Followers', '$_followerCount'),
                ])),
                if (exportCountries.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _card('Export countries', LucideIcons.globe, Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final c in exportCountries)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(999)),
                        child: Text(c, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      ),
                  ])),
                ],
              ]),
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ]),
    );
  }

  Widget _circleBtn(IconData icon, VoidCallback onTap, {bool active = false}) => Material(
        color: Colors.white.withOpacity(0.9),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: SizedBox(
            width: 36,
            height: 36,
            child: Icon(icon, size: 16, color: active ? Colors.redAccent : Colors.black87),
          ),
        ),
      );

  Widget _badge(IconData icon, String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 3),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
        ]),
      );

  Widget _meta(IconData icon, String text, {bool amber = false}) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 12, color: amber ? const Color(0xFFF59E0B) : AppColors.muted),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);

  Widget _stat(IconData icon, String value, String label) => Expanded(
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 12, color: AppColors.muted),
            const SizedBox(width: 4),
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.muted)),
        ]),
      );

  Widget _primaryBtn(IconData icon, String label, VoidCallback onTap) => SizedBox(
        height: 40,
        child: FilledButton.icon(onPressed: onTap, icon: Icon(icon, size: 14), label: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
      );

  Widget _darkBtn(IconData icon, String label, VoidCallback onTap) => SizedBox(
        height: 40,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white),
          onPressed: onTap,
          icon: Icon(icon, size: 14),
          label: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      );

  Widget _followBtn() => SizedBox(
        height: 40,
        child: OutlinedButton.icon(
          onPressed: _toggleFollow,
          style: OutlinedButton.styleFrom(
            side: BorderSide(color: _following ? Colors.redAccent : AppColors.border),
            foregroundColor: _following ? Colors.redAccent : AppColors.foreground,
            backgroundColor: _following ? Colors.redAccent.withOpacity(0.1) : null,
          ),
          icon: Icon(LucideIcons.heart, size: 14),
          label: Text(_following ? 'Following' : 'Follow', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      );

  Widget _card(String title, IconData icon, Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(AppRadii.md), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 14, color: AppColors.primary),
            const SizedBox(width: 6),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 8),
          child,
        ]),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          Text(value, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ]),
      );
}

class _TabsHeader extends SliverPersistentHeaderDelegate {
  _TabsHeader({required this.tab, required this.productsCount, required this.onChanged});
  final String tab;
  final int productsCount;
  final ValueChanged<String> onChanged;

  @override
  double get minExtent => 44;
  @override
  double get maxExtent => 44;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(children: [
        _btn('products', 'Products ($productsCount)'),
        _btn('about', 'About'),
      ]),
    );
  }

  Widget _btn(String key, String label) {
    final active = tab == key;
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: InkWell(
        onTap: () => onChanged(key),
        child: Container(
          height: 44,
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: active ? AppColors.primary : Colors.transparent, width: 2)),
          ),
          alignment: Alignment.center,
          child: Text(label,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: active ? AppColors.primary : AppColors.muted)),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _TabsHeader old) =>
      old.tab != tab || old.productsCount != productsCount;
}
