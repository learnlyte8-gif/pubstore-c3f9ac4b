import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/Finance.tsx`.
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});
  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  String _kind = '';
  late Future<List<FinanceProduct>> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    _future = verticals.fetchFinanceProducts(kind: _kind.isEmpty ? null : _kind);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _header()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            sliver: SliverToBoxAdapter(
              child: FutureBuilder<List<FinanceProduct>>(
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
                        child: Center(child: Text('No products yet')));
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

  Widget _header() {
    final chips = [('', 'All'), ...VerticalTaxonomy.financeKinds];
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, MediaQuery.of(context).padding.top + 12, 16, 14),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF047857), Color(0xFF0F766E), Color(0xFF0E7490)],
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
              child: const Icon(LucideIcons.banknote, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Finance & insurance',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 20)),
                  Text('Loans, vehicle financing, working capital, insurance.',
                      style: TextStyle(color: Colors.white70, fontSize: 11)),
                ],
              ),
            ),
          ]),
          const SizedBox(height: 10),
          SizedBox(
            height: 32,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
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
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: active
                          ? Colors.white
                          : Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(c.$2,
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: active
                                ? AppColors.foreground
                                : Colors.white)),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(FinanceProduct p) {
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
            aspectRatio: 16 / 9,
            child: Stack(children: [
              SizedBox.expand(
                child: p.cover != null
                    ? Image.network(p.cover!, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Color(0xFF047857),
                                  Color(0xFF0F766E)
                                ],
                              ),
                            )))
                    : Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF047857), Color(0xFF0F766E)],
                          ),
                        ),
                      ),
              ),
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.95),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    p.kind.replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(
                        fontSize: 9, fontWeight: FontWeight.w900),
                  ),
                ),
              ),
              if (p.featured)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFBBF24),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text('FEATURED',
                        style: TextStyle(
                            fontSize: 9, fontWeight: FontWeight.w900)),
                  ),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14)),
                if (p.providerName != null)
                  Text('by ${p.providerName}',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.muted)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    if (p.interestRate != null)
                      _chip(LucideIcons.percent,
                          '${p.interestRate!.toStringAsFixed(1)}% APR'),
                    if (p.termMonths != null)
                      _chip(LucideIcons.calendar, '${p.termMonths}mo'),
                    if (p.minAmount != null || p.maxAmount != null)
                      _chip(
                          null,
                          '\$${p.minAmount?.toStringAsFixed(0) ?? '0'}–\$${p.maxAmount?.toStringAsFixed(0) ?? '∞'}'),
                  ],
                ),
                if (p.features.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  for (final f in p.features.take(3))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(LucideIcons.check,
                              size: 12, color: Color(0xFF059669)),
                          const SizedBox(width: 4),
                          Expanded(
                              child: Text(f,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 11))),
                        ],
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chip(IconData? icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.mutedSurface,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          Icon(icon, size: 11),
          const SizedBox(width: 3)
        ],
        Text(label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
      ]),
    );
  }
}
