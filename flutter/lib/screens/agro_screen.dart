import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models_ext.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Agro.tsx`.
class AgroScreen extends StatefulWidget {
  const AgroScreen({super.key});
  @override
  State<AgroScreen> createState() => _AgroScreenState();
}

class _AgroScreenState extends State<AgroScreen> {
  static const _kinds = [
    ('all', 'All', LucideIcons.sprout),
    ('produce', 'Produce', LucideIcons.leaf),
    ('equipment', 'Machinery', LucideIcons.tractor),
    ('inputs', 'Inputs', LucideIcons.droplets),
    ('livestock', 'Livestock', LucideIcons.egg),
    ('services', 'Services', LucideIcons.shieldCheck),
    ('project', 'Projects', LucideIcons.trendingUp),
  ];
  String _cat = 'all';
  late Future<List<AgroListing>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchAgro(kind: _cat);
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
              child: FutureBuilder<List<AgroListing>>(
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
                        child: Center(child: Text('No agro listings yet')));
                  }
                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 0.72,
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
      margin: EdgeInsets.fromLTRB(
          16, MediaQuery.of(context).padding.top + 8, 16, 4),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF064E3B), Color(0xFF065F46), Color(0xFF4D7C0F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('DEPARTMENT · AGRO',
              style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 9,
                  letterSpacing: 3.8,
                  color: Color(0xFFBEF264),
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          const Text('Farm to factory,\nco-investible.',
              style: TextStyle(
                  fontSize: 26,
                  height: 1.1,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  color: Color(0xFFECFCCB))),
          const SizedBox(height: 8),
          const Text(
              'Fresh produce, machinery, inputs, livestock and co-op projects — vetted farms & suppliers.',
              style: TextStyle(fontSize: 12, color: Color(0xFFD9F99D))),
        ],
      ),
    );
  }

  Widget _chips() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        itemCount: _kinds.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final k = _kinds[i];
          final active = _cat == k.$1;
          return GestureDetector(
            onTap: () => setState(() {
              _cat = k.$1;
              _load();
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? AppColors.foreground : AppColors.card,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(k.$3,
                    size: 12,
                    color: active
                        ? AppColors.background
                        : AppColors.foreground),
                const SizedBox(width: 4),
                Text(k.$2,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: active
                            ? AppColors.background
                            : AppColors.foreground)),
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _card(AgroListing a) {
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
            aspectRatio: 4 / 3,
            child: Stack(children: [
              SizedBox.expand(
                child: a.cover != null
                    ? Image.network(a.cover!, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            Container(color: AppColors.mutedSurface))
                    : Container(color: AppColors.mutedSurface),
              ),
              if (a.organic)
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                        color: const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(6)),
                    child: const Text('ORGANIC',
                        style: TextStyle(
                            fontSize: 8,
                            letterSpacing: 1.2,
                            color: Colors.white,
                            fontWeight: FontWeight.w900)),
                  ),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(a.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        height: 1.15)),
                if (a.subcategory != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(a.subcategory!,
                        style: const TextStyle(
                            fontSize: 10.5, color: AppColors.muted)),
                  ),
                const SizedBox(height: 6),
                if (a.price != null)
                  Text(
                      '\$${a.price!.toStringAsFixed(0)}${a.unit != null ? '/${a.unit}' : ''}',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w900)),
                if (a.moq != null)
                  Text('MOQ ${a.moq}',
                      style: const TextStyle(
                          fontSize: 10, color: AppColors.muted)),
                if (a.region != null || a.country != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(children: [
                      const Icon(LucideIcons.mapPin,
                          size: 10, color: AppColors.muted),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                            [a.region, a.country]
                                .whereType<String>()
                                .join(', '),
                            style: const TextStyle(
                                fontSize: 10, color: AppColors.muted)),
                      ),
                    ]),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
