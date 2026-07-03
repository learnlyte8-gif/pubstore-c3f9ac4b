import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/message_models.dart';
import '../services/auth_service.dart';
import '../services/messages_service.dart';
import '../services/supabase_client.dart';
import '../theme/palette.dart';
import '../widgets/chat/discover_people.dart';
import '../widgets/skeletons.dart';
import 'auth_screen.dart';
import 'thread_screen.dart';

/// Inbox — mirrors `src/pages/Messages.tsx`.
class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key, this.supplierId, this.prefill, this.conversationId});
  final String? supplierId;
  final String? prefill;
  final String? conversationId;

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

enum _Tab { unread, suppliers, people, groups, discover }

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  List<ChatConversation> _conversations = [];
  Map<String, int> _unread = {};
  bool _loading = true;
  String _search = '';
  _Tab _tab = _Tab.suppliers;
  RealtimeChannel? _listChannel;
  Timer? _poll;

  StreamSubscription<AuthState>? _authSub;
  bool _bootstrapped = false;

  @override
  void initState() {
    super.initState();
    _tryBootstrap();
    _authSub = supabase.auth.onAuthStateChange.listen((_) => _tryBootstrap());
  }

  @override
  void dispose() {
    if (_listChannel != null) supabase.removeChannel(_listChannel!);
    _poll?.cancel();
    _authSub?.cancel();
    super.dispose();
  }

  Future<void> _tryBootstrap() async {
    if (_bootstrapped) return;
    final uid = supabase.auth.currentUser?.id;
    if (uid == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    _bootstrapped = true;
    await _bootstrap(uid);
  }

  Future<void> _bootstrap(String uid) async {
    await _refresh(uid);
    if (widget.supplierId != null) {
      try {
        final convId = await messagesService.ensureConversationWithSupplier(
          buyerId: uid,
          supplierId: widget.supplierId!,
        );
        if (convId != null && mounted) {
          await _refresh(uid);
          _openConversation(convId, prefill: widget.prefill);
        }
      } catch (e) {
        debugPrint('ensureConversation failed: $e');
      }
    } else if (widget.conversationId != null) {
      _openConversation(widget.conversationId!);
    }
    _listChannel = supabase
        .channel('conv-list:$uid:${DateTime.now().millisecondsSinceEpoch}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'conversations',
          callback: (_) => _refresh(uid),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          callback: (_) => _refresh(uid),
        )
        .subscribe();
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => _refresh(uid));
  }

  Future<void> _refresh(String uid) async {
    try {
      final convs = await messagesService.loadConversations(uid);
      Map<String, int> unread = {};
      try {
        unread = await messagesService.unreadCounts(uid);
      } catch (e) {
        debugPrint('unreadCounts failed: $e');
      }
      if (!mounted) return;
      setState(() {
        _conversations = convs;
        _unread = unread;
        _loading = false;
      });
    } catch (e, st) {
      debugPrint('loadConversations failed: $e\n$st');
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openConversation(String id, {String? prefill}) {
    final conv = _conversations.firstWhere(
      (c) => c.id == id,
      orElse: () => ChatConversation(id: id, buyerId: ''),
    );
    Navigator.of(context)
        .push(MaterialPageRoute(
          builder: (_) => ThreadScreen(conversation: conv, prefill: prefill),
        ))
        .then((_) {
          final uid = supabase.auth.currentUser?.id;
          if (uid != null) _refresh(uid);
        });
  }

  List<ChatConversation> get _filtered {
    final q = _search.toLowerCase();
    return _conversations.where((c) {
      final name = (c.title ?? c.peer?.name ?? '').toLowerCase();
      if (q.isNotEmpty && !name.contains(q)) return false;
      switch (_tab) {
        case _Tab.unread:
          return (_unread[c.id] ?? 0) > 0;
        case _Tab.suppliers:
          return c.resolvedKind == 'buyer_supplier';
        case _Tab.people:
          return c.resolvedKind == 'dm';
        case _Tab.groups:
          return c.resolvedKind == 'group_buy';
        case _Tab.discover:
          return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return _signedOut();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        title: const Text('Messages',
            style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.foreground)),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 18, color: AppColors.foreground),
            onPressed: () => _refresh(user.id),
          ),
          IconButton(
            icon: const Icon(LucideIcons.penSquare, size: 18, color: AppColors.foreground),
            onPressed: () => setState(() => _tab = _Tab.discover),
          ),
        ],
      ),
      body: Column(children: [
        _searchBar(),
        _tabsBar(),
        Expanded(
          child: _tab == _Tab.discover
              ? DiscoverPeople(
                  userId: user.id,
                  onOpen: (peerId, name) async {
                    // Create/open a DM conversation
                    final existing = _conversations.firstWhere(
                      (c) =>
                          c.resolvedKind == 'dm' &&
                          ((c.buyerId == user.id && c.peerUserId == peerId) ||
                              (c.peerUserId == user.id && c.buyerId == peerId)),
                      orElse: () => ChatConversation(id: '', buyerId: ''),
                    );
                    if (existing.id.isNotEmpty) {
                      _openConversation(existing.id);
                      return;
                    }
                    try {
                      final row = await supabase
                          .from('conversations')
                          .insert({
                            'buyer_id': user.id,
                            'peer_user_id': peerId,
                            'kind': 'dm',
                            'title': name,
                          })
                          .select('id')
                          .single();
                      await _refresh(user.id);
                      _openConversation(row['id'].toString());
                    } catch (e) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text('Could not open chat: $e')));
                    }
                  },
                )
              : _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _filtered.isEmpty
                      ? _emptyList()
                      : RefreshIndicator(
                          onRefresh: () => _refresh(user.id),
                          child: ListView.separated(
                            itemCount: _filtered.length,
                            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
                            itemBuilder: (_, i) => _row(_filtered[i]),
                          ),
                        ),
        ),
      ]),
    );
  }

  Widget _searchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: TextField(
        onChanged: (v) => setState(() => _search = v),
        decoration: InputDecoration(
          hintText: 'Search conversations',
          prefixIcon: const Icon(LucideIcons.search, size: 16, color: AppColors.muted),
          filled: true,
          fillColor: AppColors.mutedSurface,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(999),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  Widget _tabsBar() {
    _Tab t(String label, _Tab tab, IconData icon) => tab;
    final tabs = <(_Tab, String, IconData)>[
      (_Tab.unread, 'Unread', LucideIcons.inbox),
      (_Tab.suppliers, 'Suppliers', LucideIcons.store),
      (_Tab.people, 'People', LucideIcons.users),
      (_Tab.groups, 'Groups', LucideIcons.hash),
      (_Tab.discover, 'Discover', LucideIcons.userPlus),
    ];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final (id, label, icon) = tabs[i];
          final active = _tab == id;
          final count = id == _Tab.unread ? _unread.values.fold<int>(0, (a, b) => a + b) : 0;
          return GestureDetector(
            onTap: () => setState(() => _tab = id),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: active ? AppColors.foreground : AppColors.mutedSurface,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(children: [
                Icon(icon, size: 14, color: active ? AppColors.background : AppColors.foreground),
                const SizedBox(width: 6),
                Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: active ? AppColors.background : AppColors.foreground)),
                if (count > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.priceRed,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('$count',
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white)),
                  ),
                ]
              ]),
            ),
          );
        },
      ),
    );
  }

  Widget _row(ChatConversation c) {
    final peer = c.peer;
    final name = peer?.name ?? c.title ?? 'Conversation';
    final logo = peer?.logo;
    final unread = _unread[c.id] ?? 0;
    final at = c.lastMessageAt;
    return Material(
      color: AppColors.background,
      child: InkWell(
        onTap: () => _openConversation(c.id),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(children: [
            _avatar(logo, name),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(
                    child: Text(name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: unread > 0 ? FontWeight.w900 : FontWeight.w700,
                            color: AppColors.foreground)),
                  ),
                  if (peer?.verified == true) ...[
                    const SizedBox(width: 4),
                    const Icon(LucideIcons.shieldCheck, size: 12, color: AppColors.primary),
                  ],
                  if (at != null) ...[
                    const SizedBox(width: 6),
                    Text(_fmtRel(at),
                        style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                  ],
                ]),
                const SizedBox(height: 2),
                Row(children: [
                  Expanded(
                    child: Text(c.lastMessage ?? peer?.subtitle ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 12,
                            color: unread > 0 ? AppColors.foreground : AppColors.muted,
                            fontWeight: unread > 0 ? FontWeight.w700 : FontWeight.w400)),
                  ),
                  if (unread > 0)
                    Container(
                      margin: const EdgeInsets.only(left: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text('$unread',
                          style: const TextStyle(
                              fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white)),
                    ),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _avatar(String? logo, String name) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFFEC4899), Color(0xFFF59E0B), Color(0xFF3B82F6)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: CircleAvatar(
        radius: 22,
        backgroundColor: AppColors.mutedSurface,
        backgroundImage: logo != null ? CachedNetworkImageProvider(logo) : null,
        child: logo == null
            ? Text(name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.foreground))
            : null,
      ),
    );
  }

  Widget _emptyList() {
    return ListView(children: const [
      SizedBox(height: 120),
      Icon(LucideIcons.messageCircle, size: 36, color: AppColors.muted),
      SizedBox(height: 12),
      Center(
          child: Text('No conversations here yet.',
              style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w600))),
    ]);
  }

  Widget _signedOut() {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        elevation: 0,
        title: const Text('Messages', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.foreground)),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(LucideIcons.messageCircle, size: 40, color: AppColors.muted),
            const SizedBox(height: 12),
            const Text('Sign in to chat with suppliers',
                style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.foreground)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () =>
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AuthScreen())),
              child: const Text('Sign in'),
            ),
          ]),
        ),
      ),
    );
  }

  String _fmtRel(DateTime d) {
    final now = DateTime.now();
    if (d.year == now.year && d.month == now.month && d.day == now.day) {
      return DateFormat.Hm().format(d);
    }
    return DateFormat.MMMd().format(d);
  }
}
