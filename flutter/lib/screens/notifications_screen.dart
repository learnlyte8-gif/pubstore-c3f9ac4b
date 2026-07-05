import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/auth_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/skeletons.dart';

/// Mirrors `src/pages/Notifications.tsx` — filters, mark-all-read, swipe delete, realtime insert.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String _filter = 'all';
  RealtimeChannel? _channel;

  static const _filters = <(String, String)>[
    ('all', 'All'),
    ('order', 'Orders'),
    ('rfq', 'RFQs'),
    ('message', 'Messages'),
  ];

  @override
  void dispose() {
    if (_channel != null) supabase.removeChannel(_channel!);
    super.dispose();
  }

  Future<void> _load(String uid) async {
    try {
      final rows = await supabase
          .from('notifications')
          .select('id, type, title, body, link, read, created_at')
          .eq('user_id', uid)
          .order('created_at', ascending: false)
          .limit(100);
      if (!mounted) return;
      setState(() {
        _items = (rows as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
    _subscribe(uid);
  }

  void _subscribe(String uid) {
    if (_channel != null) return;
    _channel = supabase
        .channel('notif:$uid:${DateTime.now().millisecondsSinceEpoch}')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'notifications',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'user_id', value: uid),
          callback: (p) {
            if (!mounted) return;
            setState(() => _items = [p.newRecord, ..._items]);
          },
        )
        .subscribe();
  }

  Future<void> _markAll(String uid) async {
    setState(() => _items = _items.map((n) => {...n, 'read': true}).toList());
    await supabase.from('notifications').update({'read': true}).eq('user_id', uid).eq('read', false);
  }

  Future<void> _open(Map<String, dynamic> n) async {
    if (n['read'] != true) {
      setState(() => _items = _items.map((x) => x['id'] == n['id'] ? {...x, 'read': true} : x).toList());
      await supabase.from('notifications').update({'read': true}).eq('id', n['id']);
    }
    final link = n['link']?.toString();
    if (link != null && link.isNotEmpty && mounted) {
      Navigator.of(context).pushNamed(link);
    }
  }

  Future<void> _remove(String id) async {
    setState(() => _items.removeWhere((n) => n['id'] == id));
    await supabase.from('notifications').delete().eq('id', id);
  }

  ({IconData icon, Color tone, String label}) _meta(String type) {
    if (type == 'new_order') return (icon: LucideIcons.shoppingBag, tone: AppColors.warning, label: 'New order');
    if (type.startsWith('order')) return (icon: LucideIcons.truck, tone: const Color(0xFF7C3AED), label: 'Orders');
    if (type == 'message') return (icon: LucideIcons.messageCircle, tone: AppColors.accent, label: 'Messages');
    if (type.startsWith('rfq')) return (icon: LucideIcons.fileText, tone: AppColors.primary, label: 'RFQ');
    if (type == 'price') return (icon: LucideIcons.trendingDown, tone: AppColors.success, label: 'Prices');
    if (type == 'follower') return (icon: LucideIcons.userPlus, tone: const Color(0xFFEC4899), label: 'Follower');
    return (icon: LucideIcons.sparkles, tone: AppColors.warning, label: 'System');
  }

  String _fmtTime(String iso) {
    final d = DateTime.parse(iso).toLocal();
    final diff = DateTime.now().difference(d);
    if (diff.inSeconds < 60) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return DateFormat.MMMd().format(d);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: const Center(child: Text('Sign in to see notifications', style: TextStyle(color: AppColors.muted))),
      );
    }
    if (_loading && _items.isEmpty) _load(user.id);

    final visible = _items.where((n) => _filter == 'all' || (n['type']?.toString() ?? '').startsWith(_filter)).toList();
    final unread = _items.where((n) => n['read'] != true).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          Text(unread > 0 ? '$unread unread' : 'All caught up',
              style: const TextStyle(fontSize: 11, color: AppColors.muted, fontWeight: FontWeight.w500)),
        ]),
        actions: [
          if (unread > 0)
            TextButton.icon(
              onPressed: () => _markAll(user.id),
              icon: const Icon(LucideIcons.checkCheck, size: 14),
              label: const Text('Mark all', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: Column(children: [
        SizedBox(
          height: 44,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            itemCount: _filters.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final (id, label) = _filters[i];
              final active = _filter == id;
              return GestureDetector(
                onTap: () => setState(() => _filter = id),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: active ? AppColors.foreground : AppColors.mutedSurface,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(label,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: active ? AppColors.background : AppColors.foreground)),
                ),
              );
            },
          ),
        ),
        Expanded(
          child: _loading
              ? Skeletons.list(count: 6)
              : visible.isEmpty
                  ? ListView(children: const [
                      SizedBox(height: 100),
                      Icon(LucideIcons.bell, size: 40, color: AppColors.muted),
                      SizedBox(height: 8),
                      Center(child: Text('Nothing here yet', style: TextStyle(fontWeight: FontWeight.w700))),
                      SizedBox(height: 4),
                      Center(child: Text('New activity will appear in this feed.', style: TextStyle(fontSize: 12, color: AppColors.muted))),
                    ])
                  : RefreshIndicator(
                      onRefresh: () async {
                        setState(() => _loading = true);
                        await _load(user.id);
                      },
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                        itemCount: visible.length,
                        itemBuilder: (_, i) {
                          final n = visible[i];
                          final read = n['read'] == true;
                          final m = _meta((n['type'] ?? '').toString());
                          return Dismissible(
                            key: ValueKey(n['id']),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 20),
                              decoration: BoxDecoration(color: AppColors.destructive.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                              child: const Icon(LucideIcons.trash2, color: AppColors.destructive),
                            ),
                            onDismissed: (_) => _remove(n['id'].toString()),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: read ? AppColors.mutedSurface.withValues(alpha: 0.4) : AppColors.card,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: () => _open(n),
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Stack(children: [
                                        Container(
                                          width: 40, height: 40,
                                          decoration: BoxDecoration(color: m.tone.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                                          child: Icon(m.icon, size: 20, color: m.tone),
                                        ),
                                        if (!read)
                                          Positioned(
                                            top: -2, right: -2,
                                            child: Container(
                                              width: 10, height: 10,
                                              decoration: BoxDecoration(
                                                color: AppColors.destructive,
                                                shape: BoxShape.circle,
                                                border: Border.all(color: AppColors.background, width: 2),
                                              ),
                                            ),
                                          ),
                                      ]),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                          Row(children: [
                                            Expanded(
                                              child: Text(n['title']?.toString() ?? 'Notification',
                                                  style: TextStyle(
                                                      fontSize: 13,
                                                      fontWeight: read ? FontWeight.w600 : FontWeight.w800,
                                                      color: AppColors.foreground)),
                                            ),
                                            const SizedBox(width: 6),
                                            Text(_fmtTime(n['created_at'].toString()),
                                                style: const TextStyle(fontSize: 10, color: AppColors.muted)),
                                          ]),
                                          if ((n['body']?.toString() ?? '').isNotEmpty) ...[
                                            const SizedBox(height: 2),
                                            Text(n['body'].toString(),
                                                maxLines: 2, overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                                          ],
                                        ]),
                                      ),
                                    ]),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ]),
    );
  }
}
