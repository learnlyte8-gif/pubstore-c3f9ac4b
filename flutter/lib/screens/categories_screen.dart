import 'package:flutter/material.dart';

import '../models/models.dart';
import '../services/catalog_service.dart';
import '../theme/palette.dart';
import '../theme/theme.dart';

/// Categories grid — reads `categories` from Lovable Cloud. Tapping a
/// category will filter the Home feed (wired up in the next iteration).
class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, this.onCategorySelected});

  final void Function(Category category)? onCategorySelected;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  late Future<List<Category>> _future;

  @override
  void initState() {
    super.initState();
    _future = catalog.fetchCategories();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        appBar: AppBar(title: const Text('Categories')),
      body: FutureBuilder<List<Category>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(
              child: Text('Failed to load: ${snap.error}',
                  style: const TextStyle(color: AppColors.muted)),
            );
          }
          final cats = snap.data ?? [];
          if (cats.isEmpty) {
            return const Center(child: Text('No categories yet.'));
          }
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.95,
            ),
            itemCount: cats.length,
            itemBuilder: (context, i) {
              final c = cats[i];
              return Material(
                color: AppColors.mutedSurface,
                borderRadius: BorderRadius.circular(AppRadii.md),
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  onTap: () => widget.onCategorySelected?.call(c),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(c.icon ?? '📦',
                            style: const TextStyle(fontSize: 28)),
                        const SizedBox(height: 8),
                        Text(
                          c.name,
                          maxLines: 2,
                          textAlign: TextAlign.center,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
