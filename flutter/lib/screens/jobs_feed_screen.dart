import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/JobsFeed.tsx` — LinkedIn-style feed of career posts
/// with likes, comments, and share on `job_posts`.
class JobsFeedScreen extends StatefulWidget {
  const JobsFeedScreen({super.key});
  @override
  State<JobsFeedScreen> createState() => _JobsFeedScreenState();
}

class _JobsFeedScreenState extends State<JobsFeedScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  Set<String> _likedIds = {};
  final _composer = TextEditingController();
  bool _posting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final rows = await supabase
        .from('job_posts')
        .select('*, author:author_id(display_name, avatar_url)')
        .order('created_at', ascending: false)
        .limit(60);
    final uid = supabase.auth.currentUser?.id;
    if (uid != null) {
      final likes = await supabase.from('job_post_likes').select('post_id').eq('user_id', uid);
      _likedIds = (likes as List).map((r) => (r as Map)['post_id'].toString()).toSet();
    }
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<void> _post() async {
    final body = _composer.text.trim();
    if (body.isEmpty) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to post')));
      return;
    }
    setState(() => _posting = true);
    try {
      await supabase.from('job_posts').insert({'author_id': uid, 'body': body, 'visibility': 'public'});
      _composer.clear();
      setState(() => _future = _load());
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _toggleLike(Map<String, dynamic> p) async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final id = p['id'].toString();
    final liked = _likedIds.contains(id);
    setState(() {
      if (liked) {
        _likedIds.remove(id);
        p['likes_count'] = ((p['likes_count'] as int?) ?? 1) - 1;
      } else {
        _likedIds.add(id);
        p['likes_count'] = ((p['likes_count'] as int?) ?? 0) + 1;
      }
    });
    try {
      if (liked) {
        await supabase.from('job_post_likes').delete().eq('post_id', id).eq('user_id', uid);
      } else {
        await supabase.from('job_post_likes').insert({'post_id': id, 'user_id': uid});
      }
    } catch (_) {}
  }

  void _openComments(Map<String, dynamic> p) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, useSafeArea: true,
      backgroundColor: AppColors.background,
      builder: (_) => _CommentsSheet(post: p, onCountChange: () => setState(() {})),
    );
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
                controller: _composer, minLines: 1, maxLines: 3,
                decoration: const InputDecoration(hintText: 'Share an update…', border: OutlineInputBorder(), isDense: true),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _posting ? null : _post, child: Text(_posting ? '…' : 'Post')),
          ]),
        ),
        Expanded(
          child: FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
              final rows = snap.data ?? const [];
              if (rows.isEmpty) return const Center(child: Text('No posts yet'));
              return RefreshIndicator(
                onRefresh: () async { setState(() => _future = _load()); await _future; },
                child: ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: rows.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, i) {
                    final p = rows[i];
                    final author = (p['author'] ?? {}) as Map;
                    final likes = (p['likes_count'] as int?) ?? 0;
                    final comments = (p['comments_count'] as int?) ?? 0;
                    final liked = _likedIds.contains(p['id'].toString());
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.mutedSurface,
                            backgroundImage: (author['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(author['avatar_url']) : null,
                            child: (author['avatar_url'] ?? '').toString().isEmpty ? const Icon(LucideIcons.user, size: 16, color: AppColors.muted) : null,
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(author['display_name']?.toString() ?? 'Member', style: const TextStyle(fontWeight: FontWeight.w800))),
                        ]),
                        const SizedBox(height: 10),
                        Text(p['body']?.toString() ?? '', style: const TextStyle(height: 1.4)),
                        const SizedBox(height: 10),
                        Row(children: [
                          TextButton.icon(
                            onPressed: () => _toggleLike(p),
                            icon: Icon(LucideIcons.thumbsUp, size: 14, color: liked ? AppColors.primary : AppColors.muted),
                            label: Text('$likes', style: TextStyle(color: liked ? AppColors.primary : AppColors.muted)),
                          ),
                          TextButton.icon(
                            onPressed: () => _openComments(p),
                            icon: const Icon(LucideIcons.messageSquare, size: 14),
                            label: Text('$comments'),
                          ),
                          TextButton.icon(onPressed: () {}, icon: const Icon(LucideIcons.share2, size: 14), label: const Text('Share')),
                        ]),
                      ]),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _CommentsSheet extends StatefulWidget {
  const _CommentsSheet({required this.post, required this.onCountChange});
  final Map<String, dynamic> post;
  final VoidCallback onCountChange;
  @override
  State<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<_CommentsSheet> {
  List<Map<String, dynamic>> _comments = const [];
  final _text = TextEditingController();
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rows = await supabase.from('job_post_comments')
        .select('*, author:user_id(display_name, avatar_url)')
        .eq('post_id', widget.post['id']).order('created_at');
    if (!mounted) return;
    setState(() { _comments = (rows as List).cast<Map<String, dynamic>>(); _loading = false; });
  }

  Future<void> _send() async {
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) return;
    final t = _text.text.trim();
    if (t.isEmpty) return;
    setState(() => _sending = true);
    try {
      await supabase.from('job_post_comments').insert({'post_id': widget.post['id'], 'user_id': uid, 'body': t});
      _text.clear();
      widget.post['comments_count'] = ((widget.post['comments_count'] as int?) ?? 0) + 1;
      widget.onCountChange();
      await _load();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false, initialChildSize: .85, maxChildSize: .95,
      builder: (_, ctrl) => Column(children: [
        const Padding(padding: EdgeInsets.all(12), child: Text('Comments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900))),
        const Divider(height: 1),
        Expanded(
          child: _loading
              ? Skeletons.list(count: 4)
              : _comments.isEmpty
                  ? const Center(child: Text('Be the first to comment', style: TextStyle(color: AppColors.muted)))
                  : ListView.builder(
                      controller: ctrl,
                      itemCount: _comments.length,
                      itemBuilder: (context, i) {
                        final c = _comments[i];
                        final a = (c['author'] ?? {}) as Map;
                        return ListTile(
                          leading: CircleAvatar(
                            radius: 16, backgroundColor: AppColors.mutedSurface,
                            backgroundImage: (a['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(a['avatar_url']) : null,
                          ),
                          title: Text(a['display_name']?.toString() ?? 'Member', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          subtitle: Text(c['body']?.toString() ?? ''),
                        );
                      },
                    ),
        ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
          child: Row(children: [
            Expanded(child: TextField(controller: _text, decoration: const InputDecoration(hintText: 'Add a comment…', border: OutlineInputBorder(), isDense: true))),
            const SizedBox(width: 8),
            IconButton(icon: Icon(LucideIcons.send, color: _sending ? AppColors.muted : AppColors.primary), onPressed: _sending ? null : _send),
          ]),
        ),
      ]),
    );
  }
}
