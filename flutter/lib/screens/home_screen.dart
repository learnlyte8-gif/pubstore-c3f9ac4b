import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/catalog_service.dart';
import '../services/cart_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/masonry_grid.dart';
import '../widgets/product_card.dart';
import '../widgets/skeletons.dart';
import 'product_detail_screen.dart';
import 'jobs_screen.dart';
import 'rides_screen.dart';
import 'services_screen.dart';
import 'properties_screen.dart';
import 'logistics_screen.dart';
import 'finance_screen.dart';
import 'news_screen.dart';
import 'stays_screen.dart';
import 'auto_screen.dart';
import 'industrial_screen.dart';
import 'agro_screen.dart';
import 'rfq_screen.dart';
import 'orders_screen.dart';
import 'compare_screen.dart';
import 'wallet_screen.dart';
import 'profile_screen.dart';


/// Home feed — infinite-scrolling staggered grid backed by
/// `products` on Lovable Cloud. Same shape as `src/pages/Home.tsx`.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({
    super.key,
    this.feed = 'home',
    this.categoryId,
    this.categoryName,
  });

  final String feed;
  final String? categoryId;
  final String? categoryName;

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _scroll = ScrollController();
  final List<Product> _products = [];
  int _page = 0;
  bool _loading = false;
  bool _done = false;
  Object? _error;

  String get _sortBy => widget.feed == 'fyp' ? 'rating' : 'newest';

  List<String>? _followedSupplierIds;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _scroll.addListener(() {
      if (_scroll.position.pixels >=
          _scroll.position.maxScrollExtent - 400) {
        _loadMore();
      }
    });
  }

  Future<void> _bootstrap() async {
    if (widget.feed == 'following') {
      await _loadFollowing();
    }
    await _loadMore();
  }

  Future<void> _loadFollowing() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      _followedSupplierIds = const [];
      return;
    }
    try {
      final rows = await supabase
          .from('followers')
          .select('supplier_id')
          .eq('user_id', uid);
      _followedSupplierIds =
          (rows as List).map((r) => r['supplier_id'] as String).toList();
    } catch (_) {
      _followedSupplierIds = const [];
    }
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.feed != widget.feed || oldWidget.categoryId != widget.categoryId) {
      _refresh();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadMore() async {
    if (_loading || _done) return;
    // Following tab with zero follows → nothing to load.
    if (widget.feed == 'following' && (_followedSupplierIds?.isEmpty ?? false)) {
      setState(() => _done = true);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      List<Product> batch;
      if (widget.feed == 'following' && (_followedSupplierIds?.isNotEmpty ?? false)) {
        final from = _page * 30;
        final to = from + 29;
        final rows = await supabase
            .from('products')
            .select('id, supplier_id, title, image, gallery, price, original_price, '
                'category_slug, badge, free_shipping, moq, unit, lead_time, ship_from, '
                'rating, review_count, sold, deal_ends_at, '
                'suppliers!inner(name, verified, gold, country, location_address, latitude, longitude, trade_type)')
            .eq('active', true)
            .inFilter('supplier_id', _followedSupplierIds!)
            .order('created_at', ascending: false)
            .range(from, to);
        batch = (rows as List)
            .map((r) => Product.fromRow(r as Map<String, dynamic>))
            .toList();
      } else {
        batch = await catalog.fetchProducts(
          page: _page,
          pageSize: 30,
          category: widget.categoryId,
          sortBy: _sortBy,
        );
      }
      setState(() {
        _products.addAll(batch);
        _page += 1;
        _done = batch.length < 30;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _products.clear();
      _page = 0;
      _done = false;
    });
    if (widget.feed == 'following') await _loadFollowing();
    await _loadMore();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
        onRefresh: _refresh,
        child: _products.isEmpty && _loading
            ? Skeletons.screen(SkeletonPreset.feed)
            : _products.isEmpty && _error != null
                ? _ErrorRetry(error: _error!, onRetry: _loadMore)
                : CustomScrollView(
                    controller: _scroll,
                    slivers: [
                      if (widget.categoryId == null && widget.feed == 'home') ...[
                        SliverToBoxAdapter(child: _Promo3DCarousel()),
                        SliverToBoxAdapter(child: _HomeMenuButton()),


                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                            child: _SectionHeader(
                              icon: LucideIcons.heart,
                              title: 'Because you browsed',
                              subtitle: 'Picked from your recent activity',
                            ),
                          ),
                        ),
                        SliverToBoxAdapter(child: _RecommendationStrip(onTap: _openProduct)),
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                            child: _SectionHeader(
                              icon: LucideIcons.sparkles,
                              title: 'New arrivals',
                              subtitle: 'Latest products from suppliers',
                            ),
                          ),
                        ),
                        SliverToBoxAdapter(child: _NewArrivalsStrip(onTap: _openProduct)),
                      ],
                      if (widget.categoryId != null || widget.feed != 'home')
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                            child: _FeedHeading(
                              title: widget.categoryName ?? (widget.feed == 'fyp' ? 'For you' : 'Following'),
                              subtitle: widget.categoryId != null
                                  ? '${_products.length} products'
                                  : widget.feed == 'fyp'
                                      ? 'Personalized picks based on your interests'
                                      : 'Newest products from stores you follow',
                            ),
                          ),
                        ),
                      if (widget.categoryId != null)
                        SliverToBoxAdapter(
                          child: _SubcategoryChips(
                            products: _products,
                            active: null,
                            onChanged: (_) {},
                          ),
                        ),
                      if (widget.categoryId == null && widget.feed == 'home')
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                            child: _SectionHeader(
                              icon: LucideIcons.compass,
                              title: 'Explore the marketplace',
                              subtitle: 'Products, services and more',
                            ),
                          ),
                        ),
                      SliverToBoxAdapter(
                        child: MasonryProductGrid(
                          products: _products,
                          onTap: _openProduct,
                          onAdd: (p) {
                            ref.read(cartProvider.notifier).add(p);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('Added ${p.title}'),
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          },
                        ),
                      ),
                      if (_loading)
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          sliver: SliverToBoxAdapter(child: Skeletons.productGrid(count: 4)),
                        ),
                      if (widget.feed == 'following' && _products.isEmpty && !_loading)
                        const SliverPadding(
                          padding: EdgeInsets.all(24),
                          sliver: SliverToBoxAdapter(
                            child: _FollowingEmpty(),
                          ),
                        ),
                      if (_done && _products.isNotEmpty)
                        const SliverPadding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          sliver: SliverToBoxAdapter(
                            child: Center(
                              child: Text('You\'re all caught up',
                                  style: TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600)),
                            ),
                          ),
                        ),
                    ],
                  ),
      );
  }

  void _openProduct(Product p) => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProductDetailScreen(product: p)),
      );
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.title, required this.subtitle});
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: const LinearGradient(colors: [AppColors.orange, AppColors.primary]),
              boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 10, offset: Offset(0, 4))],
            ),
            child: Center(
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: AppColors.background.withOpacity(0.85), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 16, color: AppColors.foreground),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, height: 1.05)),
              const SizedBox(height: 2),
              Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
            ]),
          ),
        ],
      );
}

