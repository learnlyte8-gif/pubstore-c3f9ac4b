import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Stays.tsx` index (list + hero).
class StaysScreen extends StatefulWidget {
  const StaysScreen({super.key});
  @override
  State<StaysScreen> createState() => _StaysScreenState();
}

class _StaysScreenState extends State<StaysScreen> {
  String _kind = 'all';
  String _sort = 'rating';
  late Future<List<Stay>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchStays(kind: _kind);
  }

  List<Stay> _sortStays(List<Stay> stays) {
    final list = [...stays];
    list.sort((a, b) {
      switch (_sort) {
        case 'price_asc':
          return a.pricePerNight.compareTo(b.pricePerNight);
        case 'price_desc':
          return b.pricePerNight.compareTo(a.pricePerNight);
        case 'reviews':
          return b.reviewCount.compareTo(a.reviewCount);
        default:
          return b.rating.compareTo(a.rating);
      }
    });
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Stays'),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: FutureBuilder<List<Stay>>(
        future: _future,
        builder: (context, snap) {
          final loading = snap.connectionState != ConnectionState.done;
          final stays = _sortStays(snap.data ?? []);
          return ListView(
            padding: const EdgeInsets.only(bottom: 40),
            children: [
              _hero(),
              _kindChips(),
              _sortRow(),
              if (loading)
                const Padding(
                    padding: EdgeInsets.all(48),
                    child: Skeletons.list(count: 4))
              else if (stays.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: Text('No stays match your filters.')),
                )
              else
                GridView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 12,
                    childAspectRatio: 0.62,
                  ),
                  itemCount: stays.length,
                  itemBuilder: (context, i) => GestureDetector(
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => StayDetailScreen(stay: stays[i]))),
                    behavior: HitTestBehavior.opaque,
                    child: _stayCard(stays[i]),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _hero() {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFEF3C7), Color(0xFFFFE4E6), Color(0xFFFED7AA)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
                color: const Color(0x33F59E0B),
                borderRadius: BorderRadius.circular(999)),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(LucideIcons.sparkles, size: 12, color: Color(0xFF92400E)),
              SizedBox(width: 4),
              Text('PUBSTORE STAYS',
                  style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.4,
                      color: Color(0xFF92400E))),
            ]),
          ),
          const SizedBox(height: 8),
          const Text('Stay where the\nmakers live.',
              style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: 28,
                  height: 1.05,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF18181B))),
          const SizedBox(height: 8),
          const Text(
              'Curated B&Bs, designer apartments and supplier-hosted factory tours — vetted by PUBSTORE.',
              style: TextStyle(fontSize: 12, color: Color(0xFF3F3F46))),
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
        itemCount: VerticalTaxonomy.stayKinds.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final k = VerticalTaxonomy.stayKinds[i];
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
                color: active ? AppColors.foreground : AppColors.card,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(k.$2,
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

  Widget _sortRow() {
    const opts = [
      ('rating', 'Top rated'),
      ('price_asc', 'Price ↑'),
      ('price_desc', 'Price ↓'),
      ('reviews', 'Most reviewed'),
    ];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
        itemCount: opts.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final o = opts[i];
          final active = _sort == o.$1;
          return GestureDetector(
            onTap: () => setState(() => _sort = o.$1),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? AppColors.primary : AppColors.mutedSurface,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(o.$2,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color:
                          active ? Colors.white : AppColors.foreground)),
            ),
          );
        },
      ),
    );
  }

  Widget _stayCard(Stay s) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox.expand(
                  child: s.cover != null
                      ? Image.network(s.cover!, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              Container(color: AppColors.mutedSurface))
                      : Container(color: AppColors.mutedSurface),
                ),
              ),
              if (s.superhost)
                Positioned(
                  top: 10,
                  left: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFBBF24),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text('SUPERHOST',
                        style: TextStyle(
                            fontSize: 9,
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w900)),
                  ),
                ),
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(LucideIcons.star,
                        size: 11, color: Color(0xFFF59E0B)),
                    const SizedBox(width: 3),
                    Text(s.rating.toStringAsFixed(2),
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w800)),
                  ]),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(s.kind.toUpperCase(),
            style: const TextStyle(
                fontSize: 10,
                letterSpacing: 1.4,
                fontWeight: FontWeight.w900,
                color: AppColors.muted)),
        Text(s.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                fontFamily: 'serif', fontSize: 15, height: 1.2)),
        const SizedBox(height: 2),
        Row(children: [
          const Icon(LucideIcons.mapPin, size: 11, color: AppColors.muted),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
                [s.city, s.country].whereType<String>().join(', '),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
          ),
        ]),
        const SizedBox(height: 4),
        RichText(
          text: TextSpan(
            style: DefaultTextStyle.of(context).style,
            children: [
              TextSpan(
                  text: '\$${s.pricePerNight.round()}',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w800)),
              TextSpan(
                  text: ' / night · ${s.reviewCount} reviews',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}
