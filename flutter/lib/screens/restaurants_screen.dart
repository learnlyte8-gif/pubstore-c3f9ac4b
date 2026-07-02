import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Restaurants.tsx` — restaurant discovery with cuisine
/// chips and quick delivery estimates.
class RestaurantsScreen extends StatefulWidget {
  const RestaurantsScreen({super.key});
  @override
  State<RestaurantsScreen> createState() => _RestaurantsScreenState();
}

class _RestaurantsScreenState extends State<RestaurantsScreen> {
  String _cuisine = 'all';
  late Future<List<Map<String, dynamic>>> _future;

  static const _cuisines = ['all', 'Local', 'Fast food', 'Pizza', 'Chinese', 'Indian', 'Coffee', 'Bakery', 'Healthy'];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    dynamic q = supabase.from('restaurants').select('*').eq('active', true).order('rating', ascending: false);
    if (_cuisine != 'all') q = q.contains('cuisines', [_cuisine]);
    final rows = await q.limit(80);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  void _setCuisine(String c) => setState(() {
        _cuisine = c;
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Food & restaurants'),
        actions: [IconButton(icon: const Icon(LucideIcons.mapPin), onPressed: () {})],
      ),
      body: Column(children: [
        SizedBox(
          height: 40,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            scrollDirection: Axis.horizontal,
            itemCount: _cuisines.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final c = _cuisines[i];
              final active = c == _cuisine;
              return ChoiceChip(
                label: Text(c == 'all' ? 'All' : c),
                selected: active,
                onSelected: (_) => _setCuisine(c),
                selectedColor: AppColors.foreground,
                labelStyle: TextStyle(color: active ? Colors.white : AppColors.foreground, fontWeight: FontWeight.w700, fontSize: 12),
              );
            },
          ),
        ),
        Expanded(
          child: FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
              final rows = snap.data ?? const [];
              if (rows.isEmpty) return const Center(child: Text('No restaurants nearby yet'));
              return ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, i) {
                  final r = rows[i];
                  return _RestaurantCard(r: r);
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  const _RestaurantCard({required this.r});
  final Map<String, dynamic> r;
  @override
  Widget build(BuildContext context) {
    final cover = (r['cover'] ?? r['banner_url'] ?? '').toString();
    return Container(
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AspectRatio(
          aspectRatio: 16 / 9,
          child: cover.isEmpty
              ? Container(color: AppColors.mutedSurface, child: const Icon(LucideIcons.utensils, color: AppColors.muted, size: 36))
              : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${r['name'] ?? 'Restaurant'}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800))),
              const Icon(Icons.star, size: 14, color: Color(0xFFF59E0B)),
              const SizedBox(width: 2),
              Text('${(r['rating'] ?? 4.5).toString()}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 4),
            Text('${(r['cuisines'] is List ? (r['cuisines'] as List).join(' · ') : '')}', style: const TextStyle(color: AppColors.muted, fontSize: 12)),
            const SizedBox(height: 8),
            Row(children: [
              _pill(LucideIcons.clock, '${r['prep_min'] ?? 20}-${r['prep_max'] ?? 35} min'),
              const SizedBox(width: 8),
              _pill(LucideIcons.bike, '\$${(r['delivery_fee'] ?? 2).toString()} delivery'),
              const SizedBox(width: 8),
              if ((r['distance_km'] ?? 0) != 0) _pill(LucideIcons.mapPin, '${r['distance_km']} km'),
            ]),
          ]),
        ),
      ]),
    );
  }

  Widget _pill(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: AppColors.mutedSurface, borderRadius: BorderRadius.circular(99)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 12, color: AppColors.muted),
          const SizedBox(width: 4),
          Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ]),
      );
}
