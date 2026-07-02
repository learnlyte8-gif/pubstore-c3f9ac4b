import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';

import '../models/models.dart';
import 'product_card.dart';

/// Flex-column masonry mirror of `src/components/marketplace/MasonryGrid.tsx`.
class MasonryProductGrid extends StatelessWidget {
  const MasonryProductGrid({
    super.key,
    required this.products,
    this.onTap,
    this.onAdd,
    this.padding = const EdgeInsets.all(12),
    this.gap = 4,
  });

  final List<Product> products;
  final void Function(Product)? onTap;
  final void Function(Product)? onAdd;
  final EdgeInsets padding;
  final double gap;

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
        final columns = List.generate(cols, (_) => <Product>[]);
        for (var i = 0; i < products.length; i++) {
          columns[i % cols].add(products[i]);
        }
        return Padding(
          padding: padding,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var ci = 0; ci < columns.length; ci++) ...[
                if (ci > 0) SizedBox(width: gap),
                Expanded(
                  child: Column(
                    children: [
                      for (var pi = 0; pi < columns[ci].length; pi++) ...[
                        if (pi > 0) SizedBox(height: gap),
                        ProductCard(
                          product: columns[ci][pi],
                          onTap: onTap == null ? null : () => onTap!(columns[ci][pi]),
                          onAdd: onAdd == null ? null : () => onAdd!(columns[ci][pi]),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
