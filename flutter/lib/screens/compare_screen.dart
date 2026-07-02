import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Compare.tsx` — side-by-side comparison of up to 4
/// products.
class CompareScreen extends StatelessWidget {
  const CompareScreen({super.key, required this.products});
  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Compare (${products.length})')),
      body: products.isEmpty
          ? const Center(child: Text('Add products from the wishlist to compare'))
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SingleChildScrollView(
                child: DataTable(
                  columns: [
                    const DataColumn(label: Text('Attribute')),
                    for (final p in products) DataColumn(label: SizedBox(width: 140, child: Text(p.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)))),
                  ],
                  rows: [
                    DataRow(cells: [
                      const DataCell(Text('Image')),
                      for (final p in products)
                        DataCell(SizedBox(
                          width: 120,
                          height: 100,
                          child: (p.image ?? '').isEmpty ? const Icon(LucideIcons.image, color: AppColors.muted) : CachedNetworkImage(imageUrl: p.image!, fit: BoxFit.contain),
                        )),
                    ]),
                    _row('Price', products.map((p) => '\$${p.price.toStringAsFixed(2)}').toList()),
                    _row('Rating', products.map((p) => '★ ${p.rating.toStringAsFixed(1)}').toList()),
                    _row('Sold', products.map((p) => '${p.sold}').toList()),
                    _row('Category', products.map((p) => p.category ?? '').toList()),
                    _row('Supplier', products.map((p) => p.supplierName ?? '').toList()),
                  ],
                ),
              ),
            ),
    );
  }

  DataRow _row(String label, List<String> cells) => DataRow(cells: [
        DataCell(Text(label, style: const TextStyle(fontWeight: FontWeight.w800))),
        for (final c in cells) DataCell(Text(c)),
      ]);
}
