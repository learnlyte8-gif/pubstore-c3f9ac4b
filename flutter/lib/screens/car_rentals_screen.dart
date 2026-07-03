import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/CarRentals.tsx` — browse rental cars with body-type
/// filters and daily-rate cards.
class CarRentalsScreen extends StatefulWidget {
  const CarRentalsScreen({super.key});
  @override
  State<CarRentalsScreen> createState() => _CarRentalsScreenState();
}

class _CarRentalsScreenState extends State<CarRentalsScreen> {
  String _body = 'all';
  late Future<List<Map<String, dynamic>>> _future;

  static const _bodyTypes = ['all', 'sedan', 'suv', 'hatchback', 'pickup', 'van', 'luxury'];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    dynamic q = supabase
        .from('car_rentals')
        .select('*')
        .eq('active', true)
        .order('featured', ascending: false)
        .order('created_at', ascending: false);
    if (_body != 'all') q = q.eq('body_type', _body);
    final rows = await q.limit(80);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  void _set(String b) => setState(() {
        _body = b;
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Car rentals')),
      body: Column(children: [
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0F172A), Color(0xFF1E293B)]),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Drive anywhere in Zimbabwe', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('Verified operators · daily and long-term rentals', style: TextStyle(color: Colors.white.withOpacity(.7), fontSize: 12)),
          ]),
        ),
        SizedBox(
          height: 44,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            scrollDirection: Axis.horizontal,
            itemCount: _bodyTypes.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final b = _bodyTypes[i];
              final active = b == _body;
              return ChoiceChip(
                label: Text(b == 'all' ? 'All' : b[0].toUpperCase() + b.substring(1)),
                selected: active,
                onSelected: (_) => _set(b),
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
              if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
              final rows = snap.data ?? const [];
              if (rows.isEmpty) return const Center(child: Text('No rentals available'));
              return GridView.builder(
                padding: const EdgeInsets.all(12),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
                itemCount: rows.length,
                itemBuilder: (context, i) => _RentalCard(row: rows[i]),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _RentalCard extends StatelessWidget {
  const _RentalCard({required this.row});
  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final cover = (row['cover'] ?? '').toString();
    final rate = row['daily_rate'] ?? row['price_per_day'] ?? 0;
    return Container(
      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: cover.isEmpty ? Container(color: AppColors.mutedSurface, child: const Icon(LucideIcons.car, color: AppColors.muted, size: 36)) : CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover),
        ),
        Padding(
          padding: const EdgeInsets.all(10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${row['make'] ?? ''} ${row['model'] ?? ''}'.trim(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text('${row['year'] ?? ''} · ${row['transmission'] ?? ''} · ${row['fuel'] ?? ''}', style: const TextStyle(fontSize: 11, color: AppColors.muted), maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            Row(children: [
              Text('\$$rate', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.priceRed)),
              const Text('/day', style: TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w700)),
            ]),
          ]),
        ),
      ]),
    );
  }
}