class _FeedHeading extends StatelessWidget {
  const _FeedHeading({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Row(children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
          child: const Icon(LucideIcons.layoutGrid, color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, height: 1.1)),
            Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ]),
        ),
      ]);
}

class _SubcategoryChips extends StatelessWidget {
  const _SubcategoryChips({required this.products, required this.active, required this.onChanged});
  final List<Product> products;
  final String? active;
  final void Function(String?) onChanged;

  @override
  Widget build(BuildContext context) {
    final counts = <String, int>{};
    for (final p in products) {
      final label = (p.badge != null && p.badge!.isNotEmpty)
          ? p.badge!
          : (p.category ?? 'Other');
      counts[label] = (counts[label] ?? 0) + 1;
    }
    if (counts.isEmpty) return const SizedBox.shrink();
    final entries = counts.entries.toList();
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border)), color: Color(0x99FFFFFF)),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          _chip('All', null, products.length, active == null),
          for (final e in entries) _chip(e.key, e.key, e.value, active == e.key),
        ]),
      ),
    );
  }

  Widget _chip(String label, String? id, int count, bool selected) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: OutlinedButton(
          onPressed: () => onChanged(id),
          style: OutlinedButton.styleFrom(
            backgroundColor: selected ? AppColors.primary : AppColors.background,
            foregroundColor: selected ? AppColors.primaryForeground : AppColors.foreground,
            side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
            shape: const StadiumBorder(),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text('$label  $count', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      );
}

class _HomeMenuButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Material(
          color: AppColors.card,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppColors.border),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () {
              final s = Scaffold.maybeOf(context);
              if (s?.hasDrawer ?? false) s!.openDrawer();
            },
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(children: [
                Icon(LucideIcons.menu, size: 16),
                SizedBox(width: 8),
                Expanded(
                  child: Text('Browse categories & quick actions',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                ),
                Text('›', style: TextStyle(fontSize: 20, color: AppColors.muted)),
              ]),
            ),
          ),
        ),
      );
}

