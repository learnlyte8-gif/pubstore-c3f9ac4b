import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Mirrors `src/pages/JobsFeed.tsx` — LinkedIn-style feed of job posts with
/// likes and comments backed by `job_posts` / `job_post_likes`.
class JobsFeedScreen extends StatefulWidget {
  const JobsFeedScreen({super.key});
  @override
  State<JobsFeedScreen> createState() => _JobsFeedScreenState();
}

class _JobsFeedScreenState extends State<JobsFeedScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  final _composer = TextEditingController();

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final rows = await supabase
        .from('job_posts')
        .select('*, profiles(display_name, avatar_url), job_post_likes(count), job_post_comments(count)')
        .order('created_at', ascending: false)
        .limit(60);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<void> _post() async {
    final body = _composer.text.trim();
    if (body.isEmpty) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('job_posts').insert({'user_id': uid, 'body': body});
    _composer.clear();
    setState(() => _future = _load());
  }

  Future<void> _like(String postId) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    await supabase.from('job_post_likes').upsert({'post_id': postId, 'user_id': uid});
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Career feed')),
      body: Column(children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _composer,
                minLines: 1,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Share an update…', border: OutlineInputBorder(), isDense: true),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _post, child: const Text('Post')),
          ]),
        ),
        Expanded(
          child: FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
              final rows = snap.data ?? const [];
              if (rows.isEmpty) return const Center(child: Text('No posts yet'));
              return ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, i) {
                  final p = rows[i];
                  final prof = (p['profiles'] ?? {}) as Map;
                  final likes = ((p['job_post_likes'] ?? []) as List).length;
                  final comments = ((p['job_post_comments'] ?? []) as List).length;
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: AppColors.mutedSurface,
                          backgroundImage: (prof['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(prof['avatar_url']) : null,
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(prof['display_name']?.toString() ?? 'Member', style: const TextStyle(fontWeight: FontWeight.w800))),
                      ]),
                      const SizedBox(height: 10),
                      Text(p['body']?.toString() ?? '', style: const TextStyle(height: 1.4)),
                      const SizedBox(height: 10),
                      Row(children: [
                        TextButton.icon(onPressed: () => _like(p['id'].toString()), icon: const Icon(LucideIcons.thumbsUp, size: 14), label: Text('$likes')),
                        TextButton.icon(onPressed: () {}, icon: const Icon(LucideIcons.messageSquare, size: 14), label: Text('$comments')),
                        TextButton.icon(onPressed: () {}, icon: const Icon(LucideIcons.share2, size: 14), label: const Text('Share')),
                      ]),
                    ]),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}
