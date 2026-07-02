import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';

import '../models/models.dart';
import 'product_card.dart';

/// Staggered grid — 2 cols mobile / 3 tablet / 4 desktop / 5 wide.
/// Mirrors `src/components/marketplace/MasonryGrid.tsx`.
class MasonryProductGrid extends StatelessWidget {
  const MasonryProductGrid({
    super.key,
    required this.products,
    this.onTap,
    this.onAdd,
    this.padding = const EdgeInsets.all(10),
  });

  final List<Product> products;
  final void Function(Product)? onTap;
  final void Function(Product)? onAdd;
  final EdgeInsets padding;

  int _columns(double w) {
    if (w >= 1400) return 5;
    if (w >= 1024) return 4;
    if (w >= 700) return 3;
    return 2;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = _columns(c.maxWidth);
        return Padding(
          padding: padding,
          child: MasonryGridView.count(
            crossAxisCount: cols,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            itemCount: products.length,
            itemBuilder: (context, i) {
              final p = products[i];
              return ProductCard(
                product: p,
                onTap: onTap == null ? null : () => onTap!(p),
                onAdd: onAdd == null ? null : () => onAdd!(p),
              );
            },
          ),
        );
      },
    );
  }
}
