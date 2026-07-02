import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/catalog_service.dart';
import '../services/cart_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import 'cart_screen.dart';

/// Product Detail — mirrors `src/pages/ProductDetail.tsx`.
///
/// Accepts a lightweight [Product] (already loaded from a grid) plus optional
/// [productId] for deep links. Full row is refetched to fill description,
/// gallery, and supplier details.
class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, this.product, this.productId})
      : assert(product != null || productId != null,
            'Pass either a product or a productId');

  final Product? product;
  final String? productId;

  @override
  ConsumerState<ProductDetailScreen> createState() =>
      _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  Map<String, dynamic>? _full;
  Object? _error;
  int _qty = 1;
  int _imageIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final id = widget.product?.id ?? widget.productId!;
      final row = await supabase
          .from('products')
          .select(
              '*, suppliers:supplier_id(id, name, country, verified, gold, logo)')
          .eq('id', id)
          .maybeSingle();
      if (mounted) setState(() => _full = row);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Product get _product =>
      widget.product ??
      (_full != null ? Product.fromRow(_full!) : _placeholder);

  static final _placeholder = Product(
    id: '',
    title: 'Loading…',
    price: 0,
    currency: 'USD',
    image: null,
    supplierId: null,
  );

  List<String> get _gallery {
    final imgs = (_full?['gallery'] as List?)?.cast<dynamic>() ??
        (_full?['images'] as List?)?.cast<dynamic>() ??
        const [];
    if (imgs.isNotEmpty) return imgs.map((e) => e.toString()).toList();
    if (_product.image != null) return [_product.image!];
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final p = _product;
    final gallery = _gallery;
    final supplier = _full?['suppliers'] as Map<String, dynamic>?;
    final description = _full?['description'] as String? ?? '';

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(p.title,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
        actions: [_CartButton()],
      ),
      body: _full == null && _error == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: EdgeInsets.zero,
              children: [
                if (gallery.isNotEmpty) ...[
                  AspectRatio(
                    aspectRatio: 1,
                    child: PageView.builder(
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
                  ),
                  if (gallery.length > 1)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          gallery.length,
                          (i) => Container(
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            width: 6,
                            height: 6,
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
                ],
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_formatPrice(p),
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: AppColors.priceRed,
                              height: 1)),
                      const SizedBox(height: 10),
                      Text(p.title,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          if ((p.rating ?? 0) > 0) ...[
                            const Icon(LucideIcons.star,
                                size: 14, color: Color(0xFFF59E0B)),
                            const SizedBox(width: 4),
                            Text(p.rating!.toStringAsFixed(1),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600, fontSize: 12)),
                            const SizedBox(width: 8),
                          ],
                          if ((p.sold ?? 0) > 0)
                            Text('${p.sold} sold',
                                style: const TextStyle(
                                    color: AppColors.muted, fontSize: 12)),
                        ],
                      ),
                      if (supplier != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.mutedSurface,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 20,
                                backgroundColor: AppColors.border,
                                backgroundImage: supplier['logo'] != null
                                    ? CachedNetworkImageProvider(
                                        supplier['logo'] as String)
                                    : null,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Row(children: [
                                      Flexible(
                                        child: Text(
                                          (supplier['name'] as String?) ??
                                              'Supplier',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 13),
                                        ),
                                      ),
                                      if (supplier['verified'] == true) ...[
                                        const SizedBox(width: 4),
                                        const Icon(LucideIcons.badgeCheck,
                                            size: 14,
                                            color: AppColors.primary),
                                      ],
                                    ]),
                                    if (supplier['country'] != null)
                                      Text(supplier['country'] as String,
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.muted)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 20),
                        const Text('Description',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 14)),
                        const SizedBox(height: 6),
                        Text(description,
                            style: const TextStyle(
                                fontSize: 13, height: 1.5)),
                      ],
                      const SizedBox(height: 24),
                      _QtyStepper(
                        qty: _qty,
                        onChanged: (v) => setState(() => _qty = v),
                      ),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              Expanded(
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
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(LucideIcons.shoppingCart, size: 16),
                  label: const Text('Add to cart'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: p.id.isEmpty
                      ? null
                      : () {
                          ref.read(cartProvider.notifier).add(p, qty: _qty);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const CartScreen()),
                          );
                        },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    backgroundColor: AppColors.foreground,
                    foregroundColor: AppColors.background,
                  ),
                  child: const Text('Buy now'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatPrice(Product p) {
    final sym = p.currency == 'USD' ? r'$' : '${p.currency} ';
    final v = p.price;
    return v == v.roundToDouble()
        ? '$sym${v.toStringAsFixed(0)}'
        : '$sym${v.toStringAsFixed(2)}';
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.qty, required this.onChanged});
  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Text('Quantity',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        const Spacer(),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(children: [
            IconButton(
              onPressed: qty > 1 ? () => onChanged(qty - 1) : null,
              icon: const Icon(LucideIcons.minus, size: 16),
              visualDensity: VisualDensity.compact,
            ),
            SizedBox(
              width: 32,
              child: Text('$qty',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            IconButton(
              onPressed: () => onChanged(qty + 1),
              icon: const Icon(LucideIcons.plus, size: 16),
              visualDensity: VisualDensity.compact,
            ),
          ]),
        ),
      ],
    );
  }
}

class _CartButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartCountProvider);
    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: const Icon(LucideIcons.shoppingCart),
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const CartScreen()),
          ),
        ),
        if (count > 0)
          Positioned(
            top: 6,
            right: 6,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.priceRed,
                borderRadius: BorderRadius.circular(20),
              ),
              constraints: const BoxConstraints(minWidth: 16),
              child: Text('$count',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700)),
            ),
          ),
      ],
    );
  }
}
