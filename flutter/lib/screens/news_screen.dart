import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/News.tsx` — magazine feed with category chips,
/// search, sort, and per-article detail view.
class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key, this.slug});
  final String? slug;

  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

const _cats = <(String, String)>[
  ('all', 'All'),
  ('marketplace', 'Marketplace'),
  ('industrial', 'Industrial'),
  ('automotive', 'Automotive'),
  ('stays', 'Stays'),
];

const _sorts = <(String, String)>[
  ('recent', 'Most recent'),
  ('longest', 'Longest read'),
  ('shortest', 'Quick reads'),
  ('popular', 'Most viewed'),
];

class _NewsScreenState extends State<NewsScreen> {
  Future<List<NewsArticle>>? _future;
  String _cat = 'all';
  String _sort = 'recent';
  String _query = '';
  bool _showFilters = false;
  final _searchCtl = TextEditingController();

  @override
  void initState() {
    super.initState();
    if (widget.slug == null) _reload();
  }

  void _reload() {
    setState(() {
      _future = verticals.fetchNews(category: _cat == 'all' ? null : _cat);
    });
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    super.dispose();
  }

  List<NewsArticle> _apply(List<NewsArticle> list) {
    final q = _query.trim().toLowerCase();
    var filtered = q.isEmpty
        ? list
        : list.where((a) =>
            a.title.toLowerCase().contains(q) ||
            (a.excerpt ?? '').toLowerCase().contains(q) ||
            (a.author ?? '').toLowerCase().contains(q)).toList();
    filtered = List.of(filtered);
    filtered.sort((a, b) {
      final ad = a.publishedAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bd = b.publishedAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bd.compareTo(ad); // newest first (schema lacks read_minutes/views)
    });
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slug != null) return _ArticleView(slug: widget.slug!);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('News', style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: AppColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(_showFilters ? LucideIcons.x : LucideIcons.slidersHorizontal, size: 18),
            onPressed: () => setState(() => _showFilters = !_showFilters),
          ),
        ],
      ),
      body: Column(children: [
        _mastheadRibbon(),
        if (_showFilters) _filters(),
        Expanded(
          child: FutureBuilder<List<NewsArticle>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return Skeletons.list(count: 4);
              }
              final all = _apply(snap.data ?? const []);
              if (all.isEmpty) {
                return Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(LucideIcons.newspaper, size: 40, color: AppColors.muted),
                    const SizedBox(height: 8),
                    const Text('No stories match.', style: TextStyle(fontWeight: FontWeight.w700)),
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _cat = 'all';
                          _sort = 'recent';
                          _query = '';
                          _searchCtl.clear();
                        });
                        _reload();
                      },
                      child: const Text('Reset filters'),
                    ),
                  ]),
                );
              }
              final hero = all.first;
              final rest = all.skip(1).toList();
              return ListView.builder(
                padding: const EdgeInsets.only(bottom: 32),
                itemCount: rest.length + 2,
                itemBuilder: (_, i) {
                  if (i == 0) return _heroCard(hero);
                  if (i == 1) {
                    return const Padding(
                      padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
                      child: Text('Latest stories',
                          style: TextStyle(fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.muted)),
                    );
                  }
                  final a = rest[i - 2];
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                    child: _rowCard(a),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }

  Widget _mastheadRibbon() => Container(
        padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.foreground, width: 2))),
        child: Column(children: [
          Text('PUBSTORE Daily',
              style: TextStyle(fontFamily: 'serif', fontSize: 28, fontWeight: FontWeight.w800, height: 1.05, color: AppColors.foreground)),
          const SizedBox(height: 2),
          const Text('The shopping complex chronicle',
              style: TextStyle(fontSize: 10, letterSpacing: 2, color: AppColors.muted, fontWeight: FontWeight.w700)),
        ]),
      );

  Widget _filters() => Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: const BoxDecoration(color: AppColors.card, border: Border(bottom: BorderSide(color: AppColors.border))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(
            controller: _searchCtl,
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: 'Search headlines, authors…',
              prefixIcon: const Icon(LucideIcons.search, size: 16),
              filled: true, fillColor: AppColors.mutedSurface,
              contentPadding: EdgeInsets.zero,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _cats.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final c = _cats[i];
                final on = _cat == c.$1;
                return GestureDetector(
                  onTap: () { setState(() => _cat = c.$1); _reload(); },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: on ? AppColors.foreground : AppColors.mutedSurface,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(c.$2, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: on ? AppColors.background : AppColors.foreground)),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _sorts.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final s = _sorts[i];
                final on = _sort == s.$1;
                return GestureDetector(
                  onTap: () => setState(() => _sort = s.$1),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: on ? AppColors.primary : AppColors.mutedSurface,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(s.$2, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: on ? AppColors.primaryForeground : AppColors.foreground)),
                  ),
                );
              },
            ),
          ),
        ]),
      );

  Widget _heroCard(NewsArticle a) => InkWell(
        onTap: () => _open(a),
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(24)),
          clipBehavior: Clip.antiAlias,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (a.cover != null)
              AspectRatio(
                aspectRatio: 16 / 10,
                child: Image.network(a.cover!, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(color: AppColors.mutedSurface)),
              ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (a.category != null)
                  Text('LEAD STORY · ${a.category!.toUpperCase()}',
                      style: const TextStyle(fontSize: 10, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.primary)),
                const SizedBox(height: 6),
                Text(a.title, style: const TextStyle(fontFamily: 'serif', fontSize: 22, height: 1.15, fontWeight: FontWeight.w700)),
                if (a.excerpt != null) ...[
                  const SizedBox(height: 8),
                  Text(a.excerpt!, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppColors.muted, height: 1.4)),
                ],
                const SizedBox(height: 8),
                Row(children: [
                  Text(a.author ?? 'Editorial', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                  const Text(' · ', style: TextStyle(color: AppColors.muted)),
                  const Icon(LucideIcons.clock, size: 11, color: AppColors.muted),
                  const SizedBox(width: 4),
                  Text(_relative(a.publishedAt), style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                ]),
              ]),
            ),
          ]),
        ),
      );

  Widget _rowCard(NewsArticle a) => InkWell(
        onTap: () => _open(a),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(18)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 92, height: 92,
                child: a.cover != null
                    ? Image.network(a.cover!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.mutedSurface))
                    : Container(color: AppColors.mutedSurface),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (a.category != null)
                Text(a.category!.toUpperCase(), style: const TextStyle(fontSize: 9, letterSpacing: 1.4, fontWeight: FontWeight.w900, color: AppColors.primary)),
              const SizedBox(height: 2),
              Text(a.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: 'serif', fontSize: 15, height: 1.2, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Row(children: [
                const Icon(LucideIcons.clock, size: 11, color: AppColors.muted),
                const SizedBox(width: 4),
                Text(_relative(a.publishedAt), style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              ]),
            ])),
          ]),
        ),
      );

  void _open(NewsArticle a) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => NewsScreen(slug: a.slug)));
  }

  String _relative(DateTime? d) {
    if (d == null) return '';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }
}

class _ArticleView extends StatefulWidget {
  const _ArticleView({required this.slug});
  final String slug;
  @override
  State<_ArticleView> createState() => _ArticleViewState();
}

class _ArticleViewState extends State<_ArticleView> {
  late final Future<NewsArticle?> _future = verticals.fetchNewsArticle(widget.slug);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: FutureBuilder<NewsArticle?>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final a = snap.data;
          if (a == null) {
            return const Center(child: Text('Article not found.'));
          }
          final paragraphs = (a.body ?? '').split('\n').where((p) => p.trim().isNotEmpty).toList();
          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              const SizedBox(height: 8),
              Text('${a.category ?? ''} · ${_rel(a.publishedAt)} ago'.trim(),
                  style: const TextStyle(fontSize: 10, letterSpacing: 1.6, color: AppColors.muted, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(a.title, style: const TextStyle(fontFamily: 'serif', fontSize: 30, height: 1.05, fontWeight: FontWeight.w800)),
              if (a.excerpt != null) ...[
                const SizedBox(height: 8),
                Text(a.excerpt!, style: const TextStyle(fontSize: 15, color: AppColors.muted, height: 1.4)),
              ],
              const SizedBox(height: 8),
              Text('— ${a.author ?? 'Editorial'}', style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic)),
              if (a.cover != null) ...[
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: Image.network(a.cover!, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(color: AppColors.mutedSurface)),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              for (final p in paragraphs) Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(p, style: const TextStyle(fontFamily: 'serif', fontSize: 15, height: 1.7)),
              ),
              const SizedBox(height: 32),
            ],
          );
        },
      ),
    );
  }

  String _rel(DateTime? d) {
    if (d == null) return '';
    final diff = DateTime.now().difference(d);
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }
}
