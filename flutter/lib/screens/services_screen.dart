import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Services.tsx` — three tabs (find pros, tasks, post).
class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});
  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  String _tab = 'find';
  String _category = '';
  late Future<List<ServiceProvider>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchServiceProviders(
        category: _category.isEmpty ? null : _category);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _header()),
          if (_tab == 'find') ...[
            SliverToBoxAdapter(child: _chips()),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
              sliver: SliverToBoxAdapter(
                child: FutureBuilder<List<ServiceProvider>>(
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
                        child: Center(child: Text('No providers yet')),
                      );
                    }
                    return Column(
                      children: list
                          .map((p) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _providerCard(p),
                              ))
                          .toList(),
                    );
                  },
                ),
              ),
            ),
          ] else
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(48),
                child: Center(
                    child: Text('Coming soon in the mobile app',
                        style: TextStyle(color: AppColors.muted))),
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
          colors: [Color(0xFF7C3AED), Color(0xFFD946EF), Color(0xFFEC4899)],
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
              child: const Icon(LucideIcons.wrench, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Local services',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 20)),
                  Text('Plumbers, electricians, tutors — verified & rated.',
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
                  ('find', 'Find pros'),
                  ('tasks', 'Open tasks'),
                  ('post', 'Post a task'),
                ])
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _tab = t.$1),
                      child: Container(
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _tab == t.$1
                              ? Colors.white
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(t.$2,
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: _tab == t.$1
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

  Widget _chips() {
    final chips = [('', 'All'), ...VerticalTaxonomy.services];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: chips.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final c = chips[i];
          final active = _category == c.$1;
          return GestureDetector(
            onTap: () => setState(() {
              _category = c.$1;
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
                      color: active ? AppColors.background : AppColors.foreground)),
            ),
          );
        },
      ),
    );
  }

  Widget _providerCard(ServiceProvider p) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 80,
              height: 80,
              child: p.cover != null
                  ? Image.network(p.cover!, fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          Container(color: AppColors.mutedSurface))
                  : Container(color: AppColors.mutedSurface),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                    child: Text(p.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 14)),
                  ),
                  const Icon(LucideIcons.star,
                      size: 12, color: Color(0xFFF59E0B)),
                  const SizedBox(width: 2),
                  Text(p.rating.toStringAsFixed(1),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 10)),
                ]),
                Text(
                    p.subcategory == null
                        ? p.category
                        : '${p.category} · ${p.subcategory}',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.muted)),
                if (p.city != null || p.country != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(children: [
                      const Icon(LucideIcons.mapPin,
                          size: 10, color: AppColors.muted),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                            [p.city, p.country]
                                .whereType<String>()
                                .join(', '),
                            style: const TextStyle(
                                fontSize: 10, color: AppColors.muted)),
                      ),
                    ]),
                  ),
                if (p.hourlyRate != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('\$${p.hourlyRate!.toStringAsFixed(0)}/hr',
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 4,
                  children: [
                    if (p.phone != null)
                      _pill(LucideIcons.phone, 'Call',
                          AppColors.primary.withOpacity(0.1),
                          AppColors.primary),
                    if (p.whatsapp != null)
                      _pill(LucideIcons.messageCircle, 'WhatsApp',
                          const Color(0x2610B981), const Color(0xFF047857)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pill(IconData icon, String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 10, color: fg),
        const SizedBox(width: 4),
        Text(label,
            style: TextStyle(
                fontSize: 10, fontWeight: FontWeight.w800, color: fg)),
      ]),
    );
  }
}
