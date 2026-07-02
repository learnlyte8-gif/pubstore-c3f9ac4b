import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/auth_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/masonry_grid.dart';
import 'product_detail_screen.dart';

/// Wishlist — mirrors `src/pages/Wishlist.tsx`.
class WishlistScreen extends ConsumerStatefulWidget {
  const WishlistScreen({super.key});

  @override
  ConsumerState<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends ConsumerState<WishlistScreen> {
  Future<List<Product>>? _future;

  Future<List<Product>> _fetch(String uid) async {
    final rows = await supabase
        .from('saves')
        .select('product:products(id, title, price, currency, images, '
            'category, rating, sold, supplier_id)')
        .eq('user_id', uid)
        .order('created_at', ascending: false);
    return (rows as List)
        .map((r) => (r as Map)['product'])
        .where((p) => p != null)
        .map((p) => Product.fromRow((p as Map).cast<String, dynamic>()))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Wishlist')),
        body: const Center(
            child: Text('Sign in to save products',
                style: TextStyle(color: AppColors.muted))),
      );
    }
    _future ??= _fetch(user.id);
    return Scaffold(
      appBar: AppBar(
          title: const Text('Wishlist',
              style: TextStyle(fontWeight: FontWeight.w800))),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _fetch(user.id)),
        child: FutureBuilder<List<Product>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 100),
                Center(
                    child: Icon(LucideIcons.heart,
                        size: 40, color: AppColors.muted)),
                SizedBox(height: 8),
                Center(
                    child: Text('Nothing saved yet',
                        style: TextStyle(color: AppColors.muted))),
              ]);
            }
            return SingleChildScrollView(
              child: MasonryProductGrid(
                products: items,
                onTap: (p) => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => ProductDetailScreen(product: p))),
              ),
            );
          },
        ),
      ),
    );
  }
}
