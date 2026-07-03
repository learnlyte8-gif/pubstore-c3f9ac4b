import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../models/vertical_models.dart';
import '../services/verticals_service.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/News.tsx` — magazine feed.
class NewsScreen extends StatefulWidget {
  const NewsScreen({super.key});
  @override
  State<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends State<NewsScreen> {
  late Future<List<NewsArticle>> _future;

  @override
  void initState() {
    super.initState();
    _future = verticals.fetchNews();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('News',
            style: TextStyle(fontWeight: FontWeight.w900)),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: FutureBuilder<List<NewsArticle>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return Skeletons.list(count: 4);
          }
          final list = snap.data ?? [];
          if (list.isEmpty) {
            return const Center(child: Text('No articles yet.'));
          }
          final hero = list.first;
          final rest = list.skip(1).toList();

          return ListView(
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              _heroCard(hero),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 20, 16, 6),
                child: Text('Latest stories',
                    style: TextStyle(
                        fontSize: 11,
                        letterSpacing: 1.4,
                        fontWeight: FontWeight.w900,
                        color: AppColors.muted)),
              ),
              for (final a in rest)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: _rowCard(a),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _heroCard(NewsArticle a) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(24),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (a.cover != null)
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Image.network(a.cover!, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      Container(color: AppColors.mutedSurface)),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (a.category != null)
                  Text(a.category!.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 10,
                          letterSpacing: 1.4,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primary)),
                const SizedBox(height: 6),
                Text(a.title,
                    style: const TextStyle(
                        fontFamily: 'serif',
                        fontSize: 22,
                        height: 1.15,
                        fontWeight: FontWeight.w700)),
                if (a.excerpt != null) ...[
                  const SizedBox(height: 8),
                  Text(a.excerpt!,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.muted, height: 1.4)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _rowCard(NewsArticle a) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 92,
              height: 92,
              child: a.cover != null
                  ? Image.network(a.cover!, fit: BoxFit.cover,
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
                if (a.category != null)
                  Text(a.category!.toUpperCase(),
                      style: const TextStyle(
                          fontSize: 9,
                          letterSpacing: 1.4,
                          fontWeight: FontWeight.w900,
                          color: AppColors.primary)),
                const SizedBox(height: 2),
                Text(a.title,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontFamily: 'serif',
                        fontSize: 15,
                        height: 1.2,
                        fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Row(children: [
                  const Icon(LucideIcons.clock,
                      size: 11, color: AppColors.muted),
                  const SizedBox(width: 4),
                  Text(_relative(a.publishedAt),
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.muted)),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
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
