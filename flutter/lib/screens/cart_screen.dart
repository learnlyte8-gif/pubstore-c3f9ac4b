import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/cart_service.dart';
import '../theme/palette.dart';

/// Cart screen — mirrors `src/pages/Cart.tsx`. Local-first: reads the cart
/// state built up while browsing, before any signed-in checkout.
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lines = ref.watch(cartProvider);
    final subtotal = ref.watch(cartSubtotalProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.chevronLeft),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Cart',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (lines.isNotEmpty)
            TextButton(
              onPressed: () => ref.read(cartProvider.notifier).clear(),
              child: const Text('Clear'),
            ),
        ],
      ),
      body: lines.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: const [
                  Icon(LucideIcons.shoppingCart,
                      size: 44, color: AppColors.muted),
                  SizedBox(height: 12),
                  Text('Your cart is empty',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  SizedBox(height: 4),
                  Text('Add products from the feed to start.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12)),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: lines.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: AppColors.border),
              itemBuilder: (_, i) {
                final l = lines[i];
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: SizedBox(
                          width: 64,
                          height: 64,
                          child: l.product.image != null
                              ? CachedNetworkImage(
                                  imageUrl: l.product.image!,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(
                                      color: AppColors.mutedSurface),
                                  errorWidget: (_, __, ___) => Container(
                                      color: AppColors.mutedSurface),
                                )
                              : Container(color: AppColors.mutedSurface),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(l.product.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(
                              _price(l.product.currency,
                                  l.product.price * l.qty),
                              style: const TextStyle(
                                  color: AppColors.priceRed,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 16),
                            ),
                            const SizedBox(height: 6),
                            Row(children: [
                              _StepIcon(
                                icon: LucideIcons.minus,
                                onTap: () => ref
                                    .read(cartProvider.notifier)
                                    .setQty(l.product.id, l.qty - 1),
                              ),
                              SizedBox(
                                width: 34,
                                child: Text('${l.qty}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                              ),
                              _StepIcon(
                                icon: LucideIcons.plus,
                                onTap: () => ref
                                    .read(cartProvider.notifier)
                                    .setQty(l.product.id, l.qty + 1),
                              ),
                              const Spacer(),
                              IconButton(
                                icon: const Icon(LucideIcons.trash2,
                                    size: 16, color: AppColors.muted),
                                onPressed: () => ref
                                    .read(cartProvider.notifier)
                                    .remove(l.product.id),
                              ),
                            ]),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
      bottomNavigationBar: lines.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Subtotal',
                            style: TextStyle(
                                fontSize: 11, color: AppColors.muted)),
                        Text(
                          _price(
                              lines.first.product.currency, subtotal),
                          style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppColors.priceRed),
                        ),
                      ],
                    ),
                    const Spacer(),
                    ElevatedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text(
                                  'Checkout is next — wiring auth + orders')),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 24, vertical: 14),
                        backgroundColor: AppColors.foreground,
                        foregroundColor: AppColors.background,
                      ),
                      child: const Text('Checkout'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  String _price(String currency, double v) {
    final sym = currency == 'USD' ? r'$' : '$currency ';
    return v == v.roundToDouble()
        ? '$sym${v.toStringAsFixed(0)}'
        : '$sym${v.toStringAsFixed(2)}';
  }
}

class _StepIcon extends StatelessWidget {
  const _StepIcon({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 20,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 14),
      ),
    );
  }
}
