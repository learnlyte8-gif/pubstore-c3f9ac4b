import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models_ext.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Auto.tsx` — dark hero + grid.
class AutoScreen extends StatefulWidget {
  const AutoScreen({super.key});
  @override
  State<AutoScreen> createState() => _AutoScreenState();
}

class _AutoScreenState extends State<AutoScreen> {
  static const _kinds = [
    ('all', 'All'),
    ('car', 'Cars'),
    ('ev', 'EVs'),
    ('truck', 'Trucks'),
    ('bike', 'Bikes'),
    ('parts', 'Parts'),
  ];
  String _kind = 'all';
  String _sort = 'newest';
  late Future<List<Vehicle>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchVehicles(kind: _kind);
  }

  List<Vehicle> _sortList(List<Vehicle> v) {
    final list = [...v];
    list.sort((a, b) {
      switch (_sort) {
        case 'price_asc':
          return a.price.compareTo(b.price);
        case 'price_desc':
          return b.price.compareTo(a.price);
        case 'low_km':
          return (a.mileageKm ?? 1 << 30)
              .compareTo(b.mileageKm ?? 1 << 30);
        case 'power':
          return (b.powerHp ?? 0).compareTo(a.powerHp ?? 0);
        default:
          return (b.year ?? 0).compareTo(a.year ?? 0);
      }
    });
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _hero()),
          SliverToBoxAdapter(child: _kindChips()),
          SliverToBoxAdapter(child: _sortRow()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            sliver: SliverToBoxAdapter(
              child: FutureBuilder<List<Vehicle>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(
                        padding: EdgeInsets.all(48),
                        child: Center(child: CircularProgressIndicator()));
                  }
                  final list = _sortList(snap.data ?? []);
                  if (list.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.all(48),
                      child: Center(
                          child: Text('No vehicles yet',
                              style: TextStyle(color: Color(0xFF71717A)))),
                    );
                  }
                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.7,
                    ),
                    itemCount: list.length,
                    itemBuilder: (_, i) => _card(list[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          20, MediaQuery.of(context).padding.top + 16, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon:
                    const Icon(LucideIcons.arrowLeft, color: Colors.white)),
            const Spacer(),
          ]),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white24),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.car, size: 11, color: Color(0xFFD4D4D8)),
              SizedBox(width: 4),
              Text('DEPARTMENT · AUTO',
                  style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 9,
                      letterSpacing: 3.5,
                      color: Color(0xFFD4D4D8),
                      fontWeight: FontWeight.w800)),
            ]),
          ),
          const SizedBox(height: 12),
          const Text('Drive',
              style: TextStyle(
                  fontSize: 44,
                  height: 0.9,
                  letterSpacing: -1.5,
                  fontWeight: FontWeight.w900,
                  color: Colors.white)),
          const Text('harder.',
              style: TextStyle(
                  fontSize: 44,
                  height: 0.9,
                  letterSpacing: -1.5,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFFA1A1AA))),
          const SizedBox(height: 10),
          const Text(
              'Cars, classics, EVs, trucks, motorcycles and OEM parts — direct from verified dealers and brands.',
              style: TextStyle(color: Color(0xFFA1A1AA), fontSize: 12)),
        ],
      ),
    );
  }

  Widget _kindChips() {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _kinds.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final k = _kinds[i];
          final active = _kind == k.$1;
          return GestureDetector(
            onTap: () => setState(() {
              _kind = k.$1;
              _load();
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color:
                    active ? Colors.white : Colors.white.withOpacity(0.08),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(k.$2,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color:
                          active ? const Color(0xFF09090B) : Colors.white)),
            ),
          );
        },
      ),
    );
  }

  Widget _sortRow() {
    const opts = [
      ('newest', 'Newest'),
      ('price_asc', 'Price ↑'),
      ('price_desc', 'Price ↓'),
      ('low_km', 'Lowest km'),
      ('power', 'Most power'),
    ];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
        itemCount: opts.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final o = opts[i];
          final active = _sort == o.$1;
          return GestureDetector(
            onTap: () => setState(() => _sort = o.$1),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active
                    ? const Color(0xFF3B82F6)
                    : Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(o.$2,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: active
                          ? Colors.white
                          : const Color(0xFFA1A1AA))),
            ),
          );
        },
      ),
    );
  }

  Widget _card(Vehicle v) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF18181B),
        border: Border.all(color: const Color(0xFF27272A)),
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: v.cover != null
                ? Image.network(v.cover!, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        Container(color: const Color(0xFF27272A)))
                : Container(color: const Color(0xFF27272A)),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(v.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: Colors.white)),
                const SizedBox(height: 2),
                Text([v.make, v.model, v.year?.toString()]
                        .whereType<String>()
                        .join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 10.5, color: Color(0xFFA1A1AA))),
                const SizedBox(height: 6),
                Text('\$${v.price.toStringAsFixed(0)}',
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: Colors.white)),
                const SizedBox(height: 6),
                Row(children: [
                  if (v.mileageKm != null)
                    _spec(LucideIcons.gauge, '${v.mileageKm}km'),
                  if (v.fuel != null) ...[
                    const SizedBox(width: 8),
                    _spec(LucideIcons.fuel, v.fuel!),
                  ],
                  if (v.powerHp != null) ...[
                    const SizedBox(width: 8),
                    _spec(LucideIcons.zap, '${v.powerHp}hp'),
                  ],
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _spec(IconData i, String t) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(i, size: 10, color: const Color(0xFFA1A1AA)),
          const SizedBox(width: 2),
          Text(t,
              style: const TextStyle(
                  fontSize: 10, color: Color(0xFFA1A1AA))),
        ],
      );
}
