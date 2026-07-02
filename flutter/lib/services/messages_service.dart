import '../models/message_models.dart';
import 'supabase_client.dart';

/// Chat data layer — mirrors the queries in `src/pages/Messages.tsx`.
class MessagesService {
  const MessagesService();

  List<List<T>> _chunk<T>(List<T> xs, int size) {
    final out = <List<T>>[];
    for (var i = 0; i < xs.length; i += size) {
      out.add(xs.sublist(i, i + size > xs.length ? xs.length : i + size));
    }
    return out;
  }

  /// Loads and resolves every conversation this user can see: buyer-owned,
  /// supplier-owned, and membership-based (DMs, group buys).
  Future<List<Map>> _safeList(Future<dynamic> Function() fn) async {
    try {
      final v = await fn();
      return (v as List).cast<Map>();
    } catch (e) {
      // ignore: avoid_print
      print('messages_service query failed: $e');
      return const <Map>[];
    }
  }

  Future<List<ChatConversation>> loadConversations(String uid) async {
    final buyerRows = await _safeList(() => supabase
        .from('conversations')
        .select('*')
        .eq('buyer_id', uid)
        .order('last_message_at', ascending: false));

    final mySuppliers = await _safeList(() =>
        supabase.from('suppliers').select('id, owner_id').eq('owner_id', uid));
    final supplierIds = mySuppliers
        .map((s) => s['id']?.toString())
        .whereType<String>()
        .toList();

    final supRows = <Map>[];
    for (final group in _chunk(supplierIds, 50)) {
      supRows.addAll(await _safeList(() => supabase
          .from('conversations')
          .select('*')
          .inFilter('supplier_id', group)
          .order('last_message_at', ascending: false)));
    }

    final memberRows = await _safeList(() => supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', uid));
    final memberIds = memberRows
        .map((r) => r['conversation_id']?.toString())
        .whereType<String>()
        .toList();
    final memberConvRows = <Map>[];
    for (final group in _chunk(memberIds, 50)) {
      memberConvRows.addAll(await _safeList(() =>
          supabase.from('conversations').select('*').inFilter('id', group)));
    }

    final all = <Map>[
      ...buyerRows,
      ...supRows,
      ...memberConvRows,
    ];
    final seen = <String>{};
    final merged = <ChatConversation>[];
    for (final r in all) {
      final id = r['id'].toString();
      if (seen.add(id)) {
        merged.add(ChatConversation.fromRow(Map<String, dynamic>.from(r)));
      }
    }
    merged.sort((a, b) =>
        (b.lastMessageAt ?? DateTime(0)).compareTo(a.lastMessageAt ?? DateTime(0)));

    // Resolve supplier profiles.
    final needsSup = merged.map((c) => c.supplierId).whereType<String>().toSet().toList();
    final supplierMap = <String, Map<String, dynamic>>{};
    for (final group in _chunk(needsSup, 50)) {
      final data = await supabase
          .from('suppliers')
          .select('id,name,logo,verified,response_time,response_rate,owner_id')
          .inFilter('id', group);
      for (final s in (data as List).cast<Map>()) {
        supplierMap[s['id'].toString()] = Map<String, dynamic>.from(s);
      }
    }

    // Resolve profiles for owner-side buyer rows and DM peers.
    final profileIds = <String>{};
    for (final c in merged) {
      final sup = c.supplierId == null ? null : supplierMap[c.supplierId];
      if (sup != null && sup['owner_id']?.toString() == uid && c.buyerId != uid) {
        profileIds.add(c.buyerId);
      }
      if (c.resolvedKind == 'dm') {
        final peer = c.peerUserId ?? (c.buyerId == uid ? null : c.buyerId);
        if (peer != null && peer != uid) profileIds.add(peer);
      }
    }
    final profileMap = <String, Map<String, dynamic>>{};
    for (final group in _chunk(profileIds.toList(), 50)) {
      final data = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .inFilter('user_id', group);
      for (final p in (data as List).cast<Map>()) {
        profileMap[p['user_id'].toString()] = Map<String, dynamic>.from(p);
      }
    }

    // Group-buy resolution
    final groupConvIds = merged
        .where((c) => c.resolvedKind == 'group_buy')
        .map((c) => c.id)
        .toList();
    final groupMap = <String, Map<String, dynamic>>{};
    if (groupConvIds.isNotEmpty) {
      final data = await supabase
          .from('group_buys')
          .select('id,title,target_qty,status,conversation_id')
          .inFilter('conversation_id', groupConvIds);
      for (final g in (data as List).cast<Map>()) {
        final cid = g['conversation_id']?.toString();
        if (cid != null) groupMap[cid] = Map<String, dynamic>.from(g);
      }
    }

    for (final c in merged) {
      final sup = c.supplierId == null ? null : supplierMap[c.supplierId];
      final kind = c.resolvedKind;
      if (kind == 'group_buy') {
        final g = groupMap[c.id];
        c.peer = ChatPeer(
          name: (g?['title'] ?? c.title ?? 'Group buy').toString(),
          subtitle: g == null
              ? 'Group chat'
              : 'Group · target ${g['target_qty']} · ${g['status']}',
          groupBuyId: g?['id']?.toString(),
        );
        continue;
      }
      if (kind == 'dm') {
        final peerId = c.peerUserId ?? (c.buyerId == uid ? null : c.buyerId);
        final p = peerId == null ? null : profileMap[peerId];
        final name = (p?['display_name'] ?? p?['username'] ?? 'Direct message').toString();
        c.peer = ChatPeer(
          name: name,
          logo: p?['avatar_url']?.toString(),
          subtitle: p?['username'] != null ? '@${p!['username']}' : 'Direct message',
        );
        continue;
      }
      final userIsOwner = sup?['owner_id']?.toString() == uid;
      if (userIsOwner) {
        final p = profileMap[c.buyerId];
        final name = (p?['display_name'] ?? p?['username'] ?? 'Customer').toString();
        c.peer = ChatPeer(
          name: name,
          logo: p?['avatar_url']?.toString(),
          subtitle: p?['username'] != null ? '@${p!['username']}' : 'Customer',
          supplierId: c.supplierId,
        );
      } else if (sup != null) {
        c.peer = ChatPeer(
          name: (sup['name'] ?? 'Supplier').toString(),
          logo: sup['logo']?.toString(),
          verified: sup['verified'] == true,
          subtitle: sup['response_time'] != null
              ? 'Responds ${sup['response_time']}'
              : 'Active now',
          supplierId: c.supplierId,
        );
      }
      // Store the supplier owner on the conversation via a shadow map — we
      // return conversations wrapped with owner data through peer for now.
    }

    return merged;
  }

  Future<String?> supplierOwnerId(String supplierId) async {
    final r = await supabase
        .from('suppliers')
        .select('owner_id')
        .eq('id', supplierId)
        .maybeSingle();
    return r?['owner_id']?.toString();
  }

  Future<List<ChatMessage>> listMessages(String conversationId) async {
    final rows = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, body, created_at, attachment, reply_to_id, reactions, forwarded')
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .limit(400);
    return (rows as List)
        .cast<Map>()
        .map((r) => ChatMessage.fromRow(Map<String, dynamic>.from(r)))
        .toList();
  }

  /// Legacy wrapper used by older screens.
  Future<List<Map<String, dynamic>>> listConversations(String userId) async {
    final convs = await loadConversations(userId);
    return convs
        .map((c) => {
              'id': c.id,
              'title': c.peer?.name ?? c.title,
              'last_message': c.lastMessage,
              'last_message_at': c.lastMessageAt?.toIso8601String(),
              'supplier': c.supplierId == null
                  ? null
                  : {'name': c.peer?.name, 'logo': c.peer?.logo},
            })
        .toList();
  }

  Future<ChatMessage?> insertMessage({
    required String conversationId,
    required String senderId,
    required String body,
    ChatAttachment? attachment,
    String? replyToId,
    bool forwarded = false,
  }) async {
    final row = await supabase.from('messages').insert({
      'conversation_id': conversationId,
      'sender_id': senderId,
      'body': body,
      'attachment': attachment?.toJson(),
      'reply_to_id': replyToId,
      'forwarded': forwarded,
    }).select('*').single();
    await supabase.from('conversations').update({
      'last_message': body,
      'last_message_at': DateTime.now().toIso8601String(),
    }).eq('id', conversationId);
    return ChatMessage.fromRow(Map<String, dynamic>.from(row));
  }

  /// Legacy wrapper used by older screens.
  Future<void> sendMessage({
    required String conversationId,
    required String senderId,
    required String body,
  }) async {
    await insertMessage(conversationId: conversationId, senderId: senderId, body: body);
  }

  Future<void> deleteMessage(String messageId) async {
    await supabase.from('messages').delete().eq('id', messageId);
  }

  Future<void> updateReactions(String messageId, Reactions reactions) async {
    await supabase.from('messages').update({'reactions': reactions}).eq('id', messageId);
  }

  Future<String?> ensureConversationWithSupplier({
    required String buyerId,
    required String supplierId,
  }) async {
    final existing = await supabase
        .from('conversations')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('supplier_id', supplierId)
        .maybeSingle();
    if (existing != null) return existing['id']?.toString();
    final row = await supabase
        .from('conversations')
        .insert({'buyer_id': buyerId, 'supplier_id': supplierId})
        .select('id')
        .single();
    return row['id']?.toString();
  }

  Future<void> notifyPeer({
    required String otherUserId,
    required String preview,
  }) async {
    await supabase.from('notifications').insert({
      'user_id': otherUserId,
      'type': 'message',
      'title': 'New message',
      'body': preview.length > 80 ? '${preview.substring(0, 80)}…' : preview,
      'link': '/messages',
    });
  }

  Future<Map<String, int>> unreadCounts(String userId) async {
    // Best-effort unread count per conversation: messages after
    // `conversation_members.last_read_at` (falls back to 0 when absent).
    try {
      final members = await supabase
          .from('conversation_members')
          .select('conversation_id, last_read_at')
          .eq('user_id', userId);
      final result = <String, int>{};
      for (final m in (members as List).cast<Map>()) {
        final cid = m['conversation_id'].toString();
        final since = m['last_read_at']?.toString();
        var q = supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', cid)
            .neq('sender_id', userId);
        if (since != null) q = q.gt('created_at', since);
        final rows = await q;
        result[cid] = (rows as List).length;
      }
      return result;
    } catch (_) {
      return {};
    }
  }
}

const messagesService = MessagesService();
