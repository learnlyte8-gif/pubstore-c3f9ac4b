import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../screens/supplier_screen.dart';
import '../../services/supabase_client.dart';
import '../../theme/palette.dart';

/// Flutter port of `src/components/marketplace/SupplierStories.tsx` — a
/// horizontal strip of verified suppliers with their latest product as a
/// "story" thumbnail. Tap opens the supplier screen.
class SupplierStories extends StatefulWidget {
  const SupplierStories({super.key});
  @override
  State<SupplierStories> createState() => _SupplierStoriesState();
}

class _SupplierStoriesState extends State<SupplierStories> {
  List<_Story> _stories = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      var suppliers = await supabase
          .from('suppliers')
          .select('id,name,logo,country,verified')
          .eq('verified', true)
          .limit(20);
      if ((suppliers as List).isEmpty) {
        suppliers = await supabase
            .from('suppliers')
            .select('id,name,logo,country,verified')
            .limit(20);
      }
      final list = (suppliers as List)
          .map((r) => Map<String, dynamic>.from(r as Map))
          .toList();
      if (list.isEmpty) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      final ids =
          list.map((s) => s['id'].toString()).toList(growable: false);
      final products = await supabase
          .from('products')
          .select('id,title,image,price,created_at,supplier_id')
          .inFilter('supplier_id', ids)
          .eq('active', true)
          .order('created_at', ascending: false);
      final latest = <String, Map<String, dynamic>>{};
      for (final p in (products as List)) {
        final m = Map<String, dynamic>.from(p as Map);
        final sid = m['supplier_id'] as String?;
        if (sid != null && !latest.containsKey(sid)) {
          latest[sid] = m;
        }
      }
      final stories = <_Story>[];
      for (final s in list) {
        final p = latest[s['id']];
        if (p == null) continue;
        final createdAt =
            DateTime.tryParse(p['created_at']?.toString() ?? '') ??
                DateTime.now();
        final isNew =
            DateTime.now().difference(createdAt).inDays < 7;
        stories.add(_Story(
          supplier: s,
          product: p,
          headline:
              '${isNew ? "Just listed" : "Featured"}: ${p['title']}',
        ));
      }
      if (!mounted) return;
      setState(() {
        _stories = stories;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _stories.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: _stories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (_, i) {
          final s = _stories[i];
          final logo = s.supplier['logo'] as String?;
          final img = s.product['image'] as String?;
          final name = s.supplier['name'] as String? ?? 'Supplier';
          return GestureDetector(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => SupplierScreen(
                    supplierId: s.supplier['id'] as String))),
            child: SizedBox(
              width: 72,
              child: Column(children: [
                Stack(clipBehavior: Clip.none, children: [
                  Container(
                    width: 60,
                    height: 60,
                    padding: const EdgeInsets.all(2.5),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(colors: [
                        Color(0xFFF59E0B),
                        Color(0xFFE11D48),
                      ]),
                    ),
                    child: CircleAvatar(
                      backgroundColor: AppColors.mutedSurface,
                      backgroundImage: (logo != null && logo.isNotEmpty)
                          ? CachedNetworkImageProvider(logo)
                          : ((img != null && img.isNotEmpty)
                              ? CachedNetworkImageProvider(img)
                              : null),
                      child: (logo == null && img == null)
                          ? Text(name[0].toUpperCase(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900))
                          : null,
                    ),
                  ),
                  if (s.supplier['verified'] == true)
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: AppColors.background, width: 2),
                        ),
                        child: const Icon(LucideIcons.check,
                            size: 10, color: Colors.white),
                      ),
                    ),
                ]),
                const SizedBox(height: 4),
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 10, fontWeight: FontWeight.w700)),
              ]),
            ),
          );
        },
      ),
    );
  }
}

class _Story {
  _Story(
      {required this.supplier,
      required this.product,
      required this.headline});
  final Map<String, dynamic> supplier;
  final Map<String, dynamic> product;
  final String headline;
}