class _FollowingEmpty extends StatelessWidget {
  const _FollowingEmpty();

  @override
  Widget build(BuildContext context) {
    final signedIn = supabase.auth.currentUser != null;
    return Column(children: [
      Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.mutedSurface,
        ),
        child: const Icon(LucideIcons.users, color: AppColors.muted, size: 24),
      ),
      const SizedBox(height: 12),
      Text(
        signedIn ? "You're not following anyone yet" : 'Sign in to see your following feed',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 4),
      Text(
        signedIn
            ? "Visit a supplier's store and tap follow to see their posts here."
            : 'Follow suppliers and their newest products land here.',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 12, color: AppColors.muted),
      ),
    ]);
  }
}


class _RecommendationStrip extends StatefulWidget {
  const _RecommendationStrip({required this.onTap});
  final void Function(Product) onTap;

  @override
  State<_RecommendationStrip> createState() => _RecommendationStripState();
}

class _RecommendationStripState extends State<_RecommendationStrip> {
  late Future<List<Product>> _future;
  @override
  void initState() {
    super.initState();
    _future = catalog.fetchProducts(pageSize: 8, sortBy: 'rating');
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Product>>(
        future: _future,
        builder: (context, snap) {
          final data = snap.data ?? const <Product>[];
          if (data.isEmpty) return const SizedBox.shrink();
          return Container(
            margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 12, offset: Offset(0, 4))],
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    gradient: const LinearGradient(colors: [AppColors.orange, AppColors.primary]),
                  ),
                  child: const Icon(LucideIcons.heart, size: 14, color: Colors.white),
                ),
                const SizedBox(width: 8),
                const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Because you browsed', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, height: 1)),
                  SizedBox(height: 2),
                  Text('Hand-picked for you', style: TextStyle(fontSize: 10, color: AppColors.muted)),
                ]),
              ]),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final p in data) ...[
                      ProductCard(product: p, variant: 'compact', onTap: () => widget.onTap(p)),
                      const SizedBox(width: 4),
                    ],
                  ],
                ),
              ),
            ]),
          );
        },
      );
}

class _HomeMenuDrawer extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: OutlinedButton(
          onPressed: () => showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: AppColors.background,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            builder: (_) => const _DirectorySheet(),
          ),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(44),
            side: const BorderSide(color: AppColors.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            foregroundColor: AppColors.foreground,
          ),
          child: const Row(children: [
            Icon(LucideIcons.menu, size: 16),
            SizedBox(width: 8),
            Expanded(child: Text('Browse categories & quick actions', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700))),
            Text('›', style: TextStyle(fontSize: 20, color: AppColors.muted)),
          ]),
        ),
      );
}

