import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/models.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/product_card.dart';

/// Mirrors `src/pages/Supplier.tsx` — public supplier storefront: banner,
/// header, badges, and their live product grid.
class SupplierScreen extends StatefulWidget {
  const SupplierScreen({super.key, required this.supplierId});
  final String supplierId;

  @override
  State<SupplierScreen> createState() => _SupplierScreenState();
}

class _SupplierScreenState extends State<SupplierScreen> {
  Map<String, dynamic>? _supplier;
  List<Product> _products = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await supabase.from('suppliers').select('*').eq('id', widget.supplierId).maybeSingle();
      final rows = await supabase
          .from('products')
          .select('*')
          .eq('supplier_id', widget.supplierId)
          .eq('active', true)
          .order('created_at', ascending: false)
          .limit(80);
      if (!mounted) return;
      setState(() {
        _supplier = s == null ? null : Map<String, dynamic>.from(s);
        _products = (rows as List).map((e) => Product.fromRow(Map<String, dynamic>.from(e))).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final s = _supplier;
    if (s == null) return const Scaffold(body: Center(child: Text('Supplier not found')));
    final banner = (s['banner_url'] ?? '').toString();
    final avatar = (s['logo_url'] ?? '').toString();
    return Scaffold(
      body: CustomScrollView(slivers: [
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            title: Text(s['name']?.toString() ?? 'Supplier', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
            background: banner.isEmpty ? Container(color: AppColors.mutedSurface) : CachedNetworkImage(imageUrl: banner, fit: BoxFit.cover),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                CircleAvatar(radius: 30, backgroundColor: AppColors.mutedSurface, backgroundImage: avatar.isNotEmpty ? CachedNetworkImageProvider(avatar) : null, child: avatar.isEmpty ? const Icon(LucideIcons.store, size: 24) : null),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(s['name']?.toString() ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                    if ((s['tagline'] ?? '').toString().isNotEmpty) Text(s['tagline'], style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                  ]),
                ),
                if (s['verified'] == true) const Icon(LucideIcons.badgeCheck, color: AppColors.primary),
              ]),
              const SizedBox(height: 14),
              Row(children: [
                _stat('${s['rating'] ?? '—'}', '★ Rating'),
                const SizedBox(width: 24),
                _stat('${s['orders_fulfilled'] ?? 0}', 'Orders'),
                const SizedBox(width: 24),
                _stat('${_products.length}', 'Products'),
              ]),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: FilledButton.icon(onPressed: () {}, icon: const Icon(LucideIcons.messageCircle, size: 16), label: const Text('Message'))),
                const SizedBox(width: 10),
                Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(LucideIcons.userPlus, size: 16), label: const Text('Follow'))),
              ]),
              const SizedBox(height: 16),
              if ((s['about'] ?? '').toString().isNotEmpty)
                Text(s['about'], style: const TextStyle(height: 1.4)),
            ]),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.all(12),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.68),
            delegate: SliverChildBuilderDelegate((_, i) => ProductCard(product: _products[i]), childCount: _products.length),
          ),
        ),
      ]),
    );
  }

  Widget _stat(String v, String l) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(v, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
        Text(l, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
      ]);
}
