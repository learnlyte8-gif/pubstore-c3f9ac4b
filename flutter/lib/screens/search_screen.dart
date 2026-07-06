import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/tapson_sheet.dart';
import '../widgets/skeletons.dart';
import 'product_detail_screen.dart';
import '../models/models.dart';
import 'supplier_screen.dart';

/// Universal search — mirrors `src/pages/Search.tsx`.
/// Searches across products, suppliers, services, properties, vehicles,
/// stays, industrial listings and news articles in parallel, then ranks
/// results client-side by relevance.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

// ─────────────────────── model ───────────────────────

enum _Kind { product, supplier, service, property, vehicle, stay, industrial, news }

class _Hit {
  _Hit({
    required this.id,
    required this.kind,
    required this.title,
    this.description,
    this.image,
    this.price,
    this.currency = '\$',
    this.rating = 0,
    this.city,
    this.country,
    this.verified = false,
    this.freeShipping = false,
    this.moq,
    this.payload,
  });
  final String id;
  final _Kind kind;
  final String title;
  final String? description;
  final String? image;
  final double? price;
  final String currency;
  final double rating;
  final String? city;
  final String? country;
  final bool verified;
  final bool freeShipping;
  final int? moq;
  final Map<String, dynamic>? payload;
}

const _kindMeta = <_Kind, ({String label, IconData icon})>{
  _Kind.product: (label: 'Products', icon: LucideIcons.package),
  _Kind.supplier: (label: 'Suppliers', icon: LucideIcons.store),
  _Kind.service: (label: 'Services', icon: LucideIcons.wrench),
  _Kind.property: (label: 'Property', icon: LucideIcons.home),
  _Kind.vehicle: (label: 'Vehicles', icon: LucideIcons.car),
  _Kind.stay: (label: 'Stays', icon: LucideIcons.bed),
  _Kind.industrial: (label: 'Industrial', icon: LucideIcons.factory),
  _Kind.news: (label: 'News', icon: LucideIcons.newspaper),
};

// Trending prompts (mirror of RotatingHint on web).
const _trending = [
  '🎧 Wireless earbuds bulk',
  '👕 Cotton t-shirts wholesale',
  '📱 Refurbished iPhones',
  '🏠 2 bedroom apartment',
  '🚗 Toyota Vitz for sale',
  '🍔 Fast food delivery',
  '🔧 Plumber near me',
  '💰 Business loan',
  '📦 Same-day courier',
  '🏨 Hotel in Harare',
];

