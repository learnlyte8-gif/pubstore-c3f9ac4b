import '../widgets/skeletons.dart';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/supabase_client.dart';
import '../theme/palette.dart';
import 'live_viewer_screen.dart';

/// Mirrors `src/pages/Live.tsx` — list of active live shopping streams.
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});
  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final rows = await supabase
        .from('live_streams')
        .select('*, host:host_user_id(display_name, avatar_url)')
        .eq('status', 'live')
        .order('viewer_count', ascending: false);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Live now'), actions: [IconButton(onPressed: _goLive, icon: const Icon(LucideIcons.video))]),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return Skeletons.list(count: 4);
          final rows = snap.data ?? const [];
          if (rows.isEmpty) return const Center(child: Text('Nobody’s live right now'));
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
            itemCount: rows.length,
            itemBuilder: (context, i) {
              final s = rows[i];
              final host = (s['host'] ?? {}) as Map;
              return Container(
                decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(16)),
                clipBehavior: Clip.antiAlias,
                child: Stack(fit: StackFit.expand, children: [
                  if ((s['thumbnail_url'] ?? '').toString().isNotEmpty)
                    CachedNetworkImage(imageUrl: s['thumbnail_url'], fit: BoxFit.cover)
                  else
                    const ColoredBox(color: Color(0xFF1E293B)),
                  const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black87]))),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.destructive, borderRadius: BorderRadius.circular(4)),
                      child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(4)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(LucideIcons.eye, size: 10, color: Colors.white),
                        const SizedBox(width: 3),
                        Text('${s['viewer_count'] ?? 0}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                  ),
                  Positioned(
                    left: 8, right: 8, bottom: 8,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${s['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Row(children: [
                        CircleAvatar(radius: 10, backgroundColor: AppColors.mutedSurface, backgroundImage: (host['avatar_url'] ?? '').toString().isNotEmpty ? CachedNetworkImageProvider(host['avatar_url']) : null),
                        const SizedBox(width: 6),
                        Expanded(child: Text(host['display_name']?.toString() ?? 'Host', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70, fontSize: 11))),
                      ]),
                    ]),
                  ),
                ]),
              );
            },
          );
        },
      ),
    );
  }
}
