import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';

/// Immersive live stream viewer — mirrors LiveRoom in `src/pages/Live.tsx`.
/// - Realtime chat via `live_messages`
/// - Reactions via `live_reactions` (floating hearts)
/// - Viewer count bump on join / decrement on leave
/// - Pinned product card + host header
class LiveViewerScreen extends StatefulWidget {
  const LiveViewerScreen({super.key, required this.stream});
  final Map<String, dynamic> stream;

  @override
  State<LiveViewerScreen> createState() => _LiveViewerScreenState();
}

class _LiveViewerScreenState extends State<LiveViewerScreen> {
  final _scroll = ScrollController();
  final _input = TextEditingController();
  RealtimeChannel? _channel;

  List<Map<String, dynamic>> _chat = [];
  final List<_Heart> _hearts = [];
  int _viewers = 0;
  int _likes = 0;
  String? _pinnedId;
  Map<String, dynamic>? _pinnedProduct;
  bool _sentBump = false;
  String? _displayName;

  @override
  void initState() {
    super.initState();
    _viewers = (widget.stream['viewer_count'] ?? 0) as int;
    _pinnedId = widget.stream['pinned_product_id']?.toString();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final sid = widget.stream['id'].toString();
    // Load chat and reactions count
    final chat = await supabase
        .from('live_messages')
        .select('*')
        .eq('stream_id', sid)
        .order('created_at', ascending: true)
        .limit(80);
    final reactCount = await supabase
        .from('live_reactions')
        .select('id')
        .eq('stream_id', sid)
        .count(CountOption.exact);
    if (_pinnedId != null && _pinnedId!.isNotEmpty) {
      try {
        final p = await supabase
            .from('products')
            .select('id, title, price, unit, image_url')
            .eq('id', _pinnedId!)
            .maybeSingle();
        _pinnedProduct = p;
      } catch (_) {}
    }
    final me = supabase.auth.currentUser;
    if (me != null) {
      try {
        final prof = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('user_id', me.id)
            .maybeSingle();
        _displayName = (prof?['display_name'] ?? prof?['username'] ?? me.email?.split('@').first ?? 'Guest').toString();
      } catch (_) {}
    }

    if (!_sentBump) {
      _sentBump = true;
      unawaited(supabase
          .from('live_streams')
          .update({'viewer_count': _viewers + 1})
          .eq('id', sid));
    }

    _channel = supabase
        .channel('live:$sid')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'live_messages',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'stream_id', value: sid),
          callback: (p) {
            if (!mounted) return;
            setState(() {
              _chat = [..._chat, p.newRecord];
              if (_chat.length > 80) _chat = _chat.sublist(_chat.length - 80);
            });
            _autoScroll();
          },
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'live_reactions',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'stream_id', value: sid),
          callback: (_) => _bumpHeart(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'live_streams',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'id', value: sid),
          callback: (p) {
            if (!mounted) return;
            final n = p.newRecord;
            setState(() {
              _viewers = (n['viewer_count'] ?? _viewers) as int;
              _pinnedId = n['pinned_product_id']?.toString();
            });
            if (n['status'] == 'ended') {
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('This stream just ended')));
              Navigator.of(context).maybePop();
            }
          },
        )
        .subscribe();

    if (!mounted) return;
    setState(() {
      _chat = (chat as List).cast<Map<String, dynamic>>();
      _likes = reactCount.count;
    });
    _autoScroll();
  }

  void _bumpHeart() {
    if (!mounted) return;
    final rng = math.Random();
    setState(() {
      _likes += 1;
      _hearts.add(_Heart(id: DateTime.now().microsecondsSinceEpoch, left: 40 + rng.nextDouble() * 60));
    });
    Future.delayed(const Duration(milliseconds: 1800), () {
      if (!mounted || _hearts.isEmpty) return;
      setState(() => _hearts.removeAt(0));
    });
  }

  void _autoScroll() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _sendHeart() async {
    final me = supabase.auth.currentUser;
    if (me == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to react')));
      return;
    }
    await supabase.from('live_reactions').insert({
      'stream_id': widget.stream['id'],
      'user_id': me.id,
      'kind': 'heart',
    });
  }

  Future<void> _sendMessage() async {
    final t = _input.text.trim();
    if (t.isEmpty) return;
    final me = supabase.auth.currentUser;
    if (me == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sign in to chat')));
      return;
    }
    _input.clear();
    try {
      await supabase.from('live_messages').insert({
        'stream_id': widget.stream['id'],
        'user_id': me.id,
        'username': _displayName ?? 'Guest',
        'body': t,
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  @override
  void dispose() {
    if (_channel != null) {
      supabase.removeChannel(_channel!);
    }
    // Decrement viewer count best-effort
    final sid = widget.stream['id'].toString();
    supabase
        .from('live_streams')
        .select('viewer_count')
        .eq('id', sid)
        .maybeSingle()
        .then((row) {
      final v = (row?['viewer_count'] ?? 0) as int;
      if (v > 0) {
        supabase.from('live_streams').update({'viewer_count': v - 1}).eq('id', sid);
      }
    }).catchError((_) {});
    _scroll.dispose();
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final host = (widget.stream['host'] ?? {}) as Map;
    final cover = (widget.stream['thumbnail_url'] ?? '').toString();
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(children: [
        // background
        Positioned.fill(
          child: cover.isNotEmpty
              ? CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover)
              : const ColoredBox(color: Color(0xFF0F172A)),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.black54, Colors.black38, Colors.black87],
              ),
            ),
          ),
        ),
        // hearts
        ..._hearts.map((h) => _FloatingHeart(key: ValueKey(h.id), left: h.left)),
        // top header
        SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(999)),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(LucideIcons.radio, size: 12, color: Colors.white),
                    SizedBox(width: 4),
                    Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
                  ]),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(LucideIcons.eye, size: 12, color: Colors.white),
                    const SizedBox(width: 4),
                    Text('$_viewers', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                  ]),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(LucideIcons.x, color: Colors.white),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
              child: Row(children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: AppColors.mutedSurface,
                  backgroundImage: (host['avatar_url'] ?? '').toString().isNotEmpty
                      ? CachedNetworkImageProvider(host['avatar_url']) : null,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(host['display_name']?.toString() ?? 'Host',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                    Text(widget.stream['title']?.toString() ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  ]),
                ),
              ]),
            ),
            const Spacer(),
            // Pinned product
            if (_pinnedProduct != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.95), borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 44, height: 44,
                        child: (_pinnedProduct!['image_url'] ?? '').toString().isNotEmpty
                            ? CachedNetworkImage(imageUrl: _pinnedProduct!['image_url'], fit: BoxFit.cover)
                            : Container(color: AppColors.mutedSurface),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('FEATURED LIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.primary, letterSpacing: 1)),
                        Text(_pinnedProduct!['title']?.toString() ?? '',
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.foreground)),
                        Text('\$${_pinnedProduct!['price'] ?? '-'}',
                            style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.foreground)),
                      ]),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: AppColors.primaryForeground,
                        shape: const StadiumBorder(),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      onPressed: () {},
                      child: const Text('Buy now', style: TextStyle(fontWeight: FontWeight.w800)),
                    ),
                  ]),
                ),
              ),
            // Chat
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                itemCount: _chat.length,
                itemBuilder: (_, i) {
                  final m = _chat[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: RichText(
                      text: TextSpan(
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        children: [
                          TextSpan(text: '${m['username'] ?? 'user'} ',
                              style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.amberAccent)),
                          TextSpan(text: '${m['body'] ?? ''}'),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            // Composer
            Padding(
              padding: EdgeInsets.fromLTRB(12, 6, 12, MediaQuery.of(context).viewInsets.bottom + 12),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    style: const TextStyle(color: Colors.white),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                    decoration: InputDecoration(
                      hintText: 'Say something…',
                      hintStyle: const TextStyle(color: Colors.white70),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.15),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _RoundIcon(icon: LucideIcons.heart, color: AppColors.destructive, onTap: _sendHeart, badge: _likes),
                const SizedBox(width: 6),
                _RoundIcon(icon: LucideIcons.send, color: AppColors.primary, onTap: _sendMessage),
              ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _Heart {
  _Heart({required this.id, required this.left});
  final int id;
  final double left;
}

class _FloatingHeart extends StatefulWidget {
  const _FloatingHeart({super.key, required this.left});
  final double left;
  @override
  State<_FloatingHeart> createState() => _FloatingHeartState();
}

class _FloatingHeartState extends State<_FloatingHeart> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..forward();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) => Positioned(
        right: widget.left,
        bottom: 90 + _c.value * 220,
        child: Opacity(
          opacity: 1 - _c.value,
          child: const Icon(LucideIcons.heart, color: Colors.pinkAccent, size: 28),
        ),
      ),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon({required this.icon, required this.color, required this.onTap, this.badge});
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final int? badge;
  @override
  Widget build(BuildContext context) {
    return Stack(clipBehavior: Clip.none, children: [
      Material(
        color: Colors.white.withValues(alpha: 0.2),
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(padding: const EdgeInsets.all(10), child: Icon(icon, color: color, size: 20)),
        ),
      ),
      if (badge != null && badge! > 0)
        Positioned(
          right: -2, top: -2,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(999)),
            child: Text('$badge', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
          ),
        ),
    ]);
  }
}
