import 'dart:io';

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/JobsFeed.tsx` — career feed with image + link
/// attachments, likes, comments, share, and delete-own-post.
class JobsFeedScreen extends StatefulWidget {
  const JobsFeedScreen({super.key});
  @override
  State<JobsFeedScreen> createState() => _JobsFeedScreenState();
}

class _JobsFeedScreenState extends State<JobsFeedScreen> {
  late Future<List<Map<String, dynamic>>> _future;
  Set<String> _likedIds = {};
  final _composer = TextEditingController();
  final _linkCtrl = TextEditingController();
  String? _pickedImagePath;
  bool _posting = false;

  String? get _uid => supabase.auth.currentUser?.id;

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
    final uid = _uid;
    if (uid != null) {
      final likes = await supabase.from('job_post_likes').select('post_id').eq('user_id', uid);
      _likedIds = (likes as List).map((r) => (r as Map)['post_id'].toString()).toSet();
    }
    return (rows as List).cast<Map<String, dynamic>>();
  }

  Future<void> _pickImage() async {
    final f = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (f == null) return;
    setState(() => _pickedImagePath = f.path);
  }

  Future<void> _post() async {
    final body = _composer.text.trim();
    final link = _linkCtrl.text.trim();
    if (body.isEmpty && link.isEmpty && _pickedImagePath == null) return;
    final uid = _uid;
    if (uid == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to post')));
      return;
    }
    setState(() => _posting = true);
    try {
      String? imageUrl;
      if (_pickedImagePath != null) {
        try {
          final key = 'jobs/$uid/${DateTime.now().millisecondsSinceEpoch}.jpg';
          final storage = supabase.storage.from('chat-media');
          await storage.upload(key, File(_pickedImagePath!));
          imageUrl = await storage.createSignedUrl(key, 60 * 60 * 24 * 365);
        } catch (_) {}
      }
      final row = <String, dynamic>{
        'author_id': uid,
        'body': body,
        'visibility': 'public',
      };
      if (imageUrl != null) row['image_url'] = imageUrl;
      if (link.isNotEmpty) row['link_url'] = link;
      await supabase.from('job_posts').insert(row);
      _composer.clear();
      _linkCtrl.clear();
      setState(() {
        _pickedImagePath = null;
        _future = _load();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Couldn\'t post: $e')));
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _deletePost(Map<String, dynamic> p) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this post?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await supabase.from('job_posts').delete().eq('id', p['id']);
      setState(() => _future = _load());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  Future<void> _toggleLike(Map<String, dynamic> p) async {
    final uid = _uid;
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
    final me = _uid;
    return Scaffold(
      appBar: AppBar(title: const Text('Career feed')),
      body: Column(children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TextField(
              controller: _composer, minLines: 1, maxLines: 4,
              decoration: const InputDecoration(hintText: 'Share an update…', border: OutlineInputBorder(), isDense: true),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _linkCtrl,
              decoration: const InputDecoration(
                hintText: 'Attach a link (https://…)',
                border: OutlineInputBorder(),
                isDense: true,
                prefixIcon: Icon(LucideIcons.link2, size: 16),
              ),
            ),
            if (_pickedImagePath != null) ...[
              const SizedBox(height: 8),
              Row(children: [
                const Icon(LucideIcons.image, size: 14, color: AppColors.muted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text('Image attached',
                      style: TextStyle(fontSize: 11, color: AppColors.muted),
                      overflow: TextOverflow.ellipsis),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 14),
                  onPressed: () => setState(() => _pickedImagePath = null),
                ),
              ]),
            ],
            const SizedBox(height: 8),
            Row(children: [
              IconButton(
                onPressed: _pickImage,
                icon: const Icon(LucideIcons.image, size: 18),
                tooltip: 'Attach image',
              ),
              const Spacer(),
              FilledButton(
                onPressed: _posting ? null : _post,
                child: Text(_posting ? '…' : 'Post'),
              ),
            ]),
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
                    final img = (p['image_url'] ?? '').toString();
                    final link = (p['link_url'] ?? '').toString();
                    final isOwn = me != null && p['author_id'] == me;
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
                          if (isOwn)
                            IconButton(
                              icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.destructive),
                              onPressed: () => _deletePost(p),
                            ),
                        ]),
                        const SizedBox(height: 10),
                        if ((p['body'] ?? '').toString().isNotEmpty)
                          Text(p['body'].toString(), style: const TextStyle(height: 1.4)),
                        if (img.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: CachedNetworkImage(imageUrl: img, fit: BoxFit.cover),
                          ),
                        ],
                        if (link.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          InkWell(
                            onTap: () => Share.share(link),
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppColors.mutedSurface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(children: [
                                const Icon(LucideIcons.link2, size: 14, color: AppColors.primary),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(link,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 12, color: AppColors.primary)),
                                ),
                              ]),
                            ),
                          ),
                        ],
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
                          TextButton.icon(
                            onPressed: () {
                              final text = (p['body'] ?? '').toString();
                              Share.share([text, link].where((s) => s.isNotEmpty).join('\n'));
                            },
                            icon: const Icon(LucideIcons.share2, size: 14),
                            label: const Text('Share'),
                          ),
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