class _DirectorySheet extends StatelessWidget {
  const _DirectorySheet();
  static const depts = <(String, IconData, String)>[
    ('Market', LucideIcons.store, '/home'),
    ('Jobs', LucideIcons.briefcase, 'jobs'),
    ('Rides', LucideIcons.navigation, 'rides'),
    ('Services', LucideIcons.wrench, 'services'),
    ('Property', LucideIcons.home, 'properties'),
    ('Delivery', LucideIcons.truck, 'logistics'),
    ('Finance', LucideIcons.banknote, 'finance'),
    ('News', LucideIcons.newspaper, 'news'),
    ('Stays', LucideIcons.bedDouble, 'stays'),
    ('Auto', LucideIcons.car, 'auto'),
    ('Industrial', LucideIcons.factory, 'industrial'),
    ('Agro', LucideIcons.sprout, 'agro'),
  ];
  static const quick = <(String, IconData, String)>[
    ('Request quote', LucideIcons.fileText, 'rfq'),
    ('Track order', LucideIcons.package, 'orders'),
    ('Compare', Icons.compare_arrows, 'compare'),
    ('Logistics', LucideIcons.truck, 'logistics'),
    ('Trade Pay', LucideIcons.wallet, 'wallet'),
    ('Coupons', Icons.local_offer_outlined, 'account'),
  ];

  void _go(BuildContext context, String key) {
    Navigator.pop(context);
    Widget? screen;
    switch (key) {
      case '/home': return;
      case 'jobs': screen = const JobsScreen(); break;
      case 'rides': screen = const RidesScreen(); break;
      case 'services': screen = const ServicesScreen(); break;
      case 'properties': screen = const PropertiesScreen(); break;
      case 'logistics': screen = const LogisticsScreen(); break;
      case 'finance': screen = const FinanceScreen(); break;
      case 'news': screen = const NewsScreen(); break;
      case 'stays': screen = const StaysScreen(); break;
      case 'auto': screen = const AutoScreen(); break;
      case 'industrial': screen = const IndustrialScreen(); break;
      case 'agro': screen = const AgroScreen(); break;
      case 'rfq': screen = const RfqScreen(); break;
      case 'orders': screen = const OrdersScreen(); break;
      case 'compare': screen = const CompareScreen(); break;
      case 'wallet': screen = const WalletScreen(); break;
      case 'account': screen = const ProfileScreen(); break;
    }
    if (screen != null) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen!));
    }
  }

  @override
  Widget build(BuildContext context) => SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 12, 12),
            child: Row(children: [
              const Text('Directory', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.muted)),
              const Spacer(),
              IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(LucideIcons.x, size: 18)),
            ]),
          ),
          const Divider(height: 1, color: AppColors.border),
          Expanded(
            child: ListView(padding: const EdgeInsets.all(16), children: [
              const Text('Categories', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.muted)),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [for (final d in depts) _dirItem(context, d.$1, d.$2, true, d.$3)],
              ),
              const SizedBox(height: 24),
              const Text('Quick Actions', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.muted)),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.18,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [for (final q in quick) _dirItem(context, q.$1, q.$2, false, q.$3)],
              ),
            ]),
          ),
        ]),
      );

  Widget _dirItem(BuildContext context, String label, IconData icon, bool gradient, String key) => InkWell(
        onTap: () => _go(context, key),
        borderRadius: BorderRadius.circular(12),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: gradient ? 48 : 40,
            height: gradient ? 48 : 40,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(gradient ? 16 : 12),
              gradient: gradient ? const LinearGradient(colors: [AppColors.primary, AppColors.orange]) : null,
              color: gradient ? null : AppColors.mutedSurface,
            ),
            child: Icon(icon, size: gradient ? 20 : 16, color: gradient ? Colors.white : AppColors.primary),
          ),
          const SizedBox(height: 6),
          Text(label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted)),
        ]),
      );
}





class _Promo3DCarousel extends StatefulWidget {
  @override
  State<_Promo3DCarousel> createState() => _Promo3DCarouselState();
}

