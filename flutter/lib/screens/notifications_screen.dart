import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/auth_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Notifications — mirrors `src/pages/Notifications.tsx`.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  Future<List<Map<String, dynamic>>>? _future;

  Future<List<Map<String, dynamic>>> _fetch(String uid) async {
    final rows = await supabase
        .from('notifications')
        .select('id, title, body, created_at, read_at, type')
        .eq('user_id', uid)
        .order('created_at', ascending: false)
        .limit(100);
    return (rows as List).cast<Map<String, dynamic>>();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: const Center(
            child: Text('Sign in to see notifications',
                style: TextStyle(color: AppColors.muted))),
      );
    }
    _future ??= _fetch(user.id);
    return Scaffold(
      appBar: AppBar(
          title: const Text('Notifications',
              style: TextStyle(fontWeight: FontWeight.w800))),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _future = _fetch(user.id)),
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return Skeletons.list(count: 6);
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Center(
                    child: Text('You\'re all caught up',
                        style: TextStyle(color: AppColors.muted))),
              ]);
            }
            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, i) {
                final n = items[i];
                final read = n['read_at'] != null;
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: read
                        ? AppColors.mutedSurface
                        : AppColors.primary.withOpacity(0.12),
                    child: Icon(LucideIcons.bell,
                        size: 16,
                        color:
                            read ? AppColors.muted : AppColors.primary),
                  ),
                  title: Text(n['title'] as String? ?? 'Notification',
                      style: TextStyle(
                          fontWeight:
                              read ? FontWeight.w600 : FontWeight.w800)),
                  subtitle: Text(n['body'] as String? ?? '',
                      maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: Text(
                    n['created_at'] == null
                        ? ''
                        : DateFormat.MMMd().format(
                            DateTime.parse(n['created_at'] as String)
                                .toLocal()),
                    style:
                        const TextStyle(fontSize: 11, color: AppColors.muted),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
