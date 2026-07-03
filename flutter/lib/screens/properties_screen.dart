import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Properties.tsx`.
class PropertiesScreen extends StatefulWidget {
  const PropertiesScreen({super.key});
  @override
  State<PropertiesScreen> createState() => _PropertiesScreenState();
}

class _PropertiesScreenState extends State<PropertiesScreen> {
  String _listingType = 'rent';
  String _kind = '';
  late Future<List<Property>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchProperties(
      listingType: _listingType,
      propertyKind: _kind.isEmpty ? null : _kind,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _header()),
          SliverToBoxAdapter(child: _kindChips()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            sliver: SliverToBoxAdapter(
              child: FutureBuilder<List<Property>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(
                        padding: EdgeInsets.all(48),
                        child: Skeletons.list(count: 4));
                  }
                  final list = snap.data ?? [];
                  if (list.isEmpty) {
                    return const Padding(
                        padding: EdgeInsets.all(48),
                        child: Center(child: Text('No listings yet')));
                  }
                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 1,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.5,
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

  Widget _header() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, MediaQuery.of(context).padding.top + 12, 16, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0369A1), Color(0xFF1D4ED8), Color(0xFF3730A3)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(LucideIcons.arrowLeft, color: Colors.white)),
            const SizedBox(width: 4),
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(LucideIcons.home, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Real estate',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 20)),
                  Text(
                      'Apartments, houses, rooms, land & commercial spaces.',
                      style: TextStyle(color: Colors.white70, fontSize: 11)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(999),
            ),
            padding: const EdgeInsets.all(4),
            child: Row(
              children: [
                for (final t in const [
                  ('rent', 'Rent'),
                  ('sale', 'Buy'),
                  ('shared', 'Shared'),
                ])
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _listingType = t.$1;
                        _load();
                      }),
                      child: Container(
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _listingType == t.$1
                              ? Colors.white
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(t.$2,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: _listingType == t.$1
                                    ? AppColors.foreground
                                    : Colors.white)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _kindChips() {
    final chips = [('', 'All'), ...VerticalTaxonomy.propertyKinds];
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final c = chips[i];
          final active = _kind == c.$1;
          return GestureDetector(
            onTap: () => setState(() {
              _kind = c.$1;
              _load();
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? AppColors.foreground : AppColors.card,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(c.$2,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: active
                          ? AppColors.background
                          : AppColors.foreground)),
            ),
          );
        },
      ),
    );
  }

  Widget _card(Property p) {
    final showPeriod = p.listingType == 'rent' || p.listingType == 'shared';
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(20),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 10,
            child: Stack(
              children: [
                SizedBox.expand(
                  child: p.cover != null
                      ? Image.network(p.cover!, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              Container(color: AppColors.mutedSurface))
                      : Container(color: AppColors.mutedSurface),
                ),
                if (p.featured)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFBBF24),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text('FEATURED',
                          style: TextStyle(
                              fontSize: 9,
                              letterSpacing: 1.2,
                              fontWeight: FontWeight.w900)),
                    ),
                  ),
                Positioned(
                  bottom: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.95),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '\$${p.price.toStringAsFixed(0)}${showPeriod ? '/${p.pricePeriod}' : ''}',
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14)),
                if (p.city != null || p.country != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(children: [
                      const Icon(LucideIcons.mapPin,
                          size: 11, color: AppColors.muted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                            [p.city, p.country]
                                .whereType<String>()
                                .join(', '),
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.muted)),
                      ),
                    ]),
                  ),
                const SizedBox(height: 6),
                Row(children: [
                  if (p.bedrooms != null)
                    _spec(LucideIcons.bed, '${p.bedrooms}'),
                  if (p.baths != null) ...[
                    const SizedBox(width: 10),
                    _spec(LucideIcons.bath, '${p.baths}')
                  ],
                  if (p.areaSqm != null) ...[
                    const SizedBox(width: 10),
                    _spec(LucideIcons.maximize2, '${p.areaSqm}m²'),
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
          Icon(i, size: 11, color: AppColors.muted),
          const SizedBox(width: 3),
          Text(t,
              style: const TextStyle(fontSize: 11, color: AppColors.muted)),
        ],
      );
}
