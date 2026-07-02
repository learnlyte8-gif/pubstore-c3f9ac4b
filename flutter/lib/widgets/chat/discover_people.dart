import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../services/supabase_client.dart';
import '../../theme/palette.dart';

/// Discover people to DM — mirrors `src/components/social/DiscoverPeople.tsx`.
class DiscoverPeople extends StatefulWidget {
  const DiscoverPeople({super.key, required this.userId, required this.onOpen});
  final String userId;
  final void Function(String peerUserId, String name) onOpen;

  @override
  State<DiscoverPeople> createState() => _DiscoverPeopleState();
}

class _DiscoverPeopleState extends State<DiscoverPeople> {
  List<Map<String, dynamic>> _people = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .neq('user_id', widget.userId)
          .limit(40);
      setState(() {
        _people = (rows as List).cast<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()));
    if (_people.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text('No people to discover yet.',
            textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
      );
    }
    return ListView.separated(
      itemCount: _people.length,
      separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
      itemBuilder: (_, i) {
        final p = _people[i];
        final name = (p['display_name'] ?? p['username'] ?? 'User').toString();
        return ListTile(
          leading: CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.mutedSurface,
            backgroundImage:
                p['avatar_url'] != null ? CachedNetworkImageProvider(p['avatar_url'].toString()) : null,
            child: p['avatar_url'] == null
                ? const Icon(LucideIcons.user, size: 18, color: AppColors.muted)
                : null,
          ),
          title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.foreground)),
          subtitle: p['username'] != null
              ? Text('@${p['username']}', style: const TextStyle(color: AppColors.muted, fontSize: 12))
              : null,
          trailing: TextButton.icon(
            onPressed: () => widget.onOpen(p['user_id'].toString(), name),
            icon: const Icon(LucideIcons.messageCircle, size: 14),
            label: const Text('Chat'),
          ),
        );
      },
    );
  }
}
