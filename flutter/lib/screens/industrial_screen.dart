import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models_ext.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Industrial.tsx`.
class IndustrialScreen extends StatefulWidget {
  const IndustrialScreen({super.key});
  @override
  State<IndustrialScreen> createState() => _IndustrialScreenState();
}

class _IndustrialScreenState extends State<IndustrialScreen> {
  static const _cats = [
    ('all', 'All'),
    ('machinery', 'Machinery'),
    ('metals', 'Metals'),
    ('chemicals', 'Chemicals'),
    ('electronics', 'Electronics'),
    ('materials', 'Materials'),
    ('automation', 'Automation'),
  ];
  String _cat = 'all';
  late Future<List<IndustrialListing>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchIndustrial(category: _cat);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _hero()),
          SliverToBoxAdapter(child: _chips()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            sliver: SliverToBoxAdapter(
              child: FutureBuilder<List<IndustrialListing>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Padding(
                        padding: EdgeInsets.all(48),
                        child: Center(child: CircularProgressIndicator()));
                  }
                  final list = snap.data ?? [];
                  if (list.isEmpty) {
                    return const Padding(
                        padding: EdgeInsets.all(48),
                        child: Center(child: Text('No listings yet')));
                  }
                  return Column(
                    children: list
                        .map((p) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _card(p),
                            ))
                        .toList(),
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
          16, MediaQuery.of(context).padding.top + 12, 16, 16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0C4A6E), Color(0xFF075985), Color(0xFF0369A1)],
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
              child: const Icon(LucideIcons.factory, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Industrial',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 20)),
                  Text('Machinery, metals, chemicals and automation — B2B.',
                      style: TextStyle(color: Colors.white70, fontSize: 11)),
                ],
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _chips() {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        itemCount: _cats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final c = _cats[i];
          final active = _cat == c.$1;
          return GestureDetector(
            onTap: () => setState(() {
              _cat = c.$1;
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

  Widget _card(IndustrialListing it) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(20),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            height: 120,
            child: it.cover != null
                ? Image.network(it.cover!, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        Container(color: AppColors.mutedSurface))
                : Container(color: AppColors.mutedSurface),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(it.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 14)),
                  const SizedBox(height: 2),
                  Text([it.category, it.subcategory]
                          .whereType<String>()
                          .join(' · '),
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.muted)),
                  const SizedBox(height: 8),
                  Row(children: [
                    if (it.price != null)
                      Text('\$${it.price!.toStringAsFixed(0)}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w900, fontSize: 14)),
                    if (it.moq != null) ...[
                      const SizedBox(width: 8),
                      Text('MOQ ${it.moq}',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.muted)),
                    ],
                  ]),
                  if (it.country != null || it.leadTime != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Row(children: [
                        if (it.country != null) ...[
                          const Icon(LucideIcons.mapPin,
                              size: 10, color: AppColors.muted),
                          const SizedBox(width: 3),
                          Text(it.country!,
                              style: const TextStyle(
                                  fontSize: 10, color: AppColors.muted)),
                        ],
                        if (it.leadTime != null) ...[
                          const SizedBox(width: 10),
                          const Icon(LucideIcons.clock,
                              size: 10, color: AppColors.muted),
                          const SizedBox(width: 3),
                          Text(it.leadTime!,
                              style: const TextStyle(
                                  fontSize: 10, color: AppColors.muted)),
                        ],
                      ]),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