// ─────────────────────── state ───────────────────────

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  final _recent = <String>[];
  Timer? _debounce;
  String _submitted = '';
  bool _loading = false;
  List<_Hit> _results = [];
  _Kind? _kindFilter;
  bool _verifiedOnly = false;
  bool _freeShipOnly = false;
  bool _showFilters = false;
  double _minRating = 0;
  double _maxPrice = 1000;

  @override
  void dispose() {
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _submit(String q) {
    final v = q.trim();
    if (v.isEmpty) return;
    _controller.text = v;
    setState(() {
      _submitted = v;
      _recent.remove(v);
      _recent.insert(0, v);
      if (_recent.length > 8) _recent.removeLast();
    });
    _run(v);
  }

  Future<void> _run(String q) async {
    setState(() => _loading = true);
    final like = '%${q.replaceAll(RegExp(r'[%,]+'), ' ').trim()}%';
    try {
      final results = await Future.wait<List<_Hit>>([
        _q('products',
            'id, title, image, price, rating, review_count, moq, free_shipping, category_slug, suppliers!inner(name, verified, country)',
            'title.ilike.$like,category_slug.ilike.$like,badge.ilike.$like',
            _Kind.product, limit: 40),
        _q('suppliers',
            'id, name, logo, verified, gold, country, location_address, rating',
            'name.ilike.$like,description.ilike.$like,country.ilike.$like',
            _Kind.supplier, limit: 20),
        _q('service_providers',
            'id, display_name, category, cover, city, country, hourly_rate, currency, rating',
            'display_name.ilike.$like,category.ilike.$like,description.ilike.$like',
            _Kind.service, limit: 20, filterActive: true),
        _q('properties',
            'id, title, cover, city, country, price, currency, bedrooms, property_kind',
            'title.ilike.$like,city.ilike.$like,property_kind.ilike.$like',
            _Kind.property, limit: 20, filterActive: true),
        _q('vehicles',
            'id, title, cover, city, country, price, currency, make, model, kind',
            'title.ilike.$like,make.ilike.$like,model.ilike.$like',
            _Kind.vehicle, limit: 20, filterActive: true),
        _q('stays',
            'id, title, cover, city, country, price_per_night, currency, rating, kind',
            'title.ilike.$like,city.ilike.$like,kind.ilike.$like',
            _Kind.stay, limit: 20, filterActive: true),
        _q('industrial_listings',
            'id, title, cover, country, price, currency, category',
            'title.ilike.$like,category.ilike.$like',
            _Kind.industrial, limit: 12, filterActive: true),
        _q('news_articles',
            'id, title, slug, cover, category, excerpt',
            'title.ilike.$like,excerpt.ilike.$like,category.ilike.$like',
            _Kind.news, limit: 8),
      ]);
      if (!mounted) return;
      final all = results.expand((e) => e).toList();
      // Simple relevance sort: title starts-with > contains, then rating.
      final lower = q.toLowerCase();
      all.sort((a, b) {
        int score(_Hit h) {
          final t = h.title.toLowerCase();
          if (t == lower) return 100;
          if (t.startsWith(lower)) return 80;
          if (t.contains(lower)) return 60;
          return 20;
        }
        final s = score(b).compareTo(score(a));
        if (s != 0) return s;
        return b.rating.compareTo(a.rating);
      });
      setState(() {
        _results = all;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<List<_Hit>> _q(String table, String select, String or, _Kind kind,
      {int limit = 20, bool filterActive = false}) async {
    try {
      dynamic query = supabase.from(table).select(select);
      if (filterActive) query = query.eq('active', true);
      query = query.or(or).limit(limit);
      final rows = await query;
      return (rows as List)
          .map((r) => _hit(r as Map<String, dynamic>, kind))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  _Hit _hit(Map<String, dynamic> r, _Kind kind) {
    double? asD(dynamic v) =>
        v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
    switch (kind) {
      case _Kind.product:
        final s = (r['suppliers'] as Map?) ?? const {};
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['title'] ?? '').toString(),
          image: r['image']?.toString(),
          price: asD(r['price']),
          rating: asD(r['rating']) ?? 0,
          country: s['country']?.toString(),
          verified: s['verified'] == true,
          freeShipping: r['free_shipping'] == true,
          moq: r['moq'] is int ? r['moq'] as int : null,
          description: s['name']?.toString(),
          payload: r,
        );
      case _Kind.supplier:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['name'] ?? '').toString(),
          image: r['logo']?.toString(),
          rating: asD(r['rating']) ?? 0,
          country: r['country']?.toString(),
          city: r['location_address']?.toString(),
          verified: r['verified'] == true,
          description: r['gold'] == true ? 'Gold Supplier' : null,
        );
      case _Kind.service:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['display_name'] ?? '').toString(),
          description: r['category']?.toString(),
          image: r['cover']?.toString(),
          price: asD(r['hourly_rate']),
          currency: (r['currency'] ?? '\$').toString(),
          rating: asD(r['rating']) ?? 0,
          city: r['city']?.toString(),
          country: r['country']?.toString(),
        );
      case _Kind.property:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['title'] ?? '').toString(),
          description:
              '${r['property_kind'] ?? ''} · ${r['bedrooms'] ?? ''}bd'.trim(),
          image: r['cover']?.toString(),
          price: asD(r['price']),
          currency: (r['currency'] ?? '\$').toString(),
          city: r['city']?.toString(),
          country: r['country']?.toString(),
        );
      case _Kind.vehicle:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['title'] ?? '').toString(),
          description: '${r['make'] ?? ''} ${r['model'] ?? ''}'.trim(),
          image: r['cover']?.toString(),
          price: asD(r['price']),
          currency: (r['currency'] ?? '\$').toString(),
          city: r['city']?.toString(),
          country: r['country']?.toString(),
        );
      case _Kind.stay:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['title'] ?? '').toString(),
          description: r['kind']?.toString(),
          image: r['cover']?.toString(),
          price: asD(r['price_per_night']),
          currency: (r['currency'] ?? '\$').toString(),
          rating: asD(r['rating']) ?? 0,
          city: r['city']?.toString(),
          country: r['country']?.toString(),
        );
      case _Kind.industrial:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['title'] ?? '').toString(),
          description: r['category']?.toString(),
          image: r['cover']?.toString(),
          price: asD(r['price']),
          currency: (r['currency'] ?? '\$').toString(),
          country: r['country']?.toString(),
        );
      case _Kind.news:
        return _Hit(
          id: r['id'].toString(),
          kind: kind,
          title: (r['title'] ?? '').toString(),
          description: r['excerpt']?.toString(),
          image: r['cover']?.toString(),
        );
    }
  }

  List<_Hit> get _filtered {
    return _results.where((h) {
      if (_kindFilter != null && h.kind != _kindFilter) return false;
      if (_verifiedOnly && !h.verified) return false;
      if (_freeShipOnly && !h.freeShipping) return false;
      if (h.rating < _minRating) return false;
      if (h.price != null && h.price! > _maxPrice) return false;
      return true;
    }).toList();
  }

  Map<_Kind, int> get _counts {
    final m = <_Kind, int>{};
    for (final h in _results) {
      m[h.kind] = (m[h.kind] ?? 0) + 1;
    }
    return m;
  }

  // ─────────────────────── build ───────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          _searchBar(),
          if (_showFilters) _filtersPanel(),
          Expanded(
            child: _submitted.isEmpty
                ? _landing()
                : _loading
                    ? Skeletons.list(count: 8)
                    : _resultsList(),
          ),
        ],
      ),
    );
  }

  Widget _searchBar() {
    return Material(
      elevation: 1,
      color: AppColors.background,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
          child: Row(children: [
            IconButton(
              icon: const Icon(LucideIcons.arrowLeft),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: TextField(
                controller: _controller,
                autofocus: true,
                textInputAction: TextInputAction.search,
                onChanged: (v) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 350), () {
                    if (v.trim().length >= 2) _submit(v);
                  });
                },
                onSubmitted: _submit,
                decoration: InputDecoration(
                  hintText: 'Search PUBSTORE',
                  prefixIcon:
                      const Icon(LucideIcons.search, size: 18),
                  suffixIcon: _controller.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(LucideIcons.x, size: 16),
                          onPressed: () {
                            setState(() {
                              _controller.clear();
                              _submitted = '';
                              _results = [];
                            });
                          },
                        ),
                  filled: true,
                  fillColor: AppColors.mutedSurface,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(999),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
            _iconChip(
              icon: LucideIcons.camera,
              onTap: _imageSearch,
            ),
            const SizedBox(width: 4),
            _iconChip(
              icon: LucideIcons.sliders,
              active: _showFilters,
              onTap: () => setState(() => _showFilters = !_showFilters),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _iconChip({required IconData icon, required VoidCallback onTap, bool active = false}) {
    return Material(
      color: active ? AppColors.primary : AppColors.mutedSurface,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 18,
              color: active ? Colors.white : AppColors.foreground),
        ),
      ),
    );
  }

  Widget _landing() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Ask Tapson banner
        InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => TapsonSheet.show(context),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: LinearGradient(colors: [
                AppColors.primary.withOpacity(0.15),
                AppColors.primary.withOpacity(0.03),
              ]),
              border: Border.all(color: AppColors.primary.withOpacity(0.2)),
            ),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: const BoxDecoration(
                    color: AppColors.primary, shape: BoxShape.circle),
                child: const Icon(LucideIcons.sparkles,
                    color: Colors.white, size: 18),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ask Tapson',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text('Describe what you need — Tapson finds it',
                        style: TextStyle(fontSize: 11, color: AppColors.muted)),
                  ],
                ),
              ),
              const Icon(LucideIcons.arrowRight,
                  color: AppColors.primary, size: 18),
            ]),
          ),
        ),
        if (_recent.isNotEmpty) ...[
          const SizedBox(height: 20),
          _sectionLabel(LucideIcons.clock, 'Recent searches'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: _recent
                .map((r) => _pill(r, () => _submit(r)))
                .toList(),
          ),
        ],
        const SizedBox(height: 20),
        _sectionLabel(LucideIcons.trendingUp, 'Trending searches'),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8, runSpacing: 8,
          children: _trending
              .map((t) => _pill(t, () => _submit(t.replaceAll(RegExp(r'^\W+\s'), ''))))
              .toList(),
        ),
      ],
    );
  }

  Widget _sectionLabel(IconData icon, String label) => Row(children: [
        Icon(icon, size: 12, color: AppColors.muted),
        const SizedBox(width: 6),
        Text(label.toUpperCase(),
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: AppColors.muted)),
      ]);

  Widget _pill(String label, VoidCallback onTap) => Material(
        color: AppColors.mutedSurface,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Text(label,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ),
      );

  Widget _filtersPanel() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.card,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('Filters', style: TextStyle(fontWeight: FontWeight.w700)),
          const Spacer(),
          TextButton(
            onPressed: () => setState(() {
              _verifiedOnly = false;
              _freeShipOnly = false;
              _minRating = 0;
              _maxPrice = 1000;
              _kindFilter = null;
            }),
            child: const Text('Reset'),
          ),
        ]),
        Text('Min rating: ${_minRating.toStringAsFixed(1)}',
            style: const TextStyle(fontSize: 12)),
        Slider(
          value: _minRating,
          min: 0, max: 5, divisions: 10,
          onChanged: (v) => setState(() => _minRating = v),
        ),
        Text('Max price: \$${_maxPrice.toStringAsFixed(0)}',
            style: const TextStyle(fontSize: 12)),
        Slider(
          value: _maxPrice,
          min: 5, max: 5000, divisions: 100,
          onChanged: (v) => setState(() => _maxPrice = v),
        ),
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilterChip(
            label: const Text('Verified'),
            selected: _verifiedOnly,
            avatar: const Icon(LucideIcons.sparkles, size: 14),
            onSelected: (v) => setState(() => _verifiedOnly = v),
          ),
          FilterChip(
            label: const Text('Free shipping'),
            selected: _freeShipOnly,
            avatar: const Icon(LucideIcons.truck, size: 14),
            onSelected: (v) => setState(() => _freeShipOnly = v),
          ),
        ]),
      ]),
    );
  }

  Widget _resultsList() {
    final list = _filtered;
    if (list.isEmpty) {
      return _emptyResults();
    }
    return CustomScrollView(slivers: [
      SliverToBoxAdapter(child: _tapsonTake()),
      SliverToBoxAdapter(child: _kindChips()),
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
        sliver: SliverList.separated(
          itemCount: math.min(80, list.length),
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) => _resultCard(list[i]),
        ),
      ),
    ]);
  }

  Widget _emptyResults() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(LucideIcons.search,
              size: 48, color: AppColors.muted),
          const SizedBox(height: 12),
          Text('No results for "$_submitted"',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text('Try a broader term, fix typos, or remove filters.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.muted, fontSize: 12)),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () =>
                TapsonSheet.show(context, seed: 'Help me find $_submitted'),
            icon: const Icon(LucideIcons.sparkles, size: 16),
            label: const Text('Ask Tapson'),
          ),
        ]),
      ),
    );
  }

  Widget _tapsonTake() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => TapsonSheet.show(context,
            seed:
                'A buyer searched: "$_submitted". Suggest what to look for and key specs to compare.'),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(colors: [
              AppColors.primary.withOpacity(0.1),
              AppColors.primary.withOpacity(0.02),
            ]),
            border: Border.all(color: AppColors.primary.withOpacity(0.2)),
          ),
          child: Row(children: [
            Container(
              width: 28, height: 28,
              decoration: const BoxDecoration(
                  color: AppColors.primary, shape: BoxShape.circle),
              child: const Icon(LucideIcons.sparkles,
                  size: 14, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text("Ask Tapson about this search",
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            ),
            const Icon(LucideIcons.arrowRight,
                size: 14, color: AppColors.primary),
          ]),
        ),
      ),
    );
  }

  Widget _kindChips() {
    final counts = _counts;
    if (counts.length <= 1) return const SizedBox.shrink();
    final kinds = counts.keys.toList()
      ..sort((a, b) => counts[b]!.compareTo(counts[a]!));
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          _kindChip(null, 'All · ${_results.length}'),
          ...kinds.map((k) {
            final m = _kindMeta[k]!;
            return _kindChip(k, '${m.label} · ${counts[k]}', icon: m.icon);
          }),
        ],
      ),
    );
  }

  Widget _kindChip(_Kind? k, String label, {IconData? icon}) {
    final active = _kindFilter == k;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        avatar: icon == null ? null : Icon(icon, size: 12),
        selected: active,
        onSelected: (_) => setState(() => _kindFilter = active ? null : k),
      ),
    );
  }

  Widget _resultCard(_Hit hit) {
    final meta = _kindMeta[hit.kind]!;
    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(16),
      elevation: 0.5,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openHit(hit),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Stack(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 80, height: 80,
                  color: AppColors.mutedSurface,
                  child: hit.image == null
                      ? Icon(meta.icon, color: AppColors.muted)
                      : Image.network(hit.image!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              Icon(meta.icon, color: AppColors.muted)),
                ),
              ),
              Positioned(
                top: 4, left: 4,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.background.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(meta.icon, size: 10),
                    const SizedBox(width: 3),
                    Text(meta.label,
                        style: const TextStyle(
                            fontSize: 9, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(hit.title,
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700, height: 1.2)),
                  if (hit.description != null && hit.description!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(hit.description!,
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.muted)),
                    ),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 4, children: [
                    if (hit.price != null && hit.price! > 0)
                      Text(
                          '${hit.currency}${hit.price!.toStringAsFixed(hit.price! >= 100 ? 0 : 2)}',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: AppColors.primary)),
                    if (hit.rating > 0)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(LucideIcons.star,
                            size: 10, color: Colors.amber),
                        const SizedBox(width: 2),
                        Text(hit.rating.toStringAsFixed(1),
                            style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                      ]),
                    if (hit.moq != null && hit.moq! > 1)
                      _tag('MOQ ${hit.moq}'),
                    if (hit.verified) _tag('Verified', color: AppColors.accent),
                    if (hit.freeShipping) _tag('Free ship', color: AppColors.success),
                    if ((hit.city ?? hit.country) != null)
                      Text([hit.city, hit.country].where((e) => e != null && e.isNotEmpty).join(', '),
                          style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                  ]),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _tag(String label, {Color? color}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: (color ?? AppColors.muted).withOpacity(0.15),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: color ?? AppColors.foreground)),
      );

  void _openHit(_Hit hit) {
    switch (hit.kind) {
      case _Kind.product:
        final row = hit.payload;
        if (row == null) return;
        try {
          final product = Product.fromRow(row);
          Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => ProductDetailScreen(product: product)));
        } catch (_) {}
        break;
      case _Kind.supplier:
        Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => SupplierScreen(supplierId: hit.id)));
        break;
      default:
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('${_kindMeta[hit.kind]!.label}: ${hit.title}')));
    }
  }
}
