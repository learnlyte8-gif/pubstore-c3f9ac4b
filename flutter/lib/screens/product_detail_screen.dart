import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/message_models.dart';
import '../models/models.dart';
import '../services/cart_service.dart';
import '../services/catalog_service.dart';
import '../services/supabase_client.dart';
import '../services/wishlist_service.dart';
import '../theme/palette.dart';
import '../widgets/chat/share_to_chat_sheet.dart';
import '../widgets/product_card.dart';
import '../widgets/skeletons.dart';
import '../widgets/social/group_buy_start_sheet.dart';
import 'cart_screen.dart';
import 'messages_screen.dart';
import 'supplier_screen.dart';

/// Product Detail — 1:1 mirror of `src/pages/ProductDetail.tsx`.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, this.product, this.productId})
      : assert(product != null || productId != null);

  final Product? product;
  final String? productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

enum _Tab { specs, description, reviews }

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  Map<String, dynamic>? _full;
  Map<String, dynamic>? _supplier;
  List<Map<String, dynamic>> _tierPrices = const [];
  List<Map<String, dynamic>> _reviews = const [];
  List<Product> _related = const [];
  Object? _error;

  int _qty = 1;
  int _imageIndex = 0;
  _Tab _tab = _Tab.specs;
  bool _loading = true;

  late final PageController _pageCtl = PageController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pageCtl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final id = widget.product?.id ?? widget.productId!;
      final row = await supabase
          .from('products')
          .select('*, suppliers:supplier_id(*)')
          .eq('id', id)
          .maybeSingle();
      if (!mounted) return;
      final full = row == null ? null : Map<String, dynamic>.from(row as Map);
      final supplier = full?['suppliers'] is Map
          ? Map<String, dynamic>.from(full!['suppliers'] as Map)
          : null;

      List<Map<String, dynamic>> tiers = const [];
      List<Map<String, dynamic>> reviews = const [];
      try {
        final t = await supabase
            .from('product_tier_prices')
            .select('min_qty, price')
            .eq('product_id', id)
            .order('min_qty');
        tiers = (t as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {}
      try {
        final r = await supabase
            .from('product_reviews')
            .select('id, rating, comment, created_at, user_id')
            .eq('product_id', id)
            .order('created_at', ascending: false);
        reviews = (r as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      } catch (_) {}

      List<Product> related = const [];
      final cat = full?['category_slug'] as String?;
      if (cat != null) {
        try {
          related = await const CatalogService()
              .fetchProducts(category: cat, pageSize: 8);
          related = related.where((p) => p.id != id).take(6).toList();
        } catch (_) {}
      }

      final moq = ((full?['moq'] ?? 1) as num).toInt();
      if (mounted) {
        setState(() {
          _full = full;
          _supplier = supplier;
          _tierPrices = tiers;
          _reviews = reviews;
          _related = related;
          _qty = moq;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e; _loading = false; });
    }
  }

  Product get _product =>
      widget.product ??
      (_full != null ? Product.fromRow(_full!) : _placeholder);

  static final _placeholder = Product(
    id: '', title: 'Loading…', price: 0, currency: 'USD',
    image: null, supplierId: null,
  );

  List<String> get _gallery {
    final p = _product;
    if (p.gallery.isNotEmpty) return p.gallery;
    if (p.image != null) return [p.image!];
    return const [];
  }

  double _tierPriceFor(int qty) {
    if (_tierPrices.isEmpty) return _product.price;
    double price = _product.price;
    for (final t in _tierPrices) {
      final min = ((t['min_qty'] ?? 1) as num).toInt();
      if (qty >= min) price = ((t['price'] ?? price) as num).toDouble();
    }
    return price;
  }

  String _fmt(double n) => '\$${n.toStringAsFixed(2)}';

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(appBar: AppBar(), body: Skeletons.screen(SkeletonPreset.detail));
    }
    if (_full == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Product not found.',
                  style: TextStyle(color: AppColors.muted)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Back to home'),
              ),
            ],
          ),
        ),
      );
    }

    final p = _product;
    final gallery = _gallery;
    final unitPrice = _tierPriceFor(_qty);
    final total = unitPrice * _qty;
    final off = p.originalPrice != null && p.originalPrice! > unitPrice
        ? (((p.originalPrice! - unitPrice) / p.originalPrice!) * 100).round()
        : 0;
    final liked = ref.watch(wishlistProvider).contains(p.id);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            elevation: 0,
            backgroundColor: AppColors.background.withOpacity(0.9),
            foregroundColor: AppColors.foreground,
            leading: IconButton(
              icon: const Icon(LucideIcons.arrowLeft),
              onPressed: () => Navigator.of(context).pop(),
            ),
            actions: [
              IconButton(
                icon: Icon(liked ? LucideIcons.heart : LucideIcons.heart,
                    color: liked ? AppColors.destructive : AppColors.foreground),
                onPressed: () async {
                  final uid = supabase.auth.currentUser?.id;
                  if (uid == null) return;
                  if (liked) {
                    await supabase.from('wishlist_items').delete()
                        .eq('user_id', uid).eq('product_id', p.id);
                  } else {
                    await supabase.from('wishlist_items')
                        .insert({'user_id': uid, 'product_id': p.id});
                  }
                  ref.read(wishlistProvider.notifier).refresh();
                },
              ),
              IconButton(
                icon: const Icon(LucideIcons.share2),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Share coming soon')),
                  );
                },
              ),
            ],
          ),
          SliverList(
            delegate: SliverChildListDelegate([
              // Gallery
              if (gallery.isNotEmpty)
                AspectRatio(
                  aspectRatio: 1,
                  child: Stack(children: [
                    PageView.builder(
                      controller: _pageCtl,
                      itemCount: gallery.length,
                      onPageChanged: (i) => setState(() => _imageIndex = i),
                      itemBuilder: (_, i) => CachedNetworkImage(
                        imageUrl: gallery[i],
                        fit: BoxFit.cover,
                        placeholder: (_, __) =>
                            Container(color: AppColors.mutedSurface),
                        errorWidget: (_, __, ___) =>
                            Container(color: AppColors.mutedSurface),
                      ),
                    ),
                    if (gallery.length > 1)
                      Positioned(
                        bottom: 10,
                        left: 0,
                        right: 0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(
                            gallery.length,
                            (i) => Container(
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: 6, height: 6,
                              decoration: BoxDecoration(
                                color: i == _imageIndex
                                    ? AppColors.foreground
                                    : AppColors.border,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ]),
                ),

              // Price / title / meta
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(_fmt(unitPrice),
                          style: const TextStyle(
                              fontSize: 30,
                              fontWeight: FontWeight.w900,
                              color: AppColors.priceRed,
                              height: 1)),
                      if (p.originalPrice != null &&
                          unitPrice < p.originalPrice!) ...[
                        const SizedBox(width: 8),
                        Text(_fmt(p.originalPrice!),
                            style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                                decoration: TextDecoration.lineThrough)),
                        if (off > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.destructive.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text('-$off%',
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.destructive)),
                          ),
                        ],
                      ],
                    ]),
                    const SizedBox(height: 2),
                    Text('per ${p.unit} · MOQ ${p.moq} ${p.unit}',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.muted)),
                    const SizedBox(height: 8),
                    Text(p.title,
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                            height: 1.35)),
                    const SizedBox(height: 8),
                    Row(children: [
                      const Icon(LucideIcons.star,
                          size: 13, color: Color(0xFFF59E0B)),
                      const SizedBox(width: 3),
                      Text(p.rating.toStringAsFixed(1),
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 3),
                      Text('(${p.reviews})',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted)),
                      const SizedBox(width: 8),
                      Text('·',
                          style: const TextStyle(color: AppColors.muted)),
                      const SizedBox(width: 8),
                      Text('${p.sold} sold',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.muted)),
                      if (p.freeShipping) ...[
                        const SizedBox(width: 8),
                        const Text('·',
                            style: TextStyle(color: AppColors.muted)),
                        const SizedBox(width: 8),
                        const Icon(LucideIcons.truck,
                            size: 13, color: AppColors.primary),
                        const SizedBox(width: 3),
                        const Text('Free shipping',
                            style: TextStyle(
                                fontSize: 12,
                                color: AppColors.primary,
                                fontWeight: FontWeight.w500)),
                      ],
                    ]),
                  ],
                ),
              ),

              // Bulk pricing
              if (_tierPrices.isNotEmpty) _buildBulk(unitPrice, p.unit),

              // Quantity + subtotal
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('QUANTITY',
                              style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.muted,
                                  letterSpacing: 0.5)),
                          const SizedBox(height: 2),
                          Text('Min order ${p.moq} ${p.unit}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.muted)),
                        ],
                      ),
                    ),
                    _stepBtn(LucideIcons.minus,
                        () => setState(() => _qty = _qty > p.moq ? _qty - 1 : p.moq)),
                    const SizedBox(width: 6),
                    Container(
                      width: 60, height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.mutedSurface,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      alignment: Alignment.center,
                      child: Text('$_qty',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14)),
                    ),
                    const SizedBox(width: 6),
                    _stepBtn(LucideIcons.plus,
                        () => setState(() => _qty += 1)),
                  ]),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.mutedSurface.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Subtotal',
                            style: TextStyle(
                                fontSize: 12, color: AppColors.muted)),
                        Text(_fmt(total),
                            style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppColors.priceRed)),
                      ],
                    ),
                  ),
                ]),
              ),

              // Trust badges
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Row(children: [
                  Expanded(child: _trust(LucideIcons.shieldCheck,
                      'Trade Assurance', 'Refund if not delivered')),
                  const SizedBox(width: 8),
                  Expanded(child: _trust(LucideIcons.truck,
                      'Lead time', p.leadTime)),
                  const SizedBox(width: 8),
                  Expanded(child: _trust(LucideIcons.globe,
                      'Ships from', p.shipFrom)),
                ]),
              ),

              // Request a sample
              if (_supplier != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: InkWell(
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => const MessagesScreen())),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.mutedSurface.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(children: [
                        const Icon(LucideIcons.package,
                            size: 16, color: AppColors.primary),
                        const SizedBox(width: 8),
                        const Text('Request a sample',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700)),
                        const Spacer(),
                        const Text('Test before bulk order →',
                            style: TextStyle(
                                fontSize: 11, color: AppColors.muted)),
                      ]),
                    ),
                  ),
                ),

              // Supplier card
              if (_supplier != null) _buildSupplierCard(_supplier!),

              // Tabs
              const SizedBox(height: 20),
              _buildTabs(p),

              // Related
              if (_related.isNotEmpty) _buildRelated(),

              const SizedBox(height: 100),
            ]),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(p),
    );
  }

  Widget _stepBtn(IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: 36, height: 36,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Icon(icon, size: 16),
        ),
      );

  Widget _trust(IconData icon, String title, String desc) => Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppColors.mutedSurface.withOpacity(0.4),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(height: 4),
          Text(title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700)),
          Text(desc,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 10, color: AppColors.muted)),
        ]),
      );

  Widget _buildBulk(double unitPrice, String unit) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('BULK PRICING',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.muted,
                letterSpacing: 0.5)),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 2.2,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
          ),
          itemCount: _tierPrices.length,
          itemBuilder: (_, i) {
            final t = _tierPrices[i];
            final next = i + 1 < _tierPrices.length ? _tierPrices[i + 1] : null;
            final min = ((t['min_qty'] ?? 1) as num).toInt();
            final price = ((t['price'] ?? 0) as num).toDouble();
            final range = next != null
                ? '$min–${((next['min_qty'] ?? 1) as num).toInt() - 1}'
                : '≥ $min';
            final active = unitPrice == price;
            return Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                border: Border.all(
                  color: active ? AppColors.primary : AppColors.border,
                ),
                color: active
                    ? AppColors.primary.withOpacity(0.05)
                    : AppColors.card,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_fmt(price),
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.priceRed)),
                  Text('$range $unit',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.muted)),
                ],
              ),
            );
          },
        ),
      ]),
    );
  }

  Widget _buildSupplierCard(Map<String, dynamic> s) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => SupplierScreen(supplierId: s['id'] as String))),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.mutedSurface,
              backgroundImage: s['logo'] != null
                  ? CachedNetworkImageProvider(s['logo'] as String)
                  : null,
              child: s['logo'] == null
                  ? const Icon(LucideIcons.store, size: 18)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Flexible(
                      child: Text((s['name'] as String?) ?? 'Supplier',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                    if (s['verified'] == true) ...[
                      const SizedBox(width: 4),
                      const Icon(LucideIcons.badgeCheck,
                          size: 14, color: AppColors.primary),
                    ],
                    if (s['gold'] == true) ...[
                      const SizedBox(width: 4),
                      const Icon(LucideIcons.crown,
                          size: 14, color: Color(0xFFF59E0B)),
                    ],
                  ]),
                  if (s['country'] != null || s['location_address'] != null)
                    Text(
                        (s['location_address'] as String?) ??
                            (s['country'] as String? ?? ''),
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.muted)),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight,
                size: 18, color: AppColors.muted),
          ]),
        ),
      ),
    );
  }

  Widget _buildTabs(Product p) {
    final labels = <_Tab, String>{
      _Tab.specs: 'Specs',
      _Tab.description: 'Description',
      _Tab.reviews: 'Reviews (${_reviews.length})',
    };
    return Column(children: [
      Container(
        decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border))),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: labels.entries.map((e) {
            final active = _tab == e.key;
            return Padding(
              padding: const EdgeInsets.only(right: 20),
              child: InkWell(
                onTap: () => setState(() => _tab = e.key),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: active
                            ? AppColors.foreground
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(e.value,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight:
                              active ? FontWeight.w700 : FontWeight.w400,
                          color: active
                              ? AppColors.foreground
                              : AppColors.muted)),
                ),
              ),
            );
          }).toList(),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: _buildTabBody(p),
      ),
    ]);
  }

  Widget _buildTabBody(Product p) {
    switch (_tab) {
      case _Tab.specs:
        final specs = <MapEntry<String, String>>[
          MapEntry('Category', p.category ?? '—'),
          MapEntry('MOQ', '${p.moq} ${p.unit}'),
          MapEntry('Lead time', p.leadTime),
          MapEntry('Ships from', p.shipFrom),
        ];
        return Column(
          children: specs.map((s) => Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: const BoxDecoration(
                    border: Border(
                        bottom: BorderSide(color: AppColors.border, width: 0.5))),
                child: Row(children: [
                  Expanded(
                    child: Text(s.key,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.muted)),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(s.value,
                        style: const TextStyle(fontSize: 13)),
                  ),
                ]),
              )).toList(),
        );
      case _Tab.description:
        return Text(
          p.description.isEmpty ? 'No description provided.' : p.description,
          style: const TextStyle(fontSize: 13, height: 1.5),
        );
      case _Tab.reviews:
        if (_reviews.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text('No reviews yet.',
                  style: TextStyle(color: AppColors.muted, fontSize: 13)),
            ),
          );
        }
        return Column(
          children: _reviews.map((r) {
            final rating = ((r['rating'] ?? 0) as num).toInt();
            return Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: const BoxDecoration(
                  border: Border(
                      top: BorderSide(color: AppColors.border, width: 0.5))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('User',
                          style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700)),
                      Row(children: List.generate(5, (i) => Icon(
                            LucideIcons.star,
                            size: 12,
                            color: i < rating
                                ? const Color(0xFFF59E0B)
                                : AppColors.border,
                          ))),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text((r['comment'] as String?) ?? '',
                      style: const TextStyle(fontSize: 13)),
                  const SizedBox(height: 2),
                  Text((r['created_at'] as String?)?.substring(0, 10) ?? '',
                      style: const TextStyle(
                          fontSize: 10, color: AppColors.muted)),
                ],
              ),
            );
          }).toList(),
        );
    }
  }

  Widget _buildRelated() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('You may also like',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: 0.62,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
          ),
          itemCount: _related.length,
          itemBuilder: (_, i) {
            final rp = _related[i];
            return ProductCard(
              product: rp,
              onTap: () => Navigator.of(context).pushReplacement(
                MaterialPageRoute(
                    builder: (_) => ProductDetailScreen(product: rp)),
              ),
            );
          },
        ),
      ]),
    );
  }

  Widget _buildBottomBar(Product p) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
        decoration: BoxDecoration(
          color: AppColors.background.withOpacity(0.95),
          border: const Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Row(children: [
          if (_supplier != null)
            _iconPill(LucideIcons.store, 'Store', () {
              Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => SupplierScreen(
                      supplierId: _supplier!['id'] as String)));
            }),
          const SizedBox(width: 6),
          _iconPill(LucideIcons.messageCircle, 'Chat', () {
            Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const MessagesScreen()));
          }),
          const SizedBox(width: 8),
          Expanded(
            child: SizedBox(
              height: 48,
              child: OutlinedButton.icon(
                onPressed: p.id.isEmpty
                    ? null
                    : () {
                        ref.read(cartProvider.notifier).add(p, qty: _qty);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Added $_qty × ${p.title}'),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                style: OutlinedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24)),
                  side: const BorderSide(color: AppColors.border),
                  foregroundColor: AppColors.foreground,
                ),
                icon: const Icon(LucideIcons.shoppingCart, size: 16),
                label: const Text('Add',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: p.id.isEmpty
                    ? null
                    : () {
                        ref.read(cartProvider.notifier).add(p, qty: _qty);
                        Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => const CartScreen()));
                      },
                style: ElevatedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24)),
                  backgroundColor: AppColors.foreground,
                  foregroundColor: AppColors.background,
                ),
                child: const Text('Buy now',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _iconPill(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        width: 48, height: 48,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18),
            const SizedBox(height: 1),
            Text(label,
                style: const TextStyle(
                    fontSize: 9, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