class _Promo3DCarouselState extends State<_Promo3DCarousel> {
  int active = 0;
  late final Timer timer;
  final slides = const [
    ('Welcome', 'Welcome to PUBSTORE', 'Source verified suppliers worldwide', 'Explore', Icons.shopping_bag_outlined, [Color(0xFF4F46E5), Color(0xFFDB2777)]),
    ('Trending', 'Trending now', 'Best-selling products', 'Shop', LucideIcons.sparkles, [Color(0xFFF43F5E), Color(0xFFF59E0B)]),
    ('Stays', 'Stays worldwide', 'Book unique places', 'Book', LucideIcons.bedDouble, [Color(0xFF10B981), Color(0xFF0891B2)]),
  ];
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 4), (_) => setState(() => active = (active + 1) % slides.length));
  }
  @override
  void dispose() { timer.cancel(); super.dispose(); }
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Column(children: [
          SizedBox(
            height: 176,
            child: Stack(clipBehavior: Clip.none, children: [
              for (var i = 0; i < slides.length; i++) _slide(i),
              Positioned(
                left: 48,
                right: 48,
                bottom: -14,
                child: Container(height: 24, decoration: const BoxDecoration(boxShadow: [BoxShadow(color: Color(0x55000000), blurRadius: 18)])),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < slides.length; i++) AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == active ? 24 : 6,
              height: 6,
              decoration: BoxDecoration(color: AppColors.foreground.withOpacity(i == active ? 1 : .3), borderRadius: BorderRadius.circular(999)),
            ),
          ]),
        ]),
      );

  Widget _slide(int i) {
    final s = slides[i];
    var offset = i - active;
    if (offset > slides.length / 2) offset -= slides.length;
    if (offset < -slides.length / 2) offset += slides.length;
    final abs = offset.abs();
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 700),
      curve: Curves.easeOut,
      left: (20 + offset * 54).toDouble(),
      right: (20 - offset * 54).toDouble(),
      top: (abs * 16).toDouble(),
      bottom: (abs * 16).toDouble(),
      child: Transform.scale(
        scale: offset == 0 ? 1 : abs == 1 ? .82 : .66,
        child: Opacity(
          opacity: offset == 0 ? 1 : abs == 1 ? .85 : .45,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(colors: s.$6),
              boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 32, offset: Offset(0, 18))],
            ),
            clipBehavior: Clip.antiAlias,
            child: Stack(children: [
              Positioned.fill(child: Container(decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomLeft, end: Alignment.topRight, colors: [Color(0x66000000), Colors.transparent, Color(0x22FFFFFF)])))),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [const Icon(LucideIcons.sparkles, size: 12, color: Colors.white), const SizedBox(width: 6), Text(s.$1.toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w900))]),
                  const Spacer(),
                  SizedBox(width: 220, child: Text(s.$2, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, color: Colors.white, fontWeight: FontWeight.w900, height: 1.05))),
                  const SizedBox(height: 4),
                  SizedBox(width: 220, child: Text(s.$3, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.w600))),
                  const SizedBox(height: 8),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), decoration: const ShapeDecoration(color: Colors.white, shape: StadiumBorder()), child: Text(s.$4, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900))),
                ]),
              ),
              Positioned(right: 12, top: 48, child: Icon(s.$5, size: 80, color: Colors.white.withOpacity(.25))),
            ]),
          ),
        ),
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off, size: 40, color: AppColors.muted),
            const SizedBox(height: 12),
            Text('Couldn\'t load products',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('$error',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _NewArrivalsStrip extends StatefulWidget {
  const _NewArrivalsStrip({required this.onTap});
  final void Function(Product) onTap;
  @override
  State<_NewArrivalsStrip> createState() => _NewArrivalsStripState();
}

class _NewArrivalsStripState extends State<_NewArrivalsStrip> {
  late Future<List<Product>> _future;
  @override
  void initState() {
    super.initState();
    _future = catalog.fetchProducts(pageSize: 12, sortBy: 'newest');
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<Product>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return Skeletons.productStrip(height: 260, width: 170);
          }
          final data = snap.data ?? const <Product>[];
          if (data.isEmpty) {
            return const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Text('No new arrivals yet — check back soon.',
                  style: TextStyle(color: AppColors.muted, fontSize: 12)),
            );
          }
          return Padding(
            padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
            child: SizedBox(
              height: 260,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: data.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => SizedBox(
                  width: 170,
                  child: ProductCard(
                    product: data[i],
                    variant: 'compact',
                    onTap: () => widget.onTap(data[i]),
                  ),
                ),
              ),
            ),
          );
        },
      );
}
