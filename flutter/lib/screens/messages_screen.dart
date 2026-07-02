import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../services/auth_service.dart';
import '../services/messages_service.dart';
import '../theme/palette.dart';
import 'auth_screen.dart';
import 'thread_screen.dart';

/// Inbox — mirrors `src/pages/Messages.tsx` (conversations list).
class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  Future<List<Map<String, dynamic>>>? _future;

  void _load(String userId) {
    _future = messagesService.listConversations(userId);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Messages')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(LucideIcons.messageCircle,
                  size: 40, color: AppColors.muted),
              const SizedBox(height: 12),
              const Text('Sign in to chat with suppliers',
                  style: TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const AuthScreen())),
                child: const Text('Sign in'),
              ),
            ]),
          ),
        ),
      );
    }
    _future ??= messagesService.listConversations(user.id);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages',
            style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 18),
            onPressed: () => setState(() => _load(user.id)),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _load(user.id)),
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snap.hasError) {
              return ListView(children: [
                Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Failed: ${snap.error}',
                        style: const TextStyle(color: AppColors.muted))),
              ]);
            }
            final items = snap.data ?? [];
            if (items.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 120),
                Center(
                    child: Text('No conversations yet',
                        style: TextStyle(color: AppColors.muted))),
              ]);
            }
            return ListView.separated(
              itemCount: items.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, i) {
                final c = items[i];
                final supplier =
                    (c['supplier'] as Map?)?.cast<String, dynamic>();
                final name = supplier?['name'] ??
                    c['title'] ??
                    'Conversation';
                final logo = supplier?['logo'] as String?;
                final last = c['last_message'] as String? ?? '';
                final at = c['last_message_at'] as String?;
                return ListTile(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => ThreadScreen(
                      conversationId: c['id'] as String,
                      title: name as String,
                    ),
                  )),
                  leading: CircleAvatar(
                    radius: 24,
                    backgroundColor: AppColors.mutedSurface,
                    backgroundImage: logo != null
                        ? CachedNetworkImageProvider(logo)
                        : null,
                    child: logo == null
                        ? const Icon(LucideIcons.store,
                            color: AppColors.muted, size: 18)
                        : null,
                  ),
                  title: Text(name as String,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(last,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.muted)),
                  trailing: at == null
                      ? null
                      : Text(_fmt(at),
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.muted)),
                );
              },
            );
          },
        ),
      ),
    );
  }

  String _fmt(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    final now = DateTime.now();
    if (d.year == now.year && d.month == now.month && d.day == now.day) {
      return DateFormat.Hm().format(d);
    }
    return DateFormat.MMMd().format(d);
  }
}
