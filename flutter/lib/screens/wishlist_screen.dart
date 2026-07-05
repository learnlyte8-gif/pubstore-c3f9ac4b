import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/auth_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/masonry_grid.dart';
import '../widgets/skeletons.dart';
import 'product_detail_screen.dart';

/// Wishlist — mirrors `src/pages/Wishlist.tsx` with two tabs:
/// Products (from `wishlist_items`) and Services & more (from `saved_items`).
class WishlistScreen extends ConsumerStatefulWidget {
  const WishlistScreen({super.key});

  @override
  ConsumerState<WishlistScreen> createState() => _WishlistScreenState();
}

class _SavedRow {
  _SavedRow(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String;
  String get kind => (raw['item_kind'] ?? '') as String;
  String get itemId => (raw['item_id'] ?? '') as String;
  String? get title => raw['title'] as String?;
  String? get image => raw['image'] as String?;
  String? get href => raw['href'] as String?;
}

const _kindMeta = <String, ({String label, IconData icon})>{
  'agro': (label: 'Agro', icon: LucideIcons.sprout),
  'stay': (label: 'Stays', icon: LucideIcons.bedDouble),
  'property': (label: 'Properties', icon: LucideIcons.home),
  'service': (label: 'Services', icon: LucideIcons.wrench),
  'industrial': (label: 'Industrial', icon: LucideIcons.factory),
  'car-rental': (label: 'Car rentals', icon: LucideIcons.car),
  'freelance': (label: 'Freelance', icon: LucideIcons.sparkles),
  'logistics': (label: 'Logistics', icon: LucideIcons.truck),
  'finance': (label: 'Finance', icon: LucideIcons.banknote),
  'news': (label: 'News', icon: LucideIcons.newspaper),
};

class _WishlistScreenState extends ConsumerState<WishlistScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  Future<List<Product>>? _products;
  Future<List<_SavedRow>>? _saved;

  Future<List<Product>> _fetchProducts(String uid) async {
    final rows = await supabase
        .from('wishlist_items')
        .select('created_at, product:products(id, title, price, original_price, '
            'currency, image, gallery, category_slug, badge, free_shipping, '
            'moq, unit, rating, review_count, sold, supplier_id, '
            'suppliers(name, verified, gold, country, trade_type))')
        .eq('user_id', uid)
        .order('created_at', ascending: false);
    return (rows as List)
        .map((r) => (r as Map)['product'])
        .where((p) => p != null)
        .map((p) => Product.fromRow((p as Map).cast<String, dynamic>()))
        .toList();
  }

  Future<List<_SavedRow>> _fetchSaved(String uid) async {
    final rows = await supabase
        .from('saved_items')
        .select('id,item_kind,item_id,title,image,href')
        .eq('user_id', uid)
        .order('created_at', ascending: false);
    return (rows as List)
        .map((r) => _SavedRow(Map<String, dynamic>.from(r as Map)))
        .toList();
  }

  Future<void> _removeSaved(_SavedRow r) async {
    try {
      await supabase.from('saved_items').delete().eq('id', r.id);
    } catch (_) {}
    setState(() {
      final uid = supabase.auth.currentUser?.id;
      if (uid != null) _saved = _fetchSaved(uid);
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Wishlist')),
        body: const Center(child: Text('Sign in to save products', style: TextStyle(color: AppColors.muted))),
      );
    }
    _products ??= _fetchProducts(user.id);
    _saved ??= _fetchSaved(user.id);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wishlist', style: TextStyle(fontWeight: FontWeight.w800)),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Products'), Tab(text: 'Services & more')],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _productsTab(user.id),
          _savedTab(user.id),
        ],
      ),
    );
  }

  Widget _productsTab(String uid) => RefreshIndicator(
        onRefresh: () async => setState(() => _products = _fetchProducts(uid)),
        child: FutureBuilder<List<Product>>(
          future: _products,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return Skeletons.productGrid(count: 6);
            }
            final items = snap.data ?? const [];
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                Center(child: Icon(LucideIcons.heart, size: 40, color: AppColors.muted)),
                SizedBox(height: 8),
                Center(child: Text('No saved products yet', style: TextStyle(color: AppColors.muted))),
                SizedBox(height: 6),
                Center(child: Text('Tap the heart on any product.', style: TextStyle(color: AppColors.muted, fontSize: 12))),
              ]);
            }
            return SingleChildScrollView(
              child: MasonryProductGrid(
                products: items,
                onTap: (p) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProductDetailScreen(product: p))),
              ),
            );
          },
        ),
      );

  Widget _savedTab(String uid) => RefreshIndicator(
        onRefresh: () async => setState(() => _saved = _fetchSaved(uid)),
        child: FutureBuilder<List<_SavedRow>>(
          future: _saved,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return Skeletons.list(count: 6);
            }
            final rows = snap.data ?? const [];
            if (rows.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 80),
                Center(child: Icon(LucideIcons.heart, size: 40, color: AppColors.muted)),
                SizedBox(height: 8),
                Center(child: Text('No saved services yet', style: TextStyle(color: AppColors.muted))),
                SizedBox(height: 6),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 40),
                  child: Text('Tap the heart on any stay, property, agro listing, vehicle, freelance gig or service.',
                      textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 12)),
                ),
              ]);
            }
            final grouped = <String, List<_SavedRow>>{};
            for (final r in rows) {
              grouped.putIfAbsent(r.kind, () => []).add(r);
            }
            final keys = grouped.keys.toList();
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: keys.length,
              itemBuilder: (_, i) {
                final k = keys[i];
                final list = grouped[k]!;
                final meta = _kindMeta[k] ?? (label: k, icon: LucideIcons.heart);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8, left: 2),
                      child: Row(children: [
                        Icon(meta.icon, size: 12, color: AppColors.muted),
                        const SizedBox(width: 6),
                        Text(meta.label.toUpperCase(),
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.muted, letterSpacing: 1)),
                        Text(' · ${list.length}', style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                      ]),
                    ),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 0.85),
                      itemCount: list.length,
                      itemBuilder: (_, j) {
                        final r = list[j];
                        return Container(
                          clipBehavior: Clip.antiAlias,
                          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(16)),
                          child: Stack(children: [
                            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                              AspectRatio(
                                aspectRatio: 4 / 3,
                                child: (r.image == null || r.image!.isEmpty)
                                    ? const ColoredBox(color: AppColors.mutedSurface)
                                    : CachedNetworkImage(imageUrl: r.image!, fit: BoxFit.cover),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(8),
                                child: Text(r.title ?? 'Saved item', maxLines: 2, overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                              ),
                            ]),
                            Positioned(
                              top: 6, right: 6,
                              child: InkWell(
                                onTap: () => _removeSaved(r),
                                child: Container(
                                  width: 28, height: 28,
                                  decoration: BoxDecoration(color: AppColors.background.withOpacity(0.9), shape: BoxShape.circle),
                                  child: const Icon(LucideIcons.trash2, size: 14, color: AppColors.danger),
                                ),
                              ),
                            ),
                          ]),
                        );
                      },
                    ),
                  ]),
                );
              },
            );
          },
        ),
      );
}
