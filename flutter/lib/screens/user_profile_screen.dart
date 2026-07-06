import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../models/models.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/product_card.dart';
import '../widgets/skeletons.dart';
import 'messages_screen.dart';

/// Mirrors `src/pages/UserProfile.tsx` — public seller / user profile with
/// their listings and follow toggle.
class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key, required this.userId});
  final String userId;

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  Map<String, dynamic>? _profile;
  List<Product> _products = const [];
  bool _loading = true;
  bool _following = false;
  int _followers = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await supabase.from('profiles').select('*').eq('user_id', widget.userId).maybeSingle();
      // Liked products (via post_likes)
      final likes = await supabase
          .from('post_likes')
          .select('target_id')
          .eq('user_id', widget.userId)
          .eq('target_type', 'product')
          .order('created_at', ascending: false)
          .limit(48);
      final ids = (likes as List)
          .map((r) => (r as Map)['target_id']?.toString())
          .whereType<String>()
          .toList();
      List rows = const [];
      if (ids.isNotEmpty) {
        rows = await supabase.from('products').select('*').inFilter('id', ids);
      }
      final followers = await supabase
          .from('user_follows')
          .select('follower_id')
          .eq('followed_id', widget.userId);
      final me = supabase.auth.currentUser?.id;
      final isFollowing = me == null
          ? false
          : (followers as List).any((r) => (r as Map)['follower_id'] == me);
      if (!mounted) return;
      setState(() {
        _profile = p == null ? null : Map<String, dynamic>.from(p);
        _products = (rows as List)
            .map((e) => Product.fromRow(Map<String, dynamic>.from(e)))
            .toList();
        _followers = (followers as List).length;
        _following = isFollowing;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleFollow() async {
    final me = supabase.auth.currentUser?.id;
    if (me == null) return;
    setState(() {
      _following = !_following;
      _followers += _following ? 1 : -1;
    });
    try {
      if (_following) {
        await supabase.from('user_follows').insert({'follower_id': me, 'followed_id': widget.userId});
      } else {
        await supabase.from('user_follows').delete().match({'follower_id': me, 'followed_id': widget.userId});
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _following = !_following;
          _followers += _following ? 1 : -1;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return Scaffold(
      appBar: AppBar(title: Text(p?['display_name']?.toString() ?? 'Profile')),
      body: _loading
          ? Skeletons.screen(SkeletonPreset.detail)
          : p == null
              ? const Center(child: Text('Profile not found'))
              : CustomScrollView(slivers: [
                  SliverToBoxAdapter(
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFE7F0FF), Color(0xFFFFF2C2)],
                        ),
                      ),
                      child: Column(children: [
                        CircleAvatar(
                          radius: 44,
                          backgroundColor: AppColors.mutedSurface,
                          backgroundImage: (p['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(p['avatar_url']) : null,
                          child: (p['avatar_url'] ?? '').toString().isEmpty
                              ? Text((p['display_name'] ?? '?').toString().substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900))
                              : null,
                        ),
                        const SizedBox(height: 12),
                        Text(p['display_name']?.toString() ?? 'User', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                        if ((p['bio'] ?? '').toString().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(p['bio'], textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
                          ),
                        const SizedBox(height: 16),
                        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          _stat('$_followers', 'Followers'),
                          const SizedBox(width: 32),
                          _stat('${_products.length}', 'Likes'),
                          const SizedBox(width: 32),
                          _stat('${p['rating'] ?? '—'}', 'Rating'),
                        ]),
                        const SizedBox(height: 16),
                        Row(children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _toggleFollow,
                              icon: Icon(_following ? LucideIcons.check : LucideIcons.userPlus, size: 16),
                              label: Text(_following ? 'Following' : 'Follow'),
                              style: FilledButton.styleFrom(backgroundColor: _following ? AppColors.mutedSurface : AppColors.orange, foregroundColor: _following ? AppColors.foreground : Colors.white),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const MessagesScreen()),
                              ),
                              icon: const Icon(LucideIcons.messageCircle, size: 16),
                              label: const Text('Message'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.outlined(
                            onPressed: () {
                              final name = p['display_name']?.toString() ?? 'this profile';
                              Share.share('Check out $name on PUBSTORE\nhttps://pubstore.app/u/${widget.userId}');
                            },
                            icon: const Icon(LucideIcons.share2, size: 16),
                          ),
                        ]),
                      ]),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.all(12),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.68,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => ProductCard(product: _products[i]),
                        childCount: _products.length,
                      ),
                    ),
                  ),
                ]),
    );
  }

  Widget _stat(String value, String label) => Column(children: [
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);
}
