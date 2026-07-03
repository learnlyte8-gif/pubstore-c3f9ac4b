import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/catalog_service.dart';
import '../theme/palette.dart';
import '../widgets/masonry_grid.dart';
import '../widgets/skeletons.dart';
import 'product_detail_screen.dart';
import 'restaurants_screen.dart';

/// Categories — mirrors `src/pages/Categories.tsx`: a left rail of category
/// pills plus an infinite product grid on the right with subcategory chips.
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, this.onCategorySelected});

  final void Function(Category category)? onCategorySelected;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

const _allId = '__all__';

class _CategoriesScreenState extends State<CategoriesScreen> {
  late Future<List<Category>> _catsFuture;
  final _scroll = ScrollController();

  String _active = _allId;
  String? _activeSub;
  bool _collapsed = false;
  Timer? _idle;

  final List<Product> _products = [];
  int _page = 0;
  bool _loading = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _catsFuture = catalog.fetchCategories();
    _scroll.addListener(() {
      if (_scroll.position.pixels >=
          _scroll.position.maxScrollExtent - 400) {
        _loadMore();
      }
    });
    _loadMore();
    _bumpIdle();
  }

  @override
  void dispose() {
    _idle?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  void _bumpIdle() {
    _idle?.cancel();
    _idle = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _collapsed = true);
    });
  }

  void _select(String id) {
    if (id == _active) return;
    setState(() {
      _active = id;
      _activeSub = null;
      _collapsed = false;
      _products.clear();
      _page = 0;
      _done = false;
    });
    _bumpIdle();
    _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || _done) return;
    setState(() => _loading = true);
    try {
      final rows = await catalog.fetchProducts(
        page: _page,
        pageSize: 30,
        category: _active == _allId ? null : _active,
      );
      if (!mounted) return;
      setState(() {
        _products.addAll(rows);
        _page += 1;
        _loading = false;
        if (rows.length < 30) _done = true;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refresh() async {
    setState(() {
      _products.clear();
      _page = 0;
      _done = false;
    });
    await _loadMore();
  }

  List<String> _derivedSubs() {
    final set = <String>{};
    for (final p in _products) {
      final b = (p.badge ?? '').trim();
      if (b.isNotEmpty) set.add(b);
      if (set.length >= 12) break;
    }
    return set.toList();
  }

  List<Product> get _visible {
    if (_activeSub == null) return _products;
    return _products.where((p) => (p.badge ?? '') == _activeSub).toList();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Category>>(
      future: _catsFuture,
      builder: (context, snap) {
        final cats = snap.data ?? const <Category>[];
        return Listener(
          onPointerDown: (_) => _bumpIdle(),
          child: Stack(children: [
            Row(children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOut,
                width: _collapsed ? 0 : 92,
                color: AppColors.mutedSurface,
                child: _collapsed ? const SizedBox.shrink() : _rail(cats),
              ),
              Expanded(child: _rightPane(cats)),
            ]),
            Positioned(
              top: 12,
              left: _collapsed ? 8 : 96,
              child: Material(
                color: AppColors.background,
                shape: const CircleBorder(),
                elevation: 2,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () {
                    setState(() => _collapsed = !_collapsed);
                    _bumpIdle();
                  },
                  child: SizedBox(
                    width: 32,
                    height: 32,
                    child: Icon(
                      _collapsed ? LucideIcons.chevronRight : LucideIcons.chevronLeft,
                      size: 16,
                      color: AppColors.foreground,
                    ),
                  ),
                ),
              ),
            ),
          ]),
        );
      },
    );
  }

  Widget _rail(List<Category> cats) {
    Widget tile({
      required String label,
      required IconData icon,
      required bool active,
      required VoidCallback onTap,
      Color? iconColor,
    }) {
      return InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
          decoration: BoxDecoration(
            color: active ? AppColors.background : Colors.transparent,
            border: Border(
              left: BorderSide(
                width: 2,
                color: active ? AppColors.primary : Colors.transparent,
              ),
            ),
          ),
          child: Column(children: [
            Icon(icon,
                size: 20,
                color: iconColor ?? (active ? AppColors.primary : AppColors.muted)),
            const SizedBox(height: 4),
            Text(label,
                maxLines: 2,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 11,
                    height: 1.1,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    color: active ? AppColors.primary : AppColors.muted)),
          ]),
        ),
      );
    }

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        tile(
          label: 'All',
          icon: LucideIcons.layoutGrid,
          active: _active == _allId,
          onTap: () => _select(_allId),
        ),
        tile(
          label: 'Food',
          icon: LucideIcons.utensilsCrossed,
          active: false,
          iconColor: const Color(0xFFF43F5E),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const RestaurantsScreen()),
          ),
        ),
        for (final c in cats)
          tile(
            label: c.name,
            icon: _iconFor(c.icon),
            active: _active == c.slug,
            onTap: () {
              _select(c.slug);
              widget.onCategorySelected?.call(c);
            },
          ),
      ],
    );
  }

  Widget _rightPane(List<Category> cats) {
    final active = cats.firstWhere(
      (c) => c.slug == _active,
      orElse: () => Category(id: _allId, name: 'All', slug: _allId),
    );
    final isAll = _active == _allId;
    final subs = isAll ? const <String>[] : _derivedSubs();
    return Column(children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          color: AppColors.background,
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(isAll ? LucideIcons.layoutGrid : _iconFor(active.icon),
                size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isAll ? 'All products' : active.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.foreground)),
                Text(
                    '${_visible.length} products'
                    '${_activeSub != null ? ' · $_activeSub' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              ],
            ),
          ),
        ]),
      ),
      if (!isAll && subs.isNotEmpty)
        SizedBox(
          height: 42,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            itemCount: subs.length + 1,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (_, i) {
              if (i == 0) {
                final on = _activeSub == null;
                return _chip('All', on, () => setState(() => _activeSub = null));
              }
              final s = subs[i - 1];
              final on = _activeSub == s;
              return _chip(s, on, () => setState(() => _activeSub = s));
            },
          ),
        ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: _visible.isEmpty && _loading
              ? Skeletons.productGrid(count: 6)
              : _visible.isEmpty
                  ? ListView(children: const [
                      SizedBox(height: 120),
                      Center(
                          child: Text('No products yet',
                              style: TextStyle(color: AppColors.muted))),
                    ])
                  : CustomScrollView(
                      controller: _scroll,
                      slivers: [
                        SliverToBoxAdapter(
                          child: MasonryProductGrid(
                            products: _visible,
                            padding: const EdgeInsets.all(8),
                            onTap: (p) => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) =>
                                    ProductDetailScreen(productId: p.id),
                              ),
                            ),
                          ),
                        ),
                        if (_loading && _visible.isNotEmpty)
                          const SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.all(24),
                              child:
                                  Center(child: CircularProgressIndicator()),
                            ),
                          ),
                      ],
                    ),
        ),
      ),
    ]);
  }

  Widget _chip(String label, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? AppColors.foreground : AppColors.mutedSurface,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: on ? AppColors.background : AppColors.foreground)),
      ),
    );
  }

  IconData _iconFor(String? name) {
    switch (name) {
      case 'Smartphone': return LucideIcons.smartphone;
      case 'Shirt': return LucideIcons.shirt;
      case 'Home': return LucideIcons.home;
      case 'Sparkles': return LucideIcons.sparkles;
      case 'Dumbbell': return LucideIcons.dumbbell;
      case 'ToyBrick': return LucideIcons.toyBrick;
      case 'Car': return LucideIcons.car;
      case 'Factory': return LucideIcons.factory;
      case 'Sprout': return LucideIcons.sprout;
      case 'Package': return LucideIcons.package;
      case 'Briefcase': return LucideIcons.briefcase;
      case 'HeartPulse': return LucideIcons.heartPulse;
      case 'Wrench': return LucideIcons.wrench;
      case 'Hammer': return LucideIcons.hammer;
      case 'Drill': return LucideIcons.drill;
      case 'PaintBucket': return LucideIcons.paintBucket;
      case 'Lightbulb': return LucideIcons.lightbulb;
      case 'Plug': return LucideIcons.plug;
      case 'Bath': return LucideIcons.bath;
      case 'Sofa': return LucideIcons.sofa;
      case 'Refrigerator': return LucideIcons.refrigerator;
      case 'ChefHat': return LucideIcons.chefHat;
      case 'UtensilsCrossed': return LucideIcons.utensilsCrossed;
      case 'Cookie': return LucideIcons.cookie;
      case 'Wine': return LucideIcons.wine;
      case 'Baby': return LucideIcons.baby;
      case 'PawPrint': return LucideIcons.pawPrint;
      case 'BookOpen': return LucideIcons.bookOpen;
      case 'Music': return LucideIcons.music;
      case 'Camera': return LucideIcons.camera;
      case 'Gamepad2': return LucideIcons.gamepad2;
      case 'Gem': return LucideIcons.gem;
      case 'Watch': return LucideIcons.watch;
      case 'Glasses': return LucideIcons.glasses;
      case 'Wallet': return LucideIcons.wallet;
      case 'Scissors': return LucideIcons.scissors;
      case 'Flower2': return LucideIcons.flower2;
      case 'Tent': return LucideIcons.tent;
      case 'Bike': return LucideIcons.bike;
      case 'Tv': return LucideIcons.tv;
      case 'Laptop': return LucideIcons.laptop;
      case 'Headphones': return LucideIcons.headphones;
      case 'Printer': return LucideIcons.printer;
      case 'BatteryCharging': return LucideIcons.batteryCharging;
      case 'Cog': return LucideIcons.cog;
      case 'Fuel': return LucideIcons.fuel;
      case 'Truck': return LucideIcons.truck;
      case 'Pill': return LucideIcons.pill;
      case 'Ruler': return LucideIcons.ruler;
      case 'Shovel': return LucideIcons.shovel;
      default: return LucideIcons.package;
    }
  }
}
