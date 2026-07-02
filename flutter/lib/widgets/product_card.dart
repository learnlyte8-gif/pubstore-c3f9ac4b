import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Marketplace product card — mirrors `src/components/marketplace/MixedCard`
/// (large red price, add-to-cart pill, rating row).
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, this.onTap, this.onAdd});

  final Product product;
  final VoidCallback? onTap;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.background,
      borderRadius: BorderRadius.circular(AppRadii.md),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.border),
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: product.image != null
                    ? CachedNetworkImage(
                        imageUrl: product.image!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) =>
                            Container(color: AppColors.mutedSurface),
                        errorWidget: (_, __, ___) =>
                            Container(color: AppColors.mutedSurface),
                      )
                    : Container(color: AppColors.mutedSurface),
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _formatPrice(product),
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.priceRed,
                                  height: 1,
                                ),
                              ),
                              if ((product.rating ?? 0) > 0) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(LucideIcons.star,
                                        size: 12, color: Color(0xFFF59E0B)),
                                    const SizedBox(width: 3),
                                    Text(
                                      product.rating!.toStringAsFixed(1),
                                      style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600),
                                    ),
                                    if ((product.sold ?? 0) > 0)
                                      Text(
                                        ' · ${product.sold} sold',
                                        style: const TextStyle(
                                            fontSize: 10,
                                            color: AppColors.muted),
                                      ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                        GestureDetector(
                          onTap: onAdd,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.foreground,
                              borderRadius: BorderRadius.circular(AppRadii.sm),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(LucideIcons.plus,
                                    size: 14, color: AppColors.background),
                                SizedBox(width: 3),
                                Text('Add',
                                    style: TextStyle(
                                        color: AppColors.background,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
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
